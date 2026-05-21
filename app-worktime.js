(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppWorkTimeMethods extends MaintenanceApp {
    setWorkTimeGroup(mode) {
        this.workTimeGroupBy = mode;
        this.workTimeDrillDownCategory = null;
        const btnWorker = document.getElementById('btn-worktime-worker');
        const btnCategory = document.getElementById('btn-worktime-category');
        const searchInput = document.getElementById('worktime-search');
        if (btnWorker) btnWorker.classList.toggle('active', mode === 'worker');
        if (btnCategory) btnCategory.classList.toggle('active', mode === 'category');
        if (searchInput) {
            searchInput.placeholder = mode === 'worker' ? '作業員を検索...' : '装置区分を検索...';
        }
        this.renderWorkTime();
    }

    renderWorkTime(searchQuery = '') {
        const container = document.getElementById('worktime-container');
        if (!container) return;

        const q = (searchQuery || '').toLowerCase().trim();
        this.workTimeSearchQuery = q;
        const period = document.getElementById('worktime-filter-period')?.value || 'this_month';
        const lineVal = document.getElementById('worktime-filter-line')?.value || 'all';
        this.updateViewSubtitle('view-worktime', period);

        // Populate line filter if empty (except for 'all')
        const lineFilter = document.getElementById('worktime-filter-line');
        if (lineFilter && lineFilter.options.length <= 1) {
            const lines = new Set();
            store.activeData.history.forEach(h => { if(h.lineNo) lines.add(h.lineNo); });
            store.getMachines(true).forEach(m => { if(m.lineNo) lines.add(m.lineNo); });
            Array.from(lines).sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric:true})).forEach(l => {
                const opt = document.createElement('option');
                opt.value = l;
                opt.textContent = this.getLineLabel(l);
                lineFilter.appendChild(opt);
            });
        }

        const isDrilledDown = !!this.workTimeDrillDownCategory;
        const currentGroupBy = this.workTimeGroupBy || 'worker';

        // トレンドグラフの描画
        this.renderWorkTimeTrend();

        let history = store.getHistory({});
        history = this.filterHistoryByPeriod(history, period);

        if (lineVal !== 'all') {
            const machines_temp = store.getMachines(true);
            history = history.filter(h => {
                const m = machines_temp.find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                return String(l) === String(lineVal);
            });
        }
        const machines = store.getMachines(true);

        const statsMap = {}; 
        const archivedStats = { totalTime: 0, pt: 0, st: 0, np: 0, dt: 0, pc: 0, sc: 0, npc: 0, dc: 0, machineTimeMap: {}, troubleCountMap: {} };
        let totalTimeSum = 0;

        history.forEach(h => {
            const time = parseInt(h.workTime) || 0;
            const isPeriodic = !!h.taskId;
            const m = machines.find(x => x.id === h.machineId);
            
            // Get group key
            let groupKeys = [];
            if (currentGroupBy === 'category') {
                let cat = (m && m.category) ? m.category : (h.machineCategory || 'その他');
                groupKeys = [cat];
            } else {
                groupKeys = (h.workers || []).map(w => w.trim()).filter(Boolean);
            }

            groupKeys.forEach(k => {
                totalTimeSum += time;
                const isArchived = (currentGroupBy === 'worker' && store.isWorkerArchived(k));
                
                const s = isArchived ? archivedStats : (statsMap[k] || (statsMap[k] = { totalTime: 0, pt: 0, st: 0, np: 0, dt: 0, pc: 0, sc: 0, npc: 0, dc: 0, machineTimeMap: {}, troubleCountMap: {} }));
                
                s.totalTime += time;
                if (isPeriodic) {
                    s.pt += time;
                    s.pc++;
                } else if (h.isDokatei) {
                    s.dt += time;
                    s.dc++;
                } else if (h.isNonProductionStop) {
                    s.np += time;
                    s.npc++;
                } else {
                    s.st += time;
                    s.sc++;
                }
                if (m) {
                    const normModel = MaintenanceApp.toHalfWidthLower(m.model);
                    const mKey = `${m.name} [${normModel}]`;
                    s.machineTimeMap[mKey] = (s.machineTimeMap[mKey] || 0) + time;
                }
                const content = this.getHistoryDisplayText(h);
                s.troubleCountMap[content] = (s.troubleCountMap[content] || 0) + 1;
            });
        });

        let results = Object.entries(statsMap).map(([name, s]) => {
            const avgSudden = s.sc > 0 ? (s.st / s.sc).toFixed(1) : 0;
            const avgDokatei = s.dc > 0 ? (s.dt / s.dc).toFixed(1) : 0;
            const pct = totalTimeSum > 0 ? ((s.totalTime / totalTimeSum) * 100).toFixed(1) : 0;
            
            const topMachines = Object.entries(s.machineTimeMap).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>`・${x[0]} (${x[1]}分)`).join('<br>');
            const topTroubles = Object.entries(s.troubleCountMap).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>`・${x[0]} (${x[1]}件)`).join('<br>');

            return { name, totalTime: s.totalTime, pct, pt: s.pt, st: s.st, np: s.np, dt: s.dt, pc: s.pc, sc: s.sc, npc: s.npc, dc: s.dc, avgSudden, avgDokatei, topMachines, topTroubles, isArchived: false };
        });

        if (currentGroupBy === 'worker' && archivedStats.totalTime > 0) {
            const s = archivedStats;
            const pct = totalTimeSum > 0 ? ((s.totalTime / totalTimeSum) * 100).toFixed(1) : 0;
            const topMachines = Object.entries(s.machineTimeMap).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>`・${x[0]} (${x[1]}分)`).join('<br>');
            const topTroubles = Object.entries(s.troubleCountMap).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>`・${x[0]} (${x[1]}件)`).join('<br>');
            results.push({ name: '旧作業者合計', totalTime: s.totalTime, pct, pt: s.pt, st: s.st, np: s.np, dt: s.dt, pc: s.pc, sc: s.sc, npc: s.npc, dc: s.dc, avgSudden: (s.sc > 0 ? (s.st / s.sc).toFixed(1) : 0), avgDokatei: (s.dc > 0 ? (s.dt / s.dc).toFixed(1) : 0), topMachines, topTroubles, isArchived: true });
        }

        if (q) {
            const terms = q.split(/[\s　]+/).filter(Boolean);
            results = results.filter(r => {
                const nr = MaintenanceStore.toHalfWidthLower(r.name);
                return terms.every(t => nr.includes(t));
            });
        }
        results.sort((a, b) => b.totalTime - a.totalTime);

        container.innerHTML = '';
        
        if (isDrilledDown) {
            const backLink = document.createElement('div');
            backLink.style.cssText = 'margin-bottom: 15px; font-size: 0.85rem;';
            backLink.innerHTML = `
                <span style="color:var(--text-light); font-weight:700;">表示中: </span>
                <span style="color:var(--primary); font-weight:900; background:var(--primary-light); padding:2px 8px; border-radius:4px;">${this.workTimeDrillDownCategory}</span>
                <a href="#" onclick="app.workTimeDrillDownCategory=null; app.renderWorkTime(); return false;" style="margin-left:12px; color:var(--text-light); text-decoration:underline;">全体に戻る</a>
            `;
            container.appendChild(backLink);
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.style.cssText = 'margin-bottom:0; width:100%;';
        table.innerHTML = `
                <thead>
                    <tr>
                        <th style="background:#f8fafc; color:var(--text-light); font-weight:700;">${isDrilledDown ? '機械名' : (currentGroupBy === 'worker' ? '作業者' : '装置区分')}</th>
                        <th style="background:#f8fafc; color:var(--text-light); font-weight:700; text-align:right;">合計時間 <span style="font-size:0.6rem">(分) / 割合</span></th>
                        <th style="background:#f0f9ff; color:#1e40af; font-weight:700; text-align:right;">定期メンテ <span style="font-size:0.6rem">(分)</span></th>
                        <th style="background:#f0f9ff; color:#1e40af; font-weight:700; text-align:center;">件数</th>
                        <th style="background:#f0fdf4; color:#166534; font-weight:700; text-align:right;">突発対応 <span style="font-size:0.6rem">(分)</span></th>
                        <th style="background:#f0fdf4; color:#166534; font-weight:700; text-align:center;">件数</th>
                        <th style="background:#fffbeb; color:#92400e; font-weight:700; text-align:right;">非生産停止 <span style="font-size:0.6rem">(分)</span></th>
                        <th style="background:#fffbeb; color:#92400e; font-weight:700; text-align:center;">件数</th>
                        <th style="background:#fef2f2; color:#b91c1c; font-weight:700; text-align:right;">ドカ停 <span style="font-size:0.6rem">(分)</span></th>
                        <th style="background:#fef2f2; color:#b91c1c; font-weight:700; text-align:center;">件数</th>
                        <th style="background:#f8fafc; color:var(--text-light); font-weight:700; text-align:right;">平均突発 <span style="font-size:0.6rem">(分)</span></th>
                        <th style="background:#f8fafc; color:var(--text-light); font-weight:700; text-align:right;">平均ドカ停 <span style="font-size:0.6rem">(分)</span></th>
                        <th style="background:#f8fafc; color:var(--text-light); font-weight:700;">${currentGroupBy === 'worker' ? '経験機械トップ3' : '主なトラブル内容トップ3'}</th>
                        <th style="background:#f8fafc; color:var(--text-light); font-weight:700; text-align:center;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(r => {
                        let displayName = this.highlightText(r.name, q);
                        if (isDrilledDown) {
                            const mach = machines.find(m => `${m.name} [${MaintenanceApp.toHalfWidthLower(m.model)}]` === r.name);
                            if (mach && mach.lineNo) {
                                displayName = this.getLineBadge(mach.lineNo) + displayName;
                            }
                        }
                        return `
                        <tr style="${r.isArchived ? 'background: #f8fafc; font-style: italic; opacity: 0.8;' : ''}">
                            <td style="font-weight:700; color:var(--text-main);">${displayName}</td>
                            <td style="text-align:right; font-weight:900; color:var(--primary); font-size:1rem;">
                                ${r.totalTime.toLocaleString()} <span style="font-size:0.75rem; color:var(--text-light); font-weight:400; margin-left:4px;">(${r.pct}%)</span>
                            </td>
                            <td style="text-align:right; font-weight:800; color:#1e40af; background:#f0f9ff; font-size:1rem;">${r.pt.toLocaleString()}</td>
                            <td style="text-align:center; background:#f0f9ff;">
                                <span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#fff; color:#1e40af; font-weight:800; font-size:0.75rem; border:1px solid #dbeafe;">${r.pc}</span>
                            </td>
                            <td style="text-align:right; font-weight:800; color:#166534; background:#f0fdf4; font-size:1rem;">${r.st.toLocaleString()}</td>
                            <td style="text-align:center; background:#f0fdf4;">
                                <span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#fff; color:#166534; font-weight:800; font-size:0.75rem; border:1px solid #dcfce7;">${r.sc}</span>
                            </td>
                            <td style="text-align:right; font-weight:800; color:#92400e; background:#fffbeb; font-size:1rem;">${(r.np || 0).toLocaleString()}</td>
                            <td style="text-align:center; background:#fffbeb;">
                                <span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#fff; color:#92400e; font-weight:800; font-size:0.75rem; border:1px solid #fde68a;">${r.npc || 0}</span>
                            </td>
                            <td style="text-align:right; font-weight:800; color:#b91c1c; background:#fef2f2; font-size:1rem;">${r.dt.toLocaleString()}</td>
                            <td style="text-align:center; background:#fef2f2;">
                                <span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#fff; color:#b91c1c; font-weight:800; font-size:0.75rem; border:1px solid #fecaca;">${r.dc}</span>
                            </td>
                            <td style="text-align:right; font-weight:800; color:var(--text-main); font-size:0.85rem;">${r.avgSudden}</td>
                            <td style="text-align:right; font-weight:800; color:var(--danger); font-size:0.85rem;">${r.avgDokatei}</td>
                            <td style="font-size:0.7rem; color:var(--text-light); line-height:1.4; padding:8px 4px; min-width:180px;">${currentGroupBy === 'worker' ? (r.topMachines || '-') : (r.topTroubles || '-')}</td>
                            <td style="text-align:center;">
                                ${currentGroupBy === 'category' || isDrilledDown ? '-' : (r.isArchived ? '-' : `<button class="secondary-btn" style="padding:2px 8px; font-size:0.7rem;" onclick="app.archiveWorkerFromWorktime('${r.name}')">アーカイブ</button>`)}
                            </td>
                        </tr>
                        `;
                    }).join('') || '<tr><td colspan="14" style="text-align:center; padding:40px; color:var(--text-light);">この期間の作業記録がありません</td></tr>'}
                </tbody>
        `;
        container.appendChild(table);
    }

    renderWorkTimeTrend() {
        const card = document.getElementById('worktime-trend-card');
        const canvas = document.getElementById('worktime-trend-chart');
        if (!card || !canvas) return;
        
        card.style.display = 'block';
        const ctx = canvas.getContext('2d');
        const machines = store.getMachines(true);

        // Register plugin for labels (required for trend chart as well)
        if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
        
        // 直近12ヶ月の枠組み作成
        const months = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                label: `${d.getFullYear()}/${d.getMonth() + 1}`,
                year: d.getFullYear(),
                month: d.getMonth(),
                pt: 0, st: 0, np: 0, dt: 0
            });
        }
        
        let history = store.getHistory({});
        const lineVal = document.getElementById('worktime-filter-line')?.value || 'all';
        if (lineVal !== 'all') {
            history = history.filter(h => {
                const m = machines.find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                return String(l) === String(lineVal);
            });
        }
        if (this.workTimeSearchQuery) {
            const q = this.workTimeSearchQuery.toLowerCase();
            if (this.workTimeGroupBy === 'category') {
                history = history.filter(h => {
                    const m = machines.find(x => x.id === h.machineId);
                    const cat = (m && m.category) ? m.category : (h.machineCategory || 'その他');
                    return cat.toLowerCase().includes(q);
                });
            } else {
                history = history.filter(h => (h.workers || []).some(w => w.trim().toLowerCase().includes(q)));
            }
        }
        
        if (this.excludePeriodicInTrend) {
            history = history.filter(h => !h.taskId);
        }

        const isDrilledDownTrend = !!this.workTimeDrillDownCategory;
        const currentGroupBy = this.workTimeGroupBy || 'worker';
        const datasets = [];
        
        const trendTitle = document.getElementById('worktime-trend-title');
        if (trendTitle) {
            trendTitle.style.display = 'flex';
            trendTitle.style.justifyContent = 'space-between';
            trendTitle.style.alignItems = 'center';
            trendTitle.innerHTML = `
                <div style="display:flex; align-items:center; gap:20px;">
                    <div><i class="fa-solid fa-chart-line"></i> ${isDrilledDownTrend ? `<span style="color:var(--primary)">${this.workTimeDrillDownCategory} 内の</span>機械別 作業時間推移` : '月別作業時間の推移 (過去12ヶ月)'}</div>
                    <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; color:var(--text-light); font-weight:700; cursor:pointer; background:var(--background); padding:4px 10px; border-radius:12px; border:1px solid var(--border);">
                        <input type="checkbox" id="trend-exclude-periodic" ${this.excludePeriodicInTrend ? 'checked' : ''} onchange="app.excludePeriodicInTrend=this.checked; app.renderWorkTimeTrend()">
                        定期メンテを除外
                    </label>
                </div>
                ${isDrilledDownTrend ? `<button class="secondary-btn" style="padding:4px 10px; font-size:0.7rem; font-weight:800; background:white; color:var(--primary); border-color:var(--primary); border-radius:4px; height:auto; margin-bottom:5px;" onclick="app.workTimeDrillDownCategory=null; app.renderWorkTime();"><i class="fa-solid fa-arrow-left"></i> 全体へ戻る</button>` : ''}
            `;
        }

        if (currentGroupBy === 'worker') {
            if (isDrilledDownTrend) {
                // ドリルダウン中 (詳細な内容別)
                const detailMap = {};
                const sel = (this.workTimeDrillDownCategory || '').trim();
                
                history.forEach(h => {
                    const isPt = !!h.taskId;
                    const isDt = !!h.isDokatei;
                    const isNp = !isPt && !isDt && !!h.isNonProductionStop;
                    const isSt = !isPt && !isDt && !isNp;
                    
                    // フィルタリング (クリックされた種別に絞る)
                    if (sel === '定期メンテ' && !isPt) return;
                    if (sel === '突発対応' && !isSt) return;
                    if (sel === '非生産停止' && !isNp) return;
                    if (sel === 'ドカ停' && !isDt) return;
                    
                    // それ以外の名前（詳細な作業名など）がセットされている場合
                    // または想定外の名前の場合は、その種別のデータがないためフィルタで落とされる
                    if (sel !== '定期メンテ' && sel !== '突発対応' && sel !== '非生産停止' && sel !== 'ドカ停') {
                        // 種別名以外でドリルダウンされている場合は解除
                        return;
                    }

                    const title = this.getHistoryDisplayText(h);
                    if (!detailMap[title]) detailMap[title] = months.map(() => 0);
                    
                    const d = new Date(h.date);
                    const time = parseInt(h.workTime) || 0;
                    const mIdx = months.findIndex(m => m.year === d.getFullYear() && m.month === d.getMonth());
                    if (mIdx !== -1) detailMap[title][mIdx] += time;
                });

                const sortedDetails = Object.entries(detailMap).sort((a,b) => b[1].reduce((s,v)=>s+v,0) - a[1].reduce((s,v)=>s+v,0));
                const topDetails = sortedDetails.slice(0, 5);
                const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#6366f1'];
                topDetails.forEach(([label, data], i) => {
                    datasets.push({ label, data, borderColor: colors[i % colors.length], backgroundColor: 'transparent', borderWidth: 2, tension: 0.3 });
                });

                // もしデータが一件もない（変なラベルでドリルダウンされた）場合は強制リセット
                if (datasets.length === 0) {
                    setTimeout(() => { this.workTimeDrillDownCategory = null; this.renderWorkTime(); }, 0);
                }
            } else {
                // 通常時 (タイプ別)
                history.forEach(h => {
                    const d = new Date(h.date);
                    const time = parseInt(h.workTime) || 0;
                    const target = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
                    if (target) {
                        if (h.taskId) target.pt += time;
                        else if (h.isDokatei) target.dt += time;
                        else if (h.isNonProductionStop) target.np += time;
                        else target.st += time;
                    }
                });
                if (!this.excludePeriodicInTrend) {
                    datasets.push({ label: '定期メンテ', data: months.map(m => m.pt), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3 });
                }
                datasets.push(
                    { label: '突発対応', data: months.map(m => m.st), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3 },
                    { label: '非生産停止', data: months.map(m => m.np), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: true, tension: 0.3 },
                    { label: 'ドカ停', data: months.map(m => m.dt), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3 }
                );
            }
        } else {
            // 装置区分別 または ドリルダウン(機器別)
            const labelMap = {};
            history.forEach(h => {
                const m = machines.find(x => x.id === h.machineId);
                const cat = (m && m.category) ? m.category : (h.machineCategory || 'その他');
                
                let key = '';
                if (isDrilledDownTrend) {
                    if (cat !== this.workTimeDrillDownCategory) return;
                    key = m ? `${m.name} [${m.model}]` : '不明';
                } else {
                    key = cat;
                }

                if (!labelMap[key]) labelMap[key] = months.map(() => 0);
                
                const d = new Date(h.date);
                const time = parseInt(h.workTime) || 0;
                const mIdx = months.findIndex(m => m.year === d.getFullYear() && m.month === d.getMonth());
                if (mIdx !== -1) labelMap[key][mIdx] += time;
            });

            // 上位 5 つの項目 + その他 に絞る
            const sortedLabels = Object.entries(labelMap).sort((a,b) => b[1].reduce((s,v)=>s+v,0) - a[1].reduce((s,v)=>s+v,0));
            const topLabels = sortedLabels.slice(0, 5);
            
            const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#6366f1'];
            topLabels.forEach(([label, data], i) => {
                datasets.push({
                    label: label,
                    data: data,
                    borderColor: colors[i % colors.length],
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3
                });
            });
        }
        
        if (this._trendChart) this._trendChart.destroy();

        // 最大値を取得して左右の軸を同期させる
        const allDataValues = datasets.flatMap(d => d.data);
        const peak = Math.max(...allDataValues, 10);
        const yMax = Math.ceil((peak * 1.1) / 20) * 20;
        
        this._trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months.map(m => m.label),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    const groupMode = this.workTimeGroupBy || 'worker';

                    // 既にドリルダウン中の場合：再クリックで解除
                    if (this.workTimeDrillDownCategory) {
                        this.workTimeDrillDownCategory = null;
                        this.renderWorkTime();
                        return;
                    }

                    const activePoints = this._trendChart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true);
                    if (activePoints.length > 0) {
                        const dsIdx = activePoints[0].datasetIndex;
                        const label = this._trendChart.data.datasets[dsIdx].label;
                        if (label) {
                            this.workTimeDrillDownCategory = label;
                            this.renderWorkTime();
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { 
                        position: 'left',
                        beginAtZero: true,
                        min: 0,
                        max: yMax,
                        title: { display: true, text: '作業時間 (分)', font: { weight: '800' } }
                    },
                    yR: {
                        position: 'right',
                        beginAtZero: true,
                        min: 0,
                        max: yMax,
                        grid: { display: false },
                        title: { display: true, text: '作業時間 (分)', font: { weight: '800' } }
                    }
                },
                plugins: {
                    legend: { 
                        position: 'top', 
                        labels: { boxWidth: 12, font: { weight: '700', size: 11 }, cursor: 'pointer' },
                        onClick: (e, legendItem, legend) => {
                            const groupMode = this.workTimeGroupBy || 'worker';
                            if (this.workTimeDrillDownCategory) {
                                // 既に詳細表示中の場合、凡例クリックで全体の表示に戻す
                                this.workTimeDrillDownCategory = null;
                            } else {
                                // 全体表示中の場合、選択した項目でドリルダウン
                                this.workTimeDrillDownCategory = legendItem.text;
                            }
                            this.renderWorkTime();
                        }
                    },
                    datalabels: {
                        anchor: 'center',
                        align: 'top',
                        offset: (ctx) => {
                            const lastIdx = ctx.dataset.data.length - 1;
                            if (ctx.dataIndex === lastIdx || ctx.dataIndex === lastIdx - 1) {
                                const val = ctx.dataset.data[ctx.dataIndex];
                                if (val <= 0) return 4;
                                const allValsAtIdx = ctx.chart.data.datasets
                                    .map((ds, i) => ({ val: ds.data[ctx.dataIndex], dsIndex: i }))
                                    .filter(item => item.val > 0)
                                    .sort((a, b) => (a.val - b.val) || (a.dsIndex - b.dsIndex));
                                const rank = allValsAtIdx.findIndex(item => item.dsIndex === ctx.datasetIndex);
                                return 4 + (rank * 12);
                            }
                            return 4;
                        },
                        clip: false,
                        formatter: (val, ctx) => {
                            const lastIdx = ctx.dataset.data.length - 1;
                            if ((ctx.dataIndex === lastIdx || ctx.dataIndex === lastIdx - 1) && val > 0) {
                                return ctx.dataset.label;
                            }
                            return null;
                        },
                        font: { weight: '800', size: 10 },
                        color: (ctx) => ctx.dataset.borderColor,
                        textStrokeColor: 'rgba(255,255,255,0.8)',
                        textStrokeWidth: 2
                    },
                    tooltip: { position: 'nearest', mode: 'index', intersect: false }
                }
            }
        });
    }

    openWorkTimeGraph() {
        const period = document.getElementById('worktime-filter-period')?.value || 'this_month';
        let history = store.getHistory({});
        history = this.filterHistoryByPeriod(history, period);
        
        // 人名フィルタが行われている場合、その人を含む履歴のみに絞り込む
        if (this.workTimeSearchQuery) {
            history = history.filter(h => (h.workers || []).some(w => w.trim().toLowerCase().includes(this.workTimeSearchQuery)));
        }

        const ptData = history.filter(h => !!h.taskId);
        const stData = history.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop);
        const npData = history.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop);
        const dtData = history.filter(h => !!h.isDokatei);

        const ptTime = ptData.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const stTime = stData.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const npTime = npData.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const dtTime = dtData.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const total = ptTime + stTime + npTime + dtTime;

        if (total === 0) return alert('この期間のデータがありません');

        const machines = store.getMachines(true);
        const isCatMode = this.workTimeGroupBy === 'category';
        const isDrilledDown = !!this.workTimeDrillDownCategory;

        const getBreakdown = (list) => {
            const map = {};
            list.forEach(h => {
                const m = machines.find(x => x.id === h.machineId);
                const mCat = h.machineCategory || m?.category || 'その他';
                
                // Filter if drilled down
                if (isDrilledDown && mCat !== this.workTimeDrillDownCategory) return;
                
                const mName = m ? m.name : '不明';
                
                let label = '';
                if (isDrilledDown) {
                    label = mName;
                } else if (isCatMode) {
                    label = mCat;
                } else {
                    const task = this.getHistoryDisplayText(h);
                    label = `${h.date} [${mName}] ${task.length > 20 ? task.substring(0,20)+'...' : task}`;
                }

                if (!map[label]) map[label] = { time: 0, workers: new Set(), troubles: {} };
                map[label].time += (parseInt(h.workTime) || 0);
                (h.workers || []).forEach(w => map[label].workers.add(w.trim()));
                
                // トラブル内容（作業内容）を集計
                const taskContent = this.getHistoryDisplayText(h);
                map[label].troubles[taskContent] = (map[label].troubles[taskContent] || 0) + (parseInt(h.workTime) || 0);
            });
            return Object.entries(map).map(([label, info]) => {
                const topTroubles = Object.entries(info.troubles)
                    .sort((a,b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(x => x[0]);

                return {
                    label,
                    time: info.time,
                    workers: Array.from(info.workers).filter(Boolean).sort().join('、'),
                    topTroubles: topTroubles.join(' / ')
                };
            }).filter(x => x.time > 0).sort((a,b) => b.time - a.time).slice(0, 15);
        };

        const ptBreakdown = getBreakdown(ptData);
        const stBreakdown = getBreakdown(stData);
        const npBreakdown = getBreakdown(npData);
        const dtBreakdown = getBreakdown(dtData);

        const periodMap = { 'this_month': '今月', 'fiscal_year': '今年度', 'all': '累計', 'custom': '指定日以降' };
        let periodDisplay = periodMap[period] || period;
        if (period === 'custom') {
            const customDate = localStorage.getItem('customStartDate');
            if (customDate) periodDisplay = `${customDate}以降`;
        }

        this._currentGraphData = {
            total: { ptTime, stTime, npTime, dtTime },
            pt: ptBreakdown,
            st: stBreakdown,
            np: npBreakdown,
            dt: dtBreakdown,
            period: periodDisplay
        };

        this.openModal('worktime-chart-grid', `${isDrilledDown ? `${this.workTimeDrillDownCategory} 内の機器別集計` : '作業時間・内容の内訳'}（${periodDisplay}）`, () => {
            const body = document.getElementById('modal-content');
            document.getElementById('modal-container').style.maxWidth = '950px';

            body.innerHTML = `
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:30px; padding:10px;">
                    <!-- 1. Total Composition -->
                    <div style="background:var(--background); padding:16px; border-radius:12px; border:1px solid var(--border);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-weight:900; font-size:0.9rem; color:var(--text-main);"><i class="fa-solid fa-chart-pie"></i> 全体構成</div>
                            <div style="font-size:0.8rem; font-weight:900; color:var(--text-light); background:#f1f5f9; padding:2px 10px; border-radius:99px;">合計 ${total} 分</div>
                        </div>
                        <div style="height:220px;"><canvas id="chart-total"></canvas></div>
                    </div>
                    <!-- 2. Periodic Details -->
                    <div style="background:var(--background); padding:16px; border-radius:12px; border:1px solid var(--border);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-weight:900; font-size:0.9rem; color:#1e40af;"><i class="fa-solid fa-calendar-check"></i> 定期メンテ 内訳</div>
                            <div style="font-size:0.8rem; font-weight:900; color:#1e40af; background:#eff6ff; padding:2px 10px; border-radius:99px;">合計 ${ptTime} 分</div>
                        </div>
                        <div style="height:220px;"><canvas id="chart-pt"></canvas></div>
                    </div>
                    <!-- 3. Sudden Response Details -->
                     <div style="background:var(--background); padding:16px; border-radius:12px; border:1px solid var(--border);">
                         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                             <div style="font-weight:900; font-size:0.9rem; color:#166534;"><i class="fa-solid fa-bolt"></i> 突発対応 内訳</div>
                             <div style="font-size:0.8rem; font-weight:900; color:#166534; background:#f0fdf4; padding:2px 10px; border-radius:99px;">合計 ${stTime} 分</div>
                         </div>
                         <div style="height:220px;"><canvas id="chart-st"></canvas></div>
                     </div>
                     <!-- 4. Non-production-stop Details -->
                     <div style="background:var(--background); padding:16px; border-radius:12px; border:1px solid var(--border);">
                         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                             <div style="font-weight:900; font-size:0.9rem; color:#92400e;"><i class="fa-solid fa-circle-pause"></i> 非生産停止 内訳</div>
                             <div style="font-size:0.8rem; font-weight:900; color:#92400e; background:#fffbeb; padding:2px 10px; border-radius:99px;">合計 ${npTime} 分</div>
                         </div>
                         <div style="height:220px;"><canvas id="chart-np"></canvas></div>
                     </div>
                     <!-- 5. Dokatei Details -->
                    <div style="background:var(--background); padding:16px; border-radius:12px; border:1px solid var(--border);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-weight:900; font-size:0.9rem; color:#b91c1c;"><i class="fa-solid fa-triangle-exclamation"></i> ドカ停 原因内訳</div>
                            <div style="font-size:0.8rem; font-weight:900; color:#b91c1c; background:#fef2f2; padding:2px 10px; border-radius:99px;">合計 ${dtTime} 分</div>
                        </div>
                        <div style="height:220px;"><canvas id="chart-dt"></canvas></div>
                    </div>
                </div>
                <div style="margin-top:20px; padding:12px; background:#f8fafc; border-radius:8px; font-size:0.8rem; color:var(--text-light); line-height:1.6;">
                    <i class="fa-solid fa-info-circle" style="color:var(--primary);"></i> 各項目にマウスを合わせると、作業者名を含む詳細内訳が見れます。パーセンテージは常に表示されます。
                </div>
            `;

            const commonOptions = {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (isCatMode && !isDrilledDown && elements && elements.length > 0) {
                        const index = elements[0].index;
                        // ctx inside onClick is various things... use instance
                        // This might be tricky if not careful.
                        // Let's use the labels from the specific chart context if available, 
                        // or just rely on items being available in the sub-chart creation.
                    }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: '#fff',
                        font: { weight: '800', size: 11 },
                        formatter: (val, ctx) => {
                            const totalTime = ctx.dataset.data.reduce((a,b)=>a+b,0);
                            const pct = ((val / totalTime) * 100).toFixed(1);
                            if (pct < 4) return ''; // 面積が小さい場合は非表示

                            // 全体構成グラフはパーセンテージのみ（今のまま）
                            if (ctx.chart.canvas.id === 'chart-total') return `${pct}%`;
                            
                            const label = ctx.chart.data.labels[ctx.dataIndex];
                            if (isCatMode) {
                                // 装置区分別：区分名 ＋ ％
                                const shortLabel = label.length > 8 ? label.substring(0, 8) + '..' : label;
                                return `${shortLabel}\n${pct}%`;
                            } else {
                                // 作業者別： 日付 (MM/DD) ＋ ％
                                // labelは "YYYY-MM-DD [機械] 内容..." という形式を想定
                                const datePart = label.substring(5, 10).replace('-', '/'); // "MM/DD"
                                return `${datePart}\n(${pct}%)`;
                            }
                        },
                        textStrokeColor: 'rgba(0,0,0,0.5)',
                        textStrokeWidth: 1,
                    },
                    tooltip: {
                        padding: 12,
                        titleFont: { size: 13, weight: '800' },
                        bodyFont: { size: 12 },
                        backgroundColor: 'rgba(255, 255, 255, 0.96)',
                        titleColor: '#1e293b',
                        bodyColor: '#475569',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => `時間: ${ctx.parsed} 分`,
                        }
                    }
                }
            };

            // Register plugin for labels
            Chart.register(ChartDataLabels);

            // 1. Total Chart
            this._charts = {};
            this._charts.total = new Chart(document.getElementById('chart-total'), {
                type: 'doughnut',
                data: {
                    labels: ['定期メンテ', '突発対応', '非生産停止', 'ドカ停'],
                    datasets: [{
                        data: [ptTime, stTime, npTime, dtTime],
                        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 1
                    }]
                },
                options: { 
                    ...commonOptions, 
                    plugins: { 
                        ...commonOptions.plugins, 
                        legend: { display: true, position: 'right', labels: { boxWidth: 12, font: { size: 11, weight: '700' } } } 
                    } 
                }
            });

            // Helper to build breakdown Tooltip
            const createBreakdownTooltip = (breakdownArray) => ({
                ...commonOptions.plugins.tooltip,
                callbacks: {
                    label: (ctx) => `時間: ${ctx.parsed} 分 (${((ctx.parsed / ctx.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`,
                    afterBody: (ctx) => {
                        const item = breakdownArray[ctx[0].dataIndex];
                        if (isCatMode) {
                            return `\n主な内容:\n・${(item.topTroubles || '-').split(' / ').join('\n・')}`;
                        } else {
                            return `\n担当者: ${item.workers || '-'}`;
                        }
                    }
                }
            });

            // 2. Periodic Chart
            this._charts.pt = new Chart(document.getElementById('chart-pt'), {
                type: 'pie',
                data: {
                    labels: ptBreakdown.map(x => x.label),
                    datasets: [{
                        data: ptBreakdown.map(x => x.time),
                        backgroundColor: ptBreakdown.map((_, i) => `hsl(217, 80%, ${45 + i*5}%)`),
                        borderWidth: 1
                    }]
                },
                options: { ...commonOptions, plugins: { ...commonOptions.plugins, tooltip: createBreakdownTooltip(ptBreakdown) } }
            });

            // 3. Sudden Chart
            this._charts.st = new Chart(document.getElementById('chart-st'), {
                type: 'pie',
                data: {
                    labels: stBreakdown.map(x => x.label),
                    datasets: [{
                        data: stBreakdown.map(x => x.time),
                        backgroundColor: stBreakdown.map((_, i) => `hsl(142, 70%, ${35 + i*5}%)`),
                        borderWidth: 1
                    }]
                },
                options: { ...commonOptions, plugins: { ...commonOptions.plugins, tooltip: createBreakdownTooltip(stBreakdown) } }
            });

            // 4. Non-production-stop Chart
            this._charts.np = new Chart(document.getElementById('chart-np'), {
                type: 'pie',
                data: {
                    labels: npBreakdown.map(x => x.label),
                    datasets: [{
                        data: npBreakdown.map(x => x.time),
                        backgroundColor: npBreakdown.map((_, i) => `hsl(38, 85%, ${45 + i*5}%)`),
                        borderWidth: 1
                    }]
                },
                options: { ...commonOptions, plugins: { ...commonOptions.plugins, tooltip: createBreakdownTooltip(npBreakdown) } }
            });

            // 4. Dokatei Chart
            this._charts.dt = new Chart(document.getElementById('chart-dt'), {
                type: 'pie',
                data: {
                    labels: dtBreakdown.map(x => x.label),
                    datasets: [{
                        data: dtBreakdown.map(x => x.time),
                        backgroundColor: dtBreakdown.map((_, i) => `hsl(0, 80%, ${45 + i*5}%)`),
                        borderWidth: 1
                    }]
                },
                options: { ...commonOptions, plugins: { ...commonOptions.plugins, tooltip: createBreakdownTooltip(dtBreakdown) } }
            });

            // Override footer to add PRINT button
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `
                    <button class="secondary-btn" style="margin-right:auto;" onclick="app.printWorkTimeGraph()">
                        <i class="fa-solid fa-print"></i> 印刷する
                    </button>
                    ${isDrilledDown ? `
                        <button class="secondary-btn" style="margin-right:12px;" onclick="app.workTimeDrillDownCategory=null; app.openWorkTimeGraph();">
                            <i class="fa-solid fa-arrow-left"></i> 全体に戻る
                        </button>
                    ` : ''}
                    <button class="primary-btn" onclick="app.closeModal()">閉じる</button>
                `;
            }
        });
    }

    printWorkTimeGraph() {
        if (!this._currentGraphData) return;
        const d = this._currentGraphData;
        const isCatMode = this.workTimeGroupBy === 'category';

        // Capture Charts as Images
        const imgTotal = this._charts.total.toBase64Image();
        const imgPt = this._charts.pt.toBase64Image();
        const imgSt = this._charts.st.toBase64Image();
        const imgNp = this._charts.np?.toBase64Image();
        const imgDt = this._charts.dt.toBase64Image();

        const buildTable = (title, list, color, totalCategoryTime) => {
            return `
                <div style="margin-top:24px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid ${color}; padding-bottom:5px; margin-bottom:8px;">
                        <h3 style="margin:0; font-size:1rem; color:${color};">${title}</h3>
                        <div style="font-weight:900; font-size:0.9rem; color:${color};">合計 ${totalCategoryTime} 分</div>
                    </div>
                    <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                        <thead>
                            <tr style="background:#f8fafc; text-align:left;">
                                <th style="border:1px solid #e2e8f0; padding:8px;">${isCatMode ? '装置区分名' : '項目 (対象機械 / 内容)'}</th>
                                <th style="border:1px solid #e2e8f0; padding:8px; text-align:right;">時間</th>
                                <th style="border:1px solid #e2e8f0; padding:8px; text-align:right;">％</th>
                                <th style="border:1px solid #e2e8f0; padding:8px;">${isCatMode ? 'トラブル内容 (上位3件)' : '担当者'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.map(x => `
                                <tr>
                                    <td style="border:1px solid #e2e8f0; padding:8px;">${x.label}</td>
                                    <td style="border:1px solid #e2e8f0; padding:8px; text-align:right; font-weight:700;">${x.time}分</td>
                                    <td style="border:1px solid #e2e8f0; padding:8px; text-align:right;">${((x.time/totalCategoryTime)*100).toFixed(1)}%</td>
                                    <td style="border:1px solid #e2e8f0; padding:8px;">${isCatMode ? (x.topTroubles || '-') : (x.workers || '-')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        };

        const printWin = window.open('', '_blank');
        const overallTotal = d.total.ptTime + d.total.stTime + (d.total.npTime || 0) + d.total.dtTime;
        
        printWin.document.write(`
            <html>
                <head>
                    <title>作業時間分析レポート - ${d.period}</title>
                    <style>
                        body { font-family: "Noto Sans JP", sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                        h1 { font-size: 1.6rem; border-bottom: 3px solid #1e293b; padding-bottom: 10px; margin-bottom: 15px; }
                        .period-badge { display: inline-block; background: #f1f5f9; padding: 6px 16px; border-radius: 99px; font-size: 0.9rem; font-weight: 800; border: 1px solid #e2e8f0; }
                        .overall-total { float: right; font-size: 1.2rem; font-weight: 900; color: #1e293b; }
                        .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-top: 30px; }
                        .chart-item { border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; text-align: center; background: #fff; }
                        .chart-item img { max-width: 100%; height: auto; max-height: 220px; }
                        .chart-title { font-size: 0.85rem; font-weight: 800; margin-bottom: 10px; color: #64748b; display: flex; justify-content: space-between; }
                        @media print { .no-print { display:none; } @page { margin: 1.5cm; } }
                    </style>
                </head>
                <body>
                    <div class="no-print" style="margin-bottom:30px;">
                        <button onclick="window.print()" style="padding:12px 24px; cursor:pointer; font-weight:800; background:#1e293b; color:white; border:none; border-radius:8px;">印刷を実行する</button>
                    </div>
                    <div class="overall-total">総作業時間: ${overallTotal} 分</div>
                    <h1>作業時間・内容の内訳レポート</h1>
                    <div class="period-badge">集計期間: ${d.period}</div>

                    <div class="chart-grid">
                        <div class="chart-item">
                            <div class="chart-title"><span>全体構成</span> <span>合計 ${overallTotal}分</span></div>
                            <img src="${imgTotal}">
                        </div>
                        <div class="chart-item">
                            <div class="chart-title"><span style="color:#1e40af;">定期メンテ内訳</span> <span style="color:#1e40af;">合計 ${d.total.ptTime}分</span></div>
                            <img src="${imgPt}">
                        </div>
                        <div class="chart-item">
                            <div class="chart-title"><span style="color:#166534;">突発対応内訳</span> <span style="color:#166534;">合計 ${d.total.stTime}分</span></div>
                            <img src="${imgSt}">
                        </div>
                        <div class="chart-item">
                            <div class="chart-title"><span style="color:#92400e;">非生産停止内訳</span> <span style="color:#92400e;">合計 ${d.total.npTime || 0}分</span></div>
                            <img src="${imgNp || ''}">
                        </div>
                        <div class="chart-item">
                            <div class="chart-title"><span style="color:#b91c1c;">ドカ停原因内訳</span> <span style="color:#b91c1c;">合計 ${d.total.dtTime}分</span></div>
                            <img src="${imgDt}">
                        </div>
                    </div>

                    ${buildTable('定期メンテナンス 詳細内訳', d.pt, '#1e40af', d.total.ptTime)}
                    ${buildTable('突発不具合対応 詳細内訳', d.st, '#166534', d.total.stTime)}
                    ${buildTable('非生産停止トラブル 詳細内訳', d.np || [], '#92400e', d.total.npTime || 0)}
                    ${buildTable('ドカ停（重大故障）詳細内訳', d.dt, '#b91c1c', d.total.dtTime)}

                    <div style="margin-top:40px; padding-top:20px; border-top:1px solid #e2e8f0; font-size:0.75rem; color:#94a3b8; text-align:right;">
                        出力日時: ${new Date().toLocaleString()} | 工場保全管理システム Maintenance Next
                    </div>
                </body>
            </html>
        `);
        printWin.document.close();
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppWorkTimeMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppWorkTimeMethods.prototype[name];
        }
    }
})();
