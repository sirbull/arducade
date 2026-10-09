// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  generateSource,
  parseSource,
  type TextLanguage,
} from "../src/text/languages";
import { TEMPLATE_SOURCES, templateToProject } from "../src/templates";
import { compileProject } from "./helpers";
import { generateCpp } from "../src/gen/cpp";
import { generateJs } from "../src/gen/js";
import {
  newProject,
  parseProject,
  serializeProject,
} from "../src/project/model";
import { buildProject } from "../src/ui/build";

for (const language of ["javascript", "python"] as TextLanguage[]) {
  describe(language, () => {
    for (const template of TEMPLATE_SOURCES)
      it(`round trips ${template.id}`, () => {
        const project = templateToProject(template);
        const { ir } = compileProject(project);
        const source = generateSource(ir.program, project, language);
        const program = parseSource(source, language, project);
        expect(
          generateCpp(program, project).diagnostics.filter(
            (d) => d.level === "error",
          ),
        ).toEqual([]);
        expect(
          () =>
            new Function(
              "E",
              "$w",
              "$div",
              "$mod",
              "$lg",
              generateJs(program, project).code,
            ),
        ).not.toThrow();
        const again = generateSource(program, project, language);
        expect(
          generateSource(
            parseSource(again, language, project),
            project,
            language,
          ),
        ).toBe(again);
      });
    it("keeps C++ and comments through translation", () => {
      const project = newProject("Test");
      const source =
        language === "python"
          ? '# hello\ncustom.cpp("ab::clear();")\n'
          : '// hello\ncustom.cpp("ab::clear();");';
      const program = parseSource(source, language, project);
      expect(generateSource(program, project, language)).toContain("hello");
      expect(generateCpp(program, project).code).toContain("ab::clear();");
    });
    it("rejects unsupported code instead of executing it", () => {
      const project = newProject("Test");
      for (const code of [
        'eval("alert(1)")',
        "screen.unknown()",
        "x = images.missing",
        "x = 1.5",
      ]) {
        expect(() => parseSource(code, language, project)).toThrow();
      }
    });
  });
}
it("builds and saves text projects and preserves invalid drafts", () => {
  const project = newProject("Test");
  project.source = {
    language: "python",
    code: "score = 42\ninfo.set_score(score)\n",
  };
  const loaded = parseProject(serializeProject(project));
  expect(buildProject(loaded).cpp.code).toContain("42");
  loaded.source!.code = "if";
  const build = buildProject(loaded);
  expect(build.diagnostics.some((d) => d.key === "code.sourceError")).toBe(
    true,
  );
  expect(parseProject(serializeProject(loaded)).source?.code).toBe("if");
});

it("rejects malformed statements, event registrations and undeclared variables", () => {
  const project = newProject("Test");
  for (const code of [
    "x = 1 2;",
    "x = missing;",
    "function f(x) {} events.update(f);",
    "function f() {} events.button(Button.a, 1, f);",
    "function f() {} events.update(12, f);",
  ]) {
    expect(() => parseSource(code, "javascript", project)).toThrow();
  }
});

it.each(["javascript", "python"] as const)(
  "runs %s through the simulator with integer arithmetic and events",
  async (language) => {
    const { Engine } = await import("../src/sim/engine");
    const { div16, mod16 } = await import("../src/sim/intmath");
    const project = newProject("Test");
    const jsSource = `let score;
function twice(value) { return value * 2; }
function start() { score = 32767; score += 1; info.setScore(score); }
events.start(start);
function pressed() { info.setScore(twice(21)); }
events.button(Button.a, true, pressed);`;
    const original = parseSource(jsSource, "javascript", project);
    const source = generateSource(original, project, language);
    const program = parseSource(source, language, project);
    expect(
      generateCpp(program, project).diagnostics.filter(
        (d) => d.level === "error",
      ),
    ).toEqual([]);
    const generated = generateJs(program, project);
    const engine = new Engine({
      show: () => {},
      tone: () => {},
      storage: { read: () => 0, write: () => {} },
      onSkippedCpp: () => {},
      maxSprites: 16,
      hiscoreMagic: 0,
    });
    const factory = new Function(
      "E",
      "$w",
      "$div",
      "$mod",
      "$lg",
      generated.code,
    );
    await engine.begin(
      factory(
        engine,
        (n: number) => (n << 16) >> 16,
        div16,
        mod16,
        engine.loopGuard,
      ),
    );
    expect(engine.score).toBe(-32768);
    engine.input = 16;
    await engine.frame(true);
    expect(engine.score).toBe(42);
    engine.stop();
  },
);

it("round trips asset IDs, kind names and variable names that are not identifiers", () => {
  const project = newProject("Names");
  project.kinds = ["Big enemy"];
  project.images = [
    { id: "123", name: "Ship", width: 1, height: 1, frames: [["1"]] },
  ];
  const program = {
    vars: [{ name: "class", ty: "sprite" as const }],
    funcs: [],
    events: [
      {
        k: "start" as const,
        body: [
          {
            k: "set" as const,
            name: "class",
            value: {
              k: "api" as const,
              fn: "sprites.create",
              args: [
                { k: "enum" as const, type: "image" as const, v: "123" },
                { k: "enum" as const, type: "kind" as const, v: "Big enemy" },
              ],
            },
          },
        ],
      },
    ],
  };
  for (const language of ["javascript", "python"] as const) {
    const source = generateSource(program, project, language);
    const parsed = parseSource(source, language, project);
    expect(
      generateCpp(parsed, project).diagnostics.filter(
        (d) => d.level === "error",
      ),
    ).toEqual([]);
    expect(
      generateSource(
        parseSource(
          generateSource(parsed, project, language),
          language,
          project,
        ),
        project,
        language,
      ),
    ).toBe(generateSource(parsed, project, language));
  }
});
