import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchAgendaGenerator } from '../../src/batch/batch-generator.js';
import type { BatchConfig } from '../../src/model/batch.js';
import type { AgendaOutput } from '../../src/model/agenda.js';

// モック用の関数
const mockGenerateAgenda = vi.fn();
const mockCleanup = vi.fn();

// OneOnOneAgendaAgentをモック
vi.mock('../../src/agent.js', () => {
  return {
    OneOnOneAgendaAgent: vi.fn().mockImplementation(() => ({
      generateAgenda: mockGenerateAgenda,
      cleanup: mockCleanup,
    })),
  };
});

describe('BatchAgendaGenerator', () => {
  let generator: BatchAgendaGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateAgenda.mockReset();
    mockCleanup.mockReset();
    generator = new BatchAgendaGenerator();
  });

  describe('generateBatch', () => {
    it('単一メンバーのアジェンダを生成できる', async () => {
      const config: BatchConfig = {
        members: [
          {
            name: '佐藤太郎',
            period: { weeks: 2 },
          },
        ],
        options: {
          maxConcurrency: 3,
          continueOnError: true,
          outputDir: 'output',
        },
      };

      // モックの戻り値を設定
      const mockOutput: AgendaOutput = {
        markdown: '# テストアジェンダ',
        metadata: {
          memberId: 1,
          memberName: '佐藤太郎',
          periodStart: '2024-11-01',
          periodEnd: '2024-11-15',
          generatedAt: '2024-11-15T12:00:00Z',
          issueCount: 10,
        },
      };

      mockGenerateAgenda.mockResolvedValue(mockOutput);

      const result = await generator.generateBatch(config);

      expect(result.total).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].status).toBe('success');
      expect(result.results[0].memberName).toBe('佐藤太郎');
    });

    it('複数メンバーのアジェンダを生成できる', async () => {
      const config: BatchConfig = {
        members: [
          { name: '佐藤太郎', period: { weeks: 2 } },
          { name: '田中花子', period: { months: 1 } },
          { name: '山田一郎', period: { days: 7 } },
        ],
        options: {
          maxConcurrency: 3,
          continueOnError: true,
          outputDir: 'output',
        },
      };

      const mockOutput: AgendaOutput = {
        markdown: '# テストアジェンダ',
        metadata: {
          memberId: 1,
          memberName: 'test',
          periodStart: '2024-11-01',
          periodEnd: '2024-11-15',
          generatedAt: '2024-11-15T12:00:00Z',
          issueCount: 10,
        },
      };

      mockGenerateAgenda.mockResolvedValue(mockOutput);

      const result = await generator.generateBatch(config);

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('一部のメンバーが失敗しても続行する', async () => {
      const config: BatchConfig = {
        members: [
          { name: '佐藤太郎', period: { weeks: 2 } },
          { name: '存在しないユーザー', period: { weeks: 2 } },
          { name: '田中花子', period: { months: 1 } },
        ],
        options: {
          maxConcurrency: 3,
          continueOnError: true,
          outputDir: 'output',
        },
      };

      const mockOutput: AgendaOutput = {
        markdown: '# テストアジェンダ',
        metadata: {
          memberId: 1,
          memberName: 'test',
          periodStart: '2024-11-01',
          periodEnd: '2024-11-15',
          generatedAt: '2024-11-15T12:00:00Z',
          issueCount: 10,
        },
      };

      // 2番目のメンバーだけエラーを返す
      mockGenerateAgenda
        .mockResolvedValueOnce(mockOutput)
        .mockRejectedValueOnce(new Error('ユーザーが見つかりません'))
        .mockResolvedValueOnce(mockOutput);

      const result = await generator.generateBatch(config);

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(3);

      // 失敗したメンバーを確認
      const failedResult = result.results.find(
        (r) => r.status === 'error'
      );
      expect(failedResult).toBeDefined();
      expect(failedResult?.memberName).toBe('存在しないユーザー');
      expect(failedResult?.error).toContain('ユーザーが見つかりません');
    });

    it('サマリーレポートを生成できる', async () => {
      const config: BatchConfig = {
        members: [
          { name: '佐藤太郎', period: { weeks: 2 } },
          { name: '田中花子', period: { months: 1 } },
        ],
        options: {
          maxConcurrency: 3,
          continueOnError: true,
          outputDir: 'output',
        },
      };

      const mockOutput: AgendaOutput = {
        markdown: '# テストアジェンダ',
        metadata: {
          memberId: 1,
          memberName: 'test',
          periodStart: '2024-11-01',
          periodEnd: '2024-11-15',
          generatedAt: '2024-11-15T12:00:00Z',
          issueCount: 10,
        },
      };

      mockGenerateAgenda.mockResolvedValue(mockOutput);

      const result = await generator.generateBatch(config);

      // サマリーがタイムスタンプを含むことを確認
      expect(result.timestamp).toBeDefined();
      expect(result.outputDir).toContain('batch_');
    });

    it('並列実行数を制御できる', async () => {
      const config: BatchConfig = {
        members: [
          { name: 'メンバー1' },
          { name: 'メンバー2' },
          { name: 'メンバー3' },
          { name: 'メンバー4' },
          { name: 'メンバー5' },
        ],
        options: {
          maxConcurrency: 2, // 最大2件同時
          continueOnError: true,
          outputDir: 'output',
        },
      };

      const mockOutput: AgendaOutput = {
        markdown: '# テストアジェンダ',
        metadata: {
          memberId: 1,
          memberName: 'test',
          periodStart: '2024-11-01',
          periodEnd: '2024-11-15',
          generatedAt: '2024-11-15T12:00:00Z',
          issueCount: 10,
        },
      };

      mockGenerateAgenda.mockResolvedValue(mockOutput);

      const result = await generator.generateBatch(config);

      expect(result.total).toBe(5);
      expect(result.succeeded).toBe(5);
    });
  });
});
