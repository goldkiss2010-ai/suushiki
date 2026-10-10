# Research plan and decision gates

## Existing rules collected — 2026-10-10

Start with [the mathematical typesetting research collection (日本語)](math-typesetting/README.md).
It separates source-backed rules from SUUSHIKI design proposals and includes
[32 comparison inputs](../examples/math-typesetting-cases.md). These inputs are
not executed tests. Source collection does not satisfy the implementation or
visual evaluation gates below.

## Gate 0 — Inspect upstream (no implementation assumptions)

- Record exact upstream versions, licenses and dependency constraints.
- Locate public APIs for text measurement, layout and SVG output in stone-engine.js.
- Check whether line-breaking operates on characters, glyph runs or generic inline items.
- Determine how MathJax exposes rendered dimensions, baseline and accessibility information.
- Write down a reproducible local run procedure.

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

## Defer

Display math, equation numbering, multiline formula breaks, vertical Japanese, full document editing, EPUB/Kindle export, and automatic PDF production.

## Risks

The central risk is not drawing math: it is the inability to inject an external measured box into stone-engine.js's actual composition algorithm without changing its internals. Resolve this before investing in UI or export pipelines.

