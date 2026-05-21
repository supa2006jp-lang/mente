(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppMaintenanceFormMethods extends MaintenanceApp {
    // --- Modal Logic ---
    openMachineModal(id = null) {
        const machine = id ? store.getMachines(true).find(m => m.id === id) : null;
        const tasks = id ? store.getTasks(id) : [];

        let usedPartsHTML = '';
        if (id) {
            const hList = store.activeData.history.filter(h => h.machineId === id && h.replacedParts && h.replacedParts.length > 0);
            const partMap = {};
            hList.forEach(h => {
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
                usedPartsHTML = `
                    <div style="margin-top: 24px; border-top: 2px dashed #cbd5e1; padding-top: 16px;">
                        <label style="font-size:0.85rem; font-weight:800; color:var(--text-main); display:block; margin-bottom:8px;">
                            <i class="fa-solid fa-box-open" style="color:var(--secondary);"></i> 過去に使用した部品 (参考)
                        </label>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${pArray.map(p => `
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:6px 10px; border-radius:6px; font-size:0.75rem;">
                                    <div style="font-weight:900; color:var(--primary); margin-bottom:2px;">${p.name} ${p.model ? `[${p.model}]` : ''}</div>
                                    <div style="font-size:0.65rem; color:var(--text-light);"><i class="fa-regular fa-clock"></i> 最終交換: ${p.latestDate}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        this.openModal('machine', machine ? '機械の編集' : '新規機械登録', () => {
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

                    <div class="form-group" style="margin-top:16px;">
                        <label>機械の写真 (プロフィール用)</label>
                        <div style="display:flex; gap:16px; align-items:center;">
                            <div id="f-machine-photo-preview" class="img-box" style="width:100px; height:100px; border-radius:12px; border:2px dashed var(--border);">
                                ${machine && machine.photo ? `<img src="${machine.photo}">` : '<i class="fa-solid fa-camera" style="font-size:1.5rem; color:#cbd5e1;"></i>'}
                            </div>
                            <div style="flex:1">
                                <input type="file" id="f-machine-photo" accept="image/*" style="font-size:0.8rem;">
                                <input type="hidden" id="f-machine-photo-base64" value="${machine ? machine.photo || '' : ''}">
                                <button type="button" class="secondary-btn f-rotate-btn" style="padding:2px 8px; font-size:0.7rem; margin-top:4px; margin-bottom:4px; display:${machine && machine.photo ? 'inline-block' : 'none'};" onclick="app.rotateSinglePhotoField('f-machine-photo-base64', 'f-machine-photo-preview')"><i class="fa-solid fa-rotate-right"></i> 向きを修正</button>
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
                            <button type="button" class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.addTaskRow()"><i class="fa-solid fa-plus"></i> 追加</button>
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
                <input type="text" class="t-content" style="flex:2" placeholder="作業内容 (任意)" value="${task ? task.content : ''}">
                <div style="flex:1; display:flex; align-items:center; gap:4px;">
                    <input type="number" class="t-period" style="width:70px" min="0" placeholder="周期" value="${task ? task.periodDays : ''}" oninput="app.updateOneOffBadge(this)">
                    <span style="font-size:0.7rem; color:var(--text-light); white-space:nowrap;">日毎</span>
                    <span class="one-off-badge ${task && (parseInt(task.periodDays) || 0) === 0 ? '' : 'hidden'}">1回きり</span>
                </div>
                <input type="date" class="t-start" style="flex:1" value="${task ? task.startDate : new Date().toISOString().split('T')[0]}">
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
            <div style="width:100%; font-size:0.65rem; color:var(--text-light);">
                ※周期を0に設定すると、開始日当日のみ1回だけ予約されます。
            </div>
        `;
        container.appendChild(div);
    }

    updateOneOffBadge(input) {
        const badge = input?.parentElement?.querySelector('.one-off-badge');
        if (!badge) return;
        badge.classList.toggle('hidden', (parseInt(input.value) || 0) !== 0);
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
                        <label>症状・故障内容 <span style="color:var(--danger)">*</span></label>
                        <textarea id="s-content" class="sudden-detail-textarea" rows="6" placeholder="どのような異常が発生したか記入してください" required></textarea>
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
                        <label>写真の添付 (複数可 / 自動で圧縮保存されます)</label>
                        <input type="file" id="s-photos" accept="image/*" multiple style="margin-bottom:8px;">
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
            if (prefill?.content) {
                const content = document.getElementById('s-content');
                if (content) {
                    content.value = prefill.content;
                    this.autoResizeTextarea(content);
                    content.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
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
        if (lastRecord.lineNo) document.getElementById(`${prefix}line-no`).value = lastRecord.lineNo;
        const contentField = document.getElementById(`${prefix}content`) || document.getElementById(`${prefix}symptom`);
        if (lastRecord.errorContent && contentField) contentField.value = lastRecord.errorContent;
        if (lastRecord.cause) document.getElementById(`${prefix}cause`).value = lastRecord.cause;
        if (lastRecord.notes) document.getElementById(`${prefix}notes`).value = lastRecord.notes;
        if (lastRecord.category) document.getElementById(`${prefix}category`).value = lastRecord.category;
        [contentField, document.getElementById(`${prefix}cause`), document.getElementById(`${prefix}notes`)]
            .forEach(textarea => this.autoResizeTextarea(textarea));
        
        // Auto-set as recurrence since it's a copy of past event
        const occRadio = document.querySelector(`input[name="${prefix}occurrence"][value="recurrence"]`);
        if (occRadio) occRadio.checked = true;
        
        if (lastRecord.workers) {
            document.getElementById(`${prefix}workers`).value = lastRecord.workers.join(', ');
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

    onSuddenMachineChange(mId, isEdit = false) {
        if (!isEdit) this.toggleNewMachineFields(mId);
        this.updateRelatedGuides(mId); // Update Related Guides Qucik Access
        
        // Show/Hide "Copy Last Record" button
        const prefix = isEdit ? 'e-' : 's-';
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
                                <button type="button" style="background:none; border:none; padding:4px 8px; font-size:inherit; color:inherit; cursor:pointer;" onclick="const t=document.getElementById('${targetId}'); t.value='${v.replace(/'/g, "\\'")}'; app.autoResizeTextarea(t); t.dispatchEvent(new Event('input', { bubbles: true })); t.focus();">
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

        const saveBtn = document.getElementById('modal-save-btn');
        if (saveBtn) saveBtn.onclick = () => this.saveModalData(type);
        
        // Photo listener for modals
        if (type === 'sudden' || type === 'edit-history') {
            const photoInput = document.getElementById(type === 'sudden' ? 's-photos' : 'e-photos');
            const preview = document.getElementById(type === 'sudden' ? 's-photo-previews' : 'e-photo-previews');
            if (photoInput && preview) {
                // Initialize for sudden records since they don't have predefined tempPhotos
                if (type === 'sudden') {
                    this._tempPhotos = [];
                    preview.innerHTML = '';
                }

                photoInput.addEventListener('change', async (e) => {
                    const files = Array.from(e.target.files);
                    if (!this._tempPhotos) this._tempPhotos = [];

                    for (const file of files) {
                        const base64 = await MaintenanceStore.resizeImage(file);
                        this._tempPhotos.push(base64);
                        const div = this.createPhotoPreviewElement(
                            base64,
                            (removedSrc) => { this._tempPhotos = this._tempPhotos.filter(p => p !== removedSrc); },
                            (oldSrc, newSrc) => { this._tempPhotos = this._tempPhotos.map(p => p === oldSrc ? newSrc : p); },
                            80
                        );
                        preview.appendChild(div);
                    }
                    e.target.value = ''; // Reset input to allow adding the same file again
                });
            }
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
                    }
                });
            }
        }

        overlay.classList.remove('hidden');
    }

    createPhotoPreviewElement(base64, onRemove, onRotate, size = 80) {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.display = 'inline-block';
        div.innerHTML = `
            <div class="img-box" style="width:${size}px; height:${size}px; border-radius:4px; overflow:hidden;">
                <img src="${base64}" style="width:100%; height:100%; object-fit:cover;">
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

    initGlobalImageZoom() {
        const preview = document.getElementById('global-image-preview');
        const img = document.getElementById('global-image-target');
        if (!preview || !img) return;
        this.imagePreviewLocked = false;

        const showPreview = (imgBox) => {
            if (!imgBox) return;
            const targetImg = imgBox.querySelector('img');
            if (!targetImg || !targetImg.src) return;
            const rect = targetImg.getBoundingClientRect();
            img.src = targetImg.src;

            preview.style.left = rect.left + 'px';
            preview.style.top = rect.top + 'px';
            preview.style.width = rect.width + 'px';
            preview.style.height = rect.height + 'px';
            preview.style.transform = 'scale(1)';

            const isShiftNotebookPhoto = !!imgBox.closest('.shift-photo-previews') || !!imgBox.closest('.notebook-search-photos') || !!imgBox.closest('.shift-fullscreen-photos-wrapper');
            if (isShiftNotebookPhoto) {
                preview.classList.add('contain-mode');
            } else {
                preview.classList.remove('contain-mode');
            }
            const scale = isShiftNotebookPhoto ? Math.min(26, Math.max(12, 980 / Math.max(rect.width, rect.height))) : 9;
            const zoomedW = rect.width * scale;
            const zoomedH = rect.height * scale;

            let centerX = rect.left + rect.width / 2;
            let centerY = rect.top + rect.height / 2;
            const margin = 20;
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            if (centerX - zoomedW / 2 < margin) centerX = zoomedW / 2 + margin;
            if (centerX + zoomedW / 2 > winW - margin) centerX = winW - zoomedW / 2 - margin;
            if (centerY - zoomedH / 2 < margin) centerY = zoomedH / 2 + margin;
            if (centerY + zoomedH / 2 > winH - margin) centerY = winH - zoomedH / 2 - margin;

            preview.classList.remove('hidden');
            requestAnimationFrame(() => {
                preview.style.left = (centerX - rect.width / 2) + 'px';
                preview.style.top = (centerY - rect.height / 2) + 'px';
                preview.style.transform = `scale(${scale})`;
            });
        };

        const hidePreview = () => {
            preview.classList.add('hidden');
            preview.classList.remove('locked');
            preview.style.transform = 'scale(1)';
            this.imagePreviewLocked = false;
        };

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

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
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
                                <button type="button" class="secondary-btn f-rotate-btn" style="padding:2px 8px; font-size:0.7rem; margin-top:4px; margin-bottom:4px; display:${master && master.photo ? 'inline-block' : 'none'};" onclick="app.rotateSinglePhotoField('pm-photo-base64', 'pm-photo-preview')"><i class="fa-solid fa-rotate-right"></i> 向きを修正</button>
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
        });
    }

    addPartRow(p = null, hidePrice = false) {
        const container = document.getElementById('s-parts-container');
        if (!container) return;
        
        const name = p?.name || '';
        const model = p?.model || '';
        const count = p?.count || '';
        const unit = p?.unit || '個';
        const price = p?.price || '';

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
            <input type="text" class="p-name" placeholder="部品名" value="${name}" list="list-part-names">
            <input type="text" class="p-model" placeholder="型番" value="${model}" list="list-part-models">
            <input type="number" class="p-count" placeholder="量" value="${count}" step="0.001">
            <select class="p-unit">
                <option value="個" ${unit === 'pcs' || unit === '個' ? 'selected' : ''}>個</option>
                <option value="g" ${unit === 'g' || unit === 'kg' ? 'selected' : ''}>g</option>
            </select>
            ${hidePrice 
                ? `<input type="hidden" class="p-price" value="${price}">` 
                : `<input type="number" class="p-price" placeholder="単価" value="${price}">`}
            <button type="button" class="close-btn" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
        `;

        const nameIn = row.querySelector('.p-name');
        const modelIn = row.querySelector('.p-model');
        nameIn.addEventListener('input', updatePrice);
        modelIn.addEventListener('input', updatePrice);
        
        // Initial lookup if name provided
        if (name && !price && price !== 0) updatePrice();

        container.appendChild(row);
    }

    closeModal() {
        const container = document.getElementById('modal-container');
        if (container?.dataset.modalType === 'shift-notebook') {
            this._skipShiftNoteFormatCommitOnce = true;
            this._activeShiftNoteEditor = null;
        }
        document.getElementById('modal-overlay').classList.add('hidden');
        if (container) delete container.dataset.modalType;
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
            const isDokatei = document.getElementById('s-is-dokatei').checked;
            const isNonProductionStop = !isDokatei && !!document.getElementById('s-is-non-production-stop')?.checked;
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
                alert('機械と症状の内容は必須です。');
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

            const newSuddenRecord = store.addHistoryRecord({
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
                photos: this._tempPhotos || [],
                isSudden: true,
                isDokatei,
                isNonProductionStop,
                category,
                machineCategory,
                lineNo,
                isFirstTime: document.querySelector('input[name="s-occurrence"]:checked')?.value === 'first'
            });
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
                    photos: this._tempPhotos
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
            const text = document.getElementById('g-text').value;
            const author = document.getElementById('g-author').value;
            const tags = document.getElementById('g-tags').value.split(/[,，、\s]+/).map(t => t.trim()).filter(Boolean);

            const index = store.activeData.history.findIndex(x => x.id === hId);
            if (index !== -1) {
                store.activeData.history[index].guide = {
                    text,
                    author,
                    tags,
                    updatedAt: new Date().toLocaleString(),
                    photos: this._tempPhotos
                };
                store.save();
            }

            this.closeModal();
            this.renderHistory();
            this.renderGuides();
            this._tempPhotos = [];
        } else if (type === 'part-master') {
            const name = document.getElementById('pm-name').value;
            const model = document.getElementById('pm-model').value;
            const priceRaw = document.getElementById('pm-price-raw')?.value || '';
            const supplier = document.getElementById('pm-supplier').value;
            const shelf = document.getElementById('pm-shelf')?.value || '';
            const remarks = document.getElementById('pm-remarks').value;
            const photo = document.getElementById('pm-photo-base64').value; // New

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
                unit
            });
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
        this._tempPhotos = [...(guide.photos || [])];

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
                    <div style="font-size:1.1rem; font-weight:900;">${machine?.name || '不明'} [${machine?.model || '-'}]</div>
                    <div style="font-weight:700;">${this.getHistoryDisplayText(h)}</div>
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
                        <input type="text" id="g-author" placeholder="例: メンテナンス 田中" value="${guide.author || ''}" list="list-workers">
                    </div>
                    <div class="form-group">
                        <label>タグ (カンマ区切り)</label>
                        <input type="text" id="g-tags" placeholder="例: 油漏れ, センサー異常" value="${(guide.tags || []).join(', ')}">
                    </div>
                </div>

                <div class="form-group">
                    <label>手順書・技術メモ</label>
                    <textarea id="g-text" class="guide-detail-textarea" rows="16" placeholder="次回同じトラブルが起きた際の参考となる手順、重要なポイントなどを記入してください。">${guide.text}</textarea>
                </div>

                <div class="form-group">
                    <label>手順写真・参考画像</label>
                    <input type="file" id="g-photos" accept="image/*" multiple style="margin-bottom:8px;">
                    <div id="g-photo-previews" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
                </div>
            `;
            this.setupAutoResizeTextareas('#g-text.guide-detail-textarea');

            // Photo handler init
            const previewContainer = document.getElementById('g-photo-previews');
            this._tempPhotos.forEach(p => {
                const div = this.createPhotoPreviewElement(
                    p, 
                    (removedSrc) => { this._tempPhotos = this._tempPhotos.filter(img => img !== removedSrc); },
                    (oldSrc, newSrc) => { this._tempPhotos = this._tempPhotos.map(img => img === oldSrc ? newSrc : img); },
                    100
                );
                previewContainer.appendChild(div);
            });

            const photoIn = document.getElementById('g-photos');
            photoIn.onchange = async (e) => {
                const files = Array.from(e.target.files);
                for (const file of files) {
                    const base64 = await MaintenanceStore.resizeImage(file);
                    this._tempPhotos.push(base64);
                    const div = this.createPhotoPreviewElement(
                        base64,
                        (removedSrc) => { this._tempPhotos = this._tempPhotos.filter(p => p !== removedSrc); },
                        (oldSrc, newSrc) => { this._tempPhotos = this._tempPhotos.map(p => p === oldSrc ? newSrc : p); },
                        100
                    );
                    previewContainer.appendChild(div);
                }
            };

            // Add Print button to footer
            const footer = document.querySelector('.modal-footer');
            footer.insertAdjacentHTML('afterbegin', `
                <button class="secondary-btn" style="margin-right:auto" onclick="app.printGuide('${hId}')">
                    <i class="fa-solid fa-print"></i> 印刷する
                </button>
            `);
        });
    }

    printGuide(hId) {
        const h = store.activeData.history.find(x => x.id === hId);
        const machine = store.getMachines(true).find(m => m.id === h.machineId);
        const guide = h.guide;
        if (!guide) return alert('まず手順書を保存してください。');

        const printWindow = window.open('', '_blank');
        const photosHTML = guide.photos.map(p => `<img src="${p}" style="max-width:45%; margin:10px; border:1px solid #ccc;">`).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>作業手順書 - ${machine?.name}</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; }
                        h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
                        .meta { margin-bottom: 30px; background: #eee; padding: 15px; border-radius: 8px; }
                        .content { white-space: pre-wrap; line-height: 1.6; font-size: 1.1rem; }
                        @media print { .no-print { display:none; } }
                    </style>
                </head>
                <body>
                    <div class="no-print" style="margin-bottom:20px;">
                        <button onclick="window.print()">印刷実行</button>
                    </div>
                    <h1>作業手順書: ${this.getHistoryDisplayText(h)}</h1>
                    <div class="meta">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                            <div><strong>機械:</strong> ${machine?.name} [${machine?.model}]</div>
                            <div><strong>作成者:</strong> ${guide.author || '不明'}</div>
                            <div><strong>記録日:</strong> ${h.date}</div>
                            <div><strong>手順書最終更新:</strong> ${guide.updatedAt || '-'}</div>
                            <div style="grid-column: span 2; border-top: 1px dashed #bbb; padding-top: 10px; margin-top: 5px;">
                                <strong>【原因】:</strong> ${h.cause || '(点検記録に未入力)'}
                            </div>
                            <div style="grid-column: span 2;">
                                <strong>【処置内容】:</strong> ${h.notes || '(点検記録に未入力)'}
                            </div>
                        </div>
                    </div>
                    <div class="content">${guide.text}</div>
                    <div style="margin-top:40px;">
                        ${photosHTML}
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
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
            store.updateMachine(id, { deleted: true });
            this.renderMachines();
            this.renderCalendar();
        }
    }

    restoreMachine(id) {
        store.updateMachine(id, { deleted: false });
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

