# CONVENTIONS.md — Technical Conventions & Standards

## Unit System

All calculations and documents use the following consistent unit set:

| Quantity | Unit | Notes |
|----------|------|-------|
| Length | mm | Cross-section dimensions, plate thicknesses |
| Span / depth | m | Member lengths, unbraced lengths, excavation depth |
| Force | kN | Applied loads, reactions, shear forces |
| Moment | kN·m | Bending moments |
| Stress | MPa (= N/mm²) | Yield strength, allowable stress, applied stress |
| Section modulus | cm³ | Sx, Sy — elastic section modulus |
| Moment of inertia | cm⁴ | Ix, Iy — second moment of area |
| Cross-sectional area | cm² | A — for weight calculation |
| Unit weight | kg/m | Member weight per unit length |
| Steel density | 7,850 kg/m³ | Standard value |

**Conversion reminder**: 1 cm² = 100 mm², 1 cm³ = 1,000 mm³, 1 cm⁴ = 10,000 mm⁴

## Section Designation Convention

Built-up sections follow the format:

```
H-[depth]×[flange width]×[web thickness]×[flange thickness]

Example: H-420×230×8×13
         │     │     │   └── tf = 13 mm
         │     │     └────── tw = 8 mm
         │     └──────────── bf = 230 mm
         └────────────────── H = 420 mm
```

This matches the Korean standard notation for H-sections (KS convention).

## Steel Grade Reference

### Korean Grades (KS D 3503 / KS D 3515)

| Grade | Fy (MPa) | Fu (MPa) | ε = √(235/Fy) | Use Case |
|-------|----------|----------|----------------|----------|
| SS400 | 235 | 400–510 | 1.00 | Baseline, general use |
| SM400 | 235 | 400–510 | 1.00 | Welded structures |
| SM490 | 315 | 490–610 | 0.86 | Higher strength, common |
| SM490Y | 325 | 490–610 | 0.85 | Improved yield point |
| SM520 | 355 | 520–640 | 0.81 | High strength |
| SS540 | 390 | ≥540 | 0.78 | Very high strength |
| HSB500 | 380 | 500–640 | 0.79 | Building-grade high strength |
| HSB600 | 440 | 570–720 | 0.73 | Ultra-high strength |

### Eurocode Grades (EN 10025)

| Grade | Fy (MPa) | ε |
|-------|----------|---|
| S235 | 235 | 1.00 |
| S275 | 275 | 0.92 |
| S355 | 355 | 0.81 |
| S460 | 460 | 0.71 |

### AISC Grade

| Grade | Fy (MPa) | Fy (ksi) |
|-------|----------|----------|
| A992 | 345 | 50 |

## Code Reference System

### Korean Standards

| Code | Title | Scope |
|------|-------|-------|
| KDS 21 30 00 | 흙막이 설계기준 | Earth retention design standard |
| KCS 21 30 00 | 흙막이 시공기준 | Earth retention construction standard |
| KDS 14 31 25 | 강구조 볼트접합 설계기준 | Steel bolted connection design |
| KS D 3503 | 일반구조용 압연강재 | General structural rolled steel |
| KS D 3515 | 용접구조용 압연강재 | Welding structural rolled steel |
| KS B 1010 | 마찰접합용 고력볼트 | High-strength friction bolts |
| KS F 4602 | 콘크리트용 철근 이음장치 | (reference for splice concepts) |

### Eurocode

| Code | Scope |
|------|-------|
| EN 1993-1-1 | General rules and rules for buildings |
| EN 1993-1-5 | Plated structural elements (web/flange buckling) |
| EN 1993-1-8 | Design of joints |
| EN 1090-2 | Execution of steel structures (fabrication tolerances) |

### AISC / American

| Code | Scope |
|------|-------|
| AISC 360-22 | Specification for Structural Steel Buildings |
| AWS D1.1 | Structural Welding Code — Steel |
| ASTM A992 | Standard specification for structural steel shapes |

## Slenderness Limits Quick Reference

