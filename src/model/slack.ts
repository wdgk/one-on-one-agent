/**
 * Slackユーザー情報
 */
export type SlackUser = {
  /** Slack User ID */
  id: string;
  /** 表示名 */
  name: string;
  /** 本名 */
  realName?: string;
  /** メールアドレス */
  email?: string;
};

/**
 * Slackリアクション
 */
export type SlackReaction = {
  /** 絵文字名（例: thumbsup） */
  name: string;
  /** リアクション数 */
  count: number;
  /** リアクションしたUser IDリスト */
  users: string[];
};

/**
 * Slackメッセージ
 */
export type SlackMessage = {
  /** メッセージID（タイムスタンプ） */
  id: string;
  /** メッセージ本文 */
  text: string;
  /** 投稿者User ID */
  user: string;
  /** チャンネルID */
  channel: string;
  /** チャンネル名 */
  channelName?: string;
  /** タイムスタンプ */
  ts: string;
  /** スレッドのルートタイムスタンプ */
  threadTs?: string;
  /** パーマリンク */
  permalink?: string;
  /** メッセージタイプ */
  type: string;
  /** リアクション一覧 */
  reactions?: SlackReaction[];
};
