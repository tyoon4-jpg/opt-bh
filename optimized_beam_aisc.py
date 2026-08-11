"""
optimized_beam_aisc.py

CIP (Cast-in-Place) Drilled-Hole Steel Beam Optimizer -- AISC 360-16 (LRFD) path.

Implements the Phase 1 workflow from the CIP Beam Optimization PRD, Section 5:
  1. Geometric fit screen against the drilled hole (net-diagonal check, Section 4).
  2. AISC 360-16 Chapter F2 flexural capacity (compact doubly-symmetric W-shapes).
  3. AISC 360-16 Chapter G2.1 shear capacity.
  4. AISC 360-16 Chapter H1 axial-flexure interaction (optional, only if Pu > 0).
  5. Exhaustive grid search over a curated W-shape catalog, ranked by weight (plf).

Units: US customary (in, kip, ksi, plf) to match the AISC catalog convention.
Hole diameter / allowance may be supplied in mm (converted internally) since
those typically come from a geotechnical / drilling submittal in SI units.

DOCUMENTED SIMPLIFICATIONS (see PRD Section 6.3 and Section 8):
  - Lr is the simplified form (no Cw/J/rts warping-torsion terms). Conservative
    for preliminary screening; replace with full AISC Manual Table 3-2/3-6
    values for any case where the construction-stage unbraced check governs.
  - Chapter G2.1 shear assumes an unstiffened, compact web (Cv1 = 1.0), which
    holds for every section in SECTION_LIBRARY below (h/tw well under the
    5.70*sqrt(E/Fy) limit for Fy <= 50 ksi).
  - The H1 interaction (optional, Pu > 0 only) needs a compression capacity
    Pc. This script computes it from AISC Chapter E3 flexural buckling using
    ry as the governing radius of gyration (conservative for these sections)
    and Q = 1 (compact-for-compression assumed, not independently verified).
    For any case where axial load is significant, verify Pc against a full
    Chapter E check including local buckling (Table B4.1a slenderness).
  - Section properties below are indicative, drawn from commonly published
    AISC values for a soldier-pile-relevant size range (W8-W14). VERIFY
    against the current AISC Steel Construction Manual before final design.
  - This is a screening/optimization tool. It does not replace a stamped
    structural calculation package (PRD Section 8).

No third-party dependencies -- Python standard library only.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

E_STEEL = 29000.0  # ksi, modulus of elasticity, all grades
MM_PER_IN = 25.4

FY_GRADES = {
    "A992/Gr50": 50.0,   # ksi -- AISC default
    "A36": 36.0,          # ksi -- alternate
}

PHI_B = 0.90   # flexure resistance factor, AISC 360-16 F1
PHI_V = 0.90   # shear resistance factor, AISC 360-16 G1 (unstiffened webs)
PHI_C = 0.90   # compression resistance factor, AISC 360-16 E1


# ---------------------------------------------------------------------------
# Section catalog -- W-shapes, soldier-pile-relevant range (W8 - W14)
# Properties: d, bf, tw, tf (in); A (in^2); Ix, Iy (in^4); Sx (in^3);
#             Zx (in^3); rx, ry (in). Weight in plf.
# Indicative values -- verify against AISC Steel Construction Manual (16th ed).
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class WShape:
    name: str
    weight: float   # plf
    d: float        # in
    bf: float       # in
    tw: float       # in
    tf: float       # in
    A: float        # in^2
    Ix: float       # in^4
    Sx: float       # in^3
    Zx: float       # in^3
    rx: float       # in
    Iy: float       # in^4
    ry: float       # in

    @property
    def diagonal_in(self) -> float:
        """Corner-to-corner cross-sectional diagonal, PRD Section 4.1."""
        return math.hypot(self.d, self.bf)


SECTION_LIBRARY: list[WShape] = [
    WShape("W8x31",  31, 8.00,  7.995, 0.285, 0.435,  9.13,  110, 27.5, 30.4, 3.47,  37.0, 2.02),
    WShape("W8x40",  40, 8.25,  8.077, 0.360, 0.560, 11.70,  146, 35.5, 39.8, 3.53,  49.0, 2.04),
    WShape("W8x48",  48, 8.50,  8.117, 0.400, 0.685, 14.10,  184, 43.2, 49.0, 3.61,  60.9, 2.08),
    WShape("W8x58",  58, 8.75,  8.222, 0.510, 0.810, 17.10,  228, 52.0, 59.8, 3.65,  75.1, 2.10),
    WShape("W10x33", 33, 9.73,  7.964, 0.290, 0.435,  9.71,  171, 35.0, 38.8, 4.19,  36.6, 1.94),
    WShape("W10x45", 45, 10.10, 8.020, 0.350, 0.620, 13.30,  248, 49.1, 54.9, 4.32,  53.4, 1.98),
    WShape("W10x60", 60, 10.20, 10.08, 0.420, 0.680, 17.60,  341, 66.7, 74.6, 4.39, 116.0, 2.57),
    WShape("W10x77", 77, 10.60, 10.19, 0.530, 0.870, 22.60,  455, 85.9, 97.6, 4.49, 145.0, 2.60),
    WShape("W12x40", 40, 11.90, 8.005, 0.295, 0.515, 11.70,  307, 51.5, 57.0, 5.13,  44.1, 1.94),
    WShape("W12x53", 53, 12.10, 9.995, 0.345, 0.575, 15.60,  425, 70.6, 77.9, 5.23,  95.8, 2.48),
    WShape("W12x65", 65, 12.10, 12.00, 0.390, 0.605, 19.10,  533, 87.9, 96.8, 5.28, 174.0, 3.02),
    WShape("W12x87", 87, 12.50, 12.13, 0.515, 0.810, 25.60,  740, 118.0, 132.0, 5.38, 241.0, 3.07),
    WShape("W14x48", 48, 13.80, 8.030, 0.340, 0.595, 14.10,  484, 70.2, 78.4, 5.85,  51.4, 1.91),
    WShape("W14x61", 61, 13.90, 9.995, 0.375, 0.645, 17.90,  640, 92.1, 102.0, 5.98, 107.0, 2.45),
    WShape("W14x82", 82, 14.30, 10.13, 0.510, 0.855, 24.00,  881, 123.0, 139.0, 6.05, 148.0, 2.48),
    WShape("W14x99", 99, 14.20, 14.57, 0.485, 0.780, 29.10, 1110, 157.0, 173.0, 6.17, 402.0, 3.71),
]


# ---------------------------------------------------------------------------
# Section 4 -- Geometric fit (net diagonal)
# ---------------------------------------------------------------------------

def net_diagonal_in(hole_dia_mm: float, allowance_mm: float, basis: str = "per_side") -> float:
    """D_net per PRD Section 4.1, converted to inches.

    basis="per_side" (tool default): D_net = D_hole - 2C
    basis="total":                   D_net = D_hole - C
    """
    if basis == "per_side":
        d_net_mm = hole_dia_mm - 2.0 * allowance_mm
    elif basis == "total":
        d_net_mm = hole_dia_mm - allowance_mm
    else:
        raise ValueError("basis must be 'per_side' or 'total'")
    return d_net_mm / MM_PER_IN


def fits_hole(section: WShape, d_net_in: float) -> bool:
    return section.diagonal_in <= d_net_in


# ---------------------------------------------------------------------------
# Section 6.1 -- AISC 360-16 capacity checks
# ---------------------------------------------------------------------------

def flexural_capacity_F2(section: WShape, Fy: float, Lb: float, Cb: float = 1.0) -> dict:
    """Chapter F2 nominal/available flexural strength, compact doubly-symmetric I-shape.

    Lb: laterally unbraced length (in). Use Lb=0 for the grout-braced,
    continuously-restrained in-service condition (Mn = Mp governs directly).
    """
    ry, Sx, Zx = section.ry, section.Sx, section.Zx
    Mp = Fy * Zx  # kip-in

    Lp = 1.76 * ry * math.sqrt(E_STEEL / Fy)
    Lr = math.pi * ry * math.sqrt(E_STEEL / (0.7 * Fy))  # simplified, PRD 6.3

    if Lb <= Lp:
        Mn = Mp
        regime = "plastic (Lb<=Lp)"
    elif Lb <= Lr:
        Mn = Cb * (Mp - (Mp - 0.7 * Fy * Sx) * (Lb - Lp) / (Lr - Lp))
        Mn = min(Mn, Mp)
        regime = "inelastic LTB (Lp<Lb<=Lr)"
    else:
        Mn = Cb * Mp * (Lr / Lb) ** 2
        Mn = min(Mn, Mp)
        regime = "elastic LTB (Lb>Lr, approx.)"

    phiMn = PHI_B * Mn
    return {"Mp": Mp, "Lp": Lp, "Lr": Lr, "Mn": Mn, "phiMn": phiMn, "regime": regime}


def shear_capacity_G21(section: WShape, Fy: float, Cv1: float = 1.0) -> dict:
    """Chapter G2.1 nominal/available shear strength, unstiffened compact web."""
    Aw = section.d * section.tw
    Vn = 0.6 * Fy * Aw * Cv1
    phiVn = PHI_V * Vn
    return {"Aw": Aw, "Vn": Vn, "phiVn": phiVn}


def compression_capacity_E3(section: WShape, Fy: float, KL: float) -> dict:
    """Simplified Chapter E3 flexural buckling capacity, governing about ry.

    Q = 1 (compact-for-compression) assumed -- not independently checked
    against Table B4.1a local-buckling slenderness. Used only to support the
    optional H1 interaction check; verify with a full Chapter E calc when
    Pu is a significant fraction of demand.
    """
    A = section.A
    if KL <= 0:
        Fcr = Fy
    else:
        Fe = math.pi ** 2 * E_STEEL / (KL / section.ry) ** 2
        if Fy / Fe <= 2.25:
            Fcr = (0.658 ** (Fy / Fe)) * Fy
        else:
            Fcr = 0.877 * Fe
    Pn = Fcr * A
    phiPn = PHI_C * Pn
    return {"Fcr": Fcr, "Pn": Pn, "phiPn": phiPn}


def interaction_H1(Pr: float, Pc: float, Mr: float, Mc: float) -> dict:
    """Chapter H1 combined axial-flexure interaction (H1-1a / H1-1b)."""
    ratio_p = Pr / Pc if Pc > 0 else float("inf")
    if ratio_p >= 0.2:
        util = ratio_p + (8.0 / 9.0) * (Mr / Mc)
        eq = "H1-1a"
    else:
        util = ratio_p / 2.0 + (Mr / Mc)
        eq = "H1-1b"
    return {"utilization": util, "equation": eq, "passes": util <= 1.0}


# ---------------------------------------------------------------------------
# Section 5 -- End-to-end selection / grid search
# ---------------------------------------------------------------------------

@dataclass
class DesignInputs:
    hole_dia_mm: float
    allowance_mm: float
    allowance_basis: str = "per_side"     # "per_side" or "total"
    Fy: float = FY_GRADES["A992/Gr50"]
    Mu: float = 0.0                        # kip-in, factored moment demand
    Vu: float = 0.0                        # kip, factored shear demand
    Pu: float = 0.0                        # kip, factored axial demand (0 = flexure-shear only)
    Lb_service: float = 0.0                # in, grout-braced -> 0
    Lb_construction: float = 0.0           # in, unbraced construction/handling stage (0 = not governing)
    Cb: float = 1.0


@dataclass
class SectionResult:
    section: WShape
    d_net_in: float
    fits: bool
    governing_Lb: float
    governing_stage: str
    flexure: dict
    shear: dict
    interaction: Optional[dict]
    utilization_flexure: float
    utilization_shear: float
    passes_all: bool


def evaluate_section(section: WShape, inp: DesignInputs, d_net_in: float) -> SectionResult:
    fits = fits_hole(section, d_net_in)

    # Check both bracing conditions per PRD Section 5, take the controlling (lower-capacity) case.
    flex_service = flexural_capacity_F2(section, inp.Fy, inp.Lb_service, inp.Cb)
    if inp.Lb_construction > 0:
        flex_construction = flexural_capacity_F2(section, inp.Fy, inp.Lb_construction, inp.Cb)
        if flex_construction["phiMn"] < flex_service["phiMn"]:
            flexure, governing_Lb, governing_stage = flex_construction, inp.Lb_construction, "construction (unbraced)"
        else:
            flexure, governing_Lb, governing_stage = flex_service, inp.Lb_service, "grout-braced (in-service)"
    else:
        flexure, governing_Lb, governing_stage = flex_service, inp.Lb_service, "grout-braced (in-service)"

    shear = shear_capacity_G21(section, inp.Fy)

    util_flex = inp.Mu / flexure["phiMn"] if flexure["phiMn"] > 0 else float("inf")
    util_shear = inp.Vu / shear["phiVn"] if shear["phiVn"] > 0 else float("inf")

    interaction = None
    passes_flex_shear = util_flex <= 1.0 and util_shear <= 1.0

    if inp.Pu > 0:
        comp = compression_capacity_E3(section, inp.Fy, KL=max(governing_Lb, 1.0))
        interaction = interaction_H1(inp.Pu, comp["phiPn"], inp.Mu, flexure["phiMn"])
        passes = fits and interaction["passes"] and util_shear <= 1.0
    else:
        passes = fits and passes_flex_shear

    return SectionResult(
        section=section,
        d_net_in=d_net_in,
        fits=fits,
        governing_Lb=governing_Lb,
        governing_stage=governing_stage,
        flexure=flexure,
        shear=shear,
        interaction=interaction,
        utilization_flexure=util_flex,
        utilization_shear=util_shear,
        passes_all=passes,
    )


def optimize(inp: DesignInputs, library: list[WShape] = SECTION_LIBRARY) -> list[SectionResult]:
    """Exhaustive grid search (PRD Section 7.1): evaluate every catalog section,
    return admissible ones ranked lightest-first. Guaranteed global optimum
    within the catalog since the library is small and finite.
    """
    d_net_in = net_diagonal_in(inp.hole_dia_mm, inp.allowance_mm, inp.allowance_basis)
    results = [evaluate_section(s, inp, d_net_in) for s in library]
    admissible = [r for r in results if r.passes_all]
    admissible.sort(key=lambda r: r.section.weight)
    return admissible


def format_report(inp: DesignInputs, results: list[SectionResult], library: list[WShape] = SECTION_LIBRARY) -> str:
    d_net_in = net_diagonal_in(inp.hole_dia_mm, inp.allowance_mm, inp.allowance_basis)
    lines = []
    lines.append("=" * 78)
    lines.append("CIP Beam Optimizer -- AISC 360-16 (LRFD)")
    lines.append("=" * 78)
    lines.append(f"Hole diameter D_hole   = {inp.hole_dia_mm:.0f} mm ({inp.hole_dia_mm/MM_PER_IN:.2f} in)")
    lines.append(f"Allowance C ({inp.allowance_basis})   = {inp.allowance_mm:.0f} mm")
    lines.append(f"Net diagonal D_net     = {d_net_in*MM_PER_IN:.0f} mm ({d_net_in:.2f} in)")
    lines.append(f"Steel grade Fy         = {inp.Fy:.0f} ksi")
    lines.append(f"Demand: Mu={inp.Mu:.1f} kip-in  Vu={inp.Vu:.1f} kip  Pu={inp.Pu:.1f} kip")
    lines.append("-" * 78)

    if not results:
        lines.append("NO ADMISSIBLE SECTION -- no catalog section both fits the hole and passes")
        lines.append("all applicable strength checks. Widen the hole, raise the allowance tier,")
        lines.append("reduce demand, or extend SECTION_LIBRARY with additional/heavier shapes.")
        lines.append("=" * 78)
        return "\n".join(lines)

    lines.append(f"{'Section':<10}{'Wt(plf)':>9}{'Diag(in)':>10}  {'Governing stage':<24}{'Flex Util':>11}{'Shear Util':>12}")
    for r in results:
        lines.append(
            f"{r.section.name:<10}{r.section.weight:>9.0f}{r.section.diagonal_in:>10.2f}  "
            f"{r.governing_stage:<24}{r.utilization_flexure:>11.2f}{r.utilization_shear:>12.2f}"
        )
    optimum = results[0]
    lines.append("-" * 78)
    lines.append(f"OPTIMUM (lightest admissible): {optimum.section.name}  ({optimum.section.weight:.0f} plf)")
    lines.append("=" * 78)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Worked example -- PRD Section 4.3
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    demo = DesignInputs(
        hole_dia_mm=610.0,
        allowance_mm=75.0,
        allowance_basis="per_side",
        Fy=FY_GRADES["A992/Gr50"],
        Mu=1500.0,   # kip-in, illustrative factored moment demand
        Vu=30.0,     # kip, illustrative factored shear demand
        Pu=0.0,
        Lb_service=0.0,
        Lb_construction=120.0,  # in, illustrative 10 ft unbraced construction stage
    )
    results = optimize(demo)
    print(format_report(demo, results))
