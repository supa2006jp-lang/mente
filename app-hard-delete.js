(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppHardDeleteMethods extends MaintenanceApp {
    // --- Hard Delete Actions (Permanent Deletion) ---
    hardDeleteWorker(name) {
        if (this.requireDangerConfirm?.(`作業員「${name}」を完全に削除しますか？`, 'この操作は取り消せません。') ?? confirm(`作業員「${name}」を完全に削除しますか？\nこの操作は取り消せません。`)) {
            store.hardDeleteWorker(name);
            this.recordAdminOperationLog?.('delete', '作業員を完全削除', name, { tab: 'archive', search: name });
            this.renderWorkerMaintenanceModal();
            this.renderWorkers();
        }
    }

    hardDeleteTask(tk, label) {
        if (this.requireDangerConfirm?.(`スキルマップ項目「${label}」を完全に削除しますか？`, 'この操作は取り消せません。') ?? confirm(`スキルマップ項目「${label}」を完全に削除しますか？\nこの操作は取り消せません。`)) {
            store.hardDeleteTask(tk);
            this.recordAdminOperationLog?.('delete', 'スキル項目を完全削除', label, { tab: 'archive', search: label });
            this.renderWorkerMaintenanceModal();
            this.renderWorkers();
        }
    }

    hardDeletePart(name, model) {
        if (this.requireDangerConfirm?.(`部品「${name} [${model}]」を完全に削除しますか？`, 'マスターからも削除されます。この操作は取り消せません。') ?? confirm(`部品「${name} [${model}]」を完全に削除しますか？\nマスターからも削除されます。この操作は取り消せません。`)) {
            store.hardDeletePart(name, model);
            this.recordAdminOperationLog?.('delete', '部品を完全削除', `${name} [${model || '-'}]`, { tab: 'archive', search: name });
            this.renderWorkerMaintenanceModal();
            this.renderAnalysis();
        }
    }

    hardDeleteMaintenanceTask(id, content) {
        if (this.requireDangerConfirm?.(`周期設定「${content}」を完全に削除しますか？`, '設定データそのものが消去されます。この操作は取り消せません。') ?? confirm(`周期設定「${content}」を完全に削除しますか？\n設定データそのものが消去されます。この操作は取り消せません。`)) {
            store.hardDeleteMaintenanceTask(id);
            this.recordAdminOperationLog?.('delete', '周期設定を完全削除', content, { tab: 'archive', search: content });
            this.renderWorkerMaintenanceModal();
            this.renderMachines();
            this.renderCalendar();
        }
    }

    hardDeleteGuide(id, title) {
        if (this.requireDangerConfirm?.(`手順書「${title}」を完全に削除しますか？`, 'この操作は取り消せません。') ?? confirm(`手順書「${title}」を完全に削除しますか？\nこの操作は取り消せません。`)) {
            store.hardDeleteGuide(id);
            this.recordAdminOperationLog?.('delete', '手順書を完全削除', title, { tab: 'archive', search: title });
            this.renderWorkerMaintenanceModal();
            this.renderGuides();
        }
    }

    openManualGuideRegistration() {
        const machines = store.getMachines(true);
        this.openModal('manual-guide-init', '手順書の新規登録 (メンテ記録なし)', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div style="padding: 10px;">
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom:8px; font-weight:800;">対象の機械を選択</label>
                        <select id="m-guide-machine" class="form-control" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--border); font-size: 1.05rem; background:#f8fafc;">
                            <option value="">-- 指定なし (全般・共通手順) --</option>
                            ${machines.map(m => `<option value="${m.id}">${this.escapeHtml(m.name)} [${this.escapeHtml(m.model || '-')}]</option>`).join('')}
                        </select>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom: 20px;">
                        <div class="form-group">
                            <label style="display:block; margin-bottom:8px; font-weight:800;">手順の分類 (カテゴリ)</label>
                            <select id="m-guide-category" class="form-control" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border); font-size: 1rem;">
                                <option value="作業手順">作業手順</option>
                                <option value="安全">安全</option>
                                <option value="5S">5S</option>
                                <option value="品質">品質</option>
                                <option value="工具・設備">工具・設備</option>
                                <option value="事務・その他">事務・その他</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label style="display:block; margin-bottom:8px; font-weight:800;">オプション</label>
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; padding:10px; background:#f1f5f9; border-radius:8px; border:1px solid var(--border); font-size:0.85rem;">
                                <input type="checkbox" id="m-guide-hide-skill" style="width:18px; height:18px;">
                                <span>スキルマップに表示しない</span>
                            </label>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom: 24px;">
                        <label style="display:block; margin-bottom:8px; font-weight:800;">作業内容・タイトル</label>
                        <input type="text" id="m-guide-title" class="form-control" placeholder="例: 搬送ベルトの交換手順" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border); font-size: 1rem;">
                        <p style="font-size:0.75rem; color:var(--text-light); margin-top:8px;"><i class="fa-solid fa-circle-info"></i> ここで入力した内容が手順書のタイトルになります。</p>
                    </div>
                    <div style="text-align:right; margin-top: 30px;">
                        <button class="primary-btn" style="width:100%; padding:15px; font-size: 1.1rem; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 10px;" onclick="app.submitManualGuideInit()">
                            次へ進んで手順を作成する <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            `;
            
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.style.display = 'none';
        });
    }

    submitManualGuideInit() {
        const machineId = document.getElementById('m-guide-machine').value;
        const title = document.getElementById('m-guide-title').value.trim();
        const guideCategory = document.getElementById('m-guide-category').value;
        const hideFromSkillMap = document.getElementById('m-guide-hide-skill').checked;
        
        if (!title) return alert('作業内容を入力してください。');

        const finalMachineId = machineId || 'COMMON';
        const newId = store.generateId();
        const date = new Date().toISOString().split('T')[0];
        const newHistory = {
            id: newId,
            machineId: finalMachineId,
            date: date,
            type: 'repair',
            errorContent: title,
            notes: '(手順書登録のために作成された記録)',
            workers: [],
            replacedParts: [],
            isManualGuide: true,
            guideCategory: guideCategory,
            hideFromSkillMap: hideFromSkillMap
        };

        store.activeData.history.push(newHistory);
        store.save();
        
        this.closeModal();
        // 小さなディレイを置いてから手順書編集モーダルを開く
        setTimeout(() => this.openGuideModal(newId), 150);
    }

    hardDeleteMachineCategory(name) {
        if (this.requireDangerConfirm?.(`装置区分「${name}」を完全に削除しますか？`, 'この操作は取り消せません。') ?? confirm(`装置区分「${name}」を完全に削除しますか？\nこの操作は取り消せません。`)) {
            store.activeData.archivedMachineCategories = store.activeData.archivedMachineCategories.filter(c => c !== name);
            store.save();
            this.recordAdminOperationLog?.('delete', '装置区分を完全削除', name, { tab: 'archive', search: name });
            this.renderWorkerMaintenanceModal();
            this.updateDataLists();
        }
    }

    hardDeleteMachine(id, name) {
        if (this.requireDangerConfirm?.(`装置「${name}」を完全に削除しますか？`, '装置に関連する周期設定も削除されます（履歴は残ります）。この操作は取り消せません。') ?? confirm(`装置「${name}」を完全に削除しますか？\n装置に関連する周期設定も削除されます（履歴は残ります）。\nこの操作は取り消せません。`)) {
            store.hardDeleteMachine(id);
            this.recordAdminOperationLog?.('delete', '装置を完全削除', name, { tab: 'archive', search: name });
            this.renderWorkerMaintenanceModal();
            this.renderMachines();
            this.renderCalendar();
        }
    }

    hardDeleteSuggestion(kind, value) {
        if (this.requireDangerConfirm?.(`サジェスト項目「${value}」をリストから完全に消去しますか？`, '今後再びサジェストの候補に現れるようになります。') ?? confirm(`サジェスト項目「${value}」をリストから完全に消去しますか？\n今後再びサジェストの候補に現れるようになります。`)) {
            store.toggleArchivedSuggestion(kind, value); // toggle to remove from archive
            this.recordAdminOperationLog?.('delete', 'サジェストを完全削除', value, { tab: 'suggest', search: value });
            this.renderWorkerMaintenanceModal();
        }
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppHardDeleteMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppHardDeleteMethods.prototype[name];
        }
    }
})();
