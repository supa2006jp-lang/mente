(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppMiscAnalysisMethods extends MaintenanceApp {
    getMachineCategoryOptions(currentValue = '') {
        const categories = store.getMachineCategories();
        return categories.map(c => `
            <option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>
        `).join('');
    }

    openTroubleComparisonModal() {
        const periodOptions = [
            { id: 'last_30_days', label: '直近 30日間' },
            { id: 'prev_30_days', label: 'その前の 30日間' },
            { id: 'this_month', label: '今月 (1日〜本日)' },
            { id: 'last_month', label: '先月 (全期間)' },
            { id: 'fiscal_year', label: '今年度' },
            { id: 'last_fiscal_year', label: '前年度' },
            { id: 'custom', label: '指定日以降' },
            { id: 'custom_range', label: '指定範囲 (開始〜終了)' }
        ];

        this.openModal('trouble-compare', 'トラブル増減比較分析', () => {
            const content = document.getElementById('modal-content');
            document.getElementById('modal-container').style.maxWidth = '600px';

            content.innerHTML = `
                <div style="padding:15px; background:var(--primary-light); border-radius:10px; border:1px solid var(--primary); margin-bottom:24px; font-size:0.8rem; line-height:1.5; color:var(--primary);">
                    <i class="fa-solid fa-circle-info"></i> 2つの期間における<b>突発対応＋ドカ停</b>の合計時間と件数を比較します。
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom: 24px;">
                    <div class="form-group">
                        <label style="font-weight:800; color:var(--text-light); text-align:center; display:block; margin-bottom:8px;">比較元 (期間A)</label>
                        <select id="compare-period-a" style="border:2px solid #e2e8f0; font-weight:700;">
                            ${periodOptions.map(o => `<option value="${o.id}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label style="font-weight:800; color:var(--text-light); text-align:center; display:block; margin-bottom:8px;">比較先 (期間B)</label>
                        <select id="compare-period-b" style="border:2px solid var(--primary); font-weight:700;">
                            ${periodOptions.map((o, i) => `<option value="${o.id}" ${i === 1 ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div id="compare-result-container">
                    <div style="padding:40px; text-align:center; color:var(--text-light); border:2px dashed var(--border); border-radius:12px;">
                        <i class="fa-solid fa-play" style="font-size:1.5rem; margin-bottom:10px; opacity:0.3;"></i><br>
                        期間を選択して「分析実行」を押してください
                    </div>
                </div>
            `;

            // Attach onchange handlers to the comparison dropdowns
            const selA = document.getElementById('compare-period-a');
            const selB = document.getElementById('compare-period-b');
            if (selA) selA.onchange = () => this.onPeriodChange(selA, () => {});
            if (selB) selB.onchange = () => this.onPeriodChange(selB, () => {});
            
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `
                    <button class="secondary-btn" onclick="app.closeModal()">閉じる</button>
                    <button class="primary-btn" onclick="app.runTroubleComparison()"><i class="fa-solid fa-magnifying-glass-chart"></i> 分析を実行</button>
                `;
            }
        });
    }

    runTroubleComparison() {
        const pA = document.getElementById('compare-period-a').value;
        const pB = document.getElementById('compare-period-b').value;
        const resultDiv = document.getElementById('compare-result-container');
        if (!resultDiv) return;

        const getStats = (period) => {
            const hist = this.filterHistoryByPeriod(store.activeData.history, period);
            const troubles = hist.filter(h => !h.taskId || h.isDokatei);
            const time = troubles.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
            const count = troubles.length;
            return { time, count };
        };

        const statsA = getStats(pA);
        const statsB = getStats(pB);
        const daysA = this.getPeriodDays(pA);
        const daysB = this.getPeriodDays(pB);
        const labelA = this.getPeriodLabel(pA);
        const labelB = this.getPeriodLabel(pB);

        // Calculate Daily Averages for Fair Comparison
        const avgTimeA = statsA.time / daysA;
        const avgTimeB = statsB.time / daysB;
        const avgCountA = statsA.count / daysA;
        const avgCountB = statsB.count / daysB;

        const getDiff = (a, b) => {
            if (a === 0) return b === 0 ? 0 : 100;
            return ((b - a) / a) * 100;
        };

        const diffTime = getDiff(avgTimeA, avgTimeB);
        const diffCount = getDiff(avgCountA, avgCountB);

        const formatBadge = (val) => {
            const isGood = val <= 0;
            const color = isGood ? '#16a34a' : '#dc2626';
            const icon = isGood ? 'fa-arrow-down' : 'fa-arrow-up';
            const sign = val > 0 ? '+' : '';
            return `<span style="color:${color}; font-weight:900; font-size:1.1rem; display:flex; align-items:center; gap:4px;">
                <i class="fa-solid ${icon}"></i> ${sign}${val.toFixed(1)}%
            </span>`;
        };

        resultDiv.innerHTML = `
            <div style="font-size:0.75rem; color:var(--text-light); text-align:center; margin-bottom:15px; padding:8px; background:#f8fafc; border-radius:8px; line-height:1.4;">
                <i class="fa-solid fa-scale-balanced"></i> 期間の長さが異なるため、<b>1日の平均値（時間・回数）</b>に換算して比較しました。<br>
                <span style="opacity:0.8;">(期間A: ${daysA}日間 / 期間B: ${daysB}日間)</span>
            </div>

            <div style="display:grid; grid-template-columns:1fr auto 1fr; gap:10px; align-items:center;">
                <!-- Time Row -->
                <div style="background:#f8fafc; padding:12px; border-radius:12px; border:1px solid #e2e8f0; text-align:center; height:100%;">
                    <div style="font-size:0.65rem; color:var(--primary); font-weight:800; background:#eff6ff; padding:2px 8px; border-radius:99px; display:inline-block; margin-bottom:8px;">${labelA}</div>
                    <div style="font-size:0.75rem; color:var(--text-light); margin-bottom:4px;">期間A 合計</div>
                    <div style="font-size:1.3rem; font-weight:900;">${statsA.time}<span style="font-size:0.8rem;">分</span></div>
                    <div style="font-size:0.65rem; color:var(--text-light); opacity:0.7;">(${avgTimeA.toFixed(1)}分/日)</div>
                </div>
                <div style="text-align:center; color:#cbd5e1;"><i class="fa-solid fa-arrow-right-long"></i></div>
                <div style="background:#fff; padding:12px; border-radius:12px; border:2px solid var(--primary); text-align:center; height:100%;">
                    <div style="font-size:0.65rem; color:white; font-weight:800; background:var(--primary); padding:2px 8px; border-radius:99px; display:inline-block; margin-bottom:8px;">${labelB}</div>
                    <div style="font-size:0.75rem; color:var(--text-light); margin-bottom:4px;">期間B 合計</div>
                    <div style="font-size:1.3rem; font-weight:900; color:var(--primary);">${statsB.time}<span style="font-size:0.8rem;">分</span></div>
                    <div style="font-size:0.65rem; color:var(--primary); opacity:0.8; font-weight:700;">(${avgTimeB.toFixed(1)}分/日)</div>
                    <div style="margin-top:6px; display:flex; justify-content:center;">${formatBadge(diffTime)}</div>
                </div>

                <!-- Count Row -->
                <div style="background:#f8fafc; padding:12px; border-radius:12px; border:1px solid #e2e8f0; text-align:center; margin-top:15px; height:100%;">
                    <div style="font-size:0.65rem; color:var(--primary); font-weight:800; background:#eff6ff; padding:2px 8px; border-radius:99px; display:inline-block; margin-bottom:8px;">${labelA}</div>
                    <div style="font-size:0.75rem; color:var(--text-light); margin-bottom:4px;">期間A 件数</div>
                    <div style="font-size:1.3rem; font-weight:900;">${statsA.count}<span style="font-size:0.8rem;">件</span></div>
                    <div style="font-size:0.65rem; color:var(--text-light); opacity:0.7;">(${avgCountA.toFixed(2)}件/日)</div>
                </div>
                <div style="text-align:center; color:#cbd5e1; margin-top:15px;"><i class="fa-solid fa-arrow-right-long"></i></div>
                <div style="background:#fff; padding:12px; border-radius:12px; border:2px solid var(--primary); text-align:center; margin-top:15px; height:100%;">
                    <div style="font-size:0.65rem; color:white; font-weight:800; background:var(--primary); padding:2px 8px; border-radius:99px; display:inline-block; margin-bottom:8px;">${labelB}</div>
                    <div style="font-size:0.75rem; color:var(--text-light); margin-bottom:4px;">期間B 件数</div>
                    <div style="font-size:1.3rem; font-weight:900; color:var(--primary);">${statsB.count}<span style="font-size:0.8rem;">件</span></div>
                    <div style="font-size:0.65rem; color:var(--primary); opacity:0.8; font-weight:700;">(${avgCountB.toFixed(2)}件/日)</div>
                    <div style="margin-top:6px; display:flex; justify-content:center;">${formatBadge(diffCount)}</div>
                </div>
            </div>

            <div style="margin-top:20px; padding:14px; background:#f0fdf4; border-radius:10px; border:1px solid #bbf7d0; font-size:0.75rem; color:#166534; line-height:1.6;">
                <div style="font-weight:900; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-magnifying-glass-chart"></i> 分析結果の要約 (日平均での比較)
                </div>
                1日あたりの停止時間は <b>${diffTime.toFixed(1)}%</b> ${diffTime <= 0 ? '減少しました！素晴らしい改善傾向です。' : '増加しました。要因の分析が必要です。'}
                1日あたりの平均発生件数は <b>${diffCount.toFixed(1)}%</b> ${diffCount <= 0 ? '減少しました。' : '増加しました。'}<br>
                <span style="font-size:0.65rem; opacity:0.8; margin-top:4px; display:block;">※比較ロジック: それぞれの期間の長さで正規化した「日平均」の変化率を算出しています。</span>
            </div>
        `;
    }

    viewGuideDetails(hId) {
        this.openGuideModal(hId);
    }

    getMachineCategoryOptions(currentValue = '', showAddNew = true) {
        const categories = store.getMachineCategories();
        let html = categories.map(c => `
            <option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>
        `).join('');
        if (showAddNew) {
            html += `<option value="ADD_NEW_CATEGORY">+ 新しい区分を追加</option>`;
        }
        return html;
    }

    /**
     * 各モーダルからの装置区分入力を処理し、必要であれば新規登録を行う共通メソッド
     * @param {string} prefix モーダルのID接頭辞 (例: 'f-', 's-', 'e-')
     * @returns {string} 最終的なカテゴリ名
     */
    getCategoryFromModalInput(prefix) {
        let category = document.getElementById(`${prefix}machine-category`)?.value || '';
        if (category === 'ADD_NEW_CATEGORY') {
            const newCat = MaintenanceApp.toFullWidthUpper(document.getElementById(`${prefix}new-category-input`)?.value || '');
            if (newCat) {
                store.addMachineCategory(newCat);
                category = newCat;
            } else {
                category = 'その他';
            }
        } else {
            category = MaintenanceApp.toFullWidthUpper(category);
        }
        return category;
    }

    toggleNewCategoryField(prefix) {
        const select = document.getElementById(`${prefix}machine-category`);
        const input = document.getElementById(`${prefix}new-category-input`);
        if (select && input) {
            input.style.display = (select.value === 'ADD_NEW_CATEGORY') ? 'block' : 'none';
            if (select.value === 'ADD_NEW_CATEGORY') input.focus();
        }
    }

    setAnalysisMode(mode) {
        this.analysisMode = mode;
        this.costDrillDownCategory = null;
        const btnParts = document.getElementById('btn-analysis-parts');
        const btnMachines = document.getElementById('btn-analysis-machines');
        if (btnParts) btnParts.classList.toggle('active', mode === 'parts');
        if (btnMachines) btnMachines.classList.toggle('active', mode === 'machines');
        
        const rateBox = document.getElementById('cost-labor-rate-box');
        if (rateBox) rateBox.style.display = (mode === 'machines' ? 'flex' : 'none');

        const catFilter = document.getElementById('cost-category-filter');
        if (catFilter) catFilter.style.display = (mode === 'machines' ? 'flex' : 'none');

        const subtitle = document.getElementById('analysis-subtitle');
        if (subtitle) {
            subtitle.textContent = mode === 'parts' 
                ? '交換部品の消費ペースと年間コスト予測' 
                : '装置ごとの年間メンテナンスコスト（部品代＋作業人件費）算出';
        }
        
        this.renderAnalysis();
    }

    setCostFilter(filter) {
        this.costFilter = filter;
        ['all', 'periodic', 'sudden'].forEach(f => {
            const btn = document.getElementById(`btn-cost-${f}`);
            if (btn) btn.classList.toggle('active', f === filter);
        });
        this.renderAnalysis();
    }

    clearCostDrilldown() {
        this.costDrillDownCategory = null;
        this.renderAnalysis();
    }

    toggleSidebarBottom() {
        const container = document.getElementById('sidebar-bottom-container');
        const chevron = document.getElementById('sidebar-bottom-chevron');
        if (container && chevron) {
            const isCollapsed = container.classList.toggle('collapsed');
            chevron.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
            localStorage.setItem('sidebar_bottom_collapsed', isCollapsed);
        }
    }

    toggleSidebarStats() {
        const container = document.getElementById('sidebar-stats-container');
        const chevron = document.getElementById('sidebar-stats-chevron');
        if (container && chevron) {
            const isCollapsed = container.classList.toggle('collapsed');
            chevron.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
            localStorage.setItem('sidebar_stats_collapsed', isCollapsed);
        }
    }

    renderMachineCostAnalysis(history) {
        const container = document.getElementById('analysis-container');
        if (!container) return;

        const machines = store.getMachines(true);
        const costMap = {};

        const isDrilledDown = !!this.costDrillDownCategory;

        history.forEach(h => {
            const m = machines.find(x => x.id === h.machineId);
            const mCat = h.machineCategory || m?.category || '未分類';
            
            // Drill-down filtering
            if (isDrilledDown && mCat !== this.costDrillDownCategory) return;
            
            const key = isDrilledDown ? h.machineId : mCat;
            
            if (!costMap[key]) {
                const subTitle = isDrilledDown ? (m ? m.model : '-') : '区分別計';
                costMap[key] = {
                    id: key,
                    name: isDrilledDown ? (m ? m.name : '削除済みの機械') : mCat,
                    model: subTitle,
                    partsCost: 0,
                    laborCost: 0,
                    totalCost: 0,
                    time: 0,
                    partsUsed: {} // Store { 'name::model': { name, model, count, price } }
                };
            }

            const stats = costMap[key];
            
            // Parts Cost
            if (h.replacedParts) {
                h.replacedParts.forEach(p => {
                    const master = store.getPartMaster(p.name, p.model);
                    const price = parseFloat(p.price) || master?.price || 0;
                    const count = parseFloat(p.count) || 0;
                    const cost = price * count;
                    stats.partsCost += cost;

                    if (count > 0) {
                        const pName = p.name || '不明な部品';
                        const pModel = p.model || '-';
                        const pKey = `${pName}::${pModel}`;
                        if (!stats.partsUsed[pKey]) {
                            stats.partsUsed[pKey] = { name: pName, model: pModel, count: 0, price: price };
                        }
                        stats.partsUsed[pKey].count += count;
                    }
                });
            }

            // Labor Cost
            const time = parseInt(h.workTime) || 0;
            stats.time += time;
            stats.laborCost += (time / 60) * this.laborRate;
        });

        Object.values(costMap).forEach(s => {
            s.laborCost = Math.round(s.laborCost);
            s.partsCost = Math.round(s.partsCost);
            s.totalCost = s.partsCost + s.laborCost;
        });

        const sorted = Object.values(costMap).sort((a, b) => b.totalCost - a.totalCost);

        container.innerHTML = `
            <div class="card" style="grid-column: 1 / -1; padding: 24px; margin-bottom: 24px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
                    <div>
                        <h3 style="font-size:1.1rem; font-weight:900; margin-bottom:4px;">
                            <i class="fa-solid fa-chart-bar" style="margin-right:8px; color:var(--primary);"></i> 
                            ${isDrilledDown ? `${this.costDrillDownCategory} 内のコスト詳細` : '装置区分別 メンテナンスコスト順位'}
                        </h3>
                        <p style="font-size:0.8rem; color:var(--text-light);">
                            ${isDrilledDown ? '※棒をクリックすると区分一覧に戻ります' : '※棒をクリックすると個別の機械にドリルダウンします'} 
                            / 人件費単価: ${this.laborRate.toLocaleString()}円/h
                        </p>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        ${isDrilledDown ? `
                            <button class="secondary-btn" style="padding:6px 12px; font-size:0.75rem; font-weight:800;" onclick="app.clearCostDrilldown()">
                                <i class="fa-solid fa-arrow-left"></i> 区分別に戻る
                            </button>
                        ` : ''}
                        <div style="background:#f1f5f9; padding:8px 16px; border-radius:8px; text-align:right;">
                            <div style="font-size:0.65rem; color:var(--text-light); font-weight:800;">集計期間内 総コスト</div>
                            <div style="font-size:1.2rem; font-weight:900; color:var(--primary);">¥${Math.round(sorted.reduce((sum, x) => sum + (x.totalCost || 0), 0)).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                <div style="height: ${Math.max(350, sorted.length * 40 + 80)}px; width: 100%;">
                    <canvas id="cost-ranking-chart"></canvas>
                </div>
            </div>

            <div class="card" style="grid-column: 1 / -1; padding:0; overflow-x:auto;">
                <table class="data-table" style="margin-bottom:0; min-width:800px;">
                    <thead>
                        <tr style="background:#f8fafc;">
                            <th style="padding:15px;">装置名 / 型式</th>
                            <th style="text-align:right;">合計コスト</th>
                            <th style="text-align:right;">部品代</th>
                            <th style="text-align:right;">作業人件費</th>
                            <th style="text-align:right;">作業時間</th>
                            <th style="text-align:right;">内訳割合</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map(s => {
                            const total = s.totalCost || 0;
                            const pCost = s.partsCost || 0;
                            const partPct = total > 0 ? (pCost / total * 100).toFixed(1) : 0;
                            
                            // Tooltip Breakdown Text
                            const laborLabel = `【作業費】 ${(s.time/60).toFixed(1)}h × ¥${this.laborRate.toLocaleString()} = ¥${Math.round(s.laborCost).toLocaleString()}`;
                            const pEntries = Object.values(s.partsUsed || {});
                            const partsDetails = pEntries.map(p => `・${p.name} [${p.model}]: ¥${Math.round(p.price).toLocaleString()} × ${p.count} = ¥${Math.round(p.price * p.count).toLocaleString()}`).join('\n');
                            const fullBreakdown = `【内訳】\n${partsDetails ? partsDetails + '\n' : ''}${laborLabel}`.replace(/"/g, '&quot;');

                            return `
                                <tr>
                                    <td>
                                        <div style="font-weight:900; font-size:0.95rem;">${s.name}</div>
                                        <div style="font-size:0.75rem; color:var(--text-light);">${s.model}</div>
                                    </td>
                                    <td style="text-align:right; font-weight:900; color:var(--primary); font-size:1.1rem; cursor:help;" title="${fullBreakdown}">¥${Math.round(total).toLocaleString()}</td>
                                    <td style="text-align:right; color:var(--text-main); cursor:help;" title="${(partsDetails || '部品交換なし').replace(/"/g, '&quot;')}">¥${Math.round(pCost).toLocaleString()}</td>
                                    <td style="text-align:right; color:var(--text-main); cursor:help;" title="${laborLabel.replace(/"/g, '&quot;')}">¥${Math.round(s.laborCost || 0).toLocaleString()}</td>
                                    <td style="text-align:right; color:var(--text-light);">${s.time || 0} 分</td>
                                    <td style="text-align:right; width:150px;">
                                        <div style="display:flex; height:10px; border-radius:5px; overflow:hidden; background:#e2e8f0;">
                                            <div style="width:${partPct}%; background:var(--primary);" title="部品代: ${partPct}%"></div>
                                            <div style="width:${100-partPct}%; background:#94a3b8;" title="人件費: ${100-partPct}%"></div>
                                        </div>
                                        <div style="font-size:0.6rem; color:var(--text-light); margin-top:4px;">
                                            部品 ${partPct}% / 人件費 ${(100-partPct).toFixed(1)}%
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        setTimeout(() => {
            const ctx = document.getElementById('cost-ranking-chart');
            if (ctx && sorted.length > 0) {
                if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
                if (this._costRankingChart) this._costRankingChart.destroy();
                const topN = sorted;
                this._costRankingChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: topN.map(x => {
                            const nm = x.name || '不明';
                            const md = x.model || '-';
                            const truncatedNm = nm.length > 10 ? nm.substring(0, 10) + '...' : nm;
                            return [truncatedNm, md];
                        }),
                        datasets: [
                            {
                                label: '部品代 (円)',
                                data: topN.map(x => x.partsCost || 0),
                                backgroundColor: '#1E40AF',
                            },
                            {
                                label: '作業人件費 (円)',
                                data: topN.map(x => x.laborCost || 0),
                                backgroundColor: '#F97316',
                            }
                        ]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        onClick: (evt, elements) => {
                            if (isDrilledDown) {
                                // Detail mode -> reset to Category view
                                this.clearCostDrilldown();
                                return;
                            }
                            if (elements && elements.length > 0) {
                                const index = elements[0].index;
                                const originalName = topN[index].name;
                                
                                if (!isDrilledDown) {
                                    // Drill down into category
                                    this.costDrillDownCategory = originalName;
                                    this.renderAnalysis();
                                }
                            }
                        },
                        scales: {
                            x: { 
                                stacked: true, 
                                ticks: { 
                                    callback: v => '¥' + (v >= 10000 ? (v/10000) + '万' : (v/1000) + 'k') 
                                } 
                            },
                            y: { 
                                stacked: true,
                                ticks: { font: { size: 10 } }
                            }
                        },
                        plugins: {
                            legend: { position: 'bottom' },
                            datalabels: {
                                color: '#ffffff',
                                font: { weight: 'bold', size: 14 },
                                anchor: 'start',
                                align: 'end',
                                offset: 4,
                                clip: false, // Allow overflow
                                display: true, // Force show regardless of width
                                formatter: (value) => value > 0 ? '¥' + Math.round(value).toLocaleString() : '',
                                textStrokeColor: 'rgba(0,0,0,0.5)',
                                textStrokeWidth: 1.5
                            },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => `${ctx.dataset.label}: ¥${Math.round(ctx.raw || 0).toLocaleString()}`,
                                    afterBody: (items) => {
                                        const index = items[0].dataIndex;
                                        const datasetIndex = items[0].datasetIndex;
                                        const s = topN[index];
                                        if (!s) return '';
                                        
                                        if (datasetIndex === 0) {
                                            // Parts Cost segment
                                            const pEntries = Object.values(s.partsUsed || {});
                                            const partsDetails = pEntries.map(p => `・${p.name}: ¥${Math.round(p.price).toLocaleString()} × ${p.count}`).join('\n');
                                            return `\n【内訳】\n${partsDetails || '部品交換なし'}`;
                                        } else {
                                            // Labor Cost segment
                                            const laborLabel = `・作業人件費: ${(s.time/60).toFixed(1)}h × ¥${this.laborRate.toLocaleString()} = ¥${Math.round(s.laborCost).toLocaleString()}`;
                                            return `\n【内訳】\n${laborLabel}`;
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }, 50);
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppMiscAnalysisMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppMiscAnalysisMethods.prototype[name];
        }
    }
})();
