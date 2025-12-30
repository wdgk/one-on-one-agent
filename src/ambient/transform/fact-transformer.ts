import type { Fact } from '../storage/types.js';
import type { AgendaInput } from '../../model/agenda.js';
import type { IssueSummary, PullRequestSummary } from '../../model/backlog.js';
import type { CalendarEvent, MeetingStats } from '../../model/calendar.js';

/**
 * FactTransformer - Facts を AgendaInput 形式に変換する
 */
export class FactTransformer {
  /**
   * Facts配列をAgendaInput形式に変換する
   * @param member メンバー情報
   * @param period 対象期間
   * @param facts Facts配列
   * @returns AgendaInput
   */
  transformToAgendaInput(
    member: { id: string; name: string },
    period: { start: string; end: string },
    facts: Fact[]
  ): AgendaInput {
    const issues: IssueSummary[] = [];
    const pullRequests: PullRequestSummary[] = [];
    const slackMessages: any[] = [];
    const calendarEvents: CalendarEvent[] = [];
    let meetingStats: MeetingStats | undefined;

    for (const fact of facts) {
      try {
        const rawData = JSON.parse(fact.rawRef);

        switch (fact.source) {
          case 'backlog':
            this.processBacklogFact(rawData, issues, pullRequests);
            break;
          case 'slack':
            this.processSlackFact(rawData, slackMessages);
            break;
          case 'calendar':
            this.processCalendarFact(rawData, calendarEvents, (stats) => {
              meetingStats = stats;
            });
            break;
          default:
            // 未知のソースは無視
            break;
        }
      } catch (error) {
        // 無効なJSONや予期しないエラーは無視して続行
        continue;
      }
    }

    const agendaInput: AgendaInput = {
      member,
      period,
      backlog: {
        issues,
        pullRequests,
      },
    };

    // Slackデータがある場合のみ追加
    if (slackMessages.length > 0) {
      agendaInput.slack = {
        messages: slackMessages,
      };
    }

    // Calendarデータがある場合のみ追加
    if (calendarEvents.length > 0 || meetingStats) {
      agendaInput.calendar = {
        events: calendarEvents,
        stats: meetingStats || this.createEmptyStats(),
      };
    }

    return agendaInput;
  }

  /**
   * BacklogソースのFactを処理
   */
  private processBacklogFact(
    rawData: any,
    issues: IssueSummary[],
    pullRequests: PullRequestSummary[]
  ): void {
    // keyフィールドがあればIssue、numberフィールドがあればPR
    if ('key' in rawData) {
      // Issue
      issues.push(rawData as IssueSummary);
    } else if ('number' in rawData) {
      // PullRequest
      pullRequests.push(rawData as PullRequestSummary);
    }
  }

  /**
   * SlackソースのFactを処理
   */
  private processSlackFact(rawData: any, messages: any[]): void {
    // メッセージデータをそのまま追加
    messages.push({
      id: rawData.id,
      text: rawData.text,
      user: rawData.user,
      channel: rawData.channel,
      ts: rawData.ts,
      permalink: rawData.permalink,
      type: rawData.type,
    });
  }

  /**
   * CalendarソースのFactを処理
   */
  private processCalendarFact(
    rawData: any,
    events: CalendarEvent[],
    setStats: (stats: MeetingStats) => void
  ): void {
    // _type='stats' の場合は統計情報
    if (rawData._type === 'stats') {
      setStats({
        totalEvents: rawData.totalEvents,
        totalMeetingMinutes: rawData.totalMeetingMinutes,
        meetingCount: rawData.meetingCount,
        oneOnOneCount: rawData.oneOnOneCount,
        focusTimeMinutes: rawData.focusTimeMinutes,
        averageMeetingDuration: rawData.averageMeetingDuration,
        busiestDay: rawData.busiestDay,
      });
    } else {
      // それ以外はイベント
      events.push(rawData as CalendarEvent);
    }
  }

  /**
   * 空の統計情報を作成
   */
  private createEmptyStats(): MeetingStats {
    return {
      totalEvents: 0,
      totalMeetingMinutes: 0,
      meetingCount: 0,
      oneOnOneCount: 0,
      focusTimeMinutes: 0,
      averageMeetingDuration: 0,
    };
  }
}
