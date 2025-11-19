/**
 * 環境変数の検証と設定管理
 */

/**
 * 必須環境変数を検証して取得する
 * @param name 環境変数名
 * @param description 説明（エラーメッセージ用）
 * @returns 環境変数の値
 * @throws Error 環境変数が設定されていない場合
 */
function getRequiredEnv(name: string, description: string): string {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    throw new Error(
      `環境変数 ${name} が設定されていません。\n` +
      `説明: ${description}\n` +
      `設定方法: .env ファイルに ${name}=<値> を追加してください。`
    );
  }

  return value.trim();
}

/**
 * アプリケーション設定
 */
export interface AppConfig {
  backlog: {
    domain: string;
    apiKey: string;
  };
  anthropic: {
    apiKey: string;
  };
  gemini: {
    apiKey?: string;
  };
  llmProvider: 'claude' | 'gemini';
}

/**
 * 環境変数から設定を読み込む
 * @returns 検証済みの設定オブジェクト
 * @throws Error 必須環境変数が不足している場合
 */
export function loadConfig(): AppConfig {
  const llmProvider = (process.env.LLM_PROVIDER === 'gemini' ? 'gemini' : 'claude');

  const config: AppConfig = {
    backlog: {
      domain: getRequiredEnv(
        'BACKLOG_DOMAIN',
        'Backlog スペースのドメイン（例: your-space.backlog.com）'
      ),
      apiKey: getRequiredEnv(
        'BACKLOG_API_KEY',
        'Backlog API キー（個人設定から取得）'
      ),
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
    },
    llmProvider,
  };

  // プロバイダーに応じた必須チェック
  if (llmProvider === 'claude' && !config.anthropic.apiKey) {
    getRequiredEnv('ANTHROPIC_API_KEY', 'Anthropic API キー');
  }
  if (llmProvider === 'gemini' && !config.gemini.apiKey) {
    getRequiredEnv('GEMINI_API_KEY', 'Gemini API キー');
  }

  return config;
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
