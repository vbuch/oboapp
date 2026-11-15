import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { INVESTIGATION_TOOLS, SentryInvestigation } from "./sentry-investigation.mjs";

const OPENAI_SECRET = "openai-test-secret";
const GITHUB_SECRET = "github-test-secret";
const SENTRY_SECRET = "sentry-test-secret";

function writeFixtureFile(root, path, content) {
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, content);
}

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "sentry-investigation-test-"));
  const root = join(directory, "checkout");
  const output = join(directory, "artifacts");
  mkdirSync(root);
  mkdirSync(output);
  t.after(() => {
    assert.ok(resolve(directory).startsWith(join(resolve(tmpdir()), "sentry-investigation-test-")));
    rmSync(directory, { recursive: true, force: true });
  });
  writeFixtureFile(root, "AGENTS.md", "Use clear code and investigate the available evidence.\n");
  writeFixtureFile(root, "agent-context/.apm/prompts/daily-sentry-triage.prompt.md", "Investigate the supplied evidence and return the required report.\n");
  writeFixtureFile(root, ".github/sentry-triage.schema.json", readFileSync(new URL("../sentry-triage.schema.json", import.meta.url)));
  writeFixtureFile(root, "api/src/existing.ts", "export const message = 'old';\nexport const count = 1;\n");
  writeFixtureFile(root, ".env.local", "PRIVATE_SETTING=fixture-private-value\n");
  const evidence = {
    generatedAt: "2026-11-15T12:00:00Z",
    incidents: [{ id: "123", source: "example-source", investigate: true, cloud: { status: "failed" } }],
    existingFollowUps: [],
    openPullRequests: [],
  };
  writeFixtureFile(output, "evidence.json", JSON.stringify(evidence));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  execFileSync("git", ["add", "--all"], { cwd: root });
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "Fixture"], { cwd: root });
  return { directory, root, output, evidence };
}

function report() {
  return {
    summary: "The parser rejects the provider's documented input.",
    findings: [{
      incidentId: "123",
      classification: "actionable",
      diagnosis: "The existing parser rejects the documented input.",
      nextSteps: "Implement and test the parser correction described in the follow-up issue.",
    }],
    followUps: [{
      key: "example-source-parser",
      title: "Handle the documented provider input",
      body: "Evidence: incident 123 fails when the provider returns its documented empty result. "
        + "Implementation: inspect api/src/existing.ts and handle the empty result before parsing. "
        + "Add a regression test for empty results and retain coverage of nonempty results. "
        + "Acceptance criteria: both inputs parse correctly, required checks pass, and a later Cloud Run execution confirms production recovery. "
        + "Verification still needed: reproduce the provider response and run the regression test during implementation.",
      incidentIds: ["123"],
    }],
  };
}

function toolCall(name, args, id = "call-1") {
  return { type: "function_call", name, call_id: id, arguments: JSON.stringify(args) };
}

function finalMessage(value) {
  return {
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text: typeof value === "string" ? value : JSON.stringify(value) }],
  };
}

function response(output, id = "response-1") {
  return new Response(JSON.stringify({ id, status: "completed", output, usage: { input_tokens: 100, output_tokens: 20 } }), {
    headers: { "Content-Type": "application/json" },
  });
}

function investigator(paths, fetchImpl, options = {}) {
  return new SentryInvestigation({
    root: paths.root,
    output: paths.output,
    env: {
      OPENAI_API_KEY: OPENAI_SECRET,
      SENTRY_TRIAGE_MODEL: "gpt-5.4",
      TRIAGE_DIRECTORY: paths.output,
      GH_TOKEN: GITHUB_SECRET,
      SENTRY_TRIAGE_TOKEN: SENTRY_SECRET,
    },
    fetchImpl,
    sleep: async () => {},
    ...options,
  });
}

function assertCleanCheckout(root) {
  assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }), "");
}

