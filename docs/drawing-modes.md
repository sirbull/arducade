# Drawing modes

The **Graphics** and **Particles** categories contain two blocks that wrap other blocks:

- **with drawing mode …** selects normal drawing, invert underlay, invert background and map, or invert background layer 1/2.
- **invert against sprite …** selects a particular sprite as the reference.

Drawing blocks inside use that mode immediately. Sprites, projectiles and particles created inside remember it for their lifetime. This includes particles emitted from an effect recipe. Existing sprites use the **set sprite drawing mode** or **set sprite to invert against sprite** blocks in **Sprites**. Choose **normal** to turn it off. Changing an image or animation keeps the mode.

For rain over a background with light and dark areas, place the particle emission inside **with drawing mode: invert background and map**. Each opaque rain pixel becomes black over white and white over black, even as it moves. This reference ignores sprites and other rain particles. Use **invert underlay** when the rain should also react to objects behind it.

## Reference choices

| Choice | Reference pixels |
| --- | --- |
| Normal | The image or drawing's usual colors. |
| Invert underlay | Everything already drawn at that screen position. Sprite z order applies; particles are drawn after sprites. Overlapping inverted objects can cancel each other. |
| Invert background and map | The base background, both background layers, and the current tile map, composited over black. Includes scrolling, camera, parallax, changed tiles and shake. Ignores sprites and custom drawing blocks. |
| Invert background layer 1/2 | Only that layer's original pixels, with its scrolling and parallax. Transparent or missing pixels leave the normal drawing color. |
| Invert against sprite | That sprite's original image and current animation frame, at its current world position. Transparent, missing or invisible reference pixels leave the normal drawing color. Destroying the reference clears it from existing objects. |

All opaque pixels of the object become the opposite of the reference, including opaque black pixels. This produces a contrasting silhouette; it does not preserve the image's internal black/white pattern. Transparent image pixels never draw. Sprite outlines retain their separate outline settings.

A reference does not change drawing order: something drawn later can still cover the object. Referring to a sprite reads its original image, regardless of that sprite's own drawing mode, z order or outline. References do not recursively evaluate other references.

Nested blocks restore the enclosing mode. Leaving through `return`, `break` or `continue` also restores it. Wrapping code that merely moves an existing sprite does not change that sprite's saved mode; use its setter block.

## Cost

Underlay inversion uses XOR on the existing screen buffer, including byte operations for images and filled rectangles. It needs no extra framebuffer. When drawing modes are used, the AVR engine reserves one extra byte per sprite slot, one per particle slot if particles are enabled, and one byte for the current mode. With 12 sprites and 12 particles, that is 25 bytes plus the small scope state on the stack. Games that do not use the feature reserve none of this extra state.

Selected references sample the source images per drawn pixel. They use no additional framebuffer, but cost more CPU and flash than underlay inversion. The advanced sampling code is omitted when the program uses only normal/underlay modes. Small selected references and XOR scenes compile for the paged ATtiny85 too, but its 8 KB flash and 512 byte RAM limits make combined features more restrictive. Compile the actual game to see its size.

## Text languages

Mode numbers are `0` normal, `1` underlay, `2` background and map, `3` layer 1, and `4` layer 2. Use `screen.spriteReference(sprite)` in JavaScript or `screen.sprite_reference(sprite)` in Python for a specific sprite; the returned value is internal and should not be constructed manually.

## Blocks and illustrated examples

Open **Help → Graphics** for both wrapping blocks and **Help → Sprites**
for both setter blocks. Each has a picture of the block, an illustrated
example stack and a description. The block's context menu opens the same
help entry. The wrapping blocks are also available in **Particles**.

| Block | Inputs and settings | Result |
| --- | --- | --- |
| With drawing mode | Mode dropdown; drawing or creation blocks inside. | Runs the enclosed code with that mode, then restores the previous mode. |
| Invert against sprite | Reference sprite; drawing or creation blocks inside. | Uses the reference sprite's original pixels. Created objects retain this reference. |
| Set sprite drawing mode | Existing sprite; mode dropdown. | Changes that sprite's saved mode. No returned value. |
| Set sprite to invert against sprite | Existing sprite; reference sprite. | Changes the first sprite's saved reference. No returned value. |

Try the [rain demo](../output/invertert-regn.abproject) with **Open file**.
Its background is white in the top half and black in the bottom half.
Move the character using the simulator's arrow buttons or the keyboard.
The character and moving 1×1 bullet invert the underlay; falling rain
inverts the background and map so it does not react to other particles.

![Rain, character and a one-pixel bullet over a white-and-black background](images/drawing-modes-rain.png)

Actual simulator frame from the demo, enlarged six times without smoothing.

The following examples are independent programs. Create the assets mentioned
in each example in the image/background editor first. Asset IDs must match
the identifiers in the code; use the names shown by text autocomplete.

### Rain against the background and map

Create a 128×64 background called `light_dark`, white in its top half and
black in its bottom half. The pixel recipe emits rain across the full width (`1` means white).
Each drop remembers mode 2 after the scope ends. Optional tile maps and
background layers are included automatically; sprites and custom drawings
are ignored. For image particles, use `effects.image` instead of
`effects.pixel`; the same inversion applies to every opaque image pixel.

JavaScript:

```javascript
effects.define("rain");
effects.pixel("rain", 1);
effects.lifetime("rain", 1000, 1000);
effects.direction("rain", 180, 0);
effects.speed("rain", 60, 60);
effects.area("rain", 128, 0);
function start() {
    scene.setBackgroundImage(images.light_dark);
}
events.start(start);
function rain() {
    with_draw_mode(2) {
        particles.burst(effect("rain"), 1, 64, 0, 0);
    }
}
events.every(150, rain);
```

