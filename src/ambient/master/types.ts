/**
 * Ambient Agent Master 型定義
 */

/**
 * Scheduler設定
 */
export interface SchedulerConfig {
  /**
   * 先読み時間（時間単位）
   */
  lookaheadHours: number;

  /**
   * 内部ドメイン（例: example.com）
   */
  internalDomain: string;

  /**
   * 1on1判定用のタイトルパターン（正規表現）
   */
  oneOnOneTitlePattern?: RegExp;

  /**
   * 2人のミーティングをすべて1on1として扱うか
   * true: タイトルに関係なく2人のミーティングをすべて1on1とみなす（ノイズが増える可能性）
   * false: タイトルパターンにマッチするミーティングのみを1on1とみなす（推奨）
   * デフォルト: false
   */
  matchAll2PersonMeetings?: boolean;
}
