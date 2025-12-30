import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { DatabaseConnection } from '../../../src/ambient/storage/database.js';
import { JobRepository } from '../../../src/ambient/storage/job-repository.js';
import { TaskRepository } from '../../../src/ambient/storage/task-repository.js';
import { FactRepository } from '../../../src/ambient/storage/fact-repository.js';
import { TaskQueue } from '../../../src/ambient/master/task-queue.js';
import type { Worker, WorkerContext } from '../../../src/ambient/workers/types.js';

describe('TaskQueue', () => {
  let db: DatabaseConnection;
  let jobRepository: JobRepository;
  let taskRepository: TaskRepository;
  let factRepository: FactRepository;
  let taskQueue: TaskQueue;
  let dbPath: string;

  beforeEach(async () => {
    // テスト用の一時DBファイルを作成
    dbPath = join(tmpdir(), `test-ambient-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    db = new DatabaseConnection(dbPath);
    await db.connect();
    jobRepository = new JobRepository(db);
    taskRepository = new TaskRepository(db);
    factRepository = new FactRepository(db);
    taskQueue = new TaskQueue(taskRepository, {
      concurrencyLimit: 5,
      lookbackDays: 14,
    });
  });

  afterEach(async () => {
    // DB接続を切断してファイル削除
    await db.disconnect();
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  });

  describe('registerWorker', () => {
    it('Workerを登録できること', () => {
      const mockWorker: Worker = {
        getName: () => 'MockWorker',
        getSource: () => 'slack',
        collect: vi.fn(),
      };

      taskQueue.registerWorker(mockWorker);

      // 登録されていることを確認（内部的にWorkerが使用される）
      expect(taskQueue.getWorkers()).toHaveLength(1);
      expect(taskQueue.getWorkers()[0].getName()).toBe('MockWorker');
    });

    it('複数のWorkerを登録できること', () => {
      const slackWorker: Worker = {
        getName: () => 'SlackWorker',
        getSource: () => 'slack',
        collect: vi.fn(),
      };

      const backlogWorker: Worker = {
        getName: () => 'BacklogWorker',
        getSource: () => 'backlog',
        collect: vi.fn(),
      };

      taskQueue.registerWorker(slackWorker);
      taskQueue.registerWorker(backlogWorker);

      expect(taskQueue.getWorkers()).toHaveLength(2);
    });
  });

  describe('executeTask', () => {
    it('Taskを実行してステータスをDONEに更新できること', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      const task = await taskRepository.create({
        jobId: job.id,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      const mockWorker: Worker = {
        getName: () => 'MockWorker',
        getSource: () => 'slack',
        collect: vi.fn().mockResolvedValue({
          facts: [],
          count: 0,
        }),
      };

      taskQueue.registerWorker(mockWorker);

      await taskQueue.executeTask(task.id, job);

      // ステータスがDONEになっていることを確認
      const updated = await taskRepository.findById(task.id);
      expect(updated?.status).toBe('DONE');
      expect(updated?.startedAt).toBeTruthy();
      expect(updated?.completedAt).toBeTruthy();
    });

    it('Worker実行でエラーが発生した場合はステータスをFAILEDに更新すること', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      const task = await taskRepository.create({
        jobId: job.id,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
        maxRetries: 0, // リトライなし
      });

      const mockWorker: Worker = {
        getName: () => 'MockWorker',
        getSource: () => 'slack',
        collect: vi.fn().mockResolvedValue({
          facts: [],
          count: 0,
          error: 'Test error',
        }),
      };

      taskQueue.registerWorker(mockWorker);

      await taskQueue.executeTask(task.id, job);

      // ステータスがFAILEDになっていることを確認
      const updated = await taskRepository.findById(task.id);
      expect(updated?.status).toBe('FAILED');
      expect(updated?.errorMessage).toContain('Test error');
    });

    it('Workerが見つからない場合はエラーになること', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      const task = await taskRepository.create({
        jobId: job.id,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      await expect(taskQueue.executeTask(task.id, job)).rejects.toThrow('Worker not found');
    });
  });

  describe('executeTasks', () => {
    it('複数のTaskを実行できること', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      const task1 = await taskRepository.create({
        jobId: job.id,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      const task2 = await taskRepository.create({
        jobId: job.id,
        source: 'backlog',
        status: 'QUEUED',
        priority: 0,
      });

      const slackWorker: Worker = {
        getName: () => 'SlackWorker',
        getSource: () => 'slack',
        collect: vi.fn().mockResolvedValue({
          facts: [],
          count: 0,
        }),
      };

      const backlogWorker: Worker = {
        getName: () => 'BacklogWorker',
        getSource: () => 'backlog',
        collect: vi.fn().mockResolvedValue({
          facts: [],
          count: 0,
        }),
      };

      taskQueue.registerWorker(slackWorker);
      taskQueue.registerWorker(backlogWorker);

      await taskQueue.executeTasks([task1.id, task2.id], job);

      // 両方のタスクがDONEになっていることを確認
      const updated1 = await taskRepository.findById(task1.id);
      const updated2 = await taskRepository.findById(task2.id);
      expect(updated1?.status).toBe('DONE');
      expect(updated2?.status).toBe('DONE');
    });

    it('一部のTaskが失敗しても他は実行を継続すること', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      const task1 = await taskRepository.create({
        jobId: job.id,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      const task2 = await taskRepository.create({
        jobId: job.id,
        source: 'backlog',
        status: 'QUEUED',
        priority: 0,
        maxRetries: 0, // リトライなし
      });

      const slackWorker: Worker = {
        getName: () => 'SlackWorker',
        getSource: () => 'slack',
        collect: vi.fn().mockResolvedValue({
          facts: [],
          count: 0,
        }),
      };

      const backlogWorker: Worker = {
        getName: () => 'BacklogWorker',
        getSource: () => 'backlog',
        collect: vi.fn().mockResolvedValue({
          facts: [],
          count: 0,
          error: 'Test error',
        }),
      };

      taskQueue.registerWorker(slackWorker);
      taskQueue.registerWorker(backlogWorker);

      const result = await taskQueue.executeTasks([task1.id, task2.id], job);

      // 両方とも正常にexecuteTaskを完了するが、一方はFAILEDステータスになる
      // result.errorがある場合はthrowしないので、succeededとしてカウントされる
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);

      // ステータスが正しく更新されていること
      const updated1 = await taskRepository.findById(task1.id);
      const updated2 = await taskRepository.findById(task2.id);
      expect(updated1?.status).toBe('DONE');
      expect(updated2?.status).toBe('FAILED');
    });
  });

  describe('executeTask with retry', () => {
    it('maxRetries未満の場合はTaskをQUEUEDに戻すこと', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      const task = await taskRepository.create({
        jobId: job.id,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
        maxRetries: 3,
      });

      const mockWorker: Worker = {
        getName: () => 'MockWorker',
        getSource: () => 'slack',
        collect: vi.fn().mockResolvedValue({
          facts: [],
          count: 0,
          error: 'Temporary error',
        }),
      };

      taskQueue.registerWorker(mockWorker);

      await taskQueue.executeTask(task.id, job);

      // retryCount < maxRetriesなのでQUEUEDに戻る
      const updated = await taskRepository.findById(task.id);
      expect(updated?.status).toBe('QUEUED');
      expect(updated?.retryCount).toBe(1);
    });

    it('maxRetries以上の場合はFAILEDのままにすること', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      const task = await taskRepository.create({
        jobId: job.id,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
        maxRetries: 2,
      });

      // retryCountを2に設定（maxRetriesと同じ）
      await taskRepository.incrementRetryCount(task.id);
      await taskRepository.incrementRetryCount(task.id);

      const mockWorker: Worker = {
        getName: () => 'MockWorker',
        getSource: () => 'slack',
        collect: vi.fn().mockResolvedValue({
          facts: [],
          count: 0,
          error: 'Permanent error',
        }),
      };

      taskQueue.registerWorker(mockWorker);

      await taskQueue.executeTask(task.id, job);

      // retryCount >= maxRetriesなのでFAILED
      const updated = await taskRepository.findById(task.id);
      expect(updated?.status).toBe('FAILED');
      expect(updated?.retryCount).toBe(2);
    });
  });
});
