import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { DatabaseConnection } from '../../../src/ambient/storage/database.js';
import { JobRepository } from '../../../src/ambient/storage/job-repository.js';
import type { Job } from '../../../src/ambient/storage/types.js';

describe('JobRepository', () => {
  let db: DatabaseConnection;
  let repository: JobRepository;
  let dbPath: string;

  beforeEach(async () => {
    // テスト用の一時DBファイルを作成
    dbPath = join(tmpdir(), `test-ambient-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);
    db = new DatabaseConnection(dbPath);
    await db.connect();
    repository = new JobRepository(db);
  });

  afterEach(async () => {
    // DB接続を切断してファイル削除
    await db.disconnect();
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  });

  describe('upsert', () => {
    it('新しいJobを作成できること', async () => {
      const jobData = {
        eventId: 'event123',
        attendeeEmail: 'member@example.com',
        attendeeName: 'テストメンバー',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      };

      const job = await repository.upsert(jobData);

      expect(job.id).toBeDefined();
      expect(job.eventId).toBe(jobData.eventId);
      expect(job.attendeeEmail).toBe(jobData.attendeeEmail);
      expect(job.attendeeName).toBe(jobData.attendeeName);
      expect(job.status).toBe('PENDING');
      expect(job.revision).toBe(1);
      expect(job.idempotencyKey).toBe(
        `${jobData.eventId}|${jobData.attendeeEmail}|${jobData.startAt}`
      );
    });

    it('同じidempotency_keyで複数回upsertしても冪等であること', async () => {
      const jobData = {
        eventId: 'event123',
        attendeeEmail: 'member@example.com',
        attendeeName: 'テストメンバー',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      };

      // 1回目のupsert
      const job1 = await repository.upsert(jobData);
      const firstId = job1.id;
      const firstCreatedAt = job1.createdAt;

      // タイムスタンプの差を確実にするため小さな遅延
      await new Promise(resolve => setTimeout(resolve, 10));

      // 2回目のupsert（同じidempotency_key）
      const job2 = await repository.upsert(jobData);

      // 同じJobが返されること
      expect(job2.id).toBe(firstId);
      expect(job2.createdAt).toBe(firstCreatedAt);
      expect(job2.updatedAt).not.toBe(firstCreatedAt); // updatedAtは更新される
    });

    it('異なるidempotency_keyの場合は別のJobが作成されること', async () => {
      const jobData1 = {
        eventId: 'event123',
        attendeeEmail: 'member1@example.com',
        attendeeName: 'メンバー1',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      };

      const jobData2 = {
        ...jobData1,
        attendeeEmail: 'member2@example.com', // 異なるメールアドレス
        attendeeName: 'メンバー2',
      };

      const job1 = await repository.upsert(jobData1);
      const job2 = await repository.upsert(jobData2);

      // 異なるJobが作成されること
      expect(job1.id).not.toBe(job2.id);
      expect(job1.idempotencyKey).not.toBe(job2.idempotencyKey);
    });
  });

  describe('findById', () => {
    it('IDでJobを検索できること', async () => {
      const jobData = {
        eventId: 'event123',
        attendeeEmail: 'member@example.com',
        attendeeName: 'テストメンバー',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      };

      const createdJob = await repository.upsert(jobData);
      const foundJob = await repository.findById(createdJob.id);

      expect(foundJob).not.toBeNull();
      expect(foundJob?.id).toBe(createdJob.id);
      expect(foundJob?.eventId).toBe(jobData.eventId);
    });

    it('存在しないIDの場合はnullが返されること', async () => {
      const foundJob = await repository.findById('non-existent-id');
      expect(foundJob).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('Jobのステータスを更新できること', async () => {
      const jobData = {
        eventId: 'event123',
        attendeeEmail: 'member@example.com',
        attendeeName: 'テストメンバー',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      };

      const job = await repository.upsert(jobData);
      expect(job.status).toBe('PENDING');

      // タイムスタンプの差を確実にするため小さな遅延
      await new Promise(resolve => setTimeout(resolve, 10));

      const updatedJob = await repository.updateStatus(job.id, 'COLLECTING');
      expect(updatedJob.status).toBe('COLLECTING');
      expect(updatedJob.updatedAt).not.toBe(job.updatedAt);
    });

    it('エラーメッセージを設定してステータスをFAILEDに更新できること', async () => {
      const jobData = {
        eventId: 'event123',
        attendeeEmail: 'member@example.com',
        attendeeName: 'テストメンバー',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      };

      const job = await repository.upsert(jobData);
      const errorMessage = 'テストエラー';

      const updatedJob = await repository.updateStatus(
        job.id,
        'FAILED',
        errorMessage
      );

      expect(updatedJob.status).toBe('FAILED');
      expect(updatedJob.errorMessage).toBe(errorMessage);
    });
  });

  describe('findByStatus', () => {
    it('特定のステータスのJobを検索できること', async () => {
      // 複数のJobを作成
      await repository.upsert({
        eventId: 'event1',
        attendeeEmail: 'member1@example.com',
        attendeeName: 'メンバー1',
        startAt: '2025-01-15T10:00:00Z',
        endAt: '2025-01-15T11:00:00Z',
      });

      const job2 = await repository.upsert({
        eventId: 'event2',
        attendeeEmail: 'member2@example.com',
        attendeeName: 'メンバー2',
        startAt: '2025-01-16T10:00:00Z',
        endAt: '2025-01-16T11:00:00Z',
      });

      // job2のステータスをCOLLECTINGに変更
      await repository.updateStatus(job2.id, 'COLLECTING');

      // COLLECTINGステータスのJobを検索
      const collectingJobs = await repository.findByStatus('COLLECTING');
      expect(collectingJobs).toHaveLength(1);
      expect(collectingJobs[0].id).toBe(job2.id);
    });
  });
});