Python:

```python
effects.define("rain")
effects.pixel("rain", 1)
effects.lifetime("rain", 1000, 1000)
effects.direction("rain", 180, 0)
effects.speed("rain", 60, 60)
effects.area("rain", 128, 0)
def start():
    scene.set_background_image(images.light_dark)
events.start(start)
def rain():
    with_draw_mode(2):
        particles.burst(effect("rain"), 1, 64, 0, 0)
events.every(150, rain)
```

### A moving character and a 1×1 bullet

Create `player` as a small opaque silhouette with transparent surrounding
pixels and `dot` as one white pixel. Reuse the `light_dark` background.
The character and bullet retain mode 1 while moving. The bullet leaves the
screen after crossing it. Change the mode to 2 if they should react only to
the background and map, rather than previously drawn objects too.

JavaScript:

```javascript
let player;
let bullet;
function start() {
    scene.setBackgroundImage(images.light_dark);
    with_draw_mode(1) {
        player = sprites.create(images.player, SpriteKind.Player);
        bullet = sprites.createProjectileFromPosition(images.dot, 0, 32, 45, 0);
    }
    sprite.setPosition(player, 64, 32);
    controller.moveSprite(player, 45, 45);
}
events.start(start);
```

Python:

```python
def start():
    global player, bullet
    scene.set_background_image(images.light_dark)
    with_draw_mode(1):
        player = sprites.create(images.player, SpriteKind.Player)
        bullet = sprites.create_projectile_from_position(images.dot, 0, 32, 45, 0)
    sprite.set_position(player, 64, 32)
    controller.move_sprite(player, 45, 45)
events.start(start)
```

### Choose background layer 1 or 2 for an existing sprite

Create `layer` with white, black and transparent areas. This example adds it
to layer 1 with 25% parallax, then sets an existing sprite to mode 3. The
sprite follows layer 1's original pixels even where layer 2 or a tile map
covers it. Transparent layer pixels use the sprite's usual color.
For layer 2, change both the layer argument to `2` and the mode to `4`.
To include the base background and both layers and map together, use mode `2`.

JavaScript:

```javascript
let player;
function start() {
    scene.setBackgroundLayer(1, images.layer, 25);
    player = sprites.create(images.player, SpriteKind.Player);
    sprite.setPosition(player, 64, 32);
    sprite.setDrawMode(player, 3);
    controller.moveSprite(player, 45, 45);
}
events.start(start);
```

Python:

```python
def start():
    global player
    scene.set_background_layer(1, images.layer, 25)
    player = sprites.create(images.player, SpriteKind.Player)
    sprite.set_position(player, 64, 32)
    sprite.set_draw_mode(player, 3)
    controller.move_sprite(player, 45, 45)
events.start(start)
```

### Choose a particular sprite: wrapper and setter

Create `platform` as a wide white/black image and reuse `dot`. Place the
platform at (64, 32). Both bullets move across it: one is created inside the
reference scope, and the other has its reference set afterwards. Outside
the platform's opaque pixels, bullets use their usual white color.
This reference is the platform's current original image, including animation,
not everything displayed above or below it.

JavaScript:

```javascript
let platform;
let first;
let second;
function start() {
    platform = sprites.create(images.platform, SpriteKind.Player);
    sprite.setPosition(platform, 64, 32);
    with_draw_mode(screen.spriteReference(platform)) {
        first = sprites.createProjectileFromPosition(images.dot, 0, 32, 45, 0);
    }
    second = sprites.createProjectileFromPosition(images.dot, 0, 33, 35, 0);
    sprite.setDrawMode(second, screen.spriteReference(platform));
}
events.start(start);
```

Python:

```python
def start():
    global platform, first, second
    platform = sprites.create(images.platform, SpriteKind.Player)
    sprite.set_position(platform, 64, 32)
    with_draw_mode(screen.sprite_reference(platform)):
        first = sprites.create_projectile_from_position(images.dot, 0, 32, 45, 0)
    second = sprites.create_projectile_from_position(images.dot, 0, 33, 35, 0)
    sprite.set_draw_mode(second, screen.sprite_reference(platform))
events.start(start)
```

### Nested scopes and turning inversion off

The outer scope inverts the underlay. The inner normal scope draws a white
pixel without inversion, then the next pixel uses the outer mode again.
`events.draw` runs this every frame. In the block editor, put a normal-mode
wrapper inside an invert-underlay wrapper to get the same result.

JavaScript:

```javascript
function draw() {
    with_draw_mode(1) {
        screen.setPixel(20, 20, Color.white);
        with_draw_mode(0) {
            screen.setPixel(21, 20, Color.white);
        }
        screen.setPixel(22, 20, Color.white);
    }
}
events.draw(draw);
```

Python:

```python
def draw():
    with_draw_mode(1):
        screen.set_pixel(20, 20, Color.white)
        with_draw_mode(0):
            screen.set_pixel(21, 20, Color.white)
        screen.set_pixel(22, 20, Color.white)
events.draw(draw)
```

For an existing character from an earlier example, call
`sprite.setDrawMode(player, 0)` / `sprite.set_draw_mode(player, 0)` to restore
its own image colors. This also clears a sprite reference. Wrapping future
particle emission in mode 0 creates ordinary particles; it does not change
particles already emitted. Exiting a scope does not undo the mode captured
by a sprite, projectile or particle created inside it.
