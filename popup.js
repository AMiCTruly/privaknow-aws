"use strict";

const contentEl = document.getElementById("content");
const scanStatusEl = document.getElementById("scanStatus");

const RISK_META = {
  high:   { cls: "pk-badge-high",   label: "HIGH RISK" },
  medium: { cls: "pk-badge-medium", label: "MEDIUM RISK" },
  low:    { cls: "pk-badge-low",    label: "LOW RISK" },
};

const ICON_META = {
  high:   { cls: "pk-icon-danger", sym: "✕" },
  medium: { cls: "pk-icon-warn",   sym: "!" },
  low:    { cls: "pk-icon-safe",   sym: "✓" },
};

const RISK_SCORE = { high: 25, medium: 55, low: 85 };

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
  });
}

function getLocalValue(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key]));
  });
}

function getAnalysisKey(tabUrl) {
  return `analysis_${tabUrl}`;
}

function clearContent() {
  if (contentEl) contentEl.innerHTML = "";
}

function showLoading() {
  if (!contentEl) return;
  contentEl.innerHTML = `
    <div class="pk-skeleton" aria-label="Loading summary">
      <div class="pk-skel-bar"></div>
      <div class="pk-skel-bar"></div>
      <div class="pk-skel-bar"></div>
      <div class="pk-skel-bar"></div>
    </div>
  `;
}

function showNoPolicyState() {
  if (!contentEl) return;
  contentEl.innerHTML = `
    <div class="pk-state">
      <p class="pk-state-text">No policy page detected on this tab.</p>
    </div>
  `;
}

function showApiError(message) {
  if (!contentEl) return;
  const safeMessage = message || "Unable to analyze this policy page right now.";
  contentEl.innerHTML = `
    <div class="pk-state">
      <p class="pk-state-text error">${safeMessage}</p>
    </div>
  `;
}

function buildRiskBadge(risk) {
  const meta = RISK_META[risk] || { cls: "pk-badge-unknown", label: (risk || "UNKNOWN").toUpperCase() + " RISK" };
  const badge = document.createElement("span");
  badge.className = `pk-badge ${meta.cls}`;
  badge.textContent = meta.label;
  return badge;
}

function buildScoreBar(risk) {
  const score = RISK_SCORE[risk] || 50;
  const wrap = document.createElement("div");
  wrap.className = "pk-score-bar";
  wrap.innerHTML = `
    <span class="pk-score-label">PRIVACY</span>
    <div class="pk-score-track">
      <div class="pk-score-fill" style="width:0%"></div>
    </div>
    <span class="pk-score-label">${score}/100</span>
  `;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const fill = wrap.querySelector(".pk-score-fill");
      if (fill) fill.style.width = `${score}%`;
    });
  });

  return wrap;
}

function buildServiceBlock(tabUrl, risk) {
  let hostname = "";
  try {
    hostname = new URL(tabUrl).hostname.replace(/^www\./, "");
  } catch (_) {
    hostname = tabUrl || "";
  }

  const block = document.createElement("div");
  block.className = "pk-service-block";

  const row = document.createElement("div");
  row.className = "pk-service-row";

  const nameGroup = document.createElement("div");

  const name = document.createElement("div");
  name.className = "pk-service-name";
  name.textContent = hostname;

  const url = document.createElement("div");
  url.className = "pk-service-url";
  url.textContent = hostname;

  nameGroup.appendChild(name);
  nameGroup.appendChild(url);
  row.appendChild(nameGroup);
  row.appendChild(buildRiskBadge(risk));
  block.appendChild(row);
  return block;
}

function buildSummaryBlock(summary, risk) {
  const block = document.createElement("div");
  block.className = "pk-summary";
  block.textContent = summary;

  if (risk === "high" || risk === "medium") {
    const why = document.createElement("div");
    why.className = "pk-why-matters";
    why.textContent = risk === "high"
      ? "⚠ Review carefully before submitting sensitive information on this page."
      : "⚠ Some data practices may not align with your expectations — see details below.";
    block.appendChild(why);
  }

  return block;
}

function buildCategoryItem(category) {
  const risk = category.risk || "unknown";
  const iconMeta = ICON_META[risk] || { cls: "pk-icon-unknown", sym: "?" };

  const item = document.createElement("div");
  item.className = "pk-item";

  const icon = document.createElement("div");
  icon.className = `pk-item-icon ${iconMeta.cls}`;
  icon.textContent = iconMeta.sym;

  const body = document.createElement("div");
  body.className = "pk-item-body";

  const label = document.createElement("div");
  label.className = "pk-item-label";
  label.textContent = category.name || "Uncategorized";

  const finding = document.createElement("div");
  finding.className = "pk-item-text";
  finding.textContent = category.finding || "";

  body.appendChild(label);
  body.appendChild(finding);
  item.appendChild(icon);
  item.appendChild(body);
  return item;
}

function buildFooter() {
  const footer = document.createElement("div");
  footer.className = "pk-footer";

  const ratingBtn = document.createElement("button");
  ratingBtn.className = "pk-btn-ghost";
  ratingBtn.type = "button";
  ratingBtn.textContent = "How we rate this";
  ratingBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://privaknow.com/methodology" });
  });

  footer.appendChild(ratingBtn);
  return footer;
}

function renderSummary(data, tabUrl) {
  if (!contentEl) return;
  clearContent();

  if (scanStatusEl) scanStatusEl.style.display = "flex";

  const risk = data.overall_risk;
  const summary = typeof data.summary === "string" ? data.summary : "";
  const categories = Array.isArray(data.categories) ? data.categories : [];

  contentEl.appendChild(buildServiceBlock(tabUrl, risk));
  contentEl.appendChild(buildScoreBar(risk));
  contentEl.appendChild(buildSummaryBlock(summary, risk));

  const divider = document.createElement("div");
  divider.className = "pk-divider";
  contentEl.appendChild(divider);

  const itemsWrap = document.createElement("div");
  itemsWrap.className = "pk-items";
  categories.forEach((cat) => itemsWrap.appendChild(buildCategoryItem(cat)));
  contentEl.appendChild(itemsWrap);

  contentEl.appendChild(buildFooter());
}

function isValidSummary(data) {
  if (!data || typeof data !== "object") return false;
  const validRisk = data.overall_risk === "low" || data.overall_risk === "medium" || data.overall_risk === "high";
  return validRisk && typeof data.summary === "string" && Array.isArray(data.categories);
}

async function waitForSummary(tabUrl, timeoutMs) {
  const pollDelayMs = 800;
  const startTime = Date.now();
  const analysisKey = getAnalysisKey(tabUrl);

  while (Date.now() - startTime < timeoutMs) {
    const cachedValue = await getLocalValue(analysisKey);
    if (cachedValue !== undefined) return cachedValue;
    await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
  }

  return null;
}

async function initPopup() {
  const activeTab = await getActiveTab();
  if (!activeTab || !activeTab.url) {
    showNoPolicyState();
    return;
  }

  const tabUrl = activeTab.url;
  const analysisKey = getAnalysisKey(tabUrl);
  let cached = await getLocalValue(analysisKey);

  if (cached === undefined) {
    showLoading();
    cached = await waitForSummary(tabUrl, 30000);
  }

  if (cached === null || cached === undefined) {
    showNoPolicyState();
    return;
  }

  if (cached.error === "api_error") {
    showApiError(cached.message);
    return;
  }

  if (isValidSummary(cached)) {
    renderSummary(cached, tabUrl);
    return;
  }

  showNoPolicyState();
}

initPopup().catch((error) => {
  console.error("Popup initialization failed.", error);
  showApiError(error.message);
});