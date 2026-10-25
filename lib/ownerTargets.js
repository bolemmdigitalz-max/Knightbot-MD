/**
 * BoluDevs Bot - Owner targets
 *
 * Every JID that should receive bot-private reports
 * (anti-delete reports, saved view-once media, etc.)
 */

const settings = require('../settings');

function getOwnerJids(sock) {
    const jids = [];

    for (const raw of (settings.ownerNumbers || [])) {
        const num = String(raw).replace(/[^0-9]/g, '');
        if (num) jids.push(`${num}@s.whatsapp.net`);
    }

    if (settings.ownerNumber) {
        const num = String(settings.ownerNumber).replace(/[^0-9]/g, '');
        if (num) jids.push(`${num}@s.whatsapp.net`);
    }

    // Always include the bot's own account so reports never get lost
    try {
        if (sock?.user?.id) {
            const self = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            jids.push(self);
        }
    } catch {}

    return [...new Set(jids)];
}

// Send to every owner, never let one bad JID break the flow
async function notifyOwners(sock, content, options = {}) {
    let sent = 0;
    for (const jid of getOwnerJids(sock)) {
        try {
            await sock.sendMessage(jid, content, options);
            sent++;
        } catch (err) {
            console.error(`notifyOwners: failed for ${jid}:`, err.message);
        }
    }
    return sent;
}

module.exports = { getOwnerJids, notifyOwners };
