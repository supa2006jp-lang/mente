(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppPersistenceMethods extends MaintenanceApp {
    getImportPreviewInfo(jsonText, fileName = '') {
        const imported = JSON.parse(jsonText);
        const dataToLoad = imported.mainData || imported;
        const currentDeptId = store.data.currentDepartmentId || 'dept_default';
        const incomingDeptId = dataToLoad.currentDepartmentId
            || Object.keys(dataToLoad.deptData || {})[0]
            || 'dept_default';
        const incomingDept = (dataToLoad.deptData || {})[incomingDeptId]
            || dataToLoad.deptData?.dept_default
            || dataToLoad
            || {};
        const currentDept = store.activeData || {};
        const skillEvaluations = imported.skillEvaluations || {};
        const manualSkills = imported.manualSkills || [];
        const skillEvalCount = Object.values(skillEvaluations || {}).reduce((sum, evals) => sum + Object.keys(evals || {}).length, 0);
        const countDept = (dept) => ({
            machines: (dept.machines || []).length,
            tasks: (dept.tasks || []).length,
            history: (dept.history || []).length,
            parts: (dept.partsMaster || []).length,
            categories: (dept.machineCategories || []).length,
            workers: (dept.localTodoWorkers || []).length,
            memos: Object.keys(dept.memos || {}).length,
            todos: (dept.localTodos || []).length,
            skillEvaluations: skillEvalCount,
            manualSkills: (manualSkills || []).length
        });
        const incomingDeptName = (dataToLoad.departments || []).find(d => String(d.id) === String(incomingDeptId))?.name
            || imported.departmentName
            || '不明';
        const currentDeptName = store.data.departments.find(d => String(d.id) === String(currentDeptId))?.name || '現在の部署';
        let currentSkillEvaluations = {};
        let currentManualSkills = [];
        try { currentSkillEvaluations = JSON.parse(localStorage.getItem('skillEvaluations') || '{}'); } catch (e) {}
        try { currentManualSkills = JSON.parse(localStorage.getItem('manualSkills') || '[]'); } catch (e) {}
        const currentSkillEvalCount = Object.values(currentSkillEvaluations || {}).reduce((sum, evals) => sum + Object.keys(evals || {}).length, 0);
        let typeLabel = '全データJSON';
        let dangerLabel = '現在の全データを置き換えます';
        if (imported?.type === 'maintenance_initialization_json') {
            typeLabel = imported.initializationModeLabel || '初期化用JSON';
            dangerLabel = `初期化用JSON: ${typeLabel}`;
        } else if (imported?.type === 'single_department_backup') {
            typeLabel = '部署単体バックアップ';
            dangerLabel = '全データ取込ではなく「部署取込」向けのファイルです';
        }
        return {
            raw: imported,
            jsonText,
            fileName,
            incomingDeptId,
            incomingDeptName,
            currentDeptName,
            typeLabel,
            dangerLabel,
            isInitialJson: imported?.type === 'maintenance_initialization_json',
            isSingleDept: imported?.type === 'single_department_backup',
            incomingCounts: countDept(incomingDept),
            currentCounts: {
                ...countDept(currentDept),
                skillEvaluations: currentSkillEvalCount,
                manualSkills: currentManualSkills.length
            }
        };
    }

    renderImportDiffRows(preview) {
        const labels = [
            ['machines', '機械'], ['tasks', '周期設定'], ['history', '履歴'], ['parts', '部品'],
            ['categories', '装置区分'], ['workers', '作業者候補'], ['memos', 'メモ'], ['todos', 'ToDo'],
            ['skillEvaluations', 'スキル評価'], ['manualSkills', '手動スキル']
        ];
        return labels.map(([key, label]) => {
            const current = preview.currentCounts[key] || 0;
            const incoming = preview.incomingCounts[key] || 0;
            const diff = incoming - current;
            const diffClass = diff > 0 ? 'plus' : (diff < 0 ? 'minus' : '');
            const isCriticalKey = ['machines', 'tasks', 'history', 'skillEvaluations', 'manualSkills'].includes(key);
            const isDangerDrop = isCriticalKey && current > 0 && (incoming === 0 || incoming <= Math.floor(current * 0.5));
            const sign = diff > 0 ? '+' : '';
            return `
                <div class="admin-import-diff-row ${isDangerDrop ? 'danger-drop' : ''}">
                    <span>${label}${isDangerDrop ? '<small>要確認</small>' : ''}</span>
                    <b>${current}</b>
                    <i class="fa-solid fa-arrow-right-long"></i>
                    <strong>${incoming}</strong>
                    <em class="${diffClass}">${sign}${diff}</em>
                </div>
            `;
        }).join('');
    }

    openImportPreviewModal(preview) {
        this.pendingFullImportPreview = preview;
        this.openModal('full-import-preview', '取込前の確認', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="admin-import-preview">
                    <div class="admin-preview-alert danger">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <div>
                            <b>${this.escapeHtml(preview.dangerLabel)}</b>
                            <span>${this.escapeHtml(preview.fileName || '選択ファイル')} / 取込前に現在データのバックアップを自動で出力します。</span>
                        </div>
                    </div>
                    ${preview.isSingleDept ? `
                        <div class="admin-preview-note danger">
                            <b>注意</b>
                            <p>これは部署取込向けのファイルです。全データ取込で続行すると、形式が合わず失敗する可能性があります。</p>
                        </div>
                    ` : ''}
                    <div class="admin-import-summary">
                        <div><span>現在</span><b>${this.escapeHtml(preview.currentDeptName)}</b></div>
                        <div><span>取込後</span><b>${this.escapeHtml(preview.incomingDeptName)}</b></div>
                        <div><span>種類</span><b>${this.escapeHtml(preview.typeLabel)}</b></div>
                    </div>
                    <div class="admin-import-diff">
                        <div class="admin-import-diff-head">
                            <span>項目</span><b>現在</b><i></i><strong>取込後</strong><em>差分</em>
                        </div>
                        ${this.renderImportDiffRows(preview)}
                    </div>
                </div>
            `;
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `
                    <button class="secondary-btn" onclick="app.pendingFullImportPreview=null; app.closeModal()">キャンセル</button>
                    <button class="secondary-btn" onclick="app.exportAdminBackupJson?.()"><i class="fa-solid fa-shield"></i> 手動バックアップ</button>
                    <button class="danger-btn" onclick="app.confirmFullImportFromPreview()"><i class="fa-solid fa-upload"></i> バックアップして取込</button>
                `;
            }
        });
    }

    confirmFullImportFromPreview() {
        const preview = this.pendingFullImportPreview;
        if (!preview) return;
        const ok = this.requireDangerConfirm?.(
            '全データを取込ファイルで置き換えます。',
            '現在データは取込前バックアップを出力してから置き換えます。続行すると画面を再読み込みします。'
        ) ?? confirm('現在データをバックアップしてから、選択したJSONで全データを置き換えます。続行しますか？');
        if (!ok) return;
        const backupFilename = `maintenance_before_import_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        this.downloadJsonText?.(
            backupFilename,
            store.exportAsJSON(),
            '取込前バックアップを出力しました'
        );
        this.recordAdminBackupLog?.('import', backupFilename);
        this.recordAdminOperationLog?.('import', '全データ取込を実行', preview.fileName || preview.typeLabel || 'JSON', { tab: 'backup' });
        if (store.importFromJSON(preview.jsonText)) {
            localStorage.setItem('maintenance_pending_import_result', JSON.stringify({
                at: new Date().toISOString(),
                fileName: preview.fileName,
                typeLabel: preview.typeLabel,
                incomingDeptName: preview.incomingDeptName,
                incomingCounts: preview.incomingCounts,
                currentCounts: preview.currentCounts
            }));
            this.pendingFullImportPreview = null;
            location.reload();
        } else {
            alert('インポートに失敗しました。ファイル形式を確認してください。');
        }
    }

    openPendingImportResultIfAny() {
        let result = null;
        try { result = JSON.parse(localStorage.getItem('maintenance_pending_import_result') || 'null'); } catch (e) {}
        if (!result) return;
        localStorage.removeItem('maintenance_pending_import_result');
        setTimeout(() => this.openImportResultModal(result), 400);
    }

    openImportResultModal(result) {
        this.openModal('full-import-result', '取込結果', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="admin-import-result">
                    <div class="admin-preview-alert ok">
                        <i class="fa-solid fa-circle-check"></i>
                        <div>
                            <b>取込が完了しました</b>
                            <span>${this.escapeHtml(result.fileName || '選択ファイル')} / ${this.escapeHtml(result.typeLabel || 'JSON')}</span>
                        </div>
                    </div>
                    <div class="admin-import-summary">
                        <div><span>取込先</span><b>${this.escapeHtml(result.incomingDeptName || '不明')}</b></div>
                        <div><span>実行日時</span><b>${this.escapeHtml(this.formatAdminBackupTime?.(result.at) || result.at || '-')}</b></div>
                        <div><span>バックアップ</span><b>取込前に自動出力済み</b></div>
                    </div>
                    <div class="admin-preview-stats">
                        ${this.renderAdminPreviewStats?.(result.incomingCounts || {}) || ''}
                    </div>
                    <div class="admin-preview-note">
                        <b>読み込んだ内容</b>
                        <p>機械 ${result.incomingCounts?.machines || 0}件、履歴 ${result.incomingCounts?.history || 0}件、周期設定 ${result.incomingCounts?.tasks || 0}件、スキル評価 ${result.incomingCounts?.skillEvaluations || 0}件を読み込みました。</p>
                    </div>
                </div>
            `;
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `
                    <button class="secondary-btn" onclick="app.closeModal(); app.openWorkerMaintenance()">管理画面を開く</button>
                    <button class="primary-btn" onclick="app.closeModal()">閉じる</button>
                `;
            }
        });
    }

    // --- Persistence Effects ---
    setupSideEffects() {
        const importBtn = document.getElementById('btn-import-trigger');
        const fileInput = document.getElementById('btn-import');
        
        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    const text = event.target.result;
                    try {
                        const preview = this.getImportPreviewInfo(text, file.name);
                        this.openImportPreviewModal(preview);
                    } catch (error) {
                        alert('インポートに失敗しました。ファイル形式を確認してください。');
                    }
                    fileInput.value = '';
                };
                reader.readAsText(file);
            });
        }

        const exportBtn = document.getElementById('btn-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const data = store.exportAsJSON();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                // 1. Download timestamped backup (for user record)
                const aBatch = document.createElement('a');
                aBatch.href = url;
                aBatch.download = `maintenance_ALL_backup_${new Date().toISOString().split('T')[0]}.json`;
                aBatch.click();

                // Small delay to ensure browser handles both
                setTimeout(() => {
                    // 2. Download latest.json (for shared use)
                    const aLatest = document.createElement('a');
                    aLatest.href = url;
                    aLatest.download = `latest.json`;
                    aLatest.click();
                    URL.revokeObjectURL(url);
                }, 100);
            });
        }

        // --- Single Dept Export ---
        const exportDeptBtn = document.getElementById('btn-export-dept');
        if (exportDeptBtn) {
            exportDeptBtn.addEventListener('click', () => {
                const deptName = store.data.departments.find(d => d.id === store.data.currentDepartmentId)?.name || 'dept';
                const data = store.exportCurrentDeptAsJSON();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `maintenance_${deptName}_only_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        // --- Single Dept Import ---
        const importDeptTrigger = document.getElementById('btn-import-dept-trigger');
        const fileDeptInput = document.getElementById('btn-import-dept');
        if (importDeptTrigger && fileDeptInput) {
            importDeptTrigger.addEventListener('click', () => fileDeptInput.click());
            fileDeptInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const currentDeptName = store.data.departments.find(d => d.id === store.data.currentDepartmentId)?.name || '不明';
                if (!confirm(`現在開いている「${currentDeptName}」のデータのみを、選択したファイルの内容で上書きしますか？\n他の部署のデータには影響しません。`)) {
                    fileDeptInput.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    const result = store.importToCurrentDeptFromJSON(event.target.result);
                    if (result.success) {
                        alert(`「${currentDeptName}」のデータを更新しました。`);
                        location.reload();
                    } else {
                        alert(result.message);
                    }
                };
                reader.readAsText(file);
                fileDeptInput.value = ''; // reset for next use
            });
        }

        // Worktime Memo Persistence (Per Department)
        const wtMemo = document.getElementById('worktime-memo');
        if (wtMemo) {
            const deptId = store.data.currentDepartmentId || 'default';
            const memoKey = `worktime_memo_${deptId}`;
            wtMemo.value = localStorage.getItem(memoKey) || '';
            wtMemo.addEventListener('input', (e) => {
                localStorage.setItem(memoKey, e.target.value);
            });
        }

        this.openPendingImportResultIfAny();
    }

    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppPersistenceMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppPersistenceMethods.prototype[name];
        }
    }
})();
