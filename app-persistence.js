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
        const deptNameMismatch = !!(incomingDeptName && currentDeptName && incomingDeptName !== '不明' && currentDeptName !== '現在の部署' && incomingDeptName !== currentDeptName);
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
            deptNameMismatch,
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
                    ${preview.deptNameMismatch ? `
                        <div class="admin-preview-note danger">
                            <b>部署名が違います</b>
                            <p>現在開いている部署は「${this.escapeHtml(preview.currentDeptName)}」、取込ファイル側は「${this.escapeHtml(preview.incomingDeptName)}」です。別部署のデータを読み込む可能性があります。</p>
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

    async confirmFullImportFromPreview() {
        const preview = this.pendingFullImportPreview;
        if (!preview) return;
        const importBtn = document.querySelector('.modal-footer .danger-btn');
        if (preview.deptNameMismatch) {
            const mismatchOk = confirm(`部署名が違います。\n\n現在: ${preview.currentDeptName}\n取込ファイル: ${preview.incomingDeptName}\n\nこのまま全データ取込を続行しますか？`);
            if (!mismatchOk) return;
        }
        const ok = this.requireDangerConfirm?.(
            '全データを取込ファイルで置き換えます。',
            '現在データは取込前バックアップを出力してから置き換えます。続行すると画面を再読み込みします。'
        ) ?? confirm('現在データをバックアップしてから、選択したJSONで全データを置き換えます。続行しますか？');
        if (!ok) return;
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';
        }
        const backupFilename = `maintenance_before_import_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        this.downloadJsonText?.(
            backupFilename,
            store.exportAsJSON({ optimizeImages: true, mode: 'complete' }),
            '取込前バックアップを出力しました'
        );
        this.recordAdminBackupLog?.('import', backupFilename);
        this.recordAdminOperationLog?.('import', '全データ取込を実行', preview.fileName || preview.typeLabel || 'JSON', { tab: 'backup' });
        if (await store.importFromJSON(preview.jsonText)) {
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
            if (importBtn) {
                importBtn.disabled = false;
                importBtn.innerHTML = '<i class="fa-solid fa-upload"></i> バックアップして取込';
            }
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

    formatExportBytes(bytes = 0) {
        const value = Math.max(0, Number(bytes) || 0);
        if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 1 : 2)}MB`;
        if (value >= 1024) return `${(value / 1024).toFixed(1)}KB`;
        return `${Math.round(value)}B`;
    }

    getBackupExportAnalysis(scope = 'all') {
        const target = scope === 'dept' ? store.activeData : store.data;
        const images = store.analyzeImageStorage(target);
        const rawText = scope === 'dept' ? store.exportCurrentDeptAsJSON() : store.exportAsJSON();
        const originalSummary = store.getRemovableOriginalImageSummary(target);
        const unused = typeof this.getUnusedPhotoManagerLibraryItems === 'function'
            ? this.getUnusedPhotoManagerLibraryItems()
            : [];
        return {
            images,
            rawJsonBytes: new Blob([rawText]).size,
            originalSummary,
            unusedCount: unused.length,
            unusedBytes: unused.reduce((sum, item) => sum + store.estimateDataUrlBytes(item.src), 0)
        };
    }

    renderBackupCapacityRows(analysis) {
        const labels = {
            library: '写真管理', history: '履歴・手順書', notebook: '連絡帳・5S',
            originals: '編集用の元画像', recent: '最近使った画像', trash: 'ゴミ箱', other: 'その他の画像'
        };
        const order = ['library', 'history', 'notebook', 'originals', 'recent', 'trash', 'other'];
        return order.map(key => {
            const item = analysis.images.categories[key] || { count: 0, bytes: 0 };
            return `
                <div class="backup-capacity-row">
                    <span>${labels[key]}</span>
                    <b>${item.count}件</b>
                    <strong>${this.formatExportBytes(item.bytes)}</strong>
                </div>
            `;
        }).join('');
    }

    openBackupExportModal(scope = 'all') {
        const analysis = this.getBackupExportAnalysis(scope);
        this.pendingBackupExportScope = scope;
        this.openModal('backup-export-options', scope === 'dept' ? '部署データの出力' : 'JSONバックアップの出力', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="backup-export-panel">
                    <div class="admin-preview-alert ok">
                        <i class="fa-solid fa-chart-pie"></i>
                        <div>
                            <b>現在のJSON容量 ${this.formatExportBytes(analysis.rawJsonBytes)}</b>
                            <span>画像 ${analysis.images.occurrences}個（実体 ${analysis.images.uniqueCount}個）／重複分 約${this.formatExportBytes(analysis.images.duplicateBytes)}</span>
                        </div>
                    </div>
                    <div class="backup-capacity-list">
                        <div class="backup-capacity-head"><span>保存場所</span><b>画像数</b><strong>画像実容量</strong></div>
                        ${this.renderBackupCapacityRows(analysis)}
                    </div>
                    <div class="backup-export-choices">
                        <button type="button" class="backup-export-choice recommended" onclick="app.exportOptimizedBackup('light', '${scope}')">
                            <i class="fa-solid fa-feather-pointed"></i>
                            <span><b>軽量バックアップ <em id="backup-light-size">計算中…</em></b><small>最近使用・ゴミ箱・編集用元画像を除外。同一画像は1回だけ保存します。</small></span>
                        </button>
                        <button type="button" class="backup-export-choice" onclick="app.exportOptimizedBackup('complete', '${scope}')">
                            <i class="fa-solid fa-box-archive"></i>
                            <span><b>完全バックアップ <em id="backup-complete-size">計算中…</em></b><small>ゴミ箱や元画像を含め、同一画像だけ重複排除して保存します。</small></span>
                        </button>
                    </div>
                    <div class="backup-cleanup-panel">
                        <b>保存データ自体を整理</b>
                        <p>ここで削除した内容は次回以降のJSONにも含まれません。必ず確認後に実行します。</p>
                        <div class="backup-cleanup-actions">
                            <button type="button" class="secondary-btn" onclick="app.openUnusedImagesFromBackup()">
                                <i class="fa-solid fa-broom"></i> 未使用画像 ${analysis.unusedCount}件（約${this.formatExportBytes(analysis.unusedBytes)}）
                            </button>
                            <button type="button" class="secondary-btn" onclick="app.confirmRemoveStoredOriginalImages('${scope}')">
                                <i class="fa-solid fa-images"></i> 元画像 ${analysis.originalSummary.count}件（約${this.formatExportBytes(analysis.originalSummary.bytes)}）
                            </button>
                            <button type="button" class="secondary-btn" onclick="app.closeModal(); app.openPhotoManagerTrashDialog?.()">
                                <i class="fa-solid fa-trash-restore"></i> ゴミ箱を確認
                            </button>
                        </div>
                    </div>
                </div>
            `;
            const footer = document.querySelector('.modal-footer');
            if (footer) footer.innerHTML = '<button class="secondary-btn" onclick="app.closeModal()">閉じる</button>';
            setTimeout(() => this.updateBackupExportEstimates(scope), 0);
        });
    }

    async updateBackupExportEstimates(scope = 'all') {
        const calculate = async (mode, elementId) => {
            await new Promise(resolve => setTimeout(resolve, 20));
            const text = scope === 'dept'
                ? store.exportCurrentDeptAsJSON({ optimizeImages: true, mode })
                : store.exportAsJSON({ optimizeImages: true, mode });
            const element = document.getElementById(elementId);
            if (element) element.textContent = `予想 ${this.formatExportBytes(new Blob([text]).size)}`;
        };
        try {
            await calculate('light', 'backup-light-size');
            await calculate('complete', 'backup-complete-size');
        } catch (error) {
            ['backup-light-size', 'backup-complete-size'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.textContent = '計算できません';
            });
            console.error('Backup size estimate failed', error);
        }
    }

    exportOptimizedBackup(mode = 'light', scope = 'all') {
        const options = { optimizeImages: true, mode: mode === 'complete' ? 'complete' : 'light' };
        const data = scope === 'dept' ? store.exportCurrentDeptAsJSON(options) : store.exportAsJSON(options);
        const date = new Date().toISOString().split('T')[0];
        const modeLabel = options.mode === 'light' ? 'light' : 'complete';
        const deptName = store.data.departments.find(d => d.id === store.data.currentDepartmentId)?.name || 'dept';
        const filename = scope === 'dept'
            ? `maintenance_${deptName}_${modeLabel}_${date}.json`
            : `maintenance_ALL_${modeLabel}_${date}.json`;
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const download = (name) => {
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
        };
        download(filename);
        if (scope === 'all') {
            setTimeout(() => {
                download('latest.json');
                URL.revokeObjectURL(url);
            }, 120);
        } else {
            setTimeout(() => URL.revokeObjectURL(url), 120);
        }
        this.showToast?.(`${options.mode === 'light' ? '軽量' : '完全'}バックアップを出力しました（${this.formatExportBytes(blob.size)}）`, 'success');
        this.closeModal();
    }

    openUnusedImagesFromBackup() {
        const unused = this.getUnusedPhotoManagerLibraryItems?.() || [];
        if (!unused.length) {
            alert('削除できる未使用画像はありません。');
            return;
        }
        this.closeModal();
        this.openPhotoManagerDeleteReview?.('unused', unused);
    }

    confirmRemoveStoredOriginalImages(scope = 'all') {
        const target = scope === 'dept' ? store.activeData : store.data;
        const summary = store.getRemovableOriginalImageSummary(target);
        if (!summary.count) {
            alert('削除できる編集用元画像はありません。');
            return;
        }
        const ok = confirm(`加工後の画像は残したまま、編集用の元画像 ${summary.count}件（約${this.formatExportBytes(summary.bytes)}）を完全削除します。\n元画像へ戻す操作はできなくなります。よろしいですか？`);
        if (!ok) return;
        const removed = store.removeStoredOriginalImages(target);
        this.showToast?.(`編集用元画像 ${removed}件を削除しました`, 'success');
        this.closeModal();
        this.openBackupExportModal(scope);
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
            exportBtn.addEventListener('click', () => this.openBackupExportModal('all'));
        }

        // --- Single Dept Export ---
        const exportDeptBtn = document.getElementById('btn-export-dept');
        if (exportDeptBtn) {
            exportDeptBtn.addEventListener('click', () => this.openBackupExportModal('dept'));
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
                const reader = new FileReader();
                reader.onload = async (event) => {
                    let incomingDeptName = '不明';
                    try {
                        const imported = JSON.parse(event.target.result || '{}');
                        incomingDeptName = imported.departmentName || imported.mainData?.departments?.find?.(d => d.id === imported.mainData?.currentDepartmentId)?.name || '不明';
                    } catch (error) {}
                    if (incomingDeptName !== '不明' && currentDeptName !== '不明' && incomingDeptName !== currentDeptName) {
                        const mismatchOk = confirm(`部署名が違います。\n\n現在開いている部署: ${currentDeptName}\n取込ファイルの部署: ${incomingDeptName}\n\nこのまま「${currentDeptName}」へ上書きしますか？`);
                        if (!mismatchOk) {
                            fileDeptInput.value = '';
                            return;
                        }
                    }
                    if (!confirm(`現在開いている「${currentDeptName}」のデータのみを、選択したファイルの内容で上書きしますか？\n他の部署のデータには影響しません。`)) {
                        fileDeptInput.value = '';
                        return;
                    }
                    const result = await store.importToCurrentDeptFromJSON(event.target.result);
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
