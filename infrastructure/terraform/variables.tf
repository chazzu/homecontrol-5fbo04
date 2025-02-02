# Terraform variables for Smart Home Dashboard infrastructure deployment
# Terraform version requirement: >=1.0.0

# Environment specification with strict validation
variable "environment" {
  description = "Deployment environment with strict validation and environment-specific configurations"
  type        = string

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production. Each environment has specific configuration requirements."
  }
}

# Region specification with compliance requirements
variable "region" {
  description = "Deployment region with compliance and performance considerations"
  type        = string

  validation {
    condition     = contains(["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"], var.region)
    error_message = "Region must be one of the approved deployment regions that meet compliance requirements."
  }
}

# Kubernetes version with compatibility validation
variable "kubernetes_version" {
  description = "Kubernetes version with compatibility validation and upgrade path documentation"
  type        = string
  default     = "1.24"

  validation {
    condition     = can(regex("^1\\.(2[4-6]|27)$", var.kubernetes_version))
    error_message = "Kubernetes version must be between 1.24 and 1.27 for stability and security compliance."
  }
}

# Node count with high availability requirements
variable "node_count" {
  description = "Number of nodes with high availability requirements per environment"
  type        = number
  default     = 3

  validation {
    condition     = var.environment == "production" ? var.node_count >= 3 : var.node_count >= 1
    error_message = "Production requires minimum 3 nodes, other environments minimum 1 node."
  }
}

# Node size with performance requirements
variable "node_size" {
  description = "Node instance type with performance and cost optimization guidelines"
  type        = string
  default     = "standard"

  validation {
    condition     = contains(["standard", "performance", "memory-optimized"], var.node_size)
    error_message = "Node size must match approved instance types for cost and performance requirements."
  }
}

# Backend service replica configuration
variable "backend_replicas" {
  description = "Backend service replicas with minimum availability guarantees"
  type        = number
  default     = 2

  validation {
    condition     = var.environment == "production" ? var.backend_replicas >= 2 : var.backend_replicas >= 1
    error_message = "Production requires minimum 2 backend replicas for high availability."
  }
}

# Frontend service replica configuration
variable "frontend_replicas" {
  description = "Frontend service replicas with scaling recommendations"
  type        = number
  default     = 3

  validation {
    condition     = var.environment == "production" ? var.frontend_replicas >= 3 : var.frontend_replicas >= 1
    error_message = "Production requires minimum 3 frontend replicas for load distribution."
  }
}