import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BacklogCollector } from '../../../src/ambient/workers/backlog-collector.js';
import type { BacklogClient } from '../../../src/backlog/client.js';
import type { FactRepository } from '../../../src/ambient/storage/fact-repository.js';
import type { WorkerContext } from '../../../src/ambient/workers/types.js';
import type { Job, Task } from '../../../src/ambient/storage/types.js';
import type { BacklogUser, IssueSummary, PullRequestSummary } from '../../../src/model/backlog.js';

describe('BacklogCollector', () => {
  let backlogClient: BacklogClient;
  let factRepository: FactRepository;
  let collector: BacklogCollector;

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
    source: 'backlog',
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
    // BacklogClient のモック
    backlogClient = {
      findUserByName: vi.fn(),
      getIssuesByAssignee: vi.fn(),
      getPullRequestsByCreator: vi.fn(),
    } as any;

    // FactRepository のモック
    factRepository = {
      create: vi.fn(),
      findByUrl: vi.fn(),
    } as any;

    collector = new BacklogCollector(backlogClient, factRepository);
  });

  describe('getName', () => {
    it('Worker名を返す', () => {
      expect(collector.getName()).toBe('BacklogCollector');
    });
  });

  describe('getSource', () => {
    it('ソース種別を返す', () => {
      expect(collector.getSource()).toBe('backlog');
    });
  });

  describe('collect', () => {
    it('Backlogから課題とPRを取得してFactsを生成する', async () => {
      const mockUser: BacklogUser = {
        id: 'user-123',
        name: '佐藤太郎',
        mailAddress: 'sato@example.com',
      };

      const mockIssues: IssueSummary[] = [
        {
          id: 'issue-1',
          key: 'PROJ-123',
          title: 'Fix bug',
          type: 'bug',
          status: 'InProgress',
          project: 'proj-1',
          url: 'https://example.backlog.com/view/PROJ-123',
          updatedAt: '2025-01-05T10:00:00Z',
          createdAt: '2025-01-01T09:00:00Z',
          priority: 'High',
        },
      ];

      const mockPRs: PullRequestSummary[] = [
        {
          number: 42,
          title: 'Add feature',
          description: 'Feature description',
          status: 'Open',
          projectId: 'proj-1',
          repositoryId: 'repo-1',
          repositoryName: 'myrepo',
          url: 'https://example.backlog.com/git/proj-1/myrepo/pullRequests/42',
          createdAt: '2025-01-06T14:00:00Z',
          updatedAt: '2025-01-06T15:00:00Z',
        },
      ];

      vi.mocked(backlogClient.findUserByName).mockResolvedValue([mockUser]);
      vi.mocked(backlogClient.getIssuesByAssignee).mockResolvedValue(mockIssues);
      vi.mocked(backlogClient.getPullRequestsByCreator).mockResolvedValue(mockPRs);
      vi.mocked(factRepository.findByUrl).mockResolvedValue(null);
      vi.mocked(factRepository.create).mockImplementation(async (data: any) => ({
        ...data,
        id: `fact-${Date.now()}`,
        createdAt: new Date().toISOString(),
      }));

      const result = await collector.collect(mockContext);

      expect(result.error).toBeUndefined();
      expect(result.count).toBe(2);
      expect(result.facts).toHaveLength(2);

      // findUserByName が呼ばれたことを確認
      expect(backlogClient.findUserByName).toHaveBeenCalledWith('佐藤太郎');

      // getIssuesByAssignee が呼ばれたことを確認
      expect(backlogClient.getIssuesByAssignee).toHaveBeenCalledWith(
        'user-123',
        new Date('2025-01-01T00:00:00Z'),
        new Date('2025-01-14T23:59:59Z')
      );

      // getPullRequestsByCreator が呼ばれたことを確認
      expect(backlogClient.getPullRequestsByCreator).toHaveBeenCalledWith(
        'user-123',
        ['proj-1'], // issuesから抽出されたprojectId
        new Date('2025-01-01T00:00:00Z'),
        new Date('2025-01-14T23:59:59Z')
      );

      // Fact作成を確認
      expect(factRepository.create).toHaveBeenCalledTimes(2);

      // Issue Fact
      expect(factRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          source: 'backlog',
          summary: expect.stringContaining('PROJ-123'),
          url: 'https://example.backlog.com/view/PROJ-123',
          rawRef: expect.stringContaining('"key":"PROJ-123"'),
        })
      );

      // PR Fact
      expect(factRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          source: 'backlog',
          summary: expect.stringContaining('#42'),
          url: 'https://example.backlog.com/git/proj-1/myrepo/pullRequests/42',
          rawRef: expect.stringContaining('"number":42'),
        })
      );
    });

    it('ユーザーが見つからない場合はエラーを返す', async () => {
      vi.mocked(backlogClient.findUserByName).mockResolvedValue([]);

      const result = await collector.collect(mockContext);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Backlogユーザーが見つかりません');
      expect(result.count).toBe(0);
      expect(result.facts).toHaveLength(0);
    });

    it('attendeeNameがnullの場合はエラーを返す', async () => {
      const contextWithNoName: WorkerContext = {
        ...mockContext,
        job: {
          ...mockJob,
          attendeeName: null,
        },
      };

      const result = await collector.collect(contextWithNoName);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('attendeeNameが設定されていません');
      expect(result.count).toBe(0);
      expect(result.facts).toHaveLength(0);
    });

    it('課題とPRが0件の場合でも正常に完了する', async () => {
      const mockUser: BacklogUser = {
        id: 'user-123',
        name: '佐藤太郎',
        mailAddress: 'sato@example.com',
      };

      vi.mocked(backlogClient.findUserByName).mockResolvedValue([mockUser]);
      vi.mocked(backlogClient.getIssuesByAssignee).mockResolvedValue([]);
      vi.mocked(backlogClient.getPullRequestsByCreator).mockResolvedValue([]);

      const result = await collector.collect(mockContext);

      expect(result.error).toBeUndefined();
      expect(result.count).toBe(0);
      expect(result.facts).toHaveLength(0);
    });

    it('既に存在するFactは重複作成しない（冪等性）', async () => {
      const mockUser: BacklogUser = {
        id: 'user-123',
        name: '佐藤太郎',
        mailAddress: 'sato@example.com',
      };

      const mockIssues: IssueSummary[] = [
        {
          id: 'issue-1',
          key: 'PROJ-123',
          title: 'Fix bug',
          type: 'bug',
          status: 'InProgress',
          project: 'proj-1',
          url: 'https://example.backlog.com/view/PROJ-123',
          updatedAt: '2025-01-05T10:00:00Z',
        },
      ];

      vi.mocked(backlogClient.findUserByName).mockResolvedValue([mockUser]);
      vi.mocked(backlogClient.getIssuesByAssignee).mockResolvedValue(mockIssues);
      vi.mocked(backlogClient.getPullRequestsByCreator).mockResolvedValue([]);
      // 既にFactが存在する場合
      vi.mocked(factRepository.findByUrl).mockResolvedValue({
        id: 'existing-fact',
        jobId: 'job-1',
        source: 'backlog',
        occurredAt: '2025-01-05T10:00:00Z',
        summary: 'Existing fact',
        url: 'https://example.backlog.com/view/PROJ-123',
        confidence: 1.0,
        score: 0.8,
        rawRef: '{}',
        createdAt: '2025-01-05T10:00:00Z',
      });

      const result = await collector.collect(mockContext);

      expect(result.error).toBeUndefined();
      expect(result.count).toBe(0); // 重複のためスキップ
      expect(result.facts).toHaveLength(0);
      expect(factRepository.create).not.toHaveBeenCalled();
    });

    it('エラー発生時はerrorフィールドに設定する', async () => {
      vi.mocked(backlogClient.findUserByName).mockRejectedValue(new Error('API Error'));

      const result = await collector.collect(mockContext);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('API Error');
      expect(result.count).toBe(0);
      expect(result.facts).toHaveLength(0);
    });
  });
});
