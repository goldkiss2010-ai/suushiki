# SUUSHIKI / 数式

**Japanese mathematical typesetting, built on existing layout engines.**

SUUSHIKI is an experimental project exploring how professional Japanese text composition can coexist with mathematical notation in a single horizontal layout.

The initial investigation uses [stone-engine.js](https://github.com/non-standardworld/stone_engine_js) for Japanese typography and [MathJax](https://github.com/mathjax/MathJax) for mathematics. Neither the final architecture nor the renderer is fixed.

SUUSHIKI aims to inherit Stone's design intent, extend Japanese paragraph composition to mathematics, and connect it to a math typesetting engine. Stone's current implementation is a reference for this work, not a compatibility requirement.

> Status: experimental one-formula integration. A general-purpose integrated typesetter is not yet available.

## Run the first experiment

Install Node.js 24 LTS, clone this repository, then run in its root:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/`. The page displays Stone text and six MathJax formulas separately, a measured placeholder box, and an actual selected formula inside a Japanese paragraph. It allows changes to width/font/size and box dimensions, compares adaptive and fixed line advance, repairs illegal boundary breaks using Stone’s own line-edge punctuation geometry, copies prose with inline LaTeX or formula TeX alone, and exports geometry as JSON. Stop the server with Ctrl+C. No build step is required. Run `npm test` for the adapter and boundary checks.

See [環境構築と実行手順 (Windows / PowerShell)](docs/getting-started.md), [standalone verification](docs/standalone-check.md), [placeholder integration](docs/inline-box-check.md), [actual formula integration](docs/inline-math-check.md), and [boundary constraint checks](docs/collision-check.md). One nonbreaking MathJax formula can participate in Japanese line breaking. Narrow punctuation/bracket cases search for a legal partition and report unmet constraints if none is found; a formula wider than the column preserves its source and reports insufficient width. See [prototype completion checks](docs/prototype-check.md) for the bounded repair and copy scope. The full seven-case collision suite remains to be evaluated.

## Why

MathJax can typeset mathematical expressions, while stone-engine.js explores fine-grained Japanese composition. The interesting question is not how to paste a formula beside a paragraph, but how to make both participate in one line-layout decision: dimensions, baseline, spacing, line breaking and alignment.

The project initially targets **horizontal Japanese prose with inline mathematics**. Vertical writing, full-page layout, publishing formats and interactive editing are out of scope for the first experiment.

## Design principles

- **Reuse existing engines.** Do not reimplement Japanese or mathematical typesetting unnecessarily.
- **Separate composition from rendering.** SVG is useful for inspection but not a mandatory output format.
- **Keep semantics.** Preserve source text and mathematical expressions rather than treating all formulas as opaque pictures.
- **Inherit Stone's design intent.** Carry forward fine-grained Japanese composition, responsive layout, inspectable geometry and efficient relayout. APIs, item types, line metrics and break handling may evolve to support mathematics.
- **Parameterize choices; investigate collisions.** Author and publication styles remain configurable. Evaluate competing constraints under the selected policy; record intentional departures from the upstream behavior.
- **Measure before modifying.** Investigate the actual APIs and limitations of both dependencies before forking.
- **Compare visually and mechanically.** Use reference HTML + MathJax alongside the experimental output.

## First milestone: one paragraph

Render a short Japanese paragraph containing a single inline formula, with a controlled font and width. Record:

1. How each engine measures its content.
2. How to connect a measured math item to paragraph composition, including any needed extension to Stone's item or line model.
3. How baselines and the mathematical axis can be aligned.
4. What happens when a formula approaches the end of a line.
5. Whether the same layout decisions can be represented independently of SVG.

A nonbreaking formula box is acceptable in the first prototype. Breaking *inside* mathematics is a later problem.

See [docs/architecture.md](docs/architecture.md), [docs/research-plan.md](docs/research-plan.md) and [examples/fixtures.md](examples/fixtures.md).

## Existing mathematical typesetting rules

The initial [research collection (日本語)](docs/math-typesetting/README.md) records 18 source entries, 39 rules and choices, and 32 comparison inputs.

It distinguishes engine algorithms, font metrics, Japanese composition requirements and publication conventions. Each source has an explicit verification status; the full 32-case comparison suite has not yet been run.

The investigation focuses on [seven collision patterns](docs/math-typesetting/decisions.md), with [seven targeted inputs](examples/math-conflicts.md). [Stone's design and constraints](docs/math-typesetting/stone-engine.md) are recorded against a fixed upstream commit. Style variants are parameter choices, not collision counts. Preliminary one-formula integration checks are linked above; the complete collision matrix remains untested.

The current direction is design inheritance with extension and connection. Exact upstream behavior, including constant line advance, is not an invariant of SUUSHIKI.

## Scope and output formats

Browser output is the first target. HTML, SVG or Canvas are rendering options, not architectural commitments. EPUB/Kindle reflow is a separate compatibility problem: arbitrary JavaScript-driven layout cannot be assumed to run inside an ebook reader.

## Dependencies and attribution

SUUSHIKI is an **independent, unofficial experiment**, not an official stone-engine.js extension.

- [stone-engine.js](https://github.com/non-standardworld/stone_engine_js) — npm 0.2.0, MIT. This harness uses its public layout, Canvas measurement and SVG APIs.
- [MathJax](https://github.com/mathjax/MathJax) — npm 4.1.3, Apache-2.0. This harness uses TeX-to-SVG conversion and browser geometry.
- MathJax New Computer Modern font — dependency 4.1.3, Apache-2.0; exact dependency versions and integrity hashes are recorded in `package-lock.json`.

Any copied or redistributed source, fonts, examples or bundled assets must retain the applicable notices. This repository does not currently vendor either engine; npm-installed packages retain their upstream notices.

## Contributing

The most useful early contributions are small reproducible layout cases, documentation of actual engine behavior, and reviews of Japanese spacing, punctuation, and mathematical baseline alignment.

## License

**Not yet selected.** Do not assume this repository is MIT-licensed merely because one or more upstream dependencies may use permissive licenses.

