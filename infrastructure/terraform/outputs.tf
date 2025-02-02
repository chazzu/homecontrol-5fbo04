# Kubernetes cluster endpoint with sensitive marking for security
output "kubernetes_cluster_endpoint" {
  description = "Kubernetes cluster API endpoint URL for secure access"
  value       = module.kubernetes.cluster_endpoint
  sensitive   = true
}

# Kubernetes cluster name for reference and monitoring
output "kubernetes_cluster_name" {
  description = "Name of the deployed Kubernetes cluster"
  value       = module.kubernetes.cluster_name
}

# Cluster CA certificate marked as sensitive for secure communication
output "kubernetes_cluster_ca_certificate" {
  description = "Kubernetes cluster CA certificate for secure API communication"
  value       = module.kubernetes.cluster_ca_certificate
  sensitive   = true
}

# Kubernetes namespace for application isolation
output "kubernetes_namespace" {
  description = "Kubernetes namespace where Smart Home Dashboard resources are deployed"
  value       = module.kubernetes.namespace
}

# Backend service endpoint for internal access
output "backend_endpoint" {
  description = "Internal service endpoint for Smart Home Dashboard backend"
  value       = module.kubernetes.backend_service_endpoint
  sensitive   = true
}

# Frontend service endpoint for public access
output "frontend_endpoint" {
  description = "Public LoadBalancer endpoint for Smart Home Dashboard frontend"
  value       = module.kubernetes.frontend_service_endpoint
}

# Current deployment environment with validation
output "environment" {
  description = "Current deployment environment (development, staging, production)"
  value       = var.environment

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}