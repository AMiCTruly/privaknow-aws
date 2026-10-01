(() => {
  "use strict";

  // Shared policy-related terms used for URL and heading checks.
  const POLICY_KEYWORDS = ["privacy", "terms", "tos", "legal", "policy"];

  /**
   * Returns true if the page URL or top-level headings indicate this is
   * a Terms of Service / Privacy / Legal policy page.
   */
  function isPolicyPage() {
    const currentUrl = window.location.href.toLowerCase();
    const urlHasPolicyKeyword = POLICY_KEYWORDS.some((keyword) => currentUrl.includes(keyword));

    if (urlHasPolicyKeyword) {
      return true;
    }

    const headingNodes = document.querySelectorAll("h1, h2");
    for (const node of headingNodes) {
      const headingText = (node.textContent || "").toLowerCase();
      if (POLICY_KEYWORDS.some((keyword) => headingText.includes(keyword))) {
        return true;
      }
    }

    return false;
  }

  function notifyBackgroundIfPolicyPage() {
    if (!isPolicyPage()) {
      return;
    }

    chrome.runtime.sendMessage({
      type: "POLICY_PAGE_DETECTED"
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", notifyBackgroundIfPolicyPage, { once: true });
  } else {
    notifyBackgroundIfPolicyPage();
  }
})();
