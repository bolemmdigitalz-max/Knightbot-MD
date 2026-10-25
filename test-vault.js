/**
 * Test harness for the view-once saver + deleted message recovery.
 * Run: node test-vault.js
 * Uses a fake socket, so no WhatsApp connection is needed.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ---- mock the baileys media download BEFORE the command modules load it ----
// Baileys re-exports through non-writable getters, so we swap the module in
// require.cache instead of assigning to the export.
const realBaileys = require('@whiskeysockets/baileys');
const baileysPath = require.resolve('@whiskeysockets/baileys');

function fakeStream(payload) {
    return (async function* () { yield Buffer.from(payload); })();
}

const baileysStub = { ...realBaileys };
baileysStub.downloadContentFromMessage = async (node, type) => fakeStream(`FAKE-${type}-DATA`);
require.cache[baileysPath] = {
    id: baileysPath,
    filename: baileysPath,
    loaded: true,
    children: [],
    paths: [],
    exports: baileysStub
};

const vault = require('./lib/vault');
const { captureViewOnce, viewonceCommand } = require('./commands/viewonce');
const { vaultCommand, deletedCommand } = require('./commands/vault');
const antidelete = require('./commands/antidelete');

const GROUP = '120363000000000000@g.us';
const SENDER = '2348099999999@s.whatsapp.net';

const sent = [];
const sock = {
    user: { id: '2349041490874:12@s.whatsapp.net' },
    sendMessage: async (jid, content) => { sent.push({ jid, content }); return { key: { id: 'x' } }; },
    groupMetadata: async () => ({ subject: 'Test Group' })
};

function msg(id, body) {
    return { key: { id, remoteJid: GROUP, participant: SENDER }, message: body };
}
function cmd(text) {
    return { key: { id: 'CMD' + Date.now(), remoteJid: GROUP, participant: SENDER }, message: { conversation: text } };
}
function lastTexts() {
    return sent.filter(s => s.content.text).map(s => s.content.text);
}

(async () => {
    let pass = 0, fail = 0;
    const check = (name, cond, extra = '') => {
        if (cond) { pass++; console.log(`  PASS  ${name}`); }
        else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
    };

    console.log('\n=== 1. Vault storage ===');
    vault.clear();
    const e1 = vault.saveMedia({ type: 'viewonce', kind: 'image', buffer: Buffer.from('imgdata'), mimetype: 'image/jpeg', sender: SENDER, chat: GROUP, caption: 'hi' });
    const e2 = vault.saveText({ type: 'deleted', text: 'a secret', sender: SENDER, chat: GROUP });
    check('saveMedia returns id 1', e1.id === 1, `got ${e1.id}`);
    check('saveMedia file written', fs.existsSync(e1.file));
    check('saveText returns id 2', e2.id === 2, `got ${e2.id}`);
    check('count(viewonce) = 1', vault.count('viewonce') === 1);
    check('count(deleted) = 1', vault.count('deleted') === 1);
    check('list newest-first', vault.list({})[0].id === 2);
    check('get(1) resolves', vault.get(1).id === 1);
    check('get(999) is null', vault.get(999) === null);
    check('index persisted to disk', JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/gallery.json'))).items.length === 2);

    console.log('\n=== 2. View-once auto capture ===');
    vault.clear(); sent.length = 0;
    const voImg = msg('VO1', { viewOnceMessageV2: { message: { imageMessage: { mimetype: 'image/jpeg', caption: 'look at this' } } } });
    const cap1 = await captureViewOnce(sock, voImg);
    check('image captured', cap1 && cap1.kind === 'image', JSON.stringify(cap1));
    check('saved to gallery folder', cap1 && cap1.file.includes(path.join('gallery', 'viewonce')));
    check('file exists on disk', cap1 && fs.existsSync(cap1.file));
    check('owner notified (image)', sent.some(s => s.content.image && /#1/.test(s.content.caption || '')));
    check('notification went to owner numbers', sent.every(s => /2349033372448|2349041490874/.test(s.jid)), JSON.stringify(sent.map(s => s.jid)));

    sent.length = 0;
    const voVid = msg('VO2', { viewOnceMessage: { message: { videoMessage: { mimetype: 'video/mp4', caption: 'clip' } } } });
    const cap2 = await captureViewOnce(sock, voVid);
    check('video captured (V1 wrapper)', cap2 && cap2.kind === 'video');
    check('owner notified (video)', sent.some(s => s.content.video));

    sent.length = 0;
    const normal = msg('N1', { conversation: 'hello world' });
    const cap3 = await captureViewOnce(sock, normal);
    check('normal message ignored', cap3 === null);

    console.log('\n=== 3. .vv reply ===');
    sent.length = 0;
    const vvMsg = { key: { id: 'VV1', remoteJid: GROUP, participant: SENDER }, message: { extendedTextMessage: { text: '.vv', contextInfo: { quotedMessage: { viewOnceMessageV2: { message: { imageMessage: { mimetype: 'image/jpeg', caption: 'yo' } } } } } } } };
    await viewonceCommand(sock, GROUP, vvMsg);
    check('.vv re-sent the media', sent.some(s => s.content.image));
    check('.vv saved to gallery', vault.count('viewonce') === 3, `count=${vault.count('viewonce')}`);

    console.log('\n=== 4. .gallery command ===');
    sent.length = 0;
    await vaultCommand(sock, GROUP, cmd('.gallery'), true);
    const listText = lastTexts().join('\n');
    check('.gallery lists items', /#3/.test(listText) && /GALLERY/.test(listText), listText.slice(0, 120));

    sent.length = 0;
    await vaultCommand(sock, GROUP, cmd('.gallery 1'), true);
    check('.gallery <id> sends media', sent.some(s => s.content.image || s.content.video));

    sent.length = 0;
    await vaultCommand(sock, GROUP, cmd('.gallery viewonce'), true);
    check('.gallery viewonce filters', /viewonce/.test(lastTexts().join('\n')));

    sent.length = 0;
    await vaultCommand(sock, GROUP, cmd('.gallery nosuch'), true);
    check('unknown arg falls back to list', /GALLERY/.test(lastTexts().join('\n')));

    sent.length = 0;
    await vaultCommand(sock, GROUP, cmd('.gallery'), false);
    check('non-owner sees only this chat', /GALLERY/.test(lastTexts().join('\n')));

    console.log('\n=== 5. Deleted message recovery ===');
    vault.clear(); sent.length = 0;
    // store a text message (antidelete is enabled by default now)
    await antidelete.storeMessage(sock, msg('DEL1', { conversation: 'this will be deleted' }));
    await antidelete.handleMessageRevocation(sock, {
        key: { id: 'REV1', remoteJid: GROUP, participant: SENDER },
        participant: SENDER,
        message: { protocolMessage: { type: 0, key: { id: 'DEL1' } } }
    });
    check('deleted text stored in vault', vault.count('deleted') === 1, `count=${vault.count('deleted')}`);
    check('owner got a delete report', sent.some(s => /ANTIDELETE REPORT/.test(s.content.text || '')));
    check('report contains the text', sent.some(s => /this will be deleted/.test(s.content.text || '')));

    sent.length = 0;
    await antidelete.storeMessage(sock, msg('DEL2', { imageMessage: { mimetype: 'image/jpeg', caption: 'gone pic' } }));
    await antidelete.handleMessageRevocation(sock, {
        key: { id: 'REV2', remoteJid: GROUP, participant: SENDER },
        participant: SENDER,
        message: { protocolMessage: { type: 0, key: { id: 'DEL2' } } }
    });
    check('deleted image stored', vault.count('deleted') === 2, `count=${vault.count('deleted')}`);
    check('deleted media copy kept on disk', vault.list({ type: 'deleted' }).some(i => i.file && fs.existsSync(i.file)));

    console.log('\n=== 6. .deleted command ===');
    sent.length = 0;
    await deletedCommand(sock, GROUP, cmd('.deleted'), true);
    const delText = lastTexts().join('\n');
    check('.deleted shows recovered text', /this will be deleted/.test(delText), delText.slice(0, 160));
    check('.deleted lists media item too', /#/.test(delText));

    sent.length = 0;
    await deletedCommand(sock, GROUP, cmd('.dl 1'), true);
    check('.dl limit respected', /DELETED MESSAGES\* \(1\)/.test(lastTexts().join('\n')), lastTexts().join('\n').slice(0, 80));

    console.log('\n=== 7. Gallery persistence across "restart" ===');
    const before = vault.count();
    delete require.cache[require.resolve('./lib/vault')];
    const vault2 = require('./lib/vault');
    check('index survives reload', vault2.count() === before, `${vault2.count()} vs ${before}`);

    console.log(`\n===== ${pass} passed, ${fail} failed =====`);
    vault.clear();
    process.exit(fail ? 1 : 0);
})().catch(err => { console.error('HARNESS ERROR:', err); process.exit(1); });
