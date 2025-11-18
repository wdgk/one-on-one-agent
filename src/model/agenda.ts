import type { IssueSummary, PullRequestSummary } from './backlog.js';

/**
 * アジェンダ生成のための入力データ
 */
export type AgendaInput = {
  /** メンバー情報 */
  member: {
    /** Backlog user ID */
    id: string;
    /** 表示名 */
    name: string;
  };
  /** 対象期間 */
  period: {
    /** 開始日（ISO 8601形式: YYYY-MM-DD） */
    start: string;
    /** 終了日（ISO 8601形式: YYYY-MM-DD） */
    end: string;
  };
  /** Backlog情報 */
  backlog: {
    /** 課題一覧 */
    issues: IssueSummary[];
    /** プルリクエスト一覧 */
    pullRequests: PullRequestSummary[];
  };
};

/**
 * 生成されたアジェンダの出力データ
 */
export type AgendaOutput = {
  /** 生成されたMarkdownテキスト */
  markdown: string;
  /** メタデータ */
  metadata: {
    /** メンバーID */
    memberId: string;
    /** メンバー名 */
    memberName: string;
    /** 期間開始日（ISO 8601形式: YYYY-MM-DD） */
    periodStart: string;
    /** 期間終了日（ISO 8601形式: YYYY-MM-DD） */
    periodEnd: string;
    /** 生成日時（ISO 8601形式） */
    generatedAt: string;
    /** 課題件数 */
    issueCount: number;
  };
};

/**
 * パラメータ抽出結果
 */
export type ParsedParameters = {
  /** メンバー名 */
  memberName: string;
  /** 期間指定 */
  period: {
    /** 週数 */
    weeks?: number;
    /** 月数 */
    months?: number;
    /** 日数 */
    days?: number;
  };
};
