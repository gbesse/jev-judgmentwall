// Purpose: Hand-written TypeScript declarations for the public API.
export type Criterion = { id: string; label: string; type: 'noul'|'score'|'choice'; instructions: unknown; criteria?: unknown; group?: string };
export type Pack = { id: string; title: string; criteria: Criterion[] };
export function validatePack(pack: unknown): Pack;
export function loadPack(value: string): Promise<Pack>;
export function planBatches(text: string, pack: Pack, options?: { maxCriteria?: number; tokenBudget?: number }): Criterion[][];
export function estimateRun(text: string, pack: Pack, options?: object): { requests: number; estimatedInputTokens: number; estimatedCostUsd: number; batches: string[][] };
export function runWall(options: { text: string; pack: Pack; provider: Function; maxCriteria?: number; concurrency?: number; onBatch?: Function }): Promise<any>;
export function saveRun(run: any, directory?: string): Promise<string>;
export function loadRun(path: string): Promise<any>;
export function stripHtml(html: string): string;
export function fetchText(url: string, options?: object): Promise<string>;
export function createWallServer(options: { provider: Function; historyDirectory?: string; defaultPack?: string }): { listen(port: number, host?: string, callback?: Function): unknown; close(callback?: Function): unknown };
export function createJevClient(options?: object): Function;
export function createFakeProvider(fixtures: any, options?: object): Function;
export function estimateTokens(value: unknown): number;
export function estimateCostUsd(tokens: number): number;
