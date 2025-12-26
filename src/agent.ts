import { BacklogClient } from './backlog/client.js';
import { ParameterParser } from './llm/parameter-parser.js';
import { AgendaGenerator } from './llm/agenda-generator.js';
import type { AgendaInput, AgendaOutput } from './model/agenda.js';
import { PERIOD_DEFAULTS, TIME } from './constants.js';

import { SlackClient } from './slack/client.js';

/**
 * 1on1アジェンダ生成エージェント
 * 全体のオーケストレーションを担当
 */
export class OneOnOneAgendaAgent {
  private backlogClient: BacklogClient;
  private slackClient: SlackClient;
  private parameterParser: ParameterParser;
  private agendaGenerator: AgendaGenerator;

  constructor(
    backlogClient?: BacklogClient,
    parameterParser?: ParameterParser,
    agendaGenerator?: AgendaGenerator,
    slackClient?: SlackClient
  ) {
    this.backlogClient = backlogClient || new BacklogClient();
    this.parameterParser = parameterParser || new ParameterParser();
    this.agendaGenerator = agendaGenerator || new AgendaGenerator();
    this.slackClient = slackClient || new SlackClient();
  }

  /**
   * 自然言語入力からアジェンダを生成する（後方互換性のため維持）
   * @param inputText ユーザーの入力テキスト
   * @returns 生成されたアジェンダ
   */
  async generateAgenda(inputText: string, options?: { dryRun?: boolean; templateDir?: string }): Promise<AgendaOutput> {
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
    return this.generateAgendaWithParams(members[0], parsed.period, options);
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
    member: { id: string; name: string; mailAddress?: string },
    periodParams: { weeks?: number; months?: number; days?: number },
    options?: { dryRun?: boolean; templateDir?: string }
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

    // Slackメッセージ取得
    let slackMessages: any[] = [];
    if (this.slackClient.isAvailable() && member.mailAddress) {
      const slackUserId = await this.slackClient.findUserByEmail(member.mailAddress);
      if (slackUserId) {
        slackMessages = await this.slackClient.getMessagesInPeriod(
          slackUserId,
          period.start,
          period.end
        );
      }
    }

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
      slack: {
        messages: slackMessages,
      },
    };

    let markdown: string;

    if (options?.dryRun) {
      markdown = this.generateDryRunOutput(agendaInput);
    } else {
      // アジェンダ生成
      // テンプレートディレクトリが指定されている場合は、そのためのGeneratorを使用するか、
      // 既存のGeneratorに一時的にパスを渡す必要がある。
      // ここでは、options.templateDirがある場合、新しいGeneratorを作成する（コストは低い）
      const generator = options?.templateDir
        ? new AgendaGenerator(options.templateDir)
        : this.agendaGenerator;

      markdown = await generator.generate(agendaInput);
    }

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
   * ドライラン用の出力を生成する
   */
  private generateDryRunOutput(input: AgendaInput): string {
    let output = `# [Dry Run] Data Preview: ${input.member.name}\n\n`;
    output += `**Period**: ${input.period.start} - ${input.period.end}\n\n`;

    output += `## Issues (${input.backlog.issues.length})\n`;
    if (input.backlog.issues.length === 0) {
      output += `- No issues found.\n`;
    } else {
      for (const issue of input.backlog.issues) {
        output += `- [${issue.status}] ${issue.key}: ${issue.title} (${issue.url})\n`;
      }
    }
    output += `\n`;

    output += `## Pull Requests (${input.backlog.pullRequests.length})\n`;
    if (input.backlog.pullRequests.length === 0) {
      output += `- No pull requests found.\n`;
    } else {
      for (const pr of input.backlog.pullRequests) {
        output += `- [${pr.status}] ${pr.repositoryName} #${pr.number}: ${pr.title} (${pr.url})\n`;
      }
    }
    output += `\n`;

    if (input.slack && input.slack.messages.length > 0) {
      output += `## Slack Messages (${input.slack.messages.length})\n`;
      for (const msg of input.slack.messages) {
        const date = new Date(parseFloat(msg.ts) * 1000).toLocaleString('ja-JP');
        output += `- [${date}] #${msg.channel}: ${msg.text.substring(0, 50).replace(/\n/g, ' ')}...\n`;
      }
      output += `\n`;
    }

    return output;
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
