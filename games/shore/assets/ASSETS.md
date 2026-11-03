# shore art assets

Original art generated with the built-in image_gen tool; processed with Python Pillow: chroma-key, despill, trim, resize, WebP compression. No text or licensed references.

| File | Pixels | Bytes | Use / anchor / layout |
|---|---|---:|---|
| beach-far.webp | 1254x313 | 107064 | Opaque panorama; anchor top-left; stretch vertically only if desired; not seamless. |
| beach-near.webp | 1254x314 | 138454 | Opaque panorama; anchor top-left; stretch vertically only if desired; not seamless. |
| bird-run-1.webp | 260x161 | 9036 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| bird-run-2.webp | 257x170 | 8988 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| bird-peck.webp | 231x144 | 8380 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| bird-panic.webp | 247x215 | 13658 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| crab.webp | 221x149 | 10826 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| shell.webp | 201x151 | 9970 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| wave.webp | 279x221 | 20178 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| title.webp | 275x249 | 25624 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| bird-sheet.webp | 512x128 | 14278 | 4 frames in one horizontal row, 128x128 each. Order run-1, run-2, peck/jump, panic/slide. Pivot (64,124) per frame. Nearest-neighbor sampling. |

Hub thumbnail: `../../../img/shore.webp` (800x500).

All sprite files carry alpha. Individual poses are tightly trimmed; use the supplied fixed-cell sheet for animation alignment. Backgrounds are panoramic scenic plates, not complete skybox cubemaps. Pixel games: disable image smoothing.

Prompt recipe: exact four-column atlas; two panoramic scene rows plus two rows of isolated assets on pure magenta. Rich original vivid family-friendly art; no text, logos or known IP; only boys/men where humans appear. Theme: crisp pixel Mediterranean beach, sandpiper run/peck/panic, crab, shell, wave.
