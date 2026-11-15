(function () {
    if (typeof MaintenanceApp === 'undefined') return;
    class MaintenanceFiveSMethods extends MaintenanceApp {
    collectFiveSNotebookRows(period = 'all', photosOnly = false) {
        const range = this.getNotebookSearchDateRange(period);
        const notebooks = store.activeData.shiftNotebooks || {};
        const results = [];
        Object.keys(notebooks).sort().forEach(dateStr => {
            if (range.start && (dateStr < range.start || dateStr > range.end)) return;
            const dayData = notebooks[dateStr] || {};
            const addRows = (rows = [], shift, shiftLabel, members = [], shared = false) => {
                rows.forEach((row, index) => {
                    if (!row?.fiveS) return;
                    const photos = Array.isArray(row.photos) ? row.photos.map(photo => this.normalizeShiftNotebookPhoto(photo)).filter(photo => photo.src) : [];
                    if (photosOnly && photos.length === 0) return;
                    const html = row.html || this.shiftNoteTextToHtml(row.text || '');
                    const text = row.text || this.stripShiftNoteHtml(html).trim();
                    results.push({
                        dateStr,
                        shift,
                        shiftLabel,
                        members,
                        group: row.group || '未設定',
                        tag: row.tag || '通常',
                        text,
                        html,
                        photos,
                        fiveSAssigneeId: row.fiveSAssigneeId || '',
                        index,
                        sourceIndex: index,
                        rowId: row.id || '',
                        shared
                    });
                });
            };

            const sharedRows = Array.isArray(dayData.sharedRows) ? dayData.sharedRows : [];
            if (sharedRows.length) addRows(sharedRows, 'early', { stamp: '共', name: '共通' }, [], true);
            ['early', 'late', 'night'].forEach(shift => {
                const data = this.getShiftNotebookRowsAndMembers(dayData[shift]);
                addRows(data.rows, shift, this.getShiftNotebookLabel(shift), data.members, false);
            });
        });
        return results.sort((a, b) => b.dateStr.localeCompare(a.dateStr) || a.shift.localeCompare(b.shift) || a.index - b.index);
    }

    getFiveSRowRelatedTodos(row = {}) {
        const rowId = row.rowId || '';
        if (!rowId) return [];
        return (store.activeData.localTodos || []).filter(todo => {
            const source = todo.shiftRequestSource || {};
            return source.rowId === rowId
                && source.dateStr === row.dateStr
                && source.shift === row.shift
                && !todo.archived;
        });
    }

    getFiveSRowTodoStatus(row = {}) {
        const todos = this.getFiveSRowRelatedTodos(row);
        if (!todos.length) {
            return { key: 'none', label: '未依頼', count: 0, openCount: 0, doneCount: 0 };
        }
        const openTodos = todos.filter(todo => (todo.status || 'todo') !== 'done');
        const doneCount = todos.length - openTodos.length;
        if (!openTodos.length) {
            return { key: 'done', label: '完了', count: todos.length, openCount: 0, doneCount };
        }
        const hasProgress = openTodos.some(todo => (todo.status || 'todo') === 'progress');
        return {
            key: hasProgress ? 'progress' : 'requested',
            label: hasProgress ? '対応中' : '依頼中',
            count: todos.length,
            openCount: openTodos.length,
            doneCount
        };
    }

    renderFiveSAssigneeSelect(row = {}) {
        const workers = this.getShiftCoreWorkerOptions();
        const selected = row.fiveSAssigneeId || '';
        if (!workers.length) {
            return '<span class="five-s-assignee-empty"><i class="fa-solid fa-user"></i> 担当者未登録</span>';
        }
        const selectedName = selected ? this.getKanbanTodoWorkerName(selected) : '';
        return `
            <label class="five-s-assignee-select ${selected ? 'compact' : ''}" title="${selected ? `5S担当: ${this.escapeHtml(selectedName)}` : '5S担当を選択'}">
                <i class="fa-solid fa-user-check"></i>
                ${selected ? '' : '<span>担当</span>'}
                <select onchange="app.updateFiveSRowAssignee('${this.escapeJs(row.dateStr || '')}', '${this.escapeJs(row.shift || '')}', '${this.escapeJs(row.rowId || '')}', ${row.sourceIndex}, ${row.shared}, this.value)">
                    <option value="" ${selected ? '' : 'selected'}>未設定</option>
                    ${workers.map(worker => `<option value="${this.escapeHtml(worker.id)}" ${selected === worker.id ? 'selected' : ''}>${this.escapeHtml(worker.name)}</option>`).join('')}
                </select>
            </label>
        `;
    }

    updateFiveSRowAssignee(dateStr, shift, rowId = '', sourceIndex = -1, shared = false, workerId = '') {
        const source = this.resolveFiveSNotebookRowSource(dateStr, shift, rowId, sourceIndex, shared);
        if (!source) {
            alert('5S履歴の元行が見つかりませんでした。');
            return;
        }
        const validIds = new Set(this.getShiftCoreWorkerOptions().map(worker => worker.id));
        source.row.fiveSAssigneeId = validIds.has(workerId) ? workerId : '';
        store.save();
        if (document.getElementById('fiveS-list')) this.renderFiveSManagement();
    }

    getCurrentFiveSManagementRows() {
        const period = document.getElementById('fiveS-filter-period')?.value || 'all';
        const photosOnly = !!document.getElementById('fiveS-filter-photos')?.checked;
        const pendingOnly = !!document.getElementById('fiveS-filter-pending')?.checked;
        const filters = this.getFiveSManagementFilters();
        const rows = this.collectFiveSNotebookRows(period, photosOnly)
            .map(row => ({ ...row, todoStatus: this.getFiveSRowTodoStatus(row) }))
            .filter(row => this.matchesFiveSManagementFilters(row, filters));
        return pendingOnly ? rows.filter(row => row.todoStatus.openCount > 0) : rows;
    }

    renderFiveSBulkAssigneeControl(rows = []) {
        const workers = this.getShiftCoreWorkerOptions();
        const unsetCount = rows.filter(row => !row.fiveSAssigneeId).length;
        const disabled = !workers.length || !rows.length;
        return `
            <div class="five-s-bulk-assignee">
                <b><span>${unsetCount}</span>件の担当未設定</b>
                <select id="fiveS-bulk-assignee-select" ${disabled ? 'disabled' : ''}>
                    <option value="">表示中の担当を選択</option>
                    ${workers.map(worker => `<option value="${this.escapeHtml(worker.id)}">${this.escapeHtml(worker.name)}</option>`).join('')}
                </select>
                <button type="button" class="secondary-btn" onclick="app.bulkUpdateVisibleFiveSAssignee()" ${disabled ? 'disabled' : ''}>
                    一括変更
                </button>
            </div>
        `;
    }

    bulkUpdateVisibleFiveSAssignee() {
        const workerId = document.getElementById('fiveS-bulk-assignee-select')?.value || '';
        const validIds = new Set(this.getShiftCoreWorkerOptions().map(worker => worker.id));
        if (!validIds.has(workerId)) {
            alert('担当者を選んでください。');
            return;
        }
        const rows = this.getCurrentFiveSManagementRows();
        let count = 0;
        rows.forEach(row => {
            const source = this.resolveFiveSNotebookRowSource(row.dateStr, row.shift, row.rowId, row.sourceIndex, row.shared);
            if (!source) return;
            source.row.fiveSAssigneeId = workerId;
            count += 1;
        });
        if (!count) {
            alert('変更できる5S履歴がありません。');
            return;
        }
        store.save();
        this.renderFiveSManagement();
        this.showFiveSAssigneeSavedNotice(`${count}件の5S担当を変更しました`);
    }

    resolveFiveSNotebookRowSource(dateStr, shift, rowId = '', sourceIndex = -1, shared = false) {
        const dayData = store.activeData.shiftNotebooks?.[dateStr];
        if (!dayData) return null;
        const rows = shared
            ? (Array.isArray(dayData.sharedRows) ? dayData.sharedRows : [])
            : this.getShiftNotebookRowsAndMembers(dayData[shift]).rows;
        const indexNumber = Number(sourceIndex);
        const row = rowId
            ? rows.find(item => item?.id === rowId)
            : (Number.isFinite(indexNumber) ? rows[indexNumber] : null);
        if (!row) return null;
        if (!row.id) {
            row.id = `sr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            store.save();
        }
        return { dayData, rows, row, rowId: row.id };
    }

    openFiveSTodoRequest(dateStr, shift, rowId = '', sourceIndex = -1, shared = false) {
        const source = this.resolveFiveSNotebookRowSource(dateStr, shift, rowId, sourceIndex, shared);
        if (!source) {
            alert('5S履歴の元行が見つかりませんでした。');
            return;
        }
        const row = source.row;
        const rowText = row.text || this.stripShiftNoteHtml(row.html || '').trim();
        const groupName = row.group || '未設定';
        const selectedWorkerIds = new Set(row.fiveSAssigneeId ? [row.fiveSAssigneeId] : []);
        const shiftLabel = shared ? { stamp: '共', name: '共通' } : this.getShiftNotebookLabel(shift);
        const title = this.buildFiveSTodoTitle(row, rowText, groupName);
        const description = [
            `日付: ${dateStr} / シフト: ${shiftLabel.name} / グループ: ${groupName}`,
            '',
            rowText || '内容なし'
        ].join('\n');
        const workers = this.getShiftCoreWorkerOptions();
        const groups = this.getShiftCoreGroupOptions();
        const defaultGroupIndex = Math.max(0, groups.findIndex(group => group.name === groupName));
        if (workers.length === 0) {
            alert('基幹社員が登録されていません。連絡帳の人名管理で基幹社員を登録してください。');
            return;
        }
        document.getElementById('shift-row-request-overlay')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="shift-row-request-overlay" class="shift-row-request-overlay" onclick="if(event.target === this) app.closeShiftRowTodoRequest()">
                <div class="shift-row-request-card">
                    <div class="shift-row-request-header">
                        <h3>5S履歴からToDo作成</h3>
                        <button type="button" onclick="app.closeShiftRowTodoRequest()"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <input type="hidden" id="shift-request-row-id" value="${this.escapeHtml(source.rowId)}">
                    <input type="hidden" id="shift-request-existing-todo-id" value="">
                    <input type="hidden" id="shift-request-date" value="${this.escapeHtml(dateStr || '')}">
                    <input type="hidden" id="shift-request-shift" value="${this.escapeHtml(shift || '')}">
                    <label class="shift-request-field">タイトル
                        <input type="text" id="shift-request-title" value="${this.escapeHtml(title)}">
                    </label>
                    <label class="shift-request-field">内容
                        <textarea id="shift-request-desc" rows="5">${this.escapeHtml(description)}</textarea>
                    </label>
                    <label class="shift-request-field">依頼者（任意）
                        <select id="shift-request-requester">
                            <option value="" selected>現在のToDo作業員（${this.escapeHtml(this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId))}）</option>
                            ${workers.map(worker => `<option value="${this.escapeHtml(worker.id)}">${this.escapeHtml(worker.name)}</option>`).join('')}
                        </select>
                    </label>
                    <label class="shift-request-field">優先度（任意）
                        <select id="shift-request-priority">
                            <option value="low" selected>低</option>
                            <option value="medium">中</option>
                            <option value="high">高</option>
                        </select>
                    </label>
                    <div class="shift-request-group-box">
                        <div class="shift-request-box-title">班を選択</div>
                        ${groups.length ? groups.map((group, index) => `
                            <label class="shift-request-check">
                                <input type="checkbox" class="shift-request-group" value="${index}" ${!selectedWorkerIds.size && index === defaultGroupIndex ? 'checked' : ''}>
                                <span>${this.escapeHtml(group.name)}</span>
                                <small>${group.memberIds.map(id => this.getKanbanTodoWorkerName(id)).join(', ')}</small>
                            </label>
                        `).join('') : '<div class="shift-request-empty">基幹社員を含む班がありません</div>'}
                    </div>
                    <div class="shift-request-member-box">
                        <div class="shift-request-box-title">個別に選択</div>
                        ${workers.map(worker => `
                            <label class="shift-request-check">
                                <input type="checkbox" class="shift-request-member" value="${this.escapeHtml(worker.id)}" ${selectedWorkerIds.has(worker.id) ? 'checked' : ''}>
                                <span>${this.escapeHtml(worker.name)}</span>
                            </label>
                        `).join('')}
                    </div>
                    <div class="shift-row-request-actions">
                        <button type="button" class="secondary-btn" onclick="app.closeShiftRowTodoRequest()">閉じる</button>
                        <button type="button" class="primary-btn" onclick="app.createShiftRowTodoRequest()">依頼する</button>
                    </div>
                </div>
            </div>
        `);
        document.getElementById('shift-request-title')?.focus();
        document.getElementById('shift-row-request-overlay')._groups = groups;
    }

    renderFiveSStatusLabels(row = {}, relatedTodos = []) {
        const labels = [];
        const pairCount = this.getFiveSPhotoComparePairs(row.photos || []).length;
        if (!row.fiveSAssigneeId) {
            labels.push({ key: 'warn', icon: 'fa-user-slash', text: '担当未設定' });
        }
        if (!relatedTodos.length) {
            labels.push({ key: 'muted', icon: 'fa-list-check', text: 'ToDo未作成' });
        } else if ((row.todoStatus?.openCount || 0) > 0) {
            labels.push({ key: 'danger', icon: 'fa-circle-exclamation', text: `未完了あり ${row.todoStatus.openCount}` });
        }
        if (!(row.photos || []).length) {
            labels.push({ key: 'muted', icon: 'fa-image', text: '写真なし' });
        } else if (!pairCount) {
            labels.push({ key: 'warn', icon: 'fa-code-compare', text: '前後ペアなし' });
        }
        if (!labels.length) return '';
        return `
            <div class="five-s-status-labels" aria-label="5S状態ラベル">
                ${labels.map(label => `
                    <span class="five-s-status-label ${this.escapeHtml(label.key)}">
                        <i class="fa-solid ${this.escapeHtml(label.icon)}"></i>
                        ${this.escapeHtml(label.text)}
                    </span>
                `).join('')}
            </div>
        `;
    }

    renderFiveSCompactText(row = {}) {
        const sourceHtml = row.html ? this.sanitizeShiftNoteHtml(row.html) : this.escapeHtml(row.text || '本文なし');
        const holder = document.createElement('div');
        holder.innerHTML = sourceHtml;
        const request = holder.querySelector('.shift-todo-feedback.request')?.textContent?.trim() || '';
        const progress = holder.querySelector('.shift-todo-feedback.progress')?.textContent?.trim() || '';
        const done = holder.querySelector('.shift-todo-feedback.done')?.textContent?.trim() || '';
        const deleted = holder.querySelector('.shift-todo-feedback.deleted')?.textContent?.trim() || '';
        holder.querySelectorAll('.shift-todo-feedback, .shift-todo-arrow, .shift-todo-five-s-link').forEach(el => el.remove());
        let text = this.stripShiftNoteHtml(holder.innerHTML).replace(/\s+/g, ' ').trim() || (row.text || '').trim() || '本文なし';
        if (text.length > 90) text = `${text.slice(0, 90)}...`;
        const todoSteps = [
            request ? '依頼' : '',
            progress ? '対応中' : '',
            done ? '完了' : '',
            deleted ? '削除' : ''
        ].filter(Boolean);
        const todoHtml = todoSteps.length ? `<span class="five-s-compact-todo">ToDo: ${this.escapeHtml(todoSteps.join('→'))}</span>` : '';
        return `${this.escapeHtml(text)}${todoHtml}`;
    }

    renderFiveSConditionBar({ range, filters, photosOnly, pendingOnly, rows, allRows }) {
        const shiftLabels = {
            all: '全シフト',
            shared: '共通',
            day: '昼勤',
            night: '夜勤'
        };
        const chips = [
            range?.label || '全期間',
            shiftLabels[filters.shift] || filters.shift || '全シフト',
            filters.assignee === '__unset__'
                ? '5S担当未設定'
                : (filters.assignee && filters.assignee !== 'all' ? `5S担当: ${this.getKanbanTodoWorkerName(filters.assignee)}` : '5S担当すべて')
        ];
        if (filters.group) chips.push(`グループ: ${filters.group}`);
        if (filters.query) chips.push(`検索: ${filters.query}`);
        if (photosOnly) chips.push('写真あり');
        if (pendingOnly) chips.push('未完了ToDoのみ');
        const photoCount = rows.reduce((sum, row) => sum + row.photos.length, 0);
        const pendingCount = allRows.filter(row => row.todoStatus.openCount > 0).length;
        return `
            <div class="five-s-condition-bar">
                <div class="five-s-condition-main">
                    <div class="five-s-condition-period">
                        <i class="fa-regular fa-calendar"></i>
                        <span>表示条件</span>
                        <b>${this.escapeHtml(range?.label || '全期間')}</b>
                    </div>
                    <div class="five-s-condition-chips">
                        ${chips.map(chip => `<span>${this.escapeHtml(chip)}</span>`).join('')}
                    </div>
                </div>
                <div class="five-s-condition-summary">
                    <b>${rows.length.toLocaleString()}</b><span>件</span>
                    <b>${photoCount.toLocaleString()}</b><span>枚</span>
                    <b>${pendingCount.toLocaleString()}</b><span>未完了</span>
                    <button type="button" class="secondary-btn" onclick="app.clearFiveSManagementFilters()">
                        <i class="fa-solid fa-filter-circle-xmark"></i> 条件リセット
                    </button>
                </div>
            </div>
        `;
    }

    clearFiveSManagementFilters() {
        const period = document.getElementById('fiveS-filter-period');
        const photos = document.getElementById('fiveS-filter-photos');
        const pending = document.getElementById('fiveS-filter-pending');
        const shift = document.getElementById('fiveS-filter-shift');
        const assignee = document.getElementById('fiveS-filter-assignee');
        const group = document.getElementById('fiveS-filter-group');
        const query = document.getElementById('fiveS-filter-query');
        if (period) period.value = 'all';
        if (photos) photos.checked = false;
        if (pending) pending.checked = false;
        if (shift) shift.value = 'all';
        if (assignee) assignee.value = 'all';
        if (group) group.value = '';
        if (query) query.value = '';
        this.renderFiveSManagement();
    }

    renderFiveSManagement() {
        const period = document.getElementById('fiveS-filter-period')?.value || 'all';
        const photosOnly = !!document.getElementById('fiveS-filter-photos')?.checked;
        const pendingOnly = !!document.getElementById('fiveS-filter-pending')?.checked;
        const range = this.getNotebookSearchDateRange(period);
        const baseRows = this.collectFiveSNotebookRows(period, photosOnly);
        this.updateFiveSAssigneeFilterOptions(baseRows);
        const filters = this.getFiveSManagementFilters();
        const allRows = baseRows
            .map(row => ({ ...row, todoStatus: this.getFiveSRowTodoStatus(row) }))
            .filter(row => this.matchesFiveSManagementFilters(row, filters));
        const rows = pendingOnly ? allRows.filter(row => row.todoStatus.openCount > 0) : allRows;
        const summary = document.getElementById('fiveS-summary');
        const list = document.getElementById('fiveS-list');
        this.renderFiveSJumpOriginNotice();
        if (summary) {
            const photoCount = rows.reduce((sum, row) => sum + row.photos.length, 0);
            const pendingCount = allRows.filter(row => row.todoStatus.openCount > 0).length;
            const doneCount = allRows.filter(row => row.todoStatus.key === 'done').length;
            summary.innerHTML = `
                ${this.renderFiveSConditionBar({ range, filters, photosOnly, pendingOnly, rows, allRows })}
                <div><b>${this.escapeHtml(range.label)}</b></div>
                <div><span>${rows.length}</span>件の5S履歴</div>
                <div><span>${photoCount}</span>枚の写真</div>
                <div><span>${pendingCount}</span>件の未完了ToDo</div>
                <div><span>${doneCount}</span>件の完了</div>
                ${this.renderFiveSBulkAssigneeControl(rows)}
            `;
        }
        this.renderFiveSMonthlyReport();
        if (!list) return;
        if (!rows.length) {
            list.innerHTML = '<div class="five-s-empty">該当する5S履歴はありません。</div>';
            return;
        }
        const renderFiveSCard = (row, options = {}) => {
            const relatedTodos = this.getFiveSRowRelatedTodos(row);
            const todoJumpTarget = relatedTodos.find(todo => (todo.status || 'todo') !== 'done') || relatedTodos[0] || null;
            const todoAssigneeLabel = todoJumpTarget ? this.getKanbanTodoAssigneeLabel(todoJumpTarget, 3) : '';
            const todoJumpLabel = todoJumpTarget ? this.getKanbanTodoJumpLabel(todoJumpTarget, relatedTodos.length) : '';
            const relatedTodoIds = relatedTodos.map(todo => todo.id).filter(Boolean).join(' ');
            const todoOptionsHtml = relatedTodos.length > 1 ? `
                <div class="five-s-todo-options">
                    ${relatedTodos.map(todo => `
                        <button type="button" onclick="app.openKanbanTodoFromSearch('${this.escapeJs(todo.id)}', false)">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            <span>${this.escapeHtml(this.getKanbanTodoJumpLabel(todo))}</span>
                        </button>
                    `).join('')}
                </div>
            ` : '';
            const compareHtml = this.renderFiveSPhotoCompare(row);
            const photoDataAttrs = `data-five-s-photo-date="${this.escapeHtml(row.dateStr || '')}" data-five-s-photo-shift="${this.escapeHtml(row.shift || '')}" data-five-s-photo-row-id="${this.escapeHtml(row.rowId || '')}" data-five-s-photo-source-index="${this.escapeHtml(row.sourceIndex)}" data-five-s-photo-shared="${row.shared ? 'true' : 'false'}"`;
            const photosHtml = row.photos.length && !compareHtml ? `
                <div class="five-s-photos">
                    <div class="five-s-photo-section-title"><i class="fa-solid fa-images"></i> 写真編集</div>
                    ${row.photos.map(photo => `
                        <figure class="five-s-photo-open" ${photoDataAttrs} title="写真編集を開く">
                            <span class="five-s-photo-edit-badge"><i class="fa-solid fa-pen"></i> 編集</span>
                            <img src="${photo.src}" alt="${this.escapeHtml(photo.caption || '5S写真')}">
                            ${photo.marks?.length ? `<span class="five-s-photo-mark-badge"><i class="fa-solid fa-pen"></i> 注記あり</span>` : ''}
                            ${photo.caption ? `<figcaption>${this.escapeHtml(photo.caption)}</figcaption>` : ''}
                        </figure>
                    `).join('')}
                </div>
            ` : '';
            const statusTitle = row.todoStatus.count
                ? `ToDo ${row.todoStatus.count}件 / 未完了 ${row.todoStatus.openCount}件 / 完了 ${row.todoStatus.doneCount}件`
                : 'この5S履歴から作成したToDoはありません';
            const statusLabelsHtml = this.renderFiveSStatusLabels(row, relatedTodos);
            return `
                <article class="five-s-card ${options.pinned ? 'five-s-card-pinned' : ''} ${row.fiveSAssigneeId ? '' : 'five-s-card-assignee-unset'} ${row.todoStatus.key === 'done' ? 'five-s-card-done' : ''}" data-five-s-row-id="${this.escapeHtml(row.rowId || '')}" data-five-s-date="${this.escapeHtml(row.dateStr || '')}" data-five-s-shift="${this.escapeHtml(row.shift || '')}" data-five-s-todo-ids="${this.escapeHtml(relatedTodoIds)}">
                    ${options.pinned ? '<div class="five-s-pinned-label"><i class="fa-solid fa-thumbtack"></i> 移動先の対象</div>' : ''}
                    <div class="five-s-card-main">
                        <div class="five-s-meta">
                            <span class="five-s-stamp">5S</span>
                            ${row.todoStatus.key === 'none' ? '' : `<span class="five-s-todo-status ${this.escapeHtml(row.todoStatus.key)}" title="${this.escapeHtml(statusTitle)}">${this.escapeHtml(row.todoStatus.label)}</span>`}
                            <b>${this.escapeHtml(row.dateStr)}</b>
                            <span class="shift-notebook-badge ${this.escapeHtml(row.shift)}">${this.escapeHtml(row.shiftLabel.stamp)}</span>
                            <span class="shift-row-group-badge">${this.escapeHtml(row.group)}</span>
                            ${row.shared ? '<span class="shift-row-group-badge">貫通</span>' : ''}
                            ${todoJumpTarget ? `<span class="five-s-todo-assignees" title="ToDo担当: ${this.escapeHtml(todoAssigneeLabel)}"><i class="fa-solid fa-user-check"></i> ${this.escapeHtml(todoAssigneeLabel)}</span>` : ''}
                            ${this.renderFiveSAssigneeSelect(row)}
                            ${statusLabelsHtml}
                        </div>
                        <div class="five-s-text">${this.renderFiveSCompactText(row)}</div>
                        ${photosHtml}
                        ${compareHtml}
                    </div>
                    <div class="five-s-card-actions">
                        <button type="button" class="secondary-btn compact-icon-btn" title="ToDo作成" onclick="app.openFiveSTodoRequest('${this.escapeJs(row.dateStr)}', '${this.escapeJs(row.shift)}', '${this.escapeJs(row.rowId)}', ${row.sourceIndex}, ${row.shared})">
                            <i class="fa-solid fa-list-check"></i><span>ToDo</span>
                        </button>
                        ${todoJumpTarget ? `<button type="button" class="secondary-btn five-s-todo-jump-btn" onclick="app.openKanbanTodoFromSearch('${this.escapeJs(todoJumpTarget.id)}', false)">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> ${this.escapeHtml(todoJumpLabel)}
                        </button>` : ''}
                        ${todoOptionsHtml}
                        <button type="button" class="secondary-btn compact-icon-btn" title="連絡帳へ" onclick="app.openShiftNotebookModal('${this.escapeJs(row.dateStr)}', '${this.escapeJs(row.shift)}', ${row.index})">
                            <i class="fa-solid fa-book-open"></i><span>連絡帳</span>
                        </button>
                    </div>
                </article>
            `;
        };
        const targetRow = rows.find(row => this.isFiveSManagementHighlightTarget(row));
        const pinnedHtml = targetRow ? `<div class="five-s-pinned-wrap">${renderFiveSCard(targetRow, { pinned: true })}</div>` : '';
        list.innerHTML = `${pinnedHtml}${rows.map(row => renderFiveSCard(row)).join('')}`;
        this.bindFiveSPhotoOpeners();
        this.highlightFiveSManagementRow();
    }

    bindFiveSPhotoOpeners() {
        document.querySelectorAll('.five-s-photo-open').forEach(el => {
            if (el.dataset.boundFiveSPhotoOpen === 'true') return;
            el.dataset.boundFiveSPhotoOpen = 'true';
            el.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.openFiveSPhotoEditor(
                    el.dataset.fiveSPhotoDate || '',
                    el.dataset.fiveSPhotoShift || '',
                    el.dataset.fiveSPhotoRowId || '',
                    Number(el.dataset.fiveSPhotoSourceIndex || -1),
                    el.dataset.fiveSPhotoShared === 'true'
                );
            });
        });
    }

    isFiveSManagementHighlightTarget(row = {}) {
        const rowId = this._fiveSHighlightRowId || '';
        const source = this._fiveSHighlightSource || {};
        const todoId = this._fiveSHighlightTodoId || '';
        if (rowId && row.rowId === rowId) return true;
        if (todoId && this.getFiveSRowRelatedTodos(row).some(todo => todo.id === todoId)) return true;
        return !!(source.dateStr && source.shift && row.dateStr === source.dateStr && row.shift === source.shift);
    }

    renderFiveSPhotoCompare(row = {}) {
        const photos = row.photos || [];
        const pairs = this.getFiveSPhotoComparePairs(photos);
        if (!pairs.length) return '';
        const photoDataAttrs = `data-five-s-photo-date="${this.escapeHtml(row.dateStr || '')}" data-five-s-photo-shift="${this.escapeHtml(row.shift || '')}" data-five-s-photo-row-id="${this.escapeHtml(row.rowId || '')}" data-five-s-photo-source-index="${this.escapeHtml(row.sourceIndex)}" data-five-s-photo-shared="${row.shared ? 'true' : 'false'}"`;
        return `
            <div class="five-s-photo-compare five-s-photo-open" ${photoDataAttrs} title="写真編集を開く">
                <div class="five-s-photo-compare-grid">
                    ${pairs.map(pair => `
                        ${this.renderFiveSPhotoCompareTile(pair)}
                    `).join('')}
                </div>
            </div>
        `;
    }

    openFiveSPhotoEditor(dateStr, shift, rowId = '', sourceIndex = -1, shared = false) {
        const source = this.resolveFiveSNotebookRowSource(dateStr, shift, rowId, sourceIndex, shared);
        if (!source) {
            alert('連絡帳の写真が見つかりませんでした。');
            return;
        }
        const photos = (source.row.photos || [])
            .map((rawPhoto, index) => {
                const photo = this.normalizeShiftNotebookPhoto(rawPhoto);
                if (!photo.src) return null;
                return {
                    ...photo,
                    index,
                    role: this.inferShiftPhotoCompareRole(photo.caption || ''),
                    setKey: this.getShiftPhotoCompareSetKey(photo.caption || ''),
                    numbers: this.getShiftPhotoCompareNumbers(photo.caption || ''),
                    orderNumber: this.getShiftPhotoCompareNumbers(photo.caption || '')[0] ?? null,
                    pairNumber: this.getShiftPhotoCompareNumbers(photo.caption || '').length >= 2 ? this.getShiftPhotoCompareNumbers(photo.caption || '')[0] : null,
                    pairStep: this.getShiftPhotoCompareNumbers(photo.caption || '').length >= 2 ? this.getShiftPhotoCompareNumbers(photo.caption || '')[1] : null
                };
            })
            .filter(Boolean);
        if (!photos.length) {
            alert('表示する写真がありません。');
            return;
        }
        const shiftLabel = shared ? { name: '共通' } : this.getShiftNotebookLabel(shift);
        const groupName = source.row.group || '未設定';
        this.openShiftPhotoCompareWithPhotos(photos, {
            source: 'fiveS',
            imageEditKey: `fiveS:${dateStr}:${shift}:${rowId || sourceIndex}:${shared}`,
            title: `5S写真編集: ${dateStr} / ${shiftLabel.name} / ${groupName}`,
            row: null,
            globalMarks: source.row.photoCompareMarks || [],
            onSync: (context) => {
                source.row.photos = context.photos.map(photo => ({
                    src: photo.src,
                    caption: photo.caption || '',
                    marks: this.compactShiftPhotoCompareMarkImages(photo.marks)
                }));
                source.row.photoCompareMarks = this.compactShiftPhotoCompareMarkImages(context.globalMarks);
                const saved = store.save();
                if (document.getElementById('fiveS-list')) this.renderFiveSManagement();
                return saved;
            },
            onClose: () => this.showFiveSPhotoSavedNotice()
        });
    }

    renderFiveSPhotoCompareFigure(photo, label) {
        if (!photo?.src) {
            return `<figure class="missing"><div>${this.escapeHtml(label)}なし</div></figure>`;
        }
        return `
            <figure>
                <span>${this.escapeHtml(label)}</span>
                <img src="${this.escapeHtml(photo.src)}" alt="${this.escapeHtml(photo.caption || label)}">
            </figure>
        `;
    }

    renderFiveSPhotoCompareTile(pair) {
        const renderSide = (photo, label) => {
            if (!photo?.src) {
                return `<div class="five-s-photo-compare-side missing"><span>${this.escapeHtml(label)}</span><div>${this.escapeHtml(label)}なし</div></div>`;
            }
            return `
                <div class="five-s-photo-compare-side">
                    <span>${this.escapeHtml(label)}</span>
                    <img src="${this.escapeHtml(photo.src)}" alt="${this.escapeHtml(photo.caption || label)}">
                </div>
            `;
        };
        return `
            <div class="five-s-photo-compare-pair-tile">
                ${renderSide(pair.before, '対応前')}
                ${renderSide(pair.after, '対応後')}
            </div>
        `;
    }

    getFiveSPhotoComparePairs(photos = []) {
        const normalized = (photos || [])
            .map(photo => this.normalizeShiftNotebookPhoto(photo))
            .filter(photo => photo.src)
            .map((photo, index) => {
                const caption = photo.caption || '';
                return {
                    ...photo,
                    index,
                    role: this.inferShiftPhotoCompareRole(caption),
                    setKey: this.getShiftPhotoCompareSetKey(caption) || `set-${index}`
                };
            });
        const beforeItems = normalized.filter(photo => photo.role === 'before');
        const afterItems = normalized.filter(photo => photo.role === 'after');
        const pairs = [];
        const usedAfter = new Set();
        beforeItems.forEach(before => {
            const after = afterItems.find(item => !usedAfter.has(item.index) && item.setKey === before.setKey)
                || afterItems.find(item => !usedAfter.has(item.index));
            if (!after) return;
            usedAfter.add(after.index);
            pairs.push({ before, after });
        });
        if (!pairs.length && normalized.length >= 2) {
            pairs.push({ before: normalized[0], after: normalized[1] });
        }
        return pairs.slice(0, 3);
    }

    renderFiveSMonthlyReport() {
        const summary = document.getElementById('fiveS-summary');
        if (!summary) return;
        let report = document.getElementById('fiveS-monthly-report');
        if (!report) {
            report = document.createElement('div');
            report.id = 'fiveS-monthly-report';
            report.className = 'five-s-monthly-report';
            summary.after(report);
        }
        const rows = this.collectFiveSNotebookRows('this_month', false)
            .map(row => ({ ...row, todoStatus: this.getFiveSRowTodoStatus(row) }));
        if (!rows.length) {
            report.innerHTML = `
                <div class="five-s-monthly-head">
                    <b><i class="fa-solid fa-chart-line"></i> 今月の5Sレポート</b>
                    <span>今月の5S履歴はまだありません</span>
                </div>
            `;
            return;
        }
        const total = rows.length;
        const photoRows = rows.filter(row => row.photos.length > 0).length;
        const photoCount = rows.reduce((sum, row) => sum + row.photos.length, 0);
        const photoPairCount = rows.reduce((sum, row) => sum + this.getFiveSPhotoComparePairs(row.photos).length, 0);
        const photoPairRows = rows.filter(row => this.getFiveSPhotoComparePairs(row.photos).length > 0).length;
        const doneRows = rows.filter(row => row.todoStatus.key === 'done').length;
        const pendingRows = rows.filter(row => row.todoStatus.openCount > 0).length;
        const completionRate = Math.round((doneRows / total) * 100);
        const groupCounts = new Map();
        const assigneeCounts = new Map();
        const fiveSAssigneeCounts = new Map();
        rows.forEach(row => {
            groupCounts.set(row.group || '未設定', (groupCounts.get(row.group || '未設定') || 0) + 1);
            const fiveSAssigneeName = row.fiveSAssigneeId ? this.getKanbanTodoWorkerName(row.fiveSAssigneeId) : '未設定';
            fiveSAssigneeCounts.set(fiveSAssigneeName, (fiveSAssigneeCounts.get(fiveSAssigneeName) || 0) + 1);
            this.getFiveSRowRelatedTodos(row).forEach(todo => {
                (todo.assignedTo || []).forEach(id => {
                    const name = this.getKanbanTodoWorkerName(id);
                    assigneeCounts.set(name, (assigneeCounts.get(name) || 0) + 1);
                });
            });
        });
        const topGroups = Array.from(groupCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const topAssignees = Array.from(assigneeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const topFiveSAssignees = Array.from(fiveSAssigneeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
        report.innerHTML = `
            <div class="five-s-monthly-head">
                <b><i class="fa-solid fa-chart-line"></i> 今月の5Sレポート</b>
                <span>完了率 ${completionRate}% / 未完了 ${pendingRows}件</span>
            </div>
            <div class="five-s-monthly-grid">
                <div><span>5S履歴</span><b>${total}</b></div>
                <div><span>完了</span><b>${doneRows}</b></div>
                <div><span>写真付き</span><b>${photoRows}</b><small>${photoCount}枚</small></div>
                <div><span>前後ペア</span><b>${photoPairCount}</b><small>${photoPairRows}件</small></div>
                <div><span>5S担当者</span><b>${this.escapeHtml(topFiveSAssignees.map(([name, count]) => `${name} ${count}`).join(' / ') || '未設定')}</b></div>
                <div><span>多いグループ</span><b>${this.escapeHtml(topGroups.map(([name, count]) => `${name} ${count}`).join(' / ') || 'なし')}</b></div>
                <div><span>ToDo依頼先</span><b>${this.escapeHtml(topAssignees.map(([name, count]) => `${name} ${count}`).join(' / ') || '未設定')}</b></div>
            </div>
        `;
    }

    renderFiveSJumpOriginNotice() {
        const summary = document.getElementById('fiveS-summary');
        if (!summary) return;
        let notice = document.getElementById('fiveS-jump-origin');
        if (!notice) {
            notice = document.createElement('div');
            notice.id = 'fiveS-jump-origin';
            notice.className = 'five-s-jump-origin';
            summary.before(notice);
        }
        const origin = this._fiveSJumpOrigin;
        if (!origin) {
            notice.hidden = true;
            notice.innerHTML = '';
            return;
        }
        notice.hidden = false;
        const history = (typeof this.getJumpHistory === 'function' ? this.getJumpHistory() : (this._jumpHistory || [])).slice(0, 4);
        const historyHtml = history.length ? `
            <div class="five-s-jump-history">
                <span>移動履歴</span>
                ${history.map((entry, index) => `
                    <button type="button" onclick="app.openJumpHistoryEntry(${index})" title="${this.escapeHtml(this.getJumpHistoryLabel(entry))}">
                        ${this.escapeHtml(this.getJumpHistoryLabel(entry))}
                    </button>
                `).join('')}
            </div>
        ` : '';
        notice.innerHTML = `
            <div class="five-s-jump-origin-main">
                <div>
                    <i class="fa-solid fa-arrow-right-to-bracket"></i>
                    <b>ToDoから移動</b>
                    <span>${this.escapeHtml(origin.title || '無題のToDo')}</span>
                    <small>${this.escapeHtml(origin.status || '未完了')} / ${this.escapeHtml(origin.assignees || '未設定')}</small>
                </div>
                <div class="five-s-jump-origin-actions">
                    ${origin.todoId ? `<button type="button" onclick="app.openKanbanTodoFromSearch('${this.escapeJs(origin.todoId)}', false, { recordJump: false })"><i class="fa-solid fa-arrow-left"></i> ToDoへ戻る</button>` : ''}
                </div>
            </div>
            ${historyHtml}
            <button type="button" class="five-s-jump-origin-close" onclick="app._fiveSJumpOrigin = null; app.renderFiveSJumpOriginNotice()" title="案内を閉じる">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
    }

    buildFiveSTodoTitle(row = {}, rowText = '', groupName = '未設定') {
        const text = String(rowText || '').split(/\r?\n/)[0].trim();
        const main = text || '内容確認';
        const photoCount = Array.isArray(row.photos) ? row.photos.length : 0;
        const photoLabel = photoCount ? ` 写真${photoCount}枚` : '';
        return `5S: ${groupName} ${main}${photoLabel}`.slice(0, 80);
    }

    highlightFiveSManagementRow() {
        const rowId = this._fiveSHighlightRowId || '';
        const source = this._fiveSHighlightSource || {};
        const todoId = this._fiveSHighlightTodoId || '';
        if (!rowId && !source.dateStr && !todoId) return;
        let card = rowId ? document.querySelector(`.five-s-card[data-five-s-row-id="${CSS.escape(rowId)}"]`) : null;
        if (!card && todoId) {
            card = Array.from(document.querySelectorAll('.five-s-card[data-five-s-todo-ids]'))
                .find(item => (item.dataset.fiveSTodoIds || '').split(/\s+/).includes(todoId));
        }
        if (!card && source.dateStr && source.shift) {
            card = document.querySelector(`.five-s-card[data-five-s-date="${CSS.escape(source.dateStr)}"][data-five-s-shift="${CSS.escape(source.shift)}"]`);
        }
        if (!card) {
            this._fiveSHighlightRetryCount = (this._fiveSHighlightRetryCount || 0) + 1;
            if (this._fiveSHighlightRetryCount <= 6) {
                setTimeout(() => this.highlightFiveSManagementRow(), 120);
            } else {
                this._fiveSHighlightRowId = '';
                this._fiveSHighlightSource = null;
                this._fiveSHighlightTodoId = '';
            }
            return;
        }
        this._fiveSHighlightRowId = '';
        this._fiveSHighlightSource = null;
        this._fiveSHighlightTodoId = '';
        this._fiveSHighlightRetryCount = 0;
        card.classList.add('five-s-card-highlight');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => card.classList.remove('five-s-card-highlight'), 6000);
    }

    getFiveSManagementFilters() {
        return {
            shift: document.getElementById('fiveS-filter-shift')?.value || 'all',
            assignee: document.getElementById('fiveS-filter-assignee')?.value || 'all',
            group: document.getElementById('fiveS-filter-group')?.value.trim() || '',
            query: document.getElementById('fiveS-filter-query')?.value.trim() || ''
        };
    }

    updateFiveSAssigneeFilterOptions(rows = []) {
        const select = document.getElementById('fiveS-filter-assignee');
        if (!select) return;
        const current = select.value || 'all';
        const ids = Array.from(new Set((rows || []).map(row => row.fiveSAssigneeId || '').filter(Boolean)));
        select.innerHTML = `
            <option value="all">5S担当すべて</option>
            <option value="__unset__">5S担当未設定</option>
            ${ids.map(id => `<option value="${this.escapeHtml(id)}">${this.escapeHtml(this.getKanbanTodoWorkerName(id))}</option>`).join('')}
        `;
        select.value = Array.from(select.options).some(option => option.value === current) ? current : 'all';
    }

    matchesFiveSManagementFilters(row = {}, filters = {}) {
        if (filters.shift && filters.shift !== 'all') {
            if (filters.shift === 'shared') {
                if (!row.shared) return false;
            } else if (row.shift !== filters.shift || row.shared) {
                return false;
            }
        }
        if (filters.assignee && filters.assignee !== 'all') {
            if (filters.assignee === '__unset__') {
                if (row.fiveSAssigneeId) return false;
            } else if (row.fiveSAssigneeId !== filters.assignee) {
                return false;
            }
        }
        if (filters.group && !this.matchesSearchTerms(row.group || '', this.getSearchTerms(filters.group))) return false;
        if (filters.query) {
            const photoText = (row.photos || []).map(photo => photo.caption || '').filter(Boolean).join(' ');
            const assigneeName = row.fiveSAssigneeId ? this.getKanbanTodoWorkerName(row.fiveSAssigneeId) : '';
            const searchable = `${row.dateStr || ''} ${row.shiftLabel?.name || ''} ${row.shiftLabel?.stamp || ''} ${(row.members || []).join(' ')} ${row.group || ''} ${row.tag || ''} ${assigneeName} ${row.text || ''} ${photoText}`;
            if (!this.matchesSearchTerms(searchable, this.getSearchTerms(filters.query))) return false;
        }
        return true;
    }

    exportFiveSManagementExcel() {
        const period = document.getElementById('fiveS-filter-period')?.value || 'all';
        const photosOnly = !!document.getElementById('fiveS-filter-photos')?.checked;
        const pendingOnly = !!document.getElementById('fiveS-filter-pending')?.checked;
        const filters = this.getFiveSManagementFilters();
        const rows = this.collectFiveSNotebookRows(period, photosOnly)
            .map(row => ({ ...row, todoStatus: this.getFiveSRowTodoStatus(row) }))
            .filter(row => this.matchesFiveSManagementFilters(row, filters))
            .filter(row => !pendingOnly || row.todoStatus.openCount > 0);
        if (!rows.length) {
            alert('出力する5S履歴がありません。');
            return;
        }
        const esc = value => this.escapeHtml(value ?? '');
        const boundary = `----=_NextPart_5S_${Date.now()}`;
        const imageParts = [];
        const maxPhotoColumns = Math.max(1, Math.min(8, rows.reduce((max, row) => Math.max(max, row.photos.length), 0)));
        const getPhotoLocation = (photo, rowIndex, photoIndex) => {
            const match = String(photo.src || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
            if (!match) return '';
            const mime = match[1];
            const extMap = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
            const location = `5s_photo_${rowIndex + 1}_${photoIndex + 1}.${extMap[mime] || 'jpg'}`;
            imageParts.push({ location, mime, data: match[2] });
            return location;
        };
        const photoCell = (row, rowIndex, photoIndex) => {
            const photo = row.photos[photoIndex];
            if (!photo) return '<td class="photo-col"></td>';
            const location = getPhotoLocation(photo, rowIndex, photoIndex);
            return `
                <td class="photo-col" align="center" valign="middle">
                    ${location ? `<p class="photo-box" align="center"><img src="${location}" width="34" style="width:34px;"></p>` : ''}
                </td>
            `;
        };
        const html = `
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    @page { margin: 0.35in; mso-page-orientation: landscape; }
                    body { font-family: "Yu Gothic", "Meiryo", sans-serif; }
                    table.five-s-export {
                        border-collapse: collapse;
                        table-layout: fixed;
                        width: ${678 + (maxPhotoColumns * 74)}px;
                    }
                    .five-s-export th {
                        background: #15803d;
                        color: #ffffff;
                        font-weight: 700;
                        text-align: center;
                        vertical-align: middle;
                        border: 1px solid #166534;
                        height: 28px;
                    }
                    .five-s-export td {
                        border: 1px solid #94a3b8;
                        vertical-align: middle;
                        padding: 6px;
                        mso-number-format: "\\@";
                        white-space: normal;
                    }
                    .date-col { width: 88px; text-align: center; }
                    .shift-col { width: 56px; text-align: center; }
                    .group-col { width: 88px; }
                    .type-col { width: 58px; text-align: center; }
                    .text-col { width: 330px; line-height: 1.35; }
                    .photo-col {
                        width: 74px;
                        min-width: 74px;
                        text-align: center;
                        vertical-align: middle;
                        white-space: nowrap;
                        padding-top: 14px;
                        padding-bottom: 14px;
                    }
                    .record-row {
                        height: 46pt;
                        mso-height-source: userset;
                    }
                    .photo-col img {
                        display: inline-block;
                        margin: 0 auto;
                    }
                    .photo-box {
                        width: 100%;
                        height: 42px;
                        line-height: 42px;
                        text-align: center;
                        vertical-align: middle;
                        margin: 0;
                    }
                    .photo-box img {
                        vertical-align: middle;
                    }
                    .date-col, .shift-col, .group-col, .type-col {
                        white-space: nowrap;
                    }
                </style>
            </head>
            <body>
                <table class="five-s-export">
                    <colgroup>
                        <col class="date-col">
                        <col class="shift-col">
                        <col class="group-col">
                        <col class="type-col">
                        <col class="type-col">
                        <col class="text-col">
                        ${Array.from({ length: maxPhotoColumns }, () => '<col class="photo-col">').join('')}
                    </colgroup>
                    <thead>
                        <tr>
                            <th>日付</th><th>シフト</th><th>グループ</th><th>5S担当</th><th>区分</th><th>対応状況</th><th>内容</th>
                            ${Array.from({ length: maxPhotoColumns }, (_, i) => `<th>写真${i + 1}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map((row, rowIndex) => `
                            <tr class="record-row">
                                <td class="date-col">${esc(row.dateStr)}</td>
                                <td class="shift-col">${esc(row.shiftLabel.name)}</td>
                                <td class="group-col">${esc(row.group)}</td>
                                <td class="type-col">${esc(row.fiveSAssigneeId ? this.getKanbanTodoWorkerName(row.fiveSAssigneeId) : '未設定')}</td>
                                <td class="type-col">${esc(row.tag)}</td>
                                <td class="type-col">${esc(row.todoStatus.label)}</td>
                                <td class="text-col">${esc(row.text).replace(/\n/g, '<br>')}</td>
                                ${Array.from({ length: maxPhotoColumns }, (_, photoIndex) => photoCell(row, rowIndex, photoIndex)).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;
        const mhtml = [
            'MIME-Version: 1.0',
            `Content-Type: multipart/related; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            'Content-Type: text/html; charset="UTF-8"',
            'Content-Transfer-Encoding: 8bit',
            'Content-Location: 5S_history.html',
            '',
            html,
            ...imageParts.flatMap(part => [
                '',
                `--${boundary}`,
                `Content-Type: ${part.mime}`,
                'Content-Transfer-Encoding: base64',
                `Content-Location: ${part.location}`,
                '',
                part.data.replace(/(.{76})/g, '$1\n')
            ]),
            '',
            `--${boundary}--`
        ].join('\r\n');
        const blob = new Blob([mhtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `5S_history_${this.getLocalDateString()}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    exportFiveSManagementSimpleExcel() {
        const period = document.getElementById('fiveS-filter-period')?.value || 'all';
        const photosOnly = !!document.getElementById('fiveS-filter-photos')?.checked;
        const pendingOnly = !!document.getElementById('fiveS-filter-pending')?.checked;
        const filters = this.getFiveSManagementFilters();
        const rows = this.collectFiveSNotebookRows(period, photosOnly)
            .map(row => ({ ...row, todoStatus: this.getFiveSRowTodoStatus(row) }))
            .filter(row => this.matchesFiveSManagementFilters(row, filters))
            .filter(row => !pendingOnly || row.todoStatus.openCount > 0);
        if (!rows.length) {
            alert('出力する5S履歴がありません。');
            return;
        }
        const esc = value => this.escapeHtml(value ?? '');
        const html = `
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    table { border-collapse: collapse; font-family: "Yu Gothic", "Meiryo", sans-serif; }
                    th { background: #15803d; color: #fff; font-weight: 700; text-align: center; }
                    th, td { border: 1px solid #94a3b8; padding: 6px 8px; vertical-align: middle; mso-number-format: "\\@"; }
                    td.text { width: 420px; white-space: normal; }
                    td.center { text-align: center; }
                </style>
            </head>
            <body>
                <table>
                    <thead>
                        <tr>
                            <th>日付</th>
                            <th>シフト</th>
                            <th>グループ</th>
                            <th>5S担当</th>
                            <th>区分</th>
                            <th>対応状況</th>
                            <th>未完了ToDo</th>
                            <th>写真枚数</th>
                            <th>内容</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => `
                            <tr>
                                <td class="center">${esc(row.dateStr)}</td>
                                <td class="center">${esc(row.shiftLabel.name)}</td>
                                <td>${esc(row.group)}</td>
                                <td class="center">${esc(row.fiveSAssigneeId ? this.getKanbanTodoWorkerName(row.fiveSAssigneeId) : '未設定')}</td>
                                <td class="center">${esc(row.tag || '通常')}</td>
                                <td class="center">${esc(row.todoStatus.label)}</td>
                                <td class="center">${esc(row.todoStatus.openCount)}</td>
                                <td class="center">${esc(row.photos.length)}</td>
                                <td class="text">${esc(row.text || this.stripShiftNoteHtml(row.html || '') || '本文なし').replace(/\n/g, '<br>')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;
        const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `5S履歴_写真なし_${this.getLocalDateString()}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    }
    for (const name of Object.getOwnPropertyNames(MaintenanceFiveSMethods.prototype)) {
        if (name !== 'constructor') MaintenanceApp.prototype[name] = MaintenanceFiveSMethods.prototype[name];
    }
})();
