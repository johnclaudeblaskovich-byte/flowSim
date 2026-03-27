#!/usr/bin/env python3
"""
FlowSim Example Project Generator

Generates 12 .fsim example project files (ZIP archives containing project.json)
corresponding to SysCAD example categories. Each project uses only unit models
that have implemented backend solvers:
  Feeder, FeederSink, Thickener, Filter, Washer (CCD), Cyclone, Screen.

Run from the repo root:
    python examples/_generate_examples.py
"""

import json
import pathlib
import uuid
import zipfile

EXAMPLES_DIR = pathlib.Path(__file__).parent

# ─── Common assumptions applied to all projects ───────────────────────────────
COMMON_ASSUMPTIONS = [
    "Feed flow rate: 100 t/h = 27.78 kg/s (slurry). ASSUMPTION: not stated on documentation page.",
    "Feed temperature: 25 deg C = 298.15 K. ASSUMPTION: not stated on documentation page.",
    "Feed pressure: 101325 Pa (atmospheric). ASSUMPTION: not stated on documentation page.",
    "Slurry solids concentration: 30% w/w (solidFraction = 0.30). ASSUMPTION: not stated.",
    "Solid density: 2650 kg/m3 (typical mineral). ASSUMPTION: default from FlowSim ThermoHelper.",
    "Liquid density: 1000 kg/m3 (water). ASSUMPTION: water basis.",
    "Species substitution: Water (Liquid phase), Ore_Solid (Solid phase), Gangue_Solid (Solid phase), Solute (Aqueous phase). ASSUMPTION: closest available species used; no validated thermodynamic database available.",
]

SOLVER_SETTINGS = {
    "maxIterations": 200,
    "convergenceTolerance": 1e-6,
    "dampingFactor": 0.5,
    "tearMethod": "DirectSubstitution",
}


def uid() -> str:
    return str(uuid.uuid4())


def feeder_node(tag: str, label: str, x: float, y: float,
                mass_flow: float = 27.78, solid_frac: float = 0.30,
                species: dict | None = None) -> dict:
    if species is None:
        species = {"Water": 1.0 - solid_frac, "Ore_Solid": solid_frac}
    return {
        "id": uid(), "tag": tag, "type": "Feeder", "label": label,
        "position": {"x": x, "y": y}, "symbolKey": "Feeder",
        "enabled": True, "subModels": [], "solveStatus": "idle",
        "errorMessages": [], "ports": [],
        "config": {
            "massFlow": mass_flow,
            "temperature": 298.15,
            "pressure": 101325.0,
            "solidFraction": solid_frac,
            "species": species,
        },
    }


def sink_node(tag: str, label: str, x: float, y: float) -> dict:
    return {
        "id": uid(), "tag": tag, "type": "FeederSink", "label": label,
        "position": {"x": x, "y": y}, "symbolKey": "FeederSink",
        "enabled": True, "subModels": [], "solveStatus": "idle",
        "errorMessages": [], "ports": [], "config": {},
    }


def unit_node(tag: str, unit_type: str, label: str, x: float, y: float,
              config: dict | None = None) -> dict:
    return {
        "id": uid(), "tag": tag, "type": unit_type, "label": label,
        "position": {"x": x, "y": y}, "symbolKey": unit_type,
        "enabled": True, "subModels": [], "solveStatus": "idle",
        "errorMessages": [], "ports": [], "config": config or {},
    }


def edge(src_node: dict, dst_node: dict, tag: str,
         src_handle: str = "outlet", dst_handle: str = "inlet") -> dict:
    return {
        "id": uid(), "tag": tag,
        "source": src_node["id"], "target": dst_node["id"],
        "sourceHandle": src_handle, "targetHandle": dst_handle,
        "sourceTag": src_node["tag"], "targetTag": dst_node["tag"],
        "config": {"simplified": True},
    }


def project(name: str, description: str, flowsheets: list,
            species: list, assumptions: list, syscad_ref: str) -> dict:
    now = "2026-03-21T00:00:00Z"
    return {
        "__assumptions__": COMMON_ASSUMPTIONS + assumptions,
        "__syscad_reference__": syscad_ref,
        "id": uid(),
        "name": name,
        "description": description,
        "createdAt": now,
        "modifiedAt": now,
        "solveMode": "ProBal",
        "heatMode": "MassBalance",
        "selectedSpecies": species,
        "flowsheets": flowsheets,
        "solverSettings": SOLVER_SETTINGS,
    }


