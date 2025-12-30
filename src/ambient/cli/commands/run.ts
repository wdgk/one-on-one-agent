import { getGlobalDatabaseConnection } from '../../storage/database.js';
import { JobRepository } from '../../storage/job-repository.js';
import { TaskRepository } from '../../storage/task-repository.js';
import { FactRepository } from '../../storage/fact-repository.js';
import { ArtifactRepository } from '../../storage/artifact-repository.js';
import { Scheduler } from '../../master/scheduler.js';
import { TaskQueue } from '../../master/task-queue.js';
import { JobOrchestrator } from '../../master/job-orchestrator.js';
import { SlackCollector } from '../../workers/slack-collector.js';
import { BacklogCollector } from '../../workers/backlog-collector.js';
import { CalendarCollector } from '../../workers/calendar-collector.js';
import { FactTransformer } from '../../transform/fact-transformer.js';
import { AgendaService } from '../../service/agenda-service.js';
import { CalendarClient } from '../../../calendar/client.js';
import { SlackClient } from '../../../slack/client.js';
import { BacklogClient } from '../../../backlog/client.js';
import { OneOnOneAgendaAgent } from '../../../agent.js';
import type { AmbientConfig } from '../../../config/ambient-config.js';

/**
 * runコマンド - カレンダーから1on1を抽出してJobを作成し、オプションでアジェンダを生成する
 * @param config Ambient Agent設定
 * @param options コマンドオプション
 */
export async function runCommand(
  config: AmbientConfig,
  options: {
    lookaheadHours?: number;
    dryRun?: boolean;
    generateAgenda?: boolean;
  }
): Promise<void> {
  console.log('🚀 Ambient Agent を実行します...\n');

  if (options.dryRun) {
    console.log('🧪 ドライランモード: Jobの作成のみを実行します\n');
  }

  if (options.generateAgenda) {
    console.log('📝 アジェンダ生成モード: Facts収集とアジェンダ生成を実行します\n');
  }

  // クライアント変数をtry外で宣言（cleanup用）
  let calendarClient: CalendarClient | null = null;
  let slackClient: SlackClient | null = null;
  let backlogClient: BacklogClient | null = null;

  try {
    // データベース接続
    console.log('📊 データベースに接続中...');
    const db = await getGlobalDatabaseConnection(config.dbPath);
    const jobRepository = new JobRepository(db);
    const taskRepository = new TaskRepository(db);
    const factRepository = new FactRepository(db);
    const artifactRepository = new ArtifactRepository(db);
    console.log('✅ データベース接続完了\n');

    // Calendarクライアント初期化
    console.log('📅 カレンダークライアントを初期化中...');
    calendarClient = new CalendarClient();
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

    // アジェンダ生成モードの場合、Facts収集とアジェンダ生成を実行
    if (options.generateAgenda && jobs.length > 0) {
      console.log('\n🔧 Facts収集とアジェンダ生成を開始します...\n');

      // 他のクライアントを初期化
      console.log('💬 Slackクライアントを初期化中...');
      slackClient = new SlackClient();
      if (slackClient.isAvailable()) {
        await slackClient.connect();
        console.log('✅ Slackクライアント初期化完了');
      } else {
        console.log('⚠️  Slack設定がありません（スキップ）');
      }

      console.log('📋 Backlogクライアントを初期化中...');
      backlogClient = new BacklogClient();
      await backlogClient.connect();
      console.log('✅ Backlogクライアント初期化完了\n');

      // TaskQueueとWorkersを初期化
      const taskQueue = new TaskQueue(taskRepository);
      if (slackClient.isAvailable()) {
        taskQueue.registerWorker(new SlackCollector(slackClient, factRepository));
      }
      taskQueue.registerWorker(new BacklogCollector(backlogClient, factRepository));
      taskQueue.registerWorker(new CalendarCollector(calendarClient, factRepository));

      // AgendaServiceを初期化
      const factTransformer = new FactTransformer();
      const agendaAgent = new OneOnOneAgendaAgent(
        backlogClient,
        undefined, // parameterParser (デフォルトを使用)
        undefined, // agendaGenerator (デフォルトを使用)
        slackClient,
        calendarClient
      );
      const agendaService = new AgendaService(
        factRepository,
        artifactRepository,
        factTransformer,
        agendaAgent
      );

      // JobOrchestratorを初期化
      const jobOrchestrator = new JobOrchestrator(
        jobRepository,
        taskRepository,
        taskQueue,
        agendaService
      );

      // 各Jobに対してFacts収集とアジェンダ生成を実行
      for (const job of jobs) {
        console.log(`\n🔍 [${job.attendeeName}] Facts収集中...`);

        try {
          // Facts収集（Slack利用可能な場合のみslackを含める）
          const sources = slackClient.isAvailable()
            ? ['slack', 'backlog', 'calendar']
            : ['backlog', 'calendar'];
          await jobOrchestrator.collectFacts(job.id, sources);
          console.log(`✅ [${job.attendeeName}] Facts収集完了`);

          // アジェンダ生成
          console.log(`📝 [${job.attendeeName}] アジェンダ生成中...`);
          await jobOrchestrator.generateAgenda(job.id);
          console.log(`✅ [${job.attendeeName}] アジェンダ生成完了`);
        } catch (error) {
          console.error(`❌ [${job.attendeeName}] エラー: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      console.log('\n✅ 全Jobの処理が完了しました');
    }

    console.log('\n✅ 実行完了');
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
  } finally {
    // クリーンアップ
    if (calendarClient) {
      await calendarClient.disconnect();
    }
    if (slackClient) {
      await slackClient.disconnect();
    }
    if (backlogClient) {
      await backlogClient.disconnect();
    }
  }
}
