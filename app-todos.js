(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppTodoMethods extends MaintenanceApp {
    getPendingTodoRequestCount() {
        const todos = store.activeData?.localTodos || [];
        return todos.filter(todo => todo.isRequest && !todo.archived && (todo.status || 'todo') !== 'done').length;
    }

    compareKanbanTodosForBoard(a, b) {
        const priorityRank = { high: 3, medium: 2, normal: 2, low: 1 };
        const aHasDeadline = !!a.deadlineDate;
        const bHasDeadline = !!b.deadlineDate;
        if (aHasDeadline !== bHasDeadline) return aHasDeadline ? -1 : 1;

        if (aHasDeadline && bHasDeadline) {
            const aDeadline = `${a.deadlineDate || ''}T${a.deadlineTime || '00:00'}`;
            const bDeadline = `${b.deadlineDate || ''}T${b.deadlineTime || '00:00'}`;
            const deadlineOrder = aDeadline.localeCompare(bDeadline);
            if (deadlineOrder) return deadlineOrder;
        }

        const priorityOrder = (priorityRank[b.priority] || 2) - (priorityRank[a.priority] || 2);
        if (priorityOrder) return priorityOrder;
        return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
    }

    getPendingTodoRequests() {
        const todos = store.activeData?.localTodos || [];
        return todos
            .filter(todo => todo.isRequest && !todo.archived && (todo.status || 'todo') !== 'done')
            .sort((a, b) => this.compareKanbanTodosForBoard(a, b));
    }

    updateTodoRequestCountBadge() {
        const badge = document.getElementById('todo-request-count-badge');
        if (!badge) return;
        const count = this.getPendingTodoRequestCount();
        badge.textContent = String(count);
        badge.hidden = count === 0;
        badge.title = `未処理の依頼事項: ${count}件`;
    }

    openPendingTodoRequestPanel() {
        this.ensureKanbanTodoState();
        const requests = this.getPendingTodoRequests();
        this.openKanbanPanel('未処理の依頼事項', `
            <div class="kt-request-panel-list">
                ${requests.map(todo => {
                    const assignees = (todo.assignedTo || []).map(id => this.getKanbanTodoWorkerName(id)).filter(Boolean).join(', ') || '未設定';
                    const requester = todo.requestedBy ? this.getKanbanTodoWorkerName(todo.requestedBy) : '未設定';
                    const statusLabel = { todo: '未処理', progress: '処理中' }[todo.status || 'todo'] || (todo.status || '未処理');
                    const deadline = todo.deadlineDate ? `${todo.deadlineDate}${todo.deadlineTime ? ` ${todo.deadlineTime}` : ''}` : '期限なし';
                    return `
                        <button type="button" class="kt-request-panel-item" onclick="app.openPendingTodoRequest('${this.escapeJs(todo.id)}')">
                            <span class="kt-request-panel-title">${this.escapeHtml(todo.title || '無題')}</span>
                            <span class="kt-request-panel-meta">${this.escapeHtml(statusLabel)} / 依頼先: ${this.escapeHtml(assignees)} / 依頼者: ${this.escapeHtml(requester)}</span>
                            <span class="kt-request-panel-deadline"><i class="fa-solid fa-clock"></i> ${this.escapeHtml(deadline)}</span>
                        </button>
                    `;
                }).join('') || '<p class="kt-muted">未処理の依頼はありません</p>'}
            </div>
        `);
    }

    openPendingTodoRequest(todoId) {
        const todo = (store.activeData.localTodos || []).find(item => item.id === todoId);
        if (!todo) return;
        const firstAssignee = (todo.assignedTo || []).find(id => id && id !== 'all') || todo.requestedBy || '__all__';
        this.closeKanbanTodoModal();
        this.changeKanbanTodoWorker(firstAssignee);
        this.switchView('todos');
        setTimeout(() => {
            this.highlightKanbanTodoCard(todo.id);
            this.openKanbanTodoModal(todo.status || 'todo', todo.id);
        }, 90);
    }

    openKanbanRequestDashboard() {
        this.ensureKanbanTodoState();
        const requests = this.getPendingTodoRequests();
        const todoCount = requests.filter(todo => (todo.status || 'todo') === 'todo').length;
        const progressCount = requests.filter(todo => (todo.status || 'todo') === 'progress').length;
        const overdueCount = requests.filter(todo => this.getKanbanDeadlineStatus(todo) === 'overdue').length;
        const workerCounts = new Map();
        requests.forEach(todo => {
            const assignees = (todo.assignedTo || []).filter(id => id && id !== 'all');
            (assignees.length ? assignees : ['__unset__']).forEach(id => {
                workerCounts.set(id, (workerCounts.get(id) || 0) + 1);
            });
        });
        const workerRows = Array.from(workerCounts.entries())
            .sort((a, b) => b[1] - a[1] || this.getKanbanTodoWorkerName(a[0]).localeCompare(this.getKanbanTodoWorkerName(b[0]), 'ja'))
            .map(([workerId, count]) => `
                <button type="button" class="kt-request-worker-row" onclick="app.changeKanbanTodoWorker('${this.escapeJs(workerId === '__unset__' ? '__all__' : workerId)}'); app.closeKanbanTodoModal(); app.switchView('todos')">
                    <span>${this.escapeHtml(workerId === '__unset__' ? '未設定' : this.getKanbanTodoWorkerName(workerId))}</span>
                    <b>${count}件</b>
                </button>
            `).join('');

        this.openKanbanPanel('依頼ダッシュボード', `
            <div class="kt-request-dashboard">
                <div class="kt-request-dashboard-stats">
                    <div class="kt-request-stat-card"><span>未完了</span><b>${requests.length}</b></div>
                    <div class="kt-request-stat-card"><span>未処理</span><b>${todoCount}</b></div>
                    <div class="kt-request-stat-card"><span>進行中</span><b>${progressCount}</b></div>
                    <div class="kt-request-stat-card danger"><span>期限切れ</span><b>${overdueCount}</b></div>
                </div>
                <section class="kt-request-dashboard-section">
                    <h3>担当者別</h3>
                    <div class="kt-request-worker-list">
                        ${workerRows || '<p class="kt-muted">未完了の依頼はありません</p>'}
                    </div>
                </section>
                <section class="kt-request-dashboard-section">
                    <h3>依頼一覧</h3>
                    <div class="kt-request-panel-list">
                        ${requests.map(todo => {
                            const assignees = (todo.assignedTo || []).map(id => this.getKanbanTodoWorkerName(id)).filter(Boolean).join(', ') || '未設定';
                            const requester = todo.requestedBy ? this.getKanbanTodoWorkerName(todo.requestedBy) : '未設定';
                            const statusLabel = { todo: '未処理', progress: '進行中' }[todo.status || 'todo'] || (todo.status || '未処理');
                            const deadline = todo.deadlineDate ? `${todo.deadlineDate}${todo.deadlineTime ? ` ${todo.deadlineTime}` : ''}` : '期限なし';
                            const priority = { low: '低', medium: '中', high: '高' }[todo.priority || 'low'] || (todo.priority || '低');
                            return `
                                <button type="button" class="kt-request-panel-item" onclick="app.openPendingTodoRequest('${this.escapeJs(todo.id)}')">
                                    <span class="kt-request-panel-title">${this.escapeHtml(todo.title || '無題')}</span>
                                    <span class="kt-request-panel-meta">${this.escapeHtml(statusLabel)} / 優先度: ${this.escapeHtml(priority)} / 依頼先: ${this.escapeHtml(assignees)} / 依頼者: ${this.escapeHtml(requester)}</span>
                                    <span class="kt-request-panel-deadline"><i class="fa-solid fa-clock"></i> ${this.escapeHtml(deadline)}</span>
                                </button>
                            `;
                        }).join('') || '<p class="kt-muted">未完了の依頼はありません</p>'}
                    </div>
                </section>
            </div>
        `);
    }

    ensureKanbanTodoState() {
        const d = store.activeData;
        if (!Array.isArray(d.localTodos)) d.localTodos = [];
        if (!Array.isArray(d.localTodoWorkers) || d.localTodoWorkers.length === 0) {
            d.localTodoWorkers = [{ id: 'default', name: '共通・未設定' }];
        }
        if (!Array.isArray(d.localTodoLogs)) d.localTodoLogs = [];
        this.syncKanbanTodoWorkersWithCoreMembers(d);

        d.localTodos.forEach(todo => {
            if (!todo.status) todo.status = todo.done ? 'done' : 'todo';
            if (!todo.priority || todo.priority === 'normal') todo.priority = 'medium';
            if (todo.dueDate && !todo.deadlineDate) todo.deadlineDate = todo.dueDate;
            if (todo.deadline && !todo.deadlineDate) {
                todo.deadlineDate = String(todo.deadline).slice(0, 10);
                todo.deadlineTime = String(todo.deadline).slice(11, 16);
            }
            if (!Array.isArray(todo.assignedTo)) todo.assignedTo = [];
            if (!Array.isArray(todo.rejectedBy)) todo.rejectedBy = [];
            todo.description = todo.description || '';
            if ((todo.status || '') === 'done' && !todo.completedAt) todo.completedAt = todo.updatedAt || todo.createdAt || new Date().toISOString();
        });

        const validWorkerIds = new Set(['__all__', ...d.localTodoWorkers.map(w => w.id)]);
        const savedWorker = localStorage.getItem('kanbanTodoWorkerId');
        this.kanbanTodoWorkerId = validWorkerIds.has(this.kanbanTodoWorkerId)
            ? this.kanbanTodoWorkerId
            : (validWorkerIds.has(savedWorker) ? savedWorker : d.localTodoWorkers[0].id);
        return d;
    }

    getKanbanWorkerIdForCoreMemberName(name) {
        return `shift-core-${encodeURIComponent(String(name || '').trim())}`;
    }

    syncKanbanTodoWorkersWithCoreMembers(d = store.activeData) {
        if (!Array.isArray(d.localTodoWorkers)) d.localTodoWorkers = [];
        if (!Array.isArray(d.localTodos)) d.localTodos = [];
        const types = this.ensureShiftNotebookMemberTypes ? this.ensureShiftNotebookMemberTypes() : {};
        const coreNames = this.getShiftNotebookPresetMemberNames
            ? this.getShiftNotebookPresetMemberNames().filter(name => types[name] !== 'support')
            : [];
        if (coreNames.length === 0) {
            if (d.localTodoWorkers.length === 0) d.localTodoWorkers = [{ id: 'default', name: '共通・未設定' }];
            return;
        }

        const currentByName = new Map(d.localTodoWorkers.map(worker => [worker.name, worker]));
        const idMap = new Map();
        const syncedWorkers = coreNames.map(name => {
            const previous = currentByName.get(name);
            const nextId = previous?.id || this.getKanbanWorkerIdForCoreMemberName(name);
            if (previous?.id && previous.id !== nextId) idMap.set(previous.id, nextId);
            return { id: nextId, name };
        });

        d.localTodos.forEach(todo => {
            if (idMap.has(todo.requestedBy)) todo.requestedBy = idMap.get(todo.requestedBy);
            if (Array.isArray(todo.assignedTo)) todo.assignedTo = todo.assignedTo.map(id => idMap.get(id) || id);
            if (Array.isArray(todo.rejectedBy)) todo.rejectedBy = todo.rejectedBy.map(id => idMap.get(id) || id);
        });

        d.localTodoWorkers = syncedWorkers;
        const validIds = new Set(['__all__', ...syncedWorkers.map(worker => worker.id)]);
        if (!validIds.has(this.kanbanTodoWorkerId)) {
            const savedWorker = localStorage.getItem('kanbanTodoWorkerId');
            this.kanbanTodoWorkerId = validIds.has(savedWorker) ? savedWorker : syncedWorkers[0].id;
            localStorage.setItem('kanbanTodoWorkerId', this.kanbanTodoWorkerId);
        }
    }

    renderKanbanLocalTodos() {
        const d = this.ensureKanbanTodoState();
        const board = document.getElementById('kt-list-todo');
        if (!board) return;
        this.syncKanbanRecurringTodos();
        this.autoArchiveCompletedKanbanTodos();

        const workerSelect = document.getElementById('kt-worker-select');
        if (workerSelect) {
            workerSelect.innerHTML = `<option value="__all__" ${this.kanbanTodoWorkerId === '__all__' ? 'selected' : ''}>全員を表示</option>`
                + d.localTodoWorkers.map(w => `<option value="${this.escapeHtml(w.id)}" ${w.id === this.kanbanTodoWorkerId ? 'selected' : ''}>${this.escapeHtml(w.name)}</option>`).join('');
        }
        document.getElementById('kt-overdue-only-btn')?.classList.toggle('active', this.kanbanOverdueOnly);
        const priorityFilter = document.getElementById('kt-priority-filter');
        if (priorityFilter) priorityFilter.value = this.kanbanTodoPriorityFilter || 'all';
        const filterBanner = document.getElementById('kt-filter-banner');
        if (filterBanner) {
            const filters = [];
            if (this.kanbanOverdueOnly) filters.push('<i class="fa-solid fa-triangle-exclamation"></i> 期限切れのみ表示中');
            if (this.kanbanTodoWorkerId === '__all__') filters.push('<i class="fa-solid fa-users"></i> 全員を表示中');
            if ((this.kanbanTodoPriorityFilter || 'all') !== 'all') {
                const priorityLabel = { high: '高', medium: '中', low: '低' }[this.kanbanTodoPriorityFilter] || this.kanbanTodoPriorityFilter;
                filters.push(`<i class="fa-solid fa-filter"></i> 優先度 ${priorityLabel} のみ`);
            }
            filterBanner.hidden = filters.length === 0;
            filterBanner.innerHTML = filters.join('<span class="kt-filter-sep"></span>');
        }
        const shell = document.querySelector('.kt-board-shell');
        shell?.classList.toggle('kt-compact-cards', !!this.kanbanTodoCompactCards);
        const densityBtn = document.getElementById('kt-density-btn');
        if (densityBtn) {
            densityBtn.classList.toggle('active', !!this.kanbanTodoCompactCards);
            densityBtn.textContent = this.kanbanTodoCompactCards ? '標準表示' : 'コンパクト';
        }
        this.renderKanbanWorkloadSummary(d);
        this.renderKanbanOverduePin(d);
        this.renderTodoFiveSReturnNotice();

        const logList = document.getElementById('kt-log-list');
        if (logList) {
            logList.innerHTML = d.localTodoLogs.slice(0, 6).map(log => `
                <li><span>${this.escapeHtml(this.formatKanbanTodoTime(log.time))}</span>${this.escapeHtml(log.text || '')}</li>
            `).join('') || '<li class="kt-muted">まだログはありません</li>';
        }

        const statusLabels = { todo: 'TO DO', progress: '処理中', done: '処理済' };
        ['todo', 'progress', 'done'].forEach(status => {
            const list = document.getElementById(`kt-list-${status}`);
            if (!list) return;
            const items = d.localTodos
                .filter(todo => (todo.status || 'todo') === status)
                .filter(todo => this.isKanbanTodoVisible(todo))
                .filter(todo => this.isKanbanTodoPriorityVisible(todo))
                .filter(todo => !this.kanbanOverdueOnly || this.getKanbanDeadlineStatus(todo) === 'overdue')
                .sort((a, b) => this.compareKanbanTodosForBoard(a, b));
            document.getElementById(`kt-count-${status}`)?.replaceChildren(document.createTextNode(String(items.length)));
            const emptyText = this.kanbanOverdueOnly ? '期限切れタスクはありません' : `${statusLabels[status]} は空です`;
            list.innerHTML = items.length ? items.map(todo => this.renderKanbanTodoCard(todo)).join('') : `<div class="kt-empty">${emptyText}</div>`;
        });
        const historyCountBadge = document.getElementById('kt-history-count-badge');
        if (historyCountBadge) {
            historyCountBadge.textContent = String(d.localTodos.filter(todo => todo.archived).length);
        }
        this.updateTodoRequestCountBadge();
        if (document.querySelector('.kt-board-shell.kt-fit-mode')) {
            clearTimeout(this._kanbanFitTimer);
            this._kanbanFitTimer = setTimeout(() => this.adjustKanbanTodoFit(), 60);
        }
    }

    toggleKanbanTodoDensity() {
        this.kanbanTodoCompactCards = !this.kanbanTodoCompactCards;
        localStorage.setItem('kanban_todo_compact_cards', String(this.kanbanTodoCompactCards));
        this.renderKanbanLocalTodos();
    }

    renderKanbanWorkloadSummary(d = this.ensureKanbanTodoState()) {
        const container = document.getElementById('kt-workload-summary');
        if (!container) return;
        const workers = d.localTodoWorkers || [];
        if (!workers.length) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = workers.map(worker => {
            const related = (d.localTodos || []).filter(todo => {
                if (todo.archived) return false;
                const assigned = todo.assignedTo || [];
                return assigned.includes(worker.id) || assigned.includes('all') || (!assigned.length && todo.requestedBy === worker.id);
            });
            const pending = related.filter(todo => (todo.status || 'todo') !== 'done');
            const overdue = pending.filter(todo => this.getKanbanDeadlineStatus(todo) === 'overdue');
            const progress = pending.filter(todo => (todo.status || 'todo') === 'progress');
            return `
                <button type="button" class="kt-workload-card ${overdue.length ? 'danger' : ''} ${this.kanbanTodoWorkerId === worker.id ? 'active' : ''}" onclick="app.changeKanbanTodoWorker('${this.escapeJs(worker.id)}')">
                    <span>${this.escapeHtml(worker.name)}</span>
                    <b>未完了 ${pending.length}</b>
                    <small>期限切れ ${overdue.length} / 処理中 ${progress.length}</small>
                </button>
            `;
        }).join('');
    }

    renderKanbanOverduePin(d = this.ensureKanbanTodoState()) {
        const container = document.getElementById('kt-overdue-pin');
        if (!container) return;
        const overdue = (d.localTodos || [])
            .filter(todo => !todo.archived && (todo.status || 'todo') !== 'done')
            .filter(todo => this.isKanbanTodoVisible(todo))
            .filter(todo => this.isKanbanTodoPriorityVisible(todo))
            .filter(todo => this.getKanbanDeadlineStatus(todo) === 'overdue')
            .sort((a, b) => this.compareKanbanTodosForBoard(a, b))
            .slice(0, 6);
        container.hidden = overdue.length === 0;
        container.innerHTML = overdue.length ? `
            <div class="kt-overdue-pin-head"><i class="fa-solid fa-triangle-exclamation"></i><b>期限切れ固定</b><span>${overdue.length}件を先頭に表示</span></div>
            <div class="kt-overdue-pin-list">
                ${overdue.map(todo => `
                    <button type="button" onclick="app.openKanbanTodoModal('${this.escapeJs(todo.status || 'todo')}', '${this.escapeJs(todo.id)}')">
                        <b>${this.escapeHtml(todo.title || '無題')}</b>
                        <span>${this.escapeHtml(todo.deadlineDate || '')} / ${this.escapeHtml(this.getKanbanTodoAssigneeLabel(todo, 2))}</span>
                    </button>
                `).join('')}
            </div>
        ` : '';
    }

    toggleKanbanTodoFit() {
        const shell = document.querySelector('.kt-board-shell');
        const button = document.getElementById('kt-fit-btn');
        const board = document.querySelector('.kt-kanban');
        if (!shell || !board) return;
        if (shell.classList.contains('kt-fit-mode')) {
            shell.classList.remove('kt-fit-mode');
            shell.style.removeProperty('--kt-fit-scale');
            board.style.removeProperty('height');
            board.style.removeProperty('width');
            button?.classList.remove('active');
            if (button) button.innerHTML = '<i class="fa-solid fa-compress"></i> Fit';
            return;
        }
        shell.classList.add('kt-fit-mode');
        button?.classList.add('active');
        if (button) button.innerHTML = '<i class="fa-solid fa-up-right-and-down-left-from-center"></i> Reset';
        this.adjustKanbanTodoFit();
    }

    toggleKanbanOverdueOnly(force = null) {
        this.kanbanOverdueOnly = force === null ? !this.kanbanOverdueOnly : !!force;
        localStorage.setItem('kanban_overdue_only', String(this.kanbanOverdueOnly));
        document.getElementById('kt-overdue-only-btn')?.classList.toggle('active', this.kanbanOverdueOnly);
        this.renderKanbanLocalTodos();
    }

    changeKanbanTodoPriorityFilter(priority = 'all') {
        this.kanbanTodoPriorityFilter = ['all', 'high', 'medium', 'low'].includes(priority) ? priority : 'all';
        localStorage.setItem('kanban_todo_priority_filter', this.kanbanTodoPriorityFilter);
        this.renderKanbanLocalTodos();
    }

    adjustKanbanTodoFit() {
        const shell = document.querySelector('.kt-board-shell.kt-fit-mode');
        const board = shell?.querySelector('.kt-kanban');
        const viewport = document.querySelector('.viewport');
        if (!shell || !board || !viewport) return;
        shell.style.setProperty('--kt-fit-scale', '1');
        board.style.removeProperty('height');
        board.style.removeProperty('width');
        requestAnimationFrame(() => {
            const shellRect = shell.getBoundingClientRect();
            const boardRect = board.getBoundingClientRect();
            const viewportRect = viewport.getBoundingClientRect();
            const availableHeight = Math.max(260, viewportRect.bottom - boardRect.top - 10);
            const availableWidth = Math.max(420, shellRect.width - 12);
            const neededHeight = Math.max(board.scrollHeight, boardRect.height);
            const neededWidth = Math.max(board.scrollWidth, boardRect.width);
            const scale = Math.max(0.35, Math.min(1, availableHeight / neededHeight, availableWidth / neededWidth));
            shell.style.setProperty('--kt-fit-scale', scale.toFixed(3));
            board.style.height = `${Math.ceil(neededHeight * scale)}px`;
            board.style.width = scale < 1 ? `${Math.ceil(100 / scale)}%` : '';
        });
    }

    syncKanbanRecurringTodos() {
        const d = this.ensureKanbanTodoState();
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const generated = [];

        d.localTodos.forEach(todo => {
            if (!todo.isRecurring || !['done', 'archived'].includes(todo.status || 'todo')) return;
            if (todo.lastRecurringMonth === monthKey) return;
            const updatedMonth = String(todo.updatedAt || todo.createdAt || '').slice(0, 7);
            if (!updatedMonth || updatedMonth >= monthKey) return;

            const day = String(todo.deadlineDate || '').slice(8, 10);
            const deadlineDate = day ? `${monthKey}-${day}` : '';
            const clone = {
                ...todo,
                id: `kt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                status: 'todo',
                done: false,
                archived: false,
                deadlineDate,
                deadline: deadlineDate ? `${deadlineDate}${todo.deadlineTime ? `T${todo.deadlineTime}` : ''}` : '',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                sourceRecurringId: todo.sourceRecurringId || todo.id,
                lastRecurringMonth: ''
            };
            d.localTodos.unshift(clone);
            todo.lastRecurringMonth = monthKey;
            generated.push(clone.title || '無題');
        });

        if (generated.length) {
            this.addKanbanTodoLog(`定期タスクを補充: ${generated.join('、')}`);
            store.save();
        }
    }

    autoArchiveCompletedKanbanTodos() {
        const d = this.ensureKanbanTodoState();
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const doneItems = d.localTodos
            .filter(todo => !todo.archived && (todo.status || '') === 'done')
            .sort((a, b) => String(a.completedAt || a.updatedAt || a.createdAt || '').localeCompare(String(b.completedAt || b.updatedAt || b.createdAt || '')));
        if (doneItems.length === 0) return;

        const archiveSet = new Set();
        doneItems.forEach(todo => {
            const completedTime = new Date(todo.completedAt || todo.updatedAt || todo.createdAt || 0).getTime();
            if (completedTime && now - completedTime >= weekMs) archiveSet.add(todo.id);
        });

        if (doneItems.length > 5) {
            doneItems.slice(0, doneItems.length - 5).forEach(todo => archiveSet.add(todo.id));
        }

        if (archiveSet.size === 0) return;
        const archivedTitles = [];
        d.localTodos.forEach(todo => {
            if (!archiveSet.has(todo.id)) return;
            todo.archived = true;
            todo.archivedAt = new Date().toISOString();
            archivedTitles.push(todo.title || '無題');
        });
        this.addKanbanTodoLog(`完了タスクを自動で履歴へ移動: ${archivedTitles.join('、')}`);
        store.save();
        this.showKanbanAutoArchiveNotice(archivedTitles.length);
    }

    renderKanbanTodoCard(todo) {
        const priorityLabels = { low: '低', medium: '中', high: '高' };
        const deadlineStatus = this.getKanbanDeadlineStatus(todo);
        const deadlineLabel = todo.deadlineDate ? `${todo.deadlineDate}${todo.deadlineTime ? ` ${todo.deadlineTime}` : ''}` : '';
        const requestToLabel = todo.isRequest ? this.getKanbanTodoRequestTargetLabel(todo) : '';
        const requestFromLabel = todo.isRequest ? this.getKanbanTodoWorkerName(todo.requestedBy) : '';
        const hasShiftSource = !!(todo.isRequest && todo.shiftRequestSource?.dateStr && todo.shiftRequestSource?.shift);
        const hasFiveSSource = hasShiftSource && this.isKanbanTodoFiveSRequest(todo);
        const cardDescription = String(todo.description || '').split(/\r?\n/)[0];
        const archiveNotice = this.getKanbanDoneArchiveNotice(todo);
        const sourceClass = hasFiveSSource ? 'source-five-s' : (hasShiftSource ? 'source-shift' : 'source-normal');
        const completionCommentHtml = todo.completionComment
            ? `<div class="kt-completion-comment"><i class="fa-solid fa-check"></i> ${this.escapeHtml(todo.completionComment)}</div>`
            : '';
        const navigationStamps = [
            hasShiftSource ? `<button type="button" class="kt-mini-badge notebook" onclick="event.stopPropagation(); app.openShiftNotebookFromTodoCard('${this.escapeJs(todo.id)}')" title="該当の連絡帳へ移動"><i class="fa-solid fa-book-open"></i> 連絡帳</button>` : '',
            hasFiveSSource ? `<button type="button" class="kt-mini-badge five-s" onclick="event.stopPropagation(); app.openFiveSManagementFromTodoCard('${this.escapeJs(todo.id)}')" title="該当の5S管理へ移動"><i class="fa-solid fa-broom"></i> 5S管理</button>` : ''
        ].join('');
        return `
            <article class="kt-task-card priority-${this.escapeHtml(todo.priority || 'medium')} ${sourceClass} ${todo.isRecurring ? 'type-recurring' : ''} ${todo.isRequest ? 'type-request' : ''} deadline-${deadlineStatus}"
                draggable="true"
                ondragstart="app.dragKanbanTodo(event, '${this.escapeJs(todo.id)}')"
                onclick="app.openKanbanTodoModal('${this.escapeJs(todo.status || 'todo')}', '${this.escapeJs(todo.id)}')">
                <div class="kt-card-top">
                    <span class="kt-priority-badge">${priorityLabels[todo.priority] || '中'}</span>
                    ${todo.isRecurring ? '<span class="kt-mini-badge recurring">定期</span>' : ''}
                    ${todo.isRequest ? `<span class="kt-mini-badge request">依頼先: ${this.escapeHtml(requestToLabel)}</span><span class="kt-mini-badge requester">依頼者: ${this.escapeHtml(requestFromLabel)}</span>` : ''}
                    ${navigationStamps}
                </div>
                <div class="kt-card-title">${this.escapeHtml(todo.title || '無題のタスク')}</div>
                ${cardDescription ? `<div class="kt-card-desc">${this.escapeHtml(cardDescription).slice(0, 80)}</div>` : ''}
                ${completionCommentHtml}
                <div class="kt-card-meta">
                    ${deadlineLabel ? `<span><i class="fa-solid fa-clock"></i> ${this.escapeHtml(deadlineLabel)}</span>` : '<span class="kt-muted">期限なし</span>'}
                    ${archiveNotice}
                    <span class="kt-card-actions">
                        ${hasShiftSource ? `<button type="button" class="kt-card-calendar" onclick="event.stopPropagation(); app.openShiftNotebookFromTodoCard('${this.escapeJs(todo.id)}')" title="依頼元の連絡帳へ戻る"><i class="fa-solid fa-calendar-days"></i></button>` : ''}
                        ${todo.status === 'done' ? `<button type="button" class="kt-card-archive" onclick="event.stopPropagation(); app.archiveKanbanTodo('${this.escapeJs(todo.id)}')" title="履歴へ移動"><i class="fa-solid fa-box-archive"></i></button>` : ''}
                        <button type="button" class="kt-card-delete" onclick="event.stopPropagation(); app.deleteKanbanTodo('${this.escapeJs(todo.id)}')" title="削除"><i class="fa-solid fa-trash-can"></i></button>
                    </span>
                </div>
            </article>
        `;
    }

    getKanbanDoneArchiveNotice(todo) {
        if ((todo.status || '') !== 'done') return '';
        const dayMs = 24 * 60 * 60 * 1000;
        const weekMs = 7 * dayMs;
        const completedTime = new Date(todo.completedAt || todo.updatedAt || todo.createdAt || 0).getTime();
        if (!completedTime) return '<span class="kt-archive-countdown" title="処理済は基本7日後に過去履歴へ移動します"><i class="fa-solid fa-box-archive"></i> 履歴化まであと7日</span>';
        const remainingMs = weekMs - (Date.now() - completedTime);
        const daysLeft = Math.max(0, Math.ceil(remainingMs / dayMs));
        const label = daysLeft <= 0 ? '次回履歴へ移動' : `履歴化まであと${daysLeft}日`;
        return `<span class="kt-archive-countdown" title="処理済は基本7日後に過去履歴へ移動します。処理済が6件以上ある場合は古いものから先に移動します。"><i class="fa-solid fa-box-archive"></i> ${this.escapeHtml(label)}</span>`;
    }

    isKanbanTodoFiveSRequest(todo) {
        if (!todo?.shiftRequestSource?.rowId) return false;
        if (String(todo.title || '').startsWith('5S対応:')) return true;
        if (typeof this.resolveFiveSNotebookRowSource !== 'function') return false;
        const source = todo.shiftRequestSource;
        return !!this.resolveFiveSNotebookRowSource(source.dateStr, source.shift, source.rowId);
    }

    openShiftNotebookFromTodoCard(todoId) {
        const todo = (store.activeData.localTodos || []).find(item => item.id === todoId);
        const source = todo?.shiftRequestSource;
        if (!source?.dateStr || !source?.shift) {
            alert('依頼元の連絡帳が見つかりません。');
            return;
        }
        this.closeKanbanTodoModal();
        this.switchView('calendar');
        this.openShiftNotebookModal(source.dateStr, source.shift);
        setTimeout(() => {
            const row = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'))
                .find(item => item.dataset.shiftRowId === source.rowId);
            row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row?.classList.add('shift-row-source-highlight');
            setTimeout(() => row?.classList.remove('shift-row-source-highlight'), 10000);
        }, 120);
    }

    openFiveSManagementFromTodoCard(todoId) {
        const todo = (store.activeData.localTodos || []).find(item => item.id === todoId);
        const source = todo?.shiftRequestSource;
        if (!source?.rowId) {
            alert('該当の5S管理が見つかりません。');
            return;
        }
        this._fiveSHighlightRowId = source.rowId;
        this._fiveSHighlightSource = { ...source };
        this._fiveSHighlightTodoId = todo.id;
        this._fiveSJumpOrigin = {
            todoId: todo.id,
            title: todo.title || '無題のToDo',
            status: this.getKanbanTodoStatusLabel(todo),
            assignees: this.getKanbanTodoAssigneeLabel(todo, 3)
        };
        this.addJumpHistory({
            kind: 'fiveS',
            todoId: todo.id,
            from: 'ToDo',
            to: '5S管理',
            label: todo.title || '無題のToDo'
        });
        this._fiveSHighlightRetryCount = 0;
        if (typeof this.openFiveSManagementFromShiftNotebook === 'function') {
            this.openFiveSManagementFromShiftNotebook(null);
            return;
        }
        this.closeModal();
        const alreadyFiveS = this.currentView === 'fiveS';
        this.switchView('fiveS');
        if (alreadyFiveS) this.renderFiveSManagement();
    }

    getKanbanTodoStatusLabel(todo) {
        const status = todo?.status || 'todo';
        if (status === 'progress') return '対応中';
        if (status === 'done') return '完了';
        return '未完了';
    }

    getKanbanTodoAssigneeLabel(todo, limit = 2) {
        const names = (todo?.assignedTo || []).map(id => this.getKanbanTodoWorkerName(id)).filter(Boolean);
        if (!names.length) return '未設定';
        const visible = names.slice(0, limit).join(', ');
        return names.length > limit ? `${visible} 他${names.length - limit}` : visible;
    }

    getKanbanTodoJumpLabel(todo, total = 1) {
        const status = this.getKanbanTodoStatusLabel(todo);
        const assignees = this.getKanbanTodoAssigneeLabel(todo);
        return `${status}ToDoへ: ${assignees}${total > 1 ? ` (${total})` : ''}`;
    }

    addJumpHistory(entry = {}) {
        if (!entry.todoId || !entry.to) return;
        const history = this.getJumpHistory();
        const item = {
            ...entry,
            time: new Date().toISOString()
        };
        this._jumpHistory = [
            item,
            ...history.filter(old => !(old.todoId === item.todoId && old.to === item.to))
        ].slice(0, 5);
    }

    getJumpHistory() {
        const now = Date.now();
        const ttl = 10 * 60 * 1000;
        const history = Array.isArray(this._jumpHistory) ? this._jumpHistory : [];
        this._jumpHistory = history.filter(entry => {
            const time = entry.time ? new Date(entry.time).getTime() : 0;
            return time && !Number.isNaN(time) && now - time <= ttl;
        });
        return this._jumpHistory;
    }

    getJumpHistoryLabel(entry = {}) {
        const time = entry.time ? new Date(entry.time) : null;
        const stamp = time && !Number.isNaN(time.getTime())
            ? `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`
            : '';
        return `${stamp ? `${stamp} ` : ''}${entry.from || ''}→${entry.to || ''}: ${entry.label || '無題'}`;
    }

    openJumpHistoryEntry(index) {
        const entry = this.getJumpHistory()[Number(index)];
        if (!entry?.todoId) return;
        if (entry.to === '5S管理') {
            this.openFiveSManagementFromTodoCard(entry.todoId);
            return;
        }
        if (entry.to === 'ToDo') {
            this.openKanbanTodoFromSearch(entry.todoId, false, { recordJump: false });
        }
    }

    showKanbanTodoJumpNotice(todo, workerLabel = '') {
        document.querySelectorAll('.kanban-jump-toast').forEach(el => el.remove());
        const toast = document.createElement('div');
        toast.className = 'kanban-jump-toast';
        toast.innerHTML = `<i class="fa-solid fa-location-dot"></i><span>${this.escapeHtml(workerLabel || this.getKanbanTodoAssigneeLabel(todo))}のToDoリストへ移動しました</span>`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 220);
        }, 2600);
    }

    showKanbanAutoArchiveNotice(count = 0) {
        document.querySelectorAll('.kanban-jump-toast').forEach(el => el.remove());
        const toast = document.createElement('div');
        toast.className = 'kanban-jump-toast kanban-auto-archive-toast';
        toast.innerHTML = `<i class="fa-solid fa-box-archive"></i><span>処理済ToDo ${count}件を過去履歴へ移動しました</span>`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 220);
        }, 3200);
    }

    openKanbanTodoFromSearch(todoId, openDetail = true, options = {}) {
        const todo = (store.activeData.localTodos || []).find(item => item.id === todoId);
        if (!todo) return;
        const fromView = this.currentView;
        const workerId = (todo.assignedTo || [])[0] || todo.requestedBy || this.kanbanTodoWorkerId || '__all__';
        this.changeKanbanTodoWorker(workerId === 'all' ? '__all__' : workerId);
        this.switchView('todos');
        const workerLabel = this.getKanbanTodoWorkerName(workerId === 'all' ? '__all__' : workerId);
        if (options.notice !== false) this.showKanbanTodoJumpNotice(todo, workerLabel);
        if (options.recordJump !== false && fromView && fromView !== 'todos') {
            this.addJumpHistory({
                kind: 'todo',
                todoId: todo.id,
                from: fromView === 'fiveS' ? '5S管理' : '画面',
                to: 'ToDo',
                label: todo.title || '無題のToDo'
            });
        }
        if (fromView === 'fiveS') {
            this._todoFiveSReturnOrigin = {
                todoId: todo.id,
                title: todo.title || '無題のToDo',
                status: this.getKanbanTodoStatusLabel(todo),
                assignees: this.getKanbanTodoAssigneeLabel(todo, 3)
            };
        }
        setTimeout(() => {
            const card = Array.from(document.querySelectorAll('.kt-task-card'))
                .find(el => (el.getAttribute('onclick') || '').includes(todo.id));
            card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card?.classList.add('kt-task-card-jump');
            setTimeout(() => card?.classList.remove('kt-task-card-jump'), 4000);
            if (openDetail) this.openKanbanTodoModal(todo.status || 'todo', todo.id);
        }, 80);
    }

    renderTodoFiveSReturnNotice() {
        const shell = document.querySelector('.kt-board-shell');
        if (!shell) return;
        let notice = document.getElementById('kt-five-s-return-notice');
        if (!notice) {
            notice = document.createElement('div');
            notice.id = 'kt-five-s-return-notice';
            notice.className = 'kt-five-s-return-notice';
            const board = shell.querySelector('.kt-kanban');
            if (board) board.before(notice);
            else shell.appendChild(notice);
        }
        const origin = this._todoFiveSReturnOrigin;
        if (!origin) {
            notice.hidden = true;
            notice.innerHTML = '';
            return;
        }
        const history = this.getJumpHistory().slice(0, 4);
        const historyHtml = history.length ? `
            <div class="kt-jump-history">
                <span>移動履歴</span>
                ${history.map((entry, index) => `
                    <button type="button" onclick="app.openJumpHistoryEntry(${index})" title="${this.escapeHtml(this.getJumpHistoryLabel(entry))}">
                        ${this.escapeHtml(this.getJumpHistoryLabel(entry))}
                    </button>
                `).join('')}
            </div>
        ` : '';
        notice.hidden = false;
        notice.innerHTML = `
            <div class="kt-five-s-return-main">
                <div>
                    <i class="fa-solid fa-arrow-right-to-bracket"></i>
                    <b>5S管理から移動</b>
                    <span>${this.escapeHtml(origin.title || '無題のToDo')}</span>
                    <small>${this.escapeHtml(origin.status || '未完了')} / ${this.escapeHtml(origin.assignees || '未設定')}</small>
                </div>
                <button type="button" onclick="app.openFiveSManagementFromTodoCard('${this.escapeJs(origin.todoId)}')">
                    <i class="fa-solid fa-broom"></i> 5S管理へ戻る
                </button>
            </div>
            ${historyHtml}
            <button type="button" class="kt-five-s-return-close" onclick="app._todoFiveSReturnOrigin = null; app.renderTodoFiveSReturnNotice()" title="案内を閉じる">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
    }

    getKanbanTodoWorkerName(id) {
        if (id === '__all__' || id === 'all') return '全員';
        const worker = (store.activeData.localTodoWorkers || []).find(w => w.id === id);
        return worker ? worker.name : '未設定';
    }

    getKanbanTodoRequestTargetLabel(todo) {
        const ids = Array.isArray(todo?.assignedTo) ? todo.assignedTo : [];
        if (ids.includes('all')) return '全員';
        const names = ids.map(id => this.getKanbanTodoWorkerName(id)).filter(Boolean);
        return names.length ? names.join(', ') : '未設定';
    }

    formatKanbanTodoTime(value) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    getKanbanDeadlineStatus(todo) {
        if (!todo.deadlineDate || todo.status === 'done') return '';
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
        if (todo.deadlineDate < todayStr) return 'overdue';
        if (todo.deadlineDate === todayStr) return 'today';
        if (todo.deadlineDate === tomorrowStr) return 'tomorrow';
        return '';
    }

    isKanbanTodoVisible(todo) {
        if (todo.archived) return false;
        const workerId = this.kanbanTodoWorkerId;
        if (workerId === '__all__') return true;
        if ((todo.rejectedBy || []).includes(workerId)) return false;
        const assigned = todo.assignedTo || [];
        if (assigned.includes('all') || assigned.includes(workerId)) return true;
        if (assigned.length === 0) return (todo.requestedBy || '') === workerId;
        return !!todo.isRequest && todo.requestedBy === workerId;
    }

    isKanbanTodoPriorityVisible(todo) {
        const filter = this.kanbanTodoPriorityFilter || 'all';
        if (filter === 'all') return true;
        const priority = todo.priority === 'normal' ? 'medium' : (todo.priority || 'medium');
        return priority === filter;
    }

    addKanbanTodoLog(text) {
        this.ensureKanbanTodoState();
        store.activeData.localTodoLogs.unshift({
            id: `kt-log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            time: new Date().toISOString(),
            text
        });
        store.activeData.localTodoLogs = store.activeData.localTodoLogs.slice(0, 200);
    }

    changeKanbanTodoWorker(workerId) {
        this.ensureKanbanTodoState();
        this.kanbanTodoWorkerId = workerId === 'all' ? '__all__' : workerId;
        localStorage.setItem('kanbanTodoWorkerId', this.kanbanTodoWorkerId);
        this.renderKanbanLocalTodos();
    }

    dragKanbanTodo(event, id) {
        event.dataTransfer.setData('text/plain', id);
        event.dataTransfer.effectAllowed = 'move';
    }

    dropKanbanTodo(event, status) {
        event.preventDefault();
        const id = event.dataTransfer.getData('text/plain');
        if (id) this.moveKanbanTodo(id, status);
    }

    moveKanbanTodo(id, status) {
        const d = this.ensureKanbanTodoState();
        const todo = d.localTodos.find(item => item.id === id);
        if (!todo || todo.status === status) return;
        const previousStatus = todo.status || 'todo';
        todo.status = status;
        todo.done = status === 'done';
        if (status === 'done' && previousStatus !== 'done') {
            todo.completedAt = new Date().toISOString();
            todo.completionComment = this.askKanbanCompletionComment(todo);
        }
        if (status !== 'done') todo.completedAt = '';
        todo.updatedAt = new Date().toISOString();
        this.addKanbanTodoLog(`「${todo.title || '無題'}」を${{ todo: 'TO DO', progress: '処理中', done: '処理済' }[status]}へ移動`);
        if (previousStatus !== 'progress' && status === 'progress') {
            this.appendShiftTodoFeedback(todo, 'progress');
            todo.shiftRequestFeedbackProgress = true;
        }
        if (previousStatus !== 'done' && status === 'done') {
            this.appendShiftTodoFeedback(todo, 'done');
            todo.shiftRequestFeedbackDone = true;
        }
        store.save();
        this.updateTodoRequestCountBadge();
        this.renderKanbanLocalTodos();
        if (document.getElementById('fiveS-list')) this.renderFiveSManagement();
    }

    askKanbanCompletionComment(todo) {
        const existing = todo?.completionComment || '';
        const value = prompt('完了コメント（任意）\n依頼元の連絡帳や5S履歴にも残せます。', existing);
        return value === null ? existing : String(value || '').trim();
    }

    openKanbanTodoModal(status = 'todo', id = '', isRecurring = false, isRequest = false) {
        const d = this.ensureKanbanTodoState();
        const todo = id ? d.localTodos.find(item => item.id === id) : null;
        const defaultAssignedTo = this.kanbanTodoWorkerId && this.kanbanTodoWorkerId !== '__all__'
            ? [this.kanbanTodoWorkerId]
            : [];
        const current = todo || {
            id: '',
            title: '',
            description: '',
            priority: 'medium',
            status,
            deadlineDate: '',
            deadlineTime: '',
            isRecurring,
            isRequest,
            assignedTo: defaultAssignedTo,
            requestedBy: this.kanbanTodoWorkerId,
            rejectedBy: []
        };
        const receivedRequest = current.isRequest && current.requestedBy && current.requestedBy !== this.kanbanTodoWorkerId;
        const fontScale = this.getKanbanTodoModalFontScale();
        this.closeKanbanTodoModal();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="kt-todo-modal-overlay" class="kt-modal-overlay active" onclick="if(event.target === this) app.closeKanbanTodoModal()">
                <div class="kt-modal kt-todo-modal kt-font-${fontScale}">
                    <div class="kt-modal-header">
                        <h2>${todo ? 'タスク編集' : (isRequest ? '依頼を追加' : 'タスク追加')}</h2>
                        <div class="kt-modal-header-actions">
                            <div class="kt-font-size-controls" aria-label="文字サイズ">
                                <button type="button" class="${fontScale === 'small' ? 'active' : ''}" onclick="app.setKanbanTodoModalFontScale('small')" title="文字を小さく">A-</button>
                                <button type="button" class="${fontScale === 'normal' ? 'active' : ''}" onclick="app.setKanbanTodoModalFontScale('normal')" title="標準サイズ">A</button>
                                <button type="button" class="${fontScale === 'large' ? 'active' : ''}" onclick="app.setKanbanTodoModalFontScale('large')" title="文字を大きく">A+</button>
                            </div>
                            <button type="button" class="kt-modal-close-btn" onclick="app.closeKanbanTodoModal()"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>
                    <input type="hidden" id="kt-task-id" value="${this.escapeHtml(current.id)}">
                    <input type="hidden" id="kt-task-status" value="${this.escapeHtml(current.status || status)}">
                    <label class="kt-field">タイトル
                        <input type="text" id="kt-task-title" value="${this.escapeHtml(current.title || '')}" placeholder="タスク名">
                    </label>
                    <label class="kt-field">詳細
                        <textarea id="kt-task-desc" rows="8" placeholder="作業メモ・チェック内容">${this.escapeHtml(current.description || '')}</textarea>
                    </label>
                    ${Array.isArray(current.changeLog) && current.changeLog.length ? `
                        <div class="kt-change-log-box">
                            <b>変更履歴</b>
                            ${current.changeLog.slice(0, 6).map(log => `<span>${this.escapeHtml(this.formatKanbanTodoTime(log.at) || log.at || '')} / ${this.escapeHtml(log.by || '')} / ${this.escapeHtml(log.action || '')}${Array.isArray(log.fields) && log.fields.length ? `: ${this.escapeHtml(log.fields.join(', '))}` : ''}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="kt-detail-tools">
                        <button type="button" onclick="app.insertKanbanDetailCheckmark()">✅</button>
                        <button type="button" onclick="app.insertKanbanDetailTimestamp()">時刻</button>
                        <button type="button" onclick="app.insertKanbanDetailTemplate()">テンプレ</button>
                        <button type="button" onclick="app.insertKanbanDetailSeparator()">区切り</button>
                    </div>
                    <div class="kt-form-grid">
                        <label class="kt-field">優先度
                            <select id="kt-task-priority">
                                <option value="low" ${current.priority === 'low' ? 'selected' : ''}>低</option>
                                <option value="medium" ${!current.priority || current.priority === 'medium' ? 'selected' : ''}>中</option>
                                <option value="high" ${current.priority === 'high' ? 'selected' : ''}>高</option>
                            </select>
                        </label>
                        <label class="kt-field">期限日
                            <input type="date" id="kt-task-deadline-date" value="${this.escapeHtml(current.deadlineDate || '')}">
                        </label>
                        <label class="kt-field">時刻
                            <input type="time" id="kt-task-deadline-time" value="${this.escapeHtml(current.deadlineTime || '')}">
                        </label>
                    </div>
                    <div class="kt-check-row">
                        <label><input type="checkbox" id="kt-task-recurring" ${current.isRecurring ? 'checked' : ''}> 毎月の定期タスク</label>
                        <label><input type="checkbox" id="kt-task-request" ${current.isRequest ? 'checked' : ''} ${receivedRequest ? 'disabled' : ''}> 依頼タスク</label>
                    </div>
                    <div class="kt-request-box">
                        <div class="kt-request-title">依頼先</div>
                        ${this.renderKanbanWorkerCheckboxes(current.assignedTo || [])}
                    </div>
                    <div class="kt-modal-actions">
                        ${receivedRequest ? `<button type="button" class="danger-btn" onclick="app.rejectKanbanTodo('${this.escapeJs(current.id)}')">拒否</button>` : ''}
                        ${todo ? '<button type="button" class="danger-btn" onclick="app.deleteKanbanTodoFromModal()">削除</button>' : ''}
                        <span></span>
                        <button type="button" class="secondary-btn" onclick="app.closeKanbanTodoModal()">閉じる</button>
                        <button type="button" class="primary-btn" onclick="app.saveKanbanTodoFromModal()">保存</button>
                    </div>
                </div>
            </div>
        `);
        document.getElementById('kt-task-title')?.focus();
    }

    getKanbanTodoModalFontScale() {
        const saved = localStorage.getItem('kanbanTodoModalFontScale') || 'normal';
        return ['small', 'normal', 'large'].includes(saved) ? saved : 'normal';
    }

    setKanbanTodoModalFontScale(scale) {
        if (!['small', 'normal', 'large'].includes(scale)) scale = 'normal';
        localStorage.setItem('kanbanTodoModalFontScale', scale);

        const modal = document.querySelector('.kt-todo-modal');
        if (!modal) return;
        modal.classList.remove('kt-font-small', 'kt-font-normal', 'kt-font-large');
        modal.classList.add(`kt-font-${scale}`);
        modal.querySelectorAll('.kt-font-size-controls button').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${scale}'`));
        });
    }

    renderKanbanWorkerCheckboxes(selected = []) {
        const d = this.ensureKanbanTodoState();
        return `
            <label class="kt-worker-check all"><input type="checkbox" value="all" ${selected.includes('all') ? 'checked' : ''}> 全員</label>
            ${d.localTodoWorkers.map(w => `
                <label class="kt-worker-check"><input type="checkbox" value="${this.escapeHtml(w.id)}" ${selected.includes(w.id) ? 'checked' : ''}> ${this.escapeHtml(w.name)}</label>
            `).join('')}
        `;
    }

    saveKanbanTodoFromModal() {
        const d = this.ensureKanbanTodoState();
        const id = document.getElementById('kt-task-id')?.value || '';
        const title = (document.getElementById('kt-task-title')?.value || '').trim();
        if (!title) {
            document.getElementById('kt-task-title')?.focus();
            return;
        }
        const assigned = Array.from(document.querySelectorAll('.kt-worker-check input:checked')).map(el => el.value);
        const now = new Date().toISOString();
        let todo = id ? d.localTodos.find(item => item.id === id) : null;
        const wasNew = !todo;
        const previousStatus = todo?.status || '';
        const previousTodo = todo ? {
            title: todo.title || '',
            description: todo.description || '',
            priority: todo.priority || '',
            status: todo.status || '',
            deadlineDate: todo.deadlineDate || '',
            deadlineTime: todo.deadlineTime || '',
            assignedTo: [...(todo.assignedTo || [])]
        } : null;
        if (!todo) {
            todo = { id: `kt-${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: now, requestedBy: this.kanbanTodoWorkerId, rejectedBy: [] };
            d.localTodos.unshift(todo);
        }
        todo.title = title;
        todo.description = document.getElementById('kt-task-desc')?.value || '';
        todo.priority = document.getElementById('kt-task-priority')?.value || 'medium';
        todo.status = document.getElementById('kt-task-status')?.value || 'todo';
        todo.done = todo.status === 'done';
        if (todo.status === 'done' && previousStatus !== 'done') {
            todo.completedAt = now;
            todo.completionComment = this.askKanbanCompletionComment(todo);
        }
        if (todo.status !== 'done') todo.completedAt = '';
        todo.deadlineDate = document.getElementById('kt-task-deadline-date')?.value || '';
        todo.deadlineTime = document.getElementById('kt-task-deadline-time')?.value || '';
        todo.deadline = todo.deadlineDate ? `${todo.deadlineDate}${todo.deadlineTime ? `T${todo.deadlineTime}` : ''}` : '';
        todo.isRecurring = !!document.getElementById('kt-task-recurring')?.checked;
        todo.isRequest = !!document.getElementById('kt-task-request')?.checked;
        todo.assignedTo = assigned;
        todo.updatedAt = now;
        const changedFields = [];
        if (!wasNew && previousTodo) {
            if (previousTodo.title !== todo.title) changedFields.push('タイトル');
            if (previousTodo.description !== todo.description) changedFields.push('詳細');
            if (previousTodo.priority !== todo.priority) changedFields.push('優先度');
            if (previousTodo.status !== todo.status) changedFields.push('状態');
            if (previousTodo.deadlineDate !== todo.deadlineDate || previousTodo.deadlineTime !== todo.deadlineTime) changedFields.push('期限');
            if (previousTodo.assignedTo.join(',') !== assigned.join(',')) changedFields.push('担当者');
        }
        if (!Array.isArray(todo.changeLog)) todo.changeLog = [];
        todo.changeLog.unshift({
            at: now,
            by: this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId),
            action: wasNew ? '作成' : '更新',
            fields: wasNew ? ['新規作成'] : changedFields
        });
        todo.changeLog = todo.changeLog.slice(0, 50);
        this.addKanbanTodoLog(`${wasNew ? '作成' : '更新'}: 「${todo.title}」`);
        if (previousStatus !== 'done' && todo.status === 'done' && !todo.shiftRequestFeedbackDone) {
            this.appendShiftTodoFeedback(todo, 'done');
            todo.shiftRequestFeedbackDone = true;
        }
        store.save();
        this.closeKanbanTodoModal();
        this.renderKanbanLocalTodos();
        if (document.getElementById('fiveS-list')) this.renderFiveSManagement();
    }

    closeKanbanTodoModal() {
        document.getElementById('kt-todo-modal-overlay')?.remove();
        document.getElementById('kt-panel-overlay')?.remove();
    }

    deleteKanbanTodoFromModal() {
        const id = document.getElementById('kt-task-id')?.value || '';
        if (id) this.deleteKanbanTodo(id, { closeModal: true });
    }

    deleteKanbanTodo(id, options = {}) {
        if (!id) return;
        const d = this.ensureKanbanTodoState();
        const index = d.localTodos.findIndex(item => item.id === id);
        const todo = d.localTodos[index];
        if (!todo) return;
        const removedTodo = { ...todo, assignedTo: [...(todo.assignedTo || [])], rejectedBy: [...(todo.rejectedBy || [])], shiftRequestSource: todo.shiftRequestSource ? { ...todo.shiftRequestSource } : null };
        d.localTodos.splice(index, 1);
        this.addKanbanTodoLog(`削除: 「${todo.title || '無題'}」`);
        store.save();
        if (options.closeModal) this.closeKanbanTodoModal();
        this.updateTodoRequestCountBadge();
        this.renderKanbanLocalTodos();
        let restored = false;
        this.showUndoNotice(`${todo.title || '無題'}を削除しました`, () => {
            restored = true;
            const latest = this.ensureKanbanTodoState();
            if (!latest.localTodos.some(item => item.id === removedTodo.id)) {
                latest.localTodos.splice(Math.min(index, latest.localTodos.length), 0, removedTodo);
                this.addKanbanTodoLog(`削除を取り消し: 「${removedTodo.title || '無題'}」`);
                store.save();
                this.updateTodoRequestCountBadge();
                this.renderKanbanLocalTodos();
                setTimeout(() => this.highlightKanbanTodoCard(removedTodo.id), 80);
            }
        }, () => {
            if (!restored && removedTodo.isRequest && removedTodo.shiftRequestSource) {
                this.appendShiftTodoFeedback(removedTodo, 'deleted');
                store.save();
            }
        }, document.body, 'todo-undo');
    }

    highlightKanbanTodoCard(todoId) {
        const card = Array.from(document.querySelectorAll('.kt-task-card'))
            .find(el => (el.getAttribute('onclick') || '').includes(todoId));
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card?.classList.add('kt-task-card-jump');
        setTimeout(() => card?.classList.remove('kt-task-card-jump'), 4000);
    }

    archiveKanbanTodo(id) {
        const d = this.ensureKanbanTodoState();
        const todo = d.localTodos.find(item => item.id === id);
        if (!todo) return;
        todo.archived = true;
        todo.updatedAt = new Date().toISOString();
        this.addKanbanTodoLog(`履歴へ移動: 「${todo.title || '無題'}」`);
        store.save();
        this.updateTodoRequestCountBadge();
        this.renderKanbanLocalTodos();
    }

    rejectKanbanTodo(id) {
        const d = this.ensureKanbanTodoState();
        const todo = d.localTodos.find(item => item.id === id);
        if (!todo) return;
        if (!todo.rejectedBy.includes(this.kanbanTodoWorkerId)) todo.rejectedBy.push(this.kanbanTodoWorkerId);
        this.addKanbanTodoLog(`${this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId)}が依頼「${todo.title || '無題'}」を拒否`);
        store.save();
        this.closeKanbanTodoModal();
        this.renderKanbanLocalTodos();
    }

    insertKanbanTextAtCursor(text) {
        const textarea = document.getElementById('kt-task-desc');
        if (!textarea) return;
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
    }

    insertKanbanDetailCheckmark() {
        this.insertKanbanTextAtCursor('✅ ');
    }

    insertKanbanDetailTimestamp() {
        const now = new Date();
        this.insertKanbanTextAtCursor(`【${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}】`);
    }

    insertKanbanDetailSeparator() {
        this.insertKanbanTextAtCursor('\n------------------------------\n');
    }

    insertKanbanDetailTemplate() {
        this.insertKanbanTextAtCursor('\n【状況】\n【確認】\n【対応】\n【結果】\n');
    }

    openKanbanWorkerPanel() {
        const d = this.ensureKanbanTodoState();
        this.openKanbanPanel('作業員管理', `
            <div class="kt-worker-panel">
                <div class="kt-worker-sync-note">
                    ToDoの作業員は連絡帳の「基幹社員」と同期しています。追加・名前変更・削除は連絡帳の人名管理から行ってください。
                    <button type="button" class="secondary-btn" onclick="app.closeKanbanTodoModal(); app.openShiftMemberTypeManageModal()">人名管理を開く</button>
                </div>
                ${d.localTodoWorkers.map(w => `
                    <div class="kt-worker-row">
                        <span>${this.escapeHtml(w.name)}</span>
                        <small>基幹社員</small>
                    </div>
                `).join('')}
            </div>
        `);
    }

    addKanbanTodoWorker() {
        alert('ToDoの作業員は連絡帳の基幹社員と同期しています。連絡帳の人名管理で追加してください。');
    }

    deleteKanbanTodoWorker(id) {
        alert('ToDoの作業員は連絡帳の基幹社員と同期しています。連絡帳の人名管理で削除またはサポート社員へ変更してください。');
    }

    openKanbanLogPanel() {
        const d = this.ensureKanbanTodoState();
        this.openKanbanPanel('ログ履歴', `
            <div class="kt-log-history">
                ${d.localTodoLogs.map(log => `<div><b>${this.escapeHtml(this.formatKanbanTodoTime(log.time))}</b><span>${this.escapeHtml(log.text || '')}</span></div>`).join('') || '<p class="kt-muted">ログはありません</p>'}
            </div>
        `);
    }

    toggleKanbanTodoHistory(open = true) {
        if (!open) return this.closeKanbanTodoModal();
        const d = this.ensureKanbanTodoState();
        const filters = this._kanbanHistoryFilters || {};
        this.openKanbanPanel('過去履歴', `
            <div class="kt-history-filters">
                <input type="text" id="kt-history-search" value="${this.escapeHtml(filters.query || '')}" placeholder="タイトル・詳細・担当者で検索..." oninput="app.renderKanbanTodoHistoryList()">
                <select id="kt-history-source-filter" onchange="app.renderKanbanTodoHistoryList()">
                    <option value="all" ${(!filters.source || filters.source === 'all') ? 'selected' : ''}>すべて</option>
                    <option value="shift" ${filters.source === 'shift' ? 'selected' : ''}>連絡帳由来</option>
                    <option value="fiveS" ${filters.source === 'fiveS' ? 'selected' : ''}>5S由来</option>
                    <option value="request" ${filters.source === 'request' ? 'selected' : ''}>依頼のみ</option>
                </select>
                <select id="kt-history-priority-filter" onchange="app.renderKanbanTodoHistoryList()">
                    <option value="all" ${(!filters.priority || filters.priority === 'all') ? 'selected' : ''}>優先度すべて</option>
                    <option value="high" ${filters.priority === 'high' ? 'selected' : ''}>高のみ</option>
                    <option value="medium" ${filters.priority === 'medium' ? 'selected' : ''}>中のみ</option>
                    <option value="low" ${filters.priority === 'low' ? 'selected' : ''}>低のみ</option>
                </select>
                <input type="date" id="kt-history-date-from" value="${this.escapeHtml(filters.dateFrom || '')}" onchange="app.renderKanbanTodoHistoryList()" title="履歴移動日 開始">
                <input type="date" id="kt-history-date-to" value="${this.escapeHtml(filters.dateTo || '')}" onchange="app.renderKanbanTodoHistoryList()" title="履歴移動日 終了">
                <button type="button" class="secondary-btn kt-history-reset-btn" onclick="app.resetKanbanTodoHistoryFilters()">リセット</button>
            </div>
            <div id="kt-history-count" class="kt-history-count"></div>
            <div class="kt-history-list">
                <div id="kt-history-results"></div>
            </div>
        `, 'kt-history-list-panel');
        this.renderKanbanTodoHistoryList();
    }

    getKanbanTodoHistoryFiltersFromDom() {
        const saved = this._kanbanHistoryFilters || {};
        return {
            query: document.getElementById('kt-history-search')?.value ?? saved.query ?? '',
            source: document.getElementById('kt-history-source-filter')?.value ?? saved.source ?? 'all',
            priority: document.getElementById('kt-history-priority-filter')?.value ?? saved.priority ?? 'all',
            dateFrom: document.getElementById('kt-history-date-from')?.value ?? saved.dateFrom ?? '',
            dateTo: document.getElementById('kt-history-date-to')?.value ?? saved.dateTo ?? ''
        };
    }

    resetKanbanTodoHistoryFilters() {
        this._kanbanHistoryFilters = { query: '', source: 'all', priority: 'all', dateFrom: '', dateTo: '' };
        ['kt-history-search', 'kt-history-date-from', 'kt-history-date-to'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const source = document.getElementById('kt-history-source-filter');
        const priority = document.getElementById('kt-history-priority-filter');
        if (source) source.value = 'all';
        if (priority) priority.value = 'all';
        this.renderKanbanTodoHistoryList();
    }

    getFilteredKanbanTodoHistory(filters = this._kanbanHistoryFilters || {}) {
        const d = this.ensureKanbanTodoState();
        const query = MaintenanceStore.toHalfWidthLower(filters.query || '');
        const sourceFilter = filters.source || 'all';
        const priorityFilter = filters.priority || 'all';
        const dateFrom = filters.dateFrom || '';
        const dateTo = filters.dateTo || '';
        return d.localTodos
            .filter(todo => todo.archived)
            .filter(todo => {
                const source = todo.shiftRequestSource || {};
                const isShift = !!(source.dateStr && source.shift);
                const isFiveS = this.isKanbanTodoFiveSRequest?.(todo);
                if (sourceFilter === 'shift' && !isShift) return false;
                if (sourceFilter === 'fiveS' && !isFiveS) return false;
                if (sourceFilter === 'request' && !todo.isRequest) return false;
                const priority = todo.priority === 'normal' ? 'medium' : (todo.priority || 'medium');
                if (priorityFilter !== 'all' && priority !== priorityFilter) return false;
                const archivedDate = String(todo.archivedAt || '').slice(0, 10);
                if (dateFrom && (!archivedDate || archivedDate < dateFrom)) return false;
                if (dateTo && (!archivedDate || archivedDate > dateTo)) return false;
                if (!query) return true;
                const haystack = MaintenanceStore.toHalfWidthLower([
                    todo.title || '',
                    todo.description || '',
                    todo.completionComment || '',
                    this.getKanbanTodoRequestTargetLabel(todo),
                    todo.deadlineDate || ''
                ].join(' '));
                return haystack.includes(query);
            })
            .sort((a, b) => String(b.archivedAt || b.updatedAt || '').localeCompare(String(a.archivedAt || a.updatedAt || '')));
    }

    renderKanbanTodoHistoryList() {
        const target = document.getElementById('kt-history-results');
        if (!target) return;
        this._kanbanHistoryFilters = this.getKanbanTodoHistoryFiltersFromDom();
        const total = this.ensureKanbanTodoState().localTodos.filter(todo => todo.archived).length;
        const archived = this.getFilteredKanbanTodoHistory(this._kanbanHistoryFilters);
        this._kanbanHistoryResultIds = archived.map(todo => todo.id);
        const countEl = document.getElementById('kt-history-count');
        if (countEl) countEl.textContent = `${total}件中 ${archived.length}件表示`;
        target.innerHTML = archived.map(todo => {
            const source = todo.shiftRequestSource || {};
            const priorityLabels = { low: '低', medium: '中', normal: '中', high: '高' };
            const priorityKey = todo.priority === 'normal' ? 'medium' : (todo.priority || 'medium');
            const priorityBadge = `<span class="kt-history-priority priority-${this.escapeHtml(priorityKey)}">優先度 ${this.escapeHtml(priorityLabels[todo.priority] || priorityLabels[priorityKey] || '中')}</span>`;
            const sourceBadge = this.isKanbanTodoFiveSRequest?.(todo)
                ? '<span class="kt-history-source five-s">5S</span>'
                : (source.dateStr && source.shift ? '<span class="kt-history-source shift">連絡帳</span>' : '');
            return `
                <article class="kt-history-card priority-${this.escapeHtml(priorityKey)}" onclick="app.openKanbanTodoHistoryDetail('${this.escapeJs(todo.id)}')">
                    <div class="kt-history-card-main">
                        <b>${sourceBadge}${priorityBadge}${this.escapeHtml(todo.title || '無題')}</b>
                        <span>${this.escapeHtml(todo.deadlineDate || '期限なし')} / ${this.escapeHtml(this.getKanbanTodoRequestTargetLabel(todo))} / 履歴: ${this.escapeHtml(this.formatKanbanTodoTime(todo.archivedAt) || '-')}</span>
                    </div>
                    <button type="button" class="secondary-btn kt-history-restore-btn" title="処理済へ戻す" onclick="event.stopPropagation(); app.restoreKanbanTodo('${this.escapeJs(todo.id)}')">戻す</button>
                    ${todo.completionComment ? `<small>${this.escapeHtml(todo.completionComment)}</small>` : ''}
                </article>
            `;
        }).join('') || '<p class="kt-muted">条件に合う履歴はありません</p>';
    }

    openKanbanTodoHistoryDetail(id) {
        const d = this.ensureKanbanTodoState();
        const todo = d.localTodos.find(item => item.id === id);
        if (!todo) return;
        const priorityLabels = { low: '低', medium: '中', high: '高' };
        const statusLabels = { todo: '未着手', progress: '処理中', done: '完了' };
        const historyIds = Array.isArray(this._kanbanHistoryResultIds) && this._kanbanHistoryResultIds.length
            ? this._kanbanHistoryResultIds
            : this.getFilteredKanbanTodoHistory(this._kanbanHistoryFilters || {}).map(item => item.id);
        const historyIndex = historyIds.indexOf(id);
        const prevHistoryId = historyIndex > 0 ? historyIds[historyIndex - 1] : '';
        const nextHistoryId = historyIndex >= 0 && historyIndex < historyIds.length - 1 ? historyIds[historyIndex + 1] : '';
        const historyPosition = historyIndex >= 0 ? `${historyIndex + 1} / ${historyIds.length}` : '';
        const assignedTo = this.getKanbanTodoRequestTargetLabel(todo);
        const requestedBy = todo.requestedBy ? this.getKanbanTodoWorkerName(todo.requestedBy) : '未設定';
        const source = todo.shiftRequestSource || {};
        const sourceLabel = source.dateStr && source.shift
            ? `${source.dateStr} / ${this.getShiftNotebookLabel(source.shift).name}`
            : 'なし';
        this.openKanbanPanel('履歴詳細', `
            <div class="kt-history-detail">
                <div class="kt-history-detail-title">${this.escapeHtml(todo.title || '無題')}</div>
                <div class="kt-history-detail-nav">
                    <button type="button" class="secondary-btn" ${prevHistoryId ? `onclick="app.openKanbanTodoHistoryDetail('${this.escapeJs(prevHistoryId)}')"` : 'disabled'}>前へ</button>
                    <span>${this.escapeHtml(historyPosition || '履歴詳細')}</span>
                    <button type="button" class="secondary-btn" ${nextHistoryId ? `onclick="app.openKanbanTodoHistoryDetail('${this.escapeJs(nextHistoryId)}')"` : 'disabled'}>次へ</button>
                </div>
                <div class="kt-history-detail-grid">
                    <span>状態</span><b>${this.escapeHtml(statusLabels[todo.status] || todo.status || '未設定')}</b>
                    <span>元の優先度</span><b><span class="kt-history-priority priority-${this.escapeHtml(todo.priority === 'normal' ? 'medium' : (todo.priority || 'medium'))}">優先度 ${this.escapeHtml(priorityLabels[todo.priority] || priorityLabels[todo.priority === 'normal' ? 'medium' : (todo.priority || 'medium')] || '中')}</span></b>
                    <span>期限</span><b>${this.escapeHtml(todo.deadlineDate || '期限なし')}${todo.deadlineTime ? ` ${this.escapeHtml(todo.deadlineTime)}` : ''}</b>
                    <span>依頼先</span><b>${this.escapeHtml(assignedTo)}</b>
                    <span>依頼者</span><b>${this.escapeHtml(requestedBy)}</b>
                    <span>完了日時</span><b>${this.escapeHtml(this.formatKanbanTodoTime(todo.completedAt) || '-')}</b>
                    <span>履歴移動</span><b>${this.escapeHtml(this.formatKanbanTodoTime(todo.archivedAt) || '-')}</b>
                    <span>依頼元</span><b>${this.escapeHtml(sourceLabel)}</b>
                    <span>完了コメント</span><b>${this.escapeHtml(todo.completionComment || '-')}</b>
                </div>
                <div class="kt-history-detail-desc-edit">
                    <div class="kt-history-detail-desc-label">詳細本文</div>
                    <textarea id="kt-history-detail-desc-input">${this.escapeHtml(todo.description || '')}</textarea>
                </div>
                <div class="kt-history-detail-actions">
                    <button type="button" class="secondary-btn" onclick="app.toggleKanbanTodoHistory(true)">一覧へ戻る</button>
                    ${source.dateStr && source.shift ? `<button type="button" class="secondary-btn" onclick="app.openShiftNotebookFromTodoCard('${this.escapeJs(todo.id)}')"><i class="fa-solid fa-calendar-days"></i> 依頼元へ</button>` : ''}
                    <button type="button" class="primary-btn" onclick="app.saveKanbanTodoHistoryDescription('${this.escapeJs(todo.id)}')">本文を保存</button>
                    <label class="kt-history-restore-control">
                        <span>戻し先</span>
                        <select id="kt-history-restore-status">
                            <option value="done" selected>処理済</option>
                            <option value="progress">処理中</option>
                            <option value="todo">未着手</option>
                        </select>
                    </label>
                    <button type="button" class="primary-btn" onclick="app.restoreKanbanTodo('${this.escapeJs(todo.id)}', document.getElementById('kt-history-restore-status')?.value || 'done')">戻す</button>
                </div>
            </div>
        `, 'kt-history-detail-panel');
    }

    saveKanbanTodoHistoryDescription(id) {
        const d = this.ensureKanbanTodoState();
        const todo = d.localTodos.find(item => item.id === id);
        if (!todo) return;
        todo.description = document.getElementById('kt-history-detail-desc-input')?.value || '';
        todo.updatedAt = new Date().toISOString();
        if (!Array.isArray(todo.changeLog)) todo.changeLog = [];
        todo.changeLog.unshift({
            at: todo.updatedAt,
            by: this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId),
            action: '履歴本文更新',
            fields: ['詳細']
        });
        todo.changeLog = todo.changeLog.slice(0, 50);
        this.addKanbanTodoLog(`履歴本文更新: 「${todo.title || '無題'}」`);
        store.save();
        this.showKanbanTodoJumpNotice(todo, '履歴本文を保存');
    }

    restoreKanbanTodo(id, status = 'done') {
        const d = this.ensureKanbanTodoState();
        const todo = d.localTodos.find(item => item.id === id);
        if (!todo) return;
        const nextStatus = ['todo', 'progress', 'done'].includes(status) ? status : 'done';
        const statusLabels = { todo: '未着手', progress: '処理中', done: '処理済' };
        todo.archived = false;
        todo.archivedAt = '';
        todo.status = nextStatus;
        todo.completedAt = nextStatus === 'done' ? new Date().toISOString() : '';
        todo.updatedAt = new Date().toISOString();
        this.addKanbanTodoLog(`履歴から復元（${statusLabels[nextStatus]}）: 「${todo.title || '無題'}」`);
        store.save();
        this.updateTodoRequestCountBadge();
        this.closeKanbanTodoModal();
        this.switchView('todos');
        this.kanbanTodoWorkerId = '__all__';
        this.kanbanTodoPriorityFilter = 'all';
        this.kanbanOverdueOnly = false;
        localStorage.setItem('kanbanTodoWorkerId', this.kanbanTodoWorkerId);
        localStorage.setItem('kanban_todo_priority_filter', this.kanbanTodoPriorityFilter);
        localStorage.setItem('kanban_overdue_only', 'false');
        this.renderKanbanLocalTodos();
        setTimeout(() => this.highlightKanbanTodoCard(id), 120);
    }

    openKanbanPanel(title, bodyHtml, panelClass = '') {
        document.getElementById('kt-panel-overlay')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="kt-panel-overlay" class="kt-modal-overlay active" onclick="if(event.target === this) app.closeKanbanTodoModal()">
                <div class="kt-modal kt-panel ${this.escapeHtml(panelClass)}">
                    <div class="kt-modal-header">
                        <h2>${this.escapeHtml(title)}</h2>
                        <button type="button" onclick="app.closeKanbanTodoModal()"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    ${bodyHtml}
                </div>
            </div>
        `);
    }

    ensureLocalTodos() {
        if (!store.activeData.localTodos) store.activeData.localTodos = [];
        return store.activeData.localTodos;
    }

    setTodoFilter(filter) {
        this.todoFilter = filter || 'active';
        this.renderLocalTodos();
    }

    addLocalTodo() {
        const titleInput = document.getElementById('todo-title-input');
        const dateInput = document.getElementById('todo-date-input');
        const priorityInput = document.getElementById('todo-priority-input');
        const title = (titleInput?.value || '').trim();
        if (!title) {
            titleInput?.focus();
            return;
        }
        const todos = this.ensureLocalTodos();
        todos.unshift({
            id: `todo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title,
            dueDate: dateInput?.value || '',
            priority: priorityInput?.value || 'normal',
            done: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        if (titleInput) titleInput.value = '';
        store.save();
        this.renderLocalTodos();
        titleInput?.focus();
    }

    toggleLocalTodo(id) {
        const todo = this.ensureLocalTodos().find(item => item.id === id);
        if (!todo) return;
        todo.done = !todo.done;
        todo.updatedAt = new Date().toISOString();
        store.save();
        this.renderLocalTodos();
    }

    editLocalTodo(id) {
        const todo = this.ensureLocalTodos().find(item => item.id === id);
        if (!todo) return;
        const title = prompt('ToDoの内容を変更', todo.title || '');
        if (title === null) return;
        const trimmed = title.trim();
        if (!trimmed) return;
        todo.title = trimmed;
        todo.updatedAt = new Date().toISOString();
        store.save();
        this.renderLocalTodos();
    }

    deleteLocalTodo(id) {
        const todos = this.ensureLocalTodos();
        const todo = todos.find(item => item.id === id);
        if (!todo) return;
        store.activeData.localTodos = todos.filter(item => item.id !== id);
        store.save();
        this.renderLocalTodos();
        this.showUndoNotice(`ToDo「${todo.title || '無題'}」を削除しました`, () => {
            store.activeData.localTodos.push(todo);
            store.save();
            this.renderLocalTodos();
        }, null, document.body, 'todo-undo');
    }

    updateLocalTodoField(id, field, value) {
        const todo = this.ensureLocalTodos().find(item => item.id === id);
        if (!todo || !['dueDate', 'priority'].includes(field)) return;
        todo[field] = value || '';
        todo.updatedAt = new Date().toISOString();
        store.save();
        this.renderLocalTodos();
    }

    renderLocalTodos() {
        const list = document.getElementById('todo-list');
        if (!list) return;
        const filter = this.todoFilter || 'active';
        this.todoFilter = filter;
        ['active', 'all', 'done'].forEach(key => {
            document.getElementById(`todo-filter-${key}`)?.classList.toggle('active', filter === key);
        });
        const query = MaintenanceStore.toHalfWidthLower(document.getElementById('todo-search-input')?.value || '');
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const priorityLabels = { high: '高', normal: '通常', low: '低' };
        const todos = this.ensureLocalTodos()
            .filter(todo => filter === 'all' || (filter === 'done' ? todo.done : !todo.done))
            .filter(todo => !query || MaintenanceStore.toHalfWidthLower(`${todo.title || ''} ${todo.dueDate || ''} ${priorityLabels[todo.priority] || ''}`).includes(query))
            .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99') || (b.createdAt || '').localeCompare(a.createdAt || ''));

        if (todos.length === 0) {
            list.innerHTML = `
                <div class="todo-empty">
                    <i class="fa-solid fa-list-check"></i>
                    <div>${query ? '該当するToDoはありません' : 'ToDoはありません'}</div>
                </div>
            `;
            return;
        }

        list.innerHTML = todos.map(todo => {
            const overdue = !!todo.dueDate && todo.dueDate < todayStr && !todo.done;
            return `
                <article class="todo-item ${todo.done ? 'done' : ''} ${overdue ? 'overdue' : ''}">
                    <button type="button" class="todo-check" onclick="app.toggleLocalTodo('${this.escapeJs(todo.id)}')" title="${todo.done ? '未完了に戻す' : '完了にする'}">
                        <i class="fa-solid ${todo.done ? 'fa-check' : 'fa-circle'}"></i>
                    </button>
                    <div class="todo-main">
                        <div class="todo-title">${this.escapeHtml(todo.title || '')}</div>
                        <div class="todo-meta">
                            <span class="todo-priority ${todo.priority || 'normal'}">${priorityLabels[todo.priority] || '通常'}</span>
                            <label>期限 <input type="date" value="${this.escapeHtml(todo.dueDate || '')}" onchange="app.updateLocalTodoField('${this.escapeJs(todo.id)}', 'dueDate', this.value)"></label>
                            ${overdue ? '<span class="todo-overdue">期限超過</span>' : ''}
                        </div>
                    </div>
                    <select class="todo-priority-select" onchange="app.updateLocalTodoField('${this.escapeJs(todo.id)}', 'priority', this.value)">
                        <option value="high" ${todo.priority === 'high' ? 'selected' : ''}>高</option>
                        <option value="normal" ${!todo.priority || todo.priority === 'normal' ? 'selected' : ''}>通常</option>
                        <option value="low" ${todo.priority === 'low' ? 'selected' : ''}>低</option>
                    </select>
                    <button type="button" class="icon-btn" onclick="app.editLocalTodo('${this.escapeJs(todo.id)}')" title="編集"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="icon-btn todo-delete" onclick="app.deleteLocalTodo('${this.escapeJs(todo.id)}')" title="削除"><i class="fa-solid fa-trash-can"></i></button>
                </article>
            `;
        }).join('');
    }

    // --- Calendar Implementation ---
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppTodoMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppTodoMethods.prototype[name];
        }
    }
})();
