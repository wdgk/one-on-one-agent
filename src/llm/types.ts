/**
 * LLMクライアントの共通インターフェース
 */
export interface LLMClient {
    /**
     * テキスト生成を行う
     * @param systemPrompt システムプロンプト
     * @param userPrompt ユーザープロンプト
     * @returns 生成されたテキスト
     */
    generateText(systemPrompt: string, userPrompt: string): Promise<string>;
}
