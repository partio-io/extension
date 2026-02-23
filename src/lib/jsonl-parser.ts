import type { Message } from "../types/checkpoint";

const MESSAGE_TYPES = new Set(["user", "human", "assistant"]);

const SYSTEM_TAG_RE =
  /<(local-command-caveat|command-name|command-message|command-args|local-command-stdout|system-reminder|user-prompt-submit-hook)>[\s\S]*?<\/\1>/g;

function extractContentBlocks(blocks: any[]): { text: string; toolNames: string[] } {
  const textParts: string[] = [];
  const toolNames: string[] = [];

  for (const block of blocks) {
    if (typeof block === "string") {
      textParts.push(block);
    } else if (block?.type === "text") {
      if (block.text) textParts.push(block.text);
    } else if (block?.type === "tool_use") {
      if (block.name) toolNames.push(block.name);
    }
    // Skip thinking, redacted_thinking, tool_result, and unknown types
  }

  return { text: textParts.join("\n"), toolNames };
}

function stripSystemTags(text: string): string {
  return text.replace(SYSTEM_TAG_RE, "");
}

function extractText(entry: Record<string, unknown>): { text: string; toolNames: string[] } {
  if (Array.isArray(entry.contentBlocks)) {
    return extractContentBlocks(entry.contentBlocks);
  }

  if (entry.message != null) {
    if (typeof entry.message === "string") return { text: entry.message, toolNames: [] };
    const msg = entry.message as any;
    if (typeof msg.content === "string") return { text: msg.content, toolNames: [] };
    if (Array.isArray(msg.content)) {
      return extractContentBlocks(msg.content);
    }
  }

  if (entry.content != null) {
    if (typeof entry.content === "string") return { text: entry.content, toolNames: [] };
    if (Array.isArray(entry.content)) {
      return extractContentBlocks(entry.content as any[]);
    }
  }

  return { text: "", toolNames: [] };
}

/** Get a stable ID for deduplication — entries from the same assistant turn share a message ID */
function getMessageId(entry: any): string | null {
  return entry.message?.id || entry.uuid || null;
}

export function parseMessages(jsonlContent: string): Message[] {
  const lines = jsonlContent.split("\n").filter((line) => line.trim());

  const parsed = lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((entry: any) => entry && MESSAGE_TYPES.has(entry.type || entry.role));

  // Group entries by message ID to deduplicate streaming chunks
  const grouped = new Map<string, { role: string; text: string; toolNames: string[]; timestamp: string }>();
  let seqId = 0;

  for (const entry of parsed) {
    const role = entry.type || entry.role || "unknown";
    const msgId = getMessageId(entry) || `__seq_${seqId++}`;
    const { text, toolNames } = extractText(entry);
    const cleaned = stripSystemTags(text);

    const existing = grouped.get(msgId);
    if (existing) {
      // Append new text content (don't duplicate)
      if (cleaned && !existing.text.includes(cleaned)) {
        existing.text += (existing.text ? "\n" : "") + cleaned;
      }
      existing.toolNames.push(...toolNames);
    } else {
      grouped.set(msgId, {
        role: role === "human" ? "user" : role,
        text: cleaned,
        toolNames,
        timestamp: entry.timestamp || "",
      });
    }
  }

  // Convert to messages, skip entries that have no meaningful text
  return Array.from(grouped.values())
    .filter((entry) => entry.text.trim().length > 0)
    .map((entry) => ({
      role: entry.role,
      content: entry.text,
      timestamp: entry.timestamp,
      toolNames: [...new Set(entry.toolNames)],
    }));
}
