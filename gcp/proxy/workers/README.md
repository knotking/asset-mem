gcloud functions deploy pubsub_to_user_uploads \
  --gen2 \
  --max-instances 1 \
  --concurrency 1 \
  --region us-central1 \
  --runtime python313 \
  --trigger-topic user-upload-topic \
  --memory=512MB \
  --source function \
  --allow-unauthenticated \
  --service-account githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com \
  --entry-point pubsub_to_user_uploads \
  --set-env-vars GCP_PROJECT_ID=homegeekdemo \
  --set-env-vars GCP_REGION=us-central1 \
  --set-env-vars GCS_BUCKET=homegeek-user-data \
  --set-env-vars USER_UPLOAD_RESULT_TOPIC=projects/homegeekdemo/topics/user-upload-result-topic \
  --set-env-vars RAG_CORPUS=projects/homegeekdemo/locations/us-central1/ragCorpora/1689975760170778624




python -m unittest test_main.py
python integration_test.py

gcloud projects add-iam-policy-binding homegeekdemo \
--member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
--role=roles/cloudfunctions.developer

gcloud storage buckets add-iam-policy-binding gs://homegeek-user-data \
  --member="serviceAccount:service-321433914812@gcp-sa-vertex-rag.iam.gserviceaccount.com" \
  --role="roles/storage.objectCreator"

gcloud services enable eventarc.googleapis.com --project=homegeekdemo

gcloud projects add-iam-policy-binding homegeekdemo \
  --member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
  --role="roles/run.admin"