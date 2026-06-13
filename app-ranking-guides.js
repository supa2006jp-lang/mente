(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppRankingGuideMethods extends MaintenanceApp {
    // --- Phase 4: Ranking ---
    renderRanking() {
        const container = document.getElementById('ranking-container');
        if (!container) return;
        container.style.cssText = 'display:block; width:100%;';

        const period = document.getElementById('ranking-filter-period')?.value || 'this_month';
        const lineFilter = document.getElementById('ranking-filter-line')?.value || 'all';
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


        const machineMap = {};
        const catMap = {};
        const causeWords = {};

        history.forEach(h => {
            if (h.isManualGuide) return; // 統計からは除外
            const m = machines.find(x => x.id === h.machineId);
            if (!m) return;
            const key = m.id;
            if (!machineMap[key]) machineMap[key] = { id: m.id, name: m.name, model: m.model, lineNo: m.lineNo, count: 0, dokatei: 0, time: 0, cost: 0 };
            if (!h.taskId || h.isDokatei) {
                machineMap[key].count++;
                if (h.isDokatei) machineMap[key].dokatei++;
                machineMap[key].time += (parseInt(h.workTime) || 0);
            }
            const partCost = (h.replacedParts || []).reduce((sum, p) => sum + ((parseFloat(p.count)||0) * (parseFloat(p.price)||0)), 0);
            machineMap[key].cost += partCost;
            const cat = h.category || 'other';
            catMap[cat] = (catMap[cat] || 0) + 1;
            if (h.cause) {
                h.cause.split(/[\s、。・,]+/).filter(w => w.length >= 2).forEach(w => {
                    causeWords[w] = (causeWords[w] || 0) + 1;
                });
            }
        });

        const listByCount = Object.values(machineMap).filter(m => m.count > 0).sort((a,b) => b.count - a.count);
        const listByTime  = Object.values(machineMap).filter(m => m.time > 0).sort((a,b) => b.time - a.time);
        
        const catLabels = { machine: '機械修理', electric: '電気系', adjust: '調整', parts: '部品交換', clean: '清掃・給油', other: 'その他' };
        const catColors  = { machine: '#3b82f6', electric: '#f59e0b', adjust: '#10b981', parts: '#8b5cf6', clean: '#06b6d4', other: '#94a3b8' };
        const topCauses = Object.entries(causeWords).sort((a,b) => b[1]-a[1]).slice(0, 10);

        container.innerHTML = `
            <div style="margin-bottom:24px; display:flex; justify-content:space-between; align-items:center;">
                <div style="background:linear-gradient(135deg, var(--primary), var(--primary-dark)); color:#fff; padding:8px 20px; border-radius:30px; font-size:0.85rem; font-weight:800; box-shadow:0 4px 15px rgba(37,99,235,0.2);">
                    <i class="fa-solid fa-calendar-check" style="margin-right:8px;"></i>
                    集計期間: ${this.getPeriodLabel(period)} (${history.length}件の記録)
                </div>
                <button class="secondary-btn" style="padding:8px 16px; font-weight:800;" onclick="app.openTroubleComparisonModal()">
                    <i class="fa-solid fa-magnifying-glass-chart"></i> 前月との比較分析
                </button>
            </div>

            <div class="ranking-visual-grid">
                <!-- Visual Bar Chart -->
                <div class="ranking-chart-card">
                    <div style="font-size:1rem; font-weight:900; margin-bottom:20px; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-chart-bar" style="color:var(--primary);"></i> 故障頻度グラフ (Worst 10)
                    </div>
                    <div class="ranking-chart-container">
                        <canvas id="ranking-freq-chart"></canvas>
                    </div>
                </div>

                <!-- Cause Keywords -->
                <div class="card" style="padding:24px;">
                    <div style="font-size:1rem; font-weight:900; margin-bottom:16px; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-key" style="color:var(--secondary);"></i> 頻出原因キーワード
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:10px;">
                        ${topCauses.map(([w, cnt], i) => `
                            <div style="padding:8px 16px; background:${i<3?'var(--secondary-light)':'var(--background)'}; border-radius:12px; border:1.5px solid ${i<3?'var(--secondary)':'var(--border)'}; font-size:${i<3?'1rem':'0.8rem'}; font-weight:800; color:${i<3?'var(--secondary)':'var(--text-main)'};">
                                ${w} <span style="font-size:0.7em; opacity:0.7;">${cnt}</span>
                            </div>
                        `).join('') || '<div style="color:var(--text-light); padding:20px;">なし</div>'}
                    </div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px;">
                <!-- Frequency List -->
                <div class="card" style="padding:24px;">
                    <div style="font-size:1rem; font-weight:900; margin-bottom:16px; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-fire-flame-curved" style="color:var(--danger);"></i> 故障回数ワースト
                    </div>
                    ${listByCount.length === 0 ? '<div style="color:var(--text-light); text-align:center; padding:40px;">データなし</div>' : listByCount.slice(0, 5).map((m, i) => `
                        <div class="hover-shadow" style="display:flex; align-items:center; gap:12px; padding:12px; background:${i===0?'#fff1f2':'var(--background)'}; border-radius:16px; margin-bottom:10px; border:${i===0?'2px solid #fecaca':'1px solid var(--border)'};" onclick="app.switchView('history'); document.getElementById('hist-filter-machine').value='${m.id}'; app.renderHistory();">
                            <div style="font-size:1.8rem; width:40px; text-align:center;">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
                            <div style="flex:1;">
                                <div style="font-weight:900;">${this.getLineBadge(m.lineNo)}${m.name}</div>
                                <div style="font-size:0.75rem; color:var(--text-light);">${MaintenanceApp.toHalfWidthLower(m.model)}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:1.6rem; font-weight:950; color:var(--danger);">${m.count}<span style="font-size:0.8rem;">件</span></div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Category Chart -->
                <div class="card" style="padding:24px;">
                    <div style="font-size:1rem; font-weight:900; margin-bottom:20px; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-chart-pie" style="color:var(--primary);"></i> 故障箇所の内訳
                    </div>
                            <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:20px; align-items:center;">
                        <div style="width:140px; height:140px; justify-self:center;">
                            <canvas id="ranking-cat-pie"></canvas>
                        </div>
                        <div style="font-size:0.8rem;">
                        ${Object.entries(catMap).sort((a,b)=>b[1]-a[1]).map(([cat, cnt]) => `
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                                <span><i class="fa-solid fa-circle" style="color:${catColors[cat]}; font-size:0.6rem;"></i> ${catLabels[cat]||cat}</span>
                                <b>${cnt}件</b>
                            </div>
                        `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            const freqCtx = document.getElementById('ranking-freq-chart');
            if (freqCtx && listByCount.length > 0) {
                new Chart(freqCtx, {
                    type: 'bar',
                    data: {
                        labels: listByCount.slice(0, 10).map(m => `${m.name} [${MaintenanceApp.toHalfWidthLower(m.model || '')}]`),
                        datasets: [{
                            label: '故障回数',
                            data: listByCount.slice(0, 10).map(m => m.count),
                            backgroundColor: listByCount.slice(0, 10).map((m, i) => i === 0 ? '#ef4444' : '#60a5fa'),
                            borderRadius: 6
                        }]
                    },
                    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
            }
            const catCtx = document.getElementById('ranking-cat-pie');
            if (catCtx) {
                const sortedCats = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
                new Chart(catCtx, {
                    type: 'doughnut',
                    data: {
                        labels: sortedCats.map(([c]) => catLabels[c] || c),
                        datasets: [{ data: sortedCats.map(([,n]) => n), backgroundColor: sortedCats.map(([c]) => catColors[c] || '#94a3b8') }]
                    },
                    options: { cutout: '70%', plugins: { legend: { display: false } } }
                });
            }
        }, 100);
    }
    
    updateRelatedGuides(machineId) {
        const list = document.getElementById('s-related-guides-list');
        const section = document.getElementById('s-related-guides-section');
        if (!list || !section) return;

        if (!machineId || machineId === 'NEW_MACHINE') {
            section.style.display = 'none';
            return;
        }

        const machine = store.getMachines(true).find(m => m.id === machineId);
        const normModel = MaintenanceApp.toHalfWidthLower(machine?.model || '');

        // Search for relevant guides (Same machine or same model or same keywords)
        const relevantHistory = store.activeData.history.filter(h => {
            if (!h.guide || store.isGuideArchived(h.id)) return false;
            if (h.machineId === machineId) return true;
            const m = store.getMachines(true).find(mm => mm.id === h.machineId);
            return MaintenanceApp.toHalfWidthLower(m?.model || '') === normModel;
        });

        if (relevantHistory.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        list.innerHTML = relevantHistory.map(h => `
            <div class="guide-search-result" onclick="app.openGuideModal('${h.id}')">
                <div style="font-size:0.8rem; font-weight:800; color:var(--primary); margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:4px;">
                        ${this.getLineBadge(h.lineNo || machine?.lineNo)}
                        <span>${this.getGuideDisplayTitle(h)}</span>
                    </div>
                    <span style="font-size:0.65rem; color:var(--text-light); font-weight:400;"><i class="fa-solid fa-clock-rotate-left"></i> ${h.date}</span>
                </div>
                <div style="font-size:0.75rem; color:var(--text-light); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                    ${h.guide.text}
                </div>
                <div style="display:flex; gap:4px; margin-top:6px;">
                    ${(h.guide.tags || []).map(t => `<span class="tag-badge"><i class="fa-solid fa-tag"></i> ${t}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }

    getGuideDisplayTitle(history, guideOverride = null) {
        const guide = guideOverride || history?.guide || {};
        const title = String(guide.title || '').trim();
        return title || this.getHistoryDisplayText(history) || history?.errorContent || history?.notes || '手順書';
    }

    getGuideTitleCandidates(history, machineOverride = null) {
        const machine = machineOverride || store.getMachines(true).find(m => String(m.id) === String(history?.machineId));
        const compact = (value, max = 22) => String(value || '')
            .replace(/\(.*?\)/g, ' ')
            .replace(/[【】\[\]（）]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, max);
        const baseTitle = compact(this.getHistoryDisplayText(history), 28);
        const cause = compact(history?.cause, 24);
        const notes = compact(history?.notes, 24);
        const machineName = compact(machine?.name, 18);
        const source = `${baseTitle} ${cause} ${notes}`;
        let suffix = '対応手順';
        if (/交換|取替|取り替/.test(source)) suffix = '交換手順';
        else if (/清掃|掃除|洗浄/.test(source)) suffix = '清掃手順';
        else if (/調整|芯出|位置/.test(source)) suffix = '調整手順';
        else if (/復旧|リセット|再起動|解除/.test(source)) suffix = '復旧手順';
        else if (/点検|確認|測定/.test(source)) suffix = '点検手順';

        const subject = baseTitle || cause || notes || machineName || '作業';
        const raw = [
            `${subject}${/(手順|方法|対応|復旧|交換|調整|点検)$/.test(subject) ? '' : suffix}`,
            machineName && subject ? `${machineName} ${subject}` : '',
            cause ? `${cause}の対処手順` : '',
            notes ? `${notes}手順` : '',
            machineName ? `${machineName} ${suffix}` : ''
        ];
        const seen = new Set();
        return raw
            .map(item => item.replace(/\s+/g, ' ').trim())
            .filter(item => item && !seen.has(item) && seen.add(item))
            .slice(0, 5);
    }

    setGuideTitle(hId, title, options = {}) {
        const history = store.activeData.history || [];
        const item = history.find(h => String(h.id) === String(hId));
        if (!item) return false;
        if (!item.guide) item.guide = { text: '', author: '', photos: [] };
        item.guide.title = String(title || '').trim();
        item.guide.updatedAt = new Date().toLocaleString();
        item.guide.changeNote = options.changeNote || 'タイトル更新';
        store.save();
        const titleInput = document.getElementById('g-title');
        if (titleInput && document.getElementById('g-h-id')?.value === String(hId)) {
            titleInput.value = item.guide.title || this.getGuideDisplayTitle(item);
        }
        this.renderGuides?.();
        this.renderHistory?.();
        return true;
    }

    editGuideTitleFromCard(hId, event) {
        event?.stopPropagation?.();
        const item = (store.activeData.history || []).find(h => String(h.id) === String(hId));
        if (!item) return;
        const current = this.getGuideDisplayTitle(item);
        const next = prompt('手順書タイトルを入力してください。', current);
        if (next === null) return;
        this.setGuideTitle(hId, next, { changeNote: 'カード上でタイトル更新' });
    }

    chooseGuideTitleCandidate(hId, event) {
        event?.stopPropagation?.();
        const item = (store.activeData.history || []).find(h => String(h.id) === String(hId));
        if (!item) return;
        const machine = item.machineId === 'COMMON'
            ? { name: '全般・共通', model: '-', category: item.guideCategory || '共通知識' }
            : store.getMachines(true).find(m => String(m.id) === String(item.machineId));
        const candidates = this.getGuideTitleCandidates(item, machine);
        if (!candidates.length) return alert('タイトル候補を作れませんでした。原因・処置・内容を入力すると候補が出しやすくなります。');
        const message = `使うタイトル候補の番号を入力してください。\n\n${candidates.map((title, index) => `${index + 1}. ${title}`).join('\n')}`;
        const answer = prompt(message, '1');
        if (answer === null) return;
        const index = Number(answer.trim()) - 1;
        const title = candidates[index] || answer.trim();
        if (!title) return;
        this.setGuideTitle(hId, title, { changeNote: 'タイトル候補を適用' });
    }

    applyGuideTitleCandidate(title) {
        const input = document.getElementById('g-title');
        if (!input) return;
        input.value = String(title || '').trim();
        this.autoSaveGuideDraftFromModal?.();
    }

    renderGuides() {
        const container = document.getElementById('guides-container');
        const tagCloud = document.getElementById('guides-tag-cloud');
        if (!container || !tagCloud) return;

        const query = (document.getElementById('global-search')?.value || '').toLowerCase().trim();
        const normQuery = query ? MaintenanceStore.toHalfWidthLower(query) : null;

        const historyWithGuide = store.activeData.history.filter(h => !!h.guide && !store.isGuideArchived(h.id));
        const machines = store.getMachines(true);

        // --- ラインフィルタ選択肢の動的生成 ---
        const guideLineEl = document.getElementById('guides-filter-line');
        if (guideLineEl && guideLineEl.options.length <= 1) {
            const lineSet = new Set();
            historyWithGuide.forEach(h => {
                const m = machines.find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                if (l) lineSet.add(l);
            });
            Array.from(lineSet).sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric:true})).forEach(l => {
                const opt = document.createElement('option');
                opt.value = l;
                opt.textContent = this.getLineLabel(l);
                guideLineEl.appendChild(opt);
            });
            // --- 共通手順専用フィルタの追加 ---
            const optCommon = document.createElement('option');
            optCommon.value = 'COMMON_ONLY';
            optCommon.textContent = '★ 共通手順のみ';
            optCommon.style.fontWeight = '800';
            optCommon.style.color = 'var(--primary)';
            guideLineEl.appendChild(optCommon);
        }
        
        // --- Forced Registration Button ---
        let toolbar = guideLineEl?.closest('.filter-bar') || guideLineEl?.parentElement;
        if (!toolbar) {
            // Fallback: search for any toolbar-like container in the active view
            const notebookBtn = document.getElementById('notebook-search-btn');
            toolbar = notebookBtn?.closest('.view-toolbar') || notebookBtn?.closest('.filter-bar') || notebookBtn?.parentElement;
        }
        
        // Final fallback: try to find the header itself
        if (!toolbar) {
            toolbar = document.querySelector('.view-header') || document.querySelector('.view-toolbar');
        }

        if (toolbar && !document.getElementById('btn-manual-guide')) {
            const btn = document.createElement('button');
            btn.id = 'btn-manual-guide';
            btn.className = 'primary-btn';
            btn.style.padding = '8px 18px';
            btn.style.fontSize = '0.9rem';
            btn.style.borderRadius = '10px';
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            btn.style.borderColor = '#059669';
            btn.style.color = 'white';
            btn.style.fontWeight = '900';
            btn.style.display = 'inline-flex';
            btn.style.alignItems = 'center';
            btn.style.gap = '8px';
            btn.style.boxShadow = '0 4px 10px rgba(16, 185, 129, 0.25)';
            btn.style.transition = 'all 0.2s ease';
            btn.style.marginLeft = '12px';
            btn.innerHTML = '<i class="fa-solid fa-plus-circle" style="font-size:1.1rem;"></i> 強制登録';
            btn.onclick = () => this.openManualGuideRegistration();
            
            // Mouse hover effects
            btn.onmouseenter = () => { btn.style.transform = 'translateY(-1px)'; btn.style.boxShadow = '0 6px 15px rgba(16, 185, 129, 0.35)'; };
            btn.onmouseleave = () => { btn.style.transform = 'none'; btn.style.boxShadow = '0 4px 10px rgba(16, 185, 129, 0.25)'; };

            // Find a good place to insert (ideally at the end or near other primary actions)
            toolbar.appendChild(btn);
        }

        const guideLineVal = guideLineEl?.value || 'all';

        // 1. Generate Tags
        const tagFrequency = {};
        historyWithGuide.forEach(h => {
            (h.guide.tags || []).forEach(t => {
                tagFrequency[t] = (tagFrequency[t] || 0) + 1;
            });
        });
        let sortedTags = Object.entries(tagFrequency).sort((a,b) => b[1] - a[1]);
        if (normQuery) {
            const terms = normQuery.split(/[\s　]+/).filter(Boolean);
            sortedTags = sortedTags.filter(([tag]) => {
                const nt = MaintenanceStore.toHalfWidthLower(tag);
                return terms.every(t => nt.includes(t));
            });
        }

        tagCloud.innerHTML = `
            <button class="tag-badge ${!this.guideTagFilter ? 'active' : ''}" onclick="app.guideTagFilter=null; app.renderGuides()">全て</button>
            ${sortedTags.map(([tag, count]) => `
                <button class="tag-badge ${this.guideTagFilter === tag ? 'active' : ''}" onclick="app.guideTagFilter='${tag.replace(/'/g, "\\'")}'; app.renderGuides()">
                    ${tag} <span style="opacity:0.6; margin-left:2px; font-weight:400;">(${count})</span>
                </button>
            `).join('')}
        `;

        // 2. Filter Guides
        const filteredResult = historyWithGuide.filter(h => {
            // Line Filter
            if (guideLineVal === 'COMMON_ONLY') {
                if (h.machineId !== 'COMMON') return false;
            } else if (guideLineVal !== 'all') {
                const m = machines.find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                if (String(l) !== String(guideLineVal)) return false;
            }

            // Tag Filter
            if (this.guideTagFilter && !(h.guide.tags || []).includes(this.guideTagFilter)) return false;

            // Search Filter
            if (normQuery) {
                const terms = normQuery.split(/[\s　]+/).filter(Boolean);
                const machine = machines.find(m => m.id === h.machineId);
                const title = this.getGuideDisplayTitle(h);
                const searchStr = `${title} ${h.guide.text} ${h.guide.tags.join(' ')} ${machine?.name || ''} ${machine?.model || ''} ${h.cause || ''} ${h.notes || ''}`.toLowerCase();
                const normSearch = MaintenanceStore.toHalfWidthLower(searchStr);
                return terms.every(t => normSearch.includes(t));
            }
            return true;
        });

        // 3. Render
        if (filteredResult.length === 0) {
            container.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:80px 20px; color:var(--text-light); background:rgba(0,0,0,0.02); border-radius:12px; border:2px dashed var(--border); margin:20px 0;">
                    <i class="fa-solid fa-book-open" style="font-size:3rem; opacity:0.2; margin-bottom:15px; display:block;"></i>
                    <div style="font-size:1.1rem; font-weight:800; margin-bottom:8px;">表示できる手順書がありません</div>
                    <div style="font-size:0.85rem; opacity:0.8;">検索条件を変えるか、右上の「強制登録」から新規作成してください。</div>
                </div>
            `;
            this.updateContextualHelp?.('guides');
            return;
        }

        container.innerHTML = filteredResult.map(h => {
            const isCommon = h.machineId === 'COMMON';
            const machine = isCommon ? { name: '全般・共通', model: '-', category: h.guideCategory || '共通知識' } : store.getMachines(true).find(m => m.id === h.machineId);
            const title = this.getGuideDisplayTitle(h);
            const machinePhoto = machine?.photo;
            const guidePhoto = Array.isArray(h.guide?.photos) ? this.normalizeGuidePhoto?.(h.guide.photos[0])?.src : '';
            const representativePhoto = guidePhoto || machinePhoto;
            const manualGuideBadge = h.isManualGuide ? '<span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:1px 6px; border-radius:3px; font-weight:900; font-size:0.65rem;"><i class="fa-solid fa-file-circle-plus"></i> 単独登録</span>' : '';
            const titleCandidates = this.getGuideTitleCandidates(h, machine);
            
            // 共通手順用のスタイル
            const cardStyle = isCommon 
                ? 'display:flex; flex-direction:column; border: 2px solid var(--primary-light); background: linear-gradient(to bottom, #f0f9ff, #ffffff); box-shadow: 0 4px 12px rgba(37,99,235,0.08);' 
                : 'display:flex; flex-direction:column;';

            return `
                <div class="card" style="${cardStyle}">
                    <div style="padding:0px;">
                        <div style="display:flex; gap:12px; margin-bottom:12px; align-items:flex-start;">
                            ${representativePhoto ? `<div class="img-box" style="width:70px; height:70px; border-radius:8px; flex-shrink:0;"><img src="${representativePhoto}"></div>` : 
                             `<div class="img-box" style="width:70px; height:70px; border-radius:8px; flex-shrink:0;"><button type="button" class="machine-photo-placeholder guide" onclick="app.openGuidePhotoChoice('${this.escapeJs(h.id)}', event)" title="画像を選択"><i class="fa-solid ${isCommon ? 'fa-lightbulb' : 'fa-industry'}"></i></button></div>`}
                            <div style="flex:1; min-width:0;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                    <span style="font-size:0.65rem; color:var(--text-light); border:1px solid #cbd5e1; padding:2px 6px; border-radius:4px; font-weight:700; background:white;">${h.date}</span>
                                    <span style="font-size:0.65rem; color:var(--primary); font-weight:900;">by ${h.guide.author || '不明'}</span>
                                </div>
                                <div style="display:flex; align-items:flex-start; gap:6px; margin-bottom:2px;">
                                    <h4 style="border:none; padding:0; margin:0; font-size:1rem; cursor:pointer; line-height:1.3; flex:1; min-width:0;" onclick="app.openGuideModal('${this.escapeJs(h.id)}')" title="${this.escapeHtml(title)}">${this.highlightText(title, query)}</h4>
                                    <button type="button" class="secondary-btn" style="padding:3px 6px; font-size:0.7rem; flex-shrink:0;" onclick="app.editGuideTitleFromCard('${this.escapeJs(h.id)}', event)" title="タイトルを編集"><i class="fa-solid fa-pen"></i></button>
                                    ${titleCandidates.length ? `<button type="button" class="secondary-btn" style="padding:3px 6px; font-size:0.7rem; flex-shrink:0;" onclick="app.chooseGuideTitleCandidate('${this.escapeJs(h.id)}', event)" title="タイトル候補から選ぶ"><i class="fa-solid fa-wand-magic-sparkles"></i></button>` : ''}
                                </div>
                                    ${this.getLineBadge(h.lineNo || machine?.lineNo)}
                                    ${manualGuideBadge}
                                    ${machine?.category ? `<span style="background:${isCommon ? 'var(--primary)' : '#eff6ff'}; color:${isCommon ? 'white' : '#1e40af'}; border:1px solid #bae6fd; padding:1px 6px; border-radius:3px; font-weight:800; font-size:0.65rem;">${machine.category}</span>` : ''}
                                    ${isCommon ? '<span style="font-size:0.75rem; color:var(--primary); font-weight:800;">[共通ルール]</span>' : (machine?.name || '')} ${!isCommon && machine?.model ? `[${machine.model}]` : ''}
                                </div>
                            </div>
                        </div>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px; background:var(--background); padding:8px; border-radius:8px; border:1px solid var(--border);">
                            <div style="min-width:0;">
                                <div style="font-size:0.6rem; color:var(--text-light); font-weight:800; margin-bottom:2px;">原因</div>
                                <div style="font-size:0.75rem; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${h.cause || '-'}">${this.highlightText(h.cause || '-', query)}</div>
                            </div>
                            <div style="min-width:0;">
                                <div style="font-size:0.6rem; color:var(--text-light); font-weight:800; margin-bottom:2px;">処置</div>
                                <div style="font-size:0.75rem; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${h.notes || '-'}">${this.highlightText(h.notes || '-', query)}</div>
                            </div>
                        </div>
                        
                        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
                            ${(h.guide.tags || []).map(t => `<span class="tag-badge active"><i class="fa-solid fa-tag" style="font-size:0.6rem;"></i> ${this.highlightText(t, query)}</span>`).join('')}
                        </div>

                        <div style="font-size:0.8rem; color:var(--text-main); line-height:1.5; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; margin-bottom:16px;">
                            ${this.highlightText(h.guide.text || '', query)}
                        </div>

                        <div style="display:flex; gap:8px; border-top:1px dashed var(--border); padding-top:12px;">
                            <button class="secondary-btn" style="flex:1; padding:6px; font-size:0.75rem" onclick="app.openGuideModal('${h.id}')">手順書を開く</button>
                            <button class="secondary-btn" style="padding:6px; font-size:0.75rem" onclick="app.printGuide('${h.id}')" title="印刷"><i class="fa-solid fa-print"></i></button>
                            <button class="secondary-btn" style="padding:6px; font-size:0.75rem; color:var(--danger);" onclick="app.archiveGuide('${h.id}', '${title.replace(/'/g, "\\'")}')" title="アーカイブ"><i class="fa-solid fa-box-archive"></i></button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        this.updateContextualHelp?.('guides');
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppRankingGuideMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppRankingGuideMethods.prototype[name];
        }
    }
})();
