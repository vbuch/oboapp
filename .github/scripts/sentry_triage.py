"""Collect bounded incident evidence and publish the daily Codex pilot results.

Uses standard-library modules so collection and publication need no repository
dependency install. TRIAGE_PHASE selects collect, bundle, validate, or publish.
"""

import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
from urllib.error import HTTPError
from urllib.parse import urlencode, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


REPOSITORY = "vbuch/oboapp"
REPORT_MARKER = "<!-- daily-sentry-triage -->"
CONFIG_PATH = Path(".github/sentry-triage.json")
OUTPUT = Path(os.environ.get("TRIAGE_DIRECTORY", "tmp/sentry-triage"))
CLASSIFICATIONS = {"actionable", "recovered", "known", "needs-investigation"}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("API redirects are refused to protect credentials")


def redact(value):
    if isinstance(value, dict):
        return {
            key: redact(item)
            for key, item in value.items()
            if key.lower() not in {"email", "ip", "ip_address", "authorization", "cookie"}
        }
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, str):
        value = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[REDACTED_EMAIL]", value)
        value = re.sub(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", "[REDACTED_IP]", value)
        value = re.sub(r"(?i)(https?://)[^/\s]+@", r"\1[REDACTED]@", value)
        value = re.sub(r"(?i)([?&](?:token|key|secret|password|api_key|access_token)=)[^&\s]+", r"\1[REDACTED]", value)
        return value
    return value


def request_json(url, token, method="GET", body=None):
    # Credentials only go to the fixed API origins selected by this script.
    if urlparse(url).hostname not in {"sentry.io", "api.github.com"}:
        raise ValueError("Unexpected API origin")
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    for attempt in range(3):
        try:
            with build_opener(NoRedirect).open(
                Request(url, data=data, headers=headers, method=method), timeout=30
            ) as response:
                return json.load(response), response.headers
        except HTTPError as error:
            if method == "GET" and error.code in {429, 500, 502, 503, 504} and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            # Error response bodies may contain provider data or credentials.
            raise RuntimeError(f"{method} {urlparse(url).path}: HTTP {error.code}") from None
    raise RuntimeError("API request exhausted retries")


def paged_sentry(path, params, token):
    cursor = None
    items = []
    for _ in range(8):
        page_params = {**params, "per_page": 50}
        if cursor:
            page_params["cursor"] = cursor
        data, headers = request_json(f"https://sentry.io/api/0/{path}?{urlencode(page_params)}", token)
        items.extend(data)
        next_page = next((part for part in headers.get("Link", "").split(",")
                          if 'rel="next"' in part and 'results="true"' in part), "")
        match = re.search(r'cursor="([^"]+)"', next_page)
        if not match:
            return items
        cursor = match.group(1)
    raise RuntimeError("Sentry pagination limit reached; refusing an incomplete investigation")


def github(path, method="GET", body=None):
    return request_json(f"https://api.github.com/{path}", os.environ["GH_TOKEN"], method, body)[0]


def run(*args):
    executable = shutil.which(args[0]) or args[0]
    return subprocess.check_output([executable, *args[1:]], text=True, encoding="utf-8", timeout=120)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(redact(value), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def source_from_event(title, context):
    source = context.get("source") or context.get("sourceType")
    if isinstance(source, str) and re.fullmatch(r"[a-z0-9-]+", source):
        return source
    match = re.match(r"(?:Source|Crawler) ([a-z0-9-]+) failed", title)
    return match.group(1) if match else None


def related_issues(source, config, short_id):
    matches = {}
    for url in config["knownSources"].get(source, {}).get("issues", []):
        path = url.removeprefix("https://github.com/")
        issue = github(f"repos/{path}")
        matches[url] = issue
    repositories = " ".join(f"repo:{repo}" for repo in config["issueRepositories"])
    terms = f'"{source}" OR "{short_id}"' if source else f'"{short_id}"'
    query = urlencode({"q": f'{repositories} is:issue ({terms})', "per_page": 10})
    for issue in github(f"search/issues?{query}")["items"]:
        matches[issue["html_url"]] = issue
    result = []
    for issue in matches.values():
        result.append({
            "url": issue["html_url"], "title": issue["title"], "state": issue["state"],
            "body": (issue.get("body") or "")[:16000],
        })
    return result


def cloud_evidence(source, event_time, since):
    if os.environ.get("TRIAGE_CLOUD_LOGS") != "true" or not source:
        return {"status": "unavailable", "reason": "Read-only Cloud Logging access is not configured"}
    job_map = json.loads(Path("ingest/terraform/source-jobs.bg.sofia.json").read_text(encoding="utf-8"))
    job = next((f"crawl-{key}" for key, value in job_map.items() if value["source"] == source), None)
    if not job:
        return {"status": "unavailable", "reason": "Source has no mapped Cloud Run job"}
    project = os.environ["GCP_PROJECT_ID"]
    log_filter = (f'resource.type="cloud_run_job" AND resource.labels.job_name="{job}" '
                  f'AND timestamp>="{since}" AND (severity>=ERROR OR jsonPayload.message:*)')
    entries = json.loads(run("gcloud", "logging", "read", log_filter,
                             f"--project={project}", "--limit=200", "--format=json"))
    # Match the Sentry error to its execution, rather than a different later run.
    failures = [entry for entry in entries if entry.get("severity") == "ERROR"
                and entry.get("jsonPayload", {}).get("source") == source]
    expected_time = dt.datetime.fromisoformat(event_time.replace("Z", "+00:00"))
    nearby = [entry for entry in failures
              if abs((dt.datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00"))
                      - expected_time).total_seconds()) < 5]
    if not nearby:
        return {"status": "unknown", "reason": "No matching execution found", "truncated": len(entries) == 200}
    execution = nearby[0].get("labels", {}).get("run.googleapis.com/execution_name")
    if not execution or not re.fullmatch(r"[a-z0-9-]+", execution):
        return {"status": "unknown", "reason": "Execution identifier is absent"}
    details = json.loads(run("gcloud", "run", "jobs", "executions", "describe", execution,
                             f"--project={project}", "--region=europe-west1", "--format=json"))
    status = details.get("status", {})
    completed = next((condition for condition in status.get("conditions", [])
                      if condition["type"] == "Completed"), {})
    outcome = {"True": "recovered", "False": "failed"}.get(completed.get("status"), "pending")
    return {"status": outcome, "execution": execution, "completed": completed,
            "retriedCount": status.get("retriedCount", 0),
            "completionTime": status.get("completionTime")}


def collect():
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    now = dt.datetime.now(dt.timezone.utc)
    since = (now - dt.timedelta(hours=config["lookbackHours"])).strftime("%Y-%m-%dT%H:%M:%SZ")
    token = os.environ["SENTRY_TRIAGE_TOKEN"]
    if not token:
        raise RuntimeError("Configure the read-only SENTRY_TRIAGE_TOKEN secret")
    incidents = []
    context_cache = {}
    for project in config["projects"]:
        issues = paged_sentry(f'projects/{config["organization"]}/{project}/issues/', {
            "query": f"lastSeen:>={since}", "sort": "date", "statsPeriod": "14d",
            "environment": config["environment"],
        }, token)
        for issue in issues:
            if dt.datetime.fromisoformat(issue["lastSeen"].replace("Z", "+00:00")) < dt.datetime.fromisoformat(since):
                continue
            events, _ = request_json(
                f'https://sentry.io/api/0/organizations/{config["organization"]}/issues/{issue["id"]}/events/?'
                + urlencode({"per_page": 1, "environment": config["environment"]}), token)
            if not events:
                continue
            event_id = events[0]["eventID"]
            event, _ = request_json(
                f'https://sentry.io/api/0/projects/{config["organization"]}/{project}/events/{event_id}/', token)
            context = event.get("context") or {}
            source = source_from_event(issue["title"], context)
            policy = config["knownSources"].get(source, {})
            context_key = (source, issue["shortId"])
            if context_key not in context_cache:
                context_cache[context_key] = related_issues(source, config, issue["shortId"])
            exceptions = []
            for entry in event.get("entries", []):
                if entry.get("type") == "exception":
                    for value in entry.get("data", {}).get("values", []):
                        exceptions.append({
                            "type": value.get("type"), "value": value.get("value"),
                            "frames": [{key: frame.get(key) for key in ["filename", "function", "lineNo"]}
                                       for frame in (value.get("stacktrace") or {}).get("frames", [])[-5:]],
                        })
            incident = {"id": issue["id"], "project": project, "shortId": issue["shortId"],
                        "title": issue["title"], "status": issue["status"], "url": issue["permalink"],
                        "firstSeen": issue["firstSeen"], "lastSeen": issue["lastSeen"],
                        "lifetimeCount": issue["count"], "eventId": event_id,
                        "source": source, "release": event.get("release"),
                        "investigate": policy.get("investigate", True), "policy": policy.get("reason"),
                        "exceptions": exceptions[:5], "relatedIssues": context_cache[context_key]}
            try:
                incident["cloud"] = cloud_evidence(source, event["dateCreated"], since)
            except (OSError, RuntimeError, subprocess.SubprocessError) as error:
                incident["cloud"] = {"status": "unavailable", "reason": redact(str(error))[:500]}
            incidents.append(incident)
    open_prs = github(f"repos/{REPOSITORY}/pulls?state=open&per_page=100")
    evidence = {"generatedAt": now.isoformat(), "since": since, "incidents": incidents,
                "openPullRequests": [{"url": pr["html_url"], "title": pr["title"],
                                      "body": (pr.get("body") or "")[:8000]} for pr in open_prs]}
    write_json(OUTPUT / "evidence.json", evidence)
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write(f"has_work={str(any(item['investigate'] for item in incidents)).lower()}\n")
    print(f"Collected {len(incidents)} recent Sentry issues")


def allowed_patch_path(path):
    if path.startswith("/") or "\\" in path or any(part in {"", ".", ".."} for part in path.split("/")):
        return False
    if any(part.startswith(".") for part in path.split("/")):
        return False
    if "/mladost-bg/" in path:
        return False
    if path in {"pnpm-lock.yaml", "ingest/package.json", "ingest/source-package-policy.json"}:
        return True
    return path.startswith(("api/src/", "db/src/", "shared/src/", "web/app/", "web/components/",
                            "web/lib/", "web/hooks/", "ingest/lib/", "ingest/sources/",
                            "ingest/crawlers/", "ingest/messageIngest/", "ingest/geocoding/"))


def validate_report(report, evidence):
    if set(report) != {"summary", "findings", "fix"} or not isinstance(report["summary"], str):
        raise ValueError("Invalid report structure")
    if not isinstance(report["findings"], list) or len(report["findings"]) > 100:
        raise ValueError("Invalid findings")
    incidents = {item["id"]: item for item in evidence["incidents"]}
    for finding in report["findings"]:
        if set(finding) != {"incidentId", "classification", "diagnosis", "nextSteps"}:
            raise ValueError("Invalid finding structure")
        incident = incidents.get(finding["incidentId"])
        if not incident or finding["classification"] not in CLASSIFICATIONS:
            raise ValueError("Finding references an unknown incident or classification")
        if not all(isinstance(finding[key], str) for key in ["diagnosis", "nextSteps"]):
            raise ValueError("Finding text must be a string")
        if finding["classification"] == "recovered" and incident["cloud"]["status"] != "recovered":
            raise ValueError("Recovery requires a successful matching Cloud Run execution")
        if not incident["investigate"] and finding["classification"] != "known":
            raise ValueError("An externally owned incident must remain classified as known")
    if (len(report["findings"]) != len(incidents)
            or len({item["incidentId"] for item in report["findings"]}) != len(incidents)):
        raise ValueError("Report must cover every incident exactly once")
    fix = report["fix"]
    if set(fix) != {"propose", "title", "body", "incidentIds"} or type(fix["propose"]) is not bool:
        raise ValueError("Invalid fix structure")
    if not isinstance(fix["title"], str) or not isinstance(fix["body"], str):
        raise ValueError("Invalid fix text")
    if not isinstance(fix["incidentIds"], list):
        raise ValueError("Invalid fix incident IDs")
    if fix["propose"]:
        if not fix["title"].strip() or not fix["body"].strip() or not fix["incidentIds"]:
            raise ValueError("A proposed fix needs a title, evidence, and incident IDs")
        for identifier in fix["incidentIds"]:
            incident = incidents.get(identifier)
            if not incident or not incident["investigate"]:
                raise ValueError("Fix targets an unknown or externally owned incident")
        if any(finding["classification"] != "actionable" for finding in report["findings"]
               if finding["incidentId"] in fix["incidentIds"]):
            raise ValueError("A fix requires actionable findings")
    if len(json.dumps(report)) > 45000:
        raise ValueError("Report is too large")


def bundle():
    # The caller stores artifacts outside the checkout, so they cannot enter the patch.
    run("git", "add", "--intent-to-add", "--all")
    patch = subprocess.check_output(["git", "diff", "--binary", "HEAD"], timeout=30)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "fix.patch").write_bytes(patch)
    (OUTPUT / "base-sha").write_text(run("git", "rev-parse", "HEAD").strip(), encoding="utf-8")


def validate():
    report = json.loads((OUTPUT / "report.json").read_text(encoding="utf-8"))
    evidence = json.loads((OUTPUT / "evidence.json").read_text(encoding="utf-8"))
    validate_report(report, evidence)
    patch = OUTPUT / "fix.patch"
    has_patch = bool(patch.stat().st_size)
    if has_patch != report["fix"]["propose"]:
        raise ValueError("Patch and proposed-fix status disagree")
    if has_patch:
        if patch.stat().st_size > 500000:
            raise ValueError("Patch exceeds the pilot's 500 KB limit")
        run("git", "apply", "--check", str(patch))
        run("git", "apply", "--index", str(patch))
        paths = run("git", "diff", "--cached", "--name-only", "-z").rstrip("\0").split("\0")
        if len(paths) > 20 or not all(allowed_patch_path(path) for path in paths):
            raise ValueError("Patch modifies a protected path or exceeds 20 files")
        for line in run("git", "ls-files", "--stage").splitlines():
            if line.split(" ", 1)[0] in {"120000", "160000"} and line.split("\t", 1)[-1] in paths:
                raise ValueError("Symlinks and submodules are not allowed in generated patches")
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write(f"has_patch={str(has_patch).lower()}\n")


def render_report(report, evidence, pr_url=None):
    lines = [REPORT_MARKER, "## Latest daily investigation", "", report["summary"], "",
             f"Evidence collected: {evidence['generatedAt']} (UTC).", ""]
    incidents = {item["id"]: item for item in evidence["incidents"]}
    for finding in report["findings"]:
        incident = incidents[finding["incidentId"]]
        lines.extend([f"### [{incident['shortId']}]({incident['url']}): {finding['classification']}", "",
                      finding["diagnosis"], "", finding["nextSteps"], ""])
        for related in incident["relatedIssues"]:
            lines.append(f"Related: [{related['title']}]({related['url']}) ({related['state']}).")
        lines.append("")
    if pr_url:
        lines.extend([f"Proposed fix: {pr_url}", ""])
    lines.append(f"Workflow: https://github.com/{REPOSITORY}/actions/runs/{os.environ['GITHUB_RUN_ID']}")
    return redact("\n".join(lines))


def publish():
    if os.environ.get("GITHUB_REPOSITORY") != REPOSITORY:
        raise ValueError("Publication is limited to vbuch/oboapp")
    report = json.loads((OUTPUT / "report.json").read_text(encoding="utf-8"))
    evidence = json.loads((OUTPUT / "evidence.json").read_text(encoding="utf-8"))
    validate_report(report, evidence)
    pr_url = None
    if report["fix"]["propose"]:
        # Validation has already run in a separate, credential-free job.
        fix = report["fix"]
        key = hashlib.sha256(",".join(sorted(fix["incidentIds"])).encode()).hexdigest()[:12]
        marker = f"<!-- sentry-fix:{key} -->"
        existing = github(f"repos/{REPOSITORY}/pulls?state=open&per_page=100")
        match = next((pr for pr in existing if marker in (pr.get("body") or "")), None)
        if match:
            pr_url = match["html_url"]
        else:
            branch = f"automation/sentry-fix-{key}-{os.environ['GITHUB_RUN_ID']}"
            run("git", "switch", "-c", branch)
            run("git", "apply", "--index", str(OUTPUT / "fix.patch"))
            run("git", "-c", "user.name=github-actions[bot]", "-c",
                "user.email=41898282+github-actions[bot]@users.noreply.github.com",
                "commit", "-m", "fix: propose correction from daily Sentry investigation")
            run("git", "push", "origin", f"HEAD:refs/heads/{branch}")
            pr = github(f"repos/{REPOSITORY}/pulls", "POST", {
                "head": branch, "base": "main", "title": fix["title"][:200], "draft": True,
                "body": redact(f"{marker}\n\n{fix['body']}\n\nValidated with the required builds, lint, TypeScript checks, and workspace tests.\n\n"
                               "This draft requires review and post-deployment verification."),
            })
            pr_url = pr["html_url"]
    body = render_report(report, evidence, pr_url)
    query = urlencode({"q": f'repo:{REPOSITORY} is:issue is:open "[Sentry] Daily investigation" in:title', "per_page": 30})
    issues = github(f"search/issues?{query}")["items"]
    existing = next((issue for issue in issues if REPORT_MARKER in (issue.get("body") or "")), None)
    if existing:
        issue = github(f"repos/{REPOSITORY}/issues/{existing['number']}", "PATCH", {"body": body})
    else:
        issue = github(f"repos/{REPOSITORY}/issues", "POST", {"title": "[Sentry] Daily investigation", "body": body})
    print(f"Daily investigation: {issue['html_url']}")


if __name__ == "__main__":
    phases = {"collect": collect, "bundle": bundle, "validate": validate, "publish": publish}
    phases[os.environ["TRIAGE_PHASE"]]()
