(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppArchiveMethods extends MaintenanceApp {
    archiveWorkerFromWorktime(name) {
        if (confirm(`${name}さんをアーカイブしますか？\n（スキルマップに表示されなくなります。過去の作業実績は「旧作業者合計」に含まれます）`)) {
            store.toggleWorkerArchive(name);
            this.renderWorkTime();
        }
    }

    openWorkerMaintenance() {
        this.renderWorkerMaintenanceModal();
    }

    createEmptyDepartmentData() {
        return {
            machines: [],
            tasks: [],
            history: [],
            partsMaster: [],
            archivedWorkers: [],
            archivedTasks: [],
            archivedParts: [],
            archivedMaintenanceTasks: [],
            archivedGuides: [],
            machineCategories: [],
            archivedMachineCategories: [],
            memos: {},
            localTodos: [],
            localTodoWorkers: [{ id: 'default', name: '共通・未設定' }],
            localTodoLogs: [],
            historyImportLogs: [],
            shiftNotebooks: {},
            shiftNotebookGroupPresets: [],
            shiftNotebookMemberTypes: {},
            shiftNotebookMemberOrder: [],
            shiftNotebookTags: ['通常', '注意', '至急'],
            shiftNotebookRowGroups: ['4号L', '5号L'],
            archivedSuggestions: { errorNo: [], content: [], cause: [], notes: [], workers: [], partName: [], partModel: [], partSerial: [] },
            dokateiCounters: [
                { location: '', lastDate: '' },
                { location: '', lastDate: '' },
                { location: '', lastDate: '' }
            ]
        };
    }

    getInitialDataModeInfo(mode = 'empty') {
        const labels = {
            empty: '完全初期化',
            keep_current_dept: '現在の部署だけ残す',
            keep_machines: '機械マスタだけ残す',
            keep_categories: '装置区分だけ残す',
            keep_workers: '作業者候補だけ残す'
        };
        return { key: mode, label: labels[mode] || labels.empty };
    }

    getCurrentWorkerNames() {
        const workerSet = new Set();
        (store.getHistory({}) || []).forEach(h => {
            (Array.isArray(h.workers) ? h.workers : []).forEach(w => {
                const name = String(w || '').trim();
                if (name) workerSet.add(name);
            });
        });
        return Array.from(workerSet).sort((a, b) => a.localeCompare(b, 'ja'));
    }

    createInitialDepartmentData(mode = 'empty') {
        const data = this.createEmptyDepartmentData();
        const active = store.activeData || {};
        if (mode === 'keep_current_dept') {
            return JSON.parse(JSON.stringify(active));
        }
        if (mode === 'keep_machines') {
            data.machines = JSON.parse(JSON.stringify(active.machines || [])).map(m => ({ ...m, deleted: false }));
            data.machineCategories = [...new Set([
                ...(active.machineCategories || []),
                ...(data.machines || []).map(m => m.category).filter(Boolean)
            ])].sort((a, b) => a.localeCompare(b, 'ja'));
        } else if (mode === 'keep_categories') {
            data.machineCategories = [...(active.machineCategories || [])];
        } else if (mode === 'keep_workers') {
            data.localTodoWorkers = this.getCurrentWorkerNames().map((name, index) => ({
                id: `worker_${index + 1}`,
                name
            }));
            if (data.localTodoWorkers.length === 0) {
                data.localTodoWorkers = [{ id: 'default', name: '共通・未設定' }];
            }
        }
        return data;
    }

    getCurrentDeptSkillExportData() {
        const active = store.activeData || {};
        const tasks = active.tasks || [];
        const histories = (active.history || []).filter(h => h.isFirstTime !== false && !h.hideFromSkillMap);
        const validKeys = new Set();
        histories.forEach(h => {
            const content = h.taskId
                ? (tasks.find(t => String(t.id) === String(h.taskId))?.content || h.taskContent || '定期メンテナンス')
                : (h.errorContent || h.notes || '突発対応');
            validKeys.add(`${h.machineId}__${content}`);
        });

        const machines = active.machines || [];
        const machineNames = new Set(machines.map(m => MaintenanceStore.toHalfWidthLower(m.name || '')).filter(Boolean));
        const machineModels = new Set(machines.map(m => MaintenanceStore.toHalfWidthLower(m.model || '')).filter(Boolean));
        const machineCategories = new Set([
            ...(active.machineCategories || []),
            ...machines.map(m => m.category).filter(Boolean)
        ].map(v => MaintenanceStore.toHalfWidthLower(v)));
        const lineNos = new Set(machines.map(m => String(m.lineNo || '')).filter(Boolean));

        let manualSkills = [];
        try { manualSkills = JSON.parse(localStorage.getItem('manualSkills') || '[]'); } catch (e) {}
        const keptManualSkills = manualSkills.filter(ms => {
            const machine = MaintenanceStore.toHalfWidthLower(ms.machine || '');
            const model = MaintenanceStore.toHalfWidthLower(ms.model || '');
            const category = MaintenanceStore.toHalfWidthLower(ms.machineCategory || '');
            const lineNo = String(ms.lineNo || '');
            if (machine && machineNames.has(machine)) return true;
            if (model && machineModels.has(model)) return true;
            if (category && machineCategories.has(category)) return true;
            if (lineNo && lineNos.has(lineNo)) return true;
            return !machine && !model && !category && !lineNo;
        });
        keptManualSkills.forEach(ms => validKeys.add(ms.id));

        let skillEvaluations = {};
        try { skillEvaluations = JSON.parse(localStorage.getItem('skillEvaluations') || '{}'); } catch (e) {}
        const filteredEvaluations = {};
        Object.entries(skillEvaluations || {}).forEach(([worker, evals]) => {
            const kept = {};
            Object.entries(evals || {}).forEach(([taskKey, value]) => {
                if (validKeys.has(taskKey)) kept[taskKey] = value;
            });
            if (Object.keys(kept).length) filteredEvaluations[worker] = kept;
        });

        return { skillEvaluations: filteredEvaluations, manualSkills: keptManualSkills };
    }

    getBrokenDataReport() {
        const active = store.activeData || {};
        const tasks = active.tasks || [];
        const histories = active.history || [];
        const machines = active.machines || [];
        const taskIds = new Set(tasks.map(t => String(t.id)));
        const historyIds = new Set(histories.map(h => String(h.id)));
        const machineIds = new Set(machines.map(m => String(m.id)));

        const skillKeys = new Set();
        histories.filter(h => h.isFirstTime !== false && !h.hideFromSkillMap).forEach(h => {
            const content = h.taskId
                ? (tasks.find(t => String(t.id) === String(h.taskId))?.content || h.taskContent || '定期メンテナンス')
                : (h.errorContent || h.notes || '突発対応');
            skillKeys.add(`${h.machineId}__${content}`);
        });
        let manualSkills = [];
        try { manualSkills = JSON.parse(localStorage.getItem('manualSkills') || '[]'); } catch (e) {}
        manualSkills.forEach(ms => skillKeys.add(ms.id));

        return {
            archivedMaintenanceTasks: (active.archivedMaintenanceTasks || []).filter(id => !taskIds.has(String(id))),
            archivedGuides: (active.archivedGuides || []).filter(id => !historyIds.has(String(id))),
            archivedTasks: (active.archivedTasks || []).filter(key => !skillKeys.has(String(key))),
            missingMachineHistories: histories.filter(h => !h.isManualGuide && h.machineId && !machineIds.has(String(h.machineId))).map(h => h.id)
        };
    }

    getBrokenDataDetailRows(report = this.getBrokenDataReport()) {
        const active = store.activeData || {};
        const histories = active.history || [];
        const machines = store.getMachines(true);
        const rows = [];
        const addRows = (type, label, ids) => {
            (ids || []).forEach(id => {
                let title = String(id);
                let action = '';
                if (type === 'missingMachineHistories') {
                    const h = histories.find(item => String(item.id) === String(id));
                    const machineName = machines.find(m => String(m.id) === String(h?.machineId))?.name || `機械ID: ${h?.machineId || '-'}`;
                    title = h ? `${h.date || '日付なし'} / ${machineName} / ${this.getHistoryDisplayText(h) || h.errorContent || h.notes || '内容なし'}` : `履歴ID: ${id}`;
                    action = h ? `<button class="secondary-btn" onclick="app.closeModal(); app.openHistoryEditForm('${this.escapeJs(id)}')">履歴を開く</button>` : '';
                } else {
                    action = `<button class="danger-btn" onclick="app.cleanupBrokenDataReferences()">参照を自動修復</button>`;
                }
                rows.push({ type, label, id, title, action });
            });
        };
        addRows('archivedMaintenanceTasks', '周期設定参照', report.archivedMaintenanceTasks);
        addRows('archivedGuides', '手順書参照', report.archivedGuides);
        addRows('archivedTasks', 'スキル除外参照', report.archivedTasks);
        addRows('missingMachineHistories', '機械不明履歴', report.missingMachineHistories);
        return rows;
    }

    getBrokenDataCount(report = this.getBrokenDataReport()) {
        return Object.values(report).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
    }

    downloadJsonText(filename, jsonText, toastMessage = '') {
        const blob = new Blob([jsonText], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        if (toastMessage) this.showToast?.(toastMessage, 'success');
    }

    getAdminDataCounts(data = store.activeData || {}) {
        let skillEvaluations = {};
        let manualSkills = [];
        try { skillEvaluations = JSON.parse(localStorage.getItem('skillEvaluations') || '{}'); } catch (e) {}
        try { manualSkills = JSON.parse(localStorage.getItem('manualSkills') || '[]'); } catch (e) {}
        const skillEvaluationCount = Object.values(skillEvaluations || {}).reduce((sum, evals) => sum + Object.keys(evals || {}).length, 0);
        return {
            machines: (data.machines || []).length,
            tasks: (data.tasks || []).length,
            history: (data.history || []).length,
            parts: (data.partsMaster || []).length,
            memos: Object.keys(data.memos || {}).length,
            skillEvaluations: skillEvaluationCount,
            manualSkills: manualSkills.length
        };
    }

    getAdminBackupLogKey() {
        return 'maintenance_admin_backup_logs_global';
    }

    getAdminOperationLogKey() {
        return 'maintenance_admin_operation_logs_global';
    }

    getAdminOperationLogs() {
        try {
            return JSON.parse(localStorage.getItem(this.getAdminOperationLogKey()) || '[]');
        } catch (e) {
            return [];
        }
    }

    saveAdminOperationLogs(logs) {
        localStorage.setItem(this.getAdminOperationLogKey(), JSON.stringify((logs || []).slice(0, 80)));
    }

    recordAdminOperationLog(type, title, detail = '', target = {}) {
        const logs = this.getAdminOperationLogs();
        logs.unshift({
            id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            at: new Date().toISOString(),
            type,
            title,
            detail,
            target
        });
        this.saveAdminOperationLogs(logs);
    }

    clearAdminOperationLogs() {
        if (!confirm('操作ログの表示だけを消去しますか？\n保存済みデータやバックアップJSONは削除されません。')) return;
        this.saveAdminOperationLogs([]);
        this.renderWorkerMaintenanceModal();
    }

    requireDangerConfirm(title, detail = '', keyword = '実行') {
        const ok = confirm(`${title}\n\n${detail}\n\nこの操作は影響が大きい可能性があります。続行しますか？`);
        if (!ok) return false;
        const typed = prompt(`確認のため「${keyword}」と入力してください。`);
        return typed === keyword;
    }

    getAdminBackupLogs() {
        try {
            return JSON.parse(localStorage.getItem(this.getAdminBackupLogKey()) || '[]');
        } catch (e) {
            return [];
        }
    }

    saveAdminBackupLogs(logs) {
        localStorage.setItem(this.getAdminBackupLogKey(), JSON.stringify((logs || []).slice(0, 20)));
    }

    recordAdminBackupLog(type, filename, counts = this.getAdminDataCounts()) {
        const labels = {
            manual: '手動バックアップ',
            repair: '修復前バックアップ',
            import: '取込前バックアップ'
        };
        const logs = this.getAdminBackupLogs();
        logs.unshift({
            id: `backup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            at: new Date().toISOString(),
            type,
            label: labels[type] || 'バックアップ',
            filename,
            counts
        });
        this.saveAdminBackupLogs(logs);
    }

    formatAdminBackupTime(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso || '-';
        return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    renderAdminBackupLogPanel() {
        const logs = this.getAdminBackupLogs();
        return `
            <div class="admin-backup-panel ${logs.length ? '' : 'empty'}">
                <div class="admin-backup-head">
                    <div>
                        <b><i class="fa-solid fa-clock-rotate-left"></i> バックアップ履歴</b>
                        <span>この部署で出力した手動・取込前・修復前バックアップを記録します。</span>
                    </div>
                    ${logs.length ? `<button class="secondary-btn" onclick="app.clearAdminBackupLogs()">履歴を消去</button>` : ''}
                </div>
                <div class="admin-backup-list">
                    ${logs.length === 0 ? '<p>まだバックアップ履歴はありません。</p>' : logs.slice(0, 6).map(log => `
                        <div class="admin-backup-item">
                            <i class="fa-solid ${log.type === 'repair' ? 'fa-screwdriver-wrench' : (log.type === 'import' ? 'fa-upload' : 'fa-shield')}"></i>
                            <div>
                                <b>${this.escapeHtml(log.label)}</b>
                                <span>${this.escapeHtml(this.formatAdminBackupTime(log.at))} / ${this.escapeHtml(log.filename || '-')}</span>
                                <small>機械 ${log.counts?.machines || 0} / 履歴 ${log.counts?.history || 0} / 周期 ${log.counts?.tasks || 0} / スキル ${log.counts?.skillEvaluations || 0}</small>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderAdminOperationLogPanel() {
        const logs = this.getAdminOperationLogs();
        return `
            <div class="admin-operation-panel ${logs.length ? '' : 'empty'}">
                <div class="admin-backup-head">
                    <div>
                        <b><i class="fa-solid fa-clipboard-list"></i> 操作ログ</b>
                        <span>アーカイブ復元・参照修復・完全削除など、管理画面で実行した操作を残します。</span>
                    </div>
                    ${logs.length ? `<button class="secondary-btn" onclick="app.clearAdminOperationLogs()">ログを消去</button>` : ''}
                </div>
                <div class="admin-operation-list">
                    ${logs.length === 0 ? '<p>まだ操作ログはありません。</p>' : logs.slice(0, 10).map(log => `
                        <button type="button" class="admin-operation-item ${this.escapeHtml(log.type || '')}" onclick="app.openAdminOperationLogTarget('${this.escapeJs(log.id)}')">
                            <i class="fa-solid ${log.type === 'delete' ? 'fa-trash-can' : (log.type === 'repair' ? 'fa-broom' : (log.type === 'archive' ? 'fa-box-archive' : 'fa-arrow-rotate-left'))}"></i>
                            <div>
                                <b>${this.escapeHtml(log.title || '-')}</b>
                                <span>${this.escapeHtml(this.formatAdminBackupTime(log.at))}${log.detail ? ` / ${this.escapeHtml(log.detail)}` : ''}</span>
                            </div>
                            <small><i class="fa-solid fa-arrow-up-right-from-square"></i></small>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    findAdminOperationLog(id) {
        return this.getAdminOperationLogs().find(log => String(log.id) === String(id));
    }

    findHistoryByLogDetail(detail = '') {
        const needle = MaintenanceStore.toHalfWidthLower(detail);
        if (!needle) return null;
        return (store.activeData.history || []).find(h => {
            const machine = store.getMachines(true).find(m => String(m.id) === String(h.machineId));
            const text = `${h.id || ''} ${h.date || ''} ${machine?.name || ''} ${this.getHistoryDisplayText(h) || ''} ${h.errorContent || ''} ${h.notes || ''}`;
            return MaintenanceStore.toHalfWidthLower(text).includes(needle);
        });
    }

    findMachineByLogDetail(detail = '') {
        const needle = MaintenanceStore.toHalfWidthLower(detail);
        if (!needle) return null;
        return store.getMachines(true).find(m => {
            const text = `${m.id || ''} ${m.name || ''} ${m.model || ''} ${m.category || ''}`;
            return MaintenanceStore.toHalfWidthLower(text).includes(needle);
        });
    }

    openAdminOperationLogTarget(id) {
        const log = this.findAdminOperationLog(id);
        if (!log) return;
        const target = log.target || {};
        if (target.view === 'history' && target.id) {
            this.closeModal();
            this.switchView('history');
            setTimeout(() => this.openHistoryEditForm(target.id), 80);
            return;
        }
        if (target.view === 'guide' && target.id) {
            this.closeModal();
            setTimeout(() => this.openGuideModal(target.id), 80);
            return;
        }
        if (target.view === 'machine' && target.id) {
            this.closeModal();
            setTimeout(() => this.openMachineModal(target.id), 80);
            return;
        }
        if (target.tab) {
            this.setAdminManagementTab(target.tab);
            const search = document.getElementById('admin-management-search');
            if (search && target.search) {
                search.value = target.search;
                this.filterAdminManagementList(target.search);
            }
            return;
        }
        const history = this.findHistoryByLogDetail(log.detail);
        if (history) {
            this.closeModal();
            this.switchView('history');
            setTimeout(() => this.openHistoryEditForm(history.id), 80);
            return;
        }
        const machine = this.findMachineByLogDetail(log.detail);
        if (machine) {
            this.closeModal();
            setTimeout(() => this.openMachineModal(machine.id), 80);
            return;
        }
        this.setAdminManagementTab(log.title?.includes('サジェスト') ? 'suggest' : (log.title?.includes('バックアップ') ? 'backup' : 'archive'));
        const search = document.getElementById('admin-management-search');
        if (search && log.detail) {
            search.value = log.detail;
            this.filterAdminManagementList(log.detail);
        }
    }

    clearAdminBackupLogs() {
        if (!confirm('バックアップ履歴の表示だけを消去しますか？\n出力済みJSONファイルは削除されません。')) return;
        this.saveAdminBackupLogs([]);
        this.renderWorkerMaintenanceModal();
    }

    getAdminSafetySummary(brokenReport = this.getBrokenDataReport()) {
        const brokenTotal = this.getBrokenDataCount(brokenReport);
        const autoFixCount = brokenReport.archivedMaintenanceTasks.length + brokenReport.archivedGuides.length + brokenReport.archivedTasks.length;
        const qualityChecks = typeof this.getHistoryQualityChecks === 'function' ? this.getHistoryQualityChecks() : [];
        const qualityDanger = qualityChecks
            .filter(check => check.severity === 'danger')
            .reduce((sum, check) => sum + (check.groups ? check.groups.length : check.items.length), 0);
        const qualityWarning = qualityChecks
            .filter(check => check.severity === 'warning')
            .reduce((sum, check) => sum + (check.groups ? check.groups.length : check.items.length), 0);
        const backupCount = this.getAdminBackupLogs().length;
        const tasks = [];
        if (autoFixCount > 0) tasks.push({ level: 'danger', icon: 'fa-broom', text: `自動修復できる壊れた参照が ${autoFixCount}件あります`, action: 'app.cleanupBrokenDataReferences()', label: '自動修復' });
        if (brokenReport.missingMachineHistories.length > 0) tasks.push({ level: 'danger', icon: 'fa-industry', text: `機械が見つからない履歴が ${brokenReport.missingMachineHistories.length}件あります`, action: "app.closeModal(); app.switchView('history'); app.openHistoryQualityCheck?.();", label: '品質チェック' });
        if (qualityDanger > 0) tasks.push({ level: 'danger', icon: 'fa-triangle-exclamation', text: `集計に影響しやすい品質問題が ${qualityDanger}件あります`, action: "app.closeModal(); app.switchView('history'); app.openHistoryQualityCheck?.();", label: '確認' });
        if (qualityWarning > 0) tasks.push({ level: 'warning', icon: 'fa-circle-exclamation', text: `未設定などの注意項目が ${qualityWarning}件あります`, action: "app.closeModal(); app.switchView('history'); app.openHistoryQualityCheck?.();", label: '確認' });
        if (backupCount === 0) tasks.push({ level: 'warning', icon: 'fa-shield', text: 'バックアップ履歴がまだありません', action: "app.setAdminManagementTab('backup')", label: 'バックアップタブ' });
        if (tasks.length === 0) tasks.push({ level: 'ok', icon: 'fa-circle-check', text: '目立つ問題はありません', action: '', label: '' });
        const level = brokenTotal || qualityDanger ? 'danger' : (qualityWarning || backupCount === 0 ? 'warning' : 'ok');
        const labels = {
            danger: { text: '要修復', icon: 'fa-triangle-exclamation' },
            warning: { text: '注意', icon: 'fa-circle-exclamation' },
            ok: { text: '正常', icon: 'fa-circle-check' }
        };
        const details = [
            { key: 'autoFix', label: '自動修復できる参照', count: autoFixCount, level: autoFixCount ? 'danger' : 'ok', action: autoFixCount ? 'app.cleanupBrokenDataReferences()' : '', button: autoFixCount ? '自動修復' : '' },
            { key: 'broken', label: '壊れた参照合計', count: brokenTotal, level: brokenTotal ? 'danger' : 'ok', action: brokenTotal ? 'app.openBrokenDataDetailModal()' : '', button: brokenTotal ? '詳細' : '' },
            { key: 'qualityDanger', label: '重大品質問題', count: qualityDanger, level: qualityDanger ? 'danger' : 'ok', action: qualityDanger ? "app.closeModal(); app.switchView('history'); app.openHistoryQualityCheck?.();" : '', button: qualityDanger ? '品質チェック' : '' },
            { key: 'qualityWarning', label: '注意項目', count: qualityWarning, level: qualityWarning ? 'warning' : 'ok', action: qualityWarning ? "app.closeModal(); app.switchView('history'); app.openHistoryQualityCheck?.();" : '', button: qualityWarning ? '確認' : '' },
            { key: 'backup', label: 'バックアップ履歴', count: backupCount, level: backupCount ? 'ok' : 'warning', action: backupCount ? "app.setAdminManagementTab('backup')" : 'app.exportAdminBackupJson()', button: backupCount ? '履歴' : '作成' }
        ];
        return { level, label: labels[level], tasks, details, brokenTotal, qualityDanger, qualityWarning, backupCount };
    }

    renderAdminSafetyPanel(summary) {
        return `
            <div class="admin-safety-panel ${summary.level}">
                <div class="admin-safety-status">
                    <i class="fa-solid ${summary.label.icon}"></i>
                    <div>
                        <b>安全度: ${summary.label.text}</b>
                        <span>壊れた参照 ${summary.brokenTotal}件 / 重大品質 ${summary.qualityDanger}件 / 注意 ${summary.qualityWarning}件 / バックアップ履歴 ${summary.backupCount}件</span>
                        <button type="button" class="admin-safety-detail-btn" onclick="app.toggleAdminSafetyDetails(this)">
                            <i class="fa-solid fa-chevron-down"></i> 詳細
                        </button>
                    </div>
                </div>
                <div class="admin-next-actions">
                    <b><i class="fa-solid fa-list-check"></i> 次にやること</b>
                    ${summary.tasks.slice(0, 4).map(task => `
                        <div class="admin-next-action ${task.level}">
                            <span><i class="fa-solid ${task.icon}"></i> ${this.escapeHtml(task.text)}</span>
                            ${task.action ? `<button class="secondary-btn" onclick="${task.action}">${this.escapeHtml(task.label)}</button>` : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="admin-safety-details" hidden>
                    ${summary.details.map(item => `
                        <div class="admin-safety-detail-row ${item.level}">
                            <span>${this.escapeHtml(item.label)}</span>
                            <b>${item.count}</b>
                            ${item.action ? `<button type="button" class="secondary-btn" onclick="${item.action}">${this.escapeHtml(item.button)}</button>` : '<em>OK</em>'}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    toggleAdminSafetyDetails(button) {
        const panel = button?.closest('.admin-safety-panel');
        const details = panel?.querySelector('.admin-safety-details');
        if (!details) return;
        const nextHidden = !details.hidden;
        details.hidden = nextHidden;
        button.classList.toggle('open', !nextHidden);
        button.innerHTML = `<i class="fa-solid ${nextHidden ? 'fa-chevron-down' : 'fa-chevron-up'}"></i> 詳細`;
    }

    getAdminManagementTabCounts(brokenReport = this.getBrokenDataReport()) {
        const active = store.activeData || {};
        const archivedSuggestionCount = Object.values(active.archivedSuggestions || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
        const archiveCount =
            (store.getHistory({}) || []).map(h => (Array.isArray(h.workers) ? h.workers : [])).flat().filter(w => store.isWorkerArchived?.(w)).length
            + (active.machines || []).filter(m => m.deleted).length
            + (active.archivedMachineCategories || []).length
            + (active.archivedTasks || []).length
            + (active.archivedParts || []).length
            + (active.archivedMaintenanceTasks || []).length
            + (active.history || []).filter(h => h.isManualGuide).length
            + (active.archivedGuides || []).length;
        const qualityChecks = typeof this.getHistoryQualityChecks === 'function' ? this.getHistoryQualityChecks() : [];
        const qualityCount = qualityChecks.reduce((sum, check) => sum + (check.groups ? check.groups.length : check.items.length), 0);
        return {
            safety: this.getBrokenDataCount(brokenReport) + qualityCount,
            backup: this.getAdminBackupLogs().length,
            archive: archiveCount,
            suggest: archivedSuggestionCount,
            log: this.getAdminOperationLogs().length
        };
    }

    getInitialDataPreview(mode = 'empty') {
        const modeInfo = this.getInitialDataModeInfo(mode);
        const currentDeptId = store.data.currentDepartmentId || 'dept_default';
        const currentDept = store.data.departments.find(d => d.id === currentDeptId);
        const deptName = currentDept?.name || '初期部署';
        const initialDeptData = this.createInitialDepartmentData(mode);
        const skillExport = mode === 'keep_current_dept'
            ? this.getCurrentDeptSkillExportData()
            : { skillEvaluations: {}, manualSkills: [] };
        const skillEvalCount = Object.values(skillExport.skillEvaluations || {}).reduce((sum, evals) => sum + Object.keys(evals || {}).length, 0);
        return {
            mode,
            modeInfo,
            deptName,
            currentDeptId,
            exportDeptId: mode === 'keep_current_dept' ? currentDeptId : 'dept_default',
            initialDeptData,
            skillExport,
            counts: {
                machines: (initialDeptData.machines || []).length,
                tasks: (initialDeptData.tasks || []).length,
                history: (initialDeptData.history || []).length,
                parts: (initialDeptData.partsMaster || []).length,
                categories: (initialDeptData.machineCategories || []).length,
                workers: (initialDeptData.localTodoWorkers || []).length,
                memos: Object.keys(initialDeptData.memos || {}).length,
                todos: (initialDeptData.localTodos || []).length,
                skillEvaluations: skillEvalCount,
                manualSkills: (skillExport.manualSkills || []).length
            }
        };
    }

    renderAdminPreviewStats(counts) {
        const labels = [
            ['machines', '機械'], ['tasks', '周期設定'], ['history', '履歴'], ['parts', '部品'],
            ['categories', '装置区分'], ['workers', '作業者候補'], ['memos', 'メモ'], ['todos', 'ToDo'],
            ['skillEvaluations', 'スキル評価'], ['manualSkills', '手動スキル']
        ];
        return labels.map(([key, label]) => `
            <div class="admin-preview-stat">
                <span>${label}</span>
                <b>${counts[key] || 0}</b>
            </div>
        `).join('');
    }

    buildInitialDataPayload(preview) {
        return {
            type: 'maintenance_initialization_json',
            initializationMode: preview.modeInfo.key,
            initializationModeLabel: preview.modeInfo.label,
            createdAt: new Date().toISOString(),
            note: 'このJSONを通常の「取込」で読み込むと、選択した初期化状態に置き換えできます。',
            mainData: {
                currentDepartmentId: preview.exportDeptId,
                departments: [{ id: preview.exportDeptId, name: preview.deptName }],
                deptData: {
                    [preview.exportDeptId]: preview.initialDeptData
                },
                settings: {
                    currentFile: 'latest.json',
                    theme: store.data.settings?.theme || 'light'
                }
            },
            skillEvaluations: preview.skillExport.skillEvaluations,
            manualSkills: preview.skillExport.manualSkills
        };
    }

    openInitialDataExportPreview() {
        const mode = document.getElementById('initial-json-mode')?.value || 'empty';
        const preview = this.getInitialDataPreview(mode);
        this.pendingInitialDataPreview = preview;
        this.openModal('initial-json-preview', '初期化用JSONの事前確認', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="admin-preview-modal">
                    <div class="admin-preview-alert">
                        <i class="fa-solid fa-file-circle-plus"></i>
                        <div>
                            <b>${this.escapeHtml(preview.modeInfo.label)}</b>
                            <span>部署名: ${this.escapeHtml(preview.deptName)} / このボタンでは現在データは消えません。</span>
                        </div>
                    </div>
                    <div class="admin-preview-stats">
                        ${this.renderAdminPreviewStats(preview.counts)}
                    </div>
                    <div class="admin-preview-note">
                        <b>出力される内容</b>
                        <p>${preview.mode === 'keep_current_dept'
                            ? '現在の部署に関係するデータとスキル評価だけを残します。別部署に紐づくスキル評価は含めません。'
                            : '選択した初期状態だけを含むJSONを作ります。スキル評価と手動スキルは空になります。'}</p>
                    </div>
                </div>
            `;
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `
                    <button class="secondary-btn" onclick="app.closeModal()">キャンセル</button>
                    <button class="primary-btn" onclick="app.confirmInitialDataExport()"><i class="fa-solid fa-download"></i> この内容で出力</button>
                `;
            }
        });
    }

    confirmInitialDataExport() {
        const preview = this.pendingInitialDataPreview || this.getInitialDataPreview(document.getElementById('initial-json-mode')?.value || 'empty');
        const payload = this.buildInitialDataPayload(preview);
        this.downloadJsonText(
            `maintenance_initial_${preview.modeInfo.key}_${new Date().toISOString().split('T')[0]}.json`,
            JSON.stringify(payload, null, 2),
            '初期化用JSONを出力しました'
        );
        this.pendingInitialDataPreview = null;
        this.closeModal();
    }

    cleanupBrokenDataReferences() {
        const report = this.getBrokenDataReport();
        const cleanupCount = report.archivedMaintenanceTasks.length + report.archivedGuides.length + report.archivedTasks.length;
        if (cleanupCount <= 0) {
            alert('自動修復できる壊れた参照はありません。');
            return;
        }
        const ok = this.requireDangerConfirm(
            '壊れた参照を削除します。',
            `周期設定の参照: ${report.archivedMaintenanceTasks.length}件\n` +
            `手順書の参照: ${report.archivedGuides.length}件\n` +
            `スキル除外の参照: ${report.archivedTasks.length}件\n` +
            `機械が見つからない履歴 ${report.missingMachineHistories.length}件は自動削除せず、品質チェックで確認してください。`
        );
        if (!ok) return;
        const backupFilename = `maintenance_before_repair_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        this.downloadJsonText(
            backupFilename,
            store.exportAsJSON({ optimizeImages: true, mode: 'complete' }),
            '修復前バックアップを出力しました'
        );
        this.recordAdminBackupLog('repair', backupFilename);
        const active = store.activeData;
        active.archivedMaintenanceTasks = (active.archivedMaintenanceTasks || []).filter(id => !report.archivedMaintenanceTasks.includes(id));
        active.archivedGuides = (active.archivedGuides || []).filter(id => !report.archivedGuides.includes(id));
        active.archivedTasks = (active.archivedTasks || []).filter(key => !report.archivedTasks.includes(key));
        store.save();
        this.recordAdminOperationLog('repair', '壊れた参照を自動修復', `${cleanupCount}件`, { tab: 'safety' });
        this.renderWorkerMaintenanceModal();
        this.renderWorkers?.();
        this.showToast?.(`${cleanupCount}件の壊れた参照を修復しました`, 'success');
    }

    openBrokenDataDetailModal() {
        const report = this.getBrokenDataReport();
        const rows = this.getBrokenDataDetailRows(report);
        this.openModal('admin-broken-data-detail', '壊れたデータの詳細', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="admin-broken-detail">
                    <div class="admin-preview-alert ${rows.length ? 'danger' : 'ok'}">
                        <i class="fa-solid ${rows.length ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i>
                        <div>
                            <b>${rows.length ? `${rows.length}件の確認項目があります` : '壊れたデータは見つかりません'}</b>
                            <span>自動修復は削除済みデータへの参照だけを消します。機械不明履歴は履歴編集で確認してください。</span>
                        </div>
                    </div>
                    <div class="admin-broken-table">
                        ${rows.length === 0 ? '<p>詳細表示する項目はありません。</p>' : rows.map(row => `
                            <div class="admin-broken-row">
                                <span>${this.escapeHtml(row.label)}</span>
                                <b>${this.escapeHtml(row.title)}</b>
                                <small>ID: ${this.escapeHtml(row.id)}</small>
                                <div>${row.action}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `
                    <button class="secondary-btn" onclick="app.renderWorkerMaintenanceModal()">管理画面へ戻る</button>
                    <button class="primary-btn" onclick="app.closeModal(); app.switchView('history'); app.openHistoryQualityCheck?.();">
                        <i class="fa-solid fa-shield-halved"></i> 品質チェックを開く
                    </button>
                `;
            }
        });
    }

    exportInitialDataJson() {
        this.openInitialDataExportPreview();
    }

    exportAdminBackupJson() {
        const data = store.exportAsJSON({ optimizeImages: true, mode: 'complete' });
        const filename = `maintenance_admin_backup_${new Date().toISOString().split('T')[0]}.json`;
        this.downloadJsonText(filename, data, '現在データのバックアップを出力しました');
        this.recordAdminBackupLog('manual', filename);
        if (document.querySelector('.admin-backup-panel')) this.renderWorkerMaintenanceModal();
    }

    renderWorkerMaintenanceModal() {
        // Get all workers from history (including archived)
        const history = store.getHistory({});
        const workerSet = new Set();
        history.forEach(h => {
            const wList = Array.isArray(h.workers) ? h.workers : []; // Safety check
            wList.forEach(w => {
                if (typeof w === 'string') workerSet.add(w.trim());
            });
        });
        const allWorkers = Array.from(workerSet).filter(Boolean).sort();

        this.openModal('workers-maint', '管理画面', () => {
            const body = document.getElementById('modal-content');
            if (!body) return;
            const brokenReport = this.getBrokenDataReport();
            const autoFixCount = brokenReport.archivedMaintenanceTasks.length + brokenReport.archivedGuides.length + brokenReport.archivedTasks.length;
            const brokenTotal = this.getBrokenDataCount(brokenReport);
            const safetySummary = this.getAdminSafetySummary(brokenReport);

            body.innerHTML = `
                <div style="padding: 10px;">
                    ${this.renderAdminSafetyPanel(safetySummary)}
                    <div class="admin-init-export-panel">
                        <div>
                            <b><i class="fa-solid fa-file-circle-plus"></i> 初期化用JSON</b>
                            <span>通常の「取込」で読み込むと、選んだ初期状態に戻せるJSONを出力します。現在のデータはこのボタンでは消えません。</span>
                        </div>
                        <div class="admin-init-export-actions">
                            <select id="initial-json-mode" title="初期化用JSONの種類">
                                <option value="empty">完全初期化</option>
                                <option value="keep_current_dept">現在の部署だけ残す</option>
                                <option value="keep_machines">機械マスタだけ残す</option>
                                <option value="keep_categories">装置区分だけ残す</option>
                                <option value="keep_workers">作業者候補だけ残す</option>
                            </select>
                            <button class="secondary-btn" onclick="app.exportAdminBackupJson()">
                                <i class="fa-solid fa-shield"></i> 現在データをバックアップ
                            </button>
                            <button class="secondary-btn" onclick="app.exportInitialDataJson()">
                                <i class="fa-solid fa-magnifying-glass"></i> 内容確認して出力
                            </button>
                        </div>
                    </div>
                    <div class="admin-repair-panel ${brokenTotal ? 'has-issues' : 'ok'}">
                        <div>
                            <b><i class="fa-solid fa-screwdriver-wrench"></i> 壊れたデータ修復</b>
                            <span>
                                周期設定参照 ${brokenReport.archivedMaintenanceTasks.length}件 / 手順書参照 ${brokenReport.archivedGuides.length}件 / スキル除外参照 ${brokenReport.archivedTasks.length}件 / 機械不明履歴 ${brokenReport.missingMachineHistories.length}件
                            </span>
                        </div>
                        <div class="admin-repair-actions">
                            <button class="secondary-btn" onclick="app.cleanupBrokenDataReferences()" ${autoFixCount ? '' : 'disabled'}>
                                <i class="fa-solid fa-broom"></i> 参照を自動修復
                            </button>
                            <button class="secondary-btn" onclick="app.openBrokenDataDetailModal()" ${brokenTotal ? '' : 'disabled'}>
                                <i class="fa-solid fa-list-ul"></i> 詳細
                            </button>
                            <button class="secondary-btn" onclick="app.closeModal(); app.switchView('history'); app.openHistoryQualityCheck?.();">
                                <i class="fa-solid fa-shield-halved"></i> 品質チェック
                            </button>
                        </div>
                    </div>
                    ${this.renderAdminBackupLogPanel()}
                    ${this.renderAdminOperationLogPanel()}
                    <p style="font-size:0.85rem; color:var(--text-light); margin-bottom:16px;">
                        退職などでスキルマップから除外したい人を「アーカイブ」へ送ります。<br>
                        アーカイブへ送っても、過去のメンテナンス記録から名前が消えることはありません。
                    </p>
                    </div>

                    <div style="max-height: 300px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                        <table class="data-table" style="margin-bottom:0; width:100%;">
                            <thead>
                                <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                    <th style="padding:10px; border-bottom:1px solid var(--border);">作業員名</th>
                                    <th style="padding:10px; border-bottom:1px solid var(--border);">状態</th>
                                    <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allWorkers.map(w => {
                                    const isArchived = store.isWorkerArchived(w);
                                    return `
                                            <tr>
                                                <td style="font-weight:700;">${w}</td>
                                                <td>
                                                    ${isArchived 
                                                        ? '<span style="color:var(--text-light); font-size:0.75rem;"><i class="fa-solid fa-box-archive"></i> アーカイブ済</span>' 
                                                        : '<span style="color:var(--success); font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> 有効</span>'}
                                                </td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="${isArchived ? 'secondary-btn' : 'danger-btn'}" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleWorkerArchive('${w}')">
                                                        ${isArchived ? '復元' : 'アーカイブ'}
                                                    </button>
                                                    ${isArchived ? `
                                                        <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteWorker('${w.replace(/'/g, "\\'")}')">
                                                            <i class="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    ` : ''}
                                                </td>
                                            </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-industry"></i> アーカイブ済みの装置本体</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">機械名 / 型式</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(() => {
                                        const deletedMachines = store.activeData.machines.filter(m => m.deleted);
                                        if (deletedMachines.length === 0) return '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">アーカイブされた装置はありません</td></tr>';
                                        
                                        return deletedMachines.map(m => `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${m.name} <span style="font-weight:400; color:var(--text-light);">[${m.model || '-'}]</span></td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.restoreMachine('${m.id}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteMachine('${m.id}', '${m.name.replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('');
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-industry"></i> 装置区分（プルダウン項目）の管理</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colspan="3" style="padding:12px; background:var(--background);">
                                            <div style="display:flex; gap:8px;">
                                                <input type="text" id="new-cat-name" placeholder="新しい装置区分を入力" style="flex:1; padding:8px;" onkeydown="if(event.key==='Enter') app.addMachineCategoryAction()">
                                                <button class="primary-btn" style="padding:8px 16px;" onclick="app.addMachineCategoryAction()"><i class="fa-solid fa-plus"></i> 追加</button>
                                            </div>
                                        </td>
                                    </tr>
                                    ${(() => {
                                        const activeCats = store.activeData.machineCategories || [];
                                        const archCats = store.activeData.archivedMachineCategories || [];
                                        const all = [...activeCats.map(c => ({ name: c, archived: false })), ...archCats.map(c => ({ name: c, archived: true }))];
                                        all.sort((a,b) => a.name.localeCompare(b.name, 'ja'));
                                        
                                        if (all.length === 0) return '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-light);">登録されている装置区分はありません</td></tr>';
                                        
                                        return all.map(c => `
                                            <tr>
                                                <td style="font-weight:700;">${c.name}</td>
                                                <td>
                                                    ${c.archived 
                                                        ? '<span style="color:var(--text-light); font-size:0.75rem;"><i class="fa-solid fa-box-archive"></i> アーカイブ済</span>' 
                                                        : '<span style="color:var(--success); font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> 有効</span>'}
                                                </td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="${c.archived ? 'secondary-btn' : 'danger-btn'}" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleMachineCategoryArchive('${c.name.replace(/'/g, "\\'")}', ${c.archived})">
                                                        ${c.archived ? '復元' : 'アーカイブ'}
                                                    </button>
                                                    ${c.archived ? `
                                                        <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteMachineCategory('${c.name.replace(/'/g, "\\'")}')">
                                                            <i class="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    ` : ''}
                                                </td>
                                            </tr>
                                        `).join('');
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-eye-slash"></i> スキルマップから除外中の項目</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">除外中の項目 (作業内容)</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(store.activeData.archivedTasks || []).length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">除外中の項目はありません</td></tr>' : store.activeData.archivedTasks.map(tk => {
                                        const label = tk.split('__')[1] || '不明な作業';
                                        return `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${label}</td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleTaskArchive('${tk}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteTask('${tk}', '${label.replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-box-archive"></i> アーカイブ済みの部品マスター</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">部品名 / 型式</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(store.activeData.archivedParts || []).length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">アーカイブされた部品はありません</td></tr>' : store.activeData.archivedParts.map(key => {
                                        const [name, model] = key.split('::');
                                        return `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${name} <span style="font-weight:400; color:var(--text-light);">[${model || '-'}]</span></td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.togglePartArchive('${name.replace(/'/g, "\\'")}', '${(model || '').replace(/'/g, "\\'")}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeletePart('${name.replace(/'/g, "\\'")}', '${(model || '').replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-box-archive"></i> アーカイブ済みのメンテナンス周期設定</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">機械名 / 内容</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(store.activeData.archivedMaintenanceTasks || []).length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">アーカイブされた周期設定はありません</td></tr>' : store.activeData.archivedMaintenanceTasks.map(id => {
                                        const task = store.activeData.tasks.find(t => t.id === id);
                                        const machine = task ? store.getMachines(true).find(m => m.id === task.machineId) : null;
                                        const label = task ? `${machine ? machine.name : '不明な機械'} / ${task.content}` : `データ消失 (ID: ${id})`;
                                        const safeId = this.escapeHtml(this.escapeJs(id));
                                        const safeLabel = this.escapeHtml(this.escapeJs(label));
                                        return `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700; ${task ? '' : 'color:var(--danger);'}">${this.escapeHtml(label)}</td>
                                                <td style="display:flex; gap:6px;">
                                                    ${task ? `
                                                        <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleMaintenanceTaskArchive('${safeId}')">
                                                            復元
                                                        </button>
                                                    ` : ''}
                                                    <button class="${task ? 'icon-btn' : 'danger-btn'}" style="color:var(--danger); ${task ? 'padding:4px;' : 'padding:4px 10px;'} font-size:0.75rem;" title="${task ? '完全削除' : '壊れた参照を削除'}" onclick="app.hardDeleteMaintenanceTask('${safeId}', '${safeLabel}')">
                                                        ${task ? '' : '参照削除 '}
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-file-circle-plus"></i> 単独登録手順書</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">機械名 / 内容</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">状態</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(() => {
                                        const manualGuides = store.activeData.history.filter(h => h.isManualGuide);
                                        if (manualGuides.length === 0) return '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-light);">単独登録された手順書はありません</td></tr>';

                                        return manualGuides.map(h => {
                                            const isCommon = h.machineId === 'COMMON';
                                            const machine = isCommon ? null : store.getMachines(true).find(m => m.id === h.machineId);
                                            const machineLabel = isCommon ? '全般・共通' : (machine ? machine.name : '不明な機械');
                                            const title = this.getHistoryDisplayText(h);
                                            const statusLabel = store.isGuideArchived(h.id)
                                                ? '<span style="color:var(--text-light); font-size:0.75rem;"><i class="fa-solid fa-box-archive"></i> アーカイブ中</span>'
                                                : '<span style="color:var(--success); font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> 表示中</span>';

                                            return `
                                                <tr>
                                                    <td style="font-size:0.8rem; font-weight:700;">
                                                        ${this.escapeHtml(machineLabel)} / ${this.escapeHtml(title)}
                                                        ${h.guideCategory ? `<span style="margin-left:6px; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:1px 6px; border-radius:3px; font-size:0.65rem; font-weight:900;">${this.escapeHtml(h.guideCategory)}</span>` : ''}
                                                    </td>
                                                    <td>${statusLabel}</td>
                                                    <td style="display:flex; gap:6px;">
                                                        ${h.guide ? `<button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.openGuideModal('${h.id}')">開く</button>` : ''}
                                                        <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleGuideArchive('${h.id}')">
                                                            ${store.isGuideArchived(h.id) ? '復元' : 'アーカイブ'}
                                                        </button>
                                                        <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteGuide('${h.id}', '${title.replace(/'/g, "\\'")}')">
                                                            <i class="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('');
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-box-archive"></i> アーカイブ済みの手順書</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">機械名 / 内容</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(store.activeData.archivedGuides || []).length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">アーカイブされた手順書はありません</td></tr>' : store.activeData.archivedGuides.map(id => {
                                        const history = store.activeData.history.find(h => h.id === id);
                                        const machine = history ? store.getMachines(true).find(m => m.id === history.machineId) : null;
                                        const title = history ? this.getHistoryDisplayText(history) : `<span style="color:var(--danger);">データ消失 (ID: ${id})</span>`;
                                        const label = history ? `${machine ? machine.name : '不明な機械'} / ${title}` : title;
                                        return `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${label}</td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleGuideArchive('${id}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteGuide('${id}', '${(title || '').replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-eye-slash"></i> 非表示にしたサジェスト項目（自動補完）</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">種別</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">内容</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(() => {
                                        const arch = store.activeData.archivedSuggestions || {};
                                        const kinds = { workers: '作業者', cause: '原因', notes: '処置', content: '症状', partName: '部品名' };
                                        const rows = [];
                                        Object.keys(kinds).forEach(k => {
                                            (arch[k] || []).forEach(val => {
                                                rows.push({ kind: k, kindLabel: kinds[k], value: val });
                                            });
                                        });
                                        
                                        if (rows.length === 0) return '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-light);">非表示に設定されたサジェストはありません</td></tr>';
                                        
                                        return rows.map(r => `
                                            <tr>
                                                <td style="font-size:0.75rem; color:var(--text-light);">${r.kindLabel}</td>
                                                <td style="font-size:0.8rem; font-weight:700;">${r.value}</td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleArchivedSuggestion('${r.kind}', '${r.value.replace(/'/g, "\\'")}')">
                                                        表示に戻す
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteSuggestion('${r.kind}', '${r.value.replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('');
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            // Custom footer for this modal (override default)
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `<button class="primary-btn" onclick="app.closeModal()">閉じる</button>`;
            }
            this.enhanceWorkerMaintenanceModal();
        });
    }

    enhanceWorkerMaintenanceModal() {
        const body = document.getElementById('modal-content');
        if (!body || body.querySelector('.admin-toolbar')) return;
        const top = body.firstElementChild;
        if (top) {
            top.querySelector('.admin-safety-panel')?.setAttribute('data-admin-tab', 'safety');
            top.querySelector('.admin-repair-panel')?.setAttribute('data-admin-tab', 'safety');
            top.querySelector('.admin-init-export-panel')?.setAttribute('data-admin-tab', 'backup');
            top.querySelector('.admin-backup-panel')?.setAttribute('data-admin-tab', 'backup');
            top.querySelector('.admin-operation-panel')?.setAttribute('data-admin-tab', 'log');
        }
        const counts = this.getAdminManagementTabCounts();
        const density = localStorage.getItem('admin_management_density') || 'standard';
        body.classList.toggle('admin-density-compact', density === 'compact');
        Array.from(body.children).forEach((section, index) => {
            if (index === 0) return;
            const text = section.textContent || '';
            const tab = text.includes('サジェスト') ? 'suggest' : 'archive';
            section.setAttribute('data-admin-tab', tab);
            section.setAttribute('data-admin-search-area', '1');
        });
        const toolbar = document.createElement('div');
        toolbar.className = 'admin-toolbar';
        toolbar.innerHTML = `
            <div class="admin-tabs">
                <button type="button" data-admin-tab-btn="safety" onclick="app.setAdminManagementTab('safety')"><i class="fa-solid fa-shield-halved"></i> 安全チェック <em>${counts.safety}</em></button>
                <button type="button" data-admin-tab-btn="backup" onclick="app.setAdminManagementTab('backup')"><i class="fa-solid fa-clock-rotate-left"></i> バックアップ <em>${counts.backup}</em></button>
                <button type="button" data-admin-tab-btn="archive" onclick="app.setAdminManagementTab('archive')"><i class="fa-solid fa-box-archive"></i> アーカイブ <em>${counts.archive}</em></button>
                <button type="button" data-admin-tab-btn="suggest" onclick="app.setAdminManagementTab('suggest')"><i class="fa-solid fa-eye-slash"></i> サジェスト <em>${counts.suggest}</em></button>
                <button type="button" data-admin-tab-btn="log" onclick="app.setAdminManagementTab('log')"><i class="fa-solid fa-clipboard-list"></i> 操作ログ <em>${counts.log}</em></button>
            </div>
            <div class="admin-toolbar-right">
                <button type="button" class="admin-density-toggle" onclick="app.toggleAdminManagementDensity()" title="表示密度を切替">
                    <i class="fa-solid fa-table-list"></i> <span id="admin-density-label">${density === 'compact' ? 'コンパクト' : '標準'}</span>
                </button>
                <div class="admin-search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="search" id="admin-management-search" placeholder="管理画面内を検索" oninput="app.filterAdminManagementList(this.value)">
                </div>
            </div>
        `;
        body.insertBefore(toolbar, body.children[1] || null);
        const empty = document.createElement('div');
        empty.className = 'admin-search-empty';
        empty.hidden = true;
        empty.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i><b>該当する項目はありません</b><span>検索語を変えるか、別のタブを確認してください。</span>';
        body.insertBefore(empty, toolbar.nextSibling);
        this.setAdminManagementTab(this.adminManagementTab || 'safety');
    }

    toggleAdminManagementDensity() {
        const next = localStorage.getItem('admin_management_density') === 'compact' ? 'standard' : 'compact';
        localStorage.setItem('admin_management_density', next);
        const body = document.getElementById('modal-content');
        body?.classList.toggle('admin-density-compact', next === 'compact');
        const label = document.getElementById('admin-density-label');
        if (label) label.textContent = next === 'compact' ? 'コンパクト' : '標準';
    }

    setAdminManagementTab(tab = 'safety') {
        this.adminManagementTab = tab;
        const body = document.getElementById('modal-content');
        if (!body) return;
        body.querySelectorAll('[data-admin-tab]').forEach(el => {
            el.hidden = el.dataset.adminTab !== tab;
        });
        body.querySelectorAll('[data-admin-tab-btn]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.adminTabBtn === tab);
        });
        const search = document.getElementById('admin-management-search');
        if (search) {
            const searchable = ['archive', 'suggest'].includes(tab);
            search.disabled = !searchable;
            search.placeholder = searchable ? '管理画面内を検索' : 'このタブでは検索は不要です';
            if (!searchable) search.value = '';
        }
        this.filterAdminManagementList(search?.value || '');
    }

    filterAdminManagementList(query = '') {
        const q = MaintenanceStore.toHalfWidthLower(String(query || ''));
        const body = document.getElementById('modal-content');
        if (!body) return;
        let visibleSections = 0;
        body.querySelectorAll('[data-admin-search-area]').forEach(section => {
            if (section.dataset.adminTab !== this.adminManagementTab) {
                section.hidden = true;
                return;
            }
            let visibleRows = 0;
            section.querySelectorAll('tbody tr').forEach(row => {
                const match = !q || MaintenanceStore.toHalfWidthLower(row.textContent || '').includes(q);
                row.hidden = !match;
                if (match) visibleRows++;
            });
            section.hidden = q ? visibleRows === 0 : false;
            if (!section.hidden) visibleSections++;
        });
        const empty = body.querySelector('.admin-search-empty');
        if (empty) empty.hidden = !(q && ['archive', 'suggest'].includes(this.adminManagementTab) && visibleSections === 0);
    }

    toggleWorkerArchive(name) {
        const wasArchived = store.isWorkerArchived(name);
        store.toggleWorkerArchive(name);
        this.recordAdminOperationLog(wasArchived ? 'restore' : 'archive', wasArchived ? '作業者を復元' : '作業者をアーカイブ', name, { tab: 'archive', search: name });
        this.renderWorkerMaintenanceModal();
        this.renderWorkers();
    }

    toggleTaskArchive(tk) {
        const wasArchived = (store.activeData.archivedTasks || []).includes(tk);
        store.toggleTaskArchive(tk);
        this.recordAdminOperationLog(wasArchived ? 'restore' : 'archive', wasArchived ? 'スキル項目を復元' : 'スキル項目をアーカイブ', tk.split('__')[1] || tk, { tab: 'archive', search: tk.split('__')[1] || tk });
        this.renderWorkerMaintenanceModal();
        this.renderWorkers();
    }

    toggleArchivedSuggestion(kind, value) {
        store.toggleArchivedSuggestion(kind, value);
        this.recordAdminOperationLog('restore', 'サジェストを表示に戻す', value, { tab: 'suggest', search: value });
        this.renderWorkerMaintenanceModal();
    }

    archivePart(name, model) {
        if (confirm(`部品「${name} [${model}]」をアーカイブしますか？\n（分析画面の一覧から非表示になります。管理画面から復元可能です）`)) {
            store.togglePartArchive(name, model);
            this.recordAdminOperationLog('archive', '部品をアーカイブ', `${name} [${model || '-'}]`, { tab: 'archive', search: name });
            this.renderAnalysis();
        }
    }

    archiveGuide(id, title) {
        if (confirm(`手順書「${title}」をアーカイブしますか？\n（手順書一覧から非表示になります。管理画面から復元可能です）`)) {
            store.toggleGuideArchive(id);
            this.recordAdminOperationLog('archive', '手順書をアーカイブ', title, { tab: 'archive', search: title });
            this.renderGuides();
        }
    }

    archiveMaintenanceTask(id, content) {
        if (confirm(`周期設定「${content}」をアーカイブしますか？\n（メイン画面やカレンダーから非表示になります。管理画面から復元可能です）`)) {
            store.toggleMaintenanceTaskArchive(id);
            this.recordAdminOperationLog('archive', '周期設定をアーカイブ', content, { tab: 'archive', search: content });
            this.closeModal(); // Close Machine Edit Modal
            this.renderMachines();
            this.renderCalendar();
        }
    }

    deleteMaintenanceTaskFromMachineModal(id, content, btn) {
        if (!confirm(`周期設定「${content}」を削除しますか？\nアーカイブには送らず、メンテ設定画面から削除します。\n完了済みのカレンダー履歴は残ります。周期0日の未完了予定はカレンダーに残ります。`)) return;

        store.softDeleteMaintenanceTask(id);
        this.recordAdminOperationLog('delete', '周期設定を削除', content, { tab: 'archive', search: content });
        const row = btn?.closest('.task-row');
        if (row) row.remove();
        this.updateDataLists();
        this.renderMachines();
        this.renderCalendar();
    }

    toggleMaintenanceTaskArchive(id) {
        const task = store.activeData.tasks.find(t => String(t.id) === String(id));
        const wasArchived = (store.activeData.archivedMaintenanceTasks || []).map(String).includes(String(id));
        store.toggleMaintenanceTaskArchive(id);
        this.recordAdminOperationLog(wasArchived ? 'restore' : 'archive', wasArchived ? '周期設定を復元' : '周期設定をアーカイブ', task?.content || id, { tab: 'archive', search: task?.content || id });
        this.renderWorkerMaintenanceModal();
        this.renderMachines();
        this.renderCalendar();
    }

    toggleGuideArchive(id) {
        const h = store.activeData.history.find(item => String(item.id) === String(id));
        const wasArchived = (store.activeData.archivedGuides || []).map(String).includes(String(id));
        store.toggleGuideArchive(id);
        this.recordAdminOperationLog(wasArchived ? 'restore' : 'archive', wasArchived ? '手順書を復元' : '手順書をアーカイブ', h ? this.getHistoryDisplayText(h) : id, h ? { view: 'guide', id } : { tab: 'archive', search: id });
        this.renderWorkerMaintenanceModal();
        this.renderGuides();
    }

    togglePartArchive(name, model) {
        const key = `${name}::${model || ''}`;
        const wasArchived = (store.activeData.archivedParts || []).includes(key);
        store.togglePartArchive(name, model);
        this.recordAdminOperationLog(wasArchived ? 'restore' : 'archive', wasArchived ? '部品を復元' : '部品をアーカイブ', `${name} [${model || '-'}]`, { tab: 'archive', search: name });
        this.renderWorkerMaintenanceModal();
        this.renderAnalysis();
    }

    toggleMachineCategoryArchive(name) {
        const wasArchived = (store.activeData.archivedMachineCategories || []).includes(name);
        store.toggleMachineCategoryArchive(name);
        this.recordAdminOperationLog(wasArchived ? 'restore' : 'archive', wasArchived ? '装置区分を復元' : '装置区分をアーカイブ', name, { tab: 'archive', search: name });
        this.renderWorkerMaintenanceModal(); 
    }

    addMachineCategoryAction() {
        const input = document.getElementById('new-cat-name');
        if (!input || !input.value.trim()) return;
        
        if (store.addMachineCategory(input.value)) {
            this.recordAdminOperationLog('restore', '装置区分を追加', input.value.trim(), { tab: 'archive', search: input.value.trim() });
            input.value = '';
            this.renderWorkerMaintenanceModal();
            this.updateDataLists();
        } else {
            alert('その区分は既に登録されているか、アーカイブされています。');
        }
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppArchiveMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppArchiveMethods.prototype[name];
        }
    }
})();
