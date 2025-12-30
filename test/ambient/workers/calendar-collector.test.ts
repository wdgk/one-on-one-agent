import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarCollector } from '../../../src/ambient/workers/calendar-collector.js';
import type { CalendarClient } from '../../../src/calendar/client.js';
import type { FactRepository } from '../../../src/ambient/storage/fact-repository.js';
import type { WorkerContext } from '../../../src/ambient/workers/types.js';
import type { Job, Task } from '../../../src/ambient/storage/types.js';
import type { CalendarEvent, MeetingStats } from '../../../src/model/calendar.js';

describe('CalendarCollector', () => {
  let calendarClient: CalendarClient;
  let factRepository: FactRepository;
  let collector: CalendarCollector;

  const mockJob: Job = {
    id: 'job-1',
    eventId: 'event-1',
    attendeeEmail: 'sato@example.com',
    attendeeName: '佐藤太郎',
    startAt: '2025-01-15T10:00:00Z',
    endAt: '2025-01-15T11:00:00Z',
    status: 'COLLECTING',
    revision: 1,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    idempotencyKey: 'job-1-key',
    errorMessage: null,
    metadata: null,
  };

  const mockTask: Task = {
    id: 'task-1',
    jobId: 'job-1',
    source: 'calendar',
    status: 'RUNNING',
    priority: 1,
    retryCount: 0,
    maxRetries: 3,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    startedAt: '2025-01-01T00:00:01Z',
    completedAt: null,
    errorMessage: null,
    idempotencyKey: 'task-1-key',
  };

  const mockContext: WorkerContext = {
    job: mockJob,
    task: mockTask,
    periodStart: '2025-01-01T00:00:00Z',
    periodEnd: '2025-01-14T23:59:59Z',
  };

  beforeEach(() => {
    // CalendarClient のモック
    calendarClient = {
      isAvailable: vi.fn(),
      getEventsInPeriod: vi.fn(),
      getMeetingStats: vi.fn(),
    } as any;

    // FactRepository のモック
    factRepository = {
      create: vi.fn(),
      findByUrl: vi.fn(),
    } as any;

    collector = new CalendarCollector(calendarClient, factRepository);
  });

  describe('getName', () => {
    it('Worker名を返す', () => {
      expect(collector.getName()).toBe('CalendarCollector');
    });
  });

  describe('getSource', () => {
    it('ソース種別を返す', () => {
      expect(collector.getSource()).toBe('calendar');
    });
  });

  describe('collect', () => {
    it('Calendarからイベントと統計を取得してFactsを生成する', async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event-1',
          summary: '1on1 with Manager',
          start: '2025-01-07T14:00:00Z',
          end: '2025-01-07T15:00:00Z',
          durationMinutes: 60,
          status: 'confirmed',
          eventType: 'one-on-one',
          htmlLink: 'https://calendar.google.com/event?eid=abc123',
        },
        {
          id: 'event-2',
          summary: 'Team Meeting',
          start: '2025-01-08T10:00:00Z',
          end: '2025-01-08T11:00:00Z',
          durationMinutes: 60,
          status: 'confirmed',
          eventType: 'meeting',
          htmlLink: 'https://calendar.google.com/event?eid=def456',
        },
      ];

      const mockStats: MeetingStats = {
        totalEvents: 10,
        totalMeetingMinutes: 300,
        meetingCount: 5,
        oneOnOneCount: 2,
        focusTimeMinutes: 120,
        averageMeetingDuration: 60,
        busiestDay: '2025-01-07',
      };

      vi.mocked(calendarClient.isAvailable).mockReturnValue(true);
      vi.mocked(calendarClient.getEventsInPeriod).mockResolvedValue(mockEvents);
      vi.mocked(calendarClient.getMeetingStats).mockResolvedValue(mockStats);
      vi.mocked(factRepository.findByUrl).mockResolvedValue(null);
      vi.mocked(factRepository.create).mockImplementation(async (data: any) => ({
        ...data,
        id: `fact-${Date.now()}`,
        createdAt: new Date().toISOString(),
      }));

      const result = await collector.collect(mockContext);

      expect(result.error).toBeUndefined();
      expect(result.count).toBe(3); // 2 events + 1 stats
      expect(result.facts).toHaveLength(3);

      // getEventsInPeriod が呼ばれたことを確認
      expect(calendarClient.getEventsInPeriod).toHaveBeenCalledWith(
        'sato@example.com',
        new Date('2025-01-01T00:00:00Z'),
        new Date('2025-01-14T23:59:59Z')
      );

      // getMeetingStats が呼ばれたことを確認
      expect(calendarClient.getMeetingStats).toHaveBeenCalledWith(mockEvents);

      // Fact作成を確認
      expect(factRepository.create).toHaveBeenCalledTimes(3);

      // Event Facts
      expect(factRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          source: 'calendar',
          summary: expect.stringContaining('1on1 with Manager'),
          url: 'https://calendar.google.com/event?eid=abc123',
          rawRef: expect.stringContaining('"id":"event-1"'),
        })
      );

      // Stats Fact
      expect(factRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          source: 'calendar',
          summary: 'Meeting Statistics',
          url: 'calendar://stats',
          rawRef: expect.stringContaining('"_type":"stats"'),
        })
      );
    });

    it('CalendarClientが利用不可の場合は空の結果を返す', async () => {
      vi.mocked(calendarClient.isAvailable).mockReturnValue(false);

      const result = await collector.collect(mockContext);

      expect(result.error).toBeUndefined();
      expect(result.count).toBe(0);
      expect(result.facts).toHaveLength(0);
      expect(calendarClient.getEventsInPeriod).not.toHaveBeenCalled();
    });

    it('イベントが0件の場合は統計Factのみ作成する', async () => {
      const mockStats: MeetingStats = {
        totalEvents: 0,
        totalMeetingMinutes: 0,
        meetingCount: 0,
        oneOnOneCount: 0,
        focusTimeMinutes: 0,
        averageMeetingDuration: 0,
      };

      vi.mocked(calendarClient.isAvailable).mockReturnValue(true);
      vi.mocked(calendarClient.getEventsInPeriod).mockResolvedValue([]);
      vi.mocked(calendarClient.getMeetingStats).mockResolvedValue(mockStats);
      vi.mocked(factRepository.findByUrl).mockResolvedValue(null);
      vi.mocked(factRepository.create).mockImplementation(async (data: any) => ({
        ...data,
        id: `fact-${Date.now()}`,
        createdAt: new Date().toISOString(),
      }));

      const result = await collector.collect(mockContext);

      expect(result.error).toBeUndefined();
      expect(result.count).toBe(1); // stats only
      expect(result.facts).toHaveLength(1);
      expect(factRepository.create).toHaveBeenCalledTimes(1);
    });

    it('既に存在するFactは重複作成しない（冪等性）', async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event-1',
          summary: '1on1 with Manager',
          start: '2025-01-07T14:00:00Z',
          end: '2025-01-07T15:00:00Z',
          durationMinutes: 60,
          status: 'confirmed',
          eventType: 'one-on-one',
          htmlLink: 'https://calendar.google.com/event?eid=abc123',
        },
      ];

      const mockStats: MeetingStats = {
        totalEvents: 1,
        totalMeetingMinutes: 60,
        meetingCount: 1,
        oneOnOneCount: 1,
        focusTimeMinutes: 0,
        averageMeetingDuration: 60,
      };

      vi.mocked(calendarClient.isAvailable).mockReturnValue(true);
      vi.mocked(calendarClient.getEventsInPeriod).mockResolvedValue(mockEvents);
      vi.mocked(calendarClient.getMeetingStats).mockResolvedValue(mockStats);
      // 既にFactが存在する
      vi.mocked(factRepository.findByUrl).mockResolvedValue({
        id: 'existing-fact',
        jobId: 'job-1',
        source: 'calendar',
        occurredAt: '2025-01-07T14:00:00Z',
        summary: 'Existing event',
        url: 'https://calendar.google.com/event?eid=abc123',
        confidence: 1.0,
        score: 1.0,
        rawRef: '{}',
        createdAt: '2025-01-07T14:00:00Z',
      });

      const result = await collector.collect(mockContext);

      expect(result.error).toBeUndefined();
      expect(result.count).toBe(0); // 全て重複のためスキップ
      expect(result.facts).toHaveLength(0);
      expect(factRepository.create).not.toHaveBeenCalled();
    });

    it('エラー発生時はerrorフィールドに設定する', async () => {
      vi.mocked(calendarClient.isAvailable).mockReturnValue(true);
      vi.mocked(calendarClient.getEventsInPeriod).mockRejectedValue(new Error('API Error'));

      const result = await collector.collect(mockContext);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('API Error');
      expect(result.count).toBe(0);
      expect(result.facts).toHaveLength(0);
    });
  });
});
