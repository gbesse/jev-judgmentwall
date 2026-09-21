// Purpose: Compile-time exercise for the package's public TypeScript declarations.
import { estimateRun, loadPack, planBatches, validatePack } from '@gbesse/jev-judgmentwall';
const pack = validatePack({ id: 'x', title: 'X', criteria: [{ id: 'a', label: 'A', type: 'noul', instructions: 'Is it A?' }] });
planBatches('text', pack); estimateRun('text', pack); void loadPack('generic');
