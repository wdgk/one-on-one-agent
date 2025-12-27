/**
 * Google Calendar API レスポンス型定義
 */

/**
 * calendar.events.list APIレスポンス
 */
export type CalendarEventsListResponse = {
  items?: Array<{
    id: string;
    summary?: string;
    description?: string;
    status?: string;
    htmlLink?: string;
    start?: {
      dateTime?: string;
      date?: string;
      timeZone?: string;
    };
    end?: {
      dateTime?: string;
      date?: string;
      timeZone?: string;
    };
    attendees?: Array<{
      email: string;
      displayName?: string;
      responseStatus?: string;
    }>;
    organizer?: {
      email: string;
      displayName?: string;
    };
  }>;
  nextPageToken?: string;
};
