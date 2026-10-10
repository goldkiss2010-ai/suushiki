# T01–T07: executable collision matrix

This page records **which properties the tests actually verify**, rather than treating a displayable example as a solved typesetting rule. The canonical input descriptions remain in [examples/math-conflicts.md](../examples/math-conflicts.md). The executable versions use the supported \( ... \) source delimiters and live in [public/collision-cases.js](../public/collision-cases.js).

Open /document.html and choose a T01–T07 option from the 「比較例」 menu. T02 and T03 have multiple variants because explicit whitespace and punctuation adjacency are independent conditions.

| Case | Automated checks | Still unverified |
| --- | --- | --- |
| T01: formula interior | One indivisible math item, correct source, same single SVG item with measured dimensions | Mathematical font spacing under justified paragraph settings; application does not yet offer justification |
| T02: boundary spacing | Input ASCII whitespace is preserved; selectable none/quarter/contextual outer spacing is measured and corrected at soft line edges | A typographically validated default, MathJax ink-bound separation, justification and production typography |
| T03: kinsoku and wrapping | Width sweep of punctuation-adjacent nonbreaking math; on composed layouts no reported kinsoku or horizontal overflow | Exhaustive line-breaking optimality and all possible punctuation combinations |
| T04: tall formula | Fixed/adaptive occupancy comparison; adaptive has no measured line-box overlaps | True glyph-ink collision checks and user-selected minimum line rhythm |
| T05: layout ownership | Exactly one measured formula SVG, coordinates agree with its rendered DOM bounding rectangle; browser uses the compositor's break positions | Comparing with MathJax's automatic internal line-breaking mode |
| T06: insufficient area | Formula wider than column produces unsatisfied-width with withheld drawing and intact source | Finite-height truncation, whole-document scaling and complete T06b scenario |
| T07: semantic mapping | Formula IDs and source ranges retained; original source and TeX copy available | Selection across the SVG paragraph, assistive-technology reading and MathML |

## What is executed

- npm test executes test/collision-matrix.test.mjs alongside the original tests, using a deterministic FixedMeasurer to isolate layout behavior from platform fonts.
- The Chromium browser smoke test checks all fixture variants against MathJax's actual SVG dimensions. It checks the displayed formula bounding boxes against measured geometry in CSS pixels and tests that T06a withholds an over-wide formula without discarding the source.
- The original smoke checks still verify the initial multi-formula document, width-change behavior, malformed-input error state and recovery.

## What the result means

"Composed" means the **currently implemented policy and diagnostic checks** report a valid candidate. It does not imply that every Japanese or mathematical typographic convention has been implemented. In particular, [T02 outer spacing](math-boundary-spacing.md) has a selectable experimental implementation but no established publication-quality default; T06 finite-height behavior remains unimplemented.

A browser smoke pass measures the physical DOM boxes. It does not judge readability, punctuation optical alignment, ink overlaps, complete text accessibility, or visual quality on Windows/macOS. These require additional targeted tests and review. The selected Japanese fallback font is environment-dependent.

A result from the "Stone candidate" option is a comparison; a repair that moves a break is an intentional policy change and not an upstream replication failure.

## Recommended manual sweep

1. Select T02a then T02b at 480 px. Inspect the spaces outside the formula. Record your desired boundary-gap policy rather than assuming a universal spacing.
2. Select T03a and T03b. Use 1 px width steps near a change of line break. Compare the repair policy with the Stone candidate and inspect the constraints displayed for both.
3. Select T04. Compare adaptive and fixed line advance; enable baseline and frame guides and observe any overlap.
4. Select T06a. Reduce width until the preview is withheld, then widen again and verify full formula recovery.
5. Select T07. Confirm complete source/TeX copy, but do not assume that selecting rendered SVG text has the same semantics.
