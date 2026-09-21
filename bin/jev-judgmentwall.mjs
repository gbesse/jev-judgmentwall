#!/usr/bin/env node
// Purpose: CLI for validating packs, estimating runs, executing judgments, and serving the wall.
import { readFile } from 'node:fs/promises';
import { createFakeProvider, createJevClient, createWallServer, estimateRun, fetchText, loadPack, runWall, saveRun, validatePack } from '../src/index.mjs';
const [command, input, ...rest] = process.argv.slice(2);
const args = command === 'serve' ? [input, ...rest].filter(Boolean) : rest;
const flag = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
function synthetic({ questions }) { return { answers: Object.fromEntries(Object.entries(questions).map(([id, q], index) => [id, q.type === 'noul' ? { type: 'noul', noul: 0.35 + (index % 5) * 0.12 } : q.type === 'score' ? { type: 'score', score: Math.min(2, q.criteria.length - 1), probabilities: Object.fromEntries(q.criteria.map((_, i) => [String(i), i === 2 ? 0.7 : 0.1])), legend: Object.fromEntries(q.criteria.map((v, i) => [String(i), v])), confidence: 0.7 } : { type: 'choice', choice: Object.keys(q.criteria)[0], probabilities: Object.fromEntries(Object.keys(q.criteria).map((key, i) => [key, i ? 0.2 : 0.8])), confidence: 0.8 }])), usage: { input_tokens: 120, output_tokens: 0 } }; }
async function textInput(value) { if (/^https?:\/\//.test(value)) return fetchText(value); return value === '-' ? new Promise((resolve, reject) => { const chunks=[]; process.stdin.on('data', c=>chunks.push(c)); process.stdin.on('end',()=>resolve(Buffer.concat(chunks).toString())); process.stdin.on('error',reject); }) : readFile(value, 'utf8'); }
try {
  if (command === 'validate') { validatePack(JSON.parse(await readFile(input, 'utf8'))); console.log('Pack is valid.'); }
  else if (command === 'estimate') { const text = await textInput(input); console.log(JSON.stringify(estimateRun(text, await loadPack(flag('--pack', 'generic'))), null, 2)); }
  else if (command === 'run') { const text = await textInput(input); const provider = args.includes('--fake') ? createFakeProvider(synthetic) : createJevClient(); const run = await runWall({ text, pack: await loadPack(flag('--pack', 'generic')), provider, onBatch: event => console.error(`received batch ${event.index + 1}: ${event.criterionIds.join(', ')}`) }); console.log(JSON.stringify(run, null, 2)); console.error(`saved ${await saveRun(run)}`); }
  else if (command === 'serve') { const port = Number(flag('--port', '8792')); const provider = args.includes('--fake') ? createFakeProvider(synthetic) : createJevClient(); createWallServer({ provider }).listen(port, '127.0.0.1', () => console.log(`Judgment Wall: http://127.0.0.1:${port}`)); }
  else throw new Error('Usage: jev-judgmentwall validate pack.json | estimate input --pack generic | run input --pack generic [--fake] | serve [--port 8792] [--fake]');
} catch (error) { console.error(error.message); process.exitCode = 1; }
