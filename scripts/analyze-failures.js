#!/usr/bin/env node
/**
 * scripts/analyze-failures.js
 *
 * Summarise the last Playwright run from reports/last-run.json and group failures
 * by likely root cause. Fully offline; no API key required.
 *
 *   node scripts/analyze-failures.js
 *   node scripts/analyze-failures.js --json          machine-readable output
 *   node scripts/analyze-failures.js --report path   analyse a different JSON report
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { analyzeFailures, DEFAULT_REPORT } from './lib/analyze-failures.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const reportPath = args.includes('--report') ? args[args.indexOf('--report') + 1] : DEFAULT_REPORT;

const analysis = analyzeFailures({ reportPath });

if (!analysis.ok) {
  console.error(analysis.message);
  process.exit(1);
}

const outDir = path.join(process.cwd(), 'reports', 'ai-analysis');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'failures.json'), `${JSON.stringify(analysis, null, 2)}\n`);

if (asJson) {
  console.log(JSON.stringify(analysis, null, 2));
  process.exit(analysis.failures.length ? 1 : 0);
}

console.log(`Report: ${path.relative(process.cwd(), reportPath)}`);
console.log(`Totals: ${analysis.totals.expected} passed, ${analysis.totals.unexpected} failed, ${analysis.totals.flaky} flaky, ${analysis.totals.skipped} skipped`);

if (analysis.failures.length === 0) {
  console.log('\nNo failures to analyse. Detail written to reports/ai-analysis/failures.json');
  process.exit(0);
}

console.log('\nFailures by likely root cause:');
for (const [category, count] of Object.entries(analysis.byCategory).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(3)}  ${category}`);
}

console.log('\nDetails:');
for (const failure of analysis.failures) {
  console.log(`  ${failure.id || '(no id)'}  ${failure.title}`);
  console.log(`      ${failure.category}: ${failure.message}`);
  console.log(`      ${failure.file}${failure.line ? `:${failure.line}` : ''}`);
}

console.log(`\nWrote ${path.join('reports', 'ai-analysis', 'failures.json')}`);
process.exit(1);
