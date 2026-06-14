(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppPhotoManagerMethods extends MaintenanceApp {
        ensurePhotoManagerData() {
            if (!store.activeData.photoManagerNames || typeof store.activeData.photoManagerNames !== 'object') {
                store.activeData.photoManagerNames = {};
            }
            if (!Array.isArray(store.activeData.photoManagerLibrary)) {
                store.activeData.photoManagerLibrary = [];
            }
            if (!store.activeData.photoManagerOverlays || typeof store.activeData.photoManagerOverlays !== 'object') {
                store.activeData.photoManagerOverlays = {};
            }
            if (!Array.isArray(store.activeData.shiftPhotoRecentImageStamps)) {
                store.activeData.shiftPhotoRecentImageStamps = [];
            }
            if (!Array.isArray(store.activeData.imageSourceRecentUsed)) {
                store.activeData.imageSourceRecentUsed = [];
            }
            if (!Array.isArray(store.activeData.photoManagerTrash)) {
                store.activeData.photoManagerTrash = [];
            }
            if (!store.activeData.photoManagerTags || typeof store.activeData.photoManagerTags !== 'object') {
                store.activeData.photoManagerTags = {};
            }
            return store.activeData.photoManagerNames;
        }

        getPhotoManagerLibrary() {
            this.ensurePhotoManagerData();
            return store.activeData.photoManagerLibrary;
        }

        getPhotoManagerOverlays() {
            this.ensurePhotoManagerData();
            return store.activeData.photoManagerOverlays;
        }

        getPhotoManagerToday() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        createPhotoManagerLibraryId() {
            return `pm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        }

        hashPhotoManagerSrc(src = '') {
            let hash = 0;
            const text = String(src || '');
            for (let i = 0; i < text.length; i++) {
                hash = ((hash << 5) - hash) + text.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash).toString(36);
        }

        getPhotoManagerName(item = {}) {
            const names = this.ensurePhotoManagerData();
            return names[item.id] || item.caption || item.defaultName || '';
        }

        getPhotoManagerTags(itemOrId = {}) {
            this.ensurePhotoManagerData();
            const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
            return (store.activeData.photoManagerTags[id] || []).filter(Boolean);
        }

        setPhotoManagerTags(id, value = '') {
            this.ensurePhotoManagerData();
            const tags = String(value || '').split(/[,\s、，]+/).map(tag => tag.trim()).filter(Boolean).slice(0, 12);
            if (tags.length) store.activeData.photoManagerTags[id] = [...new Set(tags)];
            else delete store.activeData.photoManagerTags[id];
            store.save();
            this.renderPhotoManager();
        }

        setPhotoManagerName(id, value) {
            const names = this.ensurePhotoManagerData();
            const text = String(value || '').trim();
            if (text) names[id] = text;
            else delete names[id];
            store.save();
            this.renderPhotoManager();
        }

        buildPhotoManagerId(parts = [], src = '') {
            return [...parts.map(part => String(part ?? '').replaceAll('|', '_')), this.hashPhotoManagerSrc(src)].join('|');
        }

        normalizePhotoManagerDate(value = '') {
            const text = String(value || '');
            const match = text.match(/\d{4}-\d{2}-\d{2}/);
            return match ? match[0] : '';
        }

        addPhotoManagerItem(items, item) {
            if (!item?.src) return;
            item.date = this.normalizePhotoManagerDate(item.date);
            const overlays = this.getPhotoManagerOverlays();
            item.managerMarks = Array.isArray(overlays[item.id]) ? overlays[item.id] : [];
            item.annotated = !!item.annotated || (Array.isArray(item.marks) && item.marks.length > 0);
            item.annotated = item.annotated || (Array.isArray(item.globalMarks) && item.globalMarks.length > 0) || item.managerMarks.length > 0;
            item.displayName = this.getPhotoManagerName(item);
            item.tags = this.getPhotoManagerTags(item);
            items.push(item);
        }

        collectPhotoManagerItems() {
            const items = [];
            const data = store.activeData;
            const machines = store.getMachines(true);
            const machineMap = new Map(machines.map(m => [String(m.id), m]));

            this.getPhotoManagerLibrary().forEach((photo, index) => {
                if (!photo?.src) return;
                this.addPhotoManagerItem(items, {
                    id: photo.id || this.buildPhotoManagerId(['library', index], photo.src),
                    source: 'library',
                    sourceLabel: '取込画像',
                    title: photo.caption || photo.name || `取込画像${index + 1}`,
                    defaultName: photo.name || photo.caption || `取込画像${index + 1}`,
                    caption: photo.caption || '',
                    src: photo.src,
                    date: photo.date || '',
                    marks: Array.isArray(photo.marks) ? photo.marks : [],
                    sizePreset: photo.sizePreset && typeof photo.sizePreset === 'object' ? photo.sizePreset : null,
                    imageFit: photo.imageFit === 'fill' ? 'fill' : '',
                    deleteIndex: index,
                    open: () => this.openPhotoManagerEditor(photo.id || this.buildPhotoManagerId(['library', index], photo.src)),
                    deletePhoto: () => { this.getPhotoManagerLibrary().splice(index, 1); }
                });
            });

            machines.forEach(machine => {
                if (!machine.photo) return;
                this.addPhotoManagerItem(items, {
                    id: this.buildPhotoManagerId(['machine', machine.id], machine.photo),
                    source: 'machine',
                    sourceLabel: '機械',
                    title: `${machine.name || '機械'} ${machine.model ? `[${machine.model}]` : ''}`.trim(),
                    defaultName: machine.name || '機械写真',
                    src: machine.photo,
                    date: machine.createdAt ? new Date(machine.createdAt).toISOString().slice(0, 10) : '',
                    deleteIndex: 0,
                    open: () => this.openMachineModal(machine.id),
                    deletePhoto: () => { machine.photo = ''; }
                });
            });

            (data.partsMaster || []).forEach(part => {
                if (!part.photo) return;
                this.addPhotoManagerItem(items, {
                    id: this.buildPhotoManagerId(['part', part.name, part.model], part.photo),
                    source: 'part',
                    sourceLabel: '部品',
                    title: `${part.name || '部品'} ${part.model ? `[${part.model}]` : ''}`.trim(),
                    defaultName: part.name || '部品写真',
                    src: part.photo,
                    date: '',
                    deleteIndex: 0,
                    open: () => this.openPartMasterModal(part.name || '', part.model || ''),
                    deletePhoto: () => { part.photo = ''; }
                });
            });

            (data.history || []).forEach(history => {
                const machine = machineMap.get(String(history.machineId));
                const historyTitle = this.getHistoryDisplayText ? this.getHistoryDisplayText(history) : (history.notes || history.errorContent || 'メンテ履歴');
                (history.photos || []).forEach((src, index) => {
                    this.addPhotoManagerItem(items, {
                        id: this.buildPhotoManagerId(['history', history.id, index], src),
                        source: 'history',
                        sourceLabel: 'メンテ履歴',
                        title: `${history.date || ''} ${machine?.name || ''} ${historyTitle || ''}`.trim(),
                        defaultName: `履歴写真${index + 1}`,
                        src,
                        date: history.date || '',
                        deleteIndex: index,
                        open: () => this.openHistoryEditForm(history.id),
                        deletePhoto: () => { history.photos.splice(index, 1); }
                    });
                });
                (history.guide?.photos || []).forEach((rawPhoto, index) => {
                    const guidePhoto = this.normalizeGuidePhoto ? this.normalizeGuidePhoto(rawPhoto) : (typeof rawPhoto === 'string' ? { src: rawPhoto, marks: [] } : rawPhoto);
                    const src = guidePhoto?.src || '';
                    if (!src) return;
                    this.addPhotoManagerItem(items, {
                        id: this.buildPhotoManagerId(['guide', history.id, index], src),
                        source: 'guide',
                        sourceLabel: '手順書',
                        title: `${history.date || ''} ${machine?.name || '手順書'} ${history.guide?.tags?.join(' ') || ''}`.trim(),
                        defaultName: `手順書写真${index + 1}`,
                        src,
                        marks: Array.isArray(guidePhoto.marks) ? guidePhoto.marks : [],
                        date: history.guide?.updatedAt || history.date || '',
                        deleteIndex: index,
                        open: () => this.openGuideModal(history.id),
                        deletePhoto: () => { history.guide.photos.splice(index, 1); }
                    });
                });
            });

            const notebooks = data.shiftNotebooks || {};
            Object.keys(notebooks).forEach(dateStr => {
                const dayData = notebooks[dateStr] || {};
                const addRows = (rows = [], shift = 'early', shared = false) => {
                    rows.forEach((row, rowIndex) => {
                        const globalMarks = Array.isArray(row.photoCompareMarks) ? row.photoCompareMarks : [];
                        (row.photos || []).forEach((rawPhoto, photoIndex) => {
                            const photo = this.normalizeShiftNotebookPhoto ? this.normalizeShiftNotebookPhoto(rawPhoto) : (typeof rawPhoto === 'string' ? { src: rawPhoto, caption: '', marks: [] } : rawPhoto);
                            if (!photo?.src) return;
                            const marks = Array.isArray(photo.marks) ? photo.marks : [];
                            this.addPhotoManagerItem(items, {
                                id: this.buildPhotoManagerId(['shift', dateStr, shift, shared ? 'shared' : 'shift', row.id || rowIndex, photoIndex], photo.src),
                                source: 'shift',
                                sourceLabel: '連絡帳',
                                title: `${dateStr} ${shared ? '共通' : this.getShiftNotebookLabel(shift).name} ${row.group || ''} ${row.text || ''}`.trim(),
                                defaultName: photo.caption || `連絡帳写真${photoIndex + 1}`,
                                caption: photo.caption || '',
                                src: photo.src,
                                date: dateStr,
                                annotated: marks.length > 0 || globalMarks.length > 0,
                                marks,
                                globalMarks,
                                photoIndex,
                                photoCount: row.photos.length || 1,
                                deleteIndex: photoIndex,
                                open: () => this.openShiftNotebookModal(dateStr, shift, rowIndex),
                                deletePhoto: () => { row.photos.splice(photoIndex, 1); }
                            });
                        });
                    });
                };
                addRows(Array.isArray(dayData.sharedRows) ? dayData.sharedRows : [], 'early', true);
                ['early', 'late', 'night'].forEach(shift => {
                    const rows = this.getShiftNotebookRowsAndMembers(dayData[shift]).rows;
                    addRows(rows, shift, false);
                });
            });

            return items;
        }

        getFilteredPhotoManagerItems() {
            const source = document.getElementById('photo-manager-source')?.value || 'all';
            const period = document.getElementById('photo-manager-period')?.value || 'all';
            const markFilter = document.getElementById('photo-manager-mark-filter')?.value || 'all';
            const sort = document.getElementById('photo-manager-sort')?.value || 'date_desc';
            const tagFilter = document.getElementById('photo-manager-tag-filter')?.value || 'all';
            const query = (document.getElementById('photo-manager-query')?.value || '').trim();
            const terms = this.getSearchTerms(query);
            const range = this.getNotebookSearchDateRange(period);
            let items = this.collectPhotoManagerItems();

            if (source !== 'all') items = items.filter(item => item.source === source);
            if (period !== 'all') {
                items = items.filter(item => item.date && (!range.start || (item.date >= range.start && item.date <= range.end)));
            }
            if (markFilter === 'marked') items = items.filter(item => item.annotated);
            if (markFilter === 'plain') items = items.filter(item => !item.annotated);
            if (this._photoManagerAlphaFilterMode === 'transparent') items = items.filter(item => this.getPhotoManagerAlphaStatus(item) === 'transparent');
            if (this._photoManagerAlphaFilterMode === 'candidate') items = items.filter(item => this.getPhotoManagerAlphaStatus(item) === 'candidate');
            if (tagFilter !== 'all') items = items.filter(item => (item.tags || []).includes(tagFilter));
            if (terms.length) {
                items = items.filter(item => this.matchesSearchTerms(`${item.sourceLabel} ${item.title} ${item.displayName} ${item.caption || ''} ${item.date} ${(item.tags || []).join(' ')}`, terms));
            }

            const nameOf = item => this.getPhotoManagerName(item) || '';
            items.sort((a, b) => {
                if (sort === 'date_asc') return (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99');
                if (sort === 'source') return a.sourceLabel.localeCompare(b.sourceLabel, 'ja') || (b.date || '').localeCompare(a.date || '');
                if (sort === 'name') return nameOf(a).localeCompare(nameOf(b), 'ja') || (b.date || '').localeCompare(a.date || '');
                return (b.date || '').localeCompare(a.date || '') || a.sourceLabel.localeCompare(b.sourceLabel, 'ja');
            });
            return items;
        }

        renderPhotoManager() {
            this.ensurePhotoManagerPasteImportListener();
            this.ensureImageSourceChoiceListener();
            const list = document.getElementById('photo-manager-list');
            const summary = document.getElementById('photo-manager-summary');
            if (!list) return;
            this.updatePhotoManagerAlphaFilterButton();
            this.updatePhotoManagerTagFilterOptions();
            const items = this.getFilteredPhotoManagerItems();
            this._photoManagerVisibleIds = items.map(item => item.id);
            const allItems = this.collectPhotoManagerItems();
            this.prunePhotoManagerSelection(allItems.map(item => item.id));
            const selectedIds = this.ensurePhotoManagerSelectionStore();
            const duplicateSrcs = new Set(this.getPhotoManagerDuplicateGroups().map(group => group.src));
            const allCount = allItems.length;
            if (summary) {
                const marked = items.filter(item => item.annotated).length;
                summary.innerHTML = `<b>${items.length}</b> / ${allCount} 枚表示 <span>注記あり ${marked}枚</span>`;
            }
            if (!items.length) {
                list.innerHTML = '<div class="photo-manager-empty">該当する写真はありません。画像取込から写真管理だけの写真も追加できます。</div>';
                this.updatePhotoManagerBulkBar();
                return;
            }
            list.innerHTML = items.map(item => {
                const name = this.getPhotoManagerName(item) || item.defaultName || item.title || '写真';
                const thumbAction = item.source === 'library'
                    ? `app.openPhotoManagerEditor('${this.escapeJs(item.id)}')`
                    : `app.openPhotoManagerSource('${this.escapeJs(item.id)}')`;
                const thumbTitle = item.source === 'library' ? '写真を編集' : '元のページを開く';
                const alphaStatus = this.getPhotoManagerAlphaStatus(item);
                const checked = selectedIds.has(item.id) ? ' checked' : '';
                const usageSummary = this.getPhotoManagerUsageSummary(item);
                return `
                <article class="photo-manager-card" data-photo-id="${this.escapeHtml(item.id)}">
                    <label class="photo-manager-check">
                        <input type="checkbox" class="photo-manager-select" value="${this.escapeHtml(item.id)}"${checked} onchange="app.syncPhotoManagerSelection(this.value, this.checked)">
                    </label>
                    <button type="button" class="photo-manager-thumb" onclick="${thumbAction}" title="${thumbTitle}">
                        <img src="${item.src}" alt="${this.escapeHtml(name)}">
                        ${duplicateSrcs.has(item.src) ? '<span class="photo-manager-duplicate-badge"><i class="fa-solid fa-clone"></i> 重複</span>' : ''}
                        ${item.annotated ? '<span class="photo-manager-mark-badge"><i class="fa-solid fa-pen"></i> 注記あり</span>' : ''}
                        ${alphaStatus ? `<span class="photo-manager-alpha-badge ${alphaStatus}" role="button" tabindex="0" onpointerdown="event.preventDefault(); event.stopPropagation();" onclick="event.preventDefault(); event.stopPropagation(); app.openImageSourceChoiceTransparencyPreview('${this.escapeJs(item.id)}')"><i class="fa-solid fa-layer-group"></i> ${alphaStatus === 'transparent' ? '透過' : '透過候補'}</span>` : ''}
                        <span class="photo-manager-usage-badge ${usageSummary.count ? 'used' : 'unused'}"><i class="fa-solid ${usageSummary.count ? 'fa-link' : 'fa-circle-minus'}"></i> ${this.escapeHtml(usageSummary.label)}</span>
                    </button>
                    <div class="photo-manager-info">
                        <div class="photo-manager-meta">
                            <span>${this.escapeHtml(item.sourceLabel)}</span>
                            ${item.date ? `<span>${this.escapeHtml(item.date)}</span>` : '<span>日付なし</span>'}
                        </div>
                        <input type="text" value="${this.escapeHtml(item.displayName || '')}" placeholder="写真管理用の名前" onchange="app.setPhotoManagerName('${this.escapeJs(item.id)}', this.value)">
                        <p title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title || '元データなし')}</p>
                        ${usageSummary.usages.length ? `
                            <div class="photo-manager-usage-links">
                                ${usageSummary.usages.slice(0, 4).map(usage => `
                                    <button type="button" onclick="app.openPhotoManagerUsageSource('${this.escapeJs(usage.id)}')" title="${this.escapeHtml(usage.title || '')}">
                                        ${this.escapeHtml(this.getPhotoManagerSourceLabel(usage))}
                                    </button>
                                `).join('')}
                                ${usageSummary.usages.length > 4 ? `<span>+${usageSummary.usages.length - 4}</span>` : ''}
                            </div>
                        ` : '<div class="photo-manager-usage-links empty">使用先なし</div>'}
                        <div class="photo-manager-actions">
                            <button type="button" class="secondary-btn" onclick="app.openPhotoManagerEditor('${this.escapeJs(item.id)}')"><i class="fa-solid fa-pen"></i> 編集</button>
                            ${item.source === 'library' ? '' : `<button type="button" class="secondary-btn" onclick="app.openPhotoManagerSource('${this.escapeJs(item.id)}')"><i class="fa-solid fa-up-right-from-square"></i> 元を開く</button>`}
                            <button type="button" class="secondary-btn" onclick="app.downloadPhotoManagerItem('${this.escapeJs(item.id)}')"><i class="fa-solid fa-download"></i> 出力</button>
                            <button type="button" class="secondary-btn photo-manager-cutout-btn" onclick="app.createTransparentPhotoManagerImage('${this.escapeJs(item.id)}')" title="背景色を簡易的に透明化して写真管理へ追加"><i class="fa-solid fa-wand-magic-sparkles"></i> 透過作成</button>
                            <button type="button" class="danger-btn" onclick="app.deletePhotoManagerItem('${this.escapeJs(item.id)}')"><i class="fa-solid fa-trash-can"></i> 削除</button>
                        </div>
                    </div>
                </article>
            `;
            }).join('');
            this.enhancePhotoManagerCards(items);
            this.updatePhotoManagerBulkBar();
            this.addPhotoManagerPageOnlyCleanupButton();
            this.updatePhotoManagerTransparencyBadges(items);
            this.updateContextualHelp?.('photos');
        }

        addPhotoManagerPageOnlyCleanupButton() {
            const actions = document.querySelector('#photo-manager-bulk-bar .photo-manager-bulk-actions');
            if (!actions || actions.querySelector('.photo-manager-page-only-cleanup-btn')) return;
            const count = this.getPhotoManagerPageOnlyItems().length;
            actions.insertAdjacentHTML('beforeend', `<button type="button" class="secondary-btn photo-manager-page-only-cleanup-btn" onclick="app.openPhotoManagerPageOnlyCleanupReview()"><i class="fa-solid fa-folder-minus"></i> ページ残り ${count ? `(${count})` : ''}</button>`);
        }

        enhancePhotoManagerCards(items = []) {
            (items || []).forEach(item => {
                const safeId = window.CSS?.escape ? CSS.escape(item.id) : String(item.id).replace(/"/g, '\\"');
                const card = document.querySelector(`.photo-manager-card[data-photo-id="${safeId}"]`);
                const info = card?.querySelector?.('.photo-manager-info');
                const nameInput = info?.querySelector?.('input:not(.photo-manager-tags-input)');
                if (!info || !nameInput || info.querySelector('.photo-manager-tags-input')) return;
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'photo-manager-tags-input';
                input.placeholder = 'タグ 例: 人物 透過 部品';
                input.value = (item.tags || []).join(' ');
                input.addEventListener('change', () => this.setPhotoManagerTags(item.id, input.value));
                nameInput.insertAdjacentElement('afterend', input);
            });
        }

        getPhotoManagerAlphaStatus(item = {}) {
            if (!item?.src || !this.canImageSourceHaveAlpha(item.src)) return '';
            const cached = this._imageSourceTransparencyCache?.get?.(item.src);
            return cached === true ? 'transparent' : 'candidate';
        }

        ensurePhotoManagerSelectionStore() {
            if (!(this._photoManagerSelectedIds instanceof Set)) {
                this._photoManagerSelectedIds = new Set();
            }
            return this._photoManagerSelectedIds;
        }

        syncPhotoManagerSelection(id = '', checked = false) {
            const selected = this.ensurePhotoManagerSelectionStore();
            if (!id) return;
            if (checked) selected.add(id);
            else selected.delete(id);
            this.updatePhotoManagerBulkBar();
            this.addPhotoManagerPageOnlyCleanupButton();
        }

        prunePhotoManagerSelection(validIds = []) {
            const valid = new Set(validIds);
            const selected = this.ensurePhotoManagerSelectionStore();
            Array.from(selected).forEach(id => {
                if (!valid.has(id)) selected.delete(id);
            });
        }

        togglePhotoManagerAlphaFilter(mode = 'candidate') {
            const next = ['transparent', 'candidate'].includes(mode) ? mode : 'candidate';
            this._photoManagerAlphaFilterMode = this._photoManagerAlphaFilterMode === next ? '' : next;
            this.renderPhotoManager();
        }

        togglePhotoManagerAlphaCandidateFilter() {
            this.togglePhotoManagerAlphaFilter('candidate');
        }

        updatePhotoManagerAlphaFilterButton() {
            const mode = this._photoManagerAlphaFilterMode || '';
            const oldButton = document.getElementById('photo-manager-alpha-filter');
            if (oldButton) oldButton.classList.toggle('active', mode === 'candidate');
            const transparent = document.getElementById('photo-manager-alpha-transparent-filter');
            const candidate = document.getElementById('photo-manager-alpha-candidate-filter');
            if (transparent) transparent.classList.toggle('active', mode === 'transparent');
            if (candidate) candidate.classList.toggle('active', mode === 'candidate');
        }

        getPhotoManagerAllTags() {
            this.ensurePhotoManagerData();
            return [...new Set(Object.values(store.activeData.photoManagerTags || {}).flat().filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'ja'));
        }

        updatePhotoManagerTagFilterOptions() {
            const select = document.getElementById('photo-manager-tag-filter');
            if (!select) return;
            const current = select.value || 'all';
            const tags = this.getPhotoManagerAllTags();
            select.innerHTML = `<option value="all">すべてのタグ</option>${tags.map(tag => `<option value="${this.escapeHtml(tag)}">${this.escapeHtml(tag)}</option>`).join('')}`;
            select.value = tags.includes(current) ? current : 'all';
        }

        ensurePhotoManagerBulkBar() {
            const summary = document.getElementById('photo-manager-summary');
            const list = document.getElementById('photo-manager-list');
            if (!summary || !list) return null;
            let bar = document.getElementById('photo-manager-bulk-bar');
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'photo-manager-bulk-bar';
                bar.className = 'photo-manager-bulk-bar';
                summary.insertAdjacentElement('afterend', bar);
            }
            return bar;
        }

        updatePhotoManagerBulkBar() {
            const bar = this.ensurePhotoManagerBulkBar();
            if (!bar) return;
            const selectedIds = this.getSelectedPhotoManagerIds();
            const visibleCount = this._photoManagerVisibleIds?.length || 0;
            const unusedCount = this.getUnusedPhotoManagerLibraryItems().length;
            const duplicateCount = this.getPhotoManagerDuplicateGroups().length;
            const pageOnlyCount = this.getPhotoManagerPageOnlyItems().length;
            bar.classList.toggle('has-selection', selectedIds.length > 0);
            bar.innerHTML = `
                <div class="photo-manager-bulk-status">
                    <b>${selectedIds.length}</b>
                    <span>選択中</span>
                    <small>表示 ${visibleCount}件 / 未使用取込 ${unusedCount}件</small>
                </div>
                <div class="photo-manager-bulk-actions">
                    <button type="button" class="secondary-btn" onclick="app.selectVisiblePhotoManagerItems()"><i class="fa-solid fa-check-double"></i> 表示中を選択</button>
                    <button type="button" class="secondary-btn" onclick="app.clearVisiblePhotoManagerSelection()"><i class="fa-regular fa-square"></i> 解除</button>
                    <label class="photo-manager-bulk-title">
                        <span>タイトル</span>
                        <input type="text" id="photo-manager-bulk-title-input" placeholder="選択中へ一括設定">
                    </label>
                    <button type="button" class="primary-btn" onclick="app.renameSelectedPhotoManagerItems()"><i class="fa-solid fa-pen-to-square"></i> 一括変更</button>
                    <button type="button" class="secondary-btn" onclick="app.createTransparentSelectedPhotoManagerImages()"><i class="fa-solid fa-wand-magic-sparkles"></i> 透過作成</button>
                    <button type="button" class="secondary-btn" onclick="app.exportPhotoManagerItems()"><i class="fa-solid fa-file-export"></i> 出力</button>
                    <button type="button" class="danger-btn" onclick="app.deleteUnusedPhotoManagerLibraryItems()"><i class="fa-solid fa-broom"></i> 未使用削除</button>
                    <button type="button" class="danger-btn" onclick="app.deleteSelectedPhotoManagerItems()"><i class="fa-solid fa-trash-can"></i> 選択削除</button>
                </div>
            `;
            bar.querySelector('.photo-manager-bulk-actions')?.insertAdjacentHTML('beforeend', `<button type="button" class="secondary-btn" onclick="app.openPhotoManagerDuplicateReview()"><i class="fa-solid fa-clone"></i> 重複整理 ${duplicateCount ? `(${duplicateCount})` : ''}</button>`);
            bar.querySelector('.photo-manager-bulk-actions')?.insertAdjacentHTML('beforeend', `<button type="button" class="secondary-btn" onclick="app.openPhotoManagerTrashDialog()"><i class="fa-solid fa-trash-restore"></i> ゴミ箱 ${(store.activeData.photoManagerTrash || []).length ? `(${store.activeData.photoManagerTrash.length})` : ''}</button>`);
        }

        readPhotoManagerFileAsDataUrl(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(reader.error || new Error('画像を読み込めませんでした'));
                reader.readAsDataURL(file);
            });
        }

        addPhotoManagerLibraryImage(src, name = '') {
            if (!src) return null;
            const item = {
                id: this.createPhotoManagerLibraryId(),
                src,
                name: String(name || '').trim() || 'クリップボード画像',
                caption: '',
                date: this.getPhotoManagerToday(),
                marks: [],
                createdAt: Date.now()
            };
            this.getPhotoManagerLibrary().unshift(item);
            return item;
        }

        finishPhotoManagerImport(count = 0, message = '') {
            if (!count) return;
            store.save();
            const sourceSelect = document.getElementById('photo-manager-source');
            if (sourceSelect && sourceSelect.value !== 'library') sourceSelect.value = 'library';
            this.renderPhotoManager();
            this.showPhotoManagerNotice(message || `${count}枚の画像を登録しました`);
        }

        showPhotoManagerNotice(message = '') {
            const text = String(message || '').trim();
            if (!text) return;
            if (typeof this.showFiveSAssigneeSavedNotice === 'function') {
                this.showFiveSAssigneeSavedNotice(text);
                return;
            }
            alert(text);
        }

        async importPhotoManagerFiles(fileList) {
            const files = Array.from(fileList || []).filter(file => /^image\//i.test(file.type || ''));
            if (!files.length) return;
            const library = this.getPhotoManagerLibrary();
            const today = this.getPhotoManagerToday();
            for (const file of files) {
                try {
                    const src = await this.readPhotoManagerFileAsDataUrl(file);
                    library.unshift({
                        id: this.createPhotoManagerLibraryId(),
                        src,
                        name: file.name ? file.name.replace(/\.[^.]+$/, '') : '取込画像',
                        caption: '',
                        date: today,
                        marks: [],
                        createdAt: Date.now()
                    });
                } catch (error) {
                    console.error(error);
                }
            }
            store.save();
            const sourceSelect = document.getElementById('photo-manager-source');
            if (sourceSelect && sourceSelect.value !== 'library') sourceSelect.value = 'library';
            this.renderPhotoManager();
        }

        async importPhotoManagerClipboardBlob(blob) {
            if (!blob || !/^image\//i.test(blob.type || '')) return false;
            const src = await this.readPhotoManagerFileAsDataUrl(blob);
            return !!this.addPhotoManagerLibraryImage(src, 'クリップボード画像');
        }

        async importPhotoManagerImageFromClipboard() {
            if (!navigator.clipboard?.read) {
                this.showPhotoManagerNotice('写真管理画面でCtrl+Vでも貼り付け取込できます');
                return;
            }
            try {
                const items = await navigator.clipboard.read();
                let count = 0;
                for (const item of items) {
                    const type = item.types?.find(value => /^image\//i.test(value));
                    if (!type) continue;
                    const blob = await item.getType(type);
                    if (await this.importPhotoManagerClipboardBlob(blob)) count += 1;
                }
                if (!count) {
                    this.showPhotoManagerNotice('クリップボードに画像がありません');
                    return;
                }
                this.finishPhotoManagerImport(count, `${count}枚のクリップボード画像を登録しました`);
            } catch (error) {
                console.error(error);
                this.showPhotoManagerNotice('写真管理画面でCtrl+Vでも貼り付け取込できます');
            }
        }

        ensurePhotoManagerPasteImportListener() {
            if (this._photoManagerPasteImportListener) return;
            this._photoManagerPasteImportListener = async (event) => {
                if (this.currentView !== 'photos') return;
                const active = document.activeElement;
                const isInput = active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable);
                if (isInput) return;
                const imageItems = Array.from(event?.clipboardData?.items || []).filter(item => /^image\//i.test(item.type || ''));
                if (!imageItems.length) return;
                event.preventDefault();
                let count = 0;
                for (const item of imageItems) {
                    const file = item.getAsFile?.();
                    if (file && await this.importPhotoManagerClipboardBlob(file)) count += 1;
                }
                this.finishPhotoManagerImport(count, `${count}枚のクリップボード画像を登録しました`);
            };
            document.addEventListener('paste', this._photoManagerPasteImportListener);
        }

        findPhotoManagerItem(id) {
            return this.collectPhotoManagerItems().find(item => item.id === id) || null;
        }

        openPhotoManagerSource(id) {
            const item = this.findPhotoManagerItem(id);
            if (!item) return alert('元の写真が見つかりませんでした。');
            item.open?.();
        }

        openPhotoManagerEditor(id) {
            const item = this.findPhotoManagerItem(id);
            if (!item) return alert('写真が見つかりませんでした。');
            const libraryPhoto = item.source === 'library'
                ? this.getPhotoManagerLibrary().find(photo => photo.id === item.id)
                : null;
            const overlays = this.getPhotoManagerOverlays();
            const photo = {
                src: item.src,
                caption: item.caption || item.displayName || item.defaultName || '',
                marks: item.source === 'library'
                    ? (Array.isArray(libraryPhoto?.marks) ? libraryPhoto.marks : [])
                    : (Array.isArray(item.managerMarks) ? item.managerMarks : []),
                index: 0,
                role: 'neutral',
                setKey: '',
                numbers: [],
                orderNumber: null,
                pairNumber: null,
                pairStep: null
            };
            this.openShiftPhotoCompareWithPhotos([photo], {
                source: 'photoManager',
                title: `写真管理編集: ${this.getPhotoManagerName(item) || item.defaultName || '写真'}`,
                globalMarks: [],
                onSync: (context) => {
                    const edited = context.photos?.[0] || {};
                    if (item.source === 'library' && libraryPhoto) {
                        libraryPhoto.caption = edited.caption || '';
                        libraryPhoto.marks = Array.isArray(edited.marks) ? edited.marks : [];
                    } else {
                        overlays[item.id] = Array.isArray(edited.marks) ? edited.marks : [];
                    }
                    store.save();
                    if (document.getElementById('photo-manager-list')) this.renderPhotoManager();
                },
                onClose: () => {
                    if (document.getElementById('photo-manager-list')) this.renderPhotoManager();
                }
            });
        }

        selectVisiblePhotoManagerItems() {
            const selected = this.ensurePhotoManagerSelectionStore();
            document.querySelectorAll('#photo-manager-list .photo-manager-select').forEach(input => {
                input.checked = true;
                selected.add(input.value);
            });
            this.updatePhotoManagerBulkBar();
            this.addPhotoManagerPageOnlyCleanupButton();
        }

        clearVisiblePhotoManagerSelection() {
            const selected = this.ensurePhotoManagerSelectionStore();
            document.querySelectorAll('#photo-manager-list .photo-manager-select').forEach(input => {
                input.checked = false;
                selected.delete(input.value);
            });
            this.updatePhotoManagerBulkBar();
            this.addPhotoManagerPageOnlyCleanupButton();
        }

        getSelectedPhotoManagerIds() {
            return Array.from(this.ensurePhotoManagerSelectionStore());
        }

        renameSelectedPhotoManagerItems() {
            const ids = this.getSelectedPhotoManagerIds();
            const text = (document.getElementById('photo-manager-bulk-title-input')?.value || '').trim();
            if (!ids.length) return this.showPhotoManagerNotice('タイトルを変更する写真を選択してください。');
            if (!text) return this.showPhotoManagerNotice('一括設定するタイトルを入力してください。');
            const names = this.ensurePhotoManagerData();
            ids.forEach((id, index) => {
                names[id] = ids.length > 1 ? `${text} ${index + 1}` : text;
            });
            store.save();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`${ids.length}件のタイトルを変更しました。`);
        }

        getUnusedPhotoManagerLibraryItems() {
            const items = this.collectPhotoManagerItems();
            const usedSrcs = new Set(items.filter(item => item.source !== 'library' && item.src).map(item => item.src));
            (store.activeData?.shiftPhotoRecentImageStamps || []).forEach(item => {
                if (item?.src) usedSrcs.add(item.src);
            });
            (store.activeData?.imageSourceRecentUsed || []).forEach(item => {
                if (item?.src) usedSrcs.add(item.src);
            });
            return items.filter(item => item.source === 'library' && item.src && !usedSrcs.has(item.src));
        }

        deleteUnusedPhotoManagerLibraryItems() {
            const unused = this.getUnusedPhotoManagerLibraryItems();
            if (!unused.length) return this.showPhotoManagerNotice('削除できる未使用の取込画像はありません。');
            this.openPhotoManagerDeleteReview('unused', unused);
        }

        movePhotoManagerItemToTrash(item, reason = 'delete') {
            if (!item?.src || item.source !== 'library') return;
            this.ensurePhotoManagerData();
            const trash = store.activeData.photoManagerTrash;
            trash.unshift({
                trashId: `trash-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
                id: item.id,
                src: item.src,
                name: this.getPhotoManagerName(item) || item.defaultName || item.title || '画像',
                caption: item.caption || '',
                tags: this.getPhotoManagerTags(item),
                marks: Array.isArray(item.marks) ? item.marks : [],
                date: item.date || this.getPhotoManagerToday(),
                deletedAt: Date.now(),
                reason
            });
            store.activeData.photoManagerTrash = trash.slice(0, 80);
        }

        openPhotoManagerTrashDialog() {
            this.ensurePhotoManagerData();
            const trash = store.activeData.photoManagerTrash || [];
            const body = trash.length ? `
                <div class="photo-manager-review-summary">
                    <b>${trash.length}件</b>
                    <span>削除した取込画像を写真管理へ戻せます。</span>
                </div>
                <div class="photo-manager-review-list">
                    ${trash.map(entry => `
                        <article class="photo-manager-review-item">
                            <img src="${entry.src}" alt="${this.escapeHtml(entry.name || '画像')}">
                            <div>
                                <b>${this.escapeHtml(entry.name || '画像')}</b>
                                <span>${entry.deletedAt ? new Date(entry.deletedAt).toLocaleString('ja-JP') : ''}</span>
                                <small>${this.escapeHtml((entry.tags || []).join(' '))}</small>
                            </div>
                            <button type="button" class="primary-btn" onclick="app.restorePhotoManagerTrashItem('${this.escapeJs(entry.trashId)}')">復元</button>
                        </article>
                    `).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                    <button type="button" class="danger-btn" onclick="app.clearPhotoManagerTrash()">完全削除</button>
                </div>
            ` : `
                <div class="photo-manager-review-summary">
                    <b>0件</b>
                    <span>復元できる削除済み画像はありません。</span>
                </div>
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                </div>
            `;
            this.openPhotoManagerReviewDialog('写真管理のゴミ箱', body);
        }

        restorePhotoManagerTrashItem(trashId = '') {
            this.ensurePhotoManagerData();
            const index = (store.activeData.photoManagerTrash || []).findIndex(entry => entry.trashId === trashId);
            if (index < 0) return;
            const entry = store.activeData.photoManagerTrash[index];
            const restored = this.addPhotoManagerLibraryImage(entry.src, entry.name || '復元画像');
            if (restored) {
                restored.caption = entry.caption || '';
                restored.marks = Array.isArray(entry.marks) ? entry.marks : [];
                restored.date = this.getPhotoManagerToday();
                if (entry.tags?.length) store.activeData.photoManagerTags[restored.id] = entry.tags;
            }
            store.activeData.photoManagerTrash.splice(index, 1);
            store.save();
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
            this.showPhotoManagerNotice('画像を復元しました。');
        }

        openPhotoManagerTrashDialog() {
            this.ensurePhotoManagerData();
            const trash = store.activeData.photoManagerTrash || [];
            const help = `
                <div class="photo-manager-trash-help">
                    <b><i class="fa-solid fa-circle-info"></i> 復元できるもの</b>
                    <p>写真管理画面でファイル読込・クリップボード登録した画像、または他の画面から「写真管理へ保存」した画像だけ復元できます。復元先は写真管理の「取込画像」です。</p>
                    <b><i class="fa-solid fa-triangle-exclamation"></i> 復元できないもの</b>
                    <p>連絡帳・機械・部品・メンテ履歴・手順書に貼っただけの画像は、写真管理に登録した画像とは別扱いなので、このゴミ箱の対象外です。完全削除した画像や、上限80件から古くなって消えた画像も復元できません。</p>
                </div>
            `;
            const body = trash.length ? `
                <div class="photo-manager-review-summary">
                    <b>${trash.length}件</b>
                    <span>削除した取込画像を写真管理へ戻せます。</span>
                </div>
                ${help}
                <div class="photo-manager-review-list">
                    ${trash.map(entry => `
                        <article class="photo-manager-review-item">
                            <img src="${entry.src}" alt="${this.escapeHtml(entry.name || '画像')}">
                            <div>
                                <b>${this.escapeHtml(entry.name || '画像')}</b>
                                <span>${entry.deletedAt ? new Date(entry.deletedAt).toLocaleString('ja-JP') : ''}</span>
                                <small>${this.escapeHtml((entry.tags || []).join(' '))}</small>
                            </div>
                            <button type="button" class="primary-btn" onclick="app.restorePhotoManagerTrashItem('${this.escapeJs(entry.trashId)}')">復元</button>
                        </article>
                    `).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                    <button type="button" class="danger-btn" onclick="app.clearPhotoManagerTrash()">完全削除</button>
                </div>
            ` : `
                <div class="photo-manager-review-summary">
                    <b>0件</b>
                    <span>復元できる削除済み取込画像はありません。</span>
                </div>
                ${help}
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                </div>
            `;
            this.openPhotoManagerReviewDialog('写真管理のゴミ箱', body);
        }

        clearPhotoManagerTrash() {
            this.ensurePhotoManagerData();
            if (!(store.activeData.photoManagerTrash || []).length) return;
            if (!confirm('ゴミ箱内の画像を完全削除します。よろしいですか？')) return;
            store.activeData.photoManagerTrash = [];
            store.save();
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
        }

        executeDeleteUnusedPhotoManagerLibraryItems() {
            const unused = this.getUnusedPhotoManagerLibraryItems();
            if (!unused.length) {
                this.closePhotoManagerReviewDialog();
                return this.showPhotoManagerNotice('削除できる未使用の取込画像はありません。');
            }
            const names = this.ensurePhotoManagerData();
            const overlays = this.getPhotoManagerOverlays();
            unused.sort((a, b) => (b.deleteIndex || 0) - (a.deleteIndex || 0)).forEach(item => {
                this.movePhotoManagerItemToTrash(item, 'unused');
                item.deletePhoto?.();
                delete names[item.id];
                delete overlays[item.id];
                this.ensurePhotoManagerSelectionStore().delete(item.id);
            });
            store.save();
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`${unused.length}件の未使用取込画像を削除しました。`);
        }

        getPhotoManagerDuplicateGroups() {
            const groups = new Map();
            this.collectPhotoManagerItems().forEach(item => {
                if (!item?.src) return;
                if (!groups.has(item.src)) groups.set(item.src, []);
                groups.get(item.src).push(item);
            });
            return Array.from(groups.values())
                .filter(group => group.length > 1)
                .map(group => ({
                    src: group[0].src,
                    items: group,
                    libraryItems: group.filter(item => item.source === 'library')
                }));
        }

        getPhotoManagerSourceLabel(item = {}) {
            const labels = {
                library: '取込画像',
                machine: '機械',
                part: '部品',
                history: 'メンテ履歴',
                guide: '手順書',
                shift: '連絡帳'
            };
            return labels[item.source] || item.sourceLabel || item.source || '画像';
        }

        getPhotoManagerDuplicateUsageItems(target = {}, groups = this.getPhotoManagerDuplicateGroups()) {
            const group = (groups || []).find(item => item.src === target.src);
            return (group?.items || []).filter(item => item.id !== target.id);
        }

        getPhotoManagerDuplicateRecommendation(target = {}, usages = []) {
            if (target.source !== 'library') return '';
            if ((usages || []).some(item => item.source !== 'library')) return '削除推奨: 機械・履歴・連絡帳など本来の使用先に同じ画像が残ります。';
            if ((usages || []).some(item => item.source === 'library')) return '削除候補: 同じ取込画像が複数あります。残す画像を確認してください。';
            return '';
        }

        getPhotoManagerUsageItemsForSrc(src = '', includeLibrary = false) {
            if (!src) return [];
            return this.collectPhotoManagerItems().filter(item => item.src === src && (includeLibrary || item.source !== 'library'));
        }

        getPhotoManagerUsageSummary(item = {}) {
            const usages = this.getPhotoManagerUsageItemsForSrc(item.src || '', false);
            const count = usages.length;
            return {
                count,
                usages,
                label: count ? `${count}か所で使用中` : '未使用'
            };
        }

        getPhotoManagerPageOnlyItems() {
            const items = this.collectPhotoManagerItems();
            const librarySrcs = new Set(items.filter(item => item.source === 'library' && item.src).map(item => item.src));
            return items.filter(item => item.source !== 'library' && item.src && !librarySrcs.has(item.src));
        }

        getPhotoManagerPageOnlyDeleteChoice(id = '') {
            if (!this._photoManagerPageOnlyDeleteChoices) this._photoManagerPageOnlyDeleteChoices = {};
            return this._photoManagerPageOnlyDeleteChoices[id] === true;
        }

        setPhotoManagerPageOnlyDeleteChoice(id = '', shouldDelete = true) {
            if (!this._photoManagerPageOnlyDeleteChoices) this._photoManagerPageOnlyDeleteChoices = {};
            this._photoManagerPageOnlyDeleteChoices[id] = !!shouldDelete;
            this.openPhotoManagerPageOnlyCleanupReview();
        }

        setAllPhotoManagerPageOnlyDeleteChoices(shouldDelete = true) {
            if (!this._photoManagerPageOnlyDeleteChoices) this._photoManagerPageOnlyDeleteChoices = {};
            this.getFilteredPhotoManagerPageOnlyItems().forEach(item => {
                this._photoManagerPageOnlyDeleteChoices[item.id] = !!shouldDelete;
            });
            this.openPhotoManagerPageOnlyCleanupReview();
        }

        openPhotoManagerPageOnlyCleanupReview() {
            const items = this.getPhotoManagerPageOnlyItems();
            if (!items.length) return this.showPhotoManagerNotice('写真管理に無い個別ページ側だけの写真は見つかりませんでした。');
            const selected = items.filter(item => this.getPhotoManagerPageOnlyDeleteChoice(item.id));
            const body = `
                <div class="photo-manager-review-summary danger">
                    <b>${items.length}件</b>
                    <span>写真管理には登録されておらず、連絡帳など個別ページ側にだけ残っている写真です。選択したものだけ削除できます。</span>
                </div>
                <div class="photo-manager-page-only-actions">
                    <button type="button" class="secondary-btn" onclick="app.setAllPhotoManagerPageOnlyDeleteChoices(true)">すべて消すにする</button>
                    <button type="button" class="secondary-btn" onclick="app.setAllPhotoManagerPageOnlyDeleteChoices(false)">すべて残すにする</button>
                    <span>選択中 ${selected.length}件</span>
                </div>
                <div class="photo-manager-review-list">
                    ${items.map(item => {
                        const checked = this.getPhotoManagerPageOnlyDeleteChoice(item.id);
                        const label = this.getPhotoManagerSourceLabel(item);
                        const title = this.getPhotoManagerName(item) || item.defaultName || item.title || label;
                        return `
                            <article class="photo-manager-review-item photo-manager-page-only-item ${checked ? 'delete' : 'keep'}">
                                <img src="${item.src}" alt="${this.escapeHtml(title)}">
                                <div>
                                    <b>${this.escapeHtml(label)}: ${this.escapeHtml(String(title).slice(0, 60))}</b>
                                    <span>${item.date ? this.escapeHtml(item.date) : '日付なし'}</span>
                                    <small>写真管理には登録されていません。消すとこのページから削除され、写真管理のゴミ箱では復元できません。</small>
                                </div>
                                <div class="photo-manager-duplicate-choice-buttons wide">
                                    <button type="button" class="${!checked ? 'active' : ''}" onclick="app.setPhotoManagerPageOnlyDeleteChoice('${this.escapeJs(item.id)}', false)">残す</button>
                                    <button type="button" class="${checked ? 'active' : ''}" onclick="app.setPhotoManagerPageOnlyDeleteChoice('${this.escapeJs(item.id)}', true)">消す</button>
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <span class="photo-manager-review-restore-note"><i class="fa-solid fa-triangle-exclamation"></i> 個別ページ側だけの写真は写真管理ゴミ箱の復元対象外です。</span>
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                    <button type="button" class="danger-btn" ${selected.length ? '' : 'disabled'} onclick="app.executePhotoManagerPageOnlyCleanup()">選択した写真を削除 ${selected.length ? `(${selected.length})` : ''}</button>
                </div>
            `;
            this.openPhotoManagerReviewDialog('個別ページだけに残った写真の整理', body);
        }

        executePhotoManagerPageOnlyCleanup() {
            const targets = this.getPhotoManagerPageOnlyItems().filter(item => this.getPhotoManagerPageOnlyDeleteChoice(item.id));
            if (!targets.length) return this.showPhotoManagerNotice('削除する写真が選択されていません。');
            const overlays = this.getPhotoManagerOverlays();
            targets.sort((a, b) => (b.deleteIndex || 0) - (a.deleteIndex || 0)).forEach(item => {
                item.deletePhoto?.();
                delete overlays[item.id];
                this.ensurePhotoManagerSelectionStore().delete(item.id);
                if (this._photoManagerPageOnlyDeleteChoices) delete this._photoManagerPageOnlyDeleteChoices[item.id];
            });
            store.save();
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`個別ページ側だけの写真を${targets.length}件削除しました。`);
        }

        estimatePhotoManagerImageBytes(src = '') {
            const text = String(src || '');
            if (!text.startsWith('data:')) return 0;
            const comma = text.indexOf(',');
            const payload = comma >= 0 ? text.slice(comma + 1) : text;
            return Math.max(0, Math.floor(payload.length * 0.75));
        }

        formatPhotoManagerBytes(bytes = 0) {
            const value = Math.max(0, Number(bytes) || 0);
            if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
            if (value >= 1024) return `${Math.round(value / 1024)}KB`;
            return `${Math.round(value)}B`;
        }

        getFilteredPhotoManagerPageOnlyItems() {
            let items = this.getPhotoManagerPageOnlyItems();
            const source = this._photoManagerPageOnlySourceFilter || 'all';
            const sort = this._photoManagerPageOnlySort || 'old';
            if (source !== 'all') items = items.filter(item => item.source === source);
            const sizeOf = item => this.estimatePhotoManagerImageBytes(item.src);
            items.sort((a, b) => {
                if (sort === 'size_desc') return sizeOf(b) - sizeOf(a);
                if (sort === 'size_asc') return sizeOf(a) - sizeOf(b);
                if (sort === 'new') return (b.date || '').localeCompare(a.date || '');
                if (sort === 'source') return this.getPhotoManagerSourceLabel(a).localeCompare(this.getPhotoManagerSourceLabel(b), 'ja') || (a.date || '').localeCompare(b.date || '');
                return (a.date || '').localeCompare(b.date || '');
            });
            return items;
        }

        setPhotoManagerPageOnlyFilter(source = 'all') {
            this._photoManagerPageOnlySourceFilter = source || 'all';
            this.openPhotoManagerPageOnlyCleanupReview();
        }

        setPhotoManagerPageOnlySort(sort = 'old') {
            this._photoManagerPageOnlySort = sort || 'old';
            this.openPhotoManagerPageOnlyCleanupReview();
        }

        registerPhotoManagerPageOnlyItem(id = '') {
            const item = this.getPhotoManagerPageOnlyItems().find(photo => photo.id === id);
            if (!item?.src) return this.showPhotoManagerNotice('登録する写真が見つかりませんでした。');
            const name = this.getPhotoManagerName(item) || item.defaultName || item.title || this.getPhotoManagerSourceLabel(item);
            const added = this.addPhotoManagerLibraryImage(item.src, name);
            if (added) {
                store.save();
                if (this._photoManagerPageOnlyDeleteChoices) delete this._photoManagerPageOnlyDeleteChoices[id];
                this.showPhotoManagerNotice('写真管理へ登録しました。');
            }
            this.openPhotoManagerPageOnlyCleanupReview();
        }

        openPhotoManagerPageOnlyCleanupReview() {
            const allItems = this.getPhotoManagerPageOnlyItems();
            if (!allItems.length) return this.showPhotoManagerNotice('写真管理に無い個別ページ側だけの写真は見つかりませんでした。');
            const items = this.getFilteredPhotoManagerPageOnlyItems();
            const selected = allItems.filter(item => this.getPhotoManagerPageOnlyDeleteChoice(item.id));
            const visibleSelected = items.filter(item => this.getPhotoManagerPageOnlyDeleteChoice(item.id));
            const selectedBytes = selected.reduce((sum, item) => sum + this.estimatePhotoManagerImageBytes(item.src), 0);
            const visibleBytes = items.reduce((sum, item) => sum + this.estimatePhotoManagerImageBytes(item.src), 0);
            const source = this._photoManagerPageOnlySourceFilter || 'all';
            const sort = this._photoManagerPageOnlySort || 'old';
            const sourceOptions = [
                ['all', 'すべて'],
                ['shift', '連絡帳'],
                ['history', 'メンテ履歴'],
                ['guide', '手順書'],
                ['machine', '機械'],
                ['part', '部品']
            ];
            const body = `
                <div class="photo-manager-review-summary danger">
                    <b>${items.length}件</b>
                    <span>写真管理には登録されておらず、個別ページ側にだけ残っている写真です。選択中 ${selected.length}件 / 約${this.formatPhotoManagerBytes(selectedBytes)}削減予定。</span>
                </div>
                <div class="photo-manager-page-only-actions">
                    <label>場所
                        <select onchange="app.setPhotoManagerPageOnlyFilter(this.value)">
                            ${sourceOptions.map(([value, label]) => `<option value="${value}" ${source === value ? 'selected' : ''}>${label}</option>`).join('')}
                        </select>
                    </label>
                    <label>並び
                        <select onchange="app.setPhotoManagerPageOnlySort(this.value)">
                            <option value="old" ${sort === 'old' ? 'selected' : ''}>古い順</option>
                            <option value="new" ${sort === 'new' ? 'selected' : ''}>新しい順</option>
                            <option value="size_desc" ${sort === 'size_desc' ? 'selected' : ''}>大きい順</option>
                            <option value="size_asc" ${sort === 'size_asc' ? 'selected' : ''}>小さい順</option>
                            <option value="source" ${sort === 'source' ? 'selected' : ''}>場所順</option>
                        </select>
                    </label>
                    <button type="button" class="secondary-btn" onclick="app.setAllPhotoManagerPageOnlyDeleteChoices(true)">すべて消す</button>
                    <button type="button" class="secondary-btn" onclick="app.setAllPhotoManagerPageOnlyDeleteChoices(false)">すべて残す</button>
                    <span>表示 ${items.length}件 / 約${this.formatPhotoManagerBytes(visibleBytes)}</span>
                </div>
                <div class="photo-manager-review-list">
                    ${items.map(item => {
                        const checked = this.getPhotoManagerPageOnlyDeleteChoice(item.id);
                        const label = this.getPhotoManagerSourceLabel(item);
                        const title = this.getPhotoManagerName(item) || item.defaultName || item.title || label;
                        const sizeText = this.formatPhotoManagerBytes(this.estimatePhotoManagerImageBytes(item.src));
                        return `
                            <article class="photo-manager-review-item photo-manager-page-only-item ${checked ? 'delete' : 'keep'}">
                                <img src="${item.src}" alt="${this.escapeHtml(title)}">
                                <div>
                                    <b>${this.escapeHtml(label)}: ${this.escapeHtml(String(title).slice(0, 60))}</b>
                                    <span>${item.date ? this.escapeHtml(item.date) : '日付なし'} / 約${sizeText}</span>
                                    <small>写真管理には登録されていません。消すとこのページから削除され、写真管理のゴミ箱では復元できません。</small>
                                </div>
                                <div class="photo-manager-page-only-row-actions">
                                    <button type="button" class="secondary-btn" onclick="app.registerPhotoManagerPageOnlyItem('${this.escapeJs(item.id)}')">写真管理へ登録</button>
                                    <div class="photo-manager-duplicate-choice-buttons wide">
                                        <button type="button" class="${!checked ? 'active' : ''}" onclick="app.setPhotoManagerPageOnlyDeleteChoice('${this.escapeJs(item.id)}', false)">残す</button>
                                        <button type="button" class="${checked ? 'active' : ''}" onclick="app.setPhotoManagerPageOnlyDeleteChoice('${this.escapeJs(item.id)}', true)">消す</button>
                                    </div>
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <span class="photo-manager-review-restore-note"><i class="fa-solid fa-triangle-exclamation"></i> 個別ページ側だけの写真は写真管理ゴミ箱の復元対象外です。</span>
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                    <button type="button" class="danger-btn" ${selected.length ? '' : 'disabled'} onclick="app.executePhotoManagerPageOnlyCleanup()">選択した写真を削除 ${selected.length ? `(${selected.length})` : ''}</button>
                </div>
            `;
            this.openPhotoManagerReviewDialog('個別ページだけに残った写真の整理', body);
        }

        executePhotoManagerPageOnlyCleanup() {
            const targets = this.getPhotoManagerPageOnlyItems().filter(item => this.getPhotoManagerPageOnlyDeleteChoice(item.id));
            if (!targets.length) return this.showPhotoManagerNotice('削除する写真が選択されていません。');
            const bytes = targets.reduce((sum, item) => sum + this.estimatePhotoManagerImageBytes(item.src), 0);
            if (!confirm(`${targets.length}件の個別ページ側写真を削除します。\n約${this.formatPhotoManagerBytes(bytes)}削減予定です。\n\nこの削除は写真管理ゴミ箱では復元できません。実行しますか？`)) return;
            const overlays = this.getPhotoManagerOverlays();
            targets.sort((a, b) => (b.deleteIndex || 0) - (a.deleteIndex || 0)).forEach(item => {
                item.deletePhoto?.();
                delete overlays[item.id];
                this.ensurePhotoManagerSelectionStore().delete(item.id);
                if (this._photoManagerPageOnlyDeleteChoices) delete this._photoManagerPageOnlyDeleteChoices[item.id];
            });
            store.save();
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`個別ページ側だけの写真を${targets.length}件削除しました。`);
        }

        getPhotoManagerPageOnlyAgeCutoff(age = 'all') {
            const now = new Date();
            const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (age === '3m') date.setMonth(date.getMonth() - 3);
            else if (age === '6m') date.setMonth(date.getMonth() - 6);
            else if (age === '1y') date.setFullYear(date.getFullYear() - 1);
            else if (age === '2y') date.setFullYear(date.getFullYear() - 2);
            else return '';
            return date.toISOString().slice(0, 10);
        }

        getFilteredPhotoManagerPageOnlyItems() {
            let items = this.getPhotoManagerPageOnlyItems();
            const source = this._photoManagerPageOnlySourceFilter || 'all';
            const sort = this._photoManagerPageOnlySort || 'old';
            const age = this._photoManagerPageOnlyAgeFilter || 'all';
            if (source !== 'all') items = items.filter(item => item.source === source);
            const cutoff = this.getPhotoManagerPageOnlyAgeCutoff(age);
            if (cutoff) items = items.filter(item => (item.date || '') && item.date <= cutoff);
            const sizeOf = item => this.estimatePhotoManagerImageBytes(item.src);
            items.sort((a, b) => {
                if (sort === 'size_desc') return sizeOf(b) - sizeOf(a);
                if (sort === 'size_asc') return sizeOf(a) - sizeOf(b);
                if (sort === 'new') return (b.date || '').localeCompare(a.date || '');
                if (sort === 'source') return this.getPhotoManagerSourceLabel(a).localeCompare(this.getPhotoManagerSourceLabel(b), 'ja') || (a.date || '').localeCompare(b.date || '');
                return (a.date || '').localeCompare(b.date || '');
            });
            return items;
        }

        setPhotoManagerPageOnlyAgeFilter(age = 'all') {
            this._photoManagerPageOnlyAgeFilter = age || 'all';
            this.openPhotoManagerPageOnlyCleanupReview();
        }

        openPhotoManagerPageOnlyCleanupReview() {
            const allItems = this.getPhotoManagerPageOnlyItems();
            if (!allItems.length) return this.showPhotoManagerNotice('写真管理に無い個別ページ側だけの写真は見つかりませんでした。');
            const items = this.getFilteredPhotoManagerPageOnlyItems();
            const selected = allItems.filter(item => this.getPhotoManagerPageOnlyDeleteChoice(item.id));
            const selectedBytes = selected.reduce((sum, item) => sum + this.estimatePhotoManagerImageBytes(item.src), 0);
            const visibleBytes = items.reduce((sum, item) => sum + this.estimatePhotoManagerImageBytes(item.src), 0);
            const source = this._photoManagerPageOnlySourceFilter || 'all';
            const sort = this._photoManagerPageOnlySort || 'old';
            const age = this._photoManagerPageOnlyAgeFilter || 'all';
            const sourceOptions = [
                ['all', 'すべて'],
                ['shift', '連絡帳'],
                ['history', 'メンテ履歴'],
                ['guide', '手順書'],
                ['machine', '機械'],
                ['part', '部品']
            ];
            const ageOptions = [
                ['all', 'すべて'],
                ['3m', '3か月以上前'],
                ['6m', '半年以上前'],
                ['1y', '1年以上前'],
                ['2y', '2年以上前']
            ];
            const body = `
                <div class="photo-manager-review-summary danger">
                    <b>${items.length}件</b>
                    <span>写真管理には登録されておらず、個別ページ側にだけ残っている写真です。選択中 ${selected.length}件 / 約${this.formatPhotoManagerBytes(selectedBytes)}削減予定。</span>
                </div>
                <div class="photo-manager-page-only-actions">
                    <label>場所
                        <select onchange="app.setPhotoManagerPageOnlyFilter(this.value)">
                            ${sourceOptions.map(([value, label]) => `<option value="${value}" ${source === value ? 'selected' : ''}>${label}</option>`).join('')}
                        </select>
                    </label>
                    <label>古さ
                        <select onchange="app.setPhotoManagerPageOnlyAgeFilter(this.value)">
                            ${ageOptions.map(([value, label]) => `<option value="${value}" ${age === value ? 'selected' : ''}>${label}</option>`).join('')}
                        </select>
                    </label>
                    <label>並び
                        <select onchange="app.setPhotoManagerPageOnlySort(this.value)">
                            <option value="old" ${sort === 'old' ? 'selected' : ''}>古い順</option>
                            <option value="new" ${sort === 'new' ? 'selected' : ''}>新しい順</option>
                            <option value="size_desc" ${sort === 'size_desc' ? 'selected' : ''}>大きい順</option>
                            <option value="size_asc" ${sort === 'size_asc' ? 'selected' : ''}>小さい順</option>
                            <option value="source" ${sort === 'source' ? 'selected' : ''}>場所順</option>
                        </select>
                    </label>
                    <button type="button" class="secondary-btn" onclick="app.setAllPhotoManagerPageOnlyDeleteChoices(true)">すべて消す</button>
                    <button type="button" class="secondary-btn" onclick="app.setAllPhotoManagerPageOnlyDeleteChoices(false)">すべて残す</button>
                    <span>表示 ${items.length}件 / 約${this.formatPhotoManagerBytes(visibleBytes)}</span>
                </div>
                <div class="photo-manager-review-list">
                    ${items.map(item => {
                        const checked = this.getPhotoManagerPageOnlyDeleteChoice(item.id);
                        const label = this.getPhotoManagerSourceLabel(item);
                        const title = this.getPhotoManagerName(item) || item.defaultName || item.title || label;
                        const sizeText = this.formatPhotoManagerBytes(this.estimatePhotoManagerImageBytes(item.src));
                        return `
                            <article class="photo-manager-review-item photo-manager-page-only-item ${checked ? 'delete' : 'keep'}">
                                <img src="${item.src}" alt="${this.escapeHtml(title)}">
                                <div>
                                    <b>${this.escapeHtml(label)}: ${this.escapeHtml(String(title).slice(0, 60))}</b>
                                    <span>${item.date ? this.escapeHtml(item.date) : '日付なし'} / 約${sizeText}</span>
                                    <small>写真管理には登録されていません。消すとこのページから削除され、写真管理のゴミ箱では復元できません。</small>
                                </div>
                                <div class="photo-manager-page-only-row-actions">
                                    <button type="button" class="secondary-btn" onclick="app.registerPhotoManagerPageOnlyItem('${this.escapeJs(item.id)}')">写真管理へ登録</button>
                                    <div class="photo-manager-duplicate-choice-buttons wide">
                                        <button type="button" class="${!checked ? 'active' : ''}" onclick="app.setPhotoManagerPageOnlyDeleteChoice('${this.escapeJs(item.id)}', false)">残す</button>
                                        <button type="button" class="${checked ? 'active' : ''}" onclick="app.setPhotoManagerPageOnlyDeleteChoice('${this.escapeJs(item.id)}', true)">消す</button>
                                    </div>
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <span class="photo-manager-review-restore-note"><i class="fa-solid fa-triangle-exclamation"></i> 個別ページ側だけの写真は写真管理ゴミ箱の復元対象外です。</span>
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                    <button type="button" class="danger-btn" ${selected.length ? '' : 'disabled'} onclick="app.executePhotoManagerPageOnlyCleanup()">選択した写真を削除 ${selected.length ? `(${selected.length})` : ''}</button>
                </div>
            `;
            this.openPhotoManagerReviewDialog('個別ページだけに残った写真の整理', body);
        }

        openPhotoManagerUsageSource(id = '') {
            const item = this.findPhotoManagerItem(id);
            if (!item) return this.showPhotoManagerNotice?.('使用先が見つかりませんでした。');
            item.open?.();
        }

        getPhotoManagerDuplicateDeleteChoice(id = '') {
            if (!this._photoManagerDuplicateDeleteChoices) this._photoManagerDuplicateDeleteChoices = {};
            return this._photoManagerDuplicateDeleteChoices[id] !== false;
        }

        setPhotoManagerDuplicateDeleteChoice(id = '', shouldDelete = true) {
            if (!this._photoManagerDuplicateDeleteChoices) this._photoManagerDuplicateDeleteChoices = {};
            this._photoManagerDuplicateDeleteChoices[id] = !!shouldDelete;
            this.openPhotoManagerDuplicateReview();
        }

        getPhotoManagerDuplicateDeleteTargets(groups = this.getPhotoManagerDuplicateGroups(), options = {}) {
            const targets = [];
            groups.forEach(group => {
                const libraryItems = group.libraryItems || [];
                if (!libraryItems.length) return;
                const keepId = this._photoManagerDuplicateKeepIds?.[group.src] || group.items.find(item => item.source !== 'library')?.id || libraryItems[0]?.id || '';
                const hasSourceItem = group.items.some(item => item.source !== 'library' && item.id === keepId);
                const sorted = libraryItems.slice().sort((a, b) => (b.deleteIndex || 0) - (a.deleteIndex || 0));
                const deletable = hasSourceItem ? sorted : sorted.filter(item => item.id !== keepId);
                deletable.forEach(item => {
                    if (!options.ignoreChoices && this.getPhotoManagerDuplicateDeleteChoice(item.id) === false) return;
                    targets.push(item);
                });
            });
            return targets;
        }

        setPhotoManagerDuplicateKeep(groupSrc = '', keepId = '') {
            if (!this._photoManagerDuplicateKeepIds) this._photoManagerDuplicateKeepIds = {};
            this._photoManagerDuplicateKeepIds[groupSrc] = keepId;
            this._photoManagerDuplicateDeleteChoices = {};
            this.openPhotoManagerDuplicateReview();
        }

        enhancePhotoManagerDuplicateReview(groups = []) {
            document.querySelectorAll('#photo-manager-review-overlay .photo-manager-review-item').forEach((card, index) => {
                const group = groups[index];
                const host = card.querySelector('div');
                if (!group || !host || host.querySelector('.photo-manager-keep-row')) return;
                const keepId = this._photoManagerDuplicateKeepIds?.[group.src] || group.items.find(item => item.source !== 'library')?.id || group.libraryItems[0]?.id || '';
                const row = document.createElement('div');
                row.className = 'photo-manager-keep-row';
                row.innerHTML = group.items.map(item => `<button type="button" class="${item.id === keepId ? 'active' : ''}" onclick="app.setPhotoManagerDuplicateKeep('${this.escapeJs(group.src)}', '${this.escapeJs(item.id)}')">残す: ${this.escapeHtml(item.sourceLabel || item.source || '画像')}</button>`).join('');
                host.appendChild(row);
            });
        }

        enhancePhotoManagerDuplicateReview(groups = []) {
            document.querySelectorAll('#photo-manager-review-overlay .photo-manager-review-item').forEach((card, index) => {
                const group = groups[index];
                const host = card.querySelector('div');
                if (!group || !host || host.querySelector('.photo-manager-keep-row')) return;
                const keepId = this._photoManagerDuplicateKeepIds?.[group.src] || group.items.find(item => item.source !== 'library')?.id || group.libraryItems[0]?.id || '';
                const row = document.createElement('div');
                row.className = 'photo-manager-keep-row';
                row.innerHTML = group.items.map(item => {
                    const label = this.getPhotoManagerSourceLabel(item);
                    const title = this.getPhotoManagerName(item) || item.defaultName || item.title || label;
                    return `<button type="button" class="${item.id === keepId ? 'active' : ''}" onclick="app.setPhotoManagerDuplicateKeep('${this.escapeJs(group.src)}', '${this.escapeJs(item.id)}')">残す: ${this.escapeHtml(label)} ${this.escapeHtml(String(title).slice(0, 24))}</button>`;
                }).join('');
                host.appendChild(row);
            });
        }

        openPhotoManagerDuplicateReview() {
            const groups = this.getPhotoManagerDuplicateGroups();
            if (!groups.length) return this.showPhotoManagerNotice('重複画像は見つかりませんでした。');
            const targets = this.getPhotoManagerDuplicateDeleteTargets(groups);
            const body = `
                <div class="photo-manager-review-summary">
                    <b>${groups.length}組</b>
                    <span>同じ画像が複数登録されています。元データ側は残し、取込画像の重複だけ整理できます。</span>
                </div>
                <div class="photo-manager-review-list">
                    ${groups.map((group, groupIndex) => {
                        const title = this.getPhotoManagerName(group.items[0]) || group.items[0].defaultName || group.items[0].title || '画像';
                        return `
                            <article class="photo-manager-review-item">
                                <img src="${group.src}" alt="${this.escapeHtml(title)}">
                                <div>
                                    <b>${this.escapeHtml(title)}</b>
                                    <span>${group.items.length}件 / 取込 ${group.libraryItems.length}件</span>
                                    <small>${group.items.map(item => this.escapeHtml(item.sourceLabel || item.source || '')).join(' / ')}</small>
                                </div>
                                <button type="button" class="secondary-btn" onclick="app.selectPhotoManagerDuplicateGroup(${groupIndex})">この組を選択</button>
                            </article>
                        `;
                    }).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                    <button type="button" class="danger-btn" ${targets.length ? '' : 'disabled'} onclick="app.executePhotoManagerDuplicateCleanup()">重複取込を削除 ${targets.length ? `(${targets.length})` : ''}</button>
                </div>
            `;
            this._photoManagerDuplicateReviewGroups = groups;
            setTimeout(() => this.enhancePhotoManagerDuplicateReview(groups), 0);
            this.openPhotoManagerReviewDialog('重複画像の確認', body);
        }

        openPhotoManagerDuplicateReview() {
            const groups = this.getPhotoManagerDuplicateGroups();
            if (!groups.length) return this.showPhotoManagerNotice('重複画像は見つかりませんでした。');
            const candidateTargets = this.getPhotoManagerDuplicateDeleteTargets(groups, { ignoreChoices: true });
            const targets = this.getPhotoManagerDuplicateDeleteTargets(groups);
            const body = `
                <div class="photo-manager-review-summary danger">
                    <b>${groups.length}組</b>
                    <span>同じ画像の使用先を確認して、削除する取込画像だけ〇にしてください。×にした画像は今回は残します。</span>
                </div>
                <div class="photo-manager-review-list">
                    ${groups.map((group, groupIndex) => {
                        const title = this.getPhotoManagerName(group.items[0]) || group.items[0].defaultName || group.items[0].title || '画像';
                        const deleteCandidates = candidateTargets.filter(item => item.src === group.src);
                        return `
                            <article class="photo-manager-review-item">
                                <img src="${group.src}" alt="${this.escapeHtml(title)}">
                                <div>
                                    <b>${this.escapeHtml(title)}</b>
                                    <span>${group.items.length}件 / 取込 ${group.libraryItems.length}件</span>
                                    <small>${group.items.map(item => this.escapeHtml(this.getPhotoManagerSourceLabel(item))).join(' / ')}</small>
                                    ${deleteCandidates.length ? `
                                        <div class="photo-manager-duplicate-delete-choices">
                                            ${deleteCandidates.map(item => {
                                                const usages = this.getPhotoManagerDuplicateUsageItems(item, groups);
                                                const checked = this.getPhotoManagerDuplicateDeleteChoice(item.id);
                                                const usageText = usages.length
                                                    ? usages.map(usage => `${this.getPhotoManagerSourceLabel(usage)}${usage.title ? `: ${usage.title}` : ''}`).join(' / ')
                                                    : '他の使用先はありません';
                                                return `
                                                    <div class="photo-manager-duplicate-delete-choice ${checked ? 'delete' : 'keep'}">
                                                        <div>
                                                            <b>${this.escapeHtml(this.getPhotoManagerName(item) || item.defaultName || item.title || '取込画像')}</b>
                                                            <span>${this.escapeHtml(usageText)} で使用している同じ画像があります。削除しますか？</span>
                                                        </div>
                                                        <div class="photo-manager-duplicate-choice-buttons">
                                                            <button type="button" class="${checked ? 'active' : ''}" onclick="app.setPhotoManagerDuplicateDeleteChoice('${this.escapeJs(item.id)}', true)">〇</button>
                                                            <button type="button" class="${!checked ? 'active' : ''}" onclick="app.setPhotoManagerDuplicateDeleteChoice('${this.escapeJs(item.id)}', false)">×</button>
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                                <button type="button" class="secondary-btn" onclick="app.selectPhotoManagerDuplicateGroup(${groupIndex})">この組を選択</button>
                            </article>
                        `;
                    }).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                    <button type="button" class="danger-btn" ${targets.length ? '' : 'disabled'} onclick="app.executePhotoManagerDuplicateCleanup()">〇の取込画像を削除 ${targets.length ? `(${targets.length}/${candidateTargets.length})` : ''}</button>
                </div>
            `;
            this._photoManagerDuplicateReviewGroups = groups;
            setTimeout(() => this.enhancePhotoManagerDuplicateReview(groups), 0);
            this.openPhotoManagerReviewDialog('重複画像の確認', body);
        }

        openPhotoManagerDuplicateReview() {
            const groups = this.getPhotoManagerDuplicateGroups();
            if (!groups.length) return this.showPhotoManagerNotice('重複画像は見つかりませんでした。');
            const candidateTargets = this.getPhotoManagerDuplicateDeleteTargets(groups, { ignoreChoices: true });
            const targets = this.getPhotoManagerDuplicateDeleteTargets(groups);
            const body = `
                <div class="photo-manager-review-summary danger">
                    <b>${groups.length}組</b>
                    <span>同じ画像の使用先を確認して、削除する取込画像だけ〇にしてください。削除後もゴミ箱から復元できます。</span>
                </div>
                <div class="photo-manager-review-list">
                    ${groups.map((group, groupIndex) => {
                        const title = this.getPhotoManagerName(group.items[0]) || group.items[0].defaultName || group.items[0].title || '画像';
                        const deleteCandidates = candidateTargets.filter(item => item.src === group.src);
                        return `
                            <article class="photo-manager-review-item">
                                <img src="${group.src}" alt="${this.escapeHtml(title)}">
                                <div>
                                    <b>${this.escapeHtml(title)}</b>
                                    <span>${group.items.length}件 / 取込 ${group.libraryItems.length}件</span>
                                    <small>${group.items.map(item => this.escapeHtml(this.getPhotoManagerSourceLabel(item))).join(' / ')}</small>
                                    ${deleteCandidates.length ? `
                                        <div class="photo-manager-duplicate-delete-choices">
                                            ${deleteCandidates.map(item => {
                                                const usages = this.getPhotoManagerDuplicateUsageItems(item, groups);
                                                const checked = this.getPhotoManagerDuplicateDeleteChoice(item.id);
                                                const recommendation = this.getPhotoManagerDuplicateRecommendation(item, usages);
                                                return `
                                                    <div class="photo-manager-duplicate-delete-choice ${checked ? 'delete' : 'keep'}">
                                                        <div>
                                                            <b>${this.escapeHtml(this.getPhotoManagerName(item) || item.defaultName || item.title || '取込画像')}</b>
                                                            ${recommendation ? `<em>${this.escapeHtml(recommendation)}</em>` : ''}
                                                            <span>${usages.length ? '同じ画像の使用先' : '他の使用先はありません'}</span>
                                                            ${usages.length ? `
                                                                <div class="photo-manager-duplicate-usage-links">
                                                                    ${usages.slice(0, 6).map(usage => `
                                                                        <button type="button" onclick="app.openPhotoManagerUsageSource('${this.escapeJs(usage.id)}')" title="${this.escapeHtml(usage.title || '')}">
                                                                            ${this.escapeHtml(this.getPhotoManagerSourceLabel(usage))}
                                                                        </button>
                                                                    `).join('')}
                                                                    ${usages.length > 6 ? `<small>+${usages.length - 6}</small>` : ''}
                                                                </div>
                                                            ` : ''}
                                                        </div>
                                                        <div class="photo-manager-duplicate-choice-buttons">
                                                            <button type="button" class="${checked ? 'active' : ''}" onclick="app.setPhotoManagerDuplicateDeleteChoice('${this.escapeJs(item.id)}', true)">〇</button>
                                                            <button type="button" class="${!checked ? 'active' : ''}" onclick="app.setPhotoManagerDuplicateDeleteChoice('${this.escapeJs(item.id)}', false)">×</button>
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                                <button type="button" class="secondary-btn" onclick="app.selectPhotoManagerDuplicateGroup(${groupIndex})">この組を選択</button>
                            </article>
                        `;
                    }).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <span class="photo-manager-review-restore-note"><i class="fa-solid fa-trash-restore"></i> 削除した画像は写真管理のゴミ箱から復元できます。</span>
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                    <button type="button" class="danger-btn" ${targets.length ? '' : 'disabled'} onclick="app.executePhotoManagerDuplicateCleanup()">〇の取込画像を削除 ${targets.length ? `(${targets.length}/${candidateTargets.length})` : ''}</button>
                </div>
            `;
            this._photoManagerDuplicateReviewGroups = groups;
            setTimeout(() => this.enhancePhotoManagerDuplicateReview(groups), 0);
            this.openPhotoManagerReviewDialog('重複画像の確認', body);
        }

        selectPhotoManagerDuplicateGroup(index = 0) {
            const group = this._photoManagerDuplicateReviewGroups?.[Number(index)];
            if (!group) return;
            const selected = this.ensurePhotoManagerSelectionStore();
            group.items.forEach(item => selected.add(item.id));
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`${group.items.length}件の重複グループを選択しました。`);
        }

        executePhotoManagerDuplicateCleanup() {
            const targets = this.getPhotoManagerDuplicateDeleteTargets();
            if (!targets.length) return this.showPhotoManagerNotice('削除できる重複取込画像はありません。');
            const names = this.ensurePhotoManagerData();
            const overlays = this.getPhotoManagerOverlays();
            targets.sort((a, b) => (b.deleteIndex || 0) - (a.deleteIndex || 0)).forEach(item => {
                this.movePhotoManagerItemToTrash(item, 'duplicate');
                item.deletePhoto?.();
                delete names[item.id];
                delete overlays[item.id];
                this.ensurePhotoManagerSelectionStore().delete(item.id);
            });
            store.save();
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`${targets.length}件の重複取込画像を削除しました。`);
        }

        getPhotoManagerSourceLabel(item = {}) {
            const labels = {
                library: '取込画像',
                machine: '機械',
                part: '部品',
                history: 'メンテ履歴',
                guide: '手順書',
                shift: '連絡帳'
            };
            return labels[item.source] || item.sourceLabel || item.source || '画像';
        }

        getPhotoManagerDuplicatePageKeepChoice(id = '') {
            if (!this._photoManagerDuplicatePageKeepChoices) this._photoManagerDuplicatePageKeepChoices = {};
            return this._photoManagerDuplicatePageKeepChoices[id] !== false;
        }

        setPhotoManagerDuplicatePageKeepChoice(id = '', keep = true) {
            if (!this._photoManagerDuplicatePageKeepChoices) this._photoManagerDuplicatePageKeepChoices = {};
            this._photoManagerDuplicatePageKeepChoices[id] = !!keep;
            this.openPhotoManagerDuplicateReview();
        }

        getPhotoManagerDuplicatePageDeleteTargets(groups = this.getPhotoManagerDuplicateGroups()) {
            const targets = [];
            const seen = new Set();
            (groups || []).forEach(group => {
                (group.items || []).forEach(item => {
                    if (item.source === 'library' || seen.has(item.id)) return;
                    if (this.getPhotoManagerDuplicatePageKeepChoice(item.id)) return;
                    seen.add(item.id);
                    targets.push(item);
                });
            });
            return targets;
        }

        openPhotoManagerDuplicateReview() {
            const groups = this.getPhotoManagerDuplicateGroups();
            if (!groups.length) return this.showPhotoManagerNotice('重複画像は見つかりませんでした。');
            const candidateTargets = this.getPhotoManagerDuplicateDeleteTargets(groups, { ignoreChoices: true });
            const libraryTargets = this.getPhotoManagerDuplicateDeleteTargets(groups);
            const pageTargets = this.getPhotoManagerDuplicatePageDeleteTargets(groups);
            const totalTargets = libraryTargets.length + pageTargets.length;
            const body = `
                <div class="photo-manager-review-summary danger">
                    <b>${groups.length}組</b>
                    <span>取込画像と、連絡帳など個別ページ側の写真を別々に残す/消すできます。ページ側写真は初期状態では残します。</span>
                </div>
                <div class="photo-manager-review-list">
                    ${groups.map((group, groupIndex) => {
                        const title = this.getPhotoManagerName(group.items[0]) || group.items[0].defaultName || group.items[0].title || '画像';
                        const deleteCandidates = candidateTargets.filter(item => item.src === group.src);
                        const pageItems = group.items.filter(item => item.source !== 'library');
                        return `
                            <article class="photo-manager-review-item">
                                <img src="${group.src}" alt="${this.escapeHtml(title)}">
                                <div>
                                    <b>${this.escapeHtml(title)}</b>
                                    <span>${group.items.length}件 / 取込 ${group.libraryItems.length}件 / 個別ページ ${pageItems.length}件</span>
                                    <small>${group.items.map(item => this.escapeHtml(this.getPhotoManagerSourceLabel(item))).join(' / ')}</small>
                                    ${deleteCandidates.length ? `
                                        <div class="photo-manager-duplicate-delete-choices">
                                            ${deleteCandidates.map(item => {
                                                const checked = this.getPhotoManagerDuplicateDeleteChoice(item.id);
                                                const usages = this.getPhotoManagerDuplicateUsageItems(item, groups);
                                                const recommendation = this.getPhotoManagerDuplicateRecommendation(item, usages);
                                                return `
                                                    <div class="photo-manager-duplicate-delete-choice ${checked ? 'delete' : 'keep'}">
                                                        <div>
                                                            <b>写真管理の取込画像</b>
                                                            ${recommendation ? `<em>${this.escapeHtml(recommendation)}</em>` : ''}
                                                            <span>${checked ? 'この取込画像は削除します。ゴミ箱から復元できます。' : 'この取込画像は残します。'}</span>
                                                        </div>
                                                        <div class="photo-manager-duplicate-choice-buttons">
                                                            <button type="button" class="${checked ? 'active' : ''}" onclick="app.setPhotoManagerDuplicateDeleteChoice('${this.escapeJs(item.id)}', true)">〇</button>
                                                            <button type="button" class="${!checked ? 'active' : ''}" onclick="app.setPhotoManagerDuplicateDeleteChoice('${this.escapeJs(item.id)}', false)">×</button>
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    ` : ''}
                                    ${pageItems.length ? `
                                        <div class="photo-manager-duplicate-page-choices">
                                            <b>個別ページ側の写真</b>
                                            <small>連絡帳・機械・部品・履歴・手順書側の写真です。消すを選ぶとそのページから削除され、写真管理のゴミ箱では復元できません。</small>
                                            ${pageItems.map(item => {
                                                const keep = this.getPhotoManagerDuplicatePageKeepChoice(item.id);
                                                const label = this.getPhotoManagerSourceLabel(item);
                                                const itemTitle = this.getPhotoManagerName(item) || item.defaultName || item.title || label;
                                                return `
                                                    <div class="photo-manager-duplicate-page-choice ${keep ? 'keep' : 'delete'}">
                                                        <button type="button" class="photo-manager-duplicate-page-open" onclick="app.openPhotoManagerUsageSource('${this.escapeJs(item.id)}')" title="${this.escapeHtml(item.title || '')}">
                                                            ${this.escapeHtml(label)}: ${this.escapeHtml(String(itemTitle).slice(0, 36))}
                                                        </button>
                                                        <div class="photo-manager-duplicate-choice-buttons wide">
                                                            <button type="button" class="${keep ? 'active' : ''}" onclick="app.setPhotoManagerDuplicatePageKeepChoice('${this.escapeJs(item.id)}', true)">残す</button>
                                                            <button type="button" class="${!keep ? 'active' : ''}" onclick="app.setPhotoManagerDuplicatePageKeepChoice('${this.escapeJs(item.id)}', false)">消す</button>
                                                        </div>
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                                <button type="button" class="secondary-btn" onclick="app.selectPhotoManagerDuplicateGroup(${groupIndex})">この組を選択</button>
                            </article>
                        `;
                    }).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <span class="photo-manager-review-restore-note"><i class="fa-solid fa-trash-restore"></i> 取込画像はゴミ箱から復元可。個別ページ側は復元対象外です。</span>
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                    <button type="button" class="danger-btn" ${totalTargets ? '' : 'disabled'} onclick="app.executePhotoManagerDuplicateCleanup()">選択した画像を削除 ${totalTargets ? `(${totalTargets})` : ''}</button>
                </div>
            `;
            this._photoManagerDuplicateReviewGroups = groups;
            setTimeout(() => this.enhancePhotoManagerDuplicateReview(groups), 0);
            this.openPhotoManagerReviewDialog('重複画像の確認', body);
        }

        executePhotoManagerDuplicateCleanup() {
            const groups = this.getPhotoManagerDuplicateGroups();
            const libraryTargets = this.getPhotoManagerDuplicateDeleteTargets(groups);
            const pageTargets = this.getPhotoManagerDuplicatePageDeleteTargets(groups);
            if (!libraryTargets.length && !pageTargets.length) return this.showPhotoManagerNotice('削除する画像が選択されていません。');
            const names = this.ensurePhotoManagerData();
            const overlays = this.getPhotoManagerOverlays();
            libraryTargets.sort((a, b) => (b.deleteIndex || 0) - (a.deleteIndex || 0)).forEach(item => {
                this.movePhotoManagerItemToTrash(item, 'duplicate');
                item.deletePhoto?.();
                delete names[item.id];
                delete overlays[item.id];
                this.ensurePhotoManagerSelectionStore().delete(item.id);
            });
            pageTargets.sort((a, b) => (b.deleteIndex || 0) - (a.deleteIndex || 0)).forEach(item => {
                item.deletePhoto?.();
                delete overlays[item.id];
                this.ensurePhotoManagerSelectionStore().delete(item.id);
            });
            store.save();
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
            const pageText = pageTargets.length ? ` 個別ページ側${pageTargets.length}件も削除しました。` : '';
            this.showPhotoManagerNotice(`取込画像${libraryTargets.length}件を削除しました。${pageText}`);
        }

        openPhotoManagerDeleteReview(kind = 'unused', items = []) {
            const safeItems = (items || []).filter(item => item?.src);
            if (!safeItems.length) return;
            const body = `
                <div class="photo-manager-review-summary danger">
                    <b>${safeItems.length}件</b>
                    <span>削除予定の画像です。内容を確認してから実行してください。</span>
                </div>
                <div class="photo-manager-review-list">
                    ${safeItems.map(item => {
                        const title = this.getPhotoManagerName(item) || item.defaultName || item.title || '画像';
                        return `
                            <article class="photo-manager-review-item">
                                <img src="${item.src}" alt="${this.escapeHtml(title)}">
                                <div>
                                    <b>${this.escapeHtml(title)}</b>
                                    <span>${this.escapeHtml(item.sourceLabel || '')}${item.date ? ` / ${this.escapeHtml(item.date)}` : ''}</span>
                                    <small>${this.escapeHtml(item.title || '')}</small>
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">キャンセル</button>
                    <button type="button" class="danger-btn" onclick="app.executeDeleteUnusedPhotoManagerLibraryItems()">この内容で削除</button>
                </div>
            `;
            this.openPhotoManagerReviewDialog(kind === 'unused' ? '未使用画像の削除確認' : '削除確認', body);
        }

        openPhotoManagerReviewDialog(title = '確認', body = '') {
            document.getElementById('photo-manager-review-overlay')?.remove();
            const overlay = document.createElement('div');
            overlay.id = 'photo-manager-review-overlay';
            overlay.className = 'photo-manager-review-overlay';
            overlay.innerHTML = `
                <div class="photo-manager-review-card">
                    <div class="photo-manager-review-head">
                        <b>${this.escapeHtml(title)}</b>
                        <button type="button" onclick="app.closePhotoManagerReviewDialog()" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="photo-manager-review-body">${body}</div>
                </div>
            `;
            overlay.addEventListener('click', event => {
                if (event.target === overlay) this.closePhotoManagerReviewDialog();
            });
            document.body.appendChild(overlay);
        }

        closePhotoManagerReviewDialog() {
            document.getElementById('photo-manager-review-overlay')?.remove();
        }

        deleteSelectedPhotoManagerItems() {
            const ids = this.getSelectedPhotoManagerIds();
            if (!ids.length) return alert('削除する写真を選択してください。');
            if (!confirm(`選択した${ids.length}枚の写真を元データから完全削除します。よろしいですか？`)) return;
            const names = this.ensurePhotoManagerData();
            const overlays = this.getPhotoManagerOverlays();
            const selectedItems = this.collectPhotoManagerItems()
                .filter(item => ids.includes(item.id))
                .sort((a, b) => (b.deleteIndex || 0) - (a.deleteIndex || 0));
            selectedItems.forEach(item => {
                if (!item) return;
                this.movePhotoManagerItemToTrash(item, 'selected');
                item.deletePhoto?.();
                delete names[item.id];
                delete overlays[item.id];
                this.ensurePhotoManagerSelectionStore().delete(item.id);
            });
            store.save();
            this.renderPhotoManager();
        }

        deletePhotoManagerItem(id) {
            const item = this.findPhotoManagerItem(id);
            if (!item) return alert('写真が見つかりませんでした。');
            const name = this.getPhotoManagerName(item) || item.defaultName || '写真';
            if (!confirm(`「${name}」を削除します。よろしいですか？`)) return;
            const names = this.ensurePhotoManagerData();
            const overlays = this.getPhotoManagerOverlays();
            this.movePhotoManagerItemToTrash(item, 'single');
            item.deletePhoto?.();
            delete names[item.id];
            delete overlays[item.id];
            store.save();
            this.renderPhotoManager();
        }

        downloadPhotoManagerItem(id) {
            const item = this.findPhotoManagerItem(id);
            if (!item) return alert('写真が見つかりませんでした。');
            this.downloadPhotoManagerImage(item);
        }

        loadPhotoManagerImage(src = '') {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('画像を読み込めませんでした'));
                img.src = src;
            });
        }

        async createTransparentPhotoManagerSource(src = '', options = {}) {
            if (!/^data:image\//i.test(src || '')) throw new Error('画像データがありません');
            const img = await this.loadPhotoManagerImage(src);
            const naturalW = img.naturalWidth || img.width || 1;
            const naturalH = img.naturalHeight || img.height || 1;
            const maxSide = 1800;
            const scale = Math.min(1, maxSide / Math.max(naturalW, naturalH));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(naturalW * scale));
            canvas.height = Math.max(1, Math.round(naturalH * scale));
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const result = this.makeConnectedBackgroundTransparentOnCanvas(canvas, ctx, options);
            return {
                src: canvas.toDataURL('image/png'),
                changed: result.changed,
                total: canvas.width * canvas.height
            };
        }

        async createTransparentPhotoManagerImage(id) {
            const item = this.findPhotoManagerItem(id);
            if (!item?.src) return alert('写真が見つかりませんでした。');
            try {
                const alreadyTransparent = typeof this.imageHasTransparentPixels === 'function'
                    ? await this.imageHasTransparentPixels(item.src)
                    : false;
                const result = await this.createTransparentPhotoManagerSource(item.src);
                if (!result.changed && alreadyTransparent) {
                    this.showPhotoManagerNotice('この画像はすでに透過画像です。');
                    return;
                }
                if (!result.changed) {
                    this.showPhotoManagerNotice('透明化できそうな背景色が見つかりませんでした。');
                    return;
                }
                const baseName = this.getPhotoManagerName(item) || item.defaultName || item.title || '画像';
                const added = this.addPhotoManagerLibraryImage(result.src, `${baseName} 透過`);
                if (!added) return;
                if (!this._imageSourceTransparencyCache) this._imageSourceTransparencyCache = new Map();
                this._imageSourceTransparencyCache.set(result.src, true);
                store.save();
                const sourceSelect = document.getElementById('photo-manager-source');
                if (sourceSelect && sourceSelect.value !== 'library') sourceSelect.value = 'library';
                this.renderPhotoManager();
                this.showPhotoManagerNotice('透過画像を写真管理へ追加しました。');
            } catch (error) {
                console.error(error);
                this.showPhotoManagerNotice('透過画像の作成に失敗しました。');
            }
        }

        async createTransparentSelectedPhotoManagerImages() {
            const ids = this.getSelectedPhotoManagerIds();
            if (!ids.length) {
                this.showPhotoManagerNotice('透過画像を作る写真を選択してください。');
                return;
            }
            const items = this.collectPhotoManagerItems().filter(item => ids.includes(item.id));
            let created = 0;
            let skipped = 0;
            for (const item of items) {
                try {
                    const alreadyTransparent = typeof this.imageHasTransparentPixels === 'function'
                        ? await this.imageHasTransparentPixels(item.src)
                        : false;
                    const result = await this.createTransparentPhotoManagerSource(item.src);
                    if (!result.changed || alreadyTransparent) {
                        skipped += 1;
                        continue;
                    }
                    const baseName = this.getPhotoManagerName(item) || item.defaultName || item.title || '画像';
                    if (this.addPhotoManagerLibraryImage(result.src, `${baseName} 透過`)) {
                        if (!this._imageSourceTransparencyCache) this._imageSourceTransparencyCache = new Map();
                        this._imageSourceTransparencyCache.set(result.src, true);
                        created += 1;
                    }
                } catch (error) {
                    console.error(error);
                    skipped += 1;
                }
            }
            if (created) {
                store.save();
                const sourceSelect = document.getElementById('photo-manager-source');
                if (sourceSelect && sourceSelect.value !== 'library') sourceSelect.value = 'library';
                this.renderPhotoManager();
            }
            this.showPhotoManagerNotice(created
                ? `透過画像を${created}枚追加しました。${skipped ? `（${skipped}枚は作成対象外）` : ''}`
                : '透過画像を作れそうな写真がありませんでした。');
        }

        getPhotoManagerImageExtension(src = '') {
            const match = String(src || '').match(/^data:image\/([a-zA-Z0-9.+-]+);/);
            if (!match) return 'jpg';
            const type = match[1].toLowerCase();
            if (type === 'jpeg') return 'jpg';
            if (type === 'svg+xml') return 'svg';
            return type.replace(/[^a-z0-9]/g, '') || 'jpg';
        }

        getPhotoManagerSafeFileName(item = {}, index = 0, src = '') {
            const base = this.getPhotoManagerName(item) || item.defaultName || item.sourceLabel || 'photo';
            const prefix = index > 0 ? `${String(index).padStart(2, '0')}_` : '';
            const clean = String(base).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 80) || 'photo';
            return `${prefix}${clean}.${this.getPhotoManagerImageExtension(src || item.src)}`;
        }

        getPhotoManagerExportMode() {
            return document.getElementById('photo-manager-export-mode')?.value || 'withMarks';
        }

        ensureImageSourceChoiceListener() {
            if (this._imageSourceChoiceListener) return;
            this._imageSourceChoiceListener = (event) => {
                const label = event.target?.closest?.('label[for]');
                const input = event.target?.matches?.('input[type="file"][accept*="image"]')
                    ? event.target
                    : (label ? document.getElementById(label.getAttribute('for')) : null);
                if (!input || !input.matches?.('input[type="file"][accept*="image"]')) return;
                if (input._imageSourceDirectOnce) {
                    input._imageSourceDirectOnce = false;
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                this.openImageSourceChoice(input);
            };
            document.addEventListener('click', this._imageSourceChoiceListener, true);
            this._imageSourceChoiceChangeListener = (event) => {
                const input = event.target;
                if (!input?._imageSourceDirectReviewOnce || !input.matches?.('input[type="file"][accept*="image"]')) return;
                input._imageSourceDirectReviewOnce = false;
                event.preventDefault();
                event.stopImmediatePropagation();
                this.importImageSourceDirectFilesForReview(input, input.files);
            };
            document.addEventListener('change', this._imageSourceChoiceChangeListener, true);
        }

        getImageSourceChoiceItems(query = '') {
            const terms = this.getSearchTerms(String(query || '').trim());
            const recent = this.getImageSourceChoiceRecentSrcRank();
            return this.collectPhotoManagerItems().filter(item => {
                if (!terms.length) return true;
                const text = `${item.title || ''} ${item.displayName || ''} ${item.defaultName || ''} ${item.caption || ''} ${item.sourceLabel || ''} ${item.date || ''}`;
                return this.matchesSearchTerms(text, terms);
            }).filter(item => {
                if (!this._imageSourceTransparentOnly) return true;
                const cached = this._imageSourceTransparencyCache?.get?.(item.src);
                return cached === true || (cached === undefined && this.canImageSourceHaveAlpha(item.src));
            }).sort((a, b) => {
                const ar = recent.get(a.src) ?? 9999;
                const br = recent.get(b.src) ?? 9999;
                return ar - br;
            }).slice(0, 120);
        }

        openImageSourceChoice(input) {
            if (!input) return;
            document.getElementById('image-source-choice-overlay')?.remove();
            const multiple = !!input.multiple;
            const overlay = document.createElement('div');
            overlay.id = 'image-source-choice-overlay';
            overlay.className = 'image-source-choice-overlay';
            overlay.innerHTML = `
                <div class="image-source-choice-card">
                    <div class="image-source-choice-head">
                        <div>
                            <b><i class="fa-solid fa-image"></i> 画像を選択</b>
                            <span>直接ファイルを読むか、写真管理から選べます</span>
                        </div>
                        <button type="button" onclick="app.closeImageSourceChoice()" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="image-source-choice-actions">
                        <button type="button" class="primary-btn" onclick="app.chooseImageSourceDirectFile()"><i class="fa-solid fa-file-import"></i> 直接ファイル</button>
                        <button type="button" class="image-source-choice-filter clipboard" onclick="app.importImageSourceChoiceFromClipboard()" title="クリップボードの画像を写真管理へ登録して選択"><i class="fa-solid fa-clipboard"></i> クリップボードから取込</button>
                        <button type="button" class="image-source-choice-filter" id="image-source-choice-transparent-filter" onclick="app.toggleImageSourceTransparentFilter()" title="透過画像だけ表示"><i class="fa-solid fa-layer-group"></i> 透過のみ</button>
                        <label class="image-source-choice-search">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input type="search" id="image-source-choice-query" placeholder="タイトル・名前で検索" oninput="app.renderImageSourceChoiceList(this.value)">
                        </label>
                    </div>
                    <div class="image-source-choice-main">
                        <div class="image-source-choice-list" id="image-source-choice-list"></div>
                        <aside class="image-source-choice-preview" id="image-source-choice-preview">
                            <div class="image-source-choice-preview-stage">
                                <i class="fa-regular fa-image"></i>
                            </div>
                            <b>プレビュー</b>
                            <span>画像に触れると大きく確認できます</span>
                        </aside>
                    </div>
                    <div class="image-source-choice-foot">
                        <span>${multiple ? '複数選択できます' : '1枚選択できます'}</span>
                        <button type="button" class="primary-btn" onclick="app.applySelectedImageSourceChoice()"><i class="fa-solid fa-check"></i> 選択を使用</button>
                    </div>
                </div>
            `;
            overlay.addEventListener('click', event => {
                if (event.target === overlay) this.closeImageSourceChoice();
            });
            document.body.appendChild(overlay);
            this._imageSourceChoiceInput = input;
            this._imageSourceTransparentOnly = false;
            this.updateImageSourceTransparentFilterButton();
            this.renderImageSourceChoiceList('');
            setTimeout(() => document.getElementById('image-source-choice-query')?.focus(), 0);
        }

        closeImageSourceChoice() {
            document.getElementById('image-source-choice-overlay')?.remove();
            this._imageSourceChoiceInput = null;
        }

        chooseImageSourceDirectFile() {
            const input = this._imageSourceChoiceInput;
            this.closeImageSourceChoice();
            if (!input) return;
            input._imageSourceDirectOnce = true;
            input._imageSourceDirectReviewOnce = true;
            input.click();
        }

        async importImageSourceDirectFilesForReview(input, files) {
            const selectedFiles = Array.from(files || []).filter(file => /^image\//i.test(file.type || ''));
            input.value = '';
            if (!input || !selectedFiles.length) return;
            try {
                const imported = [];
                for (const file of selectedFiles) {
                    const src = await this.readPhotoManagerFileAsDataUrl(file);
                    const added = this.addPhotoManagerLibraryImage(src, file.name || '直接ファイル画像');
                    if (added) imported.push(added);
                }
                if (!imported.length) return;
                store.save();
                if (document.getElementById('photo-manager-list')) this.renderPhotoManager?.();
                this.openImageSourceChoice(input);
                requestAnimationFrame(() => {
                    imported.forEach(item => {
                        const safeId = window.CSS?.escape ? CSS.escape(item.id) : String(item.id).replace(/"/g, '\\"');
                        const choice = document.querySelector(`#image-source-choice-list .image-source-choice-item[data-image-choice-id="${safeId}"] input`);
                        if (choice) choice.checked = true;
                    });
                    this.updateImageSourceChoicePreview(imported[0]);
                    this.openImageSourceChoiceTransparencyPreview(imported[0].id);
                });
                this.showPhotoManagerNotice(`${imported.length}枚の直接ファイル画像を取り込みました`);
            } catch (error) {
                console.error(error);
                this.showPhotoManagerNotice('直接ファイル画像を取り込めませんでした');
            }
        }

        async importImageSourceChoiceFromClipboard() {
            if (!navigator.clipboard?.read) {
                this.showPhotoManagerNotice('この画面ではCtrl+Vでも画像を取り込めます');
                return;
            }
            try {
                const items = await navigator.clipboard.read();
                const imported = [];
                for (const item of items) {
                    const type = item.types?.find(value => /^image\//i.test(value));
                    if (!type) continue;
                    const blob = await item.getType(type);
                    const src = await this.readPhotoManagerFileAsDataUrl(blob);
                    const added = this.addPhotoManagerLibraryImage(src, 'クリップボード画像');
                    if (added) imported.push(added);
                }
                if (!imported.length) {
                    this.showPhotoManagerNotice('クリップボードに画像がありません');
                    return;
                }
                store.save();
                if (document.getElementById('photo-manager-list')) this.renderPhotoManager?.();
                this._imageSourceTransparentOnly = false;
                this.updateImageSourceTransparentFilterButton();
                const query = document.getElementById('image-source-choice-query');
                if (query) query.value = '';
                this.renderImageSourceChoiceList('');
                requestAnimationFrame(() => {
                    imported.forEach(item => {
                        const safeId = window.CSS?.escape ? CSS.escape(item.id) : String(item.id).replace(/"/g, '\\"');
                        const input = document.querySelector(`#image-source-choice-list .image-source-choice-item[data-image-choice-id="${safeId}"] input`);
                        if (input) input.checked = true;
                    });
                    this.updateImageSourceChoicePreview(imported[0]);
                });
                this.showPhotoManagerNotice(`${imported.length}枚のクリップボード画像を取り込みました`);
            } catch (error) {
                console.error(error);
                this.showPhotoManagerNotice('クリップボード画像を取り込めませんでした。Ctrl+Vも試せます。');
            }
        }

        getImageSourceChoiceRecentSrcRank() {
            const ordered = [];
            this.ensurePhotoManagerData();
            const savedRecent = store.activeData.imageSourceRecentUsed || [];
            const sessionRecent = Array.isArray(this._imageSourceRecentUsed) ? this._imageSourceRecentUsed : savedRecent;
            sessionRecent.forEach(item => {
                if (item?.src && !ordered.includes(item.src)) ordered.push(item.src);
            });
            if (typeof this.getShiftPhotoCompareRecentImageStamps === 'function') {
                this.getShiftPhotoCompareRecentImageStamps().forEach(item => {
                    if (item?.src && !ordered.includes(item.src)) ordered.push(item.src);
                });
            }
            return new Map(ordered.map((src, index) => [src, index]));
        }

        rememberImageSourceChoiceUse(items = []) {
            this.ensurePhotoManagerData();
            const savedRecent = store.activeData.imageSourceRecentUsed || [];
            let next = Array.isArray(this._imageSourceRecentUsed) ? [...this._imageSourceRecentUsed] : [...savedRecent];
            (items || []).filter(item => item?.src).forEach(item => {
                const title = this.getPhotoManagerName(item) || item.defaultName || item.title || '画像';
                next = next.filter(entry => entry.src !== item.src);
                next.unshift({ src: item.src, title, usedAt: Date.now() });
            });
            this._imageSourceRecentUsed = next.slice(0, 24);
            store.activeData.imageSourceRecentUsed = this._imageSourceRecentUsed;
            store.save?.();
        }

        toggleImageSourceTransparentFilter() {
            this._imageSourceTransparentOnly = !this._imageSourceTransparentOnly;
            this.updateImageSourceTransparentFilterButton();
            this.renderImageSourceChoiceList(document.getElementById('image-source-choice-query')?.value || '');
        }

        updateImageSourceTransparentFilterButton() {
            const button = document.getElementById('image-source-choice-transparent-filter');
            if (!button) return;
            button.classList.toggle('active', !!this._imageSourceTransparentOnly);
        }

        renderImageSourceChoiceList(query = '') {
            const list = document.getElementById('image-source-choice-list');
            if (!list) return;
            const input = this._imageSourceChoiceInput;
            const multiple = !!input?.multiple;
            const items = this.getImageSourceChoiceItems(query);
            if (!items.length) {
                list.innerHTML = '<div class="image-source-choice-empty">写真管理に該当する画像がありません</div>';
                return;
            }
            list.innerHTML = items.map(item => {
                const title = this.getPhotoManagerName(item) || item.defaultName || item.title || '写真';
                const sub = [item.sourceLabel, item.date, item.title].filter(Boolean).join(' / ');
                const canHaveAlpha = this.canImageSourceHaveAlpha(item.src);
                return `
                    <label class="image-source-choice-item${canHaveAlpha ? ' may-transparent' : ''}" data-image-choice-id="${this.escapeHtml(item.id)}">
                        <input type="${multiple ? 'checkbox' : 'radio'}" name="image-source-choice-item" value="${this.escapeHtml(item.id)}">
                        <span class="image-source-choice-thumb">
                            <img src="${item.src}" alt="${this.escapeHtml(title)}">
                            ${canHaveAlpha ? `<span class="image-source-choice-alpha-badge" role="button" tabindex="0" onpointerdown="event.preventDefault(); event.stopPropagation();" onclick="event.preventDefault(); event.stopPropagation(); app.openImageSourceChoiceTransparencyPreview('${this.escapeJs(item.id)}')"><i class="fa-solid fa-layer-group"></i> 透過候補</span>` : ''}
                        </span>
                        <span>
                            <b>${this.escapeHtml(title)}</b>
                            <small>${this.escapeHtml(sub)}</small>
                        </span>
                    </label>
                `;
            }).join('');
            this.updateImageSourceChoiceTransparencyBadges(items);
            this.enhanceImageSourceChoiceList(items);
        }

        enhanceImageSourceChoiceList(items = []) {
            const recent = this.getImageSourceChoiceRecentSrcRank();
            (items || []).forEach(item => {
                const safeId = window.CSS?.escape ? CSS.escape(item.id) : String(item.id).replace(/"/g, '\\"');
                const card = document.querySelector(`.image-source-choice-item[data-image-choice-id="${safeId}"]`);
                if (!card) return;
                card.addEventListener('mouseenter', () => this.updateImageSourceChoicePreview(item));
                card.addEventListener('focusin', () => this.updateImageSourceChoicePreview(item));
                if (recent.has(item.src)) {
                    card.classList.add('is-recent');
                    const thumb = card.querySelector('.image-source-choice-thumb');
                    if (thumb && !thumb.querySelector('.image-source-choice-recent-badge')) {
                        thumb.insertAdjacentHTML('beforeend', '<em class="image-source-choice-recent-badge"><i class="fa-solid fa-clock-rotate-left"></i> 最近</em>');
                    }
                }
            });
            this.updateImageSourceChoicePreview(items[0] || null);
        }

        updateImageSourceChoicePreview(item = null) {
            const preview = document.getElementById('image-source-choice-preview');
            if (!preview) return;
            if (!item?.src) {
                preview.innerHTML = `
                    <div class="image-source-choice-preview-stage"><i class="fa-regular fa-image"></i></div>
                    <b>プレビュー</b>
                    <span>画像に触れると大きく確認できます</span>
                `;
                return;
            }
            const title = this.getPhotoManagerName(item) || item.defaultName || item.title || '画像';
            const sub = [item.sourceLabel, item.date, item.title].filter(Boolean).join(' / ');
            const canHaveAlpha = this.canImageSourceHaveAlpha(item.src);
            preview.innerHTML = `
                <div class="image-source-choice-preview-stage">
                    <img src="${item.src}" alt="${this.escapeHtml(title)}">
                    ${canHaveAlpha ? `<button type="button" onclick="event.preventDefault(); event.stopPropagation(); app.openImageSourceChoiceTransparencyPreview('${this.escapeJs(item.id)}')"><i class="fa-solid fa-layer-group"></i> 透過候補</button>` : ''}
                </div>
                <b>${this.escapeHtml(title)}</b>
                <span>${this.escapeHtml(sub || '写真管理')}</span>
            `;
        }

        async openImageSourceChoiceTransparencyPreview(id = '') {
            const item = this.collectPhotoManagerItems().find(entry => entry.id === id);
            if (!item?.src) return this.showPhotoManagerNotice('透過チェックする画像が見つかりません');
            if (typeof this.openShiftPhotoCompareBaseImageTransparencyPreview !== 'function'
                || typeof this.createTransparentPhotoManagerSource !== 'function') {
                return this.showPhotoManagerNotice('透過チェック画面を開けませんでした');
            }
            try {
                const alreadyTransparent = typeof this.imageHasTransparentPixels === 'function'
                    ? await this.imageHasTransparentPixels(item.src)
                    : false;
                if (alreadyTransparent) {
                    this.openShiftPhotoCompareBaseImageTransparencyPreview(item.src, item.src, {
                        name: this.getPhotoManagerName(item) || item.defaultName || item.title || '画像',
                        changed: 0,
                        total: 0,
                        alreadyTransparent: true,
                        sizePreset: item.sizePreset || null,
                        imageFit: item.imageFit === 'fill' ? 'fill' : ''
                    });
                    return;
                }
                const result = await this.createTransparentPhotoManagerSource(item.src);
                this.openShiftPhotoCompareBaseImageTransparencyPreview(item.src, result.src || item.src, {
                    name: this.getPhotoManagerName(item) || item.defaultName || item.title || '画像',
                    changed: result.changed || 0,
                    total: result.total || 0,
                    sizePreset: item.sizePreset || null,
                    imageFit: item.imageFit === 'fill' ? 'fill' : ''
                });
            } catch (error) {
                console.error(error);
                this.showPhotoManagerNotice('透過チェックに失敗しました');
            }
        }

        canImageSourceHaveAlpha(src = '') {
            return /^data:image\/(png|webp|gif|svg\+xml);/i.test(String(src || ''));
        }

        imageHasTransparentPixels(src = '') {
            return new Promise(resolve => {
                if (!this.canImageSourceHaveAlpha(src)) {
                    resolve(false);
                    return;
                }
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        const maxSide = 80;
                        const naturalW = img.naturalWidth || img.width || 1;
                        const naturalH = img.naturalHeight || img.height || 1;
                        const scale = Math.min(1, maxSide / Math.max(naturalW, naturalH));
                        canvas.width = Math.max(1, Math.round(naturalW * scale));
                        canvas.height = Math.max(1, Math.round(naturalH * scale));
                        const ctx = canvas.getContext('2d', { willReadFrequently: true });
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                        for (let i = 3; i < data.length; i += 4) {
                            if (data[i] < 250) {
                                resolve(true);
                                return;
                            }
                        }
                        resolve(false);
                    } catch {
                        resolve(this.canImageSourceHaveAlpha(src));
                    }
                };
                img.onerror = () => resolve(false);
                img.src = src;
            });
        }

        updateImageSourceChoiceTransparencyBadges(items = []) {
            if (!this._imageSourceTransparencyCache) this._imageSourceTransparencyCache = new Map();
            const visibleIds = new Set((items || []).map(item => item.id));
            (items || []).filter(item => this.canImageSourceHaveAlpha(item.src)).slice(0, 120).forEach(async item => {
                const isTransparent = await this.imageHasTransparentPixels(item.src);
                this._imageSourceTransparencyCache.set(item.src, !!isTransparent);
                if (!isTransparent || !visibleIds.has(item.id)) return;
                const safeId = window.CSS?.escape ? CSS.escape(item.id) : String(item.id).replace(/"/g, '\\"');
                const card = document.querySelector(`.image-source-choice-item[data-image-choice-id="${safeId}"]`);
                if (!card) return;
                card.classList.add('is-transparent');
                const badge = card.querySelector('.image-source-choice-alpha-badge');
                if (badge) badge.innerHTML = '<i class="fa-solid fa-layer-group"></i> 透過';
            });
        }

        updatePhotoManagerTransparencyBadges(items = []) {
            if (!this._imageSourceTransparencyCache) this._imageSourceTransparencyCache = new Map();
            const visibleIds = new Set((items || []).map(item => item.id));
            (items || []).filter(item => this.canImageSourceHaveAlpha(item.src)).slice(0, 120).forEach(async item => {
                const isTransparent = await this.imageHasTransparentPixels(item.src);
                this._imageSourceTransparencyCache.set(item.src, !!isTransparent);
                if (!visibleIds.has(item.id)) return;
                const safeId = window.CSS?.escape ? CSS.escape(item.id) : String(item.id).replace(/"/g, '\\"');
                const card = document.querySelector(`.photo-manager-card[data-photo-id="${safeId}"]`);
                const badge = card?.querySelector('.photo-manager-alpha-badge');
                if (!badge) return;
                badge.classList.toggle('transparent', !!isTransparent);
                badge.classList.toggle('candidate', !isTransparent);
                badge.innerHTML = isTransparent
                    ? '<i class="fa-solid fa-layer-group"></i> 透過'
                    : '<i class="fa-solid fa-layer-group"></i> 透過候補';
            });
        }

        applySelectedImageSourceChoice() {
            const input = this._imageSourceChoiceInput;
            const ids = Array.from(document.querySelectorAll('#image-source-choice-list input:checked')).map(item => item.value);
            if (!input || !ids.length) return;
            const items = this.collectPhotoManagerItems().filter(item => ids.includes(item.id));
            this.rememberImageSourceChoiceUse(items);
            this.applyPhotoManagerImagesToInput(input, items);
            this.closeImageSourceChoice();
        }

        applyPhotoManagerImagesToInput(input, items = []) {
            const selected = (items || []).filter(item => item?.src);
            if (!input || !selected.length) return;
            const id = input.id || '';
            if (id === 'machine-photo-quick-input' && (input._quickPhotoTarget || input._machinePhotoTargetId)) {
                if (input._quickPhotoTarget && typeof this.applyQuickPhotoFromSource === 'function') {
                    this.applyQuickPhotoFromSource(input._quickPhotoTarget, selected[0].src);
                } else {
                    this.applyMachinePhotoFromSource?.(input._machinePhotoTargetId, selected[0].src);
                }
                return;
            }
            if (id === 's-photos' || id === 'e-photos') {
                const preview = document.getElementById(id === 's-photos' ? 's-photo-previews' : 'e-photo-previews');
                if (!this._tempPhotos) this._tempPhotos = [];
                selected.forEach(item => {
                    this._tempPhotos.push(item.src);
                    preview?.appendChild(this.createPhotoPreviewElement(
                        item.src,
                        (removedSrc) => { this._tempPhotos = this._tempPhotos.filter(p => p !== removedSrc); },
                        (oldSrc, newSrc) => { this._tempPhotos = this._tempPhotos.map(p => p === oldSrc ? newSrc : p); },
                        80
                    ));
                });
                return;
            }
            if (id === 'f-machine-photo' || id === 'pm-photo') {
                const isPart = id === 'pm-photo';
                const hidden = document.getElementById(isPart ? 'pm-photo-base64' : 'f-machine-photo-base64');
                const preview = document.getElementById(isPart ? 'pm-photo-preview' : 'f-machine-photo-preview');
                const src = selected[0].src;
                if (hidden) hidden.value = src;
                if (preview) preview.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:cover;">`;
                input.parentElement?.querySelector('.f-rotate-btn')?.style?.setProperty('display', 'inline-block');
                return;
            }
            if (id === 'g-photos') {
                if (!Array.isArray(this._tempPhotos)) this._tempPhotos = [];
                selected.forEach(item => this._tempPhotos.push({ src: item.src, marks: [], printSize: 72 }));
                this.autoSaveGuideDraftFromModal?.();
                this.renderGuidePhotoPreviews?.();
                return;
            }
            if (id === 'photo-manager-import-input') {
                let count = 0;
                selected.forEach(item => {
                    if (this.addPhotoManagerLibraryImage(item.src, this.getPhotoManagerName(item) || item.defaultName || item.title || '写真管理画像')) count += 1;
                });
                this.finishPhotoManagerImport(count, `${count}枚の写真管理画像を登録しました`);
                return;
            }
            if (id === 'shift-photo-compare-image-stamp-input') {
                const src = selected[0].src;
                this._shiftPhotoCompareImageStampSrc = src;
                const recentPreset = this.getShiftPhotoCompareRecentImageStamps?.().find?.(item => item.src === src)?.sizePreset || null;
                const sizePreset = selected[0].sizePreset || recentPreset;
                if (sizePreset && selected[0].imageFit === 'fill') sizePreset.imageFit = 'fill';
                if (sizePreset) this.applyShiftPhotoCompareRecentImageSizePreset?.({ src, sizePreset });
                this.rememberShiftPhotoCompareImageStamp?.(src, this.getPhotoManagerName(selected[0]) || selected[0].defaultName || selected[0].title || '写真管理');
                if (sizePreset) {
                    const recent = this.getShiftPhotoCompareRecentImageStamps?.() || [];
                    const recentItem = recent.find(entry => entry.src === src);
                    if (recentItem) {
                        recentItem.sizePreset = sizePreset;
                        this.saveShiftPhotoCompareRecentImageStamps?.(recent);
                    }
                }
                this.setShiftPhotoCompareMarkModeDirect?.('image');
                this.updateShiftPhotoCompareSample?.();
                this.showShiftPhotoCompareActionMessage?.('写真管理の画像を読み込みました。写真上をクリックして配置できます。');
                return;
            }
            if (input.classList?.contains('shift-photo-input') && typeof input._shiftPhotoAddSrc === 'function') {
                selected.forEach(item => input._shiftPhotoAddSrc(item.src));
            }
        }

        async getPhotoManagerDownloadSrc(item) {
            if (this.getPhotoManagerExportMode() !== 'withMarks' || !item?.annotated) return item.src;
            return await this.renderPhotoManagerImageWithMarks(item);
        }

        createPhotoManagerMarkElement(mark = {}) {
            const el = document.createElement('div');
            const mode = mark.mode || 'circle';
            el.className = `shift-photo-compare-mark ${mode}`;
            el.dataset.mode = mode;
            el.dataset.size = String(mark.size || 56);
            el.dataset.angle = String(mark.angle || 0);
            el.dataset.stretch = String(mark.stretch || 1);
            el.dataset.stretchY = String(mark.stretchY || 1);
            el.dataset.stroke = String(mark.stroke || 1);
            el.dataset.color = /^#[0-9a-f]{6}$/i.test(mark.color || '') ? mark.color : '#dc2626';
            el.dataset.text = String(mark.text || '');
            el.dataset.imageSrc = /^data:image\//i.test(mark.imageSrc || '') ? mark.imageSrc : '';
            el.dataset.originalImageSrc = /^data:image\//i.test(mark.originalImageSrc || '') ? mark.originalImageSrc : '';
            el.dataset.opacity = String(Math.max(0.1, Math.min(1, Number(mark.opacity) || 1)));
            el.dataset.flipX = mark.flipX === -1 || mark.flipX === '-1' ? '-1' : '1';
            el.dataset.flipY = mark.flipY === -1 || mark.flipY === '-1' ? '-1' : '1';
            el.dataset.font = this.getShiftPhotoCompareSafeFont ? this.getShiftPhotoCompareSafeFont(mark.font || '') : (mark.font || '');
            el.dataset.anchor = mark.anchor === 'left' ? 'left' : 'center';
            el.dataset.pairId = /^[a-z0-9_-]{4,40}$/i.test(mark.pairId || '') ? mark.pairId : '';
            el.dataset.pairRole = ['number', 'text'].includes(mark.pairRole || '') ? mark.pairRole : '';
            el.dataset.outline = mark.outline === false ? '0' : '1';
            el.dataset.points = JSON.stringify(Array.isArray(mark.points) ? mark.points : []);
            el.style.left = `${Number(mark.x) || 0}%`;
            el.style.top = `${Number(mark.y) || 0}%`;
            return el;
        }

        getPhotoManagerVirtualWrapRect(img, mark = {}, item = {}) {
            const naturalW = img.naturalWidth || img.width || 1;
            const naturalH = img.naturalHeight || img.height || 1;
            const savedWrapW = Number(mark.wrapWidth) || 0;
            const savedWrapH = Number(mark.wrapHeight) || 0;
            const wrapW = savedWrapW > 0 ? savedWrapW : (item.source === 'guide' ? naturalW : 1000);
            const wrapH = savedWrapH > 0 ? savedWrapH : (item.source === 'guide' ? naturalH : 840);
            const imageRect = this.getShiftPhotoCompareRenderedImageRect({ naturalWidth: naturalW, naturalHeight: naturalH }, wrapW, wrapH);
            return { wrapW, wrapH, imageRect };
        }

        convertPhotoManagerLocalMark(mark = {}, img, item = {}) {
            if (item.source === 'guide' && Number.isFinite(Number(mark.imageX)) && Number.isFinite(Number(mark.imageY))) {
                const converted = {
                    ...mark,
                    x: Number(mark.imageX),
                    y: Number(mark.imageY)
                };
                converted._sizeScale = (img.naturalWidth || img.width || 1) / (Number(mark.imageDisplayWidth) || img.naturalWidth || img.width || 1);
                return converted;
            }
            if (item.source === 'guide' && mark.mode === 'freehand' && Array.isArray(mark.imagePoints) && mark.imagePoints.length) {
                const converted = {
                    ...mark,
                    points: mark.imagePoints
                };
                converted._sizeScale = (img.naturalWidth || img.width || 1) / (Number(mark.imageDisplayWidth) || img.naturalWidth || img.width || 1);
                return converted;
            }
            const { wrapW, wrapH, imageRect } = this.getPhotoManagerVirtualWrapRect(img, mark, item);
            const converted = { ...mark };
            if (mark.mode === 'freehand') {
                converted.points = this.parseShiftPhotoCompareFreehandPoints(JSON.stringify(mark.points || []))
                    .map(point => {
                        const px = point.x / 100 * wrapW;
                        const py = point.y / 100 * wrapH;
                        return {
                            x: ((px - imageRect.x) / imageRect.width) * 100,
                            y: ((py - imageRect.y) / imageRect.height) * 100
                        };
                    })
                    .filter(point => point.x >= -5 && point.x <= 105 && point.y >= -5 && point.y <= 105);
            } else {
                const px = (Number(mark.x) || 0) / 100 * wrapW;
                const py = (Number(mark.y) || 0) / 100 * wrapH;
                converted.x = ((px - imageRect.x) / imageRect.width) * 100;
                converted.y = ((py - imageRect.y) / imageRect.height) * 100;
            }
            converted._sizeScale = (img.naturalWidth || img.width || 1) / imageRect.width;
            return converted;
        }

        convertPhotoManagerGlobalMark(mark = {}, item = {}, img) {
            const { wrapW, wrapH, imageRect } = this.getPhotoManagerVirtualWrapRect(img, mark, item);
            const gap = 8;
            const count = Math.max(1, Math.min(4, Number(item.photoCount) || 1));
            const index = Math.max(0, Math.min(count - 1, Number(item.photoIndex) || 0));
            const layerW = wrapW * count + gap * (count - 1);
            const layerH = wrapH;
            const wrapLeft = index * (wrapW + gap);
            const fullImageRect = {
                x: wrapLeft + imageRect.x,
                y: imageRect.y,
                width: imageRect.width,
                height: imageRect.height
            };
            const converted = { ...mark };
            if (mark.mode === 'freehand') {
                converted.points = this.parseShiftPhotoCompareFreehandPoints(JSON.stringify(mark.points || []))
                    .map(point => {
                        const px = point.x / 100 * layerW;
                        const py = point.y / 100 * layerH;
                        return {
                            x: ((px - fullImageRect.x) / fullImageRect.width) * 100,
                            y: ((py - fullImageRect.y) / fullImageRect.height) * 100
                        };
                    })
                    .filter(point => point.x >= -5 && point.x <= 105 && point.y >= -5 && point.y <= 105);
            } else {
                const px = (Number(mark.x) || 0) / 100 * layerW;
                const py = (Number(mark.y) || 0) / 100 * layerH;
                converted.x = ((px - fullImageRect.x) / fullImageRect.width) * 100;
                converted.y = ((py - fullImageRect.y) / fullImageRect.height) * 100;
            }
            converted._sizeScale = (img.naturalWidth || img.width || 1) / imageRect.width;
            return converted;
        }

        async renderPhotoManagerImageWithMarks(item) {
            const img = await this.loadShiftPhotoCompareImage(item.src);
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const rect = { x: 0, y: 0, width: canvas.width, height: canvas.height };
            const localMarks = [...(item.marks || []), ...(item.managerMarks || [])].map(mark => this.convertPhotoManagerLocalMark(mark, img, item));
            const globalMarks = (item.globalMarks || []).map(mark => this.convertPhotoManagerGlobalMark(mark, item, img));
            for (const mark of [...localMarks, ...globalMarks]) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, canvas.width, canvas.height);
                ctx.clip();
                await this.drawShiftPhotoCompareMark(ctx, this.createPhotoManagerMarkElement(mark), rect, mark._sizeScale || 1);
                ctx.restore();
            }
            return canvas.toDataURL('image/png');
        }

        async downloadPhotoManagerImage(item, index = 0) {
            const src = await this.getPhotoManagerDownloadSrc(item);
            const link = document.createElement('a');
            link.href = src;
            link.download = this.getPhotoManagerSafeFileName(item, index, src);
            document.body.appendChild(link);
            link.click();
            link.remove();
        }

        getPhotoManagerSourceLabel(item = {}) {
            const labels = {
                library: '写真管理',
                machine: '機械',
                part: '部品',
                history: 'メンテ履歴',
                guide: '手順書',
                shift: '連絡帳'
            };
            return labels[item.source] || item.sourceLabel || item.source || '画像';
        }

        renderPhotoManager() {
            this.ensurePhotoManagerPasteImportListener();
            this.ensureImageSourceChoiceListener();
            const list = document.getElementById('photo-manager-list');
            const summary = document.getElementById('photo-manager-summary');
            if (!list) return;
            this.updatePhotoManagerAlphaFilterButton();
            this.updatePhotoManagerTagFilterOptions();
            const items = this.getFilteredPhotoManagerItems();
            this._photoManagerVisibleIds = items.map(item => item.id);
            const allItems = this.collectPhotoManagerItems();
            this.prunePhotoManagerSelection(allItems.map(item => item.id));
            const selectedIds = this.ensurePhotoManagerSelectionStore();
            const duplicateSrcs = new Set(this.getPhotoManagerDuplicateGroups().map(group => group.src));
            if (summary) {
                const marked = items.filter(item => item.annotated).length;
                summary.innerHTML = `<b>${items.length}</b> / ${allItems.length}件表示 <span>注記あり ${marked}件</span>`;
            }
            if (!items.length) {
                list.innerHTML = '<div class="photo-manager-empty">条件に合う写真はありません。ファイル読込やクリップボード登録で写真管理に追加できます。</div>';
                this.updatePhotoManagerBulkBar();
                this.addPhotoManagerPageOnlyCleanupButton();
                return;
            }
            list.innerHTML = items.map(item => {
                const name = this.getPhotoManagerName(item) || item.defaultName || item.title || '写真';
                const sourceLabel = this.getPhotoManagerSourceLabel(item);
                const thumbAction = item.source === 'library'
                    ? `app.openPhotoManagerEditor('${this.escapeJs(item.id)}')`
                    : `app.openPhotoManagerSource('${this.escapeJs(item.id)}')`;
                const thumbTitle = item.source === 'library' ? '写真を編集' : '元のページを開く';
                const alphaStatus = this.getPhotoManagerAlphaStatus(item);
                const checked = selectedIds.has(item.id) ? ' checked' : '';
                const usageSummary = this.getPhotoManagerUsageSummary(item);
                return `
                <article class="photo-manager-card" data-photo-id="${this.escapeHtml(item.id)}">
                    <label class="photo-manager-check">
                        <input type="checkbox" class="photo-manager-select" value="${this.escapeHtml(item.id)}"${checked} onchange="app.syncPhotoManagerSelection(this.value, this.checked)">
                    </label>
                    <button type="button" class="photo-manager-thumb" onclick="${thumbAction}" title="${this.escapeHtml(thumbTitle)}">
                        <img src="${item.src}" alt="${this.escapeHtml(name)}">
                        ${duplicateSrcs.has(item.src) ? '<span class="photo-manager-duplicate-badge"><i class="fa-solid fa-clone"></i> 重複</span>' : ''}
                        ${item.annotated ? '<span class="photo-manager-mark-badge"><i class="fa-solid fa-pen"></i> 注記あり</span>' : ''}
                        ${alphaStatus ? `<span class="photo-manager-alpha-badge ${alphaStatus}" role="button" tabindex="0" onpointerdown="event.preventDefault(); event.stopPropagation();" onclick="event.preventDefault(); event.stopPropagation(); app.openImageSourceChoiceTransparencyPreview('${this.escapeJs(item.id)}')"><i class="fa-solid fa-layer-group"></i> ${alphaStatus === 'transparent' ? '透過' : '透過候補'}</span>` : ''}
                        <span class="photo-manager-usage-badge ${usageSummary.count ? 'used' : 'unused'}"><i class="fa-solid ${usageSummary.count ? 'fa-link' : 'fa-circle-minus'}"></i> ${this.escapeHtml(usageSummary.label.replace('縺区園縺ｧ菴ｿ逕ｨ荳ｭ', 'か所で使用中').replace('譛ｪ菴ｿ逕ｨ', '未使用'))}</span>
                    </button>
                    <div class="photo-manager-info">
                        <div class="photo-manager-meta">
                            <span>${this.escapeHtml(sourceLabel)}</span>
                            ${item.date ? `<span>${this.escapeHtml(item.date)}</span>` : '<span>日付なし</span>'}
                        </div>
                        <input type="text" value="${this.escapeHtml(item.displayName || '')}" placeholder="写真管理用の名前" onchange="app.setPhotoManagerName('${this.escapeJs(item.id)}', this.value)">
                        <p title="${this.escapeHtml(item.title || '')}">${this.escapeHtml(item.title || '元データなし')}</p>
                        ${usageSummary.usages.length ? `
                            <div class="photo-manager-usage-links">
                                ${usageSummary.usages.slice(0, 4).map(usage => `
                                    <button type="button" onclick="app.openPhotoManagerUsageSource('${this.escapeJs(usage.id)}')" title="${this.escapeHtml(usage.title || '')}">
                                        ${this.escapeHtml(this.getPhotoManagerSourceLabel(usage))}
                                    </button>
                                `).join('')}
                                ${usageSummary.usages.length > 4 ? `<span>+${usageSummary.usages.length - 4}</span>` : ''}
                            </div>
                        ` : '<div class="photo-manager-usage-links empty">使用先なし</div>'}
                        <div class="photo-manager-actions">
                            <button type="button" class="secondary-btn" onclick="app.openPhotoManagerEditor('${this.escapeJs(item.id)}')"><i class="fa-solid fa-pen"></i> 編集</button>
                            ${item.source === 'library' ? '' : `<button type="button" class="secondary-btn" onclick="app.openPhotoManagerSource('${this.escapeJs(item.id)}')"><i class="fa-solid fa-up-right-from-square"></i> 元を開く</button>`}
                            <button type="button" class="secondary-btn" onclick="app.downloadPhotoManagerItem('${this.escapeJs(item.id)}')"><i class="fa-solid fa-download"></i> 出力</button>
                            <button type="button" class="secondary-btn photo-manager-cutout-btn" onclick="app.createTransparentPhotoManagerImage('${this.escapeJs(item.id)}')" title="背景色を簡易的に透明化して写真管理へ追加"><i class="fa-solid fa-wand-magic-sparkles"></i> 透過作成</button>
                            <button type="button" class="danger-btn" onclick="app.deletePhotoManagerItem('${this.escapeJs(item.id)}')"><i class="fa-solid fa-trash-can"></i> 削除</button>
                        </div>
                    </div>
                </article>`;
            }).join('');
            this.enhancePhotoManagerCards(items);
            this.updatePhotoManagerBulkBar();
            this.addPhotoManagerPageOnlyCleanupButton();
            this.updatePhotoManagerTransparencyBadges(items);
            this.updateContextualHelp?.('photos');
        }

        updatePhotoManagerBulkBar() {
            const bar = this.ensurePhotoManagerBulkBar();
            if (!bar) return;
            const selectedIds = this.getSelectedPhotoManagerIds();
            const visibleCount = this._photoManagerVisibleIds?.length || 0;
            const unusedCount = this.getUnusedPhotoManagerLibraryItems().length;
            const duplicateCount = this.getPhotoManagerDuplicateGroups().length;
            const pageOnlyCount = this.getPhotoManagerPageOnlyItems().length;
            const relationCount = this.getPhotoManagerRelationGroups().length;
            bar.classList.toggle('has-selection', selectedIds.length > 0);
            bar.innerHTML = `
                <div class="photo-manager-bulk-status">
                    <b>${selectedIds.length}</b>
                    <span>選択中</span>
                    <small>表示 ${visibleCount}件 / 未使用取込 ${unusedCount}件</small>
                </div>
                <div class="photo-manager-bulk-actions">
                    <button type="button" class="secondary-btn" onclick="app.selectVisiblePhotoManagerItems()"><i class="fa-solid fa-check-double"></i> 表示中を選択</button>
                    <button type="button" class="secondary-btn" onclick="app.clearVisiblePhotoManagerSelection()"><i class="fa-regular fa-square"></i> 解除</button>
                    <label class="photo-manager-bulk-title">
                        <span>タイトル</span>
                        <input type="text" id="photo-manager-bulk-title-input" placeholder="選択中へ一括設定">
                    </label>
                    <button type="button" class="primary-btn" onclick="app.renameSelectedPhotoManagerItems()"><i class="fa-solid fa-pen-to-square"></i> 一括変更</button>
                    <button type="button" class="secondary-btn" onclick="app.createTransparentSelectedPhotoManagerImages()"><i class="fa-solid fa-wand-magic-sparkles"></i> 透過作成</button>
                    <button type="button" class="secondary-btn" onclick="app.exportPhotoManagerItems()"><i class="fa-solid fa-file-export"></i> 出力</button>
                    <button type="button" class="secondary-btn" onclick="app.openPhotoManagerRelationMap()"><i class="fa-solid fa-diagram-project"></i> 関係図 ${relationCount ? `(${relationCount})` : ''}</button>
                    <button type="button" class="secondary-btn photo-manager-page-only-cleanup-btn" onclick="app.openPhotoManagerPageOnlyCleanupReview()"><i class="fa-solid fa-folder-minus"></i> ページ残り ${pageOnlyCount ? `(${pageOnlyCount})` : ''}</button>
                    <button type="button" class="secondary-btn" onclick="app.openPhotoManagerDuplicateReview()"><i class="fa-solid fa-clone"></i> 重複整理 ${duplicateCount ? `(${duplicateCount})` : ''}</button>
                    <button type="button" class="secondary-btn" onclick="app.openPhotoManagerTrashDialog()"><i class="fa-solid fa-trash-restore"></i> ゴミ箱 ${(store.activeData.photoManagerTrash || []).length ? `(${store.activeData.photoManagerTrash.length})` : ''}</button>
                    <button type="button" class="danger-btn" onclick="app.deleteUnusedPhotoManagerLibraryItems()"><i class="fa-solid fa-broom"></i> 未使用削除</button>
                    <button type="button" class="danger-btn" onclick="app.deleteSelectedPhotoManagerItems()"><i class="fa-solid fa-trash-can"></i> 選択削除</button>
                </div>`;
        }

        getPhotoManagerRelationGroups() {
            const groups = new Map();
            this.collectPhotoManagerItems().forEach(item => {
                if (!item?.src) return;
                if (!groups.has(item.src)) groups.set(item.src, []);
                groups.get(item.src).push(item);
            });
            return Array.from(groups.entries()).map(([src, items]) => {
                const sources = [...new Set(items.map(item => item.source))];
                const bytes = this.estimatePhotoManagerImageBytes(src);
                return { src, items, sources, bytes };
            }).filter(group => group.items.length > 1 || group.sources.length > 1)
                .sort((a, b) => b.items.length - a.items.length || b.bytes - a.bytes);
        }

        openPhotoManagerRelationMap() {
            const groups = this.getPhotoManagerRelationGroups();
            if (!groups.length) return this.showPhotoManagerNotice('複数の場所にまたがる写真は見つかりませんでした。');
            const totalBytes = groups.reduce((sum, group) => sum + group.bytes, 0);
            const body = `
                <div class="photo-manager-review-summary">
                    <b>${groups.length}組</b>
                    <span>同じ画像が写真管理・連絡帳・履歴など、どこにまたがっているかを表示します。合計 約${this.formatPhotoManagerBytes(totalBytes)}。</span>
                </div>
                <div class="photo-manager-relation-list">
                    ${groups.map(group => `
                        <article class="photo-manager-relation-item">
                            <img src="${group.src}" alt="関係画像">
                            <div>
                                <b>${group.items.length}件で共有 / 約${this.formatPhotoManagerBytes(group.bytes)}</b>
                                <div class="photo-manager-relation-chips">
                                    ${group.items.map(item => `
                                        <button type="button" onclick="app.openPhotoManagerUsageSource('${this.escapeJs(item.id)}')" title="${this.escapeHtml(item.title || '')}">
                                            ${this.escapeHtml(this.getPhotoManagerSourceLabel(item))}
                                        </button>
                                    `).join('')}
                                </div>
                                <small>${this.escapeHtml(group.items.map(item => item.title || item.defaultName || this.getPhotoManagerSourceLabel(item)).slice(0, 4).join(' / '))}</small>
                            </div>
                        </article>
                    `).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                </div>`;
            this.openPhotoManagerReviewDialog('写真の関係図', body);
        }

        exportPhotoManagerItems() {
            const selected = new Set(this.getSelectedPhotoManagerIds());
            const items = this.getFilteredPhotoManagerItems().filter(item => !selected.size || selected.has(item.id));
            if (!items.length) return alert('出力する写真がありません。');
            items.forEach((item, index) => {
                setTimeout(() => this.downloadPhotoManagerImage(item, index + 1), index * 160);
            });
        }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppPhotoManagerMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppPhotoManagerMethods.prototype[name];
        }
    }
})();
