// ─── PGM Lexer ───────────────────────────────────────────────────────────────
// Tokenizes PGM (Programmable Module) source code.

export type TokenType =
  // Literals
  | 'NUMBER' | 'STRING' | 'BOOLEAN'
  // Types / declarations
  | 'REAL' | 'LONG' | 'INTEGER' | 'STRING_TYPE' | 'BIT' | 'ARRAY'
  | 'CHECKBOX' | 'ENUMDROPLIST'
  // Control flow
  | 'IF' | 'ELSE' | 'ELSEIF' | 'ENDIF'
  | 'WHILE' | 'ENDWHILE'
  | 'FOR' | 'TO' | 'NEXT' | 'STEP'
  | 'FUNCTION' | 'ENDFUNCTION' | 'RETURN'
  | 'CLASS' | 'ENDCLASS'
  | 'SUB' | 'ENDSUB'
  // UI layout
  | 'PAGELABEL' | 'TEXTLABEL'
  // Arithmetic operators
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH' | 'CARET'
  // Comparison operators
  | 'EQ' | 'NEQ' | 'LT' | 'GT' | 'LEQ' | 'GEQ'
  // Assignment
  | 'ASSIGN'
  // Boolean operators
  | 'AND' | 'OR' | 'NOT'
  // Delimiters
  | 'LPAREN' | 'RPAREN' | 'LBRACKET' | 'RBRACKET' | 'COMMA'
  | 'LBRACE' | 'RBRACE' | 'COLON'
  // Special PGM markers
  | 'STAR_SUFFIX'  // * visibility marker (after identifier, no space)
  | 'AT_SUFFIX'    // @ read-only marker (after identifier, no space)
  | 'INCLUDE'      // >>filename directive
  | 'ENDOFFILE'    // $ or EndFile
  | 'TAG_OPEN'     // [ — begin tag expression
  | 'TAG_CLOSE'    // ] — end tag expression
  // Meta
  | 'IDENTIFIER' | 'COMMENT' | 'NEWLINE' | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

// ─── Keyword map (upper-cased key → token type) ──────────────────────────────

const KEYWORDS: Record<string, TokenType> = {
  REAL: 'REAL',
  LONG: 'LONG',
  INTEGER: 'INTEGER',
  STRING: 'STRING_TYPE',
  BIT: 'BIT',
  ARRAY: 'ARRAY',
  CHECKBOX: 'CHECKBOX',
  ENUMDROPLIST: 'ENUMDROPLIST',
  IF: 'IF',
  ELSE: 'ELSE',
  ELSEIF: 'ELSEIF',
  ENDIF: 'ENDIF',
  WHILE: 'WHILE',
  ENDWHILE: 'ENDWHILE',
  FOR: 'FOR',
  TO: 'TO',
  NEXT: 'NEXT',
  STEP: 'STEP',
  FUNCTION: 'FUNCTION',
  ENDFUNCTION: 'ENDFUNCTION',
  RETURN: 'RETURN',
  CLASS: 'CLASS',
  ENDCLASS: 'ENDCLASS',
  SUB: 'SUB',
  ENDSUB: 'ENDSUB',
  PAGELABEL: 'PAGELABEL',
  TEXTLABEL: 'TEXTLABEL',
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  TRUE: 'BOOLEAN',
  FALSE: 'BOOLEAN',
  ENDFILE: 'ENDOFFILE',
};

// ─── Lexer class ─────────────────────────────────────────────────────────────

class Lexer {
  private src: string;
  private pos: number = 0;
  private line: number = 1;
  private col: number = 1;
  private lastNonWsType: TokenType | null = null;
  private inTagExpr: boolean = false;
  /** True if whitespace was skipped before the current token */
  private hadPrecedingWS: boolean = false;

  constructor(source: string) {
    this.src = source;
  }

  private peek(offset = 0): string {
    return this.src[this.pos + offset] ?? '';
  }

