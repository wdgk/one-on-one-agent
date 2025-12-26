import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParameterParser } from '../../src/llm/parameter-parser.js';
import { z } from 'zod';

// LLM Factoryをモック
const mockGenerateText = vi.fn();
vi.mock('../../src/llm/factory.js', () => ({
  createLLMClient: () => ({
    generateText: mockGenerateText,
  }),
}));

// config.ts をモック
vi.mock('../../src/config.js', () => ({
  getConfig: () => ({
    anthropic: {
      apiKey: 'test-api-key',
    },
  }),
}));

describe('ParameterParser', () => {
  let parser: ParameterParser;

  beforeEach(() => {
    vi.clearAllMocks();
    parser = new ParameterParser();
  });

  describe('parse', () => {
    it('"佐藤さんの直近2週間" から正しくパラメータを抽出する', async () => {
      mockGenerateText.mockResolvedValue(JSON.stringify({
        memberName: '佐藤',
        period: { weeks: 2 },
      }));

      const input = '佐藤さんの直近2週間の1on1アジェンダを作成して';
      const result = await parser.parse(input);

      expect(result.memberName).toBe('佐藤');
      expect(result.period.weeks).toBe(2);
      expect(result.period.months).toBeUndefined();
      expect(result.period.days).toBeUndefined();
    });

    it('"田中の過去1ヶ月" から正しくパラメータを抽出する', async () => {
      mockGenerateText.mockResolvedValue(JSON.stringify({
        memberName: '田中',
        period: { months: 1 },
      }));

      const input = '田中の過去1ヶ月';
      const result = await parser.parse(input);

      expect(result.memberName).toBe('田中');
      expect(result.period.months).toBe(1);
      expect(result.period.weeks).toBeUndefined();
      expect(result.period.days).toBeUndefined();
    });

    it('"山田さん" からデフォルト期間（2週間）でパラメータを抽出する', async () => {
      mockGenerateText.mockResolvedValue(JSON.stringify({
        memberName: '山田',
        period: { weeks: 2 },
      }));

      const input = '山田さん';
      const result = await parser.parse(input);

      expect(result.memberName).toBe('山田');
      expect(result.period.weeks).toBe(2);
    });

    it('"直近7日" から日数を抽出する', async () => {
      mockGenerateText.mockResolvedValue(JSON.stringify({
        memberName: '鈴木',
        period: { days: 7 },
      }));

      const input = '鈴木さんの直近7日';
      const result = await parser.parse(input);

      expect(result.memberName).toBe('鈴木');
      expect(result.period.days).toBe(7);
      expect(result.period.weeks).toBeUndefined();
    });

    it('"過去3週間" から週数を抽出する', async () => {
      mockGenerateText.mockResolvedValue(JSON.stringify({
        memberName: '高橋',
        period: { weeks: 3 },
      }));

      const input = '高橋さんの過去3週間';
      const result = await parser.parse(input);

      expect(result.memberName).toBe('高橋');
      expect(result.period.weeks).toBe(3);
    });

    it('複雑な文章からも正しく抽出する', async () => {
      mockGenerateText.mockResolvedValue(JSON.stringify({
        memberName: '佐藤',
        period: { weeks: 2 },
      }));

      const input = '佐藤さんの直近2週間の1on1アジェンダを30分枠で作成してください。フォーカスはパフォーマンスとコラボ。';
      const result = await parser.parse(input);

      expect(result.memberName).toBe('佐藤');
      expect(result.period.weeks).toBe(2);
    });
  });
});
