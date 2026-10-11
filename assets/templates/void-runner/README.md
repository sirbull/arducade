# Void Runner title artwork

Generated directly at **128 × 64 pixels** with PixelLab PixFlux and a forced
black/white palette, using the same technique as the background library.
No larger illustration was downscaled.

- `source/title-screen.png`: original generated title and scene.
- `source/scene.png`: earlier scene-only experiment, kept for refinement.
- `mono/title-screen.png`: final 1-bit artwork. Rows 55–63 are cleared for
  the localized start prompt; all other generated pixels are preserved.
- `manifest.json`: prompts, job IDs, download URL and conversion notes.

The final PNG is exported into `src/templates/endlessrunner-title.json`.
The template expands its hexadecimal rows into editable image pixels.
Artwork is bundled with the game; no external image service runs during play.

```sh
uv run --with pillow python scripts/build-runner-title.py
uv run --with pillow python scripts/build-runner-title.py --check
```

The exporter only reads the final PNG and writes the template JSON.
It never writes to `public/docs/`.