  private advance(): string {
    const ch = this.src[this.pos++] ?? '';
    if (ch === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  private makeToken(type: TokenType, value: string, line: number, col: number): Token {
    if (type !== 'COMMENT' && type !== 'NEWLINE') {
      this.lastNonWsType = type;
    }
    return { type, value, line, col };
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.src.length) {
      const tok = this.nextToken();
      if (tok === null) break;
      // Exclude COMMENT tokens from output
      if (tok.type !== 'COMMENT') {
        tokens.push(tok);
      }
    }

    tokens.push({ type: 'EOF', value: '', line: this.line, col: this.col });
    return tokens;
  }

  private nextToken(): Token | null {
    // Skip horizontal whitespace — track whether any was present
    const wsStart = this.pos;
    while (this.pos < this.src.length && (this.peek() === ' ' || this.peek() === '\t' || this.peek() === '\r')) {
      this.advance();
    }
    this.hadPrecedingWS = this.pos > wsStart;

    if (this.pos >= this.src.length) return null;

    const startLine = this.line;
    const startCol = this.col;
    const ch = this.peek();

    // NEWLINE
    if (ch === '\n') {
      this.advance();
      this.inTagExpr = false;
      return this.makeToken('NEWLINE', '\n', startLine, startCol);
    }

    // COMMENT: ; until end of line
    if (ch === ';') {
      let comment = '';
      while (this.pos < this.src.length && this.peek() !== '\n') {
        comment += this.advance();
      }
      return this.makeToken('COMMENT', comment, startLine, startCol);
    }

    // ENDOFFILE: $
    if (ch === '$') {
      this.advance();
      return this.makeToken('ENDOFFILE', '$', startLine, startCol);
    }

    // INCLUDE: >>filename
    if (ch === '>' && this.peek(1) === '>') {
      this.advance(); this.advance(); // consume >>
      let filename = '';
      while (this.pos < this.src.length && this.peek() !== '\n' && this.peek() !== '\r') {
        filename += this.advance();
      }
      return this.makeToken('INCLUDE', filename.trim(), startLine, startCol);
    }

    // TAG_OPEN: [
    if (ch === '[') {
      this.advance();
      this.inTagExpr = true;
      return this.makeToken('TAG_OPEN', '[', startLine, startCol);
    }

    // TAG_CLOSE / RBRACKET: ]
    if (ch === ']') {
      this.advance();
      if (this.inTagExpr) {
        this.inTagExpr = false;
        return this.makeToken('TAG_CLOSE', ']', startLine, startCol);
      }
      return this.makeToken('RBRACKET', ']', startLine, startCol);
    }

    // STRING: "..."
    if (ch === '"') {
      this.advance(); // consume opening "
      let str = '';
      while (this.pos < this.src.length && this.peek() !== '"' && this.peek() !== '\n') {
        str += this.advance();
      }
      if (this.peek() === '"') this.advance(); // consume closing "

      // Inside tag expression: emit as IDENTIFIER (the tag path)
      if (this.inTagExpr) {
        return this.makeToken('IDENTIFIER', str, startLine, startCol);
      }
      return this.makeToken('STRING', str, startLine, startCol);
    }

    // NUMBER: optional leading dot, digits, optional decimal, optional exponent
    if ((ch >= '0' && ch <= '9') || (ch === '.' && this.peek(1) >= '0' && this.peek(1) <= '9')) {
      let num = '';
      while (this.pos < this.src.length && ((this.peek() >= '0' && this.peek() <= '9') || this.peek() === '.')) {
        num += this.advance();
      }
      // Exponent
      if (this.peek() === 'e' || this.peek() === 'E') {
        num += this.advance();
        if (this.peek() === '+' || this.peek() === '-') num += this.advance();
        while (this.pos < this.src.length && this.peek() >= '0' && this.peek() <= '9') {
          num += this.advance();
        }
      }
      return this.makeToken('NUMBER', num, startLine, startCol);
    }

    // IDENTIFIER or keyword
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let ident = '';
      while (
        this.pos < this.src.length &&
        ((this.peek() >= 'a' && this.peek() <= 'z') ||
          (this.peek() >= 'A' && this.peek() <= 'Z') ||
          (this.peek() >= '0' && this.peek() <= '9') ||
          this.peek() === '_')
      ) {
        ident += this.advance();
      }

      const upper = ident.toUpperCase();

      // EndFile keyword (case-insensitive)
      if (upper === 'ENDFILE') {
        return this.makeToken('ENDOFFILE', ident, startLine, startCol);
      }

      // Check keywords
      const kwType = KEYWORDS[upper];
      if (kwType) {
        // Boolean literal: keep original case for value
        const val = (kwType === 'BOOLEAN') ? upper.toLowerCase() : ident;
        const tok = this.makeToken(kwType, val, startLine, startCol);

        // After a keyword, * or @ can still be suffix for types like STRING
        // Only check suffix if it's a type keyword
        return tok;
      }

      // Plain identifier — check for immediate * or @ suffix (no whitespace)
      const identTok = this.makeToken('IDENTIFIER', ident, startLine, startCol);

      if (this.peek() === '*') {
        // Return identifier first, next call will return STAR_SUFFIX
        // We can't return two tokens at once; peek ahead and handle it
        // Actually, we emit IDENTIFIER here and check suffix in the next iteration.
        // To do this correctly, we handle suffix as the NEXT token.
        return identTok;
      }
      if (this.peek() === '@') {
        return identTok;
      }

      return identTok;
    }

    // @ — after identifier with NO preceding whitespace → AT_SUFFIX; otherwise standalone
    if (ch === '@') {
      this.advance();
      if (!this.hadPrecedingWS && this.lastNonWsType === 'IDENTIFIER') {
        return this.makeToken('AT_SUFFIX', '@', startLine, startCol);
      }
      return this.makeToken('AT_SUFFIX', '@', startLine, startCol);
    }

    // * — after identifier with NO preceding whitespace → STAR_SUFFIX; otherwise STAR
    if (ch === '*') {
      this.advance();
      if (!this.hadPrecedingWS && this.lastNonWsType === 'IDENTIFIER') {
        return this.makeToken('STAR_SUFFIX', '*', startLine, startCol);
      }
      return this.makeToken('STAR', '*', startLine, startCol);
    }

    // Two-char operators
    if (ch === '<' && this.peek(1) === '=') { this.advance(); this.advance(); return this.makeToken('LEQ', '<=', startLine, startCol); }
    if (ch === '>' && this.peek(1) === '=') { this.advance(); this.advance(); return this.makeToken('GEQ', '>=', startLine, startCol); }
    if (ch === '!' && this.peek(1) === '=') { this.advance(); this.advance(); return this.makeToken('NEQ', '!=', startLine, startCol); }
    if (ch === '<' && this.peek(1) === '>') { this.advance(); this.advance(); return this.makeToken('NEQ', '<>', startLine, startCol); }
    if (ch === '=' && this.peek(1) === '=') { this.advance(); this.advance(); return this.makeToken('EQ', '==', startLine, startCol); }

    // Single-char operators/delimiters
    const single: Record<string, TokenType> = {
      '+': 'PLUS', '-': 'MINUS', '/': 'SLASH', '^': 'CARET',
      '=': 'ASSIGN', '<': 'LT', '>': 'GT',
      '(': 'LPAREN', ')': 'RPAREN',
      ',': 'COMMA', ':': 'COLON',
      '{': 'LBRACE', '}': 'RBRACE',
    };
    if (ch in single) {
      this.advance();
      return this.makeToken(single[ch]!, ch, startLine, startCol);
    }

    // Unknown character — skip
    this.advance();
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Tokenize PGM source code.
 * Returns all tokens except COMMENTs, with accurate line/col info.
 * The final token is always EOF.
 */
export function lex(source: string): Token[] {
  const lexer = new Lexer(source);
  return lexer.tokenize();
}
