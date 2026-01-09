import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgendaGenerator } from '../../src/llm/agenda-generator.js';
import type { AgendaInput } from '../../src/model/agenda.js';

// LLM Factoryをモック
const mockGenerateText = vi.fn();
vi.mock('../../src/llm/factory.js', () => ({
  createLLMClient: () => ({
    generateText: mockGenerateText,
  }),
}));

// config.ts をモック
vi.mock('../../src/config.js', () => ({
  getConfig: () => ({
    backlog: {
      domain: 'test.backlog.com',
      apiKey: 'test-api-key',
    },
    anthropic: {
      apiKey: 'test-anthropic-key',
    },
  }),
}));

describe('AgendaGenerator', () => {
  let generator: AgendaGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new AgendaGenerator();
  });

  describe('generate', () => {
    it('正常なAgendaInputから適切なMarkdownが生成される', async () => {
      const mockMarkdown = `# 1on1 アジェンダ: 佐藤太郎

**日時**: （1on1実施時に記入）
**期間**: 2024-11-01 〜 2024-11-15

## 最近のハイライト（成果）

- ユーザー認証機能の実装が完了

## 気になる点・リスク

- ログイン画面の表示崩れ修正が処理中

## チームとのコラボレーション

特になし

## 成長・学習・キャリア

新しい認証技術の習得

## 1on1での質問案

1. 認証機能の実装で学んだことは？
2. 今後挑戦したい技術領域は？
3. チームとのコラボで改善したい点は？

## メモ欄

（1on1中の記録用）
`;

      mockGenerateText.mockResolvedValue(mockMarkdown);

      const input: AgendaInput = {
        member: {
          id: '123',
          name: '佐藤太郎',
        },
        period: {
          start: '2024-11-01',
          end: '2024-11-15',
        },
        backlog: {
          issues: [
            {
              id: '1',
              key: 'PROJ-123',
              title: 'ユーザー認証機能の実装',
              type: 'feature',
              status: '完了',
              project: 'PROJ',
              url: 'https://example.backlog.com/view/PROJ-123',
              markdownLink: '[PROJ-123: ユーザー認証機能の実装](https://example.backlog.com/view/PROJ-123)',
              updatedAt: '2024-11-10T10:00:00Z',
              createdAt: '2024-11-01T10:00:00Z',
              priority: '高',
            },
            {
              id: '2',
              key: 'PROJ-124',
              title: 'バグ修正：ログイン画面の表示崩れ',
              type: 'bug',
              status: '処理中',
              project: 'PROJ',
              url: 'https://example.backlog.com/view/PROJ-124',
              markdownLink: '[PROJ-124: バグ修正：ログイン画面の表示崩れ](https://example.backlog.com/view/PROJ-124)',
              updatedAt: '2024-11-12T15:30:00Z',
            },
          ],
          pullRequests: [],
        },
      };

      const markdown = await generator.generate(input);

      expect(markdown).toBeTruthy();
      expect(typeof markdown).toBe('string');
      expect(markdown.length).toBeGreaterThan(0);
      expect(mockGenerateText).toHaveBeenCalledOnce();
    });

    it('課題が少ない場合（1件）でもエラーにならない', async () => {
      mockGenerateText.mockResolvedValue('# 1on1 アジェンダ: 田中花子\n\n## 最近のハイライト（成果）\n\n- ドキュメント更新完了');

      const input: AgendaInput = {
        member: {
          id: '456',
          name: '田中花子',
        },
        period: {
          start: '2024-11-01',
          end: '2024-11-15',
        },
        backlog: {
          issues: [
            {
              id: '1',
              key: 'PROJ-100',
              title: 'ドキュメント更新',
              type: 'task',
              status: '完了',
              project: 'PROJ',
              url: 'https://example.backlog.com/view/PROJ-100',
              markdownLink: '[PROJ-100: ドキュメント更新](https://example.backlog.com/view/PROJ-100)',
              updatedAt: '2024-11-05T10:00:00Z',
            },
          ],
          pullRequests: [],
        },
      };

      const markdown = await generator.generate(input);

      expect(markdown).toBeTruthy();
      expect(typeof markdown).toBe('string');
    });

    it('課題が0件の場合でもエラーにならない', async () => {
      mockGenerateText.mockResolvedValue('# 1on1 アジェンダ: 山田次郎\n\n**期間**: 2024-11-01 〜 2024-11-15\n\n## 最近のハイライト（成果）\n\n課題の更新がありませんでした。');

      const input: AgendaInput = {
        member: {
          id: '789',
          name: '山田次郎',
        },
        period: {
          start: '2024-11-01',
          end: '2024-11-15',
        },
        backlog: {
          issues: [],
          pullRequests: [],
        },
      };

      const markdown = await generator.generate(input);

      expect(markdown).toBeTruthy();
      expect(typeof markdown).toBe('string');
    });

    it('生成されたMarkdownが期待されるセクションを含む', async () => {
      const mockMarkdown = `# 1on1 アジェンダ: 佐藤太郎

**日時**: （1on1実施時に記入）
**期間**: 2024-11-01 〜 2024-11-15

## 最近のハイライト（成果）

- テスト課題完了

## 気になる点・リスク

特になし

## チームとのコラボレーション

特になし

## 成長・学習・キャリア

継続的な学習

## 1on1での質問案

1. 最近の業務で印象に残ったことは？
2. 今後取り組みたいことは？
3. サポートが必要なことはありますか？

## メモ欄

（1on1中の記録用）
`;

      mockGenerateText.mockResolvedValue(mockMarkdown);

      const input: AgendaInput = {
        member: {
          id: '123',
          name: '佐藤太郎',
        },
        period: {
          start: '2024-11-01',
          end: '2024-11-15',
        },
        backlog: {
          issues: [
            {
              id: '1',
              key: 'PROJ-123',
              title: 'テスト課題',
              type: 'task',
              status: '完了',
              project: 'PROJ',
              url: 'https://example.backlog.com/view/PROJ-123',
              markdownLink: '[PROJ-123: テスト課題](https://example.backlog.com/view/PROJ-123)',
              updatedAt: '2024-11-10T10:00:00Z',
            },
          ],
          pullRequests: [],
        },
      };

      const markdown = await generator.generate(input);

      // 必須セクションの存在確認
      expect(markdown).toContain('# 1on1 アジェンダ');
      expect(markdown).toContain('佐藤太郎');
      expect(markdown).toContain('## 最近のハイライト');
      expect(markdown).toContain('## 気になる点・リスク');
      expect(markdown).toContain('## チームとのコラボレーション');
      expect(markdown).toContain('## 成長・学習・キャリア');
      expect(markdown).toContain('## 1on1での質問案');
      expect(markdown).toContain('## メモ欄');
    });

    it('PR情報を含む入力データから適切なMarkdownが生成される', async () => {
      const mockMarkdown = `# 1on1 アジェンダ: 鈴木一郎

**日時**: （1on1実施時に記入）
**期間**: 2024-11-01 〜 2024-11-15

## 最近のハイライト（成果）

- 新機能追加のPR #123 がマージされました
- ユーザー認証機能の実装が完了

## 気になる点・リスク

特になし

## チームとのコラボレーション

- PR #124 でコードレビューに参加

## 成長・学習・キャリア

新しい認証技術の習得

## 1on1での質問案

1. PRのレビュープロセスで改善したい点は？
2. 今後挑戦したい技術領域は？
3. チームとのコラボで改善したい点は？

## メモ欄

（1on1中の記録用）
`;

      mockGenerateText.mockResolvedValue(mockMarkdown);

      const input: AgendaInput = {
        member: {
          id: '999',
          name: '鈴木一郎',
        },
        period: {
          start: '2024-11-01',
          end: '2024-11-15',
        },
        backlog: {
          issues: [
            {
              id: '1',
              key: 'PROJ-200',
              title: 'ユーザー認証機能の実装',
              type: 'feature',
              status: '完了',
              project: 'PROJ',
              url: 'https://example.backlog.com/view/PROJ-200',
              markdownLink: '[PROJ-200: ユーザー認証機能の実装](https://example.backlog.com/view/PROJ-200)',
              updatedAt: '2024-11-10T10:00:00Z',
            },
          ],
          pullRequests: [
            {
              number: 123,
              title: '新機能追加',
              description: 'ユーザーダッシュボードに新機能を追加',
              status: 'Merged',
              projectId: '1',
              repositoryId: '10',
              repositoryName: 'backend',
              url: 'https://example.backlog.com/git/1/backend/pullRequests/123',
              createdAt: '2024-11-05T10:00:00Z',
              updatedAt: '2024-11-08T15:00:00Z',
              issueId: '1',
            },
            {
              number: 124,
              title: 'バグ修正: ログイン処理',
              description: 'ログイン時のエラーハンドリングを改善',
              status: 'Open',
              projectId: '1',
              repositoryId: '10',
              repositoryName: 'backend',
              url: 'https://example.backlog.com/git/1/backend/pullRequests/124',
              createdAt: '2024-11-12T10:00:00Z',
              updatedAt: '2024-11-13T10:00:00Z',
            },
          ],
        },
      };

      const markdown = await generator.generate(input);

      expect(markdown).toBeTruthy();
      expect(typeof markdown).toBe('string');
      expect(markdown.length).toBeGreaterThan(0);
      expect(mockGenerateText).toHaveBeenCalledOnce();

      // プロンプトにPR情報が含まれていることを確認
      const callArgs = mockGenerateText.mock.calls[0];
      const userPrompt = callArgs[1]; // 2nd argument is userPrompt
      expect(userPrompt).toContain('プルリクエスト一覧');
      expect(userPrompt).toContain('新機能追加');
      expect(userPrompt).toContain('Merged');
    });

    it('課題が0件でPRのみの場合でもエラーにならない', async () => {
      mockGenerateText.mockResolvedValue(`# 1on1 アジェンダ: 高橋花子

**期間**: 2024-11-01 〜 2024-11-15

## 最近のハイライト（成果）

- PR #100 がマージされました

## 気になる点・リスク

特になし

## チームとのコラボレーション

PR活動が活発

## 成長・学習・キャリア

継続的な学習

## 1on1での質問案

1. PRでの学びは？
2. 今後の取り組みは？

## メモ欄

（1on1中の記録用）
`);

      const input: AgendaInput = {
        member: {
          id: '888',
          name: '高橋花子',
        },
        period: {
          start: '2024-11-01',
          end: '2024-11-15',
        },
        backlog: {
          issues: [],
          pullRequests: [
            {
              number: 100,
              title: 'テスト改善',
              description: 'ユニットテストのカバレッジを向上',
              status: 'Merged',
              projectId: '2',
              repositoryId: '20',
              repositoryName: 'frontend',
              url: 'https://example.backlog.com/git/2/frontend/pullRequests/100',
              createdAt: '2024-11-03T10:00:00Z',
              updatedAt: '2024-11-07T10:00:00Z',
            },
          ],
        },
      };

      const markdown = await generator.generate(input);

      expect(markdown).toBeTruthy();
      expect(typeof markdown).toBe('string');
    });
  });
});