### Flange Local Buckling (Outstanding Flange: bf / 2tf)

| Class | EN 1993-1-1 | AISC 360 |
|-------|-------------|----------|
| Class 1 (Compact) | 9ε | 0.38√(E/Fy) |
| Class 2 (Compact) | 10ε | — |
| Class 3 (Noncompact) | 14ε | 1.0√(E/Fy) |

### Web Slenderness (hw / tw, pure bending)

| Class | EN 1993-1-1 | AISC 360 |
|-------|-------------|----------|
| Class 1 | 72ε | 3.76√(E/Fy) |
| Class 2 | 83ε | — |
| Class 3 | 124ε | 5.70√(E/Fy) |

### Shear Buckling Threshold

| Code | No stiffeners needed if |
|------|------------------------|
| EN 1993-1-5 | hw/tw ≤ 72ε/η (η = 1.0 or 1.2) |
| AISC 360 | h/tw ≤ 2.24√(E/Fy) |

## Welding Conventions

| Parameter | Standard | Notes |
|-----------|----------|-------|
| Flange-to-web weld | Continuous fillet or PJP | SAW preferred for production |
| Minimum fillet size | per AWS D1.1 Table 5.7 | Based on thicker plate joined |
| Electrode for site splices | E4316 (저수소계) | Per KCS 21 30 00 §2.2(4) |
| NDT requirement | UT for CJP butt welds | Per project specification |
| Fabrication tolerance | EN 1090-2 Class 2 | Or AISC Code of Standard Practice |

## Naming Conventions

### Files

| Type | Convention | Example |
|------|-----------|---------|
| Octave scripts | snake_case.m | `optimized_steel_beam.m` |
| Python scripts | snake_case.py | `bayesian_optimization.py` |
| Documents | Title_Case.docx | `Patent_ConceptA_Parametric_Section_Optimization.docx` |
| Data files | snake_case.csv | `section_catalog.csv` |
| Figures | snake_case.svg | `cross_section_comparison.svg` |

### Variables (in code)

| Variable | Meaning | Unit |
|----------|---------|------|
| `H` | Overall section depth | mm |
| `bf` | Flange width | mm |
| `tf` | Flange thickness | mm |
| `tw` | Web thickness | mm |
| `hw` | Clear web depth (H − 2tf) | mm |
| `Ix`, `Iy` | Moment of inertia (strong/weak) | cm⁴ |
| `Sx`, `Sy` | Section modulus (strong/weak) | cm³ |
| `A` | Cross-sectional area | cm² |
| `Fy` | Yield strength | MPa |
| `E` | Elastic modulus (= 200,000 or 205,000) | MPa |
| `eps` | ε = √(235/Fy) | dimensionless |
| `Lu` | Unbraced length | mm or m |
| `Mcr` | Elastic critical moment (LTB) | kN·m |

## Section Property Formulas

For a doubly-symmetric I-section:

```
hw  = H − 2·tf                              (clear web depth)
A   = 2·bf·tf + hw·tw                       (cross-sectional area, mm²)
Ix  = (1/12)·[bf·H³ − (bf−tw)·hw³]          (strong-axis, mm⁴)
Iy  = (1/12)·[2·tf·bf³ + hw·tw³]            (weak-axis, mm⁴)
Sx  = Ix / (H/2)                            (strong-axis section modulus, mm³)
Sy  = Iy / (bf/2)                           (weak-axis section modulus, mm³)
W   = A × 7.85 × 10⁻³                      (unit weight, kg/m, with A in mm²)
```

**Convert to cm units**: divide mm² by 100, mm³ by 1000, mm⁴ by 10000.

## Proportional Design Rule

| Parameter | Ratio | Range | Governing Constraint |
|-----------|-------|-------|---------------------|
| bf | 0.55H | 0.50H – 0.60H | LTB stability / welding width |
| tf | H/30 | H/32 – H/25 | Flange local buckling |
| tw | H/50 | H/60 – H/45 | Web shear buckling |
