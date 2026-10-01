(() => {
  const PRIVAKNOW_FLAG_ID = "privaknow-detected-banner";

  function isLikelyPolicyPage() {
    const title = document.title.toLowerCase();
    const url = window.location.href.toLowerCase();
    const textSample = (document.body?.innerText || "").slice(0, 5000).toLowerCase();

    const keywords = [
      "terms and conditions",
      "terms & conditions",
      "terms of service",
      "terms of use",
      "privacy policy",
      "data protection policy",
      "cookie policy"
    ];

    const strongMatch =
      keywords.some(k => title.includes(k)) ||
      keywords.some(k => url.includes(k));

    if (strongMatch) return true;

    const matchCount = keywords.reduce(
      (count, k) => (textSample.includes(k) ? count + 1 : count),
      0
    );

    return matchCount >= 2;
  }

  function createBanner() {
    if (document.getElementById(PRIVAKNOW_FLAG_ID)) return;

    const container = document.createElement("div");
    container.id = PRIVAKNOW_FLAG_ID;
    container.className = "privaknow-banner";

    const text = document.createElement("span");
    text.textContent = "Privaknow detected a T&C/Privacy Policy page.";

    const closeBtn = document.createElement("button");
    closeBtn.className = "privaknow-banner-close";
    closeBtn.textContent = "×";
    closeBtn.title = "Dismiss";
    closeBtn.addEventListener("click", () => {
      container.remove();
    });

    container.appendChild(text);
    container.appendChild(closeBtn);
    document.documentElement.appendChild(container);
  }

  function maybeShowBanner() {
    if (!document.body) return;
    if (!isLikelyPolicyPage()) return;
    createBanner();
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    maybeShowBanner();
  } else {
    window.addEventListener("DOMContentLoaded", maybeShowBanner, { once: true });
  }
})();

