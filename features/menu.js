export default async function menu(sock, m) {
    const text = m.message.conversation || m.message.extendedTextMessage?.text || "";
    if (text.trim() === ',menu') {
        await sock.sendMessage(m.key.remoteJid, {
            text: `*🤖 BOT MENU*
            
1. *,ai <text>* - Ask AI
2. *,status* - Check status
3. *,ping* - Ping bot

_Powered by Gemini 2.5_`
        }, { quoted: m });
    }
}