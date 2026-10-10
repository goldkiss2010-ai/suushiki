# Architecture hypothesis

This is a design hypothesis, **not a description of an implemented system**.

```text
Japanese text + math source
            |
     semantic segments
            |
    measure text / math
            |
  unified line-layout decisions
            |
  renderer-independent layout data
            |
      HTML / SVG / ...
```

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
  width: number;        // layout units: convention TBD
  ascent: number;       // distance above baseline
  descent: number;      // distance below baseline
  axisHeight?: number;  // math axis above baseline, when available
};
```

The text engine's units and measurement conventions must be investigated before implementing this interface. The object above is illustrative, **not an existing stone-engine.js or MathJax API**.

## Critical unknowns

- Does stone-engine.js expose enough measurement and placement information?
- Can its line-breaking algorithm accept arbitrary external boxes, or would a small internal extension be needed?
- Does it require glyph-by-glyph placement for its Japanese spacing rules?
- Which MathJax output path offers reliable browser dimensions and baseline metrics?
- Can renderer-independent coordinates preserve selectable, accessible text?
- What font metrics and browser differences affect reproducibility?

## Strategy

Begin with an external adapter and a single paragraph. Keep upstream libraries unchanged until a specific missing capability is demonstrated. If an internal change becomes necessary, document the smallest interface addition and upstream compatibility implications.

Avoid claiming EPUB support based on browser success. A separate semantic HTML/MathML export path may be appropriate later, subject to reader compatibility.
