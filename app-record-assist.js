(function () {
    'use strict';
    const P = MaintenanceApp.prototype;
    P.showRecordReuseChoice = function (source, prefix, mode = 'full') {
        const panel = document.querySelector('.record-reuse');
        if (!panel || panel.dataset.prefix !== prefix || !source) return;
        panel._candidate = source;
        const select = panel.querySelector('select');
        if (![...select.options].some(o => o.value === '__candidate__')) select.add(new Option('選択した候補', '__candidate__'));
        select.value = '__candidate__';
        panel.querySelector('button').disabled = false;
        select.selectedOptions[0].textContent = `${source.date || ''} ${source.errorContent || source.notes || '選択した候補'}`;
        for (const field of panel.querySelectorAll('[data-reuse-field]')) field.checked = mode === 'detail'
            ? ['cause', 'notes'].includes(field.dataset.reuseField) : !['work-time', 'workers', 'parts'].includes(field.dataset.reuseField);
        panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
        panel.querySelector('[data-reuse-field]')?.focus({ preventScroll: true });
        this.showToast('取り込む項目を選び、「空欄に取り込む」を押してください。', 'info');
    };
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
        assist.dataset.prefix = prefix;
        const label = document.createElement('label'); label.textContent = '過去の記録から入力';
        const select = document.createElement('select'); select.id = 'record-reuse-select'; label.append(select);
        const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'secondary-btn'; apply.textContent = '空欄に取り込む';
        const choices = document.createElement('fieldset'); choices.className = 'record-reuse-choices';
        const legend = document.createElement('legend'); legend.textContent = '取り込む項目'; choices.append(legend);
        for (const [name, text] of [['content','内容'],['symptom','症状'],['cause','原因'],['notes','処置'],['category','対応区分'],['work-time','作業時間'],['workers','作業者'],['parts','使用部品']]) {
            const selector = name === 'parts' ? '#s-parts-container' : '#' + prefix + name;
            if (!form.querySelector(selector) && !details.querySelector(selector)) continue;
            const option = document.createElement('label');
            const check = document.createElement('input'); check.type = 'checkbox'; check.dataset.reuseField = name;
            check.checked = !['work-time','workers','parts'].includes(name); option.append(check, text); choices.append(option);
        }
        const hint = document.createElement('small'); hint.textContent = '選んだ項目の空欄だけに取り込みます。日付・入力済みの値は保持します。作業時間・作業者・使用部品は必要な場合に選択してください。';
        assist.append(label, apply, choices, hint); form.append(assist, details);
        const refresh = () => {
            const machineId = document.getElementById(prefix + 'machine-id')?.value;
            const currentId = document.getElementById('e-h-id')?.value;
            const records = (store.activeData.history || []).filter(h => h.machineId === machineId && h.id !== currentId && !h.isManualGuide)
                .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 30);
            select.replaceChildren(new Option('記録を選択', ''));
            assist._candidate = null;
            for (const record of records) select.add(new Option(`${record.date || ''} ${this.getHistoryDisplayText(record) || '内容未設定'}`, record.id));
            apply.disabled = !records.length;
        };
        form.addEventListener('change', event => { if (event.target.id === prefix + 'machine-id') refresh(); });
        apply.onclick = () => {
            const source = select.value === '__candidate__' ? assist._candidate : (store.activeData.history || []).find(h => h.id === select.value && h.machineId === document.getElementById(prefix + 'machine-id')?.value);
            if (!source) return this.showToast('取り込む記録を選択してください。', 'warning');
            const values = { content: source.errorContent, symptom: source.errorContent, cause: source.cause, notes: source.notes, 'work-time': source.workTime, category: source.category, workers: (source.workers || []).join(', ') };
            const selected = new Set([...choices.querySelectorAll('input:checked')].map(n => n.dataset.reuseField));
            if (!selected.size) return this.showToast('取り込む項目を選択してください。', 'warning');
            let copied = 0;
            for (const [name, value] of Object.entries(values)) {
                const field = document.getElementById(prefix + name);
                if (!selected.has(name) || !field || field.value.trim() || value == null || value === '') continue;
                field.value = String(value);
                if (!field.value) continue;
                copied++; field.dispatchEvent(new Event('input', { bubbles: true }));
                this.autoResizeTextarea?.(field);
            }
            const parts = document.getElementById('s-parts-container');
            if (selected.has('parts') && parts && !parts.querySelector('.part-row') && source.replacedParts?.length) {
                for (const part of source.replacedParts) this.addPartRow({ ...part }, true);
                copied++; parts.dispatchEvent(new Event('input', { bubbles: true }));
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
