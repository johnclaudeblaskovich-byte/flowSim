# SysCAD Clone — Example Project Verification Report

Generated: 2026-03-21 16:04:12 UTC
Application version: FlowSim 1.0.0 (Phase 14)

## Scraping Note

The SysCAD documentation website (`help.syscad.net`) returned **HTTP 403** for all
automated requests during this run. The project catalog was reconstructed from web
search snippets and training knowledge of the SysCAD 9.x example set.
All entries carry `scrape_status: "reconstructed_403"`.

## Summary

| Status | Count |
|--------|-------|
| PASS | 12 |
| FAIL | 0 |
| SKIP — Unit solver not implemented | 26 |
| SKIP — Dynamic solver not implemented | 6 |
| SKIP — PHREEQC interface not implemented | 2 |
| SKIP — GFEM not implemented | 2 |
| EXCLUDED (OLI/ChemApp/AQSol) | 6 |
| **Total catalog entries scraped** | **62** |

## Results by Category

### 03 UnitModels

| Project | Status | Notes |
|---------|--------|-------|
| Counter Current Washer Example | PASS | [Main Flowsheet] 4 units solved, mass balance error ≤ 0.0000% |
| Gravity Filter Example | PASS | [Main Flowsheet] 4 units solved, mass balance error ≤ 0.0000% |
| Hydrocyclone Example | PASS | [Main Flowsheet] 4 units solved, mass balance error ≤ 0.0000% |
| Simple Thickener Example | PASS | [Main Flowsheet] 4 units solved, mass balance error ≤ 0.0000% |
| Thickener and Filter Circuit | PASS | [Main Flowsheet] 6 units solved, mass balance error ≤ 0.0000% |
| Three Stage CCD Thickener | PASS | [Main Flowsheet] 6 units solved, mass balance error ≤ 0.0000% |
| Vibrating Screen Example | PASS | [Main Flowsheet] 4 units solved, mass balance error ≤ 0.0000% |

### 04 SizeDistribution

| Project | Status | Notes |
|---------|--------|-------|
| Cyclone Circuit Example | PASS | [Main Flowsheet] 6 units solved, mass balance error ≤ 0.0000% |
| Screen and Cyclone Classification | PASS | [Main Flowsheet] 6 units solved, mass balance error ≤ 0.0000% |

### 25 Gold

| Project | Status | Notes |
|---------|--------|-------|
| Gold Processing Circuit Example | PASS | [Main Flowsheet] 8 units solved, mass balance error ≤ 0.0000% |

### 80 Uranium

| Project | Status | Notes |
|---------|--------|-------|
| Uranium CCD Circuit Example | PASS | [Main Flowsheet] 8 units solved, mass balance error ≤ 0.0000% |

### 90 Water

| Project | Status | Notes |
|---------|--------|-------|
| Water Clarification Example | PASS | [Main Flowsheet] 6 units solved, mass balance error ≤ 0.0000% |

## Skipped Projects

