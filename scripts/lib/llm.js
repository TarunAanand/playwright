/**
 * scripts/lib/llm.js
 *
 * OPTIONAL AI refinement pass. It is deliberately opt-in and independent from
 * hosting/execution: `npm test` never needs a key, and generation without a key
 * produces the deterministic template output.
 *
 * Enabled when BOTH are true:
 *   • the caller passed `ai: true` (CLI flag --ai), and
 *   • ANTHROPIC_API_KEY is set and @anthropic-ai/sdk resolves.
 *
 * Any failure (no key, no package, network error, unusable reply) is reported and
 * the deterministic draft is kept — generation never half-writes AI output.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { ROOT } from './instructions.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

export async function maybeRefineWithAI({ kind, promptFile, context, draft, ai = false }) {
  if (!ai) return { applied: false, code: draft, reason: 'AI pass not requested (pass --ai)' };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { applied: false, code: draft, reason: 'ANTHROPIC_API_KEY not set — deterministic output kept' };
  }

  let Anthropic;
  try {
    ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
  } catch {
    return { applied: false, code: draft, reason: '@anthropic-ai/sdk is not installed — deterministic output kept' };
  }

  const promptPath = path.join(ROOT, promptFile);
  const systemPrompt = existsSync(promptPath)
    ? readFileSync(promptPath, 'utf8')
    : `You generate Playwright ${kind} files for a local QA demo portal. Return only JavaScript.`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Instruction source:\n${context}\n\nDeterministic draft to refine (keep the public API identical):\n${draft}\n\nReply with the complete file only, inside a single javascript code fence.` }],
    });
    const text = response.content?.map((block) => block.text ?? '').join('') ?? '';
    const fenced = /```(?:javascript|js)?\s*([\s\S]*?)```/.exec(text);
    const code = (fenced ? fenced[1] : text).trim();
    if (!code.includes('export') && !code.includes('test(')) {
      return { applied: false, code: draft, reason: 'AI reply did not contain a usable module — deterministic output kept' };
    }
    return { applied: true, code: `${code}\n`, reason: `refined by ${MODEL}` };
  } catch (error) {
    return { applied: false, code: draft, reason: `AI request failed (${error.message}) — deterministic output kept` };
  }
}
