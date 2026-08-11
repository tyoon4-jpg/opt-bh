/*
 * CIPBeamOptimizer.jsx
 *
 * CIP Beam Optimizer -- React artifact / component version (PRD Section
 * 7.3/7.4). Same calculation engine and UI as the standalone
 * CIP_Beam_Optimizer.html deliverable, packaged as a plain default-export
 * React component for use directly in a React environment (e.g. a Claude
 * artifact) rather than via the CDN/Babel bootstrap the HTML file uses.
 *
 * Mirrors optimized_beam_aisc.py and optimized_steel_beam.py term-for-term
 * so results match the Python grid search for identical inputs (PRD Section
 * 9 acceptance criterion). See those files and CIP_Beam_Optimizer.html for
 * the full derivation, disclaimers, and documented simplifications
 * (Section 6.3 LTB approximation, Section 6.2 shear-area formula, KS-
 * mirrors-EN formulation, indicative catalog properties).
 *
 * Usage:
 *   import CIPBeamOptimizer from "./CIPBeamOptimizer.jsx";
 *   export default function App() { return <CIPBeamOptimizer />; }
 */

import React, { useState, useMemo } from "react";

const APP_CSS = `

  :root {
    --bg: #0f1720;
    --panel: #17212c;
    --panel-2: #1e2a37;
    --border: #2c3a48;
    --text: #e6edf3;
    --text-dim: #93a4b3;
    --accent: #4fb3ff;
    --good: #3fbf6f;
    --bad: #e5534b;
    --warn: #e5a63f;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
  }
  #root { max-width: 1180px; margin: 0 auto; padding: 20px 24px 60px; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 0 0 12px; color: var(--text); }
  .subtitle { color: var(--text-dim); font-size: 12.5px; margin-bottom: 18px; }
  .tabs { display: flex; gap: 6px; margin-bottom: 18px; border-bottom: 1px solid var(--border); }
  .tab-btn {
    background: none; border: none; color: var(--text-dim); padding: 10px 16px;
    cursor: pointer; font-size: 13.5px; border-bottom: 2px solid transparent;
  }
  .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
  .grid { display: grid; grid-template-columns: 380px 1fr; gap: 18px; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  .panel {
    background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
    padding: 16px 18px;
  }
  .field { margin-bottom: 13px; }
  .field label { display: block; font-size: 12px; color: var(--text-dim); margin-bottom: 4px; }
  .field input, .field select {
    width: 100%; background: var(--panel-2); border: 1px solid var(--border);
    color: var(--text); border-radius: 6px; padding: 7px 9px; font-size: 13px;
  }
  .row { display: flex; gap: 10px; }
  .row .field { flex: 1; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    background: var(--panel-2); border: 1px solid var(--border); color: var(--text-dim);
    padding: 5px 11px; border-radius: 999px; cursor: pointer; font-size: 12px;
  }
  .chip.active { background: var(--accent); color: #06202f; border-color: var(--accent); font-weight: 600; }
  .toggle-group { display: flex; gap: 6px; }
  .toggle-group button {
    flex: 1; background: var(--panel-2); border: 1px solid var(--border); color: var(--text-dim);
    padding: 7px 8px; border-radius: 6px; cursor: pointer; font-size: 12.5px;
  }
  .toggle-group button.active { background: var(--accent); color: #06202f; border-color: var(--accent); font-weight: 600; }
  .note { font-size: 11.5px; color: var(--text-dim); line-height: 1.5; margin-top: 10px; }
  .note b { color: var(--warn); }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { text-align: right; padding: 7px 8px; border-bottom: 1px solid var(--border); }
  th:first-child, td:first-child { text-align: left; }
  th { color: var(--text-dim); font-weight: 600; font-size: 11.5px; text-transform: uppercase; letter-spacing: .03em; }
  tr.optimum { background: rgba(63,191,111,0.12); }
  tr.optimum td:first-child::before { content: "\\2605  "; color: var(--good); }
  .badge { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge.fit { background: rgba(63,191,111,0.18); color: var(--good); }
  .badge.nofit { background: rgba(229,83,75,0.18); color: var(--bad); }
  .util-bar-wrap { position: relative; background: var(--panel-2); border-radius: 4px; height: 14px; width: 100%; overflow: hidden; }
  .util-bar { position: absolute; left: 0; top: 0; bottom: 0; }
  .util-bar.ok { background: var(--good); }
  .util-bar.warn { background: var(--warn); }
  .util-bar.over { background: var(--bad); }
  .util-cell { display: flex; align-items: center; gap: 6px; }
  .util-cell span { width: 34px; text-align: right; font-variant-numeric: tabular-nums; }
  .empty-state { color: var(--text-dim); padding: 30px 10px; text-align: center; }
  .svg-wrap { display: flex; justify-content: center; padding: 6px 0 14px; }
  .legend { display: flex; gap: 16px; justify-content: center; font-size: 11.5px; color: var(--text-dim); flex-wrap: wrap; }
  .legend .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
  .prop-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; }
  @media (max-width: 700px) { .prop-grid { grid-template-columns: repeat(2, 1fr); } }
  .prop-tile { background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
  .prop-tile .k { font-size: 11px; color: var(--text-dim); margin-bottom: 3px; }
  .prop-tile .v { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .prop-tile .u { font-size: 11px; color: var(--text-dim); margin-left: 3px; font-weight: 400; }
  .footer-note { color: var(--text-dim); font-size: 11px; margin-top: 26px; border-top: 1px solid var(--border); padding-top: 12px; }

  .chart-card { position: relative; }
  .chart-card svg { display: block; }
  .chart-axis-label { fill: var(--text-dim); font-size: 10px; }
  .chart-grid { stroke: #2c3a48; stroke-width: 1; }
  .chart-baseline { stroke: #383835; stroke-width: 1; }
  .chart-tooltip {
    position: absolute; pointer-events: none; background: #0b1219; border: 1px solid var(--border);
    border-radius: 6px; padding: 6px 9px; font-size: 11.5px; line-height: 1.5; color: var(--text);
    box-shadow: 0 4px 14px rgba(0,0,0,0.4); z-index: 5; white-space: nowrap;
  }
  .chart-legend { display: flex; gap: 16px; font-size: 11.5px; color: var(--text-dim); margin-top: 6px; flex-wrap: wrap; }
  .chart-legend .mk { display: inline-flex; align-items: center; gap: 5px; }
  .run-bar { display: flex; gap: 10px; align-items: center; margin-top: 4px; }
  .btn-primary {
    background: var(--accent); color: #06202f; border: none; border-radius: 7px; padding: 9px 18px;
    font-size: 13px; font-weight: 700; cursor: pointer;
  }
  .btn-primary:disabled { opacity: 0.5; cursor: default; }
  .btn-secondary {
    background: var(--panel-2); color: var(--text); border: 1px solid var(--border); border-radius: 7px;
    padding: 9px 14px; font-size: 12.5px; cursor: pointer;
  }
  .progress-track { flex: 1; height: 8px; background: var(--panel-2); border-radius: 999px; overflow: hidden; }
  .progress-fill { height: 100%; background: var(--accent); transition: width 0.15s linear; }
  .table-scroll { max-height: 260px; overflow-y: auto; margin-top: 10px; border-radius: 8px; }
  .small-muted { color: var(--text-dim); font-size: 11.5px; }
`;

/* ============================================================================
   CALCULATION ENGINE
   Mirrors optimized_beam_aisc.py (AISC) and optimized_steel_beam.py (EN/KS)
   term-for-term so results match the Python grid search for identical
   inputs (PRD Section 9 acceptance criterion).
   ========================================================================= */

const MM_PER_IN = 25.4;
const E_AISC_KSI = 29000.0;
const E_SI_MPA = 210000.0;
const ALPHA_LT = 0.49; // EC3 buckling curve "c", conservative default (PRD 6.3)

