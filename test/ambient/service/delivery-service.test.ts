import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeliveryService } from '../../../src/ambient/service/delivery-service.js';
import type { DeliveryRepository } from '../../../src/ambient/storage/delivery-repository.js';
import type { ArtifactRepository } from '../../../src/ambient/storage/artifact-repository.js';
import type { JobRepository } from '../../../src/ambient/storage/job-repository.js';
import type { SlackClient } from '../../../src/slack/client.js';
import type { Artifact, Job } from '../../../src/ambient/storage/types.js';

describe('DeliveryService', () => {
  let deliveryService: DeliveryService;
  let mockDeliveryRepo: DeliveryRepository;
  let mockArtifactRepo: ArtifactRepository;
  let mockJobRepo: JobRepository;
  let mockSlackClient: SlackClient;

  beforeEach(() => {
    // DeliveryRepository mock
    mockDeliveryRepo = {
      create: vi.fn(),
      findByJobIdAndRevision: vi.fn(),
      updateStatus: vi.fn(),
    } as any;

    // ArtifactRepository mock
    mockArtifactRepo = {
      findById: vi.fn(),
      findLatestByJobId: vi.fn(),
    } as any;

    // JobRepository mock
    mockJobRepo = {
      findById: vi.fn(),
      updateStatus: vi.fn(),
    } as any;

    // SlackClient mock
    mockSlackClient = {
      sendDirectMessage: vi.fn(),
      findUserByEmail: vi.fn(),
      isAvailable: vi.fn().mockReturnValue(true),
    } as any;

    deliveryService = new DeliveryService(
      mockDeliveryRepo,
      mockArtifactRepo,
      mockJobRepo,
      mockSlackClient
    );
  });

  describe('sendToSlack', () => {
    it('Artifactを取得してSlack DMに送信し、Deliveryレコードを作成する', async () => {
      const mockJob: Job = {
        id: 'job-1',
        eventId: 'event-1',
        attendeeEmail: 'member@example.com',
        attendeeName: 'テストメンバー',
        startAt: '2025-12-31T10:00:00Z',
        endAt: '2025-12-31T11:00:00Z',
        status: 'DRAFTED',
        revision: 1,
        createdAt: '2025-12-30T10:00:00Z',
        updatedAt: '2025-12-30T10:00:00Z',
        idempotencyKey: 'event-1|member@example.com|2025-12-31T10:00:00Z',
        errorMessage: null,
        metadata: null,
      };

      const mockArtifact: Artifact = {
        id: 'artifact-1',
        jobId: 'job-1',
        revision: 1,
        artifactType: 'markdown',
        content: '# 1on1アジェンダ\n\nテスト内容',
        filePath: null,
        sha256: 'abc123',
        createdAt: '2025-12-30T10:00:00Z',
      };

      const mockSlackUser = {
        id: 'U12345',
        name: 'テストメンバー',
        email: 'member@example.com',
      };

      const mockDelivery = {
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
      };

      vi.mocked(mockJobRepo.findById).mockResolvedValue(mockJob);
      vi.mocked(mockArtifactRepo.findById).mockResolvedValue(mockArtifact);
      vi.mocked(mockDeliveryRepo.findByJobIdAndRevision).mockResolvedValue([]);
      vi.mocked(mockSlackClient.findUserByEmail).mockResolvedValue(mockSlackUser);
      vi.mocked(mockSlackClient.sendDirectMessage).mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
      } as any);
      vi.mocked(mockDeliveryRepo.create).mockResolvedValue(mockDelivery);

      const result = await deliveryService.sendToSlack('job-1', 'artifact-1');

      expect(mockJobRepo.findById).toHaveBeenCalledWith('job-1');
      expect(mockArtifactRepo.findById).toHaveBeenCalledWith('artifact-1');
      expect(mockSlackClient.findUserByEmail).toHaveBeenCalledWith('member@example.com');
      expect(mockSlackClient.sendDirectMessage).toHaveBeenCalledWith(
        'U12345',
        expect.stringContaining('1on1アジェンダ')
      );
      expect(mockDeliveryRepo.create).toHaveBeenCalledWith({
        jobId: 'job-1',
        revision: 1,
        channel: 'slack',
        target: 'U12345',
        status: 'sent',
        externalId: '1234567890.123456',
      });
      expect(result).toEqual(mockDelivery);
    });

    it('既に配信済みの場合は再送しない（冪等性）', async () => {
      const mockJob: Job = {
        id: 'job-1',
        eventId: 'event-1',
        attendeeEmail: 'member@example.com',
        attendeeName: 'テストメンバー',
        startAt: '2025-12-31T10:00:00Z',
        endAt: '2025-12-31T11:00:00Z',
        status: 'SENT_PREVIEW',
        revision: 1,
        createdAt: '2025-12-30T10:00:00Z',
        updatedAt: '2025-12-30T10:00:00Z',
        idempotencyKey: 'event-1|member@example.com|2025-12-31T10:00:00Z',
        errorMessage: null,
        metadata: null,
      };

      const mockArtifact: Artifact = {
        id: 'artifact-1',
        jobId: 'job-1',
        revision: 1,
        artifactType: 'markdown',
        content: '# 1on1アジェンダ',
        filePath: null,
        sha256: 'abc123',
        createdAt: '2025-12-30T10:00:00Z',
      };

      const mockExistingDelivery = {
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
      };

      vi.mocked(mockJobRepo.findById).mockResolvedValue(mockJob);
      vi.mocked(mockArtifactRepo.findById).mockResolvedValue(mockArtifact);
      vi.mocked(mockDeliveryRepo.findByJobIdAndRevision).mockResolvedValue([mockExistingDelivery]);

      const result = await deliveryService.sendToSlack('job-1', 'artifact-1');

      expect(mockSlackClient.sendDirectMessage).not.toHaveBeenCalled();
      expect(mockDeliveryRepo.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockExistingDelivery);
    });

    it('Artifactが存在しない場合はエラーをスローする', async () => {
      vi.mocked(mockArtifactRepo.findById).mockResolvedValue(null);

      await expect(deliveryService.sendToSlack('job-1', 'artifact-1')).rejects.toThrow(
        'Artifact not found: artifact-1'
      );
    });

    it('Jobが存在しない場合はエラーをスローする', async () => {
      const mockArtifact: Artifact = {
        id: 'artifact-1',
        jobId: 'job-1',
        revision: 1,
        artifactType: 'markdown',
        content: '# 1on1アジェンダ',
        filePath: null,
        sha256: 'abc123',
        createdAt: '2025-12-30T10:00:00Z',
      };

      vi.mocked(mockArtifactRepo.findById).mockResolvedValue(mockArtifact);
      vi.mocked(mockJobRepo.findById).mockResolvedValue(null);

      await expect(deliveryService.sendToSlack('job-1', 'artifact-1')).rejects.toThrow(
        'Job not found: job-1'
      );
    });

    it('Slackユーザーが見つからない場合はエラーをスローする', async () => {
      const mockJob: Job = {
        id: 'job-1',
        eventId: 'event-1',
        attendeeEmail: 'unknown@example.com',
        attendeeName: 'Unknown User',
        startAt: '2025-12-31T10:00:00Z',
        endAt: '2025-12-31T11:00:00Z',
        status: 'DRAFTED',
        revision: 1,
        createdAt: '2025-12-30T10:00:00Z',
        updatedAt: '2025-12-30T10:00:00Z',
        idempotencyKey: 'event-1|unknown@example.com|2025-12-31T10:00:00Z',
        errorMessage: null,
        metadata: null,
      };

      const mockArtifact: Artifact = {
        id: 'artifact-1',
        jobId: 'job-1',
        revision: 1,
        artifactType: 'markdown',
        content: '# 1on1アジェンダ',
        filePath: null,
        sha256: 'abc123',
        createdAt: '2025-12-30T10:00:00Z',
      };

      vi.mocked(mockArtifactRepo.findById).mockResolvedValue(mockArtifact);
      vi.mocked(mockJobRepo.findById).mockResolvedValue(mockJob);
      vi.mocked(mockDeliveryRepo.findByJobIdAndRevision).mockResolvedValue([]);
      vi.mocked(mockSlackClient.findUserByEmail).mockResolvedValue(null);

      await expect(deliveryService.sendToSlack('job-1', 'artifact-1')).rejects.toThrow(
        'Slack user not found for email: unknown@example.com'
      );
    });

    it('Slack送信失敗時にエラーステータスでDeliveryレコードを作成する', async () => {
      const mockJob: Job = {
        id: 'job-1',
        eventId: 'event-1',
        attendeeEmail: 'member@example.com',
        attendeeName: 'テストメンバー',
        startAt: '2025-12-31T10:00:00Z',
        endAt: '2025-12-31T11:00:00Z',
        status: 'DRAFTED',
        revision: 1,
        createdAt: '2025-12-30T10:00:00Z',
        updatedAt: '2025-12-30T10:00:00Z',
        idempotencyKey: 'event-1|member@example.com|2025-12-31T10:00:00Z',
        errorMessage: null,
        metadata: null,
      };

      const mockArtifact: Artifact = {
        id: 'artifact-1',
        jobId: 'job-1',
        revision: 1,
        artifactType: 'markdown',
        content: '# 1on1アジェンダ',
        filePath: null,
        sha256: 'abc123',
        createdAt: '2025-12-30T10:00:00Z',
      };

      const mockSlackUser = {
        id: 'U12345',
        name: 'テストメンバー',
        email: 'member@example.com',
      };

      const mockFailedDelivery = {
        id: 'delivery-1',
        jobId: 'job-1',
        revision: 1,
        channel: 'slack',
        target: 'U12345',
        status: 'failed',
        externalId: null,
        sentAt: null,
        errorMessage: 'Slack API error',
        createdAt: '2025-12-30T10:00:00Z',
        idempotencyKey: 'job-1|slack|U12345|1',
      };

      vi.mocked(mockJobRepo.findById).mockResolvedValue(mockJob);
      vi.mocked(mockArtifactRepo.findById).mockResolvedValue(mockArtifact);
      vi.mocked(mockDeliveryRepo.findByJobIdAndRevision).mockResolvedValue([]);
      vi.mocked(mockSlackClient.findUserByEmail).mockResolvedValue(mockSlackUser);
      vi.mocked(mockSlackClient.sendDirectMessage).mockRejectedValue(new Error('Slack API error'));
      vi.mocked(mockDeliveryRepo.create).mockResolvedValue(mockFailedDelivery);

      await expect(deliveryService.sendToSlack('job-1', 'artifact-1')).rejects.toThrow(
        'Slack API error'
      );

      expect(mockDeliveryRepo.create).toHaveBeenCalledWith({
        jobId: 'job-1',
        revision: 1,
        channel: 'slack',
        target: 'U12345',
        status: 'failed',
        externalId: undefined,
      });
    });
  });
});