def flowsheet(name: str, nodes: list, edges: list) -> dict:
    return {
        "id": uid(), "name": name, "order": 0,
        "nodes": nodes, "edges": edges,
        "annotations": [],
        "viewport": {"x": 0, "y": 0, "zoom": 1},
    }


def write_fsim(rel_path: str, proj: dict) -> pathlib.Path:
    out = EXAMPLES_DIR / rel_path
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("project.json", json.dumps(proj, indent=2))
    return out


# ─── 1. Simple Thickener Example ──────────────────────────────────────────────

def make_simple_thickener():
    fdr = feeder_node("FDR_001", "Slurry Feed", 50, 200)
    thkr = unit_node("THKR_001", "Thickener", "Thickener", 300, 200, config={
        "solid_recovery": 0.98,
        "underflow_density": 1400.0,
    })
    snk_of = sink_node("SNK_001", "Overflow (Clarified)", 550, 100)
    snk_uf = sink_node("SNK_002", "Underflow (Thickened)", 550, 300)

    nodes = [fdr, thkr, snk_of, snk_uf]
    edges = [
        edge(fdr, thkr, "P_001"),
        edge(thkr, snk_of, "P_002", src_handle="overflow"),
        edge(thkr, snk_uf, "P_003", src_handle="underflow"),
    ]
    fs = flowsheet("Main Flowsheet", nodes, edges)
    return project(
        name="Simple Thickener Example",
        description=(
            "Demonstrates a single gravity thickener separating a slurry feed into "
            "a clarified overflow and a thickened underflow. Equivalent to SysCAD "
            "03 UnitModels thickener demonstration."
        ),
        flowsheets=[fs],
        species=["Water", "Ore_Solid"],
        assumptions=[
            "Thickener solid recovery: 98% (solid_recovery=0.98). ASSUMPTION: typical design value.",
            "Target underflow density: 1400 kg/m3. ASSUMPTION: typical mineral slurry.",
        ],
        syscad_ref="SysCAD 03 UnitModels — Thickener unit operation demonstration",
    )


# ─── 2. Gravity Filter Example ────────────────────────────────────────────────

def make_gravity_filter():
    fdr = feeder_node("FDR_001", "Slurry Feed", 50, 200)
    fltr = unit_node("FLTR_001", "Filter", "Belt Filter", 300, 200, config={
        "solid_recovery": 0.95,
        "moisture_content": 0.15,
        "wash_efficiency": 0.80,
    })
    snk_cake = sink_node("SNK_001", "Filter Cake", 550, 130)
    snk_filt = sink_node("SNK_002", "Filtrate", 550, 270)

    nodes = [fdr, fltr, snk_cake, snk_filt]
    edges = [
        edge(fdr, fltr, "P_001"),
        edge(fltr, snk_cake, "P_002", src_handle="cake"),
        edge(fltr, snk_filt, "P_003", src_handle="filtrate"),
    ]
    fs = flowsheet("Main Flowsheet", nodes, edges)
    return project(
        name="Gravity Filter Example",
        description=(
            "Demonstrates a solid-liquid belt filter separating a mineral slurry "
            "into a washed filter cake and clarified filtrate. Equivalent to "
            "SysCAD 03 UnitModels Filter unit demonstration."
        ),
        flowsheets=[fs],
        species=["Water", "Ore_Solid"],
        assumptions=[
            "Filter solid recovery: 95% (solid_recovery=0.95). ASSUMPTION: typical belt filter.",
            "Cake moisture content: 15% w/w (moisture_content=0.15). ASSUMPTION: typical pressed cake.",
            "Wash efficiency: 80% (wash_efficiency=0.80). ASSUMPTION: single-pass counter-current wash.",
        ],
        syscad_ref="SysCAD 03 UnitModels — Filter unit operation demonstration",
    )


# ─── 3. Hydrocyclone Example ──────────────────────────────────────────────────

