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
                        <button type="button" data-action="app-settings-export-data">
                            <i class="fa-solid fa-download"></i><span>データ出力</span><small>バックアップ用に現在データを書き出し</small>
                        </button>
                    </div>
                </div>
            </div>
        `);
    }

    closeAppSettingsPanel() {
        document.getElementById('app-settings-overlay')?.remove();
    }

    openSystemActivityLogPanel() {
        this.ensureKanbanTodoState?.();
        const todoLogs = (store.activeData.localTodoLogs || []).slice(0, 80).map(log => ({
            time: log.time || '',
            title: log.text || '',
            type: 'ToDo'
        }));
        const historyLogs = (store.activeData.history || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 40).map(h => ({
            time: h.date || '',
            title: this.getHistoryDisplayText(h),
            type: h.taskId ? '定期メンテ' : (h.isDokatei ? 'ドカ停' : '突発')
        }));
        const logs = [...todoLogs, ...historyLogs].sort((a, b) => String(b.time || '').localeCompare(String(a.time || ''))).slice(0, 100);
        this.openKanbanPanel('操作ログ', `
            <div class="system-log-list">
                ${logs.map(log => `
                    <div class="system-log-item">
                        <b>${this.escapeHtml(log.type)}</b>
                        <span>${this.escapeHtml(this.formatKanbanTodoTime(log.time) || log.time || '-')}</span>
                        <p>${this.escapeHtml(log.title || '')}</p>
                    </div>
                `).join('') || '<p class="kt-muted">ログはありません</p>'}
            </div>
        `);
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppSettingsMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppSettingsMethods.prototype[name];
        }
    }
})();
