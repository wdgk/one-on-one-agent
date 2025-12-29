import { v4 as uuidv4 } from 'uuid';
import type { DatabaseConnection } from './database.js';
import type { Job, JobStatus, Repository } from './types.js';

/**
 * Job（1on1単位のジョブ）のRepository
 */
export class JobRepository implements Partial<Repository<Job>> {
  constructor(private db: DatabaseConnection) {}

  /**
   * Jobを作成または更新する（冪等性あり）
   * @param data Job作成データ
   * @returns 作成または更新されたJob
   */
  async upsert(data: {
    eventId: string;
    attendeeEmail: string;
    attendeeName: string | null;
    startAt: string;
    endAt: string;
    status?: JobStatus;
  }): Promise<Job> {
    const database = this.db.getDb();
    const now = new Date().toISOString();
    const idempotencyKey = `${data.eventId}|${data.attendeeEmail}|${data.startAt}`;

    // 既存のJobを検索
    const existingJob = database
      .prepare(
        `
      SELECT
        id, event_id as eventId, attendee_email as attendeeEmail,
        attendee_name as attendeeName, start_at as startAt, end_at as endAt,
        status, revision, created_at as createdAt, updated_at as updatedAt,
        idempotency_key as idempotencyKey, error_message as errorMessage, metadata
      FROM jobs
      WHERE idempotency_key = ?
    `
      )
      .get(idempotencyKey) as Job | undefined;

    if (existingJob) {
      // 既存のJobを更新
      database
        .prepare(
          `
        UPDATE jobs
        SET
          attendee_name = ?,
          end_at = ?,
          updated_at = ?
        WHERE id = ?
      `
        )
        .run(data.attendeeName, data.endAt, now, existingJob.id);

      return this.findById(existingJob.id) as Promise<Job>;
    }

    // 新しいJobを作成
    const id = uuidv4();
    const status = data.status || 'PENDING';

    database
      .prepare(
        `
      INSERT INTO jobs (
        id, event_id, attendee_email, attendee_name, start_at, end_at,
        status, revision, created_at, updated_at, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        data.eventId,
        data.attendeeEmail,
        data.attendeeName,
        data.startAt,
        data.endAt,
        status,
        1, // 初期revision
        now,
        now,
        idempotencyKey
      );

    return this.findById(id) as Promise<Job>;
  }

  /**
   * IDでJobを検索する
   * @param id JobのID
   * @returns Job（存在しない場合はnull）
   */
  async findById(id: string): Promise<Job | null> {
    const database = this.db.getDb();

    const job = database
      .prepare(
        `
      SELECT
        id, event_id as eventId, attendee_email as attendeeEmail,
        attendee_name as attendeeName, start_at as startAt, end_at as endAt,
        status, revision, created_at as createdAt, updated_at as updatedAt,
        idempotency_key as idempotencyKey, error_message as errorMessage, metadata
      FROM jobs
      WHERE id = ?
    `
      )
      .get(id) as Job | undefined;

    return job || null;
  }

  /**
   * Jobのステータスを更新する
   * @param id JobのID
   * @param status 新しいステータス
   * @param errorMessage エラーメッセージ（オプション）
   * @returns 更新されたJob
   */
  async updateStatus(
    id: string,
    status: JobStatus,
    errorMessage?: string
  ): Promise<Job> {
    const database = this.db.getDb();
    const now = new Date().toISOString();

    database
      .prepare(
        `
      UPDATE jobs
      SET status = ?, updated_at = ?, error_message = ?
      WHERE id = ?
    `
      )
      .run(status, now, errorMessage || null, id);

    return this.findById(id) as Promise<Job>;
  }

  /**
   * 特定のステータスのJobを検索する
   * @param status Jobステータス
   * @returns マッチするJobの配列
   */
  async findByStatus(status: JobStatus): Promise<Job[]> {
    const database = this.db.getDb();

    const jobs = database
      .prepare(
        `
      SELECT
        id, event_id as eventId, attendee_email as attendeeEmail,
        attendee_name as attendeeName, start_at as startAt, end_at as endAt,
        status, revision, created_at as createdAt, updated_at as updatedAt,
        idempotency_key as idempotencyKey, error_message as errorMessage, metadata
      FROM jobs
      WHERE status = ?
      ORDER BY start_at ASC
    `
      )
      .all(status) as Job[];

    return jobs;
  }

  /**
   * レコードを作成する
   * @param data Job作成データ
   * @returns 作成されたJob
   */
  async create(data: Partial<Job>): Promise<Job> {
    if (
      !data.eventId ||
      !data.attendeeEmail ||
      !data.startAt ||
      !data.endAt
    ) {
      throw new Error('Required fields are missing');
    }

    return this.upsert({
      eventId: data.eventId,
      attendeeEmail: data.attendeeEmail,
      attendeeName: data.attendeeName || null,
      startAt: data.startAt,
      endAt: data.endAt,
      status: data.status,
    });
  }

  /**
   * レコードを更新する
   * @param id JobのID
   * @param data 更新データ
   * @returns 更新されたJob
   */
  async update(id: string, data: Partial<Job>): Promise<Job> {
    const database = this.db.getDb();
    const now = new Date().toISOString();

    // 更新可能なフィールドのみを更新
    const fields: string[] = [];
    const values: any[] = [];

    if (data.attendeeName !== undefined) {
      fields.push('attendee_name = ?');
      values.push(data.attendeeName);
    }
    if (data.endAt) {
      fields.push('end_at = ?');
      values.push(data.endAt);
    }
    if (data.status) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(data.errorMessage);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    if (fields.length > 1) {
      // updated_at以外のフィールドがある場合のみ更新
      database
        .prepare(
          `
        UPDATE jobs
        SET ${fields.join(', ')}
        WHERE id = ?
      `
        )
        .run(...values);
    }

    return this.findById(id) as Promise<Job>;
  }

  /**
   * レコードを削除する
   * @param id JobのID
   */
  async delete(id: string): Promise<void> {
    const database = this.db.getDb();
    database.prepare('DELETE FROM jobs WHERE id = ?').run(id);
  }
}
