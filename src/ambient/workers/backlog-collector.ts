import type { BacklogClient } from '../../backlog/client.js';
import type { FactRepository } from '../storage/fact-repository.js';
import type { Worker, WorkerContext, WorkerResult } from './types.js';
import type { Source } from '../storage/types.js';

/**
 * BacklogCollector - Backlog課題とPRを収集してFactsを生成する
 */
export class BacklogCollector implements Worker {
  constructor(
    private backlogClient: BacklogClient,
    private factRepository: FactRepository
  ) {}

  /**
   * Worker名を取得する
   * @returns Worker名
   */
  getName(): string {
    return 'BacklogCollector';
  }

  /**
   * ソースを取得する
   * @returns ソース種別
   */
  getSource(): Source {
    return 'backlog';
  }

  /**
   * Backlog課題とPRを収集してFactsを生成する
   * @param context Worker実行コンテキスト
   * @returns Worker実行結果
   */
  async collect(context: WorkerContext): Promise<WorkerResult> {
    try {
      const { job, periodStart, periodEnd } = context;

      // attendeeNameが必要
      if (!job.attendeeName) {
        return {
          facts: [],
          count: 0,
          error: 'attendeeNameが設定されていません',
        };
      }

      // Backlogユーザーを検索
      const users = await this.backlogClient.findUserByName(job.attendeeName);
      if (users.length === 0) {
        return {
          facts: [],
          count: 0,
          error: `Backlogユーザーが見つかりません: ${job.attendeeName}`,
        };
      }

      const user = users[0]; // 最初のマッチを使用

      // 課題を取得
      const issues = await this.backlogClient.getIssuesByAssignee(
        user.id,
        new Date(periodStart),
        new Date(periodEnd)
      );

      // 課題からプロジェクトIDを抽出
      const projectIds = Array.from(
        new Set(issues.map(issue => issue.project).filter(id => id !== 'unknown'))
      );

      // プルリクエストを取得
      const pullRequests = await this.backlogClient.getPullRequestsByCreator(
        user.id,
        projectIds,
        new Date(periodStart),
        new Date(periodEnd)
      );

      // 課題とPRをFactsに変換
      const facts = [];

      // 課題をFactsに変換
      for (const issue of issues) {
        // 既に同じURLのFactが存在するかチェック（冪等性）
        const existing = await this.factRepository.findByUrl(job.id, issue.url);
        if (existing) {
          continue; // 既に存在する場合はスキップ
        }

        const fact = await this.factRepository.create({
          jobId: job.id,
          source: 'backlog',
          occurredAt: issue.updatedAt,
          summary: `Issue: ${issue.key} - ${issue.title}`,
          url: issue.url,
          confidence: 1.0,
          score: 0.8,
          rawRef: JSON.stringify(issue),
        });
        facts.push(fact);
      }

      // プルリクエストをFactsに変換
      for (const pr of pullRequests) {
        // 既に同じURLのFactが存在するかチェック（冪等性）
        const existing = await this.factRepository.findByUrl(job.id, pr.url);
        if (existing) {
          continue; // 既に存在する場合はスキップ
        }

        const fact = await this.factRepository.create({
          jobId: job.id,
          source: 'backlog',
          occurredAt: pr.updatedAt,
          summary: `PR: #${pr.number} - ${pr.title}`,
          url: pr.url,
          confidence: 1.0,
          score: 0.9,
          rawRef: JSON.stringify(pr),
        });
        facts.push(fact);
      }

      return {
        facts,
        count: facts.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        facts: [],
        count: 0,
        error: errorMessage,
      };
    }
  }
}
