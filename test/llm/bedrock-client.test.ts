import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AISDKClient, BedrockClient } from '../../src/llm/bedrock-client.js';

// AI SDK のモック
const mockGenerateText = vi.fn();
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

// プロバイダーのモック
vi.mock('@ai-sdk/amazon-bedrock', () => ({
  createAmazonBedrock: vi.fn().mockReturnValue(
    vi.fn().mockReturnValue({ modelId: 'mock-bedrock-model' })
  ),
}));

describe('AISDKClient', () => {
  let client: AISDKClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // 環境変数をリセット
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_MODEL_ID;
    delete process.env.BEDROCK_MODEL_ID;
    delete process.env.LLM_TEMPERATURE;
    delete process.env.LLM_MAX_TOKENS;
    client = new AISDKClient();
  });

  describe('generateText', () => {
    it('正常なレスポンスからテキストを抽出できる', async () => {
      const mockResponseText = 'これは生成されたテキストです。';

      mockGenerateText.mockResolvedValue({
        text: mockResponseText,
        usage: { totalTokens: 100 },
      });

      const systemPrompt = 'あなたはアシスタントです。';
      const userPrompt = 'こんにちは';

      const result = await client.generateText(systemPrompt, userPrompt);

      expect(result).toBe(mockResponseText);
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });

    it('リクエストに正しいパラメータが含まれる', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'テスト',
        usage: { totalTokens: 50 },
      });

      const systemPrompt = 'システムプロンプト';
      const userPrompt = 'ユーザープロンプト';

      await client.generateText(systemPrompt, userPrompt);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0.7,
          maxOutputTokens: 4096,
        })
      );
    });

    it('API呼び出しが失敗した場合はエラーメッセージを含む', async () => {
      const errorMessage = 'API rate limit exceeded';
      mockGenerateText.mockRejectedValue(new Error(errorMessage));

      await expect(
        client.generateText('system', 'user')
      ).rejects.toThrow(`LLM API呼び出しに失敗しました: ${errorMessage}`);
    });

    it('日本語のテキストを正しく処理できる', async () => {
      const japaneseText = 'これは日本語のテストです。\n改行も含まれています。';

      mockGenerateText.mockResolvedValue({
        text: japaneseText,
        usage: { totalTokens: 80 },
      });

      const result = await client.generateText(
        '日本語で応答してください。',
        'こんにちは'
      );

      expect(result).toBe(japaneseText);
    });

    it('カスタム設定でクライアントを作成できる', async () => {
      const customClient = new AISDKClient('bedrock', 'custom-model-id', {
        temperature: 0.5,
        maxTokens: 2048,
      });

      mockGenerateText.mockResolvedValue({
        text: 'カスタム設定テスト',
        usage: { totalTokens: 30 },
      });

      await customClient.generateText('system', 'user');

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
          maxOutputTokens: 2048,
        })
      );
    });

    it('環境変数から設定を読み込める', async () => {
      process.env.LLM_TEMPERATURE = '0.3';
      process.env.LLM_MAX_TOKENS = '1024';

      const envClient = new AISDKClient();

      mockGenerateText.mockResolvedValue({
        text: '環境変数テスト',
        usage: { totalTokens: 20 },
      });

      await envClient.generateText('system', 'user');

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          maxOutputTokens: 1024,
        })
      );
    });
  });

  describe('BedrockClient alias', () => {
    it('BedrockClientはAISDKClientのエイリアスである', () => {
      expect(BedrockClient).toBe(AISDKClient);
    });
  });
});
