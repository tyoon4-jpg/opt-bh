# WORKFLOW.md — Development Workflow & Task Pipeline

## Development Philosophy

This project follows a **layered development** approach: each topic is explored through progressive depth — conceptual understanding first, then mathematical formulation, then code implementation, then extended validation and documentation. Deliverables are produced at each layer, not only at the end.

## Task Categories

### Category 1: Section Design & Optimization

**Workflow for a new optimized section:**

```
1. DEFINE LOADING
   └── Identify member type (soldier pile / waler / strut / raker)
   └── Determine demand ratio α = Mx,req / My,req
   └── Establish Sx,req from structural analysis
   └── Define boundary conditions (bracing, unbraced length, connections)

2. INITIAL GEOMETRY (Proportional Rule)
   └── Choose target depth H based on Sx,req and installation constraints
   └── Apply: bf = 0.55H, tf = H/30, tw = H/50
   └── Verify Sx ≥ Sx,req → adjust H if insufficient

3. GRID SEARCH REFINEMENT (Octave)
   └── Run optimized_steel_beam.m with target Sx,req
   └── Sweep H, bf, tf, tw within practical bounds
   └── Apply full constraint set (EC3 + AISC)
   └── Rank solutions by weight → select minimum

4. CONSTRAINT VERIFICATION
   └── Flange local buckling: bf/(2tf) ≤ limit
   └── Web slenderness: hw/tw ≤ limit
   └── Shear buckling: check EN 1993-1-5 / AISC G2
   └── LTB check at design unbraced length
   └── Shear flow → weld sizing at flange-web junction
   └── Fabrication: plate availability, minimum dimensions

5. DOCUMENTATION
   └── Comparison table: baseline vs optimized
   └── Weight savings calculation
   └── Code compliance summary (dual-code)
   └── .docx deliverable if formal document requested
```

### Category 2: Patent Development

**Workflow for a new patent concept:**

```
1. CONCEPT SCOPING
   └── Define the inventive step
   └── Distinguish from prior art
   └── Identify claim categories (method / system / product)

2. TECHNICAL DEVELOPMENT
   └── Mathematical formulation
   └── Demonstrated embodiment with numbers
   └── Comparative analysis (conventional vs. proposed)
   └── Application matrix across member types

3. CLAIM DRAFTING
   └── Independent claims (3 categories when possible)
   └── Dependent claims for specific embodiments
   └── Dependency map
   └── Abstract (250 words max)

4. DOCUMENT PREPARATION
   └── Full patent application as .docx
   └── Sections: Technical Field, Background, Summary, 
       Detailed Description, Fabrication, Claims, 
       Dependency Map, Abstract
```

### Category 3: Technical Documentation

**Workflow for code-referenced technical reports:**

```
1. SCOPE DEFINITION
   └── Identify governing codes (Korean + international)
   └── Define coverage: methods, comparisons, specifications

2. CODE RESEARCH
   └── Extract relevant clause numbers and requirements
   └── Cross-reference Korean (KDS/KCS) with international (EC3/AISC)
   └── Identify gaps or conflicts between codes

3. CONTENT DEVELOPMENT
   └── Method descriptions with pros/cons
   └── Specification tables with dimensional requirements
   └── Design check procedures
   └── Applicability guidance

4. DELIVERABLE
   └── .docx with structured sections, numbered headings
   └── Comparative tables, specification summaries
   └── Code clause references throughout
```

### Category 4: Optimization Algorithm Development

**Workflow for advancing the optimization pipeline:**

```
1. CURRENT STATE: Grid Search in Octave
   └── Coarse sweep of H, bf, tf, tw
   └── Full EC3 constraint checking
   └── Multi-grade comparison (SS400, SM490, SM520, SS540)

2. NEXT: Local Refinement
   └── Finer grid around best solutions from coarse sweep
   └── Sensitivity analysis (∂A/∂H, ∂A/∂bf, etc.)

3. PLANNED: Bayesian Optimization in Python
   └── Surrogate model (GP or TPE) over the constraint-checked objective
   └── Libraries: Optuna (primary), scikit-optimize, BoTorch
   └── Handle discrete constraints (standard plate thicknesses)
   └── Multi-objective: minimize weight + minimize LTB sensitivity

4. FUTURE: Automated Design Tool
   └── Input: Sx,req, steel grade, installation method, bracing conditions
   └── Output: Optimized section dimensions, fabrication specification
   └── Format: CLI tool or web calculator
```

## Decision Framework

When a task could go multiple directions, apply this priority:

| Priority | Principle |
|----------|-----------|
| 1 | **Structural safety first** — never compromise capacity for weight savings |
| 2 | **Fabrication reality** — dimensions must use available plate, practical welds |
| 3 | **Code compliance** — both Korean and international simultaneously |
| 4 | **Weight optimization** — minimize material within all constraints |
| 5 | **System integration** — consider impact on connections, adjacent members |

## Version Control

Since this project uses Claude as the development environment, version tracking is managed through:

- **Document naming**: Include version number or date in filename
- **Conversation history**: Past chats serve as development log
- **Memory system**: Key decisions and parameters are captured across sessions
- **Incremental deliverables**: Each session produces a concrete output file

## Quality Checklist

Before delivering any technical output, verify:

- [ ] Units are consistent (mm, MPa, kN, cm³, cm⁴)
- [ ] Both Korean and international code references included
- [ ] Numerical results cross-checked (Sx, A, Ix calculations)
- [ ] Slenderness limits checked for the applicable steel grade (ε factor)
- [ ] LTB flagged if member is laterally unbraced
- [ ] Fabrication constraints respected (plate thickness, weld access)
- [ ] Comparison with baseline conventional section provided
- [ ] File validated if .docx (using validate.py)
