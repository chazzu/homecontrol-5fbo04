# Output values for the Kubernetes module

# Cluster endpoint for API access
output "cluster_endpoint" {
  description = "The endpoint URL of the Kubernetes cluster"
  value       = kubernetes_service.frontend.status[0].load_balancer[0].ingress[0].hostname
}

# Namespace information
output "namespace" {
  description = "The Kubernetes namespace where all resources are deployed"
  value       = kubernetes_namespace.smart_home_dashboard.metadata[0].name
  depends_on  = [kubernetes_namespace.smart_home_dashboard]
}

# Backend service information
output "backend_service_name" {
  description = "The name of the backend service deployment"
  value       = kubernetes_deployment.backend.metadata[0].name
  depends_on  = [kubernetes_deployment.backend]
}

# Frontend service information
output "frontend_service_name" {
  description = "The name of the frontend service deployment"
  value       = kubernetes_deployment.frontend.metadata[0].name
  depends_on  = [kubernetes_deployment.frontend]
}

# Resource quotas and usage information
output "resource_quotas" {
  description = "Resource quotas and limits allocated to the namespace including CPU, memory, and pod limits for monitoring and capacity planning"
  value = {
    limits = {
      cpu_limit    = kubernetes_resource_quota.namespace_quota.spec[0].hard["cpu"]
      memory_limit = kubernetes_resource_quota.namespace_quota.spec[0].hard["memory"]
      pods_limit   = tonumber(kubernetes_resource_quota.namespace_quota.spec[0].hard["pods"])
    }
    backend = {
      cpu_request    = var.resource_requests["backend"].cpu
      memory_request = var.resource_requests["backend"].memory
      cpu_limit      = var.resource_limits["backend"].cpu
      memory_limit   = var.resource_limits["backend"].memory
      replicas       = var.backend_replicas
    }
    frontend = {
      cpu_request    = var.resource_requests["frontend"].cpu
      memory_request = var.resource_requests["frontend"].memory
      cpu_limit      = var.resource_limits["frontend"].cpu
      memory_limit   = var.resource_limits["frontend"].memory
      replicas       = var.frontend_replicas
    }
  }
  depends_on = [
    kubernetes_namespace.smart_home_dashboard,
    kubernetes_deployment.backend,
    kubernetes_deployment.frontend,
    kubernetes_resource_quota.namespace_quota
  ]
}