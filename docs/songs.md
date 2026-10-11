# Songs (ATMlib)

For creating music in the editor, follow the illustrated [music guide](music.nb.md).
It covers beep melodies, four-track arrangements, recording and using audio in games.

ArduCade has sixteen ready made songs with four voices: melody, harmony, bass and
drums. The device plays them with
[ATMlib](https://github.com/JKirchartz/ATMlib) (Arduboy Tracker Music) by
TEAM a.r.g., Davey Taylor and Joeri Gantois. The simulator plays them with a
TypeScript port of the same player.

| Song        | Name in code | Length | Meant to  | Mood                       |
| ----------- | ------------ | ------ | --------- | -------------------------- |
| Title theme | `title`      | 16 s   | repeat    | happy, C major             |
| Adventure   | `adventure`  | 14 s   | repeat    | driving, A minor           |
| Boss fight  | `boss`       | 6 s    | repeat    | tense, chromatic bass      |
| Menu        | `menu`       | 17 s   | repeat    | friendly, F major          |
| Explore     | `explore`    | 21 s   | repeat    | calm, D dorian             |
| Cave        | `cave`       | 24 s   | repeat    | dark and sparse, E minor   |
| Underwater  | `underwater` | 19 s   | repeat    | floating, no drums         |
| Chase       | `chase`      | 11 s   | repeat    | fast, A minor              |
| Shop        | `shop`       | 15 s   | repeat    | bouncy, G major            |
| Puzzle      | `puzzle`     | 19 s   | repeat    | thoughtful, staccato       |
| Castle      | `castle`     | 19 s   | repeat    | proud march, D minor       |
| Level up    | `levelUp`    | 3 s    | play once | fanfare                    |
| Game over   | `gameOver`   | 8 s    | play once | sad, falling               |
| Victory     | `victory`    | 6 s    | play once | fanfare                    |
| Level start | `start`      | 3 s    | play once | short and bright           |
| Secret      | `secret`     | 3 s    | play once | rising arpeggio            |

The songs that repeat loop without a gap. The short tunes end with a rest of
one to three beats, so they can also be repeated, or played again right away
without running into themselves.

## Blocks and text code

All sound blocks are together in **Music**. Pink blocks with a single note icon
play beep melodies, tones and beep effects. Purple blocks with the double note
icon play polyphonic songs and effects. Your saved melodies and songs appear
first in their respective dropdowns, followed by built-in choices. The melody
choices play only the melody voice; song choices play all four voices on
supported devices (see hardware support below).

* **play melody [melody] [once / repeat]** plays a saved beep melody or the
  melody voice of a built-in tune.
* **play beep effect [effect]** plays a short single-voice effect.
* **play polyphonic effect [effect]** plays jump, coin, power-up, laser,
  explosion, shield, win or lose with several voices. These short effects
  pause the currently playing song and play once. The song then continues
  from its saved position, with its original pitch and loop setting. A second
  effect replaces the first effect without losing the saved song. Playing a
  new song or stopping songs also cancels the saved background.
* **play song [song] [repeat / once]** starts a song in the background. A new
  song replaces the one that plays.
* **set song volume [0–100]** scales all four voices. It resets to 100 when the
  game restarts and has no effect on devices without four voices. Games without
  this block compile without the volume feature (`AB_HAS_SONG_VOLUME`).
* **stop song** stops the song. Sound effects and melodies go on.
* **stop sound** stops everything, songs included.

Songs also stop when the game is over and when it restarts. Waiting blocks
(pause, wait for A, splash) do not stop them.

In JavaScript and Python the songs are `Song` constants:

```javascript
music.playSong(Song.title, true);   // true repeats, false plays once
music.stopSong();
```

```python
music.play_song(Song.title, True)
music.stop_song()
```

## How a song gets to the speaker

```
src/engine/songs.ts   SONGS: note text for each voice
        │ songBytes()
        ▼
ATMlib song data (bytes)
        ├── src/gen/cpp.ts → static const uint8_t song_title[] PROGMEM = {...}
        │                     #define AB_HAS_SONGS 1
        │                     core/ardublocks/ab_atm.h plays it on the device
        └── src/gen/js.ts  → const song_title = [...]
                              src/sim/atm.ts renders it, src/sim/runner.ts
                              plays the samples with Web Audio
```

Only the songs a game uses are added to it. The player itself (`ab_atm.h`) is
only compiled in when the game plays a song.

## Hardware

| Console                                                 | What you hear                                              |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| Arduboy, or any ATmega32u4 with the speaker on pin 5 or 13 | All four voices, mixed by Timer4 at 31250 samples a second |
| Every other console (Nano, ATmega644P, ESPboy, ATtiny85) | One voice on the normal tone pin, no drums                 |

**Four voices.** Timer4 runs fast PWM on OC4A (pin 13) and its inverse (pin 5),
so the Arduboy speaker gets twice the swing. Every second Timer4 overflow the
interrupt adds up the four voices (25 % pulse, square, triangle and noise)
into OCR4A, and every `atm_cia` samples (1302 at 120 beats a minute) it calls
the playroutine, which reads the next song commands. When a song stops, `atm_stop()` turns Timer4
off and gives the pins back.

**One voice.** Without Timer4 the game loop calls the playroutine at the song
tempo and plays the first voice that sounds, in the order melody, harmony,
bass, with the normal `tone()`. Notes start on frame steps (33 ms).

**Sound effects during a song.** On the four voice player, Timer4 owns the
speaker pins, so the Timer1 tone cannot reach the speaker. `atm_tone()` then
mutes the harmony voice of the song and plays the effect on it instead. When
the effect ends, the harmony voice comes back. On one voice consoles the
effect simply takes the pin while it plays. The simulator plays effects on top
of all four voices. On one-voice profiles the simulator uses the same frame-driven
voice selection and gives effects priority. Disabled sound profiles remain silent.

**Memory.** Measured with the WebAssembly compiler (`tests/songs.test.ts`
prints it), the player and the title song (409 bytes) add:

| Console                 | Flash   | RAM       |
| ----------------------- | ------- | --------- |
| Arduboy (ATmega32u4)    | 3164 B  | 250 B     |
| Nano (ATmega328P)       | 2906 B  | 251 B     |
| ATtiny85                | 3556 B  | 251 B     |

The songs are 85 (game over) to 709 (chase) bytes each. On an ATtiny85 the
250 bytes are half of its RAM.

## Adding a song

1. Add an entry to `SONGS` in `src/engine/songs.ts`:

   ```ts
   chase: {
     tempo: 160,
     voices: [
       'E5:1/2 G A G E D C D',  // pulse: melody
       'C4:2 G3',               // square: harmony
       'C3:1 C G3 G',           // triangle: bass
       'C:1 C:1/2 C C:1 C',     // noise: drums
     ],
   },
   ```

   The voices use the note text of the melody block (`parseMelody`). For the
   drums any note is a hit and `R` is a rest. Leave a voice empty (`''`) to
   keep it silent. Write every voice with the same number of beats, so they end
   together, and end a short tune with a rest (`R:2`). Use a tempo in steps of
   10: the player sets `tempo / 10` ticks per step (the test checks both).
2. Add `AB_SONG_<NAME IN CAPITALS>` to the `blocks` section of every file in
   `public/locales/`. The block dropdown and the `Song` constants pick the song
   up from `SONGS`.
3. Mention the song in `docs.more.ab_play_song` in every language if it is
   meant to repeat or to play once.
4. Run `npm test` and `npm run check-locales`.

Notes go from B2 to about C#8. Lower notes are raised to B2.

## The song data

`songBytes()` writes one ATMlib track per voice:

```
4                       track count
lo hi  × 4              where each track starts, after the 4 channel bytes
0 1 2 3                 channel n starts with track n
track 0: 0x9D tempo  0x40 volume  notes…  0x40 0  0x9F
track 1: 0x40 volume  notes…  0x40 0  0x9F
track 2: 0x40 volume  notes…  0x40 0  0x9F
track 3: 0x40 volume  0x41 -4  hits…  0x40 0  0x9F
```

* A note is the note number (1 to 63), a delay of `length × 3 − 1` ticks, a
  note off (0) and a delay of 1 tick, so repeated notes do not run together.
  A rest is a note off and a delay. Delays are `159 + ticks` (1 to 64 ticks).
* `0x9D` sets the tick rate to `tempo / 10`. The player then runs about
  `tempo / 5` ticks a second, which is 3 ticks for a quarter beat.
* The drum voice fades by 4 every tick (`0x41`), so a hit is a short burst of
  noise. Its notes only restart the volume.
* `0x9F` stops the channel. When all four have stopped, the song ends, or
  starts again when it repeats.
* The volumes (36, 20, 40 and 32, the noise at half) add up to less than 128,
  so the 8 bit mix never wraps around.

ATMlib note `n` sounds at `noteTable[n] × 31250 / 65536` Hz, about half the
table value: note 30 is 1397 in the table and sounds at 666 Hz, an E5.
`atmNote()` picks the note closest to the written pitch.

The player understands the whole ATMlib command set (effects such as
arpeggio, vibrato, glissando, slides, transposition and track calls), so data
made with other ATMlib tools also plays. See the
[ATMlib readme](https://github.com/JKirchartz/ATMlib#readme) for the format.

## Changes from ATMlib

`core/ardublocks/ab_atm.h` is ATMlib's playroutine and mixer with these changes:

* Names start with `atm_`, so they do not clash with game code.
* `read_vle()` moves its pointer. In ATMlib it did not, so long delays and
  embedded data read the wrong bytes.
* Playing a song makes all four channels active again. ATMlib kept the
  channels the last song had stopped, so a second song did not play.
* The first tick comes at once instead of after 65536 samples (2 seconds).
* Songs can repeat.
* Stopping turns off the PWM output, so the speaker pins are normal pins again.
* `atm_tone()` lets a sound effect take over the harmony voice.
* `char` fields that hold signed values are `int8_t`, since `char` has no sign
  on some chips, such as ARM.
* The one voice player for chips without Timer4 is new.

The mixer in assembly is the same as in ATMlib, apart from the names.

## Tests

`tests/songs.test.ts` checks that:

* every song is valid note text, its voices have the same length, it lasts as
  long as its tempo says and its mix never wraps,
* the generators write the song tables and calls, and the text languages read
  and write `Song` constants,
* the songs compile for the Arduboy, a Nano and the ATtiny85 console,
* the playroutine on an emulated Arduboy (avr8js, with a Timer4 overflow added)
  gives the same voice frequencies and volumes as `src/sim/atm.ts`, tick for
  tick, for 60 ticks of the adventure song,
* a Nano plays the first note of the title song at 666 Hz on its tone pin.

The samples from the emulated Arduboy are not compared one by one: the
interrupt runs the playroutine with interrupts on, so for a few samples after
each tick the device mixes voices that are only partly updated. That moves the
oscillator phases a little, which is how the hardware sounds.

## Known limits

* Pitch applies to both beep and polyphonic sounds at start time. It does not
  retune an already playing sound. Tempo remains unchanged.
* On one voice consoles a melody and a song share the tone pin and interrupt
  each other. Play one of them at a time.
* In the simulator a sound effect does not mute the harmony voice of the song.

## License

ATMlib is under the BSD 3-Clause License:

```
Copyright (c) 2016, TEAM a.r.g.
Copyright (c) 2016, Davey Taylor
Copyright (c) 2016, Joeri Gantois
All rights reserved.
```

The full license text is at the top of `core/ardublocks/ab_atm.h`. That file is
part of every exported Arduino sketch, so the notice travels with it. The
songs in `src/engine/songs.ts` are made for ArduCade.

## Music tab and keyboard recording

The Music tab saves named **beep melodies**, with note text and a tempo. Add,
rename, duplicate or delete a melody in the list, edit its notes and audition it
through the simulator's square-wave sound output. The named melody block shares
one flash table across all uses; unused melodies add no firmware data. Older
projects open with an empty melody list.

The keyboard icon in the Music tab and the original melody block opens a recorder
with two octaves. Use touch, mouse, or A W S E D F T G Y H U J K (C through C).
Z/X and the on-screen buttons move the octave. The latest held key wins, and
releasing it resumes the previous held key. Pointer cancellation, focus loss,
a hidden page and dialog close release the keys and silence audition.

The recorder uses the selected tempo and optionally counts in one four-beat bar
with a metronome. It rounds held notes to quarter beats (1–64 units) and records
gaps of at least half a quarter beat as rests. Stop, play, clear and edit the
result before choosing Use. Press a note button to audition that note and select
its text. The preview uses the selected tempo and the octave and duration
inherited from preceding notes, including rests. A new press replaces the
preview, and Stop silences it. Cancel leaves the original untouched. `formatMelody`
writes sharps and only changes octave or duration when necessary.

The recorder captures one voice at a time. In Polyphonic mode, recordings replace
the selected track. Beep volume is fixed; it can only be turned on or off.

The tests compare the Nano fallback frequency at 60 frame times, and compare the
four-voice playroutine at 0, 50 and 100 percent volume against AVR emulation.

## Memory verification for this change

Measured before and after with the WebAssembly compiler. Games that do not use
song volume keep the same flash and RAM sizes:

| Game / console | Flash before → after | RAM before → after |
| --- | ---: | ---: |
| Platformer / Arduboy | 16150 → 16150 B | 1823 → 1823 B |
| Platformer / Nano (SSD1306 I2C) | 12740 → 12740 B | 1570 → 1570 B |
| Shooter / ATtiny85 | 8118 → 8118 B | 366 → 366 B |

Adding the song volume block to the title-song test changes Arduboy flash from
11198 to 11264 B and RAM from 1953 to 1955 B. The same volume call produces
byte-identical firmware on the Nano and ATtiny85 fallback players.

## Music studio

The Music tab has two modes. **Beep** edits one square-wave melody. **Polyphonic**
edits four hardware voices: pulse melody, square harmony, triangle bass and
noise drums. All blocks stay together in the Music category.

A compact overview above the piano roll shows all four tracks stacked on a
shared timeline, with notes in each track’s colour. It updates after edits and
undo, and its playhead follows playback. Press a note in the overview to open
its track, pitch range and two-bar page.

Select a track in the overview. Drag in empty space to draw a note and set
its length. Drag either end to shorten or lengthen it; drag the middle to move
it in time. Notes snap to quarter beats. Select a note, then press Delete or
Backspace, use the visible Delete note button, or right-click and choose Delete
note. Selecting a note alone never deletes it. Undo restores the last roll edit;
Ctrl/Cmd+Z works while the roll has focus.

The roll fits the available height and shows two bars per page. The arrows move
between pages; the octave selector changes the pitch range. Nearby pitches in
the selected track are included automatically. Move and length buttons provide
an alternative to dragging, including on touch screens. Keyboard users can move
a cursor with the arrow keys and add/select a note with Enter or Space. For a
selected note, left/right moves it and Shift+left/right changes its length.

Each voice is monophonic: drawing or moving a note replaces overlapping notes
on that voice. Undo can restore them. Pointer cancellation, focus loss, hiding
the page, and leaving the editor discard unfinished drags. Drum notes are noise
hits, with no pitched drum instruments.

Play previews the voices together using the same ATMlib mixer as the simulator.
M and S mute or solo tracks for preview only; they do not alter the saved song.
Loop repeats the preview. Tempo for polyphonic songs is rounded to multiples
of ten, matching the device player. The playhead shows the current bar and beat.

Note text remains available under **Edit note text**, and keyboard recording
can replace the selected track. Loading a built-in song replaces all four
tracks after confirmation. Duplicate creates an independent copy.

Custom songs are saved in the project and appear first in the **play song**
dropdown, followed by built-in songs. Existing custom-song blocks upgrade to
this combined block while retaining their selections. Play song, stop song and
song volume share a slightly different colour from the single-voice beep blocks,
within the same Music category.
Text code uses `music.playNamedSong(songs.theme, true)` in JavaScript or
`music.play_named_song(songs.theme, True)` in Python. Only songs used by the
program are included in compiled code. Devices without four-voice support use
the existing single-voice fallback; the studio preview always plays four voices.

## Pitch for melodies, songs and effects

The pitch block applies to both beep and polyphonic sounds. It picks a pitch
once when each sound starts: 100% is normal, 200% is one octave higher and
50% is one octave lower. The pitch stays with that sound after leaving the
block. Tempo and note durations stay unchanged; noise drums remain noise.
Devices that play only one song voice use the same pitch adjustment.

```javascript
music.setPitch(90, 110);
music.playPolyphonicEffect(PolySound.coin);
music.setPitch(100, 100);
```

```python
music.set_pitch(90, 110)
music.play_polyphonic_effect(PolySound.coin)
music.set_pitch(100, 100)
```

## Polyphonic effect sounds

These effects have independent melody, harmony, triangle bass and noise layers.
Each note can decay naturally; sweeps and vibrato run in the same tracker on
the device and in the simulator. They are short sounds for game events:

| Effect | Sound and use |
| --- | --- |
| Jump | Rising spring sweep, held harmony and a bass thump |
| Coin | Sparkling high chime over a sustained major chord |
| Power up | Rising sparkle, changing harmony and bass |
| Laser | Two offset downward sweeps with an impact and hiss |
| Explosion | Falling discordant debris, low rumble and a fading noise tail |
| Shield | Rippling high notes over a vibrating minor ninth chord and pulsing bass |
| Win | Three-part fanfare with a short drum roll |
| Lose | Falling minor harmony, bass drop and a final impact |

For example, use **play polyphonic effect [shield]** when the player collects
a shield. Use **play polyphonic effect [explosion]** when an enemy explodes.
These effects play once, pausing the current song and resuming it at its saved position. The full layered sound
requires a device with four-voice support; the simulator follows the selected
device's capabilities.
