```
$ terraform init
$ gcloud auth login
$ gcloud auth application-default login
$ terraform plan -out gcp_compute_plan
$ terraform apply gcp_compute_plan
```