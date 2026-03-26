import type { Phase } from '@/types'

export interface SpeciesCatalogEntry {
  id: string
  name: string
  formula: string
  phase: Phase
  category: string
}

export const COMMON_SPECIES: SpeciesCatalogEntry[] = [
  { id: 'Water', name: 'Water', formula: 'H₂O', phase: 'Liquid', category: 'Water' },
  { id: 'Steam', name: 'Steam', formula: 'H₂O', phase: 'Vapour', category: 'Water' },
  { id: 'H2SO4', name: 'Sulfuric Acid', formula: 'H₂SO₄', phase: 'Aqueous', category: 'Acids' },
  { id: 'HCl', name: 'Hydrochloric Acid', formula: 'HCl', phase: 'Aqueous', category: 'Acids' },
  { id: 'HNO3', name: 'Nitric Acid', formula: 'HNO₃', phase: 'Aqueous', category: 'Acids' },
  { id: 'NaOH', name: 'Sodium Hydroxide', formula: 'NaOH', phase: 'Aqueous', category: 'Bases' },
  { id: 'Ca(OH)2', name: 'Lime', formula: 'Ca(OH)₂', phase: 'Solid', category: 'Bases' },
  { id: 'ZnSO4', name: 'Zinc Sulfate', formula: 'ZnSO₄', phase: 'Aqueous', category: 'Metals' },
  { id: 'CuSO4', name: 'Copper Sulfate', formula: 'CuSO₄', phase: 'Aqueous', category: 'Metals' },
  { id: 'Fe2SO43', name: 'Iron(III) Sulfate', formula: 'Fe₂(SO₄)₃', phase: 'Aqueous', category: 'Metals' },
  { id: 'Zn', name: 'Zinc', formula: 'Zn', phase: 'Solid', category: 'Metals' },
  { id: 'Cu', name: 'Copper', formula: 'Cu', phase: 'Solid', category: 'Metals' },
  { id: 'Fe', name: 'Iron', formula: 'Fe', phase: 'Solid', category: 'Metals' },
  { id: 'Pb', name: 'Lead', formula: 'Pb', phase: 'Solid', category: 'Metals' },
  { id: 'SiO2', name: 'Silica', formula: 'SiO₂', phase: 'Solid', category: 'Minerals' },
  { id: 'CaCO3', name: 'Limestone', formula: 'CaCO₃', phase: 'Solid', category: 'Minerals' },
  { id: 'Al2O3', name: 'Alumina', formula: 'Al₂O₃', phase: 'Solid', category: 'Minerals' },
  { id: 'FeS2', name: 'Pyrite', formula: 'FeS₂', phase: 'Solid', category: 'Minerals' },
  { id: 'O2', name: 'Oxygen', formula: 'O₂', phase: 'Vapour', category: 'Gases' },
  { id: 'N2', name: 'Nitrogen', formula: 'N₂', phase: 'Vapour', category: 'Gases' },
  { id: 'CO2', name: 'Carbon Dioxide', formula: 'CO₂', phase: 'Vapour', category: 'Gases' },
  { id: 'CH4', name: 'Methane', formula: 'CH₄', phase: 'Vapour', category: 'Gases' },
  { id: 'SO2', name: 'Sulfur Dioxide', formula: 'SO₂', phase: 'Vapour', category: 'Gases' },
  { id: 'NaCl', name: 'Sodium Chloride', formula: 'NaCl', phase: 'Aqueous', category: 'Salts' },
  { id: 'Ethanol', name: 'Ethanol', formula: 'C₂H₅OH', phase: 'Liquid', category: 'Organics' },
  { id: 'Acetone', name: 'Acetone', formula: 'C₃H₆O', phase: 'Liquid', category: 'Organics' },
]

export const COMMON_SPECIES_CATEGORIES = [...new Set(COMMON_SPECIES.map((species) => species.category))]

export function getSpeciesCatalogEntry(speciesId: string): SpeciesCatalogEntry | undefined {
  return COMMON_SPECIES.find((species) => species.id === speciesId)
}

export function guessSpeciesPhase(speciesId: string): Phase {
  const known = getSpeciesCatalogEntry(speciesId)
  if (known) return known.phase

  const id = speciesId.toLowerCase()
  if (id.includes('solid') || id.includes('ore') || id.includes('gangue') || id.includes('mineral')) {
    return 'Solid'
  }
  if (id.includes('vapour') || id.includes('gas') || id.includes('steam')) {
    return 'Vapour'
  }
  if (id.includes('solute') || id.includes('aqueous') || id.includes('ion') || id.includes('acid')) {
    return 'Aqueous'
  }
  return 'Liquid'
}
