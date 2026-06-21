(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppSettingsMethods extends MaintenanceApp {
    openAppSettingsPanel() {
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
                            <i class="fa-solid fa-clock-rotate-left"></i><span>操作ログ</span><small>ToDo操作と最近のメンテ記録を確認</small>
                        </button>
                        <button type="button" onclick="app.closeAppSettingsPanel(); app.openDataHealthCheckPanel()">
                            <i class="fa-solid fa-heart-pulse"></i><span>保存データ健康診断</span><small>未設定・文字化け・名寄せ候補をまとめて確認</small>
                        </button>
                        <button type="button" onclick="app.closeAppSettingsPanel(); app.openDataFixCenterPanel()">
                            <i class="fa-solid fa-screwdriver-wrench"></i><span>未入力・未設定の集中修正</span><small>原因・処置・単価・名寄せ候補を1画面で確認</small>
                        </button>
                        <button type="button" onclick="app.closeAppSettingsPanel(); app.openStorageManagementCenter()">
                            <i class="fa-solid fa-hard-drive"></i><span>容量管理センター</span><small>写真・ゴミ箱・元画像・JSON容量を確認して整理</small>
                        </button>
                        <button type="button" onclick="app.closeAppSettingsPanel(); app.openScheduledDataDiagnosticsPanel(true)">
                            <i class="fa-solid fa-stethoscope"></i><span>画像・関連データ診断</span><small>孤立・重複・壊れた関連付けを自動検出</small>
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
        this.openModal('storage-management-center', '容量管理センター', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="storage-center-panel">
                    <div class="storage-center-summary">
                        <div><i class="fa-solid fa-file-code"></i><span>現在のJSON</span><b>${this.formatExportBytes(report.rawJsonBytes)}</b></div>
                        <div><i class="fa-solid fa-images"></i><span>画像の実容量</span><b>${this.formatExportBytes(report.images.embeddedBytes)}</b></div>
                        <div><i class="fa-solid fa-clone"></i><span>重複埋込み分</span><b>${this.formatExportBytes(report.images.duplicateBytes)}</b></div>
                    </div>
                    <div class="storage-center-list">${rows}</div>
                    <div class="storage-center-actions">
                        <button type="button" onclick="app.closeModal(); app.openUnusedImagesFromBackup?.()"><i class="fa-solid fa-image-circle-xmark"></i><b>未使用画像を確認</b><span>${report.unusedCount}件 / 約${this.formatExportBytes(report.unusedBytes)}</span></button>
                        <button type="button" onclick="app.closeModal(); app.openPhotoManagerDuplicateReview?.()"><i class="fa-solid fa-clone"></i><b>重複画像を整理</b><span>削除前に残す画像を選択</span></button>
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
                    <div class="system-log-item ${log.level || ''}">
                        <b>${this.escapeHtml(log.type)}</b>
                        <span>${this.escapeHtml(this.formatKanbanTodoTime(log.time) || log.time || '-')}</span>
                        <p>${this.escapeHtml(log.title || '')}</p>
                        ${log.restoreAction ? `<button type="button" class="secondary-btn system-log-restore" onclick="${log.restoreAction}"><i class="fa-solid fa-rotate-left"></i> 復元</button>` : ''}
                    </div>
                `).join('') || '<p class="kt-muted">ログはありません</p>'}
            </div>
        `);
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
