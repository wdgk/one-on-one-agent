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
}
