import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * SQLiteデータベース接続を管理するクラス（sql.js版）
 * sql.jsはWebAssemblyベースでネイティブバイナリ不要
 */
export class DatabaseConnection {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * データベースに接続し、スキーマを初期化する
   */
  async connect(): Promise<void> {
    if (this.db) {
      return;
    }

    const SQL = await initSqlJs();

    // 既存のDBファイルがあれば読み込む
    if (existsSync(this.dbPath)) {
      const fileBuffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    // 外部キー制約を有効化
    this.db.run('PRAGMA foreign_keys = ON');

    // スキーマ初期化
    await this.initializeSchema();

    // 初期化後にファイルに保存
    this.saveToFile();
  }

  /**
   * データベース接続を切断する
   */
  async disconnect(): Promise<void> {
    if (this.db) {
      // 切断前にファイルに保存
      this.saveToFile();
      this.db.close();
      this.db = null;
    }
  }

  /**
   * データベースをファイルに保存する
   */
  private saveToFile(): void {
    if (this.db) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      writeFileSync(this.dbPath, buffer);
    }
  }

  /**
   * 変更をファイルに永続化する
   * 重要な更新の後に呼び出す
   */
  persist(): void {
    this.saveToFile();
  }

  /**
   * better-sqlite3互換のラッパーオブジェクトを取得する
   */
  getDb(): BetterSqlite3Compatible {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return new BetterSqlite3Compatible(this.db, () => this.saveToFile());
  }

  /**
   * スキーマを初期化する
   */
  private async initializeSchema(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    this.db.run(schema);
  }

  /**
   * トランザクション内で処理を実行する
   * @param fn トランザクション内で実行する関数
   * @returns 関数の戻り値
   */
  transaction<T>(fn: (db: BetterSqlite3Compatible) => T): T {
    const db = this.getDb();

    try {
      db.exec('BEGIN');
      const result = fn(db);
      db.exec('COMMIT');
      this.saveToFile();
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

/**
 * better-sqlite3互換のラッパークラス
 * 既存のRepositoryコードを変更せずに使用可能
 */
class BetterSqlite3Compatible {
  constructor(
    private db: SqlJsDatabase,
    private onWrite: () => void
  ) {}

  /**
   * SQLを実行する（複数ステートメント対応）
   */
  exec(sql: string): void {
    this.db.run(sql);
  }

  /**
   * プリペアドステートメントを作成する
   */
  prepare(sql: string): PreparedStatement {
    return new PreparedStatement(this.db, sql, this.onWrite);
  }

  /**
   * Pragma設定（sql.jsでは一部のみ対応）
   */
  pragma(statement: string): void {
    this.db.run(`PRAGMA ${statement}`);
  }
}

/**
 * プリペアドステートメントのラッパー
 */
class PreparedStatement {
  constructor(
    private db: SqlJsDatabase,
    private sql: string,
    private onWrite: () => void
  ) {}

  /**
   * 更新クエリを実行する（INSERT, UPDATE, DELETE）
   */
  run(...params: unknown[]): { changes: number; lastInsertRowid: number } {
    this.db.run(this.sql, params as any[]);
    this.onWrite();
    return {
      changes: this.db.getRowsModified(),
      lastInsertRowid: 0, // sql.jsでは直接取得不可
    };
  }

  /**
   * 1行を取得する
   */
  get(...params: unknown[]): unknown {
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params as any[]);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }

    stmt.free();
    return undefined;
  }

  /**
   * 全行を取得する
   */
  all(...params: unknown[]): unknown[] {
    const stmt = this.db.prepare(this.sql);
    stmt.bind(params as any[]);

    const results: unknown[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }

    stmt.free();
    return results;
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
