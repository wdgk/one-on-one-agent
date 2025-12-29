import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { DatabaseConnection } from '../../../src/ambient/storage/database.js';
import { JobRepository } from '../../../src/ambient/storage/job-repository.js';
import { DeliveryRepository } from '../../../src/ambient/storage/delivery-repository.js';
import type { Delivery } from '../../../src/ambient/storage/types.js';

describe('DeliveryRepository', () => {
  let db: DatabaseConnection;
  let jobRepository: JobRepository;
  let deliveryRepository: DeliveryRepository;
  let dbPath: string;
  let testJobId: string;

  beforeEach(async () => {
    // テスト用の一時DBファイルを作成
    dbPath = join(tmpdir(), `test-ambient-${Date.now()}.db`);
    db = new DatabaseConnection(dbPath);
    await db.connect();
    jobRepository = new JobRepository(db);
    deliveryRepository = new DeliveryRepository(db);

    // テスト用のJobを作成
    const job = await jobRepository.upsert({
      eventId: 'event123',
      attendeeEmail: 'member@example.com',
      attendeeName: 'テストメンバー',
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
    it('新しいDeliveryを作成できること', async () => {
      const deliveryData = {
        jobId: testJobId,
        revision: 1,
        channel: 'slack' as const,
        target: 'manager@example.com',
        status: 'pending' as const,
      };

      const delivery = await deliveryRepository.create(deliveryData);

      expect(delivery.id).toBeDefined();
      expect(delivery.jobId).toBe(testJobId);
      expect(delivery.channel).toBe('slack');
      expect(delivery.target).toBe('manager@example.com');
      expect(delivery.status).toBe('pending');
      expect(delivery.idempotencyKey).toBe(
        `${testJobId}|slack|manager@example.com|1`
      );
    });

    it('同じidempotency_keyで複数回createした場合はエラーになること', async () => {
      const deliveryData = {
        jobId: testJobId,
        revision: 1,
        channel: 'slack' as const,
        target: 'manager@example.com',
        status: 'pending' as const,
      };

      // 1回目は成功
      await deliveryRepository.create(deliveryData);

      // 2回目は冪等キー違反でエラー
      await expect(deliveryRepository.create(deliveryData)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('IDでDeliveryを検索できること', async () => {
      const deliveryData = {
        jobId: testJobId,
        revision: 1,
        channel: 'slack' as const,
        target: 'manager@example.com',
        status: 'pending' as const,
      };

      const createdDelivery = await deliveryRepository.create(deliveryData);
      const foundDelivery = await deliveryRepository.findById(createdDelivery.id);

      expect(foundDelivery).not.toBeNull();
      expect(foundDelivery?.id).toBe(createdDelivery.id);
      expect(foundDelivery?.channel).toBe('slack');
    });

    it('存在しないIDの場合はnullが返されること', async () => {
      const foundDelivery = await deliveryRepository.findById('non-existent-id');
      expect(foundDelivery).toBeNull();
    });
  });

  describe('findByIdempotencyKey', () => {
    it('冪等キーでDeliveryを検索できること', async () => {
      const deliveryData = {
        jobId: testJobId,
        revision: 1,
        channel: 'slack' as const,
        target: 'manager@example.com',
        status: 'pending' as const,
      };

      const createdDelivery = await deliveryRepository.create(deliveryData);
      const idempotencyKey = `${testJobId}|slack|manager@example.com|1`;
      const foundDelivery = await deliveryRepository.findByIdempotencyKey(idempotencyKey);

      expect(foundDelivery).not.toBeNull();
      expect(foundDelivery?.id).toBe(createdDelivery.id);
      expect(foundDelivery?.idempotencyKey).toBe(idempotencyKey);
    });

    it('存在しない冪等キーの場合はnullが返されること', async () => {
      const foundDelivery = await deliveryRepository.findByIdempotencyKey('non-existent-key');
      expect(foundDelivery).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('Deliveryのステータスをsentに更新できること', async () => {
      const deliveryData = {
        jobId: testJobId,
        revision: 1,
        channel: 'slack' as const,
        target: 'manager@example.com',
        status: 'pending' as const,
      };

      const delivery = await deliveryRepository.create(deliveryData);
      expect(delivery.status).toBe('pending');
      expect(delivery.sentAt).toBeNull();

      // タイムスタンプの差を確実にするため小さな遅延
      await new Promise(resolve => setTimeout(resolve, 10));

      const updatedDelivery = await deliveryRepository.updateStatus(
        delivery.id,
        'sent',
        'ts_123456'
      );

      expect(updatedDelivery.status).toBe('sent');
      expect(updatedDelivery.externalId).toBe('ts_123456');
      expect(updatedDelivery.sentAt).not.toBeNull();
    });

    it('Deliveryのステータスをfailedに更新できること', async () => {
      const deliveryData = {
        jobId: testJobId,
        revision: 1,
        channel: 'slack' as const,
        target: 'manager@example.com',
        status: 'pending' as const,
      };

      const delivery = await deliveryRepository.create(deliveryData);
      const errorMessage = 'Slack API error';

      const updatedDelivery = await deliveryRepository.updateStatus(
        delivery.id,
        'failed',
        undefined,
        errorMessage
      );

      expect(updatedDelivery.status).toBe('failed');
      expect(updatedDelivery.errorMessage).toBe(errorMessage);
    });
  });

  describe('findByJobId', () => {
    it('JobIDに紐づくDeliveryを検索できること', async () => {
      // 複数のDeliveryを作成
      await deliveryRepository.create({
        jobId: testJobId,
        revision: 1,
        channel: 'slack' as const,
        target: 'manager@example.com',
        status: 'pending' as const,
      });

      await deliveryRepository.create({
        jobId: testJobId,
        revision: 1,
        channel: 'slack' as const,
        target: 'member@example.com',
        status: 'sent' as const,
      });

      const deliveries = await deliveryRepository.findByJobId(testJobId);

      expect(deliveries).toHaveLength(2);
      expect(deliveries.every(d => d.jobId === testJobId)).toBe(true);
    });

    it('該当するDeliveryが存在しない場合は空配列が返されること', async () => {
      const deliveries = await deliveryRepository.findByJobId('non-existent-job-id');
      expect(deliveries).toHaveLength(0);
    });
  });
});