def make_hydrocyclone():
    fdr = feeder_node("FDR_001", "Slurry Feed", 50, 200)
    cycl = unit_node("CYCL_001", "Cyclone", "Hydrocyclone", 300, 200, config={
        "efficiency": 0.80,
        "d50_microns": 75.0,
        "liquid_split_uf": 0.20,
    })
    snk_of = sink_node("SNK_001", "Overflow (Fines)", 550, 100)
    snk_uf = sink_node("SNK_002", "Underflow (Coarse)", 550, 300)

    nodes = [fdr, cycl, snk_of, snk_uf]
    edges = [
        edge(fdr, cycl, "P_001"),
        edge(cycl, snk_of, "P_002", src_handle="overflow"),
        edge(cycl, snk_uf, "P_003", src_handle="underflow"),
    ]
    fs = flowsheet("Main Flowsheet", nodes, edges)
    return project(
        name="Hydrocyclone Example",
        description=(
            "Demonstrates a hydrocyclone classifier separating feed into fine "
            "(overflow) and coarse (underflow) fractions by centrifugal classification. "
            "Equivalent to SysCAD 03 UnitModels Hydrocyclone demonstration."
        ),
        flowsheets=[fs],
        species=["Water", "Ore_Solid"],
        assumptions=[
            "Cyclone solid efficiency: 80% to underflow (efficiency=0.80). ASSUMPTION: typical operating efficiency.",
            "Tromp d50: 75 microns (d50_microns=75). ASSUMPTION: no PSD data provided; efficiency-based split used.",
            "Liquid split to underflow: 20% (liquid_split_uf=0.20). ASSUMPTION: typical apex underflow ratio.",
        ],
        syscad_ref="SysCAD 03 UnitModels — Cyclone/Hydrocyclone unit demonstration",
    )


# ─── 4. Vibrating Screen Example ─────────────────────────────────────────────

def make_vibrating_screen():
    fdr = feeder_node("FDR_001", "Feed", 50, 200)
    scr = unit_node("SCR_001", "Screen", "Vibrating Screen", 300, 200, config={
        "aperture_size_microns": 150.0,
        "efficiency": 0.90,
        "num_decks": 1,
    })
    snk_over = sink_node("SNK_001", "Oversize (+150 µm)", 550, 100)
    snk_under = sink_node("SNK_002", "Undersize (-150 µm)", 550, 300)

    nodes = [fdr, scr, snk_over, snk_under]
    edges = [
        edge(fdr, scr, "P_001"),
        edge(scr, snk_over, "P_002", src_handle="oversize"),
        edge(scr, snk_under, "P_003", src_handle="undersize"),
    ]
    fs = flowsheet("Main Flowsheet", nodes, edges)
    return project(
        name="Vibrating Screen Example",
        description=(
            "Demonstrates a single-deck vibrating screen classifying a mineral feed "
            "at a 150 µm aperture into oversize and undersize fractions. Equivalent "
            "to SysCAD 04 SizeDistribution Screen demonstration."
        ),
        flowsheets=[fs],
        species=["Water", "Ore_Solid"],
        assumptions=[
            "Screen aperture: 150 microns (aperture_size_microns=150). ASSUMPTION: coarse classification size.",
            "Screen efficiency: 90% (efficiency=0.90). ASSUMPTION: modern high-efficiency vibrating screen.",
            "Single deck (num_decks=1). ASSUMPTION: multi-deck not yet implemented in FlowSim backend.",
        ],
        syscad_ref="SysCAD 04 SizeDistribution — Screen unit operation demonstration",
    )


# ─── 5. Counter Current Washer Example ───────────────────────────────────────

def make_ccd_washer():
    fdr_slurry = feeder_node("FDR_001", "Leach Slurry Feed", 50, 200,
                              mass_flow=27.78, solid_frac=0.40,
                              species={"Water": 0.50, "Ore_Solid": 0.40, "Solute": 0.10})
    wshr = unit_node("WSHR_001", "Washer", "CCD Washer (3-Stage)", 300, 200, config={
        "num_stages": 3,
        "wash_water_flow": 10.0,
        "solid_recovery_per_stage": 0.98,
        "wash_efficiency_per_stage": 0.70,
    })
    snk_liquor = sink_node("SNK_001", "Product Liquor (Stage 1 OF)", 550, 100)
    snk_solids = sink_node("SNK_002", "Washed Solids (Stage N UF)", 550, 300)

    nodes = [fdr_slurry, wshr, snk_liquor, snk_solids]
    edges = [
        edge(fdr_slurry, wshr, "P_001"),
        edge(wshr, snk_liquor, "P_002", src_handle="product_liquor"),
        edge(wshr, snk_solids, "P_003", src_handle="washed_solids"),
    ]
    fs = flowsheet("Main Flowsheet", nodes, edges)
    return project(
        name="Counter Current Washer Example",
        description=(
            "3-stage counter-current decantation (CCD) washing circuit. Leach slurry "
            "containing dissolved values enters Stage 1; wash water enters counter-currently "
            "at Stage 3. Product liquor exits Stage 1 overflow; washed solids exit Stage 3 "
            "underflow. Equivalent to SysCAD 03 UnitModels Counter Current Washer Example."
        ),
        flowsheets=[fs],
        species=["Water", "Ore_Solid", "Solute"],
        assumptions=[
            "CCD stages: 3 (num_stages=3). ASSUMPTION: standard 3-stage CCD circuit.",
            "Wash water flow: 10 kg/s (wash_water_flow=10.0). ASSUMPTION: wash ratio approx 1:3 relative to feed liquid.",
            "Solid recovery per stage: 98% (solid_recovery_per_stage=0.98). ASSUMPTION: typical thickener efficiency.",
            "Wash efficiency per stage: 70% (wash_efficiency_per_stage=0.70). ASSUMPTION: typical CCD washing efficiency.",
            "Feed solid fraction: 40% (solidFraction=0.40). ASSUMPTION: concentrated leach slurry.",
            "Solute species: 10% w/w in feed liquid. ASSUMPTION: PGM logic inferred from documentation description.",
        ],
        syscad_ref="SysCAD 03 UnitModels Projects 2 — Counter Current Washer (CCWasher & Washer) Example",
    )


