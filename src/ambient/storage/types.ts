/**
 * Ambient Agent データベース型定義
 */

/**
 * Jobステータス
 */
export type JobStatus =
  | 'PENDING'
  | 'COLLECTING'
  | 'DRAFTED'
  | 'SENT_PREVIEW'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'DONE'
  | 'DROPPED'
  | 'FAILED';

/**
 * Taskステータス
 */
export type TaskStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

/**
 * Deliveryステータス
 */
export type DeliveryStatus = 'pending' | 'sent' | 'failed';

/**
 * 情報源
 */
export type Source = 'slack' | 'backlog' | 'github';

/**
 * 配信チャネル
 */
export type DeliveryChannel = 'slack' | 'backlog';

/**
 * Artifact種別
 */
export type ArtifactType = 'ir_json' | 'markdown';

/**
 * Job（1on1単位のジョブ）
 */
export interface Job {
  id: string;
  eventId: string;
  attendeeEmail: string;
  attendeeName: string | null;
  startAt: string; // ISO 8601
  endAt: string; // ISO 8601
  status: JobStatus;
  revision: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  idempotencyKey: string;
  errorMessage: string | null;
  metadata: string | null; // JSON string
}

/**
 * Task（情報源ごとの収集タスク）
 */
export interface Task {
  id: string;
  jobId: string;
  source: Source;
  status: TaskStatus;
  priority: number;
  retryCount: number;
  maxRetries: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  startedAt: string | null; // ISO 8601
  completedAt: string | null; // ISO 8601
  errorMessage: string | null;
  idempotencyKey: string;
}

/**
 * Fact（正規化された根拠レコード）
 */
export interface Fact {
  id: string;
  jobId: string;
  source: Source;
  occurredAt: string; // ISO 8601
  summary: string;
  url: string;
  confidence: number;
  score: number;
  rawRef: string; // JSON string
  createdAt: string; // ISO 8601
}

/**
 * Artifact（生成物）
 */
export interface Artifact {
  id: string;
  jobId: string;
  revision: number;
  artifactType: ArtifactType;
  content: string;
  filePath: string | null;
  sha256: string;
  createdAt: string; // ISO 8601
}

/**
 * Delivery（送信/作成ログ）
 */
export interface Delivery {
  id: string;
  jobId: string;
  revision: number;
  channel: DeliveryChannel;
  target: string;
  status: DeliveryStatus;
  externalId: string | null;
  sentAt: string | null; // ISO 8601
  errorMessage: string | null;
  createdAt: string; // ISO 8601
  idempotencyKey: string;
}

/**
 * Repository共通インターフェース
 */
export interface Repository<T> {
  /**
   * レコードを作成する
   */
  create(data: Partial<T>): Promise<T>;

  /**
   * IDでレコードを検索する
   */
  findById(id: string): Promise<T | null>;

  /**
   * レコードを更新する
   */
  update(id: string, data: Partial<T>): Promise<T>;

  /**
   * レコードを削除する
   */
  delete(id: string): Promise<void>;
}
