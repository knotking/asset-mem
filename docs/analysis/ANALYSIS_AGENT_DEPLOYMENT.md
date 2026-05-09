# Analysis Agent Deployment and Operations

## Overview

This document covers deployment procedures, infrastructure setup, monitoring, troubleshooting, and operational best practices for the Analysis Agent.

## Infrastructure Architecture

### Google Cloud Platform Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│         (Telegram Bot, Web App, Mobile App)                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cloud Load Balancer                        │
│                    (Global HTTPS LB)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Proxy Service (Cloud Run)                   │
│              FastAPI + Authentication Layer                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Analysis Agent                            │
│              (Vertex AI Agent Builder)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Triage     │  │   Coverage   │  │     DIY      │     │
│  │    Agent     │  │    Agent     │  │    Agent     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Service    │  │   Shopping   │  │     Cost     │     │
│  │    Agent     │  │    Agent     │  │    Agent     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Vertex AI    │ │   External   │ │   Cloud      │
│ RAG Engine   │ │   APIs       │ │   Storage    │
│              │ │ (SerpAPI, Serp, │ │              │
│ - User Docs  │ │  YouTube,    │ │ - Media      │
│ - Knowledge  │ │  Google)     │ │ - Documents  │
│   Base       │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Resource Requirements

| Component     | CPU    | Memory | Instances | Scaling |
| ------------- | ------ | ------ | --------- | ------- |
| Proxy Service | 2 vCPU | 4 GB   | 2-10      | Auto    |
| Agent Workers | 4 vCPU | 8 GB   | 1-5       | Auto    |
| Redis Cache   | 1 vCPU | 2 GB   | 1         | Manual  |

## Deployment Process

### Prerequisites

1. **Google Cloud Project Setup**

   ```bash
   export PROJECT_ID="your-project-id"
   export REGION="us-central1"
   export LOCATION="us-central1"

   gcloud config set project $PROJECT_ID
   ```

2. **Enable Required APIs**

   ```bash
   gcloud services enable \
     run.googleapis.com \
     aiplatform.googleapis.com \
     storage.googleapis.com \
     firestore.googleapis.com \
     secretmanager.googleapis.com \
     cloudscheduler.googleapis.com \
     pubsub.googleapis.com
   ```

3. **Create Service Accounts**

   ```bash
   # Proxy service account
   gcloud iam service-accounts create proxy-service \
     --display-name="Proxy Service Account"

   # Agent service account
   gcloud iam service-accounts create agent-service \
     --display-name="Agent Service Account"
   ```

4. **Grant IAM Permissions**

   ```bash
   # Proxy service permissions
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:proxy-service@$PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/storage.objectViewer"

   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:proxy-service@$PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/firestore.user"

   # Agent service permissions
   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:agent-service@$PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"

   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:agent-service@$PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/storage.objectAdmin"
   ```

### Environment Configuration

#### Secret Manager Setup

```bash
# API Keys
echo -n "your-serpapi-key" | gcloud secrets create serpapi-key --data-file=-
echo -n "your-yelp-api-key" | gcloud secrets create yelp-api-key --data-file=-
echo -n "your-youtube-api-key" | gcloud secrets create youtube-api-key --data-file=-
echo -n "your-google-search-key" | gcloud secrets create google-search-api-key --data-file=-
echo -n "your-google-maps-key" | gcloud secrets create google-maps-api-key --data-file=-

# Firebase Config
gcloud secrets create firebase-admin-sdk --data-file=firebase-admin-sdk.json
```

#### Environment Variables

Create `.env.production`:

```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_CLOUD_REGION=us-central1

# API Keys (loaded from Secret Manager)
SERPAPI_KEY=${SERPAPI_KEY}
=${}
YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
GOOGLE_SEARCH_API_KEY=${GOOGLE_SEARCH_API_KEY}
GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}

# Firebase
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_ADMIN_SDK_PATH=/secrets/firebase-admin-sdk.json

# Agent Configuration
AGENT_MODEL=gemini-3.1-flash-lite
AGENT_TEMPERATURE=0.7
AGENT_MAX_TOKENS=8192

# Rate Limiting
RATE_LIMIT_QUERIES_PER_HOUR=100
RATE_LIMIT_UPLOADS_PER_HOUR=50

# Caching
REDIS_HOST=10.0.0.3
REDIS_PORT=6379
CACHE_TTL_PRODUCTS=3600
CACHE_TTL_SERVICES=300

# Monitoring
LOG_LEVEL=INFO
ENABLE_METRICS=true
ENABLE_TRACING=true
```

