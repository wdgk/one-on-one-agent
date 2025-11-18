import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { OneOnOneAgendaAgent } from '../agent.js';
import { generateAgendaFilename } from '../file-helpers.js';
import { formatPeriodForGeneration } from './period-formatter.js';
import type { BatchConfig, BatchResult, MemberResult, Member } from '../model/batch.js';

/**
 * バッチアジェンダ生成クラス
 * 複数メンバーのアジェンダを並列生成する
 */
export class BatchAgendaGenerator {
  private agent: OneOnOneAgendaAgent;

  constructor() {
    this.agent = new OneOnOneAgendaAgent();
  }

  /**
   * 設定ファイルからバッチ生成を実行
   * @param config バッチ設定
   * @returns バッチ生成結果
   */
  async generateBatch(config: BatchConfig): Promise<BatchResult> {
    // 出力ディレクトリを作成
    const outputDir = await this.createOutputDirectory(config.options.outputDir);

    // 各メンバーのアジェンダを並列生成
    const results = await this.generateParallel(
      config.members,
      config.options.maxConcurrency
    );

    // 各メンバーのアジェンダをファイルに保存
    for (const result of results) {
      if (result.status === 'success' && result.output) {
        await this.saveAgenda(result.output, outputDir);
      }
    }

    // サマリーレポートを生成
    const summary = this.generateSummary(results);
    await writeFile(join(outputDir, 'summary.md'), summary, 'utf-8');

    // バッチ結果を構築
    const batchResult: BatchResult = {
      timestamp: new Date().toISOString(),
      outputDir,
      total: results.length,
      succeeded: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'error').length,
      results,
    };

    return batchResult;
  }

  /**
   * 各メンバーのアジェンダを並列生成（最大並列数を制御）
   * @param members メンバーリスト
   * @param maxConcurrency 最大並列数
   * @returns メンバー別の結果
   */
  private async generateParallel(
    members: Member[],
    maxConcurrency: number
  ): Promise<MemberResult[]> {
    const results: MemberResult[] = [];

    // チャンク化して並列実行
    for (let i = 0; i < members.length; i += maxConcurrency) {
      const chunk = members.slice(i, i + maxConcurrency);

      const promises = chunk.map((member) =>
        this.generateForMember(member).catch((error) => ({
          memberName: member.name,
          status: 'error' as const,
          error: error instanceof Error ? error.message : String(error),
          duration: 0,
        }))
      );

      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * 1メンバーのアジェンダを生成
   * @param member メンバー情報
   * @returns メンバーの生成結果
   */
  private async generateForMember(member: Member): Promise<MemberResult> {
    const startTime = Date.now();

    try {
      // 期間指定の文字列を構築
      const periodText = formatPeriodForGeneration(member.period);
      const inputText = `${member.name}の${periodText}`;

      // アジェンダ生成
      const output = await this.agent.generateAgenda(inputText);

      const duration = Date.now() - startTime;

      return {
        memberName: member.name,
        status: 'success',
        output,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        memberName: member.name,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }

  /**
   * サマリーレポートを生成
   * @param results メンバー別の結果
   * @returns Markdown形式のサマリー
   */
  private generateSummary(results: MemberResult[]): string {
    const succeeded = results.filter((r) => r.status === 'success');
    const failed = results.filter((r) => r.status === 'error');

    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = results.length > 0 ? totalDuration / results.length : 0;

    let summary = '# バッチアジェンダ生成レポート\n\n';
    summary += `**生成日時**: ${new Date().toLocaleString('ja-JP')}\n`;
    summary += `**総メンバー数**: ${results.length}人\n`;
    summary += `**成功**: ${succeeded.length}人\n`;
    summary += `**失敗**: ${failed.length}人\n\n`;

    if (succeeded.length > 0) {
      summary += '## 成功したメンバー\n\n';
      for (const result of succeeded) {
        const durationSec = (result.duration / 1000).toFixed(1);
        summary += `- ✅ ${result.memberName} (処理時間: ${durationSec}秒)\n`;
      }
      summary += '\n';
    }

    if (failed.length > 0) {
      summary += '## 失敗したメンバー\n\n';
      for (const result of failed) {
        summary += `- ❌ ${result.memberName}\n`;
        summary += `  - エラー: ${result.error}\n`;
      }
      summary += '\n';
    }

    summary += '## 統計情報\n\n';
    summary += `- 平均処理時間: ${(avgDuration / 1000).toFixed(1)}秒\n`;
    summary += `- 総処理時間: ${(totalDuration / 1000).toFixed(1)}秒\n`;

    return summary;
  }

  /**
   * バッチ生成用の出力ディレクトリを作成
   * @param baseDir 基準ディレクトリ
   * @returns 作成されたディレクトリパス
   */
  private async createOutputDirectory(baseDir: string): Promise<string> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .replace('T', '_')
      .slice(0, 15); // YYYYMMDD_HHMMSS

    const batchDir = join(process.cwd(), baseDir, `batch_${timestamp}`);
    await mkdir(batchDir, { recursive: true });

    return batchDir;
  }

  /**
   * 個別アジェンダをファイルに保存
   * @param output アジェンダ出力
   * @param outputDir 出力ディレクトリ
   */
  private async saveAgenda(
    output: import('../model/agenda.js').AgendaOutput,
    outputDir: string
  ): Promise<void> {
    const fileName =
      generateAgendaFilename(output.metadata.memberName, output.metadata.periodEnd) +
      '.md';
    const filePath = join(outputDir, fileName);

    await writeFile(filePath, output.markdown, 'utf-8');
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    await this.agent.cleanup();
  }
}
