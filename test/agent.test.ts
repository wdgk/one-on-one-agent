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
    gemini: {
      apiKey: 'test-gemini-key',
    },
    llmProvider: 'claude',
  }),
}));

import { BacklogClient } from '../src/backlog/client.js';
import { ParameterParser } from '../src/llm/parameter-parser.js';
import { AgendaGenerator } from '../src/llm/agenda-generator.js';

// 依存クラスのモック化
vi.mock('../src/backlog/client.js');
vi.mock('../src/llm/parameter-parser.js');
vi.mock('../src/llm/agenda-generator.js');

describe('OneOnOneAgendaAgent', () => {
  let agent: OneOnOneAgendaAgent;
  let mockBacklogClient: any;
  let mockParameterParser: any;
  let mockAgendaGenerator: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // モックインスタンスの作成
    mockBacklogClient = new BacklogClient();
    mockParameterParser = new ParameterParser();
    mockAgendaGenerator = new AgendaGenerator();

    // メソッドのモック化
    mockBacklogClient.connect = vi.fn();
    mockBacklogClient.disconnect = vi.fn();
    mockBacklogClient.findUserByName = vi.fn();
    mockBacklogClient.getIssuesByAssignee = vi.fn();
    mockBacklogClient.getPullRequestsByCreator = vi.fn();

    mockParameterParser.parse = vi.fn();

    mockAgendaGenerator.generate = vi.fn();

    agent = new OneOnOneAgendaAgent(
      mockBacklogClient,
      mockParameterParser,
      mockAgendaGenerator
    );
  });

  afterEach(async () => {
    await agent.cleanup();
  });

  describe('generateAgenda', () => {
    it('正常フロー: 入力からアジェンダ生成まで完了する', async () => {
      // ParameterParser のモック（パラメータ抽出）
      mockParameterParser.parse.mockResolvedValue({
        memberName: '佐藤',
        period: { weeks: 2 },
      });

      // BacklogClient の findUserByName のモック
      mockBacklogClient.findUserByName.mockResolvedValue([{
        id: '1',
        name: '佐藤太郎',
        mailAddress: 'sato@example.com',
      }]);

      // BacklogClient の getIssuesByAssignee のモック
      mockBacklogClient.getIssuesByAssignee.mockResolvedValue([
        {
          id: '101',
          key: 'TEST-1',
          title: 'テスト課題',
          type: 'タスク',
          status: '完了',
          project: '1',
          url: 'https://test.backlog.com/view/TEST-1',
          updatedAt: '2024-11-10T10:00:00Z',
          createdAt: '2024-11-01T10:00:00Z',
          priority: '中',
        },
      ]);

      // BacklogClient の getPullRequestsByCreator のモック
      mockBacklogClient.getPullRequestsByCreator.mockResolvedValue([]);

      // AgendaGenerator のモック
      mockAgendaGenerator.generate.mockResolvedValue(
        '# 1on1 アジェンダ: 佐藤太郎\n\n## 最近のハイライト（成果）\n\nテスト課題完了'
      );

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
      mockParameterParser.parse.mockResolvedValue({
        memberName: '田中',
        period: { weeks: 1 },
      });

      // BacklogClient の findUserByName のモック
      mockBacklogClient.findUserByName.mockResolvedValue([{
        id: '2',
        name: '田中花子',
        mailAddress: 'tanaka@example.com',
      }]);

      // BacklogClient の getIssuesByAssignee のモック
      mockBacklogClient.getIssuesByAssignee.mockResolvedValue([]);

      // BacklogClient の getPullRequestsByCreator のモック
      mockBacklogClient.getPullRequestsByCreator.mockResolvedValue([]);

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
      mockAgendaGenerator.generate.mockResolvedValue(mockMarkdown);

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
      mockParameterParser.parse.mockResolvedValue({
        memberName: '山田',
        period: { weeks: 2 },
      });

      // BacklogClient の findUserByName のモック
      mockBacklogClient.findUserByName.mockResolvedValue([{
        id: '3',
        name: '山田次郎',
        mailAddress: 'yamada@example.com',
      }]);

      // BacklogClient の getIssuesByAssignee のモック
      mockBacklogClient.getIssuesByAssignee.mockResolvedValue([]);

      // BacklogClient の getPullRequestsByCreator のモック
      mockBacklogClient.getPullRequestsByCreator.mockResolvedValue([]);

      // AgendaGenerator のモック
      mockAgendaGenerator.generate.mockResolvedValue('# 1on1 アジェンダ: 山田次郎');

      const input = '山田さんの直近2週間';

      const result = await agent.generateAgenda(input);

      expect(result.metadata.memberName).toContain('山田');
    });

    it('期間が正しく計算される（2週間）', async () => {
      // ParameterParser のモック
      mockParameterParser.parse.mockResolvedValue({
        memberName: '鈴木',
        period: { weeks: 2 },
      });

      // BacklogClient の findUserByName のモック
      mockBacklogClient.findUserByName.mockResolvedValue([{
        id: '4',
        name: '鈴木一郎',
        mailAddress: 'suzuki@example.com',
      }]);

      // BacklogClient の getIssuesByAssignee のモック
      mockBacklogClient.getIssuesByAssignee.mockResolvedValue([]);

      // BacklogClient の getPullRequestsByCreator のモック
      mockBacklogClient.getPullRequestsByCreator.mockResolvedValue([]);

      // AgendaGenerator のモック
      mockAgendaGenerator.generate.mockResolvedValue('# 1on1 アジェンダ: 鈴木一郎');

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
      mockParameterParser.parse.mockResolvedValue({
        memberName: '高橋',
        period: { weeks: 2 },
      });

      // BacklogClient の findUserByName のモック
      mockBacklogClient.findUserByName.mockResolvedValue([{
        id: '5',
        name: '高橋美咲',
        mailAddress: 'takahashi@example.com',
      }]);

      // BacklogClient の getIssuesByAssignee のモック（3件の課題）
      mockBacklogClient.getIssuesByAssignee.mockResolvedValue([
        {
          id: '101',
          key: 'TEST-1',
          title: '課題1',
          type: 'タスク',
          status: '完了',
          project: '1',
          url: 'https://test.backlog.com/view/TEST-1',
          updatedAt: '2024-11-10T10:00:00Z',
          createdAt: '2024-11-01T10:00:00Z',
          priority: '中',
        },
        {
          id: '102',
          key: 'TEST-2',
          title: '課題2',
          type: 'バグ',
          status: '処理中',
          project: '1',
          url: 'https://test.backlog.com/view/TEST-2',
          updatedAt: '2024-11-11T10:00:00Z',
          createdAt: '2024-11-02T10:00:00Z',
          priority: '高',
        },
        {
          id: '103',
          key: 'TEST-3',
          title: '課題3',
          type: '機能',
          status: '未処理',
          project: '1',
          url: 'https://test.backlog.com/view/TEST-3',
          updatedAt: '2024-11-12T10:00:00Z',
          createdAt: '2024-11-03T10:00:00Z',
          priority: '低',
        },
      ]);

      // BacklogClient の getPullRequestsByCreator のモック
      mockBacklogClient.getPullRequestsByCreator.mockResolvedValue([]);

      // AgendaGenerator のモック
      mockAgendaGenerator.generate.mockResolvedValue('# 1on1 アジェンダ: 高橋美咲');

      const input = '高橋さんの直近2週間';

      const result = await agent.generateAgenda(input);

      expect(result.metadata.issueCount).toBe(3);
    });

    it('ドライランモード: LLMを呼び出さずにプレビューを生成する', async () => {
      const member = {
        id: '1',
        name: '佐藤太郎',
        mailAddress: 'sato@example.com',
      };
      const periodParams = { weeks: 2 };

      // BacklogClient の getIssuesByAssignee のモック
      mockBacklogClient.getIssuesByAssignee.mockResolvedValue([
        {
          id: '101',
          key: 'TEST-1',
          title: 'テスト課題',
          type: 'タスク',
          status: '完了',
          project: '1',
          url: 'https://test.backlog.com/view/TEST-1',
          updatedAt: '2024-11-10T10:00:00Z',
          createdAt: '2024-11-01T10:00:00Z',
          priority: '中',
        },
      ]);

      // BacklogClient の getPullRequestsByCreator のモック
      mockBacklogClient.getPullRequestsByCreator.mockResolvedValue([]);

      // generateAgendaWithParams を dryRun: true で呼び出し
      const result = await agent.generateAgendaWithParams(member, periodParams, { dryRun: true });

      // AgendaGenerator.generate が呼ばれていないことを確認
      expect(mockAgendaGenerator.generate).not.toHaveBeenCalled();

      // 出力内容の検証
      expect(result.markdown).toContain('# [Dry Run] Data Preview');
      expect(result.markdown).toContain('TEST-1: テスト課題');
      expect(result.metadata.issueCount).toBe(1);
    });
  });

  describe('エラーハンドリング', () => {
    it('メンバーが見つからない場合、適切なエラーメッセージ', async () => {
      // ParameterParser のモック
      mockParameterParser.parse.mockResolvedValue({
        memberName: '存在しないユーザー',
        period: { weeks: 2 },
      });

      // BacklogClient の findUserByName のモック（該当なし）
      mockBacklogClient.findUserByName.mockResolvedValue([]);

      const input = '存在しないユーザーさんの直近2週間';

      await expect(agent.generateAgenda(input)).rejects.toThrow('ユーザーが見つかりません');
    });

    it('複数メンバーがマッチする場合、適切なエラーメッセージ', async () => {
      // ParameterParser のモック
      mockParameterParser.parse.mockResolvedValue({
        memberName: 'a',
        period: { weeks: 2 },
      });

      // BacklogClient の findUserByName のモック（複数ヒット）
      mockBacklogClient.findUserByName.mockResolvedValue([
        { id: '1', name: 'alice', mailAddress: 'alice@example.com' },
        { id: '2', name: 'alan', mailAddress: 'alan@example.com' },
      ]);

      const input = 'aの直近2週間';

      await expect(agent.generateAgenda(input)).rejects.toThrow('複数のユーザーがマッチしました');
    });
  });
});
