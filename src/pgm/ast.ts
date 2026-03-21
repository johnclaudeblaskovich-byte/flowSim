// ─── PGM Abstract Syntax Tree Node Types ─────────────────────────────────────

export interface ElseIfClause {
  condition: ASTNode;
  body: ASTNode[];
}

export interface FunctionParam {
  name: string;
  type: string;
}

// Discriminated union of all AST node types
export type ASTNode =
  | ProgramNode
  | VarDeclNode
  | AssignNode
  | TagReadNode
  | TagWriteNode
  | BinaryOpNode
  | UnaryOpNode
  | CallNode
  | IdentifierNode
  | NumberLitNode
  | StringLitNode
  | BoolLitNode
  | IfNode
  | WhileNode
  | ForNode
  | FunctionDefNode
  | ClassDefNode
  | ReturnNode
  | SubDefNode
  | PageLabelNode
  | TextLabelNode
  | IncludeNode
  | EndOfFileNode;

export interface ProgramNode {
  type: 'Program';
  body: ASTNode[];
}

export interface VarDeclNode {
  type: 'VarDecl';
  dataType: string;
  name: string;
  visible: boolean;   // * suffix
  readOnly: boolean;  // @ suffix
  units?: [string, string];   // [quantityType, displayUnit]
  minVal?: number;
  maxVal?: number;
  comment?: string;
  enumOptions?: string[];
  initialValue?: ASTNode;
}

export interface AssignNode {
  type: 'Assign';
  target: ASTNode;  // Identifier or TagWrite
  value: ASTNode;
}

export interface TagReadNode {
  type: 'TagRead';
  tagPath: string;
  unit?: string;
}

export interface TagWriteNode {
  type: 'TagWrite';
  tagPath: string;
  value: ASTNode;
}

export interface BinaryOpNode {
  type: 'BinaryOp';
  op: string;
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOpNode {
  type: 'UnaryOp';
  op: string;
  operand: ASTNode;
}

export interface CallNode {
  type: 'Call';
  name: string;
  args: ASTNode[];
}

export interface IdentifierNode {
  type: 'Identifier';
  name: string;
}

export interface NumberLitNode {
  type: 'NumberLit';
  value: number;
}

export interface StringLitNode {
  type: 'StringLit';
  value: string;
}

export interface BoolLitNode {
  type: 'BoolLit';
  value: boolean;
}

export interface IfNode {
  type: 'If';
  condition: ASTNode;
  then: ASTNode[];
  elseIfs: ElseIfClause[];
  else?: ASTNode[];
}

export interface WhileNode {
  type: 'While';
  condition: ASTNode;
  body: ASTNode[];
}

export interface ForNode {
  type: 'For';
  var: string;
  from: ASTNode;
  to: ASTNode;
  step?: ASTNode;
  body: ASTNode[];
}

export interface FunctionDefNode {
  type: 'FunctionDef';
  name: string;
  params: FunctionParam[];
  body: ASTNode[];
}

export interface ClassDefNode {
  type: 'ClassDef';
  name: string;
  fields: VarDeclNode[];
  methods: FunctionDefNode[];
}

export interface ReturnNode {
  type: 'Return';
  value?: ASTNode;
}

export interface SubDefNode {
  type: 'SubDef';
  name: string;
  body: ASTNode[];
}

export interface PageLabelNode {
  type: 'PageLabel';
  label: string;
}

export interface TextLabelNode {
  type: 'TextLabel';
  columns: string[];
}

export interface IncludeNode {
  type: 'Include';
  filename: string;
}

export interface EndOfFileNode {
  type: 'EndOfFile';
}
