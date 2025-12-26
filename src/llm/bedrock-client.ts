import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { LLMClient } from './types.js';

/**
 * AWS Bedrock経由でClaude APIを利用するクライアント
 */
export class BedrockClient implements LLMClient {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor() {
    // AWS認証情報は環境変数やAWS設定ファイルから自動で取得される
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    // デフォルトはClaude 3.5 Sonnet
    this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
  }

  /**
   * テキスト生成を行う
   * @param systemPrompt システムプロンプト
   * @param userPrompt ユーザープロンプト
   * @returns 生成されたテキスト
   */
  async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
    // Anthropic Messages API形式のリクエストボディを構築
    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7,
    });

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: body,
    });

    try {
      const response = await this.client.send(command);

      // レスポンスボディをデコード
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Messages API形式のレスポンスから最初のテキストコンテンツを抽出
      if (responseBody.content && responseBody.content.length > 0) {
        const textContent = responseBody.content.find(
          (item: any) => item.type === 'text'
        );
        if (textContent) {
          return textContent.text;
        }
      }

      throw new Error('レスポンスにテキストコンテンツが含まれていません');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Bedrock API呼び出しに失敗しました: ${error.message}`);
      }
      throw error;
    }
  }
}
