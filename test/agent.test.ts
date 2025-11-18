import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OneOnOneAgendaAgent } from '../src/agent.js';
import type { AgendaOutput } from '../src/model/agenda.js';

// config.ts をモック
vi.mock('../src/config.js', () => ({
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

// Anthropic SDK をモック
const mockMessagesCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockMessagesCreate,
    },
  })),
}));

// MCP Client をモック
const mockCallTool = vi.fn();
const mockConnect = vi.fn();
const mockClose = vi.fn();

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    callTool: mockCallTool,
    connect: mockConnect,
    close: mockClose,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn(),
}));

describe('OneOnOneAgendaAgent', () => {
  let agent: OneOnOneAgendaAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new OneOnOneAgendaAgent();
  });

  afterEach(async () => {
    await agent.cleanup();
  });

  describe('generateAgenda', () => {
    it('正常フロー: 入力からアジェンダ生成まで完了する', async () => {
      // ParameterParser のモック（パラメータ抽出）
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              memberName: '佐藤',
              period: { weeks: 2 },
            }),
          },
        ],
      });

      // BacklogClient の get_myself のモック（名前がマッチしない）
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: 999,
              name: 'Test User',
              mailAddress: 'test@example.com',
            }),
          },
        ],
      });

      // BacklogClient の get_users のモック
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 1, name: '佐藤太郎', mailAddress: 'sato@example.com' },
            ]),
          },
        ],
      });

      // BacklogClient の get_issues のモック
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                id: 101,
                projectId: 1,
                issueKey: 'TEST-1',
                summary: 'テスト課題',
                issueType: { name: 'タスク' },
                status: { name: '完了' },
                priority: { name: '中' },
                updated: '2024-11-10T10:00:00Z',
                created: '2024-11-01T10:00:00Z',
              },
            ]),
          },
        ],
      });

      // BacklogClient の get_git_repositories のモック（PRなし）
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([]),
          },
        ],
      });

      // AgendaGenerator のモック
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '# 1on1 アジェンダ: 佐藤太郎\n\n## 最近のハイライト（成果）\n\nテスト課題完了',
          },
        ],
      });

      const input = '佐藤さんの直近2週間の1on1アジェンダを作成して';

      const result: AgendaOutput = await agent.generateAgenda(input);

      // AgendaOutputの構造を検証
      expect(result.markdown).toBeTruthy();
      expect(typeof result.markdown).toBe('string');
      expect(result.markdown.length).toBeGreaterThan(0);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.memberId).toBe('1');
      expect(result.metadata.memberName).toBe('佐藤太郎');
      expect(result.metadata.periodStart).toBeTruthy();
      expect(result.metadata.periodEnd).toBeTruthy();
      expect(result.metadata.generatedAt).toBeTruthy();
      expect(typeof result.metadata.issueCount).toBe('number');
    });

    it('生成されたMarkdownに必須セクションが含まれる', async () => {
      // ParameterParser のモック
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              memberName: '田中',
              period: { weeks: 1 },
            }),
          },
        ],
      });

      // BacklogClient の get_myself のモック（名前がマッチしない）
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: 999,
              name: 'Test User',
              mailAddress: 'test@example.com',
            }),
          },
        ],
      });

      // BacklogClient の get_users のモック
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 2, name: '田中花子', mailAddress: 'tanaka@example.com' },
            ]),
          },
        ],
      });

      // BacklogClient の get_issues のモック
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([]),
          },
        ],
      });

      // AgendaGenerator のモック
      const mockMarkdown = `# 1on1 アジェンダ: 田中花子

**日時**: （1on1実施時に記入）
**期間**: 2024-11-08 〜 2024-11-15

## 最近のハイライト（成果）

特になし

## 気になる点・リスク

特になし

## チームとのコラボレーション

特になし

## 成長・学習・キャリア

特になし

## 1on1での質問案

1. 最近の業務はどうですか？
2. サポートが必要なことは？
3. 今後の目標は？

## メモ欄

（1on1中の記録用）
`;

      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: mockMarkdown,
          },
        ],
      });

      const input = '田中さんの直近1週間';

      const result = await agent.generateAgenda(input);

      expect(result.markdown).toContain('# 1on1 アジェンダ');
      expect(result.markdown).toContain('## 最近のハイライト');
      expect(result.markdown).toContain('## 気になる点・リスク');
      expect(result.markdown).toContain('## チームとのコラボレーション');
      expect(result.markdown).toContain('## 成長・学習・キャリア');
      expect(result.markdown).toContain('## 1on1での質問案');
      expect(result.markdown).toContain('## メモ欄');
    });

    it('メンバー名がメタデータに正しく設定される', async () => {
      // ParameterParser のモック
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              memberName: '山田',
              period: { weeks: 2 },
            }),
          },
        ],
      });

      // BacklogClient の get_myself のモック（名前がマッチしない）
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: 999,
              name: 'Test User',
              mailAddress: 'test@example.com',
            }),
          },
        ],
      });

      // BacklogClient の get_users のモック
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 3, name: '山田次郎', mailAddress: 'yamada@example.com' },
            ]),
          },
        ],
      });

      // BacklogClient の get_issues のモック
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([]),
          },
        ],
      });

      // AgendaGenerator のモック
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '# 1on1 アジェンダ: 山田次郎',
          },
        ],
      });

      const input = '山田さんの直近2週間';

      const result = await agent.generateAgenda(input);

      expect(result.metadata.memberName).toContain('山田');
    });

    it('期間が正しく計算される（2週間）', async () => {
      // ParameterParser のモック
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              memberName: '鈴木',
              period: { weeks: 2 },
            }),
          },
        ],
      });

      // BacklogClient の get_myself のモック（名前がマッチしない）
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: 999,
              name: 'Test User',
              mailAddress: 'test@example.com',
            }),
          },
        ],
      });

      // BacklogClient の get_users のモック
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 4, name: '鈴木一郎', mailAddress: 'suzuki@example.com' },
            ]),
          },
        ],
      });

      // BacklogClient の get_issues のモック
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([]),
          },
        ],
      });

      // AgendaGenerator のモック
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '# 1on1 アジェンダ: 鈴木一郎',
          },
        ],
      });

      const input = '鈴木さんの直近2週間';

      const result = await agent.generateAgenda(input);

      const start = new Date(result.metadata.periodStart);
      const end = new Date(result.metadata.periodEnd);
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      // 約14日間（13-15日の範囲を許容）
      expect(diffDays).toBeGreaterThanOrEqual(13);
      expect(diffDays).toBeLessThanOrEqual(15);
    });

    it('課題数がメタデータに正しく設定される', async () => {
      // ParameterParser のモック
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              memberName: '高橋',
              period: { weeks: 2 },
            }),
          },
        ],
      });

      // BacklogClient の get_myself のモック（名前がマッチしない）
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: 999,
              name: 'Test User',
              mailAddress: 'test@example.com',
            }),
          },
        ],
      });

      // BacklogClient の get_users のモック
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 5, name: '高橋美咲', mailAddress: 'takahashi@example.com' },
            ]),
          },
        ],
      });

      // BacklogClient の get_issues のモック（3件の課題）
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                id: 101,
                projectId: 1,
                issueKey: 'TEST-1',
                summary: '課題1',
                issueType: { name: 'タスク' },
                status: { name: '完了' },
                priority: { name: '中' },
                updated: '2024-11-10T10:00:00Z',
                created: '2024-11-01T10:00:00Z',
              },
              {
                id: 102,
                projectId: 1,
                issueKey: 'TEST-2',
                summary: '課題2',
                issueType: { name: 'バグ' },
                status: { name: '処理中' },
                priority: { name: '高' },
                updated: '2024-11-11T10:00:00Z',
                created: '2024-11-02T10:00:00Z',
              },
              {
                id: 103,
                projectId: 1,
                issueKey: 'TEST-3',
                summary: '課題3',
                issueType: { name: '機能' },
                status: { name: '未処理' },
                priority: { name: '低' },
                updated: '2024-11-12T10:00:00Z',
                created: '2024-11-03T10:00:00Z',
              },
            ]),
          },
        ],
      });

      // BacklogClient の get_git_repositories のモック（PRなし）
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([]),
          },
        ],
      });

      // AgendaGenerator のモック
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: '# 1on1 アジェンダ: 高橋美咲',
          },
        ],
      });

      const input = '高橋さんの直近2週間';

      const result = await agent.generateAgenda(input);

      expect(result.metadata.issueCount).toBe(3);
    });
  });

  describe('エラーハンドリング', () => {
    it('メンバーが見つからない場合、適切なエラーメッセージ', async () => {
      // ParameterParser のモック
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              memberName: '存在しないユーザー',
              period: { weeks: 2 },
            }),
          },
        ],
      });

      // BacklogClient の get_myself のモック（名前がマッチしない）
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: 999,
              name: 'Test User',
              mailAddress: 'test@example.com',
            }),
          },
        ],
      });

      // BacklogClient の get_users のモック（該当ユーザーなし）
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 1, name: '佐藤太郎', mailAddress: 'sato@example.com' },
              { id: 2, name: '田中花子', mailAddress: 'tanaka@example.com' },
            ]),
          },
        ],
      });

      const input = '存在しないユーザーさんの直近2週間';

      await expect(agent.generateAgenda(input)).rejects.toThrow('ユーザーが見つかりません');
    });

    it('複数メンバーがマッチする場合、適切なエラーメッセージ', async () => {
      // ParameterParser のモック
      mockMessagesCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              memberName: 'a',
              period: { weeks: 2 },
            }),
          },
        ],
      });

      // BacklogClient の get_myself のモック（名前がマッチしない）
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: 999,
              name: 'Test User',
              mailAddress: 'test@example.com',
            }),
          },
        ],
      });

      // BacklogClient の get_users のモック（複数マッチ）
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 1, name: 'alice', mailAddress: 'alice@example.com' },
              { id: 2, name: 'alan', mailAddress: 'alan@example.com' },
              { id: 3, name: 'amanda', mailAddress: 'amanda@example.com' },
            ]),
          },
        ],
      });

      const input = 'aの直近2週間';

      await expect(agent.generateAgenda(input)).rejects.toThrow('複数のユーザーがマッチしました');
    });
  });
});
