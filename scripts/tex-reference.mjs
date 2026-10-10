// Optional real-LaTeX benchmark. Requires lualatex + jlreq + amssymb.
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLatexLog, derivedReference } from './parse-tex-reference.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SOURCE = join(ROOT, 'benchmarks/latex/reference.tex');
const STORED = join(ROOT, 'public/latex-reference.json');

function run() {
  const directory = mkdtempSync(join(tmpdir(), 'suushiki-latex-'));
  try {
    const output = spawnSync('lualatex', [
      '-halt-on-error', '-interaction=nonstopmode',
      '-output-directory=' + directory, SOURCE,
    ], { encoding: 'utf8', cwd: ROOT, timeout: 90000 });
    if (output.error) throw new Error('lualatex unavailable: ' + output.error.message);
    if (output.status !== 0) throw new Error('lualatex exited with ' + output.status + '\n' + output.stdout.slice(-2500));
    const log = readFileSync(join(directory, 'reference.log'), 'utf8');
    const data = parseLatexLog(log);
    const version = spawnSync('lualatex', ['--version'], { encoding: 'utf8' });
    data.schemaVersion = 1;
    data.provenance = {
      tool: version.stdout.split('\n')[0],
      class: 'jlreq (actual class version may vary by TeX installation)',
      font: 'jlreq class defaults; not matched to browser font',
      texSource: 'benchmarks/latex/reference.tex',
      measured: new Date().toISOString().slice(0, 10),
      note: 'Machine-measured; numerical values depend on TeX distribution and font defaults.',
    };
    const baseline = JSON.parse(readFileSync(STORED, 'utf8'));
    const current = derivedReference(data);
    const expected = derivedReference(baseline);
    const detail = {
      current,
      stored: expected,
      parameters: data.parameters,
      paragraphs: data.paragraphs,
      hboxWidthDeltaPt: Object.fromEntries(Object.keys(baseline.hboxesPt)
        .map(key => [key, Number((data.hboxesPt[key] - baseline.hboxesPt[key]).toFixed(5))])),
    };
    console.log(JSON.stringify(detail, null, 2));
    // The sample isolates two ordinary Japanese/math boundaries.
    // Fail if the measured hbox total contradicts its own glue setting.
    if (Math.abs(current.observedTwoBoundaryGapPt - current.expectedTwoBoundaryGapPt) > 0.025)
      throw new Error('Measured T02a width is inconsistent with 2 x natural xkanjiskip.');
    if (process.argv.includes('--write')) {
      const record = { schemaVersion: data.schemaVersion, provenance: data.provenance,
        parameters: data.parameters, hboxesPt: data.hboxesPt, partsPt: data.partsPt,
        paragraphs: data.paragraphs };
      writeFileSync(STORED, JSON.stringify(record, null, 2) + '\n');
      console.log('Updated reference snapshot: public/latex-reference.json');
    }
    const drift = Math.max(...Object.values(detail.hboxWidthDeltaPt).map(Math.abs));
    if (drift > 0.01) {
      console.log('Reference widths differ; check font/TeX versions before interpreting the values.');
      if (process.argv.includes('--strict')) process.exitCode = 1;
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
