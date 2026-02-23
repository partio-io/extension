# CLAUDE.md — Partio Chrome Extension

## Project Overview

Chrome extension that displays Partio plans and AI agent sessions directly on GitHub pages. It reads checkpoint data from the `partio/checkpoints/v1` orphan branch (written by the Partio CLI) and injects UI overlays into GitHub's DOM.

**Repo:** `github.com/partio-io/extension`
**Manifest:** V3
**Language:** TypeScript

## Commands

- `npm run dev` — build in watch mode for development
- `npm run build` — production build
- `npm run lint` — run ESLint
- `npm run package` — create `.zip` for Chrome Web Store

## Architecture

- **Manifest V3**: Service worker for background tasks (no persistent background page).
- **Content scripts**: Injected on `github.com/*` to detect page context (PR, commit, file view) and inject Partio UI.
- **Popup**: Settings and authentication UI.
- **GitHub API**: Uses Octokit or raw fetch with user's token to read checkpoint data from the orphan branch.

## Key Concepts

- **Checkpoints**: Created by the Partio CLI on `partio/checkpoints/v1` orphan branch. Each checkpoint ties a git commit to an AI agent session transcript and attribution data.
- **Plans**: Structured plans associated with branches/PRs stored as checkpoint metadata.
- **Attribution**: Percentage of code authored by AI vs human for a given commit.

## Conventions

- One concern per file — small, focused modules.
- Content script DOM manipulation isolated in `src/content/` — never in background or popup.
- All GitHub API calls go through `src/lib/github.ts` — content scripts message the background service worker for API access.
- Types shared with the Partio App live in `src/types/` and should match `partio-io/app` type definitions.
- Use `chrome.storage.local` for cached data, `chrome.storage.sync` for user settings.

## Data Flow

```
GitHub page load
  → content script detects page type (PR, commit, repo)
  → sends message to service worker requesting checkpoint data
  → service worker fetches from GitHub API (partio/checkpoints/v1 branch)
  → content script receives data, injects UI overlays into GitHub DOM
```

## Environment / Auth

The extension needs a GitHub token with `repo` scope to read checkpoint data. Two options:

1. **Personal Access Token** — user pastes it in the popup settings
2. **OAuth** — extension initiates GitHub OAuth flow via `chrome.identity`

Token is stored in `chrome.storage.sync`.

## Related Repos

- `partio-io/cli` — Go CLI that creates checkpoints on the orphan branch
- `partio-io/app` — Next.js dashboard for browsing checkpoint data
- `partio-io/site` — Marketing site
