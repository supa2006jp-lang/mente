(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppShiftNotebookCoreMethods extends MaintenanceApp {
    getShiftNotebookLabel(shift) {
        const labels = {
            early: { stamp: '早', name: '早番' },
            late: { stamp: '遅', name: '遅番' },
            night: { stamp: '深', name: '深夜' }
        };
        return labels[shift] || labels.early;
    }

    getShiftNotebookRowsAndMembers(notebookData) {
        if (Array.isArray(notebookData)) return { rows: notebookData, members: [] };
        return {
            rows: Array.isArray(notebookData?.rows) ? notebookData.rows : [],
            members: Array.isArray(notebookData?.members) ? notebookData.members : [],
            absentMembers: Array.isArray(notebookData?.absentMembers) ? notebookData.absentMembers : [],
            inheritedMembers: !!notebookData?.inheritedMembers,
            inheritedFrom: notebookData?.inheritedFrom || ''
        };
    }

    getShiftNotebookThroughGroupName() {
        return '貫通表示';
    }

    isShiftNotebookThroughGroup(group) {
        return (group || '') === this.getShiftNotebookThroughGroupName();
    }

    getShiftNotebookRowsForShift(dayData = {}, shift) {
        const notebookData = dayData?.[shift];
        const { rows, members, absentMembers, inheritedMembers, inheritedFrom } = this.getShiftNotebookRowsAndMembers(notebookData);
        const sharedRows = Array.isArray(dayData?.sharedRows) ? dayData.sharedRows : [];
        return {
            rows: [...sharedRows, ...rows],
            members,
            absentMembers,
            inheritedMembers,
            inheritedFrom
        };
    }

    getNotebookSearchDateRange(period) {
        const format = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (period === 'today') return { start: format(today), end: format(today), label: '今日' };
        if (period === 'yesterday') return { start: format(yesterday), end: format(yesterday), label: '昨日' };
        if (period === 'yesterday_today') return { start: format(yesterday), end: format(today), label: '昨日と今日' };
        if (period === 'this_month') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return { start: format(start), end: format(end), label: '今月' };
        }
        if (period === 'last_month') {
            const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const end = new Date(today.getFullYear(), today.getMonth(), 0);
            return { start: format(start), end: format(end), label: '先月' };
        }
        if (period === 'this_year') {
            const start = new Date(today.getFullYear(), 0, 1);
            const end = new Date(today.getFullYear(), 11, 31);
            return { start: format(start), end: format(end), label: '今年' };
        }
        if (period === 'last_year') {
            const year = today.getFullYear() - 1;
            const start = new Date(year, 0, 1);
            const end = new Date(year, 11, 31);
            return { start: format(start), end: format(end), label: '去年' };
        }
        if (period === 'CUSTOM') {
            const start = this.customStartDate || '';
            const end = this.customEndDate || '';
            return { start, end, label: start && end ? `${start} - ${end}` : '期間指定' };
        }
        return { start: '', end: '', label: '全期間' };
    }

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
            title: `5S写真編集: ${dateStr} / ${shiftLabel.name} / ${groupName}`,
            row: null,
            globalMarks: source.row.photoCompareMarks || [],
            onSync: (context) => {
                source.row.photos = context.photos.map(photo => ({
                    src: photo.src,
                    caption: photo.caption || '',
                    marks: Array.isArray(photo.marks) ? photo.marks : []
                }));
                source.row.photoCompareMarks = Array.isArray(context.globalMarks) ? context.globalMarks : [];
                store.save();
                if (document.getElementById('fiveS-list')) this.renderFiveSManagement();
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
        link.download = `5S_history_${new Date().toISOString().split('T')[0]}.xls`;
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
        link.download = `5S履歴_写真なし_${new Date().toISOString().slice(0, 10)}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    collectShiftNotebookSearchResults(query, period = 'all') {
        const terms = this.getSearchTerms(query);
        const range = this.getNotebookSearchDateRange(period);
        const notebooks = store.activeData.shiftNotebooks || {};
        const results = [];

        Object.keys(notebooks).sort().forEach(dateStr => {
            if (range.start && (dateStr < range.start || dateStr > range.end)) return;
            const dayData = notebooks[dateStr] || {};
            ['early', 'late', 'night'].forEach(shift => {
                const notebookData = dayData[shift];
                const hasSharedRows = Array.isArray(dayData.sharedRows) && dayData.sharedRows.length > 0;
                if (!notebookData && !hasSharedRows) return;
                const { rows, members } = this.getShiftNotebookRowsForShift(dayData, shift);
                const label = this.getShiftNotebookLabel(shift);

                rows.forEach((row, index) => {
                    const text = row?.text || '';
                    const html = row?.html || '';
                    const tag = row?.tag || '通常';
                    const group = row?.group || '未設定';
                    const photos = Array.isArray(row?.photos) ? row.photos : [];
                    const photoText = photos.map(photo => this.normalizeShiftNotebookPhoto(photo).caption).filter(Boolean).join(' ');
                    const searchable = `${dateStr} ${label.name} ${label.stamp} ${members.join(' ')} ${tag} ${group} ${text} ${photoText}`;
                    if (!this.matchesSearchTerms(searchable, terms)) return;
                    results.push({
                        dateStr,
                        shift,
                        label,
                        members,
                        text,
                        html,
                        tag,
                        group,
                        photos,
                        index,
                        matchLabels: this.getUnifiedSearchMatchLabels({
                            '日付': dateStr,
                            '勤務': label.name,
                            'メンバー': members.join(' '),
                            'タグ': tag,
                            'グループ': group,
                            '本文': text || this.stripShiftNoteHtml(html || ''),
                            '写真': photoText
                        }, terms)
                    });
                });

                if (rows.length === 0 && members.length > 0) {
                    const searchable = `${dateStr} ${label.name} ${label.stamp} ${members.join(' ')}`;
                    if (this.matchesSearchTerms(searchable, terms)) {
                        results.push({
                            dateStr,
                            shift,
                            label,
                            members,
                            text: '',
                            tag: '通常',
                            group: '未設定',
                            photos: [],
                            index: 0,
                            matchLabels: this.getUnifiedSearchMatchLabels({
                                '日付': dateStr,
                                '勤務': label.name,
                                'メンバー': members.join(' ')
                            }, terms)
                        });
                    }
                }
            });
        });

        return results.sort((a, b) => b.dateStr.localeCompare(a.dateStr) || a.shift.localeCompare(b.shift) || a.index - b.index);
    }

    matchesNotebookSearchPeriod(dateStr, period = 'all') {
        const range = this.getNotebookSearchDateRange(period);
        if (!dateStr) return !range.start;
        return (!range.start || dateStr >= range.start) && (!range.end || dateStr <= range.end);
    }

    getSearchTerms(query = '') {
        return MaintenanceStore.toHalfWidthLower(query || '').split(/[\s　]+/).filter(Boolean);
    }

    matchesSearchTerms(searchable = '', terms = []) {
        const normalized = MaintenanceStore.toHalfWidthLower(searchable || '');
        return terms.every(term => normalized.includes(term));
    }

    getUnifiedSearchMatchLabels(fields = {}, terms = []) {
        if (!terms.length) return [];
        return Object.entries(fields)
            .filter(([, value]) => value !== undefined && value !== null && this.matchesSearchTerms(String(value), terms))
            .map(([label]) => label)
            .slice(0, 5);
    }

    getUnifiedSearchSnippet(text = '', query = '', maxLength = 180) {
        const raw = String(text || '').replace(/\s+/g, ' ').trim();
        if (!raw) return '';
        const terms = this.getSearchTerms(query);
        const normalized = MaintenanceStore.toHalfWidthLower(raw);
        const hitIndex = terms
            .map(term => normalized.indexOf(term))
            .filter(index => index >= 0)
            .sort((a, b) => a - b)[0] ?? 0;
        const start = Math.max(0, hitIndex - 46);
        const snippet = raw.slice(start, start + maxLength);
        return `${start > 0 ? '...' : ''}${snippet}${start + maxLength < raw.length ? '...' : ''}`;
    }

    getUnifiedSearchTargetTypes() {
        const controls = Array.from(document.querySelectorAll('.unified-search-target-check'));
        if (!controls.length) return ['history', 'guide', 'notebook', 'todo', 'memo', 'task'];
        return controls.filter(input => input.checked).map(input => input.value);
    }

    getSavedUnifiedSearchTargetTypes() {
        const defaults = ['history', 'guide', 'notebook', 'todo', 'memo', 'task'];
        try {
            const saved = JSON.parse(localStorage.getItem('unified_search_target_types') || 'null');
            const valid = defaults.filter(type => Array.isArray(saved) && saved.includes(type));
            return valid.length ? valid : defaults;
        } catch (_) {
            return defaults;
        }
    }

    saveUnifiedSearchTargetTypes() {
        try {
            localStorage.setItem('unified_search_target_types', JSON.stringify(this.getUnifiedSearchTargetTypes()));
        } catch (_) {}
    }

    getOpenedUnifiedSearchKeys() {
        try {
            const saved = JSON.parse(localStorage.getItem('unified_search_opened_keys') || '[]');
            return new Set(Array.isArray(saved) ? saved : []);
        } catch (_) {
            return new Set();
        }
    }

    markUnifiedSearchResultOpened(key = '') {
        if (!key) return;
        const opened = this.getOpenedUnifiedSearchKeys();
        opened.add(String(key));
        try {
            localStorage.setItem('unified_search_opened_keys', JSON.stringify(Array.from(opened).slice(-500)));
        } catch (_) {}
        document.querySelectorAll(`.notebook-search-result[data-result-key="${CSS.escape(String(key))}"]`).forEach(item => {
            item.classList.add('opened');
            item.querySelector('.unified-search-opened-badge')?.classList.remove('hidden');
        });
    }

    resetUnifiedSearchOpenedMarks() {
        if (!confirm('検索結果の「確認済み」表示をすべてリセットしますか？')) return;
        try {
            localStorage.removeItem('unified_search_opened_keys');
        } catch (_) {}
        document.querySelectorAll('.notebook-search-result.opened').forEach(item => item.classList.remove('opened'));
        document.querySelectorAll('.unified-search-opened-badge').forEach(badge => badge.classList.add('hidden'));
    }

    rememberAndOpenUnifiedSearchResult(key = '', query = '', period = 'all', action = '') {
        this.markUnifiedSearchResultOpened(key);
        this.rememberUnifiedSearchReturn(query, period);
        if (action) {
            try {
                Function('app', action)(this);
            } catch (error) {
                console.error('Failed to open search result:', error);
            }
        }
    }

    rememberUnifiedSearchReturn(query = '', period = 'all') {
        const list = document.querySelector('.notebook-search-results');
        this._unifiedSearchReturn = {
            query,
            period,
            types: this.getUnifiedSearchTargetTypes(),
            activeTab: document.querySelector('.notebook-search-tabs button.active')?.dataset.searchTab || 'all',
            sort: document.querySelector('.notebook-search-sort button.active')?.dataset.sortMode || 'date',
            scrollTop: list?.scrollTop || 0
        };
    }

    injectUnifiedSearchReturnButton() {
        const state = this._unifiedSearchReturn;
        const container = document.getElementById('modal-container');
        const footer = document.querySelector('.modal-footer');
        if (!state || !footer || !container || container.dataset.modalType === 'shift-notebook-search') return;
        if (footer.querySelector('.unified-search-return-btn')) return;
        footer.insertAdjacentHTML('afterbegin', `
            <button type="button" class="secondary-btn unified-search-return-btn" onclick="app.reopenUnifiedSearchReturn()">
                <i class="fa-solid fa-arrow-left"></i> 検索結果へ戻る
            </button>
        `);
    }

    reopenUnifiedSearchReturn() {
        const state = this._unifiedSearchReturn;
        if (!state?.query) return;
        this._restoreUnifiedSearchState = { ...state };
        this.closeModal();
        this.openShiftNotebookSearchResults(state.query, state.period || 'all');
    }

    highlightUnifiedSearchText(text = '', query = '') {
        const terms = (query || '').trim().split(/[\s　]+/).filter(Boolean);
        let html = this.escapeHtml(text || '');
        if (terms.length === 0) return html.replace(/\n/g, '<br>');
        terms
            .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .filter(Boolean)
            .forEach(term => {
                html = html.replace(new RegExp(`(${term})`, 'gi'), '<mark class="notebook-search-mark">$1</mark>');
            });
        return html.replace(/\n/g, '<br>');
    }

    collectUnifiedSearchResults(query, period = 'all') {
        const terms = this.getSearchTerms(query);
        const results = [];
        const machines = store.getMachines(true);
        const machineById = new Map(machines.map(machine => [String(machine.id), machine]));
        const tasks = store.activeData.tasks || [];
        const taskById = new Map(tasks.map(task => [String(task.id), task]));
        const hasRelatedGuide = (history) => {
            if (history?.guide && !store.isGuideArchived?.(history.id)) return true;
            const title = this.getHistoryDisplayText(history);
            return (store.activeData.history || []).some(row =>
                row.id !== history.id &&
                row.guide &&
                !store.isGuideArchived?.(row.id) &&
                String(row.machineId) === String(history.machineId) &&
                this.getHistoryDisplayText(row) === title
            );
        };

        this.collectShiftNotebookSearchResults(query, period).forEach(result => {
            results.push({ ...result, type: 'notebook', resultKey: `notebook:${result.dateStr}:${result.shift}:${result.index}`, typeLabel: '連絡帳', date: result.dateStr });
        });

        Object.entries(store.activeData.memos || {}).forEach(([dateStr, memo]) => {
            if (!this.matchesNotebookSearchPeriod(dateStr, period)) return;
            const text = String(memo || '').trim();
            if (!text) return;
            if (!this.matchesSearchTerms(`${dateStr} メモ ${text}`, terms)) return;
            results.push({
                type: 'memo',
                resultKey: `memo:${dateStr}`,
                typeLabel: 'メモ',
                date: dateStr,
                title: `${dateStr} メモ`,
                text,
                snippet: this.getUnifiedSearchSnippet(text, query),
                matchLabels: this.getUnifiedSearchMatchLabels({
                    '日付': dateStr,
                    'メモ': text
                }, terms),
                openAction: `app.closeModal(); app.openDayQuickMenu('${this.escapeJs(dateStr)}')`
            });
        });

        (store.activeData.history || []).filter(h => !h.isManualGuide).forEach(h => {
            if (!this.matchesNotebookSearchPeriod(h.date || '', period)) return;
            const machine = machineById.get(String(h.machineId)) || null;
            const task = h.taskId ? taskById.get(String(h.taskId)) : null;
            const workers = Array.isArray(h.workers) ? h.workers.join(', ') : (h.workers || '');
            const typeLabel = h.isDokatei ? 'ドカ停' : (h.taskId ? '定期履歴' : (h.isNonProductionStop ? '非生産停止' : '突発対応'));
            const title = this.getHistoryDisplayText(h);
            const body = [
                h.errorContent,
                h.cause,
                h.notes,
                h.errorNo,
                h.category,
                h.workTime ? `${h.workTime}分` : '',
                h.startTime && h.endTime ? `${h.startTime}-${h.endTime}` : '',
                task?.content
            ].filter(Boolean).join('\n');
            const searchable = `${h.date} ${typeLabel} ${title} ${body} ${machine?.name || ''} ${machine?.model || ''} ${machine?.lineNo || ''} ${workers}`;
            if (!this.matchesSearchTerms(searchable, terms)) return;
            results.push({
                type: 'history',
                resultKey: `history:${h.id}`,
                typeLabel,
                date: h.date || '',
                title,
                text: body || title,
                snippet: this.getUnifiedSearchSnippet(`${title}\n${body}`, query),
                sub: `${machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし'}${workers ? ` / ${workers}` : ''}`,
                historyKind: h.isDokatei ? 'dokatei' : (h.taskId ? 'periodic' : (h.isNonProductionStop ? 'nonProductionStop' : 'sudden')),
                hasGuide: hasRelatedGuide(h),
                matchLabels: this.getUnifiedSearchMatchLabels({
                    '日付': h.date,
                    '区分': typeLabel,
                    'タイトル': title,
                    '内容': h.errorContent,
                    '原因': h.cause,
                    '処置': h.notes,
                    '機械': machine?.name,
                    '型式': machine?.model,
                    '作業者': workers
                }, terms),
                openAction: `app.closeModal(); app.openHistoryEditForm('${this.escapeJs(h.id)}')`
            });
        });

        (store.activeData.history || []).filter(h => h.guide && !store.isGuideArchived?.(h.id)).forEach(h => {
            if (!this.matchesNotebookSearchPeriod(h.date || '', period)) return;
            const machine = machineById.get(String(h.machineId)) || null;
            const guide = h.guide || {};
            const title = this.getGuideDisplayTitle?.(h, guide) || this.getHistoryDisplayText(h) || h.errorContent || '手順書';
            const tagList = Array.isArray(guide.tags) ? guide.tags : [];
            const tags = tagList.join(' ');
            const text = [
                guide.title,
                guide.text,
                tags,
                h.errorContent,
                h.cause,
                h.notes
            ].filter(Boolean).join('\n');
            const searchable = `${h.date || ''} 手順書 ナレッジ ${title} ${text} ${machine?.name || ''} ${machine?.model || ''} ${machine?.lineNo || ''}`;
            if (!this.matchesSearchTerms(searchable, terms)) return;
            results.push({
                type: 'guide',
                resultKey: `guide:${h.id}`,
                typeLabel: '手順書',
                date: h.date || '',
                title,
                text: guide.text || text || title,
                snippet: this.getUnifiedSearchSnippet(`${guide.title || title}\n${guide.text || ''}\n${h.cause || ''}\n${h.notes || ''}`, query),
                sub: `${machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし'}${tags ? ` / ${tags}` : ''}`,
                tags: tagList,
                matchLabels: this.getUnifiedSearchMatchLabels({
                    '日付': h.date,
                    '手順書タイトル': guide.title || title,
                    '手順書本文': guide.text,
                    'タグ': tags,
                    '元履歴': title,
                    '原因': h.cause,
                    '処置': h.notes,
                    '機械': machine?.name,
                    '型式': machine?.model
                }, terms),
                secondaryAction: `app.closeModal(); app.openHistoryEditForm('${this.escapeJs(h.id)}')`,
                secondaryLabel: '元履歴',
                openAction: `app.closeModal(); app.openGuideModal('${this.escapeJs(h.id)}')`
            });
        });

        tasks.filter(task => !task.deleted && !store.isMaintenanceTaskArchived(task.id)).forEach(task => {
            const dateStr = task.startDate || '';
            if (!this.matchesNotebookSearchPeriod(dateStr, period)) return;
            const machine = machineById.get(String(task.machineId)) || null;
            const searchable = `${dateStr} 定期メンテ 予定 ${task.content || ''} ${task.periodDays || ''} ${machine?.name || ''} ${machine?.model || ''} ${machine?.lineNo || ''}`;
            if (!this.matchesSearchTerms(searchable, terms)) return;
            const today = new Date();
            const openDate = dateStr || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            results.push({
                type: 'task',
                resultKey: `task:${task.id}`,
                typeLabel: '定期メンテ',
                date: dateStr,
                title: task.content || '定期メンテ',
                text: task.periodDays ? `${task.periodDays}日周期` : '単発予定',
                snippet: this.getUnifiedSearchSnippet(`${task.content || ''} ${task.periodDays || ''} ${machine?.name || ''} ${machine?.model || ''}`, query),
                sub: machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし',
                matchLabels: this.getUnifiedSearchMatchLabels({
                    '日付': dateStr,
                    '定期メンテ': task.content,
                    '周期': task.periodDays,
                    '機械': machine?.name,
                    '型式': machine?.model
                }, terms),
                openAction: `app.closeModal(); app.openCompletionForm('${this.escapeJs(task.id)}', '${this.escapeJs(openDate)}')`
            });
        });

        (store.activeData.localTodos || []).forEach(todo => {
            const date = todo.deadlineDate || todo.completedAt?.slice?.(0, 10) || todo.updatedAt?.slice?.(0, 10) || todo.createdAt?.slice?.(0, 10) || '';
            if (!this.matchesNotebookSearchPeriod(date, period)) return;
            const assigned = (todo.assignedTo || []).map(id => this.getKanbanTodoWorkerName(id)).join(' ');
            const requester = todo.requestedBy ? this.getKanbanTodoWorkerName(todo.requestedBy) : '';
            const statusLabel = { todo: '未処理', progress: '処理中', done: '完了' }[todo.status || 'todo'] || '';
            const searchable = `${date} ToDo タスク 依頼 ${statusLabel} ${todo.title || ''} ${todo.description || ''} ${assigned} ${requester} ${todo.deadlineDate || ''} ${todo.deadlineTime || ''}`;
            if (!this.matchesSearchTerms(searchable, terms)) return;
            results.push({
                type: 'todo',
                resultKey: `todo:${todo.id}`,
                typeLabel: todo.isRequest ? 'ToDo依頼' : 'ToDo',
                date,
                title: todo.title || '無題のToDo',
                text: todo.description || statusLabel || '詳細なし',
                snippet: this.getUnifiedSearchSnippet(`${todo.title || ''}\n${todo.description || ''}\n${statusLabel}\n${assigned}\n${requester}`, query),
                sub: `${statusLabel}${assigned ? ` / 依頼先: ${assigned}` : ''}${requester ? ` / 依頼者: ${requester}` : ''}`,
                matchLabels: this.getUnifiedSearchMatchLabels({
                    '日付': date,
                    'タイトル': todo.title,
                    '内容': todo.description,
                    '担当': assigned,
                    '依頼者': requester,
                    '状態': statusLabel
                }, terms),
                openAction: `app.closeModal(); app.openKanbanTodoFromSearch('${this.escapeJs(todo.id)}')`
            });
        });

        return results.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.typeLabel.localeCompare(b.typeLabel, 'ja'));
    }

    collectGuideGapResults(period = 'all') {
        const machines = store.getMachines(true);
        const machineById = new Map(machines.map(machine => [String(machine.id), machine]));
        const hasGuideForHistory = (history) => {
            if (history?.guide && !store.isGuideArchived?.(history.id)) return true;
            const title = this.getHistoryDisplayText(history);
            return (store.activeData.history || []).some(row =>
                row.id !== history.id &&
                row.guide &&
                !store.isGuideArchived?.(row.id) &&
                String(row.machineId) === String(history.machineId) &&
                this.getHistoryDisplayText(row) === title
            );
        };
        const getPriority = (history) => {
            const workTime = parseInt(history.workTime, 10) || 0;
            let score = 0;
            const reasons = [];
            if (history.isDokatei) {
                score += 50;
                reasons.push('ドカ停');
            }
            if (history.isFirstTime === false) {
                score += 35;
                reasons.push('再発');
            }
            if (workTime >= 60) {
                score += 25;
                reasons.push(`${workTime}分`);
            } else if (workTime >= 30) {
                score += 12;
                reasons.push(`${workTime}分`);
            }
            if (history.isNonProductionStop) {
                score += 15;
                reasons.push('非生産停止');
            }
            if (!String(history.cause || '').trim() || !String(history.notes || '').trim()) {
                score -= 8;
            }
            const level = score >= 60 ? 'high' : (score >= 30 ? 'medium' : 'normal');
            const label = level === 'high' ? '高' : (level === 'medium' ? '中' : '通常');
            return { score, level, label, reasons: reasons.length ? reasons : ['通常'] };
        };
        return (store.activeData.history || [])
            .filter(h => !h.isManualGuide)
            .filter(h => this.matchesNotebookSearchPeriod(h.date || '', period))
            .filter(h => !h.taskId || h.isDokatei || h.isNonProductionStop || h.isSudden)
            .filter(h => !hasGuideForHistory(h))
            .map(h => {
                const machine = machineById.get(String(h.machineId)) || null;
                const priority = getPriority(h);
                return {
                    id: h.id,
                    date: h.date || '',
                    title: this.getHistoryDisplayText(h),
                    machine: machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし',
                    cause: h.cause || '',
                    notes: h.notes || '',
                    typeLabel: h.isDokatei ? 'ドカ停' : (h.isNonProductionStop ? '非生産停止' : '突発対応'),
                    priority
                };
            })
            .sort((a, b) => (b.priority.score - a.priority.score) || (b.date || '').localeCompare(a.date || ''));
    }

    openGuideGapList(period = 'all') {
        const range = this.getNotebookSearchDateRange(period);
        const rows = this.collectGuideGapResults(period);
        this.openModal('guide-gap-list', `手順書の未整備一覧 / ${range.label} (${rows.length}件)`, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = rows.length ? `
                <div class="guide-gap-list">
                    ${rows.map(row => `
                        <article class="guide-gap-card">
                            <div class="guide-gap-head">
                                <span>${this.escapeHtml(row.typeLabel)}</span>
                                <b>${this.escapeHtml(row.date || '日付なし')}</b>
                            </div>
                            <div class="guide-gap-priority ${this.escapeHtml(row.priority.level)}">
                                <strong>優先度 ${this.escapeHtml(row.priority.label)}</strong>
                                ${row.priority.reasons.map(reason => `<em>${this.escapeHtml(reason)}</em>`).join('')}
                            </div>
                            <h4>${this.escapeHtml(row.title || '内容なし')}</h4>
                            <div class="guide-gap-machine"><i class="fa-solid fa-industry"></i> ${this.escapeHtml(row.machine)}</div>
                            <div class="guide-gap-detail">
                                <div><strong>原因</strong>${this.escapeHtml(row.cause || '未入力')}</div>
                                <div><strong>処置</strong>${this.escapeHtml(row.notes || '未入力')}</div>
                            </div>
                            <button type="button" class="primary-btn" onclick="app.closeModal(); app.openHistoryEditForm('${this.escapeJs(row.id)}')">
                                <i class="fa-solid fa-pen-to-square"></i> 履歴を開いて手順書作成
                            </button>
                        </article>
                    `).join('')}
                </div>
            ` : `
                <div class="notebook-search-empty">
                    <i class="fa-solid fa-circle-check"></i>
                    <div>この期間の未整備候補はありません。</div>
                </div>
            `;
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
        });
    }

    highlightShiftNotebookSearchHtml(html = '', query = '') {
        const sanitized = this.sanitizeShiftNoteHtml(html);
        const terms = (query || '').trim().split(/[\s　]+/).filter(Boolean);
        if (terms.length === 0) return sanitized;

        const container = document.createElement('div');
        container.innerHTML = sanitized;
        const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach(node => {
            const value = node.nodeValue || '';
            if (!regex.test(value)) {
                regex.lastIndex = 0;
                return;
            }
            regex.lastIndex = 0;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            value.replace(regex, (match, _group, offset) => {
                if (offset > lastIndex) fragment.appendChild(document.createTextNode(value.slice(lastIndex, offset)));
                const mark = document.createElement('mark');
                mark.className = 'notebook-search-mark';
                mark.textContent = match;
                fragment.appendChild(mark);
                lastIndex = offset + match.length;
                return match;
            });
            if (lastIndex < value.length) fragment.appendChild(document.createTextNode(value.slice(lastIndex)));
            node.parentNode?.replaceChild(fragment, node);
        });

        return container.innerHTML;
    }

    openShiftNotebookSearchResults(queryText = '', period = 'all') {
        const query = (queryText || '').trim();
        if (!query) {
            alert('検索キーワードを入力してください。');
            return;
        }

        const range = this.getNotebookSearchDateRange(period);
        const results = this.collectUnifiedSearchResults(query, period);
        const typeCounts = results.reduce((acc, result) => {
            acc[result.type] = (acc[result.type] || 0) + 1;
            return acc;
        }, {});
        const searchTabs = [
            ['all', 'すべて', results.length],
            ['notebook', '連絡帳', typeCounts.notebook || 0],
            ['todo', 'ToDo', typeCounts.todo || 0],
            ['memo', 'メモ', typeCounts.memo || 0],
            ['history', '履歴', typeCounts.history || 0],
            ['guide', '手順書', typeCounts.guide || 0],
            ['task', '定期メンテ', typeCounts.task || 0]
        ];
        const targetTypes = [
            ['history', '履歴'],
            ['guide', '手順書'],
            ['notebook', '連絡帳'],
            ['todo', 'ToDo'],
            ['memo', 'メモ'],
            ['task', '定期メンテ']
        ];
        const restoreState = this._restoreUnifiedSearchState;
        const restoredTypes = restoreState?.query === query && restoreState?.period === period && Array.isArray(restoreState.types)
            ? restoreState.types
            : this.getSavedUnifiedSearchTargetTypes();
        const guideGapCount = this.collectGuideGapResults(period).length;
        const openedKeys = this.getOpenedUnifiedSearchKeys();
        const classificationCards = [
            { type: 'history', label: '履歴', icon: 'fa-clock-rotate-left', count: typeCounts.history || 0 },
            { type: 'guide', label: '手順書', icon: 'fa-book-open', count: typeCounts.guide || 0 },
            { type: 'notebook', label: '連絡帳', icon: 'fa-address-book', count: typeCounts.notebook || 0 },
            { type: 'todo', label: 'ToDo', icon: 'fa-list-check', count: typeCounts.todo || 0 },
            { type: 'memo', label: 'メモ', icon: 'fa-note-sticky', count: typeCounts.memo || 0 },
            { type: 'task', label: '定期', icon: 'fa-wrench', count: typeCounts.task || 0 }
        ];
        this.openModal('shift-notebook-search', `横断検索: ${this.escapeHtml(query)} / ${range.label} (${results.length}件)`, () => {
            const modalContainer = document.getElementById('modal-container');
            if (modalContainer) modalContainer.classList.add('shift-notebook-modal', 'shift-notebook-search-modal');
            const content = document.getElementById('modal-content');
            const resultHtml = results.length === 0 ? `
                <div class="notebook-search-empty">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <div>該当する情報はありません。</div>
                </div>
            ` : results.map(result => {
                if (result.type !== 'notebook') {
                    const iconMap = {
                        memo: 'fa-note-sticky',
                        history: result.historyKind === 'periodic' ? 'fa-circle-check' : (result.historyKind === 'dokatei' ? 'fa-triangle-exclamation' : (result.historyKind === 'nonProductionStop' ? 'fa-circle-pause' : 'fa-bolt-lightning')),
                        guide: 'fa-book-open',
                        task: 'fa-wrench',
                        todo: 'fa-list-check'
                    };
                    const resultKey = result.resultKey || `${result.type}:${result.date || ''}:${result.title || ''}`;
                    const isOpened = openedKeys.has(resultKey);
                    return `
                        <article class="notebook-search-result unified ${this.escapeHtml(result.type)} ${isOpened ? 'opened' : ''}" data-search-type="${this.escapeHtml(result.type)}" data-result-key="${this.escapeHtml(resultKey)}" data-search-date="${this.escapeHtml(result.date || '')}" data-search-title="${this.escapeHtml(result.title || '')}">
                            <div class="notebook-search-meta">
                                <span class="unified-search-type ${this.escapeHtml(result.type)}"><i class="fa-solid ${iconMap[result.type] || 'fa-circle-info'}"></i> ${this.escapeHtml(result.typeLabel)}</span>
                                <div>
                                    <div class="notebook-search-date">${this.escapeHtml(result.date || '日付なし')} ${this.escapeHtml(result.title || '')}</div>
                                    ${result.sub ? `<div class="notebook-search-members">${this.escapeHtml(result.sub)}</div>` : ''}
                                    ${Array.isArray(result.tags) && result.tags.length ? `<div class="unified-search-tags">${result.tags.map(tag => `<span><i class="fa-solid fa-tag"></i> ${this.escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                                </div>
                                <span class="unified-search-opened-badge ${isOpened ? '' : 'hidden'}"><i class="fa-solid fa-check"></i> 確認済み</span>
                                ${result.hasGuide ? `<span class="unified-search-guide-badge"><i class="fa-solid fa-file-invoice"></i> 手順書あり</span>` : ''}
                                <div class="notebook-search-actions">
                                    ${result.secondaryAction ? `<button type="button" class="secondary-btn notebook-search-open" onclick="app.rememberAndOpenUnifiedSearchResult('${this.escapeJs(resultKey)}', '${this.escapeJs(query)}', '${this.escapeJs(period)}', '${this.escapeJs(result.secondaryAction)}')"><i class="fa-solid fa-clock-rotate-left"></i> ${this.escapeHtml(result.secondaryLabel || '関連')}</button>` : ''}
                                    ${result.openAction ? `<button type="button" class="secondary-btn notebook-search-open" onclick="app.rememberAndOpenUnifiedSearchResult('${this.escapeJs(resultKey)}', '${this.escapeJs(query)}', '${this.escapeJs(period)}', '${this.escapeJs(result.openAction)}')"><i class="fa-solid fa-arrow-up-right-from-square"></i> 開く</button>` : ''}
                                </div>
                            </div>
                            ${Array.isArray(result.matchLabels) && result.matchLabels.length ? `<div class="unified-search-match-labels">${result.matchLabels.map(label => `<span>${this.escapeHtml(label)}に一致</span>`).join('')}</div>` : ''}
                            <div class="notebook-search-body single">
                                <div class="notebook-search-text">
                                    ${this.highlightUnifiedSearchText(result.snippet || result.text || result.title || '', query)}
                                </div>
                            </div>
                        </article>
                    `;
                }
                const members = result.members.length ? result.members.join(', ') : 'メンバー未登録';
                const photos = result.photos.map(photo => {
                    const photoData = this.normalizeShiftNotebookPhoto(photo);
                    return `
                    <div class="notebook-search-photo-wrap">
                        <div class="notebook-search-photo img-box">
                            <img src="${photoData.src}" alt="">
                        </div>
                        ${photoData.caption ? `<div class="notebook-search-photo-caption">${this.escapeHtml(photoData.caption)}</div>` : ''}
                    </div>
                `;
                }).join('');
                const resultKey = result.resultKey || `notebook:${result.dateStr}:${result.shift}:${result.index}`;
                const isOpened = openedKeys.has(resultKey);
                return `
                    <article class="notebook-search-result ${isOpened ? 'opened' : ''}" data-search-type="notebook" data-result-key="${this.escapeHtml(resultKey)}" data-search-date="${this.escapeHtml(result.dateStr || '')}" data-search-title="${this.escapeHtml(result.text || result.group || '')}" style="${this.getShiftNotebookRowGroupStyle(result.group)}">
                        <div class="notebook-search-meta">
                            <span class="unified-search-type notebook"><i class="fa-solid fa-book-open"></i> 連絡帳</span>
                            <span class="shift-notebook-badge ${result.shift}">${result.label.stamp}</span>
                            <div>
                                <div class="notebook-search-date">${result.dateStr} ${result.label.name}</div>
                                <div class="notebook-search-members"><i class="fa-solid fa-users"></i> ${this.escapeHtml(members)}</div>
                            </div>
                            <span class="unified-search-opened-badge ${isOpened ? '' : 'hidden'}"><i class="fa-solid fa-check"></i> 確認済み</span>
                            <button type="button" class="secondary-btn notebook-search-open" onclick="app.markUnifiedSearchResultOpened('${this.escapeJs(resultKey)}'); app.rememberUnifiedSearchReturn('${this.escapeJs(query)}', '${this.escapeJs(period)}'); app.closeModal(); app.openShiftNotebookModal('${result.dateStr}', '${result.shift}', ${result.index}, '${query.replace(/'/g, "\\'")}')">
                                <i class="fa-solid fa-pen-to-square"></i> 開く
                            </button>
                        </div>
                        ${Array.isArray(result.matchLabels) && result.matchLabels.length ? `<div class="unified-search-match-labels">${result.matchLabels.map(label => `<span>${this.escapeHtml(label)}に一致</span>`).join('')}</div>` : ''}
                        <div class="notebook-search-body">
                            <div class="notebook-search-text">
                                <span class="shift-note-tag ${this.getShiftNotebookTagClass(result.tag)}">${this.escapeHtml(result.tag || '通常')}</span>
                                <span class="shift-row-group-badge">${this.escapeHtml(result.group || '未設定')}</span>
                                ${result.text ? this.highlightShiftNotebookSearchHtml(result.html || this.shiftNoteTextToHtml(result.text), query) : '<span class="muted">本文なし</span>'}
                            </div>
                            ${photos ? `<div class="notebook-search-photos">${photos}</div>` : ''}
                        </div>
                    </article>
                `;
            }).join('');

            content.innerHTML = `
                <div class="notebook-search-summary">
                    <span><i class="fa-solid fa-magnifying-glass"></i> 検索語: <b>${this.escapeHtml(query)}</b></span>
                    <span><i class="fa-solid fa-calendar-days"></i> 期間: <b>${range.label}</b></span>
                    <span>${results.length}件</span>
                    <div class="notebook-search-sort">
                        <span>並び替え</span>
                        <button type="button" data-sort-mode="date" class="active" onclick="app.sortUnifiedSearchResults('date', this)">日付順</button>
                        <button type="button" data-sort-mode="type" onclick="app.sortUnifiedSearchResults('type', this)">種類順</button>
                        <button type="button" class="unified-search-reset-opened-btn" onclick="app.resetUnifiedSearchOpenedMarks()"><i class="fa-solid fa-rotate-left"></i> 確認済みリセット</button>
                    </div>
                </div>
                <div class="unified-search-classification">
                    ${classificationCards.map(card => `
                        <button type="button" class="${this.escapeHtml(card.type)} ${card.count ? '' : 'empty'}" onclick="app.filterUnifiedSearchTab('${card.type}', document.querySelector('.notebook-search-tabs button[data-search-tab=&quot;${card.type}&quot;]'))">
                            <i class="fa-solid ${card.icon}"></i>
                            <span>${this.escapeHtml(card.label)}</span>
                            <b>${card.count}</b>
                        </button>
                    `).join('')}
                </div>
                <div class="unified-search-targets">
                    <span><i class="fa-solid fa-sliders"></i> 検索対象</span>
                    ${targetTypes.map(([type, label]) => `
                        <label class="${restoredTypes.includes(type) ? 'active' : ''}">
                            <input type="checkbox" class="unified-search-target-check" value="${type}" ${restoredTypes.includes(type) ? 'checked' : ''} onchange="app.applyUnifiedSearchFilters()">
                            ${label}<b>${typeCounts[type] || 0}</b>
                        </label>
                    `).join('')}
                    <button type="button" class="secondary-btn unified-search-gap-btn" onclick="app.rememberUnifiedSearchReturn('${this.escapeJs(query)}', '${this.escapeJs(period)}'); app.openGuideGapList('${this.escapeJs(period)}')">
                        <i class="fa-solid fa-clipboard-question"></i> 手順書未整備 <b>${guideGapCount}</b>
                    </button>
                </div>
                <div class="notebook-search-tabs">
                    ${searchTabs.map(([type, label, count], index) => `
                        <button type="button" data-search-tab="${type}" class="${index === 0 ? 'active' : ''}" onclick="app.filterUnifiedSearchTab('${type}', this)">
                            ${label}<b>${count}</b>
                        </button>
                    `).join('')}
                </div>
                <div class="notebook-search-results">${resultHtml}</div>
            `;
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
            this.applyUnifiedSearchFilters();
            if (restoreState?.query === query && restoreState?.period === period) {
                const tabButton = document.querySelector(`.notebook-search-tabs button[data-search-tab="${this.escapeHtml(restoreState.activeTab || 'all')}"]`);
                if (tabButton) this.filterUnifiedSearchTab(restoreState.activeTab || 'all', tabButton);
                const sortButton = document.querySelector(`.notebook-search-sort button[data-sort-mode="${this.escapeHtml(restoreState.sort || 'date')}"]`);
                if (sortButton) this.sortUnifiedSearchResults(restoreState.sort || 'date', sortButton);
                const list = document.querySelector('.notebook-search-results');
                if (list) list.scrollTop = restoreState.scrollTop || 0;
                this._restoreUnifiedSearchState = null;
            }
        });
    }

    filterUnifiedSearchTab(type = 'all', button = null) {
        document.querySelectorAll('.notebook-search-tabs button').forEach(btn => btn.classList.toggle('active', btn === button));
        this.applyUnifiedSearchFilters();
    }

    applyUnifiedSearchFilters() {
        this.saveUnifiedSearchTargetTypes();
        const selectedTypes = new Set(this.getUnifiedSearchTargetTypes());
        const activeTab = document.querySelector('.notebook-search-tabs button.active')?.dataset.searchTab || 'all';
        document.querySelectorAll('.unified-search-targets label').forEach(label => {
            const input = label.querySelector('input');
            label.classList.toggle('active', !!input?.checked);
        });
        document.querySelectorAll('.notebook-search-result[data-search-type]').forEach(item => {
            const type = item.dataset.searchType || '';
            const typeAllowed = selectedTypes.has(type);
            const tabAllowed = activeTab === 'all' || activeTab === type;
            item.hidden = !typeAllowed || !tabAllowed;
        });
    }

    sortUnifiedSearchResults(mode = 'date', button = null) {
        if (button) {
            document.querySelectorAll('.notebook-search-sort button').forEach(btn => btn.classList.toggle('active', btn === button));
        }
        const list = document.querySelector('.notebook-search-results');
        if (!list) return;
        const priority = { history: 1, guide: 2, task: 3, todo: 4, notebook: 5, memo: 6 };
        const items = Array.from(list.querySelectorAll('.notebook-search-result[data-search-type]'));
        items.sort((a, b) => {
            if (mode === 'type') {
                const typeOrder = (priority[a.dataset.searchType] || 99) - (priority[b.dataset.searchType] || 99);
                if (typeOrder !== 0) return typeOrder;
            }
            const dateOrder = (b.dataset.searchDate || '').localeCompare(a.dataset.searchDate || '');
            if (dateOrder !== 0) return dateOrder;
            return (a.dataset.searchTitle || '').localeCompare(b.dataset.searchTitle || '', 'ja');
        });
        items.forEach(item => list.appendChild(item));
    }

    openShiftNotebookModal(dateStr, shift, focusRowIndex = null, focusQuery = '') {
        this._activeShiftNoteEditor = null;
        const label = this.getShiftNotebookLabel(shift);
        if (!store.activeData.shiftNotebooks) store.activeData.shiftNotebooks = {};
        if (!store.activeData.shiftNotebookGroupPresets) store.activeData.shiftNotebookGroupPresets = [];
        const dayData = store.activeData.shiftNotebooks[dateStr] || {};
        const { rows, members, absentMembers, inheritedMembers, inheritedFrom } = this.getShiftNotebookRowsForShift(dayData, shift);
        const [year, month, day] = dateStr.split('-');
        this._editingShiftNotebook = { dateStr, shift };
        this._shiftNotebookAbsentMembers = [...(absentMembers || [])];
        this._shiftNotebookWeekGroupBase = null;
        this._shiftNotebookHideChecked = localStorage.getItem('shift_notebook_hide_checked') === 'true';
        this._shiftNotebookImportantOnly = localStorage.getItem('shift_notebook_important_only') === 'true';

        this.openModal('shift-notebook', `${month}/${day} ${label.name}の連絡帳`, () => {
            const modalContainer = document.getElementById('modal-container');
            if (modalContainer) {
                modalContainer.classList.add('shift-notebook-modal');
                modalContainer.classList.toggle('shift-compact-row-mode', !!this._shiftNotebookCompactRows);
            }
            const modalHeader = modalContainer?.querySelector('.modal-header');
            const modalTitle = modalHeader?.querySelector('h3');
            if (modalHeader && modalTitle) {
                modalHeader.classList.add('shift-notebook-modal-header');
                modalTitle.insertAdjacentHTML('beforeend', this.getShiftNotebookGuideThumbsHtml());
                modalTitle.insertAdjacentHTML('afterend', `
                    <div class="notebook-search-bar shift-modal-search-bar">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="text" id="shift-modal-unified-search" placeholder="履歴・手順書・連絡帳・ToDoを検索...">
                        <select id="shift-modal-unified-search-period" title="検索期間">
                            <option value="all">全期間</option>
                            <option value="today">今日</option>
                            <option value="yesterday">昨日</option>
                            <option value="yesterday_today">昨日と今日</option>
                            <option value="this_month">今月</option>
                            <option value="last_month">先月</option>
                            <option value="this_year">今年</option>
                            <option value="last_year">去年</option>
                        </select>
                        <button type="button" title="連絡帳・メモ・履歴・定期メンテを検索" onclick="app.openShiftModalUnifiedSearch()"><i class="fa-solid fa-magnifying-glass"></i></button>
                    </div>
                `);
            }
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="shift-notebook-toolbar">
                    <div class="shift-notebook-toolbar-row shift-notebook-toolbar-main">
                        <span class="shift-notebook-badge ${shift}">${label.stamp}</span>
                        <span class="shift-notebook-date">${year}/${month}/${day}</span>
                        <div class="shift-notebook-nav">
                            <button type="button" class="icon-btn shift-notebook-nav-btn" title="クリック: 前のシフト / ダブルクリック: 前の入力済み" onclick="app.handleShiftNotebookPrevClick(event)" ondblclick="app.handleShiftNotebookPrevDoubleClick(event)">
                                <i class="fa-solid fa-caret-left"></i>
                            </button>
                            <button type="button" class="icon-btn shift-notebook-nav-btn" title="クリック: 次のシフト / 長押し: 次の入力済み" onpointerdown="app.startShiftNotebookNextHold(event)" onpointerup="app.finishShiftNotebookNextHold(event)" onpointerleave="app.cancelShiftNotebookNextHold()" onpointercancel="app.cancelShiftNotebookNextHold()" onclick="app.moveShiftNotebookToNextShift()">
                                <i class="fa-solid fa-caret-right"></i>
                            </button>
                        </div>
                        <div class="shift-group-panel" style="align-items: flex-start;">
                            <label class="shift-group-label" style="margin-top: 8px;">グループ</label>
                            <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
                                <input type="text" id="shift-group-members" class="shift-group-input" value="${this.escapeHtml(members.join(', '))}" placeholder="メンバーをカンマ区切りで入力" oninput="app.clearShiftNotebookWeekGroupBase(); app.updateShiftGroupChant(); app.scheduleShiftNotebookAutoSave()" onchange="app.autoSaveShiftNotebook(true)">
                                ${inheritedMembers ? `<div class="shift-group-inherited-note">週内引き継ぎ: ${this.escapeHtml(inheritedFrom || '週頭')}から自動表示中。編集・保存するとこの日の入力になります。</div>` : ''}
                                <div id="shift-group-chant-display" class="shift-group-chant-display"></div>
                                <div id="shift-absence-manage" class="shift-absence-manage hidden"></div>
                            </div>
                        </div>
                        <div class="shift-preset-panel">
                            <div class="shift-toolbar-group">
                                <span class="shift-toolbar-category">プリセット</span>
                                <select id="shift-group-preset" class="shift-preset-select" onchange="app.applyShiftGroupPreset(this.value)">
                                    <option value="">プリセット</option>
                                    <option value="__previous_day__">前日と同じ</option>
                                    ${store.activeData.shiftNotebookGroupPresets.map((p, idx) => `<option value="${idx}">${this.escapeHtml(p.name)}</option>`).join('')}
                                </select>
                                <button type="button" class="secondary-btn shift-absence-btn" onclick="app.removeShiftAbsentMember()">
                                    <i class="fa-solid fa-user-minus"></i> 欠員
                                </button>
                                <button type="button" class="secondary-btn shift-preset-save" onclick="app.saveShiftGroupPreset()">
                                    <i class="fa-solid fa-bookmark"></i> 登録
                                </button>
                                <button type="button" class="secondary-btn shift-preset-manage" onclick="app.editShiftGroupPreset()">
                                    <i class="fa-solid fa-pen"></i> 編集
                                </button>
                                <button type="button" class="secondary-btn shift-preset-delete" onclick="app.deleteShiftGroupPreset()">
                                    <i class="fa-solid fa-trash-can"></i> 削除
                                </button>
                            </div>
                            <div class="shift-toolbar-group">
                                <span class="shift-toolbar-category">管理</span>
                                <button type="button" class="secondary-btn shift-notebook-settings-btn" onclick="app.openShiftNotebookSettingsPanel()">
                                    <i class="fa-solid fa-sliders"></i> 連絡帳設定
                                </button>
                                <button type="button" class="secondary-btn shift-member-type-manage" onclick="app.openShiftMemberTypeManageModal()">
                                    <i class="fa-solid fa-users-gear"></i> 人名管理
                                </button>
                                <button type="button" class="secondary-btn shift-row-group-order-btn" onclick="app.openShiftRowGroupOrderModal()">
                                    <i class="fa-solid fa-arrow-up-wide-short"></i> 順序
                                </button>
                            </div>
                            <div class="shift-toolbar-group shift-toolbar-group-view">
                                <span class="shift-toolbar-category">絞り込み</span>
                                <button type="button" id="shift-hide-checked-btn" class="secondary-btn shift-hide-checked-btn" onclick="app.toggleShiftNotebookHiddenRows()" title="チェックした行だけ一時的に隠します。削除はしません。">
                                    ☑ チェック非表示
                                </button>
                                <button type="button" id="shift-important-only-btn" class="secondary-btn shift-important-only-btn" onclick="app.toggleShiftNotebookImportantOnly()" title="重要スタンプの行だけに絞り込みます。">
                                    重 重要だけ
                                </button>
                                <button type="button" id="shift-clear-row-filters-btn" class="secondary-btn shift-clear-row-filters-btn" onclick="app.clearShiftNotebookRowFilters()" title="チェック非表示・重要だけ表示を解除します。" hidden>
                                    絞り込み解除
                                </button>
                                <button type="button" id="shift-row-menu-toggle-btn" class="secondary-btn shift-row-menu-toggle-btn" onclick="app.toggleShiftNotebookRowMenus()" title="各行のグループ・装飾・右側ボタン群を非表示にします。">
                                    行メニュー設定
                                </button>
                                <div id="shift-row-menu-settings-panel" class="shift-row-menu-settings-panel" hidden>
                                    <button type="button" class="shift-row-menu-settings-close" title="閉じる" onclick="app.closeShiftNotebookRowMenuSettings()">×</button>
                                    <label><input type="checkbox" data-part="group" onchange="app.setShiftNotebookRowMenuHiddenPart('group', this.checked)"> グループ</label>
                                    <label><input type="checkbox" data-part="format" onchange="app.setShiftNotebookRowMenuHiddenPart('format', this.checked)"> 装飾</label>
                                    <label><input type="checkbox" data-part="actions" onchange="app.setShiftNotebookRowMenuHiddenPart('actions', this.checked)"> 右側ボタン</label>
                                    <div class="shift-row-menu-settings-actions">
                                        <button type="button" onclick="app.setAllShiftNotebookRowMenuHiddenParts(true)">全部隠す</button>
                                        <button type="button" onclick="app.setAllShiftNotebookRowMenuHiddenParts(false)">全部表示</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="shift-notebook-toolbar-row shift-notebook-toolbar-actions">
                        <div class="shift-toolbar-group shift-toolbar-group-input">
                            <span class="shift-toolbar-category">入力</span>
                            <div id="shift-row-group-stamps" class="shift-row-group-stamps" aria-label="行グループスタンプ">
                                <span class="shift-row-group-stamps-label">行挿入用看板（ドラッグして行挿入）</span>
                                ${this.getShiftRowGroupStampButtonsHtml()}
                            </div>
                            <button type="button" class="secondary-btn" onclick="app.addShiftNotebookRowWithLastGroup('shift-notebook-rows')">
                                <i class="fa-solid fa-plus"></i> 行を追加
                            </button>
                            <select id="shift-row-template-select" class="shift-row-template-select" onchange="app.addShiftNotebookRowFromTemplate(this.value); this.value=''">
                                ${this.getShiftRowTemplateOptions()}
                            </select>
                            <button type="button" class="secondary-btn" onclick="app.togglePreviousShiftRowsPanel()">
                                <i class="fa-solid fa-copy"></i> 前シフトからコピー
                            </button>
                            <button type="button" id="shift-remove-blank-rows-btn" class="secondary-btn shift-remove-blank-rows-btn" onclick="app.confirmUnusedBlankShiftNotebookRows()" onmouseenter="app.highlightUnusedBlankShiftNotebookRows(true)" onmouseleave="app.highlightUnusedBlankShiftNotebookRows(false)" title="本文・写真・重要マークがない未使用の空白行だけ削除します">
                                <i class="fa-solid fa-broom"></i> 未使用行削除 <span id="shift-remove-blank-rows-count" class="shift-blank-row-count">0</span>
                            </button>
                        </div>
                        <div class="shift-toolbar-group shift-toolbar-group-organize">
                            <span class="shift-toolbar-category">整理</span>
                            <button type="button" class="secondary-btn shift-clear-all-rows-btn" onclick="app.clearShiftNotebookRows()" title="現在表示中の全ての行を削除します">
                                <i class="fa-solid fa-trash-can"></i> 一括削除
                            </button>
                            <button type="button" class="secondary-btn shift-row-set-template-save" onclick="app.saveShiftNotebookRowSetTemplate()">
                                <i class="fa-solid fa-layer-group"></i> 行セット保存
                            </button>
                            <button type="button" class="secondary-btn" onclick="app.openShiftRowTemplateManageModal()">
                                <i class="fa-solid fa-list-check"></i> テンプレート管理
                            </button>
                        </div>
                        <div class="shift-toolbar-group shift-toolbar-group-view">
                            <span class="shift-toolbar-category">レイアウト</span>
                            <button type="button" id="shift-compact-rows-btn" class="secondary-btn shift-compact-rows-btn ${this._shiftNotebookCompactRows ? 'active' : ''}" onclick="app.toggleShiftNotebookCompactRows()" title="行の高さを詰めて表示します">
                                <i class="fa-solid fa-compress"></i> ${this._shiftNotebookCompactRows ? '標準表示' : '省スペース'}
                            </button>
                            <button type="button" id="shift-fit-all-btn" class="secondary-btn shift-fit-all-btn" onclick="app.toggleShiftNotebookFitAll()" title="行全体が画面内に収まるように縮小表示します">
                                <i class="fa-solid fa-compress"></i> 全行を収める
                            </button>
                        </div>
                    </div>
                </div>
                <div id="shift-row-filter-banner" class="shift-row-filter-banner" hidden></div>
                <div id="shift-previous-copy-panel" class="shift-previous-copy-panel hidden"></div>
                <div id="shift-notebook-rows" class="shift-notebook-rows"></div>
            `;

            document.querySelector('.shift-notebook-toolbar-actions')?.insertAdjacentHTML('beforeend', this.getShiftNotebookLivePasteRulerHtml());
            this.updateShiftNotebookLivePasteLines();
            this.updateShiftNotebookBreakLineVisibility();

            const rowContainerId = 'shift-notebook-rows';
            if (rows.length > 0) {
                this.addShiftNotebookRow(rowContainerId, '', [], '通常', '未設定', '', false, false);
                document.querySelector('#shift-notebook-rows .shift-notebook-row:last-child')?.remove();
                const sortableRows = rows.map((row, index) => ({ ...row, _sourceIndex: index }));
                this.sortShiftNotebookRows(sortableRows).forEach(row => {
                    const rowEl = this.addShiftNotebookRow(rowContainerId, row.text || '', row.photos || [], row.tag || '通常', row.group || '未設定', row.html || '', !!row.hidden, true, row.id || '', row.replyTo || '', !!row.important, row.pasteFormat || null, !!row.suddenRegistered, row.suddenHistoryId || '', !!row.fiveS, row.photoCompareMarks || [], row.fiveSAssigneeId || '');
                    if (rowEl) rowEl.dataset.shiftSourceIndex = String(row._sourceIndex);
                    if (rowEl && row.suddenRegistered) {
                        rowEl.classList.add('shift-row-sudden-registered');
                        rowEl.dataset.suddenRegistered = 'true';
                        if (row.suddenHistoryId) rowEl.dataset.suddenHistoryId = row.suddenHistoryId;
                    }
                });
            }
            this.updateShiftNotebookLivePasteLines();
            this.updateShiftNotebookGroupCorners();
            this.updateShiftNotebookHiddenRows();
            this.updateShiftNotebookRowMenuVisibility();
            this.updateUnusedBlankShiftNotebookRowCount();
            requestAnimationFrame(() => {
                document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => this.positionShiftImportantStamp(row));
            });
            this.setupShiftRowGroupStampDropZone();
            this.setupShiftModalUnifiedSearch();

            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.style.display = 'none';
            const cancelBtn = modalContainer.querySelector('.modal-footer .secondary-btn');
            if (cancelBtn) {
                cancelBtn.innerHTML = '<i class="fa-solid fa-check"></i> 閉じる';
                cancelBtn.style.width = '100%';
                cancelBtn.style.maxWidth = '300px';
                cancelBtn.style.margin = '0 auto';
                cancelBtn.className = 'primary-btn';
            }
            this.scheduleShiftNotebookAutoSave();
            setTimeout(() => this.updateShiftGroupChant(), 50);
            if (focusRowIndex !== null && focusRowIndex !== undefined) {
                setTimeout(() => this.focusShiftNotebookRowByIndex(focusRowIndex, focusQuery), 120);
            }
        });
    }

    toggleShiftNotebookFitAll() {
        const modal = document.querySelector('.modal-container.shift-notebook-modal');
        const body = modal?.querySelector('.modal-body');
        const button = document.getElementById('shift-fit-all-btn');
        if (!modal || !body) return;
        if (modal.classList.contains('shift-fit-all-mode')) {
            modal.classList.remove('shift-fit-all-mode');
            modal.style.removeProperty('--shift-fit-scale');
            button?.classList.remove('active');
            requestAnimationFrame(() => {
                document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => this.positionShiftImportantStamp(row));
            });
            if (button) button.innerHTML = '<i class="fa-solid fa-compress"></i> 全行を収める';
            return;
        }

        modal.classList.add('shift-fit-all-mode');
        button?.classList.add('active');
        if (button) button.innerHTML = '<i class="fa-solid fa-up-right-and-down-left-from-center"></i> 元に戻す';
        this.adjustShiftNotebookRowsToFit();
    }

    toggleShiftNotebookCompactRows() {
        this._shiftNotebookCompactRows = !this._shiftNotebookCompactRows;
        localStorage.setItem('shift_notebook_compact_rows', String(this._shiftNotebookCompactRows));
        const modal = document.querySelector('.modal-container.shift-notebook-modal');
        const button = document.getElementById('shift-compact-rows-btn');
        modal?.classList.toggle('shift-compact-row-mode', this._shiftNotebookCompactRows);
        if (button) {
            button.classList.toggle('active', this._shiftNotebookCompactRows);
            button.innerHTML = `<i class="fa-solid fa-compress"></i> ${this._shiftNotebookCompactRows ? '標準表示' : '省スペース'}`;
        }
        document.querySelectorAll('#shift-notebook-rows .shift-note-text').forEach(editor => this.resizeShiftNoteEditor(editor));
        if (modal?.classList.contains('shift-fit-all-mode')) this.adjustShiftNotebookRowsToFit();
        else requestAnimationFrame(() => {
            document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => this.positionShiftImportantStamp(row));
        });
        this.setShiftNotebookStatus(this._shiftNotebookCompactRows ? '省スペース表示にしました' : '標準表示に戻しました', 'moved');
    }

    adjustShiftNotebookRowsToFit() {
        const modal = document.querySelector('.modal-container.shift-notebook-modal.shift-fit-all-mode');
        const body = modal?.querySelector('.modal-body');
        const rows = document.getElementById('shift-notebook-rows');
        if (!modal || !body || !rows) return;
        let scale = 1;
        modal.style.setProperty('--shift-fit-scale', String(scale));

        const fitOnce = () => {
            const available = Math.max(240, body.clientHeight - 4);
            const needed = Math.max(rows.offsetTop + rows.scrollHeight, body.scrollHeight);
            if (needed <= available) return true;
            scale = Math.max(0.48, Math.min(1, scale * (available / needed) * 0.98));
            modal.style.setProperty('--shift-fit-scale', scale.toFixed(3));
            return scale <= 0.48;
        };

        requestAnimationFrame(() => {
            let done = false;
            let count = 0;
            const step = () => {
                done = fitOnce();
                document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => this.positionShiftImportantStamp(row));
                count += 1;
                if (!done && count < 6) requestAnimationFrame(step);
            };
            step();
        });
    }

    setupShiftModalUnifiedSearch() {
        const input = document.getElementById('shift-modal-unified-search');
        if (!input) return;
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.openShiftModalUnifiedSearch();
        });
    }

    openShiftModalUnifiedSearch() {
        const input = document.getElementById('shift-modal-unified-search');
        const period = document.getElementById('shift-modal-unified-search-period')?.value || 'all';
        const query = input?.value || '';
        if (this._editingShiftNotebook) {
            this.saveShiftNotebook(this._editingShiftNotebook.dateStr, this._editingShiftNotebook.shift, { close: false, render: true, status: false });
        }
        this.openShiftNotebookSearchResults(query, period);
    }

    focusShiftNotebookRowByIndex(index, query = '') {
        const row = document.querySelector(`#shift-notebook-rows .shift-notebook-row[data-shift-source-index="${index}"]`);
        if (!row) return;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('shift-row-highlight');
        this.highlightShiftNotebookEditorSearchTerms(row, query);
        row.querySelector('.shift-note-text')?.focus();
        setTimeout(() => {
            row.classList.remove('shift-row-highlight');
            this.clearShiftNotebookEditorSearchMarks(row);
        }, 4200);
    }

    clearShiftNotebookEditorSearchMarks(row) {
        row?.querySelectorAll('mark.shift-editor-search-mark').forEach(mark => {
            mark.replaceWith(document.createTextNode(mark.textContent || ''));
        });
        row?.normalize();
    }

    highlightShiftNotebookEditorSearchTerms(row, query = '') {
        const editor = row?.querySelector('.shift-note-text');
        const terms = (query || '').trim().split(/[\s　]+/).filter(Boolean);
        if (!editor || terms.length === 0) return;
        this.clearShiftNotebookEditorSearchMarks(row);

        const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        textNodes.forEach(node => {
            const value = node.nodeValue || '';
            if (!regex.test(value)) {
                regex.lastIndex = 0;
                return;
            }
            regex.lastIndex = 0;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            value.replace(regex, (match, _group, offset) => {
                if (offset > lastIndex) fragment.appendChild(document.createTextNode(value.slice(lastIndex, offset)));
                const mark = document.createElement('mark');
                mark.className = 'shift-editor-search-mark';
                mark.textContent = match;
                fragment.appendChild(mark);
                lastIndex = offset + match.length;
                return match;
            });
            if (lastIndex < value.length) fragment.appendChild(document.createTextNode(value.slice(lastIndex)));
            node.parentNode?.replaceChild(fragment, node);
        });
        editor._savedRange = null;
    }

    setShiftNotebookStatus(message, mode = 'saved') {
        const status = document.getElementById('shift-notebook-status');
        if ((mode === 'moved' || mode === 'error') && document.querySelector('.shift-notebook-modal')) {
            this.showShiftNotebookNotice(message, mode);
        }
        if (!status) return;
        const icons = { saving: 'fa-spinner fa-spin', saved: 'fa-check', moved: 'fa-circle-info', error: 'fa-triangle-exclamation' };
        status.className = `shift-notebook-status ${mode}`;
        status.innerHTML = `<i class="fa-solid ${icons[mode] || icons.saved}"></i> ${this.escapeHtml(message)}`;
        clearTimeout(this._shiftNotebookStatusTimer);
        if (mode === 'moved' || mode === 'saved') {
            this._shiftNotebookStatusTimer = setTimeout(() => {
                if (document.getElementById('shift-notebook-status') === status) {
                    status.className = 'shift-notebook-status saved';
                    status.innerHTML = '<i class="fa-solid fa-check"></i> 保存済み';
                }
            }, 1600);
        }
    }

    showShiftNotebookNotice(message, mode = 'moved') {
        const container = document.getElementById('modal-container');
        if (!container) return;
        container.querySelectorAll('.shift-notebook-notice').forEach(el => el.remove());
        const notice = document.createElement('div');
        notice.className = `shift-notebook-notice ${mode}`;
        const icons = { moved: 'fa-circle-info', saved: 'fa-check', saving: 'fa-spinner fa-spin', error: 'fa-triangle-exclamation' };
        notice.innerHTML = `<i class="fa-solid ${icons[mode] || icons.moved}"></i> ${this.escapeHtml(message)}`;
        container.appendChild(notice);
        requestAnimationFrame(() => notice.classList.add('show'));
        setTimeout(() => {
            notice.classList.remove('show');
            setTimeout(() => notice.remove(), 220);
        }, 1400);
    }

    showUndoNotice(message, undoCallback, expireCallback, container = document.body, variant = '', options = {}) {
        if (!container) return;
        container.querySelectorAll('.shift-notebook-undo-toast').forEach(el => el.remove());
        const toast = document.createElement('div');
        toast.className = `shift-notebook-undo-toast ${variant}`.trim();
        const icon = variant === 'paste-format' ? 'fa-rotate-left' : 'fa-trash-can';
        const duration = Math.max(1, Number(options.duration) || 5);
        const extraAction = options.extraAction || null;
        toast.innerHTML = `
            <span><i class="fa-solid ${icon}"></i> ${this.escapeHtml(message)}</span>
            <span class="undo-countdown">5秒</span>
            <button type="button">取り消す</button>
        `;
        const countdown = toast.querySelector('.undo-countdown');
        if (countdown) countdown.textContent = `${duration}秒`;
        if (extraAction) {
            const extraButton = document.createElement('button');
            extraButton.type = 'button';
            extraButton.className = 'undo-extra-action';
            extraButton.textContent = extraAction.label || '実行';
            countdown?.after(extraButton);
        }
        let remaining = duration;
        const interval = setInterval(() => {
            remaining -= 1;
            if (countdown) countdown.textContent = `${Math.max(0, remaining)}秒`;
            if (remaining <= 0) clearInterval(interval);
        }, 1000);
        const timer = setTimeout(() => {
            clearInterval(interval);
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 220);
            expireCallback?.();
        }, duration * 1000);
        toast.querySelector('.undo-extra-action')?.addEventListener('click', () => {
            clearTimeout(timer);
            clearInterval(interval);
            toast.remove();
            extraAction?.callback?.();
        });
        toast.querySelector('button:not(.undo-extra-action)')?.addEventListener('click', () => {
            clearTimeout(timer);
            clearInterval(interval);
            toast.remove();
            undoCallback?.();
        });
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
    }

    showShiftNotebookUndoNotice(message, undoCallback) {
        this.showUndoNotice(message, undoCallback, null, document.getElementById('modal-container') || document.body);
    }

    getShiftNotebookRowDataFromElement(row) {
        if (!row) return null;
        const editor = row.querySelector('.shift-note-text');
        const html = this.sanitizeShiftNoteHtml(editor?.innerHTML || '');
        const text = this.stripShiftNoteHtml(html).trim();
        const pasteFormat = this.getShiftNoteRowPasteFormatSettings(row);
        const photos = Array.from(row.querySelectorAll('.shift-photo-previews .shift-photo-item')).map(item => {
            const src = item.querySelector('img')?.src || '';
            const caption = item.querySelector('.shift-photo-caption')?.value.trim() || '';
            const marks = this.parseShiftPhotoCompareMarks(item.dataset.shiftPhotoMarks || '[]');
            return (caption || marks.length) ? { src, caption, marks } : src;
        }).filter(photo => typeof photo === 'string' ? !!photo : !!photo.src);
        return {
            id: row.dataset.shiftRowId || '',
            replyTo: row.dataset.replyTo || '',
            group: row.querySelector('.shift-row-group-select')?.value || '未設定',
            tag: row.querySelector('.shift-note-tag-select')?.value || '通常',
            text,
            html,
            photos,
            photoCompareMarks: this.parseShiftPhotoCompareMarks(row.dataset.shiftPhotoGlobalMarks || '[]'),
            hidden: !!row.querySelector('.shift-row-hide-checkbox')?.checked,
            important: row.classList.contains('shift-row-important'),
            fiveS: row.classList.contains('shift-row-5s'),
            fiveSAssigneeId: row.dataset.fiveSAssigneeId || '',
            suddenRegistered: row.dataset.suddenRegistered === 'true',
            suddenHistoryId: row.dataset.suddenHistoryId || '',
            pasteFormat
        };
    }

    getShiftNotebookDateKey(dateStr, shift) {
        const order = { early: 0, late: 1, night: 2 };
        return `${dateStr}#${order[shift] ?? 0}`;
    }

    getNextShiftNotebookTarget(dateStr, shift) {
        const order = ['early', 'late', 'night'];
        const idx = order.indexOf(shift);
        if (idx >= 0 && idx < order.length - 1) {
            return { dateStr, shift: order[idx + 1] };
        }
        const d = new Date(dateStr);
        d.setDate(d.getDate() + 1);
        const nextDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { dateStr: nextDate, shift: 'early' };
    }

    getPreviousShiftNotebookTarget(dateStr, shift) {
        const order = ['early', 'late', 'night'];
        const idx = order.indexOf(shift);
        if (idx > 0) {
            return { dateStr, shift: order[idx - 1] };
        }
        const d = new Date(dateStr);
        d.setDate(d.getDate() - 1);
        const previousDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { dateStr: previousDate, shift: 'night' };
    }

    getPreviousFilledShiftNotebookTarget(dateStr, shift) {
        const notebooks = store.activeData.shiftNotebooks || {};
        const currentKey = this.getShiftNotebookDateKey(dateStr, shift);
        const candidates = [];
        Object.keys(notebooks).forEach(d => {
            ['early', 'late', 'night'].forEach(s => {
                const dayData = notebooks[d] || {};
                const notebookData = dayData[s];
                if (!notebookData && !(Array.isArray(dayData.sharedRows) && dayData.sharedRows.length > 0)) return;
                const { rows, members, inheritedMembers } = this.getShiftNotebookRowsForShift(dayData, s);
                const hasRows = (rows || []).some(row => (row?.text || '').trim() || (Array.isArray(row?.photos) && row.photos.length > 0));
                const hasMembers = !inheritedMembers && (members || []).length > 0;
                const key = this.getShiftNotebookDateKey(d, s);
                if ((hasRows || hasMembers) && key < currentKey) candidates.push({ dateStr: d, shift: s, key });
            });
        });
        candidates.sort((a, b) => b.key.localeCompare(a.key));
        return candidates[0] || null;
    }

    getNextFilledShiftNotebookTarget(dateStr, shift) {
        const notebooks = store.activeData.shiftNotebooks || {};
        const currentKey = this.getShiftNotebookDateKey(dateStr, shift);
        const candidates = [];
        Object.keys(notebooks).forEach(d => {
            ['early', 'late', 'night'].forEach(s => {
                const dayData = notebooks[d] || {};
                const notebookData = dayData[s];
                if (!notebookData && !(Array.isArray(dayData.sharedRows) && dayData.sharedRows.length > 0)) return;
                const { rows, members, inheritedMembers } = this.getShiftNotebookRowsForShift(dayData, s);
                const hasRows = (rows || []).some(row => (row?.text || '').trim() || (Array.isArray(row?.photos) && row.photos.length > 0));
                const hasMembers = !inheritedMembers && (members || []).length > 0;
                const key = this.getShiftNotebookDateKey(d, s);
                if ((hasRows || hasMembers) && key > currentKey) candidates.push({ dateStr: d, shift: s, key });
            });
        });
        candidates.sort((a, b) => a.key.localeCompare(b.key));
        return candidates[0] || null;
    }

    startShiftNotebookNextHold(event) {
        this._shiftNotebookNextLongPressed = false;
        clearTimeout(this._shiftNotebookNextHoldTimer);
        this._shiftNotebookNextHoldTimer = setTimeout(() => {
            this._shiftNotebookNextLongPressed = true;
            const editing = this._editingShiftNotebook;
            if (editing) this.moveShiftNotebookToTarget(this.getNextFilledShiftNotebookTarget(editing.dateStr, editing.shift));
        }, 650);
    }

    cancelShiftNotebookNextHold() {
        clearTimeout(this._shiftNotebookNextHoldTimer);
    }

    finishShiftNotebookNextHold(event) {
        clearTimeout(this._shiftNotebookNextHoldTimer);
        if (this._shiftNotebookNextLongPressed) {
            event?.preventDefault();
            event?.stopPropagation();
            setTimeout(() => { this._shiftNotebookNextLongPressed = false; }, 0);
        }
    }

    updateShiftGroupChant() {
        const input = document.getElementById('shift-group-members');
        const display = document.getElementById('shift-group-chant-display');
        const editing = this._editingShiftNotebook;
        if (!input || !display || !editing) return;
        
        const members = input.value.split(',').map(m => m.trim()).filter(Boolean);
        const absentMembers = Array.isArray(this._shiftNotebookAbsentMembers) ? this._shiftNotebookAbsentMembers : [];
        const absentHtml = absentMembers.length ? `
            <div class="shift-absent-display">
                <span>欠員</span>
                ${absentMembers.map(name => `<b>${this.escapeHtml(name)}</b>`).join('')}
            </div>
        ` : '';
        if (members.length === 0) {
            display.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-light);">※メンバーを入力すると安全唱和の担当者が自動で割り当てられます</span>' + absentHtml;
            const absencePanel = document.getElementById('shift-absence-manage');
            if (absencePanel) absencePanel.innerHTML = '';
            return;
        }
        
        const [y, m, d] = editing.dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const daysSinceEpoch = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
        const turnIndex = daysSinceEpoch % members.length;
        
        display.innerHTML = members.map((m, i) => {
            const isTurn = i === turnIndex;
            const memberType = this.getShiftMemberType(m);
            return `<span class="shift-member-stamp ${memberType} ${isTurn ? 'active' : ''}" draggable="true" ondragstart="app.startShiftMemberStampDrag(event, '${this.escapeJs(m)}')" ondragend="app.finishShiftMemberStampDrag()" title="${this.escapeHtml(this.getShiftMemberTypeLabel(memberType))}">${this.escapeHtml(m)}</span>`;
        }).join('') + absentHtml;

        const absencePanel = document.getElementById('shift-absence-manage');
        if (absencePanel && !absencePanel.classList.contains('hidden')) {
            absencePanel.innerHTML = members.map(m => `
                <button type="button" class="shift-member-remove-chip" onclick="app.removeShiftMemberByName('${m.replace(/'/g, "\\'")}')">
                    ${this.escapeHtml(m)} <i class="fa-solid fa-xmark"></i>
                </button>
            `).join('');
        }
    }

    moveShiftNotebookToTarget(target) {
        if (!target) {
            this.setShiftNotebookStatus('移動先がありません', 'error');
            return;
        }
        const editing = this._editingShiftNotebook;
        if (editing) this.saveShiftNotebook(editing.dateStr, editing.shift, { close: false, render: false });
        this.closeModal();
        this.openShiftNotebookModal(target.dateStr, target.shift);
        setTimeout(() => this.setShiftNotebookStatus('移動しました', 'moved'), 120);
    }

    moveShiftNotebookToPreviousFilled() {
        const editing = this._editingShiftNotebook;
        if (!editing) return;
        this.moveShiftNotebookToTarget(this.getPreviousFilledShiftNotebookTarget(editing.dateStr, editing.shift));
    }

    moveShiftNotebookToPreviousShift() {
        const editing = this._editingShiftNotebook;
        if (!editing) return;
        this.moveShiftNotebookToTarget(this.getPreviousShiftNotebookTarget(editing.dateStr, editing.shift));
    }

    handleShiftNotebookPrevClick(event) {
        clearTimeout(this._shiftNotebookPrevClickTimer);
        this._shiftNotebookPrevClickTimer = setTimeout(() => {
            this.moveShiftNotebookToPreviousShift();
        }, 220);
    }

    handleShiftNotebookPrevDoubleClick(event) {
        event?.preventDefault();
        event?.stopPropagation();
        clearTimeout(this._shiftNotebookPrevClickTimer);
        this.moveShiftNotebookToPreviousFilled();
    }

    moveShiftNotebookToNextShift() {
        if (this._shiftNotebookNextLongPressed) return;
        const editing = this._editingShiftNotebook;
        if (!editing) return;
        this.moveShiftNotebookToTarget(this.getNextShiftNotebookTarget(editing.dateStr, editing.shift));
    }

    getShiftGroupMembersFromInput() {
        const input = document.getElementById('shift-group-members');
        return (input?.value || '').split(',').map(v => v.trim()).filter(Boolean);
    }

    setShiftNotebookWeekGroupBase(members = []) {
        const editing = this._editingShiftNotebook;
        const normalized = (members || []).map(member => String(member || '').trim()).filter(Boolean);
        if (!editing || normalized.length === 0) {
            this._shiftNotebookWeekGroupBase = null;
            return;
        }
        this._shiftNotebookWeekGroupBase = {
            dateStr: editing.dateStr,
            shift: editing.shift,
            members: normalized
        };
    }

    clearShiftNotebookWeekGroupBase() {
        this._shiftNotebookWeekGroupBase = null;
        this._shiftNotebookAbsentMembers = [];
    }

    getShiftNotebookWeekGroupMembersForSync(currentMembers = []) {
        const editing = this._editingShiftNotebook;
        const base = this._shiftNotebookWeekGroupBase;
        if (!editing || !base || base.dateStr !== editing.dateStr || base.shift !== editing.shift) return currentMembers;
        const currentSet = new Set((currentMembers || []).map(member => MaintenanceStore.toHalfWidthLower(member)));
        const currentIsSubsetOfBase = (currentMembers || []).every(member =>
            (base.members || []).some(baseMember => MaintenanceStore.toHalfWidthLower(baseMember) === MaintenanceStore.toHalfWidthLower(member))
        );
        return currentIsSubsetOfBase && currentSet.size < (base.members || []).length ? base.members : currentMembers;
    }

    getShiftGroupPresetSavedMessage(dateStr) {
        const weekday = this.getShiftNotebookWeekday(dateStr);
        return weekday >= 1 && weekday <= 5 ? 'プリセット保存済み / 金曜まで反映済み' : 'プリセット保存済み';
    }

    saveShiftGroupPresetSelection(message = '') {
        const editing = this._editingShiftNotebook;
        if (!editing) return;
        clearTimeout(this._shiftNotebookAutoSaveTimer);
        this.setShiftNotebookStatus('保存中', 'saving');
        this.saveShiftNotebook(editing.dateStr, editing.shift, {
            close: false,
            render: true,
            status: true,
            statusMessage: message || this.getShiftGroupPresetSavedMessage(editing.dateStr),
            noticeMessage: message || this.getShiftGroupPresetSavedMessage(editing.dateStr)
        });
    }

    applyShiftGroupPreset(index) {
        if (index === '') return;
        if (index === '__previous_day__') {
            this.applyPreviousDayShiftGroup();
            return;
        }
        const preset = (store.activeData.shiftNotebookGroupPresets || [])[Number(index)];
        const input = document.getElementById('shift-group-members');
        if (!preset || !input) return;
        input.value = (preset.members || []).join(', ');
        this._shiftNotebookAbsentMembers = [];
        this.setShiftNotebookWeekGroupBase(preset.members || []);
        this.updateShiftGroupChant();
        this.saveShiftGroupPresetSelection(this.getShiftGroupPresetSavedMessage(this._editingShiftNotebook?.dateStr || ''));
        input.focus();
    }

    getPreviousDateStr(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() - 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    formatShiftNotebookDate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    getShiftNotebookWeekday(dateStr) {
        const [year, month, day] = String(dateStr || '').split('-').map(Number);
        if (!year || !month || !day) return -1;
        return new Date(year, month - 1, day).getDay();
    }

    isShiftNotebookInheritedOnly(notebookData) {
        if (!notebookData?.inheritedMembers) return false;
        const rows = Array.isArray(notebookData.rows) ? notebookData.rows : [];
        return rows.length === 0;
    }

    syncShiftNotebookWeekGroupPreset(dateStr, shift, members = []) {
        if (!dateStr || !shift || !Array.isArray(members) || members.length === 0) return;
        const weekday = this.getShiftNotebookWeekday(dateStr);
        if (weekday < 1 || weekday > 5) return;
        const [year, month, day] = dateStr.split('-').map(Number);
        const sourceDate = new Date(year, month - 1, day);
        const friday = new Date(sourceDate);
        friday.setDate(sourceDate.getDate() + (5 - weekday));
        const memberCopy = members.map(member => String(member || '').trim()).filter(Boolean);
        if (memberCopy.length === 0) return;

        if (!store.activeData.shiftNotebooks) store.activeData.shiftNotebooks = {};
        for (let d = new Date(sourceDate); d <= friday; d.setDate(d.getDate() + 1)) {
            const targetDateStr = this.formatShiftNotebookDate(d);
            if (targetDateStr === dateStr) continue;
            if (!store.activeData.shiftNotebooks[targetDateStr]) store.activeData.shiftNotebooks[targetDateStr] = {};
            const dayData = store.activeData.shiftNotebooks[targetDateStr];
            const existing = dayData[shift];
            const existingRows = Array.isArray(existing?.rows) ? existing.rows : (Array.isArray(existing) ? existing : []);
            const hasRows = existingRows.length > 0;
            const hasRealMembers = Array.isArray(existing?.members) && existing.members.length > 0 && !existing.inheritedMembers;
            if (hasRows || hasRealMembers) continue;
            dayData[shift] = {
                members: [...memberCopy],
                rows: existingRows,
                inheritedMembers: true,
                inheritedFrom: dateStr
            };
        }
    }

    clearShiftNotebookWeekInheritedGroupPreset(dateStr, shift) {
        if (!dateStr || !shift || !store.activeData.shiftNotebooks) return;
        const weekday = this.getShiftNotebookWeekday(dateStr);
        if (weekday < 1 || weekday > 5) return;
        const [year, month, day] = dateStr.split('-').map(Number);
        const sourceDate = new Date(year, month - 1, day);
        const friday = new Date(sourceDate);
        friday.setDate(sourceDate.getDate() + (5 - weekday));
        for (let d = new Date(sourceDate); d <= friday; d.setDate(d.getDate() + 1)) {
            const targetDateStr = this.formatShiftNotebookDate(d);
            if (targetDateStr === dateStr) continue;
            const dayData = store.activeData.shiftNotebooks[targetDateStr];
            const existing = dayData?.[shift];
            if (!dayData || !existing?.inheritedMembers || existing.inheritedFrom !== dateStr) continue;
            delete dayData[shift];
            const hasAnyData = Object.values(dayData).some(v => {
                if (Array.isArray(v)) return v.length > 0;
                return (Array.isArray(v?.rows) && v.rows.length > 0)
                    || (Array.isArray(v?.members) && v.members.length > 0)
                    || (Array.isArray(v?.absentMembers) && v.absentMembers.length > 0);
            });
            if (!hasAnyData && (!Array.isArray(dayData.sharedRows) || dayData.sharedRows.length === 0)) {
                delete store.activeData.shiftNotebooks[targetDateStr];
            }
        }
    }

    applyPreviousDayShiftGroup() {
        const editing = this._editingShiftNotebook;
        const input = document.getElementById('shift-group-members');
        if (!editing || !input) return;

        const previousDate = this.getPreviousDateStr(editing.dateStr);
        const previousData = store.activeData.shiftNotebooks?.[previousDate]?.[editing.shift];
        const members = Array.isArray(previousData?.members) ? previousData.members : [];

        if (members.length === 0) {
            alert('前日の同じシフトに登録されたメンバーがありません。');
            return;
        }

        input.value = members.join(', ');
        this._shiftNotebookAbsentMembers = [];
        this.setShiftNotebookWeekGroupBase(members);
        this.updateShiftGroupChant();
        this.saveShiftGroupPresetSelection(this.getShiftGroupPresetSavedMessage(editing.dateStr));
        input.focus();
    }

    removeShiftAbsentMember() {
        const input = document.getElementById('shift-group-members');
        if (!input) return;
        const panel = document.getElementById('shift-absence-manage');
        if (!panel) return;
        if (panel.classList.contains('hidden')) this.setShiftNotebookWeekGroupBase(this.getShiftGroupMembersFromInput());
        panel.classList.toggle('hidden');
        this.updateShiftGroupChant();
    }

    removeShiftMemberByName(name) {
        const input = document.getElementById('shift-group-members');
        if (!input || !name) return;
        const target = MaintenanceStore.toHalfWidthLower(name);
        const members = this.getShiftGroupMembersFromInput();
        const removed = members.find(member => MaintenanceStore.toHalfWidthLower(member) === target) || name;
        const filtered = members.filter(member => MaintenanceStore.toHalfWidthLower(member) !== target);
        input.value = filtered.join(', ');
        const absent = Array.isArray(this._shiftNotebookAbsentMembers) ? this._shiftNotebookAbsentMembers : [];
        if (!absent.some(member => MaintenanceStore.toHalfWidthLower(member) === MaintenanceStore.toHalfWidthLower(removed))) {
            absent.push(removed);
        }
        this._shiftNotebookAbsentMembers = absent;
        this.updateShiftGroupChant();
        this.scheduleShiftNotebookAutoSave();
        input.focus();
    }

    renderShiftGroupPresetOptions(selectedValue = '') {
        const select = document.getElementById('shift-group-preset');
        if (!select) return;
        select.innerHTML = `
            <option value="">プリセット</option>
            <option value="__previous_day__">前日と同じ</option>
            ${(store.activeData.shiftNotebookGroupPresets || []).map((p, idx) => `<option value="${idx}">${this.escapeHtml(p.name)}</option>`).join('')}
        `;
        select.value = selectedValue;
    }

    saveShiftGroupPreset() {
        if (!store.activeData.shiftNotebookGroupPresets) store.activeData.shiftNotebookGroupPresets = [];
        const members = this.getShiftGroupMembersFromInput();
        if (members.length === 0) {
            alert('プリセット登録するメンバーを入力してください。');
            return;
        }
        const defaultName = members.join('・');
        const name = prompt('プリセット名を入力してください。', defaultName);
        if (!name) return;
        const existingIndex = store.activeData.shiftNotebookGroupPresets.findIndex(p => p.name === name);
        const preset = { name, members };
        if (existingIndex >= 0) {
            store.activeData.shiftNotebookGroupPresets[existingIndex] = preset;
        } else {
            store.activeData.shiftNotebookGroupPresets.push(preset);
        }
        const types = this.ensureShiftNotebookMemberTypes();
        members.forEach(member => { if (!types[member]) types[member] = 'core'; });
        store.save();

        const idx = store.activeData.shiftNotebookGroupPresets.findIndex(p => p.name === name);
        this.renderShiftGroupPresetOptions(String(idx));
    }

    editShiftGroupPreset() {
        if (!store.activeData.shiftNotebookGroupPresets) store.activeData.shiftNotebookGroupPresets = [];
        const select = document.getElementById('shift-group-preset');
        const input = document.getElementById('shift-group-members');
        if (!select || !input || select.value === '' || select.value === '__previous_day__') {
            alert('編集するプリセットを選んでください。');
            return;
        }

        const index = Number(select.value);
        const preset = store.activeData.shiftNotebookGroupPresets[index];
        if (!preset) return;

        const name = prompt('プリセット名を編集してください。', preset.name);
        if (!name) return;
        const memberText = prompt('メンバーをカンマ区切りで編集してください。', (preset.members || []).join(', '));
        if (memberText === null) return;
        const members = memberText.split(',').map(v => v.trim()).filter(Boolean);
        if (members.length === 0) {
            alert('メンバーを1人以上入力してください。');
            return;
        }

        store.activeData.shiftNotebookGroupPresets[index] = { name, members };
        const types = this.ensureShiftNotebookMemberTypes();
        members.forEach(member => { if (!types[member]) types[member] = 'core'; });
        store.save();
        input.value = members.join(', ');
        this.renderShiftGroupPresetOptions(String(index));
    }

    deleteShiftGroupPreset() {
        if (!store.activeData.shiftNotebookGroupPresets) store.activeData.shiftNotebookGroupPresets = [];
        const select = document.getElementById('shift-group-preset');
        if (!select || select.value === '' || select.value === '__previous_day__') {
            alert('削除するプリセットを選んでください。');
            return;
        }

        const index = Number(select.value);
        const preset = store.activeData.shiftNotebookGroupPresets[index];
        if (!preset) return;
        store.activeData.shiftNotebookGroupPresets.splice(index, 1);
        store.save();
        this.renderShiftGroupPresetOptions('');
        this.showUndoNotice(`プリセット「${preset.name || '名称未設定'}」を削除しました`, () => {
            store.activeData.shiftNotebookGroupPresets.splice(index, 0, preset);
            store.save();
            this.renderShiftGroupPresetOptions(String(index));
        }, null, document.getElementById('modal-container') || document.body);
    }

    ensureShiftNotebookMemberTypes() {
        if (!store.activeData.shiftNotebookMemberTypes || typeof store.activeData.shiftNotebookMemberTypes !== 'object') {
            store.activeData.shiftNotebookMemberTypes = {};
        }
        if (!Array.isArray(store.activeData.shiftNotebookMemberOrder)) {
            store.activeData.shiftNotebookMemberOrder = [];
        }
        const types = store.activeData.shiftNotebookMemberTypes;
        const order = store.activeData.shiftNotebookMemberOrder;
        this.getShiftNotebookPresetMemberNames({ raw: true }).forEach(name => {
            if (!types[name]) types[name] = 'core';
            if (!order.includes(name)) order.push(name);
        });
        store.activeData.shiftNotebookMemberOrder = order.filter(name => this.getShiftNotebookPresetMemberNames({ raw: true }).includes(name));
        return types;
    }

    getShiftNotebookPresetMemberNames(options = {}) {
        const names = new Set();
        (store.activeData.shiftNotebookGroupPresets || []).forEach(preset => {
            (preset.members || []).forEach(member => {
                const name = String(member || '').trim();
                if (name) names.add(name);
            });
        });
        const list = Array.from(names);
        if (options.raw) return list.sort((a, b) => a.localeCompare(b, 'ja'));
        const types = store.activeData.shiftNotebookMemberTypes || {};
        const order = Array.isArray(store.activeData.shiftNotebookMemberOrder) ? store.activeData.shiftNotebookMemberOrder : [];
        const getOrder = (name) => {
            const idx = order.indexOf(name);
            return idx >= 0 ? idx : 9999;
        };
        return list.sort((a, b) => {
            const typeA = types[a] === 'support' ? 1 : 0;
            const typeB = types[b] === 'support' ? 1 : 0;
            return typeA - typeB || getOrder(a) - getOrder(b) || a.localeCompare(b, 'ja');
        });
    }

    getShiftMemberType(name) {
        const types = this.ensureShiftNotebookMemberTypes();
        return types[name] === 'support' ? 'support' : 'core';
    }

    getShiftMemberTypeLabel(type) {
        return type === 'support' ? 'サポート社員' : '基幹社員';
    }

    openShiftMemberTypeManageModal() {
        const editing = this._editingShiftNotebook;
        if (editing && document.getElementById('shift-notebook-rows')) {
            this.saveShiftNotebook(editing.dateStr, editing.shift, { close: false, render: false, status: false });
        }
        const types = this.ensureShiftNotebookMemberTypes();
        const names = this.getShiftNotebookPresetMemberNames();
        const presetMap = new Map();
        (store.activeData.shiftNotebookGroupPresets || []).forEach(preset => {
            (preset.members || []).forEach(member => {
                const name = String(member || '').trim();
                if (!name) return;
                if (!presetMap.has(name)) presetMap.set(name, []);
                presetMap.get(name).push(preset.name || '名称未設定');
            });
        });
        const rows = names.map(name => {
            const type = types[name] === 'support' ? 'support' : 'core';
            const presets = (presetMap.get(name) || []).slice(0, 4);
            return `
                <div class="shift-member-type-row ${type}">
                    <div class="shift-member-type-name">
                        <input type="text" value="${this.escapeHtml(name)}" onkeydown="if(event.key==='Enter') app.renameShiftMember('${this.escapeJs(name)}', this.value)" onblur="app.renameShiftMember('${this.escapeJs(name)}', this.value)">
                        <span>${this.getShiftMemberTypeLabel(type)}</span>
                    </div>
                    <div class="shift-member-type-presets">
                        ${presets.map(p => `<small>${this.escapeHtml(p)}</small>`).join('')}
                    </div>
                    <div class="shift-member-type-controls">
                        <select onchange="app.updateShiftMemberType('${this.escapeJs(name)}', this.value)">
                            <option value="core" ${type === 'core' ? 'selected' : ''}>基幹社員</option>
                            <option value="support" ${type === 'support' ? 'selected' : ''}>サポート社員</option>
                        </select>
                        <button type="button" class="secondary-btn shift-member-groups-btn" title="所属班を変更" onclick="app.editShiftMemberGroups('${this.escapeJs(name)}')">
                            <i class="fa-solid fa-people-group"></i> 班
                        </button>
                        <button type="button" class="icon-btn" title="上へ" onclick="app.moveShiftMemberOrder('${this.escapeJs(name)}', -1)"><i class="fa-solid fa-arrow-up"></i></button>
                        <button type="button" class="icon-btn" title="下へ" onclick="app.moveShiftMemberOrder('${this.escapeJs(name)}', 1)"><i class="fa-solid fa-arrow-down"></i></button>
                        <button type="button" class="icon-btn danger" title="削除" onclick="app.deleteShiftMemberFromPresets('${this.escapeJs(name)}')"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        this.openModal('shift-member-type-manage', 'プリセット人名管理', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="shift-member-type-manager">
                    <div class="shift-member-type-summary">
                        <div><b>${names.filter(n => types[n] !== 'support').length}</b><span>基幹社員</span></div>
                        <div><b>${names.filter(n => types[n] === 'support').length}</b><span>サポート社員</span></div>
                    </div>
                    <p class="shift-member-type-help">プリセットに登録されている人名を、基幹社員とサポート社員に分けて管理します。ここで変えた区分は返信者一覧にも反映されます。</p>
                    ${names.length ? `<div class="shift-member-type-list">${rows}</div>` : '<div class="shift-member-type-empty">プリセットに人名がありません。</div>'}
                </div>
            `;
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
        });
    }

    updateShiftMemberType(name, type) {
        const memberName = String(name || '').trim();
        if (!memberName) return;
        const types = this.ensureShiftNotebookMemberTypes();
        types[memberName] = type === 'support' ? 'support' : 'core';
        this.sortShiftPresetMembersByManagedOrder();
        store.save();
        this.openShiftMemberTypeManageModal();
    }

    renameShiftMember(oldName, newName) {
        oldName = String(oldName || '').trim();
        newName = String(newName || '').trim();
        if (!oldName || !newName || oldName === newName) return;
        const names = this.getShiftNotebookPresetMemberNames({ raw: true });
        if (names.includes(newName)) {
            alert('同じ名前がすでにあります。');
            this.openShiftMemberTypeManageModal();
            return;
        }
        (store.activeData.shiftNotebookGroupPresets || []).forEach(preset => {
            preset.members = (preset.members || []).map(member => String(member || '').trim() === oldName ? newName : member);
        });
        const types = this.ensureShiftNotebookMemberTypes();
        types[newName] = types[oldName] || 'core';
        delete types[oldName];
        const order = store.activeData.shiftNotebookMemberOrder || [];
        const idx = order.indexOf(oldName);
        if (idx >= 0) order[idx] = newName;
        if (!order.includes(newName)) order.push(newName);
        (store.activeData.localTodoWorkers || []).forEach(worker => {
            if (worker.name === oldName) worker.name = newName;
        });
        this.sortShiftPresetMembersByManagedOrder();
        store.save();
        this.renderShiftGroupPresetOptions(document.getElementById('shift-group-preset')?.value || '');
        this.openShiftMemberTypeManageModal();
    }

    deleteShiftMemberFromPresets(name) {
        name = String(name || '').trim();
        if (!name) return;
        if (!confirm(`「${name}」をすべてのプリセットから削除しますか？`)) return;
        (store.activeData.shiftNotebookGroupPresets || []).forEach(preset => {
            preset.members = (preset.members || []).filter(member => String(member || '').trim() !== name);
        });
        store.activeData.shiftNotebookGroupPresets = (store.activeData.shiftNotebookGroupPresets || []).filter(preset => (preset.members || []).length > 0);
        if (store.activeData.shiftNotebookMemberTypes) delete store.activeData.shiftNotebookMemberTypes[name];
        store.activeData.shiftNotebookMemberOrder = (store.activeData.shiftNotebookMemberOrder || []).filter(member => member !== name);
        store.save();
        this.renderShiftGroupPresetOptions('');
        this.openShiftMemberTypeManageModal();
    }

    getShiftMemberGroups(name) {
        name = String(name || '').trim();
        return (store.activeData.shiftNotebookGroupPresets || [])
            .filter(preset => (preset.members || []).some(member => String(member || '').trim() === name))
            .map(preset => preset.name || '名称未設定');
    }

    editShiftMemberGroups(name) {
        name = String(name || '').trim();
        if (!name) return;
        const currentGroups = this.getShiftMemberGroups(name);
        const value = prompt('所属する班名をカンマ区切りで入力してください。既存にない班名は新しく作成します。', currentGroups.join(', '));
        if (value === null) return;
        const nextGroups = Array.from(new Set(value.split(',').map(v => v.trim()).filter(Boolean)));
        if (nextGroups.length === 0) {
            alert('所属班を1つ以上入力してください。削除したい場合はゴミ箱ボタンを使ってください。');
            this.openShiftMemberTypeManageModal();
            return;
        }

        const presets = store.activeData.shiftNotebookGroupPresets || [];
        presets.forEach(preset => {
            preset.members = (preset.members || []).filter(member => String(member || '').trim() !== name);
        });
        nextGroups.forEach(groupName => {
            let preset = presets.find(p => (p.name || '') === groupName);
            if (!preset) {
                preset = { name: groupName, members: [] };
                presets.push(preset);
            }
            if (!(preset.members || []).some(member => String(member || '').trim() === name)) {
                preset.members = [...(preset.members || []), name];
            }
        });
        store.activeData.shiftNotebookGroupPresets = presets.filter(preset => (preset.members || []).length > 0);
        this.sortShiftPresetMembersByManagedOrder();
        store.save();
        this.renderShiftGroupPresetOptions(document.getElementById('shift-group-preset')?.value || '');
        this.openShiftMemberTypeManageModal();
    }

    moveShiftMemberOrder(name, direction) {
        name = String(name || '').trim();
        direction = direction < 0 ? -1 : 1;
        const types = this.ensureShiftNotebookMemberTypes();
        const ordered = this.getShiftNotebookPresetMemberNames().filter(member => (types[member] === 'support') === (types[name] === 'support'));
        const idx = ordered.indexOf(name);
        const swapIdx = idx + direction;
        if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
        const target = ordered[swapIdx];
        const order = store.activeData.shiftNotebookMemberOrder || [];
        const a = order.indexOf(name);
        const b = order.indexOf(target);
        if (a < 0 || b < 0) return;
        [order[a], order[b]] = [order[b], order[a]];
        this.sortShiftPresetMembersByManagedOrder();
        store.save();
        this.openShiftMemberTypeManageModal();
    }

    sortShiftPresetMembersByManagedOrder() {
        const types = this.ensureShiftNotebookMemberTypes();
        const order = store.activeData.shiftNotebookMemberOrder || [];
        const orderIndex = (name) => {
            const idx = order.indexOf(name);
            return idx >= 0 ? idx : 9999;
        };
        (store.activeData.shiftNotebookGroupPresets || []).forEach(preset => {
            const seen = new Set();
            preset.members = (preset.members || [])
                .map(member => String(member || '').trim())
                .filter(member => member && !seen.has(member) && seen.add(member))
                .sort((a, b) => {
                    const typeA = types[a] === 'support' ? 1 : 0;
                    const typeB = types[b] === 'support' ? 1 : 0;
                    return typeA - typeB || orderIndex(a) - orderIndex(b) || a.localeCompare(b, 'ja');
                });
        });
    }

    getShiftNotebookTagOptions(selected = '通常') {
        if (!store.activeData.shiftNotebookTags) store.activeData.shiftNotebookTags = ['通常', '注意', '至急'];
        return store.activeData.shiftNotebookTags.map(tag => `<option value="${this.escapeHtml(tag)}" ${tag === selected ? 'selected' : ''}>${this.escapeHtml(tag)}</option>`).join('') +
            `<option value="ADD_NEW_TAG">+ 新規作成</option>`;
    }

    getShiftNotebookTagClass(tag) {
        if (tag === '注意') return 'warning';
        if (tag === '至急') return 'urgent';
        return 'normal';
    }

    onShiftNotebookTagChange(select) {
        if (!select) return;
        if (select.value === 'ADD_NEW_TAG') {
            const name = prompt('新しい表示区分を入力してください。');
            if (!name) {
                select.value = '通常';
            } else {
                if (!store.activeData.shiftNotebookTags) store.activeData.shiftNotebookTags = ['通常', '注意', '至急'];
                if (!store.activeData.shiftNotebookTags.includes(name)) {
                    store.activeData.shiftNotebookTags.push(name);
                    store.save();
                }
                document.querySelectorAll('.shift-note-tag-select').forEach(sel => {
                    const current = sel === select ? name : sel.value;
                    sel.innerHTML = this.getShiftNotebookTagOptions(current);
                    sel.value = current;
                });
            }
        }
        
        const row = select.closest('.shift-notebook-row');
        if (row) {
            const currentClass = Array.from(row.classList).find(c => c.startsWith('tag-'));
            if (currentClass) row.classList.remove(currentClass);
            row.classList.add(`tag-${this.getShiftNotebookTagClass(select.value)}`);
        }
        this.scheduleShiftNotebookAutoSave();
    }

    getShiftNotebookRowGroupOptions(selected = '未設定') {
        if (!store.activeData.shiftNotebookRowGroups) store.activeData.shiftNotebookRowGroups = ['4号L', '5号L'];
        const groups = ['未設定', ...this.getShiftNotebookOrderedRowGroups()];
        return groups.map(group => `<option value="${this.escapeHtml(group)}" ${group === selected ? 'selected' : ''}>${this.escapeHtml(group)}</option>`).join('') +
            `<option value="ADD_NEW_ROW_GROUP">+ 新規作成</option>`;
    }

    getShiftNotebookRowGroupStyle(group = '未設定') {
        const palette = [
            { bg: '#bfdbfe', border: '#3b82f6' },
            { bg: '#bbf7d0', border: '#22c55e' },
            { bg: '#fed7aa', border: '#f97316' },
            { bg: '#fbcfe8', border: '#ec4899' },
            { bg: '#ddd6fe', border: '#8b5cf6' },
            { bg: '#a5f3fc', border: '#06b6d4' },
            { bg: '#fde68a', border: '#eab308' },
            { bg: '#cbd5e1', border: '#64748b' }
        ];
        if (!group || group === '未設定') return `--shift-row-bg:#ffffff; --shift-row-border:#cbd5e1;`;
        if (this.isShiftNotebookThroughGroup(group)) return `--shift-row-bg:#fef3c7; --shift-row-border:#d97706;`;
        let hash = 0;
        for (let i = 0; i < group.length; i++) hash = group.charCodeAt(i) + ((hash << 5) - hash);
        const color = palette[Math.abs(hash) % palette.length];
        return `--shift-row-bg:${color.bg}; --shift-row-border:${color.border};`;
    }

    getShiftNotebookRowGroupsForUi() {
        if (!store.activeData.shiftNotebookRowGroups) store.activeData.shiftNotebookRowGroups = ['4号L', '5号L'];
        return ['未設定', ...this.getShiftNotebookOrderedRowGroups()];
    }

    getShiftNotebookOrderedRowGroups() {
        if (!store.activeData.shiftNotebookRowGroups) store.activeData.shiftNotebookRowGroups = ['4号L', '5号L'];
        const special = this.getShiftNotebookThroughGroupName();
        const groups = store.activeData.shiftNotebookRowGroups.filter(g => g && g !== '未設定');
        return groups.includes(special) ? groups : [special, ...groups];
    }

    getShiftRowGroupStampButtonsHtml() {
        const stamps = this.getShiftNotebookOrderedRowGroups().map(group => `
            <button type="button" class="shift-row-group-stamp" draggable="true"
                style="${this.getShiftNotebookRowGroupStyle(group)}"
                title="${this.escapeHtml(group)}の空行をドラッグして挿入"
                ondragstart="app.startShiftRowGroupStampDrag(event, '${this.escapeJs(group)}')"
                ondragend="app.finishShiftRowGroupStampDrag()">
                ${this.escapeHtml(group)}
            </button>
        `).join('');
        return `${stamps}
            <div class="shift-row-group-trash"
                title="グループスタンプをここへドラッグして削除"
                ondragover="app.handleShiftRowGroupTrashDragOver(event)"
                ondragleave="app.handleShiftRowGroupTrashDragLeave(event)"
                ondrop="app.handleShiftRowGroupTrashDrop(event)">
                <i class="fa-solid fa-trash-can"></i>
            </div>`;
    }

    getShiftTemplateInsertStampButtonsHtml() {
        return this.getShiftNotebookOrderedRowGroups().map(group => `
            <button type="button" class="shift-row-group-stamp shift-template-insert-stamp" draggable="true"
                style="${this.getShiftNotebookRowGroupStyle(group)}"
                title="${this.escapeHtml(group)}の空行をテンプレートへ追加"
                ondragstart="app.startShiftRowGroupStampDrag(event, '${this.escapeJs(group)}')"
                ondragend="app.finishShiftRowGroupStampDrag()">
                ${this.escapeHtml(group)}
            </button>
        `).join('');
    }

    createShiftNotebookRowGroupStamp() {
        if (!store.activeData.shiftNotebookRowGroups) store.activeData.shiftNotebookRowGroups = ['4号L', '5号L'];
        const rawName = prompt('新しいグループスタンプ名を入力してください。（例: 6号L、点検、清掃）');
        const name = (rawName || '').trim();
        if (!name) return;
        if (name === '未設定') {
            alert('「未設定」は標準グループのため追加できません。');
            return;
        }
        if (this.isShiftNotebookThroughGroup(name)) {
            alert('貫通表示は標準スタンプとして登録済みです。');
            return;
        }
        if (store.activeData.shiftNotebookRowGroups.includes(name)) {
            alert(`「${name}」はすでに登録されています。`);
            return;
        }
        store.activeData.shiftNotebookRowGroups.push(name);
        store.save();
        this.refreshShiftRowGroupStamps();
        this.rerenderShiftRowTemplateManager?.();
        this.refreshShiftRowTemplateSelect?.();
    }

    refreshShiftRowGroupStamps() {
        const panel = document.getElementById('shift-row-group-stamps');
        if (panel) panel.innerHTML = this.getShiftRowGroupStampButtonsHtml();
    }

    sortShiftNotebookRows(rows = []) {
        const order = ['未設定', ...this.getShiftNotebookOrderedRowGroups()];
        const getOrder = (group) => {
            const idx = order.indexOf(group || '未設定');
            return idx === -1 ? order.length : idx;
        };
        const sorted = [...rows].sort((a, b) => {
            const groupDiff = getOrder(a.group) - getOrder(b.group);
            if (groupDiff !== 0) return groupDiff;
            return (a.index ?? a._sourceIndex ?? 0) - (b.index ?? b._sourceIndex ?? 0);
        });
        const byParent = new Map();
        sorted.forEach(row => {
            const parentId = row.replyTo || '';
            if (!parentId) return;
            if (!byParent.has(parentId)) byParent.set(parentId, []);
            byParent.get(parentId).push(row);
        });
        const byId = new Map(sorted.map(row => [row.id || row.element?.dataset?.shiftRowId || '', row]));
        const added = new Set();
        const result = [];
        const appendThread = (row) => {
            const id = row.id || row.element?.dataset?.shiftRowId || '';
            if (id && added.has(id)) return;
            if (id) added.add(id);
            result.push(row);
            (byParent.get(id) || []).forEach(appendThread);
        };
        sorted.forEach(row => {
            const parentId = row.replyTo || '';
            if (parentId && byId.has(parentId)) return;
            appendThread(row);
        });
        return result;
    }

    onShiftNotebookRowGroupChange(select) {
        if (!select) return;
        if (select.value === 'ADD_NEW_ROW_GROUP') {
            const name = prompt('新しいグループ名を入力してください。（例: 4号L）');
            if (!name) {
                select.value = '未設定';
            } else {
                if (!store.activeData.shiftNotebookRowGroups) store.activeData.shiftNotebookRowGroups = ['4号L', '5号L'];
                if (!this.isShiftNotebookThroughGroup(name) && !store.activeData.shiftNotebookRowGroups.includes(name)) {
                    store.activeData.shiftNotebookRowGroups.push(name);
                    store.save();
                }
                document.querySelectorAll('.shift-row-group-select').forEach(sel => {
                    const current = sel === select ? name : sel.value;
                    sel.innerHTML = this.getShiftNotebookRowGroupOptions(current);
                    sel.value = current;
                });
                this.refreshShiftRowGroupStamps();
            }
        }
        const row = select.closest('.shift-notebook-row');
        if (row) row.setAttribute('style', this.getShiftNotebookRowGroupStyle(select.value));
        this.lastShiftNotebookRowGroup = select.value;
        this.updateShiftNotebookGroupCorners();
        this.scheduleShiftNotebookAutoSave();
    }

    openShiftRowGroupOrderModal() {
        if (!store.activeData.shiftNotebookRowGroups) store.activeData.shiftNotebookRowGroups = ['4号L', '5号L'];
        const groups = this.getShiftNotebookOrderedRowGroups();
        this.openModal('shift-row-group-order', '連絡帳グループの表示順', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="shift-row-group-order-note">
                    <span>上にあるグループほど、連絡帳の上に表示されます。未設定は常に先頭です。</span>
                    <button type="button" class="secondary-btn shift-group-template-manage-btn" onclick="app.openShiftRowTemplateManageModal()">
                        <i class="fa-solid fa-list-check"></i> テンプレート管理
                    </button>
                </div>
                <div id="shift-row-group-order-list" class="shift-row-group-order-list">
                    ${groups.length === 0 ? '<div class="shift-row-group-order-empty">登録済みグループはありません。</div>' : groups.map(group => `
                        <div class="shift-row-group-order-item" data-group="${this.escapeHtml(group)}" style="${this.getShiftNotebookRowGroupStyle(group)}">
                            <span>${this.escapeHtml(group)}</span>
                            <div>
                                <button type="button" class="icon-btn" onclick="app.moveShiftRowGroupOrder(this, -1)" title="上へ"><i class="fa-solid fa-chevron-up"></i></button>
                                <button type="button" class="icon-btn" onclick="app.moveShiftRowGroupOrder(this, 1)" title="下へ"><i class="fa-solid fa-chevron-down"></i></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) {
                saveBtn.classList.add('hidden');
            }
        });
    }

    moveShiftRowGroupOrder(button, direction) {
        const item = button?.closest('.shift-row-group-order-item');
        const list = document.getElementById('shift-row-group-order-list');
        if (!item || !list) return;
        if (direction < 0 && item.previousElementSibling) {
            list.insertBefore(item, item.previousElementSibling);
        } else if (direction > 0 && item.nextElementSibling) {
            list.insertBefore(item.nextElementSibling, item);
        }
        this.saveShiftRowGroupOrder({ keepOpen: true });
    }

    saveShiftRowGroupOrder(options = {}) {
        const groups = Array.from(document.querySelectorAll('#shift-row-group-order-list .shift-row-group-order-item'))
            .map(item => item.dataset.group)
            .filter(Boolean);
        store.activeData.shiftNotebookRowGroups = groups;
        store.save();
        if (!options.keepOpen) this.closeModal();
        this.sortShiftNotebookRowsInDom();
        this.renderShiftRowGroupSelectOptions();
        this.refreshShiftRowGroupStamps();
    }

    normalizeShiftNotebookPhoto(photo) {
        if (typeof photo === 'string') return { src: photo, caption: '', marks: [] };
        return {
            src: photo?.src || photo?.url || photo?.data || '',
            caption: photo?.caption || '',
            marks: Array.isArray(photo?.marks) ? photo.marks : []
        };
    }

    getShiftPhotoCaptionPresetOptions() {
        const defaults = [
            'Before', 'After',
            '作業前', '作業後',
            '点検前', '点検後',
            '修理前', '修理後',
            '交換前', '交換後',
            '清掃前', '清掃後',
            '改善前', '改善後',
            '施工前', '施工後',
            '使用前', '使用後',
            '1', '2',
            '1-1', '1-2',
            '2-1', '2-2',
            '3-1', '3-2'
        ];
        const customs = Array.isArray(store.activeData.shiftPhotoCaptionPresets)
            ? store.activeData.shiftPhotoCaptionPresets
            : [];
        return Array.from(new Set([...defaults, ...customs].map(value => String(value || '').trim()).filter(Boolean)));
    }

    renderShiftPhotoCaptionPresetOptions(selected = '') {
        const current = String(selected || '');
        return this.getShiftPhotoCaptionPresetOptions().map(value => {
            const safeValue = this.escapeHtml(value);
            return `<option value="${safeValue}" ${value === current ? 'selected' : ''}>${safeValue}</option>`;
        }).join('');
    }

    renderShiftPhotoCaptionPresetMenu(selected = '') {
        const current = String(selected || '');
        const customSet = new Set(Array.isArray(store.activeData.shiftPhotoCaptionPresets) ? store.activeData.shiftPhotoCaptionPresets : []);
        const options = this.getShiftPhotoCaptionPresetOptions().map(value => {
            const safeValue = this.escapeHtml(value);
            const deleteButton = customSet.has(value)
                ? `<button type="button" class="shift-photo-caption-delete" data-value="${safeValue}" title="候補を削除">×</button>`
                : '';
            return `
                <span class="shift-photo-caption-option-wrap">
                    <button type="button" class="shift-photo-caption-option ${value === current ? 'selected' : ''}" data-value="${safeValue}">${safeValue}</button>
                    ${deleteButton}
                </span>
            `;
        }).join('');
        return `
            <div class="shift-photo-caption-options">${options}</div>
            <div class="shift-photo-caption-add">
                <input type="text" class="shift-photo-caption-add-input" placeholder="候補追加">
                <input type="text" class="shift-photo-caption-pair-input" placeholder="対">
                <button type="button" class="shift-photo-caption-add-btn" title="候補を追加">追加</button>
            </div>
        `;
    }

    addShiftPhotoCaptionPreset(value = '', pairValue = '') {
        const text = String(value || '').trim();
        if (!text) return false;
        if (!Array.isArray(store.activeData.shiftPhotoCaptionPresets)) store.activeData.shiftPhotoCaptionPresets = [];
        if (!store.activeData.shiftPhotoCaptionPresetPairs || typeof store.activeData.shiftPhotoCaptionPresetPairs !== 'object') {
            store.activeData.shiftPhotoCaptionPresetPairs = {};
        }
        if (!store.activeData.shiftPhotoCaptionPresetPairRoles || typeof store.activeData.shiftPhotoCaptionPresetPairRoles !== 'object') {
            store.activeData.shiftPhotoCaptionPresetPairRoles = {};
        }
        const exists = this.getShiftPhotoCaptionPresetOptions().some(option => option === text);
        if (!exists) store.activeData.shiftPhotoCaptionPresets.push(text);
        const pair = String(pairValue || '').trim();
        if (pair) {
            const pairExists = this.getShiftPhotoCaptionPresetOptions().some(option => option === pair)
                || store.activeData.shiftPhotoCaptionPresets.includes(pair);
            if (!pairExists) store.activeData.shiftPhotoCaptionPresets.push(pair);
            store.activeData.shiftPhotoCaptionPresetPairs[text] = pair;
            store.activeData.shiftPhotoCaptionPresetPairs[pair] = text;
            store.activeData.shiftPhotoCaptionPresetPairRoles[text] = 'before';
            store.activeData.shiftPhotoCaptionPresetPairRoles[pair] = 'after';
        }
        store.save();
        return true;
    }

    deleteShiftPhotoCaptionPreset(value = '') {
        const text = String(value || '').trim();
        if (!text || !Array.isArray(store.activeData.shiftPhotoCaptionPresets)) return false;
        store.activeData.shiftPhotoCaptionPresets = store.activeData.shiftPhotoCaptionPresets.filter(item => item !== text);
        const pairs = store.activeData.shiftPhotoCaptionPresetPairs;
        if (pairs && typeof pairs === 'object') {
            const pair = pairs[text] || '';
            delete pairs[text];
            if (pair && pairs[pair] === text) delete pairs[pair];
            Object.keys(pairs).forEach(key => {
                if (pairs[key] === text) delete pairs[key];
            });
        }
        const roles = store.activeData.shiftPhotoCaptionPresetPairRoles;
        if (roles && typeof roles === 'object') {
            delete roles[text];
            Object.keys(roles).forEach(key => {
                const pair = store.activeData.shiftPhotoCaptionPresetPairs?.[key] || '';
                if (!pair) delete roles[key];
            });
        }
        store.save();
        return true;
    }

    refreshShiftPhotoCaptionPresetMenus(selected = '') {
        document.querySelectorAll('.shift-photo-caption-menu').forEach(menu => {
            const input = menu.closest('.shift-photo-item')?.querySelector('.shift-photo-caption');
            menu.innerHTML = this.renderShiftPhotoCaptionPresetMenu(input?.value || selected);
        });
    }

    closeShiftPhotoCaptionPresetMenus(except = null) {
        document.querySelectorAll('.shift-photo-caption-menu').forEach(menu => {
            if (menu !== except) menu.hidden = true;
        });
    }

    updateShiftPhotoCaptionPresetHighlights(menu, sourceValue = '') {
        if (!menu) return;
        const pairValues = this.getShiftPhotoCaptionPairValues(sourceValue);
        menu.querySelectorAll('.shift-photo-caption-option').forEach(option => {
            option.classList.toggle('pair-suggestion', pairValues.includes(option.dataset.value || ''));
        });
    }

    getShiftPhotoCaptionPairValues(value = '') {
        const text = String(value || '').trim();
        if (!text) return [];
        const customPair = store.activeData.shiftPhotoCaptionPresetPairs?.[text];
        if (customPair) return [customPair];
        const directPairs = {
            'Before': 'After',
            'After': 'Before',
            '1': '2',
            '2': '1'
        };
        if (directPairs[text]) return [directPairs[text]];
        const numericPair = text.match(/^(\d{1,3})-(1|2)$/);
        if (numericPair) return [`${numericPair[1]}-${numericPair[2] === '1' ? '2' : '1'}`];
        if (text.includes('前')) return [text.replace(/前/g, '後')];
        if (text.includes('後')) return [text.replace(/後/g, '前')];
        return [];
    }

    getShiftPhotoCaptionCustomPairRole(value = '') {
        const text = String(value || '').trim();
        if (!text) return '';
        const roles = store.activeData.shiftPhotoCaptionPresetPairRoles || {};
        if (roles[text]) return roles[text];
        const pair = store.activeData.shiftPhotoCaptionPresetPairs?.[text];
        if (!pair) return '';
        const customs = Array.isArray(store.activeData.shiftPhotoCaptionPresets) ? store.activeData.shiftPhotoCaptionPresets : [];
        const textIndex = customs.indexOf(text);
        const pairIndex = customs.indexOf(pair);
        if (textIndex >= 0 && pairIndex >= 0) return textIndex <= pairIndex ? 'before' : 'after';
        if (textIndex >= 0) return 'before';
        return '';
    }

    getShiftPhotoCaptionCustomPairSetKey(value = '') {
        const text = String(value || '').trim();
        if (!text) return '';
        const pair = store.activeData.shiftPhotoCaptionPresetPairs?.[text];
        if (!pair) return '';
        return [text, pair].sort((a, b) => a.localeCompare(b, 'ja')).join('__pair__');
    }

    renderShiftRowGroupSelectOptions() {
        document.querySelectorAll('.shift-row-group-select').forEach(select => {
            const current = select.value;
            select.innerHTML = this.getShiftNotebookRowGroupOptions(current);
            select.value = current;
        });
    }

    getShiftRowTemplateOptions() {
        const templates = store.activeData.shiftNotebookRowTemplates || [];
        return `
            <option value="">テンプレートから追加</option>
            ${templates.map(t => `<option value="${this.escapeHtml(t.id)}">${this.escapeHtml(this.getShiftRowTemplateKindLabel(t))}: ${this.escapeHtml(t.name)}</option>`).join('')}
        `;
    }

    shiftTemplateHasContent(template = {}) {
        if (template.isRowSet) {
            return (template.rows || []).some(row => {
                const text = row.text || this.stripShiftNoteHtml(row.html || '').trim();
                const photos = Array.isArray(row.photos) ? row.photos : [];
                return !!text || photos.length > 0;
            });
        }
        if (template.isBlankRow) return false;
        const text = template.text || this.stripShiftNoteHtml(template.html || '').trim();
        const photos = Array.isArray(template.photos) ? template.photos : [];
        return !!text || photos.length > 0;
    }

    getShiftRowTemplateKindLabel(template = {}) {
        const hasContent = this.shiftTemplateHasContent(template);
        if (template.isRowSet) return hasContent ? '記入あり行セット' : 'ブランク行セット';
        return hasContent ? '記入あり' : 'ブランク';
    }

    refreshShiftRowTemplateSelect() {
        const select = document.getElementById('shift-row-template-select');
        if (select) select.innerHTML = this.getShiftRowTemplateOptions();
    }

    saveShiftNotebookRowTemplate(button) {
        const row = button?.closest('.shift-notebook-row');
        const data = this.getShiftNotebookRowDataFromElement(row);
        if (!data || (!data.text && data.photos.length === 0)) {
            this.setShiftNotebookStatus('テンプレートにする内容がありません', 'error');
            return;
        }
        const defaultName = (data.text || '写真付きテンプレート').slice(0, 24);
        this.openShiftRowTemplateNamePanel(defaultName, (name) => {
            this.createShiftRowTemplate(name, data);
        });
    }

    saveShiftNotebookRowStyleTemplate(button) {
        const row = button?.closest('.shift-notebook-row');
        const data = this.getShiftNotebookRowDataFromElement(row);
        if (!data) return;
        const groupName = data.group || this.lastShiftNotebookRowGroup || '未設定';
        const defaultName = `${groupName} 空行`;
        this.openShiftRowTemplateNamePanel(defaultName, (name) => {
            this.createShiftRowTemplate(name, {
                group: data.group,
                tag: data.tag,
                text: '',
                html: '',
                photos: [],
                isBlankRow: true
            });
        });
    }

    getShiftNotebookRowsForTemplateSet() {
        return Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row')).map(row => {
            const data = this.getShiftNotebookRowDataFromElement(row);
            return {
                group: data?.group || '未設定',
                tag: data?.tag || '通常',
                text: data?.text || '',
                html: data?.html || '',
                photos: data?.photos || [],
                important: !!data?.important,
                fiveS: !!data?.fiveS,
                fiveSAssigneeId: data?.fiveSAssigneeId || '',
                pasteFormat: data?.pasteFormat || {},
                photoCompareMarks: data?.photoCompareMarks || []
            };
        });
    }

    getShiftRowSetSummary(rows = []) {
        const counts = new Map();
        rows.forEach(row => {
            const group = row.group || '未設定';
            counts.set(group, (counts.get(group) || 0) + 1);
        });
        return Array.from(counts.entries()).map(([group, count]) => `${group} ${count}行`).join(' / ');
    }

    saveShiftNotebookRowSetTemplate() {
        const rows = this.getShiftNotebookRowsForTemplateSet();
        if (rows.length === 0) {
            this.setShiftNotebookStatus('保存する行セットがありません', 'error');
            return;
        }
        const hasContent = rows.some(row => row.text || this.stripShiftNoteHtml(row.html || '').trim() || (row.photos || []).length > 0);
        const defaultName = `${this.getShiftRowSetSummary(rows) || '行セット'} ${hasContent ? '記入あり' : 'ブランク'}`;
        this.openShiftRowTemplateNamePanel(defaultName, (name) => {
            this.createShiftRowTemplate(name, {
                group: rows[0]?.group || '未設定',
                tag: rows[0]?.tag || '通常',
                text: '',
                html: '',
                photos: [],
                isRowSet: true,
                rows
            });
        });
    }

    openShiftRowTemplateNamePanel(defaultName = '', onSave = null) {
        const container = document.getElementById('modal-container');
        if (!container) return;
        container.querySelectorAll('.shift-template-name-panel').forEach(el => el.remove());
        const panel = document.createElement('div');
        panel.className = 'shift-template-name-panel';
        panel.innerHTML = `
            <div class="shift-template-name-card">
                <div class="shift-template-name-title">テンプレート名</div>
                <input type="text" class="shift-template-name-input" value="${this.escapeHtml(defaultName)}" placeholder="テンプレート名">
                <div class="shift-template-name-actions">
                    <button type="button" class="secondary-btn">キャンセル</button>
                    <button type="button" class="primary-btn">保存</button>
                </div>
            </div>
        `;
        const input = panel.querySelector('.shift-template-name-input');
        const close = () => panel.remove();
        const save = () => {
            const name = input?.value.trim();
            if (!name) {
                input?.focus();
                return;
            }
            close();
            onSave?.(name);
        };
        panel.querySelector('.secondary-btn')?.addEventListener('click', close);
        panel.querySelector('.primary-btn')?.addEventListener('click', save);
        input?.addEventListener('keydown', e => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') close();
        });
        container.appendChild(panel);
        setTimeout(() => {
            input?.focus();
            input?.select();
        }, 0);
    }

    createShiftRowTemplate(name, data) {
        if (!store.activeData.shiftNotebookRowTemplates) store.activeData.shiftNotebookRowTemplates = [];
        store.activeData.shiftNotebookRowTemplates.push({
            id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            name,
            group: data.group,
            tag: data.tag,
            text: data.text,
            html: data.html,
            photos: data.photos,
            important: !!data.important,
            fiveS: !!data.fiveS,
            fiveSAssigneeId: data.fiveSAssigneeId || '',
            pasteFormat: data.pasteFormat || {},
            photoCompareMarks: data.photoCompareMarks || [],
            isBlankRow: !!data.isBlankRow,
            isRowSet: !!data.isRowSet,
            rows: Array.isArray(data.rows) ? this.sortShiftRowTemplateRows(data.rows.map(row => ({
                group: row.group || '未設定',
                tag: row.tag || '通常',
                text: row.text || '',
                html: row.html || '',
                photos: Array.isArray(row.photos) ? row.photos : [],
                important: !!row.important,
                fiveS: !!row.fiveS,
                fiveSAssigneeId: row.fiveSAssigneeId || '',
                pasteFormat: row.pasteFormat || {},
                photoCompareMarks: row.photoCompareMarks || []
            }))) : undefined
        });
        store.save();
        this.refreshShiftRowTemplateSelect();
        this.setShiftNotebookStatus('テンプレートを保存しました', 'saved');
    }

    normalizeShiftRowTemplateRow(row = {}) {
        return {
            group: row.group || '未設定',
            tag: row.tag || '通常',
            text: row.text || '',
            html: row.html || '',
            photos: Array.isArray(row.photos) ? row.photos : [],
            important: !!row.important,
            fiveS: !!row.fiveS,
            fiveSAssigneeId: row.fiveSAssigneeId || '',
            pasteFormat: row.pasteFormat || {},
            photoCompareMarks: Array.isArray(row.photoCompareMarks) ? row.photoCompareMarks : []
        };
    }

    getShiftRowTemplateRows(template = {}) {
        if (template.isRowSet) {
            const rows = Array.isArray(template.rows) && template.rows.length > 0
                ? template.rows
                : [{ group: template.group || '未設定', tag: template.tag || '通常' }];
            return this.sortShiftRowTemplateRows(rows.map(row => this.normalizeShiftRowTemplateRow(row)));
        }
        return [this.normalizeShiftRowTemplateRow({
            group: template.group || '未設定',
            tag: template.tag || '通常',
            text: template.isBlankRow ? '' : (template.text || ''),
            html: template.isBlankRow ? '' : (template.html || ''),
            photos: template.isBlankRow ? [] : (template.photos || []),
            important: !!template.important,
            fiveS: !!template.fiveS,
            fiveSAssigneeId: template.fiveSAssigneeId || '',
            pasteFormat: template.pasteFormat || {},
            photoCompareMarks: template.photoCompareMarks || []
        })];
    }

    getShiftRowTemplateGroupOrderIndex(group = '未設定') {
        const order = [...this.getShiftNotebookOrderedRowGroups(), '未設定'];
        const idx = order.indexOf(group || '未設定');
        return idx === -1 ? order.length : idx;
    }

    sortShiftRowTemplateRows(rows = []) {
        return rows
            .map((row, index) => ({ row, index }))
            .sort((a, b) => {
                const groupDiff = this.getShiftRowTemplateGroupOrderIndex(a.row.group) - this.getShiftRowTemplateGroupOrderIndex(b.row.group);
                if (groupDiff) return groupDiff;
                return a.index - b.index;
            })
            .map(item => item.row);
    }

    setShiftRowTemplateRows(template, rows = []) {
        const normalized = this.sortShiftRowTemplateRows(rows.map(row => this.normalizeShiftRowTemplateRow(row)));
        if (!template || normalized.length === 0) return false;
        const keepRowSet = template.isRowSet || normalized.length > 1;
        const first = normalized[0];
        template.group = first.group;
        template.tag = first.tag;
        template.important = !!first.important;
        template.fiveS = !!first.fiveS;
        template.fiveSAssigneeId = first.fiveSAssigneeId || '';
        template.pasteFormat = first.pasteFormat || {};
        template.photoCompareMarks = first.photoCompareMarks || [];
        if (keepRowSet) {
            template.isRowSet = true;
            template.isBlankRow = false;
            template.text = '';
            template.html = '';
            template.photos = [];
            template.rows = normalized;
        } else {
            template.isRowSet = false;
            template.rows = undefined;
            template.text = first.text || '';
            template.html = first.html || '';
            template.photos = first.photos || [];
            template.isBlankRow = !template.text && !this.stripShiftNoteHtml(template.html || '').trim() && template.photos.length === 0;
        }
        return true;
    }

    getShiftRowTemplateBlankRow(group = '未設定') {
        return this.normalizeShiftRowTemplateRow({
            group: group || '未設定',
            tag: '通常',
            text: '',
            html: '',
            photos: []
        });
    }

    addShiftNotebookRowFromTemplate(templateId) {
        if (!templateId) return;
        const template = (store.activeData.shiftNotebookRowTemplates || []).find(t => t.id === templateId);
        if (!template) return;
        this.removeOnlyBlankUnsetShiftNotebookRow();
        if (template.isRowSet) {
            const rows = Array.isArray(template.rows) && template.rows.length > 0 ? template.rows : [{ group: template.group || '未設定', tag: template.tag || '通常' }];
            const addedRows = rows.map(row => this.addShiftNotebookRow('shift-notebook-rows', row.text || '', row.photos || [], row.tag || '通常', row.group || this.lastShiftNotebookRowGroup || '未設定', row.html || '', false, true, '', '', !!row.important, null, false, '', !!row.fiveS, row.photoCompareMarks || [], row.fiveSAssigneeId || ''))
                .filter(Boolean);
            addedRows.forEach((rowEl, index) => this.setShiftNoteRowPasteFormatSettings(rowEl, rows[index]?.pasteFormat || {}));
            this.sortShiftNotebookRowsInDom();
            addedRows[0]?.querySelector('.shift-note-text')?.focus();
            this.autoSaveShiftNotebook(true);
            this.setShiftNotebookStatus(`${rows.length}行の行セットを追加しました`, 'saved');
            return;
        }
        const isBlankRow = !!template.isBlankRow;
        this.addShiftNotebookRow('shift-notebook-rows', isBlankRow ? '' : (template.text || ''), isBlankRow ? [] : (template.photos || []), template.tag || '通常', template.group || this.lastShiftNotebookRowGroup || '未設定', isBlankRow ? '' : (template.html || ''), false, true, '', '', !!template.important, null, false, '', !!template.fiveS, template.photoCompareMarks || [], template.fiveSAssigneeId || '');
        const row = document.querySelector('#shift-notebook-rows .shift-notebook-row:last-child');
        if (row && !isBlankRow) this.setShiftNoteRowPasteFormatSettings(row, template.pasteFormat || {});
        row?.querySelector('.shift-note-text')?.focus();
        this.sortShiftNotebookRowsInDom();
        this.autoSaveShiftNotebook(true);
    }

    removeOnlyBlankUnsetShiftNotebookRow() {
        const container = document.getElementById('shift-notebook-rows');
        if (!container) return false;
        const rows = Array.from(container.querySelectorAll('.shift-notebook-row'));
        if (rows.length !== 1) return false;
        const data = this.getShiftNotebookRowDataFromElement(rows[0]);
        if (!data) return false;
        const isUnset = (data.group || '未設定') === '未設定';
        const hasContent = !!data.text || (data.photos || []).length > 0 || !!this.stripShiftNoteHtml(data.html || '').trim();
        if (!isUnset || hasContent) return false;
        rows[0].remove();
        this.updateUnusedBlankShiftNotebookRowCount();
        return true;
    }

    getUnusedBlankShiftNotebookRows() {
        const container = document.getElementById('shift-notebook-rows');
        if (!container) return [];
        const rows = Array.from(container.querySelectorAll('.shift-notebook-row'));
        const rowIdsWithReplies = new Set(rows.map(row => row.dataset.replyTo || '').filter(Boolean));
        return rows.filter(row => {
            const data = this.getShiftNotebookRowDataFromElement(row);
            if (!data) return false;
            const isActiveEditor = row.querySelector('.shift-note-text') === document.activeElement;
            const hasContent = !!data.text || (data.photos || []).length > 0 || !!this.stripShiftNoteHtml(data.html || '').trim();
            const hasState = !!data.important || !!data.fiveS || !!data.suddenRegistered;
            const hasReplies = rowIdsWithReplies.has(row.dataset.shiftRowId || '');
            return !hasContent && !hasState && !hasReplies && !isActiveEditor;
        });
    }

    highlightUnusedBlankShiftNotebookRows(active = true) {
        document.querySelectorAll('#shift-notebook-rows .shift-notebook-row.shift-unused-blank-target')
            .forEach(row => row.classList.remove('shift-unused-blank-target'));
        if (!active) return;
        this.getUnusedBlankShiftNotebookRows().forEach(row => row.classList.add('shift-unused-blank-target'));
    }

    updateUnusedBlankShiftNotebookRowCount() {
        const count = this.getUnusedBlankShiftNotebookRows().length;
        const button = document.getElementById('shift-remove-blank-rows-btn');
        const badge = document.getElementById('shift-remove-blank-rows-count');
        if (badge) {
            badge.textContent = String(count);
            badge.hidden = count === 0;
        }
        if (button) {
            button.disabled = count === 0;
            button.title = count > 0
                ? `${count}行の未使用行を削除します`
                : '削除できる未使用行はありません';
        }
        this.highlightUnusedBlankShiftNotebookRows(false);
        return count;
    }

    closeUnusedBlankRowsConfirm() {
        document.getElementById('shift-unused-blank-confirm')?.remove();
        this.highlightUnusedBlankShiftNotebookRows(false);
    }

    confirmUnusedBlankShiftNotebookRows() {
        const container = document.getElementById('shift-notebook-rows');
        if (!container) return;
        const blankRows = this.getUnusedBlankShiftNotebookRows();

        if (blankRows.length === 0) {
            this.setShiftNotebookStatus('削除する空白行はありません', 'moved');
            this.updateUnusedBlankShiftNotebookRowCount();
            return;
        }

        this.highlightUnusedBlankShiftNotebookRows(true);
        document.getElementById('shift-unused-blank-confirm')?.remove();
        const panel = document.createElement('div');
        panel.id = 'shift-unused-blank-confirm';
        panel.className = 'shift-unused-blank-confirm';
        panel.innerHTML = `
            <div>
                <b>${blankRows.length}行の未使用行を削除しますか？</b>
                <span>黄色で表示中の行だけ削除します。削除後も元に戻せます。</span>
            </div>
            <div class="shift-unused-blank-confirm-actions">
                <button type="button" class="secondary-btn" onclick="app.closeUnusedBlankRowsConfirm()">キャンセル</button>
                <button type="button" class="primary-btn" onclick="app.removeUnusedBlankShiftNotebookRows()"><i class="fa-solid fa-broom"></i> 削除</button>
            </div>
        `;
        (document.querySelector('.shift-notebook-toolbar') || container).insertAdjacentElement('afterend', panel);
    }

    removeUnusedBlankShiftNotebookRows() {
        const container = document.getElementById('shift-notebook-rows');
        if (!container) return;
        const blankRows = this.getUnusedBlankShiftNotebookRows();
        if (blankRows.length === 0) {
            this.closeUnusedBlankRowsConfirm();
            this.setShiftNotebookStatus('削除する空白行はありません', 'moved');
            this.updateUnusedBlankShiftNotebookRowCount();
            return;
        }
        const rowDataList = blankRows.map(row => this.getShiftNotebookRowDataFromElement(row)).filter(Boolean);
        const nextSiblings = new Map(blankRows.map(row => [row.dataset.shiftRowId || '', row.nextSibling]));
        blankRows.forEach(row => row.remove());
        this.closeUnusedBlankRowsConfirm();
        this.updateShiftNotebookGroupCorners();
        this.updateShiftNotebookHiddenRows();
        this.updateShiftNotebookRowMenuVisibility();
        this.updateUnusedBlankShiftNotebookRowCount();
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus(`${blankRows.length}行の未使用行を削除しました`, 'saved');
        this.showShiftNotebookUndoNotice(`${blankRows.length}行の未使用行を削除しました`, () => {
            rowDataList.forEach(rowData => {
                const beforeNode = nextSiblings.get(rowData.id || '') || null;
                this.restoreShiftNotebookRowsFromData('shift-notebook-rows', [rowData], beforeNode);
            });
            this.updateShiftNotebookGroupCorners();
            this.updateShiftNotebookHiddenRows();
            this.updateShiftNotebookRowMenuVisibility();
            this.updateUnusedBlankShiftNotebookRowCount();
            this.autoSaveShiftNotebook(true);
        });
    }

    openShiftRowTemplateManageModal() {
        if (!store.activeData.shiftNotebookRowTemplates) store.activeData.shiftNotebookRowTemplates = [];
        this.openModal('shift-row-template-manage', '連絡帳テンプレート管理', () => {
            const content = document.getElementById('modal-content');
            const render = () => {
                const templates = store.activeData.shiftNotebookRowTemplates || [];
                content.innerHTML = `
                    <div class="shift-template-manage-tools">
                        <div class="shift-template-manage-stamps">
                            <span class="shift-row-group-stamps-label">行挿入用看板（テンプレートへドラッグ）</span>
                            <button type="button" class="secondary-btn shift-template-group-order-btn" onclick="app.openShiftRowGroupOrderModal()">
                                <i class="fa-solid fa-arrow-down-wide-short"></i> 表示順
                            </button>
                            ${this.getShiftTemplateInsertStampButtonsHtml()}
                            <div class="shift-row-group-trash shift-template-group-trash"
                                title="グループ看板をここへドラッグして削除"
                                ondragover="app.handleShiftRowGroupTrashDragOver(event)"
                                ondragleave="app.handleShiftRowGroupTrashDragLeave(event)"
                                ondrop="app.handleShiftRowGroupTrashDrop(event)">
                                <i class="fa-solid fa-trash-can"></i>
                                <span>看板削除</span>
                            </div>
                        </div>
                        <button type="button" class="shift-template-new-group-stamp"
                            title="新しいグループスタンプを作成"
                            onclick="app.createShiftNotebookRowGroupStamp()">
                            <i class="fa-solid fa-plus"></i>
                            <span>新規</span>
                        </button>
                    </div>
                    <div class="shift-template-manage-list">
                        ${templates.length === 0 ? '<div class="shift-template-empty">保存済みテンプレートはありません</div>' : templates.map((template, index) => {
                            const isBlankRow = !!template.isBlankRow;
                            const isRowSet = !!template.isRowSet;
                            const templateRows = this.getShiftRowTemplateRows(template);
                            const rowSetRows = isRowSet ? templateRows : [];
                            const rowSetSummary = this.getShiftRowSetSummary(rowSetRows);
                            const kindLabel = this.getShiftRowTemplateKindLabel(template);
                            const text = isRowSet ? (rowSetSummary || '行セット') : (isBlankRow ? '空行テンプレート' : (template.text || this.stripShiftNoteHtml(template.html || '').trim() || '本文なし'));
                            return `
                                <div class="shift-template-manage-item"
                                    data-template-index="${index}"
                                    ondragover="app.handleShiftTemplateCardDragOver(event, ${index})"
                                    ondragleave="app.handleShiftTemplateCardDragLeave(event)"
                                    ondrop="app.handleShiftTemplateCardDrop(event, ${index})">
                                    <div class="shift-template-manage-main">
                                        <b>${this.escapeHtml(template.name || '名称未設定')}</b>
                                        <span>${this.escapeHtml(kindLabel)} / ${this.escapeHtml(text).slice(0, 90)}</span>
                                        <div class="shift-template-row-stamps">
                                            ${templateRows.map((row, rowIndex) => {
                                                const rowText = row.text || this.stripShiftNoteHtml(row.html || '').trim();
                                                const rowPhotos = Array.isArray(row.photos) ? row.photos : [];
                                                const rowLabel = rowText ? rowText.slice(0, 18) : (rowPhotos.length ? `写真 ${rowPhotos.length}枚` : '空行');
                                                return `<button type="button" class="shift-template-row-stamp" draggable="true" data-template-index="${index}" data-row-index="${rowIndex}" style="${this.getShiftNotebookRowGroupStyle(row.group || '未設定')}" title="ドラッグして削除 / この行の前後に看板を追加" ondragstart="app.startShiftTemplateRowStampDrag(event, ${index}, ${rowIndex})" ondragend="app.finishShiftTemplateRowStampDrag()"><b>${this.escapeHtml(row.group || '未設定')}</b><small>${this.escapeHtml(rowLabel)}</small></button>`;
                                            }).join('')}
                                        </div>
                                    </div>
                                    <div class="shift-template-manage-actions">
                                        <button type="button" class="icon-btn" title="上へ" onclick="app.moveShiftRowTemplate(${index}, -1)"><i class="fa-solid fa-chevron-up"></i></button>
                                        <button type="button" class="icon-btn" title="下へ" onclick="app.moveShiftRowTemplate(${index}, 1)"><i class="fa-solid fa-chevron-down"></i></button>
                                        <button type="button" class="secondary-btn" onclick="app.renameShiftRowTemplate(${index})">名前変更</button>
                                        <div class="shift-template-row-trash"
                                            title="このテンプレート内の行看板をここへドラッグして削除"
                                            ondragover="app.handleShiftTemplateRowTrashDragOver(event)"
                                            ondragleave="app.handleShiftTemplateRowTrashDragLeave(event)"
                                            ondrop="app.handleShiftTemplateRowTrashDrop(event)">
                                            <i class="fa-solid fa-trash-can"></i>
                                            <span>行削除</span>
                                        </div>
                                        <button type="button" class="icon-btn" style="color:var(--danger);" title="削除" onclick="app.deleteShiftRowTemplate(${index})"><i class="fa-solid fa-trash-can"></i></button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            };
            render();
            this._renderShiftRowTemplateManager = render;
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
        });
    }

    rerenderShiftRowTemplateManager() {
        this._renderShiftRowTemplateManager?.();
        this.refreshShiftRowTemplateSelect();
    }

    moveShiftRowTemplate(index, direction) {
        const templates = store.activeData.shiftNotebookRowTemplates || [];
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= templates.length) return;
        const [item] = templates.splice(index, 1);
        templates.splice(nextIndex, 0, item);
        store.save();
        this.rerenderShiftRowTemplateManager();
    }

    renameShiftRowTemplate(index) {
        const template = (store.activeData.shiftNotebookRowTemplates || [])[index];
        if (!template) return;
        this.openShiftRowTemplateNamePanel(template.name || '', (name) => {
            template.name = name;
            store.save();
            this.rerenderShiftRowTemplateManager();
        });
    }

    deleteShiftRowTemplate(index) {
        const templates = store.activeData.shiftNotebookRowTemplates || [];
        const template = templates[index];
        if (!template) return;
        templates.splice(index, 1);
        store.save();
        this.rerenderShiftRowTemplateManager();
        this.showUndoNotice(`テンプレート「${template.name || '名称未設定'}」を削除しました`, () => {
            templates.splice(index, 0, template);
            store.save();
            this.rerenderShiftRowTemplateManager();
        }, null, document.getElementById('modal-container') || document.body);
    }

    handleShiftTemplateCardDragOver(event, index) {
        const group = this.getShiftRowGroupStampDragGroup(event);
        if (!group) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        event.currentTarget?.classList.add('drag-over');
    }

    handleShiftTemplateCardDragLeave(event) {
        if (!event.currentTarget?.contains(event.relatedTarget)) {
            event.currentTarget?.classList.remove('drag-over');
        }
    }

    handleShiftTemplateCardDrop(event, index) {
        const group = this.getShiftRowGroupStampDragGroup(event);
        if (!group) return;
        event.preventDefault();
        event.currentTarget?.classList.remove('drag-over');
        const templates = store.activeData.shiftNotebookRowTemplates || [];
        const template = templates[index];
        if (!template) return;
        const rows = this.getShiftRowTemplateRows(template);
        const targetStamp = event.target?.closest?.('.shift-template-row-stamp');
        let insertIndex = rows.length;
        if (targetStamp && event.currentTarget?.contains(targetStamp)) {
            const rowIndex = Number(targetStamp.dataset.rowIndex);
            if (Number.isFinite(rowIndex)) {
                const rect = targetStamp.getBoundingClientRect();
                insertIndex = rowIndex + (event.clientY > rect.top + rect.height / 2 ? 1 : 0);
            }
        }
        rows.splice(Math.max(0, Math.min(rows.length, insertIndex)), 0, this.getShiftRowTemplateBlankRow(group));
        this.setShiftRowTemplateRows(template, rows);
        store.save();
        this.rerenderShiftRowTemplateManager();
        this.showUndoNotice(`テンプレート「${template.name || '名称未設定'}」に${group}の行を追加しました`, () => {
            rows.splice(Math.max(0, Math.min(rows.length - 1, insertIndex)), 1);
            this.setShiftRowTemplateRows(template, rows);
            store.save();
            this.rerenderShiftRowTemplateManager();
        }, null, document.getElementById('modal-container') || document.body);
        this.finishShiftRowGroupStampDrag();
    }

    startShiftTemplateRowStampDrag(event, templateIndex, rowIndex) {
        this._draggingShiftTemplateRow = { templateIndex, rowIndex };
        if (event?.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('application/x-shift-template-row', JSON.stringify(this._draggingShiftTemplateRow));
        }
        event?.currentTarget?.classList.add('dragging');
        document.body.classList.add('shift-template-row-dragging-active');
    }

    finishShiftTemplateRowStampDrag() {
        this._draggingShiftTemplateRow = null;
        document.body.classList.remove('shift-template-row-dragging-active');
        document.querySelectorAll('.shift-template-row-stamp.dragging').forEach(el => el.classList.remove('dragging'));
        document.querySelectorAll('.shift-template-row-trash.drag-over').forEach(el => el.classList.remove('drag-over'));
    }

    getShiftTemplateRowDragData(event) {
        const transferTypes = event?.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
        if (transferTypes.includes('application/x-shift-template-row')) {
            try {
                const data = JSON.parse(event.dataTransfer.getData('application/x-shift-template-row') || '{}');
                return {
                    templateIndex: Number(data.templateIndex),
                    rowIndex: Number(data.rowIndex)
                };
            } catch {
                return null;
            }
        }
        return this._draggingShiftTemplateRow || null;
    }

    handleShiftTemplateRowTrashDragOver(event) {
        const data = this.getShiftTemplateRowDragData(event);
        if (!data || !Number.isFinite(data.templateIndex) || !Number.isFinite(data.rowIndex)) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        event.currentTarget?.classList.add('drag-over');
    }

    handleShiftTemplateRowTrashDragLeave(event) {
        event.currentTarget?.classList.remove('drag-over');
    }

    handleShiftTemplateRowTrashDrop(event) {
        const data = this.getShiftTemplateRowDragData(event);
        if (!data || !Number.isFinite(data.templateIndex) || !Number.isFinite(data.rowIndex)) return;
        event.preventDefault();
        event.currentTarget?.classList.remove('drag-over');
        const templates = store.activeData.shiftNotebookRowTemplates || [];
        const template = templates[data.templateIndex];
        if (!template) return;
        const rows = this.getShiftRowTemplateRows(template);
        const removed = rows.splice(data.rowIndex, 1)[0];
        if (!removed) return;
        if (rows.length === 0) {
            const removedTemplate = templates.splice(data.templateIndex, 1)[0];
            store.save();
            this.rerenderShiftRowTemplateManager();
            this.showUndoNotice(`テンプレート「${removedTemplate.name || '名称未設定'}」を削除しました`, () => {
                templates.splice(data.templateIndex, 0, removedTemplate);
                store.save();
                this.rerenderShiftRowTemplateManager();
            }, null, document.getElementById('modal-container') || document.body);
        } else {
            this.setShiftRowTemplateRows(template, rows);
            store.save();
            this.rerenderShiftRowTemplateManager();
            this.showUndoNotice(`テンプレート「${template.name || '名称未設定'}」から1行削除しました`, () => {
                rows.splice(data.rowIndex, 0, removed);
                this.setShiftRowTemplateRows(template, rows);
                store.save();
                this.rerenderShiftRowTemplateManager();
            }, null, document.getElementById('modal-container') || document.body);
        }
        this.finishShiftTemplateRowStampDrag();
    }

    togglePreviousShiftRowsPanel() {
        const panel = document.getElementById('shift-previous-copy-panel');
        const editing = this._editingShiftNotebook;
        if (!panel || !editing) return;
        panel.classList.toggle('hidden');
        if (panel.classList.contains('hidden')) return;

        const target = this.getPreviousFilledShiftNotebookTarget(editing.dateStr, editing.shift) || this.getPreviousShiftNotebookTarget(editing.dateStr, editing.shift);
        const dayData = target ? store.activeData.shiftNotebooks?.[target.dateStr] : null;
        const { rows } = target ? this.getShiftNotebookRowsForShift(dayData || {}, target.shift) : { rows: [] };
        const hiddenCount = rows.filter(row => !!row.hidden).length;
        const label = target ? this.getShiftNotebookLabel(target.shift) : null;
        if (!target || rows.length === 0) {
            panel.innerHTML = '<div class="shift-previous-copy-empty">コピーできる前シフトの行がありません</div>';
            return;
        }

        panel.innerHTML = `
            <div class="shift-previous-copy-head">
                <b>${target.dateStr} ${this.escapeHtml(label?.name || '')}${hiddenCount ? ` / チェック済み${hiddenCount}行は未選択` : ''}</b>
                <div>
                    <button type="button" class="secondary-btn" onclick="app.setPreviousShiftCopySelection(true)">全選択</button>
                    <button type="button" class="secondary-btn" onclick="app.setPreviousShiftCopySelection(false)">全解除</button>
                    <button type="button" class="secondary-btn" onclick="app.excludeCheckedPreviousShiftRows()">チェック済み除外</button>
                    <button type="button" class="secondary-btn" onclick="app.importSelectedPreviousShiftRows()">選択行を追加</button>
                    <button type="button" class="secondary-btn" onclick="document.getElementById('shift-previous-copy-panel').classList.add('hidden')">閉じる</button>
                </div>
            </div>
            <div class="shift-previous-copy-list">
                ${rows.map((row, index) => {
                    const text = row.text || this.stripShiftNoteHtml(row.html || '').trim() || '本文なし';
                    const isHidden = !!row.hidden;
                    const hasPhotos = Array.isArray(row.photos) && row.photos.length > 0;
                    const isImportant = !!row.important;
                    const isFiveS = !!row.fiveS;
                    const hasReplies = rows.some(item => item.replyTo && item.replyTo === row.id);
                    const badges = [
                        isHidden ? '<span class="shift-previous-copy-badge done">チェック済</span>' : '',
                        isImportant ? '<span class="shift-previous-copy-badge important">重要</span>' : '',
                        isFiveS ? '<span class="shift-previous-copy-badge photo">5S</span>' : '',
                        hasPhotos ? '<span class="shift-previous-copy-badge photo">写真</span>' : '',
                        hasReplies ? '<span class="shift-previous-copy-badge reply">返信あり</span>' : ''
                    ].filter(Boolean).join('');
                    return `
                        <label class="shift-previous-copy-item ${isHidden ? 'checked-hidden' : ''}">
                            <input type="checkbox" value="${index}" ${isHidden ? '' : 'checked'}>
                            <span class="shift-row-group-badge">${this.escapeHtml(row.group || '未設定')}</span>
                            <span class="shift-previous-copy-badges">${badges}</span>
                            <span>${this.escapeHtml(text).slice(0, 140)}</span>
                        </label>
                    `;
                }).join('')}
            </div>
        `;
        panel._previousRows = rows;
    }

    setPreviousShiftCopySelection(checked) {
        document.querySelectorAll('#shift-previous-copy-panel input[type="checkbox"]').forEach(input => {
            input.checked = checked;
        });
    }

    excludeCheckedPreviousShiftRows() {
        const panel = document.getElementById('shift-previous-copy-panel');
        const rows = panel?._previousRows || [];
        panel?.querySelectorAll('input[type="checkbox"]').forEach(input => {
            const row = rows[Number(input.value)];
            input.checked = !row?.hidden;
        });
    }

    importSelectedPreviousShiftRows() {
        const panel = document.getElementById('shift-previous-copy-panel');
        const rows = panel?._previousRows || [];
        if (!panel || rows.length === 0) return;
        const selectedIndexes = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked')).map(input => Number(input.value));
        if (selectedIndexes.length === 0) {
            this.setShiftNotebookStatus('コピーする行を選んでください', 'error');
            return;
        }
        const existingKeys = new Set(Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'))
            .map(row => this.getShiftNotebookRowDuplicateKey(this.getShiftNotebookRowDataFromElement(row))));
        let addedCount = 0;
        let skippedCount = 0;
        selectedIndexes.forEach(index => {
            const row = rows[index];
            if (!row) return;
            const rowData = {
                group: row.group || this.lastShiftNotebookRowGroup || '未設定',
                tag: row.tag || '通常',
                text: row.text || '',
                html: row.html || '',
                photos: row.photos || []
            };
            const key = this.getShiftNotebookRowDuplicateKey(rowData);
            if (existingKeys.has(key)) {
                skippedCount++;
                return;
            }
            existingKeys.add(key);
            this.addShiftNotebookRow('shift-notebook-rows', row.text || '', row.photos || [], row.tag || '通常', row.group || this.lastShiftNotebookRowGroup || '未設定', row.html || '');
            addedCount++;
        });
        panel.classList.add('hidden');
        this.sortShiftNotebookRowsInDom();
        this.autoSaveShiftNotebook(true);
        const message = skippedCount > 0 ? `${addedCount}行コピー、${skippedCount}行は重複のためスキップ` : `${addedCount}行コピーしました`;
        this.setShiftNotebookStatus(message, addedCount > 0 ? 'saved' : 'error');
    }

    getShiftNotebookRowDuplicateKey(row = {}) {
        const htmlText = row.html ? this.stripShiftNoteHtml(row.html) : '';
        const text = MaintenanceStore.toHalfWidthLower(row.text || htmlText || '').replace(/\s+/g, ' ').trim();
        const photos = (row.photos || []).map(photo => {
            const p = this.normalizeShiftNotebookPhoto(photo);
            return `${p.src || ''}::${p.caption || ''}`;
        }).sort().join('|');
        return `${text}__${photos}`;
    }

    addShiftNotebookRow(containerId, text = '', photos = [], tag = '通常', group = '未設定', html = '', hidden = false, preserveBlank = true, savedRowId = '', replyTo = '', important = false, pasteFormat = null, suddenRegistered = false, suddenHistoryId = '', fiveS = false, photoCompareMarks = [], fiveSAssigneeId = '') {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (group) this.lastShiftNotebookRowGroup = group;
        const rowId = savedRowId || `shift-row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const row = document.createElement('div');
        row.className = 'shift-notebook-row';
        if (important) row.classList.add('shift-row-important');
        if (fiveS) row.classList.add('shift-row-5s');
        if (suddenRegistered) row.classList.add('shift-row-sudden-registered');
        row.dataset.shiftRowId = rowId;
        row.dataset.shiftPhotoGlobalMarks = JSON.stringify(Array.isArray(photoCompareMarks) ? photoCompareMarks : []);
        if (fiveSAssigneeId) row.dataset.fiveSAssigneeId = fiveSAssigneeId;
        if (suddenRegistered) row.dataset.suddenRegistered = 'true';
        if (suddenHistoryId) row.dataset.suddenHistoryId = suddenHistoryId;
        if (replyTo) {
            row.dataset.replyTo = replyTo;
            row.classList.add('shift-reply-row');
        }
        this.setShiftNoteRowPasteFormatSettings(row, pasteFormat || {});
        if (preserveBlank) row.dataset.preserveBlank = 'true';
        row.setAttribute('style', this.getShiftNotebookRowGroupStyle(group));
        row.innerHTML = `
            <div class="shift-row-group-heading"></div>
            <div class="shift-important-stamp" aria-hidden="true">重要</div>
            <div class="shift-5s-stamp" aria-hidden="true">5S</div>
            <div class="shift-sudden-registered-stamp" aria-hidden="true">突発対応登録済</div>
            <div class="shift-notebook-line">
                <button type="button" class="icon-btn shift-row-drag-handle" title="ドラッグして行を上下に移動" draggable="true"><i class="fa-solid fa-arrows-up-down"></i></button>
                <select class="shift-row-group-select" onchange="app.onShiftNotebookRowGroupChange(this)">
                    ${this.getShiftNotebookRowGroupOptions(group)}
                </select>
                <div class="shift-note-formatbar">
                    <div class="shift-format-menu">
                        <button type="button" class="shift-format-menu-btn" title="フォント・サイズ・色を選び、反映ボタンで装飾を適用します" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.toggleShiftNoteSizeMenu(this)">
                            <span class="shift-format-indicator"></span><i class="fa-solid fa-palette"></i> <span class="shift-format-current">標準</span> <i class="fa-solid fa-caret-down"></i>
                        </button>
                        <div class="shift-format-panel">
                            <button type="button" class="shift-format-close-btn" title="閉じる" onmousedown="event.preventDefault()" onclick="app.cancelShiftNoteFormatMenu(this)">
                                ×
                            </button>
                            <div class="shift-format-pending-summary">
                                <div class="shift-format-summary-line">反映予定: 標準</div>
                                <div class="shift-format-preview-text standard">連絡帳プレビュー</div>
                            </div>
                            <div class="shift-format-panel-title">サイズ</div>
                            <div class="shift-format-size-options">
                                <input type="number" class="shift-font-size-input" value="20" min="8" max="120" style="width:64px; padding:6px 8px; text-align:center; border:1.5px solid var(--border); border-radius:6px; font-size:0.95rem; font-weight:800; outline:none;" 
                                    onmousedown="app.rememberShiftNoteSelection(this)"
                                    onfocus="this.style.borderColor='var(--primary)'" 
                                    onblur="this.style.borderColor='var(--border)'; app.stageShiftNoteFormat(this, 'size', this.value + 'px')" 
                                    onchange="app.stageShiftNoteFormat(this, 'size', this.value + 'px')"
                                    onkeydown="if(event.key === 'Enter'){ event.preventDefault(); app.stageShiftNoteFormat(this, 'size', this.value + 'px'); this.blur(); }"
                                    title="フォントサイズ (px)">
                                <span style="font-size:0.8rem; color:var(--text-light); font-weight:700;">px</span>
                            </div>
                            <div class="shift-format-panel-title">色</div>
                            <div class="shift-color-options">
                                <button type="button" class="shift-color-dot red" data-color="#dc2626" title="赤" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#dc2626')"></button>
                                <button type="button" class="shift-color-dot orange" data-color="#ea580c" title="オレンジ" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#ea580c')"></button>
                                <button type="button" class="shift-color-dot yellow" data-color="#ca8a04" title="黄" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#ca8a04')"></button>
                                <button type="button" class="shift-color-dot green" data-color="#16a34a" title="緑" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#16a34a')"></button>
                                <button type="button" class="shift-color-dot blue" data-color="#2563eb" title="青" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#2563eb')"></button>
                                <button type="button" class="shift-color-dot purple" data-color="#7c3aed" title="紫" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#7c3aed')"></button>
                                <button type="button" class="shift-color-dot black" data-color="#0f172a" title="黒" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#0f172a')"></button>
                            </div>
                            <div class="shift-format-actions">
                                <button type="button" class="shift-format-cancel-btn" onmousedown="event.preventDefault()" onclick="app.cancelShiftNoteFormatMenu(this)">
                                    キャンセル
                                </button>
                                <button type="button" class="shift-format-apply-btn" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.applyShiftNoteFormatMenu(this)">
                                    <i class="fa-solid fa-check"></i> 反映
                                </button>
                                <button type="button" class="shift-format-apply-all-btn" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.applyShiftNoteFormatMenuToAll(this)">
                                    <i class="fa-solid fa-layer-group"></i> 全行に反映
                                </button>
                            </div>
                            <div class="shift-format-panel-title">フォント</div>
                            <div class="shift-font-options">
                                <button type="button" class="shift-font-option" data-font="" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'font', '')">標準</button>
                                <button type="button" class="shift-font-option" data-font='"Noto Sans JP", sans-serif' onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'font', '&quot;Noto Sans JP&quot;, sans-serif')">ゴシック</button>
                                <button type="button" class="shift-font-option" data-font='"Yu Gothic", "YuGothic", sans-serif' onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'font', '&quot;Yu Gothic&quot;, &quot;YuGothic&quot;, sans-serif')">游</button>
                                <button type="button" class="shift-font-option" data-font='"Meiryo", sans-serif' onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'font', '&quot;Meiryo&quot;, sans-serif')">メイリオ</button>
                                <button type="button" class="shift-font-option" data-font='"Noto Serif JP", serif' onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'font', '&quot;Noto Serif JP&quot;, serif')">明朝</button>
                                <button type="button" class="shift-font-option" data-font='"MS Gothic", monospace' onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'font', '&quot;MS Gothic&quot;, monospace')">等幅</button>
                            </div>
                            <button type="button" class="shift-format-reset-btn" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'reset')">
                                <i class="fa-solid fa-rotate-left" style="font-size:0.75rem; margin-right: 4px;"></i> 装飾をリセット
                            </button>
                            <div class="shift-format-feedback" aria-live="polite"></div>
                        </div>
                    </div>
                </div>
                <div class="shift-note-text" contenteditable="true" spellcheck="false" data-placeholder="連絡内容を入力（Alt+Enterで改行）">${html ? this.sanitizeShiftNoteHtml(html) : this.shiftNoteTextToHtml(text)}</div>
                <div class="shift-row-actions">
                    <div class="shift-row-action-strip">
                        <button type="button" class="shift-row-shift-stamp early" title="カーソル位置に早番スタンプ" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.insertShiftNoteShiftStamp(this, 'early')">早</button>
                        <button type="button" class="shift-row-shift-stamp late" title="カーソル位置に遅番スタンプ" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.insertShiftNoteShiftStamp(this, 'late')">遅</button>
                        <button type="button" class="shift-row-shift-stamp night" title="カーソル位置に深夜番スタンプ" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.insertShiftNoteShiftStamp(this, 'night')">深</button>
                        <button type="button" class="icon-btn shift-row-reply shift-action-input" title="この行へリプライ" onclick="app.addShiftNotebookReplyRow(this)"><i class="fa-solid fa-reply"></i></button>
                        <button type="button" class="icon-btn shift-row-todo-request shift-action-input" title="この行をToDoへ依頼" onclick="app.openShiftRowTodoRequest(this)">依</button>
                        <button type="button" class="icon-btn shift-row-important-btn shift-action-mark ${important ? 'active' : ''}" title="重要スタンプ" onclick="app.toggleShiftNotebookRowImportant(this)">重</button>
                        <button type="button" class="icon-btn shift-row-5s-btn shift-action-mark ${fiveS ? 'active' : ''}" title="5Sスタンプ" onclick="app.toggleShiftNotebookRow5S(this)">5S</button>
                        <button type="button" class="icon-btn shift-row-reply-toggle" title="返信を表示/折りたたみ" onclick="app.toggleShiftNotebookReplies(this)" hidden><i class="fa-solid fa-chevron-down"></i><span class="shift-row-reply-count">0</span></button>
                        <button type="button" class="icon-btn shift-row-responder shift-action-input" title="返信者スタンプ" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.toggleShiftResponderMenu(this)"><i class="fa-solid fa-user-pen"></i></button>
                        <button type="button" class="icon-btn shift-row-check-insert shift-action-mark" title="カーソル位置に✅を挿入" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.insertShiftNoteCheckMark(this)">✅</button>
                    </div>
                    <div class="shift-row-action-strip">
                        <button type="button" class="icon-btn shift-row-add-below shift-action-structure" title="この行の下に新規行を追加" onclick="app.addShiftNotebookRowBelow(this)"><i class="fa-solid fa-plus"></i></button>
                        <button type="button" class="icon-btn shift-row-fullscreen shift-action-view" title="フルスクリーン表示" onclick="app.openShiftNoteFullscreen(this)"><i class="fa-solid fa-expand"></i></button>
                        <button type="button" class="icon-btn shift-row-paste-settings shift-action-organize" title="この行の貼り付け整形" onclick="app.openShiftNoteRowPasteSettings(this)"><i class="fa-solid fa-paste"></i></button>
                        <button type="button" class="icon-btn shift-row-break-line-toggle shift-action-view" title="改行ラインを非表示" onclick="app.toggleShiftNotebookBreakLine()"><i class="fa-solid fa-eye-slash"></i></button>
                        <button type="button" class="icon-btn shift-row-trim-blank-lines shift-action-organize" title="空白行を削除" onclick="app.removeShiftNoteBlankLines(this)"><i class="fa-solid fa-align-justify"></i></button>
                        <button type="button" class="icon-btn shift-photo-collapse-btn shift-action-view" title="写真一覧を折りたたみ" onclick="app.toggleShiftPhotoPreviews(this)" aria-label="写真一覧を折りたたみ">
                            <i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="icon-btn shift-row-delete" title="この行を削除"><i class="fa-solid fa-trash-can"></i></button>
                        <label class="shift-row-hide-toggle" title="引継ぎ時にあえて伝えなくてよい行へチェックします。上部の非表示ボタンで、チェックした行だけ一時的に隠せます。" aria-label="非表示対象">
                            <input type="checkbox" class="shift-row-hide-checkbox" ${hidden ? 'checked' : ''}>
                            <span class="shift-row-hide-icon" aria-hidden="true"><i class="fa-solid fa-tv"></i><i class="fa-solid fa-slash"></i></span>
                        </label>
                    </div>
                    <div class="shift-responder-menu"></div>
                </div>
            </div>
            <div class="shift-reply-collapse-summary" hidden></div>
            <div class="shift-photo-area">
                <div class="shift-photo-tools">
                    <label class="shift-photo-btn" for="${rowId}-photo" title="写真を追加" aria-label="写真を追加">
                        <i class="fa-solid fa-camera" aria-hidden="true"></i>
                    </label>
                    <button type="button" class="shift-photo-compare-btn" title="複数写真を並べて拡大表示" onclick="app.openShiftPhotoCompare(this)" aria-label="複数写真を並べて拡大表示">
                        <i class="fa-solid fa-images" aria-hidden="true"></i>
                    </button>
                </div>
                <input type="file" id="${rowId}-photo" class="shift-photo-input" accept="image/*" multiple>
                <div class="shift-photo-previews"></div>
            </div>
        `;
        container.appendChild(row);
        const suddenButton = document.createElement('button');
        suddenButton.type = 'button';
        suddenButton.className = 'icon-btn shift-row-sudden-register shift-action-input';
        suddenButton.title = 'この行を突発対応として登録';
        suddenButton.textContent = '登';
        suddenButton.onclick = () => this.openSuddenRecordFromShiftRow(suddenButton);
        row.querySelector('.shift-row-important-btn')?.insertAdjacentElement('beforebegin', suddenButton);
        const suddenStamp = row.querySelector('.shift-sudden-registered-stamp');
        if (suddenStamp) {
            suddenStamp.removeAttribute('aria-hidden');
            suddenStamp.setAttribute('role', 'button');
            suddenStamp.setAttribute('tabindex', '0');
            suddenStamp.title = '該当のメンテナンス記録を編集';
            suddenStamp.onclick = () => this.openShiftSuddenRegisteredHistory(row);
            suddenStamp.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.openShiftSuddenRegisteredHistory(row);
                }
            };
        }
        this.updateShiftNoteRowPasteButton(row);
        this.updateShiftNotebookBreakLineVisibility();
        const rowEditor = row.querySelector('.shift-note-text');
        rowEditor?.style.setProperty('--shift-break-line', `${this.getShiftNotePasteFormatSettings().ratioPercent}%`);
        requestAnimationFrame(() => this.positionShiftSuddenRegisteredStamp(row));
        const fiveSStamp = row.querySelector('.shift-5s-stamp');
        if (fiveSStamp) {
            fiveSStamp.removeAttribute('aria-hidden');
            fiveSStamp.setAttribute('role', 'button');
            fiveSStamp.setAttribute('tabindex', '0');
            fiveSStamp.title = '5S管理でこの履歴を確認';
            fiveSStamp.onclick = () => this.openFiveSManagementFromShiftNotebook(row);
            fiveSStamp.onkeydown = (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.openFiveSManagementFromShiftNotebook(row);
                }
            };
        }
        this.updateShiftNotebookRow5SStampStatus(row);

        const preview = row.querySelector('.shift-photo-previews');
        const editor = row.querySelector('.shift-note-text');
        const dragHandle = row.querySelector('.shift-row-drag-handle');
        editor.addEventListener('dragover', (e) => {
            if (this.getShiftMemberStampDragName(e)) {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                return;
            }
            if (!this.getShiftRowGroupStampDragGroup(e)) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            const insertAfter = this.getShiftNotebookDragInsertAfter(null, row, e);
            this.updateShiftNotebookDragIndicator(row, insertAfter);
        });
        editor.addEventListener('drop', (e) => {
            const memberName = this.getShiftMemberStampDragName(e);
            if (memberName) {
                e.preventDefault();
                e.stopPropagation();
                this.appendShiftNoteMemberStamp(editor, memberName);
                this.finishShiftMemberStampDrag();
                return;
            }
            const stampGroup = this.getShiftRowGroupStampDragGroup(e);
            if (!stampGroup) return;
            e.preventDefault();
            e.stopPropagation();
            const containerEl = document.getElementById('shift-notebook-rows');
            const insertAfter = this.getShiftNotebookDragInsertAfter(null, row, e);
            this.clearShiftNotebookDragIndicators(containerEl);
            this.insertShiftNotebookBlankRowFromGroupStamp(stampGroup, insertAfter ? row.nextSibling : row);
            this.finishShiftRowGroupStampDrag();
        });
        dragHandle?.addEventListener('dragstart', (e) => {
            e.dataTransfer?.setData('text/plain', row.dataset.shiftRowId || '');
            e.dataTransfer.effectAllowed = 'move';
            row.classList.add('dragging');
            document.body.classList.add('shift-row-dragging-active');
        });
        dragHandle?.addEventListener('dragend', () => {
            row.classList.remove('dragging');
            document.body.classList.remove('shift-row-dragging-active');
            this.clearShiftNotebookDragIndicators();
        });
        row.addEventListener('dragover', (e) => {
            const stampGroup = this.getShiftRowGroupStampDragGroup(e);
            if (stampGroup) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                const insertAfter = this.getShiftNotebookDragInsertAfter(null, row, e);
                this.updateShiftNotebookDragIndicator(row, insertAfter);
                return;
            }
            const dragging = document.querySelector('.shift-notebook-row.dragging');
            if (!dragging || dragging === row) return;
            if (!this.canDropShiftNotebookRowOnTarget(dragging, row)) {
                this.clearShiftNotebookDragIndicators();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
                return;
            }
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            const insertAfter = this.getShiftNotebookDragInsertAfter(dragging, row, e);
            this.updateShiftNotebookDragIndicator(row, insertAfter);
        });
        row.addEventListener('dragleave', () => {
            row.classList.remove('drag-over', 'drag-insert-before', 'drag-insert-after');
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            const stampGroup = this.getShiftRowGroupStampDragGroup(e);
            if (stampGroup) {
                const containerEl = document.getElementById('shift-notebook-rows');
                const insertAfter = this.getShiftNotebookDragInsertAfter(null, row, e);
                this.clearShiftNotebookDragIndicators(containerEl);
                this.insertShiftNotebookBlankRowFromGroupStamp(stampGroup, insertAfter ? row.nextSibling : row);
                this.finishShiftRowGroupStampDrag();
                return;
            }
            const dragging = document.querySelector('.shift-notebook-row.dragging');
            const containerEl = document.getElementById('shift-notebook-rows');
            this.clearShiftNotebookDragIndicators(containerEl);
            if (!dragging || !containerEl || dragging === row) return;
            if (!this.canDropShiftNotebookRowOnTarget(dragging, row)) {
                this.sortShiftNotebookRowsInDom();
                return;
            }
            const insertAfter = this.getShiftNotebookDragInsertAfter(dragging, row, e);
            containerEl.insertBefore(dragging, insertAfter ? row.nextSibling : row);
            this.sortShiftNotebookRowsInDom();
            this.autoSaveShiftNotebook(true);
        });
        const resizeEditor = () => {
            editor.style.height = 'auto';
            editor.style.height = editor.scrollHeight + 'px';
        };
        editor.addEventListener('click', (e) => {
            const stamp = this.getShiftNoteInlineStampElement(e.target);
            if (stamp && editor.contains(stamp)) {
                e.preventDefault();
                if (this.isShiftNoteInlineStampCloseClick(e, stamp) && this.removeShiftNoteInlineStamp(stamp, editor)) {
                    resizeEditor();
                    return;
                }
                this.selectShiftNoteInlineStamp(stamp, editor);
                return;
            }
            this.clearShiftNoteInlineStampSelection(editor);
        });
        editor.addEventListener('input', resizeEditor);
        editor.addEventListener('input', () => {
            this.updateUnusedBlankShiftNotebookRowCount();
            this.scheduleShiftNotebookAutoSave();
        });
        editor.addEventListener('paste', (e) => this.insertShiftNoteClipboardContent(editor, e));
        editor.addEventListener('mouseup', () => {
            this.saveShiftNoteSelection(editor);
            this.ensureShiftNoteActiveFormat(editor);
        });
        editor.addEventListener('keyup', (e) => {
            this.saveShiftNoteSelection(editor);
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                this.ensureShiftNoteActiveFormat(editor);
            }
        });
        editor.addEventListener('focus', () => this.ensureShiftNoteActiveFormat(editor));
        editor.addEventListener('compositionstart', () => {
            editor._isComposing = true;
            this.ensureShiftNoteActiveFormat(editor);
        });
        editor.addEventListener('compositionend', () => {
            editor._isComposing = false;
            this.saveShiftNoteSelection(editor);
            resizeEditor();
            this.updateUnusedBlankShiftNotebookRowCount();
            this.scheduleShiftNotebookAutoSave();
        });
        editor.addEventListener('blur', () => {
            this.autoSaveShiftNotebook(true);
            this.sortShiftNotebookRowsInDom();
        });
        editor.addEventListener('keydown', (e) => {
            // アクティブ装飾モード: 印刷可能な文字入力時にスタイルを適用
            if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const currentRow = editor.closest('.shift-notebook-row');
                const rows = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'));
                if (currentRow && rows[rows.length - 1] === currentRow) {
                    e.preventDefault();
                    this.addShiftNotebookRowBelow(currentRow);
                    return;
                }
            }
            if (e.key === 'Backspace' || e.key === 'Delete') {
                if (this.removeSelectedShiftNoteInlineStamp(editor)) {
                    e.preventDefault();
                    resizeEditor();
                    return;
                }
                requestAnimationFrame(() => {
                    this.cleanupShiftNoteEmptySpans(editor);
                    this.saveShiftNoteSelection(editor);
                });
            }
            if (e.key !== 'Enter') {
                if (e.isComposing || editor._isComposing || e.key === 'Process') return;
                const f = this._activeShiftNoteFormats;
                const hasActive = f.color || f.size || f.font;
                if (hasActive && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    const wrapper = document.createElement('span');
                    if (f.color) wrapper.style.color = f.color;
                    if (f.size) wrapper.style.fontSize = f.size;
                    if (f.font) wrapper.style.fontFamily = f.font;
                    wrapper.textContent = e.key;
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                        const r = sel.getRangeAt(0);
                        if (editor.contains(r.commonAncestorContainer)) {
                            r.deleteContents();
                            r.insertNode(wrapper);
                            const afterRange = document.createRange();
                            afterRange.setStartAfter(wrapper);
                            afterRange.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(afterRange);
                            editor._savedRange = afterRange.cloneRange();
                            resizeEditor();
                            this.scheduleShiftNotebookAutoSave();
                        }
                    }
                }
                return;
            }
            if (e.altKey) {
                e.preventDefault();
                document.execCommand('insertLineBreak');
                resizeEditor();
                this.scheduleShiftNotebookAutoSave();
            } else {
                e.preventDefault();
            }
        });
        // アクティブ装飾モードのインジケーターを初期反映
        this._updateShiftNoteFormatIndicator(row);
        requestAnimationFrame(resizeEditor);

        const appendPreview = (photo) => {
            const photoData = this.normalizeShiftNotebookPhoto(photo);
            if (!photoData.src) return;
            const div = this.createPhotoPreviewElement(photoData.src, null, null, 74);
            div.classList.add('shift-photo-item');
            div.dataset.shiftPhotoMarks = JSON.stringify(photoData.marks || []);
            div.insertAdjacentHTML('beforeend', `
                <span class="shift-photo-mark-badge" title="写真比較で記号・文字の注記があります"><i class="fa-solid fa-pen"></i></span>
                <div class="shift-photo-caption-row">
                    <div class="shift-photo-caption-control">
                        <button type="button" class="shift-photo-caption-toggle" title="写真メモを入力">名</button>
                        <input type="text" class="shift-photo-caption" value="${this.escapeHtml(photoData.caption)}" placeholder="写真メモ">
                    </div>
                    <div class="shift-photo-caption-preset">
                        <button type="button" class="shift-photo-caption-select" title="写真メモの候補を選択" aria-label="写真メモ候補">候</button>
                        <div class="shift-photo-caption-menu" hidden>
                            ${this.renderShiftPhotoCaptionPresetMenu(photoData.caption)}
                        </div>
                    </div>
                </div>
            `);
            const captionInput = div.querySelector('.shift-photo-caption');
            const captionControl = div.querySelector('.shift-photo-caption-control');
            const captionToggle = div.querySelector('.shift-photo-caption-toggle');
            const captionSelect = div.querySelector('.shift-photo-caption-select');
            const captionMenu = div.querySelector('.shift-photo-caption-menu');
            const updateCaptionToggle = () => {
                if (!captionToggle || !captionInput) return;
                const value = captionInput.value.trim();
                captionToggle.textContent = value ? value.charAt(0) : '名';
                captionToggle.title = value ? `写真メモ: ${value}` : '写真メモを入力';
                captionToggle.classList.toggle('has-value', !!value);
            };
            const closeCaptionInput = () => {
                captionControl?.classList.remove('editing');
                updateCaptionToggle();
            };
            updateCaptionToggle();
            captionToggle?.addEventListener('click', () => {
                captionControl?.classList.add('editing');
                captionInput?.focus();
                captionInput?.select();
            });
            captionInput?.addEventListener('input', () => {
                updateCaptionToggle();
                this.scheduleShiftNotebookAutoSave();
            });
            captionInput?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    captionInput.blur();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    closeCaptionInput();
                }
            });
            captionInput?.addEventListener('blur', () => {
                closeCaptionInput();
                this.autoSaveShiftNotebook(true);
            });
            captionSelect?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeShiftPhotoCaptionPresetMenus(captionMenu);
                const willOpen = captionMenu?.hidden;
                if (!captionMenu) return;
                captionMenu.hidden = !willOpen;
                if (willOpen) {
                    this.updateShiftPhotoCaptionPresetHighlights(captionMenu, this._lastShiftPhotoCaptionPreset || captionInput?.value || '');
                }
            });
            captionMenu?.addEventListener('click', (e) => {
                const deleteButton = e.target.closest('.shift-photo-caption-delete');
                if (deleteButton) {
                    e.stopPropagation();
                    const value = deleteButton.dataset.value || '';
                    this.deleteShiftPhotoCaptionPreset(value);
                    if (captionInput?.value.trim() === value) {
                        captionInput.value = '';
                        updateCaptionToggle();
                        this.scheduleShiftNotebookAutoSave();
                        this.autoSaveShiftNotebook(true);
                    }
                    this.refreshShiftPhotoCaptionPresetMenus(this._lastShiftPhotoCaptionPreset || captionInput?.value || '');
                    const nextMenu = div.querySelector('.shift-photo-caption-menu');
                    if (nextMenu) {
                        nextMenu.hidden = false;
                        this.updateShiftPhotoCaptionPresetHighlights(nextMenu, this._lastShiftPhotoCaptionPreset || captionInput?.value || '');
                    }
                    return;
                }
                const addButton = e.target.closest('.shift-photo-caption-add-btn');
                if (addButton) {
                    e.stopPropagation();
                    const addInput = captionMenu.querySelector('.shift-photo-caption-add-input');
                    const pairInput = captionMenu.querySelector('.shift-photo-caption-pair-input');
                    const value = addInput?.value.trim() || '';
                    if (!value) {
                        addInput?.focus();
                        return;
                    }
                    this.addShiftPhotoCaptionPreset(value, pairInput?.value.trim() || '');
                    this.refreshShiftPhotoCaptionPresetMenus(value);
                    if (captionInput) {
                        captionInput.value = value;
                        this._lastShiftPhotoCaptionPreset = value;
                        updateCaptionToggle();
                    }
                    this.closeShiftPhotoCaptionPresetMenus(captionMenu);
                    captionMenu.hidden = false;
                    this.updateShiftPhotoCaptionPresetHighlights(captionMenu, value);
                    this.scheduleShiftNotebookAutoSave();
                    this.autoSaveShiftNotebook(true);
                    return;
                }
                const option = e.target.closest('.shift-photo-caption-option');
                if (!option || !captionInput) return;
                e.stopPropagation();
                const value = option.dataset.value || '';
                captionInput.value = value;
                this._lastShiftPhotoCaptionPreset = value;
                updateCaptionToggle();
                captionMenu.hidden = true;
                this.scheduleShiftNotebookAutoSave();
                this.autoSaveShiftNotebook(true);
            });
            captionMenu?.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                const addInput = e.target.closest('.shift-photo-caption-add-input');
                if (!addInput) return;
                e.preventDefault();
                captionMenu.querySelector('.shift-photo-caption-add-btn')?.click();
            });
            if (!this._shiftPhotoCaptionPresetCloseBound) {
                this._shiftPhotoCaptionPresetCloseBound = (e) => {
                    if (!e.target?.closest?.('.shift-photo-caption-preset')) this.closeShiftPhotoCaptionPresetMenus();
                };
                document.addEventListener('click', this._shiftPhotoCaptionPresetCloseBound);
            }
            div.querySelector('.close-btn')?.addEventListener('click', () => {
                requestAnimationFrame(() => this.updateShiftPhotoToolState(row));
            });
            preview.appendChild(div);
            this.updateShiftPhotoToolState(row);
        };
        (photos || []).forEach(appendPreview);
        this.updateShiftPhotoToolState(row);
        const shiftPhotoInput = row.querySelector('.shift-photo-input');
        if (shiftPhotoInput) {
            shiftPhotoInput._shiftPhotoAddSrc = (src) => {
                appendPreview(src);
                this.updateShiftPhotoToolState(row);
                this.updateUnusedBlankShiftNotebookRowCount();
                this.autoSaveShiftNotebook(true);
            };
        }

        row.querySelector('.shift-row-delete').onclick = () => {
            const deleteRows = this.getShiftNotebookRowsForCascadeDelete(row);
            const replyDeleteCount = Math.max(0, deleteRows.length - 1);
            if (replyDeleteCount > 0 && !confirm(`この行には返信${replyDeleteCount}件があります。返信も一緒に削除しますか？`)) return;
            const rowDataList = deleteRows.map(targetRow => this.getShiftNotebookRowDataFromElement(targetRow)).filter(Boolean);
            const rowData = rowDataList[0] || this.getShiftNotebookRowDataFromElement(row);
            const deleteSet = new Set(deleteRows);
            let nextSibling = row.nextElementSibling;
            while (nextSibling && deleteSet.has(nextSibling)) nextSibling = nextSibling.nextElementSibling;
            if (container.querySelectorAll('.shift-notebook-row').length === 1 && replyDeleteCount === 0) {
                row.querySelector('.shift-note-text').innerHTML = '';
                preview.innerHTML = '';
                this.updateShiftPhotoToolState(row);
                this.updateUnusedBlankShiftNotebookRowCount();
                this.autoSaveShiftNotebook(true);
                this.showShiftNotebookUndoNotice('行を空にしました', () => {
                    if (!rowData) return;
                    this.addShiftNotebookRow(containerId, rowData.text, rowData.photos, rowData.tag, rowData.group, rowData.html, rowData.hidden, true, rowData.id, rowData.replyTo, !!rowData.important, rowData.pasteFormat || null, !!rowData.suddenRegistered, rowData.suddenHistoryId || '', !!rowData.fiveS, rowData.photoCompareMarks || [], rowData.fiveSAssigneeId || '');
                    const restored = container.lastElementChild;
                    if (restored && row.parentNode) {
                        row.replaceWith(restored);
                    }
                    this.updateShiftNotebookGroupCorners();
                    this.updateUnusedBlankShiftNotebookRowCount();
                    this.autoSaveShiftNotebook(true);
                });
                return;
            }
            deleteRows.forEach(targetRow => targetRow.remove());
            this.updateShiftNotebookGroupCorners();
            this.updateUnusedBlankShiftNotebookRowCount();
            this.autoSaveShiftNotebook(true);
            this.showShiftNotebookUndoNotice(replyDeleteCount > 0 ? `行と返信${replyDeleteCount}件を削除しました` : '行を削除しました', () => {
                if (!rowDataList.length) return;
                this.restoreShiftNotebookRowsFromData(containerId, rowDataList, nextSibling);
                this.updateShiftNotebookGroupCorners();
                this.updateUnusedBlankShiftNotebookRowCount();
                this.autoSaveShiftNotebook(true);
            });
        };

        row.querySelector('.shift-photo-input').onchange = async (e) => {
            const files = Array.from(e.target.files || []);
            for (const file of files) {
                const base64 = await MaintenanceStore.resizeImage(file, 1600, 0.88);
                appendPreview(base64);
            }
            e.target.value = '';
            this.updateShiftPhotoToolState(row);
            this.updateUnusedBlankShiftNotebookRowCount();
            this.autoSaveShiftNotebook(true);
        };
        row.querySelector('.shift-row-group-select')?.addEventListener('change', () => {
            row.dataset.preserveBlank = 'true';
            this.updateUnusedBlankShiftNotebookRowCount();
            this.autoSaveShiftNotebook(true);
            this.sortShiftNotebookRowsInDom();
        });
        row.querySelector('.shift-row-hide-checkbox')?.addEventListener('change', () => {
            this.updateShiftNotebookHiddenRows();
            this.autoSaveShiftNotebook(true);
        });
        return row;
    }

    parseShiftPhotoCompareMarks(value = '[]') {
        try {
            const marks = JSON.parse(value || '[]');
            if (!Array.isArray(marks)) return [];
            return marks.map(mark => ({
                mode: ['circle', 'arrow', 'rect', 'text', 'number', 'xmark', 'freehand', 'mosaic', 'image'].includes(mark.mode) ? mark.mode : 'circle',
                x: Math.max(0, Math.min(100, Number(mark.x) || 0)),
                y: Math.max(0, Math.min(100, Number(mark.y) || 0)),
                size: Math.max(24, Math.min(mark.mode === 'mosaic' ? 1200 : 700, Number(mark.size) || 56)),
                angle: Math.max(0, Math.min(360, Number(mark.angle) || 0)),
                stretch: Math.max(mark.mode === 'mosaic' ? 0.05 : 0.5, Math.min(mark.mode === 'mosaic' ? 12 : 5, Number(mark.stretch) || 1)),
                stretchY: Math.max(mark.mode === 'mosaic' ? 0.05 : 0.5, Math.min(mark.mode === 'mosaic' ? 12 : 2.6, Number(mark.stretchY) || 1)),
                stroke: Math.max(0.35, Math.min(3, Number(mark.stroke) || 1)),
                outline: mark.outline === false ? false : true,
                color: /^#[0-9a-f]{6}$/i.test(mark.color || '') ? mark.color : '#dc2626',
                text: String(mark.text || '').slice(0, 80),
                imageSrc: /^data:image\//i.test(mark.imageSrc || '') ? mark.imageSrc : '',
                originalImageSrc: /^data:image\//i.test(mark.originalImageSrc || '') ? mark.originalImageSrc : '',
                flipX: mark.flipX === -1 || mark.flipX === '-1' ? -1 : 1,
                flipY: mark.flipY === -1 || mark.flipY === '-1' ? -1 : 1,
                font: this.getShiftPhotoCompareSafeFont(mark.font),
                anchor: mark.anchor === 'left' ? 'left' : 'center',
                pairId: /^[a-z0-9_-]{4,40}$/i.test(mark.pairId || '') ? mark.pairId : '',
                pairRole: ['number', 'text'].includes(mark.pairRole || '') ? mark.pairRole : '',
                wrapWidth: Math.max(0, Number(mark.wrapWidth) || 0),
                wrapHeight: Math.max(0, Number(mark.wrapHeight) || 0),
                imageX: Number.isFinite(Number(mark.imageX)) ? Math.max(-20, Math.min(120, Number(mark.imageX))) : null,
                imageY: Number.isFinite(Number(mark.imageY)) ? Math.max(-20, Math.min(120, Number(mark.imageY))) : null,
                imageDisplayWidth: Math.max(0, Number(mark.imageDisplayWidth) || 0),
                imageDisplayHeight: Math.max(0, Number(mark.imageDisplayHeight) || 0),
                imagePoints: Array.isArray(mark.imagePoints) ? mark.imagePoints.map(point => ({
                    x: Math.max(-20, Math.min(120, Number(point.x) || 0)),
                    y: Math.max(-20, Math.min(120, Number(point.y) || 0))
                })).slice(0, 500) : [],
                points: Array.isArray(mark.points) ? mark.points.map(point => ({
                    x: Math.max(0, Math.min(100, Number(point.x) || 0)),
                    y: Math.max(0, Math.min(100, Number(point.y) || 0))
                })).slice(0, 500) : []
            }));
        } catch {
            return [];
        }
    }

    getShiftPhotoCompareSafeFont(font = '') {
        const fonts = {
            gothic: true,
            meiryo: true,
            mincho: true,
            maru: true,
            pop: true,
            brush: true,
            hand: true,
            digital: true,
            retro: true,
            elegant: true
        };
        return fonts[font] ? font : 'gothic';
    }

    getShiftPhotoCompareFontFamily(font = '') {
        const key = this.getShiftPhotoCompareSafeFont(font);
        const fonts = {
            gothic: "'Yu Gothic', 'Meiryo', sans-serif",
            meiryo: "'Meiryo', sans-serif",
            mincho: "'Yu Mincho', 'MS Mincho', serif",
            maru: "'UD Digi Kyokasho N-R', 'Yu Gothic', 'Meiryo', sans-serif",
            pop: "'HGS創英角ﾎﾟｯﾌﾟ体', 'HGSSoeiKakupoptai', 'Yu Gothic', 'Meiryo', sans-serif",
            brush: "'HGP行書体', 'HG行書体', 'Yu Mincho', 'MS Mincho', serif",
            hand: "'Segoe Print', 'HGS教科書体', 'UD Digi Kyokasho N-R', 'Yu Gothic', 'Meiryo', cursive",
            digital: "'OCR A Extended', 'Consolas', 'MS Gothic', monospace",
            retro: "'BIZ UDMincho', 'HGS明朝E', 'Yu Mincho', 'MS Mincho', serif",
            elegant: "'BIZ UDPMincho', 'Yu Mincho', 'MS Mincho', serif"
        };
        return fonts[key];
    }

    getShiftPhotoCompareMarkHtml(mark = {}) {
        const mode = ['circle', 'arrow', 'rect', 'text', 'number', 'xmark', 'freehand', 'mosaic', 'image'].includes(mark.mode) ? mark.mode : 'circle';
        const x = Math.max(0, Math.min(100, Number(mark.x) || 0));
        const y = Math.max(0, Math.min(100, Number(mark.y) || 0));
        const size = Math.max(24, Math.min(mode === 'mosaic' ? 1200 : 700, Number(mark.size) || 56));
        const angle = Math.max(0, Math.min(360, Number(mark.angle) || 0));
        const stretch = Math.max(mode === 'mosaic' ? 0.05 : 0.5, Math.min(mode === 'mosaic' ? 12 : 5, Number(mark.stretch) || 1));
        const stretchY = Math.max(mode === 'mosaic' ? 0.05 : 0.5, Math.min(mode === 'mosaic' ? 12 : 2.6, Number(mark.stretchY) || 1));
        const stroke = Math.max(0.35, Math.min(3, Number(mark.stroke) || 1));
        const outline = mark.outline === false ? false : true;
        const color = /^#[0-9a-f]{6}$/i.test(mark.color || '') ? mark.color : '#dc2626';
        const text = String(mark.text || '').slice(0, 120);
        const imageSrc = /^data:image\//i.test(mark.imageSrc || '') ? mark.imageSrc : '';
        const originalImageSrc = /^data:image\//i.test(mark.originalImageSrc || '') ? mark.originalImageSrc : '';
        const opacity = Math.max(0.1, Math.min(1, Number(mark.opacity) || 1));
        const flipX = mark.flipX === -1 || mark.flipX === '-1' ? -1 : 1;
        const flipY = mark.flipY === -1 || mark.flipY === '-1' ? -1 : 1;
        const font = this.getShiftPhotoCompareSafeFont(mark.font);
        const anchor = mark.anchor === 'left' ? 'left' : 'center';
        const pairId = /^[a-z0-9_-]{4,40}$/i.test(mark.pairId || '') ? mark.pairId : '';
        const pairRole = ['number', 'text'].includes(mark.pairRole || '') ? mark.pairRole : '';
        const groupId = /^[a-z0-9_-]{4,40}$/i.test(mark.groupId || '') ? mark.groupId : '';
        const locked = mark.locked === true || mark.locked === '1';
        const lockedClass = locked ? ' locked' : '';
        const fontFamily = this.getShiftPhotoCompareFontFamily(font);
        const wrapWidth = Math.max(0, Number(mark.wrapWidth) || 0);
        const wrapHeight = Math.max(0, Number(mark.wrapHeight) || 0);
        const points = Array.isArray(mark.points) ? mark.points.map(point => ({
            x: Math.max(0, Math.min(100, Number(point.x) || 0)),
            y: Math.max(0, Math.min(100, Number(point.y) || 0))
        })).slice(0, 500) : [];
        const pointsText = points.map(point => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(' ');
        const common = `data-mode="${mode}" data-size="${size}" data-angle="${angle}" data-stretch="${stretch}" data-stretch-y="${stretchY}" data-stroke="${stroke}" data-outline="${outline ? '1' : '0'}" data-color="${this.escapeHtml(color)}" data-text="${this.escapeHtml(text)}" data-image-src="${this.escapeHtml(imageSrc)}" data-original-image-src="${this.escapeHtml(originalImageSrc)}" data-opacity="${opacity}" data-flip-x="${flipX}" data-flip-y="${flipY}" data-font="${font}" data-anchor="${anchor}" data-pair-id="${this.escapeHtml(pairId)}" data-pair-role="${pairRole}" data-group-id="${this.escapeHtml(groupId)}" data-locked="${locked ? '1' : '0'}" data-wrap-width="${wrapWidth}" data-wrap-height="${wrapHeight}" data-points="${this.escapeHtml(JSON.stringify(points))}"`;
        if (mode === 'freehand') {
            return `<div class="shift-photo-compare-mark ${mode}${lockedClass}" ${common} style="--mark-size:${size}px; --mark-stroke:${stroke}; --mark-color:${this.escapeHtml(color)};"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${this.escapeHtml(pointsText)}"></polyline></svg></div>`;
        }
        if (mode === 'image') {
            return `<div class="shift-photo-compare-mark ${mode}${lockedClass}" ${common} style="left:${x}%; top:${y}%; --mark-size:${size}px; --mark-rotate:${angle}deg; --mark-scale-x:${stretch}; --mark-scale-y:${stretchY}; --mark-stroke:${stroke}; --mark-color:${this.escapeHtml(color)}; --mark-font:${fontFamily}; --mark-opacity:${opacity};"><img src="${this.escapeHtml(imageSrc)}" alt=""></div>`;
        }
        const xmarkHtml = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M18 18 L82 82 M82 18 L18 82"></path></svg>';
        return `<div class="shift-photo-compare-mark ${mode}${lockedClass}" ${common} style="left:${x}%; top:${y}%; --mark-size:${size}px; --mark-rotate:${angle}deg; --mark-scale-x:${stretch}; --mark-scale-y:${stretchY}; --mark-stroke:${stroke}; --mark-color:${this.escapeHtml(color)}; --mark-font:${fontFamily};">${mode === 'arrow' ? '<span class="shift-photo-arrow-line"></span><span class="shift-photo-arrow-head"></span><span class="shift-photo-arrow-end start" data-arrow-end="start"></span><span class="shift-photo-arrow-end end" data-arrow-end="end"></span>' : (mode === 'xmark' ? xmarkHtml : (mode === 'text' || mode === 'number' ? this.escapeHtml(text) : ''))}</div>`;
    }

    readShiftPhotoCompareMarksFromWrap(wrap) {
        const wrapRect = wrap?.getBoundingClientRect?.();
        const wrapWidth = Math.max(1, Math.round(wrapRect?.width || Number(wrap?.dataset?.markWrapWidth) || 0));
        const wrapHeight = Math.max(1, Math.round(wrapRect?.height || Number(wrap?.dataset?.markWrapHeight) || 0));
        return Array.from(wrap?.querySelectorAll('.shift-photo-compare-mark') || []).map(mark => ({
            mode: mark.dataset.mode || (mark.classList.contains('arrow') ? 'arrow' : 'circle'),
            x: parseFloat(mark.style.left) || 0,
            y: parseFloat(mark.style.top) || 0,
            size: parseFloat(mark.dataset.size || '') || this._shiftPhotoCompareMarkSize || 56,
            angle: parseFloat(mark.dataset.angle || '') || 0,
            stretch: parseFloat(mark.dataset.stretch || '') || 1,
            stretchY: parseFloat(mark.dataset.stretchY || '') || 1,
            stroke: parseFloat(mark.dataset.stroke || '') || 1,
            outline: mark.dataset.outline !== '0',
            color: /^#[0-9a-f]{6}$/i.test(mark.dataset.color || '') ? mark.dataset.color : '#dc2626',
            text: String(mark.dataset.text || mark.textContent || '').slice(0, 120),
            imageSrc: /^data:image\//i.test(mark.dataset.imageSrc || '') ? mark.dataset.imageSrc : '',
            originalImageSrc: /^data:image\//i.test(mark.dataset.originalImageSrc || '') ? mark.dataset.originalImageSrc : '',
            opacity: Math.max(0.1, Math.min(1, parseFloat(mark.dataset.opacity || '') || 1)),
            flipX: mark.dataset.flipX === '-1' ? -1 : 1,
            flipY: mark.dataset.flipY === '-1' ? -1 : 1,
            font: this.getShiftPhotoCompareSafeFont(mark.dataset.font || ''),
            anchor: mark.dataset.anchor === 'left' ? 'left' : 'center',
            pairId: /^[a-z0-9_-]{4,40}$/i.test(mark.dataset.pairId || '') ? mark.dataset.pairId : '',
            pairRole: ['number', 'text'].includes(mark.dataset.pairRole || '') ? mark.dataset.pairRole : '',
            groupId: /^[a-z0-9_-]{4,40}$/i.test(mark.dataset.groupId || '') ? mark.dataset.groupId : '',
            locked: mark.dataset.locked === '1',
            wrapWidth,
            wrapHeight,
            points: this.parseShiftPhotoCompareFreehandPoints(mark.dataset.points || '[]')
        }));
    }

    addShiftPhotoCompareImageCoordinates(marks = [], wrap) {
        const wrapRect = wrap?.getBoundingClientRect?.();
        const imageRect = this.getShiftPhotoCompareDisplayImageRect(wrap);
        if (!wrapRect?.width || !wrapRect?.height || !imageRect?.width || !imageRect?.height) return marks;
        const imageLeft = imageRect.left - wrapRect.left;
        const imageTop = imageRect.top - wrapRect.top;
        return marks.map(mark => {
            const next = {
                ...mark,
                imageDisplayWidth: imageRect.width,
                imageDisplayHeight: imageRect.height
            };
            if (mark.mode === 'freehand') {
                next.imagePoints = this.parseShiftPhotoCompareFreehandPoints(JSON.stringify(mark.points || []))
                    .map(point => ({
                        x: ((point.x / 100 * wrapRect.width - imageLeft) / imageRect.width) * 100,
                        y: ((point.y / 100 * wrapRect.height - imageTop) / imageRect.height) * 100
                    }));
            } else {
                next.imageX = (((Number(mark.x) || 0) / 100 * wrapRect.width - imageLeft) / imageRect.width) * 100;
                next.imageY = (((Number(mark.y) || 0) / 100 * wrapRect.height - imageTop) / imageRect.height) * 100;
            }
            return next;
        });
    }

    parseShiftPhotoCompareFreehandPoints(value = '[]') {
        try {
            const points = JSON.parse(value || '[]');
            if (!Array.isArray(points)) return [];
            return points.map(point => ({
                x: Math.max(0, Math.min(100, Number(point.x) || 0)),
                y: Math.max(0, Math.min(100, Number(point.y) || 0))
            })).slice(0, 500);
        } catch {
            return [];
        }
    }

    syncShiftPhotoCompareMarks(wrap) {
        const photoIndex = Number(wrap?.dataset.photoIndex);
        const context = this._shiftPhotoCompareContext;
        if (!context || !Number.isFinite(photoIndex)) return;
        const photo = context.photos?.[photoIndex];
        let marks = this.readShiftPhotoCompareMarksFromWrap(wrap);
        if (context.source === 'guide') marks = this.addShiftPhotoCompareImageCoordinates(marks, wrap);
        if (photo) photo.marks = marks;
        const previewItem = photo?.previewItem;
        if (previewItem) previewItem.dataset.shiftPhotoMarks = JSON.stringify(marks);
        if (context.onSync) context.onSync(context);
        this.flashShiftPhotoCompareSaved(photoIndex);
        if (context.row) {
            this.updateShiftPhotoToolState(context.row);
            this.scheduleShiftNotebookAutoSave();
        }
    }

    syncShiftPhotoCompareGlobalMarks(layer = document.querySelector('.shift-photo-compare-global-layer')) {
        const context = this._shiftPhotoCompareContext;
        if (!context || !layer) return;
        const marks = this.readShiftPhotoCompareMarksFromWrap(layer);
        context.globalMarks = marks;
        if (context.row) {
            context.row.dataset.shiftPhotoGlobalMarks = JSON.stringify(marks);
            this.updateShiftPhotoToolState(context.row);
            this.scheduleShiftNotebookAutoSave();
        }
        context.onSync?.(context);
    }

    getShiftPhotoCompareCaptionCleanBody(caption = '') {
        return String(caption || '')
            .replace(/^\s*(対応前|対応後|清掃前|清掃後|交換前|交換後|点検前|点検後|修理前|修理後|改善前|改善後|Before|After|ビフォー|アフター|作業前|作業後|前|後)\s*[:：\-ー]?\s*/i, '')
            .trim();
    }

    getShiftPhotoCompareRoleLabel(role = '') {
        if (role === 'before') return 'Before';
        if (role === 'after') return 'After';
        return '';
    }

    updateShiftPhotoComparePhotoPairMeta(photo) {
        if (!photo) return;
        const caption = photo.caption || '';
        const numbers = this.getShiftPhotoCompareNumbers(caption);
        photo.role = this.inferShiftPhotoCompareRole(caption);
        photo.setKey = this.getShiftPhotoCompareSetKey(caption);
        photo.numbers = numbers;
        photo.orderNumber = numbers[0] ?? null;
        photo.pairNumber = numbers.length >= 2 ? numbers[0] : null;
        photo.pairStep = numbers.length >= 2 ? numbers[1] : null;
    }

    syncShiftPhotoComparePhotoMeta(photoIndex) {
        const context = this._shiftPhotoCompareContext;
        const index = Number(photoIndex);
        if (!context || !Number.isFinite(index)) return;
        const photo = context.photos?.[index];
        if (!photo) return;
        this.updateShiftPhotoComparePhotoPairMeta(photo);
        const previewItem = photo.previewItem;
        if (previewItem) {
            const captionInput = previewItem.querySelector('.shift-photo-caption');
            if (captionInput) captionInput.value = photo.caption || '';
        }
        context.onSync?.(context);
        this.flashShiftPhotoCompareSaved(index);
        if (context.row) {
            this.updateShiftPhotoToolState(context.row);
            this.scheduleShiftNotebookAutoSave();
        }
    }

    refreshShiftPhotoComparePhotoMeta(photoIndex) {
        const context = this._shiftPhotoCompareContext;
        const index = Number(photoIndex);
        const photo = context?.photos?.[index];
        if (!photo) return;
        const roleLabel = this.getShiftPhotoCompareRoleLabel(photo.role);
        const selector = `[data-photo-index="${CSS.escape(String(index))}"]`;
        const roleEl = document.querySelector(`.shift-photo-compare-role${selector}`);
        if (roleEl) {
            roleEl.textContent = roleLabel;
            roleEl.hidden = !roleLabel;
        }
        const captionEl = document.querySelector(`.shift-photo-compare-caption${selector}`);
        if (captionEl) {
            captionEl.textContent = photo.caption || '';
            captionEl.hidden = !photo.caption;
        }
        document.querySelectorAll(`.shift-photo-compare-role-toggle button${selector}`).forEach(button => {
            button.classList.toggle('active', button.dataset.role === photo.role);
        });
        const captionInput = document.querySelector(`.shift-photo-compare-caption-input${selector}`);
        if (captionInput && captionInput.value !== (photo.caption || '')) captionInput.value = photo.caption || '';
    }

    updateShiftPhotoCompareCaption(photoIndex, value) {
        const context = this._shiftPhotoCompareContext;
        const index = Number(photoIndex);
        const photo = context?.photos?.[index];
        if (!photo) return;
        photo.caption = String(value || '').slice(0, 160);
        this.syncShiftPhotoComparePhotoMeta(index);
        this.refreshShiftPhotoComparePhotoMeta(index);
    }

    setShiftPhotoCompareRole(photoIndex, role) {
        const context = this._shiftPhotoCompareContext;
        const index = Number(photoIndex);
        const photo = context?.photos?.[index];
        if (!photo) return;
        const nextRole = ['before', 'after', 'neutral'].includes(role) ? role : 'neutral';
        const cleanCaption = this.getShiftPhotoCompareCaptionCleanBody(photo.caption || '');
        if (nextRole === 'before') photo.caption = `対応前 ${cleanCaption}`.trim();
        else if (nextRole === 'after') photo.caption = `対応後 ${cleanCaption}`.trim();
        else photo.caption = cleanCaption;
        this.syncShiftPhotoComparePhotoMeta(index);
        this.refreshShiftPhotoComparePhotoMeta(index);
    }

    applyShiftPhotoCompareCaptionPreset(photoIndex, preset) {
        const context = this._shiftPhotoCompareContext;
        const index = Number(photoIndex);
        const photo = context?.photos?.[index];
        if (!photo) return;
        const label = String(preset || '').trim().slice(0, 24);
        if (!label) return;
        const cleanCaption = this.getShiftPhotoCompareCaptionCleanBody(photo.caption || '');
        photo.caption = `${label} ${cleanCaption}`.trim();
        this.syncShiftPhotoComparePhotoMeta(index);
        this.refreshShiftPhotoComparePhotoMeta(index);
    }

    flashShiftPhotoCompareSaved(photoIndex) {
        const index = Number(photoIndex);
        if (!Number.isFinite(index)) return;
        const selector = `[data-photo-index="${CSS.escape(String(index))}"]`;
        const status = document.querySelector(`.shift-photo-compare-save-status${selector}`);
        if (!status) return;
        status.textContent = '保存済み';
        status.classList.add('show');
        clearTimeout(status._hideTimer);
        status._hideTimer = setTimeout(() => status.classList.remove('show'), 1200);
    }

    getShiftPhotoCompareInitialGlobalMarks(row = null, options = {}) {
        if (row) return this.parseShiftPhotoCompareMarks(row.dataset.shiftPhotoGlobalMarks || '[]');
        return this.parseShiftPhotoCompareMarks(JSON.stringify(options.globalMarks || []));
    }

    getShiftPhotoCompareItems(row) {
        const items = Array.from(row?.querySelectorAll('.shift-photo-previews .shift-photo-item') || []).map((item, index) => {
            const src = item.querySelector('img')?.src || '';
            const caption = item.querySelector('.shift-photo-caption')?.value.trim() || '';
            const numbers = this.getShiftPhotoCompareNumbers(caption);
            const marks = this.parseShiftPhotoCompareMarks(item.dataset.shiftPhotoMarks || '[]');
            return {
                src,
                caption,
                index,
                marks,
                previewItem: item,
                role: this.inferShiftPhotoCompareRole(caption),
                setKey: this.getShiftPhotoCompareSetKey(caption),
                numbers,
                orderNumber: numbers[0] ?? null,
                pairNumber: numbers.length >= 2 ? numbers[0] : null,
                pairStep: numbers.length >= 2 ? numbers[1] : null
            };
        }).filter(item => !!item.src);

        const withNumber = items;
        const hasBeforeAfter = withNumber.some(item => item.role === 'before') && withNumber.some(item => item.role === 'after');
        if (hasBeforeAfter) {
            return withNumber.sort((a, b) => {
                const roleRank = { before: 0, neutral: 1, after: 2 };
                return roleRank[a.role] - roleRank[b.role] || a.index - b.index;
            });
        }
        if (withNumber.filter(item => item.orderNumber !== null).length >= 2) {
            return withNumber.sort((a, b) => (a.orderNumber ?? 9999) - (b.orderNumber ?? 9999) || a.index - b.index);
        }
        return withNumber.sort((a, b) => a.index - b.index);
    }

    toggleShiftPhotoPreviews(button) {
        const row = button?.closest('.shift-notebook-row');
        if (!row) return;
        row.classList.toggle('shift-photo-list-collapsed');
        this.updateShiftPhotoToolState(row);
    }

    updateShiftPhotoToolState(row) {
        if (!row) return;
        const photoItems = Array.from(row.querySelectorAll('.shift-photo-previews .shift-photo-item'));
        const photoCount = photoItems.filter(item => !!item.querySelector('img[src]')).length;
        const hasPhotos = photoCount > 0;
        const globalMarkCount = this.parseShiftPhotoCompareMarks(row.dataset.shiftPhotoGlobalMarks || '[]').length;
        const markedPhotoCount = photoItems.reduce((count, item) => {
            const marks = this.parseShiftPhotoCompareMarks(item.dataset.shiftPhotoMarks || '[]');
            const hasMarks = marks.length > 0 || globalMarkCount > 0;
            item.classList.toggle('has-photo-marks', hasMarks);
            const markText = globalMarkCount > 0 ? `注記あり (全体${globalMarkCount}件 / 写真${marks.length}件)` : `注記あり (${marks.length}件)`;
            item.querySelector('.shift-photo-mark-badge')?.setAttribute('title', hasMarks ? markText : '写真比較で記号・文字の注記があります');
            return count + (marks.length > 0 ? 1 : 0);
        }, 0);
        const hasMarks = globalMarkCount > 0 || markedPhotoCount > 0;
        const compareButton = row.querySelector('.shift-photo-compare-btn');
        const collapseButton = row.querySelector('.shift-photo-collapse-btn');
        compareButton?.classList.toggle('has-photos', hasPhotos);
        compareButton?.classList.toggle('has-photo-marks', hasMarks);
        if (compareButton) {
            compareButton.title = hasPhotos
                ? `写真${photoCount}枚を並べて拡大表示${hasMarks ? ` / 注記あり ${markedPhotoCount + globalMarkCount}件` : ''}`
                : '複数写真を並べて拡大表示';
        }
        if (collapseButton) {
            collapseButton.disabled = !hasPhotos;
            collapseButton.title = row.classList.contains('shift-photo-list-collapsed') ? '写真一覧を表示' : '写真一覧を折りたたみ';
            collapseButton.innerHTML = row.classList.contains('shift-photo-list-collapsed')
                ? '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>'
                : '<i class="fa-solid fa-chevron-up" aria-hidden="true"></i>';
        }
    }

    inferShiftPhotoCompareRole(caption = '') {
        const customRole = this.getShiftPhotoCaptionCustomPairRole(caption);
        if (customRole) return customRole;
        const text = MaintenanceStore.toHalfWidthLower(caption || '');
        if (/(before|ビフォー|作業前|点検前|施工前|修理前|交換前|清掃前|改善前|使用前|前\b|^前)/i.test(text)) return 'before';
        if (/(after|アフター|作業後|点検後|施工後|修理後|交換後|清掃後|改善後|使用後|後\b|^後)/i.test(text)) return 'after';
        return 'neutral';
    }

    getShiftPhotoCompareNumbers(caption = '') {
        return Array.from(MaintenanceStore.toHalfWidthLower(caption || '').matchAll(/\d{1,3}/g))
            .map(match => parseInt(match[0], 10))
            .filter(number => Number.isFinite(number));
    }

    getShiftPhotoCompareSetKey(caption = '') {
        const customPairKey = this.getShiftPhotoCaptionCustomPairSetKey(caption);
        if (customPairKey) return customPairKey;
        return MaintenanceStore.toHalfWidthLower(caption || '')
            .replace(/before|after|ビフォー|アフター|作業前|作業後|点検前|点検後|施工前|施工後|修理前|修理後|交換前|交換後|清掃前|清掃後|改善前|改善後|使用前|使用後|前\b|^前|後\b|^後/gi, '')
            .replace(/[()\[\]{}（）【】「」『』_＿\-ー―‐・:：/／\\|.,，。 ]+/g, '')
            .trim();
    }

    openShiftPhotoCompare(button) {
        const guidePreview = button?.closest?.('.guide-photo-previews');
        const row = guidePreview ? null : button?.closest('.shift-notebook-row');
        const photos = guidePreview
            ? (this._tempPhotos || []).map((rawPhoto, index) => {
                const photo = this.normalizeGuidePhoto ? this.normalizeGuidePhoto(rawPhoto) : (typeof rawPhoto === 'string' ? { src: rawPhoto, marks: [] } : rawPhoto);
                const previewItem = guidePreview.querySelector(`.guide-photo-item[data-guide-photo-index="${index}"]`);
                return {
                    src: photo.src || '',
                    caption: '',
                    index,
                    marks: Array.isArray(photo.marks) ? photo.marks : [],
                    previewItem,
                    role: 'neutral',
                    setKey: '',
                    numbers: [],
                    orderNumber: null,
                    pairNumber: null,
                    pairStep: null
                };
            }).filter(item => !!item.src)
            : this.getShiftPhotoCompareItems(row);
        if (photos.length < 1) {
            if (row) this.setShiftNotebookStatus('表示する写真がありません', 'error');
            return;
        }
        this.openShiftPhotoCompareWithPhotos(photos, {
            row,
            source: guidePreview ? 'guide' : 'shift',
            title: guidePreview ? '手順写真編集' : '写真比較',
            guidePreview,
            onSync: guidePreview ? (context) => {
                this._tempPhotos = context.photos.map(photo => ({
                    src: photo.src,
                    marks: Array.isArray(photo.marks) ? photo.marks : []
                }));
                context.photos.forEach(photo => {
                    if (photo.previewItem) {
                        photo.previewItem.dataset.shiftPhotoMarks = JSON.stringify(photo.marks || []);
                        photo.previewItem.classList.toggle('has-photo-marks', (photo.marks || []).length > 0);
                    }
                });
            } : null
        });
    }

    openShiftPhotoCompareWithPhotos(photos = [], options = {}) {
        if (!photos.length) return;
        document.getElementById('shift-photo-compare-overlay')?.remove();
        const roleLabels = this.getShiftPhotoCompareLabels(photos);
        const displayItems = this.getShiftPhotoCompareDisplayItems(photos, roleLabels);
        const displayPhotos = displayItems.map(item => item.photo);
        const displayLabels = displayItems.map(item => item.label);
        const singlePhotoMode = displayPhotos.length === 1;
        const twoPhotoMode = displayPhotos.length === 2;
        const hasRoleLabels = displayLabels.some(Boolean);
        const guidePreview = options.guidePreview || null;
        const title = options.title || (options.source === 'guide' ? '手順写真編集' : '写真比較');
        const contextRow = options.row || null;
        this._shiftPhotoCompareContext = {
            row: contextRow,
            photos,
            source: options.source || 'shift',
            globalMarks: Array.isArray(options.globalMarks) ? options.globalMarks : [],
            onSync: options.onSync || null,
            onClose: options.onClose || null
        };
        const overlay = document.createElement('div');
        overlay.id = 'shift-photo-compare-overlay';
        overlay.className = 'shift-photo-compare-overlay';
        overlay.innerHTML = `
            <div class="shift-photo-compare-panel" role="dialog" aria-modal="true" aria-label="写真比較">
                <div class="shift-photo-compare-header">
                    <div>
                        <b><i class="fa-solid fa-images"></i> ${this.escapeHtml(title)}</b>
                        <span>${singlePhotoMode ? '1枚を拡大表示' : (hasRoleLabels ? 'Before / After 推測表示' : `${displayPhotos.length}枚を推測順に表示`)}</span>
                    </div>
                    <div class="shift-photo-compare-sample-inline" title="現在の記号設定プレビュー">
                        <span>見本</span>
                        <div id="shift-photo-compare-sample-box" class="shift-photo-compare-sample-box"></div>
                    </div>
                    <div class="shift-photo-compare-header-actions">
                        <div class="shift-photo-compare-markbar" aria-label="写真への指示">
                            <span class="shift-photo-compare-mode-chip" id="shift-photo-compare-mode-chip">通常</span>
                            <button type="button" class="shift-photo-compare-snap-toggle active" id="shift-photo-compare-snap-toggle" data-snap-mode="standard" onclick="app.toggleShiftPhotoCompareSnapGuide()" title="吸着ガイドの強さ">
                                <i class="fa-solid fa-magnet"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-mark-btn" data-mark-mode="circle" onclick="app.setShiftPhotoCompareMarkMode('circle')" title="丸で指示">
                                <i class="fa-regular fa-circle"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-mark-btn" data-mark-mode="arrow" onclick="app.setShiftPhotoCompareMarkMode('arrow')" title="矢印で指示">
                                <i class="fa-solid fa-arrow-right"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-mark-btn" data-mark-mode="rect" onclick="app.setShiftPhotoCompareMarkMode('rect')" title="四角で囲む">
                                <i class="fa-regular fa-square"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-mark-btn" data-mark-mode="xmark" onclick="app.setShiftPhotoCompareMarkMode('xmark')" title="バツ印で指示">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-mark-btn" data-mark-mode="freehand" onclick="app.setShiftPhotoCompareMarkMode('freehand')" title="ドラッグしてフリーハンド線">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-mark-btn" data-mark-mode="text" onclick="app.setShiftPhotoCompareMarkMode('text')" title="文字を置く">
                                <i class="fa-solid fa-font"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-mark-btn shift-photo-compare-number-btn" data-mark-mode="number" onclick="app.setShiftPhotoCompareMarkMode('number')" title="クリックするたびに①②③を連続配置">
                                ①
                            </button>
                            <input type="file" id="shift-photo-compare-image-stamp-input" accept="image/*" hidden onchange="app.loadShiftPhotoCompareImageStamp(this.files?.[0]); this.value=''">
                            <button type="button" class="shift-photo-compare-mark-btn" data-mark-mode="image" onclick="document.getElementById('shift-photo-compare-image-stamp-input')?.click()" title="画像を読み込んで貼り付け">
                                <i class="fa-regular fa-image"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-clipboard" onclick="app.loadShiftPhotoCompareImageStampFromClipboard()" title="クリップボード画像を貼り付け">
                                <i class="fa-solid fa-paste"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-number-reset" onclick="app.resetShiftPhotoCompareNumberCount()" title="数字連続を①に戻す">
                                ↺
                            </button>
                            <label class="shift-photo-compare-color" title="記号の色">
                                <span>色</span>
                                <input type="color" value="#dc2626" oninput="app.setShiftPhotoCompareMarkColor(this.value)">
                            </label>
                            <div class="shift-photo-compare-color-presets" title="色プリセット">
                                ${['#dc2626', '#2563eb', '#16a34a', '#eab308', '#111827', '#ffffff'].map(color => `<button type="button" style="--preset-color:${color}" onclick="app.setShiftPhotoCompareMarkColor('${color}')" aria-label="${color}"></button>`).join('')}
                            </div>
                            <label class="shift-photo-compare-text">
                                <span>文字</span>
                                <textarea id="shift-photo-compare-text-input" maxlength="120" rows="2" placeholder="入力" oninput="app.setShiftPhotoCompareTextValue(this.value)"></textarea>
                            </label>
                            <label class="shift-photo-compare-font">
                                <span>書体</span>
                                <select onchange="app.setShiftPhotoCompareMarkFont(this.value)">
                                    <option value="gothic">ゴシック</option>
                                    <option value="meiryo">メイリオ</option>
                                    <option value="mincho">明朝</option>
                                    <option value="maru">丸め</option>
                                    <option value="pop">ポップ</option>
                                    <option value="brush">筆文字</option>
                                    <option value="hand">手書き</option>
                                    <option value="digital">デジタル</option>
                                    <option value="retro">レトロ</option>
                                    <option value="elegant">上品明朝</option>
                                </select>
                            </label>
                            <button type="button" class="shift-photo-compare-outline active" onclick="app.toggleShiftPhotoCompareTextOutline()" title="文字・番号の白縁取り">
                                縁
                            </button>
                            <label class="shift-photo-compare-size">
                                <span>大きさ</span>
                                <input type="range" min="24" max="700" value="56" oninput="app.setShiftPhotoCompareMarkSize(this.value)">
                                <b id="shift-photo-compare-size-value">56</b>
                            </label>
                            <div class="shift-photo-compare-angle-dial" title="円をドラッグして角度を変更">
                                <span>角度</span>
                                <button type="button" class="shift-photo-angle-dial" onpointerdown="app.startShiftPhotoCompareAngleDial(event, this)" aria-label="記号の角度">
                                    <i class="fa-solid fa-arrow-right"></i>
                                    <em></em>
                                </button>
                                <b id="shift-photo-compare-angle-value">0</b>
                            </div>
                            <label class="shift-photo-compare-size">
                                <span>横</span>
                                <input type="range" min="50" max="500" value="100" oninput="app.setShiftPhotoCompareMarkStretch(this.value)">
                                <b id="shift-photo-compare-stretch-value">100</b>
                            </label>
                            <label class="shift-photo-compare-size">
                                <span>縦</span>
                                <input type="range" min="50" max="260" value="100" oninput="app.setShiftPhotoCompareMarkStretchY(this.value)">
                                <b id="shift-photo-compare-stretch-y-value">100</b>
                            </label>
                            <label class="shift-photo-compare-size">
                                <span>線</span>
                                <input type="range" min="35" max="300" value="100" oninput="app.setShiftPhotoCompareMarkStroke(this.value)">
                                <b id="shift-photo-compare-stroke-value">100</b>
                            </label>
                            <label class="shift-photo-compare-size shift-photo-compare-brush-size" title="画像消しゴム・復元ブラシの太さ">
                                <span>筆</span>
                                <input type="range" min="8" max="160" value="32" oninput="app.setShiftPhotoCompareImageBrushSize(this.value)">
                                <b id="shift-photo-compare-brush-size-value">32</b>
                            </label>
                            <button type="button" class="shift-photo-compare-image-cutout" onclick="app.removeSelectedShiftPhotoImageBackground()" title="選択中の画像スタンプの背景色を簡易透明化">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-clear" data-mark-mode="erase" onclick="app.setShiftPhotoCompareMarkMode('erase')" title="消しゴムを選択して、消したい記号をクリック">
                                <i class="fa-solid fa-eraser"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-range-delete" data-mark-mode="eraseRange" onclick="app.setShiftPhotoCompareMarkMode('eraseRange')" title="ドラッグで囲んだ範囲内の記号をまとめて削除">
                                <i class="fa-solid fa-vector-square"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-mosaic-range" data-mark-mode="mosaicRange" onclick="app.setShiftPhotoCompareMarkMode('mosaicRange')" title="ドラッグで囲んだ範囲にモザイク">
                                <i class="fa-solid fa-border-all"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-select-range" data-mark-mode="selectRange" onclick="app.setShiftPhotoCompareMarkMode('selectRange')" title="ドラッグで囲んだ記号をまとめて選択">
                                <i class="fa-regular fa-object-group"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-move" data-mark-mode="move" onclick="app.setShiftPhotoCompareMarkMode('move')" title="置いた記号をドラッグして移動">
                                <i class="fa-solid fa-arrows-up-down-left-right"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-copy" onclick="app.copySelectedShiftPhotoCompareMark()" title="選択中の記号をコピー">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-delete-selected" data-mark-mode="erase" onclick="app.setShiftPhotoCompareMarkMode('erase')" title="削除モード: 記号をクリックして連続削除 / もう一度押すと解除">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-undo" onclick="app.undoShiftPhotoCompareMarkChange()" title="元に戻す">
                                <i class="fa-solid fa-rotate-left"></i>
                            </button>
                            <button type="button" class="shift-photo-compare-clear-all" onclick="app.clearShiftPhotoCompareMarks()" title="すべての記号を消す">
                                全消
                            </button>
                            <button type="button" class="shift-photo-compare-default-reset" onclick="app.resetShiftPhotoCompareMarkDefaults()" title="大きさ・角度・伸び・色を標準へ戻す">
                                標準
                            </button>
                            <button type="button" class="shift-photo-compare-export" onclick="app.exportShiftPhotoCompareImage()" title="記号込みで画像出力">
                                出力
                            </button>
                            <button type="button" class="shift-photo-compare-export-one" onclick="app.exportShiftPhotoCompareEachImage()" title="写真1枚ごとに記号込みで出力">
                                単出
                            </button>
                            <button type="button" class="shift-photo-compare-global-target" onclick="app.toggleShiftPhotoCompareGlobalTarget()" title="写真をまたいで記号を置く">
                                全体
                            </button>
                            <div class="shift-photo-compare-recent-images" id="shift-photo-compare-recent-images" aria-label="最近使った画像" ondragover="app.handleShiftPhotoCompareRecentShelfDragOver(event)" ondrop="app.dropShiftPhotoCompareRecentImageToShelf(event)">
                                <span>最近</span>
                                <button type="button" class="shift-photo-compare-recent-clean" onclick="app.clearUnpinnedShiftPhotoCompareRecentImages()" title="固定していない最近画像をまとめて削除">
                                    <i class="fa-solid fa-broom"></i>
                                </button>
                                <div class="shift-photo-compare-recent-list"></div>
                            </div>
                        </div>
                        <button type="button" class="shift-photo-compare-close" onclick="app.closeShiftPhotoCompare()" aria-label="閉じる">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
                <div class="shift-photo-compare-grid ${singlePhotoMode ? 'single' : (twoPhotoMode ? 'two' : 'multi')}" style="--compare-count:${Math.min(displayPhotos.length, 4)}">
                    ${displayItems.map((displayItem, index) => {
                        const photo = displayItem.photo;
                        const photoRole = photo.role || 'neutral';
                        return `
                        <figure class="shift-photo-compare-item">
                            <div class="shift-photo-compare-image-wrap" data-photo-index="${displayItem.index}" onpointerdown="app.startShiftPhotoCompareMarkDrag(event, this)" ondragover="app.handleShiftPhotoCompareRecentImageDragOver(event)" ondrop="app.dropShiftPhotoCompareRecentImageStamp(event, this)" title="丸・矢印モード中はドラッグして記号を配置">
                                <img src="${photo.src}" alt="${this.escapeHtml(photo.caption || `写真${index + 1}`)}">
                                <div class="shift-photo-compare-mark-layer">${(photo.marks || []).map(mark => this.getShiftPhotoCompareMarkHtml(mark)).join('')}</div>
                            </div>
                            <figcaption class="shift-photo-compare-role" data-photo-index="${displayItem.index}" ${displayLabels[index] ? '' : 'hidden'}>${this.escapeHtml(displayLabels[index])}</figcaption>
                            <div class="shift-photo-compare-caption" data-photo-index="${displayItem.index}" ${photo.caption ? '' : 'hidden'}>${this.escapeHtml(photo.caption || '')}</div>
                            <div class="shift-photo-compare-meta">
                                <label class="shift-photo-compare-caption-edit">
                                    <span>写真メモ <em class="shift-photo-compare-save-status" data-photo-index="${displayItem.index}">保存済み</em></span>
                                    <input type="text" class="shift-photo-compare-caption-input" data-photo-index="${displayItem.index}" value="${this.escapeHtml(photo.caption || '')}" maxlength="160" oninput="app.updateShiftPhotoCompareCaption(${displayItem.index}, this.value)">
                                </label>
                                <div class="shift-photo-compare-preset-row" aria-label="写真メモ定型">
                                    ${['対応前', '対応後', '清掃前', '清掃後', '交換前', '交換後'].map(label => `
                                        <button type="button" onclick="app.applyShiftPhotoCompareCaptionPreset(${displayItem.index}, '${this.escapeJs(label)}')">${this.escapeHtml(label)}</button>
                                    `).join('')}
                                </div>
                                <div class="shift-photo-compare-role-toggle" aria-label="対応前後の切替">
                                    <button type="button" data-photo-index="${displayItem.index}" data-role="before" class="${photoRole === 'before' ? 'active' : ''}" onclick="app.setShiftPhotoCompareRole(${displayItem.index}, 'before')">対応前</button>
                                    <button type="button" data-photo-index="${displayItem.index}" data-role="after" class="${photoRole === 'after' ? 'active' : ''}" onclick="app.setShiftPhotoCompareRole(${displayItem.index}, 'after')">対応後</button>
                                    <button type="button" data-photo-index="${displayItem.index}" data-role="neutral" class="${photoRole === 'neutral' ? 'active' : ''}" onclick="app.setShiftPhotoCompareRole(${displayItem.index}, 'neutral')">通常</button>
                                </div>
                            </div>
                        </figure>
                    `;
                    }).join('')}
                    <div class="shift-photo-compare-global-layer" onpointerdown="app.startShiftPhotoCompareGlobalMarkDrag(event, this)" ondragover="app.handleShiftPhotoCompareRecentImageDragOver(event)" ondrop="app.dropShiftPhotoCompareRecentImageStamp(event, this)">
                        ${this.getShiftPhotoCompareInitialGlobalMarks(contextRow, options).map(mark => this.getShiftPhotoCompareMarkHtml(mark)).join('')}
                    </div>
                </div>
                <div class="shift-photo-compare-mini-toolbar" id="shift-photo-compare-mini-toolbar" hidden onpointerdown="app.startShiftPhotoCompareMiniToolbarDrag(event, this)">
                    <button type="button" onclick="app.copySelectedShiftPhotoCompareMark()" title="コピー"><i class="fa-regular fa-copy"></i></button>
                    <button type="button" onclick="app.clearShiftPhotoCompareSelection()" title="選択解除"><i class="fa-solid fa-ban"></i></button>
                    <button type="button" class="shift-photo-compare-lock-btn" onclick="app.toggleSelectedShiftPhotoCompareMarkLock()" title="選択中の記号をロック/解除"><i class="fa-solid fa-lock-open"></i></button>
                    <button type="button" class="shift-photo-compare-group-btn" onclick="app.toggleSelectedShiftPhotoCompareMarkGroup()" title="選択中の記号をグループ化/解除"><i class="fa-solid fa-link"></i></button>
                    <button type="button" class="shift-photo-compare-number-text-btn" onclick="app.addTextNextToSelectedShiftPhotoNumber()" title="番号の右に文字を追加"><i class="fa-solid fa-font"></i><span>+</span></button>
                    <button type="button" class="shift-photo-compare-pair-gap-btn" onclick="app.adjustSelectedShiftPhotoNumberTextGap(-4)" title="文字を番号に近づける"><i class="fa-solid fa-compress"></i></button>
                    <button type="button" class="shift-photo-compare-pair-gap-btn" onclick="app.adjustSelectedShiftPhotoNumberTextGap(4)" title="文字を番号から離す"><i class="fa-solid fa-expand"></i></button>
                    <button type="button" class="shift-photo-compare-mini-select-range" data-mark-mode="selectRange" onclick="app.setShiftPhotoCompareMarkMode('selectRange')" title="範囲選択"><i class="fa-regular fa-object-group"></i></button>
                    <button type="button" onpointerenter="app.previewAlignSelectedShiftPhotoCompareMarks('left')" onpointerleave="app.clearShiftPhotoCompareAlignPreview()" onclick="app.alignSelectedShiftPhotoCompareMarks('left')" title="左揃え"><i class="fa-solid fa-align-left"></i></button>
                    <button type="button" onpointerenter="app.previewAlignSelectedShiftPhotoCompareMarks('top')" onpointerleave="app.clearShiftPhotoCompareAlignPreview()" onclick="app.alignSelectedShiftPhotoCompareMarks('top')" title="上揃え"><i class="fa-solid fa-align-left fa-rotate-90"></i></button>
                    <button type="button" onpointerenter="app.previewAlignSelectedShiftPhotoCompareMarks('centerX')" onpointerleave="app.clearShiftPhotoCompareAlignPreview()" onclick="app.alignSelectedShiftPhotoCompareMarks('centerX')" title="横中央揃え"><i class="fa-solid fa-align-center"></i></button>
                    <button type="button" onpointerenter="app.previewAlignSelectedShiftPhotoCompareMarks('centerY')" onpointerleave="app.clearShiftPhotoCompareAlignPreview()" onclick="app.alignSelectedShiftPhotoCompareMarks('centerY')" title="縦中央揃え"><i class="fa-solid fa-align-center fa-rotate-90"></i></button>
                    <button type="button" onpointerenter="app.previewAlignSelectedShiftPhotoCompareMarks('right')" onpointerleave="app.clearShiftPhotoCompareAlignPreview()" onclick="app.alignSelectedShiftPhotoCompareMarks('right')" title="右揃え"><i class="fa-solid fa-align-right"></i></button>
                    <button type="button" onpointerenter="app.previewAlignSelectedShiftPhotoCompareMarks('bottom')" onpointerleave="app.clearShiftPhotoCompareAlignPreview()" onclick="app.alignSelectedShiftPhotoCompareMarks('bottom')" title="下揃え"><i class="fa-solid fa-align-right fa-rotate-90"></i></button>
                    <button type="button" onpointerenter="app.previewDistributeSelectedShiftPhotoCompareMarks('x')" onpointerleave="app.clearShiftPhotoCompareAlignPreview()" onclick="app.distributeSelectedShiftPhotoCompareMarks('x')" title="横に等間隔"><i class="fa-solid fa-arrows-left-right-to-line"></i></button>
                    <button type="button" onpointerenter="app.previewDistributeSelectedShiftPhotoCompareMarks('y')" onpointerleave="app.clearShiftPhotoCompareAlignPreview()" onclick="app.distributeSelectedShiftPhotoCompareMarks('y')" title="縦に等間隔"><i class="fa-solid fa-arrows-up-down"></i></button>
                    <button type="button" onclick="app.moveSelectedShiftPhotoCompareMarkLayer('front')" title="前面へ"><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" onclick="app.moveSelectedShiftPhotoCompareMarkLayer('back')" title="背面へ"><i class="fa-solid fa-arrow-down"></i></button>
                    <button type="button" class="shift-photo-compare-image-tool" onclick="app.flipSelectedShiftPhotoImage('x')" title="画像を左右反転"><i class="fa-solid fa-left-right"></i></button>
                    <button type="button" class="shift-photo-compare-image-tool" onclick="app.flipSelectedShiftPhotoImage('y')" title="画像を上下反転"><i class="fa-solid fa-up-down"></i></button>
                    <button type="button" class="shift-photo-compare-image-tool" onclick="app.rotateSelectedShiftPhotoImage90()" title="画像を90度回転"><i class="fa-solid fa-rotate-right"></i></button>
                    <button type="button" class="shift-photo-compare-image-tool" onclick="app.adjustSelectedShiftPhotoImageOpacity(-0.1)" title="画像を薄く"><i class="fa-solid fa-droplet-slash"></i></button>
                    <button type="button" class="shift-photo-compare-image-tool" onclick="app.adjustSelectedShiftPhotoImageOpacity(0.1)" title="画像を濃く"><i class="fa-solid fa-droplet"></i></button>
                    <button type="button" class="shift-photo-compare-image-tool" onclick="app.setShiftPhotoCompareImageBrushMode('erase')" title="画像消しゴム"><i class="fa-solid fa-eraser"></i></button>
                    <button type="button" class="shift-photo-compare-image-tool" onclick="app.setShiftPhotoCompareImageBrushMode('restore')" title="画像復元ブラシ"><i class="fa-solid fa-brush"></i></button>
                    <button type="button" class="shift-photo-compare-image-tool" onclick="app.saveSelectedShiftPhotoImageToManager()" title="選択中の画像を写真管理へ保存"><i class="fa-solid fa-bookmark"></i></button>
                    <button type="button" onclick="app.deleteSelectedShiftPhotoCompareMark()" title="削除"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="shift-photo-compare-mode-hint" id="shift-photo-compare-mode-hint" hidden></div>
                <div class="shift-photo-compare-mark-list" id="shift-photo-compare-mark-list" aria-label="記号一覧"></div>
            </div>
        `;
        overlay.addEventListener('click', (e) => {
            if (!e.target.closest?.('.shift-photo-compare-image-context-menu')) this.closeShiftPhotoCompareImageContextMenu();
            if (e.target === overlay) this.closeShiftPhotoCompare();
        });
        overlay.addEventListener('contextmenu', (e) => {
            const mark = e.target?.closest?.('.shift-photo-compare-mark.image');
            if (!mark || !overlay.contains(mark)) return;
            e.preventDefault();
            this.openShiftPhotoCompareImageContextMenu(e, mark);
        });
        document.body.appendChild(overlay);
        this._shiftPhotoCompareNumberNext = 1;
        this._shiftPhotoCompareGlobalTarget = false;
        this._shiftPhotoCompareUndoStack = [];
        this._shiftPhotoCompareImageBrushSize = this._shiftPhotoCompareImageBrushSize || 32;
        this.updateShiftPhotoCompareSample();
        this.refreshShiftPhotoCompareMarkList();
        this.updateShiftPhotoCompareModeHint();
        this.updateShiftPhotoCompareUndoButton();
        this.updateShiftPhotoCompareSnapGuideButton();
        this.updateShiftPhotoCompareImageBrushSizeControl();
        this.renderShiftPhotoCompareRecentImageStamps();
        const onKeydown = (e) => {
            if (e.key === 'Escape') {
                if (this._shiftPhotoCompareMarkMode) {
                    e.preventDefault();
                    this.setShiftPhotoCompareMarkMode(this._shiftPhotoCompareMarkMode);
                    return;
                }
                this.closeShiftPhotoCompare();
            }
            const active = document.activeElement;
            const isTextInput = active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
            if (!isTextInput && (e.key === 'Delete' || e.key === 'Backspace') && this._shiftPhotoCompareSelectedMark) {
                e.preventDefault();
                this.deleteSelectedShiftPhotoCompareMark();
            }
        };
        const onPaste = (e) => this.handleShiftPhotoComparePasteEvent(e);
        this._shiftPhotoCompareKeydown = onKeydown;
        this._shiftPhotoComparePaste = onPaste;
        document.addEventListener('keydown', onKeydown);
        document.addEventListener('paste', onPaste);
    }

    setShiftPhotoCompareMarkMode(mode) {
        this._shiftPhotoCompareMarkMode = this._shiftPhotoCompareMarkMode === mode ? '' : mode;
        this.applyShiftPhotoCompareMarkModeState();
    }

    applyShiftPhotoCompareMarkModeState() {
        if (this._shiftPhotoCompareMarkMode !== 'move' && this._shiftPhotoCompareImageBrushMode) {
            this.clearShiftPhotoCompareImageBrushMode({ silent: true });
        }
        document.querySelectorAll('.shift-photo-compare-mark-btn, .shift-photo-compare-clear, .shift-photo-compare-range-delete, .shift-photo-compare-mosaic-range, .shift-photo-compare-select-range, .shift-photo-compare-move, .shift-photo-compare-delete-selected, .shift-photo-compare-mini-select-range').forEach(button => {
            button.classList.toggle('active', button.dataset.markMode === this._shiftPhotoCompareMarkMode);
        });
        const overlay = document.getElementById('shift-photo-compare-overlay');
        overlay?.classList.toggle('marking', !!this._shiftPhotoCompareMarkMode);
        overlay?.classList.toggle('erasing', this._shiftPhotoCompareMarkMode === 'erase');
        overlay?.classList.toggle('range-deleting', this._shiftPhotoCompareMarkMode === 'eraseRange');
        overlay?.classList.toggle('range-mosaicing', this._shiftPhotoCompareMarkMode === 'mosaicRange');
        overlay?.classList.toggle('range-selecting', this._shiftPhotoCompareMarkMode === 'selectRange');
        overlay?.classList.toggle('moving', this._shiftPhotoCompareMarkMode === 'move');
        overlay?.classList.toggle('drawing', this._shiftPhotoCompareMarkMode === 'freehand');
        overlay?.classList.toggle('image-brushing', !!this._shiftPhotoCompareImageBrushMode);
        if (this._shiftPhotoCompareMarkMode !== 'move') this.selectShiftPhotoCompareMark(null);
        if (!this._shiftPhotoCompareMarkMode) this._shiftPhotoCompareMiniToolbarPinned = false;
        if (!this._shiftPhotoCompareMarkMode) {
            this.clearShiftPhotoCompareAlignPreview();
            this.clearShiftPhotoCompareSnapGuides();
        }
        this.updateShiftPhotoCompareModeHint();
        this.updateShiftPhotoCompareSample();
    }

    clearShiftPhotoCompareTransientModes({ keepMove = true, silent = true } = {}) {
        this.clearShiftPhotoCompareImageBrushMode({ silent });
        if (['erase', 'eraseRange', 'mosaicRange', 'selectRange'].includes(this._shiftPhotoCompareMarkMode || '')) {
            this.setShiftPhotoCompareMarkModeDirect(keepMove ? 'move' : '');
            return true;
        }
        return false;
    }

    setShiftPhotoCompareMarkModeDirect(mode = '') {
        this._shiftPhotoCompareMarkMode = mode;
        this.applyShiftPhotoCompareMarkModeState();
    }

    isShiftPhotoCompareSnapGuideEnabled() {
        return this.getShiftPhotoCompareSnapGuideMode() !== 'off';
    }

    getShiftPhotoCompareSnapGuideMode() {
        if (this._shiftPhotoCompareSnapGuideEnabled === false) return 'off';
        const mode = this._shiftPhotoCompareSnapGuideMode || 'standard';
        return ['off', 'weak', 'standard', 'strong'].includes(mode) ? mode : 'standard';
    }

    getShiftPhotoCompareSnapGuideThreshold() {
        const thresholds = {
            weak: 0.75,
            standard: 1.4,
            strong: 2.6
        };
        return thresholds[this.getShiftPhotoCompareSnapGuideMode()] || 1.4;
    }

    updateShiftPhotoCompareSnapGuideButton() {
        const button = document.getElementById('shift-photo-compare-snap-toggle');
        if (!button) return;
        const mode = this.getShiftPhotoCompareSnapGuideMode();
        const enabled = mode !== 'off';
        const labels = {
            off: '切',
            weak: '弱',
            standard: '標',
            strong: '強'
        };
        const titles = {
            off: 'オフ',
            weak: '弱',
            standard: '標準',
            strong: '強'
        };
        button.classList.toggle('active', enabled);
        button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        button.dataset.snapMode = mode;
        button.dataset.label = labels[mode] || '標';
        button.title = `吸着ガイド: ${titles[mode] || '標準'}`;
    }

    toggleShiftPhotoCompareSnapGuide() {
        const order = ['off', 'weak', 'standard', 'strong'];
        const current = this.getShiftPhotoCompareSnapGuideMode();
        const next = order[(order.indexOf(current) + 1) % order.length] || 'standard';
        this._shiftPhotoCompareSnapGuideMode = next;
        this._shiftPhotoCompareSnapGuideEnabled = next !== 'off';
        if (!this.isShiftPhotoCompareSnapGuideEnabled()) this.clearShiftPhotoCompareSnapGuides();
        this.updateShiftPhotoCompareSnapGuideButton();
        const messages = {
            off: '吸着ガイドをオフにしました。',
            weak: '吸着ガイドを弱にしました。',
            standard: '吸着ガイドを標準にしました。',
            strong: '吸着ガイドを強にしました。'
        };
        this.showShiftPhotoCompareActionMessage(messages[next] || '吸着ガイドを標準にしました。');
    }

    loadShiftPhotoCompareImageStamp(file) {
        if (!file || !/^image\//i.test(file.type || '')) return;
        const reader = new FileReader();
        reader.onload = () => {
            this._shiftPhotoCompareImageStampSrc = String(reader.result || '');
            this.rememberShiftPhotoCompareImageStamp(this._shiftPhotoCompareImageStampSrc, file.name || '画像');
            this.setShiftPhotoCompareMarkModeDirect('image');
            this.updateShiftPhotoCompareSample();
            this.showShiftPhotoCompareActionMessage('画像スタンプを読み込みました。写真上をクリックして配置できます。');
        };
        reader.readAsDataURL(file);
    }

    loadShiftPhotoCompareImageStampBlob(blob, message = 'クリップボード画像を読み込みました。写真上をクリックして配置できます。') {
        if (!blob || !/^image\//i.test(blob.type || '')) return false;
        const reader = new FileReader();
        reader.onload = () => {
            this._shiftPhotoCompareImageStampSrc = String(reader.result || '');
            this.rememberShiftPhotoCompareImageStamp(this._shiftPhotoCompareImageStampSrc, 'クリップボード');
            this.setShiftPhotoCompareMarkModeDirect('image');
            this.updateShiftPhotoCompareSample();
            this.showShiftPhotoCompareActionMessage(message);
        };
        reader.readAsDataURL(blob);
        return true;
    }

    getShiftPhotoCompareRecentImageStamps() {
        if (typeof store !== 'undefined' && store.activeData) {
            if (!Array.isArray(store.activeData.shiftPhotoRecentImageStamps)) {
                store.activeData.shiftPhotoRecentImageStamps = [];
            }
            store.activeData.shiftPhotoRecentImageStamps = this.sortShiftPhotoCompareRecentImageStamps(store.activeData.shiftPhotoRecentImageStamps);
            this._shiftPhotoCompareRecentImageStamps = store.activeData.shiftPhotoRecentImageStamps;
            return store.activeData.shiftPhotoRecentImageStamps;
        }
        if (!Array.isArray(this._shiftPhotoCompareRecentImageStamps)) {
            this._shiftPhotoCompareRecentImageStamps = [];
        }
        this._shiftPhotoCompareRecentImageStamps = this.sortShiftPhotoCompareRecentImageStamps(this._shiftPhotoCompareRecentImageStamps);
        return this._shiftPhotoCompareRecentImageStamps;
    }

    sortShiftPhotoCompareRecentImageStamps(items = []) {
        return (Array.isArray(items) ? items : [])
            .filter(item => item?.src)
            .sort((a, b) => {
                const pinnedDiff = Number(!!b.pinned) - Number(!!a.pinned);
                if (pinnedDiff) return pinnedDiff;
                const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : null;
                const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : null;
                if (ao !== null && bo !== null && ao !== bo) return ao - bo;
                return (Number(b.usedAt) || 0) - (Number(a.usedAt) || 0);
            });
    }

    saveShiftPhotoCompareRecentImageStamps(items = [], options = {}) {
        const seen = new Set();
        const unique = (Array.isArray(items) ? items : []).filter(item => {
            if (!item?.src || seen.has(item.src)) return false;
            seen.add(item.src);
            return true;
        });
        const pinned = unique.filter(item => item.pinned);
        const unpinned = unique.filter(item => !item.pinned).slice(0, 10);
        const next = [...pinned, ...unpinned].slice(0, 18).map((item, order) => ({ ...item, order }));
        this._shiftPhotoCompareRecentImageStamps = next;
        if (typeof store !== 'undefined' && store.activeData) {
            store.activeData.shiftPhotoRecentImageStamps = next;
            if (options.save !== false) store.save?.();
        }
        if (options.render !== false) this.renderShiftPhotoCompareRecentImageStamps();
        return next;
    }

    rememberShiftPhotoCompareImageStamp(src = '', label = '画像') {
        if (!/^data:image\//i.test(src || '')) return;
        const recent = this.getShiftPhotoCompareRecentImageStamps();
        const existing = recent.find(item => item.src === src) || {};
        const filtered = recent.filter(item => item.src !== src);
        filtered.unshift({
            ...existing,
            src,
            label: String(label || '画像').replace(/\.[^.]+$/, '').slice(0, 24),
            usedAt: Date.now()
        });
        this.saveShiftPhotoCompareRecentImageStamps(filtered);
        this.detectShiftPhotoCompareRecentImageTransparency(src);
    }

    renderShiftPhotoCompareRecentImageStamps() {
        const host = document.getElementById('shift-photo-compare-recent-images');
        if (!host) return;
        const list = host.querySelector('.shift-photo-compare-recent-list');
        const recent = this.getShiftPhotoCompareRecentImageStamps();
        host.hidden = !recent.length;
        if (!list) return;
        list.innerHTML = recent.map((item, index) => `
            <button type="button" class="shift-photo-compare-recent-image ${item.pinned ? 'pinned' : ''} ${item.transparent ? 'transparent' : ''}" draggable="true" onpointerenter="app.showShiftPhotoCompareRecentImagePreview(event, ${index})" onpointermove="app.moveShiftPhotoCompareRecentImagePreview(event)" onpointerleave="app.hideShiftPhotoCompareRecentImagePreview()" ondragstart="app.startShiftPhotoCompareRecentImageDrag(event, ${index})" ondragend="app.endShiftPhotoCompareRecentImageDrag()" ondragover="app.handleShiftPhotoCompareRecentShelfDragOver(event)" ondrop="app.dropShiftPhotoCompareRecentImageToShelf(event, ${index})" oncontextmenu="event.preventDefault(); app.removeShiftPhotoCompareRecentImageStamp(${index})" onclick="app.selectShiftPhotoCompareRecentImageStamp(${index})" title="${this.escapeHtml(item.label || '最近使った画像')}">
                <img src="${this.escapeHtml(item.src)}" alt="">
                ${item.transparent ? '<em>透過</em>' : ''}
                ${item.sizePreset?.size ? `<strong>${Math.round(Number(item.sizePreset.size) || 0)}</strong>` : ''}
                <span class="shift-photo-compare-recent-pin" onclick="event.stopPropagation(); app.toggleShiftPhotoCompareRecentImagePinned(${index})" title="${item.pinned ? '固定を解除' : '固定'}"><i class="fa-solid fa-thumbtack"></i></span>
                <span class="shift-photo-compare-recent-remove" onclick="event.stopPropagation(); app.removeShiftPhotoCompareRecentImageStamp(${index})" title="最近から削除"><i class="fa-solid fa-xmark"></i></span>
            </button>
        `).join('');
        recent.filter(item => !item.transparentChecked).slice(0, 8).forEach(item => this.detectShiftPhotoCompareRecentImageTransparency(item.src));
    }

    showShiftPhotoCompareRecentImagePreview(event, index = 0) {
        const item = this.getShiftPhotoCompareRecentImageStamps()[Number(index) || 0];
        if (!item?.src || this._shiftPhotoCompareDraggingRecentImage) return;
        let preview = document.getElementById('shift-photo-compare-recent-preview');
        if (!preview) {
            preview = document.createElement('div');
            preview.id = 'shift-photo-compare-recent-preview';
            preview.className = 'shift-photo-compare-recent-preview';
            document.body.appendChild(preview);
        }
        const sizeText = item.sizePreset?.size ? ` / ${Math.round(Number(item.sizePreset.size) || 0)}` : '';
        preview.innerHTML = `
            <img src="${this.escapeHtml(item.src)}" alt="">
            <span>${this.escapeHtml(item.label || '最近使った画像')}${item.transparent ? ' / 透過' : ''}${sizeText}</span>
        `;
        preview.hidden = false;
        this.moveShiftPhotoCompareRecentImagePreview(event);
    }

    moveShiftPhotoCompareRecentImagePreview(event) {
        const preview = document.getElementById('shift-photo-compare-recent-preview');
        if (!preview || preview.hidden) return;
        const gap = 14;
        const rect = preview.getBoundingClientRect();
        let left = (event?.clientX || 0) + gap;
        let top = (event?.clientY || 0) + gap;
        if (left + rect.width > window.innerWidth - 8) left = (event?.clientX || 0) - rect.width - gap;
        if (top + rect.height > window.innerHeight - 8) top = (event?.clientY || 0) - rect.height - gap;
        preview.style.left = `${Math.max(8, left)}px`;
        preview.style.top = `${Math.max(8, top)}px`;
    }

    hideShiftPhotoCompareRecentImagePreview() {
        const preview = document.getElementById('shift-photo-compare-recent-preview');
        if (preview) preview.hidden = true;
    }

    selectShiftPhotoCompareRecentImageStamp(index = 0) {
        const item = this.getShiftPhotoCompareRecentImageStamps()[Number(index) || 0];
        if (!item?.src) return;
        this._shiftPhotoCompareImageStampSrc = item.src;
        this.applyShiftPhotoCompareRecentImageSizePreset(item);
        this.rememberShiftPhotoCompareImageStamp(item.src, item.label || '画像');
        this.setShiftPhotoCompareMarkModeDirect('image');
        this.updateShiftPhotoCompareSample();
        this.showShiftPhotoCompareActionMessage('最近使った画像に切り替えました。写真上をクリックして配置できます。');
    }

    removeShiftPhotoCompareRecentImageStamp(index = 0) {
        const recent = this.getShiftPhotoCompareRecentImageStamps();
        const item = recent[Number(index) || 0];
        if (!item) return;
        const next = recent.filter(entry => entry.src !== item.src);
        this.saveShiftPhotoCompareRecentImageStamps(next);
        this.showShiftPhotoCompareActionMessage('最近使った画像から削除しました。');
    }

    toggleShiftPhotoCompareRecentImagePinned(index = 0) {
        const recent = this.getShiftPhotoCompareRecentImageStamps();
        const item = recent[Number(index) || 0];
        if (!item) return;
        item.pinned = !item.pinned;
        item.usedAt = Date.now();
        this.saveShiftPhotoCompareRecentImageStamps(recent);
        this.showShiftPhotoCompareActionMessage(item.pinned ? '最近画像を固定しました。' : '最近画像の固定を解除しました。');
    }

    clearUnpinnedShiftPhotoCompareRecentImages() {
        const recent = this.getShiftPhotoCompareRecentImageStamps();
        const next = recent.filter(item => item.pinned);
        if (next.length === recent.length) {
            this.showShiftPhotoCompareActionMessage('整理できる未固定の最近画像はありません。');
            return;
        }
        this.saveShiftPhotoCompareRecentImageStamps(next);
        this.showShiftPhotoCompareActionMessage('固定していない最近画像を整理しました。');
    }

    applyShiftPhotoCompareRecentImageSizePreset(item = {}) {
        const preset = item.sizePreset || {};
        if (!preset.size) return;
        this._shiftPhotoCompareMarkSize = Math.max(24, Math.min(700, Number(preset.size) || 56));
        this._shiftPhotoCompareMarkStretch = Math.max(50, Math.min(500, Math.round((Number(preset.stretch) || 1) * 100)));
        this._shiftPhotoCompareMarkStretchY = Math.max(50, Math.min(260, Math.round((Number(preset.stretchY) || 1) * 100)));
        const sizeInput = document.querySelector('.shift-photo-compare-size input[oninput*="MarkSize"]');
        const stretchInput = document.querySelector('.shift-photo-compare-size input[oninput*="MarkStretch"]');
        const stretchYInput = document.querySelector('.shift-photo-compare-size input[oninput*="MarkStretchY"]');
        const sizeLabel = document.getElementById('shift-photo-compare-size-value');
        const stretchLabel = document.getElementById('shift-photo-compare-stretch-value');
        const stretchYLabel = document.getElementById('shift-photo-compare-stretch-y-value');
        if (sizeInput) sizeInput.value = String(this._shiftPhotoCompareMarkSize);
        if (stretchInput) stretchInput.value = String(this._shiftPhotoCompareMarkStretch);
        if (stretchYInput) stretchYInput.value = String(this._shiftPhotoCompareMarkStretchY);
        if (sizeLabel) sizeLabel.textContent = String(this._shiftPhotoCompareMarkSize);
        if (stretchLabel) stretchLabel.textContent = String(this._shiftPhotoCompareMarkStretch);
        if (stretchYLabel) stretchYLabel.textContent = String(this._shiftPhotoCompareMarkStretchY);
    }

    rememberShiftPhotoCompareRecentImageSizePreset(mark = this._shiftPhotoCompareSelectedMark) {
        if (!mark || mark.dataset.mode !== 'image') return;
        const src = mark.dataset.originalImageSrc || mark.dataset.imageSrc || '';
        if (!src) return;
        const recent = this.getShiftPhotoCompareRecentImageStamps();
        const item = recent.find(entry => entry.src === src);
        if (!item) return;
        item.sizePreset = {
            size: Math.round(parseFloat(mark.dataset.size || '') || 56),
            stretch: parseFloat(mark.dataset.stretch || '') || 1,
            stretchY: parseFloat(mark.dataset.stretchY || '') || 1
        };
        this.saveShiftPhotoCompareRecentImageStamps(recent);
    }

    async detectShiftPhotoCompareRecentImageTransparency(src = '') {
        if (!/^data:image\//i.test(src || '') || typeof this.imageHasTransparentPixels !== 'function') return;
        const recent = this.getShiftPhotoCompareRecentImageStamps();
        const item = recent.find(entry => entry.src === src);
        if (!item || item.transparentChecked) return;
        const transparent = await this.imageHasTransparentPixels(src);
        const latest = this.getShiftPhotoCompareRecentImageStamps();
        const latestItem = latest.find(entry => entry.src === src);
        if (!latestItem) return;
        latestItem.transparent = !!transparent;
        latestItem.transparentChecked = true;
        this.saveShiftPhotoCompareRecentImageStamps(latest);
    }

    startShiftPhotoCompareRecentImageDrag(event, index = 0) {
        const item = this.getShiftPhotoCompareRecentImageStamps()[Number(index) || 0];
        if (!item?.src) return;
        this.hideShiftPhotoCompareRecentImagePreview();
        this._shiftPhotoCompareDraggingRecentImage = item;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copy';
            event.dataTransfer.setData('application/x-shift-photo-recent-image', String(Number(index) || 0));
            event.dataTransfer.setData('text/plain', item.label || '最近使った画像');
        }
    }

    handleShiftPhotoCompareRecentImageDragOver(event) {
        const types = Array.from(event.dataTransfer?.types || []);
        if (!this._shiftPhotoCompareDraggingRecentImage && !types.includes('application/x-shift-photo-recent-image')) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }

    endShiftPhotoCompareRecentImageDrag() {
        this._shiftPhotoCompareDraggingRecentImage = null;
    }

    dropShiftPhotoCompareRecentImageStamp(event, wrap) {
        const indexText = event.dataTransfer?.getData?.('application/x-shift-photo-recent-image');
        const item = this._shiftPhotoCompareDraggingRecentImage || this.getShiftPhotoCompareRecentImageStamps()[Number(indexText) || 0];
        if (!item?.src || !wrap) return;
        event.preventDefault();
        this._shiftPhotoCompareImageStampSrc = item.src;
        this.applyShiftPhotoCompareRecentImageSizePreset(item);
        this.setShiftPhotoCompareMarkModeDirect('image');
        this.pushShiftPhotoCompareUndo();
        const mark = this.addShiftPhotoCompareMark(event, wrap);
        if (!mark) return;
        this.selectShiftPhotoCompareMark(mark);
        if (this._shiftPhotoCompareMarkMode !== 'move') this.setShiftPhotoCompareMarkModeDirect('move');
        if (wrap.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(wrap);
        else this.syncShiftPhotoCompareMarks(wrap);
        this.refreshShiftPhotoCompareMarkList();
        this.autoSaveShiftNotebook(true);
        this.rememberShiftPhotoCompareImageStamp(item.src, item.label || '画像');
        this._shiftPhotoCompareDraggingRecentImage = null;
        this.clearShiftPhotoCompareSnapGuidesAfterPlacement();
        this.showShiftPhotoCompareActionMessage('最近画像を貼り付けました。');
    }

    dropShiftPhotoCompareRecentImageToShelf(event, toIndex = null) {
        const indexText = event.dataTransfer?.getData?.('application/x-shift-photo-recent-image');
        if (indexText === '') return;
        event.preventDefault();
        event.stopPropagation();
        const fromIndex = Number(indexText);
        const recent = this.getShiftPhotoCompareRecentImageStamps();
        if (!Number.isFinite(fromIndex) || fromIndex < 0 || fromIndex >= recent.length) return;
        const item = recent[fromIndex];
        const next = recent.filter((_, index) => index !== fromIndex);
        const rawTarget = toIndex === null ? next.length : Number(toIndex);
        let target = Number.isFinite(rawTarget) ? rawTarget : next.length;
        if (fromIndex < target) target -= 1;
        target = Math.max(0, Math.min(next.length, target));
        next.splice(target, 0, item);
        this.saveShiftPhotoCompareRecentImageStamps(next);
        this._shiftPhotoCompareDraggingRecentImage = null;
        this.showShiftPhotoCompareActionMessage('最近画像の順番を変更しました。');
    }

    handleShiftPhotoComparePasteEvent(event) {
        if (!document.getElementById('shift-photo-compare-overlay')) return;
        const items = Array.from(event?.clipboardData?.items || []);
        const imageItem = items.find(item => /^image\//i.test(item.type || ''));
        const file = imageItem?.getAsFile?.();
        if (!file) return;
        event.preventDefault();
        this.loadShiftPhotoCompareImageStampBlob(file);
    }

    async loadShiftPhotoCompareImageStampFromClipboard() {
        if (!document.getElementById('shift-photo-compare-overlay')) return;
        if (!navigator.clipboard?.read) {
            this.showShiftPhotoCompareActionMessage('Ctrl+Vでクリップボード画像を貼り付けできます。');
            return;
        }
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const type = item.types?.find(value => /^image\//i.test(value));
                if (!type) continue;
                const blob = await item.getType(type);
                if (this.loadShiftPhotoCompareImageStampBlob(blob)) return;
            }
            this.showShiftPhotoCompareActionMessage('クリップボードに画像がありません。');
        } catch (error) {
            this.showShiftPhotoCompareActionMessage('Ctrl+Vでクリップボード画像を貼り付けできます。');
        }
    }

    updateShiftPhotoCompareModeHint(message = '') {
        const hint = document.getElementById('shift-photo-compare-mode-hint');
        if (!hint) return;
        const mode = this._shiftPhotoCompareMarkMode || '';
        const brushMode = this._shiftPhotoCompareImageBrushMode || '';
        const labels = {
            erase: '削除モード中: 記号をクリックすると削除します。もう一度削除ボタンで解除できます。',
            eraseRange: '範囲削除モード中: ドラッグで囲むと範囲内の記号をまとめて削除します。',
            mosaicRange: 'モザイク範囲モード中: ドラッグで囲んだ範囲にモザイクをかけます。',
            selectRange: '範囲選択モード中: ドラッグで選択、Shiftで追加、Ctrlで除外できます。',
            move: '移動モード中: Shiftクリックで複数選択、ドラッグで移動できます。吸着ガイドがオンの時は中央線・端・他の記号に吸着します。',
            freehand: '線モード中: ドラッグで線を描けます。',
            circle: '丸モード中: 写真上をドラッグして丸を置けます。',
            arrow: '矢印モード中: 写真上をドラッグして矢印を置けます。',
            rect: '四角モード中: 写真上をドラッグして四角を置けます。',
            xmark: 'バツ印モード中: 写真上をドラッグしてバツ印を置けます。',
            text: '文字モード中: 入力欄の文字を写真上に置けます。',
            number: '番号モード中: 写真上をクリックして連番を置けます。',
            image: '画像スタンプモード中: 写真上をクリックして読み込んだ画像を配置できます。'
        };
        const brushText = brushMode === 'restore'
            ? `復元ブラシ中: 太さ${this.getShiftPhotoCompareImageBrushSize()}。画像スタンプ上をドラッグすると元画像から戻します。`
            : (brushMode === 'erase'
                ? `画像消しゴム中: 太さ${this.getShiftPhotoCompareImageBrushSize()}。画像スタンプ上をドラッグすると透明にします。`
                : '');
        const text = message || brushText || labels[mode] || '';
        hint.hidden = !text;
        hint.textContent = text;
        hint.classList.toggle('danger', mode === 'erase' || mode === 'eraseRange' || brushMode === 'erase');
        const chip = document.getElementById('shift-photo-compare-mode-chip');
        if (chip) {
            const shortLabels = {
                erase: '削除',
                eraseRange: '範囲削除',
                mosaicRange: 'モザイク',
                selectRange: '範囲選択',
                move: '移動',
                freehand: '線',
                circle: '丸',
                arrow: '矢印',
                rect: '四角',
                xmark: 'バツ',
                text: '文字',
                number: '番号',
                image: '画像'
            };
            chip.textContent = brushMode === 'restore' ? '復元ブラシ' : (brushMode === 'erase' ? '画像消しゴム' : (shortLabels[mode] || '通常'));
            chip.classList.toggle('danger', mode === 'erase' || mode === 'eraseRange' || brushMode === 'erase');
            chip.classList.toggle('active', !!mode || !!brushMode);
        }
    }

    showShiftPhotoCompareActionMessage(message = '') {
        this.updateShiftPhotoCompareModeHint(message);
        clearTimeout(this._shiftPhotoCompareActionMessageTimer);
        this._shiftPhotoCompareActionMessageTimer = setTimeout(() => this.updateShiftPhotoCompareModeHint(), 1800);
    }

    flashShiftPhotoCompareUndoButton() {
        const button = document.querySelector('.shift-photo-compare-undo');
        if (!button) return;
        button.classList.add('undo-attention');
        const count = this._shiftPhotoCompareUndoStack?.length || 0;
        button.title = count ? `元に戻す (${count}件)` : '元に戻す';
        button.dataset.undoCount = count ? String(count) : '';
        clearTimeout(button._undoAttentionTimer);
        button._undoAttentionTimer = setTimeout(() => button.classList.remove('undo-attention'), 1400);
    }

    updateShiftPhotoCompareUndoButton() {
        const button = document.querySelector('.shift-photo-compare-undo');
        if (!button) return;
        const count = this._shiftPhotoCompareUndoStack?.length || 0;
        button.classList.toggle('has-undo', count > 0);
        button.title = count ? `元に戻す (${count}件)` : '元に戻す';
        button.dataset.undoCount = count ? String(count) : '';
    }

    getShiftPhotoCompareSnapshot() {
        return {
            wraps: Array.from(document.querySelectorAll('.shift-photo-compare-image-wrap')).map(wrap => ({
                html: wrap.querySelector('.shift-photo-compare-mark-layer')?.innerHTML || ''
            })),
            globalHtml: document.querySelector('.shift-photo-compare-global-layer')?.innerHTML || ''
        };
    }

    pushShiftPhotoCompareUndo() {
        this._shiftPhotoCompareUndoStack = this._shiftPhotoCompareUndoStack || [];
        this._shiftPhotoCompareUndoStack.push(this.getShiftPhotoCompareSnapshot());
        if (this._shiftPhotoCompareUndoStack.length > 30) this._shiftPhotoCompareUndoStack.shift();
        this.updateShiftPhotoCompareUndoButton();
    }

    restoreShiftPhotoCompareSnapshot(snapshot) {
        if (!snapshot) return;
        Array.from(document.querySelectorAll('.shift-photo-compare-image-wrap')).forEach((wrap, index) => {
            const layer = wrap.querySelector('.shift-photo-compare-mark-layer');
            if (layer) layer.innerHTML = snapshot.wraps?.[index]?.html || '';
            this.syncShiftPhotoCompareMarks(wrap);
        });
        const globalLayer = document.querySelector('.shift-photo-compare-global-layer');
        if (globalLayer) {
            globalLayer.innerHTML = snapshot.globalHtml || '';
            this.syncShiftPhotoCompareGlobalMarks(globalLayer);
        }
        this.selectShiftPhotoCompareMark(null);
        this.refreshShiftPhotoCompareMarkList();
        this.autoSaveShiftNotebook(true);
        this.updateShiftPhotoCompareUndoButton();
        this.updateShiftPhotoCompareMiniToolbar();
    }

    undoShiftPhotoCompareMarkChange() {
        const snapshot = this._shiftPhotoCompareUndoStack?.pop?.();
        if (!snapshot) return;
        this.restoreShiftPhotoCompareSnapshot(snapshot);
        this.showShiftPhotoCompareActionMessage('元に戻しました。');
    }

    toggleShiftPhotoCompareGlobalTarget() {
        this._shiftPhotoCompareGlobalTarget = !this._shiftPhotoCompareGlobalTarget;
        const overlay = document.getElementById('shift-photo-compare-overlay');
        overlay?.classList.toggle('global-target', !!this._shiftPhotoCompareGlobalTarget);
        document.querySelector('.shift-photo-compare-global-target')?.classList.toggle('active', !!this._shiftPhotoCompareGlobalTarget);
    }

    setShiftPhotoCompareMarkColor(value) {
        this._shiftPhotoCompareMarkColor = /^#[0-9a-f]{6}$/i.test(value || '') ? value : '#dc2626';
        const colorInput = document.querySelector('.shift-photo-compare-color input[type="color"]');
        if (colorInput) colorInput.value = this._shiftPhotoCompareMarkColor;
        this.applyShiftPhotoCompareSettingsToSelectedMark({ color: this._shiftPhotoCompareMarkColor });
        this.updateShiftPhotoCompareSample();
    }

    getShiftPhotoCompareNumberText(number) {
        const circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
        return circled[number - 1] || String(number);
    }

    resetShiftPhotoCompareNumberCount() {
        this._shiftPhotoCompareNumberNext = 1;
        const button = document.querySelector('.shift-photo-compare-number-reset');
        if (!button) return;
        button.classList.add('reset-flash');
        setTimeout(() => button.classList.remove('reset-flash'), 450);
    }

    resetShiftPhotoCompareMarkDefaults() {
        this._shiftPhotoCompareMarkSize = 56;
        this._shiftPhotoCompareMarkAngle = 0;
        this._shiftPhotoCompareMarkStretch = 100;
        this._shiftPhotoCompareMarkStretchY = 100;
        this._shiftPhotoCompareMarkStroke = 100;
        this._shiftPhotoCompareMarkColor = '#dc2626';
        this._shiftPhotoCompareMarkFont = 'gothic';
        this._shiftPhotoCompareTextOutline = true;
        const sizeInput = document.querySelector('.shift-photo-compare-size input[oninput*="MarkSize"]');
        const stretchInput = document.querySelector('.shift-photo-compare-size input[oninput*="MarkStretch"]');
        const stretchYInput = document.querySelector('.shift-photo-compare-size input[oninput*="MarkStretchY"]');
        const strokeInput = document.querySelector('.shift-photo-compare-size input[oninput*="MarkStroke"]');
        const colorInput = document.querySelector('.shift-photo-compare-color input[type="color"]');
        const fontInput = document.querySelector('.shift-photo-compare-font select');
        if (sizeInput) sizeInput.value = '56';
        if (stretchInput) stretchInput.value = '100';
        if (stretchYInput) stretchYInput.value = '100';
        if (strokeInput) strokeInput.value = '100';
        if (colorInput) colorInput.value = '#dc2626';
        if (fontInput) fontInput.value = 'gothic';
        document.querySelector('.shift-photo-compare-outline')?.classList.add('active');
        const sizeLabel = document.getElementById('shift-photo-compare-size-value');
        const angleLabel = document.getElementById('shift-photo-compare-angle-value');
        const stretchLabel = document.getElementById('shift-photo-compare-stretch-value');
        const stretchYLabel = document.getElementById('shift-photo-compare-stretch-y-value');
        const strokeLabel = document.getElementById('shift-photo-compare-stroke-value');
        if (sizeLabel) sizeLabel.textContent = '56';
        if (angleLabel) angleLabel.textContent = '0';
        if (stretchLabel) stretchLabel.textContent = '100';
        if (stretchYLabel) stretchYLabel.textContent = '100';
        if (strokeLabel) strokeLabel.textContent = '100';
        const dial = document.querySelector('.shift-photo-angle-dial');
        if (dial) dial.style.setProperty('--angle', '0deg');
        this.updateShiftPhotoCompareSample();
        const button = document.querySelector('.shift-photo-compare-default-reset');
        button?.classList.add('reset-flash');
        setTimeout(() => button?.classList.remove('reset-flash'), 450);
    }

    setShiftPhotoCompareMarkSize(value) {
        const size = Math.max(24, Math.min(700, parseInt(value, 10) || 56));
        this._shiftPhotoCompareMarkSize = size;
        const label = document.getElementById('shift-photo-compare-size-value');
        if (label) label.textContent = String(size);
        this.applyShiftPhotoCompareSettingsToSelectedMark({ size });
        this.updateShiftPhotoCompareSample();
    }

    setShiftPhotoCompareMarkAngle(value) {
        const angle = Math.max(0, Math.min(360, parseInt(value, 10) || 0));
        this._shiftPhotoCompareMarkAngle = angle;
        const label = document.getElementById('shift-photo-compare-angle-value');
        if (label) label.textContent = String(angle);
        const dial = document.querySelector('.shift-photo-angle-dial');
        if (dial) dial.style.setProperty('--angle', `${angle}deg`);
        this.applyShiftPhotoCompareSettingsToSelectedMark({ angle });
        this.updateShiftPhotoCompareSample();
    }

    updateShiftPhotoCompareAngleFromPointer(event, dial) {
        const rect = dial?.getBoundingClientRect();
        if (!rect?.width || !rect?.height) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const rad = Math.atan2(event.clientY - cy, event.clientX - cx);
        const angle = Math.round((rad * 180 / Math.PI + 360) % 360);
        this.setShiftPhotoCompareMarkAngle(angle);
    }

    startShiftPhotoCompareAngleDial(event, dial) {
        if (!dial) return;
        event.preventDefault();
        this.updateShiftPhotoCompareAngleFromPointer(event, dial);
        const move = (moveEvent) => {
            moveEvent.preventDefault();
            this.updateShiftPhotoCompareAngleFromPointer(moveEvent, dial);
        };
        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
    }

    setShiftPhotoCompareMarkStretch(value) {
        const stretch = Math.max(50, Math.min(500, parseInt(value, 10) || 100));
        this._shiftPhotoCompareMarkStretch = stretch;
        const label = document.getElementById('shift-photo-compare-stretch-value');
        if (label) label.textContent = String(stretch);
        this.applyShiftPhotoCompareSettingsToSelectedMark({ stretch: stretch / 100 });
        this.updateShiftPhotoCompareSample();
    }

    setShiftPhotoCompareMarkStretchY(value) {
        const stretchY = Math.max(50, Math.min(260, parseInt(value, 10) || 100));
        this._shiftPhotoCompareMarkStretchY = stretchY;
        const label = document.getElementById('shift-photo-compare-stretch-y-value');
        if (label) label.textContent = String(stretchY);
        this.applyShiftPhotoCompareSettingsToSelectedMark({ stretchY: stretchY / 100 });
        this.updateShiftPhotoCompareSample();
    }

    setShiftPhotoCompareMarkStroke(value) {
        const stroke = Math.max(35, Math.min(300, parseInt(value, 10) || 100));
        this._shiftPhotoCompareMarkStroke = stroke;
        const label = document.getElementById('shift-photo-compare-stroke-value');
        if (label) label.textContent = String(stroke);
        this.applyShiftPhotoCompareSettingsToSelectedMark({ stroke: stroke / 100 });
        this.updateShiftPhotoCompareSample();
    }

    setShiftPhotoCompareMarkFont(value) {
        const font = this.getShiftPhotoCompareSafeFont(value);
        this._shiftPhotoCompareMarkFont = font;
        this.applyShiftPhotoCompareSettingsToSelectedMark({ font });
        this.updateShiftPhotoCompareSample();
    }

    toggleShiftPhotoCompareTextOutline() {
        this._shiftPhotoCompareTextOutline = !this._shiftPhotoCompareTextOutline;
        document.querySelector('.shift-photo-compare-outline')?.classList.toggle('active', !!this._shiftPhotoCompareTextOutline);
        this.applyShiftPhotoCompareSettingsToSelectedMark({ outline: !!this._shiftPhotoCompareTextOutline });
        this.updateShiftPhotoCompareSample();
    }

    setShiftPhotoCompareTextValue(value = '') {
        const text = String(value || '').slice(0, 120);
        const mark = this._shiftPhotoCompareSelectedMark;
        if (this._shiftPhotoCompareMarkMode === 'move'
            && mark
            && document.contains(mark)
            && mark.dataset.mode === 'text') {
            if (this._shiftPhotoCompareTextEditingMark !== mark) {
                this.pushShiftPhotoCompareUndo();
                this._shiftPhotoCompareTextEditingMark = mark;
            }
            this.applyShiftPhotoCompareSettingsToSelectedMark({ text });
        }
        this._shiftPhotoCompareSampleText = text;
        this.updateShiftPhotoCompareSample();
    }

    getShiftPhotoCompareSelectedMarks() {
        return Array.from(document.querySelectorAll('.shift-photo-compare-mark.selected'));
    }

    isShiftPhotoCompareMarkLocked(mark) {
        return mark?.dataset?.locked === '1';
    }

    getShiftPhotoCompareUnlockedMarks(marks = []) {
        return (marks || []).filter(mark => mark && document.contains(mark) && !this.isShiftPhotoCompareMarkLocked(mark));
    }

    getShiftPhotoComparePairId(mark) {
        return /^[a-z0-9_-]{4,40}$/i.test(mark?.dataset?.pairId || '') ? mark.dataset.pairId : '';
    }

    getShiftPhotoCompareGroupId(mark) {
        return /^[a-z0-9_-]{4,40}$/i.test(mark?.dataset?.groupId || '') ? mark.dataset.groupId : '';
    }

    getShiftPhotoCompareGroupedMarks(mark, includeSelf = false) {
        const groupId = this.getShiftPhotoCompareGroupId(mark);
        if (!groupId) return includeSelf && mark ? [mark] : [];
        const layer = mark.closest('.shift-photo-compare-mark-layer, .shift-photo-compare-global-layer');
        if (!layer) return includeSelf && mark ? [mark] : [];
        const safeId = window.CSS?.escape ? CSS.escape(groupId) : groupId.replace(/"/g, '\\"');
        return Array.from(layer.querySelectorAll(`.shift-photo-compare-mark[data-group-id="${safeId}"]`))
            .filter(item => includeSelf || item !== mark);
    }

    getShiftPhotoComparePairedMarks(mark, includeSelf = false) {
        const pairId = this.getShiftPhotoComparePairId(mark);
        if (!pairId) return includeSelf && mark ? [mark] : [];
        const layer = mark.closest('.shift-photo-compare-mark-layer, .shift-photo-compare-global-layer');
        if (!layer) return includeSelf && mark ? [mark] : [];
        return Array.from(layer.querySelectorAll(`.shift-photo-compare-mark[data-pair-id="${pairId}"]`))
            .filter(item => includeSelf || item !== mark);
    }

    expandShiftPhotoCompareMarksWithPairs(marks = []) {
        const expanded = new Set();
        marks.forEach(mark => {
            if (!mark || !document.contains(mark)) return;
            expanded.add(mark);
            this.getShiftPhotoComparePairedMarks(mark).forEach(pair => expanded.add(pair));
            this.getShiftPhotoCompareGroupedMarks(mark).forEach(groupMark => {
                expanded.add(groupMark);
                this.getShiftPhotoComparePairedMarks(groupMark).forEach(pair => expanded.add(pair));
            });
        });
        return Array.from(expanded);
    }

    getShiftPhotoCompareNumberTextPair(mark = this._shiftPhotoCompareSelectedMark) {
        return this.getShiftPhotoCompareNumberTextPairs(mark)[0] || null;
    }

    getShiftPhotoCompareNumberTextPairs(mark = this._shiftPhotoCompareSelectedMark) {
        const candidates = this.getShiftPhotoCompareSelectedMarks();
        if (mark && document.contains(mark) && !candidates.includes(mark)) candidates.unshift(mark);
        const seen = new Set();
        const pairs = [];
        for (const item of candidates) {
            const pairId = this.getShiftPhotoComparePairId(item);
            if (!pairId || seen.has(pairId)) continue;
            const paired = this.getShiftPhotoComparePairedMarks(item, true);
            const number = paired.find(pair => pair.dataset.mode === 'number' || pair.dataset.pairRole === 'number');
            const text = paired.find(pair => pair.dataset.mode === 'text' || pair.dataset.pairRole === 'text');
            const wrap = number?.closest('.shift-photo-compare-image-wrap') || number?.closest('.shift-photo-compare-global-layer');
            if (number && text && wrap) {
                pairs.push({ number, text, wrap, pairId });
                seen.add(pairId);
            }
        }
        return pairs;
    }

    getShiftPhotoCompareStyleTargetMarks() {
        const selected = this.getShiftPhotoCompareSelectedMarks();
        if (this._shiftPhotoCompareMarkMode === 'move' && selected.length) return this.getShiftPhotoCompareUnlockedMarks(selected);
        const mark = this._shiftPhotoCompareSelectedMark;
        return mark && document.contains(mark) && !this.isShiftPhotoCompareMarkLocked(mark) ? [mark] : [];
    }

    syncShiftPhotoCompareSelectionState() {
        this._shiftPhotoCompareSelectedMarks = this.getShiftPhotoCompareSelectedMarks();
        if (!this._shiftPhotoCompareSelectedMarks.includes(this._shiftPhotoCompareSelectedMark)) {
            this._shiftPhotoCompareSelectedMark = this._shiftPhotoCompareSelectedMarks.at(-1) || null;
        }
    }

    clearShiftPhotoCompareSelection() {
        this.clearShiftPhotoCompareTransientModes({ keepMove: true, silent: true });
        this.selectShiftPhotoCompareMark(null);
        this.showShiftPhotoCompareActionMessage('選択を解除しました。');
    }

    toggleSelectedShiftPhotoCompareMarkLock() {
        const marks = this.expandShiftPhotoCompareMarksWithPairs(this.getShiftPhotoCompareSelectedMarks()).filter(mark => document.contains(mark));
        if (!marks.length) return;
        const shouldLock = marks.some(mark => !this.isShiftPhotoCompareMarkLocked(mark));
        const syncTargets = new Set();
        this.pushShiftPhotoCompareUndo();
        marks.forEach(mark => {
            mark.dataset.locked = shouldLock ? '1' : '0';
            mark.classList.toggle('locked', shouldLock);
            const target = mark.closest('.shift-photo-compare-image-wrap') || mark.closest('.shift-photo-compare-global-layer');
            if (target) syncTargets.add(target);
        });
        syncTargets.forEach(target => {
            if (target.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(target);
            else this.syncShiftPhotoCompareMarks(target);
        });
        this.refreshShiftPhotoCompareMarkList();
        this.updateShiftPhotoCompareMiniToolbar();
        this.autoSaveShiftNotebook(true);
        this.showShiftPhotoCompareActionMessage(shouldLock ? `${marks.length}件をロックしました。` : `${marks.length}件のロックを解除しました。`);
    }

    toggleSelectedShiftPhotoCompareMarkGroup() {
        const selected = this.expandShiftPhotoCompareMarksWithPairs(this.getShiftPhotoCompareSelectedMarks()).filter(mark => document.contains(mark));
        if (selected.length < 2) {
            const mark = this._shiftPhotoCompareSelectedMark;
            const grouped = this.getShiftPhotoCompareGroupedMarks(mark, true).filter(item => document.contains(item));
            if (grouped.length >= 2) return this.ungroupShiftPhotoCompareMarks(grouped);
            this.showShiftPhotoCompareActionMessage('グループ化する記号を2件以上選択してください。');
            return;
        }
        const layer = selected[0].closest('.shift-photo-compare-mark-layer, .shift-photo-compare-global-layer');
        const sameLayer = selected.filter(mark => mark.closest('.shift-photo-compare-mark-layer, .shift-photo-compare-global-layer') === layer);
        if (sameLayer.length < 2) {
            this.showShiftPhotoCompareActionMessage('同じ写真内の記号だけをグループ化できます。');
            return;
        }
        const groupIds = [...new Set(sameLayer.map(mark => this.getShiftPhotoCompareGroupId(mark)).filter(Boolean))];
        const allSameGroup = groupIds.length === 1 && sameLayer.every(mark => this.getShiftPhotoCompareGroupId(mark) === groupIds[0]);
        if (allSameGroup) return this.ungroupShiftPhotoCompareMarks(this.getShiftPhotoCompareGroupedMarks(sameLayer[0], true));
        this.pushShiftPhotoCompareUndo();
        const groupId = `grp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        sameLayer.forEach(mark => {
            mark.dataset.groupId = groupId;
            mark.classList.add('grouped');
        });
        this.selectShiftPhotoCompareMark(null);
        sameLayer.forEach(mark => this.selectShiftPhotoCompareMark(mark, true));
        this.syncShiftPhotoCompareWrapForMark(sameLayer[0]);
        this.refreshShiftPhotoCompareMarkList();
        this.updateShiftPhotoCompareMiniToolbar();
        this.autoSaveShiftNotebook(true);
        this.showShiftPhotoCompareActionMessage(`${sameLayer.length}件をグループ化しました。`);
    }

    ungroupShiftPhotoCompareMarks(marks = []) {
        const targets = (marks || []).filter(mark => document.contains(mark) && this.getShiftPhotoCompareGroupId(mark));
        if (!targets.length) return;
        this.pushShiftPhotoCompareUndo();
        targets.forEach(mark => {
            mark.dataset.groupId = '';
            mark.classList.remove('grouped');
        });
        this.syncShiftPhotoCompareWrapForMark(targets[0]);
        this.refreshShiftPhotoCompareMarkList();
        this.updateShiftPhotoCompareMiniToolbar();
        this.autoSaveShiftNotebook(true);
        this.showShiftPhotoCompareActionMessage(`${targets.length}件のグループ化を解除しました。`);
    }

    selectShiftPhotoCompareMark(mark, additive = false) {
        if (!additive) {
            document.querySelectorAll('.shift-photo-compare-mark.selected').forEach(item => item.classList.remove('selected'));
        }
        if (mark && additive && mark.classList.contains('selected')) {
            mark.classList.remove('selected');
            this.syncShiftPhotoCompareSelectionState();
            this._shiftPhotoCompareTextEditingMark = null;
            this.updateShiftPhotoCompareMiniToolbar();
            this.refreshShiftPhotoCompareMarkList();
            return;
        }
        this._shiftPhotoCompareSelectedMark = mark || null;
        this._shiftPhotoCompareTextEditingMark = null;
        if (!mark) {
            this.clearShiftPhotoCompareImageBrushMode({ silent: true });
            this.syncShiftPhotoCompareSelectionState();
            this.updateShiftPhotoCompareMiniToolbar();
            return;
        }
        mark.classList.add('selected');
        if (!additive) {
            this.getShiftPhotoCompareGroupedMarks(mark).forEach(groupMark => groupMark.classList.add('selected'));
        }
        this.syncShiftPhotoCompareSelectionState();
        const size = parseFloat(mark.dataset.size || '') || 56;
        const angle = parseFloat(mark.dataset.angle || '') || 0;
        const stretch = Math.round((parseFloat(mark.dataset.stretch || '') || 1) * 100);
        const stretchY = Math.round((parseFloat(mark.dataset.stretchY || '') || 1) * 100);
        const stroke = Math.round((parseFloat(mark.dataset.stroke || '') || 1) * 100);
        const color = /^#[0-9a-f]{6}$/i.test(mark.dataset.color || '') ? mark.dataset.color : '#dc2626';
        const font = this.getShiftPhotoCompareSafeFont(mark.dataset.font || '');
        const outline = mark.dataset.outline !== '0';
        const sizeInput = document.querySelector('.shift-photo-compare-size input[oninput*="MarkSize"]');
        const stretchInput = document.querySelector('.shift-photo-compare-size input[oninput*="MarkStretch"]');
        const stretchYInput = document.querySelector('.shift-photo-compare-size input[oninput*="MarkStretchY"]');
        const strokeInput = document.querySelector('.shift-photo-compare-size input[oninput*="MarkStroke"]');
        const colorInput = document.querySelector('.shift-photo-compare-color input[type="color"]');
        const fontInput = document.querySelector('.shift-photo-compare-font select');
        const textInput = document.getElementById('shift-photo-compare-text-input');
        if (sizeInput) sizeInput.value = String(size);
        if (stretchInput) stretchInput.value = String(stretch);
        if (stretchYInput) stretchYInput.value = String(stretchY);
        if (strokeInput) strokeInput.value = String(stroke);
        if (colorInput) colorInput.value = color;
        if (fontInput) fontInput.value = font;
        if (textInput && mark.dataset.mode === 'text') textInput.value = mark.dataset.text || '';
        document.querySelector('.shift-photo-compare-outline')?.classList.toggle('active', outline);
        this._shiftPhotoCompareMarkSize = size;
        this._shiftPhotoCompareMarkAngle = angle;
        this._shiftPhotoCompareMarkStretch = stretch;
        this._shiftPhotoCompareMarkStretchY = stretchY;
        this._shiftPhotoCompareMarkStroke = stroke;
        this._shiftPhotoCompareMarkColor = color;
        this._shiftPhotoCompareMarkFont = font;
        this._shiftPhotoCompareTextOutline = outline;
        this._shiftPhotoCompareSampleMode = mark.dataset.mode || 'circle';
        this._shiftPhotoCompareSampleText = mark.dataset.text || '';
        const sizeLabel = document.getElementById('shift-photo-compare-size-value');
        const angleLabel = document.getElementById('shift-photo-compare-angle-value');
        const stretchLabel = document.getElementById('shift-photo-compare-stretch-value');
        const stretchYLabel = document.getElementById('shift-photo-compare-stretch-y-value');
        const strokeLabel = document.getElementById('shift-photo-compare-stroke-value');
        if (sizeLabel) sizeLabel.textContent = String(size);
        if (angleLabel) angleLabel.textContent = String(angle);
        if (stretchLabel) stretchLabel.textContent = String(stretch);
        if (stretchYLabel) stretchYLabel.textContent = String(stretchY);
        if (strokeLabel) strokeLabel.textContent = String(stroke);
        const dial = document.querySelector('.shift-photo-angle-dial');
        if (dial) dial.style.setProperty('--angle', `${angle}deg`);
        this.updateShiftPhotoCompareSample();
        this.refreshShiftPhotoCompareMarkList();
        this.updateShiftPhotoCompareMiniToolbar();
    }

    updateShiftPhotoCompareMiniToolbar() {
        const toolbar = document.getElementById('shift-photo-compare-mini-toolbar');
        const mark = this._shiftPhotoCompareSelectedMark;
        if (!toolbar) return;
        const selected = this.getShiftPhotoCompareSelectedMarks();
        if (!mark || !document.contains(mark) || !selected.length || this._shiftPhotoCompareMarkMode !== 'move') {
            toolbar.hidden = true;
            this._shiftPhotoCompareMiniToolbarPinned = false;
            this.updateShiftPhotoCompareSelectionBounds();
            return;
        }
        const layoutCount = this.getShiftPhotoCompareLayoutItemsInSameLayer().length;
        toolbar.dataset.selectedCount = layoutCount > 1 && layoutCount < selected.length ? `${layoutCount}組` : (selected.length > 1 ? `${selected.length}件` : '');
        toolbar.dataset.primaryMode = mark.dataset.mode || '';
        toolbar.dataset.hasNumberTextPair = this.getShiftPhotoCompareNumberTextPair(mark) ? '1' : '';
        toolbar.dataset.hasImageSelection = selected.some(item => item.dataset.mode === 'image') ? '1' : '';
        toolbar.dataset.hasLockedSelection = selected.some(item => this.isShiftPhotoCompareMarkLocked(item)) ? '1' : '';
        const lockButton = toolbar.querySelector('.shift-photo-compare-lock-btn');
        if (lockButton) {
            const locked = selected.length > 0 && selected.every(item => this.isShiftPhotoCompareMarkLocked(item));
            lockButton.classList.toggle('active', locked);
            lockButton.title = locked ? '選択中のロックを解除' : '選択中の記号をロック';
            lockButton.innerHTML = locked ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-solid fa-lock-open"></i>';
        }
        const groupButton = toolbar.querySelector('.shift-photo-compare-group-btn');
        if (groupButton) {
            const groupIds = [...new Set(selected.map(item => this.getShiftPhotoCompareGroupId(item)).filter(Boolean))];
            const grouped = groupIds.length === 1 && selected.length > 1 && selected.every(item => this.getShiftPhotoCompareGroupId(item) === groupIds[0]);
            groupButton.classList.toggle('active', grouped);
            groupButton.title = grouped ? 'グループ化を解除' : '選択中の記号をグループ化';
            groupButton.innerHTML = grouped ? '<i class="fa-solid fa-link-slash"></i>' : '<i class="fa-solid fa-link"></i>';
        }
        const panel = document.querySelector('.shift-photo-compare-panel');
        const selectedRects = selected.map(item => item.getBoundingClientRect()).filter(rect => rect.width || rect.height);
        const markRect = selectedRects.length > 1
            ? {
                left: Math.min(...selectedRects.map(rect => rect.left)),
                top: Math.min(...selectedRects.map(rect => rect.top)),
                width: Math.max(...selectedRects.map(rect => rect.right)) - Math.min(...selectedRects.map(rect => rect.left))
            }
            : mark.getBoundingClientRect();
        const panelRect = panel?.getBoundingClientRect();
        if (!panelRect?.width || !markRect?.width) {
            toolbar.hidden = true;
            return;
        }
        toolbar.hidden = false;
        if (this._shiftPhotoCompareMiniToolbarPinned) {
            this.updateShiftPhotoCompareSelectionBounds();
            return;
        }
        const left = Math.max(8, Math.min(panelRect.width - toolbar.offsetWidth - 8, markRect.left - panelRect.left + markRect.width / 2 - toolbar.offsetWidth / 2));
        const top = Math.max(48, Math.min(panelRect.height - toolbar.offsetHeight - 8, markRect.top - panelRect.top - toolbar.offsetHeight - 51));
        toolbar.style.left = `${left}px`;
        toolbar.style.top = `${top}px`;
        this.updateShiftPhotoCompareSelectionBounds();
    }

    startShiftPhotoCompareMiniToolbarDrag(event, toolbar) {
        if (!toolbar || event.button !== 0 || event.target.closest('button')) return;
        const panel = document.querySelector('.shift-photo-compare-panel');
        const panelRect = panel?.getBoundingClientRect();
        const toolbarRect = toolbar.getBoundingClientRect();
        if (!panelRect?.width || !toolbarRect?.width) return;
        event.preventDefault();
        this._shiftPhotoCompareMiniToolbarPinned = true;
        const start = {
            x: event.clientX,
            y: event.clientY,
            left: toolbarRect.left - panelRect.left,
            top: toolbarRect.top - panelRect.top
        };
        const move = (moveEvent) => {
            moveEvent.preventDefault();
            const left = Math.max(8, Math.min(panelRect.width - toolbar.offsetWidth - 8, start.left + moveEvent.clientX - start.x));
            const top = Math.max(8, Math.min(panelRect.height - toolbar.offsetHeight - 8, start.top + moveEvent.clientY - start.y));
            toolbar.style.left = `${left}px`;
            toolbar.style.top = `${top}px`;
        };
        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
    }

    updateShiftPhotoCompareSelectionBounds() {
        let box = document.getElementById('shift-photo-compare-selection-bounds');
        const selected = this.getShiftPhotoCompareSelectedMarks();
        if (!selected.length || this._shiftPhotoCompareMarkMode !== 'move') {
            box?.remove();
            return;
        }
        const panel = document.querySelector('.shift-photo-compare-panel');
        const panelRect = panel?.getBoundingClientRect();
        if (!panel || !panelRect?.width) return;
        const rects = selected.map(mark => mark.getBoundingClientRect()).filter(rect => rect.width || rect.height);
        if (!rects.length) return;
        const groupIds = [...new Set(selected.map(mark => this.getShiftPhotoCompareGroupId(mark)).filter(Boolean))];
        const left = Math.min(...rects.map(rect => rect.left)) - panelRect.left - 8;
        const top = Math.min(...rects.map(rect => rect.top)) - panelRect.top - 8;
        const right = Math.max(...rects.map(rect => rect.right)) - panelRect.left + 8;
        const bottom = Math.max(...rects.map(rect => rect.bottom)) - panelRect.top + 8;
        if (!box) {
            box = document.createElement('div');
            box.id = 'shift-photo-compare-selection-bounds';
            box.className = 'shift-photo-compare-selection-bounds';
            box.onpointerdown = (event) => this.startShiftPhotoCompareSelectionBoundsDrag(event, box);
            box.innerHTML = `
                <span class="shift-photo-compare-resize-handle nw" data-corner="nw"></span>
                <span class="shift-photo-compare-resize-handle ne" data-corner="ne"></span>
                <span class="shift-photo-compare-resize-handle sw" data-corner="sw"></span>
                <span class="shift-photo-compare-resize-handle se" data-corner="se"></span>
            `;
            panel.appendChild(box);
        }
        box.style.left = `${Math.max(0, left)}px`;
        box.style.top = `${Math.max(0, top)}px`;
        box.style.width = `${Math.max(8, right - left)}px`;
        box.style.height = `${Math.max(8, bottom - top)}px`;
        box.dataset.grouped = groupIds.length ? '1' : '';
        box.dataset.groupLabel = groupIds.length ? `グループ ${selected.length}件` : '';
    }

    startShiftPhotoCompareSelectionBoundsDrag(event, box) {
        const selected = this.getShiftPhotoCompareUnlockedMarks(this.getShiftPhotoCompareSelectedMarks());
        if (!box || event.button !== 0 || !selected.length) return;
        const handle = event.target?.closest?.('.shift-photo-compare-resize-handle');
        if (handle) {
            const arrowHit = this.getShiftPhotoCompareArrowEndpointHit(event, selected);
            if (arrowHit) {
                this.startShiftPhotoCompareArrowEndpointDrag(event, arrowHit.mark, arrowHit.wrap, arrowHit.end);
                return;
            }
            this.startShiftPhotoCompareSelectionResize(event, box, handle.dataset.corner || 'se');
            return;
        }
        if (selected.length < 2) return;
        event.preventDefault();
        if (this._shiftPhotoCompareMarkMode !== 'move') this.setShiftPhotoCompareMarkModeDirect('move');
        this.pushShiftPhotoCompareUndo();
        const states = selected.map(mark => {
            const wrap = mark.closest('.shift-photo-compare-image-wrap') || mark.closest('.shift-photo-compare-global-layer');
            const rect = wrap?.getBoundingClientRect();
            return {
                mark,
                wrap,
                wrapWidth: rect?.width || 1,
                wrapHeight: rect?.height || 1,
                x: parseFloat(mark.style.left) || 0,
                y: parseFloat(mark.style.top) || 0,
                points: mark.dataset.mode === 'freehand' ? this.parseShiftPhotoCompareFreehandPoints(mark.dataset.points || '[]') : []
            };
        }).filter(item => item.wrap);
        const start = { x: event.clientX, y: event.clientY };
        const move = (moveEvent) => {
            moveEvent.preventDefault();
            states.forEach(item => {
                const dx = ((moveEvent.clientX - start.x) / item.wrapWidth) * 100;
                const dy = ((moveEvent.clientY - start.y) / item.wrapHeight) * 100;
                if (item.mark.dataset.mode === 'freehand') {
                    this.updateShiftPhotoCompareFreehandMark(item.mark, item.points.map(point => ({
                        x: Math.max(0, Math.min(100, point.x + dx)),
                        y: Math.max(0, Math.min(100, point.y + dy))
                    })));
                } else {
                    item.mark.style.left = `${Math.max(0, Math.min(100, item.x + dx))}%`;
                    item.mark.style.top = `${Math.max(0, Math.min(100, item.y + dy))}%`;
                }
            });
            this.updateShiftPhotoCompareSelectionBounds();
            this.updateShiftPhotoCompareMiniToolbar();
        };
        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            states.forEach(item => this.rememberShiftPhotoCompareRecentImageSizePreset(item.mark));
            new Set(states.map(item => item.wrap)).forEach(wrap => {
                if (wrap.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(wrap);
                else this.syncShiftPhotoCompareMarks(wrap);
            });
            this.refreshShiftPhotoCompareMarkList();
            this.autoSaveShiftNotebook(true);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
    }

    startShiftPhotoCompareSelectionResize(event, box, corner = 'se') {
        const selected = this.expandShiftPhotoCompareMarksWithPairs(this.getShiftPhotoCompareSelectedMarks())
            .filter(mark => mark.dataset.mode !== 'freehand' && !this.isShiftPhotoCompareMarkLocked(mark));
        if (!selected.length) return;
        event.preventDefault();
        event.stopPropagation();
        if (this._shiftPhotoCompareMarkMode !== 'move') this.setShiftPhotoCompareMarkModeDirect('move');
        this.pushShiftPhotoCompareUndo();
        const boxRect = box.getBoundingClientRect();
        const center = {
            x: boxRect.left + boxRect.width / 2,
            y: boxRect.top + boxRect.height / 2
        };
        const startDistance = Math.max(12, Math.hypot(event.clientX - center.x, event.clientY - center.y));
        const states = selected.map(mark => {
            const wrap = mark.closest('.shift-photo-compare-image-wrap') || mark.closest('.shift-photo-compare-global-layer');
            const wrapRect = wrap?.getBoundingClientRect();
            return {
                mark,
                wrap,
                wrapWidth: wrapRect?.width || 1,
                wrapHeight: wrapRect?.height || 1,
                x: parseFloat(mark.style.left) || 0,
                y: parseFloat(mark.style.top) || 0,
                size: parseFloat(mark.dataset.size || '') || 56,
                stretch: parseFloat(mark.dataset.stretch || '') || 1,
                stretchY: parseFloat(mark.dataset.stretchY || '') || 1,
                centerX: wrapRect ? ((center.x - wrapRect.left) / wrapRect.width) * 100 : 50,
                centerY: wrapRect ? ((center.y - wrapRect.top) / wrapRect.height) * 100 : 50
            };
        }).filter(item => item.wrap);
        const move = (moveEvent) => {
            moveEvent.preventDefault();
            const distance = Math.max(4, Math.hypot(moveEvent.clientX - center.x, moveEvent.clientY - center.y));
            const scale = Math.max(0.1, Math.min(10, distance / startDistance));
            states.forEach(item => {
                const nextSize = Math.max(24, Math.min(item.mark.dataset.mode === 'mosaic' ? 1200 : 700, item.size * scale));
                item.mark.dataset.size = String(Math.round(nextSize));
                item.mark.style.setProperty('--mark-size', `${nextSize}px`);
                item.mark.style.left = `${Math.max(0, Math.min(100, item.centerX + (item.x - item.centerX) * scale))}%`;
                item.mark.style.top = `${Math.max(0, Math.min(100, item.centerY + (item.y - item.centerY) * scale))}%`;
            });
            const first = states[0]?.mark;
            if (first) {
                const sizeInput = document.querySelector('.shift-photo-compare-size input[oninput*="MarkSize"]');
                const sizeLabel = document.getElementById('shift-photo-compare-size-value');
                const size = Math.round(parseFloat(first.dataset.size || '') || 56);
                if (sizeInput) sizeInput.value = String(size);
                if (sizeLabel) sizeLabel.textContent = String(size);
                this._shiftPhotoCompareMarkSize = size;
            }
            this.updateShiftPhotoCompareSelectionBounds();
            this.updateShiftPhotoCompareMiniToolbar();
        };
        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            new Set(states.map(item => item.wrap)).forEach(wrap => {
                if (wrap.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(wrap);
                else this.syncShiftPhotoCompareMarks(wrap);
            });
            this.refreshShiftPhotoCompareMarkList();
            this.autoSaveShiftNotebook(true);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
    }

    applyShiftPhotoCompareSettingsToSelectedMark(settings = {}) {
        const marks = this.getShiftPhotoCompareStyleTargetMarks();
        if (!marks.length || this._shiftPhotoCompareMarkMode !== 'move') return;
        if (!this._shiftPhotoCompareStyleEditingActive) {
            this.pushShiftPhotoCompareUndo();
            this._shiftPhotoCompareStyleEditingActive = true;
            clearTimeout(this._shiftPhotoCompareStyleEditingTimer);
        }
        clearTimeout(this._shiftPhotoCompareStyleEditingTimer);
        this._shiftPhotoCompareStyleEditingTimer = setTimeout(() => { this._shiftPhotoCompareStyleEditingActive = false; }, 800);
        const visualKeys = ['size', 'color', 'font', 'outline', 'stroke'];
        const settingKeys = Object.keys(settings);
        const shouldExpandPairs = settingKeys.length > 0 && settingKeys.every(key => visualKeys.includes(key));
        const targetMarks = this.getShiftPhotoCompareUnlockedMarks(shouldExpandPairs ? this.expandShiftPhotoCompareMarksWithPairs(marks) : marks);
        targetMarks.forEach(mark => {
            if (!document.contains(mark)) return;
            this.applyShiftPhotoCompareSettingsToMark(mark, settings);
            this.rememberShiftPhotoCompareRecentImageSizePreset(mark);
        });
        const syncTargets = new Set(targetMarks.map(mark => mark.closest('.shift-photo-compare-image-wrap') || mark.closest('.shift-photo-compare-global-layer')).filter(Boolean));
        syncTargets.forEach(target => {
            if (target.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(target);
            else this.syncShiftPhotoCompareMarks(target);
        });
        this.refreshShiftPhotoCompareMarkList();
        this.updateShiftPhotoCompareMiniToolbar();
        this.scheduleShiftNotebookAutoSave();
        if (targetMarks.length > 1) this.showShiftPhotoCompareActionMessage(`${targetMarks.length}件にスタイルを適用しました。`);
    }

    applyShiftPhotoCompareSettingsToMark(mark, settings = {}) {
        if (!mark) return;
        if (settings.size !== undefined) {
            const size = Math.max(24, Math.min(700, Number(settings.size) || 56));
            mark.dataset.size = String(size);
            mark.style.setProperty('--mark-size', `${size}px`);
        }
        if (settings.angle !== undefined) {
            const angle = Math.max(0, Math.min(360, Number(settings.angle) || 0));
            mark.dataset.angle = String(angle);
            mark.style.setProperty('--mark-rotate', `${angle}deg`);
        }
        if (settings.stretch !== undefined) {
            const stretch = Math.max(0.5, Math.min(5, Number(settings.stretch) || 1));
            mark.dataset.stretch = String(stretch);
            mark.style.setProperty('--mark-scale-x', String(stretch));
        }
        if (settings.stretchY !== undefined) {
            const stretchY = Math.max(0.5, Math.min(2.6, Number(settings.stretchY) || 1));
            mark.dataset.stretchY = String(stretchY);
            mark.style.setProperty('--mark-scale-y', String(stretchY));
        }
        if (settings.stroke !== undefined) {
            const stroke = Math.max(0.35, Math.min(3, Number(settings.stroke) || 1));
            mark.dataset.stroke = String(stroke);
            mark.style.setProperty('--mark-stroke', String(stroke));
        }
        if (settings.color !== undefined) {
            const color = /^#[0-9a-f]{6}$/i.test(settings.color || '') ? settings.color : '#dc2626';
            mark.dataset.color = color;
            mark.style.setProperty('--mark-color', color);
        }
        if (settings.font !== undefined) {
            const font = this.getShiftPhotoCompareSafeFont(settings.font);
            mark.dataset.font = font;
            mark.style.setProperty('--mark-font', this.getShiftPhotoCompareFontFamily(font));
        }
        if (settings.outline !== undefined) {
            mark.dataset.outline = settings.outline ? '1' : '0';
        }
        if (settings.text !== undefined && mark.dataset.mode === 'text') {
            const text = String(settings.text || '').slice(0, 120);
            mark.dataset.text = text;
            mark.innerHTML = this.escapeHtml(text);
            this._shiftPhotoCompareSampleText = text;
        }
    }

    getSelectedShiftPhotoImageMark() {
        const mark = this._shiftPhotoCompareSelectedMark;
        if (mark?.dataset?.mode === 'image' && document.contains(mark) && !this.isShiftPhotoCompareMarkLocked(mark)) return mark;
        return this.getShiftPhotoCompareSelectedMarks().find(item => item.dataset.mode === 'image' && document.contains(item) && !this.isShiftPhotoCompareMarkLocked(item)) || null;
    }

    setShiftPhotoImageMarkSource(mark, src, keepOriginal = true) {
        if (!mark || !/^data:image\//i.test(src || '')) return false;
        if (keepOriginal && !mark.dataset.originalImageSrc) mark.dataset.originalImageSrc = mark.dataset.imageSrc || src;
        mark.dataset.imageSrc = src;
        const img = mark.querySelector('img');
        if (img) img.src = src;
        return true;
    }

    syncShiftPhotoImageMark(mark, message = '') {
        const wrap = mark?.closest('.shift-photo-compare-image-wrap') || mark?.closest('.shift-photo-compare-global-layer');
        if (!wrap) return;
        if (wrap.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(wrap);
        else this.syncShiftPhotoCompareMarks(wrap);
        this.refreshShiftPhotoCompareMarkList();
        this.updateShiftPhotoCompareMiniToolbar();
        this.autoSaveShiftNotebook(true);
        if (message) this.showShiftPhotoCompareActionMessage(message);
    }

    async drawImageToWorkCanvas(src) {
        const img = await this.loadShiftPhotoCompareImage(src);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 1;
        canvas.height = img.naturalHeight || img.height || 1;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return { canvas, ctx };
    }

    async removeSelectedShiftPhotoImageBackground() {
        const mark = this.getSelectedShiftPhotoImageMark();
        if (!mark) {
            this.showShiftPhotoCompareActionMessage('背景を抜く画像スタンプを選択してください。');
            return;
        }
        const src = mark.dataset.imageSrc || mark.querySelector('img')?.src || '';
        if (!/^data:image\//i.test(src)) return;
        this.pushShiftPhotoCompareUndo();
        try {
            const { canvas, ctx } = await this.drawImageToWorkCanvas(src);
            if (!mark.dataset.originalImageSrc) mark.dataset.originalImageSrc = src;
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = image.data;
            const samplePoints = [
                [0, 0],
                [canvas.width - 1, 0],
                [0, canvas.height - 1],
                [canvas.width - 1, canvas.height - 1]
            ];
            const samples = samplePoints.map(([x, y]) => {
                const i = (Math.max(0, y) * canvas.width + Math.max(0, x)) * 4;
                return [data[i], data[i + 1], data[i + 2]];
            });
            const tolerance = 54;
            for (let i = 0; i < data.length; i += 4) {
                const near = samples.some(([r, g, b]) => {
                    const dr = data[i] - r;
                    const dg = data[i + 1] - g;
                    const db = data[i + 2] - b;
                    return Math.hypot(dr, dg, db) <= tolerance;
                });
                if (near) {
                    data[i + 3] = 0;
                }
            }
            ctx.putImageData(image, 0, 0);
            this.setShiftPhotoImageMarkSource(mark, canvas.toDataURL('image/png'));
            this.syncShiftPhotoImageMark(mark, '画像の背景色を簡易透明化しました。');
        } catch (error) {
            console.error(error);
            this.showShiftPhotoCompareActionMessage('背景抜きに失敗しました。');
        }
    }

    flipSelectedShiftPhotoImage(axis = 'x') {
        const mark = this.getSelectedShiftPhotoImageMark();
        if (!mark) return this.showShiftPhotoCompareActionMessage('反転する画像スタンプを選択してください。');
        this.pushShiftPhotoCompareUndo();
        if (axis === 'y') mark.dataset.flipY = mark.dataset.flipY === '-1' ? '1' : '-1';
        else mark.dataset.flipX = mark.dataset.flipX === '-1' ? '1' : '-1';
        this.syncShiftPhotoImageMark(mark, axis === 'y' ? '画像を上下反転しました。' : '画像を左右反転しました。');
    }

    rotateSelectedShiftPhotoImage90() {
        const mark = this.getSelectedShiftPhotoImageMark();
        if (!mark) return this.showShiftPhotoCompareActionMessage('回転する画像スタンプを選択してください。');
        const angle = ((parseFloat(mark.dataset.angle || '') || 0) + 90) % 360;
        this.pushShiftPhotoCompareUndo();
        mark.dataset.angle = String(angle);
        mark.style.setProperty('--mark-rotate', `${angle}deg`);
        this.syncShiftPhotoImageMark(mark, '画像を90度回転しました。');
    }

    adjustSelectedShiftPhotoImageOpacity(delta = 0) {
        const mark = this.getSelectedShiftPhotoImageMark();
        if (!mark) return this.showShiftPhotoCompareActionMessage('透明度を変える画像スタンプを選択してください。');
        const current = Math.max(0.1, Math.min(1, parseFloat(mark.dataset.opacity || '') || 1));
        const next = Math.max(0.1, Math.min(1, Math.round((current + Number(delta || 0)) * 10) / 10));
        this.pushShiftPhotoCompareUndo();
        mark.dataset.opacity = String(next);
        mark.style.setProperty('--mark-opacity', String(next));
        this.syncShiftPhotoImageMark(mark, `画像の不透明度を${Math.round(next * 100)}%にしました。`);
    }

    getShiftPhotoCompareImageBrushSize() {
        return Math.max(8, Math.min(160, Math.round(Number(this._shiftPhotoCompareImageBrushSize) || 32)));
    }

    setShiftPhotoCompareImageBrushSize(value = 32) {
        this._shiftPhotoCompareImageBrushSize = Math.max(8, Math.min(160, Math.round(Number(value) || 32)));
        this.updateShiftPhotoCompareImageBrushSizeControl();
        this.updateShiftPhotoCompareModeHint();
    }

    updateShiftPhotoCompareImageBrushSizeControl() {
        const value = this.getShiftPhotoCompareImageBrushSize();
        const input = document.querySelector('.shift-photo-compare-brush-size input');
        const label = document.getElementById('shift-photo-compare-brush-size-value');
        if (input) input.value = String(value);
        if (label) label.textContent = String(value);
    }

    setShiftPhotoCompareImageBrushMode(mode = '') {
        const next = this._shiftPhotoCompareImageBrushMode === mode ? '' : mode;
        if (!next) {
            this.clearShiftPhotoCompareImageBrushMode();
            return;
        }
        this._shiftPhotoCompareImageBrushMode = next;
        if (next && this._shiftPhotoCompareMarkMode !== 'move') this.setShiftPhotoCompareMarkModeDirect('move');
        document.querySelectorAll('.shift-photo-compare-image-tool').forEach(button => button.classList.remove('active'));
        const buttons = Array.from(document.querySelectorAll('.shift-photo-compare-image-tool'));
        if (next === 'erase') buttons.find(button => button.title?.includes('消しゴム'))?.classList.add('active');
        if (next === 'restore') buttons.find(button => button.title?.includes('復元'))?.classList.add('active');
        document.getElementById('shift-photo-compare-overlay')?.classList.toggle('image-brushing', true);
        this.updateShiftPhotoCompareModeHint();
        this.showShiftPhotoCompareActionMessage(next === 'restore'
            ? `復元ブラシ中: 太さ${this.getShiftPhotoCompareImageBrushSize()}。黄色い筆スライダーで太さ変更できます。`
            : `画像消しゴム中: 太さ${this.getShiftPhotoCompareImageBrushSize()}。黄色い筆スライダーで太さ変更できます。`);
    }

    clearShiftPhotoCompareImageBrushMode({ silent = false } = {}) {
        if (!this._shiftPhotoCompareImageBrushMode) return false;
        this._shiftPhotoCompareImageBrushMode = '';
        document.querySelectorAll('.shift-photo-compare-image-tool').forEach(button => button.classList.remove('active'));
        document.getElementById('shift-photo-compare-overlay')?.classList.toggle('image-brushing', false);
        this.updateShiftPhotoCompareModeHint();
        if (!silent) this.showShiftPhotoCompareActionMessage('画像ブラシを解除しました。');
        return true;
    }

    async startShiftPhotoCompareImageBrush(event, mark, wrap) {
        if (!mark || mark.dataset.mode !== 'image' || !this._shiftPhotoCompareImageBrushMode) return false;
        if (this.isShiftPhotoCompareMarkLocked(mark)) {
            this.selectShiftPhotoCompareMark(mark);
            this.showShiftPhotoCompareActionMessage('ロック中の画像です。ロック解除するとブラシ編集できます。');
            return true;
        }
        const src = mark.dataset.imageSrc || mark.querySelector('img')?.src || '';
        const originalSrc = mark.dataset.originalImageSrc || src;
        if (!/^data:image\//i.test(src)) return false;
        event.preventDefault();
        event.stopPropagation();
        this.pushShiftPhotoCompareUndo();
        if (!mark.dataset.originalImageSrc) mark.dataset.originalImageSrc = originalSrc;
        try {
            const work = await this.drawImageToWorkCanvas(src);
            const original = await this.drawImageToWorkCanvas(originalSrc);
            const brushSizePx = this.getShiftPhotoCompareImageBrushSize();
            const drawPoint = (pointerEvent) => {
                const rect = mark.getBoundingClientRect();
                if (!rect?.width || !rect?.height) return;
                const px = ((pointerEvent.clientX - rect.left) / rect.width) * work.canvas.width;
                const py = ((pointerEvent.clientY - rect.top) / rect.height) * work.canvas.height;
                const brushSize = Math.max(2, Math.min(Math.max(work.canvas.width, work.canvas.height), brushSizePx * ((work.canvas.width / rect.width + work.canvas.height / rect.height) / 2)));
                work.ctx.save();
                work.ctx.beginPath();
                work.ctx.arc(px, py, brushSize, 0, Math.PI * 2);
                work.ctx.clip();
                if (this._shiftPhotoCompareImageBrushMode === 'restore') {
                    work.ctx.drawImage(original.canvas, 0, 0, work.canvas.width, work.canvas.height);
                } else {
                    work.ctx.clearRect(px - brushSize, py - brushSize, brushSize * 2, brushSize * 2);
                }
                work.ctx.restore();
                this.setShiftPhotoImageMarkSource(mark, work.canvas.toDataURL('image/png'));
            };
            drawPoint(event);
            const move = (moveEvent) => {
                moveEvent.preventDefault();
                drawPoint(moveEvent);
            };
            const stop = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', stop);
                window.removeEventListener('pointercancel', stop);
                this.syncShiftPhotoImageMark(mark, this._shiftPhotoCompareImageBrushMode === 'restore' ? '画像を復元しました。' : '画像を消しました。');
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', stop, { once: true });
            window.addEventListener('pointercancel', stop, { once: true });
            return true;
        } catch (error) {
            console.error(error);
            this.showShiftPhotoCompareActionMessage('画像ブラシを開始できませんでした。');
            return true;
        }
    }

    async renderShiftPhotoImageMarkAsAsset(mark) {
        const src = mark?.dataset?.imageSrc || mark?.querySelector?.('img')?.src || '';
        if (!/^data:image\//i.test(src)) return '';
        const img = await this.loadShiftPhotoCompareImage(src);
        const w = img.naturalWidth || img.width || 1;
        const h = img.naturalHeight || img.height || 1;
        const angle = ((parseFloat(mark.dataset.angle || '') || 0) % 360 + 360) % 360;
        const rightAngle = Math.round(angle / 90) * 90;
        const rotate = Math.abs(angle - rightAngle) < 0.001 ? rightAngle % 360 : 0;
        const canvas = document.createElement('canvas');
        canvas.width = rotate === 90 || rotate === 270 ? h : w;
        canvas.height = rotate === 90 || rotate === 270 ? w : h;
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rotate * Math.PI / 180);
        const flipX = mark.dataset.flipX === '-1' ? -1 : 1;
        const flipY = mark.dataset.flipY === '-1' ? -1 : 1;
        ctx.scale(flipX, flipY);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        return canvas.toDataURL('image/png');
    }

    saveSelectedShiftPhotoImageToManager() {
        const mark = this.getSelectedShiftPhotoImageMark();
        const src = mark?.dataset?.imageSrc || mark?.querySelector?.('img')?.src || '';
        if (!mark || !/^data:image\//i.test(src)) return this.showShiftPhotoCompareActionMessage('保存する画像スタンプを選択してください。');
        if (typeof this.addPhotoManagerLibraryImage !== 'function') {
            this.showShiftPhotoCompareActionMessage('写真管理が利用できません。');
            return;
        }
        this.renderShiftPhotoImageMarkAsAsset(mark).then(assetSrc => {
            const item = this.addPhotoManagerLibraryImage(assetSrc || src, '画像スタンプ');
            if (!item) return;
            store.save();
            if (document.getElementById('photo-manager-list')) this.renderPhotoManager?.();
            this.showShiftPhotoCompareActionMessage('選択中の画像を写真管理へ保存しました。');
        }).catch(error => {
            console.error(error);
            this.showShiftPhotoCompareActionMessage('写真管理への保存に失敗しました。');
        });
    }

    restoreSelectedShiftPhotoImageOriginal() {
        const mark = this.getSelectedShiftPhotoImageMark();
        const originalSrc = mark?.dataset?.originalImageSrc || '';
        if (!mark || !/^data:image\//i.test(originalSrc)) {
            this.showShiftPhotoCompareActionMessage('元画像が残っている画像スタンプを選択してください。');
            return;
        }
        this.pushShiftPhotoCompareUndo();
        this.setShiftPhotoImageMarkSource(mark, originalSrc, false);
        this.syncShiftPhotoImageMark(mark, '画像スタンプを元画像に戻しました。');
    }

    closeShiftPhotoCompareImageContextMenu() {
        document.querySelectorAll('.shift-photo-compare-image-context-menu').forEach(menu => menu.remove());
    }

    openShiftPhotoCompareImageContextMenu(event, mark) {
        if (!mark || mark.dataset.mode !== 'image') return;
        this.closeShiftPhotoCompareImageContextMenu();
        if (!mark.classList.contains('selected')) this.selectShiftPhotoCompareMark(mark);
        const panel = document.querySelector('.shift-photo-compare-panel');
        const panelRect = panel?.getBoundingClientRect();
        if (!panelRect?.width) return;
        const menu = document.createElement('div');
        menu.className = 'shift-photo-compare-image-context-menu';
        menu.innerHTML = `
            <button type="button" data-action="save"><i class="fa-solid fa-bookmark"></i><span>写真管理へ保存</span></button>
            <button type="button" data-action="restore"><i class="fa-solid fa-clock-rotate-left"></i><span>元画像に戻す</span></button>
            <button type="button" data-action="cutout"><i class="fa-solid fa-wand-magic-sparkles"></i><span>透過候補チェック</span></button>
            <button type="button" data-action="front"><i class="fa-solid fa-arrow-up"></i><span>前面へ</span></button>
            <button type="button" data-action="back"><i class="fa-solid fa-arrow-down"></i><span>背面へ</span></button>
        `;
        menu.addEventListener('pointerdown', menuEvent => menuEvent.stopPropagation());
        menu.addEventListener('click', menuEvent => {
            const action = menuEvent.target.closest('button')?.dataset?.action || '';
            if (!action) return;
            menuEvent.preventDefault();
            menuEvent.stopPropagation();
            if (action === 'save') this.saveSelectedShiftPhotoImageToManager();
            if (action === 'restore') this.restoreSelectedShiftPhotoImageOriginal();
            if (action === 'cutout') this.removeSelectedShiftPhotoImageBackground();
            if (action === 'front') this.moveSelectedShiftPhotoCompareMarkLayer('front');
            if (action === 'back') this.moveSelectedShiftPhotoCompareMarkLayer('back');
            this.closeShiftPhotoCompareImageContextMenu();
        });
        panel.appendChild(menu);
        const left = Math.max(8, Math.min(panelRect.width - menu.offsetWidth - 8, event.clientX - panelRect.left));
        const top = Math.max(8, Math.min(panelRect.height - menu.offsetHeight - 8, event.clientY - panelRect.top));
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
    }

    updateShiftPhotoCompareSample() {
        const box = document.getElementById('shift-photo-compare-sample-box');
        if (!box) return;
        const selectedMark = this._shiftPhotoCompareMarkMode === 'move' && this._shiftPhotoCompareSelectedMark && document.contains(this._shiftPhotoCompareSelectedMark)
            ? this._shiftPhotoCompareSelectedMark
            : null;
        if (selectedMark) {
            this._shiftPhotoCompareSampleMode = selectedMark.dataset.mode || 'circle';
            this._shiftPhotoCompareSampleText = selectedMark.dataset.text || selectedMark.textContent || '';
        } else if (['circle', 'arrow', 'rect', 'text', 'number', 'xmark', 'freehand', 'image'].includes(this._shiftPhotoCompareMarkMode)) {
            this._shiftPhotoCompareSampleMode = this._shiftPhotoCompareMarkMode;
            this._shiftPhotoCompareSampleText = '';
        }
        const mode = this._shiftPhotoCompareSampleMode || 'circle';
        const size = this._shiftPhotoCompareMarkSize || 56;
        const angle = this._shiftPhotoCompareMarkAngle || 0;
        const stretch = (this._shiftPhotoCompareMarkStretch || 100) / 100;
        const stretchY = (this._shiftPhotoCompareMarkStretchY || 100) / 100;
        const stroke = (this._shiftPhotoCompareMarkStroke || 100) / 100;
        const color = this._shiftPhotoCompareMarkColor || '#dc2626';
        const font = this.getShiftPhotoCompareSafeFont(this._shiftPhotoCompareMarkFont || '');
        const fontFamily = this.getShiftPhotoCompareFontFamily(font);
        const outline = this._shiftPhotoCompareTextOutline !== false;
        const text = mode === 'text'
            ? (((selectedMark ? this._shiftPhotoCompareSampleText : document.getElementById('shift-photo-compare-text-input')?.value) || '文字').slice(0, 24))
            : (mode === 'number' ? ((selectedMark ? this._shiftPhotoCompareSampleText : '') || this.getShiftPhotoCompareNumberText(this._shiftPhotoCompareNumberNext || 1)) : '');
        const sampleContent = mode === 'arrow'
            ? '<span class="shift-photo-arrow-line"></span><span class="shift-photo-arrow-head"></span>'
            : (mode === 'freehand'
                ? '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="12,74 30,42 50,62 70,28 88,48"></polyline></svg>'
                : (mode === 'image'
                    ? (this._shiftPhotoCompareImageStampSrc ? `<img src="${this.escapeHtml(this._shiftPhotoCompareImageStampSrc)}" alt="">` : '<i class="fa-regular fa-image"></i>')
                : (mode === 'xmark'
                    ? '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M18 18 L82 82 M82 18 L18 82"></path></svg>'
                    : (mode === 'text' || mode === 'number' ? this.escapeHtml(text) : ''))));
        box.innerHTML = `<div class="shift-photo-compare-mark ${mode} sample" data-font="${font}" data-outline="${outline ? '1' : '0'}" style="--mark-size:${size}px; --mark-rotate:${angle}deg; --mark-scale-x:${stretch}; --mark-scale-y:${stretchY}; --mark-stroke:${stroke}; --mark-color:${this.escapeHtml(color)}; --mark-font:${fontFamily};">${sampleContent}</div>`;
    }

    getShiftPhotoCompareMarkPosition(event, wrap) {
        const rect = wrap?.getBoundingClientRect();
        if (!rect?.width || !rect?.height) return null;
        return {
            x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
            y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
        };
    }

    getShiftPhotoCompareSnapLayoutItems(wrap, excludeMarks = []) {
        const excluded = new Set(excludeMarks);
        const usedPairIds = new Set();
        const items = [];
        Array.from(wrap?.querySelectorAll?.('.shift-photo-compare-mark') || []).forEach(mark => {
            if (excluded.has(mark) || mark.dataset.mode === 'freehand') return;
            const pairId = this.getShiftPhotoComparePairId(mark);
            if (pairId) {
                if (usedPairIds.has(pairId)) return;
                usedPairIds.add(pairId);
                const paired = this.getShiftPhotoComparePairedMarks(mark, true).filter(item => !excluded.has(item));
                const primary = paired.find(item => item.dataset.mode === 'number' || item.dataset.pairRole === 'number') || paired[0] || mark;
                const x = parseFloat(primary.style.left);
                const y = parseFloat(primary.style.top);
                if (Number.isFinite(x) && Number.isFinite(y)) items.push({ mark: primary, x, y });
                return;
            }
            const x = parseFloat(mark.style.left);
            const y = parseFloat(mark.style.top);
            if (Number.isFinite(x) && Number.isFinite(y)) items.push({ mark, x, y });
        });
        return items;
    }

    getShiftPhotoCompareEqualSpacingYGuides(pos, wrap, excludeMarks = []) {
        if (!pos || !wrap) return [];
        const items = this.getShiftPhotoCompareSnapLayoutItems(wrap, excludeMarks);
        const columnItems = items.filter(item => Math.abs(item.x - pos.x) <= 9);
        const targets = columnItems.length >= 2 ? columnItems : items;
        const ys = [...new Set(targets.map(item => Number(item.y.toFixed(3))))].sort((a, b) => a - b);
        if (ys.length < 2) return [];
        const guides = [];
        for (let i = 0; i < ys.length - 1; i += 1) {
            const gap = ys[i + 1] - ys[i];
            if (gap < 3 || gap > 45) continue;
            const previous = ys[i] - gap;
            const next = ys[i + 1] + gap;
            if (previous >= 0 && previous <= 100) guides.push(previous);
            if (next >= 0 && next <= 100) guides.push(next);
        }
        return [...new Set(guides.map(value => Number(value.toFixed(3))))];
    }

    getShiftPhotoCompareEqualSpacingXGuides(pos, wrap, excludeMarks = []) {
        if (!pos || !wrap) return [];
        const items = this.getShiftPhotoCompareSnapLayoutItems(wrap, excludeMarks);
        const rowItems = items.filter(item => Math.abs(item.y - pos.y) <= 9);
        const targets = rowItems.length >= 2 ? rowItems : items;
        const xs = [...new Set(targets.map(item => Number(item.x.toFixed(3))))].sort((a, b) => a - b);
        if (xs.length < 2) return [];
        const guides = [];
        for (let i = 0; i < xs.length - 1; i += 1) {
            const gap = xs[i + 1] - xs[i];
            if (gap < 3 || gap > 45) continue;
            const previous = xs[i] - gap;
            const next = xs[i + 1] + gap;
            if (previous >= 0 && previous <= 100) guides.push(previous);
            if (next >= 0 && next <= 100) guides.push(next);
        }
        return [...new Set(guides.map(value => Number(value.toFixed(3))))];
    }

    snapShiftPhotoComparePosition(pos, wrap, excludeMarks = []) {
        if (!pos || !wrap) return pos;
        if (!this.isShiftPhotoCompareSnapGuideEnabled()) {
            this.clearShiftPhotoCompareSnapGuides();
            return {
                x: Math.max(0, Math.min(100, pos.x)),
                y: Math.max(0, Math.min(100, pos.y))
            };
        }
        const threshold = this.getShiftPhotoCompareSnapGuideThreshold();
        const xGuides = [0, 50, 100, ...this.getShiftPhotoCompareEqualSpacingXGuides(pos, wrap, excludeMarks)];
        const yGuides = [0, 50, 100, ...this.getShiftPhotoCompareEqualSpacingYGuides(pos, wrap, excludeMarks)];
        this.getShiftPhotoCompareSnapLayoutItems(wrap, excludeMarks).forEach(item => {
            xGuides.push(item.x);
            yGuides.push(item.y);
        });
        const snapAxis = (value, guides) => {
            let best = value;
            let bestDistance = threshold;
            guides.forEach(guide => {
                const distance = Math.abs(value - guide);
                if (distance <= bestDistance) {
                    best = guide;
                    bestDistance = distance;
                }
            });
            return best;
        };
        const snapped = {
            x: Math.max(0, Math.min(100, snapAxis(pos.x, xGuides))),
            y: Math.max(0, Math.min(100, snapAxis(pos.y, yGuides)))
        };
        this.renderShiftPhotoCompareSnapGuides(wrap, Math.abs(snapped.x - pos.x) > 0.001 ? snapped.x : null, Math.abs(snapped.y - pos.y) > 0.001 ? snapped.y : null);
        return snapped;
    }

    renderShiftPhotoCompareSnapGuides(wrap, x = null, y = null) {
        if (!wrap) return;
        clearTimeout(this._shiftPhotoCompareSnapGuideClearTimer);
        this._shiftPhotoCompareSnapGuideClearTimer = null;
        wrap.querySelectorAll('.shift-photo-compare-snap-guide').forEach(line => line.remove());
        if (x === null && y === null) return;
        if (x !== null) {
            const line = document.createElement('div');
            line.className = 'shift-photo-compare-snap-guide vertical';
            line.style.left = `${x}%`;
            wrap.appendChild(line);
        }
        if (y !== null) {
            const line = document.createElement('div');
            line.className = 'shift-photo-compare-snap-guide horizontal';
            line.style.top = `${y}%`;
            wrap.appendChild(line);
        }
    }

    clearShiftPhotoCompareSnapGuides() {
        clearTimeout(this._shiftPhotoCompareSnapGuideClearTimer);
        this._shiftPhotoCompareSnapGuideClearTimer = null;
        document.querySelectorAll('.shift-photo-compare-snap-guide').forEach(line => line.remove());
    }

    clearShiftPhotoCompareSnapGuidesAfterPlacement(delay = 100) {
        clearTimeout(this._shiftPhotoCompareSnapGuideClearTimer);
        this._shiftPhotoCompareSnapGuideClearTimer = setTimeout(() => {
            this._shiftPhotoCompareSnapGuideClearTimer = null;
            this.clearShiftPhotoCompareSnapGuides();
        }, delay);
    }

    positionShiftPhotoCompareMark(mark, event, wrap, options = {}) {
        const pos = this.getShiftPhotoCompareMarkPosition(event, wrap);
        if (!pos || !mark) return;
        const next = options.snap === false ? pos : this.snapShiftPhotoComparePosition(pos, wrap, options.excludeMarks || [mark]);
        mark.style.left = `${next.x}%`;
        mark.style.top = `${next.y}%`;
    }

    getShiftPhotoCompareArrowEndpointPixels(mark, wrap) {
        const rect = wrap?.getBoundingClientRect();
        if (!mark || !rect?.width || !rect?.height) return null;
        const cx = rect.left + ((parseFloat(mark.style.left) || 0) / 100) * rect.width;
        const cy = rect.top + ((parseFloat(mark.style.top) || 0) / 100) * rect.height;
        const size = parseFloat(mark.dataset.size || '') || 56;
        const stretch = parseFloat(mark.dataset.stretch || '') || 1;
        const angle = (parseFloat(mark.dataset.angle || '') || 0) * Math.PI / 180;
        const length = size * Math.max(0.7, 0.86 * stretch);
        const dx = Math.cos(angle) * length / 2;
        const dy = Math.sin(angle) * length / 2;
        return {
            start: { x: cx - dx, y: cy - dy },
            end: { x: cx + dx, y: cy + dy }
        };
    }

    updateShiftPhotoCompareArrowFromEndpoints(mark, wrap, start, end) {
        const rect = wrap?.getBoundingClientRect();
        if (!mark || !rect?.width || !rect?.height || !start || !end) return;
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const length = Math.max(8, Math.hypot(end.x - start.x, end.y - start.y));
        const size = parseFloat(mark.dataset.size || '') || 56;
        const angle = Math.round((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI + 360) % 360);
        const stretch = Math.max(0.5, Math.min(5, length / (size * 0.86)));
        mark.style.left = `${Math.max(0, Math.min(100, ((cx - rect.left) / rect.width) * 100))}%`;
        mark.style.top = `${Math.max(0, Math.min(100, ((cy - rect.top) / rect.height) * 100))}%`;
        mark.dataset.angle = String(angle);
        mark.dataset.stretch = String(stretch);
        mark.style.setProperty('--mark-rotate', `${angle}deg`);
        mark.style.setProperty('--mark-scale-x', String(stretch));
        this.selectShiftPhotoCompareMark(mark);
    }

    getShiftPhotoCompareArrowEndpointHit(event, marks = []) {
        const candidates = (marks || []).filter(mark => mark?.dataset?.mode === 'arrow');
        let best = null;
        let bestDistance = 18;
        candidates.forEach(mark => {
            const wrap = mark.closest('.shift-photo-compare-image-wrap') || mark.closest('.shift-photo-compare-global-layer');
            const endpoints = this.getShiftPhotoCompareArrowEndpointPixels(mark, wrap);
            if (!endpoints) return;
            ['start', 'end'].forEach(end => {
                const point = endpoints[end];
                const distance = Math.hypot((event.clientX || 0) - point.x, (event.clientY || 0) - point.y);
                if (distance <= bestDistance) {
                    bestDistance = distance;
                    best = { mark, wrap, end };
                }
            });
        });
        return best;
    }

    startShiftPhotoCompareArrowEndpointDrag(event, mark, wrap, forcedEnd = '') {
        const handle = event.target?.closest?.('.shift-photo-arrow-end');
        if ((!handle && !forcedEnd) || mark?.dataset?.mode !== 'arrow') return false;
        if (this.isShiftPhotoCompareMarkLocked(mark)) {
            this.selectShiftPhotoCompareMark(mark);
            this.showShiftPhotoCompareActionMessage('ロック中の矢印です。ロック解除すると編集できます。');
            return true;
        }
        const endpoints = this.getShiftPhotoCompareArrowEndpointPixels(mark, wrap);
        if (!endpoints) return false;
        event.preventDefault();
        event.stopPropagation();
        this.pushShiftPhotoCompareUndo();
        this.selectShiftPhotoCompareMark(mark);
        const editingEnd = forcedEnd === 'end' || handle?.dataset?.arrowEnd === 'end' ? 'end' : 'start';
        const fixed = editingEnd === 'end' ? endpoints.start : endpoints.end;
        const move = (moveEvent) => {
            moveEvent.preventDefault();
            const moving = { x: moveEvent.clientX, y: moveEvent.clientY };
            if (editingEnd === 'end') this.updateShiftPhotoCompareArrowFromEndpoints(mark, wrap, fixed, moving);
            else this.updateShiftPhotoCompareArrowFromEndpoints(mark, wrap, moving, fixed);
        };
        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            if (wrap.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(wrap);
            else this.syncShiftPhotoCompareMarks(wrap);
            this.refreshShiftPhotoCompareMarkList();
            this.autoSaveShiftNotebook(true);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
        return true;
    }

    getShiftPhotoCompareFreehandPoint(event, wrap) {
        const rect = wrap?.getBoundingClientRect();
        if (!rect?.width || !rect?.height) return null;
        return {
            x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
            y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
        };
    }

    updateShiftPhotoCompareFreehandMark(mark, points) {
        if (!mark) return;
        mark.dataset.points = JSON.stringify(points);
        const polyline = mark.querySelector('polyline');
        if (polyline) polyline.setAttribute('points', points.map(point => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(' '));
    }

    startShiftPhotoCompareFreehandDrag(event, wrap) {
        const layer = wrap?.classList?.contains('shift-photo-compare-global-layer')
            ? wrap
            : wrap?.querySelector?.('.shift-photo-compare-mark-layer');
        if (!layer) return;
        this.pushShiftPhotoCompareUndo();
        const size = this._shiftPhotoCompareMarkSize || 56;
        const color = this._shiftPhotoCompareMarkColor || '#dc2626';
        const stroke = (this._shiftPhotoCompareMarkStroke || 100) / 100;
        const font = this.getShiftPhotoCompareSafeFont(this._shiftPhotoCompareMarkFont || '');
        const mark = document.createElement('div');
        mark.className = 'shift-photo-compare-mark freehand';
        mark.dataset.mode = 'freehand';
        mark.dataset.size = String(size);
        mark.dataset.angle = '0';
        mark.dataset.stretch = '1';
        mark.dataset.stretchY = '1';
        mark.dataset.stroke = String(stroke);
        mark.dataset.color = color;
        mark.dataset.text = '';
        mark.dataset.font = font;
        mark.dataset.outline = this._shiftPhotoCompareTextOutline === false ? '0' : '1';
        mark.style.setProperty('--mark-size', `${size}px`);
        mark.style.setProperty('--mark-stroke', String(stroke));
        mark.style.setProperty('--mark-color', color);
        mark.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points=""></polyline></svg>';
        layer.appendChild(mark);
        const points = [];
        const addPoint = (pointEvent) => {
            const point = this.getShiftPhotoCompareFreehandPoint(pointEvent, wrap);
            if (!point) return;
            const last = points[points.length - 1];
            if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.45) {
                points.push(point);
                this.updateShiftPhotoCompareFreehandMark(mark, points);
            }
        };
        addPoint(event);
        const move = (moveEvent) => {
            moveEvent.preventDefault();
            addPoint(moveEvent);
        };
        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            if (points.length < 2) {
                mark.remove();
            } else if (wrap.classList.contains('shift-photo-compare-global-layer')) {
                this.syncShiftPhotoCompareGlobalMarks(wrap);
            } else {
                this.syncShiftPhotoCompareMarks(wrap);
            }
            this.refreshShiftPhotoCompareMarkList();
            this.autoSaveShiftNotebook(true);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
    }

    startShiftPhotoCompareExistingMarkMove(event, mark, wrap) {
        if (!mark || !wrap || !wrap.contains(mark)) return false;
        if (this._shiftPhotoCompareMarkMode !== 'move') this.setShiftPhotoCompareMarkMode('move');
        if (event.shiftKey) {
            this.selectShiftPhotoCompareMark(mark, true);
            return true;
        }
        if (this.isShiftPhotoCompareMarkLocked(mark)) {
            this.selectShiftPhotoCompareMark(mark);
            this.showShiftPhotoCompareActionMessage('ロック中の記号です。ロック解除すると動かせます。');
            return true;
        }
        if (this._shiftPhotoCompareImageBrushMode && mark.dataset.mode === 'image') {
            this.startShiftPhotoCompareImageBrush(event, mark, wrap);
            return true;
        }
        if (this.startShiftPhotoCompareArrowEndpointDrag(event, mark, wrap)) return true;
        this.pushShiftPhotoCompareUndo();
        if (!mark.classList.contains('selected')) this.selectShiftPhotoCompareMark(mark);
        else this.syncShiftPhotoCompareSelectionState();
        const isGlobal = wrap.classList.contains('shift-photo-compare-global-layer');
        const startPoint = this.getShiftPhotoCompareFreehandPoint(event, wrap);
        const selectedMarks = this.getShiftPhotoCompareUnlockedMarks(this.getShiftPhotoCompareSelectedMarks()).filter(item => wrap.contains(item));
        const movingMarks = this.getShiftPhotoCompareUnlockedMarks(this.expandShiftPhotoCompareMarksWithPairs(selectedMarks.length ? selectedMarks : [mark])).filter(item => wrap.contains(item));
        if (!movingMarks.length) return true;
        const startStates = movingMarks.map(item => ({
            mark: item,
            x: parseFloat(item.style.left) || 0,
            y: parseFloat(item.style.top) || 0,
            points: item.dataset.mode === 'freehand' ? this.parseShiftPhotoCompareFreehandPoints(item.dataset.points || '[]') : []
        }));
        const pairId = this.getShiftPhotoComparePairId(mark);
        const snapBaseMark = pairId
            ? (movingMarks.find(item => this.getShiftPhotoComparePairId(item) === pairId && (item.dataset.mode === 'number' || item.dataset.pairRole === 'number')) || mark)
            : mark;
        const move = (moveEvent) => {
            moveEvent.preventDefault();
            const current = this.getShiftPhotoCompareFreehandPoint(moveEvent, wrap);
            if (!current || !startPoint) return;
            let dx = current.x - startPoint.x;
            let dy = current.y - startPoint.y;
            if (mark.dataset.mode !== 'freehand') {
                const primaryStart = startStates.find(item => item.mark === snapBaseMark);
                if (primaryStart) {
                    const snapped = this.snapShiftPhotoComparePosition({ x: primaryStart.x + dx, y: primaryStart.y + dy }, wrap, movingMarks);
                    dx = snapped.x - primaryStart.x;
                    dy = snapped.y - primaryStart.y;
                }
            }
            startStates.forEach(item => {
                if (item.mark.dataset.mode === 'freehand') {
                    this.updateShiftPhotoCompareFreehandMark(item.mark, item.points.map(point => ({
                        x: Math.max(0, Math.min(100, point.x + dx)),
                        y: Math.max(0, Math.min(100, point.y + dy))
                    })));
                } else {
                    item.mark.style.left = `${Math.max(0, Math.min(100, item.x + dx))}%`;
                    item.mark.style.top = `${Math.max(0, Math.min(100, item.y + dy))}%`;
                }
            });
            this.updateShiftPhotoCompareMiniToolbar();
        };
        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            this.clearShiftPhotoCompareSnapGuides();
            if (isGlobal) this.syncShiftPhotoCompareGlobalMarks(wrap);
            else this.syncShiftPhotoCompareMarks(wrap);
            this.refreshShiftPhotoCompareMarkList();
            this.updateShiftPhotoCompareMiniToolbar();
            this.autoSaveShiftNotebook(true);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
        return true;
    }

    getShiftPhotoCompareRangeRect(start, end) {
        if (!start || !end) return null;
        return {
            left: Math.min(start.x, end.x),
            top: Math.min(start.y, end.y),
            right: Math.max(start.x, end.x),
            bottom: Math.max(start.y, end.y)
        };
    }

    isShiftPhotoCompareMarkInRange(mark, range) {
        if (!mark || !range) return false;
        if (mark.dataset.mode === 'freehand') {
            return this.parseShiftPhotoCompareFreehandPoints(mark.dataset.points || '[]')
                .some(point => point.x >= range.left && point.x <= range.right && point.y >= range.top && point.y <= range.bottom);
        }
        const x = parseFloat(mark.style.left);
        const y = parseFloat(mark.style.top);
        return Number.isFinite(x) && Number.isFinite(y) && x >= range.left && x <= range.right && y >= range.top && y <= range.bottom;
    }

    updateShiftPhotoCompareRangeBox(box, range) {
        if (!box || !range) return;
        box.style.left = `${range.left}%`;
        box.style.top = `${range.top}%`;
        box.style.width = `${range.right - range.left}%`;
        box.style.height = `${range.bottom - range.top}%`;
    }

    clearShiftPhotoCompareRangeDeleteTargets() {
        document.querySelectorAll('.shift-photo-compare-mark.range-delete-target')
            .forEach(mark => mark.classList.remove('range-delete-target'));
    }

    updateShiftPhotoCompareRangeDeleteTargets(wrap, range) {
        if (!wrap || !range) return [];
        const marks = Array.from(wrap.querySelectorAll('.shift-photo-compare-mark'));
        const targets = marks.filter(mark => this.isShiftPhotoCompareMarkInRange(mark, range) && !this.isShiftPhotoCompareMarkLocked(mark));
        marks.forEach(mark => mark.classList.toggle('range-delete-target', targets.includes(mark)));
        return targets;
    }

    clearShiftPhotoCompareRangeSelectTargets() {
        document.querySelectorAll('.shift-photo-compare-mark.range-select-target')
            .forEach(mark => mark.classList.remove('range-select-target'));
    }

    updateShiftPhotoCompareRangeSelectTargets(wrap, range) {
        if (!wrap || !range) return [];
        const marks = Array.from(wrap.querySelectorAll('.shift-photo-compare-mark'));
        const targets = marks.filter(mark => this.isShiftPhotoCompareMarkInRange(mark, range));
        marks.forEach(mark => mark.classList.toggle('range-select-target', targets.includes(mark)));
        return targets;
    }

    startShiftPhotoCompareRangeSelect(event, wrap) {
        const start = this.getShiftPhotoCompareFreehandPoint(event, wrap);
        if (!start || !wrap) return;
        const box = document.createElement('div');
        box.className = 'shift-photo-compare-range-box select';
        this.updateShiftPhotoCompareRangeBox(box, { left: start.x, top: start.y, right: start.x, bottom: start.y });
        wrap.appendChild(box);
        const startClient = { x: event.clientX, y: event.clientY };
        let current = start;
        const move = (moveEvent) => {
            moveEvent.preventDefault();
            const next = this.getShiftPhotoCompareFreehandPoint(moveEvent, wrap);
            if (!next) return;
            current = next;
            const range = this.getShiftPhotoCompareRangeRect(start, current);
            this.updateShiftPhotoCompareRangeBox(box, range);
            this.updateShiftPhotoCompareRangeSelectTargets(wrap, range);
        };
        const stop = (stopEvent) => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            box.remove();
            const dx = Math.abs((stopEvent?.clientX ?? startClient.x) - startClient.x);
            const dy = Math.abs((stopEvent?.clientY ?? startClient.y) - startClient.y);
            if (dx < 6 && dy < 6) {
                this.clearShiftPhotoCompareRangeSelectTargets();
                return;
            }
            const range = this.getShiftPhotoCompareRangeRect(start, current);
            const marks = this.updateShiftPhotoCompareRangeSelectTargets(wrap, range);
            this.clearShiftPhotoCompareRangeSelectTargets();
            const additive = !!stopEvent?.shiftKey;
            const subtractive = !!(stopEvent?.ctrlKey || stopEvent?.metaKey);
            if (!additive && !subtractive) this.selectShiftPhotoCompareMark(null);
            if (subtractive) {
                marks.forEach(mark => mark.classList.remove('selected'));
                this.syncShiftPhotoCompareSelectionState();
                this.updateShiftPhotoCompareMiniToolbar();
                this.refreshShiftPhotoCompareMarkList();
            } else {
                marks.forEach(mark => this.selectShiftPhotoCompareMark(mark, true));
            }
            if (marks.length) {
                if (this._shiftPhotoCompareMarkMode !== 'move') this.setShiftPhotoCompareMarkModeDirect('move');
                this.syncShiftPhotoCompareSelectionState();
                this.updateShiftPhotoCompareMiniToolbar();
                this.refreshShiftPhotoCompareMarkList();
                this.showShiftPhotoCompareActionMessage(subtractive ? `${marks.length}件を選択から外しました。` : `${marks.length}件選択しました。`);
            }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
    }

    startShiftPhotoCompareRangeDelete(event, wrap) {
        const start = this.getShiftPhotoCompareFreehandPoint(event, wrap);
        if (!start || !wrap) return;
        const box = document.createElement('div');
        box.className = 'shift-photo-compare-range-box';
        this.updateShiftPhotoCompareRangeBox(box, { left: start.x, top: start.y, right: start.x, bottom: start.y });
        wrap.appendChild(box);
        const startClient = { x: event.clientX, y: event.clientY };
        let current = start;
        const move = (moveEvent) => {
            moveEvent.preventDefault();
            const next = this.getShiftPhotoCompareFreehandPoint(moveEvent, wrap);
            if (!next) return;
            current = next;
            const range = this.getShiftPhotoCompareRangeRect(start, current);
            this.updateShiftPhotoCompareRangeBox(box, range);
            this.updateShiftPhotoCompareRangeDeleteTargets(wrap, range);
        };
        const stop = (stopEvent) => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            box.remove();
            const dx = Math.abs((stopEvent?.clientX ?? startClient.x) - startClient.x);
            const dy = Math.abs((stopEvent?.clientY ?? startClient.y) - startClient.y);
            if (dx < 6 && dy < 6) {
                this.clearShiftPhotoCompareRangeDeleteTargets();
                return;
            }
            const range = this.getShiftPhotoCompareRangeRect(start, current);
            const marks = this.updateShiftPhotoCompareRangeDeleteTargets(wrap, range);
            if (!marks.length) {
                this.clearShiftPhotoCompareRangeDeleteTargets();
                return;
            }
            this.pushShiftPhotoCompareUndo();
            marks.forEach(mark => mark.remove());
            this.clearShiftPhotoCompareRangeDeleteTargets();
            this.syncShiftPhotoCompareSelectionState();
            this.updateShiftPhotoCompareMiniToolbar();
            if (wrap.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(wrap);
            else this.syncShiftPhotoCompareMarks(wrap);
            this.refreshShiftPhotoCompareMarkList();
            this.autoSaveShiftNotebook(true);
            this.flashShiftPhotoCompareUndoButton();
            this.showShiftPhotoCompareActionMessage(`${marks.length}件削除しました。元に戻すこともできます。`);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
    }

    startShiftPhotoCompareRangeMosaic(event, wrap) {
        const start = this.getShiftPhotoCompareFreehandPoint(event, wrap);
        if (!start || !wrap) return;
        const box = document.createElement('div');
        box.className = 'shift-photo-compare-range-box mosaic';
        this.updateShiftPhotoCompareRangeBox(box, { left: start.x, top: start.y, right: start.x, bottom: start.y });
        wrap.appendChild(box);
        const startClient = { x: event.clientX, y: event.clientY };
        let current = start;
        const move = (moveEvent) => {
            moveEvent.preventDefault();
            const next = this.getShiftPhotoCompareFreehandPoint(moveEvent, wrap);
            if (!next) return;
            current = next;
            this.updateShiftPhotoCompareRangeBox(box, this.getShiftPhotoCompareRangeRect(start, current));
        };
        const stop = (stopEvent) => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            box.remove();
            const dx = Math.abs((stopEvent?.clientX ?? startClient.x) - startClient.x);
            const dy = Math.abs((stopEvent?.clientY ?? startClient.y) - startClient.y);
            if (dx < 6 && dy < 6) return;
            const range = this.getShiftPhotoCompareRangeRect(start, current);
            const wrapRect = wrap.getBoundingClientRect();
            const layer = wrap.classList.contains('shift-photo-compare-global-layer')
                ? wrap
                : wrap.querySelector('.shift-photo-compare-mark-layer');
            if (!range || !wrapRect?.width || !wrapRect?.height || !layer) return;
            const widthPx = Math.max(8, (range.right - range.left) / 100 * wrapRect.width);
            const heightPx = Math.max(8, (range.bottom - range.top) / 100 * wrapRect.height);
            const size = Math.max(24, Math.min(1200, Math.max(widthPx, heightPx)));
            this.pushShiftPhotoCompareUndo();
            const mark = document.createElement('div');
            mark.className = 'shift-photo-compare-mark mosaic';
            mark.dataset.mode = 'mosaic';
            mark.dataset.size = String(size);
            mark.dataset.angle = '0';
            mark.dataset.stretch = String(widthPx / size);
            mark.dataset.stretchY = String(heightPx / size);
            mark.dataset.stroke = '1';
            mark.dataset.color = '#111827';
            mark.dataset.text = '';
            mark.dataset.font = this.getShiftPhotoCompareSafeFont(this._shiftPhotoCompareMarkFont || '');
            mark.dataset.outline = '1';
            mark.style.left = `${(range.left + range.right) / 2}%`;
            mark.style.top = `${(range.top + range.bottom) / 2}%`;
            mark.style.setProperty('--mark-size', `${size}px`);
            mark.style.setProperty('--mark-rotate', '0deg');
            mark.style.setProperty('--mark-scale-x', String(widthPx / size));
            mark.style.setProperty('--mark-scale-y', String(heightPx / size));
            mark.style.setProperty('--mark-stroke', '1');
            mark.style.setProperty('--mark-color', '#111827');
            mark.style.setProperty('--mark-font', this.getShiftPhotoCompareFontFamily(mark.dataset.font));
            layer.appendChild(mark);
            if (wrap.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(wrap);
            else this.syncShiftPhotoCompareMarks(wrap);
            if (this._shiftPhotoCompareMarkMode !== 'move') this.setShiftPhotoCompareMarkModeDirect('move');
            this.selectShiftPhotoCompareMark(mark);
            this.refreshShiftPhotoCompareMarkList();
            this.autoSaveShiftNotebook(true);
            this.showShiftPhotoCompareActionMessage('範囲にモザイクを追加しました。');
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
    }

    startShiftPhotoCompareMarkDrag(event, wrap) {
        this.closeShiftPhotoCompareImageContextMenu();
        if (this._shiftPhotoCompareGlobalTarget) return;
        const mode = this._shiftPhotoCompareMarkMode;
        if (!wrap || event.button !== 0) return;
        event.preventDefault();
        const clickedMark = event.target?.closest?.('.shift-photo-compare-mark');
        if (mode === 'erase') {
            const mark = clickedMark;
            if (mark && wrap.contains(mark)) {
                if (this.isShiftPhotoCompareMarkLocked(mark)) {
                    this.selectShiftPhotoCompareMark(mark);
                    this.showShiftPhotoCompareActionMessage('ロック中の記号です。ロック解除すると削除できます。');
                    return;
                }
                this.pushShiftPhotoCompareUndo();
                mark.remove();
                this.syncShiftPhotoCompareMarks(wrap);
                this.refreshShiftPhotoCompareMarkList();
                this.autoSaveShiftNotebook(true);
                this.flashShiftPhotoCompareUndoButton();
                this.showShiftPhotoCompareActionMessage('1件削除しました。元に戻すこともできます。');
            } else {
                this.updateShiftPhotoCompareModeHint('削除モード中: 消したい記号をクリックしてください。');
            }
            return;
        }
        if (mode === 'eraseRange') {
            this.startShiftPhotoCompareRangeDelete(event, wrap);
            return;
        }
        if (mode === 'mosaicRange') {
            this.startShiftPhotoCompareRangeMosaic(event, wrap);
            return;
        }
        if (mode === 'selectRange') {
            this.startShiftPhotoCompareRangeSelect(event, wrap);
            return;
        }
        if (clickedMark && wrap.contains(clickedMark)) {
            this.startShiftPhotoCompareExistingMarkMove(event, clickedMark, wrap);
            return;
        }
        if (!mode) return;
        if (mode === 'move') {
            const mark = clickedMark;
            if (!mark || !wrap.contains(mark)) {
                if (this.getShiftPhotoCompareSelectedMarks().length) {
                    this.selectShiftPhotoCompareMark(null);
                    this.refreshShiftPhotoCompareMarkList();
                    this.showShiftPhotoCompareActionMessage('選択を解除しました。');
                }
                return;
            }
            this.startShiftPhotoCompareExistingMarkMove(event, mark, wrap);
            return;
        }
        if (mode === 'freehand') {
            this.startShiftPhotoCompareFreehandDrag(event, wrap);
            return;
        }
        this.pushShiftPhotoCompareUndo();
        const mark = this.addShiftPhotoCompareMark(event, wrap);
        if (!mark) return;
        const move = (moveEvent) => {
            moveEvent.preventDefault();
            this.positionShiftPhotoCompareMark(mark, moveEvent, wrap);
        };
        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            this.syncShiftPhotoCompareMarks(wrap);
            this.refreshShiftPhotoCompareMarkList();
            this.autoSaveShiftNotebook(true);
            this.clearShiftPhotoCompareSnapGuidesAfterPlacement();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
    }

    startShiftPhotoCompareGlobalMarkDrag(event, layer) {
        this.closeShiftPhotoCompareImageContextMenu();
        if (!this._shiftPhotoCompareGlobalTarget) return;
        const mode = this._shiftPhotoCompareMarkMode;
        if (!layer || event.button !== 0) return;
        event.preventDefault();
        const clickedMark = event.target?.closest?.('.shift-photo-compare-mark');
        if (mode === 'erase') {
            const mark = clickedMark;
            if (mark && layer.contains(mark)) {
                if (this.isShiftPhotoCompareMarkLocked(mark)) {
                    this.selectShiftPhotoCompareMark(mark);
                    this.showShiftPhotoCompareActionMessage('ロック中の記号です。ロック解除すると削除できます。');
                    return;
                }
                this.pushShiftPhotoCompareUndo();
                mark.remove();
                this.syncShiftPhotoCompareGlobalMarks(layer);
                this.refreshShiftPhotoCompareMarkList();
                this.autoSaveShiftNotebook(true);
                this.flashShiftPhotoCompareUndoButton();
                this.showShiftPhotoCompareActionMessage('1件削除しました。元に戻すこともできます。');
            } else {
                this.updateShiftPhotoCompareModeHint('削除モード中: 消したい記号をクリックしてください。');
            }
            return;
        }
        if (mode === 'eraseRange') {
            this.startShiftPhotoCompareRangeDelete(event, layer);
            return;
        }
        if (mode === 'mosaicRange') {
            this.startShiftPhotoCompareRangeMosaic(event, layer);
            return;
        }
        if (mode === 'selectRange') {
            this.startShiftPhotoCompareRangeSelect(event, layer);
            return;
        }
        if (clickedMark && layer.contains(clickedMark)) {
            this.startShiftPhotoCompareExistingMarkMove(event, clickedMark, layer);
            return;
        }
        if (!mode) return;
        if (mode === 'move') {
            const mark = clickedMark;
            if (!mark || !layer.contains(mark)) {
                if (this.getShiftPhotoCompareSelectedMarks().length) {
                    this.selectShiftPhotoCompareMark(null);
                    this.refreshShiftPhotoCompareMarkList();
                    this.showShiftPhotoCompareActionMessage('選択を解除しました。');
                }
                return;
            }
            this.startShiftPhotoCompareExistingMarkMove(event, mark, layer);
            return;
        }
        if (mode === 'freehand') {
            this.startShiftPhotoCompareFreehandDrag(event, layer);
            return;
        }
        this.pushShiftPhotoCompareUndo();
        const mark = this.addShiftPhotoCompareMark(event, layer);
        if (!mark) return;
        const move = (moveEvent) => {
            moveEvent.preventDefault();
            this.positionShiftPhotoCompareMark(mark, moveEvent, layer);
        };
        const stop = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            this.syncShiftPhotoCompareGlobalMarks(layer);
            this.refreshShiftPhotoCompareMarkList();
            this.autoSaveShiftNotebook(true);
            this.clearShiftPhotoCompareSnapGuidesAfterPlacement();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
    }

    addShiftPhotoCompareMark(event, wrap) {
        const mode = this._shiftPhotoCompareMarkMode;
        if (!mode || mode === 'freehand' || !wrap) return;
        const layer = wrap.classList.contains('shift-photo-compare-global-layer')
            ? wrap
            : wrap.querySelector('.shift-photo-compare-mark-layer');
        if (!layer) return;
        const size = this._shiftPhotoCompareMarkSize || 56;
        const angle = this._shiftPhotoCompareMarkAngle || 0;
        const stretch = (this._shiftPhotoCompareMarkStretch || 100) / 100;
        const stretchY = (this._shiftPhotoCompareMarkStretchY || 100) / 100;
        const stroke = (this._shiftPhotoCompareMarkStroke || 100) / 100;
        const color = this._shiftPhotoCompareMarkColor || '#dc2626';
        const font = this.getShiftPhotoCompareSafeFont(this._shiftPhotoCompareMarkFont || '');
        const text = mode === 'text'
            ? (document.getElementById('shift-photo-compare-text-input')?.value || '').trim().slice(0, 120)
            : (mode === 'number' ? this.getShiftPhotoCompareNumberText(this._shiftPhotoCompareNumberNext || 1) : '');
        if (mode === 'text' && !text) {
            document.getElementById('shift-photo-compare-text-input')?.focus();
            return null;
        }
        if (mode === 'image' && !this._shiftPhotoCompareImageStampSrc) {
            document.getElementById('shift-photo-compare-image-stamp-input')?.click();
            return null;
        }
        const mark = document.createElement('div');
        mark.className = `shift-photo-compare-mark ${mode}`;
        mark.dataset.mode = mode;
        mark.dataset.size = String(size);
        mark.dataset.angle = String(angle);
        mark.dataset.stretch = String(stretch);
        mark.dataset.stretchY = String(stretchY);
        mark.dataset.stroke = String(stroke);
        mark.dataset.color = color;
        mark.dataset.text = text;
        mark.dataset.imageSrc = mode === 'image' ? this._shiftPhotoCompareImageStampSrc : '';
        mark.dataset.originalImageSrc = mode === 'image' ? this._shiftPhotoCompareImageStampSrc : '';
        mark.dataset.opacity = '1';
        mark.dataset.flipX = '1';
        mark.dataset.flipY = '1';
        mark.dataset.font = font;
        mark.dataset.outline = this._shiftPhotoCompareTextOutline === false ? '0' : '1';
        mark.style.setProperty('--mark-size', `${size}px`);
        mark.style.setProperty('--mark-rotate', `${angle}deg`);
        mark.style.setProperty('--mark-scale-x', String(stretch));
        mark.style.setProperty('--mark-scale-y', String(stretchY));
        mark.style.setProperty('--mark-stroke', String(stroke));
        mark.style.setProperty('--mark-color', color);
        mark.style.setProperty('--mark-font', this.getShiftPhotoCompareFontFamily(font));
        mark.style.setProperty('--mark-opacity', '1');
        mark.innerHTML = mode === 'arrow'
            ? '<span class="shift-photo-arrow-line"></span><span class="shift-photo-arrow-head"></span><span class="shift-photo-arrow-end start" data-arrow-end="start"></span><span class="shift-photo-arrow-end end" data-arrow-end="end"></span>'
            : (mode === 'xmark'
                ? '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M18 18 L82 82 M82 18 L18 82"></path></svg>'
                : (mode === 'image'
                    ? `<img src="${this.escapeHtml(this._shiftPhotoCompareImageStampSrc)}" alt="">`
                    : (mode === 'text' || mode === 'number' ? this.escapeHtml(text) : '')));
        this.positionShiftPhotoCompareMark(mark, event, wrap);
        layer.appendChild(mark);
        if (wrap.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(wrap);
        else this.syncShiftPhotoCompareMarks(wrap);
        this.refreshShiftPhotoCompareMarkList();
        if (mode === 'number') {
            this._shiftPhotoCompareNumberNext = (this._shiftPhotoCompareNumberNext || 1) + 1;
            this.updateShiftPhotoCompareSample();
        }
        return mark;
    }

    addTextNextToSelectedShiftPhotoNumber() {
        const numberMark = this._shiftPhotoCompareSelectedMark?.dataset?.mode === 'number'
            ? this._shiftPhotoCompareSelectedMark
            : this.getShiftPhotoCompareSelectedMarks().find(mark => mark.dataset.mode === 'number');
        if (!numberMark || !document.contains(numberMark)) return;
        const wrap = numberMark.closest('.shift-photo-compare-image-wrap') || numberMark.closest('.shift-photo-compare-global-layer');
        const layer = numberMark.closest('.shift-photo-compare-mark-layer, .shift-photo-compare-global-layer');
        if (!wrap || !layer) return;
        const wrapRect = wrap.getBoundingClientRect();
        const size = parseFloat(numberMark.dataset.size || '') || 56;
        const stretch = parseFloat(numberMark.dataset.stretch || '') || 1;
        const x = parseFloat(numberMark.style.left) || 0;
        const y = parseFloat(numberMark.style.top) || 0;
        const offset = wrapRect?.width ? ((size * Math.max(1, stretch) * 0.44 + 4) / wrapRect.width) * 100 : 3;
        const text = (document.getElementById('shift-photo-compare-text-input')?.value || '文字').trim().slice(0, 120) || '文字';
        this.pushShiftPhotoCompareUndo();
        const mark = document.createElement('div');
        const font = this.getShiftPhotoCompareSafeFont(numberMark.dataset.font || '');
        const color = /^#[0-9a-f]{6}$/i.test(numberMark.dataset.color || '') ? numberMark.dataset.color : '#dc2626';
        const outline = numberMark.dataset.outline !== '0';
        const stroke = parseFloat(numberMark.dataset.stroke || '') || 1;
        const textSize = Math.max(24, Math.min(700, Math.round(size)));
        const pairId = `nt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        numberMark.dataset.pairId = pairId;
        numberMark.dataset.pairRole = 'number';
        mark.className = 'shift-photo-compare-mark text';
        mark.dataset.mode = 'text';
        mark.dataset.size = String(textSize);
        mark.dataset.angle = '0';
        mark.dataset.stretch = '1';
        mark.dataset.stretchY = '1';
        mark.dataset.stroke = String(stroke);
        mark.dataset.color = color;
        mark.dataset.text = text;
        mark.dataset.font = font;
        mark.dataset.anchor = 'left';
        mark.dataset.pairId = pairId;
        mark.dataset.pairRole = 'text';
        mark.dataset.outline = outline ? '1' : '0';
        mark.style.left = `${Math.max(0, Math.min(100, x + offset))}%`;
        mark.style.top = `${Math.max(0, Math.min(100, y))}%`;
        mark.style.setProperty('--mark-size', `${textSize}px`);
        mark.style.setProperty('--mark-rotate', '0deg');
        mark.style.setProperty('--mark-scale-x', '1');
        mark.style.setProperty('--mark-scale-y', '1');
        mark.style.setProperty('--mark-stroke', String(stroke));
        mark.style.setProperty('--mark-color', color);
        mark.style.setProperty('--mark-font', this.getShiftPhotoCompareFontFamily(font));
        mark.innerHTML = this.escapeHtml(text);
        layer.appendChild(mark);
        if (wrap.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(wrap);
        else this.syncShiftPhotoCompareMarks(wrap);
        if (this._shiftPhotoCompareMarkMode !== 'move') this.setShiftPhotoCompareMarkModeDirect('move');
        this.selectShiftPhotoCompareMark(mark);
        const textInput = document.getElementById('shift-photo-compare-text-input');
        if (textInput) {
            textInput.value = text;
            textInput.focus();
            textInput.select();
        }
        this.refreshShiftPhotoCompareMarkList();
        this.updateShiftPhotoCompareMiniToolbar();
        this.autoSaveShiftNotebook(true);
        this.showShiftPhotoCompareActionMessage('番号の右に文字を追加しました。入力欄で編集できます。');
    }

    adjustSelectedShiftPhotoNumberTextGap(deltaPx = 0) {
        const pairs = this.getShiftPhotoCompareNumberTextPairs();
        if (!pairs.length) return;
        this.pushShiftPhotoCompareUndo();
        const syncTargets = new Set();
        pairs.forEach(pair => {
            const rect = pair.wrap.getBoundingClientRect();
            if (!rect?.width) return;
            const delta = ((Number(deltaPx) || 0) / rect.width) * 100;
            const current = parseFloat(pair.text.style.left) || 0;
            pair.text.style.left = `${Math.max(0, Math.min(100, current + delta))}%`;
            syncTargets.add(pair.wrap);
        });
        syncTargets.forEach(target => {
            if (target.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(target);
            else this.syncShiftPhotoCompareMarks(target);
        });
        this.refreshShiftPhotoCompareMarkList();
        this.updateShiftPhotoCompareMiniToolbar();
        this.autoSaveShiftNotebook(true);
        const countText = pairs.length > 1 ? `${pairs.length}組の` : '';
        this.showShiftPhotoCompareActionMessage(deltaPx < 0 ? `${countText}文字を番号に近づけました。` : `${countText}文字を番号から離しました。`);
    }

    copySelectedShiftPhotoCompareMark() {
        const sources = this.getShiftPhotoCompareSelectedMarks().filter(mark => document.contains(mark));
        const source = sources[0];
        if (!source) return;
        this.pushShiftPhotoCompareUndo();
        const copies = [];
        const copyPairIds = new Map();
        const copyGroupIds = new Map();
        sources.forEach(item => {
            const layer = item.closest('.shift-photo-compare-mark-layer, .shift-photo-compare-global-layer');
            const wrap = item.closest('.shift-photo-compare-image-wrap') || item.closest('.shift-photo-compare-global-layer');
            if (!layer || !wrap) return;
            const copy = item.cloneNode(true);
            copy.classList.remove('selected');
            copy.classList.remove('locked');
            copy.dataset.locked = '0';
            const pairId = this.getShiftPhotoComparePairId(copy);
            if (pairId) {
                if (!copyPairIds.has(pairId)) copyPairIds.set(pairId, `nt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
                copy.dataset.pairId = copyPairIds.get(pairId);
            }
            const groupId = this.getShiftPhotoCompareGroupId(copy);
            if (groupId) {
                if (!copyGroupIds.has(groupId)) copyGroupIds.set(groupId, `grp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
                copy.dataset.groupId = copyGroupIds.get(groupId);
                copy.classList.add('grouped');
            }
            if (!copy.classList.contains('freehand')) {
                const left = Math.max(0, Math.min(100, (parseFloat(copy.style.left) || 0) + 4));
                const top = Math.max(0, Math.min(100, (parseFloat(copy.style.top) || 0) + 4));
                copy.style.left = `${left}%`;
                copy.style.top = `${top}%`;
            } else {
                const points = this.parseShiftPhotoCompareFreehandPoints(copy.dataset.points || '[]')
                    .map(point => ({ x: Math.max(0, Math.min(100, point.x + 2)), y: Math.max(0, Math.min(100, point.y + 2)) }));
                this.updateShiftPhotoCompareFreehandMark(copy, points);
            }
            layer.appendChild(copy);
            copies.push(copy);
            if (wrap.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(wrap);
            else this.syncShiftPhotoCompareMarks(wrap);
        });
        this.selectShiftPhotoCompareMark(null);
        copies.forEach(copy => this.selectShiftPhotoCompareMark(copy, true));
        this.refreshShiftPhotoCompareMarkList();
        this.autoSaveShiftNotebook(true);
        this.updateShiftPhotoCompareMiniToolbar();
    }

    getShiftPhotoCompareSelectedMarksInSameLayer() {
        const selected = this.getShiftPhotoCompareSelectedMarks();
        if (selected.length < 2) return [];
        const layer = selected[0].closest('.shift-photo-compare-mark-layer, .shift-photo-compare-global-layer');
        return selected.filter(mark => mark.closest('.shift-photo-compare-mark-layer, .shift-photo-compare-global-layer') === layer);
    }

    getShiftPhotoCompareLayoutItemsInSameLayer() {
        const selected = this.expandShiftPhotoCompareMarksWithPairs(this.getShiftPhotoCompareSelectedMarksInSameLayer())
            .filter(mark => mark.dataset.mode !== 'freehand' && !this.isShiftPhotoCompareMarkLocked(mark));
        const used = new Set();
        const items = [];
        selected.forEach(mark => {
            if (used.has(mark)) return;
            const pairId = this.getShiftPhotoComparePairId(mark);
            const paired = pairId
                ? selected.filter(item => this.getShiftPhotoComparePairId(item) === pairId)
                : [mark];
            paired.forEach(item => used.add(item));
            const primary = paired.find(item => item.dataset.mode === 'number' || item.dataset.pairRole === 'number') || paired[0];
            items.push({
                marks: paired,
                primary,
                left: parseFloat(primary.style.left) || 0,
                top: parseFloat(primary.style.top) || 0
            });
        });
        return items;
    }

    getShiftPhotoCompareLayoutPreviewPlans(items = [], prop = 'left', values = []) {
        const plans = [];
        items.forEach((item, index) => {
            const current = prop === 'top' ? item.top : item.left;
            const next = values[index];
            const delta = (Number(next) || 0) - current;
            item.marks.forEach(mark => {
                plans.push({
                    mark,
                    left: prop === 'left' ? Math.max(0, Math.min(100, (parseFloat(mark.style.left) || 0) + delta)) : parseFloat(mark.style.left) || 0,
                    top: prop === 'top' ? Math.max(0, Math.min(100, (parseFloat(mark.style.top) || 0) + delta)) : parseFloat(mark.style.top) || 0
                });
            });
        });
        return plans;
    }

    applyShiftPhotoCompareLayoutItems(items = [], prop = 'left', values = []) {
        items.forEach((item, index) => {
            const current = prop === 'top' ? item.top : item.left;
            const next = values[index];
            const delta = (Number(next) || 0) - current;
            item.marks.forEach(mark => {
                const oldValue = parseFloat(mark.style[prop]) || 0;
                mark.style[prop] = `${Math.max(0, Math.min(100, oldValue + delta))}%`;
            });
        });
    }

    syncShiftPhotoCompareWrapForMark(mark) {
        const wrap = mark?.closest('.shift-photo-compare-image-wrap');
        const layer = mark?.closest('.shift-photo-compare-global-layer');
        if (wrap) this.syncShiftPhotoCompareMarks(wrap);
        if (layer) this.syncShiftPhotoCompareGlobalMarks(layer);
    }

    getShiftPhotoCompareAlignPreviewPlans(axis = 'left') {
        const items = this.getShiftPhotoCompareLayoutItemsInSameLayer();
        if (items.length < 2) return [];
        const isY = axis === 'top' || axis === 'bottom' || axis === 'centerY';
        const prop = isY ? 'top' : 'left';
        const values = items.map(item => item[prop]);
        const value = axis === 'right' || axis === 'bottom'
            ? Math.max(...values)
            : (axis === 'centerX' || axis === 'centerY'
                ? values.reduce((sum, item) => sum + item, 0) / values.length
                : Math.min(...values));
        return this.getShiftPhotoCompareLayoutPreviewPlans(items, prop, items.map(() => value));
    }

    getShiftPhotoCompareDistributePreviewPlans(axis = 'x') {
        const items = this.getShiftPhotoCompareLayoutItemsInSameLayer();
        if (items.length < 3) return [];
        const prop = axis === 'y' ? 'top' : 'left';
        const sorted = items.slice().sort((a, b) => a[prop] - b[prop]);
        const first = sorted[0][prop];
        const last = sorted[sorted.length - 1][prop];
        const step = (last - first) / (sorted.length - 1);
        return this.getShiftPhotoCompareLayoutPreviewPlans(sorted, prop, sorted.map((item, index) => Math.max(0, Math.min(100, first + step * index))));
    }

    renderShiftPhotoCompareAlignPreview(plans = []) {
        this.clearShiftPhotoCompareAlignPreview();
        const panel = document.querySelector('.shift-photo-compare-panel');
        const panelRect = panel?.getBoundingClientRect();
        if (!panelRect?.width || !plans.length) return;
        plans.forEach(plan => {
            const wrap = plan.mark.closest('.shift-photo-compare-image-wrap') || plan.mark.closest('.shift-photo-compare-global-layer');
            const wrapRect = wrap?.getBoundingClientRect();
            const markRect = plan.mark.getBoundingClientRect();
            if (!wrapRect?.width || !markRect?.width) return;
            const box = document.createElement('div');
            box.className = 'shift-photo-compare-align-preview-box';
            const centerX = wrapRect.left - panelRect.left + (plan.left / 100) * wrapRect.width;
            const centerY = wrapRect.top - panelRect.top + (plan.top / 100) * wrapRect.height;
            box.style.left = `${centerX - markRect.width / 2}px`;
            box.style.top = `${centerY - markRect.height / 2}px`;
            box.style.width = `${markRect.width}px`;
            box.style.height = `${markRect.height}px`;
            panel.appendChild(box);
        });
    }

    previewAlignSelectedShiftPhotoCompareMarks(axis = 'left') {
        this.renderShiftPhotoCompareAlignPreview(this.getShiftPhotoCompareAlignPreviewPlans(axis));
    }

    previewDistributeSelectedShiftPhotoCompareMarks(axis = 'x') {
        this.renderShiftPhotoCompareAlignPreview(this.getShiftPhotoCompareDistributePreviewPlans(axis));
    }

    clearShiftPhotoCompareAlignPreview() {
        document.querySelectorAll('.shift-photo-compare-align-preview-box').forEach(box => box.remove());
    }

    alignSelectedShiftPhotoCompareMarks(axis = 'left') {
        this.clearShiftPhotoCompareAlignPreview();
        const items = this.getShiftPhotoCompareLayoutItemsInSameLayer();
        if (items.length < 2) return;
        this.pushShiftPhotoCompareUndo();
        const isY = axis === 'top' || axis === 'bottom' || axis === 'centerY';
        const prop = isY ? 'top' : 'left';
        const values = items.map(item => item[prop]);
        const value = axis === 'right' || axis === 'bottom'
            ? Math.max(...values)
            : (axis === 'centerX' || axis === 'centerY'
                ? values.reduce((sum, item) => sum + item, 0) / values.length
                : Math.min(...values));
        this.applyShiftPhotoCompareLayoutItems(items, prop, items.map(() => value));
        this.syncShiftPhotoCompareWrapForMark(items[0].primary);
        this.refreshShiftPhotoCompareMarkList();
        this.updateShiftPhotoCompareMiniToolbar();
        this.autoSaveShiftNotebook(true);
        const labels = { left: '左揃え', right: '右揃え', top: '上揃え', bottom: '下揃え', centerX: '横中央揃え', centerY: '縦中央揃え' };
        this.showShiftPhotoCompareActionMessage(`${labels[axis] || '整列'}しました。`);
    }

    distributeSelectedShiftPhotoCompareMarks(axis = 'x') {
        this.clearShiftPhotoCompareAlignPreview();
        const items = this.getShiftPhotoCompareLayoutItemsInSameLayer();
        if (items.length < 3) return;
        this.pushShiftPhotoCompareUndo();
        const prop = axis === 'y' ? 'top' : 'left';
        const sorted = items.sort((a, b) => a[prop] - b[prop]);
        const first = sorted[0][prop];
        const last = sorted[sorted.length - 1][prop];
        const step = (last - first) / (sorted.length - 1);
        this.applyShiftPhotoCompareLayoutItems(sorted, prop, sorted.map((item, index) => Math.max(0, Math.min(100, first + step * index))));
        this.syncShiftPhotoCompareWrapForMark(sorted[0].primary);
        this.refreshShiftPhotoCompareMarkList();
        this.updateShiftPhotoCompareMiniToolbar();
        this.autoSaveShiftNotebook(true);
        this.showShiftPhotoCompareActionMessage(axis === 'y' ? '縦に等間隔配置しました。' : '横に等間隔配置しました。');
    }

    moveSelectedShiftPhotoCompareMarkLayer(direction = 'front') {
        const marks = this.getShiftPhotoCompareSelectedMarksInSameLayer();
        const mark = marks[0] || this._shiftPhotoCompareSelectedMark;
        if (!mark || !document.contains(mark)) return;
        const layer = mark.closest('.shift-photo-compare-mark-layer, .shift-photo-compare-global-layer');
        const wrap = mark.closest('.shift-photo-compare-image-wrap') || mark.closest('.shift-photo-compare-global-layer');
        if (!layer || !wrap) return;
        const siblings = Array.from(layer.querySelectorAll('.shift-photo-compare-mark'));
        if (siblings.length < 2) return;
        this.pushShiftPhotoCompareUndo();
        const targets = marks.length ? marks : [mark];
        if (direction === 'back') {
            targets.slice().reverse().forEach(item => layer.insertBefore(item, layer.firstElementChild));
        } else {
            targets.forEach(item => layer.appendChild(item));
        }
        this.selectShiftPhotoCompareMark(null);
        targets.forEach(item => this.selectShiftPhotoCompareMark(item, true));
        if (wrap.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(wrap);
        else this.syncShiftPhotoCompareMarks(wrap);
        this.refreshShiftPhotoCompareMarkList();
        this.autoSaveShiftNotebook(true);
        this.showShiftPhotoCompareActionMessage(direction === 'back' ? '背面へ移動しました。' : '前面へ移動しました。');
    }

    deleteSelectedShiftPhotoCompareMark() {
        const selectedCount = this.expandShiftPhotoCompareMarksWithPairs(this.getShiftPhotoCompareSelectedMarks()).filter(mark => document.contains(mark)).length;
        const marks = this.getShiftPhotoCompareUnlockedMarks(this.expandShiftPhotoCompareMarksWithPairs(this.getShiftPhotoCompareSelectedMarks()));
        if (!marks.length) {
            if (selectedCount) this.showShiftPhotoCompareActionMessage('選択中の記号はロックされています。');
            return;
        }
        const syncTargets = new Set();
        this.pushShiftPhotoCompareUndo();
        marks.forEach(mark => {
            const target = mark.closest('.shift-photo-compare-image-wrap') || mark.closest('.shift-photo-compare-global-layer');
            if (target) syncTargets.add(target);
            mark.remove();
        });
        this.selectShiftPhotoCompareMark(null);
        syncTargets.forEach(target => {
            if (target.classList.contains('shift-photo-compare-global-layer')) this.syncShiftPhotoCompareGlobalMarks(target);
            else this.syncShiftPhotoCompareMarks(target);
        });
        this.refreshShiftPhotoCompareMarkList();
        this.autoSaveShiftNotebook(true);
        this.flashShiftPhotoCompareUndoButton();
        const lockedCount = Math.max(0, selectedCount - marks.length);
        this.showShiftPhotoCompareActionMessage(`${marks.length}件削除しました。${lockedCount ? `ロック中の${lockedCount}件は残しました。` : '元に戻すこともできます。'}`);
    }

    clearShiftPhotoCompareMarks() {
        const allMarks = Array.from(document.querySelectorAll('.shift-photo-compare-image-wrap .shift-photo-compare-mark, .shift-photo-compare-global-layer .shift-photo-compare-mark'));
        const targets = this.getShiftPhotoCompareUnlockedMarks(allMarks);
        const count = targets.length;
        if (!count) {
            if (allMarks.length) this.showShiftPhotoCompareActionMessage('ロック中の記号だけなので削除しませんでした。');
            return;
        }
        this.pushShiftPhotoCompareUndo();
        document.querySelectorAll('.shift-photo-compare-image-wrap').forEach(wrap => {
            wrap.querySelectorAll('.shift-photo-compare-mark').forEach(mark => {
                if (!this.isShiftPhotoCompareMarkLocked(mark)) mark.remove();
            });
            this.syncShiftPhotoCompareMarks(wrap);
        });
        const layer = document.querySelector('.shift-photo-compare-global-layer');
        if (layer) {
            layer.querySelectorAll('.shift-photo-compare-mark').forEach(mark => {
                if (!this.isShiftPhotoCompareMarkLocked(mark)) mark.remove();
            });
            this.syncShiftPhotoCompareGlobalMarks(layer);
        }
        this.selectShiftPhotoCompareMark(null);
        this.refreshShiftPhotoCompareMarkList();
        this.autoSaveShiftNotebook(true);
        this.flashShiftPhotoCompareUndoButton();
        const lockedCount = allMarks.length - targets.length;
        this.showShiftPhotoCompareActionMessage(`${count}件削除しました。${lockedCount ? `ロック中の${lockedCount}件は残しました。` : '元に戻すこともできます。'}`);
    }

    getShiftPhotoCompareMarkLabel(mark, index) {
        const labels = {
            circle: '丸',
            arrow: '矢印',
            rect: '四角',
            xmark: 'バツ',
            freehand: '線',
            mosaic: 'モザイク',
            image: '画像',
            text: '文字',
            number: '番号'
        };
        const mode = mark?.dataset?.mode || 'circle';
        const text = (mark?.dataset?.text || mark?.textContent || '').trim().replace(/\s+/g, ' ');
        return `${index + 1}. ${labels[mode] || '記号'}${text ? ` ${text.slice(0, 12)}` : ''}`;
    }

    refreshShiftPhotoCompareMarkList() {
        const list = document.getElementById('shift-photo-compare-mark-list');
        if (!list) return;
        const items = [];
        document.querySelectorAll('.shift-photo-compare-image-wrap').forEach((wrap, photoIndex) => {
            wrap.querySelectorAll('.shift-photo-compare-mark').forEach(mark => {
                items.push({ mark, scope: `写真${photoIndex + 1}` });
            });
        });
        document.querySelectorAll('.shift-photo-compare-global-layer .shift-photo-compare-mark').forEach(mark => {
            items.push({ mark, scope: '全体' });
        });
        if (!items.length) {
            list.innerHTML = '<span class="shift-photo-compare-mark-list-empty">記号なし</span>';
            return;
        }
        list.innerHTML = items.map((item, index) => {
            item.mark.dataset.markListIndex = String(index);
            const selected = item.mark.classList.contains('selected') ? ' selected' : '';
            const locked = this.isShiftPhotoCompareMarkLocked(item.mark) ? ' locked' : '';
            const color = /^#[0-9a-f]{6}$/i.test(item.mark.dataset.color || '') ? item.mark.dataset.color : '#dc2626';
            return `<button type="button" class="shift-photo-compare-mark-list-item${selected}${locked}" data-mark-list-index="${index}" onclick="app.selectShiftPhotoCompareMarkFromList(${index})"><i style="--item-color:${color}"></i><span>${this.escapeHtml(item.scope)}</span><b>${this.escapeHtml(this.getShiftPhotoCompareMarkLabel(item.mark, index))}</b></button>`;
        }).join('');
    }

    selectShiftPhotoCompareMarkFromList(index) {
        const mark = Array.from(document.querySelectorAll('.shift-photo-compare-mark')).find(item => item.dataset.markListIndex === String(index));
        if (!mark) return;
        if (this._shiftPhotoCompareMarkMode !== 'move') this.setShiftPhotoCompareMarkMode('move');
        this.selectShiftPhotoCompareMark(mark, false);
        mark.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }

    async loadShiftPhotoCompareImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    getShiftPhotoCompareRenderedImageRect(img, boxW, boxH) {
        const naturalW = img.naturalWidth || img.width || 1;
        const naturalH = img.naturalHeight || img.height || 1;
        const scale = Math.min(boxW / naturalW, boxH / naturalH);
        const width = naturalW * scale;
        const height = naturalH * scale;
        return {
            x: (boxW - width) / 2,
            y: (boxH - height) / 2,
            width,
            height
        };
    }

    applyShiftPhotoCompareMosaicToCanvas(ctx, x, y, width, height, blockSize = 14) {
        const left = Math.max(0, Math.round(x));
        const top = Math.max(0, Math.round(y));
        const w = Math.max(1, Math.round(Math.min(width, ctx.canvas.width - left)));
        const h = Math.max(1, Math.round(Math.min(height, ctx.canvas.height - top)));
        const block = Math.max(4, Math.round(blockSize));
        if (!w || !h) return;
        const image = ctx.getImageData(left, top, w, h);
        const data = image.data;
        for (let by = 0; by < h; by += block) {
            for (let bx = 0; bx < w; bx += block) {
                let r = 0, g = 0, b = 0, a = 0, count = 0;
                const maxY = Math.min(h, by + block);
                const maxX = Math.min(w, bx + block);
                for (let py = by; py < maxY; py += 1) {
                    for (let px = bx; px < maxX; px += 1) {
                        const i = (py * w + px) * 4;
                        r += data[i];
                        g += data[i + 1];
                        b += data[i + 2];
                        a += data[i + 3];
                        count += 1;
                    }
                }
                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);
                a = Math.round(a / count);
                for (let py = by; py < maxY; py += 1) {
                    for (let px = bx; px < maxX; px += 1) {
                        const i = (py * w + px) * 4;
                        data[i] = r;
                        data[i + 1] = g;
                        data[i + 2] = b;
                        data[i + 3] = a;
                    }
                }
            }
        }
        ctx.putImageData(image, left, top);
    }

    async drawShiftPhotoCompareMark(ctx, mark, rect, sizeScale = 1) {
        const mode = mark.dataset.mode || (mark.classList.contains('arrow') ? 'arrow' : (mark.classList.contains('rect') ? 'rect' : (mark.classList.contains('text') ? 'text' : 'circle')));
        if (mode === 'freehand') {
            const points = this.parseShiftPhotoCompareFreehandPoints(mark.dataset.points || '[]');
            if (points.length < 2) return;
            const size = (parseFloat(mark.dataset.size || '') || 56) * (Number(sizeScale) || 1);
            const stroke = parseFloat(mark.dataset.stroke || '') || 1;
            const color = /^#[0-9a-f]{6}$/i.test(mark.dataset.color || '') ? mark.dataset.color : '#dc2626';
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(2, size * 0.08 * stroke);
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.shadowColor = 'rgba(255,255,255,0.95)';
            ctx.shadowBlur = 3;
            ctx.beginPath();
            points.forEach((point, index) => {
                const px = rect.x + point.x / 100 * rect.width;
                const py = rect.y + point.y / 100 * rect.height;
                if (index === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.stroke();
            ctx.restore();
            return;
        }
        const x = rect.x + (parseFloat(mark.style.left) || 0) / 100 * rect.width;
        const y = rect.y + (parseFloat(mark.style.top) || 0) / 100 * rect.height;
        const size = (parseFloat(mark.dataset.size || '') || 56) * (Number(sizeScale) || 1);
        const angle = (parseFloat(mark.dataset.angle || '') || 0) * Math.PI / 180;
        const stretch = parseFloat(mark.dataset.stretch || '') || 1;
        const stretchY = parseFloat(mark.dataset.stretchY || '') || 1;
        const stroke = parseFloat(mark.dataset.stroke || '') || 1;
        const color = /^#[0-9a-f]{6}$/i.test(mark.dataset.color || '') ? mark.dataset.color : '#dc2626';
        const text = String(mark.dataset.text || mark.textContent || '');
        const fontFamily = this.getShiftPhotoCompareFontFamily(mark.dataset.font || '');
        if (mode === 'image') {
            const imageSrc = mark.dataset.imageSrc || mark.querySelector?.('img')?.src || '';
            if (!imageSrc) return;
            try {
                const img = await this.loadShiftPhotoCompareImage(imageSrc);
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle);
                const flipX = mark.dataset.flipX === '-1' ? -1 : 1;
                const flipY = mark.dataset.flipY === '-1' ? -1 : 1;
                ctx.globalAlpha = Math.max(0.1, Math.min(1, parseFloat(mark.dataset.opacity || '') || 1));
                ctx.scale(stretch * flipX, stretchY * flipY);
                ctx.drawImage(img, -size / 2, -size / 2, size, size);
                ctx.restore();
            } catch {
                // Ignore broken stamp images during export.
            }
            return;
        }
        if (mode === 'mosaic') {
            const width = size * Math.max(0.05, stretch);
            const height = size * Math.max(0.05, stretchY);
            this.applyShiftPhotoCompareMosaicToCanvas(ctx, x - width / 2, y - height / 2, width, height, Math.max(8, Math.min(26, size * 0.08)));
            ctx.save();
            ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
            ctx.lineWidth = Math.max(1, Math.min(3, size * 0.01));
            ctx.setLineDash([8, 5]);
            ctx.strokeRect(x - width / 2, y - height / 2, width, height);
            ctx.restore();
            return;
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        if (mode !== 'arrow') ctx.scale(stretch, stretchY);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = Math.max(2, size * 0.08 * stroke);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(255,255,255,0.95)';
        ctx.shadowBlur = 3;
        if (mode === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else if (mode === 'rect') {
            ctx.strokeRect(-size / 2, -size / 2, size, size);
        } else if (mode === 'xmark') {
            ctx.beginPath();
            ctx.moveTo(-size * 0.42, -size * 0.42);
            ctx.lineTo(size * 0.42, size * 0.42);
            ctx.moveTo(size * 0.42, -size * 0.42);
            ctx.lineTo(-size * 0.42, size * 0.42);
            ctx.stroke();
        } else if (mode === 'arrow') {
            const length = size * Math.max(0.7, 0.86 * stretch);
            const headLength = size * 0.30;
            const headHeight = size * 0.24 * stretchY;
            ctx.beginPath();
            ctx.moveTo(-length / 2, 0);
            ctx.lineTo(length / 2, 0);
            ctx.moveTo(length / 2, 0);
            ctx.lineTo(length / 2 - headLength, -headHeight);
            ctx.moveTo(length / 2, 0);
            ctx.lineTo(length / 2 - headLength, headHeight);
            ctx.stroke();
        } else if (mode === 'text' || mode === 'number') {
            ctx.shadowBlur = 4;
            const fontSize = Math.max(12, size * (mode === 'number' ? 0.62 : 0.48));
            const lineHeight = fontSize * 1.15;
            const lines = String(text || '').split(/\r?\n/);
            const startY = -((lines.length - 1) * lineHeight) / 2;
            ctx.font = `900 ${fontSize}px ${fontFamily}`;
            ctx.textAlign = mark.dataset.anchor === 'left' && mode === 'text' ? 'left' : 'center';
            ctx.textBaseline = 'middle';
            if (mark.dataset.outline !== '0') {
                ctx.lineWidth = Math.max(3, size * 0.11);
                ctx.strokeStyle = '#ffffff';
                lines.forEach((line, index) => ctx.strokeText(line, 0, startY + index * lineHeight));
            }
            ctx.fillStyle = color;
            lines.forEach((line, index) => ctx.fillText(line, 0, startY + index * lineHeight));
        }
        ctx.restore();
    }

    getShiftPhotoCompareDisplayImageRect(wrap) {
        const imgEl = wrap?.querySelector?.('img');
        const wrapRect = wrap?.getBoundingClientRect?.();
        if (!imgEl || !wrapRect?.width || !wrapRect?.height) return null;
        const rendered = this.getShiftPhotoCompareRenderedImageRect(imgEl, wrapRect.width, wrapRect.height);
        return {
            left: wrapRect.left + rendered.x,
            top: wrapRect.top + rendered.y,
            right: wrapRect.left + rendered.x + rendered.width,
            bottom: wrapRect.top + rendered.y + rendered.height,
            width: rendered.width,
            height: rendered.height
        };
    }

    async drawShiftPhotoCompareMarkFromWrap(ctx, mark, wrap, rect) {
        const wrapRect = wrap?.getBoundingClientRect?.();
        const imageRect = this.getShiftPhotoCompareDisplayImageRect(wrap);
        if (!wrapRect?.width || !wrapRect?.height || !imageRect?.width || !imageRect?.height) {
            await this.drawShiftPhotoCompareMark(ctx, mark, rect);
            return;
        }
        const markX = wrapRect.left + ((parseFloat(mark.style.left) || 0) / 100) * wrapRect.width;
        const markY = wrapRect.top + ((parseFloat(mark.style.top) || 0) / 100) * wrapRect.height;
        const localMark = mark.cloneNode(true);
        if (mark.dataset.mode === 'freehand') {
            const points = this.parseShiftPhotoCompareFreehandPoints(mark.dataset.points || '[]')
                .map(point => {
                    const px = wrapRect.left + point.x / 100 * wrapRect.width;
                    const py = wrapRect.top + point.y / 100 * wrapRect.height;
                    return {
                        x: ((px - imageRect.left) / imageRect.width) * 100,
                        y: ((py - imageRect.top) / imageRect.height) * 100
                    };
                })
                .filter(point => point.x >= -5 && point.x <= 105 && point.y >= -5 && point.y <= 105);
            this.updateShiftPhotoCompareFreehandMark(localMark, points);
            await this.drawShiftPhotoCompareMark(ctx, localMark, rect, rect.width / imageRect.width);
            return;
        }
        localMark.style.left = `${((markX - imageRect.left) / imageRect.width) * 100}%`;
        localMark.style.top = `${((markY - imageRect.top) / imageRect.height) * 100}%`;
        await this.drawShiftPhotoCompareMark(ctx, localMark, rect, rect.width / imageRect.width);
    }

    async drawShiftPhotoCompareGlobalMarksForWrap(ctx, wrap, rect) {
        const layer = document.querySelector('.shift-photo-compare-global-layer');
        const layerRect = layer?.getBoundingClientRect?.();
        const imageRect = this.getShiftPhotoCompareDisplayImageRect(wrap);
        if (!layer || !layerRect?.width || !layerRect?.height || !imageRect?.width || !imageRect?.height) return;
        for (const mark of layer.querySelectorAll('.shift-photo-compare-mark')) {
            const markX = layerRect.left + ((parseFloat(mark.style.left) || 0) / 100) * layerRect.width;
            const markY = layerRect.top + ((parseFloat(mark.style.top) || 0) / 100) * layerRect.height;
            const size = parseFloat(mark.dataset.size || '') || 56;
            const stretch = parseFloat(mark.dataset.stretch || '') || 1;
            const stretchY = parseFloat(mark.dataset.stretchY || '') || 1;
            const radiusX = size * Math.max(stretch, 1) * 0.75;
            const radiusY = size * Math.max(stretchY, 1) * 0.75;
            const intersects = mark.dataset.mode === 'freehand' || (markX + radiusX >= imageRect.left
                && markX - radiusX <= imageRect.right
                && markY + radiusY >= imageRect.top
                && markY - radiusY <= imageRect.bottom);
            if (!intersects) continue;
            const localMark = mark.cloneNode(true);
            if (mark.dataset.mode === 'freehand') {
                const points = this.parseShiftPhotoCompareFreehandPoints(mark.dataset.points || '[]')
                    .map(point => {
                        const px = layerRect.left + point.x / 100 * layerRect.width;
                        const py = layerRect.top + point.y / 100 * layerRect.height;
                        return {
                            x: ((px - imageRect.left) / imageRect.width) * 100,
                            y: ((py - imageRect.top) / imageRect.height) * 100
                        };
                    })
                    .filter(point => point.x >= -5 && point.x <= 105 && point.y >= -5 && point.y <= 105);
                this.updateShiftPhotoCompareFreehandMark(localMark, points);
            } else {
                localMark.style.left = `${((markX - imageRect.left) / imageRect.width) * 100}%`;
                localMark.style.top = `${((markY - imageRect.top) / imageRect.height) * 100}%`;
            }
            ctx.save();
            ctx.beginPath();
            ctx.rect(rect.x, rect.y, rect.width, rect.height);
            ctx.clip();
            await this.drawShiftPhotoCompareMark(ctx, localMark, rect, rect.width / imageRect.width);
            ctx.restore();
        }
    }

    async exportShiftPhotoCompareImage() {
        const wraps = Array.from(document.querySelectorAll('.shift-photo-compare-image-wrap'));
        if (!wraps.length) return;
        wraps.forEach(wrap => this.syncShiftPhotoCompareMarks(wrap));
        this.syncShiftPhotoCompareGlobalMarks();
        const gap = 18;
        const cellW = 720;
        const cellH = 540;
        const cols = wraps.length === 1 ? 1 : Math.min(wraps.length, 3);
        const rows = Math.ceil(wraps.length / cols);
        const canvas = document.createElement('canvas');
        canvas.width = cols * cellW + (cols - 1) * gap;
        canvas.height = rows * cellH + (rows - 1) * gap;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < wraps.length; i += 1) {
            const wrap = wraps[i];
            const imgEl = wrap.querySelector('img');
            if (!imgEl?.src) continue;
            const img = await this.loadShiftPhotoCompareImage(imgEl.src);
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = col * (cellW + gap);
            const y = row * (cellH + gap);
            ctx.fillStyle = '#020617';
            ctx.fillRect(x, y, cellW, cellH);
            const rect = this.getShiftPhotoCompareRenderedImageRect(img, cellW, cellH);
            const drawRect = { x: x + rect.x, y: y + rect.y, width: rect.width, height: rect.height };
            ctx.drawImage(img, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
            for (const mark of wrap.querySelectorAll('.shift-photo-compare-mark')) {
                await this.drawShiftPhotoCompareMarkFromWrap(ctx, mark, wrap, drawRect);
            }
        }
        for (const mark of document.querySelectorAll('.shift-photo-compare-global-layer .shift-photo-compare-mark')) {
            await this.drawShiftPhotoCompareMark(ctx, mark, { x: 0, y: 0, width: canvas.width, height: canvas.height });
        }
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `写真比較_${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.autoSaveShiftNotebook(true);
    }

    async exportShiftPhotoCompareEachImage() {
        const wraps = Array.from(document.querySelectorAll('.shift-photo-compare-image-wrap'));
        if (!wraps.length) return;
        this.syncShiftPhotoCompareGlobalMarks();
        for (let i = 0; i < wraps.length; i += 1) {
            const wrap = wraps[i];
            this.syncShiftPhotoCompareMarks(wrap);
            const imgEl = wrap.querySelector('img');
            if (!imgEl?.src) continue;
            const img = await this.loadShiftPhotoCompareImage(imgEl.src);
            const naturalW = img.naturalWidth || img.width || 1;
            const naturalH = img.naturalHeight || img.height || 1;
            const maxSide = 1400;
            const scale = Math.min(1, maxSide / Math.max(naturalW, naturalH));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(naturalW * scale);
            canvas.height = Math.round(naturalH * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            for (const mark of wrap.querySelectorAll('.shift-photo-compare-mark')) {
                await this.drawShiftPhotoCompareMarkFromWrap(ctx, mark, wrap, { x: 0, y: 0, width: canvas.width, height: canvas.height });
            }
            await this.drawShiftPhotoCompareGlobalMarksForWrap(ctx, wrap, { x: 0, y: 0, width: canvas.width, height: canvas.height });
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `写真_${i + 1}_記号込み_${new Date().toISOString().slice(0, 10)}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        this.autoSaveShiftNotebook(true);
    }

    getShiftPhotoCompareDisplayItems(photos, labels) {
        const items = photos.map((photo, index) => ({ photo, label: labels[index] || '', index }));
        const beforeItems = items.filter(item => item.label === 'Before');
        const afterItems = items.filter(item => item.label === 'After');
        if (!beforeItems.length || !afterItems.length) return items;

        const pairedIndexes = new Set();
        const ordered = [];
        const pairCount = Math.min(beforeItems.length, afterItems.length);
        for (let i = 0; i < pairCount; i += 1) {
            ordered.push(beforeItems[i], afterItems[i]);
            pairedIndexes.add(beforeItems[i].index);
            pairedIndexes.add(afterItems[i].index);
        }

        items.forEach(item => {
            if (!pairedIndexes.has(item.index)) ordered.push(item);
        });
        return ordered;
    }

    getShiftPhotoCompareLabels(photos) {
        const labels = new Array(photos.length).fill('');
        const beforeItems = photos.map((photo, index) => ({ ...photo, compareIndex: index }))
            .filter(photo => photo.role === 'before' && photo.caption);
        const afterItems = photos.map((photo, index) => ({ ...photo, compareIndex: index }))
            .filter(photo => photo.role === 'after' && photo.caption);
        if (beforeItems.length && afterItems.length) {
            const grouped = new Map();
            [...beforeItems, ...afterItems].forEach(photo => {
                if (!photo.setKey) return;
                if (!grouped.has(photo.setKey)) grouped.set(photo.setKey, { before: [], after: [] });
                grouped.get(photo.setKey)[photo.role].push(photo);
            });

            grouped.forEach(group => {
                const count = Math.min(group.before.length, group.after.length);
                for (let i = 0; i < count; i += 1) {
                    labels[group.before[i].compareIndex] = 'Before';
                    labels[group.after[i].compareIndex] = 'After';
                }
            });

            if (!labels.some(Boolean) && beforeItems.length === 1 && afterItems.length === 1) {
                labels[beforeItems[0].compareIndex] = 'Before';
                labels[afterItems[0].compareIndex] = 'After';
            }
        }

        this.applyShiftPhotoNumericCompareLabels(photos, labels);

        return labels;
    }

    applyShiftPhotoNumericCompareLabels(photos, labels) {
        const numbered = photos.map((photo, index) => ({ ...photo, compareIndex: index }))
            .filter(photo => photo.caption && Array.isArray(photo.numbers) && photo.numbers.length);
        if (!numbered.length) return;

        const pairGroups = new Map();
        numbered.filter(photo => photo.pairNumber !== null && photo.pairStep !== null).forEach(photo => {
            const key = String(photo.pairNumber);
            if (!pairGroups.has(key)) pairGroups.set(key, []);
            pairGroups.get(key).push(photo);
        });
        pairGroups.forEach(group => {
            const before = group.find(photo => photo.pairStep === 1);
            const after = group.find(photo => photo.pairStep === 2);
            if (!before || !after) return;
            if (!labels[before.compareIndex]) labels[before.compareIndex] = 'Before';
            if (!labels[after.compareIndex]) labels[after.compareIndex] = 'After';
        });

        const sameNumberGroups = new Map();
        numbered.filter(photo => photo.numbers.length === 1).forEach(photo => {
            const key = String(photo.numbers[0]);
            if (!sameNumberGroups.has(key)) sameNumberGroups.set(key, []);
            sameNumberGroups.get(key).push(photo);
        });
        sameNumberGroups.forEach(group => {
            if (group.length !== 2) return;
            const sorted = [...group].sort((a, b) => a.compareIndex - b.compareIndex);
            if (!labels[sorted[0].compareIndex]) labels[sorted[0].compareIndex] = 'Before';
            if (!labels[sorted[1].compareIndex]) labels[sorted[1].compareIndex] = 'After';
        });

        if (!labels.some(Boolean)) {
            const singleNumberItems = numbered.filter(photo => photo.numbers.length === 1);
            const before = singleNumberItems.find(photo => photo.numbers[0] === 1);
            const after = singleNumberItems.find(photo => photo.numbers[0] === 2);
            if (before && after) {
                labels[before.compareIndex] = 'Before';
                labels[after.compareIndex] = 'After';
            }
        }

        if (photos.length === 2 && !labels.some(Boolean) && numbered.length === 2) {
            const [first, second] = numbered.sort((a, b) => a.compareIndex - b.compareIndex);
            const simpleOneTwo = first.numbers.length === 1 && second.numbers.length === 1 && first.numbers[0] === 1 && second.numbers[0] === 2;
            const sameNumberPair = first.numbers.length === 1 && second.numbers.length === 1 && first.numbers[0] === second.numbers[0];
            if (simpleOneTwo || sameNumberPair) {
                labels[first.compareIndex] = 'Before';
                labels[second.compareIndex] = 'After';
            }
        }
    }

    closeShiftPhotoCompare() {
        this.closeShiftPhotoCompareImageContextMenu();
        document.querySelectorAll('.shift-photo-compare-image-wrap').forEach(wrap => this.syncShiftPhotoCompareMarks(wrap));
        this.syncShiftPhotoCompareGlobalMarks();
        if (this._shiftPhotoCompareContext?.row) this.autoSaveShiftNotebook(true);
        this._shiftPhotoCompareContext?.onSync?.(this._shiftPhotoCompareContext);
        this._shiftPhotoCompareContext?.onClose?.(this._shiftPhotoCompareContext);
        if (this._shiftPhotoCompareContext?.source === 'guide') this.autoSaveGuideDraftFromModal?.();
        document.getElementById('shift-photo-compare-overlay')?.remove();
        this._shiftPhotoCompareContext = null;
        if (this._shiftPhotoCompareKeydown) {
            document.removeEventListener('keydown', this._shiftPhotoCompareKeydown);
            this._shiftPhotoCompareKeydown = null;
        }
        if (this._shiftPhotoComparePaste) {
            document.removeEventListener('paste', this._shiftPhotoComparePaste);
            this._shiftPhotoComparePaste = null;
        }
    }

    showFiveSPhotoSavedNotice() {
        document.querySelectorAll('.five-s-photo-save-toast').forEach(el => el.remove());
        const toast = document.createElement('div');
        toast.className = 'five-s-photo-save-toast';
        toast.innerHTML = '<i class="fa-solid fa-check"></i><span>写真注記を保存しました</span>';
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 220);
        }, 2200);
    }

    showFiveSAssigneeSavedNotice(message = '5S担当を保存しました') {
        document.querySelectorAll('.five-s-photo-save-toast').forEach(el => el.remove());
        const toast = document.createElement('div');
        toast.className = 'five-s-photo-save-toast';
        toast.innerHTML = `<i class="fa-solid fa-check"></i><span>${this.escapeHtml(message)}</span>`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 220);
        }, 2200);
    }

    getShiftNotebookRowGroup(row) {
        return row?.querySelector('.shift-row-group-select')?.value || '未設定';
    }

    canDropShiftNotebookRowOnTarget(dragging, targetRow) {
        if (!dragging || !targetRow) return false;
        if (this.getShiftNotebookRowGroup(dragging) !== this.getShiftNotebookRowGroup(targetRow)) return false;
        const draggingId = dragging.dataset.shiftRowId || '';
        if (draggingId && this.getShiftNotebookReplyRowsFor(dragging).some(row => row === targetRow)) return false;
        const draggingRoot = this.getShiftNotebookReplyRootId(dragging);
        const targetRoot = this.getShiftNotebookReplyRootId(targetRow);
        if (dragging.dataset.replyTo) return draggingRoot && draggingRoot === targetRoot;
        return !targetRow.dataset.replyTo || draggingRoot === targetRoot;
    }

    startShiftRowGroupStampDrag(event, group) {
        this._draggingShiftRowGroupStamp = group || '未設定';
        if (event?.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copyMove';
            event.dataTransfer.setData('application/x-shift-row-group', this._draggingShiftRowGroupStamp);
            event.dataTransfer.setData('text/plain', 'shift-row-group');
            this.setShiftRowGroupStampDragImage(event, this._draggingShiftRowGroupStamp);
        }
        event?.currentTarget?.classList.add('dragging');
        document.body.classList.add('shift-row-group-dragging-active');
        document.body.classList.toggle('shift-row-group-delete-disabled', this.isShiftRowGroupDeleteDisabled(group));
    }

    setShiftRowGroupStampDragImage(event, group) {
        if (!event?.dataTransfer?.setDragImage) return;
        const label = String(group || '未設定');
        const ghost = document.createElement('div');
        ghost.className = 'shift-row-group-drag-ghost';
        ghost.textContent = label;
        ghost.setAttribute('style', `${this.getShiftNotebookRowGroupStyle(label)} position:fixed; left:-1000px; top:-1000px;`);
        document.body.appendChild(ghost);
        event.dataTransfer.setDragImage(ghost, 16, 16);
        setTimeout(() => ghost.remove(), 0);
    }

    finishShiftRowGroupStampDrag() {
        this._draggingShiftRowGroupStamp = null;
        document.body.classList.remove('shift-row-group-dragging-active');
        document.body.classList.remove('shift-row-group-delete-disabled');
        document.querySelectorAll('.shift-row-group-stamp.dragging').forEach(el => el.classList.remove('dragging'));
        document.querySelectorAll('.shift-row-group-trash.drag-over').forEach(el => el.classList.remove('drag-over'));
        this.clearShiftNotebookDragIndicators();
        document.getElementById('shift-notebook-rows')?.classList.remove('shift-stamp-drop-empty');
    }

    isShiftRowGroupDeleteDisabled(group) {
        return !group || group === '未設定' || this.isShiftNotebookThroughGroup(group);
    }

    getShiftRowGroupStampDragGroup(event) {
        const transferTypes = event?.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
        const fromTransfer = transferTypes.includes('application/x-shift-row-group')
            ? event.dataTransfer.getData('application/x-shift-row-group')
            : '';
        return fromTransfer || this._draggingShiftRowGroupStamp || '';
    }

    startShiftMemberStampDrag(event, memberName) {
        this._draggingShiftMemberStamp = memberName || '';
        if (event?.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copy';
            event.dataTransfer.setData('application/x-shift-member', this._draggingShiftMemberStamp);
        }
        event?.currentTarget?.classList.add('dragging');
        document.body.classList.add('shift-member-dragging-active');
    }

    finishShiftMemberStampDrag() {
        this._draggingShiftMemberStamp = null;
        document.body.classList.remove('shift-member-dragging-active');
        document.querySelectorAll('.shift-member-stamp.dragging').forEach(el => el.classList.remove('dragging'));
    }

    getShiftMemberStampDragName(event) {
        const transferTypes = event?.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
        const fromTransfer = transferTypes.includes('application/x-shift-member')
            ? event.dataTransfer.getData('application/x-shift-member')
            : '';
        return fromTransfer || this._draggingShiftMemberStamp || '';
    }

    handleShiftRowGroupTrashDragOver(event) {
        const group = this.getShiftRowGroupStampDragGroup(event);
        if (!group) return;
        event.preventDefault();
        const canDelete = !this.isShiftRowGroupDeleteDisabled(group);
        if (event.dataTransfer) event.dataTransfer.dropEffect = canDelete ? 'move' : 'none';
        event.currentTarget?.classList.toggle('drag-over', canDelete);
        this.clearShiftNotebookDragIndicators();
    }

    handleShiftRowGroupTrashDragLeave(event) {
        event.currentTarget?.classList.remove('drag-over');
    }

    handleShiftRowGroupTrashDrop(event) {
        const group = this.getShiftRowGroupStampDragGroup(event);
        if (!group) return;
        event.preventDefault();
        event.currentTarget?.classList.remove('drag-over');
        this.deleteShiftNotebookRowGroupFromStamp(group);
        this.finishShiftRowGroupStampDrag();
    }

    deleteShiftNotebookRowGroupFromStamp(group) {
        if (!group || group === '未設定' || this.isShiftNotebookThroughGroup(group)) {
            this.setShiftNotebookStatus(`${group || '未設定'}グループは削除できません`, 'error');
            return;
        }
        if (!store.activeData.shiftNotebookRowGroups?.includes(group)) {
            this.setShiftNotebookStatus('削除できる登録グループではありません', 'error');
            return;
        }
        if (!confirm(`グループ「${group}」を削除しますか？\n現在表示中の同じグループの行は「未設定」に戻します。`)) return;

        store.activeData.shiftNotebookRowGroups = store.activeData.shiftNotebookRowGroups.filter(g => g !== group);
        (store.activeData.shiftNotebookRowTemplates || []).forEach(template => {
            if (template.group === group) template.group = '未設定';
            (template.rows || []).forEach(row => {
                if (row.group === group) row.group = '未設定';
            });
        });

        document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => {
            const select = row.querySelector('.shift-row-group-select');
            if (select?.value === group) {
                select.innerHTML = this.getShiftNotebookRowGroupOptions('未設定');
                select.value = '未設定';
                row.setAttribute('style', this.getShiftNotebookRowGroupStyle('未設定'));
            }
        });
        this.lastShiftNotebookRowGroup = '未設定';
        store.save();
        this.renderShiftRowGroupSelectOptions();
        this.refreshShiftRowGroupStamps();
        this.refreshShiftRowTemplateSelect();
        this.rerenderShiftRowTemplateManager?.();
        this.updateShiftNotebookGroupCorners();
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus(`グループ「${group}」を削除しました`, 'saved');
    }

    setupShiftRowGroupStampDropZone() {
        const container = document.getElementById('shift-notebook-rows');
        if (!container || container._shiftStampDropReady) return;
        container._shiftStampDropReady = true;
        container.addEventListener('dragover', (e) => {
            const stampGroup = this.getShiftRowGroupStampDragGroup(e);
            if (!stampGroup) return;
            const targetRow = e.target?.closest?.('.shift-notebook-row');
            if (targetRow && container.contains(targetRow)) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            this.clearShiftNotebookDragIndicators(container);
            container.classList.add('shift-stamp-drop-empty');
        });
        container.addEventListener('dragleave', (e) => {
            if (!container.contains(e.relatedTarget)) {
                container.classList.remove('shift-stamp-drop-empty');
            }
        });
        container.addEventListener('drop', (e) => {
            const stampGroup = this.getShiftRowGroupStampDragGroup(e);
            if (!stampGroup) return;
            const targetRow = e.target?.closest?.('.shift-notebook-row');
            if (targetRow && container.contains(targetRow)) return;
            e.preventDefault();
            container.classList.remove('shift-stamp-drop-empty');
            this.clearShiftNotebookDragIndicators(container);
            this.insertShiftNotebookBlankRowFromGroupStamp(stampGroup, null);
            this.finishShiftRowGroupStampDrag();
        });
    }

    insertShiftNotebookBlankRowFromGroupStamp(group, beforeNode = null) {
        const container = document.getElementById('shift-notebook-rows');
        if (!container) return;
        const newRow = this.addShiftNotebookRow('shift-notebook-rows', '', [], '通常', group || '未設定');
        if (newRow && beforeNode && beforeNode.parentNode === container) {
            container.insertBefore(newRow, beforeNode);
        }
        this.lastShiftNotebookRowGroup = group || '未設定';
        this.updateShiftNotebookGroupCorners();
        newRow?.querySelector('.shift-note-text')?.focus();
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus(`${group || '未設定'}の行を追加しました`, 'saved');
    }

    updateShiftNotebookDragIndicator(targetRow, insertAfter) {
        const container = targetRow?.parentElement;
        this.clearShiftNotebookDragIndicators(container);
        container?.classList.remove('shift-stamp-drop-empty');
        targetRow.classList.add('drag-over', insertAfter ? 'drag-insert-after' : 'drag-insert-before');
    }

    clearShiftNotebookDragIndicators(container = document.getElementById('shift-notebook-rows')) {
        container?.querySelectorAll('.shift-notebook-row.drag-over, .shift-notebook-row.drag-insert-before, .shift-notebook-row.drag-insert-after')
            .forEach(row => row.classList.remove('drag-over', 'drag-insert-before', 'drag-insert-after'));
        container?.classList.remove('shift-stamp-drop-empty');
    }

    getShiftNotebookDragInsertAfter(dragging, targetRow, event) {
        const container = targetRow?.parentElement;
        if (dragging?.parentElement === container && container) {
            const rows = Array.from(container.children);
            const fromIndex = rows.indexOf(dragging);
            const toIndex = rows.indexOf(targetRow);
            if (fromIndex !== -1 && toIndex !== -1) {
                if (toIndex === fromIndex + 1) return true;
                if (toIndex === fromIndex - 1) return false;
            }
        }
        const rect = targetRow.getBoundingClientRect();
        return event.clientY > rect.top + rect.height / 2;
    }

    addShiftNotebookRowWithLastGroup(containerId) {
        const container = document.getElementById(containerId);
        const lastRow = container?.querySelector('.shift-notebook-row:last-child');
        const group = this.lastShiftNotebookRowGroup || lastRow?.querySelector('.shift-row-group-select')?.value || '未設定';
        this.addShiftNotebookRow(containerId, '', [], '通常', group);
        this.sortShiftNotebookRowsInDom();
        this.autoSaveShiftNotebook(true);
    }

    openSuddenRecordFromShiftRow(button) {
        const row = button?.closest('.shift-notebook-row');
        const editor = row?.querySelector('.shift-note-text');
        const html = this.sanitizeShiftNoteHtml(editor?.innerHTML || '');
        const content = this.stripShiftNoteHtml(html).trim();
        if (!row || !content) {
            this.setShiftNotebookStatus('突発登録する行の内容を入力してください', 'error');
            editor?.focus();
            return;
        }
        const editing = this._editingShiftNotebook;
        if (!editing?.dateStr || !editing?.shift) return;
        row.dataset.preserveBlank = 'true';
        this.saveShiftNotebook(editing.dateStr, editing.shift, { close: false, render: false, status: false });
        this._pendingShiftSuddenRegistration = {
            dateStr: editing.dateStr,
            shift: editing.shift,
            rowId: row.dataset.shiftRowId || '',
            content
        };
        this.openSuddenRecordModal(editing.dateStr, { content });
    }

    positionShiftSuddenRegisteredStamp(row) {
        const stamp = row?.querySelector('.shift-sudden-registered-stamp');
        const editor = row?.querySelector('.shift-note-text');
        if (!row || !stamp || !editor) return;
        if (!row.classList.contains('shift-row-sudden-registered')) return;
        const rowRect = row.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        const stampWidth = stamp.offsetWidth || 116;
        stamp.style.left = `${Math.max(0, editorRect.right - rowRect.left - stampWidth - 14)}px`;
        stamp.style.top = `${editorRect.top - rowRect.top - 17}px`;
    }

    openShiftSuddenRegisteredHistory(row) {
        const historyId = row?.dataset.suddenHistoryId || '';
        if (!historyId) {
            this.setShiftNotebookStatus('該当する突発対応記録が見つかりません', 'error');
            return;
        }
        this.closeModal();
        this.openHistoryEditForm(historyId);
    }

    markShiftNotebookRowSuddenRegistered(historyId = '') {
        const source = this._pendingShiftSuddenRegistration;
        this._pendingShiftSuddenRegistration = null;
        if (!source?.dateStr || !source?.shift || !source?.rowId) return;
        const dayData = store.activeData.shiftNotebooks?.[source.dateStr];
        const buckets = [dayData?.[source.shift]?.rows, dayData?.sharedRows].filter(Array.isArray);
        const row = buckets.flat().find(item => item.id === source.rowId);
        if (!row) return;
        row.suddenRegistered = true;
        row.suddenHistoryId = historyId || row.suddenHistoryId || '';
        store.save();
    }

    clearShiftNotebookRows() {
        const container = document.getElementById('shift-notebook-rows');
        if (!container) return;
        const rows = Array.from(container.querySelectorAll('.shift-notebook-row'));
        if (rows.length === 0) {
            this.setShiftNotebookStatus('削除する行はありません', 'moved');
            return;
        }
        if (!confirm(`現在表示中の${rows.length}行を全て削除します。よろしいですか？`)) return;
        const rowDataList = rows.map(row => this.getShiftNotebookRowDataFromElement(row)).filter(Boolean);
        rows.forEach(row => row.remove());
        this.updateShiftNotebookGroupCorners();
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus(`${rowDataList.length}行を一括削除しました`, 'saved');
        this.showShiftNotebookUndoNotice(`${rowDataList.length}行を一括削除しました`, () => {
            this.restoreShiftNotebookRowsFromData('shift-notebook-rows', rowDataList);
            this.updateShiftNotebookGroupCorners();
            this.updateShiftNotebookHiddenRows();
            this.updateShiftNotebookRowMenuVisibility();
            this.autoSaveShiftNotebook(true);
            requestAnimationFrame(() => {
                document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => this.positionShiftImportantStamp(row));
            });
        });
    }

    addShiftNotebookRowBelow(button) {
        const currentRow = button?.matches?.('.shift-notebook-row')
            ? button
            : button?.closest('.shift-notebook-row');
        const container = document.getElementById('shift-notebook-rows');
        if (!currentRow || !container) return;
        const group = currentRow.querySelector('.shift-row-group-select')?.value || '未設定';
        const existingRows = Array.from(container.children);
        const tempContainerId = 'shift-notebook-rows';
        this.addShiftNotebookRow(tempContainerId, '', [], '通常', group);
        const newRow = container.lastElementChild;
        if (newRow && existingRows.includes(currentRow)) {
            currentRow.insertAdjacentElement('afterend', newRow);
            const input = newRow.querySelector('.shift-note-text');
            if (input) input.focus();
        }
        this.sortShiftNotebookRowsInDom();
        this.autoSaveShiftNotebook(true);
    }

    addShiftNotebookReplyRow(button) {
        const currentRow = button?.closest('.shift-notebook-row');
        const container = document.getElementById('shift-notebook-rows');
        if (!currentRow || !container) return;
        const group = currentRow.querySelector('.shift-row-group-select')?.value || '未設定';
        currentRow.classList.remove('shift-replies-collapsed');
        const descendants = this.getShiftNotebookReplyRowsFor(currentRow);
        const replyRow = this.addShiftNotebookRow('shift-notebook-rows', '', [], '通常', group, '', false, true, '', currentRow.dataset.shiftRowId || '');
        if (replyRow) {
            const insertAfter = descendants.length ? descendants[descendants.length - 1] : currentRow;
            insertAfter.insertAdjacentElement('afterend', replyRow);
            replyRow.querySelector('.shift-note-text')?.focus();
            this.flashShiftNotebookReplyLink(currentRow, replyRow);
            requestAnimationFrame(() => {
                const responderButton = replyRow.querySelector('.shift-row-responder');
                if (responderButton) this.toggleShiftResponderMenu(responderButton);
            });
        }
        this.updateShiftNotebookGroupCorners();
        this.autoSaveShiftNotebook(true);
    }

    flashShiftNotebookReplyLink(parentRow, replyRow) {
        [parentRow, replyRow].forEach(row => {
            if (!row) return;
            row.classList.remove('shift-reply-linked-flash');
            void row.offsetWidth;
            row.classList.add('shift-reply-linked-flash');
            setTimeout(() => row.classList.remove('shift-reply-linked-flash'), 1300);
        });
    }

    getShiftNotebookReplyRowsFor(parentRow, options = {}) {
        const parentId = parentRow?.dataset.shiftRowId || '';
        if (!parentId) return [];
        const directOnly = !!options.directOnly;
        const rows = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'));
        const byId = new Map(rows.map(row => [row.dataset.shiftRowId || '', row]));
        return rows.filter(row => {
            if (row === parentRow) return false;
            if (directOnly) return row.dataset.replyTo === parentId;
            let replyTo = row.dataset.replyTo || '';
            while (replyTo) {
                if (replyTo === parentId) return true;
                const parent = byId.get(replyTo);
                if (!parent) return false;
                replyTo = parent.dataset.replyTo || '';
            }
            return false;
        });
    }

    getShiftNotebookRowsForCascadeDelete(row) {
        if (!row) return [];
        const rows = [row, ...this.getShiftNotebookReplyRowsFor(row)];
        const seen = new Set();
        return rows.filter(item => {
            const id = item.dataset.shiftRowId || '';
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }

    restoreShiftNotebookRowsFromData(containerId, rowsData, beforeNode = null) {
        const container = document.getElementById(containerId);
        if (!container || !Array.isArray(rowsData)) return;
        const restoredRows = [];
        rowsData.forEach(data => {
            const restored = this.addShiftNotebookRow(containerId, data.text, data.photos, data.tag, data.group, data.html, data.hidden, true, data.id, data.replyTo, !!data.important, data.pasteFormat || null, !!data.suddenRegistered, data.suddenHistoryId || '', !!data.fiveS, data.photoCompareMarks || [], data.fiveSAssigneeId || '');
            if (restored) restoredRows.push(restored);
        });
        const anchor = beforeNode && beforeNode.parentNode === container ? beforeNode : null;
        restoredRows.forEach(restored => container.insertBefore(restored, anchor));
    }

    getShiftNotebookReplyRootId(row) {
        if (!row) return '';
        const rows = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'));
        const byId = new Map(rows.map(item => [item.dataset.shiftRowId || '', item]));
        let current = row;
        let replyTo = current.dataset.replyTo || '';
        while (replyTo && byId.has(replyTo)) {
            current = byId.get(replyTo);
            replyTo = current.dataset.replyTo || '';
        }
        return current.dataset.shiftRowId || '';
    }

    isShiftNotebookRowInReplyThread(row, rootId) {
        return !!row && !!rootId && this.getShiftNotebookReplyRootId(row) === rootId;
    }

    updateShiftNotebookReplyBadges() {
        const rows = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'));
        rows.forEach(row => {
            const replyRows = this.getShiftNotebookReplyRowsFor(row);
            const count = replyRows.length;
            const toggle = row.querySelector('.shift-row-reply-toggle');
            const countLabel = row.querySelector('.shift-row-reply-count');
            const summary = row.querySelector('.shift-reply-collapse-summary');
            const collapsed = row.classList.contains('shift-replies-collapsed') && count > 0;
            if (toggle) {
                toggle.hidden = count === 0;
                toggle.classList.toggle('has-replies', count > 0);
                toggle.classList.toggle('collapsed', collapsed);
                toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                toggle.title = collapsed ? `返信${count}件を表示` : `返信${count}件を折りたたみ`;
            }
            if (countLabel) countLabel.textContent = String(count);
            if (summary) {
                summary.textContent = collapsed ? this.getShiftNotebookReplySummary(replyRows) : '';
                summary.hidden = !collapsed;
            }
            if (count === 0) row.classList.remove('shift-replies-collapsed');
        });
        const byId = new Map(rows.map(row => [row.dataset.shiftRowId || '', row]));
        rows.forEach(row => {
            let replyTo = row.dataset.replyTo || '';
            let collapsedByAncestor = false;
            while (replyTo) {
                const parent = byId.get(replyTo);
                if (!parent) break;
                if (parent.classList.contains('shift-replies-collapsed')) {
                    collapsedByAncestor = true;
                    break;
                }
                replyTo = parent.dataset.replyTo || '';
            }
            row.classList.toggle('shift-reply-collapsed', collapsedByAncestor);
        });
    }

    toggleShiftNotebookReplies(button) {
        const row = button?.closest('.shift-notebook-row');
        if (!row) return;
        const hasReplies = this.getShiftNotebookReplyRowsFor(row).length > 0;
        if (!hasReplies) return;
        row.classList.toggle('shift-replies-collapsed');
        this.updateShiftNotebookGroupCorners();
    }

    getShiftNotebookReplySummary(replyRows = []) {
        const names = [];
        const snippets = [];
        replyRows.forEach(row => {
            row.querySelectorAll('.shift-note-member-stamp').forEach(stamp => {
                const name = (stamp.textContent || '').trim();
                if (name && !names.includes(name)) names.push(name);
            });
            if (snippets.length < 2) {
                const text = this.stripShiftNoteHtml(row.querySelector('.shift-note-text')?.innerHTML || '').trim();
                if (text) snippets.push(`${text.slice(0, 16)}${text.length > 16 ? '…' : ''}`);
            }
        });
        const detail = names.length
            ? names.slice(0, 4).join(', ') + (names.length > 4 ? ' ほか' : '')
            : snippets.join(' / ');
        return detail ? `返信${replyRows.length}件: ${detail}` : `返信${replyRows.length}件`;
    }

    getShiftResponderNamesByFrequency() {
        const counts = new Map();
        const types = this.ensureShiftNotebookMemberTypes();
        (store.activeData.shiftNotebookGroupPresets || []).forEach(preset => {
            (preset.members || []).forEach(name => {
                const n = String(name || '').trim();
                if (!n) return;
                counts.set(n, (counts.get(n) || 0) + 1);
            });
        });
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
            .map(([name, count]) => ({ name, count, type: types[name] === 'support' ? 'support' : 'core' }));
    }

    toggleShiftResponderMenu(button) {
        this.rememberShiftNoteSelection(button);
        const row = button?.closest('.shift-notebook-row');
        const panel = row?.querySelector('.shift-responder-menu');
        if (!row || !panel) return;
        const isOpen = panel.classList.contains('open');
        document.querySelectorAll('.shift-responder-menu.open').forEach(el => el.classList.remove('open'));
        if (isOpen) return;
        const names = this.getShiftResponderNamesByFrequency().filter(item => item.type !== 'support');
        panel.innerHTML = names.length
            ? names.map(item => `<button type="button" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.insertShiftResponderStamp(this, '${this.escapeJs(item.name)}')">${this.escapeHtml(item.name)}<small>${item.count}</small></button>`).join('')
            : '<div class="shift-responder-empty">基幹社員の人名がありません</div>';
        panel.classList.add('open');
    }

    insertShiftResponderStamp(button, name) {
        const row = button?.closest('.shift-notebook-row');
        const editor = row?.querySelector('.shift-note-text');
        this.appendShiftNoteMemberStamp(editor, name);
        row?.querySelector('.shift-responder-menu')?.classList.remove('open');
    }

    getShiftCoreWorkerOptions() {
        const d = this.ensureKanbanTodoState();
        return (d.localTodoWorkers || []).map(worker => ({ id: worker.id, name: worker.name }));
    }

    getShiftCoreGroupOptions() {
        const workers = this.getShiftCoreWorkerOptions();
        const idByName = new Map(workers.map(worker => [worker.name, worker.id]));
        return (store.activeData.shiftNotebookGroupPresets || [])
            .map(preset => {
                const memberIds = (preset.members || [])
                    .map(member => idByName.get(String(member || '').trim()))
                    .filter(Boolean);
                return { name: preset.name || '名称未設定', memberIds: Array.from(new Set(memberIds)) };
            })
            .filter(group => group.memberIds.length > 0);
    }

    openShiftRowTodoRequest(button) {
        const row = button?.closest('.shift-notebook-row');
        const editing = this._editingShiftNotebook;
        if (!row || !editing) return;
        const editor = row.querySelector('.shift-note-text');
        const rowText = this.stripShiftNoteHtml(editor?.innerHTML || '').trim();
        const groupName = row.querySelector('.shift-row-group-select')?.value || '';
        const existingTodoId = this.getShiftRowActiveRequestTodoId(row);
        const existingTodo = existingTodoId
            ? (store.activeData.localTodos || []).find(todo => todo.id === existingTodoId && !todo.archived)
            : null;
        const title = existingTodo?.title || (rowText ? rowText.slice(0, 80) : `${groupName || '連絡帳'}の依頼`);
        const description = existingTodo?.description ?? rowText;
        const selectedWorkerIds = new Set(existingTodo?.assignedTo || []);
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
                        <h3>ToDoへ依頼</h3>
                        <button type="button" onclick="app.closeShiftRowTodoRequest()"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <input type="hidden" id="shift-request-row-id" value="${this.escapeHtml(row.dataset.shiftRowId || '')}">
                    <input type="hidden" id="shift-request-existing-todo-id" value="${this.escapeHtml(existingTodoId || '')}">
                    <input type="hidden" id="shift-request-date" value="${this.escapeHtml(editing.dateStr || '')}">
                    <input type="hidden" id="shift-request-shift" value="${this.escapeHtml(editing.shift || '')}">
                    <label class="shift-request-field">タイトル
                        <input type="text" id="shift-request-title" value="${this.escapeHtml(title)}">
                    </label>
                    <label class="shift-request-field">内容
                        <textarea id="shift-request-desc" rows="5">${this.escapeHtml(description)}</textarea>
                    </label>
                    <label class="shift-request-field">依頼者（任意）
                        <select id="shift-request-requester">
                            <option value="" ${existingTodo?.requestedBy ? '' : 'selected'}>現在のToDo作業員（${this.escapeHtml(this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId))}）</option>
                            ${workers.map(worker => `<option value="${this.escapeHtml(worker.id)}" ${existingTodo?.requestedBy === worker.id ? 'selected' : ''}>${this.escapeHtml(worker.name)}</option>`).join('')}
                        </select>
                    </label>
                    <label class="shift-request-field">優先度（任意）
                        <select id="shift-request-priority">
                            <option value="low" ${!existingTodo?.priority || existingTodo?.priority === 'low' ? 'selected' : ''}>低</option>
                            <option value="medium" ${existingTodo?.priority === 'medium' ? 'selected' : ''}>中</option>
                            <option value="high" ${existingTodo?.priority === 'high' ? 'selected' : ''}>高</option>
                        </select>
                    </label>
                    <div class="shift-request-group-box">
                        <div class="shift-request-box-title">班を選択</div>
                        ${groups.length ? groups.map((group, index) => {
                            const checked = existingTodo
                                ? group.memberIds.length > 0 && group.memberIds.every(id => selectedWorkerIds.has(id))
                                : index === defaultGroupIndex;
                            return `
                            <label class="shift-request-check">
                                <input type="checkbox" class="shift-request-group" value="${index}" ${checked ? 'checked' : ''}>
                                <span>${this.escapeHtml(group.name)}</span>
                                <small>${group.memberIds.map(id => this.getKanbanTodoWorkerName(id)).join(', ')}</small>
                            </label>
                        `;
                        }).join('') : '<div class="shift-request-empty">基幹社員を含む班がありません</div>'}
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
                        <button type="button" class="secondary-btn shift-request-overwrite-btn" onclick="app.overwriteShiftRowTodoRequest()" ${existingTodoId ? '' : 'disabled'}>依頼内容を上書き</button>
                        <button type="button" class="primary-btn" onclick="app.createShiftRowTodoRequest()">依頼する</button>
                    </div>
                </div>
            </div>
        `);
        document.getElementById('shift-request-title')?.focus();
        document.getElementById('shift-row-request-overlay')._groups = groups;
    }

    closeShiftRowTodoRequest() {
        document.getElementById('shift-row-request-overlay')?.remove();
    }

    getShiftRowActiveRequestTodoId(row) {
        if (!row) return '';
        const ids = Array.from(row.querySelectorAll('.shift-todo-feedback.request[data-todo-id]'))
            .map(stamp => stamp.getAttribute('data-todo-id') || '')
            .filter(Boolean)
            .reverse();
        const todos = store.activeData.localTodos || [];
        return ids.find(id => todos.some(todo => todo.id === id && !todo.archived)) || '';
    }

    collectShiftRowTodoRequestFormData() {
        const overlay = document.getElementById('shift-row-request-overlay');
        if (!overlay) return null;
        const title = (document.getElementById('shift-request-title')?.value || '').trim();
        if (!title) {
            document.getElementById('shift-request-title')?.focus();
            return null;
        }
        const selected = new Set();
        const groups = overlay._groups || [];
        Array.from(document.querySelectorAll('.shift-request-group:checked')).forEach(input => {
            (groups[Number(input.value)]?.memberIds || []).forEach(id => selected.add(id));
        });
        Array.from(document.querySelectorAll('.shift-request-member:checked')).forEach(input => selected.add(input.value));
        const assignedTo = Array.from(selected);
        if (assignedTo.length === 0) {
            alert('依頼先を選んでください。');
            return null;
        }
        return {
            title,
            description: document.getElementById('shift-request-desc')?.value || '',
            priority: document.getElementById('shift-request-priority')?.value || 'low',
            assignedTo,
            requestedBy: document.getElementById('shift-request-requester')?.value || this.kanbanTodoWorkerId,
            source: {
                dateStr: document.getElementById('shift-request-date')?.value || '',
                shift: document.getElementById('shift-request-shift')?.value || '',
                rowId: document.getElementById('shift-request-row-id')?.value || ''
            },
            existingTodoId: document.getElementById('shift-request-existing-todo-id')?.value || ''
        };
    }

    createShiftRowTodoRequest() {
        const data = this.collectShiftRowTodoRequestFormData();
        if (!data) return;
        const d = this.ensureKanbanTodoState();
        const now = new Date().toISOString();
        const todo = {
            id: `kt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title: data.title,
            description: data.description,
            priority: data.priority || 'low',
            status: 'todo',
            done: false,
            deadlineDate: '',
            deadlineTime: '',
            deadline: '',
            isRecurring: false,
            isRequest: true,
            assignedTo: data.assignedTo,
            requestedBy: data.requestedBy,
            rejectedBy: [],
            createdAt: now,
            updatedAt: now,
            shiftRequestSource: data.source
        };
        d.localTodos.unshift(todo);
        this.addKanbanTodoLog(`連絡帳から依頼: 「${todo.title}」`);
        this.appendShiftTodoFeedback(todo, 'start');
        this.syncFiveSAssigneeFromTodoRequest(todo);
        store.save();
        this.closeShiftRowTodoRequest();
        this.updateTodoRequestCountBadge();
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus('ToDoへ依頼しました', 'saved');
        if (document.getElementById('fiveS-list')) this.renderFiveSManagement();
    }

    findShiftNotebookRowByTodoSource(source = {}) {
        if (!source?.dateStr || !source?.rowId) return null;
        const dayData = store.activeData.shiftNotebooks?.[source.dateStr];
        if (!dayData) return null;
        const buckets = [];
        if (Array.isArray(dayData.sharedRows)) buckets.push(dayData.sharedRows);
        const shiftRows = this.getShiftNotebookRowsAndMembers(dayData[source.shift]).rows;
        if (Array.isArray(shiftRows)) buckets.push(shiftRows);
        for (const rows of buckets) {
            const row = rows.find(item => item?.id === source.rowId);
            if (row) return row;
        }
        return null;
    }

    syncFiveSAssigneeFromTodoRequest(todo = {}) {
        const workerId = (todo.assignedTo || []).find(id => id && id !== 'all') || '';
        if (!workerId) return false;
        const row = this.findShiftNotebookRowByTodoSource(todo.shiftRequestSource || {});
        if (!row?.fiveS) return false;
        row.fiveSAssigneeId = workerId;
        return true;
    }

    overwriteShiftRowTodoRequest() {
        const data = this.collectShiftRowTodoRequestFormData();
        if (!data || !data.existingTodoId) {
            alert('上書きできる既存依頼がありません。');
            return;
        }
        const d = this.ensureKanbanTodoState();
        const todo = d.localTodos.find(item => item.id === data.existingTodoId && !item.archived);
        if (!todo) {
            alert('上書き対象のToDoが見つかりません。新しく依頼してください。');
            return;
        }
        todo.title = data.title;
        todo.description = data.description;
        todo.priority = data.priority || 'low';
        todo.assignedTo = data.assignedTo;
        todo.requestedBy = data.requestedBy;
        todo.isRequest = true;
        todo.shiftRequestSource = data.source;
        todo.updatedAt = new Date().toISOString();
        this.appendShiftTodoFeedback(todo, 'overwrite');
        this.syncFiveSAssigneeFromTodoRequest(todo);
        this.addKanbanTodoLog(`連絡帳から依頼を上書き: 「${todo.title}」`);
        store.save();
        this.closeShiftRowTodoRequest();
        this.updateTodoRequestCountBadge();
        this.saveShiftNotebook(data.source.dateStr, data.source.shift, { close: false, render: false, status: false });
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus('ToDo依頼を上書きしました', 'saved');
        if (document.getElementById('fiveS-list')) this.renderFiveSManagement();
    }

    updateShiftTodoRequestStampWorker(todo) {
        const source = todo?.shiftRequestSource;
        if (!source?.rowId) return;
        const workerId = (todo.assignedTo || [])[0] || '';
        const row = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row')).find(item => item.dataset.shiftRowId === source.rowId);
        row?.querySelectorAll(`.shift-todo-feedback.request[data-todo-id="${CSS.escape(todo.id)}"]`).forEach(stamp => {
            if (workerId) stamp.setAttribute('data-worker-id', workerId);
            else stamp.removeAttribute('data-worker-id');
        });
    }

    openKanbanTodoFromShiftStamp(stamp) {
        const workerId = stamp?.getAttribute('data-worker-id') || '';
        if (!workerId) return;
        this.closeModal();
        this.closeShiftRowTodoRequest();
        this.changeKanbanTodoWorker(workerId);
        this.switchView('todos');
        setTimeout(() => {
            const todoId = stamp?.getAttribute('data-todo-id') || '';
            const card = todoId
                ? Array.from(document.querySelectorAll('.kt-task-card')).find(el => (el.getAttribute('onclick') || '').includes(todoId))
                : null;
            card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card?.classList.add('kt-task-card-jump');
            setTimeout(() => card?.classList.remove('kt-task-card-jump'), 4000);
            if (todoId) {
                const todo = (store.activeData.localTodos || []).find(item => item.id === todoId);
                if (todo && typeof this.showKanbanTodoJumpNotice === 'function') {
                    this.showKanbanTodoJumpNotice(todo, this.getKanbanTodoWorkerName(workerId));
                }
            }
        }, 80);
    }

    openFiveSManagementFromShiftTodoStamp(stamp) {
        const todoId = stamp?.getAttribute('data-todo-id') || '';
        if (!todoId) return;
        if (typeof this.openFiveSManagementFromTodoCard === 'function') {
            this.openFiveSManagementFromTodoCard(todoId);
        }
    }

    appendShiftTodoFeedback(todo, phase = 'start') {
        const source = todo?.shiftRequestSource;
        if (!source?.dateStr || !source?.shift || !source?.rowId) return;
        const names = (todo.assignedTo || []).map(id => this.getKanbanTodoWorkerName(id)).filter(Boolean).join(', ');
        const requesterName = todo.requestedBy ? this.getKanbanTodoWorkerName(todo.requestedBy) : '';
        const targetWorkerId = (todo.assignedTo || [])[0] || '';
        const now = new Date();
        const stamp = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const todoId = this.escapeHtml(todo.id || '');
        const workerAttr = targetWorkerId ? ` data-worker-id="${this.escapeHtml(targetWorkerId)}" onclick="app.openKanbanTodoFromShiftStamp(this)" title="対象者のToDoリストへ移動"` : '';
        const fiveSLink = this.isKanbanTodoFiveSRequest?.(todo)
            ? `<span class="shift-todo-five-s-link" data-todo-id="${todoId}" onclick="app.openFiveSManagementFromShiftTodoStamp(this)" title="5S管理でこの依頼を確認" contenteditable="false"><i class="fa-solid fa-broom"></i> 5S管理</span>`
            : '';
        const completionNote = todo.completionComment ? ` / 内容: ${todo.completionComment}` : '';
        const text = phase === 'done'
            ? `ToDo完了 ${stamp}${this.kanbanTodoWorkerId ? ` / 完了: ${this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId)}` : ''}${completionNote}`
            : (phase === 'progress'
                ? `ToDo進行中 ${stamp}${this.kanbanTodoWorkerId ? ` / 担当: ${this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId)}` : ''}`
                : (phase === 'deleted'
                    ? `○ 依頼のタスクが削除されました ${stamp}`
                    : `ToDo依頼 ${stamp}${names ? ` / 依頼先: ${names}` : ''}${requesterName ? ` / 依頼者: ${requesterName}` : ''}`));
        const feedbackHtml = phase === 'done'
            ? `<span class="shift-todo-arrow" data-todo-id="${todoId}" contenteditable="false">→</span><span class="shift-todo-feedback done" data-todo-id="${todoId}" contenteditable="false">${this.escapeHtml(text)}</span>${fiveSLink}`
            : (phase === 'progress'
                ? `<span class="shift-todo-arrow" data-todo-id="${todoId}" contenteditable="false">→</span><span class="shift-todo-feedback progress" data-todo-id="${todoId}"${workerAttr} contenteditable="false">${this.escapeHtml(text)}</span>${fiveSLink}`
                : (phase === 'deleted'
                    ? `<span class="shift-todo-arrow" data-todo-id="${todoId}" contenteditable="false">→</span><span class="shift-todo-feedback deleted" data-todo-id="${todoId}" contenteditable="false">${this.escapeHtml(text)}</span>`
                    : `<span class="shift-todo-feedback request" data-todo-id="${todoId}"${workerAttr} contenteditable="false">${this.escapeHtml(text)}</span>${fiveSLink}`));
        const htmlLine = `<br>${feedbackHtml}`;

        const appendOrCompleteInContainer = (container) => {
            if (!container) return false;
            const requestStamp = Array.from(container.querySelectorAll('.shift-todo-feedback.request'))
                .find(item => item.getAttribute('data-todo-id') === (todo.id || ''));
            const doneStamp = Array.from(container.querySelectorAll('.shift-todo-feedback.done'))
                .find(item => item.getAttribute('data-todo-id') === (todo.id || ''));
            const progressStamp = Array.from(container.querySelectorAll('.shift-todo-feedback.progress'))
                .find(item => item.getAttribute('data-todo-id') === (todo.id || ''));
            const deletedStamp = Array.from(container.querySelectorAll('.shift-todo-feedback.deleted'))
                .find(item => item.getAttribute('data-todo-id') === (todo.id || ''));
            if (phase === 'overwrite' && requestStamp) {
                requestStamp.outerHTML = feedbackHtml;
                return true;
            }
            if (phase === 'progress' && requestStamp) {
                if (!progressStamp) requestStamp.insertAdjacentHTML('afterend', feedbackHtml);
                return true;
            }
            if ((phase === 'done' || phase === 'deleted') && requestStamp) {
                const exists = phase === 'done' ? doneStamp : deletedStamp;
                if (!exists) {
                    const tail = doneStamp || deletedStamp || progressStamp || requestStamp;
                    tail.insertAdjacentHTML('afterend', feedbackHtml);
                }
                return true;
            }
            if (phase !== 'done' || !doneStamp) {
                container.insertAdjacentHTML('beforeend', htmlLine);
            }
            return true;
        };

        const modalOverlay = document.getElementById('modal-overlay');
        const isShiftNotebookOpen = !modalOverlay?.classList.contains('hidden')
            && document.querySelector('.modal-container.shift-notebook-modal')
            && this._editingShiftNotebook?.dateStr === source.dateStr
            && this._editingShiftNotebook?.shift === source.shift;
        const openRow = (isShiftNotebookOpen || this._editingShiftNotebook?.dateStr === source.dateStr)
            ? Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row')).find(item => item.dataset.shiftRowId === source.rowId)
            : null;
        const openEditor = openRow?.querySelector('.shift-note-text');
        if (appendOrCompleteInContainer(openEditor)) {
            this.resizeShiftNoteEditor(openEditor);
            requestAnimationFrame(() => {
                this.resizeShiftNoteEditor(openEditor);
                if (document.querySelector('.modal-container.shift-notebook-modal.shift-fit-all-mode')) {
                    this.adjustShiftNotebookRowsToFit();
                }
            });
            this.saveShiftNotebook(source.dateStr, source.shift, { close: false, render: false, status: false });
            return;
        }

        const dayData = store.activeData.shiftNotebooks?.[source.dateStr];
        if (!dayData) return;
        const buckets = [];
        if (Array.isArray(dayData.sharedRows)) buckets.push(dayData.sharedRows);
        const shiftRows = dayData[source.shift]?.rows;
        if (Array.isArray(shiftRows)) buckets.push(shiftRows);
        for (const rows of buckets) {
            const row = rows.find(item => item.id === source.rowId);
            if (!row) continue;
            const holder = document.createElement('div');
            const baseHtml = row.html || this.shiftNoteTextToHtml(row.text || '');
            holder.innerHTML = this.sanitizeShiftNoteHtml(baseHtml);
            appendOrCompleteInContainer(holder);
            row.html = this.sanitizeShiftNoteHtml(holder.innerHTML);
            row.text = this.stripShiftNoteHtml(row.html).trim();
            return;
        }
    }

    readShiftNotebookRowsFromDom() {
        return Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row')).map((row, index) => {
            const group = row.querySelector('.shift-row-group-select')?.value || '未設定';
            const editor = row.querySelector('.shift-note-text');
            const html = this.sanitizeShiftNoteHtml(editor?.innerHTML || '');
            const text = this.stripShiftNoteHtml(html).trim();
            const tag = row.querySelector('.shift-note-tag-select')?.value || '通常';
            const hidden = !!row.querySelector('.shift-row-hide-checkbox')?.checked;
            const important = row.classList.contains('shift-row-important');
            const fiveS = row.classList.contains('shift-row-5s');
            const pasteFormat = this.getShiftNoteRowPasteFormatSettings(row);
        const photos = Array.from(row.querySelectorAll('.shift-photo-previews .shift-photo-item')).map(item => {
            const src = item.querySelector('img')?.src || '';
            const caption = item.querySelector('.shift-photo-caption')?.value.trim() || '';
            const marks = this.parseShiftPhotoCompareMarks(item.dataset.shiftPhotoMarks || '[]');
            return (caption || marks.length) ? { src, caption, marks } : src;
        }).filter(photo => typeof photo === 'string' ? !!photo : !!photo.src);
            const suddenRegistered = row.dataset.suddenRegistered === 'true';
            const suddenHistoryId = row.dataset.suddenHistoryId || '';
            const fiveSAssigneeId = row.dataset.fiveSAssigneeId || '';
            const photoCompareMarks = this.parseShiftPhotoCompareMarks(row.dataset.shiftPhotoGlobalMarks || '[]');
            return { id: row.dataset.shiftRowId || '', replyTo: row.dataset.replyTo || '', group, tag, text, html, photos, photoCompareMarks, hidden, important, fiveS, fiveSAssigneeId, suddenRegistered, suddenHistoryId, pasteFormat, index, element: row };
        }).filter(row => row.text || row.photos.length > 0 || row.important || row.fiveS || row.suddenRegistered || row.element.dataset.preserveBlank === 'true' || row.element.querySelector('.shift-note-text') === document.activeElement);
    }

    sortShiftNotebookRowsInDom() {
        const container = document.getElementById('shift-notebook-rows');
        if (!container) return;
        const focused = document.activeElement;
        const rows = this.sortShiftNotebookRows(Array.from(container.children).map((row, index) => ({
            id: row.dataset.shiftRowId || '',
            replyTo: row.dataset.replyTo || '',
            group: row.querySelector('.shift-row-group-select')?.value || '未設定',
            index,
            element: row
        })));
        rows.forEach(row => container.appendChild(row.element));
        this.updateShiftNotebookGroupCorners();
        if (focused && document.contains(focused)) focused.focus();
    }

    toggleShiftNotebookHiddenRows() {
        this._shiftNotebookHideChecked = !this._shiftNotebookHideChecked;
        localStorage.setItem('shift_notebook_hide_checked', String(this._shiftNotebookHideChecked));
        this.updateShiftNotebookHiddenRows();
        this.setShiftNotebookStatus(this._shiftNotebookHideChecked ? 'チェック行を非表示にしました' : 'チェック行を表示しました', 'moved');
    }

    toggleShiftNotebookImportantOnly() {
        this._shiftNotebookImportantOnly = !this._shiftNotebookImportantOnly;
        localStorage.setItem('shift_notebook_important_only', String(this._shiftNotebookImportantOnly));
        this.updateShiftNotebookHiddenRows();
        this.setShiftNotebookStatus(this._shiftNotebookImportantOnly ? '重要行だけ表示しました' : '重要行フィルターを解除しました', 'moved');
    }

    clearShiftNotebookRowFilters() {
        this._shiftNotebookHideChecked = false;
        this._shiftNotebookImportantOnly = false;
        localStorage.setItem('shift_notebook_hide_checked', 'false');
        localStorage.setItem('shift_notebook_important_only', 'false');
        this.updateShiftNotebookHiddenRows();
        this.setShiftNotebookStatus('絞り込みを解除しました', 'moved');
    }

    loadShiftNotebookRowMenuHiddenParts() {
        const fallback = localStorage.getItem('shift_notebook_row_menu_hidden') === 'true';
        try {
            const saved = JSON.parse(localStorage.getItem('shift_notebook_row_menu_hidden_parts') || 'null');
            if (saved && typeof saved === 'object') {
                return {
                    group: !!saved.group,
                    format: !!saved.format,
                    actions: !!saved.actions
                };
            }
        } catch (e) {}
        return { group: fallback, format: fallback, actions: fallback };
    }

    saveShiftNotebookRowMenuHiddenParts() {
        localStorage.setItem('shift_notebook_row_menu_hidden_parts', JSON.stringify(this._shiftNotebookRowMenuHiddenParts || { group: false, format: false, actions: false }));
        localStorage.setItem('shift_notebook_row_menu_hidden', String(this.hasShiftNotebookRowMenuHiddenParts()));
    }

    hasShiftNotebookRowMenuHiddenParts() {
        const parts = this._shiftNotebookRowMenuHiddenParts || {};
        return !!(parts.group || parts.format || parts.actions);
    }

    toggleShiftNotebookRowMenus() {
        const panel = document.getElementById('shift-row-menu-settings-panel');
        if (panel) panel.hidden = !panel.hidden;
        this.syncShiftNotebookRowMenuSettingsPanel();
    }

    closeShiftNotebookRowMenuSettings() {
        const panel = document.getElementById('shift-row-menu-settings-panel');
        if (panel) panel.hidden = true;
    }

    setShiftNotebookRowMenuHiddenPart(part, hidden) {
        if (!this._shiftNotebookRowMenuHiddenParts) this._shiftNotebookRowMenuHiddenParts = { group: false, format: false, actions: false };
        if (!['group', 'format', 'actions'].includes(part)) return;
        this._shiftNotebookRowMenuHiddenParts[part] = !!hidden;
        this.saveShiftNotebookRowMenuHiddenParts();
        this.updateShiftNotebookRowMenuVisibility();
        this.setShiftNotebookStatus(this.hasShiftNotebookRowMenuHiddenParts() ? '行メニュー表示を変更しました' : '行メニューをすべて表示しました', 'moved');
    }

    setAllShiftNotebookRowMenuHiddenParts(hidden) {
        this._shiftNotebookRowMenuHiddenParts = { group: !!hidden, format: !!hidden, actions: !!hidden };
        this.saveShiftNotebookRowMenuHiddenParts();
        this.updateShiftNotebookRowMenuVisibility();
        this.syncShiftNotebookRowMenuSettingsPanel();
        this.setShiftNotebookStatus(hidden ? '行メニューをすべて非表示にしました' : '行メニューをすべて表示しました', 'moved');
    }

    syncShiftNotebookRowMenuSettingsPanel() {
        const parts = this._shiftNotebookRowMenuHiddenParts || {};
        document.querySelectorAll('#shift-row-menu-settings-panel input[data-part]').forEach(input => {
            input.checked = !!parts[input.dataset.part];
        });
    }

    updateShiftNotebookRowMenuVisibility() {
        const modal = document.querySelector('.modal-container.shift-notebook-modal');
        const parts = this._shiftNotebookRowMenuHiddenParts || {};
        const hidden = this.hasShiftNotebookRowMenuHiddenParts();
        modal?.classList.toggle('shift-hide-row-group', !!parts.group);
        modal?.classList.toggle('shift-hide-row-format', !!parts.format);
        modal?.classList.toggle('shift-hide-row-actions', !!parts.actions);
        const button = document.getElementById('shift-row-menu-toggle-btn');
        if (button) {
            button.classList.toggle('active', hidden);
            button.textContent = hidden ? '行メニュー変更中' : '行メニュー設定';
        }
        this.syncShiftNotebookRowMenuSettingsPanel();
        if (parts.format) this.closeShiftNoteFormatMenus({ commit: false });
        requestAnimationFrame(() => {
            document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => this.positionShiftImportantStamp(row));
        });
    }

    toggleShiftNotebookRowImportant(button) {
        const row = button?.closest('.shift-notebook-row');
        if (!row) return;
        const active = row.classList.toggle('shift-row-important');
        button.classList.toggle('active', active);
        requestAnimationFrame(() => this.positionShiftImportantStamp(row));
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus(active ? '重要スタンプを押しました' : '重要スタンプを外しました', 'saved');
    }

    toggleShiftNotebookRow5S(button) {
        const row = button?.closest('.shift-notebook-row');
        if (!row) return;
        const active = row.classList.toggle('shift-row-5s');
        button.classList.toggle('active', active);
        this.updateShiftNotebookRow5SStampStatus(row);
        requestAnimationFrame(() => this.positionShiftImportantStamp(row));
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus(active ? '5Sスタンプを押しました' : '5Sスタンプを外しました', 'saved');
    }

    getShiftNotebookRow5SStatusInfo(row) {
        const editing = this._editingShiftNotebook || {};
        const group = row?.querySelector('.shift-row-group-select')?.value || '未設定';
        const shared = this.isShiftNotebookThroughGroup(group);
        return {
            dateStr: editing.dateStr || '',
            shift: shared ? 'early' : (editing.shift || ''),
            rowId: row?.dataset?.shiftRowId || '',
            group,
            shared
        };
    }

    updateShiftNotebookRow5SStampStatus(row) {
        const stamp = row?.querySelector('.shift-5s-stamp');
        if (!stamp) return;
        if (!row.classList.contains('shift-row-5s')) {
            stamp.textContent = '5S';
            stamp.removeAttribute('data-open-todos');
            return;
        }
        const info = this.getShiftNotebookRow5SStatusInfo(row);
        const status = info.rowId && info.dateStr && info.shift
            ? this.getFiveSRowTodoStatus(info)
            : { openCount: 0 };
        stamp.innerHTML = `5S${status.openCount > 0 ? `<span class="shift-5s-alert" title="未完了ToDo ${status.openCount}件">${status.openCount}</span>` : ''}`;
        if (status.openCount > 0) stamp.dataset.openTodos = String(status.openCount);
        else stamp.removeAttribute('data-open-todos');
    }

    openFiveSManagementFromShiftNotebook(row = null) {
        if (row) {
            this._fiveSHighlightRowId = row.dataset.shiftRowId || '';
            this.autoSaveShiftNotebook(true);
        }
        const resetValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };
        const resetChecked = (id, checked) => {
            const el = document.getElementById(id);
            if (el) el.checked = checked;
        };
        resetValue('fiveS-filter-period', 'all');
        resetValue('fiveS-filter-shift', 'all');
        resetValue('fiveS-filter-assignee', 'all');
        resetValue('fiveS-filter-group', '');
        resetValue('fiveS-filter-query', '');
        resetChecked('fiveS-filter-photos', false);
        resetChecked('fiveS-filter-pending', false);
        this.closeModal();
        const alreadyFiveS = this.currentView === 'fiveS';
        this.switchView('fiveS');
        if (alreadyFiveS) this.renderFiveSManagement();
    }

    getShiftNotebookHiddenRowCount() {
        return Array.from(document.querySelectorAll('#shift-notebook-rows .shift-row-hide-checkbox'))
            .filter(input => input.checked).length;
    }

    updateShiftNotebookHiddenRows() {
        const active = !!this._shiftNotebookHideChecked;
        const importantOnly = !!this._shiftNotebookImportantOnly;
        const hiddenCount = this.getShiftNotebookHiddenRowCount();
        document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => {
            const checked = !!row.querySelector('.shift-row-hide-checkbox')?.checked;
            const notImportant = importantOnly && !row.classList.contains('shift-row-important');
            row.classList.toggle('shift-row-hidden-by-filter', (active && checked) || notImportant);
        });
        const button = document.getElementById('shift-hide-checked-btn');
        if (button) {
            button.classList.toggle('active', active);
            button.innerHTML = active
                ? `<i class="fa-solid fa-eye"></i> チェック表示 <span class="shift-hidden-count">${hiddenCount}件</span>`
                : `☑ チェック非表示${hiddenCount > 0 ? ` <span class="shift-hidden-count">${hiddenCount}件</span>` : ''}`;
            button.title = active
                ? '隠しているチェック行を表示します。チェック状態は残ります。'
                : `チェックした行だけ一時的に隠します。削除はしません。${hiddenCount > 0 ? `現在${hiddenCount}件が対象です。` : ''}`;
        }
        const importantButton = document.getElementById('shift-important-only-btn');
        if (importantButton) importantButton.classList.toggle('active', importantOnly);
        const clearButton = document.getElementById('shift-clear-row-filters-btn');
        if (clearButton) clearButton.hidden = !active && !importantOnly;
        const banner = document.getElementById('shift-row-filter-banner');
        if (banner) {
            const filters = [];
            if (active) filters.push(`<i class="fa-solid fa-eye-slash"></i> チェック行を非表示${hiddenCount ? ` ${hiddenCount}件` : ''}`);
            if (importantOnly) filters.push('<i class="fa-solid fa-star"></i> 重要だけ表示中');
            banner.hidden = filters.length === 0;
            banner.innerHTML = filters.join('<span class="shift-row-filter-sep"></span>');
        }
        this.updateShiftNotebookGroupCorners();
    }

    updateShiftNotebookGroupCorners() {
        const rows = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'));
        this.updateShiftNotebookReplyBadges();
        const visibleRows = rows.filter(row => !row.classList.contains('shift-row-hidden-by-filter') && !row.classList.contains('shift-reply-collapsed'));
        rows.forEach(row => {
            row.classList.remove('same-group-prev', 'same-group-next', 'shift-group-start');
            const heading = row.querySelector('.shift-row-group-heading');
            if (heading) heading.hidden = true;
        });
        visibleRows.forEach((row, index) => {
            const group = this.getShiftNotebookRowGroup(row);
            const prevGroup = visibleRows[index - 1] ? this.getShiftNotebookRowGroup(visibleRows[index - 1]) : null;
            const nextGroup = visibleRows[index + 1] ? this.getShiftNotebookRowGroup(visibleRows[index + 1]) : null;
            const isGroupStart = prevGroup !== group;
            row.classList.toggle('same-group-prev', prevGroup === group);
            row.classList.toggle('same-group-next', nextGroup === group);
            row.classList.toggle('shift-group-start', isGroupStart);
            const heading = row.querySelector('.shift-row-group-heading');
            if (heading) {
                heading.textContent = group;
                heading.hidden = !isGroupStart;
                const isThrough = this.isShiftNotebookThroughGroup(group);
                heading.classList.toggle('through-group-heading', isThrough);
                heading.title = '';
                heading.dataset.tooltip = isThrough
                    ? '貫通表示: この行は早番・遅番・深夜番すべての連絡帳に同じ内容で表示されます。どのシフトで編集しても共通の行として保存されます。'
                    : '';
            }
        });
    }

    scheduleShiftNotebookAutoSave() {
        clearTimeout(this._shiftNotebookAutoSaveTimer);
        this.setShiftNotebookStatus('保存待ち', 'saving');
        if (document.querySelector('.modal-container.shift-notebook-modal.shift-fit-all-mode')) {
            clearTimeout(this._shiftNotebookFitTimer);
            this._shiftNotebookFitTimer = setTimeout(() => this.adjustShiftNotebookRowsToFit(), 120);
        }
        this._shiftNotebookAutoSaveTimer = setTimeout(() => this.autoSaveShiftNotebook(false), 500);
    }

    autoSaveShiftNotebook(immediate = false) {
        const editing = this._editingShiftNotebook;
        if (!editing || !document.getElementById('shift-notebook-rows')) return;
        this.updateUnusedBlankShiftNotebookRowCount();
        clearTimeout(this._shiftNotebookAutoSaveTimer);
        const run = () => this.saveShiftNotebook(editing.dateStr, editing.shift, { close: false, render: true, status: true });
        this.setShiftNotebookStatus('保存中', 'saving');
        if (immediate) run();
        else this._shiftNotebookAutoSaveTimer = setTimeout(run, 500);
    }

    saveShiftNotebook(dateStr, shift, options = { close: true, render: true }) {
        if (!store.activeData.shiftNotebooks) store.activeData.shiftNotebooks = {};
        const members = this.getShiftGroupMembersFromInput();
        const absentMembers = Array.isArray(this._shiftNotebookAbsentMembers)
            ? this._shiftNotebookAbsentMembers.map(member => String(member || '').trim()).filter(Boolean)
            : [];
        const allRows = this.sortShiftNotebookRows(this.readShiftNotebookRowsFromDom()).map(({ element, index, ...row }) => row);
        const sharedRows = allRows.filter(row => this.isShiftNotebookThroughGroup(row.group));
        const rows = allRows.filter(row => !this.isShiftNotebookThroughGroup(row.group));

        if (!store.activeData.shiftNotebooks[dateStr]) store.activeData.shiftNotebooks[dateStr] = {};
        const previousShiftData = store.activeData.shiftNotebooks[dateStr][shift];
        const keepInherited = this.isShiftNotebookInheritedOnly(previousShiftData)
            && rows.length === 0
            && members.join('\n') === (previousShiftData.members || []).join('\n');
        store.activeData.shiftNotebooks[dateStr].sharedRows = sharedRows;
        store.activeData.shiftNotebooks[dateStr][shift] = {
            members,
            absentMembers,
            rows,
            inheritedMembers: keepInherited,
            inheritedFrom: keepInherited ? previousShiftData.inheritedFrom || '' : ''
        };
        if (!keepInherited) {
            if (members.length > 0) this.syncShiftNotebookWeekGroupPreset(dateStr, shift, this.getShiftNotebookWeekGroupMembersForSync(members));
            else this.clearShiftNotebookWeekInheritedGroupPreset(dateStr, shift);
        }

        if (Object.values(store.activeData.shiftNotebooks[dateStr]).every(v => {
            if (Array.isArray(v)) return v.length === 0;
            return (!Array.isArray(v?.rows) || v.rows.length === 0)
                && (!Array.isArray(v?.members) || v.members.length === 0)
                && (!Array.isArray(v?.absentMembers) || v.absentMembers.length === 0);
        }) && (!Array.isArray(store.activeData.shiftNotebooks[dateStr].sharedRows) || store.activeData.shiftNotebooks[dateStr].sharedRows.length === 0)) {
            delete store.activeData.shiftNotebooks[dateStr];
        }

        const saved = store.save();
        if (options.status) {
            Promise.resolve(saved)
                .then(() => {
                    const message = options.statusMessage || '保存済み';
                    this.setShiftNotebookStatus(message, 'saved');
                    if (options.noticeMessage) this.showShiftNotebookNotice(options.noticeMessage, 'saved');
                })
                .catch(() => this.setShiftNotebookStatus('保存失敗', 'error'));
        }
        if (options.close !== false) {
            this._editingShiftNotebook = null;
            this.closeModal();
        }
        if (options.render !== false) this.renderCalendar();
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppShiftNotebookCoreMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppShiftNotebookCoreMethods.prototype[name];
        }
    }
})();
