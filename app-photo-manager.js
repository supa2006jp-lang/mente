(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppPhotoManagerMethods extends MaintenanceApp {
        ensurePhotoManagerData() {
            if (!store.activeData.photoManagerNames || typeof store.activeData.photoManagerNames !== 'object') {
                store.activeData.photoManagerNames = {};
            }
            return store.activeData.photoManagerNames;
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
            item.annotated = !!item.annotated || (Array.isArray(item.marks) && item.marks.length > 0);
            item.displayName = this.getPhotoManagerName(item);
            items.push(item);
        }

        collectPhotoManagerItems() {
            const items = [];
            const data = store.activeData;
            const machines = store.getMachines(true);
            const machineMap = new Map(machines.map(m => [String(m.id), m]));

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
            if (terms.length) {
                items = items.filter(item => this.matchesSearchTerms(`${item.sourceLabel} ${item.title} ${item.displayName} ${item.caption || ''} ${item.date}`, terms));
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
            const list = document.getElementById('photo-manager-list');
            const summary = document.getElementById('photo-manager-summary');
            if (!list) return;
            const items = this.getFilteredPhotoManagerItems();
            this._photoManagerVisibleIds = items.map(item => item.id);
            const allCount = this.collectPhotoManagerItems().length;
            if (summary) {
                const marked = items.filter(item => item.annotated).length;
                summary.innerHTML = `<b>${items.length}</b> / ${allCount} 枚表示　<span>注記あり ${marked}枚</span>`;
            }
            if (!items.length) {
                list.innerHTML = '<div class="photo-manager-empty">該当する写真はありません。</div>';
                return;
            }
            list.innerHTML = items.map(item => `
                <article class="photo-manager-card" data-photo-id="${this.escapeHtml(item.id)}">
                    <label class="photo-manager-check">
                        <input type="checkbox" class="photo-manager-select" value="${this.escapeHtml(item.id)}">
                    </label>
                    <button type="button" class="photo-manager-thumb" onclick="app.openPhotoManagerSource('${this.escapeJs(item.id)}')" title="元の使用ページを開く">
                        <img src="${item.src}" alt="${this.escapeHtml(item.displayName || item.defaultName || '写真')}">
                        ${item.annotated ? '<span><i class="fa-solid fa-pen"></i> 注記あり</span>' : ''}
                    </button>
                    <div class="photo-manager-info">
                        <div class="photo-manager-meta">
                            <span>${this.escapeHtml(item.sourceLabel)}</span>
                            ${item.date ? `<span>${this.escapeHtml(item.date)}</span>` : '<span>日付なし</span>'}
                        </div>
                        <input type="text" value="${this.escapeHtml(item.displayName || '')}" placeholder="写真管理用の名前" onchange="app.setPhotoManagerName('${this.escapeJs(item.id)}', this.value)">
                        <p title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title || '元情報なし')}</p>
                        <div class="photo-manager-actions">
                            <button type="button" class="secondary-btn" onclick="app.openPhotoManagerSource('${this.escapeJs(item.id)}')"><i class="fa-solid fa-up-right-from-square"></i> 元を開く</button>
                            <button type="button" class="secondary-btn" onclick="app.downloadPhotoManagerItem('${this.escapeJs(item.id)}')"><i class="fa-solid fa-download"></i> 出力</button>
                        </div>
                    </div>
                </article>
            `).join('');
        }

        findPhotoManagerItem(id) {
            return this.collectPhotoManagerItems().find(item => item.id === id) || null;
        }

        openPhotoManagerSource(id) {
            const item = this.findPhotoManagerItem(id);
            if (!item) return alert('元の写真が見つかりませんでした。');
            item.open?.();
        }

        selectVisiblePhotoManagerItems() {
            document.querySelectorAll('#photo-manager-list .photo-manager-select').forEach(input => {
                input.checked = true;
            });
        }

        clearVisiblePhotoManagerSelection() {
            document.querySelectorAll('#photo-manager-list .photo-manager-select').forEach(input => {
                input.checked = false;
            });
        }

        getSelectedPhotoManagerIds() {
            return Array.from(document.querySelectorAll('#photo-manager-list .photo-manager-select:checked')).map(input => input.value);
        }

        deleteSelectedPhotoManagerItems() {
            const ids = this.getSelectedPhotoManagerIds();
            if (!ids.length) return alert('削除する写真を選択してください。');
            if (!confirm(`選択した${ids.length}枚の写真を元データから完全削除します。よろしいですか？`)) return;
            const names = this.ensurePhotoManagerData();
            const selectedItems = this.collectPhotoManagerItems()
                .filter(item => ids.includes(item.id))
                .sort((a, b) => (b.deleteIndex || 0) - (a.deleteIndex || 0));
            selectedItems.forEach(item => {
                if (!item) return;
                item.deletePhoto?.();
                delete names[item.id];
            });
            store.save();
            this.renderPhotoManager();
        }

        downloadPhotoManagerItem(id) {
            const item = this.findPhotoManagerItem(id);
            if (!item) return alert('写真が見つかりませんでした。');
            this.downloadPhotoManagerImage(item);
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

        async getPhotoManagerDownloadSrc(item) {
            if (this.getPhotoManagerExportMode() !== 'withMarks' || !item?.annotated || !['shift', 'guide'].includes(item.source)) return item.src;
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
            el.dataset.font = this.getShiftPhotoCompareSafeFont ? this.getShiftPhotoCompareSafeFont(mark.font || '') : (mark.font || '');
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
            const localMarks = (item.marks || []).map(mark => this.convertPhotoManagerLocalMark(mark, img, item));
            const globalMarks = (item.globalMarks || []).map(mark => this.convertPhotoManagerGlobalMark(mark, item, img));
            [...localMarks, ...globalMarks].forEach(mark => {
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, canvas.width, canvas.height);
                ctx.clip();
                this.drawShiftPhotoCompareMark(ctx, this.createPhotoManagerMarkElement(mark), rect, mark._sizeScale || 1);
                ctx.restore();
            });
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
