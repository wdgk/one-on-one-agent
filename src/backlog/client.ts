import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { BacklogUser, IssueSummary, PullRequestSummary } from '../model/backlog.js';
import { getConfig } from '../config.js';
import type { BacklogApiUser, BacklogApiIssue, BacklogApiPullRequest } from './types.js';
import { parseJsonFromMcpResponse } from './mcp-helpers.js';

/**
 * Backlog MCP クライアント
 * Backlog MCPサーバーとの通信を担当
 */
export class BacklogClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  /**
   * MCP接続を確立する
   */
  async connect(): Promise<void> {
    if (this.client) {
      return; // 既に接続済み
    }

    const config = getConfig();

    this.client = new Client({
      name: 'one-on-one-agent',
      version: '0.1.0',
    }, {
      capabilities: {},
    });

    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', 'backlog-mcp-server'],
      env: {
        BACKLOG_DOMAIN: config.backlog.domain,
        BACKLOG_API_KEY: config.backlog.apiKey,
      },
    });

    await this.client.connect(this.transport);
  }

  /**
   * MCP接続を切断する
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
    }
  }

  /**
   * ユーザー名からBacklogユーザーを検索する
   * @param name ユーザー名（部分一致）
   * @returns マッチしたユーザー情報
   * @throws ユーザーが見つからない、または複数マッチした場合
   */
  async findUserByName(name: string): Promise<BacklogUser> {
    if (!this.client) {
      throw new Error('MCP接続が確立されていません');
    }

    // まず認証ユーザー自身の情報を取得して、名前が一致するか確認
    try {
      const myselfResult = await this.client.callTool({
        name: 'get_myself',
        arguments: {},
      });

      const myselfContent = myselfResult.content as Array<{ type: string; text?: string }>;
      const myself = parseJsonFromMcpResponse<BacklogApiUser>(
        myselfContent,
        '認証ユーザー情報のパースに失敗しました'
      );

      // 認証ユーザーの名前が検索名に一致する場合、それを返す
      if (myself.name && myself.name.includes(name)) {
        return {
          id: String(myself.id),
          name: myself.name,
          mailAddress: myself.mailAddress,
        };
      }
    } catch (error) {
      // get_myselfが失敗した場合は、通常のユーザー検索にフォールバック
    }

    // get_usersツールを呼び出し
    const result = await this.client.callTool({
      name: 'get_users',
      arguments: {},
    });

    const content = result.content as Array<{ type: string; text?: string }>;
    const users = parseJsonFromMcpResponse<BacklogApiUser[]>(
      content,
      'ユーザー一覧のパースに失敗しました'
    );

    // 名前で部分一致検索
    const matchedUsers = users.filter((user) =>
      user.name && user.name.includes(name)
    );

    if (matchedUsers.length === 0) {
      throw new Error(`ユーザーが見つかりません: ${name}`);
    }

    if (matchedUsers.length > 1) {
      throw new Error(
        `複数のユーザーがマッチしました: ${matchedUsers.map((u) => u.name).join(', ')}`
      );
    }

    const user = matchedUsers[0];
    // ドメインモデルではIDを文字列として扱う（数値精度の問題を回避するため）
    return {
      id: String(user.id),
      name: user.name,
      mailAddress: user.mailAddress,
    };
  }

  /**
   * 指定ユーザーの課題を期間指定で取得する
   * @param userId ユーザーID
   * @param periodStart 期間開始日
   * @param periodEnd 期間終了日
   * @returns 課題一覧
   */
  async getIssuesByAssignee(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<IssueSummary[]> {
    if (!this.client) {
      throw new Error('MCP接続が確立されていません');
    }

    // get_issuesツールを呼び出し
    // API呼び出し時は文字列IDを数値に戻す必要がある
    const result = await this.client.callTool({
      name: 'get_issues',
      arguments: {
        assigneeId: [Number(userId)],
        updatedSince: periodStart.toISOString().split('T')[0],
        updatedUntil: periodEnd.toISOString().split('T')[0],
      },
    });

    const content = result.content as Array<{ type: string; text?: string }>;
    if (!content || content.length === 0) {
      return [];
    }

    const issues = parseJsonFromMcpResponse<BacklogApiIssue[]>(
      content,
      '課題一覧のパースに失敗しました'
    );

    // IssueSummary形式に変換
    const config = getConfig();
    return issues.map((issue) => ({
      id: String(issue.id),
      key: issue.issueKey,
      title: issue.summary,
      type: issue.issueType?.name || 'unknown',
      status: issue.status?.name || 'unknown',
      project: issue.projectId ? String(issue.projectId) : 'unknown',
      url: `https://${config.backlog.domain}/view/${issue.issueKey}`,
      updatedAt: issue.updated,
      createdAt: issue.created,
      priority: issue.priority?.name,
    }));
  }

  /**
   * 指定ユーザーが作成したプルリクエストを期間指定で取得する
   * @param userId ユーザーID
   * @param projectIds 対象プロジェクトIDのリスト
   * @param periodStart 期間開始日
   * @param periodEnd 期間終了日
   * @returns プルリクエスト一覧
   */
  async getPullRequestsByCreator(
    userId: string,
    projectIds: string[],
    periodStart: Date,
    periodEnd: Date
  ): Promise<PullRequestSummary[]> {
    if (!this.client) {
      throw new Error('MCP接続が確立されていません');
    }

    const config = getConfig();

    // 各プロジェクトのPRを並列取得
    const projectPromises = projectIds.map(async (projectId) => {
      try {
        // プロジェクトのリポジトリ一覧を取得
        const repoResult = await this.client!.callTool({
          name: 'get_git_repositories',
          arguments: {
            projectId: Number(projectId),
          },
        });

        const repoContent = repoResult.content as Array<{ type: string; text?: string }>;
        if (!repoContent || repoContent.length === 0) {
          return [];
        }

        const repositories = parseJsonFromMcpResponse<Array<{ id: number; name: string }>>(
          repoContent,
          'リポジトリ一覧のパースに失敗しました'
        );

        // 各リポジトリのPRを並列取得
        const repoPromises = repositories.map(async (repo) => {
          try {
            const prResult = await this.client!.callTool({
              name: 'get_pull_requests',
              arguments: {
                projectId: Number(projectId),
                repoId: repo.id,
                createdUserId: [Number(userId)],
              },
            });

            const prContent = prResult.content as Array<{ type: string; text?: string }>;
            if (!prContent || prContent.length === 0) {
              return [];
            }

            const pullRequests = parseJsonFromMcpResponse<BacklogApiPullRequest[]>(
              prContent,
              'プルリクエスト一覧のパースに失敗しました'
            );

            // 期間でフィルタしてPullRequestSummary形式に変換
            const filteredPrs = pullRequests
              .filter((pr) => {
                const createdDate = new Date(pr.created);
                return createdDate >= periodStart && createdDate <= periodEnd;
              })
              .map((pr) => ({
                number: pr.number,
                title: pr.summary,
                description: pr.description,
                status: pr.status.name,
                projectId: String(pr.projectId),
                repositoryId: String(pr.repositoryId),
                repositoryName: repo.name,
                url: `https://${config.backlog.domain}/git/${projectId}/${repo.name}/pullRequests/${pr.number}`,
                createdAt: pr.created,
                updatedAt: pr.updated,
                issueId: pr.issue ? String(pr.issue.id) : undefined,
              }));

            return filteredPrs;
          } catch (error) {
            // リポジトリ単位のエラーは警告を出力して続行
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`リポジトリ ${repo.name} のPR取得に失敗: ${errorMessage}`);
            return [];
          }
        });

        const repoResults = await Promise.allSettled(repoPromises);
        return repoResults
          .filter((result) => result.status === 'fulfilled')
          .flatMap((result) => result.value);
      } catch (error) {
        // プロジェクト単位のエラーは警告を出力して続行
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`プロジェクト ${projectId} のリポジトリ取得に失敗: ${errorMessage}`);
        return [];
      }
    });

    const projectResults = await Promise.allSettled(projectPromises);
    const allPullRequests = projectResults
      .filter((result) => result.status === 'fulfilled')
      .flatMap((result) => result.value);

    return allPullRequests;
  }
}
