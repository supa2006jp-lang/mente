(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppMachineMethods extends MaintenanceApp {
    // --- Machines Implementation ---

    renderMachines(searchQuery = '') {
        const container = document.getElementById('machines-list');
        if (!container) return;
        if (typeof this.machineMaintenanceListMode === 'undefined') {
            this.machineMaintenanceListMode = localStorage.getItem('machine_maintenance_list_mode') === '1';
        }
        if (this.machineMaintenanceListMode) {
            this.renderMachineMaintenanceList(searchQuery);
            return;
        }
        this.updateMachineMaintenanceListButton();
        container.className = 'grid-list';
        
        const qInput = document.getElementById('global-search');
        const query = (searchQuery || (qInput ? qInput.value : '')).toLowerCase().trim();

        let machines = store.getMachines();
        
        if (machines.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-ghost"></i>
                    <p>機械が登録されていません。</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        
        const normQuery = query ? MaintenanceStore.toHalfWidthLower(query) : null;

        // --- Ranking calculation ---
        const allHistory = store.getHistory({}) || [];
        const troubleCountMap = {};
        const recurrenceCountMap = {};
        const recurrenceCountThisYearMap = {};
        const recurrenceHistoryMap = {};
        const currentYearStr = new Date().getFullYear().toString();
        
        allHistory.forEach(h => {
             if (h.machineId) {
                 // Total trouble rank (Sudden + Dokatei)
                 if (!h.taskId || h.isDokatei) {
                     troubleCountMap[h.machineId] = (troubleCountMap[h.machineId] || 0) + 1;
                 }
                 // Recurrence rank (isFirstTime === false)
                 if (h.isFirstTime === false) {
                     recurrenceCountMap[h.machineId] = (recurrenceCountMap[h.machineId] || 0) + 1;
                     if (h.date && h.date.startsWith(currentYearStr)) {
                         recurrenceCountThisYearMap[h.machineId] = (recurrenceCountThisYearMap[h.machineId] || 0) + 1;
                     }
                     if (!recurrenceHistoryMap[h.machineId]) recurrenceHistoryMap[h.machineId] = [];
                     recurrenceHistoryMap[h.machineId].push(h);
                 }
             }
        });
        
        // Sorting by ranking (Default to trouble rank)
        if (this.machineSort === 'name') {
            machines.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
        } else if (this.machineSort === 'newest') {
            machines.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        } else {
            // Default: Rank
            machines.sort((a, b) => (troubleCountMap[b.id] || 0) - (troubleCountMap[a.id] || 0));
        }
        
        // Machine Rank Reference List
        const rankBasis = store.getMachines(true).map(m => ({
            id: m.id,
            count: troubleCountMap[m.id] || 0
        })).sort((a,b) => b.count - a.count);

        const recurrenceRankBasis = store.getMachines(true).map(m => ({
            id: m.id,
            count: recurrenceCountMap[m.id] || 0
        })).sort((a,b) => b.count - a.count);

        machines.forEach(m => {
            const mId = m.id;
            const mTasks = store.getTasks(mId) || [];
            const mHistory = allHistory.filter(h => h.machineId === mId && (!h.taskId || h.isDokatei));
            const troubleCount = mHistory.length;
            const rank = rankBasis.findIndex(x => x.id === mId) + 1;
            
            const recurrenceCount = recurrenceCountMap[mId] || 0;
            const recurrenceCountThisYear = recurrenceCountThisYearMap[mId] || 0;
            const recurrenceRank = recurrenceRankBasis.findIndex(x => x.id === mId) + 1;
            const recurrenceHistory = recurrenceHistoryMap[mId] || [];
            recurrenceHistory.sort((a,b) => new Date(b.date) - new Date(a.date));

            // Search Match Logic
            let isMatch = true;
            let showHighlight = false;
            if (normQuery) {
                const terms = normQuery.split(/[\s　]+/).filter(Boolean);
                const searchStr = (m.name || '') + ' ' + (m.model || '') + ' ' + (m.remarks || '');
                const normSearch = MaintenanceStore.toHalfWidthLower(searchStr);
                isMatch = terms.every(t => normSearch.includes(t));
                if (!isMatch) return; // Skip rendering for non-matches
                showHighlight = true;
            }

            const card = document.createElement('div');
            card.className = 'machine-card' + (showHighlight ? ' search-match' : '');
            
            // Recent troubles safely
            const troublesHTML = mHistory.slice(0, 3).map(h => {
                const date = h.date || '-';
                const body = (h.errorContent || h.notes || '内容なし').replace(/"/g, '&quot;').replace(/'/g, "\\'").replace(/\n/g, ' ');
                
                let photosHtml = '';
                if (h.photos && h.photos.length > 0) {
                    photosHtml = `<div style="display:flex; gap:4px; margin-left:8px; flex-shrink:0;">${h.photos.slice(0, 3).map(p => `<div class="img-box" style="width:40px; height:30px; border-radius:4px; border:1px solid var(--border);"><img src="${p}" style="width:100%; height:100%; object-fit:cover;"></div>`).join('')}</div>`;
                }
                
                return `
                    <div class="recent-trouble-item hover-shadow" style="flex-direction: row; align-items: center; justify-content: space-between;" onclick="app.jumpToHistory('${mId}', '${body}', '${date}')">
                        <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
                            <span class="date">${date}</span>
                            <span class="content" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${body}</span>
                        </div>
                        ${photosHtml}
                    </div>
                `;
            }).join('') || '<div style="font-size:0.7rem; color:var(--text-light); padding:10px;">トラブル履歴なし</div>';

            // MTBF calculation
            let mtbf = '記録なし';
            if (troubleCount >= 2) {
                const dates = mHistory.map(h => new Date(h.date).getTime()).sort((a,b) => a - b);
                const first = dates[0];
                const last = dates[dates.length-1];
                if (first && last) {
                    const days = (last - first) / (1000 * 60 * 60 * 24);
                    mtbf = (days / (troubleCount - 1)).toFixed(1) + ' 日/回';
                }
            } else if (troubleCount === 1) {
                mtbf = '計算不可';
            }

            // Find history with guides for the SAME model
            const normModel = MaintenanceApp.toHalfWidthLower(m.model || '');
            const modelGuides = store.activeData.history.filter(h => {
                if (!h.guide) return false;
                const mach = store.getMachines(true).find(mm => mm.id === h.machineId);
                return mach && MaintenanceApp.toHalfWidthLower(mach.model || '') === normModel;
            }).sort((a,b) => new Date(b.date) - new Date(a.date));

            // Normalization for name display
            const normName = MaintenanceApp.toFullWidthUpper(m.name || '');

            card.innerHTML = `
                <div class="card-header" style="gap:16px; align-items: flex-start;">
                    <div class="img-box" style="width:64px; height:64px; border-radius:10px;">
                        ${m.photo ? `<img src="${m.photo}">` : `<button type="button" class="machine-photo-placeholder" onclick="app.openMachinePhotoChoice('${this.escapeJs(mId)}', event)" title="画像を選択"><i class="fa-solid fa-industry"></i></button>`}
                    </div>
                    <div style="flex:1">
                        <h4 style="margin:0">${this.highlightText(normName, query)}</h4>
                        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:4px;">
                            ${m.lineNo ? this.getLineBadge(m.lineNo) : ''}
                            ${m.category ? `<span style="display:inline-flex; align-items:center; justify-content:center; background:#eff6ff; color:#1e40af; border:1px solid #bae6fd; padding:1px 8px; border-radius:4px; font-weight:800; font-size:0.7rem;">${m.category}</span>` : ''}
                            <span class="model-clickable" style="font-size:0.75rem; color:var(--secondary); font-weight:800; cursor:pointer; margin-left:4px;" onclick="app.filterByModel('${normModel}')">
                                [${this.highlightText(MaintenanceApp.isModelBlank(m.model) ? '型式未登録' : normModel, query)}]
                            </span>
                            ${m.manufacturer ? `<span style="font-size:0.7rem; color:var(--text-light); margin-left:8px;"><i class="fa-solid fa-industry" style="font-size:0.6rem; margin-right:2px;"></i> ${m.manufacturer}</span>` : ''}
                            ${recurrenceCount > 0 ? `<span style="display:inline-block; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:2px 8px; border-radius:4px; font-weight:900; margin-left:4px; font-size:0.75rem;"><i class="fa-solid fa-redo" style="font-size:0.65rem; margin-right:4px;"></i> 再発: 累計 ${recurrenceCount}回 / 今年 ${recurrenceCountThisYear}回 (第 ${recurrenceRank} 位)</span>` : ''}
                            ${modelGuides.length > 0 ? `
                                <div class="card-inline-guides" style="display:inline-flex; gap:4px; margin-left:4px;">
                                    ${modelGuides.slice(0, 5).map(g => `
                                        <div class="guide-badge-balloon" style="padding:2px 4px; background:#f0f9ff; border-radius:4px; border:1px solid #bae6fd;" onclick="event.stopPropagation(); app.openGuideModal('${g.id}')">
                                            <i class="fa-solid fa-file-invoice" style="font-size:0.75rem; color:#0369a1;"></i>
                                            <span class="balloon-content" style="font-size:0.7rem; width:200px;">
                                                <div style="font-weight:800; color:var(--primary); margin-bottom:2px;">${g.date}</div>
                                                ${this.getHistoryDisplayText(g)}
                                            </span>
                                        </div>
                                    `).join('')}
                                    ${modelGuides.length > 5 ? `<span style="font-size:0.6rem; color:var(--text-light); opacity:0.6;">+${modelGuides.length - 5}</span>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="actions" style="display:flex; gap:6px; flex-shrink:0;">
                        <button class="icon-btn edit-btn" title="編集"><i class="fa-solid fa-pen"></i></button>
                        <button class="icon-btn delete-btn" style="color:var(--danger)" title="削除"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="card-body">
                    <p class="remarks" style="font-size:0.8rem; margin:8px 0 12px 0;">${this.highlightText(m.remarks || '備考なし', query)}</p>
                    
                    <div class="machine-trouble-info" style="margin-bottom:12px;">
                        <div class="trouble-stat-row">
                            <span class="label"><i class="fa-solid fa-ranking-star"></i> 不具合頻度順位</span>
                            <span class="value">${troubleCount > 0 ? `第 ${rank} 位 (${troubleCount}回)` : '記録なし'}</span>
                        </div>
                        <div class="trouble-stat-row">
                            <span class="label"><i class="fa-solid fa-arrows-left-right"></i> 平均故障間隔 (MTBF)</span>
                            <span class="value">${mtbf}</span>
                        </div>
                    </div>

                    <div class="card-recent-troubles" style="margin-bottom:12px;">
                        <div style="font-size:0.65rem; color:var(--text-light); border-bottom:1px solid var(--border); margin-bottom:4px; padding-bottom:2px; font-weight:700;">直近トラブル (3件)</div>
                        ${troublesHTML}
                    </div>

                    <div class="task-summary">
                        ${mTasks.filter(t => !store.isMaintenanceTaskArchived(t.id)).map(t => `<span class="task-pill"><i class="fa-solid fa-screwdriver-wrench"></i> ${t.content}</span>`).join('')}
                    </div>
                </div>
            `;
            
            card.querySelector('.edit-btn').onclick = () => this.editMachine(mId);
            card.querySelector('.delete-btn').onclick = () => this.deleteMachine(mId);
            container.appendChild(card);
        });
    }

    toggleMachineMaintenanceListMode() {
        this.machineMaintenanceListMode = !this.machineMaintenanceListMode;
        localStorage.setItem('machine_maintenance_list_mode', this.machineMaintenanceListMode ? '1' : '0');
        this.renderMachines();
    }

    updateMachineMaintenanceListButton() {
        const btn = document.getElementById('btn-machine-maintenance-list');
        if (!btn) return;
        const listMode = !!this.machineMaintenanceListMode;
        btn.classList.toggle('active-toggle', listMode);
        btn.innerHTML = listMode
            ? '<i class="fa-solid fa-table-cells-large"></i> 装置看板表示'
            : '<i class="fa-solid fa-list-ul"></i> 定期（単発含む）メンテリスト表示';
        btn.title = listMode ? '装置の看板表示へ戻す' : '定期メンテ項目を一覧で表示';
    }

    getMachineMaintenanceNextDue(task, todayStr = this.getLocalDateString()) {
        if (!task?.startDate) return '';
        const periodDays = parseInt(task.periodDays) || 0;
        if (periodDays <= 0) {
            const done = (store.activeData.history || []).some(h => h.taskId && String(h.taskId) === String(task.id));
            return done ? '完了済み' : task.startDate;
        }
        const [sy, sm, sd] = task.startDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd);
        if (isNaN(start.getTime())) return '';
        const today = new Date(todayStr);
        today.setHours(0, 0, 0, 0);
        let due = new Date(start);
        due.setHours(0, 0, 0, 0);
        while (due < today) {
            const dueStr = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
            const done = (store.activeData.history || []).some(h => h.taskId && String(h.taskId) === String(task.id) && h.date === dueStr);
            if (!done) return dueStr;
            due.setDate(due.getDate() + periodDays);
        }
        return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    }

    setMachineMaintenanceListFilter(key, value) {
        this.machineMaintenanceListFilters = {
            ...(this.machineMaintenanceListFilters || {}),
            [key]: value
        };
        this.renderMachines();
    }

    openRemainingMaintenanceList() {
        this.machineMaintenanceListMode = true;
        localStorage.setItem('machine_maintenance_list_mode', '1');
        this.machineSort = 'rank';
        const sortSelect = document.getElementById('machine-sort-select');
        if (sortSelect) sortSelect.value = 'rank';
        this.machineMaintenanceListFilters = {
            status: 'calendarRemaining',
            kind: 'all',
            line: 'all'
        };
        this.switchView('machines');
        this.renderMachines();
    }

    openCompletedMaintenanceList() {
        this.machineMaintenanceListMode = true;
        localStorage.setItem('machine_maintenance_list_mode', '1');
        this.machineSort = 'rank';
        const sortSelect = document.getElementById('machine-sort-select');
        if (sortSelect) sortSelect.value = 'rank';
        this.machineMaintenanceListFilters = {
            status: 'calendarCompleted',
            kind: 'all',
            line: 'all'
        };
        this.switchView('machines');
        this.renderMachines();
    }

    renderMachineMaintenanceList(searchQuery = '') {
        const container = document.getElementById('machines-list');
        if (!container) return;
        this.updateMachineMaintenanceListButton();
        container.className = 'machine-maintenance-list-wrap';

        const qInput = document.getElementById('global-search');
        const query = MaintenanceStore.toHalfWidthLower(searchQuery || (qInput ? qInput.value : '') || '').trim();
        const machines = store.getMachines(true);
        const machineMap = new Map(machines.map(m => [String(m.id), m]));
        const histories = store.activeData.history || [];
        const todayStr = this.getLocalDateString();
        const listFilters = {
            status: 'all',
            kind: 'all',
            line: 'all',
            ...(this.machineMaintenanceListFilters || {})
        };
        const viewYear = this.currentDate?.getFullYear?.() || new Date().getFullYear();
        const viewMonth = this.currentDate?.getMonth?.() ?? new Date().getMonth();
        const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
        const monthEnd = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(new Date(viewYear, viewMonth + 1, 0).getDate()).padStart(2, '0')}`;

        let rows = (store.activeData.tasks || [])
            .filter(t => !store.isMaintenanceTaskArchived(t.id))
            .map(task => {
                const machine = machineMap.get(String(task.machineId));
                const taskHistory = histories
                    .filter(h => h.taskId && String(h.taskId) === String(task.id))
                    .sort((a, b) => new Date(b.date || '') - new Date(a.date || ''));
                const latest = taskHistory[0];
                const monthLatest = taskHistory.find(h => h.date && h.date >= monthStart && h.date <= monthEnd);
                return {
                    task,
                    machine,
                    latest,
                    monthLatest,
                    nextDue: this.getMachineMaintenanceNextDue(task, todayStr),
                    doneCount: taskHistory.length
                };
            });

        rows = rows.filter(row => {
            const periodDays = parseInt(row.task.periodDays) || 0;
            const isDoneOneOff = periodDays <= 0 && row.nextDue === '完了済み';
            const isOverdue = row.nextDue && row.nextDue !== '完了済み' && row.nextDue < todayStr;
            const isInViewMonth = row.nextDue && row.nextDue !== '完了済み' && row.nextDue >= monthStart && row.nextDue <= monthEnd;
            const lineNo = row.machine?.lineNo || '';
            if (listFilters.status === 'overdue' && !isOverdue) return false;
            if (listFilters.status === 'active' && isDoneOneOff) return false;
            if (listFilters.status === 'calendarRemaining' && !isInViewMonth) return false;
            if (listFilters.status === 'calendarCompleted' && !row.monthLatest) return false;
            if (listFilters.kind === 'periodic' && periodDays <= 0) return false;
            if (listFilters.kind === 'oneOff' && periodDays > 0) return false;
            if (listFilters.line !== 'all' && String(lineNo) !== String(listFilters.line)) return false;
            return true;
        });

        if (query) {
            rows = rows.filter(row => {
                const m = row.machine || {};
                const text = [
                    row.task.content,
                    row.task.periodDays,
                    row.task.startDate,
                    row.nextDue,
                    m.name,
                    m.model,
                    m.lineNo,
                    m.category,
                    m.manufacturer
                ].join(' ');
                return MaintenanceStore.toHalfWidthLower(text).includes(query);
            });
        }

        const sortMode = this.machineSort || document.getElementById('machine-sort-select')?.value || 'rank';
        rows.sort((a, b) => {
            if (listFilters.status === 'calendarCompleted') {
                return String(b.monthLatest?.date || '').localeCompare(String(a.monthLatest?.date || ''));
            }
            if (sortMode === 'name') {
                return `${a.machine?.name || ''} ${a.task.content || ''}`.localeCompare(`${b.machine?.name || ''} ${b.task.content || ''}`, 'ja');
            }
            if (sortMode === 'newest') {
                return (b.task.createdAt || b.machine?.createdAt || 0) - (a.task.createdAt || a.machine?.createdAt || 0);
            }
            return String(a.nextDue || '9999-99-99').localeCompare(String(b.nextDue || '9999-99-99'));
        });

        const rowsHtml = rows.map(row => {
            const task = row.task;
            const machine = row.machine;
            const periodDays = parseInt(task.periodDays) || 0;
            const periodLabel = periodDays > 0 ? `${periodDays}日毎` : '単発';
            const nextDueClass = row.nextDue && row.nextDue !== '完了済み' && row.nextDue < todayStr ? ' overdue' : '';
            const completionDate = row.nextDue && row.nextDue !== '完了済み' ? row.nextDue : todayStr;
            const completionDisabled = row.nextDue === '完了済み';
            const machineLabel = machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし';
            return `
                <tr>
                    <td>
                        <div class="maintenance-list-machine">
                            ${machine?.photo ? `<img src="${machine.photo}" alt="">` : (machine ? `<button type="button" class="machine-photo-placeholder small" onclick="app.openMachinePhotoChoice('${this.escapeJs(machine.id)}', event)" title="画像を選択"><i class="fa-solid fa-industry"></i></button>` : '<span><i class="fa-solid fa-industry"></i></span>')}
                            <div>
                                <b>${this.escapeHtml(machineLabel)}</b>
                                <small>${machine?.lineNo ? this.escapeHtml(this.getLineLabel(machine.lineNo)) : 'ライン未設定'}${machine?.category ? ` / ${this.escapeHtml(machine.category)}` : ''}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="maintenance-list-task">${this.escapeHtml(task.content || '内容なし')}</div>
                    </td>
                    <td><span class="maintenance-period-pill ${periodDays <= 0 ? 'one-off' : ''}">${this.escapeHtml(periodLabel)}</span></td>
                    <td>${this.escapeHtml(task.startDate || '-')}</td>
                    <td><span class="maintenance-next-due${nextDueClass}">${this.escapeHtml(row.nextDue || '-')}</span></td>
                    <td>${this.escapeHtml((listFilters.status === 'calendarCompleted' ? row.monthLatest?.date : row.latest?.date) || '-')}</td>
                    <td style="text-align:center;">${row.doneCount}</td>
                    <td class="maintenance-list-actions">
                        <button type="button" class="primary-btn" ${completionDisabled ? 'disabled' : ''} onclick="app.openCompletionForm('${this.escapeJs(task.id)}', '${this.escapeJs(completionDate)}')">
                            <i class="fa-solid fa-circle-check"></i> 完了
                        </button>
                        <button type="button" class="secondary-btn" onclick="app.editMachine('${this.escapeJs(task.machineId)}')">
                            <i class="fa-solid fa-pen"></i> 編集
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        const lineOptions = Array.from(new Set(machines.map(m => m.lineNo).filter(Boolean)))
            .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
            .map(line => `<option value="${this.escapeHtml(line)}" ${String(listFilters.line) === String(line) ? 'selected' : ''}>${this.escapeHtml(this.getLineLabel(line))}</option>`)
            .join('');

        container.innerHTML = `
            <div class="machine-maintenance-list-head">
                <div>
                    <b>メンテリスト</b>
                    <span>${rows.length}件</span>
                </div>
                <small>完了ボタンでメンテナンス完了報告を開きます。</small>
            </div>
            <div class="machine-maintenance-filter-bar">
                <select onchange="app.setMachineMaintenanceListFilter('status', this.value)" title="状態で絞り込み">
                    <option value="all" ${listFilters.status === 'all' ? 'selected' : ''}>全状態</option>
                    <option value="calendarRemaining" ${listFilters.status === 'calendarRemaining' ? 'selected' : ''}>表示月の残り</option>
                    <option value="calendarCompleted" ${listFilters.status === 'calendarCompleted' ? 'selected' : ''}>表示月の完了</option>
                    <option value="overdue" ${listFilters.status === 'overdue' ? 'selected' : ''}>期限切れのみ</option>
                    <option value="active" ${listFilters.status === 'active' ? 'selected' : ''}>未完了のみ</option>
                </select>
                <select onchange="app.setMachineMaintenanceListFilter('kind', this.value)" title="メンテ種別で絞り込み">
                    <option value="all" ${listFilters.kind === 'all' ? 'selected' : ''}>全種別</option>
                    <option value="periodic" ${listFilters.kind === 'periodic' ? 'selected' : ''}>周期ありのみ</option>
                    <option value="oneOff" ${listFilters.kind === 'oneOff' ? 'selected' : ''}>単発のみ</option>
                </select>
                <select onchange="app.setMachineMaintenanceListFilter('line', this.value)" title="ラインで絞り込み">
                    <option value="all" ${listFilters.line === 'all' ? 'selected' : ''}>全ライン</option>
                    ${lineOptions}
                </select>
                <button type="button" class="secondary-btn" onclick="app.machineMaintenanceListFilters={status:'all',kind:'all',line:'all'}; app.renderMachines();">
                    <i class="fa-solid fa-filter-circle-xmark"></i> 解除
                </button>
            </div>
            <table class="data-table machine-maintenance-table">
                <thead>
                    <tr>
                        <th>装置</th>
                        <th>メンテ内容</th>
                        <th>周期</th>
                        <th>開始日</th>
                        <th>次回予定</th>
                        <th>直近実績</th>
                        <th>実績</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml || '<tr><td colspan="8" style="text-align:center; padding:36px; color:var(--text-light);">表示できるメンテ項目はありません</td></tr>'}
                </tbody>
            </table>
        `;
    }

    openMachinePhotoChoice(machineId, event = null) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const machine = store.getMachines(true).find(item => String(item.id) === String(machineId));
        if (!machine) return;
        this.openQuickPhotoChoice({ type: 'machine', id: String(machineId) });
    }

    openGuidePhotoChoice(historyId, event = null) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const history = (store.activeData.history || []).find(item => String(item.id) === String(historyId));
        if (!history) return;
        this.openQuickPhotoChoice({ type: 'guide', id: String(historyId) });
    }

    openPartPhotoChoice(name = '', model = '', event = null) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        this.openQuickPhotoChoice({ type: 'part', name, model: model || '' });
    }

    openQuickPhotoChoice(target = {}) {
        let input = document.getElementById('machine-photo-quick-input');
        if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.id = 'machine-photo-quick-input';
            input.accept = 'image/*';
            input.hidden = true;
            document.body.appendChild(input);
        }
        input._quickPhotoTarget = target;
        input._machinePhotoTargetId = target.type === 'machine' ? String(target.id) : '';
        input.onchange = async (changeEvent) => {
            const file = changeEvent.target.files?.[0];
            changeEvent.target.value = '';
            if (!file || !/^image\//i.test(file.type || '')) return;
            try {
                const src = typeof this.readPhotoManagerFileAsDataUrl === 'function'
                    ? await this.readPhotoManagerFileAsDataUrl(file)
                    : await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result || ''));
                        reader.onerror = () => reject(reader.error || new Error('画像を読み込めませんでした'));
                        reader.readAsDataURL(file);
                    });
                this.applyQuickPhotoFromSource(input._quickPhotoTarget || target, src);
            } catch (error) {
                console.error(error);
            }
        };
        if (typeof this.openImageSourceChoice === 'function') {
            this.openImageSourceChoice(input);
        } else {
            input.click();
        }
    }

    applyQuickPhotoFromSource(target = {}, src = '') {
        if (target?.type === 'machine') {
            this.applyMachinePhotoFromSource(target.id, src);
            return;
        }
        if (target?.type === 'guide') {
            this.applyGuidePhotoFromSource(target.id, src);
            return;
        }
        if (target?.type === 'part') {
            this.applyPartPhotoFromSource(target.name, target.model || '', src);
        }
    }

    applyMachinePhotoFromSource(machineId, src) {
        if (!/^data:image\//i.test(src || '')) return;
        const machine = store.getMachines(true).find(item => String(item.id) === String(machineId));
        if (!machine) return;
        store.updateMachine(machine.id, { photo: src });
        store.save?.();
        this.renderMachines();
        this.renderPhotoManager?.();
        this.showPhotoManagerNotice?.('機械写真を設定しました。');
    }

    applyGuidePhotoFromSource(historyId, src) {
        if (!/^data:image\//i.test(src || '')) return;
        const history = (store.activeData.history || []).find(item => String(item.id) === String(historyId));
        if (!history) return;
        if (!history.guide || typeof history.guide !== 'object') history.guide = {};
        const current = Array.isArray(history.guide.photos) ? history.guide.photos : [];
        history.guide.photos = [{ src, marks: [], printSize: 72 }, ...current];
        store.save();
        this.renderGuides?.();
        this.renderPhotoManager?.();
        this.showPhotoManagerNotice?.('手順書の代表画像を設定しました。');
    }

    applyPartPhotoFromSource(name = '', model = '', src = '') {
        if (!/^data:image\//i.test(src || '')) return;
        if (!Array.isArray(store.activeData.partsMaster)) store.activeData.partsMaster = [];
        let part = store.activeData.partsMaster.find(item => item.name === name && (item.model || '') === (model || ''));
        if (!part) {
            part = { name, model: model || '', price: 0, stock: 0, unit: '個', photo: '' };
            store.activeData.partsMaster.push(part);
        }
        part.photo = src;
        store.save();
        this.renderAnalysis?.();
        this.renderPhotoManager?.();
        this.showPhotoManagerNotice?.('部品画像を設定しました。');
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppMachineMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppMachineMethods.prototype[name];
        }
    }
})();
