"use strict";

importScripts("api.js");

const RISK_BADGE = {
  high: { text: "!", color: "#C0392B" },
  medium: { text: "?", color: "#E67E22" },
  low: { text: "✓", color: "#27AE60" }
};

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs && tabs[0] ? tabs[0] : null);
    });
  });
}

function setStorageValue(area, key, value) {
  return new Promise((resolve) => {
    area.set({ [key]: value }, () => resolve());
  });
}

function extractPageText(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: () => {
          const text = document.body && typeof document.body.innerText === "string" ? document.body.innerText : "";
          return text.slice(0, 12000);
        }
      },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        const extractedText = results && results[0] ? results[0].result : "";
        resolve((extractedText || "").trim());
      }
    );
  });
}

function applyRiskBadge(tabId, risk) {
  const badge = RISK_BADGE[risk];
  if (!badge) return;

  chrome.action.setBadgeText({ tabId, text: badge.text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
}

function getAnalysisKey(tabUrl) {
  return `analysis_${tabUrl}`;
}

async function handlePolicyPageDetected(sender) {
  let tab = sender.tab || (await getActiveTab());
  const tabId = tab && tab.id;
  const tabUrl = tab && tab.url;

  if (typeof tabId !== "number" || !tabUrl) return;

  const analysisKey = getAnalysisKey(tabUrl);

  try {
    const pageText = await extractPageText(tabId);
    if (!pageText || pageText.length < 100) {
      await setStorageValue(chrome.storage.local, analysisKey, {
        error: "no_text",
        message: "Could not read page content."
      });
      return;
    }

    const analysis = await self.analyzePolicyPage(pageText, tabUrl);
    await setStorageValue(chrome.storage.local, analysisKey, analysis);
    applyRiskBadge(tabId, analysis?.overall_risk);
  } catch (err) {
    await setStorageValue(chrome.storage.local, analysisKey, {
      error: "api_error",
      message: err?.message || "Unknown error"
    });
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "POLICY_PAGE_DETECTED") {
    handlePolicyPageDetected(sender);
  }
});