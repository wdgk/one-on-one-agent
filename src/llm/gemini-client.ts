import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMClient } from './types.js';
import { getConfig } from '../config.js';

export class GeminiClient implements LLMClient {
    private genAI: GoogleGenerativeAI;
    // Gemini 3 (or latest experimental) model name
    // Note: "gemini-2.0-flash-exp" is the current experimental model often referred to as next gen
    // If user specifically wants "Gemini 3", we might need to wait for release, but for now using the latest flash exp
    private modelName = 'gemini-2.0-flash-exp';

    constructor() {
        const config = getConfig();
        if (!config.gemini.apiKey) {
            throw new Error('Gemini API key is not configured');
        }
        this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    }

    async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
        const model = this.genAI.getGenerativeModel({
            model: this.modelName,
            systemInstruction: systemPrompt,
        });

        const result = await model.generateContent(userPrompt);
        const response = await result.response;
        return response.text();
    }
}
