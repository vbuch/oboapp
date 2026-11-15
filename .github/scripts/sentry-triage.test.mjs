import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { redact, REPOSITORY, REPORT_MARKER, SentryTriage, sourceFromEvent, validateReport } from "./sentry-triage.mjs";

function fixture() {
  return {
    evidence: {
      generatedAt: "2026-11-15T12:00:00Z",
      incidents: [{
        id: "123", shortId: "INGEST-123", url: "https://sentry.io/issues/123/", investigate: true,
        cloud: { status: "failed" }, relatedIssues: [{
          title: "Existing source investigation", url: "https://github.com/oboapp/oboapp/issues/687", state: "open",
        }],
      }],
    },
    report: {
      summary: "One source failed.",
      findings: [{ incidentId: "123", classification: "actionable", diagnosis: "The page changed.", nextSteps: "Update discovery." }],
      followUps: [],
    },
  };
}

function followUp(overrides = {}) {
  return {
    key: "repair-source-discovery",
    title: "Repair source discovery",
    body: "## Evidence\n\nThe documented feed changed.\n\n## Implementation\n\nUpdate discovery and add regression coverage.",
    incidentIds: ["123"],
    ...overrides,
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

test("externally owned incidents stay known and cannot receive implementation follow-ups", () => {
  const { evidence, report } = fixture();
  evidence.incidents[0].investigate = false;
  assert.throws(() => {
    validateReport(report, evidence);
  }, /externally owned/);
  report.findings[0].classification = "known";
  validateReport(report, evidence);
  report.followUps = [followUp()];
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

test("implementation follow-ups require actionable findings", () => {
  const { evidence, report } = fixture();
  evidence.incidents[0].cloud.status = "recovered";
  report.findings[0].classification = "recovered";
  report.followUps = [followUp()];
  for (const classification of ["recovered", "known", "needs-investigation"]) {
    report.findings[0].classification = classification;
    assert.throws(() => {
      validateReport(report, evidence);
    }, /actionable/);
  }
});

test("malformed, duplicate, oversized, and unknown follow-up tasks are rejected", () => {
  const { evidence, report } = fixture();
  const malformed = [
    null,
    {},
    followUp({ key: "Uppercase-Key" }),
    followUp({ key: "a".repeat(81) }),
    followUp({ title: " " }),
    followUp({ title: "a".repeat(201) }),
    followUp({ body: "" }),
    followUp({ body: "a".repeat(15_001) }),
    followUp({ incidentIds: [] }),
    followUp({ incidentIds: ["123", "123"] }),
    followUp({ incidentIds: ["unknown"] }),
    followUp({ incidentIds: [123] }),
  ];
  for (const task of malformed) {
    assert.throws(() => {
      validateReport({ ...report, followUps: [task] }, evidence);
    });
  }
  for (const followUps of [null, {}, Array.from({ length: 6 }, () => {
    return followUp();
  }), [followUp(), followUp()], [followUp(), followUp({ key: "another-name" })]]) {
    assert.throws(() => {
      validateReport({ ...report, followUps }, evidence);
    });
  }
  assert.throws(() => {
    validateReport({ ...report, summary: "a".repeat(45_001) }, evidence);
  }, /too large/);
  assert.throws(() => {
    validateReport({ ...report, fix: { propose: true } }, evidence);
  }, /structure/);
  validateReport({ ...report, followUps: [followUp()] }, evidence);
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

function implementationIssue(overrides = {}) {
  return {
    number: 20,
    title: "Human-maintained implementation title",
    state: "open",
    html_url: `https://github.com/${REPOSITORY}/issues/20`,
    body: "Human notes before.\n<!-- sentry-follow-up:repair-source-discovery -->\n\n"
      + "<!-- sentry-follow-up-managed:start -->\n<!-- sentry-follow-up-incidents:123 -->\nOld investigation.\n"
      + "<!-- sentry-follow-up-managed:end -->\nHuman notes after.",
    ...overrides,
  };
}

function publicationFixture(t, existing = []) {
  const directory = temporaryDirectory(t);
  const { evidence, report } = fixture();
  report.followUps = [followUp()];
  const issues = structuredClone(existing);
  const calls = [];
  const triage = new SentryTriage({
    output: directory,
    env: { GITHUB_REPOSITORY: REPOSITORY, GITHUB_RUN_ID: "456" },
    runCommand: () => {
      assert.fail("Report validation and issue publication must not execute commands");
    },
  });
  triage.writeJson(join(directory, "report.json"), report);
  triage.writeJson(join(directory, "evidence.json"), evidence);
  triage.github = async (path, method = "GET", body) => {
    calls.push({ path, method, body });
    assert.doesNotMatch(path, /\/pulls|\/git\/|\/contents/);
    if (method === "GET" && path.startsWith(`repos/${REPOSITORY}/issues?`)) {
      return issues;
    }
    if (method === "POST" && path === `repos/${REPOSITORY}/issues`) {
      const number = 1000 + issues.length;
      const issue = { number, state: "open", html_url: `https://github.com/${REPOSITORY}/issues/${number}`, ...body };
      issues.push(issue);
      return issue;
    }
    if (method === "PATCH" && path.startsWith(`repos/${REPOSITORY}/issues/`)) {
      const issue = issues.find((item) => {
        return path === `repos/${REPOSITORY}/issues/${item.number}`;
      });
      assert.ok(issue, path);
      assert.deepEqual(Object.keys(body), ["body"]);
      Object.assign(issue, body);
      return issue;
    }
    assert.fail(`Unexpected API call ${method} ${path}`);
  };
  return { triage, directory, evidence, report, issues, calls };
}

test("report validation needs no patch artifact or command execution", (t) => {
  const { triage, directory } = publicationFixture(t);
  const reportPath = join(directory, "report.json");
  const original = readFileSync(reportPath, "utf8");
  triage.validate();
  assert.equal(readFileSync(reportPath, "utf8"), original);
  assert.equal(existsSync(join(directory, "fix.patch")), false);
  assert.equal(typeof triage.bundle, "undefined");
});

test("publication creates implementation issues and links them from the daily report", async (t) => {
  const { triage, issues, calls } = publicationFixture(t);
  await triage.publish();
  const task = issues.find((issue) => {
    return issue.body.includes("<!-- sentry-follow-up:repair-source-discovery -->");
  });
  const daily = issues.find((issue) => {
    return issue.body.includes(REPORT_MARKER);
  });
  assert.ok(task);
  assert.match(task.body, /sentry-follow-up-incidents:123/);
  assert.match(task.body, /## Implementation/);
  assert.ok(daily.body.includes(task.html_url));
  assert.match(daily.body, /oboapp\/oboapp\/issues\/687/);
  assert.equal(calls.filter((call) => {
    return call.method === "POST";
  }).length, 2);
});

test("existing implementation issues keep their title and human text outside the managed section", async (t) => {
  const original = implementationIssue();
  const { triage, issues, calls } = publicationFixture(t, [original]);
  await triage.publish();
  const issue = issues[0];
  assert.equal(issue.title, original.title);
  assert.ok(issue.body.startsWith("Human notes before.\n"));
  assert.ok(issue.body.endsWith("\nHuman notes after."));
  assert.doesNotMatch(issue.body, /Old investigation/);
  assert.match(issue.body, /Update discovery and add regression coverage/);
  assert.equal(calls.filter((call) => {
    return call.method === "POST";
  }).length, 1);
});

test("a changed model slug reuses the issue with the same exact incident set", async (t) => {
  const { triage, directory, report, issues } = publicationFixture(t, [implementationIssue()]);
  report.followUps[0].key = "different-model-description";
  triage.writeJson(join(directory, "report.json"), report);
  await triage.publish();
  assert.equal(issues.filter((issue) => {
    return issue.body.includes("<!-- sentry-follow-up:");
  }).length, 1);
  assert.match(issues[0].body, /sentry-follow-up:repair-source-discovery/);
  assert.doesNotMatch(issues[0].body, /sentry-follow-up:different-model-description/);
});

test("an exact task key takes precedence over an earlier incident-set match", async (t) => {
  const incidental = implementationIssue({
    number: 19,
    body: implementationIssue().body.replace("repair-source-discovery", "another-task"),
  });
  const exact = implementationIssue({
    body: implementationIssue().body.replace("sentry-follow-up-incidents:123", "sentry-follow-up-incidents:999"),
  });
  const { triage, calls } = publicationFixture(t, [incidental, exact]);
  await triage.publish();
  assert.equal(calls.some((call) => {
    return call.method === "PATCH" && call.path.endsWith("/19");
  }), false);
  assert.equal(calls.some((call) => {
    return call.method === "PATCH" && call.path.endsWith("/20");
  }), true);
});

test("closed implementation issues are linked without reopening, updating, or duplicating them", async (t) => {
  const closed = implementationIssue({ state: "closed" });
  const { triage, directory, report, issues, calls } = publicationFixture(t, [closed]);
  report.followUps[0].key = "new-model-slug";
  triage.writeJson(join(directory, "report.json"), report);
  await triage.publish();
  assert.deepEqual(issues[0], closed);
  assert.equal(calls.some((call) => {
    return call.method === "PATCH";
  }), false);
  assert.equal(calls.filter((call) => {
    return call.method === "POST";
  }).length, 1);
  assert.ok(issues[1].body.includes(closed.html_url));
  assert.match(issues[1].body, /\(closed\)/);
});

test("legacy task bodies without managed boundaries are preserved before appending the new section", async (t) => {
  const original = implementationIssue({ body: "<!-- sentry-follow-up:repair-source-discovery -->\nAll of this text belongs to a human." });
  const { triage, issues } = publicationFixture(t, [original]);
  await triage.publish();
  assert.ok(issues[0].body.startsWith(original.body));
  assert.match(issues[0].body, /sentry-follow-up-managed:start/);
});

test("ambiguous task section boundaries stop publication without overwriting human notes", async (t) => {
  const original = implementationIssue({ body: `${implementationIssue().body}\n<!-- sentry-follow-up-managed:start -->` });
  const { triage, issues, calls } = publicationFixture(t, [original]);
  await assert.rejects(triage.publish(), /ambiguous/);
  assert.deepEqual(issues[0], original);
  assert.equal(calls.some((call) => {
    return call.method !== "GET";
  }), false);
});

test("the daily report also preserves human notes outside its managed section", async (t) => {
  const daily = {
    number: 10, title: "[Sentry] Daily investigation", state: "open", html_url: "daily-report",
    body: `${REPORT_MARKER}\nHuman introduction.\n<!-- daily-sentry-triage-managed:start -->\nOld report\n`
      + "<!-- daily-sentry-triage-managed:end -->\nHuman conclusion.",
  };
  const { triage, issues } = publicationFixture(t, [implementationIssue(), daily]);
  await triage.publish();
  assert.ok(issues[1].body.startsWith(`${REPORT_MARKER}\nHuman introduction.\n`));
  assert.ok(issues[1].body.endsWith("\nHuman conclusion."));
  assert.doesNotMatch(issues[1].body, /Old report/);
});

test("invalid report data is rejected before any GitHub publication", async (t) => {
  const { triage, directory, report, calls } = publicationFixture(t);
  report.followUps[0].incidentIds = ["unknown"];
  triage.writeJson(join(directory, "report.json"), report);
  await assert.rejects(triage.publish(), /unknown/);
  assert.equal(calls.length, 0);
});

test("GitHub mutations are restricted to implementation issues in the configured fork", async () => {
  let requests = 0;
  const triage = new SentryTriage({
    fetchImpl: async () => {
      requests++;
      return Response.json({ html_url: "created-issue" });
    },
  });
  for (const [path, method] of [
    [`repos/${REPOSITORY}/pulls`, "POST"], [`repos/${REPOSITORY}/git/refs`, "POST"],
    ["repos/oboapp/oboapp/issues", "POST"], [`repos/${REPOSITORY}/issues/1`, "DELETE"],
  ]) {
    await assert.rejects(triage.github(path, method, {}), /limited to issues/);
  }
  assert.equal(requests, 0);
  await triage.github(`repos/${REPOSITORY}/issues`, "POST", { title: "Task", body: "Details" });
  assert.equal(requests, 1);
});

test("existing open and closed task keys and incident sets are collected as evidence", async (t) => {
  const directory = temporaryDirectory(t);
  const triage = new SentryTriage({
    output: directory,
    env: { SENTRY_TRIAGE_TOKEN: "read-only", GITHUB_OUTPUT: join(directory, "outputs") },
    runCommand: () => {
      assert.fail("No command execution is needed without cloud evidence");
    },
  });
  triage.pagedSentry = async () => {
    return [];
  };
  triage.github = async (path) => {
    if (path.includes("/pulls?")) {
      return [{ title: "Existing fix PR", html_url: "read-only-pr", body: "Existing review" }];
    }
    return [implementationIssue({ state: "closed" }), implementationIssue({ pull_request: {} })];
  };
  await triage.collect();
  const evidence = triage.readJson(join(directory, "evidence.json"));
  assert.equal(evidence.existingFollowUps.length, 1);
  assert.equal(evidence.existingFollowUps[0].state, "closed");
  assert.equal(evidence.existingFollowUps[0].key, "repair-source-discovery");
  assert.deepEqual(evidence.existingFollowUps[0].incidentIds, ["123"]);
  assert.equal(evidence.openPullRequests[0].url, "read-only-pr");
});

test("task deduplication follows repository issue pagination", async () => {
  const triage = new SentryTriage();
  const pages = [];
  triage.github = async (path) => {
    pages.push(path);
    return pages.length === 1 ? Array.from({ length: 100 }, (_, number) => {
      return { number, body: "ordinary issue" };
    }) : [implementationIssue()];
  };
  const issues = await triage.repositoryIssues();
  assert.equal(issues.length, 101);
  assert.match(pages[1], /page=2/);
});
