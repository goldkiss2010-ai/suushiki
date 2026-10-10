// Use the already-running document workbench and its real measured MathJax
// boxes. Reflow native HTML + Stone + SUUSHIKI at EVERY integer CSS px,
// without repeatedly invoking MathJax or changing the user's workbench input.
// No fictitious quality score: the output contains actual break offsets.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { collisionCases } from '../public/collision-cases.js';

const FIXTURES = ['t03a', 't03b', 't02c'];
const FIRST_WIDTH = 90, LAST_WIDTH = 260;
const modes = ['plain', 'modern'];

export async function runLineEdgeSweep(page) {
  const observations = [];
  for (const key of FIXTURES) {
    await page.locator('#document-width').evaluate(input => {
      input.value = '720';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#document-example').selectOption(key);
    await page.waitForFunction(({ source }) => {
      const element = document.getElementById('document-status');
      if (element?.dataset.state !== 'ready') return false;
      const raw = document.getElementById('document-metrics').textContent;
      if (!raw) return false;
      const record = JSON.parse(raw);
      return record.source === source && record.settings.width === 720 &&
        record.summary.mathItems?.length > 0;
    }, { source: collisionCases[key].source }, { timeout: 30000 });

    const result = await page.evaluate(async ({ key, first, last, modes }) => {
      const [{ layoutDocument }, { parseDocument }, { inspectStoneLineEdges,
        inspectNativeLineEdges }, { getSharedCanvasMeasurer }] = await Promise.all([
        import('/document-layout.js'), import('/document-source.js'),
        import('/line-edge-analysis.js'), import('/vendor/stone/index.js'),
      ]);
      const record = JSON.parse(document.getElementById('document-metrics').textContent);
      const source = record.source, items = parseDocument(source);
      const boxes = new Map(record.summary.mathItems.map(m => [m.id, {
        width: m.width, ascent: m.ascent, descent: m.descent,
      }]));
      const canvas = document.querySelector('#document-native-output .native-comparison-canvas');
      if (!canvas) throw new Error('Missing native HTML control');
      const measurer = getSharedCanvasMeasurer();
      const config = record.settings;
      const options = {
        fontSize: config.fontSize, lineHeightScale: 1.6,
        punctuationMode: 'stone', kinsoku: true,
        fonts: {
          japanese: { family: config.family },
          latin: { family: config.family },
        },
      };
      const cases = [];
      const initialWidth = canvas.style.width;
      const initialAuto = canvas.style.textAutospace;
      const initialTrim = canvas.style.textSpacingTrim;
      try {
        for (const mode of modes) {
          canvas.style.textAutospace = mode === 'modern' ? 'normal' : 'no-autospace';
          canvas.style.textSpacingTrim = mode === 'modern' ? 'trim-start' : 'space-all';
          for (let width = first; width <= last; width++) {
            canvas.style.width = width + 'px';
            const native = inspectNativeLineEdges(canvas, items, boxes);
            const stone = inspectStoneLineEdges(layoutDocument({
              items, boxes, width, options, measurer,
              boundaryPolicy: 'stone', policy: 'fixed', wordPolicy: 'break',
              boundarySpacing: 'none',
            }), items);
            const suushiki = inspectStoneLineEdges(layoutDocument({
              items, boxes, width, options, measurer,
              boundaryPolicy: 'repair', policy: 'adaptive',
              wordPolicy: 'preserve', boundarySpacing: 'none',
            }), items);
            const brief = report => ({
              status: report.status,
              lineStarts: report.lines.map(l => l.first),
              violations: report.violations,
              breaks: report.breaks.filter(b => !b.hard).map(b => b.startOffset),
            });
            cases.push({
              caseId: key, widthPx: width, mode,
              native: brief(native), stone: brief(stone), suushiki: brief(suushiki),
            });
          }
        }
      } finally {
        canvas.style.width = initialWidth;
        canvas.style.textAutospace = initialAuto;
        canvas.style.textSpacingTrim = initialTrim;
      }
      return { key, source, cases, fontSize: config.fontSize, family: config.family,
        support: {
          textAutospace: CSS.supports('text-autospace', 'normal'),
          textSpacingTrim: CSS.supports('text-spacing-trim', 'trim-start'),
        },
      };
    }, { key, first: FIRST_WIDTH, last: LAST_WIDTH, modes });
    assert.equal(result.cases.length, (LAST_WIDTH - FIRST_WIDTH + 1) * modes.length);
    observations.push(result);
  }

  const all = observations.flatMap(result => result.cases);
  const summary = {
    widthsPerMode: LAST_WIDTH - FIRST_WIDTH + 1,
    configurations: all.length,
    byFixtureAndMode: [],
  };
  for (const key of FIXTURES) for (const mode of modes) {
    const selected = all.filter(row => row.caseId === key && row.mode === mode);
    const comparable = selected.filter(row =>
      row.native.status === 'measured' && row.stone.status === 'composed' &&
      row.suushiki.status === 'composed');
    const nativeIssues = selected.filter(row => row.native.violations.length > 0);
    const stoneIssues = selected.filter(row => row.stone.violations.length > 0);
    const suushikiIssues = selected.filter(row => row.suushiki.violations.length > 0);
    const breaksDiffer = comparable.filter(row => JSON.stringify(row.native.breaks) !==
      JSON.stringify(row.suushiki.breaks));
    const stoneRepair = comparable.filter(row => JSON.stringify(row.stone.breaks) !==
      JSON.stringify(row.suushiki.breaks));
    summary.byFixtureAndMode.push({
      caseId: key, mode, comparableWidths: comparable.length,
      nativeMeasuredWidths: selected.filter(row => row.native.status === 'measured').length,
      nativeProbeIssueWidths: nativeIssues.map(row => row.widthPx),
      stoneProbeIssueWidths: stoneIssues.map(row => row.widthPx),
      suushikiProbeIssueWidths: suushikiIssues.map(row => row.widthPx),
      browserVsSuushikiBreakDifferenceWidths: breaksDiffer.map(row => row.widthPx),
      stoneVsSuushikiBreakDifferenceWidths: stoneRepair.map(row => row.widthPx),
      examples: [...nativeIssues, ...stoneRepair, ...breaksDiffer].filter((row, i, a) =>
        a.findIndex(r => r.widthPx === row.widthPx && r.mode === row.mode) === i)
        .slice(0, 4),
    });
  }
  const exported = {
    schemaVersion: 1, measuringSystem: 'Chromium / DOM Range, math baseline',
    note: 'Shared Stone kinsoku probe classifications do not establish JLREQ compliance. ' +
      'Text line offsets and complete formula boxes only. Uncomposed widths are not comparable.',
    provenance: observations.map(({ key, source, family, fontSize, support }) =>
      ({ key, source, family, fontSize, support })),
    summary, observations: all,
  };
  const path = 'artifacts/suushiki-line-edge-sweep.json';
  await writeFile(path, JSON.stringify(exported, null, 2) + '\n');
  console.log('EDGE_SWEEP_SUMMARY_JSON=' + JSON.stringify(summary));
  console.log('Detailed 1px sweep saved at ' + path);
  assert.equal(all.length, 3 * 2 * (LAST_WIDTH - FIRST_WIDTH + 1));
  return summary;
}
