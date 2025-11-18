import Anthropic from '@anthropic-ai/sdk';
import type { AgendaInput } from '../model/agenda.js';
import { createAnthropicClient } from './client-factory.js';
import { CLAUDE_API } from '../constants.js';

/**
 * AgendaInputからMarkdownアジェンダを生成するジェネレーター
 */
export class AgendaGenerator {
  private client: Anthropic;

  constructor() {
    this.client = createAnthropicClient();
  }

  /**
   * AgendaInputからMarkdown形式のアジェンダを生成する
   * @param input アジェンダ生成のための入力データ
   * @returns 生成されたMarkdownテキスト
   */
  async generate(input: AgendaInput): Promise<string> {
    const systemPrompt = `あなたはエンジニアリングマネージャー（EM）向けの1on1アジェンダ作成アシスタントです。

以下のルールに従ってMarkdown形式のアジェンダを作成してください：

1. トーン
   - メンバーを断定的に評価しない
   - 「〜のように見える」「〜を確認したい」など観察ベースの表現を使う
   - ポジティブかつ建設的なトーンを保つ

2. セクション構成
   - 最近のハイライト（成果）: 完了した課題、マージされたPR、進行中の重要な取り組み
   - 気になる点・リスク: 長期停滞課題、高優先度の未完了課題、長期レビュー中のPRなど
   - チームとのコラボレーション: 他メンバーとの関わりが見える課題やPR活動
   - 成長・学習・キャリア: 新しい技術領域やチャレンジ（課題・PRの両方から判断）
   - 1on1での質問案: オープンクエスチョン3-5個

3. 情報の優先順位
   - 高優先度の課題を優先
   - 最近更新された課題・PRを重視
   - マージされたPRは成果として重視
   - バグより機能開発を成長の文脈で取り上げる

入力データはJSON形式で提供されます。`;

    const userPrompt = `以下が対象メンバーの直近活動ログです。

メンバー: ${input.member.name}
期間: ${input.period.start} 〜 ${input.period.end}

課題一覧:
${JSON.stringify(input.backlog.issues, null, 2)}

プルリクエスト一覧:
${JSON.stringify(input.backlog.pullRequests, null, 2)}

上記の情報から1on1アジェンダをMarkdown形式で作成してください。

アジェンダの形式:
# 1on1 アジェンダ: ${input.member.name}

**日時**: （1on1実施時に記入）
**期間**: ${input.period.start} 〜 ${input.period.end}

## 最近のハイライト（成果）

（完了した課題や進行中の重要な取り組みをリストアップ）

## 気になる点・リスク

（長期停滞課題、高優先度の未完了課題など）

## チームとのコラボレーション

（他メンバーとの関わりが見える活動）

## 成長・学習・キャリア

（新しい技術領域やチャレンジ）

## 1on1での質問案

1. （オープンクエスチョン）
2. （オープンクエスチョン）
3. （オープンクエスチョン）

## メモ欄

（1on1中の記録用）
`;

    const message = await this.client.messages.create({
      model: CLAUDE_API.MODEL,
      max_tokens: CLAUDE_API.AGENDA_GENERATOR_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    // レスポンスからテキストを抽出
    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('予期しないレスポンス形式です');
    }

    return content.text;
  }
}
