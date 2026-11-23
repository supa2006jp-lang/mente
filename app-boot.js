(function () {
    const featureSources = {
        fiveS: 'app-five-s-management.js?v=20261116-image4',
        search: 'app-unified-search.js?v=20261115-data6',
        photoExport: 'app-photo-export.js?v=20261115-workspace6',
        notebook: 'app-shift-notebook-core.js?v=20261124-palette2',
        photos: 'app-photo-manager.js?v=20261123-foil1',
        camera: 'app-shift-photo-camera.js?v=20260906-avatar-stage72',
        reveal: 'app-shift-photo-reveal.js?v=20260906-avatar-stage72',
        avatar: 'app-shift-avatar-conversation.js?v=20260906-avatar-stage72'
    };
    const dependencies = { notebook: ['fiveS', 'search'], photos: ['photoExport'] };
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
                Promise.all((dependencies[feature] || []).map(loadScript)).then(() => {
                    loaded[feature] = true;
                    resolve();
                }, reject);
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
    loadNotebook.ready = () => loaded.notebook;
    loadPhotos.ready = () => photoFeaturesReady;
    loadNotebookAndPhotos.ready = () => loaded.notebook && photoFeaturesReady;
    loadPhotoEffects.ready = () => loaded.notebook && photoFeaturesReady && loaded.camera && loaded.reveal && loaded.avatar;
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
            const entrypoint = MaintenanceApp.prototype[name];
            const original = entrypoint?.getLoadedImplementation?.() || entrypoint;
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
        let implementation = null;
        const placeholder = function (...args) {
            if (implementation && loader.ready?.()) return implementation.apply(this, args);
            if (viewId) {
                setViewBusy(viewId, true);
                showFeatureStatus(viewId, '読み込み中…');
            }
            return loader().then(() => {
                const method = implementation;
                if (typeof method !== 'function') throw new Error(`${name} を読み込めませんでした`);
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
        placeholder.getLoadedImplementation = () => implementation;
        // Keep the loading gate even when one split file has already installed its
        // methods. A failed sibling must remain retryable on the next click.
        Object.defineProperty(MaintenanceApp.prototype, name, {
            configurable: true,
            get: () => placeholder,
            set: method => { if (method !== placeholder) implementation = method; }
        });
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

    function setupServiceWorkerUpdates(registration) {
        let banner = null;
        let messageNode = null;
        let updateButton = null;
        let reloadAfterActivation = false;
        let hadController = !!navigator.serviceWorker.controller;
        let updating = false;
        const pageBuild = document.querySelector?.('meta[name="maintenance-build"]')?.content || '';
        let quietActivation = null;
        const workerBuilds = new WeakMap();
        const getWorkerBuild = worker => {
            if (!worker || !pageBuild || typeof MessageChannel === 'undefined') return Promise.resolve(null);
            if (workerBuilds.has(worker)) return workerBuilds.get(worker);
            const result = new Promise(resolve => {
                const channel = new MessageChannel();
                let timer;
                const finish = build => {
                    clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(build);
                };
                timer = setTimeout(() => finish(null), 2000);
                channel.port1.onmessage = event => finish(event.data?.type === 'MAINTENANCE_VERSION' ? event.data.build : null);
                try { worker.postMessage({ type: 'MAINTENANCE_GET_VERSION' }, [channel.port2]); }
                catch (_) { finish(null); }
            });
            workerBuilds.set(worker, result);
            return result;
        };
        const clearBanner = () => { banner?.remove(); banner = null; };

        const pendingEditorMessage = () => {
            try {
                const app = window.app;
                if (app?._safeEditBusy || app?._modalSaveInProgress) return '保存中です。完了してから更新してください。';
                if (document.getElementById('kt-todo-modal-overlay')) return 'ToDoの入力画面が開いています。保存または下書き保存を確認し、画面を閉じてから更新してください。';
                if (app?._calendarMemoEditor) return '日別メモの入力画面が開いています。保存して画面を閉じてから更新してください。';
                if (app?.hasUnsavedTipsDraft?.()) {
                    return '未保存のTIPSがあります。保存するか入力をクリアしてから更新してください。';
                }
                if (app?.isTipsBodyEditorDirty?.()) {
                    return 'TIPS本文の編集中です。保存するか編集を閉じてから更新してください。';
                }
                const modal = document.getElementById('modal-overlay');
                if (modal && !modal.classList.contains('hidden')) {
                    return app?.hasModalUnsavedChanges?.() || app?._saveStatusState === 'dirty'
                        ? '入力画面に未保存の内容があります。保存して画面を閉じてから更新してください。'
                        : '入力画面が開いています。画面を閉じてから更新してください。';
                }
            } catch (error) {
                console.warn('Could not check pending edits before update:', error);
                return '入力中の内容を確認できませんでした。画面を確認してから更新してください。';
            }
            return null;
        };

        const showBanner = (message = '新しい版を利用できます。入力中の内容を保存してから更新してください。') => {
            if (!banner) {
                banner = document.createElement('aside');
                banner.id = 'maintenance-update-banner';
                banner.setAttribute('role', 'status');
                banner.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:10000;max-width:min(420px,calc(100vw - 32px));padding:14px 16px;border:1px solid #64748b;border-radius:10px;background:#0f172a;color:#fff;box-shadow:0 8px 24px #0005;display:flex;gap:10px;align-items:center;flex-wrap:wrap;';
                messageNode = document.createElement('span');
                messageNode.style.cssText = 'flex:1 1 100%;font-size:14px;';
                updateButton = document.createElement('button');
                updateButton.type = 'button';
                updateButton.style.cssText = 'padding:8px 12px;border:0;border-radius:6px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer;';
                updateButton.addEventListener('click', async () => {
                    if (updating) return;
                    const pendingBefore = pendingEditorMessage();
                    if (pendingBefore) {
                        messageNode.textContent = pendingBefore;
                        return;
                    }
                    if (!confirm('最新版に更新してページを再読み込みします。入力途中の内容は保存してから続けてください。更新しますか？')) return;
                    updating = true;
                    updateButton.disabled = true;
                    messageNode.textContent = '保存待ちの処理と未保存の入力を確認しています…';
                    try {
                        await store.waitForSaveQueueIdle?.();
                        if (store._saveRequestedRevision > store._savePersistedRevision) {
                            throw new Error('保存に失敗した変更があります。保存状態を確認してから更新してください。');
                        }
                        const pendingAfter = pendingEditorMessage();
                        if (pendingAfter) throw new Error(pendingAfter);
                        if (registration.waiting) {
                            reloadAfterActivation = true;
                            registration.waiting.postMessage({ type: 'MAINTENANCE_ACTIVATE_UPDATE' });
                            messageNode.textContent = '更新を適用しています…';
                        } else {
                            window.location.reload();
                        }
                    } catch (error) {
                        reloadAfterActivation = false;
                        messageNode.textContent = error?.message || '更新の準備ができませんでした。';
                        updateButton.disabled = false;
                        updating = false;
                    }
                });
                const laterButton = document.createElement('button');
                laterButton.type = 'button';
                laterButton.textContent = 'あとで';
                laterButton.setAttribute('aria-label', '更新案内を閉じる');
                laterButton.style.cssText = 'padding:8px 10px;border:1px solid #94a3b8;border-radius:6px;background:transparent;color:#fff;cursor:pointer;';
                laterButton.addEventListener('click', () => {
                    banner.remove();
                    banner = null;
                });
                banner.append(messageNode, updateButton, laterButton);
            }
            messageNode.textContent = message;
            updateButton.textContent = registration.waiting ? '更新して再読み込み' : '再読み込み';
            document.body.appendChild(banner);
        };
        const showWaiting = async () => {
            const waiting = registration.waiting;
            if (!waiting || !navigator.serviceWorker.controller) return;
            const build = pageBuild ? await getWorkerBuild(waiting) : null;
            if (registration.waiting !== waiting) return;
            if (build && build === pageBuild) {
                clearBanner();
                // A normal reload already loaded this build. Align its offline worker
                // without forcing another reload or interrupting an editor.
                if (!pendingEditorMessage() && store._saveRequestedRevision <= store._savePersistedRevision) {
                    quietActivation = waiting;
                    waiting.postMessage({ type: 'MAINTENANCE_ACTIVATE_UPDATE' });
                }
                return;
            }
            showBanner();
        };

        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data?.type !== 'MAINTENANCE_UPDATE_OTHER_TABS') return;
            if (event.source === quietActivation) return;
            reloadAfterActivation = false;
            updating = false;
            showBanner('別のタブでも開いています。そちらを閉じてから更新してください。');
            updateButton.disabled = false;
        });
        navigator.serviceWorker.addEventListener('controllerchange', async () => {
            if (reloadAfterActivation) {
                const pending = pendingEditorMessage();
                if (pending) {
                    reloadAfterActivation = false;
                    updating = false;
                    showBanner(pending);
                    updateButton.disabled = false;
                    return;
                }
                window.location.reload();
                return;
            }
            const controller = navigator.serviceWorker.controller;
            const build = pageBuild ? await getWorkerBuild(controller) : null;
            if (navigator.serviceWorker.controller !== controller) return;
            if (build && build === pageBuild) clearBanner();
            else if (hadController) showBanner('更新の準備ができました。入力中の内容を保存してから再読み込みしてください。');
            hadController = true;
        });
        const trackInstalling = installing => {
            if (!installing) return;
            if (installing.state === 'installed') showWaiting();
            else installing.addEventListener('statechange', () => {
                if (installing.state === 'installed') showWaiting();
            });
        };
        registration.addEventListener('updatefound', () => trackInstalling(registration.installing));
        trackInstalling(registration.installing);
        showWaiting();
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
                .then(setupServiceWorkerUpdates)
                .catch(error => console.warn('Offline cache registration failed:', error));
        }
    });
})();
