# Partio Extension

Chrome extension that surfaces Partio plans and AI agent sessions directly on GitHub.

## What It Does

When browsing a GitHub repository that uses Partio, the extension reads checkpoint data from the `partio/checkpoints/v1` orphan branch and overlays it onto the GitHub UI:

- **PR & commit views** — see which AI agent sessions contributed to each change, with session transcripts and attribution
- **Plans** — view Partio plans associated with branches and PRs
- **Session transcripts** — expand inline to read the full AI conversation that produced a code change

### Checkpoint Panel

![Checkpoint panel expanding on a GitHub commit page](https://raw.githubusercontent.com/partio-io/docs/main/images/extension/panel-expanding.gif)

### Transcript & Plan Tabs

![Switching between Transcript and Plan tabs](https://raw.githubusercontent.com/partio-io/docs/main/images/extension/transcript-plan-tabs.gif)

### Commit Badges

![Purple Partio badges on a GitHub commit list](https://raw.githubusercontent.com/partio-io/docs/main/images/extension/commit-badges.gif)

### Popup Auth

![Extension popup showing connect and disconnect states](https://raw.githubusercontent.com/partio-io/docs/main/images/extension/popup-auth.gif)

## Tech Stack

- Chrome Extension Manifest V3
- TypeScript
- GitHub REST API (via user's GitHub token)

## Getting Started

### Prerequisites

- Node.js 20+
- Chrome or Chromium-based browser

### Install Dependencies

```sh
npm install
```

### Development

```sh
npm run dev
```

Load the unpacked extension from `dist/` in `chrome://extensions` with Developer Mode enabled.

### Build

```sh
npm run build
```

### Package

```sh
npm run package
```

Produces a `.zip` ready for Chrome Web Store submission.

## Project Structure

```
src/
  background/        Service worker (auth, API requests)
  content/           Content scripts injected into GitHub pages
  popup/             Extension popup (settings, auth)
  lib/               Shared utilities (GitHub API, checkpoint parsing)
  types/             TypeScript type definitions
public/
  manifest.json      Extension manifest (V3)
  icons/             Extension icons
```

## How It Works

1. The content script detects GitHub pages (PRs, commits, file views)
2. It reads checkpoint data from the repo's `partio/checkpoints/v1` branch via the GitHub API
3. It injects UI elements (badges, expandable panels) into the GitHub DOM to display plans and session data
4. Authentication uses a GitHub token stored in `chrome.storage` (the same OAuth flow as the Partio App, or a personal access token)
