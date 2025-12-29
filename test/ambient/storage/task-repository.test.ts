import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { DatabaseConnection } from '../../../src/ambient/storage/database.js';
import { JobRepository } from '../../../src/ambient/storage/job-repository.js';
import { TaskRepository } from '../../../src/ambient/storage/task-repository.js';
import type { Task } from '../../../src/ambient/storage/types.js';

describe('TaskRepository', () => {
  let db: DatabaseConnection;
  let jobRepository: JobRepository;
  let taskRepository: TaskRepository;
  let dbPath: string;
  let testJobId: string;

  beforeEach(async () => {
    // テスト用の一時DBファイルを作成
    dbPath = join(tmpdir(), `test-ambient-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    db = new DatabaseConnection(dbPath);
    await db.connect();
    jobRepository = new JobRepository(db);
    taskRepository = new TaskRepository(db);

    // テスト用のJobを作成
    const job = await jobRepository.upsert({
      eventId: 'test-event-1',
      attendeeEmail: 'test@example.com',
      attendeeName: 'Test User',
      startAt: '2025-01-15T10:00:00Z',
      endAt: '2025-01-15T11:00:00Z',
    });
    testJobId = job.id;
  });

  afterEach(async () => {
    // DB接続を切断してファイル削除
    await db.disconnect();
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  });

  describe('create', () => {
    it('Taskを作成できること', async () => {
      const task = await taskRepository.create({
        jobId: testJobId,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      expect(task.id).toBeTruthy();
      expect(task.jobId).toBe(testJobId);
      expect(task.source).toBe('slack');
      expect(task.status).toBe('QUEUED');
      expect(task.priority).toBe(0);
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(3);
      expect(task.createdAt).toBeTruthy();
      expect(task.updatedAt).toBeTruthy();
      expect(task.startedAt).toBeNull();
      expect(task.completedAt).toBeNull();
      expect(task.errorMessage).toBeNull();
      expect(task.idempotencyKey).toBe(`${testJobId}|slack`);
    });

    it('同じ冪等キーで複数回createした場合はエラーになること', async () => {
      await taskRepository.create({
        jobId: testJobId,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      await expect(
        taskRepository.create({
          jobId: testJobId,
          source: 'slack',
          status: 'QUEUED',
          priority: 0,
        })
      ).rejects.toThrow();
    });

    it('priorityを指定してTaskを作成できること', async () => {
      const task = await taskRepository.create({
        jobId: testJobId,
        source: 'backlog',
        status: 'QUEUED',
        priority: 10,
      });

      expect(task.priority).toBe(10);
      expect(task.source).toBe('backlog');
    });
  });

  describe('findById', () => {
    it('IDでTaskを検索できること', async () => {
      const created = await taskRepository.create({
        jobId: testJobId,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      const found = await taskRepository.findById(created.id);

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.jobId).toBe(testJobId);
      expect(found?.source).toBe('slack');
    });

    it('存在しないIDの場合はnullを返すこと', async () => {
      const found = await taskRepository.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findByIdempotencyKey', () => {
    it('冪等キーでTaskを検索できること', async () => {
      const created = await taskRepository.create({
        jobId: testJobId,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      const idempotencyKey = `${testJobId}|slack`;
      const found = await taskRepository.findByIdempotencyKey(idempotencyKey);

      expect(found).toBeTruthy();
      expect(found?.id).toBe(created.id);
      expect(found?.idempotencyKey).toBe(idempotencyKey);
    });

    it('存在しない冪等キーの場合はnullを返すこと', async () => {
      const found = await taskRepository.findByIdempotencyKey('non-existent|key');
      expect(found).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('ステータスをQUEUED→RUNNINGに更新できること（started_atが設定される）', async () => {
      const task = await taskRepository.create({
        jobId: testJobId,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      expect(task.startedAt).toBeNull();

      const updated = await taskRepository.updateStatus(task.id, 'RUNNING');

      expect(updated.status).toBe('RUNNING');
      expect(updated.startedAt).toBeTruthy();
      expect(updated.completedAt).toBeNull();
    });

    it('ステータスをRUNNING→DONEに更新できること（completed_atが設定される）', async () => {
      const task = await taskRepository.create({
        jobId: testJobId,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      await taskRepository.updateStatus(task.id, 'RUNNING');
      const done = await taskRepository.updateStatus(task.id, 'DONE');

      expect(done.status).toBe('DONE');
      expect(done.startedAt).toBeTruthy();
      expect(done.completedAt).toBeTruthy();
      expect(done.errorMessage).toBeNull();
    });

    it('ステータスをFAILEDに更新できること（エラーメッセージ付き）', async () => {
      const task = await taskRepository.create({
        jobId: testJobId,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      await taskRepository.updateStatus(task.id, 'RUNNING');
      const failed = await taskRepository.updateStatus(
        task.id,
        'FAILED',
        'Connection timeout'
      );

      expect(failed.status).toBe('FAILED');
      expect(failed.completedAt).toBeTruthy();
      expect(failed.errorMessage).toBe('Connection timeout');
    });
  });

  describe('findByStatus', () => {
    it('ステータスでTaskをフィルタできること', async () => {
      await taskRepository.create({
        jobId: testJobId,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      await taskRepository.create({
        jobId: testJobId,
        source: 'backlog',
        status: 'RUNNING',
        priority: 0,
      });

      const queuedTasks = await taskRepository.findByStatus('QUEUED');
      const runningTasks = await taskRepository.findByStatus('RUNNING');

      expect(queuedTasks).toHaveLength(1);
      expect(queuedTasks[0].source).toBe('slack');
      expect(runningTasks).toHaveLength(1);
      expect(runningTasks[0].source).toBe('backlog');
    });

    it('該当するTaskがない場合は空配列を返すこと', async () => {
      const tasks = await taskRepository.findByStatus('DONE');
      expect(tasks).toHaveLength(0);
    });
  });

  describe('findByJobId', () => {
    it('Job単位でTaskを検索できること', async () => {
      await taskRepository.create({
        jobId: testJobId,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      await taskRepository.create({
        jobId: testJobId,
        source: 'backlog',
        status: 'QUEUED',
        priority: 0,
      });

      const tasks = await taskRepository.findByJobId(testJobId);

      expect(tasks).toHaveLength(2);
      expect(tasks.map(t => t.source).sort()).toEqual(['backlog', 'slack']);
    });

    it('該当するTaskがない場合は空配列を返すこと', async () => {
      const tasks = await taskRepository.findByJobId('non-existent-job');
      expect(tasks).toHaveLength(0);
    });
  });

  describe('incrementRetryCount', () => {
    it('リトライカウントをインクリメントできること', async () => {
      const task = await taskRepository.create({
        jobId: testJobId,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      expect(task.retryCount).toBe(0);

      const retried1 = await taskRepository.incrementRetryCount(task.id);
      expect(retried1.retryCount).toBe(1);

      const retried2 = await taskRepository.incrementRetryCount(task.id);
      expect(retried2.retryCount).toBe(2);
    });

    it('maxRetriesを超えてもインクリメントできること', async () => {
      const task = await taskRepository.create({
        jobId: testJobId,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      // maxRetries=3を超える
      await taskRepository.incrementRetryCount(task.id);
      await taskRepository.incrementRetryCount(task.id);
      await taskRepository.incrementRetryCount(task.id);
      const retried4 = await taskRepository.incrementRetryCount(task.id);

      expect(retried4.retryCount).toBe(4);
      expect(retried4.maxRetries).toBe(3);
    });
  });

  describe('delete', () => {
    it('Taskを削除できること', async () => {
      const task = await taskRepository.create({
        jobId: testJobId,
        source: 'slack',
        status: 'QUEUED',
        priority: 0,
      });

      await taskRepository.delete(task.id);

      const found = await taskRepository.findById(task.id);
      expect(found).toBeNull();
    });
  });
});
