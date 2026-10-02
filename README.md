# jev-judgmentwall

**Paste text, pick declared criteria, and watch real Jev request batches fill a shareable verdict wall.**

[![Tests](https://github.com/gbesse/jev-judgmentwall/actions/workflows/test.yml/badge.svg)](https://github.com/gbesse/jev-judgmentwall/actions/workflows/test.yml) [MIT](LICENSE) · Node.js 22+ · Zero runtime dependencies · Public alpha

The wall is honest: Jev is not a streaming endpoint. This tool splits criteria into bounded requests and displays each batch when that HTTP response actually returns. It never manufactures a typing delay.

## Try it in 30 seconds

```sh
git clone https://github.com/gbesse/jev-judgmentwall.git && cd jev-judgmentwall
npm run demo
node bin/jev-judgmentwall.mjs serve --fake
```

Open `http://127.0.0.1:8792`. Synthetic fixture probabilities are not measured Jev output.

## Call real Jev

```sh
export TYPESAFE_API_KEY=... # paid requests go to https://api.typesafe.ai/v1/systemone
node bin/jev-judgmentwall.mjs estimate copy.txt --pack landing-page
node bin/jev-judgmentwall.mjs run copy.txt --pack landing-page
```

Inputs may be files, stdin (`-`), or HTTP(S) URLs; fetched HTML has scripts and tags stripped. Packs are JSON and `validate pack.json` checks the same contract used at runtime. Runs are saved under `local-data/runs/` with pack/input fingerprints, raw answers, usage, model and cost estimate. The browser exports a PNG locally with canvas.

## How it decides

The shipped `generic`, `landing-page`, `resume`, and `pitch-narrative` packs expose every exact instruction and criterion. Independent questions sharing the same text are fan-out batched (eight by default), requests run at bounded concurrency, and values are displayed unchanged: `noul` probability, score normalized across its declared scale, or the winning choice's probability. Cost is `input_tokens × 0.042 / 1,000,000`; it is an estimate, not a bill.

As a library, import `validatePack`, `planBatches`, `estimateRun`, `runWall`, `createWallServer`, `createJevClient`, or `createFakeProvider` from `@gbesse/jev-judgmentwall`. See [the pack contract](docs/packs.md).

## Boundaries

- Text only: no image or PDF extraction. Bring extracted text yourself.
- This is a criterion dashboard, not an editor or calibrated quality benchmark. Defaults are illustrative.
- Long or irrelevant state, injected instructions, negations, counting, dates and arithmetic are known Jev weak spots. The client refuses oversized state; code owns batching and arithmetic.
- English works best. URL fetching does not execute JavaScript, follow redirects, or bypass access controls.
- The local server has no authentication; it binds to loopback. Do not expose it without your own TLS and access control.

## Shareable demo report

Run `npm run demo:report` to capture this repository’s bundled example as one JSON object with the project purpose, version and complete demo output. The command fails if the demo fails, so the report is useful when sharing a reproducible first look or reporting unexpected behavior. The bundled demo’s data and safety boundaries still apply.

## Validation

`npm run check`, `npm run typecheck`, `npm test`, and `npm run demo` run locally and in CI on Node 22 and 24. `scripts/live-smoke.mjs` is opt-in, uses synthetic input, and makes at most two paid requests.

## Related projects

[DecisionPacks](https://github.com/gbesse/decisionpacks) · [Autonomy Meter](https://github.com/gbesse/autonomy-meter) · [Question Forge](https://github.com/gbesse/question-forge) · [jev-rerank-server](https://github.com/gbesse/jev-rerank-server)

Independent project; not affiliated with TypeSafe AI. [TypeSafe API](https://docs.typesafe.ai/api) · [known model limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13)
