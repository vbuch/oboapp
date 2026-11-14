import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export const REPOSITORY = "vbuch/oboapp";
export const REPORT_MARKER = "<!-- daily-sentry-triage -->";
const CLASSIFICATIONS = new Set(["actionable", "recovered", "known", "needs-investigation"]);
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export function redact(value) {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === "object") {
    const privateKeys = new Set(["email", "ip", "ip_address", "authorization", "cookie"]);
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => {
        return !privateKeys.has(key.toLowerCase());
      })
      .map(([key, item]) => {
        return [key, redact(item)];
      }));
  }
  if (typeof value === "string") {
    return value
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]")
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_IP]")
      .replace(/(https?:\/\/)[^/\s]+@/gi, "$1[REDACTED]@")
      .replace(/([?&](?:token|key|secret|password|api_key|access_token)=)[^&\s]+/gi, "$1[REDACTED]");
  }
  return value;
}

export function run(command, ...args) {
  const options = { encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 };
  if (process.platform === "win32" && command === "gcloud") {
    // Invoke the SDK entrypoint directly to preserve quoted logging filters on Windows.
    const launcher = execFileSync("where.exe", ["gcloud"], options).trim().split(/\r?\n/)[0];
    const sdkRoot = dirname(dirname(launcher));
    const bundledInterpreter = join(sdkRoot, "platform", "bundledpython", "python.exe");
    const interpreter = process.env.CLOUDSDK_PYTHON
      || (existsSync(bundledInterpreter) ? bundledInterpreter : "python.exe");
    return execFileSync(interpreter, [join(sdkRoot, "lib", "gcloud.py"), ...args], {
      ...options,
      env: { ...process.env, CLOUDSDK_ROOT_DIR: sdkRoot, PYTHONHOME: "" },
    });
  }
  return execFileSync(command, args, options);
}

export function sourceFromEvent(title, context) {
  const source = context.source || context.sourceType;
  if (typeof source === "string" && /^[a-z0-9-]+$/.test(source)) {
    return source;
  }
  return /^(?:Source|Crawler) ([a-z0-9-]+) failed/.exec(title)?.[1] ?? null;
}

export function allowedPatchPath(path) {
  const parts = path.split("/");
  if (path.startsWith("/") || path.includes("\\") || parts.some((part) => {
    return part === "" || part.startsWith(".");
  })) {
    return false;
  }
  if (path.includes("/mladost-bg/")) {
    return false;
  }
  if (["pnpm-lock.yaml", "ingest/package.json", "ingest/source-package-policy.json"].includes(path)) {
    return true;
  }
  return [
    "api/src/", "db/src/", "shared/src/", "web/app/", "web/components/", "web/lib/",
    "web/hooks/", "ingest/lib/", "ingest/sources/", "ingest/crawlers/",
    "ingest/messageIngest/", "ingest/geocoding/",
  ].some((prefix) => {
    return path.startsWith(prefix);
  });
}

function hasKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => {
      return Object.hasOwn(value, key);
    });
}

