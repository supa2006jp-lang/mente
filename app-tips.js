/**
 * TIPS page - sticky notes for small memory assists.
 */
(function () {
    const proto = MaintenanceApp.prototype;

    proto.ensureTipsState = function () {
        const d = store.activeData || {};
        if (!Array.isArray(d.tipsNotes)) d.tipsNotes = [];
        return d.tipsNotes;
    };

    proto.normalizeTipsLabel = function (value = '') {
        return String(value || '')
            .normalize('NFKC')
            .trim()
            .replace(/\s+/g, '')
            .toLocaleLowerCase('ja-JP');
    };

    proto.collectTipsUniqueLabels = function (notes = [], key = 'group') {
        const labels = new Map();
        notes.forEach(note => {
            const label = (note?.[key] || '').trim();
            if (!label) return;
            const normalized = this.normalizeTipsLabel(label);
            if (!labels.has(normalized)) labels.set(normalized, label);
        });
        return [...labels.values()].sort((a, b) => a.normalize('NFKC').localeCompare(b.normalize('NFKC'), 'ja'));
    };

    proto.getTipsFileType = function (file = {}) {
        const name = String(file.name || '').toLowerCase();
        const type = String(file.type || '').toLowerCase();
        if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return 'image';
        if (type === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
        if (/\.(xlsx|xls|xlsm|xlsb|ods|docx?|pptx?)$/i.test(name)) return 'office';
        return 'other';
    };

    proto.getTipsCardColors = function (note = {}) {
        const seed = this.normalizeTipsLabel(note.group || '未分類');
        let hash = 0;
        for (let i = 0; i < seed.length; i += 1) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
        const palettes = [
            { bg: '#fffbeb', edge: '#f59e0b', chip: '#fef3c7', text: '#92400e' },
            { bg: '#f0fdf4', edge: '#22c55e', chip: '#dcfce7', text: '#166534' },
            { bg: '#eff6ff', edge: '#3b82f6', chip: '#dbeafe', text: '#1d4ed8' },
            { bg: '#fdf2f8', edge: '#ec4899', chip: '#fce7f3', text: '#be185d' },
            { bg: '#f5f3ff', edge: '#8b5cf6', chip: '#ede9fe', text: '#6d28d9' },
            { bg: '#ecfeff', edge: '#06b6d4', chip: '#cffafe', text: '#0e7490' }
        ];
        return palettes[Math.abs(hash) % palettes.length];
    };

    proto.getTipsCardStyle = function (note = {}) {
        const c = this.getTipsCardColors(note);
        return `--tips-card-bg:${c.bg};--tips-card-edge:${c.edge};--tips-chip-bg:${c.chip};--tips-chip-text:${c.text};`;
    };

    proto.getTipsSearchQuery = function () {
        const local = document.getElementById('tips-search-input')?.value || '';
        const global = this.currentView === 'tips' ? (document.getElementById('global-search')?.value || '') : '';
        return (local || global || '').trim().toLowerCase();
    };

    proto.formatTipsDateTime = function (value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return this.escapeHtml(value);
        return date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    proto.renderTips = function () {
        const notes = this.ensureTipsState();
        const list = document.getElementById('tips-list');
        if (!list) return;

        const mode = ['group', 'time'].includes(this.tipsDisplayMode) ? this.tipsDisplayMode : 'group';
        this.tipsDisplayMode = mode;
        if (typeof this.tipsCompactMode !== 'boolean') {
            this.tipsCompactMode = localStorage.getItem('tips_compact_mode') === 'true';
        }
        document.getElementById('tips-view-group')?.classList.toggle('active', mode === 'group');
        document.getElementById('tips-view-time')?.classList.toggle('active', mode === 'time');
        document.getElementById('tips-compact-toggle')?.classList.toggle('active', this.tipsCompactMode);
        document.getElementById('tips-list')?.classList.toggle('compact', this.tipsCompactMode);

        const countPill = document.getElementById('tips-count-pill');
        if (countPill) countPill.textContent = `${notes.length}件`;

        const groupList = document.getElementById('tips-group-list');
        if (groupList) {
            const groups = this.collectTipsUniqueLabels(notes, 'group');
            groupList.innerHTML = groups.map(group => `<option value="${this.escapeHtml(group)}"></option>`).join('');
        }
        const branchList = document.getElementById('tips-branch-list');
        if (branchList) {
            const branches = this.collectTipsUniqueLabels(notes, 'branch');
            branchList.innerHTML = branches.map(branch => `<option value="${this.escapeHtml(branch)}"></option>`).join('');
        }
        this.renderTipsFilterOptions(notes);
        this.renderTipsStorageSummary(notes);

        this.renderTipsSelectedFiles();
        this.updateTipsEditStateUI();

        const query = this.getTipsSearchQuery();
        const normalizedQuery = this.normalizeTipsLabel(query);
        const filters = this.getTipsFilters();
        const filtered = notes
            .filter(note => {
                if (filters.group && this.normalizeTipsLabel(note.group || '未分類') !== filters.group) return false;
                if (filters.branch && this.normalizeTipsLabel(note.branch || '') !== filters.branch) return false;
                if (!this.matchesTipsAttachmentFilter(note, filters.attachment)) return false;
                if (!query) return true;
                const haystack = [
                    note.group,
                    note.branch,
                    note.body,
                    note.createdAt,
                    ...(note.attachments || []).flatMap((file, index) => [
                        file.name,
                        file.displayName,
                        this.getTipsAttachmentDisplayName(file, index),
                        this.getTipsFileType(file),
                        this.formatTipsFileSize(Number(file.size) || this.estimateTipsDataUrlBytes?.(file.dataUrl || '') || 0)
                    ])
                ].join(' ').toLowerCase();
                const normalizedHaystack = this.normalizeTipsLabel(haystack);
                return haystack.includes(query) || normalizedHaystack.includes(normalizedQuery);
            })
            .slice()
            .sort((a, b) => this.compareTipsNotes(a, b, filters.sort));

        if (!filtered.length) {
            list.innerHTML = `
                <div class="tips-empty">
                    <i class="fa-regular fa-note-sticky"></i>
                    <b>${notes.length ? '条件に合うTIPSがありません' : 'まだTIPSがありません'}</b>
                    <span>グループ名と本文を入れて登録してください。</span>
                </div>
            `;
            return;
        }

        if (mode === 'time') {
            list.innerHTML = `<div class="tips-time-grid">${filtered.map(note => this.getTipsCardHtml(note)).join('')}</div>`;
            return;
        }

        const grouped = filtered.reduce((map, note) => {
            const group = (note.group || '未分類').trim() || '未分類';
            const key = this.normalizeTipsLabel(group) || '未分類';
            if (!map.has(key)) map.set(key, { label: group, items: [] });
            map.get(key).items.push(note);
            return map;
        }, new Map());
        const sortedGroups = [...grouped.values()].sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
        list.innerHTML = sortedGroups.map(({ label: group, items }) => `
            <section class="tips-group-section">
                <header>
                    <h4><i class="fa-solid fa-layer-group"></i>${this.escapeHtml(group)}</h4>
                    <span>${items.length}件</span>
                </header>
                <div class="tips-card-grid">
                    ${items.map(note => this.getTipsCardHtml(note)).join('')}
                </div>
            </section>
        `).join('');
    };

    proto.renderTipsFilterOptions = function (notes = []) {
        const configs = [
            { id: 'tips-filter-group', key: 'group', label: '全グループ' },
            { id: 'tips-filter-branch', key: 'branch', label: '全分岐' }
        ];
        configs.forEach(config => {
            const select = document.getElementById(config.id);
            if (!select) return;
            const current = select.value;
            const labels = this.collectTipsUniqueLabels(notes, config.key);
            select.innerHTML = `<option value="">${config.label}</option>${labels.map(label => {
                const value = this.normalizeTipsLabel(label);
                return `<option value="${this.escapeHtml(value)}">${this.escapeHtml(label)}</option>`;
            }).join('')}`;
            select.value = labels.some(label => this.normalizeTipsLabel(label) === current) ? current : '';
        });
    };

    proto.getTipsFilters = function () {
        return {
            group: document.getElementById('tips-filter-group')?.value || '',
            branch: document.getElementById('tips-filter-branch')?.value || '',
            attachment: document.getElementById('tips-filter-attachment')?.value || 'all',
            sort: document.getElementById('tips-sort-select')?.value || 'createdDesc'
        };
    };

    proto.matchesTipsAttachmentFilter = function (note = {}, filter = 'all') {
        const attachments = Array.isArray(note.attachments) ? note.attachments : [];
        if (filter === 'all') return true;
        if (filter === 'with') return attachments.length > 0;
        if (filter === 'none') return attachments.length === 0;
        return attachments.some(file => this.getTipsFileType(file) === filter);
    };

    proto.getTipsNoteAttachmentBytes = function (note = {}) {
        const attachments = Array.isArray(note.attachments) ? note.attachments : [];
        return attachments.reduce((sum, file) => sum + (Number(file.size) || this.estimateTipsDataUrlBytes?.(file.dataUrl || '') || 0), 0);
    };

    proto.getTipsAttachmentKey = function (file = {}) {
        if (file.photoManagerId) return `pm:${file.photoManagerId}`;
        if (file.dataUrl) return `data:${String(file.dataUrl).slice(0, 96)}:${String(file.dataUrl).length}`;
        return `file:${file.name || ''}:${Number(file.size) || 0}`;
    };

    proto.getTipsAttachmentDuplicateIndex = function (notes = this.ensureTipsState()) {
        const counts = new Map();
        (notes || []).forEach(note => (Array.isArray(note.attachments) ? note.attachments : []).forEach(file => {
            const key = this.getTipsAttachmentKey(file);
            if (key) counts.set(key, (counts.get(key) || 0) + 1);
        }));
        return counts;
    };

    proto.getTipsNoteDuplicateAttachmentCount = function (note = {}, duplicateIndex = this.getTipsAttachmentDuplicateIndex()) {
        return (Array.isArray(note.attachments) ? note.attachments : [])
            .filter(file => (duplicateIndex.get(this.getTipsAttachmentKey(file)) || 0) > 1)
            .length;
    };

    proto.compareTipsNotes = function (a = {}, b = {}, sort = 'createdDesc') {
        const createdA = new Date(a.createdAt || 0).getTime() || 0;
        const createdB = new Date(b.createdAt || 0).getTime() || 0;
        if (sort === 'createdAsc') return createdA - createdB;
        if (sort === 'updatedDesc') {
            const updatedA = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
            const updatedB = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
            return updatedB - updatedA;
        }
        if (sort === 'sizeDesc') {
            return this.getTipsNoteAttachmentBytes(b) - this.getTipsNoteAttachmentBytes(a) || createdB - createdA;
        }
        if (sort === 'group') {
            const groupDiff = this.normalizeTipsLabel(a.group || '未分類').localeCompare(this.normalizeTipsLabel(b.group || '未分類'), 'ja');
            if (groupDiff) return groupDiff;
            const branchDiff = this.normalizeTipsLabel(a.branch || '').localeCompare(this.normalizeTipsLabel(b.branch || ''), 'ja');
            if (branchDiff) return branchDiff;
        }
        return createdB - createdA;
    };

    proto.renderTipsStorageSummary = function (notes = []) {
        const box = document.getElementById('tips-storage-summary');
        if (!box) return;
        const attachments = notes.flatMap(note => Array.isArray(note.attachments) ? note.attachments : []);
        const total = attachments.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
        const warn = total >= this.getTipsTotalAttachmentWarnBytes();
        box.classList.toggle('warn', warn);
        box.innerHTML = `
            <span><i class="fa-regular fa-note-sticky"></i>${notes.length}件</span>
            <span><i class="fa-solid fa-paperclip"></i>${attachments.length}添付</span>
            <span><i class="fa-solid fa-database"></i>${this.escapeHtml(this.formatTipsFileSize(total))}</span>
            ${warn ? '<b><i class="fa-solid fa-triangle-exclamation"></i> 添付容量が大きくなっています</b>' : ''}
        `;
    };

    proto.getTipsPhotoManagerItemName = function (photoManagerId = '') {
        if (!photoManagerId || typeof this.collectPhotoManagerItems !== 'function') return '';
        const item = this.collectPhotoManagerItems().find(entry => entry.id === photoManagerId);
        if (!item) return '';
        return this.getPhotoManagerName?.(item) || item.defaultName || item.title || item.displayName || '';
    };

    proto.getTipsAttachmentDisplayName = function (file = {}, index = 0) {
        if (file.source === 'photoManager') {
            const photoName = this.getTipsPhotoManagerItemName(file.photoManagerId || '');
            if (photoName) {
                const extension = this.getTipsImageAttachmentExtension(file.dataUrl || '');
                return `${photoName}.${extension}`;
            }
        }
        const directName = String(file.name || file.displayName || '').trim();
        if (directName) return directName;
        return `添付${index + 1}`;
    };

    proto.getTipsCardHtml = function (note) {
        const attachments = Array.isArray(note.attachments) ? note.attachments : [];
        const totalBytes = this.getTipsNoteAttachmentBytes(note);
        const duplicateCount = this.getTipsNoteDuplicateAttachmentCount(note);
        return `
            <article class="tips-note-card ${this._editingTipsId === note.id ? 'editing' : ''}" style="${this.getTipsCardStyle(note)}" draggable="true" onclick="app.onTipsCardClick(event, '${this.escapeJs(note.id)}')" ondragstart="app.startTipsNoteDrag(event, '${this.escapeJs(note.id)}')" ondragend="app.endTipsNoteDrag(event)">
                <div class="tips-note-top">
                    <div class="tips-note-badges">
                        <span class="tips-note-group">${this.escapeHtml(note.group || '未分類')}</span>
                        ${note.branch ? `<span class="tips-note-branch"><i class="fa-solid fa-code-branch"></i>${this.escapeHtml(note.branch)}</span>` : ''}
                    </div>
                    <time>${this.escapeHtml(this.formatTipsDateTime(note.createdAt))}</time>
                </div>
                <p class="tips-note-body">${this.escapeHtml(note.body || '').replace(/\n/g, '<br>')}</p>
                ${attachments.length ? `
                    <div class="tips-note-file-meta">
                        <span><i class="fa-solid fa-database"></i>${this.escapeHtml(this.formatTipsFileSize(totalBytes))}</span>
                        ${duplicateCount ? `<b><i class="fa-solid fa-copy"></i>重複 ${duplicateCount}</b>` : ''}
                    </div>
                ` : ''}
                ${attachments.length ? `
                    <div class="tips-attachments">
                        ${attachments.map((file, index) => `
                            <span class="tips-attachment-pill">
                                <button type="button" class="tips-attachment-pill-open" onclick="event.stopPropagation(); app.openTipsAttachment('${this.escapeJs(note.id)}', ${index})" title="${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}">
                                    <i class="fa-solid ${file.source === 'photoManager' ? 'fa-images' : 'fa-paperclip'}"></i>
                                    <span>${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}</span>
                                </button>
                                <button type="button" class="tips-attachment-pill-delete" onclick="event.stopPropagation(); app.deleteTipsAttachmentFromCard('${this.escapeJs(note.id)}', ${index})" title="この添付を削除">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </span>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="tips-note-actions">
                    <button type="button" class="tips-icon-btn" title="このTIPSを削除" onclick="event.stopPropagation(); app.deleteTipsNote('${this.escapeJs(note.id)}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </article>
        `;
    };

    proto.renderTipsSelectedFiles = function () {
        const box = document.getElementById('tips-selected-files');
        const input = document.getElementById('tips-file-input');
        if (!box || !input) return;
        const files = Array.from(input.files || []);
        const photoAttachments = Array.isArray(this._tipsPhotoManagerAttachments) ? this._tipsPhotoManagerAttachments : [];
        const allPending = [...files, ...photoAttachments];
        box.innerHTML = allPending.length
            ? `<b class="tips-file-section-title"><i class="fa-solid fa-plus"></i> 追加予定の添付</b>${this.getTipsAttachmentWarningHtml(allPending)}${this.getTipsDuplicateWarningHtml(allPending)}${files.map(file => `<span class="${file.size >= this.getTipsLargeAttachmentBytes() ? 'warn' : ''}"><i class="fa-solid fa-paperclip"></i>${this.escapeHtml(file.name)}<small>${this.formatTipsFileSize(file.size)}</small></span>`).join('')}${photoAttachments.map((file, index) => `<span class="tips-photo-manager-chip ${file.size >= this.getTipsLargeAttachmentBytes() ? 'warn' : ''}"><i class="fa-solid fa-images"></i>${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}<small>${this.formatTipsFileSize(file.size)}</small><button type="button" onclick="app.removeTipsPhotoManagerAttachment('${this.escapeJs(file.id)}')" title="この写真管理画像を外す"><i class="fa-solid fa-xmark"></i></button></span>`).join('')}`
            : '';
    };

    proto.renderTipsExistingFiles = function (note = null) {
        const box = document.getElementById('tips-existing-files');
        if (!box) return;
        const editingNote = note || (this._editingTipsId ? this.ensureTipsState().find(item => item.id === this._editingTipsId) : null);
        const attachments = Array.isArray(editingNote?.attachments) ? editingNote.attachments : [];
        box.hidden = !editingNote;
        if (!editingNote) {
            box.innerHTML = '';
            return;
        }
        box.innerHTML = `
            <b class="tips-file-section-title"><i class="fa-solid fa-paperclip"></i> 登録済み添付</b>
            ${attachments.length ? attachments.map((file, index) => `
                <div class="tips-existing-file-row">
                    <button type="button" class="tips-existing-file-open" onclick="app.openTipsAttachment('${this.escapeJs(editingNote.id)}', ${index})" title="${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}">
                        <i class="fa-solid fa-file"></i>
                        <span>${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}</span>
                        <small>${this.escapeHtml(this.formatTipsFileSize(file.size || 0))}</small>
                    </button>
                    <button type="button" class="tips-existing-file-replace" onclick="app.replaceTipsAttachment('${this.escapeJs(editingNote.id)}', ${index})" title="この添付を差し替え">
                        <i class="fa-solid fa-arrow-right-arrow-left"></i>
                    </button>
                    <button type="button" class="tips-existing-file-delete" onclick="app.deleteTipsAttachment('${this.escapeJs(editingNote.id)}', ${index})" title="この添付を削除">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `).join('') : '<span class="tips-existing-file-empty">登録済み添付はありません</span>'}
            ${attachments.length ? this.getTipsAttachmentTotalWarningHtml(attachments) : ''}
        `;
    };

    proto.getTipsLargeAttachmentBytes = function () {
        return 5 * 1024 * 1024;
    };

    proto.getTipsTotalAttachmentWarnBytes = function () {
        return 20 * 1024 * 1024;
    };

    proto.getTipsAttachmentWarningHtml = function (files = []) {
        const total = files.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
        const large = files.filter(file => (Number(file.size) || 0) >= this.getTipsLargeAttachmentBytes());
        if (!large.length && total < this.getTipsTotalAttachmentWarnBytes()) return '';
        const messages = [];
        if (large.length) messages.push(`5MB以上の添付が${large.length}件あります`);
        if (total >= this.getTipsTotalAttachmentWarnBytes()) messages.push(`追加分の合計が${this.formatTipsFileSize(total)}あります`);
        return `<div class="tips-file-warning"><i class="fa-solid fa-triangle-exclamation"></i><span>${this.escapeHtml(messages.join(' / '))}</span></div>`;
    };

    proto.getTipsDuplicateWarningHtml = function (files = []) {
        const existing = this.getTipsAttachmentDuplicateIndex();
        const pending = new Map();
        let count = 0;
        (files || []).forEach(file => {
            const key = this.getTipsAttachmentKey(file);
            const nextCount = (pending.get(key) || 0) + 1;
            pending.set(key, nextCount);
            if ((existing.get(key) || 0) > 0 || nextCount > 1) count += 1;
        });
        if (!count) return '';
        return `<div class="tips-file-warning duplicate"><i class="fa-solid fa-copy"></i><span>同じ添付が登録済みです: ${count}件</span></div>`;
    };

    proto.getTipsAttachmentTotalWarningHtml = function (attachments = []) {
        const total = attachments.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
        if (total < this.getTipsTotalAttachmentWarnBytes()) return '';
        return `<div class="tips-file-warning"><i class="fa-solid fa-database"></i><span>このTIPSの添付合計: ${this.escapeHtml(this.formatTipsFileSize(total))}</span></div>`;
    };

    proto.formatTipsFileSize = function (bytes = 0) {
        const size = Number(bytes) || 0;
        if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
        if (size >= 1024) return `${Math.round(size / 1024)}KB`;
        return `${size}B`;
    };

    proto.getTipsDataUrlMimeType = function (dataUrl = '') {
        return String(dataUrl || '').match(/^data:([^;,]+)/i)?.[1] || 'image/jpeg';
    };

    proto.estimateTipsDataUrlBytes = function (dataUrl = '') {
        const value = String(dataUrl || '');
        const payload = value.slice(value.indexOf(',') + 1);
        if (!payload) return 0;
        if (/;base64,/i.test(value)) return Math.max(0, Math.floor(payload.length * 3 / 4) - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0));
        try {
            return new Blob([decodeURIComponent(payload)]).size;
        } catch {
            return payload.length;
        }
    };

    proto.getTipsImageAttachmentExtension = function (dataUrl = '') {
        const type = this.getTipsDataUrlMimeType(dataUrl).toLowerCase();
        if (type.includes('png')) return 'png';
        if (type.includes('webp')) return 'webp';
        if (type.includes('gif')) return 'gif';
        if (type.includes('svg')) return 'svg';
        return 'jpg';
    };

    proto.createTipsPhotoManagerAttachment = function (item = {}, index = 0) {
        const src = item.src || '';
        const nameBase = this.getPhotoManagerName?.(item) || item.defaultName || item.title || item.displayName || item.name || '写真管理画像';
        const cleanName = String(nameBase).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 80) || '写真管理画像';
        const extension = this.getTipsImageAttachmentExtension(src);
        return {
            id: `tips_photo_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
            name: `${cleanName}.${extension}`,
            displayName: `${nameBase}.${extension}`,
            type: this.getTipsDataUrlMimeType(src),
            size: this.estimateTipsDataUrlBytes(src),
            dataUrl: src,
            source: 'photoManager',
            photoManagerId: item.id || ''
        };
    };

    proto.openTipsPhotoManagerPicker = function () {
        const input = document.getElementById('tips-photo-manager-input');
        if (!input) return this.showToast('写真管理の選択欄が見つかりません', 'error');
        if (typeof this.openImageSourceChoice !== 'function') {
            return this.showToast('写真管理から選択できません', 'warning');
        }
        input.multiple = true;
        this.openImageSourceChoice(input);
    };

    proto.addTipsPhotoManagerAttachments = function (items = []) {
        const selected = (items || []).filter(item => item?.src);
        if (!selected.length) return;
        if (!Array.isArray(this._tipsPhotoManagerAttachments)) this._tipsPhotoManagerAttachments = [];
        const existingKeys = new Set(this._tipsPhotoManagerAttachments.map(item => item.photoManagerId || item.dataUrl));
        const added = [];
        selected.forEach((item, index) => {
            const key = item.id || item.src;
            if (existingKeys.has(key)) return;
            const attachment = this.createTipsPhotoManagerAttachment(item, index);
            this._tipsPhotoManagerAttachments.push(attachment);
            existingKeys.add(key);
            added.push(attachment);
        });
        this.renderTipsSelectedFiles();
        this.showToast(added.length ? `写真管理画像を${added.length}件追加しました` : '選択済みの写真管理画像です', added.length ? 'success' : 'info');
    };

    proto.removeTipsPhotoManagerAttachment = function (id = '') {
        if (!Array.isArray(this._tipsPhotoManagerAttachments)) return;
        this._tipsPhotoManagerAttachments = this._tipsPhotoManagerAttachments.filter(item => item.id !== id);
        this.renderTipsSelectedFiles();
    };

    proto.openTipsAttachment = function (noteId, attachmentIndex = 0) {
        const note = this.ensureTipsState().find(item => item.id === noteId);
        const attachments = Array.isArray(note?.attachments) ? note.attachments : [];
        const safeIndex = Math.max(0, Math.min(Number(attachmentIndex) || 0, attachments.length - 1));
        const file = attachments[safeIndex];
        if (!file?.dataUrl) {
            this.showToast('添付ファイルを開けませんでした', 'error');
            return;
        }

        document.getElementById('tips-attachment-viewer')?.remove();
        const type = String(file.type || '');
        const name = this.getTipsAttachmentDisplayName(file, safeIndex) || 'attachment';
        const lowerName = name.toLowerCase();
        const isSpreadsheet = /\.(xlsx|xls|xlsm|xlsb|ods)$/i.test(lowerName);
        const isCsv = /\.csv$/i.test(lowerName) || type.includes('csv');
        let previewHtml = `
            <div class="tips-attachment-preview-empty">
                <i class="fa-solid fa-file"></i>
                <b>${this.escapeHtml(name)}</b>
                <span>${this.escapeHtml(type || 'file')} / ${this.escapeHtml(this.formatTipsFileSize(file.size || 0))}</span>
            </div>
        `;

        if (type.startsWith('image/')) {
            previewHtml = `<img class="tips-attachment-zoom-target tips-attachment-preview-image" src="${this.escapeHtml(file.dataUrl)}" alt="${this.escapeHtml(name)}">`;
        } else if (type === 'application/pdf') {
            previewHtml = `<iframe class="tips-attachment-zoom-target tips-attachment-preview-frame" src="${this.escapeHtml(file.dataUrl)}" title="${this.escapeHtml(name)}"></iframe>`;
        } else if (isSpreadsheet) {
            previewHtml = `
                <div class="tips-attachment-preview-empty">
                    <i class="fa-solid fa-file-excel"></i>
                    <b>Excelプレビューは無効です</b>
                    <span>Excelはダウンロードして確認してください。</span>
                </div>
            `;
        } else if (isCsv) {
            const rows = this.parseTipsCsv(this.decodeTipsTextAttachment(file.dataUrl));
            previewHtml = `<div class="tips-attachment-zoom-target tips-sheet-preview">${this.getTipsTablePreviewHtml(rows, 'CSV')}</div>`;
        } else if (type.startsWith('text/') || /\.(txt|log|md)$/i.test(name)) {
            const text = this.decodeTipsTextAttachment(file.dataUrl);
            previewHtml = `<pre class="tips-attachment-zoom-target tips-attachment-preview-text">${this.escapeHtml(text)}</pre>`;
        }

        this._tipsAttachmentZoom = 1;
        const prevIndex = safeIndex <= 0 ? attachments.length - 1 : safeIndex - 1;
        const nextIndex = safeIndex >= attachments.length - 1 ? 0 : safeIndex + 1;
        const tabsHtml = attachments.length > 1 ? `
            <nav class="tips-preview-tabs" aria-label="添付ファイル切替">
                ${attachments.map((item, index) => `
                    <button type="button" class="${index === safeIndex ? 'active' : ''}" onclick="app.openTipsAttachment('${this.escapeJs(noteId)}', ${index})" title="${this.escapeHtml(this.getTipsAttachmentDisplayName(item, index))}">
                        <i class="fa-solid ${this.getTipsFileType(item) === 'image' ? 'fa-file-image' : this.getTipsFileType(item) === 'pdf' ? 'fa-file-pdf' : this.getTipsFileType(item) === 'office' ? 'fa-file-lines' : 'fa-file'}"></i>
                        <span>${this.escapeHtml(this.getTipsAttachmentDisplayName(item, index))}</span>
                    </button>
                `).join('')}
            </nav>
        ` : '';
        document.body.insertAdjacentHTML('beforeend', `
            <div id="tips-attachment-viewer" class="tips-attachment-viewer" onclick="app.closeTipsAttachmentViewer(event)">
                <div class="tips-attachment-viewer-card ${attachments.length > 1 ? 'has-tabs' : ''}" onclick="event.stopPropagation()">
                    <header>
                        <div>
                            <b><i class="fa-solid fa-paperclip"></i>${this.escapeHtml(name)}</b>
                            <span>${attachments.length > 1 ? `${safeIndex + 1}/${attachments.length} ・ ` : ''}${this.escapeHtml(this.formatTipsFileSize(file.size || 0))}</span>
                        </div>
                        <div class="tips-attachment-header-actions">
                            ${attachments.length > 1 ? `
                                <div class="tips-preview-nav">
                                    <button type="button" onclick="app.openTipsAttachment('${this.escapeJs(noteId)}', ${prevIndex})" title="前の添付"><i class="fa-solid fa-chevron-left"></i></button>
                                    <span>${safeIndex + 1} / ${attachments.length}</span>
                                    <button type="button" onclick="app.openTipsAttachment('${this.escapeJs(noteId)}', ${nextIndex})" title="次の添付"><i class="fa-solid fa-chevron-right"></i></button>
                                </div>
                            ` : ''}
                            <div class="tips-attachment-zoom-controls" aria-label="プレビュー拡大縮小">
                                <button type="button" onclick="app.zoomTipsAttachment(-0.15)" title="縮小"><i class="fa-solid fa-minus"></i></button>
                                <span id="tips-attachment-zoom-label">100%</span>
                                <button type="button" onclick="app.zoomTipsAttachment(0.15)" title="拡大"><i class="fa-solid fa-plus"></i></button>
                                <button type="button" onclick="app.resetTipsAttachmentZoom()" title="等倍"><i class="fa-solid fa-maximize"></i></button>
                            </div>
                            <button type="button" class="tips-attachment-close" onclick="app.closeTipsAttachmentViewer()" title="閉じる">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </header>
                    ${tabsHtml}
                    <div class="tips-attachment-stage">${previewHtml}</div>
                    <footer>
                        <button type="button" class="tips-attachment-delete" onclick="app.deleteTipsAttachmentFromViewer('${this.escapeJs(noteId)}', ${safeIndex})">
                            <i class="fa-solid fa-trash-can"></i> 削除
                        </button>
                        <a class="primary-btn tips-attachment-download" href="${this.escapeHtml(file.dataUrl)}" download="${this.escapeHtml(name)}">
                            <i class="fa-solid fa-download"></i> ダウンロード
                        </a>
                    </footer>
                </div>
            </div>
        `);
        this.bindTipsAttachmentViewerKeys(noteId, safeIndex, attachments.length);
    };

    proto.bindTipsAttachmentViewerKeys = function (noteId, index = 0, total = 0) {
        if (this._tipsAttachmentKeydown) document.removeEventListener('keydown', this._tipsAttachmentKeydown);
        this._tipsAttachmentKeydown = event => {
            if (!document.getElementById('tips-attachment-viewer') || total <= 1) return;
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const next = event.key === 'ArrowLeft'
                ? (index <= 0 ? total - 1 : index - 1)
                : (index >= total - 1 ? 0 : index + 1);
            this.openTipsAttachment(noteId, next);
        };
        document.addEventListener('keydown', this._tipsAttachmentKeydown);
    };

    proto.deleteTipsAttachmentFromViewer = function (noteId, attachmentIndex = 0) {
        const note = this.ensureTipsState().find(item => item.id === noteId);
        const attachments = Array.isArray(note?.attachments) ? note.attachments : [];
        const file = attachments[attachmentIndex];
        if (!file) return;
        const name = this.getTipsAttachmentDisplayName(file, attachmentIndex);
        if (!confirm(`添付「${name}」を削除しますか？`)) return;

        attachments.splice(attachmentIndex, 1);
        note.updatedAt = new Date().toISOString();
        store.save();
        this.renderTipsExistingFiles(note);
        this.renderTips();

        if (!attachments.length) {
            this.closeTipsAttachmentViewer();
        } else {
            this.openTipsAttachment(noteId, Math.min(attachmentIndex, attachments.length - 1));
        }
        this.showToast('添付ファイルを削除しました', 'success');
    };

    proto.zoomTipsAttachment = function (delta = 0) {
        const current = Number(this._tipsAttachmentZoom || 1);
        this._tipsAttachmentZoom = Math.max(0.5, Math.min(2.5, current + delta));
        this.applyTipsAttachmentZoom();
    };

    proto.resetTipsAttachmentZoom = function () {
        this._tipsAttachmentZoom = 1;
        this.applyTipsAttachmentZoom();
    };

    proto.applyTipsAttachmentZoom = function () {
        const zoom = Number(this._tipsAttachmentZoom || 1);
        const target = document.querySelector('#tips-attachment-viewer .tips-attachment-zoom-target');
        const label = document.getElementById('tips-attachment-zoom-label');
        if (target) {
            target.style.transform = `scale(${zoom})`;
            target.style.transformOrigin = 'top left';
        }
        if (label) label.textContent = `${Math.round(zoom * 100)}%`;
    };

    proto.dataUrlToArrayBuffer = function (dataUrl = '') {
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    };

    proto.parseTipsCsv = function (text = '') {
        const rows = [];
        let row = [];
        let cell = '';
        let quoted = false;
        for (let i = 0; i < text.length; i += 1) {
            const char = text[i];
            const next = text[i + 1];
            if (char === '"' && quoted && next === '"') {
                cell += '"';
                i += 1;
            } else if (char === '"') {
                quoted = !quoted;
            } else if (char === ',' && !quoted) {
                row.push(cell);
                cell = '';
            } else if ((char === '\n' || char === '\r') && !quoted) {
                if (char === '\r' && next === '\n') i += 1;
                row.push(cell);
                rows.push(row);
                row = [];
                cell = '';
            } else {
                cell += char;
            }
        }
        if (cell || row.length) {
            row.push(cell);
            rows.push(row);
        }
        return rows.slice(0, 80);
    };

    proto.getTipsTablePreviewHtml = function (rows = [], sheetLabel = 'Sheet') {
        const safeRows = Array.isArray(rows) ? rows : [];
        if (!safeRows.length) {
            return `
                <div class="tips-attachment-preview-empty">
                    <i class="fa-solid fa-table"></i>
                    <b>表示できるデータがありません</b>
                </div>
            `;
        }
        const width = Math.max(...safeRows.map(row => Array.isArray(row) ? row.length : 0), 1);
        return `
            <div class="tips-sheet-head">
                <b><i class="fa-solid fa-table"></i>${this.escapeHtml(sheetLabel)}</b>
                <span>先頭 ${safeRows.length} 行を表示</span>
            </div>
            <table>
                <tbody>
                    ${safeRows.map((row, rowIndex) => `
                        <tr>
                            ${Array.from({ length: width }).map((_, colIndex) => {
                                const Tag = rowIndex === 0 ? 'th' : 'td';
                                return `<${Tag}>${this.escapeHtml(row?.[colIndex] ?? '')}</${Tag}>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    };

    proto.closeTipsAttachmentViewer = function (event) {
        if (event && event.target?.id !== 'tips-attachment-viewer') return;
        document.getElementById('tips-attachment-viewer')?.remove();
        if (this._tipsAttachmentKeydown) {
            document.removeEventListener('keydown', this._tipsAttachmentKeydown);
            this._tipsAttachmentKeydown = null;
        }
    };

    proto.decodeTipsTextAttachment = function (dataUrl = '') {
        try {
            const commaIndex = dataUrl.indexOf(',');
            if (commaIndex === -1) return '';
            const meta = dataUrl.slice(0, commaIndex);
            const payload = dataUrl.slice(commaIndex + 1);
            if (/;base64/i.test(meta)) {
                const binary = atob(payload);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
                return new TextDecoder('utf-8').decode(bytes);
            }
            return decodeURIComponent(payload);
        } catch (error) {
            return 'プレビューを表示できませんでした。ダウンロードして確認してください。';
        }
    };

    proto.readTipsFile = function (file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve({
                id: `tips_file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size || 0,
                dataUrl: event.target.result
            });
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    proto.saveTipsNote = async function () {
        const groupInput = document.getElementById('tips-group-input');
        const branchInput = document.getElementById('tips-branch-input');
        const bodyInput = document.getElementById('tips-body-input');
        const fileInput = document.getElementById('tips-file-input');
        const group = (groupInput?.value || '').trim() || '未分類';
        const branch = (branchInput?.value || '').trim();
        const body = (bodyInput?.value || '').trim();
        if (!body) {
            this.showToast('本文を入力してください', 'warning');
            bodyInput?.focus();
            return;
        }

        const files = Array.from(fileInput?.files || []);
        let attachments = [];
        try {
            attachments = await Promise.all(files.map(file => this.readTipsFile(file)));
        } catch (error) {
            console.error('Failed to read tips attachment', error);
            this.showToast('添付ファイルを読み込めませんでした', 'error');
            return;
        }
        const photoAttachments = Array.isArray(this._tipsPhotoManagerAttachments) ? this._tipsPhotoManagerAttachments : [];
        attachments = [...attachments, ...photoAttachments.map(item => ({ ...item }))];

        const notes = this.ensureTipsState();
        const editingId = this._editingTipsId || '';
        const existing = editingId ? notes.find(note => note.id === editingId) : null;
        if (existing) {
            existing.group = group;
            existing.branch = branch;
            existing.body = body;
            existing.updatedAt = new Date().toISOString();
            existing.attachments = [...(Array.isArray(existing.attachments) ? existing.attachments : []), ...attachments];
        } else {
            notes.unshift({
                id: `tips_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                group,
                branch,
                body,
                createdAt: new Date().toISOString(),
                attachments
            });
        }
        store.save();
        this.clearTipsForm();
        this.renderTips();
        this.showToast(existing ? 'TIPSを更新しました' : 'TIPSを登録しました', 'success');
    };

    proto.addTipsNote = function () {
        return this.saveTipsNote();
    };

    proto.clearTipsForm = function () {
        const groupInput = document.getElementById('tips-group-input');
        const branchInput = document.getElementById('tips-branch-input');
        const bodyInput = document.getElementById('tips-body-input');
        const fileInput = document.getElementById('tips-file-input');
        if (groupInput) groupInput.value = '';
        if (branchInput) branchInput.value = '';
        if (bodyInput) bodyInput.value = '';
        if (fileInput) fileInput.value = '';
        this._tipsPhotoManagerAttachments = [];
        this._editingTipsId = '';
        document.querySelector('.tips-compose-panel')?.classList.remove('editing');
        this.updateTipsEditStateUI();
        this.renderTipsExistingFiles();
        this.renderTipsSelectedFiles();
    };

    proto.editTipsNote = function (id) {
        const note = this.ensureTipsState().find(item => item.id === id);
        if (!note) return;
        this._editingTipsId = id;
        const groupInput = document.getElementById('tips-group-input');
        const branchInput = document.getElementById('tips-branch-input');
        const bodyInput = document.getElementById('tips-body-input');
        const fileInput = document.getElementById('tips-file-input');
        if (groupInput) groupInput.value = note.group || '';
        if (branchInput) branchInput.value = note.branch || '';
        if (bodyInput) {
            bodyInput.value = note.body || '';
            bodyInput.focus();
        }
        if (fileInput) fileInput.value = '';
        document.querySelector('.tips-compose-panel')?.classList.add('editing');
        this.renderTipsExistingFiles(note);
        this.renderTipsSelectedFiles();
        this.updateTipsEditStateUI(note);
        this.renderTips();
    };

    proto.cancelTipsEdit = function () {
        this.clearTipsForm();
        this.renderTips();
    };

    proto.deleteTipsAttachment = function (noteId, attachmentIndex = 0) {
        const note = this.ensureTipsState().find(item => item.id === noteId);
        if (!note || !Array.isArray(note.attachments)) return;
        const removed = note.attachments.splice(attachmentIndex, 1);
        if (!removed.length) return;
        note.updatedAt = new Date().toISOString();
        store.save();
        this.renderTipsExistingFiles(note);
        this.renderTips();
        this.showToast('添付ファイルを削除しました', 'success');
    };

    proto.deleteTipsAttachmentFromCard = function (noteId, attachmentIndex = 0) {
        const note = this.ensureTipsState().find(item => item.id === noteId);
        const attachments = Array.isArray(note?.attachments) ? note.attachments : [];
        const file = attachments[attachmentIndex];
        if (!file) return;
        const name = this.getTipsAttachmentDisplayName(file, attachmentIndex);
        if (!confirm(`添付「${name}」を削除しますか？`)) return;
        this.deleteTipsAttachment(noteId, attachmentIndex);
    };

    proto.replaceTipsAttachment = function (noteId, attachmentIndex = 0) {
        const note = this.ensureTipsState().find(item => item.id === noteId);
        if (!note || !Array.isArray(note.attachments)) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            if (file.size >= this.getTipsLargeAttachmentBytes()) {
                this.showToast(`大きい添付です: ${this.formatTipsFileSize(file.size)}`, 'warning');
            }
            try {
                note.attachments[attachmentIndex] = await this.readTipsFile(file);
                note.updatedAt = new Date().toISOString();
                store.save();
                this.renderTipsExistingFiles(note);
                this.renderTips();
                this.showToast('添付ファイルを差し替えました', 'success');
            } catch (error) {
                console.error('Failed to replace tips attachment', error);
                this.showToast('添付ファイルを差し替えできませんでした', 'error');
            }
        };
        input.click();
    };

    proto.getTipsLabelGroups = function (key = 'group') {
        const groups = new Map();
        this.ensureTipsState().forEach(note => {
            const label = (note?.[key] || '').trim();
            if (!label) return;
            const normalized = this.normalizeTipsLabel(label);
            if (!groups.has(normalized)) groups.set(normalized, { key: normalized, labels: new Map(), count: 0 });
            const group = groups.get(normalized);
            group.labels.set(label, (group.labels.get(label) || 0) + 1);
            group.count += 1;
        });
        return [...groups.values()]
            .map(group => ({
                key: group.key,
                count: group.count,
                labels: [...group.labels.entries()].map(([label, count]) => ({ label, count })),
                suggested: [...group.labels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
            }))
            .sort((a, b) => a.suggested.normalize('NFKC').localeCompare(b.suggested.normalize('NFKC'), 'ja'));
    };

    proto.openTipsLabelManager = function () {
        document.getElementById('tips-label-manager')?.remove();
        const sections = [
            { key: 'group', title: 'グループ名', icon: 'fa-layer-group' },
            { key: 'branch', title: 'グループ内分岐', icon: 'fa-code-branch' }
        ];
        document.body.insertAdjacentHTML('beforeend', `
            <div id="tips-label-manager" class="tips-label-manager" onclick="app.closeTipsLabelManager(event)">
                <div class="tips-label-manager-card" onclick="event.stopPropagation()">
                    <header>
                        <div>
                            <b><i class="fa-solid fa-tags"></i> 表記統一</b>
                            <span>全角/半角など同一扱いの表記をまとめて変更します</span>
                        </div>
                        <button type="button" onclick="app.closeTipsLabelManager()" title="閉じる"><i class="fa-solid fa-xmark"></i></button>
                    </header>
                    <div class="tips-label-manager-body">
                        ${sections.map(section => this.getTipsLabelManagerSectionHtml(section)).join('')}
                    </div>
                </div>
            </div>
        `);
    };

    proto.getTipsLabelManagerSectionHtml = function (section) {
        const groups = this.getTipsLabelGroups(section.key);
        return `
            <section class="tips-label-section">
                <h4><i class="fa-solid ${section.icon}"></i>${this.escapeHtml(section.title)}</h4>
                ${groups.length ? groups.map(group => `
                    <div class="tips-label-row">
                        <div class="tips-label-variants">
                            ${group.labels.map(item => `<span>${this.escapeHtml(item.label)}<small>${item.count}</small></span>`).join('')}
                        </div>
                        <input type="text" value="${this.escapeHtml(group.suggested)}" data-tips-label-key="${this.escapeHtml(section.key)}" data-tips-label-normalized="${this.escapeHtml(group.key)}">
                        <button type="button" onclick="app.applyTipsLabelRename('${this.escapeJs(section.key)}', '${this.escapeJs(group.key)}')">
                            <i class="fa-solid fa-check"></i> 統一
                        </button>
                    </div>
                `).join('') : '<p class="tips-label-empty">登録済み表記はありません</p>'}
            </section>
        `;
    };

    proto.applyTipsLabelRename = function (key = 'group', normalized = '') {
        const input = Array.from(document.querySelectorAll('[data-tips-label-key][data-tips-label-normalized]'))
            .find(el => el.dataset.tipsLabelKey === key && el.dataset.tipsLabelNormalized === normalized);
        const nextLabel = (input?.value || '').trim();
        if (!nextLabel) {
            this.showToast('統一後の表記を入力してください', 'warning');
            return;
        }
        let changed = 0;
        this.ensureTipsState().forEach(note => {
            if (this.normalizeTipsLabel(note?.[key] || '') === normalized && note[key] !== nextLabel) {
                note[key] = nextLabel;
                note.updatedAt = new Date().toISOString();
                changed += 1;
            }
        });
        if (!changed) {
            this.showToast('変更対象はありません', 'info');
            return;
        }
        store.save();
        this.renderTips();
        this.openTipsLabelManager();
        this.showToast(`${changed}件の表記を統一しました`, 'success');
    };

    proto.closeTipsLabelManager = function (event) {
        if (event && event.target?.id !== 'tips-label-manager') return;
        document.getElementById('tips-label-manager')?.remove();
    };

    proto.updateTipsEditStateUI = function (note = null) {
        const editingId = this._editingTipsId || '';
        const editingNote = note || (editingId ? this.ensureTipsState().find(item => item.id === editingId) : null);
        const saveBtn = document.getElementById('tips-save-btn');
        const cancelBtn = document.getElementById('tips-cancel-edit-btn');
        const hint = document.getElementById('tips-editing-hint');
        this.renderTipsExistingFiles(editingNote);
        if (saveBtn) {
            saveBtn.innerHTML = editingNote
                ? '<i class="fa-solid fa-floppy-disk"></i> 更新'
                : '<i class="fa-solid fa-plus"></i> 登録';
        }
        if (cancelBtn) cancelBtn.hidden = !editingNote;
        if (hint) {
            hint.hidden = !editingNote;
            hint.innerHTML = editingNote
                ? `<i class="fa-solid fa-pen-to-square"></i><span>編集中: ${this.escapeHtml(editingNote.group || '未分類')}${editingNote.branch ? ` / ${this.escapeHtml(editingNote.branch)}` : ''}</span>`
                : '';
        }
    };

    proto.setTipsDisplayMode = function (mode) {
        this.tipsDisplayMode = mode === 'time' ? 'time' : 'group';
        localStorage.setItem('tips_display_mode', this.tipsDisplayMode);
        this.renderTips();
    };

    proto.toggleTipsCompactMode = function () {
        this.tipsCompactMode = !this.tipsCompactMode;
        localStorage.setItem('tips_compact_mode', String(this.tipsCompactMode));
        this.renderTips();
    };

    proto.onTipsCardClick = function (event, id) {
        if (this._tipsDragging) return;
        if (event?.target?.closest?.('button, a')) return;
        this.editTipsNote(id);
    };

    proto.onTipsFileDragOver = function (event) {
        event.preventDefault();
        event.currentTarget?.classList.add('drag-over');
    };

    proto.onTipsFileDragLeave = function (event) {
        event.currentTarget?.classList.remove('drag-over');
    };

    proto.dropTipsFilesToForm = function (event) {
        event.preventDefault();
        event.currentTarget?.classList.remove('drag-over');
        const files = Array.from(event.dataTransfer?.files || []);
        if (!files.length) return;
        this.addTipsFilesToInput(files);
    };

    proto.addTipsFilesToInput = function (files = []) {
        const input = document.getElementById('tips-file-input');
        if (!input) return;
        if (typeof DataTransfer === 'undefined') {
            this.showToast('この環境ではドラッグ添付に対応していません', 'warning');
            return;
        }
        const transfer = new DataTransfer();
        [...Array.from(input.files || []), ...files].forEach(file => transfer.items.add(file));
        input.files = transfer.files;
        this.renderTipsSelectedFiles();
        this.showToast(`${files.length}件のファイルを追加しました`, 'success');
    };

    proto.startTipsNoteDrag = function (event, id) {
        this._tipsDragging = true;
        event.dataTransfer?.setData('text/plain', id);
        event.dataTransfer?.setData('application/x-tips-note-id', id);
        event.currentTarget?.classList.add('dragging');
        document.getElementById('tips-trash')?.classList.add('ready');
    };

    proto.endTipsNoteDrag = function (event) {
        event.currentTarget?.classList.remove('dragging');
        document.getElementById('tips-trash')?.classList.remove('ready', 'over');
        window.setTimeout(() => { this._tipsDragging = false; }, 0);
    };

    proto.onTipsTrashDragOver = function (event) {
        event.preventDefault();
        event.currentTarget?.classList.add('over');
    };

    proto.onTipsTrashDragLeave = function (event) {
        event.currentTarget?.classList.remove('over');
    };

    proto.dropTipsNoteToTrash = function (event) {
        event.preventDefault();
        const id = event.dataTransfer?.getData('application/x-tips-note-id') || event.dataTransfer?.getData('text/plain');
        event.currentTarget?.classList.remove('ready', 'over');
        if (id) this.deleteTipsNote(id, { fromDrop: true });
    };

    proto.deleteTipsNote = function (id, options = {}) {
        const notes = this.ensureTipsState();
        const before = notes.length;
        store.activeData.tipsNotes = notes.filter(note => note.id !== id);
        if (store.activeData.tipsNotes.length === before) return;
        store.save();
        this.renderTips();
        this.showToast(options.fromDrop ? 'TIPSをゴミ箱へ移動しました' : 'TIPSを削除しました', 'success');
    };

    document.addEventListener('change', event => {
        if (event.target?.id === 'tips-file-input') {
            window.app?.renderTipsSelectedFiles?.();
        }
    });
})();
