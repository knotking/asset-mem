gcloud functions deploy pubsub_to_user_uploads \
  --runtime python313 \
  --trigger-topic user-upload-topic \
  --source function \
  --entry-point pubsub_to_user_uploads \
  --set-env-vars GCP_PROJECT_ID=homegeekdemo \
  --set-env-vars GCP_REGION=us-central1 \
  --set-env-vars USER_UPLOAD_RESULT_TOPIC=projects/homegeekdemo/topics/user-upload-result-topic \
  --set-env-vars RAG_CORPUS=projects/homegeekdemo/locations/us-central1/ragCorpora/1689975760170778624


python -m unittest test_main.py

gcloud projects add-iam-policy-binding homegeekdemo \
--member="serviceAccount:githubworkflowdeployment@homegeekdemo.iam.gserviceaccount.com" \
--role=roles/cloudfunctions.developer


gcloud services enable eventarc.googleapis.com --project=homegeekdemo