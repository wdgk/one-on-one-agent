import { addHours } from 'date-fns';
import type { CalendarClient } from '../../calendar/client.js';
import type { JobRepository } from '../storage/job-repository.js';
import type { Job } from '../storage/types.js';
import type { SchedulerConfig } from './types.js';
import type { CalendarEvent } from '../../model/calendar.js';

/**
 * Scheduler - カレンダーから1on1イベントを抽出してJobを作成する
 */
export class Scheduler {
  private config: SchedulerConfig;

  constructor(
    private calendarClient: CalendarClient,
    private jobRepository: JobRepository,
    config: SchedulerConfig
  ) {
    this.config = {
      lookaheadHours: config.lookaheadHours,
      internalDomain: config.internalDomain,
      oneOnOneTitlePattern: config.oneOnOneTitlePattern || /1\s*on\s*1|1\s*:?\s*1|one\s*on\s*one/i,
      matchAll2PersonMeetings: config.matchAll2PersonMeetings !== undefined ? config.matchAll2PersonMeetings : false,
    };
  }

  /**
   * カレンダーから1on1イベントを抽出してJobを作成する
   * @param myEmail 自分のメールアドレス
   * @returns 作成されたJobの配列
   */
  async scheduleJobs(myEmail: string): Promise<Job[]> {
    // 先読み期間を計算
    const start = new Date();
    const end = addHours(start, this.config.lookaheadHours);

    // メールアドレスを正規化
    const normalizedMyEmail = this.normalizeEmail(myEmail);

    // カレンダーからイベントを取得
    const events = await this.calendarClient.getEventsInPeriod(myEmail, start, end);

    // 1on1候補を抽出
    const oneOnOneCandidates = this.filter1on1Events(events, normalizedMyEmail);

    // 各候補からJobを作成（冪等）
    const jobs: Job[] = [];
    for (const event of oneOnOneCandidates) {
      // 自分以外の参加者を特定
      const attendee = event.attendees?.find(a => this.normalizeEmail(a.email) !== normalizedMyEmail);
      if (!attendee) {
        continue;
      }

      const job = await this.jobRepository.upsert({
        eventId: event.id,
        attendeeEmail: attendee.email,
        attendeeName: attendee.displayName || null,
        startAt: event.start,
        endAt: event.end,
      });

      jobs.push(job);
    }

    return jobs;
  }

  /**
   * 1on1イベントを抽出する
   * @param events カレンダーイベントの配列
   * @param myEmail 自分のメールアドレス（正規化済み）
   * @returns 1on1候補の配列
   */
  private filter1on1Events(events: CalendarEvent[], myEmail: string): CalendarEvent[] {
    return events.filter(event => {
      // 参加者が存在しない場合は除外
      if (!event.attendees || event.attendees.length === 0) {
        return false;
      }

      // 参加者が2人でない場合は除外
      if (event.attendees.length !== 2) {
        return false;
      }

      // 自分が参加者に含まれていない場合は除外
      const includesMe = event.attendees.some(a => this.normalizeEmail(a.email) === myEmail);
      if (!includesMe) {
        return false;
      }

      // 外部ドメインの参加者を除外
      const hasExternalAttendee = event.attendees.some(
        a => !this.isInternalEmail(a.email)
      );
      if (hasExternalAttendee) {
        return false;
      }

      // matchAll2PersonMeetings=true の場合は2人ミーティングをすべて1on1とみなす
      // false の場合はタイトルパターンに一致するもののみを1on1とみなす
      if (this.config.matchAll2PersonMeetings) {
        return true;
      }

      // タイトルパターンに一致するかチェック
      return this.config.oneOnOneTitlePattern!.test(event.summary);
    });
  }

  /**
   * 内部ドメインのメールアドレスかチェックする
   * @param email メールアドレス
   * @returns 内部ドメインの場合はtrue
   */
  private isInternalEmail(email: string): boolean {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedDomain = this.config.internalDomain.toLowerCase().trim();
    return normalizedEmail.endsWith(`@${normalizedDomain}`);
  }

  /**
   * メールアドレスを正規化する（小文字化・トリム）
   * @param email メールアドレス
   * @returns 正規化されたメールアドレス
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }
}
