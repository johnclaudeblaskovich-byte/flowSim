import type { UnitModelType, UnitNode } from '@/types'

const TYPE_PREFIXES: Record<UnitModelType, string> = {
  Feeder:            'FDR',
  FeederSink:        'SNK',
  Pipe:              'P',
  Tank:              'TK',
  Tie:               'TIE',
  Splitter:          'SPL',
  FlashTank:         'FT',
  FlashTank2:        'FT2',
  HeatExchanger:     'HX',
  Cooler:            'CLR',
  Heater:            'HTR',
  Filter:            'FLTR',
  Washer:            'WSHR',
  Thickener:         'THKR',
  CrushingMill:      'CM',
  Screen:            'SCR',
  Cyclone:           'CYCL',
  Pump:              'PMP',
  Valve:             'VLV',
  GeneralController: 'GC',
  PIDController:     'PID',
  SetTagController:  'STC',
  MakeupSource:      'MUS',
}

export function generateTag(type: UnitModelType, existingNodes: UnitNode[]): string {
  const prefix = TYPE_PREFIXES[type]
  const pattern = new RegExp(`^${prefix}_(\\d+)$`)
  const nums = existingNodes
    .map((n) => n.tag.match(pattern))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => parseInt(m[1], 10))
  const max = nums.length > 0 ? Math.max(...nums) : 0
  return `${prefix}_${String(max + 1).padStart(3, '0')}`
}
