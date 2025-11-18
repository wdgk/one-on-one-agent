/**
 * MCP レスポンス処理のヘルパー関数
 */

/**
 * MCP ツール呼び出し結果からテキスト内容を抽出する
 * @param content MCP レスポンスの content 配列
 * @returns 抽出されたテキスト
 * @throws content が空または text タイプでない場合
 */
export function extractTextFromMcpResponse(
  content: Array<{ type: string; text?: string }>
): string {
  if (!content || content.length === 0) {
    throw new Error('MCP レスポンスが空です');
  }

  const firstContent = content[0];
  if (firstContent.type !== 'text' || !firstContent.text) {
    throw new Error('MCP レスポンスに text コンテンツが含まれていません');
  }

  return firstContent.text;
}

/**
 * MCP レスポンスから JSON をパースする
 * @param content MCP レスポンスの content 配列
 * @param errorContext エラー時のコンテキスト情報
 * @returns パースされた JSON オブジェクト
 */
export function parseJsonFromMcpResponse<T>(
  content: Array<{ type: string; text?: string }>,
  errorContext: string
): T {
  const responseText = extractTextFromMcpResponse(content);

  try {
    // 制御文字を除去（ただし改行、キャリッジリターン、タブは保持）
    const cleanedText = responseText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return JSON.parse(cleanedText);
  } catch (error) {
    // JSONが途中で切れている場合、修復を試みる
    if (error instanceof Error) {
      try {
        // 制御文字を除去
        let repairedText = responseText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

        // 配列が途中で切れている場合、最後の完全なオブジェクトまで切り詰める
        // パターン1: },\n  { で次のオブジェクトが始まっている場合
        const lastCompletePattern1 = repairedText.lastIndexOf('},\n  {');
        // パターン2: } だけで終わっている場合
        const lastCompletePattern2 = repairedText.lastIndexOf('}\n]');

        let cutoffIndex = -1;

        if (lastCompletePattern2 > 0) {
          // 既に閉じられている場合はそのまま
          cutoffIndex = lastCompletePattern2 + 3; // '}\n]'.length
        } else if (lastCompletePattern1 > 0) {
          // 最後の完全なオブジェクトの後ろで切り詰め
          cutoffIndex = lastCompletePattern1 + 1; // '},' の後ろ
        } else {
          // 単純に最後の }, を探す
          const simplePattern = repairedText.lastIndexOf('},');
          if (simplePattern > 0) {
            cutoffIndex = simplePattern + 1;
          }
        }

        if (cutoffIndex > 0) {
          repairedText = repairedText.substring(0, cutoffIndex) + '\n]';
          return JSON.parse(repairedText);
        }
      } catch (repairError) {
        // 修復も失敗した場合は元のエラーを投げる
      }
    }

    throw new Error(
      `${errorContext}: ${error instanceof Error ? error.message : String(error)}\n` +
      `レスポンスサイズ: ${responseText.length}文字\n` +
      `レスポンス先頭200文字: ${responseText.substring(0, 200)}\n` +
      `レスポンス末尾200文字: ${responseText.substring(Math.max(0, responseText.length - 200))}`
    );
  }
}
