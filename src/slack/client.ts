/**
 * Slackクライアント（プレースホルダー実装）
 * 実際の実装はfeature/11-slack-integrationブランチで追加予定
 */
export class SlackClient {
  /**
   * Slack連携が利用可能かどうかを判定
   * @returns 現在は常にfalseを返す（未実装）
   */
  isAvailable(): boolean {
    return false;
  }

  /**
   * メールアドレスからSlackユーザーIDを検索
   * @param _email メールアドレス
   * @returns ユーザーID（未実装のため常にnullを返す）
   */
  async findUserByEmail(_email: string): Promise<string | null> {
    return null;
  }

  /**
   * 指定期間内のメッセージを取得
   * @param _userId SlackユーザーID
   * @param _start 開始日時
   * @param _end 終了日時
   * @returns メッセージ配列（未実装のため常に空配列を返す）
   */
  async getMessagesInPeriod(
    _userId: string,
    _start: Date,
    _end: Date
  ): Promise<any[]> {
    return [];
  }
}
