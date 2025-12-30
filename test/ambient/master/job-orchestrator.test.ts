import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { DatabaseConnection } from '../../../src/ambient/storage/database.js';
import { JobRepository } from '../../../src/ambient/storage/job-repository.js';
import { TaskRepository } from '../../../src/ambient/storage/task-repository.js';
import { FactRepository } from '../../../src/ambient/storage/fact-repository.js';
import { JobOrchestrator } from '../../../src/ambient/master/job-orchestrator.js';
import { TaskQueue } from '../../../src/ambient/master/task-queue.js';
import type { Worker } from '../../../src/ambient/workers/types.js';

describe('JobOrchestrator', () => {
  let db: DatabaseConnection;
  let jobRepository: JobRepository;
  let taskRepository: TaskRepository;
  let factRepository: FactRepository;
  let taskQueue: TaskQueue;
  let jobOrchestrator: JobOrchestrator;
  let dbPath: string;

  beforeEach(async () => {
    // テスト用の一時DBファイルを作成
    dbPath = join(tmpdir(), `test-ambient-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    db = new DatabaseConnection(dbPath);
    await db.connect();
    jobRepository = new JobRepository(db);
    taskRepository = new TaskRepository(db);
    factRepository = new FactRepository(db);
    taskQueue = new TaskQueue(taskRepository);
    jobOrchestrator = new JobOrchestrator(
      jobRepository,
      taskRepository,
      taskQueue
    );
  });

  afterEach(async () => {
    // DB接続を切断してファイル削除
    await db.disconnect();
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  });

  describe('collectFacts', () => {
    it('Jobに対してTasksを作成して実行できること', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
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

      await jobOrchestrator.collectFacts(job.id, ['slack']);

      // JobステータスがCOLLECTINGになっていることを確認
      const updatedJob = await jobRepository.findById(job.id);
      expect(updatedJob?.status).toBe('COLLECTING');

      // Taskが作成されていることを確認
      const tasks = await taskRepository.findByJobId(job.id);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].source).toBe('slack');
      expect(tasks[0].status).toBe('DONE');
    });

    it('複数のWorkerに対してTasksを並列実行できること', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
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

      await jobOrchestrator.collectFacts(job.id, ['slack', 'backlog']);

      // 両方のTaskが実行されていることを確認
      const tasks = await taskRepository.findByJobId(job.id);
      expect(tasks).toHaveLength(2);
      expect(tasks.every(t => t.status === 'DONE')).toBe(true);
    });

    it('一部のTaskが失敗してもJobステータスがCOLLECTINGのままであること', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      const successWorker: Worker = {
        getName: () => 'SuccessWorker',
        getSource: () => 'slack',
        collect: vi.fn().mockResolvedValue({
          facts: [],
          count: 0,
        }),
      };

      const failWorker: Worker = {
        getName: () => 'FailWorker',
        getSource: () => 'backlog',
        collect: vi.fn().mockResolvedValue({
          facts: [],
          count: 0,
          error: 'Test error',
        }),
      };

      taskQueue.registerWorker(successWorker);
      taskQueue.registerWorker(failWorker);

      await jobOrchestrator.collectFacts(job.id, ['slack', 'backlog']);

      // Jobステータスが更新されていることを確認
      const updatedJob = await jobRepository.findById(job.id);
      expect(updatedJob?.status).toBe('COLLECTING');

      // 成功したTaskと失敗したTaskが存在することを確認
      const tasks = await taskRepository.findByJobId(job.id);
      expect(tasks).toHaveLength(2);
      expect(tasks.find(t => t.source === 'slack')?.status).toBe('DONE');
      expect(tasks.find(t => t.source === 'backlog')?.status).toBe('FAILED');
    });

    it('同じJobに対して複数回呼び出しても冪等であること', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
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

      // 1回目
      await jobOrchestrator.collectFacts(job.id, ['slack']);

      // 2回目
      await jobOrchestrator.collectFacts(job.id, ['slack']);

      // Taskが重複作成されていないことを確認
      const tasks = await taskRepository.findByJobId(job.id);
      expect(tasks).toHaveLength(1);
    });

    it('Jobが見つからない場合はエラーになること', async () => {
      await expect(
        jobOrchestrator.collectFacts('non-existent-id', ['slack'])
      ).rejects.toThrow('Job not found');
    });
  });
});
