import { LLMClient } from './types.js';
import { BedrockClient } from './bedrock-client.js';

/**
 * LLMクライアントを生成する
 * AWS Bedrock経由でClaudeを利用
 */
export function createLLMClient(): LLMClient {
    return new BedrockClient();
}
