import * as Blockly from 'blockly/core';
import { buildToolbox } from './toolbox';

type Entry = Record<string, unknown>;
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Index current translated labels as well as category names and block IDs. */
export function searchBlocks(query: string, workspace: Blockly.WorkspaceSvg): Entry[] {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const indexWorkspace = new Blockly.Workspace();
  const result: Entry[] = [];
  try {
    for (const category of buildToolbox().contents as Entry[]) {
      const name = Blockly.utils.parsing.replaceMessageReferences(String(category.name));
      const definition = category.custom
        ? workspace.getToolboxCategoryCallback(String(category.custom))?.(workspace) ?? []
        : category.contents as Entry[];
      const entries = 'contents' in definition ? definition.contents : Array.from(definition as ArrayLike<unknown>);
      for (const entry of entries) {
        // Standard dynamic flyouts can also return XML nodes.
        const json = typeof Element !== 'undefined' && entry instanceof Element ? Blockly.utils.xml.domToText(entry) : JSON.stringify(entry);
        let labels = '';
        for (const match of json.matchAll(/"type":"([^"]+)"/g)) {
          if (!Blockly.Blocks[match[1]]) continue;
          if (match[1] === 'ab_cpp') { labels += ` ${Blockly.Msg.AB_CPP}`; continue; }
          const block = indexWorkspace.newBlock(match[1]);
          labels += ` ${block.toString()} ${block.getTooltip()}`;
          block.dispose();
        }
        const text = normalize(`${name} ${json} ${labels}`);
        if (terms.every((term) => text.includes(term))) result.push(entry as Entry);
      }
    }
  } finally {
    indexWorkspace.dispose();
  }
  return result;
}
