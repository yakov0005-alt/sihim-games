# roofrun art assets

Original art generated with the built-in image_gen tool; processed with Python Pillow: chroma-key, despill, trim, resize, WebP compression. No text or licensed references.

| File | Pixels | Bytes | Use / anchor / layout |
|---|---|---:|---|
| hills.webp | 1254x313 | 105608 | Opaque panorama; anchor top-left; stretch vertically only if desired; not seamless. |
| town.webp | 1254x314 | 107406 | Opaque panorama; anchor top-left; stretch vertically only if desired; not seamless. |
| runner-run-1.webp | 221x245 | 10712 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| runner-run-2.webp | 207x248 | 9918 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| runner-jump.webp | 175x188 | 8174 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| runner-slide.webp | 283x165 | 10170 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| window.webp | 252x258 | 7428 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| pigeon.webp | 219x237 | 12440 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| envelope.webp | 232x150 | 6806 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| obstacles.webp | 302x214 | 13316 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| runner-sheet.webp | 512x128 | 13956 | 4 frames in one horizontal row, 128x128 each. Order run-1, run-2, peck/jump, panic/slide. Pivot (64,124) per frame. Nearest-neighbor sampling. |
| vent.webp | 142x214 | 7530 | Bottom-center pivot; solid roof obstacle. |
| laundry.webp | 160x175 | 6296 | Top-center pivot; overhead obstacle, cropped wire ends. |
| title.webp | 400x400 | 11062 | Courier and envelope title emblem; center pivot; Hebrew title overlaid in code. |

Hub thumbnail: `../../../img/roofrun.webp` (800x500).

All sprite files carry alpha. Individual poses are tightly trimmed; use the supplied fixed-cell sheet for animation alignment. Backgrounds are panoramic scenic plates, not complete skybox cubemaps. Pixel games: disable image smoothing.

Prompt recipe: exact four-column atlas; two panoramic scene rows plus two rows of isolated assets on pure magenta. Rich original vivid family-friendly art; no text, logos or known IP; only boys/men where humans appear. Theme: crisp pixel sunset Galilee town, modest courier boy run/jump/slide, wooden train window, pigeon, envelope, vent and laundry.
