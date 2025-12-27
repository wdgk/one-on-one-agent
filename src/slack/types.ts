/**
 * Slack Web API レスポンス型定義
 */

/**
 * users.lookupByEmail APIレスポンス
 */
export type UsersLookupByEmailResponse = {
  ok: boolean;
  user?: {
    id: string;
    name: string;
    real_name?: string;
    profile?: {
      email?: string;
      real_name?: string;
    };
  };
  error?: string;
};

/**
 * conversations.history APIレスポンス
 */
export type ConversationsHistoryResponse = {
  ok: boolean;
  messages?: Array<{
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
  }>;
  has_more?: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
};

/**
 * conversations.list APIレスポンス
 */
export type ConversationsListResponse = {
  ok: boolean;
  channels?: Array<{
    id: string;
    name: string;
    is_member: boolean;
  }>;
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
};

/**
 * chat.getPermalink APIレスポンス
 */
export type ChatGetPermalinkResponse = {
  ok: boolean;
  permalink?: string;
  error?: string;
};
