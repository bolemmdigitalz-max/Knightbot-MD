/**
 * BoluDevs Bot - View once saver
 *
 * - Every view-once photo/video/audio is downloaded and stored in the gallery
 *   automatically (toggle with .viewonce on/off)
 * - A copy is sent to the owner numbers straight away
 * - .vv (reply to a view-once) re-sends it in the chat and saves it too
 */

const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const vault = require('../lib/vault');
const { notifyOwners } = require('../lib/ownerTargets');

const CONFIG_PATH = path.join(process.cwd(), 'data', 'viewonce.json');

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return { enabled: true };
        const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        return { enabled: cfg.enabled !== false }; // default ON
    } catch {
        return { enabled: true };
    }
}

function saveConfig(cfg) {
    try {
        if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
            fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
        }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    } catch (err) {
        console.error('viewonce config save error:', err.message);
    }
}

function unwrap(message) {
    return message?.message?.viewOnceMessageV2?.message
        || message?.message?.viewOnceMessage?.message
        || message?.message?.viewOnceMessageV2Extension?.message
        || null;
}

async function downloadToBuffer(node) {
    if (!node) return null;

    if (node.imageMessage) {
        return { kind: 'image', mimetype: node.imageMessage.mimetype, caption: node.imageMessage.caption || '', buffer: await streamToBuffer(await downloadContentFromMessage(node.imageMessage, 'image')) };
    }
    if (node.videoMessage) {
        return { kind: 'video', mimetype: node.videoMessage.mimetype, caption: node.videoMessage.caption || '', buffer: await streamToBuffer(await downloadContentFromMessage(node.videoMessage, 'video')) };
    }
    if (node.audioMessage) {
        return { kind: 'audio', mimetype: node.audioMessage.mimetype, caption: '', buffer: await streamToBuffer(await downloadContentFromMessage(node.audioMessage, 'audio')) };
    }
    return null;
}

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

/**
 * Called for every incoming message. Saves view-once media to the gallery
 * and forwards a copy to the owners.
 */
async function captureViewOnce(sock, message) {
    try {
        const cfg = loadConfig();
        if (!cfg.enabled) return null;
        if (!message?.key?.id) return null;

        const container = unwrap(message);
        if (!container) return null;

        const media = await downloadToBuffer(container);
        if (!media || !media.buffer?.length) return null;

        const sender = message.key.participant || message.key.remoteJid;
        const chat = message.key.remoteJid;

        const entry = vault.saveMedia({
            type: 'viewonce',
            kind: media.kind,
            buffer: media.buffer,
            mimetype: media.mimetype || '',
            sender,
            chat,
            caption: media.caption || ''
        });

        // Send a copy to the owners
        const caption = `👁️ *View-once ${media.kind} saved*\n` +
            `👤 From: @${sender.split('@')[0]}\n` +
            `💾 Gallery ID: *#${entry.id}*\n` +
            `🕒 ${new Date().toLocaleString()}` +
            (media.caption ? `\n\n${media.caption}` : '');

        try {
            if (media.kind === 'video') {
                await notifyOwners(sock, { video: media.buffer, caption, mimetype: media.mimetype || 'video/mp4', mentions: [sender] });
            } else if (media.kind === 'audio') {
                await notifyOwners(sock, { audio: media.buffer, mimetype: media.mimetype || 'audio/ogg', ptt: true });
                await notifyOwners(sock, { text: caption, mentions: [sender] });
            } else {
                await notifyOwners(sock, { image: media.buffer, caption, mimetype: media.mimetype || 'image/jpeg', mentions: [sender] });
            }
        } catch (err) {
            console.error('viewonce notify error:', err.message);
        }

        console.log(`👁️ View-once ${media.kind} saved to gallery as #${entry.id}`);
        return entry;
    } catch (err) {
        console.error('captureViewOnce error:', err.message);
        return null;
    }
}

/**
 * .vv - reply to a view-once message to re-send it in the chat (and save it)
 */
async function viewonceCommand(sock, chatId, message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
        await sock.sendMessage(chatId, {
            text: '👁️ Reply to a view-once photo or video with *.vv* to save and re-send it.'
        }, { quoted: message });
        return;
    }

    try {
        // Unwrap the view-once container first, then fall back to plain media
        const container = unwrap({ message: quoted });
        const media = (container ? await downloadToBuffer(container) : null)
            || await downloadToBuffer(quoted);

        if (!media) {
            await sock.sendMessage(chatId, {
                text: '❌ No view-once media found in that message.'
            }, { quoted: message });
            return;
        }
        return sendAndSave(sock, chatId, message, media);
    } catch (err) {
        console.error('viewonceCommand error:', err.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to capture that view-once media.' }, { quoted: message });
    }
}

async function sendAndSave(sock, chatId, message, media) {
    const sender = message.message?.extendedTextMessage?.contextInfo?.participant
        || message.key.participant
        || message.key.remoteJid;

    const entry = vault.saveMedia({
        type: 'viewonce',
        kind: media.kind,
        buffer: media.buffer,
        mimetype: media.mimetype || '',
        sender,
        chat: chatId,
        caption: media.caption || ''
    });

    const caption = `👁️ *View-once ${media.kind}* — saved to gallery as *#${entry.id}*` +
        (media.caption ? `\n\n${media.caption}` : '');

    if (media.kind === 'video') {
        await sock.sendMessage(chatId, { video: media.buffer, caption, mimetype: media.mimetype || 'video/mp4' }, { quoted: message });
    } else if (media.kind === 'audio') {
        await sock.sendMessage(chatId, { audio: media.buffer, mimetype: media.mimetype || 'audio/ogg', ptt: true }, { quoted: message });
    } else {
        await sock.sendMessage(chatId, { image: media.buffer, caption, mimetype: media.mimetype || 'image/jpeg' }, { quoted: message });
    }
}

/**
 * .viewonce on | off | status
 */
async function viewonceToggleCommand(sock, chatId, message, args) {
    const sub = (args || '').trim().split(/\s+/)[0]?.toLowerCase();
    const cfg = loadConfig();

    if (!sub || sub === 'status') {
        await sock.sendMessage(chatId, {
            text: `👁️ *View-once saver:* ${cfg.enabled ? 'ON' : 'OFF'}\n\n` +
                  `*.viewonce on* — auto-save every view-once photo/video\n` +
                  `*.viewonce off* — stop saving\n\n` +
                  `Saved items: *${vault.count('viewonce')}* — view with *.gallery viewonce*`
        }, { quoted: message });
        return;
    }

    if (sub === 'on' || sub === 'off') {
        cfg.enabled = sub === 'on';
        saveConfig(cfg);
        await sock.sendMessage(chatId, {
            text: `👁️ View-once saver is now *${cfg.enabled ? 'ON' : 'OFF'}*${cfg.enabled ? ' — photos/videos will be saved to the gallery automatically.' : '.'}`
        }, { quoted: message });
        return;
    }

    await sock.sendMessage(chatId, { text: 'Usage: *.viewonce on* | *.viewonce off* | *.viewonce status*' }, { quoted: message });
}

module.exports = { captureViewOnce, viewonceCommand, viewonceToggleCommand, loadConfig };
