// ─── PGM Access Window Tab ────────────────────────────────────────────────────
// Dynamic renderer for a PGM-generated Access Window tab.
// Displays result fields (@) as read-only and editable fields (*) as inputs.

import { type ChangeEvent } from 'react';
import type { AWTab, AWField } from '@/pgm/accessWindowBuilder.ts';
import type { PGMInterpreter, PGMValue } from '@/pgm/interpreter.ts';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PGMAccessWindowTabProps {
  spec: AWTab;
  interpreter: PGMInterpreter;
  onFieldChange: (fieldName: string, value: PGMValue) => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResultField({ label, value, unit }: { label: string; value: PGMValue; unit?: string }) {
  const displayVal = value === null ? '—' : String(value);
  return (
    <div className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded text-sm">
      <span className="text-gray-500 truncate mr-2" title={label}>{label}</span>
      <span className="font-mono text-gray-700 flex-none">
        {displayVal}
        {unit && <span className="ml-1 text-gray-400 text-xs">{unit}</span>}
      </span>
    </div>
  );
}

function EditableField({
  label, value, unit, min, max, onChange, fieldType, enumOptions,
}: {
  label: string;
  value: PGMValue;
  unit?: string;
  min?: number;
  max?: number;
  onChange: (v: PGMValue) => void;
  fieldType: AWField['dataType'];
  enumOptions?: string[];
}) {
  const title = [label, unit && `(${unit})`, min !== undefined && `min: ${min}`, max !== undefined && `max: ${max}`]
    .filter(Boolean)
    .join(' ');

  if (fieldType === 'checkbox' || fieldType === 'bit') {
    return (
      <div className="flex items-center justify-between py-1 px-2 text-sm" title={title}>
        <span className="text-gray-700 truncate mr-2">{label}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600"
        />
      </div>
    );
  }

  if (fieldType === 'enum' && enumOptions && enumOptions.length > 0) {
    return (
      <div className="flex items-center justify-between py-1 px-2 text-sm" title={title}>
        <span className="text-gray-700 truncate mr-2">{label}</span>
        <select
          value={String(value ?? '')}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
          className="text-sm border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700 max-w-[140px]"
        >
          {enumOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (fieldType === 'string') {
    return (
      <div className="flex items-center justify-between py-1 px-2 text-sm" title={title}>
        <span className="text-gray-700 truncate mr-2">{label}</span>
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          className="text-sm border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700 w-32 font-mono"
        />
      </div>
    );
  }

  // Numeric (real, long, integer)
  return (
    <div className="flex items-center justify-between py-1 px-2 text-sm" title={title}>
      <span className="text-gray-700 truncate mr-2">{label}</span>
      <div className="flex items-center gap-1 flex-none">
        <input
          type="number"
          value={value === null ? '' : String(value)}
          min={min}
          max={max}
          step={fieldType === 'integer' || fieldType === 'long' ? 1 : 'any'}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const n = parseFloat(e.target.value);
            onChange(isNaN(n) ? 0 : n);
          }}
          className="text-sm border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700 w-24 font-mono text-right"
        />
        {unit && <span className="text-gray-400 text-xs">{unit}</span>}
      </div>
    </div>
  );
}

function TextLabelRow({ text }: { text: string }) {
  return (
    <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border-b border-gray-200 uppercase tracking-wide">
      {text || '─────'}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PGMAccessWindowTab({ spec, interpreter, onFieldChange }: PGMAccessWindowTabProps) {
  return (
    <div className="space-y-0.5">
      {spec.sections.map((section, sectionIdx) => {
        if (section.type === 'label') {
          return <TextLabelRow key={`label-${sectionIdx}`} text={section.label ?? ''} />;
        }

        return (
          <div key={`fields-${sectionIdx}`} className="space-y-0.5">
            {section.fields.map(field => {
              const currentValue = interpreter.getVariable(field.name) ?? null;
              const displayLabel = field.comment ?? field.name;

              if (field.readOnly && !field.visible) {
                return (
                  <ResultField
                    key={field.name}
                    label={displayLabel}
                    value={currentValue}
                    unit={field.displayUnit}
                  />
                );
              }

              if (field.visible && !field.readOnly) {
                return (
                  <EditableField
                    key={field.name}
                    label={displayLabel}
                    value={currentValue}
                    unit={field.displayUnit}
                    min={field.min}
                    max={field.max}
                    fieldType={field.dataType}
                    enumOptions={field.enumOptions}
                    onChange={(v) => {
                      interpreter.setVariable(field.name, v);
                      onFieldChange(field.name, v);
                    }}
                  />
                );
              }

              // Both visible and readOnly — treat as result
              return (
                <ResultField
                  key={field.name}
                  label={displayLabel}
                  value={currentValue}
                  unit={field.displayUnit}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
