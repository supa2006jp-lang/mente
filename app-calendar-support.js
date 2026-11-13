(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppCalendarSupportMethods extends MaintenanceApp {
    handleTaskDrop(taskId, sourceDate, targetDate) {
        if (sourceDate === targetDate) return;
        const task = store.activeData.tasks.find(t => t.id === taskId);
        if (!task || !this.isTaskScheduleOccurrenceDraggable(task, sourceDate)) return;

        const sourceTime = this.parseTaskScheduleDate(sourceDate);
        const targetTime = this.parseTaskScheduleDate(targetDate);
        if (sourceTime === null || targetTime === null) return;
        const diffDays = Math.round((targetTime - sourceTime) / 86400000);
        const isOneOff = (parseInt(task.periodDays) || 0) <= 0;
        const moveText = diffDays > 0 ? `${diffDays}日後に移動` : `${Math.abs(diffDays)}日前へ移動`;
        const confirmText = isOneOff
            ? `単発予定「${task.content}」の日付を ${moveText} しますか？`
            : `「${task.content}」のこの予定を ${moveText} し、以降の周期を調整しますか？`;

        if (confirm(confirmText)) {
            if (isOneOff) {
                task.startDate = targetDate;
            } else {
                const movedPeriod = parseInt(task.periodDays, 10) || 0;
                const movesEarlier = targetTime < sourceTime;
                this.replaceTaskScheduleFromDate(task, sourceDate, targetDate, movedPeriod, movesEarlier ? sourceDate : targetDate);
                if (movesEarlier) {
                    // Keep earlier planned days. The dragged day alone is inserted
                    // before the cutover; the shifted cycle resumes at the cutover.
                    task.scheduleHistory.push({
                        startDate: targetDate,
                        periodDays: movedPeriod,
                        fromDate: targetDate,
                        untilDate: new Date(targetTime + 86400000).toISOString().slice(0, 10)
                    });
                }
            }
            store.save();
            this.renderCalendar();
        }
    }

    parseTaskScheduleDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
        const [year, month, day] = value.split('-').map(Number);
        const time = Date.UTC(year, month - 1, day);
        return new Date(time).toISOString().slice(0, 10) === value ? time : null;
    }

    getTaskScheduleSegments(task) {
        if (!task) return [];
        const oldSegments = Array.isArray(task.scheduleHistory) ? task.scheduleHistory : [];
        const rawSegments = [
            ...oldSegments,
            {
                startDate: task.startDate,
                periodDays: task.periodDays,
                fromDate: task.scheduleEffectiveDate || task.startDate
            }
        ];
        return rawSegments.filter(segment => {
            const start = this.parseTaskScheduleDate(segment.startDate);
            const from = this.parseTaskScheduleDate(segment.fromDate || segment.startDate);
            const until = segment.untilDate == null ? null : this.parseTaskScheduleDate(segment.untilDate);
            return start !== null && from !== null && (segment.untilDate == null || until !== null);
        }).map(segment => ({
            startDate: segment.startDate,
            periodDays: parseInt(segment.periodDays, 10) || 0,
            fromDate: segment.fromDate || segment.startDate,
            untilDate: segment.untilDate || null
        }));
    }

    isTaskScheduleSegmentDate(segment, targetTime) {
        const startTime = this.parseTaskScheduleDate(segment.startDate);
        const fromTime = this.parseTaskScheduleDate(segment.fromDate);
        const untilTime = segment.untilDate ? this.parseTaskScheduleDate(segment.untilDate) : null;
        if (targetTime < startTime || targetTime < fromTime || (untilTime !== null && targetTime >= untilTime)) return false;
        return segment.periodDays <= 0
            ? targetTime === startTime
            : ((targetTime - startTime) / 86400000) % segment.periodDays === 0;
    }

    isScheduledTaskOccurrenceDate(task, dateStr) {
        const targetTime = this.parseTaskScheduleDate(dateStr);
        return targetTime !== null && this.getTaskScheduleSegments(task).some(segment => this.isTaskScheduleSegmentDate(segment, targetTime));
    }

    getScheduledTaskOccurrencePeriodDays(task, dateStr) {
        const targetTime = this.parseTaskScheduleDate(dateStr);
        if (targetTime === null) return parseInt(task?.periodDays, 10) || 0;
        const segment = this.getTaskScheduleSegments(task).find(item => this.isTaskScheduleSegmentDate(item, targetTime));
        return segment ? segment.periodDays : (parseInt(task?.periodDays, 10) || 0);
    }

    isTaskScheduleOccurrenceDraggable(task, dateStr) {
        const targetTime = this.parseTaskScheduleDate(dateStr);
        if (targetTime === null || this.parseTaskScheduleDate(task?.startDate) === null) return false;
        const segments = this.getTaskScheduleSegments(task);
        const current = segments[segments.length - 1];
        if (!current || current.startDate !== task.startDate || !this.isTaskScheduleSegmentDate(current, targetTime)) return false;
        return !segments.slice(0, -1).some(segment => this.isTaskScheduleSegmentDate(segment, targetTime));
    }

    getTaskScheduledDatesBetween(task, fromDate, toDate) {
        const fromTime = this.parseTaskScheduleDate(fromDate);
        const toTime = this.parseTaskScheduleDate(toDate);
        if (fromTime === null || toTime === null || fromTime > toTime) return [];
        const dates = new Set();
        for (const segment of this.getTaskScheduleSegments(task)) {
            const startTime = this.parseTaskScheduleDate(segment.startDate);
            const activeFrom = Math.max(fromTime, startTime, this.parseTaskScheduleDate(segment.fromDate));
            const untilTime = segment.untilDate ? this.parseTaskScheduleDate(segment.untilDate) : Infinity;
            const activeTo = Math.min(toTime, untilTime - 86400000);
            if (activeFrom > activeTo) continue;
            if (segment.periodDays <= 0) {
                if (startTime >= activeFrom && startTime <= activeTo) dates.add(segment.startDate);
                continue;
            }
            const step = segment.periodDays * 86400000;
            for (let time = startTime + Math.ceil((activeFrom - startTime) / step) * step; time <= activeTo; time += step) {
                dates.add(new Date(time).toISOString().slice(0, 10));
            }
        }
        return [...dates].sort();
    }

    getNextTaskScheduledDate(task, onOrAfter) {
        const lower = this.parseTaskScheduleDate(onOrAfter);
        if (lower === null) return '';
        let next = null;
        for (const segment of this.getTaskScheduleSegments(task)) {
            const start = this.parseTaskScheduleDate(segment.startDate);
            const from = this.parseTaskScheduleDate(segment.fromDate);
            const until = segment.untilDate ? this.parseTaskScheduleDate(segment.untilDate) : Infinity;
            const activeFrom = Math.max(lower, start, from);
            const step = segment.periodDays > 0 ? segment.periodDays * 86400000 : 0;
            const candidate = step ? start + Math.ceil((activeFrom - start) / step) * step : start;
            if (candidate >= activeFrom && candidate < until && (next === null || candidate < next)) next = candidate;
        }
        return next === null ? '' : new Date(next).toISOString().slice(0, 10);
    }

    replaceTaskScheduleFromDate(task, cutoffDate, nextStartDate, nextPeriodDays, effectiveDate = nextStartDate) {
        const cutoff = this.parseTaskScheduleDate(cutoffDate);
        const nextStart = nextStartDate === '' ? null : this.parseTaskScheduleDate(nextStartDate);
        const effective = this.parseTaskScheduleDate(effectiveDate);
        if (cutoff === null || (nextStartDate !== '' && nextStart === null) || effective === null) return false;
        const closed = [];
        for (const segment of this.getTaskScheduleSegments(task)) {
            const originalUntil = segment.untilDate ? this.parseTaskScheduleDate(segment.untilDate) : Infinity;
            const until = Math.min(originalUntil, cutoff);
            if (this.parseTaskScheduleDate(segment.fromDate) >= until) continue;
            closed.push({
                startDate: segment.startDate,
                periodDays: segment.periodDays,
                fromDate: segment.fromDate,
                untilDate: new Date(until).toISOString().slice(0, 10)
            });
        }
        task.scheduleHistory = closed;
        task.startDate = nextStartDate;
        task.periodDays = parseInt(nextPeriodDays, 10) || 0;
        task.scheduleEffectiveDate = effectiveDate;
        return true;
    }

    updateTaskScheduleFromEditor(task, nextStartDate, nextPeriodDays) {
        if (task.startDate === nextStartDate && (parseInt(task.periodDays, 10) || 0) === (parseInt(nextPeriodDays, 10) || 0)) return;
        const today = this.getLocalDateString();
        this.replaceTaskScheduleFromDate(task, today, nextStartDate, nextPeriodDays, today);
    }

    isScheduledTaskOccurrenceDone(task, scheduledDate, history = store.activeData.history || []) {
        if (!task?.id || !scheduledDate) return false;
        const taskId = String(task.id);
        const targetTime = this.parseTaskScheduleDate(scheduledDate);
        const segments = this.getTaskScheduleSegments(task);
        const matching = targetTime === null ? [] : segments.filter(segment => this.isTaskScheduleSegmentDate(segment, targetTime));
        const oneOff = segments.length === 1 && matching.length === 1 && matching[0].periodDays <= 0;
        const cache = history === store.activeData.history ? this._calendarRenderCache : null;
        if (cache?.completionByTaskDate && cache?.legacyCompletionByTask) {
            return cache.completionByTaskDate.has(JSON.stringify([taskId, String(scheduledDate)])) ||
                (oneOff && cache.legacyCompletionByTask.has(taskId));
        }
        return history.some(record => {
            if (!record?.taskId || String(record.taskId) !== taskId) return false;
            if (record.scheduledDate) return record.scheduledDate === scheduledDate;
            // Older records have only the work date. A one-off task has just one
            // occurrence; periodic records can only be matched safely on the same day.
            return oneOff || record.date === scheduledDate;
        });
    }

    updateTelop() {
        const telopText = document.getElementById('cal-telop-text');
        const telopContainer = document.getElementById('cal-telop-container');
        if (!telopText || !telopContainer) return;

        const today = this.getLocalDateString();
        const yesterday = new Date(this.parseTaskScheduleDate(today) - 86400000).toISOString().slice(0, 10);
        
        let unfinishedCount = 0;
        let details = [];
        const tasks = store.getTasks();
        
        tasks.forEach(t => {
            const segments = this.getTaskScheduleSegments(t);
            if (segments.length === 0) return;
            const earliest = segments.map(segment => segment.fromDate < segment.startDate ? segment.startDate : segment.fromDate).sort()[0];
            if (earliest > yesterday) return;

            const machine = store.getMachines(true).find(m => m.id === t.machineId);
            const modelLabel = MaintenanceApp.toHalfWidthLower(machine?.model || '？');

            let firstMiss = true;
            for (const dateStr of this.getTaskScheduledDatesBetween(t, earliest, yesterday)) {
                if (!this.isScheduledTaskOccurrenceDone(t, dateStr)) {
                    unfinishedCount++;
                    if (firstMiss) {
                        details.push(`${modelLabel}: ${t.content}`);
                        firstMiss = false;
                    }
                }
            }
        });

        if (unfinishedCount > 0) {
            telopContainer.classList.remove('all-clear');
            const separator = `<span style="color:var(--primary); margin:0 8px; font-weight:900;">|</span>`;
            telopText.innerHTML = `⚠️ <span style="margin-right:20px;">未完了の点検が <b>${unfinishedCount}件</b> あります：<b>${details.join(separator)}</b> などを早急に実施してください！</span>`;
        } else {
            telopContainer.classList.add('all-clear');
            telopText.innerHTML = `✅ <span style="margin-right:20px;">現在、未完了の定期メンテナンスはありません。良好な状態です。</span>`;
        }
    }

    getHistoryForDate(dateStr) {
        const cache = this._calendarRenderCache;
        const history = cache?.historyByDate ? (cache.historyByDate.get(dateStr) || []) : (store.activeData.history || []).filter(h => h.date === dateStr);
        return history.filter(h => !h.isManualGuide);
    }

    getScheduledTasksForDate(dateStr) {
        const cache = this._calendarRenderCache;
        if (cache?.scheduledByDate?.has(dateStr)) return cache.scheduledByDate.get(dateStr);
        const activeMachineIds = new Set(store.getMachines().map(m => m.id));
        const tasks = (store.activeData.tasks || []).filter(t => {
            if (!activeMachineIds.has(t.machineId)) return false;
            const periodDays = parseInt(t.periodDays) || 0;
            if (periodDays <= 0) return true;
            return !t.deleted && !store.isMaintenanceTaskArchived(t.id);
        });
        const scheduled = [];

        tasks.forEach(t => {
            if (this.isScheduledTaskOccurrenceDate(t, dateStr) && !this.isScheduledTaskOccurrenceDone(t, dateStr)) scheduled.push(t);
        });
        if (cache?.scheduledByDate) cache.scheduledByDate.set(dateStr, scheduled);
        return scheduled;
    }

    isCalendarSuddenResponseHistory(h) {
        if (!h || h.taskId || h.isManualGuide) return false;
        if (h.isDokatei || h.isNonProductionStop) return true;
        if (Object.prototype.hasOwnProperty.call(h, 'isSudden')) return h.isSudden === true;
        return true;
    }

    updateCalendarStats() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const lastDate = new Date(year, month + 1, 0).getDate();

        let totalRemaining = 0;
        let dokateiCount = 0;
        let dokateiTime = 0;
        let scheduledDoneCount = 0;
        let suddenCount = 0;
        const indexedHistory = this._calendarRenderCache?.historyByDate;

        for (let d = 1; d <= lastDate; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const history = indexedHistory ? (indexedHistory.get(dateStr) || []) : (store.activeData.history || []).filter(h => h.date === dateStr);
            scheduledDoneCount += history.filter(h => !!h.taskId).length;
            suddenCount += history.filter(h => this.isCalendarSuddenResponseHistory(h)).length;
            const scheduled = this.getScheduledTasksForDate(dateStr);
            totalRemaining += scheduled.length;
            const dokas = history.filter(h => h.isDokatei);
            dokateiCount += dokas.length;
            dokateiTime += dokas.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        }

        document.getElementById('cal-stat-remaining').textContent = totalRemaining;
        document.getElementById('cal-stat-done').textContent = scheduledDoneCount;
        document.getElementById('cal-stat-sudden-count').textContent = suddenCount;
        document.getElementById('cal-stat-dokatei-count').textContent = dokateiCount;
        document.getElementById('cal-stat-dokatei-time').textContent = dokateiTime;
    }

    // Helper to highlight text based on a search query, case and width insensitive
    highlightText(text, query) {
        if (!text || !query) return text || '';
        const terms = MaintenanceStore.toHalfWidthLower(query).split(/\s+/).filter(t => t);
        if (terms.length === 0) return text;

        // Create a matching string without trimming to preserve character indices
        const norm = text.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).toLowerCase();
        
        let matches = [];
        terms.forEach(term => {
            const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escaped, 'gi');
            let m;
            while ((m = regex.exec(norm)) !== null) {
                matches.push({ start: m.index, end: m.index + m[0].length });
            }
        });

        if (matches.length === 0) return text;

        // Sort and merge overlapping match ranges
        matches.sort((a, b) => a.start - b.start);
        const merged = [];
        if (matches.length > 0) {
            let cur = { ...matches[0] };
            for (let i = 1; i < matches.length; i++) {
                if (matches[i].start <= cur.end) {
                    cur.end = Math.max(cur.end, matches[i].end);
                } else {
                    merged.push(cur);
                    cur = { ...matches[i] };
                }
            }
            merged.push(cur);
        }

        let highlighted = '';
        let lastPos = 0;
        merged.forEach(m => {
            highlighted += text.substring(lastPos, m.start);
            highlighted += `<span class="highlight">${text.substring(m.start, m.end)}</span>`;
            lastPos = m.end;
        });
        highlighted += text.substring(lastPos);

        return highlighted;
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppCalendarSupportMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppCalendarSupportMethods.prototype[name];
        }
    }
})();
