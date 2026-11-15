(function () {
    'use strict';
    const P = MaintenanceApp.prototype;
    P.getWorkTimeEvidence = function (history, results, groupBy, machines, filter = {}) {
        const machineMap = new Map(machines.map(m => [m.id, m]));
        const displayed = new Set(results.filter(r => !r.isArchived).map(r => r.name));
        const hasArchived = results.some(r => r.isArchived);
        const rows = [], contributions = new Map(), excludedWorkers = [], unknownTimes = [];
        let total = 0, count = 0;
        for (const h of history) {
            const rawKeys = groupBy === 'category' ? [machineMap.get(h.machineId)?.category || h.machineCategory || 'その他'] : (h.workers || []).map(w => w.trim()).filter(Boolean);
            if (!rawKeys.length) excludedWorkers.push(h);
            if (!Number.isFinite(parseInt(h.workTime, 10)) || parseInt(h.workTime, 10) < 0) unknownTimes.push(h);
            const keys = rawKeys.filter(key => {
                const archived = groupBy === 'worker' && store.isWorkerArchived(key);
                return (archived ? hasArchived : displayed.has(key)) && (!filter.name || (filter.archived ? archived : key === filter.name));
            });
            if (!keys.length || (filter.type && this.getWorkTimeHistoryTypeKey(h) !== filter.type)) continue;
            const minutes = (parseInt(h.workTime, 10) || 0) * keys.length;
            total += minutes; count += keys.length; rows.push(h); contributions.set(h, minutes);
        }
        return { rows, contributions, total, count, excludedWorkers, unknownTimes };
    };
    P.renderWorkTimeEvidence = function (container, history, results, groupBy, machines) {
        this._workTimeEvidenceContext = { history, results, groupBy, machines };
        const data = this.getWorkTimeEvidence(history, results, groupBy, machines);
        const section = document.createElement('details'); section.className = 'worktime-evidence'; section.open = true;
        const summary = document.createElement('summary'); summary.textContent = '集計の根拠と計算方法'; section.append(summary);
        const note = document.createElement('p'); note.textContent = groupBy === 'worker'
            ? '作業者別は人数分を加算した延べ作業時間です。30分を2名で作業した記録は合計60分（各30分）になります。同じ作業者名が重複登録されている場合も登録数分を加算します。'
            : '装置区分別は各記録の作業時間を1回ずつ加算します。30分を2名で作業した記録も合計30分です。'; section.append(note);
        const definitions = document.createElement('p'); definitions.textContent = '件数は時間が未入力でも含みます。平均＝その種類の合計時間÷件数。割合の分母は検索前の全グループです。手順書として登録した履歴も現在の集計対象に含まれます。'; section.append(definitions);
        const add = (label, action) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary-btn'; b.textContent = label; b.onclick = action; section.append(b); };
        add(`表示合計 ${data.total.toLocaleString()} 分の根拠（${data.rows.length} 記録）`, () => this.openWorkTimeEvidence());
        if (groupBy === 'worker') add(`作業者未設定・集計対象外 ${data.excludedWorkers.length} 件`, () => this.openEvidenceRecords(data.excludedWorkers, '作業者未設定の記録'));
        add(`時間未入力・不正値 ${data.unknownTimes.length} 件`, () => this.openEvidenceRecords(data.unknownTimes, '時間の確認が必要な記録', { description: '同じ期間・ラインの記録です。未入力・数値でない値は0分、負の値は登録値のまま集計されます。元の記録から修正できます。' }));
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
