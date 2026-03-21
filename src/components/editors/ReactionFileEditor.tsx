// ─── Reaction File Editor ─────────────────────────────────────────────────────
// Monaco-based editor for .rct reaction files with syntax highlighting,
// per-line validation, stoichiometry panel, and reactions summary table.

import { useRef, useState, useCallback, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { Monaco } from '@monaco-editor/react'
import type * as MonacoNS from 'monaco-editor'
import { useProjectStore } from '@/store'

// ─── RCT Language Registration ────────────────────────────────────────────────

function registerRCTLanguage(monaco: Monaco, speciesIds: string[]) {
  // Only register once
  const existing = monaco.languages.getLanguages().find((l: { id: string }) => l.id === 'rct')
  if (existing) return

  monaco.languages.register({ id: 'rct' })

  monaco.languages.setMonarchTokensProvider('rct', {
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/\b(FinalFrac|FinalMoles|FinalConc|FinalMass|FinalActivity|FinalFracInSol)\b/, 'keyword'],
        [/\((s|aq|l|v)\)/, 'type'],
        [/[+\=\[\]]/, 'operator'],
        [/\d+(\.\d+)?/, 'number'],
        [/[A-Za-z_][A-Za-z0-9_]*/, 'identifier'],
      ],
    },
  })

  monaco.languages.setLanguageConfiguration('rct', {
    comments: { lineComment: '#' },
    brackets: [
      ['[', ']'],
      ['(', ')'],
    ],
  })

  monaco.languages.registerCompletionItemProvider('rct', {
    provideCompletionItems: () => ({
      suggestions: [
        ...speciesIds.map((id) => ({
          label: id,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: id,
          range: undefined as unknown as MonacoNS.IRange,
        })),
        ...['FinalFrac', 'FinalMoles', 'FinalConc', 'FinalMass', 'FinalActivity'].map((kw) => ({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: `${kw}(`,
          range: undefined as unknown as MonacoNS.IRange,
        })),
      ],
    }),
  })

  monaco.editor.defineTheme('rct-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
      { token: 'type', foreground: '008080' },
      { token: 'operator', foreground: '000080' },
      { token: 'number', foreground: '098658' },
    ],
    colors: {},
  })
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidationResult {
  line: number // 0-based
  ok: boolean
  message: string
}

