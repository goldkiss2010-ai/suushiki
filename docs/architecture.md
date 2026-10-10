# Architecture hypothesis

This is a design hypothesis, **not a description of an implemented system**.

Preserve the text and math source as semantic segments, measure them, compose
one paragraph, and pass the resulting positions to a renderer.

The current policy is to parameterize author and publication choices and focus
on [seven collisions](math-typesetting/decisions.md). Preserve Stone's Japanese
composition rules and limit changes to the connection with measured math.

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
by the math engine; Stone adjusts text and the outside of the box.

Treating the formula as one word token is insufficient: the inspected Stone
implementation can split a token that does not fit. The nonbreaking contract
must survive relayout, kinsoku, measurement, rendering and source mapping.

## Critical unknowns

- Which of Stone's exposed run, token and placement structures can safely carry a math item?
- Can its line-breaking algorithm accept arbitrary external boxes, or would a small internal extension be needed?
- Does it require glyph-by-glyph placement for its Japanese spacing rules?
- Which MathJax output path offers reliable browser dimensions and baseline metrics?
- Can renderer-independent coordinates preserve selectable, accessible text?
- What font metrics and browser differences affect reproducibility?

## Strategy

Begin with an external adapter and a single paragraph. Keep upstream libraries unchanged until a specific missing capability is demonstrated. If an internal change becomes necessary, document the smallest interface addition and upstream compatibility implications.

Keep Stone's punctuation, strong kinsoku, common baseline, constant line advance
and eligible justification gaps as the starting behavior. Set style policies
before measuring. Keep input spaces, generated boundary spacing and math-engine
outer spacing distinct; recompute boundaries after wrapping.

Use one paragraph line-break owner. In the nonbreaking experiment, investigate
MathJax 4's `output.linebreaks.inline: false` and verify the actual output before
placing it. Font, size or output changes invalidate math measurements and the
paragraph layout. A renderer must use the measured geometry.

If the chosen width or line advance cannot hold the box and its required
neighbors, record the competing constraints. A selected fallback may change
the policy; do not silently split, clip, shrink or rewrite the formula. Explicit
truncation or whole-paragraph scaling must preserve the box as a unit, its
source mapping and agreement between measured and drawn dimensions.

Avoid claiming EPUB support based on browser success. A separate semantic HTML/MathML export path may be appropriate later, subject to reader compatibility.

