(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppCalendarDetailMethods extends MaintenanceApp {
    matchesCalendarLineFilter(item) {
        if (!this.calLineFilter || this.calLineFilter === 'all') return true;
        const machine = store.getMachines(true).find(m => m.id === item.machineId);
        const lineNo = item.lineNo || machine?.lineNo;
        return String(lineNo) === String(this.calLineFilter);
    }

    renderCompactCalendarItems(container, dateStr, history, scheduled, memoValue, targetDate, today) {
        const oneOffScheduled = scheduled.filter(s => (parseInt(s.periodDays) || 0) <= 0);
        const periodicScheduled = scheduled.filter(s => (parseInt(s.periodDays) || 0) > 0);
        const groups = [
            {
                type: 'sudden',
                label: '突',
                title: '突発対応',
                items: history.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop),
                className: 'sudden'
            },
            {
                type: 'dokatei',
                label: 'ド',
                title: 'ドカ停',
                items: history.filter(h => !!h.isDokatei),
                className: 'dokatei'
            },
            {
                type: 'nonProductionStop',
                label: '非',
                title: '非生産停止',
                items: history.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop),
                className: 'non-production-stop'
            },
            {
                type: 'done',
                label: '完',
                title: '完了済み定期メンテ',
                items: history.filter(h => !!h.taskId),
                className: 'done'
            },
            {
                type: 'oneOffPlanned',
                label: '単',
                title: targetDate < today ? '未完了の単発メンテ' : '単発メンテ予定',
                items: oneOffScheduled,
                className: 'one-off-planned'
            },
            {
                type: 'planned',
                label: targetDate < today ? '未' : '定',
                title: targetDate < today ? '未完了定期メンテ' : '定期メンテ予定',
                items: periodicScheduled,
                className: targetDate < today ? 'unfinished' : 'planned'
            },
            {
                type: 'memo',
                label: 'メ',
                title: 'メモ',
                items: [{ value: memoValue || '' }],
                className: 'memo'
            }
        ];

        groups.forEach(group => {
            if (group.items.length === 0) return;
            const chip = document.createElement('button');
            chip.type = 'button';
            const hasMemo = group.type === 'memo' && !!String(memoValue || '').trim();
            chip.className = `compact-event-chip ${group.className}${group.type === 'memo' ? ` calendar-memo-icon-chip ${hasMemo ? 'has-memo' : 'empty-memo'}` : ''}`;
            chip.title = group.type === 'memo'
                ? (hasMemo ? 'メモを編集' : 'メモを追加')
                : `${group.title} ${group.items.length}件を確認`;
            chip.innerHTML = group.type === 'memo'
                ? `
                    <span class="compact-event-circle"><i class="fa-solid fa-note-sticky"></i></span>
                    ${hasMemo ? `<i class="fa-solid fa-xmark calendar-day-memo-delete" title="メモを削除" onclick="event.stopPropagation(); app.closeCalendarMemoEditor?.(); app.deleteDayMemo('${dateStr}');"></i>` : ''}
                `
                : `
                    <span class="compact-event-circle">${group.label}</span>
                    <span class="compact-event-count">x${group.items.length}</span>
                `;
            chip.onclick = (e) => {
                e.stopPropagation();
                if (group.type === 'memo') {
                    this.openCalendarMemoEditor(dateStr, chip);
                    return;
                }
                this.openCompactCalendarDetails(dateStr, group.type);
            };
            container.appendChild(chip);
        });
    }

    openCalendarMemoEditor(dateStr, anchorEl, options = {}) {
        this.closeCalendarMemoEditor();

        const memoValue = (store.activeData.memos || {})[dateStr] || '';
        const [year, month, day] = dateStr.split('-').map(Number);
        const title = `${year}年 ${month}/${day} のメモ`;
        const todayStr = this.getTodayDateString ? this.getTodayDateString() : (() => {
            const today = new Date();
            return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        })();
        const isToday = dateStr === todayStr;
        this._calendarMemoEditorReturnToDayMenu = !!options.returnToDayMenu;
        const prevInfo = this.getCalendarMemoNeighborInfo(dateStr, -1);
        const nextInfo = this.getCalendarMemoNeighborInfo(dateStr, 1);
        const popover = document.createElement('div');
        popover.className = 'calendar-memo-editor-popover';
        popover.innerHTML = `
            <div class="calendar-memo-editor-head">
                <div>
                    <span class="calendar-memo-editor-label"><i class="fa-solid fa-note-sticky"></i> カレンダーメモ</span>
                    <strong class="calendar-memo-editor-title">${this.escapeHtml(title)}</strong>
                </div>
                <div class="calendar-memo-editor-head-actions">
                    <button type="button" class="icon-btn calendar-memo-editor-prev" title="前日のメモ">
                        <i class="fa-solid fa-chevron-left"></i><span>前日</span><small>${this.escapeHtml(prevInfo.hasMemo ? 'メモあり' : '未入力')}</small>
                    </button>
                    <button type="button" class="icon-btn calendar-memo-editor-today" title="今日のメモ" ${isToday ? 'disabled' : ''}>
                        <i class="fa-solid fa-calendar-day"></i><span>今日へ</span>
                    </button>
                    <button type="button" class="icon-btn calendar-memo-editor-next" title="翌日のメモ">
                        <small>${this.escapeHtml(nextInfo.hasMemo ? 'メモあり' : '未入力')}</small><span>翌日</span><i class="fa-solid fa-chevron-right"></i>
                    </button>
                    <button type="button" class="icon-btn calendar-memo-editor-close" title="閉じる">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            ${memoValue ? '' : `
                <div class="calendar-memo-editor-empty-hint">
                    <i class="fa-solid fa-circle-info"></i> この日はまだメモがありません。下の欄に入力すると保存できます。
                </div>
            `}
            <textarea class="calendar-memo-editor-text" placeholder="この日に表示したいメモを入力">${this.escapeHtml(memoValue)}</textarea>
            <div class="calendar-memo-editor-actions">
                <span class="calendar-memo-editor-status" aria-live="polite"></span>
                <button type="button" class="secondary-btn calendar-memo-editor-delete">
                    <i class="fa-solid fa-trash-can"></i> 削除
                </button>
                <button type="button" class="secondary-btn calendar-memo-editor-discard">
                    <i class="fa-solid fa-ban"></i> 保存せず閉じる
                </button>
                ${this._calendarMemoEditorReturnToDayMenu ? `
                    <button type="button" class="secondary-btn calendar-memo-editor-return">
                        <i class="fa-solid fa-arrow-left"></i> 保存して日付メニューへ戻る
                    </button>
                ` : ''}
                <button type="button" class="primary-btn calendar-memo-editor-save">
                    <i class="fa-solid fa-floppy-disk"></i> 保存
                </button>
            </div>
        `;

        document.body.appendChild(popover);
        this._calendarMemoEditor = popover;
        this._calendarMemoEditorDate = dateStr;
        this.positionCalendarMemoEditor(popover, anchorEl);

        const textarea = popover.querySelector('.calendar-memo-editor-text');
        const saveBtn = popover.querySelector('.calendar-memo-editor-save');
        const closeBtn = popover.querySelector('.calendar-memo-editor-close');
        const deleteBtn = popover.querySelector('.calendar-memo-editor-delete');
        const prevBtn = popover.querySelector('.calendar-memo-editor-prev');
        const nextBtn = popover.querySelector('.calendar-memo-editor-next');
        const todayBtn = popover.querySelector('.calendar-memo-editor-today');
        const discardBtn = popover.querySelector('.calendar-memo-editor-discard');
        const returnBtn = popover.querySelector('.calendar-memo-editor-return');

        textarea?.focus();
        textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
        saveBtn?.addEventListener('click', () => this.saveCalendarMemoEditorInPlace(dateStr));
        closeBtn?.addEventListener('click', () => this.saveCalendarMemoEditor(dateStr));
        prevBtn?.addEventListener('click', () => this.moveCalendarMemoEditorDate(dateStr, -1));
        nextBtn?.addEventListener('click', () => this.moveCalendarMemoEditorDate(dateStr, 1));
        todayBtn?.addEventListener('click', () => this.openTodayCalendarMemoEditor(dateStr));
        discardBtn?.addEventListener('click', () => this.closeCalendarMemoEditor());
        returnBtn?.addEventListener('click', () => this.saveCalendarMemoEditorAndReturnToDayMenu(dateStr));
        deleteBtn?.addEventListener('click', () => {
            if (!confirm('この日のメモを削除しますか？')) return;
            this.saveCalendarMemoEditor(dateStr, '');
        });
        textarea?.addEventListener('input', () => {
            const hint = popover.querySelector('.calendar-memo-editor-empty-hint');
            if (hint && textarea.value.trim()) hint.classList.add('hidden');
        });
        textarea?.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.saveCalendarMemoEditor(dateStr);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.saveCalendarMemoEditor(dateStr);
            }
        });

        this._calendarMemoEditorOutsideHandler = (e) => {
            if (popover.contains(e.target) || anchorEl?.contains(e.target)) return;
            this.saveCalendarMemoEditor(dateStr);
        };
        setTimeout(() => {
            document.addEventListener('pointerdown', this._calendarMemoEditorOutsideHandler);
        }, 0);
        if (this._calendarMemoEditorMoved) {
            popover.querySelector('.calendar-memo-editor-title')?.classList.add('date-changed');
            this._calendarMemoEditorMoved = false;
        }
    }

    getCalendarMemoNeighborInfo(dateStr, direction) {
        const [year, month, day] = String(dateStr || '').split('-').map(Number);
        if (!year || !month || !day) return { dateStr: '', hasMemo: false };
        const target = new Date(year, month - 1, day);
        target.setDate(target.getDate() + direction);
        const neighborDateStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
        return {
            dateStr: neighborDateStr,
            hasMemo: !!String((store.activeData.memos || {})[neighborDateStr] || '').trim()
        };
    }

    moveCalendarMemoEditorDate(dateStr, direction) {
        const [year, month, day] = String(dateStr || '').split('-').map(Number);
        if (!year || !month || !day) return;
        const popover = this._calendarMemoEditor;
        const textarea = popover?.querySelector('.calendar-memo-editor-text');
        const nextValue = (textarea?.value || '').trim();
        if (!store.activeData.memos) store.activeData.memos = {};
        if (nextValue) {
            store.activeData.memos[dateStr] = nextValue;
        } else {
            delete store.activeData.memos[dateStr];
        }
        store.save();
        const target = new Date(year, month - 1, day);
        target.setDate(target.getDate() + direction);
        const nextDateStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
        this.syncCalendarMemoEditorMonth(target);
        this._calendarMemoEditorMoved = true;
        this.openCalendarMemoEditor(nextDateStr, null, { returnToDayMenu: this._calendarMemoEditorReturnToDayMenu });
    }

    openTodayCalendarMemoEditor(dateStr) {
        const popover = this._calendarMemoEditor;
        const textarea = popover?.querySelector('.calendar-memo-editor-text');
        const nextValue = (textarea?.value || '').trim();
        if (!store.activeData.memos) store.activeData.memos = {};
        if (nextValue) {
            store.activeData.memos[dateStr] = nextValue;
        } else {
            delete store.activeData.memos[dateStr];
        }
        store.save();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        this.syncCalendarMemoEditorMonth(today);
        this._calendarMemoEditorMoved = true;
        this.openCalendarMemoEditor(todayStr, null, { returnToDayMenu: this._calendarMemoEditorReturnToDayMenu });
    }

    syncCalendarMemoEditorMonth(targetDate) {
        if (!(targetDate instanceof Date) || Number.isNaN(targetDate.getTime())) return;
        const currentYear = this.currentDate?.getFullYear?.();
        const currentMonth = this.currentDate?.getMonth?.();
        if (currentYear === targetDate.getFullYear() && currentMonth === targetDate.getMonth()) return;
        this.currentDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        this.renderCalendar();
    }

    positionCalendarMemoEditor(popover, anchorEl) {
        popover.style.left = '50%';
        popover.style.top = '50%';
        popover.style.transform = 'translate(-50%, -50%)';
    }

    saveCalendarMemoEditor(dateStr, forcedValue = null) {
        const popover = this._calendarMemoEditor;
        const textarea = popover?.querySelector('.calendar-memo-editor-text');
        const nextValue = forcedValue === null ? (textarea?.value || '').trim() : String(forcedValue || '').trim();

        if (!store.activeData.memos) store.activeData.memos = {};
        if (nextValue) {
            store.activeData.memos[dateStr] = nextValue;
        } else {
            delete store.activeData.memos[dateStr];
        }
        store.save();
        this.showCalendarMemoEditorStatus(nextValue ? '保存済み' : '未入力に戻しました');
        this.closeCalendarMemoEditor();
        this.renderCalendar();
        if (typeof this.renderDashboard === 'function' && document.getElementById('dashboard-widgets')) {
            this.renderDashboard();
        }
    }

    saveCalendarMemoEditorInPlace(dateStr) {
        const popover = this._calendarMemoEditor;
        const textarea = popover?.querySelector('.calendar-memo-editor-text');
        const nextValue = (textarea?.value || '').trim();
        if (!store.activeData.memos) store.activeData.memos = {};
        if (nextValue) {
            store.activeData.memos[dateStr] = nextValue;
        } else {
            delete store.activeData.memos[dateStr];
        }
        store.save();
        this.showCalendarMemoEditorStatus(nextValue ? '保存済み' : '未入力に戻しました');
        this.renderCalendar();
        if (typeof this.renderDashboard === 'function' && document.getElementById('dashboard-widgets')) {
            this.renderDashboard();
        }
    }

    saveCalendarMemoEditorAndReturnToDayMenu(dateStr) {
        const popover = this._calendarMemoEditor;
        const textarea = popover?.querySelector('.calendar-memo-editor-text');
        const nextValue = (textarea?.value || '').trim();
        if (!store.activeData.memos) store.activeData.memos = {};
        if (nextValue) {
            store.activeData.memos[dateStr] = nextValue;
        } else {
            delete store.activeData.memos[dateStr];
        }
        store.save();
        this.closeCalendarMemoEditor();
        this.renderCalendar();
        if (typeof this.renderDashboard === 'function' && document.getElementById('dashboard-widgets')) {
            this.renderDashboard();
        }
        this.openDayQuickMenu(dateStr);
    }

    showCalendarMemoEditorStatus(text) {
        const status = this._calendarMemoEditor?.querySelector('.calendar-memo-editor-status');
        if (!status) return;
        status.textContent = text;
        status.classList.add('visible');
        clearTimeout(this._calendarMemoEditorStatusTimer);
        this._calendarMemoEditorStatusTimer = setTimeout(() => {
            status.classList.remove('visible');
        }, 1800);
    }

    closeCalendarMemoEditor() {
        clearTimeout(this._calendarMemoEditorStatusTimer);
        if (this._calendarMemoEditorOutsideHandler) {
            document.removeEventListener('pointerdown', this._calendarMemoEditorOutsideHandler);
            this._calendarMemoEditorOutsideHandler = null;
        }
        if (this._calendarMemoEditor) {
            this._calendarMemoEditor.remove();
            this._calendarMemoEditor = null;
            this._calendarMemoEditorDate = null;
        }
    }

    toggleCompactMemo(dateStr) {
        if (this.expandedCompactMemos.has(dateStr)) {
            this.expandedCompactMemos.delete(dateStr);
        } else {
            this.expandedCompactMemos.add(dateStr);
        }
        this.renderCalendar();
    }

    openCompactCalendarDetails(dateStr, type) {
        const history = this.getHistoryForDate(dateStr).filter(h => this.matchesCalendarLineFilter(h));
        const scheduled = this.getScheduledTasksForDate(dateStr).filter(s => this.matchesCalendarLineFilter(s));
        const memoValue = (store.activeData.memos || {})[dateStr];
        const [year, month, day] = dateStr.split('-');

        const targetDate = new Date(Number(year), Number(month) - 1, Number(day));
        targetDate.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);

        const configMap = {
            sudden: { title: '突発対応', items: history.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop), icon: 'fa-bolt-lightning' },
            dokatei: { title: 'ドカ停', items: history.filter(h => !!h.isDokatei), icon: 'fa-triangle-exclamation' },
            nonProductionStop: { title: '非生産停止', items: history.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop), icon: 'fa-circle-pause' },
            done: { title: '完了済み定期メンテ', items: history.filter(h => !!h.taskId), icon: 'fa-circle-check' },
            oneOffPlanned: { title: targetDate < today ? '未完了の単発メンテ' : '単発メンテ予定', items: scheduled.filter(s => (parseInt(s.periodDays) || 0) <= 0), icon: 'fa-calendar-day' },
            planned: { title: targetDate < today ? '未完了定期メンテ' : '定期メンテ予定', items: scheduled.filter(s => (parseInt(s.periodDays) || 0) > 0), icon: targetDate < today ? 'fa-triangle-exclamation' : 'fa-wrench' },
            memo: { title: 'メモ', items: memoValue ? [{ value: memoValue }] : [], icon: 'fa-note-sticky' }
        };
        const config = configMap[type];
        if (!config) return;

        this.openModal('compact-calendar-details', `${month}/${day} ${config.title} ${config.items.length}件`, () => {
            const content = document.getElementById('modal-content');
            const emptyHtml = '<p style="font-size:0.85rem; padding:12px; background:var(--background); border-radius:8px;">表示できる項目はありません。</p>';
            let listHtml = emptyHtml;

            if (type === 'memo' && memoValue) {
                listHtml = `
                    <div class="compact-detail-card memo">
                        <div class="compact-detail-icon"><i class="fa-solid ${config.icon}"></i></div>
                        <div class="compact-detail-main">
                            <div class="compact-detail-title">カレンダーメモ</div>
                            <div class="compact-detail-sub">${this.escapeHtml(memoValue).replace(/\n/g, '<br>')}</div>
                        </div>
                    </div>
                `;
            } else if (type === 'planned' || type === 'oneOffPlanned') {
                listHtml = config.items.length === 0 ? emptyHtml : config.items.map(s => {
                    const machine = store.getMachines(true).find(m => m.id === s.machineId);
                    const machineLabel = machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし';
                    const lineText = machine?.lineNo ? this.getLineLabel(machine.lineNo) : '';
                    return `
                        <div class="compact-detail-card ${type === 'oneOffPlanned' ? 'one-off-planned' : 'planned'}" onclick="app.closeModal(); app.openCompletionForm('${this.escapeHtml(s.id)}', '${dateStr}')">
                            <div class="compact-detail-icon"><i class="fa-solid ${config.icon}"></i></div>
                            <div class="compact-detail-main">
                                <div class="compact-detail-title">${this.escapeHtml(s.content || '予定')}</div>
                                <div class="compact-detail-sub">${this.escapeHtml(machineLabel)}${lineText ? ` / ${this.escapeHtml(lineText)}` : ''}</div>
                            </div>
                            <i class="fa-solid fa-chevron-right compact-detail-arrow"></i>
                        </div>
                    `;
                }).join('');
            } else {
                listHtml = config.items.length === 0 ? emptyHtml : config.items.map(h => {
                    const machine = store.getMachines(true).find(m => m.id === h.machineId);
                    const machineLabel = machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし';
                    const workers = Array.isArray(h.workers) ? h.workers : (typeof h.workers === 'string' ? h.workers.split(',').map(s => s.trim()).filter(Boolean) : []);
                    const workerText = workers.length ? ` / ${workers.join(', ')}` : '';
                    const dokateiText = h.isDokatei ? ' / ドカ停' : '';
                    const nonProductionText = h.isNonProductionStop ? ' / 非生産停止' : '';
                    return `
                        <div class="compact-detail-card ${type}" onclick="app.closeModal(); app.openHistoryEditForm('${this.escapeHtml(h.id)}')">
                            <div class="compact-detail-icon"><i class="fa-solid ${config.icon}"></i></div>
                            <div class="compact-detail-main">
                                <div class="compact-detail-title">${this.escapeHtml(this.getHistoryDisplayText(h))}</div>
                                <div class="compact-detail-sub">${this.escapeHtml(machineLabel + workerText + dokateiText + nonProductionText)}</div>
                            </div>
                            <i class="fa-solid fa-chevron-right compact-detail-arrow"></i>
                        </div>
                    `;
                }).join('');
            }

            content.innerHTML = `<div class="compact-detail-list">${listHtml}</div>`;
            const saveBtn = document.querySelector('.modal-footer .primary-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
        });
    }

    openCalendarDayDetails(dateStr) {
        const history = this.getHistoryForDate(dateStr).filter(h => this.matchesCalendarLineFilter(h));
        const scheduled = this.getScheduledTasksForDate(dateStr).filter(s => this.matchesCalendarLineFilter(s));
        const memoValue = (store.activeData.memos || {})[dateStr];
        const [year, month, day] = dateStr.split('-');
        const cards = [];

        history.forEach(h => {
            const machine = store.getMachines(true).find(m => m.id === h.machineId);
            const machineLabel = machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし';
            const workers = Array.isArray(h.workers) ? h.workers : (typeof h.workers === 'string' ? h.workers.split(',').map(s => s.trim()).filter(Boolean) : []);
            const workerText = workers.length ? ` / ${workers.join(', ')}` : '';
            const type = h.taskId ? 'done' : (h.isDokatei ? 'dokatei' : (h.isNonProductionStop ? 'nonProductionStop' : 'sudden'));
            const icon = h.taskId ? 'fa-circle-check' : (h.isDokatei ? 'fa-triangle-exclamation' : (h.isNonProductionStop ? 'fa-circle-pause' : 'fa-bolt-lightning'));
            cards.push(`
                <div class="compact-detail-card ${type}" onclick="app.closeModal(); app.openHistoryEditForm('${this.escapeHtml(h.id)}')">
                    <div class="compact-detail-icon"><i class="fa-solid ${icon}"></i></div>
                    <div class="compact-detail-main">
                        <div class="compact-detail-title">${this.escapeHtml(this.getHistoryDisplayText(h))}</div>
                        <div class="compact-detail-sub">${this.escapeHtml(machineLabel + workerText)}</div>
                    </div>
                    <i class="fa-solid fa-chevron-right compact-detail-arrow"></i>
                </div>
            `);
        });

        scheduled.forEach(s => {
            const machine = store.getMachines(true).find(m => m.id === s.machineId);
            const machineLabel = machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし';
            const isOneOff = (parseInt(s.periodDays) || 0) <= 0;
            cards.push(`
                <div class="compact-detail-card ${isOneOff ? 'one-off-planned' : 'planned'}" onclick="app.closeModal(); app.openCompletionForm('${this.escapeHtml(s.id)}', '${dateStr}')">
                    <div class="compact-detail-icon"><i class="fa-solid ${isOneOff ? 'fa-calendar-day' : 'fa-wrench'}"></i></div>
                    <div class="compact-detail-main">
                        <div class="compact-detail-title">${this.escapeHtml(s.content || '予定')}</div>
                        <div class="compact-detail-sub">${this.escapeHtml(machineLabel)}${isOneOff ? ' / 単発予定' : ''}</div>
                    </div>
                    <i class="fa-solid fa-chevron-right compact-detail-arrow"></i>
                </div>
            `);
        });

        if (memoValue) {
            cards.push(`
                <div class="compact-detail-card memo">
                    <div class="compact-detail-icon"><i class="fa-solid fa-note-sticky"></i></div>
                    <div class="compact-detail-main">
                        <div class="compact-detail-title">カレンダーメモ</div>
                        <div class="compact-detail-sub">${this.escapeHtml(memoValue).replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
            `);
        }

        this.openModal('calendar-day-details', `${month}/${day} 予定一覧 ${cards.length}件`, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = cards.length
                ? `<div class="compact-detail-list">${cards.join('')}</div>`
                : '<p style="font-size:0.85rem; padding:12px; background:var(--background); border-radius:8px;">表示できる項目はありません。</p>';
            const saveBtn = document.querySelector('.modal-footer .primary-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
        });
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppCalendarDetailMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppCalendarDetailMethods.prototype[name];
        }
    }
})();
