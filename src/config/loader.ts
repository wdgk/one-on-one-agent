/**
 * Ambient Agent設定ローダー（Zodベース）
 */
import { z } from 'zod';
import { ambientConfigSchema, type AmbientConfig } from './schema.js';

/**
 * 環境変数から基本設定用のオブジェクトを構築する
 */
function buildBaseConfigFromEnv(): Record<string, unknown> {
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
 * 環境変数からAmbient設定用のオブジェクトを構築する
 */
function buildAmbientConfigFromEnv(): Record<string, unknown> {
  const base = buildBaseConfigFromEnv();

  return {
    ...base,
    myEmail: process.env.AMBIENT_MY_EMAIL || '',
    internalDomain: process.env.AMBIENT_INTERNAL_DOMAIN || '',
    dbPath: process.env.AMBIENT_DB_PATH,
    outputDir: process.env.AMBIENT_OUTPUT_DIR,
    lookaheadHours: process.env.AMBIENT_LOOKAHEAD_HOURS,
    sources: {
      slack: {
        channelWhitelist: process.env.AMBIENT_SLACK_CHANNEL_WHITELIST,
        lookbackDays: process.env.AMBIENT_SLACK_LOOKBACK_DAYS,
      },
      backlog: {
        projectWhitelist: process.env.AMBIENT_BACKLOG_PROJECT_WHITELIST,
        lookbackDays: process.env.AMBIENT_BACKLOG_LOOKBACK_DAYS,
      },
      github: {
        repoWhitelist: process.env.AMBIENT_GITHUB_REPO_WHITELIST,
        lookbackDays: process.env.AMBIENT_GITHUB_LOOKBACK_DAYS,
      },
    },
    policy: {
      confidenceThreshold: process.env.AMBIENT_CONFIDENCE_THRESHOLD,
      evidenceRatioThreshold: process.env.AMBIENT_EVIDENCE_RATIO_THRESHOLD,
      autoDispatch: process.env.AMBIENT_AUTO_DISPATCH,
    },
  };
}

/**
 * 環境変数からAmbient Agent設定を読み込む
 * @returns 検証済みのAmbient Agent設定
 * @throws Error 必須設定が不足している場合
 */
export function loadAmbientConfig(): AmbientConfig {
  const rawConfig = buildAmbientConfigFromEnv();
  const result = ambientConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue: z.ZodIssue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`設定エラー:\n${errors}`);
  }

  return result.data;
}

/**
 * グローバルなAmbient設定インスタンス
 */
let ambientConfigInstance: AmbientConfig | null = null;

/**
 * グローバルなAmbient設定を取得する
 * 初回アクセス時に環境変数を検証
 */
export function getAmbientConfig(): AmbientConfig {
  if (!ambientConfigInstance) {
    ambientConfigInstance = loadAmbientConfig();
  }
  return ambientConfigInstance;
}

/**
 * Ambient設定インスタンスをリセットする（テスト用）
 */
export function resetAmbientConfig(): void {
  ambientConfigInstance = null;
}
