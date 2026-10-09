import "monaco-editor/editor/contrib/suggest/browser/suggestController.js";
import "monaco-editor/editor/contrib/hover/browser/hoverContribution.js";
import "monaco-editor/editor/contrib/find/browser/findController.js";
import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor/languages/definitions/javascript/register.js";
import "monaco-editor/languages/definitions/python/register.js";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { API } from "../engine/api";
import type { TextLanguage } from "../text/languages";

(
  self as typeof self & { MonacoEnvironment: { getWorker: () => Worker } }
).MonacoEnvironment = { getWorker: () => new EditorWorker() };
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
for (const language of ["javascript", "python"]) {
  monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: ["."],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const prefix = model
        .getLineContent(position.lineNumber)
        .slice(0, word.startColumn - 1);
      const ns = /([\w]+)\.$/.exec(prefix)?.[1];
      const range = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        position.column,
      );
      return {
        suggestions: Object.values(API)
          .map((fn) => {
            const name = language === "python" ? snake(fn.name) : fn.name;
            const args = fn.args
              .map((type, i) => `\${${i + 1}:${type}}`)
              .join(", ");
            return {
              label: name,
              kind: monaco.languages.CompletionItemKind.Function,
              detail: `${name}(${fn.args.join(", ")}) → ${fn.ret}`,
              insertText: `${ns ? name.slice(ns.length + 1) : name}(${args})`,
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
            };
          })
          .filter((item) => !ns || item.label.startsWith(ns + ".")),
      };
    },
  });
}

export class TextEditor {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private setting = false;
  constructor(
    el: HTMLElement,
    language: TextLanguage,
    changed: (code: string) => void,
  ) {
    this.editor = monaco.editor.create(el, {
      language,
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      tabSize: 4,
      insertSpaces: true,
      scrollBeyondLastLine: false,
      theme: "vs-dark",
      ariaLabel: language === "python" ? "Python" : "JavaScript",
    });
    this.editor.onDidChangeModelContent(() => {
      if (!this.setting) changed(this.editor.getValue());
    });
  }
  setCode(code: string) {
    if (code === this.editor.getValue()) return;
    this.setting = true;
    this.editor.setValue(code);
    this.setting = false;
  }
  showError(message?: string, line = 1) {
    const model = this.editor.getModel();
    if (model)
      monaco.editor.setModelMarkers(
        model,
        "arducade",
        message
          ? [
              {
                message,
                startLineNumber: line,
                endLineNumber: line,
                startColumn: 1,
                endColumn: Math.max(2, model.getLineMaxColumn(line)),
                severity: monaco.MarkerSeverity.Error,
              },
            ]
          : [],
      );
  }
}