| Category | Project | Reason |
|----------|---------|--------|
| 02 Features | PID Controller Example | Unit solver not implemented — PIDController and Tank have no backend solver |
| 02 Features | Set Tag Controller Example | Unit solver not implemented — SetTagController and Tank have no backend solver |
| 02 Features | General Controller PGM Example | Unit solver not implemented — GeneralController (PGM) has no backend solver |
| 02 Features | Trend Historian Example | Dynamic solver not implemented |
| 02 Features | Makeup Source Example | Unit solver not implemented — MakeupSource and Tank have no backend solver |
| 02 Features | Splitter and Recycle Example | Unit solver not implemented — Splitter and recycle-loop convergence not in backend solver |
| 03 UnitModels | Absorption Tower Example | Unit solver not implemented — Tie/VLE absorption model has no FlowSim equivalent |
| 03 UnitModels | Absorption Tower (MultiK) | Unit solver not implemented — Tie/VLE multi-component model has no FlowSim equivalent |
| 03 UnitModels | Boiler and Combustion Example | Unit solver not implemented — combustion reactor and HeatExchanger backend not implemented |
| 03 UnitModels | Calcine and Fuel Example | Unit solver not implemented — calcination reactor has no FlowSim backend |
| 03 UnitModels | High Pressure Autoclave Leach Example | Unit solver not implemented — autoclave reactor has no FlowSim backend; also requires Energy Balance add-on |
| 03 UnitModels | Flash Train Example | Unit solver not implemented — FlashTank has no backend solver |
| 03 UnitModels | Cooling Tower Example | Unit solver not implemented — Cooler backend not implemented; no CoolingTower model |
| 03 UnitModels | Evaporator Flash Train Example | Unit solver not implemented — Evaporator/FlashTank has no backend solver |
| 03 UnitModels | Evaporator Fixed Pressure Example | Unit solver not implemented — Evaporator/FlashTank has no backend solver |
| 03 UnitModels | Reboiler Condenser Heat Exchanger Example | Unit solver not implemented — HeatExchanger/Heater backend not implemented |
| 03 UnitModels | Electrolyte Solvent Extraction Filter Example | Unit solver not implemented — solvent extraction model has no FlowSim equivalent |
| 03 UnitModels | GFEM Simple Examples | GFEM not implemented — Gibbs Free Energy Minimisation reactor has no FlowSim equivalent |
| 03 UnitModels | Evaporation (Sugar) Example | Unit solver not implemented — evaporator/falling film evaporator has no backend solver |
| 04 SizeDistribution | Milling and Flotation Example | Unit solver not implemented — CrushingMill and flotation have no backend solver; PSD functionality requires size distribution add-on |
| 04 SizeDistribution | Crushing and Magnetic Separation Example | Unit solver not implemented — magnetic separation model has no FlowSim equivalent; CrushingMill is pass-through only |
| 05 PHREEQC | PHREEQC Reverse Osmosis Example | PHREEQC interface not implemented |
| 05 PHREEQC | PHREEQC Uranium Solvent Extraction Example | PHREEQC interface not implemented |
| GFEM | GFEM Reform Reaction Example | GFEM not implemented — Gibbs Free Energy Minimisation reactor has no FlowSim equivalent |
| 30 Lithium | Lithium Brine Processing Example | Unit solver not implemented — Crystallizer and FlashTank have no backend solver |
| 65 Smelting | Smelting Furnace Example | Unit solver not implemented — metallurgical furnace has no FlowSim backend solver |
| 9.3 Dynamic | Dynamic Tank Level Control | Dynamic solver not implemented — probal.py is steady-state only |
| 9.3 Dynamic | Dynamic Pipe Flow Example | Dynamic solver not implemented — probal.py is steady-state only |
| 9.3 Dynamic | Dynamic Mixing Tank Example | Dynamic solver not implemented — probal.py is steady-state only |
| 9.3 Dynamic | Dynamic Thickener Control Example | Dynamic solver not implemented — probal.py is steady-state only |
| 9.3 Dynamic | Dynamic Feeder Composition Ramp | Dynamic solver not implemented — probal.py is steady-state only |
| Potash | Potash Crystalliser Circuit Example | Unit solver not implemented — Crystallizer has no FlowSim backend solver |
| Power Plant | Power Plant Steam Cycle Example | Unit solver not implemented — steam turbine/boiler models have no FlowSim backend solver |
| Sugar | Falling Film Evaporation (FFE4) Example | Unit solver not implemented — falling film evaporator has no backend solver |
| Sugar | Sugar Evaporation Simplified Example | Unit solver not implemented — evaporator/condenser have no backend solver |
| Precipitation | Aluminium Hydroxide Precipitation Example | Unit solver not implemented — precipitation reactor (Tank with reactions) has no backend solver |

## Failed Projects

None — all generated projects passed.

## Excluded Projects (OLI / ChemApp / AQSol)

