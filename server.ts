import React, { useState } from 'react';
import { Folder, FileCode, FileJson, FileText, Box, Copy, Check, Download, ChevronRight, ChevronDown } from 'lucide-react';
import JSZip from 'jszip';

// --- MOCK FILE CONTENT ---

const README_CONTENT = `# 📦 WhatsApp Bot (Baileys + Gemini AI)

## ⚠️ IMPORTANT
**DO NOT** copy the website code (RepoUI.tsx). Only use the files provided in this repository structure.

## 📱 Termux Setup (Generate Session)

1. **Install Dependencies**
\`\`\`bash
pkg update && pkg upgrade -y
pkg install git nodejs -y
\`\`\`

2. **Clone & Install**
\`\`\`bash
git clone https://github.com/username/my-whatsapp-bot
cd my-whatsapp-bot
npm install
\`\`\`

3. **Run Bot**
\`\`\`bash
node server.js
\`\`\`

4. **Scan QR**: Open WhatsApp > Linked Devices > Link a Device.
5. **Copy Session**: The bot will generate a file \`session/creds.json\`. It will also print a base64 string if running in "First Run" mode.

---

## 🚀 Deploy to Koyeb

1. **Fork this Repo** to GitHub.
2. **New Service** on Koyeb.
3. **Environment Variables**:
   - \`SESSION_ID\`: (The base64 string from Termux, or upload the creds.json content)
   - \`GEMINI_API_KEY\`: (From Google AI Studio)
`;

const SERVER_JS_CONTENT = `// 🤖 WHATSAPP BOT SERVER CODE
// Run this file using: node server.js

import makeWASocketImport, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
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

// FIX: Handle default export compatibility
const makeWASocket = makeWASocketImport.default || makeWASocketImport;

const SESSION_DIR = './session';
const SESSION_ID = process.env.SESSION_ID;

// Restore session from ENV if available (Deployment Mode)
if (SESSION_ID && !fs.existsSync(SESSION_DIR + '/creds.json')) {
    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR);
    fs.writeFileSync(SESSION_DIR + '/creds.json', Buffer.from(SESSION_ID, 'base64'));
}

async function start() {
    console.log('Starting Bot...');
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
            console.log('Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) start();
        } 
        else if (connection === 'open') {
            console.log('✅ Bot Connected');
            
            const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';

            // 1. If running locally (Generating Session)
            if (!SESSION_ID) {
                try {
                    const sessionData = fs.readFileSync(SESSION_DIR + '/creds.json');
                    const b64Session = Buffer.from(sessionData).toString('base64');
                    console.log('\\n👉 YOUR SESSION ID (COPY THIS):\\n' + b64Session + '\\n');
                    
                    await sock.sendMessage(botNumber, { 
                        text: \`*SESSION ID GENERATED* 🔑\\n\\nCopy for Koyeb:\\n\\n\${b64Session}\` 
                    });
                } catch (err) {
                    console.error('Could not read session file for ID generation.');
                }
            } 
            // 2. If running in production (Koyeb)
            else {
                await sock.sendMessage(botNumber, { text: '✅ *Successfully deployed!*\\n\\nType *,menu* to start.' });
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

start();`;

const PACKAGE_JSON_CONTENT = `{
  "name": "whatsapp-bot-baileys",
  "version": "1.0.0",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^6.6.0",
    "@google/genai": "*",
    "dotenv": "^16.3.1",
    "pino": "^8.0.0",
    "qrcode-terminal": "^0.12.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}`;

const DOCKERFILE_CONTENT = `FROM node:18-bullseye-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "start"]`;

const DOCKER_COMPOSE_CONTENT = `version: "3.8"
services:
  bot:
    build: .
    container_name: whatsapp_bot
    restart: always
    environment:
      - SESSION_ID=\${SESSION_ID}
      - GEMINI_API_KEY=\${GEMINI_API_KEY}
`;

// --- FEATURES ---

const FEATURE_MENU_CONTENT = `export default async function menu(sock, m) {
    const text = m.message.conversation || m.message.extendedTextMessage?.text || "";
    if (text.trim() === ',menu') {
        await sock.sendMessage(m.key.remoteJid, {
            text: \`*🤖 BOT MENU*
            
1. *,ai <text>* - Ask AI
2. *,status* - Check status
3. *,ping* - Ping bot

_Powered by Gemini 2.5_\`
        }, { quoted: m });
    }
}`;

