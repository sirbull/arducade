# JavaScript and Python

Open the JavaScript or Python tab to view a block game as editable text.
The first text edit makes text the project's source. Text projects use the
same IR, integer arithmetic, simulator, C++ compiler and hardware profiles
as block projects. Source code, including invalid drafts, is saved in the
project file. Changing text languages converts the current valid program;
fix errors first. The original blocks are retained as a copy. **Restore
blocks** discards text edits after confirmation and resumes block editing.
Conversion of edited text back into ordinary blocks is not implemented yet.

The editor uses Monaco with syntax highlighting, engine API completion and
parser error markers. This is a small game-oriented subset of each language,
not a general JavaScript or Python interpreter. User source is parsed into IR;
only generated simulator code is executed.

## Example

JavaScript:

```javascript
let player;
function start() {
    player = sprites.create(images.player, SpriteKind.Player);
    controller.moveSprite(player, 60, 0);
}
events.start(start);

function update() {
    if (controller.isPressed(Button.a)) {
        info.changeScoreBy(1);
    }
}
events.update(update);
```

Python:

```python
def start():
    global player
    player = sprites.create(images.player, SpriteKind.Player)
    controller.move_sprite(player, 60, 0)
events.start(start)

def update():
    if controller.is_pressed(Button.a):
        info.change_score_by(1)
events.update(update)
```

Asset constants use asset IDs with punctuation converted to identifier
characters, as shown in the generated source. IDs that cannot be expressed this way use
`asset("image", "asset-id")` (also `tile` and `tilemap`). Kinds with spaces
use `kind("Big enemy")`. `SpriteKind` includes the
project's custom kinds. Engine calls use camelCase in JavaScript and
snake_case in Python. Constant member names are the same in both languages.

## Supported syntax

* Integers with device-compatible signed 16-bit arithmetic, booleans, string
  literals, `text(...)` for joining text, and `melody("C4:100 D4:100")`.
* Named variables and functions, function parameters, calls and return values.
  Game variables have global scope; parameters have function scope.
* Arithmetic, comparisons, boolean operators, `if`/`else`, `while`, `break`
  and `continue` inside loops.
* JavaScript counted loops (`for (i = from; i <= to; i++)`) and Python
  `for i in range(from, stop)` (exclusive stop).
* Sprite loops: `for (let enemy of sprites.ofKind(SpriteKind.Enemy))` or
  `for enemy in sprites.of_kind(SpriteKind.Enemy)`.
* Conditional values: JavaScript `condition ? yes : no`; Python
  `choose(condition, yes, no)`.
* Engine functions listed by autocomplete, line comments, and
  `custom.cpp("...")`. Custom C++ is skipped by the simulator.

* Particle effects, at the top level only. `effects.define("smoke")` starts
  a recipe with default values; each following line sets one part, the same
  parts as the blocks: `effects.pixel(name, color)`,
  `effects.image(name, images.puff, color)`, `effects.lifetime(name, min, max)`,
  `effects.direction(name, degrees, spread)`, `effects.speed(name, min, max)`,
  `effects.area(name, w, h)`, `effects.acceleration(name, ax, ay)`,
  `effects.drag(name, percent)`, `effects.wobble(name, amount)` and
  `effects.blink(name, percent)`. Arguments are number literals. Use an
  effect with `particles.burst(effect("smoke"), count, x, y, rotation)`.

Classes, objects, imports, closures, arbitrary host functions, lists and
floating-point numbers are unsupported. Python uses spaces for indentation
and one statement per line. Function calls and expressions stay on one line.

## Events

Register a named function with no parameters:

| Registration | Additional arguments before handler |
|---|---|
| `events.start(handler)` | None |
| `events.update(handler)` | None |
| `events.draw(handler)` | None |
| `events.every(500, handler)` | Interval in milliseconds |
| `events.button(Button.a, true, handler)` | Button, pressed/released boolean |
| `events.overlap(SpriteKind.Player, SpriteKind.Enemy, "player", "enemy", handler)` | Kinds and names of bound sprite variables |
| `events.tile(SpriteKind.Player, tiles.wall, "player", "col", "row", handler)` | Kind, tile and names of bound sprite/column/row variables |
| `events.lifeZero(handler)` | None |

Python uses `True`/`False` and `events.life_zero`. Statements at module level
become an additional start handler. Functions can be declared before or after
registrations. Event handlers cannot also be called as ordinary functions.
