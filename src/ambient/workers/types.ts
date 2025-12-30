/**
 * Ambient Agent Workers 型定義
 */

import type { Source, Fact, Task, Job } from '../storage/types.js';

/**
 * Worker実行コンテキスト
 */
export interface WorkerContext {
  /**
   * 実行対象のJob
   */
  job: Job;

  /**
   * 実行対象のTask
   */
  task: Task;

  /**
   * 収集期間の開始日時（ISO 8601）
   */
  periodStart: string;

  /**
   * 収集期間の終了日時（ISO 8601）
   */
  periodEnd: string;
}

/**
 * Worker実行結果
 */
export interface WorkerResult {
  /**
   * 収集されたFacts
   */
  facts: Fact[];

  /**
   * 収集された件数
   */
  count: number;

  /**
   * エラーメッセージ（エラー時）
   */
  error?: string;
}

/**
 * Worker抽象インターフェース
 *
 * すべての情報源コレクタ（SlackCollector, BacklogCollector等）が実装する
 */
export interface Worker {
  /**
   * Worker名を取得する
   * @returns Worker名（例: "SlackCollector"）
   */
  getName(): string;

  /**
   * ソースを取得する
   * @returns ソース種別
   */
  getSource(): Source;

  /**
   * データを収集してFactsを生成する
   * @param context Worker実行コンテキスト
   * @returns Worker実行結果
   */
  collect(context: WorkerContext): Promise<WorkerResult>;
}
