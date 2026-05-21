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
            members: Array.isArray(notebookData?.members) ? notebookData.members : []
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
        const { rows, members } = this.getShiftNotebookRowsAndMembers(notebookData);
        const sharedRows = Array.isArray(dayData?.sharedRows) ? dayData.sharedRows : [];
        return {
            rows: [...sharedRows, ...rows],
            members
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
        return { start: '', end: '', label: '全期間' };
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
                    results.push({ dateStr, shift, label, members, text, html, tag, group, photos, index });
                });

                if (rows.length === 0 && members.length > 0) {
                    const searchable = `${dateStr} ${label.name} ${label.stamp} ${members.join(' ')}`;
                    if (this.matchesSearchTerms(searchable, terms)) {
                        results.push({ dateStr, shift, label, members, text: '', tag: '通常', group: '未設定', photos: [], index: 0 });
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

        this.collectShiftNotebookSearchResults(query, period).forEach(result => {
            results.push({ ...result, type: 'notebook', typeLabel: '連絡帳', date: result.dateStr });
        });

        Object.entries(store.activeData.memos || {}).forEach(([dateStr, memo]) => {
            if (!this.matchesNotebookSearchPeriod(dateStr, period)) return;
            const text = String(memo || '').trim();
            if (!text) return;
            if (!this.matchesSearchTerms(`${dateStr} メモ ${text}`, terms)) return;
            results.push({
                type: 'memo',
                typeLabel: 'メモ',
                date: dateStr,
                title: `${dateStr} メモ`,
                text,
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
                typeLabel,
                date: h.date || '',
                title,
                text: body || title,
                sub: `${machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし'}${workers ? ` / ${workers}` : ''}`,
                historyKind: h.isDokatei ? 'dokatei' : (h.taskId ? 'periodic' : (h.isNonProductionStop ? 'nonProductionStop' : 'sudden')),
                openAction: `app.closeModal(); app.openHistoryEditForm('${this.escapeJs(h.id)}')`
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
                typeLabel: '定期メンテ',
                date: dateStr,
                title: task.content || '定期メンテ',
                text: task.periodDays ? `${task.periodDays}日周期` : '単発予定',
                sub: machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし',
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
                typeLabel: todo.isRequest ? 'ToDo依頼' : 'ToDo',
                date,
                title: todo.title || '無題のToDo',
                text: todo.description || statusLabel || '詳細なし',
                sub: `${statusLabel}${assigned ? ` / 依頼先: ${assigned}` : ''}${requester ? ` / 依頼者: ${requester}` : ''}`,
                openAction: `app.closeModal(); app.openKanbanTodoFromSearch('${this.escapeJs(todo.id)}')`
            });
        });

        return results.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.typeLabel.localeCompare(b.typeLabel, 'ja'));
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
            ['task', '定期メンテ', typeCounts.task || 0]
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
                        task: 'fa-wrench'
                    };
                    return `
                        <article class="notebook-search-result unified ${this.escapeHtml(result.type)}" data-search-type="${this.escapeHtml(result.type)}">
                            <div class="notebook-search-meta">
                                <span class="unified-search-type ${this.escapeHtml(result.type)}"><i class="fa-solid ${iconMap[result.type] || 'fa-circle-info'}"></i> ${this.escapeHtml(result.typeLabel)}</span>
                                <div>
                                    <div class="notebook-search-date">${this.escapeHtml(result.date || '日付なし')} ${this.escapeHtml(result.title || '')}</div>
                                    ${result.sub ? `<div class="notebook-search-members">${this.escapeHtml(result.sub)}</div>` : ''}
                                </div>
                                ${result.openAction ? `<button type="button" class="secondary-btn notebook-search-open" onclick="${result.openAction}"><i class="fa-solid fa-arrow-up-right-from-square"></i> 開く</button>` : ''}
                            </div>
                            <div class="notebook-search-body single">
                                <div class="notebook-search-text">
                                    ${this.highlightUnifiedSearchText(result.text || result.title || '', query)}
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
                return `
                    <article class="notebook-search-result" data-search-type="notebook" style="${this.getShiftNotebookRowGroupStyle(result.group)}">
                        <div class="notebook-search-meta">
                            <span class="unified-search-type notebook"><i class="fa-solid fa-book-open"></i> 連絡帳</span>
                            <span class="shift-notebook-badge ${result.shift}">${result.label.stamp}</span>
                            <div>
                                <div class="notebook-search-date">${result.dateStr} ${result.label.name}</div>
                                <div class="notebook-search-members"><i class="fa-solid fa-users"></i> ${this.escapeHtml(members)}</div>
                            </div>
                            <button type="button" class="secondary-btn notebook-search-open" onclick="app.closeModal(); app.openShiftNotebookModal('${result.dateStr}', '${result.shift}', ${result.index}, '${query.replace(/'/g, "\\'")}')">
                                <i class="fa-solid fa-pen-to-square"></i> 開く
                            </button>
                        </div>
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
                </div>
                <div class="notebook-search-tabs">
                    ${searchTabs.map(([type, label, count], index) => `
                        <button type="button" class="${index === 0 ? 'active' : ''}" onclick="app.filterUnifiedSearchTab('${type}', this)">
                            ${label}<b>${count}</b>
                        </button>
                    `).join('')}
                </div>
                <div class="notebook-search-results">${resultHtml}</div>
            `;
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
        });
    }

    filterUnifiedSearchTab(type = 'all', button = null) {
        document.querySelectorAll('.notebook-search-tabs button').forEach(btn => btn.classList.toggle('active', btn === button));
        document.querySelectorAll('.notebook-search-result[data-search-type]').forEach(item => {
            item.hidden = type !== 'all' && item.dataset.searchType !== type;
        });
    }

    openShiftNotebookModal(dateStr, shift, focusRowIndex = null, focusQuery = '') {
        this._activeShiftNoteEditor = null;
        const label = this.getShiftNotebookLabel(shift);
        if (!store.activeData.shiftNotebooks) store.activeData.shiftNotebooks = {};
        if (!store.activeData.shiftNotebookGroupPresets) store.activeData.shiftNotebookGroupPresets = [];
        const dayData = store.activeData.shiftNotebooks[dateStr] || {};
        const { rows, members } = this.getShiftNotebookRowsForShift(dayData, shift);
        const [year, month, day] = dateStr.split('-');
        this._editingShiftNotebook = { dateStr, shift };
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
                        <input type="text" id="shift-modal-unified-search" placeholder="横断検索...">
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
                                <input type="text" id="shift-group-members" class="shift-group-input" value="${this.escapeHtml(members.join(', '))}" placeholder="メンバーをカンマ区切りで入力" oninput="app.updateShiftGroupChant()">
                                <div id="shift-group-chant-display" class="shift-group-chant-display"></div>
                                <div id="shift-absence-manage" class="shift-absence-manage hidden"></div>
                            </div>
                        </div>
                        <div class="shift-preset-panel">
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
                            <span class="shift-toolbar-category">表示</span>
                            <button type="button" id="shift-hide-checked-btn" class="secondary-btn shift-hide-checked-btn" onclick="app.toggleShiftNotebookHiddenRows()" title="チェックを入れた行を一時的に非表示にします。行は削除されず、全表示で戻せます。">
                                ☑ 非表示
                            </button>
                            <button type="button" id="shift-important-only-btn" class="secondary-btn shift-important-only-btn" onclick="app.toggleShiftNotebookImportantOnly()" title="重要スタンプの行だけ表示します。">
                                重 重要のみ
                            </button>
                            <button type="button" id="shift-clear-row-filters-btn" class="secondary-btn shift-clear-row-filters-btn" onclick="app.clearShiftNotebookRowFilters()" title="行の表示フィルターをすべて解除します。" hidden>
                                全表示
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
                    <div class="shift-notebook-toolbar-row shift-notebook-toolbar-actions">
                        <div id="shift-row-group-stamps" class="shift-row-group-stamps" aria-label="行グループスタンプ">
                            <span class="shift-row-group-stamps-label">行挿入用看板（ドラッグして行挿入）</span>
                            ${this.getShiftRowGroupStampButtonsHtml()}
                        </div>
                        <button type="button" class="secondary-btn" onclick="app.addShiftNotebookRowWithLastGroup('shift-notebook-rows')">
                            <i class="fa-solid fa-plus"></i> 行を追加
                        </button>
                        <span class="shift-toolbar-category">テンプレート</span>
                        <button type="button" class="secondary-btn shift-clear-all-rows-btn" onclick="app.clearShiftNotebookRows()" title="現在表示中の全ての行を削除します">
                            <i class="fa-solid fa-trash-can"></i> 一括削除
                        </button>
                        <select id="shift-row-template-select" class="shift-row-template-select" onchange="app.addShiftNotebookRowFromTemplate(this.value); this.value=''">
                            ${this.getShiftRowTemplateOptions()}
                        </select>
                        <button type="button" class="secondary-btn shift-row-set-template-save" onclick="app.saveShiftNotebookRowSetTemplate()">
                            <i class="fa-solid fa-layer-group"></i> 行セット保存
                        </button>
                        <button type="button" class="secondary-btn" onclick="app.openShiftRowTemplateManageModal()">
                            <i class="fa-solid fa-list-check"></i> テンプレート管理
                        </button>
                        <button type="button" class="secondary-btn" onclick="app.togglePreviousShiftRowsPanel()">
                            <i class="fa-solid fa-copy"></i> 前シフトからコピー
                        </button>
                        <button type="button" id="shift-compact-rows-btn" class="secondary-btn shift-compact-rows-btn ${this._shiftNotebookCompactRows ? 'active' : ''}" onclick="app.toggleShiftNotebookCompactRows()" title="行の高さを詰めて表示します">
                            <i class="fa-solid fa-compress"></i> ${this._shiftNotebookCompactRows ? '標準行' : '省スペース'}
                        </button>
                        <button type="button" id="shift-fit-all-btn" class="secondary-btn shift-fit-all-btn" onclick="app.toggleShiftNotebookFitAll()" title="現在の行を画面内に収まるよう自動調整します">
                            <i class="fa-solid fa-compress"></i> 全行表示
                        </button>
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
                    const rowEl = this.addShiftNotebookRow(rowContainerId, row.text || '', row.photos || [], row.tag || '通常', row.group || '未設定', row.html || '', !!row.hidden, true, row.id || '', row.replyTo || '', !!row.important, row.pasteFormat || null);
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
            if (button) button.innerHTML = '<i class="fa-solid fa-compress"></i> 全行表示';
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
            button.innerHTML = `<i class="fa-solid fa-compress"></i> ${this._shiftNotebookCompactRows ? '標準行' : '省スペース'}`;
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
            return caption ? { src, caption } : src;
        }).filter(photo => typeof photo === 'string' ? !!photo : !!photo.src);
        return {
            id: row.dataset.shiftRowId || '',
            replyTo: row.dataset.replyTo || '',
            group: row.querySelector('.shift-row-group-select')?.value || '未設定',
            tag: row.querySelector('.shift-note-tag-select')?.value || '通常',
            text,
            html,
            photos,
            hidden: !!row.querySelector('.shift-row-hide-checkbox')?.checked,
            important: row.classList.contains('shift-row-important'),
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
                const { rows, members } = this.getShiftNotebookRowsForShift(dayData, s);
                const hasRows = (rows || []).some(row => (row?.text || '').trim() || (Array.isArray(row?.photos) && row.photos.length > 0));
                const hasMembers = (members || []).length > 0;
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
                const { rows, members } = this.getShiftNotebookRowsForShift(dayData, s);
                const hasRows = (rows || []).some(row => (row?.text || '').trim() || (Array.isArray(row?.photos) && row.photos.length > 0));
                const hasMembers = (members || []).length > 0;
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
        if (members.length === 0) {
            display.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-light);">※メンバーを入力すると安全唱和の担当者が自動で割り当てられます</span>';
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
        }).join('');

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
        this.updateShiftGroupChant();
        input.focus();
    }

    getPreviousDateStr(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() - 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
        this.updateShiftGroupChant();
        input.focus();
    }

    removeShiftAbsentMember() {
        const input = document.getElementById('shift-group-members');
        if (!input) return;
        const panel = document.getElementById('shift-absence-manage');
        if (!panel) return;
        panel.classList.toggle('hidden');
        this.updateShiftGroupChant();
    }

    removeShiftMemberByName(name) {
        const input = document.getElementById('shift-group-members');
        if (!input || !name) return;
        const target = MaintenanceStore.toHalfWidthLower(name);
        const members = this.getShiftGroupMembersFromInput();
        const filtered = members.filter(member => MaintenanceStore.toHalfWidthLower(member) !== target);
        input.value = filtered.join(', ');
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
                    上にあるグループほど、連絡帳の上に表示されます。未設定は常に先頭です。
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
        if (typeof photo === 'string') return { src: photo, caption: '' };
        return {
            src: photo?.src || photo?.url || photo?.data || '',
            caption: photo?.caption || ''
        };
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
                important: !!data?.important
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
            isBlankRow: !!data.isBlankRow,
            isRowSet: !!data.isRowSet,
            rows: Array.isArray(data.rows) ? data.rows.map(row => ({
                group: row.group || '未設定',
                tag: row.tag || '通常',
                text: row.text || '',
                html: row.html || '',
                photos: Array.isArray(row.photos) ? row.photos : [],
                important: !!row.important
            })) : undefined
        });
        store.save();
        this.refreshShiftRowTemplateSelect();
        this.setShiftNotebookStatus('テンプレートを保存しました', 'saved');
    }

    addShiftNotebookRowFromTemplate(templateId) {
        if (!templateId) return;
        const template = (store.activeData.shiftNotebookRowTemplates || []).find(t => t.id === templateId);
        if (!template) return;
        this.removeOnlyBlankUnsetShiftNotebookRow();
        if (template.isRowSet) {
            const rows = Array.isArray(template.rows) && template.rows.length > 0 ? template.rows : [{ group: template.group || '未設定', tag: template.tag || '通常' }];
            const addedRows = rows.map(row => this.addShiftNotebookRow('shift-notebook-rows', row.text || '', row.photos || [], row.tag || '通常', row.group || this.lastShiftNotebookRowGroup || '未設定', row.html || '', false, true, '', '', !!row.important))
                .filter(Boolean);
            addedRows.forEach((rowEl, index) => this.setShiftNoteRowPasteFormatSettings(rowEl, rows[index]?.pasteFormat || {}));
            this.sortShiftNotebookRowsInDom();
            addedRows[0]?.querySelector('.shift-note-text')?.focus();
            this.autoSaveShiftNotebook(true);
            this.setShiftNotebookStatus(`${rows.length}行の行セットを追加しました`, 'saved');
            return;
        }
        const isBlankRow = !!template.isBlankRow;
        this.addShiftNotebookRow('shift-notebook-rows', isBlankRow ? '' : (template.text || ''), isBlankRow ? [] : (template.photos || []), template.tag || '通常', template.group || this.lastShiftNotebookRowGroup || '未設定', isBlankRow ? '' : (template.html || ''), false, true, '', '', !!template.important);
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
        return true;
    }

    openShiftRowTemplateManageModal() {
        if (!store.activeData.shiftNotebookRowTemplates) store.activeData.shiftNotebookRowTemplates = [];
        this.openModal('shift-row-template-manage', '連絡帳テンプレート管理', () => {
            const content = document.getElementById('modal-content');
            const render = () => {
                const templates = store.activeData.shiftNotebookRowTemplates || [];
                content.innerHTML = `
                    <div class="shift-template-manage-list">
                        ${templates.length === 0 ? '<div class="shift-template-empty">保存済みテンプレートはありません</div>' : templates.map((template, index) => {
                            const isBlankRow = !!template.isBlankRow;
                            const isRowSet = !!template.isRowSet;
                            const rowSetRows = Array.isArray(template.rows) ? template.rows : [];
                            const rowSetSummary = this.getShiftRowSetSummary(rowSetRows);
                            const kindLabel = this.getShiftRowTemplateKindLabel(template);
                            const text = isRowSet ? (rowSetSummary || '行セット') : (isBlankRow ? '空行テンプレート' : (template.text || this.stripShiftNoteHtml(template.html || '').trim() || '本文なし'));
                            const photoCount = Array.isArray(template.photos) ? template.photos.length : 0;
                            return `
                                <div class="shift-template-manage-item">
                                    <div class="shift-template-manage-main">
                                        <b>${this.escapeHtml(template.name || '名称未設定')}</b>
                                        <span>${this.escapeHtml(kindLabel)} / ${this.escapeHtml(text).slice(0, 90)}</span>
                                        <div class="shift-template-preview" style="${this.getShiftNotebookRowGroupStyle(template.group || '未設定')}">
                                            ${isRowSet ? `
                                                <div class="shift-template-rowset-preview">
                                                    ${rowSetRows.map(row => {
                                                        const rowText = row.text || this.stripShiftNoteHtml(row.html || '').trim();
                                                        const rowPhotos = Array.isArray(row.photos) ? row.photos : [];
                                                        return `<span class="shift-template-rowset-chip" style="${this.getShiftNotebookRowGroupStyle(row.group || '未設定')}"><b>${this.escapeHtml(row.group || '未設定')}</b>${rowText ? `<small>${this.escapeHtml(rowText).slice(0, 24)}</small>` : (rowPhotos.length ? `<small>写真 ${rowPhotos.length}枚</small>` : '')}</span>`;
                                                    }).join('')}
                                                </div>
                                            ` : `
                                                <div class="shift-template-preview-text">
                                                    ${isBlankRow ? '<span class="shift-template-blank-label">空の行として追加</span>' : (template.html ? this.sanitizeShiftNoteHtml(template.html) : this.shiftNoteTextToHtml(template.text || ''))}
                                                </div>
                                            `}
                                            ${!isBlankRow && photoCount ? `<div class="shift-template-preview-photos"><i class="fa-solid fa-image"></i> 写真 ${photoCount}枚</div>` : ''}
                                        </div>
                                    </div>
                                    <div class="shift-template-manage-actions">
                                        <button type="button" class="icon-btn" title="上へ" onclick="app.moveShiftRowTemplate(${index}, -1)"><i class="fa-solid fa-chevron-up"></i></button>
                                        <button type="button" class="icon-btn" title="下へ" onclick="app.moveShiftRowTemplate(${index}, 1)"><i class="fa-solid fa-chevron-down"></i></button>
                                        <button type="button" class="secondary-btn" onclick="app.renameShiftRowTemplate(${index})">名前変更</button>
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
                    const hasReplies = rows.some(item => item.replyTo && item.replyTo === row.id);
                    const badges = [
                        isHidden ? '<span class="shift-previous-copy-badge done">チェック済</span>' : '',
                        isImportant ? '<span class="shift-previous-copy-badge important">重要</span>' : '',
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

    addShiftNotebookRow(containerId, text = '', photos = [], tag = '通常', group = '未設定', html = '', hidden = false, preserveBlank = true, savedRowId = '', replyTo = '', important = false, pasteFormat = null) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (group) this.lastShiftNotebookRowGroup = group;
        const rowId = savedRowId || `shift-row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const row = document.createElement('div');
        row.className = 'shift-notebook-row';
        if (important) row.classList.add('shift-row-important');
        const suddenRegistered = !!arguments[12];
        const suddenHistoryId = arguments[13] || '';
        if (suddenRegistered) row.classList.add('shift-row-sudden-registered');
        row.dataset.shiftRowId = rowId;
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
                <label class="shift-photo-btn" for="${rowId}-photo" title="写真を追加" aria-label="写真を追加">
                    <i class="fa-solid fa-camera" aria-hidden="true"></i>
                </label>
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
        });
        dragHandle?.addEventListener('dragend', () => {
            row.classList.remove('dragging');
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
        editor.addEventListener('input', () => this.scheduleShiftNotebookAutoSave());
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
            div.insertAdjacentHTML('beforeend', `
                <input type="text" class="shift-photo-caption" value="${this.escapeHtml(photoData.caption)}" placeholder="写真メモ">
            `);
            div.querySelector('.shift-photo-caption')?.addEventListener('input', () => this.scheduleShiftNotebookAutoSave());
            div.querySelector('.shift-photo-caption')?.addEventListener('blur', () => this.autoSaveShiftNotebook(true));
            preview.appendChild(div);
        };
        (photos || []).forEach(appendPreview);

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
                this.autoSaveShiftNotebook(true);
                this.showShiftNotebookUndoNotice('行を空にしました', () => {
                    if (!rowData) return;
                    this.addShiftNotebookRow(containerId, rowData.text, rowData.photos, rowData.tag, rowData.group, rowData.html, rowData.hidden, true, rowData.id, rowData.replyTo, !!rowData.important, rowData.pasteFormat || null);
                    const restored = container.lastElementChild;
                    if (restored && row.parentNode) {
                        row.replaceWith(restored);
                    }
                    this.updateShiftNotebookGroupCorners();
                    this.autoSaveShiftNotebook(true);
                });
                return;
            }
            deleteRows.forEach(targetRow => targetRow.remove());
            this.updateShiftNotebookGroupCorners();
            this.autoSaveShiftNotebook(true);
            this.showShiftNotebookUndoNotice(replyDeleteCount > 0 ? `行と返信${replyDeleteCount}件を削除しました` : '行を削除しました', () => {
                if (!rowDataList.length) return;
                this.restoreShiftNotebookRowsFromData(containerId, rowDataList, nextSibling);
                this.updateShiftNotebookGroupCorners();
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
            this.autoSaveShiftNotebook(true);
        };
        row.querySelector('.shift-row-group-select')?.addEventListener('change', () => {
            row.dataset.preserveBlank = 'true';
            this.autoSaveShiftNotebook(true);
            this.sortShiftNotebookRowsInDom();
        });
        row.querySelector('.shift-row-hide-checkbox')?.addEventListener('change', () => {
            this.updateShiftNotebookHiddenRows();
            this.autoSaveShiftNotebook(true);
        });
        return row;
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
            event.dataTransfer.setData('text/plain', this._draggingShiftRowGroupStamp);
        }
        event?.currentTarget?.classList.add('dragging');
    }

    finishShiftRowGroupStampDrag() {
        this._draggingShiftRowGroupStamp = null;
        document.querySelectorAll('.shift-row-group-stamp.dragging').forEach(el => el.classList.remove('dragging'));
        document.querySelectorAll('.shift-row-group-trash.drag-over').forEach(el => el.classList.remove('drag-over'));
        this.clearShiftNotebookDragIndicators();
        document.getElementById('shift-notebook-rows')?.classList.remove('shift-stamp-drop-empty');
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
    }

    finishShiftMemberStampDrag() {
        this._draggingShiftMemberStamp = null;
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
        const canDelete = group !== '未設定' && !this.isShiftNotebookThroughGroup(group);
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
            const restored = this.addShiftNotebookRow(containerId, data.text, data.photos, data.tag, data.group, data.html, data.hidden, true, data.id, data.replyTo, !!data.important, data.pasteFormat || null, !!data.suddenRegistered, data.suddenHistoryId || '');
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
        store.save();
        this.closeShiftRowTodoRequest();
        this.updateTodoRequestCountBadge();
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus('ToDoへ依頼しました', 'saved');
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
        this.addKanbanTodoLog(`連絡帳から依頼を上書き: 「${todo.title}」`);
        store.save();
        this.closeShiftRowTodoRequest();
        this.updateTodoRequestCountBadge();
        this.saveShiftNotebook(data.source.dateStr, data.source.shift, { close: false, render: false, status: false });
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus('ToDo依頼を上書きしました', 'saved');
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
            setTimeout(() => card?.classList.remove('kt-task-card-jump'), 1800);
        }, 80);
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
        const text = phase === 'done'
            ? `ToDo完了 ${stamp}${this.kanbanTodoWorkerId ? ` / 完了: ${this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId)}` : ''}`
            : (phase === 'progress'
                ? `ToDo進行中 ${stamp}${this.kanbanTodoWorkerId ? ` / 担当: ${this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId)}` : ''}`
                : (phase === 'deleted'
                    ? `○ 依頼のタスクが削除されました ${stamp}`
                    : `ToDo依頼 ${stamp}${names ? ` / 依頼先: ${names}` : ''}${requesterName ? ` / 依頼者: ${requesterName}` : ''}`));
        const feedbackHtml = phase === 'done'
            ? `<span class="shift-todo-arrow" data-todo-id="${todoId}" contenteditable="false">→</span><span class="shift-todo-feedback done" data-todo-id="${todoId}" contenteditable="false">${this.escapeHtml(text)}</span>`
            : (phase === 'progress'
                ? `<span class="shift-todo-arrow" data-todo-id="${todoId}" contenteditable="false">→</span><span class="shift-todo-feedback progress" data-todo-id="${todoId}"${workerAttr} contenteditable="false">${this.escapeHtml(text)}</span>`
                : (phase === 'deleted'
                    ? `<span class="shift-todo-arrow" data-todo-id="${todoId}" contenteditable="false">→</span><span class="shift-todo-feedback deleted" data-todo-id="${todoId}" contenteditable="false">${this.escapeHtml(text)}</span>`
                    : `<span class="shift-todo-feedback request" data-todo-id="${todoId}"${workerAttr} contenteditable="false">${this.escapeHtml(text)}</span>`));
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
            const pasteFormat = this.getShiftNoteRowPasteFormatSettings(row);
            const photos = Array.from(row.querySelectorAll('.shift-photo-previews .shift-photo-item')).map(item => {
                const src = item.querySelector('img')?.src || '';
                const caption = item.querySelector('.shift-photo-caption')?.value.trim() || '';
                return caption ? { src, caption } : src;
            }).filter(photo => typeof photo === 'string' ? !!photo : !!photo.src);
            const suddenRegistered = row.dataset.suddenRegistered === 'true';
            const suddenHistoryId = row.dataset.suddenHistoryId || '';
            return { id: row.dataset.shiftRowId || '', replyTo: row.dataset.replyTo || '', group, tag, text, html, photos, hidden, important, suddenRegistered, suddenHistoryId, pasteFormat, index, element: row };
        }).filter(row => row.text || row.photos.length > 0 || row.important || row.suddenRegistered || row.element.dataset.preserveBlank === 'true' || row.element.querySelector('.shift-note-text') === document.activeElement);
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
        this.setShiftNotebookStatus(this._shiftNotebookHideChecked ? 'チェック行を非表示にしました' : '全行を表示しました', 'moved');
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
        this.setShiftNotebookStatus('全行を表示しました', 'moved');
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
                ? `<i class="fa-solid fa-eye"></i> 全表示 <span class="shift-hidden-count">${hiddenCount}件</span>`
                : `☑ 非表示${hiddenCount > 0 ? ` <span class="shift-hidden-count">${hiddenCount}件</span>` : ''}`;
            button.title = active
                ? '非表示にした行をもう一度表示します。チェック状態は残ります。'
                : `チェックを入れた行を一時的に非表示にします。行は削除されず、全表示で戻せます。${hiddenCount > 0 ? `現在${hiddenCount}件が対象です。` : ''}`;
        }
        const importantButton = document.getElementById('shift-important-only-btn');
        if (importantButton) importantButton.classList.toggle('active', importantOnly);
        const clearButton = document.getElementById('shift-clear-row-filters-btn');
        if (clearButton) clearButton.hidden = !active && !importantOnly;
        const banner = document.getElementById('shift-row-filter-banner');
        if (banner) {
            const filters = [];
            if (active) filters.push(`<i class="fa-solid fa-eye-slash"></i> チェック済み非表示${hiddenCount ? ` ${hiddenCount}件` : ''}`);
            if (importantOnly) filters.push('<i class="fa-solid fa-star"></i> 重要のみ表示中');
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
        clearTimeout(this._shiftNotebookAutoSaveTimer);
        const run = () => this.saveShiftNotebook(editing.dateStr, editing.shift, { close: false, render: true, status: true });
        this.setShiftNotebookStatus('保存中', 'saving');
        if (immediate) run();
        else this._shiftNotebookAutoSaveTimer = setTimeout(run, 500);
    }

    saveShiftNotebook(dateStr, shift, options = { close: true, render: true }) {
        if (!store.activeData.shiftNotebooks) store.activeData.shiftNotebooks = {};
        const members = this.getShiftGroupMembersFromInput();
        const allRows = this.sortShiftNotebookRows(this.readShiftNotebookRowsFromDom()).map(({ element, index, ...row }) => row);
        const sharedRows = allRows.filter(row => this.isShiftNotebookThroughGroup(row.group));
        const rows = allRows.filter(row => !this.isShiftNotebookThroughGroup(row.group));

        if (!store.activeData.shiftNotebooks[dateStr]) store.activeData.shiftNotebooks[dateStr] = {};
        store.activeData.shiftNotebooks[dateStr].sharedRows = sharedRows;
        store.activeData.shiftNotebooks[dateStr][shift] = { members, rows };

        if (Object.values(store.activeData.shiftNotebooks[dateStr]).every(v => {
            if (Array.isArray(v)) return v.length === 0;
            return (!Array.isArray(v?.rows) || v.rows.length === 0) && (!Array.isArray(v?.members) || v.members.length === 0);
        }) && (!Array.isArray(store.activeData.shiftNotebooks[dateStr].sharedRows) || store.activeData.shiftNotebooks[dateStr].sharedRows.length === 0)) {
            delete store.activeData.shiftNotebooks[dateStr];
        }

        const saved = store.save();
        if (options.status) {
            Promise.resolve(saved)
                .then(() => this.setShiftNotebookStatus('保存済み', 'saved'))
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
