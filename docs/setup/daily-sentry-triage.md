# Daily Sentry investigation

The `Daily Sentry investigation` workflow in `vbuch/oboapp` runs once a day at
17:17 UTC. That is 19:17 in Sofia during winter and 20:17 during summer. A manual
run is available through Actions after the workflow reaches `main`.

The pilot collects production issues seen in the preceding 30 hours from the
`ingest`, `oboapp-web`, and `public-api` Sentry projects. The overlap accommodates
normal schedule delays. A single rolling `[Sentry] Daily investigation` GitHub
issue holds the latest report and links the relevant existing upstream issues.
Actions artifacts retain each run's evidence, report, and patch for seven days.

## Enable the pilot

Configure these repository settings in `vbuch/oboapp`:

| Setting | Type | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Secret | OpenAI API access for the Codex action. A Copilot subscription is not required. |
| `SENTRY_TRIAGE_TOKEN` | Secret | Dedicated Sentry token with project, event, and organization read access for all three projects. The existing source-map upload token may have different scopes. |
| `SENTRY_TRIAGE_ENABLED` | Variable | Set to `true` after configuring the credentials. Scheduled runs otherwise skip the pilot. |
| `SENTRY_TRIAGE_MODEL` | Optional variable | An available OpenAI model ID. Empty uses the Codex CLI default. |
| `SENTRY_TRIAGE_GCP_SERVICE_ACCOUNT` | Optional variable | A dedicated service account with Cloud Logging viewer and Cloud Run viewer roles. |

The optional cloud identity uses the existing `GCP_WORKLOAD_IDENTITY_PROVIDER`
and `GCP_PROJECT_ID` secrets. Grant the GitHub workload identity principal access
to impersonate the dedicated read-only service account. Keep deployment
credentials separate. The job reads logs and describes existing executions.
Without this identity, recovery is explicitly unknown; Codex cannot classify a
failure as recovered from local HTTP success or the absence of another alert.

Allow GitHub Actions to create pull requests in repository settings. The default
workflow token can create the draft PR, but its branch push does not start another
GitHub Actions workflow. The separate validation job runs the required checks
before publication. Run normal PR CI manually when reviewing the draft, or add a
separately reviewed GitHub App integration if automatic PR CI is needed.

Set `SENTRY_TRIAGE_ENABLED` to `false` to stop scheduled investigations. Manual
runs still require the credentials. The workflow is restricted to this fork and
the `main` branch, so upstream or other forks do not inherit an active schedule.

## Investigation and draft PRs

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

Codex researches public sources and prepares at most one focused application
patch. It has no Sentry, cloud, database, or repository write credentials. Source
provider code belongs in `oboapp/sources`; this pilot reports proposed provider
repairs with upstream issue links and opens draft PRs only in `vbuch/oboapp`.
It never publishes source packages or changes production infrastructure.

A fresh runner validates the structured report, patch paths, size, and ownership.
For a patch it installs locked dependencies, builds shared/db, runs ingest/web
lint and TypeScript checks, and runs all workspace tests. Publication runs on a
third fresh runner with repository write permissions and no OpenAI key. It opens
a draft PR on a descriptive `automation/sentry-fix-*` branch and leaves merging
to review. An existing open PR for the same incident set is reused without
changing its branch. Validation failure leaves artifacts available in Actions
and stops publication.

The canonical prompt is
`agent-context/.apm/prompts/daily-sentry-triage.prompt.md`. After changing it, run
`pnpm apm:install` and commit the generated prompt copies and lockfile together.

## Local checks

Run `node --test .github/scripts/sentry-triage.test.mjs` for the collector and
publication boundary regressions. The workflow uses Node.js 20 and its built-in
`fetch`, filesystem, crypto, process, and test APIs. Collection and publication
need no package installation.

References: [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action),
[patch generation and PR publication](https://learn.chatgpt.com/docs/non-interactive-mode).