### Deployment Steps

#### 1. Build and Push Docker Images

**Proxy Service:**

```bash
cd gcp/proxy

# Build image
docker build -t gcr.io/$PROJECT_ID/proxy-service:latest .

# Push to Container Registry
docker push gcr.io/$PROJECT_ID/proxy-service:latest
```

**Agent Workers:**

```bash
cd gcp/agents/homecare

# Build image
docker build -t gcr.io/$PROJECT_ID/agent-workers:latest .

# Push to Container Registry
docker push gcr.io/$PROJECT_ID/agent-workers:latest
```

#### 2. Deploy Proxy Service to Cloud Run

```bash
gcloud run deploy proxy-service \
  --image=gcr.io/$PROJECT_ID/proxy-service:latest \
  --platform=managed \
  --region=$REGION \
  --service-account=proxy-service@$PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --memory=4Gi \
  --cpu=2 \
  --min-instances=2 \
  --max-instances=10 \
  --concurrency=80 \
  --timeout=300 \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_REGION=$REGION" \
  --set-secrets="SERPAPI_KEY=serpapi-key:latest,=yelp-api-key:latest,YOUTUBE_API_KEY=youtube-api-key:latest"
```

#### 3. Deploy Agent Workers

```bash
gcloud run deploy agent-workers \
  --image=gcr.io/$PROJECT_ID/agent-workers:latest \
  --platform=managed \
  --region=$REGION \
  --service-account=agent-service@$PROJECT_ID.iam.gserviceaccount.com \
  --no-allow-unauthenticated \
  --memory=8Gi \
  --cpu=4 \
  --min-instances=1 \
  --max-instances=5 \
  --concurrency=10 \
  --timeout=600 \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$LOCATION" \
  --set-secrets="SERPAPI_KEY=serpapi-key:latest,=yelp-api-key:latest,YOUTUBE_API_KEY=youtube-api-key:latest"
```

#### 4. Configure Pub/Sub for Async Processing

```bash
# Create topic
gcloud pubsub topics create agent-requests

# Create subscription
gcloud pubsub subscriptions create agent-requests-sub \
  --topic=agent-requests \
  --ack-deadline=600 \
  --message-retention-duration=7d

# Grant permissions
gcloud pubsub topics add-iam-policy-binding agent-requests \
  --member="serviceAccount:proxy-service@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

gcloud pubsub subscriptions add-iam-policy-binding agent-requests-sub \
  --member="serviceAccount:agent-service@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/pubsub.subscriber"
```

#### 5. Setup Cloud Storage Buckets

```bash
# User uploads bucket
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$PROJECT_ID-user-uploads

# Set lifecycle policy
cat > lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90}
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://$PROJECT_ID-user-uploads

# Set CORS policy
cat > cors.json << EOF
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://$PROJECT_ID-user-uploads
```

#### 6. Initialize Vertex AI RAG

```bash
# Create knowledge base corpus
python scripts/setup_rag.py \
  --project=$PROJECT_ID \
  --location=$LOCATION \
  --corpus-name=knowledge-base

# Create user document corpus template
python scripts/setup_user_corpus.py \
  --project=$PROJECT_ID \
  --location=$LOCATION
```

#### 7. Configure Load Balancer

