declare module 'dxf-parser' {
  export default class DxfParser {
    parseSync(text: string): DxfData
  }

  export interface DxfData {
    entities: DxfEntity[]
    blocks: Record<string, unknown>
    header?: Record<string, unknown>
    tables?: Record<string, unknown>
  }

  export interface DxfEntity {
    type: string
    name?: string
    position?: { x: number; y: number; z: number }
    handle?: string
    layer?: string
    [key: string]: unknown
  }
}
