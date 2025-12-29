import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { DatabaseConnection } from '../../../src/ambient/storage/database.js';
import { JobRepository } from '../../../src/ambient/storage/job-repository.js';
import { TaskRepository } from '../../../src/ambient/storage/task-repository.js';
import { FactRepository } from '../../../src/ambient/storage/fact-repository.js';
import { SlackCollector } from '../../../src/ambient/workers/slack-collector.js';
import type { SlackClient } from '../../../src/slack/client.js';
import type { SlackMessage } from '../../../src/model/slack.js';
import type { WorkerContext } from '../../../src/ambient/workers/types.js';

describe('SlackCollector', () => {
  let db: DatabaseConnection;
  let jobRepository: JobRepository;
  let taskRepository: TaskRepository;
  let factRepository: FactRepository;
  let slackCollector: SlackCollector;
  let mockSlackClient: SlackClient;
  let dbPath: string;

  beforeEach(async () => {
    // テスト用の一時DBファイルを作成
    dbPath = join(tmpdir(), `test-ambient-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    db = new DatabaseConnection(dbPath);
    await db.connect();
    jobRepository = new JobRepository(db);
    taskRepository = new TaskRepository(db);
    factRepository = new FactRepository(db);

    // SlackClientのモック
    mockSlackClient = {
      isAvailable: vi.fn().mockReturnValue(true),
      connect: vi.fn(),
      disconnect: vi.fn(),
      findUserByEmail: vi.fn(),
      getMessagesInPeriod: vi.fn(),
    } as any;

    slackCollector = new SlackCollector(mockSlackClient, factRepository);
  });

  afterEach(async () => {
    // DB接続を切断してファイル削除
    await db.disconnect();
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  });

  describe('getName', () => {
    it('Worker名を返すこと', () => {
      expect(slackCollector.getName()).toBe('SlackCollector');
    });
  });

  describe('getSource', () => {
    it('ソースを返すこと', () => {
      expect(slackCollector.getSource()).toBe('slack');
    });
  });

  describe('collect', () => {
    it('メッセージを収集してFactsを生成できること', async () => {
      // テスト用のJobとTaskを作成
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'member@example.com',
        attendeeName: 'Test Member',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      const task = await taskRepository.create({
        jobId: job.id,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      const context: WorkerContext = {
        job,
        task,
        periodStart: '2025-01-01T00:00:00Z',
        periodEnd: '2025-01-15T00:00:00Z',
      };

      // モックメッセージ
      const mockMessages: SlackMessage[] = [
        {
          ts: '1704672000.000000',
          text: 'テストメッセージ1',
          user: 'U123',
          userName: 'Test Member',
          channel: 'C456',
          channelName: 'general',
          permalink: 'https://slack.com/archives/C456/p1704672000000000',
          timestamp: new Date('2025-01-08T00:00:00Z'),
          threadTs: undefined,
        },
        {
          ts: '1704758400.000000',
          text: 'テストメッセージ2',
          user: 'U123',
          userName: 'Test Member',
          channel: 'C456',
          channelName: 'general',
          permalink: 'https://slack.com/archives/C456/p1704758400000000',
          timestamp: new Date('2025-01-09T00:00:00Z'),
          threadTs: undefined,
        },
      ];

      vi.mocked(mockSlackClient.findUserByEmail).mockResolvedValue({
        id: 'U123',
        name: 'test.member',
        realName: 'Test Member',
        email: 'member@example.com',
      });

      vi.mocked(mockSlackClient.getMessagesInPeriod).mockResolvedValue(mockMessages);

      // 実行
      const result = await slackCollector.collect(context);

      // 検証
      expect(result.count).toBe(2);
      expect(result.facts).toHaveLength(2);
      expect(result.error).toBeUndefined();

      // Fact内容の検証
      const fact1 = result.facts[0];
      expect(fact1.jobId).toBe(job.id);
      expect(fact1.source).toBe('slack');
      expect(fact1.summary).toContain('テストメッセージ1');
      expect(fact1.url).toBe('https://slack.com/archives/C456/p1704672000000000');
      expect(fact1.confidence).toBe(1.0);

      // FactRepositoryに保存されていることを確認
      const savedFacts = await factRepository.findByJobId(job.id);
      expect(savedFacts).toHaveLength(2);
    });

    it('Slackユーザーが見つからない場合はエラーを返すこと', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'notfound@example.com',
        attendeeName: 'Not Found',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      const task = await taskRepository.create({
        jobId: job.id,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      const context: WorkerContext = {
        job,
        task,
        periodStart: '2025-01-01T00:00:00Z',
        periodEnd: '2025-01-15T00:00:00Z',
      };

      vi.mocked(mockSlackClient.findUserByEmail).mockResolvedValue(null);

      const result = await slackCollector.collect(context);

      expect(result.count).toBe(0);
      expect(result.facts).toHaveLength(0);
      expect(result.error).toContain('Slackユーザーが見つかりません');
    });

    it('メッセージが0件の場合は空のFactsを返すこと', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'member@example.com',
        attendeeName: 'Test Member',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      const task = await taskRepository.create({
        jobId: job.id,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      const context: WorkerContext = {
        job,
        task,
        periodStart: '2025-01-01T00:00:00Z',
        periodEnd: '2025-01-15T00:00:00Z',
      };

      vi.mocked(mockSlackClient.findUserByEmail).mockResolvedValue({
        id: 'U123',
        name: 'test.member',
        realName: 'Test Member',
        email: 'member@example.com',
      });

      vi.mocked(mockSlackClient.getMessagesInPeriod).mockResolvedValue([]);

      const result = await slackCollector.collect(context);

      expect(result.count).toBe(0);
      expect(result.facts).toHaveLength(0);
      expect(result.error).toBeUndefined();
    });

    it('SlackClient呼び出しでエラーが発生した場合はエラーを返すこと', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'member@example.com',
        attendeeName: 'Test Member',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      const task = await taskRepository.create({
        jobId: job.id,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      const context: WorkerContext = {
        job,
        task,
        periodStart: '2025-01-01T00:00:00Z',
        periodEnd: '2025-01-15T00:00:00Z',
      };

      vi.mocked(mockSlackClient.findUserByEmail).mockRejectedValue(
        new Error('Slack API Error')
      );

      const result = await slackCollector.collect(context);

      expect(result.count).toBe(0);
      expect(result.facts).toHaveLength(0);
      expect(result.error).toContain('Slack API Error');
    });
  });
});
