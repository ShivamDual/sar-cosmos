# SAR Cosmos design guide

The look of SAR Cosmos is a mission patch that became a website: deep space above, the Himalaya below, and one cyan
signal that runs through everything. This guide keeps every part of the project consistent, from the website to the
README and the video.

## The idea

We are watching ice from orbit. Every surface should feel like instruments in a dark control room: precise,
calm, a little luminous, and honest about what they show.

## Palette

| Role | Hex | Used for |
|---|---|---|
| Deep space | `#060d1c` | page background, the sky |
| Night navy | `#0b1b3a` / `#132a52` | panels, the sky gradient |
| Ice cream | `#f4f1ea` | primary text, the snow |
| Radar cyan | `#4fe3d0` | water, the active signal, primary actions |
| Mission amber | `#ffb94d` | radar scenes, NISAR markers, monsoon bands, warnings |
| Muted slate | `#8fa3c4` / `#6f84a3` | secondary text, grid lines |
| Risk scale | `#4ade80` `#fbbf24` `#fb923c` `#ef4444` | Low, Moderate, High, Critical only |

Risk colours are reserved for risk. Cyan means water or signal. Amber means radar or the monsoon.

## Type

- **Display:** Instrument Serif. Headlines and lake names. Set large, tight, and never bold.
- **Interface:** Inter Tight. Body, buttons, labels.
- **Data:** JetBrains Mono. Numbers, dates, coordinates, captions. Small and quiet.

## Motion

Motion explains something. It never decorates for its own sake.

- Scroll drives the camera through the story: the hero, the stakes, the monsoon, the radar scan, the lakes, the method.
- The radar scan is the signature moment: a bright seam sweeps the range and the sensor view changes.
- The satellite orbits, and the orbit is drawn in the banner too.
- Lake markers pulse with a radar ring, so a selected lake is always easy to find.
- Everything respects `prefers-reduced-motion`. Animations stop, and the content stays.

## Cosmic motifs, and where they belong

| Motif | Asset | Use |
|---|---|---|
| Galaxy and nebula | `docs/assets/banner.svg` | the README header, the video title card |
| Atom | `docs/assets/atom.svg` | loaders and small section markers |
| Solar system | `docs/assets/solar-system.svg` | About and credits |
| Earth limb and ridge | inside the banner | any wide hero image |
| Divider | `docs/assets/divider.svg` | between README sections |

Use motifs sparingly. One per screen, never two competing for attention.

## Logos

- **The SAR Cosmos patch** (`site/assets/logo-256.webp`, `logo-640.webp`) is our mark. Use it at 40 px or larger, with
  its own dark background intact.
- **NASA and ISRO logos are not reproduced** in this project. The NASA Space Apps and NISAR names appear only as text,
  in line with the challenge's image rules.

## Accessibility

- Text contrast is at least 4.5:1 on every panel.
- Every interactive control has a visible focus ring and a label.
- Charts carry a text description and a legend. Colour is never the only signal.
- Motion can be turned off by the operating system.

## Voice

Plain, warm, confident, and honest. Say what the project measures, what it does not, and why both matter. No
superlatives without a number behind them.
