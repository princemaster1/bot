import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
dotenv.config();

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

export default async function geminiChat(sock, m) {
    const text = m.message.conversation || m.message.extendedTextMessage?.text || "";
    const prefix = ',ai ';

    if (text.toLowerCase().startsWith(prefix)) {
        if (!ai) {
             await sock.sendMessage(m.key.remoteJid, { text: '❌ API Key not found.' }, { quoted: m });
             return;
        }
        
        const prompt = text.slice(prefix.length);
        await sock.sendMessage(m.key.remoteJid, { react: { text: '🧠', key: m.key } });

        try {
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            await sock.sendMessage(m.key.remoteJid, { text: result.text }, { quoted: m });
        } catch (error) {
            await sock.sendMessage(m.key.remoteJid, { text: 'Error connecting to AI.' }, { quoted: m });
        }
    }
}