export function validateReport(report, evidence) {
  if (!hasKeys(report, ["summary", "findings", "fix"]) || typeof report.summary !== "string") {
    throw new Error("Invalid report structure");
  }
  if (!Array.isArray(report.findings) || report.findings.length > 100) {
    throw new Error("Invalid findings");
  }
  const incidents = new Map(evidence.incidents.map((item) => {
    return [item.id, item];
  }));
  for (const finding of report.findings) {
    if (!hasKeys(finding, ["incidentId", "classification", "diagnosis", "nextSteps"])) {
      throw new Error("Invalid finding structure");
    }
    const incident = incidents.get(finding.incidentId);
    if (!incident || !CLASSIFICATIONS.has(finding.classification)) {
      throw new Error("Finding references an unknown incident or classification");
    }
    if (typeof finding.diagnosis !== "string" || typeof finding.nextSteps !== "string") {
      throw new Error("Finding text must be a string");
    }
    if (finding.classification === "recovered" && incident.cloud.status !== "recovered") {
      throw new Error("Recovery requires a successful matching Cloud Run execution");
    }
    if (!incident.investigate && finding.classification !== "known") {
      throw new Error("An externally owned incident must remain classified as known");
    }
  }
  const identifiers = new Set(report.findings.map((finding) => {
    return finding.incidentId;
  }));
  if (report.findings.length !== incidents.size || identifiers.size !== incidents.size) {
    throw new Error("Report must cover every incident exactly once");
  }
  const fix = report.fix;
  if (!hasKeys(fix, ["propose", "title", "body", "incidentIds"]) || typeof fix.propose !== "boolean") {
    throw new Error("Invalid fix structure");
  }
  if (typeof fix.title !== "string" || typeof fix.body !== "string") {
    throw new Error("Invalid fix text");
  }
  if (!Array.isArray(fix.incidentIds) || !fix.incidentIds.every((id) => {
    return typeof id === "string";
  })) {
    throw new Error("Invalid fix incident IDs");
  }
  if (fix.propose) {
    if (!fix.title.trim() || !fix.body.trim() || fix.incidentIds.length === 0) {
      throw new Error("A proposed fix needs a title, evidence, and incident IDs");
    }
    for (const id of fix.incidentIds) {
      if (!incidents.get(id)?.investigate) {
        throw new Error("Fix targets an unknown or externally owned incident");
      }
    }
    if (report.findings.some((finding) => {
      return fix.incidentIds.includes(finding.incidentId) && finding.classification !== "actionable";
    })) {
      throw new Error("A fix requires actionable findings");
    }
  }
  if (JSON.stringify(report).length > 45_000) {
    throw new Error("Report is too large");
  }
}

export class SentryTriage {
  constructor({
    env = process.env,
    output = env.TRIAGE_DIRECTORY || "tmp/sentry-triage",
    fetchImpl = globalThis.fetch,
    runCommand = run,
    sleep = delay,
    now = () => {
      return new Date();
    },
  } = {}) {
    this.env = env;
    this.output = output;
    this.fetch = fetchImpl;
    this.run = runCommand;
    this.sleep = sleep;
    this.now = now;
  }

