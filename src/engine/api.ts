// The game engine API. Every block, and later every JavaScript and Python
// function, maps to one entry here. Each entry says how to call the engine in
// C++ (core/ardublocks/ardublocks.h) and in the simulator (src/sim/engine.ts).
//
// In the templates $0, $1 and so on are the arguments. In JavaScript the
// engine is the variable E.

import type { EnumType, Ty } from '../ir/ir';

export type ArgTy = Ty | EnumType;

export interface ApiFn {
  ret: Ty;
  args: ArgTy[];
  cpp: string;
  js: string;
  /** The simulator must await the call (it waits for time or a button). */
  async?: boolean;
  /** JavaScript and Python name, as in MakeCode Arcade. */
  name: string;
}

const api = <T extends Record<string, ApiFn>>(t: T) => t;

export const API = api({
  // Game
  'game.splash': { ret: 'void', args: ['str'], cpp: 'ab::splash($0)', js: 'await E.splash($0)', async: true, name: 'game.splash' },
  'game.clear': { ret: 'void', args: [], cpp: 'ab::clear()', js: 'E.clear()', name: 'screen.clear' },
  'game.showAndWait': { ret: 'void', args: [], cpp: 'ab::showAndWait()', js: 'await E.showAndWait()', async: true, name: 'game.waitForA' },
  'game.over': { ret: 'void', args: ['bool'], cpp: 'ab::gameOver($0)', js: 'E.gameOver($0)', name: 'game.over' },
  'game.pause': { ret: 'void', args: ['num'], cpp: 'ab::pause($0)', js: 'await E.pause($0)', async: true, name: 'pause' },
  'game.runtime': { ret: 'num', args: [], cpp: '(int16_t)ab::runtime()', js: 'E.runtime()', name: 'game.runtime' },
  'game.invert': { ret: 'void', args: ['bool'], cpp: 'ab::displayInvert($0)', js: 'E.invert($0)', name: 'scene.invert' },

  // Lightweight visual particles (no collisions).
  'particles.pixel': { ret: 'void', args: ['num', 'num', 'num', 'num', 'num'], cpp: 'ab::emitParticle(0, $0, $1, $2, $3, $4)', js: 'E.emitParticle(null, $0, $1, $2, $3, $4)', name: 'particles.pixel' },
  'particles.image': { ret: 'void', args: ['image', 'num', 'num', 'num', 'num', 'num'], cpp: 'ab::emitParticle($0, $1, $2, $3, $4, $5)', js: 'E.emitParticle($0, $1, $2, $3, $4, $5)', name: 'particles.image' },
  'particles.pixelTween': { ret: 'void', args: ['num', 'num', 'num', 'num', 'num', 'num', 'num'], cpp: 'ab::emitParticleTween(0, $0, $1, $2, $3, $4, $5, $6)', js: 'E.emitParticle(null, $0, $1, $2, $3, $4, $5, $6)', name: 'particles.pixelTween' },
  'particles.imageTween': { ret: 'void', args: ['image', 'num', 'num', 'num', 'num', 'num', 'num', 'num'], cpp: 'ab::emitParticleTween($0, $1, $2, $3, $4, $5, $6, $7)', js: 'E.emitParticle($0, $1, $2, $3, $4, $5, $6, $7)', name: 'particles.imageTween' },
  'particles.pixelColor': { ret: 'void', args: ['num', 'num', 'num', 'num', 'num', 'num', 'num', 'num'], cpp: 'ab::emitParticleTween(0, $0, $1, $2, $3, $4, $5, $6, $7)', js: 'E.emitParticle(null, $0, $1, $2, $3, $4, $5, $6, $7)', name: 'particles.pixelColor' },
  'particles.imageColor': { ret: 'void', args: ['image', 'num', 'num', 'num', 'num', 'num', 'num', 'num', 'num'], cpp: 'ab::emitParticleTween($0, $1, $2, $3, $4, $5, $6, $7, $8)', js: 'E.emitParticle($0, $1, $2, $3, $4, $5, $6, $7, $8)', name: 'particles.imageColor' },
  'particles.clear': { ret: 'void', args: [], cpp: 'ab::clearParticles()', js: 'E.clearParticles()', name: 'particles.clear' },
  // Particles from an effect recipe: effect, count, x, y, rotation in degrees.
  'particles.burst': { ret: 'void', args: ['effect', 'num', 'num', 'num', 'num'], cpp: 'ab::burst($0, $1, $2, $3, $4)', js: 'E.burst($0, $1, $2, $3, $4)', name: 'particles.burst' },
  'particles.burstFrom': { ret: 'void', args: ['effect', 'num', 'sprite', 'num'], cpp: 'ab::burstFrom($0, $1, $2, $3)', js: 'E.burstFrom($0, $1, $2, $3)', name: 'particles.burstFrom' },
  'particles.clearEffect': { ret: 'void', args: ['effect'], cpp: 'ab::clearEffect($0)', js: 'E.clearEffect($0)', name: 'particles.clearEffect' },

  // Sprites
  'sprites.create': { ret: 'sprite', args: ['image', 'kind'], cpp: 'ab::create($0, $1)', js: 'E.create($0, $1)', name: 'sprites.create' },
  'sprites.projectile': {
    ret: 'sprite',
    args: ['image', 'num', 'num', 'sprite'],
    cpp: 'ab::createProjectile($0, $1, $2, $3)',
    js: 'E.createProjectile($0, $1, $2, $3)',
    name: 'sprites.createProjectileFromSprite',
  },
  'sprites.get': { ret: 'num', args: ['sprite', 'prop'], cpp: 'ab::getProp($0, $1)', js: 'E.getProp($0, $1)', name: 'sprite.get' },
  'sprites.set': { ret: 'void', args: ['sprite', 'prop', 'num'], cpp: 'ab::setProp($0, $1, $2)', js: 'E.setProp($0, $1, $2)', name: 'sprite.set' },
  'sprites.change': { ret: 'void', args: ['sprite', 'prop', 'num'], cpp: 'ab::changeProp($0, $1, $2)', js: 'E.changeProp($0, $1, $2)', name: 'sprite.change' },
  'sprites.setPosition': { ret: 'void', args: ['sprite', 'num', 'num'], cpp: 'ab::setPosition($0, $1, $2)', js: 'E.setPosition($0, $1, $2)', name: 'sprite.setPosition' },
  'sprites.setVelocity': { ret: 'void', args: ['sprite', 'num', 'num'], cpp: 'ab::setVelocity($0, $1, $2)', js: 'E.setVelocity($0, $1, $2)', name: 'sprite.setVelocity' },
  'sprites.setZ': { ret: 'void', args: ['sprite', 'num'], cpp: 'ab::setZ($0, $1)', js: 'E.setZ($0, $1)', name: 'sprite.setZ' },
  'sprites.setOutlineWidth': { ret: 'void', args: ['sprite', 'num'], cpp: 'ab::setOutlineWidth($0, $1)', js: 'E.setOutlineWidth($0, $1)', name: 'sprite.setOutlineWidth' },
  'sprites.setOutline': { ret: 'void', args: ['sprite', 'num'], cpp: 'ab::setOutline($0, $1)', js: 'E.setOutline($0, $1)', name: 'sprite.setOutline' },
  'sprites.setImage': { ret: 'void', args: ['sprite', 'image'], cpp: 'ab::setImage($0, $1)', js: 'E.setImage($0, $1)', name: 'sprite.setImage' },
  'sprites.setFlag': { ret: 'void', args: ['sprite', 'flag', 'bool'], cpp: 'ab::setFlag($0, $1, $2)', js: 'E.setFlag($0, $1, $2)', name: 'sprite.setFlag' },
  'sprites.animate': { ret: 'void', args: ['sprite', 'num'], cpp: 'ab::animate($0, $1)', js: 'E.animate($0, $1)', name: 'animation.run' },
  'sprites.destroy': { ret: 'void', args: ['sprite'], cpp: 'ab::destroy($0)', js: 'E.destroy($0)', name: 'sprite.destroy' },
  'sprites.destroyAll': { ret: 'void', args: ['kind'], cpp: 'ab::destroyAll($0)', js: 'E.destroyAll($0)', name: 'sprites.destroyAllSpritesOfKind' },
  'sprites.overlaps': { ret: 'bool', args: ['sprite', 'sprite'], cpp: 'ab::overlaps($0, $1)', js: 'E.overlaps($0, $1)', name: 'sprite.overlapsWith' },
  'sprites.isHitting': { ret: 'bool', args: ['sprite', 'dir'], cpp: 'ab::isHitting($0, $1)', js: 'E.isHitting($0, $1)', name: 'sprite.isHittingTile' },
  'sprites.kind': { ret: 'num', args: ['sprite'], cpp: 'ab::kindOf($0)', js: 'E.kindOf($0)', name: 'sprite.kind' },
  'sprites.isKind': { ret: 'bool', args: ['sprite', 'kind'], cpp: '(ab::kindOf($0) == $1)', js: '(E.kindOf($0) === $1)', name: 'sprite.isKind' },
  'sprites.setKind': { ret: 'void', args: ['sprite', 'kind'], cpp: 'ab::setKind($0, $1)', js: 'E.setKind($0, $1)', name: 'sprite.setKind' },
  'sprites.exists': { ret: 'bool', args: ['sprite'], cpp: 'ab::exists($0)', js: 'E.exists($0)', name: 'sprite.exists' },

  // Controller
  'controller.isPressed': { ret: 'bool', args: ['button'], cpp: 'ab::isPressed($0)', js: 'E.isPressed($0)', name: 'controller.isPressed' },
  'controller.moveSprite': { ret: 'void', args: ['sprite', 'num', 'num'], cpp: 'ab::moveWithButtons($0, $1, $2)', js: 'E.moveWithButtons($0, $1, $2)', name: 'controller.moveSprite' },

  // Scene and tiles
  'scene.setTilemap': { ret: 'void', args: ['tilemap'], cpp: 'ab::setMap($0, tileImages, TILE_SOLID)', js: 'E.setMap($0)', name: 'tiles.setTilemap' },
  'scene.cameraFollow': { ret: 'void', args: ['sprite'], cpp: 'ab::cameraFollow($0)', js: 'E.cameraFollow($0)', name: 'scene.cameraFollowSprite' },
  'scene.setCamera': { ret: 'void', args: ['num', 'num'], cpp: 'ab::setCamera($0, $1)', js: 'E.setCamera($0, $1)', name: 'scene.centerCameraAt' },
  'scene.setTile': { ret: 'void', args: ['num', 'num', 'tile'], cpp: 'ab::setTile($0, $1, $2)', js: 'E.setTile($0, $1, $2)', name: 'tiles.setTileAt' },
  'scene.tileIs': { ret: 'bool', args: ['num', 'num', 'tile'], cpp: '(ab::tileAt($0, $1) == $2)', js: '(E.tileAt($0, $1) === $2)', name: 'tiles.tileAtLocationEquals' },
  'scene.placeOnTile': { ret: 'void', args: ['sprite', 'num', 'num'], cpp: 'ab::setPosition($0, $1 * 8 + 4, $2 * 8 + 4)', js: 'E.setPosition($0, $1 * 8 + 4, $2 * 8 + 4)', name: 'tiles.placeOnTile' },
  'scene.spawnOnTiles': {
    ret: 'void',
    args: ['tile', 'image', 'kind'],
    cpp: 'ab::spawnOnTiles($0, $1, $2)',
    js: 'E.spawnOnTiles($0, $1, $2)',
    name: 'tiles.createSpritesOnTiles',
  },
  'scene.cameraX': { ret: 'num', args: [], cpp: 'ab::camX', js: 'E.camX', name: 'scene.cameraLeft' },
  'scene.cameraY': { ret: 'num', args: [], cpp: 'ab::camY', js: 'E.camY', name: 'scene.cameraTop' },
  // Strength in pixels, time in ms.
  'scene.shake': { ret: 'void', args: ['num', 'num'], cpp: 'ab::shake($0, $1)', js: 'E.shake($0, $1)', name: 'scene.cameraShake' },

  // Background: one picture behind everything, repeated to fill the screen.
  'background.set': { ret: 'void', args: ['image'], cpp: 'ab::setBackground($0)', js: 'E.setBackground($0)', name: 'scene.setBackgroundImage' },
  'background.clear': { ret: 'void', args: [], cpp: 'ab::setBackground(0)', js: 'E.setBackground(null)', name: 'scene.clearBackground' },
  'background.setPosition': { ret: 'void', args: ['num', 'num'], cpp: 'ab::setBackgroundPosition($0, $1)', js: 'E.setBackgroundPosition($0, $1)', name: 'scene.setBackgroundPosition' },
  'background.changePosition': { ret: 'void', args: ['num', 'num'], cpp: 'ab::setBackgroundPosition(ab::bgX + $0, ab::bgY + $1)', js: 'E.setBackgroundPosition(E.bgX + $0, E.bgY + $1)', name: 'scene.changeBackgroundPosition' },
  'background.x': { ret: 'num', args: [], cpp: 'ab::bgX', js: 'E.bgX', name: 'scene.backgroundX' },
  'background.y': { ret: 'num', args: [], cpp: 'ab::bgY', js: 'E.bgY', name: 'scene.backgroundY' },

  // Info
  'info.timerSetMillis': { ret: 'void', args: ['num', 'num'], cpp: 'ab::timerSetMillis($0, $1)', js: 'E.timerSetMillis($0, $1)', name: 'info.timerSetMillis' },
  'info.timerChangeMillis': { ret: 'void', args: ['num', 'num'], cpp: 'ab::timerChangeMillis($0, $1)', js: 'E.timerChangeMillis($0, $1)', name: 'info.timerChangeMillis' },
  'info.timerMillis': { ret: 'num', args: ['num'], cpp: 'ab::timerMillis($0)', js: 'E.timerMillis($0)', name: 'info.timerMillis' },
  'info.timerSet': { ret: 'void', args: ['num', 'num'], cpp: 'ab::timerSet($0, $1)', js: 'E.timerSet($0, $1)', name: 'info.timerSet' },
  'info.timerChange': { ret: 'void', args: ['num', 'num'], cpp: 'ab::timerChange($0, $1)', js: 'E.timerChange($0, $1)', name: 'info.timerChange' },
  'info.timerRun': { ret: 'void', args: ['num', 'num'], cpp: 'ab::timerRun($0, $1)', js: 'E.timerRun($0, $1)', name: 'info.timerRun' },
  'info.timerFormat': { ret: 'void', args: ['num', 'num'], cpp: 'ab::timerFormat($0, $1)', js: 'E.timerFormat($0, $1)', name: 'info.timerFormat' },
  'info.timerPosition': { ret: 'void', args: ['num', 'num', 'num'], cpp: 'ab::timerPosition($0, $1, $2)', js: 'E.timerPosition($0, $1, $2)', name: 'info.timerPosition' },
  'info.timerValue': { ret: 'num', args: ['num'], cpp: 'ab::timerValue($0)', js: 'E.timerValue($0)', name: 'info.timerValue' },
  'info.score': { ret: 'num', args: [], cpp: 'ab::score', js: 'E.score', name: 'info.score' },
  'info.setScore': { ret: 'void', args: ['num'], cpp: 'ab::setScore($0)', js: 'E.setScore($0)', name: 'info.setScore' },
  'info.setScorePosition': { ret: 'void', args: ['num', 'num'], cpp: 'ab::setScorePosition($0, $1)', js: 'E.setScorePosition($0, $1)', name: 'info.setScorePosition' },
  'info.changeScore': { ret: 'void', args: ['num'], cpp: 'ab::changeScore($0)', js: 'E.changeScore($0)', name: 'info.changeScoreBy' },
  'info.life': { ret: 'num', args: [], cpp: 'ab::life', js: 'E.life', name: 'info.life' },
  'info.setLifePosition': { ret: 'void', args: ['num', 'num'], cpp: 'ab::setLifePosition($0, $1)', js: 'E.setLifePosition($0, $1)', name: 'info.setLifePosition' },
  'info.setLife': { ret: 'void', args: ['num'], cpp: 'ab::setLife($0)', js: 'await E.setLife($0)', async: true, name: 'info.setLife' },
  'info.changeLife': { ret: 'void', args: ['num'], cpp: 'ab::changeLife($0)', js: 'await E.changeLife($0)', async: true, name: 'info.changeLifeBy' },
  'info.highScore': { ret: 'num', args: [], cpp: 'ab::hiscore', js: 'E.hiscore', name: 'info.highScore' },
  'storage.save': { ret: 'void', args: ['num', 'num'], cpp: 'ab::storageSave($0, $1)', js: 'E.storageSave($0, $1)', name: 'settings.writeNumber' },
  'storage.load': { ret: 'num', args: ['num'], cpp: 'ab::storageLoad($0)', js: 'E.storageLoad($0)', name: 'settings.readNumber' },

  // Graphics, used in the "on draw" event
  'draw.text': { ret: 'void', args: ['num', 'num', 'str', 'color'], cpp: 'ab::drawText($0, $1, $2, $3)', js: 'E.drawText($0, $1, $2, $3)', name: 'screen.printText' },
  'draw.pixel': { ret: 'void', args: ['num', 'num', 'color'], cpp: 'ab::drawPixel($0, $1, $2)', js: 'E.drawPixel($0, $1, $2)', name: 'screen.setPixel' },
  'draw.line': { ret: 'void', args: ['num', 'num', 'num', 'num', 'color'], cpp: 'ab::drawLine($0, $1, $2, $3, $4)', js: 'E.drawLine($0, $1, $2, $3, $4)', name: 'screen.drawLine' },
  'draw.rect': { ret: 'void', args: ['num', 'num', 'num', 'num', 'color'], cpp: 'ab::drawRect($0, $1, $2, $3, $4)', js: 'E.drawRect($0, $1, $2, $3, $4)', name: 'screen.drawRect' },
  'draw.fillRect': { ret: 'void', args: ['num', 'num', 'num', 'num', 'color'], cpp: 'ab::fillRect($0, $1, $2, $3, $4)', js: 'E.fillRect($0, $1, $2, $3, $4)', name: 'screen.fillRect' },
  'draw.circle': { ret: 'void', args: ['num', 'num', 'num', 'color'], cpp: 'ab::drawCircle($0, $1, $2, $3, false)', js: 'E.drawCircle($0, $1, $2, $3, false)', name: 'screen.drawCircle' },
  'draw.fillCircle': { ret: 'void', args: ['num', 'num', 'num', 'color'], cpp: 'ab::drawCircle($0, $1, $2, $3, true)', js: 'E.drawCircle($0, $1, $2, $3, true)', name: 'screen.fillCircle' },
  'draw.image': { ret: 'void', args: ['image', 'num', 'num'], cpp: 'ab::drawImage($1, $2, $0, 0)', js: 'E.drawImage($1, $2, $0, 0)', name: 'screen.drawImage' },
  'draw.getPixel': { ret: 'bool', args: ['num', 'num'], cpp: '(ab::getPixel($0, $1) != 0)', js: '(E.getPixel($0, $1) !== 0)', name: 'screen.getPixel' },

  // Music
  'music.effect': { ret: 'void', args: ['sfx'], cpp: 'ab::playEffect($0)', js: 'E.playEffect($0)', name: 'music.play' },
  'music.tone': { ret: 'void', args: ['num', 'num'], cpp: 'ab::playTone($0, $1)', js: 'E.playTone($0, $1)', name: 'music.playTone' },
  'music.melody': { ret: 'void', args: ['melody', 'num', 'bool'], cpp: 'ab::playMelody($0, $1, $2)', js: 'E.playMelody($0, $1, $2)', name: 'music.playMelody' },
  'music.pitch': { ret: 'void', args: ['num', 'num'], cpp: 'ab::setPitch($0, $1)', js: 'E.setPitch($0, $1)', name: 'music.setPitch' },
  'music.stop': { ret: 'void', args: [], cpp: 'ab::soundOff()', js: 'E.soundOff()', name: 'music.stopAllSounds' },

  // Math
  'math.map': { ret: 'num', args: ['num', 'num', 'num', 'num', 'num'], cpp: 'ab::mapValue($0, $1, $2, $3, $4)', js: 'E.mapValue($0, $1, $2, $3, $4)', name: 'Math.map' },
  'math.random': { ret: 'num', args: ['num', 'num'], cpp: 'ab::random($0, $1)', js: 'E.random($0, $1)', name: 'randint' },
  'math.abs': { ret: 'num', args: ['num'], cpp: 'abs($0)', js: '$w(Math.abs($0))', name: 'Math.abs' },
  'math.min': { ret: 'num', args: ['num', 'num'], cpp: 'min($0, $1)', js: 'Math.min($0, $1)', name: 'Math.min' },
  'math.max': { ret: 'num', args: ['num', 'num'], cpp: 'max($0, $1)', js: 'Math.max($0, $1)', name: 'Math.max' },
  'math.constrain': { ret: 'num', args: ['num', 'num', 'num'], cpp: 'constrain($0, $1, $2)', js: 'Math.min(Math.max($0, $1), $2)', name: 'Math.constrain' },
});

export type ApiId = keyof typeof API;

export function getApi(id: string): ApiFn | undefined {
  return (API as Record<string, ApiFn>)[id];
}
