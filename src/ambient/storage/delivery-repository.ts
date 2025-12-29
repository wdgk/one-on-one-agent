import { v4 as uuidv4 } from 'uuid';
import type { DatabaseConnection } from './database.js';
import type { Delivery, DeliveryStatus, DeliveryChannel } from './types.js';

/**
 * Delivery（送信/作成ログ）のRepository
 */
export class DeliveryRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Deliveryを作成する
   * @param data Delivery作成データ
   * @returns 作成されたDelivery
   */
  async create(data: {
    jobId: string;
    revision: number;
    channel: DeliveryChannel;
    target: string;
    status: DeliveryStatus;
    externalId?: string;
  }): Promise<Delivery> {
    const database = this.db.getDb();
    const now = new Date().toISOString();
    const id = uuidv4();
    const idempotencyKey = `${data.jobId}|${data.channel}|${data.target}|${data.revision}`;

    database
      .prepare(
        `
      INSERT INTO deliveries (
        id, job_id, revision, channel, target, status, external_id,
        created_at, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        data.jobId,
        data.revision,
        data.channel,
        data.target,
        data.status,
        data.externalId || null,
        now,
        idempotencyKey
      );

    return this.findByIdOrThrow(id);
  }

  /**
   * IDでDeliveryを検索する
   * @param id DeliveryのID
   * @returns Delivery（存在しない場合はnull）
   */
  async findById(id: string): Promise<Delivery | null> {
    const database = this.db.getDb();

    const delivery = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, revision, channel, target, status,
        external_id as externalId, sent_at as sentAt, error_message as errorMessage,
        created_at as createdAt, idempotency_key as idempotencyKey
      FROM deliveries
      WHERE id = ?
    `
      )
      .get(id) as Delivery | undefined;

    return delivery || null;
  }

  /**
   * IDでDeliveryを検索する（存在しない場合はエラー）
   * @param id DeliveryのID
   * @returns Delivery
   * @throws Error Deliveryが存在しない場合
   */
  private async findByIdOrThrow(id: string): Promise<Delivery> {
    const delivery = await this.findById(id);
    if (!delivery) {
      throw new Error(`Delivery not found: ${id}`);
    }
    return delivery;
  }

  /**
   * 冪等キーでDeliveryを検索する
   * @param idempotencyKey 冪等キー
   * @returns Delivery（存在しない場合はnull）
   */
  async findByIdempotencyKey(idempotencyKey: string): Promise<Delivery | null> {
    const database = this.db.getDb();

    const delivery = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, revision, channel, target, status,
        external_id as externalId, sent_at as sentAt, error_message as errorMessage,
        created_at as createdAt, idempotency_key as idempotencyKey
      FROM deliveries
      WHERE idempotency_key = ?
    `
      )
      .get(idempotencyKey) as Delivery | undefined;

    return delivery || null;
  }

  /**
   * Deliveryのステータスを更新する
   * @param id DeliveryのID
   * @param status 新しいステータス
   * @param externalId 外部システムのID（オプション）
   * @param errorMessage エラーメッセージ（オプション）
   * @returns 更新されたDelivery
   */
  async updateStatus(
    id: string,
    status: DeliveryStatus,
    externalId?: string,
    errorMessage?: string
  ): Promise<Delivery> {
    const database = this.db.getDb();
    const now = new Date().toISOString();

    // statusがsentの場合はsent_atを設定
    const sentAt = status === 'sent' ? now : null;

    database
      .prepare(
        `
      UPDATE deliveries
      SET status = ?, external_id = ?, sent_at = ?, error_message = ?
      WHERE id = ?
    `
      )
      .run(status, externalId || null, sentAt, errorMessage || null, id);

    return this.findByIdOrThrow(id);
  }

  /**
   * JobIDに紐づくDeliveryを検索する
   * @param jobId JobのID
   * @returns マッチするDeliveryの配列
   */
  async findByJobId(jobId: string): Promise<Delivery[]> {
    const database = this.db.getDb();

    const deliveries = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, revision, channel, target, status,
        external_id as externalId, sent_at as sentAt, error_message as errorMessage,
        created_at as createdAt, idempotency_key as idempotencyKey
      FROM deliveries
      WHERE job_id = ?
      ORDER BY created_at ASC
    `
      )
      .all(jobId) as Delivery[];

    return deliveries;
  }

  /**
   * レコードを更新する
   * @param id DeliveryのID
   * @param data 更新データ
   * @returns 更新されたDelivery
   */
  async update(id: string, data: Partial<Delivery>): Promise<Delivery> {
    if (data.status) {
      return this.updateStatus(
        id,
        data.status,
        data.externalId || undefined,
        data.errorMessage || undefined
      );
    }

    // statusが指定されていない場合は単純な更新
    const database = this.db.getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (data.externalId !== undefined) {
      fields.push('external_id = ?');
      values.push(data.externalId);
    }
    if (data.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(data.errorMessage);
    }

    values.push(id);

    if (fields.length > 0) {
      database
        .prepare(
          `
        UPDATE deliveries
        SET ${fields.join(', ')}
        WHERE id = ?
      `
        )
        .run(...values);
    }

    return this.findByIdOrThrow(id);
  }

  /**
   * レコードを削除する
   * @param id DeliveryのID
   */
  async delete(id: string): Promise<void> {
    const database = this.db.getDb();
    database.prepare('DELETE FROM deliveries WHERE id = ?').run(id);
  }
}
