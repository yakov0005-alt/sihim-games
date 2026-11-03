# neon art assets

Original art generated with the built-in image_gen tool; processed with Python Pillow: chroma-key, despill, trim, resize, WebP compression. No text or licensed references.

| File | Pixels | Bytes | Use / anchor / layout |
|---|---|---:|---|
| backdrop.webp | 1254x313 | 105924 | Opaque panorama; anchor top-left; stretch vertically only if desired; not seamless. |
| tunnel.webp | 1254x314 | 90866 | Opaque panorama; anchor top-left; stretch vertically only if desired; not seamless. |
| grid.webp | 310x309 | 9952 | Opaque material patch; UV projection texture, edge wrapping may show a seam. |
| circuit.webp | 309x309 | 20248 | Opaque material patch; UV projection texture, edge wrapping may show a seam. |
| hovercraft.webp | 220x287 | 14530 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| decal.webp | 310x309 | 10788 | Opaque material patch; UV projection texture, edge wrapping may show a seam. |
| boost.webp | 247x173 | 9306 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| battery.webp | 159x248 | 12024 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| shield.webp | 232x257 | 15042 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |
| title.webp | 297x251 | 23516 | Trimmed RGBA; center pivot, characters use bottom-center ground contact; single pose. |

Hub thumbnail: `../../../img/neon.webp` (800x500).

All sprite files carry alpha. Individual poses are tightly trimmed; use the supplied fixed-cell sheet for animation alignment. Backgrounds are panoramic scenic plates, not complete skybox cubemaps. Pixel games: disable image smoothing.

Prompt recipe: exact four-column atlas; two panoramic scene rows plus two rows of isolated assets on pure magenta. Rich original vivid family-friendly art; no text, logos or known IP; only boys/men where humans appear. Theme: cyan/violet orbital tube racing, orange unmanned hovercraft, circuit and grid materials, energy icons.