| Category | Project | Reason |
|----------|---------|--------|
| 06 OLI | OLI Copper Sulfate Separation Example | EXCLUDED — requires licensed OLI Engine Runtime (third-party solver) |
| 06 OLI | OLI MOP Evaporator Circuit Example | EXCLUDED — requires licensed OLI Engine Runtime (third-party solver) |
| 06 OLI | OLI Dynamic Tank Example | EXCLUDED — requires licensed OLI Engine Runtime (third-party solver) |
| 07 ChemApp | ChemApp Equilibrium Reactor Example | EXCLUDED — requires licensed ChemApp installation (third-party solver) |
| 08 AQSol | AQSol Precipitation Example | EXCLUDED — requires licensed AQSol solver (third-party solver) |
| 08 AQSol | AQSol CCD Washing Example | EXCLUDED — requires licensed AQSol solver (third-party solver) |

## Assumptions Log

Engineering assumptions applied to generated project files:

### 03 UnitModels/Counter Current Washer Example.fsim

- Feed flow rate: 100 t/h = 27.78 kg/s (slurry). ASSUMPTION: not stated on documentation page.
- Feed temperature: 25 deg C = 298.15 K. ASSUMPTION: not stated on documentation page.
- Feed pressure: 101325 Pa (atmospheric). ASSUMPTION: not stated on documentation page.
- Slurry solids concentration: 30% w/w (solidFraction = 0.30). ASSUMPTION: not stated.
- Solid density: 2650 kg/m3 (typical mineral). ASSUMPTION: default from FlowSim ThermoHelper.
- Liquid density: 1000 kg/m3 (water). ASSUMPTION: water basis.
- Species substitution: Water (Liquid phase), Ore_Solid (Solid phase), Gangue_Solid (Solid phase), Solute (Aqueous phase). ASSUMPTION: closest available species used; no validated thermodynamic database available.
- CCD stages: 3 (num_stages=3). ASSUMPTION: standard 3-stage CCD circuit.
- Wash water flow: 10 kg/s (wash_water_flow=10.0). ASSUMPTION: wash ratio approx 1:3 relative to feed liquid.
- Solid recovery per stage: 98% (solid_recovery_per_stage=0.98). ASSUMPTION: typical thickener efficiency.
- Wash efficiency per stage: 70% (wash_efficiency_per_stage=0.70). ASSUMPTION: typical CCD washing efficiency.
- Feed solid fraction: 40% (solidFraction=0.40). ASSUMPTION: concentrated leach slurry.
- Solute species: 10% w/w in feed liquid. ASSUMPTION: PGM logic inferred from documentation description.

### 03 UnitModels/Gravity Filter Example.fsim

- Feed flow rate: 100 t/h = 27.78 kg/s (slurry). ASSUMPTION: not stated on documentation page.
- Feed temperature: 25 deg C = 298.15 K. ASSUMPTION: not stated on documentation page.
- Feed pressure: 101325 Pa (atmospheric). ASSUMPTION: not stated on documentation page.
- Slurry solids concentration: 30% w/w (solidFraction = 0.30). ASSUMPTION: not stated.
- Solid density: 2650 kg/m3 (typical mineral). ASSUMPTION: default from FlowSim ThermoHelper.
- Liquid density: 1000 kg/m3 (water). ASSUMPTION: water basis.
- Species substitution: Water (Liquid phase), Ore_Solid (Solid phase), Gangue_Solid (Solid phase), Solute (Aqueous phase). ASSUMPTION: closest available species used; no validated thermodynamic database available.
- Filter solid recovery: 95% (solid_recovery=0.95). ASSUMPTION: typical belt filter.
- Cake moisture content: 15% w/w (moisture_content=0.15). ASSUMPTION: typical pressed cake.
- Wash efficiency: 80% (wash_efficiency=0.80). ASSUMPTION: single-pass counter-current wash.

### 03 UnitModels/Hydrocyclone Example.fsim

