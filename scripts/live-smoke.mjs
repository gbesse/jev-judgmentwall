// Purpose: Opt-in live check against api.typesafe.ai using one paid request with synthetic input; never run in CI.
import { createJevClient } from '../src/index.mjs';

if (!process.env.TYPESAFE_API_KEY) {
  console.error('live-smoke: TYPESAFE_API_KEY is not set; no request made.');
  process.exit(2);
}
try {
  const response = await createJevClient({ maxRetries: 1 })({
    state: 'A synthetic launch note says the release is ready for Tuesday.',
    questions: { ready: { type: 'noul', instructions: 'Does the note explicitly say the release is ready?' } },
  });
  console.log(JSON.stringify(response, null, 2));
} catch (error) {
  console.error(`live-smoke: failed: ${error.message}`);
  process.exit(1);
}
