"""
optimized_steel_beam.py

CIP (Cast-in-Place) Drilled-Hole Steel Beam Optimizer -- EN 1993-1-1 (Eurocode 3)
and Korean Standard (KS D 3502 / KDS 21 30 00) paths.

Naming note (PRD Section 7.1): the brief specified "optimized_steel_beam.m" but
the actual deliverable content is a Python grid-search optimizer, so it is
written as optimized_steel_beam.py to match its real language. The algorithm
is directly transliterable to MATLAB/Octave if that runtime is specifically
required.

Implements the Phase 1 workflow from the CIP Beam Optimization PRD, Section 5:
  1. Geometric fit screen against the drilled hole (net-diagonal check, Section 4).
  2. EN 1993-1-1 sec 6.2.5 bending / sec 6.2.6 shear / sec 6.2.8 bending-shear
     interaction / sec 6.2.9 axial-flexure interaction (optional) / sec 6.3.2
     simplified LTB screening -- and the KS-mirrored equivalents.
  3. Exhaustive grid search over curated HE-B/HE-M/IPE and KS H-shape
     catalogs, ranked by mass (kg/m).

Units: SI (mm, N, MPa, kN, kN*m, kg/m) throughout.

DOCUMENTED SIMPLIFICATIONS (see PRD Section 6.3 and Section 8):
  - Shear area Av approximated as A - 2*b*tf + tw*tf (PRD Section 6.2), which
    omits the root-radius term of the full EN 1993-1-1 sec 6.2.6(3) expression
    -- slightly conservative.
  - LTB screening (EN sec 6.3.2) approximates the elastic critical moment Mcr
    from Iz and an approximate warping constant Iw = Iz*(h-tf)^2/4, OMITTING
    the St. Venant torsion term (It) -- conservative. Buckling curve "c"
    (alpha_LT = 0.49) is used as a documented default for all sections
    regardless of h/b ratio. Replace with a full Annex Mcr calculation (hand
    calc, LTBeam, or FE) for any case where the construction-stage unbraced
    check governs, or for stamped final design.
  - KS checks mirror the EN 1993-1-1 partial-factor formulation (gammaM0 =
    gammaM1 = 1.0) as a practical bridge consistent with KDS 21 30 00's
    resistance-based format. VERIFY against the specific KDS 21 30 00 clause
    and edition governing the project before final design -- this is NOT a
    substitute for a KDS-clause-referenced calculation.
  - Section properties below are indicative, drawn from commonly published
    EN 10365 / KS D 3502 values for a soldier-pile-relevant size range.
    VERIFY against the current producer tables before final design.
  - This is a screening/optimization tool. It does not replace a stamped
    structural calculation package (PRD Section 8).

No third-party dependencies -- Python standard library only.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

E_STEEL = 210000.0   # MPa, EN 1993-1-1 sec 3.2.6; used for KS path too
GAMMA_M0 = 1.00
GAMMA_M1 = 1.00       # simplification -- confirm National Annex / KDS value
ALPHA_LT = 0.49        # EC3 buckling curve "c", conservative default (PRD 6.3)

EN_GRADES = {"S355": 355.0, "S235": 235.0}      # MPa
KS_GRADES = {"SM490": 325.0, "SS400": 235.0, "SM520": 355.0}  # MPa, simplified (thickness-independent)


# ---------------------------------------------------------------------------
# Section catalogs
# Properties: h, b, tw, tf (mm); A (cm^2); Iy, Iz (cm^4, EN notation --
# y-y = strong axis, z-z = weak axis); Wply (cm^3, plastic modulus strong
# axis); iy, iz (cm). Mass in kg/m.
# Indicative values -- verify against EN 10365 / KS D 3502 producer tables.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class EuroShape:
    name: str
    mass: float   # kg/m
    h: float      # mm
    b: float      # mm
    tw: float     # mm
    tf: float     # mm
    A: float      # cm^2
    Iy: float     # cm^4 (strong axis)
    Wply: float   # cm^3 (plastic, strong axis)
    iy: float     # cm
    Iz: float     # cm^4 (weak axis)
    iz: float     # cm

    @property
    def diagonal_mm(self) -> float:
        """Corner-to-corner cross-sectional diagonal, PRD Section 4.1."""
        return math.hypot(self.h, self.b)


EN_SECTION_LIBRARY: list[EuroShape] = [
    EuroShape("IPE300",   42.2, 300, 150, 7.1, 10.7,  53.8,  8356,  628.0, 12.50,  603.8, 3.35),
    EuroShape("IPE330",   49.1, 330, 160, 7.5, 11.5,  62.6, 11770,  804.0, 13.70,  788.1, 3.55),
    EuroShape("IPE360",   57.1, 360, 170, 8.0, 12.7,  72.7, 16270, 1019.0, 14.95, 1043.0, 3.79),
    EuroShape("IPE400",   66.3, 400, 180, 8.6, 13.5,  84.5, 23130, 1307.0, 16.55, 1318.0, 3.95),
    EuroShape("HE200B",   61.3, 200, 200, 9.0, 15.0,  78.1,  5696,  642.5,  8.54, 2003.0, 5.07),
    EuroShape("HE220B",   71.5, 220, 220, 9.5, 16.0,  91.0,  8091,  827.0,  9.43, 2843.0, 5.59),
    EuroShape("HE200M",  103.0, 220, 206, 12.0, 25.0, 131.3, 10640, 1135.0,  9.00, 3651.0, 5.27),
    EuroShape("HE240B",   83.2, 240, 240, 10.0, 17.0, 106.0, 11260, 1053.0, 10.31, 3923.0, 6.08),
    EuroShape("HE220M",  117.0, 240, 226, 12.5, 26.0, 149.4, 14600, 1419.0,  9.89, 4954.0, 5.76),
    EuroShape("HE260B",   93.0, 260, 260, 10.0, 17.5, 118.4, 14920, 1283.0, 11.22, 5135.0, 6.58),
    EuroShape("HE280B",  103.1, 280, 280, 10.5, 18.0, 131.4, 19270, 1534.0, 12.11, 6595.0, 7.09),
    EuroShape("HE300B",  117.0, 300, 300, 11.0, 19.0, 149.1, 25170, 1869.0, 12.99, 8563.0, 7.58),
]


@dataclass(frozen=True)
class KSShape:
    name: str
    mass: float   # kg/m
    h: float      # mm
    b: float      # mm
    tw: float     # mm
    tf: float     # mm
    A: float      # cm^2
    Ix: float     # cm^4 (strong axis, KS/JIS notation)
    Sx: float     # cm^3 (elastic modulus, strong axis)
    Iy: float     # cm^4 (weak axis)
    rx: float     # cm
    ry: float     # cm

    @property
    def diagonal_mm(self) -> float:
        return math.hypot(self.h, self.b)

    @property
    def Zx(self) -> float:
        """Plastic section modulus, approximated as 1.12 * Sx (typical shape
        factor for hot-rolled wide-flange I-shapes) -- not independently
        tabulated. Documented approximation."""
        return 1.12 * self.Sx


KS_SECTION_LIBRARY: list[KSShape] = [
    KSShape("H-150x150x7x10",   31.5, 150, 150, 7.0, 10.0,  40.14,  1640,  219.0,   563.0,  6.39, 3.75),
    KSShape("H-198x99x4.5x7",   17.8, 198,  99, 4.5,  7.0,  22.68,  1610,  163.0,   113.0,  8.43, 2.23),
    KSShape("H-175x175x7.5x11", 40.2, 175, 175, 7.5, 11.0,  51.21,  2880,  329.0,   984.0,  7.50, 4.38),
    KSShape("H-248x124x5x8",    25.7, 248, 124, 5.0,  8.0,  32.68,  3450,  278.0,   255.0, 10.27, 2.79),
    KSShape("H-200x200x8x12",   49.9, 200, 200, 8.0, 12.0,  63.53,  4720,  472.0,  1600.0,  8.62, 5.02),
    KSShape("H-298x149x5.5x8",  32.0, 298, 149, 5.5,  8.0,  40.80,  6460,  433.0,   443.0, 12.58, 3.29),
    KSShape("H-250x250x9x14",   72.4, 250, 250, 9.0, 14.0,  92.18, 10800,  864.0,  3650.0, 10.80, 6.29),
    KSShape("H-346x174x6x9",    41.4, 346, 174, 6.0,  9.0,  52.45, 11200,  649.0,   792.0, 14.60, 3.88),
    KSShape("H-420x230x8x13",   72.0, 420, 230, 8.0, 13.0,  91.70, 29400, 1400.0,  2636.0, 17.90, 5.36),
    KSShape("H-300x300x10x15",  94.0, 300, 300, 10.0, 15.0, 118.50, 20200, 1350.0,  6750.0, 13.10, 7.55),
    KSShape("H-396x199x7x11",   56.7, 396, 199, 7.0, 11.0,  72.16, 20000, 1010.0,  1450.0, 16.70, 4.48),
    KSShape("H-450x200x9x14",   76.0, 450, 200, 9.0, 14.0,  96.76, 33500, 1490.0,  1870.0, 18.60, 4.40),
    KSShape("H-446x199x8x12",   66.7, 446, 199, 8.0, 12.0,  84.95, 28700, 1290.0,  1580.0, 18.40, 4.31),
    KSShape("H-350x350x12x19", 136.0, 350, 350, 12.0, 19.0, 173.90, 40300, 2300.0, 13600.0, 15.20, 8.84),
    KSShape("H-400x400x13x21", 172.0, 400, 400, 13.0, 21.0, 214.40, 66600, 3330.0, 22400.0, 17.60, 10.20),
]


# ---------------------------------------------------------------------------
# Section 4 -- Geometric fit (net diagonal)
# ---------------------------------------------------------------------------

def net_diagonal_mm(hole_dia_mm: float, allowance_mm: float, basis: str = "per_side") -> float:
    if basis == "per_side":
        return hole_dia_mm - 2.0 * allowance_mm
    elif basis == "total":
        return hole_dia_mm - allowance_mm
    raise ValueError("basis must be 'per_side' or 'total'")


def fits_hole(diagonal_mm: float, d_net_mm: float) -> bool:
    return diagonal_mm <= d_net_mm


# ---------------------------------------------------------------------------
# Section 6.2 -- EN 1993-1-1 capacity checks
# ---------------------------------------------------------------------------

def en_shear_area_mm2(A_cm2: float, b_mm: float, tf_mm: float, tw_mm: float) -> float:
    """Av ~= A - 2*b*tf + tw*tf, PRD Section 6.2 simplified form (mm^2)."""
    A_mm2 = A_cm2 * 100.0
    return A_mm2 - 2.0 * b_mm * tf_mm + tw_mm * tf_mm


def en_bending_resistance(Wply_cm3: float, fy: float) -> float:
    """Mc,Rd = Wpl,y * fy / gammaM0, sec 6.2.5. Returns kN*m."""
    Wply_mm3 = Wply_cm3 * 1e3
    Mc_Rd_Nmm = Wply_mm3 * fy / GAMMA_M0
    return Mc_Rd_Nmm / 1e6  # N*mm -> kN*m


def en_shear_resistance(Av_mm2: float, fy: float) -> float:
    """Vpl,Rd = Av * (fy/sqrt(3)) / gammaM0, sec 6.2.6. Returns kN."""
    Vpl_Rd_N = Av_mm2 * (fy / math.sqrt(3.0)) / GAMMA_M0
    return Vpl_Rd_N / 1e3


def en_bending_shear_interaction(VEd_kN: float, Vpl_Rd_kN: float, Wply_cm3: float,
                                  Av_mm2: float, tw_mm: float, fy: float) -> float:
    """sec 6.2.8: reduced bending resistance when VEd > 0.5*Vpl,Rd.
    My,V,Rd = [(Wpl,y - rho*Av^2/(4*tw)) * fy] / gammaM0.  Returns kN*m.
    """
    if VEd_kN <= 0.5 * Vpl_Rd_kN:
        return en_bending_resistance(Wply_cm3, fy)
    rho = (2.0 * VEd_kN / Vpl_Rd_kN - 1.0) ** 2
    Wply_mm3 = Wply_cm3 * 1e3
    reduced_Wply_mm3 = Wply_mm3 - rho * (Av_mm2 ** 2) / (4.0 * tw_mm)
    My_V_Rd_Nmm = reduced_Wply_mm3 * fy / GAMMA_M0
    return My_V_Rd_Nmm / 1e6


def en_axial_flexure_interaction(NEd_kN: float, A_cm2: float, b_mm: float, tf_mm: float,
                                  fy: float, Mc_Rd_kNm: float) -> dict:
    """sec 6.2.9.1, linear interaction form for I-sections."""
    A_mm2 = A_cm2 * 100.0
    Npl_Rd_kN = A_mm2 * fy / GAMMA_M0 / 1e3
    n = NEd_kN / Npl_Rd_kN if Npl_Rd_kN > 0 else float("inf")
    aw = min((A_mm2 - 2.0 * b_mm * tf_mm) / A_mm2, 0.5)
    if n <= aw:
        MN_y_Rd = Mc_Rd_kNm
    else:
        MN_y_Rd = Mc_Rd_kNm * (1.0 - n) / (1.0 - 0.5 * aw)
    return {"n": n, "aw": aw, "MN_y_Rd": MN_y_Rd, "Npl_Rd": Npl_Rd_kN}


def en_ltb_mcr(Iz_cm4: float, h_mm: float, tf_mm: float, Lcr_mm: float, C1: float = 1.0) -> float:
    """Simplified elastic critical moment, PRD Section 6.3: Iw ~= Iz*(h-tf)^2/4,
    St. Venant torsion term omitted. Returns Mcr in kN*m."""
    if Lcr_mm <= 0:
        return float("inf")
    Iz_mm4 = Iz_cm4 * 1e4
    Iw_mm6 = Iz_mm4 * (h_mm - tf_mm) ** 2 / 4.0
    Mcr_Nmm = C1 * math.pi ** 2 * E_STEEL * math.sqrt(Iz_mm4 * Iw_mm6) / Lcr_mm ** 2
    return Mcr_Nmm / 1e6


def en_ltb_reduction(Wply_cm3: float, fy: float, Mcr_kNm: float) -> dict:
    """sec 6.3.2.2/6.3.2.3 general case reduction factor chi_LT."""
    if math.isinf(Mcr_kNm):
        return {"lambda_LT": 0.0, "chi_LT": 1.0}
    Mpl_kNm = en_bending_resistance(Wply_cm3, fy)
    lambda_LT = math.sqrt(Mpl_kNm / Mcr_kNm)
    phi_LT = 0.5 * (1.0 + ALPHA_LT * (lambda_LT - 0.2) + lambda_LT ** 2)
    chi_LT = 1.0 / (phi_LT + math.sqrt(max(phi_LT ** 2 - lambda_LT ** 2, 0.0)))
    chi_LT = min(chi_LT, 1.0)
    return {"lambda_LT": lambda_LT, "chi_LT": chi_LT}


def en_bending_buckling_resistance(Wply_cm3: float, fy: float, Lcr_mm: float, Iz_cm4: float,
                                    h_mm: float, tf_mm: float) -> dict:
    """Mb,Rd = chi_LT * Wpl,y * fy / gammaM1 (Lcr=0 -> grout-braced, no LTB reduction)."""
    Mc_Rd = en_bending_resistance(Wply_cm3, fy)
    if Lcr_mm <= 0:
        return {"Mb_Rd": Mc_Rd, "chi_LT": 1.0, "Mcr": float("inf")}
    Mcr = en_ltb_mcr(Iz_cm4, h_mm, tf_mm, Lcr_mm)
    red = en_ltb_reduction(Wply_cm3, fy, Mcr)
    Mb_Rd_Nmm = red["chi_LT"] * (Wply_cm3 * 1e3) * fy / GAMMA_M1
    return {"Mb_Rd": Mb_Rd_Nmm / 1e6, "chi_LT": red["chi_LT"], "Mcr": Mcr}


# ---------------------------------------------------------------------------
# Section 6 (KS-mirrored) -- KDS 21 30 00, formulated per EN 1993-1-1 pattern
# (documented simplification -- see module docstring)
# ---------------------------------------------------------------------------

def ks_shear_area_mm2(A_cm2: float, b_mm: float, tf_mm: float, tw_mm: float) -> float:
    return en_shear_area_mm2(A_cm2, b_mm, tf_mm, tw_mm)


def ks_bending_resistance(Zx_cm3: float, fy: float) -> float:
    """M_Rd = Zx * fy / gammaM0 (plastic modulus, mirrors EN 6.2.5). Returns kN*m."""
    return en_bending_resistance(Zx_cm3, fy)


def ks_shear_resistance(Av_mm2: float, fy: float) -> float:
    return en_shear_resistance(Av_mm2, fy)


def ks_bending_buckling_resistance(Zx_cm3: float, fy: float, Lcr_mm: float, Iy_weak_cm4: float,
                                    h_mm: float, tf_mm: float) -> dict:
    """LTB screen for KS sections, same simplified Mcr form as EN (Iy_weak = weak-axis I)."""
    return en_bending_buckling_resistance(Zx_cm3, fy, Lcr_mm, Iy_weak_cm4, h_mm, tf_mm)


# ---------------------------------------------------------------------------
# Section 5 -- End-to-end selection / grid search (shared by EN and KS paths)
# ---------------------------------------------------------------------------

@dataclass
class DesignInputs:
    hole_dia_mm: float
    allowance_mm: float
    allowance_basis: str = "per_side"   # "per_side" or "total"
    fy: float = EN_GRADES["S355"]
    MEd: float = 0.0     # kN*m, factored moment demand
    VEd: float = 0.0     # kN, factored shear demand
    NEd: float = 0.0     # kN, factored axial demand (0 = flexure-shear only)
    Lb_service: float = 0.0        # mm, grout-braced -> 0
    Lb_construction: float = 0.0   # mm, unbraced construction/handling stage (0 = not governing)


@dataclass
class SectionResult:
    name: str
    mass: float
    diagonal_mm: float
    fits: bool
    governing_stage: str
    Mb_Rd: float
    Vpl_Rd: float
    util_flexure: float
    util_shear: float
    interaction: Optional[dict]
    passes_all: bool


def _evaluate(name: str, mass: float, diagonal_mm: float, Wply_cm3: float, A_cm2: float,
              b_mm: float, tf_mm: float, tw_mm: float, Iz_cm4: float, h_mm: float,
              inp: DesignInputs, d_net_mm: float,
              bend_fn, buckling_fn) -> SectionResult:
    fits = fits_hole(diagonal_mm, d_net_mm)

    Mb_service = buckling_fn(Wply_cm3, inp.fy, 0.0, Iz_cm4, h_mm, tf_mm)
    if inp.Lb_construction > 0:
        Mb_constr = buckling_fn(Wply_cm3, inp.fy, inp.Lb_construction, Iz_cm4, h_mm, tf_mm)
        if Mb_constr["Mb_Rd"] < Mb_service["Mb_Rd"]:
            Mb, stage = Mb_constr, "construction (unbraced)"
        else:
            Mb, stage = Mb_service, "grout-braced (in-service)"
    else:
        Mb, stage = Mb_service, "grout-braced (in-service)"

    Av = en_shear_area_mm2(A_cm2, b_mm, tf_mm, tw_mm)
    Vpl_Rd = en_shear_resistance(Av, inp.fy)

    Mb_Rd = en_bending_shear_interaction(inp.VEd, Vpl_Rd, Wply_cm3, Av, tw_mm, inp.fy) \
        if inp.VEd > 0.5 * Vpl_Rd else Mb["Mb_Rd"]
    # bending-shear interaction cannot exceed the (possibly LTB-reduced) buckling resistance
    Mb_Rd = min(Mb_Rd, Mb["Mb_Rd"])

    util_flex = inp.MEd / Mb_Rd if Mb_Rd > 0 else float("inf")
    util_shear = inp.VEd / Vpl_Rd if Vpl_Rd > 0 else float("inf")

    interaction = None
    if inp.NEd > 0:
        interaction = en_axial_flexure_interaction(inp.NEd, A_cm2, b_mm, tf_mm, inp.fy, Mb_Rd)
        util_flex = inp.MEd / interaction["MN_y_Rd"] if interaction["MN_y_Rd"] > 0 else float("inf")
        passes = fits and util_flex <= 1.0 and util_shear <= 1.0
    else:
        passes = fits and util_flex <= 1.0 and util_shear <= 1.0

    return SectionResult(
        name=name, mass=mass, diagonal_mm=diagonal_mm, fits=fits, governing_stage=stage,
        Mb_Rd=Mb_Rd, Vpl_Rd=Vpl_Rd, util_flexure=util_flex, util_shear=util_shear,
        interaction=interaction, passes_all=passes,
    )


def optimize_en(inp: DesignInputs, library: list[EuroShape] = EN_SECTION_LIBRARY) -> list[SectionResult]:
    d_net = net_diagonal_mm(inp.hole_dia_mm, inp.allowance_mm, inp.allowance_basis)
    results = [
        _evaluate(s.name, s.mass, s.diagonal_mm, s.Wply, s.A, s.b, s.tf, s.tw, s.Iz, s.h,
                  inp, d_net, en_bending_resistance, en_bending_buckling_resistance)
        for s in library
    ]
    admissible = [r for r in results if r.passes_all]
    admissible.sort(key=lambda r: r.mass)
    return admissible


def optimize_ks(inp: DesignInputs, library: list[KSShape] = KS_SECTION_LIBRARY) -> list[SectionResult]:
    d_net = net_diagonal_mm(inp.hole_dia_mm, inp.allowance_mm, inp.allowance_basis)
    results = [
        _evaluate(s.name, s.mass, s.diagonal_mm, s.Zx, s.A, s.b, s.tf, s.tw, s.Iy, s.h,
                  inp, d_net, ks_bending_resistance, ks_bending_buckling_resistance)
        for s in library
    ]
    admissible = [r for r in results if r.passes_all]
    admissible.sort(key=lambda r: r.mass)
    return admissible


def format_report(code_label: str, inp: DesignInputs, results: list[SectionResult]) -> str:
    d_net = net_diagonal_mm(inp.hole_dia_mm, inp.allowance_mm, inp.allowance_basis)
    lines = []
    lines.append("=" * 82)
    lines.append(f"CIP Beam Optimizer -- {code_label}")
    lines.append("=" * 82)
    lines.append(f"Hole diameter D_hole   = {inp.hole_dia_mm:.0f} mm")
    lines.append(f"Allowance C ({inp.allowance_basis}) = {inp.allowance_mm:.0f} mm")
    lines.append(f"Net diagonal D_net     = {d_net:.0f} mm")
    lines.append(f"Steel grade fy         = {inp.fy:.0f} MPa")
    lines.append(f"Demand: MEd={inp.MEd:.1f} kN*m  VEd={inp.VEd:.1f} kN  NEd={inp.NEd:.1f} kN")
    lines.append("-" * 82)

    if not results:
        lines.append("NO ADMISSIBLE SECTION -- no catalog section both fits the hole and passes")
        lines.append("all applicable strength checks.")
        lines.append("=" * 82)
        return "\n".join(lines)

    lines.append(f"{'Section':<18}{'Mass(kg/m)':>11}{'Diag(mm)':>10}  {'Governing stage':<24}{'Flex Util':>11}{'Shear Util':>12}")
    for r in results:
        lines.append(
            f"{r.name:<18}{r.mass:>11.1f}{r.diagonal_mm:>10.0f}  "
            f"{r.governing_stage:<24}{r.util_flexure:>11.2f}{r.util_shear:>12.2f}"
        )
    optimum = results[0]
    lines.append("-" * 82)
    lines.append(f"OPTIMUM (lightest admissible): {optimum.name}  ({optimum.mass:.1f} kg/m)")
    lines.append("=" * 82)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Worked example -- PRD Section 4.3 (EN and KS legs)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    demo = DesignInputs(
        hole_dia_mm=610.0,
        allowance_mm=75.0,
        allowance_basis="per_side",
        fy=EN_GRADES["S355"],
        MEd=170.0,   # kN*m, illustrative factored moment demand
        VEd=130.0,   # kN, illustrative factored shear demand
        NEd=0.0,
        Lb_service=0.0,
        Lb_construction=3000.0,  # mm, illustrative 3 m unbraced construction stage
    )
    print(format_report("EN 1993-1-1 (Eurocode 3)", demo, optimize_en(demo)))
    print()

    demo_ks = DesignInputs(**{**demo.__dict__, "fy": KS_GRADES["SM490"]})
    print(format_report("KS D 3502 / KDS 21 30 00 (mirrored)", demo_ks, optimize_ks(demo_ks)))
