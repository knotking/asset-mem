# Billing documentation

Product and technical documentation for HomeApp monetization.

| Document | Description |
|----------|-------------|
| [B2C_STRIPE_CONFIGURATION.md](./B2C_STRIPE_CONFIGURATION.md) | **Stripe Dashboard + env vars** (proxy, webapp, GitHub) and verification checklist |
| [B2C_SUBSCRIPTION_PRICING_RATIONALE.md](./B2C_SUBSCRIPTION_PRICING_RATIONALE.md) | How **Plus (10M)** / **Pro (25M)** caps and **$19 / $39** list prices were derived (usage data, GCP COGS, infra, Stripe) |

Implementation:

- Proxy Stripe B2C: [`gcp/proxy/api/services/billing_service.py`](../../gcp/proxy/api/services/billing_service.py)
- Token quota: [`gcp/common/token/README.md`](../../gcp/common/token/README.md)
- Stripe setup (local): [`docs/proxy/DEPLOYMENT.md`](../proxy/DEPLOYMENT.md) — see also [B2C_STRIPE_CONFIGURATION.md](./B2C_STRIPE_CONFIGURATION.md)
