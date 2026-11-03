# falafel — original art assets

Generated with the built-in image_gen tool, then processed with Python Pillow and NumPy: flat magenta chroma key to alpha, spill removal, alpha trim, 4px transparent padding, Lanczos resize, WebP compression. No game code is included.

All artwork is original, stylized, vivid and family friendly; no women/girls, text, logos or intentional references to known IP. Upper-left lighting is baked in. Preserve aspect ratio. All sprites have alpha; backgrounds and UV maps are opaque. Each file is a single image, **not a sprite sheet**. Coordinates in anchor notes are normalized within the exported image. Sprite padding is included in listed dimensions.

| File | Size px | What it is | Anchor / pivot / layout | File size |
| --- | --- | --- | --- | --- |
| `chickpeas.webp` | 267×152 | chickpeas | Center (0.5,0.5). | 9.4 KB |
| `coin.webp` | 179×161 | coin | Center (0.5,0.5). | 7.3 KB |
| `cucumber.webp` | 217×158 | cucumber | Center (0.5,0.5). | 11.3 KB |
| `customer-boy.webp` | 206×252 | customer boy | Bottom-center (0.5,1); portrait/full-body respectively. | 12.4 KB |
| `customer-dog.webp` | 230×242 | customer dog | Bottom-center (0.5,1); portrait/full-body respectively. | 10.9 KB |
| `customer-man.webp` | 273×254 | customer man | Bottom-center (0.5,1); portrait/full-body respectively. | 12.8 KB |
| `falafel.webp` | 180×168 | falafel | Center (0.5,0.5). | 9.2 KB |
| `pita-filled.webp` | 259×181 | pita filled | Center (0.5,0.5). | 13.0 KB |
| `pita.webp` | 253×179 | pita | Center (0.5,0.5). | 8.2 KB |
| `stall.webp` | 1600×441 | stall | Top-left (0,0); scale with cover; not a repeating tile. | 170.8 KB |
| `tahini.webp` | 219×153 | tahini | Center (0.5,0.5). | 9.6 KB |
| `title.webp` | 306×238 | title | Center (0.5,0.5). | 20.4 KB |
| `tomato.webp` | 217×166 | tomato | Center (0.5,0.5). | 11.4 KB |

Hub thumbnail: `../../../img/falafel.webp`, 800×500, 85.5 KB. Contact sheet: `logs/assets-falafel.jpg` at repository root.

Total game WebP payload: 306.5 KB (limit 1.2 MB). Backgrounds <250 KB; sprites/UV maps ≤512px and <60 KB. Titles are text-free illustrations intended for a Hebrew text overlay.

## Generation prompt

Original turquoise-and-terracotta falafel stall, empty counter, copper fryer, pita, golden falafel, chickpeas, tomato, cucumber, tahini, star coin, smiling male, boy and dog customer busts, pita emblem. Painted 3D, magenta isolated-object atlas. Landscape atlas with background above and isolated objects below, ample margins. No text, lettering, numbers, logos, known IP, women or girls. Crisp silhouettes, rich material detail, no cast shadows on chroma background.