// ---- AISC W-shape catalog (in, plf) -- identical to SECTION_LIBRARY in
// optimized_beam_aisc.py -------------------------------------------------
const AISC_LIBRARY = [
  {name:"W8x31",  weight:31, d:8.00, bf:7.995, tw:0.285, tf:0.435, A:9.13,  Ix:110, Sx:27.5, Zx:30.4, ry:2.02, Iy:37.0},
  {name:"W8x40",  weight:40, d:8.25, bf:8.077, tw:0.360, tf:0.560, A:11.70, Ix:146, Sx:35.5, Zx:39.8, ry:2.04, Iy:49.0},
  {name:"W8x48",  weight:48, d:8.50, bf:8.117, tw:0.400, tf:0.685, A:14.10, Ix:184, Sx:43.2, Zx:49.0, ry:2.08, Iy:60.9},
  {name:"W8x58",  weight:58, d:8.75, bf:8.222, tw:0.510, tf:0.810, A:17.10, Ix:228, Sx:52.0, Zx:59.8, ry:2.10, Iy:75.1},
  {name:"W10x33", weight:33, d:9.73, bf:7.964, tw:0.290, tf:0.435, A:9.71,  Ix:171, Sx:35.0, Zx:38.8, ry:1.94, Iy:36.6},
  {name:"W10x45", weight:45, d:10.10,bf:8.020, tw:0.350, tf:0.620, A:13.30, Ix:248, Sx:49.1, Zx:54.9, ry:1.98, Iy:53.4},
  {name:"W10x60", weight:60, d:10.20,bf:10.08, tw:0.420, tf:0.680, A:17.60, Ix:341, Sx:66.7, Zx:74.6, ry:2.57, Iy:116.0},
  {name:"W10x77", weight:77, d:10.60,bf:10.19, tw:0.530, tf:0.870, A:22.60, Ix:455, Sx:85.9, Zx:97.6, ry:2.60, Iy:145.0},
  {name:"W12x40", weight:40, d:11.90,bf:8.005, tw:0.295, tf:0.515, A:11.70, Ix:307, Sx:51.5, Zx:57.0, ry:1.94, Iy:44.1},
  {name:"W12x53", weight:53, d:12.10,bf:9.995, tw:0.345, tf:0.575, A:15.60, Ix:425, Sx:70.6, Zx:77.9, ry:2.48, Iy:95.8},
  {name:"W12x65", weight:65, d:12.10,bf:12.00, tw:0.390, tf:0.605, A:19.10, Ix:533, Sx:87.9, Zx:96.8, ry:3.02, Iy:174.0},
  {name:"W12x87", weight:87, d:12.50,bf:12.13, tw:0.515, tf:0.810, A:25.60, Ix:740, Sx:118.0, Zx:132.0, ry:3.07, Iy:241.0},
  {name:"W14x48", weight:48, d:13.80,bf:8.030, tw:0.340, tf:0.595, A:14.10, Ix:484, Sx:70.2, Zx:78.4, ry:1.91, Iy:51.4},
  {name:"W14x61", weight:61, d:13.90,bf:9.995, tw:0.375, tf:0.645, A:17.90, Ix:640, Sx:92.1, Zx:102.0, ry:2.45, Iy:107.0},
  {name:"W14x82", weight:82, d:14.30,bf:10.13, tw:0.510, tf:0.855, A:24.00, Ix:881, Sx:123.0, Zx:139.0, ry:2.48, Iy:148.0},
  {name:"W14x99", weight:99, d:14.20,bf:14.57, tw:0.485, tf:0.780, A:29.10, Ix:1110, Sx:157.0, Zx:173.0, ry:3.71, Iy:402.0},
];

// ---- EN HE-B/HE-M/IPE catalog (mm, cm units, kg/m) -- identical to
// EN_SECTION_LIBRARY in optimized_steel_beam.py ---------------------------
const EN_LIBRARY = [
  {name:"IPE300", mass:42.2, h:300, b:150, tw:7.1, tf:10.7, A:53.8,  Iy:8356,  Wply:628.0,  iy:12.50, Iz:603.8,  iz:3.35},
  {name:"IPE330", mass:49.1, h:330, b:160, tw:7.5, tf:11.5, A:62.6,  Iy:11770, Wply:804.0,  iy:13.70, Iz:788.1,  iz:3.55},
  {name:"IPE360", mass:57.1, h:360, b:170, tw:8.0, tf:12.7, A:72.7,  Iy:16270, Wply:1019.0, iy:14.95, Iz:1043.0, iz:3.79},
  {name:"IPE400", mass:66.3, h:400, b:180, tw:8.6, tf:13.5, A:84.5,  Iy:23130, Wply:1307.0, iy:16.55, Iz:1318.0, iz:3.95},
  {name:"HE200B", mass:61.3, h:200, b:200, tw:9.0, tf:15.0, A:78.1,  Iy:5696,  Wply:642.5,  iy:8.54,  Iz:2003.0, iz:5.07},
  {name:"HE220B", mass:71.5, h:220, b:220, tw:9.5, tf:16.0, A:91.0,  Iy:8091,  Wply:827.0,  iy:9.43,  Iz:2843.0, iz:5.59},
  {name:"HE200M", mass:103.0,h:220, b:206, tw:12.0,tf:25.0, A:131.3, Iy:10640, Wply:1135.0, iy:9.00,  Iz:3651.0, iz:5.27},
  {name:"HE240B", mass:83.2, h:240, b:240, tw:10.0,tf:17.0, A:106.0, Iy:11260, Wply:1053.0, iy:10.31, Iz:3923.0, iz:6.08},
  {name:"HE220M", mass:117.0,h:240, b:226, tw:12.5,tf:26.0, A:149.4, Iy:14600, Wply:1419.0, iy:9.89,  Iz:4954.0, iz:5.76},
  {name:"HE260B", mass:93.0, h:260, b:260, tw:10.0,tf:17.5, A:118.4, Iy:14920, Wply:1283.0, iy:11.22, Iz:5135.0, iz:6.58},
  {name:"HE280B", mass:103.1,h:280, b:280, tw:10.5,tf:18.0, A:131.4, Iy:19270, Wply:1534.0, iy:12.11, Iz:6595.0, iz:7.09},
  {name:"HE300B", mass:117.0,h:300, b:300, tw:11.0,tf:19.0, A:149.1, Iy:25170, Wply:1869.0, iy:12.99, Iz:8563.0, iz:7.58},
];

// ---- KS H-shape catalog (mm, cm units, kg/m) -- identical to
// KS_SECTION_LIBRARY in optimized_steel_beam.py ----------------------------
const KS_LIBRARY = [
  {name:"H-150x150x7x10",   mass:31.5, h:150, b:150, tw:7.0, tf:10.0, A:40.14,  Ix:1640,  Sx:219.0,  Iy:563.0,   rx:6.39, ry:3.75},
  {name:"H-198x99x4.5x7",   mass:17.8, h:198, b:99,  tw:4.5, tf:7.0,  A:22.68,  Ix:1610,  Sx:163.0,  Iy:113.0,   rx:8.43, ry:2.23},
  {name:"H-175x175x7.5x11", mass:40.2, h:175, b:175, tw:7.5, tf:11.0, A:51.21,  Ix:2880,  Sx:329.0,  Iy:984.0,   rx:7.50, ry:4.38},
  {name:"H-248x124x5x8",    mass:25.7, h:248, b:124, tw:5.0, tf:8.0,  A:32.68,  Ix:3450,  Sx:278.0,  Iy:255.0,   rx:10.27,ry:2.79},
  {name:"H-200x200x8x12",   mass:49.9, h:200, b:200, tw:8.0, tf:12.0, A:63.53,  Ix:4720,  Sx:472.0,  Iy:1600.0,  rx:8.62, ry:5.02},
  {name:"H-298x149x5.5x8",  mass:32.0, h:298, b:149, tw:5.5, tf:8.0,  A:40.80,  Ix:6460,  Sx:433.0,  Iy:443.0,   rx:12.58,ry:3.29},
  {name:"H-250x250x9x14",   mass:72.4, h:250, b:250, tw:9.0, tf:14.0, A:92.18,  Ix:10800, Sx:864.0,  Iy:3650.0,  rx:10.80,ry:6.29},
  {name:"H-346x174x6x9",    mass:41.4, h:346, b:174, tw:6.0, tf:9.0,  A:52.45,  Ix:11200, Sx:649.0,  Iy:792.0,   rx:14.60,ry:3.88},
  {name:"H-420x230x8x13",   mass:72.0, h:420, b:230, tw:8.0, tf:13.0, A:91.70,  Ix:29400, Sx:1400.0, Iy:2636.0,  rx:17.90,ry:5.36},
  {name:"H-300x300x10x15",  mass:94.0, h:300, b:300, tw:10.0,tf:15.0, A:118.50, Ix:20200, Sx:1350.0, Iy:6750.0,  rx:13.10,ry:7.55},
  {name:"H-396x199x7x11",   mass:56.7, h:396, b:199, tw:7.0, tf:11.0, A:72.16,  Ix:20000, Sx:1010.0, Iy:1450.0,  rx:16.70,ry:4.48},
  {name:"H-450x200x9x14",   mass:76.0, h:450, b:200, tw:9.0, tf:14.0, A:96.76,  Ix:33500, Sx:1490.0, Iy:1870.0,  rx:18.60,ry:4.40},
  {name:"H-446x199x8x12",   mass:66.7, h:446, b:199, tw:8.0, tf:12.0, A:84.95,  Ix:28700, Sx:1290.0, Iy:1580.0,  rx:18.40,ry:4.31},
  {name:"H-350x350x12x19",  mass:136.0,h:350, b:350, tw:12.0,tf:19.0, A:173.90, Ix:40300, Sx:2300.0, Iy:13600.0, rx:15.20,ry:8.84},
  {name:"H-400x400x13x21",  mass:172.0,h:400, b:400, tw:13.0,tf:21.0, A:214.40, Ix:66600, Sx:3330.0, Iy:22400.0, rx:17.60,ry:10.20},
];
KS_LIBRARY.forEach(s => { s.Zx = 1.12 * s.Sx; }); // approx shape factor, PRD-documented

