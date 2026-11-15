(function () {
    'use strict';
    const P = MaintenanceApp.prototype;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const node = (tag, text, parent) => { const n = document.createElement(tag); if (text != null) n.textContent = text; parent?.append(n); return n; };
    const button = (parent, text, action) => { const b = node('button', text, parent); b.type = 'button'; b.className = 'secondary-btn'; b.onclick = action; return b; };

    P.getEquipmentWorkspace = function (machineId) {
        const machines = store.getMachines(true);
        const machine = machines.find(m => m.id === machineId);
        if (!machine) return null;
        const model = MaintenanceStore.toHalfWidthLower(machine.model || '').trim();
        const relatedIds = new Set(machines.filter(m => m.id === machineId || (model && MaintenanceStore.toHalfWidthLower(m.model || '').trim() === model)).map(m => m.id));
        const history = [], guides = [], parts = new Map();
        let minutes = 0, unknownTime = 0;
        for (const record of store.activeData.history || []) {
            if ((record.guide || record.isManualGuide) && relatedIds.has(record.machineId)) guides.push(record);
            if (record.machineId !== machineId || record.isManualGuide) continue;
            history.push(record);
            const time = parseInt(record.workTime, 10);
            if (!Number.isFinite(time) || time < 0) unknownTime++;
            else minutes += time;
            for (const part of record.replacedParts || []) {
                const key = JSON.stringify([part.name || '', part.model || '', part.unit || '個']);
                const entry = parts.get(key) || { name: part.name || '名称未設定', model: part.model || '', unit: part.unit || '個', count: 0 };
                entry.count += Number(part.count) || 0;
                parts.set(key, entry);
            }
        }
        const newest = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));
        history.sort(newest); guides.sort(newest);
        const today = this.getLocalDateString();
        const upcoming = store.getTasks(machineId).map(task => {
            let date = this.getNextTaskScheduledDate(task, today);
            // There can be at most one completed occurrence per history entry.
            for (let n = 0; date && this.isScheduledTaskOccurrenceDone(task, date) && n <= history.length; n++) {
                const nextDay = new Date(this.parseTaskScheduleDate(date) + 86400000).toISOString().slice(0, 10);
                date = this.getNextTaskScheduledDate(task, nextDay);
            }
            return { task, date };
        }).filter(item => item.date).sort((a, b) => a.date.localeCompare(b.date));
        return { machine, history, guides, parts: [...parts.values()], minutes, unknownTime, upcoming };
    };

    P.openEquipmentWorkspace = function (machineId) {
        const data = this.getEquipmentWorkspace(machineId);
        if (!data) return this.showToast('対象の機械が見つかりません。', 'warning');
        this.openModal('equipment-workspace', '機械カルテ', () => {
            const root = document.getElementById('modal-content'); root.classList.add('workspace-content');
            node('h2', data.machine.name, root);
            node('p', `${this.getLineLabel(data.machine.lineNo || '')} / ${data.machine.model || '型式未登録'} / ${data.machine.category || '区分未設定'}`, root);
            const stats = node('div', null, root); stats.className = 'workspace-stats';
            button(stats, `対応履歴 ${data.history.length} 件`, () => this.openEvidenceRecords(data.history, `${data.machine.name} の対応履歴`));
            button(stats, `作業時間 ${data.minutes.toLocaleString()} 分`, () => this.openEvidenceRecords(data.history, `${data.machine.name} の作業時間`));
            node('p', `作業時間は1記録を1回加算した経過時間です。時間未入力・不正値 ${data.unknownTime} 件。`, root);
            const next = node('section', null, root); node('h3', '次回のメンテ予定', next);
            if (!data.upcoming.length) node('p', '今後の未完了予定はありません。', next);
            for (const { task, date } of data.upcoming) {
                const row = node('div', null, next); row.className = 'workspace-row';
                node('span', `${date}　${task.content || 'メンテナンス'}`, row);
                button(row, '完了を記録', () => this.openCompletionForm(task.id, date));
            }
            const history = node('section', null, root); node('h3', '最近の対応', history);
            this.appendEvidenceRows(history, data.history.slice(0, 10));
            const guides = node('section', null, root); node('h3', `関連手順書 ${data.guides.length} 件（同じ型式を含む）`, guides);
            for (const record of data.guides.slice(0, 10)) button(guides, `${record.date || ''} ${this.getHistoryDisplayText(record) || '手順書'}`, () => this.openGuideModal(record.id));
            if (data.guides.length > 10) button(guides, 'すべての関連手順書', () => this.openEvidenceRecords(data.guides, '関連手順書', { guides: true }));
            const parts = node('section', null, root); node('h3', '使用部品（対応履歴の累計）', parts);
            const details = node('details', null, parts); node('summary', `${data.parts.length} 種類の部品を表示`, details);
            for (const part of data.parts) node('p', `${part.name} ${part.model}　${part.count} ${part.unit}`, details);
            if (!data.parts.length) node('p', '部品の記録はありません。', parts);
        });
        document.getElementById('modal-save-btn').hidden = true;
        document.querySelector('#modal-container .modal-footer .secondary-btn').textContent = '閉じる';
    };

    P.appendEvidenceRows = function (parent, records, options = {}) {
        if (!records.length) node('p', '対象の記録はありません。', parent);
        for (const record of records) {
            const row = node('div', null, parent); row.className = 'workspace-row';
            const text = node('div', null, row);
            node('b', `${record.date || '日付未設定'}　${this.getHistoryDisplayText(record) || '内容未設定'}`, text);
            const minutes = parseInt(record.workTime, 10);
            node('small', `${(record.workers || []).join('、') || '作業者未設定'} / ${Number.isFinite(minutes) ? `${minutes} 分` : '時間未入力'}${options.contribution ? ` / 集計への加算 ${options.contribution(record)} 分` : ''}`, text);
            button(row, options.guides ? '手順書' : '記録を開く', () => options.guides ? this.openGuideModal(record.id) : this.openHistoryEditForm(record.id));
        }
    };
    P.openEvidenceRecords = function (records, title, options = {}, page = 0) {
        const pageSize = 50, pages = Math.max(1, Math.ceil(records.length / pageSize));
        page = Math.max(0, Math.min(pages - 1, page));
        this.openModal('evidence-records', title, () => {
            const root = document.getElementById('modal-content'); root.classList.add('workspace-content');
            if (options.description) node('p', options.description, root);
            const nav = node('div', null, root); nav.className = 'workspace-toolbar';
            button(nav, '前へ', () => this.openEvidenceRecords(records, title, options, page - 1)).disabled = page === 0;
            node('span', `${page + 1} / ${pages} ページ・全 ${records.length} 件`, nav);
            button(nav, '次へ', () => this.openEvidenceRecords(records, title, options, page + 1)).disabled = page + 1 === pages;
            this.appendEvidenceRows(root, records.slice(page * pageSize, (page + 1) * pageSize), options);
        });
        document.getElementById('modal-save-btn').hidden = true;
        document.querySelector('#modal-container .modal-footer .secondary-btn').textContent = '閉じる';
    };

    P.getTodayWorkspaceFilters = function () {
        if (this._todayWorkspaceDepartment !== store.data.currentDepartmentId) {
            this._todayWorkspaceDepartment = store.data.currentDepartmentId;
            this.todayWorkspaceFilters = { line: 'all', worker: 'all' };
        }
        return this.todayWorkspaceFilters;
    };
    P.matchesTodayWorkspaceFilter = function (item, members = []) {
        const filters = this.getTodayWorkspaceFilters();
        const machine = (store.activeData.machines || []).find(m => m.id === item.machineId);
        const line = String(item.lineNo || machine?.lineNo || item.source?.lineNo || '');
        const assigned = Array.isArray(item.assignedTo) ? item.assignedTo : [];
        const workers = [...(item.workers || []), ...members, ...assigned.map(id => this.getKanbanTodoWorkerName(id))].filter(Boolean);
        return (filters.line === 'all' || (filters.line === '__unset__' ? !line : line === filters.line))
            && (filters.worker === 'all' || (filters.worker === '__unset__' ? !workers.length : assigned.includes('all') || workers.includes(filters.worker)));
    };
    P.setTodayWorkspaceFilter = function (name, value) {
        if (!['line', 'worker'].includes(name)) return;
        this.getTodayWorkspaceFilters()[name] = value;
        this.renderDashboard();
    };
    P.getTodayWorkspaceFilterHtml = function () {
        const filters = this.getTodayWorkspaceFilters();
        const lines = [...new Set((store.activeData.machines || []).map(m => String(m.lineNo || '')).filter(Boolean))].sort();
        const workers = [...new Set([...(store.activeData.localTodoWorkers || []).map(w => w.name), ...(store.activeData.tasks || []).flatMap(task => task.workers || []), ...store.getWorkers()])].sort();
        const select = (key, label, values) => `<label>${label}<select id="today-filter-${key}" onchange="app.setTodayWorkspaceFilter('${key}',this.value)">${[['all', 'すべて'], ['__unset__', '未設定'], ...values.map(v => [v, v])].map(([value, text]) => `<option value="${esc(value)}" ${filters[key] === value ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select></label>`;
        return `<div class="workspace-toolbar today-workspace-filters">${select('line', 'ライン', lines)}${select('worker', '担当者', workers)}<small>担当・ラインがない予定や連絡は「未設定」で確認できます。</small></div>`;
    };
    P.getTodayScheduledItemsHtml = function (summary) {
        return `<details class="today-scheduled-list" open><summary>今日のメンテ予定 ${summary.todayTasks.length} 件</summary>${summary.todayTasks.slice(0, 50).map(task => {
            const machine = (store.activeData.machines || []).find(m => m.id === task.machineId);
            return `<button type="button" class="today-action-item" data-task-id="${esc(task.id)}" onclick="app.openCompletionForm(this.dataset.taskId,'${summary.todayStr}')"><b>完了を記録</b><span>${esc(machine?.name || '')} / ${esc(task.content || '')}</span></button>`;
        }).join('') || '<p>今日の未完了メンテ予定はありません。</p>'}${summary.todayTasks.length > 50 ? '<button type="button" onclick="app.switchView(\'calendar\')">残りの予定をカレンダーで確認</button>' : ''}</details>`;
    };
})();
