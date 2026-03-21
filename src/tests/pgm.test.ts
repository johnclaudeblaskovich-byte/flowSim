import { describe, test, expect } from 'vitest'
import { lex } from '../pgm/lexer'
import { parse } from '../pgm/parser'
import { PGMInterpreter } from '../pgm/interpreter'
import type { TagResolver } from '../pgm/interpreter'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Null tag resolver — returns 0 for any tag read */
function nullResolver(overrides: Record<string, number> = {}): TagResolver {
  return {
    getTag: (path: string) => overrides[path] ?? 0,
    setTag: () => true,
    getAllTagPaths: () => Object.keys(overrides),
  }
}

/** Parse and execute a PGM program, returning the interpreter for inspection */
function run(src: string, tags: Record<string, number> = {}): PGMInterpreter {
  const tokens = lex(src)
  const { ast, errors } = parse(tokens)
  if (errors.length > 0) throw new Error(`Parse error: ${errors[0]!.message}`)
  const interp = new PGMInterpreter(nullResolver(tags))
  interp.execute(ast)
  return interp
}

/** Convenience: run program and return variable by name */
function runGet(src: string, varName: string, tags?: Record<string, number>): unknown {
  return run(src, tags).getVariable(varName)
}

// ─── PGM Lexer ────────────────────────────────────────────────────────────────

describe('PGM Lexer', () => {
  test('tokenizes variable declaration correctly', () => {
    const tokens = lex('real myVar*("Qm","t/h")')
    const types = tokens.map((t) => t.type)
    expect(types).toContain('REAL')
    expect(types).toContain('IDENTIFIER')
    expect(types).toContain('STAR_SUFFIX')
    expect(types).toContain('STRING')
  })

  test('ignores comments', () => {
    const tokens = lex('; this is a comment\nx = 1')
    expect(tokens.every((t) => t.type !== 'COMMENT')).toBe(true)
    expect(tokens.some((t) => t.value === 'x')).toBe(true)
  })

  test('case-insensitive keywords', () => {
    const upper = lex('IF')[0]!
    const lower = lex('if')[0]!
    const mixed = lex('If')[0]!
    expect(upper.type).toBe('IF')
    expect(lower.type).toBe('IF')
    expect(mixed.type).toBe('IF')
  })
})

// ─── PGM Interpreter ─────────────────────────────────────────────────────────

describe('PGM Interpreter', () => {
  test('arithmetic operations', () => {
    // 2 + 3 * 4 = 14 (operator precedence)
    const result = runGet('real x\nx = 2 + 3 * 4', 'x')
    expect(result).toBe(14)
  })

  test('subtraction and division', () => {
    const result = runGet('real x\nx = 10 - 4 / 2', 'x')
    expect(result).toBe(8)
  })

  test('power operator', () => {
    const result = runGet('real x\nx = 2 ^ 3', 'x')
    expect(result).toBe(8)
  })

  test('if-else branching: true branch taken', () => {
    const src = `
real x
x = 10
real result
If (x > 5)
  result = 1
Else
  result = 0
EndIf`
    expect(runGet(src, 'result')).toBe(1)
  })

  test('if-else branching: false branch taken', () => {
    const src = `
real x
x = 3
real result
If (x > 5)
  result = 1
Else
  result = 0
EndIf`
    expect(runGet(src, 'result')).toBe(0)
  })

  test('while loop: sum 1 to 10 = 55', () => {
    const src = `
real i
real total
i = 1
total = 0
While (i <= 10)
  total = total + i
  i = i + 1
EndWhile`
    expect(runGet(src, 'total')).toBe(55)
  })

  test('IIf built-in: condition true', () => {
    const result = runGet('real x\nx = IIf(1 == 1, 42, 0)', 'x')
    expect(result).toBe(42)
  })

  test('IIf built-in: condition false', () => {
    const result = runGet('real x\nx = IIf(1 == 2, 42, 99)', 'x')
    expect(result).toBe(99)
  })

  test('division by zero → 0 (no crash)', () => {
    // Division by zero should not throw — should return 0 and log a warning
    const interp = run('real x\nx = 1 / 0')
    const val = interp.getVariable('x')
    expect(val).toBe(0)
    // A warning should have been recorded
    expect(interp.getWarnings().length).toBeGreaterThan(0)
  })

  test('nested function calls: Abs(Sqrt(4)) = 2', () => {
    const result = runGet('real x\nx = Abs(Sqrt(4))', 'x')
    expect(result).toBeCloseTo(2, 6)
  })

  test('Min and Max builtins', () => {
    expect(runGet('real x\nx = Min(3, 7)', 'x')).toBe(3)
    expect(runGet('real x\nx = Max(3, 7)', 'x')).toBe(7)
  })

  test('string variable assignment', () => {
    const result = runGet('string s\ns = "hello"', 's')
    expect(result).toBe('hello')
  })

  test('boolean comparisons', () => {
    const src = `
real a
real b
a = 1
b = 0
If (a > b)
  a = 100
EndIf`
    expect(runGet(src, 'a')).toBe(100)
  })

  test('variable declared but not assigned keeps initial value', () => {
    // PGM initialises real to 0
    const result = runGet('real x', 'x')
    expect(result).toBe(0)
  })

  test('For loop iterates correct number of times', () => {
    const src = `
real count
count = 0
For i = 1 To 5
  count = count + 1
Next i`
    expect(runGet(src, 'count')).toBe(5)
  })
})
