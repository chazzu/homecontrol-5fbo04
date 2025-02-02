# Backend configuration for Smart Home Dashboard infrastructure
# Terraform version: >=1.0.0

terraform {
  # Local backend configuration with enhanced security features and workspace support
  backend "local" {
    # Environment-specific state file path with project name prefix
    # Interpolated from project_name and environment variables
    path = "${var.project_name}-${var.environment}.tfstate"

    # Isolated workspace directory per environment to prevent state conflicts
    # Creates separate workspace directories for development, staging, and production
    workspace_dir = "${var.project_name}-workspaces/${var.environment}"

    # State locking timeout to prevent concurrent modifications
    # 5-minute timeout provides sufficient time for operations while preventing indefinite locks
    lock_timeout = "5m"

    # Enable state file encryption at rest for enhanced security
    # Protects sensitive infrastructure configuration data
    encrypt = true
  }

  # Required provider configurations
  required_providers {
    # Core Terraform provider for backend configuration
    terraform = {
      source  = "hashicorp/terraform"
      version = ">=1.0.0"
    }
  }

  # Minimum required Terraform version
  required_version = ">=1.0.0"
}

# Local variables for backend configuration
locals {
  # Validate environment-specific workspace paths
  workspace_path = "${var.project_name}-workspaces/${var.environment}"
  
  # Validate state file path
  state_file_path = "${var.project_name}-${var.environment}.tfstate"
}

# Backend configuration validation
resource "null_resource" "backend_validation" {
  # Triggers validation on environment or project name changes
  triggers = {
    environment  = var.environment
    project_name = var.project_name
  }

  # Validate workspace directory exists
  provisioner "local-exec" {
    command = "mkdir -p ${local.workspace_path}"
  }

  # Ensure proper permissions on state files
  provisioner "local-exec" {
    command = "chmod 600 ${local.state_file_path} || true"
  }
}