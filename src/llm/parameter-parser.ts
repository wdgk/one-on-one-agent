import { z } from 'zod';
import type { ParsedParameters } from '../model/agenda.js';
import { createLLMClient } from './factory.js';
import { LLMClient } from './types.js';

/**
 * パラメータ抽出結果のZodスキーマ
 */
const ParsedParametersSchema = z.object({
  memberName: z.string().min(1, 'メンバー名は必須です'),
  period: z.object({
    weeks: z.number().optional(),
    months: z.number().optional(),
    days: z.number().optional(),
  }).refine(data => data.weeks || data.months || data.days, {
    message: '期間（weeks, months, days）のいずれかを指定してください',
  }),
});

/**
 * 自然言語入力からパラメータを抽出するパーサー
 */
export class ParameterParser {
  private client: LLMClient;

  constructor() {
    this.client = createLLMClient();
  }

  /**
   * 自然言語入力からメンバー名と期間を抽出する
   * @param inputText ユーザーの入力テキスト
   * @returns 抽出されたパラメータ
   */
  async parse(inputText: string): Promise<ParsedParameters> {
    const systemPrompt = `あなたは1on1アジェンダ生成システムのパラメータ抽出アシスタントです。
ユーザーの自然言語入力から、以下の情報を抽出してJSON形式で返してください。

- memberName: メンバーの名前（例: "佐藤"、"田中さん"）
  - 「さん」は除いて名前部分のみ抽出
- period: 期間を表す情報
  - weeks: 週数（例: "直近2週間" → 2）
  - months: 月数（例: "過去1ヶ月" → 1）
  - days: 日数（例: "直近7日" → 7）

期間が指定されていない場合は、weeksを2としてください。

出力形式（JSONのみ、説明不要）:
{
  "memberName": "...",
  "period": { "weeks": 2 }
}`;

    const userPrompt = `入力: ${inputText}`;

    const responseText = await this.client.generateText(systemPrompt, userPrompt);

    // JSONをパース
    try {
      // JSON部分のみを抽出（マークダウンコードブロックなどを除去）
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSONが見つかりません');
      }

      const parsedJson = JSON.parse(jsonMatch[0]);

      // Zodでバリデーション
      const validated = ParsedParametersSchema.parse(parsedJson);

      return {
        memberName: validated.memberName,
        period: validated.period,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`パラメータのバリデーションに失敗しました: ${errorMessages}`);
      }
      throw new Error(
        `パラメータの抽出に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
