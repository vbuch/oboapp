locals {
  source_daily_counts_enabled = contains([for crawler in local.crawlers : crawler.source], "toplo-bg")
}

resource "google_cloud_run_v2_job" "source_daily_counts" {
  count    = local.source_daily_counts_enabled ? 1 : 0
  name     = "source-daily-counts"
  location = var.region

  template {
    template {
      service_account = google_service_account.ingest_runner.email
      timeout         = "180s"

      containers {
        image = local.full_image_url
        args  = ["node", "dist/source-daily-counts.js"]

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }

        env {
          name = "FIREBASE_SERVICE_ACCOUNT_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.firebase_sa_key.secret_id
              version = "latest"
            }
          }
        }

        env {
          name  = "FIREBASE_PROJECT_ID"
          value = var.firebase_project_id
        }

        env {
          name  = "LOCALITY"
          value = var.locality
        }
      }

      max_retries = 1
    }
  }

  lifecycle {
    ignore_changes = [launch_stage]
  }

  depends_on = [google_project_service.run]
}

resource "google_cloud_scheduler_job" "source_daily_counts_schedule" {
  count            = local.source_daily_counts_enabled ? 1 : 0
  name             = "source-daily-counts-schedule"
  description      = "Record the latest successful source count for each Sofia day"
  schedule         = var.schedules.source_daily_counts
  time_zone        = "Europe/Sofia"
  attempt_deadline = "180s"
  region           = var.region

  retry_config {
    retry_count = 1
  }

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/source-daily-counts:run"

    oauth_token {
      service_account_email = google_service_account.ingest_runner.email
    }
  }

  depends_on = [
    google_project_service.cloudscheduler,
    google_cloud_run_v2_job.source_daily_counts,
  ]
}

resource "google_monitoring_alert_policy" "source_daily_counts_failures" {
  count        = local.source_daily_counts_enabled ? 1 : 0
  display_name = "Job Failure: Source Daily Counts"
  combiner     = "OR"

  conditions {
    display_name = "source-daily-counts error"
    condition_matched_log {
      filter = "resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"source-daily-counts\" AND severity>=ERROR"
    }
  }

  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]
  documentation {
    content   = "The source-daily-counts job failed. Check its Cloud Run logs and verify that a successful source snapshot exists for the target Sofia day."
    mime_type = "text/markdown"
  }
  depends_on = [google_project_service.monitoring]
}
