(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppCalendarSupportMethods extends MaintenanceApp {
    handleTaskDrop(taskId, sourceDate, targetDate) {
        if (sourceDate === targetDate) return;
        const task = store.activeData.tasks.find(t => t.id === taskId);
        if (!task) return;

        const sDate = new Date(sourceDate);
        const tDate = new Date(targetDate);
        const diffTime = tDate.getTime() - sDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const isOneOff = (parseInt(task.periodDays) || 0) <= 0;
        const moveText = diffDays > 0 ? `${diffDays}日後に移動` : `${Math.abs(diffDays)}日前へ移動`;
        const confirmText = isOneOff
            ? `単発予定「${task.content}」の日付を ${moveText} しますか？`
            : `「${task.content}」の予定を ${moveText} してサイクルを調整しますか？`;

        if (confirm(confirmText)) {
            const currentStart = new Date(task.startDate);
            currentStart.setDate(currentStart.getDate() + diffDays);
            task.startDate = currentStart.getFullYear() + '-' + String(currentStart.getMonth() + 1).padStart(2, '0') + '-' + String(currentStart.getDate()).padStart(2, '0');
            store.save();
            this.renderCalendar();
        }
    }

    updateTelop() {
        const telopText = document.getElementById('cal-telop-text');
        const telopContainer = document.getElementById('cal-telop-container');
        if (!telopText || !telopContainer) return;

        const today = new Date();
        today.setHours(0,0,0,0);
        
        let unfinishedCount = 0;
        let details = [];
        const tasks = store.getTasks();
        
        tasks.forEach(t => {
            if (!t.startDate) return;
            const startDate = new Date(t.startDate);
            if (isNaN(startDate.getTime())) return;
            startDate.setHours(0,0,0,0);
            if (startDate > today) return;

            const machine = store.getMachines(true).find(m => m.id === t.machineId);
            const modelLabel = MaintenanceApp.toHalfWidthLower(machine?.model || '？');

            if (t.periodDays <= 0) {
                // One-off or invalid period
                if (t.startDate) {
                    const isDone = store.activeData.history.some(h => h.taskId === t.id && h.date === t.startDate);
                    if (!isDone && startDate < today) {
                        unfinishedCount++;
                        details.push(`${modelLabel}: ${t.content}`);
                    }
                }
            } else {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                
                let checkDate = new Date(startDate);
                let firstMiss = true;
                while (checkDate <= yesterday) {
                    const dateStr = checkDate.getFullYear() + '-' + String(checkDate.getMonth()+1).padStart(2,0) + '-' + String(checkDate.getDate()).padStart(2,0);
                    const isDone = store.activeData.history.some(h => h.taskId && String(h.taskId) === String(t.id) && h.date === dateStr);
                    if (!isDone) {
                        unfinishedCount++;
                        if (firstMiss) {
                            details.push(`${modelLabel}: ${t.content}`);
                            firstMiss = false; 
                        }
                    }
                    checkDate.setDate(checkDate.getDate() + t.periodDays);
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
        return store.activeData.history.filter(h => h.date === dateStr && !h.isManualGuide);
    }

    getScheduledTasksForDate(dateStr) {
        const [ty, tm, td] = dateStr.split('-').map(Number);
        const targetDate = new Date(ty, tm - 1, td);
        targetDate.setHours(0,0,0,0);
        const activeMachineIds = store.getMachines().map(m => m.id);
        const tasks = (store.activeData.tasks || []).filter(t => {
            if (!activeMachineIds.includes(t.machineId)) return false;
            const periodDays = parseInt(t.periodDays) || 0;
            if (periodDays <= 0) return true;
            return !t.deleted && !store.isMaintenanceTaskArchived(t.id);
        });
        const scheduled = [];

        tasks.forEach(t => {
            if (!t.startDate) return;
            const parts = t.startDate.split('-');
            if (parts.length !== 3) return;
            const [sy, sm, sd] = parts.map(Number);
            const startDate = new Date(sy, sm - 1, sd);
            if (isNaN(startDate.getTime())) return;
            startDate.setHours(0,0,0,0);
            if (startDate > targetDate) return;

            if (t.periodDays <= 0) {
                if (t.startDate === dateStr) {
                    const isDone = store.activeData.history.some(h => h.taskId && String(h.taskId) === String(t.id) && h.date === dateStr);
                    if (!isDone) scheduled.push(t);
                }
            } else {
                const diffTime = targetDate.getTime() - startDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays % t.periodDays === 0) {
                    const isDone = store.activeData.history.some(h => h.taskId && String(h.taskId) === String(t.id) && h.date === dateStr);
                    if (!isDone) scheduled.push(t);
                }
            }
        });
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
        let totalDone = 0;
        let dokateiCount = 0;
        let dokateiTime = 0;

        for (let d = 1; d <= lastDate; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            
            // Done count (Scheduled + Sudden)
            const history = store.activeData.history.filter(h => h.date === dateStr);
            totalDone += history.filter(h => h.taskId).length; // Only count scheduled tasks completion?
            // User likely wants ALL completions shown as 'Done' vs 'Remaining'
            // Let's count all history records as Done and Scheduled (not done) as Remaining
            
            const scheduled = this.getScheduledTasksForDate(dateStr);
            totalRemaining += scheduled.length;
            
            // Dokatei
            const dokas = history.filter(h => h.isDokatei);
            dokateiCount += dokas.length;
            dokateiTime += dokas.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        }

        // Re-count Done properly: Only scheduled tasks that were completed this month
        const allMonthHistory = store.activeData.history.filter(h => {
            const d = new Date(h.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
        
        const scheduledDoneCount = allMonthHistory.filter(h => !!h.taskId).length;
        const suddenCount = allMonthHistory.filter(h => this.isCalendarSuddenResponseHistory(h)).length;

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
