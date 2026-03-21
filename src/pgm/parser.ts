// ─── PGM Recursive Descent Parser ────────────────────────────────────────────
// Converts a Token[] produced by the lexer into a ProgramNode AST.

import type { Token, TokenType } from './lexer.ts';
import type {
  ASTNode,
  ProgramNode,
  VarDeclNode,
  FunctionDefNode,
  ElseIfClause,
  FunctionParam,
} from './ast.ts';

export interface ParseError {
  message: string;
  line: number;
  col: number;
}

export interface ParseResult {
  ast: ProgramNode;
  errors: ParseError[];
}

// ─── Parser class ─────────────────────────────────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos: number = 0;
  private errors: ParseError[] = [];

  constructor(tokens: Token[]) {
    // Filter out NEWLINE tokens for easier parsing (we use them only for error recovery)
    this.tokens = tokens;
  }

  // ── Token navigation ──────────────────────────────────────────────────────

  private peek(offset = 0): Token {
    let idx = this.pos;
    let skipped = 0;
    while (idx < this.tokens.length) {
      const t = this.tokens[idx];
      if (t.type === 'NEWLINE') { idx++; continue; }
      if (skipped === offset) return t;
      skipped++;
      idx++;
    }
    return this.tokens[this.tokens.length - 1] ?? { type: 'EOF', value: '', line: 0, col: 0 };
  }

  /** Peek without skipping newlines */
  private peekRaw(offset = 0): Token {
    const idx = this.pos + offset;
    return this.tokens[idx] ?? { type: 'EOF', value: '', line: 0, col: 0 };
  }

  private advance(): Token {
    while (this.pos < this.tokens.length && this.tokens[this.pos]!.type === 'NEWLINE') {
      this.pos++;
    }
    return this.tokens[this.pos++] ?? { type: 'EOF', value: '', line: 0, col: 0 };
  }

  private advanceRaw(): Token {
    return this.tokens[this.pos++] ?? { type: 'EOF', value: '', line: 0, col: 0 };
  }

  private check(...types: TokenType[]): boolean {
    return types.includes(this.peek().type);
  }

  private match(...types: TokenType[]): Token | null {
    if (types.includes(this.peek().type)) {
      return this.advance();
    }
    return null;
  }

  private expect(type: TokenType, errorMsg?: string): Token {
    if (this.peek().type === type) {
      return this.advance();
    }
    const tok = this.peek();
    this.recordError(errorMsg ?? `Expected ${type} but got '${tok.value}' (${tok.type})`, tok);
    return tok;
  }

  private recordError(msg: string, tok: Token): void {
    this.errors.push({ message: msg, line: tok.line, col: tok.col });
  }

  /** Skip to next newline or statement boundary for error recovery */
  private skipToNextStatement(): void {
    while (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos];
      if (!t) break;
      if (t.type === 'NEWLINE' || t.type === 'EOF') {
        this.pos++;
        break;
      }
      // Stop before block-ending keywords
      if (['ENDIF', 'ENDWHILE', 'NEXT', 'ENDFUNCTION', 'ENDSUB', 'ENDCLASS', 'ELSE', 'ELSEIF'].includes(t.type)) {
        break;
      }
      this.pos++;
    }
  }

  private skipNewlines(): void {
    while (this.pos < this.tokens.length && this.tokens[this.pos]!.type === 'NEWLINE') {
      this.pos++;
    }
  }

  // ── Top-level ─────────────────────────────────────────────────────────────

  parse(): ParseResult {
    const body: ASTNode[] = [];
    this.skipNewlines();
    while (!this.check('EOF', 'ENDOFFILE')) {
      this.skipNewlines();
      if (this.check('EOF', 'ENDOFFILE')) break;
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }
    return { ast: { type: 'Program', body }, errors: this.errors };
  }

  // ── Statement dispatch ────────────────────────────────────────────────────

  private parseStatement(): ASTNode | null {
    const tok = this.peek();

    try {
      switch (tok.type) {
        case 'REAL':
        case 'LONG':
        case 'INTEGER':
        case 'STRING_TYPE':
        case 'BIT':
        case 'ARRAY':
        case 'CHECKBOX':
        case 'ENUMDROPLIST':
          return this.parseVarDecl();

        case 'IF':      return this.parseIf();
        case 'WHILE':   return this.parseWhile();
        case 'FOR':     return this.parseFor();
        case 'FUNCTION': return this.parseFunctionDef();
        case 'CLASS':   return this.parseClassDef();
        case 'SUB':     return this.parseSubDef();
        case 'RETURN':  return this.parseReturn();
        case 'PAGELABEL': return this.parsePageLabel();
        case 'TEXTLABEL': return this.parseTextLabel();
        case 'INCLUDE': {
          const t = this.advance();
          return { type: 'Include', filename: t.value };
        }
        case 'ENDOFFILE': {
          this.advance();
          return { type: 'EndOfFile' };
        }

        default:
          return this.parseExpressionStatement();
      }
    } catch (_err) {
      this.skipToNextStatement();
      return null;
    }
  }

  // ── Variable declaration ──────────────────────────────────────────────────
  // Syntax: TYPE IDENT suffix? unitSpec? attrBlock? (= expr)?
  // suffix   = '*' | '@'
  // unitSpec = '(' STRING ',' STRING ')'
  // attrBlock = '{' attr (',' attr)* '}'
  // For EnumDropList: enumBlock = '{' ident (',' ident)* '}'

  private parseVarDecl(): VarDeclNode {
    const typeTok = this.advance();
    const dataType = typeTok.value.toLowerCase();

    const nameTok = this.expect('IDENTIFIER');
    const name = nameTok.value;

    let visible = false;
    let readOnly = false;
    let units: [string, string] | undefined;

    // Check for immediate suffix in raw token stream (no newline skip needed here)
    // The lexer already emitted STAR_SUFFIX/AT_SUFFIX right after IDENTIFIER
    if (this.peek().type === 'STAR_SUFFIX') {
      this.advance();
      visible = true;
      // Optional unit spec: ("quantityType", "displayUnit")
      if (this.peek().type === 'LPAREN') {
        units = this.parseUnitSpec();
      }
    } else if (this.peek().type === 'AT_SUFFIX') {
      this.advance();
      readOnly = true;
      if (this.peek().type === 'LPAREN') {
        units = this.parseUnitSpec();
      }
    }

    let minVal: number | undefined;
    let maxVal: number | undefined;
    let comment: string | undefined;
    let enumOptions: string[] | undefined;

    // Enum options block for EnumDropList: { A, B, C }
    if (dataType === 'enumdroplist' && this.peek().type === 'LBRACE') {
      enumOptions = this.parseEnumOptions();
    }

    // Attribute block: { Comment("..."), Min(n), Max(n) }
    if (this.peek().type === 'LBRACE') {
      const attrs = this.parseAttrBlock();
      comment = attrs.comment;
      minVal = attrs.min;
      maxVal = attrs.max;
      if (attrs.enumOptions) enumOptions = attrs.enumOptions;
    }

    // Optional initial value: = expr
    let initialValue: ASTNode | undefined;
    if (this.peek().type === 'ASSIGN') {
      this.advance(); // consume =
      initialValue = this.parseExpr();
    }

    return {
      type: 'VarDecl',
      dataType,
      name,
      visible,
      readOnly,
      units,
      minVal,
      maxVal,
      comment,
      enumOptions,
      initialValue,
    };
  }

  private parseUnitSpec(): [string, string] {
    this.advance(); // consume (
    const qty = this.peek().type === 'STRING' ? this.advance().value : '';
    this.match('COMMA');
    const disp = this.peek().type === 'STRING' ? this.advance().value : '';
    this.expect('RPAREN');
    return [qty, disp];
  }

  private parseAttrBlock(): { comment?: string; min?: number; max?: number; enumOptions?: string[] } {
    this.advance(); // consume {
    const result: { comment?: string; min?: number; max?: number; enumOptions?: string[] } = {};
    const opts: string[] = [];
    let isAttr = false;

    // Peek ahead to see if this is an attr block or enum options
    // attr block: first token is identifier followed by LPAREN
    const first = this.peek();
    if (first.type === 'IDENTIFIER' && this.peek(1).type === 'LPAREN') {
      const upper = first.value.toUpperCase();
      if (upper === 'COMMENT' || upper === 'MIN' || upper === 'MAX') {
        isAttr = true;
      }
    }

    if (isAttr) {
      while (!this.check('RBRACE', 'EOF')) {
        const attrName = this.advance().value.toUpperCase();
        this.expect('LPAREN');
        if (attrName === 'COMMENT') {
          result.comment = this.peek().type === 'STRING' ? this.advance().value : '';
        } else if (attrName === 'MIN') {
          const expr = this.parseExpr();
          if (expr.type === 'NumberLit') result.min = expr.value;
        } else if (attrName === 'MAX') {
          const expr = this.parseExpr();
          if (expr.type === 'NumberLit') result.max = expr.value;
        }
        this.expect('RPAREN');
        this.match('COMMA');
      }
    } else {
      // Enum options block
      while (!this.check('RBRACE', 'EOF')) {
        if (this.check('IDENTIFIER', 'STRING')) {
          opts.push(this.advance().value);
        }
        this.match('COMMA');
      }
      if (opts.length > 0) result.enumOptions = opts;
    }

    this.expect('RBRACE');
    return result;
  }

  private parseEnumOptions(): string[] {
    this.advance(); // consume {
    const opts: string[] = [];
    while (!this.check('RBRACE', 'EOF')) {
      if (this.check('IDENTIFIER', 'STRING')) {
        opts.push(this.advance().value);
      }
      this.match('COMMA');
    }
    this.expect('RBRACE');
    return opts;
  }

  // ── If statement ──────────────────────────────────────────────────────────
  // If ( expr ) body (ElseIf ( expr ) body)* (Else body)? EndIf

  private parseIf(): ASTNode {
    this.advance(); // consume IF
    this.expect('LPAREN');
    const condition = this.parseExpr();
    this.expect('RPAREN');

    const thenBody = this.parseBody(['ELSEIF', 'ELSE', 'ENDIF']);
    const elseIfs: ElseIfClause[] = [];
    let elseBody: ASTNode[] | undefined;

    while (this.check('ELSEIF')) {
      this.advance();
      this.expect('LPAREN');
      const cond = this.parseExpr();
      this.expect('RPAREN');
      const body = this.parseBody(['ELSEIF', 'ELSE', 'ENDIF']);
      elseIfs.push({ condition: cond, body });
    }

    if (this.check('ELSE')) {
      this.advance();
      elseBody = this.parseBody(['ENDIF']);
    }

    this.expect('ENDIF');

    return {
      type: 'If',
      condition,
      then: thenBody,
      elseIfs,
      else: elseBody,
    };
  }

  // ── While statement ───────────────────────────────────────────────────────

  private parseWhile(): ASTNode {
    this.advance(); // consume WHILE
    this.expect('LPAREN');
    const condition = this.parseExpr();
    this.expect('RPAREN');
    const body = this.parseBody(['ENDWHILE']);
    this.expect('ENDWHILE');
    return { type: 'While', condition, body };
  }

  // ── For statement ─────────────────────────────────────────────────────────
  // For i = fromExpr To toExpr (Step stepExpr)? body Next (i)?

  private parseFor(): ASTNode {
    this.advance(); // consume FOR
    const varTok = this.expect('IDENTIFIER');
    this.expect('ASSIGN');
    const from = this.parseExpr();
    this.expect('TO');
    const to = this.parseExpr();
    let step: ASTNode | undefined;
    if (this.check('STEP')) {
      this.advance();
      step = this.parseExpr();
    }
    const body = this.parseBody(['NEXT']);
    this.expect('NEXT');
    this.match('IDENTIFIER'); // optional: Next i — consume loop var name
    return { type: 'For', var: varTok.value, from, to, step, body };
  }

  // ── Function/Sub/Class definitions ────────────────────────────────────────

  private parseFunctionDef(): FunctionDefNode {
    this.advance(); // consume FUNCTION
    const nameTok = this.expect('IDENTIFIER');
    const params = this.parseParamList();
    const body = this.parseBody(['ENDFUNCTION']);
    this.expect('ENDFUNCTION');
    return { type: 'FunctionDef', name: nameTok.value, params, body };
  }

  private parseSubDef(): ASTNode {
    this.advance(); // consume SUB
    const nameTok = this.expect('IDENTIFIER');
    // Optional param list
    let params: FunctionParam[] = [];
    if (this.check('LPAREN')) {
      params = this.parseParamList();
    }
    const body = this.parseBody(['ENDSUB']);
    this.expect('ENDSUB');
    // Store params on body if needed; SubDef doesn't have params in spec so we drop them
    void params;
    return { type: 'SubDef', name: nameTok.value, body };
  }

  private parseClassDef(): ASTNode {
    this.advance(); // consume CLASS
    const nameTok = this.expect('IDENTIFIER');
    const fields: VarDeclNode[] = [];
    const methods: FunctionDefNode[] = [];

    this.skipNewlines();
    while (!this.check('ENDCLASS', 'EOF')) {
      this.skipNewlines();
      if (this.check('ENDCLASS', 'EOF')) break;
      if (this.check('FUNCTION')) {
        methods.push(this.parseFunctionDef());
      } else if (this.check('REAL', 'LONG', 'INTEGER', 'STRING_TYPE', 'BIT', 'ARRAY', 'CHECKBOX', 'ENUMDROPLIST')) {
        fields.push(this.parseVarDecl());
      } else {
        const t = this.peek();
        this.recordError(`Unexpected token in class body: ${t.value}`, t);
        this.skipToNextStatement();
      }
    }

    this.expect('ENDCLASS');
    return { type: 'ClassDef', name: nameTok.value, fields, methods };
  }

  private parseParamList(): FunctionParam[] {
    if (!this.check('LPAREN')) return [];
    this.advance(); // consume (
    const params: FunctionParam[] = [];
    while (!this.check('RPAREN', 'EOF')) {
      // Optional type keyword before param name
      let paramType = 'real';
      if (this.check('REAL', 'LONG', 'INTEGER', 'STRING_TYPE', 'BIT')) {
        paramType = this.advance().value.toLowerCase();
      }
      const nameTok = this.expect('IDENTIFIER');
      params.push({ name: nameTok.value, type: paramType });
      this.match('COMMA');
    }
    this.expect('RPAREN');
    return params;
  }

  // ── Utility: parse a body until one of the given stop tokens ─────────────

  private parseBody(stopAt: TokenType[]): ASTNode[] {
    const body: ASTNode[] = [];
    this.skipNewlines();
    while (!this.check(...stopAt) && !this.check('EOF')) {
      this.skipNewlines();
      if (this.check(...stopAt) || this.check('EOF')) break;
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }
    return body;
  }

  // ── Return ────────────────────────────────────────────────────────────────

  private parseReturn(): ASTNode {
    this.advance(); // consume RETURN
    // If the next token is on the same logical line and is an expression starter, parse it
    const next = this.peek();
    if (next.type !== 'NEWLINE' && next.type !== 'EOF' &&
        !['ENDIF', 'ENDWHILE', 'NEXT', 'ENDFUNCTION', 'ENDSUB', 'ENDCLASS', 'ELSE', 'ELSEIF'].includes(next.type)) {
      const value = this.parseExpr();
      return { type: 'Return', value };
    }
    return { type: 'Return' };
  }

  // ── PageLabel / TextLabel ─────────────────────────────────────────────────

  private parsePageLabel(): ASTNode {
    this.advance(); // consume PAGELABEL
    const label = this.peek().type === 'STRING' ? this.advance().value : this.advance().value;
    return { type: 'PageLabel', label };
  }

  private parseTextLabel(): ASTNode {
    this.advance(); // consume TEXTLABEL
    const columns: string[] = [];
    // Collect comma-separated strings / identifiers
    while (!this.checkRawNewlineOrEOF()) {
      if (this.check('STRING')) {
        columns.push(this.advance().value);
      } else if (this.check('IDENTIFIER')) {
        columns.push(this.advance().value);
      } else if (this.check('COMMA')) {
        columns.push('');
        this.advance();
        continue;
      } else {
        break;
      }
      if (!this.match('COMMA')) break;
    }
    return { type: 'TextLabel', columns };
  }

  private checkRawNewlineOrEOF(): boolean {
    const t = this.peekRaw();
    return t.type === 'NEWLINE' || t.type === 'EOF';
  }

  // ── Expression statement / assignment ─────────────────────────────────────

  private parseExpressionStatement(): ASTNode | null {
    const expr = this.parseExpr();

    // Check for assignment: lvalue = rvalue
    if (this.check('ASSIGN')) {
      this.advance(); // consume =
      const value = this.parseExpr();

      // Convert to Assign or TagWrite
      if (expr.type === 'Identifier') {
        return { type: 'Assign', target: expr, value };
      }
      if (expr.type === 'TagRead') {
        return { type: 'Assign', target: { type: 'TagWrite', tagPath: expr.tagPath, value }, value };
      }
      // Fallback
      return { type: 'Assign', target: expr, value };
    }

    return expr;
  }

  // ── Expression parsing (recursive descent) ───────────────────────────────
  // expr → orExpr
  // orExpr → andExpr ('Or' andExpr)*
  // andExpr → comparison ('And' comparison)*
  // comparison → addition (('<'|'>'|'<='|'>='|'=='|'!=') addition)*
  // addition → term (('+'|'-') term)*
  // term → factor (('*'|'/') factor)*
  // factor → unary ('^' unary)*
  // unary → '-' unary | 'Not' unary | primary
  // primary → NUMBER | STRING | BOOLEAN | IDENTIFIER | call | tagAccess | '(' expr ')'

  private parseExpr(): ASTNode {
    return this.parseOr();
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.check('OR')) {
      const op = this.advance().value;
      const right = this.parseAnd();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseComparison();
    while (this.check('AND')) {
      const op = this.advance().value;
      const right = this.parseComparison();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parseAddition();
    while (this.check('LT', 'GT', 'LEQ', 'GEQ', 'EQ', 'NEQ')) {
      const op = this.advance().value;
      const right = this.parseAddition();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  private parseAddition(): ASTNode {
    let left = this.parseTerm();
    while (this.check('PLUS', 'MINUS')) {
      const op = this.advance().value;
      const right = this.parseTerm();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  private parseTerm(): ASTNode {
    let left = this.parseFactor();
    while (this.check('STAR', 'SLASH')) {
      const op = this.advance().value;
      const right = this.parseFactor();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  private parseFactor(): ASTNode {
    let left = this.parseUnary();
    while (this.check('CARET')) {
      const op = this.advance().value;
      const right = this.parseUnary();
      left = { type: 'BinaryOp', op, left, right };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.check('MINUS')) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryOp', op: '-', operand };
    }
    if (this.check('NOT')) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryOp', op: 'not', operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const tok = this.peek();

    // Number literal
    if (tok.type === 'NUMBER') {
      this.advance();
      return { type: 'NumberLit', value: parseFloat(tok.value) };
    }

    // String literal
    if (tok.type === 'STRING') {
      this.advance();
      return { type: 'StringLit', value: tok.value };
    }

    // Boolean literal
    if (tok.type === 'BOOLEAN') {
      this.advance();
      return { type: 'BoolLit', value: tok.value === 'true' };
    }

    // Tag access: [ tagPath ] optional ( "unit" )
    if (tok.type === 'TAG_OPEN') {
      return this.parseTagAccess();
    }

    // Parenthesised expression
    if (tok.type === 'LPAREN') {
      this.advance();
      const expr = this.parseExpr();
      this.expect('RPAREN');
      return expr;
    }

    // Identifier: might be a call or plain variable reference
    if (tok.type === 'IDENTIFIER') {
      this.advance();
      if (this.check('LPAREN')) {
        // Function call
        const args = this.parseArgList();
        return { type: 'Call', name: tok.value, args };
      }
      // Member access (e.g. SDB.GetMW) — treat as call if followed by . IDENT (
      if (this.checkRaw('.')) {
        const dot = this.advanceRaw(); void dot;
        const member = this.peek();
        if (member.type === 'IDENTIFIER') {
          this.advance();
          const fullName = `${tok.value}.${member.value}`;
          if (this.check('LPAREN')) {
            const args = this.parseArgList();
            return { type: 'Call', name: fullName, args };
          }
          return { type: 'Identifier', name: fullName };
        }
      }
      return { type: 'Identifier', name: tok.value };
    }

    // Fallback: return a dummy node and record error
    const errTok = this.peek();
    this.advance();
    this.recordError(`Unexpected token in expression: '${errTok.value}' (${errTok.type})`, errTok);
    return { type: 'NumberLit', value: 0 };
  }

  private checkRaw(char: string): boolean {
    return this.tokens[this.pos]?.value === char;
  }

  private parseTagAccess(): ASTNode {
    this.advance(); // consume TAG_OPEN [
    // Next should be IDENTIFIER (the tag path, already extracted by lexer from quoted string)
    const pathTok = this.peek();
    let tagPath = '';
    if (pathTok.type === 'IDENTIFIER' || pathTok.type === 'STRING') {
      tagPath = this.advance().value;
    }
    this.expect('TAG_CLOSE'); // ]

    // Optional unit: ("unit")
    let unit: string | undefined;
    if (this.check('LPAREN')) {
      this.advance();
      if (this.check('STRING')) unit = this.advance().value;
      this.expect('RPAREN');
    }

    return { type: 'TagRead', tagPath, unit };
  }

  private parseArgList(): ASTNode[] {
    this.advance(); // consume (
    const args: ASTNode[] = [];
    while (!this.check('RPAREN', 'EOF')) {
      args.push(this.parseExpr());
      if (!this.match('COMMA')) break;
    }
    this.expect('RPAREN');
    return args;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse PGM source tokens into an AST.
 * Parse errors are collected and returned alongside the AST — they are never thrown.
 */
export function parse(tokens: Token[]): ParseResult {
  const parser = new Parser(tokens);
  return parser.parse();
}