const CODE_META = {
  AISC: { label: "AISC 360-16 (LRFD)", grades: {"A992/Gr50": 50, "A36": 36}, gradeUnit: "ksi",
          momentUnit: "kip·in", shearUnit: "kip", axialUnit: "kip", massUnit: "plf", lenUnit: "in" },
  EN:   { label: "EN 1993-1-1 (Eurocode 3)", grades: {"S355": 355, "S235": 235}, gradeUnit: "MPa",
          momentUnit: "kN·m", shearUnit: "kN", axialUnit: "kN", massUnit: "kg/m", lenUnit: "mm" },
  KS:   { label: "KS D 3502 / KDS 21 30 00 (mirrored)", grades: {"SM490": 325, "SS400": 235, "SM520": 355}, gradeUnit: "MPa",
          momentUnit: "kN·m", shearUnit: "kN", axialUnit: "kN", massUnit: "kg/m", lenUnit: "mm" },
};

function netDiagonal(holeMM, allowMM, basis) {
  return basis === "per_side" ? holeMM - 2 * allowMM : holeMM - allowMM;
}

// ---- AISC 360 Chapter F2 / G2.1 / H1 ------------------------------------
function aiscFlexure(s, Fy, LbIn, Cb = 1.0) {
  const Mp = Fy * s.Zx;
  const Lp = 1.76 * s.ry * Math.sqrt(E_AISC_KSI / Fy);
  const Lr = Math.PI * s.ry * Math.sqrt(E_AISC_KSI / (0.7 * Fy)); // simplified, PRD 6.3
  let Mn, regime;
  if (LbIn <= Lp) { Mn = Mp; regime = "plastic (Lb≤Lp)"; }
  else if (LbIn <= Lr) {
    Mn = Cb * (Mp - (Mp - 0.7 * Fy * s.Sx) * (LbIn - Lp) / (Lr - Lp));
    Mn = Math.min(Mn, Mp); regime = "inelastic LTB";
  } else {
    Mn = Cb * Mp * Math.pow(Lr / LbIn, 2);
    Mn = Math.min(Mn, Mp); regime = "elastic LTB (approx.)";
  }
  return { Mp, Lp, Lr, Mn, phiMn: 0.90 * Mn, regime };
}
function aiscShear(s, Fy) {
  const Aw = s.d * s.tw;
  const Vn = 0.6 * Fy * Aw;
  return { Aw, Vn, phiVn: 0.90 * Vn };
}
function aiscCompression(s, Fy, KL) {
  let Fcr;
  if (KL <= 0) Fcr = Fy;
  else {
    const Fe = Math.pow(Math.PI, 2) * E_AISC_KSI / Math.pow(KL / s.ry, 2);
    Fcr = (Fy / Fe <= 2.25) ? Math.pow(0.658, Fy / Fe) * Fy : 0.877 * Fe;
  }
  const Pn = Fcr * s.A;
  return { Fcr, Pn, phiPn: 0.90 * Pn };
}
function aiscH1(Pr, Pc, Mr, Mc) {
  const ratioP = Pc > 0 ? Pr / Pc : Infinity;
  let util, eq;
  if (ratioP >= 0.2) { util = ratioP + (8 / 9) * (Mr / Mc); eq = "H1-1a"; }
  else { util = ratioP / 2 + (Mr / Mc); eq = "H1-1b"; }
  return { utilization: util, equation: eq, passes: util <= 1.0 };
}

// ---- EN 1993-1-1 sec 6.2.5/6.2.6/6.2.8/6.2.9/6.3.2 (KS mirrors this) ----
function enShearAreaMM2(Acm2, bMM, tfMM, twMM) { return Acm2 * 100 - 2 * bMM * tfMM + twMM * tfMM; }
function enBendingResistance(WplCm3, fy) { return (WplCm3 * 1e3 * fy) / 1e6; } // kN*m
function enShearResistance(AvMM2, fy) { return (AvMM2 * (fy / Math.sqrt(3))) / 1e3; } // kN
function enBendingShearInteraction(VEd, VplRd, WplCm3, AvMM2, twMM, fy) {
  if (VEd <= 0.5 * VplRd) return enBendingResistance(WplCm3, fy);
  const rho = Math.pow(2 * VEd / VplRd - 1, 2);
  const WplMM3 = WplCm3 * 1e3;
  const reduced = WplMM3 - rho * Math.pow(AvMM2, 2) / (4 * twMM);
  return (reduced * fy) / 1e6;
}
function enAxialFlexure(NEd, Acm2, bMM, tfMM, fy, McRd) {
  const AMM2 = Acm2 * 100;
  const NplRd = (AMM2 * fy) / 1e3;
  const n = NplRd > 0 ? NEd / NplRd : Infinity;
  const aw = Math.min((AMM2 - 2 * bMM * tfMM) / AMM2, 0.5);
  const MNyRd = n <= aw ? McRd : McRd * (1 - n) / (1 - 0.5 * aw);
  return { n, aw, MNyRd, NplRd };
}
function enLtbMcr(IzCm4, hMM, tfMM, LcrMM, C1 = 1.0) {
  if (LcrMM <= 0) return Infinity;
  const IzMM4 = IzCm4 * 1e4;
  const IwMM6 = IzMM4 * Math.pow(hMM - tfMM, 2) / 4.0;
  const McrNmm = C1 * Math.pow(Math.PI, 2) * E_SI_MPA * Math.sqrt(IzMM4 * IwMM6) / Math.pow(LcrMM, 2);
  return McrNmm / 1e6;
}
function enBendingBuckling(WplCm3, fy, LcrMM, IzCm4, hMM, tfMM) {
  const McRd = enBendingResistance(WplCm3, fy);
  if (LcrMM <= 0) return { MbRd: McRd, chiLT: 1.0, Mcr: Infinity };
  const Mcr = enLtbMcr(IzCm4, hMM, tfMM, LcrMM);
  const lambdaLT = Math.sqrt(McRd / Mcr);
  const phiLT = 0.5 * (1 + ALPHA_LT * (lambdaLT - 0.2) + Math.pow(lambdaLT, 2));
  let chiLT = 1 / (phiLT + Math.sqrt(Math.max(Math.pow(phiLT, 2) - Math.pow(lambdaLT, 2), 0)));
  chiLT = Math.min(chiLT, 1.0);
  return { MbRd: (chiLT * WplCm3 * 1e3 * fy) / 1e6, chiLT, Mcr };
}

