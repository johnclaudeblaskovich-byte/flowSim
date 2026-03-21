// ─── PGM Script Editor ────────────────────────────────────────────────────────
// Monaco-based editor for PGM scripts with full language support.
// Syntax highlighting, autocomplete, and code folding for PGM syntax.

import Editor from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import { registerPGMLanguage } from '@/pgm/monacoLanguage.ts';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PGMEditorProps {
  /** PGM source code */
  value: string;
  /** Called on every keystroke */
  onChange?: (value: string) => void;
  /** All project tag paths for autocomplete */
  tagPaths?: string[];
  /** Height of the editor (CSS value, e.g. "400px" or "100%") */
  height?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PGMEditor({
  value,
  onChange,
  tagPaths = [],
  height = '400px',
  readOnly = false,
}: PGMEditorProps) {
  function handleBeforeMount(monaco: Monaco): void {
    registerPGMLanguage(monaco, tagPaths);
  }

  return (
    <Editor
      height={height}
      language="pgm"
      theme="pgm-light"
      value={value}
      onChange={(v) => onChange?.(v ?? '')}
      beforeMount={handleBeforeMount}
      options={{
        readOnly,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontLigatures: true,
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'off',
        tabSize: 2,
        insertSpaces: true,
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        formatOnPaste: false,
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        folding: true,
        renderLineHighlight: 'line',
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto',
        },
      }}
    />
  );
}