const FEATURE_GEMINI_CONTENT = `import { GoogleGenAI } from "@google/genai";
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
}`;

const FEATURE_AUTOSTATUS_CONTENT = `export default async function autoStatus(sock, m) {
    if (m.key.remoteJid === 'status@broadcast') {
        await sock.readMessages([m.key]);
        console.log(\`Status viewed from \${m.key.participant}\`);
    }
}`;

const FEATURE_ALWAYSONLINE_CONTENT = `export default function alwaysOnline(sock) {
    setInterval(async () => {
        await sock.sendPresenceUpdate('available');
    }, 15000);
}`;

// --- FILE SYSTEM STRUCTURE ---

type FileType = 'file' | 'folder';

interface FileNode {
  name: string;
  type: FileType;
  content?: string;
  language?: string;
  children?: FileNode[];
  isOpen?: boolean;
}

const REPO_STRUCTURE: FileNode[] = [
  { name: '.dockerignore', type: 'file', content: 'node_modules\nsession\n.env', language: 'text' },
  { name: 'Dockerfile', type: 'file', content: DOCKERFILE_CONTENT, language: 'docker' },
  { name: 'README.md', type: 'file', content: README_CONTENT, language: 'markdown' },
  { name: 'docker-compose.yml', type: 'file', content: DOCKER_COMPOSE_CONTENT, language: 'yaml' },
  { 
    name: 'features', 
    type: 'folder', 
    isOpen: true,
    children: [
      { name: 'alwaysOnline.js', type: 'file', content: FEATURE_ALWAYSONLINE_CONTENT, language: 'javascript' },
      { name: 'autoStatus.js', type: 'file', content: FEATURE_AUTOSTATUS_CONTENT, language: 'javascript' },
      { name: 'gemini.js', type: 'file', content: FEATURE_GEMINI_CONTENT, language: 'javascript' },
      { name: 'menu.js', type: 'file', content: FEATURE_MENU_CONTENT, language: 'javascript' },
    ]
  },
  { name: 'package.json', type: 'file', content: PACKAGE_JSON_CONTENT, language: 'json' },
  { name: 'server.js', type: 'file', content: SERVER_JS_CONTENT, language: 'javascript' },
];

// --- COMPONENT ---

