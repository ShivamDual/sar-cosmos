/* Cosmo chat proxy (Cloudflare Worker).
   WHY THIS EXISTS: an API key placed in website code is public the moment the site is. The browser talks to
   this Worker; only the Worker knows the key (stored as a Cloudflare secret, never in any file).
   The Worker: validates and size-limits the request, adds the project knowledge and live page data to a
   fixed system prompt, calls the configured AI provider, and streams plain text back as server-sent events. */
import { KNOWLEDGE, RULES } from "./knowledge.js";

export const LIMITS = { messages: 14, chars: 1500, context: 6000, maxTokens: 700 };
export function buildSystemPrompt(contextJson) {
  return `${RULES}

KNOWLEDGE
${KNOWLEDGE}

PAGE DATA (JSON from the visitor's browser, what the page shows right now)
${contextJson}`;
}

export function validate(body) {
  if (!body || !Array.isArray(body.messages)) return { ok: false, error: "messages_required" };
  const clean = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, LIMITS.chars);
  let msgs = body.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: clean(m.content) }))
    .filter((m) => m.content.length > 0)
    .slice(-LIMITS.messages);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return { ok: false, error: "last_message_must_be_user" };
  let ctx = "{}";
  if (body.context && typeof body.context === "object") {
    try { ctx = JSON.stringify(body.context).slice(0, LIMITS.context); } catch { ctx = "{}"; }
  }
  return { ok: true, messages: msgs, context: ctx };
}

export function originAllowed(origin, env) {
  const list = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length === 0 || list.includes(origin);
}

function cors(origin, env) {
  return {
    "access-control-allow-origin": originAllowed(origin, env) ? (origin || "*") : "null",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}
const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { ...headers, "content-type": "application/json" } });

async function rateLimited(request, env) {
  if (!env.LIMITS) return null;                                   // optional: only if a KV namespace is bound
  const day = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const bump = async (key, limit) => {
    const n = Number((await env.LIMITS.get(key)) || 0);
    if (n >= limit) return true;
    await env.LIMITS.put(key, String(n + 1), { expirationTtl: 172800 });
    return false;
  };
  if (await bump(`all:${day}`, Number(env.GLOBAL_DAILY || 1500))) return "The assistant has reached its daily limit. Please try again tomorrow.";
  if (await bump(`ip:${ip}:${day}`, Number(env.PER_IP_DAILY || 40))) return "You have reached today's question limit. Please come back tomorrow.";
  return null;
}

/* ---- providers: each returns an upstream Response whose body is a server-sent-event stream ---- */
function callSecondary(env, system, messages) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.SECONDARY_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: env.SECONDARY_MODEL || "claude-haiku-5-5", max_tokens: LIMITS.maxTokens, system, messages, stream: true }),
  });
}
function callPrimary(env, system, messages) {
  const model = env.PRIMARY_MODEL || "gemini-2.0-flash";
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.PRIMARY_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: LIMITS.maxTokens, temperature: 0.5 },
    }),
  });
}

/* Parse an SSE body into JSON objects (one per "data:" line). */
export async function* sseJson(body) {
  const reader = body.getReader(), dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of block.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try { yield JSON.parse(d); } catch { /* ignore a malformed chunk */ }
      }
    }
  }
}
export function textOfSecondary(ev) {
  if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") return { t: ev.delta.text };
  if (ev.type === "error") return { error: "upstream" };
  return null;
}
export function textOfPrimary(ev) {
  if (ev.promptFeedback && ev.promptFeedback.blockReason) return { error: "blocked" };
  const c = ev.candidates && ev.candidates[0];
  if (!c) return null;
  if (c.finishReason === "SAFETY") return { error: "blocked" };
  const t = ((c.content && c.content.parts) || []).map((p) => p.text || "").join("");
  return t ? { t } : null;
}

export async function handle(request, env) {
  const origin = request.headers.get("origin") || "";
  const h = cors(origin, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, h);
  if (!originAllowed(origin, env)) return json({ error: "origin_not_allowed" }, 403, h);

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400, h); }
  const v = validate(body);
  if (!v.ok) return json({ error: v.error }, 400, h);

  const provider = String(env.PROVIDER || "primary").toLowerCase();
  const key = provider === "secondary" ? env.SECONDARY_API_KEY : env.PRIMARY_API_KEY;
  if (!key) return json({ error: "not_configured" }, 503, h);          // the website falls back to page-data answers
  const limited = await rateLimited(request, env);
  if (limited) return json({ error: "rate_limited", message: limited }, 429, h);

  const system = buildSystemPrompt(v.context);
  let up;
  try { up = await (provider === "secondary" ? callSecondary(env, system, v.messages) : callPrimary(env, system, v.messages)); }
  catch { return json({ error: "upstream_unreachable" }, 502, h); }
  if (!up.ok || !up.body) return json({ error: "upstream", status: up.status }, 502, h);

  const pick = provider === "secondary" ? textOfSecondary : textOfPrimary;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o) => controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      try {
        for await (const ev of sseJson(up.body)) { const o = pick(ev); if (o) send(o); }
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
      } catch { send({ error: "stream_failed" }); }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { ...h, "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store" } });
}

export default { fetch: handle };
