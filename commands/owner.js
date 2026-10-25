const settings = require('../settings');

// Every number listed in settings.ownerNumbers (falls back to ownerNumber)
function getOwnerNumbers() {
    const list = Array.isArray(settings.ownerNumbers) && settings.ownerNumbers.length
        ? [...settings.ownerNumbers]
        : (settings.ownerNumber ? [settings.ownerNumber] : []);
    return list.map(n => String(n).replace(/[^0-9]/g, '')).filter(Boolean);
}

async function ownerCommand(sock, chatId) {
    const numbers = getOwnerNumbers();

    if (!numbers.length) {
        await sock.sendMessage(chatId, {
            text: '❌ No owner number configured. Set `ownerNumbers` in settings.js.'
        });
        return;
    }

    const telLines = numbers.map(n => `TEL;waid=${n}:+${n}`).join('\n');

    const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${settings.botOwner}
${telLines}
END:VCARD
`;

    await sock.sendMessage(chatId, {
        contacts: { displayName: settings.botOwner, contacts: [{ vcard }] },
    });
}

module.exports = ownerCommand;
