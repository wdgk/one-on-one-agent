import { WebClient } from '@slack/web-api';
import { getConfig } from '../config.js';
import type { SlackUser, SlackMessage } from '../model/slack.js';
import type {
  UsersLookupByEmailResponse,
  ConversationsHistoryResponse,
  ConversationsListResponse,
  ChatGetPermalinkResponse,
} from './types.js';
import { convertToSlackMessage, isMessageInPeriod, filterMessages } from './helpers.js';

/**
 * Slackクライアント
 * Slack Web APIを使用してメッセージやユーザー情報を取得する
 */
export class SlackClient {
  private client: WebClient | null = null;
  private connected: boolean = false;

  /**
   * Slack連携が利用可能かどうかを判定
   * @returns Bot Tokenが設定されている場合はtrue
   */
  isAvailable(): boolean {
    const config = getConfig();
    return !!config.slack.botToken;
  }

  /**
   * Slack APIに接続する
   * @throws Error Bot Tokenが設定されていない場合
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const config = getConfig();

    if (!config.slack.botToken) {
      throw new Error(
        'SLACK_BOT_TOKENが設定されていません。\n' +
        '設定方法: .envファイルにSLACK_BOT_TOKEN=xoxb-...を追加してください。'
      );
    }

    this.client = new WebClient(config.slack.botToken);
    this.connected = true;

    console.log('Slack APIに接続しました');
  }

  /**
   * 接続を切断する
   */
  async disconnect(): Promise<void> {
    this.client = null;
    this.connected = false;
  }

  /**
   * メールアドレスからSlackユーザーを検索
   * @param email メールアドレス
   * @returns Slackユーザー情報、見つからない場合はnull
   */
  async findUserByEmail(email: string): Promise<SlackUser | null> {
    if (!this.client) {
      throw new Error('Slack APIに接続されていません。connect()を先に呼び出してください。');
    }

    try {
      const response = (await this.client.users.lookupByEmail({
        email,
      })) as UsersLookupByEmailResponse;

      if (!response.ok || !response.user) {
        console.warn(`Slackユーザーが見つかりません: ${email}`);
        return null;
      }

      const user = response.user;
      return {
        id: user.id,
        name: user.name,
        realName: user.real_name || user.profile?.real_name,
        email: user.profile?.email,
      };
    } catch (error) {
      console.error(`Slackユーザー検索エラー: ${error}`);
      return null;
    }
  }

  /**
   * 指定期間内のユーザーのメッセージを取得
   * @param userId SlackユーザーID
   * @param start 開始日時
   * @param end 終了日時
   * @returns メッセージ配列
   */
  async getMessagesInPeriod(
    userId: string,
    start: Date,
    end: Date
  ): Promise<SlackMessage[]> {
    if (!this.client) {
      throw new Error('Slack APIに接続されていません。connect()を先に呼び出してください。');
    }

    const messages: SlackMessage[] = [];

    try {
      // ユーザーが参加しているチャンネルを取得
      const channels = await this.getUserChannels();

      // 各チャンネルからメッセージを取得
      for (const channel of channels) {
        const channelMessages = await this.getChannelMessages(
          channel.id,
          channel.name,
          userId,
          start,
          end
        );
        messages.push(...channelMessages);
      }

      // メッセージをフィルタリング
      return filterMessages(messages, { excludeThreadReplies: false });
    } catch (error) {
      console.error(`Slackメッセージ取得エラー: ${error}`);
      return [];
    }
  }

  /**
   * ユーザーが参加しているチャンネル一覧を取得
   * @private
   */
  private async getUserChannels(): Promise<Array<{ id: string; name: string }>> {
    if (!this.client) {
      throw new Error('Slack APIに接続されていません。');
    }

    const channels: Array<{ id: string; name: string }> = [];
    let cursor: string | undefined;

    try {
      do {
        const response = (await this.client.conversations.list({
          types: 'public_channel,private_channel',
          exclude_archived: true,
          limit: 100,
          cursor,
        })) as ConversationsListResponse;

        if (!response.ok || !response.channels) {
          break;
        }

        // 参加しているチャンネルのみを追加
        for (const channel of response.channels) {
          if (channel.is_member) {
            channels.push({
              id: channel.id,
              name: channel.name,
            });
          }
        }

        cursor = response.response_metadata?.next_cursor;
      } while (cursor);

      return channels;
    } catch (error) {
      console.error(`チャンネル一覧取得エラー: ${error}`);
      return [];
    }
  }

  /**
   * 特定のチャンネルから指定ユーザーのメッセージを取得
   * @private
   */
  private async getChannelMessages(
    channelId: string,
    channelName: string,
    userId: string,
    start: Date,
    end: Date
  ): Promise<SlackMessage[]> {
    if (!this.client) {
      throw new Error('Slack APIに接続されていません。');
    }

    const messages: SlackMessage[] = [];
    let cursor: string | undefined;

    // Unix timestampに変換（秒単位）
    const oldest = Math.floor(start.getTime() / 1000).toString();
    const latest = Math.floor(end.getTime() / 1000).toString();

    try {
      do {
        const response = (await this.client.conversations.history({
          channel: channelId,
          oldest,
          latest,
          limit: 100,
          cursor,
        })) as ConversationsHistoryResponse;

        if (!response.ok || !response.messages) {
          break;
        }

        for (const rawMessage of response.messages) {
          // 指定ユーザーのメッセージのみを処理
          if (rawMessage.user !== userId) {
            continue;
          }

          // 期間内のメッセージのみを処理
          if (!isMessageInPeriod(rawMessage.ts, start, end)) {
            continue;
          }

          // パーマリンクを取得（オプション）
          let permalink: string | undefined;
          try {
            const permalinkResponse = (await this.client.chat.getPermalink({
              channel: channelId,
              message_ts: rawMessage.ts,
            })) as ChatGetPermalinkResponse;

            if (permalinkResponse.ok) {
              permalink = permalinkResponse.permalink;
            }
          } catch {
            // パーマリンク取得失敗は無視
          }

          const message = convertToSlackMessage(
            rawMessage,
            channelId,
            channelName,
            permalink
          );

          if (message) {
            messages.push(message);
          }
        }

        cursor = response.response_metadata?.next_cursor;
      } while (cursor);

      return messages;
    } catch (error) {
      console.error(`チャンネル ${channelName} のメッセージ取得エラー: ${error}`);
      return [];
    }
  }
}
