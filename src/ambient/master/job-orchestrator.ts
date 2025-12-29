import type { JobRepository } from '../storage/job-repository.js';
import type { TaskRepository } from '../storage/task-repository.js';
import type { TaskQueue } from './task-queue.js';
import type { Source } from '../storage/types.js';

/**
 * JobOrchestrator - Job状態管理とタスク制御を統括する
 */
export class JobOrchestrator {
  constructor(
    private jobRepository: JobRepository,
    private taskRepository: TaskRepository,
    private taskQueue: TaskQueue
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
}
