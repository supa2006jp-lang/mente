(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppAnalysisDashboardMethods extends MaintenanceApp {
    renderAnalysis(searchQuery = '') {
        const container = document.getElementById('analysis-container');
        if (!container) return;

        const qInput = document.getElementById('global-search');
        const query = (searchQuery || (qInput ? qInput.value : '')).toLowerCase().trim();
        const normQuery = query ? MaintenanceStore.toHalfWidthLower(query) : null;

        const pFilter = document.getElementById('analysis-filter-period');
        const period = pFilter?.value || 'this_month';
        const lineFilter = document.getElementById('analysis-filter-line')?.value || 'all';
        this.updateViewSubtitle('view-analysis', period);

        let history = store.getHistory({});
        history = this.filterHistoryByPeriod(history, period);
        const machines = store.getMachines(true);

        // ラインフィルタの適用
        if (lineFilter !== 'all') {
            history = history.filter(h => {
                const m = machines.find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                return String(l) === String(lineFilter);
            });
        }


        if (this.analysisMode === 'machines') {
            // Apply Periodic/Sudden filter
            if (this.costFilter === 'periodic') {
                history = history.filter(h => !h.isSudden);
            } else if (this.costFilter === 'sudden') {
                history = history.filter(h => h.isSudden);
            }
            this.renderMachineCostAnalysis(history);
            return;
        }

        const partMap = new Map();

        // 0. Pre-populate from Master (so parts with no history still show up)
        const masters = store.activeData.partsMaster || [];
        masters.forEach(m => {
            const key = `${m.name}::${m.model}`;
            partMap.set(key, { name: m.name, model: m.model, unit: m.unit || '個', records: [] });
        });

        // 1. Group records by Part (Name + Model) from filtered history
        history.forEach(h => {
            if (!h.replacedParts) return;
            h.replacedParts.forEach(p => {
                const master = store.getPartMaster(p.name, p.model);
                const canonName = master ? master.name : MaintenanceStore.toFullWidth(p.name);
                const canonModel = master ? master.model : MaintenanceStore.toHalfWidthLower(p.model || '');
                const key = `${canonName}::${canonModel}`;
                
                if (!partMap.has(key)) {
                    partMap.set(key, { name: canonName, model: canonModel, unit: p.unit || '個', records: [] });
                }
                // Push record with specific price at that time (if exists) or fallback via master lookup
                partMap.get(key).records.push({ 
                    date: h.date, 
                    count: parseFloat(p.count) || 0, 
                    price: parseFloat(p.price) || 0 
                });
            });
        });

        const now = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        container.innerHTML = '';
        if (partMap.size === 0) {
            container.innerHTML = '<div style="padding:40px; color:var(--text-light)">部品交換の履歴がまだありません</div>';
            return;
        }

        Array.from(partMap.values())
            .filter(part => !store.isPartArchived(part.name, part.model))
            .sort((a, b) => b.records.length - a.records.length)
            .forEach(part => {
            let isMatch = false;
            if (normQuery) {
                const terms = normQuery.split(/[\s　]+/).filter(Boolean);
                const searchStr = MaintenanceStore.toHalfWidthLower((part.name || '') + ' ' + (part.model || ''));
                isMatch = terms.every(t => searchStr.includes(t));
            }

            const card = document.createElement('div');
            card.className = 'card' + (isMatch ? ' search-match' : '');
            
            const totalUsed = part.records.reduce((sum, r) => sum + r.count, 0);
            const firstDate = new Date(Math.min(...part.records.map(r => new Date(r.date))));
            const lastDate = new Date(Math.max(...part.records.map(r => new Date(r.date))));
            const daysDiff = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
            
            const latestRecord = history.flatMap(h => h.replacedParts || [])
                                      .filter(p => MaintenanceStore.toFullWidth(p.name) === part.name && MaintenanceStore.toHalfWidthLower(p.model) === part.model)
                                      .sort((a,b) => new Date(b.date) - new Date(a.date))[0];

            const master = store.getPartMaster(part.name, part.model);
            const price = master?.price || latestRecord?.price || 0;
            const supplier = master?.supplier || '-';
            const shelf = master?.shelf || '';

            let priceDisplay = '価格未設定';
            if (master?.priceRaw && master.priceRaw.includes('/')) {
                const [pVal, wVal] = master.priceRaw.split('/');
                priceDisplay = `¥${Math.round(parseFloat(pVal)).toLocaleString()} / ${wVal}kg分`;
            } else if (price > 0) {
                const unitLabel = (part.unit === 'pcs' || part.unit === '個' || !part.unit) ? '個' : part.unit;
                if (unitLabel === '個') {
                    priceDisplay = `¥${Math.round(price).toLocaleString()}`;
                } else {
                    priceDisplay = `¥${Math.round(price).toLocaleString()} <span style="font-size:0.7rem; font-weight:400; color:var(--text-light);">(1${unitLabel}の値段)</span>`;
                }
            }

            const displayUnit = master?.unit || ((part.unit === 'pcs' || part.unit === '個' || !part.unit) ? '個' : part.unit);
            let yearlyEst = '計測中...';
            let yearlyCost = 0;
            if (part.records.length >= 2) {
                const dailyPace = totalUsed / daysDiff;
                const qty = dailyPace * 365;
                yearlyEst = `${Math.round(qty)} ${displayUnit}`;
                yearlyCost = Math.round(qty * price);
            }

            let paceDisplay = "-";
            if (part.records.length >= 2 && totalUsed > 0) {
                const daysPerUnit = daysDiff / totalUsed;
                if (displayUnit === 'g' || displayUnit === 'グラム') {
                    const daysPerKg = daysPerUnit * 1000;
                    paceDisplay = `約 ${daysPerKg.toFixed(1)} 日 / 1000g`;
                } else {
                    paceDisplay = `約 ${daysPerUnit.toFixed(1)} 日 / 1${displayUnit}`;
                }
            }

            const stock = master?.stock || 0;
            const minStock = master?.minStock || 0;
            const isLowStock = minStock > 0 && stock <= minStock;

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; gap:12px;">
                    <div class="img-box" style="width:50px; height:50px; border-radius:10px; position:relative;">
                        ${master?.photo ? `<img src="${master.photo}">` : '<i class="fa-solid fa-gear" style="font-size:1.2rem; color:#cbd5e1;"></i>'}
                        ${isLowStock ? '<div style="position:absolute; top:-8px; right:-12px; background:var(--danger); color:white; font-size:0.6rem; padding:2px 6px; border-radius:12px; font-weight:900; box-shadow:0 2px 4px rgba(0,0,0,0.2); animation:pulse 2s infinite;">在庫少</div>' : ''}
                    </div>
                    <div style="flex:1; overflow:hidden;">
                        <h4 style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:4px;" title="${part.name}">${this.highlightText(part.name, query)}</h4>
                        <div style="font-size:0.9rem; font-weight:900; color:var(--primary);">${priceDisplay}</div>
                    </div>
                    <button class="icon-btn" onclick="app.openPartMasterModal('${part.name.replace(/'/g, "\\'")}', '${part.model.replace(/'/g, "\\'")}')" title="マスター情報を編集" style="flex-shrink:0;">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="icon-btn" onclick="app.archivePart('${part.name.replace(/'/g, "\\'")}', '${part.model.replace(/'/g, "\\'")}')" title="アーカイブへ送る" style="flex-shrink:0; color:var(--text-light);">
                        <i class="fa-solid fa-box-archive"></i>
                    </button>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <p style="font-size:0.75rem; color:var(--text-light); font-weight:700; margin:0;">${this.highlightText(part.model, query)}</p>
                    ${shelf ? `<div style="font-size:0.65rem; background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:4px; font-weight:900; border:1px solid #e2e8f0;"><i class="fa-solid fa-location-dot" style="margin-right:4px;"></i>${shelf}</div>` : ''}
                </div>
                
                <div style="margin-bottom:12px; padding:10px; background:${isLowStock ? '#fee2e2' : '#f0fdf4'}; border-radius:8px; border:1px solid ${isLowStock ? '#fecaca' : '#dcfce7'};">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <div style="font-size:0.65rem; color:${isLowStock ? 'var(--danger)' : '#166534'}; font-weight:800;">現在庫状況</div>
                        <div style="font-size:1.3rem; font-weight:950; color:${isLowStock ? 'var(--danger)' : '#166534'}; line-height:1;">
                            ${Math.round(stock)} <span style="font-size:0.7rem; font-weight:700;">${displayUnit}</span>
                        </div>
                    </div>
                    ${minStock > 0 ? `
                        <div style="font-size:0.65rem; color:var(--text-light); margin-top:4px; display:flex; justify-content:space-between;">
                            <span>アラート閾値: ${minStock}</span>
                            <span>${isLowStock ? '<b>⚠️ 要発注</b>' : '適正'}</span>
                        </div>
                    ` : ''}
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <div style="font-size:0.65rem; color:var(--text-light)">合計使用数 / 消費ペース</div>
                        <div style="font-weight:900; font-size:1.1rem">${Math.round(totalUsed)} <span style="font-size:0.7rem">${displayUnit}</span></div>
                        <div style="font-size:0.7rem; color:var(--primary); font-weight:800; margin-top:2px;">( ${paceDisplay} )</div>
                    </div>
                    <div>
                        <div style="font-size:0.65rem; color:var(--text-light)">仕入先</div>
                        <div style="font-weight:700; font-size:0.85rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${supplier}</div>
                    </div>
                    <div style="grid-column: span 1; border-top:1px solid var(--border); padding-top:12px;">
                        <div style="font-size:0.65rem; color:var(--text-light)">年間推定消費量</div>
                        <div style="font-weight:900; font-size:1.1rem; color:var(--primary)">${yearlyEst}</div>
                    </div>
                    <div style="grid-column: span 1; border-top:1px solid var(--border); padding-top:12px;">
                        <div style="font-size:0.65rem; color:var(--text-light)">年間推定コスト</div>
                        <div style="font-weight:900; font-size:1.1rem; color:var(--danger)">${yearlyCost > 0 ? `¥${yearlyCost.toLocaleString()}` : '-'}</div>
                    </div>
                </div>
                ${master?.remarks ? `<div style="margin-top:12px; font-size:0.7rem; color:var(--text-light); background:var(--background); padding:6px; border-radius:4px;">${master.remarks}</div>` : ''}
            `;
            container.appendChild(card);
        });
    }

    getTodayActionSummary() {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const todos = store.activeData.localTodos || [];
        const pendingRequests = todos.filter(todo => todo.isRequest && !todo.archived && (todo.status || 'todo') !== 'done');
        const overdueTodos = pendingRequests.filter(todo => todo.deadlineDate && todo.deadlineDate < todayStr);
        const todayTodos = pendingRequests.filter(todo => !todo.deadlineDate || todo.deadlineDate <= todayStr);
        const tasks = (store.activeData.tasks || []).filter(task => !task.deleted && !store.isMaintenanceTaskArchived(task.id));
        const todayTasks = tasks.filter(task => !task.startDate || task.startDate <= todayStr).slice(0, 20);
        const importantRows = [];
        Object.entries(store.activeData.shiftNotebooks?.[todayStr] || {}).forEach(([shift, shiftData]) => {
            const label = this.getShiftNotebookLabel(shift);
            const rows = Array.isArray(shiftData) ? shiftData : (shiftData?.rows || []);
            rows.forEach((row, index) => {
                if (row.important) importantRows.push({ shift, label, row, index });
            });
        });
        return { todayStr, pendingRequests, overdueTodos, todayTodos, todayTasks, importantRows };
    }

    getCurrentShiftNotebookTarget(now = new Date()) {
        const target = new Date(now);
        const hour = now.getHours();
        let shift = 'early';
        if (hour >= 13 && hour <= 20) {
            shift = 'late';
        } else if (hour >= 21) {
            shift = 'night';
        } else if (hour < 5) {
            shift = 'night';
            target.setDate(target.getDate() - 1);
        }
        const dateStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
        return { dateStr, shift, label: this.getShiftNotebookLabel(shift) };
    }

    openCurrentShiftNotebookFromDashboard() {
        const target = this.getCurrentShiftNotebookTarget();
        this.switchView('calendar', { force: true });
        this.openShiftNotebookModal(target.dateStr, target.shift);
    }

    updateSidebarCurrentShiftLink() {
        const badge = document.getElementById('sidebar-current-shift-badge');
        if (!badge) return;
        const target = this.getCurrentShiftNotebookTarget();
        badge.textContent = target.label.stamp;
        badge.className = `sidebar-shift-badge ${target.shift}`;
        badge.title = `${target.dateStr} ${target.label.name}`;
    }

    getTodayActionPanelHtml() {
        const summary = this.getTodayActionSummary();
        const shiftTarget = this.getCurrentShiftNotebookTarget();
        const itemHtml = [
            ...summary.overdueTodos.slice(0, 4).map(todo => `
                <button type="button" class="today-action-item danger" onclick="app.openPendingTodoRequest('${this.escapeJs(todo.id)}')">
                    <b>期限切れ</b><span>${this.escapeHtml(todo.title || '無題')}</span>
                </button>
            `),
            ...summary.todayTodos.filter(todo => !summary.overdueTodos.includes(todo)).slice(0, 4).map(todo => `
                <button type="button" class="today-action-item" onclick="app.openPendingTodoRequest('${this.escapeJs(todo.id)}')">
                    <b>依頼</b><span>${this.escapeHtml(todo.title || '無題')}</span>
                </button>
            `),
            ...summary.importantRows.slice(0, 4).map(item => `
                <button type="button" class="today-action-item important" onclick="app.openShiftNotebookModal('${summary.todayStr}', '${this.escapeJs(item.shift)}', ${item.index})">
                    <b>重要連絡</b><span>${this.escapeHtml(item.label?.name || '')} / ${this.escapeHtml(item.row.text || '本文なし')}</span>
                </button>
            `)
        ].slice(0, 10).join('');
        return `
            <div class="today-action-panel" data-dashboard-card="today">
                <div class="today-action-head">
                    <div>
                        <h3><i class="fa-solid fa-sun"></i> 今日やること</h3>
                        <p>${summary.todayStr} の未処理依頼・期限切れ・重要連絡</p>
                    </div>
                    <div class="today-action-head-actions">
                        <button type="button" class="today-shift-link" onclick="app.openCurrentShiftNotebookFromDashboard()" title="現在時刻のシフト連絡帳へ">
                            <i class="fa-solid fa-book-open"></i>
                            連絡帳 ${this.escapeHtml(shiftTarget.label.stamp)}
                            <small>${this.escapeHtml(shiftTarget.dateStr)}</small>
                        </button>
                        <button type="button" onclick="app.openKanbanRequestDashboard()">依頼一覧</button>
                    </div>
                </div>
                <div class="today-action-stats">
                    <button type="button" onclick="app.switchView('todos'); app.changeKanbanTodoWorker('__all__')"><span>未完了依頼</span><b>${summary.pendingRequests.length}</b></button>
                    <button type="button" onclick="app.switchView('todos'); app.toggleKanbanOverdueOnly(true)"><span>期限切れ</span><b>${summary.overdueTodos.length}</b></button>
                    <button type="button" onclick="app.switchView('calendar')"><span>定期メンテ候補</span><b>${summary.todayTasks.length}</b></button>
                    <button type="button" onclick="app.switchView('calendar')"><span>重要連絡</span><b>${summary.importantRows.length}</b></button>
                </div>
                <div class="today-action-list">
                    ${itemHtml || '<div class="today-action-empty">今日の優先確認項目はありません</div>'}
                </div>
            </div>
        `;
    }

    renderDashboard() {
        const container = document.getElementById('dashboard-widgets');
        if (!container) return;
        this.updateSidebarCurrentShiftLink();

        const period = this.dashboardPeriod || 'this_month';
        if (!this.dashboardPeriod) this.dashboardPeriod = period;
        this.updateViewSubtitle('view-dashboard', period);

        let history = store.activeData.history || [];
        history = this.filterHistoryByPeriod(history, period);

        const periodicTime = history.filter(h => !!h.taskId).reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const dokateiTime = history.filter(h => h.isDokatei).reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const suddenTime = history.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop).reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const nonProductionStopTime = history.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop).reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        
        const totalTime = periodicTime + suddenTime + nonProductionStopTime + dokateiTime;
        const suddenCount = history.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop).length;
        const nonProductionStopCount = history.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop).length;
        const dokateiCount = history.filter(h => h.isDokatei).length;
        const suddens = history.filter(h => !h.taskId && !h.isNonProductionStop && h.date);
        const dokateis = history.filter(h => h.isDokatei).sort((a, b) => (parseInt(b.workTime) || 0) - (parseInt(a.workTime) || 0));
        
        // Past 3 months fixed filter for Worst History
        const date3M = new Date(); date3M.setMonth(date3M.getMonth() - 3);
        const date3MStr = date3M.toISOString().split('T')[0];
        const dokateis3M = (store.activeData.history || []).filter(h => h.isDokatei && h.date >= date3MStr).sort((a, b) => (parseInt(b.workTime) || 0) - (parseInt(a.workTime) || 0));

        const totalTroubleTime = suddenTime + nonProductionStopTime + dokateiTime;
        const totalTroubleCount = suddenCount + nonProductionStopCount + dokateiCount;
        const avgMttr = totalTroubleCount > 0 ? (totalTroubleTime / totalTroubleCount).toFixed(1) : 0;
        const periodLabel = this.getPeriodLabel(period);

        let mtbf = '-';
        if (suddens.length >= 2) {
            const dates = suddens.map(h => new Date(h.date).getTime()).sort((a,b) => a - b);
            const totalRangeDays = (dates[dates.length-1] - dates[0]) / (24 * 60 * 60 * 1000);
            mtbf = (totalRangeDays / (suddens.length - 1)).toFixed(1);
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        const yestStr = yest.toISOString().split('T')[0];
        const recentHistory = store.activeData.history.filter(h => h.date === todayStr || h.date === yestStr);
        recentHistory.sort((a,b) => new Date(b.date) - new Date(a.date));
        const actionSummary = this.getTodayActionSummary();
        const todos = store.activeData.localTodos || [];
        const activeTodos = todos.filter(todo => {
            const status = todo.status || (todo.done ? 'done' : 'todo');
            return !todo.archived && status !== 'done';
        });
        const doneTodos = todos.filter(todo => {
            const status = todo.status || (todo.done ? 'done' : 'todo');
            return !todo.archived && status === 'done';
        });
        const fiveSRows = typeof this.collectFiveSNotebookRows === 'function' ? this.collectFiveSNotebookRows('this_month') : [];
        const fiveSPendingRows = fiveSRows.filter(row => {
            const related = typeof this.getFiveSRowRelatedTodos === 'function' ? this.getFiveSRowRelatedTodos(row) : [];
            return related.some(todo => !todo.archived && (todo.status || 'todo') !== 'done');
        });
        const lowStockParts = store.getLowStockParts();
        const alertItems = [
            actionSummary.overdueTodos.length ? { key: 'danger', icon: 'fa-clock', label: `期限切れ ${actionSummary.overdueTodos.length}件` } : null,
            lowStockParts.length ? { key: 'warn', icon: 'fa-box-open', label: `在庫不足 ${lowStockParts.length}件` } : null,
            dokateiCount ? { key: 'danger', icon: 'fa-bolt', label: `ドカ停 ${dokateiCount}件` } : null,
            actionSummary.importantRows.length ? { key: 'warn', icon: 'fa-star', label: `重要連絡 ${actionSummary.importantRows.length}件` } : null
        ].filter(Boolean);

        container.classList.add('dashboard-shell');
        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(24, minmax(0, 1fr))';
        container.style.gap = '10px';

        container.innerHTML = `
            ${this.getTodayActionPanelHtml()}
            <div class="dashboard-alert-strip" data-dashboard-card="alerts">
                <div>
                    <b><i class="fa-solid fa-bell"></i> 重要アラート</b>
                    <span>${alertItems.length ? '確認が必要な項目があります' : '現在、大きな注意項目はありません'}</span>
                </div>
                <div class="dashboard-alert-items">
                    ${alertItems.length ? alertItems.map(item => `
                        <span class="${item.key}"><i class="fa-solid ${item.icon}"></i>${item.label}</span>
                    `).join('') : '<span class="ok"><i class="fa-solid fa-circle-check"></i> 異常なし</span>'}
                </div>
            </div>

            <div class="dashboard-flow-panel" data-dashboard-card="flow">
                <div class="dashboard-flow-head">
                    <h4><i class="fa-solid fa-route"></i> 5S / ToDo / 連絡帳の流れ</h4>
                    <span class="dashboard-period-chip">今日・今月</span>
                </div>
                <div class="dashboard-flow-steps">
                    <button type="button" class="dashboard-flow-step dashboard-clickable" onclick="app.openCurrentShiftNotebookFromDashboard()">
                        <span>連絡帳</span><b>${actionSummary.importantRows.length}</b><small>今日の重要連絡</small>
                    </button>
                    <i class="fa-solid fa-chevron-right"></i>
                    <button type="button" class="dashboard-flow-step dashboard-clickable" onclick="app.switchView('todos'); app.changeKanbanTodoWorker('__all__')">
                        <span>ToDo</span><b>${activeTodos.length}</b><small>未完了</small>
                    </button>
                    <i class="fa-solid fa-chevron-right"></i>
                    <button type="button" class="dashboard-flow-step dashboard-clickable" onclick="app.switchView('todos')">
                        <span>完了</span><b>${doneTodos.length}</b><small>処理済</small>
                    </button>
                    <i class="fa-solid fa-chevron-right"></i>
                    <button type="button" class="dashboard-flow-step dashboard-clickable" onclick="app.switchView('fiveS')">
                        <span>5S確認</span><b>${fiveSRows.length}</b><small>${fiveSPendingRows.length ? `未完了 ${fiveSPendingRows.length}件` : '今月履歴'}</small>
                    </button>
                </div>
            </div>

            <div class="card dashboard-card dashboard-recent-card" data-dashboard-card="recent" style="margin-bottom: 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid var(--border); padding-bottom:6px;">
                    <h4 style="margin:0; color:var(--text-main);"><i class="fa-solid fa-clock-rotate-left" style="color:var(--primary); margin-right:8px;"></i>直近の活動（今日・昨日）</h4>
                    <span class="badge" style="background:var(--primary-light); color:var(--primary);">${recentHistory.length}件</span>
                </div>
                <div class="dashboard-timeline">
                    ${recentHistory.length > 0 ? recentHistory.map(h => {
                        const m = store.getMachines(true).find(machine => machine.id === h.machineId);
                        const isToday = h.date === todayStr;
                        const dateBadge = isToday 
                            ? '<span style="background:var(--danger); color:white; padding:2px 6px; border-radius:4px; font-size:0.65rem; font-weight:900; margin-right:8px;">今日</span>'
                            : '<span style="background:var(--secondary); color:white; padding:2px 6px; border-radius:4px; font-size:0.65rem; font-weight:900; margin-right:8px;">昨日</span>';
                        
                        let photoHtml = '<i class="fa-solid fa-gear" style="font-size:1rem; color:#cbd5e1;"></i>';
                        if (m && m.photo) {
                            photoHtml = '<img src="' + m.photo + '">';
                        }
                        
                        const mName = m ? m.name : '不明';
                        const mModel = MaintenanceApp.toHalfWidthLower(m && m.model ? m.model : '');
                        const taskText = this.getHistoryDisplayText(h);
                        const wTime = this.formatHistoryWorkTime(h);
                        const workers = (h.workers || []).join(', ') || '未設定';
                        
                        let rPhotosHtml = '';
                        if (h.photos && h.photos.length > 0) {
                            rPhotosHtml = h.photos.map(p => '<div class="img-box" style="width:60px; height:60px; border-radius:6px; border:1px solid var(--border); box-shadow:0 1px 3px rgba(0,0,0,0.1); flex-shrink:0;"><img src="' + p + '" alt="添付画像" style="object-fit:cover; width:100%; height:100%;"></div>').join('');
                        }
                        
                        const lineInfo = h.lineNo || m?.lineNo;
                        const lineBadge = this.getLineBadge(lineInfo);
                        
                        const catBadge = (h.machineCategory || m?.category) ? '<span style="font-size:0.65rem; color:var(--text-light); font-weight:800; margin-left:6px;"><i class="fa-solid fa-tag"></i> ' + (h.machineCategory || m.category) + '</span>' : '';
                        
                        return '<div class="dashboard-timeline-item dashboard-clickable" onclick="app.switchView(\'history\'); document.getElementById(\'global-search\').value=\'' + h.date + '\'; app.renderHistory();">' +
                                '<div class="dashboard-timeline-date">' + (isToday ? '今日' : '昨日') + '</div>' +
                                '<div class="dashboard-timeline-main">' +
                                    '<b>' + lineBadge + ' ' + mName + ' [' + mModel + ']</b>' +
                                    '<span>' + taskText + '</span>' +
                                    '<small><i class="fa-regular fa-clock"></i> ' + wTime + ' / ' + workers + '</small>' +
                                '</div>' +
                                '<button type="button" class="icon-btn" onclick="event.stopPropagation(); app.openHistoryEditForm(\'' + h.id + '\');" title="この記録を編集"><i class="fa-solid fa-pen-to-square"></i></button>' +
                        '</div>';
                    }).join('') : '<div class="dashboard-empty-compact">昨日から今日のメンテナンス記録はありません</div>'}
                </div>
            </div>

            <div class="dashboard-section dashboard-time-section" data-dashboard-card="time">
                <div class="dashboard-section-head">
                    <h4><i class="fa-solid fa-calculator"></i> メンテ時間 集計</h4>
                    <div class="dashboard-period-control">
                        <span class="dashboard-period-chip">${this.escapeHtml(periodLabel)}</span>
                        <select id="dashboard-filter-period" onchange="app.dashboardPeriod=this.value; app.onPeriodChange(this, () => app.renderDashboard())" 
                                style="font-size:0.75rem; padding:4px 10px; border-radius:99px; border:1px solid var(--border); background:white; font-weight:800; cursor:pointer;">
                            ${this.generatePeriodOptionsHTML(period)}
                        </select>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <div class="card dashboard-metric-card dashboard-clickable" style="padding:10px; border-top:4px solid var(--primary); cursor:pointer;" onclick="app.switchView('history'); document.getElementById('hist-filter-period').value='${period}'; document.getElementById('hist-filter-type').value='periodic'; app.renderHistory();">
                        <div style="font-size:0.65rem; font-weight:800; color:var(--text-light); margin-bottom:4px;">定期保全 合計</div>
                        <div style="font-size:1.6rem; font-weight:900; color:var(--primary); line-height:1.2;">${periodicTime}<span style="font-size:0.8rem">分</span></div>
                        <div style="font-size:0.65rem; margin-top:4px; opacity:0.8;">${history.filter(h=>!!h.taskId).length}件の実施履歴</div>
                    </div>
                    <div class="card dashboard-metric-card dashboard-clickable" style="padding:10px; border-top:4px solid var(--success); cursor:pointer;" onclick="app.switchView('history'); document.getElementById('hist-filter-period').value='${period}'; document.getElementById('hist-filter-type').value='sudden'; app.renderHistory();">
                        <div style="font-size:0.65rem; font-weight:800; color:var(--text-light); margin-bottom:4px;">突発故障（生産停止）</div>
                        <div style="font-size:1.6rem; font-weight:900; color:var(--success); line-height:1.2;">${suddenTime}<span style="font-size:0.8rem">分</span></div>
                        <div style="font-size:0.65rem; margin-top:4px; opacity:0.8;">${suddenCount}件の停止トラブル</div>
                    </div>
                    <div class="card dashboard-metric-card dashboard-clickable" style="padding:10px; border-top:4px solid #f59e0b; cursor:pointer;" onclick="app.switchView('history'); document.getElementById('hist-filter-period').value='${period}'; document.getElementById('hist-filter-type').value='nonProductionStop'; app.renderHistory();">
                        <div style="font-size:0.65rem; font-weight:800; color:var(--text-light); margin-bottom:4px;">非生産停止トラブル</div>
                        <div style="font-size:1.6rem; font-weight:900; color:#d97706; line-height:1.2;">${nonProductionStopTime}<span style="font-size:0.8rem">分</span></div>
                        <div style="font-size:0.65rem; margin-top:4px; opacity:0.8;">${nonProductionStopCount}件の非停止メンテ</div>
                    </div>
                    <div class="card dashboard-metric-card dashboard-clickable" style="padding:10px; border-top:4px solid var(--danger); cursor:pointer;" onclick="app.switchView('history'); document.getElementById('hist-filter-period').value='${period}'; document.getElementById('hist-filter-type').value='dokatei'; app.renderHistory();">
                        <div style="font-size:0.65rem; font-weight:800; color:var(--text-light); margin-bottom:4px;">ドカ停（重大）</div>
                        <div style="font-size:1.6rem; font-weight:900; color:var(--danger); line-height:1.2;">${dokateiTime}<span style="font-size:0.8rem">分</span></div>
                        <div style="font-size:0.65rem; margin-top:4px; opacity:0.8;">${dokateiCount}件の生産停止</div>
                    </div>
                    <div class="card dashboard-metric-card" style="padding:10px; border-top:4px solid var(--secondary); background:var(--secondary-light);">
                        <div style="font-size:0.65rem; font-weight:800; color:var(--text-light); margin-bottom:4px;">MTBF / MTTR</div>
                        <div style="font-size:1.1rem; font-weight:900; color:var(--secondary); margin-bottom:2px;">間隔: ${mtbf}日</div>
                        <div style="font-size:1.1rem; font-weight:900; color:var(--danger);">修理: ${avgMttr}分</div>
                    </div>
                </div>
            </div>

            <div class="card dashboard-card dashboard-chart-card" data-dashboard-card="chart" style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height: 220px; padding-top: 12px;">
                <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0;">時間・内容内訳 (%)</h4>
                    <div style="display:flex; align-items:center; gap:8px;"><span class="dashboard-period-chip">${this.escapeHtml(periodLabel)}</span><div style="font-size:0.75rem; font-weight:800; color:var(--text-light)">合計: ${totalTime}分</div></div>
                </div>
                <div style="width:150px; height:150px; position:relative;">
                    <canvas id="dashboard-pie-chart"></canvas>
                </div>
                <div style="display:flex; gap:10px; margin-top:8px; font-size:0.65rem; font-weight:800;">
                    <span><i class="fa-solid fa-circle" style="color:#2563eb"></i> 定期</span>
                    <span><i class="fa-solid fa-circle" style="color:#10b981"></i> 突発(停止)</span>
                    <span><i class="fa-solid fa-circle" style="color:#f59e0b"></i> 非停止</span>
                    <span><i class="fa-solid fa-circle" style="color:#ef4444"></i> ドカ停</span>
                </div>
            </div>

            <div class="card dashboard-card dashboard-alert-card" data-dashboard-card="stock" style="display:flex; flex-direction:column; border-top: 4px solid var(--primary); padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0; border:none; padding-left:0; font-weight:900;"><i class="fa-solid fa-box-open" style="color:var(--primary); margin-right:8px;"></i>部品在庫アラート</h4>
                    <span class="badge" style="background:var(--danger-light); color:var(--danger);">${lowStockParts.length}件</span>
                </div>
                <div style="flex:1; display:flex; flex-direction:column; gap:6px; overflow-y:auto; max-height:180px; padding-right:3px;">
                    ${(() => {
                        if (lowStockParts.length === 0) return '<div class="dashboard-empty-compact"><i class="fa-solid fa-circle-check"></i> 現在、在庫不足はありません</div>';
                        return lowStockParts.slice(0, 3).map(p => {
                            const stats = this.getPartUsageStats(p.name, p.model);
                            const unit = p.unit || '個';
                            return `
                            <div class="hover-shadow dashboard-clickable" style="padding:12px; background:white; border-radius:12px; border:1px solid #fecaca; display:flex; gap:12px; align-items:start; cursor:pointer;" onclick="app.openPartMasterModal('${p.name.replace(/'/g, "\\'")}', '${p.model.replace(/'/g, "\\'")}')">
                                <div class="img-box" style="width:44px; height:44px; border-radius:8px; flex-shrink:0; background:#f8fafc;">
                                    ${p.photo ? `<img src="${p.photo}">` : '<i class="fa-solid fa-box" style="color:#cbd5e1; font-size:1.1rem;"></i>'}
                                </div>
                                <div style="min-width:0; flex:1;">
                                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
                                        <div style="font-size:0.8rem; font-weight:900; line-height:1.2; flex:1; min-width:0;">
                                            <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                                            <div style="font-size:0.65rem; color:var(--secondary); font-weight:700;">[${p.model || '-'}]</div>
                                        </div>
                                        ${p.shelf ? `<span style="font-size:0.6rem; color:#475569; background:#f1f5f9; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:800; white-space:nowrap; border:1px solid #e2e8f0;">棚:${p.shelf}</span>` : ''}
                                    </div>
                                    
                                    <div style="display:flex; justify-content:space-between; align-items:end; margin-bottom:6px; border-bottom:1px dashed #fee2e2; padding-bottom:6px;">
                                        <div style="line-height:1;">
                                            <div style="font-size:0.6rem; color:var(--text-light); margin-bottom:2px;">在庫 / 閾値</div>
                                            <b style="color:var(--danger); font-size:1.1rem;">${p.stock}<small style="font-size:0.65rem; font-weight:800;">${unit}</small></b>
                                            <span style="font-size:0.65rem; color:var(--text-light); font-weight:700;"> / ${p.minStock}</span>
                                        </div>
                                        <div style="text-align:right;">
                                            <div style="font-size:0.6rem; color:var(--text-light); margin-bottom:2px;">消費サイクル</div>
                                            <div style="font-size:0.75rem; font-weight:900; color:var(--text-main);">${stats.cycle} <small style="font-size:0.6rem; color:var(--text-light); font-weight:700;">/ ${unit}</small></div>
                                        </div>
                                    </div>

                                    <div style="display:flex; gap:10px; font-size:0.65rem; color:var(--text-light); font-weight:700;">
                                        <span style="display:flex; align-items:center; gap:3px;"><i class="fa-solid fa-tag"></i> ¥${(p.price || 0).toLocaleString()}</span>
                                        <span style="display:flex; align-items:center; gap:3px; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><i class="fa-solid fa-truck-fast"></i> ${p.supplier || '未指定'}</span>
                                    </div>
                                </div>
                            </div>
                        `;}).join('') + (lowStockParts.length > 3 ? `<button type="button" class="secondary-btn dashboard-more-btn" onclick="app.switchView('machines')">他 ${lowStockParts.length - 3}件を見る</button>` : '');
                    })()}
                </div>
            </div>

            <div class="card dashboard-card dashboard-counter-card" data-dashboard-card="counter" style="padding: 12px; background: white; border-top: 4px solid var(--danger); display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0; font-weight:900; color:var(--text-main);">
                        <i class="fa-solid fa-stopwatch" style="color:var(--danger); margin-right:8px;"></i>
                        ドカ停ゼロ 継続日数
                    </h4>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:0.7rem; color:var(--text-light); font-weight:700;">日数カウント</span>
                        <button class="icon-btn" onclick="app.addDokateiCounter()" title="カウンターを追加" style="color:var(--primary); font-size:1.1rem; border:none; background:none; cursor:pointer;"><i class="fa-solid fa-circle-plus"></i></button>
                    </div>
                </div>
                <div style="flex:1; display:flex; flex-direction:column; gap:8px; overflow-y:auto; max-height:300px; padding-right:3px;">
                    ${(store.activeData.dokateiCounters || []).map((c, i) => {
                        const days = c.lastDate ? Math.floor((new Date() - new Date(c.lastDate)) / (86400000)) : '-';
                        const dayColor = days === '-' ? 'var(--text-light)' : (days > 180 ? 'var(--success)' : (days > 30 ? 'var(--primary)' : 'var(--danger)'));
                        return `
                        <div style="position:relative; display:flex; gap:10px; padding:12px 10px 10px 10px; background:var(--background); border-radius:12px; border:1px solid var(--border); align-items:stretch; transition:var(--transition);">
                                <button class="icon-btn" onclick="app.removeDokateiCounter(${i})" title="削除" style="position:absolute; top:4px; left:4px; border:none; background:none; font-size:0.8rem; color:var(--text-light); opacity:0.5; cursor:pointer; z-index:10;"><i class="fa-solid fa-xmark"></i></button>
                                <div style="flex:1; display:flex; flex-direction:column; gap:4px; min-width:0; justify-content:center; padding-left:12px;">
                                    <input type="text" placeholder="場所・ライン名" value="${c.location}" 
                                           onchange="app.updateDokateiCounter(${i}, 'location', this.value)"
                                           style="width:100%; padding:4px 10px; border-radius:6px; border:1px solid var(--border); font-size:0.8rem; font-weight:800; background:white; min-width:0;">
                                    <input type="date" value="${c.lastDate}" 
                                           onchange="app.updateDokateiCounter(${i}, 'lastDate', this.value)"
                                           style="width:100%; padding:4px 8px; border-radius:6px; border:1px solid var(--border); font-size:0.8rem; font-weight:800; background:white;">
                                </div>
                                <div style="min-width:85px; text-align:center; padding:8px 4px; background:white; border-radius:12px; border:3px solid ${dayColor}; display:flex; flex-direction:column; justify-content:center; align-items:center; box-shadow:0 3px 5px rgba(0,0,0,0.06);">
                                    <div style="font-size:2.2rem; font-weight:950; color:${dayColor}; line-height:1;">${days}</div>
                                    <div style="font-size:0.7rem; font-weight:900; color:${dayColor}; line-height:1; margin-top:4px; opacity:0.8;">DAYS</div>
                                </div>
                        </div>
                        `;
                    }).join('')}
                    ${(store.activeData.dokateiCounters || []).length === 0 ? '<div class="dashboard-empty-compact">カウンターなし。右上の＋で追加できます</div>' : ''}
                </div>
            </div>

            <div class="card dashboard-card dashboard-worst-card" data-dashboard-card="worst" style="display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h4 style="margin:0; border-left:4px solid var(--danger); padding-left:8px;">直近3ヶ月のドカ停ワースト履歴（修理時間順）</h4>
                    <span class="badge badge-dokatei" style="background:#fee2e2; color:#b91c1c;">${dokateis3M.length}件</span>
                </div>
                <div style="flex:1; display:flex; flex-direction:column; gap:7px; overflow-y:auto; max-height:300px; padding-right:3px;">
                    ${dokateis3M.slice(0, 10).map((h, index) => {
                        const m = store.getMachines(true).find(machine => machine.id === h.machineId);
                        const lineInfo = h.lineNo || m?.lineNo;
                        const lineBadge = this.getLineBadge(lineInfo);
                        const catText = h.machineCategory || m?.category;
                        const categoryBadge = catText ? `<span style="background:var(--primary-light); color:var(--primary); padding:1px 6px; border-radius:3px; font-size:0.6rem; font-weight:900; margin-right:4px;">${catText}</span>` : '';
                        const photoIcon = (h.photos && h.photos.length > 0) ? '<i class="fa-solid fa-camera" style="color:var(--primary); margin-left:5px; font-size:0.7rem;"></i>' : '';
                        const workers = (h.workers || []).join(', ') || '未設定';

                        let recordPhotosHtml = '';
                        if (h.photos && h.photos.length > 0) {
                            recordPhotosHtml = h.photos.map(p => `<div class="img-box" style="width:60px; height:60px; border-radius:6px; border:1px solid var(--border); box-shadow:0 1px 3px rgba(0,0,0,0.1); flex-shrink:0;"><img src="${p}" alt="添付画像" style="object-fit:cover; width:100%; height:100%;"></div>`).join('');
                        }
                        
                        return `
                        <div class="dashboard-rank-row dashboard-clickable ${index < 3 ? 'top' : ''}" onclick="app.switchView('history'); document.getElementById('global-search').value='${h.date}'; app.renderHistory();">
                                <div class="dashboard-rank-no">${index + 1}</div>
                                <div class="img-box" style="width:45px; height:45px; border-radius:10px; flex-shrink:0;">
                                    ${m?.photo ? `<img src="${m.photo}">` : '<i class="fa-solid fa-industry" style="font-size:1rem; color:#cbd5e1;"></i>'}
                                </div>
                                <div style="min-width:0; margin-right:15px;">
                                    <div style="font-size:0.85rem; font-weight:800; color:var(--text-main); line-height:1.3; margin-bottom:2px;">
                                        ${lineBadge}${categoryBadge}${m?.name || '不明'} [${MaintenanceApp.toHalfWidthLower(m?.model || '')}]
                                    </div>
                                    <div style="font-size:0.75rem; font-weight:700; color:var(--primary); margin-bottom:4px;">${this.getHistoryDisplayText(h)}${photoIcon}</div>
                                    <div style="font-size:0.7rem; color:var(--text-light); line-height:1.4; margin-bottom:4px; max-width:400px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                        ${h.cause ? `原因: ${h.cause}` : ''} ${h.notes ? `| 処置: ${h.notes}` : ''}
                                    </div>
                                    <div style="font-size:0.65rem; color:var(--text-light); display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                        <span style="display:inline-block; background:var(--danger-light); color:var(--danger); padding:1px 6px; border-radius:4px; font-weight:900;">${this.escapeHtml(this.formatHistoryWorkTime(h))}</span>
                                        <span><i class="fa-solid fa-calendar-day"></i> ${h.date}</span>
                                        <span style="color:var(--primary); font-weight:700;"><i class="fa-solid fa-user-gear"></i> ${workers}</span>
                                    </div>
                                </div>
                                
                                <div style="display:flex; gap:6px; overflow-x:auto; max-width:180px; flex-shrink:0;">
                                    ${recordPhotosHtml || ''}
                                </div>

                                <div style="flex:1"></div>
                                
                                <div style="font-size:1rem; color:var(--border); flex-shrink:0; display:flex; align-items:center;"><i class="fa-solid fa-chevron-right"></i></div>
                        </div>
                        `;
                    }).join('') || '<div class="dashboard-empty-compact">直近3ヶ月の重大故障（ドカ停）記録はありません</div>'}
                </div>
            </div>
        `;
        this.setupDashboardCardOrdering();

        if (totalTime > 0) {
            setTimeout(() => {
                const ctx = document.getElementById('dashboard-pie-chart');
                if (!ctx) return;
                Chart.register(ChartDataLabels);
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['定期', '突発(停止)', '非生産停止', 'ドカ停'],
                        datasets: [{
                            data: [periodicTime, suddenTime, nonProductionStopTime, dokateiTime],
                            backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444'],
                            borderWidth: 0,
                            hoverOffset: 12
                        }]
                    },
                    options: {
                        cutout: '70%',
                        plugins: {
                            legend: { display: false },
                            datalabels: {
                                color: '#fff',
                                font: { weight: '800', size: 10 },
                                formatter: (val) => {
                                    const pct = (val / totalTime * 100);
                                    return pct > 5 ? Math.round(pct) + '%' : '';
                                },
                                textStrokeColor: 'rgba(0,0,0,0.3)',
                                textStrokeWidth: 1,
                            },
                            tooltip: {
                                callbacks: {
                                    label: (item) => ` ${item.label}: ${item.raw}分 (${(item.raw/totalTime*100).toFixed(1)}%)`
                                }
                            }
                        }
                    }
                });
            }, 100);
        }
    }

    getDashboardCardDefaultOrder() {
        return ['today', 'alerts', 'flow', 'recent', 'time', 'chart', 'stock', 'counter', 'worst'];
    }

    getDashboardCardDefaultSizes() {
        return {
            today: 'l',
            alerts: 'm',
            flow: 'm',
            recent: 'l',
            time: 'm',
            chart: 'm',
            stock: 'm',
            counter: 'm',
            worst: 'xl'
        };
    }

    getDashboardCardDefaultHeights() {
        return {
            today: 'auto',
            alerts: 'low',
            flow: 'low',
            recent: 'auto',
            time: 'auto',
            chart: 'auto',
            stock: 'auto',
            counter: 'auto',
            worst: 'auto'
        };
    }

    getDashboardCardColumnSpan(size) {
        return ({ s: 6, m: 8, l: 12, xl: 16 })[size] || 8;
    }

    getDashboardGridColumns() {
        return 24;
    }

    getDashboardGridRowHeight() {
        return 20;
    }

    getDashboardMaxGridRow() {
        return 48;
    }

    getDashboardCardOrder() {
        const defaults = this.getDashboardCardDefaultOrder();
        let saved = [];
        try {
            saved = JSON.parse(localStorage.getItem('dashboard_card_order') || '[]');
        } catch {
            saved = [];
        }
        const clean = saved.filter(key => defaults.includes(key));
        return [...clean, ...defaults.filter(key => !clean.includes(key))];
    }

    getDashboardCardSizes() {
        const defaults = this.getDashboardCardDefaultSizes();
        let saved = {};
        try {
            saved = JSON.parse(localStorage.getItem('dashboard_card_sizes') || '{}') || {};
        } catch {
            saved = {};
        }
        const allowed = ['s', 'm', 'l', 'xl'];
        return Object.fromEntries(Object.keys(defaults).map(key => {
            const size = allowed.includes(saved[key]) ? saved[key] : defaults[key];
            return [key, size];
        }));
    }

    getDashboardCardHeights() {
        const defaults = this.getDashboardCardDefaultHeights();
        let saved = {};
        try {
            saved = JSON.parse(localStorage.getItem('dashboard_card_heights') || '{}') || {};
        } catch {
            saved = {};
        }
        const allowed = ['low', 'auto', 'high'];
        return Object.fromEntries(Object.keys(defaults).map(key => {
            const height = allowed.includes(saved[key]) ? saved[key] : defaults[key];
            return [key, height];
        }));
    }

    isDashboardLayoutEditMode() {
        return localStorage.getItem('dashboard_layout_edit_mode') === 'true';
    }

    toggleDashboardLayoutEditMode() {
        localStorage.setItem('dashboard_layout_edit_mode', this.isDashboardLayoutEditMode() ? 'false' : 'true');
        this.renderDashboard();
    }

    resetDashboardLayout() {
        if (!confirm('ダッシュボードの配置・幅・高さを初期状態に戻しますか？')) return;
        localStorage.removeItem('dashboard_card_layout');
        localStorage.removeItem('dashboard_card_sizes');
        localStorage.removeItem('dashboard_card_heights');
        localStorage.removeItem('dashboard_card_order');
        this.renderDashboard();
        this.showToast?.('ダッシュボード配置を初期化しました');
    }

    updateDashboardLayoutModeButton() {
        const button = document.getElementById('dashboard-layout-mode-btn');
        const resetButton = document.getElementById('dashboard-layout-reset-btn');
        const hint = document.getElementById('dashboard-layout-hint');
        if (!button) return;
        const active = this.isDashboardLayoutEditMode();
        button.classList.toggle('active-toggle', active);
        button.innerHTML = active
            ? '<i class="fa-solid fa-check"></i> 配置編集中'
            : '<i class="fa-solid fa-up-down-left-right"></i> 配置編集';
        button.title = active ? '配置編集を終了' : 'カードの配置・幅・高さを編集';
        if (resetButton) resetButton.hidden = !active;
        if (hint) hint.hidden = !active;
    }

    getDashboardCardLayout() {
        let saved = {};
        try {
            saved = JSON.parse(localStorage.getItem('dashboard_card_layout') || '{}') || {};
        } catch {
            saved = {};
        }
        const defaults = this.getDashboardCardDefaultOrder();
        const cleaned = {};
        defaults.forEach(key => {
            const item = saved[key];
            if (!item) return;
            const col = Number(item.col);
            const row = Number(item.row);
            if (!Number.isFinite(col) || !Number.isFinite(row)) return;
            cleaned[key] = {
                col: Math.max(1, Math.min(this.getDashboardGridColumns(), col)),
                row: Math.max(1, Math.min(this.getDashboardMaxGridRow(), row))
            };
        });
        return cleaned;
    }

    saveDashboardCardLayout(layout) {
        localStorage.setItem('dashboard_card_layout', JSON.stringify(layout || {}));
    }

    setupDashboardCardOrdering() {
        const container = document.getElementById('dashboard-widgets');
        if (!container) return;
        const order = this.getDashboardCardOrder();
        const sizes = this.getDashboardCardSizes();
        const heights = this.getDashboardCardHeights();
        const layout = this.getDashboardCardLayout();
        const editMode = this.isDashboardLayoutEditMode();
        const cards = Array.from(container.querySelectorAll('[data-dashboard-card]'));
        container.classList.toggle('dashboard-edit-mode', editMode);
        container.ondragover = event => this.handleDashboardContainerDragOver(event);
        container.ondrop = event => this.handleDashboardContainerDrop(event);
        const dashboardView = document.getElementById('view-dashboard');
        if (dashboardView) {
            dashboardView.ondragover = event => this.handleDashboardContainerDragOver(event);
            dashboardView.ondrop = event => this.handleDashboardContainerDrop(event);
        }
        cards.forEach(card => {
            const key = card.dataset.dashboardCard || '';
            card.style.order = String(Math.max(0, order.indexOf(key)));
            card.dataset.dashboardSize = sizes[key] || 'm';
            card.dataset.dashboardHeight = heights[key] || 'auto';
            this.applyDashboardCardGridPlacement(card, key, sizes[key] || 'm', layout[key]);
            card.draggable = false;
            card.title = card.title || 'ドラッグで表示順を変更。右上の幅ボタンでサイズ変更できます';
            card.classList.add('dashboard-reorderable');
            this.addDashboardCardSizeControl(card, key, sizes[key] || 'm');
            this.addDashboardCardHeightControl(card, key, heights[key] || 'auto');
            card.onpointerdown = event => this.startDashboardCardPointerDrag(event);
            card.addEventListener('click', event => {
                if (this._dashboardSuppressClickUntil && Date.now() < this._dashboardSuppressClickUntil) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }, true);
        });
        this.updateDashboardLayoutModeButton();
        this.scheduleDashboardCardRowSpans();
    }

    applyDashboardCardGridPlacement(card, key, size, placement) {
        const span = this.getDashboardCardColumnSpan(size);
        card.style.gridColumnStart = '';
        card.style.gridColumnEnd = `span ${span}`;
        card.style.gridRowStart = '';
        card.style.gridRowEnd = '';
        if (!placement || !Number.isFinite(Number(placement.col)) || !Number.isFinite(Number(placement.row))) return;
        const maxCol = this.getDashboardGridColumns() + 1 - span;
        const col = Math.max(1, Math.min(maxCol, Number(placement.col)));
        const row = Math.max(1, Math.min(this.getDashboardMaxGridRow(), Number(placement.row)));
        card.style.gridColumnStart = String(col);
        card.style.gridColumnEnd = `span ${span}`;
        card.style.gridRowStart = String(row);
    }

    scheduleDashboardCardRowSpans() {
        requestAnimationFrame(() => this.updateDashboardCardRowSpans());
    }

    updateDashboardCardRowSpans() {
        const container = document.getElementById('dashboard-widgets');
        if (!container) return;
        const rowHeight = this.getDashboardGridRowHeight();
        const gap = Number.parseFloat(getComputedStyle(container).rowGap || '10') || 10;
        Array.from(container.querySelectorAll('[data-dashboard-card]')).forEach(card => {
            const span = Math.max(4, Math.ceil((card.offsetHeight + gap) / (rowHeight + gap)));
            card.style.gridRowEnd = `span ${span}`;
        });
    }

    addDashboardCardSizeControl(card, key, currentSize) {
        if (!key || card.querySelector('.dashboard-size-control')) return;
        const labels = [
            ['s', '小'],
            ['m', '中'],
            ['l', '大'],
            ['xl', '特大']
        ];
        const control = document.createElement('div');
        control.className = 'dashboard-size-control';
        control.setAttribute('aria-label', 'カード幅変更');
        control.innerHTML = '<span>幅</span>' + labels.map(([size, label]) => (
            `<button type="button" class="${size === currentSize ? 'active' : ''}" data-size="${size}" title="幅を${label}にする">${label}</button>`
        )).join('');
        control.addEventListener('click', event => {
            event.stopPropagation();
            const button = event.target.closest('button[data-size]');
            if (!button) return;
            this.setDashboardCardSize(key, button.dataset.size);
        });
        card.appendChild(control);
    }

    addDashboardCardHeightControl(card, key, currentHeight) {
        if (!key || card.querySelector('.dashboard-height-control')) return;
        const labels = [
            ['low', '低'],
            ['auto', '標'],
            ['high', '高']
        ];
        const control = document.createElement('div');
        control.className = 'dashboard-height-control';
        control.setAttribute('aria-label', 'カード高さ変更');
        control.innerHTML = '<span>高</span>' + labels.map(([height, label]) => (
            `<button type="button" class="${height === currentHeight ? 'active' : ''}" data-height="${height}" title="高さを${label}にする">${label}</button>`
        )).join('');
        control.addEventListener('click', event => {
            event.stopPropagation();
            const button = event.target.closest('button[data-height]');
            if (!button) return;
            this.setDashboardCardHeight(key, button.dataset.height);
        });
        card.appendChild(control);
    }

    setDashboardCardSize(key, size) {
        if (!key || !['s', 'm', 'l', 'xl'].includes(size)) return;
        const sizes = this.getDashboardCardSizes();
        sizes[key] = size;
        localStorage.setItem('dashboard_card_sizes', JSON.stringify(sizes));
        const layout = this.getDashboardCardLayout();
        if (layout[key]) {
            const span = this.getDashboardCardColumnSpan(size);
            layout[key].col = Math.max(1, Math.min(this.getDashboardGridColumns() + 1 - span, Number(layout[key].col) || 1));
            this.saveDashboardCardLayout(layout);
        }
        this.renderDashboard();
        this.showToast?.('カード幅を保存しました');
    }

    setDashboardCardHeight(key, height) {
        if (!key || !['low', 'auto', 'high'].includes(height)) return;
        const heights = this.getDashboardCardHeights();
        heights[key] = height;
        localStorage.setItem('dashboard_card_heights', JSON.stringify(heights));
        this.renderDashboard();
        this.showToast?.('カード高さを保存しました');
    }

    flashDashboardAdjustedCard(key) {
        if (!key) return;
        requestAnimationFrame(() => {
            const card = document.querySelector(`[data-dashboard-card="${CSS.escape(key)}"]`);
            if (!card) return;
            card.classList.remove('dashboard-placement-flash');
            void card.offsetWidth;
            card.classList.add('dashboard-placement-flash');
            setTimeout(() => card.classList.remove('dashboard-placement-flash'), 1400);
        });
    }

    startDashboardCardPointerDrag(event) {
        if (event.button !== 0 || event.target?.closest?.('button, input, select, textarea, a, canvas, .dashboard-size-control, .dashboard-height-control')) {
            return;
        }
        if (!this.isDashboardLayoutEditMode()) return;
        const card = event.currentTarget;
        const key = card?.dataset?.dashboardCard || '';
        if (!key) return;
        const rect = card.getBoundingClientRect();
        this._dashboardPointerDrag = {
            card,
            key,
            startX: event.clientX,
            startY: event.clientY,
            offsetX: Math.max(0, event.clientX - rect.left),
            offsetY: Math.max(0, event.clientY - rect.top),
            active: false
        };
        this._dashboardPointerMoveHandler = this._dashboardPointerMoveHandler || (moveEvent => this.handleDashboardCardPointerMove(moveEvent));
        this._dashboardPointerUpHandler = this._dashboardPointerUpHandler || (upEvent => this.handleDashboardCardPointerUp(upEvent));
        document.addEventListener('pointermove', this._dashboardPointerMoveHandler);
        document.addEventListener('pointerup', this._dashboardPointerUpHandler, { once: true });
        document.addEventListener('pointercancel', this._dashboardPointerUpHandler, { once: true });
    }

    beginDashboardCardPointerDrag(event) {
        const state = this._dashboardPointerDrag;
        if (!state || state.active) return;
        state.active = true;
        this._draggingDashboardCard = state.key;
        this._dashboardDropHandled = false;
        this._dashboardDragOffset = { x: state.offsetX, y: state.offsetY };
        state.card.classList.add('dragging');
        document.getElementById('dashboard-widgets')?.classList.add('dashboard-drag-active');
        const rect = state.card.getBoundingClientRect();
        const ghost = state.card.cloneNode(true);
        ghost.classList.add('dashboard-drag-ghost');
        ghost.removeAttribute('id');
        ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        document.body.appendChild(ghost);
        this._dashboardDragGhost = ghost;
        this.moveDashboardDragGhost(event);
    }

    moveDashboardDragGhost(event) {
        const state = this._dashboardPointerDrag;
        const ghost = this._dashboardDragGhost;
        if (!state || !ghost) return;
        const left = event.clientX - state.offsetX;
        const top = event.clientY - state.offsetY;
        ghost.style.left = `${left}px`;
        ghost.style.top = `${top}px`;
        this.updateDashboardSnapGuide();
        const container = document.getElementById('dashboard-widgets');
        if (container) {
            const containerRect = container.getBoundingClientRect();
            const bottom = top - containerRect.top + container.scrollTop + ghost.offsetHeight + 24;
            if (bottom > container.offsetHeight) {
                container.style.minHeight = `${Math.ceil(bottom)}px`;
            }
        }
    }

    getDashboardGridMetrics() {
        const container = document.getElementById('dashboard-widgets');
        if (!container) return null;
        const rect = container.getBoundingClientRect();
        const gap = Number.parseFloat(getComputedStyle(container).columnGap || '10') || 10;
        const columns = this.getDashboardGridColumns();
        const colWidth = (rect.width - gap * (columns - 1)) / columns;
        return { container, rect, gap, columns, colWidth, rowHeight: this.getDashboardGridRowHeight() };
    }

    ensureDashboardSnapGuide() {
        const container = document.getElementById('dashboard-widgets');
        if (!container) return null;
        let guide = container.querySelector('.dashboard-snap-guide');
        if (!guide) {
            guide = document.createElement('div');
            guide.className = 'dashboard-snap-guide';
            container.appendChild(guide);
        }
        return guide;
    }

    updateDashboardSnapGuide() {
        const state = this._dashboardPointerDrag;
        const ghost = this._dashboardDragGhost;
        const metrics = this.getDashboardGridMetrics();
        const guide = this.ensureDashboardSnapGuide();
        if (!state || !ghost || !metrics || !guide) return;
        const size = this.getDashboardCardSizes()[state.key] || 'm';
        const span = this.getDashboardCardColumnSpan(size);
        const ghostRect = ghost.getBoundingClientRect();
        const localX = ghostRect.left - metrics.rect.left + metrics.container.scrollLeft;
        const localY = ghostRect.top - metrics.rect.top + metrics.container.scrollTop;
        const pos = this.getDashboardGridPositionFromLocalPoint(localX, localY, size);
        if (!pos) return;
        const guideHeight = Math.max(56, ghost.offsetHeight || 80);
        const blocked = this.isDashboardPlacementOverlapping(pos, size, guideHeight, state.key);
        state.blocked = blocked;
        guide.style.display = 'block';
        guide.classList.toggle('blocked', blocked);
        guide.style.left = `${(pos.col - 1) * (metrics.colWidth + metrics.gap)}px`;
        guide.style.top = `${(pos.row - 1) * (metrics.rowHeight + metrics.gap)}px`;
        guide.style.width = `${metrics.colWidth * span + metrics.gap * (span - 1)}px`;
        guide.style.height = `${guideHeight}px`;
    }

    handleDashboardCardPointerMove(event) {
        const state = this._dashboardPointerDrag;
        if (!state) return;
        const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
        if (!state.active && distance < 2) return;
        if (!state.active) this.beginDashboardCardPointerDrag(event);
        this.moveDashboardDragGhost(event);
        event.preventDefault();
    }

    handleDashboardCardPointerUp(event) {
        document.removeEventListener('pointermove', this._dashboardPointerMoveHandler);
        document.removeEventListener('pointercancel', this._dashboardPointerUpHandler);
        const state = this._dashboardPointerDrag;
        if (!state) return;
        if (state.active) {
            const saved = this.saveDashboardCardPositionFromGhost(state.key);
            this._dashboardSuppressClickUntil = Date.now() + 350;
            this.finishDashboardCardDrag();
            if (saved) {
                const adjusted = this._dashboardPlacementAdjusted;
                this._dashboardPlacementAdjusted = false;
                this.renderDashboard();
                if (adjusted) this.flashDashboardAdjustedCard(state.key);
                this.showToast?.(adjusted ? '重ならない近くの空き位置へ配置しました' : 'カード位置を保存しました');
            } else {
                this.showToast?.('他のカードと重なるため置けません');
            }
            event.preventDefault();
        }
        this._dashboardPointerDrag = null;
    }

    startDashboardCardDrag(event) {
        if (event.target?.closest?.('button, input, select, textarea, a, canvas, .dashboard-size-control')) {
            event.preventDefault();
            return;
        }
        const card = event.currentTarget;
        this._draggingDashboardCard = card?.dataset?.dashboardCard || '';
        this._dashboardDropHandled = false;
        const rect = card.getBoundingClientRect();
        this._dashboardDragOffset = {
            x: Math.max(0, event.clientX - rect.left),
            y: Math.max(0, event.clientY - rect.top)
        };
        card?.classList.add('dragging');
        document.getElementById('dashboard-widgets')?.classList.add('dashboard-drag-active');
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', this._draggingDashboardCard);
            event.dataTransfer.setDragImage(card, this._dashboardDragOffset.x, this._dashboardDragOffset.y);
        }
    }

    handleDashboardCardDragOver(event) {
        if (!this._draggingDashboardCard) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }

    handleDashboardCardDragLeave(event) {
        event.currentTarget?.classList.remove('drag-over');
    }

    handleDashboardContainerDragOver(event) {
        if (!this._draggingDashboardCard) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }

    getDashboardDropGridPosition(event, size) {
        const container = document.getElementById('dashboard-widgets');
        if (!container) return null;
        const rect = container.getBoundingClientRect();
        const gap = Number.parseFloat(getComputedStyle(container).columnGap || '10') || 10;
        const span = this.getDashboardCardColumnSpan(size);
        const columns = this.getDashboardGridColumns();
        const colWidth = (rect.width - gap * (columns - 1)) / columns;
        const offset = this._dashboardDragOffset || { x: 0, y: 0 };
        const x = Math.max(0, event.clientX - rect.left + container.scrollLeft - offset.x);
        const y = Math.max(0, event.clientY - rect.top + container.scrollTop - offset.y);
        const col = Math.max(1, Math.min(columns + 1 - span, Math.floor(x / (colWidth + gap)) + 1));
        const rowHeight = this.getDashboardGridRowHeight();
        const row = Math.max(1, Math.min(this.getDashboardMaxGridRow(), Math.floor(y / (rowHeight + gap)) + 1));
        return { col, row, span, colWidth, gap };
    }

    getDashboardGridPositionFromLocalPoint(x, y, size) {
        const container = document.getElementById('dashboard-widgets');
        if (!container) return null;
        const gap = Number.parseFloat(getComputedStyle(container).columnGap || '10') || 10;
        const span = this.getDashboardCardColumnSpan(size);
        const columns = this.getDashboardGridColumns();
        const colWidth = (container.getBoundingClientRect().width - gap * (columns - 1)) / columns;
        const col = Math.max(1, Math.min(columns + 1 - span, Math.floor(Math.max(0, x) / (colWidth + gap)) + 1));
        const rowHeight = this.getDashboardGridRowHeight();
        const row = Math.max(1, Math.min(this.getDashboardMaxGridRow(), Math.floor(Math.max(0, y) / (rowHeight + gap)) + 1));
        return { col, row };
    }

    getDashboardPlacementPixelRect(pos, size, height) {
        const metrics = this.getDashboardGridMetrics();
        if (!metrics || !pos) return null;
        const span = this.getDashboardCardColumnSpan(size);
        return {
            left: (pos.col - 1) * (metrics.colWidth + metrics.gap),
            top: (pos.row - 1) * (metrics.rowHeight + metrics.gap),
            width: metrics.colWidth * span + metrics.gap * (span - 1),
            height: Math.max(56, height || 80)
        };
    }

    dashboardRectsOverlap(a, b) {
        const overlapX = Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left));
        const overlapY = Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
        return overlapX > 8 && overlapY > 8;
    }

    isDashboardPlacementOverlapping(pos, size, height, from) {
        const container = document.getElementById('dashboard-widgets');
        const metrics = this.getDashboardGridMetrics();
        const target = this.getDashboardPlacementPixelRect(pos, size, height);
        if (!container || !metrics || !target) return false;
        return Array.from(container.querySelectorAll('[data-dashboard-card]')).some(card => {
            if (card.dataset.dashboardCard === from) return false;
            const rect = card.getBoundingClientRect();
            const other = {
                left: rect.left - metrics.rect.left + container.scrollLeft,
                top: rect.top - metrics.rect.top + container.scrollTop,
                width: rect.width,
                height: rect.height
            };
            return this.dashboardRectsOverlap(target, other);
        });
    }

    findNearestDashboardOpenPlacement(pos, size, height, from) {
        if (!pos) return null;
        const span = this.getDashboardCardColumnSpan(size);
        const maxCol = this.getDashboardGridColumns() + 1 - span;
        const maxRow = this.getDashboardMaxGridRow();
        const start = {
            col: Math.max(1, Math.min(maxCol, Number(pos.col) || 1)),
            row: Math.max(1, Math.min(maxRow, Number(pos.row) || 1))
        };
        if (!this.isDashboardPlacementOverlapping(start, size, height, from)) {
            return { ...start, adjusted: false };
        }
        const candidates = [];
        for (let row = 1; row <= maxRow; row += 1) {
            for (let col = 1; col <= maxCol; col += 1) {
                const candidate = { col, row };
                if (this.isDashboardPlacementOverlapping(candidate, size, height, from)) continue;
                const dx = col - start.col;
                const dy = row - start.row;
                candidates.push({
                    ...candidate,
                    adjusted: true,
                    score: dx * dx + dy * dy * 1.15 + Math.abs(dx) * 0.08 + Math.abs(dy) * 0.12
                });
            }
        }
        candidates.sort((a, b) => a.score - b.score || a.row - b.row || a.col - b.col);
        return candidates[0] || null;
    }

    saveDashboardCardPositionFromGhost(from) {
        const container = document.getElementById('dashboard-widgets');
        const ghost = this._dashboardDragGhost;
        this._dashboardPlacementAdjusted = false;
        if (!from || !container || !ghost) return false;
        const containerRect = container.getBoundingClientRect();
        const ghostRect = ghost.getBoundingClientRect();
        const size = this.getDashboardCardSizes()[from] || 'm';
        const localX = ghostRect.left - containerRect.left + container.scrollLeft;
        const localY = ghostRect.top - containerRect.top + container.scrollTop;
        const pos = this.getDashboardGridPositionFromLocalPoint(localX, localY, size);
        if (!pos) return false;
        const openPos = this.findNearestDashboardOpenPlacement(pos, size, ghostRect.height, from);
        if (!openPos) return false;
        this._dashboardPlacementAdjusted = !!openPos.adjusted;
        const layout = this.getDashboardCardLayout();
        layout[from] = { col: openPos.col, row: openPos.row };
        this.saveDashboardCardLayout(layout);
        return true;
    }

    saveDashboardCardPositionFromEvent(event, from) {
        const container = document.getElementById('dashboard-widgets');
        this._dashboardPlacementAdjusted = false;
        if (!from || !container || !event || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return false;
        if (event.clientX <= 0 && event.clientY <= 0) return false;
        const dragging = container.querySelector(`[data-dashboard-card="${from}"]`);
        const size = dragging?.dataset.dashboardSize || this.getDashboardCardSizes()[from] || 'm';
        const pos = this.getDashboardDropGridPosition(event, size);
        if (!pos) return false;
        const openPos = this.findNearestDashboardOpenPlacement(pos, size, dragging?.offsetHeight || 80, from);
        if (!openPos) return false;
        this._dashboardPlacementAdjusted = !!openPos.adjusted;
        const layout = this.getDashboardCardLayout();
        layout[from] = { col: openPos.col, row: openPos.row };
        this.saveDashboardCardLayout(layout);
        return true;
    }

    handleDashboardContainerDrop(event) {
        event.preventDefault();
        const from = this._draggingDashboardCard || event.dataTransfer?.getData('text/plain') || '';
        if (!from) return;
        this._dashboardDropHandled = this.saveDashboardCardPositionFromEvent(event, from);
        this.finishDashboardCardDrag();
        this.renderDashboard();
        const adjusted = this._dashboardPlacementAdjusted;
        this._dashboardPlacementAdjusted = false;
        if (adjusted) this.flashDashboardAdjustedCard(from);
        this.showToast?.(adjusted ? '重ならない近くの空き位置へ配置しました' : 'カード位置を保存しました');
    }

    handleDashboardCardDragEnd(event) {
        const from = this._draggingDashboardCard;
        if (from && !this._dashboardDropHandled && this.saveDashboardCardPositionFromEvent(event, from)) {
            this.finishDashboardCardDrag();
            this.renderDashboard();
            const adjusted = this._dashboardPlacementAdjusted;
            this._dashboardPlacementAdjusted = false;
            if (adjusted) this.flashDashboardAdjustedCard(from);
            this.showToast?.(adjusted ? '重ならない近くの空き位置へ配置しました' : 'カード位置を保存しました');
            return;
        }
        this.finishDashboardCardDrag();
    }

    finishDashboardCardDrag() {
        this._draggingDashboardCard = '';
        this._dashboardDragOffset = null;
        this._dashboardDropHandled = false;
        this._dashboardDragGhost?.remove();
        this._dashboardDragGhost = null;
        document.querySelector('.dashboard-snap-guide')?.remove();
        document.getElementById('dashboard-widgets')?.classList.remove('dashboard-drag-active');
        document.querySelectorAll('.dashboard-reorderable.dragging, .dashboard-reorderable.drag-over').forEach(el => {
            el.classList.remove('dragging', 'drag-over');
        });
    }

    addDokateiCounter() {
        if (!store.activeData.dokateiCounters) store.activeData.dokateiCounters = [];
        store.activeData.dokateiCounters.push({ location: '', lastDate: '' });
        store.save();
        this.renderDashboard();
    }

    removeDokateiCounter(index) {
        if (!store.activeData.dokateiCounters) return;
        if (confirm('このカウンターを削除しますか？')) {
            store.activeData.dokateiCounters.splice(index, 1);
            store.save();
            this.renderDashboard();
        }
    }

    updateDokateiCounter(index, field, value) {
        if (!store.activeData.dokateiCounters) {
            store.activeData.dokateiCounters = [
                { location: '', lastDate: '' },
                { location: '', lastDate: '' }
            ];
        }
        if (store.activeData.dokateiCounters[index]) {
            store.activeData.dokateiCounters[index][field] = value;
            store.save();
            this.renderDashboard();
        }
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppAnalysisDashboardMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppAnalysisDashboardMethods.prototype[name];
        }
    }
})();
