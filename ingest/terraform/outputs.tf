output "service_account_email" {
  description = "Email of the service account used for running jobs"
  value       = google_service_account.ingest_runner.email
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository name"
  value       = google_artifact_registry_repository.ingest.name
}

output "container_image_url" {
  description = "Full URL for pushing container images with automatic cleanup"
  value       = local.full_image_url
}

output "crawler_jobs" {
  description = "Cloud Run Job names for crawlers"
  value       = { for k, v in google_cloud_run_v2_job.crawlers : k => v.name }
}

output "ingest_job" {
  description = "Cloud Run Job name for ingestion"
  value       = google_cloud_run_v2_job.ingest.name
}

output "notify_job" {
  description = "Cloud Run Job name for notifications"
  value       = google_cloud_run_v2_job.notify.name
}

output "scheduler_jobs" {
  description = "Cloud Scheduler job names"
  value = merge(
    { for k, v in google_cloud_scheduler_job.crawler_schedules : k => v.name },
    {
      ingest = google_cloud_scheduler_job.ingest_schedule.name
      notify = google_cloud_scheduler_job.notify_schedule.name
    }
  )
}

output "next_steps" {
  description = "Next steps after deployment"
  value = <<-EOT
  
  ✅ Infrastructure deployed successfully!
  
  Next steps:
  1. Build and push Docker image:
     gcloud builds submit --tag ${var.image_registry}/${var.project_id}/${var.image_name}:${var.image_tag}
  
  2. Test a job manually:
     gcloud run jobs execute crawl-rayon-oborishte --region=${var.region}
  
  3. View logs:
     gcloud logging read "resource.type=cloud_run_job" --limit=20
  
  4. Monitor schedules:
     gcloud scheduler jobs list --location=${var.region}
  
  EOT
}
