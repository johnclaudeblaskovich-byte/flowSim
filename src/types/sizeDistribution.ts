export interface SizeClass {
  upperMicrons: number
  lowerMicrons: number
  massFraction: number
}

export interface SizeDistribution {
  method: 'Phi' | 'Tyler' | 'Custom'
  classes: SizeClass[]
}
