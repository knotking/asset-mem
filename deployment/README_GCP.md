```
$brew install terraform
$brew install --cask google-cloud-sdk
$gcloud init
source "$(brew --prefix)/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/path.bash.inc" OR
source "$(brew --prefix)/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/path.zsh.inc"
```

```
Admin GCP - Console -> 
1) Menu -> Organization Policies -> compute.vmExternalIpAccess -> Edit Policy -> Allow
```

```
gcloud storage buckets create gs://homegeek-terraform-state --location=US
gcloud secrets create github-token --data-file=<(echo "your_github_pat_token")
gcloud secrets add-iam-policy-binding github-token \
  --project=homegeekdemo \
  --member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/compute.securityAdmin"
gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/compute.instanceAdmin.v1"
gcloud projects add-iam-policy-binding homegeekdemo \
  --member="githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/compute.networkAdmin"
gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/compute.osLogin"

  
```


### Github action
```
Google Cloud Service Account:

Create a service account in Google Cloud with the necessary permissions (e.g., roles/compute.admin, roles/storage.admin).
Generate a JSON key for the service account and add it as a GitHub secret (GCP_SERVICE_ACCOUNT_KEY).
GitHub Secrets:

GCP_PROJECT_ID: The Google Cloud project ID.
GCP_SERVICE_ACCOUNT_KEY: The JSON key for the service account.
GCS_BACKEND_BUCKET: The Google Cloud bucket name to store terraform state
```
