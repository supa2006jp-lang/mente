(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppHistoryMethods extends MaintenanceApp {
    openDayQuickMenu(dateStr) {
        const scheduled = this.getScheduledTasksForDate(dateStr);
        const history = this.getHistoryForDate(dateStr);
        const [year, month, day] = dateStr.split('-');

        this.openModal('day-menu', `${month}/${day} の管理メニュー`, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div style="margin-bottom: 24px;">
                    <h4 style="font-size:0.85rem; color:var(--text-light); margin-bottom:12px;"><i class="fa-solid fa-wrench"></i> メンテナンス予定</h4>
                    ${scheduled.length === 0 ? '<p style="font-size:0.85rem; padding:12px; background:var(--background); border-radius:8px;">予定はありません。</p>' : `
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            ${scheduled.map(s => `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--primary-light); border-radius:8px; border:1px solid var(--primary);">
                                    <div>
                                        <div style="font-weight:800; color:var(--primary);">${s.content}</div>
                                        <div style="font-size:0.75rem; color:var(--text-light);">${store.getMachines(true).find(m => m.id === s.machineId)?.name || '不明'}</div>
                                    </div>
                                    <button class="primary-btn" style="padding:4px 12px; font-size:0.75rem" onclick="app.closeModal(); app.openCompletionForm('${s.id}', '${dateStr}')">完了を記録</button>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <div style="margin-bottom: 24px;">
                    <h4 style="font-size:0.85rem; color:var(--text-light); margin-bottom:12px;"><i class="fa-solid fa-clock-rotate-left"></i> 完了済みの記録</h4>
                    ${history.length === 0 ? '<p style="font-size:0.85rem; padding:12px; background:var(--background); border-radius:8px;">記録はありません。</p>' : `
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            ${history.map(h => `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:white; border:1px solid var(--border); border-radius:8px; cursor:pointer;" onclick="app.closeModal(); app.openHistoryEditForm('${h.id}')">
                                    <div>
                                        <div style="font-weight:800;">${h.isSudden ? '<span style="color:var(--danger)">[突発]</span> ' : ''}${this.getHistoryDisplayText(h)}</div>
                                        <div style="font-size:0.75rem; color:var(--text-light);">${store.getMachines(true).find(m => m.id === h.machineId)?.name || '不明'}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <div style="margin-bottom: 24px;">
                    <h4 style="font-size:0.85rem; color:var(--text-light); margin-bottom:12px;"><i class="fa-solid fa-note-sticky"></i> カレンダーに表示するメモ</h4>
                    <textarea id="cal-day-memo" style="width:100%; height:120px; padding:12px; border:2px solid var(--border); border-radius:10px; font-size:0.9rem; font-family:inherit; line-height:1.5; outline:none; transition:border-color 0.2s;" placeholder="カレンダーのセル内に常備表示したいメモを記入（例: 点検立ち合い、来客など）">${store.activeData.memos[dateStr] || ''}</textarea>
                    <button class="primary-btn" style="width:100%; margin-top:10px; font-weight:900;" onclick="app.saveDayMemo('${dateStr}')"><i class="fa-solid fa-floppy-disk"></i> メモをカレンダーへ保存</button>
                    <p style="font-size:0.65rem; color:var(--text-light); margin-top:4px;">※メンテナンス履歴とは別に、セル内に直接メモとして表示されます。</p>
                </div>

                <div style="border-top: 1px dashed var(--border); padding-top: 16px; display:flex; gap:8px;">
                    <button class="secondary-btn" style="flex:1" onclick="app.closeModal(); app.openSuddenRecordModal('${dateStr}')"><i class="fa-solid fa-plus"></i> 突発対応を登録</button>
                </div>
            `;
            // Remove the default save button since this is a menu
            document.querySelector('.modal-footer .primary-btn').classList.add('hidden');
        });
    }

    deleteDayMemo(date) {
        if (!confirm('この日のメモを削除しますか？')) return;
        if (store.activeData.memos) {
            delete store.activeData.memos[date];
            store.save();
            this.renderCalendar();
        }
    }

    saveDayMemo(date) {
        const txt = document.getElementById('cal-day-memo').value.trim();
        if (!store.activeData.memos) store.activeData.memos = {};
        store.activeData.memos[date] = txt;
        store.save();
        this.closeModal();
        this.renderCalendar();
    }

    openHistoryEditForm(historyId) {
        const h = store.activeData.history.find(x => x.id === historyId);
        if (!h) return;

        const machines = store.getMachines();
        this._tempPhotos = h.photos ? [...h.photos] : [];

        this.openModal('edit-history', 'メンテナンス記録の編集', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <form id="edit-history-form">
                    <input type="hidden" id="e-h-id" value="${historyId}">
                    ${this.getHistoryNeighborNavHtml(h)}
                    
                    <div class="form-group" style="background:#f1f5f9; padding:12px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:15px;">
                        <label style="font-weight:900; color:#475569;"><i class="fa-solid fa-list-ol"></i> 対応ライン番号 <span style="color:var(--danger)">*</span></label>
                        <select id="e-line-no" required style="height:44px; font-weight:900; color:var(--text-main); font-size:1rem; border:2.5px solid var(--border-dark);">
                            <option value="">-- ラインを選択してください --</option>
                            ${this.generateLineOptionsHTML(h.lineNo || '')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>対象の機械</label>
                        <div style="font-size:0.75rem; color:var(--primary); font-weight:800; margin-bottom:8px;">
                            <i class="fa-solid fa-circle-info"></i> 対象機械本体を選択すると、登録されたラインと装置区分が自動入力されます。
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:10px;">
                            <div class="form-group" style="margin-bottom:0">
                                <label>装置区分 (例: 包装機, 充填機) <span style="color:var(--danger)">*</span></label>
                                <select id="e-machine-category" onchange="app.toggleNewCategoryField('e-')" required style="height:44px;">
                                    <option value="">-- 選択してください --</option>
                                    ${this.getMachineCategoryOptions(h.machineCategory || '')}
                                </select>
                                <input type="text" id="e-new-category-input" placeholder="新しい装置区分名を入力" style="display:none; margin-top:8px; border:2px solid var(--primary); padding:8px;" onblur="this.value = MaintenanceApp.toFullWidthUpper(this.value)">
                            </div>
                            <div class="form-group" style="margin-bottom:0">
                                <label style="font-size:0.75rem">対象機械本体 <span style="color:var(--danger)">*</span></label>
                                <select id="e-machine-id" onchange="app.onSuddenMachineChange(this.value, true)" required style="height:44px;">
                                    ${machines.map(m => `<option value="${m.id}" ${m.id === h.machineId ? 'selected' : ''}>${m.name} [${m.model}]</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>実施日 <span style="color:var(--danger)">*</span></label>
                            <input type="date" id="e-date" value="${h.date}" required>
                        </div>
                        <div class="form-group" style="display:flex; align-items:flex-end;">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; background:var(--background); padding:10px 16px; border-radius:var(--radius-md); border:1px solid var(--border); width:100%;">
                                <input type="checkbox" id="e-is-dokatei" ${h.isDokatei ? 'checked' : ''} style="width: auto;" onchange="const np=document.getElementById('e-is-non-production-stop'); if(this.checked && np) np.checked=false;">
                                <span style="font-weight:800; color:var(--text-main); font-size:0.85rem;">ドカ停</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; background:#fffbeb; padding:10px 16px; border-radius:var(--radius-md); border:1px solid #fde68a;">
                            <input type="checkbox" id="e-is-non-production-stop" ${h.isNonProductionStop ? 'checked' : ''} style="width:auto;" onchange="const d=document.getElementById('e-is-dokatei'); if(this.checked && d) d.checked=false;">
                            <span style="font-weight:800; color:#b45309; font-size:0.85rem;">非生産停止トラブル（生産は止まっていない突発メンテ）</span>
                        </label>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>エラー番号</label>
                            <input type="text" id="e-error-no" value="${h.errorNo || ''}" placeholder="例: E-01" list="e-list-model-error-nos">
                            <div id="e-error-no-suggestions" class="suggestion-area"></div>
                        </div>
                        <div class="form-group">
                            <label>作業時間 (分) <span style="color:var(--danger)">*</span></label>
                            <input type="number" id="e-work-time" value="${h.workTime || ''}" placeholder="例: 30" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>症状・故障内容 <span style="color:var(--danger)">*</span></label>
                        <textarea id="e-symptom" class="sudden-detail-textarea" rows="6" placeholder="どのような異常が発生したか記入してください" required>${h.errorContent || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label>作業者 (カンマ区切り)</label>
                        <input type="text" id="e-workers" value="${h.workers?.join(', ') || ''}" list="list-workers">
                        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
                            ${store.getWorkers().filter(w => !(store.activeData.archivedSuggestions?.workers || []).includes(w)).map(w => `
                                <div class="suggestion-badge" style="background:#f8fafc; color:#0369a1; border:1px solid #cbd5e1; font-weight:700; display:inline-flex; align-items:stretch; padding:0; overflow:hidden;">
                                    <button type="button" style="background:none; border:none; padding:4px 8px; font-size:inherit; color:inherit; cursor:pointer; font-weight:inherit;" onclick="app.addWorkerToInput('${w}', 'e-workers')">
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
                        <select id="e-category" required>
                            <option value="">-- 選択してください --</option>
                            <option value="machine" ${h.category === 'machine' ? 'selected' : ''}>機械修理</option>
                            <option value="electric" ${h.category === 'electric' ? 'selected' : ''}>電気系修理</option>
                            <option value="adjust" ${h.category === 'adjust' ? 'selected' : ''}>調整・設定変更</option>
                            <option value="parts" ${h.category === 'parts' ? 'selected' : ''}>部品交換</option>
                            <option value="clean" ${h.category === 'clean' ? 'selected' : ''}>清掃・給油</option>
                            <option value="other" ${h.category === 'other' || !h.category ? 'selected' : ''}>その他</option>
                        </select>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>原因</label>
                            <textarea id="e-cause" class="sudden-detail-textarea" rows="9" placeholder="故障の根本原因" list="e-list-model-causes">${h.cause || ''}</textarea>
                            <div id="e-cause-suggestions" class="suggestion-area"></div>
                        </div>
                        <div class="form-group">
                            <label>処置・対応内容</label>
                            <textarea id="e-notes" class="sudden-detail-textarea" rows="9" placeholder="どのような修理・処置を行ったか" list="e-list-model-treatments">${h.notes || ''}</textarea>
                            <div id="e-notes-suggestions" class="suggestion-area"></div>
                        </div>
                    </div>
                    <datalist id="e-list-model-error-nos"></datalist>
                    <datalist id="e-list-model-contents"></datalist>
                    <datalist id="e-list-model-causes"></datalist>
                    <datalist id="e-list-model-treatments"></datalist>

                    <div class="form-group">
                        <label>写真の添付</label>
                        <input type="file" id="e-photos" accept="image/*" multiple style="margin-bottom:8px;">
                        <div id="e-photo-previews" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
                    </div>

                    <div class="form-group">
                        <label>対応種別 <span style="font-size:0.7rem; color:var(--text-light); font-weight:400;">※「初回」のみスキルマップの集計対象になります</span></label>
                        <div style="display:flex; gap:16px; background:var(--background); padding:10px; border-radius:8px; border:1px solid var(--border);">
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" name="e-occurrence" value="first" ${h.isFirstTime !== false ? 'checked' : ''} style="width:auto;"> <span style="font-weight:800; color:var(--primary);">初回対応 (技術習得)</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" name="e-occurrence" value="recurrence" ${h.isFirstTime === false ? 'checked' : ''} style="width:auto;"> <span style="font-weight:800; color:var(--text-light);">再発・繰り返し</span>
                            </label>
                        </div>
                    </div>
                    ${this.getRelatedHistoryLinksHtml(h)}

                    <div style="margin-top: 24px; border-top: 2px solid #94a3b8; padding-top: 16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <label style="font-size:0.85rem; font-weight:700;">交換部品・資材</label>
                            <button type="button" class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.addPartRow(null, true)"><i class="fa-solid fa-plus"></i> 追加</button>
                        </div>
                        <div id="s-parts-container" style="display:flex; flex-direction:column; gap:8px;"></div>
                    </div>
                </form>
            `;

            // Pre-fill parts (Hide price in edit form)
            if (h.replacedParts) {
                h.replacedParts.forEach(p => this.addPartRow(p, true));
            }
            
            // Photo Handler Setup (Initial render only)
            const previewContainer = document.getElementById('e-photo-previews');
            previewContainer.innerHTML = '';
            this._tempPhotos.forEach(p => {
                const div = this.createPhotoPreviewElement(
                    p,
                    (removedSrc) => { this._tempPhotos = this._tempPhotos.filter(img => img !== removedSrc); },
                    (oldSrc, newSrc) => { this._tempPhotos = this._tempPhotos.map(img => img === oldSrc ? newSrc : img); },
                    80
                );
                previewContainer.appendChild(div);
            });

            // Custom footer for edit
            const footer = document.querySelector('.modal-footer');
            footer.innerHTML = `
                <button class="danger-btn" style="margin-right:auto" onclick="app.deleteHistoryEntry('${historyId}')">この記録を削除</button>
                <button class="secondary-btn" onclick="app.closeModal()">キャンセル</button>
                <button class="primary-btn" id="modal-save-btn">上書き保存</button>
            `;
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.onclick = () => this.saveModalData('edit-history');
            const workTimeField = document.getElementById('e-work-time');
            if (workTimeField) {
                const timeRow = document.createElement('div');
                const workTimeGroup = workTimeField.closest('.form-group');
                const sourceGrid = workTimeField.closest('div[style*="grid-template-columns"]');
                timeRow.style.cssText = 'display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;';
                timeRow.innerHTML = `
                    <div class="form-group">
                        <label>開始時間 <span style="font-size:0.7rem; color:var(--text-light); font-weight:400;">任意</span></label>
                        <input type="time" id="e-start-time" value="${h.startTime || ''}">
                    </div>
                    <div class="form-group">
                        <label>終了時間 <span style="font-size:0.7rem; color:var(--text-light); font-weight:400;">任意</span></label>
                        <input type="time" id="e-end-time" value="${h.endTime || ''}">
                    </div>
                `;
                if (workTimeGroup) timeRow.prepend(workTimeGroup);
                sourceGrid?.insertAdjacentElement('afterend', timeRow);
                timeRow.insertAdjacentHTML('afterend', '<div id="e-time-status" class="maintenance-time-status"></div>');
                this.setupEditHistoryTimeAutoCalc();
            }
            this.setupAutoResizeTextareas('#edit-history-form .sudden-detail-textarea');

            // Trigger initial suggestions for the selected machine
            this.onSuddenMachineChange(h.machineId, true);
        });
    }

    setupEditHistoryTimeAutoCalc() {
        this.setupMaintenanceTimeAutoCalc('e');
    }

    setupSuddenTimeAutoCalc() {
        this.setupMaintenanceTimeAutoCalc('s');
    }

    setupMaintenanceTimeAutoCalc(prefix) {
        const workTimeField = document.getElementById(`${prefix}-work-time`);
        const startField = document.getElementById(`${prefix}-start-time`);
        const endField = document.getElementById(`${prefix}-end-time`);
        const status = document.getElementById(`${prefix}-time-status`);
        if (!workTimeField || !startField || !endField) return;

        const updateStatus = (minutes = null) => {
            if (!status) return;
            const hasStart = !!startField.value;
            const hasEnd = !!endField.value;
            status.className = 'maintenance-time-status';
            if (hasStart !== hasEnd) {
                status.textContent = '開始時間と終了時間のどちらかだけが入力されています';
                status.classList.add('warning');
                return;
            }
            if (minutes === null) {
                status.textContent = '';
                return;
            }
            const crossesMidnight = this.isEndTimeNextDay(startField.value, endField.value);
            const label = workTimeField.dataset.manualOverride === 'true' ? '手入力を優先中（自動計算では' : '自動計算: ';
            const suffix = workTimeField.dataset.manualOverride === 'true' ? '分）' : '分';
            status.textContent = `${label}${minutes}${suffix}${crossesMidnight ? '（日またぎ計算中）' : ''}`;
            if (crossesMidnight) status.classList.add('overnight');
        };

        const updateWorkTime = () => {
            const minutes = this.calculateMinutesBetweenTimes(startField.value, endField.value);
            updateStatus(minutes);
            if (workTimeField.dataset.manualOverride === 'true') return;
            if (minutes === null) return;
            workTimeField.value = String(minutes);
        };

        workTimeField.addEventListener('input', () => {
            workTimeField.dataset.manualOverride = 'true';
            updateWorkTime();
        });
        startField.addEventListener('input', updateWorkTime);
        endField.addEventListener('input', updateWorkTime);
        updateWorkTime();
    }

    calculateMinutesBetweenTimes(startTime, endTime) {
        if (!startTime || !endTime) return null;
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);
        if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return null;

        let startTotal = startHour * 60 + startMinute;
        let endTotal = endHour * 60 + endMinute;
        if (endTotal < startTotal) endTotal += 24 * 60;
        return endTotal - startTotal;
    }

    isEndTimeNextDay(startTime, endTime) {
        if (!startTime || !endTime) return false;
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);
        if ([startHour, startMinute, endHour, endMinute].some(Number.isNaN)) return false;
        return (endHour * 60 + endMinute) < (startHour * 60 + startMinute);
    }

    confirmPartialMaintenanceTime(prefix) {
        const startTime = document.getElementById(`${prefix}-start-time`)?.value || '';
        const endTime = document.getElementById(`${prefix}-end-time`)?.value || '';
        if (!!startTime === !!endTime) return true;
        return confirm('開始時間と終了時間のどちらかだけが入力されています。このまま保存しますか？');
    }

    formatHistoryWorkTime(history) {
        const workTime = history?.workTime || 0;
        if (history?.startTime && history?.endTime) {
            return `${history.startTime}-${history.endTime} / ${workTime}分`;
        }
        return `${workTime}分`;
    }

    deleteHistoryEntry(id) {
        if (confirm('この記録を完全に削除しますか？')) {
            const h = store.activeData.history.find(h => h.id === id);
            if (h && h.replacedParts) {
                h.replacedParts.forEach(p => {
                    store.adjustStock(p.name, p.model, p.count); // Restore stock
                });
            }
            store.activeData.history = store.activeData.history.filter(h => h.id !== id);
            store.save();
            this.closeModal();
            this.renderCalendar();
            this.renderHistory(); // Refresh history view if active
        }
    }

    renderHistory(searchQuery = '') {
        const body = document.getElementById('history-list-body');
        if (!body) return;
        const density = this.historyDensityMode || localStorage.getItem('history_density_mode') || 'standard';
        this.historyDensityMode = density;
        const densitySelect = document.getElementById('hist-density-mode');
        if (densitySelect) densitySelect.value = density;
        const table = body.closest('table');
        if (table) {
            table.classList.remove('history-density-standard', 'history-density-detail', 'history-density-compact');
            table.classList.add(`history-density-${density}`);
        }

        // Active filters banner
        const activeFiltersArea = document.getElementById('hist-active-filters');
        if (activeFiltersArea) {
            if (this.modelFilter || this.workerFilter) {
                activeFiltersArea.innerHTML = `
                    <div style="background:var(--secondary-light); color:var(--secondary); padding:8px 16px; border-radius:8px; margin-bottom:12px; font-size:0.8rem; display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="fa-solid fa-filter"></i> <b>${this.modelFilter ? `型式: ${this.modelFilter}` : `作業員: ${this.workerFilter}`}</b> で抽出中</span>
                        <button class="secondary-btn" style="padding:2px 10px; font-size:0.7rem;" onclick="app.clearModelFilter(); app.workerFilter=null; app.renderHistory();">解除</button>
                    </div>
                `;
            } else {
                activeFiltersArea.innerHTML = '';
            }
        }

        const mFilter = document.getElementById('hist-filter-machine');
        const tFilter = document.getElementById('hist-filter-type');
        const pFilter = document.getElementById('hist-filter-period');

        // ラインフィルタの選択肢を動的生成 (初回のみ)
        const lineFilterEl = document.getElementById('hist-filter-line');
        if (lineFilterEl && lineFilterEl.options.length <= 1) {
            const lines = new Set();
            store.activeData.history.forEach(h => { if (!h.isManualGuide && h.lineNo) lines.add(h.lineNo); });
            store.getMachines(true).forEach(m => { if (m.lineNo) lines.add(m.lineNo); });
            Array.from(lines).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).forEach(l => {
                const opt = document.createElement('option');
                opt.value = l;
                opt.textContent = this.getLineLabel(l);
                lineFilterEl.appendChild(opt);
            });
        }
        
        const globalSearch = document.getElementById('global-search').value.toLowerCase();
        const query = searchQuery || globalSearch;

        const machineId = mFilter?.value;
        const lineVal = document.getElementById('hist-filter-line')?.value || 'all';
        const type = tFilter?.value;
        const period = pFilter?.value || 'this_month';
        const partsOnly = !!document.getElementById('hist-filter-parts')?.checked;
        const photosOnly = !!document.getElementById('hist-filter-photos')?.checked;
        const guideOnly = !!document.getElementById('hist-filter-guide')?.checked;

        let filtered = store.activeData.history ? store.activeData.history.filter(h => !h.isManualGuide) : [];
        filtered = this.filterHistoryByPeriod(filtered, period);
        this.updateViewSubtitle('view-history', period);

        if (machineId) {
            filtered = filtered.filter(h => h.machineId === machineId);
        }

        if (lineVal !== 'all') {
            filtered = filtered.filter(h => {
                const m = store.getMachines(true).find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                return String(l) === String(lineVal);
            });
        }
        
        if (this.modelFilter) {
            const normFilter = MaintenanceApp.toHalfWidthLower(this.modelFilter);
            filtered = filtered.filter(h => {
                const machine = store.getMachines(true).find(m => m.id === h.machineId);
                const mModel = MaintenanceApp.toHalfWidthLower(machine?.model || '');
                return mModel === normFilter;
            });
        }

        if (this.workerFilter) {
            filtered = filtered.filter(h => h.workers && h.workers.includes(this.workerFilter));
        }

        if (type === 'periodic') {
            filtered = filtered.filter(h => !!h.taskId);
        } else if (type === 'sudden') {
            filtered = filtered.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop);
        } else if (type === 'nonProductionStop') {
            filtered = filtered.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop);
        } else if (type === 'dokatei') {
            filtered = filtered.filter(h => !!h.isDokatei);
        }

        if (partsOnly) filtered = filtered.filter(h => (h.replacedParts || []).length > 0);
        if (photosOnly) filtered = filtered.filter(h => (h.photos || []).length > 0);
        if (guideOnly) filtered = filtered.filter(h => this.hasHistoryGuide(h));

        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (query) {
            const terms = MaintenanceStore.toHalfWidthLower(query).split(/\s+/).filter(t => t);
            filtered = filtered.filter(h => {
                const machine = store.getMachines(true).find(m => m.id === h.machineId);
                const taskName = this.getHistoryDisplayText(h);
                const searchableText = (h.date || '') + ' ' + taskName + ' ' + (h.notes || '') + ' ' + (h.cause || '') + ' ' + (machine?.name || '') + ' ' + (machine?.model || '') + ' ' + (h.machineCategory || '');
                const normTxt = MaintenanceStore.toHalfWidthLower(searchableText);
                return terms.every(t => normTxt.includes(t));
            });
        }

        this.renderHistoryFilterSummary(filtered, { period, machineId, lineVal, type, query, partsOnly, photosOnly, guideOnly });

        body.innerHTML = '';
        if (filtered.length === 0) {
            body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text-light)">履歴が見つかりません</td></tr>';
            return;
        }

        filtered.forEach(h => {
            const machine = store.getMachines(true).find(m => m.id === h.machineId);
            const tr = document.createElement('tr');
            
            let rowBg = '#ffffff';
            const typeInfo = this.getHistoryTypeInfo(h);
            let badgeClass = h.taskId ? 'badge-periodic' : 'badge-sudden';
            let badgeText = typeInfo.label;
            let titleColor = typeInfo.color;
            
            if (h.isDokatei) {
                rowBg = '#fef2f2'; // Pink
                badgeClass = 'badge-dokatei';
                badgeText = 'ドカ停';
                titleColor = 'var(--danger)';
            } else if (h.taskId) {
                rowBg = '#eff6ff'; // Light Blue
            } else if (h.isNonProductionStop) {
                rowBg = '#fffbeb'; // Light Amber
                badgeClass = 'badge-sudden';
            } else {
                rowBg = '#f0fdf4'; // Light Green
            }
            tr.style.backgroundColor = rowBg;

            let guideBtnClass = h.guide ? (h.isDokatei ? 'guide-dokatei' : (h.taskId ? 'guide-periodic' : 'guide-sudden')) : 'guide-none';
            
            const normMName = MaintenanceApp.toFullWidthUpper(machine ? machine.name : '不明');
            const normMModel = MaintenanceApp.toHalfWidthLower(machine ? machine.model : '');
            const replacedParts = h.replacedParts || [];
            const partsTitle = replacedParts.length
                ? replacedParts.map(p => `${p.name || '部品名なし'}${p.model ? ` [${p.model}]` : ''} ${p.count ?? p.qty ?? 0}${this.formatHistoryPartUnit(p.unit)}`).join(' / ')
                : '';

            tr.innerHTML = `
                <td style="font-weight:700">${h.date}</td>
                <td style="font-size:0.85rem">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <div class="img-box" style="width:36px; height:36px; border-radius:8px; flex-shrink:0;">
                            ${machine?.photo ? `<img src="${machine.photo}">` : '<i class="fa-solid fa-industry" style="font-size:0.8rem; color:#cbd5e1;"></i>'}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; gap:4px; align-items:center; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${this.getLineBadge(h.lineNo || machine?.lineNo)}
                                ${ (h.machineCategory || machine?.category) ? `<span style="font-size:0.65rem; color:var(--text-light); font-weight:800;"><i class="fa-solid fa-tag"></i> ${h.machineCategory || machine.category}</span>` : ''}
                            </div>
                            <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; font-weight:700;" title="${normMName}">${this.highlightText(normMName, query)}</div>
                            <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                <span style="color:var(--secondary); font-weight:700; cursor:pointer; font-size:0.75rem;" onclick="app.toggleModelFilter('${normMModel}', event)" title="この型式で抽出">
                                    [${this.highlightText(normMModel, query)}]
                                    ${this.modelFilter === normMModel ? ' <i class="fa-solid fa-filter" style="font-size:0.6rem"></i>' : ''}
                                </span>
                            </div>
                            ${machine ? `
                                <button type="button" class="history-machine-edit-btn" onclick="event.stopPropagation(); app.openMachineModal('${this.escapeJs(machine.id)}')" title="この機械の編集画面を開く">
                                    <i class="fa-solid fa-pen-to-square"></i> 機械編集
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </td>
                <td>
                    <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px;">
                        <div style="font-weight:900; color:${titleColor}; flex:1; display:flex; align-items:center; min-width:0; gap:6px;">
                            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${this.getHistoryDisplayText(h)}">${this.highlightText(this.getHistoryDisplayText(h), query)}</span>
                            ${h.isFirstTime !== false 
                                ? `<span class="badge-occurrence first" style="font-size:0.65rem; padding:2px 6px; background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; border-radius:4px; font-weight:800; flex-shrink:0;">初回</span>`
                                : `<span class="badge-occurrence recurrence" style="font-size:0.65rem; padding:2px 6px; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; border-radius:4px; font-weight:800; flex-shrink:0;">再発</span>`
                            }
                        </div>
                        <div style="font-size:0.85rem; color:var(--text-light); font-weight:700; white-space:nowrap; display:flex; gap:4px; align-items:center; flex-shrink:0;">
                            <i class="fa-solid fa-user-gear" style="font-size:0.75rem; opacity:0.8;"></i> 
                            ${(h.workers || []).map(w => {
                                const colors = this.getWorkerColors(w);
                                return `<span class="worker-badge" style="cursor:pointer; padding:2px 6px; border-radius:4px; background-color:${colors.bg}; color:${colors.text}; border:1px solid ${colors.border}; font-size:0.75rem; ${this.workerFilter === w ? 'ring:2px solid var(--primary); outline:2px solid var(--primary);' : ''}" onclick="app.toggleWorkerFilter('${w}', event)">${w}</span>`;
                            }).join('') || '-'}
                            ${this.workerFilter && (h.workers || []).includes(this.workerFilter) ? ' <i class="fa-solid fa-filter" style="font-size:0.75rem; color:var(--primary)"></i>' : ''}
                        </div>
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-light); line-height:1.4; margin-top:4px;">
                        ${h.cause ? `<div class="history-row-detail-text" title="原因: ${h.cause}">原因: ${this.highlightText(h.cause, query)}</div>` : ''}
                        ${h.notes ? `<div class="history-row-detail-text" title="処置: ${h.notes}">処置: ${this.highlightText(h.notes, query)}</div>` : ''}
                    </div>
                </td>
                <td>
                    ${h.photos && h.photos.length > 0 ? `
                        <div style="display:flex; flex-wrap:wrap; gap:4px; max-width:64px;">
                            ${h.photos.slice(0, 2).map(p => `
                                <div class="img-box" style="width:28px; height:28px; border-radius:4px; border:1px solid var(--border); box-shadow:0 1px 2px rgba(0,0,0,0.05); flex-shrink:0;">
                                    <img src="${p}" alt="添付画像" style="object-fit:cover; width:100%; height:100%;">
                                </div>
                            `).join('')}
                            ${h.photos.length > 2 ? `<div style="font-size:0.6rem; color:var(--text-light); width:100%; text-align:center;">+${h.photos.length-2}</div>` : ''}
                        </div>
                    ` : '<span style="color:var(--text-light); font-size:0.75rem;">-</span>'}
                </td>
                <td style="text-align: center;"><span class="badge ${badgeClass}" style="cursor:pointer; padding:4px 6px; font-size:0.65rem; min-width:40px; ${h.isNonProductionStop ? 'background:#fef3c7; color:#92400e; border:1px solid #fcd34d;' : ''}" onclick="app.toggleTypeFilter('${typeInfo.key}', event)" title="この区分で抽出">${badgeText}</span></td>
                <td>${this.escapeHtml(this.formatHistoryWorkTime(h))}</td>
                <td class="history-parts-cell">
                    ${replacedParts.length ? `
                        <button type="button" class="history-parts-btn" onclick="app.openHistoryPartsDetail('${this.escapeJs(h.id)}')" title="${this.escapeHtml(partsTitle)}" aria-label="交換部品の詳細を表示">
                            <i class="fa-solid fa-box-open"></i>
                            <span>${replacedParts.length}</span>
                        </button>
                    ` : '<span style="color:var(--text-light); font-size:0.75rem;">-</span>'}
                </td>
                <td style="vertical-align: top;">
                    <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
                        ${(() => {
                            let guideInfo = h.guide;
                            let isRef = false;
                            if (!guideInfo) {
                                const taskTitle = this.getHistoryDisplayText(h);
                                const found = store.activeData.history.find(r => r.id !== h.id && r.machineId === h.machineId && this.getHistoryDisplayText(r) === taskTitle && r.guide);
                                if (found) { guideInfo = found.guide; isRef = true; }
                            }
                            
                            if (guideInfo) {
                                return `
                                <button class="secondary-btn ${guideBtnClass}" style="padding:4px 6px; font-size:0.65rem; width:100%; justify-content:center; ${isRef ? 'opacity:0.8; border-style:dashed;' : ''}" onclick="app.openGuideModal('${h.id}')">
                                    <i class="fa-solid fa-file-invoice"></i> 手順
                                </button>`;
                            } else {
                                return `
                                <button class="secondary-btn guide-none" style="padding:4px 6px; font-size:0.65rem; width:100%; justify-content:center;" onclick="app.openGuideModal('${h.id}')">
                                    <i class="fa-solid fa-file-invoice"></i> 手順
                                </button>`;
                            }
                        })()}
                        <button class="icon-btn" onclick="app.openHistoryEditForm('${h.id}')" style="width:100%; padding:4px; font-size:0.7rem; display:flex; justify-content:center; border:1px solid transparent; background:var(--background-alt); border-radius:4px;"><i class="fa-solid fa-pen-to-square"></i></button>
                    </div>
                </td>
            `;
            body.appendChild(tr);
        });
    }

    hasHistoryGuide(h) {
        if (h?.guide) return true;
        const title = this.getHistoryDisplayText(h);
        return (store.activeData.history || []).some(r =>
            r.id !== h.id &&
            r.machineId === h.machineId &&
            this.getHistoryDisplayText(r) === title &&
            !!r.guide
        );
    }

    renderHistoryFilterSummary(filtered, filters) {
        const area = document.getElementById('hist-filter-summary');
        if (!area) return;
        const machine = filters.machineId ? store.getMachines(true).find(m => String(m.id) === String(filters.machineId)) : null;
        const typeLabels = {
            periodic: '定期のみ',
            sudden: '突発のみ',
            nonProductionStop: '非生産停止のみ',
            dokatei: 'ドカ停のみ'
        };
        const periodSelect = document.getElementById('hist-filter-period');
        const chips = [];
        if (filters.period && filters.period !== 'all') chips.push(periodSelect?.selectedOptions?.[0]?.textContent || filters.period);
        if (machine) chips.push(`機械: ${machine.name || '名称なし'}`);
        if (filters.lineVal && filters.lineVal !== 'all') chips.push(`ライン: ${this.getLineLabel(filters.lineVal)}`);
        if (filters.type) chips.push(typeLabels[filters.type] || filters.type);
        if (this.modelFilter) chips.push(`型式: ${this.modelFilter}`);
        if (this.workerFilter) chips.push(`作業者: ${this.workerFilter}`);
        if (filters.partsOnly) chips.push('部品あり');
        if (filters.photosOnly) chips.push('写真あり');
        if (filters.guideOnly) chips.push('手順あり');
        if (filters.query) chips.push(`検索: ${filters.query}`);

        const totalMinutes = filtered.reduce((sum, h) => sum + (parseFloat(h.workTime) || 0), 0);
        const averageMinutes = filtered.length ? Math.round((totalMinutes / filtered.length) * 10) / 10 : 0;
        area.innerHTML = `
            <div class="history-filter-summary">
                <div class="history-filter-chips">
                    ${chips.length ? chips.map(chip => `<span>${this.escapeHtml(chip)}</span>`).join('') : '<span>絞り込みなし</span>'}
                </div>
                <div class="history-worktime-summary">
                    <b>${filtered.length}</b>件
                    <b>${this.escapeHtml(this.formatMinutesAsHours(totalMinutes))}</b>合計
                    <b>${this.escapeHtml(this.formatMinutesAsHours(averageMinutes))}</b>平均
                </div>
            </div>
        `;
    }

    formatMinutesAsHours(minutes) {
        const value = parseFloat(minutes) || 0;
        if (value < 60) return `${Math.round(value * 10) / 10}分`;
        const hours = Math.floor(value / 60);
        const mins = Math.round(value % 60);
        return mins ? `${hours}時間${mins}分` : `${hours}時間`;
    }

    getRelatedHistoryLinksHtml(current) {
        const currentParts = new Set((current.replacedParts || []).map(p => `${p.name || ''}___${p.model || ''}`));
        const currentTitle = MaintenanceStore.toHalfWidthLower(this.getHistoryDisplayText(current));
        const related = (store.activeData.history || [])
            .filter(h => h.id !== current.id && !h.isManualGuide)
            .map(h => {
                let score = 0;
                const reasons = [];
                if (h.machineId === current.machineId) {
                    score += 3;
                    reasons.push('同じ機械');
                }
                const title = MaintenanceStore.toHalfWidthLower(this.getHistoryDisplayText(h));
                if (currentTitle && title && (title.includes(currentTitle) || currentTitle.includes(title))) {
                    score += 2;
                    reasons.push('似た内容');
                }
                const sharedParts = (h.replacedParts || []).filter(p => currentParts.has(`${p.name || ''}___${p.model || ''}`));
                if (sharedParts.length > 0) {
                    score += 2;
                    reasons.push('同じ部品');
                }
                return { h, score, reasons };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score || new Date(b.h.date || '') - new Date(a.h.date || ''))
            .slice(0, 5);

        if (related.length === 0) return '';
        return `
            <div class="related-history-panel">
                <div class="related-history-head">
                    <i class="fa-solid fa-link"></i> 関連履歴
                </div>
                <div class="related-history-list">
                    ${related.map(({ h, reasons }) => {
                        const machine = store.getMachines(true).find(m => m.id === h.machineId);
                        return `
                            <button type="button" class="related-history-card" onclick="app.openHistoryEditForm('${this.escapeJs(h.id)}')">
                                <span class="related-history-date">${this.escapeHtml(h.date || '日付なし')}</span>
                                <b>${this.escapeHtml(this.getHistoryDisplayText(h))}</b>
                                <small>${this.escapeHtml(machine?.name || '機械不明')} / ${this.escapeHtml(reasons.join('・'))}</small>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    formatHistoryPartUnit(unit) {
        if (!unit || unit === 'pcs') return '個';
        return unit;
    }

    openHistoryPartsDetail(historyId) {
        const h = (store.activeData.history || []).find(x => String(x.id) === String(historyId));
        if (!h) return;

        const machine = store.getMachines(true).find(m => m.id === h.machineId);
        const parts = h.replacedParts || [];
        this.openModal('history-parts-detail', '交換部品詳細', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="history-parts-detail-head">
                    <div>
                        <span>日付</span>
                        <b>${this.escapeHtml(h.date || '-')}</b>
                    </div>
                    <div>
                        <span>機械</span>
                        <b>${this.escapeHtml(machine ? `${machine.name} [${machine.model || '-'}]` : '不明')}</b>
                    </div>
                    <div>
                        <span>内容</span>
                        <b>${this.escapeHtml(this.getHistoryDisplayText(h))}</b>
                    </div>
                </div>
                <div class="history-parts-detail-list">
                    ${parts.map(p => {
                        const count = p.count ?? p.qty ?? 0;
                        const unit = this.formatHistoryPartUnit(p.unit);
                        const price = Number(p.price || 0);
                        return `
                            <div class="history-parts-detail-item">
                                <div class="history-parts-detail-icon"><i class="fa-solid fa-box"></i></div>
                                <div>
                                    <b>${this.escapeHtml(p.name || '部品名なし')}</b>
                                    <span>${this.escapeHtml(p.model || '型式なし')}</span>
                                </div>
                                <strong>${this.escapeHtml(String(count))}${this.escapeHtml(unit)}</strong>
                                ${price ? `<em>¥${Math.round(price).toLocaleString()}</em>` : '<em>-</em>'}
                            </div>
                        `;
                    }).join('') || '<div style="color:var(--text-light); padding:16px;">交換部品はありません</div>'}
                </div>
            `;

            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.style.display = 'none';
        });
    }

    toggleModelFilter(model, event) {
        if (!model) return;
        if (event) event.stopPropagation();
        
        if (this.modelFilter === model) {
            this.modelFilter = null;
        } else {
            this.modelFilter = model;
        }
        this.renderHistory();
    }

    toggleMachineFilter(machineId, event) {
        if (!machineId) return;
        if (event) event.stopPropagation();
        
        const filter = document.getElementById('hist-filter-machine');
        if (!filter) return;

        if (filter.value === machineId) {
            filter.value = '';
        } else {
            filter.value = machineId;
        }
        this.renderHistory();
    }

    toggleTypeFilter(type, event) {
        if (!type) return;
        if (event) event.stopPropagation();
        
        const filter = document.getElementById('hist-filter-type');
        if (!filter) return;

        if (filter.value === type) {
            filter.value = '';
        } else {
            filter.value = type;
        }
        this.renderHistory();
    }

    toggleWorkerFilter(worker, event) {
        if (!worker) return;
        if (event) event.stopPropagation();
        
        if (this.workerFilter === worker) {
            this.workerFilter = null;
        } else {
            this.workerFilter = worker;
        }
        this.renderHistory();
    }

    setHistoryDensityMode(mode = 'standard') {
        this.historyDensityMode = ['standard', 'detail', 'compact'].includes(mode) ? mode : 'standard';
        localStorage.setItem('history_density_mode', this.historyDensityMode);
        this.renderHistory();
    }

    clearHistoryFilters() {
        const globalSearch = document.getElementById('global-search');
        const machineFilter = document.getElementById('hist-filter-machine');
        const lineFilter = document.getElementById('hist-filter-line');
        const typeFilter = document.getElementById('hist-filter-type');
        const partsFilter = document.getElementById('hist-filter-parts');
        const photosFilter = document.getElementById('hist-filter-photos');
        const guideFilter = document.getElementById('hist-filter-guide');
        if (globalSearch) globalSearch.value = '';
        if (machineFilter) machineFilter.value = '';
        if (lineFilter) lineFilter.value = 'all';
        if (typeFilter) typeFilter.value = '';
        if (partsFilter) partsFilter.checked = false;
        if (photosFilter) photosFilter.checked = false;
        if (guideFilter) guideFilter.checked = false;
        this.modelFilter = null;
        this.workerFilter = null;
        this.renderHistory('');
    }

    getHistoryNeighborNavHtml(current) {
        const sameMachine = (store.activeData.history || [])
            .filter(h => h.id !== current.id && !h.isManualGuide && h.machineId === current.machineId)
            .sort((a, b) => new Date(a.date || '') - new Date(b.date || ''));
        const currentTime = new Date(current.date || '').getTime();
        const prev = [...sameMachine].reverse().find(h => new Date(h.date || '').getTime() <= currentTime);
        const next = sameMachine.find(h => new Date(h.date || '').getTime() >= currentTime);
        if (!prev && !next) return '';
        const btn = (history, label, icon) => history ? `
            <button type="button" class="history-neighbor-btn" onclick="app.openHistoryEditForm('${this.escapeJs(history.id)}')">
                <i class="fa-solid ${icon}"></i>
                <span>${label}</span>
                <b>${this.escapeHtml(history.date || '日付なし')}</b>
                <small>${this.escapeHtml(this.getHistoryDisplayText(history))}</small>
            </button>
        ` : '<div></div>';
        return `
            <div class="history-neighbor-nav">
                ${btn(prev, '前回', 'fa-arrow-left')}
                ${btn(next, '次回', 'fa-arrow-right')}
            </div>
        `;
    }

    getWorkerColors(name) {
        const palette = [
            { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' }, // Blue
            { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' }, // Green
            { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' }, // Orange
            { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff' }, // Purple
            { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3' }, // Pink
            { bg: '#f0f9ff', text: '#075985', border: '#bae6fd' }, // Sky
            { bg: '#fdf4ff', text: '#86198f', border: '#f5d0fe' }, // Fuchsia
            { bg: '#f5f5f4', text: '#44403c', border: '#e7e5e4' }  // Stone
        ];
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % palette.length;
        return palette[index];
    }

    getHistoryDisplayText(h) {
        if (!h.taskId) return h.errorContent || h.notes || '突発対応';
        const task = store.activeData.tasks.find(t => String(t.id) === String(h.taskId));
        return task ? task.content : (h.taskContent || '定期メンテナンス');
    }

    getFiscalYear(dateStr) {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        const year = d.getFullYear();
        const month = d.getMonth() + 1; // 1-indexed
        return month >= 4 ? year : year - 1;
    }

    filterHistoryByPeriod(history, period) {
        if (!period || period === 'all') return history;

        const todayVal = new Date();
        const formatDate = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const todayStr = formatDate(todayVal);
        const yestVal = new Date(); yestVal.setDate(yestVal.getDate() - 1);
        const yestStr = formatDate(yestVal);

        if (period === 'today') return history.filter(h => h.date === todayStr);
        if (period === 'yesterday') return history.filter(h => h.date === yestStr);
        if (period === 'yesterday_today') return history.filter(h => h.date === todayStr || h.date === yestStr);

        if (period === 'this_month') {
            const curMonthStr = todayStr.substring(0, 7);
            return history.filter(h => h.date && h.date.startsWith(curMonthStr));
        }
        if (period === 'last_month') {
            const lastMonthVal = new Date(todayVal.getFullYear(), todayVal.getMonth() - 1, 1);
            const lastMonthStr = formatDate(lastMonthVal).substring(0, 7);
            return history.filter(h => h.date && h.date.startsWith(lastMonthStr));
        }
        if (period === 'last_30_days') {
            const start = new Date(); start.setDate(start.getDate() - 30);
            const startStr = formatDate(start);
            return history.filter(h => h.date >= startStr && h.date <= todayStr);
        }
        if (period === 'prev_30_days') {
            const date31 = new Date(); date31.setDate(date31.getDate() - 31);
            const date60 = new Date(); date60.setDate(date60.getDate() - 60);
            return history.filter(h => h.date >= formatDate(date60) && h.date <= formatDate(date31));
        }
        if (period === 'fiscal_year') {
            const currentFY = this.getFiscalYear(todayStr);
            return history.filter(h => this.getFiscalYear(h.date) === currentFY);
        }
        if (period === 'last_fiscal_year') {
            const lastFY = this.getFiscalYear(todayStr) - 1;
            return history.filter(h => this.getFiscalYear(h.date) === lastFY);
        }
        if (period === 'custom') {
            const startDate = localStorage.getItem('customStartDate');
            return startDate ? history.filter(h => h.date >= startDate) : history;
        }
        if (period === 'custom_range') {
            const start = localStorage.getItem('customRangeStart');
            const end = localStorage.getItem('customRangeEnd');
            return history.filter(h => {
                if (!h.date) return false;
                if (start && h.date < start) return false;
                if (end && h.date > end) return false;
                return true;
            });
        }
        
        const fy = parseInt(period);
        if (!isNaN(fy)) return history.filter(h => this.getFiscalYear(h.date) === fy);
        
        return history;
    }

    updateHistoryPeriodOptions() {
        const hFilter = document.getElementById('hist-filter-period');
        const aFilter = document.getElementById('analysis-filter-period');
        const dFilter = document.getElementById('dashboard-filter-period');
        const rFilter = document.getElementById('ranking-filter-period');
        const wtFilter = document.getElementById('worktime-filter-period');
        
        const filters = [hFilter, aFilter, dFilter, rFilter, wtFilter].filter(f => f);
        if (filters.length === 0) return;
        
        const years = new Set();
        store.activeData.history.forEach(h => {
            const fy = this.getFiscalYear(h.date);
            if (fy) years.add(fy);
        });
        years.add(this.getFiscalYear(new Date().toISOString().split('T')[0]));
        const sortedYears = Array.from(years).sort((a,b) => b - a);

        const now = new Date();
        const currentMonth = now.getMonth() + 1;

        filters.forEach(filter => {
            const currentVal = filter.value;
            const customDate = localStorage.getItem('customStartDate');
            const customLabel = customDate ? `指定日以降 (${customDate})` : '指定日以降...';
            
            const rangeStart = localStorage.getItem('customRangeStart');
            const rangeEnd = localStorage.getItem('customRangeEnd');
            const rangeLabel = (rangeStart && rangeEnd) ? `指定範囲 (${rangeStart}〜${rangeEnd})` : '指定範囲 (開始〜終了)...';

            filter.innerHTML = `
                <option value="today">今日</option>
                <option value="yesterday">昨日</option>
                <option value="yesterday_today">昨日と今日</option>
                <option value="this_month">今月 (${currentMonth}月)</option>
                <option value="all">累計 (全ての記録)</option>
                <option value="custom">${customLabel}</option>
                <option value="custom_range">${rangeLabel}</option>
            `;
            sortedYears.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = `${y}年度 (4月〜3月)`;
                filter.appendChild(opt);
            });
            // デフォルトは「今月」に設定（ただし既に値がある場合は保持）
            if (!currentVal) {
                filter.value = 'this_month';
            } else {
                filter.value = currentVal;
            }
        });
    }

    onPeriodChange(el, renderFn) {
        if (el.value === 'custom') {
            const current = localStorage.getItem('customStartDate') || new Date().toISOString().split('T')[0];
            const date = prompt('指定日以降のデータを集計します。開始日を入力してください (YYYY-MM-DD):', current);
            if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
                localStorage.setItem('customStartDate', date);
                this.updateHistoryPeriodOptions();
                el.value = 'custom';
            } else if (!localStorage.getItem('customStartDate')) {
                el.value = 'this_month';
            }
        } else if (el.value === 'custom_range') {
            const curS = localStorage.getItem('customRangeStart') || new Date().toISOString().split('T')[0];
            const curE = localStorage.getItem('customRangeEnd') || new Date().toISOString().split('T')[0];
            const start = prompt('開始日を入力してください (YYYY-MM-DD):', curS);
            if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
                const end = prompt('終了日を入力してください (YYYY-MM-DD):', curE);
                if (end && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
                    localStorage.setItem('customRangeStart', start);
                    localStorage.setItem('customRangeEnd', end);
                    this.updateHistoryPeriodOptions();
                    el.value = 'custom_range';
                }
            }
            if (!localStorage.getItem('customRangeStart') || !localStorage.getItem('customRangeEnd')) {
                if (el.value === 'custom_range') el.value = 'this_month';
            }
        }
        renderFn();
    }

    getPeriodDays(period) {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const dayMs = 24 * 60 * 60 * 1000;

        if (period === 'today' || period === 'yesterday') return 1;
        if (period === 'this_month') return (now.getDate());
        if (period === 'last_month') {
            const lastM = new Date(now.getFullYear(), now.getMonth(), 0);
            return lastM.getDate();
        }
        if (period === 'last_30_days') return 30;
        if (period === 'prev_30_days') return 30;
        if (period === 'fiscal_year') {
            const fyStart = new Date(this.getFiscalYear(todayStr), 3, 1);
            return Math.ceil((now - fyStart) / dayMs) || 1;
        }
        if (period === 'last_fiscal_year') {
            const fyStart = new Date(this.getFiscalYear(todayStr) - 1, 3, 1);
            const fyEnd = new Date(this.getFiscalYear(todayStr), 2, 31);
            return Math.ceil((fyEnd - fyStart) / dayMs) + 1;
        }
        if (period === 'custom') {
            const startStr = localStorage.getItem('customStartDate');
            if (!startStr) return 1;
            const start = new Date(startStr);
            return Math.ceil((now - start) / dayMs) || 1;
        }
        if (period === 'custom_range') {
            const sStr = localStorage.getItem('customRangeStart');
            const eStr = localStorage.getItem('customRangeEnd');
            if (!sStr || !eStr) return 1;
            const start = new Date(sStr);
            const end = new Date(eStr);
            return Math.ceil((end - start) / dayMs) + 1 || 1;
        }
        const fy = parseInt(period);
        if (!isNaN(fy)) return 365; // Default for historical years
        return 30;
    }

    getPeriodLabel(period) {
        const periodMap = { 
            'today': '今日',
            'yesterday': '昨日',
            'yesterday_today': '昨日・今日',
            'this_month': '今月', 
            'fiscal_year': '今年度', 
            'all': '累計', 
            'custom': '指定日以降', 
            'custom_range': '指定範囲', 
            'last_month': '先月', 
            'last_30_days': '直近30日間', 
            'prev_30_days': 'その前の30日間', 
            'last_fiscal_year': '前年度' 
        };
        let label = periodMap[period] || (isNaN(parseInt(period)) ? '不明' : `${period}年度`);
        
        if (period === 'custom') {
            const date = localStorage.getItem('customStartDate');
            if (date) label = `${date} 以降`;
        } else if (period === 'custom_range') {
            const s = localStorage.getItem('customRangeStart');
            const e = localStorage.getItem('customRangeEnd');
            if (s && e) label = `${s} 〜 ${e}`;
        }
        return label;
    }

    updateViewSubtitle(viewId, period) {
        const view = document.getElementById(viewId);
        if (!view) return;
        const subtitle = view.querySelector('.subtitle');
        if (!subtitle) return;

        // Extract base text by removing any previously appended period info
        const baseTxt = subtitle.textContent.split(' 集計期間:')[0].split(' [')[0].split('【')[0].trim(); 
        const label = this.getPeriodLabel(period);
        subtitle.innerHTML = `${baseTxt} <span class="period-badge-header" style="background:var(--primary-light); color:var(--primary); padding:3px 10px; border-radius:99px; margin-left:10px; font-size:0.75rem; border:1px solid var(--primary); font-weight:800; white-space:nowrap;"><i class="fa-solid fa-calendar-day" style="margin-right:4px;"></i>集計期間: ${label}</span>`;
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppHistoryMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppHistoryMethods.prototype[name];
        }
    }
})();
