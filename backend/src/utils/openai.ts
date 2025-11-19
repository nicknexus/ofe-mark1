import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load .env from project root (one level up from backend)
dotenv.config({ path: process.env.NODE_ENV === 'production' ? undefined : '../.env' });

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.warn('⚠️  OPENAI_API_KEY not set. Report generation will not work.');
}

export const openai = apiKey ? new OpenAI({
    apiKey: apiKey,
}) : null;

export const isOpenAIConfigured = () => !!openai;