# ─── 6. Thickener and Filter Circuit ─────────────────────────────────────────

def make_thickener_filter_circuit():
    fdr = feeder_node("FDR_001", "Feed Slurry", 50, 200)
    thkr = unit_node("THKR_001", "Thickener", "Gravity Thickener", 280, 200, config={
        "solid_recovery": 0.98,
        "underflow_density": 1350.0,
    })
    fltr = unit_node("FLTR_001", "Filter", "Belt Filter", 520, 300, config={
        "solid_recovery": 0.95,
        "moisture_content": 0.15,
        "wash_efficiency": 0.80,
    })
    snk_of = sink_node("SNK_001", "Thickener Overflow", 530, 100)
    snk_cake = sink_node("SNK_002", "Filter Cake", 760, 230)
    snk_filt = sink_node("SNK_003", "Filtrate Return", 760, 370)

    nodes = [fdr, thkr, fltr, snk_of, snk_cake, snk_filt]
    edges = [
        edge(fdr, thkr, "P_001"),
        edge(thkr, snk_of, "P_002", src_handle="overflow"),
        edge(thkr, fltr, "P_003", src_handle="underflow"),
        edge(fltr, snk_cake, "P_004", src_handle="cake"),
        edge(fltr, snk_filt, "P_005", src_handle="filtrate"),
    ]
    fs = flowsheet("Main Flowsheet", nodes, edges)
    return project(
        name="Thickener and Filter Circuit",
        description=(
            "Two-stage solid-liquid separation circuit. A gravity thickener pre-concentrates "
            "the slurry; the thickened underflow is dewatered on a belt filter to produce "
            "a filter cake. Overflow from both units reports to the liquor circuit."
        ),
        flowsheets=[fs],
        species=["Water", "Ore_Solid"],
        assumptions=[
            "Thickener solid recovery: 98%, underflow density 1350 kg/m3. ASSUMPTION: typical design.",
            "Filter: 95% solid recovery, 15% moisture cake. ASSUMPTION: typical belt filter design.",
        ],
        syscad_ref="SysCAD 03 UnitModels — combined Thickener + Filter circuit",
    )


# ─── 7. Three Stage CCD Thickener ─────────────────────────────────────────────

