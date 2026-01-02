/**
 * LLMクライアントファクトリー
 *
 * AI SDKベースのLLMクライアントを生成する
 */
import { LLMClient } from './types.js';
import { AISDKClient } from './bedrock-client.js';
import type { LLMProvider } from './provider.js';

/**
 * LLMクライアント生成オプション
 */
export interface CreateLLMClientOptions {
  provider?: LLMProvider;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * LLMクライアントを生成する
 * 環境変数またはオプションで設定を指定可能
 */
export function createLLMClient(options?: CreateLLMClientOptions): LLMClient {
  return new AISDKClient(options?.provider, options?.modelId, {
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
  });
}
