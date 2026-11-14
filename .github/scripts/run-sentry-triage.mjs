import { SentryTriage } from "./sentry-triage.mjs";

const phase = process.env.TRIAGE_PHASE;
if (!["collect", "bundle", "validate", "publish"].includes(phase)) {
  throw new Error("TRIAGE_PHASE must be collect, bundle, validate, or publish");
}

await new SentryTriage()[phase]();