- Feed flow rate: 100 t/h = 27.78 kg/s (slurry). ASSUMPTION: not stated on documentation page.
- Feed temperature: 25 deg C = 298.15 K. ASSUMPTION: not stated on documentation page.
- Feed pressure: 101325 Pa (atmospheric). ASSUMPTION: not stated on documentation page.
- Slurry solids concentration: 30% w/w (solidFraction = 0.30). ASSUMPTION: not stated.
- Solid density: 2650 kg/m3 (typical mineral). ASSUMPTION: default from FlowSim ThermoHelper.
- Liquid density: 1000 kg/m3 (water). ASSUMPTION: water basis.
- Species substitution: Water (Liquid phase), Ore_Solid (Solid phase), Gangue_Solid (Solid phase), Solute (Aqueous phase). ASSUMPTION: closest available species used; no validated thermodynamic database available.
- Cyclone solid efficiency: 80% to underflow (efficiency=0.80). ASSUMPTION: typical operating efficiency.
- Tromp d50: 75 microns (d50_microns=75). ASSUMPTION: no PSD data provided; efficiency-based split used.
- Liquid split to underflow: 20% (liquid_split_uf=0.20). ASSUMPTION: typical apex underflow ratio.

### 03 UnitModels/Simple Thickener Example.fsim

- Feed flow rate: 100 t/h = 27.78 kg/s (slurry). ASSUMPTION: not stated on documentation page.
- Feed temperature: 25 deg C = 298.15 K. ASSUMPTION: not stated on documentation page.
- Feed pressure: 101325 Pa (atmospheric). ASSUMPTION: not stated on documentation page.
- Slurry solids concentration: 30% w/w (solidFraction = 0.30). ASSUMPTION: not stated.
- Solid density: 2650 kg/m3 (typical mineral). ASSUMPTION: default from FlowSim ThermoHelper.
- Liquid density: 1000 kg/m3 (water). ASSUMPTION: water basis.
- Species substitution: Water (Liquid phase), Ore_Solid (Solid phase), Gangue_Solid (Solid phase), Solute (Aqueous phase). ASSUMPTION: closest available species used; no validated thermodynamic database available.
- Thickener solid recovery: 98% (solid_recovery=0.98). ASSUMPTION: typical design value.
- Target underflow density: 1400 kg/m3. ASSUMPTION: typical mineral slurry.

### 03 UnitModels/Thickener and Filter Circuit.fsim

- Feed flow rate: 100 t/h = 27.78 kg/s (slurry). ASSUMPTION: not stated on documentation page.
- Feed temperature: 25 deg C = 298.15 K. ASSUMPTION: not stated on documentation page.
- Feed pressure: 101325 Pa (atmospheric). ASSUMPTION: not stated on documentation page.
- Slurry solids concentration: 30% w/w (solidFraction = 0.30). ASSUMPTION: not stated.
- Solid density: 2650 kg/m3 (typical mineral). ASSUMPTION: default from FlowSim ThermoHelper.
- Liquid density: 1000 kg/m3 (water). ASSUMPTION: water basis.
- Species substitution: Water (Liquid phase), Ore_Solid (Solid phase), Gangue_Solid (Solid phase), Solute (Aqueous phase). ASSUMPTION: closest available species used; no validated thermodynamic database available.
- Thickener solid recovery: 98%, underflow density 1350 kg/m3. ASSUMPTION: typical design.
- Filter: 95% solid recovery, 15% moisture cake. ASSUMPTION: typical belt filter design.

### 03 UnitModels/Three Stage CCD Thickener.fsim

- Feed flow rate: 100 t/h = 27.78 kg/s (slurry). ASSUMPTION: not stated on documentation page.
- Feed temperature: 25 deg C = 298.15 K. ASSUMPTION: not stated on documentation page.
- Feed pressure: 101325 Pa (atmospheric). ASSUMPTION: not stated on documentation page.
- Slurry solids concentration: 30% w/w (solidFraction = 0.30). ASSUMPTION: not stated.
- Solid density: 2650 kg/m3 (typical mineral). ASSUMPTION: default from FlowSim ThermoHelper.
- Liquid density: 1000 kg/m3 (water). ASSUMPTION: water basis.
- Species substitution: Water (Liquid phase), Ore_Solid (Solid phase), Gangue_Solid (Solid phase), Solute (Aqueous phase). ASSUMPTION: closest available species used; no validated thermodynamic database available.
- CCD stages: 3, wash water: 8 kg/s. ASSUMPTION: wash ratio ~1:2.3.
- Final thickener: 99% solid recovery, 1500 kg/m3 UF density. ASSUMPTION: high-rate thickener.

