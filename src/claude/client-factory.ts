import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../config.js';

/**
 * Anthropic クライアントのファクトリー
 * 設定から API キーを読み込んでクライアントを生成する
 */
export function createAnthropicClient(): Anthropic {
  const config = getConfig();
  return new Anthropic({
    apiKey: config.anthropic.apiKey,
  });
}
