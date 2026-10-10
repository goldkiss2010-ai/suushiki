# Initial layout fixtures

These are **test inputs**, not demonstrated output.

| ID | Japanese source (TeX between dollar delimiters) | Test |
| --- | --- | --- |
| A | 関数 $f(x)=x^2$ を考える。 | ordinary inline baseline and spaces |
| B | ここで、$a+b=c$。次の式を用いる。 | Japanese punctuation adjacent to math |
| C | 数列 $a_n$ は $n\\to\\infty$ で収束する。 | multiple math boxes in one line |
| D | この値は $\\frac{1}{2}$ である。 | tall formula and line height |
| E | 任意の $x\\in X$ に対して条件が成り立つ。 | formula near a line break |

For each fixture, capture: source text, font family, font size, container width, device pixel ratio, engine versions, resulting line breaks, measured baselines and a screenshot.

Run each at a wide and narrow paragraph width. Avoid using a screenshot alone as proof of correct typography; inspect measured layout data where available.
