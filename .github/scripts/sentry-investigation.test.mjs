import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { SentryInvestigation } from "./sentry-investigation.mjs";

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
  writeFixtureFile(root, "AGENTS.md", "Use clear code and review every proposed change.\n");
  writeFixtureFile(root, "agent-context/.apm/prompts/daily-sentry-triage.prompt.md", "Investigate the supplied evidence and return the required report.\n");
  writeFixtureFile(root, ".github/sentry-triage.schema.json", readFileSync(new URL("../sentry-triage.schema.json", import.meta.url)));
  writeFixtureFile(root, "api/src/existing.ts", "export const message = 'old';\nexport const count = 1;\n");
  writeFixtureFile(root, ".env.local", "PRIVATE_SETTING=fixture-private-value\n");
  const evidence = {
    generatedAt: "2026-11-15T12:00:00Z",
    incidents: [{ id: "123", source: "example-source", investigate: true, cloud: { status: "failed" } }],
    openPullRequests: [],
  };
  writeFixtureFile(output, "evidence.json", JSON.stringify(evidence));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  execFileSync("git", ["add", "--all"], { cwd: root });
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "Fixture"], { cwd: root });
  return { directory, root, output, evidence };
}

function report(propose = false) {
  return {
    summary: "The failure was reproduced.",
    findings: [{
      incidentId: "123",
      classification: "actionable",
      diagnosis: "The existing parser rejects the documented input.",
      nextSteps: "Review the proposed correction.",
    }],
    fix: {
      propose,
      title: propose ? "Handle the documented input" : "",
      body: propose ? "The parser now handles the documented input. Regression coverage is included." : "",
      incidentIds: propose ? ["123"] : [],
    },
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
  return new Response(JSON.stringify({ id, status: "completed", output }), {
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

test("a Responses tool loop preserves reasoning and produces a validated report", async (t) => {
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
    assert.ok(result);
    assert.match(result.output, /count = 1/);
    assert.doesNotMatch(result.output, /message = 'old'/);
    return response([finalMessage(expected)], "response-2");
  });
  await runner.investigate();
  assert.equal(requests.length, 2);
  assert.deepEqual(JSON.parse(readFileSync(join(paths.output, "report.json"), "utf8")), expected);
  for (const body of requests) {
    assert.doesNotMatch(JSON.stringify(body), /openai-test-secret|github-test-secret|sentry-test-secret/);
  }
});

test("proposed changes stay staged until the final report passes validation", async (t) => {
  const paths = fixture(t);
  const destination = join(paths.root, "api/src/correction.ts");
  const content = "export const value = '$(touch should-not-exist)';\n";
  let requests = 0;
  const runner = investigator(paths, async () => {
    requests++;
    if (requests === 1) {
      return response([toolCall("propose_file", { path: "api/src/correction.ts", content })]);
    }
    assert.equal(existsSync(destination), false);
    return response([finalMessage(report(true))]);
  });
  await runner.investigate();
  assert.equal(readFileSync(destination, "utf8"), content);
  assert.equal(existsSync(join(paths.root, "should-not-exist")), false);
});

test("a validated proposal can replace a tracked file with a new source file", async (t) => {
  const paths = fixture(t);
  let requests = 0;
  const runner = investigator(paths, async () => {
    requests++;
    if (requests === 1) {
      return response([
        toolCall("propose_file", { path: "api/src/existing.ts", content: null }, "delete-old"),
        toolCall("propose_file", { path: "api/src/replacement.ts", content: "export const message = 'new';\n" }, "add-new"),
      ]);
    }
    assert.equal(existsSync(join(paths.root, "api/src/existing.ts")), true);
    assert.equal(existsSync(join(paths.root, "api/src/replacement.ts")), false);
    return response([finalMessage(report(true))]);
  });
  await runner.investigate();
  assert.equal(existsSync(join(paths.root, "api/src/existing.ts")), false);
  assert.equal(readFileSync(join(paths.root, "api/src/replacement.ts"), "utf8"), "export const message = 'new';\n");
});

test("invalid or absent final reports leave proposed files and the checkout unchanged", async (t) => {
  for (const final of [finalMessage("not JSON"), finalMessage({ ...report(true), findings: [] }), null]) {
    await t.test(final === null ? "missing report" : final.content[0].text.slice(0, 30), async (st) => {
      const paths = fixture(st);
      const original = readFileSync(join(paths.root, "api/src/existing.ts"), "utf8");
      let requests = 0;
      const runner = investigator(paths, async () => {
        requests++;
        if (requests === 1) {
          return response([toolCall("propose_file", { path: "api/src/existing.ts", content: "changed\n" })]);
        }
        return response(final === null ? [] : [final]);
      });
      await assert.rejects(runner.investigate());
      assert.equal(readFileSync(join(paths.root, "api/src/existing.ts"), "utf8"), original);
      assert.equal(existsSync(join(paths.output, "report.json")), false);
      assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: paths.root, encoding: "utf8" }), "");
    });
  }
});

