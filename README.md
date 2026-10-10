# SUUSHIKI / 数式

**Japanese mathematical typesetting, built on existing layout engines.**

SUUSHIKI is an experimental project exploring how professional Japanese text composition can coexist with mathematical notation in a single horizontal layout.

The initial investigation uses [stone-engine.js](https://github.com/non-standardworld/stone_engine_js) for Japanese typography and [MathJax](https://github.com/mathjax/MathJax) for mathematics. Neither the final architecture nor the renderer is fixed.

> Status: research / design. No working integrated typesetter is claimed yet.

## Why

MathJax can typeset mathematical expressions, while stone-engine.js explores fine-grained Japanese composition. The interesting question is not how to paste a formula beside a paragraph, but how to make both participate in one line-layout decision: dimensions, baseline, spacing, line breaking and alignment.

The project initially targets **horizontal Japanese prose with inline mathematics**. Vertical writing, full-page layout, publishing formats and interactive editing are out of scope for the first experiment.

## Design principles

- **Reuse existing engines.** Do not reimplement Japanese or mathematical typesetting unnecessarily.
- **Separate composition from rendering.** SVG is useful for inspection but not a mandatory output format.
- **Keep semantics.** Preserve source text and mathematical expressions rather than treating all formulas as opaque pictures.
- **Parameterize choices; investigate collisions.** Author and publication styles remain configurable. Preserve Stone's Japanese composition rules and adjust the connection to math where constraints compete.
- **Measure before modifying.** Investigate the actual APIs and limitations of both dependencies before forking.
- **Compare visually and mechanically.** Use reference HTML + MathJax alongside the experimental output.

## First milestone: one paragraph

Render a short Japanese paragraph containing a single inline formula, with a controlled font and width. Record:

1. How each engine measures its content.
2. Whether stone-engine.js accepts an external inline box in its line-breaking model.
3. How baselines and the mathematical axis can be aligned.
4. What happens when a formula approaches the end of a line.
5. Whether the same layout decisions can be represented independently of SVG.

A nonbreaking formula box is acceptable in the first prototype. Breaking *inside* mathematics is a later problem.

See [docs/architecture.md](docs/architecture.md), [docs/research-plan.md](docs/research-plan.md) and [examples/fixtures.md](examples/fixtures.md).

## Existing mathematical typesetting rules

The initial [research collection (日本語)](docs/math-typesetting/README.md) records 18 source entries, 39 rules and choices, and 32 comparison inputs.

It distinguishes engine algorithms, font metrics, Japanese composition requirements and publication conventions. Each source has an explicit verification status; the comparison inputs have not yet been rendered or measured.

The next investigation focuses on [seven collision patterns](docs/math-typesetting/decisions.md), with [seven targeted inputs](examples/math-conflicts.md). [Stone's design and constraints](docs/math-typesetting/stone-engine.md) are recorded against a fixed upstream commit. Style variants are parameter choices, not collision counts. Integrated behavior remains untested.

## Scope and output formats

Browser output is the first target. HTML, SVG or Canvas are rendering options, not architectural commitments. EPUB/Kindle reflow is a separate compatibility problem: arbitrary JavaScript-driven layout cannot be assumed to run inside an ebook reader.

## Dependencies and attribution

SUUSHIKI is an **independent, unofficial experiment**, not an official stone-engine.js extension.

- [stone-engine.js](https://github.com/non-standardworld/stone_engine_js) — inspect its current license, API and transitive requirements before integration.
- [MathJax](https://github.com/mathjax/MathJax) — inspect its current license and output/measurement APIs before integration.

Any copied or redistributed source, fonts, examples or bundled assets must retain the applicable notices. This repository does not currently vendor either engine.

## Contributing

The most useful early contributions are small reproducible layout cases, documentation of actual engine behavior, and reviews of Japanese spacing, punctuation, and mathematical baseline alignment.

## License

**Not yet selected.** Do not assume this repository is MIT-licensed merely because one or more upstream dependencies may use permissive licenses.

