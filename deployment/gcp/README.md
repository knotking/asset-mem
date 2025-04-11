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
gcloud secrets create github-token --data-file=<(echo "your_github_pat_token")
gcloud secrets add-iam-policy-binding github-token \
  --project=homegeekdemo \
  --member="serviceAccount:321433914812-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:321433914812-compute@developer.gserviceaccount.com" \
  --role="roles/compute.securityAdmin"
gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:321433914812-compute@developer.gserviceaccount.com" \
  --role="roles/compute.instanceAdmin.v1"
```
