# Background artwork

These images replace the original procedural background library. They were
generated **directly at 128 × 64 pixels** with PixelLab PixFlux. They were never
downscaled from larger illustrations.

- `source/`: the original generated PNGs, kept for later refinement.
- `mono/`: the approved native **1-bit PNGs** used by the editor.
- `manifest.json`: motifs, generation prompts, job identifiers and conversion notes.

The castle, forest sanctuary and distant space city are the three previews
approved by the project owner. The castle source contains gray shades; its
approved conversion uses a luminance threshold of 128 without dithering. The
other images use a forced pure black/white palette, including any dithering
drawn by the generator. Play-area variants have rows 40–63 cleared to black;
their unmodified generated sources remain in `source/`.

Detail and composition are independent filters. The detailed play-area group
includes the mountain horizon and distant space city, plus purpose-made castle,
forest-ruin, desert-temple, crystal-cavern and orbital-harbor environments.
Each reserves all 24 bottom pixel rows for gameplay. Full-scene images retain
their classification because their lower rows contain foreground scenery.

`src/project/background-art.json` stores the final image pixels as 64 hexadecimal
rows per picture, with the leftmost pixel in the most significant bit. The
library expands those rows into the editor's existing `0`/`1` pixel format.
It does not draw scenery at runtime or load images from an external service.

To export the approved PNGs again:

```sh
uv run --with pillow python scripts/build-background-library.py
```

To verify their dimensions, 1-bit format, play areas, and exact equality with
the editor data without changing any files:

```sh
uv run --with pillow python scripts/build-background-library.py --check
```

This exporter only reads `assets/backgrounds/mono/` and writes
`src/project/background-art.json`. It never writes to `public/docs/`.
