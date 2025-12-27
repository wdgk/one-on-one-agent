import type { SlackMessage, SlackReaction } from '../model/slack.js';

/**
 * Slack APIレスポンスからSlackMessageに変換する
 */
export function convertToSlackMessage(
  rawMessage: {
    type: string;
    user?: string;
    text: string;
    ts: string;
    thread_ts?: string;
    reactions?: Array<{
      name: string;
      count: number;
      users: string[];
    }>;
  },
  channelId: string,
  channelName?: string,
  permalink?: string
): SlackMessage | null {
  // ユーザーIDがない場合はスキップ（botメッセージなど）
  if (!rawMessage.user) {
    return null;
  }

  // リアクションを変換
  const reactions: SlackReaction[] | undefined = rawMessage.reactions?.map((r) => ({
    name: r.name,
    count: r.count,
    users: r.users,
  }));

  return {
    id: rawMessage.ts,
    text: rawMessage.text,
    user: rawMessage.user,
    channel: channelId,
    channelName,
    ts: rawMessage.ts,
    threadTs: rawMessage.thread_ts,
    permalink,
    type: rawMessage.type,
    reactions,
  };
}

/**
 * メッセージが指定期間内かどうかをチェックする
 */
export function isMessageInPeriod(
  messageTs: string,
  start: Date,
  end: Date
): boolean {
  const messageTime = parseFloat(messageTs) * 1000; // Unix timestamp to milliseconds
  const startTime = start.getTime();
  const endTime = end.getTime();

  return messageTime >= startTime && messageTime <= endTime;
}

/**
 * メッセージをフィルタリングする
 * - Bot投稿を除外
 * - 空のテキストを除外
 * - スレッド返信を除外（オプション）
 */
export function filterMessages(
  messages: SlackMessage[],
  options?: { excludeThreadReplies?: boolean }
): SlackMessage[] {
  return messages.filter((msg) => {
    // 空のテキストを除外
    if (!msg.text || msg.text.trim() === '') {
      return false;
    }

    // スレッド返信を除外する場合
    if (options?.excludeThreadReplies && msg.threadTs && msg.threadTs !== msg.ts) {
      return false;
    }

    return true;
  });
}
