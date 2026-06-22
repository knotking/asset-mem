# AssetMem AI brand assets

Raster/SVG exports for **Stripe Checkout**, marketing, and manual upload. Not imported by app code.

In-app wordmark is rendered in:

- `apps/webapp/src/components/brand/asset-mem-wordmark.tsx`
- `apps/mapp/components/AssetMemWordmark.tsx`

## Stripe Dashboard (Settings → Business → Branding)

| Field | File |
|-------|------|
| **Brand color** | `#0a0a0f` (landing background) |
| **Logo** | `asset-mem-wordmark-checkout-tight.png` |
| **Icon** | `apps/webapp/src/app/icon.png` |
| **Statement descriptor** | `ASSETMEM AI` (legal business name can differ) |

Logo: PNG/JPG, ≥128×128 px, ≤512 KB. Prefer the tight-crop wordmark on dark Checkout.

See [docs/billing/B2C_STRIPE_CONFIGURATION.md](../../docs/billing/B2C_STRIPE_CONFIGURATION.md).
