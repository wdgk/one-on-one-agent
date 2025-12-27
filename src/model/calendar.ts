/**
 * イベント種別
 */
export type EventType =
  | 'meeting'          // 会議
  | 'one-on-one'       // 1on1
  | 'focus-time'       // 集中時間
  | 'other';           // その他

/**
 * イベント参加者
 */
export type EventAttendee = {
  /** メールアドレス */
  email: string;
  /** 表示名 */
  displayName?: string;
  /** 参加応答ステータス */
  responseStatus: string; // accepted/declined/tentative/needsAction
};

/**
 * カレンダーイベント
 */
export type CalendarEvent = {
  /** イベントID */
  id: string;
  /** イベント名 */
  summary: string;
  /** 説明 */
  description?: string;
  /** 開始日時（ISO 8601） */
  start: string;
  /** 終了日時（ISO 8601） */
  end: string;
  /** 所要時間（分） */
  durationMinutes: number;
  /** 参加者 */
  attendees?: EventAttendee[];
  /** 主催者メール */
  organizer?: string;
  /** ステータス */
  status: string; // confirmed/tentative/cancelled
  /** イベント種類 */
  eventType: EventType;
  /** Googleカレンダーへのリンク */
  htmlLink?: string;
};

/**
 * 会議統計
 */
export type MeetingStats = {
  /** 総イベント数 */
  totalEvents: number;
  /** 総会議時間（分） */
  totalMeetingMinutes: number;
  /** 会議数 */
  meetingCount: number;
  /** 1on1数 */
  oneOnOneCount: number;
  /** 集中時間（分） */
  focusTimeMinutes: number;
  /** 平均会議時間（分） */
  averageMeetingDuration: number;
  /** 最も忙しい日（YYYY-MM-DD） */
  busiestDay?: string;
};
