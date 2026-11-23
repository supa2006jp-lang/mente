(function () {
    'use strict';
    const P = MaintenanceApp.prototype;
    const clone = value => JSON.parse(JSON.stringify(value));
    const node = (tag, text, parent) => { const e = document.createElement(tag); if (text != null) e.textContent = text; parent?.append(e); return e; };
    const button = (parent, text, action) => { const e = node('button', text, parent); e.type = 'button'; e.onclick = action; return e; };
    const toolbarCategories = [
        ['draw', '描画', 'fa-pen', '記号・線・図形'], ['text', '文字', 'fa-font', '文字・吹き出し・連番'],
        ['image', '画像', 'fa-image', '画像・動画・モザイク'], ['background', '背景', 'fa-fill-drip', '背景色・キラ・壁紙'],
        ['output', '出力', 'fa-file-export', '画像出力・アニメ・読み上げ・保存した版']
    ];

    P.getImageEditToolbarCategoryForMode = function (mode) {
        if (['text', 'boxedText', 'callout', 'number', 'table'].includes(mode)) return 'text';
        if (['image', 'video', 'mosaic', 'mosaicRange'].includes(mode)) return 'image';
        if (['circle', 'triangle', 'arrow', 'dimension', 'rect', 'xmark', 'freehand', 'polyline'].includes(mode)) return 'draw';
        return '';
    };

    P.initializeImageEditToolbar = function () {
        const overlay = document.getElementById('shift-photo-compare-overlay');
        const actions = overlay?.querySelector('.shift-photo-compare-header-actions');
        const bar = actions?.querySelector('.shift-photo-compare-markbar');
        if (!bar || actions.querySelector('.image-edit-toolbar-tabs')) return;
        overlay.classList.add('image-edit-categorized');
        const common = node('div', null, actions); common.className = 'image-edit-common-tools'; common.setAttribute('aria-label', '共通操作');
        for (const selector of ['.shift-photo-compare-move', '.shift-photo-compare-select-range', '.shift-photo-compare-undo', '.shift-photo-compare-redo']) {
            const control = bar.querySelector(selector); if (control) common.append(control);
        }
        const tabs = node('div', null, actions); tabs.className = 'image-edit-toolbar-tabs'; tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '画像編集のカテゴリ');
        for (const [key, label, icon, title] of toolbarCategories) {
            const tab = button(tabs, null, () => this.setImageEditToolbarCategory(key));
            tab.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span>`;
            tab.id = `image-edit-tab-${key}`; tab.dataset.editorCategory = key; tab.title = title;
            tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'image-edit-tool-panel');
        }
        tabs.addEventListener('keydown', event => {
            const current = event.target.closest('[role="tab"]');
            if (!current || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const buttons = [...tabs.children], index = buttons.indexOf(current);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next].click(); buttons[next].focus({ preventScroll: true });
        });
        bar.id = 'image-edit-tool-panel'; bar.setAttribute('role', 'tabpanel');
        // Keep the existing controls and handlers intact; only their visibility changes.
        const rules = [
            ['.shift-photo-compare-blank-background-controls', 'background'],
            ['.shift-photo-compare-wallpaper-btn, .shift-photo-compare-wallpaper-clear, .shift-photo-compare-fill-color, .shift-photo-compare-fill-presets', 'text background'],
            ['.shift-photo-compare-callout-text-color, .shift-photo-compare-callout-text-presets, .shift-photo-compare-font, .shift-photo-compare-text, .shift-photo-compare-number-reset', 'text'],
            ['.shift-photo-compare-image-ocr-btn, .shift-photo-compare-animation-auto-order-btn, .shift-photo-compare-animation-play-btn, .shift-photo-compare-export, .shift-photo-compare-copy-all, .shift-photo-compare-export-one', 'output'],
            ['.shift-photo-compare-video-insert-btn, .shift-photo-compare-clipboard, .shift-photo-compare-brush-size, .shift-photo-compare-image-cutout, .shift-photo-compare-image-ratio-reset, .shift-photo-compare-aspect-lock', 'image'],
            ['.shift-photo-compare-polyline-snap-toggle, .shift-photo-compare-dashed', 'draw'],
            ['.shift-photo-compare-outline, .shift-photo-compare-inner-outline, .shift-photo-compare-symbol-preset, .shift-photo-compare-mark-color-presets', 'draw text']
        ];
        for (const control of bar.children) {
            const mode = control.dataset.markMode;
            control.dataset.editorCategories = (mode && this.getImageEditToolbarCategoryForMode(mode))
                || rules.find(([selector]) => control.matches(selector))?.[1] || 'draw text image';
        }
        const sample = overlay.querySelector('.shift-photo-compare-sample-inline');
        if (sample) { sample.dataset.editorCategories = 'draw text'; bar.append(sample); }
        this.setImageEditToolbarCategory('draw', { follow: true });
    };

    P.setImageEditToolbarCategory = function (category, { follow = false } = {}) {
        const context = this._shiftPhotoCompareContext, overlay = document.getElementById('shift-photo-compare-overlay');
        if (!context || context._saving || context._imageComparison || !overlay?.classList.contains('image-edit-categorized') || !toolbarCategories.some(([key]) => key === category)) return;
        if (!follow && this._shiftPhotoCompareMarkMode !== 'move') this.setShiftPhotoCompareMarkModeDirect('move');
        if (!follow) {
            this.cancelShiftPhotoCompareEyedropper?.();
            this.hideShiftPhotoComparePlacementPreview?.();
            this.clearShiftPhotoCompareImageBrushMode?.({ silent: true });
        }
        const backgroundPanel = document.getElementById('shift-photo-compare-blank-bg-panel');
        if (category !== 'background' && backgroundPanel?.matches(':popover-open')) backgroundPanel.hidePopover();
        context.toolbarCategory = category;
        overlay.dataset.editorCategory = category;
        const bar = overlay.querySelector('.shift-photo-compare-markbar');
        const mode = this._shiftPhotoCompareSelectedMark?.dataset.mode || this._shiftPhotoCompareMarkMode;
        for (const control of bar.children) {
            const dimensionText = category === 'draw' && mode === 'dimension' && control.matches('.shift-photo-compare-text, .shift-photo-compare-font');
            control.classList.toggle('image-edit-category-hidden', !dimensionText && !String(control.dataset.editorCategories || '').split(' ').includes(category));
        }
        bar.setAttribute('aria-labelledby', `image-edit-tab-${category}`);
        overlay.querySelectorAll('[data-editor-category]').forEach(tab => {
            if (tab === overlay) return;
            const active = tab.dataset.editorCategory === category;
            tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
        });
        overlay.querySelector('.shift-photo-compare-recent-images')?.classList.toggle('image-edit-category-hidden', category !== 'image');
    };

    P.followImageEditToolbarMode = function (mode) {
        const category = this.getImageEditToolbarCategoryForMode(mode);
        if (category) this.setImageEditToolbarCategory(category, { follow: true });
    };

    P.getImageEditDocumentKey = function (context = this._shiftPhotoCompareContext) {
        if (!context) return '';
        if (context.photoManagerBlankEditItemId) return `blank:${context.photoManagerBlankEditItemId}`;
        if (context.imageEditKey) return context.imageEditKey;
        if (context.source === 'guide') return `guide:${document.getElementById('g-h-id')?.value || context.animationTimelineStorageKey}`;
        const notebook = this._editingShiftNotebook;
        if (context.row && notebook) return `notebook:${notebook.dateStr}:${notebook.shift}:${context.row.dataset.shiftRowId || context.animationTimelineStorageKey}`;
        return `${context.source}:${context.animationTimelineStorageKey}`;
    };

    P.captureImageEditSnapshot = function () {
        this.clearShiftPhotoComparePalettePreview?.();
        const context = this._shiftPhotoCompareContext;
        if (!context) return null;
        if (context._imageComparison) return clone(context._imageComparison);
        const overlay = document.getElementById('shift-photo-compare-overlay');
        const wraps = Array.from(overlay.querySelectorAll('.shift-photo-compare-image-wrap')).map(wrap => {
            const photoIndex = Number(wrap.dataset.photoIndex), photo = context.photos[photoIndex] || {};
            return { photoIndex, src: wrap.querySelector(':scope > img')?.src || photo.src || '', caption: photo.caption || '',
                isBlankBase: !!photo.isBlankBase, blankBaseColor: photo.blankBaseColor || '',
                blankBaseGradient: photo.blankBaseGradient || null,
                marks: this.addShiftPhotoCompareImageCoordinates(this.readShiftPhotoCompareMarksFromWrap(wrap), wrap) };
        });
        const layer = overlay.querySelector('.shift-photo-compare-global-layer');
        return clone({ version: 1, wraps, globalMarks: layer ? this.readShiftPhotoCompareMarksFromWrap(layer) : [] });
    };

    P.getImageEditVersions = function (context = this._shiftPhotoCompareContext) {
        const key = this.getImageEditDocumentKey(context);
        return (Array.isArray(store.activeData.imageEditVersions) ? store.activeData.imageEditVersions : []).filter(v => v.documentKey === key && v.snapshot?.version === 1);
    };

    P.addImageEditVersion = function (snapshot, kind, context = this._shiftPhotoCompareContext) {
        if (!snapshot || !context || context.departmentId !== store.data.currentDepartmentId) return null;
        const key = this.getImageEditDocumentKey(context), signature = JSON.stringify(snapshot);
        const versions = Array.isArray(store.activeData.imageEditVersions) ? store.activeData.imageEditVersions : [];
        const previous = versions.filter(v => v.documentKey === key).at(-1);
        if (previous && JSON.stringify(previous.snapshot) === signature) return previous;
        const version = { id: store.generateId(), documentKey: key, kind, createdAt: new Date().toISOString(), snapshot: clone(snapshot) };
        const same = versions.filter(v => v.documentKey === key).slice(-9);
        store.activeData.imageEditVersions = [...versions.filter(v => v.documentKey !== key), ...same, version].slice(-100);
        return version;
    };

    P.rememberImageEditStart = function (context = this._shiftPhotoCompareContext) {
        if (!context?._imageStart || context._imageStartRemembered || context._applyingImageSnapshot || context._imageComparison) return;
        if (JSON.stringify(this.captureImageEditSnapshot()) === JSON.stringify(context._imageStart)) return;
        this.addImageEditVersion(context._imageStart, 'start', context); context._imageStartRemembered = true;
    };

    P.setImageEditSaveStatus = function (state, context = this._shiftPhotoCompareContext) {
        if (!context || context !== this._shiftPhotoCompareContext) return;
        context.imageSaveState = state;
        const status = document.getElementById('image-edit-save-status');
        if (status) { status.dataset.state = state; status.textContent = ({ ready: '編集開始時の状態', saving: '保存中…', saved: '保存済み', failed: '保存失敗・再保存できます', changed: '未保存の変更あり' })[state] || state; }
    };

    P.trackImageEditSave = function (result, context = this._shiftPhotoCompareContext) {
        if (!result || typeof result.then !== 'function' || !context) return result;
        context.imagePendingSaves ||= new Set();
        const pending = Promise.resolve(result); context.imagePendingSaves.add(pending);
        this.setImageEditSaveStatus('saving', context);
        // Attach a rejection handler even when a pointer event initiates the autosave.
        pending.then(() => {
            context.imagePendingSaves.delete(pending);
            if (!context.imagePendingSaves.size) this.setImageEditSaveStatus('saved', context);
        }, () => { context.imagePendingSaves.delete(pending); this.setImageEditSaveStatus('failed', context); });
        return pending;
    };

    P.initializeImageEditWorkspace = function (options = {}) {
        const context = this._shiftPhotoCompareContext, overlay = document.getElementById('shift-photo-compare-overlay');
        if (!context || !overlay) return;
        context.departmentId = store.data.currentDepartmentId;
        context.imageEditKey = options.imageEditKey || (String(context.source).startsWith('photoManagerBlank') && !context.photoManagerBlankEditItemId ? `blank-session:${store.generateId()}` : '');
        context._imageStart = this.captureImageEditSnapshot();
        context.imagePendingSaves ||= new Set();
        this._shiftPhotoCompareRedoStack = [];
        const originalSync = context.onSync;
        context.onSync = current => {
            if (current._applyingImageSnapshot || current._imageComparison || current._disposed) return;
            if (current.departmentId !== store.data.currentDepartmentId) throw Error('部署が変わったため画像を保存できません。元の部署に戻してください。');
            this.rememberImageEditStart(current);
            this.setImageEditSaveStatus('changed', current);
            return this.trackImageEditSave(originalSync?.(current), current);
        };
        const undo = overlay.querySelector('.shift-photo-compare-undo');
        const redo = document.createElement('button'); redo.type = 'button'; redo.className = 'shift-photo-compare-redo';
        redo.innerHTML = '<i class="fa-solid fa-rotate-right"></i>'; redo.title = 'やり直す（Ctrl+Y / Ctrl+Shift+Z）'; redo.setAttribute('aria-label', 'やり直す'); redo.onclick = () => this.redoShiftPhotoCompareMarkChange();
        undo?.after(redo);
        const group = node('div', null, overlay.querySelector('.shift-photo-compare-header-actions')); group.className = 'image-edit-workspace-tools';
        const compare = button(group, '編集前と比較', () => this.toggleImageEditComparison()); compare.id = 'image-edit-compare'; compare.setAttribute('aria-pressed', 'false');
        const versions = button(group, '保存した版', () => this.openImageEditVersions()); versions.id = 'image-edit-versions';
        const status = node('span', null, group); status.id = 'image-edit-save-status'; status.setAttribute('role', 'status');
        this.setImageEditSaveStatus('ready', context); this.updateShiftPhotoCompareUndoButton();
        this.initializeImageEditToolbar();
    };

    P.applyImageEditSnapshot = function (snapshot, preview = false) {
        const context = this._shiftPhotoCompareContext, overlay = document.getElementById('shift-photo-compare-overlay');
        if (!context || !overlay || snapshot?.version !== 1 || !Array.isArray(snapshot.wraps)) throw Error('復元できる編集データがありません。');
        if (context.departmentId !== store.data.currentDepartmentId) throw Error('部署が変わったため復元できません。');
        const wraps = [...overlay.querySelectorAll('.shift-photo-compare-image-wrap')];
        if (wraps.length !== snapshot.wraps.length || snapshot.wraps.some(p => !context.photos[p.photoIndex])) throw Error('写真の構成が変わっています。この版は復元できません。');
        context._applyingImageSnapshot = true;
        try {
            for (const saved of snapshot.wraps) {
                const wrap = wraps.find(w => Number(w.dataset.photoIndex) === saved.photoIndex);
                if (!wrap) throw Error('復元する写真が見つかりません。');
                const marks = this.parseShiftPhotoCompareMarks(JSON.stringify(saved.marks || []));
                const img = wrap.querySelector(':scope > img'); if (img) img.src = saved.src;
                const layer = wrap.querySelector('.shift-photo-compare-mark-layer'); if (layer) layer.innerHTML = marks.map(mark => this.getShiftPhotoCompareMarkHtml(mark)).join('');
                if (!preview) {
                    const photo = context.photos[saved.photoIndex];
                    Object.assign(photo, { src: saved.src, caption: saved.caption || '', marks, isBlankBase: !!saved.isBlankBase, blankBaseColor: saved.blankBaseColor || '', blankBaseGradient: saved.blankBaseGradient || null });
                    if (photo.previewItem) {
                        const original = photo.previewItem.querySelector('img'); if (original) original.src = saved.src;
                        const caption = photo.previewItem.querySelector('.shift-photo-caption'); if (caption) caption.value = photo.caption;
                        photo.previewItem.dataset.shiftPhotoMarks = JSON.stringify(this.compactShiftPhotoCompareMarkImages(marks));
                    }
                    this.updateShiftPhotoComparePhotoPairMeta(photo);
                    this.refreshShiftPhotoComparePhotoMeta(saved.photoIndex);
                }
            }
            const global = this.parseShiftPhotoCompareMarks(JSON.stringify(snapshot.globalMarks || []));
            const layer = overlay.querySelector('.shift-photo-compare-global-layer'); if (layer) layer.innerHTML = global.map(mark => this.getShiftPhotoCompareMarkHtml(mark)).join('');
            if (!preview) {
                context.globalMarks = global;
                const blank = snapshot.wraps.find(p => p.isBlankBase);
                if (blank) for (const input of overlay.querySelectorAll('.shift-photo-compare-blank-bg-color input')) input.value = blank.blankBaseColor || '#ffffff';
                this.refreshShiftPhotoCompareBlankBackgroundControls?.();
                if (context.row) context.row.dataset.shiftPhotoGlobalMarks = JSON.stringify(this.compactShiftPhotoCompareMarkImages(global));
            }
            this.selectShiftPhotoCompareMark(null); this.refreshShiftPhotoCompareMarkList(); this.updateShiftPhotoCompareMiniToolbar();
            this.restoreShiftPhotoCompareAnimationEndGhosts?.(overlay);
        } finally { context._applyingImageSnapshot = false; }
        if (!preview) {
            context.onSync?.(context);
            if (context.row) this.trackImageEditSave(this.autoSaveShiftNotebook(true), context);
            if (context.source === 'guide') this.trackImageEditSave(this.autoSaveGuideDraftFromModal?.(), context);
            this.updateShiftPhotoCompareUndoButton();
        }
    };

    P.setImageEditReadOnly = function (active) {
        const overlay = document.getElementById('shift-photo-compare-overlay'); if (!overlay) return;
        if (active) document.getElementById('shift-photo-compare-blank-bg-panel')?.hidePopover();
        for (const element of overlay.querySelectorAll('.shift-photo-compare-markbar, .image-edit-common-tools, .image-edit-toolbar-tabs, .shift-photo-compare-grid, .shift-photo-compare-mini-toolbar')) element.inert = active;
        overlay.classList.toggle('image-edit-readonly', active);
    };

    P.toggleImageEditComparison = function () {
        const context = this._shiftPhotoCompareContext; if (!context || context._saving) return;
        const compare = document.getElementById('image-edit-compare');
        if (context._imageComparison) {
            const current = context._imageComparison; context._imageComparison = null;
            this.applyImageEditSnapshot(current, true); this.setImageEditReadOnly(false);
            if (compare) { compare.textContent = '編集前と比較'; compare.setAttribute('aria-pressed', 'false'); }
        } else {
            context._imageComparison = this.captureImageEditSnapshot();
            this.applyImageEditSnapshot(context._imageStart, true); this.setImageEditReadOnly(true);
            if (compare) { compare.textContent = '編集中の画像に戻る'; compare.setAttribute('aria-pressed', 'true'); }
        }
    };

    P.redoShiftPhotoCompareMarkChange = function () {
        const context = this._shiftPhotoCompareContext;
        if (!context || context._saving || context._imageComparison) return;
        const snapshot = this._shiftPhotoCompareRedoStack?.pop(); if (!snapshot) return;
        this._shiftPhotoCompareUndoStack.push(this.getShiftPhotoCompareSnapshot());
        this.restoreShiftPhotoCompareSnapshot(snapshot); this.showShiftPhotoCompareActionMessage('やり直しました。');
    };

    P.openImageEditVersions = function () {
        const context = this._shiftPhotoCompareContext; if (!context || context._saving) return;
        if (context._imageComparison) this.toggleImageEditComparison();
        const dialog = node('dialog', null, document.body); dialog.className = 'image-edit-dialog';
        node('h3', '保存した版から復元', dialog);
        node('p', '画像ごとに直近10版、部署全体で100版まで保持します。復元も「元に戻す」で取り消せます。', dialog);
        const list = node('div', null, dialog); list.className = 'image-edit-version-list';
        const error = node('p', null, dialog); error.setAttribute('role', 'alert');
        const restore = snapshot => {
            if (this._shiftPhotoCompareContext !== context || context._saving) return;
            try { this.pushShiftPhotoCompareUndo(); this.applyImageEditSnapshot(snapshot); dialog.close(); this.showShiftPhotoCompareActionMessage('選んだ版に復元しました。保存ボタンで保存状態を確認できます。'); }
            catch (e) { error.textContent = e.message; }
        };
        button(list, '今回の編集開始時に戻す', () => restore(context._imageStart));
        for (const entry of [...this.getImageEditVersions(context)].reverse()) {
            const row = node('div', null, list); row.className = 'image-edit-version';
            node('span', `${new Date(entry.createdAt).toLocaleString('ja-JP')} · ${entry.kind === 'start' ? '編集開始時' : '保存した版'}`, row);
            button(row, 'この版に戻す', () => restore(entry.snapshot));
        }
        if (!this.getImageEditVersions(context).length) node('p', '保存した版はまだありません。編集・保存するとここに表示します。', list);
        button(dialog, '閉じる', () => dialog.close()); dialog.addEventListener('close', () => dialog.remove(), { once: true }); dialog.showModal();
    };

    P.persistImageEditor = async function (context) {
        if (context.departmentId !== store.data.currentDepartmentId) throw Error('部署が変わったため画像を保存できません。');
        const pending = [...(context.imagePendingSaves || [])];
        if (context.row) pending.push(this.autoSaveShiftNotebook(true));
        const sync = context.onSync?.(context); if (sync?.then) pending.push(sync);
        if (context.source === 'guide') pending.push(this.autoSaveGuideDraftFromModal?.());
        await Promise.all(pending);
        if (String(context.source).startsWith('photoManagerBlank')) {
            const oldKey = this.getImageEditDocumentKey(context);
            await this.syncPhotoManagerBlankEditFromCompare(context, { throwOnError: true });
            const newKey = this.getImageEditDocumentKey(context);
            if (oldKey !== newKey) for (const v of store.activeData.imageEditVersions || []) if (v.documentKey === oldKey) v.documentKey = newKey;
        }
        const snapshot = this.captureImageEditSnapshot();
        const previousVersions = store.activeData.imageEditVersions;
        this.rememberImageEditStart(context);
        this.addImageEditVersion(snapshot, 'saved', context);
        const stagedVersions = store.activeData.imageEditVersions;
        try { await store.save({ discardQueuedOnFailure: true }); }
        catch (error) {
            if (store.activeData.imageEditVersions === stagedVersions) store.activeData.imageEditVersions = previousVersions || [];
            throw error;
        }
    };

    P.createImageExportBlob = async function (source, settings) {
        const maxSide = [1280, 1920, 2560, 3200].includes(Number(settings.maxSide)) ? Number(settings.maxSide) : 1920;
        const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(source.width * scale)); canvas.height = Math.max(1, Math.round(source.height * scale));
        const context = canvas.getContext('2d'), jpeg = settings.format === 'jpeg';
        if (jpeg) { context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); }
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; context.drawImage(source, 0, 0, canvas.width, canvas.height);
        const quality = Math.min(1, Math.max(.4, Number(settings.quality) || .9));
        const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('画像を出力できませんでした。')), jpeg ? 'image/jpeg' : 'image/png', quality));
        return { blob, width: canvas.width, height: canvas.height, extension: jpeg ? 'jpg' : 'png' };
    };

    P.openImageExportDialog = function (sources, title = '画像') {
        if (!sources.length) return;
        const dialog = node('dialog', null, document.body); dialog.className = 'image-edit-dialog image-export-dialog';
        node('h3', '画像を書き出す', dialog); node('p', `${title} · ${sources.length}枚${sources.length > 1 ? '（ZIPでまとめて保存）' : ''}`, dialog);
        const fields = node('div', null, dialog); fields.className = 'image-export-fields';
        const select = (label, options) => { const l = node('label', label, fields), input = node('select', null, l); input.setAttribute('aria-label', label); for (const [value, text] of options) input.add(new Option(text, value)); return input; };
        let saved = {}; try { saved = JSON.parse(localStorage.getItem('maintenance-image-export-settings') || '{}'); } catch {}
        const format = select('形式', [['png','PNG（透過を保持）'],['jpeg','JPEG（白背景）']]); format.value = saved.format === 'jpeg' ? 'jpeg' : 'png';
        const size = select('長辺の上限', [1280,1920,2560,3200].map(n => [String(n),`${n} px`])); size.value = String([1280,1920,2560,3200].includes(saved.maxSide) ? saved.maxSide : 1920);
        const qualityLabel = node('label', 'JPEG画質 ', fields), quality = node('input', null, qualityLabel); quality.type = 'range'; quality.min = '40'; quality.max = '100'; quality.step = '5'; quality.value = String(Math.max(40, Math.min(100, Number(saved.quality) * 100 || 90))); quality.setAttribute('aria-label', 'JPEG画質');
        const qualityValue = node('output', null, qualityLabel);
        const page = select('プレビューする画像', sources.map((s, i) => [String(i),s.name || `画像${i + 1}`])); page.parentElement.hidden = sources.length < 2;
        node('p', '元画像より拡大しません。PNGは透過を保持し、JPEGは透明部分を白くします。', dialog);
        const preview = node('div', null, dialog); preview.className = 'image-export-preview'; const image = node('img', null, preview); image.alt = '書き出す画像のプレビュー';
        const status = node('p', 'プレビューを準備しています…', dialog); status.setAttribute('role', 'status');
        const error = node('p', null, dialog); error.setAttribute('role', 'alert');
        const footer = node('div', null, dialog); footer.className = 'image-edit-dialog-actions';
        let generation = 0, url = '', rendered = null, busy = false, closed = false, cachedIndex = -1, cachedCanvas = null;
        const settings = () => ({ format: format.value, maxSide: Number(size.value), quality: Number(quality.value) / 100 });
        const getCanvas = async index => {
            if (cachedIndex === index && cachedCanvas) return cachedCanvas;
            const canvas = await sources[index].render(); if (!canvas) throw Error('画像を読み込めませんでした。');
            cachedCanvas = canvas; cachedIndex = index; return canvas;
        };
        const close = button(footer, '閉じる', () => { if (!busy) dialog.close(); });
        const download = button(footer, sources.length > 1 ? `${sources.length}枚をZIP保存` : '画像を保存', async () => {
            if (busy || !rendered) return;
            busy = true; error.textContent = ''; const controls = [...dialog.querySelectorAll('button,input,select')]; controls.forEach(c => c.disabled = true);
            try {
                const files = [], used = new Set(), chosen = settings();
                for (let i = 0; i < sources.length; i++) {
                    status.textContent = `${i + 1}/${sources.length}枚を準備しています…`;
                    const output = i === Number(page.value) ? rendered : await this.createImageExportBlob(await getCanvas(i), chosen);
                    const base = String(sources[i].name || `画像${i + 1}`).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[\\/:*?"<>|]/g, '_');
                    const name = this.getPhotoManagerUniqueExportFileName(`${base}.${output.extension}`, used);
                    if (sources.length === 1) this.downloadPhotoManagerBlob(output.blob, name);
                    else files.push({ name, bytes: new Uint8Array(await output.blob.arrayBuffer()) });
                }
                if (files.length) this.downloadPhotoManagerBlob(this.createPhotoManagerZipBlob(files), `画像_${this.getLocalDateString()}.zip`);
                try { localStorage.setItem('maintenance-image-export-settings', JSON.stringify(chosen)); } catch {}
                status.textContent = 'ダウンロードを開始しました。';
            } catch (e) { error.textContent = e.message || String(e); }
            finally { busy = false; controls.forEach(c => c.disabled = false); quality.disabled = format.value !== 'jpeg'; }
        });
        const update = async () => {
            const ticket = ++generation; rendered = null; download.disabled = true; error.textContent = ''; status.textContent = 'プレビューを更新しています…';
            quality.disabled = format.value !== 'jpeg'; qualityValue.textContent = `${quality.value}%`; const chosen = settings(), index = Number(page.value);
            try {
                const output = await this.createImageExportBlob(await getCanvas(index), chosen);
                if (closed || ticket !== generation) return;
                if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(output.blob); image.src = url; rendered = output;
                status.textContent = `${output.width} × ${output.height} px · ${this.formatPhotoManagerBytes(output.blob.size)}${sources.length > 1 ? '（選択中の1枚）' : ''}`; download.disabled = false;
            } catch (e) { if (!closed && ticket === generation) { status.textContent = ''; error.textContent = e.message || String(e); } }
        };
        for (const input of [format,size,quality,page]) input.oninput = update;
        dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
        dialog.addEventListener('close', () => { closed = true; generation++; if (url) URL.revokeObjectURL(url); cachedCanvas = null; dialog.remove(); }, { once: true });
        dialog.showModal(); update(); return dialog;
    };

    P.openPhotoManagerExportSettings = function (items) {
        return this.openImageExportDialog(items.map((item, index) => ({ name: this.getPhotoManagerName(item) || item.defaultName || `画像${index + 1}`, render: async () => {
            if (this.getPhotoManagerExportMode() === 'withMarks' && item.annotated) {
                const src = await this.renderPhotoManagerImageWithMarks(item, 3200); const img = await this.loadPhotoManagerImage(src);
                const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; canvas.getContext('2d').drawImage(img, 0, 0); return canvas;
            }
            const img = await this.loadPhotoManagerImage(item.src), ratio = Math.min(1,3200/Math.max(img.naturalWidth,img.naturalHeight));
            const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(img.naturalWidth*ratio)); canvas.height = Math.max(1,Math.round(img.naturalHeight*ratio)); canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height); return canvas;
        }})), '写真管理');
    };
})();
