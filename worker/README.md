# Cosmo AI: connect the full assistant (about 10 minutes)

Without this, Cosmo still works: it answers from the numbers on the page ("Page-data mode").
With this, Cosmo can answer almost anything and knows the whole project.

**Why a proxy?** An API key in website code is public the moment the site is. The browser talks to a tiny
Cloudflare Worker; only the Worker holds the key, as a Cloudflare *secret*. No key is ever in a file.

## 1. Get an API key (pick one)
- **Primary provider (free tier)**: create a key in the provider's developer console. Set PROVIDER = "primary".
- **Secondary provider (paid, higher quality)**: create a key in its developer console. Set PROVIDER = "secondary".
Treat the key like a password. Never paste it into chat, a file, or GitHub.

## 2. Deploy the Worker
```
cd worker
npm create cloudflare@latest -- --help   # (only if you have never used Cloudflare; otherwise skip)
npx wrangler login
npx wrangler deploy
```
Then store the key as a secret (it asks you to paste it, nothing is saved in a file):
```
npx wrangler secret put PRIMARY_API_KEY        # or: npx wrangler secret put SECONDARY_API_KEY
```
If you use the secondary provider, set `PROVIDER = "secondary"` in `wrangler.toml` and run `npx wrangler deploy` again.
If the provider says the model name is not found, check its console for the current model name and set `PRIMARY_MODEL` or `SECONDARY_MODEL`.

## 3. Lock it to your website (recommended)
In `wrangler.toml` set `ALLOWED_ORIGINS = "https://your-site.netlify.app"` and deploy again.
Optional daily limits (stops a stranger running up your bill): create a KV store with
`npx wrangler kv namespace create LIMITS`, paste the id into the commented `[[kv_namespaces]]` block, deploy.

## 4. Point the website at it
`wrangler deploy` prints a URL like `https://sar-cosmos-chat.yourname.workers.dev`.
Put it in `site/js/chat-config.js`:
```
window.SAR_CHAT = { endpoint: "https://sar-cosmos-chat.yourname.workers.dev" };
```
Redeploy the site. The dot in Cosmo's header turns green ("AI assistant").

## Keeping Cosmo's knowledge current
`python scripts/build_chat_knowledge.py` regenerates `worker/knowledge.js` from your lake data, then `npx wrangler deploy`.
What the page shows right now (including real pipeline results) is sent with every question, so you do NOT need to
redeploy when the data changes.

## Safety built in
Size limits, a fixed system prompt that forbids flood forecasts and invented numbers, a whitelist for every
document or action button (the model cannot invent a link), HTML-escaped output, optional origin lock and daily limits.
Tests: `node tests/js/worker.test.mjs` and `node tests/js/chatlib.test.js`.
