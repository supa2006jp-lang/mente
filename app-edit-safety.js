(function () {
    'use strict';
    const P = MaintenanceApp.prototype;
    const prefix = 'maintenance-edit-draft-v1:';
    const writer = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    const controllers = new Map();
    const names = { todo: 'ToDo', 'edit-history': '履歴の編集', sudden: '突発対応', complete: '完了報告' };
    const fieldNames = { machines: '機械一覧', tasks: 'メンテナンス予定', history: 'メンテナンス履歴', photos: '添付写真', replacedParts: '使用部品', partsMaster: '部品マスター', localTodos: 'ToDo', departments: '部署一覧', settings: '設定', deptData: '部署データ', currentDepartmentId: '現在の部署', memos: '日別メモ' };
    const clone = value => JSON.parse(JSON.stringify(value));
    const el = (tag, text, parent) => { const node = document.createElement(tag); if (text) node.textContent = text; parent?.append(node); return node; };
    function button(parent, text, action) { const b = el('button', text, parent); b.type = 'button'; b.className = 'secondary-btn'; b.onclick = action; return b; }
    function download(value, name) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
        const a = el('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    function dialog(title) {
        const d = el('dialog', '', document.body); d.className = 'edit-safety-dialog';
        el('h3', title, d); button(d, '閉じる', () => d.close()); d.addEventListener('close', () => d.remove()); d.showModal(); return d;
    }
    function listDrafts() {
        const result = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i); if (!key?.startsWith(prefix)) continue;
                try { const d = JSON.parse(localStorage.getItem(key)); if (d?.version === 1 && names[d.type] && d.state && typeof d.department === 'string') result.push({ ...d, key }); } catch (_) {}
            }
        } catch (_) {}
        return result.sort((a, b) => b.at - a.at);
    }
    function fields(root) {
        return [...root.querySelectorAll('input,select,textarea')].filter(f => !f.closest('.edit-safety-note,.edit-save-error') && !['file', 'search', 'password'].includes(f.type) && !f.closest('#s-parts-container'));
    }
    function fieldKey(f, i) { return f.id ? 'id:' + f.id : [f.tagName, f.type, f.name, f.value && ['radio', 'checkbox'].includes(f.type) ? f.value : '', i].join(':'); }
    function capture(c) {
        return {
            fields: fields(c.root).map((f, i) => ({ key: fieldKey(f, i), value: ['checkbox', 'radio'].includes(f.type) ? f.checked : f.multiple ? [...f.selectedOptions].map(o => o.value) : f.value })),
            parts: [...c.root.querySelectorAll('#s-parts-container .part-row')].map(row => Object.fromEntries(['name', 'model', 'count', 'unit', 'price'].map(key => [key, row.querySelector('.p-' + key)?.value || '']))),
            photos: c.type === 'todo' ? [] : clone(window.app?._tempPhotos || []),
        };
    }
    function saveDraft(c) {
        if (!c || c.saving || c.finished || !c.root.isConnected) return true;
        try {
            const state = capture(c), serialized = JSON.stringify(state);
            if (serialized === c.initial) {
                if (c.key) localStorage.removeItem(c.key);
                c.last = ''; c.durable = false; c.status.textContent = '入力すると下書きを保存します。'; refreshDraftButton(); return true;
            }
            if (serialized === c.last && c.durable && localStorage.getItem(c.key)) return true;
            const d = { version: 1, type: c.type, entity: c.entity, department: c.department, departmentName: c.departmentName, at: Date.now(), baseSavedAt: c.baseSavedAt, state };
            c.key ||= prefix + writer + ':' + Math.random().toString(36).slice(2);
            localStorage.setItem(c.key, JSON.stringify(d));
            c.last = serialized; c.durable = true;
            c.status.textContent = '下書き保存済み。このブラウザーで再開できます。';
            refreshDraftButton(); return true;
        } catch (_) {
            c.durable = false; c.status.textContent = '下書きを保存できません。入力画面を閉じず、保存領域の空き容量を確認してください。'; return false;
        }
    }
    function refreshDraftButton() {
        let b = document.getElementById('edit-drafts-button');
        if (!b) {
            const host = document.querySelector('.header-right'); if (!host) return;
            b = button(host, '', () => window.app.openEditDrafts()); b.id = 'edit-drafts-button';
        }
        const n = listDrafts().length; b.textContent = '下書き ' + n + '件'; b.hidden = !n;
    }
    P.startEditDraft = function (root, type) {
        if (!root || !names[type]) return;
        const old = controllers.get(root); if (old) this.endEditDraft(root);
        const entity = root.querySelector(type === 'todo' ? '#kt-task-id' : type === 'edit-history' ? '#e-h-id' : '#c-task-id')?.value || '';
        const department = String(store.data.currentDepartmentId);
        const note = el('div'); note.className = 'edit-safety-note'; note.setAttribute('role', 'status');
        const host = root.querySelector('.kt-todo-modal,#modal-content') || root; host.prepend(note);
        const status = el('span', '入力途中の内容をこのブラウザーに下書き保存します。', note);
        const c = { root, type, entity, department, departmentName: store.data.departments?.find(d => String(d.id) === department)?.name || department, baseSavedAt: store.lastSuccessfulSaveAt, status };
        c.initial = JSON.stringify(capture(c)); controllers.set(root, c);
        c.listener = () => saveDraft(c); root.addEventListener('input', c.listener); root.addEventListener('change', c.listener);
        c.timer = setInterval(c.listener, 1000); // Also capture photo rotations and programmatic field changes.
        const existing = this._draftToRestore || listDrafts().find(d => d.type === type && d.entity === entity && d.department === department);
        this._draftToRestore = null;
        if (existing && existing.type === type && existing.entity === entity && existing.department === department) {
            status.textContent = new Date(existing.at).toLocaleString('ja-JP') + ' の下書きがあります。';
            if (existing.baseSavedAt !== store.lastSuccessfulSaveAt) status.textContent += ' 保存済みデータも更新されています。復元後に内容を確認してください。';
            const restore = button(note, '下書きを復元', () => {
                c.saving = true;
                const parts = root.querySelector('#s-parts-container');
                if (parts) { parts.replaceChildren(); for (const part of existing.state.parts || []) this.addPartRow(part, true); }
                const values = new Map((existing.state.fields || []).map(f => [f.key, f.value]));
                // Apply select-dependent fields first, then restore exact values after their handlers run.
                for (let pass = 0; pass < 2; pass++) fields(root).forEach((f, i) => {
                    const value = values.get(fieldKey(f, i)); if (value === undefined) return;
                    if (['checkbox', 'radio'].includes(f.type)) f.checked = !!value;
                    else if (f.multiple) [...f.options].forEach(o => { o.selected = Array.isArray(value) && value.includes(o.value); });
                    else f.value = String(value);
                    if (!pass && f.tagName === 'SELECT') f.dispatchEvent(new Event('change', { bubbles: true }));
                });
                if (type !== 'todo') {
                    this._tempPhotos = clone(existing.state.photos || []);
                    const preview = root.querySelector('#e-photo-previews,#s-photo-previews,#c-photo-previews');
                    if (preview) { preview.replaceChildren(); this._tempPhotos.forEach(p => this.appendHistoryPhotoPreview(preview, p, 80)); }
                }
                c.originDraft = { key: existing.key, raw: localStorage.getItem(existing.key) };
                c.last = ''; c.finished = false; c.saving = false; restore.remove(); discard.remove(); saveDraft(c);
            });
            const discard = button(note, 'この下書きを削除', () => {
                if (!confirm('この下書きを削除しますか？保存済みの記録は残ります。')) return;
                localStorage.removeItem(existing.key); restore.remove(); discard.remove(); status.textContent = '入力すると新しい下書きを保存します。'; refreshDraftButton();
            });
        }
        button(note, '下書きをファイルに出力', () => download({ version: 1, type, department, entity, state: capture(c) }, 'maintenance-draft.json'));
    };
    P.hasDurableEditDraft = function (root) { const c = controllers.get(root); return !!c && saveDraft(c) && !!c.durable; };
    P.canCloseEditDraft = function (root) {
        const c = controllers.get(root);
        return !c || saveDraft(c) || confirm('下書きを保存できていません。入力内容を破棄して閉じますか？');
    };
    P.finishEditDraft = function (root) {
        const c = controllers.get(root); if (!c) return;
        c.finished = true; if (c.key) localStorage.removeItem(c.key); refreshDraftButton();
        if (c.originDraft && localStorage.getItem(c.originDraft.key) === c.originDraft.raw) localStorage.removeItem(c.originDraft.key);
        refreshDraftButton();
    };
    P.endEditDraft = function (root, options = {}) {
        const c = controllers.get(root); if (!c) return;
        if (options.saved) this.finishEditDraft(root); else if (!options.keepSnapshot) saveDraft(c);
        clearInterval(c.timer); root.removeEventListener('input', c.listener); root.removeEventListener('change', c.listener); controllers.delete(root);
    };
    P.openEditDrafts = function () {
        const d = dialog('入力途中の下書き');
        el('p', '下書きはこのブラウザーだけに保存されます。保存済みの記録と照合してから保存してください。', d);
        for (const draft of listDrafts()) {
            const row = el('div', '', d); row.className = 'edit-safety-note';
            el('p', `${draft.departmentName} / ${names[draft.type]} / ${new Date(draft.at).toLocaleString('ja-JP')}`, row);
            el('p', String(draft.state.fields?.find(f => ['id:kt-task-title','id:e-symptom','id:s-content'].includes(f.key))?.value || '').slice(0, 120), row);
            button(row, '開く', async () => {
                if (this._safeEditBusy || this._modalSaveInProgress) return;
                if (!document.getElementById('modal-overlay')?.classList.contains('hidden') || document.getElementById('kt-todo-modal-overlay')) {
                    alert('編集中の入力画面を閉じてから、下書きを開いてください。'); return;
                }
                if (!store.data.deptData?.[draft.department]) { alert('元の部署がありません。下書きをファイルへ出力して確認してください。'); return; }
                const dept = store.data.deptData[draft.department];
                if (draft.entity && !((draft.type === 'todo' ? dept.localTodos : draft.type === 'edit-history' ? dept.history : dept.tasks) || []).some(r => String(r.id) === draft.entity)) {
                    alert('元の記録が削除されています。下書きをファイルへ出力して確認してください。'); return;
                }
                await window.maintenanceLazyFeatures?.loadNotebook();
                await window.maintenanceLazyFeatures?.loadPhotos();
                store.data.currentDepartmentId = draft.department; this.updateDepartmentUI(); this.updateDataLists();
                this._draftToRestore = draft; d.close();
                if (draft.type === 'todo') this.openKanbanTodoModal('todo', draft.entity);
                else if (draft.type === 'edit-history') this.openHistoryEditForm(draft.entity);
                else if (draft.type === 'complete') this.openCompletionForm(draft.entity, draft.state.fields.find(f => f.key === 'id:c-date')?.value);
                else this.openSuddenRecordModal();
            });
            button(row, 'ファイルに出力', () => download(draft, 'maintenance-draft.json'));
            button(row, '削除', () => { if (confirm('この下書きを削除しますか？')) { localStorage.removeItem(draft.key); row.remove(); refreshDraftButton(); } });
        }
    };
    P.assertEditDepartment = function (root) {
        const c = controllers.get(root);
        if (c && c.department !== String(store.data.currentDepartmentId)) throw new Error('入力中に部署が切り替わりました。元の部署の下書きから再開してください。');
    };
    P.setEditSaving = function (root, saving) {
        if (!root) return;
        const c = controllers.get(root);
        if (saving) {
            if (c) { saveDraft(c); c.saving = true; }
            root._editDisabled = [...root.querySelectorAll('button,input,select,textarea')].map(f => [f, f.disabled]);
            root._editDisabled.forEach(([f]) => { f.disabled = true; });
        } else {
            root._editDisabled?.forEach(([f, disabled]) => { f.disabled = disabled; }); delete root._editDisabled;
            if (c) c.saving = false;
        }
    };
    P.commitFormEdit = async function (root, mutate, success) {
        if (this._safeEditBusy) return false;
        this._safeEditBusy = true;
        const c = controllers.get(root); if (c) { saveDraft(c); c.saving = true; }
        const controls = root ? [...root.querySelectorAll('button,input,select,textarea')].map(f => [f, f.disabled]) : [];
        controls.forEach(([f]) => { f.disabled = true; });
        try {
            this.assertEditDepartment(root);
            await window.maintenanceLazyFeatures?.loadNotebook();
            await store.runAtomicSaveBatch(mutate);
            this._safeEditCommitted = true; success?.(); return true;
        } catch (error) { this.showEditSaveError(error, root); return false; }
        finally { controls.forEach(([f, disabled]) => { f.disabled = disabled; }); if (c) c.saving = false; this._safeEditBusy = false; this._safeEditCommitted = false; }
    };
    P.showEditSaveError = function (error, root) {
        const host = root?.querySelector('.kt-todo-modal,#modal-content') || root || document.body;
        let panel = host.querySelector('.edit-save-error');
        if (!panel) { panel = el('div'); panel.className = 'edit-save-error'; panel.setAttribute('role', 'alert'); host.prepend(panel); }
        panel.replaceChildren();
        el('strong', '保存できませんでした。入力内容は残っています。', panel);
        el('p', error.code === 'INVALID_SAVE_SHAPE' ? 'データの形式に問題があります。問題箇所を確認・修正してから、もう一度保存してください。' : error.message, panel);
        if (error.code === 'INVALID_SAVE_SHAPE') button(panel, '問題箇所を確認・修正', () => this.openSaveStructureIssues(error));
        if (error.code === 'SAVE_CONFLICT') button(panel, '下書きを残して最新版を開く', () => {
            const results = [...controllers.values()].map(c => saveDraft(c));
            if (results.includes(false)) { alert('下書きを保存できません。先に入力内容をファイルへ出力してください。'); return; }
            if (confirm('保存先の最新版を読み込みます。入力途中の内容は「下書き」から復元できます。続けますか？')) location.reload();
        });
        panel.scrollIntoView?.({ block: 'nearest' });
    };
    P.openSaveStructureIssues = function (error) {
        const d = dialog('保存できない箇所の確認');
        const candidate = store.cloneSaveSnapshot();
        const base = JSON.stringify(store.data);
        const issues = store.getStoredDataShapeIssues(candidate);
        el('p', '部署名・記録名を確認してください。項目を選ぶと、問題の値を確認して修正できます。元の内容は自動で書き換えません。', d);
        if (!issues.length) {
            el('p', '保存に失敗した変更は元に戻っています。入力画面の内容を確認して、もう一度保存してください。', d);
            for (const issue of error?.issues || []) el('p', issue, d);
            return;
        }
        let backup = false;
        button(d, '修正前のデータをファイルに退避', () => { download({ mainData: JSON.parse(base) }, 'maintenance-before-repair.json'); backup = true; });
        const feedback = el('p', '', d);
        for (const issue of issues) {
            const match = issue.match(/^部署 (.+?)\.([A-Za-z][\w]*(?:\[\d+\])?(?:\.[A-Za-z][\w]*(?:\[\d+\])?)?)/);
            let path = match ? ['deptData', match[1], ...match[2].replace(/\[(\d+)\]/g, '.$1').split('.')] : issue.startsWith('部署一覧') ? ['departments'] : issue.startsWith('設定') ? ['settings'] : issue.startsWith('現在の部署') ? ['currentDepartmentId'] : null;
            if (!path && issue === '部署データがありません') path = ['deptData'];
            if (!path && /^部署 (.+) がデータ形式ではありません$/.test(issue)) path = ['deptData', issue.match(/^部署 (.+) が/)[1]];
            const row = el('details', '', d); let label = issue;
            if (match) {
                const department = candidate.departments?.find?.(v => String(v.id) === match[1]);
                const item = path.length > 3 ? candidate.deptData?.[match[1]]?.[path[2]]?.[path[3]] : null;
                label = `${department?.name || match[1]} / ${fieldNames[path[2]] || path[2]}${/^\d+$/.test(path[3] || '') ? ' / ' + (Number(path[3]) + 1) + '件目' : ''}${item?.name || item?.errorContent || item?.title ? ' / ' + (item.name || item.errorContent || item.title) : ''} / ${fieldNames[path.at(-1)] || '記録の形式'}`;
            }
            el('summary', label, row); el('p', issue.replace(/\b(machines|tasks|history|photos|replacedParts|partsMaster|localTodos)\b/g, key => fieldNames[key]), row);
            if (!path || path.some(p => ['__proto__', 'constructor', 'prototype'].includes(p))) continue;
            let parent = candidate; for (const p of path.slice(0, -1)) parent = parent?.[p];
            if (!parent || typeof parent !== 'object') continue;
            el('p', '詳細修正（JSON形式）。一覧は [ ]、1件の記録や設定は { } で表します。必要な内容を残して修正してください。', row);
            const input = el('textarea', '', row); input.rows = 6; input.setAttribute('aria-label', label + 'の修正値'); input.value = JSON.stringify(parent[path.at(-1)], null, 2) ?? 'null';
            button(row, 'この修正を仮適用', () => { try { parent[path.at(-1)] = JSON.parse(input.value); feedback.textContent = `未修正の形式エラー: ${store.getStoredDataShapeIssues(candidate).length}件。最後に「修正内容を保存」を押してください。`; } catch (_) { feedback.textContent = 'JSONの形式が正しくありません。括弧や引用符を確認してください。'; } });
        }
        button(d, '修正内容を保存', async () => {
            if (!backup) { feedback.textContent = '先に修正前のデータをファイルに退避してください。'; return; }
            if (JSON.stringify(store.data) !== base) { feedback.textContent = '確認中にデータが変わりました。この画面を開き直してください。'; return; }
            const remaining = store.getStoredDataShapeIssues(candidate);
            if (remaining.length) { feedback.textContent = `まだ ${remaining.length}件の形式エラーがあります。`; return; }
            try {
                await store.runAtomicSaveBatch(() => { store.restoreSaveSnapshotInPlace(candidate, store.data); });
                feedback.textContent = '修正を保存しました。入力画面に戻って保存をやり直してください。';
            } catch (err) { feedback.textContent = err.message; }
        });
    };
    window.addEventListener('maintenance-save-status', event => {
        if (event.detail?.status !== 'error' || !window.app) return;
        const error = event.detail.error;
        if (!['SAVE_CONFLICT', 'INVALID_SAVE_SHAPE'].includes(error?.code)) return;
        const root = document.getElementById('kt-todo-modal-overlay') || (!document.getElementById('modal-overlay')?.classList.contains('hidden') ? document.getElementById('modal-container') : document.querySelector('main'));
        window.app.showEditSaveError(error, root);
    });
    window.addEventListener('pagehide', () => controllers.forEach(c => saveDraft(c)));
    window.addEventListener('storage', refreshDraftButton);
    document.addEventListener('DOMContentLoaded', () => {
        const style = el('style', '', document.head);
        style.textContent = '.edit-safety-note,.edit-save-error{padding:12px;margin:10px 0;border:1px solid #adc4da;border-radius:8px;background:#f1f6fc;color:#18334e;font-size:14px;line-height:1.6}.edit-save-error{border-color:#b45309;background:#fff7ed;color:#7c2d12}.edit-safety-note button,.edit-save-error button,.edit-safety-dialog button{margin:4px}.edit-safety-dialog{width:min(680px,94vw);max-height:85vh;overflow:auto;border:1px solid #64748b;border-radius:12px;padding:20px}.edit-safety-dialog textarea{width:100%;font-family:monospace}.edit-safety-dialog details{margin:10px 0;padding:10px;background:#f1f5f9}.edit-safety-dialog::backdrop{background:#0f172a66}';
        setTimeout(refreshDraftButton, 500);
    });
})();