```bash
# Reserve static IP
gcloud compute addresses create proxy-service-ip \
  --global

# Create backend service
gcloud compute backend-services create proxy-backend \
  --global \
  --load-balancing-scheme=EXTERNAL \
  --protocol=HTTP

# Add Cloud Run NEG
gcloud compute network-endpoint-groups create proxy-neg \
  --region=$REGION \
  --network-endpoint-type=serverless \
  --cloud-run-service=proxy-service

gcloud compute backend-services add-backend proxy-backend \
  --global \
  --network-endpoint-group=proxy-neg \
  --network-endpoint-group-region=$REGION

# Create URL map
gcloud compute url-maps create proxy-lb \
  --default-service=proxy-backend

# Create SSL certificate
gcloud compute ssl-certificates create proxy-cert \
  --domains=api.yourdomain.com

# Create HTTPS proxy
gcloud compute target-https-proxies create proxy-https-proxy \
  --url-map=proxy-lb \
  --ssl-certificates=proxy-cert

# Create forwarding rule
gcloud compute forwarding-rules create proxy-https-rule \
  --global \
  --target-https-proxy=proxy-https-proxy \
  --address=proxy-service-ip \
  --ports=443
```

### Deployment Verification

#### Health Checks

```bash
# Check proxy service
curl https://api.yourdomain.com/health

# Expected response:
# {"status": "healthy", "version": "1.0.0", "timestamp": "2024-01-15T10:30:00Z"}

# Check agent workers
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://agent-workers-xxx-uc.a.run.app/health

# Expected response:
# {"status": "healthy", "agents": ["analysis", "triage", "coverage", "diy", "service", "cost"]}
```

#### Test Query

```bash
# Get Firebase token (from your app)
TOKEN="your-firebase-id-token"

# Send test query
curl -X POST https://api.yourdomain.com/api/agent/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_query": "My kitchen faucet is leaking"
  }'

# Verify response structure
```

## Monitoring and Observability

### Cloud Monitoring Setup

#### Custom Metrics

```python
# metrics.py
from google.cloud import monitoring_v3
import time

client = monitoring_v3.MetricServiceClient()
project_name = f"projects/{PROJECT_ID}"

def record_agent_execution(agent_name: str, duration_ms: int, success: bool):
    """Record agent execution metrics"""
    series = monitoring_v3.TimeSeries()
    series.metric.type = "custom.googleapis.com/agent/execution_time"
    series.resource.type = "cloud_run_revision"

    point = monitoring_v3.Point()
    point.value.double_value = duration_ms
    point.interval.end_time.seconds = int(time.time())

    series.points = [point]
    series.metric.labels["agent_name"] = agent_name
    series.metric.labels["success"] = str(success)

    client.create_time_series(name=project_name, time_series=[series])
```

#### Key Metrics to Monitor

| Metric               | Type         | Alert Threshold |
| -------------------- | ------------ | --------------- |
| Request Rate         | Counter      | > 1000/min      |
| Response Time (p95)  | Distribution | > 30s           |
| Error Rate           | Counter      | > 5%            |
| Agent Execution Time | Distribution | > 60s           |
| API Call Failures    | Counter      | > 10%           |
| Cache Hit Rate       | Gauge        | < 60%           |
| Storage Usage        | Gauge        | > 80%           |

#### Alerting Policies

```bash
# High error rate alert
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s \
  --condition-filter='metric.type="run.googleapis.com/request_count" AND metric.label.response_code_class="5xx"'

# Slow response time alert
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Slow Response Time" \
  --condition-display-name="P95 latency > 30s" \
  --condition-threshold-value=30000 \
  --condition-threshold-duration=300s \
  --condition-filter='metric.type="run.googleapis.com/request_latencies"'
```

### Logging

#### Structured Logging

```python
# logging_config.py
import logging
import json
from google.cloud import logging as cloud_logging

# Initialize Cloud Logging
logging_client = cloud_logging.Client()
logging_client.setup_logging()

class StructuredLogger:
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.logger = logging.getLogger(service_name)

    def log(self, level: str, message: str, **kwargs):
        log_entry = {
            "service": self.service_name,
            "message": message,
            "severity": level,
            **kwargs
        }

        if level == "ERROR":
            self.logger.error(json.dumps(log_entry))
        elif level == "WARNING":
            self.logger.warning(json.dumps(log_entry))
        else:
            self.logger.info(json.dumps(log_entry))
```

#### Log Queries

