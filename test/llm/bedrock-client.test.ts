import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BedrockClient } from '../../src/llm/bedrock-client.js';

// AWS SDK のモック
const mockSend = vi.fn();
vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  return {
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    InvokeModelCommand: vi.fn().mockImplementation((params) => params),
  };
});

describe('BedrockClient', () => {
  let client: BedrockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BedrockClient();
  });

  describe('generateText', () => {
    it('正常なレスポンスからテキストを抽出できる', async () => {
      const mockResponseText = 'これは生成されたテキストです。';
      
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [
            {
              type: 'text',
              text: mockResponseText,
            },
          ],
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const systemPrompt = 'あなたはアシスタントです。';
      const userPrompt = 'こんにちは';

      const result = await client.generateText(systemPrompt, userPrompt);

      expect(result).toBe(mockResponseText);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('リクエストボディに正しいパラメータが含まれる', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [{ type: 'text', text: 'テスト' }],
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const systemPrompt = 'システムプロンプト';
      const userPrompt = 'ユーザープロンプト';

      await client.generateText(systemPrompt, userPrompt);

      const callArgs = mockSend.mock.calls[0][0];
      const requestBody = JSON.parse(callArgs.body);

      expect(requestBody.anthropic_version).toBe('bedrock-2023-05-31');
      expect(requestBody.max_tokens).toBe(4096);
      expect(requestBody.system).toBe(systemPrompt);
      expect(requestBody.messages).toEqual([
        {
          role: 'user',
          content: userPrompt,
        },
      ]);
      expect(requestBody.temperature).toBe(0.7);
    });

    it('テキストコンテンツが含まれない場合はエラーをスローする', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [
            {
              type: 'image',
              source: {},
            },
          ],
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(
        client.generateText('system', 'user')
      ).rejects.toThrow('レスポンスにテキストコンテンツが含まれていません');
    });

    it('contentが空配列の場合はエラーをスローする', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [],
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      await expect(
        client.generateText('system', 'user')
      ).rejects.toThrow('レスポンスにテキストコンテンツが含まれていません');
    });

    it('API呼び出しが失敗した場合はエラーメッセージを含む', async () => {
      const errorMessage = 'API rate limit exceeded';
      mockSend.mockRejectedValue(new Error(errorMessage));

      await expect(
        client.generateText('system', 'user')
      ).rejects.toThrow(`Bedrock API呼び出しに失敗しました: ${errorMessage}`);
    });

    it('複数のコンテンツブロックから最初のテキストを抽出する', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [
            {
              type: 'image',
              source: {},
            },
            {
              type: 'text',
              text: '最初のテキスト',
            },
            {
              type: 'text',
              text: '2番目のテキスト',
            },
          ],
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await client.generateText('system', 'user');

      expect(result).toBe('最初のテキスト');
    });

    it('日本語のテキストを正しく処理できる', async () => {
      const japaneseText = 'これは日本語のテストです。\n改行も含まれています。';
      
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          content: [
            {
              type: 'text',
              text: japaneseText,
            },
          ],
        })),
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await client.generateText(
        '日本語で応答してください。',
        'こんにちは'
      );

      expect(result).toBe(japaneseText);
    });
  });
});
