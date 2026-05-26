export type JiraIssue = {
  key: string;
  summary: string;
  description: string;
  status: string;
  assignee: string | null;
  labels: string[];
  url: string;
};

export type JiraComment = {
  id: string;
  body: string;
  created: string;
};

export type JiraTransition = {
  id: string;
  name: string;
};

export interface JiraAdapter {
  getIssue(key: string, signal?: AbortSignal): Promise<import('./result.ts').Result<JiraIssue>>;
  addComment(key: string, body: string, signal?: AbortSignal): Promise<import('./result.ts').Result<JiraComment>>;
  transitionStatus(key: string, transitionName: string, signal?: AbortSignal): Promise<import('./result.ts').Result<void>>;
  addLabel(key: string, label: string, signal?: AbortSignal): Promise<import('./result.ts').Result<void>>;
  removeLabel(key: string, label: string, signal?: AbortSignal): Promise<import('./result.ts').Result<void>>;
  attachFile(key: string, filename: string, content: string, signal?: AbortSignal): Promise<import('./result.ts').Result<void>>;
  getTransitions(key: string, signal?: AbortSignal): Promise<import('./result.ts').Result<JiraTransition[]>>;
}
