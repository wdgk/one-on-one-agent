/**
 * Backlog課題のサマリー情報
 */
export type IssueSummary = {
  /** 課題ID */
  id: string;
  /** 課題キー（例: PROJ-123） */
  key: string;
  /** 課題タイトル */
  title: string;
  /** 課題種別（bug/feature/task等） */
  type: string;
  /** ステータス */
  status: string;
  /** プロジェクト名 */
  project: string;
  /** 課題URL */
  url: string;
  /** 更新日時（ISO 8601形式） */
  updatedAt: string;
  /** 作成日時（ISO 8601形式）（オプション） */
  createdAt?: string;
  /** 優先度（オプション） */
  priority?: string;
};

/**
 * Backlogユーザー情報
 */
export type BacklogUser = {
  /** ユーザーID */
  id: string;
  /** 表示名 */
  name: string;
  /** メールアドレス（オプション） */
  mailAddress?: string;
};

/**
 * Backlogプルリクエストのサマリー情報
 */
export type PullRequestSummary = {
  /** PR番号 */
  number: number;
  /** PRタイトル */
  title: string;
  /** 説明 */
  description: string;
  /** ステータス */
  status: string;
  /** プロジェクトID */
  projectId: string;
  /** リポジトリID */
  repositoryId: string;
  /** リポジトリ名 */
  repositoryName: string;
  /** PR URL */
  url: string;
  /** 作成日時（ISO 8601形式） */
  createdAt: string;
  /** 更新日時（ISO 8601形式） */
  updatedAt: string;
  /** 紐付けられた課題ID（オプション） */
  issueId?: string;
};
