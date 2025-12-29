import { getGlobalDatabaseConnection } from '../../storage/database.js';
import { JobRepository } from '../../storage/job-repository.js';
import { Scheduler } from '../../master/scheduler.js';
import { CalendarClient } from '../../../calendar/client.js';
import type { AmbientConfig } from '../../../config/ambient-config.js';

/**
 * runコマンド - カレンダーから1on1を抽出してJobを作成する
 * @param config Ambient Agent設定
 * @param options コマンドオプション
 */
export async function runCommand(
  config: AmbientConfig,
  options: {
    lookaheadHours?: number;
    dryRun?: boolean;
  }
): Promise<void> {
  console.log('🚀 Ambient Agent を実行します...\n');

  if (options.dryRun) {
    console.log('🧪 ドライランモード: Jobの作成のみを実行します\n');
  }

  try {
    // データベース接続
    console.log('📊 データベースに接続中...');
    const db = await getGlobalDatabaseConnection(config.dbPath);
    const jobRepository = new JobRepository(db);
    console.log('✅ データベース接続完了\n');

    // Calendarクライアント初期化
    console.log('📅 カレンダークライアントを初期化中...');
    const calendarClient = new CalendarClient();
    if (!calendarClient.isAvailable()) {
      throw new Error(
        'Google Calendarの設定が不足しています。\n' +
        'GOOGLE_CALENDAR_CREDENTIALS_PATH と GOOGLE_CALENDAR_TOKEN_PATH を設定してください。'
      );
    }
    await calendarClient.connect();
    console.log('✅ カレンダークライアント初期化完了\n');

    // Scheduler初期化
    const scheduler = new Scheduler(calendarClient, jobRepository, {
      lookaheadHours: options.lookaheadHours || config.lookaheadHours,
      internalDomain: config.internalDomain,
    });

    // Jobスケジューリング
    console.log(`🔍 カレンダーから1on1を抽出中（先読み: ${options.lookaheadHours || config.lookaheadHours}時間）...`);
    const jobs = await scheduler.scheduleJobs(config.myEmail);
    console.log(`✅ ${jobs.length}件の1on1をスケジュールしました\n`);

    // 結果表示
    if (jobs.length === 0) {
      console.log('📝 スケジュールされた1on1はありません。');
    } else {
      console.log('--- スケジュールされた1on1 ---');
      for (const job of jobs) {
        const startDate = new Date(job.startAt).toLocaleString('ja-JP');
        console.log(`- [${job.status}] ${job.attendeeName} (${job.attendeeEmail})`);
        console.log(`  開始日時: ${startDate}`);
        console.log(`  Job ID: ${job.id}`);
        console.log();
      }
    }

    // クリーンアップ
    await calendarClient.disconnect();

    console.log('✅ 実行完了');
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