export const RepoUI: React.FC = () => {
  const [fileSystem, setFileSystem] = useState<FileNode[]>(REPO_STRUCTURE);
  // DEFAULT TO SERVER.JS SO USER SEES THE BOT CODE FIRST
  const [activeFile, setActiveFile] = useState<FileNode>(REPO_STRUCTURE[REPO_STRUCTURE.length - 1]); 
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const toggleFolder = (folderName: string) => {
    const newFS = [...fileSystem];
    const folder = newFS.find(f => f.name === folderName);
    if (folder) folder.isOpen = !folder.isOpen;
    setFileSystem(newFS);
  };

  const selectFile = (file: FileNode) => {
    setActiveFile(file);
  };

  const handleCopy = () => {
    if (activeFile.content) {
        navigator.clipboard.writeText(activeFile.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  const addToZip = (zip: JSZip, nodes: FileNode[]) => {
    nodes.forEach(node => {
      if (node.type === 'folder') {
        const folderZip = zip.folder(node.name);
        if (folderZip && node.children) {
          addToZip(folderZip, node.children);
        }
      } else {
        zip.file(node.name, node.content || '');
      }
    });
  };

  const handleDownloadRepo = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      addToZip(zip, fileSystem);
      
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "whatsapp-bot-baileys.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to generate zip", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.name} style={{ paddingLeft: `${depth * 12}px` }}>
        {node.type === 'folder' ? (
          <div>
            <div 
                className="flex items-center py-1 px-2 hover:bg-[#1f2428] text-slate-400 cursor-pointer select-none"
                onClick={() => toggleFolder(node.name)}
            >
              {node.isOpen ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
              <Folder className="w-4 h-4 mr-2 text-blue-400" />
              <span className="text-sm">{node.name}</span>
            </div>
            {node.isOpen && node.children && renderTree(node.children, depth + 1)}
          </div>
        ) : (
          <div 
            className={`flex items-center py-1 px-2 cursor-pointer border-l-2 ${activeFile.name === node.name ? 'bg-[#1f2428] border-orange-400 text-white' : 'border-transparent text-slate-400 hover:text-white hover:bg-[#1f2428]'}`}
            onClick={() => selectFile(node)}
          >
             <span className="w-5"></span> {/* Indent for file icon alignment */}
             {node.name.endsWith('.js') ? <FileCode className="w-4 h-4 mr-2 text-yellow-400" /> : 
              node.name.endsWith('.md') ? <FileText className="w-4 h-4 mr-2 text-slate-300" /> : 
              node.name.endsWith('.json') ? <FileJson className="w-4 h-4 mr-2 text-red-400" /> :
              node.name === 'Dockerfile' ? <Box className="w-4 h-4 mr-2 text-blue-400" /> :
              <FileText className="w-4 h-4 mr-2 text-slate-400" />}
             <span className="text-sm">{node.name}</span>
          </div>
        )}
      </div>
    ));
  };

  return (
    <div className="w-full h-screen flex flex-col bg-[#0d1117] text-slate-300 font-sans">
      {/* GitHub-like Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-2">
           <Box className="w-5 h-5 text-slate-400" />
           <span className="text-blue-400 font-medium">whatsapp-bot</span>
           <span className="text-slate-500">/</span>
           <span className="font-bold text-white">whatsapp-gemini-bot</span>
           <span className="ml-2 px-2 py-0.5 rounded-full border border-slate-700 text-xs text-slate-500">Public</span>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={handleDownloadRepo}
              disabled={isDownloading}
              className="flex items-center px-3 py-1 bg-[#238636] text-white text-sm font-bold rounded-md hover:bg-[#2ea043] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Download className="w-4 h-4 mr-2" />
                {isDownloading ? 'Zipping...' : 'Code'}
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-[#0d1117] border-r border-[#30363d] flex flex-col">
            <div className="p-3 text-xs font-bold text-slate-500 uppercase">Explorer</div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {renderTree(fileSystem)}
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-[#0d1117]">
            {/* Tabs / Breadcrumb */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#0d1117] border-b border-[#30363d]">
                <div className="text-sm text-slate-500">
                    {activeFile.name}
                </div>
                <button 
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-[#1f2428] rounded text-xs text-slate-300 transition-colors"
                >
                    {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy Content'}
                </button>
            </div>

            {/* Code Editor View */}
            <div className="flex-1 overflow-auto bg-[#0d1117] p-0">
                {activeFile.language === 'markdown' ? (
                     <div className="p-8 max-w-4xl mx-auto markdown-body">
                        {activeFile.content?.split('\n').map((line, i) => {
                            if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-bold text-white border-b border-slate-700 pb-2 mb-4 mt-6">{line.substring(2)}</h1>;
                            if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-semibold text-white mb-3 mt-6">{line.substring(3)}</h2>;
                            if (line.startsWith('```')) return null; // Simplified block handling
                            if (line.startsWith('- ')) return <li key={i} className="ml-5 list-disc text-slate-300 mb-1">{line.substring(2)}</li>;
                            if (line.match(/^\d+\./)) return <div key={i} className="ml-5 text-slate-300 mb-1 font-medium">{line}</div>;
                            if (line.startsWith('|')) return <div key={i} className="font-mono text-xs text-slate-400 whitespace-pre ml-5">{line}</div>;
                            if (['pkg', 'git', 'cd', 'npm', 'node'].some(cmd => line.trim().startsWith(cmd))) {
                                return <div key={i} className="bg-[#161b22] border-l-4 border-blue-500 p-2 my-2 font-mono text-sm text-slate-300">{line}</div>;
                            }
                            if (line.trim() === '') return <br key={i}/>;
                            return <p key={i} className="text-slate-300 leading-6 mb-2">{line}</p>;
                        })}
                     </div>
                ) : (
                    <pre className="p-4 font-mono text-sm leading-6 text-slate-300">
                        {activeFile.content?.split('\n').map((line, index) => (
                            <div key={index} className="table-row">
                                <span className="table-cell text-right pr-4 select-none text-slate-600 text-xs w-8">{index + 1}</span>
                                <span className="table-cell whitespace-pre-wrap">{line}</span>
                            </div>
                        ))}
                    </pre>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
