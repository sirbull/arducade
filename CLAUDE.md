# Project design rules

- Use only sharp corners or true circles throughout ArduCade. Do not introduce rounded rectangles, rounded corners, pill shapes, or oval buttons.
- Rectangular UI elements must have `border-radius: 0`. Use `border-radius: 50%` only for elements with equal width and height that are intended to be circles.
- Apply this rule to dialogs, buttons, cards, simulator shells, thumbnails, exported cartridge artwork, SVGs, and canvas drawings.
- All user workflows must work with touch on iPad and other tablets as well as mouse and keyboard. Keyboard shortcuts must have an accessible on-screen alternative.
- Simulator touch controls must support simultaneous button presses and release inputs on pointer cancellation, focus loss, and dialog close.
