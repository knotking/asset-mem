gcloud iam workload-identity-pools create github-pool --location="global" \
 --display-name="GitHub Actions Pool" --project=homegeekdemo

gcloud iam workload-identity-pools describe "github-pool" \
 --project="homegeekdemo" \
 --location="global" \
 --format="value(name)"

POOL_ID = projects/321433914812/locations/global/workloadIdentityPools/github-pool

gcloud iam workload-identity-pools providers create-oidc "github-provider" \
 --project="homegeekdemo" \
 --location="global" \
 --workload-identity-pool="github-pool" \
 --display-name="GitHub Provider" \
 --issuer-uri="https://token.actions.githubusercontent.com" \
 --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
 --attribute-condition="attribute.repository=='HomeGeekAI/HomeApp'"

gcloud iam workload-identity-pools providers describe github-provider \
 --project="homegeekdemo" \
 --location="global" \
 --workload-identity-pool="github-pool" \
 --format="yaml(attributeMapping,attributeCondition)"

gcloud iam service-accounts add-iam-policy-binding \
 "githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
 --project="homegeekdemo" \
 --role="roles/iam.workloadIdentityUser" \
 --member="principalSet://iam.googleapis.com/projects/321433914812/locations/global/workloadIdentityPools/github-pool/attribute.repository/HomeGeekAI/HomeApp"
