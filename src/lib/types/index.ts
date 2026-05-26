export type KanbanColumn = 'backlog' | 'in-progress' | 'review' | 'done';

export type TaskType = 'feature' | 'fix' | 'update' | 'refactor';

export type Priority = 'low' | 'medium' | 'high';

export type SessionStatusKind = 'idle' | 'running' | 'waiting-permission' | 'error';

export type SessionStatus =
  | { kind: 'idle' }
  | { kind: 'running'; startedAt: number }
  | { kind: 'waiting-permission' }
  | { kind: 'error'; reason: string };

export type SessionMetadata = {
  sessionId: string;
  kanbanColumn: KanbanColumn;
  taskType: TaskType | null;
  priority: Priority | null;
  tags: string[];
  externalRef: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
};

export type MessageCost = {
  messageId: string;
  sessionId: string;
  providerId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: number;
};

export type ModelStatDaily = {
  date: string;
  providerId: string;
  modelId: string;
  sessionsCount: number;
  totalCostUsd: number;
  avgIterations: number | null;
};

export type KanbanCard = {
  sessionId: string;
  title: string;
  model: string | null;
  taskType: TaskType | null;
  priority: Priority | null;
  totalCost: number;
  lastUpdate: number;
  status: SessionStatus;
  kanbanColumn: KanbanColumn;
  tags: string[];
};

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type Provider = {
  id: string;
  name: string;
  models: Model[];
};

export type Model = {
  id: string;
  name: string;
};

export type Agent = {
  id: string;
  name: string;
  description: string;
};

export type SSEEvent =
  | { type: 'session.updated'; data: { sessionId: string } }
  | { type: 'message.updated'; data: { sessionId: string; messageId: string } }
  | { type: 'message.part.updated'; data: { sessionId: string; messageId: string } }
  | { type: 'permission.updated'; data: { sessionId: string; status: string } }
  | { type: 'session.error'; data: { sessionId: string; error: string } };

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