def make_three_stage_ccd():
    # Feed + wash water → Washer → Thickener (dewater underflow) → sinks
    fdr_feed = feeder_node("FDR_001", "Leach Feed", 50, 200,
                            mass_flow=27.78, solid_frac=0.35,
                            species={"Water": 0.55, "Ore_Solid": 0.35, "Solute": 0.10})
    wshr = unit_node("WSHR_001", "Washer", "CCD Washer (3-Stage)", 300, 200, config={
        "num_stages": 3,
        "wash_water_flow": 8.0,
        "solid_recovery_per_stage": 0.98,
        "wash_efficiency_per_stage": 0.75,
    })
    thkr = unit_node("THKR_001", "Thickener", "Thickener (Dewater)", 540, 300, config={
        "solid_recovery": 0.99,
        "underflow_density": 1500.0,
    })
    snk_liquor = sink_node("SNK_001", "Rich Liquor", 540, 80)
    snk_uf_dewater = sink_node("SNK_002", "Dewatered Residue", 780, 220)
    snk_thkr_of = sink_node("SNK_003", "Thickener Overflow Return", 780, 370)

    nodes = [fdr_feed, wshr, thkr, snk_liquor, snk_uf_dewater, snk_thkr_of]
    edges = [
        edge(fdr_feed, wshr, "P_001"),
        edge(wshr, snk_liquor, "P_002", src_handle="product_liquor"),
        edge(wshr, thkr, "P_003", src_handle="washed_solids"),
        edge(thkr, snk_thkr_of, "P_004", src_handle="overflow"),
        edge(thkr, snk_uf_dewater, "P_005", src_handle="underflow"),
    ]
    fs = flowsheet("Main Flowsheet", nodes, edges)
    return project(
        name="Three Stage CCD Thickener",
        description=(
            "Three-stage CCD washing followed by a dewatering thickener. "
            "Leach slurry is counter-currently washed to recover dissolved values; "
            "the washed solids are further dewatered in a gravity thickener before "
            "disposal. Equivalent to SysCAD 03 UnitModels multi-stage CCD thickener example."
        ),
        flowsheets=[fs],
        species=["Water", "Ore_Solid", "Solute"],
        assumptions=[
            "CCD stages: 3, wash water: 8 kg/s. ASSUMPTION: wash ratio ~1:2.3.",
            "Final thickener: 99% solid recovery, 1500 kg/m3 UF density. ASSUMPTION: high-rate thickener.",
        ],
        syscad_ref="SysCAD 03 UnitModels Projects 2 — Counter Current Washer with Thickener circuit",
    )


# ─── 8. Gold Processing Circuit Example ───────────────────────────────────────

def make_gold_circuit():
    fdr = feeder_node("FDR_001", "CIL Discharge", 50, 200,
                       mass_flow=30.56, solid_frac=0.35,
                       species={"Water": 0.55, "Ore_Solid": 0.35, "Solute": 0.10})
    thkr = unit_node("THKR_001", "Thickener", "Pre-Thickener", 280, 200, config={
        "solid_recovery": 0.98,
        "underflow_density": 1400.0,
    })
    wshr = unit_node("WSHR_001", "Washer", "CCD Washer (4-Stage)", 500, 300, config={
        "num_stages": 4,
        "wash_water_flow": 12.0,
        "solid_recovery_per_stage": 0.98,
        "wash_efficiency_per_stage": 0.75,
    })
    fltr = unit_node("FLTR_001", "Filter", "Belt Filter", 720, 400, config={
        "solid_recovery": 0.96,
        "moisture_content": 0.18,
        "wash_efficiency": 0.85,
    })
    snk_liquor = sink_node("SNK_001", "Pregnant Liquor", 500, 80)
    snk_ccd_liquor = sink_node("SNK_002", "CCD Product Liquor", 720, 180)
    snk_cake = sink_node("SNK_003", "Filter Cake (Tailings)", 940, 340)
    snk_filt = sink_node("SNK_004", "Filtrate Return", 940, 470)

    nodes = [fdr, thkr, wshr, fltr, snk_liquor, snk_ccd_liquor, snk_cake, snk_filt]
    edges = [
        edge(fdr, thkr, "P_001"),
        edge(thkr, snk_liquor, "P_002", src_handle="overflow"),
        edge(thkr, wshr, "P_003", src_handle="underflow"),
        edge(wshr, snk_ccd_liquor, "P_004", src_handle="product_liquor"),
        edge(wshr, fltr, "P_005", src_handle="washed_solids"),
        edge(fltr, snk_cake, "P_006", src_handle="cake"),
        edge(fltr, snk_filt, "P_007", src_handle="filtrate"),
    ]
    fs = flowsheet("Main Flowsheet", nodes, edges)
    return project(
        name="Gold Processing Circuit Example",
        description=(
            "Gold CIP/CIL tails solid-liquid separation circuit. CIL discharge is "
            "pre-thickened; the underflow enters a 4-stage CCD wash circuit to recover "
            "dissolved gold values; the washed residue is filtered to produce a tails "
            "cake for disposal. Equivalent to SysCAD 25 Gold example project."
        ),
        flowsheets=[fs],
        species=["Water", "Ore_Solid", "Solute"],
        assumptions=[
            "Feed: 110 t/h = 30.56 kg/s, 35% solids. ASSUMPTION: typical gold CIL discharge rate.",
            "Pre-thickener: 98% solid recovery, 1400 kg/m3 UF. ASSUMPTION: conventional gravity thickener.",
            "CCD: 4 stages, 12 kg/s wash water. ASSUMPTION: 4-stage CCD typical for gold recovery.",
            "Belt filter: 96% solid recovery, 18% cake moisture, 85% wash efficiency. ASSUMPTION: typical dewatering filter.",
            "Species 'Solute' represents dissolved gold cyanide complex (AuCN). ASSUMPTION: species substitution.",
        ],
        syscad_ref="SysCAD Example 25 Gold — CIP/CIL leach circuit solid-liquid separation",
    )


