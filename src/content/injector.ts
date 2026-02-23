export function injectPanel(html: string): void {
  // Remove any existing panel
  document.getElementById("partio-container")?.remove();

  if (!html) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const panel = wrapper.firstElementChild as HTMLElement;

  const path = window.location.pathname;
  const isPrPage = /^\/[^/]+\/[^/]+\/pull\/\d+/.test(path);
  const isPrCommitView = /^\/[^/]+\/[^/]+\/pull\/\d+\/(commits|changes)\/[0-9a-f]/.test(path);

  if (isPrCommitView) {
    // PR single-commit view: inline panel after the commit attribution bar
    const strategies = [
      () => {
        const attribution = document.querySelector('[class*="CommitAttribution"]');
        const bar = attribution?.closest('.d-flex.flex-row');
        if (bar?.parentNode) {
          bar.parentNode.insertBefore(panel, bar.nextSibling);
          return true;
        }
        return false;
      },
      () => {
        const files = document.querySelector("#files");
        if (files?.parentNode) {
          files.parentNode.insertBefore(panel, files);
          return true;
        }
        return false;
      },
    ];
    for (const tryInsert of strategies) {
      if (tryInsert()) break;
    }
    attachPanelListeners(panel);
    return;
  }

  if (isPrPage) {
    // PR conversation page: insert after the PR description
    const prStrategies = [
      // After the first timeline comment (the PR description body)
      () => {
        const prBody = document.querySelector("#discussion_bucket .timeline-comment:first-child");
        if (prBody?.parentNode) {
          prBody.parentNode.insertBefore(panel, prBody.nextSibling);
          return true;
        }
        return false;
      },
      // Prepend into the discussion bucket
      () => {
        const bucket = document.querySelector("#discussion_bucket");
        if (bucket) {
          bucket.prepend(panel);
          return true;
        }
        return false;
      },
      // After the tab nav area
      () => {
        const tabList = document.querySelector('div[role="tablist"], [class*="TabNav-TabNavTabList"]');
        const nav = tabList?.closest("nav") || tabList?.parentElement;
        if (nav?.parentNode) {
          nav.parentNode.insertBefore(panel, nav.nextSibling);
          return true;
        }
        return false;
      },
      // Fallback
      () => {
        const main = document.querySelector("[role='main']") || document.body;
        main.append(panel);
        return true;
      },
    ];
    for (const tryInsert of prStrategies) {
      if (tryInsert()) break;
    }
    attachPanelListeners(panel);
    return;
  }

  // Commit page
  const commitStrategies = [
    () => {
      const divider = document.querySelector('[class*="HeaderHorizontalDivider"]');
      if (divider?.parentNode) {
        divider.parentNode.insertBefore(panel, divider.nextSibling);
        return true;
      }
      return false;
    },
    () => {
      const content = document.querySelector('[class*="PageLayoutContent"]');
      if (content?.parentNode) {
        content.parentNode.insertBefore(panel, content);
        return true;
      }
      return false;
    },
    () => {
      const commitHeader = document.querySelector(".commit.full-commit");
      if (commitHeader?.parentNode) {
        commitHeader.parentNode.insertBefore(panel, commitHeader.nextSibling);
        return true;
      }
      return false;
    },
    () => {
      const main = document.querySelector("[role='main']") || document.body;
      main.prepend(panel);
      return true;
    },
  ];
  for (const tryInsert of commitStrategies) {
    if (tryInsert()) break;
  }
  attachPanelListeners(panel);
}

function attachPanelListeners(panel: HTMLElement): void {
  // Tab switching (Plan / Transcript tabs within the Partio panel)
  const tabs = panel.querySelectorAll<HTMLElement>(".partio-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("partio-tab-active"));
      tab.classList.add("partio-tab-active");

      const target = tab.dataset.tab;
      panel.querySelectorAll<HTMLElement>(".partio-tab-content").forEach((c) => {
        c.classList.toggle("partio-tab-content-active", c.dataset.content === target);
      });
    });
  });

  // Collapse/expand — clicking anywhere on the header toggles
  const header = panel.querySelector<HTMLElement>(".partio-header");
  const body = panel.querySelector<HTMLElement>(".partio-body");
  if (header && body) {
    header.style.cursor = "pointer";
    header.addEventListener("click", () => {
      const collapsed = body.style.display === "none";
      body.style.display = collapsed ? "" : "none";
      panel.classList.toggle("partio-collapsed", !collapsed);
    });
  }

  // Show more buttons
  panel.querySelectorAll<HTMLElement>(".partio-show-more").forEach((btn) => {
    btn.addEventListener("click", () => {
      const message = btn.closest(".partio-message-content");
      if (!message) return;

      const truncated = message.querySelector<HTMLElement>(".partio-message-text");
      const full = message.querySelector<HTMLElement>(".partio-message-full");
      if (!truncated || !full) return;

      if (full.style.display === "none") {
        truncated.style.display = "none";
        full.style.display = "";
        btn.textContent = "Show less";
      } else {
        truncated.style.display = "";
        full.style.display = "none";
        btn.textContent = "Show more";
      }
    });
  });

  // Copy Plan button
  const copyPlanBtn = panel.querySelector<HTMLElement>('[data-action="copy-plan"]');
  if (copyPlanBtn) {
    copyPlanBtn.addEventListener("click", async () => {
      const rawPlan = panel.dataset.rawPlan || "";
      if (!rawPlan) return;
      await navigator.clipboard.writeText(rawPlan);
      showCopiedFeedback(copyPlanBtn, "Copy Plan");
    });
  }

  // Download Plan button
  const downloadBtn = panel.querySelector<HTMLElement>('[data-action="download-plan"]');
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const rawPlan = panel.dataset.rawPlan || "";
      if (!rawPlan) return;
      const blob = new Blob([rawPlan], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plan.md";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Resume Session button
  const resumeBtn = panel.querySelector<HTMLElement>('[data-action="resume"]');
  if (resumeBtn) {
    resumeBtn.addEventListener("click", async () => {
      const command = resumeBtn.dataset.command || "";
      if (!command) return;
      await navigator.clipboard.writeText(command);
      showCopiedFeedback(resumeBtn, "Resume Claude Code Session");
    });
  }
}

function showCopiedFeedback(btn: HTMLElement, originalText: string): void {
  const originalHTML = btn.innerHTML;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.749.749 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg> Copied!`;
  btn.classList.add("partio-copied");
  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.classList.remove("partio-copied");
  }, 2000);
}
