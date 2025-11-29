export default async function autoStatus(sock, m) {
    if (m.key.remoteJid === 'status@broadcast') {
        await sock.readMessages([m.key]);
        console.log(`Status viewed from ${m.key.participant}`);
    }
}