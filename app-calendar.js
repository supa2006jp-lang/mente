(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppCalendarMethods extends MaintenanceApp {
    setupCalendarControls() {
        const prevBtn = document.getElementById('cal-prev');
        const nextBtn = document.getElementById('cal-next');
        const compactBtn = document.getElementById('calendar-compact-toggle');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.renderCalendar();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.renderCalendar();
            });
        }

        if (compactBtn) {
            compactBtn.classList.toggle('active', this.calendarCompactMode);
            compactBtn.setAttribute('aria-pressed', String(this.calendarCompactMode));
            compactBtn.addEventListener('click', () => {
                this.calendarCompactMode = !this.calendarCompactMode;
                localStorage.setItem('calendar_compact_mode', String(this.calendarCompactMode));
                compactBtn.classList.toggle('active', this.calendarCompactMode);
                compactBtn.setAttribute('aria-pressed', String(this.calendarCompactMode));
                this.renderCalendar();
            });
        }
    }

    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const monthDisplay = document.getElementById('current-month-display');
        if (monthDisplay) {
            monthDisplay.textContent = `${year}年 ${month + 1}月`;
        }
        this.renderCalendarLegend();

        const calContainer = document.getElementById('calendar-days');
        if (!calContainer) return;
        calContainer.closest('.calendar-grid-container')?.classList.toggle('compact-calendar-grid', !!this.calendarCompactMode);

        // カレンダーのラインフィルタ選択肢を動的生成 (初回のみ)
        const calLineEl = document.getElementById('cal-filter-line');
        if (calLineEl && calLineEl.options.length <= 1) {
            const lineSet = new Set();
            store.getMachines(true).forEach(m => { if (m.lineNo) lineSet.add(m.lineNo); });
            store.activeData.history.forEach(h => { if (h.lineNo) lineSet.add(h.lineNo); });
            Array.from(lineSet).sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric:true})).forEach(l => {
                const opt = document.createElement('option');
                opt.value = l;
                opt.textContent = this.getLineLabel(l);
                calLineEl.appendChild(opt);
            });
        }

        calContainer.innerHTML = '';

        // Get first day of month (0 = Sunday)
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        
        // Blank cells before first day
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'day-cell empty';
            calContainer.appendChild(emptyCell);
        }

        // Fill days
        for (let d = 1; d <= lastDate; d++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const [y_c, m_c, d_c] = dateStr.split('-').map(Number);
            const targetDate = new Date(y_c, m_c - 1, d_c);
            targetDate.setHours(0,0,0,0);
            
            // Highlight today
            const today = new Date();
            today.setHours(0,0,0,0);
            if (today.getTime() === targetDate.getTime()) {
                cell.classList.add('today');
            }

            // Detect Weekend
            const dayOfWeek = (firstDay + d - 1) % 7;
            if (dayOfWeek === 0) cell.classList.add('sun');
            if (dayOfWeek === 6) cell.classList.add('sat');

            cell.innerHTML = `
                <div class="day-top-row">
                    <span class="day-number">${d}</span>
                    <div class="shift-note-stamps" aria-label="連絡帳">
                        <button type="button" class="shift-note-stamp early" title="早番の連絡帳" data-shift="early">早</button>
                        <button type="button" class="shift-note-stamp late" title="遅番の連絡帳" data-shift="late">遅</button>
                        <button type="button" class="shift-note-stamp night" title="深夜の連絡帳" data-shift="night">深</button>
                    </div>
                </div>
                <span class="add-sudden-btn" title="突発を登録">+登録</span>
                <div class="events-container"></div>
            `;
            
            cell.onclick = () => this.openDayQuickMenu(dateStr);

            const addBtn = cell.querySelector('.add-sudden-btn');
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openSuddenRecordModal(dateStr);
            });

            cell.querySelectorAll('.shift-note-stamp').forEach(btn => {
                const shiftData = store.activeData.shiftNotebooks?.[dateStr]?.[btn.dataset.shift];
                const shiftRows = Array.isArray(shiftData) ? shiftData : (shiftData?.rows || []);
                const shiftMembers = Array.isArray(shiftData?.members) && !shiftData?.inheritedMembers ? shiftData.members : [];
                const shiftAbsentMembers = Array.isArray(shiftData?.absentMembers) && !shiftData?.inheritedMembers ? shiftData.absentMembers : [];
                if (shiftRows.length > 0 || shiftMembers.length > 0 || shiftAbsentMembers.length > 0) btn.classList.add('has-note');
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openShiftNotebookModal(dateStr, btn.dataset.shift);
                });
            });

            // Drag & Drop for cell (Drop Target)
            cell.ondragover = (e) => {
                e.preventDefault();
                if (!cell.classList.contains('empty')) cell.classList.add('drag-over');
            };
            cell.ondragleave = () => cell.classList.remove('drag-over');
            cell.ondrop = (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                try {
                    const data = JSON.parse(e.dataTransfer.getData('h-task') || '{}');
                    if (data.taskId) this.handleTaskDrop(data.taskId, data.sourceDate, dateStr);
                } catch(err) { console.error('Drop error', err); }
            };

            const eventsContainer = cell.querySelector('.events-container');
            const dateHistory = this.getHistoryForDate(dateStr).filter(h => this.matchesCalendarLineFilter(h));
            const dateScheduled = this.getScheduledTasksForDate(dateStr).filter(s => this.matchesCalendarLineFilter(s));
            const memoData = store.activeData.memos || {};
            const memoValue = memoData[dateStr];

            if (this.calendarCompactMode) {
                eventsContainer.classList.add('compact-events');
                this.renderCompactCalendarItems(eventsContainer, dateStr, dateHistory, dateScheduled, memoValue, targetDate, today);
                calContainer.appendChild(cell);
                continue;
            }

            // 1. History (Completed)
            dateHistory.forEach(h => {
                // カレンダーのラインフィルタ
                if (this.calLineFilter && this.calLineFilter !== 'all') {
                    const mach = store.getMachines(true).find(m => m.id === h.machineId);
                    const l = h.lineNo || mach?.lineNo;
                    if (String(l) !== String(this.calLineFilter)) return;
                }

                const badge = document.createElement('div');
                const isSudden = !h.taskId;
                badge.className = `event-badge ${isSudden ? 'sudden' : 'success'}`;
                
                const machine = store.getMachines(true).find(m => m.id === h.machineId);
                const lineNo = h.lineNo || machine?.lineNo;
                const machineCategory = h.machineCategory || machine?.category || '';
                const categoryChar = machineCategory ? machineCategory.charAt(0) : '';
                
                let stampText = '';
                const lineStampLabel = lineNo ? this.getLineStampLabel(lineNo) : '';
                if (lineStampLabel && categoryChar) stampText = `${lineStampLabel}-${categoryChar}`;
                else if (lineStampLabel) stampText = lineStampLabel;
                else if (categoryChar) stampText = categoryChar;

                const colors = lineNo ? this.getLineColors(lineNo) : { bg: '#facc15', text: '#dc2626' };
                const combinedStamp = stampText ? `<span style="display:inline-flex; align-items:center; justify-content:center; background:${colors.bg}; color:${colors.text}; min-width:24px; padding:0 4px; height:18px; border-radius:3px; font-weight:950; font-size:0.75rem; margin-right:4px; border:1px solid ${colors.bg}; flex-shrink:0; vertical-align:middle;">${stampText}</span>` : '';
                
                const modelOrName = MaintenanceApp.isModelBlank(machine?.model) ? (machine?.name || '') : (machine?.model || '');
                const modelStr = modelOrName ? `${modelOrName}: ` : '';
                
                const displayText = this.getHistoryDisplayText(h);
                
                const workers = Array.isArray(h.workers) ? h.workers : (typeof h.workers === 'string' ? h.workers.split(',').map(s => s.trim()) : []);
                const workerText = workers.length > 0 ? ` [${workers.join(', ')}]` : '';
                badge.innerHTML = `<span style="text-overflow:ellipsis; overflow:hidden; display:flex; align-items:center;">${combinedStamp}${modelStr}${displayText}${workerText}</span>`;
                
                // Done Stamp (Always Periodic if h.taskId exists)
                if (h.taskId) {
                    const doneStamp = document.createElement('div');
                    doneStamp.className = 'stamp-done';
                    doneStamp.textContent = '完';
                    badge.appendChild(doneStamp);
                }

                // Dokatei Stamp (Top-left)
                if (h.isDokatei) {
                    const dokaStamp = document.createElement('div');
                    dokaStamp.className = 'stamp-dokatei';
                    dokaStamp.textContent = 'ドカ停';
                    badge.appendChild(dokaStamp);
                }

                badge.title = 'クリックして編集';
                badge.onclick = (e) => {
                    e.stopPropagation();
                    this.openHistoryEditForm(h.id);
                };
                eventsContainer.appendChild(badge);
            });

            // 2. Scheduled (Planned)
            dateScheduled.forEach(s => {
                const badge = document.createElement('div');
                const isOneOff = (parseInt(s.periodDays) || 0) <= 0;
                badge.className = `event-badge success${isOneOff ? ' one-off-planned' : ''}`;
                badge.draggable = true;
                badge.ondragstart = (e) => {
                    e.dataTransfer.setData('h-task', JSON.stringify({ taskId: s.id, sourceDate: dateStr }));
                    badge.classList.add('dragging');
                };
                badge.ondragend = () => badge.classList.remove('dragging');

                const machine = store.getMachines(true).find(m => m.id === s.machineId);
                const lineNo = machine?.lineNo;
                const machineCategory = machine?.category || '';
                const categoryChar = machineCategory ? machineCategory.charAt(0) : '';

                let stampText = '';
                const lineStampLabel = lineNo ? this.getLineStampLabel(lineNo) : '';
                if (lineStampLabel && categoryChar) stampText = `${lineStampLabel}-${categoryChar}`;
                else if (lineStampLabel) stampText = lineStampLabel;
                else if (categoryChar) stampText = categoryChar;

                const colors = lineNo ? this.getLineColors(lineNo) : { bg: '#facc15', text: '#dc2626' };
                const combinedStamp = stampText ? `<span style="display:inline-flex; align-items:center; justify-content:center; background:${colors.bg}; color:${colors.text}; min-width:24px; padding:0 4px; height:18px; border-radius:3px; font-weight:950; font-size:0.75rem; margin-right:4px; border:1px solid ${colors.bg}; flex-shrink:0; vertical-align:middle;">${stampText}</span>` : '';
                const modelOrName = MaintenanceApp.isModelBlank(machine?.model) ? (machine?.name || '') : (machine?.model || '');
                const modelStr = modelOrName ? `${MaintenanceApp.toHalfWidthLower(modelOrName)}: ` : '';
                badge.innerHTML = `<span style="display:flex; align-items:center;">${combinedStamp}${this.escapeHtml(modelStr)}${this.escapeHtml(s.content || '')}</span>`;

                if (isOneOff) {
                    const oneOffStamp = document.createElement('div');
                    oneOffStamp.className = 'stamp-one-off';
                    oneOffStamp.textContent = '単';
                    badge.appendChild(oneOffStamp);
                }

                // Unfinished Stamp (If past today)
                if (targetDate < today) {
                    const unfStamp = document.createElement('div');
                    unfStamp.className = 'stamp-unfinished';
                    unfStamp.textContent = '未完';
                    badge.appendChild(unfStamp);
                }
                badge.title = 'クリックして完了報告';
                badge.onclick = (e) => {
                    e.stopPropagation();
                    this.openCompletionForm(s.id, dateStr);
                };
                eventsContainer.appendChild(badge);
            });

            // 3. Memo (Static text)
            if (memoValue) {
                const memoBox = document.createElement('div');
                memoBox.className = 'calendar-day-memo';
                memoBox.innerHTML = `
                    <i class="fa-solid fa-note-sticky" style="margin-right:4px; opacity:0.7;"></i>
                    ${memoValue.replace(/\n/g, '<br>')}
                    <i class="fa-solid fa-xmark calendar-day-memo-delete" title="メモを削除" onclick="event.stopPropagation(); app.deleteDayMemo('${dateStr}');"></i>
                `;
                eventsContainer.appendChild(memoBox);
            }
            this.applyCalendarDayOverflow(eventsContainer, dateStr);
            
            calContainer.appendChild(cell);
        }

        this.updateCalendarStats();
        this.updateTelop();
    }

    renderCalendarLegend() {
        const header = document.querySelector('#view-calendar .calendar-header');
        if (!header) return;
        let legend = document.getElementById('calendar-legend');
        if (!legend) {
            legend = document.createElement('div');
            legend.id = 'calendar-legend';
            legend.className = 'calendar-legend';
            header.insertAdjacentElement('afterend', legend);
        }
        const collapsed = localStorage.getItem('calendar_legend_collapsed') === 'true';
        legend.classList.toggle('collapsed', collapsed);
        legend.innerHTML = `
            <button type="button" class="calendar-legend-toggle" onclick="app.toggleCalendarLegend()" aria-expanded="${!collapsed}">
                <i class="fa-solid fa-circle-info"></i> 凡例
            </button>
            <div class="calendar-legend-items">
                <span class="calendar-legend-item"><span class="calendar-legend-dot periodic"></span>定期予定</span>
                <span class="calendar-legend-item"><span class="calendar-legend-stamp one-off">単</span>単発予定</span>
                <span class="calendar-legend-item"><span class="calendar-legend-stamp done">完</span>完了</span>
                <span class="calendar-legend-item"><span class="calendar-legend-stamp unfinished">未完</span>期限切れ</span>
            </div>
        `;
    }

    toggleCalendarLegend() {
        const next = localStorage.getItem('calendar_legend_collapsed') !== 'true';
        localStorage.setItem('calendar_legend_collapsed', String(next));
        this.renderCalendarLegend();
    }

    applyCalendarDayOverflow(eventsContainer, dateStr) {
        const items = Array.from(eventsContainer.children)
            .filter(child => child.classList.contains('event-badge') || child.classList.contains('calendar-day-memo'));
        const maxVisible = 3;
        if (items.length <= maxVisible) return;
        items.slice(maxVisible).forEach(item => item.classList.add('calendar-day-overflow-hidden'));

        const moreBtn = document.createElement('button');
        moreBtn.type = 'button';
        moreBtn.className = 'calendar-day-more-btn';
        moreBtn.textContent = `+${items.length - maxVisible}件`;
        moreBtn.title = 'この日の予定をすべて表示';
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            this.openCalendarDayDetails(dateStr);
        };
        eventsContainer.appendChild(moreBtn);
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppCalendarMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppCalendarMethods.prototype[name];
        }
    }
})();
