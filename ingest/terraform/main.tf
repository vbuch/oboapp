terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Recommended: Store state in GCS for team collaboration and CI/CD
  backend "gcs" {
    bucket = "oborishte-map-terraform-state"
    prefix = "oborishte-ingest"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Computed values
locals {
  full_image_url = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.ingest.repository_id}/${var.image_name}:${var.image_tag}"
}

# Enable required APIs
resource "google_project_service" "run" {
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudbuild" {
  service            = "cloudbuild.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "cloudscheduler" {
  service            = "cloudscheduler.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "firestore" {
  service            = "firestore.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "artifactregistry" {
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}

# Create a new Artifact Registry repository with cleanup policies
resource "google_artifact_registry_repository" "ingest" {
  location      = var.region
  repository_id = "oborishte-ingest"
  description   = "Docker repository for oborishte-ingest container images with automatic cleanup"
  format        = "DOCKER"

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"
    
    condition {
      tag_state  = "UNTAGGED"
      older_than = "86400s"  # Delete untagged images after 1 day
    }
  }

  depends_on = [google_project_service.artifactregistry]
}

# Service Account for running jobs
resource "google_service_account" "ingest_runner" {
  account_id   = "ingest-runner"
  display_name = "Ingestion Pipeline Runner"
  description  = "Service account for running ingestion pipeline jobs"
}

# Grant Firestore access
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.ingest_runner.email}"
}

# Grant Cloud Run Invoker (for scheduler to trigger jobs)
resource "google_project_iam_member" "run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.ingest_runner.email}"
}

# Grant Secret Manager access
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.ingest_runner.email}"
}

# Reference existing secrets (these should be created manually or via setup script)
# We use data sources to reference secrets that should be created before running terraform
data "google_secret_manager_secret" "firebase_sa_key" {
  secret_id = "firebase-service-account-key"
  project   = var.project_id
  
  depends_on = [google_project_service.secretmanager]
}

data "google_secret_manager_secret" "google_ai_api_key" {
  secret_id = "google-ai-api-key"
  project   = var.project_id
  
  depends_on = [google_project_service.secretmanager]
}

data "google_secret_manager_secret" "google_ai_model" {
  secret_id = "google-ai-model"
  project   = var.project_id
  
  depends_on = [google_project_service.secretmanager]
}

data "google_secret_manager_secret" "google_maps_api_key" {
  secret_id = "google-maps-api-key"
  project   = var.project_id
  
  depends_on = [google_project_service.secretmanager]
}

# Cloud Run Jobs
locals {
  crawlers = {
    rayon-oborishte = {
      source       = "rayon-oborishte-bg"
      memory       = "1Gi"
      timeout      = "1800s"
      description  = "Crawl Rayon Oborishte website"
    }
    sofia = {
      source       = "sofia-bg"
      memory       = "1Gi"
      timeout      = "1800s"
      description  = "Crawl Sofia municipality"
    }
    sofiyska-voda = {
      source       = "sofiyska-voda"
      memory       = "512Mi"
      timeout      = "1800s"
      description  = "Crawl Sofiyska Voda"
    }
    toplo = {
      source       = "toplo-bg"
      memory       = "512Mi"
      timeout      = "1800s"
      description  = "Crawl Toplo BG"
    }
    erm-zapad = {
      source       = "erm-zapad"
      memory       = "512Mi"
      timeout      = "1800s"
      description  = "Crawl ERM-Zapad power outages"
    }
    mladost = {
      source       = "mladost-bg"
      memory       = "1Gi"
      timeout      = "1800s"
      description  = "Crawl Mladost district"
    }
    studentski = {
      source       = "studentski-bg"
      memory       = "1Gi"
      timeout      = "1800s"
      description  = "Crawl Studentski district"
    }
    sredec = {
      source       = "sredec-sofia-org"
      memory       = "1Gi"
      timeout      = "1800s"
      description  = "Crawl Sredec district"
    }
  }
}

resource "google_cloud_run_v2_job" "crawlers" {
  for_each = local.crawlers
  
  name     = "crawl-${each.key}"
  location = var.region

  template {
    template {
      service_account = google_service_account.ingest_runner.email
      timeout         = each.value.timeout
      
      containers {
        image = local.full_image_url
        args  = ["npm", "run", "prebuilt:crawl", "--", "--source", each.value.source]
        
        resources {
          limits = {
            cpu    = "1"
            memory = each.value.memory
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }
        
        # Secret environment variables from Secret Manager
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
          name = "GOOGLE_AI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "GOOGLE_AI_MODEL"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_model.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_maps_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        # Public Firebase config (these can be in code or here)
        env {
          name  = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
          value = var.firebase_project_id
        }
        
        env {
          name  = "NEXT_PUBLIC_APP_URL"
          value = "https://oboapp.online"
        }
      }
      
      max_retries = 1
    }
  }

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }

  depends_on = [
    google_project_service.run
  ]
}

resource "google_cloud_run_v2_job" "ingest" {
  name     = "ingest-messages"
  location = var.region

  template {
    template {
      service_account = google_service_account.ingest_runner.email
      timeout         = "1800s"
      
      containers {
        image = local.full_image_url
        args  = ["npm", "run", "prebuilt:ingest"]
        
        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }
        
        # Secret environment variables from Secret Manager
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
          name = "GOOGLE_AI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "GOOGLE_AI_MODEL"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_model.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_maps_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name  = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
          value = var.firebase_project_id
        }
        
        env {
          name  = "NEXT_PUBLIC_APP_URL"
          value = "https://oboapp.online"
        }
      }
      
      max_retries = 1
    }
  }

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }

  depends_on = [
    google_project_service.run
  ]
}

