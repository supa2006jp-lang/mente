(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppPersistenceMethods extends MaintenanceApp {
    getSeparateMediaReferenceKeys(data = store.data) {
        const keys = new Set();
        const visited = new WeakSet();
        const visit = value => {
            if (!value || typeof value !== 'object' || visited.has(value)) return;
            visited.add(value);
            if (typeof value.recordedAudioKey === 'string' && value.recordedAudioKey) keys.add(value.recordedAudioKey);
            if (typeof value.mediaKey === 'string' && value.mediaKey
                && !['local-handle', 'url', 'youtube'].includes(value.sourceType)) keys.add(value.mediaKey);
            Object.values(value).forEach(visit);
        };
        for (const [deptId, dept] of Object.entries(data?.deptData || {})) {
            for (const video of dept?.photoManagerVideos || []) {
                if (video?.id && !video.sourceType) keys.add(`video:${deptId}:${String(video.id)}`);
            }
            visit(dept);
        }
        if (!data?.deptData) visit(data);
        return keys;
    }

    hasSeparateMediaReferences(data = store.data) {
        return this.getSeparateMediaReferenceKeys(data).size > 0;
    }

    async blobToBackupBase64(blob) {
        if (typeof FileReader !== 'undefined') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = String(reader.result || '');
                    const separator = result.indexOf(',');
                    if (separator < 0) reject(new Error('メディアをJSONへ変換できませんでした。'));
                    else resolve(result.slice(separator + 1));
                };
                reader.onerror = () => reject(reader.error || new Error('メディアを読み込めませんでした。'));
                reader.onabort = () => reject(new Error('メディアの読み込みが中断されました。'));
                reader.readAsDataURL(blob);
            });
        }
        if (typeof btoa !== 'function' || typeof blob?.arrayBuffer !== 'function') {
            throw new Error('メディアをJSONへ変換できないブラウザーです。');
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const chunks = [];
        for (let offset = 0; offset < bytes.length; offset += 24576) {
            const slice = bytes.subarray(offset, offset + 24576);
            let binary = '';
            for (const byte of slice) binary += String.fromCharCode(byte);
            chunks.push(btoa(binary));
        }
        return chunks.join('');
    }

    async collectCompleteBackupMediaEntries(dataSnapshot = store.data) {
        if (typeof store.listMediaEntries !== 'function' || typeof store.loadMediaBlob !== 'function') {
            if (this.hasSeparateMediaReferences(dataSnapshot)) throw new Error('音声・動画の保存領域を確認できません。');
            return [];
        }
        if (!store.db && this.hasSeparateMediaReferences(dataSnapshot)) {
            throw new Error('別保存の音声・動画領域を開けないため、完全バックアップを作成できません。保存状態を確認してください。');
        }
        const descriptors = await store.listMediaEntries();
        const entries = [];
        for (const item of descriptors || []) {
            const key = String(item?.key || '');
            if (!key) continue;
            const blob = await store.loadMediaBlob(key);
            // File handles and external URL links do not contain a local Blob.
            if (!blob) continue;
            entries.push({
                key,
                type: blob.type || item.type || 'application/octet-stream',
                size: blob.size,
                base64: await this.blobToBackupBase64(blob)
            });
        }
        const present = new Set(entries.map(entry => entry.key));
        const missing = [...this.getSeparateMediaReferenceKeys(dataSnapshot)].filter(key => !present.has(key));
        if (missing.length) {
            throw new Error(`参照中の音声・動画 ${missing.length}件が保存領域に見つかりません。完全バックアップを作成できません。`);
        }
        return entries;
    }

    async buildCompleteBackupJson(jsonText) {
        const payload = JSON.parse(jsonText);
        const entries = await this.collectCompleteBackupMediaEntries(payload.mainData || payload);
        payload.embeddedMedia = { version: 1, entries };
        return JSON.stringify(payload);
    }

    inspectEmbeddedMedia(manifest) {
        if (manifest == null) return { present: false, entries: [], count: 0, bytes: 0 };
        if (manifest.version !== 1 || !Array.isArray(manifest.entries)) {
            throw new Error('音声・動画バックアップの形式が正しくありません。');
        }
        const seen = new Set();
        let bytes = 0;
        for (const entry of manifest.entries) {
            if (!entry || typeof entry !== 'object' || typeof entry.key !== 'string'
                || !entry.key || entry.key === 'maintenance_latest_json_file'
                || entry.key.length > 250 || seen.has(entry.key)
                || typeof entry.base64 !== 'string' || typeof entry.type !== 'string'
                || !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > 100 * 1024 * 1024
                || entry.base64.length !== Math.ceil(entry.size / 3) * 4) {
                throw new Error('音声・動画バックアップに不正な項目があります。');
            }
            seen.add(entry.key);
            bytes += entry.size;
        }
        return { present: true, entries: manifest.entries, count: manifest.entries.length, bytes };
    }

    assertEmbeddedMediaReferences(referenceKeys, mediaKeys) {
        const included = new Set(mediaKeys);
        const missing = [...referenceKeys].filter(key => !included.has(key));
        if (missing.length) {
            throw new Error(`バックアップ内の主データが参照する音声・動画 ${missing.length}件の本体が含まれていません。`);
        }
    }

    decodeEmbeddedMedia(manifest) {
        const info = this.inspectEmbeddedMedia(manifest);
        if (!info.count) return [];
        if (typeof atob !== 'function') throw new Error('音声・動画を復元できないブラウザーです。');
        return info.entries.map(entry => {
            const parts = [];
            for (let offset = 0; offset < entry.base64.length; offset += 1048576) {
                const binary = atob(entry.base64.slice(offset, offset + 1048576));
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                parts.push(bytes);
            }
            const blob = new Blob(parts, { type: entry.type });
            if (blob.size !== entry.size) throw new Error(`音声・動画「${entry.key}」の容量が一致しません。`);
            return { key: entry.key, value: { blob, size: blob.size, type: blob.type, updatedAt: Date.now() } };
        });
    }

    readMediaRecords(keys) {
        if (!keys.length) return Promise.resolve([]);
        if (!store.db) return Promise.reject(new Error('音声・動画の保存先を開けません。'));
        return new Promise((resolve, reject) => {
            try {
                const transaction = store.db.transaction(store.MEDIA_STORE_NAME, 'readonly');
                const objectStore = transaction.objectStore(store.MEDIA_STORE_NAME);
                const records = keys.map(key => ({ key, value: undefined }));
                keys.forEach((key, index) => {
                    const request = objectStore.get(key);
                    request.onsuccess = () => { records[index].value = request.result; };
                });
                transaction.oncomplete = () => resolve(records);
                transaction.onerror = () => reject(transaction.error || new Error('既存の音声・動画を読み込めませんでした。'));
                transaction.onabort = () => reject(transaction.error || new Error('既存の音声・動画を読み込めませんでした。'));
            } catch (error) { reject(error); }
        });
    }

    async ensureMediaRestoreCapacity(incoming, previous) {
        if (typeof navigator === 'undefined' || typeof navigator.storage?.estimate !== 'function') return;
        let estimate;
        try { estimate = await navigator.storage.estimate(); }
        catch (error) { console.warn('保存容量を確認できませんでした。', error); return; }
        const free = Number(estimate?.quota) - Number(estimate?.usage);
        if (!Number.isFinite(free)) return;
        const incomingBytes = incoming.reduce((sum, record) => sum + (record.value?.blob?.size || 0), 0);
        const previousBytes = previous.reduce((sum, record) => sum + (record.value?.blob?.size || 0), 0);
        const required = Math.max(0, incomingBytes - previousBytes);
        if (free < required) {
            throw new Error(`音声・動画の復元に必要な空き容量が不足しています（必要 約${this.formatExportBytes(required)}、空き 約${this.formatExportBytes(free)}）。`);
        }
    }

    writeMediaRecords(records) {
        if (!records.length) return Promise.resolve();
        if (!store.db) return Promise.reject(new Error('音声・動画の保存先を開けません。'));
        return new Promise((resolve, reject) => {
            try {
                const transaction = store.db.transaction(store.MEDIA_STORE_NAME, 'readwrite');
                const objectStore = transaction.objectStore(store.MEDIA_STORE_NAME);
                records.forEach(record => {
                    if (record.value === undefined) objectStore.delete(record.key);
                    else objectStore.put(record.value, record.key);
                });
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error || new Error('音声・動画を保存できませんでした。'));
                transaction.onabort = () => reject(transaction.error || new Error('音声・動画を保存できませんでした。'));
            } catch (error) { reject(error); }
        });
    }

    getImportPreviewInfo(jsonText, fileName = '') {
        const imported = JSON.parse(jsonText);
        const mediaBackup = this.inspectEmbeddedMedia(imported?.embeddedMedia);
        const dataToLoad = imported.mainData || imported;
        const incomingMediaReferenceKeys = mediaBackup.present
            ? [...this.getSeparateMediaReferenceKeys(dataToLoad)]
            : [];
        if (mediaBackup.present) {
            this.assertEmbeddedMediaReferences(incomingMediaReferenceKeys, mediaBackup.entries.map(entry => entry.key));
        }
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
        let typeLabel = mediaBackup.present ? '音声・動画を含む完全バックアップ' : '全データJSON';
        let dangerLabel = '現在の全データを置き換えます';
        if (imported?.type === 'maintenance_initialization_json') {
            typeLabel = imported.initializationModeLabel || '初期化用JSON';
            dangerLabel = `初期化用JSON: ${typeLabel}`;
        } else if (imported?.type === 'single_department_backup') {
            typeLabel = '部署単体バックアップ';
            dangerLabel = '全データ取込ではなく「部署取込」向けのファイルです';
        }
        return {
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
            mediaBackup: { present: mediaBackup.present, count: mediaBackup.count, bytes: mediaBackup.bytes },
            incomingMediaReferenceKeys,
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
                    <div class="admin-preview-note">
                        <b>別保存の音声・動画</b>
                        <p>${preview.mediaBackup?.present
                            ? `${preview.mediaBackup.count}件（約${this.formatExportBytes(preview.mediaBackup.bytes)}）を取込時に復元します。`
                            : 'このJSONには音声・動画の本体が含まれていません。旧形式の取込は続行できます。'}</p>
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
        let previousMedia = [];
        let mediaWritten = false;
        let imported = false;
        try {
            const incoming = preview.raw || JSON.parse(preview.jsonText);
            const manifest = incoming?.embeddedMedia;
            const mediaRecords = this.decodeEmbeddedMedia(manifest);
            if (this.inspectEmbeddedMedia(manifest).present) {
                const keys = preview.incomingMediaReferenceKeys
                    || [...this.getSeparateMediaReferenceKeys(incoming.mainData || incoming)];
                this.assertEmbeddedMediaReferences(keys, mediaRecords.map(record => record.key));
            }
            const backupJson = await this.buildCompleteBackupJson(
                store.exportAsJSON({ optimizeImages: true, mode: 'complete' })
            );
            if (typeof this.downloadJsonText !== 'function') {
                throw new Error('取込前バックアップの出力機能を読み込めませんでした。');
            }
            this.downloadJsonText(backupFilename, backupJson, '取込前バックアップを出力しました');
            this.recordAdminBackupLog?.('import', backupFilename);
            if (mediaRecords.length) {
                previousMedia = await this.readMediaRecords(mediaRecords.map(record => record.key));
                await this.ensureMediaRestoreCapacity(mediaRecords, previousMedia);
                await this.writeMediaRecords(mediaRecords);
                mediaWritten = true;
            }
            if (!await store.importFromJSON(preview.jsonText)) {
                throw new Error('主データを保存できませんでした。');
            }
            imported = true;
            try {
                this.recordAdminOperationLog?.('import', '全データ取込を実行', preview.fileName || preview.typeLabel || 'JSON', { tab: 'backup' });
            } catch (error) {
                console.warn('取込操作ログを保存できませんでした。', error);
            }
            try {
                localStorage.setItem('maintenance_pending_import_result', JSON.stringify({
                    at: new Date().toISOString(),
                    fileName: preview.fileName,
                    typeLabel: preview.typeLabel,
                    incomingDeptName: preview.incomingDeptName,
                    incomingCounts: preview.incomingCounts,
                    currentCounts: preview.currentCounts,
                    mediaCount: mediaRecords.length
                }));
            } catch (error) {
                console.warn('取込結果の表示情報を保存できませんでした。', error);
            }
            this.pendingFullImportPreview = null;
            location.reload();
        } catch (error) {
            if (imported) {
                console.error('取込後の画面再読み込みに失敗しました。', error);
                alert('データの取込は完了しました。画面を手動で再読み込みしてください。');
                return;
            }
            let rollbackError = null;
            if (mediaWritten && !imported) {
                try { await this.writeMediaRecords(previousMedia); }
                catch (restoreError) { rollbackError = restoreError; }
            }
            if (importBtn) {
                importBtn.disabled = false;
                importBtn.innerHTML = '<i class="fa-solid fa-upload"></i> バックアップして取込';
            }
            console.error('全データの取込に失敗しました。', error);
            alert(`インポートに失敗しました。${error?.message || 'ファイル形式と保存先を確認してください。'}${rollbackError ? '\n元の音声・動画を戻せませんでした。取込前バックアップを保管してください。' : ''}`);
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
                            <b>現在の主データJSON容量 ${this.formatExportBytes(analysis.rawJsonBytes)}</b>
                            <span>画像 ${analysis.images.occurrences}個（実体 ${analysis.images.uniqueCount}個）／重複分 約${this.formatExportBytes(analysis.images.duplicateBytes)}</span>
                        </div>
                    </div>
                    <div class="backup-capacity-list">
                        <div class="backup-capacity-head"><span>保存場所</span><b>画像数</b><strong>画像実容量</strong></div>
                        ${this.renderBackupCapacityRows(analysis)}
                    </div>
                    <div class="backup-export-choices">
                        <button type="button" class="backup-export-choice recommended" onclick="app.exportOptimizedBackup('complete', '${scope}')">
                            <i class="fa-solid fa-box-archive"></i>
                            <span><b>完全バックアップ <em id="backup-complete-size">計算中…</em></b><small>${scope === 'all' ? '復旧用。写真・ゴミ箱・元画像と、ブラウザー内の音声・動画本体を含みます。' : '写真・ゴミ箱・元画像を含みます。別保存の音声・動画本体は部署出力の対象外です。'}</small></span>
                        </button>
                        <button type="button" class="backup-export-choice" onclick="app.exportOptimizedBackup('light', '${scope}')">
                            <i class="fa-solid fa-feather-pointed"></i>
                            <span><b>軽量バックアップ <em id="backup-light-size">計算中…</em></b><small>容量優先。最近使用・ゴミ箱・編集用元画像と、別保存の音声・動画本体を除外します。</small></span>
                        </button>
                    </div>
                    ${scope === 'all' ? `
                        <div class="backup-cleanup-panel">
                            <b>latest.json の保存先</b>
                            <p>初回に latest.json の保存先を選ぶと、次回から同じファイルを上書きします。出力ファイルは latest.json の1件だけです。</p>
                            <p>PCリンク動画と外部URL動画は参照先のファイル・URLが別途必要です。</p>
                            <button type="button" class="secondary-btn" onclick="app.changeLatestJsonSaveTarget()">保存先を変更</button>
                        </div>
                    ` : ''}
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
        let mediaBytes = 0;
        if (scope === 'all' && typeof store.listMediaEntries === 'function') {
            try {
                const media = await store.listMediaEntries();
                mediaBytes = (media || []).reduce((sum, entry) => sum + Math.ceil((Number(entry?.size) || 0) / 3) * 4, 0);
            } catch (error) {
                console.warn('音声・動画の容量を見積もれませんでした。', error);
            }
        }
        const calculate = async (mode, elementId) => {
            await new Promise(resolve => setTimeout(resolve, 20));
            const text = scope === 'dept'
                ? store.exportCurrentDeptAsJSON({ optimizeImages: true, mode })
                : store.exportAsJSON({ optimizeImages: true, mode });
            const element = document.getElementById(elementId);
            if (element) element.textContent = `予想 ${this.formatExportBytes(new Blob([text]).size + (mode === 'complete' ? mediaBytes : 0))}`;
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

    changeLatestJsonSaveTarget() {
        this._latestJsonFileHandle = null;
        this._latestJsonForcePicker = true;
        this.showToast?.('次の全データ出力で latest.json の保存先を選択できます', 'info');
    }

    async getLatestJsonFileHandle() {
        const handle = this._latestJsonForcePicker ? null : this._latestJsonFileHandle;
        if (handle) {
            if (String(handle.name).toLowerCase() !== 'latest.json') {
                throw new Error('保存先が latest.json ではありません。「保存先を変更」から選び直してください。');
            }
            const permission = { mode: 'readwrite' };
            if (typeof handle.queryPermission === 'function'
                && await handle.queryPermission(permission) !== 'granted') {
                if (typeof handle.requestPermission !== 'function'
                    || await handle.requestPermission(permission) !== 'granted') {
                    throw new Error('前回の latest.json への書き込み許可がありません。保存先を変更してください。');
                }
            }
            return handle;
        }
        const types = [{ description: 'JSON ファイル', accept: { 'application/json': ['.json'] } }];
        let selected = null;
        if (typeof window.showSaveFilePicker === 'function') {
            selected = await window.showSaveFilePicker({
                id: 'maintenance-latest-json',
                suggestedName: 'latest.json',
                types
            });
        } else if (typeof window.showOpenFilePicker === 'function') {
            [selected] = await window.showOpenFilePicker({
                id: 'maintenance-latest-json',
                multiple: false,
                startIn: 'downloads',
                types
            });
        } else {
            return null;
        }
        if (!selected || String(selected.name).toLowerCase() !== 'latest.json') {
            throw new Error('保存先には latest.json を選択してください。');
        }
        const permission = { mode: 'readwrite' };
        if (typeof selected.queryPermission === 'function'
            && await selected.queryPermission(permission) !== 'granted') {
            if (typeof selected.requestPermission !== 'function'
                || await selected.requestPermission(permission) !== 'granted') {
                throw new Error('latest.json への書き込みが許可されませんでした。');
            }
        }
        return selected;
    }

    recordLatestJsonExport(kind = 'file') {
        const value = { at: new Date().toISOString(), kind };
        this._lastLatestJsonExport = value;
        try {
            localStorage.setItem('maintenance_latest_json_export_v1', JSON.stringify(value));
        } catch (_) {}
        this.updateSaveStatus?.(this._saveStatusState || 'saved');
    }

    async exportOptimizedBackup(mode = 'complete', scope = 'all') {
        if (this._backupExportInProgress) return;
        this._backupExportInProgress = true;
        const choiceButtons = Array.from(document.querySelectorAll('.backup-export-choice'));
        choiceButtons.forEach(button => { button.disabled = true; });
        try {
            let latestHandle = null;
            let latestError = null;
            if (scope === 'all') {
                try {
                    // Ask for a file in the button's user gesture before processing a large export.
                    latestHandle = await this.getLatestJsonFileHandle();
                } catch (error) {
                    if (error?.name === 'AbortError') return;
                    latestError = error;
                    this._latestJsonFileHandle = null;
                    this._latestJsonForcePicker = true;
                    store.deleteMediaBlob?.('maintenance_latest_json_file')
                        ?.catch(error => console.warn('以前の保存先を解除できませんでした。', error));
                }
            }
            const options = { optimizeImages: true, mode: mode === 'complete' ? 'complete' : 'light' };
            const baseData = scope === 'dept' ? store.exportCurrentDeptAsJSON(options) : store.exportAsJSON(options);
            const data = scope === 'all' && options.mode === 'complete'
                ? await this.buildCompleteBackupJson(baseData)
                : baseData;
            const omittedDataWarning = store.lastExportWarnings?.length
                ? `\n注意: ${store.lastExportWarnings.join('、')}。このJSONには一部のスキル情報が含まれません。`
                : '';
            const date = this.getLocalDateString();
            const modeLabel = options.mode === 'light' ? 'light' : 'complete';
            const deptName = store.data.departments.find(d => d.id === store.data.currentDepartmentId)?.name || 'dept';
            const filename = scope === 'dept'
                ? `maintenance_${deptName}_${modeLabel}_${date}.json`
                : 'latest.json';
            const blob = new Blob([data], { type: 'application/json' });
            let latestSaved = false;
            if (scope === 'all' && latestHandle) {
                let writable;
                try {
                    writable = await latestHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    latestSaved = true;
                    this.recordLatestJsonExport('file');
                    this._latestJsonFileHandle = latestHandle;
                    this._latestJsonForcePicker = false;
                    try {
                        store.saveMediaFileHandle('maintenance_latest_json_file', latestHandle)
                            .catch(error => console.warn('latest.json の保存先を次回用に記録できませんでした。', error));
                    } catch (error) {
                        console.warn('latest.json の保存先を次回用に記録できませんでした。', error);
                    }
                } catch (error) {
                    latestError = error;
                    try { Promise.resolve(writable?.abort?.()).catch(() => {}); } catch (_) {}
                    this._latestJsonFileHandle = null;
                    this._latestJsonForcePicker = true;
                    try {
                        store.deleteMediaBlob('maintenance_latest_json_file')
                            .catch(error => console.warn('以前の保存先を解除できませんでした。', error));
                    } catch (error) {
                        console.warn('以前の保存先を解除できませんでした。', error);
                    }
                }
            }
            let downloadStarted = false;
            if (!latestSaved) {
                try {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    downloadStarted = true;
                    if (scope === 'all') this.recordLatestJsonExport('download');
                } catch (error) {
                    latestError = error;
                    console.error('JSONをダウンロードできませんでした。', error);
                }
            }
            if (!latestSaved && !downloadStarted) {
                alert(`JSONを出力できませんでした。\n${latestError?.message || '保存先とブラウザー設定を確認してください。'}`);
            } else if (scope === 'all' && !latestSaved) {
                const reason = latestError?.message || 'このブラウザーではファイルの直接上書きを利用できません。';
                this.showToast?.('latest.json を1件ダウンロードしました', 'success');
                alert(`latest.json のダウンロードを開始しました。\n${reason}\n既存の同名ファイルを自動上書きできない場合、ブラウザーが名前に (1) を付けることがあります。${omittedDataWarning}`);
            } else {
                this.showToast?.(`${options.mode === 'light' ? '軽量' : '完全'}${scope === 'all' ? ' latest.json を保存' : '部署データを出力'}しました（${this.formatExportBytes(blob.size)}）`, 'success');
                if (omittedDataWarning) alert(`JSONを出力しました。${omittedDataWarning}`);
            }
            if (latestSaved || downloadStarted) this.closeModal();
        } catch (error) {
            console.error('バックアップの出力に失敗しました。', error);
            alert('バックアップを出力できませんでした。データを確認して再試行してください。');
        } finally {
            choiceButtons.forEach(button => { button.disabled = false; });
            this._backupExportInProgress = false;
        }
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
        this._latestJsonFileHandle = null;
        this._latestJsonForcePicker = false;
        store.loadMediaFileHandle('maintenance_latest_json_file')
            .then(handle => {
                if (!this._latestJsonFileHandle && !this._latestJsonForcePicker) {
                    this._latestJsonFileHandle = handle;
                }
            })
            .catch(error => console.warn('latest.json の保存先を読み込めませんでした。', error));
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