// ---- unified per-section evaluation --------------------------------------
function evaluateSection(code, s, inp, dNet) {
  let diagonal, fits, MbService, MbConstr, Av, VplRd, weightOrMass;

  if (code === "AISC") {
    diagonal = Math.hypot(s.d, s.bf) * MM_PER_IN;
    fits = diagonal <= dNet;
    const LbServiceIn = inp.LbService / MM_PER_IN;
    const LbConstrIn = inp.LbConstruction / MM_PER_IN;
    MbService = aiscFlexure(s, inp.fy, LbServiceIn);
    MbConstr = inp.LbConstruction > 0 ? aiscFlexure(s, inp.fy, LbConstrIn) : null;
    const shear = aiscShear(s, inp.fy);
    Av = shear.Aw; VplRd = shear.phiVn;
    weightOrMass = s.weight;
  } else {
    diagonal = Math.hypot(s.h, s.b);
    fits = diagonal <= dNet;
    const Wpl = code === "EN" ? s.Wply : s.Zx;
    const Iweak = code === "EN" ? s.Iz : s.Iy;
    MbService = enBendingBuckling(Wpl, inp.fy, 0, Iweak, s.h, s.tf);
    MbConstr = inp.LbConstruction > 0 ? enBendingBuckling(Wpl, inp.fy, inp.LbConstruction, Iweak, s.h, s.tf) : null;
    Av = enShearAreaMM2(s.A, s.b, s.tf, s.tw);
    VplRd = enShearResistance(Av, inp.fy);
    weightOrMass = s.mass;
  }

  let governing, stage;
  const svcCap = code === "AISC" ? MbService.phiMn : MbService.MbRd;
  const constrCap = MbConstr ? (code === "AISC" ? MbConstr.phiMn : MbConstr.MbRd) : Infinity;
  if (MbConstr && constrCap < svcCap) { governing = MbConstr; stage = "Construction (unbraced)"; }
  else { governing = MbService; stage = "Grout-braced (in-service)"; }

  let capacity = code === "AISC" ? governing.phiMn : governing.MbRd;

  if (code !== "AISC" && inp.VEd > 0.5 * VplRd) {
    const Wpl = code === "EN" ? s.Wply : s.Zx;
    const interacted = enBendingShearInteraction(inp.VEd, VplRd, Wpl, Av, s.tw, inp.fy);
    capacity = Math.min(capacity, interacted);
  }

  const demandM = code === "AISC" ? inp.Mu : inp.MEd;
  const demandV = code === "AISC" ? inp.Vu : inp.VEd;
  const demandP = code === "AISC" ? inp.Pu : inp.NEd;

  let utilFlex = capacity > 0 ? demandM / capacity : Infinity;
  const utilShear = VplRd > 0 ? demandV / VplRd : Infinity;

  let interaction = null;
  if (demandP > 0) {
    if (code === "AISC") {
      const KL = Math.max(governing === MbConstr ? inp.LbConstruction : inp.LbService, 25.4) / MM_PER_IN;
      const comp = aiscCompression(s, inp.fy, KL);
      interaction = aiscH1(demandP, comp.phiPn, demandM, capacity);
      utilFlex = interaction.utilization;
    } else {
      interaction = enAxialFlexure(demandP, s.A, s.b, s.tf, inp.fy, capacity);
      utilFlex = interaction.MNyRd > 0 ? demandM / interaction.MNyRd : Infinity;
    }
  }

  const passes = fits && utilFlex <= 1.0 && utilShear <= 1.0;

  return { section: s, name: s.name, weightOrMass, diagonal, fits, stage, utilFlex, utilShear, passes };
}

function optimize(code, inp) {
  const dNet = netDiagonal(inp.holeDia, inp.allowance, inp.allowanceBasis);
  const library = code === "AISC" ? AISC_LIBRARY : code === "EN" ? EN_LIBRARY : KS_LIBRARY;
  const results = library.map(s => evaluateSection(code, s, inp, dNet));
  const admissible = results.filter(r => r.passes).sort((a, b) => a.weightOrMass - b.weightOrMass);
  return { dNet, results, admissible };
}

/* ============================================================================
   PHASE 2 -- BAYESIAN REFINEMENT PROTOTYPE (PRD Section 7.2)
   Mirrors bayesian_optimization.py term-for-term: same continuous (d, bf)
   proxy design (tf=d/30, tw=d/50, thin-wall, NO weld -- distinct from the
   weld-inclusive builtUpProperties() model used in the Section Properties
   tab below), same penalized-weight objective, same RBF-kernel GP + LCB
   acquisition loop. Linear algebra (Gauss-Jordan inverse) is hand-rolled
   here instead of numpy -- still no third-party dependency.
   Status: illustrative Phase 2 seed, not wired into Phase 1 acceptance
   criteria (same caveat as the Python prototype).
   ========================================================================= */
const STEEL_DENSITY_KG_MM3 = 7.85e-6;

function proxyDesign(d, bf) {
  const tf = d / 30.0, tw = d / 50.0;
  const A = 2 * bf * tf + (d - 2 * tf) * tw;
  const weight = A * STEEL_DENSITY_KG_MM3 * 1000.0; // kg/m
  const Ix = (bf * Math.pow(d, 3)) / 12 - ((bf - tw) * Math.pow(d - 2 * tf, 3)) / 12;
  const Zx = bf * tf * (d - tf) + (tw * Math.pow(d - 2 * tf, 2)) / 4;
  const diagonal = Math.hypot(d, bf);
  return { d, bf, tf, tw, A, weight, Ix, Zx, diagonal };
}

function proxyEvaluate(d, bf, problem) {
  const des = proxyDesign(d, bf);
  const MpKNm = (problem.fy * des.Zx) / 1e6; // fy MPa, Zx mm^3 -> N*mm -> kN*m
  const fitViolation = Math.max(0, des.diagonal - problem.dNet) / problem.dNet;
  const capViolation = Math.max(0, problem.mDemand - MpKNm) / Math.max(problem.mDemand, 1e-6);
  const penalty = problem.penaltyWeight * (fitViolation + capViolation);
  const objective = des.weight + penalty;
  const feasible = fitViolation === 0 && capViolation === 0;
  return { design: des, MpKNm, objective, feasible, fitViolation, capViolation };
}

// ---- tiny linear algebra (Gauss-Jordan inverse, plain 2D arrays) --------
function matInverse(M) {
  const n = M.length;
  const A = M.map((row, i) => row.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    const tmp = A[col]; A[col] = A[pivot]; A[pivot] = tmp;
    const pv = A[col][col] || 1e-12;
    for (let j = 0; j < 2 * n; j++) A[col][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = A[r][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) A[r][j] -= factor * A[col][j];
    }
  }
  return A.map(row => row.slice(n));
}
function matVec(M, v) { return M.map(row => row.reduce((s, val, i) => s + val * v[i], 0)); }

// ---- minimal RBF-kernel Gaussian Process (zero-mean, single length scale) --
class SimpleGP {
  constructor(lengthScale, sigmaF = 1.0, noise = 1e-3) {
    this.lengthScale = lengthScale; this.sigmaF = sigmaF; this.noise = noise;
  }
  kernel(A, B) {
    return A.map(a => B.map(b => {
      const sq = Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2);
      return Math.pow(this.sigmaF, 2) * Math.exp(-0.5 * sq / Math.pow(this.lengthScale, 2));
    }));
  }
  fit(X, y) {
    this.X = X;
    this.yMean = y.reduce((a, b) => a + b, 0) / y.length;
    this.y = y.map(v => v - this.yMean);
    const K = this.kernel(X, X).map((row, i) => row.map((v, j) => v + (i === j ? this.noise : 0)));
    this.KInv = matInverse(K);
    this.alpha = matVec(this.KInv, this.y);
  }
  predict(Xs) {
    const Ks = this.kernel(Xs, this.X);
    const mu = Ks.map(row => row.reduce((s, v, i) => s + v * this.alpha[i], 0) + this.yMean);
    const sigma = Ks.map(row => {
      const KInvRow = matVec(this.KInv, row);
      const quad = row.reduce((s, v, i) => s + v * KInvRow[i], 0);
      return Math.sqrt(Math.max(Math.pow(this.sigmaF, 2) - quad, 1e-12));
    });
    return { mu, sigma };
  }
}

function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function initBO(problem, nInit, rng) {
  const X = [], evals = [];
  for (let i = 0; i < nInit; i++) {
    const d = problem.dBounds[0] + rng() * (problem.dBounds[1] - problem.dBounds[0]);
    const bf = problem.bfBounds[0] + rng() * (problem.bfBounds[1] - problem.bfBounds[0]);
    X.push([d, bf]);
    evals.push(proxyEvaluate(d, bf, problem));
  }
  return { X, y: evals.map(e => e.objective), evals };
}

