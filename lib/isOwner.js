const settings = require('../settings');
const { isSudo } = require('./index');

// Collect every configured owner number (single value + list) as clean digits
function getOwnerNumbers() {
    const raw = [];
    if (settings.ownerNumber) raw.push(String(settings.ownerNumber));
    if (Array.isArray(settings.ownerNumbers)) {
        for (const n of settings.ownerNumbers) {
            if (n && !raw.includes(String(n))) raw.push(String(n));
        }
    }
    return raw.map(n => n.split(':')[0].split('@')[0]).filter(Boolean);
}

async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    const ownerNumbersClean = getOwnerNumbers();
    const ownerJids = ownerNumbersClean.map(n => n + "@s.whatsapp.net");

    // Direct JID match
    if (ownerJids.includes(senderId)) {
        return true;
    }
    
    // Extract sender's numeric parts
    const senderIdClean = senderId.split(':')[0].split('@')[0];
    const senderLidNumeric = senderId.includes('@lid') ? senderId.split('@')[0].split(':')[0] : '';
    
    // Check if sender's phone number matches any owner number
    if (ownerNumbersClean.includes(senderIdClean)) {
        return true;
    }
    
    // In groups, check if sender's LID matches bot's LID (owner uses same account as bot)
    if (sock && chatId && chatId.endsWith('@g.us') && senderId.includes('@lid')) {
        try {
            // Get bot's LID numeric
            const botLid = sock.user?.lid || '';
            const botLidNumeric = botLid.includes(':') ? botLid.split(':')[0] : (botLid.includes('@') ? botLid.split('@')[0] : botLid);
            
            // Check if sender's LID numeric matches bot's LID numeric
            if (senderLidNumeric && botLidNumeric && senderLidNumeric === botLidNumeric) {
                return true;
            }
            
            // Also check participant data for additional matching
            const metadata = await sock.groupMetadata(chatId);
            const participants = metadata.participants || [];
            
            const participant = participants.find(p => {
                const pLid = p.lid || '';
                const pLidNumeric = pLid.includes(':') ? pLid.split(':')[0] : (pLid.includes('@') ? pLid.split('@')[0] : pLid);
                const pId = p.id || '';
                const pIdClean = pId.split(':')[0].split('@')[0];
                
                return (
                    p.lid === senderId || 
                    p.id === senderId ||
                    pLidNumeric === senderLidNumeric ||
                    pIdClean === senderIdClean ||
                    ownerNumbersClean.includes(pIdClean)
                );
            });
            
            if (participant) {
                const participantId = participant.id || '';
                const participantLid = participant.lid || '';
                const participantIdClean = participantId.split(':')[0].split('@')[0];
                const participantLidNumeric = participantLid.includes(':') ? participantLid.split(':')[0] : (participantLid.includes('@') ? participantLid.split('@')[0] : participantLid);
                
                if (ownerJids.includes(participantId) || 
                    ownerNumbersClean.includes(participantIdClean) ||
                    participantLidNumeric === botLidNumeric) {
                    return true;
                }
            }
        } catch (e) {
            console.error('❌ [isOwner] Error checking participant data:', e);
        }
    }
    
    // Check if sender ID contains any owner number (fallback)
    if (ownerNumbersClean.some(n => senderId.includes(n))) {
        return true;
    }
    
    // Check sudo status
    try {
        return await isSudo(senderId);
    } catch (e) {
        console.error('❌ [isOwner] Error checking sudo:', e);
        return false;
    }
}

module.exports = isOwnerOrSudo;