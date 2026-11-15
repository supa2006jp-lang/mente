(function () {
    'use strict';
    const P = MaintenanceApp.prototype;
    const text = value => MaintenanceStore.toHalfWidthLower(String(value ?? '')).trim();
    const node = (tag, value, parent) => { const el = document.createElement(tag); if (value != null) el.textContent = value; parent?.append(el); return el; };

    P.normalizeHistoryImportDate = function (value) {
        const raw = String(value ?? '').normalize('NFKC').trim();
        const match = raw.match(/^(\d{4})(?:[-/.]|年)(\d{1,2})(?:[-/.]|月)(\d{1,2})日?$/);
        if (!match) return '';
        const [year, month, day] = match.slice(1).map(Number);
        if (year < 1000 || year > 9999) return '';
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };
    P.getHistoryImportMachineCandidates = function (name, model, lineNo, machines) {
        const matches = machines.filter(m => !m.deleted && text(m.name) === text(name) && (!model || text(m.model) === text(model)));
        if (!lineNo) return matches;
        const exact = matches.filter(m => String(m.lineNo || '') === lineNo);
        return exact.length ? exact : matches.filter(m => !m.lineNo);
    };
    P.setHistoryImportTarget = function (entry, id) {
        const machine = [...entry.candidates, entry.provisional].find(m => String(m.id) === String(id));
        entry.record.machineId = machine?.id || '';
        entry.record.lineNo = entry.lineNo || machine?.lineNo || '';
        entry.record.machineCategory = machine?.category || '';
    };
    P.applyHistoryImportTargetToMatching = function (plan, entry) {
        if (!entry.record.machineId) return 0;
        const key = e => JSON.stringify([text(e.machineName), text(e.provisional.model), String(e.lineNo || '')]);
        let count = 0;
        for (const other of plan.entries) {
            if (other === entry || key(other) !== key(entry)) continue;
            if (![...other.candidates, other.provisional].some(m => m.id === entry.record.machineId)) continue;
            const decision = other.decision;
            this.setHistoryImportTarget(other, entry.record.machineId);
            other.decision = decision; count++;
        }
        return count;
    };
    P.getHistoryImportKey = function (record) {
        return JSON.stringify([this.normalizeHistoryImportDate(record.date) || text(record.date), String(record.machineId || ''),
            text(record.taskContent || record.errorContent || record.notes), record.workTime == null || String(record.workTime).trim() === '' ? 'missing' : String(Number(record.workTime))]);
    };
    P.getHistoryImportDetails = function (record) {
        const parts = (record.replacedParts || []).map(p => `${p.name || ''} [${p.model || ''}] ${p.count ?? p.qty ?? 0}${p.unit || '個'} @${p.price == null || String(p.price).trim() === '' ? '未入力' : p.price}`).sort();
        return {
            '作業内容': record.taskContent || record.errorContent || record.notes || '',
            '作業時間': record.workTime == null || String(record.workTime).trim() === '' ? '未入力' : `${record.workTime}分`,
            '作業者': this.splitWorkerText(record.workers).sort().join('、'),
            '部品': parts.join(' / '), '原因': record.cause || '', '処置': record.notes || '', 'エラー': record.errorNo || '',
            '作業区分': record.category || '', 'ライン': String(record.lineNo || ''), '装置区分': record.machineCategory || '',
            '対応種別': this.getHistoryTypeInfo(record).label,
            '初回・再発': record.isFirstTime === false ? '再発' : '初回', '予定': record.taskId || '',
            '写真': String((record.photos || []).length), '手順書': record.guide || ''
        };
    };
    P.assessHistoryImportPlan = function (plan) {
        const buckets = new Map();
        const add = (record, label) => {
            const key = this.getHistoryImportKey(record);
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push({ record, label });
        };
        for (const record of store.activeData.history || []) add(record, '既存履歴');
        for (const entry of plan.entries) {
            entry.duplicates = entry.record.machineId ? [...(buckets.get(this.getHistoryImportKey(entry.record)) || [])] : [];
            entry.selected = entry.decision === null ? entry.duplicates.length === 0 : entry.decision;
            if (entry.selected && entry.record.machineId) add(entry.record, `${entry.sourceRow}行目`);
        }
        return plan.entries;
    };
    P.getHistoryImportSnapshot = function () {
        return JSON.stringify([store.activeData.machines, store.activeData.history, store.activeData.partsMaster]);
    };
    P.commitHistoryImportPlan = async function (plan) {
        if (plan.saving) return false;
        plan.error = '';
        if (plan.department !== store.data?.currentDepartmentId || plan.snapshot !== this.getHistoryImportSnapshot()) {
            plan.error = '確認中にデータが変わりました。ファイルを読み込み直して再確認してください。';
            this.showToast?.(plan.error, 'warning'); return false;
        }
        this.assessHistoryImportPlan(plan);
        const chosen = plan.entries.filter(e => e.selected);
        if (!chosen.length || chosen.some(e => !e.record.machineId)) return false;
        const records = chosen.map(e => e.record), ids = new Set(records.map(r => r.machineId));
        const machinesToAdd = plan.newMachines.filter(m => ids.has(m.id));
        const lineAssignments = new Map();
        for (const e of chosen) {
            const machine = e.candidates.find(m => m.id === e.record.machineId);
            if (machine && !machine.lineNo && e.lineNo) {
                if (lineAssignments.has(machine.id) && lineAssignments.get(machine.id) !== e.lineNo) {
                    plan.error = '同じ機械に異なるラインが指定されています。取り込み先を見直してください。';
                    this.showToast?.(plan.error, 'warning'); return false;
                }
                lineAssignments.set(machine.id, e.lineNo);
            }
        }
        plan.saving = true;
        try {
            const parts = records.flatMap(r => r.replacedParts || []);
            await store.runAtomicSaveBatch(() => {
                if (plan.department !== store.data?.currentDepartmentId || plan.snapshot !== this.getHistoryImportSnapshot()) throw Error('確認中にデータが変わりました。読み込み直してください。');
                const before = JSON.parse(JSON.stringify(store.activeData));
                const batchId = store.generateId();
                records.forEach(record => { record.importBatchId = batchId; record.stockTracking = 'ledger'; });
                store.activeData.machines.push(...machinesToAdd);
                for (const [id, line] of lineAssignments) {
                    const machine = store.activeData.machines.find(m => m.id === id);
                    if (machine && !machine.lineNo) machine.lineNo = line;
                }
                store.activeData.history.push(...records);
                const master = this.upsertImportedPartMasters(parts);
                this.appendHistoryImportLog({ id: batchId, undo: this.captureHistoryImportUndo(before, records), fileName: plan.fileName, totalRows: plan.totalRows, added: records.length,
                    duplicates: plan.entries.filter(e => !e.selected && e.duplicates.length).length,
                    skipped: plan.skipped + plan.entries.filter(e => !e.selected && !e.duplicates.length).length,
                    addedMachines: machinesToAdd.length, addedPartMasters: master.added, updatedPartMasters: master.updated,
                    firstTime: records.filter(r => r.isFirstTime !== false).length, recurrence: records.filter(r => r.isFirstTime === false).length });
            });
            plan.dialog?.close(); this.closeModal();
            this.showToast?.(`${records.length}件の履歴をインポートしました。`, 'success');
            this.updateDataLists(); this.updateHistoryPeriodOptions();
            requestAnimationFrame(() => { this.switchView('history'); this.renderHistory(); this.renderCalendar(); });
            return true;
        } catch (error) {
            console.error('History import failed', error);
            plan.error = '保存できませんでした。選択内容は残っています。';
            alert(`取り込みに失敗しました。変更は保存されていません。\n${error.message || error}`); return false;
        } finally { plan.saving = false; }
    };
    P.openHistoryImportReview = function (plan) {
        const dialog = node('dialog', null, document.body); dialog.className = 'history-import-review'; plan.dialog = dialog;
        node('h3', '取り込み先と重複候補を確認', dialog);
        node('p', '取り込む行を選んでください。重複候補は最初は除外しています。選ぶと別の記録として追加され、既存の履歴は保持されます。', dialog);
        const summary = node('p', null, dialog); summary.setAttribute('role', 'status');
        const error = node('p', null, dialog); error.setAttribute('role', 'alert'); error.className = 'history-import-review-error';
        const filterLabel = node('label', '表示する行', dialog); filterLabel.className = 'history-import-review-filter';
        const filter = node('select', null, filterLabel); filter.setAttribute('aria-label', '確認する行の絞り込み');
        for (const [value, title] of [['all','すべて'],['unresolved','取り込み先未選択'],['duplicates','重複候補'],['selected','取込対象']]) filter.add(new Option(title, value));
        const notice = node('p', '', dialog); notice.setAttribute('role', 'status'); notice.className = 'history-import-bulk-status';
        const list = node('div', null, dialog); list.className = 'history-import-review-list';
        const footer = node('div', null, dialog); footer.className = 'history-import-review-actions';
        const button = (label, action) => { const b = node('button', label, footer); b.type = 'button'; b.className = 'secondary-btn'; b.onclick = action; return b; };
        let page = 0;
        const expanded = new Map();
        filter.onchange = () => { page = 0; render(); list.scrollTop = 0; };
        const previous = button('前へ', () => { page--; render(); list.scrollTop = 0; });
        const next = button('次へ', () => { page++; render(); list.scrollTop = 0; });
        button('キャンセル', () => { if (!plan.saving) dialog.close(); });
        const save = button('選択した行を取り込む', async () => {
            if (plan.saving) return;
            const controls = [...dialog.querySelectorAll('button,input,select')]; controls.forEach(c => c.disabled = true);
            const success = await this.commitHistoryImportPlan(plan);
            if (!success && dialog.isConnected) { controls.forEach(c => c.disabled = false); render(); }
        }); save.className = 'primary-btn'; save.id = 'history-import-review-save';
        const render = () => {
            const scrollTop = list.scrollTop;
            const focused = list.contains(document.activeElement) ? document.activeElement : null;
            const focusRow = focused?.closest('[data-import-row]')?.dataset.importRow, focusKind = focused?.dataset.importControl;
            for (const detail of list.querySelectorAll('details')) expanded.set(detail.closest('[data-import-row]').dataset.importRow, detail.open);
            this.assessHistoryImportPlan(plan);
            error.textContent = plan.error || ''; error.hidden = !plan.error;
            const selected = plan.entries.filter(e => e.selected), unresolved = selected.filter(e => !e.record.machineId);
            const visible = plan.entries.filter(e => filter.value === 'unresolved' ? !e.record.machineId : filter.value === 'duplicates' ? e.duplicates.length : filter.value === 'selected' ? e.selected : true);
            const pages = Math.max(1, Math.ceil(visible.length / 50));
            page = Math.min(page, pages - 1);
            summary.textContent = `取込 ${selected.length} / ${plan.entries.length} 件・取り込み先未選択 ${unresolved.length} 件・表示 ${visible.length} 件（${page + 1}/${pages}ページ）`;
            previous.disabled = page === 0; next.disabled = page >= pages - 1; save.disabled = !selected.length || !!unresolved.length;
            list.replaceChildren();
            for (const [index, entry] of visible.entries()) {
                if (index < page * 50 || index >= (page + 1) * 50) continue;
                const row = node('section', null, list); row.dataset.importRow = String(entry.sourceRow);
                const label = node('label', null, row); const check = node('input', null, label); check.type = 'checkbox'; check.checked = entry.selected;
                check.dataset.importControl = 'include';
                node('strong', `${entry.sourceRow}行目を取り込む：${entry.record.date} / ${entry.machineName} / ${entry.record.workTime == null ? '時間未入力' : entry.record.workTime + '分'}`, label);
                check.onchange = () => { entry.decision = check.checked; render(); };
                node('p', entry.record.taskContent || entry.record.errorContent || '', row);
                const targetLabel = node('label', '取り込み先', row); const select = node('select', null, targetLabel); select.setAttribute('aria-label', `${entry.sourceRow}行目の取り込み先`);
                select.dataset.importControl = 'target';
                select.add(new Option('機械を選択してください', ''));
                for (const [i, machine] of entry.candidates.entries()) select.add(new Option(`${entry.candidates.length > 1 ? `候補${i + 1}：` : ''}${machine.name} [${machine.model || '型式未登録'}] / ${machine.lineNo ? machine.lineNo + 'ライン' : 'ライン未設定'}${machine.category ? ' / ' + machine.category : ''}${machine.remarks ? ' / ' + machine.remarks.slice(0, 40) : ''}`, machine.id));
                select.add(new Option(`新規登録：${entry.provisional.name} [${entry.provisional.model || '型式未登録'}] / ${entry.lineNo || 'ライン未設定'}`, entry.provisional.id));
                select.value = entry.record.machineId;
                select.onchange = () => { this.setHistoryImportTarget(entry, select.value); render(); };
                const bulk = node('button', '同じ機械名・型式・ラインの行にも適用', row); bulk.type = 'button'; bulk.className = 'secondary-btn history-import-bulk-target'; bulk.dataset.importControl = 'bulk'; bulk.disabled = !entry.record.machineId;
                bulk.onclick = () => { const count = this.applyHistoryImportTargetToMatching(plan, entry); notice.textContent = `同じ入力の${count}行に取り込み先を適用しました。重複候補も再判定しました。`; render(); };
                if (entry.duplicates.length) {
                    const details = node('details', null, row); details.open = expanded.get(String(entry.sourceRow)) ?? true;
                    node('summary', `重複候補 ${entry.duplicates.length} 件の差分`, details);
                    const incoming = this.getHistoryImportDetails(entry.record);
                    for (const duplicate of entry.duplicates) {
                        const before = this.getHistoryImportDetails(duplicate.record);
                        const differences = Object.keys(incoming).filter(key => incoming[key] !== before[key]);
                        node('b', `${duplicate.label}との比較`, details);
                        if (!differences.length) node('p', '比較した項目は一致しています。', details);
                        for (const key of differences) node('p', `${key}：${before[key] || '未入力'} → ${incoming[key] || '未入力'}`, details);
                    }
                }
            }
            if (!visible.length) node('p', '該当する行はありません。', list);
            if (focusRow && focusKind) {
                const row = [...list.querySelectorAll('[data-import-row]')].find(r => r.dataset.importRow === focusRow);
                const control = [...(row?.querySelectorAll('[data-import-control]') || [])].find(c => c.dataset.importControl === focusKind);
                (control || filter).focus({ preventScroll: true });
            }
            list.scrollTop = scrollTop;
        };
        dialog.addEventListener('cancel', event => { if (plan.saving) event.preventDefault(); });
        dialog.addEventListener('close', () => dialog.remove(), { once: true });
        render(); dialog.showModal();
    };
})();
