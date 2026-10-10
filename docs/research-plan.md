# Research plan and decision gates

## Existing rules collected — 2026-10-10

Start with [the mathematical typesetting research collection (日本語)](math-typesetting/README.md).
It separates source-backed rules from SUUSHIKI design proposals and includes
[32 comparison inputs](../examples/math-typesetting-cases.md). These inputs are
not executed tests. Source collection does not satisfy the implementation or
visual evaluation gates below.

## Current focus — preserve Stone, isolate collisions

Treat author and publication conventions as parameters. Investigate only the
[seven collision patterns](math-typesetting/decisions.md), using
[T01–T07](../examples/math-conflicts.md). Preserve Stone's punctuation, kinsoku,
word handling, baseline and justification rules while connecting measured math.

[Upstream inspection](math-typesetting/stone-engine.md) records the original design
and the JavaScript implementation at commit
`79a07777bcec540d94c5bd5304a68e427a1f49e6` (package version declaration `0.2.0`).
Coordinates and run placement are exposed; the high-level text API has no external
inline-box argument. This is a source inspection, not a working integration.
MathJax dimensions and an actual insertion procedure remain unresolved, so Gate 0
is not complete.

## Gate 0 — Inspect upstream (no implementation assumptions)

- Record exact upstream versions, licenses and dependency constraints.
- Locate public APIs for text measurement, layout and SVG output in stone-engine.js.
- Check whether line-breaking operates on characters, glyph runs or generic inline items.
- Determine how MathJax exposes rendered dimensions, baseline and accessibility information.
- Write down a reproducible local run procedure.
- Check that a candidate box retains its width, baseline, height and source mapping
  through remeasurement, punctuation processing, kinsoku and relayout. A single
  token or a manually adjusted placeholder width alone is not sufficient.

**Exit condition:** identify an insertion point for an inline math box, or explicitly document why none exists.

## Gate 1 — Reference comparison

Build a plain HTML + MathJax reference paragraph. Use fixed font, size, width and text, and record screenshots at at least two widths. This is a baseline, not the target typography.

**Exit condition:** a repeatable comparison with known source and environment.

## Gate 2 — Minimal integration

Try one horizontal Japanese paragraph with one nonbreaking inline formula. Investigate punctuation next to math, baseline alignment and wrapping near the right edge. Keep the renderer replaceable if practical.

**Exit condition:** a demonstrable difference from merely placing a formula in ordinary HTML flow.

## Gate 3 — Typographic evaluation

Compare against the reference with a typography reviewer. Classify each discrepancy as:
- Japanese composition rule
- math metrics / alignment
- font difference
- renderer/browser behavior
- deliberate stylistic choice

Do not label a visual difference an error without an explicit rule or criterion.
Record which fixed constraints compete. Distinguish an adapter defect from a case
that cannot fit under the selected width, line height or nonbreaking policy.
Style variants alone do not count as collisions.

## Defer

Display math, equation numbering, multiline formula breaks, vertical Japanese, full document editing, EPUB/Kindle export, and automatic PDF production.

## Risks

The central risk is not drawing math: it is the inability to inject an external measured box into stone-engine.js's actual composition algorithm without changing its internals. Resolve this before investing in UI or export pipelines.

