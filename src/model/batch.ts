import type { AgendaOutput } from './agenda.js';

/**
 * バッチ生成の設定
 */
export interface BatchConfig {
  members: Member[];
  options: BatchOptions;
}

/**
 * メンバー情報
 */
export interface Member {
  name: string;
  period?: {
    weeks?: number;
    months?: number;
    days?: number;
  };
}

/**
 * バッチ生成のオプション
 */
export interface BatchOptions {
  maxConcurrency: number;
  continueOnError: boolean;
  outputDir: string;
}

/**
 * バッチ生成の結果
 */
export interface BatchResult {
  timestamp: string;
  outputDir: string;
  total: number;
  succeeded: number;
  failed: number;
  results: MemberResult[];
}

/**
 * 各メンバーの生成結果
 */
export interface MemberResult {
  memberName: string;
  status: 'success' | 'error';
  output?: AgendaOutput;
  error?: string;
  duration: number; // ミリ秒
}
