import type { SlackClient } from '../../slack/client.js';
import type { FactRepository } from '../storage/fact-repository.js';
import type { Worker, WorkerContext, WorkerResult } from './types.js';
import type { Source } from '../storage/types.js';

/**
 * SlackCollector - Slackメッセージを収集してFactsを生成する
 */
export class SlackCollector implements Worker {
  constructor(
    private slackClient: SlackClient,
    private factRepository: FactRepository
  ) {}

  /**
   * Worker名を取得する
   * @returns Worker名
   */
  getName(): string {
    return 'SlackCollector';
  }

  /**
   * ソースを取得する
   * @returns ソース種別
   */
  getSource(): Source {
    return 'slack';
  }

  /**
   * Slackメッセージを収集してFactsを生成する
   * @param context Worker実行コンテキスト
   * @returns Worker実行結果
   */
  async collect(context: WorkerContext): Promise<WorkerResult> {
    try {
      const { job, periodStart, periodEnd } = context;

      // Slackユーザーを検索
      const slackUser = await this.slackClient.findUserByEmail(job.attendeeEmail);
      if (!slackUser) {
        return {
          facts: [],
          count: 0,
          error: `Slackユーザーが見つかりません: ${job.attendeeEmail}`,
        };
      }

      // メッセージを取得
      const messages = await this.slackClient.getMessagesInPeriod(
        slackUser.id,
        new Date(periodStart),
        new Date(periodEnd)
      );

      // メッセージをFactsに変換して保存（重複チェック）
      const facts = [];
      for (const message of messages) {
        // permalinkがない場合は、ts + channelで一意なURLを生成
        const url = message.permalink || `slack://channel/${message.channel}/message/${message.ts}`;

        // 既に同じURLのFactが存在するかチェック（冪等性）
        const existing = await this.factRepository.findByUrl(job.id, url);
        if (existing) {
          // 既に存在する場合はスキップ
          continue;
        }

        // tsから日時を復元（tsはUnix timestampの文字列）
        const occurredAt = new Date(parseFloat(message.ts) * 1000).toISOString();

        const fact = await this.factRepository.create({
          jobId: job.id,
          source: 'slack',
          occurredAt,
          summary: this.createSummary(message),
          url,
          confidence: 1.0,
          score: 0.0,
          rawRef: JSON.stringify({
            ts: message.ts,
            channel: message.channel,
            channelName: message.channelName,
            user: message.user,
            threadTs: message.threadTs,
          }),
        });
        facts.push(fact);
      }

      return {
        facts,
        count: facts.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        facts: [],
        count: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * メッセージからサマリーを生成する
   * @param message Slackメッセージ
   * @returns サマリー文字列
   */
  private createSummary(message: any): string {
    const channel = message.channelName ? `#${message.channelName}` : message.channel;
    const prefix = message.threadTs ? '(スレッド)' : '';
    const text = message.text.length > 100 ? `${message.text.substring(0, 100)}...` : message.text;
    return `${prefix}${channel}: ${text}`;
  }
}
