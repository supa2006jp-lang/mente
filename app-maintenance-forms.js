(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppMaintenanceFormMethods extends MaintenanceApp {
    // --- Modal Logic ---
    openMachineModal(id = null) {
        const machine = id ? store.getMachines(true).find(m => m.id === id) : null;
        const tasks = id ? store.getTasks(id) : [];

        let usedPartsHTML = '';
        let troubleStampsHTML = '';
        if (id) {
            const troubleHistory = (store.activeData.history || [])
                .filter(h => String(h.machineId) === String(id) && !h.taskId)
                .sort((a, b) => new Date(b.date || '') - new Date(a.date || ''));
            if (troubleHistory.length > 0) {
                const counts = troubleHistory.reduce((acc, h) => {
                    const type = this.getMachineTroubleTypeInfo(h).key;
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                }, {});
                const latest = troubleHistory[0];
                troubleStampsHTML = `
                    <div class="machine-trouble-stamps-panel">
                        <div class="machine-trouble-stamps-head">
                            <span><i class="fa-solid fa-triangle-exclamation"></i> 過去のトラブル</span>
                            <small>最新: ${this.escapeHtml(latest.date || '日付なし')}</small>
                        </div>
                        <div class="machine-trouble-stamps">
                            ${this.getMachineTroubleStampButtonHtml(id, 'all', '全て', troubleHistory.length, 'fa-list')}
                            ${this.getMachineTroubleStampButtonHtml(id, 'sudden', '突発', counts.sudden || 0, 'fa-bolt-lightning')}
                            ${this.getMachineTroubleStampButtonHtml(id, 'dokatei', 'ドカ停', counts.dokatei || 0, 'fa-triangle-exclamation')}
                            ${this.getMachineTroubleStampButtonHtml(id, 'nonProductionStop', '非生産停止', counts.nonProductionStop || 0, 'fa-circle-pause')}
                        </div>
                    </div>
                `;
            }
            const pArray = this.collectMachineUsedParts(id);
            const referenceParts = this.collectSameModelUsedParts(id, machine);
            usedPartsHTML = `
                <div class="machine-used-parts-panel">
                    <div class="machine-used-parts-head">
                        <span><i class="fa-solid fa-box-open"></i> 過去の使用部品</span>
                        <small>${pArray.length > 0 ? `${pArray.length}種類` : '記録なし'}</small>
                    </div>
                    ${pArray.length > 0 ? `
                        <div class="machine-used-parts-list">
                            ${pArray.map(p => `
                                <button type="button" class="machine-used-part-card ${p.stockStatus}" onclick="app.openMachinePartHistoryPanel('${this.escapeJs(id)}', '${this.escapeJs(p.name)}', '${this.escapeJs(p.model)}')" title="この部品の使用履歴一覧を開く">
                                    <span class="machine-used-part-name">${this.escapeHtml(p.name || '部品名なし')}</span>
                                    ${p.model ? `<span class="machine-used-part-model">${this.escapeHtml(p.model)}</span>` : ''}
                                    <span class="machine-used-part-meta">
                                        累計 ${this.escapeHtml(p.count)}${this.escapeHtml(p.unit || '個')} / 最終使用 ${this.escapeHtml(p.latestDate || '-')}
                                    </span>
                                    <span class="machine-used-part-pace">${this.escapeHtml(p.paceText)}</span>
                                    ${this.getMachineUsedPartStockHtml(p)}
                                </button>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="machine-used-parts-empty">
                            この機械で使用した部品はまだ記録されていません。
                        </div>
                    `}
                    ${referenceParts.length > 0 ? `
                        <div class="machine-used-parts-reference">
                            <div class="machine-used-parts-reference-title">
                                <i class="fa-solid fa-layer-group"></i> 同じ型式の機械で使われた部品
                            </div>
                            <div class="machine-used-parts-list reference">
                                ${referenceParts.map(p => `
                                    <button type="button" class="machine-used-part-card reference ${p.stockStatus}" onclick="app.openMachinePartHistoryPanel('__same_model__:${this.escapeJs(id)}', '${this.escapeJs(p.name)}', '${this.escapeJs(p.model)}')" title="同型機での使用履歴一覧を開く">
                                        <span class="machine-used-part-name">${this.escapeHtml(p.name || '部品名なし')}</span>
                                        ${p.model ? `<span class="machine-used-part-model">${this.escapeHtml(p.model)}</span>` : ''}
                                        <span class="machine-used-part-meta">
                                            同型機累計 ${this.escapeHtml(p.count)}${this.escapeHtml(p.unit || '個')} / 最終使用 ${this.escapeHtml(p.latestDate || '-')}
                                        </span>
                                        <span class="machine-used-part-pace">${this.escapeHtml(p.paceText)}</span>
                                        ${this.getMachineUsedPartStockHtml(p)}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        this.openModal('machine', machine ? '機械の編集' : '新規機械登録', () => {
            this._maintenanceTaskTemplates = this.collectMaintenanceTaskTemplates(machine);
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <form id="machine-form">
                    <input type="hidden" id="f-machine-id" value="${id || ''}">
                    <div class="form-group">
                        <label>機械名・部品名 <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="f-machine-name" placeholder="例: メインコンベア" value="${machine ? machine.name : ''}" list="list-m-names" required>
                    </div>
                    <div class="form-group">
                        <label>型式 <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="f-machine-model" placeholder="例: MC-100" value="${machine ? machine.model : ''}" list="list-m-models" required>
                    </div>
                    <div class="form-group">
                        <label>製造元 (メーカー) <span style="font-size:0.7rem; font-weight:normal; color:var(--text-light);">※任意</span></label>
                        <input type="text" id="f-machine-manufacturer" placeholder="例: 〇〇精機" value="${machine && machine.manufacturer ? machine.manufacturer : ''}">
                    </div>
                    <div class="form-group">
                        <label>所属ライン番号 <span style="color:var(--danger)">*</span></label>
                        <select id="f-machine-line-no" required style="height:44px; font-weight:700;">
                            <option value="">-- ラインを選択 --</option>
                            ${this.generateLineOptionsHTML(machine?.lineNo || '')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>装置区分 (例: 包装機, 充填機) <span style="color:var(--danger)">*</span></label>
                        <select id="f-machine-category" onchange="app.toggleNewCategoryField('f-')" required style="height:44px;">
                            <option value="">-- 選択してください --</option>
                            ${this.getMachineCategoryOptions(machine ? machine.category : '')}
                        </select>
                        <input type="text" id="f-new-category-input" placeholder="新しい装置区分名を入力" style="display:none; margin-top:8px; border:2px solid var(--primary); padding:8px;" onblur="this.value = MaintenanceApp.toFullWidthUpper(this.value)">
                    </div>
                    <div class="form-group">
                        <label>備考</label>
                        <textarea id="f-machine-remarks" rows="2" placeholder="設置場所など">${machine ? machine.remarks : ''}</textarea>
                    </div>
                    ${troubleStampsHTML}

                    <div class="form-group" style="margin-top:16px;">
                        <label>機械の写真 (プロフィール用)</label>
                        <div style="display:flex; gap:16px; align-items:center;">
                            <div id="f-machine-photo-preview" class="img-box" style="width:100px; height:100px; border-radius:12px; border:2px dashed var(--border);">
                                ${machine && machine.photo ? `<img src="${machine.photo}">` : '<i class="fa-solid fa-camera" style="font-size:1.5rem; color:#cbd5e1;"></i>'}
                            </div>
                            <div style="flex:1">
                                <input type="file" id="f-machine-photo" accept="image/*" style="font-size:0.8rem;">
                                <input type="hidden" id="f-machine-photo-base64" value="${machine ? machine.photo || '' : ''}">
                                <div class="profile-photo-actions" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; margin-bottom:4px;">
                                    <button type="button" class="secondary-btn f-rotate-btn" style="padding:2px 8px; font-size:0.7rem; display:${machine && machine.photo ? 'inline-block' : 'none'};" onclick="app.rotateSinglePhotoField('f-machine-photo-base64', 'f-machine-photo-preview')"><i class="fa-solid fa-rotate-right"></i> 向きを修正</button>
                                    <button type="button" class="secondary-btn f-delete-photo-btn" style="padding:2px 8px; font-size:0.7rem; color:var(--danger); border-color:#fecaca; display:${machine && machine.photo ? 'inline-block' : 'none'};" onclick="app.clearSinglePhotoField('f-machine-photo-base64', 'f-machine-photo-preview', 'f-machine-photo')"><i class="fa-solid fa-trash"></i> 画像削除</button>
                                </div>
                                <p style="font-size:0.65rem; color:var(--text-light); margin-top:6px; line-height:1.4;">
                                    ※設定すると一覧やダッシュボードに表示されます。<br>
                                    ※大きな画像は自動でリサイズされます。
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top: 24px; border-top: 2px solid #94a3b8; padding-top: 16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <label style="font-size:0.85rem; font-weight:700;">メンテナンス項目</label>
                            <div class="maintenance-task-header-actions">
                                <input type="search" id="maintenance-task-template-search" class="maintenance-task-template-search" placeholder="テンプレート検索" oninput="app.filterMaintenanceTaskTemplates(this.value)" ${this._maintenanceTaskTemplates.length ? '' : 'disabled'}>
                                <select id="maintenance-task-template-select" class="maintenance-task-template-select" ${this._maintenanceTaskTemplates.length ? '' : 'disabled'}>
                                    <option value="">過去の項目から追加</option>
                                    ${this._maintenanceTaskTemplates.map((template, index) => `<option value="${index}">${this.escapeHtml(template.label)}</option>`).join('')}
                                </select>
                                <button type="button" class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.addTaskFromMaintenanceTemplate()" ${this._maintenanceTaskTemplates.length ? '' : 'disabled'}><i class="fa-solid fa-wand-magic-sparkles"></i> 反映</button>
                                <button type="button" class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.addTaskRow()"><i class="fa-solid fa-plus"></i> 追加</button>
                            </div>
                        </div>
                        <div id="f-tasks-container" style="display:flex; flex-direction:column; gap:10px;"></div>
                    </div>
                    ${usedPartsHTML}
                </form>
            `;

            // Add existing tasks or one empty row
            if (tasks.length > 0) {
                tasks.forEach(t => this.addTaskRow(t));
            } else {
                this.addTaskRow();
            }
        });
    }

    addTaskRow(task = null) {
        const container = document.getElementById('f-tasks-container');
        if (!container) return;

        let partsInfoHTML = '';
        if (task && task.id) {
            const tHistory = store.activeData.history.filter(h => h.taskId === task.id && h.replacedParts && h.replacedParts.length > 0);
            const partMap = {};
            tHistory.forEach(h => {
                h.replacedParts.forEach(p => {
                    const key = `${p.name}___${p.model}`;
                    if (!partMap[key]) {
                        partMap[key] = { name: p.name, model: p.model, count: 0, latestDate: h.date };
                    }
                    partMap[key].count += (p.count || 0);
                    if (new Date(h.date) > new Date(partMap[key].latestDate)) {
                        partMap[key].latestDate = h.date;
                    }
                });
            });
            const pArray = Object.values(partMap).sort((a,b) => new Date(b.latestDate) - new Date(a.latestDate));
            if (pArray.length > 0) {
                partsInfoHTML = `
                    <div style="font-size:0.65rem; color:var(--text-light); margin-top:2px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                        <i class="fa-solid fa-link" style="color:var(--text-light)"></i> 定期交換部品の実績:
                        ${pArray.map(p => `<span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:700; border:1px solid #bae6fd;">${p.name}${p.model ? `[${p.model}]` : ''}</span>`).join('')}
                    </div>
                `;
            }
        }

        const div = document.createElement('div');
        div.className = 'task-row';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '4px';
        div.style.marginBottom = '12px';
        div.style.paddingBottom = '8px';
        div.style.borderBottom = '1px dashed #e2e8f0';

        div.innerHTML = `
            <div style="display:flex; gap:8px; align-items:center; width:100%;">
                <input type="hidden" class="t-id" value="${task ? task.id : ''}">
                <input type="text" class="t-content" style="flex:2" placeholder="作業内容 (任意)" value="${task ? this.escapeHtml(task.content || '') : ''}" oninput="app.updateTaskCyclePreview(this)">
                <div style="flex:1; display:flex; align-items:center; gap:4px;">
                    <input type="number" class="t-period" style="width:70px" min="0" placeholder="周期" value="${task ? task.periodDays : ''}" oninput="app.updateOneOffBadge(this)">
                    <span style="font-size:0.7rem; color:var(--text-light); white-space:nowrap;">日毎</span>
                    <span class="one-off-badge ${task && (parseInt(task.periodDays) || 0) === 0 ? '' : 'hidden'}">1回きり</span>
                </div>
                <input type="date" class="t-start" style="flex:1" value="${task?.startDate || this.getLocalDateString()}" onchange="app.updateTaskCyclePreview(this)">
                <div style="display:flex; gap:4px;">
                    ${task && task.id 
                        ? `
                            <button type="button" class="secondary-btn" title="アーカイブ" style="font-size:1rem; color:var(--text-light);" onclick="app.archiveMaintenanceTask('${task.id}', '${task.content.replace(/'/g, "\\'")}')"><i class="fa-solid fa-box-archive"></i></button>
                            <button type="button" class="secondary-btn" title="削除" style="font-size:1rem; color:var(--danger);" onclick="app.deleteMaintenanceTaskFromMachineModal('${task.id}', '${task.content.replace(/'/g, "\\'")}', this)"><i class="fa-solid fa-trash-can"></i></button>
                        ` 
                        : `<button type="button" class="close-btn" style="font-size:1rem" onclick="this.parentElement.parentElement.parentElement.remove()"><i class="fa-solid fa-trash-can"></i></button>`}
                </div>
            </div>
            ${partsInfoHTML}
            <div class="task-cycle-tools">
                <span>周期候補</span>
                ${[0, 7, 14, 30, 60, 90, 180].map(days => `<button type="button" onclick="app.setTaskPeriod(this, ${days})">${days === 0 ? '単発' : `${days}日`}</button>`).join('')}
            </div>
            <div class="task-cycle-preview muted">
                開始日と周期を入れると次回予定を確認できます
            </div>
            <div class="task-cycle-warning" hidden>
                <i class="fa-solid fa-triangle-exclamation"></i> 周期または開始日が未入力です。保存時は単発予定として扱います。
            </div>
        `;
        container.appendChild(div);
        this.updateOneOffBadge(div.querySelector('.t-period'));
        return div;
    }

    getMachineTroubleTypeInfo(history) {
        if (history?.isDokatei) return { key: 'dokatei', label: 'ドカ停', icon: 'fa-triangle-exclamation' };
        if (history?.isNonProductionStop) return { key: 'nonProductionStop', label: '非生産停止', icon: 'fa-circle-pause' };
        return { key: 'sudden', label: '突発', icon: 'fa-bolt-lightning' };
    }

    getMachineTroubleStampButtonHtml(machineId, type, label, count, icon) {
        if (!count) return '';
        return `
            <button type="button" class="machine-trouble-stamp ${this.escapeHtml(type)}" onclick="app.openMachineTroubleHistoryPanel('${this.escapeJs(machineId)}', '${this.escapeJs(type)}')">
                <i class="fa-solid ${icon}"></i>
                <span>${this.escapeHtml(label)}</span>
                <b>${count}</b>
            </button>
        `;
    }

    openMachineTroubleHistoryPanel(machineId, type = 'all') {
        const machine = store.getMachines(true).find(m => String(m.id) === String(machineId));
        const histories = (store.activeData.history || [])
            .filter(h => String(h.machineId) === String(machineId) && !h.taskId)
            .filter(h => type === 'all' || this.getMachineTroubleTypeInfo(h).key === type)
            .sort((a, b) => new Date(b.date || '') - new Date(a.date || ''));
        const titleMap = {
            all: '過去のトラブル',
            sudden: '突発トラブル',
            dokatei: 'ドカ停',
            nonProductionStop: '非生産停止'
        };

        this.openModal('machine-trouble-history', `${machine?.name || '機械'} ${titleMap[type] || '過去のトラブル'} ${histories.length}件`, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = histories.length ? `
                <div class="machine-trouble-history-list">
                    ${histories.map(h => {
                        const typeInfo = this.getMachineTroubleTypeInfo(h);
                        const workers = Array.isArray(h.workers) ? h.workers.join(', ') : (h.workers || '');
                        return `
                            <article class="machine-trouble-history-card ${typeInfo.key}">
                                <div class="machine-trouble-history-top">
                                    <span class="machine-trouble-type"><i class="fa-solid ${typeInfo.icon}"></i> ${this.escapeHtml(typeInfo.label)}</span>
                                    <span class="machine-trouble-date">${this.escapeHtml(h.date || '日付なし')}</span>
                                </div>
                                <div class="machine-trouble-title">${this.escapeHtml(h.errorContent || h.notes || '内容なし')}</div>
                                <div class="machine-trouble-detail-grid">
                                    <div><span>原因</span><b>${this.escapeHtml(h.cause || '未入力')}</b></div>
                                    <div><span>処置</span><b>${this.escapeHtml(h.notes || '未入力')}</b></div>
                                </div>
                                <div class="machine-trouble-history-meta">
                                    ${h.errorNo ? `<span>異常No: ${this.escapeHtml(h.errorNo)}</span>` : ''}
                                    ${h.workTime ? `<span>作業時間: ${this.escapeHtml(h.workTime)}分</span>` : ''}
                                    ${workers ? `<span>作業者: ${this.escapeHtml(workers)}</span>` : ''}
                                </div>
                                <button type="button" class="secondary-btn machine-trouble-open-btn" onclick="app.closeModal(); app.openHistoryEditForm('${this.escapeJs(h.id)}')">
                                    <i class="fa-solid fa-arrow-up-right-from-square"></i> 履歴を開く
                                </button>
                            </article>
                        `;
                    }).join('')}
                </div>
            ` : '<p style="font-size:0.85rem; padding:12px; background:var(--background); border-radius:8px;">表示できるトラブル履歴はありません。</p>';
            const saveBtn = document.querySelector('.modal-footer .primary-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
        });
    }

    collectMachineUsedParts(machineId, options = {}) {
        const histories = (store.activeData.history || [])
            .filter(h => String(h.machineId) === String(machineId) && h.replacedParts && h.replacedParts.length > 0)
            .sort((a, b) => new Date(b.date || '') - new Date(a.date || ''));
        return this.collectUsedPartsFromHistories(histories, options.excludeKeys || new Set());
    }

    collectSameModelUsedParts(machineId, machine) {
        if (!machine?.model) return [];
        const model = MaintenanceApp.toHalfWidthLower(machine.model || '');
        if (!model) return [];
        const sameModelMachineIds = store.getMachines(true)
            .filter(m => String(m.id) !== String(machineId) && MaintenanceApp.toHalfWidthLower(m.model || '') === model)
            .map(m => String(m.id));
        if (sameModelMachineIds.length === 0) return [];
        const ownKeys = new Set(this.collectMachineUsedParts(machineId).map(p => `${p.name}___${p.model}`));
        const histories = (store.activeData.history || [])
            .filter(h => sameModelMachineIds.includes(String(h.machineId)) && h.replacedParts && h.replacedParts.length > 0)
            .sort((a, b) => new Date(b.date || '') - new Date(a.date || ''));
        return this.collectUsedPartsFromHistories(histories, ownKeys).slice(0, 12);
    }

    collectUsedPartsFromHistories(histories, excludeKeys = new Set()) {
        const partMap = {};
        histories.forEach(h => {
            h.replacedParts.forEach(p => {
                const name = p.name || '';
                const model = p.model || '';
                const key = `${name}___${model}`;
                if (excludeKeys.has(key)) return;
                if (!partMap[key]) {
                    const master = store.getPartMaster(name, model);
                    partMap[key] = {
                        name,
                        model,
                        count: 0,
                        unit: p.unit || master?.unit || '個',
                        latestDate: h.date,
                        latestHistoryId: h.id,
                        histories: [],
                        master
                    };
                }
                partMap[key].count += parseFloat(p.count) || 0;
                partMap[key].histories.push({ history: h, part: p });
                if (new Date(h.date || '') > new Date(partMap[key].latestDate || '')) {
                    partMap[key].latestDate = h.date;
                    partMap[key].latestHistoryId = h.id;
                    partMap[key].unit = p.unit || partMap[key].unit || '個';
                }
            });
        });
        return Object.values(partMap).map(part => {
            const master = part.master || store.getPartMaster(part.name, part.model);
            const stock = parseFloat(master?.stock);
            const minStock = parseFloat(master?.minStock);
            const hasStock = !Number.isNaN(stock);
            const lowStock = hasStock && minStock > 0 && stock <= minStock;
            return {
                ...part,
                master,
                stock: hasStock ? stock : null,
                minStock: Number.isNaN(minStock) ? 0 : minStock,
                price: parseFloat(master?.price) || 0,
                supplier: master?.supplier || '',
                shelf: master?.shelf || '',
                stockStatus: lowStock ? 'low-stock' : (master ? 'has-master' : 'no-master')
            };
            enriched.paceText = this.getUsedPartPaceText(part.histories.map(entry => entry.history.date).filter(Boolean));
            return enriched;
        }).sort((a, b) => new Date(b.latestDate || '') - new Date(a.latestDate || ''));
    }

    getUsedPartPaceText(dateStrings = []) {
        const dates = [...new Set(dateStrings)]
            .map(dateStr => new Date(`${dateStr}T00:00:00`))
            .filter(date => !Number.isNaN(date.getTime()))
            .sort((a, b) => a - b);
        if (dates.length === 0) return '使用ペース: 記録なし';

        const latest = dates[dates.length - 1];
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        sixMonthsAgo.setHours(0, 0, 0, 0);
        const recentCount = dates.filter(date => date >= sixMonthsAgo).length;

        if (dates.length < 2) {
            return `過去6か月 ${recentCount}回 / 平均: 計算不可`;
        }

        let totalDays = 0;
        for (let i = 1; i < dates.length; i++) {
            totalDays += Math.max(0, Math.round((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24)));
        }
        const averageDays = Math.max(1, Math.round(totalDays / (dates.length - 1)));
        const daysSinceLatest = Math.max(0, Math.round((new Date().setHours(0, 0, 0, 0) - latest.getTime()) / (1000 * 60 * 60 * 24)));
        return `過去6か月 ${recentCount}回 / 平均${averageDays}日ごと / 最終から${daysSinceLatest}日`;
    }

    getMachineUsedPartStockHtml(part) {
        if (!part.master) {
            return '<span class="machine-used-part-stock no-master">部品マスター未登録</span>';
        }
        const unit = this.escapeHtml(part.master.unit || part.unit || '個');
        const stockText = part.stock === null ? '未入力' : `${this.escapeHtml(part.stock)}${unit}`;
        const priceText = part.price > 0 ? ` / 単価 ${this.escapeHtml(part.price)}円` : '';
        const supplierText = part.supplier ? ` / ${this.escapeHtml(part.supplier)}` : '';
        const alertText = part.minStock > 0 ? ` / 発注目安 ${this.escapeHtml(part.minStock)}${unit}` : '';
        return `
            <span class="machine-used-part-stock ${part.stockStatus}">
                在庫 ${stockText}${priceText}${supplierText}${alertText}
            </span>
        `;
    }

    openMachinePartHistoryPanel(machineId, partName, partModel = '') {
        let targetMachineIds = [String(machineId)];
        let titlePrefix = '';
        if (String(machineId).startsWith('__same_model__:')) {
            const baseId = String(machineId).replace('__same_model__:', '');
            const baseMachine = store.getMachines(true).find(m => String(m.id) === String(baseId));
            const model = MaintenanceApp.toHalfWidthLower(baseMachine?.model || '');
            targetMachineIds = store.getMachines(true)
                .filter(m => String(m.id) !== String(baseId) && MaintenanceApp.toHalfWidthLower(m.model || '') === model)
                .map(m => String(m.id));
            titlePrefix = '同型機 ';
        }
        const machineById = new Map(store.getMachines(true).map(m => [String(m.id), m]));
        const rows = [];
        (store.activeData.history || []).forEach(h => {
            if (!targetMachineIds.includes(String(h.machineId))) return;
            (h.replacedParts || []).forEach(p => {
                if ((p.name || '') === partName && (p.model || '') === partModel) rows.push({ h, p });
            });
        });
        rows.sort((a, b) => new Date(b.h.date || '') - new Date(a.h.date || ''));
        const master = store.getPartMaster(partName, partModel);
        const paceText = this.getUsedPartPaceText(rows.map(row => row.h.date).filter(Boolean));

        this.openModal('machine-part-history', `${titlePrefix}${partName || '部品'} 使用履歴 ${rows.length}件`, () => {
            const content = document.getElementById('modal-content');
            const unit = master?.unit || rows[0]?.p?.unit || '個';
            const masterHtml = master ? `
                <div class="machine-part-master-summary ${((parseFloat(master.minStock) || 0) > 0 && (parseFloat(master.stock) || 0) <= (parseFloat(master.minStock) || 0)) ? 'low-stock' : ''}">
                    <span><i class="fa-solid fa-boxes-stacked"></i> 現在庫: ${this.escapeHtml(master.stock ?? '未入力')}${this.escapeHtml(unit)}</span>
                    ${master.price ? `<span>単価: ${this.escapeHtml(master.price)}円</span>` : ''}
                    ${master.supplier ? `<span>仕入先: ${this.escapeHtml(master.supplier)}</span>` : ''}
                    ${master.minStock ? `<span>発注目安: ${this.escapeHtml(master.minStock)}${this.escapeHtml(unit)}</span>` : ''}
                    ${master.shelf ? `<span>棚番: ${this.escapeHtml(master.shelf)}</span>` : ''}
                </div>
            ` : '<div class="machine-part-master-summary no-master"><i class="fa-solid fa-circle-info"></i> 部品マスター未登録です。</div>';
            content.innerHTML = `
                ${masterHtml}
                <div class="machine-part-pace-summary">
                    <i class="fa-solid fa-chart-line"></i> ${this.escapeHtml(paceText)}
                </div>
                ${rows.length ? `
                    <div class="machine-part-history-list">
                        ${rows.map(({ h, p }) => {
                            const machine = machineById.get(String(h.machineId));
                            return `
                                <article class="machine-part-history-card">
                                    <div class="machine-part-history-top">
                                        <span>${this.escapeHtml(h.date || '日付なし')}</span>
                                        <span>${this.escapeHtml(machine?.name || '機械名なし')}${machine?.model ? ` [${this.escapeHtml(machine.model)}]` : ''}</span>
                                    </div>
                                    <div class="machine-part-history-title">${this.escapeHtml(this.getHistoryDisplayText(h))}</div>
                                    <div class="machine-part-history-meta">
                                        <span>使用数: ${this.escapeHtml(p.count || 0)}${this.escapeHtml(p.unit || unit)}</span>
                                        ${h.workTime ? `<span>作業時間: ${this.escapeHtml(h.workTime)}分</span>` : ''}
                                    </div>
                                    ${h.cause || h.notes ? `
                                        <div class="machine-part-history-detail">
                                            ${h.cause ? `<div><b>原因</b>${this.escapeHtml(h.cause)}</div>` : ''}
                                            ${h.notes ? `<div><b>処置</b>${this.escapeHtml(h.notes)}</div>` : ''}
                                        </div>
                                    ` : ''}
                                    <button type="button" class="secondary-btn machine-trouble-open-btn" onclick="app.closeModal(); app.openHistoryEditForm('${this.escapeJs(h.id)}')">
                                        <i class="fa-solid fa-arrow-up-right-from-square"></i> 履歴を開く
                                    </button>
                                </article>
                            `;
                        }).join('')}
                    </div>
                ` : '<p style="font-size:0.85rem; padding:12px; background:var(--background); border-radius:8px;">この部品の使用履歴はありません。</p>'}
            `;
            const saveBtn = document.querySelector('.modal-footer .primary-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
        });
    }

    updateOneOffBadge(input) {
        const row = input?.closest('.task-row');
        const badge = row?.querySelector('.one-off-badge');
        if (badge) badge.classList.toggle('hidden', (parseInt(input.value) || 0) !== 0);
        this.updateTaskCyclePreview(row);
    }

    collectMaintenanceTaskTemplates(machine = null) {
        const machines = store.getMachines(true);
        const machineById = new Map(machines.map(m => [String(m.id), m]));
        const seen = new Set();
        const templates = [];
        (store.activeData.tasks || []).forEach(task => {
            if (!task || task.deleted || !task.content) return;
            if (store.isMaintenanceTaskArchived(task.id)) return;
            const sourceMachine = machineById.get(String(task.machineId));
            if (machine?.category && sourceMachine?.category && sourceMachine.category !== machine.category) return;
            const periodDays = parseInt(task.periodDays) || 0;
            const key = `${task.content}__${periodDays}`;
            if (seen.has(key)) return;
            seen.add(key);
            const source = sourceMachine ? ` / ${sourceMachine.name || '設備名なし'}` : '';
            templates.push({
                content: task.content,
                periodDays,
                startDate: this.getLocalDateString(),
                label: `${task.content}（${periodDays > 0 ? `${periodDays}日周期` : '単発'}${source}）`
            });
        });
        return templates.slice(0, 30);
    }

    addTaskFromMaintenanceTemplate() {
        const select = document.getElementById('maintenance-task-template-select');
        const index = parseInt(select?.value, 10);
        const template = this._maintenanceTaskTemplates?.[index];
        if (!template) return;
        const row = this.addTaskRow({
            content: template.content,
            periodDays: template.periodDays,
            startDate: this.getLocalDateString()
        });
        row?.classList.add('task-row-template-added');
        setTimeout(() => row?.classList.remove('task-row-template-added'), 1600);
        select.value = '';
    }

    filterMaintenanceTaskTemplates(query = '') {
        const select = document.getElementById('maintenance-task-template-select');
        if (!select) return;
        const normalizedQuery = MaintenanceApp.toHalfWidthLower(query || '').trim();
        const options = ['<option value="">過去の項目から追加</option>'];
        (this._maintenanceTaskTemplates || []).forEach((template, index) => {
            const searchable = MaintenanceApp.toHalfWidthLower(`${template.label || ''} ${template.content || ''} ${template.periodDays || ''}`);
            if (normalizedQuery && !searchable.includes(normalizedQuery)) return;
            options.push(`<option value="${index}">${this.escapeHtml(template.label)}</option>`);
        });
        select.innerHTML = options.join('');
    }

    setTaskPeriod(button, days) {
        const row = button?.closest('.task-row');
        const input = row?.querySelector('.t-period');
        if (!input) return;
        input.value = String(days);
        this.updateOneOffBadge(input);
    }

    updateTaskCyclePreview(rowOrInput) {
        const row = rowOrInput?.closest?.('.task-row') || rowOrInput;
        if (!row) return;
        const periodInput = row.querySelector('.t-period');
        const startInput = row.querySelector('.t-start');
        const contentInput = row.querySelector('.t-content');
        const preview = row.querySelector('.task-cycle-preview');
        if (!periodInput || !startInput || !preview) return;

        const hasContent = !!contentInput?.value.trim();
        const missingCycle = hasContent && (!periodInput.value.trim() || !startInput.value);
        row.classList.toggle('task-row-cycle-warning', missingCycle);
        const warning = row.querySelector('.task-cycle-warning');
        if (warning) warning.hidden = !missingCycle;

        const periodDays = parseInt(periodInput.value) || 0;
        const startDate = startInput.value;
        if (!startDate) {
            preview.textContent = '開始日を入れると予定日を確認できます';
            preview.className = 'task-cycle-preview muted';
            return;
        }
        if (periodDays <= 0) {
            preview.innerHTML = `<i class="fa-solid fa-circle-info"></i> 初回予定: ${this.formatMaintenancePreviewDate(startDate)}（単発予定）`;
            preview.className = 'task-cycle-preview one-off';
            return;
        }

        const next = this.addDaysForMaintenancePreview(startDate, periodDays);
        preview.innerHTML = `<i class="fa-regular fa-calendar-check"></i> 初回予定: ${this.formatMaintenancePreviewDate(startDate)} / 次回予定: ${this.formatMaintenancePreviewDate(next)}（${periodDays}日周期）`;
        preview.className = 'task-cycle-preview periodic';
    }

    addDaysForMaintenancePreview(dateStr, days) {
        const date = new Date(`${dateStr}T00:00:00`);
        date.setDate(date.getDate() + days);
        return this.getLocalDateString(date);
    }

    formatMaintenancePreviewDate(dateStr) {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${year}/${month}/${day}`;
    }

    getLocalDateString(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    openSuddenRecordModal(defaultDate = null, prefill = null) {
        if (!prefill) this._pendingShiftSuddenRegistration = null;
        const machines = store.getMachines();
        const dateVal = defaultDate || new Date().toISOString().split('T')[0];
        const lastMachineCategory = store.getLastSuddenCategory();
        
        this.openModal('sudden', '突発対応の詳細記録', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <form id="sudden-form">
                    <div class="single-maintenance-toggle-panel">
                        <label>
                            <input type="checkbox" id="s-is-single-maintenance" style="width:auto;" onchange="app.toggleSuddenSingleMaintenanceMode()">
                            <span><i class="fa-solid fa-screwdriver-wrench"></i> 単発メンテ登録</span>
                        </label>
                        <small>チェックすると、突発トラブルではなく1回きりのメンテ完了記録として保存します。</small>
                    </div>
                    <div class="form-group" style="background:#f1f5f9; padding:12px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:15px;">
                        <label style="font-weight:900; color:#475569;"><i class="fa-solid fa-list-ol"></i> 対応ライン番号 <span style="color:var(--danger)">*</span></label>
                        <select id="s-line-no" required style="height:44px; font-weight:900; color:var(--text-main); font-size:1rem; border:2.5px solid var(--border-dark);">
                            <option value="">-- ラインを選択してください --</option>
                            ${this.generateLineOptionsHTML()}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>対象の機械 <span style="color:var(--danger)">*</span></label>
                        <div style="font-size:0.7rem; color:var(--primary); font-weight:800; margin-bottom:8px;">
                            <i class="fa-solid fa-circle-info"></i> 対象機械本体を選択すると対応ラインと装置区分が自動入力されます。
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:10px;">
                            <div class="form-group" style="margin-bottom:0">
                                <label>装置区分 (例: 包装機, 充填機) <span style="color:var(--danger)">*</span></label>
                                <select id="s-machine-category" onchange="app.toggleNewCategoryField('s-')" required style="height:44px;">
                                    <option value="">-- 選択してください --</option>
                                    ${this.getMachineCategoryOptions(lastMachineCategory || '')}
                                </select>
                                <input type="text" id="s-new-category-input" placeholder="新しい装置区分名を入力" style="display:none; margin-top:8px; border:2px solid var(--primary); padding:8px;" onblur="this.value = MaintenanceApp.toFullWidthUpper(this.value)">
                            </div>
                            <div class="form-group" style="margin-bottom:0">
                                <label style="font-size:0.75rem">対象機械本体</label>
                                <select id="s-machine-id" onchange="app.onSuddenMachineChange(this.value)" required style="height:44px; font-weight:700; border:2px solid var(--primary);">
                                    <option value="">-- 選択してください --</option>
                                    ${machines.sort((a,b) => {
                                        const la = a.lineNo || '99';
                                        const lb = b.lineNo || '99';
                                        return String(la).localeCompare(String(lb), undefined, {numeric: true});
                                    }).map(m => `<option value="${m.id}">[${m.lineNo ? this.getLineLabel(m.lineNo) : '未設定'}] ${m.name} [${m.model}]</option>`).join('')}
                                    <option value="NEW_MACHINE">+ 新しい機械として登録する</option>
                                </select>
                            </div>
                        </div>
                        <div id="s-new-machine-fields" style="display:none; grid-template-columns: 1fr 1fr; gap:12px; margin-top:10px; padding:12px; background:var(--background); border-radius:var(--radius-sm);">
                            <div class="form-group" style="margin-bottom:0">
                                <label style="font-size:0.75rem">新規機械名</label>
                                <input type="text" id="s-new-name" placeholder="例: 新規プレス機" list="list-m-names">
                            </div>
                            <div class="form-group" style="margin-bottom:0">
                                <label style="font-size:0.75rem">新規型式</label>
                                <input type="text" id="s-new-model" placeholder="例: NP-500" list="list-m-models">
                            </div>
                        </div>
                    </div>

                    <!-- Search Guides & Copy Last Record -->
                    <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
                        <div id="s-related-guides-section" style="display:none; border-bottom:1px dashed var(--border); padding-bottom:12px;">
                            <label style="font-size:0.8rem; font-weight:800; color:var(--primary); display:flex; align-items:center; gap:6px;">
                                <i class="fa-solid fa-lightbulb"></i> 関連する手順書・ナレッジ
                            </label>
                            <div id="s-related-guides-list" style="margin-top:8px; display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto; padding:4px;"></div>
                        </div>

                        <div id="s-copy-last-section" style="display:none;">
                            <button type="button" id="btn-s-copy-last" class="secondary-btn" style="width:100%; padding:10px; font-weight:800; background:var(--primary-light); color:var(--primary); border:1.5px solid var(--primary); display:flex; align-items:center; justify-content:center; gap:8px;" onclick="app.copyLastSuddenRecord()">
                                <i class="fa-solid fa-clone"></i> この機械の前回の記録をコピー
                            </button>
                            <div style="font-size:0.65rem; color:var(--text-light); text-align:center; margin-top:4px;">※症状/原因/処置/作業者/部品を自動入力します</div>
                        </div>
                        <div id="s-history-assist-panel"></div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>発生日 <span style="color:var(--danger)">*</span></label>
                            <input type="date" id="s-date" value="${dateVal}" required>
                        </div>
                        <div class="form-group" style="display:flex; align-items:flex-end;">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; background:var(--danger-light); padding:10px 16px; border-radius:var(--radius-md); border:1px solid #fca5a5; width:100%;">
                                <input type="checkbox" id="s-is-dokatei" style="width: auto;" onchange="const np=document.getElementById('s-is-non-production-stop'); if(this.checked && np) np.checked=false;">
                                <span style="font-weight:800; color:var(--danger); font-size:0.85rem;">ドカ停</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; background:#fffbeb; padding:10px 16px; border-radius:var(--radius-md); border:1px solid #fde68a;">
                            <input type="checkbox" id="s-is-non-production-stop" style="width:auto;" onchange="const d=document.getElementById('s-is-dokatei'); if(this.checked && d) d.checked=false;">
                            <span style="font-weight:800; color:#b45309; font-size:0.85rem;">非生産停止トラブル（生産は止まっていない突発メンテ）</span>
                        </label>
                    </div>

                    <div class="form-group">
                        <label>エラー番号</label>
                        <input type="text" id="s-error-no" placeholder="例: E-01" list="s-list-model-error-nos">
                        <div id="s-error-no-suggestions" class="suggestion-area"></div>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>作業時間 (分) <span style="color:var(--danger)">*</span></label>
                            <input type="number" id="s-work-time" placeholder="例: 30" min="0" required>
                        </div>
                        <div class="form-group">
                            <label>開始時間 <span style="font-size:0.7rem; color:var(--text-light); font-weight:400;">任意</span></label>
                            <input type="time" id="s-start-time">
                        </div>
                        <div class="form-group">
                            <label>終了時間 <span style="font-size:0.7rem; color:var(--text-light); font-weight:400;">任意</span></label>
                            <input type="time" id="s-end-time">
                        </div>
                    </div>
                    <div id="s-time-status" class="maintenance-time-status"></div>

                    <div class="form-group">
                        <label>対応種別 <span style="font-size:0.7rem; color:var(--text-light); font-weight:400;">※「初回」のみスキルマップの集計対象になります</span></label>
                        <div style="display:flex; gap:16px; background:var(--background); padding:10px; border-radius:8px; border:1px solid var(--border);">
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" name="s-occurrence" value="first" checked style="width:auto;"> <span style="font-weight:800; color:var(--primary);">初回対応 (技術習得)</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" name="s-occurrence" value="recurrence" style="width:auto;"> <span style="font-weight:800; color:var(--text-light);">再発・繰り返し</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label id="s-content-label">症状・故障内容 <span style="color:var(--danger)">*</span></label>
                        <textarea id="s-content" class="sudden-detail-textarea" rows="6" placeholder="どのような異常が発生したか記入してください" required oninput="app.updateHistorySmartAssist('s-', false)"></textarea>
                        <div id="s-content-suggestions" class="suggestion-area"></div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>原因</label>
                            <textarea id="s-cause" class="sudden-detail-textarea" rows="9" placeholder="故障の根本原因" list="s-list-model-causes"></textarea>
                            <div id="s-cause-suggestions" class="suggestion-area"></div>
                        </div>
                        <div class="form-group">
                            <label>処置・対応内容</label>
                            <textarea id="s-notes" class="sudden-detail-textarea" rows="9" placeholder="どのような修理・処置を行ったか" list="s-list-model-treatments"></textarea>
                            <div id="s-notes-suggestions" class="suggestion-area"></div>
                        </div>
                    </div>
                    <datalist id="s-list-model-error-nos"></datalist>
                    <datalist id="s-list-model-contents"></datalist>
                    <datalist id="s-list-model-causes"></datalist>
                    <datalist id="s-list-model-treatments"></datalist>

                    <div class="form-group">
                        <label>作業者 (カンマ区切りで複数登録) <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="s-workers" placeholder="例: 田中, 鈴木" list="list-workers" style="border:2px solid var(--primary);" required>
                        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
                            ${store.getWorkers().filter(w => !(store.activeData.archivedSuggestions?.workers || []).includes(w)).map(w => `
                                <div class="suggestion-badge" style="background:#f8fafc; color:#0369a1; border:1px solid #cbd5e1; font-weight:700; display:inline-flex; align-items:stretch; padding:0; overflow:hidden;">
                                    <button type="button" style="background:none; border:none; padding:4px 8px; font-size:inherit; color:inherit; cursor:pointer; font-weight:inherit;" onclick="app.addWorkerToInput('${w}', 's-workers')">
                                        <i class="fa-solid fa-user-plus" style="margin-right:2px; font-size:0.65rem;"></i> ${String(w).replace(/</g, "&lt;")}
                                    </button>
                                    <button type="button" style="background:none; border:none; border-left:1px solid #cbd5e1; padding:0 6px; color:#94a3b8; cursor:pointer;" onclick="app.removeSuggestion('workers', '${w.replace(/'/g, "\\'")}', this.parentElement)" title="今後サジェストしない">
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="form-group">
                        <label>対応区分 (集計用セレクト) <span style="color:var(--danger)">*</span></label>
                        <select id="s-category" required>
                            <option value="">-- 選択してください --</option>
                            <option value="machine">機械修理</option>
                            <option value="electric">電気系修理</option>
                            <option value="adjust">調整・設定変更</option>
                            <option value="parts">部品交換</option>
                            <option value="clean">清掃・給油</option>
                            <option value="other">その他</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>添付資料 (写真・登録動画)</label>
                        <div class="attachment-input-actions">
                            <input type="file" id="s-photos" accept="image/*" multiple>
                            <button type="button" class="secondary-btn registered-video-attach-btn" onclick="app.openRegisteredVideoAttachmentPicker('history', 's-photo-previews')"><i class="fa-solid fa-video"></i> 登録動画</button>
                        </div>
                        <div id="s-photo-previews" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
                    </div>

                    <div style="margin-top: 24px; border-top: 2px solid #94a3b8; padding-top: 16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <label style="font-size:0.85rem; font-weight:700;">交換部品・資材</label>
                            <button type="button" class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.addPartRow(null, true)"><i class="fa-solid fa-plus"></i> 追加</button>
                        </div>
                        <div id="s-parts-container" style="display:flex; flex-direction:column; gap:8px;"></div>
                    </div>
                </form>
            `;
            this.setupAutoResizeTextareas('#sudden-form .sudden-detail-textarea');
            this.setupSuddenTimeAutoCalc();
            this.toggleSuddenSingleMaintenanceMode();
            if (prefill?.content) {
                const content = document.getElementById('s-content');
                if (content) {
                    content.value = prefill.content;
                    this.autoResizeTextarea(content);
                    content.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
            this.applySuddenRecordWideLayout('s');
        });
    }

    toggleSuddenSingleMaintenanceMode() {
        const enabled = !!document.getElementById('s-is-single-maintenance')?.checked;
        const mutedIds = ['s-is-dokatei', 's-is-non-production-stop', 's-error-no'];
        const mutedGroups = mutedIds.map(id => document.getElementById(id)?.closest('.form-group')).filter(Boolean);
        const occurrenceGroup = document.querySelector('input[name="s-occurrence"]')?.closest('.form-group');
        const causeGroup = document.getElementById('s-cause')?.closest('.form-group');
        if (occurrenceGroup) mutedGroups.push(occurrenceGroup);
        if (causeGroup) mutedGroups.push(causeGroup);

        mutedGroups.forEach(group => {
            group.classList.toggle('single-maintenance-muted', enabled);
            group.querySelectorAll('input, textarea, select, button').forEach(control => {
                if (control.id === 's-is-single-maintenance') return;
                control.disabled = enabled;
            });
        });

        if (enabled) {
            const dokatei = document.getElementById('s-is-dokatei');
            const nonProduction = document.getElementById('s-is-non-production-stop');
            const errorNo = document.getElementById('s-error-no');
            const cause = document.getElementById('s-cause');
            if (dokatei) dokatei.checked = false;
            if (nonProduction) nonProduction.checked = false;
            if (errorNo) errorNo.value = '';
            if (cause) cause.value = '';
        }

        const contentLabel = document.getElementById('s-content-label');
        const content = document.getElementById('s-content');
        if (contentLabel) {
            contentLabel.innerHTML = enabled
                ? 'メンテ内容 <span style="color:var(--danger)">*</span>'
                : '症状・故障内容 <span style="color:var(--danger)">*</span>';
        }
        if (content) {
            content.placeholder = enabled
                ? '実施した単発メンテ内容を記入してください'
                : 'どのような異常が発生したか記入してください';
        }
        this.updateHistorySmartAssist('s-');
    }

    applySuddenRecordWideLayout(prefix = 's') {
        const formId = prefix === 'e' ? 'edit-history-form' : 'sudden-form';
        const startFieldId = prefix === 'e' ? 'e-symptom' : 's-content';
        const form = document.getElementById(formId);
        const startGroup = document.getElementById(startFieldId)?.closest('.form-group');
        if (!form || !startGroup || form.querySelector('.sudden-record-wide-layout')) return;

        const layout = document.createElement('div');
        layout.className = 'sudden-record-wide-layout';
        const left = document.createElement('div');
        left.className = 'sudden-record-wide-column sudden-record-wide-left';
        const right = document.createElement('div');
        right.className = 'sudden-record-wide-column sudden-record-wide-right';
        layout.append(left, right);

        const children = Array.from(form.children);
        let isRightSide = false;
        children.forEach(child => {
            if (child === startGroup) isRightSide = true;
            (isRightSide ? right : left).appendChild(child);
        });
        form.appendChild(layout);
        requestAnimationFrame(() => {
            form.querySelectorAll('.sudden-detail-textarea').forEach(textarea => this.autoResizeTextarea(textarea));
        });
    }

    autoResizeTextarea(textarea) {
        if (!textarea) return;
        if (!textarea.dataset.minHeight) {
            textarea.dataset.minHeight = String(textarea.offsetHeight || textarea.scrollHeight || 0);
        }
        const minHeight = Number(textarea.dataset.minHeight) || 0;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.max(minHeight, textarea.scrollHeight)}px`;
    }

    setupAutoResizeTextareas(selector) {
        document.querySelectorAll(selector).forEach(textarea => {
            textarea.style.overflowY = 'hidden';
            textarea.dataset.minHeight = String(textarea.offsetHeight || textarea.scrollHeight || 0);
            textarea.addEventListener('input', () => this.autoResizeTextarea(textarea));
            requestAnimationFrame(() => this.autoResizeTextarea(textarea));
        });
    }

    toggleNewMachineFields(value) {
        const fields = document.getElementById('s-new-machine-fields');
        if (value === 'NEW_MACHINE') {
            fields.style.display = 'grid';
            document.getElementById('s-new-name').required = true;
            document.getElementById('s-new-model').required = true;
        } else {
            fields.style.display = 'none';
            document.getElementById('s-new-name').required = false;
            document.getElementById('s-new-model').required = false;
        }
    }

    async removeSuggestion(kind, value, btnElement) {
        if (!store.activeData.archivedSuggestions) {
            store.activeData.archivedSuggestions = { errorNo: [], content: [], cause: [], notes: [], workers: [], partName: [], partModel: [] };
        }
        if (!store.activeData.archivedSuggestions[kind]) {
            store.activeData.archivedSuggestions[kind] = [];
        }
        if (!store.activeData.archivedSuggestions[kind].includes(value)) {
            store.activeData.archivedSuggestions[kind].push(value);
            await store.save(); // Store to IDB
        }
        if (btnElement) {
            btnElement.remove(); // Remove badge from display immediately
        }
    }

    addWorkerToInput(workerName, inputId) {
        const inp = document.getElementById(inputId);
        if (!inp) return;
        let current = inp.value.split(',').map(x => x.trim()).filter(Boolean);
        if (!current.includes(workerName)) {
            current.push(workerName);
        }
        inp.value = current.join(', ');
        inp.focus();
    }

    copyLastSuddenRecord(isEdit = false) {
        const prefix = isEdit ? 'e-' : 's-';
        const machineId = document.getElementById(`${prefix}machine-id`).value;
        if (!machineId || machineId === 'NEW_MACHINE') return;

        // Find latest history for this machine (prefer sudden records)
        const history = store.activeData.history
            .filter(h => h.machineId === machineId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastRecord = history.find(h => h.isSudden) || history[0];

        if (!lastRecord) return;

        // Populate fields
        if (lastRecord.lineNo) {
            const lineField = document.getElementById(`${prefix}line-no`);
            lineField.value = lastRecord.lineNo;
            this.markHistoryAssistCopiedField(lineField);
        }
        const contentField = document.getElementById(`${prefix}content`) || document.getElementById(`${prefix}symptom`);
        if (lastRecord.errorContent && contentField) {
            contentField.value = lastRecord.errorContent;
            this.markHistoryAssistCopiedField(contentField);
        }
        if (lastRecord.cause) {
            const causeField = document.getElementById(`${prefix}cause`);
            causeField.value = lastRecord.cause;
            this.markHistoryAssistCopiedField(causeField);
        }
        if (lastRecord.notes) {
            const notesField = document.getElementById(`${prefix}notes`);
            notesField.value = lastRecord.notes;
            this.markHistoryAssistCopiedField(notesField);
        }
        if (lastRecord.category) {
            const categoryField = document.getElementById(`${prefix}category`);
            categoryField.value = lastRecord.category;
            this.markHistoryAssistCopiedField(categoryField);
        }
        [contentField, document.getElementById(`${prefix}cause`), document.getElementById(`${prefix}notes`)]
            .forEach(textarea => this.autoResizeTextarea(textarea));
        
        // Auto-set as recurrence since it's a copy of past event
        const occRadio = document.querySelector(`input[name="${prefix}occurrence"][value="recurrence"]`);
        if (occRadio) occRadio.checked = true;
        
        if (lastRecord.workers) {
            const workersField = document.getElementById(`${prefix}workers`);
            workersField.value = lastRecord.workers.join(', ');
            this.markHistoryAssistCopiedField(workersField);
        }

        // Handle parts
        const partsContainer = document.getElementById(`${prefix}parts-container`);
        if (partsContainer && lastRecord.replacedParts && lastRecord.replacedParts.length > 0) {
            partsContainer.innerHTML = '';
            lastRecord.replacedParts.forEach(p => {
                this.addPartRow(p, true);
            });
        }
        
        // Highlight briefly to show it worked
        const form = document.getElementById(`${prefix}-form`);
        if (form) {
            form.style.background = '#f0f9ff';
            setTimeout(() => { form.style.background = 'transparent'; }, 500);
        }
    }

    markHistoryAssistCopiedField(field) {
        if (!field) return;
        field.classList.add('history-assist-copied-value');
        field.dataset.historyAssistCopied = 'true';
    }

    getRecurrenceExcludedIds() {
        try {
            const saved = JSON.parse(localStorage.getItem('recurrence_group_excluded_history_ids') || '[]');
            return new Set(Array.isArray(saved) ? saved.map(String) : []);
        } catch (_) {
            return new Set();
        }
    }

    saveRecurrenceExcludedIds(ids) {
        try {
            localStorage.setItem('recurrence_group_excluded_history_ids', JSON.stringify(Array.from(ids).map(String)));
        } catch (_) {}
    }

    excludeHistoryFromRecurrenceGroup(historyId = '', prefix = 's-', currentId = '') {
        if (!historyId) return;
        const excluded = this.getRecurrenceExcludedIds();
        excluded.add(String(historyId));
        this.saveRecurrenceExcludedIds(excluded);
        const machineId = document.getElementById(`${prefix}machine-id`)?.value || '';
        const symptom = (document.getElementById(`${prefix}content`) || document.getElementById(`${prefix}symptom`))?.value || '';
        const panel = document.getElementById(`${prefix}history-assist-panel`);
        if (panel) panel.innerHTML = this.getHistoryAssistHtml(prefix, machineId, symptom, currentId);
    }

    getRecurrenceGroupId(machineId = '', title = '') {
        const normalizedTitle = MaintenanceApp.toHalfWidthLower(String(title || '')).replace(/\s+/g, '_').replace(/[^\wぁ-んァ-ン一-龥ー#-]/g, '').slice(0, 48);
        return `rec:${machineId || 'unknown'}:${normalizedTitle || 'untitled'}`;
    }

    getHistoryAssistCandidates(machineId, symptomText = '', currentId = '') {
        if (!machineId || machineId === 'NEW_MACHINE') return { candidates: [], recurrence: null };
        const machines = store.getMachines(true);
        const machine = machines.find(m => String(m.id) === String(machineId));
        const excludedIds = this.getRecurrenceExcludedIds();
        const model = MaintenanceApp.toHalfWidthLower(machine?.model || '');
        const normalize = (value = '') => MaintenanceApp.toHalfWidthLower(String(value || '')).replace(/\s+/g, ' ').trim();
        const symptom = normalize(symptomText);
        const terms = symptom.split(/[、。・,.\s\[\]（）()]+/).filter(word => word.length >= 2);
        const troubleHistory = (store.activeData.history || [])
            .filter(h => String(h.id) !== String(currentId))
            .filter(h => !excludedIds.has(String(h.id)))
            .filter(h => !h.isManualGuide)
            .filter(h => !h.taskId || h.isDokatei || h.isNonProductionStop || h.isSudden)
            .map(h => {
                const m = machines.find(mm => String(mm.id) === String(h.machineId));
                const text = normalize(`${this.getHistoryDisplayText(h)} ${h.errorContent || ''} ${h.cause || ''} ${h.notes || ''} ${h.errorNo || ''}`);
                const sameMachine = String(h.machineId) === String(machineId);
                const sameModel = model && MaintenanceApp.toHalfWidthLower(m?.model || '') === model;
                let score = sameMachine ? 45 : (sameModel ? 24 : 0);
                if (symptom && normalize(this.getHistoryDisplayText(h)) === symptom) score += 50;
                if (symptom && text.includes(symptom)) score += 28;
                const hitCount = terms.filter(term => text.includes(term)).length;
                score += hitCount * 10;
                if (h.isFirstTime === false) score += 8;
                if (h.guide && !store.isGuideArchived?.(h.id)) score += 6;
                if (h.date) {
                    const days = (Date.now() - new Date(h.date).getTime()) / 86400000;
                    if (Number.isFinite(days) && days <= 90) score += 6;
                }
                return { history: h, machine: m, score, sameMachine, sameModel, hitCount };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score || (b.history.date || '').localeCompare(a.history.date || ''));

        const recurrenceSource = (symptom
            ? troubleHistory.filter(item => item.sameMachine && (normalize(this.getHistoryDisplayText(item.history)) === symptom || normalize(item.history.errorContent || '').includes(symptom) || item.hitCount > 0))
            : troubleHistory.filter(item => item.sameMachine)
        );
        const countByValue = (list) => list.reduce((acc, value) => {
            const key = String(value || '').trim();
            if (key) acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const mostFrequent = (list, fallback = '') => {
            const counts = countByValue(list);
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'ja'))[0];
            return top ? { value: top[0], count: top[1], total: list.filter(Boolean).length } : { value: fallback, count: fallback ? 1 : 0, total: fallback ? 1 : 0 };
        };
        const groupKeyFor = (history) => {
            const title = normalize(this.getHistoryDisplayText(history) || history.errorContent || '');
            if (!title) return normalize(`${history.cause || ''} ${history.notes || ''}`).slice(0, 36);
            const titleWords = title.split(/[、。・,.\s\[\]（）()]+/).filter(word => word.length >= 2);
            if (terms.length) {
                const hits = titleWords.filter(word => terms.some(term => word.includes(term) || term.includes(word)));
                if (hits.length) return hits.slice(0, 4).join(' ');
            }
            return title.replace(/[0-9０-９]+/g, '#').slice(0, 44);
        };
        const groups = Array.from(recurrenceSource.reduce((map, item) => {
            const key = groupKeyFor(item.history);
            if (!key) return map;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(item);
            return map;
        }, new Map()).values())
            .filter(group => group.length >= 2)
            .map(group => {
                const sorted = group.slice().sort((a, b) => (b.history.date || '').localeCompare(a.history.date || ''));
                const titles = group.map(item => this.getHistoryDisplayText(item.history) || item.history.errorContent || '').filter(Boolean);
                const notes = group.map(item => item.history.notes || '').filter(Boolean);
                const causes = group.map(item => item.history.cause || '').filter(Boolean);
                const avgScore = Math.round(group.reduce((sum, item) => sum + item.score, 0) / group.length);
                const strength = avgScore >= 90 ? 'strong' : (avgScore >= 65 ? 'medium' : 'weak');
                const strengthLabel = strength === 'strong' ? '強一致' : (strength === 'medium' ? '中一致' : '弱一致');
                return {
                    id: this.getRecurrenceGroupId(machineId, mostFrequent(titles, this.getHistoryDisplayText(sorted[0]?.history) || '').value),
                    items: sorted,
                    count: group.length,
                    latest: sorted[0],
                    first: sorted[sorted.length - 1],
                    totalTime: group.reduce((sum, item) => sum + (parseInt(item.history.workTime, 10) || 0), 0),
                    avgScore,
                    strength,
                    strengthLabel,
                    title: mostFrequent(titles, this.getHistoryDisplayText(sorted[0]?.history) || '').value,
                    titleStat: mostFrequent(titles, this.getHistoryDisplayText(sorted[0]?.history) || ''),
                    mostTreatment: mostFrequent(notes, sorted[0]?.history?.notes || ''),
                    mostCause: mostFrequent(causes, sorted[0]?.history?.cause || ''),
                    mostWorkTime: mostFrequent(group.map(item => item.history.workTime || '').filter(Boolean), sorted[0]?.history?.workTime || ''),
                    mostCategory: mostFrequent(group.map(item => item.history.category || '').filter(Boolean), sorted[0]?.history?.category || ''),
                    mostWorkers: mostFrequent(group.map(item => Array.isArray(item.history.workers) ? item.history.workers.join(', ') : '').filter(Boolean), Array.isArray(sorted[0]?.history?.workers) ? sorted[0].history.workers.join(', ') : '')
                };
            })
            .sort((a, b) => b.count - a.count || b.totalTime - a.totalTime || (b.latest?.history?.date || '').localeCompare(a.latest?.history?.date || ''));
        const topGroup = groups[0];
        const recurrence = topGroup ? { ...topGroup, groups } : null;

        return { candidates: troubleHistory.slice(0, 5), recurrence };
    }

    getHistoryAssistHtml(prefix, machineId, symptomText = '', currentId = '') {
        const { candidates, recurrence } = this.getHistoryAssistCandidates(machineId, symptomText, currentId);
        if (!machineId || machineId === 'NEW_MACHINE') return '';
        const hideRecurrence = prefix === 's-' && !!document.getElementById('s-is-single-maintenance')?.checked;
        const visibleRecurrence = hideRecurrence ? null : recurrence;
        if (!candidates.length && !visibleRecurrence) return '';
        const assistCollapsed = this.historyAssistCandidateCollapsed?.[prefix] !== false;
        const recurrenceCollapsed = this.historyRecurrenceCollapsed?.[prefix] !== false;
        const latest = visibleRecurrence?.latest?.history;
        const latestTreatment = latest?.notes || '';
        const latestCause = latest?.cause || '';
        const mostTreatment = visibleRecurrence?.mostTreatment?.value || '';
        const mostCause = visibleRecurrence?.mostCause?.value || '';
        const mostWorkTime = visibleRecurrence?.mostWorkTime?.value || '';
        const mostCategory = visibleRecurrence?.mostCategory?.value || '';
        const mostWorkers = visibleRecurrence?.mostWorkers?.value || '';
        const recurrenceTitle = visibleRecurrence ? (visibleRecurrence.title || this.getHistoryDisplayText(latest) || '内容なし') : '';
        return `
            <div class="history-assist-panel">
                ${visibleRecurrence ? `
                    <div class="history-recurrence-card ${visibleRecurrence.count >= 3 ? 'strong' : ''} ${recurrenceCollapsed ? 'is-collapsed' : ''}">
                        <div class="history-assist-head">
                            <span class="history-recurrence-head-main">
                                <span><i class="fa-solid fa-repeat"></i> 再発管理（最多内容）</span>
                                <span class="history-recurrence-head-summary" title="${this.escapeHtml(recurrenceTitle)}">
                                    <em class="${this.escapeHtml(visibleRecurrence.strength)}">${this.escapeHtml(visibleRecurrence.strengthLabel)} / ${visibleRecurrence.avgScore}点</em>
                                    <em class="latest">前回 ${this.escapeHtml(latest?.date || '-')}</em>
                                    <span>最多内容: ${this.escapeHtml(recurrenceTitle)}</span>
                                </span>
                            </span>
                            <div class="history-assist-head-actions">
                                <b>${visibleRecurrence.count}件 / 合計 ${visibleRecurrence.totalTime}分</b>
                                <button type="button" class="history-assist-toggle-btn history-recurrence-toggle-btn" data-history-recurrence-toggle aria-expanded="${recurrenceCollapsed ? 'false' : 'true'}" onclick="app.toggleHistoryRecurrenceCard('${this.escapeJs(prefix)}', event)">
                                    <i class="fa-solid fa-chevron-${recurrenceCollapsed ? 'down' : 'up'}"></i> ${recurrenceCollapsed ? '開く' : '閉じる'}
                                </button>
                            </div>
                        </div>
                        <input type="hidden" id="${this.escapeHtml(prefix)}recurrence-group-id" value="${this.escapeHtml(visibleRecurrence.id || '')}">
                        <input type="hidden" id="${this.escapeHtml(prefix)}recurrence-group-title" value="${this.escapeHtml(visibleRecurrence.title || '')}">
                        <div class="history-recurrence-collapsible">
                            <div class="history-recurrence-meta">
                                <span class="${this.escapeHtml(visibleRecurrence.strength)}">${this.escapeHtml(visibleRecurrence.strengthLabel)} / ${visibleRecurrence.avgScore}点</span>
                                <span>最多内容 ${visibleRecurrence.titleStat?.count || visibleRecurrence.count}/${visibleRecurrence.titleStat?.total || visibleRecurrence.count}件</span>
                                <span>最多原因 ${visibleRecurrence.mostCause?.count || 0}/${visibleRecurrence.mostCause?.total || visibleRecurrence.count}件</span>
                                <span>最多処置 ${visibleRecurrence.mostTreatment?.count || 0}/${visibleRecurrence.mostTreatment?.total || visibleRecurrence.count}件</span>
                            </div>
                            <div class="history-recurrence-title">
                                <strong>一番多い内容</strong>
                                ${this.escapeHtml(recurrenceTitle)}
                                ${visibleRecurrence.groups?.length > 1 ? `<small>他 ${visibleRecurrence.groups.length - 1}グループあり</small>` : ''}
                            </div>
                            <div class="history-recurrence-body">
                                <div>
                                    <strong>前回履歴</strong>
                                    ${this.escapeHtml(latest?.date || '-')} ${this.escapeHtml(this.getHistoryDisplayText(latest) || '内容なし')}
                                </div>
                                <div>
                                    <strong>前回処置</strong>
                                    ${this.escapeHtml(latestTreatment || '未入力')}
                                </div>
                                <div>
                                    <strong>最多原因</strong>
                                    ${this.escapeHtml(mostCause || '未入力')}
                                </div>
                                <div>
                                    <strong>最多処置</strong>
                                    ${this.escapeHtml(mostTreatment || '未入力')}
                                </div>
                            </div>
                            <details class="history-recurrence-details">
                                <summary><i class="fa-solid fa-list-ul"></i> この再発グループの内訳を見る</summary>
                                <div class="history-recurrence-list">
                                    ${visibleRecurrence.items.map(item => {
                                        const h = item.history;
                                        return `
                                            <button type="button" onclick="app.openHistoryEditForm('${this.escapeJs(h.id)}')">
                                                <b>${this.escapeHtml(h.date || '日付なし')} ${this.escapeHtml(this.getHistoryDisplayText(h) || '内容なし')}</b>
                                                <small>${parseInt(h.workTime, 10) || 0}分 / ${item.score}点 / ${this.escapeHtml(h.notes || '処置未入力')}</small>
                                            </button>
                                            <button type="button" class="exclude" onclick="app.excludeHistoryFromRecurrenceGroup('${this.escapeJs(h.id)}', '${this.escapeJs(prefix)}', '${this.escapeJs(currentId)}')">
                                                <i class="fa-solid fa-ban"></i> これは違う
                                            </button>
                                        `;
                                    }).join('')}
                                </div>
                            </details>
                            <div class="history-assist-actions">
                                <button type="button" class="secondary-btn" onclick="app.applyHistoryAssistCandidate('${this.escapeJs(latest?.id || '')}', '${this.escapeJs(prefix)}', 'recurrence')">
                                    <i class="fa-solid fa-clock-rotate-left"></i> 前回一式を使う
                                </button>
                                <button type="button" class="secondary-btn" onclick="app.applyHistoryAssistText('${this.escapeJs(mostCause)}', '${this.escapeJs(mostTreatment)}', '${this.escapeJs(prefix)}', 'most', { content: '${this.escapeJs(visibleRecurrence.title || '')}', workTime: '${this.escapeJs(mostWorkTime)}', category: '${this.escapeJs(mostCategory)}', workers: '${this.escapeJs(mostWorkers)}' })">
                                    <i class="fa-solid fa-ranking-star"></i> 最多一式を使う
                                </button>
                                <button type="button" class="secondary-btn" onclick="app.openHistoryEditForm('${this.escapeJs(latest?.id || '')}')">
                                    <i class="fa-solid fa-clock-rotate-left"></i> 前回を開く
                                </button>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${candidates.length ? `
                    <div class="history-assist-candidates ${assistCollapsed ? 'is-collapsed' : ''}">
                        <div class="history-assist-head">
                            <span><i class="fa-solid fa-wand-magic-sparkles"></i> 似た過去履歴から入力候補</span>
                            <div class="history-assist-head-actions">
                                <b>${candidates.length}件</b>
                                <button type="button" class="history-assist-toggle-btn" data-history-assist-toggle aria-expanded="${assistCollapsed ? 'false' : 'true'}" onclick="app.toggleHistoryAssistCandidates('${this.escapeJs(prefix)}', event)">
                                    <i class="fa-solid fa-chevron-${assistCollapsed ? 'down' : 'up'}"></i> ${assistCollapsed ? '開く' : '閉じる'}
                                </button>
                            </div>
                        </div>
                        <div class="history-assist-candidate-list">
                            ${candidates.map(item => {
                                const h = item.history;
                                return `
                                    <article class="history-assist-candidate">
                                        <div class="history-assist-candidate-main">
                                            <b>${this.escapeHtml(h.date || '日付なし')} ${this.escapeHtml(this.getHistoryDisplayText(h) || '内容なし')}</b>
                                            <small>${this.escapeHtml(item.machine?.name || '機械不明')}${item.machine?.model ? ` [${this.escapeHtml(item.machine.model)}]` : ''} / ${parseInt(h.workTime, 10) || 0}分</small>
                                            <div><span>原因</span>${this.escapeHtml(h.cause || '未入力')}</div>
                                            <div><span>処置</span>${this.escapeHtml(h.notes || '未入力')}</div>
                                        </div>
                                        <div class="history-assist-actions vertical">
                                            <button type="button" class="secondary-btn" onclick="app.applyHistoryAssistCandidate('${this.escapeJs(h.id)}', '${this.escapeJs(prefix)}', 'detail')">原因・処置</button>
                                            <button type="button" class="secondary-btn" onclick="app.applyHistoryAssistCandidate('${this.escapeJs(h.id)}', '${this.escapeJs(prefix)}', 'full')">一式反映</button>
                                        </div>
                                    </article>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    toggleHistoryRecurrenceCard(prefix = 's-', event = null) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const panel = document.getElementById(`${prefix}history-assist-panel`);
        const section = panel?.querySelector('.history-recurrence-card');
        if (!section) return;
        const nextCollapsed = !section.classList.contains('is-collapsed');
        this.historyRecurrenceCollapsed = this.historyRecurrenceCollapsed || {};
        this.historyRecurrenceCollapsed[prefix] = nextCollapsed;
        section.classList.toggle('is-collapsed', nextCollapsed);
        const toggleButton = section.querySelector('[data-history-recurrence-toggle]');
        if (toggleButton) {
            toggleButton.setAttribute('aria-expanded', String(!nextCollapsed));
            toggleButton.innerHTML = `<i class="fa-solid fa-chevron-${nextCollapsed ? 'down' : 'up'}"></i> ${nextCollapsed ? '開く' : '閉じる'}`;
        }
    }

    toggleHistoryAssistCandidates(prefix = 's-', event = null) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        const panel = document.getElementById(`${prefix}history-assist-panel`);
        const section = panel?.querySelector('.history-assist-candidates');
        if (!section) return;
        const nextCollapsed = !section.classList.contains('is-collapsed');
        this.historyAssistCandidateCollapsed = this.historyAssistCandidateCollapsed || {};
        this.historyAssistCandidateCollapsed[prefix] = nextCollapsed;
        section.classList.toggle('is-collapsed', nextCollapsed);
        const toggleButton = section.querySelector('[data-history-assist-toggle]');
        if (toggleButton) {
            toggleButton.setAttribute('aria-expanded', String(!nextCollapsed));
            toggleButton.innerHTML = `<i class="fa-solid fa-chevron-${nextCollapsed ? 'down' : 'up'}"></i> ${nextCollapsed ? '開く' : '閉じる'}`;
        }
    }

    updateHistorySmartAssist(prefix = 's-', isEdit = false, currentId = '') {
        const panel = document.getElementById(`${prefix}history-assist-panel`);
        if (!panel) return;
        const machineId = document.getElementById(`${prefix}machine-id`)?.value || '';
        const symptom = (document.getElementById(`${prefix}content`) || document.getElementById(`${prefix}symptom`))?.value || '';
        panel.innerHTML = this.getHistoryAssistHtml(prefix, machineId, symptom, currentId);
    }

    applyHistoryAssistCandidate(historyId = '', prefix = 's-', mode = 'detail') {
        const source = (store.activeData.history || []).find(h => String(h.id) === String(historyId));
        if (!source) return;
        const contentField = document.getElementById(`${prefix}content`) || document.getElementById(`${prefix}symptom`);
        const causeField = document.getElementById(`${prefix}cause`);
        const notesField = document.getElementById(`${prefix}notes`);
        const workTimeField = document.getElementById(`${prefix}work-time`);
        const categoryField = document.getElementById(`${prefix}category`);
        const workersField = document.getElementById(`${prefix}workers`);
        const sourceContent = this.getHistoryDisplayText(source) || source.errorContent || '';
        if ((mode === 'full' || mode === 'recurrence') && sourceContent && contentField) {
            contentField.value = sourceContent;
            this.markHistoryAssistCopiedField(contentField);
        }
        if (source.cause && causeField) {
            causeField.value = source.cause;
            this.markHistoryAssistCopiedField(causeField);
        }
        if (source.notes && notesField) {
            notesField.value = source.notes;
            this.markHistoryAssistCopiedField(notesField);
        }
        if ((mode === 'full' || mode === 'recurrence') && source.workTime && workTimeField && !workTimeField.value) {
            workTimeField.value = source.workTime;
            this.markHistoryAssistCopiedField(workTimeField);
        }
        if ((mode === 'full' || mode === 'recurrence') && source.category && categoryField && !categoryField.value) {
            categoryField.value = source.category;
            this.markHistoryAssistCopiedField(categoryField);
        }
        if ((mode === 'full' || mode === 'recurrence') && Array.isArray(source.workers) && source.workers.length && workersField && !workersField.value) {
            workersField.value = source.workers.join(', ');
            this.markHistoryAssistCopiedField(workersField);
        }
        const recurrenceRadio = document.querySelector(`input[name="${prefix}occurrence"][value="recurrence"]`);
        if (recurrenceRadio) recurrenceRadio.checked = true;
        [contentField, causeField, notesField].forEach(field => {
            this.autoResizeTextarea(field);
            field?.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const panel = document.getElementById(`${prefix}history-assist-panel`);
        const contentLabel = prefix === 'e-' ? 'メンテナンス項目' : '症状';
        this.showHistoryAssistAppliedNotice(prefix, mode === 'recurrence' ? [contentLabel, '原因', '処置', '作業時間', '対応区分', '作業者'] : (mode === 'full' ? [contentLabel, '原因', '処置', '作業時間', '対応区分', '作業者'] : ['原因', '処置']));
        panel?.classList.add('applied');
        setTimeout(() => panel?.classList.remove('applied'), 800);
    }

    applyHistoryAssistText(cause = '', notes = '', prefix = 's-', mode = 'most', extras = {}) {
        const contentField = document.getElementById(`${prefix}content`) || document.getElementById(`${prefix}symptom`);
        const causeField = document.getElementById(`${prefix}cause`);
        const notesField = document.getElementById(`${prefix}notes`);
        const workTimeField = document.getElementById(`${prefix}work-time`);
        const categoryField = document.getElementById(`${prefix}category`);
        const workersField = document.getElementById(`${prefix}workers`);
        if (extras?.content && contentField) {
            contentField.value = extras.content;
            this.markHistoryAssistCopiedField(contentField);
        }
        if (cause && causeField) {
            causeField.value = cause;
            this.markHistoryAssistCopiedField(causeField);
        }
        if (notes && notesField) {
            notesField.value = notes;
            this.markHistoryAssistCopiedField(notesField);
        }
        if (extras?.workTime && workTimeField && !workTimeField.value) {
            workTimeField.value = extras.workTime;
            this.markHistoryAssistCopiedField(workTimeField);
        }
        if (extras?.category && categoryField && !categoryField.value) {
            categoryField.value = extras.category;
            this.markHistoryAssistCopiedField(categoryField);
        }
        if (extras?.workers && workersField && !workersField.value) {
            workersField.value = extras.workers;
            this.markHistoryAssistCopiedField(workersField);
        }
        const recurrenceRadio = document.querySelector(`input[name="${prefix}occurrence"][value="recurrence"]`);
        if (recurrenceRadio) recurrenceRadio.checked = true;
        [contentField, causeField, notesField].forEach(field => {
            this.autoResizeTextarea(field);
            field?.dispatchEvent(new Event('input', { bubbles: true }));
        });
        const panel = document.getElementById(`${prefix}history-assist-panel`);
        const copied = [];
        if (extras?.content) copied.push(prefix === 'e-' ? 'メンテナンス項目' : '症状');
        if (cause) copied.push('原因');
        if (notes) copied.push('処置');
        if (extras?.workTime) copied.push('作業時間');
        if (extras?.category) copied.push('対応区分');
        if (extras?.workers) copied.push('作業者');
        this.showHistoryAssistAppliedNotice(prefix, copied);
        panel?.classList.add('applied');
        setTimeout(() => panel?.classList.remove('applied'), 800);
    }

    showHistoryAssistAppliedNotice(prefix = 's-', labels = []) {
        const panel = document.getElementById(`${prefix}history-assist-panel`);
        if (!panel || !labels.length) return;
        let notice = panel.querySelector('.history-assist-applied-notice');
        if (!notice) {
            notice = document.createElement('div');
            notice.className = 'history-assist-applied-notice';
            panel.prepend(notice);
        }
        notice.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${this.escapeHtml(labels.join('・'))}を反映しました`;
        notice.classList.add('show');
        clearTimeout(this._historyAssistNoticeTimer);
        this._historyAssistNoticeTimer = setTimeout(() => notice?.classList.remove('show'), 2600);
    }

    getCurrentRecurrenceMeta(prefix = 's-') {
        const isRecurrence = document.querySelector(`input[name="${prefix}occurrence"][value="recurrence"]`)?.checked;
        if (!isRecurrence) return null;
        const machineId = document.getElementById(`${prefix}machine-id`)?.value || '';
        const symptom = (document.getElementById(`${prefix}content`) || document.getElementById(`${prefix}symptom`))?.value || '';
        const groupId = document.getElementById(`${prefix}recurrence-group-id`)?.value || '';
        const title = document.getElementById(`${prefix}recurrence-group-title`)?.value || symptom || '再発グループ';
        return {
            groupId: groupId || this.getRecurrenceGroupId(machineId, title),
            title,
            linkedAt: new Date().toISOString()
        };
    }

    collectRecurrenceGroupSummaries() {
        const machines = store.getMachines(true);
        const groups = new Map();
        const addGroup = (group, machineId = '') => {
            if (!group?.id || !Array.isArray(group.items) || group.items.length < 1) return;
            const key = group.id;
            if (groups.has(key)) return;
            const histories = group.items.map(item => item.history || item).filter(Boolean);
            const latest = histories.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
            const dates = histories.map(h => h.date).filter(Boolean).sort();
            const firstDate = dates[0] || '';
            const latestDate = dates[dates.length - 1] || latest?.date || '';
            const firstMs = firstDate ? new Date(firstDate).getTime() : NaN;
            const latestMs = latestDate ? new Date(latestDate).getTime() : NaN;
            const spanDays = Number.isFinite(firstMs) && Number.isFinite(latestMs) ? Math.max(0, Math.round((latestMs - firstMs) / 86400000)) : 0;
            const avgIntervalDays = histories.length >= 2 ? Math.max(1, Math.round(spanDays / (histories.length - 1))) : null;
            const recent90Count = histories.filter(h => {
                const ms = h.date ? new Date(h.date).getTime() : NaN;
                return Number.isFinite(ms) && (Date.now() - ms) <= 90 * 86400000;
            }).length;
            const monthlyRate = spanDays > 0 ? (histories.length / Math.max(1, spanDays / 30)) : histories.length;
            const frequencyLabel = histories.length >= 2
                ? `約${avgIntervalDays}日に1回`
                : '単発';
            groups.set(key, {
                id: key,
                title: group.title || latest?.recurrenceGroup?.title || this.getHistoryDisplayText(latest) || '再発グループ',
                machineId: machineId || latest?.machineId || '',
                count: histories.length,
                firstDate,
                latestDate: latestDate || '',
                spanDays,
                avgIntervalDays,
                recent90Count,
                monthlyRate,
                frequencyLabel,
                latestId: latest?.id || '',
                latestTreatment: latest?.notes || '',
                totalTime: histories.reduce((sum, h) => sum + (parseInt(h.workTime, 10) || 0), 0),
                hasGuide: histories.some(h => h.guide && !store.isGuideArchived?.(h.id)),
                histories
            });
        };

        machines.forEach(machine => {
            const result = this.getHistoryAssistCandidates(machine.id, '');
            (result.recurrence?.groups || []).forEach(group => addGroup(group, machine.id));
        });

        const savedGroups = (store.activeData.history || []).reduce((map, h) => {
            if (!h.recurrenceGroup?.groupId) return map;
            const key = h.recurrenceGroup.groupId;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(h);
            return map;
        }, new Map());
        savedGroups.forEach((histories, key) => {
            if (histories.length < 1 || groups.has(key)) return;
            const latest = histories.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
            addGroup({
                id: key,
                title: latest?.recurrenceGroup?.title || this.getHistoryDisplayText(latest) || '再発グループ',
                items: histories
            }, latest?.machineId || '');
        });

        return Array.from(groups.values()).sort((a, b) => b.count - a.count || (b.latestDate || '').localeCompare(a.latestDate || ''));
    }

    openRecurrenceGroupsModal() {
        const groups = this.collectRecurrenceGroupSummaries();
        this.openModal('recurrence-groups', `再発グループ一覧 (${groups.length}件)`, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = groups.length ? `
                <div class="recurrence-group-list">
                    ${groups.map(group => {
                        const machine = store.getMachines(true).find(m => String(m.id) === String(group.machineId));
                        return `
                            <article class="recurrence-group-card">
                                <div class="recurrence-group-head">
                                    <h4>${this.escapeHtml(group.title)}</h4>
                                    <span>${group.count}件</span>
                                </div>
                                <div class="recurrence-group-meta">
                                    <span><i class="fa-solid fa-industry"></i> ${this.escapeHtml(machine?.name || '機械不明')}</span>
                                    <span><i class="fa-regular fa-calendar"></i> 最新 ${this.escapeHtml(group.latestDate || '-')}</span>
                                    <span class="frequency"><i class="fa-solid fa-chart-line"></i> ${this.escapeHtml(group.frequencyLabel)} / 直近90日 ${group.recent90Count}件</span>
                                    <span><i class="fa-regular fa-clock"></i> 合計 ${group.totalTime}分</span>
                                    <span class="${group.hasGuide ? 'has-guide' : 'no-guide'}"><i class="fa-solid fa-file-invoice"></i> ${group.hasGuide ? '手順書あり' : '手順書なし'}</span>
                                </div>
                                <div class="recurrence-group-frequency">
                                    <strong>発生頻度</strong>
                                    <b>${this.escapeHtml(group.frequencyLabel)}</b>
                                    <small>${group.count}件${group.firstDate && group.latestDate ? ` / ${this.escapeHtml(group.firstDate)} - ${this.escapeHtml(group.latestDate)}` : ''}${group.count >= 2 ? ` / 月換算 ${group.monthlyRate.toFixed(1)}件` : ''}</small>
                                </div>
                                <div class="recurrence-group-treatment">
                                    <strong>前回処置</strong>
                                    ${this.escapeHtml(group.latestTreatment || '未入力')}
                                </div>
                                <div class="recurrence-group-actions">
                                    <button type="button" class="secondary-btn" onclick="app.closeModal(); app.openHistoryEditForm('${this.escapeJs(group.latestId)}')">
                                        <i class="fa-solid fa-clock-rotate-left"></i> 最新履歴
                                    </button>
                                    <button type="button" class="secondary-btn" onclick="app.closeModal(); app.switchView('history'); document.getElementById('hist-filter-machine').value='${this.escapeJs(group.machineId)}'; app.renderHistory();">
                                        <i class="fa-solid fa-filter"></i> この機械で絞る
                                    </button>
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
            ` : `
                <div class="notebook-search-empty">
                    <i class="fa-solid fa-repeat"></i>
                    <div>再発グループはまだありません。</div>
                </div>
            `;
            document.getElementById('modal-save-btn')?.classList.add('hidden');
        });
    }

    onSuddenMachineChange(mId, isEdit = false) {
        if (!isEdit) this.toggleNewMachineFields(mId);
        this.updateRelatedGuides(mId); // Update Related Guides Qucik Access
        const prefix = isEdit ? 'e-' : 's-';
        const currentId = isEdit ? (document.getElementById('e-h-id')?.value || '') : '';
        this.updateHistorySmartAssist(prefix, isEdit, currentId);
        
        // Show/Hide "Copy Last Record" button
        const copySection = document.getElementById(`${prefix}copy-last-section`);
        if (copySection) {
            const hasHistory = store.activeData.history.some(h => h.machineId === mId);
            copySection.style.display = (mId && mId !== 'NEW_MACHINE' && hasHistory) ? 'block' : 'none';
        }

        if (!mId || mId === 'NEW_MACHINE') return;

        const machine = store.getMachines(true).find(m => m.id === mId);
        if (!machine) return;

        // Auto-inherit machine category: Prioritize Master, then fallback to last record
        let inheritCat = machine.category;
        if (!inheritCat) {
            const lastRec = (store.activeData.history || [])
                .filter(h => h.machineId === mId && h.machineCategory)
                .sort((a,b) => new Date(b.date) - new Date(a.date))[0];
            if (lastRec) inheritCat = lastRec.machineCategory;
        }
        
        if (inheritCat) {
            const catSelect = document.getElementById(`${prefix}machine-category`);
            if (catSelect) { 
                catSelect.value = inheritCat;
            }
        }

        // Auto-inherit lineNo
        if (machine.lineNo) {
            const lineSelect = document.getElementById(`${prefix}line-no`);
            if (lineSelect) {
                lineSelect.value = machine.lineNo;
            }
        }

        const model = MaintenanceApp.toHalfWidthLower(machine.model || '');
        const history = store.activeData.history || [];

        // Filter history for SAME model
        const modelHistory = history.filter(h => {
            const m = store.getMachines(true).find(mm => mm.id === h.machineId);
            return m && MaintenanceApp.toHalfWidthLower(m.model || '') === model;
        });

        const getUnique = (list, kind) => {
            const archived = (store.activeData.archivedSuggestions && store.activeData.archivedSuggestions[kind]) || [];
            return [...new Set(list)].filter(v => v !== undefined && v !== null && v !== '' && !archived.includes(v)).sort();
        };
        const countValues = (list) => list.reduce((acc, value) => {
            if (value !== undefined && value !== null && value !== '') acc[value] = (acc[value] || 0) + 1;
            return acc;
        }, {});

        const errorNos = getUnique(modelHistory.map(h => h.errorNo), 'errorNo');
        const contents = getUnique(modelHistory.map(h => h.errorContent), 'content');
        const causes = getUnique(modelHistory.map(h => h.cause), 'cause');
        const treatments = getUnique(modelHistory.map(h => h.notes), 'notes');

        const inject = (id, vals, targetId, counts = {}) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (vals.length === 0) {
                el.innerHTML = '';
                return;
            }
            const rankedVals = vals.slice().sort((a, b) => (counts[b] || 0) - (counts[a] || 0) || String(a).localeCompare(String(b), 'ja'));
            if (id.includes('suggestions')) {
                // Badge style
                const kind = targetId.replace(/^[se]-/, '').replace(/-([a-z])/g, g => g[1].toUpperCase()); // e.g. "error-no" -> "errorNo"
                el.innerHTML = `
                    <div style="font-size:0.65rem; color:var(--text-light); margin:6px 0 4px 0; font-weight:700;">
                        <i class="fa-solid fa-clock-rotate-left"></i> 過去の記録 (同一型式):
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:4px;">
                        ${rankedVals.slice(0, 10).map(v => `
                            <div class="suggestion-badge" style="display:inline-flex; align-items:stretch; padding:0; overflow:hidden;">
                                <button type="button" style="background:none; border:none; padding:4px 8px; font-size:inherit; color:inherit; cursor:pointer;" onclick="const t=document.getElementById('${targetId}'); t.value='${v.replace(/'/g, "\\'")}'; app.markHistoryAssistCopiedField(t); app.autoResizeTextarea(t); t.dispatchEvent(new Event('input', { bubbles: true })); t.focus();">
                                    ${String(v).replace(/</g, "&lt;")}
                                    ${counts[v] ? `<span class="suggestion-count">過去${counts[v]}件</span>` : ''}
                                </button>
                                <button type="button" style="background:none; border:none; border-left:1px solid rgba(0,0,0,0.1); padding:0 6px; color:#94a3b8; cursor:pointer;" onclick="app.removeSuggestion('${kind}', '${v.replace(/'/g, "\\'")}', this.parentElement)" title="今後サジェストしない">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                // Datalist style
                el.innerHTML = rankedVals.map(v => `<option value="${v}">`).join('');
            }
        };

        const symptomTargetId = isEdit ? `${prefix}symptom` : `${prefix}content`;
        const normalizeText = (value = '') => MaintenanceApp.toHalfWidthLower(String(value || '')).replace(/\s+/g, ' ').trim();
        const keywordHit = (source, query) => {
            const normalizedSource = normalizeText(source);
            const normalizedQuery = normalizeText(query);
            if (!normalizedQuery) return true;
            if (normalizedSource.includes(normalizedQuery)) return true;
            return normalizedQuery
                .split(/[、。・,.\s]+/)
                .filter(word => word.length >= 2)
                .some(word => normalizedSource.includes(word));
        };
        const refreshLinkedSuggestions = () => {
            const symptomValue = document.getElementById(symptomTargetId)?.value || '';
            const causeValue = document.getElementById(`${prefix}cause`)?.value || '';
            this.updateHistorySmartAssist(prefix, isEdit, currentId);
            const symptomMatchedHistory = modelHistory.filter(h => keywordHit(h.errorContent, symptomValue) || keywordHit(`${h.cause || ''} ${h.notes || ''}`, symptomValue));
            const causeSource = symptomValue.trim() ? symptomMatchedHistory : modelHistory;
            const treatmentSource = (causeValue.trim()
                ? causeSource.filter(h => keywordHit(h.cause, causeValue) || keywordHit(h.notes, causeValue))
                : causeSource);
            inject(`${prefix}cause-suggestions`, getUnique(causeSource.map(h => h.cause), 'cause'), `${prefix}cause`, countValues(causeSource.map(h => h.cause)));
            inject(`${prefix}notes-suggestions`, getUnique(treatmentSource.map(h => h.notes), 'notes'), `${prefix}notes`, countValues(treatmentSource.map(h => h.notes)));
            inject(`${prefix}list-model-causes`, getUnique(causeSource.map(h => h.cause), 'cause'), undefined, countValues(causeSource.map(h => h.cause)));
            inject(`${prefix}list-model-treatments`, getUnique(treatmentSource.map(h => h.notes), 'notes'), undefined, countValues(treatmentSource.map(h => h.notes)));
        };

        inject(`${prefix}error-no-suggestions`, errorNos, `${prefix}error-no`, countValues(modelHistory.map(h => h.errorNo)));
        inject(`${prefix}content-suggestions`, contents, symptomTargetId, countValues(modelHistory.map(h => h.errorContent)));
        inject(`${prefix}cause-suggestions`, causes, `${prefix}cause`, countValues(modelHistory.map(h => h.cause)));
        inject(`${prefix}notes-suggestions`, treatments, `${prefix}notes`, countValues(modelHistory.map(h => h.notes)));

        // Also update datalists
        inject(`${prefix}list-model-error-nos`, errorNos, undefined, countValues(modelHistory.map(h => h.errorNo)));
        inject(`${prefix}list-model-contents`, contents, undefined, countValues(modelHistory.map(h => h.errorContent)));
        inject(`${prefix}list-model-causes`, causes, undefined, countValues(modelHistory.map(h => h.cause)));
        inject(`${prefix}list-model-treatments`, treatments, undefined, countValues(modelHistory.map(h => h.notes)));

        [document.getElementById(symptomTargetId), document.getElementById(`${prefix}cause`)].forEach(input => {
            if (!input) return;
            input.oninput = () => {
                this.autoResizeTextarea(input);
                refreshLinkedSuggestions();
            };
        });
        refreshLinkedSuggestions();
    }



    openCompletionForm(taskId, dateStr) {
        const task = store.activeData.tasks.find(t => t.id === taskId);
        const machine = store.getMachines(true).find(m => m.id === task.machineId);
        const isOneOffTask = (parseInt(task?.periodDays) || 0) <= 0;

        // Find last parts for this specific task to auto-copy
        // First try: exact taskId match with parts
        let lastRecord = store.activeData.history
            .filter(h => h.taskId != null && String(h.taskId) === String(taskId) && h.replacedParts && h.replacedParts.length > 0)
            .sort((a,b) => new Date(b.date) - new Date(a.date))[0];
        const isDoneBefore = store.activeData.history.some(h => h.taskId != null && String(h.taskId) === String(taskId));
        // Fallback: same machine + same task content (in case taskId differs)
        if (!lastRecord && task) {
            lastRecord = store.activeData.history
                .filter(h => h.machineId === task.machineId && h.replacedParts && h.replacedParts.length > 0)
                .sort((a,b) => new Date(b.date) - new Date(a.date))[0];
        }
        const lastParts = (lastRecord && lastRecord.replacedParts) ? lastRecord.replacedParts : [];
        
        // Find latest machine category for this machine to inherit
        const lastMachineCategoryRecord = store.activeData.history
            .filter(h => h.machineId === task.machineId && h.machineCategory)
            .sort((a,b) => new Date(b.date) - new Date(a.date))[0];
        const lastMachineCategory = lastMachineCategoryRecord ? lastMachineCategoryRecord.machineCategory : '';

        this.openModal('complete', `メンテナンス完了報告`, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <form id="complete-form">
                    <input type="hidden" id="c-task-id" value="${taskId}">
                    <input type="hidden" id="c-machine-id" value="${task.machineId}">

                    <div class="form-group" style="background:#f1f5f9; padding:12px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:15px;">
                        <label style="font-weight:900; color:#475569;"><i class="fa-solid fa-list-ol"></i> 実施ライン番号 <span style="color:var(--danger)">*</span></label>
                        <select id="c-line-no" required style="height:44px; font-weight:900; color:var(--primary); font-size:1rem; border:2px solid var(--primary);">
                            <option value="">-- ラインを選択してください --</option>
                            ${this.generateLineOptionsHTML(machine?.lineNo || '')}
                        </select>
                    </div>

                    <div style="padding:12px; background:var(--primary-light); border-radius:8px; margin-bottom:20px;">
                        <div style="font-size:0.75rem; color:var(--primary); font-weight:800;">対象</div>
                        <div style="font-weight:900; font-size:1.1rem;">${machine?.name}</div>
                        <div style="font-weight:700; color:var(--text-light);">${task.content}</div>
                    </div>
                    ${isOneOffTask ? `
                        <div class="one-off-completion-note">
                            <i class="fa-solid fa-calendar-check"></i>
                            <span>この予定は単発です。完了後は未完了予定としてカレンダーに再表示されません。</span>
                        </div>
                    ` : ''}

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>実施日 <span style="color:var(--danger)">*</span></label>
                            <input type="date" id="c-date" value="${dateStr}" required>
                        </div>
                        <div class="form-group">
                            <label>作業時間 (分) <span style="color:var(--danger)">*</span></label>
                            <input type="number" id="c-work-time" placeholder="例: 30" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>装置区分 (例: 包装機, 充填機) <span style="color:var(--danger)">*</span></label>
                        <select id="c-machine-category" onchange="app.toggleNewCategoryField('c-')" required style="height:44px;">
                            <option value="">-- 選択してください --</option>
                            ${this.getMachineCategoryOptions(lastMachineCategory || machine?.category || '')}
                        </select>
                        <input type="text" id="c-new-category-input" placeholder="新しい装置区分名を入力" style="display:none; margin-top:8px; border:2px solid var(--primary); padding:8px;" onblur="this.value = MaintenanceApp.toFullWidthUpper(this.value)">
                    </div>

                    <div class="form-group">
                        <label>対応区分 (集計用セレクト) <span style="color:var(--danger)">*</span></label>
                        <select id="c-category" required>
                            <option value="">-- 選択してください --</option>
                            <option value="machine">機械修理</option>
                            <option value="electric">電気系修理</option>
                            <option value="adjust">調整・設定変更</option>
                            <option value="parts">部品交換</option>
                            <option value="clean">清掃・給油</option>
                            <option value="other">その他</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>作業報告・備考</label>
                        <textarea id="c-notes" rows="2" placeholder="特記事項があれば記入"></textarea>
                    </div>

                    <div class="form-group">
                        <label>作業者 (カンマ区切り) <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="c-workers" placeholder="例: 田中, 鈴木" list="list-workers" style="border:2px solid var(--primary);" required>
                    </div>

                    <div class="form-group">
                        <label>対応種別 <span style="font-size:0.7rem; color:var(--text-light); font-weight:400;">※「初回」のみスキルマップの集計対象になります</span></label>
                        <div style="display:flex; gap:16px; background:var(--background); padding:10px; border-radius:8px; border:1px solid var(--border);">
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" name="c-occurrence" value="first" ${!isDoneBefore ? 'checked' : ''} style="width:auto;"> <span style="font-weight:800; color:var(--primary);">初回対応 (技術習得)</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" name="c-occurrence" value="recurrence" ${isDoneBefore ? 'checked' : ''} style="width:auto;"> <span style="font-weight:800; color:var(--text-light);">再発・繰り返し</span>
                            </label>
                        </div>
                    </div>

                     <div style="margin-top: 24px; border-top: 2px solid #94a3b8; padding-top: 16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <label style="font-size:0.85rem; font-weight:700;">使用部品・グリス等</label>
                            <button type="button" class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.addPartRow(null, true)"><i class="fa-solid fa-plus"></i> 追加</button>
                        </div>
                        <div id="s-parts-container" style="display:flex; flex-direction:column; gap:8px;"></div>
                        ${lastParts.length > 0 ? `
                            <div style="font-size:0.65rem; color:var(--primary); margin-top:8px; font-weight:700;">
                                <i class="fa-solid fa-circle-info"></i> 前回の使用部品を自動コピーしました
                            </div>
                        ` : ''}
                    </div>
                </form>
            `;

            // Auto-fill last parts
            if (lastParts.length > 0) {
                lastParts.forEach(p => this.addPartRow(p, true));
            }

            if ((parseInt(task.periodDays) || 0) <= 0) {
                const footer = document.querySelector('.modal-footer');
                if (footer) {
                    footer.insertAdjacentHTML('afterbegin', `
                        <button type="button" class="danger-btn" style="margin-right:auto" onclick="app.deleteOneOffMaintenanceFromCompletion('${task.id}', '${task.content.replace(/'/g, "\\'")}')">
                            <i class="fa-solid fa-trash-can"></i> この予定を削除
                        </button>
                    `);
                }
            }
        });
    }

    deleteOneOffMaintenanceFromCompletion(taskId, content) {
        if (!confirm(`1回きりの定期メンテ「${content}」をカレンダーから削除しますか？\nこの予定は未完了のまま取り消されます。`)) return;

        store.freezeTaskContentInHistory(taskId);
        store.activeData.tasks = (store.activeData.tasks || []).filter(t => String(t.id) !== String(taskId));
        store.save();
        this.closeModal();
        this.renderCalendar();
        this.renderMachines();
    }

    openModal(type, title, renderFn) {
        const overlay = document.getElementById('modal-overlay');
        const container = document.getElementById('modal-container');
        container.dataset.modalType = type;
        container.className = 'modal-container';
        
        container.innerHTML = `
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close-btn" onclick="app.closeModal()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body" id="modal-content"></div>
            <div class="modal-footer">
                <button class="secondary-btn" onclick="app.closeModal()">キャンセル</button>
                <button class="primary-btn" id="modal-save-btn">保存する</button>
            </div>
        `;
        
        if (renderFn) renderFn();
        this.injectUnifiedSearchReturnButton?.();

        const saveBtn = document.getElementById('modal-save-btn');
        if (saveBtn) saveBtn.onclick = () => this.saveModalData(type);
        
        // Photo listener for modals
        if (type === 'sudden' || type === 'edit-history') {
            this.setupHistoryPhotoInput(type);
        } else if (type === 'machine' || type === 'part-master') {
            const isPart = (type === 'part-master');
            const photoInput = document.getElementById(isPart ? 'pm-photo' : 'f-machine-photo');
            const photoHidden = document.getElementById(isPart ? 'pm-photo-base64' : 'f-machine-photo-base64');
            const preview = document.getElementById(isPart ? 'pm-photo-preview' : 'f-machine-photo-preview');
            if (photoInput && photoHidden && preview) {
                photoInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const base64 = await MaintenanceStore.resizeImage(file, 400); // Small square profile
                        photoHidden.value = base64;
                        preview.innerHTML = `<img src="${base64}" style="width:100%; height:100%; object-fit:cover;">`;
                        const rotateBtn = photoInput.parentElement.querySelector('.f-rotate-btn');
                        if (rotateBtn) rotateBtn.style.display = 'inline-block';
                        const deleteBtn = photoInput.parentElement.querySelector('.f-delete-photo-btn');
                        if (deleteBtn) deleteBtn.style.display = 'inline-block';
                    }
                });
            }
        }

        overlay.classList.remove('hidden');
    }

    setupHistoryPhotoInput(type) {
        const isSudden = type === 'sudden';
        const photoInput = document.getElementById(isSudden ? 's-photos' : 'e-photos');
        const preview = document.getElementById(isSudden ? 's-photo-previews' : 'e-photo-previews');
        if (!photoInput || !preview || photoInput.dataset.historyPhotoReady === '1') return;

        if (isSudden) {
            this._tempPhotos = [];
            preview.innerHTML = '';
        }

        photoInput.dataset.historyPhotoReady = '1';
        photoInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;
            if (!this._tempPhotos) this._tempPhotos = [];

            photoInput.disabled = true;
            const previousLabel = photoInput.dataset.loadingLabel || '';
            photoInput.dataset.loadingLabel = '写真を読み込み中...';

            try {
                for (const file of files) {
                    if (!file.type?.startsWith('image/')) continue;
                    const src = await MaintenanceStore.readImageAsDataUrl(file);
                    const item = this.collectPhotoManagerItems?.().find(photo => photo?.src === src) || this.addPhotoManagerLibraryImage?.(src, file.name || '突発対応添付');
                    const photo = item ? this.createHistoryPhotoReference(item) : src;
                    this._tempPhotos.push(photo);
                    this.appendHistoryPhotoPreview(preview, photo, 80);
                }
                store.save();
            } catch (err) {
                console.error('History photo attach failed', err);
                alert('写真の添付に失敗しました。別の画像で試すか、画像を小さくしてから添付してください。');
            } finally {
                photoInput.disabled = false;
                photoInput.dataset.loadingLabel = previousLabel;
                e.target.value = '';
            }
        });
    }

    createPhotoPreviewElement(base64, onRemove, onRotate, size = 80) {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.display = 'inline-block';
        div.innerHTML = `
            <div class="img-box" style="display:inline-flex; align-items:center; justify-content:center; min-width:${size}px; max-width:${Math.round(size * 2.2)}px; max-height:${size}px; border-radius:4px; overflow:hidden; background:#f8fafc; border:1px solid #e2e8f0;">
                <img src="${base64}" style="display:block; width:auto; height:auto; max-width:${Math.round(size * 2.2)}px; max-height:${size}px; object-fit:contain;">
            </div>
            <button type="button" class="rotate-btn" style="position:absolute; bottom:0; right:0; background:rgba(0,0,0,0.6); color:white; border:none; padding:2px 4px; font-size:12px; cursor:pointer; border-radius:2px;" title="回転"><i class="fa-solid fa-rotate-right"></i></button>
            <button type="button" class="close-btn" style="position:absolute; top:-5px; right:-5px; background:white; padding:2px; font-size:12px; z-index:1000; cursor:pointer;" title="削除">×</button>
        `;
        
        let currentBase64 = base64; // Keep internal reference for exact string matching

        div.querySelector('.rotate-btn').onclick = async (e) => {
            e.stopPropagation();
            try {
                const img = div.querySelector('img');
                const rotated = await MaintenanceStore.rotateImageBase64(currentBase64, 90);
                const oldSrc = currentBase64;
                currentBase64 = rotated;
                img.src = rotated;
                if (onRotate) onRotate(oldSrc, rotated);
            } catch(err) { console.error('Rotate failed', err); }
        };

        div.querySelector('.close-btn').onclick = (e) => {
            e.stopPropagation();
            if (onRemove) onRemove(currentBase64);
            div.remove();
        };

        return div;
    }

    getPhotoManagerItemById(id = '') {
        const targetId = String(id || '');
        if (!targetId || typeof this.collectPhotoManagerItems !== 'function') return null;
        return this.collectPhotoManagerItems().find(item => String(item.id || '') === targetId) || null;
    }

    createHistoryPhotoReference(item = {}) {
        const libraryRef = this.createPhotoManagerImageReference?.(item);
        if (libraryRef) return libraryRef;
        if (!item?.id) return null;
        return {
            source: 'photoManager',
            id: item.id,
            name: this.getPhotoManagerName?.(item) || item.defaultName || item.title || item.name || ''
        };
    }

    getHistoryPhotoSrc(photo) {
        if (!photo) return '';
        if (typeof photo === 'string') return photo;
        if (photo.src) return photo.src;
        const id = photo.id || photo.photoManagerId;
        if (photo.source === 'photoManager' || photo.photoManagerId) {
            return this.getPhotoManagerLibraryReferenceById?.(id)?.photo?.src
                || this.getPhotoManagerItemById(id)?.src
                || '';
        }
        return '';
    }

    getResolvedHistoryPhotoSources(photos = []) {
        return (photos || [])
            .map(photo => this.getHistoryPhotoSrc?.(photo) || '')
            .filter(Boolean);
    }

    getHistoryPhotosForSave() {
        return (this._tempPhotos || []).filter(photo => {
            if (typeof photo === 'string') return !!photo;
            if (!photo || typeof photo !== 'object') return false;
            if (photo.source === 'photoManagerVideo' && photo.videoId) return true;
            if (photo.source === 'photoManager' && photo.id) return true;
            if (photo.photoManagerId) return true;
            return !!photo.src;
        });
    }

    appendHistoryPhotoPreview(preview, photo, size = 80) {
        if (!preview) return;
        if (photo?.source === 'photoManagerVideo' && photo?.videoId) {
            const entry = photo;
            const div = this.createRegisteredVideoAttachmentPreview?.(photo, () => {
                this._tempPhotos = (this._tempPhotos || []).filter(p => p !== entry);
                this.updateSaveStatus?.('dirty');
            }, size);
            if (div) preview.appendChild(div);
            return;
        }
        const src = this.getHistoryPhotoSrc(photo);
        if (!src) return;
        const entry = photo;
        const div = this.createPhotoPreviewElement(
            src,
            () => { this._tempPhotos = (this._tempPhotos || []).filter(p => p !== entry); },
            (_oldSrc, newSrc) => {
                if (entry && typeof entry === 'object' && (entry.source === 'photoManager' || entry.photoManagerId)) {
                    const item = this.getPhotoManagerItemById(entry.id || entry.photoManagerId);
                    if (item?.replacePhoto) {
                        item.replacePhoto(newSrc);
                        store.save();
                        return;
                    }
                }
                const index = (this._tempPhotos || []).indexOf(entry);
                if (index >= 0) this._tempPhotos[index] = newSrc;
            },
            size
        );
        preview.appendChild(div);
    }

    normalizeGuidePhoto(photo) {
        if (typeof photo === 'string') return { src: photo, marks: [] };
        if (photo?.source === 'photoManagerVideo' || photo?.videoId) {
            const videoId = String(photo.videoId || photo.id || '');
            const video = this.getPhotoManagerVideo?.(videoId);
            return {
                src: '',
                source: 'photoManagerVideo',
                videoId,
                name: photo?.name || video?.name || video?.fileName || '動画',
                thumbnailUrl: video?.thumbnailUrl || photo?.thumbnailUrl || '',
                marks: [],
                printSize: 72
            };
        }
        return {
            src: photo?.src || photo?.url || photo?.data || '',
            marks: Array.isArray(photo?.marks) ? photo.marks : [],
            printSize: Math.max(20, Math.min(100, Number(photo?.printSize) || 72))
        };
    }

    getGuidePhotoSrc(photo) {
        return this.normalizeGuidePhoto(photo).src;
    }

    getGuideImageCompressionPreset() {
        const saved = localStorage.getItem('guide_image_compression_preset') || 'standard';
        return ['light', 'standard', 'high'].includes(saved) ? saved : 'standard';
    }

    getGuideImageCompressionPresetOptions() {
        return {
            light: { key: 'light', label: '軽量', maxEdge: 1280, quality: 0.78 },
            standard: { key: 'standard', label: '標準', maxEdge: 1600, quality: 0.82 },
            high: { key: 'high', label: '高画質', maxEdge: 2000, quality: 0.88 }
        };
    }

    setGuideImageCompressionPreset(preset = 'standard') {
        const options = this.getGuideImageCompressionPresetOptions();
        const key = options[preset] ? preset : 'standard';
        localStorage.setItem('guide_image_compression_preset', key);
        this.updateGuideImageCompressionPresetControls?.();
    }

    getGuideImageCompressionOptions() {
        const presets = this.getGuideImageCompressionPresetOptions();
        return presets[this.getGuideImageCompressionPreset()] || presets.standard;
    }

    estimateGuideImageDataUrlBytes(src = '') {
        return store.estimateDataUrlBytes?.(src) || Math.round(String(src || '').length * 0.75);
    }

    async compressGuideImageDataUrl(src = '', options = this.getGuideImageCompressionOptions()) {
        if (!store.isImageDataUrl?.(src)) return { src, changed: false, beforeBytes: 0, afterBytes: 0 };
        const beforeBytes = this.estimateGuideImageDataUrlBytes(src);
        const img = new Image();
        const loaded = new Promise(resolve => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
        });
        img.src = src;
        if (!await loaded) return { src, changed: false, beforeBytes, afterBytes: beforeBytes };
        const width = img.naturalWidth || img.width || 1;
        const height = img.naturalHeight || img.height || 1;
        const maxEdge = Math.max(320, Number(options.maxEdge) || 1600);
        const scale = Math.min(1, maxEdge / Math.max(width, height));
        const nextWidth = Math.max(1, Math.round(width * scale));
        const nextHeight = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const hasAlpha = MaintenanceStore.canvasHasTransparency?.(ctx, canvas.width, canvas.height);
        const compressed = hasAlpha
            ? canvas.toDataURL('image/png')
            : canvas.toDataURL('image/jpeg', Math.max(0.5, Math.min(0.95, Number(options.quality) || 0.82)));
        const afterBytes = this.estimateGuideImageDataUrlBytes(compressed);
        if (afterBytes >= beforeBytes && scale >= 1) return { src, changed: false, beforeBytes, afterBytes: beforeBytes };
        return { src: afterBytes < beforeBytes ? compressed : src, changed: afterBytes < beforeBytes, beforeBytes, afterBytes: Math.min(afterBytes, beforeBytes) };
    }

    async prepareGuidePhotoFromFile(file) {
        const src = await MaintenanceStore.readImageAsDataUrl(file);
        const result = await this.compressGuideImageDataUrl(src);
        return {
            photo: { src: result.src, marks: [], printSize: 72 },
            beforeBytes: result.beforeBytes,
            afterBytes: result.afterBytes,
            changed: result.changed
        };
    }

    showGuideImageCompressionNotice(results = []) {
        const savedBytes = results.reduce((sum, result) => sum + Math.max(0, (result.beforeBytes || 0) - (result.afterBytes || 0)), 0);
        if (savedBytes > 0) {
            this.showToast?.(`手順書画像を約${this.formatExportBytes?.(savedBytes) || savedBytes + 'B'}軽量化しました`, 'success');
        }
    }

    getGuideImageCompressionPresetHtml() {
        const active = this.getGuideImageCompressionPreset();
        const presets = Object.values(this.getGuideImageCompressionPresetOptions());
        return `
            <div class="guide-compress-preset" data-guide-compress-preset>
                ${presets.map(preset => `
                    <button type="button" class="${active === preset.key ? 'active' : ''}" onclick="app.setGuideImageCompressionPreset('${preset.key}')">
                        <b>${this.escapeHtml(preset.label)}</b>
                        <span>長辺${preset.maxEdge}px</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    updateGuideImageCompressionPresetControls() {
        const active = this.getGuideImageCompressionPreset();
        document.querySelectorAll('[data-guide-compress-preset] button').forEach(button => {
            button.classList.toggle('active', button.getAttribute('onclick')?.includes(`'${active}'`));
        });
    }

    async renderGuidePhotoPreviews() {
        const previewContainer = document.getElementById('g-photo-previews');
        if (!previewContainer) return;
        this._tempPhotos = (this._tempPhotos || []).map(photo => this.normalizeGuidePhoto(photo)).filter(photo => photo.src || photo.videoId);
        previewContainer.innerHTML = '';
        if (this._tempPhotos.length > 1) {
            const alignPanel = document.createElement('label');
            alignPanel.className = 'guide-photo-align-height';
            alignPanel.innerHTML = `
                <input type="checkbox" ${this._guidePhotoHeightsAligned ? 'checked' : ''} onchange="app.alignGuidePhotoPrintHeights(this.checked)">
                <span>高さをそろえる</span>
            `;
            previewContainer.appendChild(alignPanel);
        }
        this._tempPhotos.forEach((photo, index) => {
            if (photo.source === 'photoManagerVideo' && photo.videoId) {
                const videoDiv = this.createRegisteredVideoAttachmentPreview?.(photo, () => {
                    this._tempPhotos.splice(index, 1);
                    this.autoSaveGuideDraftFromModal();
                    this.renderGuidePhotoPreviews();
                }, 100);
                if (videoDiv) {
                    videoDiv.classList.add('guide-photo-item', 'guide-video-item');
                    videoDiv.dataset.guidePhotoIndex = String(index);
                    previewContainer.appendChild(videoDiv);
                }
                return;
            }
            const div = document.createElement('div');
            div.className = `guide-photo-item${photo.marks?.length ? ' has-photo-marks' : ''}`;
            div.dataset.guidePhotoIndex = String(index);
            div.dataset.shiftPhotoMarks = JSON.stringify(photo.marks || []);
            div.style.position = 'relative';
            div.style.display = 'inline-block';
            div.innerHTML = `
                <div class="img-box" style="width:100px; height:100px; border-radius:4px; overflow:hidden;" title="クリックして記号編集">
                    <img src="${photo.src}" style="width:100%; height:100%; object-fit:contain; background:#f8fafc;">
                    <span class="shift-photo-mark-badge"><i class="fa-solid fa-pen"></i></span>
                </div>
                <label class="guide-photo-size-control">
                    <span>印刷</span>
                    <input type="number" min="20" max="100" step="5" value="${photo.printSize}">
                    <b>%</b>
                </label>
                <small class="guide-photo-byte-size">${this.formatExportBytes?.(this.estimateGuideImageDataUrlBytes(photo.src)) || this.estimateGuideImageDataUrlBytes(photo.src) + 'B'}</small>
                <button type="button" class="guide-photo-insert-btn" title="本文に [[写真${index + 1}]] を挿入">[[写真${index + 1}]]</button>
                <button type="button" class="rotate-btn" style="position:absolute; bottom:0; right:0; background:rgba(0,0,0,0.6); color:white; border:none; padding:2px 4px; font-size:12px; cursor:pointer; border-radius:2px;" title="回転"><i class="fa-solid fa-rotate-right"></i></button>
                <button type="button" class="close-btn" style="position:absolute; top:-5px; right:-5px; background:white; padding:2px; font-size:12px; z-index:1000; cursor:pointer;" title="削除">×</button>
            `;
            const previewImg = div.querySelector('.img-box img');
            if (photo.marks?.length && typeof this.getGuidePrintablePhotoSrc === 'function') {
                this.getGuidePrintablePhotoSrc(photo).then(src => {
                    if (src && previewImg) previewImg.src = src;
                });
            }
            div.querySelector('.guide-photo-size-control input').oninput = (e) => {
                this._guidePhotoHeightsAligned = false;
                const alignInput = document.querySelector('.guide-photo-align-height input');
                if (alignInput) alignInput.checked = false;
                const current = this.normalizeGuidePhoto(this._tempPhotos[index]);
                current.printSize = Math.max(20, Math.min(100, Number(e.target.value) || 72));
                this._tempPhotos[index] = current;
                this.autoSaveGuideDraftFromModal();
                this.updateGuidePageBreakGuides();
            };
            div.querySelector('.guide-photo-insert-btn').onclick = (e) => {
                e.stopPropagation();
                this.insertGuidePhotoToken(index + 1);
            };
            div.querySelector('.rotate-btn').onclick = async (e) => {
                e.stopPropagation();
                try {
                    const rotated = await MaintenanceStore.rotateImageBase64(photo.src, 90);
                    const compressed = await this.compressGuideImageDataUrl(rotated);
                    this._tempPhotos[index] = { ...this.normalizeGuidePhoto(this._tempPhotos[index]), src: compressed.src };
                    this.showGuideImageCompressionNotice([compressed]);
                    this.autoSaveGuideDraftFromModal();
                    this.renderGuidePhotoPreviews();
                } catch (err) {
                    console.error('Rotate failed', err);
                }
            };
            div.querySelector('.close-btn').onclick = (e) => {
                e.stopPropagation();
                this._tempPhotos.splice(index, 1);
                this.autoSaveGuideDraftFromModal();
                this.renderGuidePhotoPreviews();
            };
            previewContainer.appendChild(div);
        });
        this.updateGuidePageBreakGuides();
    }

    insertGuidePhotoToken(photoNumber) {
        const editor = document.getElementById('g-text');
        if (!editor) return;
        const number = Math.max(1, Number(photoNumber) || 1);
        const token = `[[写真${number}]]`;
        this.restoreGuideEditorSelection();
        document.execCommand('insertText', false, token);
        editor.focus();
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    applyGuideTextInlineFormat(kind) {
        const editor = document.getElementById('g-text');
        if (!editor) return;
        this.restoreGuideEditorSelection();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            editor.focus();
            return;
        }
        if (kind === 'bold') {
            document.execCommand('bold');
        } else if (kind === 'color') {
            const color = this.getGuideFontColor({ fontColor: document.getElementById('g-font-color')?.value });
            document.execCommand('foreColor', false, color);
        } else if (kind === 'font') {
            const font = this.getGuideFontKey({ fontFamily: document.getElementById('g-font-family')?.value });
            document.execCommand('fontName', false, this.getGuideFontFamilyCss({ fontFamily: font }));
        } else {
            return;
        }
        editor.focus();
        this.rememberGuideEditorSelection();
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        this.autoSaveGuideDraftFromModal();
    }

    rememberGuideEditorSelection() {
        const editor = document.getElementById('g-text');
        const selection = window.getSelection();
        if (!editor || !selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) this._guideEditorRange = range.cloneRange();
    }

    restoreGuideEditorSelection() {
        const editor = document.getElementById('g-text');
        if (!editor || !this._guideEditorRange) {
            editor?.focus();
            return;
        }
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(this._guideEditorRange);
    }

    async alignGuidePhotoPrintHeights(enabled = true) {
        this._guidePhotoHeightsAligned = !!enabled;
        if (!enabled) {
            this.renderGuidePhotoPreviews();
            return;
        }
        const attachments = (this._tempPhotos || []).map(photo => this.normalizeGuidePhoto(photo)).filter(photo => photo.src || photo.videoId);
        const photos = attachments.filter(photo => photo.src);
        if (photos.length < 2) return;
        const sizes = await Promise.all(photos.map(photo => this.getImageNaturalSize(photo.src)));
        const renderedHeights = photos.map((photo, index) => {
            const size = sizes[index];
            const printSize = Math.max(20, Math.min(100, Number(photo.printSize) || 72));
            return size.height > 0 ? printSize * size.height / Math.max(1, size.width) : printSize;
        });
        const targetHeight = Math.min(...renderedHeights.filter(value => Number.isFinite(value) && value > 0));
        if (!Number.isFinite(targetHeight) || targetHeight <= 0) return;
        let imageIndex = 0;
        this._tempPhotos = attachments.map(photo => {
            if (!photo.src) return photo;
            const size = sizes[imageIndex++];
            const nextSize = size.height > 0 ? targetHeight * Math.max(1, size.width) / size.height : Number(photo.printSize) || 72;
            return {
                ...photo,
                printSize: Math.max(20, Math.min(100, Math.round(nextSize)))
            };
        });
        this.autoSaveGuideDraftFromModal();
        this.renderGuidePhotoPreviews();
    }

    autoSaveGuideDraftFromModal() {
        const hId = document.getElementById('g-h-id')?.value;
        if (!hId) return;
        const history = store.activeData.history || [];
        const index = history.findIndex(item => String(item.id) === String(hId));
        if (index === -1) return;
        const oldGuide = history[index].guide || {};
        const html = this.getGuideEditorHtml();
        const text = html ? this.getGuideTextFromRichHtml(html) : (oldGuide.text ?? '');
        const titleInput = document.getElementById('g-title')?.value;
        const title = titleInput !== undefined ? titleInput.trim() : (oldGuide.title || '');
        const author = document.getElementById('g-author')?.value ?? oldGuide.author ?? '';
        const fontSize = this.getGuideFontSize({ fontSize: document.getElementById('g-font-size')?.value ?? oldGuide.fontSize });
        const tagsInput = document.getElementById('g-tags')?.value;
        const tags = tagsInput !== undefined
            ? tagsInput.split(/[,，、\s]+/).map(tag => tag.trim()).filter(Boolean)
            : (Array.isArray(oldGuide.tags) ? oldGuide.tags : []);
        history[index].guide = {
            ...oldGuide,
            title,
            text,
            html,
            author,
            tags,
            fontSize,
            photos: (this._tempPhotos || []).map(photo => this.normalizeGuidePhoto(photo)).filter(photo => photo.src || photo.videoId),
            version: oldGuide.version || 'v1.0',
            updatedAt: new Date().toLocaleString(),
            changeNote: oldGuide.changeNote || '自動保存',
            revisions: []
        };
        store.save();
        this.renderHistory?.();
        this.renderGuides?.();
    }

    getImageNaturalSize(src) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth || img.width || 1, height: img.naturalHeight || img.height || 1 });
            img.onerror = () => resolve({ width: 1, height: 1 });
            img.src = src;
        });
    }

    getGuidePhotoNaturalSizeSync(src) {
        if (!src) return { width: 1, height: 1 };
        if (!this._guidePhotoSizeCache) this._guidePhotoSizeCache = new Map();
        const cached = this._guidePhotoSizeCache.get(src);
        if (cached) return cached;
        const pendingSize = { width: 1, height: 1, pending: true };
        this._guidePhotoSizeCache.set(src, pendingSize);
        const img = new Image();
        img.onload = () => {
            this._guidePhotoSizeCache.set(src, {
                width: img.naturalWidth || img.width || 1,
                height: img.naturalHeight || img.height || 1
            });
            this.updateGuidePageBreakGuides();
        };
        img.onerror = () => {
            this._guidePhotoSizeCache.set(src, { width: 1, height: 1 });
        };
        img.src = src;
        return pendingSize;
    }

    async rotateSinglePhotoField(hiddenInputId, previewContainerId) {
        const hiddenInput = document.getElementById(hiddenInputId);
        const preview = document.getElementById(previewContainerId);
        if (!hiddenInput || !hiddenInput.value) return;
        
        try {
            const rotated = await MaintenanceStore.rotateImageBase64(hiddenInput.value, 90);
            hiddenInput.value = rotated;
            preview.innerHTML = `<img src="${rotated}" style="width:100%; height:100%; object-fit:cover;">`;
        } catch(err) {
            console.error('Rotate failed', err);
        }
    }

    clearSinglePhotoField(hiddenInputId, previewContainerId, fileInputId = '') {
        const hiddenInput = document.getElementById(hiddenInputId);
        const preview = document.getElementById(previewContainerId);
        const fileInput = fileInputId ? document.getElementById(fileInputId) : null;
        if (!hiddenInput || !preview) return;
        if (hiddenInput.value && !confirm('登録画像を削除しますか？\n保存するまでは確定されません。')) return;

        hiddenInput.value = '';
        if (fileInput) fileInput.value = '';
        preview.innerHTML = '<i class="fa-solid fa-camera" style="font-size:1.5rem; color:#cbd5e1;"></i>';
        const actionRoot = fileInput?.parentElement || preview.parentElement;
        actionRoot?.querySelector('.f-rotate-btn')?.style?.setProperty('display', 'none');
        actionRoot?.querySelector('.f-delete-photo-btn')?.style?.setProperty('display', 'none');
    }

    initGlobalImageZoom() {
        const preview = document.getElementById('global-image-preview');
        const img = document.getElementById('global-image-target');
        if (!preview || !img) return;
        this.imagePreviewLocked = false;
        this.currentGlobalPreviewBox = null;
        const storageKey = 'maintenanceGlobalImagePreviewSize';
        const clampPreviewSize = (value) => Math.min(1200, Math.max(120, Number(value) || 320));
        const getPreviewSize = () => clampPreviewSize(localStorage.getItem(storageKey));
        const setPreviewSize = (value) => {
            const size = clampPreviewSize(value);
            localStorage.setItem(storageKey, String(size));
            return size;
        };

        const showPreview = (imgBox) => {
            if (!imgBox) return;
            const targetImg = imgBox.querySelector('img');
            if (!targetImg || !targetImg.src) return;
            const rect = targetImg.getBoundingClientRect();
            const naturalW = targetImg.naturalWidth || rect.width || 1;
            const naturalH = targetImg.naturalHeight || rect.height || 1;
            img.src = targetImg.src;
            this.currentGlobalPreviewBox = imgBox;

            preview.style.left = rect.left + 'px';
            preview.style.top = rect.top + 'px';
            preview.style.width = rect.width + 'px';
            preview.style.height = rect.height + 'px';
            preview.style.transform = 'none';

            const isShiftNotebookPhoto = !!imgBox.closest('.shift-photo-previews') || !!imgBox.closest('.guide-photo-previews') || !!imgBox.closest('.notebook-search-photos') || !!imgBox.closest('.shift-fullscreen-photos-wrapper');
            if (isShiftNotebookPhoto) {
                preview.classList.add('contain-mode');
            } else {
                preview.classList.remove('contain-mode');
            }
            const targetMax = getPreviewSize();
            const margin = 20;
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const maxW = Math.max(120, Math.min(targetMax, winW - margin * 2));
            const maxH = Math.max(120, Math.min(targetMax, winH - margin * 2));
            const fitScale = Math.min(maxW / naturalW, maxH / naturalH);
            const zoomedW = Math.max(90, Math.round(naturalW * fitScale));
            const zoomedH = Math.max(60, Math.round(naturalH * fitScale));

            let centerX = rect.left + rect.width / 2;
            let centerY = rect.top + rect.height / 2;

            if (centerX - zoomedW / 2 < margin) centerX = zoomedW / 2 + margin;
            if (centerX + zoomedW / 2 > winW - margin) centerX = winW - zoomedW / 2 - margin;
            if (centerY - zoomedH / 2 < margin) centerY = zoomedH / 2 + margin;
            if (centerY + zoomedH / 2 > winH - margin) centerY = winH - zoomedH / 2 - margin;

            preview.classList.remove('hidden');
            requestAnimationFrame(() => {
                preview.style.left = (centerX - zoomedW / 2) + 'px';
                preview.style.top = (centerY - zoomedH / 2) + 'px';
                preview.style.width = zoomedW + 'px';
                preview.style.height = zoomedH + 'px';
                preview.style.transform = 'none';
            });
        };

        const hidePreview = () => {
            preview.classList.add('hidden');
            preview.classList.remove('locked');
            preview.style.transform = 'none';
            this.imagePreviewLocked = false;
            this.currentGlobalPreviewBox = null;
        };

        document.addEventListener('wheel', (e) => {
            if (preview.classList.contains('hidden') || !this.currentGlobalPreviewBox) return;
            e.preventDefault();
            const delta = e.deltaY < 0 ? 60 : -60;
            setPreviewSize(getPreviewSize() + delta);
            showPreview(this.currentGlobalPreviewBox);
        }, { passive: false });

        document.addEventListener('mouseover', (e) => {
            if (this.imagePreviewLocked) return;
            const imgBox = e.target.closest('.img-box');
            if (!imgBox) return;
            showPreview(imgBox);
        });

        document.addEventListener('mouseout', (e) => {
            if (this.imagePreviewLocked) return;
            const imgBox = e.target.closest('.img-box');
            if (imgBox && !e.relatedTarget?.closest('.img-box')) {
                hidePreview();
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('#global-image-preview-close')) {
                e.stopPropagation();
                hidePreview();
                return;
            }
            const imgBox = e.target.closest('.img-box');
            if (imgBox) {
                e.stopPropagation();
                showPreview(imgBox);
                this.imagePreviewLocked = true;
                preview.classList.add('locked');
                return;
            }
            if (this.imagePreviewLocked) hidePreview();
        });
    }

    resizeImage(file, maxWidth = 800, quality = 0.7) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = Math.max(1, Math.round(width));
                    canvas.height = Math.max(1, Math.round(height));
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const hasAlpha = MaintenanceStore.canvasHasTransparency?.(ctx, canvas.width, canvas.height);
                    resolve(hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality));
                };
            };
        });
    }

    // Normalization helpers
    static toFullWidth(str) {
        if (!str) return '';
        return str.replace(/[!-~]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
    }

    static toFullWidthUpper(str) {
        if (!str) return '';
        return this.toFullWidth(str).toUpperCase();
    }

    static toHalfWidthLower(str) {
        if (!str) return '';
        // Convert full-width space to half-width space first
        const s = str.replace(/　/g, ' ');
        const half = s.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        return half.toLowerCase().trim();
    }

    openSubstituteModal(oldName, oldModel) {
        this.openModal('substitute', '代替品（型番切替）の設定', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <form id="substitute-form">
                    <input type="hidden" id="sub-old-name" value="${oldName}">
                    <input type="hidden" id="sub-old-model" value="${oldModel}">
                    <div style="padding:12px; background:var(--danger-light); border-radius:8px; margin-bottom:20px;">
                        <div style="font-size:0.75rem; color:var(--danger); font-weight:800;">現在の名称・型式 (旧品扱いになります)</div>
                        <div style="font-weight:900;">${oldName} [${oldModel}]</div>
                    </div>
                    <div class="form-group">
                        <label>新しい部品名 (最新名称) <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="sub-new-name" value="${oldName}" required>
                    </div>
                    <div class="form-group">
                        <label>新しい型式 (最新型番) <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="sub-new-model" value="" placeholder="例: NP-501-A" required>
                    </div>
                    <div class="form-group">
                        <label>新しい標準単価</label>
                        <input type="number" id="sub-new-price" placeholder="価格に変更がなければ空欄">
                    </div>
                    <p style="font-size:0.75rem; color:var(--text-light); line-height:1.4;">
                        ※設定すると、これまでの全ての記録が「新しい型式」に紐付けられ、一つのカードとして集計されます。
                    </p>
                </form>
            `;
        });
    }

    openPartMasterModal(name, model) {
        const isNew = !name;
        const master = isNew ? null : store.getPartMaster(name, model);
        
        // Calculate Yearly Costs & Individual Records (only for editing)
        const canonName = isNew ? '' : (master ? master.name : name);
        const canonModel = isNew ? '' : (master ? master.model : model);
        const yearlyCosts = {};
        const usageHistory = [];
        
        if (!isNew) {
            store.activeData.history.forEach(h => {
                (h.replacedParts || []).forEach(p => {
                    const pMaster = store.getPartMaster(p.name, p.model);
                    const isMatch = (pMaster && pMaster.name === canonName && pMaster.model === canonModel) || 
                                    (!pMaster && MaintenanceStore.toFullWidth(p.name) === canonName && MaintenanceStore.toHalfWidthLower(p.model) === canonModel);
                    
                    if (isMatch) {
                        const fy = this.getFiscalYear(h.date);
                        if (fy) {
                            const cost = (parseFloat(p.price) || (master?.price || 0)) * (parseFloat(p.count) || 0);
                            yearlyCosts[fy] = (yearlyCosts[fy] || 0) + cost;
                        }
                        const m = store.getMachines(true).find(machine => machine.id === h.machineId);
                        usageHistory.push({
                            date: h.date,
                            machineName: m ? m.name : '不明',
                            machineModel: m ? m.model : '-',
                            count: p.count,
                            unit: p.unit,
                            model: p.model // Show original model if it was an alias
                        });
                    }
                });
            });
            // Sort history by date desc
            usageHistory.sort((a,b) => new Date(b.date) - new Date(a.date));
        }

        this.openModal('part-master', isNew ? '新規部品の登録' : '部品マスターの編集', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <form id="part-master-form">
                    ${isNew ? `
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                            <div class="form-group">
                                <label>部品名称 <span style="color:var(--danger)">*</span></label>
                                <input type="text" id="pm-name" placeholder="例: ベアリング" required>
                            </div>
                            <div class="form-group">
                                <label>型番・スペック <span style="color:var(--danger)">*</span></label>
                                <input type="text" id="pm-model" placeholder="例: 6204ZZ" required>
                            </div>
                        </div>
                    ` : `
                        <input type="hidden" id="pm-name" value="${name}">
                        <input type="hidden" id="pm-model" value="${model}">
                        <div style="padding:12px; background:var(--primary-light); border-radius:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <div style="font-size:0.75rem; color:var(--primary); font-weight:800;">現在の名称</div>
                                <div style="font-weight:900; font-size:1.1rem;">${name}</div>
                                <div style="font-weight:700; color:var(--text-light);">${model}</div>
                            </div>
                            <button type="button" class="secondary-btn" style="padding:4px 10px; font-size:0.7rem;" onclick="app.openSubstituteModal('${name}', '${model}')">
                                <i class="fa-solid fa-shuffle"></i> 代替品設定
                            </button>
                        </div>
                    `}

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                標準単価
                                <span style="font-size:0.65rem; color:var(--text-light); font-weight:400;">液体は 値段/重量(kg) で入力するとg単価が自動計算されます</span>
                            </label>
                            <input type="text" id="pm-price-raw" value="${master?.priceRaw || (master?.price ? String(master.price) : '')}" placeholder="例: 1500 または 15000/20(kg)" oninput="app.calcPartMasterPrice(this.value)" style="font-family:monospace;">
                            <div id="pm-price-hint" style="font-size:0.7rem; color:var(--primary); font-weight:700; min-height:1.2em;"></div>
                            <input type="hidden" id="pm-price" value="${master?.price || ''}">
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                            <div class="form-group">
                                <label>主要仕入先</label>
                                <input type="text" id="pm-supplier" value="${master?.supplier || ''}" placeholder="例: 〇〇商事">
                            </div>
                            <div class="form-group">
                                <label>棚番 (任意)</label>
                                <input type="text" id="pm-shelf" value="${master?.shelf || ''}" placeholder="例: A-1-2">
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>備考・管理メモ</label>
                        <textarea id="pm-remarks" rows="2" placeholder="図面番号や保管場所など">${master?.remarks || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                            別名・名寄せ
                            <span style="font-size:0.65rem; color:var(--text-light); font-weight:400;">1行に1つ。例: ベルト x1 個 @1200 / ﾍﾞﾙﾄ / 旧型番</span>
                        </label>
                        <div class="part-alias-help">
                            履歴やCSVで表記ゆれした部品名を、この正式な部品としてまとめる設定です。登録した別名はコスト集計・使用履歴・部品検索で同じ部品として扱われます。
                        </div>
                        <div id="pm-alias-chips" class="part-alias-chips">
                            ${(master?.seeds || []).map(seed => {
                                const label = `${seed.name || ''}${seed.model ? ` [${seed.model}]` : ''}`.trim();
                                return label ? `<button type="button" onclick="app.removePartAliasLine('${this.escapeJs(label)}')" title="この別名を解除">${this.escapeHtml(label)} <i class="fa-solid fa-xmark"></i></button>` : '';
                            }).join('') || '<span>登録済みの別名はありません</span>'}
                        </div>
                        <div id="pm-alias-candidates" class="part-alias-candidates">
                            ${this.renderPartAliasCandidates(name, model)}
                        </div>
                        <textarea id="pm-seeds" rows="3" placeholder="この部品として扱いたい表記ゆれを入力" oninput="app.updatePartAliasPreview()">${(master?.seeds || []).map(seed => `${seed.name || ''}${seed.model ? ` [${seed.model}]` : ''}`).join('\n')}</textarea>
                        <div id="pm-alias-preview" class="part-alias-preview"></div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-top:16px; padding:15px; background:#fff7ed; border:1.5px solid #fed7aa; border-radius:12px;">
                        <div class="form-group" style="grid-column: span 2;">
                             <label style="font-weight:800; color:#c2410c;">管理単位</label>
                             <select id="pm-unit" style="border-color:#fdba74;">
                                 <option value="個" ${master?.unit === '個' ? 'selected' : ''}>個 (pcs)</option>
                                 <option value="g" ${master?.unit === 'g' || master?.unit === 'kg' ? 'selected' : ''}>g (グラム)</option>
                             </select>
                        </div>
                        <div class="form-group">
                            <label style="font-weight:800; color:#c2410c;"><i class="fa-solid fa-boxes-stacked"></i> 現在庫数</label>
                            <input type="number" id="pm-stock" value="${master?.stock || 0}" step="0.001" style="border-color:#fdba74; font-size:1.1rem; font-weight:900;">
                        </div>
                        <div class="form-group">
                            <label style="font-weight:800; color:#c2410c;"><i class="fa-solid fa-bell"></i> 発注アラート閾値</label>
                            <input type="number" id="pm-min-stock" value="${master?.minStock || 0}" step="0.1" placeholder="0以下で無効" style="border-color:#fdba74;">
                            <p style="font-size:0.65rem; color:#9a3412; margin-top:4px;">※在庫がこの値を下回るとダッシュボード等で警告が出ます。</p>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top:20px; padding:15px; border:2px dashed var(--border); border-radius:12px; background:var(--background);">
                        <label style="margin-bottom:12px; display:block;">部品の写真</label>
                        <div style="display:flex; gap:20px; align-items:center;">
                            <div id="pm-photo-preview" class="img-box" style="width:100px; height:100px; border-radius:10px;">
                                ${master && master.photo ? `<img src="${master.photo}">` : '<i class="fa-solid fa-camera" style="font-size:1.8rem; color:#cbd5e1;"></i>'}
                            </div>
                            <div style="flex:1">
                                <input type="file" id="pm-photo" accept="image/*" style="font-size:0.8rem; margin-bottom:8px;">
                                <input type="hidden" id="pm-photo-base64" value="${master ? master.photo || '' : ''}">
                                <div class="profile-photo-actions" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; margin-bottom:4px;">
                                    <button type="button" class="secondary-btn f-rotate-btn" style="padding:2px 8px; font-size:0.7rem; display:${master && master.photo ? 'inline-block' : 'none'};" onclick="app.rotateSinglePhotoField('pm-photo-base64', 'pm-photo-preview')"><i class="fa-solid fa-rotate-right"></i> 向きを修正</button>
                                    <button type="button" class="secondary-btn f-delete-photo-btn" style="padding:2px 8px; font-size:0.7rem; color:var(--danger); border-color:#fecaca; display:${master && master.photo ? 'inline-block' : 'none'};" onclick="app.clearSinglePhotoField('pm-photo-base64', 'pm-photo-preview', 'pm-photo')"><i class="fa-solid fa-trash"></i> 画像削除</button>
                                </div>
                                <div style="font-size:0.65rem; color:var(--text-light); line-height:1.4;">
                                    ※現場での識別を容易にするために、現物の全体写真やラベル等のアップロードを推奨します。
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 2fr; gap:16px; margin-top:16px;">
                        <div>
                            <label style="font-size:0.85rem; font-weight:700; display:block; margin-bottom:8px;">年度別消費金額</label>
                            <div style="background:var(--background); border-radius:8px; padding:12px; max-height:220px; overflow-y:auto;">
                                ${Object.keys(yearlyCosts).length === 0 ? '<div style="font-size:0.75rem; color:var(--text-light)">実績なし</div>' : `
                                    <table style="width:100%; font-size:0.75rem; border-collapse:collapse;">
                                        ${Object.keys(yearlyCosts).sort().reverse().map(fy => `
                                            <tr style="border-bottom:1px solid #e2e8f0;">
                                                <td style="padding:4px 0; color:var(--text-light);">${fy}年度</td>
                                                <td style="padding:4px 0; text-align:right; font-weight:800;">¥${Math.round(yearlyCosts[fy]).toLocaleString()}</td>
                                            </tr>
                                        `).join('')}
                                    </table>
                                `}
                            </div>
                        </div>
                        <div>
                            <label style="font-size:0.85rem; font-weight:700; display:block; margin-bottom:8px;">使用履歴 (直近20件)</label>
                            <div style="background:var(--background); border-radius:8px; padding:12px; max-height:220px; overflow-y:auto;">
                                ${usageHistory.length === 0 ? '<div style="font-size:0.75rem; color:var(--text-light)">履歴なし</div>' : `
                                    <table style="width:100%; font-size:0.75rem; border-collapse:collapse;">
                                        <thead>
                                            <tr style="border-bottom:2px solid #cbd5e1; text-align:left;">
                                                <th style="padding:4px 0;">日付</th>
                                                <th style="padding:4px 0;">対象機械 (名称/型式)</th>
                                                <th style="padding:4px 0; text-align:right;">数量</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${usageHistory.slice(0, 20).map(u => `
                                                <tr style="border-bottom:1px solid #e2e8f0;">
                                                    <td style="padding:4px 0; white-space:nowrap;">${u.date}</td>
                                                    <td style="padding:4px 0;">
                                                        <div style="color:var(--text-main); font-weight:700;">${u.machineName}</div>
                                                        <div style="font-size:0.65rem; color:var(--text-light);">${u.machineModel}</div>
                                                    </td>
                                                    <td style="padding:4px 0; text-align:right;">${Math.round(u.count)} <span style="font-size:0.6rem;">${(u.unit === 'pcs' || u.unit === '個' || !u.unit) ? '個' : u.unit}</span></td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                `}
                            </div>
                        </div>
                    </div>
                </form>
            `;
            setTimeout(() => this.updatePartAliasPreview(), 0);
        });
    }

    renderPartAliasCandidates(name, model = '') {
        if (!name) return '<span class="part-alias-empty">正式名を保存後に候補を表示します</span>';
        const currentKey = `${name}___${model || ''}`;
        const norm = (value) => MaintenanceStore.toHalfWidthLower(String(value || '').replace(/\s+/g, '').replace(/[×ｘX]/g, 'x'));
        const target = norm(name);
        const candidates = new Map();
        const add = (partName, partModel = '', source = '') => {
            const label = `${partName || ''}${partModel ? ` [${partModel}]` : ''}`.trim();
            if (!label || `${partName}___${partModel || ''}` === currentKey) return;
            const score = norm(partName) === target || norm(partName).includes(target) || target.includes(norm(partName));
            if (!score) return;
            candidates.set(label, { name: partName, model: partModel || '', source });
        };
        (store.activeData.partsMaster || []).forEach(part => add(part.name, part.model || '', '部品マスター'));
        (store.activeData.history || []).forEach(h => (h.replacedParts || []).forEach(part => add(part.name, part.model || '', '履歴')));
        const list = Array.from(candidates.values()).slice(0, 8);
        if (!list.length) return '<span class="part-alias-empty">近い表記は見つかりません</span>';
        return `
            <b><i class="fa-solid fa-wand-magic-sparkles"></i> 候補</b>
            <div>
                ${list.map(item => {
                    const label = `${item.name}${item.model ? ` [${item.model}]` : ''}`;
                    return `<button type="button" onclick="app.addPartAliasLine('${this.escapeJs(label)}')" title="${this.escapeHtml(item.source)}から候補">${this.escapeHtml(label)}</button>`;
                }).join('')}
            </div>
        `;
    }

    getPartAliasLines() {
        return (document.getElementById('pm-seeds')?.value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }

    setPartAliasLines(lines = []) {
        const unique = [...new Set(lines.map(s => String(s || '').trim()).filter(Boolean))];
        const textarea = document.getElementById('pm-seeds');
        if (textarea) textarea.value = unique.join('\n');
        this.updatePartAliasPreview();
    }

    addPartAliasLine(label) {
        this.setPartAliasLines([...this.getPartAliasLines(), label]);
    }

    removePartAliasLine(label) {
        this.setPartAliasLines(this.getPartAliasLines().filter(line => line !== label));
    }

    updatePartAliasPreview() {
        const preview = document.getElementById('pm-alias-preview');
        const chips = document.getElementById('pm-alias-chips');
        if (!preview) return;
        const lines = this.getPartAliasLines();
        if (chips) {
            chips.innerHTML = lines.length
                ? lines.map(line => `<button type="button" onclick="app.removePartAliasLine('${this.escapeJs(line)}')" title="この別名を解除">${this.escapeHtml(line)} <i class="fa-solid fa-xmark"></i></button>`).join('')
                : '<span>登録済みの別名はありません</span>';
        }
        const aliases = lines.map(line => {
            const bracket = line.match(/^(.*?)\s*\[(.*?)\]\s*$/);
            if (bracket) return { name: bracket[1].trim(), model: bracket[2].trim(), label: line };
            const parsed = this.parseHistoryPartsText?.(line)?.[0] || {};
            return { name: parsed.name || line, model: parsed.model || '', label: line };
        });
        const hitIds = new Set();
        (store.activeData.history || []).forEach(h => {
            const hit = (h.replacedParts || []).some(part => aliases.some(alias => String(part.name || '') === alias.name && String(part.model || '') === String(alias.model || '')));
            if (hit) hitIds.add(h.id || `${h.date}-${hitIds.size}`);
        });
        preview.innerHTML = aliases.length
            ? `<i class="fa-solid fa-code-merge"></i> 保存すると ${aliases.length}件の別名を登録し、該当履歴 ${hitIds.size}件を同じ部品として集計します。`
            : '<i class="fa-solid fa-circle-info"></i> 別名を追加すると、保存前に影響件数を表示します。';
    }

    parsePartAliasLine(line) {
        const text = String(line || '').trim();
        if (!text) return null;
        const bracket = text.match(/^(.*?)\s*\[(.*?)\]\s*$/);
        if (bracket) return { name: bracket[1].trim(), model: bracket[2].trim(), label: text };
        const parsed = this.parseHistoryPartsText?.(text)?.[0] || {};
        return { name: parsed.name || text, model: parsed.model || '', label: text };
    }

    getPartAliasMasterDeletionCandidates(seeds = [], canonicalName = '', canonicalModel = '') {
        const canonicalKey = `${canonicalName}___${canonicalModel || ''}`;
        const seedKeys = new Set((seeds || [])
            .filter(seed => seed?.name)
            .map(seed => `${seed.name}___${seed.model || ''}`)
            .filter(key => key !== canonicalKey));
        const seen = new Set();
        return (store.activeData.partsMaster || []).filter(part => {
            const key = `${part.name}___${part.model || ''}`;
            if (!seedKeys.has(key) || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    deletePartMasterCardsForAliases(parts = [], canonicalName = '', canonicalModel = '') {
        if (!parts.length) return 0;
        const deleteKeys = new Set(parts.map(part => `${part.name}___${part.model || ''}`));
        const canonicalKey = `${canonicalName}___${canonicalModel || ''}`;
        const before = (store.activeData.partsMaster || []).length;
        store.activeData.partsMaster = (store.activeData.partsMaster || []).filter(part => {
            const key = `${part.name}___${part.model || ''}`;
            return key === canonicalKey || !deleteKeys.has(key);
        });
        return before - store.activeData.partsMaster.length;
    }

    addPartRow(p = null, hidePrice = false) {
        const container = document.getElementById('s-parts-container');
        if (!container) return;
        
        const name = p?.name || '';
        const model = p?.model || '';
        const count = p?.count || '';
        const unit = p?.unit || '個';
        const price = p?.price || '';
        const e = (value) => this.escapeHtml(value ?? '');

        const row = document.createElement('div');
        row.className = 'part-row';
        row.style = 'display:grid; grid-template-columns: 2fr 2fr 1fr 1.5fr ' + (hidePrice ? '' : '1fr ') + 'auto; gap:8px; margin-bottom:8px;';
        
        // Auto-price lookup logic
        const updatePrice = () => {
            const n = row.querySelector('.p-name').value;
            const m = row.querySelector('.p-model').value;
            if (n) {
                const master = store.getPartMaster(n, m);
                if (master && (master.price || master.price === 0)) {
                    row.querySelector('.p-price').value = master.price;
                }
            }
        };

        row.innerHTML = `
            <div class="part-master-replace-bar">
                <div class="part-master-replace-search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="search" class="p-master-search" placeholder="登録済み部品を検索して正式名に訂正" oninput="app.renderPartMasterSearchResults(this)">
                </div>
                <button type="button" class="secondary-btn part-master-replace-btn" onclick="app.applyPartMasterSelectionToRow(this.closest('.part-row').querySelector('.p-master-search'))">
                    <i class="fa-solid fa-magnifying-glass"></i> 検索
                </button>
                <div class="part-master-replace-results"></div>
            </div>
            <input type="text" class="p-name" placeholder="部品名" value="${e(name)}" list="list-part-names">
            <input type="text" class="p-model" placeholder="型番" value="${e(model)}" list="list-part-models">
            <input type="number" class="p-count" placeholder="量" value="${e(count)}" step="0.001">
            <select class="p-unit">
                <option value="個" ${unit === 'pcs' || unit === '個' ? 'selected' : ''}>個</option>
                <option value="g" ${unit === 'g' || unit === 'kg' ? 'selected' : ''}>g</option>
            </select>
            ${hidePrice 
                ? `<input type="hidden" class="p-price" value="${e(price)}">` 
                : `<input type="number" class="p-price" placeholder="単価" value="${e(price)}">`}
            <button type="button" class="close-btn" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
        `;

        const nameIn = row.querySelector('.p-name');
        const modelIn = row.querySelector('.p-model');
        nameIn.addEventListener('input', updatePrice);
        modelIn.addEventListener('input', updatePrice);
        this.ensurePartMasterSearchDatalist();
        
        // Initial lookup if name provided
        if (name && !price && price !== 0) updatePrice();

        container.appendChild(row);
    }

    getPartMasterSearchLabel(part) {
        if (!part) return '';
        const model = part.model ? ` [${part.model}]` : '';
        const price = parseFloat(part.price);
        const priceText = !Number.isNaN(price) && price > 0 ? ` / ¥${price.toLocaleString()}` : '';
        return `${part.name || ''}${model}${priceText}`;
    }

    ensurePartMasterSearchDatalist() {
        let list = document.getElementById('list-part-master-options');
        if (!list) {
            list = document.createElement('datalist');
            list.id = 'list-part-master-options';
            document.body.appendChild(list);
        }
        const parts = (store.activeData.partsMaster || [])
            .filter(part => part && part.name && !store.isPartArchived?.(part.name, part.model || ''))
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ja'));
        list.innerHTML = parts.map(part => `<option value="${this.escapeHtml(this.getPartMasterSearchLabel(part))}"></option>`).join('');
    }

    findPartMasterFromSearchValue(value) {
        const raw = String(value || '').trim();
        if (!raw) return null;
        const parts = this.collectPartSearchEntries().map(entry => entry.part);
        return parts.find(part => this.getPartMasterSearchLabel(part) === raw)
            || parts.find(part => {
                const label = `${part.name || ''}${part.model ? ` [${part.model}]` : ''}`;
                return label === raw;
            })
            || parts.find(part => String(part.name || '') === raw);
    }

    collectPartSearchEntries() {
        const entries = new Map();
        const put = (part, source = 'master') => {
            if (!part?.name) return;
            const name = source === 'history' ? MaintenanceStore.toFullWidth(part.name || '') : (part.name || '');
            const model = source === 'history' ? MaintenanceStore.toHalfWidthLower(part.model || '') : (part.model || '');
            const key = `${name}::${model}`;
            const existing = entries.get(key);
            const next = {
                name,
                model,
                unit: part.unit || existing?.unit || '個',
                price: parseFloat(part.price) || existing?.price || 0,
                stock: part.stock ?? existing?.stock,
                supplier: part.supplier || existing?.supplier || '',
                shelf: part.shelf || existing?.shelf || '',
                remarks: part.remarks || existing?.remarks || '',
                source: existing?.source === 'master' ? 'master' : source,
                usageCount: (existing?.usageCount || 0) + (source === 'history' ? 1 : 0)
            };
            entries.set(key, next);
        };
        (store.activeData.partsMaster || [])
            .filter(part => part && part.name && !store.isPartArchived?.(part.name, part.model || ''))
            .forEach(part => put(part, 'master'));
        (store.activeData.history || []).forEach(history => {
            (history.replacedParts || []).forEach(part => {
                put(part, 'history');
                const master = store.getPartMaster?.(part.name, part.model || '');
                if (master) put(master, 'master');
            });
        });
        return Array.from(entries.values()).map((part, index) => ({ part, index }));
    }

    getPartMasterSearchTerms(query) {
        const normalize = (value) => MaintenanceStore.toHalfWidthLower(String(value || '')
            .replace(/[＠]/g, '@')
            .replace(/[ｘＸ×]/g, 'x')
            .replace(/[（]/g, '(')
            .replace(/[）]/g, ')')
            .replace(/\s+/g, ' ')
            .trim());
        const raw = normalize(query);
        if (!raw) return [];
        const terms = [raw];
        const beforeAmount = raw
            .replace(/\s*@\s*[-+]?\d[\d,.]*/g, ' ')
            .replace(/\s*x\s*[-+]?\d*\.?\d+\s*(?:個|g|kg|本|枚|袋|箱)?/ig, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (beforeAmount) terms.push(beforeAmount);
        const xMatch = raw.match(/^(.*?)(?:\s*x\s*[-+]?\d|x[-+]?\d|@)/i);
        if (xMatch?.[1]?.trim()) terms.push(xMatch[1].trim());
        raw.split(/[\s,，、/／;；()[\]@]+/).forEach(token => {
            const cleaned = token.replace(/^x[-+]?\d*\.?\d+$/i, '').trim();
            if (cleaned && !/^[-+]?\d*\.?\d+$/.test(cleaned) && !/^(個|g|kg|本|枚|袋|箱)$/i.test(cleaned)) {
                terms.push(cleaned);
            }
        });
        return [...new Set(terms.map(t => normalize(t)).filter(Boolean))];
    }

    getPartMasterSearchCandidates(query) {
        const normalize = (value) => MaintenanceStore.toHalfWidthLower(String(value || '').trim());
        const terms = this.getPartMasterSearchTerms(query);
        return this.collectPartSearchEntries()
            .map(item => {
                const text = normalize([
                    item.part.name,
                    item.part.model,
                    item.part.supplier,
                    item.part.shelf,
                    item.part.remarks
                ].filter(Boolean).join(' '));
                const name = normalize(item.part.name);
                const model = normalize(item.part.model);
                let score = 0;
                if (!terms.length) score = 1;
                terms.forEach((q, termIndex) => {
                    if (!q) return;
                    const bonus = termIndex === 0 ? 0 : 8;
                    if (name === q || model === q) score = Math.max(score, 100 + bonus);
                    else if (name.startsWith(q) || model.startsWith(q)) score = Math.max(score, 80 + bonus);
                    else if (name.includes(q) || model.includes(q)) score = Math.max(score, 65 + bonus);
                    else if (text.includes(q)) score = Math.max(score, 50 + bonus);
                    else if (q.includes(name) && name.length >= 2) score = Math.max(score, 45 + bonus);
                });
                return { ...item, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score || String(a.part.name || '').localeCompare(String(b.part.name || ''), 'ja'))
            .slice(0, 12);
    }

    renderPartMasterSearchResults(input, force = false) {
        if (!input) return;
        const row = input.closest('.part-row');
        const resultsEl = row?.querySelector('.part-master-replace-results');
        if (!row || !resultsEl) return;
        let query = input.value.trim();
        if (!query && force) {
            query = row.querySelector('.p-name')?.value?.trim() || '';
            input.value = query;
        }
        if (!query) {
            resultsEl.innerHTML = `<div class="part-master-replace-empty">部品名や型番を入力して検索してください。</div>`;
            return;
        }
        const candidates = this.getPartMasterSearchCandidates(query);
        this._partMasterSearchCandidates = candidates;
        resultsEl.innerHTML = candidates.length ? candidates.map(({ part, index }) => {
            const price = parseFloat(part.price);
            const stock = parseFloat(part.stock);
            const sourceLabel = part.source === 'history' ? `履歴 ${Number(part.usageCount || 0).toLocaleString()}件` : '部品マスター';
            return `
                <button type="button" class="part-master-result" data-part-index="${index}" onclick="app.applyPartMasterSelectionButton(this)">
                    <span>
                        <b>${this.escapeHtml(part.name || '')}</b>
                        ${part.model ? `<em>${this.escapeHtml(part.model)}</em>` : ''}
                    </span>
                    <small>
                        ${this.escapeHtml(sourceLabel)}
                        / ${part.unit ? `${this.escapeHtml(part.unit)}` : '単位なし'}
                        ${!Number.isNaN(price) && price > 0 ? ` / ¥${price.toLocaleString()}` : ''}
                        ${!Number.isNaN(stock) ? ` / 在庫 ${stock.toLocaleString()}` : ''}
                    </small>
                </button>
            `;
        }).join('') : `<div class="part-master-replace-empty">一致する登録済み部品がありません。</div>`;
    }

    applyPartMasterSelectionButton(button) {
        const row = button?.closest('.part-row');
        const index = Number(button?.dataset?.partIndex);
        const selected = Number.isInteger(index) ? (this._partMasterSearchCandidates || []).find(item => item.index === index)?.part : null;
        if (!row || !selected) return;
        this.applyPartMasterToRow(row, selected);
    }

    applyPartMasterSelectionToRow(input) {
        if (!input) return;
        const row = input.closest('.part-row');
        if (!row) return;
        const selected = this.findPartMasterFromSearchValue(input.value);
        if (!selected) {
            this.renderPartMasterSearchResults(input, true);
            return;
        }
        this.applyPartMasterToRow(row, selected);
    }

    applyPartMasterToRow(row, selected) {
        const nameInput = row.querySelector('.p-name');
        const modelInput = row.querySelector('.p-model');
        const unitInput = row.querySelector('.p-unit');
        const priceInput = row.querySelector('.p-price');
        const searchInput = row.querySelector('.p-master-search');
        const resultsEl = row.querySelector('.part-master-replace-results');
        const oldName = MaintenanceStore.toFullWidth(nameInput?.value || '');
        const oldModel = MaintenanceStore.toHalfWidthLower(modelInput?.value || '');
        const newName = selected.name || '';
        const newModel = selected.model || '';
        const changed = oldName !== newName || oldModel !== newModel;

        if (nameInput) nameInput.value = newName;
        if (modelInput) modelInput.value = newModel;
        if (unitInput && selected.unit) {
            const normalizedUnit = selected.unit === 'kg' ? 'g' : selected.unit;
            if (Array.from(unitInput.options).some(opt => opt.value === normalizedUnit)) unitInput.value = normalizedUnit;
        }
        if (priceInput && (selected.price || selected.price === 0)) priceInput.value = selected.price;
        if (searchInput) searchInput.value = '';
        if (resultsEl) resultsEl.innerHTML = '';

        const hasOldExactMaster = (store.activeData.partsMaster || []).some(part => part.name === oldName && (part.model || '') === oldModel);
        if (changed && oldName && hasOldExactMaster) {
            const oldLabel = `${oldName}${oldModel ? ` [${oldModel}]` : ''}`;
            const newLabel = `${newName}${newModel ? ` [${newModel}]` : ''}`;
            if (confirm(`正式な部品名「${newLabel}」へ上書きしました。\n\n元の部品マスター「${oldLabel}」も削除しますか？\n不正確な部品名の登録を残したくない場合はOKを押してください。`)) {
                store.hardDeletePart(oldName, oldModel);
                this.ensurePartMasterSearchDatalist();
                this.updateDataLists();
                this.showToast?.('元の部品マスターを削除しました', 'success');
            }
        } else {
            this.showToast?.('部品名を正式名で上書きしました', 'success');
        }
    }

    closeModal() {
        const container = document.getElementById('modal-container');
        if (container?.dataset.modalType === 'shift-notebook') {
            this._skipShiftNoteFormatCommitOnce = true;
            this._activeShiftNoteEditor = null;
        }
        this._guidePageBreakResizeObserver?.disconnect?.();
        this._guidePageBreakResizeObserver = null;
        this.clearGuidePhotoTokenHighlights?.();
        document.getElementById('modal-overlay').classList.add('hidden');
        if (container) {
            delete container.dataset.modalType;
            container.className = 'modal-container';
        }
    }

    // Real-time price calculator for part master (supports "price/weightKG" format)
    calcPartMasterPrice(raw) {
        const hint = document.getElementById('pm-price-hint');
        const hiddenPrice = document.getElementById('pm-price');
        if (!hint || !hiddenPrice) return;

        const slashIdx = raw.indexOf('/');
        if (slashIdx !== -1) {
            const totalPrice = parseFloat(raw.substring(0, slashIdx));
            const weightKg = parseFloat(raw.substring(slashIdx + 1));
            if (!isNaN(totalPrice) && !isNaN(weightKg) && weightKg > 0) {
                const perG = totalPrice / (weightKg * 1000);
                hint.innerHTML = `<i class="fa-solid fa-calculator"></i> 1gあたり ¥${perG.toFixed(4)} （¥${totalPrice.toLocaleString()} ÷ ${weightKg}kg）`;
                hiddenPrice.value = perG;
            } else {
                hint.textContent = '※ 「価格/重量KG」の形式で入力してください';
                hiddenPrice.value = '';
            }
        } else {
            const plain = parseFloat(raw);
            hint.textContent = isNaN(plain) ? '' : `→ 1個 ¥${plain.toLocaleString()}`;
            hiddenPrice.value = isNaN(plain) ? '' : plain;
        }
    }

    saveModalData(type) {
        try {
            const form = document.getElementById(`${type}-form`);
            if (form && !form.reportValidity()) return;
        if (type === 'shift-notebook') {
            const editing = this._editingShiftNotebook;
            if (!editing) return;
            this.saveShiftNotebook(editing.dateStr, editing.shift);
        } else if (type === 'machine') {
            const name = document.getElementById('f-machine-name').value;
            const model = document.getElementById('f-machine-model').value;
            const manufacturer = document.getElementById('f-machine-manufacturer').value;
            const lineNo = document.getElementById('f-machine-line-no').value;
            const remarks = document.getElementById('f-machine-remarks').value;
            const photo = document.getElementById('f-machine-photo-base64').value;
            const id = document.getElementById('f-machine-id').value;

            const category = this.getCategoryFromModalInput('f-');

            if (!name || !model) {
                alert('機械名と型式は必須です。');
                return;
            }

            let machineId = id;
            if (id) {
                store.updateMachine(id, { name, model, manufacturer, remarks, photo, category, lineNo });
            } else {
                const newM = store.addMachine(name, model, remarks, photo, category, lineNo, manufacturer);
                machineId = newM.id;
            }

            // Tasks
            const taskRows = document.querySelectorAll('#f-tasks-container .task-row');
            const currentTaskIds = [];
            const blankCycleRows = Array.from(taskRows).filter(row => {
                const content = row.querySelector('.t-content')?.value.trim();
                const period = row.querySelector('.t-period')?.value.trim();
                const start = row.querySelector('.t-start')?.value;
                return content && (!period || !start);
            });
            if (blankCycleRows.length > 0) {
                const ok = confirm(`周期または開始日が未入力のメンテ項目が${blankCycleRows.length}件あります。\n周期が空の項目は単発予定として保存されます。このまま保存しますか？`);
                if (!ok) return;
            }
            taskRows.forEach(row => {
                const tId = row.querySelector('.t-id').value;
                const content = row.querySelector('.t-content').value;
                const period = row.querySelector('.t-period').value;
                const start = row.querySelector('.t-start').value;

                if (content) {
                    if (tId) {
                        const taskToUpdate = store.activeData.tasks.find(x => x.id === tId);
                        if (taskToUpdate) {
                            taskToUpdate.content = content;
                            taskToUpdate.periodDays = parseInt(period) || 0;
                            taskToUpdate.startDate = start;
                        }
                        currentTaskIds.push(tId);
                    }
 else {
                        const newT = store.addTask(machineId, content, period, start);
                        currentTaskIds.push(newT.id);
                    }
                }
            });

            // Delete tasks not in current rows (but keep archived ones)
            store.activeData.tasks = store.activeData.tasks.filter(t => {
                if (t.machineId !== machineId) return true; // Keep other machines
                if (currentTaskIds.includes(t.id)) return true; // Keep active rows
                if (store.isMaintenanceTaskArchived(t.id)) return true; // Keep archived tasks
                store.freezeTaskContentInHistory(t.id);
                if ((parseInt(t.periodDays) || 0) <= 0) {
                    t.deleted = true;
                    return true;
                }
                return false;
            });
            store.save();

            this.closeModal();
            this.updateDataLists(); // プルダウンを更新
            this.renderMachines();
            this.renderCalendar();
        } else if (type === 'sudden') {
            let machineId = document.getElementById('s-machine-id').value;
            const lineNo = document.getElementById('s-line-no').value;
            const date = document.getElementById('s-date').value;
            const symptom = document.getElementById('s-content').value;
            const cause = document.getElementById('s-cause').value;
            const treatment = document.getElementById('s-notes').value;
            const errorNo = document.getElementById('s-error-no').value;
            const workTime = document.getElementById('s-work-time').value;
            const startTime = document.getElementById('s-start-time')?.value || '';
            const endTime = document.getElementById('s-end-time')?.value || '';
            const workerText = document.getElementById('s-workers').value;
            const isSingleMaintenance = !!document.getElementById('s-is-single-maintenance')?.checked;
            const isDokatei = !isSingleMaintenance && document.getElementById('s-is-dokatei').checked;
            const isNonProductionStop = !isSingleMaintenance && !isDokatei && !!document.getElementById('s-is-non-production-stop')?.checked;
            const category = document.getElementById('s-category').value;
            const machineCategory = this.getCategoryFromModalInput('s-');
            if (!this.confirmPartialMaintenanceTime('s')) return;
            
            if (machineId === 'NEW_MACHINE') {
                const newName = document.getElementById('s-new-name').value;
                const newModel = document.getElementById('s-new-model').value;
                if (!newName || !newModel) {
                    alert('新規登録する機械の名前と型式を入力してください。');
                    return;
                }
                const newM = store.addMachine(newName, newModel, '', '', machineCategory, lineNo);
                machineId = newM.id;
            }

            if (!machineId || !symptom) {
                alert(isSingleMaintenance ? '機械とメンテ内容は必須です。' : '機械と症状の内容は必須です。');
                return;
            }

            const workers = workerText ? workerText.split(',').map(s => s.trim()).filter(Boolean) : [];
            if (workers.length === 0) {
                alert('作業者は必須です。少なくとも1名入力してください。');
                const workersInput = document.getElementById('s-workers');
                if (workersInput) { workersInput.focus(); workersInput.style.border = '2px solid var(--danger)'; }
                return;
            }

            // Capture Parts (With price)
            const partRows = document.querySelectorAll('#s-parts-container .part-row');
            const replacedParts = [];
            partRows.forEach(row => {
                const nameInput = row.querySelector('.p-name');
                const modelInput = row.querySelector('.p-model');
                const countInput = row.querySelector('.p-count');
                const unitInput = row.querySelector('.p-unit');
                const priceInput = row.querySelector('.p-price');

                if (nameInput && nameInput.value) {
                    replacedParts.push({ 
                        name: MaintenanceStore.toFullWidth(nameInput.value),
                        model: MaintenanceStore.toHalfWidthLower(modelInput ? modelInput.value : ''),
                        count: parseFloat(countInput ? countInput.value : 0) || 0, 
                        unit: unitInput ? unitInput.value : '個',
                        price: parseFloat(priceInput ? priceInput.value : 0) || 0
                    });
                }
            });

            if (workers.length === 0) {
                // already handled above
            }

            let newSuddenRecord = null;
            if (isSingleMaintenance) {
                const oneOffTask = store.addTask(machineId, symptom, 0, date);
                oneOffTask.deleted = true;
                oneOffTask.singleMaintenanceFromSudden = true;
                newSuddenRecord = store.addHistoryRecord({
                    taskId: oneOffTask.id,
                    taskContent: symptom,
                    machineId,
                    date,
                    notes: treatment || symptom,
                    cause: '',
                    errorContent: '',
                    errorNo: '',
                    workTime,
                    startTime,
                    endTime,
                    workers,
                    replacedParts,
                    photos: this.getHistoryPhotosForSave(),
                    isSingleMaintenance: true,
                    isSudden: false,
                    isDokatei: false,
                    isNonProductionStop: false,
                    category,
                    machineCategory,
                    lineNo,
                    isFirstTime: false
                });
            } else {
                newSuddenRecord = store.addHistoryRecord({
                    machineId,
                    date,
                    notes: treatment,
                    cause: cause,
                    errorContent: symptom,
                    errorNo,
                    workTime,
                    startTime,
                    endTime,
                    workers,
                    replacedParts,
                    photos: this.getHistoryPhotosForSave(),
                    isSudden: true,
                    isDokatei,
                    isNonProductionStop,
                    category,
                    machineCategory,
                    lineNo,
                    isFirstTime: document.querySelector('input[name="s-occurrence"]:checked')?.value === 'first',
                    recurrenceGroup: this.getCurrentRecurrenceMeta('s-')
                });
            }
            this.markShiftNotebookRowSuddenRegistered(newSuddenRecord?.id || '');

            // Update Master Category if it's missing or different (Sync back)
            if (machineId && machineCategory && machineId !== 'NEW_MACHINE') {
                const targetM = store.getMachines(true).find(m => m.id === machineId);
                if (targetM && targetM.category !== machineCategory) {
                    store.updateMachine(machineId, { category: machineCategory });
                }
            }

            // Auto-deduct stock
            replacedParts.forEach(p => {
                store.adjustStock(p.name, p.model, -p.count);
            });

            this._tempPhotos = [];

            this.closeModal();
            this.updateDataLists(); // プルダウンを更新
            this.renderCalendar();
            this.renderMachines();
            this.renderHistory();
            this.renderDashboard();
        } else if (type === 'complete') {
            const taskId = document.getElementById('c-task-id').value;
            const machineId = document.getElementById('c-machine-id').value;
            const lineNo = document.getElementById('c-line-no').value;
            const date = document.getElementById('c-date').value;
            const notes = document.getElementById('c-notes').value || '定期メンテナンス完了';
            const machineCategory = this.getCategoryFromModalInput('c-');
            const workTime = document.getElementById('c-work-time').value;
            const workerText = document.getElementById('c-workers').value;
            const category = document.getElementById('c-category').value;

            // Capture Parts (With price)
            const partRows = document.querySelectorAll('#s-parts-container .part-row');
            const replacedParts = [];
            partRows.forEach(row => {
                const nameInput = row.querySelector('.p-name');
                const modelInput = row.querySelector('.p-model');
                const countInput = row.querySelector('.p-count');
                const unitInput = row.querySelector('.p-unit');
                const priceInput = row.querySelector('.p-price');

                if (nameInput && nameInput.value) {
                    replacedParts.push({ 
                        name: MaintenanceStore.toFullWidth(nameInput.value),
                        model: MaintenanceStore.toHalfWidthLower(modelInput ? modelInput.value : ''),
                        count: parseFloat(countInput ? countInput.value : 0) || 0, 
                        unit: unitInput ? unitInput.value : '個',
                        price: parseFloat(priceInput ? priceInput.value : 0) || 0
                    });
                }
            });

            const workers = workerText ? workerText.split(',').map(s => s.trim()).filter(Boolean) : [];
            if (workers.length === 0) {
                alert('作業者は必須です。少なくとも1名入力してください。');
                const workersInput = document.getElementById('c-workers');
                if (workersInput) { workersInput.focus(); workersInput.style.border = '2px solid var(--danger)'; }
                return;
            }

            const task = store.activeData.tasks.find(t => String(t.id) === String(taskId));
            store.addHistoryRecord({
                taskId,
                taskContent: task ? task.content : '定期メンテナンス', // Save fixed label
                machineId,
                date,
                notes,
                workTime,
                workers,
                replacedParts,
                isSudden: false,
                isDokatei: false,
                category,
                machineCategory: machineCategory,
                lineNo,
                isFirstTime: document.querySelector('input[name="c-occurrence"]:checked')?.value === 'first'
            });

            // Update Master Machine Info (Sync back)
            if (machineId) {
                const targetM = store.getMachines(true).find(m => m.id === machineId);
                const updates = {};
                if (machineCategory && targetM?.category !== machineCategory) updates.category = machineCategory;
                if (lineNo && targetM?.lineNo !== lineNo) updates.lineNo = lineNo;
                
                if (Object.keys(updates).length > 0) {
                    store.updateMachine(machineId, updates);
                }
            }

            // Auto-deduct stock
            replacedParts.forEach(p => {
                store.adjustStock(p.name, p.model, -p.count);
            });

            this.closeModal();
            this.renderCalendar();
            this.renderHistory();
            this.renderDashboard();
        } else if (type === 'edit-history') {
            const hId = document.getElementById('e-h-id').value;
            const machineId = document.getElementById('e-machine-id').value;
            const lineNo = document.getElementById('e-line-no').value;
            const date = document.getElementById('e-date').value;
            const symptomElement = document.getElementById('e-symptom') || document.getElementById('e-content');
            const symptom = symptomElement ? symptomElement.value : '';
            const notes = document.getElementById('e-notes').value;
            const cause = document.getElementById('e-cause').value;
            const errorNo = document.getElementById('e-error-no').value;
            const workTime = document.getElementById('e-work-time').value;
            const startTime = document.getElementById('e-start-time')?.value || '';
            const endTime = document.getElementById('e-end-time')?.value || '';
            const workerText = document.getElementById('e-workers').value;
            const isDokatei = document.getElementById('e-is-dokatei').checked;
            const isNonProductionStop = !isDokatei && !!document.getElementById('e-is-non-production-stop')?.checked;
            const machineCategory = this.getCategoryFromModalInput('e-');
            if (!this.confirmPartialMaintenanceTime('e')) return;

            // Capture Parts (Defensive)
            const partRows = document.querySelectorAll('#s-parts-container .part-row');
            const replacedParts = [];
            partRows.forEach(row => {
                const nameInput = row.querySelector('.p-name');
                const modelInput = row.querySelector('.p-model');
                const countInput = row.querySelector('.p-count');
                const unitInput = row.querySelector('.p-unit');
                const priceInput = row.querySelector('.p-price');

                if (nameInput && nameInput.value) {
                    replacedParts.push({ 
                        name: MaintenanceStore.toFullWidth(nameInput.value),
                        model: MaintenanceStore.toHalfWidthLower(modelInput ? modelInput.value : ''),
                        count: parseFloat(countInput ? countInput.value : 0) || 0, 
                        unit: unitInput ? unitInput.value : '個',
                        price: parseFloat(priceInput ? priceInput.value : 0) || 0
                    });
                }
            });

            const workers = workerText ? workerText.split(',').map(s => s.trim()) : [];
            const category = document.getElementById('e-category').value;
            const index = store.activeData.history.findIndex(x => x.id === hId);
            if (index !== -1) {
                const oldRecord = store.activeData.history[index];
                
                // 1. Revert OLD stock
                if (oldRecord.replacedParts) {
                    oldRecord.replacedParts.forEach(p => {
                        store.adjustStock(p.name, p.model, p.count);
                    });
                }

                // 2. Apply NEW stock deduction
                replacedParts.forEach(p => {
                    store.adjustStock(p.name, p.model, -p.count);
                });

                store.activeData.history[index] = {
                    ...store.activeData.history[index],
                    machineId, date, notes, cause, errorContent: symptom, errorNo, workTime, startTime, endTime, workers, replacedParts, isDokatei, isNonProductionStop, category, machineCategory, lineNo,
                    isFirstTime: document.querySelector('input[name="e-occurrence"]:checked')?.value === 'first',
                    recurrenceGroup: this.getCurrentRecurrenceMeta('e-'),
                    photos: this.getHistoryPhotosForSave()
                };

                // Update Master Category (Sync back)
                if (machineId && machineCategory) {
                    const targetM = store.getMachines(true).find(m => m.id === machineId);
                    if (targetM && targetM.category !== machineCategory) {
                        store.updateMachine(machineId, { category: machineCategory });
                    }
                }
                store.save();
            }

            this.updateDataLists();
            this.closeModal();
            this.renderCalendar();
            this.renderHistory();
            this.renderDashboard();
            this._tempPhotos = [];
        } else if (type === 'guide') {
            const hId = document.getElementById('g-h-id').value;
            const html = this.getGuideEditorHtml();
            const text = this.getGuideTextFromRichHtml(html);
            const title = document.getElementById('g-title')?.value.trim() || '';
            const author = document.getElementById('g-author').value;
            const fontSize = this.getGuideFontSize({ fontSize: document.getElementById('g-font-size')?.value });
            const changeNote = document.getElementById('g-change-note')?.value.trim() || '内容更新';
            const tags = document.getElementById('g-tags').value.split(/[,，、\s]+/).map(t => t.trim()).filter(Boolean);

            const index = store.activeData.history.findIndex(x => x.id === hId);
            if (index !== -1) {
                const oldGuide = store.activeData.history[index].guide;
                const version = oldGuide ? `v${this.getNextGuideVersion(oldGuide).toFixed(1)}` : 'v1.0';
                store.activeData.history[index].guide = {
                    title,
                    text,
                    html,
                    author,
                    tags,
                    fontSize,
                    version,
                    updatedAt: new Date().toLocaleString(),
                    changeNote,
                    photos: (this._tempPhotos || []).map(photo => this.normalizeGuidePhoto(photo)).filter(photo => photo.src || photo.videoId),
                    revisions: []
                };
                store.save();
            }

            this.renderHistory();
            this.renderGuides();
        } else if (type === 'part-master') {
            const name = document.getElementById('pm-name').value;
            const model = document.getElementById('pm-model').value;
            const priceRaw = document.getElementById('pm-price-raw')?.value || '';
            const supplier = document.getElementById('pm-supplier').value;
            const shelf = document.getElementById('pm-shelf')?.value || '';
            const remarks = document.getElementById('pm-remarks').value;
            const photo = document.getElementById('pm-photo-base64').value; // New
            const existingPartMaster = store.getPartMaster(name, model);
            const previousSeedKeys = new Set((existingPartMaster?.seeds || []).map(seed => `${seed.name}___${seed.model || ''}`));
            const seedLines = (document.getElementById('pm-seeds')?.value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            const seeds = seedLines
                .map(line => this.parsePartAliasLine(line))
                .filter(seed => seed?.name && !(seed.name === name && (seed.model || '') === (model || '')))
                .map(seed => ({ name: seed.name, model: seed.model || '' }));
            const addedSeeds = seeds.filter(seed => !previousSeedKeys.has(`${seed.name}___${seed.model || ''}`));
            const aliasDeleteCandidates = this.getPartAliasMasterDeletionCandidates(seeds, name, model);
            const shouldDeleteAliasCards = aliasDeleteCandidates.length
                ? confirm(`名寄せした部品カードを削除しますか？\n\n${aliasDeleteCandidates.map(part => `・${part.name}${part.model ? ` [${part.model}]` : ''}`).join('\n')}\n\nOKを押すと、これらのカードは部品マスター一覧から消えます。履歴は正式名へ名寄せして集計されます。`)
                : false;

            // Parse "price/weightKG" or plain number
            let computedPrice = 0;
            const slashIdx = priceRaw.indexOf('/');
            if (slashIdx !== -1) {
                const totalPrice = parseFloat(priceRaw.substring(0, slashIdx));
                const weightKg = parseFloat(priceRaw.substring(slashIdx + 1));
                if (!isNaN(totalPrice) && !isNaN(weightKg) && weightKg > 0) {
                    computedPrice = totalPrice / (weightKg * 1000); // price per gram
                }
            } else {
                computedPrice = parseFloat(priceRaw) || 0;
            }

            const stock = document.getElementById('pm-stock')?.value || 0;
            const minStock = document.getElementById('pm-min-stock')?.value || 0;
            const unit = document.getElementById('pm-unit')?.value || '個';

            store.updatePartMaster(name, model, {
                price: computedPrice,
                priceRaw: priceRaw,
                supplier,
                shelf,
                remarks,
                photo,
                stock: parseFloat(stock),
                minStock: parseFloat(minStock),
                unit,
                seeds
            });
            if (addedSeeds.length) {
                this.addSystemActivityLog?.('部品名寄せ', `${name}${model ? ` [${model}]` : ''} に ${addedSeeds.length}件の別名を追加`, {
                    canonical: { name, model },
                    aliases: addedSeeds,
                    level: 'info'
                });
            }
            if (shouldDeleteAliasCards) {
                const deletedParts = aliasDeleteCandidates.map(part => ({ ...part }));
                const deletedCount = this.deletePartMasterCardsForAliases(aliasDeleteCandidates, name, model);
                if (deletedCount > 0) {
                    const logId = this.addSystemActivityLog?.('部品カード削除', `名寄せ元カード ${deletedCount}件を削除`, {
                        canonical: { name, model },
                        deletedParts,
                        level: 'warning'
                    });
                    const log = (store.activeData.systemActivityLogs || []).find(item => item.id === logId);
                    if (log) {
                        log.restoreAction = `app.restoreDeletedPartMasterLog('${this.escapeJs(logId)}')`;
                    }
                    store.save();
                    this.showToast?.(`${deletedCount}件の名寄せ元カードを削除しました`);
                }
            }
            this.closeModal();
            this.renderAnalysis();
        } else if (type === 'substitute') {
            const oldName = document.getElementById('sub-old-name').value;
            const oldModel = document.getElementById('sub-old-model').value;
            const newName = document.getElementById('sub-new-name').value;
            const newModel = document.getElementById('sub-new-model').value;
            const newPrice = document.getElementById('sub-new-price').value;

            const existingMaster = store.getPartMaster(oldName, oldModel);
            const updates = {
                name: newName,
                model: newModel,
                price: newPrice ? parseFloat(newPrice) : (existingMaster?.price || 0),
                supplier: existingMaster?.supplier || '',
                remarks: existingMaster?.remarks || ''
            };

            store.updatePartMaster(oldName, oldModel, updates, true); // true = isSubstitute
            this.closeModal();
            this.renderAnalysis();
        }
        } catch (err) {
            console.error('Save error:', err);
            alert('保存中にエラーが発生しました: ' + err.message);
        }
    }

    updateDataLists() {
        const history = store.activeData.history || [];
        const machines = store.getMachines(true);
        const getUnique = (list) => [...new Set(list)].filter(Boolean).sort();

        // 1. Populate Datalists for Suggestions
        const allParts = history.flatMap(h => h.replacedParts || []);
        const partNames = getUnique(allParts.map(p => p.name));
        const partModels = getUnique(allParts.map(p => p.model));
        const workers = getUnique(history.flatMap(h => h.workers || []));
        const nodes = getUnique(history.map(h => h.notes));
        const causes = getUnique(history.map(h => h.cause));
        const mNames = getUnique(machines.map(m => m.name));
        const mModels = getUnique(machines.map(m => m.model));
        const mCategories = getUnique(store.activeData.machineCategories || []);

        const inject = (id, vals) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = vals.map(v => `<option value="${v}">`).join('');
        };
        inject('list-part-names', partNames);
        inject('list-part-models', partModels);
        inject('list-workers', workers);
        inject('list-contents', nodes);
        inject('list-causes', causes);
        inject('list-m-names', mNames);
        inject('list-m-models', mModels);
        inject('list-machine-categories', mCategories);

        // 2. Populate Machine Filter Dropdown in History View
        const machineFilter = document.getElementById('hist-filter-machine');
        if (machineFilter) {
            const currentVal = machineFilter.value;
            machineFilter.innerHTML = '<option value="">全機械</option>';
            machines.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = `${m.name} [${MaintenanceApp.toHalfWidthLower(m.model)}]`;
                machineFilter.appendChild(opt);
            });
            // 以前の選択がまだ存在すれば値を保持
            if (machines.some(m => m.id === currentVal)) {
                machineFilter.value = currentVal;
            }
        }

        // 3. Populate Line Filters in Ranking/Analysis View
        const lineSet = new Set();
        machines.forEach(m => { if (m.lineNo) lineSet.add(m.lineNo); });
        history.forEach(h => { if (h.lineNo) lineSet.add(h.lineNo); });
        const sortedLines = Array.from(lineSet).sort((a, b) => a - b);

        const populateLines = (id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const current = el.value;
            el.innerHTML = '<option value="all">全ライン</option>' + 
                sortedLines.map(l => `<option value="${l}">${this.getLineLabel(l)}</option>`).join('');
            el.value = current || 'all';
        };
        populateLines('ranking-filter-line');
        populateLines('analysis-filter-line');
    }


    getPartUsageStats(name, model) {
        const history = store.activeData.history || [];
        const normName = MaintenanceStore.toFullWidth(name);
        const normModel = MaintenanceStore.toHalfWidthLower(model);
        
        let totalCount = 0;
        let firstDate = null;
        
        history.forEach(h => {
            if (!h.date || !h.replacedParts || h.replacedParts.length === 0) return;
            h.replacedParts.forEach(p => {
                if (MaintenanceStore.toFullWidth(p.name) === normName && MaintenanceStore.toHalfWidthLower(p.model || '') === normModel) {
                    totalCount += (parseFloat(p.count) || 0);
                    const d = new Date(h.date);
                    if (!isNaN(d.getTime())) {
                        if (!firstDate || d < firstDate) firstDate = d;
                    }
                }
            });
        });
        
        if (totalCount === 0 || !firstDate) return { totalCount: 0, cycle: '記録なし' };
        
        const today = new Date();
        const durationDays = Math.ceil((today - firstDate) / (1000 * 60 * 60 * 24)) || 1;
        const cycle = (durationDays / totalCount).toFixed(1);
        
        return {
            totalCount,
            durationDays,
            cycle: `約 ${cycle}日`
        };
    }

    openGuideModal(hId) {
        const h = store.activeData.history.find(x => x.id === hId);
        const machine = store.getMachines(true).find(m => m.id === h.machineId);
        let guide = h.guide;
        let isRef = false;
        if (!guide) {
            const taskTitle = this.getHistoryDisplayText(h);
            const found = store.activeData.history.find(r => r.id !== h.id && r.machineId === h.machineId && this.getHistoryDisplayText(r) === taskTitle && r.guide);
            if (found) { guide = { ...found.guide }; isRef = true; }
        }
        if (!guide) guide = { text: '', author: '', photos: [] };
        const versionLabel = this.getGuideVersionLabel(guide);
        const guideTitle = this.getGuideDisplayTitle?.(h, guide) || this.getHistoryDisplayText(h);
        const guideTitleCandidates = this.getGuideTitleCandidates?.(h, machine) || [];
        this._tempPhotos = (guide.photos || []).map(photo => this.normalizeGuidePhoto(photo)).filter(photo => photo.src || photo.videoId);

        this.openModal('guide', '作業手順書（ナレッジベース）', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <input type="hidden" id="g-h-id" value="${hId}">
                ${isRef ? `
                <div style="background:var(--secondary-light); color:var(--secondary); padding:10px 16px; border-radius:8px; margin-bottom:12px; font-size:0.75rem; border:1px solid var(--secondary); font-weight:800;">
                    <i class="fa-solid fa-circle-info"></i> 過去の同一作業から手順書を自動参照しています。今回用に編集して保存できます。
                </div>` : ''}
                <div style="background:var(--primary-light); padding:12px; border-radius:8px; margin-bottom:16px;">
                    <div style="font-size:0.8rem; font-weight:800; color:var(--primary)">対象</div>
                    <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
                        <div style="font-size:1.1rem; font-weight:900;">${machine?.name || '不明'} [${machine?.model || '-'}]</div>
                        <span class="guide-version-pill">${this.escapeHtml(versionLabel)}</span>
                    </div>
                    <div style="font-weight:700;">元の履歴: ${this.escapeHtml(this.getHistoryDisplayText(h))}</div>
                </div>

                <div class="form-group" style="margin-bottom:16px;">
                    <label>手順書タイトル</label>
                    <input type="text" id="g-title" placeholder="例: 搬送ベルトの交換手順" value="${this.escapeHtml(guideTitle)}" oninput="app.autoSaveGuideDraftFromModal()">
                    ${guideTitleCandidates.length ? `
                        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
                            ${guideTitleCandidates.map(candidate => `
                                <button type="button" class="tag-badge" style="cursor:pointer;" onclick="app.applyGuideTitleCandidate('${this.escapeJs(candidate)}')">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i> ${this.escapeHtml(candidate)}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div style="font-size:0.75rem; color:var(--text-light); margin-top:6px;">ここを変更すると、ナレッジDB上の手順書タイトルとして上書きされます。</div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                    <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                        <div style="font-size:0.7rem; font-weight:800; color:var(--text-light); margin-bottom:4px;"><i class="fa-solid fa-magnifying-glass"></i> 原因</div>
                        <div style="font-size:0.85rem; font-weight:700; white-space:pre-wrap;">${h.cause || '(未入力)'}</div>
                    </div>
                    <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                        <div style="font-size:0.7rem; font-weight:800; color:var(--text-light); margin-bottom:4px;"><i class="fa-solid fa-screwdriver-wrench"></i> 処置内容</div>
                        <div style="font-size:0.85rem; font-weight:700; white-space:pre-wrap;">${h.notes || '(未入力)'}</div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                    <div class="form-group">
                        <label>作成者</label>
                        <input type="text" id="g-author" placeholder="例: メンテナンス 田中" value="${this.escapeHtml(guide.author || '')}" list="list-workers">
                    </div>
                    <div class="form-group">
                        <label>タグ (カンマ区切り)</label>
                        <input type="text" id="g-tags" placeholder="例: 油漏れ, センサー異常" value="${this.escapeHtml((guide.tags || []).join(', '))}">
                    </div>
                </div>

                <div class="guide-edit-layout">
                    <div class="guide-edit-main">
                        <div class="form-group">
                            <label>手順書・技術メモ</label>
                            <div class="guide-photo-token-help">右の写真ボタンで本文中に [[写真1]] を挿入できます。</div>
                            <div class="guide-text-controls">
                                <label>
                                    <span>文字サイズ</span>
                                    <input type="number" id="g-font-size" min="9" max="24" step="1" value="${this.getGuideFontSize(guide)}" oninput="app.updateGuideTextLayout(); app.autoSaveGuideDraftFromModal();">
                                    <b>pt</b>
                                </label>
                                <label>
                                    <span>書体</span>
                                    <select id="g-font-family">
                                        <option value="gothic">ゴシック</option>
                                        <option value="meiryo">メイリオ</option>
                                        <option value="mincho">明朝</option>
                                        <option value="maru">丸め</option>
                                        <option value="mono">等幅</option>
                                    </select>
                                </label>
                                <button type="button" class="guide-inline-format-btn" onclick="app.applyGuideTextInlineFormat('font')">選択書体</button>
                                <button type="button" class="guide-inline-format-btn" onclick="app.applyGuideTextInlineFormat('bold')">太字</button>
                                <label>
                                    <span>色</span>
                                    <input type="color" id="g-font-color" value="${this.getGuideFontColor(guide)}">
                                </label>
                                <button type="button" class="guide-inline-format-btn" onclick="app.applyGuideTextInlineFormat('color')">選択色</button>
                                <span id="g-line-char-count"></span>
                            </div>
                            <div class="guide-font-note">※ ゴシック以外の書体を使うと、印刷時の適切な改行ポイントがずれる場合があります。青線は印刷時の改ページ位置の目安です。</div>
                            <div class="guide-editor-page-wrap">
                                <div id="g-text" class="guide-detail-textarea guide-rich-editor" contenteditable="true" spellcheck="false" data-placeholder="次回同じトラブルが起きた際の参考となる手順、重要なポイントなどを記入してください。" oninput="app.rememberGuideEditorSelection(); app.autoSaveGuideDraftFromModal(); app.updateGuidePageBreakGuides(); app.updateGuidePhotoTokenHighlights()" onkeyup="app.rememberGuideEditorSelection(); app.updateGuidePageBreakGuides(); app.updateGuidePhotoTokenHighlights()" onmouseup="app.rememberGuideEditorSelection()" onfocus="app.rememberGuideEditorSelection(); app.updateGuidePageBreakGuides(); app.updateGuidePhotoTokenHighlights()" onscroll="app.updateGuidePageBreakGuides()">${this.sanitizeGuideRichHtml(guide.html || this.getGuideRichHtmlFromText(guide.text || ''))}</div>
                                <div id="g-page-break-guides" class="guide-page-break-guides" aria-hidden="true"></div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>今回の変更内容</label>
                            <input type="text" id="g-change-note" placeholder="例: 写真を追加、注意点を追記、手順2を修正">
                        </div>
                    </div>

                    <aside class="guide-photo-side">
                        <label>手順写真・参考資料</label>
                        <div class="attachment-input-actions">
                            <input type="file" id="g-photos" accept="image/*" multiple>
                            <button type="button" class="secondary-btn registered-video-attach-btn" onclick="app.openRegisteredVideoAttachmentPicker('guide')"><i class="fa-solid fa-video"></i> 登録動画</button>
                        </div>
                        <div class="guide-photo-compress-note"><i class="fa-solid fa-gauge-high"></i> 追加画像は選択中の設定で自動軽量化します。</div>
                        ${this.getGuideImageCompressionPresetHtml()}
                        <div id="g-photo-previews" class="guide-photo-previews"></div>
                    </aside>
                </div>
            `;
            this.updateGuideTextLayout();
            this.setupGuidePageBreakResizeObserver();
            this.updateGuidePhotoTokenHighlights();

            this.renderGuidePhotoPreviews();

            const photoIn = document.getElementById('g-photos');
            photoIn.onchange = async (e) => {
                const files = Array.from(e.target.files);
                const compressionResults = [];
                for (const file of files) {
                    const result = await this.prepareGuidePhotoFromFile(file);
                    this._tempPhotos.push(result.photo);
                    compressionResults.push(result);
                }
                this.showGuideImageCompressionNotice(compressionResults);
                this.autoSaveGuideDraftFromModal();
                this.renderGuidePhotoPreviews();
                e.target.value = '';
            };

            // Add Print button to footer
            const footer = document.querySelector('.modal-footer');
            const closeFooterBtn = footer?.querySelector('.secondary-btn[onclick="app.closeModal()"]');
            if (closeFooterBtn) {
                closeFooterBtn.textContent = '閉じる';
                closeFooterBtn.title = '画面を閉じる';
            }
            footer.insertAdjacentHTML('afterbegin', `
                <button class="secondary-btn" style="margin-right:auto" onclick="app.printGuide('${hId}')">
                    <i class="fa-solid fa-print"></i> 印刷する
                </button>
                <button class="secondary-btn" onclick="app.openGuideVersionHistory('${hId}')">
                    <i class="fa-solid fa-clock-rotate-left"></i> 変更ログ
                </button>
                <div class="app-save-status modal-save-status saved" title="保存状態">
                    <i class="fa-solid fa-circle-check"></i><span>保存済み</span>
                </div>
            `);
        });
    }

    getGuideVersionNumber(guide) {
        const raw = String(guide?.version || '1.0').replace(/^v/i, '');
        const num = parseFloat(raw);
        return Number.isFinite(num) ? num : 1.0;
    }

    getGuideVersionLabel(guide) {
        return `v${this.getGuideVersionNumber(guide).toFixed(1)}`;
    }

    getNextGuideVersion(guide) {
        return Math.round((this.getGuideVersionNumber(guide) + 0.1) * 10) / 10;
    }

    getGuideFontSize(guide = {}) {
        return Math.max(9, Math.min(24, Number(guide.fontSize) || 11));
    }

    getGuideFontKey(guide = {}) {
        const key = String(guide.fontFamily || 'gothic');
        return ['gothic', 'meiryo', 'mincho', 'maru', 'mono'].includes(key) ? key : 'gothic';
    }

    getGuideFontFamilyCss(guide = {}) {
        const fonts = {
            gothic: '"Yu Gothic", "Meiryo", sans-serif',
            meiryo: '"Meiryo", sans-serif',
            mincho: '"Yu Mincho", "MS Mincho", serif',
            maru: '"Yu Gothic", "Meiryo", sans-serif',
            mono: '"MS Gothic", "Consolas", monospace'
        };
        return fonts[this.getGuideFontKey(guide)];
    }

    getGuideFontColor(guide = {}) {
        return /^#[0-9a-f]{6}$/i.test(guide.fontColor || '') ? guide.fontColor : '#111827';
    }

    sanitizeGuideRichHtml(html = '') {
        const template = document.createElement('template');
        template.innerHTML = String(html || '');
        const allowed = new Set(['DIV', 'P', 'BR', 'B', 'STRONG', 'SPAN', 'FONT']);
        const toSafeHexColor = (value = '') => {
            const text = String(value || '').trim();
            const shortHex = text.match(/^#([0-9a-fA-F]{3})$/);
            if (shortHex) {
                return `#${shortHex[1].split('').map(char => char + char).join('')}`;
            }
            const hex = text.match(/^#[0-9a-fA-F]{6}$/);
            if (hex) return text;
            const rgb = text.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
            if (!rgb) return '';
            const parts = rgb.slice(1).map(part => Math.max(0, Math.min(255, Number(part) || 0)));
            return `#${parts.map(part => part.toString(16).padStart(2, '0')).join('')}`;
        };
        const toSafeFontFamily = (value = '') => {
            const family = String(value || '').replace(/[<>{}]/g, '').trim();
            if (!family || /url|expression|javascript/i.test(family)) return '';
            return family;
        };
        const getStyleValue = (style = '', name = '') => {
            const match = String(style || '').match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'i'));
            return match ? match[1].trim() : '';
        };
        const cleanNode = (node) => {
            Array.from(node.childNodes).forEach(child => {
                if (child.nodeType === Node.TEXT_NODE) return;
                if (child.nodeType !== Node.ELEMENT_NODE) {
                    child.remove();
                    return;
                }
                const originalStyle = child.getAttribute('style') || '';
                const originalColor = child.getAttribute('color') || '';
                const originalFace = child.getAttribute('face') || '';
                cleanNode(child);
                if (!allowed.has(child.tagName)) {
                    child.replaceWith(...Array.from(child.childNodes));
                    return;
                }
                let target = child;
                if (child.tagName === 'FONT') {
                    target = document.createElement('span');
                    target.append(...Array.from(child.childNodes));
                    child.replaceWith(target);
                }
                Array.from(target.attributes).forEach(attr => target.removeAttribute(attr.name));
                if (target.tagName === 'SPAN') {
                    const parts = [];
                    const color = toSafeHexColor(originalColor || getStyleValue(originalStyle, 'color'));
                    const family = toSafeFontFamily(originalFace || getStyleValue(originalStyle, 'font-family'));
                    if (color) parts.push(`color:${color}`);
                    if (family) parts.push(`font-family:${family}`);
                    if (parts.length) target.setAttribute('style', parts.join(';'));
                }
            });
        };
        cleanNode(template.content);
        return template.innerHTML;
    }

    getGuideRichHtmlFromText(text = '') {
        return this.escapeHtml(text || '').replace(/\n/g, '<br>');
    }

    getGuideTextFromRichHtml(html = '') {
        const div = document.createElement('div');
        div.innerHTML = this.sanitizeGuideRichHtml(html);
        return (div.innerText || '').replace(/\u00a0/g, ' ').trim();
    }

    getGuideLineChars(fontSize = 11) {
        return Math.max(22, Math.min(72, Math.round(45 * 11 / Math.max(9, Number(fontSize) || 11))));
    }

    updateGuideTextLayout() {
        const textarea = document.getElementById('g-text');
        const sizeInput = document.getElementById('g-font-size');
        const countLabel = document.getElementById('g-line-char-count');
        if (!textarea || !sizeInput) return;
        const fontSize = this.getGuideFontSize({ fontSize: sizeInput.value });
        const chars = this.getGuideLineChars(fontSize);
        const wrap = textarea.closest('.guide-editor-page-wrap');
        textarea.style.setProperty('--guide-font-size', `${fontSize}pt`);
        textarea.style.setProperty('--guide-line-chars', chars);
        textarea.style.setProperty('--guide-editor-width', `${chars + 2}em`);
        textarea.style.setProperty('--guide-first-page-break', '878px');
        textarea.style.setProperty('--guide-page-height', '1074px');
        if (wrap) {
            wrap.style.setProperty('--guide-font-size', `${fontSize}pt`);
            wrap.style.setProperty('--guide-line-chars', chars);
            wrap.style.setProperty('--guide-editor-width', `${chars + 2}em`);
        }
        textarea.cols = chars;
        if (countLabel) countLabel.textContent = `${chars}字/行`;
        this.updateGuidePageBreakGuides();
    }

    setupGuidePageBreakResizeObserver() {
        const editor = document.getElementById('g-text');
        if (!editor || typeof ResizeObserver === 'undefined') return;
        this._guidePageBreakResizeObserver?.disconnect?.();
        this._guidePageBreakResizeObserver = new ResizeObserver(() => {
            window.requestAnimationFrame(() => this.updateGuidePageBreakGuides());
        });
        this._guidePageBreakResizeObserver.observe(editor);
    }

    updateGuidePageBreakGuides() {
        const editor = document.getElementById('g-text');
        const guideLayer = document.getElementById('g-page-break-guides');
        if (!editor || !guideLayer) return;
        this.updateGuidePhotoTokenHighlights();
        const firstBreak = 720;
        const pageHeight = 1074;
        const editorHeight = Math.max(1, editor.clientHeight || 0);
        const visibleHeight = Math.max(editorHeight, editor.scrollHeight || 0);
        const scrollTop = editor.scrollTop || 0;
        const photoBlocks = this.getGuideEditorPhotoBlocks(editor);
        const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight) || 24;
        const calibrationOffset = lineHeight * 3;
        const photoLineCorrection = photoBlocks.length && !this._guidePhotoHeightsAligned ? lineHeight : 0;
        const lines = [];
        for (let top = firstBreak; top <= visibleHeight + scrollTop + pageHeight; top += pageHeight) {
            let adjustedTop = top;
            for (let pass = 0; pass < 4; pass++) {
                const photoShift = photoBlocks
                    .filter(block => block.top < adjustedTop)
                    .reduce((sum, block) => sum + block.extraHeight, 0);
                const nextTop = top - photoShift;
                if (Math.abs(nextTop - adjustedTop) < 1) break;
                adjustedTop = nextTop;
            }
            const rawY = adjustedTop + calibrationOffset + photoLineCorrection - (lineHeight / 2) - scrollTop;
            const y = 10 + Math.round((rawY - 10) / lineHeight) * lineHeight;
            if (y < 0 || y > editorHeight) continue;
            lines.push(`<div class="guide-page-break-line" style="top:${y}px;"></div>`);
        }
        if (!lines.length) {
            const fallbackRawTop = Math.max(140, Math.min(firstBreak, editorHeight - 90));
            const fallbackTop = 10 + Math.round((fallbackRawTop - 10) / lineHeight) * lineHeight;
            lines.push(`<div class="guide-page-break-line visible-sample" style="top:${fallbackTop}px;"></div>`);
        }
        guideLayer.innerHTML = lines.join('');
    }

    updateGuidePhotoTokenHighlights() {
        const editor = document.getElementById('g-text');
        if (!editor || !window.CSS?.highlights || typeof Highlight === 'undefined') return;
        const ranges = [];
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const text = node.nodeValue || '';
            const pattern = /\[\[写真\d+\]\]/g;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                ranges.push(range);
            }
        }
        CSS.highlights.set('guide-photo-token', new Highlight(...ranges));
    }

    clearGuidePhotoTokenHighlights() {
        if (window.CSS?.highlights) CSS.highlights.delete('guide-photo-token');
    }

    getGuideEditorPhotoBlocks(editor) {
        const photos = (this._tempPhotos || []).map(photo => this.normalizeGuidePhoto(photo));
        if (!editor || !photos.length) return [];
        const editorRect = editor.getBoundingClientRect();
        const lineHeight = Number.parseFloat(getComputedStyle(editor).lineHeight) || 24;
        const contentWidth = Math.max(1, editor.clientWidth - 24);
        const tokenBlocks = [];
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            const text = node.nodeValue || '';
            const pattern = /\[\[写真(\d+)\]\]/g;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const photoIndex = Number(match[1]) - 1;
                const photo = photos[photoIndex];
                if (!photo?.src) continue;
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                const rect = range.getBoundingClientRect();
                range.detach?.();
                const tokenTop = rect.height
                    ? rect.top - editorRect.top + (editor.scrollTop || 0)
                    : 0;
                const size = this.getGuidePhotoNaturalSizeSync(photo.src);
                const aspect = Math.max(0.05, (size.height || 1) / Math.max(1, size.width || 1));
                const printSize = Math.max(20, Math.min(100, Number(photo.printSize) || 72));
                const isPending = !!size.pending;
                const estimatedHeightRaw = isPending
                    ? contentWidth * 0.42
                    : Math.min(420, contentWidth * (printSize / 100) * aspect);
                const estimatedHeight = estimatedHeightRaw * 0.95;
                tokenBlocks.push({
                    top: tokenTop,
                    height: estimatedHeight
                });
            }
        }
        const rowMap = new Map();
        tokenBlocks.forEach(block => {
            const key = Math.round(block.top / Math.max(1, lineHeight)) * Math.max(1, lineHeight);
            const current = rowMap.get(key) || { top: block.top, height: 0 };
            current.top = Math.min(current.top, block.top);
            current.height = Math.max(current.height, block.height);
            rowMap.set(key, current);
        });
        return Array.from(rowMap.values()).map(block => ({
            top: block.top,
            extraHeight: Math.max(0, block.height + 34 - lineHeight)
        }));
    }

    getGuideEditorHtml() {
        const editor = document.getElementById('g-text');
        return this.sanitizeGuideRichHtml(editor?.innerHTML || '');
    }

    normalizeGuideRevision(revision) {
        return {
            version: revision?.version || 'v1.0',
            updatedAt: revision?.updatedAt || '',
            title: String(revision?.title || '').trim(),
            author: revision?.author || '',
            changeNote: revision?.changeNote || '',
            text: revision?.text || '',
            html: this.sanitizeGuideRichHtml(revision?.html || this.getGuideRichHtmlFromText(revision?.text || '')),
            tags: Array.isArray(revision?.tags) ? revision.tags : [],
            photos: Array.isArray(revision?.photos) ? revision.photos.map(photo => this.normalizeGuidePhoto(photo)).filter(photo => photo.src) : [],
            fontSize: this.getGuideFontSize(revision)
        };
    }

    openGuideVersionHistory(hId) {
        const h = store.activeData.history.find(x => String(x.id) === String(hId));
        if (!h?.guide) return alert('まず手順書を保存してください。');
        const current = this.normalizeGuideRevision({
            ...h.guide,
            version: this.getGuideVersionLabel(h.guide),
            changeNote: '現在の版'
        });
        const revisions = [...(h.guide.revisions || []).map(r => this.normalizeGuideRevision(r)), current]
            .sort((a, b) => this.getGuideVersionNumber({ version: b.version }) - this.getGuideVersionNumber({ version: a.version }));

        this.openModal('guide-version-history', '手順書の変更ログ', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="guide-version-list">
                    ${revisions.length <= 1 ? `
                        <div class="storage-duplicate-note">
                            <i class="fa-solid fa-circle-info"></i>
                            容量を抑えるため、古い手順書バージョンは保存しない設定です。現在の最新版だけを保持しています。
                        </div>
                    ` : ''}
                    ${revisions.map((rev, idx) => {
                        const isCurrent = idx === 0;
                        return `
                            <article class="guide-version-card ${isCurrent ? 'current' : ''}">
                                <div class="guide-version-card-head">
                                    <span>${this.escapeHtml(rev.version)}</span>
                                    <b>${this.escapeHtml(rev.updatedAt || '-')}</b>
                                    ${isCurrent ? '<em>現在</em>' : ''}
                                </div>
                                <div class="guide-version-meta">
                                    更新者: ${this.escapeHtml(rev.author || '不明')} / 変更内容: ${this.escapeHtml(rev.changeNote || '未入力')}
                                </div>
                                ${rev.title ? `<div class="guide-version-meta">タイトル: ${this.escapeHtml(rev.title)}</div>` : ''}
                                <div class="guide-version-preview">${this.escapeHtml(rev.text || '').slice(0, 180).replace(/\n/g, '<br>')}</div>
                                ${isCurrent ? '' : `
                                    <button type="button" class="secondary-btn" onclick="app.rollbackGuideVersion('${this.escapeJs(hId)}', '${this.escapeJs(rev.version)}')">
                                        <i class="fa-solid fa-rotate-left"></i> この版へ戻す
                                    </button>
                                `}
                            </article>
                        `;
                    }).join('')}
                </div>
            `;
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.style.display = 'none';
        });
    }

    rollbackGuideVersion(hId, version) {
        const h = store.activeData.history.find(x => String(x.id) === String(hId));
        if (!h?.guide) return;
        const target = (h.guide.revisions || []).find(r => String(r.version) === String(version));
        if (!target) return alert('指定した版が見つかりません。');
        if (!confirm(`${version} の内容へ戻しますか？\n容量を抑えるため、現在の内容は古い版として保存しません。`)) return;

        const currentGuide = h.guide;
        const nextVersion = this.getNextGuideVersion(currentGuide);

        h.guide = {
            title: target.title || currentGuide.title || '',
            text: target.text || '',
            html: this.sanitizeGuideRichHtml(target.html || this.getGuideRichHtmlFromText(target.text || '')),
            author: target.author || currentGuide.author || '',
            tags: Array.isArray(target.tags) ? [...target.tags] : [],
            photos: Array.isArray(target.photos) ? target.photos.map(photo => this.normalizeGuidePhoto(photo)).filter(photo => photo.src) : [],
            version: `v${nextVersion.toFixed(1)}`,
            updatedAt: new Date().toLocaleString(),
            changeNote: `${version} へロールバック`,
            revisions: []
        };
        store.save();
        this.closeModal();
        this.openGuideModal(hId);
        this.renderGuides();
        this.renderHistory();
    }

    async printGuide(hId) {
        const h = store.activeData.history.find(x => x.id === hId);
        const machine = store.getMachines(true).find(m => m.id === h.machineId);
        const guide = h.guide;
        if (!guide) return alert('まず手順書を保存してください。');

        const printWindow = window.open('', '_blank');
        const fontSize = this.getGuideFontSize(guide);
        const lineChars = this.getGuideLineChars(fontSize);
        const printLineChars = Math.max(22, lineChars - 4);
        const guideTitle = this.getGuideDisplayTitle?.(h, guide) || this.getHistoryDisplayText(h);
        const guideContentHTML = await this.renderGuideTextWithPhotoTokens(guide);
        const photosHTML = await this.renderGuideUnreferencedPhotosHtml(guide);

        printWindow.document.write(`
            <html>
                <head>
                    <title>作業手順書 - ${machine?.name}</title>
                    <style>
                        body { font-family: sans-serif; padding: 24px 36px; }
                        h1 { border-bottom: 2px solid #333; padding-bottom: 6px; margin: 0 0 14px; font-size: 24pt; line-height: 1.2; }
                        .meta { width: ${printLineChars}em; max-width: 100%; margin-bottom: 18px; padding: 4px 0 10px; border-bottom: 1px dashed #bbb; font-size: 11pt; line-height: 1.45; }
                        .meta-grid { display:grid; grid-template-columns:max-content max-content; gap:6px 32px; justify-content:start; }
                        .meta-wide { grid-column: span 2; }
                        .meta-notes { border-top: 1px dashed #ddd; padding-top: 6px; margin-top: 2px; }
                        .content { white-space: normal; line-height: 1.6; font-size: ${fontSize}pt; width: ${printLineChars}em; max-width: 100%; font-family: "Yu Gothic", "Meiryo", sans-serif; font-weight: 400; color: #111827; }
                        .guide-inline-photo { display: block; width: var(--guide-photo-size, 72%); max-width: 100%; max-height: 420px; margin: 14px 0 20px; border: 1px solid #ccc; object-fit: contain; }
                        .guide-inline-photo-row { display: flex; gap: 10px; align-items: flex-start; margin: 14px 0 20px; max-width: 100%; }
                        .guide-inline-photo-row .guide-inline-photo { flex: 0 1 var(--guide-photo-size, 72%); min-width: 0; max-width: var(--guide-photo-size, 72%); width: var(--guide-photo-size, 72%); max-height: 360px; margin: 0; }
                        .guide-photo-rest { margin-top: 40px; }
                        .guide-photo-rest img { max-width: 45%; margin: 10px; border: 1px solid #ccc; }
                        @media print { .no-print { display:none; } }
                    </style>
                </head>
                <body>
                    <div class="no-print" style="margin-bottom:20px;">
                        <button onclick="window.print()">印刷実行</button>
                    </div>
                    <h1>作業手順書: ${this.escapeHtml(guideTitle)}</h1>
                    <div class="meta">
                        <div class="meta-grid">
                            <div><strong>機械:</strong> ${this.escapeHtml(machine?.name || '')} [${this.escapeHtml(machine?.model || '')}]</div>
                            <div><strong>作成者:</strong> ${this.escapeHtml(guide.author || '不明')}</div>
                            <div><strong>記録日:</strong> ${this.escapeHtml(h.date || '')}</div>
                            <div><strong>手順書最終更新:</strong> ${this.escapeHtml(guide.updatedAt || '-')}</div>
                            <div class="meta-wide"><strong>元の履歴:</strong> ${this.escapeHtml(this.getHistoryDisplayText(h))}</div>
                            <div class="meta-wide meta-notes">
                                <strong>【原因】:</strong> ${this.escapeHtml(h.cause || '(点検記録に未入力)')}
                            </div>
                            <div class="meta-wide">
                                <strong>【処置内容】:</strong> ${this.escapeHtml(h.notes || '(点検記録に未入力)')}
                            </div>
                        </div>
                    </div>
                    <div class="content">${guideContentHTML}</div>
                    ${photosHTML ? `<div class="guide-photo-rest">${photosHTML}</div>` : ''}
                </body>
            </html>
        `);
        printWindow.document.close();
    }

    getGuideReferencedPhotoNumbers(text = '') {
        const numbers = new Set();
        String(text || '').replace(/\[\[写真(\d+)\]\]/g, (_, rawNumber) => {
            const number = Number(rawNumber);
            if (Number.isFinite(number) && number > 0) numbers.add(number);
            return '';
        });
        return numbers;
    }

    async getGuidePrintablePhotoSrc(photo = {}) {
        const normalized = this.normalizeGuidePhoto(photo);
        if (!normalized.src) return '';
        if (!normalized.marks?.length || typeof this.renderPhotoManagerImageWithMarks !== 'function') return normalized.src;
        try {
            return await this.renderPhotoManagerImageWithMarks({
                source: 'guide',
                src: normalized.src,
                marks: normalized.marks,
                annotated: true
            });
        } catch (error) {
            console.error('Guide photo mark render failed', error);
            return normalized.src;
        }
    }

    async renderGuideTextWithPhotoTokens(guide = {}) {
        const sourceHtml = this.sanitizeGuideRichHtml(guide.html || this.getGuideRichHtmlFromText(guide.text || ''));
        const photos = Array.isArray(guide.photos) ? guide.photos.map(photo => this.normalizeGuidePhoto(photo)) : [];
        const tokenPattern = /\[\[写真(\d+)\]\]/g;
        const tokenRunPattern = /(?:\[\[写真\d+\]\](?:\s|&nbsp;|<br\s*\/?>)*)+/g;
        let html = '';
        let lastIndex = 0;
        let match;
        const renderPhoto = async (photoIndex) => {
            const photo = photos[photoIndex];
            if (!photo?.src) {
                return `<span style="color:#b91c1c; font-weight:700;">[[写真${photoIndex + 1}]]</span>`;
            }
            const printableSrc = await this.getGuidePrintablePhotoSrc(photo);
            const printSize = Math.max(20, Math.min(100, Number(photo.printSize) || 72));
            return `<img class="guide-inline-photo" src="${printableSrc}" alt="写真${photoIndex + 1}" style="--guide-photo-size:${printSize}%;">`;
        };
        while ((match = tokenRunPattern.exec(sourceHtml)) !== null) {
            html += sourceHtml.slice(lastIndex, match.index);
            const numbers = Array.from(match[0].matchAll(tokenPattern))
                .map(token => Number(token[1]) - 1)
                .filter(index => Number.isFinite(index) && index >= 0);
            if (numbers.length > 1) {
                const images = [];
                for (const photoIndex of numbers) images.push(await renderPhoto(photoIndex));
                html += `<div class="guide-inline-photo-row">${images.join('')}</div>`;
            } else if (numbers.length === 1) {
                html += await renderPhoto(numbers[0]);
            } else {
                html += match[0];
            }
            lastIndex = match.index + match[0].length;
        }
        html += sourceHtml.slice(lastIndex);
        return html || '';
    }

    async renderGuideUnreferencedPhotosHtml(guide = {}) {
        const referenced = this.getGuideReferencedPhotoNumbers(guide.text || '');
        const parts = [];
        for (const [index, p] of (guide.photos || []).entries()) {
            if (referenced.has(index + 1)) continue;
            const photo = this.normalizeGuidePhoto(p);
            if (photo.src) parts.push(`<img src="${await this.getGuidePrintablePhotoSrc(photo)}" alt="写真${index + 1}" style="width:${Math.max(20, Math.min(100, Number(photo.printSize) || 72))}%;">`);
        }
        return parts.join('');
    }

    highlightText(text, query) {
        if (!query || !text) return text;
        const normQuery = MaintenanceStore.toHalfWidthLower(query);
        const terms = normQuery.split(/[\s　]+/).filter(Boolean);
        if (terms.length === 0) return text;
        
        const normText = MaintenanceStore.toHalfWidthLower(text);
        const ranges = [];
        
        terms.forEach(term => {
            let pos = normText.indexOf(term);
            while (pos !== -1) {
                ranges.push({ start: pos, end: pos + term.length });
                pos = normText.indexOf(term, pos + 1);
            }
        });

        if (ranges.length === 0) return text;

        // Merge overlapping ranges
        ranges.sort((a, b) => a.start - b.start);
        const merged = [];
        if (ranges.length > 0) {
            let cur = { ...ranges[0] };
            for (let i = 1; i < ranges.length; i++) {
                if (ranges[i].start < cur.end) {
                    cur.end = Math.max(cur.end, ranges[i].end);
                } else {
                    merged.push(cur);
                    cur = { ...ranges[i] };
                }
            }
            merged.push(cur);
        }

        // Apply highlights back to front
        let finalHtml = text;
        for (let i = merged.length - 1; i >= 0; i--) {
            const r = merged[i];
            const original = finalHtml.substring(r.start, r.end);
            finalHtml = finalHtml.substring(0, r.start) + `<span class="highlight">${original}</span>` + finalHtml.substring(r.end);
        }
        return finalHtml;
    }

    editMachine(id) {
        this.openMachineModal(id);
    }

    deleteMachine(id) {
        if (confirm('この機械を削除（アーカイブ）しますか？\n（復元は管理画面から可能です）')) {
            const machine = store.getMachines(true).find(m => String(m.id) === String(id));
            store.updateMachine(id, { deleted: true });
            this.recordAdminOperationLog?.('archive', '装置をアーカイブ', machine?.name || id, { view: 'machine', id });
            this.renderMachines();
            this.renderCalendar();
        }
    }

    restoreMachine(id) {
        const machine = store.getMachines(true).find(m => String(m.id) === String(id));
        store.updateMachine(id, { deleted: false });
        this.recordAdminOperationLog?.('restore', '装置を復元', machine?.name || id, { view: 'machine', id });
        this.renderWorkerMaintenanceModal(); // Refresh restoration UI
        this.renderMachines();
        this.renderCalendar();
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppMaintenanceFormMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppMaintenanceFormMethods.prototype[name];
        }
    }
})();