```bash
# View recent errors
gcloud logging read "resource.type=cloud_run_revision AND severity=ERROR" \
  --limit=50 \
  --format=json

# View agent execution logs
gcloud logging read "resource.type=cloud_run_revision AND jsonPayload.service=analysis_agent" \
  --limit=100 \
  --format=json

# View slow requests
gcloud logging read "resource.type=cloud_run_revision AND jsonPayload.duration_ms>30000" \
  --limit=50 \
  --format=json
```

### Tracing

#### Cloud Trace Integration

```python
# tracing.py
from google.cloud import trace_v2
from opentelemetry import trace
from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

# Setup tracing
tracer_provider = TracerProvider()
cloud_trace_exporter = CloudTraceSpanExporter()
tracer_provider.add_span_processor(
    BatchSpanProcessor(cloud_trace_exporter)
)
trace.set_tracer_provider(tracer_provider)

tracer = trace.get_tracer(__name__)

# Use in code
def analyze_query(query: str):
    with tracer.start_as_current_span("analyze_query"):
        with tracer.start_as_current_span("triage"):
            triage_result = triage_agent.run(query)

        with tracer.start_as_current_span("diy"):
            diy_result = diy_agent.run(query)

        return combine_results(triage_result, diy_result)
```

## Troubleshooting

### Common Issues

#### Issue: High Response Times

**Symptoms:**

- P95 latency > 30 seconds
- User complaints about slow responses

**Diagnosis:**

```bash
# Check agent execution times
gcloud logging read "jsonPayload.duration_ms>30000" --limit=50

# Check external API latencies
gcloud logging read "jsonPayload.api_name=serpapi AND jsonPayload.api_duration_ms>5000"
```

**Solutions:**

1. Increase Cloud Run concurrency
2. Scale up agent workers
3. Implement caching for repeated queries
4. Optimize external API calls (parallel execution)

#### Issue: API Rate Limits Exceeded

**Symptoms:**

- Errors: "Rate limit exceeded"
- Failed API calls in logs

**Diagnosis:**

```bash
# Check API error rates
gcloud logging read "jsonPayload.error_code=RATE_LIMIT" --limit=100
```

**Solutions:**

1. Implement request queuing
2. Increase API quota/tier
3. Implement exponential backoff
4. Use fallback APIs

#### Issue: RAG Retrieval Failures

**Symptoms:**

- Coverage agent returns no results
- Errors: "RAG corpus not found"

**Diagnosis:**

```bash
# Check RAG corpus status
gcloud ai indexes list --region=$LOCATION

# Check user corpus creation
python scripts/check_user_corpus.py --user-id=USER_ID
```

**Solutions:**

1. Verify corpus exists for user
2. Re-index documents
3. Check IAM permissions
4. Verify document upload completed

#### Issue: Memory Exhaustion

**Symptoms:**

- Cloud Run instances restarting
- OOM (Out of Memory) errors

**Diagnosis:**

```bash
# Check memory usage
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/container/memory/utilizations"'
```

**Solutions:**

1. Increase memory allocation
2. Reduce concurrency
3. Implement streaming for large responses
4. Optimize agent memory usage

### Debug Mode

Enable debug logging:

```bash
# Deploy with debug mode
gcloud run services update proxy-service \
  --update-env-vars="LOG_LEVEL=DEBUG,ENABLE_DEBUG=true"

# View debug logs
gcloud logging read "resource.type=cloud_run_revision AND jsonPayload.level=DEBUG" \
  --limit=100
```

## Scaling Strategies

### Horizontal Scaling

**Auto-scaling Configuration:**

```bash
gcloud run services update proxy-service \
  --min-instances=2 \
  --max-instances=20 \
  --cpu-throttling \
  --concurrency=80
```

**Scaling Triggers:**

- CPU utilization > 70%
- Request count > 80 per instance
- Memory utilization > 80%

### Vertical Scaling

**Increase Resources:**

```bash
gcloud run services update proxy-service \
  --memory=8Gi \
  --cpu=4
```

### Caching Strategy

**Redis Cache Implementation:**

```python
import redis
import json

redis_client = redis.Redis(host='REDIS_HOST', port=6379)

def get_cached_response(query_hash: str):
    cached = redis_client.get(f"query:{query_hash}")
    if cached:
        return json.loads(cached)
    return None

def cache_response(query_hash: str, response: dict, ttl: int = 300):
    redis_client.setex(
        f"query:{query_hash}",
        ttl,
        json.dumps(response)
    )
```

