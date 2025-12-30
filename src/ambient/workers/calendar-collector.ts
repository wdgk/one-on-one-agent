import type { CalendarClient } from '../../calendar/client.js';
import type { FactRepository } from '../storage/fact-repository.js';
import type { Worker, WorkerContext, WorkerResult } from './types.js';
import type { Source } from '../storage/types.js';

/**
 * CalendarCollector - Calendarイベントと統計を収集してFactsを生成する
 */
export class CalendarCollector implements Worker {
  constructor(
    private calendarClient: CalendarClient,
    private factRepository: FactRepository
  ) {}

  /**
   * Worker名を取得する
   * @returns Worker名
   */
  getName(): string {
    return 'CalendarCollector';
  }

  /**
   * ソースを取得する
   * @returns ソース種別
   */
  getSource(): Source {
    return 'calendar';
  }

  /**
   * Calendarイベントと統計を収集してFactsを生成する
   * @param context Worker実行コンテキスト
   * @returns Worker実行結果
   */
  async collect(context: WorkerContext): Promise<WorkerResult> {
    try {
      const { job, periodStart, periodEnd } = context;

      // CalendarClientが利用不可の場合はスキップ
      if (!this.calendarClient.isAvailable()) {
        return {
          facts: [],
          count: 0,
        };
      }

      // イベントを取得
      const events = await this.calendarClient.getEventsInPeriod(
        job.attendeeEmail,
        new Date(periodStart),
        new Date(periodEnd)
      );

      // 統計を計算
      const stats = await this.calendarClient.getMeetingStats(events);

      const facts = [];

      // イベントをFactsに変換
      for (const event of events) {
        const url = event.htmlLink || `calendar://event/${event.id}`;

        // 既に同じURLのFactが存在するかチェック（冪等性）
        const existing = await this.factRepository.findByUrl(job.id, url);
        if (existing) {
          continue; // 既に存在する場合はスキップ
        }

        const fact = await this.factRepository.create({
          jobId: job.id,
          source: 'calendar',
          occurredAt: event.start,
          summary: `${event.eventType}: ${event.summary}`,
          url,
          confidence: 1.0,
          score: 1.0,
          rawRef: JSON.stringify(event),
        });
        facts.push(fact);
      }

      // 統計をFactとして保存
      const statsUrl = 'calendar://stats';
      const existingStats = await this.factRepository.findByUrl(job.id, statsUrl);
      if (!existingStats) {
        const statsFact = await this.factRepository.create({
          jobId: job.id,
          source: 'calendar',
          occurredAt: periodStart,
          summary: 'Meeting Statistics',
          url: statsUrl,
          confidence: 1.0,
          score: 1.0,
          rawRef: JSON.stringify({
            _type: 'stats',
            ...stats,
          }),
        });
        facts.push(statsFact);
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
