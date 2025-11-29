import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } from '@adiwajshing/baileys';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import dotenv from 'dotenv';
import pino from 'pino';
// Import Features
import autoStatus from './features/autoStatus.js';
import geminiChat from './features/gemini.js';
import alwaysOnline from './features/alwaysOnline.js';
import menu from './features/menu.js';
dotenv.config();
const SESSION_DIR = './session';
const SESSION_ID = process.env.SESSION_ID;
// Restore session from ENV if available (Deployment Mode)
if (SESSION_ID && !fs.existsSync(SESSION_DIR + '/creds.json')) {
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR);
    fs.writeFileSync(SESSION_DIR + '/creds.json', Buffer.from(SESSION_ID, 'base64'));
}
async function start() {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: !SESSION_ID, // Only print QR if no session ID provided
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS("SafariVybe"),
        syncFullHistory: false
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) start();
        } 
        else if (connection === 'open') {
            console.log('Bot Connected');
            
            const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            // 1. If running locally (Generating Session)
            if (!SESSION_ID) {
                const sessionData = fs.readFileSync(SESSION_DIR + '/creds.json');
                const b64Session = Buffer.from(sessionData).toString('base64');
                
                await sock.sendMessage(botNumber, { 
                    text: `*SESSION ID GENERATED* 🔑\n\nCopy the code below for deployment:\n\n${b64Session}` 
                });
            } 
            // 2. If running in production (Koyeb)
            else {
                await sock.sendMessage(botNumber, { text: '✅ *Successfully deployed!*\n\nType *,menu* to start.' });
            }
        }
    });
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        // Load Features
        await autoStatus(sock, m);
        await geminiChat(sock, m);
        await menu(sock, m);
    });
    
    // Start background tasks
    alwaysOnline(sock);
}
start();
