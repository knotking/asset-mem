# App Store screenshots

Ready to upload to App Store Connect.

## iPhone (1290 × 2796)

`iphone-6.7/` — upload to **iPhone 6.9" Display** in App Store Connect (Apple merged 6.5"/6.7"/6.9" into one slot). Accepted portrait sizes include **1290 × 2796**.

| File | Screen |
|------|--------|
| `01-landing.png` | Timeline Intelligence |
| `02-properties.png` | Property list (Dublin Home) |
| `03-chat.png` | AI chat |
| `04-checkpoints.png` | Checkpoints timeline |
| `05-documents.png` | Property details / documents |
| `06-settings.png` | Settings |

## iPad 12.9" (2048 × 2732)

`ipad-12.9/` — same six screens, iPad layout.

## Re-capture

Simulator must already be signed in (or set `MAESTRO_EMAIL` / `MAESTRO_PASSWORD`).

```bash
cd apps/mapp
# Metro: npx expo start --dev-client

maestro test .maestro/app-store-screenshots-authenticated.yaml \
  --udid D8DBE433-3F85-4B4B-AF5E-EBC161345917 \
  -e APP_ID=com.assetmem.staging \
  -e MAESTRO_PROPERTY_NAME='Dublin.*'
```

Maestro writes `app-store-*.png` in `apps/mapp/` — copy into `docs/app-store-screenshots/`.
