import { API } from "../engine/api";
import { forEachExpr } from "../ir/check";
import { defaultEffect, type EffectDef, type EnumType, type Expr, type Program, type Stmt, type Ty, type Event } from "../ir/ir";
import { sanitize } from "../gen/names";
import {
  BUILTIN_KINDS,
  BUTTON_IDS,
  FLAGS,
  PROPS,
  HIT,
  SFX,
  COLORS,
} from "../engine/enums";
import type { Project } from "../project/model";

export type TextLanguage = "javascript" | "python";
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
const apiNames = new Map(
  Object.entries(API).flatMap(([key, fn]) => [
    [fn.name, key],
    [snake(fn.name), key],
  ]),
);
const enumNames: Record<string, EnumType> = {
  SpriteKind: "kind",
  Button: "button",
  SpriteFlag: "flag",
  Property: "prop",
  Direction: "dir",
  Sound: "sfx",
  Color: "color",
  images: "image",
  tilemaps: "tilemap",
  tiles: "tile",
};
const namespaces = Object.fromEntries(
  Object.entries(enumNames).map(([k, v]) => [v, k]),
);

// Keep ordinary user names; escape names that cannot be identifiers in both languages.
class SourceNames {
  private names = new Map<string, string>();
  private used = new Set<string>();
  get(name: string): string {
    const previous = this.names.get(name);
    if (previous) return previous;
    let base = sanitize(name);
    const reserved = new Set(
      "if else while for return break continue function def let const var global pass in of true false True False and or not class import from try catch finally throw new delete void null None async await yield events custom text melody choose asset kind sprites sprite game screen scene controller tiles images tilemaps info sound music animation randint _math effects effect particles".split(
        " ",
      ),
    );
    if (!/^[A-Za-z_]/.test(base) || reserved.has(base)) base = "_" + base;
    let id = base;
    for (let n = 2; this.used.has(id); n++) id = base + "_" + n;
    this.names.set(name, id);
    this.used.add(id);
    return id;
  }
}

interface Token {
  text: string;
  line: number;
}
export class SourceError extends Error {
  constructor(
    message: string,
    public line: number,
  ) {
    super(`Line ${line}: ${message}`);
  }
}

// Both front ends share an expression parser. Python indentation is represented
// by braces; strings and comments are tokenized before syntax is normalized.
function tokenize(source: string, language: TextLanguage): Token[] {
  const tokens: Token[] = [];
  const indents = [0];
  source.split("\n").forEach((raw, index) => {
    const line = index + 1;
    if (!raw.trim()) return;
    if (language === "python" && !raw.trimStart().startsWith("#")) {
      if (/^\s*\t/.test(raw))
        throw new SourceError("Use spaces for indentation.", line);
      const depth = raw.length - raw.trimStart().length;
      if (depth > indents.at(-1)!) {
        indents.push(depth);
        tokens.push({ text: "{", line });
      }
      while (depth < indents.at(-1)!) {
        indents.pop();
        tokens.push({ text: "}", line });
      }
      if (depth !== indents.at(-1))
        throw new SourceError("Inconsistent indentation.", line);
    }
    let rest = raw.trim();
    while (rest) {
      if (rest.startsWith(language === "python" ? "#" : "//")) {
        tokens.push({
          text:
            "@comment" + rest.slice(language === "python" ? 1 : 2).trimStart(),
          line,
        });
        break;
      }
      const m =
        /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|===|!==|==|!=|<=|>=|\+=|-=|\+\+|&&|\|\||[^\s])/.exec(
          rest,
        );
      if (!m) throw new SourceError("Invalid token.", line);
      let text = m[0];
      if (language === "python")
        text =
          (
            {
              True: "true",
              False: "false",
              and: "&&",
              or: "||",
              not: "!",
              elif: "else if",
            } as Record<string, string>
          )[text] ?? text;
      tokens.push({ text, line });
      rest = rest.slice(m[0].length).trimStart();
    }
    if (language === "python") tokens.push({ text: ";", line });
  });
  while (indents.length > 1) {
    indents.pop();
    tokens.push({ text: "}", line: source.split("\n").length });
  }
  tokens.push({ text: "<eof>", line: source.split("\n").length });
  return tokens;
}

