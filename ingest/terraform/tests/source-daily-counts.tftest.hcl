mock_provider "google" {}

variables {
  project_id               = "test-ingest-project"
  firebase_project_id      = "test-ingest-project"
  alert_email              = "alerts@example.com"
  ci_service_account_email = "ci@test-ingest-project.iam.gserviceaccount.com"
  app_url                  = "https://example.com"
}

run "daily_toplo_count_uses_sofia_night_schedule" {
  command = plan

  variables {
    schedule_timezone = "UTC"
    crawlers = {
      toplo = { source = "toplo-bg", emergent = true }
    }
  }

  assert {
    condition     = google_cloud_scheduler_job.source_daily_counts_schedule[0].schedule == "0 23 * * *" && google_cloud_scheduler_job.source_daily_counts_schedule[0].time_zone == "Europe/Sofia"
    error_message = "Toplo daily dates must use the 23:00 Sofia schedule even when other pipeline jobs use a different timezone."
  }

  assert {
    condition     = one(one(google_cloud_run_v2_job.source_daily_counts[0].template).template).containers[0].args == tolist(["node", "dist/source-daily-counts.js"])
    error_message = "The nightly job must execute the built count recorder."
  }
}

run "daily_count_job_requires_toplo_source" {
  command = plan

  variables {
    crawlers = {
      other = { source = "sofia-bg" }
    }
  }

  assert {
    condition     = length(google_cloud_run_v2_job.source_daily_counts) == 0 && length(google_cloud_scheduler_job.source_daily_counts_schedule) == 0
    error_message = "Instances without Toplo must not create a Toplo daily count job."
  }
}
