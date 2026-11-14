(function () {
    const featureSources = {
        notebook: 'app-shift-notebook-core.js?v=20261115-all5',
        photos: 'app-photo-manager.js?v=20261115-six1',
        camera: 'app-shift-photo-camera.js?v=20260906-avatar-stage72',
        reveal: 'app-shift-photo-reveal.js?v=20260906-avatar-stage72',
        avatar: 'app-shift-avatar-conversation.js?v=20260906-avatar-stage72'
    };
    const pending = {};
    const loaded = { notebook: false, photos: false, camera: false, reveal: false, avatar: false };
    let photoFeaturesReady = false;

    function loadScript(feature) {
        if (loaded[feature]) return Promise.resolve();
        if (pending[feature]) return pending[feature];
        pending[feature] = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = featureSources[feature];
            script.async = true;
            script.onload = () => {
                loaded[feature] = true;
                resolve();
            };
            script.onerror = () => {
                script.remove();
                reject(new Error(`${feature} の読み込みに失敗しました`));
            };
            document.head.appendChild(script);
        }).catch(error => {
            pending[feature] = null;
            throw error;
        });
        return pending[feature];
    }

    let corePhotoEntrypointsWrapped = false;
    const loadNotebook = () => loadScript('notebook').then(() => {
        if (corePhotoEntrypointsWrapped) return;
        corePhotoEntrypointsWrapped = true;
        for (const name of ['openShiftPhotoCompare', 'openShiftPhotoCompareWithPhotos']) {
            const original = MaintenanceApp.prototype[name];
            if (typeof original !== 'function') continue;
            MaintenanceApp.prototype[name] = function (...args) {
                if (loaded.camera && loaded.reveal && loaded.avatar) return original.apply(this, args);
                return loadPhotoEffects().then(() => original.apply(this, args)).catch(error => {
                    console.error('Photo comparison load failed:', error);
                    this.showToast?.('写真比較を読み込めませんでした。もう一度お試しください。', 'error');
                    return null;
                });
            };
        }
    });
    let diagnosticsScheduled = false;
    const loadPhotos = () => loadScript('photos').then(() => {
        photoFeaturesReady = true;
        wrapPhotoManagerNotebookEntrypoints();
        try {
            window.app?.ensureImageSourceChoiceListener?.();
        } catch (error) {
            console.warn('Could not register image chooser listener:', error);
        }
        if (window.app?._imageSourceChoiceListener && typeof document !== 'undefined') {
            document.removeEventListener('click', loadImageChoiceOnFirstClick, true);
        }
        if (!diagnosticsScheduled) {
            diagnosticsScheduled = true;
            window.setTimeout(() => {
                window.app?.cleanupExpiredShiftNotebookPhotos?.();
                window.app?.runScheduledDataDiagnostics?.(false);
            }, 0);
        }
    });
    const loadNotebookAndPhotos = () => loadNotebook().then(loadPhotos);
    const loadPhotoEffects = () => loadNotebookAndPhotos().then(() => loadScript('camera'))
        .then(() => loadScript('reveal')).then(() => loadScript('avatar'));
    window.maintenanceLazyFeatures = { loadNotebook, loadPhotos, loadPhotoEffects };

    let photoManagerNotebookEntrypointsWrapped = false;
    function wrapPhotoManagerNotebookEntrypoints() {
        if (photoManagerNotebookEntrypointsWrapped) return;
        photoManagerNotebookEntrypointsWrapped = true;
        for (const name of [
            'openPhotoManagerEditor', 'openPhotoManagerBlankShiftPhotoCompare',
            'openPhotoManagerBlankEdit', 'openPhotoManagerBlankTemplate',
            'openPhotoManagerAudios', 'openPhotoManagerVideos', 'exportPhotoManagerItems',
            'downloadPhotoManagerItem', 'openImageSourceChoiceTransparencyPreview',
            'reopenPhotoManagerTransparentImageForCutout'
        ]) {
            const original = MaintenanceApp.prototype[name];
            if (typeof original !== 'function') continue;
            MaintenanceApp.prototype[name] = function (...args) {
                if (loaded.notebook) return original.apply(this, args);
                return loadNotebook().then(() => original.apply(this, args)).catch(error => {
                    console.error(`${name} load failed:`, error);
                    this.showToast?.('関連機能を読み込めませんでした。もう一度お試しください。', 'error');
                    return null;
                });
            };
        }
    }

    // File inputs on the initial calendar can be clicked before the photo module exists.
    function loadImageChoiceOnFirstClick(event) {
        const label = event.target?.closest?.('label[for]');
        const input = event.target?.matches?.('input[type="file"][accept*="image"]')
            ? event.target
            : (label ? document.getElementById(label.getAttribute('for')) : null);
        if (!input?.matches?.('input[type="file"][accept*="image"]')) return;
        if (input._imageSourceDirectOnce) {
            input._imageSourceDirectOnce = false;
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        return loadNotebookAndPhotos().then(() => {
            if (input.dataset.shiftPhotoWallpaperPicker === '1'
                && window.app.prepareShiftPhotoCompareWallpaperPicker?.(input) === false) return;
            window.app.openImageSourceChoice(input);
        }).catch(error => {
            console.error('Image source choice load failed:', error);
            window.app?.showToast?.('画像選択を読み込めませんでした。もう一度お試しください。', 'error');
        });
    }
    if (typeof document !== 'undefined') {
        document.addEventListener('click', loadImageChoiceOnFirstClick, true);
    }

    // The initial calendar uses these settings before the notebook module is loaded.
    MaintenanceApp.prototype.loadShiftNotebookRowMenuHiddenParts = function () {
        const fallback = localStorage.getItem('shift_notebook_row_menu_hidden') === 'true';
        try {
            const saved = JSON.parse(localStorage.getItem('shift_notebook_row_menu_hidden_parts') || 'null');
            if (saved && typeof saved === 'object') {
                return { group: !!saved.group, format: !!saved.format, actions: !!saved.actions };
            }
        } catch (_) {}
        return { group: fallback, format: fallback, actions: fallback };
    };
    MaintenanceApp.prototype.closeShiftNotebookRowMenuSettings = function () {
        const panel = document.getElementById('shift-row-menu-settings-panel');
        if (panel) panel.hidden = true;
    };
    MaintenanceApp.prototype.getShiftNotebookLabel = function (shift) {
        return {
            early: { stamp: '早', name: '早番' },
            late: { stamp: '遅', name: '遅番' },
            night: { stamp: '深', name: '深夜' }
        }[shift] || { stamp: '早', name: '早番' };
    };
    // Photo listing needs these small notebook helpers before the notebook editor loads.
    MaintenanceApp.prototype.getShiftNotebookRowsAndMembers = function (notebookData) {
        if (Array.isArray(notebookData)) return { rows: notebookData, members: [] };
        return {
            rows: Array.isArray(notebookData?.rows) ? notebookData.rows : [],
            members: Array.isArray(notebookData?.members) ? notebookData.members : [],
            absentMembers: Array.isArray(notebookData?.absentMembers) ? notebookData.absentMembers : [],
            inheritedMembers: !!notebookData?.inheritedMembers,
            inheritedFrom: notebookData?.inheritedFrom || ''
        };
    };
    MaintenanceApp.prototype.getSearchTerms = function (query = '') {
        return MaintenanceStore.toHalfWidthLower(query || '').split(/[\s　]+/).filter(Boolean);
    };
    MaintenanceApp.prototype.matchesSearchTerms = function (searchable = '', terms = []) {
        const normalized = MaintenanceStore.toHalfWidthLower(searchable || '');
        return terms.every(term => normalized.includes(term));
    };
    MaintenanceApp.prototype.getNotebookSearchDateRange = function (period) {
        const format = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (period === 'today') return { start: format(today), end: format(today), label: '今日' };
        if (period === 'yesterday') return { start: format(yesterday), end: format(yesterday), label: '昨日' };
        if (period === 'yesterday_today') return { start: format(yesterday), end: format(today), label: '昨日と今日' };
        if (period === 'this_month' || period === 'last_month') {
            const offset = period === 'this_month' ? 0 : -1;
            const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
            const end = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0);
            return { start: format(start), end: format(end), label: period === 'this_month' ? '今月' : '先月' };
        }
        if (period === 'this_year' || period === 'last_year') {
            const year = today.getFullYear() - (period === 'last_year' ? 1 : 0);
            return { start: format(new Date(year, 0, 1)), end: format(new Date(year, 11, 31)), label: period === 'this_year' ? '今年' : '去年' };
        }
        if (period === 'CUSTOM') {
            const start = this.customStartDate || '';
            const end = this.customEndDate || '';
            return { start, end, label: start && end ? `${start} - ${end}` : '期間指定' };
        }
        return { start: '', end: '', label: '全期間' };
    };
    // Keep saved page effects intact while the optional camera and reveal scripts are loading.
    MaintenanceApp.prototype.normalizeShiftPhotoCamera = value =>
        value && typeof value === 'object' ? value : { enabled: false };
    MaintenanceApp.prototype.normalizeShiftPhotoReveal = value =>
        value && typeof value === 'object' ? value : { enabled: false, areas: [] };

    function setViewBusy(viewId, busy) {
        const view = document.getElementById(viewId);
        if (!view) return;
        view.querySelectorAll('button, input, select, textarea').forEach(control => {
            if (control.closest('.lazy-feature-status')) return;
            if (busy) {
                if (!Object.prototype.hasOwnProperty.call(control.dataset, 'lazyWasDisabled')) {
                    control.dataset.lazyWasDisabled = String(control.disabled);
                }
                control.disabled = true;
            } else if (Object.prototype.hasOwnProperty.call(control.dataset, 'lazyWasDisabled')) {
                control.disabled = control.dataset.lazyWasDisabled === 'true';
                delete control.dataset.lazyWasDisabled;
            }
        });
    }

    function showFeatureStatus(viewId, message, retry) {
        const view = document.getElementById(viewId);
        if (!view) return;
        let status = view.querySelector('.lazy-feature-status');
        if (!status) {
            status = document.createElement('div');
            status.className = 'lazy-feature-status';
            status.style.cssText = 'padding:14px;margin:12px 0;border:1px solid var(--border);border-radius:8px;background:var(--background);';
            status.setAttribute('role', 'status');
            view.prepend(status);
        }
        const label = document.createElement('span');
        label.textContent = message;
        status.replaceChildren(label);
        if (retry) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'secondary-btn';
            button.style.marginLeft = '10px';
            button.textContent = '再試行';
            button.addEventListener('click', retry);
            status.appendChild(button);
        }
    }

    function lazyMethod(name, loader, viewId) {
        const placeholder = function (...args) {
            if (viewId) {
                setViewBusy(viewId, true);
                showFeatureStatus(viewId, '読み込み中…');
            }
            return loader().then(() => {
                const method = this[name];
                if (method === placeholder || typeof method !== 'function') throw new Error(`${name} を読み込めませんでした`);
                if (viewId) {
                    setViewBusy(viewId, false);
                    document.getElementById(viewId)?.querySelector('.lazy-feature-status')?.remove();
                }
                return method.apply(this, args);
            }).catch(error => {
                console.error('Feature load failed:', error);
                if (viewId) showFeatureStatus(viewId, '機能を読み込めませんでした。', () => this[name](...args));
                else this.showToast?.('機能を読み込めませんでした。もう一度お試しください。', 'error');
                return null;
            });
        };
        MaintenanceApp.prototype[name] = placeholder;
    }

    function lazyExistingMethod(name, loader, isReady, viewId) {
        const original = MaintenanceApp.prototype[name];
        if (typeof original !== 'function') return;
        MaintenanceApp.prototype[name] = function (...args) {
            if (isReady()) return original.apply(this, args);
            if (viewId) {
                setViewBusy(viewId, true);
                showFeatureStatus(viewId, '読み込み中…');
            }
            return loader().then(() => {
                if (viewId) {
                    setViewBusy(viewId, false);
                    document.getElementById(viewId)?.querySelector('.lazy-feature-status')?.remove();
                }
                return original.apply(this, args);
            }).catch(error => {
                console.error('Feature load failed:', error);
                if (viewId) showFeatureStatus(viewId, '機能を読み込めませんでした。', () => this[name](...args));
                else this.showToast?.('機能を読み込めませんでした。もう一度お試しください。', 'error');
                return null;
            });
        };
    }

    lazyMethod('openShiftNotebookModal', loadNotebookAndPhotos);
    lazyMethod('openShiftNotebookSearchResults', loadNotebookAndPhotos);
    lazyMethod('openShiftMemberTypeManageModal', loadNotebook);
    lazyMethod('openShiftRowTemplateManageModal', loadNotebook);
    lazyMethod('showUndoNotice', loadNotebook);
    const deferredTodoFeedback = function (...args) {
        return loadNotebook().then(() => {
            if (this.appendShiftTodoFeedback === deferredTodoFeedback) throw new Error('連絡帳の更新処理を読み込めませんでした');
            this.appendShiftTodoFeedback(...args);
            store.save();
        }).catch(error => console.error('Could not append notebook feedback:', error));
    };
    MaintenanceApp.prototype.appendShiftTodoFeedback = deferredTodoFeedback;
    lazyMethod('renderFiveSManagement', loadNotebookAndPhotos, 'view-fiveS');
    lazyExistingMethod('renderKanbanLocalTodos', loadNotebookAndPhotos, () => loaded.notebook && photoFeaturesReady, 'view-todos');
    lazyExistingMethod('renderDashboard', loadNotebookAndPhotos, () => loaded.notebook && photoFeaturesReady, 'view-dashboard');
    lazyExistingMethod('renderOutlookAssist', loadNotebookAndPhotos, () => loaded.notebook && photoFeaturesReady, 'view-outlookAssist');
    for (const [name, viewId] of [
        ['renderMachines', 'view-machines'], ['renderAnalysis', 'view-analysis'],
        ['renderWorkTime', 'view-worktime'], ['renderRanking', 'view-ranking'],
        ['renderWorkers', 'view-workers']
    ]) lazyExistingMethod(name, loadNotebookAndPhotos, () => loaded.notebook && photoFeaturesReady, viewId);
    lazyExistingMethod('renderHistory', loadNotebookAndPhotos, () => loaded.notebook && photoFeaturesReady, 'view-history');
    lazyExistingMethod('renderGuides', loadNotebookAndPhotos, () => loaded.notebook && photoFeaturesReady, 'view-guides');
    lazyExistingMethod('renderTips', loadNotebookAndPhotos, () => loaded.notebook && photoFeaturesReady, 'view-tips');
    lazyExistingMethod('openHistoryEditForm', loadNotebookAndPhotos, () => loaded.notebook && photoFeaturesReady);
    lazyExistingMethod('openGuideModal', loadNotebookAndPhotos, () => loaded.notebook && photoFeaturesReady);
    lazyExistingMethod('openTipsAudioDatabase', loadNotebookAndPhotos, () => loaded.notebook && photoFeaturesReady);
    lazyMethod('renderPhotoManager', loadPhotos, 'view-photos');
    lazyMethod('openImageSourceChoice', loadNotebookAndPhotos);
    for (const name of ['openPhotoManagerTrashDialog', 'openPhotoManagerDuplicateReview',
        'openPhotoManagerPageOnlyCleanupReview', 'openPhotoManagerDeleteReview',
        'openPhotoManagerVideos', 'openPhotoManagerAudios',
        'openRegisteredVideoAttachmentPicker', 'openRegisteredVideoAttachment',
        'openPhotoManagerBlankShiftPhotoCompare', 'openPhotoManagerBlankTemplateDialog']) {
        lazyMethod(name, ['openPhotoManagerVideos', 'openPhotoManagerAudios', 'openRegisteredVideoAttachmentPicker', 'openRegisteredVideoAttachment'].includes(name)
            ? loadNotebookAndPhotos : loadPhotos);
    }
    MaintenanceApp.prototype.loadPhotoManagerMethodsForStorageCenter = () => loadNotebookAndPhotos().then(() => true).catch(() => false);
    const openBackupExportModal = MaintenanceApp.prototype.openBackupExportModal;
    if (typeof openBackupExportModal === 'function') {
        MaintenanceApp.prototype.openBackupExportModal = function (...args) {
            if (photoFeaturesReady) return openBackupExportModal.apply(this, args);
            return loadNotebookAndPhotos().catch(error => console.warn('Photo analysis unavailable during export:', error))
                .then(() => openBackupExportModal.apply(this, args));
        };
    }
    for (const name of ['openStorageManagementCenter', 'openScheduledDataDiagnosticsPanel', 'openUnusedImagesFromBackup']) {
        const original = MaintenanceApp.prototype[name];
        if (typeof original !== 'function') continue;
        MaintenanceApp.prototype[name] = function (...args) {
            if (photoFeaturesReady) return original.apply(this, args);
            return loadNotebookAndPhotos().catch(error => console.warn('Photo analysis unavailable:', error))
                .then(() => original.apply(this, args));
        };
    }

    window.addEventListener('DOMContentLoaded', async () => {
        // Retired workspace links now use the normal save area; clear the old label in the URL.
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.has('workspace')) {
                url.searchParams.delete('workspace');
                window.history.replaceState(window.history.state, '', url.href);
            }
        } catch (error) {
            console.warn('Could not update the retired workspace URL:', error);
        }
        try {
            await store.init();
        } catch (error) {
            store.storageWarning = error;
            console.error('Failed to initialize app state:', error);
        }
        try {
            window.app = new MaintenanceApp();
            if (loaded.photos) {
                window.app.ensureImageSourceChoiceListener?.();
                if (window.app._imageSourceChoiceListener) {
                    document.removeEventListener('click', loadImageChoiceOnFirstClick, true);
                }
            }
        } catch (error) {
            console.error('Failed to start app:', error);
            alert('アプリの起動に失敗しました。ページを再読み込みしてください。');
        }
        if (typeof navigator !== 'undefined' && navigator.serviceWorker
            && (window.location?.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(window.location?.hostname))) {
            navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' })
                .catch(error => console.warn('Offline cache registration failed:', error));
        }
    });
})();
