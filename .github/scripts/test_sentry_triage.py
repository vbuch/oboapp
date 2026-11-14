import copy
from email.message import Message
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location("triage", Path(__file__).with_name("sentry_triage.py"))
triage = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(triage)


class SentryTriageTests(unittest.TestCase):
    def setUp(self):
        self.evidence = {"incidents": [{"id": "123", "investigate": True, "cloud": {"status": "failed"}}]}
        self.report = {
            "summary": "One source failed.",
            "findings": [{"incidentId": "123", "classification": "actionable",
                          "diagnosis": "The provider changed its page.", "nextSteps": "Update discovery."}],
            "fix": {"propose": False, "title": "", "body": "", "incidentIds": []},
        }

    def test_sentry_pagination_follows_next_cursor_without_dropping_filters(self):
        headers = Message()
        headers["Link"] = '<https://sentry.io/api/>; rel="next"; results="true"; cursor="page-2"'
        with patch.object(triage, "request_json", side_effect=[([{"id": "1"}], headers), ([{"id": "2"}], Message())]) as request:
            result = triage.paged_sentry("projects/oboapp/ingest/issues/", {"environment": "production"}, "secret")
        self.assertEqual(result, [{"id": "1"}, {"id": "2"}])
        self.assertIn("cursor=page-2", request.call_args_list[1].args[0])
        self.assertIn("environment=production", request.call_args_list[1].args[0])

    def test_pagination_cap_refuses_incomplete_evidence(self):
        headers = Message()
        headers["Link"] = 'rel="next"; results="true"; cursor="more"'
        with patch.object(triage, "request_json", return_value=([{"id": "1"}], headers)):
            with self.assertRaisesRegex(RuntimeError, "incomplete"):
                triage.paged_sentry("projects/oboapp/ingest/issues/", {}, "secret")

    def test_collection_uses_supported_sentry_period_and_iso_search_time(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(triage, "OUTPUT", Path(directory)):
                with patch.dict(os.environ, {"SENTRY_TRIAGE_TOKEN": "secret", "GITHUB_OUTPUT": str(Path(directory) / "outputs")}):
                    with patch.object(triage, "paged_sentry", return_value=[]) as sentry:
                        with patch.object(triage, "github", return_value=[]):
                            triage.collect()
        for call in sentry.call_args_list:
            self.assertIn(call.args[1]["statsPeriod"], {"", "24h", "14d"})
            self.assertRegex(call.args[1]["query"], r"^lastSeen:>=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")

    def test_source_identity_survives_crawler_to_source_log_rename(self):
        for prefix in ["Crawler", "Source"]:
            self.assertEqual(triage.source_from_event(f"{prefix} lozenets-sofia-bg failed: fetch failed", {}), "lozenets-sofia-bg")

    def test_unknown_recovery_cannot_be_reported_as_success(self):
        self.report["findings"][0]["classification"] = "recovered"
        for status in ["unavailable", "unknown", "pending", "failed"]:
            self.evidence["incidents"][0]["cloud"]["status"] = status
            with self.assertRaisesRegex(ValueError, "Recovery requires"):
                triage.validate_report(self.report, self.evidence)
        self.evidence["incidents"][0]["cloud"]["status"] = "recovered"
        triage.validate_report(self.report, self.evidence)

    def test_externally_owned_incident_cannot_be_investigated_or_fixed(self):
        self.evidence["incidents"][0]["investigate"] = False
        with self.assertRaisesRegex(ValueError, "externally owned"):
            triage.validate_report(self.report, self.evidence)
        self.report["findings"][0]["classification"] = "known"
        triage.validate_report(self.report, self.evidence)
        self.report["fix"] = {"propose": True, "title": "Change", "body": "Details", "incidentIds": ["123"]}
        with self.assertRaisesRegex(ValueError, "externally owned"):
            triage.validate_report(self.report, self.evidence)

    def test_missing_duplicate_and_fabricated_findings_are_rejected(self):
        for findings in [[], self.report["findings"] * 2,
                         [{**self.report["findings"][0], "incidentId": "999"}]]:
            report = copy.deepcopy(self.report)
            report["findings"] = findings
            with self.assertRaises(ValueError):
                triage.validate_report(report, self.evidence)

    def test_recovered_incident_cannot_justify_a_patch(self):
        self.evidence["incidents"][0]["cloud"]["status"] = "recovered"
        self.report["findings"][0]["classification"] = "recovered"
        self.report["fix"] = {"propose": True, "title": "Change", "body": "Details", "incidentIds": ["123"]}
        with self.assertRaisesRegex(ValueError, "actionable"):
            triage.validate_report(self.report, self.evidence)

    def test_protected_paths_and_mladost_are_rejected(self):
        for path in [".github/workflows/deploy.yml", "AGENTS.md", "web/.env.local", "ingest/terraform/main.tf",
                     "../web/lib/api.ts", "web/lib/../secret", "web\\lib\\api.ts", "/web/lib/api.ts",
                     "web//lib/api.ts", "web/lib/.env", "ingest/crawlers/mladost-bg/index.ts"]:
            with self.subTest(path=path):
                self.assertFalse(triage.allowed_patch_path(path))
        self.assertTrue(triage.allowed_patch_path("ingest/crawlers/lozenets-sofia-bg/index.contract.test.ts"))
        self.assertTrue(triage.allowed_patch_path("web/lib/error-reporting.ts"))

    def test_redaction_removes_identity_and_url_credentials(self):
        result = triage.redact({"email": "owner@example.com", "ip_address": "192.0.2.1",
                               "message": "owner@example.com from 192.0.2.1 https://user:pass@example.com/feed?api_key=secret"})
        self.assertNotIn("email", result)
        self.assertNotIn("ip_address", result)
        for secret in ["owner@example.com", "192.0.2.1", "user:pass", "=secret"]:
            self.assertNotIn(secret, result["message"])

    def test_api_credentials_cannot_be_sent_to_other_origins(self):
        with self.assertRaisesRegex(ValueError, "origin"):
            triage.request_json("https://example.com/api", "secret")
        with self.assertRaisesRegex(RuntimeError, "redirects"):
            triage.NoRedirect().redirect_request(None, None, 302, "", {}, "https://example.com")

    def test_recovery_is_correlated_to_the_failing_execution(self):
        entries = [{"severity": "ERROR", "timestamp": "2026-11-14T08:01:00Z",
                    "jsonPayload": {"source": "lozenets-sofia-bg"},
                    "labels": {"run.googleapis.com/execution_name": "crawl-lozenets-original"}}]
        details = {"status": {"conditions": [{"type": "Completed", "status": "True"}], "retriedCount": 1}}
        with patch.dict(triage.os.environ, {"TRIAGE_CLOUD_LOGS": "true", "GCP_PROJECT_ID": "example"}):
            with patch.object(triage, "run", side_effect=[triage.json.dumps(entries), triage.json.dumps(details)]) as run:
                result = triage.cloud_evidence("lozenets-sofia-bg", "2026-11-14T08:01:00Z", "2026-11-13T00:00:00Z")
        self.assertEqual(result["status"], "recovered")
        self.assertIn("crawl-lozenets-original", run.call_args_list[1].args)

    def test_bundle_and_validation_preserve_a_new_regression_test(self):
        self.report["fix"] = {"propose": True, "title": "Fix", "body": "Details", "incidentIds": ["123"]}
        with tempfile.TemporaryDirectory() as directory:
            checkout = Path(directory) / "repo"
            checkout.mkdir()
            artifacts = Path(directory) / "artifacts"
            with patch.object(triage, "OUTPUT", artifacts):
                with patch.dict(os.environ, {"GITHUB_OUTPUT": str(Path(directory) / "outputs")}):
                    original_cwd = Path.cwd()
                    try:
                        os.chdir(checkout)
                        triage.run("git", "init", "-q")
                        triage.run("git", "config", "core.autocrlf", "false")
                        source = Path("web/lib/example.ts")
                        source.parent.mkdir(parents=True)
                        source.write_text("export const value = 1;\n", encoding="utf-8", newline="\n")
                        triage.run("git", "add", ".")
                        triage.run("git", "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "Base")
                        regression = Path("web/lib/example.test.ts")
                        regression.write_text("// New regression\n", encoding="utf-8", newline="\n")
                        triage.bundle()
                        self.assertIn("example.test.ts", (artifacts / "fix.patch").read_text(encoding="utf-8"))
                        regression.unlink()
                        triage.run("git", "reset", "--quiet", "HEAD")
                        (artifacts / "report.json").write_text(json.dumps(self.report), encoding="utf-8")
                        (artifacts / "evidence.json").write_text(json.dumps(self.evidence), encoding="utf-8")
                        triage.validate()
                        self.assertEqual(regression.read_text(encoding="utf-8"), "// New regression\n")
                    finally:
                        os.chdir(original_cwd)

    def test_existing_open_fix_pr_is_reused_without_changing_its_branch(self):
        self.report["fix"] = {"propose": True, "title": "Fix", "body": "Details", "incidentIds": ["123"]}
        key = triage.hashlib.sha256(b"123").hexdigest()[:12]
        open_pr = {"html_url": "https://github.com/vbuch/oboapp/pull/999", "body": f"<!-- sentry-fix:{key} -->"}
        existing_report = {"number": 10, "body": triage.REPORT_MARKER}
        with tempfile.TemporaryDirectory() as directory:
            artifacts = Path(directory)
            (artifacts / "report.json").write_text(json.dumps(self.report), encoding="utf-8")
            (artifacts / "evidence.json").write_text(json.dumps(self.evidence), encoding="utf-8")
            with patch.object(triage, "OUTPUT", artifacts):
                with patch.dict(os.environ, {"GITHUB_REPOSITORY": "vbuch/oboapp"}):
                    with patch.object(triage, "github", side_effect=[[open_pr], {"items": [existing_report]}, {"html_url": "report"}]) as github:
                        with patch.object(triage, "render_report", return_value="Updated report"):
                            with patch.object(triage, "run") as git:
                                triage.publish()
                                git.assert_not_called()
        self.assertEqual(github.call_args.args, ("repos/vbuch/oboapp/issues/10", "PATCH", {"body": "Updated report"}))


if __name__ == "__main__":
    unittest.main()
