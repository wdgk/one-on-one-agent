/**
 * 設定管理モジュール
 *
 * Zodベースの統一設定スキーマを提供
 */

// スキーマとタイプのエクスポート
export {
  baseConfigSchema,
  ambientConfigSchema,
  type AppConfig,
  type AmbientConfig,
} from './schema.js';

// Ambient設定のローダー
export {
  loadAmbientConfig,
  getAmbientConfig,
} from './loader.js';

// 基本設定は ../config.ts からエクスポート（後方互換性）
export { loadConfig, getConfig, resetConfig } from '../config.js';
