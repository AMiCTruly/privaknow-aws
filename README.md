PrivaKnow — Serverless AI Privacy Policy Analyzer

An event-driven, serverless cloud service that extracts structured risk assessments from privacy policies using Claude Haiku. It implements a cache-aside pattern backed by Amazon DynamoDB and cryptographic hashing (SHA-256) to eliminate redundant LLM API costs and reduce latency by over 98% on repeat analyses.
Architecture Overview
Code snippet

flowchart LR
    subgraph ClientLayer ["Client Layer"]
        Client["Client / Frontend<br/>(Browser / Extension)"]
    end

    subgraph AWSCloud ["AWS Cloud (us-east-1)"]
        APIGW["Amazon API Gateway<br/>(HTTP API: POST /analyze)"]
        Lambda["AWS Lambda<br/>(privaknow-policy-analyzer)"]
        DDB[("Amazon DynamoDB<br/>(privaknow-policy-cache)")]
        SSM["AWS Systems Manager<br/>(SSM Parameter Store)"]
    end

    subgraph ExternalSaaS ["External SaaS"]
        Claude["Anthropic API<br/>(Claude Haiku)"]
    end

    Client -->|HTTPS POST /analyze| APIGW
    APIGW -->|Proxy Integration| Lambda
    Lambda <-->|SHA-256 Hash Lookup / PutItem| DDB
    Lambda -->|GetParameter Decrypted Key| SSM
    Lambda <-->|HTTPS REST Messages API| Claude

Request Lifecycle & Cache-Aside Flow

    Ingress: The client sends an HTTPS POST request containing policy text and source URL to API Gateway (/analyze).

    Deterministic Hashing: The Lambda function hashes the incoming policy text using SHA-256 to create a unique 64-character fingerprint (PolicyHash).

    Cache Lookup: Lambda queries the privaknow-policy-cache DynamoDB table using PolicyHash as the primary key.

        Cache Hit ("source": "cache"): Returns the cached risk analysis immediately in ~15–25ms without invoking the LLM, avoiding third-party API charges.

        Cache Miss ("source": "live_llm"):

            Lambda retrieves the encrypted Anthropic API key from SSM Parameter Store at runtime.

            Dispatches a structured inference prompt to Anthropic's Messages API (claude-haiku-4-5-20251001).

            Writes the resulting risk scores, categories, and findings to DynamoDB.

            Returns the structured JSON response in ~1.2–2.0s.

Engineering Highlights

    Cost & Latency Optimization: Implemented a DynamoDB cache-aside layer that reduces response latency from ~1,500ms to <25ms on identical policies, while reducing downstream LLM token consumption to zero for cached text.

    Zero-Trust Secret Management: API credentials are decoupled from application code and runtime environment variables, dynamically loaded and decrypted via AWS SSM Parameter Store (SecureString).

    Standardized JSON Schema: Enforces consistent multi-dimensional privacy evaluations across five key domains: Data Collection, Third-Party Sharing, Deletion Rights, Tracking, and Children's Data.

    Infrastructure as Code (IaC): 100% of AWS resources (API Gateway v2, Lambda, DynamoDB, IAM execution roles, SSM parameters) are declared in Terraform with automated CI/CD via GitHub Actions.

Tech Stack

    Cloud Provider: Amazon Web Services (AWS)

    Compute: AWS Lambda (Python 3.12 runtime)

    API Layer: Amazon API Gateway (HTTP API v2)

    Database & Caching: Amazon DynamoDB (On-Demand billing)

    Configuration & Security: AWS Systems Manager (SSM) Parameter Store, AWS IAM (least-privilege policies)

    AI / Inference: Anthropic Claude Messages API

    Infrastructure as Code: Terraform

    CI/CD: GitHub Actions

API Specification
Analyze Policy

POST /analyze
Request Headers
HTTP

Content-Type: application/json

Request Body
JSON

{
  "text": "We collect personal identification information including your full name, email address, and IP location. We do not sell your personal data to third parties. You can request complete deletion of your account and collected records at any time by contacting our support team.",
  "url": "https://example.com/privacy"
}

Response Body (200 OK)
JSON

{
  "source": "live_llm",
  "policy_hash": "47466912dc6952b0aeee1938f6c0376df1cb3e1a1deb5e087db9cf98365389bb",
  "analysis": {
    "overall_risk": "low",
    "summary": "This company collects basic personal data but doesn't sell to third parties. Users can delete their accounts on request. No mention of tracking or children's data protections.",
    "categories": [
      {
        "name": "Data collection",
        "risk": "low",
        "finding": "Collects name, email, IP location. Reasonable scope for basic service operations."
      },
      {
        "name": "Third-party sharing",
        "risk": "low",
        "finding": "Explicitly states no sale of personal data to third parties."
      },
      {
        "name": "Your deletion rights",
        "risk": "low",
        "finding": "Users can request account and data deletion via support team anytime."
      },
      {
        "name": "Tracking",
        "risk": "medium",
        "finding": "No tracking disclosures mentioned. Unclear if cookies or analytics used."
      },
      {
        "name": "Children's data",
        "risk": "high",
        "finding": "No age restrictions or children's data protections mentioned at all."
      }
    ]
  }
}

Subsequent requests containing identical policy text return "source": "cache" with the same JSON payload.
Repository Structure
Plaintext

.
├── backend/
│   ├── lambda_function.py      # Core Lambda handler, SSM resolution, DynamoDB cache logic
│   └── tests/                  # Local unit and payload mock tests
├── infra/
│   ├── main.tf                 # Terraform definitions: Lambda, DynamoDB, API Gateway, IAM
│   ├── variables.tf            # Input variables and environment configurations
│   └── outputs.tf              # HTTP API endpoint outputs
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD pipeline
└── README.md

Local Deployment & Setup
Prerequisites

    AWS CLI configured with administrator or deployer credentials (aws configure)

    Terraform >= 1.5.0

    Python >= 3.12

    Anthropic API Key

Step 1: Provision Secret in SSM

Store your Anthropic API key as an encrypted parameter:
Bash

aws ssm put-parameter \
  --name "/privaknow/anthropic_api_key" \
  --value "sk-ant-your-actual-key" \
  --type "SecureString" \
  --region us-east-1

Step 2: Deploy Infrastructure via Terraform
Bash

cd infra
terraform init
terraform plan
terraform apply -auto-approve

Step 3: Test the Live Endpoint
Bash

curl -X POST "https://<your-api-id>.execute-api.us-east-1.amazonaws.com/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "We do not sell personal data. Data is retained for 30 days.",
    "url": "https://example.com/terms"
  }'