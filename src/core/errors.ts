/**
 * カスタムエラー階層
 *
 * アプリケーション全体で一貫したエラーハンドリングを実現
 */

/**
 * エラーコード一覧
 */
export type ErrorCode =
  | 'BACKLOG_API_ERROR'
  | 'SLACK_API_ERROR'
  | 'CALENDAR_API_ERROR'
  | 'LLM_ERROR'
  | 'CONFIG_ERROR'
  | 'DATABASE_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNKNOWN';

/**
 * アプリケーションエラーの基底クラス
 */
export class AppError extends Error {
  /**
   * @param message エラーメッセージ
   * @param code エラーコード
   * @param cause 原因となったエラー
   * @param recoverable 回復可能かどうか
   */
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly cause?: unknown,
    public readonly recoverable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
  }

  /**
   * JSON形式に変換（ログ出力用）
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }

  /**
   * 詳細なスタックトレースを含む文字列表現
   */
  toDetailedString(): string {
    let result = `${this.name} [${this.code}]: ${this.message}`;
    if (this.cause) {
      const causeMessage =
        this.cause instanceof Error ? this.cause.message : String(this.cause);
      result += `\n  Caused by: ${causeMessage}`;
    }
    return result;
  }
}

/**
 * Backlog API関連のエラー
 */
export class BacklogApiError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'BACKLOG_API_ERROR', cause, true);
    this.name = 'BacklogApiError';
  }
}

/**
 * Slack API関連のエラー
 */
export class SlackApiError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'SLACK_API_ERROR', cause, true);
    this.name = 'SlackApiError';
  }
}

/**
 * Google Calendar API関連のエラー
 */
export class CalendarApiError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'CALENDAR_API_ERROR', cause, true);
    this.name = 'CalendarApiError';
  }
}

/**
 * LLM関連のエラー
 */
export class LLMError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'LLM_ERROR', cause, true);
    this.name = 'LLMError';
  }
}

/**
 * 設定関連のエラー（回復不可）
 */
export class ConfigError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'CONFIG_ERROR', cause, false);
    this.name = 'ConfigError';
  }
}

/**
 * データベース関連のエラー
 */
export class DatabaseError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'DATABASE_ERROR', cause, false);
    this.name = 'DatabaseError';
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'VALIDATION_ERROR', cause, false);
    this.name = 'ValidationError';
  }
}

/**
 * リソースが見つからないエラー
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id: string, cause?: unknown) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', cause, false);
    this.name = 'NotFoundError';
  }
}

/**
 * 未知のエラーをAppErrorにラップする
 */
export function wrapError(error: unknown, defaultMessage: string): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message || defaultMessage, 'UNKNOWN', error, false);
  }

  return new AppError(
    typeof error === 'string' ? error : defaultMessage,
    'UNKNOWN',
    error,
    false
  );
}
