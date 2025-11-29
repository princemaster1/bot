export default function alwaysOnline(sock) {
    setInterval(async () => {
        await sock.sendPresenceUpdate('available');
    }, 15000);
}
