-- Ambient Agent データベーススキーマ
-- SQLite3用

-- jobs: 1on1単位のジョブ管理
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,                    -- UUID
  event_id TEXT NOT NULL,                 -- カレンダーイベントID
  attendee_email TEXT NOT NULL,           -- 1on1相手のメールアドレス
  attendee_name TEXT,                     -- 1on1相手の名前（表示用）
  start_at TEXT NOT NULL,                 -- 1on1開始日時（ISO 8601）
  end_at TEXT NOT NULL,                   -- 1on1終了日時（ISO 8601）
  status TEXT NOT NULL,                   -- PENDING, COLLECTING, DRAFTED, SENT_PREVIEW, APPROVED, DISPATCHED, DONE, DROPPED, FAILED
  revision INTEGER NOT NULL DEFAULT 1,    -- 再生成カウンタ
  created_at TEXT NOT NULL,               -- ジョブ作成日時
  updated_at TEXT NOT NULL,               -- 最終更新日時
  idempotency_key TEXT UNIQUE NOT NULL,   -- 冪等キー: event_id|attendee_email|start_at
  error_message TEXT,                     -- エラー時のメッセージ
  metadata TEXT                           -- JSON形式のメタデータ
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_start_at ON jobs(start_at);
CREATE INDEX IF NOT EXISTS idx_jobs_idempotency_key ON jobs(idempotency_key);

-- tasks: 情報源ごとの収集タスク
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,                    -- UUID
  job_id TEXT NOT NULL,                   -- 紐づくジョブID
  source TEXT NOT NULL,                   -- slack, backlog, github
  status TEXT NOT NULL,                   -- QUEUED, RUNNING, DONE, FAILED
  priority INTEGER NOT NULL DEFAULT 0,    -- 優先度（高いほど先に実行）
  retry_count INTEGER NOT NULL DEFAULT 0, -- リトライ回数
  max_retries INTEGER NOT NULL DEFAULT 3, -- 最大リトライ回数
  created_at TEXT NOT NULL,               -- タスク作成日時
  updated_at TEXT NOT NULL,               -- 最終更新日時
  started_at TEXT,                        -- 実行開始日時
  completed_at TEXT,                      -- 完了日時
  error_message TEXT,                     -- エラー時のメッセージ
  idempotency_key TEXT UNIQUE NOT NULL,   -- 冪等キー: job_id|source
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_job_id ON tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_idempotency_key ON tasks(idempotency_key);

-- facts: 正規化された根拠レコード
CREATE TABLE IF NOT EXISTS facts (
  id TEXT PRIMARY KEY,                    -- UUID
  job_id TEXT NOT NULL,                   -- 紐づくジョブID
  source TEXT NOT NULL,                   -- slack, backlog, github
  occurred_at TEXT NOT NULL,              -- 発生日時（ISO 8601）
  summary TEXT NOT NULL,                  -- サマリー（1行）
  url TEXT NOT NULL,                      -- エビデンスURL（根拠リンク）
  confidence REAL NOT NULL DEFAULT 1.0,   -- 確信度（0.0-1.0）
  score REAL NOT NULL DEFAULT 0.0,        -- スコア（重要度）
  raw_ref TEXT NOT NULL,                  -- 生データへの参照（JSON）
  created_at TEXT NOT NULL,               -- レコード作成日時
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_facts_job_id ON facts(job_id);
CREATE INDEX IF NOT EXISTS idx_facts_source ON facts(source);
CREATE INDEX IF NOT EXISTS idx_facts_occurred_at ON facts(occurred_at);
CREATE INDEX IF NOT EXISTS idx_facts_url ON facts(url);

-- artifacts: 生成物（IR/Markdown）
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,                    -- UUID
  job_id TEXT NOT NULL,                   -- 紐づくジョブID
  revision INTEGER NOT NULL,              -- リビジョン番号
  artifact_type TEXT NOT NULL,            -- ir_json, markdown
  content TEXT NOT NULL,                  -- 生成物の内容
  file_path TEXT,                         -- ファイルシステム上のパス
  sha256 TEXT NOT NULL,                   -- SHA256ハッシュ（監査用）
  created_at TEXT NOT NULL,               -- 生成日時
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  UNIQUE(job_id, revision, artifact_type)
);

CREATE INDEX IF NOT EXISTS idx_artifacts_job_id ON artifacts(job_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_revision ON artifacts(revision);

-- deliveries: 送信/作成ログ
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,                    -- UUID
  job_id TEXT NOT NULL,                   -- 紐づくジョブID
  revision INTEGER NOT NULL,              -- 紐づくリビジョン
  channel TEXT NOT NULL,                  -- slack, backlog
  target TEXT NOT NULL,                   -- 送信先（メールアドレス、課題ID等）
  status TEXT NOT NULL,                   -- pending, sent, failed
  external_id TEXT,                       -- 外部システムのID（Slackメッセージts、Backlog課題ID等）
  sent_at TEXT,                           -- 送信日時
  error_message TEXT,                     -- エラー時のメッセージ
  created_at TEXT NOT NULL,               -- レコード作成日時
  idempotency_key TEXT UNIQUE NOT NULL,   -- 冪等キー: job_id|channel|target|revision
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deliveries_job_id ON deliveries(job_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_idempotency_key ON deliveries(idempotency_key);
