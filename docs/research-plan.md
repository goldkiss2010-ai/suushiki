# Research plan and decision gates

## Existing rules collected — 2026-10-10

Start with [the mathematical typesetting research collection (日本語)](math-typesetting/README.md).
It separates source-backed rules from SUUSHIKI design proposals and includes
[32 comparison inputs](../examples/math-typesetting-cases.md). These inputs are
not executed tests. Source collection does not satisfy the implementation or
visual evaluation gates below.

## Current focus — inherit Stone's intent, extend and connect math

Treat author and publication conventions as parameters. Investigate only the
[seven collision patterns](math-typesetting/decisions.md), using
[T01–T07](../examples/math-conflicts.md). Inherit Stone's attention to Japanese
composition, responsive screens, inspectable geometry and efficient relayout.
Extend the item and line model as needed, and connect measured math to one
paragraph composition decision. Exact APIs, fixed line advance and upstream
break positions are comparison references, not compatibility requirements.

[Upstream inspection](math-typesetting/stone-engine.md) records the original design
and the JavaScript implementation at commit
`79a07777bcec540d94c5bd5304a68e427a1f49e6` (package version declaration `0.2.0`).
Coordinates and run placement are exposed; the high-level text API has no external
inline-box argument. This is a source inspection, not a working integration.
The standalone measurement and single-formula connection are now implemented; a
structured multi-formula layout core and experimental browser workbench have also
been added. The entire seven-case visual comparison and accessibility review remain
open. This document records decision gates, not a certificate of production readiness.

## Gate 0 — Inspect upstream (no implementation assumptions)

- Record exact upstream versions, licenses and dependency constraints.
- Locate public APIs for text measurement, layout and SVG output in stone-engine.js.
- Check whether line-breaking operates on characters, glyph runs or generic inline items.
- Determine how MathJax exposes rendered dimensions, baseline and accessibility information.
- Write down a reproducible local run procedure.
- Check that a candidate box retains its width, baseline, height and source mapping
  through remeasurement, punctuation processing, kinsoku and relayout. A single
  token or a manually adjusted placeholder width alone is not sufficient.
- Compare an adapter, a core inline-item extension and a revised composition
  layer. Record what each changes and how it carries forward the design intent.

**Exit condition:** identify a viable connection for an inline math box, including
the extensions it requires, or document the remaining blocker. Unchanged upstream
internals are not an exit condition.

## Gate 1 — Reference comparison

Build a plain HTML + MathJax reference paragraph. Use fixed font, size, width and text, and record screenshots at at least two widths. This is a baseline, not the target typography.

Also capture a text-only paragraph using the pinned Stone implementation. Compare
it with the extended composition under the same fonts, options and width, and
record intentional changes separately from regressions.

**Exit condition:** a repeatable comparison with known source and environment.

## Gate 2 — Minimal integration

Try one horizontal Japanese paragraph with one nonbreaking inline formula. Investigate punctuation next to math, baseline alignment and wrapping near the right edge. Keep the renderer replaceable if practical.

Then use T04 to compare fixed line advance with a content-aware policy that uses
line ascent/descent. A justified change to line advance or break positions is an
extension result, not a failure to reproduce Stone. Preserve source meaning and
agreement between measured and rendered geometry.

**Exit condition:** a demonstrable difference from merely placing a formula in ordinary HTML flow.

## Gate 3 — Typographic evaluation

Compare against the reference with a typography reviewer. Classify each discrepancy as:
- Japanese composition rule
- math metrics / alignment
- font difference
- renderer/browser behavior
- deliberate stylistic choice

Do not label a visual difference an error without an explicit rule or criterion.
Record which selected constraints compete. Distinguish a connection defect from a case
that cannot fit under the selected width, line height or nonbreaking policy.
Style variants alone do not count as collisions.
Evaluate the extended rules on their stated requirements; matching every upstream
break position is not required. Observe relayout cost and measurement reuse;
neither performance nor readability is established by source inspection alone.

## Defer

Display math, equation numbering, multiline formula breaks, figures and tables,
figure captions and text wrapping around figures, vertical Japanese, full document
editing, EPUB/Kindle export, and automatic PDF production. Inline images may later
share part of the measured-item contract; their integration is not claimed here.

## Risks

The central uncertainty is how much of the item, line and source-mapping model
must evolve to compose Japanese text and mathematics consistently. Internal
changes are an allowed route. Resolve the connection and observe its behavior
and relayout cost before investing in UI or export pipelines.

