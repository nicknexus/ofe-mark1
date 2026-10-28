import { openai, isOpenAIConfigured } from '../utils/openai';

export const MAX_CLEANUP_CHARS = 4000;

export class WritingAssistError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

const CLEANUP_PROMPT = `You tidy up short activity descriptions written by nonprofit staff for an impact log.
Fix spelling, grammar and punctuation, and make it read clearly in 1 to 4 plain sentences.
Keep every fact, number, name and place exactly as given. Do not add facts, praise, hashtags or emojis.
Keep the writer's language and regional spelling (for example British "centre" stays "centre"). Never use em dashes.
Reply with the cleaned description only.`;

export class WritingAssistService {
    static async cleanUpDescription(text: unknown): Promise<string> {
        const input = typeof text === 'string' ? text.trim() : '';
        if (!input) throw new WritingAssistError(400, 'Write something first.');
        if (input.length > MAX_CLEANUP_CHARS) throw new WritingAssistError(400, `Keep it under ${MAX_CLEANUP_CHARS} characters.`);
        if (!isOpenAIConfigured() || !openai) throw new WritingAssistError(503, 'AI cleanup is not configured.');

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            max_tokens: 600,
            messages: [
                { role: 'system', content: CLEANUP_PROMPT },
                { role: 'user', content: input },
            ],
        });
        const cleaned = (completion.choices[0]?.message?.content || '').trim().replace(/\u2014/g, ', ');
        if (!cleaned) throw new WritingAssistError(502, 'The AI did not return a description. Try again.');
        return cleaned;
    }
}
