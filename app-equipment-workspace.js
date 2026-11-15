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
            const facts = this.getWorkTimeRecordFacts(record);
            if (facts.unknownTime) unknownTime++;
            minutes += facts.minutes;
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
        const yesterday = new Date(this.parseTaskScheduleDate(today) - 86400000).toISOString().slice(0, 10);
        const byTask = new Map();
        for (const record of history) {
            const id = String(record.taskId || '');
            if (!byTask.has(id)) byTask.set(id, []);
            byTask.get(id).push(record);
        }
        const overdue = [];
        const upcoming = store.getTasks(machineId).map(task => {
            const taskHistory = byTask.get(String(task.id)) || [];
            const segments = this.getTaskScheduleSegments(task);
            const start = segments.map(s => s.fromDate > s.startDate ? s.fromDate : s.startDate).sort()[0];
            for (const date of start ? this.getTaskScheduledDatesBetween(task, start, yesterday) : []) {
                if (!this.isScheduledTaskOccurrenceDone(task, date, taskHistory)) overdue.push({ task, date });
            }
            let date = this.getNextTaskScheduledDate(task, today);
            // There can be at most one completed occurrence per history entry.
            for (let n = 0; date && this.isScheduledTaskOccurrenceDone(task, date, taskHistory) && n <= taskHistory.length; n++) {
                const nextDay = new Date(this.parseTaskScheduleDate(date) + 86400000).toISOString().slice(0, 10);
                date = this.getNextTaskScheduledDate(task, nextDay);
            }
            return { task, date };
        }).filter(item => item.date).sort((a, b) => a.date.localeCompare(b.date));
        overdue.sort((a, b) => a.date.localeCompare(b.date));
        return { machine, history, guides, parts: [...parts.values()], minutes, unknownTime, upcoming, overdue };
    };

    P.createEquipmentSection = function (root, key, title, count, initiallyOpen = false) {
        const storageKey = 'maintenance-equipment-sections-v1:' + store.data.currentDepartmentId;
        let states = {};
        try { states = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (_) {}
        const section = node('section', null, root);
        section.className = 'equipment-section' + (key === 'overdue' ? ' equipment-overdue' : '');
        const details = node('details', null, section); details.dataset.equipmentSection = key;
        const summary = node('summary', null, details);
        node('h3', `${title} ${count} 件`, summary);
        details.open = count > 0 && (typeof states[key] === 'boolean' ? states[key] : initiallyOpen);
        if (count > 0) details.addEventListener('toggle', () => {
            try {
                const saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {};
                saved[key] = details.open; localStorage.setItem(storageKey, JSON.stringify(saved));
            } catch (_) {}
        });
        return node('div', null, details);
    };

    P.groupEquipmentOverdue = function (overdue) {
        const groups = new Map();
        for (const { task, date } of overdue) {
            const key = String(task.id);
            if (!groups.has(key)) groups.set(key, { task, dates: [] });
            groups.get(key).dates.push(date);
        }
        for (const group of groups.values()) group.dates.sort();
        return [...groups.values()].sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
    };

    P.openEquipmentWorkspace = function (machineId, scrollTop = 0) {
        const data = this.getEquipmentWorkspace(machineId);
        if (!data) return this.showToast('対象の機械が見つかりません。', 'warning');
        this.openModal('equipment-workspace', '機械カルテ', () => {
            const root = document.getElementById('modal-content'); root.classList.add('workspace-content');
            root.dataset.equipmentId = machineId;
            node('h2', data.machine.name, root);
            node('p', `${this.getLineLabel(data.machine.lineNo || '')} / ${data.machine.model || '型式未登録'} / ${data.machine.category || '区分未設定'}`, root);
            const stats = node('div', null, root); stats.className = 'workspace-stats';
            button(stats, `対応履歴 ${data.history.length} 件`, () => this.openEquipmentChild(() => this.openEvidenceRecords(data.history, `${data.machine.name} の対応履歴`)));
            button(stats, `作業時間 ${data.minutes.toLocaleString()} 分`, () => this.openEquipmentChild(() => this.openEvidenceRecords(data.history, `${data.machine.name} の作業時間`)));
            node('p', `作業時間は1記録を1回加算した経過時間です。時間未入力・不正値 ${data.unknownTime} 件。`, root);
            const overdue = this.createEquipmentSection(root, 'overdue', '期限を過ぎた未完了予定', data.overdue.length, true);
            const overdueRows = node('div', null, overdue); overdueRows.className = 'equipment-overdue-rows';
            const overdueGroups = this.groupEquipmentOverdue(data.overdue);
            let shown = 0;
            const more = button(overdue, '続きを表示', () => appendOverdue());
            const appendOverdue = () => {
                for (const { task, dates } of overdueGroups.slice(shown, shown + 50)) {
                    const group = node('details', null, overdueRows); group.className = 'equipment-overdue-group';
                    const summary = node('summary', null, group);
                    node('strong', task.content || 'メンテナンス', summary);
                    node('span', `未完了 ${dates.length} 回・最も古い期限 ${dates[0]}`, summary);
                    const rows = node('div', null, group);
                    let dateCount = 0;
                    const moreDates = button(group, '続きを表示', () => appendDates());
                    const appendDates = () => {
                        for (const date of dates.slice(dateCount, dateCount + 50)) {
                            const row = node('div', null, rows); row.className = 'workspace-row';
                            const days = Math.round((this.parseTaskScheduleDate(todayForDisplay) - this.parseTaskScheduleDate(date)) / 86400000);
                            node('span', `${date}（${days}日超過）`, row);
                            button(row, '完了を記録', () => this.openEquipmentChild(() => this.openCompletionForm(task.id, date)));
                        }
                        dateCount = Math.min(dateCount + 50, dates.length);
                        moreDates.hidden = dateCount >= dates.length;
                        moreDates.textContent = `続きを表示（残り ${dates.length - dateCount} 回）`;
                    };
                    appendDates();
                }
                shown = Math.min(shown + 50, overdueGroups.length); more.hidden = shown >= overdueGroups.length;
                more.textContent = `続きを表示（残り ${overdueGroups.length - shown} 項目）`;
            };
            const todayForDisplay = this.getLocalDateString(); appendOverdue();
            const next = this.createEquipmentSection(root, 'upcoming', '次回のメンテ予定', data.upcoming.length, true);
            for (const { task, date } of data.upcoming) {
                const row = node('div', null, next); row.className = 'workspace-row';
                node('span', `${date}　${task.content || 'メンテナンス'}`, row);
                button(row, '完了を記録', () => this.openEquipmentChild(() => this.openCompletionForm(task.id, date)));
            }
            const history = this.createEquipmentSection(root, 'history', '最近の対応', data.history.length);
            if (data.history.length) this.appendEvidenceRows(history, data.history.slice(0, 10), { equipment: true });
            const guides = this.createEquipmentSection(root, 'guides', '関連手順書（同じ型式を含む）', data.guides.length);
            for (const record of data.guides.slice(0, 10)) button(guides, `${record.date || ''} ${this.getHistoryDisplayText(record) || '手順書'}`, () => this.openEquipmentChild(() => this.openGuideModal(record.id)));
            if (data.guides.length > 10) button(guides, 'すべての関連手順書', () => this.openEquipmentChild(() => this.openEvidenceRecords(data.guides, '関連手順書', { guides: true })));
            const parts = this.createEquipmentSection(root, 'parts', '使用部品（種類・対応履歴の累計）', data.parts.length);
            for (const part of data.parts) node('p', `${part.name} ${part.model}　${part.count} ${part.unit}`, parts);
        });
        document.getElementById('modal-save-btn').hidden = true;
        document.querySelector('#modal-container .modal-footer [onclick="app.requestCloseModal()"]').textContent = '閉じる';
        requestAnimationFrame(() => {
            const root = document.getElementById('modal-content');
            if (root?.dataset.equipmentId === machineId) root.scrollTop = scrollTop;
        });
    };

    P.openEquipmentChild = function (action) {
        const root = document.getElementById('modal-content');
        const context = root?.dataset.equipmentId
            ? { machineId: root.dataset.equipmentId, department: store.data.currentDepartmentId, scrollTop: root.scrollTop }
            : this._equipmentReturnContext;
        this._pendingEquipmentReturn = context;
        return action();
    };
    P.prepareEquipmentModal = function () {
        const context = this._pendingEquipmentReturn;
        this._equipmentReturnContext = context?.department === store.data.currentDepartmentId ? context : null;
        this._pendingEquipmentReturn = null;
    };
    P.injectEquipmentReturnButton = function () {
        if (!this._equipmentReturnContext) return;
        const footer = document.querySelector('#modal-container .modal-footer');
        const back = button(footer, '機械カルテへ戻る', () => {
            const context = this._equipmentReturnContext;
            if (!context || !this.requestCloseModal()) return;
            this.restoreEquipmentWorkspace(context);
        });
        back.classList.add('equipment-return-button'); footer.prepend(back);
    };
    P.restoreEquipmentWorkspace = function (context) {
        if (context?.department === store.data.currentDepartmentId) this.openEquipmentWorkspace(context.machineId, context.scrollTop);
    };
    P.onEquipmentModalClosed = function (type, saved) {
        const context = this._equipmentReturnContext;
        this._equipmentReturnContext = null; this._pendingEquipmentReturn = null;
        if (context && saved && ['edit-history', 'complete'].includes(type)) {
            setTimeout(() => {
                if (document.getElementById('modal-overlay')?.classList.contains('hidden')) this.restoreEquipmentWorkspace(context);
            }, 0);
        }
    };

    P.appendEvidenceRows = function (parent, records, options = {}) {
        if (!records.length) node('p', '対象の記録はありません。', parent);
        for (const record of records) {
            const row = node('div', null, parent); row.className = 'workspace-row';
            const text = node('div', null, row);
            node('b', `${record.date || '日付未設定'}　${this.getHistoryDisplayText(record) || '内容未設定'}`, text);
            const facts = this.getWorkTimeRecordFacts(record);
            node('small', `${(record.workers || []).join('、') || '作業者未設定'} / ${facts.unknownTime ? `時間未入力・不正値（登録値：${record.workTime ?? 'なし'}）` : `${facts.minutes} 分`}${options.contribution ? ` / 集計への加算 ${options.contribution(record)} 分` : ''}`, text);
            button(row, options.guides ? '手順書' : '記録を開く', () => {
                const action = () => options.guides ? this.openGuideModal(record.id) : this.openHistoryEditForm(record.id);
                return options.equipment || this._equipmentReturnContext ? this.openEquipmentChild(action) : action();
            });
        }
    };
    P.openEvidenceRecords = function (records, title, options = {}, page = 0) {
        const pageSize = 50, pages = Math.max(1, Math.ceil(records.length / pageSize));
        page = Math.max(0, Math.min(pages - 1, page));
        this.openModal('evidence-records', title, () => {
            const root = document.getElementById('modal-content'); root.classList.add('workspace-content');
            if (options.description) node('p', options.description, root);
            const nav = node('div', null, root); nav.className = 'workspace-toolbar';
            const go = page => this._equipmentReturnContext ? this.openEquipmentChild(() => this.openEvidenceRecords(records, title, options, page)) : this.openEvidenceRecords(records, title, options, page);
            button(nav, '前へ', () => go(page - 1)).disabled = page === 0;
            node('span', `${page + 1} / ${pages} ページ・全 ${records.length} 件`, nav);
            button(nav, '次へ', () => go(page + 1)).disabled = page + 1 === pages;
            this.appendEvidenceRows(root, records.slice(page * pageSize, (page + 1) * pageSize), options);
        });
        document.getElementById('modal-save-btn').hidden = true;
        document.querySelector('#modal-container .modal-footer [onclick="app.requestCloseModal()"]').textContent = '閉じる';
    };

    P.getTodayWorkspaceFilters = function () {
        if (this._todayWorkspaceDepartment !== store.data.currentDepartmentId || !this.todayWorkspaceFilters || typeof this.todayWorkspaceFilters !== 'object') {
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
