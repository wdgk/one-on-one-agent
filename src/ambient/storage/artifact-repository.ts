import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import type { DatabaseConnection } from './database.js';
import type { Artifact, ArtifactType } from './types.js';

/**
 * Artifact（生成物）のRepository
 */
export class ArtifactRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Artifactを作成する
   * @param data Artifact作成データ
   * @returns 作成されたArtifact
   */
  async create(data: {
    jobId: string;
    artifactType: ArtifactType;
    content: string;
    metadata?: any;
    filePath?: string;
  }): Promise<Artifact> {
    const database = this.db.getDb();
    const now = new Date().toISOString();
    const id = uuidv4();

    // SHA256ハッシュを計算
    const sha256 = createHash('sha256').update(data.content).digest('hex');

    // Jobの現在のrevisionを取得して+1
    const job = database
      .prepare('SELECT revision FROM jobs WHERE id = ?')
      .get(data.jobId) as { revision: number } | undefined;

    if (!job) {
      throw new Error(`Job not found: ${data.jobId}`);
    }

    const revision = job.revision + 1;

    database
      .prepare(
        `
      INSERT INTO artifacts (
        id, job_id, revision, artifact_type, content, file_path, sha256, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        data.jobId,
        revision,
        data.artifactType,
        data.content,
        data.filePath || null,
        sha256,
        now
      );

    // Jobのrevisionを更新
    database
      .prepare('UPDATE jobs SET revision = ? WHERE id = ?')
      .run(revision, data.jobId);

    return this.findByIdOrThrow(id);
  }

  /**
   * IDでArtifactを検索する（存在しない場合はエラー）
   * @param id ArtifactのID
   * @returns Artifact
   */
  private async findByIdOrThrow(id: string): Promise<Artifact> {
    const artifact = await this.findById(id);
    if (!artifact) {
      throw new Error(`Artifact not found: ${id}`);
    }
    return artifact;
  }

  /**
   * IDでArtifactを検索する
   * @param id ArtifactのID
   * @returns Artifact（存在しない場合はnull）
   */
  async findById(id: string): Promise<Artifact | null> {
    const database = this.db.getDb();

    const artifact = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, revision, artifact_type as artifactType,
        content, file_path as filePath, sha256, created_at as createdAt
      FROM artifacts
      WHERE id = ?
    `
      )
      .get(id) as Artifact | undefined;

    return artifact || null;
  }

  /**
   * JobIDでArtifactを検索する
   * @param jobId JobのID
   * @returns Artifact配列
   */
  async findByJobId(jobId: string): Promise<Artifact[]> {
    const database = this.db.getDb();

    const artifacts = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, revision, artifact_type as artifactType,
        content, file_path as filePath, sha256, created_at as createdAt
      FROM artifacts
      WHERE job_id = ?
      ORDER BY revision DESC
    `
      )
      .all(jobId) as Artifact[];

    return artifacts;
  }

  /**
   * JobIDの最新Artifactを検索する
   * @param jobId JobのID
   * @returns Artifact（存在しない場合はnull）
   */
  async findLatestByJobId(jobId: string): Promise<Artifact | null> {
    const database = this.db.getDb();

    const artifact = database
      .prepare(
        `
      SELECT
        id, job_id as jobId, revision, artifact_type as artifactType,
        content, file_path as filePath, sha256, created_at as createdAt
      FROM artifacts
      WHERE job_id = ?
      ORDER BY revision DESC
      LIMIT 1
    `
      )
      .get(jobId) as Artifact | undefined;

    return artifact || null;
  }
}
