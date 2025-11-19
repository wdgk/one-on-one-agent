import { LLMClient } from './types.js';
import { ClaudeClient } from './claude-client.js';
import { GeminiClient } from './gemini-client.js';
import { getConfig } from '../config.js';

export function createLLMClient(): LLMClient {
    const config = getConfig();

    if (config.llmProvider === 'gemini') {
        return new GeminiClient();
    }

    return new ClaudeClient();
}
