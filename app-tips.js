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

    proto.ensureTipsGroupColorStore = function () {
        const d = store.activeData || {};
        if (!d.tipsGroupColors || typeof d.tipsGroupColors !== 'object' || Array.isArray(d.tipsGroupColors)) d.tipsGroupColors = {};
        return d.tipsGroupColors;
    };

    proto.normalizeTipsColor = function (value = '') {
        const color = String(value || '').trim();
        return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '';
    };

    proto.hexToTipsRgb = function (hex = '') {
        const color = this.normalizeTipsColor(hex);
        if (!color) return null;
        return { r: parseInt(color.slice(1, 3), 16), g: parseInt(color.slice(3, 5), 16), b: parseInt(color.slice(5, 7), 16) };
    };

    proto.rgbToTipsHex = function (rgb = {}) {
        const clamp = value => Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
        return `#${[clamp(rgb.r), clamp(rgb.g), clamp(rgb.b)].map(value => value.toString(16).padStart(2, '0')).join('')}`;
    };

    proto.mixTipsColor = function (first = '#000000', second = '#ffffff', firstWeight = 0.5) {
        const a = this.hexToTipsRgb(first);
        const b = this.hexToTipsRgb(second);
        if (!a || !b) return first;
        const weight = Math.max(0, Math.min(1, Number(firstWeight)));
        return this.rgbToTipsHex({ r: a.r * weight + b.r * (1 - weight), g: a.g * weight + b.g * (1 - weight), b: a.b * weight + b.b * (1 - weight) });
    };

    proto.getTipsReadableTextColor = function (hex = '#2563eb') {
        return this.normalizeTipsColor(hex) ? this.mixTipsColor(hex, '#111827', 0.58) : '#1d4ed8';
    };

    proto.getTipsAutoCardColors = function (group = '') {
        const seed = this.normalizeTipsLabel(group || 'unclassified');
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

    proto.getTipsGroupBaseColor = function (group = '') {
        const key = this.normalizeTipsLabel(group || 'unclassified');
        return this.normalizeTipsColor(this.ensureTipsGroupColorStore()[key] || '');
    };

    proto.getTipsPaletteFromBaseColor = function (base = '') {
        const edge = this.normalizeTipsColor(base);
        if (!edge) return null;
        return { bg: this.mixTipsColor(edge, '#ffffff', 0.10), edge, chip: this.mixTipsColor(edge, '#ffffff', 0.22), text: this.getTipsReadableTextColor(edge) };
    };

    proto.getTipsCardColors = function (note = {}) {
        const group = note.group || 'unclassified';
        return this.getTipsPaletteFromBaseColor(this.getTipsGroupBaseColor(group)) || this.getTipsAutoCardColors(group);
    };
    proto.getTipsCardStyle = function (note = {}) {
        const c = this.getTipsCardColors(note);
        return `--tips-card-bg:${c.bg};--tips-card-edge:${c.edge};--tips-chip-bg:${c.chip};--tips-chip-text:${c.text};`;
    };

    proto.getTipsHierarchyStyle = function (level = 'group', label = '', note = {}) {
        const groupLabel = note.group || label || '';
        const c = this.getTipsCardColors({ group: groupLabel });
        const styles = {
            group: {
                bg: c.bg,
                edge: c.edge,
                chip: c.chip,
                text: c.text
            },
            branch: {
                bg: `color-mix(in srgb, ${c.bg} 58%, ${c.edge})`,
                edge: c.edge,
                chip: `color-mix(in srgb, ${c.chip} 66%, ${c.edge})`,
                text: c.text
            },
            subBranch: {
                bg: `color-mix(in srgb, ${c.bg} 82%, #ffffff)`,
                edge: `color-mix(in srgb, ${c.edge} 72%, #ffffff)`,
                chip: `color-mix(in srgb, ${c.chip} 86%, #ffffff)`,
                text: c.text
            },
            note: {
                bg: `color-mix(in srgb, ${c.bg} 62%, #ffffff)`,
                edge: `color-mix(in srgb, ${c.edge} 64%, #94a3b8)`,
                chip: `color-mix(in srgb, ${c.chip} 76%, #ffffff)`,
                text: c.text
            }
        };
        const style = styles[level] || styles.group;
        return `--tips-card-bg:${style.bg};--tips-card-edge:${style.edge};--tips-chip-bg:${style.chip};--tips-chip-text:${style.text};`;
    };

    proto.getTipsNoteHierarchyStyle = function (note = {}) {
        if (note.subBranch) return this.getTipsHierarchyStyle('subBranch', note.subBranch, note);
        if (note.branch) return this.getTipsHierarchyStyle('branch', note.branch, note);
        return this.getTipsHierarchyStyle('group', note.group || '', note);
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

        const mode = ['group', 'time', 'map'].includes(this.tipsDisplayMode) ? this.tipsDisplayMode : 'group';
        this.tipsDisplayMode = mode;
        if (typeof this.tipsCompactMode !== 'boolean') {
            this.tipsCompactMode = localStorage.getItem('tips_compact_mode') === 'true';
        }
        document.getElementById('tips-view-group')?.classList.toggle('active', mode === 'group');
        document.getElementById('tips-view-time')?.classList.toggle('active', mode === 'time');
        document.getElementById('tips-view-map')?.classList.toggle('active', mode === 'map');
        document.getElementById('tips-compact-toggle')?.classList.toggle('active', this.tipsCompactMode);
        document.getElementById('tips-list')?.classList.toggle('compact', this.tipsCompactMode);
        document.getElementById('tips-list')?.classList.toggle('map-mode', mode === 'map');

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
        const subBranchList = document.getElementById('tips-sub-branch-list');
        if (subBranchList) {
            const subBranches = this.collectTipsUniqueLabels(notes, 'subBranch');
            subBranchList.innerHTML = subBranches.map(branch => `<option value="${this.escapeHtml(branch)}"></option>`).join('');
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
                    note.subBranch,
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
        const heatPanelHtml = this.getTipsHeatPanelHtml(filtered);

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
            list.innerHTML = `${heatPanelHtml}<div class="tips-time-grid">${filtered.map(note => this.getTipsCardHtml(note)).join('')}</div>`;
            return;
        }

        if (mode === 'map') {
            list.innerHTML = `${heatPanelHtml}${this.getTipsMemoryMapHtmlV3(filtered)}`;
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
        list.innerHTML = heatPanelHtml + sortedGroups.map(({ label: group, items }) => `
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

    proto.getTipsDaysSince = function (value = '') {
        const time = new Date(value || 0).getTime();
        if (!time) return 9999;
        return Math.max(0, (Date.now() - time) / 86400000);
    };

    proto.getTipsRelatedCount = function (note = {}, notes = this.ensureTipsState()) {
        const group = this.normalizeTipsLabel(note.group || '');
        const branch = this.normalizeTipsLabel(note.branch || '');
        const subBranch = this.normalizeTipsLabel(note.subBranch || '');
        const attachmentKeys = new Set((Array.isArray(note.attachments) ? note.attachments : []).map(file => this.getTipsAttachmentKey(file)));
        return (notes || []).filter(other => {
            if (!other || other.id === note.id) return false;
            if (group && this.normalizeTipsLabel(other.group || '') === group) return true;
            if (branch && this.normalizeTipsLabel(other.branch || '') === branch) return true;
            if (subBranch && this.normalizeTipsLabel(other.subBranch || '') === subBranch) return true;
            return (Array.isArray(other.attachments) ? other.attachments : []).some(file => attachmentKeys.has(this.getTipsAttachmentKey(file)));
        }).length;
    };

    proto.getTipsHeatInfo = function (note = {}, notes = this.ensureTipsState()) {
        const updatedDays = this.getTipsDaysSince(note.updatedAt || note.createdAt);
        const viewedDays = this.getTipsDaysSince(note.lastViewedAt || '');
        const attachments = Array.isArray(note.attachments) ? note.attachments : [];
        const related = this.getTipsRelatedCount(note, notes);
        let score = 0;
        if (updatedDays <= 1) score += 34;
        else if (updatedDays <= 7) score += 24;
        else if (updatedDays <= 30) score += 12;
        if (viewedDays <= 1) score += 28;
        else if (viewedDays <= 7) score += 18;
        else if (viewedDays <= 30) score += 8;
        score += Math.min(18, attachments.length * 6);
        score += Math.min(20, related * 4);
        const level = score >= 62 ? 'hot' : score >= 36 ? 'warm' : score >= 16 ? 'cool' : 'cold';
        const label = level === 'hot' ? 'HOT' : level === 'warm' ? 'WARM' : level === 'cool' ? 'COOL' : 'COLD';
        return { score, level, label, related, viewedDays, updatedDays };
    };

    proto.getTipsHeatPanelHtml = function (notes = []) {
        const ranked = (Array.isArray(notes) ? notes : [])
            .map(note => ({ note, heat: this.getTipsHeatInfo(note, notes) }))
            .sort((a, b) => b.heat.score - a.heat.score);
        if (!ranked.length) return '';
        const hot = ranked.slice(0, 3);
        const cold = ranked
            .filter(item => item.heat.level === 'cold' || item.heat.updatedDays >= 60)
            .slice(-3)
            .reverse();
        const itemHtml = item => `
            <button type="button" onclick="app.editTipsNote('${this.escapeJs(item.note.id)}')">
                <span class="tips-heat-dot ${this.escapeHtml(item.heat.level)}"></span>
                <b>${this.escapeHtml(item.note.group || '未分類')}</b>
                <small>${item.heat.score}pt</small>
            </button>
        `;
        return `
            <div class="tips-heat-panel">
                <div class="tips-heat-panel-head">
                    <span><i class="fa-solid fa-temperature-half"></i> 記憶の温度</span>
                    <small>更新・閲覧・添付・関連から自動判定</small>
                </div>
                <div class="tips-heat-lanes">
                    <section>
                        <b>温度高め</b>
                        <div>${hot.map(itemHtml).join('')}</div>
                    </section>
                    <section>
                        <b>見直し候補</b>
                        <div>${cold.length ? cold.map(itemHtml).join('') : '<span class="tips-heat-empty">候補なし</span>'}</div>
                    </section>
                </div>
            </div>
        `;
    };

    proto.markTipsNoteViewed = function (noteId = '') {
        const note = this.ensureTipsState().find(item => item.id === noteId);
        if (!note) return null;
        note.lastViewedAt = new Date().toISOString();
        store.save();
        return note;
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
        const heat = this.getTipsHeatInfo(note);
        return `
            <article class="tips-note-card ${this._editingTipsId === note.id ? 'editing' : ''}" style="${this.getTipsCardStyle(note)}" draggable="true" onclick="app.onTipsCardClick(event, '${this.escapeJs(note.id)}')" ondragstart="app.startTipsNoteDrag(event, '${this.escapeJs(note.id)}')" ondragend="app.endTipsNoteDrag(event)">
                <div class="tips-note-top">
                    <div class="tips-note-badges">
                        <span class="tips-note-group">${this.escapeHtml(note.group || '未分類')}</span>
                        ${note.branch ? `<span class="tips-note-branch"><i class="fa-solid fa-code-branch"></i>${this.escapeHtml(note.branch)}</span>` : ''}
                        ${note.subBranch ? `<span class="tips-note-sub-branch"><i class="fa-solid fa-turn-down"></i>${this.escapeHtml(note.subBranch)}</span>` : ''}
                        <span class="tips-note-heat ${this.escapeHtml(heat.level)}"><i class="fa-solid fa-temperature-half"></i>${this.escapeHtml(heat.label)} ${heat.score}</span>
                    </div>
                    <time>${this.escapeHtml(this.formatTipsDateTime(note.createdAt))}</time>
                </div>
                <p class="tips-note-body">${this.renderTipsBodyHtml(note.body || '')}</p>
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

    proto.getTipsMemoryMapHtml = function (notes = []) {
        const safeNotes = Array.isArray(notes) ? notes : [];
        const groups = new Map();
        safeNotes.forEach(note => {
            const groupLabel = (note.group || '未分類').trim() || '未分類';
            const groupKey = this.normalizeTipsLabel(groupLabel) || '未分類';
            const branchLabel = (note.branch || '分岐なし').trim() || '分岐なし';
            const branchKey = this.normalizeTipsLabel(branchLabel) || '分岐なし';
            if (!groups.has(groupKey)) {
                groups.set(groupKey, { label: groupLabel, branches: new Map(), notes: [] });
            }
            const group = groups.get(groupKey);
            if (!group.branches.has(branchKey)) {
                group.branches.set(branchKey, { label: branchLabel, notes: [] });
            }
            group.branches.get(branchKey).notes.push(note);
            group.notes.push(note);
        });

        const attachmentCount = safeNotes.reduce((sum, note) => sum + (Array.isArray(note.attachments) ? note.attachments.length : 0), 0);
        const branchCount = [...groups.values()].reduce((sum, group) => sum + group.branches.size, 0);
        const groupHtml = [...groups.values()]
            .sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'))
            .map(group => {
                const groupBytes = group.notes.reduce((sum, note) => sum + this.getTipsNoteAttachmentBytes(note), 0);
                const branches = [...group.branches.values()]
                    .sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
                return `
                    <section class="tips-map-group" style="${this.getTipsCardStyle(group.notes[0] || {})}">
                        <div class="tips-map-hub">
                            <span class="tips-map-hub-icon"><i class="fa-solid fa-layer-group"></i></span>
                            <div>
                                <b>${this.escapeHtml(group.label)}</b>
                                <small>${group.notes.length}件 / ${branches.length}分岐 / ${this.escapeHtml(this.formatTipsFileSize(groupBytes))}</small>
                            </div>
                        </div>
                        <div class="tips-map-branches">
                            ${branches.map(branch => `
                                <div class="tips-map-branch">
                                    <div class="tips-map-branch-label">
                                        <i class="fa-solid fa-code-branch"></i>
                                        <span>${this.escapeHtml(branch.label)}</span>
                                        <small>${branch.notes.length}件</small>
                                    </div>
                                    <div class="tips-map-note-row">
                                        ${branch.notes
                                            .slice()
                                            .sort((a, b) => this.compareTipsNotes(a, b, 'updatedDesc'))
                                            .map(note => this.getTipsMemoryMapNoteHtml(note))
                                            .join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                `;
            }).join('');

        return `
            <div class="tips-memory-map">
                <div class="tips-map-summary">
                    <div class="tips-map-bulk-actions">
                        <button type="button" onclick="app.setTipsMapCollapseAll(false)">
                            <i class="fa-solid fa-up-right-and-down-left-from-center"></i> 全て開く
                        </button>
                        <button type="button" onclick="app.setTipsMapCollapseAll(true)">
                            <i class="fa-solid fa-down-left-and-up-right-to-center"></i> 全て閉じる
                        </button>
                    </div>
                    <span><i class="fa-solid fa-diagram-project"></i> 記憶マップ</span>
                    <b>${safeNotes.length}件</b>
                    <b>${groups.size}グループ</b>
                    <b>${branchCount}分岐</b>
                    <b>${attachmentCount}添付</b>
                </div>
                ${groupHtml}
            </div>
        `;
    };

    proto.getTipsMemoryMapNoteHtml = function (note = {}) {
        const attachments = Array.isArray(note.attachments) ? note.attachments : [];
        const body = String(note.body || '').trim();
        const summary = body.length > 58 ? `${body.slice(0, 58)}...` : body;
        return `
            <article class="tips-map-note" onclick="app.editTipsNote('${this.escapeJs(note.id)}')" title="クリックで編集">
                <div class="tips-map-note-head">
                    <i class="fa-regular fa-note-sticky"></i>
                    <time>${this.escapeHtml(this.formatTipsDateTime(note.updatedAt || note.createdAt))}</time>
                </div>
                <p>${this.escapeHtml(summary || '本文なし')}</p>
                ${attachments.length ? `
                    <div class="tips-map-attachments">
                        ${attachments.slice(0, 3).map((file, index) => `
                            <button type="button" onclick="event.stopPropagation(); app.openTipsAttachment('${this.escapeJs(note.id)}', ${index})" title="${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}">
                                <i class="fa-solid ${file.source === 'photoManager' ? 'fa-images' : 'fa-paperclip'}"></i>
                                <span>${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}</span>
                            </button>
                        `).join('')}
                        ${attachments.length > 3 ? `<small>+${attachments.length - 3}</small>` : ''}
                    </div>
                ` : ''}
            </article>
        `;
    };

    proto.ensureTipsMapState = function () {
        if (!(this._tipsMapCollapsedGroups instanceof Set)) {
            try {
                this._tipsMapCollapsedGroups = new Set(JSON.parse(localStorage.getItem('tips_map_collapsed_groups') || '[]'));
            } catch {
                this._tipsMapCollapsedGroups = new Set();
            }
        }
        if (!(this._tipsMapCollapsedBranches instanceof Set)) {
            try {
                this._tipsMapCollapsedBranches = new Set(JSON.parse(localStorage.getItem('tips_map_collapsed_branches') || '[]'));
            } catch {
                this._tipsMapCollapsedBranches = new Set();
            }
        }
    };

    proto.saveTipsMapState = function () {
        this.ensureTipsMapState();
        localStorage.setItem('tips_map_collapsed_groups', JSON.stringify([...this._tipsMapCollapsedGroups]));
        localStorage.setItem('tips_map_collapsed_branches', JSON.stringify([...this._tipsMapCollapsedBranches]));
    };

    proto.getTipsMemoryMapHtmlV2 = function (notes = []) {
        const safeNotes = Array.isArray(notes) ? notes : [];
        this.ensureTipsMapState();
        const groups = new Map();
        safeNotes.forEach(note => {
            const groupLabel = (note.group || '未分類').trim() || '未分類';
            const groupKey = this.normalizeTipsLabel(groupLabel) || '未分類';
            const branchLabel = (note.branch || '分岐なし').trim() || '分岐なし';
            const branchKey = this.normalizeTipsLabel(branchLabel) || '分岐なし';
            const subBranchLabel = (note.subBranch || '').trim();
            const subBranchKey = this.normalizeTipsLabel(subBranchLabel || '');
            if (!groups.has(groupKey)) groups.set(groupKey, { key: groupKey, label: groupLabel, branches: new Map(), notes: [] });
            const group = groups.get(groupKey);
            if (!group.branches.has(branchKey)) group.branches.set(branchKey, { key: branchKey, label: branchLabel, notes: [], directNotes: [], children: new Map() });
            const branch = group.branches.get(branchKey);
            branch.notes.push(note);
            if (subBranchLabel) {
                if (!branch.children.has(subBranchKey)) branch.children.set(subBranchKey, { key: subBranchKey, label: subBranchLabel, notes: [] });
                branch.children.get(subBranchKey).notes.push(note);
            } else {
                branch.directNotes.push(note);
            }
            group.notes.push(note);
        });

        const sortedGroups = [...groups.values()].sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
        const attachmentCount = safeNotes.reduce((sum, note) => sum + (Array.isArray(note.attachments) ? note.attachments.length : 0), 0);
        const branchCount = sortedGroups.reduce((sum, group) => sum + group.branches.size, 0);
        const groupHtml = sortedGroups.map(group => {
            const groupBytes = group.notes.reduce((sum, note) => sum + this.getTipsNoteAttachmentBytes(note), 0);
            const branches = [...group.branches.values()].sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
            const groupCollapsed = this._tipsMapCollapsedGroups.has(group.key);
            return `
                <section class="tips-map-group ${groupCollapsed ? 'collapsed' : ''}" id="tips-map-group-${this.escapeHtml(group.key)}" style="${this.getTipsCardStyle(group.notes[0] || {})}">
                    <div class="tips-map-hub">
                        <span class="tips-map-hub-icon"><i class="fa-solid fa-layer-group"></i></span>
                        <div>
                            <b>${this.escapeHtml(group.label)}</b>
                            <small>${group.notes.length}件 / ${branches.length}分岐 / ${this.escapeHtml(this.formatTipsFileSize(groupBytes))}</small>
                        </div>
                        <div class="tips-map-label-actions">
                            <button type="button" class="tips-map-color-btn" onclick="app.openTipsGroupColorDialog('${this.escapeJs(group.key)}', '${this.escapeJs(group.label)}')" title="系統色を変更"><i class="fa-solid fa-palette"></i></button>
                            <button type="button" onclick="app.renameTipsMapLabel('group', '${this.escapeJs(group.key)}', '${this.escapeJs(group.label)}')" title="グループ名を変更"><i class="fa-solid fa-pen"></i></button>
                            <button type="button" onclick="app.toggleTipsMapGroup('${this.escapeJs(group.key)}')" title="${groupCollapsed ? '開く' : '折りたたむ'}"><i class="fa-solid ${groupCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
                        </div>
                    </div>
                    <div class="tips-map-branches">
                        ${branches.map(branch => {
                            const branchStateKey = `${group.key}::${branch.key}`;
                            const branchCollapsed = this._tipsMapCollapsedBranches.has(branchStateKey);
                            return `
                                <div class="tips-map-branch ${branchCollapsed ? 'collapsed' : ''}">
                                    <div class="tips-map-branch-label">
                                        <i class="fa-solid fa-code-branch"></i>
                                        <span>${this.escapeHtml(branch.label)}</span>
                                        <small>${branch.notes.length}件</small>
                                        <button type="button" onclick="app.renameTipsMapLabel('branch', '${this.escapeJs(branch.key)}', '${this.escapeJs(branch.label)}')" title="分岐名を変更"><i class="fa-solid fa-pen"></i></button>
                                        <button type="button" onclick="app.toggleTipsMapBranch('${this.escapeJs(group.key)}', '${this.escapeJs(branch.key)}')" title="${branchCollapsed ? '開く' : '折りたたむ'}"><i class="fa-solid ${branchCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
                                    </div>
                                    <div class="tips-map-note-row">
                                        ${branch.notes
                                            .slice()
                                            .sort((a, b) => this.compareTipsNotes(a, b, 'updatedDesc'))
                                            .map(note => this.getTipsMemoryMapNoteHtml(note))
                                            .join('')}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </section>
            `;
        }).join('');

        return `
            <div class="tips-memory-map">
                <div class="tips-map-summary">
                    <span><i class="fa-solid fa-diagram-project"></i> 記憶マップ</span>
                    <b>${safeNotes.length}件</b>
                    <b>${sortedGroups.length}グループ</b>
                    <b>${branchCount}分岐</b>
                    <b>${attachmentCount}添付</b>
                </div>
                <div class="tips-map-bulk-actions">
                    <button type="button" onclick="app.setTipsMapCollapseAll(false)">
                        <i class="fa-solid fa-up-right-and-down-left-from-center"></i> 全て開く
                    </button>
                    <button type="button" onclick="app.setTipsMapCollapseAll(true)">
                        <i class="fa-solid fa-down-left-and-up-right-to-center"></i> 全て閉じる
                    </button>
                </div>
                <div class="tips-map-minimap">
                    <b><i class="fa-solid fa-map"></i> ミニマップ</b>
                    <div>
                        ${sortedGroups.map(group => `
                            <button type="button" onclick="app.scrollToTipsMapGroup('${this.escapeJs(group.key)}')" style="${this.getTipsHierarchyStyle('group', group.label, group.notes[0] || {})}">
                                <span>${this.escapeHtml(group.label)}</span>
                                <small>${group.notes.length}</small>
                            </button>
                        `).join('')}
                    </div>
                </div>
                ${groupHtml}
            </div>
        `;
    };

    proto.toggleTipsMapGroup = function (groupKey = '') {
        this.ensureTipsMapState();
        if (this._tipsMapCollapsedGroups.has(groupKey)) this._tipsMapCollapsedGroups.delete(groupKey);
        else this._tipsMapCollapsedGroups.add(groupKey);
        this.saveTipsMapState();
        this.renderTips();
    };

    proto.toggleTipsMapBranch = function (groupKey = '', branchKey = '') {
        this.ensureTipsMapState();
        const key = `${groupKey}::${branchKey}`;
        if (this._tipsMapCollapsedBranches.has(key)) this._tipsMapCollapsedBranches.delete(key);
        else this._tipsMapCollapsedBranches.add(key);
        this.saveTipsMapState();
        this.renderTips();
    };

    proto.setTipsMapCollapseAll = function (collapsed = false) {
        this.ensureTipsMapState();
        this._tipsMapCollapsedGroups.clear();
        this._tipsMapCollapsedBranches.clear();
        if (collapsed) {
            const groups = new Map();
            this.ensureTipsState().forEach(note => {
                const groupLabel = (note.group || '未分類').trim() || '未分類';
                const branchLabel = (note.branch || '分岐なし').trim() || '分岐なし';
                const groupKey = this.normalizeTipsLabel(groupLabel) || '未分類';
                const branchKey = this.normalizeTipsLabel(branchLabel) || '分岐なし';
                if (!groups.has(groupKey)) groups.set(groupKey, new Set());
                groups.get(groupKey).add(branchKey);
            });
            groups.forEach((branches, groupKey) => {
                this._tipsMapCollapsedGroups.add(groupKey);
                branches.forEach(branchKey => this._tipsMapCollapsedBranches.add(`${groupKey}::${branchKey}`));
            });
        }
        this.saveTipsMapState();
        this.renderTips();
    };

    proto.getTipsMapLayout = function () {
        return localStorage.getItem('tips_map_layout') === 'circle' ? 'circle' : 'tree';
    };

    proto.setTipsMapLayout = function (layout = 'tree') {
        localStorage.setItem('tips_map_layout', layout === 'circle' ? 'circle' : 'tree');
        this.renderTips();
    };

    proto.collectTipsMapGroups = function (notes = []) {
        const groups = new Map();
        (Array.isArray(notes) ? notes : []).forEach(note => {
            const groupLabel = (note.group || '未分類').trim() || '未分類';
            const groupKey = this.normalizeTipsLabel(groupLabel) || '未分類';
            const branchLabel = (note.branch || '分岐なし').trim() || '分岐なし';
            const branchKey = this.normalizeTipsLabel(branchLabel) || '分岐なし';
            if (!groups.has(groupKey)) groups.set(groupKey, { key: groupKey, label: groupLabel, branches: new Map(), notes: [] });
            const group = groups.get(groupKey);
            if (!group.branches.has(branchKey)) group.branches.set(branchKey, { key: branchKey, label: branchLabel, notes: [] });
            group.branches.get(branchKey).notes.push(note);
            group.notes.push(note);
        });
        return [...groups.values()].sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
    };

    proto.collectTipsMapGroupsV4 = function (notes = []) {
        const groups = new Map();
        (Array.isArray(notes) ? notes : []).forEach(note => {
            const groupLabel = (note.group || '未分類').trim() || '未分類';
            const groupKey = this.normalizeTipsLabel(groupLabel) || '未分類';
            const branchLabel = (note.branch || '分岐なし').trim() || '分岐なし';
            const branchKey = this.normalizeTipsLabel(branchLabel) || '分岐なし';
            const subBranchLabel = (note.subBranch || '').trim();
            const subBranchKey = this.normalizeTipsLabel(subBranchLabel || '');
            if (!groups.has(groupKey)) groups.set(groupKey, { key: groupKey, label: groupLabel, branches: new Map(), notes: [] });
            const group = groups.get(groupKey);
            if (!group.branches.has(branchKey)) {
                group.branches.set(branchKey, { key: branchKey, label: branchLabel, notes: [], directNotes: [], children: new Map() });
            }
            const branch = group.branches.get(branchKey);
            branch.notes.push(note);
            if (subBranchLabel) {
                if (!branch.children.has(subBranchKey)) branch.children.set(subBranchKey, { key: subBranchKey, label: subBranchLabel, notes: [] });
                branch.children.get(subBranchKey).notes.push(note);
            } else {
                branch.directNotes.push(note);
            }
            group.notes.push(note);
        });
        return [...groups.values()].sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
    };

    proto.getTipsMemoryMapHtmlV3 = function (notes = []) {
        const safeNotes = Array.isArray(notes) ? notes : [];
        this.ensureTipsMapState();
        const sortedGroups = this.collectTipsMapGroupsV4(safeNotes);
        const layout = this.getTipsMapLayout();
        const attachmentCount = safeNotes.reduce((sum, note) => sum + (Array.isArray(note.attachments) ? note.attachments.length : 0), 0);
        const branchCount = sortedGroups.reduce((sum, group) => sum + group.branches.size, 0);
        const bodyHtml = layout === 'circle'
            ? this.getTipsMemoryMapCircleHtml(sortedGroups)
            : this.getTipsMemoryMapTreeHtml(sortedGroups);
        return `
            <div class="tips-memory-map ${this.escapeHtml(layout)} ${this.tipsCompactMode ? 'compact' : ''}">
                <div class="tips-map-summary">
                    <span><i class="fa-solid fa-diagram-project"></i> 記憶マップ</span>
                    <b>${safeNotes.length}件</b>
                    <b>${sortedGroups.length}グループ</b>
                    <b>${branchCount}分岐</b>
                    <b>${attachmentCount}添付</b>
                </div>
                <div class="tips-map-layout-toggle">
                    <button type="button" class="${layout === 'tree' ? 'active' : ''}" onclick="app.setTipsMapLayout('tree')">
                        <i class="fa-solid fa-sitemap"></i> 階層
                    </button>
                    <button type="button" class="${layout === 'circle' ? 'active' : ''}" onclick="app.setTipsMapLayout('circle')">
                        <i class="fa-regular fa-circle-dot"></i> サークル
                    </button>
                </div>
                <div class="tips-map-bulk-actions">
                    <button type="button" onclick="app.setTipsMapCollapseAll(false)">
                        <i class="fa-solid fa-up-right-and-down-left-from-center"></i> 全て開く
                    </button>
                    <button type="button" onclick="app.setTipsMapCollapseAll(true)">
                        <i class="fa-solid fa-down-left-and-up-right-to-center"></i> 全て閉じる
                    </button>
                </div>
                <div class="tips-map-minimap">
                    <b><i class="fa-solid fa-map"></i> ミニマップ</b>
                    <div>
                        ${sortedGroups.map(group => `
                            <button type="button" onclick="app.scrollToTipsMapGroup('${this.escapeJs(group.key)}')" style="${this.getTipsHierarchyStyle('group', group.label, group.notes[0] || {})}">
                                <span>${this.escapeHtml(group.label)}</span>
                                <small>${group.notes.length}</small>
                            </button>
                        `).join('')}
                    </div>
                </div>
                ${bodyHtml}
            </div>
        `;
    };

    proto.getTipsMemoryMapTreeHtml = function (sortedGroups = []) {
        return sortedGroups.map(group => {
            const groupBytes = group.notes.reduce((sum, note) => sum + this.getTipsNoteAttachmentBytes(note), 0);
            const branches = [...group.branches.values()].sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
            const groupCollapsed = this._tipsMapCollapsedGroups.has(group.key);
            return `
                <section class="tips-map-group ${groupCollapsed ? 'collapsed' : ''}" id="tips-map-group-${this.escapeHtml(group.key)}" style="${this.getTipsHierarchyStyle('group', group.label, group.notes[0] || {})}">
                    <div class="tips-map-hub">
                        <span class="tips-map-hub-icon"><i class="fa-solid fa-layer-group"></i></span>
                        <div>
                            <b>${this.escapeHtml(group.label)}</b>
                            <small>${group.notes.length}件 / ${branches.length}分岐 / ${this.escapeHtml(this.formatTipsFileSize(groupBytes))}</small>
                        </div>
                        <div class="tips-map-label-actions">
                            <button type="button" class="tips-map-color-btn" onclick="app.openTipsGroupColorDialog('${this.escapeJs(group.key)}', '${this.escapeJs(group.label)}')" title="系統色を変更"><i class="fa-solid fa-palette"></i></button>
                            <button type="button" onclick="app.renameTipsMapLabel('group', '${this.escapeJs(group.key)}', '${this.escapeJs(group.label)}')" title="グループ名を変更"><i class="fa-solid fa-pen"></i></button>
                            <button type="button" onclick="app.toggleTipsMapGroup('${this.escapeJs(group.key)}')" title="${groupCollapsed ? '開く' : '折りたたむ'}"><i class="fa-solid ${groupCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
                        </div>
                    </div>
                    <div class="tips-map-branches">
                        ${branches.map(branch => {
                            const branchKey = `${group.key}::${branch.key}`;
                            const branchCollapsed = this._tipsMapCollapsedBranches.has(branchKey);
                            return `
                                <div class="tips-map-branch ${branchCollapsed ? 'collapsed' : ''}" style="${this.getTipsHierarchyStyle('branch', branch.label, branch.notes?.[0] || {})}">
                                    <div class="tips-map-branch-label">
                                        <i class="fa-solid fa-code-branch"></i>
                                        <span>${this.escapeHtml(branch.label)}</span>
                                        <small>${branch.notes.length}件</small>
                                        <button type="button" onclick="app.renameTipsMapLabel('branch', '${this.escapeJs(branch.key)}', '${this.escapeJs(branch.label)}')" title="分岐名を変更"><i class="fa-solid fa-pen"></i></button>
                                        <button type="button" onclick="app.toggleTipsMapBranch('${this.escapeJs(group.key)}', '${this.escapeJs(branch.key)}')" title="${branchCollapsed ? '開く' : '折りたたむ'}"><i class="fa-solid ${branchCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
                                    </div>
                                    ${this.getTipsMapBranchBodyHtml(branch)}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </section>
            `;
        }).join('');
    };

    proto.getTipsMapBranchBodyHtml = function (branch = {}) {
        const directNotes = Array.isArray(branch.directNotes) ? branch.directNotes : [];
        const children = [...(branch.children?.values?.() || [])]
            .sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
        return `
            ${children.length ? `
                <div class="tips-map-subbranches">
                    ${children.map(child => `
                        <section class="tips-map-subbranch" style="${this.getTipsHierarchyStyle('subBranch', child.label, child.notes?.[0] || {})}">
                            <div class="tips-map-subbranch-label">
                                <i class="fa-solid fa-turn-down"></i>
                                <span>${this.escapeHtml(child.label)}</span>
                                <small>${child.notes.length}件</small>
                                <button type="button" onclick="app.renameTipsMapLabelV2('subBranch', '${this.escapeJs(child.key)}', '${this.escapeJs(child.label)}')" title="下位分岐名を変更"><i class="fa-solid fa-pen"></i></button>
                            </div>
                            <div class="tips-map-note-row">
                                ${child.notes.slice().sort((a, b) => this.compareTipsNotes(a, b, 'updatedDesc')).map(note => this.getTipsMemoryMapNoteHtml(note)).join('')}
                            </div>
                        </section>
                    `).join('')}
                </div>
            ` : ''}
            ${directNotes.length ? `
                <div class="tips-map-note-row tips-map-direct-notes">
                    ${directNotes.slice().sort((a, b) => this.compareTipsNotes(a, b, 'updatedDesc')).map(note => this.getTipsMemoryMapNoteHtml(note)).join('')}
                </div>
            ` : ''}
        `;
    };

    proto.getTipsMemoryMapCircleHtml = function (sortedGroups = []) {
        return `<div class="tips-map-circle-grid">${sortedGroups.map(group => this.getTipsMemoryMapCircleGroupHtmlV2(group)).join('')}</div>`;
    };

    proto.getTipsMemoryMapCircleGroupHtml = function (group = {}) {
        const branches = [...(group.branches?.values?.() || [])].sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
        const nodes = [];
        branches.forEach((branch, branchIndex) => {
            const baseAngle = (Math.PI * 2 * branchIndex) / Math.max(branches.length, 1) - Math.PI / 2;
            nodes.push({
                type: 'branch',
                label: branch.label,
                count: branch.notes.length,
                angle: baseAngle,
                radius: 30,
                html: `<button type="button" class="tips-circle-node branch" onclick="app.renameTipsMapLabel('branch', '${this.escapeJs(branch.key)}', '${this.escapeJs(branch.label)}')" title="分岐名を変更"><i class="fa-solid fa-code-branch"></i><span>${this.escapeHtml(branch.label)}</span><small>${branch.notes.length}</small></button>`
            });
            const childList = [...(branch.children?.values?.() || [])].sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
            childList.forEach((child, childIndex) => {
                const childOffset = (childIndex - (childList.length - 1) / 2) * 0.42;
                nodes.push({
                    type: 'subbranch',
                    angle: baseAngle + childOffset,
                    radius: 34,
                    html: `<button type="button" class="tips-circle-node subbranch" onclick="app.renameTipsMapLabelV2('subBranch', '${this.escapeJs(child.key)}', '${this.escapeJs(child.label)}')" title="下位分岐名を変更"><i class="fa-solid fa-turn-down"></i><span>${this.escapeHtml(child.label)}</span><small>${child.notes.length}</small></button>`
                });
            });
            const notes = (childList.length ? childList.flatMap(child => child.notes) : (branch.directNotes || branch.notes || []))
                .slice()
                .sort((a, b) => this.compareTipsNotes(a, b, 'updatedDesc'))
                .slice(0, 8);
            notes.forEach((note, noteIndex) => {
                const spread = Math.min(0.7, Math.PI / Math.max(notes.length + 1, 3));
                const offset = (noteIndex - (notes.length - 1) / 2) * spread;
                const body = String(note.body || '').trim();
                const summary = body.length > 22 ? `${body.slice(0, 22)}...` : body;
                nodes.push({
                    type: 'note',
                    angle: baseAngle + offset,
                    radius: 50,
                    html: `<button type="button" class="tips-circle-node note" onclick="app.openTipsNotePreview('${this.escapeJs(note.id)}')" title="${this.escapeHtml(body || '本文なし')}"><i class="fa-regular fa-note-sticky"></i><span>${this.escapeHtml(summary || '本文なし')}</span></button>`
                });
            });
        });
        const nodeHtml = nodes.map(node => {
            const x = 50 + Math.cos(node.angle) * node.radius;
            const y = 50 + Math.sin(node.angle) * node.radius;
            return `<div class="tips-circle-node-wrap ${this.escapeHtml(node.type)}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;">${node.html}</div>`;
        }).join('');
        return `
            <section class="tips-circle-group" id="tips-map-group-${this.escapeHtml(group.key)}" style="${this.getTipsCardStyle(group.notes?.[0] || {})}">
                <div class="tips-circle-ring">
                    <div class="tips-circle-center">
                        <span class="tips-map-hub-icon"><i class="fa-solid fa-layer-group"></i></span>
                        <b>${this.escapeHtml(group.label || '未分類')}</b>
                        <small>${group.notes?.length || 0}件 / ${branches.length}分岐</small>
                        <div class="tips-map-label-actions">
                            <button type="button" class="tips-map-color-btn" onclick="app.openTipsGroupColorDialog('${this.escapeJs(group.key)}', '${this.escapeJs(group.label)}')" title="系統色を変更"><i class="fa-solid fa-palette"></i></button>
                            <button type="button" onclick="app.renameTipsMapLabel('group', '${this.escapeJs(group.key)}', '${this.escapeJs(group.label)}')" title="グループ名を変更"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    </div>
                    ${nodeHtml}
                </div>
            </section>
        `;
    };

    proto.getTipsMemoryMapCircleGroupHtmlV2 = function (group = {}) {
        const branches = [...(group.branches?.values?.() || [])].sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
        const nodes = [];
        branches.forEach((branch, branchIndex) => {
            const baseAngle = (Math.PI * 2 * branchIndex) / Math.max(branches.length, 1) - Math.PI / 2;
            nodes.push({
                type: 'branch',
                angle: baseAngle,
                radius: 24,
                html: `<button type="button" class="tips-circle-node branch" onclick="app.openTipsMapNodeNotes('branch', '${this.escapeJs(branch.key)}', '${this.escapeJs(branch.label)}', '${this.escapeJs(group.key)}')" title="配下のTIPSを表示"><i class="fa-solid fa-code-branch"></i><span>${this.escapeHtml(branch.label)}</span><small>${branch.notes.length}</small></button>`
            });
            const childList = [...(branch.children?.values?.() || [])].sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
            childList.forEach((child, childIndex) => {
                const childOffset = childList.length === 1 ? 0.62 : (childIndex - (childList.length - 1) / 2) * 0.62;
                nodes.push({
                    type: 'subbranch',
                    angle: baseAngle + childOffset,
                    radius: 34,
                    html: `<button type="button" class="tips-circle-node subbranch" onclick="app.openTipsMapNodeNotes('subBranch', '${this.escapeJs(child.key)}', '${this.escapeJs(child.label)}', '${this.escapeJs(group.key)}')" title="配下のTIPSを表示"><i class="fa-solid fa-turn-down"></i><span>${this.escapeHtml(child.label)}</span><small>${child.notes.length}</small></button>`
                });
            });
            const notes = (childList.length ? childList.flatMap(child => child.notes) : (branch.directNotes || branch.notes || []))
                .slice()
                .sort((a, b) => this.compareTipsNotes(a, b, 'updatedDesc'))
                .slice(0, 8);
            notes.forEach((note, noteIndex) => {
                const spread = Math.min(0.86, Math.PI / Math.max(notes.length + 1, 3));
                const baseNoteOffset = childList.length ? -0.74 : 0;
                const offset = baseNoteOffset + (noteIndex - (notes.length - 1) / 2) * spread;
                const body = String(note.body || '').trim();
                const summary = body.length > 22 ? `${body.slice(0, 22)}...` : body;
                nodes.push({
                    type: 'note',
                    angle: baseAngle + offset,
                    radius: 45,
                    html: `<button type="button" class="tips-circle-node note" onclick="app.editTipsNote('${this.escapeJs(note.id)}')" title="${this.escapeHtml(body || '本文なし')}"><i class="fa-regular fa-note-sticky"></i><span>${this.escapeHtml(summary || '本文なし')}</span></button>`
                });
            });
        });
        const nodeHtml = nodes.map(node => {
            const x = 50 + Math.cos(node.angle) * node.radius;
            const y = 50 + Math.sin(node.angle) * node.radius;
            return `<div class="tips-circle-node-wrap ${this.escapeHtml(node.type)}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;">${node.html}</div>`;
        }).join('');
        return `
            <section class="tips-circle-group" id="tips-map-group-${this.escapeHtml(group.key)}" style="${this.getTipsCardStyle(group.notes?.[0] || {})}">
                <div class="tips-circle-ring">
                    <div class="tips-circle-center">
                        <span class="tips-map-hub-icon"><i class="fa-solid fa-layer-group"></i></span>
                        <b>${this.escapeHtml(group.label || '未分類')}</b>
                        <small>${group.notes?.length || 0}件 / ${branches.length}分岐</small>
                        <div class="tips-map-label-actions">
                            <button type="button" class="tips-map-color-btn" onclick="app.openTipsGroupColorDialog('${this.escapeJs(group.key)}', '${this.escapeJs(group.label)}')" title="系統色を変更"><i class="fa-solid fa-palette"></i></button>
                            <button type="button" onclick="app.renameTipsMapLabelV2('group', '${this.escapeJs(group.key)}', '${this.escapeJs(group.label)}')" title="グループ名を変更"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    </div>
                    ${nodeHtml}
                </div>
            </section>
        `;
    };

    proto.getTipsMemoryMapTreeHtml = function (sortedGroups = []) {
        return sortedGroups.map(group => {
            const groupBytes = group.notes.reduce((sum, note) => sum + this.getTipsNoteAttachmentBytes(note), 0);
            const branches = [...group.branches.values()].sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
            const groupCollapsed = this._tipsMapCollapsedGroups.has(group.key);
            return `
                <section class="tips-map-group ${groupCollapsed ? 'collapsed' : ''}" id="tips-map-group-${this.escapeHtml(group.key)}" style="${this.getTipsHierarchyStyle('group', group.label, group.notes[0] || {})}">
                    <div class="tips-map-hub" onclick="app.openTipsMapNodeNotes('group', '${this.escapeJs(group.key)}', '${this.escapeJs(group.label)}')">
                        <span class="tips-map-hub-icon"><i class="fa-solid fa-layer-group"></i></span>
                        <div>
                            <b>${this.escapeHtml(group.label)}</b>
                            <small>${group.notes.length}件 / ${branches.length}分岐 / ${this.escapeHtml(this.formatTipsFileSize(groupBytes))}</small>
                        </div>
                        <div class="tips-map-label-actions">
                            <button type="button" class="tips-map-color-btn" onclick="event.stopPropagation(); app.openTipsGroupColorDialog('${this.escapeJs(group.key)}', '${this.escapeJs(group.label)}')" title="系統色を変更"><i class="fa-solid fa-palette"></i></button>
                            <button type="button" onclick="event.stopPropagation(); app.renameTipsMapLabel('group', '${this.escapeJs(group.key)}', '${this.escapeJs(group.label)}')" title="グループ名を変更"><i class="fa-solid fa-pen"></i></button>
                            <button type="button" onclick="event.stopPropagation(); app.toggleTipsMapGroup('${this.escapeJs(group.key)}')" title="${groupCollapsed ? '開く' : '折りたたむ'}"><i class="fa-solid ${groupCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
                        </div>
                    </div>
                    <div class="tips-map-branches">
                        ${branches.map(branch => {
                            const branchKey = `${group.key}::${branch.key}`;
                            const branchCollapsed = this._tipsMapCollapsedBranches.has(branchKey);
                            return `
                                <div class="tips-map-branch ${branchCollapsed ? 'collapsed' : ''}" style="${this.getTipsHierarchyStyle('branch', branch.label, branch.notes?.[0] || {})}">
                                    <div class="tips-map-branch-label" onclick="app.openTipsMapNodeNotes('branch', '${this.escapeJs(branch.key)}', '${this.escapeJs(branch.label)}', '${this.escapeJs(group.key)}')">
                                        <i class="fa-solid fa-code-branch"></i>
                                        <span>${this.escapeHtml(branch.label)}</span>
                                        <small>${branch.notes.length}件</small>
                                        <button type="button" onclick="event.stopPropagation(); app.renameTipsMapLabel('branch', '${this.escapeJs(branch.key)}', '${this.escapeJs(branch.label)}')" title="分岐名を変更"><i class="fa-solid fa-pen"></i></button>
                                        <button type="button" onclick="event.stopPropagation(); app.toggleTipsMapBranch('${this.escapeJs(group.key)}', '${this.escapeJs(branch.key)}')" title="${branchCollapsed ? '開く' : '折りたたむ'}"><i class="fa-solid ${branchCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i></button>
                                    </div>
                                    ${branchCollapsed ? '' : this.getTipsMapBranchBodyHtml(branch, group.key)}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </section>
            `;
        }).join('');
    };

    proto.getTipsMapBranchBodyHtml = function (branch = {}, groupKey = '') {
        const children = [...(branch.children?.values?.() || [])]
            .sort((a, b) => a.label.normalize('NFKC').localeCompare(b.label.normalize('NFKC'), 'ja'));
        return children.length ? `
            <div class="tips-map-subbranches">
                ${children.map(child => `
                    <section class="tips-map-subbranch" style="${this.getTipsHierarchyStyle('subBranch', child.label, child.notes?.[0] || {})}">
                        <div class="tips-map-subbranch-label" onclick="app.openTipsMapNodeNotes('subBranch', '${this.escapeJs(child.key)}', '${this.escapeJs(child.label)}', '${this.escapeJs(groupKey)}')">
                            <i class="fa-solid fa-turn-down"></i>
                            <span>${this.escapeHtml(child.label)}</span>
                            <small>${child.notes.length}件</small>
                            <button type="button" onclick="event.stopPropagation(); app.renameTipsMapLabelV2('subBranch', '${this.escapeJs(child.key)}', '${this.escapeJs(child.label)}')" title="下位分岐名を変更"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    </section>
                `).join('')}
            </div>
        ` : '';
    };

    proto.openTipsGroupColorDialog = function (groupKey = '', label = '') {
        const normalized = groupKey || this.normalizeTipsLabel(label || 'unclassified');
        const notes = this.ensureTipsState();
        const sample = notes.find(note => this.normalizeTipsLabel(note.group || '') === normalized) || { group: label };
        const current = this.getTipsGroupBaseColor(label) || this.getTipsAutoCardColors(label).edge;
        const swatches = ['#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4', '#22c55e', '#84cc16', '#64748b', '#111827'];
        document.getElementById('tips-group-color-modal')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="tips-group-color-modal" class="tips-group-color-modal" onclick="app.closeTipsGroupColorDialog(event)">
                <div class="tips-group-color-card" style="${this.getTipsHierarchyStyle('group', label, sample)}" onclick="event.stopPropagation()">
                    <header>
                        <div>
                            <b><i class="fa-solid fa-palette"></i> 系統色を変更</b>
                            <span>${this.escapeHtml(label || 'グループ')}</span>
                        </div>
                        <button type="button" onclick="app.closeTipsGroupColorDialog()" title="閉じる"><i class="fa-solid fa-xmark"></i></button>
                    </header>
                    <div class="tips-group-color-preview" id="tips-group-color-preview" style="${this.getTipsGroupColorPreviewStyle(current)}">
                        <span class="tips-map-hub-icon"><i class="fa-solid fa-layer-group"></i></span>
                        <b>${this.escapeHtml(label || 'グループ')}</b>
                        <small>この色を基準に階層の濃淡を作ります</small>
                    </div>
                    <label class="tips-group-color-picker">
                        <span>基準色</span>
                        <input type="color" id="tips-group-color-input" value="${this.escapeHtml(current)}" oninput="app.previewTipsGroupColor(this.value)">
                    </label>
                    <div class="tips-group-color-swatches">
                        ${swatches.map(color => `<button type="button" style="--swatch:${color}" onclick="app.setTipsGroupColorInput('${color}')" title="${color}"></button>`).join('')}
                    </div>
                    <footer>
                        <button type="button" class="secondary-btn" onclick="app.resetTipsGroupColor('${this.escapeJs(normalized)}')">
                            <i class="fa-solid fa-rotate-left"></i> 自動色に戻す
                        </button>
                        <button type="button" class="primary-btn" onclick="app.saveTipsGroupColor('${this.escapeJs(normalized)}')">
                            <i class="fa-solid fa-check"></i> 保存
                        </button>
                    </footer>
                </div>
            </div>
        `);
    };

    proto.getTipsGroupColorPreviewStyle = function (color = '') {
        const c = this.getTipsPaletteFromBaseColor(color) || this.getTipsAutoCardColors('preview');
        return `--tips-card-bg:${c.bg};--tips-card-edge:${c.edge};--tips-chip-bg:${c.chip};--tips-chip-text:${c.text};`;
    };

    proto.previewTipsGroupColor = function (color = '') {
        const preview = document.getElementById('tips-group-color-preview');
        if (preview) preview.setAttribute('style', this.getTipsGroupColorPreviewStyle(color));
    };

    proto.setTipsGroupColorInput = function (color = '') {
        const input = document.getElementById('tips-group-color-input');
        const safe = this.normalizeTipsColor(color);
        if (!input || !safe) return;
        input.value = safe;
        this.previewTipsGroupColor(safe);
    };

    proto.saveTipsGroupColor = function (groupKey = '') {
        const input = document.getElementById('tips-group-color-input');
        const color = this.normalizeTipsColor(input?.value || '');
        if (!groupKey || !color) return;
        this.ensureTipsGroupColorStore()[groupKey] = color;
        store.save();
        this.closeTipsGroupColorDialog();
        this.renderTips();
        this.showToast?.('系統色を変更しました', 'success');
    };

    proto.resetTipsGroupColor = function (groupKey = '') {
        if (!groupKey) return;
        delete this.ensureTipsGroupColorStore()[groupKey];
        store.save();
        this.closeTipsGroupColorDialog();
        this.renderTips();
        this.showToast?.('自動色に戻しました', 'success');
    };

    proto.closeTipsGroupColorDialog = function (event = null) {
        if (event && event.target?.id !== 'tips-group-color-modal') return;
        document.getElementById('tips-group-color-modal')?.remove();
    };

    proto.scrollToTipsMapGroup = function (groupKey = '') {
        document.getElementById(`tips-map-group-${groupKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    proto.renameTipsMapLabel = function (key = 'group', normalized = '', currentLabel = '') {
        const nextLabel = (prompt(`${key === 'branch' ? '分岐名' : 'グループ名'}を変更`, currentLabel || '') || '').trim();
        if (!nextLabel || this.normalizeTipsLabel(nextLabel) === normalized) return;
        let changed = 0;
        this.ensureTipsState().forEach(note => {
            if (this.normalizeTipsLabel(note?.[key] || '') === normalized && note[key] !== nextLabel) {
                note[key] = nextLabel;
                note.updatedAt = new Date().toISOString();
                changed += 1;
            }
        });
        if (!changed) return this.showToast('変更対象がありません', 'info');
        store.save();
        this.renderTips();
        this.showToast(`${changed}件の${key === 'branch' ? '分岐名' : 'グループ名'}を変更しました`, 'success');
    };

    proto.renameTipsMapLabelV2 = function (key = 'group', normalized = '', currentLabel = '') {
        const labelName = key === 'subBranch' ? '下位分岐名' : key === 'branch' ? '分岐名' : 'グループ名';
        const nextLabel = (prompt(`${labelName}を変更`, currentLabel || '') || '').trim();
        if (!nextLabel || this.normalizeTipsLabel(nextLabel) === normalized) return;
        let changed = 0;
        this.ensureTipsState().forEach(note => {
            if (this.normalizeTipsLabel(note?.[key] || '') === normalized && note[key] !== nextLabel) {
                note[key] = nextLabel;
                note.updatedAt = new Date().toISOString();
                changed += 1;
            }
        });
        if (!changed) return this.showToast('変更対象がありません', 'info');
        store.save();
        this.renderTips();
        this.showToast(`${changed}件の${labelName}を変更しました`, 'success');
    };

    proto.openTipsMapNodeNotes = function (key = 'branch', normalized = '', label = '', groupKey = '') {
        const notes = this.ensureTipsState()
            .filter(note => {
                if (groupKey && this.normalizeTipsLabel(note.group || '') !== groupKey) return false;
                return this.normalizeTipsLabel(note?.[key] || '') === normalized;
            })
            .sort((a, b) => this.compareTipsNotes(a, b, 'updatedDesc'));
        this._tipsPreviewContextIds = notes.map(note => note.id);
        const modalStyle = this.getTipsHierarchyStyle(key, label || normalized, notes[0] || {});
        document.getElementById('tips-map-node-notes')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="tips-map-node-notes" class="tips-map-node-notes" onclick="app.closeTipsMapNodeNotes(event)">
                <div class="tips-map-node-notes-card" style="${modalStyle}" onclick="event.stopPropagation()">
                    <header>
                        <div>
                            <b><i class="fa-solid fa-list"></i>${this.escapeHtml(label || 'TIPS一覧')}</b>
                            <span>${notes.length}件のTIPS</span>
                        </div>
                        <button type="button" onclick="app.closeTipsMapNodeNotes()" title="閉じる"><i class="fa-solid fa-xmark"></i></button>
                    </header>
                    <label class="tips-map-node-search">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="search" placeholder="この一覧を検索" oninput="app.filterTipsMapNodeNotes(this.value)">
                    </label>
                    <div class="tips-map-node-filter" role="group" aria-label="TIPS filter">
                        <button type="button" class="active" data-tips-node-filter="all" onclick="app.setTipsMapNodeFilter('all')"><i class="fa-solid fa-border-all"></i> 全て</button>
                        <button type="button" data-tips-node-filter="body" onclick="app.setTipsMapNodeFilter('body')"><i class="fa-regular fa-note-sticky"></i> 本文あり</button>
                        <button type="button" data-tips-node-filter="attachment" onclick="app.setTipsMapNodeFilter('attachment')"><i class="fa-solid fa-paperclip"></i> 添付あり</button>
                    </div>
                    <div class="tips-map-node-note-list">
                        ${notes.length ? notes.map(note => `
                            <button type="button" style="${this.getTipsNoteHierarchyStyle(note)}" data-tips-node-note-kind="${String(note.body || '').trim() && Array.isArray(note.attachments) && note.attachments.length ? 'both' : String(note.body || '').trim() ? 'body' : Array.isArray(note.attachments) && note.attachments.length ? 'attachment' : 'empty'}" data-tips-node-note-search="${this.escapeHtml(`${note.group || ''} ${note.branch || ''} ${note.subBranch || ''} ${note.body || ''} ${(Array.isArray(note.attachments) ? note.attachments : []).map((file, index) => this.getTipsAttachmentDisplayName(file, index)).join(' ')}`.toLowerCase())}" onclick="app.openTipsNotePreview('${this.escapeJs(note.id)}')">
                                <span>
                                    <b>${this.escapeHtml(note.group || '未分類')}${note.branch ? ` / ${this.escapeHtml(note.branch)}` : ''}${note.subBranch ? ` / ${this.escapeHtml(note.subBranch)}` : ''}</b>
                                    <small>${Array.isArray(note.attachments) && note.attachments.length ? `<i class="fa-solid fa-paperclip"></i> ${note.attachments.length} ` : ''}${this.escapeHtml(this.formatTipsDateTime(note.updatedAt || note.createdAt))}</small>
                                </span>
                                <p class="${String(note.body || '').trim() ? '' : 'tips-map-node-note-empty-body'}">${String(note.body || '').trim() ? this.escapeHtml(String(note.body || '').slice(0, 90)) : (Array.isArray(note.attachments) && note.attachments.length ? '<i class="fa-solid fa-paperclip"></i> 添付のみ' : '本文なし')}</p>
                            </button>
                        `).join('') : '<p class="tips-map-node-empty">該当するTIPSがありません</p>'}
                    </div>
                </div>
            </div>
        `);
    };

    proto.filterTipsMapNodeNotes = function (value = '') {
        const query = String(value || '').trim().toLowerCase();
        const activeFilter = document.querySelector('#tips-map-node-notes .tips-map-node-filter button.active')?.dataset?.tipsNodeFilter || 'all';
        document.querySelectorAll('#tips-map-node-notes .tips-map-node-note-list > button').forEach(button => {
            const haystack = button.getAttribute('data-tips-node-note-search') || '';
            const kind = button.getAttribute('data-tips-node-note-kind') || 'empty';
            const matchesText = query ? haystack.includes(query) : true;
            const matchesFilter = activeFilter === 'all'
                || (activeFilter === 'body' && (kind === 'body' || kind === 'both'))
                || (activeFilter === 'attachment' && (kind === 'attachment' || kind === 'both'));
            button.hidden = !(matchesText && matchesFilter);
        });
        const list = document.querySelector('#tips-map-node-notes .tips-map-node-note-list');
        if (!list) return;
        const hasVisible = [...list.querySelectorAll(':scope > button')].some(button => !button.hidden);
        list.classList.toggle('is-empty-filtered', !hasVisible);
    };

    proto.setTipsMapNodeFilter = function (filter = 'all') {
        const safe = ['all', 'body', 'attachment'].includes(filter) ? filter : 'all';
        document.querySelectorAll('#tips-map-node-notes .tips-map-node-filter button').forEach(button => {
            button.classList.toggle('active', button.dataset.tipsNodeFilter === safe);
        });
        this.filterTipsMapNodeNotes(document.querySelector('#tips-map-node-notes .tips-map-node-search input')?.value || '');
    };

    proto.openTipsNotePreview = function (noteId = '') {
        const note = this.ensureTipsState().find(item => item.id === noteId);
        if (!note) return;
        const attachments = Array.isArray(note.attachments) ? note.attachments : [];
        const contextIds = this.getTipsPreviewContextIds(note);
        const currentIndex = contextIds.indexOf(note.id);
        const prevId = currentIndex > 0 ? contextIds[currentIndex - 1] : '';
        const nextId = currentIndex >= 0 && currentIndex < contextIds.length - 1 ? contextIds[currentIndex + 1] : '';
        const longBody = String(note.body || '').length > 180 || String(note.body || '').split(/\r?\n/).length > 5;
        const fontSize = this.getTipsPreviewFontSize();
        document.getElementById('tips-note-preview')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="tips-note-preview" class="tips-note-preview" onclick="app.closeTipsNotePreview(event)">
                <div class="tips-note-preview-card tips-preview-font-${this.escapeHtml(fontSize)}" style="${this.getTipsNoteHierarchyStyle(note)}" onclick="event.stopPropagation()">
                    <header>
                        <div>
                            <b><i class="fa-regular fa-note-sticky"></i>${this.escapeHtml(note.group || 'TIPS')}</b>
                            <span>${this.escapeHtml([note.branch, note.subBranch].filter(Boolean).join(' / ') || '分類なし')} / ${this.escapeHtml(this.formatTipsDateTime(note.updatedAt || note.createdAt))}</span>
                        </div>
                        <button type="button" onclick="app.closeTipsNotePreview()" title="閉じる"><i class="fa-solid fa-xmark"></i></button>
                    </header>
                    <div class="tips-note-preview-nav">
                        <button type="button" ${prevId ? '' : 'disabled'} onclick="app.openTipsNotePreview('${this.escapeJs(prevId)}')"><i class="fa-solid fa-chevron-left"></i> 前へ</button>
                        <span>${currentIndex >= 0 ? `${currentIndex + 1} / ${contextIds.length}` : ''}</span>
                        <div class="tips-note-preview-size" title="文字サイズ">
                            ${['small', 'normal', 'large'].map(size => `
                                <button type="button" class="${fontSize === size ? 'active' : ''}" onclick="app.setTipsPreviewFontSize('${size}')">${size === 'small' ? '小' : size === 'large' ? '大' : '標準'}</button>
                            `).join('')}
                        </div>
                        <button type="button" ${nextId ? '' : 'disabled'} onclick="app.openTipsNotePreview('${this.escapeJs(nextId)}')">次へ <i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                    <div class="tips-note-preview-body ${longBody ? 'collapsed' : ''}" id="tips-note-preview-body">${this.renderTipsBodyHtml(note.body || '本文なし')}</div>
                    ${longBody ? '<button type="button" class="tips-note-preview-expand" onclick="app.toggleTipsNotePreviewFull()"><i class="fa-solid fa-up-right-and-down-left-from-center"></i> 全文表示</button>' : ''}
                    ${attachments.length ? `
                        ${attachments.some(file => this.getTipsFileType(file) === 'image' && file.dataUrl) ? `
                            <div class="tips-note-preview-image-panel">
                                <div class="tips-note-preview-image-panel-head">
                                    <b><i class="fa-solid fa-images"></i> 添付画像プレビュー</b>
                                    <span>画像を押すとさらに拡大</span>
                                </div>
                                <div class="tips-note-preview-image-grid">
                                    ${attachments.map((file, index) => this.getTipsFileType(file) === 'image' && file.dataUrl ? `
                                        <button type="button" onclick="app.openTipsAttachment('${this.escapeJs(note.id)}', ${index})" title="${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}">
                                            <img src="${this.escapeHtml(file.dataUrl)}" alt="${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}">
                                            <span>${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}</span>
                                        </button>
                                    ` : '').join('')}
                                </div>
                            </div>
                            <div class="tips-note-preview-thumbs">
                                ${attachments.map((file, index) => this.getTipsFileType(file) === 'image' && file.dataUrl ? `
                                    <button type="button" onclick="app.openTipsAttachment('${this.escapeJs(note.id)}', ${index})" title="${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}">
                                        <img src="${this.escapeHtml(file.dataUrl)}" alt="${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}">
                                        <span>${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}</span>
                                    </button>
                                ` : '').join('')}
                            </div>
                        ` : ''}
                        <div class="tips-note-preview-files">
                            ${attachments.map((file, index) => `
                                <button type="button" onclick="app.openTipsAttachment('${this.escapeJs(note.id)}', ${index})" title="${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}">
                                    <i class="fa-solid ${file.source === 'photoManager' ? 'fa-images' : 'fa-paperclip'}"></i>
                                    <span>${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}</span>
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                    <footer>
                        <button type="button" onclick="app.copyTipsNotePreview('${this.escapeJs(note.id)}', 'body', this)"><i class="fa-regular fa-copy"></i> 本文コピー</button>
                        <button type="button" onclick="app.copyTipsNotePreview('${this.escapeJs(note.id)}', 'full', this)"><i class="fa-solid fa-copy"></i> 階層ごとコピー</button>
                        <button type="button" onclick="app.editTipsNoteFromPreview('${this.escapeJs(note.id)}')"><i class="fa-solid fa-pen"></i> 編集</button>
                    </footer>
                </div>
            </div>
        `);
    };

    proto.getTipsPreviewContextIds = function (note = {}) {
        const saved = Array.isArray(this._tipsPreviewContextIds) ? this._tipsPreviewContextIds : [];
        if (saved.includes(note.id)) return saved;
        const sameScope = this.ensureTipsState()
            .filter(item => {
                if ((item.group || '') !== (note.group || '')) return false;
                if (note.subBranch) return (item.branch || '') === (note.branch || '') && (item.subBranch || '') === (note.subBranch || '');
                if (note.branch) return (item.branch || '') === (note.branch || '');
                return true;
            })
            .sort((a, b) => this.compareTipsNotes(a, b, 'updatedDesc'))
            .map(item => item.id);
        return sameScope.length ? sameScope : [note.id];
    };

    proto.getTipsPreviewFontSize = function () {
        const value = localStorage.getItem('tips_preview_font_size') || 'normal';
        return ['small', 'normal', 'large'].includes(value) ? value : 'normal';
    };

    proto.setTipsPreviewFontSize = function (size = 'normal') {
        const safe = ['small', 'normal', 'large'].includes(size) ? size : 'normal';
        localStorage.setItem('tips_preview_font_size', safe);
        const card = document.querySelector('#tips-note-preview .tips-note-preview-card');
        if (!card) return;
        card.classList.remove('tips-preview-font-small', 'tips-preview-font-normal', 'tips-preview-font-large');
        card.classList.add(`tips-preview-font-${safe}`);
        document.querySelectorAll('#tips-note-preview .tips-note-preview-size button').forEach(button => {
            button.classList.toggle('active', button.textContent.trim() === (safe === 'small' ? '小' : safe === 'large' ? '大' : '標準'));
        });
    };

    proto.toggleTipsNotePreviewFull = function () {
        const body = document.getElementById('tips-note-preview-body');
        const button = document.querySelector('.tips-note-preview-expand');
        if (!body || !button) return;
        const collapsed = body.classList.toggle('collapsed');
        button.innerHTML = collapsed
            ? '<i class="fa-solid fa-up-right-and-down-left-from-center"></i> 全文表示'
            : '<i class="fa-solid fa-down-left-and-up-right-to-center"></i> 折りたたむ';
    };

    proto.getTipsCopyText = function (note = {}, mode = 'body') {
        const body = String(note.body || '');
        if (mode === 'body') return body;
        const parts = [note.group, note.branch, note.subBranch].filter(Boolean).join(' / ');
        return `${parts ? `${parts}\n` : ''}${body}`;
    };

    proto.copyTipsNotePreview = async function (noteId = '', mode = 'body', button = null) {
        const note = this.ensureTipsState().find(item => item.id === noteId);
        if (!note) return;
        const text = this.getTipsCopyText(note, mode);
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const area = document.createElement('textarea');
                area.value = text;
                document.body.appendChild(area);
                area.select();
                document.execCommand('copy');
                area.remove();
            }
            this.showToast?.(mode === 'body' ? '本文をコピーしました' : '階層ごとコピーしました', 'success');
            if (button) {
                const before = button.innerHTML;
                button.classList.add('copied');
                button.innerHTML = '<i class="fa-solid fa-check"></i> コピー済み';
                window.setTimeout(() => {
                    button.classList.remove('copied');
                    button.innerHTML = before;
                }, 1400);
            }
        } catch (error) {
            this.showToast?.('コピーできませんでした', 'error');
        }
    };

    proto.closeTipsNotePreview = function (event) {
        if (event && event.target?.id !== 'tips-note-preview') return;
        document.getElementById('tips-note-preview')?.remove();
    };

    proto.closeTipsMapNodeNotes = function (event) {
        if (event && event.target?.id !== 'tips-map-node-notes') return;
        document.getElementById('tips-map-node-notes')?.remove();
    };

    proto.closeTipsFloatingViews = function () {
        document.getElementById('tips-note-preview')?.remove();
        document.getElementById('tips-map-node-notes')?.remove();
        document.getElementById('tips-attachment-viewer')?.remove();
    };

    proto.editTipsNoteFromPreview = function (noteId = '') {
        this.closeTipsFloatingViews();
        this.editTipsNote(noteId, true);
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
        this.markTipsNoteViewed(noteId);
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

    proto.getTipsEditingImageAttachments = async function () {
        const editingNote = this._editingTipsId ? this.ensureTipsState().find(note => note.id === this._editingTipsId) : null;
        const existing = Array.isArray(editingNote?.attachments) ? editingNote.attachments : [];
        const photoAttachments = Array.isArray(this._tipsPhotoManagerAttachments) ? this._tipsPhotoManagerAttachments : [];
        const fileInput = document.getElementById('tips-file-input');
        const files = Array.from(fileInput?.files || []).filter(file => this.getTipsFileType(file) === 'image');
        const pendingFiles = [];
        for (const file of files) {
            try {
                pendingFiles.push(await this.readTipsFile(file));
            } catch (error) {
                console.warn('Failed to preview tips image attachment', error);
            }
        }
        return [...existing, ...photoAttachments, ...pendingFiles].filter(file => this.getTipsFileType(file) === 'image' && file.dataUrl);
    };

    proto.renderTipsBodyEditorImagePreview = async function () {
        const box = document.getElementById('tips-body-editor-image-preview');
        if (!box) return;
        const images = await this.getTipsEditingImageAttachments();
        if (!document.getElementById('tips-body-editor-image-preview')) return;
        box.hidden = !images.length;
        box.innerHTML = images.length ? `
            <div class="tips-body-editor-image-preview-head">
                <b><i class="fa-solid fa-images"></i> 添付画像プレビュー</b>
                <span>webpも表示します</span>
            </div>
            <div class="tips-body-editor-image-preview-grid">
                ${images.map((file, index) => `
                    <figure>
                        <img src="${this.escapeHtml(file.dataUrl)}" alt="${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}">
                        <figcaption>${this.escapeHtml(this.getTipsAttachmentDisplayName(file, index))}</figcaption>
                    </figure>
                `).join('')}
            </div>
        ` : '';
    };

    proto.saveTipsNote = async function () {
        const groupInput = document.getElementById('tips-group-input');
        const branchInput = document.getElementById('tips-branch-input');
        const subBranchInput = document.getElementById('tips-sub-branch-input');
        const bodyInput = document.getElementById('tips-body-input');
        const fileInput = document.getElementById('tips-file-input');
        const group = (groupInput?.value || '').trim() || '未分類';
        const branch = (branchInput?.value || '').trim();
        const subBranch = (subBranchInput?.value || '').trim();
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
            existing.subBranch = subBranch;
            existing.body = body;
            existing.updatedAt = new Date().toISOString();
            existing.attachments = [...(Array.isArray(existing.attachments) ? existing.attachments : []), ...attachments];
        } else {
            notes.unshift({
                id: `tips_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                group,
                branch,
                subBranch,
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

    proto.getTipsTimestampPattern = function () {
        return /(\(\d{4}\/\d{1,2}\/\d{1,2}(?: \d{1,2}:\d{2})?\)|\(\d{1,2}\/\d{1,2} \d{1,2}:\d{2}\)|\(\d{1,2}:\d{2}\))/g;
    };

    proto.renderTipsBodyHtml = function (body = '') {
        const safeLines = this.escapeHtml(body).split(/\n/);
        return safeLines.map(line => {
            const hasTimestamp = this.getTipsTimestampPattern().test(line);
            const highlighted = line.replace(this.getTipsTimestampPattern(), '<span class="tips-body-timestamp">$1</span>');
            return hasTimestamp ? `<span class="tips-body-timestamp-line">${highlighted}</span>` : highlighted;
        }).join('<br>');
    };

    proto.getTipsTimestampFormat = function () {
        const select = document.getElementById('tips-timestamp-format') || document.getElementById('tips-timestamp-format-editor');
        const value = select?.value || localStorage.getItem('tips_timestamp_format') || 'full';
        return ['full', 'short', 'time'].includes(value) ? value : 'full';
    };

    proto.setTipsTimestampFormat = function (value) {
        const safeValue = ['full', 'short', 'time'].includes(value) ? value : 'full';
        localStorage.setItem('tips_timestamp_format', safeValue);
        document.querySelectorAll('#tips-timestamp-format, #tips-timestamp-format-editor').forEach(select => {
            select.value = safeValue;
        });
    };

    proto.getTipsTimestampPosition = function () {
        const select = document.getElementById('tips-timestamp-position') || document.getElementById('tips-timestamp-position-editor');
        const value = select?.value || localStorage.getItem('tips_timestamp_position') || 'cursor';
        return ['cursor', 'line', 'end'].includes(value) ? value : 'cursor';
    };

    proto.setTipsTimestampPosition = function (value) {
        const safeValue = ['cursor', 'line', 'end'].includes(value) ? value : 'cursor';
        localStorage.setItem('tips_timestamp_position', safeValue);
        document.querySelectorAll('#tips-timestamp-position, #tips-timestamp-position-editor').forEach(select => {
            select.value = safeValue;
        });
    };

    proto.syncTipsTimestampControls = function () {
        this.setTipsTimestampFormat(this.getTipsTimestampFormat());
        this.setTipsTimestampPosition(this.getTipsTimestampPosition());
    };

    proto.getTipsTimestampText = function (format = null) {
        const now = new Date();
        const pad = (value) => String(value).padStart(2, '0');
        const minute = pad(now.getMinutes());
        const selectedFormat = format || this.getTipsTimestampFormat();
        if (selectedFormat === 'time') return `(${now.getHours()}:${minute})`;
        if (selectedFormat === 'short') return `(${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${minute})`;
        return `(${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${now.getHours()}:${minute})`;
    };

    proto.insertTipsTimestamp = function (textareaId = 'tips-body-input') {
        const textarea = document.getElementById(textareaId);
        if (!textarea) return;
        const stamp = this.getTipsTimestampText();
        const start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : textarea.value.length;
        const end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : textarea.value.length;
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(end);
        const position = this.getTipsTimestampPosition();
        let inserted = `　${stamp}`;
        let nextBefore = before;
        let nextAfter = after;
        if (position === 'end') {
            nextBefore = textarea.value;
            nextAfter = '';
            inserted = `${nextBefore && !nextBefore.endsWith('\n') ? '\n' : ''}　${stamp}`;
        } else if (position === 'line') {
            inserted = `${before && !before.endsWith('\n') ? '\n' : ''}　${stamp}${after && !after.startsWith('\n') ? '\n' : ''}`;
        } else {
            inserted = `　${stamp}${after && !/^[\s\n]/.test(after) ? ' ' : ''}`;
        }
        textarea.value = `${nextBefore}${inserted}${nextAfter}`;
        const caret = nextBefore.length + inserted.length;
        textarea.focus();
        if (typeof textarea.setSelectionRange === 'function') {
            textarea.setSelectionRange(caret, caret);
        }
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    };

    proto.openTipsBodyEditor = function () {
        const bodyInput = document.getElementById('tips-body-input');
        if (!bodyInput) return;
        document.getElementById('tips-body-editor-modal')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="tips-body-editor-modal" class="tips-body-editor-modal" onclick="app.closeTipsBodyEditor(event)">
                <div class="tips-body-editor-card" onclick="event.stopPropagation()">
                    <header>
                        <div>
                            <b><i class="fa-regular fa-note-sticky"></i> TIPS本文を拡大</b>
                            <span>大きな入力欄で本文を編集できます</span>
                        </div>
                        <div class="tips-body-editor-actions">
                            <select class="tips-body-timestamp-select" id="tips-timestamp-format-editor" onchange="app.setTipsTimestampFormat(this.value)" title="日時の形式">
                                <option value="full">年月日 時刻</option>
                                <option value="short">月日 時刻</option>
                                <option value="time">時刻のみ</option>
                            </select>
                            <select class="tips-body-timestamp-select" id="tips-timestamp-position-editor" onchange="app.setTipsTimestampPosition(this.value)" title="日時の入れ方">
                                <option value="cursor">カーソル</option>
                                <option value="line">新しい行</option>
                                <option value="end">末尾</option>
                            </select>
                            <button type="button" class="tips-body-timestamp-btn" onclick="app.insertTipsTimestamp('tips-body-editor-textarea')" title="現在日時を挿入">
                                <i class="fa-regular fa-clock"></i> 日時
                            </button>
                            <button type="button" class="tips-body-editor-close" onclick="app.closeTipsBodyEditor()" title="閉じる">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </header>
                    <textarea id="tips-body-editor-textarea" placeholder="忘れたくない内容を入力">${this.escapeHtml(bodyInput.value || '')}</textarea>
                    <div id="tips-body-editor-image-preview" class="tips-body-editor-image-preview" hidden></div>
                    <footer>
                        <button type="button" class="secondary-btn" onclick="app.closeTipsBodyEditor()">
                            <i class="fa-solid fa-xmark"></i> 閉じる
                        </button>
                        <button type="button" class="primary-btn" onclick="app.applyTipsBodyEditor()">
                            <i class="fa-solid fa-check"></i> 反映して閉じる
                        </button>
                    </footer>
                </div>
            </div>
        `);
        const editor = document.getElementById('tips-body-editor-textarea');
        this.syncTipsTimestampControls();
        this.renderTipsBodyEditorImagePreview();
        window.setTimeout(() => {
            editor?.focus();
            const length = editor?.value?.length || 0;
            editor?.setSelectionRange?.(length, length);
        }, 60);
    };

    proto.applyTipsBodyEditor = function () {
        const bodyInput = document.getElementById('tips-body-input');
        const editor = document.getElementById('tips-body-editor-textarea');
        if (bodyInput && editor) {
            bodyInput.value = editor.value;
            bodyInput.dispatchEvent(new Event('input', { bubbles: true }));
            bodyInput.focus();
        }
        this.closeTipsBodyEditor();
    };

    proto.closeTipsBodyEditor = function (event = null) {
        if (event && event.target?.id !== 'tips-body-editor-modal') return;
        document.getElementById('tips-body-editor-modal')?.remove();
    };

    proto.clearTipsForm = function () {
        const groupInput = document.getElementById('tips-group-input');
        const branchInput = document.getElementById('tips-branch-input');
        const subBranchInput = document.getElementById('tips-sub-branch-input');
        const bodyInput = document.getElementById('tips-body-input');
        const fileInput = document.getElementById('tips-file-input');
        if (groupInput) groupInput.value = '';
        if (branchInput) branchInput.value = '';
        if (subBranchInput) subBranchInput.value = '';
        if (bodyInput) bodyInput.value = '';
        if (fileInput) fileInput.value = '';
        this._tipsPhotoManagerAttachments = [];
        this._editingTipsId = '';
        document.querySelector('.tips-compose-panel')?.classList.remove('editing');
        this.updateTipsEditStateUI();
        this.renderTipsExistingFiles();
        this.renderTipsSelectedFiles();
    };

    proto.focusTipsBodyInput = function () {
        const bodyInput = document.getElementById('tips-body-input');
        if (!bodyInput) return;
        bodyInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => {
            bodyInput.focus();
            const length = bodyInput.value.length;
            if (typeof bodyInput.setSelectionRange === 'function') {
                bodyInput.setSelectionRange(length, length);
            }
        }, 180);
    };

    proto.editTipsNote = function (id, jumpToBody = false) {
        const note = this.ensureTipsState().find(item => item.id === id);
        if (!note) return;
        note.lastViewedAt = new Date().toISOString();
        store.save();
        this._editingTipsId = id;
        const groupInput = document.getElementById('tips-group-input');
        const branchInput = document.getElementById('tips-branch-input');
        const subBranchInput = document.getElementById('tips-sub-branch-input');
        const bodyInput = document.getElementById('tips-body-input');
        const fileInput = document.getElementById('tips-file-input');
        if (groupInput) groupInput.value = note.group || '';
        if (branchInput) branchInput.value = note.branch || '';
        if (subBranchInput) subBranchInput.value = note.subBranch || '';
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
        if (jumpToBody) this.focusTipsBodyInput();
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
        this.updateTipsEditMetaUI(editingNote);
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

    proto.updateTipsEditMetaUI = function (note = null) {
        const editingId = this._editingTipsId || '';
        const editingNote = note || (editingId ? this.ensureTipsState().find(item => item.id === editingId) : null);
        const meta = document.getElementById('tips-editing-meta');
        if (!meta) return;
        meta.hidden = !editingNote;
        meta.innerHTML = editingNote
            ? `<span><i class="fa-regular fa-calendar-plus"></i>登録日時: ${this.escapeHtml(this.formatTipsDateTime(editingNote.createdAt))}</span>${editingNote.updatedAt ? `<span><i class="fa-regular fa-clock"></i>更新日時: ${this.escapeHtml(this.formatTipsDateTime(editingNote.updatedAt))}</span>` : ''}`
            : '';
    };

    proto.setTipsDisplayMode = function (mode) {
        this.tipsDisplayMode = ['group', 'time', 'map'].includes(mode) ? mode : 'group';
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
            window.app?.renderTipsBodyEditorImagePreview?.();
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        window.setTimeout(() => window.app?.syncTipsTimestampControls?.(), 0);
    });
})();
