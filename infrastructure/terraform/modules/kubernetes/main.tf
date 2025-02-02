# Configure Terraform and required providers
terraform {
  required_version = ">=1.0.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">=2.20.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = ">=2.9.0"
    }
  }
}

# Create namespace for Smart Home Dashboard
resource "kubernetes_namespace" "smart_home_dashboard" {
  metadata {
    name = var.namespace
    labels = {
      app         = "smart-home-dashboard"
      environment = var.environment
      managed-by  = "terraform"
    }
  }

  # Configure resource quotas for the namespace
  lifecycle {
    ignore_changes = [
      metadata[0].annotations,
      metadata[0].labels
    ]
  }
}

# Create resource quota for the namespace
resource "kubernetes_resource_quota" "namespace_quota" {
  metadata {
    name      = "${var.namespace}-quota"
    namespace = kubernetes_namespace.smart_home_dashboard.metadata[0].name
  }

  spec {
    hard = {
      "cpu"    = "4"
      "memory" = "8Gi"
      "pods"   = "20"
    }
  }
}

# Deploy backend service
resource "kubernetes_deployment" "backend" {
  metadata {
    name      = "smart-home-dashboard-backend"
    namespace = kubernetes_namespace.smart_home_dashboard.metadata[0].name
    labels = {
      app         = "backend"
      environment = var.environment
      managed-by  = "terraform"
    }
  }

  spec {
    replicas = var.backend_replicas

    selector {
      match_labels = {
        app = "backend"
      }
    }

    strategy {
      type = "RollingUpdate"
      rolling_update {
        max_surge       = "25%"
        max_unavailable = "25%"
      }
    }

    template {
      metadata {
        labels = {
          app         = "backend"
          environment = var.environment
        }
      }

      spec {
        container {
          name  = "backend"
          image = "smart-home-dashboard-backend:latest"

          resources {
            requests = {
              cpu    = var.resource_requests["backend"].cpu
              memory = var.resource_requests["backend"].memory
            }
            limits = {
              cpu    = var.resource_limits["backend"].cpu
              memory = var.resource_limits["backend"].memory
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = 8080
            }
            initial_delay_seconds = 30
            period_seconds       = 10
          }

          readiness_probe {
            http_get {
              path = "/ready"
              port = 8080
            }
            initial_delay_seconds = 5
            period_seconds       = 5
          }
        }
      }
    }
  }
}

# Deploy frontend service
resource "kubernetes_deployment" "frontend" {
  metadata {
    name      = "smart-home-dashboard-web"
    namespace = kubernetes_namespace.smart_home_dashboard.metadata[0].name
    labels = {
      app         = "frontend"
      environment = var.environment
      managed-by  = "terraform"
    }
  }

  spec {
    replicas = var.frontend_replicas

    selector {
      match_labels = {
        app = "frontend"
      }
    }

    strategy {
      type = "RollingUpdate"
      rolling_update {
        max_surge       = "25%"
        max_unavailable = "25%"
      }
    }

    template {
      metadata {
        labels = {
          app         = "frontend"
          environment = var.environment
        }
      }

      spec {
        container {
          name  = "frontend"
          image = "smart-home-dashboard-frontend:latest"

          resources {
            requests = {
              cpu    = var.resource_requests["frontend"].cpu
              memory = var.resource_requests["frontend"].memory
            }
            limits = {
              cpu    = var.resource_limits["frontend"].cpu
              memory = var.resource_limits["frontend"].memory
            }
          }

          liveness_probe {
            http_get {
              path = "/"
              port = 80
            }
            initial_delay_seconds = 10
            period_seconds       = 10
          }
        }
      }
    }
  }
}

# Create services for backend and frontend
resource "kubernetes_service" "backend" {
  metadata {
    name      = "smart-home-dashboard-backend"
    namespace = kubernetes_namespace.smart_home_dashboard.metadata[0].name
  }

  spec {
    selector = {
      app = "backend"
    }

    port {
      port        = 8080
      target_port = 8080
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_service" "frontend" {
  metadata {
    name      = "smart-home-dashboard-frontend"
    namespace = kubernetes_namespace.smart_home_dashboard.metadata[0].name
  }

  spec {
    selector = {
      app = "frontend"
    }

    port {
      port        = 80
      target_port = 80
    }

    type = "LoadBalancer"
  }
}

# Output values
output "cluster_endpoint" {
  description = "Kubernetes cluster API endpoint"
  value       = kubernetes_service.frontend.status[0].load_balancer[0].ingress[0].hostname
}

output "namespace" {
  description = "Created Kubernetes namespace"
  value       = kubernetes_namespace.smart_home_dashboard.metadata[0].name
}