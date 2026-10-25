/**
 * BoluDevs Bot - Media vault
 *
 * Persistent "gallery" used by:
 *   - view-once capture (every view-once photo/video/audio is saved automatically)
 *   - anti-delete recovery (deleted messages + their media are kept)
 *
 * Files live in ./gallery/<type>/ and an index is kept in ./data/gallery.json
 * so saved items survive a restart and can be fetched later with .gallery <id>
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const GALLERY_DIR = path.join(ROOT, 'gallery');
const INDEX_PATH = path.join(ROOT, 'data', 'gallery.json');

const MAX_ENTRIES = 300;          // index entries kept (oldest pruned first)
const MAX_FOLDER_MB = 500;        // gallery folder soft cap

function ensureDirs() {
    for (const dir of [GALLERY_DIR, path.join(GALLERY_DIR, 'viewonce'), path.join(GALLERY_DIR, 'deleted')]) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
}

function loadIndex() {
    ensureDirs();
    try {
        const data = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
        if (!data || !Array.isArray(data.items)) return { seq: 0, items: [] };
        return { seq: Number(data.seq) || 0, items: data.items };
    } catch {
        return { seq: 0, items: [] };
    }
}

function saveIndex(index) {
    ensureDirs();
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

function extFor(kind, mimetype = '') {
    if (kind === 'sticker') return 'webp';
    if (mimetype.includes('png')) return 'png';
    if (mimetype.includes('webp')) return 'webp';
    if (mimetype.includes('mp4')) return 'mp4';
    if (mimetype.includes('ogg')) return 'ogg';
    if (mimetype.includes('mpeg') || mimetype.includes('mp3')) return 'mp3';
    if (kind === 'video') return 'mp4';
    return 'jpg';
}

function folderSizeMB(dir) {
    try {
        let total = 0;
        for (const f of fs.readdirSync(dir)) {
            const p = path.join(dir, f);
            const st = fs.statSync(p);
            if (st.isFile()) total += st.size;
        }
        return total / (1024 * 1024);
    } catch {
        return 0;
    }
}

// Drop oldest entries until we're back under the caps
function prune(index) {
    let changed = false;

    while (index.items.length > MAX_ENTRIES) {
        const oldest = index.items.shift();
        if (oldest.file) { try { fs.unlinkSync(oldest.file); } catch {} }
        changed = true;
    }

    let guard = 0;
    while (folderSizeMB(GALLERY_DIR) > MAX_FOLDER_MB && index.items.length > 0 && guard++ < 500) {
        const oldest = index.items.shift();
        if (oldest.file) { try { fs.unlinkSync(oldest.file); } catch {} }
        changed = true;
    }

    return changed;
}

/**
 * Save a media buffer to the vault.
 * @returns {object} the stored entry
 */
function saveMedia({ type = 'viewonce', kind = 'image', buffer, mimetype = '', sender, chat, caption = '', deletedBy = null }) {
    const index = loadIndex();
    const id = index.seq + 1;

    const ext = extFor(kind, mimetype);
    const fileName = `${type}-${id}-${Date.now()}.${ext}`;
    const filePath = path.join(GALLERY_DIR, type, fileName);

    ensureDirs();
    fs.writeFileSync(filePath, buffer);

    const entry = {
        id,
        type,                                  // 'viewonce' | 'deleted'
        kind,                                  // 'image' | 'video' | 'audio' | 'sticker'
        mimetype: mimetype || (kind === 'video' ? 'video/mp4' : kind === 'audio' ? 'audio/ogg' : 'image/jpeg'),
        file: filePath,
        sender: sender || null,
        chat: chat || null,
        caption: caption || '',
        deletedBy: deletedBy || null,
        time: new Date().toISOString()
    };

    index.seq = id;
    index.items.push(entry);
    prune(index);
    saveIndex(index);
    return entry;
}

/**
 * Save a text-only entry (used for deleted text messages).
 */
function saveText({ type = 'deleted', text = '', sender, chat, deletedBy = null }) {
    const index = loadIndex();
    const id = index.seq + 1;

    const entry = {
        id,
        type,
        kind: 'text',
        mimetype: '',
        file: null,
        sender: sender || null,
        chat: chat || null,
        caption: text || '',
        deletedBy: deletedBy || null,
        time: new Date().toISOString()
    };

    index.seq = id;
    index.items.push(entry);
    prune(index);
    saveIndex(index);
    return entry;
}

function list({ type = null, chat = null, limit = 15 } = {}) {
    const { items } = loadIndex();
    let out = items.slice();
    if (type) out = out.filter(i => i.type === type);
    if (chat) out = out.filter(i => i.chat === chat);
    return out.slice(-limit).reverse();
}

function get(id) {
    const { items } = loadIndex();
    return items.find(i => String(i.id) === String(id)) || null;
}

function clear() {
    const { items } = loadIndex();
    for (const item of items) {
        if (item.file) { try { fs.unlinkSync(item.file); } catch {} }
    }
    saveIndex({ seq: 0, items: [] });
    return items.length;
}

function count(type = null) {
    const { items } = loadIndex();
    return type ? items.filter(i => i.type === type).length : items.length;
}

module.exports = { ensureDirs, saveMedia, saveText, list, get, clear, count, GALLERY_DIR };
