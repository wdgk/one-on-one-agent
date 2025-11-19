import { BacklogClient } from './backlog/client.js';
import { ParameterParser } from './llm/parameter-parser.js';
import { AgendaGenerator } from './llm/agenda-generator.js';
import type { AgendaInput, AgendaOutput } from './model/agenda.js';
import { PERIOD_DEFAULTS, TIME } from './constants.js';

/**
 * 1on1アジェンダ生成エージェント
 * 全体のオーケストレーションを担当
 */
export class OneOnOneAgendaAgent {
  private backlogClient: BacklogClient;
  private parameterParser: ParameterParser;
  private agendaGenerator: AgendaGenerator;

  constructor(
    backlogClient?: BacklogClient,
    parameterParser?: ParameterParser,
    agendaGenerator?: AgendaGenerator
  ) {
    this.backlogClient = backlogClient || new BacklogClient();
    this.parameterParser = parameterParser || new ParameterParser();
    this.agendaGenerator = agendaGenerator || new AgendaGenerator();
  }

  /**
   * 自然言語入力からアジェンダを生成する（後方互換性のため維持）
   * @param inputText ユーザーの入力テキスト
   * @returns 生成されたアジェンダ
   */
  async generateAgenda(inputText: string): Promise<AgendaOutput> {
    // 1. パラメータ抽出
    const parsed = await this.parseInput(inputText);

    // 2. Backlog接続
    await this.backlogClient.connect();

    // 3. メンバー解決
    const members = await this.searchMember(parsed.memberName);

    if (members.length === 0) {
      throw new Error(`ユーザーが見つかりません: ${parsed.memberName}`);
    }

    if (members.length > 1) {
      throw new Error(
        `複数のユーザーがマッチしました: ${members.map((u) => u.name).join(', ')}`
      );
    }

    // 4. アジェンダ生成
    return this.generateAgendaWithParams(members[0], parsed.period);
  }

  /**
   * 入力テキストをパースする
   */
  async parseInput(inputText: string) {
    return this.parameterParser.parse(inputText);
  }

  /**
   * メンバーを検索する
   */
  async searchMember(name: string) {
    // 接続状態を確認していない場合は接続（CLIからの直接呼び出し用）
    // 注: 本来は接続管理をより厳密に行うべきだが、簡易的な対応
    await this.backlogClient.connect();
    return this.backlogClient.findUserByName(name);
  }

  /**
   * パラメータを指定してアジェンダを生成する
   */
  async generateAgendaWithParams(
    member: { id: string; name: string },
    periodParams: { weeks?: number; months?: number; days?: number }
  ): Promise<AgendaOutput> {
    // 期間計算
    const period = this.calculatePeriod(periodParams);

    // 課題取得
    const issues = await this.backlogClient.getIssuesByAssignee(
      member.id,
      period.start,
      period.end
    );

    // 課題から検出したプロジェクトIDのリストを抽出
    const projectIds = Array.from(
      new Set(issues.map(issue => issue.project).filter(id => id !== 'unknown'))
    );

    // プルリクエスト取得
    const pullRequests = await this.backlogClient.getPullRequestsByCreator(
      member.id,
      projectIds,
      period.start,
      period.end
    );

    // AgendaInput構築
    const agendaInput: AgendaInput = {
      member: {
        id: member.id,
        name: member.name,
      },
      period: {
        start: period.start.toISOString().split('T')[0],
        end: period.end.toISOString().split('T')[0],
      },
      backlog: {
        issues,
        pullRequests,
      },
    };

    // アジェンダ生成
    const markdown = await this.agendaGenerator.generate(agendaInput);

    // AgendaOutput作成
    return {
      markdown,
      metadata: {
        memberId: member.id,
        memberName: member.name,
        periodStart: agendaInput.period.start,
        periodEnd: agendaInput.period.end,
        generatedAt: new Date().toISOString(),
        issueCount: issues.length,
      },
    };
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    await this.backlogClient.disconnect();
  }

  /**
   * 期間指定から開始日・終了日を計算する（UTC基準）
   * @param period 期間指定
   * @returns 開始日と終了日
   */
  private calculatePeriod(period: {
    weeks?: number;
    months?: number;
    days?: number;
  }): { start: Date; end: Date } {
    // UTC基準で現在の日付を取得
    const now = new Date();
    const end = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    ));

    let daysToSubtract: number;

    if (period.days) {
      daysToSubtract = period.days;
    } else if (period.weeks) {
      daysToSubtract = period.weeks * PERIOD_DEFAULTS.DAYS_PER_WEEK;
    } else if (period.months) {
      daysToSubtract = period.months * PERIOD_DEFAULTS.DAYS_PER_MONTH;
    } else {
      daysToSubtract = PERIOD_DEFAULTS.DEFAULT_DAYS;
    }

    const start = new Date(end.getTime() - daysToSubtract * TIME.MILLISECONDS_PER_DAY);

    return { start, end };
  }
}
