import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { getConfig } from '../config.js';
import type { CalendarEvent, MeetingStats } from '../model/calendar.js';
import { convertToCalendarEvent, calculateMeetingStats } from './helpers.js';

/**
 * Google Calendarクライアント
 * Google Calendar APIを使用してイベント情報を取得する
 */
export class CalendarClient {
  private auth: OAuth2Client | null = null;
  private calendar: calendar_v3.Calendar | null = null;
  private connected: boolean = false;

  /**
   * Calendar連携が利用可能かどうかを判定
   * @returns 認証情報が設定されている場合はtrue
   */
  isAvailable(): boolean {
    const config = getConfig();
    return !!(config.calendar && config.calendar.credentialsPath);
  }

  /**
   * Google Calendar APIに接続する
   * @throws Error 認証情報が設定されていない場合
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const config = getConfig();

    if (!config.calendar.credentialsPath) {
      throw new Error(
        'GOOGLE_CALENDAR_CREDENTIALS_PATHが設定されていません。\n' +
        '設定方法: .envファイルにGOOGLE_CALENDAR_CREDENTIALS_PATH=./credentials.jsonを追加してください。'
      );
    }

    try {
      // 認証情報ファイルを読み込む
      const credentialsContent = await readFile(config.calendar.credentialsPath, 'utf-8');
      const credentials = JSON.parse(credentialsContent);

      const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

      this.auth = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

      // トークンファイルが存在する場合は読み込む
      const tokenPath = config.calendar.tokenPath || './token.json';
      if (existsSync(tokenPath)) {
        const tokenContent = await readFile(tokenPath, 'utf-8');
        const token = JSON.parse(tokenContent);
        this.auth.setCredentials(token);
      } else {
        // トークンが存在しない場合は認証が必要
        throw new Error(
          'Google Calendar のトークンファイルが見つかりません。\n' +
          '初回認証が必要です。詳細はREADMEを参照してください。\n' +
          `トークンパス: ${tokenPath}`
        );
      }

      this.calendar = google.calendar({ version: 'v3', auth: this.auth });
      this.connected = true;

      console.log('Google Calendar APIに接続しました');
    } catch (error) {
      throw new Error(`Google Calendar接続エラー: ${error}`);
    }
  }

  /**
   * 接続を切断する
   */
  async disconnect(): Promise<void> {
    this.auth = null;
    this.calendar = null;
    this.connected = false;
  }

  /**
   * 指定期間内のイベントを取得
   * @param _userEmail ユーザーのメールアドレス（現在は未使用、将来的に複数カレンダーサポート用）
   * @param start 開始日時
   * @param end 終了日時
   * @returns イベント配列
   */
  async getEventsInPeriod(
    _userEmail: string,
    start: Date,
    end: Date
  ): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      throw new Error('Google Calendar APIに接続されていません。connect()を先に呼び出してください。');
    }

    const events: CalendarEvent[] = [];
    let pageToken: string | undefined;

    try {
      do {
        const response = await this.calendar.events.list({
          calendarId: 'primary',
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          maxResults: 250,
          singleEvents: true,
          orderBy: 'startTime',
          pageToken,
        });

        const items = response.data.items || [];

        for (const rawEvent of items) {
          // rawEventの型はcalendar_v3.Schema$Event
          // idがnullableなので、存在チェックを行う
          if (!rawEvent.id) {
            continue;
          }

          const event = convertToCalendarEvent(rawEvent as any);
          if (event) {
            events.push(event);
          }
        }

        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      return events;
    } catch (error) {
      console.error(`Calendarイベント取得エラー: ${error}`);
      return [];
    }
  }

  /**
   * イベント一覧から会議統計を計算する
   * @param events イベント配列
   * @returns 会議統計
   */
  async getMeetingStats(events: CalendarEvent[]): Promise<MeetingStats> {
    return calculateMeetingStats(events);
  }

  /**
   * OAuth2認証フローを実行してトークンを取得する
   * （初回認証時に使用）
   * @param code 認証コード
   */
  async getTokenFromCode(code: string): Promise<void> {
    if (!this.auth) {
      throw new Error('OAuth2Clientが初期化されていません。');
    }

    const config = getConfig();
    const tokenPath = config.calendar.tokenPath || './token.json';

    try {
      const { tokens } = await this.auth.getToken(code);
      this.auth.setCredentials(tokens);

      // トークンをファイルに保存
      await writeFile(tokenPath, JSON.stringify(tokens, null, 2));
      console.log(`トークンを保存しました: ${tokenPath}`);
    } catch (error) {
      throw new Error(`トークン取得エラー: ${error}`);
    }
  }

  /**
   * 認証URLを生成する
   * （初回認証時に使用）
   */
  generateAuthUrl(): string {
    if (!this.auth) {
      throw new Error('OAuth2Clientが初期化されていません。');
    }

    const authUrl = this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    return authUrl;
  }
}
