/**
 * 環境変数の検証と設定管理（Zodベース）
 */
import { z } from 'zod';
import { baseConfigSchema, type AppConfig } from './config/schema.js';

/**
 * 環境変数から基本設定用のオブジェクトを構築する
 */
function buildConfigFromEnv(): Record<string, unknown> {
  return {
    backlog: {
      domain: process.env.BACKLOG_DOMAIN || '',
      apiKey: process.env.BACKLOG_API_KEY || '',
    },
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN,
      userToken: process.env.SLACK_USER_TOKEN,
    },
    calendar: {
      credentialsPath: process.env.GOOGLE_CALENDAR_CREDENTIALS_PATH,
      tokenPath: process.env.GOOGLE_CALENDAR_TOKEN_PATH,
    },
    options: {
      maxConcurrency: process.env.MAX_CONCURRENCY
        ? parseInt(process.env.MAX_CONCURRENCY, 10)
        : undefined,
      continueOnError: process.env.CONTINUE_ON_ERROR === 'true',
      outputDir: process.env.OUTPUT_DIR,
      dryRun: process.env.DRY_RUN === 'true',
      templateDir: process.env.TEMPLATE_DIR,
    },
  };
}

/**
 * 環境変数から設定を読み込む
 * @returns 検証済みの設定オブジェクト
 * @throws Error 必須環境変数が不足している場合
 */
export function loadConfig(): AppConfig {
  const rawConfig = buildConfigFromEnv();
  const result = baseConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue: z.ZodIssue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`設定エラー:\n${errors}`);
  }

  return result.data;
}

/**
 * グローバル設定インスタンス
 * 初回アクセス時に環境変数を検証
 */
let configInstance: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * 設定インスタンスをリセットする（テスト用）
 */
export function resetConfig(): void {
  configInstance = null;
}

// 型のエクスポート
export type { AppConfig };
