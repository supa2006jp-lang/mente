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
        panel._refreshPreview?.();
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
        const preview = document.createElement('div'); preview.className = 'record-reuse-preview';
        const feedback = document.createElement('small'); feedback.className = 'record-reuse-feedback'; feedback.setAttribute('role','status');
        const undo = document.createElement('button'); undo.type = 'button'; undo.className = 'secondary-btn record-reuse-undo'; undo.textContent = '転記を取り消す'; undo.hidden = true;
        assist.append(label, apply, choices, preview, hint, undo, feedback); form.append(assist, details);
        let lastCopy = null, applying = false;
        const labels = { content:'内容', symptom:'症状', cause:'原因', notes:'処置', category:'対応区分', 'work-time':'作業時間', workers:'作業者', parts:'使用部品' };
        const getSource = () => select.value === '__candidate__' ? assist._candidate : (store.activeData.history || []).find(h => h.id === select.value && h.machineId === document.getElementById(prefix + 'machine-id')?.value);
        const partState = row => JSON.stringify([...row.querySelectorAll('input,select')].map(n => [n.className,n.value]));
        const getPlan = () => {
            const source = getSource(); if (!source) return [];
            const facts = this.getWorkTimeRecordFacts(source);
            const values = { content:source.errorContent, symptom:source.errorContent, cause:source.cause, notes:source.notes, 'work-time':facts.unknownTime ? null : facts.minutes, category:source.category, workers:facts.workers.join(', ') };
            return [...choices.querySelectorAll('input:checked')].map(choice => {
                const name = choice.dataset.reuseField, field = document.getElementById(prefix + name);
                if (name === 'parts') {
                    const parts = document.getElementById('s-parts-container');
                    const value = (source.replacedParts || []).map(p => ({ ...p }));
                    return {name, field:parts, value, eligible:!!parts && !parts.querySelector('.part-row') && value.length > 0,
                        display:value.map(p => `${p.name || ''} ${p.model || ''} ${p.count || 0}${p.unit || '個'}`).join('、'),
                        reason:parts?.querySelector('.part-row') ? '入力済みの部品を保持' : '元の記録に値がありません'};
                }
                const value = values[name] == null ? '' : String(values[name]);
                const available = value !== '' && (field?.tagName !== 'SELECT' || [...field.options].some(o => o.value === value));
                return {name,field,value,display:field?.tagName === 'SELECT' ? [...field.options].find(o=>o.value===value)?.textContent || value : value,
                    before:field?.value || '', eligible:!!field && !field.value.trim() && available,
                    reason:field?.value.trim() ? '入力済みの値を保持' : name==='work-time' && facts.unknownTime ? '元の作業時間が未入力・不正です' : '取り込める値がありません'};
            });
        };
        const renderPreview = () => {
            preview.replaceChildren();
            const source=getSource();
            if (!source) { preview.textContent='記録を選ぶと、取り込む内容を確認できます。'; apply.disabled=true; return; }
            const heading=document.createElement('b'); heading.textContent='取り込み内容の確認'; preview.append(heading);
            const plan=getPlan();
            for(const item of plan) {
                const row=document.createElement('div'); row.className='record-reuse-preview-row';
                const title=document.createElement('span'); title.textContent=labels[item.name];
                const value=document.createElement('span'); value.textContent=item.eligible ? `空欄 → ${item.display}` : item.reason;
                row.classList.toggle('is-skipped',!item.eligible);row.append(title,value);preview.append(row);
            }
            if (!plan.length) preview.append(document.createTextNode('取り込む項目を選択してください。'));
            apply.disabled=!plan.some(item=>item.eligible);
        };
        assist._refreshPreview = renderPreview;
        const refresh = () => {
            const machineId = document.getElementById(prefix + 'machine-id')?.value;
            const currentId = document.getElementById('e-h-id')?.value;
            const records = (store.activeData.history || []).filter(h => h.machineId === machineId && h.id !== currentId && !h.isManualGuide)
                .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 30);
            select.replaceChildren(new Option('記録を選択', ''));
            assist._candidate = null;
            for (const record of records) select.add(new Option(`${record.date || ''} ${this.getHistoryDisplayText(record) || '内容未設定'}`, record.id));
            lastCopy = null; undo.hidden = true; feedback.textContent = ''; renderPreview();
        };
        for (const eventName of ['input','change']) form.addEventListener(eventName, event => {
            if (applying) return;
            if (lastCopy) {
                for (const item of lastCopy.fields) if (item.field === event.target) item.edited = true;
                for (const item of lastCopy.parts) if (item.row.contains(event.target)) item.edited = true;
            }
            if (eventName === 'change' && event.target.id === prefix + 'machine-id') refresh();
            else renderPreview();
        });
        apply.onclick = () => {
            const plan = getPlan().filter(item => item.eligible);
            if (!plan.length) return;
            const transaction = { fields:[], parts:[] };
            applying = true;
            try {
                for (const item of plan) {
                    if (item.name === 'parts') {
                        for (const part of item.value) {
                            const before = new Set(item.field.querySelectorAll('.part-row'));
                            this.addPartRow(part, true);
                            for (const row of item.field.querySelectorAll('.part-row')) if (!before.has(row)) transaction.parts.push({ row, state:partState(row), edited:false });
                        }
                        item.field.dispatchEvent(new Event('input',{bubbles:true}));
                    } else {
                        const manualOverride = item.field.dataset.manualOverride;
                        item.field.value = item.value;
                        item.field.dispatchEvent(new Event('input',{bubbles:true}));
                        this.autoResizeTextarea?.(item.field);
                        transaction.fields.push({...item,after:item.field.value,manualOverride,edited:false});
                    }
                }
            } finally { applying=false; }
            lastCopy=transaction; undo.hidden=false; details.open=true; renderPreview();
            feedback.textContent=`${plan.length}項目を取り込みました。保存するまで取り消せます。`;
        };
        undo.onclick = () => {
            if (!lastCopy) return;
            let restored=0, retained=0;
            applying=true;
            try {
                for (const item of lastCopy.fields) {
                    if (!item.field.isConnected) continue;
                    if (item.edited || item.field.value !== item.after) { retained++; continue; }
                    item.field.value=item.before; item.field.dispatchEvent(new Event('input',{bubbles:true}));
                    if (item.manualOverride === undefined) delete item.field.dataset.manualOverride;
                    else item.field.dataset.manualOverride=item.manualOverride;
                    this.autoResizeTextarea?.(item.field); restored++;
                }
                for (const item of lastCopy.parts) {
                    if (!item.row.isConnected) continue;
                    if (item.edited || partState(item.row)!==item.state) { retained++; continue; }
                    item.row.remove(); restored++;
                }
                form.dispatchEvent(new Event('input',{bubbles:true}));
            } finally { applying=false; }
            lastCopy=null;undo.hidden=true;renderPreview();
            feedback.textContent=`転記した${restored}項目を取り消しました。${retained ? `転記後に変更した${retained}項目は保持しました。` : ''}`;
        };
        // Invalid fields in a collapsed section must be visible before native validation focuses them.
        form.addEventListener('invalid', event => { const section = event.target.closest('details'); if (section) section.open = true; }, true);
        refresh();
        // Prefill code runs after openModal returns.
        queueMicrotask(refresh);
    };
})();