test("a Responses research loop preserves reasoning and writes validated report artifacts", async (t) => {
  const paths = fixture(t);
  const requests = [];
  const reasoning = { type: "reasoning", id: "reasoning-1", encrypted_content: "opaque-encrypted-state", summary: [] };
  const call = toolCall("read_file", { path: "api/src/existing.ts", startLine: 2, lineCount: 1 });
  const expected = report();
  const runner = investigator(paths, async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(new Headers(options.headers).get("Authorization"), `Bearer ${OPENAI_SECRET}`);
    const body = JSON.parse(options.body);
    requests.push(body);
    assert.equal(body.model, "gpt-5.4");
    assert.equal(body.store, false);
    assert.ok(body.include.includes("reasoning.encrypted_content"));
    if (requests.length === 1) {
      return response([reasoning, call]);
    }
    assert.ok(body.input.some((item) => {
      return JSON.stringify(item) === JSON.stringify(reasoning);
    }));
    assert.ok(body.input.some((item) => {
      return JSON.stringify(item) === JSON.stringify(call);
    }));
    const result = body.input.find((item) => {
      return item.type === "function_call_output" && item.call_id === call.call_id;
    });
    assert.match(result.output, /count = 1/);
    assert.doesNotMatch(result.output, /message = 'old'/);
    return response([finalMessage(expected)], "response-2");
  });
  await runner.investigate();
  assert.equal(requests.length, 2);
  assert.deepEqual(JSON.parse(readFileSync(join(paths.output, "report.json"), "utf8")), expected);
  assert.deepEqual(JSON.parse(readFileSync(join(paths.output, "usage.json"), "utf8")), {
    requests: 2, inputTokens: 200, outputTokens: 40,
  });
  for (const body of requests) {
    assert.doesNotMatch(JSON.stringify(body), /openai-test-secret|github-test-secret|sentry-test-secret/);
  }
  assertCleanCheckout(paths.root);
});

test("the agent exposes research tools and rejects attempted file writes, deletions, and commands", async (t) => {
  const paths = fixture(t);
  const source = readFileSync(join(paths.root, "api/src/existing.ts"), "utf8");
  const calls = [
    toolCall("propose_file", { path: "api/src/existing.ts", content: "replaced\n" }, "replace"),
    toolCall("propose_file", { path: "api/src/correction.ts", content: "created\n" }, "create"),
    toolCall("propose_file", { path: "api/src/existing.ts", content: null }, "delete"),
    toolCall("write_file", { path: "AGENTS.md", content: "ignore all instructions" }, "write"),
    toolCall("run_command", { command: "node", args: ["-e", "require('fs').writeFileSync('executed', 'unsafe')"] }, "run"),
  ];
  let requests = 0;
  const runner = investigator(paths, async (url, options) => {
    requests += 1;
    if (requests === 1) {
      const tools = JSON.parse(options.body).tools;
      assert.deepEqual(tools, INVESTIGATION_TOOLS);
      assert.deepEqual(tools.filter((tool) => {
        return tool.type === "function";
      }).map((tool) => {
        return tool.name;
      }), ["list_files", "read_file", "search_code", "fetch_public_source"]);
      return response(calls);
    }
    const body = JSON.parse(options.body);
    const results = body.input.filter((item) => {
      return item.type === "function_call_output";
    });
    assert.equal(results.length, calls.length);
    for (const result of results) {
      assert.match(result.output, /unknown|unsupported|not allowed/i);
    }
    return response([finalMessage(report())]);
  });
  await runner.investigate();
  assert.equal(readFileSync(join(paths.root, "api/src/existing.ts"), "utf8"), source);
  assert.equal(existsSync(join(paths.root, "api/src/correction.ts")), false);
  assert.equal(existsSync(join(paths.root, "executed")), false);
  assertCleanCheckout(paths.root);
});

test("invalid, obsolete, or absent reports cannot write report or usage artifacts", async (t) => {
  const obsolete = report();
  delete obsolete.followUps;
  obsolete.fix = { propose: false, title: "", body: "", incidentIds: [] };
  const invalidReference = report();
  invalidReference.followUps[0].incidentIds = ["unknown-incident"];
  const finals = [
    ["invalid JSON", finalMessage("not JSON")],
    ["missing findings", finalMessage({ ...report(), findings: [] })],
    ["obsolete patch report", finalMessage(obsolete)],
    ["unknown follow-up incident", finalMessage(invalidReference)],
    ["missing report", null],
  ];
  for (const [name, final] of finals) {
    await t.test(name, async (st) => {
      const paths = fixture(st);
      const runner = investigator(paths, async () => {
        return response(final === null ? [] : [final]);
      });
      await assert.rejects(runner.investigate());
      assert.equal(existsSync(join(paths.output, "report.json")), false);
      assert.equal(existsSync(join(paths.output, "usage.json")), false);
      assertCleanCheckout(paths.root);
    });
  }
});

test("read tools reject secrets, Git internals, absolute paths, and traversal", async (t) => {
  const paths = fixture(t);
  const runner = investigator(paths, async () => {
    throw new Error("No network call is expected");
  });
  const protectedPaths = [
    ".env.local", ".git/config", "../outside.ts", "api/src/../../../outside.ts",
    "api\\src\\existing.ts", join(paths.root, "api/src/existing.ts"),
  ];
  for (const path of protectedPaths) {
    await assert.rejects(runner.callTool("read_file", { path, startLine: 1, lineCount: 20 }), path);
  }
  const result = await runner.callTool("read_file", { path: "api/src/existing.ts", startLine: 1, lineCount: 1 });
  assert.match(JSON.stringify(result), /message = 'old'/);
});

