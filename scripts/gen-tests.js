/**
 * scripts/gen-tests.js
 *
 * CLI — generate spec files for every feature instruction in
 * .context/instructions/features/.
 *
 *   node scripts/gen-tests.js                generate anything missing, reuse the rest
 *   node scripts/gen-tests.js --only admin-dashboard
 *   node scripts/gen-tests.js --force        rewrite existing specs (keeps .bak copies)
 *   node scripts/gen-tests.js --ai           refine with Anthropic (needs ANTHROPIC_API_KEY)
 *
 * The Page Objects each feature uses are read from the feature file's
 * "Pages Involved" / "Page Objects" section, so no hand-maintained feature map can
 * silently drop a feature. A maintained spec is recognised by its file name
 * anywhere under tests/, which keeps generation from creating duplicate suites.
 */
import 'dotenv/config';
import path from 'node:path';

import { listInstructionFiles, parseFeatureInstruction } from './lib/instructions.js';
import { generateTests } from './lib/generate-tests.js';

const relative = (target) => path.relative(process.cwd(), target);

const args = process.argv.slice(2);
const force = args.includes('--force');
const ai = args.includes('--ai');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

const files = only
  ? listInstructionFiles('features').filter((file) => file.name === only)
  : listInstructionFiles('features');

if (files.length === 0) {
  console.log(only ? `No feature instruction matched "${only}"` : 'No feature instruction files found in .context/instructions/features/');
  process.exit(only ? 1 : 0);
}

console.log(`\nGenerating specs for ${files.length} feature instruction(s)...`);
if (!force) console.log('Maintained specs are left untouched; pass --force to rewrite them (a .bak copy is kept).\n');

const summary = { generated: 0, reused: 0, failed: 0, scenarios: 0 };
const empty = [];

for (const file of files) {
  const feature = parseFeatureInstruction(file.path);
  if (feature.tests.length === 0) empty.push(file.name);

  try {
    const result = await generateTests({
      feature_name: file.name,
      pages_used: feature.pages.map((page) => page.className),
      source: 'local',
      force,
      ai,
    });

    if (result.status === 'reused') {
      console.log(`  = ${file.name}  (${result.tests} scenario(s), maintained spec: ${relative(result.file)})`);
      summary.reused += 1;
      continue;
    }
    if (result.status === 'skipped') {
      console.log(`  ! ${file.name}: ${result.reason}`);
      summary.failed += 1;
      continue;
    }
    console.log(`  + ${file.name}  (${relative(result.file)}${result.ai ? ', AI refined' : ''})`);
    if (result.missingPages?.length) console.log(`      unresolved Page Objects: ${result.missingPages.join(', ')}`);
    summary.generated += 1;
    summary.scenarios += result.tests;
  } catch (error) {
    console.error(`  x ${file.name}: ${error.message}`);
    summary.failed += 1;
  }
}

if (empty.length) {
  console.log('\nFeature files with no parseable "### TC-…" scenarios:');
  for (const name of empty) console.log(`  - ${name}`);
}

console.log(`\ngen:tests complete — ${summary.generated} generated, ${summary.reused} reused, ${summary.failed} failed.`);
process.exit(summary.failed > 0 ? 1 : 0);
