import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * SQLiteデータベース接続を管理するクラス
 */
export class DatabaseConnection {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * データベースに接続し、スキーマを初期化する
   */
  async connect(): Promise<void> {
    if (this.db) {
      // 既に接続済み
      return;
    }

    this.db = new Database(this.dbPath);

    // Write-Ahead Logging モードを有効化（並行アクセス性能向上）
    this.db.pragma('journal_mode = WAL');

    // 外部キー制約を有効化
    this.db.pragma('foreign_keys = ON');

    // スキーマ初期化
    await this.initializeSchema();
  }

  /**
   * データベース接続を切断する
   */
  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * データベースインスタンスを取得する
   * @throws Error 接続されていない場合
   */
  getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * スキーマを初期化する
   */
  private async initializeSchema(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    // schema.sqlを読み込んで実行
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    this.db.exec(schema);
  }

  /**
   * トランザクション内で処理を実行する
   * 注意: better-sqlite3は同期APIのため、コールバック関数も同期である必要があります
   * @param fn トランザクション内で実行する関数（同期のみ）
   * @returns 関数の戻り値
   */
  transaction<T>(fn: (db: Database.Database) => T): T {
    const db = this.getDb();

    try {
      db.prepare('BEGIN').run();
      const result = fn(db);
      db.prepare('COMMIT').run();
      return result;
    } catch (error) {
      db.prepare('ROLLBACK').run();
      throw error;
    }
  }
}

/**
 * グローバルなデータベース接続インスタンス
 */
let globalDbConnection: DatabaseConnection | null = null;

/**
 * グローバルなデータベース接続を取得する
 * @param dbPath データベースファイルパス（初回のみ必要）
 * @returns データベース接続インスタンス
 */
export async function getGlobalDatabaseConnection(
  dbPath?: string
): Promise<DatabaseConnection> {
  if (!globalDbConnection) {
    if (!dbPath) {
      throw new Error('Database path is required for first connection');
    }
    globalDbConnection = new DatabaseConnection(dbPath);
    await globalDbConnection.connect();
  }
  return globalDbConnection;
}

/**
 * グローバルなデータベース接続をクローズする
 */
export async function closeGlobalDatabaseConnection(): Promise<void> {
  if (globalDbConnection) {
    await globalDbConnection.disconnect();
    globalDbConnection = null;
  }
}