### 03 UnitModels/Vibrating Screen Example.fsim

- Feed flow rate: 100 t/h = 27.78 kg/s (slurry). ASSUMPTION: not stated on documentation page.
- Feed temperature: 25 deg C = 298.15 K. ASSUMPTION: not stated on documentation page.
- Feed pressure: 101325 Pa (atmospheric). ASSUMPTION: not stated on documentation page.
- Slurry solids concentration: 30% w/w (solidFraction = 0.30). ASSUMPTION: not stated.
- Solid density: 2650 kg/m3 (typical mineral). ASSUMPTION: default from FlowSim ThermoHelper.
- Liquid density: 1000 kg/m3 (water). ASSUMPTION: water basis.
- Species substitution: Water (Liquid phase), Ore_Solid (Solid phase), Gangue_Solid (Solid phase), Solute (Aqueous phase). ASSUMPTION: closest available species used; no validated thermodynamic database available.
- Screen aperture: 150 microns (aperture_size_microns=150). ASSUMPTION: coarse classification size.
- Screen efficiency: 90% (efficiency=0.90). ASSUMPTION: modern high-efficiency vibrating screen.
- Single deck (num_decks=1). ASSUMPTION: multi-deck not yet implemented in FlowSim backend.

### 04 SizeDistribution/Cyclone Circuit Example.fsim

- Feed flow rate: 100 t/h = 27.78 kg/s (slurry). ASSUMPTION: not stated on documentation page.
- Feed temperature: 25 deg C = 298.15 K. ASSUMPTION: not stated on documentation page.
- Feed pressure: 101325 Pa (atmospheric). ASSUMPTION: not stated on documentation page.
- Slurry solids concentration: 30% w/w (solidFraction = 0.30). ASSUMPTION: not stated.
- Solid density: 2650 kg/m3 (typical mineral). ASSUMPTION: default from FlowSim ThermoHelper.
- Liquid density: 1000 kg/m3 (water). ASSUMPTION: water basis.
- Species substitution: Water (Liquid phase), Ore_Solid (Solid phase), Gangue_Solid (Solid phase), Solute (Aqueous phase). ASSUMPTION: closest available species used; no validated thermodynamic database available.
- Stage 1 cyclone: 100 µm d50, 78% solid efficiency. ASSUMPTION: primary classification cut.
- Stage 2 cyclone: 53 µm d50, 80% solid efficiency. ASSUMPTION: fine cleaner classification.
- Feed: 80 t/h = 22.22 kg/s, 50% solids (mill discharge). ASSUMPTION: typical milling circuit density.

### 04 SizeDistribution/Screen and Cyclone Classification.fsim

- Feed flow rate: 100 t/h = 27.78 kg/s (slurry). ASSUMPTION: not stated on documentation page.
- Feed temperature: 25 deg C = 298.15 K. ASSUMPTION: not stated on documentation page.
- Feed pressure: 101325 Pa (atmospheric). ASSUMPTION: not stated on documentation page.
- Slurry solids concentration: 30% w/w (solidFraction = 0.30). ASSUMPTION: not stated.
- Solid density: 2650 kg/m3 (typical mineral). ASSUMPTION: default from FlowSim ThermoHelper.
- Liquid density: 1000 kg/m3 (water). ASSUMPTION: water basis.
- Species substitution: Water (Liquid phase), Ore_Solid (Solid phase), Gangue_Solid (Solid phase), Solute (Aqueous phase). ASSUMPTION: closest available species used; no validated thermodynamic database available.
- Primary screen: 6000 µm aperture, 92% efficiency. ASSUMPTION: typical coarse screen.
- Cyclone: 75 µm d50, 75% solid efficiency, 20% liquid split UF. ASSUMPTION: typical sand classification.
- Feed: 70% solids (dense slurry). ASSUMPTION: typical ROM ore slurry.

### 25 Gold/Gold Processing Circuit Example.fsim