function validateReactionLines(text: string): ValidationResult[] {
  return text.split('\n').map((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return { line: idx, ok: true, message: '' }
    const REACTION_RE = /^.+=.+$/
    const HAS_PHASE = /\((s|aq|l|v)\)/
    if (!REACTION_RE.test(trimmed)) return { line: idx, ok: false, message: 'Missing "=" sign' }
    if (!HAS_PHASE.test(trimmed))
      return { line: idx, ok: false, message: 'Phase specifier required: (s), (aq), (l), (v)' }
    return { line: idx, ok: true, message: '' }
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReactionFileEditor() {
  const reactionFiles = useProjectStore((s) => s.reactionFiles)
  const setReactionFile = useProjectStore((s) => s.setReactionFile)
  const removeReactionFile = useProjectStore((s) => s.removeReactionFile)
  const selectedSpecies = useProjectStore((s) => s.project.selectedSpecies)

  const filenames = Object.keys(reactionFiles)
  const [currentFile, setCurrentFile] = useState<string>(() => filenames[0] ?? '')
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([])

  const editorRef = useRef<MonacoNS.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // If current file no longer exists (e.g. deleted), switch to first available
  useEffect(() => {
    if (currentFile && !reactionFiles[currentFile]) {
      const keys = Object.keys(reactionFiles)
      setCurrentFile(keys[0] ?? '')
    }
  }, [reactionFiles, currentFile])

  // Update validation markers when content changes
  const runValidation = useCallback(
    (text: string) => {
      const results = validateReactionLines(text)
      setValidationResults(results)

      if (monacoRef.current && editorRef.current) {
        const model = editorRef.current.getModel()
        if (model) {
          const markers: MonacoNS.editor.IMarkerData[] = results
            .filter((r) => !r.ok)
            .map((r) => ({
              severity: monacoRef.current!.MarkerSeverity.Error,
              message: r.message,
              startLineNumber: r.line + 1,
              startColumn: 1,
              endLineNumber: r.line + 1,
              endColumn: model.getLineMaxColumn(r.line + 1),
            }))
          monacoRef.current.editor.setModelMarkers(model, 'rct-validator', markers)
        }
      }
    },
    [],
  )

  function handleEditorChange(value: string | undefined) {
    const text = value ?? ''
    if (currentFile) {
      setReactionFile(currentFile, text)
    }
    if (validationTimerRef.current) clearTimeout(validationTimerRef.current)
    validationTimerRef.current = setTimeout(() => runValidation(text), 300)
  }

  function handleEditorMount(
    editor: MonacoNS.editor.IStandaloneCodeEditor,
    monaco: Monaco,
  ) {
    editorRef.current = editor
    monacoRef.current = monaco
    registerRCTLanguage(monaco, selectedSpecies)
    // Run initial validation
    const text = currentFile ? (reactionFiles[currentFile] ?? '') : ''
    runValidation(text)
  }

  function handleNewFile() {
    const name = window.prompt('New reaction file name (e.g. leach.rct):')
    if (!name) return
    const filename = name.endsWith('.rct') ? name : `${name}.rct`
    setReactionFile(filename, '')
    setCurrentFile(filename)
  }

  function handleDeleteFile() {
    if (!currentFile) return
    if (!window.confirm(`Delete "${currentFile}"?`)) return
    removeReactionFile(currentFile)
  }

  function handleAddReaction() {
    if (!editorRef.current || !currentFile) return
    const editor = editorRef.current
    const model = editor.getModel()
    if (!model) return
    const lineCount = model.getLineCount()
    const template = '\nA(s) + B(aq) = C(aq) [FinalFrac(A) = 0.95]'
    editor.executeEdits('add-reaction', [
      {
        range: {
          startLineNumber: lineCount,
          startColumn: model.getLineMaxColumn(lineCount),
          endLineNumber: lineCount,
          endColumn: model.getLineMaxColumn(lineCount),
        },
        text: template,
      },
    ])
    editor.focus()
  }

  function handleSummaryRowClick(lineIndex: number) {
    if (!editorRef.current) return
    editorRef.current.revealLineInCenter(lineIndex + 1)
    editorRef.current.setPosition({ lineNumber: lineIndex + 1, column: 1 })
    editorRef.current.focus()
  }

  function handleToggleReaction(lineIndex: number) {
    if (!currentFile) return
    const text = reactionFiles[currentFile] ?? ''
    const lines = text.split('\n')
    const line = lines[lineIndex]
    if (line === undefined) return
    if (line.trimStart().startsWith('#')) {
      lines[lineIndex] = line.replace(/^(\s*)#\s?/, '$1')
    } else {
      lines[lineIndex] = `# ${line}`
    }
    const newText = lines.join('\n')
    setReactionFile(currentFile, newText)
    runValidation(newText)
  }

  const currentText = currentFile ? (reactionFiles[currentFile] ?? '') : ''
  const lines = currentText.split('\n')

  // Reaction lines: non-empty, non-comment lines (for summary table)
  const reactionLineIndices = lines
    .map((line, idx) => ({ line, idx }))
    .filter(({ line }) => line.trim() && !line.trim().startsWith('#'))

  // Non-trivial validation results (only invalid lines)
  const errorResults = validationResults.filter((r) => !r.ok)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 flex-none bg-white">
        <select
          value={currentFile}
          onChange={(e) => setCurrentFile(e.target.value)}
          className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 min-w-[160px]"
        >
          {filenames.length === 0 && (
            <option value="">— No files —</option>
          )}
          {filenames.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <button
          onClick={handleNewFile}
          className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
        >
          New File
        </button>
        <button
          onClick={handleDeleteFile}
          disabled={!currentFile}
          className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-red-50 hover:text-red-600 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Delete
        </button>

        <div className="w-px h-4 bg-gray-200" />

        <button
          onClick={handleAddReaction}
          disabled={!currentFile}
          className="text-xs px-2 py-1 border border-blue-300 rounded hover:bg-blue-50 text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add Reaction
        </button>

        <div className="flex-1" />

        {errorResults.length > 0 ? (
          <span className="text-xs text-red-600 font-medium">
            {errorResults.length} error{errorResults.length !== 1 ? 's' : ''}
          </span>
        ) : currentFile ? (
          <span className="text-xs text-green-600">All valid</span>
        ) : null}
      </div>

      {/* ── Summary table + stoich panel ─────────────────────────────────────── */}
      <div className="flex flex-none h-40 border-b border-gray-200 overflow-hidden">
        {/* Summary table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-8">#</th>
                <th className="px-3 py-1.5 text-left font-medium text-gray-500">Reaction</th>
                <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-16">Active</th>
              </tr>
            </thead>
            <tbody>
              {reactionLineIndices.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-gray-400 text-center">
                    No reactions defined
                  </td>
                </tr>
              )}
              {reactionLineIndices.map(({ line, idx }) => (
                <tr
                  key={idx}
                  className="hover:bg-blue-50 cursor-pointer border-t border-gray-100"
                  onClick={() => handleSummaryRowClick(idx)}
                >
                  <td className="px-3 py-1 text-gray-400">{idx + 1}</td>
                  <td className="px-3 py-1 font-mono text-gray-700 max-w-0 truncate">
                    {line}
                  </td>
                  <td className="px-3 py-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleReaction(idx)
                      }}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 hover:bg-gray-100"
                    >
                      On
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stoichiometry / validation panel */}
        <div className="w-52 border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Validation
          </div>
          <div className="flex-1 overflow-auto">
            {errorResults.length === 0 && (
              <div className="px-3 py-2 text-xs text-green-600">No issues found</div>
            )}
            {errorResults.map((r) => (
              <div
                key={r.line}
                className="px-3 py-1.5 border-b border-gray-100 cursor-pointer hover:bg-red-50"
                onClick={() => handleSummaryRowClick(r.line)}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-red-500 font-bold text-[10px]">✗</span>
                  <span className="text-[10px] text-gray-500">Line {r.line + 1}</span>
                </div>
                <div className="text-xs text-red-700 mt-0.5">{r.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Monaco editor ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {currentFile ? (
          <Editor
            height="100%"
            language="rct"
            theme="rct-light"
            value={currentText}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              lineNumbers: 'on',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'off',
              tabSize: 2,
              insertSpaces: true,
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              quickSuggestions: true,
              renderLineHighlight: 'line',
              scrollbar: { vertical: 'auto', horizontal: 'auto' },
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <div className="text-center">
              <div className="text-2xl mb-2">⚗</div>
              <div>No reaction file selected.</div>
              <div className="mt-1">
                <button
                  onClick={handleNewFile}
                  className="text-blue-600 hover:underline text-sm"
                >
                  Create a new file
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
