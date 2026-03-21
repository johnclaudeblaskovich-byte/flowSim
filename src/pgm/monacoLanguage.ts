// ─── PGM Monaco Language Registration ────────────────────────────────────────
// Registers the 'pgm' language with syntax highlighting, theme, and autocomplete.
// Call registerPGMLanguage(monaco, tagPaths) in the Editor's beforeMount callback.

import type { Monaco } from '@monaco-editor/react';
import type { languages, editor, Position } from 'monaco-editor';

// ─── Keyword / builtin lists ──────────────────────────────────────────────────

export const PGM_KEYWORDS = [
  'Real', 'Long', 'Integer', 'String', 'Bit', 'Array', 'CheckBox', 'EnumDropList',
  'If', 'ElseIf', 'Else', 'EndIf', 'While', 'EndWhile',
  'For', 'To', 'Next', 'Step',
  'Function', 'EndFunction', 'Return',
  'Class', 'EndClass',
  'Sub', 'EndSub',
  'PageLabel', 'TextLabel',
  'And', 'Or', 'Not',
  'True', 'False',
  'EndFile',
];

interface BuiltinInfo {
  name: string;
  params: string[];
  description: string;
}

export const PGM_BUILTINS: BuiltinInfo[] = [
  { name: 'Abs',    params: ['x'],        description: 'Absolute value' },
  { name: 'Sqrt',   params: ['x'],        description: 'Square root' },
  { name: 'Log',    params: ['x'],        description: 'Natural logarithm' },
  { name: 'Log10',  params: ['x'],        description: 'Base-10 logarithm' },
  { name: 'Exp',    params: ['x'],        description: 'e^x' },
  { name: 'Sin',    params: ['x'],        description: 'Sine (radians)' },
  { name: 'Cos',    params: ['x'],        description: 'Cosine (radians)' },
  { name: 'Tan',    params: ['x'],        description: 'Tangent (radians)' },
  { name: 'Asin',   params: ['x'],        description: 'Arc sine' },
  { name: 'Acos',   params: ['x'],        description: 'Arc cosine' },
  { name: 'Atan',   params: ['x'],        description: 'Arc tangent' },
  { name: 'Atan2',  params: ['y', 'x'],   description: 'Arc tangent of y/x' },
  { name: 'Min',    params: ['a', 'b'],   description: 'Minimum of two values' },
  { name: 'Max',    params: ['a', 'b'],   description: 'Maximum of two values' },
  { name: 'Int',    params: ['x'],        description: 'Truncate to integer' },
  { name: 'Round',  params: ['x'],        description: 'Round to nearest integer' },
  { name: 'Mod',    params: ['a', 'b'],   description: 'Modulus (remainder)' },
  { name: 'IIf',    params: ['cond', 'trueVal', 'falseVal'], description: 'Inline if: returns trueVal if cond, else falseVal' },
  { name: 'Pow',    params: ['base', 'exp'], description: 'Power: base^exp' },
  { name: 'Str',    params: ['x'],        description: 'Convert to string' },
  { name: 'Val',    params: ['s'],        description: 'Parse string to number' },
  { name: 'Len',    params: ['s'],        description: 'String length' },
  { name: 'Left',   params: ['s', 'n'],   description: 'Left n characters of string' },
  { name: 'Right',  params: ['s', 'n'],   description: 'Right n characters of string' },
  { name: 'Mid',    params: ['s', 'pos', 'n'], description: 'Substring from pos, length n' },
  { name: 'Trim',   params: ['s'],        description: 'Remove leading/trailing whitespace' },
  { name: 'Upper',  params: ['s'],        description: 'Convert to uppercase' },
  { name: 'Lower',  params: ['s'],        description: 'Convert to lowercase' },
  { name: 'Format', params: ['x', 'fmt'], description: 'Format number with format string, e.g. "0.00"' },
];

interface SDBMethod {
  name: string;
  snippet: string;
  description: string;
}

export const SDB_METHODS: SDBMethod[] = [
  { name: 'GetMW',    snippet: '${1:spName}',        description: 'Get molecular weight (g/mol)' },
  { name: 'GetH',     snippet: '${1:spName}, ${2:T}', description: 'Get enthalpy at temperature T (J/mol)' },
  { name: 'GetCp',    snippet: '${1:spName}, ${2:T}', description: 'Get heat capacity at T (J/mol·K)' },
  { name: 'GetRho',   snippet: '${1:spName}, ${2:T}', description: 'Get density at T (kg/m³)' },
  { name: 'GetVP',    snippet: '${1:spName}, ${2:T}', description: 'Get vapor pressure at T (Pa)' },
  { name: 'GetPhase', snippet: '${1:spName}',         description: 'Get phase of species (Solid/Liquid/Vapour/Aqueous)' },
];

// ─── Language registration ────────────────────────────────────────────────────

