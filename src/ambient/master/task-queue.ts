import pLimit from 'p-limit';
import type { TaskRepository } from '../storage/task-repository.js';
import type { Worker, WorkerContext } from '../workers/types.js';
import type { Job } from '../storage/types.js';

/**
 * TaskQueueのオプション
 */
export interface TaskQueueOptions {
  /** 並列実行の上限数 */
  concurrencyLimit?: number;
  /** 収集期間の遡り日数 */
  lookbackDays?: number;
}

/**
 * タスク実行結果のサマリ
 */
export interface TaskExecutionResult {
  /** 成功したタスク数 */
  succeeded: number;
  /** 失敗したタスク数 */
  failed: number;
  /** 失敗したタスクの詳細 */
  failedTasks: Array<{ taskId: string; error: string }>;
}

/**
 * TaskQueue - Taskの並列実行とリトライ制御を担当する
 */
export class TaskQueue {
  private workers: Map<string, Worker> = new Map();
  private limit: ReturnType<typeof pLimit>;
  private lookbackDays: number;

  constructor(
    private taskRepository: TaskRepository,
    options: TaskQueueOptions = {}
  ) {
    this.limit = pLimit(options.concurrencyLimit ?? 5);
    this.lookbackDays = options.lookbackDays ?? 14;
  }

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

    try {
      // Workerを取得
      const worker = this.workers.get(task.source);
      if (!worker) {
        throw new Error(`Worker not found for source: ${task.source}`);
      }

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
        // エラーをthrowして呼び出し側に失敗を伝える（handleFailureはcatchブロックで呼ばれる）
        throw new Error(result.error);
      }

      await this.taskRepository.updateStatus(task.id, 'DONE');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.handleFailure(task.id, errorMessage);
      throw error;
    }
  }

  /**
   * Task失敗時の処理（リトライまたはFAILED）
   * @param taskId TaskのID
   * @param errorMessage エラーメッセージ
   */
  private async handleFailure(taskId: string, errorMessage: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      return;
    }

    // 現在のretryCountをチェック
    if (task.retryCount < task.maxRetries) {
      // リトライカウントを増やしてQUEUEDに戻す
      await this.taskRepository.incrementRetryCount(taskId);
      await this.taskRepository.updateStatus(taskId, 'QUEUED');
    } else {
      // maxRetries以上ならFAILED
      await this.taskRepository.updateStatus(taskId, 'FAILED', errorMessage);
    }
  }

  /**
   * 複数のTaskを実行する
   * @param taskIds TaskのID配列
   * @param job 対象のJob
   * @returns 実行結果のサマリ
   */
  async executeTasks(taskIds: string[], job: Job): Promise<TaskExecutionResult> {
    // p-limitで並列数を制限しつつ実行（一部が失敗しても他は実行を継続）
    const results = await Promise.allSettled(
      taskIds.map(taskId =>
        this.limit(() => this.executeTask(taskId, job))
      )
    );

    // 結果を集計
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const failedTasks: Array<{ taskId: string; error: string }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        failedTasks.push({
          taskId: taskIds[i],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    return { succeeded, failed, failedTasks };
  }

  /**
   * 収集期間の開始日時を計算する
   * @param job Job
   * @returns 開始日時（ISO 8601）
   */
  private calculatePeriodStart(job: Job): string {
    const startDate = new Date(job.startAt);
    startDate.setDate(startDate.getDate() - this.lookbackDays);
    return startDate.toISOString();
  }
}
