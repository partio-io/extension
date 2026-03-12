import type { CheckpointMetadata } from "../types/checkpoint";
import type { ListCheckpointsResponse, AppUrlResponse } from "../types/messages";

const PARTIO_BADGE_CLASS = "partio-commit-badge";
const COMMIT_SHA_RE = /\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,40})/;

/**
 * Scan the page for commit links and annotate ones that have checkpoints
 * with a small Partio icon linking to the checkpoint detail.
 */
export async function annotateCommitList(): Promise<void> {
  // Find all commit links on the page
  const commitLinks = document.querySelectorAll<HTMLAnchorElement>('a[href*="/commit/"]');
  if (commitLinks.length === 0) return;

  // Extract unique owner/repo pairs and their SHAs
  const repoCommits = new Map<string, { owner: string; repo: string; shas: Map<string, HTMLElement[]> }>();

  for (const link of commitLinks) {
    // Skip if already annotated
    if (link.parentElement?.querySelector(`.${PARTIO_BADGE_CLASS}`)) continue;

    const match = link.href.match(COMMIT_SHA_RE);
    if (!match) continue;

    const [, owner, repo, sha] = match;
    const key = `${owner}/${repo}`;

    if (!repoCommits.has(key)) {
      repoCommits.set(key, { owner, repo, shas: new Map() });
    }

    const entry = repoCommits.get(key)!;
    if (!entry.shas.has(sha)) {
      entry.shas.set(sha, []);
    }
    entry.shas.get(sha)!.push(link);
  }

  if (repoCommits.size === 0) return;

  // Get the app URL
  const appUrlRes = (await chrome.runtime.sendMessage({
    type: "GET_APP_URL",
  })) as AppUrlResponse;
  const appUrl = appUrlRes.success ? appUrlRes.data : "";

  // For each repo, fetch all checkpoints and match
  for (const [, { owner, repo, shas }] of repoCommits) {
    try {
      const listRes = (await chrome.runtime.sendMessage({
        type: "LIST_CHECKPOINTS",
        owner,
        repo,
      })) as ListCheckpointsResponse;

      if (!listRes.success) continue;

      // Build a map of commit_hash -> checkpoint for fast lookup
      const cpBySha = new Map<string, CheckpointMetadata>();
      for (const cp of listRes.data) {
        cpBySha.set(cp.commit_hash.toLowerCase(), cp);
      }

      // Annotate matching commits
      for (const [sha, links] of shas) {
        const shaLower = sha.toLowerCase();
        // Try exact match first, then prefix match
        let matched: CheckpointMetadata | undefined = cpBySha.get(shaLower);
        if (!matched) {
          for (const [cpSha, cp] of cpBySha) {
            if (cpSha.startsWith(shaLower) || shaLower.startsWith(cpSha)) {
              matched = cp;
              break;
            }
          }
        }

        if (matched) {
          for (const link of links) {
            addCheckpointBadge(link, matched, appUrl, owner, repo);
          }
        }
      }
    } catch (err) {
      console.error("[Partio] Failed to annotate commits for", owner, repo, err);
    }
  }
}

function addCheckpointBadge(
  link: HTMLElement,
  checkpoint: CheckpointMetadata,
  appUrl: string,
  owner: string,
  repo: string
): void {
  // Don't duplicate
  if (link.parentElement?.querySelector(`.${PARTIO_BADGE_CLASS}`)) return;

  const badge = document.createElement("a");
  badge.className = PARTIO_BADGE_CLASS;
  badge.title = `Partio checkpoint: ${checkpoint.agent} (${checkpoint.agent_percent}% AI-authored)`;
  badge.target = "_blank";
  badge.rel = "noopener";
  if (appUrl) {
    badge.href = `${appUrl}/${owner}/${repo}/${checkpoint.id}`;
  }
  badge.innerHTML = `<svg width="16" height="16" viewBox="0 0 200 200" fill="none"><rect width="200" height="200" rx="44" fill="#7B2D8E"/><path d="M 100 174 C 148 174, 168 148, 165 112 C 163 88, 155 72, 148 62 C 142 48, 146 34, 143 26 C 139 20, 132 28, 126 44 C 120 56, 112 62, 100 64 C 88 62, 80 56, 74 44 C 68 28, 61 20, 57 26 C 54 34, 58 48, 52 62 C 45 72, 37 88, 35 112 C 32 148, 52 174, 100 174 Z" fill="white"/><circle cx="78" cy="108" r="20" fill="#7B2D8E"/><circle cx="72" cy="102" r="5" fill="white"/><circle cx="122" cy="108" r="20" fill="#7B2D8E"/><circle cx="116" cy="102" r="5" fill="white"/><ellipse cx="100" cy="137" rx="6" ry="5" fill="#7B2D8E"/></svg>`;

  // Insert right after the link
  link.insertAdjacentElement("afterend", badge);
}