test("a report that declines a fix cannot apply staged model changes", async (t) => {
  const paths = fixture(t);
  let requests = 0;
  const runner = investigator(paths, async () => {
    requests++;
    if (requests === 1) {
      return response([toolCall("propose_file", { path: "api/src/correction.ts", content: "export const changed = true;\n" })]);
    }
    return response([finalMessage(report())]);
  });
  await runner.investigate();
  assert.equal(existsSync(join(paths.root, "api/src/correction.ts")), false);
  assert.deepEqual(JSON.parse(readFileSync(join(paths.output, "report.json"), "utf8")), report());
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

test("proposed writes reject protected files and path escapes before any file changes", async (t) => {
  const paths = fixture(t);
  const runner = investigator(paths, async () => {
    throw new Error("No network call is expected");
  });
  const protectedPaths = [
    ".github/workflows/deploy.yml", "AGENTS.md", "ingest/terraform/main.tf",
    "ingest/crawlers/mladost-bg/index.ts", "web/lib/.env", "pnpm-lock.yaml",
    "ingest/package.json", "ingest/source-package-policy.json", "../outside.ts",
    "api/src/../../AGENTS.md", "web\\lib\\escape.ts", join(paths.root, "api/src/existing.ts"),
  ];
  for (const path of protectedPaths) {
    await assert.rejects(runner.callTool("propose_file", { path, content: "changed\n" }), path);
  }
  assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: paths.root, encoding: "utf8" }), "");
});

test("oversized proposals are rejected while files remain unchanged", async (t) => {
  const paths = fixture(t);
  const runner = investigator(paths, async () => {
    throw new Error("No network call is expected");
  });
  await assert.rejects(runner.callTool("propose_file", { path: "api/src/large.ts", content: "x".repeat(500_001) }), /500 KB|limit|exceeds/i);
  for (let index = 0; index < 20; index++) {
    await runner.callTool("propose_file", { path: `api/src/part-${index}.ts`, content: `export const value = ${index};\n` });
  }
  await assert.rejects(runner.callTool("propose_file", { path: "api/src/part-20.ts", content: "export const value = 20;\n" }), /20 files|limit|exceeds/i);
  assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: paths.root, encoding: "utf8" }), "");
});

test("file tools reject a directory symlink escaping the checkout", async (t) => {
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
  await assert.rejects(runner.callTool("propose_file", { path: "api/src/link/secret.ts", content: "replaced\n" }));
  assert.equal(readFileSync(join(outside, "secret.ts"), "utf8"), "outside private data\n");
});

test("model-supplied commands are returned as tool errors and never executed", async (t) => {
  const paths = fixture(t);
  const commands = [];
  let requests = 0;
  const runner = investigator(paths, async (url, options) => {
    requests++;
    if (requests === 1) {
      return response([toolCall("run_command", { command: "node", args: ["-e", "require('fs').writeFileSync('executed', 'unsafe')"] })]);
    }
    const body = JSON.parse(options.body);
    const result = body.input.find((item) => {
      return item.type === "function_call_output";
    });
    assert.match(result.output, /unknown|unsupported|not allowed/i);
    return response([finalMessage(report())]);
  }, {
    runCommand: (command, ...args) => {
      commands.push({ command, args });
      assert.equal(command, "git");
      return execFileSync(command, args, { cwd: paths.root, encoding: "utf8" });
    },
  });
  await runner.investigate();
  assert.equal(existsSync(join(paths.root, "executed")), false);
  assert.equal(commands.some((call) => {
    return call.command === "node";
  }), false);
});

test("public source research carries no credentials and refuses unsafe origins", async (t) => {
  const paths = fixture(t);
  const calls = [];
  const runner = investigator(paths, async (url, options) => {
    calls.push({ url, options });
    assert.ok(["manual", "error"].includes(options.redirect));
    assert.equal(options.credentials, "omit");
    assert.equal(new Headers(options.headers).has("Authorization"), false);
    assert.doesNotMatch(JSON.stringify(options), /openai-test-secret|github-test-secret|sentry-test-secret/);
    return new Response("export const version = '1.0';\n", { headers: { "Content-Type": "text/plain" } });
  });
  const unsafeUrls = [
    "http://raw.githubusercontent.com/oboapp/sources/main/README.md", "https://127.0.0.1/private",
    "https://localhost/private", "http://169.254.169.254/latest/meta-data/", "https://example.com/feed",
    "https://user:pass@api.github.com/repos/oboapp/sources", "https://api.github.com:444/repos/oboapp/sources",
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
    calls++;
    assert.ok(["manual", "error"].includes(options.redirect));
    return new Response(null, { status: 302, headers: { Location: "https://localhost/private" } });
  });
  await assert.rejects(runner.callTool("fetch_public_source", { url: "https://raw.githubusercontent.com/oboapp/sources/main/README.md" }));
  assert.equal(calls, 1);
});

test("API failures expose a useful error code without leaking credentials or applying a patch", async (t) => {
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
  assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: paths.root, encoding: "utf8" }), "");
});

test("an incomplete API response cannot apply staged changes", async (t) => {
  const paths = fixture(t);
  let requests = 0;
  const runner = investigator(paths, async () => {
    requests++;
    if (requests === 1) {
      return response([toolCall("propose_file", { path: "api/src/correction.ts", content: "export const changed = true;\n" })]);
    }
    return new Response(JSON.stringify({ status: "incomplete", output: [finalMessage(report(true))] }), {
      headers: { "Content-Type": "application/json" },
    });
  });
  await assert.rejects(runner.investigate(), /complete|incomplete/i);
  assert.equal(existsSync(join(paths.root, "api/src/correction.ts")), false);
  assert.equal(existsSync(join(paths.output, "report.json")), false);
});
