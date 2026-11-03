# gate — original art assets

Generated with the built-in image_gen tool, then processed with Python Pillow and NumPy: flat magenta chroma key to alpha, spill removal, alpha trim, 4px transparent padding, Lanczos resize, WebP compression. No game code is included.

All artwork is original, stylized, vivid and family friendly; no women/girls, text, logos or intentional references to known IP. Upper-left lighting is baked in. Preserve aspect ratio. All sprites have alpha; backgrounds and UV maps are opaque. Each file is a single image, **not a sprite sheet**. Coordinates in anchor notes are normalized within the exported image. Sprite padding is included in listed dimensions.

| File | Size px | What it is | Anchor / pivot / layout | File size |
| --- | --- | --- | --- | --- |
| `conductor.webp` | 172×302 | conductor | Bottom-center (0.5,1); portrait/full-body respectively. | 10.8 KB |
| `stamp-blue.webp` | 181×202 | stamp blue | Center (0.5,0.5). | 10.1 KB |
| `stamp-gold.webp` | 182×202 | stamp gold | Center (0.5,0.5). | 9.4 KB |
| `stamp-green.webp` | 184×201 | stamp green | Center (0.5,0.5). | 9.3 KB |
| `stamp-red.webp` | 184×201 | stamp red | Center (0.5,0.5). | 9.0 KB |
| `station.webp` | 1600×495 | station | Top-left (0,0); scale with cover; not a repeating tile. | 188.8 KB |
| `ticket-blue.webp` | 284×156 | ticket blue | Center (0.5,0.5). | 8.5 KB |
| `ticket-gold.webp` | 283×156 | ticket gold | Center (0.5,0.5). | 7.8 KB |
| `ticket-green.webp` | 292×161 | ticket green | Center (0.5,0.5). | 7.9 KB |
| `ticket-red.webp` | 284×156 | ticket red | Center (0.5,0.5). | 8.0 KB |
| `title.webp` | 512×360 | title | Center (0.5,0.5). | 18.0 KB |

Hub thumbnail: `../../../img/gate.webp`, 800×500, 97.7 KB. Contact sheet: `logs/assets-gate.jpg` at repository root.

Total game WebP payload: 287.4 KB (limit 1.2 MB). Backgrounds <250 KB; sprites/UV maps ≤512px and <60 KB. Titles are text-free illustrations intended for a Hebrew text overlay.

## Generation prompt

Original teal-and-brass station interior, warm glass roof, empty central tiled floor; friendly male conductor, cream tickets with red circle, blue diamond, gold star and green triangle, matching brass stamp buttons. Painted 3D, magenta isolated-object atlas. Landscape atlas with background above and isolated objects below, ample margins. No text, lettering, numbers, logos, known IP, women or girls. Crisp silhouettes, rich material detail, no cast shadows on chroma background.
