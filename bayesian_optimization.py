"""
bayesian_optimization.py

CIP Beam Optimizer -- Phase 2 / roadmap prototype (PRD Section 7.2).

Demonstrates a dependency-free (numpy-only) Gaussian-process / UCB Bayesian
optimization loop over a CONTINUOUS (depth d, flange width bf) proxy design
space, for screening custom / built-up (welded) H-sections -- a design space
the Phase-1 grid search (optimized_beam_aisc.py, optimized_steel_beam.py)
cannot reach because it only searches a fixed, finite catalog.

STATUS (PRD 7.2): functional prototype. It produces a continuous (d, bf)
sizing target plus a nearest-standard-catalog cross-check, but is NOT wired
into the Phase 1 acceptance criteria. Treat its output as illustrative / a
Phase 2 seed, not a production section selection.

Why Bayesian optimization here and not grid search: for a 15-20 entry
discrete catalog, grid search is already exhaustive and optimal (see PRD
7.1). BO earns its place once the design space becomes continuous (custom
built-up plate sizes) or each evaluation becomes expensive (e.g. a live
LPILE/PLAXIS call for demand generation instead of a closed-form check) --
neither of which applies to the Phase 1 catalog, both of which apply here.

Built-up section geometry follows the workspace's established proportional
design rule (thin-wall doubly-symmetric welded I-section, no fillet/weld
material credited):
    tf = d / 30          (flange thickness)
    tw = d / 50           (web thickness)
    bf is searched independently (NOT fixed at 0.55*d) so BO can explore
    the flange-width axis on its own merits within the search box.

Weld sizing at the flange-web junction (shear flow V*Q/I) is NOT computed
here -- that is a downstream fabrication check once a candidate (d, bf, tw,
tf) is selected, not part of the sizing objective.

Third-party dependency: numpy only.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Optional

import numpy as np

# Local, stdlib-only catalogs for the nearest-standard-section cross-check.
from optimized_steel_beam import KS_SECTION_LIBRARY, EN_SECTION_LIBRARY, KSShape, EuroShape

STEEL_DENSITY_KG_MM3 = 7.85e-6  # kg/mm^3 (7850 kg/m^3)


# ---------------------------------------------------------------------------
# Built-up section proxy model
# ---------------------------------------------------------------------------

@dataclass
class BuiltUpDesign:
    d: float    # mm, overall depth
    bf: float   # mm, flange width
    tf: float   # mm, flange thickness (derived: d/30)
    tw: float   # mm, web thickness (derived: d/50)

    @property
    def diagonal_mm(self) -> float:
        return math.hypot(self.d, self.bf)

    @property
    def A_mm2(self) -> float:
        return 2.0 * self.bf * self.tf + (self.d - 2.0 * self.tf) * self.tw

    @property
    def weight_kg_per_m(self) -> float:
        return self.A_mm2 * STEEL_DENSITY_KG_MM3 * 1000.0

    @property
    def Ix_mm4(self) -> float:
        outer = self.bf * self.d ** 3 / 12.0
        inner = (self.bf - self.tw) * (self.d - 2.0 * self.tf) ** 3 / 12.0
        return outer - inner

    @property
    def Sx_mm3(self) -> float:
        return self.Ix_mm4 / (self.d / 2.0)

    @property
    def Zx_mm3(self) -> float:
        """Plastic section modulus of a doubly-symmetric welded I-section."""
        return self.bf * self.tf * (self.d - self.tf) + self.tw * (self.d - 2.0 * self.tf) ** 2 / 4.0


def make_design(d: float, bf: float) -> BuiltUpDesign:
    tf = d / 30.0
    tw = d / 50.0
    return BuiltUpDesign(d=d, bf=bf, tf=tf, tw=tw)


# ---------------------------------------------------------------------------
# Objective: minimize weight subject to (a) geometric fit, (b) flexural
# capacity >= demand. Infeasibility is penalized rather than hard-rejected
# so the GP surrogate still has gradient information to learn from.
# ---------------------------------------------------------------------------

@dataclass
class ProxyProblem:
    D_net_mm: float          # net diagonal available (post-allowance)
    fy_MPa: float
    M_demand_kNm: float
    d_bounds: tuple = (150.0, 600.0)
    bf_bounds: tuple = (75.0, 350.0)
    gamma_m0: float = 1.00
    penalty_weight: float = 500.0  # kg/m-equivalent penalty scale for infeasibility

    def evaluate(self, d: float, bf: float) -> dict:
        des = make_design(d, bf)
        Mp_kNm = self.fy_MPa * des.Zx_mm3 / self.gamma_m0 / 1e6
        fit_violation = max(0.0, des.diagonal_mm - self.D_net_mm) / self.D_net_mm
        cap_violation = max(0.0, self.M_demand_kNm - Mp_kNm) / max(self.M_demand_kNm, 1e-6)
        penalty = self.penalty_weight * (fit_violation + cap_violation)
        objective = des.weight_kg_per_m + penalty
        feasible = fit_violation == 0.0 and cap_violation == 0.0
        return {
            "design": des, "Mp_kNm": Mp_kNm, "objective": objective,
            "feasible": feasible, "fit_violation": fit_violation, "cap_violation": cap_violation,
        }


# ---------------------------------------------------------------------------
# Minimal numpy-only Gaussian Process (RBF kernel) + UCB/LCB acquisition
# ---------------------------------------------------------------------------

class SimpleGP:
    """Zero-mean GP regression with a single-length-scale RBF kernel.
    Deliberately minimal (no hyperparameter marginal-likelihood fitting) --
    adequate for a low-dimensional (2D) proxy search, not a general-purpose
    GP library.
    """

    def __init__(self, length_scale: float = 60.0, sigma_f: float = 1.0, noise: float = 1e-3):
        self.length_scale = length_scale
        self.sigma_f = sigma_f
        self.noise = noise
        self.X: Optional[np.ndarray] = None
        self.y: Optional[np.ndarray] = None
        self._K_inv: Optional[np.ndarray] = None
        self._y_mean: float = 0.0

    def _kernel(self, A: np.ndarray, B: np.ndarray) -> np.ndarray:
        sq = np.sum(A ** 2, axis=1)[:, None] + np.sum(B ** 2, axis=1)[None, :] - 2.0 * A @ B.T
        sq = np.maximum(sq, 0.0)
        return self.sigma_f ** 2 * np.exp(-0.5 * sq / self.length_scale ** 2)

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        self.X = X
        self._y_mean = float(np.mean(y))
        self.y = y - self._y_mean
        K = self._kernel(X, X) + self.noise * np.eye(len(X))
        self._K_inv = np.linalg.inv(K)

    def predict(self, Xs: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        Ks = self._kernel(Xs, self.X)
        mu = Ks @ self._K_inv @ self.y + self._y_mean
        Kss_diag = self.sigma_f ** 2 * np.ones(len(Xs))
        var = Kss_diag - np.einsum("ij,jk,ik->i", Ks, self._K_inv, Ks)
        var = np.maximum(var, 1e-12)
        return mu, np.sqrt(var)


def bayesian_refine(problem: ProxyProblem, n_init: int = 8, n_iter: int = 25,
                     n_candidates: int = 2000, kappa: float = 2.0, seed: int = 42) -> dict:
    """LCB-driven Bayesian optimization (minimization) over (d, bf).

    Returns the best (lowest-objective, feasible-preferred) design found,
    plus the full evaluation history.
    """
    rng = np.random.default_rng(seed)
    d_lo, d_hi = problem.d_bounds
    bf_lo, bf_hi = problem.bf_bounds

    def sample_box(n):
        d = rng.uniform(d_lo, d_hi, n)
        bf = rng.uniform(bf_lo, bf_hi, n)
        return np.column_stack([d, bf])

    X = sample_box(n_init)
    evals = [problem.evaluate(x[0], x[1]) for x in X]
    y = np.array([e["objective"] for e in evals])

    gp = SimpleGP(length_scale=max(d_hi - d_lo, bf_hi - bf_lo) / 4.0)

    for _ in range(n_iter):
        gp.fit(X, y)
        candidates = sample_box(n_candidates)
        mu, sigma = gp.predict(candidates)
        lcb = mu - kappa * sigma  # minimize -> lower confidence bound
        next_x = candidates[np.argmin(lcb)]
        next_eval = problem.evaluate(next_x[0], next_x[1])
        X = np.vstack([X, next_x])
        y = np.append(y, next_eval["objective"])
        evals.append(next_eval)

    feasible_evals = [e for e in evals if e["feasible"]]
    pool = feasible_evals if feasible_evals else evals
    best = min(pool, key=lambda e: e["objective"])
    return {"best": best, "history": evals, "n_evaluations": len(evals)}


# ---------------------------------------------------------------------------
# Nearest-standard-catalog cross-check
# ---------------------------------------------------------------------------

def nearest_ks_section(target: BuiltUpDesign, library: list[KSShape] = KS_SECTION_LIBRARY) -> KSShape:
    return min(library, key=lambda s: math.hypot(s.h - target.d, s.b - target.bf))


def nearest_en_section(target: BuiltUpDesign, library: list[EuroShape] = EN_SECTION_LIBRARY) -> EuroShape:
    return min(library, key=lambda s: math.hypot(s.h - target.d, s.b - target.bf))


# ---------------------------------------------------------------------------
# Worked example -- same demand as the Phase 1 EN/KS grid-search demo
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    problem = ProxyProblem(
        D_net_mm=460.0,     # PRD Section 4.3 worked example: 610mm hole, 75mm/side allowance
        fy_MPa=355.0,        # S355
        M_demand_kNm=170.0,
    )
    result = bayesian_refine(problem)
    best = result["best"]
    des: BuiltUpDesign = best["design"]

    print("=" * 78)
    print("Bayesian refinement (Phase 2 prototype) -- continuous (d, bf) proxy search")
    print("=" * 78)
    print(f"Evaluations run        : {result['n_evaluations']}")
    print(f"Best design d, bf       : {des.d:.0f} mm, {des.bf:.0f} mm")
    print(f"Derived tf, tw          : {des.tf:.1f} mm, {des.tw:.1f} mm")
    print(f"Diagonal / D_net        : {des.diagonal_mm:.0f} / {problem.D_net_mm:.0f} mm")
    print(f"Weight                  : {des.weight_kg_per_m:.1f} kg/m")
    print(f"Mp (capacity)           : {best['Mp_kNm']:.1f} kN*m  (demand {problem.M_demand_kNm:.1f} kN*m)")
    print(f"Feasible                : {best['feasible']}")
    print("-" * 78)

    nearest_ks = nearest_ks_section(des)
    nearest_en = nearest_en_section(des)
    print(f"Nearest KS catalog section : {nearest_ks.name}  ({nearest_ks.mass:.1f} kg/m)")
    print(f"Nearest EN catalog section : {nearest_en.name}  ({nearest_en.mass:.1f} kg/m)")
    print("-" * 78)
    print("Reminder: illustrative Phase 2 seed only -- not a production selection")
    print("path. Full welded-plate-girder checks (flange local buckling, web")
    print("slenderness, weld shear flow) are required before this proxy design")
    print("is used for anything beyond a seed for further engineering.")
    print("=" * 78)