# ─── 9. Uranium CCD Circuit Example ───────────────────────────────────────────

def make_uranium_circuit():
    fdr = feeder_node("FDR_001", "Leach Discharge", 50, 200,
                       mass_flow=27.78, solid_frac=0.40,
                       species={"Water": 0.50, "Ore_Solid": 0.40, "Solute": 0.10})
    wshr = unit_node("WSHR_001", "Washer", "CCD Washer (4-Stage)", 300, 200, config={
        "num_stages": 4,
        "wash_water_flow": 11.0,
        "solid_recovery_per_stage": 0.98,
        "wash_efficiency_per_stage": 0.70,
    })
    thkr = unit_node("THKR_001", "Thickener", "Final Thickener", 530, 300, config={
        "solid_recovery": 0.99,
        "underflow_density": 1450.0,
    })
    fltr = unit_node("FLTR_001", "Filter", "Pressure Filter", 750, 400, config={
        "solid_recovery": 0.98,
        "moisture_content": 0.12,
        "wash_efficiency": 0.90,
    })
    snk_liquor = sink_node("SNK_001", "Pregnant Liquor (U3O8)", 540, 80)
    snk_thkr_of = sink_node("SNK_002", "Thickener Overflow", 760, 200)
    snk_cake = sink_node("SNK_003", "Tailings Cake", 960, 330)
    snk_filt = sink_node("SNK_004", "Filtrate Return", 960, 470)

    nodes = [fdr, wshr, thkr, fltr, snk_liquor, snk_thkr_of, snk_cake, snk_filt]
    edges = [
        edge(fdr, wshr, "P_001"),
        edge(wshr, snk_liquor, "P_002", src_handle="product_liquor"),
        edge(wshr, thkr, "P_003", src_handle="washed_solids"),
        edge(thkr, snk_thkr_of, "P_004", src_handle="overflow"),
        edge(thkr, fltr, "P_005", src_handle="underflow"),
        edge(fltr, snk_cake, "P_006", src_handle="cake"),
        edge(fltr, snk_filt, "P_007", src_handle="filtrate"),
    ]
    fs = flowsheet("Main Flowsheet", nodes, edges)
    return project(
        name="Uranium CCD Circuit Example",
        description=(
            "Uranium heap leach tails solid-liquid separation circuit. Acid leach "
            "discharge enters a 4-stage CCD circuit to recover dissolved uranium; "
            "washed solids are thickened and pressure-filtered for tailings disposal. "
            "Equivalent to SysCAD 80 Uranium example project."
        ),
        flowsheets=[fs],
        species=["Water", "Ore_Solid", "Solute"],
        assumptions=[
            "CCD: 4 stages, 11 kg/s wash water. ASSUMPTION: standard uranium CCD wash circuit.",
            "Final thickener: 99% solid recovery, 1450 kg/m3 UF. ASSUMPTION: high-density uranium tailings.",
            "Pressure filter: 98% solid recovery, 12% cake moisture, 90% wash efficiency. ASSUMPTION: pressure filter typical for uranium.",
            "Species 'Solute' represents dissolved uranyl sulfate. ASSUMPTION: species substitution.",
        ],
        syscad_ref="SysCAD Example 80 Uranium — acid leach CCD circuit",
    )


# ─── 10. Water Clarification Example ──────────────────────────────────────────