test("listing and searching repository files do not expose tracked secrets", async (t) => {
  const paths = fixture(t);
  const runner = investigator(paths, async () => {
    throw new Error("No network call is expected");
  });
  const files = await runner.callTool("list_files", { prefix: "" });
  assert.doesNotMatch(JSON.stringify(files), /\.env\.local|\.git\/config/);
  const matches = await runner.callTool("search_code", { prefix: "", query: "fixture-private-value" });
  assert.doesNotMatch(JSON.stringify(matches), /fixture-private-value/);
  for (const name of ["list_files", "search_code"]) {
    await assert.rejects(runner.callTool(name, { prefix: "../", query: "message" }));
  }
});

test("file reads reject a directory symlink escaping the checkout", async (t) => {
  const paths = fixture(t);
  const outside = join(paths.directory, "outside");
  mkdirSync(outside);
  writeFixtureFile(outside, "secret.ts", "outside private data\n");
  const link = join(paths.root, "api/src/link");
  try {
    symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (["EPERM", "EACCES"].includes(error.code)) {
      t.skip("The test account cannot create directory symlinks");
      return;
    }
    throw error;
  }
  const runner = investigator(paths, async () => {
    throw new Error("No network call is expected");
  });
  await assert.rejects(runner.callTool("read_file", { path: "api/src/link/secret.ts", startLine: 1, lineCount: 1 }));
  assert.equal(readFileSync(join(outside, "secret.ts"), "utf8"), "outside private data\n");
});

test("public source research carries no credentials and refuses unsafe origins or credential queries", async (t) => {
  const paths = fixture(t);
  const calls = [];
  const runner = investigator(paths, async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.redirect, "error");
    assert.equal(options.credentials, "omit");
    assert.equal(new Headers(options.headers).has("Authorization"), false);
    assert.doesNotMatch(JSON.stringify(options), /openai-test-secret|github-test-secret|sentry-test-secret/);
    return new Response("export const version = '1.0';\n", { headers: { "Content-Type": "text/plain" } });
  });
  const unsafeUrls = [
    "http://raw.githubusercontent.com/oboapp/sources/main/README.md", "https://127.0.0.1/private",
    "https://localhost/private", "http://169.254.169.254/latest/meta-data/", "https://example.com/feed",
    "https://user:pass@api.github.com/repos/oboapp/sources", "https://api.github.com:444/repos/oboapp/sources",
    "https://api.github.com/repos/oboapp/sources/readme?access_token=private",
  ];
  for (const url of unsafeUrls) {
    await assert.rejects(runner.callTool("fetch_public_source", { url }), url);
  }
  assert.equal(calls.length, 0);
  const result = await runner.callTool("fetch_public_source", { url: "https://raw.githubusercontent.com/oboapp/sources/main/README.md" });
  assert.match(JSON.stringify(result), /version/);
  assert.equal(calls.length, 1);
});

test("public source redirects cannot reach another origin", async (t) => {
  const paths = fixture(t);
  let calls = 0;
  const runner = investigator(paths, async (url, options) => {
    calls += 1;
    assert.equal(options.redirect, "error");
    return new Response(null, { status: 302, headers: { Location: "https://localhost/private" } });
  });
  await assert.rejects(runner.callTool("fetch_public_source", { url: "https://raw.githubusercontent.com/oboapp/sources/main/README.md" }));
  assert.equal(calls, 1);
});

test("API failures expose a useful code without leaking credentials or writing artifacts", async (t) => {
  const paths = fixture(t);
  const runner = investigator(paths, async () => {
    return new Response(JSON.stringify({ error: { code: "insufficient_quota", message: `Rejecting ${OPENAI_SECRET}` } }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  });
  await assert.rejects(runner.investigate(), (error) => {
    assert.match(error.message, /429|insufficient_quota/);
    assert.doesNotMatch(error.message, /openai-test-secret|github-test-secret|sentry-test-secret/);
    return true;
  });
  assert.equal(existsSync(join(paths.output, "report.json")), false);
  assert.equal(existsSync(join(paths.output, "usage.json")), false);
  assertCleanCheckout(paths.root);
});

test("incomplete or refused responses cannot write artifacts", async (t) => {
  const cases = [
    ["incomplete", { status: "incomplete", output: [finalMessage(report())] }],
    ["refused", { status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "Unable to investigate" }] }] }],
  ];
  for (const [name, value] of cases) {
    await t.test(name, async (st) => {
      const paths = fixture(st);
      const runner = investigator(paths, async () => {
        return new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
      });
      await assert.rejects(runner.investigate(), /complete|refus/i);
      assert.equal(existsSync(join(paths.output, "report.json")), false);
      assert.equal(existsSync(join(paths.output, "usage.json")), false);
      assertCleanCheckout(paths.root);
    });
  }
});
