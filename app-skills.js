(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppSkillMethods extends MaintenanceApp {
    // --- Skill Map ---
    renderWorkers() {
        const container = document.getElementById('workers-container');
        if (!container) return;
        container.style.cssText = 'display:block; width:100%;';

        const history = store.getHistory({}).filter(h => h.isFirstTime !== false && !h.hideFromSkillMap);
        const machines = store.getMachines(true);

        const workerSet = new Set();
        history.forEach(h => {
            const wList = Array.isArray(h.workers) ? h.workers : [];
            wList.forEach(w => {
                if (typeof w === 'string') workerSet.add(w.trim());
            });
        });
        const workers = Array.from(workerSet).filter(Boolean).filter(w => !store.isWorkerArchived(w)).sort();

        if (workers.length === 0) {
            container.innerHTML = '<div style="padding:40px; color:var(--text-light)">作業者が記録されていません。メンテナンス記録に作業者名を入力してください。</div>';
            return;
        }

        const SKILL_KEY = 'skillEvaluations';
        let skillEvals = {};
        try { skillEvals = JSON.parse(localStorage.getItem(SKILL_KEY) || '{}'); } catch(e) {}

        const workerTasks = {};
        const latestNotesMap = {};
        const taskTypeMap = {}; 
        const firstRespondersMap = {};
        const taskEarliestDateMap = {};

        history.forEach(h => {
            const m = machines.find(x => x.id === h.machineId);
            const machineName = m ? `${m.name}` : '不明';
            const machineModel = m ? m.model : '';
            const content = h.taskId
                ? (store.activeData.tasks.find(t => t.id === h.taskId)?.content || h.taskContent || '定期メンテナンス')
                : (h.errorContent || h.notes || '突発対応');
            const taskKey = `${h.machineId}__${content}`;
            if (!this._taskCategoryMap) this._taskCategoryMap = {};
            if (!this._taskCategoryMap[taskKey]) this._taskCategoryMap[taskKey] = h.category || 'other';

            let typeColor = '#16a34a';
            if (h.isDokatei) typeColor = '#dc2626';
            else if (h.taskId) typeColor = '#1e3a8a';
            if (!taskTypeMap[taskKey] || typeColor !== '#1e3a8a') taskTypeMap[taskKey] = typeColor;

            if (!latestNotesMap[taskKey]) {
                const catLabels = { machine: '機械修理', electric: '電気系', adjust: '調整', parts: '部品交換', clean: '清掃・給油', other: 'その他' };
                const catText = catLabels[h.category] ? `\n[区分: ${catLabels[h.category]}]` : '';
                latestNotesMap[taskKey] = (h.notes || '') + catText;
            }

            (h.workers || []).forEach(w => {
                const ww = w.trim();
                if (!ww) return;
                if (!workerTasks[ww]) workerTasks[ww] = {};
                const normalizedModel = MaintenanceApp.toHalfWidthLower(machineModel);
                if (!workerTasks[ww][taskKey]) {
                    workerTasks[ww][taskKey] = { label: content, machine: machineName, machineId: h.machineId, model: normalizedModel, count: 0, lastDate: '', lineNo: h.lineNo || m?.lineNo };
                }
                workerTasks[ww][taskKey].count++;
                if (!workerTasks[ww][taskKey].lastDate || h.date > workerTasks[ww][taskKey].lastDate) {
                    workerTasks[ww][taskKey].lastDate = h.date;
                }

                if (!taskEarliestDateMap[taskKey] || h.date < taskEarliestDateMap[taskKey]) {
                    taskEarliestDateMap[taskKey] = h.date;
                    firstRespondersMap[taskKey] = new Set([ww]);
                } else if (h.date === taskEarliestDateMap[taskKey]) {
                    if (firstRespondersMap[taskKey]) firstRespondersMap[taskKey].add(ww);
                }
            });
        });

        const allTaskMap = {};
        Object.entries(workerTasks).forEach(([w, tasks]) => {
            Object.entries(tasks).forEach(([tk, info]) => {
                if (!allTaskMap[tk]) {
                    allTaskMap[tk] = { 
                        label: info.label, 
                        machine: info.machine, 
                        machineId: info.machineId,
                        model: info.model,
                        lineNo: info.lineNo,
                        latestNotes: latestNotesMap[tk] || '-',
                        color: taskTypeMap[tk] || 'var(--text-main)',
                        category: this._taskCategoryMap[tk] || 'other',
                        isManual: false
                    };
                }
            });
        });

        const manualSkills = JSON.parse(localStorage.getItem('manualSkills') || '[]');
        manualSkills.forEach(ms => {
            const tk = ms.id;
            const catLabels = { machine: '機械修理', electric: '電気系', adjust: '調整', parts: '部品交換', clean: '清掃・給油', other: 'その他' };
            const catText = catLabels[ms.category] ? `\n[区分: ${catLabels[ms.category]}]` : '';
                allTaskMap[tk] = {
                    label: ms.label,
                    machine: ms.machine,
                    model: ms.model || '-',
                    machineCategory: ms.machineCategory || '',
                    lineNo: ms.lineNo || null,
                    latestNotes: (ms.notes || '-') + catText,
                    color: '#7c3aed',
                    category: ms.category || 'other',
                    isManual: true
                };
        });

        let filteredTaskEntries = Object.entries(allTaskMap).filter(([tk, info]) => !store.isTaskArchived(tk));
        
        if (this.skillRiskFilter) {
            filteredTaskEntries = filteredTaskEntries.filter(([tk]) => !workers.some(w => (skillEvals[w] || {})[tk] === '○'));
        } else if (this.skillSoloFilter) {
            filteredTaskEntries = filteredTaskEntries.filter(([tk]) => {
                const count = workers.filter(w => (skillEvals[w] || {})[tk] === '○').length;
                return count === 1;
            });
        }

        if (this.skillModelFilter) {
            filteredTaskEntries = filteredTaskEntries.filter(([, info]) => info.model === this.skillModelFilter);
        }

        if (this.skillSearchQuery) {
            filteredTaskEntries = filteredTaskEntries.filter(([, info]) => {
                const terms = MaintenanceStore.toHalfWidthLower(this.skillSearchQuery).split(/[\s　]+/).filter(Boolean);
                const searchStr = `${info.label || ''} ${info.machine || ''} ${info.model || ''} ${info.machineCategory || ''} ${info.latestNotes || ''}`.toLowerCase();
                const normSearch = MaintenanceStore.toHalfWidthLower(searchStr);
                return terms.every(t => normSearch.includes(t));
            });
        }

        const allTaskEntries = filteredTaskEntries.sort((a, b) => {
            if (this.skillSortMode === 'model') {
                return (a[1].model || '').localeCompare(b[1].model || '');
            } else {
                const totalA = workers.reduce((s, w) => s + (workerTasks[w]?.[a[0]]?.count || 0), 0);
                const totalB = workers.reduce((s, w) => s + (workerTasks[w]?.[b[0]]?.count || 0), 0);
                return totalB - totalA;
            }
        });

        const totalTasks = allTaskEntries.length;

        container.innerHTML = `
            <div style="padding:12px; background:#f0f9ff; border-radius:10px; margin-bottom:16px; font-size:0.82rem; line-height:1.6; color:#0369a1; border:1px solid #bae6fd;">
                <div style="display:flex; align-items:center; gap:8px; font-weight:800; margin-bottom:4px;">
                    <i class="fa-solid fa-circle-info"></i> スキルマップの使い方
                </div>
                <div style="margin-bottom:8px;">
                    ・メンテで入力した作業者は自動で〇が付きますが、出来ない場合は直接△か✕に変更して下さい。
                    ・カレンダーに初回で登録した物が自動でスキルとして追加されます。
                    ・「全員表示」ボタンで、スクロールせずに全員を1画面で確認できます。
                    ・程度が低く必要性の無いスキルは除外ボタンを押して消して下さい。
                    ・<b>人名や習熟率をクリック</b>すると、その人の得意分野を分析したグラフを表示します。
                </div>
                <div style="font-size:0.75rem; color:var(--text-light); display:flex; gap:12px; align-items:center; flex-wrap:wrap; border-top:1px dashed #bae6fd; padding-top:8px;">
                    <span style="font-weight:900; color:#0369a1;">凡例:</span>
                    <span style="color:#16a34a; font-weight:800; background:#dcfce7; padding:2px 10px; border-radius:99px; border:1px solid #bbf7d0;">○ 単独で実施可能</span>
                    <span style="color:#b45309; font-weight:800; background:#fef9c3; padding:2px 10px; border-radius:99px; border:1px solid #fef08a;">△ サポートがあれば可</span>
                    <span style="color:#dc2626; font-weight:800; background:#fee2e2; padding:2px 10px; border-radius:99px; border:1px solid #fecaca;">✕ 未習得</span>
                </div>
            </div>
            <div style="width:100%; overflow:auto; max-height:75vh; border:1px solid var(--border); border-radius:12px; background:#fff; position:relative;">
                <table style="width:100%; border-collapse:separate; border-spacing:0; font-size:${this.skillFitAll ? '0.72rem' : '0.82rem'};">
                    <thead>
                        <tr>
                            <th style="padding:12px 14px; text-align:left; color:#fff; font-weight:800; width:320px; min-width:320px; max-width:320px; position:sticky; left:0; top:0; z-index:100; background:var(--primary); border-bottom:2px solid #1d4ed8; border-right:1px solid #1d4ed8;">作業内容 / 機械</th>
                            <th style="padding:12px 14px; text-align:left; color:#fff; font-weight:800; width:350px; min-width:350px; max-width:350px; position:sticky; left:320px; top:0; z-index:100; background:var(--primary); border-bottom:2px solid #1d4ed8; border-right:1px solid #1d4ed8;">最新の処置・対応内容</th>
                            <th style="padding:10px 4px; text-align:center; color:#fff; font-weight:800; width:45px; position:sticky; top:0; z-index:90; background:var(--primary); border-bottom:2px solid #1d4ed8; border-right:1px solid #1d4ed8;">除外</th>
                            ${workers.map(w => {
                                const evals = skillEvals[w] || {};
                                const circleCountForWorker = filteredTaskEntries.filter(([tk]) => (evals[tk] || (workerTasks[w]?.[tk]?.count > 0 ? '○' : '')) === '○').length;
                                const pct = totalTasks > 0 ? Math.round((circleCountForWorker / totalTasks) * 100) : 0;
                                const pctColor = pct >= 70 ? '#4ade80' : (pct >= 30 ? '#fde047' : '#fca5a5');
                                return `
                                <th style="padding:10px 4px; text-align:center; color:#fff; font-weight:800; position:sticky; top:0; z-index:80; background:var(--primary); border-bottom:2px solid #1d4ed8; border-right:1px solid #60a5fa33; cursor:pointer;" onclick="app.openWorkerRadarModal('${w.replace(/'/g, "\\'")}')" title="${w} さんのスキル特性分析を開く">
                                    <div style="font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-decoration:underline; text-underline-offset:3px;" title="${w}"><i class="fa-solid fa-chart-pie" style="font-size:0.7rem; opacity:0.8; margin-right:2px;"></i> ${w}</div>
                                    <div style="font-size:0.75rem; background:rgba(0,0,0,0.1); border-radius:4px; padding:2px 4px; margin-top:4px; font-weight:900; color:${pctColor};">習熟率: ${pct}%</div>
                                </th>`;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${allTaskEntries.map(([taskKey, info]) => {
                            const circleCount = workers.filter(w => ((skillEvals[w] || {})[taskKey] || (workerTasks[w]?.[taskKey]?.count > 0 ? '○' : '')) === '○').length;
                            let rowBg = '#ffffff'; 
                            let labelSuffix = '';
                            if (circleCount === 0) {
                                rowBg = '#ffcbd1'; // Denser Rose/Red
                                labelSuffix = ' <span style="color:#e11d48; font-size:0.6rem; border:1px solid #e11d48; padding:0 2px; border-radius:2px; font-weight:900; background:#fff; white-space:nowrap;"><i class="fa-solid fa-triangle-exclamation"></i> リスク</span>';
                            } else if (circleCount === 1) {
                                rowBg = '#ffe4b3'; // Denser Orange
                                labelSuffix = ' <span style="color:#ea580c; font-size:0.6rem; border:1px solid #ea580c; padding:0 2px; border-radius:2px; font-weight:900; background:#fff; white-space:nowrap;"><i class="fa-solid fa-user-shield"></i> 属人化</span>';
                            }
                            return `
                            <tr style="background:${rowBg}; border-bottom:1px solid var(--border); transition: background 0.2s;">
                                <td style="padding:8px 14px; vertical-align:middle; position:sticky; left:0; z-index:50; background:inherit; border-right:1px solid var(--border); width:320px; min-width:320px; max-width:320px;">
                                    <div style="font-weight:700; font-size:0.82rem; color:${info.color}; display:flex; flex-wrap:wrap; align-items:center; gap:4px;">
                                        <span style="white-space:normal; line-height:1.2; cursor:pointer; text-decoration:underline;" onclick="app.switchView('history'); document.getElementById('hist-filter-machine').value='${info.machineId || ''}'; document.getElementById('global-search').value='${info.label.split('__')[0].replace(/'/g,"\\'") }'; app.renderHistory();">${this.highlightText(info.label, this.skillSearchQuery)}</span>
                                        ${labelSuffix}
                                    </div>
                                    <div style="font-size:0.65rem; color:var(--text-light); white-space:nowrap; margin-top:2px;">
                                        ${this.getLineBadge(info.lineNo)}${this.highlightText(info.machine, this.skillSearchQuery)} [<span style="color:#ea580c; font-weight:700; cursor:pointer; text-decoration:underline; ${this.skillModelFilter === info.model ? 'background:#ffedd5; padding:0 4px; border-radius:4px; outline:1px solid #ea580c;' : ''}" onclick="app.toggleSkillModelFilter('${info.model || ''}')" title="型式フィルタ">${this.highlightText(info.model || '-', this.skillSearchQuery)}</span>]
                                    </div>
                                </td>
                                <td style="padding:8px 14px; vertical-align:middle; position:sticky; left:320px; z-index:50; background:inherit; border-right:1px solid var(--border); width:350px; min-width:350px; max-width:350px;">
                                    <div style="font-size:0.75rem; color:${info.isManual ? '#7c3aed' : 'var(--text-main)'}; font-weight:${info.isManual ? '700' : '400'}; line-height:1.3; white-space:pre-wrap; word-break:break-all;">${this.highlightText(info.latestNotes, this.skillSearchQuery)}</div>
                                </td>
                                <td style="padding:8px 4px; text-align:center; vertical-align:middle; border-right:1px solid var(--border);">
                                    <button class="secondary-btn" style="padding:2px 4px; font-size:0.6rem; color:var(--text-light); border-radius:4px;" onclick="app.archiveSkillTask('${taskKey.replace(/'/g, "\\'")}', '${info.label} [${info.machine}]', ${!!info.isManual})">
                                        <i class="fa-solid fa-eye-slash"></i>
                                    </button>
                                </td>
                                ${workers.map(w => {
                                    const wInfo = workerTasks[w]?.[taskKey];
                                    const val = (skillEvals[w] || {})[taskKey] || (wInfo?.count > 0 ? '○' : '');
                                    return `
                                        <td style="padding:6px 1px; text-align:center; vertical-align:middle; transition:background.2s; border-right:1px solid #0000000a;">
                                            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; min-height:45px;">
                                                <div class="skill-toggle-group" style="${this.skillFitAll ? 'width:100%; max-width:105px; margin:0 auto; padding:2px;' : ''}">
                                                    <div class="skill-chip ${val==='○'?'active':''}" style="${this.skillFitAll ? 'flex:1; width:auto; max-width:32px; min-width:12px; aspect-ratio:1; height:auto; font-size:1.1rem; padding:0;' : ''}" data-val="○" onclick="app.saveSkillEval('${w}', '${taskKey.replace(/'/g,"\\'")}', '○')" title="単独可能">○</div>
                                                    <div class="skill-chip ${val==='△'?'active':''}" style="${this.skillFitAll ? 'flex:1; width:auto; max-width:32px; min-width:12px; aspect-ratio:1; height:auto; font-size:1.1rem; padding:0;' : ''}" data-val="△" onclick="app.saveSkillEval('${w}', '${taskKey.replace(/'/g,"\\'")}', '△')" title="要サポート">△</div>
                                                    <div class="skill-chip ${val==='✕'?'active':''}" style="${this.skillFitAll ? 'flex:1; width:auto; max-width:32px; min-width:12px; aspect-ratio:1; height:auto; font-size:1.1rem; padding:0;' : ''}" data-val="✕" onclick="app.saveSkillEval('${w}', '${taskKey.replace(/'/g,"\\'")}', '✕')" title="未習得">✕</div>
                                                </div>
                                                ${firstRespondersMap[taskKey]?.has(w) ? `<div style="font-size:${this.skillFitAll ? '0.45rem' : '0.55rem'}; color:#0369a1; font-weight:800; background:#e0f2fe; padding:${this.skillFitAll ? '0 1px' : '1px 4px'}; border-radius:2px; white-space:nowrap; border:1px solid #bae6fd; line-height:1; transform:${this.skillFitAll ? 'scale(0.9)' : 'none'};">初回対応者</div>` : ''}
                                            </div>
                                        </td>`;
                                }).join('')}
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML += `<div id="skill-stats-container" style="margin-top:40px;"></div>`;

        this._lastSkillData = { workers, allTaskEntries, skillEvals, workerTasks };
        this.renderSkillStats();
    }

    renderSkillStats() {
        const statsContainer = document.getElementById('skill-stats-drawer-content');
        if (!statsContainer) return;
        
        const { workers, allTaskEntries, skillEvals, workerTasks } = this._lastSkillData || {};
        if (!workers) return;

        const getEffectiveVal = (w, tk) => (skillEvals[w] || {})[tk] || (workerTasks[w]?.[tk]?.count > 0 ? '○' : '');

        const totalTasks = allTaskEntries.length;
        const coveredTasks = allTaskEntries.filter(([tk]) => workers.some(w => getEffectiveVal(w, tk) === '○')).length;
        const globalCoverage = totalTasks > 0 ? (coveredTasks / totalTasks * 100).toFixed(1) : 0;
        const riskTasks = allTaskEntries.filter(([tk]) => workers.filter(w => getEffectiveVal(w, tk) === '○').length === 0).length;
        const soloTasks = allTaskEntries.filter(([tk]) => workers.filter(w => getEffectiveVal(w, tk) === '○').length === 1).length;

        const covVal = parseFloat(globalCoverage);
        const covColor = covVal >= 70 ? '#16a34a' : (covVal >= 30 ? '#d97706' : '#dc2626');

        statsContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:24px;">
                <!-- Summary Card -->
                <div class="card" style="padding:24px; text-align:center; background:white; border:4px solid ${covColor}; box-shadow:var(--shadow-lg);">
                    <div style="font-size:0.9rem; font-weight:800; color:var(--text-light); margin-bottom:14px;">全体のスキルカバー率</div>
                    <div style="font-size:4.2rem; font-weight:900; color:${covColor}; line-height:1; letter-spacing:-2px;">${globalCoverage}<span style="font-size:1.8rem; margin-left:4px;">%</span></div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:24px;">
                        <div style="background:#fff1f2; color:#e11d48; padding:12px; border-radius:12px; border:1px solid #fecdd3;">
                            <div style="font-size:0.65rem; font-weight:800; text-transform:uppercase; margin-bottom:4px;">リスクスキル</div>
                            <div style="font-size:1.4rem; font-weight:950;">${riskTasks}<span style="font-size:0.7rem; margin-left:2px;">件</span></div>
                        </div>
                        <div style="background:#fff7ed; color:#ea580c; padding:12px; border-radius:12px; border:1px solid #ffedd5;">
                            <div style="font-size:0.65rem; font-weight:800; text-transform:uppercase; margin-bottom:4px;">属人化スキル</div>
                            <div style="font-size:1.4rem; font-weight:950;">${soloTasks}<span style="font-size:0.7rem; margin-left:2px;">件</span></div>
                        </div>
                    </div>
                    <div style="margin-top:20px; font-size:0.8rem; color:var(--text-light); font-weight:600;">
                        スキルマップ表示中の ${totalTasks} 項目中 <b>${coveredTasks}</b> 項目をカバー済
                    </div>
                </div>
            </div>
        `;
    }

    archiveSkillTask(taskKey, label, isManual = false) {
        if (isManual) {
            if (confirm(`手動登録したスキル「${label}」を完全に削除しますか？`)) {
                let manualSkills = JSON.parse(localStorage.getItem('manualSkills') || '[]');
                manualSkills = manualSkills.filter(ms => ms.id !== taskKey);
                localStorage.setItem('manualSkills', JSON.stringify(manualSkills));
                this.renderWorkers();
            }
        } else {
            if (confirm(`「${label}」をスキルマップから除外（非表示）しますか？\n（管理画面から復元することも可能です）`)) {
                store.toggleTaskArchive(taskKey);
                this.renderWorkers();
            }
        }
    }

    openAddManualSkillModal() {
        this.openModal('add-skill', 'スキルの強制追加', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="form-group">
                    <label>スキル名・内容（紫文字で表示）</label>
                    <input type="text" id="ms-label" placeholder="例: フォークリフト免許、安全管理者研修">
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                    <div class="form-group">
                        <label>対象機械名（任意）</label>
                        <input type="text" id="ms-machine" placeholder="例: Aコンベア、共通">
                    </div>
                    <div class="form-group">
                        <label>装置区分 (例: 包装機, 充填機)</label>
                        <select id="ms-machine-category" onchange="app.toggleNewCategoryField('ms-')">
                            <option value="">-- 指定なし --</option>
                            ${this.getMachineCategoryOptions()}
                        </select>
                        <input type="text" id="ms-new-category-input" placeholder="新しい装置区分名を入力" style="display:none; margin-top:8px; border:2px solid var(--primary); padding:8px;" onblur="this.value = MaintenanceApp.toFullWidthUpper(this.value)">
                    </div>
                    <div class="form-group">
                        <label>型式（任意）</label>
                        <input type="text" id="ms-model" placeholder="例: M-101">
                    </div>
                    <div class="form-group">
                        <label>ライン番号</label>
                        <select id="ms-line-no">
                            <option value="">-- 指定なし --</option>
                            ${this.generateLineOptionsHTML()}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>作業区分</label>
                    <select id="ms-category">
                        <option value="other">その他</option>
                        <option value="machine">機械修理</option>
                        <option value="electric">電気系</option>
                        <option value="adjust">調整</option>
                        <option value="parts">部品交換</option>
                        <option value="clean">清掃・給油</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>処置内容・補足（紫文字で表示）</label>
                    <textarea id="ms-notes" rows="4" placeholder="スキルの詳細な定義や取得条件など"></textarea>
                </div>
            `;
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `
                    <button class="secondary-btn" onclick="app.closeModal()">キャンセル</button>
                    <button class="primary-btn" onclick="app.saveManualSkill()">強制登録する</button>
                `;
            }
        });
    }

    saveManualSkill() {
        const label = document.getElementById('ms-label').value.trim();
        const machine = document.getElementById('ms-machine').value.trim() || '共通';
        const model = document.getElementById('ms-model').value.trim() || '-';
        const lineNo = document.getElementById('ms-line-no').value;
        const category = document.getElementById('ms-category').value;
        const machineCategory = this.getCategoryFromModalInput('ms-');
        const notes = document.getElementById('ms-notes').value.trim();

        if (!label) return alert('スキル名を入力してください');

        let manualSkills = JSON.parse(localStorage.getItem('manualSkills') || '[]');
        manualSkills.push({
            id: 'm_' + Date.now(),
            label,
            machine,
            model,
            machineCategory,
            lineNo,
            notes,
            category,
            isManual: true
        });

        localStorage.setItem('manualSkills', JSON.stringify(manualSkills));
        this.closeModal();
        this.renderWorkers();
    }

    saveSkillEval(worker, taskKey, val) {
        const SKILL_KEY = 'skillEvaluations';
        let evals = {};
        try { evals = JSON.parse(localStorage.getItem(SKILL_KEY) || '{}'); } catch(e) {}
        if (!evals[worker]) evals[worker] = {};
        
        // Toggle logic
        if (evals[worker][taskKey] === val) {
            delete evals[worker][taskKey];
        } else {
            evals[worker][taskKey] = val;
        }
        
        localStorage.setItem(SKILL_KEY, JSON.stringify(evals));
        this.renderWorkers();
    }

    setSkillSortMode(mode) {
        this.skillSortMode = mode;
        this.renderWorkers();
    }

    toggleSkillModelFilter(model) {
        if (!model) return;
        if (this.skillModelFilter === model) {
            this.skillModelFilter = null;
        } else {
            this.skillModelFilter = model;
        }
        this.renderWorkers();
    }

    openWorkerRadarModal(workerName) {
        this.openModal('worker-radar', `${workerName} さんのスキル特性分析`, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div style="text-align:center; padding:20px;">
                    <div style="width:100%; max-width:460px; margin:0 auto; height:400px; background:#fff; padding:15px; border-radius:16px; border:1px solid #e2e8h0; box-shadow:var(--shadow-sm);">
                        <canvas id="worker-radar-chart"></canvas>
                    </div>
                    <div id="worker-radar-score-list" class="worker-radar-score-list"></div>
                    <div id="worker-radar-breakdown" class="worker-radar-breakdown"></div>
                    <div style="margin-top:24px; font-size:0.85rem; color:var(--text-light); text-align:left; background:#eff6ff; padding:18px; border-radius:12px; border:1px solid #bae6fd;">
                        <p style="font-weight:900; color:var(--primary); margin-bottom:10px; font-size:0.9rem;"><i class="fa-solid fa-circle-info"></i> レーダーチャートの見方</p>
                        各項目のスコアは、その分野（作業区分）の全タスク数に対して、作業員がどれだけ習熟しているかを数値化したものです。<br>
                        <ul style="margin-top:8px; padding-left:20px;">
                            <li><b>○ (単独可能)</b> … 1.0点</li>
                            <li><b>△ (サポート要)</b> … 0.5点</li>
                        </ul>
                        グラフの頂点が外側に近いほど、その分野における専門知識や経験が豊富であることを示しています。
                    </div>
                </div>
            `;
            setTimeout(() => this.renderWorkerRadarChart('worker-radar-chart', workerName), 100);
        });
    }

    renderWorkerRadarChart(canvasId, workerName) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const { workers, allTaskEntries, skillEvals, workerTasks } = this._lastSkillData || {};
        if (!allTaskEntries) return;

        const catLabels = { 
            machine: '機械修理', 
            electric: '電気系修理', 
            adjust: '調整・設定', 
            parts: '部品交換', 
            clean: '清掃・給油', 
            other: 'その他' 
        };
        const categories = Object.keys(catLabels);
        
        const getEffectiveVal = (targetWorker, taskKey) => {
            const manual = (skillEvals[targetWorker] || {})[taskKey];
            if (manual) return manual;
            return workerTasks?.[targetWorker]?.[taskKey]?.count > 0 ? '○' : '';
        };
        const getPoint = (val) => {
            if (val === '○') return 1.0;
            if (val === '△') return 0.5;
            return 0;
        };
        const getScoreForWorker = (targetWorker, catTasks) => {
            if (!catTasks.length) return { score: 0, points: 0 };
            const points = catTasks.reduce((sum, [tk]) => sum + getPoint(getEffectiveVal(targetWorker, tk)), 0);
            return { score: Math.round((points / catTasks.length) * 100), points };
        };

        const scoreRows = categories.map(cat => {
            const catTasks = allTaskEntries.filter(([tk, info]) => info.category === cat);
            if (catTasks.length === 0) return { cat, score: 0, points: 0, total: 0 };
            const result = getScoreForWorker(workerName, catTasks);
            return { cat, score: result.score, points: result.points, total: catTasks.length };
        });
        const scores = scoreRows.map(row => row.score);
        const teamScores = categories.map(cat => {
            const catTasks = allTaskEntries.filter(([tk, info]) => info.category === cat);
            if (!catTasks.length || !workers?.length) return 0;
            const totalScore = workers.reduce((sum, worker) => sum + getScoreForWorker(worker, catTasks).score, 0);
            return Math.round(totalScore / workers.length);
        });
        const scoreList = document.getElementById('worker-radar-score-list');
        if (scoreList) {
            scoreList.innerHTML = scoreRows.map(row => `
                <div class="${row.total > 0 && row.total < 3 ? 'low-data' : ''}">
                    <span>${catLabels[row.cat]}</span>
                    <b>${row.score}%</b>
                    <small>${row.points}/${row.total}${row.total > 0 && row.total < 3 ? ' / データ少' : ''}</small>
                </div>
            `).join('');
        }
        const breakdown = document.getElementById('worker-radar-breakdown');
        if (breakdown) {
            breakdown.innerHTML = categories.map(cat => {
                const catTasks = allTaskEntries.filter(([tk, info]) => info.category === cat);
                if (!catTasks.length) return '';
                const rows = catTasks.map(([tk, info]) => {
                    const val = getEffectiveVal(workerName, tk);
                    const manual = (skillEvals[workerName] || {})[tk];
                    const source = manual ? '手入力' : (workerTasks?.[workerName]?.[tk]?.count > 0 ? '履歴経験' : '未記録');
                    const label = info.label || tk.split('__')[0] || 'タスク';
                    return `
                        <li class="${val === '○' ? 'ok' : (val === '△' ? 'support' : 'none')}">
                            <b>${val || '未'}</b>
                            <span>${this.escapeHtml(label)}</span>
                            <em>${source}</em>
                        </li>
                    `;
                }).join('');
                return `
                    <details>
                        <summary>
                            <span>${catLabels[cat]}</span>
                            <b>${scoreRows.find(row => row.cat === cat)?.score || 0}%</b>
                        </summary>
                        <ul>${rows}</ul>
                    </details>
                `;
            }).join('');
        }

        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: categories.map(c => catLabels[c]),
                datasets: [
                    {
                        label: `${workerName} さん`,
                        data: scores,
                        backgroundColor: 'rgba(37, 99, 235, 0.15)',
                        borderColor: 'rgb(37, 99, 235)',
                        borderWidth: 3,
                        pointBackgroundColor: 'rgb(37, 99, 235)',
                        pointBorderColor: '#fff',
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'チーム平均',
                        data: teamScores,
                        backgroundColor: 'rgba(100, 116, 139, 0.06)',
                        borderColor: 'rgba(100, 116, 139, 0.75)',
                        borderWidth: 2,
                        borderDash: [6, 4],
                        pointBackgroundColor: 'rgba(100, 116, 139, 0.85)',
                        pointBorderColor: '#fff',
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: '#e2e8f0' },
                        grid: { color: '#e2e8f0' },
                        min: 0,
                        max: 100,
                        ticks: { stepSize: 20, font: { size: 10, weight: '700' }, backdropColor: 'rgba(255,255,255,0.8)', color: '#475569' },
                        pointLabels: { font: { size: 12, weight: '900' }, color: '#475569' }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 14, font: { size: 11, weight: '700' } } }
                }
            }
        });
    }

    toggleSkillFit() {
        this.skillFitAll = !this.skillFitAll;
        const btn = document.getElementById('btn-skill-fit');
        if (btn) {
            btn.classList.toggle('active', this.skillFitAll);
            btn.innerHTML = this.skillFitAll ? '<i class="fa-solid fa-arrows-left-right"></i> スクロールに戻す' : '<i class="fa-solid fa-arrows-left-right-to-line"></i> 全員表示';
        }
        this.renderWorkers();
    }

    renderSkillTrendGraph(selectedWorker = null) {
        const { workers, allTaskEntries, skillEvals } = this._lastSkillData || {};
        if (!workers || !allTaskEntries || !skillEvals) return;

        const history = store.getHistory();
        
        // Find the earliest global history date as the "start of system"
        let globalMinDate = null;
        if (history.length > 0) {
            const minStr = history.reduce((min, h) => (!min || h.date < min) ? h.date : min, "");
            globalMinDate = new Date(minStr);
            if (isNaN(globalMinDate.getTime())) globalMinDate = null;
        }

        const months = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(d);
        }

        const dataPoints = months.map(monthDate => {
            const year = monthDate.getFullYear();
            const month = monthDate.getMonth();
            const lastDay = new Date(year, month + 1, 0); 
            const monthEndStr = lastDay.toISOString().split('T')[0];

            const count = allTaskEntries.filter(([taskKey, info]) => {
                // 1. Check history (Historical growth)
                const hasMatchHistory = history.some(h => {
                    const hTaskKey = `${h.machineId}__${h.taskId ? (store.activeData.tasks.find(t=>t.id===h.taskId)?.content || h.taskContent || '定期メンテナンス') : (h.errorContent || h.notes || '突発対応')}`;
                    if (hTaskKey !== taskKey || h.date > monthEndStr) return false;
                    if (selectedWorker) return (h.workers || []).includes(selectedWorker);
                    return (h.workers || []).length > 0;
                });
                if (hasMatchHistory) return true;

                // 2. Check Static Evaluation (Self-evaluations or manual skills)
                // We should only count these IF the month is >= system start OR skill creation
                if (globalMinDate && lastDay < globalMinDate) {
                    return false; // Skip if before system usage started
                }

                if (info.isManual) {
                    const timestampStr = taskKey.split('_')[1];
                    const createdAt = timestampStr ? new Date(parseInt(timestampStr)) : null;
                    if (!createdAt || isNaN(createdAt.getTime()) || createdAt > lastDay) {
                        return false; 
                    }
                }

                if (selectedWorker) {
                    return (skillEvals[selectedWorker] || {})[taskKey] === '○';
                } else {
                    return workers.some(w => (skillEvals[w] || {})[taskKey] === '○');
                }
            }).length;

            const rate = allTaskEntries.length > 0 ? (count / allTaskEntries.length * 100).toFixed(1) : 0;
            return { label: `${month + 1}月`, value: parseFloat(rate) };
        });

        this.openModal('skill-trend', `スキル習得の成長推移 (${selectedWorker || 'チーム全体'})`, () => {
            const content = document.getElementById('modal-content');
            
            const workerBtns = [null, ...workers].map(w => {
                const label = w || 'チーム全体';
                const isActive = selectedWorker === w;
                const style = isActive 
                    ? 'background:var(--primary); color:white; border-color:var(--primary);' 
                    : 'background:white; color:var(--text-main); border-color:var(--border);';
                return `<button class="secondary-btn" style="padding:4px 12px; font-size:0.75rem; border-radius:99px; ${style}" 
                        onclick="app.renderSkillTrendGraph(${w ? `'${w.replace(/'/g,"\\'")}'` : 'null'})">${label}</button>`;
            }).join('');

            content.innerHTML = `
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--border);">
                    <div style="font-size:0.75rem; font-weight:900; color:var(--text-light); width:100%; margin-bottom:8px;">分析対象の切り替え:</div>
                    ${workerBtns}
                </div>
                <div style="background:var(--primary-light); color:var(--primary); padding:10px; border-radius:8px; margin-bottom:20px; font-size:0.75rem; font-weight:700; line-height:1.4;">
                    <i class="fa-solid fa-circle-info"></i> ${(selectedWorker ? `<b>${selectedWorker}</b> さんが` : 'チーム全体で')} 過去に実施経験のある項目の割合（経験ベースの習熟率）を表示しています。
                </div>
                <div style="height:350px; width:100%;">
                    <canvas id="skillTrendChart"></canvas>
                </div>
            `;

            const ctx = document.getElementById('skillTrendChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dataPoints.map(d => d.label),
                    datasets: [{
                        label: '習熟率 / カバー率 (%)',
                        data: dataPoints.map(d => d.value),
                        borderColor: selectedWorker ? '#7c3aed' : '#2563eb',
                        backgroundColor: selectedWorker ? 'rgba(124, 58, 237, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                        borderWidth: 3,
                        pointRadius: 5,
                        pointBackgroundColor: selectedWorker ? '#7c3aed' : '#2563eb',
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            align: 'top',
                            formatter: (v) => v + '%',
                            font: { weight: 'bold', size: 11 }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { callback: (v) => v + '%' }
                        }
                    }
                }
            });

            const footer = document.querySelector('.modal-footer');
            if (footer) footer.innerHTML = `<button class="secondary-btn" onclick="app.closeModal()">閉じる</button>`;
        });
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppSkillMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppSkillMethods.prototype[name];
        }
    }
})();
