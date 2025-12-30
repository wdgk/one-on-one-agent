import { v4 as uuidv4 } from 'uuid';
import type { DatabaseConnection } from './database.js';
import type { Task, TaskStatus, Source } from './types.js';

/**
 * Task（情報源ごとの収集タスク）のRepository
 */
export class TaskRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Taskを作成する
   * @param data Task作成データ
   * @returns 作成されたTask
   */
  async create(data: {
    jobId: string;
    source: Source;
    status: TaskStatus;
    priority: number;
    maxRetries?: number;
  }): Promise<Task> {
    const database = this.db.getDb();
    const now = new Date().toISOString();
    const id = uuidv4();
    const idempotencyKey = `${data.jobId}|${data.source}`;
    const maxRetries = data.maxRetries ?? 3;

    database
      .prepare(
        `
      INSERT INTO tasks (
        id, job_id, source, status, priority, retry_count, max_retries,
        created_at, updated_at, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        data.jobId,
        data.source,
        data.status,
        data.priority,
        0, // 初期retry_count
        maxRetries,
        now,
        now,
        idempotencyKey
      );

    return this.findByIdOrThrow(id);
  }

  /**
   * IDでTaskを検索する
   * @param id TaskのID
   * @returns Task（存在しない場合はnull）
   */
  async findById(id: string): Promise<Task | null> {
    const database = this.db.getDb();

    const task = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, source, status, priority,
        retry_count as retryCount, max_retries as maxRetries,
        created_at as createdAt, updated_at as updatedAt,
        started_at as startedAt, completed_at as completedAt,
        error_message as errorMessage, idempotency_key as idempotencyKey
      FROM tasks
      WHERE id = ?
    `
      )
      .get(id) as Task | undefined;

    return task || null;
  }

  /**
   * IDでTaskを検索する（存在しない場合はエラー）
   * @param id TaskのID
   * @returns Task
   * @throws Error Taskが存在しない場合
   */
  private async findByIdOrThrow(id: string): Promise<Task> {
    const task = await this.findById(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    return task;
  }

  /**
   * 冪等キーでTaskを検索する
   * @param idempotencyKey 冪等キー
   * @returns Task（存在しない場合はnull）
   */
  async findByIdempotencyKey(idempotencyKey: string): Promise<Task | null> {
    const database = this.db.getDb();

    const task = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, source, status, priority,
        retry_count as retryCount, max_retries as maxRetries,
        created_at as createdAt, updated_at as updatedAt,
        started_at as startedAt, completed_at as completedAt,
        error_message as errorMessage, idempotency_key as idempotencyKey
      FROM tasks
      WHERE idempotency_key = ?
    `
      )
      .get(idempotencyKey) as Task | undefined;

    return task || null;
  }

  /**
   * Taskのステータスを更新する
   * @param id TaskのID
   * @param status 新しいステータス
   * @param errorMessage エラーメッセージ（オプション）
   * @returns 更新されたTask
   */
  async updateStatus(
    id: string,
    status: TaskStatus,
    errorMessage?: string
  ): Promise<Task> {
    const database = this.db.getDb();
    const now = new Date().toISOString();

    // 現在のTaskを取得
    const currentTask = await this.findByIdOrThrow(id);

    // started_atの設定（QUEUED → RUNNING の場合）
    let startedAt = currentTask.startedAt;
    if (status === 'RUNNING' && !startedAt) {
      startedAt = now;
    }

    // completed_atの設定（DONE または FAILED の場合）
    let completedAt = currentTask.completedAt;
    if ((status === 'DONE' || status === 'FAILED') && !completedAt) {
      completedAt = now;
    }

    database
      .prepare(
        `
      UPDATE tasks
      SET status = ?, updated_at = ?, started_at = ?, completed_at = ?, error_message = ?
      WHERE id = ?
    `
      )
      .run(status, now, startedAt, completedAt, errorMessage || null, id);

    return this.findByIdOrThrow(id);
  }

  /**
   * 特定のステータスのTaskを検索する
   * @param status Taskステータス
   * @returns マッチするTaskの配列
   */
  async findByStatus(status: TaskStatus): Promise<Task[]> {
    const database = this.db.getDb();

    const tasks = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, source, status, priority,
        retry_count as retryCount, max_retries as maxRetries,
        created_at as createdAt, updated_at as updatedAt,
        started_at as startedAt, completed_at as completedAt,
        error_message as errorMessage, idempotency_key as idempotencyKey
      FROM tasks
      WHERE status = ?
      ORDER BY priority DESC, created_at ASC
    `
      )
      .all(status) as Task[];

    return tasks;
  }

  /**
   * JobIDに紐づくTaskを検索する
   * @param jobId JobのID
   * @returns マッチするTaskの配列
   */
  async findByJobId(jobId: string): Promise<Task[]> {
    const database = this.db.getDb();

    const tasks = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, source, status, priority,
        retry_count as retryCount, max_retries as maxRetries,
        created_at as createdAt, updated_at as updatedAt,
        started_at as startedAt, completed_at as completedAt,
        error_message as errorMessage, idempotency_key as idempotencyKey
      FROM tasks
      WHERE job_id = ?
      ORDER BY created_at ASC
    `
      )
      .all(jobId) as Task[];

    return tasks;
  }

  /**
   * リトライカウントをインクリメントする
   * @param id TaskのID
   * @returns 更新されたTask
   */
  async incrementRetryCount(id: string): Promise<Task> {
    const database = this.db.getDb();
    const now = new Date().toISOString();

    database
      .prepare(
        `
      UPDATE tasks
      SET retry_count = retry_count + 1, updated_at = ?
      WHERE id = ?
    `
      )
      .run(now, id);

    return this.findByIdOrThrow(id);
  }

  /**
   * レコードを削除する
   * @param id TaskのID
   */
  async delete(id: string): Promise<void> {
    const database = this.db.getDb();
    database.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  }
}
