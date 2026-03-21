// ─── PGM Interpreter ─────────────────────────────────────────────────────────
// Walks the AST produced by the parser and executes PGM programs.

import type {
  ASTNode,
  ProgramNode,
  VarDeclNode,
  FunctionDefNode,
  SubDefNode,
  ClassDefNode,
} from './ast.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PGMValue = number | string | boolean | null;

export interface TagResolver {
  getTag(tagPath: string, unit?: string): number | string | boolean | null;
  setTag(tagPath: string, value: number | string | boolean): boolean;
  getAllTagPaths(): string[];
}

export interface VarSpec {
  name: string;
  dataType: string;
  visible: boolean;
  readOnly: boolean;
  displayUnit?: string;
  quantityType?: string;
  min?: number;
  max?: number;
  comment?: string;
  enumOptions?: string[];
}

// ─── Control-flow signals (thrown internally, caught by interpreter) ──────────

class ReturnSignal {
  readonly value: PGMValue;
  constructor(value: PGMValue) { this.value = value; }
}

export class PGMRuntimeError extends Error {
  constructor(message: string) { super(message); this.name = 'PGMRuntimeError'; }
}

// ─── Built-in functions ───────────────────────────────────────────────────────

function formatNumber(value: number, fmt: string): string {
  const m = fmt.match(/\.(\d+|#+)/);
  const decimals = m ? m[1]!.length : 2;
  return value.toFixed(decimals);
}

type BuiltinFn = (args: PGMValue[]) => PGMValue;

const BUILTINS: Record<string, BuiltinFn> = {
  // Math
  Abs:   (a) => Math.abs(a[0] as number),
  Sqrt:  (a) => Math.sqrt(a[0] as number),
  Log:   (a) => Math.log(a[0] as number),
  Log10: (a) => Math.log10(a[0] as number),
  Exp:   (a) => Math.exp(a[0] as number),
  Sin:   (a) => Math.sin(a[0] as number),
  Cos:   (a) => Math.cos(a[0] as number),
  Tan:   (a) => Math.tan(a[0] as number),
  Asin:  (a) => Math.asin(a[0] as number),
  Acos:  (a) => Math.acos(a[0] as number),
  Atan:  (a) => Math.atan(a[0] as number),
  Atan2: (a) => Math.atan2(a[0] as number, a[1] as number),
  Min:   (a) => Math.min(a[0] as number, a[1] as number),
  Max:   (a) => Math.max(a[0] as number, a[1] as number),
  Int:   (a) => Math.trunc(a[0] as number),
  Round: (a) => Math.round(a[0] as number),
  Mod:   (a) => (a[0] as number) % (a[1] as number),
  IIf:   (a) => (a[0] ? a[1] : a[2]) ?? null,
  Pow:   (a) => Math.pow(a[0] as number, a[1] as number),

  // String
  Str:    (a) => String(a[0] ?? ''),
  Val:    (a) => parseFloat(a[0] as string) || 0,
  Len:    (a) => (a[0] as string).length,
  Left:   (a) => (a[0] as string).slice(0, a[1] as number),
  Right:  (a) => (a[0] as string).slice(-(a[1] as number)),
  Mid:    (a) => (a[0] as string).slice((a[1] as number) - 1, (a[1] as number) - 1 + (a[2] as number)),
  Trim:   (a) => (a[0] as string).trim(),
  Upper:  (a) => (a[0] as string).toUpperCase(),
  Lower:  (a) => (a[0] as string).toLowerCase(),
  Format: (a) => formatNumber(a[0] as number, a[1] as string),
};

// Case-insensitive lookup
function lookupBuiltin(name: string): BuiltinFn | undefined {
  // Exact match first
  if (BUILTINS[name]) return BUILTINS[name];
  // Case-insensitive
  const upper = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  if (BUILTINS[upper]) return BUILTINS[upper];
  const found = Object.keys(BUILTINS).find(k => k.toLowerCase() === name.toLowerCase());
  return found ? BUILTINS[found] : undefined;
}

// ─── Interpreter ──────────────────────────────────────────────────────────────

export class PGMInterpreter {
  private globalScope: Map<string, PGMValue> = new Map();
  private scopeStack: Map<string, PGMValue>[] = [];
  private varMetadata: Map<string, VarSpec> = new Map();
  private functions: Map<string, FunctionDefNode> = new Map();
  private subs: Map<string, SubDefNode> = new Map();
  private callDepth: number = 0;
  private warnings: string[] = [];
  private tagResolver: TagResolver;

  constructor(tagResolver: TagResolver) {
    this.tagResolver = tagResolver;
    this.scopeStack = [this.globalScope];
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Execute a compiled program, optionally running a specific trigger sub first */
  execute(ast: ProgramNode, triggerSub?: string): void {
    // First pass: register functions, subs, and class defs
    this.registerDefinitions(ast);
    // Execute top-level statements
    for (const node of ast.body) {
      if (node.type === 'FunctionDef' || node.type === 'SubDef' || node.type === 'ClassDef') continue;
      this.execNode(node);
    }
    // Run trigger sub if specified
    if (triggerSub) {
      this.executeSub(triggerSub);
    }
  }

  /** Execute a named subroutine by name */
  executeSub(subName: string): void {
    const sub = this.subs.get(subName) ?? this.subs.get(subName.toLowerCase());
    if (!sub) return; // silent: sub may not be defined
    this.callDepth++;
    if (this.callDepth > 500) {
      this.callDepth--;
      throw new PGMRuntimeError(`Stack overflow: maximum call depth (500) exceeded at sub '${subName}'`);
    }
    this.pushScope();
    try {
      for (const stmt of sub.body) {
        this.execNode(stmt);
      }
    } catch (e) {
      if (!(e instanceof ReturnSignal)) throw e;
    } finally {
      this.popScope();
      this.callDepth--;
    }
  }

  /** Get the current value of a user-defined variable */
  getVariable(name: string): PGMValue | undefined {
    return this.lookupVar(name);
  }

  /** Set a user-defined variable from the Access Window */
  setVariable(name: string, value: PGMValue): void {
    this.setVarInScope(name, value);
  }

  /** Return all variables with the * (visible) suffix */
  getVisibleVariables(): VarSpec[] {
    return Array.from(this.varMetadata.values()).filter(v => v.visible || v.readOnly);
  }

  /** Accumulated warnings from the last run */
  getWarnings(): string[] {
    return [...this.warnings];
  }

  clearWarnings(): void {
    this.warnings = [];
  }

  // ── Scope management ────────────────────────────────────────────────────────

  private pushScope(): void {
    this.scopeStack.push(new Map());
  }

  private popScope(): void {
    if (this.scopeStack.length > 1) this.scopeStack.pop();
  }

  private get currentScope(): Map<string, PGMValue> {
    return this.scopeStack[this.scopeStack.length - 1]!;
  }

  private lookupVar(name: string): PGMValue | undefined {
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      const scope = this.scopeStack[i]!;
      if (scope.has(name)) return scope.get(name) ?? null;
    }
    return undefined;
  }

  private setVarInScope(name: string, value: PGMValue): void {
    // Update existing variable in whichever scope it lives in
    for (let i = this.scopeStack.length - 1; i >= 0; i--) {
      const scope = this.scopeStack[i]!;
      if (scope.has(name)) {
        scope.set(name, value);
        return;
      }
    }
    // New variable goes in current scope
    this.currentScope.set(name, value);
  }

  // ── Definition registration ────────────────────────────────────────────────

  private registerDefinitions(ast: ProgramNode): void {
    for (const node of ast.body) {
      if (node.type === 'FunctionDef') {
        this.functions.set(node.name, node);
        this.functions.set(node.name.toLowerCase(), node);
      } else if (node.type === 'SubDef') {
        this.subs.set(node.name, node);
        this.subs.set(node.name.toLowerCase(), node);
      }
    }
  }

  // ── Node execution ─────────────────────────────────────────────────────────

  private execNode(node: ASTNode): PGMValue {
    switch (node.type) {
      case 'Program':
        for (const stmt of node.body) this.execNode(stmt);
        return null;

      case 'VarDecl':
        return this.execVarDecl(node);

      case 'Assign':
        return this.execAssign(node.target, node.value);

      case 'If':
        return this.execIf(node);

      case 'While':
        return this.execWhile(node);

      case 'For':
        return this.execFor(node);

      case 'FunctionDef':
        this.functions.set(node.name, node);
        return null;

      case 'SubDef':
        this.subs.set(node.name, node);
        return null;

      case 'ClassDef':
        return this.execClassDef(node);

      case 'Return': {
        const val = node.value ? this.evalExpr(node.value) : null;
        throw new ReturnSignal(val);
      }

      case 'Include':
      case 'PageLabel':
      case 'TextLabel':
      case 'EndOfFile':
        return null;

      default:
        // Expression statements — evaluate but discard result
        return this.evalExpr(node);
    }
  }

  private execVarDecl(node: VarDeclNode): null {
    // Default values by type
    const defaults: Record<string, PGMValue> = {
      real: 0, long: 0, integer: 0, string: '', bit: false,
      array: null, checkbox: false, enumdroplist: '',
    };
    const defaultVal: PGMValue = defaults[node.dataType] ?? null;
    const initialVal = node.initialValue ? this.evalExpr(node.initialValue) : defaultVal;

    this.currentScope.set(node.name, initialVal);

    // Register metadata for visible/readOnly variables
    if (node.visible || node.readOnly) {
      this.varMetadata.set(node.name, {
        name: node.name,
        dataType: node.dataType,
        visible: node.visible,
        readOnly: node.readOnly,
        quantityType: node.units?.[0],
        displayUnit: node.units?.[1],
        min: node.minVal,
        max: node.maxVal,
        comment: node.comment,
        enumOptions: node.enumOptions,
      });
    }

    return null;
  }

  private execAssign(target: ASTNode, valueNode: ASTNode): null {
    const value = this.evalExpr(valueNode);

    if (target.type === 'Identifier') {
      this.setVarInScope(target.name, value);
    } else if (target.type === 'TagWrite') {
      if (value !== null) {
        const ok = this.tagResolver.setTag(target.tagPath, value as number | string | boolean);
        if (!ok) {
          this.warnings.push(`Tag write failed: ${target.tagPath} — tag may be read-only or not found`);
        }
      }
    } else if (target.type === 'TagRead') {
      if (value !== null) {
        this.tagResolver.setTag(target.tagPath, value as number | string | boolean);
      }
    }

    return null;
  }

  private execIf(node: ASTNode & { type: 'If' }): null {
    if (this.isTruthy(this.evalExpr(node.condition))) {
      for (const stmt of node.then) this.execNode(stmt);
      return null;
    }
    for (const clause of node.elseIfs) {
      if (this.isTruthy(this.evalExpr(clause.condition))) {
        for (const stmt of clause.body) this.execNode(stmt);
        return null;
      }
    }
    if (node.else) {
      for (const stmt of node.else) this.execNode(stmt);
    }
    return null;
  }

  private execWhile(node: ASTNode & { type: 'While' }): null {
    let iterations = 0;
    while (this.isTruthy(this.evalExpr(node.condition))) {
      for (const stmt of node.body) this.execNode(stmt);
      iterations++;
      if (iterations > 1_000_000) {
        this.warnings.push('While loop exceeded 1,000,000 iterations — possible infinite loop');
        break;
      }
    }
    return null;
  }

  private execFor(node: ASTNode & { type: 'For' }): null {
    const from = this.evalExpr(node.from) as number;
    const to = this.evalExpr(node.to) as number;
    const step = node.step ? (this.evalExpr(node.step) as number) : 1;

    if (step === 0) {
      this.warnings.push(`For loop: step is 0, skipping`);
      return null;
    }

    this.setVarInScope(node.var, from);
    const ascending = step > 0;

    for (
      let v = from;
      ascending ? v <= to : v >= to;
      v += step
    ) {
      this.setVarInScope(node.var, v);
      for (const stmt of node.body) this.execNode(stmt);
    }

    return null;
  }

  private execClassDef(_node: ClassDefNode): null {
    // Class definitions are registered but not executed at declaration time
    return null;
  }

  // ── Expression evaluation ──────────────────────────────────────────────────

  private evalExpr(node: ASTNode): PGMValue {
    switch (node.type) {
      case 'NumberLit':  return node.value;
      case 'StringLit':  return node.value;
      case 'BoolLit':    return node.value;

      case 'Identifier': {
        const val = this.lookupVar(node.name);
        if (val === undefined) {
          // Not found — return 0 (no crash)
          return 0;
        }
        return val;
      }

      case 'TagRead': {
        const tagVal = this.tagResolver.getTag(node.tagPath, node.unit);
        if (tagVal === null) {
          this.warnings.push(`Tag not found: ${node.tagPath}`);
          return 0;
        }
        return tagVal;
      }

      case 'TagWrite':
        // TagWrite in expression context — read the tag
        return this.tagResolver.getTag(node.tagPath) ?? 0;

      case 'BinaryOp':   return this.evalBinaryOp(node);
      case 'UnaryOp':    return this.evalUnaryOp(node);
      case 'Call':       return this.evalCall(node);
      case 'Assign':
        this.execAssign(node.target, node.value);
        return this.evalExpr(node.target);

      default:
        return null;
    }
  }

  private evalBinaryOp(node: ASTNode & { type: 'BinaryOp' }): PGMValue {
    const left = this.evalExpr(node.left);
    const right = this.evalExpr(node.right);

    switch (node.op) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left ?? '') + String(right ?? '');
        }
        return (left as number) + (right as number);
      case '-':  return (left as number) - (right as number);
      case '*':  return (left as number) * (right as number);
      case '/': {
        const divisor = right as number;
        if (divisor === 0) {
          this.warnings.push('Division by zero — returning 0');
          return 0;
        }
        return (left as number) / divisor;
      }
      case '^':  return Math.pow(left as number, right as number);
      case '<':  return (left as number) < (right as number);
      case '>':  return (left as number) > (right as number);
      case '<=': return (left as number) <= (right as number);
      case '>=': return (left as number) >= (right as number);
      case '==': return left === right;
      case '!=':
      case '<>': return left !== right;
      case 'and':
      case 'And':
      case 'AND': return this.isTruthy(left) && this.isTruthy(right);
      case 'or':
      case 'Or':
      case 'OR':  return this.isTruthy(left) || this.isTruthy(right);
      default:
        this.warnings.push(`Unknown operator: ${node.op}`);
        return null;
    }
  }

  private evalUnaryOp(node: ASTNode & { type: 'UnaryOp' }): PGMValue {
    const val = this.evalExpr(node.operand);
    switch (node.op) {
      case '-':   return -(val as number);
      case 'not':
      case 'Not':
      case 'NOT': return !this.isTruthy(val);
      default:    return val;
    }
  }

  private evalCall(node: ASTNode & { type: 'Call' }): PGMValue {
    this.callDepth++;
    if (this.callDepth > 500) {
      this.callDepth--;
      throw new PGMRuntimeError(`Stack overflow: maximum call depth (500) exceeded calling '${node.name}'`);
    }

    try {
      const args = node.args.map(a => this.evalExpr(a));

      // Built-in?
      const builtin = lookupBuiltin(node.name);
      if (builtin) {
        try {
          return builtin(args);
        } catch (_e) {
          this.warnings.push(`Built-in function error in ${node.name}: ${String(_e)}`);
          return 0;
        }
      }

      // User-defined function?
      const fn = this.functions.get(node.name) ?? this.functions.get(node.name.toLowerCase());
      if (fn) {
        return this.callFunction(fn, args);
      }

      // Sub call (as expression — returns null)
      const sub = this.subs.get(node.name) ?? this.subs.get(node.name.toLowerCase());
      if (sub) {
        this.callSubInternal(sub);
        return null;
      }

      this.warnings.push(`Unknown function: ${node.name}`);
      return null;
    } finally {
      this.callDepth--;
    }
  }

  private callFunction(fn: FunctionDefNode, args: PGMValue[]): PGMValue {
    this.pushScope();
    // Bind parameters
    for (let i = 0; i < fn.params.length; i++) {
      const param = fn.params[i];
      if (param) this.currentScope.set(param.name, args[i] ?? null);
    }
    let returnVal: PGMValue = null;
    try {
      for (const stmt of fn.body) {
        this.execNode(stmt);
      }
    } catch (e) {
      if (e instanceof ReturnSignal) {
        returnVal = e.value;
      } else {
        throw e;
      }
    } finally {
      this.popScope();
    }
    return returnVal;
  }

  private callSubInternal(sub: SubDefNode): void {
    this.pushScope();
    try {
      for (const stmt of sub.body) {
        this.execNode(stmt);
      }
    } catch (e) {
      if (!(e instanceof ReturnSignal)) throw e;
    } finally {
      this.popScope();
    }
  }

  private isTruthy(val: PGMValue): boolean {
    if (val === null) return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    if (typeof val === 'string') return val.length > 0;
    return false;
  }
}
