import os
import json
import hashlib
import time
import urllib.request
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
ssm = boto3.client('ssm')

TABLE_NAME = os.environ.get('CACHE_TABLE_NAME')
SSM_PARAM_NAME = os.environ.get('ANTHROPIC_KEY_PARAM_NAME', '/privaknow/anthropic_api_key')
CACHE_TTL_DAYS = 30

table = dynamodb.Table(TABLE_NAME)
CACHED_API_KEY = None

def get_secret_api_key():
    global CACHED_API_KEY
    if CACHED_API_KEY:
        return CACHED_API_KEY
    try:
        response = ssm.get_parameter(Name=SSM_PARAM_NAME, WithDecryption=True)
        CACHED_API_KEY = response['Parameter']['Value']
        return CACHED_API_KEY
    except ClientError as e:
        print(f"Error fetching SSM parameter: {e}")
        raise e

def compute_sha256(text: str) -> str:
    normalized = " ".join(text.split())
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

def call_claude_api(api_key: str, policy_text: str) -> dict:
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }

    system_prompt = "You are a privacy policy analyst. Return ONLY raw JSON. No markdown, no backticks, no commentary."
    user_instruction = (
        "Analyze this privacy policy or terms of service. Return ONLY a JSON object with this exact shape:\n"
        "{\n"
        "  \"overall_risk\": \"low\"|\"medium\"|\"high\",\n"
        "  \"summary\": \"plain English summary string\",\n"
        "  \"categories\": [\n"
        "    { \"name\": \"string\", \"risk\": \"low\"|\"medium\"|\"high\", \"finding\": \"string under 15 words\" }\n"
        "  ]\n"
        "}\n"
        "Cover these categories: Data collection, Third-party sharing, Your deletion rights, Tracking, Children's data.\n"
        "Keep each finding under 15 words. Be direct and plain.\n\n"
        f"Policy text:\n{policy_text[:12000]}"
    )

    payload = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 1024,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_instruction}]
    }

    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
    with urllib.request.urlopen(req, timeout=20) as resp:
        res_data = json.loads(resp.read().decode('utf-8'))
        raw_text = res_data['content'][0]['text'].strip()

        if raw_text.startswith("```json"):
            raw_text = raw_text.split("```json")[1].split("```")[0].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1].split("```")[0].strip()

        return json.loads(raw_text)

def lambda_handler(event, context):
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {"statusCode": 200, "headers": cors_headers, "body": ""}

    try:
        body = json.loads(event.get('body', '{}'))
        policy_text = body.get('text', '')
        page_url = body.get('url', '')

        if not policy_text or len(policy_text.strip()) < 100:
            return {
                "statusCode": 400,
                "headers": cors_headers,
                "body": json.dumps({"error": "Missing or insufficient policy text."})
            }

        policy_hash = compute_sha256(policy_text)

        # 1. DynamoDB Cache Lookup
        cache_resp = table.get_item(Key={"PolicyHash": policy_hash})
        cached_item = cache_resp.get('Item')

        if cached_item:
            return {
                "statusCode": 200,
                "headers": cors_headers,
                "body": json.dumps({
                    "source": "cache",
                    "policy_hash": policy_hash,
                    "analysis": cached_item['Analysis']
                })
            }

        # 2. Cache Miss: Query Claude
        api_key = get_secret_api_key()
        analysis = call_claude_api(api_key, policy_text)

        # 3. Store in DynamoDB (30-day TTL)
        ttl = int(time.time()) + (CACHE_TTL_DAYS * 86400)
        table.put_item(
            Item={
                "PolicyHash": policy_hash,
                "PageUrl": page_url,
                "Analysis": analysis,
                "CreatedAt": int(time.time()),
                "ExpiresAt": ttl
            }
        )

        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": json.dumps({
                "source": "live_llm",
                "policy_hash": policy_hash,
                "analysis": analysis
            })
        }

    except Exception as e:
        print(f"Handler error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps({"error": "Failed to analyze policy document."})
        }