export function registerPGMLanguage(monaco: Monaco, tagPaths: string[]): void {
  // 1. Register language id
  monaco.languages.register({ id: 'pgm' });

  // 2. Monarch tokenizer — syntax highlighting rules
  monaco.languages.setMonarchTokensProvider('pgm', {
    defaultToken: '',
    ignoreCase: true,

    keywords: PGM_KEYWORDS.map(k => k.toLowerCase()),
    builtins: PGM_BUILTINS.map(b => b.name.toLowerCase()),

    tokenizer: {
      root: [
        // Comment: ; ... end of line
        [/;.*$/, 'comment'],

        // EndFile / $
        [/\$/, 'keyword.control'],
        [/\bEndFile\b/i, 'keyword.control'],

        // Include directive: >>filename
        [/>>[^\s]+/, 'keyword.include'],

        // Tag expression: ["..."] or [identifier]
        [/\["[^\]]*"\]/, 'string.tag'],
        [/\[[^\]]*\]/, 'string.tag'],

        // Double-quoted strings
        [/"[^"]*"/, 'string'],

        // Numbers (float, sci-notation, leading dot)
        [/\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
        [/\.\d+([eE][+-]?\d+)?/, 'number'],

        // Attribute modifiers: * and @ immediately after token
        [/[*@]/, 'keyword.modifier'],

        // Identifiers / keywords / builtins
        [/[a-zA-Z_][\w]*/, {
          cases: {
            '@keywords': 'keyword',
            '@builtins': 'support.function',
            '@default': 'identifier',
          },
        }],

        // Operators and delimiters (default coloring)
        [/[+\-*/^<>=!&|]/, 'operator'],
        [/[(),{}[\]:]/, 'delimiter'],
      ],
    },
  } as languages.IMonarchLanguage);

  // 3. Autocomplete provider
  monaco.languages.registerCompletionItemProvider('pgm', {
    provideCompletionItems: (model: editor.ITextModel, position: Position) => {
      const word = model.getWordUntilPosition(position);
      const range: languages.CompletionItem['range'] = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: languages.CompletionItem[] = [
        // Keywords
        ...PGM_KEYWORDS.map(k => ({
          label: k,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: k,
          range,
        })),

        // Built-in functions with snippet stubs
        ...PGM_BUILTINS.map(f => ({
          label: f.name,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${f.name}(${f.params.map((_, i) => `$${i + 1}`).join(', ')})`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: f.description,
          detail: `${f.name}(${f.params.join(', ')})`,
          range,
        })),

        // Project tag paths — wrapped in ["..."] format
        ...tagPaths.map(tag => ({
          label: tag,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: `["${tag}"]`,
          documentation: `Project tag: ${tag}`,
          detail: 'Tag',
          range,
        })),

        // SDB class methods
        ...SDB_METHODS.map(m => ({
          label: `SDB.${m.name}`,
          kind: monaco.languages.CompletionItemKind.Method,
          insertText: `SDB.${m.name}(${m.snippet})`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: m.description,
          detail: `SDB.${m.name}`,
          range,
        })),
      ];

      return { suggestions };
    },
  });

  // 4. Code folding provider — fold If/While/For/Function/Sub/Class blocks
  monaco.languages.registerFoldingRangeProvider('pgm', {
    provideFoldingRanges: (model: editor.ITextModel) => {
      const ranges: languages.FoldingRange[] = [];
      const lines: string[] = model.getLinesContent();
      const stack: { keyword: string; line: number }[] = [];

      const openers = /^\s*(if|while|for|function|sub|class)\b/i;
      const closers = /^\s*(endif|endwhile|next|endfunction|endsub|endclass)\b/i;

      lines.forEach((line: string, idx: number) => {
        if (openers.test(line)) {
          stack.push({ keyword: line.trim(), line: idx + 1 });
        } else if (closers.test(line) && stack.length > 0) {
          const opener = stack.pop();
          if (opener && opener.line < idx + 1) {
            ranges.push({
              start: opener.line,
              end: idx + 1,
              kind: monaco.languages.FoldingRangeKind.Region,
            });
          }
        }
      });

      return ranges;
    },
  });

  // 5. Light theme matching the app's color palette
  monaco.editor.defineTheme('pgm-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment',          foreground: '6B7280', fontStyle: 'italic' },
      { token: 'keyword',          foreground: '7C3AED', fontStyle: 'bold' },
      { token: 'keyword.control',  foreground: '7C3AED', fontStyle: 'bold' },
      { token: 'keyword.include',  foreground: '9333EA' },
      { token: 'keyword.modifier', foreground: 'DB2777', fontStyle: 'bold' },
      { token: 'support.function', foreground: '0284C7' },
      { token: 'string.tag',       foreground: '059669', fontStyle: 'bold' },
      { token: 'string',           foreground: 'DC2626' },
      { token: 'number',           foreground: 'D97706' },
      { token: 'operator',         foreground: '374151' },
      { token: 'identifier',       foreground: '111827' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.lineHighlightBackground': '#F9FAFB',
      'editorLineNumber.foreground': '#9CA3AF',
      'editorLineNumber.activeForeground': '#374151',
    },
  });
}
