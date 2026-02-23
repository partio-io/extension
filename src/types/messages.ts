import type { CheckpointMetadata, Message } from "./checkpoint";

export interface GetCheckpointRequest {
  type: "GET_CHECKPOINT";
  owner: string;
  repo: string;
  checkpointId: string;
}

export interface GetSessionRequest {
  type: "GET_SESSION";
  owner: string;
  repo: string;
  checkpointId: string;
}

export interface GetPlanRequest {
  type: "GET_PLAN";
  owner: string;
  repo: string;
  checkpointId: string;
}

export interface GetTokenRequest {
  type: "GET_TOKEN";
}

export interface GetAppUrlRequest {
  type: "GET_APP_URL";
}

export interface GetAuthStatusRequest {
  type: "GET_AUTH_STATUS";
}

export interface ConnectRequest {
  type: "CONNECT";
}

export interface DisconnectRequest {
  type: "DISCONNECT";
}

export interface OpenLoginRequest {
  type: "OPEN_LOGIN";
}

export interface FindCheckpointRequest {
  type: "FIND_CHECKPOINT";
  owner: string;
  repo: string;
  shas: string[];
  branches: string[];
}

export interface GetCommitContextRequest {
  type: "GET_COMMIT_CONTEXT";
  owner: string;
  repo: string;
  sha: string;
}

export interface GetPrContextRequest {
  type: "GET_PR_CONTEXT";
  owner: string;
  repo: string;
  prNumber: number;
}

export interface ListCheckpointsRequest {
  type: "LIST_CHECKPOINTS";
  owner: string;
  repo: string;
}

export interface CommitContext {
  shas: string[];
  branches: string[];
}

export type ExtensionRequest =
  | GetCheckpointRequest
  | GetSessionRequest
  | GetPlanRequest
  | GetTokenRequest
  | GetAppUrlRequest
  | GetAuthStatusRequest
  | ConnectRequest
  | DisconnectRequest
  | OpenLoginRequest
  | FindCheckpointRequest
  | GetCommitContextRequest
  | GetPrContextRequest
  | ListCheckpointsRequest;

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type ExtensionResponse<T> = SuccessResponse<T> | ErrorResponse;

export type CheckpointResponse = ExtensionResponse<CheckpointMetadata>;
export type SessionResponse = ExtensionResponse<Message[]>;
export type PlanResponse = ExtensionResponse<string>;
export type TokenResponse = ExtensionResponse<string>;
export type AppUrlResponse = ExtensionResponse<string>;
export type FindCheckpointResponse = ExtensionResponse<CheckpointMetadata>;
export type CommitContextResponse = ExtensionResponse<CommitContext>;
export type PrContextResponse = ExtensionResponse<CommitContext>;
export type ListCheckpointsResponse = ExtensionResponse<CheckpointMetadata[]>;
