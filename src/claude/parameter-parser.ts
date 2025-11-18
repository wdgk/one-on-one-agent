import Anthropic from '@anthropic-ai/sdk';
import type { ParsedParameters } from '../model/agenda.js';
import { createAnthropicClient } from './client-factory.js';
import { CLAUDE_API } from '../constants.js';

/**
 * 自然言語入力からパラメータを抽出するパーサー
 */
export class ParameterParser {
  private client: Anthropic;

  constructor() {
    this.client = createAnthropicClient();
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

    const message = await this.client.messages.create({
      model: CLAUDE_API.MODEL,
      max_tokens: CLAUDE_API.PARAMETER_PARSER_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    // レスポンスからJSONを抽出
    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('予期しないレスポンス形式です');
    }

    const responseText = content.text;

    // JSONをパース
    try {
      // JSON部分のみを抽出（マークダウンコードブロックなどを除去）
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSONが見つかりません');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        memberName: parsed.memberName,
        period: parsed.period,
      };
    } catch (error) {
      throw new Error(
        `パラメータの抽出に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
