import type { JobRepository } from '../storage/job-repository.js';
import type { TaskRepository } from '../storage/task-repository.js';
import type { TaskQueue } from './task-queue.js';
import type { Source } from '../storage/types.js';
import type { AgendaService } from '../service/agenda-service.js';

/**
 * JobOrchestrator - Job状態管理とタスク制御を統括する
 */
export class JobOrchestrator {
  constructor(
    private jobRepository: JobRepository,
    private taskRepository: TaskRepository,
    private taskQueue: TaskQueue,
    private agendaService?: AgendaService
  ) {}

  /**
   * Factsを収集する
   * @param jobId JobのID
   * @param sources 収集する情報源のリスト
   */
  async collectFacts(jobId: string, sources: Source[]): Promise<void> {
    // Jobを取得
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // ステータスをCOLLECTINGに更新
    await this.jobRepository.updateStatus(job.id, 'COLLECTING');

    // sourcesごとにTaskを作成（冪等）
    const taskIds: string[] = [];
    for (const source of sources) {
      const idempotencyKey = `${jobId}|${source}`;
      let task = await this.taskRepository.findByIdempotencyKey(idempotencyKey);

      if (!task) {
        task = await this.taskRepository.create({
          jobId,
          source,
          status: 'QUEUED',
          priority: 0,
        });
      }

      taskIds.push(task.id);
    }

    // TaskQueueを使ってTasksを並列実行
    await this.taskQueue.executeTasks(taskIds, job);
  }

  /**
   * Agendaを生成する
   * @param jobId JobのID
   */
  async generateAgenda(jobId: string): Promise<void> {
    // AgendaServiceが未設定の場合はスキップ
    if (!this.agendaService) {
      return;
    }

    // Jobを取得
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // 期間を計算（startAtから14日前まで）
    const endDate = new Date(job.startAt);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 14);

    const member = {
      id: job.attendeeEmail, // メンバーIDとしてemailを使用
      name: job.attendeeName || job.attendeeEmail,
    };

    const period = {
      start: startDate.toISOString().split('T')[0], // YYYY-MM-DD
      end: endDate.toISOString().split('T')[0],
    };

    // AgendaServiceを呼び出してAgendaを生成
    await this.agendaService.generateAgendaFromFacts(jobId, member, period);
  }
}
