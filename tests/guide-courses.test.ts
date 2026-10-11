import { describe, expect, it } from 'vitest';
import './helpers';
import { COURSES } from '../src/guides/courses';
import { guideProject, type Check } from '../src/guides/guide';
import { runChecks } from '../src/guides/runtime';
import { LIBRARY_IMAGES } from '../src/project/library';

async function play(id: string, run: Check['run']) {
  const guide = COURSES.find(g=>g.id===id)!;
  const project = guideProject(guide,'en');
  project.blocks=guide.steps.at(-1)!.solution;
  return (await runChecks([{text:{en:'Gameplay'},ok:()=>true,run}],project))[0];
}
const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

describe('progressive courses',()=>{
  it('has five increasingly long projects with ordered chapters and original gallery sprites',()=>{
    expect(COURSES.map(g=>g.steps.length)).toEqual([8,10,14,16,18,21]);
    const owned = new Set<string>();
    for(const guide of COURSES){
      expect(guide.chapters![0].start).toBe(0);
      expect(guide.chapters!.map(c=>c.start)).toEqual([...guide.chapters!.map(c=>c.start)].sort((a,b)=>a-b));
      for(const image of guide.images){
        expect(owned.has(image)).toBe(false);owned.add(image);
        const art = LIBRARY_IMAGES.find(i=>i.id===image)!;
        expect(Object.keys(art.name).sort()).toEqual(['de','en','es','fr','nb']);
        expect(art.frames.every(frame=>frame.length===art.height&&frame.every(row=>row.length===art.width))).toBe(true);
      }
      const project = guideProject(guide,'nb');
      if(project.tiles.length){project.tiles[0].pixels[0]='........';expect(guide.tiles![0].pixels[0]).not.toBe('........');}
    }
  });
  it('shows additions in the step picture while keeping the complete code under Help',()=>{
    const maze=COURSES[0];
    const start = maze.steps[1].show![0];
    expect(start.type).toBe('ab_on_start');
    expect(start.inputs.DO.block.type).toBe('variables_set');
    expect(start.inputs.DO.block.inputs.VALUE.block.type).toBe('ab_sprite_create');
    expect(start.inputs.DO.block.next.block.type).toBe('ab_sprite_set_position');
    expect(maze.steps[1].solution.blocks.blocks[0].type).toBe('ab_on_start');
    expect(maze.steps.at(-1)!.show).toBeUndefined();
  });
  it.each(lines)('recognises tic-tac-toe winning line %s,%s,%s',async(a,b,c)=>{
    const winner=[a,b,c];const others=Array.from({length:9},(_,i)=>i).filter(i=>!winner.includes(i));
    expect(await play('w2-tictactoe',async(e,f)=>{
      let at=0;const tap=async(key:number)=>{await f(key);await f();};
      for(const target of [a,others[0],b,others[1],c]){
        while(at<target){await tap(8);at++;}while(at>target){await tap(4);at--;}
        await tap(16);
      }
      return e.gameOverPending&&!e.gameOverWin&&e.score===1;
    })).toBe(true);
  });
  it('recognises a full-board draw and refuses occupied cells without changing turn',async()=>{
    expect(await play('w2-tictactoe',async(e,f)=>{
      let at=0;const tap=async(key:number)=>{await f(key);await f();};
      await tap(16);const count=e.sprites.filter(s=>s.alive).length;
      await tap(16);if(e.sprites.filter(s=>s.alive).length!==count||e.score!==2)return false;
      for(const target of [1,2,4,3,5,7,6,8]){
        while(at<target){await tap(8);at++;}while(at>target){await tap(4);at--;}
        await tap(16);
      }
      return !e.gameOverPending&&Number(e.score)===0&&e.sprites.filter(s=>s.alive&&s.kind===3).length===9;
    })).toBe(true);
  });
  it('lets the second player win',async()=>{
    expect(await play('w2-tictactoe',async(e,f)=>{
      let at=0;const tap=async(key:number)=>{await f(key);await f();};
      for(const target of [3,0,4,1,8,2]){
        while(at<target){await tap(8);at++;}while(at>target){await tap(4);at--;}
        await tap(16);
      }
      return e.gameOverPending&&!e.gameOverWin&&e.score===2;
    })).toBe(true);
  });
  it('the bomb blast also defeats its owner if they fail to escape',async()=>{
    expect(await play('w2-bombs',async(e,f)=>{await f(16);await f(0,140);return e.gameOverPending&&!e.gameOverWin;})).toBe(true);
  });
  it('keeps the pet menu inside its three icons and lets sleep restore energy',async()=>{
    expect(await play('w2-pet',async(e,f)=>{
      await e.setLife(2);await f();
      for(let i=0;i<5;i++){await f(8);await f();}
      await f(16);await f(0,150);
      return !e.gameOverPending&&e.life>2&&e.sprites[0].vx===0;
    })).toBe(true);
  });
});