## Backup and Recovery

### Database Backups

```bash
# Firestore backup
gcloud firestore export gs://$PROJECT_ID-backups/firestore/$(date +%Y%m%d)

# Schedule daily backups
gcloud scheduler jobs create http firestore-backup \
  --schedule="0 2 * * *" \
  --uri="https://firestore.googleapis.com/v1/projects/$PROJECT_ID/databases/(default):exportDocuments" \
  --message-body='{"outputUriPrefix":"gs://'$PROJECT_ID'-backups/firestore"}'
```

### RAG Corpus Backup

```bash
# Export RAG corpus
python scripts/export_rag_corpus.py \
  --project=$PROJECT_ID \
  --location=$LOCATION \
  --output=gs://$PROJECT_ID-backups/rag/$(date +%Y%m%d)
```

### Disaster Recovery

**Recovery Time Objective (RTO):** 4 hours
**Recovery Point Objective (RPO):** 24 hours

**Recovery Steps:**

1. Restore Firestore from latest backup
2. Restore RAG corpus from latest backup
3. Redeploy Cloud Run services
4. Verify health checks
5. Resume traffic

## Cost Optimization

### Cost Breakdown

| Service             | Monthly Cost (Est.) |
| ------------------- | ------------------- |
| Cloud Run (Proxy)   | $200-500            |
| Cloud Run (Workers) | $300-800            |
| Vertex AI (RAG)     | $100-300            |
| Cloud Storage       | $50-150             |
| External APIs       | $200-1000           |
| Networking          | $50-100             |
| **Total**           | **$900-2850**       |

### Optimization Strategies

1. **Reduce Cold Starts**
   - Maintain minimum instances
   - Use Cloud Run always-allocated CPU

2. **Optimize API Usage**
   - Cache API responses
   - Batch API calls where possible
   - Use free tiers effectively

3. **Storage Optimization**
   - Implement lifecycle policies
   - Compress uploaded files
   - Delete old media files

4. **Right-size Resources**
   - Monitor actual usage
   - Adjust CPU/memory allocation
   - Reduce over-provisioning

## Security Best Practices

### Authentication

- Use Firebase Authentication for all requests
- Validate tokens on every request
- Implement token refresh logic

### Authorization

- Enforce user-level access control
- Isolate user data (RAG corpus, storage)
- Use service accounts with minimal permissions

### Data Protection

- Encrypt data at rest (Cloud Storage, Firestore)
- Encrypt data in transit (HTTPS, TLS)
- Implement data retention policies

### API Security

- Store API keys in Secret Manager
- Rotate keys regularly
- Monitor for unauthorized access

### Network Security

- Use Cloud Armor for DDoS protection
- Implement rate limiting
- Restrict service-to-service communication

## Maintenance

### Regular Tasks

**Daily:**

- Monitor error rates
- Check API quota usage
- Review slow queries

**Weekly:**

- Review cost reports
- Analyze usage patterns
- Update documentation

**Monthly:**

- Rotate API keys
- Review and update dependencies
- Performance testing
- Security audit

### Update Procedure

1. **Test in Staging**

   ```bash
   # Deploy to staging
   gcloud run deploy proxy-service-staging \
     --image=gcr.io/$PROJECT_ID/proxy-service:v1.1.0

   # Run tests
   pytest tests/e2e/ --env=staging
   ```

2. **Gradual Rollout**

   ```bash
   # Deploy with traffic split
   gcloud run services update-traffic proxy-service \
     --to-revisions=LATEST=10,PREVIOUS=90

   # Monitor metrics for 1 hour

   # Increase traffic gradually
   gcloud run services update-traffic proxy-service \
     --to-revisions=LATEST=50,PREVIOUS=50

   # Full rollout
   gcloud run services update-traffic proxy-service \
     --to-revisions=LATEST=100
   ```

3. **Rollback if Needed**
   ```bash
   gcloud run services update-traffic proxy-service \
     --to-revisions=PREVIOUS=100
   ```
