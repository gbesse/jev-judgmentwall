// Purpose: Public API for pack validation, honest batching, progressive evaluation, history, and the local server.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateCostUsd, estimateTokens } from './jev-client.mjs';

export { createFakeProvider, createJevClient, estimateCostUsd, estimateTokens } from './jev-client.mjs';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TYPES = new Set(['noul', 'score', 'choice']);

export function validatePack(pack) {
  if (!pack || typeof pack !== 'object') throw new TypeError('pack must be an object');
  if (!pack.id || !pack.title || !Array.isArray(pack.criteria) || pack.criteria.length === 0) throw new TypeError('pack requires id, title and non-empty criteria');
  const ids = new Set();
  for (const item of pack.criteria) {
    if (!item.id || ids.has(item.id)) throw new TypeError(`criterion id must be unique: ${item.id ?? 'missing'}`);
    ids.add(item.id);
    if (!item.label || !TYPES.has(item.type) || !item.instructions) throw new TypeError(`criterion ${item.id}: label, valid type and instructions are required`);
    if (item.type === 'score' && (!Array.isArray(item.criteria) || item.criteria.length < 2 || item.criteria.length > 10)) throw new TypeError(`criterion ${item.id}: score criteria require 2 to 10 levels`);
    if (item.type === 'choice' && (!item.criteria || Array.isArray(item.criteria) || Object.keys(item.criteria).length < 1 || Object.keys(item.criteria).length > 255)) throw new TypeError(`criterion ${item.id}: choice criteria require 1 to 255 options`);
  }
  return pack;
}

export async function loadPack(value) {
  const path = value.includes('/') || value.endsWith('.json') ? value : join(ROOT, 'packs', `${value}.json`);
  return validatePack(JSON.parse(await readFile(path, 'utf8')));
}

function asQuestion(item) { return { type: item.type, instructions: item.instructions, ...(item.criteria === undefined ? {} : { criteria: item.criteria }) }; }

export function planBatches(text, pack, { maxCriteria = 8, tokenBudget = 24_000 } = {}) {
  validatePack(pack);
  const stateTokens = estimateTokens(text);
  if (stateTokens > tokenBudget) throw new RangeError(`input estimate of ${stateTokens} tokens exceeds budget ${tokenBudget}`);
  const batches = [];
  let batch = [];
  for (const criterion of pack.criteria) {
    const own = estimateTokens({ state: text, questions: { [criterion.id]: asQuestion(criterion) } });
    if (own > tokenBudget) throw new RangeError(`criterion ${criterion.id} alone exceeds token budget ${tokenBudget}`);
    const trial = [...batch, criterion];
    const questions = Object.fromEntries(trial.map(item => [item.id, asQuestion(item)]));
    if (batch.length && (trial.length > maxCriteria || estimateTokens({ state: text, questions }) > tokenBudget)) {
      batches.push(batch); batch = [criterion];
    } else batch = trial;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export function estimateRun(text, pack, options) {
  const batches = planBatches(text, pack, options);
  const tokens = batches.reduce((sum, batch) => sum + estimateTokens({ state: text, questions: Object.fromEntries(batch.map(item => [item.id, asQuestion(item)])) }), 0);
  return { requests: batches.length, estimatedInputTokens: tokens, estimatedCostUsd: estimateCostUsd(tokens), batches: batches.map(items => items.map(item => item.id)) };
}

async function mapConcurrent(items, limit, worker) {
  const pending = [...items];
  await Promise.all(Array.from({ length: Math.min(limit, pending.length) }, async () => {
    while (pending.length) await worker(pending.shift());
  }));
}

export async function runWall({ text, pack, provider, maxCriteria = 8, concurrency = 6, onBatch = () => {} }) {
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('text must be non-empty');
  if (typeof provider !== 'function') throw new TypeError('provider must be a function');
  const batches = planBatches(text, pack, { maxCriteria });
  const arrived = [];
  await mapConcurrent(batches.map((items, index) => ({ items, index })), concurrency, async ({ items, index }) => {
    const questions = Object.fromEntries(items.map(item => [item.id, asQuestion(item)]));
    const response = await provider({ state: text, questions });
    const event = { index, criterionIds: items.map(item => item.id), answers: response.answers, usage: response.usage, model: response.model };
    arrived.push(event);
    await onBatch(event);
  });
  const usage = arrived.reduce((sum, item) => sum + item.usage.input_tokens, 0);
  return { id: randomUUID(), createdAt: new Date().toISOString(), packId: pack.id, packFingerprint: createHash('sha256').update(JSON.stringify(pack)).digest('hex'), inputHash: createHash('sha256').update(text).digest('hex'), sourceSnippet: text.slice(0, 180), batches: arrived, model: arrived[0]?.model ?? 'jev-1.13.0', usage: { input_tokens: usage, estimated_cost_usd: estimateCostUsd(usage) } };
}

export async function saveRun(run, directory = join(process.cwd(), 'local-data', 'runs')) {
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${run.id}.json`);
  await writeFile(path, `${JSON.stringify(run, null, 2)}\n`, { mode: 0o600 });
  return path;
}

export async function loadRun(path) { return JSON.parse(await readFile(path, 'utf8')); }

export function stripHtml(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

export async function fetchText(url, { timeoutMs = 10_000, fetchImpl = globalThis.fetch } = {}) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new TypeError('URL must use http or https');
  const response = await fetchImpl(parsed, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'text/html,text/plain' } });
  if (!response.ok) throw new Error(`source URL returned HTTP ${response.status}`);
  return stripHtml(await response.text());
}

function json(res, status, body) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
async function readBody(req, max = 1_000_000) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > max) throw new Error('request body too large'); chunks.push(chunk); } return JSON.parse(Buffer.concat(chunks).toString('utf8')); }

export function createWallServer({ provider, historyDirectory, defaultPack = 'generic' } = {}) {
  if (typeof provider !== 'function') throw new TypeError('provider is required');
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && ['/', '/app.js', '/style.css'].includes(url.pathname)) {
        const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const body = await readFile(join(ROOT, 'web', file));
        const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
        res.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' }); return res.end(body);
      }
      if (req.method === 'POST' && url.pathname === '/api/run') {
        const body = await readBody(req); const pack = await loadPack(body.pack ?? defaultPack);
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
        const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        const run = await runWall({ text: body.text, pack, provider, onBatch: event => send('batch', event) });
        await saveRun(run, historyDirectory); send('done', run); return res.end();
      }
      json(res, 404, { error: 'not_found' });
    } catch (error) { if (!res.headersSent) json(res, 400, { error: error.message }); else { res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`); res.end(); } }
  });
}
