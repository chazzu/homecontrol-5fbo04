# Smart Home Dashboard Infrastructure Providers Configuration
# Terraform version: >= 1.0.0

# Import required variables
variable "environment" {}
variable "region" {}

# Configure Terraform settings and required providers
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
}

# Configure Kubernetes provider with EKS authentication
provider "kubernetes" {
  host                   = module.kubernetes_module.cluster_endpoint
  cluster_ca_certificate = module.kubernetes_module.cluster_ca_certificate
  
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      module.kubernetes_module.cluster_name
    ]
  }
}

# Configure Helm provider with Kubernetes authentication
provider "helm" {
  kubernetes {
    host                   = module.kubernetes_module.cluster_endpoint
    cluster_ca_certificate = module.kubernetes_module.cluster_ca_certificate
    
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        module.kubernetes_module.cluster_name
      ]
    }
  }
}

# Export provider configurations for use in other modules
output "kubernetes_provider" {
  description = "Kubernetes provider configuration for module consumption"
  value = {
    host                   = module.kubernetes_module.cluster_endpoint
    cluster_ca_certificate = module.kubernetes_module.cluster_ca_certificate
  }
  sensitive = true
}

output "helm_provider" {
  description = "Helm provider configuration for module consumption"
  value = {
    kubernetes = {
      host                   = module.kubernetes_module.cluster_endpoint
      cluster_ca_certificate = module.kubernetes_module.cluster_ca_certificate
    }
  }
  sensitive = true
}