def make_water_clarification():
    fdr = feeder_node("FDR_001", "Raw Water Feed", 50, 200,
                       mass_flow=13.89, solid_frac=0.05,
                       species={"Water": 0.95, "Gangue_Solid": 0.05})
    thkr = unit_node("THKR_001", "Thickener", "Clarifier", 300, 200, config={
        "solid_recovery": 0.99,
        "underflow_density": 1150.0,
    })
    fltr = unit_node("FLTR_001", "Filter", "Sand Filter", 540, 280, config={
        "solid_recovery": 0.999,
        "moisture_content": 0.10,
        "wash_efficiency": 0.95,
    })
    snk_clean = sink_node("SNK_001", "Clarified Overflow", 540, 80)
    snk_treated = sink_node("SNK_002", "Treated Water (Product)", 760, 200)
    snk_sludge = sink_node("SNK_003", "Sludge / Filter Cake", 760, 360)

    nodes = [fdr, thkr, fltr, snk_clean, snk_treated, snk_sludge]
    edges = [
        edge(fdr, thkr, "P_001"),
        edge(thkr, snk_clean, "P_002", src_handle="overflow"),
        edge(thkr, fltr, "P_003", src_handle="underflow"),
        edge(fltr, snk_treated, "P_004", src_handle="filtrate"),
        edge(fltr, snk_sludge, "P_005", src_handle="cake"),
    ]
    fs = flowsheet("Main Flowsheet", nodes, edges)
    return project(
        name="Water Clarification Example",
        description=(
            "Municipal or process water clarification circuit. Raw water passes through "
            "a gravity clarifier (thickener) to remove suspended solids; the clarified "
            "overflow is polished through a sand filter. Equivalent to SysCAD 90 Water "
            "example project."
        ),
        flowsheets=[fs],
        species=["Water", "Gangue_Solid"],
        assumptions=[
            "Feed: 50 t/h = 13.89 kg/s, only 5% solids (dilute raw water). ASSUMPTION: typical turbid water.",
            "Clarifier: 99% solid recovery, 1150 kg/m3 sludge. ASSUMPTION: coagulation-aided settling.",
            "Sand filter: 99.9% solid recovery, 10% moisture in backwash cake. ASSUMPTION: deep-bed sand filter.",
            "Species 'Gangue_Solid' represents suspended particles/turbidity. ASSUMPTION: species substitution.",
        ],
        syscad_ref="SysCAD Example 90 Water — water treatment clarification",
    )


# ─── 11. Screen and Cyclone Classification ────────────────────────────────────

def make_screen_cyclone():
    fdr = feeder_node("FDR_001", "ROM Feed", 50, 200,
                       mass_flow=27.78, solid_frac=0.70,
                       species={"Water": 0.30, "Ore_Solid": 0.70})
    scr = unit_node("SCR_001", "Screen", "Primary Screen (+6mm)", 280, 200, config={
        "aperture_size_microns": 6000.0,
        "efficiency": 0.92,
        "num_decks": 1,
    })
    cycl = unit_node("CYCL_001", "Cyclone", "Hydrocyclone (-6mm)", 510, 310, config={
        "efficiency": 0.75,
        "d50_microns": 75.0,
        "liquid_split_uf": 0.20,
    })
    snk_oversize = sink_node("SNK_001", "Oversize (+6mm)", 520, 90)
    snk_cycl_of = sink_node("SNK_002", "Cyclone Overflow (Fines)", 740, 220)
    snk_cycl_uf = sink_node("SNK_003", "Cyclone Underflow (Sand)", 740, 400)

    nodes = [fdr, scr, cycl, snk_oversize, snk_cycl_of, snk_cycl_uf]
    edges = [
        edge(fdr, scr, "P_001"),
        edge(scr, snk_oversize, "P_002", src_handle="oversize"),
        edge(scr, cycl, "P_003", src_handle="undersize"),
        edge(cycl, snk_cycl_of, "P_004", src_handle="overflow"),
        edge(cycl, snk_cycl_uf, "P_005", src_handle="underflow"),
    ]
    fs = flowsheet("Main Flowsheet", nodes, edges)
    return project(
        name="Screen and Cyclone Classification",
        description=(
            "Two-stage classification circuit: a primary vibrating screen removes coarse "
            "oversize (+6 mm); the screen undersize slurry is classified in a hydrocyclone "
            "at 75 µm to separate fine slimes (overflow) from coarse sand (underflow). "
            "Equivalent to SysCAD 04 SizeDistribution screen + cyclone example."
        ),
        flowsheets=[fs],
        species=["Water", "Ore_Solid"],
        assumptions=[
            "Primary screen: 6000 µm aperture, 92% efficiency. ASSUMPTION: typical coarse screen.",
            "Cyclone: 75 µm d50, 75% solid efficiency, 20% liquid split UF. ASSUMPTION: typical sand classification.",
            "Feed: 70% solids (dense slurry). ASSUMPTION: typical ROM ore slurry.",
        ],
        syscad_ref="SysCAD 04 SizeDistribution — screen + hydrocyclone classification circuit",
    )


