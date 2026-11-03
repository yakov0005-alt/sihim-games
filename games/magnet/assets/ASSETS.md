# magnet — original art assets

Generated with the built-in image_gen tool, then processed with Python Pillow and NumPy: flat magenta chroma key to alpha, spill removal, alpha trim, 4px transparent padding, Lanczos resize, WebP compression. No game code is included.

All artwork is original, stylized, vivid and family friendly; no women/girls, text, logos or intentional references to known IP. Upper-left lighting is baked in. Preserve aspect ratio. All sprites have alpha; backgrounds and UV maps are opaque. Each file is a single image, **not a sprite sheet**. Coordinates in anchor notes are normalized within the exported image. Sprite padding is included in listed dimensions.

| File | Size px | What it is | Anchor / pivot / layout | File size |
| --- | --- | --- | --- | --- |
| `arena.webp` | 1600×472 | arena | Top-left (0,0); scale with cover; not a repeating tile. | 110.5 KB |
| `bolt.webp` | 95×94 | bolt | Center (0.5,0.5). | 2.8 KB |
| `bolts-sparks.webp` | 258×255 | bolts sparks | Center (0.5,0.5). | 15.9 KB |
| `boss.webp` | 424×289 | boss | Center (0.5,0.5). | 32.3 KB |
| `drone-fast.webp` | 217×174 | drone fast | Center (0.5,0.5). | 8.7 KB |
| `drone-heavy.webp` | 289×178 | drone heavy | Center (0.5,0.5). | 14.1 KB |
| `drone-scout.webp` | 245×146 | drone scout | Center (0.5,0.5). | 9.5 KB |
| `drone-shield.webp` | 249×254 | drone shield | Center (0.5,0.5). | 16.0 KB |
| `robot-magnet.webp` | 204×217 | robot magnet | Center (0.5,0.5). | 10.4 KB |
| `robot.webp` | 201×222 | robot | Center (0.5,0.5). | 11.0 KB |
| `spark.webp` | 41×46 | spark | Center (0.5,0.5). | 0.9 KB |
| `title.webp` | 388×259 | title | Center (0.5,0.5). | 17.6 KB |

Hub thumbnail: `../../../img/magnet.webp`, 800×500, 50.7 KB. Contact sheet: `logs/assets-magnet.jpg` at repository root.

Total game WebP payload: 249.7 KB (limit 1.2 MB). Backgrounds <250 KB; sprites/UV maps ≤512px and <60 KB. Titles are text-free illustrations intended for a Hebrew text overlay.

## Generation prompt

Original midnight steel hexagonal arena, cyan circuits and orange perimeter; friendly magnetic robot, scout, fast, heavy and shield drones, crab mechanical boss, bolts, sparks, magnet emblem. Painted 3D, magenta isolated-object atlas. Landscape atlas with background above and isolated objects below, ample margins. No text, lettering, numbers, logos, known IP, women or girls. Crisp silhouettes, rich material detail, no cast shadows on chroma background.
