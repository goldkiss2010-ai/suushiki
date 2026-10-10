# Architecture hypothesis

This is a design hypothesis, **not a description of an implemented system**.

Preserve the text and math source as semantic segments, measure them, compose
one paragraph, and pass the resulting positions to a renderer.

The current policy is to parameterize author and publication choices and focus
on [seven collisions](math-typesetting/decisions.md). Inherit Stone's design
intent and extend Japanese paragraph composition to measured mathematics.
The current APIs, data structures, line advance and break positions are
references for comparison, not implementation invariants.

## Design inheritance, extension and connection

Inherit attention to Japanese punctuation and boundaries, adaptation to changing
screen sizes, access to internal layout geometry, and efficient relayout.
Extend the paragraph model to distinguish text runs from measured math items,
each with appropriate metrics and boundary behavior. Connect a math engine that
provides typeset geometry, rendering data and a mapping to the original source.

The resulting composition may reuse Stone's layouter, extend its core or revise
the composition layer. Evaluate these routes against the same small fixtures.
Changes to the implementation are allowed when they serve the inherited intent
and the mathematical requirements; document their purpose and observed effects.

## Three distinct responsibilities

1. **Source representation**: Japanese text runs, inline math runs, and paragraph constraints (font, size, available width).
2. **Composition**: widths, ascent/descent, baselines, spacing, Japanese line-breaking restrictions, and placement.
3. **Rendering**: convert the computed placement into visible output.

A renderer should not silently make different line-break decisions unless explicitly operating in a separate, browser-native mode.

## Inline math contract (candidate)

An inline formula may initially be treated as a nonbreaking measured box:

```ts
type InlineMathBox = {
  kind: "math";
  source: string;       // e.g. TeX input, preserved for accessibility/export
  width: number;        // advance in CSS px; boundary spacing kept separate
  ascent: number;       // CSS px above baseline
  descent: number;      // CSS px below baseline
  axisHeight?: number;  // CSS px above baseline, when available
};
```

Stone's coordinates are CSS px with y pointing down; horizontal run positions
use a common baseline. [The pinned source inspection](math-typesetting/stone-engine.md)
records these conventions. The math adapter must still establish its baseline,
unit conversion, outer spacing and ink bounds. The object above is illustrative,
**not an existing stone-engine.js or MathJax API**.

The integration also needs a source-range mapping and explicit boundary
attributes for spacing, justification and allowed breaks. A box's first or last
visible glyph does not establish these attributes. Math internals remain owned
by the math engine; the paragraph compositor, informed by Stone's design,
adjusts text and the outside of the box.

Treating the formula as one word token is insufficient: the inspected Stone
implementation can split a token that does not fit. The nonbreaking contract
must survive relayout, kinsoku, measurement, rendering and source mapping.

## Critical unknowns

- What measured-item contract should extend the current run/token model?
- Which adapter, core extension or revised composition layer can implement that contract?
- Which Japanese rules can be reused directly, and which need explicit text/math boundary behavior?
- How should fixed and content-aware line advance handle tall formulas?
- Which MathJax output path offers reliable browser dimensions and baseline metrics?
- Can renderer-independent coordinates preserve selectable, accessible text?
- What font metrics and browser differences affect reproducibility?

## Strategy

Begin with one paragraph and a measured math item. Compare an adapter with a
core extension or revised compositor, using the inspected Stone implementation
as a reference. Choose a connection that exposes the required metrics and break
behavior. Unchanged upstream internals are not an exit condition. Record the
changed interfaces, their purpose, maintenance implications and attribution.

Use Stone's punctuation, kinsoku, baseline and justification as the initial
reference policies, then specify their behavior at text/math boundaries.
Line advance is configurable: compare a fixed policy with a content-aware policy
that accounts for each line's ascent and descent. Establish a stable baseline
for each line and record any deliberate change in rhythm or break positions.
Keep input spaces, generated boundary spacing and math-engine outer spacing
distinct; recompute boundaries after wrapping.

Use one paragraph line-break owner. In the nonbreaking experiment, investigate
MathJax 4's `output.linebreaks.inline: false` and verify the actual output before
placing it. Font, size or output changes invalidate math measurements and the
paragraph layout. A renderer must use the measured geometry.

If the chosen width or line advance cannot hold the box and its required
neighbors, record the competing constraints. A selected fallback may change
the policy; do not silently split, clip, shrink or rewrite the formula. Explicit
truncation or whole-paragraph scaling must preserve the box as a unit, its
source mapping and agreement between measured and drawn dimensions.

Measured inline images may later share part of the item contract. Figures,
tables, captions and text wrapping around figures still require separate document
layout work and are outside the first paragraph experiment.

Avoid claiming EPUB support based on browser success. A separate semantic HTML/MathML export path may be appropriate later, subject to reader compatibility.

