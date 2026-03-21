// ─── PGM Lexer Unit Tests ─────────────────────────────────────────────────────
import { describe, test, expect } from 'vitest';
import { lex } from './lexer.ts';
import type { TokenType } from './lexer.ts';

// ─── P9-01 required test cases ────────────────────────────────────────────────

describe('P9-01 required tests', () => {
  test('lex variable declaration', () => {
    const tokens = lex('real myVar*("Qm","t/h")');
    expect(tokens.map(t => t.type)).toEqual([
      'REAL', 'IDENTIFIER', 'STAR_SUFFIX', 'LPAREN', 'STRING', 'COMMA', 'STRING', 'RPAREN', 'EOF',
    ]);
  });

  test('lex tag access', () => {
    const tokens = lex('["TK_001.Temp"]');
    expect(tokens.map(t => t.type)).toContain('IDENTIFIER'); // tag content
  });

  test('case insensitive keywords', () => {
    const t1 = lex('IF');
    const t2 = lex('if');
    const t3 = lex('If');
    expect(t1[0]!.type).toBe('IF');
    expect(t2[0]!.type).toBe('IF');
    expect(t3[0]!.type).toBe('IF');
  });
});

// ─── Token type coverage ──────────────────────────────────────────────────────

describe('Literal tokens', () => {
  test('integer number', () => {
    const tokens = lex('42');
    expect(tokens[0]!.type).toBe('NUMBER');
    expect(tokens[0]!.value).toBe('42');
  });

  test('float number', () => {
    const tokens = lex('1.5');
    expect(tokens[0]!.type).toBe('NUMBER');
  });

  test('scientific notation', () => {
    const tokens = lex('1.5e-3');
    expect(tokens[0]!.type).toBe('NUMBER');
    expect(tokens[0]!.value).toBe('1.5e-3');
  });

  test('leading dot float', () => {
    const tokens = lex('.5');
    expect(tokens[0]!.type).toBe('NUMBER');
    expect(tokens[0]!.value).toBe('.5');
  });

  test('string literal', () => {
    const tokens = lex('"hello world"');
    expect(tokens[0]!.type).toBe('STRING');
    expect(tokens[0]!.value).toBe('hello world');
  });

  test('boolean true', () => {
    const tokens = lex('True');
    expect(tokens[0]!.type).toBe('BOOLEAN');
    expect(tokens[0]!.value).toBe('true');
  });

  test('boolean false', () => {
    const tokens = lex('FALSE');
    expect(tokens[0]!.type).toBe('BOOLEAN');
    expect(tokens[0]!.value).toBe('false');
  });
});

// ─── Keywords ─────────────────────────────────────────────────────────────────

describe('Keyword tokens', () => {
  const keywordCases: Array<[string, TokenType]> = [
    ['real', 'REAL'],
    ['long', 'LONG'],
    ['integer', 'INTEGER'],
    ['string', 'STRING_TYPE'],
    ['bit', 'BIT'],
    ['array', 'ARRAY'],
    ['checkbox', 'CHECKBOX'],
    ['enumdroplist', 'ENUMDROPLIST'],
    ['if', 'IF'],
    ['else', 'ELSE'],
    ['elseif', 'ELSEIF'],
    ['endif', 'ENDIF'],
    ['while', 'WHILE'],
    ['endwhile', 'ENDWHILE'],
    ['for', 'FOR'],
    ['to', 'TO'],
    ['next', 'NEXT'],
    ['step', 'STEP'],
    ['function', 'FUNCTION'],
    ['endfunction', 'ENDFUNCTION'],
    ['return', 'RETURN'],
    ['class', 'CLASS'],
    ['endclass', 'ENDCLASS'],
    ['sub', 'SUB'],
    ['endsub', 'ENDSUB'],
    ['pagelabel', 'PAGELABEL'],
    ['textlabel', 'TEXTLABEL'],
    ['and', 'AND'],
    ['or', 'OR'],
    ['not', 'NOT'],
  ];

  for (const [src, expected] of keywordCases) {
    test(`keyword: ${src}`, () => {
      const tokens = lex(src);
      expect(tokens[0]!.type).toBe(expected);
    });
  }
});

// ─── Operators and delimiters ─────────────────────────────────────────────────

describe('Operators', () => {
  test('addition operator', () => {
    const tokens = lex('+');
    expect(tokens[0]!.type).toBe('PLUS');
  });

  test('subtraction operator', () => {
    const tokens = lex('-');
    expect(tokens[0]!.type).toBe('MINUS');
  });

  test('division operator', () => {
    const tokens = lex('/');
    expect(tokens[0]!.type).toBe('SLASH');
  });

  test('power operator', () => {
    const tokens = lex('^');
    expect(tokens[0]!.type).toBe('CARET');
  });

  test('less-than-or-equal', () => {
    const tokens = lex('<=');
    expect(tokens[0]!.type).toBe('LEQ');
  });

  test('greater-than-or-equal', () => {
    const tokens = lex('>=');
    expect(tokens[0]!.type).toBe('GEQ');
  });

  test('equality ==', () => {
    const tokens = lex('==');
    expect(tokens[0]!.type).toBe('EQ');
  });

  test('not-equal !=', () => {
    const tokens = lex('!=');
    expect(tokens[0]!.type).toBe('NEQ');
  });

  test('not-equal <>', () => {
    const tokens = lex('<>');
    expect(tokens[0]!.type).toBe('NEQ');
  });

  test('assignment =', () => {
    const tokens = lex('=');
    expect(tokens[0]!.type).toBe('ASSIGN');
  });
});

