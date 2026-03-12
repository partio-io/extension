export interface CheckpointMetadata {
  id: string;
  session_id: string;
  commit_hash: string;
  branch: string;
  created_at: string;
  agent: string;
  agent_percent: number;
  content_hash: string;
  plan_slug?: string;
}

export interface SessionMetadata {
  agent: string;
  total_tokens: number;
  duration: string;
}

export interface Message {
  role: string;
  content: string;
  timestamp: string;
  tokens?: number;
  toolNames?: string[];
}
