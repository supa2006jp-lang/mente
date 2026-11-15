(function () {
    'use strict';
    const P = MaintenanceApp.prototype;
    const clone = value => JSON.parse(JSON.stringify(value));
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const partKey = part => JSON.stringify([part.name || '', part.model || '']);
    const node = (tag, value, parent) => { const el = document.createElement(tag); if (value != null) el.textContent = value; parent?.append(el); return el; };

    P.getImportReferenceSignature = function (data, kind, item) {
        const matches = record => record != null && (kind === 'machines' ? String(typeof record === 'string' ? record : record.machineId) === String(item.id)
            : [...(Array.isArray(record.replacedParts) ? record.replacedParts : []), ...(Array.isArray(record.parts) ? record.parts : [])].some(p => partKey(p) === partKey(item)));
        const collections = Object.keys(data).filter(key => Array.isArray(data[key]) && !['machines', 'partsMaster', 'historyImportLogs', 'partStockMovements'].includes(key));
        const refs = collections.flatMap(key => data[key].filter(matches).map(r => [key, r]));
        if (kind === 'partsMaster') refs.push(...(data.partStockMovements || []).filter(m => partKey({ name: m.partName, model: m.partModel }) === partKey(item)).map(m => ['stock', m]));
        return JSON.stringify(refs.sort((a, b) => String(a[1].id).localeCompare(String(b[1].id))));
    };
    P.captureHistoryImportUndo = function (before, records) {
        const changes = {};
        for (const kind of ['machines', 'partsMaster']) {
            const key = kind === 'machines' ? item => item.id : partKey;
            const previous = new Map((before[kind] || []).map(item => [key(item), item]));
            changes[kind] = (store.activeData[kind] || []).flatMap(after => {
                const prior = previous.get(key(after)) || null;
                return same(prior, after) ? [] : [{ before: prior, after, references: this.getImportReferenceSignature(before, kind, after) }];
            });
        }
        return clone({ version: 1, records, ...changes });
    };
    P.getHistoryImportUndoEntries = function (log) {
        const current = new Map((store.activeData.history || []).map(record => [record.id, record]));
        return (log?.undo?.records || []).flatMap(before => {
            const record = current.get(before.id);
            return record ? [{ before, record, changed: !same(before, record) }] : [];
        });
    };
    P.createHistoryImportUndoPlan = function (id) {
        const log = this.getHistoryImportLogs().find(item => item.id === id);
        if (log?.undo?.version !== 1) throw Error('この取り込みには取消用の記録がありません。');
        return { id, log: clone(log), entries: clone(this.getHistoryImportUndoEntries(log)), department: store.data.currentDepartmentId,
            snapshot: JSON.stringify(store.activeData), selected: new Set(this.getHistoryImportUndoEntries(log).filter(e => !e.changed).map(e => e.record.id)) };
    };
    P.commitHistoryImportUndo = async function (plan) {
        if (plan.saving || !plan.selected.size) return false;
        const validate = () => {
            if (plan.department !== store.data.currentDepartmentId || plan.snapshot !== JSON.stringify(store.activeData)) throw Error('確認中にデータが変わりました。取消画面を開き直して再確認してください。');
        };
        plan.saving = true; plan.error = '';
        try {
            validate();
            const ids = new Set(plan.entries.filter(e => plan.selected.has(e.record.id)).map(e => e.record.id));
            if (!ids.size) return false;
            const restored = { machines: 0, partsMaster: 0 };
            await store.runAtomicSaveBatch(() => {
                validate(); // Recheck after any earlier queued save has finished.
                const data = store.activeData;
                // Import itself does not move stock. Reverse only subsequent edits tied to these records.
                const movements = (data.partStockMovements || []).filter(m => m.source === 'maintenance-edit' && ids.has(m.sourceId));
                for (const movement of movements) {
                    if (!store.adjustStock(movement.partName, movement.partModel, -Number(movement.delta), {
                        unit: movement.unit, source: 'import-undo', sourceId: plan.id, reason: '取込取消（取込後の履歴編集による在庫変更を戻す）'
                    })) throw Error(`部品「${movement.partName}」の在庫を確認できません。`);
                }
                data.history = data.history.filter(record => !ids.has(record.id));
                for (const kind of ['machines', 'partsMaster']) {
                    const key = kind === 'machines' ? item => item.id : partKey;
                    for (const change of plan.log.undo[kind] || []) {
                        const index = data[kind].findIndex(item => key(item) === key(change.after));
                        if (index < 0 || !same(data[kind][index], change.after)) continue;
                        if (this.getImportReferenceSignature(data, kind, change.after) !== change.references) continue;
                        if (change.before) data[kind][index] = clone(change.before); else data[kind].splice(index, 1);
                        restored[kind]++;
                    }
                }
                const log = data.historyImportLogs.find(item => item.id === plan.id);
                log.cancelledRecordIds = [...new Set([...(log.cancelledRecordIds || []), ...ids])];
                log.lastCancelledAt = new Date().toISOString();
            });
            plan.result = { removed: ids.size, ...restored }; plan.dialog?.close();
            this.showToast?.(`${ids.size}件の取り込みを取り消しました。`, 'success');
            this.updateDataLists(); this.updateHistoryPeriodOptions(); this.renderHistory(); this.renderCalendar();
            this.openHistoryImportModal?.(); return true;
        } catch (error) { plan.error = error.message || String(error); return false; }
        finally { plan.saving = false; }
    };
    P.openHistoryImportUndo = function (id) {
        let plan; try { plan = this.createHistoryImportUndoPlan(id); } catch (error) { this.showToast?.(error.message, 'warning'); return; }
        const dialog = node('dialog', null, document.body); dialog.className = 'history-import-review history-import-undo'; plan.dialog = dialog;
        node('h3', '取り込みを取り消す', dialog); node('p', plan.log.fileName, dialog);
        node('p', '編集済みの記録は最初は選択していません。差分を確認して選んでください。関連マスターは、変更や追加の利用がなければ取込前に戻します。在庫は取込後の編集による増減だけ戻します。', dialog);
        const status = node('p', null, dialog); status.setAttribute('role', 'status');
        const error = node('p', null, dialog); error.className = 'history-import-review-error'; error.setAttribute('role', 'alert');
        const list = node('div', null, dialog); list.className = 'history-import-review-list';
        const footer = node('div', null, dialog); footer.className = 'history-import-review-actions'; let page = 0;
        const button = (title, action) => { const b = node('button', title, footer); b.type = 'button'; b.className = 'secondary-btn'; b.onclick = action; return b; };
        const previous = button('前へ', () => { page--; render(); }), next = button('次へ', () => { page++; render(); });
        button('閉じる', () => { if (!plan.saving) dialog.close(); });
        const save = button('選択した記録を取り消す', async () => {
            if (plan.saving) return;
            const controls = [...dialog.querySelectorAll('button,input')]; controls.forEach(c => c.disabled = true);
            if (!await this.commitHistoryImportUndo(plan)) { controls.forEach(c => c.disabled = false); render(); }
        }); save.className = 'danger-btn'; save.id = 'history-import-undo-save';
        const summary = () => {
            status.textContent = `対象 ${plan.entries.length}件・編集済み ${plan.entries.filter(e => e.changed).length}件・選択 ${plan.selected.size}件（${page + 1}/${Math.max(1, Math.ceil(plan.entries.length / 50))}ページ）`;
            save.disabled = !plan.selected.size; error.textContent = plan.error || ''; error.hidden = !plan.error;
        };
        const render = () => {
            list.replaceChildren(); previous.disabled = page === 0; next.disabled = (page + 1) * 50 >= plan.entries.length;
            for (const e of plan.entries.slice(page * 50, page * 50 + 50)) {
                const section = node('section', null, list), label = node('label', null, section), check = node('input', null, label);
                check.type = 'checkbox'; check.checked = plan.selected.has(e.record.id); check.dataset.undoRecord = e.record.id;
                node('strong', `${e.record.date} / ${this.getHistoryDisplayText(e.record)}${e.changed ? '（編集済み）' : ''}`, label);
                check.onchange = () => { if (check.checked) plan.selected.add(e.record.id); else plan.selected.delete(e.record.id); summary(); };
                if (e.changed) {
                    const details = node('details', null, section); details.open = true; node('summary', '取込時からの変更', details);
                    const describe = record => ({ '日付': record.date, '機械': store.activeData.machines.find(m => m.id === record.machineId)?.name || record.machineId, ...this.getHistoryImportDetails(record) });
                    const before = describe(e.before), after = describe(e.record); let shown = 0;
                    for (const key of Object.keys(before)) if (before[key] !== after[key]) { node('p', `${key}：${before[key] || '未入力'} → ${after[key] || '未入力'}`, details); shown++; }
                    if (!shown) node('p', '写真・付帯情報などの変更があります。元の履歴も確認してください。', details);
                }
            }
            if (!plan.entries.length) node('p', '取消対象の記録はありません。', list);
            summary(); list.scrollTop = 0;
        };
        dialog.addEventListener('cancel', event => { if (plan.saving) event.preventDefault(); });
        dialog.addEventListener('close', () => dialog.remove(), { once: true }); render(); dialog.showModal();
    };
})();