export function parseSource(
  source: string,
  language: TextLanguage,
  project: Project,
): Program {
  const ts = tokenize(source, language);
  let i = 0;
  const p: Program = { vars: [], funcs: [], events: [] };
  const vars = new Set<string>();
  const token = () => ts[i];
  const eat = (s: string) => {
    if (token().text === s) {
      i++;
      return true;
    }
    return false;
  };
  const fail = (s: string): never => {
    throw new SourceError(s, token().line);
  };
  const need = (s: string) => {
    if (!eat(s)) fail(`Expected '${s}', found '${token().text}'.`);
  };
  const ident = () => {
    const s = token().text;
    if (!/^[A-Za-z_$][\w$]*$/.test(s)) fail("Expected a name.");
    i++;
    return s;
  };
  const declare = (name: string) => vars.add(name);
  const str = (s: string) => {
    if (s.startsWith('"')) return JSON.parse(s) as string;
    return s
      .slice(1, -1)
      .replace(
        /\\(['"\\nrt])/g,
        (_, c) =>
          (({ n: "\n", r: "\r", t: "\t" }) as Record<string, string>)[c] ?? c,
      );
  };
  const precedence: Record<string, number> = {
    "||": 1,
    "&&": 2,
    "==": 3,
    "===": 3,
    "!=": 3,
    "!==": 3,
    "<": 4,
    ">": 4,
    "<=": 4,
    ">=": 4,
    "+": 5,
    "-": 5,
    "*": 6,
    "/": 6,
    "%": 6,
  };
  const expr = (min = 0): Expr => {
    let a: Expr;
    if (eat("!")) a = { k: "un", op: "not", a: expr(7) };
    else if (eat("-")) a = { k: "un", op: "neg", a: expr(7) };
    else if (eat("(")) {
      a = expr();
      need(")");
    } else if (/^\d/.test(token().text)) {
      const v = Number(ts[i++].text);
      if (!Number.isInteger(v)) fail("Only integers are supported.");
      a = { k: "num", v };
    } else if (/^["']/.test(token().text))
      a = { k: "str", v: str(ts[i++].text) };
    else if (eat("true")) a = { k: "bool", v: true };
    else if (eat("false")) a = { k: "bool", v: false };
    else {
      let name = ident();
      while (eat(".")) name += "." + ident();
      if (eat("(")) {
        const args: Expr[] = [];
        if (!eat(")")) {
          do {
            args.push(expr());
          } while (eat(","));
          need(")");
        }
        if (name === "text") a = { k: "join", parts: args };
        else if (name === "asset") {
          if (args.length !== 2 || args[0].k !== "str" || args[1].k !== "str")
            fail("asset expects an asset type and ID as strings.");
          const type = (args[0] as Extract<Expr, { k: "str" }>).v;
          const id = (args[1] as Extract<Expr, { k: "str" }>).v;
          const assets =
            type === "image"
              ? [...project.images, ...project.backgrounds]
              : type === "tilemap"
                ? project.tilemaps
                : type === "tile"
                  ? project.tiles
                  : undefined;
          if (!assets?.some((x) => x.id === id)) fail("Unknown asset.");
          a = { k: "enum", type: type as EnumType, v: id };
        } else if (name === "kind") {
          if (
            args.length !== 1 ||
            args[0].k !== "str" ||
            ![...BUILTIN_KINDS, ...project.kinds].includes(args[0].v)
          )
            fail("Unknown sprite kind.");
          a = {
            k: "enum",
            type: "kind",
            v: (args[0] as Extract<Expr, { k: "str" }>).v,
          };
        } else if (name === "effect") {
          if (args.length !== 1 || args[0].k !== "str")
            fail("effect expects one string.");
          a = {
            k: "enum",
            type: "effect",
            v: (args[0] as Extract<Expr, { k: "str" }>).v,
          };
        } else if (name === "choose") {
          if (args.length !== 3) fail("choose expects three arguments.");
          a = { k: "cond", c: args[0], a: args[1], b: args[2] };
        } else if (name === "custom.cpp") {
          if (args.length !== 1 || args[0].k !== "str")
            fail("custom.cpp expects one string.");
          a = { k: "call", name, args };
        } else if (name === "melody") {
          if (args.length !== 1 || args[0].k !== "str")
            fail("melody expects one string.");
          a = {
            k: "enum",
            type: "melody",
            v: (args[0] as Extract<Expr, { k: "str" }>).v,
          };
        } else {
          const fn = apiNames.get(name);
          if (name.includes(".") && !fn) fail(`Unknown API '${name}'.`);
          if (fn && args.length !== API[fn as keyof typeof API].args.length)
            fail(`Wrong number of arguments for '${name}'.`);
          a = fn ? { k: "api", fn, args } : { k: "call", name, args };
        }
      } else if (name.includes(".")) {
        const [ns, v] = name.split(".");
        const type = enumNames[ns];
        if (!type) fail(`Unknown constant '${name}'.`);
        const assets =
          type === "image"
            ? [...project.images, ...project.backgrounds]
            : type === "tilemap"
              ? project.tilemaps
              : type === "tile"
                ? project.tiles
                : undefined;
        const asset = assets?.find((x) => x.name === v || sanitize(x.id) === v);
        if (assets && !asset && v !== "empty") fail(`Unknown asset '${name}'.`);
        const allowed: Partial<Record<EnumType, readonly string[]>> = {
          kind: [...BUILTIN_KINDS, ...project.kinds],
          button: BUTTON_IDS,
          flag: Object.keys(FLAGS),
          prop: PROPS,
          dir: Object.keys(HIT),
          sfx: SFX,
          color: Object.keys(COLORS),
        };
        if (allowed[type] && !allowed[type]!.includes(v))
          fail(`Unknown constant '${name}'.`);
        a = { k: "enum", type, v: asset?.id ?? v };
      } else a = { k: "var", name };
    }
    while ((precedence[token().text] ?? -1) >= min) {
      const op = ts[i++].text;
      const b = expr(precedence[op] + 1);
      a = {
        k: "bin",
        op: (op === "===" ? "==" : op === "!==" ? "!=" : op) as Extract<
          Expr,
          { k: "bin" }
        >["op"],
        a,
        b,
      };
    }
    if (min === 0 && eat("?")) {
      const yes = expr();
      need(":");
      a = { k: "cond", c: a, a: yes, b: expr() };
    }
    return a;
  };
  const end = () => {
    if (
      eat(";") ||
      ["}", "<eof>"].includes(token().text) ||
      token().text.startsWith("@comment")
    )
      return;
    if (token().line > ts[i - 1].line) return;
    fail(`Unexpected token '${token().text}'.`);
  };
  const body = (): Stmt[] => {
    const out: Stmt[] = [];
    if (language === "python") {
      need(":");
      if (token().text.startsWith("@comment"))
        out.push({ k: "comment", text: ts[i++].text.slice(8) });
      need(";");
    }
    need("{");
    while (!eat("}")) {
      if (token().text === "<eof>") fail("Missing end of block.");
      if (eat(";")) continue;
      out.push(statement());
    }
    return out;
  };
  const condition = () => {
    if (language === "javascript") {
      need("(");
      const e = expr();
      need(")");
      return e;
    }
    return expr();
  };
  const statement = (): Stmt => {
    if (token().text.startsWith("@comment")) {
      const text = ts[i++].text.slice(8);
      end();
      return { k: "comment", text };
    }
    if (eat("if")) {
      const cond = condition();
      const yes = body();
      while (eat(";")) {}
      let no: Stmt[] | undefined;
      if (eat("else")) no = eat("if") ? [ifAfter()] : body();
      else if (eat("else if")) no = [ifAfter()];
      return { k: "if", cond, then: yes, else: no };
    }
    if (eat("while")) {
      const cond = condition();
      return { k: "while", cond, body: body() };
    }
    if (language === "python" && eat("global")) {
      do {
        declare(ident());
      } while (eat(","));
      end();
      return { k: "comment", text: "" };
    }
    if (eat("repeat")) {
      const count = condition();
      return { k: "repeat", count, body: body() };
    }
    if (eat("for_kind")) {
      need("(");
      const v = expr();
      if (v.k !== "str") fail("Expected a variable name.");
      need(",");
      const kind = expr();
      need(")");
      const name = (v as Extract<Expr, { k: "str" }>).v;
      declare(name);
      return { k: "forKind", name, kind, body: body() };
    }
    if (eat("for")) {
      if (language === "python") {
        const name = ident();
        declare(name);
        need("in");
        let mode = ident();
        while (eat(".")) mode += "." + ident();
        need("(");
        const first = expr();
        let from: Expr = { k: "num", v: 0 },
          to = first;
        if (eat(",")) {
          from = first;
          to = expr();
        }
        need(")");
        if (mode === "sprites_of_kind" || mode === "sprites.of_kind")
          return { k: "forKind", name, kind: first, body: body() };
        if (mode !== "range") fail("Use range or sprites_of_kind.");
        if (name.startsWith("repeat_") && from.k === "num" && from.v === 0) {
          vars.delete(name);
          return { k: "repeat", count: to, body: body() };
        }
        return {
          k: "for",
          name,
          from,
          to:
            to.k === "bin" && to.op === "+" && to.b.k === "num" && to.b.v === 1
              ? to.a
              : { k: "bin", op: "-", a: to, b: { k: "num", v: 1 } },
          body: body(),
        };
      }
      need("(");
      eat("let");
      const name = ident();
      declare(name);
      if (eat("of")) {
        need("sprites");
        need(".");
        need("ofKind");
        need("(");
        const kind = expr();
        need(")");
        need(")");
        return { k: "forKind", name, kind, body: body() };
      }
      need("=");
      const from = expr();
      need(";");
      need(name);
      const exclusive = eat("<");
      if (!exclusive) need("<=");
      const limit = expr();
      need(";");
      need(name);
      need("++");
      need(")");
      if (
        exclusive &&
        name.startsWith("repeat_") &&
        from.k === "num" &&
        from.v === 0
      ) {
        vars.delete(name);
        return { k: "repeat", count: limit, body: body() };
      }
      return {
        k: "for",
        name,
        from,
        to: exclusive
          ? { k: "bin", op: "-", a: limit, b: { k: "num", v: 1 } }
          : limit,
        body: body(),
      };
    }
    if (eat("break")) {
      end();
      return { k: "break" };
    }
    if (eat("continue")) {
      end();
      return { k: "continue" };
    }
    if (eat("return")) {
      const value = [";", "}"].includes(token().text) ? undefined : expr();
      end();
      return { k: "return", value };
    }
    if (language === "python" && eat("pass")) {
      end();
      return { k: "comment", text: "" };
    }
    const declaration =
      language === "javascript" && (eat("let") || eat("const") || eat("var"));
    const a = expr();
    if (eat("=") || eat("+=") || eat("-=")) {
      const op = ts[i - 1].text;
      if (a.k !== "var") fail("Assign to a variable name.");
      const name = (a as Extract<Expr, { k: "var" }>).name;
      declare(name);
      let value = expr();
      if (op !== "=") value = { k: "bin", op: op[0] as "+" | "-", a, b: value };
      end();
      return { k: "set", name, value };
    }
    if (
      declaration &&
      a.k === "var" &&
      [";", "<eof>", "}"].includes(token().text)
    ) {
      declare(a.name);
      end();
      return { k: "comment", text: "" };
    }
    if (a.k === "call" && a.name === "custom.cpp") {
      end();
      return { k: "cpp", code: (a.args[0] as Extract<Expr, { k: "str" }>).v };
    }
    if (a.k !== "api" && a.k !== "call")
      fail("Expected an assignment or function call.");
    end();
    return { k: "expr", e: a };
  };
  const ifAfter = (): Stmt => {
    const cond = condition();
    const yes = body();
    while (eat(";")) {}
    let no: Stmt[] | undefined;
    if (eat("else if")) no = [ifAfter()];
    else if (eat("else")) no = eat("if") ? [ifAfter()] : body();
    return { k: "if", cond, then: yes, else: no };
  };
  // Effects are recipes of constants: effects.define("smoke") and then one
  // line per part, the same parts as the blocks.
  const effects: EffectDef[] = [];
  const effectPart = (part: string, args: Expr[]) => {
    const name = args[0]?.k === "str" ? args[0].v : fail("Expected the effect name as a string.");
    const n = (k: number) => {
      const a = args[k];
      if (a?.k === "num") return a.v;
      if (a?.k === "un" && a.op === "neg" && a.a.k === "num") return -a.a.v;
      return fail("Expected a number.");
    };
    const count = (c: number) => {
      if (args.length !== c) fail(`Wrong number of arguments for 'effects.${part}'.`);
    };
    if (part === "define") {
      count(1);
      if (effects.some((e) => e.name === name)) fail(`Duplicate effect '${name}'.`);
      effects.push(defaultEffect(name));
      return;
    }
    const fx = effects.find((e) => e.name === name) ?? fail(`Unknown effect '${name}'.`);
    switch (part) {
      case "pixel":
        count(2);
        fx.image = "";
        fx.color = n(1);
        break;
      case "image": {
        count(3);
        const img = args[1];
        if (img?.k !== "enum" || img.type !== "image") fail("Expected an image.");
        fx.image = (img as Extract<Expr, { k: "enum" }>).v;
        fx.color = n(2);
        break;
      }
      case "lifetime":
        count(3);
        fx.life = [n(1), n(2)];
        break;
      case "direction":
        count(3);
        fx.dir = n(1);
        fx.spread = n(2);
        break;
      case "speed":
        count(3);
        fx.speed = [n(1), n(2)];
        break;
      case "area":
        count(3);
        fx.area = [n(1), n(2)];
        break;
      case "acceleration":
        count(3);
        fx.accel = [n(1), n(2)];
        break;
      case "drag":
        count(2);
        fx.drag = n(1);
        break;
      case "wobble":
        count(2);
        fx.wobble = n(1);
        break;
      case "blink":
        count(2);
        fx.blink = n(1);
        break;
      default:
        fail(`Unknown effect part '${part}'.`);
    }
  };
  // Event metadata is explicit and identical across languages; handlers are
  // ordinary named functions, so no user closures are executed.
  const handlers = new Map<string, Stmt[]>();
  const registrations: { kind: string; args: Expr[] }[] = [];
  const start: Stmt[] = [];
  while (token().text !== "<eof>") {
    if (eat(";")) continue;
    if (
      language === "javascript" &&
      ["let", "const", "var"].includes(token().text) &&
      ts[i + 2]?.text === ";"
    ) {
      i++;
      declare(ident());
      need(";");
      continue;
    }
    if (eat(language === "python" ? "def" : "function")) {
      const name = ident();
      if (handlers.has(name)) fail(`Duplicate function '${name}'.`);
      need("(");
      const params: { name: string; ty: Ty }[] = [];
      if (!eat(")")) {
        do {
          params.push({ name: ident(), ty: "num" });
        } while (eat(","));
        need(")");
      }
      const b = body();
      const hasReturn = (list: Stmt[]): boolean =>
        list.some(
          (s) =>
            (s.k === "return" && !!s.value) ||
            (s.k === "if" && (hasReturn(s.then) || hasReturn(s.else ?? []))) ||
            (["while", "repeat", "for", "forKind"].includes(s.k) &&
              hasReturn((s as Extract<Stmt, { body: Stmt[] }>).body)),
        );
      handlers.set(name, b);
      p.funcs.push({
        name,
        params,
        ret: hasReturn(b) ? "num" : "void",
        body: b,
      });
    } else if (token().text === "events") {
      i++;
      need(".");
      const kind = ident();
      need("(");
      const args: Expr[] = [];
      if (!eat(")")) {
        do {
          args.push(expr());
        } while (eat(","));
        need(")");
      }
      end();
      registrations.push({ kind, args });
    } else if (token().text === "effects" && ts[i + 1].text === ".") {
      i += 2;
      const part = ident();
      need("(");
      const args: Expr[] = [];
      if (!eat(")")) {
        do {
          args.push(expr());
        } while (eat(","));
        need(")");
      }
      end();
      effectPart(part, args);
    } else if (token().text === "custom" && ts[i + 1].text === ".") {
      i += 2;
      need("cpp");
      need("(");
      const code = expr();
      if (code.k !== "str") fail("custom.cpp expects a string.");
      need(")");
      end();
      start.push({ k: "cpp", code: (code as Extract<Expr, { k: "str" }>).v });
    } else start.push(statement());
  }
  const registered = new Set<string>();
  for (const r of registrations) {
    const args = [...r.args];
    const handler = args.pop();
    if (handler?.k !== "var" || !handlers.has(handler.name))
      fail("Event requires a named handler.");
    const name = (handler as Extract<Expr, { k: "var" }>).name;
    if (p.funcs.find((f) => f.name === name)!.params.length)
      fail("Event handlers must have no parameters.");
    const counts: Record<string, number> = {
      start: 0,
      update: 0,
      draw: 0,
      lifeZero: 0,
      life_zero: 0,
      every: 1,
      button: 2,
      overlap: 4,
      tile: 5,
    };
    if (counts[r.kind] !== undefined && args.length !== counts[r.kind])
      fail(`Wrong number of arguments for event '${r.kind}'.`);
    registered.add(name);
    const b = handlers.get(name)!;
    const constant = (n: number) => {
      const a = args[n];
      if (a?.k === "enum") return a.v;
      if (a?.k === "str") return a.v;
      return fail("Expected an event constant.");
    };
    const variable = (n: number) => {
      const a = args[n];
      if (a?.k !== "str") return fail("Expected a variable name as a string.");
      declare(a.v);
      return a.v;
    };
    let event: Event;
    switch (r.kind) {
      case "start":
      case "update":
      case "draw":
      case "lifeZero":
      case "life_zero":
        event = {
          k:
            r.kind === "life_zero"
              ? "lifeZero"
              : (r.kind as "start" | "update" | "draw" | "lifeZero"),
          body: b,
        };
        break;
      case "every":
        if (args[0]?.k !== "num") fail("Expected an interval in milliseconds.");
        event = {
          k: "every",
          ms: (args[0] as Extract<Expr, { k: "num" }>).v,
          body: b,
        };
        break;
      case "button":
        if (args[1]?.k !== "bool") fail("Expected a pressed/released boolean.");
        event = {
          k: "button",
          button: constant(0),
          pressed: args[1]?.k === "bool" && args[1].v,
          body: b,
        };
        break;
      case "overlap":
        event = {
          k: "overlap",
          a: constant(0),
          b: constant(1),
          sv: variable(2),
          ov: variable(3),
          body: b,
        };
        break;
      case "tile":
        event = {
          k: "tile",
          kind: constant(0),
          tile: constant(1),
          sv: variable(2),
          col: variable(3),
          row: variable(4),
          body: b,
        };
        break;
      default:
        fail(`Unknown event '${r.kind}'.`);
    }
    p.events.push(event!);
  }
  p.funcs = p.funcs.filter((f) => !registered.has(f.name));
  if (start.length) p.events.unshift({ k: "start", body: start });
  const validateStatements = (list: Stmt[], loop: boolean, func: boolean) => {
    for (const s of list) {
      if ((s.k === "break" || s.k === "continue") && !loop)
        fail(`${s.k} requires a loop.`);
      if (s.k === "return" && s.value && !func)
        fail("Event handlers cannot return a value.");
      if (s.k === "if") {
        validateStatements(s.then, loop, func);
        validateStatements(s.else ?? [], loop, func);
      } else if ("body" in s) validateStatements(s.body, true, func);
    }
  };
  p.funcs.forEach((f) => validateStatements(f.body, false, true));
  p.events.forEach((e) => validateStatements(e.body, false, false));
  for (const scope of [
    ...p.funcs.map((f) => ({
      funcs: [f],
      events: [],
      params: f.params.map((p) => p.name),
    })),
    ...p.events.map((e) => ({
      funcs: [],
      events: [e],
      params: [] as string[],
    })),
  ]) {
    forEachExpr({ vars: [], funcs: scope.funcs, events: scope.events }, (e) => {
      if (e.k === "var" && !vars.has(e.name) && !scope.params.includes(e.name))
        fail(`Unknown variable '${e.name}'.`);
    });
  }
  forEachExpr(p, (e) => {
    if (e.k === "call") {
      const f = p.funcs.find((f) => f.name === e.name);
      if (!f) fail(`Unknown function '${e.name}'.`);
      if (f!.params.length !== e.args.length)
        fail(`Wrong number of arguments for '${e.name}'.`);
    }
  });
  forEachExpr(p, (e) => {
    if (e.k === "enum" && e.type === "effect" && !effects.some((fx) => fx.name === e.v))
      fail(`Unknown effect '${e.v}'.`);
  });
  if (effects.length) p.effects = effects;
  p.vars = [...vars].map((name) => ({ name, ty: "num" }));
  return p;
}

export function generateSource(
  program: Program,
  project: Project,
  language: TextLanguage,
): string {
  const py = language === "python";
  const names = { vars: new SourceNames(), funcs: new SourceNames() };
  const lines: string[] = [];
  let depth = 0;
  let serial = 0;
  const emit = (s: string) => lines.push("    ".repeat(depth) + s);
  const quote = (s: string) => JSON.stringify(s);
  const kindRef = (name: string) =>
    /^[A-Za-z_$][\w$]*$/.test(name)
      ? `SpriteKind.${name}`
      : `kind(${quote(name)})`;
  const assetRef = (type: EnumType, id: string) => {
    const assets =
      type === "image"
        ? [...project.images, ...project.backgrounds]
        : type === "tilemap"
          ? project.tilemaps
          : project.tiles;
    const name = sanitize(id);
    return (/^[A-Za-z_$][\w$]*$/.test(name) &&
      assets.filter((x) => sanitize(x.id) === name).length === 1) ||
      (type === "tile" && id === "empty")
      ? `${namespaces[type]}.${name}`
      : `asset(${quote(type)}, ${quote(id)})`;
  };
  const expression = (e: Expr): string => {
    switch (e.k) {
      case "num":
        return String(e.v);
      case "bool":
        return e.v ? (py ? "True" : "true") : py ? "False" : "false";
      case "str":
        return quote(e.v);
      case "var":
        return names.vars.get(e.name);
      case "enum":
        if (e.type === "melody") return `melody(${quote(e.v)})`;
        if (e.type === "effect") return `effect(${quote(e.v)})`;
        if (e.type === "kind") return kindRef(e.v);
        if (["image", "tilemap", "tile"].includes(e.type))
          return assetRef(e.type, e.v);
        return `${namespaces[e.type]}.${e.v}`;
      case "api":
        return `${py ? snake(API[e.fn as keyof typeof API].name) : API[e.fn as keyof typeof API].name}(${e.args.map(expression).join(", ")})`;
      case "call":
        return `${names.funcs.get(e.name)}(${e.args.map(expression).join(", ")})`;
      case "join":
        return `text(${e.parts.map(expression).join(", ")})`;
      case "un":
        return `(${e.op === "neg" ? "-" : py ? "not " : "!"}${expression(e.a)})`;
      case "bin":
        return `(${expression(e.a)} ${py ? (({ "&&": "and", "||": "or" } as Record<string, string>)[e.op] ?? e.op) : e.op} ${expression(e.b)})`;
      case "cond":
        return py
          ? `choose(${expression(e.c)}, ${expression(e.a)}, ${expression(e.b)})`
          : `(${expression(e.c)} ? ${expression(e.a)} : ${expression(e.b)})`;
    }
  };
  const block = (head: string, b: Stmt[]) => {
    emit(head + (py ? ":" : " {"));
    depth++;
    if (py && head.startsWith("def ")) {
      const assigned = new Set<string>();
      const walk = (list: Stmt[]) => {
        for (const s of list) {
          if (s.k === "set" || s.k === "for" || s.k === "forKind")
            assigned.add(names.vars.get(s.name));
          if (s.k === "if") {
            walk(s.then);
            walk(s.else ?? []);
          } else if ("body" in s) walk(s.body);
        }
      };
      walk(b);
      const params = head
        .slice(head.indexOf("(") + 1, -1)
        .split(", ")
        .filter(Boolean);
      const globals = [...assigned].filter((n) => !params.includes(n));
      if (globals.length) emit("global " + globals.join(", "));
    }
    statements(b);
    if (!b.some((s) => s.k !== "comment")) emit(py ? "pass" : "");
    depth--;
    if (!py) emit("}");
  };
  const statements = (body: Stmt[]) => {
    for (const s of body) {
      const suffix = py ? "" : ";";
      switch (s.k) {
        case "set":
          emit(`${names.vars.get(s.name)} = ${expression(s.value)}${suffix}`);
          break;
        case "expr":
          emit(expression(s.e) + suffix);
          break;
        case "if":
          block(
            py ? `if ${expression(s.cond)}` : `if (${expression(s.cond)})`,
            s.then,
          );
          if (s.else?.length) block("else", s.else);
          break;
        case "while":
          block(
            py
              ? `while ${expression(s.cond)}`
              : `while (${expression(s.cond)})`,
            s.body,
          );
          break;
        case "repeat": {
          const v = `repeat_${serial++}`;
          block(
            py
              ? `for ${v} in range(${expression(s.count)})`
              : `for (let ${v} = 0; ${v} < ${expression(s.count)}; ${v}++)`,
            s.body,
          );
          break;
        }
        case "for": {
          const v = names.vars.get(s.name);
          block(
            py
              ? `for ${v} in range(${expression(s.from)}, (${expression(s.to)} + 1))`
              : `for (${v} = ${expression(s.from)}; ${v} <= ${expression(s.to)}; ${v}++)`,
            s.body,
          );
          break;
        }
        case "forKind": {
          const v = names.vars.get(s.name);
          if (py)
            block(`for ${v} in sprites.of_kind(${expression(s.kind)})`, s.body);
          else {
            block(
              `for (let ${v} of sprites.ofKind(${expression(s.kind)}))`,
              s.body,
            );
          }
          break;
        }
        case "break":
        case "continue":
          emit(s.k + suffix);
          break;
        case "return":
          emit("return" + (s.value ? " " + expression(s.value) : "") + suffix);
          break;
        case "cpp":
          emit(`custom.cpp(${quote(s.code)})${suffix}`);
          break;
        case "comment":
          if (!s.text) break;
          s.text.split("\n").forEach((l) => emit((py ? "# " : "// ") + l));
          break;
      }
    }
  };
  if (!py) for (const v of program.vars) emit(`let ${names.vars.get(v.name)};`);
  for (const fx of program.effects ?? []) {
    const d = defaultEffect(fx.name);
    const part = (name: string, ...args: (string | number)[]) =>
      emit(`effects.${name}(${[quote(fx.name), ...args].join(", ")})${py ? "" : ";"}`);
    const same = (a: number[], b: number[]) => a.every((v, k) => v === b[k]);
    part("define");
    if (fx.image) part("image", assetRef("image", fx.image), fx.color);
    else if (fx.color !== d.color) part("pixel", fx.color);
    if (!same(fx.life, d.life)) part("lifetime", ...fx.life);
    if (!same([fx.dir, fx.spread], [d.dir, d.spread])) part("direction", fx.dir, fx.spread);
    if (!same(fx.speed, d.speed)) part("speed", ...fx.speed);
    if (!same(fx.area, d.area)) part("area", ...fx.area);
    if (!same(fx.accel, d.accel)) part("acceleration", ...fx.accel);
    if (fx.drag !== d.drag) part("drag", fx.drag);
    if (fx.wobble !== d.wobble) part("wobble", fx.wobble);
    if (fx.blink !== d.blink) part("blink", fx.blink);
    emit("");
  }
  for (const f of program.funcs)
    block(
      `${py ? "def" : "function"} ${names.funcs.get(f.name)}(${f.params.map((p) => names.vars.get(p.name)).join(", ")})`,
      f.body,
    );
  for (const e of program.events) {
    const handler = `on_${e.k}_${serial++}`;
    block(`${py ? "def" : "function"} ${handler}()`, e.body);
    let args: string[] = [];
    switch (e.k) {
      case "every":
        args = [String(e.ms)];
        break;
      case "button":
        args = [
          `Button.${e.button}`,
          e.pressed ? (py ? "True" : "true") : py ? "False" : "false",
        ];
        break;
      case "overlap":
        args = [
          kindRef(e.a),
          kindRef(e.b),
          quote(names.vars.get(e.sv)),
          quote(names.vars.get(e.ov)),
        ];
        break;
      case "tile":
        args = [
          kindRef(e.kind),
          assetRef("tile", e.tile),
          quote(names.vars.get(e.sv)),
          quote(names.vars.get(e.col)),
          quote(names.vars.get(e.row)),
        ];
        break;
    }
    emit(
      `events.${py ? snake(e.k) : e.k}(${[...args, handler].join(", ")})${py ? "" : ";"}`,
    );
    emit("");
  }
  return lines.join("\n") + "\n";
}