# ─── 12. Cyclone Circuit Example ─────────────────────────────────────────────

def make_cyclone_circuit():
    fdr = feeder_node("FDR_001", "Mill Discharge", 50, 200,
                       mass_flow=22.22, solid_frac=0.50,
                       species={"Water": 0.50, "Ore_Solid": 0.50})
    cycl1 = unit_node("CYCL_001", "Cyclone", "Cyclone Stage 1", 280, 200, config={
        "efficiency": 0.78,
        "d50_microns": 100.0,
        "liquid_split_uf": 0.22,
    })
    cycl2 = unit_node("CYCL_002", "Cyclone", "Cyclone Stage 2 (Cleaner)", 510, 310, config={
        "efficiency": 0.80,
        "d50_microns": 53.0,
        "liquid_split_uf": 0.18,
    })
    snk_s1_uf = sink_node("SNK_001", "Stage 1 Underflow (Sand Recycle)", 520, 90)
    snk_s2_of = sink_node("SNK_002", "Final Overflow (Product Slimes)", 740, 220)
    snk_s2_uf = sink_node("SNK_003", "Stage 2 Underflow (Coarse)", 740, 400)

    nodes = [fdr, cycl1, cycl2, snk_s1_uf, snk_s2_of, snk_s2_uf]
    edges = [
        edge(fdr, cycl1, "P_001"),
        edge(cycl1, snk_s1_uf, "P_002", src_handle="underflow"),
        edge(cycl1, cycl2, "P_003", src_handle="overflow"),
        edge(cycl2, snk_s2_of, "P_004", src_handle="overflow"),
        edge(cycl2, snk_s2_uf, "P_005", src_handle="underflow"),
    ]
    fs = flowsheet("Main Flowsheet", nodes, edges)
    return project(
        name="Cyclone Circuit Example",
        description=(
            "Two-stage cyclone classification circuit for fine grinding circuits. "
            "Mill discharge is classified in a primary cyclone; the overflow is re-classified "
            "in a secondary cyclone at a finer cut to produce final product slimes. "
            "Equivalent to SysCAD 04 SizeDistribution cyclone circuit example."
        ),
        flowsheets=[fs],
        species=["Water", "Ore_Solid"],
        assumptions=[
            "Stage 1 cyclone: 100 µm d50, 78% solid efficiency. ASSUMPTION: primary classification cut.",
            "Stage 2 cyclone: 53 µm d50, 80% solid efficiency. ASSUMPTION: fine cleaner classification.",
            "Feed: 80 t/h = 22.22 kg/s, 50% solids (mill discharge). ASSUMPTION: typical milling circuit density.",
        ],
        syscad_ref="SysCAD 04 SizeDistribution — two-stage cyclone classification circuit",
    )


# ─── Main ──────────────────────────────────────────────────────────────────────

PROJECTS = [
    ("03 UnitModels/Simple Thickener Example.fsim",           make_simple_thickener),
    ("03 UnitModels/Gravity Filter Example.fsim",             make_gravity_filter),
    ("03 UnitModels/Hydrocyclone Example.fsim",               make_hydrocyclone),
    ("03 UnitModels/Vibrating Screen Example.fsim",           make_vibrating_screen),
    ("03 UnitModels/Counter Current Washer Example.fsim",     make_ccd_washer),
    ("03 UnitModels/Thickener and Filter Circuit.fsim",       make_thickener_filter_circuit),
    ("03 UnitModels/Three Stage CCD Thickener.fsim",          make_three_stage_ccd),
    ("25 Gold/Gold Processing Circuit Example.fsim",          make_gold_circuit),
    ("80 Uranium/Uranium CCD Circuit Example.fsim",           make_uranium_circuit),
    ("90 Water/Water Clarification Example.fsim",             make_water_clarification),
    ("04 SizeDistribution/Screen and Cyclone Classification.fsim", make_screen_cyclone),
    ("04 SizeDistribution/Cyclone Circuit Example.fsim",      make_cyclone_circuit),
]


if __name__ == "__main__":
    total = 0
    for rel_path, factory in PROJECTS:
        proj = factory()
        out = write_fsim(rel_path, proj)
        print(f"  Created: {out.relative_to(EXAMPLES_DIR.parent)}")
        total += 1
    print(f"\n{total} example .fsim files generated in {EXAMPLES_DIR}/")
