import type { Member } from '../model/batch.js';

/**
 * 期間情報を日本語文字列に変換する
 * @param period 期間情報
 * @returns 期間を表す日本語文字列
 */
export function formatPeriod(period?: Member['period']): string {
  if (period?.weeks) {
    return `${period.weeks}週間`;
  }
  if (period?.months) {
    return `${period.months}ヶ月`;
  }
  if (period?.days) {
    return `${period.days}日`;
  }
  return '2週間（デフォルト）';
}

/**
 * メンバー用の期間テキストを生成する（バッチ生成用）
 * @param period 期間情報
 * @returns 「直近X週間」形式の文字列
 */
export function formatPeriodForGeneration(period?: Member['period']): string {
  if (period?.weeks) {
    return `直近${period.weeks}週間`;
  }
  if (period?.months) {
    return `直近${period.months}ヶ月`;
  }
  if (period?.days) {
    return `直近${period.days}日`;
  }
  return '直近2週間';
}
