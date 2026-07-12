(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppSettingsMethods extends MaintenanceApp {
    getAppSettingsIssueBadges() {
        const health = this.getDataHealthCheckReport?.() || { totalIssues: 0 };
        const storage = this.getStorageManagementReport?.() || {};
        const diagnostics = this.getScheduledDataDiagnosticsReport?.() || { issueCount: 0 };
        const fix = this.getDataFixCenterSummary?.() || { total: 0 };
        const storageAttention = (storage.unusedCount || 0)
            + (storage.trashCount || 0)
            + (storage.originalSummary?.count || 0)
            + ((storage.images?.duplicateBytes || 0) > 0 ? 1 : 0);
        return {
            health: health.totalIssues || 0,
            fix: fix.total || 0,
            storage: storageAttention,
            diagnostics: diagnostics.issueCount || 0,
            log: (store.activeData.systemActivityLogs || []).filter(log => log.restoreAction || log.level === 'warning').length
        };
    }

    getAppSettingsBadgeHtml(count, label = '確認') {
        const value = Number(count) || 0;
        if (!value) return '';
        return `<em class="app-settings-issue-badge">${value}${this.escapeHtml(label)}</em>`;
    }

    openAppSettingsPanel() {
        const badges = this.getAppSettingsIssueBadges();
        document.getElementById('app-settings-overlay')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="app-settings-overlay" class="shift-settings-overlay" data-action="close-app-settings-if-backdrop">
                <div class="shift-settings-card app-settings-card">
                    <div class="shift-settings-header">
                        <div>
                            <span>設定メニュー</span>
                            <p>部署・連絡帳・ToDo・表示・データ入出力をまとめて開けます</p>
                        </div>
                        <button type="button" data-action="close-app-settings" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="shift-settings-grid">
                        <button type="button" data-action="app-settings-open-departments">
                            <i class="fa-solid fa-building"></i><span>部署設定</span><small>部署の切替・登録・データ管理</small>
                        </button>
                        <button type="button" data-action="app-settings-open-members">
                            <i class="fa-solid fa-users-gear"></i><span>連絡帳 人名管理</span><small>基幹社員・サポート社員・班を管理</small>
                        </button>
                        <button type="button" data-action="app-settings-open-row-templates">
                            <i class="fa-solid fa-list-check"></i><span>連絡帳テンプレート</span><small>行テンプレートと行セットを管理</small>
                        </button>
                        <button type="button" data-action="app-settings-open-todo-requests">
                            <i class="fa-solid fa-clipboard-list"></i><span>ToDo依頼管理</span><small>未完了依頼・期限切れ・担当者別一覧</small>
                        </button>
                        <button type="button" data-action="app-settings-open-activity-log">
                            <i class="fa-solid fa-clock-rotate-left"></i><span>操作ログ${this.getAppSettingsBadgeHtml(badges.log, '注意')}</span><small>ToDo操作と最近のメンテ記録を確認</small>
                        </button>
                        <button type="button" onclick="app.closeAppSettingsPanel(); app.openDataHealthCheckPanel()">
                            <i class="fa-solid fa-heart-pulse"></i><span>保存データ健康診断${this.getAppSettingsBadgeHtml(badges.health)}</span><small>未設定・文字化け・名寄せ候補をまとめて確認</small>
                        </button>
                        <button type="button" onclick="app.closeAppSettingsPanel(); app.openDataFixCenterPanel()">
                            <i class="fa-solid fa-screwdriver-wrench"></i><span>未入力・未設定の集中修正${this.getAppSettingsBadgeHtml(badges.fix)}</span><small>原因・処置・単価・名寄せ候補を1画面で確認</small>
                        </button>
                        <button type="button" onclick="app.closeAppSettingsPanel(); app.openStorageManagementCenter()">
                            <i class="fa-solid fa-hard-drive"></i><span>容量管理センター${this.getAppSettingsBadgeHtml(badges.storage)}</span><small>写真・ゴミ箱・元画像・JSON容量を確認して整理</small>
                        </button>
                        <button type="button" onclick="app.closeAppSettingsPanel(); app.openScheduledDataDiagnosticsPanel(true)">
                            <i class="fa-solid fa-stethoscope"></i><span>画像・関連データ診断${this.getAppSettingsBadgeHtml(badges.diagnostics)}</span><small>孤立・重複・壊れた関連付けを自動検出</small>
                        </button>
                        <button type="button" data-action="app-settings-export-data">
                            <i class="fa-solid fa-download"></i><span>データ出力</span><small>バックアップ用に現在データを書き出し</small>
                        </button>
                    </div>
                </div>
            </div>
        `);
    }

    getStorageManagementReport() {
        const analysis = this.getBackupExportAnalysis?.('all') || {
            images: store.analyzeImageStorage(store.data),
            rawJsonBytes: new Blob([JSON.stringify(store.data)]).size,
            originalSummary: store.getRemovableOriginalImageSummary(store.data),
            unusedCount: 0,
            unusedBytes: 0
        };
        const trash = Object.values(store.data.deptData || {}).flatMap(data => data.photoManagerTrash || []);
        const trashBytes = trash.reduce((sum, item) => sum + store.estimateDataUrlBytes(item?.src || ''), 0);
        return { ...analysis, trashCount: trash.length, trashBytes };
    }

    getStorageImageStats(value) {
        let count = 0;
        let bytes = 0;
        const visit = (node) => {
            if (store.isImageDataUrl?.(node)) {
                count += 1;
                bytes += store.estimateDataUrlBytes?.(node) || 0;
                return;
            }
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) {
                node.forEach(visit);
                return;
            }
            Object.values(node).forEach(visit);
        };
        visit(value);
        return { count, bytes };
    }

    getStoragePhotoManagerDuplicateSummary() {
        const groups = typeof this.getPhotoManagerDuplicateGroups === 'function'
            ? this.getPhotoManagerDuplicateGroups()
            : [];
        const bytes = groups.reduce((sum, group) => {
            const items = group.items || [];
            const oneBytes = store.estimateDataUrlBytes?.(group.src || items[0]?.src || '') || 0;
            return sum + Math.max(0, items.length - 1) * oneBytes;
        }, 0);
        return {
            groups: groups.length,
            items: groups.reduce((sum, group) => sum + Math.max(0, (group.items || []).length - 1), 0),
            bytes
        };
    }

    collectStorageGuideRevisionCleanupTargets(keepCount = 0) {
        const limit = Math.max(0, Number(keepCount) || 0);
        const targets = [];
        Object.entries(store.data.deptData || {}).forEach(([deptId, deptData]) => {
            (deptData.history || []).forEach((history, historyIndex) => {
                const revisions = history?.guide?.revisions;
                if (!Array.isArray(revisions) || revisions.length <= limit) return;
                const removeCount = revisions.length - limit;
                const removable = revisions.slice(0, removeCount);
                const stats = this.getStorageImageStats(removable);
                targets.push({
                    deptId,
                    historyIndex,
                    history,
                    total: revisions.length,
                    removeCount,
                    keepCount: limit,
                    imageCount: stats.count,
                    bytes: stats.bytes
                });
            });
        });
        return targets;
    }

    getStorageGuideRevisionCleanupSummary(keepCount = 0) {
        const targets = this.collectStorageGuideRevisionCleanupTargets(keepCount);
        return {
            keepCount: Math.max(0, Number(keepCount) || 0),
            targets,
            histories: targets.length,
            revisions: targets.reduce((sum, target) => sum + target.removeCount, 0),
            images: targets.reduce((sum, target) => sum + target.imageCount, 0),
            bytes: targets.reduce((sum, target) => sum + target.bytes, 0)
        };
    }

    collectStorageGuideImageCompressionItems() {
        const items = [];
        Object.entries(store.data.deptData || {}).forEach(([deptId, deptData]) => {
            (deptData.history || []).forEach((history, historyIndex) => {
                const photos = history?.guide?.photos;
                if (!Array.isArray(photos)) return;
                photos.forEach((rawPhoto, photoIndex) => {
                    const photo = this.normalizeGuidePhoto?.(rawPhoto) || (typeof rawPhoto === 'string' ? { src: rawPhoto } : rawPhoto);
                    if (!store.isImageDataUrl?.(photo?.src)) return;
                    items.push({
                        deptId,
                        historyIndex,
                        photoIndex,
                        history,
                        photo,
                        src: photo.src,
                        bytes: this.estimateGuideImageDataUrlBytes?.(photo.src) || store.estimateDataUrlBytes?.(photo.src) || 0,
                        title: history?.guide?.title || history?.errorContent || history?.cause || history?.date || '手順書'
                    });
                });
            });
        });
        return items.sort((a, b) => b.bytes - a.bytes);
    }

    async buildStorageGuideImageCompressionPlan(preset = this.getGuideImageCompressionPreset?.() || 'standard') {
        const presets = this.getGuideImageCompressionPresetOptions?.() || {};
        const options = presets[preset] || this.getGuideImageCompressionOptions?.() || { maxEdge: 1600, quality: 0.82 };
        const items = this.collectStorageGuideImageCompressionItems();
        const results = [];
        for (const item of items) {
            const result = await this.compressGuideImageDataUrl(item.src, options);
            if (!result.changed) continue;
            results.push({
                ...item,
                preset: options.key || preset,
                maxEdge: options.maxEdge,
                beforeBytes: result.beforeBytes,
                afterBytes: result.afterBytes,
                savedBytes: Math.max(0, result.beforeBytes - result.afterBytes),
                nextSrc: result.src,
                convertsPng: item.src.startsWith('data:image/png') && result.src.startsWith('data:image/jpeg')
            });
        }
        return {
            preset: options.key || preset,
            label: options.label || '標準',
            maxEdge: options.maxEdge,
            quality: options.quality,
            scanned: items.length,
            beforeBytes: items.reduce((sum, item) => sum + item.bytes, 0),
            afterBytes: items.reduce((sum, item) => sum + item.bytes, 0) - results.reduce((sum, item) => sum + item.savedBytes, 0),
            savedBytes: results.reduce((sum, item) => sum + item.savedBytes, 0),
            items: results
        };
    }

    openStorageManagementCenter() {
        const report = this.getStorageManagementReport();
        const categories = report.images?.categories || {};
        const labels = {
            library: '写真管理', history: '履歴・手順書', notebook: '連絡帳・5S',
            originals: '編集用の元画像', recent: '最近使った画像', trash: 'ゴミ箱', other: 'その他'
        };
        const rows = ['library', 'history', 'notebook', 'originals', 'recent', 'trash', 'other'].map(key => {
            const item = categories[key] || { count: 0, bytes: 0 };
            const ratio = report.images.embeddedBytes ? Math.max(1, Math.round(item.bytes / report.images.embeddedBytes * 100)) : 0;
            return `
                <div class="storage-center-row">
                    <div><b>${labels[key]}</b><span>${item.count}件</span></div>
                    <div class="storage-center-meter"><i style="width:${Math.min(100, ratio)}%"></i></div>
                    <strong>${this.formatExportBytes?.(item.bytes) || item.bytes + 'B'}</strong>
                </div>`;
        }).join('');
        const duplicateReport = this.getStorageDuplicateReviewReport(store.data);
        const photoDuplicate = this.getStoragePhotoManagerDuplicateSummary();
        const revisionCleanup = this.getStorageGuideRevisionCleanupSummary(0);
        this.openModal('storage-management-center', '容量管理センター', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="storage-center-panel">
                    <div class="storage-center-summary">
                        <div><i class="fa-solid fa-file-code"></i><span>現在のJSON</span><b>${this.formatExportBytes(report.rawJsonBytes)}</b></div>
                        <div><i class="fa-solid fa-images"></i><span>画像の実容量</span><b>${this.formatExportBytes(report.images.embeddedBytes)}</b></div>
                        <div><i class="fa-solid fa-trash-can"></i><span>削除できる重複</span><b>${photoDuplicate.groups}組</b><small>写真管理 約${this.formatExportBytes(photoDuplicate.bytes)}</small></div>
                        <div><i class="fa-solid fa-feather-pointed"></i><span>出力で軽量化</span><b>${this.formatExportBytes(duplicateReport.activeBytes)}</b><small>同一画像を1回だけ格納</small></div>
                        <div><i class="fa-solid fa-clock-rotate-left"></i><span>古い版履歴</span><b>${this.formatExportBytes(revisionCleanup.bytes)}</b><small>${revisionCleanup.histories}件 / ${revisionCleanup.revisions}版</small></div>
                    </div>
                    <div class="storage-center-list">${rows}</div>
                    <div class="storage-center-actions">
                        <button type="button" onclick="app.closeModal(); app.openUnusedImagesFromBackup?.()"><i class="fa-solid fa-image-circle-xmark"></i><b>未使用画像を確認</b><span>${report.unusedCount}件 / 約${this.formatExportBytes(report.unusedBytes)}</span></button>
                        <button type="button" onclick="app.openStorageDuplicateReviewFromCenter()"><i class="fa-solid fa-trash-can"></i><b>写真管理の重複削除候補</b><span>${photoDuplicate.groups}組 / 削除前に残す写真を選択</span></button>
                        <button type="button" onclick="app.openStorageEmbeddedDuplicateReview()"><i class="fa-solid fa-clone"></i><b>JSON内の同一画像を確認</b><span>画面上の写真削除ではなく出力軽量化用</span></button>
                        <button type="button" onclick="app.openStorageGuideRevisionCleanupReview(0)"><i class="fa-solid fa-clock-rotate-left"></i><b>古い手順書バージョンを削除</b><span>最新版のみ残す / 約${this.formatExportBytes(revisionCleanup.bytes)}</span></button>
                        <button type="button" onclick="app.openStorageGuideImageCompressionReview()"><i class="fa-solid fa-gauge-high"></i><b>既存手順書画像を軽量化</b><span>実行前に削減見込みを確認</span></button>
                        <button type="button" onclick="app.closeModal(); app.openPhotoManagerTrashDialog?.()"><i class="fa-solid fa-trash-restore"></i><b>ゴミ箱を確認</b><span>${report.trashCount}件 / 約${this.formatExportBytes(report.trashBytes)}</span></button>
                        <button type="button" onclick="app.confirmRemoveStoredOriginalImages?.('all')"><i class="fa-solid fa-layer-group"></i><b>編集用元画像を整理</b><span>${report.originalSummary.count}件 / 約${this.formatExportBytes(report.originalSummary.bytes)}</span></button>
                        <button type="button" onclick="app.closeModal(); app.openScheduledDataDiagnosticsPanel(true)"><i class="fa-solid fa-stethoscope"></i><b>データ診断</b><span>孤立・参照切れを確認</span></button>
                        <button type="button" onclick="app.closeModal(); app.openBackupExportModal?.('all')"><i class="fa-solid fa-feather-pointed"></i><b>軽量JSONを出力</b><span>同一画像を1回だけ格納</span></button>
                    </div>
                    <p class="storage-center-note"><i class="fa-solid fa-shield-halved"></i> 削除操作は各確認画面を開きます。ここを開いただけではデータは削除されません。</p>
                </div>`;
            const footer = document.querySelector('.modal-footer');
            if (footer) footer.innerHTML = '<button class="secondary-btn" onclick="app.closeModal()">閉じる</button>';
        });
    }

    openStorageActionUnavailable(title = '確認画面を開けませんでした', message = '必要な機能を読み込めませんでした。', details = []) {
        this.openModal('storage-action-unavailable', title, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="storage-duplicate-panel">
                    <div class="storage-duplicate-summary storage-duplicate-summary-warning">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <div>
                            <b>${this.escapeHtml(message)}</b>
                            <span>対象なし・読み込み未完了・機能ファイル未読込のどれかを下に表示します。</span>
                        </div>
                        <strong>確認</strong>
                    </div>
                    <div class="storage-state-list">
                        ${(details.length ? details : ['ページを再読み込みしてからもう一度開いてください。']).map(detail => `<div><i class="fa-solid fa-circle-info"></i><span>${this.escapeHtml(detail)}</span></div>`).join('')}
                    </div>
                </div>`;
            const footer = document.querySelector('.modal-footer');
            if (footer) footer.innerHTML = '<button class="secondary-btn" onclick="app.openStorageManagementCenter()">容量管理へ戻る</button><button class="secondary-btn" onclick="app.closeModal()">閉じる</button>';
        });
    }

    loadPhotoManagerMethodsForStorageCenter() {
        if (typeof this.openPhotoManagerDuplicateReview === 'function') return Promise.resolve(true);
        if (this._photoManagerMethodLoadPromise) return this._photoManagerMethodLoadPromise;
        this._photoManagerMethodLoadPromise = new Promise(resolve => {
            const script = document.createElement('script');
            script.src = `app-photo-manager.js?v=20260710-storage-duplicate-review-fix-${Date.now()}`;
            script.onload = () => resolve(typeof this.openPhotoManagerDuplicateReview === 'function');
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
        }).finally(() => {
            this._photoManagerMethodLoadPromise = null;
        });
        return this._photoManagerMethodLoadPromise;
    }

    async openStorageDuplicateReviewFromCenter() {
        await this.loadPhotoManagerMethodsForStorageCenter();
        const report = this.getStorageManagementReport();
        if (typeof this.openPhotoManagerDuplicateReview !== 'function') {
            this.openStorageActionUnavailable('写真管理の重複削除候補', '写真管理の重複整理画面を読み込めませんでした。', [
                '機能ファイル未読込: app-photo-manager.js の読み込みに失敗した可能性があります。',
                `代わりにJSON内の同一画像は確認できます: 約${this.formatExportBytes(this.getStorageDuplicateReviewReport(store.data).activeBytes)}`
            ]);
            return;
        }
        const groups = typeof this.getPhotoManagerDuplicateGroups === 'function'
            ? this.getPhotoManagerDuplicateGroups()
            : [];
        if (!groups.length) {
            this.openStorageActionUnavailable('写真管理の重複削除候補', '削除対象にできる写真管理内の重複はありません。', [
                '対象なし: 写真管理で同じ画像を複数持っている項目は見つかりませんでした。',
                `JSON内の同一画像: 約${this.formatExportBytes(this.getStorageDuplicateReviewReport(store.data).activeBytes)}`,
                `手順書の版履歴: 約${this.formatExportBytes(this.getStorageDuplicateReviewReport(store.data).revisionBytes)}`
            ]);
            return;
        }
        this.closeModal?.();
        setTimeout(() => {
            try {
                this.openPhotoManagerDuplicateReview();
            } catch (error) {
                console.error(error);
                this.openStorageActionUnavailable('写真管理の重複削除候補', '重複画像の確認画面を開けませんでした。', [
                    `エラー発生: ${error?.message || '詳細不明'}`,
                    'ページを再読み込みしてからもう一度開いてください。'
                ]);
            }
        }, 60);
    }

    isStorageRevisionPath(path = []) {
        return path.join('.').includes('.guide.revisions.');
    }

    collectStorageDuplicateImageGroups(value = store.data, options = {}) {
        const includeRevisions = options.includeRevisions === true;
        const groups = new Map();
        const visit = (node, path = []) => {
            if (store.isImageDataUrl?.(node)) {
                if (!includeRevisions && this.isStorageRevisionPath(path)) return;
                if (!groups.has(node)) groups.set(node, []);
                groups.get(node).push({
                    path: path.join('.'),
                    category: store.getImageStorageCategory?.(path, path[path.length - 1] || '') || 'other',
                    revision: this.isStorageRevisionPath(path),
                    bytes: store.estimateDataUrlBytes?.(node) || 0
                });
                return;
            }
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) {
                node.forEach((item, index) => visit(item, [...path, String(index)]));
                return;
            }
            Object.entries(node).forEach(([key, child]) => visit(child, [...path, key]));
        };
        visit(value);
        return Array.from(groups.entries())
            .map(([src, entries]) => ({
                src,
                entries,
                count: entries.length,
                bytes: entries[0]?.bytes || 0,
                duplicateBytes: Math.max(0, (entries.length - 1) * (entries[0]?.bytes || 0)),
                categories: [...new Set(entries.map(entry => entry.category))]
            }))
            .filter(group => group.count > 1)
            .sort((a, b) => b.duplicateBytes - a.duplicateBytes || b.count - a.count);
    }

    getStorageDuplicateReviewReport(value = store.data) {
        const activeGroups = this.collectStorageDuplicateImageGroups(value, { includeRevisions: false });
        const allGroups = this.collectStorageDuplicateImageGroups(value, { includeRevisions: true });
        const activeBytes = activeGroups.reduce((sum, group) => sum + group.duplicateBytes, 0);
        const allBytes = allGroups.reduce((sum, group) => sum + group.duplicateBytes, 0);
        return {
            activeGroups,
            allGroups,
            activeBytes,
            allBytes,
            revisionBytes: Math.max(0, allBytes - activeBytes),
            revisionGroups: allGroups.filter(group => group.entries.some(entry => entry.revision))
        };
    }

    getStorageDuplicateCategoryLabel(category = '') {
        return {
            library: '写真管理',
            history: '履歴・手順書',
            notebook: '連絡帳・5S',
            originals: '編集用の元画像',
            recent: '最近使った画像',
            trash: 'ゴミ箱',
            other: 'その他'
        }[category] || 'その他';
    }

    async openStorageGuideImageCompressionReview(preset = this.getGuideImageCompressionPreset?.() || 'standard') {
        this.openModal('storage-guide-image-compression', '既存手順書画像の軽量化', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="storage-duplicate-panel">
                    <div class="storage-duplicate-summary">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        <div>
                            <b>既存の手順書画像を確認しています</b>
                            <span>画像を読み込み、圧縮後のサイズ見込みを計算しています。</span>
                        </div>
                        <strong>計算中</strong>
                    </div>
                </div>`;
            const footer = document.querySelector('.modal-footer');
            if (footer) footer.innerHTML = '<button class="secondary-btn" onclick="app.openStorageManagementCenter()">容量管理へ戻る</button>';
        });
        const plan = await this.buildStorageGuideImageCompressionPlan(preset);
        this._storageGuideImageCompressionPlan = plan;
        this.renderStorageGuideImageCompressionReview(plan);
    }

    renderStorageGuideImageCompressionReview(plan) {
        const content = document.getElementById('modal-content');
        if (!content) return;
        const presetHtml = (() => {
            const presets = Object.values(this.getGuideImageCompressionPresetOptions?.() || {});
            return `
                <div class="storage-revision-options">
                    ${presets.map(option => `
                        <button type="button" class="${plan.preset === option.key ? 'active' : ''}" onclick="app.openStorageGuideImageCompressionReview('${option.key}')">
                            <b>${this.escapeHtml(option.label)}</b><span>長辺${option.maxEdge}px / 品質${Math.round(option.quality * 100)}%</span>
                        </button>
                    `).join('')}
                </div>
            `;
        })();
        if (!plan.items.length) {
            content.innerHTML = `
                <div class="storage-duplicate-panel">
                    <div class="storage-duplicate-summary">
                        <i class="fa-solid fa-circle-check"></i>
                        <div>
                            <b>軽量化できる既存画像はありません</b>
                            <span>${plan.scanned}件を確認しました。現在の設定では、置き換えても小さくなる画像は見つかりませんでした。</span>
                        </div>
                        <strong>0B</strong>
                    </div>
                    ${presetHtml}
                </div>`;
        } else {
            const before = this.formatExportBytes(plan.beforeBytes);
            const after = this.formatExportBytes(plan.afterBytes);
            content.innerHTML = `
                <div class="storage-duplicate-panel">
                    <div class="storage-duplicate-summary">
                        <i class="fa-solid fa-gauge-high"></i>
                        <div>
                            <b>既存の手順書画像を軽量化できます</b>
                            <span>${plan.label}設定で ${before} → ${after}。透過なしPNGは確認後にJPEG化します。</span>
                        </div>
                        <strong>${this.formatExportBytes(plan.savedBytes)}</strong>
                    </div>
                    ${presetHtml}
                    <div class="storage-state-list storage-revision-stats">
                        <div><i class="fa-solid fa-image"></i><span>確認画像 ${plan.scanned}件</span></div>
                        <div><i class="fa-solid fa-compress"></i><span>軽量化対象 ${plan.items.length}件</span></div>
                        <div><i class="fa-solid fa-file-arrow-down"></i><span>${before} → ${after}</span></div>
                    </div>
                    <div class="storage-duplicate-note"><i class="fa-solid fa-shield-halved"></i> 実行前に対象を確認してください。画像の記号・印刷サイズは保持します。</div>
                    <div class="storage-duplicate-list">
                        ${plan.items.slice(0, 40).map(item => `
                            <article class="storage-image-compress-item">
                                <img src="${item.src}" alt="手順書画像">
                                <div>
                                    <b>${this.escapeHtml(item.title)}</b>
                                    <span>${this.formatExportBytes(item.beforeBytes)} → ${this.formatExportBytes(item.afterBytes)} / 削減 ${this.formatExportBytes(item.savedBytes)}</span>
                                    <small>${this.escapeHtml(item.history?.date || '')}${item.convertsPng ? ' / 透過なしPNGをJPEG化' : ''}</small>
                                </div>
                            </article>
                        `).join('')}
                    </div>
                </div>`;
        }
        const footer = document.querySelector('.modal-footer');
        if (footer) {
            footer.innerHTML = plan.items.length
                ? `<button class="secondary-btn" onclick="app.openStorageManagementCenter()">容量管理へ戻る</button>
                   <button class="primary-btn" onclick="app.applyStorageGuideImageCompression()"><i class="fa-solid fa-gauge-high"></i> 既存画像を軽量化</button>
                   <button class="secondary-btn" onclick="app.closeModal()">閉じる</button>`
                : '<button class="secondary-btn" onclick="app.openStorageManagementCenter()">容量管理へ戻る</button><button class="secondary-btn" onclick="app.closeModal()">閉じる</button>';
        }
    }

    applyStorageGuideImageCompression() {
        const plan = this._storageGuideImageCompressionPlan;
        if (!plan?.items?.length) {
            this.openStorageGuideImageCompressionReview();
            return;
        }
        const ok = window.confirm(`既存の手順書画像${plan.items.length}件を軽量化します。\n見込み: ${this.formatExportBytes(plan.beforeBytes)} → ${this.formatExportBytes(plan.afterBytes)}\n実行しますか？`);
        if (!ok) return;
        let changed = 0;
        let savedBytes = 0;
        plan.items.forEach(item => {
            const photos = store.data.deptData?.[item.deptId]?.history?.[item.historyIndex]?.guide?.photos;
            if (!Array.isArray(photos)) return;
            const current = this.normalizeGuidePhoto?.(photos[item.photoIndex]) || photos[item.photoIndex];
            if (!current?.src || current.src !== item.src) return;
            photos[item.photoIndex] = { ...current, src: item.nextSrc };
            changed += 1;
            savedBytes += item.savedBytes;
        });
        store.save?.();
        this.showToast?.(`既存手順書画像${changed}件を約${this.formatExportBytes(savedBytes)}軽量化しました`, 'success');
        if (store.activeData) {
            store.activeData.systemActivityLogs = store.activeData.systemActivityLogs || [];
            store.activeData.systemActivityLogs.unshift({
                id: `guide_image_compress_${Date.now()}`,
                at: new Date().toISOString(),
                level: 'info',
                title: '既存手順書画像を軽量化',
                detail: `${changed}件 / 約${this.formatExportBytes(savedBytes)}削減 / 設定: ${plan.label}`
            });
            store.save?.();
        }
        this._storageGuideImageCompressionPlan = null;
        this.openStorageManagementCenter();
    }

    openStorageGuideRevisionCleanupReview(keepCount = 0) {
        const summary = this.getStorageGuideRevisionCleanupSummary(keepCount);
        const options = [
            { count: 0, title: '最新版のみ', note: '古い版を保存しない' },
            { count: 1, title: '直前1版', note: '保険を少し残す' },
            { count: 3, title: '直近3版', note: '変更ログ重視' }
        ].map(option => `
            <button type="button" class="${summary.keepCount === option.count ? 'active' : ''}" onclick="app.openStorageGuideRevisionCleanupReview(${option.count})">
                <b>${this.escapeHtml(option.title)}</b><span>${this.escapeHtml(option.note)}</span>
            </button>
        `).join('');
        this.openModal('storage-guide-revision-cleanup', '手順書の版履歴を整理', () => {
            const content = document.getElementById('modal-content');
            if (!summary.targets.length) {
                content.innerHTML = `
                    <div class="storage-duplicate-panel">
                        <div class="storage-duplicate-summary">
                            <i class="fa-solid fa-circle-check"></i>
                            <div>
                                <b>整理できる古い版履歴はありません</b>
                                <span>${summary.keepCount === 0 ? '現在は最新版だけを保持しています。' : `各手順書の版履歴は、直近${summary.keepCount}版以内に収まっています。`}</span>
                            </div>
                            <strong>0B</strong>
                        </div>
                        <div class="storage-revision-options">${options}</div>
                    </div>`;
                const footer = document.querySelector('.modal-footer');
                if (footer) footer.innerHTML = '<button class="secondary-btn" onclick="app.openStorageManagementCenter()">容量管理へ戻る</button><button class="secondary-btn" onclick="app.closeModal()">閉じる</button>';
                return;
            }
            content.innerHTML = `
                <div class="storage-duplicate-panel">
                    <div class="storage-duplicate-summary">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <div>
                            <b>古い手順書の版履歴を整理します</b>
                            <span>現在の手順書は残し、${summary.keepCount === 0 ? '古いバージョンはすべて削除します。' : `各手順書の直近${summary.keepCount}版だけを残します。`}実行前に対象と削減見込みを確認してください。</span>
                        </div>
                        <strong>${this.formatExportBytes(summary.bytes)}</strong>
                    </div>
                    <div class="storage-revision-options">${options}</div>
                    <div class="storage-duplicate-note"><i class="fa-solid fa-shield-halved"></i> 実行すると古い版履歴はデータから外れます。必要なら先に「データ出力」でバックアップしてください。</div>
                    <div class="storage-state-list storage-revision-stats">
                        <div><i class="fa-solid fa-book-open"></i><span>対象手順書 ${summary.histories}件</span></div>
                        <div><i class="fa-solid fa-clock-rotate-left"></i><span>整理する古い版 ${summary.revisions}版</span></div>
                        <div><i class="fa-solid fa-image"></i><span>含まれる画像 ${summary.images}件</span></div>
                    </div>
                    <div class="storage-duplicate-list">
                        ${summary.targets.slice(0, 30).map(target => {
                            const title = target.history?.guide?.title || target.history?.errorContent || target.history?.cause || target.history?.date || '手順書';
                            return `
                                <article class="storage-revision-item">
                                    <div>
                                        <b>${this.escapeHtml(title)}</b>
                                        <span>${this.escapeHtml(target.history?.date || '')}</span>
                                    </div>
                                        <strong>${target.total}版 → ${target.keepCount}版</strong>
                                    <small>${target.removeCount}版 / 画像${target.imageCount}件 / 約${this.formatExportBytes(target.bytes)}</small>
                                </article>
                            `;
                        }).join('')}
                    </div>
                </div>`;
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `
                    <button class="secondary-btn" onclick="app.openStorageManagementCenter()">容量管理へ戻る</button>
                    <button class="primary-btn danger" onclick="app.applyStorageGuideRevisionCleanup(${summary.keepCount})"><i class="fa-solid fa-broom"></i> 古い版履歴を整理</button>
                    <button class="secondary-btn" onclick="app.closeModal()">閉じる</button>
                `;
            }
        });
    }

    applyStorageGuideRevisionCleanup(keepCount = 0) {
        const summary = this.getStorageGuideRevisionCleanupSummary(keepCount);
        if (!summary.targets.length) {
            this.openStorageGuideRevisionCleanupReview(keepCount);
            return;
        }
        const keepLabel = summary.keepCount === 0 ? '現在の手順書だけ' : `現在の手順書と直近${summary.keepCount}版`;
        const ok = window.confirm(`手順書${summary.histories}件の古い版履歴${summary.revisions}版を整理します。${keepLabel}は残ります。実行しますか？`);
        if (!ok) return;
        let removedRevisions = 0;
        let removedImages = 0;
        summary.targets.forEach(target => {
            const history = store.data.deptData?.[target.deptId]?.history?.[target.historyIndex];
            const revisions = history?.guide?.revisions;
            if (!Array.isArray(revisions) || revisions.length <= summary.keepCount) return;
            const removeCount = revisions.length - summary.keepCount;
            const removed = revisions.splice(0, removeCount);
            const stats = this.getStorageImageStats(removed);
            removedRevisions += removed.length;
            removedImages += stats.count;
        });
        store.save?.();
        this.showToast?.(`古い版履歴${removedRevisions}版を整理しました`, 'success');
        this.openStorageManagementCenter();
        if (store.activeData) {
            store.activeData.systemActivityLogs = store.activeData.systemActivityLogs || [];
            store.activeData.systemActivityLogs.unshift({
                id: `storage_revision_cleanup_${Date.now()}`,
                at: new Date().toISOString(),
                level: 'info',
                title: '手順書の版履歴を整理',
                detail: `${summary.keepCount === 0 ? '最新版のみを残し' : `直近${summary.keepCount}版を残し`}、古い版履歴${removedRevisions}版・画像${removedImages}件を整理しました。`
            });
            store.save?.();
        }
    }

    openStorageEmbeddedDuplicateReview(report = this.getStorageManagementReport(), reason = '') {
        const duplicateReport = this.getStorageDuplicateReviewReport(store.data);
        const groups = duplicateReport.activeGroups;
        if (!groups.length) {
            this.openModal('storage-embedded-duplicates', '重複埋込みの確認', () => {
                const content = document.getElementById('modal-content');
                content.innerHTML = `
                    <div class="storage-duplicate-panel">
                        <div class="storage-duplicate-summary">
                            <i class="fa-solid fa-circle-check"></i>
                            <div>
                                <b>整理候補の重複はありません</b>
                                <span>手順書の版履歴など、保存用の過去版にある重複は除外しました。版履歴分は約${this.formatExportBytes(duplicateReport.revisionBytes)}です。</span>
                            </div>
                            <strong>0B</strong>
                        </div>
                    </div>
                `;
                const footer = document.querySelector('.modal-footer');
                if (footer) footer.innerHTML = '<button class="secondary-btn" onclick="app.openStorageManagementCenter()">容量管理へ戻る</button><button class="secondary-btn" onclick="app.closeModal()">閉じる</button>';
            });
            return;
        }
        const totalDuplicateBytes = duplicateReport.activeBytes;
        this.openModal('storage-embedded-duplicates', `重複埋込みの確認 (${groups.length}組)`, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="storage-duplicate-panel">
                    <div class="storage-duplicate-summary">
                        <i class="fa-solid fa-clone"></i>
                        <div>
                            <b>同じ画像データがJSON内に複数保存されています</b>
                            <span>${reason ? `${this.escapeHtml(reason)} ` : ''}手順書の版履歴は除外しています。出力時に1回だけ格納して軽量化できる重複です。</span>
                        </div>
                        <strong>${this.formatExportBytes(totalDuplicateBytes || report.images?.duplicateBytes || 0)}</strong>
                    </div>
                    ${duplicateReport.revisionBytes ? `<div class="storage-duplicate-note"><i class="fa-solid fa-clock-rotate-left"></i> 手順書の版履歴にある重複 約${this.formatExportBytes(duplicateReport.revisionBytes)} は、過去版保存として別扱いにしました。</div>` : ''}
                    <div class="storage-duplicate-list">
                        ${groups.slice(0, 24).map(group => `
                            <article class="storage-duplicate-item">
                                <img src="${group.src}" alt="重複画像">
                                <div>
                                    <b>${group.count}カ所に同じ画像</b>
                                    <span>重複分 約${this.formatExportBytes(group.duplicateBytes)}</span>
                                    <div class="storage-duplicate-tags">
                                        ${group.categories.map(category => `<em>${this.escapeHtml(this.getStorageDuplicateCategoryLabel(category))}</em>`).join('')}
                                    </div>
                                    <small>${group.entries.slice(0, 3).map(entry => this.escapeHtml(entry.path)).join(' / ')}${group.entries.length > 3 ? ` / 他${group.entries.length - 3}カ所` : ''}</small>
                                </div>
                            </article>
                        `).join('')}
                    </div>
                    <p class="storage-center-note"><i class="fa-solid fa-circle-info"></i> 個別写真を削除したい場合は写真管理の重複整理、JSON容量を軽くしたい場合は軽量JSON出力を使います。</p>
                </div>
            `;
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `
                    <button class="secondary-btn" onclick="app.openStorageManagementCenter()">容量管理へ戻る</button>
                    <button class="primary-btn" onclick="app.closeModal(); app.openBackupExportModal?.('all')"><i class="fa-solid fa-feather-pointed"></i> 軽量JSONを出力</button>
                    <button class="secondary-btn" onclick="app.closeModal()">閉じる</button>
                `;
            }
        });
    }

    collectOrphanPhotoManagerMetadata() {
        this.ensurePhotoManagerData?.();
        const validIds = new Set((this.collectPhotoManagerItems?.() || []).map(item => item.id));
        const keys = ['photoManagerNames', 'photoManagerOverlays', 'photoManagerTags', 'photoManagerEditedAt'];
        const entries = [];
        keys.forEach(key => {
            const map = store.activeData[key];
            if (!map || typeof map !== 'object' || Array.isArray(map)) return;
            Object.keys(map).forEach(id => {
                if (!validIds.has(id)) entries.push({ key, id });
            });
        });
        return entries;
    }

    getScheduledDataDiagnosticsReport() {
        const items = this.collectPhotoManagerItems?.() || [];
        const unused = this.getUnusedPhotoManagerLibraryItems?.() || [];
        const duplicateGroups = this.getPhotoManagerDuplicateGroups?.() || [];
        const pageOnly = this.getPhotoManagerPageOnlyItems?.() || [];
        const orphanMetadata = this.collectOrphanPhotoManagerMetadata();
        const broken = this.getBrokenDataReport?.() || {};
        const brokenCount = ['missingMachineHistories', 'archivedMaintenanceTasks', 'archivedGuides', 'archivedTasks']
            .reduce((sum, key) => sum + (Array.isArray(broken[key]) ? broken[key].length : 0), 0);
        const duplicateBytes = duplicateGroups.reduce((sum, group) => {
            const bytes = store.estimateDataUrlBytes(group.src || '');
            return sum + bytes * Math.max(0, (group.items?.length || 1) - 1);
        }, 0);
        const unusedBytes = unused.reduce((sum, item) => sum + store.estimateDataUrlBytes(item.src || ''), 0);
        return {
            runAt: new Date().toISOString(),
            photoCount: items.length,
            unusedCount: unused.length,
            unusedBytes,
            duplicateCount: duplicateGroups.length,
            duplicateBytes,
            pageOnlyCount: pageOnly.length,
            orphanMetadataCount: orphanMetadata.length,
            brokenReferenceCount: brokenCount,
            issueCount: unused.length + duplicateGroups.length + pageOnly.length + orphanMetadata.length + brokenCount
        };
    }

    runScheduledDataDiagnostics(force = false) {
        const today = new Date().toISOString().slice(0, 10);
        const previous = store.activeData.dataDiagnosticsLastReport;
        if (!force && store.activeData.dataDiagnosticsLastRun === today && previous) return previous;
        const report = this.getScheduledDataDiagnosticsReport();
        store.activeData.dataDiagnosticsLastRun = today;
        store.activeData.dataDiagnosticsLastReport = report;
        store.save?.();
        if (!previous || previous.issueCount !== report.issueCount) {
            this.addSystemActivityLog?.('データ診断', `画像・関連データ診断: 確認項目 ${report.issueCount}件`, {
                level: report.brokenReferenceCount ? 'warning' : '', report
            });
        }
        return report;
    }

    openScheduledDataDiagnosticsPanel(force = false) {
        const report = this.runScheduledDataDiagnostics(force);
        const cards = [
            { icon: 'fa-photo-film', label: '孤立・未使用画像', count: report.unusedCount, meta: `約${this.formatExportBytes(report.unusedBytes)}`, action: "app.closeModal(); app.openUnusedImagesFromBackup?.()" },
            { icon: 'fa-clone', label: '完全一致の重複画像', count: report.duplicateCount, meta: `重複分 約${this.formatExportBytes(report.duplicateBytes)}`, action: "app.closeModal(); app.openPhotoManagerDuplicateReview?.()" },
            { icon: 'fa-folder-minus', label: '写真管理に未登録', count: report.pageOnlyCount, meta: '個別ページだけに存在', action: "app.closeModal(); app.openPhotoManagerPageOnlyCleanupReview?.()" },
            { icon: 'fa-tags', label: '孤立した画像設定', count: report.orphanMetadataCount, meta: '画像の無い名前・タグ・注記', action: report.orphanMetadataCount ? "app.confirmCleanOrphanPhotoManagerMetadata()" : '' },
            { icon: 'fa-link-slash', label: '壊れた関連付け', count: report.brokenReferenceCount, meta: '機械・履歴・手順書の参照', action: report.brokenReferenceCount ? "app.closeModal(); app.switchView('history'); app.openHistoryQualityCheck?.()" : '' }
        ];
        this.openModal('scheduled-data-diagnostics', '画像・関連データ診断', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="diagnostics-center-panel ${report.issueCount ? 'has-issues' : 'ok'}">
                    <div class="data-health-head">
                        <i class="fa-solid ${report.issueCount ? 'fa-stethoscope' : 'fa-circle-check'}"></i>
                        <div><b>${report.issueCount ? `${report.issueCount}件の確認項目` : '問題は見つかりませんでした'}</b><span>${new Date(report.runAt).toLocaleString('ja-JP')} に診断 / 写真 ${report.photoCount}件</span></div>
                    </div>
                    <div class="diagnostics-center-grid">
                        ${cards.map(card => `<button type="button" class="diagnostics-center-card ${card.count ? 'has-issue' : 'ok'}" ${card.action ? `onclick="${card.action}"` : 'disabled'}><i class="fa-solid ${card.icon}"></i><span><b>${card.label}</b><small>${card.meta}</small></span><strong>${card.count}</strong></button>`).join('')}
                    </div>
                    <p class="storage-center-note"><i class="fa-solid fa-clock"></i> 診断は起動後に1日1回自動実行されます。検出だけを行い、自動削除はしません。</p>
                </div>`;
            const footer = document.querySelector('.modal-footer');
            if (footer) footer.innerHTML = `<button class="primary-btn" ${report.orphanMetadataCount || report.brokenReferenceCount ? '' : 'disabled'} onclick="app.autoRepairSafeDataIssues()"><i class="fa-solid fa-screwdriver-wrench"></i> 安全な項目を自動修復</button><button class="secondary-btn" onclick="app.openScheduledDataDiagnosticsPanel(true)"><i class="fa-solid fa-rotate"></i> 再診断</button><button class="secondary-btn" onclick="app.closeModal()">閉じる</button>`;
        });
    }

    async autoRepairSafeDataIssues() {
        const orphanEntries = this.collectOrphanPhotoManagerMetadata();
        const broken = this.getBrokenDataReport?.() || {};
        const repairKeys = ['archivedMaintenanceTasks', 'archivedGuides', 'archivedTasks'];
        const referenceCount = repairKeys.reduce((sum, key) => sum + (Array.isArray(broken[key]) ? broken[key].length : 0), 0);
        const total = orphanEntries.length + referenceCount;
        if (!total) return this.openScheduledDataDiagnosticsPanel(true);
        if (!confirm(`安全に自動修復できる ${total}件を修復します。\n画像や履歴本体は削除しません。続行しますか？`)) return;
        orphanEntries.forEach(({ key, id }) => { delete store.activeData[key][id]; });
        repairKeys.forEach(key => {
            const invalid = new Set(Array.isArray(broken[key]) ? broken[key] : []);
            store.activeData[key] = (store.activeData[key] || []).filter(value => !invalid.has(value));
        });
        await store.save?.();
        this.addSystemActivityLog?.('データ修復', `安全なデータ修復 ${total}件`, { level: 'info' });
        this.showToast?.(`${total}件を修復しました`, 'success');
        this.openScheduledDataDiagnosticsPanel(true);
    }

    confirmCleanOrphanPhotoManagerMetadata() {
        const entries = this.collectOrphanPhotoManagerMetadata();
        if (!entries.length) return this.openScheduledDataDiagnosticsPanel(true);
        if (!confirm(`画像の存在しない名前・タグ・注記 ${entries.length}件を削除します。\n画像本体は削除されません。よろしいですか？`)) return;
        entries.forEach(({ key, id }) => { delete store.activeData[key][id]; });
        store.save?.();
        this.addSystemActivityLog?.('データ整理', `孤立した画像設定 ${entries.length}件を削除`, { level: 'info' });
        this.showToast?.(`${entries.length}件の孤立した画像設定を整理しました`, 'success');
        this.openScheduledDataDiagnosticsPanel(true);
    }

    openDataHealthCheckPanel() {
        const health = this.getDataHealthCheckReport();
        this.openModal('data-health-check', '保存データ健康診断', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="data-health-panel ${health.totalIssues ? 'has-issues' : 'ok'}">
                    <div class="data-health-head">
                        <i class="fa-solid ${health.totalIssues ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i>
                        <div>
                            <b>${health.totalIssues ? `${health.totalIssues}件の確認項目があります` : '目立つ問題はありません'}</b>
                            <span>履歴・部品・設定データを横断して確認しました。</span>
                        </div>
                    </div>
                    <div class="data-health-grid">
                        ${health.sections.map(section => `
                            <div class="data-health-card ${section.level}">
                                <div class="data-health-card-head">
                                    <i class="fa-solid ${section.icon}"></i>
                                    <b>${this.escapeHtml(section.label)}</b>
                                    <em>${section.count}件</em>
                                </div>
                                <p>${this.escapeHtml(section.description)}</p>
                                ${section.actionLabel && section.action ? `
                                    <button type="button" class="data-health-card-action" onclick="${section.action}">
                                        <i class="fa-solid fa-wand-magic-sparkles"></i>${this.escapeHtml(section.actionLabel)}
                                    </button>
                                ` : ''}
                                ${section.items.length ? `
                                    <div class="data-health-items">
                                        ${section.items.slice(0, 5).map(item => `
                                            <button type="button" onclick="${item.action || ''}" ${item.action ? '' : 'disabled'}>
                                                <span>${this.escapeHtml(item.title)}</span>
                                                <small>${this.escapeHtml(item.meta || '')}</small>
                                            </button>
                                        `).join('')}
                                        ${section.items.length > 5 ? `<small class="data-health-more">他 ${section.items.length - 5}件</small>` : ''}
                                    </div>
                                ` : '<div class="data-health-ok">OK</div>'}
                            </div>
                        `).join('')}
                    </div>
                    <div class="data-health-actions">
                        <button type="button" class="secondary-btn" onclick="app.closeModal(); app.renderWorkerMaintenanceModal()">
                            <i class="fa-solid fa-user-lock"></i> 管理画面
                        </button>
                        <button type="button" class="secondary-btn" onclick="app.closeModal(); app.switchView('history'); app.openHistoryQualityCheck?.()">
                            <i class="fa-solid fa-shield-halved"></i> 品質チェック
                        </button>
                    </div>
                </div>
            `;
        });
    }

    getDataHealthCheckReport() {
        const brokenReport = this.getBrokenDataReport?.() || { missingMachineHistories: [], archivedMaintenanceTasks: [], archivedGuides: [], archivedTasks: [] };
        const qualityChecks = this.getHistoryQualityChecks?.() || [];
        const priceItems = (store.activeData.history || [])
            .filter(h => !h.isManualGuide)
            .flatMap(h => (this.getHistoryMissingPartPrices?.(h) || []).map(part => ({
                title: part.label,
                meta: `${h.date || '-'} / ${this.getHistoryDisplayText?.(h) || ''}`,
                action: `app.closeModal(); app.openMissingPartPriceMaster('${this.escapeJs(part.name)}', '${this.escapeJs(part.model)}')`
            })));
        const mojibakeItems = this.findDataMojibakeItems();
        const aliasItems = this.findPartAliasCandidates().map(group => ({
            title: group.label,
            meta: `${group.count}件の表記ゆれ候補`,
            action: `app.closeModal(); app.openPartMasterModal('${this.escapeJs(group.name)}', '${this.escapeJs(group.model)}')`
        }));
        const qualityCount = qualityChecks.reduce((sum, check) => sum + (check.groups ? check.groups.length : check.items.length), 0);
        const brokenCount = (brokenReport.missingMachineHistories || []).length + (brokenReport.archivedMaintenanceTasks || []).length + (brokenReport.archivedGuides || []).length + (brokenReport.archivedTasks || []).length;
        const sections = [
            { key: 'broken', label: '壊れた参照', icon: 'fa-link-slash', level: brokenCount ? 'danger' : 'ok', count: brokenCount, description: '存在しない機械やアーカイブ参照を確認します。', actionLabel: brokenCount ? '品質チェックで修正' : '', action: "app.closeModal(); app.switchView('history'); app.openHistoryQualityCheck?.()", items: (brokenReport.missingMachineHistories || []).slice(0, 8).map(h => ({ title: h.title || h.id || '履歴', meta: h.date || '', action: "app.closeModal(); app.switchView('history'); app.openHistoryQualityCheck?.()" })) },
            { key: 'quality', label: '履歴の入力品質', icon: 'fa-shield-halved', level: qualityCount ? 'warning' : 'ok', count: qualityCount, description: '原因・処置・作業時間・担当者などの未入力を確認します。', actionLabel: qualityCount ? 'まとめて確認' : '', action: "app.closeModal(); app.switchView('history'); app.openHistoryQualityCheck?.()", items: qualityChecks.flatMap(check => (check.items || check.groups || []).slice(0, 3).map(item => ({ title: check.label, meta: item.title || item.date || '', action: "app.closeModal(); app.switchView('history'); app.openHistoryQualityCheck?.()" }))) },
            { key: 'price', label: '部品単価未設定', icon: 'fa-yen-sign', level: priceItems.length ? 'warning' : 'ok', count: priceItems.length, description: '部品代が0円で集計される履歴を確認します。', actionLabel: priceItems.length ? '先頭から単価設定' : '', action: priceItems[0]?.action || '', items: priceItems },
            { key: 'alias', label: '部品名寄せ候補', icon: 'fa-code-merge', level: aliasItems.length ? 'warning' : 'ok', count: aliasItems.length, description: '半角/全角や表記ゆれで分かれている可能性を確認します。', actionLabel: aliasItems.length ? '候補を確認' : '', action: aliasItems[0]?.action || '', items: aliasItems },
            { key: 'mojibake', label: '文字化け候補', icon: 'fa-font', level: mojibakeItems.length ? 'danger' : 'ok', count: mojibakeItems.length, description: '表示が崩れそうな文字列を確認します。', actionLabel: mojibakeItems.length ? '該当画面で確認' : '', action: mojibakeItems[0]?.action || '', items: mojibakeItems }
        ];
        return { sections, totalIssues: sections.reduce((sum, s) => sum + s.count, 0) };
    }

    findDataMojibakeItems() {
        const badPattern = /縺|譁|蜿|逋|莉|荳|邱|螟|豁ｴ|蜈|鬆|驕|謇|譌|蛟|縲|陦|霑|髢|窶|譛|莨/;
        const items = [];
        const scan = (label, value, action = '') => {
            const text = String(value || '');
            if (badPattern.test(text)) items.push({ title: label, meta: text.slice(0, 80), action });
        };
        (store.activeData.machines || []).forEach(m => {
            scan('機械名', m.name, `app.closeModal(); app.openMachineModal('${this.escapeJs(m.id)}')`);
            scan('型式', m.model, `app.closeModal(); app.openMachineModal('${this.escapeJs(m.id)}')`);
        });
        (store.activeData.history || []).forEach(h => {
            scan('履歴内容', this.getHistoryDisplayText?.(h), `app.closeModal(); app.openHistoryEditForm('${this.escapeJs(h.id)}')`);
            scan('原因', h.cause, `app.closeModal(); app.openHistoryEditForm('${this.escapeJs(h.id)}', 'cause')`);
            scan('処置', h.notes, `app.closeModal(); app.openHistoryEditForm('${this.escapeJs(h.id)}', 'notes')`);
        });
        (store.activeData.partsMaster || []).forEach(p => scan('部品名', `${p.name} ${p.model || ''}`, `app.closeModal(); app.openPartMasterModal('${this.escapeJs(p.name)}', '${this.escapeJs(p.model || '')}')`));
        return items.slice(0, 50);
    }

    findPartAliasCandidates() {
        const normalize = (value) => MaintenanceStore.toHalfWidthLower(String(value || '').replace(/\s+/g, '').replace(/[×ｘX]/g, 'x'));
        const groups = new Map();
        (store.activeData.partsMaster || []).forEach(part => {
            const key = normalize(part.name);
            if (!key) return;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(part);
        });
        return Array.from(groups.values())
            .filter(list => list.length > 1)
            .map(list => ({ name: list[0].name, model: list[0].model || '', label: list.map(p => `${p.name}${p.model ? ` [${p.model}]` : ''}`).join(' / '), count: list.length }))
            .slice(0, 30);
    }

    closeAppSettingsPanel() {
        document.getElementById('app-settings-overlay')?.remove();
    }

    openSystemActivityLogPanel() {
        this.ensureKanbanTodoState?.();
        const systemLogs = (store.activeData.systemActivityLogs || []).slice(0, 120).map(log => ({
            ...log,
            type: log.type || '操作'
        }));
        const todoLogs = (store.activeData.localTodoLogs || []).slice(0, 80).map(log => ({
            id: log.id || '',
            time: log.time || '',
            title: log.text || '',
            type: 'ToDo'
        }));
        const historyLogs = (store.activeData.history || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 40).map(h => ({
            id: h.id || '',
            time: h.date || '',
            title: this.getHistoryDisplayText(h),
            type: h.taskId ? '定期メンテ' : (h.isDokatei ? 'ドカ停' : '突発')
        }));
        const logs = [...systemLogs, ...todoLogs, ...historyLogs].sort((a, b) => String(b.time || '').localeCompare(String(a.time || ''))).slice(0, 140);
        this.openKanbanPanel('操作ログ', `
            <div class="system-log-list">
                ${logs.map(log => `
                    <div class="system-log-item ${log.level || ''} ${log.restoreAction ? 'restorable' : ''}">
                        <b>${this.escapeHtml(log.type)}${log.restoreAction ? '<em class="system-log-undo-badge"><i class="fa-solid fa-rotate-left"></i> 復元可</em>' : ''}${log.level === 'warning' ? '<em class="system-log-warning-badge"><i class="fa-solid fa-triangle-exclamation"></i> 注意</em>' : ''}</b>
                        <span>${this.escapeHtml(this.formatKanbanTodoTime(log.time) || log.time || '-')}</span>
                        <p>${this.escapeHtml(log.title || '')}</p>
                        ${this.getSystemActivityLogDetailHtml(log)}
                        ${log.restoreAction ? `<button type="button" class="secondary-btn system-log-restore" onclick="${log.restoreAction}"><i class="fa-solid fa-rotate-left"></i> 復元</button>` : ''}
                    </div>
                `).join('') || '<p class="kt-muted">ログはありません</p>'}
            </div>
        `);
    }

    getSystemActivityLogDetailHtml(log = {}) {
        const detail = log.detail || {};
        if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return '';
        const items = [];
        if (detail.level) items.push(['レベル', detail.level]);
        if (Array.isArray(detail.deletedParts)) items.push(['復元対象', `${detail.deletedParts.length}件`]);
        if (detail.report?.issueCount !== undefined) items.push(['確認項目', `${detail.report.issueCount}件`]);
        if (detail.report?.unusedCount !== undefined) items.push(['未使用画像', `${detail.report.unusedCount}件`]);
        if (detail.report?.duplicateCount !== undefined) items.push(['重複画像', `${detail.report.duplicateCount}件`]);
        if (detail.report?.brokenReferenceCount !== undefined) items.push(['壊れた関連付け', `${detail.report.brokenReferenceCount}件`]);
        if (!items.length) return '';
        return `
            <div class="system-log-detail">
                ${items.map(([label, value]) => `<span><b>${this.escapeHtml(label)}</b>${this.escapeHtml(value)}</span>`).join('')}
            </div>
        `;
    }

    addSystemActivityLog(type, title, detail = {}) {
        if (!store.activeData.systemActivityLogs) store.activeData.systemActivityLogs = [];
        const id = `syslog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        store.activeData.systemActivityLogs.unshift({
            id,
            type,
            title,
            detail,
            time: new Date().toISOString(),
            level: detail.level || ''
        });
        store.activeData.systemActivityLogs = store.activeData.systemActivityLogs.slice(0, 300);
        store.save?.();
        return id;
    }

    restoreDeletedPartMasterLog(logId) {
        const log = (store.activeData.systemActivityLogs || []).find(item => item.id === logId);
        const parts = log?.detail?.deletedParts || [];
        if (!parts.length) {
            alert('復元できる部品カードがありません。');
            return;
        }
        if (!store.activeData.partsMaster) store.activeData.partsMaster = [];
        let restored = 0;
        parts.forEach(part => {
            const exists = store.activeData.partsMaster.some(p => p.name === part.name && (p.model || '') === (part.model || ''));
            if (!exists) {
                store.activeData.partsMaster.push(part);
                restored += 1;
            }
        });
        log.restoreAction = '';
        log.title = `${log.title || '名寄せ元カード削除'}（復元済み ${restored}件）`;
        store.save?.();
        this.closeKanbanTodoModal?.();
        this.renderAnalysis?.();
        this.showToast?.(`${restored}件の部品カードを復元しました`, 'success');
    }

    getDataFixCenterSummary() {
        const histories = (store.activeData.history || []).filter(h => !h.isManualGuide);
        const trouble = histories.filter(h => !h.taskId || h.isSudden || h.isDokatei || h.isNonProductionStop);
        const causeCount = trouble.filter(h => !String(h.cause || '').trim()).length;
        const notesCount = trouble.filter(h => !String(h.notes || '').trim()).length;
        const priceCount = histories.flatMap(h => this.getHistoryMissingPartPrices?.(h) || []).length;
        const aliasCount = this.findPartAliasCandidates().length;
        return {
            causeCount,
            notesCount,
            priceCount,
            aliasCount,
            total: causeCount + notesCount + priceCount + aliasCount
        };
    }

    openDataFixCenterPanel() {
        const histories = (store.activeData.history || []).filter(h => !h.isManualGuide);
        const trouble = histories.filter(h => !h.taskId || h.isSudden || h.isDokatei || h.isNonProductionStop);
        const causeItems = trouble.filter(h => !String(h.cause || '').trim()).sort((a, b) => this.compareFixCenterHistoryPriority(a, b)).slice(0, 20);
        const notesItems = trouble.filter(h => !String(h.notes || '').trim()).sort((a, b) => this.compareFixCenterHistoryPriority(a, b)).slice(0, 20);
        const partUseCount = this.getFixCenterPartUseCountMap(histories);
        const priceItems = histories
            .flatMap(h => (this.getHistoryMissingPartPrices?.(h) || []).map(part => ({ h, part })))
            .sort((a, b) => (partUseCount.get(`${b.part.name}___${b.part.model || ''}`) || 0) - (partUseCount.get(`${a.part.name}___${a.part.model || ''}`) || 0) || this.compareFixCenterHistoryPriority(a.h, b.h))
            .slice(0, 20);
        const aliasGroups = this.findPartAliasCandidates().sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 20);
        const makeHistoryItem = (h, focus) => `
            <button type="button" class="fix-center-item" onclick="app.closeModal(); app.openHistoryEditForm('${this.escapeJs(h.id)}', '${this.escapeJs(focus)}')">
                ${this.getFixCenterPriorityBadgeHtml(h)}
                <b>${this.escapeHtml(h.date || '-')} / ${this.escapeHtml(this.getHistoryDisplayText?.(h) || '内容なし')}</b>
                <small>${this.escapeHtml(focus === 'cause' ? '原因を入力' : '処置を入力')} / ${this.escapeHtml(this.getFixCenterPriorityReason(h))}</small>
            </button>
        `;
        const total = causeItems.length + notesItems.length + priceItems.length + aliasGroups.length;
        this.openModal('data-fix-center', `未入力・未設定の集中修正 (${total}件)`, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="fix-center-panel">
                    <div class="fix-center-head">
                        <div><b>集計や検索に効く未設定をまとめて修正</b><span>各項目を押すと、該当入力欄や部品マスターを直接開きます。</span></div>
                        <strong>${total}件</strong>
                    </div>
                    <div class="fix-center-grid">
                        <section class="fix-center-card">
                            <header><i class="fa-solid fa-magnifying-glass-chart"></i><b>原因未入力</b><em>${causeItems.length}</em></header>
                            <div>${causeItems.map(h => makeHistoryItem(h, 'cause')).join('') || '<p>該当なし</p>'}</div>
                        </section>
                        <section class="fix-center-card">
                            <header><i class="fa-solid fa-screwdriver-wrench"></i><b>処置未入力</b><em>${notesItems.length}</em></header>
                            <div>${notesItems.map(h => makeHistoryItem(h, 'notes')).join('') || '<p>該当なし</p>'}</div>
                        </section>
                        <section class="fix-center-card">
                            <header><i class="fa-solid fa-yen-sign"></i><b>単価未設定</b><em>${priceItems.length}</em></header>
                            <div>${priceItems.map(({ h, part }) => `
                                <button type="button" class="fix-center-item" onclick="app.closeModal(); app.openMissingPartPriceMaster('${this.escapeJs(part.name)}', '${this.escapeJs(part.model)}')">
                                    <span class="fix-center-priority medium"><i class="fa-solid fa-chart-column"></i> 使用${partUseCount.get(`${part.name}___${part.model || ''}`) || 0}件</span>
                                    <b>${this.escapeHtml(part.label)}</b>
                                    <small>${this.escapeHtml(h.date || '-')} / ${this.escapeHtml(this.getHistoryDisplayText?.(h) || '')}</small>
                                </button>
                            `).join('') || '<p>該当なし</p>'}</div>
                        </section>
                        <section class="fix-center-card">
                            <header><i class="fa-solid fa-code-merge"></i><b>名寄せ候補</b><em>${aliasGroups.length}</em></header>
                            <div>${aliasGroups.map(group => `
                                <button type="button" class="fix-center-item" onclick="app.closeModal(); app.openPartMasterModal('${this.escapeJs(group.name)}', '${this.escapeJs(group.model)}')">
                                    <span class="fix-center-priority info"><i class="fa-solid fa-code-merge"></i> 候補${group.count}件</span>
                                    <b>${this.escapeHtml(group.label)}</b>
                                    <small>${group.count}件の表記ゆれ候補</small>
                                </button>
                            `).join('') || '<p>該当なし</p>'}</div>
                        </section>
                    </div>
                </div>
            `;
        });
    }

    getFixCenterHistoryPriority(history) {
        const workTime = parseFloat(history?.workTime) || 0;
        let score = 0;
        if (history?.isDokatei) score += 100;
        if (history?.isNonProductionStop) score += 55;
        if (history?.isSudden || !history?.taskId) score += 30;
        if (history?.isFirstTime === false) score += 25;
        score += Math.min(50, workTime);
        return score;
    }

    compareFixCenterHistoryPriority(a, b) {
        return this.getFixCenterHistoryPriority(b) - this.getFixCenterHistoryPriority(a)
            || String(b?.date || '').localeCompare(String(a?.date || ''));
    }

    getFixCenterPriorityLevel(history) {
        const score = this.getFixCenterHistoryPriority(history);
        if (history?.isDokatei || score >= 90) return 'high';
        if (history?.isNonProductionStop || score >= 55) return 'medium';
        return 'info';
    }

    getFixCenterPriorityReason(history) {
        const reasons = [];
        if (history?.isDokatei) reasons.push('ドカ停');
        else if (history?.isNonProductionStop) reasons.push('非生産停止');
        else if (history?.isSudden || !history?.taskId) reasons.push('突発');
        if (history?.isFirstTime === false) reasons.push('再発');
        const workTime = parseFloat(history?.workTime) || 0;
        if (workTime > 0) reasons.push(`${workTime}分`);
        return reasons.join(' / ') || '通常';
    }

    getFixCenterPriorityBadgeHtml(history) {
        const level = this.getFixCenterPriorityLevel(history);
        const label = level === 'high' ? '高優先' : (level === 'medium' ? '中優先' : '確認');
        return `<span class="fix-center-priority ${level}"><i class="fa-solid fa-arrow-trend-up"></i> ${this.escapeHtml(label)}</span>`;
    }

    getFixCenterPartUseCountMap(histories = []) {
        const map = new Map();
        (histories || []).forEach(h => {
            const seenInHistory = new Set();
            (h.replacedParts || []).forEach(part => {
                const master = store.getPartMaster?.(part.name, part.model || '');
                const name = master?.name || part.name || '';
                const model = master?.model || part.model || '';
                if (!name) return;
                seenInHistory.add(`${name}___${model || ''}`);
            });
            seenInHistory.forEach(key => map.set(key, (map.get(key) || 0) + 1));
        });
        return map;
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppSettingsMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppSettingsMethods.prototype[name];
        }
    }
})();
