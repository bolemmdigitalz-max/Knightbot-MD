/**
 * BoluDevs Bot - Gallery / deleted messages browser
 *
 * .gallery [viewonce|deleted] [n]   list saved items
 * .gallery <id>                     fetch a saved item
 * .gallery clear                    wipe the gallery (owner only)
 * .deleted [n]                      read deleted messages
 */

const fs = require('fs');
const vault = require('../lib/vault');

const ICONS = {
    image: '🖼️',
    video: '🎥',
    audio: '🎵',
    sticker: '🎴',
    text: '💬'
};

function shortNum(jid) {
    return jid ? jid.split('@')[0] : 'unknown';
}

function timeOf(entry) {
    const d = new Date(entry.time);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
}

function filterForSender(items, isOwner, chatId) {
    // Owners see everything; in a group, non-owners only see that group's items
    if (isOwner) return items;
    return items.filter(i => i.chat === chatId);
}

async function sendEntry(sock, chatId, message, entry) {
    if (entry.kind === 'text') {
        await sock.sendMessage(chatId, {
            text: `💬 *Saved message #${entry.id}*\n👤 ${shortNum(entry.sender)}\n🕒 ${timeOf(entry)}\n\n${entry.caption}`
        }, { quoted: message });
        return;
    }

    if (!entry.file || !fs.existsSync(entry.file)) {
        await sock.sendMessage(chatId, {
            text: `❌ Media for item #${entry.id} is no longer on disk (gallery was pruned).`
        }, { quoted: message });
        return;
    }

    const buffer = fs.readFileSync(entry.file);
    const caption = `${ICONS[entry.kind] || '📦'} *${entry.type} #${entry.id}*\n` +
        `👤 ${shortNum(entry.sender)}\n🕒 ${timeOf(entry)}` +
        (entry.caption ? `\n\n${entry.caption}` : '');

    if (entry.kind === 'video') {
        await sock.sendMessage(chatId, { video: buffer, caption, mimetype: entry.mimetype || 'video/mp4' }, { quoted: message });
    } else if (entry.kind === 'audio') {
        await sock.sendMessage(chatId, { audio: buffer, mimetype: entry.mimetype || 'audio/ogg', ptt: true }, { quoted: message });
    } else if (entry.kind === 'sticker') {
        await sock.sendMessage(chatId, { sticker: buffer }, { quoted: message });
    } else {
        await sock.sendMessage(chatId, { image: buffer, caption, mimetype: entry.mimetype || 'image/jpeg' }, { quoted: message });
    }
}

/**
 * .gallery / .vault / .saved
 */
async function vaultCommand(sock, chatId, message, isOwner) {
    const raw = (message.message?.conversation
        || message.message?.extendedTextMessage?.text
        || '').trim();
    const args = raw.split(/\s+/).slice(1);

    if (args[0]?.toLowerCase() === 'clear') {
        if (!isOwner) {
            await sock.sendMessage(chatId, { text: '❌ Only the bot owner can clear the gallery.' }, { quoted: message });
            return;
        }
        const n = vault.clear();
        await sock.sendMessage(chatId, { text: `🗑️ Gallery cleared (${n} item${n === 1 ? '' : 's'} deleted).` }, { quoted: message });
        return;
    }

    // .gallery <id>
    const numericId = args.find(a => /^\d+$/.test(a));
    if (numericId && args.length === 1) {
        const entry = vault.get(numericId);
        if (!entry) {
            await sock.sendMessage(chatId, { text: `❌ No saved item with ID #${numericId}.` }, { quoted: message });
            return;
        }
        const allowed = isOwner || entry.chat === chatId;
        if (!allowed) {
            await sock.sendMessage(chatId, { text: '❌ You can only open items saved from this chat.' }, { quoted: message });
            return;
        }
        await sendEntry(sock, chatId, message, entry);
        return;
    }

    // .gallery [viewonce|deleted] [n]
    let type = null;
    let limit = 15;
    for (const a of args) {
        const lower = a.toLowerCase();
        if (lower === 'viewonce' || lower === 'vo' || lower === 'view') type = 'viewonce';
        else if (lower === 'deleted' || lower === 'del') type = 'deleted';
        else if (/^\d+$/.test(a)) limit = Math.min(parseInt(a, 10), 50);
    }

    const items = filterForSender(vault.list({ type, limit: 100 }), isOwner, chatId).slice(0, limit);

    if (!items.length) {
        await sock.sendMessage(chatId, {
            text: `💾 Gallery is empty${type ? ` for "${type}"` : ''}.\n\n` +
                  `View-once photos/videos are saved automatically.\nDeleted messages appear here too when anti-delete is on.`
        }, { quoted: message });
        return;
    }

    const lines = items.map(i =>
        `➤ *#${i.id}* ${ICONS[i.kind] || '📦'} ${i.type}` +
        ` — ${shortNum(i.sender)} — ${timeOf(i)}` +
        (i.kind === 'text' && i.caption ? `\n    "${i.caption.slice(0, 60)}${i.caption.length > 60 ? '…' : ''}"` : '')
    );

    const text = `╔═══〔 💾 GALLERY 〕═══\n` +
        `${type ? `Filter: *${type}*\n` : ''}` +
        `Saved: ${vault.count(type)} total\n` +
        `╚══════════════\n\n` +
        lines.join('\n') +
        `\n\n💡 *.gallery <id>* to open one\n💡 *.gallery viewonce* or *.gallery deleted*`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
}

/**
 * .deleted / .dl - read messages that were deleted
 */
async function deletedCommand(sock, chatId, message, isOwner) {
    const raw = (message.message?.conversation
        || message.message?.extendedTextMessage?.text
        || '').trim();
    const args = raw.split(/\s+/).slice(1);

    let limit = 10;
    for (const a of args) {
        if (/^\d+$/.test(a)) limit = Math.min(parseInt(a, 10), 30);
    }

    const items = filterForSender(vault.list({ type: 'deleted', limit: 100 }), isOwner, chatId).slice(0, limit);

    if (!items.length) {
        await sock.sendMessage(chatId, {
            text: `🗑️ No deleted messages captured yet.\n\n` +
                  `Turn it on with *.antidelete on* (owner only), then deleted texts, photos, videos and audio ` +
                  `are saved to the gallery and reported to you.`
        }, { quoted: message });
        return;
    }

    const blocks = items.map(i => {
        const head = `*#${i.id}* ${ICONS[i.kind] || '📦'} ${i.kind} by ${shortNum(i.sender)}`;
        const meta = `🕒 ${timeOf(i)}${i.deletedBy ? ` — deleted by ${shortNum(i.deletedBy)}` : ''}`;
        const body = i.caption ? `\n${i.caption}` : (i.kind !== 'text' ? `\n(media saved — open with *.gallery ${i.id}*)` : '');
        return `${head}\n${meta}${body}`;
    });

    const text = `🗑️ *DELETED MESSAGES* (${items.length})\n\n` + blocks.join('\n\n');

    await sock.sendMessage(chatId, { text }, { quoted: message });
}

module.exports = { vaultCommand, deletedCommand };
