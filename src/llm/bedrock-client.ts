/**
 * AI SDKベースのLLMクライアント
 *
 * Vercel AI SDKを使用してLLMと通信する
 * 現在はAWS Bedrockをサポート
 */
import { generateText, LanguageModel } from 'ai';
import type { LLMClient } from './types.js';
import {
  getDefaultModel,
  getDefaultGenerationOptions,
  createModel,
  type LLMProvider,
} from './provider.js';

/**
 * AI SDKを使用したLLMクライアント
 */
export class AISDKClient implements LLMClient {
  private model: LanguageModel;
  private temperature: number;
  private maxTokens: number;

  constructor(
    provider?: LLMProvider,
    modelId?: string,
    options?: { temperature?: number; maxTokens?: number }
  ) {
    if (provider) {
      this.model = createModel(provider, modelId);
    } else {
      this.model = getDefaultModel();
    }

    const defaults = getDefaultGenerationOptions();
    this.temperature = options?.temperature ?? defaults.temperature;
    this.maxTokens = options?.maxTokens ?? defaults.maxTokens;
  }

  /**
   * テキスト生成を行う
   * @param systemPrompt システムプロンプト
   * @param userPrompt ユーザープロンプト
   * @returns 生成されたテキスト
   */
  async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const result = await generateText({
        model: this.model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: this.temperature,
        maxOutputTokens: this.maxTokens,
      });

      return result.text;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`LLM API呼び出しに失敗しました: ${error.message}`);
      }
      throw error;
    }
  }
}

/**
 * 後方互換性のためのエイリアス
 * @deprecated Use AISDKClient instead
 */
export const BedrockClient = AISDKClient;