function stepBO(state, problem, nCandidates, kappa, rng) {
  const lengthScale = Math.max(
    problem.dBounds[1] - problem.dBounds[0],
    problem.bfBounds[1] - problem.bfBounds[0]
  ) / 4.0;
  const gp = new SimpleGP(lengthScale);
  gp.fit(state.X, state.y);

  const candidates = [];
  for (let i = 0; i < nCandidates; i++) {
    const d = problem.dBounds[0] + rng() * (problem.dBounds[1] - problem.dBounds[0]);
    const bf = problem.bfBounds[0] + rng() * (problem.bfBounds[1] - problem.bfBounds[0]);
    candidates.push([d, bf]);
  }
  const { mu, sigma } = gp.predict(candidates);
  let bestIdx = 0, bestLcb = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const lcb = mu[i] - kappa * sigma[i];
    if (lcb < bestLcb) { bestLcb = lcb; bestIdx = i; }
  }
  const [d, bf] = candidates[bestIdx];
  const e = proxyEvaluate(d, bf, problem);
  state.X.push([d, bf]);
  state.y.push(e.objective);
  state.evals.push(e);
  return e;
}

function nearestSection(library, d, bf) {
  let best = null, bestDist = Infinity;
  library.forEach(s => {
    const dist = Math.hypot(s.h - d, s.b - bf);
    if (dist < bestDist) { bestDist = dist; best = s; }
  });
  return best;
}

/* ============================================================================
   BUILT-UP SECTION PROPERTY CALCULATOR (PRD Section 7.4)
   Doubly-symmetric welded I-section, H x B x tw x tf, with 4 flange-web
   fillet welds of leg size R (2 per flange, top+bottom). Weld fillets are
   included via parallel-axis theorem; own-centroidal inertia of each
   triangular fillet uses the standard right-triangle formula R^4/36.
   Cw reuses the same Iz*(h-tf)^2/4 approximation used for the LTB screen
   above, for consistency across this deliverable. J uses the standard
   open thin-wall sum (weld metal excluded, conservative).
   ========================================================================= */
function builtUpProperties(H, B, tw, tf, R) {
  const dz = tw / 2 + R / 3;
  const dy = (H / 2 - tf) - R / 3;
  const fArea = (R * R) / 2;

  const A = 2 * B * tf + (H - 2 * tf) * tw + 4 * fArea; // mm^2
  const weight = A * 7.85e-6 * 1000; // kg/m

  const IxBase = (B * Math.pow(H, 3)) / 12 - ((B - tw) * Math.pow(H - 2 * tf, 3)) / 12;
  const IxWeld = 4 * (Math.pow(R, 4) / 36 + fArea * dy * dy);
  const Ix = IxBase + IxWeld; // mm^4

  const IyBase = 2 * ((tf * Math.pow(B, 3)) / 12) + ((H - 2 * tf) * Math.pow(tw, 3)) / 12;
  const IyWeld = 4 * (Math.pow(R, 4) / 36 + fArea * dz * dz);
  const Iy = IyBase + IyWeld; // mm^4

  const Sx = Ix / (H / 2), Sy = Iy / (B / 2);
  const Zx = B * tf * (H - tf) + (tw * Math.pow(H - 2 * tf, 2)) / 4 + 2 * R * R * dy;
  const Zy = (Math.pow(B, 2) * tf) / 2 + (Math.pow(tw, 2) * (H - 2 * tf)) / 4 + 2 * R * R * dz;
  const ix = Math.sqrt(Ix / A), iy = Math.sqrt(Iy / A);
  const Cw = Iy * Math.pow(H - tf, 2) / 4; // mm^6, whole-section-Iy approximation
  const J = (1 / 3) * (2 * B * Math.pow(tf, 3) + (H - 2 * tf) * Math.pow(tw, 3)); // mm^4, weld excluded
  const Av = (H - 2 * tf) * tw; // mm^2, clear-web shear area

  return { A, weight, Ix, Iy, Sx, Sy, Zx, Zy, ix, iy, Cw, J, Av };
}

/* ============================================================================
   UI COMPONENTS
   ========================================================================= */

function FitDiagram({ holeDia, dNet, section, code, fits }) {
  const size = 300;
  const cx = size / 2, cy = size / 2;
  const scale = (size * 0.42) / (holeDia / 2);
  const rHole = (holeDia / 2) * scale;
  const rNet = (dNet / 2) * scale;
  let diagMM = 0, rectW = 0, rectH = 0;
  if (section) {
    if (code === "AISC") { diagMM = Math.hypot(section.d, section.bf) * MM_PER_IN; rectW = section.bf * MM_PER_IN; rectH = section.d * MM_PER_IN; }
    else { diagMM = Math.hypot(section.h, section.b); rectW = section.b; rectH = section.h; }
  }
  const rDiag = (diagMM / 2) * scale;
  const rectColor = fits ? "#3fbf6f" : "#e5534b";

  return (
    <div>
      <div className="svg-wrap">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={rHole} fill="none" stroke="#4fb3ff" strokeWidth="2" />
          <circle cx={cx} cy={cy} r={rNet} fill="none" stroke="#93a4b3" strokeWidth="1.5" strokeDasharray="5 4" />
          {section && (
            <>
              <circle cx={cx} cy={cy} r={rDiag} fill="none" stroke={rectColor} strokeWidth="1.5" strokeDasharray="2 3" opacity="0.8" />
              <rect x={cx - (rectW * scale) / 2} y={cy - (rectH * scale) / 2}
                    width={rectW * scale} height={rectH * scale}
                    fill={rectColor} fillOpacity="0.22" stroke={rectColor} strokeWidth="2" />
            </>
          )}
        </svg>
      </div>
      <div className="legend">
        <span><span className="swatch" style={{background:"#4fb3ff"}}></span>Drilled hole (D_hole)</span>
        <span><span className="swatch" style={{background:"#93a4b3"}}></span>Net fit boundary (D_net)</span>
        {section && <span><span className="swatch" style={{background:rectColor}}></span>Selected section + rotation envelope</span>}
      </div>
    </div>
  );
}

function UtilBar({ value }) {
  const pct = Math.min(value * 100, 100);
  const cls = value <= 0.85 ? "ok" : value <= 1.0 ? "warn" : "over";
  return (
    <div className="util-cell">
      <div className="util-bar-wrap"><div className={"util-bar " + cls} style={{ width: pct + "%" }}></div></div>
      <span>{value.toFixed(2)}</span>
    </div>
  );
}

