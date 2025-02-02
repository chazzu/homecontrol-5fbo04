# Terraform version constraint
terraform {
  required_version = ">=1.0.0"
}

# Namespace for Smart Home Dashboard resources
variable "namespace" {
  description = "Kubernetes namespace for Smart Home Dashboard resources, providing isolation and access control"
  type        = string
  default     = "smart-home-dashboard"
}

# Kubernetes cluster name
variable "cluster_name" {
  description = "Name of the Kubernetes cluster for resource identification and management"
  type        = string

  validation {
    condition     = length(var.cluster_name) > 0
    error_message = "Cluster name cannot be empty"
  }
}

# Deployment environment
variable "environment" {
  description = "Deployment environment (development, staging, production) for environment-specific configurations"
  type        = string

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}

# Kubernetes version
variable "kubernetes_version" {
  description = "Version of Kubernetes to use, following semantic versioning for compatibility"
  type        = string
  default     = "1.24"
}

# Backend service replicas
variable "backend_replicas" {
  description = "Number of backend service replicas for high availability and load distribution"
  type        = number
  default     = 2
}

# Frontend service replicas
variable "frontend_replicas" {
  description = "Number of frontend service replicas for improved user access and load balancing"
  type        = number
  default     = 3
}

# Container resource limits
variable "resource_limits" {
  description = "Resource limits for containers to prevent resource exhaustion"
  type = map(object({
    cpu    = string
    memory = string
  }))
  default = {
    backend = {
      cpu    = "500m"
      memory = "512Mi"
    }
    frontend = {
      cpu    = "200m"
      memory = "256Mi"
    }
  }
}

# Container resource requests
variable "resource_requests" {
  description = "Resource requests for containers to ensure minimum resource availability"
  type = map(object({
    cpu    = string
    memory = string
  }))
  default = {
    backend = {
      cpu    = "100m"
      memory = "256Mi"
    }
    frontend = {
      cpu    = "100m"
      memory = "128Mi"
    }
  }
}