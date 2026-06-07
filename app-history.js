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
                    <div style="padding:14px; border:1px solid #fde68a; border-radius:12px; background:#fffbeb;">
                        <div style="font-size:0.92rem; color:#78350f; font-weight:850; line-height:1.65; margin-bottom:12px; min-height:86px; max-height:180px; overflow:auto; white-space:pre-wrap;">${store.activeData.memos[dateStr] ? this.escapeHtml(store.activeData.memos[dateStr]) : 'この日のメモは未入力です。'}</div>
                        <button class="primary-btn" style="width:100%; font-weight:900;" onclick="app.closeModal(); app.openCalendarMemoEditor('${dateStr}', null, { returnToDayMenu: true })">
                            <i class="fa-solid fa-note-sticky"></i> 大きいメモ編集を開く
                        </button>
                        <p style="font-size:0.65rem; color:var(--text-light); margin-top:6px;">※カレンダーセルのメモアイコンと同じ編集画面を開きます。</p>
                    </div>
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
        this.closeCalendarMemoEditor?.();
        if (store.activeData.memos) {
            delete store.activeData.memos[date];
            store.save();
            this.renderCalendar();
            if (typeof this.renderDashboard === 'function' && document.getElementById('dashboard-widgets')) {
                this.renderDashboard();
            }
        }
    }

    saveDayMemo(date) {
        const txt = (document.getElementById('cal-day-memo')?.value || '').trim();
        if (!store.activeData.memos) store.activeData.memos = {};
        if (txt) {
            store.activeData.memos[date] = txt;
        } else {
            delete store.activeData.memos[date];
        }
        store.save();
        this.closeModal();
        this.renderCalendar();
        if (typeof this.renderDashboard === 'function' && document.getElementById('dashboard-widgets')) {
            this.renderDashboard();
        }
    }

    openHistoryEditForm(historyId, focusTarget = null) {
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
                        <textarea id="e-symptom" class="sudden-detail-textarea" rows="6" placeholder="どのような異常が発生したか記入してください" required oninput="app.updateHistorySmartAssist('e-', true, '${this.escapeJs(historyId)}')">${h.errorContent || ''}</textarea>
                    </div>
                    <div id="e-history-assist-panel"></div>

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
            this.injectUnifiedSearchReturnButton?.();
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
            if (focusTarget) {
                setTimeout(() => this.focusHistoryEditField(focusTarget), 120);
            }
        });
    }

    focusHistoryEditField(target) {
        const fieldMap = {
            title: 'e-symptom',
            symptom: 'e-symptom',
            cause: 'e-cause',
            notes: 'e-notes',
            action: 'e-notes'
        };
        const fieldId = fieldMap[target] || target;
        const field = document.getElementById(fieldId);
        if (!field) return;
        const group = field.closest('.form-group') || field;
        group.classList.remove('history-edit-field-focus');
        void group.offsetWidth;
        group.classList.add('history-edit-field-focus');
        field.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        setTimeout(() => {
            field.focus({ preventScroll: true });
            if (typeof field.select === 'function') field.select();
        }, 260);
        setTimeout(() => group.classList.remove('history-edit-field-focus'), 2600);
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

    renderHistoryWorkTimeCell(history) {
        const workTime = history?.workTime || 0;
        if (history?.startTime && history?.endTime) {
            return `
                <b>${this.escapeHtml(`${history.startTime}-${history.endTime}`)}</b>
                <small>${this.escapeHtml(`${workTime}分`)}</small>
            `;
        }
        return `<b>${this.escapeHtml(`${workTime}分`)}</b>`;
    }

    renderHistoryDateCell(dateText, isRepeated = false, isGroupStart = false, groupCount = 1, isCollapsed = false) {
        const match = String(dateText || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!match) return this.escapeHtml(dateText || '-');
        const [, year, month, day] = match;
        return `
            <div class="history-date-cell ${isRepeated ? 'same-date' : ''} ${isGroupStart ? 'group-start' : ''}">
                ${isRepeated ? '' : `<b>${this.escapeHtml(year)}</b>`}
                <span>${Number(month)}/${Number(day)}</span>
                ${isGroupStart && groupCount > 1 ? `<button type="button" class="history-date-count-toggle ${isCollapsed ? 'collapsed' : ''}" onclick="app.toggleHistoryDateGroup('${this.escapeJs(dateText)}', event)" title="${isCollapsed ? 'この日の履歴を展開' : 'この日の履歴を折りたたむ'}">${isCollapsed ? '+' : ''}${groupCount}件</button>` : ''}
            </div>
        `;
    }

    toggleHistoryDateGroup(dateText, event) {
        if (event) event.stopPropagation();
        if (!this.collapsedHistoryDates) this.collapsedHistoryDates = new Set();
        const key = String(dateText || '');
        if (!key) return;
        if (this.collapsedHistoryDates.has(key)) {
            this.collapsedHistoryDates.delete(key);
        } else {
            this.collapsedHistoryDates.add(key);
        }
        this.renderHistory();
    }

    renderHistoryPrioritySigns(history, recurrenceGroup, cost) {
        const signs = [];
        const workMinutes = parseFloat(history?.workTime) || 0;
        if (recurrenceGroup?.count >= 3 || (recurrenceGroup?.count >= 2 && recurrenceGroup.avgIntervalDays && recurrenceGroup.avgIntervalDays <= 14)) {
            signs.push({ cls: 'recurrence', icon: 'fa-repeat', label: '高頻度' });
        }
        if ((cost?.total || 0) >= 5000) {
            signs.push({ cls: 'cost', icon: 'fa-yen-sign', label: '高コスト' });
        }
        if (workMinutes >= 60) {
            signs.push({ cls: 'time', icon: 'fa-clock', label: '長時間' });
        }
        if (!signs.length) return '';
        return `<span class="history-priority-signs">${signs.map(sign => `
            <span class="history-priority-sign ${sign.cls}" title="${this.escapeHtml(sign.label)}">
                <i class="fa-solid ${sign.icon}"></i>${this.escapeHtml(sign.label)}
            </span>
        `).join('')}</span>`;
    }

    getHistoryWorkMinutes(history) {
        return parseFloat(history?.workTime) || 0;
    }

    initializeHistorySortState() {
        if (this._historySortReady) return;
        const savedMode = localStorage.getItem('history_sort_mode');
        const savedDateDir = localStorage.getItem('history_date_sort_dir');
        this.historyMetricSortMode = ['date', 'time', 'cost'].includes(savedMode) ? savedMode : (this.historyMetricSortMode || 'date');
        this.historyDateSortDir = ['asc', 'desc'].includes(savedDateDir) ? savedDateDir : (this.historyDateSortDir || 'desc');
        this._historySortReady = true;
    }

    saveHistorySortState() {
        localStorage.setItem('history_sort_mode', this.historyMetricSortMode || 'date');
        localStorage.setItem('history_date_sort_dir', this.historyDateSortDir || 'desc');
    }

    getHistorySortLabel() {
        if (this.historyMetricSortMode === 'time') return '並び替え: 作業時間 多い順';
        if (this.historyMetricSortMode === 'cost') return '並び替え: コスト 高い順';
        return `並び替え: 日付 ${this.historyDateSortDir === 'asc' ? '古い順' : '新しい順'}`;
    }

    toggleHistoryMetricSort(mode) {
        if (mode === 'date') {
            this.historyMetricSortMode = 'date';
            this.historyDateSortDir = this.historyDateSortDir === 'asc' ? 'desc' : 'asc';
        } else {
            this.historyMetricSortMode = this.historyMetricSortMode === mode ? 'date' : mode;
            this.historyDateSortDir = 'desc';
        }
        this.saveHistorySortState();
        this.renderHistory();
    }

    updateHistoryMetricSortButtons() {
        const dateBtn = document.getElementById('history-sort-date-btn');
        const timeBtn = document.getElementById('history-sort-time-btn');
        const costBtn = document.getElementById('history-sort-cost-btn');
        const dateIcon = document.getElementById('history-sort-date-icon');
        const timeIcon = document.getElementById('history-sort-time-icon');
        const costIcon = document.getElementById('history-sort-cost-icon');
        const isDateSort = !this.historyMetricSortMode || this.historyMetricSortMode === 'date';
        if (dateBtn) dateBtn.classList.toggle('active', isDateSort);
        if (dateIcon) dateIcon.className = `fa-solid ${this.historyDateSortDir === 'asc' ? 'fa-arrow-up-short-wide' : 'fa-arrow-down-wide-short'}`;
        if (timeBtn) timeBtn.classList.toggle('active', this.historyMetricSortMode === 'time');
        if (costBtn) costBtn.classList.toggle('active', this.historyMetricSortMode === 'cost');
        document.getElementById('history-visible-cost-total')?.classList.toggle('active', this.historyMetricSortMode === 'cost');
        if (timeIcon) timeIcon.className = 'fa-solid fa-arrow-down-wide-short history-sort-dir-icon';
        if (costIcon) costIcon.className = 'fa-solid fa-arrow-down-wide-short history-sort-dir-icon';
    }

    sortHistoryRows(rows) {
        const sortByDate = () => {
            const dir = this.historyDateSortDir === 'asc' ? 1 : -1;
            rows.sort((a, b) => (new Date(a.date || '') - new Date(b.date || '')) * dir);
        };
        if (!this.historyMetricSortMode || this.historyMetricSortMode === 'date') {
            sortByDate();
            return;
        }
        if (this.historyMetricSortMode === 'time') {
            rows.sort((a, b) => this.getHistoryWorkMinutes(b) - this.getHistoryWorkMinutes(a) || new Date(b.date || '') - new Date(a.date || ''));
            return;
        }
        if (this.historyMetricSortMode === 'cost') {
            rows.sort((a, b) => this.calculateHistoryCost(b).total - this.calculateHistoryCost(a).total || new Date(b.date || '') - new Date(a.date || ''));
            return;
        }
        sortByDate();
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

    ensureHistorySelectionState() {
        if (!(this.selectedHistoryIds instanceof Set)) this.selectedHistoryIds = new Set();
    }

    toggleHistorySelection(id, checked) {
        this.ensureHistorySelectionState();
        if (checked) this.selectedHistoryIds.add(String(id));
        else this.selectedHistoryIds.delete(String(id));
        this.updateHistoryBulkBar();
    }

    toggleVisibleHistorySelection(checked) {
        this.ensureHistorySelectionState();
        (this.visibleHistoryIds || []).forEach(id => {
            if (checked) this.selectedHistoryIds.add(String(id));
            else this.selectedHistoryIds.delete(String(id));
        });
        document.querySelectorAll('.history-row-select').forEach(input => {
            input.checked = !!checked;
        });
        this.updateHistoryBulkBar();
    }

    clearHistorySelection() {
        this.ensureHistorySelectionState();
        this.selectedHistoryIds.clear();
        document.querySelectorAll('.history-row-select').forEach(input => input.checked = false);
        const all = document.getElementById('history-select-all');
        if (all) {
            all.checked = false;
            all.indeterminate = false;
        }
        this.updateHistoryBulkBar();
    }

    getSelectedHistoryRecords() {
        this.ensureHistorySelectionState();
        return (store.activeData.history || []).filter(h => this.selectedHistoryIds.has(String(h.id)) && !h.isManualGuide);
    }

    updateHistoryBulkBar() {
        this.ensureHistorySelectionState();
        const bar = document.getElementById('hist-bulk-bar');
        const visibleIds = this.visibleHistoryIds || [];
        const selectedVisibleCount = visibleIds.filter(id => this.selectedHistoryIds.has(String(id))).length;
        const selectedTotal = this.getSelectedHistoryRecords().length;
        const all = document.getElementById('history-select-all');
        if (all) {
            all.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
            all.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
        }
        if (!bar) return;
        bar.hidden = false;
        if (selectedTotal <= 0) {
            bar.className = 'history-bulk-bar empty';
            bar.innerHTML = `
                <div class="history-bulk-message">
                    <b><i class="fa-solid fa-list-check"></i> 複数の履歴をまとめて編集できます</b>
                    <span>左端のチェック欄で履歴を選ぶと、ライン・装置区分・作業区分・作業者などを一括変更できます。</span>
                </div>
                <div class="history-bulk-actions">
                    <button type="button" class="secondary-btn" onclick="app.toggleVisibleHistorySelection(true)"><i class="fa-solid fa-check-double"></i> 表示中を全選択</button>
                    <button type="button" class="secondary-btn history-bulk-main-btn is-disabled" onclick="app.showHistoryBulkEditGuide()" aria-disabled="true"><i class="fa-solid fa-pen-to-square"></i> チェック後に一括編集</button>
                    <button type="button" class="secondary-btn" onclick="app.showHistoryBulkEditGuide()"><i class="fa-solid fa-hand-pointer"></i> チェック欄を表示</button>
                </div>
            `;
            return;
        }
        bar.className = 'history-bulk-bar ready';
        const readyClass = selectedTotal >= 2 ? 'is-ready' : 'is-single';
        bar.innerHTML = `
            <div class="history-bulk-message">
                <b><i class="fa-solid fa-check-square"></i> ${selectedTotal}件を選択中</b>
                <span>${selectedTotal >= 2 ? '複数選択されています。右の一括編集ボタンからまとめて変更できます。' : 'もう1件選ぶと複数履歴をまとめて変更できます。'}</span>
            </div>
            <div class="history-bulk-actions">
                <button type="button" class="secondary-btn" onclick="app.toggleVisibleHistorySelection(true)"><i class="fa-solid fa-check-double"></i> 表示中を全選択</button>
                <button type="button" class="primary-btn history-bulk-main-btn ${readyClass}" onclick="app.openHistoryBulkEditModal()"><i class="fa-solid fa-pen-to-square"></i> 選択した${selectedTotal}件を一括編集</button>
                <button type="button" class="secondary-btn" onclick="app.clearHistorySelection()">選択解除</button>
            </div>
        `;
    }

    showHistoryBulkEditGuide() {
        const table = document.querySelector('#history-list-body')?.closest('table');
        table?.classList.add('history-bulk-guide-flash');
        setTimeout(() => table?.classList.remove('history-bulk-guide-flash'), 2200);
        const targets = document.querySelectorAll('.history-row-select, #history-select-all');
        targets.forEach(el => el.classList.add('selection-hint'));
        document.getElementById('history-select-all')?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        setTimeout(() => targets.forEach(el => el.classList.remove('selection-hint')), 2200);
        this.showToast?.('履歴一覧の左端チェックを選ぶと、一括編集できます', 'info');
    }

    openHistoryBulkEditModal() {
        const selected = this.getSelectedHistoryRecords();
        if (!selected.length) {
            this.showHistoryBulkEditGuide();
            alert('一括編集する履歴を、一覧の左端チェックで選択してください。');
            return;
        }
        const workers = store.getWorkers ? store.getWorkers().filter(w => !store.isWorkerArchived?.(w)) : [];
        this.openModal('history-bulk-edit', 'メンテナンス履歴の一括編集', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="history-bulk-edit">
                    <div class="history-bulk-edit-note">
                        <b><i class="fa-solid fa-list-check"></i> ${selected.length}件をまとめて編集します</b>
                        <span>「変更する」にチェックした項目だけ反映されます。</span>
                    </div>
                    <div class="history-bulk-edit-grid">
                        <label class="history-bulk-field">
                            <span><input type="checkbox" id="bulk-use-line"> ラインを変更する</span>
                            <select id="bulk-line-no">${this.generateLineOptionsHTML()}</select>
                        </label>
                        <label class="history-bulk-field">
                            <span><input type="checkbox" id="bulk-use-machine-category"> 装置区分を変更する</span>
                            <select id="bulk-machine-category">${this.getMachineCategoryOptions('', false)}</select>
                        </label>
                        <label class="history-bulk-field">
                            <span><input type="checkbox" id="bulk-use-category"> 作業区分を変更する</span>
                            <select id="bulk-category">
                                <option value="machine">機械修理</option>
                                <option value="electric">電気系修理</option>
                                <option value="adjust">調整・設定変更</option>
                                <option value="parts">部品交換</option>
                                <option value="clean">清掃・給油</option>
                                <option value="other">その他</option>
                            </select>
                        </label>
                        <label class="history-bulk-field">
                            <span><input type="checkbox" id="bulk-use-occurrence"> 初回/再発を変更する</span>
                            <select id="bulk-occurrence">
                                <option value="first">初回</option>
                                <option value="recurrence">再発</option>
                            </select>
                        </label>
                        <label class="history-bulk-field">
                            <span><input type="checkbox" id="bulk-use-type"> 対応種別を変更する</span>
                            <select id="bulk-type">
                                <option value="sudden">突発</option>
                                <option value="nonProductionStop">非生産停止</option>
                                <option value="dokatei">ドカ停</option>
                            </select>
                        </label>
                        <label class="history-bulk-field wide">
                            <span><input type="checkbox" id="bulk-use-workers"> 作業者を変更する</span>
                            <div class="history-bulk-workers">
                                <select id="bulk-workers-mode">
                                    <option value="replace">置き換え</option>
                                    <option value="add">追記</option>
                                    <option value="remove">削除</option>
                                </select>
                                <input type="text" id="bulk-workers" placeholder="例: 山田, 田中" list="bulk-worker-list">
                                <datalist id="bulk-worker-list">${workers.map(w => `<option value="${this.escapeHtml(w)}"></option>`).join('')}</datalist>
                            </div>
                        </label>
                    </div>
                    <div class="history-bulk-preview">
                        ${selected.slice(0, 8).map(h => {
                            const machine = store.getMachines(true).find(m => m.id === h.machineId);
                            return `<span>${this.escapeHtml(h.date || '-')} / ${this.escapeHtml(machine?.name || '機械不明')} / ${this.escapeHtml(this.getHistoryDisplayText(h))}</span>`;
                        }).join('')}
                        ${selected.length > 8 ? `<span>ほか ${selected.length - 8}件</span>` : ''}
                    </div>
                </div>
            `;
            const footer = document.querySelector('.modal-footer');
            footer.innerHTML = `
                <button class="secondary-btn" id="modal-cancel">キャンセル</button>
                <button class="primary-btn" onclick="app.applyHistoryBulkEdit()"><i class="fa-solid fa-floppy-disk"></i> 一括更新</button>
            `;
            document.getElementById('modal-cancel').onclick = () => this.closeModal();
        });
    }

    splitWorkerText(text) {
        return String(text || '').split(/\s*(?:,|，|、|\/)\s*/).map(w => w.trim()).filter(Boolean);
    }

    applyHistoryBulkEdit() {
        const selected = this.getSelectedHistoryRecords();
        if (!selected.length) return alert('一括編集する履歴にチェックを入れてください。');
        const useLine = !!document.getElementById('bulk-use-line')?.checked;
        const useMachineCategory = !!document.getElementById('bulk-use-machine-category')?.checked;
        const useCategory = !!document.getElementById('bulk-use-category')?.checked;
        const useOccurrence = !!document.getElementById('bulk-use-occurrence')?.checked;
        const useType = !!document.getElementById('bulk-use-type')?.checked;
        const useWorkers = !!document.getElementById('bulk-use-workers')?.checked;
        if (!useLine && !useMachineCategory && !useCategory && !useOccurrence && !useType && !useWorkers) {
            alert('変更する項目にチェックを入れてください。');
            return;
        }
        const lineNo = document.getElementById('bulk-line-no')?.value || '';
        const machineCategory = document.getElementById('bulk-machine-category')?.value || '';
        const category = document.getElementById('bulk-category')?.value || 'other';
        const occurrence = document.getElementById('bulk-occurrence')?.value || 'first';
        const type = document.getElementById('bulk-type')?.value || 'sudden';
        const workersMode = document.getElementById('bulk-workers-mode')?.value || 'replace';
        const workers = this.splitWorkerText(document.getElementById('bulk-workers')?.value || '');
        if (useWorkers && workers.length === 0) {
            alert('作業者を入力してください。');
            return;
        }
        if (useMachineCategory && !machineCategory) {
            alert('装置区分を選択してください。');
            return;
        }
        const ok = confirm(`${selected.length}件の履歴を一括更新します。よろしいですか？`);
        if (!ok) return;

        selected.forEach(h => {
            if (useLine) h.lineNo = lineNo;
            if (useMachineCategory) {
                h.machineCategory = machineCategory;
                const machine = store.getMachines(true).find(m => m.id === h.machineId);
                if (machine && machine.category !== machineCategory) {
                    store.updateMachine(h.machineId, { category: machineCategory });
                }
            }
            if (useCategory) h.category = category;
            if (useOccurrence) h.isFirstTime = occurrence === 'first';
            if (useType) {
                if (h.taskId) {
                    h.taskContent = h.taskContent || this.getHistoryDisplayText(h);
                    h.errorContent = h.errorContent || h.taskContent || h.notes || '突発対応';
                    delete h.taskId;
                }
                h.isSudden = true;
                h.isDokatei = type === 'dokatei';
                h.isNonProductionStop = type === 'nonProductionStop';
            }
            if (useWorkers) {
                const current = Array.isArray(h.workers) ? h.workers : [];
                if (workersMode === 'replace') h.workers = [...workers];
                if (workersMode === 'add') h.workers = Array.from(new Set([...current, ...workers]));
                if (workersMode === 'remove') h.workers = current.filter(w => !workers.includes(w));
            }
        });
        store.save();
        this.closeModal();
        this.clearHistorySelection();
        this.updateDataLists();
        this.renderHistory();
        this.renderCalendar();
        this.renderDashboard?.();
        this.showToast?.(`${selected.length}件を一括更新しました`, 'success');
    }

    getHistoryImportLikeKey(record) {
        return [
            record.date || '',
            record.machineId || '',
            this.getHistoryDisplayText(record) || record.errorContent || record.notes || '',
            String(record.workTime || 0)
        ].map(v => MaintenanceStore.toHalfWidthLower(String(v).trim())).join('__');
    }

    getHistoryQualityChecks() {
        const histories = (store.activeData.history || []).filter(h => !h.isManualGuide);
        const machines = store.getMachines(true);
        const machineMap = new Map(machines.map(m => [String(m.id), m]));
        const duplicateMap = new Map();
        const checks = [
            { key: 'missingMachine', label: '機械が見つからない履歴', icon: 'fa-industry', severity: 'danger', items: [] },
            { key: 'missingLine', label: 'ライン未設定', icon: 'fa-route', severity: 'warning', items: [] },
            { key: 'missingMachineCategory', label: '装置区分未設定', icon: 'fa-tag', severity: 'warning', items: [] },
            { key: 'missingWorkers', label: '作業者未入力', icon: 'fa-user-gear', severity: 'danger', items: [] },
            { key: 'missingContent', label: '内容未入力', icon: 'fa-file-lines', severity: 'danger', items: [] },
            { key: 'missingCause', label: '原因未入力（突発系）', icon: 'fa-magnifying-glass-chart', severity: 'info', items: [] },
            { key: 'zeroTime', label: '作業時間0分', icon: 'fa-clock', severity: 'warning', items: [] },
            { key: 'invalidDate', label: '日付不正・未入力', icon: 'fa-calendar-xmark', severity: 'danger', items: [] },
            { key: 'duplicateCandidate', label: '重複候補', icon: 'fa-clone', severity: 'info', groups: [] }
        ];
        const byKey = Object.fromEntries(checks.map(c => [c.key, c]));
        histories.forEach(h => {
            const machine = machineMap.get(String(h.machineId));
            const line = h.lineNo || machine?.lineNo || '';
            const category = h.machineCategory || machine?.category || '';
            const content = this.getHistoryDisplayText(h);
            const isTrouble = !h.taskId || h.isDokatei || h.isNonProductionStop || h.isSudden;
            const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(String(h.date || '')) && !isNaN(new Date(h.date).getTime());
            const item = {
                id: h.id,
                date: h.date || '日付なし',
                machineName: machine?.name || '機械不明',
                title: content || '内容なし',
                meta: `${line ? this.getLineLabel(line) : 'ライン未設定'} / ${category || '装置区分未設定'}`
            };
            if (!machine) byKey.missingMachine.items.push(item);
            if (!line) byKey.missingLine.items.push(item);
            if (!category) byKey.missingMachineCategory.items.push(item);
            if (!Array.isArray(h.workers) || h.workers.length === 0) byKey.missingWorkers.items.push(item);
            if (!content || content === '突発対応' || content === '定期メンテナンス') byKey.missingContent.items.push(item);
            if (isTrouble && !String(h.cause || '').trim()) byKey.missingCause.items.push(item);
            if ((parseFloat(h.workTime) || 0) <= 0) byKey.zeroTime.items.push(item);
            if (!dateOk) byKey.invalidDate.items.push(item);
            const key = this.getHistoryImportLikeKey(h);
            if (!duplicateMap.has(key)) duplicateMap.set(key, []);
            duplicateMap.get(key).push(item);
        });
        byKey.duplicateCandidate.groups = Array.from(duplicateMap.values()).filter(group => group.length > 1);
        const priority = {
            missingMachine: 1,
            invalidDate: 2,
            missingWorkers: 3,
            missingContent: 4,
            zeroTime: 5,
            missingLine: 6,
            missingMachineCategory: 7,
            missingCause: 8,
            duplicateCandidate: 9
        };
        return checks.sort((a, b) => {
            const countA = a.groups ? a.groups.length : a.items.length;
            const countB = b.groups ? b.groups.length : b.items.length;
            const activeA = countA > 0 ? 0 : 1;
            const activeB = countB > 0 ? 0 : 1;
            if (activeA !== activeB) return activeA - activeB;
            return (priority[a.key] || 99) - (priority[b.key] || 99);
        });
    }

    renderHistoryQualityItem(item) {
        return `
            <button type="button" class="history-quality-item" onclick="app.closeModal(); app.openHistoryEditForm('${this.escapeJs(item.id)}')">
                <b>${this.escapeHtml(item.date)} / ${this.escapeHtml(item.machineName)}</b>
                <span>${this.escapeHtml(item.title)}</span>
                <small>${this.escapeHtml(item.meta)}</small>
            </button>
        `;
    }

    selectHistoryQualityItems(mapKey) {
        this.ensureHistorySelectionState();
        const ids = Array.from(new Set((this.historyQualitySelectMap?.[mapKey]?.ids || []).map(id => String(id))));
        if (!ids.length) {
            alert('選択できる履歴がありません。');
            return;
        }
        ids.forEach(id => this.selectedHistoryIds.add(id));
        const label = this.historyQualitySelectMap?.[mapKey]?.label || '品質チェック';
        this.closeModal();
        this.switchView('history');
        this.renderHistory();
        this.updateHistoryBulkBar();
        this.showToast?.(`${label} の ${ids.length}件を選択しました`, 'success');
    }

    selectAllHistoryQualityItems() {
        this.ensureHistorySelectionState();
        const allIds = Object.values(this.historyQualitySelectMap || {}).flatMap(entry => entry.ids || []);
        const ids = Array.from(new Set(allIds.map(id => String(id))));
        if (!ids.length) {
            alert('選択できる履歴がありません。');
            return;
        }
        ids.forEach(id => this.selectedHistoryIds.add(id));
        this.closeModal();
        this.switchView('history');
        this.renderHistory();
        this.updateHistoryBulkBar();
        this.showToast?.(`品質チェックの該当履歴 ${ids.length}件を選択しました`, 'success');
    }

    openHistoryQualityCheck() {
        const checks = this.getHistoryQualityChecks();
        const totalIssues = checks.reduce((sum, check) => sum + (check.groups ? check.groups.length : check.items.length), 0);
        const brokenReport = typeof this.getBrokenDataReport === 'function' ? this.getBrokenDataReport() : null;
        const brokenTotal = brokenReport && typeof this.getBrokenDataCount === 'function' ? this.getBrokenDataCount(brokenReport) : 0;
        this.historyQualitySelectMap = {};
        this.openModal('history-quality-check', 'データ品質チェック', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="history-quality">
                    <div class="history-quality-head">
                        <div>
                            <b><i class="fa-solid fa-shield-halved"></i> 集計精度に影響しやすいデータを確認</b>
                            <span>項目をクリックすると対象の履歴編集を開きます。</span>
                        </div>
                        <strong class="${totalIssues ? 'has-issues' : 'ok'}">${totalIssues ? `${totalIssues}項目` : '問題なし'}</strong>
                    </div>
                    ${brokenReport ? `
                        <div class="history-quality-admin-link ${brokenTotal ? 'has-issues' : 'ok'}">
                            <div>
                                <b><i class="fa-solid fa-screwdriver-wrench"></i> 管理画面の壊れた参照</b>
                                <span>
                                    周期設定参照 ${brokenReport.archivedMaintenanceTasks.length}件 / 手順書参照 ${brokenReport.archivedGuides.length}件 / スキル除外参照 ${brokenReport.archivedTasks.length}件 / 機械不明履歴 ${brokenReport.missingMachineHistories.length}件
                                </span>
                            </div>
                            <div>
                                <button class="secondary-btn" onclick="app.openBrokenDataDetailModal()" ${brokenTotal ? '' : 'disabled'}>
                                    <i class="fa-solid fa-list-ul"></i> 詳細
                                </button>
                                <button class="secondary-btn" onclick="app.cleanupBrokenDataReferences()" ${(brokenReport.archivedMaintenanceTasks.length + brokenReport.archivedGuides.length + brokenReport.archivedTasks.length) ? '' : 'disabled'}>
                                    <i class="fa-solid fa-broom"></i> 自動修復
                                </button>
                            </div>
                        </div>
                    ` : ''}
                    <div class="history-quality-grid">
                        ${checks.map(check => {
                            const count = check.groups ? check.groups.length : check.items.length;
                            const ids = check.groups
                                ? check.groups.flatMap(group => group.map(item => item.id))
                                : check.items.map(item => item.id);
                            const mapKey = `quality_${check.key}`;
                            this.historyQualitySelectMap[mapKey] = { ids, label: check.label };
                            return `
                                <section class="history-quality-card ${check.severity}">
                                    <header>
                                        <i class="fa-solid ${check.icon}"></i>
                                        <b>${this.escapeHtml(check.label)}</b>
                                        <em>${count}</em>
                                    </header>
                                    <button type="button" class="history-quality-select-btn" onclick="app.selectHistoryQualityItems('${this.escapeJs(mapKey)}')" ${ids.length ? '' : 'disabled'}>
                                        <i class="fa-solid fa-check-square"></i> 該当履歴を選択
                                    </button>
                                    <div class="history-quality-list">
                                        ${count === 0 ? '<p>該当なし</p>' : ''}
                                        ${check.groups ? check.groups.slice(0, 10).map((group, idx) => `
                                            <div class="history-quality-duplicate">
                                                <strong>候補 ${idx + 1}: ${group.length}件</strong>
                                                ${group.map(item => this.renderHistoryQualityItem(item)).join('')}
                                            </div>
                                        `).join('') : check.items.slice(0, 12).map(item => this.renderHistoryQualityItem(item)).join('')}
                                        ${count > (check.groups ? 10 : 12) ? `<p>ほか ${count - (check.groups ? 10 : 12)}件</p>` : ''}
                                    </div>
                                </section>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            const footer = document.querySelector('.modal-footer');
            footer.innerHTML = `
                <button class="secondary-btn" id="modal-cancel">閉じる</button>
                <button class="secondary-btn" onclick="app.selectAllHistoryQualityItems()" ${totalIssues ? '' : 'disabled'}><i class="fa-solid fa-check-double"></i> 問題履歴をすべて選択</button>
                <button class="primary-btn" onclick="app.closeModal(); app.openHistoryBulkEditModal()"><i class="fa-solid fa-list-check"></i> 選択履歴を一括編集</button>
            `;
            document.getElementById('modal-cancel').onclick = () => this.closeModal();
        });
    }

    isTroubleHistoryForDetail(h) {
        return !h?.taskId || h?.isDokatei || h?.isNonProductionStop || h?.isSudden;
    }

    setHistoryMissingDetailFilter(kind, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        this.hideHistoryDetailPopover();
        this.historyMissingDetailFilter = this.historyMissingDetailFilter === kind ? null : kind;
        this.renderHistory();
        const label = kind === 'cause' ? '原因未入力' : '処置未入力';
        this.showToast?.(`${label}の履歴で絞り込みました`, 'info');
    }

    showHistoryDetailPopover(anchor, historyId, kind, event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!anchor) return;
        const popoverKey = `${historyId}:${kind}`;
        if (event?.type === 'mouseenter' && this.historyDetailPopover) {
            if (this.historyDetailPopoverKey === popoverKey) return;
            return;
        }
        if (this.historyDetailPopover && this.historyDetailPopoverKey === popoverKey) return;
        const label = kind === 'cause' ? '原因' : '処置';
        const fullText = anchor.dataset.detailFull || `${label}: ${anchor.textContent || ''}`;
        this.hideHistoryDetailPopover();
        const popover = document.createElement('div');
        popover.className = `history-detail-popover ${kind}`;
        popover.innerHTML = `
            <div class="history-detail-popover-head">
                <b>${this.escapeHtml(label)}</b>
                <button type="button" onclick="app.hideHistoryDetailPopover()" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="history-detail-popover-body">${this.escapeHtml(fullText.replace(new RegExp(`^${label}:\\s*`), ''))}</div>
            <div class="history-detail-popover-actions">
                <button type="button" class="primary-btn" onclick="app.hideHistoryDetailPopover(); app.openHistoryEditForm('${this.escapeJs(historyId)}', '${kind === 'cause' ? 'cause' : 'notes'}')">
                    <i class="fa-solid fa-pen-to-square"></i> 編集
                </button>
            </div>
        `;
        document.body.appendChild(popover);
        const rect = anchor.getBoundingClientRect();
        const width = Math.min(520, Math.max(320, window.innerWidth - 28));
        popover.style.width = `${width}px`;
        const popRect = popover.getBoundingClientRect();
        const left = Math.min(Math.max(14, rect.left), window.innerWidth - popRect.width - 14);
        const topCandidate = rect.top - popRect.height - 10;
        const top = topCandidate > 14 ? topCandidate : Math.min(rect.bottom + 10, window.innerHeight - popRect.height - 14);
        popover.style.left = `${left}px`;
        popover.style.top = `${Math.max(14, top)}px`;
        this.historyDetailPopover = popover;
        this.historyDetailPopoverKey = popoverKey;
        setTimeout(() => {
            const close = (e) => {
                if (!popover.contains(e.target) && e.target !== anchor) {
                    this.hideHistoryDetailPopover();
                    document.removeEventListener('mousedown', close);
                }
            };
            document.addEventListener('mousedown', close);
            this.historyDetailPopoverClose = close;
        }, 0);
    }

    hideHistoryDetailPopover() {
        if (this.historyDetailPopoverClose) {
            document.removeEventListener('mousedown', this.historyDetailPopoverClose);
            this.historyDetailPopoverClose = null;
        }
        if (this.historyDetailPopover) {
            this.historyDetailPopover.remove();
            this.historyDetailPopover = null;
        }
        this.historyDetailPopoverKey = null;
    }

    renderHistory(searchQuery = '') {
        const body = document.getElementById('history-list-body');
        if (!body) return;
        this.ensureHistorySelectionState();
        this.initializeHistorySortState();
        const density = this.historyDensityMode || localStorage.getItem('history_density_mode') || 'standard';
        this.historyDensityMode = density;
        document.querySelectorAll('#hist-density-mode [data-density-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.densityMode === density);
        });
        const table = body.closest('table');
        if (table) {
            table.classList.remove('history-density-standard', 'history-density-detail', 'history-density-compact');
            table.classList.add(`history-density-${density}`);
        }
        const densityLabel = document.getElementById('hist-density-current-label');
        if (densityLabel) {
            const densityLabels = { standard: '標準', detail: '詳細', compact: 'コンパクト' };
            densityLabel.textContent = `表示: ${densityLabels[density] || '標準'}`;
        }
        this.updateHistoryMetricSortButtons();

        // Active filters banner
        const activeFiltersArea = document.getElementById('hist-active-filters');
        if (activeFiltersArea) {
            const returnHtml = this.historyReturnContext ? `
                <div class="history-return-banner">
                    <span><i class="fa-solid fa-arrow-left"></i> ${this.escapeHtml(this.historyReturnContext.label || '作業時間集計から移動')}</span>
                    <button class="secondary-btn" style="padding:4px 12px; font-size:0.75rem;" onclick="app.returnToWorkTimeFromHistory()">作業時間集計へ戻る</button>
                </div>
            ` : '';
            if (this.modelFilter || this.workerFilter || this.machineCategoryFilter || this.historyMissingDetailFilter || this.historyRecurrenceFrequencyFilter || this.historyReturnContext) {
                const activeLabel = this.modelFilter
                    ? `型式: ${this.modelFilter}`
                    : (this.workerFilter
                        ? `作業員: ${this.workerFilter}`
                        : (this.machineCategoryFilter
                            ? `装置区分: ${this.machineCategoryFilter}`
                            : (this.historyRecurrenceFrequencyFilter
                                ? `再発グループ: ${this.historyRecurrenceFrequencyFilter.label || '同じグループ'}`
                                : (this.historyMissingDetailFilter === 'cause'
                                    ? '原因未入力'
                                    : (this.historyMissingDetailFilter === 'notes' ? '処置未入力' : '作業時間集計からの絞り込み')))));
                activeFiltersArea.innerHTML = `
                    ${returnHtml}
                    <div style="background:var(--secondary-light); color:var(--secondary); padding:8px 16px; border-radius:8px; margin-bottom:12px; font-size:0.8rem; display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="fa-solid fa-filter"></i> <b>${this.escapeHtml(activeLabel)}</b> で抽出中</span>
                        <button class="secondary-btn" style="padding:2px 10px; font-size:0.7rem;" onclick="app.clearModelFilter(); app.workerFilter=null; app.machineCategoryFilter=null; app.historyMissingDetailFilter=null; app.historyRecurrenceFrequencyFilter=null; app.historyReturnContext=null; app.renderHistory();">解除</button>
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
        const recurrenceFrequencyByHistoryId = this.getHistoryRecurrenceFrequencyMap();

        let filtered = store.activeData.history ? store.activeData.history.filter(h => !h.isManualGuide) : [];
        const filterSteps = [{ label: '全履歴', count: filtered.length }];
        filtered = this.filterHistoryByPeriod(filtered, period);
        filterSteps.push({ label: period === 'all' ? '期間: 全期間' : `期間: ${document.getElementById('hist-filter-period')?.selectedOptions?.[0]?.textContent || period}`, count: filtered.length });
        this.updateViewSubtitle('view-history', period);

        if (machineId) {
            filtered = filtered.filter(h => h.machineId === machineId);
            const machine = store.getMachines(true).find(m => String(m.id) === String(machineId));
            filterSteps.push({ label: `機械: ${machine?.name || machineId}`, count: filtered.length });
        }

        if (lineVal !== 'all') {
            filtered = filtered.filter(h => {
                const m = store.getMachines(true).find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                return String(l) === String(lineVal);
            });
            filterSteps.push({ label: `ライン: ${this.getLineLabel(lineVal)}`, count: filtered.length });
        }
        
        if (this.modelFilter) {
            const normFilter = MaintenanceApp.toHalfWidthLower(this.modelFilter);
            filtered = filtered.filter(h => {
                const machine = store.getMachines(true).find(m => m.id === h.machineId);
                const mModel = MaintenanceApp.toHalfWidthLower(machine?.model || '');
                return mModel === normFilter;
            });
            filterSteps.push({ label: `型式: ${this.modelFilter}`, count: filtered.length });
        }

        if (this.workerFilter) {
            filtered = filtered.filter(h => h.workers && h.workers.includes(this.workerFilter));
            filterSteps.push({ label: `作業者: ${this.workerFilter}`, count: filtered.length });
        }

        if (this.machineCategoryFilter) {
            const normCategory = MaintenanceStore.toHalfWidthLower(this.machineCategoryFilter);
            filtered = filtered.filter(h => {
                const machine = store.getMachines(true).find(m => m.id === h.machineId);
                const cat = h.machineCategory || machine?.category || 'その他';
                return MaintenanceStore.toHalfWidthLower(cat) === normCategory;
            });
            filterSteps.push({ label: `装置区分: ${this.machineCategoryFilter}`, count: filtered.length });
        }

        if (type === 'periodic') {
            filtered = filtered.filter(h => !!h.taskId);
            filterSteps.push({ label: '区分: 定期のみ', count: filtered.length });
        } else if (type === 'suddenBundle') {
            filtered = filtered.filter(h => this.isCalendarSuddenResponseHistory
                ? this.isCalendarSuddenResponseHistory(h)
                : (!h.taskId && !h.isManualGuide && (h.isSudden === true || h.isDokatei || h.isNonProductionStop)));
            filterSteps.push({ label: '区分: 突発+ドカ停+非生産停止', count: filtered.length });
        } else if (type === 'sudden') {
            filtered = filtered.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop);
            filterSteps.push({ label: '区分: 突発のみ', count: filtered.length });
        } else if (type === 'nonProductionStop') {
            filtered = filtered.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop);
            filterSteps.push({ label: '区分: 非生産停止のみ', count: filtered.length });
        } else if (type === 'dokatei') {
            filtered = filtered.filter(h => !!h.isDokatei);
            filterSteps.push({ label: '区分: ドカ停のみ', count: filtered.length });
        }

        if (partsOnly) {
            filtered = filtered.filter(h => (h.replacedParts || []).length > 0);
            filterSteps.push({ label: '部品有', count: filtered.length });
        }
        if (photosOnly) {
            filtered = filtered.filter(h => (h.photos || []).length > 0);
            filterSteps.push({ label: '写真有', count: filtered.length });
        }
        if (guideOnly) {
            filtered = filtered.filter(h => this.hasHistoryGuide(h));
            filterSteps.push({ label: '手順有', count: filtered.length });
        }

        if (this.historyMissingDetailFilter) {
            const kind = this.historyMissingDetailFilter;
            filtered = filtered.filter(h => this.isTroubleHistoryForDetail(h) && !String(kind === 'cause' ? h.cause || '' : h.notes || '').trim());
            filterSteps.push({ label: kind === 'cause' ? '原因未入力' : '処置未入力', count: filtered.length });
        }

        if (this.historyRecurrenceFrequencyFilter?.ids?.length) {
            const idSet = new Set(this.historyRecurrenceFrequencyFilter.ids.map(String));
            filtered = filtered.filter(h => idSet.has(String(h.id)));
            filterSteps.push({ label: `再発グループ: ${this.historyRecurrenceFrequencyFilter.label || '同じグループ'}`, count: filtered.length });
        }

        if (this.historyRecurrenceFrequencyFilter?.ids?.length && activeFiltersArea) {
            const idSet = new Set(this.historyRecurrenceFrequencyFilter.ids.map(String));
            const groupRows = (store.activeData.history || []).filter(h => idSet.has(String(h.id)) && !h.isManualGuide);
            const dates = groupRows.map(h => h.date).filter(Boolean).sort();
            const minutes = groupRows.reduce((sum, h) => sum + (parseFloat(h.workTime) || 0), 0);
            const costTotal = groupRows.reduce((sum, h) => sum + this.calculateHistoryCost(h).total, 0);
            const label = this.historyRecurrenceFrequencyFilter.label || '同じグループ';
            activeFiltersArea.innerHTML = `
                <div class="history-recurrence-filter-banner">
                    <div>
                        <span><i class="fa-solid fa-repeat"></i> 再発グループで絞り込み中</span>
                        <b>${this.escapeHtml(label)}</b>
                    </div>
                    <div class="history-recurrence-filter-stats">
                        <span>${groupRows.length}件</span>
                        <span>${this.escapeHtml(this.formatMinutesAsHours(minutes))}</span>
                        <span>${this.escapeHtml(this.formatCurrency(costTotal))}</span>
                        ${dates.length ? `<span>${this.escapeHtml(dates[0])} - ${this.escapeHtml(dates[dates.length - 1])}</span>` : ''}
                    </div>
                    <button class="secondary-btn" onclick="app.historyRecurrenceFrequencyFilter=null; app.renderHistory('')" type="button">解除</button>
                </div>
            `;
        }

        if (query) {
            const terms = MaintenanceStore.toHalfWidthLower(query).split(/\s+/).filter(t => t);
            filtered = filtered.filter(h => {
                const machine = store.getMachines(true).find(m => m.id === h.machineId);
                const taskName = this.getHistoryDisplayText(h);
                const searchableText = (h.date || '') + ' ' + taskName + ' ' + (h.notes || '') + ' ' + (h.cause || '') + ' ' + (machine?.name || '') + ' ' + (machine?.model || '') + ' ' + (h.machineCategory || '');
                const normTxt = MaintenanceStore.toHalfWidthLower(searchableText);
                return terms.every(t => normTxt.includes(t));
            });
            filterSteps.push({ label: `検索: ${query}`, count: filtered.length });
        }

        this.sortHistoryRows(filtered);
        for (const id of Array.from(this.selectedHistoryIds)) {
            if (!(store.activeData.history || []).some(h => String(h.id) === id && !h.isManualGuide)) {
                this.selectedHistoryIds.delete(id);
            }
        }

        this.renderHistoryFilterSummary(filtered, { period, machineId, lineVal, type, query, partsOnly, photosOnly, guideOnly, machineCategory: this.machineCategoryFilter, missingDetail: this.historyMissingDetailFilter, recurrenceFrequency: this.historyRecurrenceFrequencyFilter });
        const visibleCostTotal = filtered.reduce((sum, h) => sum + this.calculateHistoryCost(h).total, 0);
        const visibleCostTotalEl = document.getElementById('history-visible-cost-total');
        if (visibleCostTotalEl) {
            visibleCostTotalEl.textContent = this.formatCompactCurrency(visibleCostTotal);
            const fullCostLabel = `表示中 ${filtered.length}件 / 合計 ${this.formatCurrency(visibleCostTotal)}`;
            visibleCostTotalEl.title = fullCostLabel;
            visibleCostTotalEl.setAttribute('aria-label', fullCostLabel);
        }

        body.innerHTML = '';
        if (filtered.length === 0) {
            body.innerHTML = this.renderHistoryEmptyReason(filterSteps);
            this.updateHistoryBulkBar();
            return;
        }

        const historyDateCounts = filtered.reduce((map, item) => {
            const key = item.date || '';
            map[key] = (map[key] || 0) + 1;
            return map;
        }, {});
        const collapsedDates = this.collapsedHistoryDates || new Set();
        const seenDates = new Set();
        const displayRows = filtered.filter(item => {
            const key = item.date || '';
            const first = !seenDates.has(key);
            seenDates.add(key);
            return first || !collapsedDates.has(key);
        });
        this.visibleHistoryIds = displayRows.map(h => String(h.id));

        displayRows.forEach((h, index) => {
            const machine = store.getMachines(true).find(m => m.id === h.machineId);
            const tr = document.createElement('tr');
            const isSameDateAsPrevious = index > 0 && displayRows[index - 1]?.date === h.date;
            const isDateGroupStart = index === 0 || !isSameDateAsPrevious;
            if (index > 0 && !isSameDateAsPrevious) tr.classList.add('history-date-group-start');
            
            let rowBg = '#ffffff';
            const typeInfo = this.getHistoryTypeInfo(h);
            let badgeClass = h.taskId ? 'badge-periodic' : 'badge-sudden';
            let badgeText = typeInfo.label;
            let titleColor = typeInfo.color;
            
            if (h.isDokatei) {
                rowBg = '#fee2e2'; // Stronger Pink
                badgeClass = 'badge-dokatei';
                badgeText = 'ドカ停';
                titleColor = 'var(--danger)';
            } else if (h.taskId) {
                rowBg = '#eff6ff'; // Light Blue
            } else if (h.isNonProductionStop) {
                rowBg = '#fef3c7'; // Stronger Amber
                badgeClass = 'badge-sudden';
            } else {
                rowBg = '#dcfce7'; // Stronger Green
            }
            tr.style.backgroundColor = rowBg;

            let guideBtnClass = h.guide ? (h.isDokatei ? 'guide-dokatei' : (h.taskId ? 'guide-periodic' : 'guide-sudden')) : 'guide-none';
            
            const normMName = MaintenanceApp.toFullWidthUpper(machine ? machine.name : '不明');
            const normMModel = MaintenanceApp.toHalfWidthLower(machine ? machine.model : '');
            const isBlankModel = MaintenanceApp.isModelBlank(normMModel);
            const replacedParts = h.replacedParts || [];
            const partsTitle = replacedParts.length
                ? replacedParts.map(p => `${p.name || '部品名なし'}${p.model ? ` [${p.model}]` : ''} ${p.count ?? p.qty ?? 0}${this.formatHistoryPartUnit(p.unit)}`).join(' / ')
                : '';
            const cost = this.calculateHistoryCost(h);
            const matchLabels = this.getHistorySearchMatchLabels(h, machine, query);
            const isTroubleHistory = !h.taskId || h.isDokatei || h.isNonProductionStop || h.isSudden;
            const causeText = String(h.cause || '').trim();
            const notesText = String(h.notes || '').trim();
            const recurrenceFrequency = recurrenceFrequencyByHistoryId.get(String(h.id));
            const isDateCollapsed = collapsedDates.has(h.date || '');

            tr.innerHTML = `
                <td style="text-align:center;">
                    <input type="checkbox" class="history-row-select" ${this.selectedHistoryIds.has(String(h.id)) ? 'checked' : ''} onchange="app.toggleHistorySelection('${this.escapeJs(h.id)}', this.checked)" aria-label="履歴を選択">
                </td>
                <td style="font-weight:700">${this.renderHistoryDateCell(h.date, isSameDateAsPrevious, isDateGroupStart, historyDateCounts[h.date] || 1, isDateCollapsed)}</td>
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
                            <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; font-weight:700;" title="${normMName}">
                                <span class="history-machine-name-filter ${machine && document.getElementById('hist-filter-machine')?.value === String(machine.id) ? 'active' : ''}" onclick="app.toggleMachineFilter('${this.escapeJs(machine?.id || '')}', event)" title="この機械名で抽出">
                                    ${this.highlightText(normMName, query)}
                                    ${machine && document.getElementById('hist-filter-machine')?.value === String(machine.id) ? ' <i class="fa-solid fa-filter" style="font-size:0.6rem"></i>' : ''}
                                </span>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                                <span class="history-model-label ${isBlankModel ? 'blank' : ''}" onclick="app.toggleModelFilter('${normMModel}', event)" title="この型式で抽出">
                                    [${this.highlightText(normMModel, query)}]
                                    ${this.modelFilter === normMModel ? ' <i class="fa-solid fa-filter" style="font-size:0.6rem"></i>' : ''}
                                </span>
                                ${machine ? `
                                    <button type="button" class="history-machine-edit-btn" onclick="event.stopPropagation(); app.openMachineModal('${this.escapeJs(machine.id)}')" title="この機械の編集画面を開く" aria-label="機械編集">
                                        <i class="fa-solid fa-pen-to-square"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="history-content-cell" onclick="app.openHistoryEditForm('${this.escapeJs(h.id)}')" title="クリックして編集">
                    <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px;">
                        <div style="font-weight:900; color:${titleColor}; flex:1; display:flex; align-items:center; min-width:0; gap:6px;">
                            <span class="history-main-content" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${this.getHistoryDisplayText(h)}" onclick="event.stopPropagation(); app.openHistoryEditForm('${this.escapeJs(h.id)}', 'symptom')">${this.highlightText(this.getHistoryDisplayText(h), query)}</span>
                            ${h.isFirstTime !== false 
                                ? `<span class="badge-occurrence first" style="font-size:0.65rem; padding:2px 6px; background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; border-radius:4px; font-weight:800; flex-shrink:0;">初回</span>`
                                : `<span class="badge-occurrence recurrence" style="font-size:0.65rem; padding:2px 6px; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; border-radius:4px; font-weight:800; flex-shrink:0;">再発</span>`
                            }
                            ${this.renderHistoryRecurrenceFrequencyChip(recurrenceFrequency)}
                            ${this.renderHistoryPrioritySigns(h, recurrenceFrequency, cost)}
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
                    <div class="history-detail-lines">
                        ${causeText
                            ? `<div class="history-row-detail-text history-cause-detail has-value"><span class="history-row-detail-hit" data-detail-full="${this.escapeHtml(`原因: ${causeText}`)}" title="原因: ${this.escapeHtml(causeText)}" onmouseenter="app.showHistoryDetailPopover(this, '${this.escapeJs(h.id)}', 'cause', event)" onclick="app.showHistoryDetailPopover(this, '${this.escapeJs(h.id)}', 'cause', event)"><span class="history-row-detail-label">原因</span><span class="history-row-detail-value">${this.highlightText(causeText, query)}</span></span></div>`
                            : (isTroubleHistory ? `<div class="history-row-detail-text history-cause-detail is-missing"><span class="history-row-detail-hit" data-detail-full="原因未入力" title="クリックで原因未入力だけ表示" onclick="app.setHistoryMissingDetailFilter('cause', event)"><span class="history-row-detail-label">原因</span><span class="history-row-detail-value">未入力</span></span></div>` : '')
                        }
                        ${notesText
                            ? `<div class="history-row-detail-text history-action-detail has-value"><span class="history-row-detail-hit" data-detail-full="${this.escapeHtml(`処置: ${notesText}`)}" title="処置: ${this.escapeHtml(notesText)}" onmouseenter="app.showHistoryDetailPopover(this, '${this.escapeJs(h.id)}', 'notes', event)" onclick="app.showHistoryDetailPopover(this, '${this.escapeJs(h.id)}', 'notes', event)"><span class="history-row-detail-label">処置</span><span class="history-row-detail-value">${this.highlightText(notesText, query)}</span></span></div>`
                            : (isTroubleHistory ? `<div class="history-row-detail-text history-action-detail is-missing"><span class="history-row-detail-hit" data-detail-full="処置未入力" title="クリックで処置未入力だけ表示" onclick="app.setHistoryMissingDetailFilter('notes', event)"><span class="history-row-detail-label">処置</span><span class="history-row-detail-value">未入力</span></span></div>` : '')
                        }
                    </div>
                    ${matchLabels.length ? `
                        <div class="history-match-labels" title="検索語が一致した項目">
                            ${matchLabels.map(label => `<span>${this.escapeHtml(label)}</span>`).join('')}
                        </div>
                    ` : ''}
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
                <td>
                    <div class="history-metric-cell time">
                        ${this.renderHistoryWorkTimeCell(h)}
                    </div>
                </td>
                <td>
                    <div class="history-metric-cell cost" title="人件費: ${this.escapeHtml(this.formatCurrency(cost.labor))} / 部品代: ${this.escapeHtml(this.formatCurrency(cost.parts))}">
                        <b>${this.escapeHtml(this.formatCurrency(cost.total))}</b>
                        <small>人 ${this.escapeHtml(this.formatCurrency(cost.labor))}</small>
                        <small>部 ${this.escapeHtml(this.formatCurrency(cost.parts))}</small>
                    </div>
                </td>
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
                                <button class="secondary-btn history-guide-icon-btn ${guideBtnClass}" style="${isRef ? 'opacity:0.8; border-style:dashed;' : ''}" onclick="app.openGuideModal('${h.id}')" title="手順を開く" aria-label="手順を開く">
                                    <i class="fa-solid fa-file-invoice"></i>
                                </button>`;
                            } else {
                                return `
                                <button class="secondary-btn history-guide-icon-btn guide-none" onclick="app.openGuideModal('${h.id}')" title="手順を作成" aria-label="手順を作成">
                                    <i class="fa-solid fa-file-invoice"></i>
                                </button>`;
                            }
                        })()}
                        <button class="icon-btn" onclick="app.openHistoryEditForm('${h.id}')" style="width:100%; padding:4px; font-size:0.7rem; display:flex; justify-content:center; border:1px solid transparent; background:var(--background-alt); border-radius:4px;"><i class="fa-solid fa-pen-to-square"></i></button>
                    </div>
                </td>
            `;
            body.appendChild(tr);
        });
        this.updateHistoryBulkBar();
    }

    renderHistoryEmptyReason(filterSteps = []) {
        const firstZeroIndex = filterSteps.findIndex(step => step.count === 0);
        const firstZero = firstZeroIndex >= 0 ? filterSteps[firstZeroIndex] : null;
        const previous = firstZeroIndex > 0 ? filterSteps[firstZeroIndex - 1] : null;
        const remaining = filterSteps.filter(step => step.count > 0).slice(-3).reverse();
        const reason = firstZero
            ? `${firstZero.label} で一致する履歴が0件になりました`
            : '現在の条件に一致する履歴がありません';
        const hint = previous
            ? `${previous.label} までは ${previous.count}件 あります`
            : '登録済みのメンテナンス履歴がありません';
        return `
            <tr>
                <td colspan="10" class="history-empty-cell">
                    <div class="history-empty-reason">
                        <div class="history-empty-icon"><i class="fa-solid fa-magnifying-glass-chart"></i></div>
                        <div class="history-empty-body">
                            <h4>履歴が見つかりません</h4>
                            <p>${this.escapeHtml(reason)}</p>
                            <div class="history-empty-hint"><i class="fa-solid fa-circle-info"></i> ${this.escapeHtml(hint)}</div>
                            ${remaining.length ? `
                                <div class="history-empty-steps">
                                    ${remaining.map(step => `<span>${this.escapeHtml(step.label)} <b>${step.count}件</b></span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </td>
            </tr>
        `;
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
            suddenBundle: '突発+ドカ停+非生産停止',
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
        if (filters.machineCategory) chips.push(`装置区分: ${filters.machineCategory}`);
        if (filters.partsOnly) chips.push('部品有');
        if (filters.photosOnly) chips.push('写真有');
        if (filters.guideOnly) chips.push('手順有');
        if (filters.query) chips.push(`検索: ${filters.query}`);
        if (filters.missingDetail === 'cause') chips.push('原因未入力');
        if (filters.missingDetail === 'notes') chips.push('処置未入力');
        if (filters.recurrenceFrequency?.ids?.length) chips.push(`再発グループ: ${filters.recurrenceFrequency.label || '同じグループ'}`);
        chips.push(this.getHistorySortLabel());

        const totalMinutes = filtered.reduce((sum, h) => sum + (parseFloat(h.workTime) || 0), 0);
        const averageMinutes = filtered.length ? Math.round((totalMinutes / filtered.length) * 10) / 10 : 0;
        const troubleHistories = filtered.filter(h => this.isTroubleHistoryForDetail(h));
        const causeFilled = troubleHistories.filter(h => String(h.cause || '').trim()).length;
        const notesFilled = troubleHistories.filter(h => String(h.notes || '').trim()).length;
        const rate = (value) => troubleHistories.length ? Math.round((value / troubleHistories.length) * 100) : 100;
        const causeRate = rate(causeFilled);
        const notesRate = rate(notesFilled);
        area.innerHTML = `
            <div class="history-filter-summary">
                <div class="history-filter-chips">
                    ${chips.length ? chips.map(chip => `<span>${this.escapeHtml(chip)}</span>`).join('') : '<span>絞り込みなし</span>'}
                    <span class="history-row-color-legend sudden ${filters.type === 'sudden' ? 'active' : ''}" onclick="app.toggleTypeFilter('sudden', event)" title="突発で抽出"><i></i> 突発</span>
                    <span class="history-row-color-legend non-production ${filters.type === 'nonProductionStop' ? 'active' : ''}" onclick="app.toggleTypeFilter('nonProductionStop', event)" title="非生産停止で抽出"><i></i> 非生産停止</span>
                    <span class="history-row-color-legend dokatei ${filters.type === 'dokatei' ? 'active' : ''}" onclick="app.toggleTypeFilter('dokatei', event)" title="ドカ停で抽出"><i></i> ドカ停</span>
                    <span class="history-guide-legend has-guide"><i class="fa-solid fa-file-invoice"></i> 手順有</span>
                    <span class="history-guide-legend no-guide"><i class="fa-solid fa-file-invoice"></i> 手順無</span>
                    <span class="history-guide-legend ref-guide"><i class="fa-solid fa-file-invoice"></i> 関連手順</span>
                </div>
                <div class="history-quality-rate-strip">
                    <button type="button" class="history-quality-rate-card ${causeRate < 100 ? 'has-gap' : 'complete'}" onclick="app.setHistoryMissingDetailFilter('cause', event)" title="原因未入力だけ表示">
                        <span><i class="fa-solid fa-magnifying-glass-chart"></i> 原因入力率</span>
                        <b>${causeRate}%</b>
                        <small>${causeFilled}/${troubleHistories.length}件</small>
                    </button>
                    <button type="button" class="history-quality-rate-card ${notesRate < 100 ? 'has-gap' : 'complete'}" onclick="app.setHistoryMissingDetailFilter('notes', event)" title="処置未入力だけ表示">
                        <span><i class="fa-solid fa-screwdriver-wrench"></i> 処置入力率</span>
                        <b>${notesRate}%</b>
                        <small>${notesFilled}/${troubleHistories.length}件</small>
                    </button>
                </div>
                <div class="history-worktime-summary">
                    <b>${filtered.length}</b>件
                    <b>${this.escapeHtml(this.formatMinutesAsHours(totalMinutes))}</b>合計
                    <b>${this.escapeHtml(this.formatMinutesAsHours(averageMinutes))}</b>平均
                </div>
            </div>
        `;
    }

    getHistoryRecurrenceFrequencyMap() {
        const map = new Map();
        const groups = this.collectRecurrenceGroupSummaries?.() || [];
        groups.forEach(group => {
            if (!group || !Array.isArray(group.histories)) return;
            group.histories.forEach(history => {
                if (history?.id) map.set(String(history.id), group);
            });
        });
        const fallbackGroups = new Map();
        (store.activeData.history || []).forEach(history => {
            if (!history?.id || history.isManualGuide) return;
            if (!this.getHistoryDisplayText(history) || (!this.isTroubleHistoryForDetail(history) && !history.recurrenceGroup)) return;
            const key = this.getHistoryFrequencyGroupKey(history);
            if (!fallbackGroups.has(key)) fallbackGroups.set(key, []);
            fallbackGroups.get(key).push(history);
        });
        fallbackGroups.forEach(histories => {
            const sorted = histories.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            const firstDate = sorted[0]?.date || '';
            const latestDate = sorted[sorted.length - 1]?.date || '';
            const firstMs = firstDate ? new Date(firstDate).getTime() : NaN;
            const latestMs = latestDate ? new Date(latestDate).getTime() : NaN;
            const spanDays = Number.isFinite(firstMs) && Number.isFinite(latestMs) ? Math.max(0, Math.round((latestMs - firstMs) / 86400000)) : 0;
            const avgIntervalDays = histories.length >= 2 ? Math.max(1, Math.round(spanDays / (histories.length - 1))) : null;
            const recent90Count = histories.filter(h => {
                const ms = h.date ? new Date(h.date).getTime() : NaN;
                return Number.isFinite(ms) && (Date.now() - ms) <= 90 * 86400000;
            }).length;
            const monthlyRate = spanDays > 0 ? (histories.length / Math.max(1, spanDays / 30)) : histories.length;
            const summary = {
                count: histories.length,
                firstDate,
                latestDate,
                avgIntervalDays,
                recent90Count,
                monthlyRate,
                frequencyLabel: histories.length >= 2 ? `約${avgIntervalDays}日に1回` : '単発',
                histories
            };
            histories.forEach(history => {
                const current = map.get(String(history.id));
                if (!current || summary.count > current.count) map.set(String(history.id), summary);
            });
        });
        return map;
    }

    normalizeHistoryFrequencyText(value = '') {
        return MaintenanceStore.toHalfWidthLower(value)
            .replace(/dansen/g, '断線')
            .replace(/koukan/g, '交換')
            .replace(/ore/g, '折れ')
            .replace(/ijou/g, '異常')
            .replace(/ion/g, '異音')
            .replace(/sensor/g, 'センサー')
            .replace(/[［\[][^］\]]*[］\]]/g, '')
            .replace(/\s+/g, '');
    }

    getHistoryFrequencyGroupKey(history) {
        const title = this.normalizeHistoryFrequencyText(this.getHistoryDisplayText(history));
        const detail = this.normalizeHistoryFrequencyText(`${history.errorContent || ''}${history.cause || ''}${history.notes || ''}`);
        const combined = `${title}${detail}`;
        const failureWords = ['過負荷停止', '断線', '異音', '警告', '停止', '破損', '漏れ', '詰まり', '折れ', '交換'];
        const failure = failureWords.find(word => combined.includes(word)) || '';
        let core = title || combined;
        failureWords.forEach(word => { core = core.replaceAll(word, ''); });
        core = core
            .replace(/駆動部|従動部|本体|部品|同部|原因|処置/g, '')
            .replace(/[0-9０-９]+号?ライン/g, '')
            .replace(/[^\wぁ-んァ-ン一-龥ー#]/g, '')
            .slice(0, 32);
        return `${history.machineId || ''}::${core || title || combined.slice(0, 32) || 'unknown'}::${failure || 'trouble'}`;
    }

    renderHistoryRecurrenceFrequencyChip(group) {
        if (!group) return '';
        const ids = (group.histories || []).map(history => String(history.id || '')).filter(Boolean);
        const payload = encodeURIComponent(JSON.stringify(ids));
        const label = group.count >= 2 ? `${group.frequencyLabel} (${group.count}件)` : '単発';
        const detail = [
            `発生頻度: ${group.frequencyLabel}`,
            `${group.count}件`,
            group.firstDate && group.latestDate ? `${group.firstDate} - ${group.latestDate}` : '',
            `直近90日 ${group.recent90Count || 0}件`,
            Number.isFinite(group.monthlyRate) ? `月換算 ${group.monthlyRate.toFixed(1)}件` : ''
        ].filter(Boolean).join(' / ');
        return `
            <span class="history-recurrence-frequency-chip ${group.count < 2 ? 'is-single' : ''}" title="${this.escapeHtml(detail)} / クリックで同じグループを表示" onclick="app.setHistoryRecurrenceFrequencyFilter('${this.escapeJs(payload)}', '${this.escapeJs(label)}', event)">
                <i class="fa-solid fa-chart-line"></i>
                <span>${this.escapeHtml(group.frequencyLabel)}</span>
            </span>
        `;
    }

    formatMinutesAsHours(minutes) {
        const value = parseFloat(minutes) || 0;
        if (value < 60) return `${Math.round(value * 10) / 10}分`;
        const hours = Math.floor(value / 60);
        const mins = Math.round(value % 60);
        return mins ? `${hours}時間${mins}分` : `${hours}時間`;
    }

    formatCompactCurrency(value) {
        const amount = Math.round(parseFloat(value) || 0);
        if (Math.abs(amount) >= 10000) {
            const compact = Math.round((amount / 10000) * 10) / 10;
            return `¥${compact.toLocaleString()}万`;
        }
        return this.formatCurrency(amount);
    }

    getHistoryLaborRate() {
        const inputRate = parseFloat(document.getElementById('analysis-labor-rate')?.value);
        if (!Number.isNaN(inputRate) && inputRate > 0) return inputRate;
        const savedRate = parseFloat(this.laborRate);
        if (!Number.isNaN(savedRate) && savedRate > 0) return savedRate;
        return 3500;
    }

    calculateHistoryPartCost(history) {
        return (history?.replacedParts || []).reduce((sum, part) => {
            const count = parseFloat(part.count ?? part.qty ?? 0) || 0;
            const directPrice = parseFloat(part.price);
            const master = store.getPartMaster?.(part.name || '', part.model || '');
            const masterPrice = parseFloat(master?.price);
            const unitPrice = !Number.isNaN(directPrice) && directPrice > 0
                ? directPrice
                : (!Number.isNaN(masterPrice) && masterPrice > 0 ? masterPrice : 0);
            return sum + (count * unitPrice);
        }, 0);
    }

    calculateHistoryCost(history) {
        const workMinutes = parseFloat(history?.workTime) || 0;
        const workers = Array.isArray(history?.workers)
            ? history.workers.filter(Boolean)
            : (typeof history?.workers === 'string' ? history.workers.split(',').map(w => w.trim()).filter(Boolean) : []);
        const workerCount = Math.max(workers.length, 1);
        const labor = (workMinutes / 60) * this.getHistoryLaborRate() * workerCount;
        const parts = this.calculateHistoryPartCost(history);
        return {
            labor,
            parts,
            total: labor + parts
        };
    }

    formatCurrency(value) {
        const amount = Math.round(parseFloat(value) || 0);
        return `¥${amount.toLocaleString()}`;
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
                        const name = p.name || '';
                        const model = p.model || '';
                        return `
                            <button type="button" class="history-parts-detail-item history-parts-detail-link" onclick="app.closeModal(); app.openPartMasterModal('${this.escapeJs(name)}', '${this.escapeJs(model)}')" title="部品マスターを編集">
                                <div class="history-parts-detail-icon"><i class="fa-solid fa-box"></i></div>
                                <div>
                                    <b>${this.escapeHtml(p.name || '部品名なし')}</b>
                                    <span>${this.escapeHtml(p.model || '型式なし')}</span>
                                </div>
                                <strong>${this.escapeHtml(String(count))}${this.escapeHtml(unit)}</strong>
                                ${price ? `<em>¥${Math.round(price).toLocaleString()}</em>` : '<em>-</em>'}
                                <i class="fa-solid fa-pen-to-square history-parts-edit-cue"></i>
                            </button>
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

    toggleLineFilter(lineNo, event) {
        if (!lineNo) return;
        if (event) event.stopPropagation();

        const filter = document.getElementById('hist-filter-line');
        if (!filter) return;

        const target = String(lineNo);
        const hasOption = Array.from(filter.options || []).some(option => option.value === target);
        if (!hasOption) {
            const opt = document.createElement('option');
            opt.value = target;
            opt.textContent = this.getLineLabel(target);
            filter.appendChild(opt);
        }

        filter.value = filter.value === target ? 'all' : target;
        this.historyRecurrenceFrequencyFilter = null;
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
        this.historyRecurrenceFrequencyFilter = null;
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

    setHistoryRecurrenceFrequencyFilter(encodedIds = '', label = '同じグループ', event) {
        if (event) event.stopPropagation();
        let ids = [];
        try {
            ids = JSON.parse(decodeURIComponent(encodedIds));
        } catch (error) {
            ids = [];
        }
        ids = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
        if (!ids.length) return;

        const globalSearch = document.getElementById('global-search');
        const machineFilter = document.getElementById('hist-filter-machine');
        const lineFilter = document.getElementById('hist-filter-line');
        const typeFilter = document.getElementById('hist-filter-type');
        const periodFilter = document.getElementById('hist-filter-period');
        const partsFilter = document.getElementById('hist-filter-parts');
        const photosFilter = document.getElementById('hist-filter-photos');
        const guideFilter = document.getElementById('hist-filter-guide');

        if (globalSearch) globalSearch.value = '';
        if (machineFilter) machineFilter.value = '';
        if (lineFilter) lineFilter.value = 'all';
        if (typeFilter) typeFilter.value = '';
        if (periodFilter) periodFilter.value = 'all';
        if (partsFilter) partsFilter.checked = false;
        if (photosFilter) photosFilter.checked = false;
        if (guideFilter) guideFilter.checked = false;

        this.modelFilter = null;
        this.workerFilter = null;
        this.machineCategoryFilter = null;
        this.historyMissingDetailFilter = null;
        this.historyReturnContext = null;
        this.historyRecurrenceFrequencyFilter = { ids, label };
        this.renderHistory('');
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
        this.machineCategoryFilter = null;
        this.historyMissingDetailFilter = null;
        this.historyRecurrenceFrequencyFilter = null;
        this.historyReturnContext = null;
        this.renderHistory('');
    }

    openHistoryStatFilter(type = 'suddenBundle') {
        const year = this.currentDate?.getFullYear?.() || new Date().getFullYear();
        const monthIndex = this.currentDate?.getMonth?.() ?? new Date().getMonth();
        const start = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
        const endDate = new Date(year, monthIndex + 1, 0).getDate();
        const end = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;

        localStorage.setItem('customRangeStart', start);
        localStorage.setItem('customRangeEnd', end);
        this.updateHistoryPeriodOptions();

        const globalSearch = document.getElementById('global-search');
        const periodFilter = document.getElementById('hist-filter-period');
        const machineFilter = document.getElementById('hist-filter-machine');
        const lineFilter = document.getElementById('hist-filter-line');
        const typeFilter = document.getElementById('hist-filter-type');
        const partsFilter = document.getElementById('hist-filter-parts');
        const photosFilter = document.getElementById('hist-filter-photos');
        const guideFilter = document.getElementById('hist-filter-guide');

        if (globalSearch) globalSearch.value = '';
        if (periodFilter) periodFilter.value = 'custom_range';
        if (machineFilter) machineFilter.value = '';
        if (lineFilter) lineFilter.value = 'all';
        if (typeFilter) typeFilter.value = type === 'dokatei' ? 'dokatei' : 'suddenBundle';
        if (partsFilter) partsFilter.checked = false;
        if (photosFilter) photosFilter.checked = false;
        if (guideFilter) guideFilter.checked = false;
        this.modelFilter = null;
        this.workerFilter = null;
        this.machineCategoryFilter = null;
        this.historyMissingDetailFilter = null;

        this.switchView('history');
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

    getHistorySearchMatchLabels(h, machine, query) {
        const terms = MaintenanceStore.toHalfWidthLower(query || '').split(/\s+/).filter(Boolean);
        if (!terms.length) return [];
        const fields = [
            ['日付', h.date],
            ['機械名', machine?.name],
            ['型式', machine?.model],
            ['区分', h.machineCategory || machine?.category],
            ['内容', this.getHistoryDisplayText(h)],
            ['原因', h.cause],
            ['処置', h.notes],
            ['作業者', (h.workers || []).join(' ')],
            ['部品', (h.replacedParts || []).map(p => `${p.name || ''} ${p.model || ''}`).join(' ')]
        ];
        return fields
            .filter(([, value]) => {
                const text = MaintenanceStore.toHalfWidthLower(String(value || ''));
                return text && terms.some(term => text.includes(term));
            })
            .map(([label]) => label);
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
        if (period === 'last_this_month') {
            const curMonthStr = todayStr.substring(0, 7);
            const lastMonthVal = new Date(todayVal.getFullYear(), todayVal.getMonth() - 1, 1);
            const lastMonthStr = formatDate(lastMonthVal).substring(0, 7);
            return history.filter(h => h.date && (h.date.startsWith(curMonthStr) || h.date.startsWith(lastMonthStr)));
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
                <option value="last_this_month">先月と今月</option>
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
            // デフォルトは「先月と今月」に設定（ツール更新直後の today 初期値も補正）
            if (!currentVal || currentVal === 'today') {
                filter.value = 'last_this_month';
            } else {
                filter.value = currentVal;
            }
        });
    }

    normalizePeriodDateInput(input) {
        const raw = String(input || '').trim();
        if (!raw) return '';
        const normalized = raw
            .replace(/[年月]/g, '/')
            .replace(/日/g, '')
            .replace(/[.]/g, '/')
            .replace(/-/g, '/')
            .replace(/\s+/g, '');
        let year;
        let month;
        let day;
        let match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
        if (match) {
            year = Number(match[1]);
            month = Number(match[2]);
            day = Number(match[3]);
        } else {
            match = normalized.match(/^(\d{1,2})\/(\d{1,2})$/);
            if (!match) return '';
            year = new Date().getFullYear();
            month = Number(match[1]);
            day = Number(match[2]);
        }
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    onPeriodChange(el, renderFn) {
        if (el.value === 'custom') {
            const current = localStorage.getItem('customStartDate') || new Date().toISOString().split('T')[0];
            const input = prompt('指定日以降のデータを集計します。開始日を入力してください (YYYY-MM-DD / M/D):', current);
            const date = this.normalizePeriodDateInput(input);
            if (date) {
                localStorage.setItem('customStartDate', date);
                this.updateHistoryPeriodOptions();
                el.value = 'custom';
            } else if (!localStorage.getItem('customStartDate')) {
                el.value = 'this_month';
            }
        } else if (el.value === 'custom_range') {
            const curS = localStorage.getItem('customRangeStart') || new Date().toISOString().split('T')[0];
            const curE = localStorage.getItem('customRangeEnd') || new Date().toISOString().split('T')[0];
            const start = this.normalizePeriodDateInput(prompt('開始日を入力してください (YYYY-MM-DD / M/D):', curS));
            if (start) {
                const end = this.normalizePeriodDateInput(prompt('終了日を入力してください (YYYY-MM-DD / M/D):', curE));
                if (end) {
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
        if (period === 'last_this_month') {
            const lastM = new Date(now.getFullYear(), now.getMonth(), 0);
            return lastM.getDate() + now.getDate();
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
            'last_this_month': '先月と今月',
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
