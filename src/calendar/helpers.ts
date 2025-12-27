import type { CalendarEvent, EventType, MeetingStats } from '../model/calendar.js';

/**
 * イベント種別を判定する
 */
export function determineEventType(
  summary: string,
  attendees?: Array<{ email: string }>
): EventType {
  const lowerSummary = summary.toLowerCase();

  // 1on1の判定
  if (
    lowerSummary.includes('1on1') ||
    lowerSummary.includes('1-on-1') ||
    lowerSummary.includes('one on one') ||
    lowerSummary.includes('one-on-one') ||
    (attendees && attendees.length === 2) // 2人のみの会議
  ) {
    return 'one-on-one';
  }

  // 集中時間の判定
  if (
    lowerSummary.includes('focus') ||
    lowerSummary.includes('集中') ||
    lowerSummary.includes('作業') ||
    lowerSummary.includes('do not disturb') ||
    (!attendees || attendees.length === 0) // 参加者がいない
  ) {
    return 'focus-time';
  }

  // その他の会議
  if (attendees && attendees.length > 0) {
    return 'meeting';
  }

  return 'other';
}

/**
 * イベントの所要時間を計算する（分単位）
 */
export function calculateDuration(start: string, end: string): number {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  return Math.round((endTime - startTime) / (1000 * 60)); // ミリ秒を分に変換
}

/**
 * イベント一覧から会議統計を計算する
 */
export function calculateMeetingStats(events: CalendarEvent[]): MeetingStats {
  let totalEvents = 0;
  let totalMeetingMinutes = 0;
  let meetingCount = 0;
  let oneOnOneCount = 0;
  let focusTimeMinutes = 0;

  // 日ごとの会議時間を記録（最も忙しい日を特定するため）
  const dailyMinutes = new Map<string, number>();

  for (const event of events) {
    totalEvents++;
    totalMeetingMinutes += event.durationMinutes;

    // イベント種類ごとのカウント
    switch (event.eventType) {
      case 'meeting':
        meetingCount++;
        break;
      case 'one-on-one':
        oneOnOneCount++;
        meetingCount++; // 1on1も会議数にカウント
        break;
      case 'focus-time':
        focusTimeMinutes += event.durationMinutes;
        break;
    }

    // 日ごとの会議時間を集計
    const eventDate = event.start.split('T')[0]; // YYYY-MM-DD
    const currentMinutes = dailyMinutes.get(eventDate) || 0;
    dailyMinutes.set(eventDate, currentMinutes + event.durationMinutes);
  }

  // 平均会議時間を計算
  const averageMeetingDuration = meetingCount > 0
    ? Math.round(totalMeetingMinutes / meetingCount)
    : 0;

  // 最も忙しい日を特定
  let busiestDay: string | undefined;
  let maxMinutes = 0;
  for (const [date, minutes] of dailyMinutes.entries()) {
    if (minutes > maxMinutes) {
      maxMinutes = minutes;
      busiestDay = date;
    }
  }

  return {
    totalEvents,
    totalMeetingMinutes,
    meetingCount,
    oneOnOneCount,
    focusTimeMinutes,
    averageMeetingDuration,
    busiestDay,
  };
}

/**
 * Google Calendar APIのイベントをCalendarEventに変換する
 */
export function convertToCalendarEvent(
  rawEvent: {
    id: string;
    summary?: string;
    description?: string;
    status?: string;
    htmlLink?: string;
    start?: {
      dateTime?: string;
      date?: string;
    };
    end?: {
      dateTime?: string;
      date?: string;
    };
    attendees?: Array<{
      email: string;
      displayName?: string;
      responseStatus?: string;
    }>;
    organizer?: {
      email: string;
    };
  }
): CalendarEvent | null {
  // 開始・終了時刻がない場合はスキップ
  if (!rawEvent.start || !rawEvent.end) {
    return null;
  }

  const start = rawEvent.start.dateTime || rawEvent.start.date;
  const end = rawEvent.end.dateTime || rawEvent.end.date;

  if (!start || !end) {
    return null;
  }

  const summary = rawEvent.summary || '(タイトルなし)';
  const durationMinutes = calculateDuration(start, end);
  const eventType = determineEventType(summary, rawEvent.attendees);

  return {
    id: rawEvent.id,
    summary,
    description: rawEvent.description,
    start,
    end,
    durationMinutes,
    attendees: rawEvent.attendees?.map((a) => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus || 'needsAction',
    })),
    organizer: rawEvent.organizer?.email,
    status: rawEvent.status || 'confirmed',
    eventType,
    htmlLink: rawEvent.htmlLink,
  };
}