  async requestJson(url, token, method = "GET", body) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !["sentry.io", "api.github.com"].includes(parsed.host)
        || parsed.username || parsed.password) {
      throw new Error("Unexpected API origin");
    }
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await this.fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
        redirect: "manual",
      });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        throw new Error("API redirects are refused to protect credentials");
      }
      if (!response.ok) {
        await response.body?.cancel();
        if (method === "GET" && RETRYABLE_STATUSES.has(response.status) && attempt < 2) {
          await this.sleep(1000 * 2 ** attempt);
          continue;
        }
        // Provider response bodies can contain credentials or personal data.
        throw new Error(`${method} ${parsed.pathname}: HTTP ${response.status}`);
      }
      return { data: await response.json(), headers: response.headers };
    }
    throw new Error("API request exhausted retries");
  }

  async pagedSentry(path, params, token) {
    let cursor;
    const items = [];
    for (let page = 0; page < 8; page++) {
      const query = new URLSearchParams({ ...params, per_page: "50" });
      if (cursor) {
        query.set("cursor", cursor);
      }
      const { data, headers } = await this.requestJson(`https://sentry.io/api/0/${path}?${query}`, token);
      items.push(...data);
      const nextPage = (headers.get("Link") || "").split(",").find((part) => {
        return part.includes('rel="next"') && part.includes('results="true"');
      });
      cursor = /cursor="([^"]+)"/.exec(nextPage || "")?.[1];
      if (!cursor) {
        return items;
      }
    }
    throw new Error("Sentry pagination limit reached; refusing an incomplete investigation");
  }

  async github(path, method = "GET", body) {
    return (await this.requestJson(`https://api.github.com/${path}`, this.env.GH_TOKEN, method, body)).data;
  }

  readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
  }

  writeJson(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(redact(value), null, 2)}\n`);
  }

  async relatedIssues(source, config, shortId) {
    const matches = new Map();
    for (const url of config.knownSources[source]?.issues || []) {
      const issue = await this.github(`repos/${url.replace("https://github.com/", "")}`);
      matches.set(url, issue);
    }
    const repositories = config.issueRepositories.map((repo) => {
      return `repo:${repo}`;
    }).join(" ");
    const terms = source ? `"${source}" OR "${shortId}"` : `"${shortId}"`;
    const query = new URLSearchParams({ q: `${repositories} is:issue (${terms})`, per_page: "10" });
    for (const issue of (await this.github(`search/issues?${query}`)).items) {
      matches.set(issue.html_url, issue);
    }
    return Array.from(matches.values(), (issue) => {
      return { url: issue.html_url, title: issue.title, state: issue.state, body: (issue.body || "").slice(0, 16_000) };
    });
  }

  cloudEvidence(source, eventTime, since) {
    if (this.env.TRIAGE_CLOUD_LOGS !== "true" || !source) {
      return { status: "unavailable", reason: "Read-only Cloud Logging access is not configured" };
    }
    const jobs = this.readJson("ingest/terraform/source-jobs.bg.sofia.json");
    const key = Object.keys(jobs).find((name) => {
      return jobs[name].source === source;
    });
    if (!key) {
      return { status: "unavailable", reason: "Source has no mapped Cloud Run job" };
    }
    const project = this.env.GCP_PROJECT_ID;
    const filter = `resource.type="cloud_run_job" AND resource.labels.job_name="crawl-${key}" `
      + `AND timestamp>="${since}" AND (severity>=ERROR OR jsonPayload.message:*)`;
    const entries = JSON.parse(this.run("gcloud", "logging", "read", filter,
      `--project=${project}`, "--limit=200", "--format=json"));
    // Match the failed attempt's execution, including its final retry status.
    const nearby = entries.find((entry) => {
      return entry.severity === "ERROR" && entry.jsonPayload?.source === source
        && Math.abs(Date.parse(entry.timestamp) - Date.parse(eventTime)) < 5000;
    });
    if (!nearby) {
      return { status: "unknown", reason: "No matching execution found", truncated: entries.length === 200 };
    }
    const execution = nearby.labels?.["run.googleapis.com/execution_name"];
    if (typeof execution !== "string" || !/^[a-z0-9-]+$/.test(execution)) {
      return { status: "unknown", reason: "Execution identifier is absent" };
    }
    const details = JSON.parse(this.run("gcloud", "run", "jobs", "executions", "describe", execution,
      `--project=${project}`, "--region=europe-west1", "--format=json"));
    const status = details.status || {};
    const completed = status.conditions?.find((condition) => {
      return condition.type === "Completed";
    }) || {};
    return {
      status: { True: "recovered", False: "failed" }[completed.status] || "pending",
      execution,
      completed,
      retriedCount: status.retriedCount || 0,
      completionTime: status.completionTime ?? null,
    };
  }

  async collect() {
    const config = this.readJson(".github/sentry-triage.json");
    const now = this.now();
    const since = new Date(now.getTime() - config.lookbackHours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "Z");
    const token = this.env.SENTRY_TRIAGE_TOKEN;
    if (!token) {
      throw new Error("Configure the read-only SENTRY_TRIAGE_TOKEN secret");
    }
    const incidents = [];
    const contextCache = new Map();
    for (const project of config.projects) {
      const issues = await this.pagedSentry(`projects/${config.organization}/${project}/issues/`, {
        query: `lastSeen:>=${since}`, sort: "date", statsPeriod: "14d", environment: config.environment,
      }, token);
      for (const issue of issues) {
        if (Date.parse(issue.lastSeen) < Date.parse(since)) {
          continue;
        }
        const query = new URLSearchParams({ per_page: "1", environment: config.environment });
        const { data: events } = await this.requestJson(
          `https://sentry.io/api/0/organizations/${config.organization}/issues/${issue.id}/events/?${query}`, token);
        if (events.length === 0) {
          continue;
        }
        const eventId = events[0].eventID;
        const { data: event } = await this.requestJson(
          `https://sentry.io/api/0/projects/${config.organization}/${project}/events/${eventId}/`, token);
        const source = sourceFromEvent(issue.title, event.context || {});
        const policy = config.knownSources[source] || {};
        const contextKey = JSON.stringify([source, issue.shortId]);
        if (!contextCache.has(contextKey)) {
          contextCache.set(contextKey, await this.relatedIssues(source, config, issue.shortId));
        }
        const exceptions = (event.entries || []).filter((entry) => {
          return entry.type === "exception";
        }).flatMap((entry) => {
          return entry.data?.values || [];
        }).slice(0, 5).map((value) => {
          return {
            type: value.type ?? null,
            value: value.value ?? null,
            frames: (value.stacktrace?.frames || []).slice(-5).map((frame) => {
              return { filename: frame.filename ?? null, function: frame.function ?? null, lineNo: frame.lineNo ?? null };
            }),
          };
        });
        const incident = {
          id: issue.id, project, shortId: issue.shortId, title: issue.title, status: issue.status,
          url: issue.permalink, firstSeen: issue.firstSeen, lastSeen: issue.lastSeen,
          lifetimeCount: issue.count, eventId, source, release: event.release ?? null,
          investigate: policy.investigate ?? true, policy: policy.reason ?? null,
          exceptions, relatedIssues: contextCache.get(contextKey),
        };
        try {
          incident.cloud = this.cloudEvidence(source, event.dateCreated, since);
        } catch (error) {
          incident.cloud = { status: "unavailable", reason: redact(String(error.message)).slice(0, 500) };
        }
        incidents.push(incident);
      }
    }
    const openPrs = await this.github(`repos/${REPOSITORY}/pulls?state=open&per_page=100`);
    this.writeJson(join(this.output, "evidence.json"), {
      generatedAt: now.toISOString(), since, incidents,
      openPullRequests: openPrs.map((pr) => {
        return { url: pr.html_url, title: pr.title, body: (pr.body || "").slice(0, 8000) };
      }),
    });
    appendFileSync(this.env.GITHUB_OUTPUT, `has_work=${incidents.some((item) => {
      return item.investigate;
    })}\n`);
    console.log(`Collected ${incidents.length} recent Sentry issues`);
  }

  bundle() {
    this.run("git", "add", "--intent-to-add", "--all");
    const patch = this.run("git", "diff", "--binary", "HEAD");
    mkdirSync(this.output, { recursive: true });
    writeFileSync(join(this.output, "fix.patch"), patch);
    writeFileSync(join(this.output, "base-sha"), this.run("git", "rev-parse", "HEAD").trim());
  }

  validate() {
    const report = this.readJson(join(this.output, "report.json"));
    const evidence = this.readJson(join(this.output, "evidence.json"));
    validateReport(report, evidence);
    const patch = join(this.output, "fix.patch");
    const size = statSync(patch).size;
    const hasPatch = size > 0;
    if (hasPatch !== report.fix.propose) {
      throw new Error("Patch and proposed-fix status disagree");
    }
    if (hasPatch) {
      if (size > 500_000) {
        throw new Error("Patch exceeds the pilot's 500 KB limit");
      }
      this.run("git", "apply", "--check", patch);
      this.run("git", "apply", "--index", patch);
      const paths = this.run("git", "diff", "--cached", "--name-only", "-z").replace(/\0$/, "").split("\0");
      if (paths.length > 20 || !paths.every(allowedPatchPath)) {
        throw new Error("Patch modifies a protected path or exceeds 20 files");
      }
      for (const line of this.run("git", "ls-files", "--stage").trim().split("\n")) {
        if (["120000", "160000"].includes(line.split(" ")[0]) && paths.includes(line.split("\t")[1])) {
          throw new Error("Symlinks and submodules are not allowed in generated patches");
        }
      }
    }
    appendFileSync(this.env.GITHUB_OUTPUT, `has_patch=${hasPatch}\n`);
  }

  renderReport(report, evidence, prUrl) {
    const lines = [REPORT_MARKER, "## Latest daily investigation", "", report.summary, "",
      `Evidence collected: ${evidence.generatedAt} (UTC).`, ""];
    const incidents = new Map(evidence.incidents.map((item) => {
      return [item.id, item];
    }));
    for (const finding of report.findings) {
      const incident = incidents.get(finding.incidentId);
      lines.push(`### [${incident.shortId}](${incident.url}): ${finding.classification}`, "",
        finding.diagnosis, "", finding.nextSteps, "");
      for (const related of incident.relatedIssues) {
        lines.push(`Related: [${related.title}](${related.url}) (${related.state}).`);
      }
      lines.push("");
    }
    if (prUrl) {
      lines.push(`Proposed fix: ${prUrl}`, "");
    }
    lines.push(`Workflow: https://github.com/${REPOSITORY}/actions/runs/${this.env.GITHUB_RUN_ID}`);
    return redact(lines.join("\n"));
  }

  async publish() {
    if (this.env.GITHUB_REPOSITORY !== REPOSITORY) {
      throw new Error("Publication is limited to vbuch/oboapp");
    }
    const report = this.readJson(join(this.output, "report.json"));
    const evidence = this.readJson(join(this.output, "evidence.json"));
    validateReport(report, evidence);
    let prUrl;
    if (report.fix.propose) {
      const fix = report.fix;
      const key = createHash("sha256").update([...fix.incidentIds].sort().join(",")).digest("hex").slice(0, 12);
      const marker = `<!-- sentry-fix:${key} -->`;
      const existing = await this.github(`repos/${REPOSITORY}/pulls?state=open&per_page=100`);
      const match = existing.find((pr) => {
        return (pr.body || "").includes(marker);
      });
      if (match) {
        prUrl = match.html_url;
      } else {
        const branch = `automation/sentry-fix-${key}-${this.env.GITHUB_RUN_ID}`;
        this.run("git", "switch", "-c", branch);
        this.run("git", "apply", "--index", join(this.output, "fix.patch"));
        this.run("git", "-c", "user.name=github-actions[bot]", "-c",
          "user.email=41898282+github-actions[bot]@users.noreply.github.com",
          "commit", "-m", "fix: propose correction from daily Sentry investigation");
        this.run("git", "push", "origin", `HEAD:refs/heads/${branch}`);
        const pr = await this.github(`repos/${REPOSITORY}/pulls`, "POST", {
          head: branch, base: "main", title: fix.title.slice(0, 200), draft: true,
          body: redact(`${marker}\n\n${fix.body}\n\nValidated with the required builds, lint, TypeScript checks, and workspace tests.\n\n`
            + "This draft requires review and post-deployment verification."),
        });
        prUrl = pr.html_url;
      }
    }
    const body = this.renderReport(report, evidence, prUrl);
    const query = new URLSearchParams({
      q: `repo:${REPOSITORY} is:issue is:open "[Sentry] Daily investigation" in:title`, per_page: "30",
    });
    const { items } = await this.github(`search/issues?${query}`);
    const existing = items.find((issue) => {
      return (issue.body || "").includes(REPORT_MARKER);
    });
    const issue = existing
      ? await this.github(`repos/${REPOSITORY}/issues/${existing.number}`, "PATCH", { body })
      : await this.github(`repos/${REPOSITORY}/issues`, "POST", { title: "[Sentry] Daily investigation", body });
    console.log(`Daily investigation: ${issue.html_url}`);
  }
}
