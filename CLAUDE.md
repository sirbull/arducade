# Project design rules

- Use only sharp corners or true circles throughout ArduCade. Do not introduce rounded rectangles, rounded corners, pill shapes, or oval buttons.
- Rectangular UI elements must have `border-radius: 0`. Use `border-radius: 50%` only for elements with equal width and height that are intended to be circles.
- Exception: the simulator shell (`.sim`) and the exported cartridge PNG use softly rounded corners with a diagonal cut bottom-right, as a deliberate hardware look.
- Apply this rule to dialogs, buttons, cards, simulator shells, thumbnails, exported cartridge artwork, SVGs, and canvas drawings.
- All user workflows must work with touch on iPad and other tablets as well as mouse and keyboard. Keyboard shortcuts must have an accessible on-screen alternative.
- Simulator touch controls must support simultaneous button presses and release inputs on pointer cancellation, focus loss, and dialog close.

# Documentation requirements

- Every major new feature and every new block must be documented in the project's user documentation as part of the same change.
- Clearly explain what the feature or block does, when to use it, and how to use it. For blocks, describe inputs, settings, and outputs where applicable.
- Include relevant pictures or screenshots and concrete usage examples so users can understand and try the feature or block.
- Follow the documentation artwork rules below when adding illustrations; use existing artwork or store new screenshots outside `public/docs/`.

# Documentation artwork

- The SVG files in `public/docs/` are drawn by hand in Adobe Illustrator by the project owner. They are the only source for these pictures.
- Never regenerate, overwrite, move, rename, convert or delete files in `public/docs/`, and never add a script or build step that writes there. If a picture needs to change, stop and ask the project owner first.
