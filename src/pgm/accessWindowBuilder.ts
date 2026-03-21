// ─── PGM Access Window Builder ────────────────────────────────────────────────
// Walks a PGM AST and produces an AccessWindowSpec that drives the dynamic
// Access Window UI rendered by PGMAccessWindowTab.

import type { ProgramNode, ASTNode } from './ast.ts';

// ─── Data types ────────────────────────────────────────────────────────────────

export type AWFieldType = 'real' | 'long' | 'integer' | 'string' | 'bit' | 'checkbox' | 'enum';

export interface AWField {
  name: string;
  dataType: AWFieldType;
  readOnly: boolean;    // @ suffix
  visible: boolean;     // * suffix
  displayUnit?: string;
  quantityType?: string;
  min?: number;
  max?: number;
  comment?: string;
  enumOptions?: string[];
}

export type AWSection =
  | { type: 'fields'; fields: AWField[] }
  | { type: 'label'; label: string; fields: AWField[] };

export interface AWTab {
  label: string;
  sections: AWSection[];
}

export interface AccessWindowSpec {
  tabs: AWTab[];
}

// ─── Builder ──────────────────────────────────────────────────────────────────

function resolveFieldType(dataType: string): AWFieldType {
  switch (dataType.toLowerCase()) {
    case 'real':         return 'real';
    case 'long':         return 'long';
    case 'integer':      return 'integer';
    case 'string':       return 'string';
    case 'bit':          return 'bit';
    case 'checkbox':     return 'checkbox';
    case 'enumdroplist': return 'enum';
    default:             return 'real';
  }
}

/**
 * Walk a PGM AST and build the AccessWindowSpec.
 *
 * Rules:
 * - PageLabel → start a new tab
 * - TextLabel → add a label section divider to the current tab
 * - VarDecl with visible=true OR readOnly=true → add a field to the current tab
 * - Fields before the first PageLabel go into an implicit first tab
 */
export function buildAccessWindowSpec(ast: ProgramNode, defaultTabLabel = 'General'): AccessWindowSpec {
  const tabs: AWTab[] = [];

  // Start with an implicit tab
  let currentTab: AWTab = { label: defaultTabLabel, sections: [] };
  let currentFields: AWField[] = [];

  function flushFields(): void {
    if (currentFields.length > 0) {
      currentTab.sections.push({ type: 'fields', fields: [...currentFields] });
      currentFields = [];
    }
  }

  function flushTab(): void {
    flushFields();
    if (currentTab.sections.length > 0 || tabs.length === 0) {
      tabs.push(currentTab);
    }
  }

  function walkNode(node: ASTNode): void {
    switch (node.type) {
      case 'PageLabel':
        flushTab();
        currentTab = { label: node.label, sections: [] };
        currentFields = [];
        break;

      case 'TextLabel':
        flushFields();
        // Join non-empty columns into a single label string
        currentTab.sections.push({
          type: 'label',
          label: node.columns.filter(Boolean).join('  '),
          fields: [],
        });
        break;

      case 'VarDecl':
        if (node.visible || node.readOnly) {
          const field: AWField = {
            name: node.name,
            dataType: resolveFieldType(node.dataType),
            readOnly: node.readOnly,
            visible: node.visible,
            displayUnit: node.units?.[1],
            quantityType: node.units?.[0],
            min: node.minVal,
            max: node.maxVal,
            comment: node.comment,
            enumOptions: node.enumOptions,
          };
          currentFields.push(field);
        }
        break;

      case 'Program':
        for (const child of node.body) walkNode(child);
        break;

      // Recurse into sub/function bodies (controllers may define vars inside subs)
      case 'SubDef':
        for (const child of node.body) walkNode(child);
        break;

      case 'FunctionDef':
        for (const child of node.body) walkNode(child);
        break;

      default:
        break;
    }
  }

  for (const node of ast.body) {
    walkNode(node);
  }

  flushTab();

  return { tabs };
}
