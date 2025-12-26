import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BacklogClient } from '../../src/backlog/client.js';
import type { IssueSummary, PullRequestSummary } from '../../src/model/backlog.js';

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

describe('BacklogClient', () => {
  let client: BacklogClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BacklogClient();
  });

  afterEach(async () => {
    await client.disconnect();
  });

  describe('connect/disconnect', () => {
    it('MCP接続・切断が正常に動作する', async () => {
      await expect(client.connect()).resolves.toBeUndefined();
      expect(mockConnect).toHaveBeenCalledOnce();

      await expect(client.disconnect()).resolves.toBeUndefined();
      expect(mockClose).toHaveBeenCalledOnce();
    });
  });

  describe('findUserByName', () => {
    it('ユーザー名が見つかる場合、正しいユーザー情報の配列を返す', async () => {
      // モックデータを設定
      mockCallTool.mockResolvedValue({
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

      await client.connect();
      const users = await client.findUserByName('佐藤');

      expect(users).toHaveLength(1);
      expect(users[0].id).toBe('1');
      expect(users[0].name).toBe('佐藤太郎');
      expect(users[0].mailAddress).toBe('sato@example.com');
    });

    it('ユーザー名が見つからない場合、空配列を返す', async () => {
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 1, name: '佐藤太郎', mailAddress: 'sato@example.com' },
            ]),
          },
        ],
      });

      await client.connect();
      const users = await client.findUserByName('存在しないユーザー');
      expect(users).toEqual([]);
    });

    it('複数ユーザーがマッチする場合、全てのユーザーを返す', async () => {
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 1, name: 'alice', mailAddress: 'alice@example.com' },
              { id: 2, name: 'alan', mailAddress: 'alan@example.com' },
            ]),
          },
        ],
      });

      await client.connect();
      const users = await client.findUserByName('a');

      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('alice');
      expect(users[1].name).toBe('alan');
    });
  });

  describe('getIssuesByAssignee', () => {
    it('課題取得が正常に動作する', async () => {
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                id: 101,
                projectId: 1,
                issueKey: 'TEST-1',
                summary: 'テスト課題1',
                issueType: { name: 'タスク' },
                status: { name: '処理中' },
                priority: { name: '中' },
                updated: '2024-11-10T10:00:00Z',
                created: '2024-11-01T10:00:00Z',
              },
              {
                id: 102,
                projectId: 1,
                issueKey: 'TEST-2',
                summary: 'テスト課題2',
                issueType: { name: 'バグ' },
                status: { name: '完了' },
                priority: { name: '高' },
                updated: '2024-11-12T10:00:00Z',
                created: '2024-11-05T10:00:00Z',
              },
            ]),
          },
        ],
      });

      await client.connect();

      const userId = 'test-user-id';
      const periodStart = new Date('2024-11-01');
      const periodEnd = new Date('2024-11-15');

      const issues = await client.getIssuesByAssignee(userId, periodStart, periodEnd);

      expect(Array.isArray(issues)).toBe(true);
      expect(issues.length).toBe(2);

      const issue1 = issues[0];
      expect(issue1.id).toBe('101');
      expect(issue1.key).toBe('TEST-1');
      expect(issue1.title).toBe('テスト課題1');
      expect(issue1.type).toBe('タスク');
      expect(issue1.status).toBe('処理中');
      expect(issue1.url).toBe('https://test.backlog.com/view/TEST-1');
    });

    it('課題が0件の場合、空配列を返す', async () => {
      mockCallTool.mockResolvedValue({
        content: [],
      });

      await client.connect();

      const userId = 'user-with-no-issues';
      const periodStart = new Date('2024-11-01');
      const periodEnd = new Date('2024-11-15');

      const issues = await client.getIssuesByAssignee(userId, periodStart, periodEnd);

      expect(issues).toEqual([]);
    });
  });

  describe('getPullRequestsByCreator', () => {
    it('PR取得が正常に動作する', async () => {
      // リポジトリ一覧のモック
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 1, name: 'test-repo' },
            ]),
          },
        ],
      });

      // PR一覧のモック
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              {
                id: 1001,
                projectId: 1,
                repositoryId: 1,
                number: 1,
                summary: 'Add new feature',
                description: 'This PR adds a new feature',
                status: { name: 'Open' },
                created: '2024-11-05T10:00:00Z',
                updated: '2024-11-10T10:00:00Z',
              },
              {
                id: 1002,
                projectId: 1,
                repositoryId: 1,
                number: 2,
                summary: 'Fix bug',
                description: 'This PR fixes a bug',
                status: { name: 'Merged' },
                created: '2024-11-08T10:00:00Z',
                updated: '2024-11-12T10:00:00Z',
                issue: { id: 101, keyId: 1, key: 'TEST-1', summary: 'Bug fix' },
              },
            ]),
          },
        ],
      });

      await client.connect();

      const userId = 'test-user-id';
      const projectIds = ['1'];
      const periodStart = new Date('2024-11-01');
      const periodEnd = new Date('2024-11-15');

      const pullRequests = await client.getPullRequestsByCreator(
        userId,
        projectIds,
        periodStart,
        periodEnd
      );

      expect(Array.isArray(pullRequests)).toBe(true);
      expect(pullRequests.length).toBe(2);

      const pr1 = pullRequests[0];
      expect(pr1.number).toBe(1);
      expect(pr1.title).toBe('Add new feature');
      expect(pr1.status).toBe('Open');
      expect(pr1.repositoryName).toBe('test-repo');
      expect(pr1.url).toContain('pullRequests/1');

      const pr2 = pullRequests[1];
      expect(pr2.number).toBe(2);
      expect(pr2.issueId).toBe('101');
    });

    it('PRが0件の場合、空配列を返す', async () => {
      // リポジトリ一覧のモック
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 1, name: 'test-repo' },
            ]),
          },
        ],
      });

      // PR一覧のモック（空）
      mockCallTool.mockResolvedValueOnce({
        content: [],
      });

      await client.connect();

      const userId = 'user-with-no-prs';
      const projectIds = ['1'];
      const periodStart = new Date('2024-11-01');
      const periodEnd = new Date('2024-11-15');

      const pullRequests = await client.getPullRequestsByCreator(
        userId,
        projectIds,
        periodStart,
        periodEnd
      );

      expect(pullRequests).toEqual([]);
    });

    it('リポジトリがないプロジェクトの場合、空配列を返す', async () => {
      // リポジトリ一覧のモック（空）
      mockCallTool.mockResolvedValueOnce({
        content: [],
      });

      await client.connect();

      const userId = 'test-user-id';
      const projectIds = ['1'];
      const periodStart = new Date('2024-11-01');
      const periodEnd = new Date('2024-11-15');

      const pullRequests = await client.getPullRequestsByCreator(
        userId,
        projectIds,
        periodStart,
        periodEnd
      );

      expect(pullRequests).toEqual([]);
    });
  });
});
