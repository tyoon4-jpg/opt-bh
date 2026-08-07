# PROMPT.md — Prompting Guide for This Project

## Purpose

This document provides guidance on how to prompt Claude effectively within this project. It captures patterns that have worked well and structures that produce the best outputs for structural engineering, optimization, and patent development tasks.

## Effective Prompt Patterns

### 1. Section Design Requests

**Pattern**: State the member type, loading, and desired output.

```
Design an optimized built-up section for a waler beam.
- Span between struts: 6m
- Required Sx: 2,500 cm³
- Steel grade: SM490Y
- Lateral bracing: continuous from diaphragm wall
- Output: comparison table + Octave verification
```

**Why it works**: Gives all four inputs the optimization needs (member type → demand ratio, Sx,req → target, grade → material, bracing → LTB treatment) and specifies the deliverable format.

### 2. Code Comparison Requests

**Pattern**: Name the topic + codes + format.

```
Compare flange local buckling limits for Class 2 sections
across EN 1993-1-1, AISC 360-22, and KDS 21 30 00.
Include the ε factor effect for SM490 vs SS400.
Deliver as a .docx table.
```

### 3. Patent Expansion Requests

**Pattern**: Name the concept + scope + claim direction.

```
Develop Concept B (Modular Built-Up Section System) with:
- Technical detail on standardized plate inventory
- At least 2 independent claims (system + method)
- Dependency map showing relationship to Concept A claims
- .docx format
```

### 4. Optimization Script Requests

**Pattern**: Specify algorithm + constraints + output.

```
Modify the Octave grid search to add LTB check
per EN 1993-1-1 §6.3.2 (simplified method).
- Unbraced length: 3m (waler between strut points)
- Add Mcr calculation using Annex F approach
- Color-code results: green = passes LTB, red = fails
```

### 5. Quick Concept Exploration

**Pattern**: Ask the question + specify depth.

```
What happens to the proportional design rule when we go
above H = 600mm? Does tw = H/50 still work or does web
buckling become governing? ### A simple concept.
```

The `### A simple concept` suffix signals: give me the insight without a 10-page report.

### 6. Visualization Requests

**Pattern**: Describe what to show + purpose.

```
Create an SVG diagram showing the cross-section comparison
between H-300×300×10×15 and H-420×230×8×13 side by side,
with dimension annotations and area breakdown by component.
```

## Depth Control Markers

Use these suffixes to control response depth:

| Marker | Meaning | Typical Output |
|--------|---------|----------------|
| `### A simple concept` | Concise insight, rule of thumb | 1 paragraph + table |
| `### With calculations` | Show the math, step by step | Worked example with equations |
| `### Full technical detail` | Comprehensive treatment | Multi-page with code references |
| `### As a .docx` | Formal document deliverable | Structured Word document |
| `### Octave code` | Runnable implementation | .m script file |
| `### Compare with AISC` | Dual-code treatment | Side-by-side EC3 vs AISC |

## Common Request Templates

### New Member Optimization

```
Optimize a [member type] section:
- Loading: [describe forces/moments]
- Target Sx: [value] cm³
- Depth constraint: [max H if any]
- Steel grade: [grade]
- Bracing: [lateral bracing description]
- Installation: [CIP bored / driven / placed in D-wall]
### [depth marker]
```

### Fabrication Detail

```
Detail the shop fabrication procedure for [section designation]:
- Welding: [SAW / FCAW / SMAW]
- Quality: [KCS requirements + EN 1090 class]
- Tolerances: [reference code]
- Connection prep: [any pre-installed details]
### As a .docx
```

### Code Clause Lookup

```
What does [KDS/KCS/EN/AISC clause number] require for
[specific topic]? Cross-reference with [other code].
```

### Patent Claim Refinement

```
Refine Claim [number] to:
- Narrow the scope to [specific application]
- Add a dependent claim covering [feature]
- Ensure no conflict with Claim [other number]
```

## Anti-Patterns (What Not to Do)

| Anti-Pattern | Problem | Better Alternative |
|-------------|---------|-------------------|
| "Optimize a beam" | No target, no constraints | Specify Sx,req, grade, member type |
| "Check all the codes" | Unbounded scope | Name specific codes and clauses |
| "Make it better" | No success criteria | "Reduce weight by 5% while keeping Sx ≥ 1,400 cm³" |
| "Write everything about soldier piles" | Too broad | Scope to specific aspect (splice, installation, optimization) |

## Language Notes

- Technical prompts can be in **English or Korean** — Claude handles both and will use Korean terminology where appropriate
- For patent documents, English is primary with Korean terms in parentheses
- For KDS/KCS code references, Korean clause names can be used directly (e.g., "전단면 맞대기 용접 requirements")
