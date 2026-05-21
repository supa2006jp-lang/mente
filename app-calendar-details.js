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
                type: 'planned',
                label: targetDate < today ? '未' : '定',
                title: targetDate < today ? '未完了定期メンテ' : '定期メンテ予定',
                items: scheduled,
                className: targetDate < today ? 'unfinished' : 'planned'
            },
            {
                type: 'memo',
                label: 'メ',
                title: 'メモ',
                items: memoValue ? [{ value: memoValue }] : [],
                className: 'memo'
            }
        ];

        groups.forEach(group => {
            if (group.items.length === 0) return;
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = `compact-event-chip ${group.className}`;
            chip.title = `${group.title} ${group.items.length}件を確認`;
            chip.innerHTML = `
                <span class="compact-event-circle">${group.label}</span>
                <span class="compact-event-count">x${group.items.length}</span>
            `;
            chip.onclick = (e) => {
                e.stopPropagation();
                if (group.type === 'memo') {
                    this.toggleCompactMemo(dateStr);
                    return;
                }
                this.openCompactCalendarDetails(dateStr, group.type);
            };
            container.appendChild(chip);
        });

        if (memoValue && this.expandedCompactMemos.has(dateStr)) {
            const memoBox = document.createElement('div');
            memoBox.className = 'calendar-day-memo compact-memo-expanded';
            memoBox.onclick = (e) => e.stopPropagation();
            memoBox.innerHTML = `
                <i class="fa-solid fa-note-sticky" style="margin-right:4px; opacity:0.7;"></i>
                ${this.escapeHtml(memoValue).replace(/\n/g, '<br>')}
                <i class="fa-solid fa-xmark calendar-day-memo-delete" title="メモを削除" onclick="event.stopPropagation(); app.deleteDayMemo('${dateStr}');"></i>
            `;
            container.appendChild(memoBox);
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
            planned: { title: targetDate < today ? '未完了定期メンテ' : '定期メンテ予定', items: scheduled, icon: targetDate < today ? 'fa-triangle-exclamation' : 'fa-wrench' },
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
            } else if (type === 'planned') {
                listHtml = config.items.length === 0 ? emptyHtml : config.items.map(s => {
                    const machine = store.getMachines(true).find(m => m.id === s.machineId);
                    const machineLabel = machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし';
                    const lineText = machine?.lineNo ? this.getLineLabel(machine.lineNo) : '';
                    return `
                        <div class="compact-detail-card planned" onclick="app.closeModal(); app.openCompletionForm('${this.escapeHtml(s.id)}', '${dateStr}')">
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
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppCalendarDetailMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppCalendarDetailMethods.prototype[name];
        }
    }
})();
