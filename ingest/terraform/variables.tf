variable "project_id" {
  description = "Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud region for resources"
  type        = string
  default     = "europe-west1"
}

variable "image_registry" {
  description = "Container image registry"
  type        = string
  default     = "gcr.io"
}

variable "image_name" {
  description = "Container image name"
  type        = string
  default     = "oborishte-ingest"
}

variable "image_tag" {
  description = "Container image tag"
  type        = string
  default     = "latest"
}

variable "schedule_timezone" {
  description = "Timezone for scheduler jobs"
  type        = string
  default     = "Europe/Sofia"
}

variable "schedules" {
  description = "Cron schedules for each job (in cron format: minute hour day month weekday)"
  type = object({
    crawl_rayon_oborishte = string
    crawl_sofia           = string
    crawl_sofiyska_voda   = string
    crawl_toplo           = string
    ingest                = string
    notify                = string
  })
  default = {
    crawl_rayon_oborishte = "0 6 * * *"  # Daily at 6:00 AM
    crawl_sofia           = "0 7 * * *"  # Daily at 7:00 AM
    crawl_sofiyska_voda   = "0 8 * * *"  # Daily at 8:00 AM
    crawl_toplo           = "0 9 * * *"  # Daily at 9:00 AM
    ingest                = "0 10 * * *" # Daily at 10:00 AM
    notify                = "0 11 * * *" # Daily at 11:00 AM
  }
}

variable "firebase_project_id" {
  description = "Firebase project ID (can be public)"
  type        = string
}