resource "google_cloud_run_v2_job" "notify" {
  name     = "send-notifications"
  location = var.region

  template {
    template {
      service_account = google_service_account.ingest_runner.email
      timeout         = "1800s"
      
      containers {
        image = local.full_image_url
        args  = ["npm", "run", "prebuilt:notify"]
        
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
        
        # Secret environment variables from Secret Manager
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
          name = "GOOGLE_AI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "GOOGLE_AI_MODEL"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_model.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_maps_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name  = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
          value = var.firebase_project_id
        }
        
        env {
          name  = "NEXT_PUBLIC_APP_URL"
          value = "https://oboapp.online"
        }
      }
      
      max_retries = 1
    }
  }

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }

  depends_on = [
    google_project_service.run
  ]
}

# Pipeline Cloud Run Jobs
resource "google_cloud_run_v2_job" "pipeline_emergent" {
  name     = "pipeline-emergent"
  location = var.region

  template {
    template {
      service_account = google_service_account.ingest_runner.email
      timeout         = "2400s"  # 40 minutes for emergent pipeline (3 crawlers + ingest + notify)
      
      containers {
        image = local.full_image_url
        args  = ["npm", "run", "prebuilt:pipeline:emergent"]
        
        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }
        
        # Secret environment variables from Secret Manager
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
          name = "GOOGLE_AI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "GOOGLE_AI_MODEL"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_model.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_maps_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name  = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
          value = var.firebase_project_id
        }
        
        env {
          name  = "NEXT_PUBLIC_APP_URL"
          value = "https://oboapp.online"
        }
      }
      
      max_retries = 1
    }
  }

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }

  depends_on = [
    google_project_service.run
  ]
}

resource "google_cloud_run_v2_job" "pipeline_all" {
  name     = "pipeline-all"
  location = var.region

  template {
    template {
      service_account = google_service_account.ingest_runner.email
      timeout         = "10800s"  # 3 hours for full pipeline (8 crawlers + ingest + notify)
      
      containers {
        image = local.full_image_url
        args  = ["npm", "run", "prebuilt:pipeline:all"]
        
        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }
        
        # Secret environment variables from Secret Manager
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
          name = "GOOGLE_AI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "GOOGLE_AI_MODEL"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_ai_model.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
          value_source {
            secret_key_ref {
              secret  = data.google_secret_manager_secret.google_maps_api_key.secret_id
              version = "latest"
            }
          }
        }
        
        env {
          name  = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
          value = var.firebase_project_id
        }
        
        env {
          name  = "NEXT_PUBLIC_APP_URL"
          value = "https://oboapp.online"
        }
      }
      
      max_retries = 1
    }
  }

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }

  depends_on = [
    google_project_service.run
  ]
}

# Cloud Scheduler Jobs - Pipeline Schedules Only
# Individual crawler, ingest, and notify jobs remain available for manual triggering
resource "google_cloud_scheduler_job" "pipeline_emergent_schedule" {
  name             = "pipeline-emergent-schedule"
  description      = "Run emergent crawlers (ERM, Toplo, Sofiyska Voda) + ingest + notify every 30 minutes"
  schedule         = var.schedules.pipeline_emergent
  time_zone        = var.schedule_timezone
  attempt_deadline = "320s"
  region           = var.region

  retry_config {
    retry_count = 1
  }

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/pipeline-emergent:run"

    oauth_token {
      service_account_email = google_service_account.ingest_runner.email
    }
  }

  depends_on = [
    google_project_service.cloudscheduler,
    google_cloud_run_v2_job.pipeline_emergent
  ]
}

resource "google_cloud_scheduler_job" "pipeline_all_schedule" {
  name             = "pipeline-all-schedule"
  description      = "Run all crawlers + ingest + notify 3 times daily"
  schedule         = var.schedules.pipeline_all
  time_zone        = var.schedule_timezone
  attempt_deadline = "320s"
  region           = var.region

  retry_config {
    retry_count = 1
  }

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/pipeline-all:run"

    oauth_token {
      service_account_email = google_service_account.ingest_runner.email
    }
  }

  depends_on = [
    google_project_service.cloudscheduler,
    google_cloud_run_v2_job.pipeline_all
  ]
}

# GTFS Bus Stops Sync Job
resource "google_cloud_run_v2_job" "gtfs_sync" {
  name     = "gtfs-sync"
  location = var.region

  template {
    template {
      service_account = google_service_account.ingest_runner.email
      timeout         = "300s"  # 5 minutes for GTFS download and sync
      
      containers {
        image = local.full_image_url
        args  = ["npm", "run", "prebuilt:gtfs-stops"]
        
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
        
        # Only need Firebase credentials for GTFS sync
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
          name  = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
          value = var.firebase_project_id
        }
        
        env {
          name  = "FIREBASE_DATABASE_ID"
          value = var.firebase_database_id
        }
      }
      
      max_retries = 1
    }
  }

  lifecycle {
    ignore_changes = [
      launch_stage,
    ]
  }

  depends_on = [
    google_project_service.run
  ]
}

resource "google_cloud_scheduler_job" "gtfs_sync_schedule" {
  name             = "gtfs-sync-schedule"
  description      = "Sync GTFS bus stops from Sofia Traffic daily at 3 AM"
  schedule         = var.schedules.gtfs_sync
  time_zone        = var.schedule_timezone
  attempt_deadline = "320s"
  region           = var.region

  retry_config {
    retry_count = 2  # Allow retries for network issues
  }

  http_target {
    http_method = "POST"
    uri         = "https://${var.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/gtfs-sync:run"

    oauth_token {
      service_account_email = google_service_account.ingest_runner.email
    }
  }

  depends_on = [
    google_project_service.cloudscheduler,
    google_cloud_run_v2_job.gtfs_sync
  ]
}
