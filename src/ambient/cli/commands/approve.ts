import { getGlobalDatabaseConnection } from '../../storage/database.js';
import { JobRepository } from '../../storage/job-repository.js';
import { TaskRepository } from '../../storage/task-repository.js';
import { JobOrchestrator } from '../../master/job-orchestrator.js';
import { TaskQueue } from '../../master/task-queue.js';
import type { AmbientConfig } from '../../../config/ambient-config.js';

/**
 * approveコマンド - Jobを承認する
 * @param config Ambient Agent設定
 * @param jobId Job ID
 */
export async function approveCommand(
  config: AmbientConfig,
  jobId: string
): Promise<void> {
  console.log(`🔍 Job ${jobId} を承認します...\n`);

  try {
    // データベース接続
    const db = await getGlobalDatabaseConnection(config.dbPath);
    const jobRepository = new JobRepository(db);
    const taskRepository = new TaskRepository(db);

    // JobOrchestratorを初期化
    const taskQueue = new TaskQueue(taskRepository);
    const jobOrchestrator = new JobOrchestrator(
      jobRepository,
      taskRepository,
      taskQueue
    );

    // Jobを取得して表示
    const job = await jobRepository.findById(jobId);
    if (!job) {
      console.error(`❌ Job not found: ${jobId}`);
      throw new Error(`Job not found: ${jobId}`);
    }

    console.log('--- Job情報 ---');
    console.log(`参加者: ${job.attendeeName} (${job.attendeeEmail})`);
    console.log(`開始日時: ${new Date(job.startAt).toLocaleString('ja-JP')}`);
    console.log(`現在の状態: ${job.status}`);
    console.log();

    // 承認可能な状態かチェック
    if (job.status !== 'SENT_PREVIEW') {
      console.error(`❌ Jobは承認できません。現在の状態: ${job.status}`);
      console.error('   承認できるのはSENT_PREVIEW状態のJobのみです。');
      throw new Error(`Job cannot be approved in ${job.status} status`);
    }

    // Jobを承認
    await jobOrchestrator.approveAgenda(jobId);

    console.log(`✅ Job ${jobId} を承認しました`);
    console.log(`   状態: SENT_PREVIEW → APPROVED`);
  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    if (error instanceof Error) {
      console.error(error.message);

      if (process.env.DEBUG) {
        console.error('\nスタックトレース:');
        console.error(error.stack);
      }
    } else {
      console.error(String(error));
    }
    throw error;
  }
}
