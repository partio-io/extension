import { marked } from "marked";

export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false }) as string;
}
