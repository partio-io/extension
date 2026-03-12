import { detectPage } from "./detector";
import { buildPanelHTML, type PanelData } from "./ui";
import { injectPanel } from "./injector";
import { annotateCommitList } from "./commit-list";
import type {
  CheckpointResponse,
  SessionResponse,
  PlanResponse,
  FindCheckpointResponse,
  CommitContextResponse,
  PrContextResponse,
  AppUrlResponse,
} from "../types/messages";

async function run(): Promise<void> {
  console.log("[Partio] Content script running on", window.location.pathname);

  // Always try to annotate commit lists (works on commits pages, PR commits tab, etc.)
  annotateCommitList();

  const page = detectPage();
  console.log("[Partio] detectPage result:", page);
  if (!page) return;

  const { owner, repo } = page;

  // Get app URL for "View in Partio" links
  const appUrlRes = (await chrome.runtime.sendMessage({
    type: "GET_APP_URL",
  })) as AppUrlResponse;
  const appUrl = appUrlRes.success ? appUrlRes.data : "";

  // If we found a trailer in the DOM, use it directly
  let checkpointId = page.checkpointId;

  if (!checkpointId) {
    // Gather all candidate SHAs and branches from every signal we have
    const allShas: string[] = [];
    const allBranches: string[] = [];

    // If we have a SHA (commit page or PR commit view), get its context
    if (page.sha) {
      console.log("[Partio] Resolving commit context for", page.sha);
      allShas.push(page.sha);

      const ctxRes = (await chrome.runtime.sendMessage({
        type: "GET_COMMIT_CONTEXT",
        owner,
        repo,
        sha: page.sha,
      })) as CommitContextResponse;

      console.log("[Partio] Commit context:", ctxRes);
      if (ctxRes.success) {
        allShas.push(...ctxRes.data.shas);
        allBranches.push(...ctxRes.data.branches);
      }
    }

    // If we have a PR number, get its context too
    if (page.prNumber) {
      console.log("[Partio] Resolving PR context for #" + page.prNumber);

      const prRes = (await chrome.runtime.sendMessage({
        type: "GET_PR_CONTEXT",
        owner,
        repo,
        prNumber: page.prNumber,
      })) as PrContextResponse;

      console.log("[Partio] PR context:", prRes);
      if (prRes.success) {
        allShas.push(...prRes.data.shas);
        allBranches.push(...prRes.data.branches);
      }
    }

    // Deduplicate
    const shas = [...new Set(allShas)];
    const branches = [...new Set(allBranches)];

    if (shas.length === 0 && branches.length === 0) {
      console.log("[Partio] No SHAs or branches to search, exiting");
      return;
    }

    console.log("[Partio] Looking up checkpoint with", shas.length, "SHAs and", branches.length, "branches");

    const lookupRes = (await chrome.runtime.sendMessage({
      type: "FIND_CHECKPOINT",
      owner,
      repo,
      shas,
      branches,
    })) as FindCheckpointResponse;

    console.log("[Partio] FIND_CHECKPOINT response:", lookupRes);

    if (!lookupRes.success) {
      console.log("[Partio] No checkpoint found, exiting");
      return;
    }
    checkpointId = lookupRes.data.id;
  }

  console.log("[Partio] Using checkpointId:", checkpointId);

  try {
    const [checkpointRes, sessionRes, planRes] = await Promise.all([
      chrome.runtime.sendMessage({
        type: "GET_CHECKPOINT",
        owner,
        repo,
        checkpointId,
      }) as Promise<CheckpointResponse>,
      chrome.runtime.sendMessage({
        type: "GET_SESSION",
        owner,
        repo,
        checkpointId,
      }) as Promise<SessionResponse>,
      chrome.runtime.sendMessage({
        type: "GET_PLAN",
        owner,
        repo,
        checkpointId,
      }) as Promise<PlanResponse>,
    ]);

    console.log("[Partio] checkpoint:", checkpointRes);
    console.log("[Partio] session:", sessionRes);
    console.log("[Partio] plan:", planRes);

    const data: PanelData = {
      checkpoint: checkpointRes.success ? checkpointRes.data : null,
      messages: sessionRes.success ? sessionRes.data : [],
      plan: planRes.success ? planRes.data : "",
      appUrl,
      owner,
      repo,
    };

    const html = buildPanelHTML(data);
    console.log("[Partio] Panel HTML length:", html.length);
    injectPanel(html);
  } catch (err) {
    console.error("[Partio] Failed to load checkpoint data:", err);
  }
}

run();

document.addEventListener("turbo:load", () => run());
document.addEventListener("pjax:end", () => run());
