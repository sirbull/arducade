/** Reproducible examples shared by the guide, screenshots and downloadable project. */
export const MUSIC_EXAMPLES = {
  melody: 'C5:0.25 E5:0.25 G5:0.25 C6:0.5 R:0.25',
  voices: [
    'C4:1 E4:1 G4:1 E4:1 D4:1 F4:1 A4:1 F4:1',
    'E4:4 F4:4',
    'C3:2 G3:2 F3:2 C3:2',
    'C4:0.25 R:0.75 C4:0.25 R:0.75 C4:0.25 R:0.75 C4:0.25 R:0.75 C4:0.25 R:0.75 C4:0.25 R:0.75 C4:0.25 R:0.75 C4:0.25 R:0.75',
  ] as [string, string, string, string],
  inheritance: 'C5:0.5 D E:1 R G',
  javascript: `function start() {
  music.playNamedSong(songs.skogstur, true);
}
events.start(start);

function coin() {
  music.playNamedMelody(melodies.mynt, false);
}
events.button(Button.a, true, coin);

function shield() {
  music.setPitch(90, 110);
  music.playPolyphonicEffect(PolySound.shield);
  music.setPitch(100, 100);
}
events.button(Button.b, true, shield);`,
  python: `def start():
    music.play_named_song(songs.skogstur, True)
events.start(start)

def coin():
    music.play_named_melody(melodies.mynt, False)
events.button(Button.a, True, coin)

def shield():
    music.set_pitch(90, 110)
    music.play_polyphonic_effect(PolySound.shield)
    music.set_pitch(100, 100)
events.button(Button.b, True, shield)`,
};
