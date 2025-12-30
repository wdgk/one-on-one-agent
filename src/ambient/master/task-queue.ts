import type { TaskRepository } from '../storage/task-repository.js';
import type { Worker, WorkerContext } from '../workers/types.js';
import type { Job } from '../storage/types.js';

/**
 * TaskQueue - Taskの並列実行とリトライ制御を担当する
 */
export class TaskQueue {
  private workers: Map<string, Worker> = new Map();

  constructor(
    private taskRepository: TaskRepository
  ) {}

  /**
   * Workerを登録する
   * @param worker Worker実装
   */
  registerWorker(worker: Worker): void {
    this.workers.set(worker.getSource(), worker);
  }

  /**
   * 登録されているWorkerのリストを取得する
   * @returns Worker配列
   */
  getWorkers(): Worker[] {
    return Array.from(this.workers.values());
  }

  /**
   * Taskを実行する
   * @param taskId TaskのID
   * @param job 対象のJob
   */
  async executeTask(taskId: string, job: Job): Promise<void> {
    // Taskを取得
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Workerを取得
    const worker = this.workers.get(task.source);
    if (!worker) {
      throw new Error(`Worker not found for source: ${task.source}`);
    }

    try {
      // ステータスをRUNNINGに更新
      await this.taskRepository.updateStatus(task.id, 'RUNNING');

      // Workerを実行
      const context: WorkerContext = {
        job,
        task,
        periodStart: this.calculatePeriodStart(job),
        periodEnd: job.startAt,
      };

      const result = await worker.collect(context);

      // 結果に基づいてステータスを更新
      if (result.error) {
        await this.taskRepository.updateStatus(task.id, 'FAILED', result.error);
      } else {
        await this.taskRepository.updateStatus(task.id, 'DONE');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.taskRepository.updateStatus(task.id, 'FAILED', errorMessage);
      throw error;
    }
  }

  /**
   * 複数のTaskを実行する
   * @param taskIds TaskのID配列
   * @param job 対象のJob
   */
  async executeTasks(taskIds: string[], job: Job): Promise<void> {
    // すべてのTaskを並列実行（一部が失敗しても他は実行を継続）
    await Promise.allSettled(
      taskIds.map(taskId => this.executeTask(taskId, job))
    );
  }

  /**
   * 収集期間の開始日時を計算する
   * @param job Job
   * @returns 開始日時（ISO 8601）
   */
  private calculatePeriodStart(job: Job): string {
    // デフォルトは14日前
    const lookbackDays = 14;
    const startDate = new Date(job.startAt);
    startDate.setDate(startDate.getDate() - lookbackDays);
    return startDate.toISOString();
  }
}
