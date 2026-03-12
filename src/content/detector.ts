export interface PageInfo {
  owner: string;
  repo: string;
  /** Set on commit pages and PR commit views */
  sha: string | null;
  /** Set on any PR page */
  prNumber: number | null;
  /** Set if a Partio-Checkpoint trailer is found in the DOM */
  checkpointId: string | null;
}

const COMMIT_PATH_RE = /^\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]+)/;
const PR_PATH_RE = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)/;
const PR_COMMIT_PATH_RE = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/(?:commits|changes)\/([0-9a-f]+)/;
const CHECKPOINT_TRAILER_RE = /Partio-Checkpoint:\s*([0-9a-f]{12})/;

export function detectPage(): PageInfo | null {
  const path = window.location.pathname;

  // Commit page: /owner/repo/commit/sha
  const commitMatch = path.match(COMMIT_PATH_RE);
  if (commitMatch) {
    const [, owner, repo, sha] = commitMatch;
    return { owner, repo, sha, prNumber: null, checkpointId: findCheckpointId() };
  }

  // PR commit view: /owner/repo/pull/N/commits/sha or /owner/repo/pull/N/changes/sha
  // (must be checked before the general PR regex)
  const prCommitMatch = path.match(PR_COMMIT_PATH_RE);
  if (prCommitMatch) {
    const [, owner, repo, num, sha] = prCommitMatch;
    return { owner, repo, sha, prNumber: parseInt(num, 10), checkpointId: null };
  }

  // PR page: /owner/repo/pull/N[/anything]
  const prMatch = path.match(PR_PATH_RE);
  if (prMatch) {
    const [, owner, repo, num] = prMatch;
    return { owner, repo, sha: null, prNumber: parseInt(num, 10), checkpointId: null };
  }

  return null;
}

function findCheckpointId(): string | null {
  const selectors = [
    ".extended-commit-description-container",
    '[class*="commitMessageContainer"]',
    ".commit-desc pre",
    '[class*="PageHeader-Description"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const match = el.textContent?.match(CHECKPOINT_TRAILER_RE);
      if (match) return match[1];
    }
  }

  return null;
}
