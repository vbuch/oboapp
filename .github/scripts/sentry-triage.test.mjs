import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { allowedPatchPath, redact, REPOSITORY, REPORT_MARKER, run, SentryTriage, sourceFromEvent, validateReport } from "./sentry-triage.mjs";

function fixture() {
  return {
    evidence: { incidents: [{ id: "123", investigate: true, cloud: { status: "failed" } }] },
    report: {
      summary: "One source failed.",
      findings: [{ incidentId: "123", classification: "actionable", diagnosis: "The page changed.", nextSteps: "Update discovery." }],
      fix: { propose: false, title: "", body: "", incidentIds: [] },
    },
  };
}

function temporaryDirectory(t) {
  const directory = mkdtempSync(join(tmpdir(), "sentry-triage-"));
  t.after(() => {
    assert.ok(resolve(directory).startsWith(join(resolve(tmpdir()), "sentry-triage-")));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

test("Sentry pagination follows the next cursor and retains environment filters", async () => {
  const calls = [];
  const triage = new SentryTriage();
  triage.requestJson = async (url) => {
    calls.push(url);
    return calls.length === 1
      ? { data: [{ id: "1" }], headers: new Headers({ Link: 'rel="next"; results="true"; cursor="page-2"' }) }
      : { data: [{ id: "2" }], headers: new Headers() };
  };
  assert.deepEqual(await triage.pagedSentry("projects/oboapp/ingest/issues/", { environment: "production" }, "secret"), [{ id: "1" }, { id: "2" }]);
  assert.equal(new URL(calls[1]).searchParams.get("cursor"), "page-2");
  assert.equal(new URL(calls[1]).searchParams.get("environment"), "production");
});

test("pagination limits reject incomplete evidence", async () => {
  const triage = new SentryTriage();
  triage.requestJson = async () => {
    return { data: [{ id: "1" }], headers: new Headers({ Link: 'rel="next"; results="true"; cursor="more"' }) };
  };
  await assert.rejects(triage.pagedSentry("projects/oboapp/ingest/issues/", {}, "secret"), /incomplete/);
});

test("collection uses supported Sentry periods and an ISO search time", async (t) => {
  const directory = temporaryDirectory(t);
  const triage = new SentryTriage({
    output: directory,
    env: { SENTRY_TRIAGE_TOKEN: "secret", GITHUB_OUTPUT: join(directory, "outputs") },
    now: () => {
      return new Date("2026-11-14T09:00:00Z");
    },
  });
  const calls = [];
  triage.pagedSentry = async (path, params) => {
    calls.push(params);
    return [];
  };
  triage.github = async () => {
    return [];
  };
  await triage.collect();
  for (const params of calls) {
    assert.ok(["", "24h", "14d"].includes(params.statsPeriod));
    assert.match(params.query, /^lastSeen:>=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  }
  assert.equal(JSON.parse(readFileSync(join(directory, "evidence.json"))).since, "2026-11-13T03:00:00Z");
  assert.equal(readFileSync(join(directory, "outputs"), "utf8"), "has_work=false\n");
});

test("source identity survives the Crawler to Source log rename", () => {
  for (const prefix of ["Crawler", "Source"]) {
    assert.equal(sourceFromEvent(`${prefix} lozenets-sofia-bg failed: fetch failed`, {}), "lozenets-sofia-bg");
  }
});

test("unknown recovery cannot be reported as success", () => {
  const { evidence, report } = fixture();
  report.findings[0].classification = "recovered";
  for (const status of ["unavailable", "unknown", "pending", "failed"]) {
    evidence.incidents[0].cloud.status = status;
    assert.throws(() => {
      validateReport(report, evidence);
    }, /Recovery requires/);
  }
  evidence.incidents[0].cloud.status = "recovered";
  validateReport(report, evidence);
});

test("externally owned incidents cannot be investigated or fixed", () => {
  const { evidence, report } = fixture();
  evidence.incidents[0].investigate = false;
  assert.throws(() => {
    validateReport(report, evidence);
  }, /externally owned/);
  report.findings[0].classification = "known";
  validateReport(report, evidence);
  report.fix = { propose: true, title: "Change", body: "Details", incidentIds: ["123"] };
  assert.throws(() => {
    validateReport(report, evidence);
  }, /externally owned/);
});

test("missing, duplicate, and fabricated findings are rejected", () => {
  const { evidence, report } = fixture();
  for (const findings of [[], [...report.findings, ...report.findings], [{ ...report.findings[0], incidentId: "999" }]]) {
    assert.throws(() => {
      validateReport({ ...report, findings }, evidence);
    });
  }
});

test("a recovered incident cannot justify a patch", () => {
  const { evidence, report } = fixture();
  evidence.incidents[0].cloud.status = "recovered";
  report.findings[0].classification = "recovered";
  report.fix = { propose: true, title: "Change", body: "Details", incidentIds: ["123"] };
  assert.throws(() => {
    validateReport(report, evidence);
  }, /actionable/);
});

test("protected paths and Mladost changes are rejected", () => {
  for (const path of [".github/workflows/deploy.yml", "AGENTS.md", "web/.env.local", "ingest/terraform/main.tf",
    "../web/lib/api.ts", "web/lib/../secret", "web\\lib\\api.ts", "/web/lib/api.ts",
    "web//lib/api.ts", "web/lib/.env", "ingest/crawlers/mladost-bg/index.ts"]) {
    assert.equal(allowedPatchPath(path), false, path);
  }
  assert.equal(allowedPatchPath("ingest/crawlers/lozenets-sofia-bg/index.contract.test.ts"), true);
  assert.equal(allowedPatchPath("web/lib/error-reporting.ts"), true);
});

test("redaction removes identity and URL credentials", () => {
  const result = redact({
    email: "owner@example.com", ip_address: "192.0.2.1",
    message: "owner@example.com from 192.0.2.1 https://user:pass@example.com/feed?api_key=secret",
  });
  assert.equal(Object.hasOwn(result, "email"), false);
  assert.equal(Object.hasOwn(result, "ip_address"), false);
  for (const secret of ["owner@example.com", "192.0.2.1", "user:pass", "=secret"]) {
    assert.equal(result.message.includes(secret), false);
  }
});

test("API credentials cannot be sent to another origin or redirected", async () => {
  let calls = 0;
  const triage = new SentryTriage({
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(options.redirect, "manual");
      return new Response(null, { status: 302, headers: { Location: "https://example.com" } });
    },
  });
  for (const url of ["https://example.com/api", "http://sentry.io/api", "https://sentry.io:444/api", "https://user:pass@sentry.io/api"]) {
    await assert.rejects(triage.requestJson(url, "secret"), /origin/);
  }
  assert.equal(calls, 0);
  await assert.rejects(triage.requestJson("https://sentry.io/api", "secret"), /redirects/);
  assert.equal(calls, 1);
});

test("transient reads retry with backoff, while writes are never repeated", async () => {
  const sleeps = [];
  let calls = 0;
  const triage = new SentryTriage({
    sleep: async (duration) => {
      sleeps.push(duration);
    },
    fetchImpl: async () => {
      calls++;
      return calls < 3 ? new Response("unavailable", { status: 503 }) : Response.json({ ok: true });
    },
  });
  assert.deepEqual((await triage.requestJson("https://sentry.io/api", "secret")).data, { ok: true });
  assert.deepEqual(sleeps, [1000, 2000]);
  calls = 0;
  await assert.rejects(triage.requestJson("https://api.github.com/repos/example", "secret", "POST", {}), /HTTP 503/);
  assert.equal(calls, 1);
});

test("recovery is correlated to the failing execution", () => {
  const calls = [];
  const entries = [
    { severity: "ERROR", timestamp: "2026-11-14T09:01:00Z", jsonPayload: { source: "lozenets-sofia-bg" }, labels: { "run.googleapis.com/execution_name": "another-run" } },
    { severity: "ERROR", timestamp: "2026-11-14T08:01:00Z", jsonPayload: { source: "lozenets-sofia-bg" }, labels: { "run.googleapis.com/execution_name": "crawl-lozenets-original" } },
  ];
  const triage = new SentryTriage({
    env: { TRIAGE_CLOUD_LOGS: "true", GCP_PROJECT_ID: "example" },
    runCommand: (...args) => {
      calls.push(args);
      return JSON.stringify(calls.length === 1 ? entries : {
        status: { conditions: [{ type: "Completed", status: "True" }], retriedCount: 1 },
      });
    },
  });
  const result = triage.cloudEvidence("lozenets-sofia-bg", "2026-11-14T08:01:00Z", "2026-11-13T00:00:00Z");
  assert.equal(result.status, "recovered");
  assert.ok(calls[1].includes("crawl-lozenets-original"));
});

test("bundle and validation preserve a new regression test", (t) => {
  const directory = temporaryDirectory(t);
  const checkout = join(directory, "repo");
  mkdirSync(checkout);
  const originalCwd = process.cwd();
  const { evidence, report } = fixture();
  report.fix = { propose: true, title: "Fix", body: "Details", incidentIds: ["123"] };
  try {
    process.chdir(checkout);
    run("git", "init", "-q");
    run("git", "config", "core.autocrlf", "false");
    mkdirSync("web/lib", { recursive: true });
    writeFileSync("web/lib/example.ts", "export const value = 1;\n");
    run("git", "add", ".");
    run("git", "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "Base");
    const regression = "web/lib/example.test.ts";
    writeFileSync(regression, "// New regression\n");
    const triage = new SentryTriage({ output: join(directory, "artifacts"), env: { GITHUB_OUTPUT: join(directory, "outputs") } });
    triage.bundle();
    assert.match(readFileSync(join(triage.output, "fix.patch"), "utf8"), /example\.test\.ts/);
    unlinkSync(regression);
    run("git", "reset", "--quiet", "HEAD");
    triage.writeJson(join(triage.output, "report.json"), report);
    triage.writeJson(join(triage.output, "evidence.json"), evidence);
    triage.validate();
    assert.equal(readFileSync(regression, "utf8"), "// New regression\n");
  } finally {
    process.chdir(originalCwd);
  }
});

test("an existing fix PR is reused without modifying its branch", async (t) => {
  const directory = temporaryDirectory(t);
  const { evidence, report } = fixture();
  report.fix = { propose: true, title: "Fix", body: "Details", incidentIds: ["123"] };
  const key = createHash("sha256").update("123").digest("hex").slice(0, 12);
  const responses = [
    [{ html_url: `https://github.com/${REPOSITORY}/pull/999`, body: `<!-- sentry-fix:${key} -->` }],
    { items: [{ number: 10, body: REPORT_MARKER }] },
    { html_url: "report" },
  ];
  const calls = [];
  const triage = new SentryTriage({
    output: directory,
    env: { GITHUB_REPOSITORY: REPOSITORY },
    runCommand: () => {
      assert.fail("Existing PR branches must not be changed");
    },
  });
  triage.writeJson(join(directory, "report.json"), report);
  triage.writeJson(join(directory, "evidence.json"), evidence);
  triage.github = async (...args) => {
    calls.push(args);
    return responses.shift();
  };
  triage.renderReport = () => {
    return "Updated report";
  };
  await triage.publish();
  assert.deepEqual(calls.at(-1), [`repos/${REPOSITORY}/issues/10`, "PATCH", { body: "Updated report" }]);
});
