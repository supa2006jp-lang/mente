(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppPhotoManagerMethods extends MaintenanceApp {
        getMediaManagementCardColor() {
            const color = String(localStorage.getItem('media_management_card_color') || '').trim().toLowerCase();
            return /^#[0-9a-f]{6}$/.test(color) ? color : '';
        }

        getMediaManagementCardGradientSettings() {
            const color = String(localStorage.getItem('media_management_card_gradient_color') || '#bfdbfe').trim().toLowerCase();
            const angle = Number(localStorage.getItem('media_management_card_gradient_angle') || 135);
            const strength = Math.max(10, Math.min(100, Number(localStorage.getItem('media_management_card_gradient_strength') || 100)));
            return {
                enabled: localStorage.getItem('media_management_card_gradient_enabled') === '1',
                color: /^#[0-9a-f]{6}$/.test(color) ? color : '#bfdbfe',
                angle: [90, 135, 180, 225].includes(angle) ? angle : 135,
                strength: Number.isFinite(strength) ? strength : 100
            };
        }

        applyMediaManagementCardColor(color = this.getMediaManagementCardColor()) {
            const gradient = this.getMediaManagementCardGradientSettings();
            const requestedColor = /^#[0-9a-f]{6}$/i.test(String(color || '')) ? String(color).toLowerCase() : '';
            const safeColor = requestedColor || (gradient.enabled ? '#ffffff' : '');
            const root = document.documentElement;
            const body = document.body;
            if (safeColor) root.style.setProperty('--media-management-card-color', safeColor);
            else root.style.removeProperty('--media-management-card-color');
            root.style.setProperty('--media-management-card-gradient-color', gradient.color);
            root.style.setProperty('--media-management-card-gradient-angle', String(gradient.angle) + 'deg');
            root.style.setProperty('--media-management-card-gradient-strength', String(gradient.strength) + '%');
            body?.classList.toggle('media-management-card-color-active', Boolean(safeColor));
            body?.classList.toggle('media-management-card-gradient-active', gradient.enabled);
            const relativeLuminance = value => {
                const channels = [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)].map(item => parseInt(item, 16) / 255);
                const linear = channels.map(channel => channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4));
                return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
            };
            const primaryColor = safeColor || '#ffffff';
            const secondaryWeight = gradient.enabled ? gradient.strength / 200 : 0;
            const luminance = relativeLuminance(primaryColor) * (1 - secondaryWeight) + relativeLuminance(gradient.color) * secondaryWeight;
            const useLightText = Boolean(safeColor) && luminance < 0.24;
            body?.classList.toggle('media-management-card-color-dark', useLightText);
            if (body) body.dataset.mediaCardTextTone = useLightText ? 'light' : 'dark';
            const colorInput = document.getElementById('media-management-card-color');
            const gradientInput = document.getElementById('media-management-card-gradient-color');
            const angleInput = document.getElementById('media-management-card-gradient-angle');
            const strengthInput = document.getElementById('media-management-card-gradient-strength');
            const strengthValue = document.getElementById('media-management-card-gradient-strength-value');
            const toggle = document.getElementById('media-management-card-gradient-toggle');
            if (colorInput) colorInput.value = safeColor || '#ffffff';
            if (gradientInput) gradientInput.value = gradient.color;
            if (angleInput) angleInput.value = String(gradient.angle);
            if (strengthInput) strengthInput.value = String(gradient.strength);
            if (strengthValue) strengthValue.textContent = String(gradient.strength) + '%';
            if (toggle) {
                toggle.setAttribute('aria-pressed', gradient.enabled ? 'true' : 'false');
                toggle.closest('.media-card-color-control')?.classList.toggle('gradient-active', gradient.enabled);
            }
        }

        setMediaManagementCardColor(color = '') {
            const safeColor = /^#[0-9a-f]{6}$/i.test(String(color || '')) ? String(color).toLowerCase() : '#ffffff';
            localStorage.setItem('media_management_card_color', safeColor);
            this.applyMediaManagementCardColor(safeColor);
        }

        setMediaManagementCardGradientColor(color = '') {
            const safeColor = /^#[0-9a-f]{6}$/i.test(String(color || '')) ? String(color).toLowerCase() : '#bfdbfe';
            localStorage.setItem('media_management_card_gradient_color', safeColor);
            this.applyMediaManagementCardColor();
        }

        setMediaManagementCardGradientAngle(angle = 135) {
            const safeAngle = [90, 135, 180, 225].includes(Number(angle)) ? Number(angle) : 135;
            localStorage.setItem('media_management_card_gradient_angle', String(safeAngle));
            this.applyMediaManagementCardColor();
        }

        setMediaManagementCardGradientStrength(strength = 100) {
            const safeStrength = Math.max(10, Math.min(100, Number(strength) || 100));
            localStorage.setItem('media_management_card_gradient_strength', String(safeStrength));
            this.applyMediaManagementCardColor();
        }

        toggleMediaManagementCardGradient(force = null) {
            const current = this.getMediaManagementCardGradientSettings().enabled;
            const enabled = typeof force === 'boolean' ? force : !current;
            localStorage.setItem('media_management_card_gradient_enabled', enabled ? '1' : '0');
            if (enabled && !this.getMediaManagementCardColor()) localStorage.setItem('media_management_card_color', '#ffffff');
            this.applyMediaManagementCardColor();
        }

        resetMediaManagementCardColor() {
            ['media_management_card_color', 'media_management_card_gradient_enabled', 'media_management_card_gradient_color', 'media_management_card_gradient_angle', 'media_management_card_gradient_strength'].forEach(key => localStorage.removeItem(key));
            this.applyMediaManagementCardColor('');
        }
        ensurePhotoManagerData() {
            if (!store.activeData.photoManagerNames || typeof store.activeData.photoManagerNames !== 'object') {
                store.activeData.photoManagerNames = {};
            }
            if (!Array.isArray(store.activeData.photoManagerLibrary)) {
                store.activeData.photoManagerLibrary = [];
            }
            const clipboardNameCounts = new Map();
            store.activeData.photoManagerLibrary.forEach(photo => {
                if (String(photo?.name || '').trim() !== 'クリップボード画像') return;
                const timestamp = Number(photo.createdAt || photo.updatedAt) || Date.parse(photo.date || '') || Date.now();
                const prefix = this.formatPhotoManagerClipboardTimestamp(timestamp);
                const count = (clipboardNameCounts.get(prefix) || 0) + 1;
                clipboardNameCounts.set(prefix, count);
                photo.name = `${prefix} クリップボード画像${count > 1 ? ` (${count})` : ''}`;
            });
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
            } else if (store.activeData.photoManagerTrash.length > 15) {
                store.activeData.photoManagerTrash = store.activeData.photoManagerTrash.slice(0, 15);
            }
            if (!store.activeData.photoManagerTags || typeof store.activeData.photoManagerTags !== 'object') {
                store.activeData.photoManagerTags = {};
            }
            if (!store.activeData.photoManagerReadings || typeof store.activeData.photoManagerReadings !== 'object') {
                store.activeData.photoManagerReadings = {};
            }
            if (!store.activeData.photoManagerEditedAt || typeof store.activeData.photoManagerEditedAt !== 'object') {
                store.activeData.photoManagerEditedAt = {};
            }
            if (!store.activeData.photoManagerProtectedSources || typeof store.activeData.photoManagerProtectedSources !== 'object') {
                store.activeData.photoManagerProtectedSources = {};
            }
            if (!store.activeData.photoManagerTransparentSources || typeof store.activeData.photoManagerTransparentSources !== 'object') {
                store.activeData.photoManagerTransparentSources = {};
            }
            if (!store.activeData.photoManagerCompressedSources || typeof store.activeData.photoManagerCompressedSources !== 'object') {
                store.activeData.photoManagerCompressedSources = {};
            }
            if (!['ask', 'auto', 'compress', 'original'].includes(store.activeData.photoManagerNormalCompressionMode)) {
                store.activeData.photoManagerNormalCompressionMode = 'ask';
            }
            if (!Array.isArray(store.activeData.photoManagerVideos)) {
                store.activeData.photoManagerVideos = [];
            }
            if (!Array.isArray(store.activeData.photoManagerAudios)) {
                store.activeData.photoManagerAudios = [];
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

        getPhotoManagerVideos() {
            this.ensurePhotoManagerData();
            return store.activeData.photoManagerVideos;
        }

        getPhotoManagerAudios() {
            this.ensurePhotoManagerData();
            return store.activeData.photoManagerAudios;
        }

        getPhotoManagerAudio(id = '') {
            return this.getPhotoManagerAudios().find(audio => audio.id === String(id)) || null;
        }

        getPhotoManagerAudioMediaKey(id = '') {
            return `photo-manager-audio:${store.data.currentDepartmentId || 'dept_default'}:${String(id)}`;
        }

        isPhotoManagerAudioMediaKey(mediaKey = '') {
            const key = String(mediaKey || '');
            return !!key && this.getPhotoManagerAudios().some(audio => String(audio.mediaKey || '') === key);
        }

        registerPhotoManagerAudioReference(values = {}, options = {}) {
            const mediaKey = String(values.mediaKey || '');
            if (!mediaKey) return null;
            const audios = this.getPhotoManagerAudios();
            let item = audios.find(audio => String(audio.mediaKey || '') === mediaKey);
            if (!item) {
                item = {
                    id: String(values.id || `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
                    mediaKey,
                    createdAt: Date.now()
                };
                audios.unshift(item);
            }
            item.name = String(values.name || item.name || '音声').slice(0, 180);
            item.type = String(values.type || item.type || 'audio/webm').slice(0, 100);
            item.size = Math.max(0, Number(values.size ?? item.size) || 0);
            item.duration = Math.max(0, Number(values.duration ?? item.duration) || 0);
            item.updatedAt = Date.now();
            if (options.save !== false) store.save();
            return item;
        }

        syncCurrentPageAudiosToPhotoManagerDatabase() {
            const references = [];
            const visited = new WeakSet();
            const visit = value => {
                if (!value || typeof value !== 'object' || visited.has(value)) return;
                visited.add(value);
                if (value.recordedAudioKey && value.recordedAudioSource === 'file') references.push(value);
                if (Array.isArray(value)) value.forEach(visit);
                else Object.values(value).forEach(visit);
            };
            visit(store.activeData);
            if (typeof this.getShiftPhotoCompareAnimationAudioManagementItems === 'function') {
                (this.getShiftPhotoCompareAnimationAudioManagementItems() || []).forEach(({ entry }) => {
                    if (entry?.recordedAudioKey && entry.recordedAudioSource === 'file') references.push(entry);
                });
            }
            let added = 0;
            const seen = new Set();
            references.forEach(entry => {
                const mediaKey = String(entry.recordedAudioKey || '');
                if (!mediaKey || seen.has(mediaKey)) return;
                seen.add(mediaKey);
                if (this.isPhotoManagerAudioMediaKey(mediaKey)) return;
                this.registerPhotoManagerAudioReference({
                    mediaKey,
                    name: entry.recordedAudioName || entry.label || '音声ファイル',
                    type: entry.recordedAudioType,
                    size: entry.recordedAudioSize,
                    duration: entry.recordedAudioDuration
                }, { save: false });
                added += 1;
            });
            if (added) store.save();
            return added;
        }
        getPhotoManagerAudioUsageCount(mediaKey = '') {
            const target = String(mediaKey || '');
            if (!target) return 0;
            let count = 0;
            const visited = new WeakSet();
            const visit = value => {
                if (!value || typeof value !== 'object' || visited.has(value)) return;
                visited.add(value);
                if (String(value.recordedAudioKey || '') === target
                    || (value.source === 'audioDatabase' && String(value.mediaKey || '') === target)) count += 1;
                if (Array.isArray(value)) value.forEach(visit);
                else Object.values(value).forEach(visit);
            };
            visit(store.activeData);
            const loadedCount = typeof this.getShiftPhotoCompareAnimationAudioManagementItems === 'function'
                ? (this.getShiftPhotoCompareAnimationAudioManagementItems() || [])
                    .filter(item => String(item?.entry?.recordedAudioKey || '') === target).length
                : 0;
            return Math.max(count, loadedCount);
        }

        async importPhotoManagerAudios(fileList = []) {
            const files = Array.from(fileList || []).filter(file => String(file.type || '').startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|oga|webm|flac)$/i.test(file.name || ''));
            if (!files.length) return this.showPhotoManagerNotice?.('音声ファイルを選択してください。');
            let imported = 0;
            for (const file of files) {
                if (file.size > 100 * 1024 * 1024) continue;
                const id = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const mediaKey = this.getPhotoManagerAudioMediaKey(id);
                try {
                    let blob = file;
                    if (typeof this.compressShiftPhotoComparePageAudioFile === 'function') {
                        try {
                            const compressed = await this.compressShiftPhotoComparePageAudioFile(file);
                            if (compressed?.size && compressed.size < file.size) blob = compressed;
                        } catch (_) {}
                    }
                    const duration = typeof this.getShiftPhotoCompareAudioBlobDuration === 'function'
                        ? await this.getShiftPhotoCompareAudioBlobDuration(blob)
                        : 0;
                    await store.saveMediaBlob(mediaKey, blob);
                    this.registerPhotoManagerAudioReference({
                        id,
                        mediaKey,
                        name: file.name || '音声ファイル',
                        type: blob.type || file.type,
                        size: blob.size,
                        duration
                    }, { save: false });
                    imported += 1;
                } catch (_) {}
            }
            await store.save();
            this.openPhotoManagerAudios();
            this.showPhotoManagerNotice?.(imported ? `${imported}件の音声を登録しました。` : '音声を登録できませんでした。');
        }

        revokePhotoManagerAudioObjectUrls() {
            (this._photoManagerAudioObjectUrls || []).forEach(url => URL.revokeObjectURL(url));
            this._photoManagerAudioObjectUrls = [];
        }

        closePhotoManagerAudios(event = null) {
            if (event && event.target !== event.currentTarget) return;
            this.closePhotoManagerAudioUsage();
            this.closePhotoManagerAudioTranscriptHistory();
            const modal = document.getElementById('photo-manager-audio-modal');
            modal?.querySelectorAll('audio')?.forEach(audio => audio.pause());
            this.revokePhotoManagerAudioObjectUrls();
            modal?.remove();
        }

        async hydratePhotoManagerAudioCards() {
            const modal = document.getElementById('photo-manager-audio-modal');
            if (!modal) return;
            this.revokePhotoManagerAudioObjectUrls();
            for (const audioElement of modal.querySelectorAll('audio[data-audio-id]')) {
                const item = this.getPhotoManagerAudio(audioElement.dataset.audioId);
                if (!item) continue;
                try {
                    const blob = await store.loadMediaBlob(item.mediaKey);
                    if (!blob || !audioElement.isConnected) continue;
                    const url = URL.createObjectURL(blob);
                    this._photoManagerAudioObjectUrls.push(url);
                    audioElement.src = url;
                } catch (_) {
                    audioElement.closest('.photo-manager-audio-card')?.classList.add('missing');
                }
            }
        }

        openPhotoManagerAudios() {
            this.applyMediaManagementCardColor();
            this.syncCurrentPageAudiosToPhotoManagerDatabase();
            this.closePhotoManagerAudios();
            const audios = this.getPhotoManagerAudios();
            document.body.insertAdjacentHTML('beforeend', `
                <div id="photo-manager-audio-modal" class="photo-manager-video-modal photo-manager-audio-modal" onclick="app.closePhotoManagerAudios(event)">
                    <section class="photo-manager-video-panel photo-manager-audio-panel" onclick="event.stopPropagation()">
                        <header>
                            <div><strong><i class="fa-solid fa-headphones"></i> 音声管理</strong><small>${audios.length}件 / 登録音声の試聴・名前変更・削除</small></div>
                            <div class="photo-manager-video-header-actions">
                                <button type="button" class="secondary-btn photo-manager-audio-batch-recognize-btn" onclick="app.recognizeUnrecognizedPhotoManagerAudios(this)"><i class="fa-solid fa-wand-magic-sparkles"></i> 未認識を一括認識</button>
                                <button type="button" class="primary-btn" onclick="document.getElementById('photo-manager-audio-import-input')?.click()"><i class="fa-solid fa-plus"></i> 音声登録</button>
                                <button type="button" class="secondary-btn" onclick="app.closePhotoManagerAudios()" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        </header>
                        <div class="photo-manager-audio-search">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input type="search" placeholder="音声名・認識内容を検索" oninput="app.filterPhotoManagerAudios(this.value)" aria-label="音声を検索">
                            <select class="photo-manager-audio-status-filter" onchange="app.filterPhotoManagerAudios()" aria-label="認識状態"><option value="all">すべての状態</option><option value="unrecognized">未認識</option><option value="auto">自動認識</option><option value="manual">手動修正済み</option></select>
                            <select class="photo-manager-audio-sort" onchange="app.filterPhotoManagerAudios()" aria-label="並び順"><option value="recent">登録が新しい順</option><option value="name">名前順</option><option value="size">容量が大きい順</option><option value="usage">使用数が多い順</option><option value="status">認識状態順</option></select>
                            <span class="photo-manager-audio-search-count">${audios.length}件</span>
                        </div>
                        <div class="photo-manager-audio-list">
                            ${audios.length ? audios.map(audio => {
                                const usage = this.getPhotoManagerAudioUsageCount(audio.mediaKey);
                                return `<article class="photo-manager-audio-card" data-audio-id="${this.escapeHtml(audio.id)}">
                                    <i class="fa-solid fa-wave-square"></i>
                                    <div class="photo-manager-audio-main">
                                        <input type="text" maxlength="180" value="${this.escapeHtml(audio.name || '音声')}" aria-label="音声名">
                                        <audio controls preload="metadata" data-audio-id="${this.escapeHtml(audio.id)}"></audio>
                                        <div class="photo-manager-audio-facts"><small>${this.formatPhotoManagerBytes(audio.size || 0)} / ${this.formatPhotoManagerVideoDuration(audio.duration || 0)}</small>${usage ? `<button type="button" onclick="app.openPhotoManagerAudioUsage('${this.escapeJs(audio.id)}')"><i class="fa-solid fa-location-dot"></i> ${usage}ページで使用中</button>` : '<small>未使用</small>'}</div>
                                        <div class="photo-manager-audio-transcript" ${audio.transcript ? '' : 'hidden'}>
                                            <div class="photo-manager-audio-transcript-header"><strong>${audio.transcriptManuallyEdited ? '認識内容（手動修正済み）' : '認識内容'}</strong><div><button type="button" class="photo-manager-audio-transcript-rename-btn" onclick="app.renamePhotoManagerAudioFromCorrectedTranscript('${this.escapeJs(audio.id)}', this)" ${audio.transcriptManuallyEdited ? '' : 'hidden'}><i class="fa-solid fa-font"></i> 修正文から再命名</button><button type="button" class="photo-manager-audio-transcript-history-btn" onclick="app.openPhotoManagerAudioTranscriptHistory('${this.escapeJs(audio.id)}')" ${Array.isArray(audio.transcriptHistory) && audio.transcriptHistory.length ? '' : 'hidden'}><i class="fa-solid fa-clock-rotate-left"></i> 履歴</button><button type="button" class="photo-manager-audio-transcript-edit-btn" onclick="app.editPhotoManagerAudioTranscript('${this.escapeJs(audio.id)}', this)"><i class="fa-solid fa-pen"></i> 修正</button></div></div>
                                            <p>${this.escapeHtml(audio.transcript || '')}</p>
                                            <div class="photo-manager-audio-transcript-editor" hidden><textarea rows="4" maxlength="10000">${this.escapeHtml(audio.transcript || '')}</textarea><div><button type="button" class="primary-btn" onclick="app.savePhotoManagerAudioTranscript('${this.escapeJs(audio.id)}', this)"><i class="fa-solid fa-floppy-disk"></i> 修正を保存</button><button type="button" class="secondary-btn" onclick="app.cancelPhotoManagerAudioTranscriptEdit(this)">キャンセル</button></div></div>
                                        </div>
                                        <small class="photo-manager-audio-search-hit" hidden></small>
                                    </div>
                                    <div class="photo-manager-audio-actions">
                                        <button type="button" class="secondary-btn photo-manager-audio-transcribe-btn" onclick="app.renamePhotoManagerAudioFromContent('${this.escapeJs(audio.id)}', this)"><i class="fa-solid fa-wand-magic-sparkles"></i> 内容から命名</button>
                                        <button type="button" class="primary-btn" onclick="app.savePhotoManagerAudioName('${this.escapeJs(audio.id)}', this)"><i class="fa-solid fa-floppy-disk"></i> 名前保存</button>
                                        <button type="button" class="danger-btn" onclick="app.deletePhotoManagerAudio('${this.escapeJs(audio.id)}')" ${usage ? 'disabled title="使用中のため削除できません"' : ''}><i class="fa-solid fa-trash"></i></button>
                                        <small class="photo-manager-audio-transcription-status" aria-live="polite"></small>
                                    </div>
                                </article>`;
                            }).join('') : '<div class="photo-manager-video-empty"><i class="fa-solid fa-volume-xmark"></i><p>登録音声はありません。</p></div>'}
                            <div class="photo-manager-audio-search-empty" hidden><i class="fa-solid fa-magnifying-glass"></i><p>該当する音声はありません。</p></div>
                        </div>
                    </section>
                </div>`);
            this.filterPhotoManagerAudios();
            this.hydratePhotoManagerAudioCards();
        }

        async savePhotoManagerAudioName(id = '', button = null) {
            const item = this.getPhotoManagerAudio(id);
            const card = button?.closest?.('.photo-manager-audio-card');
            if (!item || !card) return;
            const requestedName = String(card.querySelector('input')?.value || item.name || '音声').trim().slice(0, 180);
            item.name = this.getUniquePhotoManagerAudioName(requestedName, item.id);
            const input = card.querySelector('input');
            if (input) input.value = item.name;
            item.updatedAt = Date.now();
            await store.save();
            this.filterPhotoManagerAudios();
            this.showPhotoManagerNotice?.('音声名を保存しました。');
        }

        filterPhotoManagerAudios(query = null) {
            const modal = document.getElementById('photo-manager-audio-modal');
            if (!modal) return;
            const searchInput = modal.querySelector('.photo-manager-audio-search input');
            const rawQuery = query === null ? String(searchInput?.value || '') : String(query || '');
            const needle = rawQuery.trim().toLocaleLowerCase('ja').replace(/[\s\u3000]+/g, '');
            const status = modal.querySelector('.photo-manager-audio-status-filter')?.value || 'all';
            const sort = modal.querySelector('.photo-manager-audio-sort')?.value || 'recent';
            const list = modal.querySelector('.photo-manager-audio-list');
            const empty = modal.querySelector('.photo-manager-audio-search-empty');
            const cards = [...modal.querySelectorAll('.photo-manager-audio-card[data-audio-id]')];
            const itemFor = card => this.getPhotoManagerAudio(card.dataset.audioId) || {};
            cards.sort((leftCard, rightCard) => {
                const left = itemFor(leftCard);
                const right = itemFor(rightCard);
                if (sort === 'name') return String(left.name || '').localeCompare(String(right.name || ''), 'ja', { numeric: true });
                if (sort === 'size') return (Number(right.size) || 0) - (Number(left.size) || 0);
                if (sort === 'usage') return this.getPhotoManagerAudioUsageCount(right.mediaKey) - this.getPhotoManagerAudioUsageCount(left.mediaKey);
                if (sort === 'status') {
                    const rank = item => item.transcriptManuallyEdited ? 2 : (item.transcript ? 1 : 0);
                    return rank(right) - rank(left) || String(left.name || '').localeCompare(String(right.name || ''), 'ja');
                }
                return (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0);
            });
            cards.forEach(card => list?.insertBefore(card, empty || null));
            let visible = 0;
            cards.forEach(card => {
                const item = itemFor(card);
                const haystack = `${item.name || ''} ${item.transcript || ''}`.toLocaleLowerCase('ja').replace(/[\s\u3000]+/g, '');
                const queryMatched = !needle || haystack.includes(needle);
                const statusMatched = status === 'all'
                    || (status === 'unrecognized' && !item.transcript)
                    || (status === 'auto' && !!item.transcript && !item.transcriptManuallyEdited)
                    || (status === 'manual' && !!item.transcriptManuallyEdited);
                const matched = queryMatched && statusMatched;
                card.hidden = !matched;
                const hit = card.querySelector('.photo-manager-audio-search-hit');
                if (hit) {
                    hit.hidden = !needle || !matched;
                    hit.innerHTML = needle && matched ? this.getPhotoManagerAudioSearchPreviewHtml(item, rawQuery) : '';
                }
                if (matched) visible += 1;
            });
            const total = cards.length;
            const count = modal.querySelector('.photo-manager-audio-search-count');
            if (count) count.textContent = (needle || status !== 'all') ? `${visible}/${total}件` : `${visible}件`;
            if (empty) empty.hidden = visible > 0 || !total;
        }

        getPhotoManagerAudioSearchPreviewHtml(item = {}, query = '') {
            const transcript = String(item.transcript || '');
            const name = String(item.name || '');
            const transcriptRange = this.getPhotoManagerAudioSearchMatchRange(transcript, query);
            const source = transcriptRange ? transcript : name;
            const label = transcriptRange ? '認識内容' : '音声名';
            const range = transcriptRange || this.getPhotoManagerAudioSearchMatchRange(name, query);
            if (!range) return '';
            const chars = Array.from(source);
            const start = Math.max(0, range.start - 32);
            const end = Math.min(chars.length, range.end + 48);
            const before = `${start > 0 ? '…' : ''}${chars.slice(start, range.start).join('')}`;
            const match = chars.slice(range.start, range.end).join('');
            const after = `${chars.slice(range.end, end).join('')}${end < chars.length ? '…' : ''}`;
            return `<span>${label}:</span> ${this.escapeHtml(before)}<mark>${this.escapeHtml(match)}</mark>${this.escapeHtml(after)}`;
        }

        getPhotoManagerAudioSearchMatchRange(text = '', query = '') {
            const chars = Array.from(String(text || ''));
            const compactChars = [];
            const originalIndexes = [];
            chars.forEach((char, index) => {
                if (/[\s\u3000]/.test(char)) return;
                for (const normalized of Array.from(char.toLocaleLowerCase('ja'))) {
                    compactChars.push(normalized);
                    originalIndexes.push(index);
                }
            });
            const needle = Array.from(String(query || '').trim().toLocaleLowerCase('ja')).filter(char => !/[\s\u3000]/.test(char));
            if (!needle.length || needle.length > compactChars.length) return null;
            let position = -1;
            for (let index = 0; index <= compactChars.length - needle.length; index += 1) {
                if (needle.every((char, offset) => compactChars[index + offset] === char)) {
                    position = index;
                    break;
                }
            }
            if (position < 0) return null;
            return {
                start: originalIndexes[position],
                end: originalIndexes[position + needle.length - 1] + 1
            };
        }

        getUniquePhotoManagerAudioName(name = '', currentId = '') {
            const requested = String(name || '音声').trim().slice(0, 180) || '音声';
            const match = requested.match(/^(.*?)(\.(?:wav|mp3|m4a|aac|ogg|webm|flac))$/i);
            const base = (match?.[1] || requested).slice(0, 165);
            const extension = match?.[2] || '';
            const used = new Set(this.getPhotoManagerAudios()
                .filter(audio => String(audio.id) !== String(currentId))
                .map(audio => String(audio.name || '').trim().toLocaleLowerCase('ja')));
            if (!used.has(requested.toLocaleLowerCase('ja'))) return requested;
            let number = 2;
            let candidate = '';
            do {
                candidate = `${base}_${number}${extension}`;
                number += 1;
            } while (used.has(candidate.toLocaleLowerCase('ja')));
            return candidate.slice(0, 180);
        }

        async renamePhotoManagerAudioFromCorrectedTranscript(id = '', button = null) {
            const item = this.getPhotoManagerAudio(id);
            const card = button?.closest?.('.photo-manager-audio-card');
            if (!item || !card || !item.transcript) return;
            const recognizedName = this.getPhotoManagerTranscribedAudioName(item, item.transcript);
            if (!recognizedName) return this.showPhotoManagerNotice?.('名前に使える修正文がありません。');
            item.name = this.getUniquePhotoManagerAudioName(recognizedName, item.id);
            item.updatedAt = Date.now();
            const input = card.querySelector('.photo-manager-audio-main > input');
            if (input) input.value = item.name;
            await store.save();
            this.filterPhotoManagerAudios();
            this.showPhotoManagerNotice?.(`「${item.name}」に変更しました。`);
        }

        appendPhotoManagerAudioTranscriptHistory(item = {}, text = '', manuallyEdited = false) {
            const value = String(text || '').trim();
            if (!value) return false;
            if (!Array.isArray(item.transcriptHistory)) item.transcriptHistory = [];
            item.transcriptHistory.unshift({
                id: `audio-transcript-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                text: value.slice(0, 10000),
                manuallyEdited: !!manuallyEdited,
                savedAt: Date.now()
            });
            item.transcriptHistory = item.transcriptHistory.slice(0, 20);
            return true;
        }

        closePhotoManagerAudioTranscriptHistory(event = null) {
            if (event && event.target !== event.currentTarget) return;
            document.getElementById('photo-manager-audio-transcript-history-modal')?.remove();
        }

        openPhotoManagerAudioTranscriptHistory(id = '') {
            const item = this.getPhotoManagerAudio(id);
            if (!item) return;
            this.closePhotoManagerAudioTranscriptHistory();
            const history = Array.isArray(item.transcriptHistory) ? item.transcriptHistory : [];
            document.body.insertAdjacentHTML('beforeend', `
                <div id="photo-manager-audio-transcript-history-modal" class="photo-manager-audio-transcript-history-modal" onclick="app.closePhotoManagerAudioTranscriptHistory(event)">
                    <section onclick="event.stopPropagation()">
                        <header><div><strong><i class="fa-solid fa-clock-rotate-left"></i> 認識内容の履歴</strong><small>${this.escapeHtml(item.name || '音声')} / 最大20件</small></div><button type="button" onclick="app.closePhotoManagerAudioTranscriptHistory()" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button></header>
                        <div class="photo-manager-audio-transcript-history-current"><strong>現在の内容${item.transcriptManuallyEdited ? '（手動修正済み）' : ''}</strong><p>${this.escapeHtml(item.transcript || '')}</p></div>
                        <div class="photo-manager-audio-transcript-history-list">
                            ${history.length ? history.map(entry => `<article><div><strong>${entry.manuallyEdited ? '手動修正版' : '自動認識版'}</strong><time>${this.escapeHtml(new Date(Number(entry.savedAt) || Date.now()).toLocaleString('ja-JP'))}</time><p>${this.escapeHtml(entry.text || '')}</p></div><button type="button" onclick="app.restorePhotoManagerAudioTranscript('${this.escapeJs(item.id)}', '${this.escapeJs(entry.id)}')"><i class="fa-solid fa-rotate-left"></i> この内容に戻す</button></article>`).join('') : '<div class="photo-manager-audio-usage-unavailable">保存された履歴はありません。</div>'}
                        </div>
                    </section>
                </div>`);
        }

        async restorePhotoManagerAudioTranscript(id = '', historyId = '') {
            const item = this.getPhotoManagerAudio(id);
            const history = Array.isArray(item?.transcriptHistory) ? item.transcriptHistory : [];
            const target = history.find(entry => String(entry.id) === String(historyId));
            if (!item || !target) return;
            this.appendPhotoManagerAudioTranscriptHistory(item, item.transcript, item.transcriptManuallyEdited);
            item.transcript = String(target.text || '').slice(0, 10000);
            item.transcriptManuallyEdited = !!target.manuallyEdited;
            item.updatedAt = Date.now();
            await store.save();
            this.closePhotoManagerAudioTranscriptHistory();
            this.openPhotoManagerAudios();
            this.showPhotoManagerNotice?.('認識内容を履歴から復元しました。');
        }

        editPhotoManagerAudioTranscript(id = '', button = null) {
            const item = this.getPhotoManagerAudio(id);
            const box = button?.closest?.('.photo-manager-audio-transcript');
            if (!item || !box) return;
            const editor = box.querySelector('.photo-manager-audio-transcript-editor');
            const textarea = editor?.querySelector('textarea');
            if (!editor || !textarea) return;
            textarea.value = String(item.transcript || '');
            editor.hidden = false;
            box.querySelector('p')?.setAttribute('hidden', '');
            button.hidden = true;
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }

        cancelPhotoManagerAudioTranscriptEdit(button = null) {
            const box = button?.closest?.('.photo-manager-audio-transcript');
            if (!box) return;
            box.querySelector('.photo-manager-audio-transcript-editor')?.setAttribute('hidden', '');
            box.querySelector('p')?.removeAttribute('hidden');
            const editButton = box.querySelector('.photo-manager-audio-transcript-edit-btn');
            if (editButton) editButton.hidden = false;
        }

        async savePhotoManagerAudioTranscript(id = '', button = null) {
            const item = this.getPhotoManagerAudio(id);
            const box = button?.closest?.('.photo-manager-audio-transcript');
            const textarea = box?.querySelector?.('textarea');
            const transcript = String(textarea?.value || '').trim();
            if (!item || !box || !textarea) return;
            if (!transcript) return this.showPhotoManagerNotice?.('認識内容を入力してください。');
            button.disabled = true;
            try {
                if (String(item.transcript || '') !== transcript || !item.transcriptManuallyEdited) {
                    this.appendPhotoManagerAudioTranscriptHistory(item, item.transcript, item.transcriptManuallyEdited);
                }
                item.transcript = transcript.slice(0, 10000);
                item.transcriptManuallyEdited = true;
                item.updatedAt = Date.now();
                const label = box.querySelector('.photo-manager-audio-transcript-header strong');
                const paragraph = box.querySelector('p');
                if (label) label.textContent = '認識内容（手動修正済み）';
                if (paragraph) paragraph.textContent = item.transcript;
                const renameButton = box.querySelector('.photo-manager-audio-transcript-rename-btn');
                if (renameButton) renameButton.hidden = false;
                const historyButton = box.querySelector('.photo-manager-audio-transcript-history-btn');
                if (historyButton) historyButton.hidden = !(item.transcriptHistory?.length);
                await store.save();
                this.cancelPhotoManagerAudioTranscriptEdit(button);
                this.filterPhotoManagerAudios();
                this.showPhotoManagerNotice?.('認識内容の修正を保存しました。');
            } finally {
                if (button.isConnected) button.disabled = false;
            }
        }

        getPhotoManagerAudioTranscriberWorker() {
            if (this._photoManagerAudioTranscriberWorker) return this._photoManagerAudioTranscriberWorker;
            const worker = new Worker('audio-transcriber-worker.js?v=20260815-local-audio-name1', { type: 'module' });
            this._photoManagerAudioTranscriptionRequests = new Map();
            worker.onmessage = event => {
                const data = event.data || {};
                if (data.type === 'progress') {
                    const progress = Number(data.progress?.progress);
                    const label = Number.isFinite(progress) ? `モデル準備 ${Math.round(progress)}%` : 'モデルを準備中...';
                    this._photoManagerAudioTranscriptionRequests.forEach(request => request.onProgress?.(label));
                    return;
                }
                const request = this._photoManagerAudioTranscriptionRequests.get(data.requestId);
                if (!request) return;
                if (data.type === 'recognizing') {
                    request.onProgress?.('音声を認識中...');
                    return;
                }
                this._photoManagerAudioTranscriptionRequests.delete(data.requestId);
                if (data.type === 'result') request.resolve(String(data.text || ''));
                else request.reject(new Error(data.message || '音声を認識できませんでした。'));
            };
            worker.onerror = event => {
                const requests = [...this._photoManagerAudioTranscriptionRequests.values()];
                this._photoManagerAudioTranscriptionRequests.clear();
                worker.terminate();
                this._photoManagerAudioTranscriberWorker = null;
                requests.forEach(request => {
                    request.onProgress?.('互換モードで準備中...');
                    this.transcribePhotoManagerAudioOnMainThread(request.audioData, request.onProgress)
                        .then(request.resolve)
                        .catch(error => request.reject(new Error(error?.message || event?.message || '音声認識を開始できませんでした。')));
                });
            };
            this._photoManagerAudioTranscriberWorker = worker;
            return worker;
        }

        async decodePhotoManagerAudioForTranscription(blob) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            if (!AudioContextClass || !OfflineAudioContextClass) throw new Error('このブラウザは端末内音声認識に対応していません。');
            const context = new AudioContextClass();
            try {
                const decoded = await context.decodeAudioData(await blob.arrayBuffer());
                const frameCount = Math.max(1, Math.ceil(decoded.duration * 16000));
                const offline = new OfflineAudioContextClass(1, frameCount, 16000);
                const source = offline.createBufferSource();
                source.buffer = decoded;
                source.connect(offline.destination);
                source.start(0);
                const rendered = await offline.startRendering();
                return rendered.getChannelData(0).slice();
            } finally {
                await context.close().catch(() => {});
            }
        }

        transcribePhotoManagerAudio(audioData, onProgress = null) {
            const worker = this.getPhotoManagerAudioTranscriberWorker();
            const requestId = `audio-transcribe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            return new Promise((resolve, reject) => {
                this._photoManagerAudioTranscriptionRequests.set(requestId, { resolve, reject, onProgress, audioData });
                worker.postMessage({ requestId, audioBuffer: audioData.buffer });
            });
        }

        async transcribePhotoManagerAudioOnMainThread(audioData, onProgress = null) {
            if (!this._photoManagerAudioMainTranscriberPromise) {
                this._photoManagerAudioMainTranscriberPromise = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1')
                    .then(({ pipeline, env }) => {
                        env.allowLocalModels = false;
                        return pipeline('automatic-speech-recognition', 'onnx-community/whisper-tiny', {
                            dtype: 'q8',
                            progress_callback: progress => {
                                const value = Number(progress?.progress);
                                onProgress?.(Number.isFinite(value) ? `モデル準備 ${Math.round(value)}%` : 'モデルを準備中...');
                            }
                        });
                    })
                    .catch(error => {
                        this._photoManagerAudioMainTranscriberPromise = null;
                        throw error;
                    });
            }
            const transcriber = await this._photoManagerAudioMainTranscriberPromise;
            onProgress?.('音声を認識中...');
            const result = await transcriber(audioData, { language: 'japanese', task: 'transcribe' });
            return String(result?.text || '').trim();
        }

        getPhotoManagerTranscribedAudioName(item = {}, transcript = '') {
            const compact = String(transcript || '')
                .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
                .replace(/[\s\u3000、。！？,.!?・「」『』（）()\[\]【】]/g, '');
            const head = Array.from(compact).slice(0, 6).join('');
            if (!head) return '';
            const currentExtension = String(item.name || '').match(/\.(wav|mp3|m4a|aac|ogg|webm|flac)$/i)?.[0];
            const type = String(item.type || '').toLowerCase();
            const inferredExtension = type.includes('mpeg') ? '.mp3'
                : type.includes('mp4') ? '.m4a'
                    : type.includes('ogg') ? '.ogg'
                        : type.includes('webm') ? '.webm'
                            : type.includes('flac') ? '.flac'
                                : type.includes('aac') ? '.aac' : '.wav';
            return `${head}${currentExtension || inferredExtension}`;
        }

        async recognizeUnrecognizedPhotoManagerAudios(button = null) {
            const targets = this.getPhotoManagerAudios().filter(audio => !String(audio.transcript || '').trim());
            if (!targets.length) return this.showPhotoManagerNotice?.('未認識の音声はありません。');
            if (!button || button.disabled) return;
            const originalHtml = button.innerHTML;
            button.disabled = true;
            let completed = 0;
            let failed = 0;
            try {
                for (let index = 0; index < targets.length; index += 1) {
                    if (!button.isConnected) break;
                    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${index + 1}/${targets.length}件`;
                    const card = [...document.querySelectorAll('#photo-manager-audio-modal .photo-manager-audio-card[data-audio-id]')]
                        .find(targetCard => String(targetCard.dataset.audioId) === String(targets[index].id));
                    const recognizeButton = card?.querySelector('.photo-manager-audio-transcribe-btn');
                    const succeeded = recognizeButton
                        ? await this.renamePhotoManagerAudioFromContent(targets[index].id, recognizeButton)
                        : false;
                    if (succeeded) completed += 1;
                    else failed += 1;
                }
                this.showPhotoManagerNotice?.(failed
                    ? `${completed}件を認識しました。${failed}件は認識できませんでした。`
                    : `${completed}件の認識と命名が完了しました。`);
            } finally {
                if (button.isConnected) {
                    button.disabled = false;
                    button.innerHTML = originalHtml;
                }
            }
        }

        async renamePhotoManagerAudioFromContent(id = '', button = null) {
            const item = this.getPhotoManagerAudio(id);
            const card = button?.closest?.('.photo-manager-audio-card');
            const status = card?.querySelector?.('.photo-manager-audio-transcription-status');
            if (!item || !card || !button || button.disabled) return;
            const setStatus = message => { if (status?.isConnected) status.textContent = message; };
            const originalHtml = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 準備中';
            setStatus('音声を読み込み中...');
            try {
                const blob = await store.loadMediaBlob(item.mediaKey);
                if (!blob) throw new Error('音声データが見つかりません。');
                const audioData = await this.decodePhotoManagerAudioForTranscription(blob);
                const transcript = await this.transcribePhotoManagerAudio(audioData, message => {
                    setStatus(message);
                    if (button.isConnected) button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${this.escapeHtml(message)}`;
                });
                const recognizedName = this.getPhotoManagerTranscribedAudioName(item, transcript);
                if (!recognizedName) throw new Error('音声の内容を認識できませんでした。');
                const nextName = this.getUniquePhotoManagerAudioName(recognizedName, item.id);
                if (item.transcript && (String(item.transcript) !== String(transcript) || item.transcriptManuallyEdited)) {
                    this.appendPhotoManagerAudioTranscriptHistory(item, item.transcript, item.transcriptManuallyEdited);
                }
                item.name = nextName;
                item.transcript = transcript;
                item.transcriptManuallyEdited = false;
                item.updatedAt = Date.now();
                const input = card.querySelector('input');
                if (input) input.value = nextName;
                const transcriptBox = card.querySelector('.photo-manager-audio-transcript');
                if (transcriptBox) {
                    transcriptBox.hidden = false;
                    const label = transcriptBox.querySelector('.photo-manager-audio-transcript-header strong');
                    if (label) label.textContent = '認識内容';
                    const renameButton = transcriptBox.querySelector('.photo-manager-audio-transcript-rename-btn');
                    if (renameButton) renameButton.hidden = true;
                    const historyButton = transcriptBox.querySelector('.photo-manager-audio-transcript-history-btn');
                    if (historyButton) historyButton.hidden = !(item.transcriptHistory?.length);
                    const paragraph = transcriptBox.querySelector('p');
                    if (paragraph) paragraph.textContent = transcript;
                }
                await store.save();
                this.filterPhotoManagerAudios();
                setStatus('認識内容を保存しました。');
                this.showPhotoManagerNotice?.(`「${nextName}」に変更しました。`);
                return true;
            } catch (error) {
                setStatus(error?.message || '音声を認識できませんでした。');
                this.showPhotoManagerNotice?.(error?.message || '音声を認識できませんでした。');
                return false;
            } finally {
                if (button.isConnected) {
                    button.disabled = false;
                    button.innerHTML = originalHtml;
                }
            }
        }

        getPhotoManagerAudioUsageLocations(mediaKey = '') {
            const target = String(mediaKey || '');
            if (!target || typeof this.getShiftPhotoCompareAnimationAudioManagementItems !== 'function') return [];
            return (this.getShiftPhotoCompareAnimationAudioManagementItems() || [])
                .filter(item => String(item?.entry?.recordedAudioKey || '') === target)
                .map(item => ({
                    animationPageIndex: Number(item.animationPageIndex) || 0,
                    entryId: String(item.entry?.id || ''),
                    location: String(item.location || `${Number(item.animationPageIndex) + 1}P`),
                    label: String(item.entry?.label || item.entry?.sourceLabel || '読み上げページ')
                }));
        }

        closePhotoManagerAudioUsage(event = null) {
            if (event && event.target !== event.currentTarget) return;
            document.getElementById('photo-manager-audio-usage-modal')?.remove();
        }

        openPhotoManagerAudioUsage(id = '') {
            const item = this.getPhotoManagerAudio(id);
            if (!item) return;
            this.closePhotoManagerAudioUsage();
            const total = this.getPhotoManagerAudioUsageCount(item.mediaKey);
            const locations = this.getPhotoManagerAudioUsageLocations(item.mediaKey);
            const unavailable = Math.max(0, total - locations.length);
            document.body.insertAdjacentHTML('beforeend', `
                <div id="photo-manager-audio-usage-modal" class="photo-manager-audio-usage-modal" onclick="app.closePhotoManagerAudioUsage(event)">
                    <section onclick="event.stopPropagation()">
                        <header><div><strong><i class="fa-solid fa-location-dot"></i> 使用場所</strong><small>${this.escapeHtml(item.name || '音声')} / ${total}ページ</small></div><button type="button" onclick="app.closePhotoManagerAudioUsage()" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button></header>
                        <div class="photo-manager-audio-usage-list">
                            ${locations.map(location => `<article><div><strong>${this.escapeHtml(location.location)}</strong><small>${this.escapeHtml(location.label)}</small></div><div class="photo-manager-audio-usage-actions"><button type="button" onclick="app.jumpToPhotoManagerAudioUsage(${location.animationPageIndex}, '${this.escapeJs(location.entryId)}')"><i class="fa-solid fa-arrow-up-right-from-square"></i> 開く</button><button type="button" class="danger" onclick="app.detachPhotoManagerAudioUsage('${this.escapeJs(item.id)}', ${location.animationPageIndex}, '${this.escapeJs(location.entryId)}')"><i class="fa-solid fa-link-slash"></i> 解除</button></div></article>`).join('')}
                            ${unavailable ? `<div class="photo-manager-audio-usage-unavailable"><i class="fa-solid fa-circle-info"></i><span>ほか${unavailable}ページで使用中です。該当するアニメを開くと移動できます。</span></div>` : ''}
                            ${!total ? '<div class="photo-manager-audio-usage-unavailable">この音声は使用されていません。</div>' : ''}
                        </div>
                    </section>
                </div>`);
        }

        async detachPhotoManagerAudioUsage(audioId = '', animationPageIndex = 0, entryId = '') {
            const audio = this.getPhotoManagerAudio(audioId);
            const usage = typeof this.getShiftPhotoCompareAnimationAudioManagementItem === 'function'
                ? this.getShiftPhotoCompareAnimationAudioManagementItem(Number(animationPageIndex) || 0, String(entryId || ''))
                : null;
            if (!audio || !usage || String(usage.entry?.recordedAudioKey || '') !== String(audio.mediaKey || '')) {
                return this.showPhotoManagerNotice?.('この使用場所を確認できませんでした。');
            }
            if (!confirm(`${usage.location}から「${audio.name || '音声'}」を解除しますか？\n音声DBの登録データは削除されません。`)) return;
            const saved = this.persistShiftPhotoCompareAnimationPageRecording?.(usage.entry, {
                key: '', type: '', name: '', source: '', size: 0, duration: 0, trimStart: 0, trimEnd: 0
            }, usage.page);
            if (!saved) return this.showPhotoManagerNotice?.('ページから音声を解除できませんでした。');
            await (this._shiftPhotoComparePageAudioSavePromise || Promise.resolve(store.save())).catch(() => null);
            this.renderShiftPhotoCompareAnimationTimeline?.();
            this.openPhotoManagerAudios();
            this.openPhotoManagerAudioUsage(audioId);
            this.showPhotoManagerNotice?.(`${usage.location}から音声を解除しました。`);
        }

        jumpToPhotoManagerAudioUsage(animationPageIndex = 0, entryId = '') {
            if (typeof this.activateShiftPhotoCompareAnimationPage !== 'function'
                || !this._shiftPhotoCompareAnimationState?.overlay) {
                return this.showPhotoManagerNotice?.('先に音声を使用しているアニメを開いてください。');
            }
            this.closePhotoManagerAudioUsage();
            this.closePhotoManagerAudios();
            if (!this.activateShiftPhotoCompareAnimationPage(Number(animationPageIndex) || 0)) {
                return this.showPhotoManagerNotice?.('使用先ページを開けませんでした。');
            }
            requestAnimationFrame(() => this.previewShiftPhotoCompareAnimationTimelineEntry?.(String(entryId || '')));
        }

        async deletePhotoManagerAudio(id = '') {
            const item = this.getPhotoManagerAudio(id);
            if (!item) return;
            const usage = this.getPhotoManagerAudioUsageCount(item.mediaKey);
            if (usage) return this.showPhotoManagerNotice?.(`この音声は${usage}ページで使用中のため削除できません。`);
            if (!confirm(`${item.name || '音声'}を音声DBから削除しますか？`)) return;
            store.activeData.photoManagerAudios = this.getPhotoManagerAudios().filter(audio => audio.id !== item.id);
            await store.deleteMediaBlob(item.mediaKey).catch(() => false);
            await store.save();
            this.openPhotoManagerAudios();
            this.showPhotoManagerNotice?.('音声を削除しました。');
        }
        getPhotoManagerVideo(id = '') {
            return this.getPhotoManagerVideos().find(video => video.id === String(id)) || null;
        }

        getPhotoManagerVideoMediaKey(id = '') {
            return `video:${store.data.currentDepartmentId || 'dept_default'}:${String(id)}`;
        }

        getPhotoManagerVideoMaxBytes() {
            return 100 * 1024 * 1024;
        }

        formatPhotoManagerVideoDuration(seconds = 0) {
            const value = Math.max(0, Number(seconds) || 0);
            const minutes = Math.floor(value / 60);
            const remain = value - minutes * 60;
            return `${minutes}:${remain.toFixed(1).padStart(4, '0')}`;
        }

        getPhotoManagerVideoTrimSummary(video = {}) {
            const start = Math.max(0, Number(video.trimStart) || 0);
            const end = Math.max(0, Number(video.trimEnd) || 0);
            const duration = Math.max(0, Number(video.duration) || 0);
            if (end > start) return this.formatPhotoManagerVideoDuration(end - start);
            if (duration > start) return this.formatPhotoManagerVideoDuration(duration - start);
            if (start > 0) return `${this.formatPhotoManagerVideoTimeInput(start)}から最後まで`;
            return '';
        }
        readPhotoManagerVideoMetadata(file) {
            return new Promise((resolve, reject) => {
                const url = URL.createObjectURL(file);
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => {
                    const result = {
                        duration: Math.max(0, Number(video.duration) || 0),
                        width: Math.max(0, Number(video.videoWidth) || 0),
                        height: Math.max(0, Number(video.videoHeight) || 0)
                    };
                    URL.revokeObjectURL(url);
                    resolve(result);
                };
                video.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error('動画情報を読み込めませんでした。'));
                };
                video.src = url;
            });
        }

        normalizePhotoManagerVideoUrl(value = '') {
            const raw = String(value || '').trim();
            let url;
            try { url = new URL(raw); } catch { return null; }
            if (!['http:', 'https:'].includes(url.protocol)) return null;
            const host = url.hostname.toLowerCase().replace(/^www\./, '');
            let youtubeId = '';
            if (host === 'youtu.be') youtubeId = url.pathname.split('/').filter(Boolean)[0] || '';
            else if (host.endsWith('youtube.com')) {
                if (url.pathname === '/watch') youtubeId = url.searchParams.get('v') || '';
                else youtubeId = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] || '';
            }
            if (/^[a-zA-Z0-9_-]{6,20}$/.test(youtubeId)) {
                return {
                    sourceType: 'youtube',
                    sourceUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
                    youtubeId,
                    thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
                };
            }
            return {
                sourceType: 'url',
                sourceUrl: url.href,
                youtubeId: '',
                thumbnailUrl: ''
            };
        }

        getPhotoManagerYouTubeEmbedUrl(videoId = '', enableApi = false, showControls = true) {
            const id = String(videoId || '').replace(/[^a-zA-Z0-9_-]/g, '');
            if (!id) return '';
            const params = new URLSearchParams({
                playsinline: '1',
                rel: '0'
            });
            if (enableApi) params.set('enablejsapi', '1');
            if (!showControls) params.set('controls', '0');
            const origin = window.location?.origin;
            if (origin && origin !== 'null' && /^https?:\/\//i.test(origin)) {
                params.set('origin', origin);
                params.set('widget_referrer', window.location.href.split('#')[0]);
            }
            return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
        }

        readPhotoManagerVideoUrlMetadata(sourceUrl = '') {
            return new Promise(resolve => {
                const video = document.createElement('video');
                let settled = false;
                const finish = metadata => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    video.removeAttribute('src');
                    resolve(metadata);
                };
                const timer = window.setTimeout(() => finish({ duration: 0, width: 1280, height: 720 }), 6000);
                video.preload = 'metadata';
                video.onloadedmetadata = () => finish({
                    duration: Math.max(0, Number(video.duration) || 0),
                    width: Math.max(0, Number(video.videoWidth) || 1280),
                    height: Math.max(0, Number(video.videoHeight) || 720)
                });
                video.onerror = () => finish({ duration: 0, width: 1280, height: 720 });
                video.src = sourceUrl;
            });
        }

        async registerPhotoManagerVideoUrl() {
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            const urlInput = panel?.querySelector('.photo-manager-video-url-input');
            const nameInput = panel?.querySelector('.photo-manager-video-url-name');
            const normalized = this.normalizePhotoManagerVideoUrl(urlInput?.value || '');
            if (!normalized) {
                this.showPhotoManagerNotice('YouTubeまたは動画の有効なURLを入力してください。');
                urlInput?.focus();
                return;
            }
            const button = panel.querySelector('.photo-manager-video-url-register');
            if (button) button.disabled = true;
            try {
                const metadata = normalized.sourceType === 'youtube'
                    ? { duration: 0, width: 1280, height: 720 }
                    : await this.readPhotoManagerVideoUrlMetadata(normalized.sourceUrl);
                const now = Date.now();
                const id = `pmv-${now.toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
                const fallbackName = normalized.sourceType === 'youtube' ? 'YouTube動画' : 'URL動画';
                this.getPhotoManagerVideos().unshift({
                    id,
                    name: String(nameInput?.value || fallbackName).trim().slice(0, 100) || fallbackName,
                    fileName: '',
                    type: normalized.sourceType === 'youtube' ? 'video/youtube' : 'video/url',
                    size: 0,
                    duration: metadata.duration,
                    width: metadata.width,
                    height: metadata.height,
                    trimStart: 0,
                    trimEnd: metadata.duration,
                    animationClickMode: 'continue',
                    audioRemovedByTrim: false,
                    ...normalized,
                    createdAt: now,
                    updatedAt: now
                });
                await store.save();
                this.openPhotoManagerVideos();
                this.showPhotoManagerNotice('URL動画を登録しました。');
            } finally {
                if (button && document.contains(button)) button.disabled = false;
            }
        }

        async importPhotoManagerVideos(files = []) {
            const targets = Array.from(files || []).filter(file => file?.type?.startsWith?.('video/'));
            if (!targets.length) return;
            const maxBytes = this.getPhotoManagerVideoMaxBytes();
            let saved = 0;
            const rejected = [];
            for (const file of targets) {
                if (file.size > maxBytes) {
                    rejected.push(`${file.name}（${this.formatPhotoManagerBytes(file.size)}）`);
                    continue;
                }
                try {
                    const metadata = await this.readPhotoManagerVideoMetadata(file);
                    const id = `pmv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
                    await store.saveMediaBlob(this.getPhotoManagerVideoMediaKey(id), file);
                    const now = Date.now();
                    this.getPhotoManagerVideos().unshift({
                        id,
                        name: String(file.name || '動画').replace(/\.[^.]+$/, '').slice(0, 100),
                        fileName: String(file.name || 'video').slice(0, 180),
                        type: file.type || 'video/mp4',
                        size: file.size,
                        duration: metadata.duration,
                        width: metadata.width,
                        height: metadata.height,
                        trimStart: 0,
                        trimEnd: metadata.duration,
                        animationClickMode: 'continue',
                        audioRemovedByTrim: false,
                        createdAt: now,
                        updatedAt: now
                    });
                    saved += 1;
                } catch (error) {
                    console.warn('Video import failed', error);
                    rejected.push(file.name || '動画');
                }
            }
            if (saved) await store.save();
            this.openPhotoManagerVideos();
            if (rejected.length) {
                this.showPhotoManagerNotice(`100MBを超える、または読み込めない動画は登録できません: ${rejected.join('、')}`);
            } else if (saved) {
                this.showPhotoManagerNotice(`${saved}本の動画を登録しました。`);
            }
        }

        async hasPhotoManagerLocalVideoPermission(handle, request = false) {
            if (!handle) return false;
            const options = { mode: 'read' };
            try {
                if (typeof handle.queryPermission !== 'function') return true;
                if (await handle.queryPermission(options) === 'granted') return true;
                return request && typeof handle.requestPermission === 'function'
                    ? await handle.requestPermission(options) === 'granted'
                    : false;
            } catch {
                return false;
            }
        }

        async loadPhotoManagerLinkedVideoFile(item, requestPermission = false) {
            if (!item || item.sourceType !== 'local-handle') return null;
            const handle = await store.loadMediaFileHandle(this.getPhotoManagerVideoMediaKey(item.id));
            if (!handle || !(await this.hasPhotoManagerLocalVideoPermission(handle, requestPermission))) return null;
            const file = await handle.getFile();
            return file?.type?.startsWith?.('video/') ? file : null;
        }

        async linkPhotoManagerLocalVideos() {
            if (typeof window.showOpenFilePicker !== 'function') {
                this.showPhotoManagerNotice('このブラウザーはPC動画へのリンク登録に対応していません。ChromeまたはEdgeで開いてください。');
                return;
            }
            let handles;
            try {
                handles = await window.showOpenFilePicker({
                    multiple: true,
                    types: [{ description: '動画', accept: { 'video/*': ['.mp4', '.webm', '.mov', '.m4v', '.ogv'] } }]
                });
            } catch (error) {
                if (error?.name !== 'AbortError') this.showPhotoManagerNotice('PC動画を選択できませんでした。');
                return;
            }
            let saved = 0;
            for (const handle of handles || []) {
                try {
                    const file = await handle.getFile();
                    if (!file?.type?.startsWith?.('video/')) continue;
                    const metadata = await this.readPhotoManagerVideoMetadata(file);
                    const now = Date.now();
                    const id = `pmv-${now.toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
                    await store.saveMediaFileHandle(this.getPhotoManagerVideoMediaKey(id), handle);
                    this.getPhotoManagerVideos().unshift({
                        id,
                        sourceType: 'local-handle',
                        name: String(file.name || 'PC動画').replace(/\.[^.]+$/, '').slice(0, 100),
                        fileName: String(file.name || 'video').slice(0, 180),
                        type: file.type || 'video/mp4',
                        size: 0,
                        linkedFileSize: file.size,
                        duration: metadata.duration,
                        width: metadata.width,
                        height: metadata.height,
                        trimStart: 0,
                        trimEnd: metadata.duration,
                        animationClickMode: 'continue',
                        audioRemovedByTrim: false,
                        createdAt: now,
                        updatedAt: now
                    });
                    saved += 1;
                } catch (error) {
                    console.warn('Local linked video registration failed', error);
                }
            }
            if (saved) await store.save();
            this.openPhotoManagerVideos();
            this.showPhotoManagerNotice(saved ? `${saved}本のPC動画をリンク登録しました。動画本体はコピーしていません。` : 'リンク登録できる動画がありませんでした。');
        }

        async hydratePhotoManagerLinkedVideoElement(item, element, requestPermission = false) {
            if (!item || !element) return false;
            try {
                const file = await this.loadPhotoManagerLinkedVideoFile(item, requestPermission);
                if (!file || !document.contains(element)) return false;
                const url = URL.createObjectURL(file);
                this._photoManagerVideoObjectUrls = this._photoManagerVideoObjectUrls || [];
                this._photoManagerVideoObjectUrls.push(url);
                element.src = url;
                element.currentTime = Math.max(0, Number(item.trimStart) || 0);
                element.closest('.photo-manager-video-card, .photo-manager-video-url-editor')?.classList.remove('local-video-permission-needed');
                return true;
            } catch {
                return false;
            }
        }

        async reconnectPhotoManagerLocalVideo(id = '') {
            const item = this.getPhotoManagerVideo(id);
            if (!item || item.sourceType !== 'local-handle') return;
            const target = document.querySelector(`#photo-manager-video-modal video[data-video-id="${CSS.escape(item.id)}"], #photo-manager-video-modal .photo-manager-video-editor-player`);
            const connected = await this.hydratePhotoManagerLinkedVideoElement(item, target, true);
            if (!connected) {
                this.showPhotoManagerNotice('PC動画へのアクセスを許可できませんでした。元ファイルが移動・削除されていないか確認してください。');
                return;
            }
            document.querySelectorAll(`.shift-photo-compare-mark.video[data-video-id="${CSS.escape(item.id)}"] video`).forEach(video => {
                delete video.dataset.videoHydrated;
            });
            this.hydrateShiftPhotoCompareVideoMarks?.(document);
            this.showPhotoManagerNotice('PC動画へ再接続しました。');
        }

        async reselectPhotoManagerLocalVideo(id = '') {
            const item = this.getPhotoManagerVideo(id);
            if (!item || item.sourceType !== 'local-handle') return;
            if (typeof window.showOpenFilePicker !== 'function') {
                this.showPhotoManagerNotice('元ファイルの選び直しはChromeまたはEdgeで利用できます。');
                return;
            }
            let handle;
            try {
                [handle] = await window.showOpenFilePicker({
                    multiple: false,
                    types: [{ description: '動画', accept: { 'video/*': ['.mp4', '.webm', '.mov', '.m4v', '.ogv'] } }]
                });
            } catch (error) {
                if (error?.name !== 'AbortError') this.showPhotoManagerNotice('元ファイルを選び直せませんでした。');
                return;
            }
            try {
                const file = await handle.getFile();
                if (!file?.type?.startsWith?.('video/')) throw new Error('動画ファイルではありません。');
                const metadata = await this.readPhotoManagerVideoMetadata(file);
                await store.saveMediaFileHandle(this.getPhotoManagerVideoMediaKey(id), handle);
                item.fileName = String(file.name || item.fileName || 'video').slice(0, 180);
                item.type = file.type || item.type || 'video/mp4';
                item.linkedFileSize = file.size;
                item.duration = metadata.duration;
                item.width = metadata.width;
                item.height = metadata.height;
                item.trimStart = 0;
                item.trimEnd = metadata.duration;
                item.updatedAt = Date.now();
                item.thumbnailUrl = '';
                await store.save();
                this.refreshRegisteredVideoAttachmentStatuses(id);
                if (document.getElementById('registered-video-attachment-viewer')) {
                    await this.openRegisteredVideoAttachment(id);
                    this.showToast?.('PC動画の元ファイルを更新しました。', 'success');
                } else {
                    await this.openPhotoManagerVideoEditor(id);
                    this.showPhotoManagerNotice('PC動画の元ファイルを更新しました。');
                }
            } catch (error) {
                this.showPhotoManagerNotice(error?.message || '元ファイルを更新できませんでした。');
            }
        }

        revokePhotoManagerVideoObjectUrls() {
            clearTimeout(this._photoManagerExternalVideoPreviewTimer);
            this._photoManagerExternalVideoPreviewTimer = null;
            (this._photoManagerVideoObjectUrls || []).forEach(url => URL.revokeObjectURL(url));
            this._photoManagerVideoObjectUrls = [];
        }

        closePhotoManagerVideos(event = null) {
            if (event && event.target?.id !== 'photo-manager-video-modal') return;
            this.revokePhotoManagerVideoObjectUrls();
            document.getElementById('photo-manager-video-modal')?.remove();
        }

        async updatePhotoManagerVideoStorageSummary() {
            const target = document.querySelector('#photo-manager-video-modal .photo-manager-video-storage');
            if (!target) return;
            const total = this.getPhotoManagerVideos().reduce((sum, video) => sum + Math.max(0, Number(video.size) || 0), 0);
            let storageText = '';
            try {
                const estimate = await navigator.storage?.estimate?.();
                if (estimate?.quota) {
                    storageText = ` / ブラウザー全体 ${this.formatPhotoManagerBytes(estimate.usage || 0)} / ${this.formatPhotoManagerBytes(estimate.quota)}`;
                }
            } catch {}
            target.innerHTML = `<strong>動画 ${this.getPhotoManagerVideos().length}本</strong><span>登録容量 ${this.formatPhotoManagerBytes(total)}${storageText}</span><small>1本100MBまで</small>`;
        }

        async hydratePhotoManagerVideoCards() {
            const modal = document.getElementById('photo-manager-video-modal');
            if (!modal) return;
            this.revokePhotoManagerVideoObjectUrls();
            for (const video of this.getPhotoManagerVideos()) {
                if (video.sourceType === 'youtube') continue;
                const element = modal.querySelector(`video[data-video-id="${CSS.escape(video.id)}"]`);
                if (!element) continue;
                try {
                    if (video.sourceType === 'local-handle') {
                        const connected = await this.hydratePhotoManagerLinkedVideoElement(video, element, false);
                        if (!connected) element.closest('.photo-manager-video-card')?.classList.add('local-video-permission-needed');
                        continue;
                    }
                    if (video.sourceType === 'url' && video.sourceUrl) {
                        element.src = video.sourceUrl;
                        element.currentTime = 0;
                        continue;
                    }
                    const blob = await store.loadMediaBlob(this.getPhotoManagerVideoMediaKey(video.id));
                    if (!blob || !document.contains(element)) continue;
                    const url = URL.createObjectURL(blob);
                    this._photoManagerVideoObjectUrls.push(url);
                    element.src = url;
                    element.currentTime = Math.max(0, Number(video.trimStart) || 0);
                } catch {}
            }
        }

        openPhotoManagerVideos() {
            this.applyMediaManagementCardColor();
            this.revokePhotoManagerVideoObjectUrls();
            document.getElementById('photo-manager-video-modal')?.remove();
            const videos = this.getPhotoManagerVideos();
            document.body.insertAdjacentHTML('beforeend', `
                <div id="photo-manager-video-modal" class="photo-manager-video-modal" onclick="app.closePhotoManagerVideos(event)">
                    <section class="photo-manager-video-panel" onclick="event.stopPropagation()">
                        <header>
                            <div><strong><i class="fa-solid fa-video"></i> 動画管理</strong><small>登録動画のトリミングと容量確認</small></div>
                            <div class="photo-manager-video-header-actions">
                                <button type="button" class="primary-btn" onclick="document.getElementById('photo-manager-video-import-input')?.click()"><i class="fa-solid fa-plus"></i> 動画登録</button>
                                <button type="button" class="photo-manager-video-local-link" onclick="app.linkPhotoManagerLocalVideos()"><i class="fa-solid fa-folder-open"></i> PC動画リンク</button>
                                <button type="button" class="photo-manager-video-url-toggle" onclick="this.closest('.photo-manager-video-panel').classList.toggle('show-url-form')"><i class="fa-brands fa-youtube"></i> YouTube・URL</button>
                                <button type="button" class="secondary-btn" onclick="app.closePhotoManagerVideos()"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        </header>
                        <section class="photo-manager-video-url-form">
                            <label><span>動画アドレス</span><input class="photo-manager-video-url-input" type="url" placeholder="YouTube共有URL または .mp4 / .webm のURL"></label>
                            <label><span>表示名</span><input class="photo-manager-video-url-name" type="text" maxlength="100" placeholder="省略可"></label>
                            <button type="button" class="photo-manager-video-url-register" onclick="app.registerPhotoManagerVideoUrl()"><i class="fa-solid fa-link"></i> URLを登録</button>
                            <small>YouTubeと、ブラウザーで直接再生できる動画URLに対応します。URL動画は保存容量を使用しません。</small>
                        </section>
                        <div class="photo-manager-video-storage"></div>
                        <div class="photo-manager-video-list">
                            ${videos.length ? videos.map(video => `
                                <article class="photo-manager-video-card">
                                    <div class="photo-manager-video-preview">
                                        ${video.sourceType === 'youtube'
                                            ? `<img src="${this.escapeHtml(video.thumbnailUrl || '')}" alt="">`
                                            : `<video data-video-id="${this.escapeHtml(video.id)}" muted preload="metadata" playsinline></video>`}
                                        <i class="fa-solid fa-play"></i>
                                        ${video.sourceType === 'local-handle' ? `<button type="button" class="photo-manager-video-reconnect" onclick="app.reconnectPhotoManagerLocalVideo('${this.escapeJs(video.id)}')"><i class="fa-solid fa-link"></i> 再接続</button>` : ''}
                                    </div>
                                    <div class="photo-manager-video-info">
                                        <strong>${this.escapeHtml(video.name || video.fileName || '動画')}</strong>
                                        <span>${video.sourceType === 'local-handle' ? `PCリンク・容量不要（元動画 ${this.formatPhotoManagerBytes(video.linkedFileSize || 0)}）` : (video.sourceType ? 'URL動画・容量不要' : this.formatPhotoManagerBytes(video.size))}${this.getPhotoManagerVideoTrimSummary(video) ? ` / 使用 ${this.getPhotoManagerVideoTrimSummary(video)}` : ''}</span>
                                        <small>${video.animationClickMode === 'stop' ? '次クリックで停止' : '再生しながら進行'}${video.audioRemovedByTrim ? ' / 音声なし' : ''}</small>
                                    </div>
                                    <button type="button" class="primary-btn" onclick="app.openPhotoManagerVideoEditor('${this.escapeJs(video.id)}')"><i class="fa-solid ${video.sourceType ? 'fa-pen' : 'fa-scissors'}"></i> 編集</button>
                                </article>
                            `).join('') : '<div class="photo-manager-video-empty"><i class="fa-solid fa-video-slash"></i><p>登録動画はありません。</p></div>'}
                        </div>
                    </section>
                </div>`);
            this.updatePhotoManagerVideoStorageSummary();
            this.hydratePhotoManagerVideoCards();
        }

        formatPhotoManagerVideoTimeInput(seconds = 0) {
            const value = Math.max(0, Number(seconds) || 0);
            const hours = Math.floor(value / 3600);
            const minutes = Math.floor((value % 3600) / 60);
            const secs = Math.floor(value % 60);
            return hours > 0
                ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
                : `${minutes}:${String(secs).padStart(2, '0')}`;
        }

        parsePhotoManagerVideoTimeInput(value = '') {
            const text = String(value || '').trim().replace(/：/g, ':');
            if (!text) return null;
            if (/^\d+(?:\.\d+)?$/.test(text)) return Math.max(0, Number(text));
            const parts = text.split(':').map(part => part.trim());
            if (parts.length < 2 || parts.length > 3 || parts.some(part => !/^\d+(?:\.\d+)?$/.test(part))) return NaN;
            const values = parts.map(Number);
            if (parts.length === 2) return Math.max(0, values[0] * 60 + values[1]);
            return Math.max(0, values[0] * 3600 + values[1] * 60 + values[2]);
        }

        getPhotoManagerExternalVideoTrimValues(item, panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel')) {
            const startInput = panel?.querySelector?.('.photo-manager-video-time-start');
            const endInput = panel?.querySelector?.('.photo-manager-video-time-end');
            const start = this.parsePhotoManagerVideoTimeInput(startInput?.value || '0');
            const parsedEnd = this.parsePhotoManagerVideoTimeInput(endInput?.value || '');
            const duration = Math.max(0, Number(item?.duration) || 0);
            const end = parsedEnd === null ? duration : parsedEnd;
            return { start, end, duration, hasEnd: parsedEnd !== null };
        }

        updatePhotoManagerExternalVideoTrimPreview() {
            const item = this.getPhotoManagerVideo(this._photoManagerEditingVideoId);
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            const output = panel?.querySelector?.('.photo-manager-video-time-output');
            if (!item || !output) return;
            const values = this.getPhotoManagerExternalVideoTrimValues(item, panel);
            if (!Number.isFinite(values.start) || (values.hasEnd && !Number.isFinite(values.end))) {
                output.value = '時刻の形式を確認してください';
                output.classList.add('error');
                return;
            }
            if (values.hasEnd && values.end <= values.start) {
                output.value = '終了は開始より後にしてください';
                output.classList.add('error');
                return;
            }
            output.classList.remove('error');
            const endLabel = values.hasEnd ? this.formatPhotoManagerVideoTimeInput(values.end) : '動画の最後';
            const lengthLabel = values.hasEnd ? `（${this.formatPhotoManagerVideoTimeInput(values.end - values.start)}）` : '';
            output.value = `${this.formatPhotoManagerVideoTimeInput(values.start)} ～ ${endLabel}${lengthLabel}`;
            this.updatePhotoManagerExternalVideoSeekControls();
        }

        setPhotoManagerExternalVideoTrimFromCurrent(side = 'start') {
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            const player = panel?.querySelector?.('.photo-manager-video-editor-player');
            const input = panel?.querySelector?.(side === 'end' ? '.photo-manager-video-time-end' : '.photo-manager-video-time-start');
            if (!player || !input || !Number.isFinite(Number(player.currentTime))) return;
            input.value = this.formatPhotoManagerVideoTimeInput(player.currentTime || 0);
            this.updatePhotoManagerExternalVideoTrimPreview();
        }

        previewPhotoManagerExternalVideoTrim() {
            const item = this.getPhotoManagerVideo(this._photoManagerEditingVideoId);
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            if (!item || !panel) return;
            const values = this.getPhotoManagerExternalVideoTrimValues(item, panel);
            if (!Number.isFinite(values.start) || (values.hasEnd && (!Number.isFinite(values.end) || values.end <= values.start))) {
                this.updatePhotoManagerExternalVideoTrimPreview();
                return;
            }
            const iframe = panel.querySelector('.photo-manager-video-editor-youtube');
            if (iframe) {
                clearTimeout(this._photoManagerExternalVideoPreviewTimer);
                this.sendShiftPhotoCompareYouTubeCommand?.(iframe, 'seekTo', [values.start, true]);
                this.sendShiftPhotoCompareYouTubeCommand?.(iframe, 'playVideo');
                if (values.hasEnd) {
                    this._photoManagerExternalVideoPreviewTimer = setTimeout(() => {
                        if (!document.contains(iframe)) return;
                        this.sendShiftPhotoCompareYouTubeCommand?.(iframe, 'pauseVideo');
                        this.sendShiftPhotoCompareYouTubeCommand?.(iframe, 'seekTo', [values.end, true]);
                    }, Math.max(100, (values.end - values.start) * 1000));
                }
                return;
            }
            const player = panel.querySelector('.photo-manager-video-editor-player');
            if (!player?.src) return;
            player.currentTime = Math.min(values.start, player.duration || values.start);
            player.play().catch(() => {});
        }

        getPhotoManagerExternalVideoPlaybackBounds(item, panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel')) {
            const values = this.getPhotoManagerExternalVideoTrimValues(item, panel);
            const player = panel?.querySelector?.('.photo-manager-video-editor-player');
            const iframe = panel?.querySelector?.('.photo-manager-video-editor-youtube');
            const mediaDuration = Math.max(0, Number(player?.duration) || Number(iframe?.dataset.youtubeDuration) || values.duration || 0);
            const start = Number.isFinite(values.start) ? Math.max(0, values.start) : 0;
            const end = values.hasEnd && Number.isFinite(values.end)
                ? (mediaDuration > 0 ? Math.min(values.end, mediaDuration) : values.end)
                : mediaDuration;
            return { start, end, duration: Math.max(0, end - start), hasKnownEnd: end > start };
        }

        updatePhotoManagerExternalVideoSeekControls() {
            const item = this.getPhotoManagerVideo(this._photoManagerEditingVideoId);
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            const range = panel?.querySelector?.('.photo-manager-video-clip-seek');
            const label = panel?.querySelector?.('.photo-manager-video-clip-time');
            if (!item || !range || !label) return;
            const bounds = this.getPhotoManagerExternalVideoPlaybackBounds(item, panel);
            const player = panel.querySelector('.photo-manager-video-editor-player');
            const iframe = panel.querySelector('.photo-manager-video-editor-youtube');
            const current = player?.src ? Number(player.currentTime) || bounds.start : Number(iframe?.dataset.youtubeCurrentTime) || bounds.start;
            const relative = Math.max(0, Math.min(bounds.duration || 0, current - bounds.start));
            range.min = '0';
            range.max = String(Math.max(0.1, bounds.duration || 0.1));
            range.value = String(relative);
            range.disabled = !bounds.hasKnownEnd;
            label.textContent = bounds.hasKnownEnd
                ? `${this.formatPhotoManagerVideoTimeInput(relative)} / ${this.formatPhotoManagerVideoTimeInput(bounds.duration)}`
                : `${this.formatPhotoManagerVideoTimeInput(relative)} / 読込中`;
        }

        seekPhotoManagerExternalVideoClip(value = 0) {
            const item = this.getPhotoManagerVideo(this._photoManagerEditingVideoId);
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            if (!item || !panel) return;
            const bounds = this.getPhotoManagerExternalVideoPlaybackBounds(item, panel);
            const target = bounds.start + Math.max(0, Math.min(bounds.duration || 0, Number(value) || 0));
            const player = panel.querySelector('.photo-manager-video-editor-player');
            const iframe = panel.querySelector('.photo-manager-video-editor-youtube');
            if (player?.src) player.currentTime = Math.min(target, player.duration || target);
            if (iframe) {
                iframe.dataset.youtubeCurrentTime = String(target);
                this.sendShiftPhotoCompareYouTubeCommand?.(iframe, 'seekTo', [target, true]);
            }
            this.updatePhotoManagerExternalVideoSeekControls();
        }

        togglePhotoManagerExternalVideoPlayback() {
            const item = this.getPhotoManagerVideo(this._photoManagerEditingVideoId);
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            if (!item || !panel) return;
            const bounds = this.getPhotoManagerExternalVideoPlaybackBounds(item, panel);
            const button = panel.querySelector('.photo-manager-video-clip-play');
            const icon = button?.querySelector('i');
            const player = panel.querySelector('.photo-manager-video-editor-player');
            if (player?.src) {
                if (player.paused) {
                    if (player.currentTime < bounds.start || (bounds.hasKnownEnd && player.currentTime >= bounds.end)) player.currentTime = bounds.start;
                    player.play().catch(() => {});
                    icon?.classList.replace('fa-play', 'fa-pause');
                } else {
                    player.pause();
                    icon?.classList.replace('fa-pause', 'fa-play');
                }
                return;
            }
            const iframe = panel.querySelector('.photo-manager-video-editor-youtube');
            if (!iframe) return;
            const playing = iframe.dataset.youtubeState === '1';
            const current = Number(iframe.dataset.youtubeCurrentTime) || bounds.start;
            if (!playing && (current < bounds.start || (bounds.hasKnownEnd && current >= bounds.end))) {
                iframe.dataset.youtubeCurrentTime = String(bounds.start);
                this.sendShiftPhotoCompareYouTubeCommand?.(iframe, 'seekTo', [bounds.start, true]);
            }
            this.sendShiftPhotoCompareYouTubeCommand?.(iframe, playing ? 'pauseVideo' : 'playVideo');
            iframe.dataset.youtubeState = playing ? '2' : '1';
            if (playing) icon?.classList.replace('fa-pause', 'fa-play');
            else icon?.classList.replace('fa-play', 'fa-pause');
        }

        handlePhotoManagerYouTubePreviewMessage(iframe, payload) {
            const panel = iframe?.closest?.('.photo-manager-video-panel');
            if (!panel) return;
            if (payload?.event === 'infoDelivery' && payload.info && typeof payload.info === 'object') {
                if (Number.isFinite(Number(payload.info.currentTime))) iframe.dataset.youtubeCurrentTime = String(payload.info.currentTime);
                if (Number.isFinite(Number(payload.info.duration)) && Number(payload.info.duration) > 0) iframe.dataset.youtubeDuration = String(payload.info.duration);
                this.updatePhotoManagerExternalVideoSeekControls();
                const item = this.getPhotoManagerVideo(this._photoManagerEditingVideoId);
                const bounds = this.getPhotoManagerExternalVideoPlaybackBounds(item, panel);
                const current = Number(iframe.dataset.youtubeCurrentTime) || bounds.start;
                if (bounds.hasKnownEnd && current >= bounds.end - 0.05 && iframe.dataset.youtubeState === '1') {
                    this.sendShiftPhotoCompareYouTubeCommand?.(iframe, 'pauseVideo');
                    iframe.dataset.youtubeState = '2';
                    panel.querySelector('.photo-manager-video-clip-play i')?.classList.replace('fa-pause', 'fa-play');
                    iframe.dataset.youtubeCurrentTime = String(bounds.end);
                    this.updatePhotoManagerExternalVideoSeekControls();
                }
                return;
            }
            if (payload?.event !== 'onStateChange') return;
            const state = Number(payload.info);
            iframe.dataset.youtubeState = String(state);
            const icon = panel.querySelector('.photo-manager-video-clip-play i');
            if (state === 1) icon?.classList.replace('fa-play', 'fa-pause');
            if (state === 0 || state === 2) icon?.classList.replace('fa-pause', 'fa-play');
        }
        syncPhotoManagerVideoTrimReferences(videoId = '', start = 0, end = 0) {
            const safeStart = Math.max(0, Number(start) || 0);
            const safeEnd = Math.max(0, Number(end) || 0);
            const seen = new WeakSet();
            const visit = value => {
                if (!value || typeof value !== 'object' || seen.has(value)) return;
                seen.add(value);
                if (String(value.videoId || '') === String(videoId)) {
                    value.videoTrimStart = safeStart;
                    value.videoTrimEnd = safeEnd;
                }
                if (Array.isArray(value)) value.forEach(visit);
                else Object.values(value).forEach(visit);
            };
            visit(store.activeData);
            document.querySelectorAll(`.shift-photo-compare-mark.video[data-video-id="${CSS.escape(String(videoId))}"]`).forEach(mark => {
                mark.dataset.videoTrimStart = String(safeStart);
                mark.dataset.videoTrimEnd = String(safeEnd);
                const video = mark.querySelector('video');
                if (video?.src && Number.isFinite(video.duration)) video.currentTime = Math.min(safeStart, video.duration);
                const iframe = mark.querySelector('.shift-photo-compare-youtube-player');
                if (iframe) iframe.dataset.youtubeCurrentTime = String(safeStart);
            });
        }
        async openPhotoManagerVideoEditor(id = '') {
            const item = this.getPhotoManagerVideo(id);
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            if (!item || !panel) return;
            this._photoManagerEditingVideoId = item.id;
            if (item.sourceType) {
                this.revokePhotoManagerVideoObjectUrls();
                panel.innerHTML = `
                    <header>
                        <div><strong><i class="fa-solid fa-link"></i> ${item.sourceType === 'local-handle' ? 'PCリンク動画編集' : 'URL動画編集'}</strong><small>${item.sourceType === 'youtube' ? 'YouTube' : (item.sourceType === 'local-handle' ? 'PC内の元ファイルを直接再生' : '動画URL')} / 保存容量を使用しません</small></div>
                        <button type="button" class="secondary-btn" onclick="app.openPhotoManagerVideos()"><i class="fa-solid fa-arrow-left"></i> 一覧</button>
                    </header>
                    <div class="photo-manager-video-editor photo-manager-video-url-editor">
                        <div class="photo-manager-video-editor-preview">
                            ${item.sourceType === 'youtube'
                                ? `<iframe class="photo-manager-video-editor-youtube" src="${this.escapeHtml(this.getPhotoManagerYouTubeEmbedUrl(item.youtubeId, true, false))}" title="${this.escapeHtml(item.name || 'YouTube動画')}" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
                                : `<video class="photo-manager-video-editor-player" ${item.sourceType === 'url' ? `src="${this.escapeHtml(item.sourceUrl || '')}"` : `data-video-id="${this.escapeHtml(item.id)}"`} playsinline preload="metadata"></video>`}
                            ${item.sourceType === 'local-handle' ? `<button type="button" class="photo-manager-video-editor-reconnect" onclick="app.reconnectPhotoManagerLocalVideo('${this.escapeJs(item.id)}')"><i class="fa-solid fa-folder-open"></i> PC動画へ再接続</button>` : ''}
                        </div>
                        <div class="photo-manager-video-clip-controls">
                            <button type="button" class="photo-manager-video-clip-play" onclick="app.togglePhotoManagerExternalVideoPlayback()" title="再生・一時停止" aria-label="再生・一時停止"><i class="fa-solid fa-play"></i></button>
                            <input class="photo-manager-video-clip-seek" type="range" min="0" max="1" step="0.1" value="0" oninput="app.seekPhotoManagerExternalVideoClip(this.value)" aria-label="使用範囲内の再生位置">
                            <output class="photo-manager-video-clip-time">0:00 / 0:00</output>
                        </div>
                        <label><span>動画名</span><input class="photo-manager-video-name" type="text" maxlength="100" value="${this.escapeHtml(item.name || '')}"></label>
                        <label><span>${item.sourceType === 'local-handle' ? '元ファイル' : '動画アドレス'}</span><input type="text" value="${this.escapeHtml(item.sourceType === 'local-handle' ? item.fileName : (item.sourceUrl || ''))}" readonly></label>
                        ${item.sourceType === 'local-handle' ? `<button type="button" class="photo-manager-video-reselect" onclick="app.reselectPhotoManagerLocalVideo('${this.escapeJs(item.id)}')"><i class="fa-solid fa-arrows-rotate"></i> 元ファイルを選び直す</button>` : ''}
                        <section class="photo-manager-video-time-trim">
                            <div><strong><i class="fa-solid fa-scissors"></i> 使用範囲（非破壊）</strong><output class="photo-manager-video-time-output"></output></div>
                            <div class="photo-manager-video-time-fields">
                                <label><span>開始</span><input class="photo-manager-video-time-start" type="text" inputmode="decimal" value="${this.formatPhotoManagerVideoTimeInput(item.trimStart || 0)}" placeholder="0:00" oninput="app.updatePhotoManagerExternalVideoTrimPreview()">${item.sourceType !== 'youtube' ? '<button type="button" onclick="app.setPhotoManagerExternalVideoTrimFromCurrent(\'start\')">現在位置</button>' : ''}</label>
                                <label><span>終了</span><input class="photo-manager-video-time-end" type="text" inputmode="decimal" value="${Number(item.trimEnd) > Number(item.trimStart || 0) ? this.formatPhotoManagerVideoTimeInput(item.trimEnd) : ''}" placeholder="空欄なら最後まで" oninput="app.updatePhotoManagerExternalVideoTrimPreview()">${item.sourceType !== 'youtube' ? '<button type="button" onclick="app.setPhotoManagerExternalVideoTrimFromCurrent(\'end\')">現在位置</button>' : ''}</label>
                            </div>
                            <div class="photo-manager-video-time-actions"><small>元動画は変更せず、記号アニメで再生する開始・終了位置だけを保存します。</small><button type="button" onclick="app.previewPhotoManagerExternalVideoTrim()"><i class="fa-solid fa-play"></i> 範囲を試す</button></div>
                        </section>
                        <fieldset class="photo-manager-video-click-mode">
                            <legend>アニメ中、次をクリックした時</legend>
                            <label><input type="radio" name="photo-manager-video-click-mode" value="continue" ${item.animationClickMode !== 'stop' ? 'checked' : ''}> 動画を再生したまま次へ進む</label>
                            <label><input type="radio" name="photo-manager-video-click-mode" value="stop" ${item.animationClickMode === 'stop' ? 'checked' : ''}> 動画を停止して次へ進む</label>
                        </fieldset>
                    </div>
                    <div class="photo-manager-video-editor-actions">
                        <button type="button" class="danger-btn" onclick="app.deletePhotoManagerVideo('${this.escapeJs(item.id)}')"><i class="fa-solid fa-trash"></i> 削除</button>
                        <button type="button" class="primary-btn" onclick="app.savePhotoManagerVideoEdits('${this.escapeJs(item.id)}')"><i class="fa-solid fa-floppy-disk"></i> 保存</button>
                    </div>`;
                const youtubePlayer = panel.querySelector('.photo-manager-video-editor-youtube');
                if (youtubePlayer) {
                    this.ensureShiftPhotoCompareYouTubeBridge?.();
                    const connectYouTubePreview = () => {
                        this.sendShiftPhotoCompareYouTubeCommand?.(youtubePlayer, 'addEventListener', ['onStateChange']);
                        youtubePlayer.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: youtubePlayer.id || '' }), '*');
                        this.updatePhotoManagerExternalVideoSeekControls();
                    };
                    youtubePlayer.addEventListener('load', connectYouTubePreview, { once: true });
                }
                const player = panel.querySelector('.photo-manager-video-editor-player');
                if (item.sourceType === 'local-handle') {
                    const connected = await this.hydratePhotoManagerLinkedVideoElement(item, player, false);
                    if (!connected) panel.querySelector('.photo-manager-video-url-editor')?.classList.add('local-video-permission-needed');
                }
                if (player) {
                    const applyPlaybackRange = () => {
                        const values = this.getPhotoManagerExternalVideoTrimValues(item, panel);
                        if (Number.isFinite(values.start)) player.currentTime = Math.min(values.start, player.duration || values.start);
                        this.updatePhotoManagerExternalVideoSeekControls();
                    };
                    if (player.readyState >= 1) applyPlaybackRange();
                    else player.addEventListener('loadedmetadata', applyPlaybackRange, { once: true });
                    player.onplay = () => panel.querySelector('.photo-manager-video-clip-play i')?.classList.replace('fa-play', 'fa-pause');
                    player.onpause = () => panel.querySelector('.photo-manager-video-clip-play i')?.classList.replace('fa-pause', 'fa-play');
                    player.ontimeupdate = () => {
                        const values = this.getPhotoManagerExternalVideoTrimValues(item, panel);
                        if (values.hasEnd && Number.isFinite(values.end) && player.currentTime >= values.end) {
                            player.pause();
                            player.currentTime = Math.min(values.end, player.duration || values.end);
                        }
                        this.updatePhotoManagerExternalVideoSeekControls();
                    };
                }
                this.updatePhotoManagerExternalVideoTrimPreview();
                return;
            }
            this.revokePhotoManagerVideoObjectUrls();
            panel.innerHTML = `
                <header>
                    <div><strong><i class="fa-solid fa-scissors"></i> 動画編集</strong><small>${this.formatPhotoManagerBytes(item.size)} / 元の長さ ${this.formatPhotoManagerVideoDuration(item.duration)}${item.audioRemovedByTrim ? ' / 音声なし' : ''}</small></div>
                    <button type="button" class="secondary-btn" onclick="app.openPhotoManagerVideos()"><i class="fa-solid fa-arrow-left"></i> 一覧</button>
                </header>
                <div class="photo-manager-video-editor">
                    <div class="photo-manager-video-editor-preview">
                        <video class="photo-manager-video-editor-player" controls playsinline preload="metadata"></video>
                        <output class="photo-manager-video-trim-preview-label"></output>
                    </div>
                    <label><span>動画名</span><input class="photo-manager-video-name" type="text" maxlength="100" value="${this.escapeHtml(item.name || '')}"></label>
                    <div class="photo-manager-video-trim">
                        <div><strong>使用範囲</strong><output class="photo-manager-video-trim-output"></output></div>
                        <label><span>開始</span><input class="photo-manager-video-trim-start" type="range" min="0" max="${item.duration}" step="0.1" value="${item.trimStart || 0}" oninput="app.updatePhotoManagerVideoTrimPreview()"><button type="button" onclick="app.setPhotoManagerVideoTrimFromCurrent('start')">現在位置</button></label>
                        <label><span>終了</span><input class="photo-manager-video-trim-end" type="range" min="0" max="${item.duration}" step="0.1" value="${item.trimEnd || item.duration}" oninput="app.updatePhotoManagerVideoTrimPreview()"><button type="button" onclick="app.setPhotoManagerVideoTrimFromCurrent('end')">現在位置</button></label>
                    </div>
                    <fieldset class="photo-manager-video-click-mode">
                        <legend>アニメ中、次をクリックした時</legend>
                        <label><input type="radio" name="photo-manager-video-click-mode" value="continue" ${item.animationClickMode !== 'stop' ? 'checked' : ''}> 動画を再生したまま次へ進む</label>
                        <label><input type="radio" name="photo-manager-video-click-mode" value="stop" ${item.animationClickMode === 'stop' ? 'checked' : ''}> 動画を停止して次へ進む</label>
                    </fieldset>
                    <div class="photo-manager-video-destructive-trim">
                        <div>
                            <strong><i class="fa-solid fa-compress"></i> 容量を減らす</strong>
                            <small>現在の使用範囲だけを新しい動画として保存し、範囲外を削除します。処理には使用範囲と同程度の時間がかかります。</small>
                        </div>
                        <button type="button" class="photo-manager-video-cut-btn" onclick="app.cutPhotoManagerVideoToTrim('${this.escapeJs(item.id)}')"><i class="fa-solid fa-scissors"></i> 使用範囲だけ残す</button>
                    </div>
                    <section class="photo-manager-video-convert">
                        <header>
                            <div><strong><i class="fa-solid fa-file-export"></i> 変換・圧縮</strong><small>画質をできるだけ維持しながら容量を削減します。</small></div>
                            <output class="photo-manager-video-convert-estimate"></output>
                        </header>
                        <div class="photo-manager-video-convert-options">
                            <label><span>形式</span><select class="photo-manager-video-convert-format" onchange="app.updatePhotoManagerVideoCompressionEstimate()"><option value="webm">WebM（VP9 / Opus）</option><option value="mp4">MP4（H.264 / AAC）</option></select></label>
                            <label><span>品質</span><select class="photo-manager-video-convert-quality" onchange="app.updatePhotoManagerVideoCompressionEstimate()"><option value="high">高画質</option><option value="standard">標準</option><option value="compact">容量優先</option></select></label>
                            <label><span>解像度</span><select class="photo-manager-video-convert-resolution" onchange="app.updatePhotoManagerVideoCompressionEstimate()"><option value="original">元のまま</option><option value="1080">最大1080p</option><option value="720">最大720p</option></select></label>
                        </div>
                        <fieldset class="photo-manager-video-convert-save-mode">
                            <label><input type="radio" name="photo-manager-video-convert-save-mode" value="copy" checked> 変換後を別動画として保存</label>
                            <label><input type="radio" name="photo-manager-video-convert-save-mode" value="replace"> 元動画を変換後で置き換える</label>
                        </fieldset>
                        <button type="button" class="photo-manager-video-convert-btn" onclick="app.convertPhotoManagerVideo('${this.escapeJs(item.id)}')"><i class="fa-solid fa-wand-magic-sparkles"></i> 変換・圧縮する</button>
                    </section>
                    <div class="photo-manager-video-cut-progress" hidden>
                        <span><i class="fa-solid fa-spinner fa-spin"></i> 切り出し中</span>
                        <progress max="100" value="0"></progress>
                        <output>0%</output>
                    </div>
                    <div class="photo-manager-video-editor-actions">
                        <button type="button" class="danger-btn" onclick="app.deletePhotoManagerVideo('${this.escapeJs(item.id)}')"><i class="fa-solid fa-trash"></i> 削除</button>
                        <button type="button" class="primary-btn" onclick="app.savePhotoManagerVideoEdits('${this.escapeJs(item.id)}')"><i class="fa-solid fa-floppy-disk"></i> 保存</button>
                    </div>
                </div>`;
            this._photoManagerEditingVideoId = item.id;
            try {
                const blob = await store.loadMediaBlob(this.getPhotoManagerVideoMediaKey(item.id));
                const player = panel.querySelector('.photo-manager-video-editor-player');
                if (blob && player) {
                    const url = URL.createObjectURL(blob);
                    this._photoManagerVideoObjectUrls.push(url);
                    player.src = url;
                    player.currentTime = Math.max(0, Number(item.trimStart) || 0);
                    player.ontimeupdate = () => {
                        if (player._photoManagerTrimPreviewing) return;
                        const end = Number(panel.querySelector('.photo-manager-video-trim-end')?.value) || item.duration;
                        if (player.currentTime >= end) {
                            player.pause();
                            player.currentTime = Math.max(0, Number(panel.querySelector('.photo-manager-video-trim-start')?.value) || 0);
                        }
                    };
                }
            } catch {}
            this.updatePhotoManagerVideoTrimPreview();
            this.updatePhotoManagerVideoCompressionEstimate();
        }

        getPhotoManagerVideoConversionOptions(panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel')) {
            return {
                format: panel?.querySelector('.photo-manager-video-convert-format')?.value === 'mp4' ? 'mp4' : 'webm',
                quality: ['standard', 'compact'].includes(panel?.querySelector('.photo-manager-video-convert-quality')?.value)
                    ? panel.querySelector('.photo-manager-video-convert-quality').value
                    : 'high',
                resolution: ['1080', '720'].includes(panel?.querySelector('.photo-manager-video-convert-resolution')?.value)
                    ? panel.querySelector('.photo-manager-video-convert-resolution').value
                    : 'original',
                saveMode: panel?.querySelector('input[name="photo-manager-video-convert-save-mode"]:checked')?.value === 'replace' ? 'replace' : 'copy'
            };
        }

        updatePhotoManagerVideoCompressionEstimate() {
            const item = this.getPhotoManagerVideo(this._photoManagerEditingVideoId);
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            const output = panel?.querySelector('.photo-manager-video-convert-estimate');
            if (!item || !output) return;
            const options = this.getPhotoManagerVideoConversionOptions(panel);
            const qualityFactor = ({ high: 0.72, standard: 0.48, compact: 0.3 })[options.quality];
            const sourcePixels = Math.max(1, (Number(item.width) || 1920) * (Number(item.height) || 1080));
            const maxHeight = options.resolution === 'original' ? Number(item.height) || 1080 : Number(options.resolution);
            const scale = Math.min(1, maxHeight / Math.max(1, Number(item.height) || maxHeight));
            const pixelFactor = Math.max(0.18, (sourcePixels * scale * scale) / sourcePixels);
            const formatFactor = options.format === 'webm' ? 0.88 : 1;
            const estimate = Math.max(128 * 1024, Number(item.size) * qualityFactor * pixelFactor * formatFactor);
            output.value = `推定 ${this.formatPhotoManagerBytes(estimate)} 前後`;
            output.title = '映像内容によって実際の容量は変わります。';
        }

        updatePhotoManagerVideoTrimPreview() {
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            const start = panel?.querySelector('.photo-manager-video-trim-start');
            const end = panel?.querySelector('.photo-manager-video-trim-end');
            const output = panel?.querySelector('.photo-manager-video-trim-output');
            if (!start || !end || !output) return;
            let startValue = Math.max(0, Number(start.value) || 0);
            let endValue = Math.max(0, Number(end.value) || 0);
            if (startValue > endValue - 0.1) {
                if (document.activeElement === start) startValue = Math.max(0, endValue - 0.1);
                else endValue = Math.min(Number(end.max) || endValue, startValue + 0.1);
            }
            start.value = String(startValue);
            end.value = String(endValue);
            output.value = `${this.formatPhotoManagerVideoDuration(startValue)} ～ ${this.formatPhotoManagerVideoDuration(endValue)}（${this.formatPhotoManagerVideoDuration(endValue - startValue)}）`;
            const active = document.activeElement;
            const isStart = active === start;
            const isEnd = active === end;
            const player = panel.querySelector('.photo-manager-video-editor-player');
            const previewLabel = panel.querySelector('.photo-manager-video-trim-preview-label');
            if ((isStart || isEnd) && player?.src) {
                const selectedValue = isStart ? startValue : endValue;
                const previewTime = isEnd
                    ? Math.max(startValue, selectedValue - Math.min(0.04, Math.max(0, selectedValue - startValue) / 2))
                    : selectedValue;
                player.pause();
                player._photoManagerTrimPreviewing = true;
                clearTimeout(player._photoManagerTrimPreviewTimer);
                try { player.currentTime = previewTime; } catch {}
                player._photoManagerTrimPreviewTimer = setTimeout(() => {
                    player._photoManagerTrimPreviewing = false;
                }, 350);
                if (previewLabel) {
                    previewLabel.value = `${isStart ? '開始' : '終了'}プレビュー ${this.formatPhotoManagerVideoDuration(selectedValue)}`;
                    previewLabel.classList.add('show');
                    clearTimeout(previewLabel._hideTimer);
                    previewLabel._hideTimer = setTimeout(() => previewLabel.classList.remove('show'), 900);
                }
            }
        }

        setPhotoManagerVideoTrimFromCurrent(side = 'start') {
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            const player = panel?.querySelector('.photo-manager-video-editor-player');
            const input = panel?.querySelector(side === 'end' ? '.photo-manager-video-trim-end' : '.photo-manager-video-trim-start');
            if (!player || !input) return;
            input.value = String(Math.max(0, Math.min(Number(input.max) || player.duration || 0, player.currentTime || 0)));
            this.updatePhotoManagerVideoTrimPreview();
        }

        getPhotoManagerVideoRecordingMimeType() {
            if (typeof MediaRecorder === 'undefined') return '';
            return [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm'
            ].find(type => MediaRecorder.isTypeSupported?.(type)) || '';
        }

        updatePhotoManagerVideoCutProgress(percent = 0, message = '切り出し中') {
            const box = document.querySelector('#photo-manager-video-modal .photo-manager-video-cut-progress');
            if (!box) return;
            const value = Math.max(0, Math.min(100, Number(percent) || 0));
            box.hidden = false;
            box.classList.remove('error');
            const label = box.querySelector('span');
            const progress = box.querySelector('progress');
            const output = box.querySelector('output');
            if (label) label.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${this.escapeHtml(message)}`;
            if (progress) progress.value = value;
            if (output) output.value = `${Math.round(value)}%`;
        }

        formatPhotoManagerVideoProgressElapsed(milliseconds = 0) {
            const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}:${String(seconds).padStart(2, '0')}`;
        }

        startPhotoManagerVideoOperationProgress(message = '処理を準備中', percent = 1) {
            this.stopPhotoManagerVideoOperationProgress();
            this._photoManagerVideoProgressOperation = 'convert';
            this._photoManagerVideoProgressStartedAt = Date.now();
            this._photoManagerVideoProgressMessage = message;
            this._photoManagerVideoProgressValue = percent;
            const refresh = () => {
                const elapsed = this.formatPhotoManagerVideoProgressElapsed(Date.now() - this._photoManagerVideoProgressStartedAt);
                this.updatePhotoManagerVideoCutProgress(
                    this._photoManagerVideoProgressValue,
                    `${this._photoManagerVideoProgressMessage}（経過 ${elapsed}）`
                );
            };
            refresh();
            this._photoManagerVideoProgressTimer = window.setInterval(refresh, 500);
        }

        setPhotoManagerVideoOperationProgress(percent = 0, message = '') {
            this._photoManagerVideoProgressValue = Math.max(0, Math.min(100, Number(percent) || 0));
            if (message) this._photoManagerVideoProgressMessage = message;
            const elapsed = this.formatPhotoManagerVideoProgressElapsed(Date.now() - (this._photoManagerVideoProgressStartedAt || Date.now()));
            this.updatePhotoManagerVideoCutProgress(
                this._photoManagerVideoProgressValue,
                `${this._photoManagerVideoProgressMessage || '処理中'}（経過 ${elapsed}）`
            );
        }

        stopPhotoManagerVideoOperationProgress() {
            if (this._photoManagerVideoProgressTimer) window.clearInterval(this._photoManagerVideoProgressTimer);
            this._photoManagerVideoProgressTimer = null;
            this._photoManagerVideoProgressOperation = '';
        }

        remapPhotoManagerVideoTrimReferences(videoId = '', removedStart = 0, duration = 0) {
            const seen = new WeakSet();
            const visit = value => {
                if (!value || typeof value !== 'object' || seen.has(value)) return;
                seen.add(value);
                if (String(value.videoId || '') === String(videoId)) {
                    const previousStart = Math.max(0, Number(value.videoTrimStart) || 0);
                    const previousEnd = Math.max(previousStart, Number(value.videoTrimEnd) || duration + removedStart);
                    let nextStart = Math.max(0, Math.min(duration, previousStart - removedStart));
                    let nextEnd = Math.max(0, Math.min(duration, previousEnd - removedStart));
                    if (nextEnd <= nextStart) {
                        nextStart = 0;
                        nextEnd = duration;
                    }
                    value.videoTrimStart = nextStart;
                    value.videoTrimEnd = nextEnd;
                }
                if (Array.isArray(value)) value.forEach(visit);
                else Object.values(value).forEach(visit);
            };
            visit(store.activeData);
            document.querySelectorAll(`.shift-photo-compare-mark.video[data-video-id="${CSS.escape(String(videoId))}"]`).forEach(mark => {
                const previousStart = Math.max(0, Number(mark.dataset.videoTrimStart) || 0);
                const previousEnd = Math.max(previousStart, Number(mark.dataset.videoTrimEnd) || duration + removedStart);
                let nextStart = Math.max(0, Math.min(duration, previousStart - removedStart));
                let nextEnd = Math.max(0, Math.min(duration, previousEnd - removedStart));
                if (nextEnd <= nextStart) {
                    nextStart = 0;
                    nextEnd = duration;
                }
                mark.dataset.videoTrimStart = String(nextStart);
                mark.dataset.videoTrimEnd = String(nextEnd);
                const video = mark.querySelector('video');
                if (video) delete video.dataset.videoHydrated;
            });
        }

        async getPhotoManagerVideoFFmpeg() {
            if (this._photoManagerVideoFFmpegLoading) return this._photoManagerVideoFFmpegLoading;
            if (!window.FFmpeg?.createFFmpeg) throw new Error('動画切り出しエンジンを読み込めませんでした。');
            if (this._photoManagerVideoProgressOperation === 'convert') {
                this.setPhotoManagerVideoOperationProgress(6, '変換エンジンを読み込み中');
            } else {
                this.updatePhotoManagerVideoCutProgress(0, '切り出しエンジンを読み込み中');
            }
            this._photoManagerVideoFFmpegLoading = (async () => {
                const ffmpeg = window.FFmpeg.createFFmpeg({
                    log: false,
                    mainName: 'main',
                    corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js',
                    progress: ({ ratio }) => {
                        const value = Math.max(0, Math.min(0.99, Number(ratio) || 0));
                        if (this._photoManagerVideoProgressOperation === 'convert') {
                            this.setPhotoManagerVideoOperationProgress(18 + value * 76, '動画を変換・圧縮中');
                        } else {
                            this.updatePhotoManagerVideoCutProgress(value * 100, '動画を切り出し中');
                        }
                    }
                });
                await ffmpeg.load();
                this._photoManagerVideoFFmpeg = ffmpeg;
                return ffmpeg;
            })();
            try {
                return await this._photoManagerVideoFFmpegLoading;
            } finally {
                this._photoManagerVideoFFmpegLoading = null;
            }
        }

        getPhotoManagerVideoInputExtension(blob) {
            const type = String(blob?.type || '').toLowerCase();
            if (type.includes('mp4')) return 'mp4';
            if (type.includes('quicktime')) return 'mov';
            if (type.includes('ogg')) return 'ogv';
            if (type.includes('avi')) return 'avi';
            return 'webm';
        }

        async cutPhotoManagerVideoWithFFmpeg(blob, start = 0, end = 0, options = {}) {
            const ffmpeg = await this.getPhotoManagerVideoFFmpeg();
            const duration = Math.max(0.1, Number(end) - Number(start));
            const sourceDuration = Math.max(duration, Number(options.sourceDuration) || Number(end) || duration);
            const sourceBitsPerSecond = Math.max(24000, Math.round((Number(blob?.size) || 0) * 8 / sourceDuration));
            const bitrateFactor = Math.max(0.35, Math.min(0.95, Number(options.bitrateFactor) || 0.9));
            const targetTotalBitsPerSecond = Math.max(24000, Math.min(8100000, Math.round(sourceBitsPerSecond * bitrateFactor)));
            const audioBitsPerSecond = Math.max(16000, Math.min(96000, Math.round(targetTotalBitsPerSecond * 0.12)));
            const videoBitsPerSecond = Math.max(8000, targetTotalBitsPerSecond - audioBitsPerSecond);
            const videoKbps = Math.max(8, Math.floor(videoBitsPerSecond / 1000));
            const audioKbps = Math.max(16, Math.floor(audioBitsPerSecond / 1000));
            const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
            const inputName = `input-${token}.${this.getPhotoManagerVideoInputExtension(blob)}`;
            const outputName = `output-${token}.webm`;
            try {
                this.updatePhotoManagerVideoCutProgress(0, '元動画を準備中');
                ffmpeg.FS('writeFile', inputName, new Uint8Array(await blob.arrayBuffer()));
                await ffmpeg.run(
                    '-ss', Number(start).toFixed(3),
                    '-i', inputName,
                    '-t', duration.toFixed(3),
                    '-map', '0:v:0',
                    '-map', '0:a?',
                    '-c:v', 'libvpx-vp9',
                    '-deadline', 'good',
                    '-cpu-used', '2',
                    '-crf', '32',
                    '-b:v', `${videoKbps}k`,
                    '-maxrate', `${Math.max(videoKbps, Math.round(videoKbps * 1.12))}k`,
                    '-bufsize', `${Math.max(16, videoKbps * 2)}k`,
                    '-c:a', 'libopus',
                    '-b:a', `${audioKbps}k`,
                    '-avoid_negative_ts', 'make_zero',
                    outputName
                );
                const data = ffmpeg.FS('readFile', outputName);
                const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data);
                if (!bytes.byteLength) throw new Error('FFmpegから動画データを取得できませんでした。');
                return {
                    blob: new Blob([bytes], { type: 'video/webm' }),
                    duration,
                    start: Number(start) || 0,
                    end: Number(end) || duration,
                    audioRemoved: false
                };
            } finally {
                try { ffmpeg.FS('unlink', inputName); } catch {}
                try { ffmpeg.FS('unlink', outputName); } catch {}
                try { ffmpeg.exit?.(); } catch {}
                if (this._photoManagerVideoFFmpeg === ffmpeg) this._photoManagerVideoFFmpeg = null;
            }
        }

        getPhotoManagerVideoConvertedDimensions(item, resolution = 'original') {
            const width = Math.max(2, Number(item?.width) || 1920);
            const height = Math.max(2, Number(item?.height) || 1080);
            const maxHeight = resolution === 'original' ? height : Math.max(2, Number(resolution) || height);
            const scale = Math.min(1, maxHeight / height);
            const even = value => Math.max(2, Math.round(value / 2) * 2);
            return { width: even(width * scale), height: even(height * scale) };
        }

        async convertPhotoManagerVideoWithFFmpeg(blob, item, options = {}) {
            const ffmpeg = await this.getPhotoManagerVideoFFmpeg();
            const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
            const inputName = `convert-input-${token}.${this.getPhotoManagerVideoInputExtension(blob)}`;
            const format = options.format === 'mp4' ? 'mp4' : 'webm';
            const outputName = `convert-output-${token}.${format}`;
            const quality = ['standard', 'compact'].includes(options.quality) ? options.quality : 'high';
            const dimensions = this.getPhotoManagerVideoConvertedDimensions(item, options.resolution);
            const sourceWidth = Math.max(2, Number(item?.width) || dimensions.width);
            const sourceHeight = Math.max(2, Number(item?.height) || dimensions.height);
            const resizeArgs = dimensions.width !== sourceWidth || dimensions.height !== sourceHeight
                ? ['-vf', `scale=${dimensions.width}:${dimensions.height}:flags=lanczos`]
                : [];
            const codecArgs = format === 'mp4'
                ? ['-c:v', 'libx264', '-preset', 'medium', '-crf', ({ high: '19', standard: '23', compact: '28' })[quality], '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', quality === 'compact' ? '96k' : '128k', '-movflags', '+faststart']
                : ['-c:v', 'libvpx-vp9', '-deadline', 'good', '-cpu-used', '2', '-crf', ({ high: '24', standard: '30', compact: '36' })[quality], '-b:v', '0', '-c:a', 'libopus', '-b:a', quality === 'compact' ? '96k' : '128k'];
            try {
                this.setPhotoManagerVideoOperationProgress(9, '元動画を読み込み中');
                const sourceBytes = new Uint8Array(await blob.arrayBuffer());
                this.setPhotoManagerVideoOperationProgress(14, '元動画を変換エンジンへ準備中');
                await new Promise(resolve => window.setTimeout(resolve, 0));
                ffmpeg.FS('writeFile', inputName, sourceBytes);
                this.setPhotoManagerVideoOperationProgress(18, '動画を変換・圧縮中');
                await ffmpeg.run(
                    '-i', inputName,
                    '-map', '0:v:0',
                    '-map', '0:a?',
                    ...resizeArgs,
                    ...codecArgs,
                    outputName
                );
                this.setPhotoManagerVideoOperationProgress(95, '変換結果を取り出し中');
                const data = ffmpeg.FS('readFile', outputName);
                const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data);
                if (!bytes.byteLength) throw new Error('変換後の動画データを取得できませんでした。');
                return {
                    blob: new Blob([bytes], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' }),
                    format,
                    width: dimensions.width,
                    height: dimensions.height
                };
            } finally {
                try { ffmpeg.FS('unlink', inputName); } catch {}
                try { ffmpeg.FS('unlink', outputName); } catch {}
                try { ffmpeg.exit?.(); } catch {}
                if (this._photoManagerVideoFFmpeg === ffmpeg) this._photoManagerVideoFFmpeg = null;
            }
        }

        async convertPhotoManagerVideo(id = '') {
            const item = this.getPhotoManagerVideo(id);
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            if (!item || !panel || this._photoManagerVideoCutting) return;
            const options = this.getPhotoManagerVideoConversionOptions(panel);
            const formatLabel = options.format === 'mp4' ? 'MP4（H.264）' : 'WebM（VP9）';
            const saveLabel = options.saveMode === 'replace' ? '元動画を置き換えます。元に戻せません。' : '元動画を残して別動画として保存します。';
            if (!confirm(`${formatLabel}へ変換・圧縮します。\n${saveLabel}\n処理には動画の長さ以上の時間がかかる場合があります。続けますか？`)) return;
            const button = panel.querySelector('.photo-manager-video-convert-btn');
            let createdMediaKey = '';
            this._photoManagerVideoCutting = true;
            if (button) button.disabled = true;
            try {
                this.startPhotoManagerVideoOperationProgress('元動画を保管場所から読み込み中', 2);
                const sourceBlob = await store.loadMediaBlob(this.getPhotoManagerVideoMediaKey(id));
                if (!sourceBlob) throw new Error('元動画が見つかりません。');
                const previousSize = Number(item.size) || sourceBlob.size;
                this.setPhotoManagerVideoOperationProgress(4, '変換処理を準備中');
                const result = await this.convertPhotoManagerVideoWithFFmpeg(sourceBlob, item, options);
                if (result.blob.size > this.getPhotoManagerVideoMaxBytes()) throw new Error('変換後の動画が100MBを超えました。');
                this.setPhotoManagerVideoOperationProgress(98, '変換後の動画を保存中');
                const now = Date.now();
                const extension = result.format;
                if (options.saveMode === 'replace') {
                    await store.saveMediaBlob(this.getPhotoManagerVideoMediaKey(id), result.blob);
                    item.size = result.blob.size;
                    item.type = result.blob.type;
                    item.fileName = `${String(item.fileName || 'video').replace(/\.[^.]+$/, '')}.${extension}`;
                    item.width = result.width;
                    item.height = result.height;
                    item.updatedAt = now;
                } else {
                    const newId = `pmv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
                    createdMediaKey = this.getPhotoManagerVideoMediaKey(newId);
                    await store.saveMediaBlob(createdMediaKey, result.blob);
                    this.getPhotoManagerVideos().unshift({
                        ...item,
                        id: newId,
                        name: `${String(item.name || '動画').slice(0, 86)}（圧縮）`,
                        fileName: `${String(item.fileName || 'video').replace(/\.[^.]+$/, '')}-compressed.${extension}`,
                        type: result.blob.type,
                        size: result.blob.size,
                        width: result.width,
                        height: result.height,
                        createdAt: now,
                        updatedAt: now
                    });
                }
                await store.save();
                this.setPhotoManagerVideoOperationProgress(100, '完了');
                createdMediaKey = '';
                const difference = previousSize - result.blob.size;
                this.openPhotoManagerVideos();
                this.showPhotoManagerNotice(difference > 0
                    ? `${this.formatPhotoManagerBytes(difference)}削減しました。変換後は${this.formatPhotoManagerBytes(result.blob.size)}です。`
                    : `変換しました。容量は${this.formatPhotoManagerBytes(result.blob.size)}です。`);
            } catch (error) {
                if (createdMediaKey) {
                    try { await store.deleteMediaBlob(createdMediaKey); } catch {}
                }
                console.warn('Video conversion failed', error);
                this.showPhotoManagerNotice(error?.message || '動画を変換できませんでした。');
                const progress = panel.querySelector('.photo-manager-video-cut-progress');
                if (progress) {
                    progress.hidden = false;
                    progress.classList.add('error');
                    const label = progress.querySelector('span');
                    const output = progress.querySelector('output');
                    if (label) label.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${this.escapeHtml(error?.message || '動画変換に失敗しました。')}`;
                    if (output) output.value = '失敗';
                }
            } finally {
                this.stopPhotoManagerVideoOperationProgress();
                this._photoManagerVideoCutting = false;
                if (button && document.contains(button)) button.disabled = false;
            }
        }

        async recordPhotoManagerVideoTrim(blob, start = 0, end = 0, onProgress = null, sourceVideo = null, forceCanvas = false) {
            const mimeType = this.getPhotoManagerVideoRecordingMimeType();
            if (!mimeType) throw new Error('このブラウザーは動画の切り出しに対応していません。');
            const ownsVideo = !sourceVideo;
            const sourceUrl = ownsVideo ? URL.createObjectURL(blob) : '';
            const video = sourceVideo || document.createElement('video');
            let activeStream = null;
            let activeRecorder = null;
            let drawTimer = null;
            const previousMuted = video.muted;
            const previousTimeUpdate = video.ontimeupdate;
            const previousError = video.onerror;
            const previousSeeked = video.onseeked;
            const previousEnded = video.onended;
            const previousCurrentTime = Number(video.currentTime) || 0;
            if (ownsVideo) {
                video.preload = 'auto';
                video.playsInline = true;
                video.className = 'photo-manager-video-cut-source';
                document.body.appendChild(video);
            }
            video.muted = true;
            video.ontimeupdate = null;
            const cleanup = () => {
                video.pause();
                if (activeRecorder?.state && activeRecorder.state !== 'inactive') {
                    try { activeRecorder.stop(); } catch {}
                }
                activeRecorder = null;
                clearInterval(drawTimer);
                drawTimer = null;
                activeStream?.getTracks?.().forEach(track => track.stop());
                activeStream = null;
                if (ownsVideo) {
                    URL.revokeObjectURL(sourceUrl);
                    video.removeAttribute('src');
                    video.load();
                    video.remove();
                } else {
                    video.muted = previousMuted;
                    video.ontimeupdate = previousTimeUpdate;
                    video.onerror = previousError;
                    video.onseeked = previousSeeked;
                    video.onended = previousEnded;
                    try { video.currentTime = previousCurrentTime; } catch {}
                }
            };
            try {
                await new Promise((resolve, reject) => {
                    if (video.readyState >= 1) return resolve();
                    video.onloadedmetadata = resolve;
                    video.onerror = () => reject(new Error('元動画を読み込めませんでした。'));
                    if (ownsVideo) video.src = sourceUrl;
                });
                const safeStart = Math.max(0, Math.min(video.duration, Number(start) || 0));
                const safeEnd = Math.max(safeStart + 0.1, Math.min(video.duration, Number(end) || video.duration));
                await new Promise((resolve, reject) => {
                    if (Math.abs(video.currentTime - safeStart) < 0.01) return resolve();
                    video.onseeked = resolve;
                    video.onerror = () => reject(new Error('切り出し位置へ移動できませんでした。'));
                    video.currentTime = safeStart;
                });
                if (forceCanvas) {
                    const canvas = document.createElement('canvas');
                    const sourceWidth = Math.max(2, Number(video.videoWidth) || 1280);
                    const sourceHeight = Math.max(2, Number(video.videoHeight) || 720);
                    const renderScale = Math.min(1, 1280 / sourceWidth, 720 / sourceHeight);
                    canvas.width = Math.max(2, Math.round(sourceWidth * renderScale));
                    canvas.height = Math.max(2, Math.round(sourceHeight * renderScale));
                    const context = canvas.getContext('2d', { alpha: false });
                    if (!context || typeof canvas.captureStream !== 'function') {
                        throw new Error('このブラウザーは動画の互換切り出しに対応していません。');
                    }
                    const drawFrame = () => {
                        try { context.drawImage(video, 0, 0, canvas.width, canvas.height); } catch {}
                    };
                    drawFrame();
                    drawTimer = setInterval(drawFrame, 50);
                    activeStream = canvas.captureStream(20);
                    onProgress?.(0, '互換方式で再試行中');
                } else {
                    activeStream = video.captureStream?.() || video.mozCaptureStream?.() || null;
                    if (!activeStream) {
                        cleanup();
                        return this.recordPhotoManagerVideoTrim(blob, start, end, onProgress, sourceVideo, true);
                    }
                }
                const sourceBitrate = Math.max(500000, Math.round((blob.size * 8) / Math.max(1, video.duration)));
                activeRecorder = new MediaRecorder(activeStream, {
                    mimeType,
                    videoBitsPerSecond: Math.min(4000000, sourceBitrate),
                    audioBitsPerSecond: 128000
                });
                const chunks = [];
                activeRecorder.ondataavailable = event => {
                    if (event.data?.size) chunks.push(event.data);
                };
                let recordingError = null;
                const stopped = new Promise(resolve => {
                    activeRecorder.onerror = () => {
                        recordingError = activeRecorder?.error || new Error('動画を切り出せませんでした。');
                        resolve();
                    };
                    activeRecorder.onstop = resolve;
                });
                activeRecorder.start(500);
                await new Promise(resolve => setTimeout(resolve, 250));
                await video.play();
                await new Promise((resolve, reject) => {
                    let lastTime = video.currentTime;
                    let lastAdvanceAt = Date.now();
                    const hardLimitAt = Date.now() + Math.max(30000, (safeEnd - safeStart) * 3000 + 15000);
                    const finish = () => {
                        clearInterval(timer);
                        video.onended = null;
                        resolve();
                    };
                    const fail = message => {
                        clearInterval(timer);
                        video.onended = null;
                        reject(new Error(message));
                    };
                    const timer = setInterval(() => {
                        const ratio = Math.max(0, Math.min(1, (video.currentTime - safeStart) / (safeEnd - safeStart)));
                        onProgress?.(ratio * 100, forceCanvas ? '互換方式で切り出し中' : '切り出し中');
                        if (video.currentTime > lastTime + 0.01) {
                            lastTime = video.currentTime;
                            lastAdvanceAt = Date.now();
                        }
                        if (video.currentTime >= safeEnd - 0.03 || video.ended) {
                            video.pause();
                            finish();
                            return;
                        }
                        if (Date.now() >= hardLimitAt || Date.now() - lastAdvanceAt > 10000) {
                            fail('動画の再生が停止したため、切り出しを中止しました。');
                            return;
                        }
                        if (video.paused) video.play().catch(() => {});
                    }, 200);
                    video.onended = finish;
                });
                if (activeRecorder.state === 'recording') {
                    try { activeRecorder.requestData(); } catch {}
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                if (activeRecorder.state !== 'inactive') {
                    try { activeRecorder.stop(); } catch {}
                }
                await Promise.race([
                    stopped,
                    new Promise(resolve => setTimeout(resolve, 5000))
                ]);
                if (recordingError) throw recordingError;
                const result = new Blob(chunks, { type: mimeType.split(';')[0] });
                cleanup();
                if (!result.size && !forceCanvas) {
                    return this.recordPhotoManagerVideoTrim(blob, start, end, onProgress, sourceVideo, true);
                }
                if (!result.size) throw new Error('互換方式でも切り出しデータを取得できませんでした。');
                return { blob: result, duration: safeEnd - safeStart, start: safeStart, end: safeEnd, audioRemoved: forceCanvas };
            } catch (error) {
                cleanup();
                throw error;
            }
        }

        async cutPhotoManagerVideoToTrim(id = '') {
            const item = this.getPhotoManagerVideo(id);
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            if (!item || !panel || this._photoManagerVideoCutting) return;
            const start = Math.max(0, Number(panel.querySelector('.photo-manager-video-trim-start')?.value) || 0);
            const end = Math.max(start + 0.1, Math.min(item.duration, Number(panel.querySelector('.photo-manager-video-trim-end')?.value) || item.duration));
            if (start <= 0.01 && end >= item.duration - 0.01) {
                this.showPhotoManagerNotice('削除する範囲がありません。開始または終了位置を変更してください。');
                return;
            }
            if (!confirm(`使用範囲 ${this.formatPhotoManagerVideoDuration(start)} ～ ${this.formatPhotoManagerVideoDuration(end)} だけを残します。\n範囲外の元動画は削除され、元に戻せません。続けますか？`)) return;
            const button = panel.querySelector('.photo-manager-video-cut-btn');
            this._photoManagerVideoCutting = true;
            if (button) button.disabled = true;
            try {
                const sourceBlob = await store.loadMediaBlob(this.getPhotoManagerVideoMediaKey(id));
                if (!sourceBlob) throw new Error('元動画が見つかりません。');
                this.updatePhotoManagerVideoCutProgress(0, '切り出し中');
                let result = await this.cutPhotoManagerVideoWithFFmpeg(sourceBlob, start, end, {
                    sourceDuration: item.duration,
                    bitrateFactor: 0.9
                });
                if (result.blob.size >= sourceBlob.size) {
                    this.updatePhotoManagerVideoCutProgress(2, '容量を抑えて再処理中');
                    result = await this.cutPhotoManagerVideoWithFFmpeg(sourceBlob, start, end, {
                        sourceDuration: item.duration,
                        bitrateFactor: 0.65
                    });
                }
                if (result.blob.size >= sourceBlob.size) {
                    throw new Error('トリミング後の容量が元動画以上になるため、元動画を残しました。圧縮設定から容量優先を選ぶとさらに小さくできます。');
                }
                if (result.blob.size > this.getPhotoManagerVideoMaxBytes()) throw new Error('切り出し後の動画が100MBを超えました。');
                this.updatePhotoManagerVideoCutProgress(100, '保存中');
                await store.saveMediaBlob(this.getPhotoManagerVideoMediaKey(id), result.blob);
                const previousSize = Number(item.size) || sourceBlob.size;
                item.size = result.blob.size;
                item.type = result.blob.type || 'video/webm';
                item.fileName = String(item.fileName || 'video').replace(/\.[^.]+$/, '') + '.webm';
                item.duration = result.duration;
                item.trimStart = 0;
                item.trimEnd = result.duration;
                item.audioRemovedByTrim = !!result.audioRemoved;
                item.name = String(panel.querySelector('.photo-manager-video-name')?.value || item.name || '動画').trim().slice(0, 100);
                item.animationClickMode = panel.querySelector('input[name="photo-manager-video-click-mode"]:checked')?.value === 'stop' ? 'stop' : 'continue';
                item.updatedAt = Date.now();
                this.remapPhotoManagerVideoTrimReferences(id, result.start, result.duration);
                await store.save();
                const difference = previousSize - result.blob.size;
                this.openPhotoManagerVideos();
                const audioNote = result.audioRemoved ? ' 互換方式のため音声は含まれません。' : '';
                this.showPhotoManagerNotice((difference > 0
                    ? `${this.formatPhotoManagerBytes(difference)}削減しました。`
                    : `範囲外を削除しました。容量は${this.formatPhotoManagerBytes(Math.abs(difference))}増えました。`) + audioNote);
            } catch (error) {
                console.warn('Video destructive trim failed', error);
                this.showPhotoManagerNotice(error?.message || '動画を切り出せませんでした。');
                const progress = panel.querySelector('.photo-manager-video-cut-progress');
                if (progress) {
                    progress.hidden = false;
                    progress.classList.add('error');
                    const label = progress.querySelector('span');
                    const output = progress.querySelector('output');
                    if (label) label.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${this.escapeHtml(error?.message || '切り出し保存に失敗しました。')}`;
                    if (output) output.value = '失敗';
                }
            } finally {
                this._photoManagerVideoCutting = false;
                if (button && document.contains(button)) button.disabled = false;
            }
        }

        async savePhotoManagerVideoEdits(id = '') {
            const item = this.getPhotoManagerVideo(id);
            const panel = document.querySelector('#photo-manager-video-modal .photo-manager-video-panel');
            if (!item || !panel || item.size > this.getPhotoManagerVideoMaxBytes()) return;
            item.name = String(panel.querySelector('.photo-manager-video-name')?.value || item.name || '動画').trim().slice(0, 100);
            if (item.sourceType) {
                const values = this.getPhotoManagerExternalVideoTrimValues(item, panel);
                if (!Number.isFinite(values.start) || (values.hasEnd && !Number.isFinite(values.end))) {
                    this.showPhotoManagerNotice('開始・終了時刻は「1:30」または「0:01:30」の形式で入力してください。');
                    return;
                }
                if (values.hasEnd && values.end <= values.start) {
                    this.showPhotoManagerNotice('終了時刻は開始時刻より後にしてください。');
                    panel.querySelector('.photo-manager-video-time-end')?.focus();
                    return;
                }
                const duration = Math.max(0, Number(item.duration) || 0);
                item.trimStart = duration > 0 ? Math.min(values.start, Math.max(0, duration - 0.1)) : values.start;
                item.trimEnd = values.hasEnd
                    ? (duration > 0 ? Math.min(values.end, duration) : values.end)
                    : duration;
                if (item.trimEnd > 0 && item.trimEnd <= item.trimStart) {
                    this.showPhotoManagerNotice('使用範囲が短すぎます。開始・終了時刻を確認してください。');
                    return;
                }
                item.animationClickMode = panel.querySelector('input[name="photo-manager-video-click-mode"]:checked')?.value === 'stop' ? 'stop' : 'continue';
                item.updatedAt = Date.now();
                this.syncPhotoManagerVideoTrimReferences(item.id, item.trimStart, item.trimEnd);
                await store.save();
                this.openPhotoManagerVideos();
                this.showPhotoManagerNotice('非破壊の使用範囲を保存しました。元動画は変更していません。');
                return;
            }
            item.trimStart = Math.max(0, Number(panel.querySelector('.photo-manager-video-trim-start')?.value) || 0);
            item.trimEnd = Math.max(item.trimStart + 0.1, Math.min(item.duration, Number(panel.querySelector('.photo-manager-video-trim-end')?.value) || item.duration));
            item.animationClickMode = panel.querySelector('input[name="photo-manager-video-click-mode"]:checked')?.value === 'stop' ? 'stop' : 'continue';
            item.updatedAt = Date.now();
            await store.save();
            this.openPhotoManagerVideos();
            this.showPhotoManagerNotice('動画設定を保存しました。');
        }

        async deletePhotoManagerVideo(id = '') {
            const item = this.getPhotoManagerVideo(id);
            if (!item || !confirm(`「${item.name || '動画'}」を削除しますか？\n写真編集に配置済みの動画も再生できなくなります。`)) return;
            store.activeData.photoManagerVideos = this.getPhotoManagerVideos().filter(video => video.id !== id);
            if (!item.sourceType || item.sourceType === 'local-handle') await store.deleteMediaBlob(this.getPhotoManagerVideoMediaKey(id));
            await store.save();
            this.openPhotoManagerVideos();
        }

        openShiftPhotoCompareVideoPicker() {
            document.getElementById('shift-photo-compare-video-picker')?.remove();
            const videos = this.getPhotoManagerVideos();
            document.body.insertAdjacentHTML('beforeend', `
                <div id="shift-photo-compare-video-picker" class="shift-photo-compare-video-picker" onclick="if(event.target===this)this.remove()">
                    <section onclick="event.stopPropagation()">
                        <header><strong><i class="fa-solid fa-video"></i> 動画を挿入</strong><button type="button" onclick="this.closest('#shift-photo-compare-video-picker').remove()"><i class="fa-solid fa-xmark"></i></button></header>
                        <div>
                            ${videos.length ? videos.map(video => `<button type="button" onclick="app.insertShiftPhotoCompareVideo('${this.escapeJs(video.id)}')"><i class="${video.sourceType === 'youtube' ? 'fa-brands fa-youtube' : (video.sourceType === 'local-handle' ? 'fa-solid fa-folder-open' : 'fa-solid fa-circle-play')}"></i><span><b>${this.escapeHtml(video.name || '動画')}</b><small>${video.sourceType === 'local-handle' ? 'PCリンク・容量不要' : (video.sourceType ? 'URL動画・容量不要' : this.formatPhotoManagerBytes(video.size))}${this.getPhotoManagerVideoTrimSummary(video) ? ` / 使用 ${this.getPhotoManagerVideoTrimSummary(video)}` : ''}</small></span></button>`).join('') : '<p>写真管理の「動画」から登録してください。</p>'}
                        </div>
                    </section>
                </div>`);
        }

        createPhotoManagerVideoAttachmentReference(video = {}) {
            const id = String(video?.id || '');
            if (!id) return null;
            return {
                source: 'photoManagerVideo',
                videoId: id,
                name: video.name || video.fileName || '動画',
                thumbnailUrl: video.thumbnailUrl || ''
            };
        }

        createRegisteredVideoAttachmentPreview(reference = {}, onRemove = null, size = 80) {
            const id = String(reference.videoId || reference.id || '');
            if (!id) return null;
            const video = this.getPhotoManagerVideo(id);
            const name = reference.name || video?.name || video?.fileName || '動画';
            const thumbnailUrl = video?.thumbnailUrl || reference.thumbnailUrl || '';
            const div = document.createElement('div');
            div.className = 'registered-video-attachment';
            div.dataset.videoId = id;
            div.style.setProperty('--attachment-size', `${Math.max(56, Number(size) || 80)}px`);
            div.innerHTML = `
                <button type="button" class="registered-video-attachment-open" title="${this.escapeHtml(name)}" aria-label="${this.escapeHtml(name)}を再生">
                    <span class="registered-video-attachment-placeholder"><i class="fa-solid fa-video"></i></span>
                    ${thumbnailUrl
                        ? `<img src="${this.escapeHtml(thumbnailUrl)}" alt="" data-video-thumbnail-id="${this.escapeHtml(id)}">`
                        : `<video class="registered-video-attachment-thumbnail" data-video-id="${this.escapeHtml(id)}" muted playsinline preload="metadata"></video>`}
                    <span class="registered-video-attachment-play"><i class="fa-solid fa-play"></i></span>
                    <span class="registered-video-attachment-status" hidden><i class="fa-solid fa-triangle-exclamation"></i><b></b></span>
                </button>
                <small>${this.escapeHtml(name)}</small>
                <button type="button" class="close-btn registered-video-attachment-remove" title="削除" aria-label="削除"><i class="fa-solid fa-xmark"></i></button>
            `;
            const thumbnail = div.querySelector('.registered-video-attachment-thumbnail');
            requestAnimationFrame(() => {
                if (thumbnail && video) this.hydrateRegisteredVideoAttachmentThumbnail(video, thumbnail, div);
                this.refreshRegisteredVideoAttachmentStatus(div, video);
            });
            div.querySelector('.registered-video-attachment-open').onclick = event => {
                event.stopPropagation();
                this.openRegisteredVideoAttachment(id);
            };
            div.querySelector('.registered-video-attachment-remove').onclick = event => {
                event.stopPropagation();
                div.remove();
                onRemove?.();
            };
            return div;
        }

        setRegisteredVideoAttachmentStatus(container, state = 'ok', message = '') {
            if (!container) return;
            container.classList.toggle('video-source-unavailable', state === 'missing' || state === 'reconnect');
            container.classList.toggle('video-source-reconnect', state === 'reconnect');
            const badge = container.querySelector('.registered-video-attachment-status');
            if (!badge) return;
            badge.hidden = state === 'ok' || state === 'checking';
            const label = badge.querySelector('b');
            if (label) label.textContent = message || (state === 'reconnect' ? '再接続' : 'リンク切れ');
        }

        async getRegisteredVideoAttachmentStatus(video) {
            if (!video) return { state: 'missing', message: '登録元なし' };
            try {
                if (video.sourceType === 'youtube') return { state: 'ok', message: '' };
                if (video.sourceType === 'local-handle') {
                    const handle = await store.loadMediaFileHandle(this.getPhotoManagerVideoMediaKey(video.id));
                    if (!handle) return { state: 'reconnect', message: '再接続' };
                    if (!(await this.hasPhotoManagerLocalVideoPermission(handle, false))) {
                        return { state: 'reconnect', message: '許可が必要' };
                    }
                    const file = await handle.getFile();
                    return file?.type?.startsWith?.('video/')
                        ? { state: 'ok', message: '' }
                        : { state: 'reconnect', message: '再接続' };
                }
                if (!video.sourceType) {
                    const blob = await store.loadMediaBlob(this.getPhotoManagerVideoMediaKey(video.id));
                    return blob ? { state: 'ok', message: '' } : { state: 'missing', message: '元動画なし' };
                }
                if (video.sourceType === 'url') {
                    if (!video.sourceUrl) return { state: 'missing', message: 'URLなし' };
                    return await new Promise(resolve => {
                        const probe = document.createElement('video');
                        let done = false;
                        const finish = result => {
                            if (done) return;
                            done = true;
                            probe.removeAttribute('src');
                            probe.load();
                            resolve(result);
                        };
                        const timer = setTimeout(() => finish({ state: 'ok', message: '' }), 5000);
                        probe.preload = 'metadata';
                        probe.muted = true;
                        probe.onloadedmetadata = () => {
                            clearTimeout(timer);
                            finish({ state: 'ok', message: '' });
                        };
                        probe.onerror = () => {
                            clearTimeout(timer);
                            finish({ state: 'missing', message: 'リンク切れ' });
                        };
                        probe.src = video.sourceUrl;
                    });
                }
            } catch {}
            return { state: video?.sourceType === 'local-handle' ? 'reconnect' : 'missing', message: video?.sourceType === 'local-handle' ? '再接続' : 'リンク切れ' };
        }

        async refreshRegisteredVideoAttachmentStatus(container, video) {
            this.setRegisteredVideoAttachmentStatus(container, 'checking');
            const status = await this.getRegisteredVideoAttachmentStatus(video);
            if (!document.contains(container)) return status;
            this.setRegisteredVideoAttachmentStatus(container, status.state, status.message);
            return status;
        }
        refreshRegisteredVideoAttachmentStatuses(videoId = '') {
            const id = String(videoId || '');
            const video = this.getPhotoManagerVideo(id);
            document.querySelectorAll(`.registered-video-attachment[data-video-id="${CSS.escape(id)}"]`).forEach(container => {
                this.refreshRegisteredVideoAttachmentStatus(container, video);
            });
        }
        openRegisteredVideoAttachmentPicker(kind = '', target = null) {
            document.getElementById('registered-video-attachment-picker')?.remove();
            this._registeredVideoAttachmentTarget = { kind, target };
            const videos = this.getPhotoManagerVideos();
            document.body.insertAdjacentHTML('beforeend', `
                <div id="registered-video-attachment-picker" class="registered-video-picker" onclick="if(event.target===this)app.closeRegisteredVideoAttachmentPicker()">
                    <section role="dialog" aria-modal="true" aria-label="登録動画を選択" onclick="event.stopPropagation()">
                        <header>
                            <strong><i class="fa-solid fa-video"></i> 登録動画を選択</strong>
                            <button type="button" onclick="app.closeRegisteredVideoAttachmentPicker()" title="閉じる" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
                        </header>
                        <div class="registered-video-picker-list">
                            ${videos.length ? videos.map(video => `
                                <button type="button" class="registered-video-picker-item" onclick="app.selectRegisteredVideoAttachment('${this.escapeJs(video.id)}')">
                                    <span class="registered-video-picker-preview">
                                        ${video.thumbnailUrl
                                            ? `<img src="${this.escapeHtml(video.thumbnailUrl)}" alt="" data-video-thumbnail-id="${this.escapeHtml(video.id)}">`
                                            : `<i class="${video.sourceType === 'youtube' ? 'fa-brands fa-youtube' : 'fa-solid fa-video'}"></i><video class="registered-video-picker-thumbnail" data-video-id="${this.escapeHtml(video.id)}" muted playsinline preload="metadata"></video>`}
                                        <i class="fa-solid fa-play"></i>
                                    </span>
                                    <span>
                                        <b>${this.escapeHtml(video.name || video.fileName || '動画')}</b>
                                        <small>${video.sourceType === 'local-handle' ? 'PCリンク' : (video.sourceType ? 'URL動画' : this.formatPhotoManagerBytes(video.size))}${this.getPhotoManagerVideoTrimSummary(video) ? ` / 使用 ${this.getPhotoManagerVideoTrimSummary(video)}` : ''}</small>
                                    </span>
                                </button>
                            `).join('') : '<div class="registered-video-picker-empty"><i class="fa-solid fa-video-slash"></i><p>写真管理に登録された動画はありません。</p></div>'}
                        </div>
                    </section>
                </div>
            `);
            document.querySelectorAll('#registered-video-attachment-picker .registered-video-picker-thumbnail').forEach(element => {
                const video = this.getPhotoManagerVideo(element.dataset.videoId || '');
                if (video) this.hydrateRegisteredVideoAttachmentThumbnail(video, element);
            });
        }

        releaseRegisteredVideoAttachmentThumbnail(element) {
            const url = element?._registeredVideoThumbnailObjectUrl || '';
            if (url) URL.revokeObjectURL(url);
            if (element) element._registeredVideoThumbnailObjectUrl = '';
        }

        async hydrateRegisteredVideoAttachmentThumbnail(video, element, statusContainer = null) {
            if (!video || !element || video.sourceType === 'youtube') return false;
            try {
                let source = '';
                if (video.sourceType === 'url' && video.sourceUrl) {
                    source = video.sourceUrl;
                } else if (video.sourceType === 'local-handle') {
                    const file = await this.loadPhotoManagerLinkedVideoFile(video, false);
                    if (!file) {
                        this.setRegisteredVideoAttachmentStatus(statusContainer, 'reconnect', '再接続');
                        return false;
                    }
                    source = URL.createObjectURL(file);
                    element._registeredVideoThumbnailObjectUrl = source;
                } else {
                    const blob = await store.loadMediaBlob(this.getPhotoManagerVideoMediaKey(video.id));
                    if (!blob) {
                        this.setRegisteredVideoAttachmentStatus(statusContainer, 'missing', '元動画なし');
                        return false;
                    }
                    source = URL.createObjectURL(blob);
                    element._registeredVideoThumbnailObjectUrl = source;
                }
                if (!document.contains(element)) {
                    this.releaseRegisteredVideoAttachmentThumbnail(element);
                    return false;
                }
                const start = Math.max(0, Number(video.trimStart) || 0);
                element.src = source;
                element.muted = true;
                element.onerror = () => this.setRegisteredVideoAttachmentStatus(statusContainer, 'missing', 'リンク切れ');
                element.addEventListener('loadedmetadata', () => {
                    const duration = Math.max(0, Number(element.duration) || 0);
                    element.currentTime = Math.min(start || 0.08, Math.max(0, duration - 0.05));
                }, { once: true });
                const capture = () => {
                    if (!element.videoWidth || !element.videoHeight) return;
                    try {
                        const maxWidth = 360;
                        const scale = Math.min(1, maxWidth / element.videoWidth);
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.max(1, Math.round(element.videoWidth * scale));
                        canvas.height = Math.max(1, Math.round(element.videoHeight * scale));
                        canvas.getContext('2d').drawImage(element, 0, 0, canvas.width, canvas.height);
                        const image = document.createElement('img');
                        image.src = canvas.toDataURL('image/jpeg', 0.76);
                        image.alt = '';
                        image.dataset.videoThumbnailId = video.id;
                        if (!video.thumbnailUrl) {
                            video.thumbnailUrl = image.src;
                            Promise.resolve(store.save()).catch(() => {});
                        }
                        element.replaceWith(image);
                        this.releaseRegisteredVideoAttachmentThumbnail(element);
                    } catch {
                        element.classList.add('is-ready');
                    }
                };
                element.addEventListener('seeked', capture, { once: true });
                element.addEventListener('loadeddata', () => {
                    element.classList.add('is-ready');
                    if (start <= 0.001) capture();
                }, { once: true });
                element.load();
                return true;
            } catch (error) {
                this.releaseRegisteredVideoAttachmentThumbnail(element);
                console.warn('Video thumbnail loading failed.', error);
                return false;
            }
        }

        closeRegisteredVideoAttachmentPicker() {
            document.querySelectorAll('#registered-video-attachment-picker video').forEach(element => this.releaseRegisteredVideoAttachmentThumbnail(element));
            document.getElementById('registered-video-attachment-picker')?.remove();
            this._registeredVideoAttachmentTarget = null;
        }

        selectRegisteredVideoAttachment(id = '') {
            const video = this.getPhotoManagerVideo(id);
            const destination = this._registeredVideoAttachmentTarget;
            if (!video || !destination) return;
            const reference = this.createPhotoManagerVideoAttachmentReference(video);
            if (!reference) return;
            if (destination.kind === 'shift') {
                const input = destination.target?.querySelector?.('.shift-photo-input');
                input?._shiftPhotoAddSrc?.(reference);
            } else if (destination.kind === 'history') {
                const preview = document.getElementById(String(destination.target || ''));
                if (!Array.isArray(this._tempPhotos)) this._tempPhotos = [];
                this._tempPhotos.push(reference);
                this.appendHistoryPhotoPreview?.(preview, reference, 80);
                this.updateSaveStatus?.('dirty');
            } else if (destination.kind === 'guide') {
                if (!Array.isArray(this._tempPhotos)) this._tempPhotos = [];
                this._tempPhotos.push(this.normalizeGuidePhoto?.(reference) || reference);
                this.renderGuidePhotoPreviews?.();
                this.autoSaveGuideDraftFromModal?.();
            }
            this.closeRegisteredVideoAttachmentPicker();
            this.showToast?.('登録動画を添付しました。', 'success');
        }

        getRegisteredVideoAttachmentWidth() {
            try {
                return Math.max(360, Math.min(1400, Number(localStorage.getItem('registeredVideoAttachmentWidth')) || 900));
            } catch {
                return 900;
            }
        }

        setRegisteredVideoAttachmentWidth(width = 900) {
            const next = Math.max(360, Math.min(1400, Math.round(Number(width) || 900)));
            const card = document.querySelector('#registered-video-attachment-viewer .registered-video-viewer-card');
            card?.style.setProperty('--video-viewer-width', `${next}px`);
            const output = document.querySelector('#registered-video-attachment-viewer .registered-video-viewer-zoom');
            if (output) output.textContent = `${Math.round(next / 9)}%`;
            try { localStorage.setItem('registeredVideoAttachmentWidth', String(next)); } catch {}
        }

        async openRegisteredVideoAttachment(id = '') {
            const video = this.getPhotoManagerVideo(id);
            if (!video) {
                this.showToast?.('登録元の動画が見つかりません。', 'warning');
                return;
            }
            this.closeRegisteredVideoAttachment();
            const start = Math.max(0, Number(video.trimStart) || 0);
            const duration = Math.max(0, Number(video.duration) || 0);
            const end = Math.max(start, Number(video.trimEnd) || duration || 0);
            let playerHtml = '';
            if (video.sourceType === 'youtube' && video.youtubeId) {
                let embedUrl = this.getPhotoManagerYouTubeEmbedUrl(video.youtubeId, true, true);
                try {
                    const url = new URL(embedUrl);
                    if (start > 0) url.searchParams.set('start', String(Math.floor(start)));
                    if (end > start) url.searchParams.set('end', String(Math.ceil(end)));
                    url.searchParams.set('autoplay', '1');
                    embedUrl = url.href;
                } catch {}
                playerHtml = `<iframe class="registered-video-viewer-youtube" data-video-id="${this.escapeHtml(video.id)}" data-youtube-current-time="${start}" data-youtube-state="1" src="${this.escapeHtml(embedUrl)}" title="${this.escapeHtml(video.name || '動画')}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
            } else {
                playerHtml = `
                    <video class="registered-video-viewer-player" data-video-id="${this.escapeHtml(video.id)}" playsinline preload="metadata"></video>
                    <div class="registered-video-viewer-error">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <b>動画を開けません</b>
                        ${video.sourceType === 'local-handle' ? `
                            <div>
                                <button type="button" onclick="app.reconnectRegisteredVideoAttachment('${this.escapeJs(video.id)}')"><i class="fa-solid fa-link"></i> アクセス許可</button>
                                <button type="button" onclick="app.reselectPhotoManagerLocalVideo('${this.escapeJs(video.id)}')"><i class="fa-solid fa-folder-open"></i> 選び直す</button>
                            </div>
                        ` : (video.sourceType === 'url' ? `<button type="button" onclick="app.reconnectRegisteredVideoAttachment('${this.escapeJs(video.id)}')"><i class="fa-solid fa-rotate-right"></i> 再読み込み</button>` : '')}
                    </div>
                `;
            }
            const width = this.getRegisteredVideoAttachmentWidth();
            document.body.insertAdjacentHTML('beforeend', `
                <div id="registered-video-attachment-viewer" class="registered-video-viewer" onclick="if(event.target===this)app.closeRegisteredVideoAttachment()">
                    <section class="registered-video-viewer-card" style="--video-viewer-width:${width}px" role="dialog" aria-modal="true" aria-label="${this.escapeHtml(video.name || '動画')}" onclick="event.stopPropagation()">
                        <header>
                            <strong>${this.escapeHtml(video.name || video.fileName || '動画')}</strong>
                            <div>
                                <output class="registered-video-viewer-zoom">${Math.round(width / 9)}%</output>
                                <button type="button" onclick="app.toggleRegisteredVideoAttachmentFullscreen()" title="全画面" aria-label="全画面"><i class="fa-solid fa-expand"></i></button>
                                <button type="button" onclick="app.closeRegisteredVideoAttachment()" title="閉じる" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        </header>
                        <div class="registered-video-viewer-stage">${playerHtml}</div>
                        ${video.sourceType === 'youtube' ? '' : `
                            <div class="registered-video-viewer-controls">
                                <div class="registered-video-viewer-transport">
                                    <button type="button" onclick="app.adjustRegisteredVideoAttachmentTime(-5)" title="5秒戻す" aria-label="5秒戻す"><i class="fa-solid fa-backward"></i></button>
                                    <button type="button" onclick="app.toggleRegisteredVideoAttachmentPlayback()" title="再生・一時停止" aria-label="再生・一時停止"><i class="fa-solid fa-play"></i></button>
                                    <button type="button" onclick="app.adjustRegisteredVideoAttachmentTime(5)" title="5秒進める" aria-label="5秒進める"><i class="fa-solid fa-forward"></i></button>
                                </div>
                                <input class="registered-video-viewer-seek" type="range" min="0" max="1" step="0.05" value="0" oninput="app.seekRegisteredVideoAttachment(this.value)" aria-label="再生位置">
                                <output class="registered-video-viewer-time">0:00 / 0:00</output>
                                <div class="registered-video-viewer-options">
                                    <button type="button" onclick="app.toggleRegisteredVideoAttachmentMute()" title="ミュート" aria-label="ミュート"><i class="fa-solid fa-volume-high"></i></button>
                                    <input class="registered-video-viewer-volume" type="range" min="0" max="1" step="0.05" value="1" oninput="app.setRegisteredVideoAttachmentVolume(this.value)" aria-label="音量">
                                    <select onchange="app.setRegisteredVideoAttachmentRate(this.value)" title="再生速度" aria-label="再生速度">
                                        <option value="0.5">0.5x</option>
                                        <option value="0.75">0.75x</option>
                                        <option value="1" selected>1x</option>
                                        <option value="1.25">1.25x</option>
                                        <option value="1.5">1.5x</option>
                                        <option value="2">2x</option>
                                    </select>
                                    <button type="button" onclick="app.saveRegisteredVideoAttachmentThumbnail()" title="現在位置をサムネイルに設定" aria-label="現在位置をサムネイルに設定"><i class="fa-solid fa-camera"></i></button>
                                    <button type="button" onclick="app.toggleRegisteredVideoAttachmentFullscreen()" title="全画面" aria-label="全画面"><i class="fa-solid fa-expand"></i></button>
                                </div>
                            </div>
                        `}
                    </section>
                </div>
            `);
            const overlay = document.getElementById('registered-video-attachment-viewer');
            overlay.addEventListener('wheel', event => {
                event.preventDefault();
                this.setRegisteredVideoAttachmentWidth(this.getRegisteredVideoAttachmentWidth() + (event.deltaY < 0 ? 80 : -80));
            }, { passive: false });
            this._registeredVideoAttachmentKeyHandler = event => {
                const tag = String(event.target?.tagName || '').toLowerCase();
                if (['input', 'select', 'textarea'].includes(tag)) return;
                if (event.key === 'Escape') {
                    if (document.fullscreenElement) document.exitFullscreen?.();
                    else this.closeRegisteredVideoAttachment();
                    return;
                }
                if (video.sourceType === 'youtube') {
                    if (event.key.toLowerCase() === 'f') this.toggleRegisteredVideoAttachmentFullscreen();
                    return;
                }
                if (event.code === 'Space') {
                    event.preventDefault();
                    this.toggleRegisteredVideoAttachmentPlayback();
                } else if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    this.adjustRegisteredVideoAttachmentTime(-5);
                } else if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    this.adjustRegisteredVideoAttachmentTime(5);
                } else if (event.key.toLowerCase() === 'm') {
                    this.toggleRegisteredVideoAttachmentMute();
                } else if (event.key.toLowerCase() === 'f') {
                    this.toggleRegisteredVideoAttachmentFullscreen();
                }
            };
            document.addEventListener('keydown', this._registeredVideoAttachmentKeyHandler);
            if (video.sourceType !== 'youtube') await this.hydrateRegisteredVideoAttachmentPlayer(video, false);
        }

        async hydrateRegisteredVideoAttachmentPlayer(video, requestPermission = false) {
            const overlay = document.getElementById('registered-video-attachment-viewer');
            const player = overlay?.querySelector('.registered-video-viewer-player');
            if (!overlay || !player || !video) return false;
            try {
                let source = '';
                if (video.sourceType === 'url' && video.sourceUrl) {
                    source = video.sourceUrl;
                } else if (video.sourceType === 'local-handle') {
                    const file = await this.loadPhotoManagerLinkedVideoFile(video, requestPermission);
                    if (!file) {
                        this.showRegisteredVideoAttachmentError(video, 'PC動画へのアクセス許可が必要です');
                        return false;
                    }
                    source = URL.createObjectURL(file);
                    this._registeredVideoAttachmentObjectUrl = source;
                } else {
                    const blob = await store.loadMediaBlob(this.getPhotoManagerVideoMediaKey(video.id));
                    if (!blob) throw new Error('Video blob not found');
                    source = URL.createObjectURL(blob);
                    this._registeredVideoAttachmentObjectUrl = source;
                }
                player.src = source;
                overlay.classList.remove('has-video-error', 'needs-video-reconnect');
                player.onerror = () => this.showRegisteredVideoAttachmentError(video, video.sourceType === 'url' ? '動画URLを読み込めません' : '元動画が見つかりません');
                const start = Math.max(0, Number(video.trimStart) || 0);
                const configuredEnd = Math.max(start, Number(video.trimEnd) || 0);
                const controls = overlay.querySelector('.registered-video-viewer-controls');
                const range = controls?.querySelector('input');
                const output = controls?.querySelector('output');
                const playIcon = controls?.querySelector('.registered-video-viewer-transport button:nth-child(2) i');
                const update = () => {
                    const actualEnd = configuredEnd > start ? configuredEnd : Math.max(start, Number(player.duration) || start);
                    const clipDuration = Math.max(0.1, actualEnd - start);
                    const relative = Math.max(0, Math.min(clipDuration, (Number(player.currentTime) || start) - start));
                    if (range) {
                        range.max = String(clipDuration);
                        if (!range.matches(':active')) range.value = String(relative);
                    }
                    if (output) output.textContent = `${this.formatPhotoManagerVideoDuration(relative)} / ${this.formatPhotoManagerVideoDuration(clipDuration)}`;
                    if (player.currentTime >= actualEnd - 0.03) {
                        player.pause();
                        player.currentTime = start;
                    }
                    playIcon?.classList.toggle('fa-play', player.paused);
                    playIcon?.classList.toggle('fa-pause', !player.paused);
                };
                player.onloadedmetadata = () => {
                    player.currentTime = Math.min(start, Math.max(0, (Number(player.duration) || start) - 0.05));
                    update();
                };
                player.ontimeupdate = update;
                player.onplay = update;
                player.onpause = update;
                player.play().catch(() => update());
                this.refreshRegisteredVideoAttachmentStatuses(video.id);
                return true;
            } catch (error) {
                console.warn('Attached video could not be opened.', error);
                this.showRegisteredVideoAttachmentError(video, video.sourceType === 'local-handle' ? 'PC動画へ再接続してください' : '元動画が見つかりません');
                return false;
            }
        }

        showRegisteredVideoAttachmentError(video, message = '動画を開けません') {
            const overlay = document.getElementById('registered-video-attachment-viewer');
            if (!overlay) return;
            overlay.classList.add('has-video-error');
            const label = overlay.querySelector('.registered-video-viewer-error b');
            if (label) label.textContent = message;
            const player = overlay.querySelector('.registered-video-viewer-player');
            player?.pause?.();
        }

        getRegisteredVideoAttachmentBounds(player, video) {
            const start = Math.max(0, Number(video?.trimStart) || 0);
            const configuredEnd = Math.max(start, Number(video?.trimEnd) || 0);
            const duration = Math.max(0, Number(player?.duration) || Number(video?.duration) || 0);
            const end = configuredEnd > start ? Math.min(configuredEnd, duration || configuredEnd) : duration;
            return { start, end: Math.max(start, end), duration: Math.max(0, end - start) };
        }

        adjustRegisteredVideoAttachmentTime(delta = 0) {
            const player = document.querySelector('#registered-video-attachment-viewer .registered-video-viewer-player');
            const video = this.getPhotoManagerVideo(player?.dataset.videoId || '');
            if (!player || !video || !player.src) return;
            const bounds = this.getRegisteredVideoAttachmentBounds(player, video);
            player.currentTime = Math.max(bounds.start, Math.min(bounds.end, (Number(player.currentTime) || bounds.start) + Number(delta || 0)));
        }

        setRegisteredVideoAttachmentVolume(value = 1) {
            const player = document.querySelector('#registered-video-attachment-viewer .registered-video-viewer-player');
            if (!player) return;
            player.volume = Math.max(0, Math.min(1, Number(value) || 0));
            player.muted = player.volume <= 0;
            this.updateRegisteredVideoAttachmentVolumeIcon();
        }

        updateRegisteredVideoAttachmentVolumeIcon() {
            const overlay = document.getElementById('registered-video-attachment-viewer');
            const player = overlay?.querySelector('.registered-video-viewer-player');
            const icon = overlay?.querySelector('.registered-video-viewer-options button i');
            if (!player || !icon) return;
            icon.className = `fa-solid ${player.muted || player.volume <= 0 ? 'fa-volume-xmark' : (player.volume < 0.5 ? 'fa-volume-low' : 'fa-volume-high')}`;
        }

        toggleRegisteredVideoAttachmentMute() {
            const player = document.querySelector('#registered-video-attachment-viewer .registered-video-viewer-player');
            if (!player) return;
            player.muted = !player.muted;
            const volume = document.querySelector('#registered-video-attachment-viewer .registered-video-viewer-volume');
            if (volume && !player.muted && player.volume <= 0) {
                player.volume = 0.5;
                volume.value = '0.5';
            }
            this.updateRegisteredVideoAttachmentVolumeIcon();
        }

        setRegisteredVideoAttachmentRate(value = 1) {
            const player = document.querySelector('#registered-video-attachment-viewer .registered-video-viewer-player');
            if (player) player.playbackRate = Math.max(0.25, Math.min(4, Number(value) || 1));
        }

        async toggleRegisteredVideoAttachmentFullscreen() {
            const card = document.querySelector('#registered-video-attachment-viewer .registered-video-viewer-card');
            if (!card) return;
            try {
                if (document.fullscreenElement) await document.exitFullscreen?.();
                else await card.requestFullscreen?.();
            } catch {
                this.showToast?.('全画面表示を開始できませんでした。', 'warning');
            }
        }

        async saveRegisteredVideoAttachmentThumbnail() {
            const player = document.querySelector('#registered-video-attachment-viewer .registered-video-viewer-player');
            const video = this.getPhotoManagerVideo(player?.dataset.videoId || '');
            if (!player || !video || !player.videoWidth || !player.videoHeight) {
                this.showToast?.('映像を読み込んでから設定してください。', 'warning');
                return false;
            }
            try {
                const maxWidth = 480;
                const scale = Math.min(1, maxWidth / player.videoWidth);
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(player.videoWidth * scale));
                canvas.height = Math.max(1, Math.round(player.videoHeight * scale));
                canvas.getContext('2d').drawImage(player, 0, 0, canvas.width, canvas.height);
                video.thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
                video.thumbnailTime = Number(player.currentTime) || 0;
                video.updatedAt = Date.now();
                await store.save();
                document.querySelectorAll(`[data-video-thumbnail-id="${CSS.escape(String(video.id))}"]`).forEach(image => {
                    if (image.tagName === 'IMG') image.src = video.thumbnailUrl;
                });
                document.querySelectorAll(`video[data-video-id="${CSS.escape(String(video.id))}"]`).forEach(element => {
                    if (element.classList.contains('registered-video-viewer-player')) return;
                    const image = document.createElement('img');
                    image.src = video.thumbnailUrl;
                    image.alt = '';
                    image.dataset.videoThumbnailId = video.id;
                    this.releaseRegisteredVideoAttachmentThumbnail(element);
                    element.replaceWith(image);
                });
                this.showToast?.('現在位置をサムネイルに設定しました。', 'success');
                return true;
            } catch {
                this.showToast?.('このURL動画はサムネイル画像を作成できません。', 'warning');
                return false;
            }
        }
        async reconnectRegisteredVideoAttachment(id = '') {
            const video = this.getPhotoManagerVideo(id);
            if (!video) return;
            if (this._registeredVideoAttachmentObjectUrl) {
                URL.revokeObjectURL(this._registeredVideoAttachmentObjectUrl);
                this._registeredVideoAttachmentObjectUrl = '';
            }
            await this.hydrateRegisteredVideoAttachmentPlayer(video, true);
        }

        toggleRegisteredVideoAttachmentPlayback() {
            const player = document.querySelector('#registered-video-attachment-viewer .registered-video-viewer-player');
            if (!player?.src) return;
            if (player.paused) player.play().catch(() => {});
            else player.pause();
        }

        seekRegisteredVideoAttachment(value = 0) {
            const player = document.querySelector('#registered-video-attachment-viewer .registered-video-viewer-player');
            const video = this.getPhotoManagerVideo(player?.dataset.videoId || '');
            if (!player || !video) return;
            const bounds = this.getRegisteredVideoAttachmentBounds(player, video);
            player.currentTime = Math.max(bounds.start, Math.min(bounds.end, bounds.start + Math.max(0, Number(value) || 0)));
        }

        closeRegisteredVideoAttachment() {
            const player = document.querySelector('#registered-video-attachment-viewer .registered-video-viewer-player');
            player?.pause?.();
            document.getElementById('registered-video-attachment-viewer')?.remove();
            if (this._registeredVideoAttachmentObjectUrl) {
                URL.revokeObjectURL(this._registeredVideoAttachmentObjectUrl);
                this._registeredVideoAttachmentObjectUrl = '';
            }
            if (this._registeredVideoAttachmentKeyHandler) {
                document.removeEventListener('keydown', this._registeredVideoAttachmentKeyHandler);
                this._registeredVideoAttachmentKeyHandler = null;
            }
        }
        getPhotoManagerToday() {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        formatPhotoManagerClipboardTimestamp(value = Date.now()) {
            const date = new Date(value);
            const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
            return `${safeDate.getMonth() + 1}/${safeDate.getDate()} ${safeDate.getHours()}:${String(safeDate.getMinutes()).padStart(2, '0')}`;
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
            const tags = String(value || '').split(/[,、\s]+/).map(tag => tag.trim()).filter(Boolean).slice(0, 12);
            if (tags.length) store.activeData.photoManagerTags[id] = [...new Set(tags)];
            else delete store.activeData.photoManagerTags[id];
            store.save();
            this.renderPhotoManager();
        }

        getPhotoManagerReading(itemOrId = {}) {
            this.ensurePhotoManagerData();
            const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
            return String(store.activeData.photoManagerReadings[id] || '');
        }

        setPhotoManagerReading(id = '', value = '') {
            this.ensurePhotoManagerData();
            const text = String(value || '').trim().toLowerCase();
            if (text) store.activeData.photoManagerReadings[id] = text;
            else delete store.activeData.photoManagerReadings[id];
            this._photoManagerReadingAliasCache?.clear?.();
            store.save();
            this.renderPhotoManager();
        }

        getPhotoManagerAutoTagCandidates(item = {}, extraText = '') {
            const stopWords = new Set([
                '写真', '画像', '取込', '取込み', 'クリップボード', 'ファイル', 'データ', '写真管理',
                '圧縮', '圧縮済み', '非圧縮', '透過', '透過済み', '透過候補', '編集', '元', 'なし',
                'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'img', 'image', 'photo'
            ]);
            const raw = [this.getPhotoManagerName(item), item.title, item.caption, extraText]
                .filter(Boolean)
                .join(' ')
                .normalize('NFKC')
                .replace(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g, ' ')
                .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
                .replace(/\.[a-z0-9]{2,5}\b/gi, ' ')
                .replace(/[_\-・、。，．;:()（）[\]【】「」『』]+/g, ' ');
            // Keep whole whitespace-delimited Japanese labels too. Intl.Segmenter
            // may split a useful label such as "蜷ｹ縺榊・縺・ into short fragments.
            const words = raw.split(/\s+/).filter(Boolean);
            if (typeof Intl?.Segmenter === 'function') {
                const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
                for (const part of segmenter.segment(raw)) {
                    if (part.isWordLike) words.push(part.segment);
                }
            }
            const result = [];
            const seen = new Set();
            words.forEach(word => {
                const tag = String(word || '').trim().replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '');
                const key = tag.toLocaleLowerCase('ja');
                if (!tag || tag.length < 2 || tag.length > 18 || /^\d+(?:\.\d+)?$/.test(tag) || stopWords.has(key) || seen.has(key)) return;
                seen.add(key);
                result.push(tag);
            });
            return result.slice(0, 8);
        }

        canReadPhotoManagerImageText() {
            return typeof window !== 'undefined'
                && (typeof window.TextDetector === 'function' || typeof window.Tesseract !== 'undefined');
        }

        loadPhotoManagerTesseract() {
            if (typeof window === 'undefined') return Promise.resolve(null);
            if (window.Tesseract) return Promise.resolve(window.Tesseract);
            if (this._photoManagerTesseractPromise) return this._photoManagerTesseractPromise;
            this._photoManagerTesseractPromise = new Promise(resolve => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
                script.async = true;
                script.onload = () => resolve(window.Tesseract || null);
                script.onerror = () => {
                    this._lastPhotoManagerOcrError = 'OCR繧ｨ繝ｳ繧ｸ繝ｳ繧定ｪｭ縺ｿ霎ｼ繧√∪縺帙ｓ縺ｧ縺励◆';
                    resolve(null);
                };
                document.head.appendChild(script);
            });
            return this._photoManagerTesseractPromise;
        }

        async createPhotoManagerOcrImageSrc(src = '', options = {}) {
            const img = await this.loadPhotoManagerImage(src);
            const naturalW = img.naturalWidth || img.width || 1;
            const naturalH = img.naturalHeight || img.height || 1;
            const maxSide = Number(options.maxSide) || 1800;
            const maxScale = Number(options.maxScale) || 4;
            const scale = Math.min(maxScale, Math.max(1, maxSide / Math.max(naturalW, naturalH)));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(naturalW * scale));
            canvas.height = Math.max(1, Math.round(naturalH * scale));
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (options.whiteBackground !== false) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            if (options.mode !== 'contrast' && options.mode !== 'binary') return canvas.toDataURL('image/png');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const darkBoost = Number.isFinite(Number(options.darkBoost)) ? Number(options.darkBoost) : 45;
            const lightBoost = Number.isFinite(Number(options.lightBoost)) ? Number(options.lightBoost) : 25;
            const threshold = Number.isFinite(Number(options.threshold)) ? Number(options.threshold) : 170;
            const binary = options.mode === 'binary';
            const invert = options.invert === true;
            const contrastFactor = Number.isFinite(Number(options.contrastFactor)) ? Math.max(1, Number(options.contrastFactor)) : 1;
            for (let i = 0; i < data.length; i += 4) {
                const gray = (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114);
                let value = binary
                    ? (gray < threshold ? 0 : 255)
                    : (gray < threshold ? Math.max(0, gray - darkBoost) : Math.min(255, gray + lightBoost));
                if (!binary && contrastFactor > 1) {
                    value = Math.max(0, Math.min(255, ((value - 128) * contrastFactor) + 128));
                }
                if (invert) value = 255 - value;
                data[i] = value;
                data[i + 1] = value;
                data[i + 2] = value;
                data[i + 3] = 255;
            }
            ctx.putImageData(imageData, 0, 0);
            return canvas.toDataURL('image/png');
        }

        getPhotoManagerOcrVariants() {
            return [
                { name: '超強補正', mode: 'contrast', maxSide: 2600, maxScale: 6, threshold: 205, darkBoost: 125, lightBoost: 60, contrastFactor: 2.15 },
                { name: '濃い白黒', mode: 'binary', maxSide: 2600, maxScale: 6, threshold: 190 },
                { name: '薄文字強調', mode: 'contrast', maxSide: 2600, maxScale: 6, threshold: 215, darkBoost: 80, lightBoost: 85, contrastFactor: 2.35 },
                { name: '元画像', mode: 'original', maxSide: 1800, maxScale: 3 },
                { name: '標準補正', mode: 'contrast', maxSide: 1800, maxScale: 4, threshold: 170, darkBoost: 45, lightBoost: 25 },
                { name: '弱補正', mode: 'contrast', maxSide: 1800, maxScale: 4, threshold: 150, darkBoost: 22, lightBoost: 12 },
                { name: '強補正', mode: 'contrast', maxSide: 2200, maxScale: 5, threshold: 190, darkBoost: 75, lightBoost: 35 },
                { name: '白黒強調', mode: 'binary', maxSide: 2200, maxScale: 5, threshold: 165 },
                { name: '反転白黒', mode: 'binary', maxSide: 2200, maxScale: 5, threshold: 165, invert: true }
            ];
        }

        getPhotoManagerOcrTextScore(text = '') {
            const normalized = String(text || '').replace(/\s+/g, '');
            if (!normalized) return 0;
            const useful = (normalized.match(/[\p{L}\p{N}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []).length;
            const noise = (normalized.match(/[^\p{L}\p{N}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []).length;
            return useful * 3 + Math.min(normalized.length, 80) - noise * 2;
        }

        getPhotoManagerOcrVariants() {
            return [
                { name: '元画像', mode: 'plain', maxSide: 1800, maxScale: 3, whiteBackground: false },
                { name: '白背景拡大', mode: 'plain', maxSide: 2200, maxScale: 5, whiteBackground: true },
                { name: '大きく拡大', mode: 'plain', maxSide: 2800, maxScale: 7, whiteBackground: true }
            ];
        }

        async readPhotoManagerImageTextWithTextDetector(item = {}) {
            if (typeof window === 'undefined' || typeof window.TextDetector !== 'function' || !item?.src) return '';
            try {
                if (!this._photoManagerTextDetector) {
                    this._photoManagerTextDetector = new window.TextDetector();
                }
                const img = await this.loadPhotoManagerImage(item.src);
                const detected = await this._photoManagerTextDetector.detect(img);
                return (detected || [])
                    .map(entry => String(entry?.rawValue || '').trim())
                    .filter(Boolean)
                    .join(' ');
            } catch (error) {
                console.warn('Photo manager TextDetector failed', error);
                return '';
            }
        }

        async readPhotoManagerImageTextWithTesseract(item = {}) {
            if (!item?.src) return '';
            let worker = null;
            try {
                const Tesseract = await this.loadPhotoManagerTesseract();
                if (!Tesseract?.createWorker) {
                    this._lastPhotoManagerOcrError = this._lastPhotoManagerOcrError || 'OCR繧ｨ繝ｳ繧ｸ繝ｳ縺御ｽｿ縺医∪縺帙ｓ縺ｧ縺励◆';
                    return '';
                }
                worker = await Tesseract.createWorker('jpn+eng', 1);
                await worker.setParameters({
                    preserve_interword_spaces: '1',
                    tessedit_pageseg_mode: '6'
                });
                let bestText = '';
                let bestScore = 0;
                let bestVariant = '';
                for (const variant of this.getPhotoManagerOcrVariants()) {
                    const ocrSrc = await this.createPhotoManagerOcrImageSrc(item.src, variant);
                    const result = await worker.recognize(ocrSrc);
                    const text = String(result?.data?.text || '').trim();
                    const score = this.getPhotoManagerOcrTextScore(text);
                    if (score > bestScore) {
                        bestText = text;
                        bestScore = score;
                        bestVariant = variant.name;
                    }
                    if (score >= 90) break;
                }
                if (bestVariant) this._lastPhotoManagerOcrVariant = bestVariant;
                return bestText;
            } catch (error) {
                console.warn('Photo manager Tesseract OCR failed', error);
                this._lastPhotoManagerOcrError = error?.message || 'OCR蜃ｦ逅・↓螟ｱ謨励＠縺ｾ縺励◆';
                return '';
            } finally {
                if (worker) {
                    try {
                        await worker.terminate();
                    } catch (error) {
                        console.warn('Photo manager Tesseract terminate failed', error);
                    }
                }
            }
        }

        async getPhotoManagerImageText(item = {}) {
            this._lastPhotoManagerOcrText = '';
            this._lastPhotoManagerOcrSource = '';
            this._lastPhotoManagerOcrError = '';
            this._lastPhotoManagerOcrVariant = '';
            if (!item?.src) return '';
            const quickText = await this.readPhotoManagerImageTextWithTextDetector(item);
            if (quickText.trim()) {
                this._lastPhotoManagerOcrText = quickText.trim();
                this._lastPhotoManagerOcrSource = 'TextDetector';
                return quickText;
            }
            const tesseractText = await this.readPhotoManagerImageTextWithTesseract(item);
            this._lastPhotoManagerOcrText = tesseractText.trim();
            this._lastPhotoManagerOcrSource = tesseractText.trim() ? 'Tesseract' : '';
            return tesseractText;
        }

        getPhotoManagerOcrNoticeSuffix() {
            const text = String(this._lastPhotoManagerOcrText || '').replace(/\s+/g, ' ').trim();
            if (!text) {
                const error = String(this._lastPhotoManagerOcrError || '').trim();
                return error ? `画像文字は読めませんでした（${error}）。` : '画像文字は読めませんでした。';
            }
            const variant = String(this._lastPhotoManagerOcrVariant || '').trim();
            return `画像から読めた文字${variant ? `（${variant}）` : ''}: ${text.slice(0, 60)}${text.length > 60 ? '...' : ''}`;
        }

        getPhotoManagerOcrTagCandidates(text = '') {
            const source = String(text || '')
                .normalize('NFKC')
                .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
                .replace(/\.(jpg|jpeg|png|webp|gif|svg)\b/gi, ' ');
            const pieces = [];
            source.split(/\r?\n/).forEach(line => {
                const cleanLine = line.trim().replace(/\s+/g, ' ');
                if (cleanLine) pieces.push(cleanLine);
                cleanLine.split(/[,\s、。・/／|()（）[\]【】「」『』]+/).forEach(part => {
                    const cleanPart = part.trim();
                    if (cleanPart) pieces.push(cleanPart);
                });
            });
            if (!pieces.length) {
                const compact = source.replace(/\s+/g, '').trim();
                if (compact) pieces.push(compact);
            }
            const seen = new Set();
            const tags = [];
            pieces.forEach(piece => {
                let tag = piece.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '').trim();
                if (!tag || tag.length < 2 || /^\d+(?:\.\d+)?$/.test(tag)) return;
                if (tag.length > 18) tag = tag.slice(0, 18);
                const key = tag.toLocaleLowerCase('ja');
                if (seen.has(key)) return;
                seen.add(key);
                tags.push(tag);
            });
            return tags.slice(0, 12);
        }

        async getPhotoManagerAutoTagCandidatesWithImageText(item = {}) {
            const imageText = await this.getPhotoManagerImageText(item);
            if (String(imageText || '').trim()) {
                return this.getPhotoManagerOcrTagCandidates(imageText);
            }
            return this.getPhotoManagerAutoTagCandidates(item);
        }

        async autoTagPhotoManagerItem(id = '') {
            const item = this.findPhotoManagerItem(id);
            if (!item) return this.showPhotoManagerNotice('写真が見つかりませんでした。');
            this.showPhotoManagerNotice('画像内の文字を確認しています...');
            const candidates = await this.getPhotoManagerAutoTagCandidatesWithImageText(item);
            if (!candidates.length) return this.showPhotoManagerNotice(`有効なタグ候補を作れませんでした。${this.getPhotoManagerOcrNoticeSuffix()}`);
            const existing = this.getPhotoManagerTags(item);
            const ocrRecognized = String(this._lastPhotoManagerOcrText || '').trim().length > 0;
            const merged = ocrRecognized
                ? [...new Set(candidates)].slice(0, 12)
                : [...new Set([...existing, ...candidates])].slice(0, 12);
            store.activeData.photoManagerTags[item.id] = ['スタンプ', '透過', '分割'];
            store.save();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`${merged.length - existing.length}件のタグを追加しました。${this.getPhotoManagerOcrNoticeSuffix()}`);
        }

        async autoTagSelectedPhotoManagerItems() {
            const ids = new Set(this.getSelectedPhotoManagerIds());
            if (!ids.size) return this.showPhotoManagerNotice('タグを作る写真を選択してください。');
            this.showPhotoManagerNotice('選択画像の文字を確認しています...');
            let addedCount = 0;
            let ocrReadCount = 0;
            const items = this.collectPhotoManagerItems().filter(item => ids.has(item.id));
            for (const item of items) {
                const existing = this.getPhotoManagerTags(item);
                const candidates = await this.getPhotoManagerAutoTagCandidatesWithImageText(item);
                const ocrRecognized = String(this._lastPhotoManagerOcrText || '').trim().length > 0;
                const merged = ocrRecognized
                    ? [...new Set(candidates)].slice(0, 12)
                    : [...new Set([...existing, ...candidates])].slice(0, 12);
                if (ocrRecognized) ocrReadCount += 1;
                const changed = merged.length !== existing.length || merged.some((tag, index) => tag !== existing[index]);
                if (changed) {
                    store.activeData.photoManagerTags[item.id] = ['スタンプ', '透過', '分割'];
                    addedCount += ocrRecognized ? merged.length : Math.max(0, merged.length - existing.length);
                }
            }
            if (!addedCount) return this.showPhotoManagerNotice(`追加できる新しいタグ候補がありませんでした。画像文字を読めた画像: ${ocrReadCount}/${items.length}`);
            store.save();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`選択画像へ${addedCount}件のタグを追加しました。画像文字を読めた画像: ${ocrReadCount}/${items.length}`);
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

        getPhotoManagerSourceKey(src = '') {
            return src ? this.hashPhotoManagerSrc(src) : '';
        }

        isPhotoManagerSourceProtected(src = '') {
            this.ensurePhotoManagerData();
            const key = this.getPhotoManagerSourceKey(src);
            return !!(key && store.activeData.photoManagerProtectedSources[key]);
        }

        togglePhotoManagerSourceProtection(id = '') {
            const item = this.findPhotoManagerItem(id);
            if (!item?.src) return this.showPhotoManagerNotice('写真が見つかりませんでした。');
            const key = this.getPhotoManagerSourceKey(item.src);
            const next = !this.isPhotoManagerSourceProtected(item.src);
            if (next) store.activeData.photoManagerProtectedSources[key] = Date.now();
            else delete store.activeData.photoManagerProtectedSources[key];
            store.save();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(next ? '写真を保護しました。1カ月自動削除の対象外です。' : '写真の保護を解除しました。');
        }

        rememberPhotoManagerTransparentSource(src = '', transparent = true) {
            this.ensurePhotoManagerData();
            const key = this.getPhotoManagerSourceKey(src);
            if (!key) return;
            if (transparent) store.activeData.photoManagerTransparentSources[key] = Date.now();
            else delete store.activeData.photoManagerTransparentSources[key];
        }

        isKnownPhotoManagerTransparentSource(src = '') {
            this.ensurePhotoManagerData();
            const key = this.getPhotoManagerSourceKey(src);
            return !!(key && store.activeData.photoManagerTransparentSources[key]);
        }

        rememberPhotoManagerCompressedSource(src = '', compressed = true) {
            this.ensurePhotoManagerData();
            const key = this.getPhotoManagerSourceKey(src);
            if (!key) return;
            if (compressed) store.activeData.photoManagerCompressedSources[key] = Date.now();
            else delete store.activeData.photoManagerCompressedSources[key];
        }

        isPhotoManagerSourceCompressed(src = '') {
            this.ensurePhotoManagerData();
            const key = this.getPhotoManagerSourceKey(src);
            return !!(key && store.activeData.photoManagerCompressedSources[key]) || /^data:image\/webp;/i.test(String(src || ''));
        }

        async detectAndRememberPhotoManagerTransparency(src = '', save = false) {
            if (!src || !this.canImageSourceHaveAlpha(src)) return false;
            const transparent = await this.imageHasTransparentPixels(src);
            if (transparent) {
                this.rememberPhotoManagerTransparentSource(src, true);
                if (save) store.save();
            }
            return transparent;
        }

        removePhotoManagerSourceFromRecentCachesIfUnused(src = '') {
            if (!src || this.collectPhotoManagerItems().some(item => item.src === src)) return false;
            this.ensurePhotoManagerData();
            store.activeData.imageSourceRecentUsed = (store.activeData.imageSourceRecentUsed || []).filter(item => item?.src !== src);
            store.activeData.shiftPhotoRecentImageStamps = (store.activeData.shiftPhotoRecentImageStamps || []).filter(item => item?.src !== src);
            if (Array.isArray(this._imageSourceRecentUsed)) this._imageSourceRecentUsed = this._imageSourceRecentUsed.filter(item => item?.src !== src);
            if (Array.isArray(this._shiftPhotoCompareRecentImageStamps)) this._shiftPhotoCompareRecentImageStamps = this._shiftPhotoCompareRecentImageStamps.filter(item => item?.src !== src);
            return true;
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
            item.annotated = item.annotated || (Array.isArray(item.photoCompareBlankEdit?.marks) && item.photoCompareBlankEdit.marks.length > 0);
            item.displayName = this.getPhotoManagerName(item);
            item.tags = this.getPhotoManagerTags(item);
            item.editedAt = Number(item.editedAt || store.activeData.photoManagerEditedAt?.[item.id] || 0) || 0;
            items.push(item);
        }

        collectPhotoManagerItems() {
            const items = [];
            const data = store.activeData;
            const machines = store.getMachines(true);
            const machineMap = new Map(machines.map(m => [String(m.id), m]));

            const photoLibrary = this.getPhotoManagerLibrary();
            const libraryRefMap = new Map();
            const librarySrcSet = new Set();
            photoLibrary.forEach((photo, index) => {
                if (!photo?.src) return;
                const itemId = photo.id || this.buildPhotoManagerId(['library', index], photo.src);
                libraryRefMap.set(String(itemId), { photo, index, itemId });
                if (photo.id) libraryRefMap.set(String(photo.id), { photo, index, itemId });
                librarySrcSet.add(photo.src);
            });

            photoLibrary.forEach((photo, index) => {
                if (!photo?.src) return;
                const itemId = photo.id || this.buildPhotoManagerId(['library', index], photo.src);
                this.addPhotoManagerItem(items, {
                    id: itemId,
                    source: 'library',
                    sourceLabel: '取込画像',
                    title: photo.caption || photo.name || `取込画像${index + 1}`,
                    defaultName: photo.name || photo.caption || `取込画像${index + 1}`,
                    caption: photo.caption || '',
                    src: photo.src,
                    date: photo.date || '',
                    editedAt: Number(photo.updatedAt || photo.createdAt || 0) || 0,
                    marks: Array.isArray(photo.marks) ? photo.marks : [],
                    sizePreset: photo.sizePreset && typeof photo.sizePreset === 'object' ? photo.sizePreset : null,
                    imageFit: photo.imageFit === 'fill' ? 'fill' : '',
                    circleImageEdit: photo.circleImageEdit && typeof photo.circleImageEdit === 'object' ? photo.circleImageEdit : null,
                    photoCompareBlankEdit: photo.photoCompareBlankEdit && typeof photo.photoCompareBlankEdit === 'object' ? photo.photoCompareBlankEdit : null,
                    deleteIndex: index,
                    open: () => this.openPhotoManagerEditor(itemId),
                    replacePhoto: src => { photo.src = src; photo.updatedAt = Date.now(); },
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
                    replacePhoto: src => { machine.photo = src; },
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
                    replacePhoto: src => { part.photo = src; },
                    deletePhoto: () => { part.photo = ''; }
                });
            });

            (data.history || []).forEach(history => {
                const machine = machineMap.get(String(history.machineId));
                const historyTitle = this.getHistoryDisplayText ? this.getHistoryDisplayText(history) : (history.notes || history.errorContent || 'メンテ履歴');
                (history.photos || []).forEach((rawPhoto, index) => {
                    const isReference = rawPhoto && typeof rawPhoto === 'object';
                    const refId = isReference ? String(rawPhoto.id || rawPhoto.photoManagerId || '') : '';
                    const linked = refId ? libraryRefMap.get(refId) : null;
                    const linkedPhoto = linked?.photo || null;
                    const src = typeof rawPhoto === 'string'
                        ? rawPhoto
                        : (rawPhoto?.src || linkedPhoto?.src || '');
                    if (!src) return;
                    const libraryDuplicate = !linkedPhoto && librarySrcSet.has(src);
                    this.addPhotoManagerItem(items, {
                        id: this.buildPhotoManagerId(['history', history.id, index], src),
                        source: 'history',
                        sourceLabel: 'メンテ履歴',
                        title: `${history.date || ''} ${machine?.name || ''} ${historyTitle || ''}`.trim(),
                        defaultName: `履歴写真${index + 1}`,
                        src,
                        referenceOnly: (isReference && !!refId) || libraryDuplicate,
                        date: history.date || '',
                        deleteIndex: index,
                        open: () => this.openHistoryEditForm(history.id),
                        replacePhoto: nextSrc => {
                            if (linkedPhoto) {
                                linkedPhoto.src = nextSrc;
                                linkedPhoto.updatedAt = Date.now();
                                return;
                            }
                            if (isReference) rawPhoto.src = nextSrc;
                            else history.photos[index] = nextSrc;
                        },
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
                        replacePhoto: nextSrc => {
                            if (typeof rawPhoto === 'string') history.guide.photos[index] = nextSrc;
                            else rawPhoto.src = nextSrc;
                        },
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
                            const isReference = rawPhoto && typeof rawPhoto === 'object' && (rawPhoto.source === 'photoManager' || rawPhoto.photoManagerId);
                            const libraryDuplicate = !isReference && librarySrcSet.has(photo.src);
                            const marks = Array.isArray(photo.marks) ? photo.marks : [];
                            this.addPhotoManagerItem(items, {
                                id: this.buildPhotoManagerId(['shift', dateStr, shift, shared ? 'shared' : 'shift', row.id || rowIndex, photoIndex], photo.src),
                                source: 'shift',
                                sourceLabel: '連絡帳',
                                title: `${dateStr} ${shared ? '共通' : this.getShiftNotebookLabel(shift).name} ${row.group || ''} ${row.text || ''}`.trim(),
                                defaultName: photo.caption || `連絡帳写真${photoIndex + 1}`,
                                caption: photo.caption || '',
                                src: photo.src,
                                referenceOnly: !!isReference || libraryDuplicate,
                                date: dateStr,
                                annotated: marks.length > 0 || globalMarks.length > 0,
                                marks,
                                globalMarks,
                                photoIndex,
                                photoCount: row.photos.length || 1,
                                deleteIndex: photoIndex,
                                open: () => this.openShiftNotebookModal(dateStr, shift, rowIndex),
                                replacePhoto: nextSrc => {
                                    if (typeof rawPhoto === 'string') row.photos[photoIndex] = nextSrc;
                                    else rawPhoto.src = nextSrc;
                                },
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

        getFilteredPhotoManagerItems(baseItems = null) {
            const source = document.getElementById('photo-manager-source')?.value || 'all';
            const period = document.getElementById('photo-manager-period')?.value || 'all';
            const markFilter = document.getElementById('photo-manager-mark-filter')?.value || 'all';
            const compressionFilter = document.getElementById('photo-manager-compression-filter')?.value || 'all';
            const circleFilter = document.getElementById('photo-manager-circle-filter')?.value || 'all';
            const sort = document.getElementById('photo-manager-sort')?.value || 'date_desc';
            const tagFilter = document.getElementById('photo-manager-tag-filter')?.value || 'all';
            const query = (document.getElementById('photo-manager-query')?.value || '').trim();
            const terms = this.getSearchTerms(query);
            const range = this.getNotebookSearchDateRange(period);
            let items = baseItems ? [...baseItems] : this.collectPhotoManagerItems();

            items = items.filter(item => !item.referenceOnly);
            if (source !== 'all') items = items.filter(item => item.source === source);
            if (period !== 'all') {
                items = items.filter(item => item.date && (!range.start || (item.date >= range.start && item.date <= range.end)));
            }
            if (markFilter === 'marked') items = items.filter(item => item.annotated);
            if (markFilter === 'plain') items = items.filter(item => !item.annotated);
            if (compressionFilter === 'compressed') items = items.filter(item => this.isPhotoManagerSourceCompressed(item.src));
            if (compressionFilter === 'uncompressed') items = items.filter(item => !this.isPhotoManagerSourceCompressed(item.src));
            if (circleFilter === 'circle') items = items.filter(item => !!item.circleImageEdit);
            if (circleFilter === 'normal') items = items.filter(item => !item.circleImageEdit);
            if (circleFilter === 'blankEdit') items = items.filter(item => item.source === 'library' && item.photoCompareBlankEdit?.type === 'blank');
            if (this._photoManagerAlphaFilterMode === 'transparent') items = items.filter(item => this.getPhotoManagerAlphaStatus(item) === 'transparent');
            if (this._photoManagerAlphaFilterMode === 'candidate') items = items.filter(item => this.getPhotoManagerAlphaStatus(item) === 'candidate');
            if (tagFilter !== 'all') items = items.filter(item => (item.tags || []).includes(tagFilter));
            if (terms.length) {
                items = items.filter(item => this.matchesSearchTerms(`${item.sourceLabel} ${item.title} ${item.displayName} ${item.caption || ''} ${item.date} ${(item.tags || []).join(' ')}`, terms));
            }

            const nameOf = item => this.getPhotoManagerName(item) || '';
            items.sort((a, b) => {
                if (sort === 'size_desc') return this.estimatePhotoManagerImageBytes(b.src) - this.estimatePhotoManagerImageBytes(a.src) || (b.date || '').localeCompare(a.date || '');
                if (sort === 'edited_desc') return (b.editedAt || 0) - (a.editedAt || 0) || (b.date || '').localeCompare(a.date || '') || a.sourceLabel.localeCompare(b.sourceLabel, 'ja');
                if (sort === 'date_asc') return (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99');
                if (sort === 'source') return a.sourceLabel.localeCompare(b.sourceLabel, 'ja') || (b.date || '').localeCompare(a.date || '');
                if (sort === 'name') return nameOf(a).localeCompare(nameOf(b), 'ja') || (b.date || '').localeCompare(a.date || '');
                return (b.date || '').localeCompare(a.date || '') || a.sourceLabel.localeCompare(b.sourceLabel, 'ja');
            });
            return items;
        }

        addPhotoManagerPageOnlyCleanupButton() {
            const actions = document.querySelector('#photo-manager-bulk-bar .photo-manager-bulk-actions');
            if (!actions || actions.querySelector('.photo-manager-page-only-cleanup-btn')) return;
            const cachedPageOnlyItems = this._photoManagerRenderCache?.pageOnlyItems || this.getPhotoManagerPageOnlyItems(this._photoManagerRenderCache?.allItems);
            if (this._photoManagerRenderCache) this._photoManagerRenderCache.pageOnlyItems = cachedPageOnlyItems;
            const count = cachedPageOnlyItems.length;
            actions.insertAdjacentHTML('beforeend', `<button type="button" class="secondary-btn photo-manager-page-only-cleanup-btn" onclick="app.openPhotoManagerPageOnlyCleanupReview()"><i class="fa-solid fa-folder-minus"></i> ページ内画像整理 ${count ? `(${count})` : ''}</button>`);
        }

        enhancePhotoManagerCards(items = []) {
            (items || []).forEach(item => {
                const safeId = window.CSS?.escape ? CSS.escape(item.id) : String(item.id).replace(/"/g, '\\"');
                const card = document.querySelector(`.photo-manager-card[data-photo-id="${safeId}"]`);
                const info = card?.querySelector?.('.photo-manager-info');
                const nameInput = info?.querySelector?.('input:not(.photo-manager-tags-input):not(.photo-manager-reading-input)');
                if (!info || !nameInput || info.querySelector('.photo-manager-tags-input')) return;
                const alphaStatus = this.getPhotoManagerAlphaStatus(item);
                const compressed = this.isPhotoManagerSourceCompressed(item.src);
                const protectedPhoto = this.isPhotoManagerSourceProtected(item.src);
                const stateRow = document.createElement('div');
                stateRow.className = 'photo-manager-state-row';
                stateRow.innerHTML = `
                    <span class="size"><i class="fa-solid fa-database"></i> ${this.escapeHtml(this.formatPhotoManagerBytes(this.estimatePhotoManagerImageBytes(item.src)))}</span>
                    ${alphaStatus ? `<span class="alpha ${alphaStatus}"><i class="fa-solid fa-layer-group"></i> ${alphaStatus === 'transparent' ? '透過' : '透過候補'}</span>` : ''}
                    <span class="compression ${compressed ? 'done' : ''}"><i class="fa-solid fa-compress"></i> ${compressed ? '圧縮済み' : '非圧縮'}</span>
                    ${protectedPhoto ? '<span class="locked"><i class="fa-solid fa-lock"></i> ロック</span>' : ''}
                `;
                nameInput.insertAdjacentElement('beforebegin', stateRow);
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'photo-manager-tags-input';
                input.placeholder = 'タグ 例: 人物 透過 部品';
                input.value = (item.tags || []).join(' ');
                input.addEventListener('change', () => this.setPhotoManagerTags(item.id, input.value));
                nameInput.insertAdjacentElement('afterend', input);
                const readingInput = document.createElement('input');
                readingInput.type = 'text';
                readingInput.className = 'photo-manager-reading-input';
                readingInput.placeholder = '読み・検索別名 例: kao face';
                readingInput.value = this.getPhotoManagerReading(item);
                readingInput.addEventListener('change', () => this.setPhotoManagerReading(item.id, readingInput.value));
                input.insertAdjacentElement('afterend', readingInput);
            });
        }

        getPhotoManagerAlphaStatus(item = {}) {
            if (!item?.src || !this.canImageSourceHaveAlpha(item.src)) return '';
            if (this.isKnownPhotoManagerTransparentSource(item.src)) return 'transparent';
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
            this.updatePhotoManagerToolbarActiveState?.();
        }

        updatePhotoManagerToolbarActiveState() {
            const filterDefaults = {
                'photo-manager-source': 'all',
                'photo-manager-period': 'all',
                'photo-manager-mark-filter': 'all',
                'photo-manager-compression-filter': 'all',
                'photo-manager-circle-filter': 'all',
                'photo-manager-tag-filter': 'all'
            };
            Object.entries(filterDefaults).forEach(([id, defaultValue]) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.classList.toggle('is-filtering', (el.value || defaultValue) !== defaultValue);
            });
            const query = document.getElementById('photo-manager-query');
            if (query) query.classList.toggle('is-filtering', !!String(query.value || '').trim());
            const sort = document.getElementById('photo-manager-sort');
            if (sort) sort.classList.toggle('is-sorting', !!sort.value);
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
            const library = this.getPhotoManagerLibrary();
            const createdAt = Date.now();
            let resolvedName = String(name || '').trim() || 'クリップボード画像';
            if (resolvedName === 'クリップボード画像') {
                const prefix = this.formatPhotoManagerClipboardTimestamp(createdAt);
                const sameMinuteCount = library.filter(photo => String(photo?.name || '').startsWith(`${prefix} クリップボード画像`)).length;
                resolvedName = `${prefix} クリップボード画像${sameMinuteCount ? ` (${sameMinuteCount + 1})` : ''}`;
            }
            const item = {
                id: this.createPhotoManagerLibraryId(),
                src,
                name: resolvedName,
                caption: '',
                date: this.getPhotoManagerToday(),
                marks: [],
                createdAt,
                updatedAt: createdAt
            };
            library.unshift(item);
            return item;
        }

        finishPhotoManagerImport(count = 0, message = '') {
            if (!count) return;
            store.save();
            const sourceSelect = document.getElementById('photo-manager-source');
            if (sourceSelect && sourceSelect.value !== 'library') sourceSelect.value = 'library';
            this.renderPhotoManager();
            this.showPhotoManagerNotice(message || `${count}枚の画像を登録しました。`);
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

        async preparePhotoManagerNormalSaveSource(src = '', name = '', options = {}) {
            const fallback = {
                src,
                compressed: false,
                transparent: false,
                status: 'original',
                reason: 'そのまま保存',
                before: this.formatPhotoManagerBytes(this.estimatePhotoManagerImageBytes(src))
            };
            if (!src || typeof this.createCompressedPhotoManagerSource !== 'function') return fallback;
            try {
                const result = await this.createCompressedPhotoManagerSource(src);
                const before = this.formatPhotoManagerBytes(result?.beforeBytes || this.estimatePhotoManagerImageBytes(src));
                const after = this.formatPhotoManagerBytes(result?.afterBytes || 0);
                fallback.transparent = !!result?.transparent;
                fallback.before = before;
                if (result?.transparent) {
                    return { ...fallback, status: 'transparent-original', reason: '透過画像のためPNGのまま保存', before, after };
                }
                if (!result?.changed || !result.src) {
                    return { ...fallback, status: 'original', reason: '圧縮しても小さくならないためそのまま保存', before, after };
                }
                this.ensurePhotoManagerData();
                let mode = options.forceAsk ? 'ask' : (store.activeData.photoManagerNormalCompressionMode || 'ask');
                if (mode === 'auto') {
                    mode = await this.shouldCompressPhotoManagerImageAutomatically(src, result) ? 'compress' : 'original';
                    if (mode === 'original') {
                        return { ...fallback, status: 'original', reason: '自動判定で画質優先', before, after };
                    }
                }
                if (mode === 'ask') {
                    const title = String(name || '画像').trim() || '画像';
                    const answer = await this.openPhotoManagerNormalCompressionChoiceDialog({
                        title,
                        before,
                        after,
                        originalSrc: src,
                        compressedSrc: result.src
                    });
                    if (answer === 'always-compress') {
                        store.activeData.photoManagerNormalCompressionMode = 'compress';
                        store.save();
                        mode = 'compress';
                    } else if (answer === 'always-original') {
                        store.activeData.photoManagerNormalCompressionMode = 'original';
                        store.save();
                        mode = 'original';
                    } else if (answer === 'compress') {
                        mode = 'compress';
                    } else {
                        mode = 'original';
                    }
                }
                if (mode === 'compress') {
                    return { src: result.src, compressed: true, transparent: false, status: 'compressed', reason: '圧縮して保存', before, after };
                }
                return { ...fallback, status: 'original', reason: '選択によりそのまま保存', before, after };
            } catch (error) {
                console.warn('Normal image compression choice was skipped.', error);
            }
            return fallback;
        }

        summarizePhotoManagerNormalSaveResults(results = []) {
            const list = Array.isArray(results) ? results.filter(Boolean) : [];
            if (!list.length) return '';
            const compressed = list.filter(item => item.status === 'compressed').length;
            const transparentOriginal = list.filter(item => item.status === 'transparent-original').length;
            const original = list.length - compressed - transparentOriginal;
            const parts = [];
            if (compressed) parts.push(`圧縮保存 ${compressed}件`);
            if (transparentOriginal) parts.push(`透過画像のためそのまま ${transparentOriginal}件`);
            if (original) parts.push(`そのまま保存 ${original}件`);
            return parts.join(' / ');
        }

        resetPhotoManagerNormalCompressionChoice() {
            this.ensurePhotoManagerData();
            store.activeData.photoManagerNormalCompressionMode = 'ask';
            store.save();
            this.showPhotoManagerNotice('通常画像の保存時圧縮を、毎回確認に戻しました。');
        }

        openPhotoManagerCompressionSettingDialog() {
            const body = `
                <div class="photo-manager-review-summary">
                    <b>保存時圧縮</b>
                    <span>現在設定: ${this.escapeHtml(this.getPhotoManagerNormalCompressionModeLabel())}</span>
                </div>
                <div class="photo-manager-compression-choice">
                    <button type="button" class="primary-btn" onclick="app.setPhotoManagerNormalCompressionMode('ask')"><i class="fa-solid fa-circle-question"></i> 毎回確認</button>
                    <button type="button" class="primary-btn" onclick="app.setPhotoManagerNormalCompressionMode('auto')"><i class="fa-solid fa-wand-magic-sparkles"></i> おすすめ自動</button>
                    <button type="button" class="primary-btn" onclick="app.setPhotoManagerNormalCompressionMode('compress')"><i class="fa-solid fa-compress"></i> 常に圧縮</button>
                    <button type="button" class="secondary-btn" onclick="app.setPhotoManagerNormalCompressionMode('original')"><i class="fa-regular fa-image"></i> 常にそのまま</button>
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()"><i class="fa-solid fa-xmark"></i> 閉じる</button>
                </div>`;
            this.openPhotoManagerReviewDialog('写真管理の圧縮設定', body);
        }

        setPhotoManagerNormalCompressionMode(mode = 'ask') {
            this.ensurePhotoManagerData();
            store.activeData.photoManagerNormalCompressionMode = ['ask', 'auto', 'compress', 'original'].includes(mode) ? mode : 'ask';
            store.save();
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager?.();
            this.showPhotoManagerNotice(`保存時圧縮を「${this.getPhotoManagerNormalCompressionModeLabel()}」にしました。`);
        }

        getPhotoManagerNormalCompressionModeLabel() {
            this.ensurePhotoManagerData();
            const mode = store.activeData.photoManagerNormalCompressionMode || 'ask';
            if (mode === 'auto') return 'おすすめ自動';
            if (mode === 'compress') return '常に圧縮';
            if (mode === 'original') return '常にそのまま';
            return '毎回確認';
        }

        openPhotoManagerNormalCompressionChoiceDialog({ title = '画像', before = '', after = '', originalSrc = '', compressedSrc = '' } = {}) {
            return new Promise(resolve => {
                this._photoManagerNormalCompressionChoiceResolve = resolve;
                const body = `
                    <div class="photo-manager-review-summary">
                        <b>${this.escapeHtml(title)}</b>
                        <span>保存前 ${this.escapeHtml(before)} / 圧縮後 ${this.escapeHtml(after)} / 現在設定 ${this.escapeHtml(this.getPhotoManagerNormalCompressionModeLabel())}</span>
                    </div>
                    <div class="photo-manager-compression-compare compact">
                        <figure>
                            <figcaption><b>そのまま</b><span>${this.escapeHtml(before)}</span></figcaption>
                            <div class="photo-manager-compression-stage"><img src="${this.escapeHtml(originalSrc)}" alt="そのまま"></div>
                        </figure>
                        <figure>
                            <figcaption><b>圧縮後</b><span>${this.escapeHtml(after)}</span></figcaption>
                            <div class="photo-manager-compression-stage"><img src="${this.escapeHtml(compressedSrc)}" alt="圧縮後"></div>
                        </figure>
                    </div>
                    <div class="photo-manager-compression-choice">
                        <button type="button" class="primary-btn" onclick="app.resolvePhotoManagerNormalCompressionChoice('compress')"><i class="fa-solid fa-compress"></i> 今回だけ圧縮</button>
                        <button type="button" class="primary-btn" onclick="app.resolvePhotoManagerNormalCompressionChoice('always-compress')"><i class="fa-solid fa-check-double"></i> 今後も常に圧縮</button>
                        <button type="button" class="secondary-btn" onclick="app.resolvePhotoManagerNormalCompressionChoice('original')"><i class="fa-regular fa-image"></i> 今回はそのまま</button>
                        <button type="button" class="secondary-btn" onclick="app.resolvePhotoManagerNormalCompressionChoice('always-original')"><i class="fa-solid fa-ban"></i> 今後も常にそのまま</button>
                    </div>`;
                this.openPhotoManagerReviewDialog('保存時の圧縮選択', body);
            });
        }

        resolvePhotoManagerNormalCompressionChoice(choice = 'original') {
            const resolver = this._photoManagerNormalCompressionChoiceResolve;
            this._photoManagerNormalCompressionChoiceResolve = null;
            this.closePhotoManagerReviewDialog();
            if (typeof resolver === 'function') resolver(choice || 'original');
        }
        async importPhotoManagerFiles(fileList) {
            const files = Array.from(fileList || []).filter(file => /^image\//i.test(file.type || ''));
            if (!files.length) return;
            const library = this.getPhotoManagerLibrary();
            const today = this.getPhotoManagerToday();
            const saveResults = [];
            const imported = [];
            for (const file of files) {
                try {
                    const originalSrc = await this.readPhotoManagerFileAsDataUrl(file);
                    const prepared = await this.preparePhotoManagerNormalSaveSource(
                        originalSrc,
                        file.name ? file.name.replace(/\.[^.]+$/, '') : '',
                        { forceAsk: true }
                    );
                    const src = prepared.src || originalSrc;
                    saveResults.push(prepared);
                    const added = {
                        id: this.createPhotoManagerLibraryId(),
                        src,
                        name: file.name ? file.name.replace(/\.[^.]+$/, '') : '取込画像',
                        caption: '',
                        date: today,
                        marks: [],
                        createdAt: Date.now()
                    };
                    library.unshift(added);
                    imported.push(added);
                    if (prepared.compressed) this.rememberPhotoManagerCompressedSource(src, true);
                    if (prepared.transparent) this.rememberPhotoManagerTransparentSource(src, true);
                    else await this.detectAndRememberPhotoManagerTransparency(src, false);
                } catch (error) {
                    console.error(error);
                }
            }
            store.save();
            const sourceSelect = document.getElementById('photo-manager-source');
            if (sourceSelect && sourceSelect.value !== 'library') sourceSelect.value = 'library';
            this.renderPhotoManager();
            const summary = this.summarizePhotoManagerNormalSaveResults(saveResults);
            if (summary) this.showPhotoManagerNotice(`${files.length}枚の画像を登録しました。${summary}`);
            if (imported.length) {
                this._imageSourceInitialImportIds = new Set(imported.map(item => item.id));
                requestAnimationFrame(() => this.openImageSourceChoiceTransparencyPreview(imported[0].id));
            }
        }

        async splitPhotoManagerStampSheet(src = '') {
            if (!src) return [];
            let workingSrc = src;
            const alreadyTransparent = await this.imageHasTransparentPixels(src);
            if (!alreadyTransparent && typeof this.createTransparentPhotoManagerSource === 'function') {
                const transparent = await this.createTransparentPhotoManagerSource(src, {
                    tolerance: 58,
                    gapSealRadius: 0,
                    clearInnerHoles: false
                });
                workingSrc = transparent?.src || src;
            }
            const image = await this.loadPhotoManagerImage(workingSrc);
            const width = image.naturalWidth || image.width || 1;
            const height = image.naturalHeight || image.height || 1;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(image, 0, 0, width, height);
            const pixels = ctx.getImageData(0, 0, width, height).data;
            const total = width * height;
            const visited = new Uint8Array(total);
            const queue = new Int32Array(total);
            const components = [];
            const minArea = Math.max(32, Math.round(total * 0.00008));
            const isSolid = index => pixels[index * 4 + 3] >= 28;
            for (let start = 0; start < total; start += 1) {
                if (visited[start] || !isSolid(start)) continue;
                let head = 0;
                let tail = 0;
                let area = 0;
                let minX = width;
                let minY = height;
                let maxX = 0;
                let maxY = 0;
                visited[start] = 1;
                queue[tail++] = start;
                while (head < tail) {
                    const index = queue[head++];
                    const x = index % width;
                    const y = Math.floor(index / width);
                    area += 1;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    const neighbors = [
                        x > 0 ? index - 1 : -1,
                        x < width - 1 ? index + 1 : -1,
                        y > 0 ? index - width : -1,
                        y < height - 1 ? index + width : -1
                    ];
                    for (const next of neighbors) {
                        if (next < 0 || visited[next] || !isSolid(next)) continue;
                        visited[next] = 1;
                        queue[tail++] = next;
                    }
                }
                if (area >= minArea) components.push({ area, minX, minY, maxX, maxY });
            }
            components.sort((a, b) => {
                const rowTolerance = Math.max(12, Math.min(a.maxY - a.minY, b.maxY - b.minY) * 0.35);
                if (Math.abs(a.minY - b.minY) <= rowTolerance) return a.minX - b.minX;
                return a.minY - b.minY;
            });
            return components.slice(0, 80).map(component => {
                const pad = Math.max(4, Math.round(Math.max(width, height) * 0.006));
                const x = Math.max(0, component.minX - pad);
                const y = Math.max(0, component.minY - pad);
                const right = Math.min(width - 1, component.maxX + pad);
                const bottom = Math.min(height - 1, component.maxY + pad);
                const crop = document.createElement('canvas');
                crop.width = right - x + 1;
                crop.height = bottom - y + 1;
                crop.getContext('2d').drawImage(canvas, x, y, crop.width, crop.height, 0, 0, crop.width, crop.height);
                return { src: crop.toDataURL('image/png'), width: crop.width, height: crop.height };
            });
        }

        choosePhotoManagerStampSheetFile() {
            const input = document.getElementById('photo-manager-stamp-sheet-input');
            if (!input) return;
            input._imageSourceDirectOnce = true;
            input.click();
        }

        async importPhotoManagerStampSheet(fileList) {
            const file = Array.from(fileList || []).find(item => /^image\//i.test(item.type || ''));
            if (!file) return;
            try {
                const src = await this.readPhotoManagerFileAsDataUrl(file);
                const pieces = await this.splitPhotoManagerStampSheet(src);
                if (pieces.length < 2) {
                    return this.showPhotoManagerNotice('個別スタンプを検出できませんでした。背景を透過して、スタンプ同士に隙間を空けてください。');
                }
                const baseName = String(file.name || 'スタンプ分割').replace(/\.[^.]+$/, '') || 'スタンプ分割';
                this._photoManagerStampSheetPending = { baseName, pieces };
                const body = `
                    <div class="photo-manager-review-summary">
                        <b>${pieces.length}個を検出</b>
                        <span>内容を確認してから写真管理へ登録します。</span>
                    </div>
                    <div class="photo-manager-stamp-sheet-preview">
                        ${pieces.map((piece, index) => `<figure><img src="${piece.src}" alt="スタンプ${index + 1}"><figcaption>${index + 1} / ${piece.width}×${piece.height}</figcaption></figure>`).join('')}
                    </div>
                    <div class="photo-manager-review-actions">
                        <button type="button" class="secondary-btn" onclick="app.cancelPhotoManagerStampSheetImport()">キャンセル</button>
                        <button type="button" class="primary-btn" onclick="app.applyPhotoManagerStampSheetImport()"><i class="fa-solid fa-images"></i> ${pieces.length}個を登録</button>
                    </div>`;
                this.openPhotoManagerReviewDialog('スタンプ分割の確認', body);
            } catch (error) {
                console.error(error);
                this.showPhotoManagerNotice('スタンプ分割に失敗しました。');
            }
        }
        cancelPhotoManagerStampSheetImport() {
            this._photoManagerStampSheetPending = null;
            this.closePhotoManagerReviewDialog();
        }

        async applyPhotoManagerStampSheetImport() {
            const pending = this._photoManagerStampSheetPending;
            if (!pending?.pieces?.length) return;
            let count = 0;
            for (let index = 0; index < pending.pieces.length; index += 1) {
                let src = pending.pieces[index].src;
                let compressed = false;
                try {
                    const result = await this.createCompressedPhotoManagerSource(src);
                    if (result?.changed && result.src) {
                        src = result.src;
                        compressed = true;
                    }
                } catch (_) {
                    // PNG縺ｮ縺ｾ縺ｾ縺ｧ繧ら匳骭ｲ繧堤ｶ壹￠繧・
                }
                const item = this.addPhotoManagerLibraryImage(src, `${pending.baseName} ${String(index + 1).padStart(2, '0')}`);
                if (!item) continue;
                store.activeData.photoManagerTags[item.id] = ['スタンプ', '透過', '分割'];
                this.rememberPhotoManagerTransparentSource(src, true);
                if (compressed) this.rememberPhotoManagerCompressedSource(src, true);
                count += 1;
            }
            this._photoManagerStampSheetPending = null;
            this.closePhotoManagerReviewDialog();
            this.finishPhotoManagerImport(count, `${count}個の分割スタンプを登録しました。`);
        }

        async importPhotoManagerClipboardBlob(blob) {
            if (!blob || !/^image\//i.test(blob.type || '')) return false;
            const originalSrc = await this.readPhotoManagerFileAsDataUrl(blob);
            const prepared = await this.preparePhotoManagerNormalSaveSource(originalSrc, 'クリップボード画像', { forceAsk: true });
            const src = prepared.src || originalSrc;
            const added = this.addPhotoManagerLibraryImage(src, 'クリップボード画像');
            if (added) {
                this._photoManagerClipboardSaveResults?.push(prepared);
                if (prepared.compressed) this.rememberPhotoManagerCompressedSource(src, true);
                if (prepared.transparent) this.rememberPhotoManagerTransparentSource(src, true);
                else await this.detectAndRememberPhotoManagerTransparency(src, false);
            }
            return added || null;
        }

        async importPhotoManagerImageFromClipboard() {
            if (!navigator.clipboard?.read) {
                this.showPhotoManagerNotice('このブラウザではクリップボード画像の直接取り込みに対応していません。写真管理画面でCtrl+Vでも貼り付けできます。');
                return;
            }
            try {
                const items = await navigator.clipboard.read();
                let count = 0;
                const imported = [];
                this._photoManagerClipboardSaveResults = [];
                for (const item of items) {
                    const type = item.types?.find(value => /^image\//i.test(value));
                    if (!type) continue;
                    const blob = await item.getType(type);
                    const added = await this.importPhotoManagerClipboardBlob(blob);
                    if (added) {
                        count += 1;
                        imported.push(added);
                    }
                }
                if (!count) {
                    this.showPhotoManagerNotice('クリップボード内に取り込める画像がありませんでした。');
                    return;
                }
                this.finishPhotoManagerImport(count, `${count}枚のクリップボード画像を登録しました。`);
                if (imported.length) {
                    this._imageSourceInitialImportIds = new Set(imported.map(item => item.id));
                    requestAnimationFrame(() => this.openImageSourceChoiceTransparencyPreview(imported[0].id));
                }
            } catch (error) {
                console.error(error);
                this.showPhotoManagerNotice('クリップボード画像の取り込みに失敗しました。写真管理画面でCtrl+Vでも貼り付けできます。');
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
                const imported = [];
                for (const item of imageItems) {
                    const file = item.getAsFile?.();
                    const added = file ? await this.importPhotoManagerClipboardBlob(file) : null;
                    if (added) {
                        count += 1;
                        imported.push(added);
                    }
                }
                this.finishPhotoManagerImport(count, `${count}枚のクリップボード画像を登録しました。`);
                if (imported.length) {
                    this._imageSourceInitialImportIds = new Set(imported.map(item => item.id));
                    requestAnimationFrame(() => this.openImageSourceChoiceTransparencyPreview(imported[0].id));
                }
            };
            document.addEventListener('paste', this._photoManagerPasteImportListener);
        }

        findPhotoManagerItem(id) {
            return this.collectPhotoManagerItems().find(item => item.id === id) || null;
        }

        openPhotoManagerSource(id) {
            const item = this.findPhotoManagerItem(id);
            if (!item) return alert('写真が見つかりませんでした。');
            item.open?.();
        }

        openPhotoManagerBlankShiftPhotoCompare() {
            this.openShiftPhotoCompareWithPhotos?.([], {
                source: 'photoManagerBlank',
                title: '白紙 - 写真比較',
                globalMarks: []
            });
        }

        openPhotoManagerBlankEdit(id = '') {
            const item = this.findPhotoManagerItem(id);
            if (!item || item.source !== 'library') return this.showPhotoManagerNotice('白紙再編集の元画像が見つかりませんでした。');
            const libraryPhoto = this.getPhotoManagerLibrary().find(photo => photo.id === item.id);
            const edit = libraryPhoto?.photoCompareBlankEdit || item.photoCompareBlankEdit || null;
            if (!edit || edit.type !== 'blank') return this.showPhotoManagerNotice('この画像には白紙再編集データがありません。');
            const color = /^#[0-9a-f]{6}$/i.test(edit.blankBaseColor || '') ? edit.blankBaseColor : '#ffffff';
            const photo = this.createShiftPhotoCompareBlankBasePhoto?.(color);
            if (!photo) return this.showPhotoManagerNotice('白紙編集画面を開けませんでした。');
            photo.caption = edit.caption || '白紙';
            photo.marks = this.parseShiftPhotoCompareMarks?.(JSON.stringify(edit.marks || [])) || [];
            this.openShiftPhotoCompareWithPhotos?.([photo], {
                source: 'photoManagerBlankEdit',
                title: `写真編集 ${this.getPhotoManagerName(item) || item.defaultName || "写真"}`,
                globalMarks: [],
                photoManagerBlankEditItemId: item.id,
                onClose: () => {
                    if (document.getElementById('photo-manager-list')) setTimeout(() => this.renderPhotoManager(), 0);
                }
            });
        }

        getPhotoManagerBlankTemplates() {
            if (!Array.isArray(store.activeData.photoManagerBlankTemplates)) store.activeData.photoManagerBlankTemplates = [];
            return store.activeData.photoManagerBlankTemplates;
        }

        clonePhotoManagerBlankEdit(edit = null) {
            if (!edit || edit.type !== 'blank') return null;
            return JSON.parse(JSON.stringify(edit));
        }

        hasPhotoManagerBlankEditContent(edit = null) {
            if (!edit || edit.type !== 'blank') return false;
            const baseColor = String(edit.blankBaseColor || '#ffffff').toLowerCase();
            const hasMarks = Array.isArray(edit.marks) && edit.marks.length > 0;
            return hasMarks || (baseColor && baseColor !== '#ffffff');
        }

        getPhotoManagerBlankEditName(edit = null) {
            const updatedAt = Number(edit?.updatedAt || Date.now()) || Date.now();
            const date = new Date(updatedAt);
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const hour = date.getHours();
            const minute = String(date.getMinutes()).padStart(2, '0');
            return `${month}/${day} ${hour}:${minute} 白紙編集`;
        }

        async syncPhotoManagerBlankEditFromCompare(context = {}) {
            if (!context || !String(context.source || '').startsWith('photoManagerBlank')) return null;
            const wrap = document.querySelector('.shift-photo-compare-image-wrap[data-photo-index="0"]')
                || document.querySelector('.shift-photo-compare-image-wrap');
            if (!wrap || typeof this.getShiftPhotoCompareBlankEditData !== 'function') return null;
            const edit = this.getShiftPhotoCompareBlankEditData(wrap);
            if (!edit) return null;

            const library = this.getPhotoManagerLibrary?.();
            if (!Array.isArray(library)) return null;
            const existingId = context.photoManagerBlankEditItemId || '';
            const existingItem = existingId ? this.findPhotoManagerItem?.(existingId) : null;
            const libraryItem = existingId ? library.find(photo => photo.id === existingId) : null;
            if (!existingItem && !libraryItem && !this.hasPhotoManagerBlankEditContent(edit)) return null;

            let renderedSrc = '';
            try {
                renderedSrc = await this.renderShiftPhotoCompareWrapWithMarks?.(wrap);
            } catch (error) {
                console.warn('Failed to render blank edit preview.', error);
            }
            const fallbackSrc = this.createShiftPhotoCompareBlankBaseSrc?.(edit.blankBaseColor || '#ffffff') || '';
            const saveSrc = renderedSrc || fallbackSrc;
            if (!saveSrc) return null;

            let savedItem = libraryItem || null;
            if (existingItem?.source === 'library' && typeof existingItem.replacePhoto === 'function') {
                existingItem.replacePhoto(saveSrc);
                savedItem = library.find(photo => photo.id === existingId) || savedItem;
            }
            if (!savedItem) {
                savedItem = this.addPhotoManagerLibraryImage(saveSrc, this.getPhotoManagerBlankEditName(edit));
                context.photoManagerBlankEditItemId = savedItem?.id || context.photoManagerBlankEditItemId || '';
            } else {
                savedItem.src = saveSrc;
                savedItem.updatedAt = Date.now();
            }
            if (!savedItem) return null;

            savedItem.photoCompareBlankEdit = edit;
            savedItem.annotated = this.hasPhotoManagerBlankEditContent(edit);
            savedItem.caption = savedItem.caption || '';
            savedItem.name = savedItem.name || this.getPhotoManagerBlankEditName(edit);
            store.save();
            if (document.getElementById('photo-manager-list')) this.renderPhotoManager?.();
            return savedItem;
        }

        duplicatePhotoManagerBlankEdit(id = '') {
            const item = this.findPhotoManagerItem(id);
            if (!item || item.source !== 'library' || item.photoCompareBlankEdit?.type !== 'blank') return this.showPhotoManagerNotice('白紙編集データが見つかりません。');
            const added = this.addPhotoManagerLibraryImage(item.src, `${this.getPhotoManagerName(item) || item.defaultName || '白紙編集'} コピー`);
            if (!added) return;
            added.photoCompareBlankEdit = this.clonePhotoManagerBlankEdit(item.photoCompareBlankEdit);
            added.annotated = item.annotated;
            added.tags = Array.isArray(item.tags) ? [...item.tags] : [];
            store.save();
            this.renderPhotoManager?.();
            this.showPhotoManagerNotice('白紙編集を複製しました。');
        }

        savePhotoManagerBlankTemplate(id = '') {
            const item = this.findPhotoManagerItem(id);
            if (!item || item.source !== 'library' || item.photoCompareBlankEdit?.type !== 'blank') return this.showPhotoManagerNotice('白紙編集データが見つかりません。');
            const templates = this.getPhotoManagerBlankTemplates();
            const createdAt = Date.now();
            templates.unshift({
                id: `blankTemplate_${createdAt}_${Math.random().toString(36).slice(2, 8)}`,
                name: this.getPhotoManagerName(item) || item.defaultName || '白紙テンプレート',
                src: item.src,
                edit: this.clonePhotoManagerBlankEdit(item.photoCompareBlankEdit),
                createdAt,
                updatedAt: createdAt
            });
            store.save();
            this.showPhotoManagerNotice('白紙テンプレートを保存しました。');
        }

        openPhotoManagerBlankTemplateDialog() {
            const templates = this.getPhotoManagerBlankTemplates();
            document.getElementById('photo-manager-blank-template-modal')?.remove();
            const html = `
                <div id="photo-manager-blank-template-modal" class="photo-manager-blank-template-modal" onclick="app.closePhotoManagerBlankTemplateDialog(event)">
                    <div class="photo-manager-blank-template-card" onclick="event.stopPropagation()">
                        <header>
                            <div>
                                <h3><i class="fa-regular fa-clone"></i> 白紙テンプレート</h3>
                                <p>保存済みの白紙編集から開始できます。</p>
                            </div>
                            <button type="button" class="icon-btn" onclick="app.closePhotoManagerBlankTemplateDialog()" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
                        </header>
                        <div class="photo-manager-blank-template-list">
                            ${templates.length ? templates.map(template => `
                                <article>
                                    <img src="${template.src || this.createShiftPhotoCompareBlankBaseSrc?.(template.edit?.blankBaseColor || '#ffffff') || ''}" alt="${this.escapeHtml(template.name || '白紙テンプレート')}">
                                    <div>
                                        <b>${this.escapeHtml(template.name || '白紙テンプレート')}</b>
                                        <small>${template.createdAt ? this.escapeHtml(new Date(template.createdAt).toLocaleString('ja-JP')) : ''}</small>
                                    </div>
                                    <button type="button" class="primary-btn" onclick="app.openPhotoManagerBlankTemplate('${this.escapeJs(template.id)}')"><i class="fa-solid fa-file-import"></i> 開く</button>
                                    <button type="button" class="danger-btn icon-only" onclick="app.deletePhotoManagerBlankTemplate('${this.escapeJs(template.id)}')" title="削除"><i class="fa-solid fa-trash-can"></i></button>
                                </article>
                            `).join('') : '<div class="photo-manager-blank-template-empty">白紙編集カードの「テンプレ保存」から登録できます。</div>'}
                        </div>
                    </div>
                </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        }

        openPhotoManagerBlankTemplate(templateId = '') {
            const template = this.getPhotoManagerBlankTemplates().find(item => item.id === templateId);
            if (!template?.edit || template.edit.type !== 'blank') return this.showPhotoManagerNotice('白紙テンプレートが見つかりません。');
            const color = /^#[0-9a-f]{6}$/i.test(template.edit.blankBaseColor || '') ? template.edit.blankBaseColor : '#ffffff';
            const photo = this.createShiftPhotoCompareBlankBasePhoto?.(color);
            if (!photo) return this.showPhotoManagerNotice('白紙テンプレートを開けませんでした。');
            photo.caption = template.edit.caption || '白紙';
            photo.marks = this.parseShiftPhotoCompareMarks?.(JSON.stringify(template.edit.marks || [])) || [];
            this.closePhotoManagerBlankTemplateDialog();
            this.openShiftPhotoCompareWithPhotos?.([photo], {
                source: 'photoManagerBlankTemplate',
                title: `白紙テンプレート - ${template.name || '白紙'}`,
                globalMarks: []
            });
        }

        deletePhotoManagerBlankTemplate(templateId = '') {
            const templates = this.getPhotoManagerBlankTemplates();
            const next = templates.filter(item => item.id !== templateId);
            store.activeData.photoManagerBlankTemplates = next;
            store.save();
            this.openPhotoManagerBlankTemplateDialog();
        }

        closePhotoManagerBlankTemplateDialog(event = null) {
            if (event && event.target?.id !== 'photo-manager-blank-template-modal') return;
            document.getElementById('photo-manager-blank-template-modal')?.remove();
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
            const getEditorFullSignature = value => JSON.stringify({
                caption: value?.caption || '',
                marks: Array.isArray(value?.marks) ? value.marks : []
            });
            const getEditorSemanticSignature = value => JSON.stringify({
                caption: value?.caption || '',
                marks: (Array.isArray(value?.marks) ? value.marks : []).map(mark => ({
                    mode: mark?.mode || 'circle',
                    x: Number(mark?.x) || 0,
                    y: Number(mark?.y) || 0,
                    size: Number(mark?.size) || 56,
                    angle: Number(mark?.angle) || 0,
                    stretch: Number(mark?.stretch) || 1,
                    stretchY: Number(mark?.stretchY) || 1,
                    stroke: Number(mark?.stroke) || 1,
                    outline: mark?.outline !== false,
                    color: mark?.color || '#dc2626',
                    text: String(mark?.text || ''),
                    imageSrc: mark?.imageSrc || '',
                    originalImageSrc: mark?.originalImageSrc || '',
                    imageFit: mark?.imageFit === 'fill' ? 'fill' : '',
                    imageShape: mark?.imageShape === 'circle' ? 'circle' : '',
                    imageZoom: Number(mark?.imageZoom) || 1,
                    imageOffsetX: Number(mark?.imageOffsetX) || 0,
                    imageOffsetY: Number(mark?.imageOffsetY) || 0,
                    circleLibraryId: String(mark?.circleLibraryId || ''),
                    fillColor: mark?.fillColor || '',
                    opacity: Number(mark?.opacity) || 1,
                    flipX: Number(mark?.flipX) === -1 ? -1 : 1,
                    flipY: Number(mark?.flipY) === -1 ? -1 : 1,
                    font: mark?.font || 'gothic',
                    anchor: mark?.anchor === 'left' ? 'left' : 'center',
                    textAlign: mark?.textAlign || (mark?.mode === 'boxedText' ? 'center' : 'left'),
                    boxTrim: mark?.boxTrim === true || mark?.boxTrim === '1' ? '1' : '',
                    pairId: mark?.pairId || '',
                    pairRole: mark?.pairRole || '',
                    groupId: mark?.groupId || '',
                    locked: mark?.locked === true || mark?.locked === '1',
                    points: Array.isArray(mark?.points) ? mark.points.map(point => ({ x: Number(point?.x) || 0, y: Number(point?.y) || 0 })) : []
                }))
            });
            let lastFullSignature = getEditorFullSignature(photo);
            let lastSemanticSignature = getEditorSemanticSignature(photo);
            let editorDataChanged = false;
            let editorSemanticChanged = false;
            this.openShiftPhotoCompareWithPhotos([photo], {
                source: 'photoManager',
                title: `写真編集 ${this.getPhotoManagerName(item) || item.defaultName || "写真"}`,
                globalMarks: [],
                onSync: (context) => {
                    const edited = context.photos?.[0] || {};
                    const fullSignature = getEditorFullSignature(edited);
                    const semanticSignature = getEditorSemanticSignature(edited);
                    if (fullSignature === lastFullSignature) return;
                    const semanticChanged = semanticSignature !== lastSemanticSignature;
                    const userSemanticChanged = semanticChanged && !context._closing;
                    if (item.source === 'library' && libraryPhoto) {
                        libraryPhoto.caption = edited.caption || '';
                        libraryPhoto.marks = Array.isArray(edited.marks) ? edited.marks : [];
                        if (userSemanticChanged) libraryPhoto.updatedAt = Date.now();
                    } else {
                        overlays[item.id] = Array.isArray(edited.marks) ? edited.marks : [];
                        if (userSemanticChanged) store.activeData.photoManagerEditedAt[item.id] = Date.now();
                    }
                    lastFullSignature = fullSignature;
                    lastSemanticSignature = semanticSignature;
                    editorDataChanged = true;
                    editorSemanticChanged = editorSemanticChanged || userSemanticChanged;
                    if (!context._closing) store.save();
                },
                onClose: () => {
                    setTimeout(() => {
                        if (editorDataChanged) store.save();
                        if (editorSemanticChanged && document.getElementById('photo-manager-list')) this.renderPhotoManager();
                    }, 0);
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
            if (!text) return this.showPhotoManagerNotice('新しいタイトルを入力してください。');
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
            items.forEach(item => {
                [...(item.marks || []), ...(item.globalMarks || []), ...(item.managerMarks || [])].forEach(mark => {
                    if (mark?.mode !== 'image') return;
                    if (mark.imageSrc) usedSrcs.add(mark.imageSrc);
                    if (mark.originalImageSrc) usedSrcs.add(mark.originalImageSrc);
                });
            });
            return items.filter(item => item.source === 'library' && item.src && !usedSrcs.has(item.src));
        }

        deleteUnusedPhotoManagerLibraryItems() {
            const unused = this.getUnusedPhotoManagerLibraryItems();
            if (!unused.length) return this.showPhotoManagerNotice('削除できる未使用画像はありません。');
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
            store.activeData.photoManagerTrash = trash.slice(0, 15);
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

        formatPhotoManagerTrashDate(value = Date.now()) {
            const date = new Date(value || Date.now());
            if (Number.isNaN(date.getTime())) return '';
            const month = date.getMonth() + 1;
            const day = date.getDate();
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            return `${month}/${day} ${hour}:${minute}`;
        }

        openPhotoManagerTrashDialog() {
            this.ensurePhotoManagerData();
            const trash = store.activeData.photoManagerTrash || [];
            const help = `
                <div class="photo-manager-trash-help">
                    <b><i class="fa-solid fa-circle-info"></i> 復元できるもの</b>
                    <p>写真管理画面でファイル読込・クリップボード登録した画像、または他の画面から「写真管理へ保存」した画像だけ復元できます。復元先は写真管理の「取込画像」です。</p>
                    <b><i class="fa-solid fa-triangle-exclamation"></i> 復元できないもの</b>
                    <p>連絡帳・機械・部品・メンテ履歴・手順書に貼っただけの画像は、写真管理に登録した画像とは別扱いなので、このゴミ箱の対象外です。完全削除した画像や、上限15件から古くなって消えた画像も復元できません。</p>
                </div>
            `;
            const trashBytes = trash.reduce((sum, entry) => sum + (this.estimatePhotoManagerImageBytes?.(entry.src) || 0), 0);
            const body = trash.length ? `
                <div class="photo-manager-review-summary">
                    <b>${trash.length}件</b>
                    <span>約${this.formatPhotoManagerBytes?.(trashBytes) || '0KB'}を保持中。ここに残る画像もJSON容量に含まれます。</span>
                </div>
                ${help}
                <div class="photo-manager-review-list">
                    ${trash.map(entry => `
                        <article class="photo-manager-review-item">
                            <img src="${this.escapeHtml(entry.src)}" alt="${this.escapeHtml(entry.name || '画像')}">
                            <div>
                                <b>${this.escapeHtml(entry.name || '画像')}</b>
                                <span>${this.escapeHtml(this.formatPhotoManagerTrashDate(entry.deletedAt || Date.now()))} / 約${this.formatPhotoManagerBytes?.(this.estimatePhotoManagerImageBytes?.(entry.src) || 0) || '0KB'}</span>
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
            if (!confirm('削除済み画像を完全に空にします。よろしいですか？')) return;
            store.activeData.photoManagerTrash = [];
            store.save();
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
        }

        executeDeleteUnusedPhotoManagerLibraryItems() {
            const unused = this.getUnusedPhotoManagerLibraryItems();
            if (!unused.length) {
                this.closePhotoManagerReviewDialog();
                return this.showPhotoManagerNotice('削除できる未使用画像はありません。');
            }
            const names = this.ensurePhotoManagerData();
            const overlays = this.getPhotoManagerOverlays();
            unused.sort((a, b) => (b.deleteIndex || 0) - (a.deleteIndex || 0)).forEach(item => {
                this.movePhotoManagerItemToTrash(item, 'unused');
                item.deletePhoto?.();
                delete names[item.id];
                delete overlays[item.id];
                this.ensurePhotoManagerSelectionStore().delete(item.id);
                this.removePhotoManagerSourceFromRecentCachesIfUnused(item.src);
            });
            store.save();
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`${unused.length}件の未使用画像を削除しました。`);
        }

        getPhotoManagerDuplicateGroups(items = null) {
            const groups = new Map();
            (items || this.collectPhotoManagerItems()).forEach(item => {
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

        getPhotoManagerDuplicateRecommendation(target = {}, usages = []) {
            if (target.source !== 'library') return '';
            if ((usages || []).some(item => item.source !== 'library')) return '使用中の画像です';
            if ((usages || []).some(item => item.source === 'library')) return '同じ画像が写真管理にあります';
            return '';
        }
        getPhotoManagerStampUsageItemsForSrc(src = '', includeLibrary = false, items = null) {
            if (!src) return [];
            return (items || this.collectPhotoManagerItems()).filter(item => {
                if (!includeLibrary && item.source === 'library') return false;
                const marks = [...(item.marks || []), ...(item.globalMarks || []), ...(item.managerMarks || [])];
                return marks.some(mark => mark?.mode === 'image'
                    && (mark.imageSrc === src || mark.originalImageSrc === src));
            }).map(item => ({ ...item, usageKind: 'stamp' }));
        }

        getPhotoManagerUsageItemsForSrc(src = '', includeLibrary = false) {
            if (!src) return [];
            const items = this.collectPhotoManagerItems();
            const baseUsages = items
                .filter(item => item.src === src && (includeLibrary || item.source !== 'library'))
                .map(item => ({ ...item, usageKind: 'base' }));
            return [...baseUsages, ...this.getPhotoManagerStampUsageItemsForSrc(src, includeLibrary, items)];
        }

        getPhotoManagerUsageIndex(items = this.collectPhotoManagerItems(), includeLibrary = false) {
            const index = new Map();
            (items || []).forEach(item => {
                if (!item?.src) return;
                if (includeLibrary || item.source !== 'library') {
                    if (!index.has(item.src)) index.set(item.src, []);
                    index.get(item.src).push({ ...item, usageKind: 'base' });
                }
                const marks = [...(item.marks || []), ...(item.globalMarks || []), ...(item.managerMarks || [])];
                marks.forEach(mark => {
                    const sources = [mark?.imageSrc, mark?.originalImageSrc].filter(Boolean);
                    sources.forEach(src => {
                        if (!src) return;
                        if (!index.has(src)) index.set(src, []);
                        index.get(src).push({ ...item, usageKind: 'stamp' });
                    });
                });
            });
            return index;
        }

        getPhotoManagerUsageSummary(item = {}, usageIndex = null) {
            usageIndex = usageIndex || this.getPhotoManagerUsageIndex();
            const usages = usageIndex.get(item.src) || [];
            const count = usages.length;
            const stampCount = usages.filter(usage => usage.usageKind === 'stamp').length;
            const baseCount = count - stampCount;
            return {
                count,
                usages,
                stampCount,
                baseCount,
                label: stampCount && !baseCount ? 'スタンプで使用中' : (count ? `${count}カ所で使用中` : '未使用')
            };
        }

        getPhotoManagerUsageKindLabel(usage = {}) {
            return usage.usageKind === 'stamp' ? 'スタンプで使用中' : '画像として使用中';
        }

        openPhotoManagerUsageList(id = '') {
            const item = this.findPhotoManagerItem(id);
            if (!item?.src) return this.showPhotoManagerNotice?.('写真が見つかりませんでした。');
            const summary = this.getPhotoManagerUsageSummary(item);
            const usages = summary.usages || [];
            if (!usages.length) return this.showPhotoManagerNotice?.('この写真の使用先はありません。');
            const title = this.getPhotoManagerName(item) || item.defaultName || item.title || '写真';
            const body = `
                <div class="photo-manager-review-summary">
                    <b>${this.escapeHtml(title)}</b>
                    <span>使用先 ${usages.length}件 / 画像 ${summary.baseCount}件 / スタンプ ${summary.stampCount}件</span>
                </div>
                <div class="photo-manager-relation-list">
                    ${usages.map(usage => `
                        <article class="photo-manager-relation-item">
                            <img src="${usage.src || item.src}" alt="${this.escapeHtml(usage.title || title)}">
                            <div>
                                <b>${this.escapeHtml(this.getPhotoManagerSourceLabel(usage))} / ${this.escapeHtml(this.getPhotoManagerUsageKindLabel(usage))}</b>
                                <small>${this.escapeHtml([usage.date || '', usage.title || usage.defaultName || ''].filter(Boolean).join(' / '))}</small>
                                <div class="photo-manager-relation-chips">
                                    <button type="button" onclick="app.openPhotoManagerUsageSource('${this.escapeJs(usage.id)}')">
                                        <i class="fa-solid fa-up-right-from-square"></i> 使用先を開く
                                    </button>
                                </div>
                            </div>
                        </article>
                    `).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                </div>`;
            this.openPhotoManagerReviewDialog('写真の使用先', body);
        }
        getPhotoManagerPageOnlyItems(items = null) {
            items = items || this.collectPhotoManagerItems();
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

        executePhotoManagerPageOnlyCleanup() {
            const targets = this.getPhotoManagerPageOnlyItems().filter(item => this.getPhotoManagerPageOnlyDeleteChoice(item.id));
            if (!targets.length) return this.showPhotoManagerNotice('削除するページ内画像を選択してください。');
            const bytes = targets.reduce((sum, item) => sum + this.estimatePhotoManagerImageBytes(item.src), 0);
            if (!confirm(`${targets.length}件のページ内画像を削除します。\n目安: ${this.formatPhotoManagerBytes(bytes)}\n\n写真管理に登録済みの画像は削除されません。`)) return;
            const overlays = this.getPhotoManagerOverlays();
            targets.sort((a, b) => (b.deleteIndex || 0) - (a.deleteIndex || 0)).forEach(item => {
                item.deletePhoto?.();
                delete overlays[item.id];
                this.ensurePhotoManagerSelectionStore().delete(item.id);
                this.removePhotoManagerSourceFromRecentCachesIfUnused(item.src);
                if (this._photoManagerPageOnlyDeleteChoices) delete this._photoManagerPageOnlyDeleteChoices[item.id];
            });
            store.save();
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`ページ内だけの画像を${targets.length}件削除しました。`);
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
            if (!allItems.length) return this.showPhotoManagerNotice('写真管理に未登録のページ内画像はありません。');
            const items = this.getFilteredPhotoManagerPageOnlyItems();
            const selected = allItems.filter(item => this.getPhotoManagerPageOnlyDeleteChoice(item.id));
            const selectedBytes = selected.reduce((sum, item) => sum + this.estimatePhotoManagerImageBytes(item.src), 0);
            const visibleBytes = items.reduce((sum, item) => sum + this.estimatePhotoManagerImageBytes(item.src), 0);
            const source = this._photoManagerPageOnlySourceFilter || 'all';
            const sort = this._photoManagerPageOnlySort || 'old';
            const age = this._photoManagerPageOnlyAgeFilter || 'all';
            const sourceOptions = [
                ['all', '全分類'], ['shift', '連絡帳'], ['history', 'メンテ履歴'], ['guide', '手順書'], ['machine', '機械'], ['part', '部品']
            ];
            const ageOptions = [['all', '全期間'], ['3m', '3カ月以上'], ['6m', '6カ月以上'], ['1y', '1年以上'], ['2y', '2年以上']];
            const body = `
                <div class="photo-manager-review-summary danger">
                    <b>${items.length}件</b>
                    <span>写真管理に登録されていないページ内画像です。選択中 ${selected.length}件 / ${this.formatPhotoManagerBytes(selectedBytes)}</span>
                </div>
                <div class="photo-manager-page-only-actions">
                    <label>分類
                        <select onchange="app.setPhotoManagerPageOnlyFilter(this.value)">
                            ${sourceOptions.map(([value, label]) => `<option value="${value}" ${source === value ? 'selected' : ''}>${label}</option>`).join('')}
                        </select>
                    </label>
                    <label>期間
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
                            <option value="source" ${sort === 'source' ? 'selected' : ''}>分類順</option>
                        </select>
                    </label>
                    <button type="button" class="secondary-btn" onclick="app.setAllPhotoManagerPageOnlyDeleteChoices(true)">全選択</button>
                    <button type="button" class="secondary-btn" onclick="app.setAllPhotoManagerPageOnlyDeleteChoices(false)">解除</button>
                    <span>表示 ${items.length}件 / ${this.formatPhotoManagerBytes(visibleBytes)}</span>
                </div>
                <div class="photo-manager-review-list">
                    ${items.map(item => `
                        <article class="photo-manager-delete-review-card ${this.getPhotoManagerPageOnlyDeleteChoice(item.id) ? 'is-selected' : ''}">
                            <label class="photo-manager-delete-review-check">
                                <input type="checkbox" ${this.getPhotoManagerPageOnlyDeleteChoice(item.id) ? 'checked' : ''} onchange="app.setPhotoManagerPageOnlyDeleteChoice('${this.escapeJs(item.id)}', this.checked)">
                                削除
                            </label>
                            <img src="${this.escapeHtml(item.src)}" alt="${this.escapeHtml(item.title || '')}">
                            <div><b>${this.escapeHtml(this.getPhotoManagerName(item) || item.defaultName || item.title || '画像')}</b><small>${this.escapeHtml(this.getPhotoManagerSourceLabel(item))} / ${this.escapeHtml(item.date || '')}</small></div>
                            <button type="button" class="secondary-btn" onclick="app.registerPhotoManagerPageOnlyItem('${this.escapeJs(item.id)}')"><i class="fa-solid fa-bookmark"></i> 写真管理に登録</button>
                        </article>`).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                    <button type="button" class="danger-btn" onclick="app.executePhotoManagerPageOnlyCleanup()"><i class="fa-solid fa-trash"></i> 選択を削除</button>
                </div>`;
            this.openPhotoManagerReviewDialog('ページ内だけの画像整理', body);
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
                row.innerHTML = group.items.map(item => {
                    const label = this.getPhotoManagerSourceLabel(item);
                    const title = this.getPhotoManagerName(item) || item.defaultName || item.title || label;
                    return `<button type="button" class="${item.id === keepId ? 'active' : ''}" onclick="app.setPhotoManagerDuplicateKeep('${this.escapeJs(group.src)}', '${this.escapeJs(item.id)}')">残す: ${this.escapeHtml(label)} ${this.escapeHtml(String(title).slice(0, 24))}</button>`;
                }).join('');
                host.appendChild(row);
            });
        }

        selectPhotoManagerDuplicateGroup(index = 0) {
            const group = this._photoManagerDuplicateReviewGroups?.[Number(index)];
            if (!group) return;
            const selected = this.ensurePhotoManagerSelectionStore();
            group.items.forEach(item => selected.add(item.id));
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`${group.items.length}件の重複候補を選択しました。`);
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
            groups.forEach(group => {
                group.items.forEach(item => {
                    if (item.source === 'library') return;
                    if (this.getPhotoManagerDuplicatePageKeepChoice(item.id) === false) targets.push(item);
                });
            });
            return targets;
        }

        openPhotoManagerDuplicateReview() {
            const groups = this.getPhotoManagerDuplicateGroups();
            if (!groups.length) return this.showPhotoManagerNotice('重複画像はありません。');
            this._photoManagerDuplicateReviewGroups = groups;
            const deleteTargets = this.getPhotoManagerDuplicateDeleteTargets(groups);
            const body = `
                <div class="photo-manager-review-summary warning">
                    <b>${groups.length}組</b>
                    <span>同じ画像が複数あります。削除対象 ${deleteTargets.length}件</span>
                </div>
                <div class="photo-manager-review-list">
                    ${groups.map((group, index) => `
                        <article class="photo-manager-review-item">
                            <img src="${this.escapeHtml(group.src)}" alt="">
                            <div>
                                <b>${group.items.length}件の重複</b>
                                <small>${group.items.map(item => this.escapeHtml(this.getPhotoManagerSourceLabel(item))).join(' / ')}</small>
                                <button type="button" class="secondary-btn" onclick="app.selectPhotoManagerDuplicateGroup(${index})">この組を選択</button>
                            </div>
                        </article>`).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                    <button type="button" class="danger-btn" onclick="app.executePhotoManagerDuplicateCleanup()"><i class="fa-solid fa-trash"></i> 重複を整理</button>
                </div>`;
            this.openPhotoManagerReviewDialog('重複画像の整理', body);
            setTimeout(() => this.enhancePhotoManagerDuplicateReview(groups), 0);
        }

        executePhotoManagerDuplicateCleanup() {
            const groups = this.getPhotoManagerDuplicateGroups();
            const deleteTargets = this.getPhotoManagerDuplicateDeleteTargets(groups);
            if (!deleteTargets.length) return this.showPhotoManagerNotice('削除対象がありません。');
            if (!confirm(`${deleteTargets.length}件の重複画像を削除します。よろしいですか？`)) return;
            const names = this.ensurePhotoManagerData();
            const overlays = this.getPhotoManagerOverlays();
            deleteTargets.sort((a, b) => (b.deleteIndex || 0) - (a.deleteIndex || 0)).forEach(item => {
                this.movePhotoManagerItemToTrash(item, 'duplicate');
                item.deletePhoto?.();
                delete names[item.id];
                delete overlays[item.id];
                this.ensurePhotoManagerSelectionStore().delete(item.id);
                this.removePhotoManagerSourceFromRecentCachesIfUnused(item.src);
            });
            store.save();
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`${deleteTargets.length}件の重複画像を削除しました。`);
        }
        comparePhotoManagerVisualSignatures(first, second) {
            if (!first || !second) return null;
            const aspectDifference = Math.abs(first.aspect - second.aspect) / Math.max(first.aspect, second.aspect, 0.001);
            if (aspectDifference > 0.06) return null;
            let hashDistance = 0;
            for (let index = 0; index < first.hash.length; index += 1) {
                if (first.hash[index] !== second.hash[index]) hashDistance += 1;
            }
            if (hashDistance > 10) return null;
            let grayDifference = 0;
            for (let index = 0; index < first.gray.length; index += 1) {
                grayDifference += Math.abs(first.gray[index] - second.gray[index]);
            }
            grayDifference /= first.gray.length;
            if (grayDifference > 13) return null;
            const colorDifference = Math.sqrt(first.average.reduce((sum, value, index) => sum + Math.pow(value - second.average[index], 2), 0));
            if (colorDifference > 38) return null;
            const score = Math.max(0, Math.min(100, Math.round(100 - hashDistance * 0.9 - grayDifference * 1.4 - colorDifference * 0.25 - aspectDifference * 100)));
            return { score, hashDistance, grayDifference, colorDifference };
        }

        async findPhotoManagerSimilarGroups() {
            const sourceBuckets = new Map();
            this.collectPhotoManagerItems().forEach(item => {
                if (!item?.src) return;
                if (!sourceBuckets.has(item.src)) sourceBuckets.set(item.src, []);
                sourceBuckets.get(item.src).push(item);
            });
            const variants = Array.from(sourceBuckets.entries()).map(([src, items]) => ({ src, items }));
            if (variants.length < 2) return [];
            for (let start = 0; start < variants.length; start += 8) {
                const chunk = variants.slice(start, start + 8);
                await Promise.all(chunk.map(async variant => {
                    try { variant.signature = await this.createPhotoManagerVisualSignature(variant.src); }
                    catch (error) { variant.signature = null; }
                }));
                this.showPhotoManagerNotice?.(`鬘樔ｼｼ逕ｻ蜒上ｒ隗｣譫蝉ｸｭ窶ｦ ${Math.min(start + chunk.length, variants.length)}/${variants.length}`);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            const parent = variants.map((_, index) => index);
            const find = index => parent[index] === index ? index : (parent[index] = find(parent[index]));
            const unite = (left, right) => {
                const leftRoot = find(left);
                const rightRoot = find(right);
                if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
            };
            const comparisons = new Map();
            for (let left = 0; left < variants.length; left += 1) {
                if (!variants[left].signature) continue;
                for (let right = left + 1; right < variants.length; right += 1) {
                    if (!variants[right].signature) continue;
                    const result = this.comparePhotoManagerVisualSignatures(variants[left].signature, variants[right].signature);
                    if (!result) continue;
                    comparisons.set(`${left}:${right}`, result);
                    unite(left, right);
                }
            }
            const grouped = new Map();
            variants.forEach((variant, index) => {
                const root = find(index);
                if (!grouped.has(root)) grouped.set(root, []);
                grouped.get(root).push({ ...variant, sourceIndex: index });
            });
            return Array.from(grouped.values()).filter(group => group.length > 1).map((group, groupIndex) => {
                let score = 100;
                for (let left = 0; left < group.length; left += 1) {
                    for (let right = left + 1; right < group.length; right += 1) {
                        const a = Math.min(group[left].sourceIndex, group[right].sourceIndex);
                        const b = Math.max(group[left].sourceIndex, group[right].sourceIndex);
                        const comparison = comparisons.get(`${a}:${b}`);
                        if (comparison) score = Math.min(score, comparison.score);
                    }
                }
                return {
                    key: `similar_${groupIndex + 1}`,
                    score,
                    variants: group.map((variant, variantIndex) => ({
                        ...variant,
                        key: `similar_${groupIndex + 1}_${variantIndex + 1}`,
                        libraryItems: variant.items.filter(item => item.source === 'library')
                    }))
                };
            }).sort((a, b) => b.score - a.score);
        }

        async openPhotoManagerSimilarReview() {
            const groups = await this.findPhotoManagerSimilarGroups?.();
            this._photoManagerSimilarGroups = Array.isArray(groups) ? groups : [];
            this._photoManagerSimilarDeleteChoices = {};
            if (!this._photoManagerSimilarGroups.length) return this.showPhotoManagerNotice('似ている画像は見つかりませんでした。');
            this.renderPhotoManagerSimilarReview();
        }

        setPhotoManagerSimilarDeleteChoice(itemId = '', shouldDelete = false) {
            if (!this._photoManagerSimilarDeleteChoices) this._photoManagerSimilarDeleteChoices = {};
            this._photoManagerSimilarDeleteChoices[itemId] = !!shouldDelete;
            this.renderPhotoManagerSimilarReview();
        }

        getPhotoManagerSimilarDeleteTargets() {
            const groups = this._photoManagerSimilarGroups || [];
            const choices = this._photoManagerSimilarDeleteChoices || {};
            const targets = [];
            groups.forEach(group => (group.items || []).forEach(item => {
                if (choices[item.id] && item.source === 'library') targets.push(item);
            }));
            return targets;
        }

        renderPhotoManagerSimilarReview() {
            const groups = this._photoManagerSimilarGroups || [];
            const targets = this.getPhotoManagerSimilarDeleteTargets();
            const body = `
                <div class="photo-manager-review-summary warning">
                    <b>${groups.length}組</b>
                    <span>似ている画像候補です。削除対象 ${targets.length}件</span>
                </div>
                <div class="photo-manager-review-list">
                    ${groups.map(group => `
                        <article class="photo-manager-review-item">
                            ${(group.items || []).map(item => {
                                const checked = !!this._photoManagerSimilarDeleteChoices?.[item.id];
                                return `<div class="photo-manager-similar-item">
                                    <img src="${this.escapeHtml(item.src)}" alt="">
                                    <b>${this.escapeHtml(this.getPhotoManagerName(item) || item.defaultName || '画像')}</b>
                                    <small>${this.escapeHtml(this.getPhotoManagerSourceLabel(item))}</small>
                                    ${item.source === 'library' ? `<button type="button" class="photo-manager-similar-delete ${checked ? 'active' : ''}" onclick="app.setPhotoManagerSimilarDeleteChoice('${this.escapeJs(item.id)}', ${checked ? 'false' : 'true'})"><i class="fa-solid ${checked ? 'fa-trash-can' : 'fa-box-archive'}"></i> ${checked ? '削除する' : '残す'}</button>` : ''}
                                </div>`;
                            }).join('')}
                        </article>`).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                    <button type="button" class="danger-btn" ${targets.length ? '' : 'disabled'} onclick="app.executePhotoManagerSimilarCleanup()">選択画像を削除 ${targets.length ? `(${targets.length})` : ''}</button>
                </div>`;
            this.openPhotoManagerReviewDialog('似ている画像の確認', body);
        }

        executePhotoManagerSimilarCleanup() {
            const targets = this.getPhotoManagerSimilarDeleteTargets();
            if (!targets.length) return this.showPhotoManagerNotice('削除する画像を選択してください。');
            if (!confirm(`${targets.length}件の画像を削除します。よろしいですか？`)) return;
            const names = this.ensurePhotoManagerData();
            const overlays = this.getPhotoManagerOverlays();
            targets.sort((a, b) => (b.deleteIndex || 0) - (a.deleteIndex || 0)).forEach(item => {
                this.movePhotoManagerItemToTrash(item, 'similar');
                item.deletePhoto?.();
                delete names[item.id];
                delete overlays[item.id];
                this.ensurePhotoManagerSelectionStore().delete(item.id);
                this.removePhotoManagerSourceFromRecentCachesIfUnused(item.src);
            });
            store.save();
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`${targets.length}件の画像を削除しました。`);
        }

        openPhotoManagerDeleteReview(kind = 'unused', items = []) {
            if (!items.length) return this.showPhotoManagerNotice('削除対象がありません。');
            const body = `
                <div class="photo-manager-review-summary danger">
                    <b>${items.length}件</b>
                    <span>削除前に対象を確認してください。</span>
                </div>
                <div class="photo-manager-review-list">
                    ${items.map(item => `
                        <article class="photo-manager-delete-review-card">
                            <img src="${this.escapeHtml(item.src)}" alt="">
                            <div><b>${this.escapeHtml(this.getPhotoManagerName(item) || item.defaultName || item.title || '画像')}</b><small>${this.escapeHtml(this.getPhotoManagerSourceLabel(item))}</small></div>
                        </article>`).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">閉じる</button>
                    <button type="button" class="danger-btn" onclick="app.executeDeleteUnusedPhotoManagerLibraryItems()"><i class="fa-solid fa-trash"></i> 削除する</button>
                </div>`;
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
            if (typeof this._photoManagerNormalCompressionChoiceResolve === 'function') {
                const resolver = this._photoManagerNormalCompressionChoiceResolve;
                this._photoManagerNormalCompressionChoiceResolve = null;
                resolver('original');
            }
            document.getElementById('photo-manager-review-overlay')?.remove();
        }

        deleteSelectedPhotoManagerItems() {
            const ids = this.getSelectedPhotoManagerIds();
            if (!ids.length) return alert('削除する写真を選択してください。');
            if (!confirm(`${ids.length}枚の写真を削除します。よろしいですか？`)) return;
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
                this.removePhotoManagerSourceFromRecentCachesIfUnused(item.src);
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
            this.removePhotoManagerSourceFromRecentCachesIfUnused(item.src);
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
                img.onerror = () => reject(new Error('画像を読み込めませんでした。'));
                img.src = src;
            });
        }

        async createCompressedPhotoManagerSource(src = '') {
            if (!/^data:image\//i.test(src || '')) throw new Error('画像データではありません。');
            const img = await this.loadPhotoManagerImage(src);
            const naturalW = img.naturalWidth || img.width || 1;
            const naturalH = img.naturalHeight || img.height || 1;
            const maxSide = 2560;
            const scale = Math.min(1, maxSide / Math.max(naturalW, naturalH));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(naturalW * scale));
            canvas.height = Math.max(1, Math.round(naturalH * scale));
            const ctx = canvas.getContext('2d', { alpha: true });
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const transparent = await this.imageHasTransparentPixels(src);
            const compressedSrc = canvas.toDataURL('image/webp', transparent ? 0.9 : 0.86);
            const beforeBytes = this.estimatePhotoManagerImageBytes(src);
            const afterBytes = this.estimatePhotoManagerImageBytes(compressedSrc);
            return {
                src: compressedSrc,
                beforeBytes,
                afterBytes,
                savedBytes: Math.max(0, beforeBytes - afterBytes),
                transparent,
                width: canvas.width,
                height: canvas.height,
                changed: afterBytes > 0 && afterBytes < beforeBytes * 0.98
            };
        }

        replacePhotoManagerSourceReferences(oldSrc = '', nextSrc = '') {
            if (!oldSrc || !nextSrc || oldSrc === nextSrc) return 0;
            const items = this.collectPhotoManagerItems();
            const linkedItems = items.filter(candidate =>
                candidate?.src === oldSrc && typeof candidate.replacePhoto === 'function'
            );
            linkedItems.forEach(candidate => candidate.replacePhoto(nextSrc));
            let stampReferences = 0;
            items.forEach(candidate => {
                [...(candidate.marks || []), ...(candidate.globalMarks || []), ...(candidate.managerMarks || [])].forEach(mark => {
                    if (mark?.mode !== 'image') return;
                    if (mark.imageSrc === oldSrc) {
                        mark.imageSrc = nextSrc;
                        stampReferences += 1;
                    }
                    if (mark.originalImageSrc === oldSrc) mark.originalImageSrc = nextSrc;
                });
            });
            return linkedItems.length + stampReferences;
        }

        migratePhotoManagerItemMetadataAfterSourceChange(item, nextSrc = '') {
            const oldSrc = item?.src || '';
            if (!oldSrc || !nextSrc || oldSrc === nextSrc) return;
            this.ensurePhotoManagerData();
            const oldHash = this.hashPhotoManagerSrc(oldSrc);
            const nextHash = this.hashPhotoManagerSrc(nextSrc);
            const oldId = item.id || '';
            const nextId = oldId.endsWith(`|${oldHash}`) ? `${oldId.slice(0, -(oldHash.length))}${nextHash}` : oldId;
            ['photoManagerNames', 'photoManagerOverlays', 'photoManagerTags', 'photoManagerReadings', 'photoManagerEditedAt'].forEach(key => {
                const records = store.activeData[key];
                if (!records || !Object.prototype.hasOwnProperty.call(records, oldId) || nextId === oldId) return;
                records[nextId] = records[oldId];
                delete records[oldId];
            });
            const oldKey = this.getPhotoManagerSourceKey(oldSrc);
            const nextKey = this.getPhotoManagerSourceKey(nextSrc);
            if (store.activeData.photoManagerProtectedSources[oldKey]) {
                store.activeData.photoManagerProtectedSources[nextKey] = store.activeData.photoManagerProtectedSources[oldKey];
            }
            if (store.activeData.photoManagerTransparentSources[oldKey]) {
                store.activeData.photoManagerTransparentSources[nextKey] = store.activeData.photoManagerTransparentSources[oldKey];
            }
            // The same data URL can be shared by the photo library and notebook pages.
            // Keep every exact reference linked when compression replaces that source.
            const replacedCount = this.replacePhotoManagerSourceReferences(oldSrc, nextSrc);
            if (!replacedCount) item.replacePhoto?.(nextSrc);
            if (this._imageSourceTransparencyCache) this._imageSourceTransparencyCache.set(nextSrc, !!this._imageSourceTransparencyCache.get(oldSrc));
            this.removePhotoManagerSourceFromRecentCachesIfUnused(oldSrc);
        }

        async compressPhotoManagerImage(id = '') {
            const item = this.findPhotoManagerItem(id);
            if (!item?.src || typeof item.replacePhoto !== 'function') return this.showPhotoManagerNotice('圧縮できる写真が見つかりませんでした。');
            try {
                const transparent = this.isKnownPhotoManagerTransparentSource(item.src)
                    || (typeof this.imageHasTransparentPixels === 'function' && await this.imageHasTransparentPixels(item.src));
                if (transparent && !confirm('この画像は透過画像です。圧縮すると透明部分の品質が変わる場合があります。続けますか？')) {
                    return this.showPhotoManagerNotice('透過画像の圧縮をキャンセルしました。');
                }
                const result = await this.createCompressedPhotoManagerSource(item.src);
                if (!result.changed) return this.showPhotoManagerNotice('圧縮しても小さくならないため、変更しませんでした。');
                this.openPhotoManagerCompressionPreview(item, result);
            } catch (error) {
                console.error(error);
                this.showPhotoManagerNotice(error?.message || '画像の圧縮に失敗しました。');
            }
        }

        openPhotoManagerCompressionPreview(item, result) {
            const before = this.formatPhotoManagerBytes(result.beforeBytes);
            const after = this.formatPhotoManagerBytes(result.afterBytes);
            const reduction = Math.round((1 - result.afterBytes / result.beforeBytes) * 100);
            const name = this.getPhotoManagerName(item) || item.defaultName || item.title || '画像';
            this._photoManagerCompressionPreview = { item, result, before, after };
            const body = `
                <div class="photo-manager-compression-summary">
                    <b>${this.escapeHtml(name)}</b>
                    <span>${before} → ${after}（${reduction}%削減）</span>
                </div>
                <div class="photo-manager-compression-compare">
                    <figure>
                        <figcaption><b>元画像</b><span>${before}</span></figcaption>
                        <div class="photo-manager-compression-stage"><img src="${item.src}" alt="元画像"></div>
                    </figure>
                    <figure>
                        <figcaption><b>圧縮後</b><span>${after} / ${result.width}×${result.height}px</span></figcaption>
                        <div class="photo-manager-compression-stage"><img src="${result.src}" alt="圧縮後"></div>
                    </figure>
                </div>
                <div class="photo-manager-review-actions">
                    <span class="photo-manager-compression-note"><i class="fa-solid fa-circle-info"></i> OK後に元画像を圧縮後の画像へ置き換えます。</span>
                    <button type="button" class="secondary-btn" onclick="app.cancelPhotoManagerCompressionPreview()">元画像を残す</button>
                    <button type="button" class="danger-btn" onclick="app.applyPhotoManagerCompressionPreview()"><i class="fa-solid fa-trash-can"></i> 圧縮後に置き換える</button>
                </div>`;
            this.openPhotoManagerReviewDialog('画像圧縮プレビュー', body);
        }

        cancelPhotoManagerCompressionPreview() {
            this._photoManagerCompressionPreview = null;
            this.closePhotoManagerReviewDialog();
        }

        applyPhotoManagerCompressionPreview() {
            const pending = this._photoManagerCompressionPreview;
            if (!pending?.item || !pending?.result?.src) return this.closePhotoManagerReviewDialog();
            if (!confirm('元画像を圧縮後の画像に置き換えます。よろしいですか？')) return;
            this.migratePhotoManagerItemMetadataAfterSourceChange(pending.item, pending.result.src);
            this.rememberPhotoManagerCompressedSource(pending.result.src, true);
            if (pending.result.transparent) this.rememberPhotoManagerTransparentSource(pending.result.src, true);
            store.save();
            this._photoManagerCompressionPreview = null;
            this.closePhotoManagerReviewDialog();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`画像を圧縮しました。${pending.before} → ${pending.after}`);
        }

        async compressSelectedPhotoManagerImages() {
            const ids = this.getSelectedPhotoManagerIds();
            if (!ids.length) return this.showPhotoManagerNotice('圧縮する写真を選択してください。');
            const items = this.collectPhotoManagerItems().filter(item => ids.includes(item.id) && typeof item.replacePhoto === 'function');
            const prepared = [];
            let skipped = 0;
            for (const item of items) {
                try {
                    const result = await this.createCompressedPhotoManagerSource(item.src);
                    if (result.changed) prepared.push({ item, result });
                    else skipped += 1;
                } catch (error) {
                    console.error(error);
                    skipped += 1;
                }
            }
            if (!prepared.length) return this.showPhotoManagerNotice('圧縮できる画像はありませんでした。');
            const beforeBytes = prepared.reduce((sum, entry) => sum + entry.result.beforeBytes, 0);
            const afterBytes = prepared.reduce((sum, entry) => sum + entry.result.afterBytes, 0);
            if (!confirm(`${prepared.length}枚の画像を圧縮後の画像へ置き換えます。\n${this.formatPhotoManagerBytes(beforeBytes)} → ${this.formatPhotoManagerBytes(afterBytes)}${skipped ? `\n${skipped}枚は対象外です。` : ''}`)) return;
            prepared.forEach(({ item, result }) => {
                this.migratePhotoManagerItemMetadataAfterSourceChange(item, result.src);
                this.rememberPhotoManagerCompressedSource(result.src, true);
                if (result.transparent) this.rememberPhotoManagerTransparentSource(result.src, true);
            });
            store.save();
            this.clearVisiblePhotoManagerSelection();
            this.renderPhotoManager();
            this.showPhotoManagerNotice(`${prepared.length}枚を圧縮しました。${this.formatPhotoManagerBytes(beforeBytes - afterBytes)}削減しました。`);
        }
        async createTransparentPhotoManagerSource(src = '', options = {}) {
            if (!/^data:image\//i.test(src || '')) throw new Error('画像データではありません。');
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
            const pngSrc = canvas.toDataURL('image/png');
            const compress = options.compress !== false;
            const quality = Math.max(0.75, Math.min(0.98, Number(options.quality) || 0.9));
            const webpSrc = compress ? canvas.toDataURL('image/webp', quality) : '';
            const pngBytes = this.estimatePhotoManagerImageBytes(pngSrc);
            const webpBytes = /^data:image\/webp;/i.test(webpSrc) ? this.estimatePhotoManagerImageBytes(webpSrc) : 0;
            const useCompressed = compress && webpBytes > 0 && webpBytes < pngBytes;
            return {
                src: useCompressed ? webpSrc : pngSrc,
                changed: result.changed,
                total: canvas.width * canvas.height,
                compressed: useCompressed,
                beforeBytes: pngBytes,
                afterBytes: useCompressed ? webpBytes : pngBytes,
                savedBytes: useCompressed ? Math.max(0, pngBytes - webpBytes) : 0
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
                    this.showPhotoManagerNotice('透過できる背景部分が見つかりませんでした。');
                    return;
                }
                const baseName = this.getPhotoManagerName(item) || item.defaultName || item.title || '画像';
                const added = this.addPhotoManagerLibraryImage(result.src, `${baseName} 透過`);
                if (!added) return;
                if (!this._imageSourceTransparencyCache) this._imageSourceTransparencyCache = new Map();
                this._imageSourceTransparencyCache.set(result.src, true);
                this.rememberPhotoManagerTransparentSource(result.src, true);
                if (result.compressed) this.rememberPhotoManagerCompressedSource(result.src, true);
                const deleteOriginal = confirm('透過画像を登録しました。元画像を削除しますか？');
                if (deleteOriginal) {
                    item.deletePhoto?.();
                    delete this.ensurePhotoManagerData()[item.id];
                    delete this.getPhotoManagerOverlays()[item.id];
                    this.ensurePhotoManagerSelectionStore().delete(item.id);
                    this.removePhotoManagerSourceFromRecentCachesIfUnused(item.src);
                }
                store.save();
                const sourceSelect = document.getElementById('photo-manager-source');
                if (sourceSelect && sourceSelect.value !== 'library') sourceSelect.value = 'library';
                this.renderPhotoManager();
                this.showPhotoManagerNotice(deleteOriginal ? '透過画像を登録し、元画像を削除しました。' : '透過画像を写真管理へ登録しました。');
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
            const deleteOriginals = confirm('作成後に元画像を削除しますか？');
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
                        this.rememberPhotoManagerTransparentSource(result.src, true);
                        if (result.compressed) this.rememberPhotoManagerCompressedSource(result.src, true);
                        if (deleteOriginals) {
                            item.deletePhoto?.();
                            delete this.ensurePhotoManagerData()[item.id];
                            delete this.getPhotoManagerOverlays()[item.id];
                            this.ensurePhotoManagerSelectionStore().delete(item.id);
                            this.removePhotoManagerSourceFromRecentCachesIfUnused(item.src);
                        }
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
                ? `透過画像を${created}枚登録しました。${skipped ? `${skipped}枚は対象外でした。` : ''}`
                : '透過画像を作成できる写真がありませんでした。');
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
                if (input.dataset.shiftPhotoWallpaperPicker === '1'
                    && this.prepareShiftPhotoCompareWallpaperPicker?.(input) === false) {
                    event.preventDefault();
                    event.stopPropagation();
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

        getPhotoManagerRomanSearchAliases(text = '') {
            const source = String(text || '');
            const aliases = [
                ['顔', 'kao face'], ['人物', 'jinbutsu person'], ['人', 'hito person'],
                ['猫', 'neko cat'], ['犬', 'inu dog'], ['熊', 'kuma bear'],
                ['男', 'otoko man'], ['女', 'onna woman'], ['子供', 'kodomo child'],
                ['目', 'me eye'], ['口', 'kuchi mouth'], ['頭', 'atama head'],
                ['手', 'te hand'], ['足', 'ashi foot'], ['体', 'karada body'],
                ['吹き出し', 'fukidashi speech bubble'], ['文字', 'moji text'],
                ['矢印', 'yajirushi arrow'], ['丸', 'maru circle'], ['円', 'en circle'],
                ['注意', 'chuui caution'], ['危険', 'kiken danger'], ['確認', 'kakunin check'],
                ['完了', 'kanryou kanryo complete'], ['作業', 'sagyou sagyo work'],
                ['部品', 'buhin parts'], ['機械', 'kikai machine'], ['工具', 'kougu kogu tool'],
                ['車', 'kuruma car'], ['写真', 'shashin photo'], ['画像', 'gazou gazo image'],
                ['透明', 'toumei tomei transparent'], ['透過', 'touka toka transparent']
            ];
            return aliases.filter(([label]) => source.includes(label)).map(([, alias]) => alias).join(' ');
        }

        getPhotoManagerImageSearchText(item = {}) {
            return `${item.title || ''} ${item.displayName || ''} ${item.defaultName || ''} ${item.caption || ''} ${(item.tags || []).join(' ')} ${this.getPhotoManagerReading(item)} ${item.sourceLabel || ''} ${item.date || ''}`;
        }

        getImageSourceChoiceMatchReasons(item = {}, query = '') {
            const terms = this.getSearchTerms(String(query || '').trim());
            if (!terms.length) return [];
            const reasons = [];
            const titleText = `${item.title || ''} ${item.displayName || ''} ${item.defaultName || ''} ${item.caption || ''}`;
            const tagText = (item.tags || []).join(' ');
            const fullText = this.getPhotoManagerImageSearchText(item);
            const readingText = `${this.getPhotoManagerReading(item)} ${this._photoManagerReadingAliasCache?.get?.(fullText) || ''} ${this.getPhotoManagerRomanSearchAliases(fullText)}`;
            if (this.matchesSearchTerms(titleText, terms)) reasons.push('題名・説明');
            if (this.matchesSearchTerms(tagText, terms)) reasons.push('タグ');
            if (this.matchesSearchTerms(readingText, terms)) reasons.push('読み');
            return reasons;
        }
        getPhotoManagerSearchUsageCounts(items = []) {
            const counts = new Map();
            const add = src => { if (src) counts.set(src, (counts.get(src) || 0) + 1); };
            (items || []).forEach(item => {
                if (item.source !== 'library') add(item.src);
                [...(item.marks || []), ...(item.globalMarks || []), ...(item.managerMarks || [])].forEach(mark => {
                    if (mark?.mode !== 'image') return;
                    add(mark.imageSrc);
                    if (mark.originalImageSrc !== mark.imageSrc) add(mark.originalImageSrc);
                });
            });
            return counts;
        }

        ensurePhotoManagerJapaneseReadingEngine() {
            if (this._photoManagerJapaneseReadingEnginePromise) return this._photoManagerJapaneseReadingEnginePromise;
            const KuroshiroClass = window.Kuroshiro?.default || window.Kuroshiro;
            const AnalyzerClass = window.KuromojiAnalyzer?.default || window.KuromojiAnalyzer;
            if (typeof KuroshiroClass !== 'function' || typeof AnalyzerClass !== 'function') {
                return Promise.resolve(null);
            }
            this._photoManagerJapaneseReadingEnginePromise = (async () => {
                try {
                    const engine = new KuroshiroClass();
                    await engine.init(new AnalyzerClass({
                        dictPath: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/'
                    }));
                    return engine;
                } catch (error) {
                    console.warn('Japanese reading search is unavailable.', error);
                    return null;
                }
            })();
            return this._photoManagerJapaneseReadingEnginePromise;
        }

        async preparePhotoManagerReadingSearchAliases() {
            if (this._photoManagerReadingAliasPending) return this._photoManagerReadingAliasPending;
            if (!this._photoManagerReadingAliasCache) this._photoManagerReadingAliasCache = new Map();
            const entries = this.collectPhotoManagerItems()
                .map(item => this.getPhotoManagerImageSearchText(item))
                .filter((text, index, all) => text && all.indexOf(text) === index && !this._photoManagerReadingAliasCache.has(text));
            if (!entries.length) return;
            this._photoManagerReadingAliasPending = (async () => {
                const engine = await this.ensurePhotoManagerJapaneseReadingEngine();
                if (!engine) return;
                for (const text of entries) {
                    try {
                        const reading = await engine.convert(text, { to: 'romaji', mode: 'spaced' });
                        this._photoManagerReadingAliasCache.set(text, String(reading || '').toLowerCase());
                    } catch (_) {
                        this._photoManagerReadingAliasCache.set(text, '');
                    }
                }
            })().finally(() => {
                this._photoManagerReadingAliasPending = null;
                const query = document.getElementById('image-source-choice-query');
                if (query && document.getElementById('image-source-choice-overlay')) {
                    this.renderImageSourceChoiceList(query.value || '');
                }
            });
            return this._photoManagerReadingAliasPending;
        }

        getImageSourceChoiceItems(query = '') {
            const terms = this.getSearchTerms(String(query || '').trim());
            const recent = this.getImageSourceChoiceRecentSrcRank();
            const allItems = this.collectPhotoManagerItems().filter(item => !item.referenceOnly);
            const usageCounts = this.getPhotoManagerSearchUsageCounts(allItems);
            return allItems.filter(item => {
                if (!terms.length) return true;
                const text = this.getPhotoManagerImageSearchText(item);
                const reading = this._photoManagerReadingAliasCache?.get?.(text) || '';
                return this.matchesSearchTerms(`${text} ${reading} ${this.getPhotoManagerRomanSearchAliases(text)}`, terms);
            }).filter(item => {
                if (!this._imageSourceTransparentOnly) return true;
                const cached = this._imageSourceTransparencyCache?.get?.(item.src);
                return cached === true || (cached === undefined && this.canImageSourceHaveAlpha(item.src));
            }).sort((a, b) => {
                const usageDiff = (usageCounts.get(b.src) || 0) - (usageCounts.get(a.src) || 0);
                if (usageDiff) return usageDiff;
                const ar = recent.get(a.src) ?? 9999;
                const br = recent.get(b.src) ?? 9999;
                const dateScore = item => {
                    if (item.editedAt) return Number(item.editedAt) || 0;
                    if (item.createdAt) return Number(item.createdAt) || 0;
                    const date = Date.parse(item.date || '');
                    if (Number.isFinite(date)) return date;
                    return 0;
                };
                return dateScore(b) - dateScore(a)
                    || ar - br
                    || (b.date || '').localeCompare(a.date || '')
                    || (a.sourceLabel || '').localeCompare(b.sourceLabel || '', 'ja');
            }).slice(0, 120);
        }

        openImageSourceChoice(input) {
            if (!input) return;
            this.ensurePhotoManagerData();
            this._imageSourceChoiceMultiple = !!input.multiple;
            const multiple = !!input.multiple;
            document.getElementById('image-source-choice-overlay')?.remove();
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
                        <button type="button" class="image-source-choice-filter clipboard" onclick="app.importImageSourceChoiceFromClipboard()" title="クリップボード内の画像を写真管理へ登録して選択します"><i class="fa-solid fa-clipboard"></i> クリップボードから取込</button>
                        <button type="button" class="image-source-choice-filter" id="image-source-choice-transparent-filter" onclick="app.toggleImageSourceTransparentFilter()" title="透過画像だけ表示"><i class="fa-solid fa-layer-group"></i> 透過のみ</button>
                        <div class="image-source-choice-bg-switch" role="group" aria-label="背景確認">
                            <span>背景確認</span>
                            <button type="button" data-bg-mode="checker" onclick="app.setImageSourceChoiceBackgroundMode('checker')" title="格子で確認">格子</button>
                            <button type="button" data-bg-mode="white" onclick="app.setImageSourceChoiceBackgroundMode('white')" title="白背景で確認">白</button>
                            <button type="button" data-bg-mode="black" onclick="app.setImageSourceChoiceBackgroundMode('black')" title="黒背景で確認">黒</button>
                        </div>
                        <label class="image-source-choice-search">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <input type="search" id="image-source-choice-query" placeholder="検索フレーズを入力（ローマ字でも反応）" oninput="app.renderImageSourceChoiceList(this.value)">
                        </label>
                    </div>
                    <div class="image-source-choice-main">
                        <div class="image-source-choice-list" id="image-source-choice-list"></div>
                        <aside class="image-source-choice-preview" id="image-source-choice-preview">
                            <div class="image-source-choice-preview-stage">
                                <i class="fa-regular fa-image"></i>
                            </div>
                            <b>プレビュー</b>
                            <span>画像を選ぶと大きく確認できます</span>
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
            this.applyImageSourceChoiceBackgroundMode();
            this.renderImageSourceChoiceList('');
            setTimeout(() => document.getElementById('image-source-choice-query')?.focus(), 0);
        }
        closeImageSourceChoice() {
            document.getElementById('image-source-choice-overlay')?.remove();
            if (this._imageSourceChoiceInput?._shiftPhotoSearchInsertAt) {
                delete this._imageSourceChoiceInput._shiftPhotoSearchInsertAt;
            }
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
                const saveResults = [];
                for (const file of selectedFiles) {
                    const originalSrc = await this.readPhotoManagerFileAsDataUrl(file);
                    const prepared = await this.preparePhotoManagerNormalSaveSource(originalSrc, file.name || '直接ファイル画像', { forceAsk: true });
                    const src = prepared.src || originalSrc;
                    const added = this.addPhotoManagerLibraryImage(src, file.name || '直接ファイル画像');
                    if (added) {
                        saveResults.push(prepared);
                        if (prepared.compressed) this.rememberPhotoManagerCompressedSource(src, true);
                        if (prepared.transparent) this.rememberPhotoManagerTransparentSource(src, true);
                        else await this.detectAndRememberPhotoManagerTransparency(src, false);
                        imported.push(added);
                    }
                }
                if (!imported.length) return;
                this._imageSourceInitialImportIds = new Set(imported.map(item => item.id));
                const summary = this.summarizePhotoManagerNormalSaveResults(saveResults);
                if (summary) this.showPhotoManagerNotice(`${imported.length}枚の画像を登録しました。${summary}`);
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
                this.showPhotoManagerNotice(`${imported.length}枚を選択候補に追加しました。`);
            } catch (error) {
                console.error(error);
                this.showPhotoManagerNotice('直接ファイル画像の取り込みに失敗しました。');
            }
        }

        async importImageSourceChoiceFromClipboard() {
            if (!navigator.clipboard?.read) {
                this.showPhotoManagerNotice('この画面ではCtrl+Vでも画像を取り込めます。');
                return;
            }
            try {
                const items = await navigator.clipboard.read();
                const imported = [];
                const saveResults = [];
                for (const item of items) {
                    const type = item.types?.find(value => /^image\//i.test(value));
                    if (!type) continue;
                    const blob = await item.getType(type);
                    const originalSrc = await this.readPhotoManagerFileAsDataUrl(blob);
                    const prepared = await this.preparePhotoManagerNormalSaveSource(originalSrc, 'クリップボード画像', { forceAsk: true });
                    const src = prepared.src || originalSrc;
                    const added = this.addPhotoManagerLibraryImage(src, 'クリップボード画像');
                    if (added) {
                        saveResults.push(prepared);
                        if (prepared.compressed) this.rememberPhotoManagerCompressedSource(src, true);
                        if (prepared.transparent) this.rememberPhotoManagerTransparentSource(src, true);
                        else await this.detectAndRememberPhotoManagerTransparency(src, false);
                        imported.push(added);
                    }
                }
                if (!imported.length) {
                    this.showPhotoManagerNotice('クリップボード内に取り込める画像がありませんでした。');
                    return;
                }
                this._imageSourceInitialImportIds = new Set(imported.map(item => item.id));
                const summary = this.summarizePhotoManagerNormalSaveResults(saveResults);
                if (summary) this.showPhotoManagerNotice(`${imported.length}枚の画像を登録しました。${summary}`);
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
                    this.openImageSourceChoiceTransparencyPreview(imported[0].id);
                });
                this.showPhotoManagerNotice(`${imported.length}枚を選択候補に追加しました。`);
            } catch (error) {
                console.error(error);
                this.showPhotoManagerNotice('クリップボード画像の取り込みに失敗しました。Ctrl+Vも試してください。');
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

        getImageSourceChoiceBackgroundMode() {
            try {
                const saved = localStorage.getItem('image_source_choice_background_mode');
                if (['checker', 'white', 'black'].includes(saved)) return saved;
            } catch {}
            return 'checker';
        }

        setImageSourceChoiceBackgroundMode(mode = 'checker') {
            const next = ['checker', 'white', 'black'].includes(mode) ? mode : 'checker';
            try { localStorage.setItem('image_source_choice_background_mode', next); } catch {}
            this.applyImageSourceChoiceBackgroundMode(next);
        }

        applyImageSourceChoiceBackgroundMode(mode = this.getImageSourceChoiceBackgroundMode()) {
            const next = ['checker', 'white', 'black'].includes(mode) ? mode : 'checker';
            const overlay = document.getElementById('image-source-choice-overlay');
            if (overlay) overlay.dataset.bgMode = next;
            document.querySelectorAll('.image-source-choice-bg-switch button').forEach(button => {
                button.classList.toggle('active', button.dataset.bgMode === next);
            });
        }

        renderImageSourceChoiceList(query = '') {
            const list = document.getElementById('image-source-choice-list');
            if (!list) return;
            const input = this._imageSourceChoiceInput;
            const multiple = !!input?.multiple;
            const items = this.getImageSourceChoiceItems(query);
            const usageCounts = this.getPhotoManagerSearchUsageCounts(this.collectPhotoManagerItems());
            const summary = null;
            if (!items.length) {
                list.innerHTML = '<div class="image-source-choice-empty">写真管理に該当する画像がありません</div>';
                return;
            }
            list.innerHTML = items.map(item => {
                const title = this.getPhotoManagerName(item) || item.defaultName || item.title || '画像';
                const sub = [item.sourceLabel, item.date, item.title].filter(Boolean).join(' / ');
                const canHaveAlpha = this.canImageSourceHaveAlpha(item.src);
                const matchReasons = this.getImageSourceChoiceMatchReasons(item, query);
                const usageCount = usageCounts.get(item.src) || 0;
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
                            <span class="image-source-choice-match-info">
                                ${matchReasons.map(reason => `<em><i class="fa-solid fa-magnifying-glass"></i> ${this.escapeHtml(reason)}一致</em>`).join('')}
                                ${usageCount ? `<em class="popular"><i class="fa-solid fa-stamp"></i> ${usageCount}回使用</em>` : ''}
                            </span>
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
                card.addEventListener('click', event => {
                    if (event.target?.closest?.('.image-source-choice-alpha-badge')) return;
                    const choice = card.querySelector('input[name="image-source-choice-item"]');
                    if (!choice) return;
                    if (event.target === choice) {
                        queueMicrotask(() => {
                            this.updateImageSourceChoicePreview(item);
                            if (choice.type === 'radio' && typeof this._imageSourceChoiceInput?._shiftPhotoSearchInsertAt === 'function') {
                                this.applySelectedImageSourceChoice();
                            }
                        });
                        return;
                    }
                    event.preventDefault();
                    choice.checked = choice.type === 'checkbox' ? !choice.checked : true;
                    choice.dispatchEvent(new Event('change', { bubbles: true }));
                    this.updateImageSourceChoicePreview(item);
                    if (choice.type === 'radio' && typeof this._imageSourceChoiceInput?._shiftPhotoSearchInsertAt === 'function') {
                        this.applySelectedImageSourceChoice();
                        return;
                    }
                });
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
                    <span>画像を選ぶと大きく確認できます</span>
                `;
                return;
            }
            const title = this.getPhotoManagerName(item) || item.defaultName || item.title || '画像';
            const sub = [item.sourceLabel, item.date, item.title].filter(Boolean).join(' / ');
            const canHaveAlpha = this.canImageSourceHaveAlpha(item.src);
            preview.innerHTML = `
                <div class="image-source-choice-preview-stage">
                    <img src="${item.src}" alt="${this.escapeHtml(title)}">
                    ${canHaveAlpha ? `<button type="button" onclick="event.preventDefault(); event.stopPropagation(); app.openImageSourceChoiceTransparencyPreview('${this.escapeJs(item.id)}')"><i class="fa-solid fa-layer-group"></i> 透過チェック</button>` : ''}
                </div>
                <b>${this.escapeHtml(title)}</b>
                <span>${this.escapeHtml(sub || '写真管理')}</span>
            `;
        }

        async openImageSourceChoiceTransparencyPreview(id = '') {
            const item = this.collectPhotoManagerItems().find(entry => entry.id === id);
            if (!item?.src) return this.showPhotoManagerNotice('透過確認する画像が見つかりませんでした。');
            if (typeof this.openShiftPhotoCompareBaseImageTransparencyPreview !== 'function'
                || typeof this.createTransparentPhotoManagerSource !== 'function') {
                return this.showPhotoManagerNotice('透過確認画面を開けませんでした。');
            }
            try {
                const alreadyTransparent = typeof this.imageHasTransparentPixels === 'function'
                    ? await this.imageHasTransparentPixels(item.src)
                    : false;
                if (alreadyTransparent) {
                    let compressedResult = null;
                    if (typeof this.createCompressedPhotoManagerSource === 'function') {
                        try {
                            const candidate = await this.createCompressedPhotoManagerSource(item.src);
                            if (candidate.changed) compressedResult = candidate;
                        } catch (error) {
                            console.warn('Transparent image compression was skipped.', error);
                        }
                    }
                    this.openShiftPhotoCompareBaseImageTransparencyPreview(item.src, compressedResult?.src || item.src, {
                        name: this.getPhotoManagerName(item) || item.defaultName || item.title || '画像',
                        changed: 0,
                        total: 0,
                        alreadyTransparent: true,
                        compressed: !!compressedResult,
                        sizePreset: item.sizePreset || null,
                        imageFit: item.imageFit === 'fill' ? 'fill' : '',
                        initialImportItemId: this._imageSourceInitialImportIds?.has(item.id) ? item.id : ''
                    });
                    return;
                }
                const result = await this.createTransparentPhotoManagerSource(item.src);
                this.openShiftPhotoCompareBaseImageTransparencyPreview(item.src, result.src || item.src, {
                    name: this.getPhotoManagerName(item) || item.defaultName || item.title || '画像',
                    changed: result.changed || 0,
                    total: result.total || 0,
                    compressed: !!result.compressed,
                    sizePreset: item.sizePreset || null,
                    imageFit: item.imageFit === 'fill' ? 'fill' : '',
                    initialImportItemId: result.changed && this._imageSourceInitialImportIds?.has(item.id) ? item.id : ''
                });
            } catch (error) {
                console.error(error);
                this.showPhotoManagerNotice('透過確認に失敗しました。');
            }
        }

        async reopenPhotoManagerTransparentImageForCutout(id = '') {
            const item = this.findPhotoManagerItem(id);
            if (!item?.src) return this.showPhotoManagerNotice('再透過する画像が見つかりませんでした。');
            if (typeof this.openShiftPhotoCompareBaseImageTransparencyPreview !== 'function') {
                return this.showPhotoManagerNotice('再透過画面を開けませんでした。');
            }
            try {
                this.openShiftPhotoCompareBaseImageTransparencyPreview(item.src, item.src, {
                    name: `${this.getPhotoManagerName(item) || item.defaultName || item.title || '画像'} 再透過`,
                    changed: 0,
                    total: 0,
                    alreadyTransparent: true,
                    sizePreset: item.sizePreset || null,
                    imageFit: item.imageFit === 'fill' ? 'fill' : '',
                    overwritePhotoManagerItemId: item.id,
                    compressOnSave: true
                });
                this.showPhotoManagerNotice('再透過画面を開きました。保存すると上書きできます。');
            } catch (error) {
                console.error(error);
                this.showPhotoManagerNotice('再透過画面を開けませんでした。');
            }
        }
        removePhotoManagerInitialImportOriginal(id = '', replacementSrc = '') {
            if (!id || !this._imageSourceInitialImportIds?.has(id)) return false;
            const item = this.findPhotoManagerItem(id);
            if (!item || !item.src || item.src === replacementSrc) return false;
            item.deletePhoto?.();
            delete this.ensurePhotoManagerData()[item.id];
            delete this.getPhotoManagerOverlays()[item.id];
            this.ensurePhotoManagerSelectionStore().delete(item.id);
            this._imageSourceInitialImportIds.delete(item.id);
            this.removePhotoManagerSourceFromRecentCachesIfUnused(item.src);
            return true;
        }

        refreshImageSourceChoiceAfterLibraryChange(preferredItem = null) {
            if (!document.getElementById('image-source-choice-overlay')) return;
            const query = document.getElementById('image-source-choice-query')?.value || '';
            this.renderImageSourceChoiceList(query);
            if (!preferredItem?.id) return;
            requestAnimationFrame(() => {
                const safeId = window.CSS?.escape
                    ? CSS.escape(preferredItem.id)
                    : String(preferredItem.id).replace(/"/g, '\\"');
                const choice = document.querySelector(`#image-source-choice-list .image-source-choice-item[data-image-choice-id="${safeId}"] input`);
                if (choice) choice.checked = true;
                this.updateImageSourceChoicePreview(preferredItem);
            });
        }

        canImageSourceHaveAlpha(src = '') {
            const match = String(src || '').match(/^data:image\/([^;,]+)[;,]/i);
            if (!match) return false;
            return !/^(?:jpe?g|pjpeg|bmp|x-ms-bmp)$/i.test(match[1]);
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
                        const maxSide = 512;
                        const naturalW = img.naturalWidth || img.width || 1;
                        const naturalH = img.naturalHeight || img.height || 1;
                        const scale = Math.min(1, maxSide / Math.max(naturalW, naturalH));
                        canvas.width = Math.max(1, Math.round(naturalW * scale));
                        canvas.height = Math.max(1, Math.round(naturalH * scale));
                        const ctx = canvas.getContext('2d', { willReadFrequently: true });
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                        for (let i = 3; i < data.length; i += 4) {
                            if (data[i] < 254) {
                                resolve(true);
                                return;
                            }
                        }
                        resolve(false);
                    } catch {
                        resolve(false);
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
                if (isTransparent && !this.isKnownPhotoManagerTransparentSource(item.src)) {
                    this.rememberPhotoManagerTransparentSource(item.src, true);
                    store.save();
                }
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
            if (id === 'machine-photo-input' && input._machinePhotoTargetId) {
                this.applyMachinePhotoFromSource?.(input._machinePhotoTargetId, selected[0].src);
                return;
            }
            if (id === 'part-photo-input' && input._partPhotoTargetId) {
                this.applyPartPhotoFromSource?.(input._partPhotoTargetId, selected[0].src);
                return;
            }
            if (id === 'guide-photo-input' && input._guidePhotoTargetId) {
                selected.forEach(item => this.addGuidePhotoFromSource?.(input._guidePhotoTargetId, item.src));
                this.autoSaveGuideDraftFromModal?.();
                this.renderGuidePhotoPreviews?.();
                return;
            }
            if (id === 's-photos' || id === 'e-photos') {
                const preview = document.getElementById(id === 's-photos' ? 's-photo-previews' : 'e-photo-previews');
                if (!Array.isArray(this._tempPhotos)) this._tempPhotos = [];
                selected.forEach(item => {
                    const photo = this.createHistoryPhotoReference?.(item) || item.src;
                    this._tempPhotos.push(photo);
                    if (typeof this.appendHistoryPhotoPreview === 'function') {
                        this.appendHistoryPhotoPreview(preview, photo, 80);
                    } else {
                        preview?.appendChild(this.createPhotoPreviewElement(item.src, () => {
                            this._tempPhotos = this._tempPhotos.filter(p => p !== photo);
                        }, null, 80));
                    }
                });
                this.updateSaveStatus?.('dirty');
                return;
            }
            if (id === 'photo-manager-import-input') {
                let count = 0;
                selected.forEach(item => {
                    if (this.addPhotoManagerLibraryImage(item.src, this.getPhotoManagerName(item) || item.defaultName || item.title || '写真管理画像')) count += 1;
                });
                this.finishPhotoManagerImport(count, `${count}件の画像を登録しました。`);
                return;
            }
            if (id === 'tips-photo-manager-input') {
                this.addTipsPhotoManagerAttachments?.(selected);
                return;
            }
            if (id === 'shift-photo-compare-image-stamp-input') {
                const src = selected[0].src;
                this._shiftPhotoCompareImageStampSrc = src;
                this._shiftPhotoComparePendingCircleImageEdit = selected[0].circleImageEdit && typeof selected[0].circleImageEdit === 'object'
                    ? { ...selected[0].circleImageEdit }
                    : null;
                const recentPreset = this.getShiftPhotoCompareRecentImageStamps?.().find?.(item => item.src === src)?.sizePreset || null;
                const sizePreset = selected[0].sizePreset || recentPreset;
                if (sizePreset && selected[0].imageFit === 'fill') sizePreset.imageFit = 'fill';
                if (sizePreset) this.applyShiftPhotoCompareRecentImageSizePreset?.({ src, sizePreset });
                this.rememberShiftPhotoCompareImageStamp?.(src, this.getPhotoManagerName(selected[0]) || selected[0].defaultName || selected[0].title || '写真管理');
                if (sizePreset || this._shiftPhotoComparePendingCircleImageEdit) {
                    const recent = this.getShiftPhotoCompareRecentImageStamps?.() || [];
                    const recentItem = recent.find(entry => entry.src === src);
                    if (recentItem) {
                        if (sizePreset) recentItem.sizePreset = sizePreset;
                        if (this._shiftPhotoComparePendingCircleImageEdit) recentItem.circleImageEdit = { ...this._shiftPhotoComparePendingCircleImageEdit };
                        this.saveShiftPhotoCompareRecentImageStamps?.(recent);
                    }
                }
                this.setShiftPhotoCompareMarkModeDirect?.('image');
                this.updateShiftPhotoCompareSample?.();
                if (typeof input._shiftPhotoSearchInsertAt === 'function') {
                    const insertAt = input._shiftPhotoSearchInsertAt;
                    delete input._shiftPhotoSearchInsertAt;
                    insertAt(selected[0]);
                    return;
                }
                this.showShiftPhotoCompareActionMessage?.('写真管理の画像を選択しました。キャンバス上でクリックして配置できます。');
                return;
            }
            if (input.classList?.contains('shift-photo-input') && typeof input._shiftPhotoAddSrc === 'function') {
                const useReference = !!input.closest?.('.shift-notebook-row');
                selected.forEach(item => {
                    const ref = useReference
                        ? (this.createPhotoManagerImageReference?.(item) || this.createHistoryPhotoReference?.(item))
                        : null;
                    input._shiftPhotoAddSrc(ref || item.src);
                });
            }
        }

        getPhotoManagerLibraryReferenceById(id = '') {
            const targetId = String(id || '');
            if (!targetId) return null;
            const library = this.getPhotoManagerLibrary?.() || [];
            for (let index = 0; index < library.length; index += 1) {
                const photo = library[index];
                if (!photo?.src) continue;
                const itemId = photo.id || this.buildPhotoManagerId(['library', index], photo.src);
                if (String(itemId) === targetId || (photo.id && String(photo.id) === targetId)) {
                    return { photo, index, itemId };
                }
            }
            return null;
        }

        getPhotoManagerLibraryReferenceBySrc(src = '') {
            const targetSrc = String(src || '');
            if (!targetSrc) return null;
            const library = this.getPhotoManagerLibrary?.() || [];
            for (let index = 0; index < library.length; index += 1) {
                const photo = library[index];
                if (!photo?.src || photo.src !== targetSrc) continue;
                const itemId = photo.id || this.buildPhotoManagerId(['library', index], photo.src);
                return { photo, index, itemId };
            }
            return null;
        }

        createPhotoManagerImageReference(item = {}) {
            if (!item?.id) return null;
            const linked = item.source === 'library'
                ? this.getPhotoManagerLibraryReferenceById(item.id)
                : (this.getPhotoManagerLibraryReferenceBySrc(item.src) || this.getPhotoManagerLibraryReferenceById(item.id));
            if (!linked?.itemId) return null;
            return {
                source: 'photoManager',
                id: linked.itemId,
                name: this.getPhotoManagerName?.(item) || item.defaultName || item.title || item.name || linked.photo?.name || ''
            };
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

        downloadPhotoManagerBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        getPhotoManagerExportZipFileName() {
            const now = new Date();
            const stamp = [
                now.getFullYear(),
                String(now.getMonth() + 1).padStart(2, '0'),
                String(now.getDate()).padStart(2, '0')
            ].join('');
            return `photo_manager_${stamp}.zip`;
        }

        getPhotoManagerUniqueExportFileName(name, used) {
            const clean = String(name || 'photo').replace(/[\\/:*?"<>|]/g, '_') || 'photo';
            const dot = clean.lastIndexOf('.');
            const base = dot > 0 ? clean.slice(0, dot) : clean;
            const ext = dot > 0 ? clean.slice(dot) : '';
            let candidate = clean;
            let count = 2;
            while (used.has(candidate.toLowerCase())) {
                candidate = `${base}_${count}${ext}`;
                count += 1;
            }
            used.add(candidate.toLowerCase());
            return candidate;
        }

        dataUrlToPhotoManagerBytes(src = '') {
            const text = String(src || '');
            const comma = text.indexOf(',');
            if (!text.startsWith('data:') || comma < 0) throw new Error('逕ｻ蜒上ョ繝ｼ繧ｿ繧定ｪｭ縺ｿ霎ｼ繧√∪縺帙ｓ縺ｧ縺励◆');
            const header = text.slice(0, comma);
            const body = text.slice(comma + 1);
            if (/;base64/i.test(header)) {
                const binary = atob(body);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
                return bytes;
            }
            return new TextEncoder().encode(decodeURIComponent(body));
        }

        getPhotoManagerCrc32(bytes) {
            if (!this._photoManagerCrcTable) {
                this._photoManagerCrcTable = new Uint32Array(256);
                for (let i = 0; i < 256; i += 1) {
                    let c = i;
                    for (let j = 0; j < 8; j += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
                    this._photoManagerCrcTable[i] = c >>> 0;
                }
            }
            let crc = 0xffffffff;
            for (let i = 0; i < bytes.length; i += 1) {
                crc = this._photoManagerCrcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
            }
            return (crc ^ 0xffffffff) >>> 0;
        }

        pushPhotoManagerZip16(parts, value) {
            parts.push(value & 0xff, (value >>> 8) & 0xff);
        }

        pushPhotoManagerZip32(parts, value) {
            parts.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
        }

        createPhotoManagerZipBlob(files) {
            const encoder = new TextEncoder();
            const chunks = [];
            const central = [];
            let offset = 0;
            const now = new Date();
            const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
            const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

            files.forEach(file => {
                const nameBytes = encoder.encode(file.name);
                const data = file.bytes;
                const crc = this.getPhotoManagerCrc32(data);
                const local = [];
                this.pushPhotoManagerZip32(local, 0x04034b50);
                this.pushPhotoManagerZip16(local, 20);
                this.pushPhotoManagerZip16(local, 0x0800);
                this.pushPhotoManagerZip16(local, 0);
                this.pushPhotoManagerZip16(local, dosTime);
                this.pushPhotoManagerZip16(local, dosDate);
                this.pushPhotoManagerZip32(local, crc);
                this.pushPhotoManagerZip32(local, data.length);
                this.pushPhotoManagerZip32(local, data.length);
                this.pushPhotoManagerZip16(local, nameBytes.length);
                this.pushPhotoManagerZip16(local, 0);
                chunks.push(new Uint8Array(local), nameBytes, data);

                const entryOffset = offset;
                offset += local.length + nameBytes.length + data.length;

                const header = [];
                this.pushPhotoManagerZip32(header, 0x02014b50);
                this.pushPhotoManagerZip16(header, 20);
                this.pushPhotoManagerZip16(header, 20);
                this.pushPhotoManagerZip16(header, 0x0800);
                this.pushPhotoManagerZip16(header, 0);
                this.pushPhotoManagerZip16(header, dosTime);
                this.pushPhotoManagerZip16(header, dosDate);
                this.pushPhotoManagerZip32(header, crc);
                this.pushPhotoManagerZip32(header, data.length);
                this.pushPhotoManagerZip32(header, data.length);
                this.pushPhotoManagerZip16(header, nameBytes.length);
                this.pushPhotoManagerZip16(header, 0);
                this.pushPhotoManagerZip16(header, 0);
                this.pushPhotoManagerZip16(header, 0);
                this.pushPhotoManagerZip16(header, 0);
                this.pushPhotoManagerZip32(header, 0);
                this.pushPhotoManagerZip32(header, entryOffset);
                central.push(new Uint8Array(header), nameBytes);
            });

            const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
            const end = [];
            this.pushPhotoManagerZip32(end, 0x06054b50);
            this.pushPhotoManagerZip16(end, 0);
            this.pushPhotoManagerZip16(end, 0);
            this.pushPhotoManagerZip16(end, files.length);
            this.pushPhotoManagerZip16(end, files.length);
            this.pushPhotoManagerZip32(end, centralSize);
            this.pushPhotoManagerZip32(end, offset);
            this.pushPhotoManagerZip16(end, 0);
            return new Blob([...chunks, ...central, new Uint8Array(end)], { type: 'application/zip' });
        }

        async exportPhotoManagerItemsAsZip(items) {
            const used = new Set();
            const files = [];
            for (let index = 0; index < items.length; index += 1) {
                const item = items[index];
                const src = await this.getPhotoManagerDownloadSrc(item);
                const name = this.getPhotoManagerUniqueExportFileName(
                    this.getPhotoManagerSafeFileName(item, index + 1, src),
                    used
                );
                files.push({ name, bytes: this.dataUrlToPhotoManagerBytes(src) });
            }
            const blob = this.createPhotoManagerZipBlob(files);
            this.downloadPhotoManagerBlob(blob, this.getPhotoManagerExportZipFileName());
            this.showToast?.(`${items.length}件の画像をZIPで出力しました。`, 'success');
        }

        getPhotoManagerSourceLabel(item = {}) {
            const labels = {
                library: '写真管理',
                machine: '機械',
                part: '部品',
                history: '履歴',
                guide: '手順書',
                shift: '連絡帳'
            };
            return labels[item.source] || item.sourceLabel || item.source || '画像';
        }
        async cleanupExpiredShiftNotebookPhotos() {
            this.ensurePhotoManagerData();
            const today = this.getPhotoManagerToday();
            if (store.activeData.photoManagerLastAutoCleanup === today) return;
            const cutoff = new Date();
            cutoff.setHours(0, 0, 0, 0);
            cutoff.setMonth(cutoff.getMonth() - 1);
            const cutoffText = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
            const notebooks = store.activeData.shiftNotebooks || {};
            let removed = 0;
            const removedSources = new Set();
            for (const [dateStr, dayData] of Object.entries(notebooks)) {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || dateStr >= cutoffText || !dayData) continue;
                const rowSets = [dayData.sharedRows];
                ['early', 'late', 'night'].forEach(shift => {
                    const shiftData = dayData[shift];
                    rowSets.push(Array.isArray(shiftData) ? shiftData : shiftData?.rows);
                });
                for (const rows of rowSets) {
                    if (!Array.isArray(rows)) continue;
                    for (const row of rows) {
                        if (!Array.isArray(row?.photos) || !row.photos.length) continue;
                        const kept = [];
                        for (const rawPhoto of row.photos) {
                            const photo = this.normalizeShiftNotebookPhoto ? this.normalizeShiftNotebookPhoto(rawPhoto) : (typeof rawPhoto === 'string' ? { src: rawPhoto } : rawPhoto);
                            const src = photo?.src || '';
                            const protectedPhoto = this.isPhotoManagerSourceProtected(src) || this.isKnownPhotoManagerTransparentSource(src);
                            if (protectedPhoto) {
                                kept.push(rawPhoto);
                            } else {
                                removed += 1;
                                if (src) removedSources.add(src);
                            }
                        }
                        row.photos = kept;
                    }
                }
            }
            removedSources.forEach(src => this.removePhotoManagerSourceFromRecentCachesIfUnused?.(src));
            store.activeData.photoManagerLastAutoCleanup = today;
            store.activeData.photoManagerLastAutoCleanupCount = removed;
            store.save();
            if (removed) this.showPhotoManagerNotice?.(`${removed} old images were cleaned up.`);
        }
        renderPhotoManager() {
            this.applyMediaManagementCardColor();
            this.ensurePhotoManagerPasteImportListener?.();
            this.ensureImageSourceChoiceListener?.();
            const list = document.getElementById('photo-manager-list');
            const summary = document.getElementById('photo-manager-summary');
            if (!list) return;
            this.updatePhotoManagerAlphaFilterButton?.();
            this.updatePhotoManagerToolbarActiveState?.();
            this.updatePhotoManagerTagFilterOptions?.();
            const allItems = this.collectPhotoManagerItems?.() || [];
            const items = this.getFilteredPhotoManagerItems ? this.getFilteredPhotoManagerItems(allItems) : allItems;
            this._photoManagerVisibleIds = items.map(item => item.id).filter(Boolean);
            this.prunePhotoManagerSelection?.(allItems.map(item => item.id));
            const selectedIds = this.ensurePhotoManagerSelectionStore?.() || new Set();
            const duplicateGroups = this.getPhotoManagerDuplicateGroups?.(allItems) || [];
            const duplicateSrcs = new Set(duplicateGroups.map(group => group.src));
            const usageIndex = this.getPhotoManagerUsageIndex?.(allItems, false) || new Map();
            this._photoManagerRenderCache = { allItems, duplicateGroups, usageIndex, pageOnlyItems: null, relationGroups: null };
            if (summary) {
                const marked = items.filter(item => item.annotated).length;
                const compressed = items.filter(item => this.isPhotoManagerSourceCompressed?.(item.src)).length;
                const visibleBytes = items.reduce((sum, item) => sum + (this.estimatePhotoManagerImageBytes?.(item.src) || 0), 0);
                const trashBytes = (store.activeData.photoManagerTrash || []).reduce((sum, entry) => sum + (this.estimatePhotoManagerImageBytes?.(entry.src) || 0), 0);
                const parts = [
                    '<b>' + items.length + '</b> / ' + allItems.length + '枚',
                    '<span>容量 ' + (this.formatPhotoManagerBytes?.(visibleBytes) || '0KB') + '</span>',
                    '<span>圧縮 ' + compressed + '</span>',
                    '<span>注記 ' + marked + '</span>'
                ];
                if (trashBytes) parts.push('<span>ゴミ箱 ' + (this.formatPhotoManagerBytes?.(trashBytes) || '0KB') + '</span>');
                summary.innerHTML = parts.join(' ');
            }
            if (!items.length) {
                list.innerHTML = '<div class="photo-manager-empty">条件に合う写真はありません。</div>';
                this.updatePhotoManagerBulkBar?.();
                this.addPhotoManagerPageOnlyCleanupButton?.();
                return;
            }
            list.innerHTML = items.map(item => {
                const name = this.getPhotoManagerName?.(item) || item.defaultName || item.title || '画像';
                const sourceLabel = this.getPhotoManagerSourceLabel?.(item) || '画像';
                const alphaStatus = this.getPhotoManagerAlphaStatus?.(item);
                const checked = selectedIds.has(item.id) ? ' checked' : '';
                const usageSummary = this.getPhotoManagerUsageSummary?.(item, usageIndex) || { count: 0, label: '未使用' };
                const compressedPhoto = this.isPhotoManagerSourceCompressed?.(item.src);
                const protectedPhoto = this.isPhotoManagerSourceProtected?.(item.src);
                const sizeText = this.formatPhotoManagerBytes?.(this.estimatePhotoManagerImageBytes?.(item.src) || 0) || '';
                const hasBlankEdit = !!(item.source === 'library' && item.photoCompareBlankEdit?.type === 'blank');
                const thumbAction = hasBlankEdit
                    ? `app.openPhotoManagerBlankEdit('${this.escapeJs(item.id)}')`
                    : (item.source === 'library'
                        ? `app.openPhotoManagerEditor('${this.escapeJs(item.id)}')`
                        : `app.openPhotoManagerSource('${this.escapeJs(item.id)}')`);
                return `
                <article class="photo-manager-card" data-photo-id="${this.escapeHtml(item.id)}">
                    <label class="photo-manager-check">
                        <input type="checkbox" class="photo-manager-select" value="${this.escapeHtml(item.id)}"${checked} onchange="app.syncPhotoManagerSelection(this.value, this.checked)">
                    </label>
                    <button type="button" class="photo-manager-thumb" onclick="${thumbAction}" title="画像を開く">
                        <img src="${item.src}" alt="${this.escapeHtml(name)}">
                        ${duplicateSrcs.has(item.src) ? '<span class="photo-manager-duplicate-badge"><i class="fa-solid fa-clone"></i> 重複</span>' : ''}
                        ${item.annotated ? '<span class="photo-manager-mark-badge"><i class="fa-solid fa-pen"></i> 注記</span>' : ''}
                        ${hasBlankEdit ? '<span class="photo-manager-blank-edit-badge"><i class="fa-regular fa-file-lines"></i> 白紙編集</span>' : ''}
                        ${alphaStatus ? `<span class="photo-manager-alpha-badge ${alphaStatus}" role="button" tabindex="0" onpointerdown="event.preventDefault(); event.stopPropagation();" onclick="event.preventDefault(); event.stopPropagation(); app.openImageSourceChoiceTransparencyPreview('${this.escapeJs(item.id)}')"><i class="fa-solid fa-layer-group"></i> ${alphaStatus === 'transparent' ? '透過' : '透過候補'}</span>` : ''}
                        ${item.circleImageEdit ? '<span class="photo-manager-circle-image-badge"><i class="fa-solid fa-circle-user"></i> 丸編集</span>' : ''}
                        ${compressedPhoto ? '<span class="photo-manager-compressed-badge"><i class="fa-solid fa-compress"></i> 圧縮済み</span>' : ''}
                        <span class="photo-manager-usage-badge ${usageSummary.count ? 'used' : 'unused'}"><i class="fa-solid ${usageSummary.count ? 'fa-link' : 'fa-circle-minus'}"></i> ${this.escapeHtml(usageSummary.label || '未使用')}</span>
                    </button>
                    <div class="photo-manager-side-actions">
                        <button type="button" class="secondary-btn icon-only" onclick="app.openPhotoManagerEditor('${this.escapeJs(item.id)}')" title="編集" aria-label="編集"><i class="fa-solid fa-pen"></i></button>
                        ${hasBlankEdit ? `<button type="button" class="secondary-btn icon-only photo-manager-blank-edit-btn" onclick="app.openPhotoManagerBlankEdit('${this.escapeJs(item.id)}')" title="白紙再編集" aria-label="白紙再編集"><i class="fa-regular fa-file-lines"></i></button>` : ''}
                        ${hasBlankEdit ? `<button type="button" class="secondary-btn icon-only photo-manager-blank-copy-btn" onclick="app.duplicatePhotoManagerBlankEdit('${this.escapeJs(item.id)}')" title="白紙編集を複製" aria-label="白紙編集を複製"><i class="fa-solid fa-copy"></i></button>` : ''}
                        <button type="button" class="secondary-btn icon-only" onclick="app.downloadPhotoManagerItem('${this.escapeJs(item.id)}')" title="出力" aria-label="出力"><i class="fa-solid fa-download"></i></button>
                        <details class="photo-manager-more-actions">
                            <summary><i class="fa-solid fa-ellipsis"></i></summary>
                            <div>
                                <button type="button" onclick="app.autoTagPhotoManagerItem('${this.escapeJs(item.id)}')"><i class="fa-solid fa-tags"></i> タグ自動</button>
                                <button type="button" onclick="app.compressPhotoManagerImage('${this.escapeJs(item.id)}')"><i class="fa-solid fa-compress"></i> 圧縮</button>
                                ${hasBlankEdit ? `<button type="button" onclick="app.savePhotoManagerBlankTemplate('${this.escapeJs(item.id)}')"><i class="fa-regular fa-clone"></i> テンプレ保存</button>` : ''}
                                ${hasBlankEdit ? `<button type="button" onclick="app.duplicatePhotoManagerBlankEdit('${this.escapeJs(item.id)}')"><i class="fa-solid fa-copy"></i> 複製</button>` : ''}
                                <button type="button" onclick="app.togglePhotoManagerSourceProtection?.('${this.escapeJs(item.id)}')"><i class="fa-solid ${protectedPhoto ? 'fa-lock-open' : 'fa-lock'}"></i> ${protectedPhoto ? 'ロック解除' : 'ロック'}</button>
                                <button type="button" onclick="app.createTransparentPhotoManagerImage('${this.escapeJs(item.id)}')"><i class="fa-solid fa-layer-group"></i> 再透過</button>
                                <button type="button" class="danger" onclick="app.deletePhotoManagerItem('${this.escapeJs(item.id)}')"><i class="fa-solid fa-trash-can"></i> 削除</button>
                            </div>
                        </details>
                    </div>
                    <div class="photo-manager-info">
                        <div class="photo-manager-meta">
                            <span>${this.escapeHtml(sourceLabel)}</span>
                            ${item.date ? `<span>${this.escapeHtml(item.date)}</span>` : '<span>日付なし</span>'}
                            ${sizeText ? `<span class="photo-manager-size"><i class="fa-solid fa-database"></i> ${this.escapeHtml(sizeText)}</span>` : ''}
                            ${compressedPhoto ? '<span class="photo-manager-compressed-meta"><i class="fa-solid fa-circle-check"></i> 圧縮済み</span>' : '<span class="photo-manager-uncompressed-meta">非圧縮</span>'}
                            ${protectedPhoto ? '<span class="photo-manager-protected"><i class="fa-solid fa-lock"></i> 保護中</span>' : ''}
                        </div>
                        <input type="text" value="${this.escapeHtml(item.displayName || '')}" placeholder="写真管理用の名前" onchange="app.setPhotoManagerName('${this.escapeJs(item.id)}', this.value)">
                        <p title="${this.escapeHtml(item.title || '')}">${this.escapeHtml(item.title || '元データなし')}</p>
                        ${usageSummary.usages?.length ? `
                            <div class="photo-manager-usage-links">
                                ${usageSummary.usages.slice(0, 4).map(usage => `
                                    <button type="button" onclick="app.openPhotoManagerUsageSource('${this.escapeJs(usage.id)}')" title="${this.escapeHtml(usage.title || '')}">
                                        ${this.escapeHtml(this.getPhotoManagerSourceLabel(usage))}${usage.usageKind === 'stamp' ? '・スタンプ' : ''}
                                    </button>
                                `).join('')}
                                ${usageSummary.usages.length > 4 ? `<button type="button" onclick="app.openPhotoManagerUsageList('${this.escapeJs(item.id)}')">+${usageSummary.usages.length - 4}</button>` : ''}
                                <button type="button" onclick="app.openPhotoManagerUsageList('${this.escapeJs(item.id)}')"><i class="fa-solid fa-list"></i> 使用先一覧</button>
                            </div>
                        ` : '<div class="photo-manager-usage-links empty">使用先なし</div>'}
                    </div>
                </article>`;
            }).join('');
            this.updatePhotoManagerTransparencyBadges?.(items);
            this.updatePhotoManagerBulkBar?.();
            this.addPhotoManagerPageOnlyCleanupButton?.();
            this.enhancePhotoManagerCards?.(items);
        }
        updatePhotoManagerBulkBar() {
            const bar = document.getElementById('photo-manager-bulk-bar');
            if (!bar) return;
            const selected = this.getSelectedPhotoManagerIds?.() || [];
            const items = this.collectPhotoManagerItems?.() || [];
            const duplicateCount = this.getPhotoManagerDuplicateGroups?.(items)?.length || 0;
            const trashCount = (store.activeData.photoManagerTrash || []).length;
            bar.innerHTML = `
                <div class="photo-manager-bulk-info"><b>${selected.length}</b>枚選択中</div>
                <div class="photo-manager-bulk-actions">
                    <button type="button" class="secondary-btn" onclick="app.exportPhotoManagerItems()" title="5枚以上はZIPでまとめて出力します"><i class="fa-solid fa-file-export"></i> 出力</button>
                    <button type="button" class="secondary-btn" onclick="app.openPhotoManagerRelationMap?.()"><i class="fa-solid fa-link"></i> 関連</button>
                    <button type="button" class="secondary-btn" onclick="app.openPhotoManagerDuplicateReview?.()"><i class="fa-solid fa-clone"></i> 重複 ${duplicateCount ? `(${duplicateCount})` : ''}</button>
                    <button type="button" class="secondary-btn" onclick="app.openPhotoManagerTrashDialog?.()"><i class="fa-solid fa-trash-restore"></i> ゴミ箱 ${trashCount ? `(${trashCount})` : ''}</button>
                    <button type="button" class="danger-btn" onclick="app.deleteSelectedPhotoManagerItems?.()"><i class="fa-solid fa-trash-can"></i> 選択削除</button>
                </div>`;
        }

        getPhotoManagerRelationGroups(items = null) {
            const groups = new Map();
            (items || this.collectPhotoManagerItems()).forEach(item => {
                if (!item?.src) return;
                if (!groups.has(item.src)) groups.set(item.src, []);
                groups.get(item.src).push(item);
            });
            return Array.from(groups.entries()).map(([src, groupItems]) => {
                const sources = [...new Set(groupItems.map(item => item.source))];
                const bytes = this.estimatePhotoManagerImageBytes?.(src) || 0;
                return { src, items: groupItems, sources, bytes };
            }).filter(group => group.items.length > 1 || group.sources.length > 1)
                .sort((a, b) => b.items.length - a.items.length || b.bytes - a.bytes);
        }

        openPhotoManagerRelationMap() {
            const groups = this.getPhotoManagerRelationGroups();
            if (!groups.length) return this.showPhotoManagerNotice?.('No related images found.');
            const totalBytes = groups.reduce((sum, group) => sum + group.bytes, 0);
            const body = `
                <div class="photo-manager-review-summary">
                    <b>${groups.length} groups</b>
                    <span>Total ${this.formatPhotoManagerBytes?.(totalBytes) || '0KB'}</span>
                </div>
                <div class="photo-manager-relation-list">
                    ${groups.map(group => `
                        <article class="photo-manager-relation-item">
                            <img src="${group.src}" alt="related image">
                            <div>
                                <b>${group.items.length} items / ${this.formatPhotoManagerBytes?.(group.bytes) || '0KB'}</b>
                                <div class="photo-manager-relation-chips">
                                    ${group.items.map(item => `<button type="button" onclick="app.openPhotoManagerUsageSource('${this.escapeJs(item.id)}')">${this.escapeHtml(this.getPhotoManagerSourceLabel(item))}</button>`).join('')}
                                </div>
                                <small>${this.escapeHtml(group.items.map(item => item.title || item.defaultName || this.getPhotoManagerSourceLabel(item)).slice(0, 4).join(' / '))}</small>
                            </div>
                        </article>
                    `).join('')}
                </div>
                <div class="photo-manager-review-actions">
                    <button type="button" class="secondary-btn" onclick="app.closePhotoManagerReviewDialog()">Close</button>
                </div>`;
            this.openPhotoManagerReviewDialog?.('Image relations', body);
        }

        async exportPhotoManagerItems() {
            const selected = new Set(this.getSelectedPhotoManagerIds?.() || []);
            const allItems = this.collectPhotoManagerItems?.() || [];
            const filtered = this.getFilteredPhotoManagerItems ? this.getFilteredPhotoManagerItems(allItems) : allItems;
            const items = filtered.filter(item => !selected.size || selected.has(item.id));
            if (!items.length) return alert('No images to export.');
            if (items.length >= 5) {
                await this.exportPhotoManagerItemsAsZip(items);
                return;
            }
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

