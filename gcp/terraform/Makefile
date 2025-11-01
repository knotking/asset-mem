.PHONY: help init-staging init-prod plan-staging plan-prod apply-staging apply-prod destroy-staging destroy-prod fmt validate clean

# Default environment
ENV ?= staging

help:
	@echo "Terraform Management Commands"
	@echo "=============================="
	@echo ""
	@echo "Environment Setup:"
	@echo "  make init-staging        - Initialize staging environment"
	@echo "  make init-prod           - Initialize production environment"
	@echo ""
	@echo "Planning:"
	@echo "  make plan-staging        - Plan staging changes"
	@echo "  make plan-prod           - Plan production changes"
	@echo ""
	@echo "Applying:"
	@echo "  make apply-staging       - Apply staging changes"
	@echo "  make apply-prod          - Apply production changes"
	@echo ""
	@echo "Destroying:"
	@echo "  make destroy-staging     - Destroy staging resources"
	@echo "  make destroy-prod        - Destroy production resources"
	@echo ""
	@echo "Utilities:"
	@echo "  make fmt                 - Format all Terraform files"
	@echo "  make validate            - Validate all configurations"
	@echo "  make clean               - Clean Terraform cache"
	@echo ""
	@echo "Import Commands:"
	@echo "  make import-staging-resources - Import existing staging resources"
	@echo "  make import-prod-resources    - Import existing production resources"

# Initialization
init-staging:
	cd environments/staging && terraform init

init-prod:
	cd environments/prod && terraform init

# Planning
plan-staging:
	cd environments/staging && terraform plan

plan-prod:
	cd environments/prod && terraform plan

# Applying
apply-staging:
	cd environments/staging && terraform apply

apply-prod:
	cd environments/prod && terraform apply

# Destroying
destroy-staging:
	@echo "WARNING: This will destroy all staging resources!"
	@read -p "Are you sure? Type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ] || exit 1
	cd environments/staging && terraform destroy

destroy-prod:
	@echo "WARNING: This will destroy all production resources!"
	@read -p "Are you sure? Type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ] || exit 1
	cd environments/prod && terraform destroy

# Utilities
fmt:
	terraform fmt -recursive .

validate:
	cd environments/staging && terraform validate
	cd environments/prod && terraform validate

clean:
	find . -type d -name ".terraform" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name ".terraform.lock.hcl" -delete 2>/dev/null || true
	find . -type f -name "*.tfstate*" -delete 2>/dev/null || true

# Import existing resources (customize with your resource IDs)
import-staging-resources:
	@echo "Importing existing staging resources..."
	@echo "Note: Update PROJECT_ID and resource names as needed"
	@cd environments/staging && \
	terraform import module.pubsub.google_pubsub_topic.user_upload projects/homegeekdemo-staging/topics/user-upload-topic-staging || true && \
	terraform import module.pubsub.google_pubsub_topic.user_upload_result projects/homegeekdemo-staging/topics/user-upload-result-topic-staging || true && \
	terraform import module.storage.google_storage_bucket.user_data homegeek-user-data-staging || true

import-prod-resources:
	@echo "Importing existing production resources..."
	@echo "Note: Update PROJECT_ID and resource names as needed"
	@cd environments/prod && \
	terraform import module.pubsub.google_pubsub_topic.user_upload projects/homegeekdemo/topics/user-upload-topic-prod || true && \
	terraform import module.pubsub.google_pubsub_topic.user_upload_result projects/homegeekdemo/topics/user-upload-result-topic-prod || true && \
	terraform import module.storage.google_storage_bucket.user_data homegeek-user-data-prod || true

# Output values
output-staging:
	cd environments/staging && terraform output

output-prod:
	cd environments/prod && terraform output

# State management
state-list-staging:
	cd environments/staging && terraform state list

state-list-prod:
	cd environments/prod && terraform state list

# Refresh state
refresh-staging:
	cd environments/staging && terraform refresh

refresh-prod:
	cd environments/prod && terraform refresh
