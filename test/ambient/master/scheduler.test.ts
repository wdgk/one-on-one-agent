import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { DatabaseConnection } from '../../../src/ambient/storage/database.js';
import { JobRepository } from '../../../src/ambient/storage/job-repository.js';
import { Scheduler } from '../../../src/ambient/master/scheduler.js';
import type { CalendarClient } from '../../../src/calendar/client.js';
import type { CalendarEvent } from '../../../src/model/calendar.js';

describe('Scheduler', () => {
  let db: DatabaseConnection;
  let jobRepository: JobRepository;
  let scheduler: Scheduler;
  let mockCalendarClient: CalendarClient;
  let dbPath: string;

  beforeEach(async () => {
    // テスト用の一時DBファイルを作成
    dbPath = join(tmpdir(), `test-ambient-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    db = new DatabaseConnection(dbPath);
    await db.connect();
    jobRepository = new JobRepository(db);

    // CalendarClientのモック
    mockCalendarClient = {
      getEventsInPeriod: vi.fn(),
      isAvailable: vi.fn().mockReturnValue(true),
      connect: vi.fn(),
      disconnect: vi.fn(),
      getMeetingStats: vi.fn(),
    } as any;

    scheduler = new Scheduler(
      mockCalendarClient,
      jobRepository,
      {
        lookaheadHours: 48,
        internalDomain: 'example.com',
      }
    );
  });

  afterEach(async () => {
    // DB接続を切断してファイル削除
    await db.disconnect();
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  });

  describe('scheduleJobs', () => {
    it('タイトルに"1on1"を含むイベントからJobを作成できること', async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event1',
          summary: '1on1: テストメンバー',
          start: '2025-01-15T10:00:00Z',
          end: '2025-01-15T11:00:00Z',
          durationMinutes: 60,
          attendees: [
            { email: 'manager@example.com', displayName: 'マネージャー', responseStatus: 'accepted' },
            { email: 'member@example.com', displayName: 'テストメンバー', responseStatus: 'accepted' },
          ],
          status: 'confirmed',
          eventType: 'one-on-one',
        },
        {
          id: 'event2',
          summary: 'チームミーティング',
          start: '2025-01-15T14:00:00Z',
          end: '2025-01-15T15:00:00Z',
          durationMinutes: 60,
          attendees: [
            { email: 'manager@example.com', displayName: 'マネージャー', responseStatus: 'accepted' },
            { email: 'member1@example.com', displayName: 'メンバー1', responseStatus: 'accepted' },
            { email: 'member2@example.com', displayName: 'メンバー2', responseStatus: 'accepted' },
          ],
          status: 'confirmed',
          eventType: 'meeting',
        },
      ];

      vi.mocked(mockCalendarClient.getEventsInPeriod).mockResolvedValue(mockEvents);

      const jobs = await scheduler.scheduleJobs('manager@example.com');

      expect(jobs).toHaveLength(1);
      expect(jobs[0].eventId).toBe('event1');
      expect(jobs[0].attendeeEmail).toBe('member@example.com');
      expect(jobs[0].status).toBe('PENDING');
    });

    it('タイトルに"1on1"を含まない2人のイベントは除外されること（デフォルト動作）', async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event1',
          summary: '定例ミーティング',
          start: '2025-01-15T10:00:00Z',
          end: '2025-01-15T11:00:00Z',
          durationMinutes: 60,
          attendees: [
            { email: 'manager@example.com', displayName: 'マネージャー', responseStatus: 'accepted' },
            { email: 'member@example.com', displayName: 'テストメンバー', responseStatus: 'accepted' },
          ],
          status: 'confirmed',
          eventType: 'meeting',
        },
      ];

      vi.mocked(mockCalendarClient.getEventsInPeriod).mockResolvedValue(mockEvents);

      const jobs = await scheduler.scheduleJobs('manager@example.com');

      // デフォルト（matchAll2PersonMeetings=false）では、タイトルに"1on1"を含まないため除外される
      expect(jobs).toHaveLength(0);
    });

    it('参加者が2人のイベントからJobを作成できること（matchAll2PersonMeetings=trueの場合）', async () => {
      // matchAll2PersonMeetings: true を明示的に設定したSchedulerを作成
      const schedulerWithAllMeetings = new Scheduler(
        mockCalendarClient,
        jobRepository,
        {
          lookaheadHours: 48,
          internalDomain: 'example.com',
          matchAll2PersonMeetings: true,
        }
      );

      const mockEvents: CalendarEvent[] = [
        {
          id: 'event1',
          summary: '定例ミーティング',
          start: '2025-01-15T10:00:00Z',
          end: '2025-01-15T11:00:00Z',
          durationMinutes: 60,
          attendees: [
            { email: 'manager@example.com', displayName: 'マネージャー', responseStatus: 'accepted' },
            { email: 'member@example.com', displayName: 'テストメンバー', responseStatus: 'accepted' },
          ],
          status: 'confirmed',
          eventType: 'meeting',
        },
      ];

      vi.mocked(mockCalendarClient.getEventsInPeriod).mockResolvedValue(mockEvents);

      const jobs = await schedulerWithAllMeetings.scheduleJobs('manager@example.com');

      expect(jobs).toHaveLength(1);
      expect(jobs[0].eventId).toBe('event1');
      expect(jobs[0].attendeeEmail).toBe('member@example.com');
    });

    it('外部ドメインの参加者を含むイベントを除外すること', async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event1',
          summary: '1on1: 外部パートナー',
          start: '2025-01-15T10:00:00Z',
          end: '2025-01-15T11:00:00Z',
          durationMinutes: 60,
          attendees: [
            { email: 'manager@example.com', displayName: 'マネージャー', responseStatus: 'accepted' },
            { email: 'partner@external.com', displayName: '外部パートナー', responseStatus: 'accepted' },
          ],
          status: 'confirmed',
          eventType: 'one-on-one',
        },
      ];

      vi.mocked(mockCalendarClient.getEventsInPeriod).mockResolvedValue(mockEvents);

      const jobs = await scheduler.scheduleJobs('manager@example.com');

      expect(jobs).toHaveLength(0);
    });

    it('参加者が3人以上のイベントを除外すること', async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event1',
          summary: '1on1: 複数メンバー',
          start: '2025-01-15T10:00:00Z',
          end: '2025-01-15T11:00:00Z',
          durationMinutes: 60,
          attendees: [
            { email: 'manager@example.com', displayName: 'マネージャー', responseStatus: 'accepted' },
            { email: 'member1@example.com', displayName: 'メンバー1', responseStatus: 'accepted' },
            { email: 'member2@example.com', displayName: 'メンバー2', responseStatus: 'accepted' },
          ],
          status: 'confirmed',
          eventType: 'meeting',
        },
      ];

      vi.mocked(mockCalendarClient.getEventsInPeriod).mockResolvedValue(mockEvents);

      const jobs = await scheduler.scheduleJobs('manager@example.com');

      expect(jobs).toHaveLength(0);
    });

    it('同じイベントで複数回呼び出しても冪等であること', async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event1',
          summary: '1on1: テストメンバー',
          start: '2025-01-15T10:00:00Z',
          end: '2025-01-15T11:00:00Z',
          durationMinutes: 60,
          attendees: [
            { email: 'manager@example.com', displayName: 'マネージャー', responseStatus: 'accepted' },
            { email: 'member@example.com', displayName: 'テストメンバー', responseStatus: 'accepted' },
          ],
          status: 'confirmed',
          eventType: 'one-on-one',
        },
      ];

      vi.mocked(mockCalendarClient.getEventsInPeriod).mockResolvedValue(mockEvents);

      // 1回目
      const jobs1 = await scheduler.scheduleJobs('manager@example.com');
      expect(jobs1).toHaveLength(1);
      const firstJobId = jobs1[0].id;

      // 2回目（同じイベント）
      const jobs2 = await scheduler.scheduleJobs('manager@example.com');
      expect(jobs2).toHaveLength(1);
      expect(jobs2[0].id).toBe(firstJobId); // 同じJobが返される
    });
  });
});
