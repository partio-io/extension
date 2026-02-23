import type { CheckpointMetadata, Message } from "../types/checkpoint";
import { renderMarkdown } from "../lib/markdown";

export interface PanelData {
  checkpoint: CheckpointMetadata | null;
  messages: Message[];
  plan: string;
  appUrl: string;
  owner: string;
  repo: string;
}

export function buildPanelHTML(data: PanelData): string {
  const { checkpoint, messages, plan, appUrl, owner, repo } = data;
  const hasPlan = plan.trim().length > 0;
  const hasTranscript = messages.length > 0;

  if (!hasPlan && !hasTranscript) return "";

  const agentName = checkpoint?.agent || "AI Agent";
  const agentPercent = checkpoint?.agent_percent ?? 0;
  const checkpointUrl = checkpoint?.id && appUrl
    ? `${appUrl}/${owner}/${repo}/checkpoints/${checkpoint.id}`
    : "";

  const viewLink = checkpointUrl
    ? `<a class="partio-view-link" href="${escapeAttr(checkpointUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">View in Partio <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M3.75 2h3.5a.75.75 0 010 1.5h-3.5a.25.25 0 00-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25v-3.5a.75.75 0 011.5 0v3.5A1.75 1.75 0 0112.25 14h-8.5A1.75 1.75 0 012 12.25v-8.5C2 2.784 2.784 2 3.75 2zm6.854-1h4.146a.25.25 0 01.25.25v4.146a.25.25 0 01-.427.177L13.03 4.03 9.28 7.78a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0110.604 1z"/></svg></a>`
    : "";

  const header = `
    <div class="partio-header">
      <div class="partio-header-left">
        <span class="partio-logo"><svg width="24" height="24" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" rx="44" fill="#7B2D8E"/><path d="M 100 174 C 148 174, 168 148, 165 112 C 163 88, 155 72, 148 62 C 142 48, 146 34, 143 26 C 139 20, 132 28, 126 44 C 120 56, 112 62, 100 64 C 88 62, 80 56, 74 44 C 68 28, 61 20, 57 26 C 54 34, 58 48, 52 62 C 45 72, 37 88, 35 112 C 32 148, 52 174, 100 174 Z" fill="white"/><path d="M 63 32 L 73 56 L 60 48 Z" fill="#7B2D8E"/><path d="M 137 32 L 127 56 L 140 48 Z" fill="#7B2D8E"/><circle cx="78" cy="108" r="20" fill="#7B2D8E"/><circle cx="72" cy="102" r="5" fill="white"/><circle cx="122" cy="108" r="20" fill="#7B2D8E"/><circle cx="116" cy="102" r="5" fill="white"/><ellipse cx="100" cy="137" rx="6" ry="5" fill="#7B2D8E"/><path d="M 86 150 Q 93 160, 100 150 Q 107 160, 114 150" stroke="#7B2D8E" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <span class="partio-title">Partio</span>
        <span class="partio-badge">${escapeHtml(agentName)}</span>
        ${agentPercent > 0 ? `<span class="partio-percent">${agentPercent}% AI-authored</span>` : ""}
      </div>
      <div class="partio-header-right">
        ${viewLink}
        <button class="partio-collapse-btn" aria-label="Collapse Partio panel">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  const tabs: string[] = [];
  if (hasTranscript) tabs.push(`<button class="partio-tab partio-tab-active" data-tab="transcript">Transcript</button>`);
  if (hasPlan) tabs.push(`<button class="partio-tab${!hasTranscript ? " partio-tab-active" : ""}" data-tab="plan">Plan</button>`);

  const tabBar = `<div class="partio-tabs">${tabs.join("")}</div>`;

  const planActions = hasPlan
    ? `<div class="partio-actions">
        <button class="partio-action-btn" data-action="copy-plan">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25z"/></svg>
          Copy Plan
        </button>
        <button class="partio-action-btn" data-action="download-plan">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2.75 14A1.75 1.75 0 011 12.25v-2.5a.75.75 0 011.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25v-2.5a.75.75 0 011.5 0v2.5A1.75 1.75 0 0113.25 14z"/><path d="M7.25 7.689V2a.75.75 0 011.5 0v5.689l1.97-1.969a.749.749 0 111.06 1.06l-3.25 3.25a.749.749 0 01-1.06 0L4.22 6.78a.749.749 0 111.06-1.06z"/></svg>
          Download
        </button>
      </div>`
    : "";

  const planContent = hasPlan
    ? `<div class="partio-tab-content${!hasTranscript ? " partio-tab-content-active" : ""}" data-content="plan">
        ${planActions}
        <div class="partio-plan">${renderMarkdown(plan)}</div>
      </div>`
    : "";

  const checkpointId = checkpoint?.id || "";
  const resumeCommand = checkpointId ? `partio resume ${checkpointId}` : "";

  const resumeAction = hasTranscript && resumeCommand
    ? `<div class="partio-resume">
        <button class="partio-resume-btn" data-action="resume" data-command="${escapeAttr(resumeCommand)}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 110 16A8 8 0 018 0zM1.5 8a6.5 6.5 0 1013 0 6.5 6.5 0 00-13 0zm4.879-2.773l4.264 2.559a.25.25 0 010 .428l-4.264 2.559A.25.25 0 016 10.559V5.442a.25.25 0 01.379-.215z"/></svg>
          Resume Claude Code Session
        </button>
        <code class="partio-resume-command">${escapeHtml(resumeCommand)}</code>
      </div>`
    : "";

  const transcriptContent = hasTranscript
    ? `<div class="partio-tab-content partio-tab-content-active" data-content="transcript">
        ${resumeAction}
        <div class="partio-transcript">${buildTranscriptHTML(messages)}</div>
      </div>`
    : "";

  return `
    <div id="partio-container" class="partio-container partio-collapsed" data-raw-plan="${escapeAttr(plan)}">
      ${header}
      <div class="partio-body" style="display:none">
        ${tabBar}
        ${transcriptContent}
        ${planContent}
      </div>
    </div>
  `;
}

function buildTranscriptHTML(messages: Message[]): string {
  return messages
    .map((msg) => {
      const role = normalizeRole(msg.role);
      const isAssistant = role === "assistant";
      const truncated = msg.content.length > 1000;
      const displayContent = truncated
        ? msg.content.slice(0, 1000)
        : msg.content;

      const toolBadges = (msg.toolNames && msg.toolNames.length > 0)
        ? `<div class="partio-tool-badges">${msg.toolNames.map((t) => `<span class="partio-tool-badge">${escapeHtml(t)}</span>`).join("")}</div>`
        : "";

      return `
        <div class="partio-message ${isAssistant ? "partio-message-assistant" : "partio-message-user"}">
          <div class="partio-message-role">${escapeHtml(role)}${toolBadges}</div>
          <div class="partio-message-content">
            <div class="partio-message-text">${renderMarkdown(displayContent)}</div>
            ${truncated ? `<div class="partio-message-full" style="display:none">${renderMarkdown(msg.content)}</div>` : ""}
            ${truncated ? `<button class="partio-show-more">Show more</button>` : ""}
          </div>
        </div>
      `;
    })
    .join("");
}

function normalizeRole(role: string): string {
  if (role === "human" || role === "user") return "user";
  return role;
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