function ConvergenceChart({ history }) {
  const [hover, setHover] = useState(null);
  const w = 560, h = 200, pad = { l: 44, r: 14, t: 10, b: 26 };
  const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;

  if (history.length === 0) {
    return <div className="empty-state">Run the optimizer to see the convergence trace.</div>;
  }

  const objs = history.map(p => p.objective);
  const yMax = Math.max(...objs), yMin = Math.min(0, Math.min(...objs));
  const yScale = v => pad.t + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
  const xScale = i => pad.l + (history.length === 1 ? 0 : (i / (history.length - 1)) * plotW);

  let runningMin = Infinity;
  const bestSoFar = history.map(p => { runningMin = Math.min(runningMin, p.objective); return runningMin; });
  const linePath = bestSoFar.map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`).join(" ");

  const gridYs = [0, 0.25, 0.5, 0.75, 1.0].map(f => yMin + f * (yMax - yMin));

  function onMove(evt) {
    const rect = evt.currentTarget.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const idx = Math.round(((x - pad.l) / plotW) * (history.length - 1));
    const clamped = Math.max(0, Math.min(history.length - 1, idx));
    setHover(clamped);
  }

  return (
    <div className="chart-card" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} onMouseMove={onMove}>
        {gridYs.map((gy, i) => (
          <line key={i} className="chart-grid" x1={pad.l} x2={w - pad.r} y1={yScale(gy)} y2={yScale(gy)} />
        ))}
        <line className="chart-baseline" x1={pad.l} x2={pad.l} y1={pad.t} y2={h - pad.b} />
        <line className="chart-baseline" x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} />
        {gridYs.map((gy, i) => (
          <text key={i} className="chart-axis-label" x={pad.l - 6} y={yScale(gy) + 3} textAnchor="end">{gy.toFixed(0)}</text>
        ))}
        <text className="chart-axis-label" x={pad.l} y={h - 6}>iter 0</text>
        <text className="chart-axis-label" x={w - pad.r} y={h - 6} textAnchor="end">iter {history.length - 1}</text>

        {history.map((p, i) => (
          <circle key={i} cx={xScale(i)} cy={yScale(p.objective)} r="2.5"
                  fill={p.feasible ? "#3fbf6f" : "#e5534b"} opacity="0.55" />
        ))}
        <path d={linePath} fill="none" stroke="#4fb3ff" strokeWidth="2" />
        {bestSoFar.map((v, i) => (
          (i === 0 || v < bestSoFar[i - 1]) &&
          <circle key={"b" + i} cx={xScale(i)} cy={yScale(v)} r="3.5" fill="#4fb3ff" />
        ))}

        {hover !== null && (
          <line x1={xScale(hover)} x2={xScale(hover)} y1={pad.t} y2={h - pad.b}
                stroke="#93a4b3" strokeWidth="1" strokeDasharray="3 3" />
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tooltip" style={{ left: Math.min(xScale(hover) + 8, w - 170), top: 8 }}>
          <b>Iteration {hover}</b><br />
          d={history[hover].design.d.toFixed(0)} mm, bf={history[hover].design.bf.toFixed(0)} mm<br />
          weight={history[hover].design.weight.toFixed(1)} kg/m, obj={history[hover].objective.toFixed(1)}<br />
          {history[hover].feasible ? <span style={{ color: "#3fbf6f" }}>feasible</span> : <span style={{ color: "#e5534b" }}>infeasible</span>}
        </div>
      )}
      <div className="chart-legend">
        <span className="mk"><span className="swatch" style={{ background: "#4fb3ff" }}></span>Best-so-far (objective)</span>
        <span className="mk"><span className="swatch" style={{ background: "#3fbf6f" }}></span>Feasible sample</span>
        <span className="mk"><span className="swatch" style={{ background: "#e5534b" }}></span>Infeasible sample (penalized)</span>
      </div>
    </div>
  );
}

function ScatterChart({ history, dBounds, bfBounds, best }) {
  const [hover, setHover] = useState(null);
  const w = 400, h = 320, pad = { l: 46, r: 14, t: 14, b: 30 };
  const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;

  const xMin = dBounds[0], xMax = dBounds[1], yMin = bfBounds[0], yMax = bfBounds[1];
  const xScale = v => pad.l + ((v - xMin) / (xMax - xMin)) * plotW;
  const yScale = v => pad.t + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  if (history.length === 0) {
    return <div className="empty-state">Run the optimizer to see sampled (d, bf) points.</div>;
  }

  return (
    <div className="chart-card" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <rect x={pad.l} y={pad.t} width={plotW} height={plotH} fill="none" stroke="#2c3a48" strokeDasharray="4 3" />
        <line className="chart-baseline" x1={pad.l} x2={pad.l} y1={pad.t} y2={h - pad.b} />
        <line className="chart-baseline" x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} />
        <text className="chart-axis-label" x={pad.l} y={h - 8}>d={xMin.toFixed(0)}</text>
        <text className="chart-axis-label" x={w - pad.r} y={h - 8} textAnchor="end">d={xMax.toFixed(0)}</text>
        <text className="chart-axis-label" x={pad.l - 6} y={h - pad.b + 3} textAnchor="end">bf={yMin.toFixed(0)}</text>
        <text className="chart-axis-label" x={pad.l - 6} y={pad.t + 8} textAnchor="end">bf={yMax.toFixed(0)}</text>

        {history.map((p, i) => (
          p.feasible ? (
            <circle key={i} cx={xScale(p.design.d)} cy={yScale(p.design.bf)} r={hover === i ? 6 : 4.5}
                    fill="#3fbf6f" fillOpacity="0.85" stroke="#0f1720" strokeWidth="1"
                    onMouseEnter={() => setHover(i)} />
          ) : (
            <g key={i} transform={`translate(${xScale(p.design.d)},${yScale(p.design.bf)})`}
               onMouseEnter={() => setHover(i)}>
              <line x1="-4" y1="-4" x2="4" y2="4" stroke="#e5534b" strokeWidth={hover === i ? 2.5 : 1.6} />
              <line x1="-4" y1="4" x2="4" y2="-4" stroke="#e5534b" strokeWidth={hover === i ? 2.5 : 1.6} />
            </g>
          )
        ))}
        {best && (
          <g transform={`translate(${xScale(best.design.d)},${yScale(best.design.bf)})`}>
            <circle r="9" fill="none" stroke="#e5a63f" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tooltip" style={{ left: xScale(history[hover].design.d) + 10, top: yScale(history[hover].design.bf) }}>
          d={history[hover].design.d.toFixed(0)} mm, bf={history[hover].design.bf.toFixed(0)} mm<br />
          weight={history[hover].design.weight.toFixed(1)} kg/m<br />
          {history[hover].feasible ? "feasible" : "infeasible"}
        </div>
      )}
      <div className="chart-legend">
        <span className="mk"><span className="swatch" style={{ background: "#3fbf6f" }}></span>&#9679; Feasible</span>
        <span className="mk"><span className="swatch" style={{ background: "#e5534b" }}></span>&#10005; Infeasible</span>
        <span className="mk"><span className="swatch" style={{ background: "#e5a63f" }}></span>&#9711; Best found</span>
      </div>
    </div>
  );
}

function BayesianTab() {
  const [holeDia, setHoleDia] = useState(610);
  const [allowance, setAllowance] = useState(75);
  const [allowanceBasis, setAllowanceBasis] = useState("per_side");
  const [fy, setFy] = useState(355);
  const [mDemand, setMDemand] = useState(170);
  const [dLo, setDLo] = useState(150), [dHi, setDHi] = useState(600);
  const [bfLo, setBfLo] = useState(75), [bfHi, setBfHi] = useState(350);
  const [nInit, setNInit] = useState(8);
  const [nIter, setNIter] = useState(20);
  const [kappa, setKappa] = useState(2.0);
  const [seed, setSeed] = useState(42);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState([]);
  const [showTable, setShowTable] = useState(false);

  const dNet = netDiagonal(holeDia, allowance, allowanceBasis);

  const best = useMemo(() => {
    if (history.length === 0) return null;
    const feasible = history.filter(e => e.feasible);
    const pool = feasible.length ? feasible : history;
    return pool.reduce((a, b) => (b.objective < a.objective ? b : a));
  }, [history]);

  async function run() {
    setRunning(true); setProgress(0); setHistory([]);
    const problem = {
      dNet, fy, mDemand,
      dBounds: [dLo, dHi], bfBounds: [bfLo, bfHi],
      penaltyWeight: 500,
    };
    const rng = makeRng(seed);
    const state = initBO(problem, nInit, rng);
    setHistory(state.evals.slice());
    await new Promise(r => setTimeout(r, 0));
    for (let it = 0; it < nIter; it++) {
      stepBO(state, problem, 1200, kappa, rng);
      setHistory(state.evals.slice());
      setProgress(it + 1);
      await new Promise(r => setTimeout(r, 40));
    }
    setRunning(false);
  }

  const nearestKS = best ? nearestSection(KS_LIBRARY, best.design.d, best.design.bf) : null;
  const nearestEN = best ? nearestSection(EN_LIBRARY, best.design.d, best.design.bf) : null;

  const tile = (k, v, u) => (
    <div className="prop-tile"><div className="k">{k}</div><div className="v">{v}<span className="u">{u}</span></div></div>
  );

  return (
    <div className="grid">
      <div className="panel">
        <h2>Phase 2 &mdash; Bayesian refinement</h2>
        <div className="note" style={{ marginTop: 0, marginBottom: 12 }}>
          Continuous (depth, flange width) search for a custom built-up section &mdash;
          for cases the Phase 1 catalog search can't reach, or where the standard
          catalog result looks inefficient (utilization well below 1.0 across the
          board). <b>Illustrative Phase 2 seed only</b>, not a production selection.
        </div>

        <div className="field">
          <label>Drilling hole diameter, D_hole (mm)</label>
          <input type="number" value={holeDia} onChange={e => setHoleDia(+e.target.value)} disabled={running} />
        </div>
        <div className="row">
          <div className="field">
            <label>Allowance, C (mm)</label>
            <input type="number" value={allowance} onChange={e => setAllowance(+e.target.value)} disabled={running} />
          </div>
          <div className="field">
            <label>Basis</label>
            <div className="toggle-group">
              <button className={allowanceBasis === "per_side" ? "active" : ""} disabled={running} onClick={() => setAllowanceBasis("per_side")}>D-2C</button>
              <button className={allowanceBasis === "total" ? "active" : ""} disabled={running} onClick={() => setAllowanceBasis("total")}>D-C</button>
            </div>
          </div>
        </div>
        <div className="small-muted" style={{ marginBottom: 12 }}>D_net = {dNet.toFixed(0)} mm</div>

        <div className="row">
          <div className="field">
            <label>Steel grade, fy (MPa)</label>
            <input type="number" value={fy} onChange={e => setFy(+e.target.value)} disabled={running} />
          </div>
          <div className="field">
            <label>Moment demand, M (kN&middot;m)</label>
            <input type="number" value={mDemand} onChange={e => setMDemand(+e.target.value)} disabled={running} />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Depth search box, d (mm)</label>
            <div className="row" style={{ gap: 6 }}>
              <input type="number" value={dLo} onChange={e => setDLo(+e.target.value)} disabled={running} />
              <input type="number" value={dHi} onChange={e => setDHi(+e.target.value)} disabled={running} />
            </div>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>Flange width search box, bf (mm)</label>
            <div className="row" style={{ gap: 6 }}>
              <input type="number" value={bfLo} onChange={e => setBfLo(+e.target.value)} disabled={running} />
              <input type="number" value={bfHi} onChange={e => setBfHi(+e.target.value)} disabled={running} />
            </div>
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Initial samples</label>
            <input type="number" value={nInit} onChange={e => setNInit(+e.target.value)} disabled={running} />
          </div>
          <div className="field">
            <label>BO iterations</label>
            <input type="number" value={nIter} onChange={e => setNIter(+e.target.value)} disabled={running} />
          </div>
          <div className="field">
            <label>Exploration &kappa;</label>
            <input type="number" step="0.1" value={kappa} onChange={e => setKappa(+e.target.value)} disabled={running} />
          </div>
        </div>

        <div className="run-bar">
          <button className="btn-primary" disabled={running} onClick={run}>
            {running ? "Running..." : "Run Bayesian refinement"}
          </button>
          <button className="btn-secondary" disabled={running} onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>
            Randomize seed
          </button>
        </div>
        {running && (
          <div className="run-bar">
            <div className="progress-track"><div className="progress-fill" style={{ width: `${(progress / nIter) * 100}%` }}></div></div>
            <span className="small-muted">{progress}/{nIter}</span>
          </div>
        )}
      </div>

      <div>
        <div className="panel" style={{ marginBottom: 16 }}>
          <h2>Convergence &mdash; best objective vs. iteration</h2>
          <ConvergenceChart history={history} />
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
          <h2>Design space samples (d vs. bf)</h2>
          <ScatterChart history={history} dBounds={[dLo, dHi]} bfBounds={[bfLo, bfHi]} best={best} />
        </div>

        <div className="panel">
          <h2>Best design found</h2>
          {!best ? (
            <div className="empty-state">Run the optimizer to see a result.</div>
          ) : (
            <>
              <div className="prop-grid">
                {tile("Depth, d", best.design.d.toFixed(0), "mm")}
                {tile("Flange width, bf", best.design.bf.toFixed(0), "mm")}
                {tile("tf / tw (derived)", `${best.design.tf.toFixed(1)} / ${best.design.tw.toFixed(1)}`, "mm")}
                {tile("Weight", best.design.weight.toFixed(1), "kg/m")}
                {tile("Diagonal / D_net", `${best.design.diagonal.toFixed(0)} / ${dNet.toFixed(0)}`, "mm")}
                {tile("Mp (capacity)", best.MpKNm.toFixed(1), "kN·m")}
                {tile("Demand", mDemand.toFixed(1), "kN·m")}
                {tile("Feasible", best.feasible ? "Yes" : "No", "")}
              </div>
              <div className="note">
                Nearest standard catalog sections (Euclidean distance in h&times;b, not a
                capacity match &mdash; re-verify against Section 6):
                <br />&bull; KS: <b>{nearestKS.name}</b> ({nearestKS.mass.toFixed(1)} kg/m)
                <br />&bull; EN: <b>{nearestEN.name}</b> ({nearestEN.mass.toFixed(1)} kg/m)
              </div>
              <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => setShowTable(s => !s)}>
                {showTable ? "Hide" : "Show"} evaluation table ({history.length} samples)
              </button>
              {showTable && (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>#</th><th>d (mm)</th><th>bf (mm)</th><th>Weight (kg/m)</th><th>Mp (kN&middot;m)</th><th>Objective</th><th>Feasible</th></tr>
                    </thead>
                    <tbody>
                      {history.map((e, i) => (
                        <tr key={i} className={best === e ? "optimum" : ""}>
                          <td>{i}</td>
                          <td>{e.design.d.toFixed(0)}</td>
                          <td>{e.design.bf.toFixed(0)}</td>
                          <td>{e.design.weight.toFixed(1)}</td>
                          <td>{e.MpKNm.toFixed(1)}</td>
                          <td>{e.objective.toFixed(1)}</td>
                          <td>{e.feasible ? <span className="badge fit">YES</span> : <span className="badge nofit">NO</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OptimizerTab() {
  const [code, setCode] = useState("AISC");
  const [holeDia, setHoleDia] = useState(610);
  const [allowance, setAllowance] = useState(75);
  const [allowanceBasis, setAllowanceBasis] = useState("per_side");
  const [grade, setGrade] = useState("A992/Gr50");
  const [Mu, setMu] = useState(1500);
  const [Vu, setVu] = useState(30);
  const [Pu, setPu] = useState(0);
  const [LbConstruction, setLbConstruction] = useState(3048);
  const [LbService, setLbService] = useState(0);

  const meta = CODE_META[code];

  function onCodeChange(newCode) {
    setCode(newCode);
    const grades = Object.keys(CODE_META[newCode].grades);
    setGrade(grades[0]);
    if (newCode === "AISC") { setMu(1500); setVu(30); }
    else { setMu(170); setVu(130); }
  }

  const inp = useMemo(() => ({
    holeDia, allowance, allowanceBasis,
    fy: meta.grades[grade],
    Mu, Vu, Pu, MEd: Mu, VEd: Vu, NEd: Pu,
    LbConstruction, LbService,
  }), [holeDia, allowance, allowanceBasis, grade, Mu, Vu, Pu, LbConstruction, LbService, code]);

  const { dNet, admissible } = useMemo(() => optimize(code, inp), [code, inp]);
  const optimum = admissible.length ? admissible[0].section : null;

  return (
    <div className="grid">
      <div className="panel">
        <h2>Inputs</h2>

        <div className="field">
          <label>Design code</label>
          <div className="toggle-group">
            {["AISC", "EN", "KS"].map(c => (
              <button key={c} className={code === c ? "active" : ""} onClick={() => onCodeChange(c)}>{c}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Drilling hole diameter, D_hole (mm)</label>
          <input type="number" value={holeDia} onChange={e => setHoleDia(+e.target.value)} />
        </div>

        <div className="field">
          <label>Construction allowance, C (mm) &mdash; tiers per PRD Sec 4.2</label>
          <div className="chips">
            {[50, 75, 100].map(v => (
              <div key={v} className={"chip" + (allowance === v ? " active" : "")} onClick={() => setAllowance(v)}>{v} mm</div>
            ))}
          </div>
          <input style={{ marginTop: 6 }} type="number" value={allowance} onChange={e => setAllowance(+e.target.value)} />
        </div>

        <div className="field">
          <label>Allowance basis</label>
          <div className="toggle-group">
            <button className={allowanceBasis === "per_side" ? "active" : ""} onClick={() => setAllowanceBasis("per_side")}>Per-side (D-2C)</button>
            <button className={allowanceBasis === "total" ? "active" : ""} onClick={() => setAllowanceBasis("total")}>Total (D-C)</button>
          </div>
        </div>

        <div className="field">
          <label>Steel grade ({meta.gradeUnit})</label>
          <select value={grade} onChange={e => setGrade(e.target.value)}>
            {Object.entries(meta.grades).map(([k, v]) => <option key={k} value={k}>{k} (fy={v})</option>)}
          </select>
        </div>

        <div className="row">
          <div className="field">
            <label>Design moment ({meta.momentUnit})</label>
            <input type="number" value={Mu} onChange={e => setMu(+e.target.value)} />
          </div>
          <div className="field">
            <label>Design shear ({meta.shearUnit})</label>
            <input type="number" value={Vu} onChange={e => setVu(+e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Design axial, optional ({meta.axialUnit}) &mdash; 0 = flexure-shear only</label>
          <input type="number" value={Pu} onChange={e => setPu(+e.target.value)} />
        </div>

        <div className="row">
          <div className="field">
            <label>Unbraced construction Lb (mm) &mdash; 0 = not governing</label>
            <input type="number" value={LbConstruction} onChange={e => setLbConstruction(+e.target.value)} />
          </div>
          <div className="field">
            <label>Grout-braced Lb (mm)</label>
            <input type="number" value={LbService} onChange={e => setLbService(+e.target.value)} disabled />
          </div>
        </div>

        <div className="note">
          Grout-braced (in-service) uses Lb&rarr;0 (continuous restraint, PRD Sec 6.3).
          Both bracing stages are checked; the tool reports whichever governs
          (lower capacity). <b>LTB screening is a conservative simplification</b> &mdash;
          replace with full code equations for stamped final design.
        </div>
      </div>

      <div>
        <div className="panel" style={{ marginBottom: 16 }}>
          <h2>{meta.label} &mdash; fit check</h2>
          <FitDiagram holeDia={holeDia} dNet={dNet} section={optimum} code={code} fits={true} />
          <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--text-dim)" }}>
            D_net = {dNet.toFixed(0)} mm
          </div>
        </div>

        <div className="panel">
          <h2>Ranked admissible sections ({admissible.length} of {code === "AISC" ? AISC_LIBRARY.length : code === "EN" ? EN_LIBRARY.length : KS_LIBRARY.length})</h2>
          {admissible.length === 0 ? (
            <div className="empty-state">
              NO ADMISSIBLE SECTION &mdash; no catalog section both fits the hole and
              passes every applicable strength check. Widen the hole, raise the
              allowance tier, reduce demand, or check the Bayesian refinement
              prototype for a custom built-up option.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Weight ({meta.massUnit})</th>
                  <th>Diagonal (mm)</th>
                  <th>Governing stage</th>
                  <th>Flexure util.</th>
                  <th>Shear util.</th>
                  <th>Fit</th>
                </tr>
              </thead>
              <tbody>
                {admissible.map((r, i) => (
                  <tr key={r.name} className={i === 0 ? "optimum" : ""}>
                    <td>{r.name}</td>
                    <td>{r.weightOrMass.toFixed(1)}</td>
                    <td>{r.diagonal.toFixed(0)}</td>
                    <td>{r.stage}</td>
                    <td><UtilBar value={r.utilFlex} /></td>
                    <td><UtilBar value={r.utilShear} /></td>
                    <td><span className="badge fit">FITS</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionPropertyTab() {
  const [H, setH] = useState(420);
  const [B, setB] = useState(230);
  const [tw, setTw] = useState(8);
  const [tf, setTf] = useState(13);
  const [R, setR] = useState(6);

  const p = useMemo(() => builtUpProperties(H, B, tw, tf, R), [H, B, tw, tf, R]);
  const geomOk = H > 2 * tf + 10 && B > tw + 2 * R;

  const tile = (k, v, u) => (
    <div className="prop-tile"><div className="k">{k}</div><div className="v">{v}<span className="u">{u}</span></div></div>
  );

  return (
    <div className="grid">
      <div className="panel">
        <h2>Built-up section geometry</h2>
        <div className="field"><label>Depth, H (mm)</label><input type="number" value={H} onChange={e => setH(+e.target.value)} /></div>
        <div className="field"><label>Flange width, B (mm)</label><input type="number" value={B} onChange={e => setB(+e.target.value)} /></div>
        <div className="row">
          <div className="field"><label>Web thickness, tw (mm)</label><input type="number" value={tw} onChange={e => setTw(+e.target.value)} /></div>
          <div className="field"><label>Flange thickness, tf (mm)</label><input type="number" value={tf} onChange={e => setTf(+e.target.value)} /></div>
        </div>
        <div className="field"><label>Fillet weld leg, R (mm) &mdash; flange-web weld</label><input type="number" value={R} onChange={e => setR(+e.target.value)} /></div>
        {!geomOk && <div className="note"><b>Warning:</b> geometry looks inconsistent (check H, B, tw, tf, R proportions).</div>}
        <div className="note">
          Proportional design rule (workspace default starting point): bf&asymp;0.55H,
          tf&asymp;H/30, tw&asymp;H/50. Adjust freely &mdash; this tab does not enforce it.
          <br /><br />
          Includes 4 flange-web fillet welds (leg R, one each side of the web,
          top and bottom flange) via parallel-axis theorem. Cw and J use
          standard thin-wall open-section approximations (weld metal excluded
          from J, conservative). Verify against a full plate-girder check
          before stamped design.
        </div>
      </div>

      <div className="panel">
        <h2>Section properties</h2>
        <div className="prop-grid">
          {tile("Weight", p.weight.toFixed(1), "kg/m")}
          {tile("Area, A", (p.A / 100).toFixed(2), "cm²")}
          {tile("Ix (strong)", (p.Ix / 1e4).toFixed(0), "cm⁴")}
          {tile("Iy (weak)", (p.Iy / 1e4).toFixed(0), "cm⁴")}
          {tile("Sx", (p.Sx / 1e3).toFixed(0), "cm³")}
          {tile("Sy", (p.Sy / 1e3).toFixed(0), "cm³")}
          {tile("Zx (plastic)", (p.Zx / 1e3).toFixed(0), "cm³")}
          {tile("Zy (plastic)", (p.Zy / 1e3).toFixed(0), "cm³")}
          {tile("ix", (p.ix / 10).toFixed(2), "cm")}
          {tile("iy", (p.iy / 10).toFixed(2), "cm")}
          {tile("Cw (warping)", (p.Cw / 1e9).toExponential(2), "m⁶×10⁶")}
          {tile("J (torsion)", (p.J / 1e4).toFixed(1), "cm⁴")}
          {tile("Av (shear)", (p.Av / 100).toFixed(1), "cm²")}
          {tile("Shape factor Zx/Sx", (p.Zx / p.Sx).toFixed(2), "")}
        </div>
      </div>
    </div>
  );
}

export default function CIPBeamOptimizer() {
  const [tab, setTab] = useState("optimizer");
  return (
    <div>
      <style>{APP_CSS}</style>
      <h1>CIP Beam Optimizer</h1>
      <div className="subtitle">
        Steel beam selection for cast-in-place drilled-hole applications &mdash; geometric fit
        + AISC 360 / EN 1993-1-1 / KS dual-code capacity checks. Screening tool; not a
        substitute for a stamped structural calculation package.
      </div>
      <div className="tabs">
        <button className={"tab-btn" + (tab === "optimizer" ? " active" : "")} onClick={() => setTab("optimizer")}>CIP Beam Optimizer</button>
        <button className={"tab-btn" + (tab === "props" ? " active" : "")} onClick={() => setTab("props")}>Built-Up Section Properties</button>
        <button className={"tab-btn" + (tab === "bayesian" ? " active" : "")} onClick={() => setTab("bayesian")}>Bayesian Refinement (Phase 2)</button>
      </div>
      {tab === "optimizer" && <OptimizerTab />}
      {tab === "props" && <SectionPropertyTab />}
      {tab === "bayesian" && <BayesianTab />}
      <div className="footer-note">
        Companion files: optimized_beam_aisc.py &middot; optimized_steel_beam.py &middot;
        bayesian_optimization.py &middot; CIPBeamOptimizer.jsx. Section property tables are
        indicative &mdash; verify against the current AISC Steel Construction Manual / EN 10365
        / KS D 3502 producer tables before final design.
      </div>
    </div>
  );
}
