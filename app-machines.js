(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppMachineMethods extends MaintenanceApp {
    // --- Machines Implementation ---

    renderMachines(searchQuery = '') {
        const container = document.getElementById('machines-list');
        if (!container) return;
        
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
                        ${m.photo ? `<img src="${m.photo}">` : '<i class="fa-solid fa-industry" style="font-size:1.4rem; color:#cbd5e1;"></i>'}
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
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppMachineMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppMachineMethods.prototype[name];
        }
    }
})();
