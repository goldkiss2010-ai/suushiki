// Matrix for separating browser-Japanese line breaking from atomic inline
// break opportunities. Runs in Chromium against MathJax SVG already measured
// by the ordinary SUUSHIKI workbench. No claims of standards violations.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { collisionCases } from '../public/collision-cases.js';

const FIXTURES = ['t03b', 't03a'];
const VARIANTS = [
  'flat-text', 'inline-text', 'atomic-box', 'mathjax',
  'atomic-nowrap', 'mathjax-nowrap',
  'atomic-group-box', 'mathjax-group-box',
];
const POLICIES = ['auto', 'strict'];
const WIDTHS = [
  ...Array.from({ length: 76 }, (_, i) => 115 + i),
  ...Array.from({ length: 16 }, (_, i) => 220 + i),
];
const HIGHLIGHTS = [125, 130, 157, 160, 230];

export async function runCssIsolation(page) {
  const all = [], provenance = [];
  for (const fixture of FIXTURES) {
    await page.locator('#document-width').evaluate(el => {
      el.value = '480';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#document-example').selectOption(fixture);
    await page.waitForFunction(source => {
      const status = document.querySelector('#document-status');
      const raw = document.querySelector('#document-metrics').textContent;
      return status.dataset.state === 'ready' && raw &&
        JSON.parse(raw).source === source && JSON.parse(raw).settings.width === 480;
    }, collisionCases[fixture].source, { timeout: 30000 });

    const result = await page.evaluate(async ({ source, fixture, variants, policies, widths }) => {
      const { makeIsolationCase, measureIsolationCase } = await import('/css-isolation.js');
      const rec = JSON.parse(document.querySelector('#document-metrics').textContent);
      const boxes = new Map(rec.summary.mathItems.map(m => [m.id, {
        width: m.width, ascent: m.ascent, descent: m.descent,
      }]));
      const mathById = new Map([...document.querySelectorAll(
        '#document-native-output [data-native-math]')].map(el =>
        [el.dataset.nativeMath, el]));
      const roots = [];
      try {
        for (const variant of variants) for (const policy of policies) {
          const spec = makeIsolationCase({
            source, boxes, mathById, variant, lineBreak: policy,
            width: widths[0], fontSize: rec.settings.fontSize,
            family: rec.settings.family,
          });
          Object.assign(spec.root.style, {
            position: 'absolute', visibility: 'hidden', top: '0',
            left: '-4000px',
          });
          document.body.append(spec.root);
          roots.push({ ...spec, variant, policy });
        }
        const observations = [];
        for (const width of widths) for (const spec of roots) {
          spec.root.style.width = width + 'px';
          const measurement = measureIsolationCase(spec);
          observations.push({
            caseId: fixture, widthPx: width, variant: spec.variant,
            policy: spec.policy, status: measurement.status,
            sourceSubstituted: spec.substitute,
            lineStartOffsets: measurement.lines.map(l => l.first),
            violations: measurement.violations,
            overflow: measurement.overflow,
            softBreaks: measurement.breaks.filter(b => !b.hard).map(b => b.startOffset),
          });
        }
        return {
          source, fixture, observations, fontSize: rec.settings.fontSize,
          fontFamily: rec.settings.family,
          platform: navigator.userAgent,
          cssSupport: {
            strict: CSS.supports('line-break', 'strict'),
            autospace: CSS.supports('text-autospace', 'normal'),
          },
        };
      } finally {
        for (const spec of roots) spec.root.remove();
      }
    }, {
      source: collisionCases[fixture].source, fixture,
      variants: VARIANTS, policies: POLICIES, widths: WIDTHS,
    });
    provenance.push({
      fixture, source: result.source, fontSize: result.fontSize,
      fontFamily: result.fontFamily, platform: result.platform,
      cssSupport: result.cssSupport,
    });
    all.push(...result.observations);
  }

  const summary = [];
  for (const fixture of FIXTURES) for (const variant of VARIANTS) for (const policy of POLICIES) {
    const rows = all.filter(v => v.caseId === fixture && v.variant === variant && v.policy === policy);
    const valid = rows.filter(v => v.status === 'measured');
    summary.push({
      fixture, variant, policy,
      measured: valid.length,
      issueWidths: valid.filter(v => v.violations.length).map(v => v.widthPx),
      overflowWidths: valid.filter(v => v.overflow).map(v => v.widthPx),
      highlightExamples: rows.filter(v => HIGHLIGHTS.includes(v.widthPx)).map(v => ({
        widthPx: v.widthPx, status: v.status,
        violations: v.violations, overflow: v.overflow,
        lineStartOffsets: v.lineStartOffsets,
      })),
    });
  }
  assert.equal(all.length, FIXTURES.length * VARIANTS.length * POLICIES.length * WIDTHS.length);
  // The non-MathJax controls must remain measurable; status mismatches are
  // evidence to investigate rather than silently counted as no violations.
  assert.ok(summary.every(v => v.measured > WIDTHS.length / 2),
    'All controls should be measurable at a majority of widths');
  console.log('CSS_ISOLATION_SUMMARY_JSON=' + JSON.stringify(summary.map(r => ({
    fixture: r.fixture, variant: r.variant, policy: r.policy,
    measured: r.measured, issues: r.issueWidths.length,
    issueSample: r.issueWidths.slice(0, 12),
    overflows: r.overflowWidths.length,
  }))));
  await writeFile('artifacts/suushiki-css-isolation.json', JSON.stringify({
    schemaVersion: 1,
    note: 'Stone forbidden-edge character sets are observation probes, not a CSS/JLREQ correctness oracle. ' +
      'Substituted-text variants necessarily have a different formula source and metrics. ' +
      'Matched atomic-box controls use the same width/ascent/descent as the MathJax formula.',
    provenance, widths: WIDTHS, summary, observations: all,
  }, null, 2) + '\n');

  // Visual references at the two known boundary windows; the gallery does
  // not change the source or the renderer chosen in the workbench.
  for (const fixture of FIXTURES) {
    const width = fixture === 't03b' ? 125 : 157;
    await page.locator('#document-example').selectOption(fixture);
    await page.waitForFunction(source => {
      const status = document.querySelector('#document-status');
      const raw = document.querySelector('#document-metrics').textContent;
      return status.dataset.state === 'ready' && raw && JSON.parse(raw).source === source;
    }, collisionCases[fixture].source, { timeout: 30000 });
    await page.evaluate(async ({ width, variants, source }) => {
      const { makeIsolationCase, measureIsolationCase } = await import('/css-isolation.js');
      const rec = JSON.parse(document.querySelector('#document-metrics').textContent);
      const boxes = new Map(rec.summary.mathItems.map(m => [m.id, {
        width: m.width, ascent: m.ascent, descent: m.descent,
      }]));
      const mathById = new Map([...document.querySelectorAll(
        '#document-native-output [data-native-math]')].map(el =>
        [el.dataset.nativeMath, el]));
      document.querySelector('#css-isolation-gallery')?.remove();
      const gallery = document.createElement('div');
      gallery.id = 'css-isolation-gallery';
      Object.assign(gallery.style, {
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px', padding: '12px', background: '#fff',
        maxWidth: '850px',
      });
      for (const variant of variants) {
        const spec = makeIsolationCase({
          source, boxes, mathById, variant, lineBreak: 'strict',
          width, fontSize: rec.settings.fontSize, family: rec.settings.family,
        });
        const panel = document.createElement('div');
        Object.assign(panel.style, {
          padding: '8px', border: '1px solid #999',
          minHeight: '130px', overflow: 'visible',
        });
        const title = document.createElement('div');
        title.textContent = variant + ' / ' + width + 'px / line-break:strict';
        title.style.fontSize = '12px';
        panel.append(title, spec.root);
        gallery.append(panel);
      }
      document.body.append(gallery);
      for (const panel of gallery.children) {
        const root = panel.querySelector('.native-comparison-canvas');
        // makeIsolationCase uses the same element structure but no class;
        // identify by the variant data attribute.
        const probe = panel.querySelector('[data-variant]');
        const variant = probe.dataset.variant;
        const spec = makeIsolationCase({
          source, boxes, mathById, variant, lineBreak: 'strict',
          width, fontSize: rec.settings.fontSize, family: rec.settings.family,
        });
        spec.root.style.position = 'absolute';
        spec.root.style.left = '-4000px';
        document.body.append(spec.root);
        const diagnosis = measureIsolationCase(spec);
        spec.root.remove();
        const caption = document.createElement('div');
        caption.style.fontSize = '12px';
        caption.textContent = 'edge=' + diagnosis.violations.map(v =>
          v.edge + ':' + v.char).join(',') + ' / overflow=' + diagnosis.overflow;
        panel.prepend(caption);
      }
    }, { width, variants: VARIANTS, source: collisionCases[fixture].source });
    await page.locator('#css-isolation-gallery').screenshot({
      path: 'artifacts/suushiki-css-isolation-' + fixture + '-' + width + '.png',
    });
  }
  await page.evaluate(() => document.querySelector('#css-isolation-gallery')?.remove());
  return summary;
}