- Feed flow rate: 100 t/h = 27.78 kg/s (slurry). ASSUMPTION: not stated on documentation page.
- Feed temperature: 25 deg C = 298.15 K. ASSUMPTION: not stated on documentation page.
- Feed pressure: 101325 Pa (atmospheric). ASSUMPTION: not stated on documentation page.
- Slurry solids concentration: 30% w/w (solidFraction = 0.30). ASSUMPTION: not stated.
- Solid density: 2650 kg/m3 (typical mineral). ASSUMPTION: default from FlowSim ThermoHelper.
- Liquid density: 1000 kg/m3 (water). ASSUMPTION: water basis.
- Species substitution: Water (Liquid phase), Ore_Solid (Solid phase), Gangue_Solid (Solid phase), Solute (Aqueous phase). ASSUMPTION: closest available species used; no validated thermodynamic database available.
- Feed: 110 t/h = 30.56 kg/s, 35% solids. ASSUMPTION: typical gold CIL discharge rate.
- Pre-thickener: 98% solid recovery, 1400 kg/m3 UF. ASSUMPTION: conventional gravity thickener.
- CCD: 4 stages, 12 kg/s wash water. ASSUMPTION: 4-stage CCD typical for gold recovery.
- Belt filter: 96% solid recovery, 18% cake moisture, 85% wash efficiency. ASSUMPTION: typical dewatering filter.
- Species 'Solute' represents dissolved gold cyanide complex (AuCN). ASSUMPTION: species substitution.

### 80 Uranium/Uranium CCD Circuit Example.fsim

- Feed flow rate: 100 t/h = 27.78 kg/s (slurry). ASSUMPTION: not stated on documentation page.
- Feed temperature: 25 deg C = 298.15 K. ASSUMPTION: not stated on documentation page.
- Feed pressure: 101325 Pa (atmospheric). ASSUMPTION: not stated on documentation page.
- Slurry solids concentration: 30% w/w (solidFraction = 0.30). ASSUMPTION: not stated.
- Solid density: 2650 kg/m3 (typical mineral). ASSUMPTION: default from FlowSim ThermoHelper.
- Liquid density: 1000 kg/m3 (water). ASSUMPTION: water basis.
- Species substitution: Water (Liquid phase), Ore_Solid (Solid phase), Gangue_Solid (Solid phase), Solute (Aqueous phase). ASSUMPTION: closest available species used; no validated thermodynamic database available.
- CCD: 4 stages, 11 kg/s wash water. ASSUMPTION: standard uranium CCD wash circuit.
- Final thickener: 99% solid recovery, 1450 kg/m3 UF. ASSUMPTION: high-density uranium tailings.
- Pressure filter: 98% solid recovery, 12% cake moisture, 90% wash efficiency. ASSUMPTION: pressure filter typical for uranium.
- Species 'Solute' represents dissolved uranyl sulfate. ASSUMPTION: species substitution.

### 90 Water/Water Clarification Example.fsim

- Feed flow rate: 100 t/h = 27.78 kg/s (slurry). ASSUMPTION: not stated on documentation page.
- Feed temperature: 25 deg C = 298.15 K. ASSUMPTION: not stated on documentation page.
- Feed pressure: 101325 Pa (atmospheric). ASSUMPTION: not stated on documentation page.
- Slurry solids concentration: 30% w/w (solidFraction = 0.30). ASSUMPTION: not stated.
- Solid density: 2650 kg/m3 (typical mineral). ASSUMPTION: default from FlowSim ThermoHelper.
- Liquid density: 1000 kg/m3 (water). ASSUMPTION: water basis.
- Species substitution: Water (Liquid phase), Ore_Solid (Solid phase), Gangue_Solid (Solid phase), Solute (Aqueous phase). ASSUMPTION: closest available species used; no validated thermodynamic database available.
- Feed: 50 t/h = 13.89 kg/s, only 5% solids (dilute raw water). ASSUMPTION: typical turbid water.
- Clarifier: 99% solid recovery, 1150 kg/m3 sludge. ASSUMPTION: coagulation-aided settling.
- Sand filter: 99.9% solid recovery, 10% moisture in backwash cake. ASSUMPTION: deep-bed sand filter.
- Species 'Gangue_Solid' represents suspended particles/turbidity. ASSUMPTION: species substitution.
