import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgendaService } from '../../../src/ambient/service/agenda-service.js';
import type { FactRepository } from '../../../src/ambient/storage/fact-repository.js';
import type { FactTransformer } from '../../../src/ambient/transform/fact-transformer.js';
import type { OneOnOneAgendaAgent } from '../../../src/agent.js';
import type { Fact, Artifact } from '../../../src/ambient/storage/types.js';
import type { AgendaInput, AgendaOutput } from '../../../src/model/agenda.js';

// ArtifactRepository のモックインターフェース（まだ実装されていないため）
interface ArtifactRepository {
  create(data: {
    jobId: string;
    artifactType: string;
    content: string;
    metadata: any;
  }): Promise<Artifact>;
}

describe('AgendaService', () => {
  let factRepository: FactRepository;
  let artifactRepository: ArtifactRepository;
  let transformer: FactTransformer;
  let agent: OneOnOneAgendaAgent;
  let service: AgendaService;

  const mockFacts: Fact[] = [
    {
      id: 'fact-1',
      jobId: 'job-1',
      source: 'backlog',
      occurredAt: '2025-01-05T10:00:00Z',
      summary: 'Issue: PROJ-123',
      url: 'https://example.backlog.com/view/PROJ-123',
      confidence: 1.0,
      score: 0.8,
      rawRef: JSON.stringify({
        id: 'issue-123',
        key: 'PROJ-123',
        title: 'Fix bug',
        type: 'bug',
        status: 'Done',
        project: 'Project',
        url: 'https://example.backlog.com/view/PROJ-123',
        updatedAt: '2025-01-05T10:00:00Z',
      }),
      createdAt: '2025-01-05T10:00:00Z',
    },
  ];

  const mockAgendaInput: AgendaInput = {
    member: { id: 'user-123', name: '佐藤太郎' },
    period: { start: '2025-01-01', end: '2025-01-14' },
    backlog: {
      issues: [
        {
          id: 'issue-123',
          key: 'PROJ-123',
          title: 'Fix bug',
          type: 'bug',
          status: 'Done',
          project: 'Project',
          url: 'https://example.backlog.com/view/PROJ-123',
          updatedAt: '2025-01-05T10:00:00Z',
        },
      ],
      pullRequests: [],
    },
  };

  const mockAgendaOutput: AgendaOutput = {
    markdown: '# 1on1 Agenda\n\n## Recent Highlights\n- Fixed PROJ-123',
    metadata: {
      memberId: 'user-123',
      memberName: '佐藤太郎',
      periodStart: '2025-01-01',
      periodEnd: '2025-01-14',
      generatedAt: '2025-01-15T10:00:00Z',
      issueCount: 1,
    },
  };

  const mockArtifact: Artifact = {
    id: 'artifact-1',
    jobId: 'job-1',
    revision: 1,
    artifactType: 'markdown',
    content: mockAgendaOutput.markdown,
    filePath: null,
    sha256: 'abc123',
    createdAt: '2025-01-15T10:00:00Z',
  };

  beforeEach(() => {
    factRepository = {
      findByJobId: vi.fn(),
    } as any;

    artifactRepository = {
      create: vi.fn(),
    } as any;

    transformer = {
      transformToAgendaInput: vi.fn(),
    } as any;

    agent = {
      generateAgendaFromInput: vi.fn(),
    } as any;

    service = new AgendaService(factRepository, artifactRepository, transformer, agent);
  });

  describe('generateAgendaFromFacts', () => {
    it('FactsからAgendaを生成してArtifactを作成する', async () => {
      const member = { id: 'user-123', name: '佐藤太郎' };
      const period = { start: '2025-01-01', end: '2025-01-14' };

      vi.mocked(factRepository.findByJobId).mockResolvedValue(mockFacts);
      vi.mocked(transformer.transformToAgendaInput).mockReturnValue(mockAgendaInput);
      vi.mocked(agent.generateAgendaFromInput).mockResolvedValue(mockAgendaOutput);
      vi.mocked(artifactRepository.create).mockResolvedValue(mockArtifact);

      const artifactId = await service.generateAgendaFromFacts('job-1', member, period);

      expect(artifactId).toBe('artifact-1');

      // FactRepository.findByJobId が呼ばれたことを確認
      expect(factRepository.findByJobId).toHaveBeenCalledWith('job-1');

      // FactTransformer.transformToAgendaInput が呼ばれたことを確認
      expect(transformer.transformToAgendaInput).toHaveBeenCalledWith(member, period, mockFacts);

      // OneOnOneAgendaAgent.generateAgendaFromInput が呼ばれたことを確認
      expect(agent.generateAgendaFromInput).toHaveBeenCalledWith(mockAgendaInput);

      // ArtifactRepository.create が呼ばれたことを確認
      expect(artifactRepository.create).toHaveBeenCalledWith({
        jobId: 'job-1',
        artifactType: 'markdown',
        content: mockAgendaOutput.markdown,
        metadata: mockAgendaOutput.metadata,
      });
    });

    it('Factsが0件でもAgendaを生成する', async () => {
      const member = { id: 'user-123', name: '佐藤太郎' };
      const period = { start: '2025-01-01', end: '2025-01-14' };

      const emptyAgendaInput: AgendaInput = {
        member,
        period,
        backlog: { issues: [], pullRequests: [] },
      };

      const emptyAgendaOutput: AgendaOutput = {
        markdown: '# 1on1 Agenda\n\nNo activities found.',
        metadata: {
          memberId: 'user-123',
          memberName: '佐藤太郎',
          periodStart: '2025-01-01',
          periodEnd: '2025-01-14',
          generatedAt: '2025-01-15T10:00:00Z',
          issueCount: 0,
        },
      };

      vi.mocked(factRepository.findByJobId).mockResolvedValue([]);
      vi.mocked(transformer.transformToAgendaInput).mockReturnValue(emptyAgendaInput);
      vi.mocked(agent.generateAgendaFromInput).mockResolvedValue(emptyAgendaOutput);
      vi.mocked(artifactRepository.create).mockResolvedValue({
        ...mockArtifact,
        content: emptyAgendaOutput.markdown,
      });

      const artifactId = await service.generateAgendaFromFacts('job-1', member, period);

      expect(artifactId).toBe('artifact-1');
      expect(transformer.transformToAgendaInput).toHaveBeenCalledWith(member, period, []);
    });

    it('OneOnOneAgendaAgentが未設定の場合はエラーをthrowする', async () => {
      const serviceWithoutAgent = new AgendaService(
        factRepository,
        artifactRepository,
        transformer,
        undefined
      );

      const member = { id: 'user-123', name: '佐藤太郎' };
      const period = { start: '2025-01-01', end: '2025-01-14' };

      await expect(
        serviceWithoutAgent.generateAgendaFromFacts('job-1', member, period)
      ).rejects.toThrow('OneOnOneAgendaAgentが設定されていません');
    });

    it('FactRepository取得エラーはそのままthrowする', async () => {
      const member = { id: 'user-123', name: '佐藤太郎' };
      const period = { start: '2025-01-01', end: '2025-01-14' };

      vi.mocked(factRepository.findByJobId).mockRejectedValue(
        new Error('Database connection error')
      );

      await expect(service.generateAgendaFromFacts('job-1', member, period)).rejects.toThrow(
        'Database connection error'
      );
    });

    it('Agenda生成エラーはそのままthrowする', async () => {
      const member = { id: 'user-123', name: '佐藤太郎' };
      const period = { start: '2025-01-01', end: '2025-01-14' };

      vi.mocked(factRepository.findByJobId).mockResolvedValue(mockFacts);
      vi.mocked(transformer.transformToAgendaInput).mockReturnValue(mockAgendaInput);
      vi.mocked(agent.generateAgendaFromInput).mockRejectedValue(new Error('LLM API error'));

      await expect(service.generateAgendaFromFacts('job-1', member, period)).rejects.toThrow(
        'LLM API error'
      );
    });

    it('Artifact作成エラーはそのままthrowする', async () => {
      const member = { id: 'user-123', name: '佐藤太郎' };
      const period = { start: '2025-01-01', end: '2025-01-14' };

      vi.mocked(factRepository.findByJobId).mockResolvedValue(mockFacts);
      vi.mocked(transformer.transformToAgendaInput).mockReturnValue(mockAgendaInput);
      vi.mocked(agent.generateAgendaFromInput).mockResolvedValue(mockAgendaOutput);
      vi.mocked(artifactRepository.create).mockRejectedValue(new Error('Storage error'));

      await expect(service.generateAgendaFromFacts('job-1', member, period)).rejects.toThrow(
        'Storage error'
      );
    });
  });
});
