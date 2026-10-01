"use strict";

// Replace with the Terraform output URL
const BACKEND_ENDPOINT = "https://abs3dp34k8.execute-api.us-east-1.amazonaws.com/analyze";

/**
 * Dispatches policy text and page URL to the secure AWS Lambda backend.
 *
 * @param {string} pageText
 * @param {string} pageUrl
 * @returns {Promise<{overall_risk: "low"|"medium"|"high", summary: string, categories: Array<{name: string, risk: "low"|"medium"|"high", finding: string}>}>}
 */
async function analyzePolicyPage(pageText, pageUrl) {
  if (!pageText || typeof pageText !== "string") {
    throw new Error("Missing policy page text for analysis.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(BACKEND_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        text: pageText,
        url: pageUrl || ""
      })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      throw new Error(errorJson?.error || `Server error (${response.status})`);
    }

    const payload = await response.json();
    return payload.analysis;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw new Error(`Analysis failed: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

self.analyzePolicyPage = analyzePolicyPage;