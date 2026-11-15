(function () {
    if (typeof MaintenanceApp === 'undefined') return;
    class MaintenanceUnifiedSearchMethods extends MaintenanceApp {
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
        if (!this.requestCloseModal()) return;
        this._restoreUnifiedSearchState = { ...state };
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
            const workTime = this.getRecordWorkMinutes(history);
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
                        <button type="button" data-sort-mode="date" onclick="app.sortUnifiedSearchResults('date', this)">日付順</button>
                        <button type="button" data-sort-mode="type" class="active" onclick="app.sortUnifiedSearchResults('type', this)">種類順</button>
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
            } else {
                this.sortUnifiedSearchResults('type');
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
        this.updateUnifiedSearchResultGroupHeaders();
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
        this.updateUnifiedSearchResultGroupHeaders();
    }

    updateUnifiedSearchResultGroupHeaders() {
        const list = document.querySelector('.notebook-search-results');
        if (!list) return;
        list.querySelectorAll('.unified-search-result-section').forEach(el => el.remove());
        const activeSort = document.querySelector('.notebook-search-sort button.active')?.dataset.sortMode || 'type';
        if (activeSort !== 'type') return;
        const labels = {
            history: ['履歴', 'fa-clock-rotate-left'],
            guide: ['手順書', 'fa-book-open'],
            task: ['定期メンテ', 'fa-wrench'],
            todo: ['ToDo', 'fa-list-check'],
            notebook: ['連絡帳', 'fa-address-book'],
            memo: ['メモ', 'fa-note-sticky']
        };
        let previousType = '';
        Array.from(list.querySelectorAll('.notebook-search-result[data-search-type]'))
            .filter(item => !item.hidden)
            .forEach(item => {
                const type = item.dataset.searchType || '';
                if (type === previousType) return;
                previousType = type;
                const [label, icon] = labels[type] || [type || 'その他', 'fa-circle-info'];
                const count = Array.from(list.querySelectorAll('.notebook-search-result[data-search-type]'))
                    .filter(row => !row.hidden && row.dataset.searchType === type).length;
                item.insertAdjacentHTML('beforebegin', `
                    <div class="unified-search-result-section ${this.escapeHtml(type)}">
                        <span><i class="fa-solid ${this.escapeHtml(icon)}"></i> ${this.escapeHtml(label)}</span>
                        <b>${count}件</b>
                    </div>
                `);
            });
    }

    }
    for (const name of Object.getOwnPropertyNames(MaintenanceUnifiedSearchMethods.prototype)) {
        if (name !== 'constructor') MaintenanceApp.prototype[name] = MaintenanceUnifiedSearchMethods.prototype[name];
    }
})();
