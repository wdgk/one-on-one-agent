/**
 * LLMプロバイダー抽象化
 *
 * AI SDKを使用して複数のLLMプロバイダーに対応
 * 環境変数でプロバイダーを切り替え可能
 */
import { LanguageModel } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

/**
 * サポートするLLMプロバイダー
 */
export type LLMProvider = 'bedrock';

/**
 * プロバイダーごとのデフォルトモデルID
 */
const DEFAULT_MODELS: Record<LLMProvider, string> = {
  bedrock: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
};

/**
 * LLMプロバイダー設定
 */
export interface LLMProviderConfig {
  provider: LLMProvider;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 環境変数からプロバイダー設定を取得する
 */
export function getProviderConfig(): LLMProviderConfig {
  const provider = (process.env.LLM_PROVIDER || 'bedrock') as LLMProvider;
  const modelId = process.env.LLM_MODEL_ID || process.env.BEDROCK_MODEL_ID;
  const temperature = process.env.LLM_TEMPERATURE
    ? parseFloat(process.env.LLM_TEMPERATURE)
    : undefined;
  const maxTokens = process.env.LLM_MAX_TOKENS
    ? parseInt(process.env.LLM_MAX_TOKENS, 10)
    : undefined;

  return {
    provider,
    modelId,
    temperature,
    maxTokens,
  };
}

/**
 * プロバイダーとモデルIDからLanguageModelを作成する
 */
export function createModel(
  provider: LLMProvider,
  modelId?: string
): LanguageModel {
  const effectiveModelId = modelId || DEFAULT_MODELS[provider];

  switch (provider) {
    case 'bedrock': {
      // AWS_REGIONが設定されていない場合はus-east-1をデフォルトとして使用
      const region = process.env.AWS_REGION || 'us-east-1';
      const bedrockProvider = createAmazonBedrock({ region });
      return bedrockProvider(effectiveModelId);
    }
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * デフォルト設定でモデルを取得する
 */
export function getDefaultModel(): LanguageModel {
  const config = getProviderConfig();
  return createModel(config.provider, config.modelId);
}

/**
 * デフォルトの生成オプションを取得する
 */
export function getDefaultGenerationOptions(): {
  temperature: number;
  maxTokens: number;
} {
  const config = getProviderConfig();
  return {
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens ?? 4096,
  };
}
