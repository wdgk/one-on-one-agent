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
    taskQueue = new TaskQueue(taskRepository, {
      concurrencyLimit: 5,
      lookbackDays: 14,
    });
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

      // 成功したTaskと失敗したTask（リトライのためQUEUEDに戻る）が存在することを確認
      const tasks = await taskRepository.findByJobId(job.id);
      expect(tasks).toHaveLength(2);
      expect(tasks.find(t => t.source === 'slack')?.status).toBe('DONE');
      // リトライロジックによりQUEUEDに戻る
      expect(tasks.find(t => t.source === 'backlog')?.status).toBe('QUEUED');
      expect(tasks.find(t => t.source === 'backlog')?.retryCount).toBe(1);
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

  describe('generateAgenda', () => {
    it('AgendaServiceを呼び出してArtifact IDをJobに記録できること', async () => {
      // AgendaServiceのモック
      const mockAgendaService = {
        generateAgendaFromFacts: vi.fn().mockResolvedValue('artifact-123'),
      };

      const orchestratorWithAgenda = new JobOrchestrator(
        jobRepository,
        taskRepository,
        taskQueue,
        mockAgendaService as any
      );

      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      await orchestratorWithAgenda.generateAgenda(job.id);

      // AgendaService.generateAgendaFromFacts が呼ばれたことを確認
      expect(mockAgendaService.generateAgendaFromFacts).toHaveBeenCalledWith(
        job.id,
        { id: job.attendeeEmail, name: job.attendeeName },
        expect.objectContaining({
          start: expect.any(String),
          end: expect.any(String),
        })
      );
    });

    it('AgendaServiceが未設定の場合はスキップすること', async () => {
      // AgendaServiceなしのJobOrchestrator
      const orchestratorWithoutAgenda = new JobOrchestrator(
        jobRepository,
        taskRepository,
        taskQueue
      );

      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      // エラーにならずスキップされることを確認
      await expect(orchestratorWithoutAgenda.generateAgenda(job.id)).resolves.toBeUndefined();
    });

    it('Jobが見つからない場合はエラーになること', async () => {
      const mockAgendaService = {
        generateAgendaFromFacts: vi.fn().mockResolvedValue('artifact-123'),
      };

      const orchestratorWithAgenda = new JobOrchestrator(
        jobRepository,
        taskRepository,
        taskQueue,
        mockAgendaService as any
      );

      await expect(
        orchestratorWithAgenda.generateAgenda('non-existent-id')
      ).rejects.toThrow('Job not found');
    });

    it('AgendaService呼び出しエラーはそのままthrowすること', async () => {
      const mockAgendaService = {
        generateAgendaFromFacts: vi.fn().mockRejectedValue(new Error('LLM API error')),
      };

      const orchestratorWithAgenda = new JobOrchestrator(
        jobRepository,
        taskRepository,
        taskQueue,
        mockAgendaService as any
      );

      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      await expect(
        orchestratorWithAgenda.generateAgenda(job.id)
      ).rejects.toThrow('LLM API error');
    });
  });

  describe('deliverAgenda', () => {
    it('最新のArtifactを取得してDeliveryServiceで配信できること', async () => {
      const mockDeliveryService = {
        sendToSlack: vi.fn().mockResolvedValue({
          id: 'delivery-1',
          jobId: 'job-1',
          revision: 1,
          channel: 'slack',
          target: 'U12345',
          status: 'sent',
          externalId: '1234567890.123456',
          sentAt: '2025-12-30T10:00:00Z',
          errorMessage: null,
          createdAt: '2025-12-30T10:00:00Z',
          idempotencyKey: 'job-1|slack|U12345|1',
        }),
      };

      const mockArtifactRepository = {
        findLatestByJobId: vi.fn().mockResolvedValue({
          id: 'artifact-1',
          jobId: 'job-1',
          revision: 1,
          artifactType: 'markdown',
          content: '# 1on1アジェンダ',
          filePath: null,
          sha256: 'abc123',
          createdAt: '2025-12-30T10:00:00Z',
        }),
      };

      const orchestratorWithDelivery = new JobOrchestrator(
        jobRepository,
        taskRepository,
        taskQueue,
        undefined,
        mockDeliveryService as any,
        mockArtifactRepository as any
      );

      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      await orchestratorWithDelivery.deliverAgenda(job.id);

      expect(mockArtifactRepository.findLatestByJobId).toHaveBeenCalledWith(job.id);
      expect(mockDeliveryService.sendToSlack).toHaveBeenCalledWith(job.id, 'artifact-1');

      // Job状態がSENT_PREVIEWに更新されること
      const updatedJob = await jobRepository.findById(job.id);
      expect(updatedJob?.status).toBe('SENT_PREVIEW');
    });

    it('DeliveryServiceがない場合はスキップすること', async () => {
      const orchestratorWithoutDelivery = new JobOrchestrator(
        jobRepository,
        taskRepository,
        taskQueue
      );

      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      // エラーにならずスキップされることを確認
      await expect(orchestratorWithoutDelivery.deliverAgenda(job.id)).resolves.toBeUndefined();
    });

    it('Artifactが存在しない場合はエラーになること', async () => {
      const mockDeliveryService = {
        sendToSlack: vi.fn(),
      };

      const mockArtifactRepository = {
        findLatestByJobId: vi.fn().mockResolvedValue(null),
      };

      const orchestratorWithDelivery = new JobOrchestrator(
        jobRepository,
        taskRepository,
        taskQueue,
        undefined,
        mockDeliveryService as any,
        mockArtifactRepository as any
      );

      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      await expect(
        orchestratorWithDelivery.deliverAgenda(job.id)
      ).rejects.toThrow('No artifact found');
    });

    it('配信エラー時はJob状態をFAILEDにすること', async () => {
      const mockDeliveryService = {
        sendToSlack: vi.fn().mockRejectedValue(new Error('Slack API error')),
      };

      const mockArtifactRepository = {
        findLatestByJobId: vi.fn().mockResolvedValue({
          id: 'artifact-1',
          jobId: 'job-1',
          revision: 1,
          artifactType: 'markdown',
          content: '# 1on1アジェンダ',
          filePath: null,
          sha256: 'abc123',
          createdAt: '2025-12-30T10:00:00Z',
        }),
      };

      const orchestratorWithDelivery = new JobOrchestrator(
        jobRepository,
        taskRepository,
        taskQueue,
        undefined,
        mockDeliveryService as any,
        mockArtifactRepository as any
      );

      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      await expect(
        orchestratorWithDelivery.deliverAgenda(job.id)
      ).rejects.toThrow('Slack API error');

      // Job状態がFAILEDに更新されること
      const updatedJob = await jobRepository.findById(job.id);
      expect(updatedJob?.status).toBe('FAILED');
    });
  });

  describe('approveAgenda', () => {
    it('Jobを承認してAPPROVED状態に更新できること', async () => {
      const job = await jobRepository.upsert({
        eventId: 'test-event-1',
        attendeeEmail: 'test@example.com',
        attendeeName: 'Test User',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      // Job状態をSENT_PREVIEWに更新
      await jobRepository.updateStatus(job.id, 'SENT_PREVIEW');

      await jobOrchestrator.approveAgenda(job.id);

      // Job状態がAPPROVEDに更新されること
      const updatedJob = await jobRepository.findById(job.id);
      expect(updatedJob?.status).toBe('APPROVED');
    });

    it('Jobが見つからない場合はエラーになること', async () => {
      await expect(
        jobOrchestrator.approveAgenda('non-existent-id')
      ).rejects.toThrow('Job not found');
    });
  });
});
