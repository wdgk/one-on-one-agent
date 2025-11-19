import Anthropic from '@anthropic-ai/sdk';
import { LLMClient } from './types.js';
import { getConfig } from '../config.js';
import { CLAUDE_API } from '../constants.js';

export class ClaudeClient implements LLMClient {
    private client: Anthropic;

    constructor() {
        const config = getConfig();
        this.client = new Anthropic({
            apiKey: config.anthropic.apiKey,
        });
    }

    async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
        const message = await this.client.messages.create({
            model: CLAUDE_API.MODEL,
            max_tokens: 4096, // 共通の十分な値
            messages: [
                {
                    role: 'user',
                    content: userPrompt,
                },
            ],
            system: systemPrompt,
        });

        const content = message.content[0];
        if (content.type !== 'text') {
            throw new Error('予期しないレスポンス形式です');
        }

        return content.text;
    }
}
