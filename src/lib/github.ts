import type { CheckpointMetadata, Message } from "../types/checkpoint";
import { parseMessages } from "./jsonl-parser";

const CHECKPOINT_BRANCH = "partio/checkpoints/v1";
const API_BASE = "https://api.github.com";

interface TreeEntry {
  path: string;
  sha: string;
  type: string;
}

async function apiFetch(path: string, token: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

async function getTree(
  owner: string,
  repo: string,
  token: string
): Promise<TreeEntry[]> {
  const ref = await apiFetch(
    `/repos/${owner}/${repo}/git/ref/heads/${CHECKPOINT_BRANCH}`,
    token
  );
  const commit = await apiFetch(
    `/repos/${owner}/${repo}/git/commits/${ref.object.sha}`,
    token
  );
  const tree = await apiFetch(
    `/repos/${owner}/${repo}/git/trees/${commit.tree.sha}?recursive=1`,
    token
  );
  return (tree.tree || []) as TreeEntry[];
}

function decodeBase64(encoded: string): string {
  const binary = atob(encoded.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

async function getBlobContent(
  owner: string,
  repo: string,
  sha: string,
  token: string
): Promise<string> {
  const blob = await apiFetch(
    `/repos/${owner}/${repo}/git/blobs/${sha}`,
    token
  );
  return decodeBase64(blob.content);
}

export async function hasCheckpointBranch(
  owner: string,
  repo: string,
  token: string
): Promise<boolean> {
  try {
    await apiFetch(
      `/repos/${owner}/${repo}/git/ref/heads/${CHECKPOINT_BRANCH}`,
      token
    );
    return true;
  } catch {
    return false;
  }
}

const METADATA_PATH_RE = /^[0-9a-f]{2}\/[0-9a-f]{10}\/metadata\.json$/;

export async function listAllCheckpoints(
  owner: string,
  repo: string,
  token: string
): Promise<CheckpointMetadata[]> {
  try {
    const tree = await getTree(owner, repo, token);
    const metadataEntries = tree.filter(
      (e) => e.path && METADATA_PATH_RE.test(e.path)
    );

    const results = await Promise.allSettled(
      metadataEntries.map(async (entry) => {
        const content = await getBlobContent(owner, repo, entry.sha, token);
        return JSON.parse(content) as CheckpointMetadata;
      })
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<CheckpointMetadata> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value);
  } catch {
    return [];
  }
}

export interface CommitContext {
  shas: string[];
  branches: string[];
}

export async function findCheckpoint(
  owner: string,
  repo: string,
  shas: string[],
  branches: string[],
  token: string
): Promise<CheckpointMetadata | null> {
  const shaSet = new Set(shas.map((s) => s.toLowerCase()));
  const branchSet = new Set(branches.map((b) => b.toLowerCase()));
  const checkpoints = await listAllCheckpoints(owner, repo, token);

  console.log("[Partio] findCheckpoint: searching", checkpoints.length, "checkpoints");
  console.log("[Partio] findCheckpoint: candidate SHAs:", [...shaSet]);
  console.log("[Partio] findCheckpoint: candidate branches:", [...branchSet]);

  // First pass: match by commit_hash (exact or prefix)
  for (const cp of checkpoints) {
    const cpHash = cp.commit_hash.toLowerCase();
    for (const sha of shaSet) {
      if (cpHash === sha || cpHash.startsWith(sha) || sha.startsWith(cpHash)) {
        console.log("[Partio] findCheckpoint: matched by SHA", cpHash, "==", sha);
        return cp;
      }
    }
  }

  // Second pass: match by branch name (for squash merges)
  if (branchSet.size > 0) {
    for (const cp of checkpoints) {
      if (cp.branch && branchSet.has(cp.branch.toLowerCase())) {
        console.log("[Partio] findCheckpoint: matched by branch", cp.branch);
        return cp;
      }
    }
  }

  console.log("[Partio] findCheckpoint: no match found");
  return null;
}

/**
 * Gather all context about a commit that helps match it to a checkpoint:
 * candidate SHAs and source branch names from associated PRs.
 */
export async function getCommitContext(
  owner: string,
  repo: string,
  sha: string,
  token: string
): Promise<CommitContext> {
  const shas = [sha];
  const branches: string[] = [];

  // Get commit parents
  try {
    const commit = await apiFetch(
      `/repos/${owner}/${repo}/commits/${sha}`,
      token
    );
    const parents: { sha: string }[] = commit.parents || [];
    shas.push(...parents.map((p) => p.sha));

    // Regular merge (2+ parents): get merged commits
    if (parents.length >= 2) {
      try {
        const compare = await apiFetch(
          `/repos/${owner}/${repo}/compare/${parents[0].sha}...${parents[1].sha}`,
          token
        );
        shas.push(...(compare.commits || []).map((c: any) => c.sha as string));
      } catch { /* continue */ }
    }
  } catch { /* continue */ }

  // Get associated PRs — extract branch names and PR commit SHAs
  try {
    const pulls: any[] = await apiFetch(
      `/repos/${owner}/${repo}/commits/${sha}/pulls`,
      token
    );
    for (const pr of pulls) {
      // The PR's head branch is the feature branch that was merged
      if (pr.head?.ref) {
        branches.push(pr.head.ref);
        console.log("[Partio] PR", pr.number, "head branch:", pr.head.ref);
      }
      try {
        const prCommits: any[] = await apiFetch(
          `/repos/${owner}/${repo}/pulls/${pr.number}/commits?per_page=100`,
          token
        );
        shas.push(...prCommits.map((c: any) => c.sha as string));
      } catch { /* continue */ }
    }
  } catch { /* continue */ }

  return {
    shas: [...new Set(shas)],
    branches: [...new Set(branches)],
  };
}

/**
 * Gather context from a PR: head branch name and all commit SHAs.
 */
export async function getPrContext(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): Promise<CommitContext> {
  const shas: string[] = [];
  const branches: string[] = [];

  try {
    const pr = await apiFetch(
      `/repos/${owner}/${repo}/pulls/${prNumber}`,
      token
    );
    if (pr.head?.ref) {
      branches.push(pr.head.ref);
    }
    if (pr.head?.sha) {
      shas.push(pr.head.sha);
    }
    if (pr.merge_commit_sha) {
      shas.push(pr.merge_commit_sha);
    }
  } catch { /* continue */ }

  try {
    const prCommits: any[] = await apiFetch(
      `/repos/${owner}/${repo}/pulls/${prNumber}/commits?per_page=100`,
      token
    );
    shas.push(...prCommits.map((c: any) => c.sha as string));
  } catch { /* continue */ }

  return {
    shas: [...new Set(shas)],
    branches: [...new Set(branches)],
  };
}

export async function getCheckpointMetadata(
  owner: string,
  repo: string,
  checkpointId: string,
  token: string
): Promise<CheckpointMetadata | null> {
  const shard = checkpointId.slice(0, 2);
  const rest = checkpointId.slice(2);
  const metadataPath = `${shard}/${rest}/metadata.json`;

  try {
    const tree = await getTree(owner, repo, token);
    const entry = tree.find((e) => e.path === metadataPath);
    if (!entry) return null;

    const content = await getBlobContent(owner, repo, entry.sha, token);
    return JSON.parse(content) as CheckpointMetadata;
  } catch {
    return null;
  }
}

export async function getSessionMessages(
  owner: string,
  repo: string,
  checkpointId: string,
  token: string
): Promise<Message[]> {
  const shard = checkpointId.slice(0, 2);
  const rest = checkpointId.slice(2);
  const sessionPath = `${shard}/${rest}/0/full.jsonl`;

  try {
    const tree = await getTree(owner, repo, token);
    const entry = tree.find((e) => e.path === sessionPath);
    if (!entry) return [];

    const content = await getBlobContent(owner, repo, entry.sha, token);
    return parseMessages(content);
  } catch {
    return [];
  }
}

export async function getCheckpointPlan(
  owner: string,
  repo: string,
  checkpointId: string,
  token: string
): Promise<string> {
  const shard = checkpointId.slice(0, 2);
  const rest = checkpointId.slice(2);
  const planPath = `${shard}/${rest}/0/plan.md`;

  try {
    const tree = await getTree(owner, repo, token);
    const entry = tree.find((e) => e.path === planPath);
    if (!entry) return "";

    return await getBlobContent(owner, repo, entry.sha, token);
  } catch {
    return "";
  }
}
