/**
 * アプリケーション定数
 */

/**
 * 期間計算の定数
 */
export const PERIOD_DEFAULTS = {
  /** デフォルトの期間（日数） */
  DEFAULT_DAYS: 14,
  /** 1週間の日数 */
  DAYS_PER_WEEK: 7,
  /** 1ヶ月の概算日数 */
  DAYS_PER_MONTH: 30,
} as const;

/**
 * Claude API の定数
 */
export const CLAUDE_API = {
  /** 使用するモデル */
  MODEL: 'claude-sonnet-4-5-20250929',
  /** パラメータパース用の最大トークン数 */
  PARAMETER_PARSER_MAX_TOKENS: 1024,
  /** アジェンダ生成用の最大トークン数 */
  AGENDA_GENERATOR_MAX_TOKENS: 4096,
} as const;

/**
 * ミリ秒変換の定数
 */
export const TIME = {
  /** 1日のミリ秒数 */
  MILLISECONDS_PER_DAY: 24 * 60 * 60 * 1000,
} as const;
