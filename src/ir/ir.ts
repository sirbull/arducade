// The intermediate representation (IR) shared by blocks, JavaScript and
// Python. C++ for the device and JavaScript for the simulator are both made
// from the IR, so all three ways of writing a game behave the same.

export type Ty = 'num' | 'bool' | 'str' | 'sprite' | 'void';

/** Values chosen from a fixed list, for example a sprite kind or a button. */
export type EnumType = 'kind' | 'button' | 'flag' | 'prop' | 'dir' | 'sfx' | 'color' | 'image' | 'tile' | 'tilemap';

export type BinOp = '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||';

interface Node {
  /** Id of the block the node was made from, used to highlight code. */
  id?: string;
}

export type Expr = Node &
  (
    | { k: 'num'; v: number }
    | { k: 'bool'; v: boolean }
    | { k: 'str'; v: string }
    | { k: 'join'; parts: Expr[] }
    | { k: 'var'; name: string }
    | { k: 'bin'; op: BinOp; a: Expr; b: Expr }
    | { k: 'un'; op: 'neg' | 'not'; a: Expr }
    | { k: 'cond'; c: Expr; a: Expr; b: Expr }
    | { k: 'api'; fn: string; args: Expr[] }
    | { k: 'call'; name: string; args: Expr[] }
    | { k: 'enum'; type: EnumType; v: string }
  );

export type Stmt = Node &
  (
    | { k: 'set'; name: string; value: Expr }
    | { k: 'expr'; e: Expr }
    | { k: 'if'; cond: Expr; then: Stmt[]; else?: Stmt[] }
    | { k: 'while'; cond: Expr; body: Stmt[] }
    | { k: 'repeat'; count: Expr; body: Stmt[] }
    | { k: 'for'; name: string; from: Expr; to: Expr; body: Stmt[] }
    | { k: 'forKind'; name: string; kind: Expr; body: Stmt[] }
    | { k: 'break' }
    | { k: 'continue' }
    | { k: 'return'; value?: Expr }
    | { k: 'cpp'; code: string }
    | { k: 'comment'; text: string }
  );

export type Event = Node &
  (
    | { k: 'start'; body: Stmt[] }
    | { k: 'update'; body: Stmt[] }
    | { k: 'draw'; body: Stmt[] }
    | { k: 'every'; ms: number; body: Stmt[] }
    | { k: 'button'; button: string; pressed: boolean; body: Stmt[] }
    | { k: 'overlap'; a: string; b: string; sv: string; ov: string; body: Stmt[] }
    | { k: 'tile'; kind: string; tile: string; sv: string; col: string; row: string; body: Stmt[] }
    | { k: 'lifeZero'; body: Stmt[] }
  );

export interface Param {
  name: string;
  ty: Ty;
}

export interface Func extends Node {
  name: string;
  params: Param[];
  ret: Ty;
  body: Stmt[];
}

export interface Program {
  /** Global variables. Types are filled in by the type checker. */
  vars: Param[];
  funcs: Func[];
  events: Event[];
}

/** A problem found while making or checking the IR. */
export interface Diagnostic {
  level: 'error' | 'warning';
  /** Translation key. */
  key: string;
  params?: Record<string, string | number>;
  /** Block the problem belongs to. */
  id?: string;
}

export function emptyProgram(): Program {
  return { vars: [], funcs: [], events: [] };
}
