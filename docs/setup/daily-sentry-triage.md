# Daily Sentry investigation

The `Daily Sentry investigation` workflow in `vbuch/oboapp` runs once a day at
17:17 UTC. That is 19:17 in Sofia during winter and 20:17 during summer. A manual
run is available through Actions after the workflow reaches `main`.

The pilot collects production issues seen in the preceding 30 hours from the
`ingest`, `oboapp-web`, and `public-api` Sentry projects. The overlap accommodates
normal schedule delays. A single rolling `[Sentry] Daily investigation` GitHub
issue holds the latest report and links the relevant existing upstream issues.
Focused implementation issues describe new actionable work. Actions artifacts
retain each run's evidence, report, and token usage for seven days.

## Enable the pilot

Configure these repository settings in `vbuch/oboapp`:

| Setting | Type | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Secret | OpenAI Responses API access for the investigation agent. |
| `SENTRY_TRIAGE_TOKEN` | Secret | Dedicated Sentry token with project, event, and organization read access for all three projects. The existing source-map upload token may have different scopes. |
| `SENTRY_TRIAGE_ENABLED` | Variable | Set to `true` after configuring the credentials. Scheduled runs otherwise skip the pilot. |
| `SENTRY_TRIAGE_MODEL` | Optional variable | A general Responses API model supporting web search, function tools, and structured output. Empty uses `gpt-5.4`. |
| `SENTRY_TRIAGE_GCP_SERVICE_ACCOUNT` | Optional variable | A dedicated service account with Cloud Logging viewer and Cloud Run viewer roles. |

The optional cloud identity uses the existing `GCP_WORKLOAD_IDENTITY_PROVIDER`
and `GCP_PROJECT_ID` secrets. Grant the GitHub workload identity principal access
to impersonate the dedicated read-only service account. Keep deployment
credentials separate. The job reads logs and describes existing executions.
Without this identity, recovery is explicitly unknown; the agent cannot classify a
failure as recovered from local HTTP success or the absence of another alert.

The investigation calls the Responses API directly. The ChatGPT API credits
benefit covers standard Responses API requests and built-in tools. That benefit
excludes Codex usage through API keys, so this workflow uses no Codex CLI or
Codex GitHub Action. Check the API organization's credits and model access before
enabling the schedule.

Publication uses the workflow token with `contents: read` and `issues: write`.
It creates or updates GitHub issues. Implementation starts when you hand one of
those issues to an agent. The repository's Actions PR-creation setting can stay
disabled.

Set `SENTRY_TRIAGE_ENABLED` to `false` to stop scheduled investigations. Manual
runs still require the credentials. The workflow is restricted to this fork and
the `main` branch, so upstream or other forks do not inherit an active schedule.

## Investigation and implementation issues

The evidence collector reads related issues in `oboapp/oboapp` and
`vbuch/oboapp`, including closed matches. It preserves the original Sentry group
and source identity. The source is taken from event context or the old and new
`Crawler ... failed` / `Source ... failed` messages.

When Cloud Logging is configured, the collector matches the Sentry failure to
its Cloud Run execution and reads that execution's final status. An automatic
retry that succeeded is classified separately from a failed final execution.
The current source-to-job mapping comes from
`ingest/terraform/source-jobs.bg.sofia.json`.

Known ownership and issue links live in `.github/sentry-triage.json`. Mladost is
excluded from investigation while a separate agent handles #677. Pancharevo
links #687; Lozenets links #688 and potentially related #451. Update the config
when ownership changes.

The Responses API agent researches public sources and prepares up to five
focused implementation issues. Its tools read and search tracked repository
files, fetch public GitHub content, and search the web. The investigation leaves
the checkout unchanged and cannot execute commands.

The investigation has no Sentry, cloud, database, or repository write
credentials. Source provider code belongs in `oboapp/sources`; this pilot reports
proposed provider repairs with upstream issue links and publishes issues only in
`vbuch/oboapp`. Provider-package tasks identify `oboapp/sources` as their intended
implementation repository.

A fresh runner validates the report's structure, incident coverage, and task
ownership. Only actionable incidents that this pilot owns can receive follow-up
issues. Publication runs on another fresh runner with issue-write permission and
no OpenAI key.

Each follow-up includes the failure trigger, observed and expected behavior,
evidence and related links, intended repository and files, proposed steps,
acceptance criteria, regression-test suggestions, verification commands, and
remaining blockers. Existing upstream issues and open PRs remain linked context;
the agent avoids creating duplicate implementation tasks for work already owned.

Follow-up issues use stable keys and Sentry incident IDs for deduplication.
Existing follow-ups are included in the next investigation's evidence. Human
text outside the issue's managed investigation section is preserved, and closed
issues stay closed. The rolling daily report links the resulting tasks.
Validation failure retains the artifacts and stops publication.

The canonical prompt is
`agent-context/.apm/prompts/daily-sentry-triage.prompt.md`. After changing it, run
`pnpm apm:install` and commit the generated prompt copies and lockfile together.

## Local checks

Run `node --test .github/scripts/sentry-triage.test.mjs .github/scripts/sentry-investigation.test.mjs`
for the collector, investigation, and publication boundary regressions. The
workflow uses Node.js 20 and its built-in `fetch`, filesystem, crypto, process,
and test APIs. Collection, investigation, and publication need no package
installation.

References: [Responses API function calling](https://developers.openai.com/api/docs/guides/function-calling),
[web search](https://developers.openai.com/api/docs/guides/tools-web-search), and
[ChatGPT API credits benefit](https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions).
