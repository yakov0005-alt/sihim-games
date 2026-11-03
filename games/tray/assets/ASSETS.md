# tray — original art assets

Generated with the built-in image_gen tool, then processed with Python Pillow and NumPy: flat magenta chroma key to alpha, spill removal, alpha trim, 4px transparent padding, Lanczos resize, WebP compression. No game code is included.

All artwork is original, stylized, vivid and family friendly; no women/girls, text, logos or intentional references to known IP. Upper-left lighting is baked in. Preserve aspect ratio. All sprites have alpha; backgrounds and UV maps are opaque. Each file is a single image, **not a sprite sheet**. Coordinates in anchor notes are normalized within the exported image. Sprite padding is included in listed dimensions.

| File | Size px | What it is | Anchor / pivot / layout | File size |
| --- | --- | --- | --- | --- |
| `grape-texture.webp` | 256×256 | grape texture | UV texture; mirrored edges; repeat wrapping supported. | 10.7 KB |
| `grape.webp` | 272×270 | grape | Center (0.5,0.5). | 24.6 KB |
| `lemon-texture.webp` | 256×256 | lemon texture | UV texture; mirrored edges; repeat wrapping supported. | 7.1 KB |
| `lemon.webp` | 269×249 | lemon | Center (0.5,0.5). | 10.6 KB |
| `olive-texture.webp` | 256×256 | olive texture | UV texture; mirrored edges; repeat wrapping supported. | 2.0 KB |
| `olive.webp` | 215×182 | olive | Center (0.5,0.5). | 6.1 KB |
| `orange-texture.webp` | 256×256 | orange texture | UV texture; mirrored edges; repeat wrapping supported. | 11.7 KB |
| `orange.webp` | 266×259 | orange | Center (0.5,0.5). | 13.1 KB |
| `pomegranate-texture.webp` | 256×256 | pomegranate texture | UV texture; mirrored edges; repeat wrapping supported. | 12.9 KB |
| `pomegranate.webp` | 261×270 | pomegranate | Center (0.5,0.5). | 12.7 KB |
| `table.webp` | 1600×458 | table | Top-left (0,0); scale with cover; not a repeating tile. | 157.3 KB |
| `title.webp` | 286×265 | title | Center (0.5,0.5). | 22.6 KB |
| `tray.webp` | 353×256 | tray | Center (0.5,0.5). | 15.0 KB |
| `wood.webp` | 512×512 | wood | UV texture; clamp or mirror wrapping (not seamless). | 37.7 KB |

Hub thumbnail: `../../../img/tray.webp`, 800×500, 88.0 KB. Contact sheet: `logs/assets-tray.jpg` at repository root.

Total game WebP payload: 343.9 KB (limit 1.2 MB). Backgrounds <250 KB; sprites/UV maps ≤512px and <60 KB. Titles are text-free illustrations intended for a Hebrew text overlay.

## Generation prompt

Original jade-and-apricot sunlit rustic kitchen tabletop, oak grain, pomegranate, orange, lemon, grapes, olive, top-down shallow wooden tray and fruit tray emblem. Painted 3D, magenta isolated-object atlas. Landscape atlas with background above and isolated objects below, ample margins. No text, lettering, numbers, logos, known IP, women or girls. Crisp silhouettes, rich material detail, no cast shadows on chroma background.

Fruit `*-texture.webp` files are mirrored interior surface patches for 3D materials. Their matching named alpha sprites are optional 2D previews. Grape texture shows purple grape skin; use clustered geometry if desired.