// ─── Special PGM tokens ───────────────────────────────────────────────────────

describe('Special PGM tokens', () => {
  test('$ is ENDOFFILE', () => {
    const tokens = lex('$');
    expect(tokens[0]!.type).toBe('ENDOFFILE');
  });

  test('EndFile (case-insensitive) is ENDOFFILE', () => {
    const tokens = lex('EndFile');
    expect(tokens[0]!.type).toBe('ENDOFFILE');
  });

  test('ENDFILE uppercase is ENDOFFILE', () => {
    const tokens = lex('ENDFILE');
    expect(tokens[0]!.type).toBe('ENDOFFILE');
  });

  test('include directive', () => {
    const tokens = lex('>>myfile.pgm');
    expect(tokens[0]!.type).toBe('INCLUDE');
    expect(tokens[0]!.value).toBe('myfile.pgm');
  });

  test('tag open and close', () => {
    const tokens = lex('["TK_001.Qm"]');
    const types = tokens.map(t => t.type);
    expect(types).toContain('TAG_OPEN');
    expect(types).toContain('IDENTIFIER');
    expect(types).toContain('TAG_CLOSE');
  });

  test('tag identifier contains correct path', () => {
    const tokens = lex('["TK_001.Temp"]');
    const identToken = tokens.find(t => t.type === 'IDENTIFIER');
    expect(identToken?.value).toBe('TK_001.Temp');
  });

  test('STAR_SUFFIX after identifier', () => {
    const tokens = lex('myVar*');
    const types = tokens.map(t => t.type);
    expect(types).toContain('IDENTIFIER');
    expect(types).toContain('STAR_SUFFIX');
  });

  test('AT_SUFFIX after identifier', () => {
    const tokens = lex('myVar@');
    const types = tokens.map(t => t.type);
    expect(types).toContain('IDENTIFIER');
    expect(types).toContain('AT_SUFFIX');
  });

  test('* without preceding identifier is STAR (multiply)', () => {
    const tokens = lex('2 * 3');
    const star = tokens.find(t => t.value === '*');
    expect(star?.type).toBe('STAR');
  });
});

// ─── Comments ─────────────────────────────────────────────────────────────────

describe('Comments', () => {
  test('comments are excluded from output', () => {
    const tokens = lex('; this is a comment');
    expect(tokens.every(t => t.type !== 'COMMENT')).toBe(true);
  });

  test('code after comment is not tokenized', () => {
    const tokens = lex('x = 1 ; inline comment\ny = 2');
    const types = tokens.map(t => t.type);
    expect(types).not.toContain('COMMENT');
    // y should still appear on next line
    expect(tokens.some(t => t.value === 'y')).toBe(true);
  });
});

// ─── Line / column tracking ───────────────────────────────────────────────────

describe('Line and column tracking', () => {
  test('first token is on line 1', () => {
    const tokens = lex('real x');
    expect(tokens[0]!.line).toBe(1);
    expect(tokens[0]!.col).toBe(1);
  });

  test('second token column is correct', () => {
    const tokens = lex('real x');
    // 'real' is 4 chars + 1 space = col 6 for 'x'
    const xTok = tokens.find(t => t.value === 'x');
    expect(xTok?.col).toBe(6);
  });

  test('token on second line has line=2', () => {
    const tokens = lex('real x\nreal y');
    const yTok = tokens.find(t => t.value === 'y');
    expect(yTok?.line).toBe(2);
  });
});

// ─── Complex expressions ──────────────────────────────────────────────────────

describe('Complex token sequences', () => {
  test('full variable declaration with attrs', () => {
    const tokens = lex('real ZnRecovery@("Qm","t/h")');
    const types = tokens.map(t => t.type);
    expect(types).toContain('REAL');
    expect(types).toContain('IDENTIFIER');
    expect(types).toContain('AT_SUFFIX');
    expect(types).toContain('LPAREN');
    expect(types).toContain('STRING');
    expect(types).toContain('COMMA');
    expect(types).toContain('RPAREN');
  });

  test('if expression tokens', () => {
    const tokens = lex('If (x > 5)');
    const types = tokens.map(t => t.type);
    expect(types).toContain('IF');
    expect(types).toContain('LPAREN');
    expect(types).toContain('IDENTIFIER');
    expect(types).toContain('GT');
    expect(types).toContain('NUMBER');
    expect(types).toContain('RPAREN');
  });

  test('arithmetic expression', () => {
    const tokens = lex('ZnRecovery = ZnInProduct / ZnInFeed * 100');
    const types = tokens.map(t => t.type);
    expect(types).toContain('ASSIGN');
    expect(types).toContain('SLASH');
    expect(types).toContain('STAR');
    expect(types).toContain('NUMBER');
  });
});
