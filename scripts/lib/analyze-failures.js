/**
 * scripts/lib/analyze-failures.js
 *
 * Rule-based failure analysis over the Playwright JSON report (reports/last-run.json).
 * Runs fully offline — the optional Jira/AI escalation lives in analyze-and-report.js.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ROOT } from './instructions.js';

export const DEFAULT_REPORT = path.join(ROOT, 'reports', 'last-run.json');

const RULES = [
  { category: 'locator-not-found', test: (error) => /waiting for (getByRole|locator|getByText)/i.test(error) && /Timeout/i.test(error) },
  { category: 'navigation-timeout', test: (error) => /navigating to|waitForURL|net::ERR|ECONNREFUSED/i.test(error) },
  { category: 'assertion-mismatch', test: (error) => /expect\(|Error: expect/i.test(error) },
  { category: 'action-timeout', test: (error) => /(click|fill|check|press|hover): Timeout/i.test(error) },
  { category: 'app-unreachable', test: (error) => /was not started|health|EADDRINUSE/i.test(error) },
];

export function categorize(errorText) {
  for (const rule of RULES) if (rule.test(errorText)) return rule.category;
  return 'unknown';
}

function walkSuite(suite, ancestors, out) {
  const titlePath = [...ancestors, suite.title].filter(Boolean);
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      for (const result of test.results ?? []) {
        if (result.status === 'passed' || result.status === 'skipped') continue;
        const errorText = (result.errors ?? []).map((error) => error.message ?? String(error)).join('\n');
        const idMatch = /TC-[A-Z0-9]+-\d+/.exec(spec.title ?? '');
        out.push({
          id: idMatch ? idMatch[0] : '',
          title: spec.title,
          project: test.projectName ?? '',
          file: spec.file ?? suite.file ?? '',
          line: spec.location?.line ?? null,
          status: result.status,
          attempts: (test.results ?? []).length,
          category: categorize(errorText),
          message: firstLine(errorText),
          snippet: errorText.split('\n').slice(0, 6).join('\n'),
          titlePath,
        });
      }
    }
  }
  for (const child of suite.suites ?? []) walkSuite(child, [...ancestors, suite.title], out);
}

function firstLine(text) {
  return (text.split('\n').find((line) => line.trim().length) ?? 'no error message').trim().slice(0, 200);
}

export function analyzeFailures({ reportPath = DEFAULT_REPORT } = {}) {
  if (!existsSync(reportPath)) {
    return { ok: false, reportPath, failures: [], stats: null, message: `No JSON report at ${reportPath}. Run \`npm test\` first.` };
  }

  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const failures = [];
  for (const suite of report.suites ?? []) walkSuite(suite, [], failures);

  const byCategory = failures.reduce((acc, failure) => {
    acc[failure.category] = (acc[failure.category] ?? 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    reportPath,
    stats: report.stats ?? null,
    totals: {
      expected: report.stats?.expected ?? 0,
      unexpected: report.stats?.unexpected ?? failures.length,
      flaky: report.stats?.flaky ?? 0,
      skipped: report.stats?.skipped ?? 0,
    },
    byCategory,
    failures,
  };
}
