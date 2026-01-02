/**
 * コアモジュール
 *
 * アプリケーション全体で使用する基盤機能を提供
 */
export { Result, type Result as ResultType } from './result.js';
export {
  AppError,
  BacklogApiError,
  SlackApiError,
  CalendarApiError,
  LLMError,
  ConfigError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  wrapError,
  type ErrorCode,
} from './errors.js';
