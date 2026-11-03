# skate — original art assets

Generated with the built-in image_gen tool, then processed with Python Pillow and NumPy: flat magenta chroma key to alpha, spill removal, alpha trim, 4px transparent padding, Lanczos resize, WebP compression. No game code is included.

All artwork is original, stylized, vivid and family friendly; no women/girls, text, logos or intentional references to known IP. Upper-left lighting is baked in. Preserve aspect ratio. All sprites have alpha; backgrounds and UV maps are opaque. Each file is a single image, **not a sprite sheet**. Coordinates in anchor notes are normalized within the exported image. Sprite padding is included in listed dimensions.

| File | Size px | What it is | Anchor / pivot / layout | File size |
| --- | --- | --- | --- | --- |
| `boy-grab.webp` | 209×211 | boy grab | Center (0.5,0.5) in air; bottom-center on landing. Right-facing; independent trimmed pose. | 10.7 KB |
| `boy-kickflip.webp` | 249×228 | boy kickflip | Center (0.5,0.5) in air; bottom-center on landing. Right-facing; independent trimmed pose. | 11.6 KB |
| `boy-land.webp` | 214×180 | boy land | Center (0.5,0.5) in air; bottom-center on landing. Right-facing; independent trimmed pose. | 10.2 KB |
| `boy-ride.webp` | 366×220 | boy ride | Center (0.5,0.5) in air; bottom-center on landing. Right-facing; independent trimmed pose. | 10.4 KB |
| `boy-spin.webp` | 219×197 | boy spin | Center (0.5,0.5) in air; bottom-center on landing. Right-facing; independent trimmed pose. | 13.5 KB |
| `boy-tuck.webp` | 294×192 | boy tuck | Center (0.5,0.5) in air; bottom-center on landing. Right-facing; independent trimmed pose. | 10.1 KB |
| `mesas.webp` | 367×74 | mesas | Center (0.5,0.5). | 5.7 KB |
| `ramp-stone.webp` | 340×150 | ramp stone | Bottom-left (0,1); visual slope only, author collision separately. | 10.9 KB |
| `ramp-wood.webp` | 279×146 | ramp wood | Bottom-left (0,1); visual slope only, author collision separately. | 7.9 KB |
| `sand.webp` | 375×117 | sand | Center (0.5,0.5). | 12.7 KB |
| `sky.webp` | 1600×198 | sky | Top-left (0,0); scale with cover; not a repeating tile. | 45.9 KB |
| `storm.webp` | 1600×377 | storm | Top-left (0,0); scale with cover; not a repeating tile. | 105.3 KB |
| `title.webp` | 284×184 | title | Center (0.5,0.5). | 15.8 KB |
| `wind.webp` | 326×145 | wind | Center (0.5,0.5). | 12.5 KB |

Hub thumbnail: `../../../img/skate.webp`, 800×500, 51.2 KB. Contact sheet: `logs/assets-skate.jpg` at repository root.

Total game WebP payload: 283.2 KB (limit 1.2 MB). Backgrounds <250 KB; sprites/UV maps ≤512px and <60 KB. Titles are text-free illustrations intended for a Hebrew text overlay.

## Generation prompt

Original ochre desert mesas under indigo-and-turquoise storm, helmeted boy wearing orange jacket and long trousers, six right-facing skateboard poses, wind gust, wooden and sandstone ramps, mesa and sand layers, board emblem. Painted 3D, magenta isolated-object atlas. Landscape atlas with background above and isolated objects below, ample margins. No text, lettering, numbers, logos, known IP, women or girls. Crisp silhouettes, rich material detail, no cast shadows on chroma background.

Pose order for animation: ride, tuck, kickflip, grab, spin, land. Trimmed dimensions vary: set consistent world height deliberately rather than assuming equal frame boxes. Sky, mesas, sand and wind are available independently for parallax and effects.
