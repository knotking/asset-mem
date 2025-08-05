gcloud functions deploy pubsub_to_telegram \
  --runtime python310 \
  --trigger-topic  user-upload-topic \
  --source function \
  --entry-point pubsub_to_telegram \
  --set-env-vars TELEGRAM_BOT_WEBHOOK_URL=https://telegram-agent-proxy-321433914812.us-central1.run.app/processing_complete,WEBHOOK_SECRET=92be3f5be13328fe265af604b0bde2061e18662203a83b5b5692119215be0376


python -m unittest test_main.py