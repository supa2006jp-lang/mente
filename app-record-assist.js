(function () {
    'use strict';
    const P = MaintenanceApp.prototype;
    P.organizeMaintenanceForm = function (type) {
        const prefix = { sudden: 's-', complete: 'c-', 'edit-history': 'e-' }[type];
        const form = document.querySelector('#modal-content form');
        if (!prefix || !form || form.dataset.organized) return;
        form.dataset.organized = '1'; form.classList.add('organized-maintenance-form');
        const heading = document.createElement('p'); heading.className = 'form-essential-note';
        heading.textContent = '基本情報を入力し、必要に応じて詳細を開いてください。＊は必須です。';
        const details = document.createElement('details'); details.className = 'maintenance-form-details';
        const summary = document.createElement('summary'); summary.textContent = '詳細・任意項目（原因、処置、写真、部品など）'; details.append(summary);
        const essential = new Set(['line-no', 'machine-id', 'date', 'scheduled-date', 'content', 'symptom', 'work-time', 'workers', 'machine-category', 'category', 'is-single-maintenance']);
        for (const child of [...form.children]) {
            if (['INPUT', 'DATALIST'].includes(child.tagName) || child.querySelector('[required]')) continue;
            if ([...child.querySelectorAll('[id]')].some(n => essential.has(n.id.replace(prefix, '')))) continue;
            details.append(child);
        }
        form.prepend(heading);
        const assist = document.createElement('div'); assist.className = 'workspace-toolbar record-reuse';
        const label = document.createElement('label'); label.textContent = '過去の記録から入力';
        const select = document.createElement('select'); select.id = 'record-reuse-select'; label.append(select);
        const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'secondary-btn'; apply.textContent = '空欄に取り込む';
        const hint = document.createElement('small'); hint.textContent = '同じ機械の内容・原因・処置・時間・区分・作業者を補助入力します。入力済みの項目と日付は保持します。';
        assist.append(label, apply, hint); form.append(assist, details);
        const refresh = () => {
            const machineId = document.getElementById(prefix + 'machine-id')?.value;
            const currentId = document.getElementById('e-h-id')?.value;
            const records = (store.activeData.history || []).filter(h => h.machineId === machineId && h.id !== currentId && !h.isManualGuide)
                .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 30);
            select.replaceChildren(new Option('記録を選択', ''));
            for (const record of records) select.add(new Option(`${record.date || ''} ${this.getHistoryDisplayText(record) || '内容未設定'}`, record.id));
            apply.disabled = !records.length;
        };
        form.addEventListener('change', event => { if (event.target.id === prefix + 'machine-id') refresh(); });
        apply.onclick = () => {
            const source = (store.activeData.history || []).find(h => h.id === select.value && h.machineId === document.getElementById(prefix + 'machine-id')?.value);
            if (!source) return this.showToast('取り込む記録を選択してください。', 'warning');
            const values = { content: source.errorContent, symptom: source.errorContent, cause: source.cause, notes: source.notes, 'work-time': source.workTime, category: source.category, workers: (source.workers || []).join(', ') };
            let copied = 0;
            for (const [name, value] of Object.entries(values)) {
                const field = document.getElementById(prefix + name);
                if (!field || field.value.trim() || value == null || value === '') continue;
                field.value = String(value);
                if (!field.value) continue;
                copied++; field.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (copied) details.open = true;
            this.showToast(copied ? `${copied} 項目を空欄に取り込みました。内容を確認してください。` : '取り込める空欄がありません。', 'info');
        };
        // Invalid fields in a collapsed section must be visible before native validation focuses them.
        form.addEventListener('invalid', event => { const section = event.target.closest('details'); if (section) section.open = true; }, true);
        refresh();
        // Prefill code runs after openModal returns.
        queueMicrotask(refresh);
    };
})();
