# Configure Terraform and required providers
terraform {
  required_version = ">= 1.0.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }

  # Remote backend configuration for state management
  backend "remote" {
    workspace {
      name = "smart-home-dashboard-${var.environment}"
    }
  }
}

# Configure providers with enhanced security settings
provider "kubernetes" {
  config_path = "~/.kube/config"

  # Enhanced security configurations
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      module.kubernetes.cluster_name
    ]
  }
}

provider "helm" {
  kubernetes {
    config_path = "~/.kube/config"
  }
}

# Deploy Kubernetes infrastructure with enhanced security and monitoring
module "kubernetes" {
  source = "./modules/kubernetes"

  # Environment configuration
  environment         = var.environment
  region             = var.region
  kubernetes_version = var.kubernetes_version
  node_count         = var.node_count
  node_size          = var.node_size

  # Application scaling configuration
  backend_replicas  = var.backend_replicas
  frontend_replicas = var.frontend_replicas

  # Security and compliance features
  enable_monitoring        = true
  enable_logging          = true
  enable_network_policies = true
  pod_security_policies   = true

  # Resource quotas based on environment
  resource_quotas = {
    cpu    = var.environment == "production" ? "4" : "2"
    memory = var.environment == "production" ? "8Gi" : "4Gi"
  }

  # Enhanced security context
  security_context = {
    run_as_non_root = true
    run_as_user     = 1000
    fs_group        = 1000
  }
}

# Deploy monitoring stack using Helm
resource "helm_release" "monitoring" {
  name       = "monitoring"
  namespace  = module.kubernetes.namespace
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "45.0.0"

  set {
    name  = "grafana.enabled"
    value = "true"
  }

  set {
    name  = "prometheus.enabled"
    value = "true"
  }

  set {
    name  = "alertmanager.enabled"
    value = "true"
  }

  depends_on = [module.kubernetes]
}

# Deploy logging stack
resource "helm_release" "logging" {
  name       = "logging"
  namespace  = module.kubernetes.namespace
  repository = "https://grafana.github.io/helm-charts"
  chart      = "loki-stack"
  version    = "2.9.0"

  set {
    name  = "promtail.enabled"
    value = "true"
  }

  set {
    name  = "loki.persistence.enabled"
    value = "true"
  }

  depends_on = [module.kubernetes]
}

# Network policies for enhanced security
resource "kubernetes_network_policy" "default_deny" {
  metadata {
    name      = "default-deny"
    namespace = module.kubernetes.namespace
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress", "Egress"]
  }

  depends_on = [module.kubernetes]
}

# Allow specific communication between frontend and backend
resource "kubernetes_network_policy" "frontend_backend" {
  metadata {
    name      = "frontend-to-backend"
    namespace = module.kubernetes.namespace
  }

  spec {
    pod_selector {
      match_labels = {
        app = "backend"
      }
    }

    ingress {
      from {
        pod_selector {
          match_labels = {
            app = "frontend"
          }
        }
      }

      ports {
        port     = 8080
        protocol = "TCP"
      }
    }

    policy_types = ["Ingress"]
  }

  depends_on = [module.kubernetes]
}

# Output values for reference
output "cluster_endpoint" {
  description = "Kubernetes cluster endpoint"
  value       = module.kubernetes.cluster_endpoint
  sensitive   = true
}

output "cluster_name" {
  description = "Kubernetes cluster name"
  value       = module.kubernetes.cluster_name
}

output "namespace" {
  description = "Kubernetes namespace"
  value       = module.kubernetes.namespace
}