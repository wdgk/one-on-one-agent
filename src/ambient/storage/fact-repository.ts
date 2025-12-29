import { v4 as uuidv4 } from 'uuid';
import type { DatabaseConnection } from './database.js';
import type { Fact, Source } from './types.js';

/**
 * Fact（正規化された根拠レコード）のRepository
 */
export class FactRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Factを作成する
   * @param data Fact作成データ
   * @returns 作成されたFact
   */
  async create(data: {
    jobId: string;
    source: Source;
    occurredAt: string;
    summary: string;
    url: string;
    confidence?: number;
    score?: number;
    rawRef: string;
  }): Promise<Fact> {
    const database = this.db.getDb();
    const now = new Date().toISOString();
    const id = uuidv4();
    const confidence = data.confidence ?? 1.0;
    const score = data.score ?? 0.0;

    database
      .prepare(
        `
      INSERT INTO facts (
        id, job_id, source, occurred_at, summary, url,
        confidence, score, raw_ref, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        data.jobId,
        data.source,
        data.occurredAt,
        data.summary,
        data.url,
        confidence,
        score,
        data.rawRef,
        now
      );

    return this.findByIdOrThrow(id);
  }

  /**
   * IDでFactを検索する
   * @param id FactのID
   * @returns Fact（存在しない場合はnull）
   */
  async findById(id: string): Promise<Fact | null> {
    const database = this.db.getDb();

    const fact = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, source, occurred_at as occurredAt,
        summary, url, confidence, score, raw_ref as rawRef,
        created_at as createdAt
      FROM facts
      WHERE id = ?
    `
      )
      .get(id) as Fact | undefined;

    return fact || null;
  }

  /**
   * IDでFactを検索する（存在しない場合はエラー）
   * @param id FactのID
   * @returns Fact
   * @throws Error Factが存在しない場合
   */
  private async findByIdOrThrow(id: string): Promise<Fact> {
    const fact = await this.findById(id);
    if (!fact) {
      throw new Error(`Fact not found: ${id}`);
    }
    return fact;
  }

  /**
   * JobIDに紐づくFactを検索する
   * @param jobId JobのID
   * @returns マッチするFactの配列（occurred_atの降順）
   */
  async findByJobId(jobId: string): Promise<Fact[]> {
    const database = this.db.getDb();

    const facts = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, source, occurred_at as occurredAt,
        summary, url, confidence, score, raw_ref as rawRef,
        created_at as createdAt
      FROM facts
      WHERE job_id = ?
      ORDER BY occurred_at DESC
    `
      )
      .all(jobId) as Fact[];

    return facts;
  }

  /**
   * JobIDとSourceでFactをフィルタする
   * @param jobId JobのID
   * @param source 情報源
   * @returns マッチするFactの配列（occurred_atの降順）
   */
  async findBySource(jobId: string, source: Source): Promise<Fact[]> {
    const database = this.db.getDb();

    const facts = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, source, occurred_at as occurredAt,
        summary, url, confidence, score, raw_ref as rawRef,
        created_at as createdAt
      FROM facts
      WHERE job_id = ? AND source = ?
      ORDER BY occurred_at DESC
    `
      )
      .all(jobId, source) as Fact[];

    return facts;
  }

  /**
   * URLでFactを検索する（重複チェック用）
   * @param jobId JobのID
   * @param url URL
   * @returns Fact（存在しない場合はnull）
   */
  async findByUrl(jobId: string, url: string): Promise<Fact | null> {
    const database = this.db.getDb();

    const fact = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, source, occurred_at as occurredAt,
        summary, url, confidence, score, raw_ref as rawRef,
        created_at as createdAt
      FROM facts
      WHERE job_id = ? AND url = ?
    `
      )
      .get(jobId, url) as Fact | undefined;

    return fact || null;
  }

  /**
   * スコアを更新する
   * @param id FactのID
   * @param score 新しいスコア
   * @returns 更新されたFact
   */
  async updateScore(id: string, score: number): Promise<Fact> {
    const database = this.db.getDb();

    database
      .prepare(
        `
      UPDATE facts
      SET score = ?
      WHERE id = ?
    `
      )
      .run(score, id);

    return this.findByIdOrThrow(id);
  }

  /**
   * レコードを削除する
   * @param id FactのID
   */
  async delete(id: string): Promise<void> {
    const database = this.db.getDb();
    database.prepare('DELETE FROM facts WHERE id = ?').run(id);
  }
}
