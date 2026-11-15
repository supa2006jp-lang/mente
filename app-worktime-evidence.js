(function () {
    'use strict';
    const P = MaintenanceApp.prototype;
    P.getWorkTimeEvidence = function (history, results, groupBy, machines, filter = {}) {
        const machineMap = new Map(machines.map(m => [m.id, m]));
        const displayed = new Set(results.filter(r => !r.isArchived).map(r => r.name));
        const hasArchived = results.some(r => r.isArchived);
        const rows = [], contributions = new Map(), excludedWorkers = [], unknownTimes = [], duplicateWorkers = [], guideOnly = [];
        let total = 0, count = 0;
        for (const h of history) {
            const facts = this.getWorkTimeRecordFacts(h);
            if (facts.guideOnly) { guideOnly.push(h); continue; }
            const rawKeys = groupBy === 'category' ? [machineMap.get(h.machineId)?.category || h.machineCategory || 'その他'] : facts.workers;
            if (!rawKeys.length) excludedWorkers.push(h);
            if (facts.unknownTime) unknownTimes.push(h);
            if (facts.duplicateWorkers) duplicateWorkers.push(h);
            const keys = rawKeys.filter(key => {
                const archived = groupBy === 'worker' && store.isWorkerArchived(key);
                return (archived ? hasArchived : displayed.has(key)) && (!filter.name || (filter.archived ? archived : key === filter.name));
            });
            if (!keys.length || (filter.type && this.getWorkTimeHistoryTypeKey(h) !== filter.type)) continue;
            const minutes = facts.minutes * keys.length;
            total += minutes; count += keys.length; rows.push(h); contributions.set(h, minutes);
        }
        return { rows, contributions, total, count, excludedWorkers, unknownTimes, duplicateWorkers, guideOnly };
    };
    P.renderWorkTimeEvidence = function (container, history, results, groupBy, machines) {
        this._workTimeEvidenceContext = { history, results, groupBy, machines };
        const data = this.getWorkTimeEvidence(history, results, groupBy, machines);
        const section = document.createElement('details'); section.className = 'worktime-evidence'; section.open = true;
        const summary = document.createElement('summary'); summary.textContent = '集計の根拠と計算方法'; section.append(summary);
        const note = document.createElement('p'); note.textContent = groupBy === 'worker'
            ? '作業者別は人数分を加算した延べ作業時間です。30分を2名で作業した記録は合計60分（各30分）になります。同じ記録内の同名作業者は、前後の空白を除いて1名として扱います。'
            : '装置区分別は各記録の作業時間を1回ずつ加算します。30分を2名で作業した記録も合計30分です。'; section.append(note);
        const definitions = document.createElement('p'); definitions.textContent = '時間未入力・不正値・負の時間は0分として扱い、件数には含めます。平均＝その種類の合計時間÷件数。割合の分母は検索前の全グループです。手順書のみの登録は時間・件数から除外します。元の記録は変更しません。'; section.append(definitions);
        const add = (label, action) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary-btn'; b.textContent = label; b.onclick = action; section.append(b); };
        add(`表示合計 ${data.total.toLocaleString()} 分の根拠（${data.rows.length} 記録）`, () => this.openWorkTimeEvidence());
        if (groupBy === 'worker') add(`作業者未設定・集計対象外 ${data.excludedWorkers.length} 件`, () => this.openEvidenceRecords(data.excludedWorkers, '作業者未設定の記録'));
        add(`時間未入力・不正値 ${data.unknownTimes.length} 件`, () => this.openEvidenceRecords(data.unknownTimes, '時間の確認が必要な記録', { description: '同じ期間・ラインの記録です。未入力・数値でない値・負の値は0分として集計します。元の記録から修正できます。' }));
        add(`作業者名の重複 ${data.duplicateWorkers.length} 件`, () => this.openEvidenceRecords(data.duplicateWorkers, '作業者名が重複する記録', { description: '同じ記録内の同名作業者は1名として集計します。元の記録から修正できます。' }));
        add(`手順書のみ・集計対象外 ${data.guideOnly.length} 件`, () => this.openEvidenceRecords(data.guideOnly, '手順書のみの登録', { guides: true }));
        container.append(section);
    };
    P.openWorkTimeEvidence = function (name = '', type = '', archived = false, metric = 'sum') {
        const c = this._workTimeEvidenceContext; if (!c) return;
        const data = this.getWorkTimeEvidence(c.history, c.results, c.groupBy, c.machines, { name, type, archived });
        const calculation = metric === 'average' ? `${data.total.toLocaleString()} 分 ÷ ${data.count} 件 = ${data.count ? (data.total / data.count).toFixed(1) : 0} 分` : `${data.total.toLocaleString()} 分`;
        this.openEvidenceRecords(data.rows, `${name || '表示合計'} の根拠：${calculation}`, {
            description: '集計画面と同じ期間・ライン・表示グループの記録です。複数作業者の加算分を各行に表示しています。時間未入力の記録も平均の件数に含みます。',
            contribution: record => data.contributions.get(record) || 0
        });
    };
    P.getWorkTimeEvidenceButton = function (row, type, value, metric = 'sum') {
        return `<button type="button" class="worktime-evidence-number" data-name="${this.escapeHtml(row.name)}" data-kind="${type}" data-metric="${metric}" data-archived="${row.isArchived ? '1' : '0'}" onclick="app.openWorkTimeEvidence(this.dataset.name,this.dataset.kind,this.dataset.archived==='1',this.dataset.metric)">${this.escapeHtml(value)}</button>`;
    };
})();
