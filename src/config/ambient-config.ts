/**
 * Ambient Agent設定管理
 */

/**
 * 必須環境変数を取得する
 * @param name 環境変数名
 * @returns 環境変数の値
 * @throws Error 環境変数が設定されていない場合
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `環境変数 ${name} が設定されていません。\n` +
      `.env ファイルに ${name}=<値> を追加してください。`
    );
  }
  return value.trim();
}

/**
 * Ambient Agent設定
 */
export interface AmbientConfig {
  /**
   * 自分のメールアドレス
   */
  myEmail: string;

  /**
   * SQLiteデータベースファイルパス
   */
  dbPath: string;

  /**
   * 出力ディレクトリ
   */
  outputDir: string;

  /**
   * 先読み時間（時間単位）
   */
  lookaheadHours: number;

  /**
   * 内部ドメイン
   */
  internalDomain: string;

  /**
   * 情報源設定
   */
  sources: {
    slack: {
      channelWhitelist: string[];
      lookbackDays: number;
    };
    backlog: {
      projectWhitelist: string[];
      lookbackDays: number;
    };
    github: {
      repoWhitelist: string[];
      lookbackDays: number;
    };
  };

  /**
   * ポリシー設定
   */
  policy: {
    confidenceThreshold: number;
    evidenceRatioThreshold: number;
    autoDispatch: boolean;
  };
}

/**
 * CSV文字列をパースする（空白をトリム）
 * @param csv CSV文字列
 * @returns トリム済みの配列
 */
function parseCSV(csv: string): string[] {
  return csv
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * 数値をパースする（バリデーション付き）
 * @param value 文字列値
 * @param defaultValue デフォルト値
 * @param name 環境変数名（エラーメッセージ用）
 * @returns パース済みの数値
 */
function parseNumber(value: string | undefined, defaultValue: number, name: string): number {
  if (!value) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`環境変数 ${name} の値 "${value}" は数値ではありません。デフォルト値 ${defaultValue} を使用します。`);
    return defaultValue;
  }

  return parsed;
}

/**
 * 環境変数からAmbient Agent設定を読み込む
 * @returns Ambient Agent設定
 */
export function loadAmbientConfig(): AmbientConfig {
  return {
    myEmail: getRequiredEnv('AMBIENT_MY_EMAIL'),
    dbPath: process.env.AMBIENT_DB_PATH || './ambient.db',
    outputDir: process.env.AMBIENT_OUTPUT_DIR || './1on1-agendas',
    lookaheadHours: parseNumber(process.env.AMBIENT_LOOKAHEAD_HOURS, 48, 'AMBIENT_LOOKAHEAD_HOURS'),
    internalDomain: getRequiredEnv('AMBIENT_INTERNAL_DOMAIN'),
    sources: {
      slack: {
        channelWhitelist: parseCSV(process.env.AMBIENT_SLACK_CHANNEL_WHITELIST || ''),
        lookbackDays: 14,
      },
      backlog: {
        projectWhitelist: parseCSV(process.env.AMBIENT_BACKLOG_PROJECT_WHITELIST || ''),
        lookbackDays: 14,
      },
      github: {
        repoWhitelist: parseCSV(process.env.AMBIENT_GITHUB_REPO_WHITELIST || ''),
        lookbackDays: 14,
      },
    },
    policy: {
      confidenceThreshold: 0.7,
      evidenceRatioThreshold: 0.8,
      autoDispatch: false, // Phase Aではfalseでプレビューのみ
    },
  };
}
