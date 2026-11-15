(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppCsvMethods extends MaintenanceApp {
    // --- CSV Export ---
    csvEscape(value) {
        return `"${String(value ?? '').replace(/"/g, '""')}"`;
    }

    parseCSV(text) {
        const rows = [];
        let row = [], current = '', state = 'start', line = 1, rowLine = 1;
        const fail = reason => {
            const error = new Error(`${rowLine}行目：${reason}`);
            error.importErrors = [{ row: rowLine, field: 'CSVの書式', value: current.slice(0, 160), reason }];
            throw error;
        };
        const append = () => {
            row.push(current); Object.defineProperty(row, 'sourceRow', { value: rowLine });
            if (row.some(value => value.trim())) rows.push(row);
            row = []; current = ''; state = 'start';
        };
        text = String(text).replace(/^\ufeff/, '');
        for (let i = 0; i < text.length; i++) {
            const char = text[i], next = text[i + 1];
            if (state === 'quoted') {
                if (char === '"') {
                    if (next === '"') { current += '"'; i++; } else state = 'closed';
                } else { current += char; if (char === '\n' || (char === '\r' && next !== '\n')) line++; }
            } else if (char === ',') {
                row.push(current); current = ''; state = 'start';
            } else if (char === '\r' || char === '\n') {
                if (char === '\r' && next === '\n') i++;
                append(); line++; rowLine = line;
            } else if (char === '"') {
                if (state !== 'start') fail('引用符はセルの先頭から囲んでください。');
                state = 'quoted';
            } else if (state === 'closed') {
                if (char !== ' ' && char !== '\t') fail('閉じた引用符の後に余分な文字があります。');
            } else { current += char; state = 'plain'; }
        }
        if (state === 'quoted') fail('引用符が閉じていません。セルの終わりの「"」を確認してください。');
        append(); return rows;
    }

    getCategoryLabel(category) {
        const labels = {
            machine: '機械',
            electric: '電気',
            adjust: '調整',
            parts: '部品',
            clean: '清掃',
            other: 'その他'
        };
        return labels[category] || 'その他';
    }

    getHistoryTypeInfo(h) {
        const key = this.getHistoryTypeKey(h);
        const types = {
            dokatei: ['ドカ停', 'var(--danger)', '#ef4444'], singleMaintenance: ['単発', '#0f766e', '#14b8a6'],
            periodic: ['定期', 'var(--primary)', '#3b82f6'], nonProductionStop: ['非停止', '#d97706', '#f59e0b'],
            sudden: ['突発', 'var(--success)', '#10b981'], guide: ['手順書', 'var(--text-light)', '#64748b']
        };
        const [label, color, chartColor] = types[key]; return { key, label, color, chartColor };
    }

    parseHistoryPartsText(partsText) {
        if (!partsText) return [];
        return String(partsText).split(/\s*(?:\/|／|;|；|\r?\n)\s*/).map(item => {
            const text = item.trim();
            if (!text) return null;
            const normalized = text.normalize('NFKC')
                .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                .replace(/[＠]/g, '@')
                .replace(/[ｘＸ×]/g, 'x')
                .replace(/[（]/g, '(')
                .replace(/[）]/g, ')')
                .replace(/\s+/g, ' ')
                .trim();
            const pricedMatch = normalized.match(/^(.*?)(?:\s+\[(.*?)\])?\s*x\s*([-+]?\d*\.?\d+)\s*([^\s@()]+)?\s*@\s*([-+]?\d*\.?\d+)$/i);
            if (pricedMatch) {
                return {
                    name: MaintenanceStore.toFullWidth(pricedMatch[1].trim()),
                    model: MaintenanceStore.toHalfWidthLower((pricedMatch[2] || '').trim()),
                    count: parseFloat(pricedMatch[3]) || 0,
                    unit: (pricedMatch[4] || '個').trim() || '個',
                    price: parseFloat(pricedMatch[5]) || 0
                };
            }
            const xMatch = normalized.match(/^(.*?)(?:\s+\[(.*?)\])?\s*x\s*([-+]?\d*\.?\d+)\s*([^\s@()]+)?$/i);
            if (xMatch) {
                return {
                    name: MaintenanceStore.toFullWidth(xMatch[1].trim()),
                    model: MaintenanceStore.toHalfWidthLower((xMatch[2] || '').trim()),
                    count: parseFloat(xMatch[3]) || 0,
                    unit: (xMatch[4] || '個').trim() || '個',
                    price: null
                };
            }
            const match = normalized.match(/^(.*?)(?:\s+\[(.*?)\])?\s*\(([-+]?\d*\.?\d+)\s*([^)]*)\)(?:\s*@\s*([-+]?\d*\.?\d+))?$/);
            if (!match) return { name: MaintenanceStore.toFullWidth(text), model: '', count: 0, unit: '個', price: null, ...(/\s[x×]\s*|@|\(\s*[-+0-9]/i.test(normalized) ? { _invalidFormat: text } : {}) };
            return {
                name: MaintenanceStore.toFullWidth(match[1].trim()),
                model: MaintenanceStore.toHalfWidthLower((match[2] || '').trim()),
                count: parseFloat(match[3]) || 0,
                unit: (match[4] || '個').trim() || '個',
                price: match[5] == null ? null : Number(match[5])
            };
        }).filter(Boolean);
    }

    parseImportedPartNumber(value, currency = false) {
        let raw = String(value ?? '').normalize('NFKC').trim();
        if (currency) raw = raw.replace(/^[¥￥]\s*/, '').replace(/\s*円$/, '');
        if (!/^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)$/.test(raw)) return NaN;
        const number = Number(raw.replace(/,/g, ''));
        return Number.isFinite(number) ? number : NaN;
    }

    normalizeImportedPartUnit(value, fallback = '個') {
        const raw = String(value || fallback || '個').normalize('NFKC').trim().toLowerCase();
        if (['g', 'グラム'].includes(raw)) return 'g';
        if (['kg', 'キログラム'].includes(raw)) return 'kg';
        if (['個', 'コ', 'pcs'].includes(raw)) return '個';
        return raw;
    }

    parseHistoryImportParts(partsText, partName, partCount, partUnit, partPrice, partsData = '') {
        const issues = [];
        const issue = (field, value, reason) => issues.push({ field, value, reason });
        const hasSplitInput = [partName, partCount, partUnit, partPrice].some(v => String(v ?? '').trim());
        let parts;
        if (String(partsData).trim()) {
            try {
                const payload = JSON.parse(partsData);
                if (payload?.version !== 1 || !Array.isArray(payload.parts)) throw Error('対応していない部品データです。');
                parts = payload.parts.map(part => {
                    if (!part || typeof part.name !== 'string' || !part.name.trim() || typeof part.model !== 'string'
                        || typeof part.count !== 'number' || !Number.isFinite(part.count) || part.count < 0
                        || (part.price !== null && (typeof part.price !== 'number' || !Number.isFinite(part.price) || part.price < 0))
                        || typeof part.unit !== 'string') throw Error('名前・型式・数量・単位・単価を確認してください。');
                    return { name: part.name, model: part.model, count: part.count, unit: part.unit, price: part.price };
                });
            } catch (error) { issue('交換部品データ', partsData, `再取込用の部品データが壊れています。${error.message}`); parts = []; }
        } else if (hasSplitInput) {
            const base = this.parseHistoryPartsText(partName)[0];
            if (!base?.name) { issue('部品名', partName, '数量・単価を指定した部品の名前を入力してください。'); parts = []; }
            else {
                const count = String(partCount ?? '').trim() ? this.parseImportedPartNumber(partCount) : base.count;
                const price = String(partPrice ?? '').trim() ? this.parseImportedPartNumber(partPrice, true) : base.price;
                if (!Number.isFinite(count) || count < 0) issue('部品数量', partCount, '0以上の数値を入力してください。単位は単位列に指定します。');
                if (price != null && (!Number.isFinite(price) || price < 0)) issue('部品単価', partPrice, '0以上の数値を入力してください。');
                parts = [{ ...base, count, price, unit: this.normalizeImportedPartUnit(partUnit, base.unit) }];
            }
        } else {
            parts = this.parseHistoryPartsText(partsText);
            parts.forEach((part, i) => {
                if (part._invalidFormat) issue(`部品${i + 1}の書式`, part._invalidFormat, '「部品名 x数量 単位 @単価」の形式を確認してください。');
                if (!Number.isFinite(part.count) || part.count < 0) issue(`部品${i + 1}の数量`, part.count, '0以上の数値を入力してください。');
                if (part.price != null && (!Number.isFinite(part.price) || part.price < 0)) issue(`部品${i + 1}の単価`, part.price, '0以上の数値を入力してください。');
            });
        }
        parts = parts.map(part => {
            if (part._invalidFormat && hasSplitInput) issue('部品の書式', part._invalidFormat, '部品名・数量・単価の形式を確認してください。');
            const unit = this.normalizeImportedPartUnit(part.unit);
            if (!['個', 'g', 'kg'].includes(unit)) issue('部品単位', unit, '個・g・kgのいずれかを指定してください。');
            const clean = { ...part, unit }; delete clean._invalidFormat;
            const normalized = this.normalizeHistoryPartMeasurement(clean);
            if ((Number.isFinite(part.count) && !Number.isFinite(normalized.count)) || (Number.isFinite(part.price) && !Number.isFinite(normalized.price))) issue('部品数量・単価', '', '単位換算後の数値が大きすぎます。');
            return normalized;
        });
        Object.defineProperty(parts, 'issues', { value: issues });
        return parts;
    }

    upsertImportedPartMasters(parts = []) {
        let added = 0;
        let updated = 0;
        parts.forEach(part => {
            const name = part?.name || '';
            const model = part?.model || '';
            if (!name) return;
            const price = parseFloat(part.price);
            const unit = part.unit || '個';
            const master = store.getPartMaster?.(name, model);
            if (!master) {
                store.updatePartMaster?.(name, model, {
                    name,
                    model,
                    price: Number.isFinite(price) && price >= 0 ? price : null,
                    priceRaw: Number.isFinite(price) && price >= 0 ? String(price) : '',
                    stock: 0,
                    minStock: 0,
                    supplier: '',
                    unit
                });
                added++;
            } else if ((master.price == null || String(master.price).trim() === '' || (master.price === 0 && master.priceRaw === '')) && Number.isFinite(price) && price >= 0) {
                const scale = value => value === 'kg' ? 1000 : value === 'g' ? 1 : null;
                const fromUnit = this.normalizeImportedPartUnit(unit), toUnit = this.normalizeImportedPartUnit(master.unit || unit);
                if (fromUnit !== toUnit && !(scale(fromUnit) && scale(toUnit))) return;
                const masterPrice = price * (scale(toUnit) || 1) / (scale(fromUnit) || 1);
                store.updatePartMaster?.(master.name || name, master.model || model, {
                    ...master,
                    price: masterPrice,
                    priceRaw: String(masterPrice),
                    unit: master.unit || unit
                });
                updated++;
            }
        });
        return { added, updated };
    }

    downloadCSV(filename, csvContent) {
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- CSV Import ---
    getHistoryImportLogs() {
        if (!store.activeData.historyImportLogs) store.activeData.historyImportLogs = [];
        return store.activeData.historyImportLogs;
    }

    renderHistoryImportLogsHtml() {
        const logs = this.getHistoryImportLogs().slice(0, 50);
        if (!logs.length) {
            return `
                <div class="history-import-log-panel empty">
                    <b><i class="fa-solid fa-clock-rotate-left"></i> 取り込みログ</b>
                    <p>まだCSV取り込みログはありません。</p>
                </div>
            `;
        }
        return `
            <div class="history-import-log-panel">
                <div class="history-import-log-head">
                    <b><i class="fa-solid fa-clock-rotate-left"></i> 最近の取り込みログ</b>
                    <button type="button" class="secondary-btn" onclick="app.clearHistoryImportLogs()" title="ログを消去">ログ消去</button>
                </div>
                <div class="history-import-log-list">
                    ${logs.map(log => `
                        <div class="history-import-log-item">
                            <div>
                                <strong>${this.escapeHtml(log.fileName || 'CSV取り込み')}</strong>
                                <span>${this.escapeHtml(this.formatHistoryImportLogTime(log.at))}</span>
                            </div>
                            <div class="history-import-log-stats">
                                <em class="added">追加 ${Number(log.added || 0).toLocaleString()}件</em>
                                <em>重複 ${Number(log.duplicates || 0).toLocaleString()}件</em>
                                <em>新規機械 ${Number(log.addedMachines || 0).toLocaleString()}件</em>
                                ${Number(log.addedPartMasters || 0) > 0 ? `<em>部品マスター追加 ${Number(log.addedPartMasters || 0).toLocaleString()}件</em>` : ''}
                                ${Number(log.updatedPartMasters || 0) > 0 ? `<em>単価補完 ${Number(log.updatedPartMasters || 0).toLocaleString()}件</em>` : ''}
                                <em>初回 ${Number(log.firstTime || 0).toLocaleString()}件</em>
                                <em>再発 ${Number(log.recurrence || 0).toLocaleString()}件</em>
                                ${Number(log.skipped || 0) > 0 ? `<em>未取込 ${Number(log.skipped || 0).toLocaleString()}件</em>` : ''}
                            </div>
                            ${log.undo?.version === 1 ? `<button type="button" class="secondary-btn" onclick="app.openHistoryImportUndo('${this.escapeJs(log.id)}')">対象を確認・取り消す</button>${log.cancelledRecordIds?.length ? `<small>取消済み ${log.cancelledRecordIds.length}件</small>` : ''}` : '<small>このログは取消機能追加前の取り込みです。</small>'}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    formatHistoryImportLogTime(value) {
        const date = value ? new Date(value) : null;
        if (!date || isNaN(date.getTime())) return '';
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    appendHistoryImportLog(log) {
        const logs = this.getHistoryImportLogs();
        logs.unshift({
            id: store.generateId ? store.generateId() : String(Date.now()),
            at: new Date().toISOString(),
            ...log
        });
        store.activeData.historyImportLogs = logs.slice(0, 50);
    }

    async addHistoryImportLog(log) {
        this.appendHistoryImportLog(log);
        await store.save();
    }

    async clearHistoryImportLogs() {
        if (!confirm('CSV取り込みログを消去しますか？取り込み単位の取消もできなくなります。履歴は削除されません。')) return;
        await store.runAtomicSaveBatch(() => { store.activeData.historyImportLogs = []; });
        this.openHistoryImportModal();
    }

    openHistoryImportModal() {
        this.openModal('history-import', '過去履歴のExcel/CSV一括取込', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="history-import-intro" style="margin-bottom:20px; font-size:0.85rem; color:var(--text-main); line-height:1.6;">
                    <p>Excelテンプレート（.xlsx）またはCSVで作成した過去のメンテナンス記録を一括で取り込みます。</p>
                    <p style="margin-top:8px; padding:10px; background:#eff6ff; border-radius:6px; border:1px solid #bae6fd;">
                        1. まず下記のボタンから専用の「テンプレート(CSV)」をダウンロードしてください。<br>
                        2. マクロ無しExcelテンプレート（.xlsx）を使う場合は、そのまま保存して取り込めます。<br>
                        3. 「ファイルを選択」から保存した .xlsx または .csv を読み込ませてください。
                    </p>
                    <div class="history-import-template-actions" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
                        <a class="secondary-btn" style="padding:6px 16px; font-size:0.8rem; text-decoration:none;" href="CSV/history_import_template_input.xlsx" download="history_import_template_入力用.xlsx">
                            <i class="fa-solid fa-file-excel"></i> マクロ無しExcelテンプレート
                        </a>
                        <button class="secondary-btn" style="padding:6px 16px; font-size:0.8rem;" onclick="app.downloadHistoryImportTemplate()">
                            <i class="fa-solid fa-download"></i> テンプレート(CSV)
                        </button>
                    </div>
                </div>
                <div class="form-group history-import-file-picker" style="border-top:1px dashed var(--border); padding-top:20px;">
                    <label style="font-weight:800; color:var(--primary);">Excel / CSVファイルを選択</label>
                    <input type="file" id="hist-csv-upload" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="margin-top:8px; display:block;">
                </div>
                <label class="history-import-encoding">CSVの文字コード
                    <select id="hist-csv-encoding"><option value="auto">自動判定</option><option value="utf-8">UTF-8</option><option value="shift_jis">Shift_JIS（WindowsのCSV）</option></select>
                </label>
                <div id="hist-csv-preview" aria-live="polite"></div>
                ${this.renderHistoryImportLogsHtml()}
            `;
            const footer = document.querySelector('.modal-footer');
            footer.innerHTML = `
                <button class="secondary-btn" id="modal-cancel">キャンセル</button>
                <button class="primary-btn" onclick="app.processHistoryImportCSV()"><i class="fa-solid fa-cloud-arrow-up"></i> 取り込む</button>
            `;
            document.getElementById('modal-cancel').onclick = () => this.closeModal();
            this._historyImportPrepared = null;
            document.getElementById('hist-csv-upload').onchange = () => this.refreshHistoryImportPreview();
            document.getElementById('hist-csv-encoding').onchange = () => this.refreshHistoryImportPreview();
        });
    }

    downloadHistoryImportTemplate() {
        const headers = this.getHistoryImportCsvHeaders();
        const sampleRows = [
            ["2024-03-01", "5号ライン", "メインコンベア", "MC-100", "突発", "初回", "ベルトの異音", "経年劣化", "ベルトを調整", "E-01", "30", "機械", "山田, 鈴木", "ベルト", "1", "個", "1200"],
            ["2024-03-05", "その他", "サブコンベア", "SC-50", "非生産停止", "再発", "センサー警告", "汚れ", "清掃・動作確認", "", "15", "清掃", "田中", "オイル x50 g @8", "", "", ""]
        ];
        const csvContent = [headers.join(','), ...sampleRows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
        this.downloadCSV(`template_history_import.csv`, csvContent);
    }

    getHistoryImportCsvHeaders() {
        return ["日付(YYYY-MM-DD)", "ライン", "機械名", "型式", "対応種別(突発/非生産停止/定期/ドカ停)", "初回/再発", "作業内容(症状)", "原因", "処置内容(備考)", "エラー番号", "作業時間(分)", "作業区分(機械/電気/調整/部品/清掃/その他)", "作業者(カンマ区切り)", "部品名", "部品数量", "部品単位(個/g)", "部品単価"];
    }

    openHistoryCsvBuilder() {
        const machines = store.getMachines(true);
        const workers = store.getWorkers ? store.getWorkers().filter(w => !store.isWorkerArchived?.(w)) : [];
        const today = this.getLocalDateString();
        const machineOptions = machines.map(m => {
            const label = `${m.name || ''}${m.model ? ` [${m.model}]` : ''}`;
            return `<option value="${this.escapeHtml(label)}" data-name="${this.escapeHtml(m.name || '')}" data-model="${this.escapeHtml(m.model || '')}" data-line="${this.escapeHtml(m.lineNo || '')}"></option>`;
        }).join('');
        const workerOptions = workers.map(w => `<option value="${this.escapeHtml(w)}"></option>`).join('');

        this.openModal('history-csv-builder', 'メンテナンス履歴CSV作成', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="history-csv-builder">
                    <div class="history-csv-builder-head">
                        <div>
                            <b><i class="fa-solid fa-file-csv"></i> 取込用CSVをここで作成</b>
                            <span>入力した内容を「一括取込(CSV)」で読める形式にして出力します。</span>
                        </div>
                        <button type="button" class="secondary-btn" onclick="app.addHistoryCsvBuilderRow()">
                            <i class="fa-solid fa-plus"></i> 行を追加
                        </button>
                    </div>
                    <datalist id="history-csv-machine-options">${machineOptions}</datalist>
                    <datalist id="history-csv-worker-options">${workerOptions}</datalist>
                    <div class="history-csv-builder-table-wrap">
                        <table class="history-csv-builder-table">
                            <thead>
                                <tr>
                                    <th>日付</th>
                                    <th>ライン</th>
                                    <th>機械名</th>
                                    <th>型式</th>
                                    <th>対応種別</th>
                                    <th>初回/再発</th>
                                    <th>作業内容</th>
                                    <th>原因</th>
                                    <th>処置</th>
                                    <th>エラー</th>
                                    <th>分</th>
                                    <th>作業区分</th>
                                    <th>作業者</th>
                                    <th>部品名</th>
                                    <th>数量</th>
                                    <th>単位</th>
                                    <th>単価</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="history-csv-builder-body"></tbody>
                        </table>
                    </div>
                    <div class="history-csv-builder-note">
                        <span><i class="fa-solid fa-circle-info"></i> 機械名は候補から選ぶと型式とラインを自動入力します。</span>
                        <span>作業者は「山田、田中」のようにカンマ・読点で区切って複数入力できます。</span>
                    </div>
                </div>
            `;
            const footer = document.querySelector('.modal-footer');
            footer.innerHTML = `
                <button class="secondary-btn" id="modal-cancel">閉じる</button>
                <button class="secondary-btn" onclick="app.fillHistoryCsvBuilderSample()"><i class="fa-solid fa-wand-magic-sparkles"></i> サンプル入力</button>
                <button class="primary-btn" onclick="app.downloadHistoryCsvBuilder()"><i class="fa-solid fa-download"></i> CSV出力</button>
            `;
            document.getElementById('modal-cancel').onclick = () => this.closeModal();
            this.addHistoryCsvBuilderRow({ date: today });
        });
    }

    addHistoryCsvBuilderRow(values = {}) {
        const body = document.getElementById('history-csv-builder-body');
        if (!body) return;
        const row = document.createElement('tr');
        row.className = 'history-csv-builder-row';
        row.innerHTML = this.renderHistoryCsvBuilderRow(values);
        body.appendChild(row);
    }

    renderHistoryCsvBuilderRow(values = {}) {
        const e = (v) => this.escapeHtml(v ?? '');
        return `
            <td><input type="date" data-field="date" value="${e(values.date)}"></td>
            <td>
                <select data-field="line">
                    <option value="" ${!values.line ? 'selected' : ''}>未指定</option>
                    ${Array.from({ length: 10 }, (_, i) => {
                        const n = String(i + 1);
                        return `<option value="${n}" ${String(values.line || '') === n ? 'selected' : ''}>${n}号ライン</option>`;
                    }).join('')}
                    <option value="other" ${values.line === 'other' ? 'selected' : ''}>その他</option>
                </select>
            </td>
            <td><input type="text" data-field="machine" list="history-csv-machine-options" value="${e(values.machine)}" placeholder="機械名" onchange="app.applyHistoryCsvMachineSuggestion(this)"></td>
            <td><input type="text" data-field="model" value="${e(values.model)}" placeholder="型式"></td>
            <td>
                <select data-field="type">
                    ${['突発', '非生産停止', '定期', 'ドカ停'].map(type => `<option value="${type}" ${values.type === type ? 'selected' : ''}>${type}</option>`).join('')}
                </select>
            </td>
            <td>
                <select data-field="occurrence">
                    ${['初回', '再発'].map(item => `<option value="${item}" ${values.occurrence === item ? 'selected' : ''}>${item}</option>`).join('')}
                </select>
            </td>
            <td><textarea data-field="content" rows="2" placeholder="症状・作業内容">${e(values.content)}</textarea></td>
            <td><textarea data-field="cause" rows="2" placeholder="原因">${e(values.cause)}</textarea></td>
            <td><textarea data-field="notes" rows="2" placeholder="処置内容">${e(values.notes)}</textarea></td>
            <td><input type="text" data-field="errorNo" value="${e(values.errorNo)}" placeholder="E-01"></td>
            <td><input type="number" data-field="time" min="0" step="1" value="${e(values.time)}" placeholder="30"></td>
            <td>
                <select data-field="category">
                    ${['機械', '電気', '調整', '部品', '清掃', 'その他'].map(cat => `<option value="${cat}" ${values.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                </select>
            </td>
            <td><input type="text" data-field="workers" list="history-csv-worker-options" value="${e(values.workers)}" placeholder="山田, 田中"></td>
            <td><input type="text" data-field="partName" value="${e(values.partName || values.parts)}" placeholder="ベルト"></td>
            <td><input type="number" data-field="partCount" min="0" step="0.1" value="${e(values.partCount)}" placeholder="1"></td>
            <td>
                <select data-field="partUnit">
                    ${['個', 'g'].map(unit => `<option value="${unit}" ${(values.partUnit || '個') === unit ? 'selected' : ''}>${unit}</option>`).join('')}
                </select>
            </td>
            <td><input type="number" data-field="partPrice" min="0" step="1" value="${e(values.partPrice)}" placeholder="1200"></td>
            <td><button type="button" class="icon-btn history-csv-row-delete" title="行を削除" onclick="app.deleteHistoryCsvBuilderRow(this)"><i class="fa-solid fa-trash"></i></button></td>
        `;
    }

    applyHistoryCsvMachineSuggestion(input) {
        const row = input.closest('tr');
        const option = Array.from(document.querySelectorAll('#history-csv-machine-options option')).find(opt => opt.value === input.value);
        if (!row || !option) return;
        const name = option.dataset.name || input.value;
        const model = option.dataset.model || '';
        const line = option.dataset.line || '';
        row.querySelector('[data-field="machine"]').value = name;
        row.querySelector('[data-field="model"]').value = model;
        if (line) {
            const lineSelect = row.querySelector('[data-field="line"]');
            if (lineSelect && Array.from(lineSelect.options).some(opt => opt.value === line)) lineSelect.value = line;
        }
    }

    deleteHistoryCsvBuilderRow(button) {
        const body = document.getElementById('history-csv-builder-body');
        const row = button.closest('tr');
        if (!body || !row) return;
        if (body.children.length <= 1) {
            row.querySelectorAll('input, textarea').forEach(el => { el.value = ''; });
            row.querySelectorAll('select').forEach(el => { el.selectedIndex = 0; });
            return;
        }
        row.remove();
    }

    fillHistoryCsvBuilderSample() {
        const body = document.getElementById('history-csv-builder-body');
        if (!body) return;
        body.innerHTML = '';
        this.addHistoryCsvBuilderRow({
            date: this.getLocalDateString(),
            line: '5',
            machine: 'メインコンベア',
            model: 'MC-100',
            type: '突発',
            occurrence: '初回',
            content: 'ベルトの異音',
            cause: '経年劣化',
            notes: 'ベルトを調整',
            errorNo: 'E-01',
            time: '30',
            category: '機械',
            workers: '山田, 鈴木',
            partName: 'ベルト',
            partCount: '1',
            partUnit: '個',
            partPrice: '1200'
        });
    }

    getHistoryCsvBuilderRows() {
        const rows = Array.from(document.querySelectorAll('#history-csv-builder-body tr'));
        return rows.map(row => {
            const get = (field) => row.querySelector(`[data-field="${field}"]`)?.value?.trim() || '';
            return [
                get('date'),
                get('line') === 'other' ? 'その他' : (get('line') ? `${get('line')}号ライン` : ''),
                get('machine'),
                get('model'),
                get('type') || '突発',
                get('occurrence') || '初回',
                get('content'),
                get('cause'),
                get('notes'),
                get('errorNo'),
                get('time'),
                get('category') || 'その他',
                get('workers'),
                get('partName'),
                get('partCount'),
                get('partUnit') || '個',
                get('partPrice')
            ];
        }).filter(row => row.some(cell => cell));
    }

    downloadHistoryCsvBuilder() {
        const rows = this.getHistoryCsvBuilderRows();
        if (!rows.length) return alert('出力する行がありません。');
        const invalid = rows.findIndex(row => !row[0] || !row[2] || !row[5]);
        if (invalid >= 0) {
            return alert(`${invalid + 1}行目は「日付・機械名・作業内容」を入力してください。`);
        }
        const headers = this.getHistoryImportCsvHeaders();
        const csvContent = [
            headers.map(h => this.csvEscape(h)).join(','),
            ...rows.map(row => row.map(value => this.csvEscape(value)).join(','))
        ].join('\n');
        this.downloadCSV(`history_import_${this.getLocalDateString()}.csv`, csvContent);
        this.showToast?.('取込用CSVを出力しました', 'success');
    }

    async inflateZipEntry(data, method) {
        if (method === 0) return data;
        if (method !== 8) throw new Error('対応していないExcel圧縮形式です。');
        if (typeof DecompressionStream === 'undefined') {
            throw new Error('このブラウザではExcelファイルの展開に対応していません。CSVで保存して取り込んでください。');
        }
        const tryInflate = async (format) => {
            const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream(format));
            return new Uint8Array(await new Response(stream).arrayBuffer());
        };
        try {
            return await tryInflate('deflate-raw');
        } catch (err) {
            return await tryInflate('deflate');
        }
    }

    async readXlsxZipEntries(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(arrayBuffer);
        const textDecoder = new TextDecoder('utf-8');
        let eocd = -1;
        for (let i = bytes.length - 22; i >= 0; i--) {
            if (view.getUint32(i, true) === 0x06054b50) {
                eocd = i;
                break;
            }
        }
        if (eocd < 0) throw new Error('Excelファイルの形式を読み取れませんでした。');
        const entryCount = view.getUint16(eocd + 10, true);
        const centralOffset = view.getUint32(eocd + 16, true);
        const entries = {};
        let offset = centralOffset;
        for (let i = 0; i < entryCount; i++) {
            if (view.getUint32(offset, true) !== 0x02014b50) break;
            const method = view.getUint16(offset + 10, true);
            const compressedSize = view.getUint32(offset + 20, true);
            const nameLen = view.getUint16(offset + 28, true);
            const extraLen = view.getUint16(offset + 30, true);
            const commentLen = view.getUint16(offset + 32, true);
            const localOffset = view.getUint32(offset + 42, true);
            const name = textDecoder.decode(bytes.slice(offset + 46, offset + 46 + nameLen)).replace(/\\/g, '/');
            if (view.getUint32(localOffset, true) !== 0x04034b50) {
                offset += 46 + nameLen + extraLen + commentLen;
                continue;
            }
            const localNameLen = view.getUint16(localOffset + 26, true);
            const localExtraLen = view.getUint16(localOffset + 28, true);
            const dataStart = localOffset + 30 + localNameLen + localExtraLen;
            const compressed = bytes.slice(dataStart, dataStart + compressedSize);
            entries[name] = await this.inflateZipEntry(compressed, method);
            offset += 46 + nameLen + extraLen + commentLen;
        }
        return entries;
    }

    getXlsxEntryText(entries, path) {
        const entry = entries[path] || entries[path.replace(/\//g, '\\')];
        if (!entry) return '';
        return new TextDecoder('utf-8').decode(entry);
    }

    xmlTextContent(node) {
        return Array.from(node.getElementsByTagName('t')).map(t => t.textContent || '').join('');
    }

    parseXlsxCellRef(ref) {
        const match = String(ref || '').match(/^([A-Z]+)(\d+)$/i);
        if (!match) return { col: 0, row: 0 };
        const letters = match[1].toUpperCase();
        let col = 0;
        for (const ch of letters) col = col * 26 + ch.charCodeAt(0) - 64;
        return { col: col - 1, row: parseInt(match[2], 10) };
    }

    excelSerialToDate(value, date1904 = false) {
        const serial = Math.floor(Number(value));
        if (!Number.isFinite(serial) || serial < (date1904 ? 0 : 1) || (!date1904 && serial === 60)) return String(value ?? '');
        const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
        const days = date1904 ? serial : serial - (serial > 60 ? 1 : 0);
        const date = new Date(base + days * 86400000);
        if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999) return String(value ?? '');
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    }

    normalizeXlsxImportRows(rows, mapping = null) {
        if (!mapping) { try { mapping = this.detectHistoryImportColumns(rows); } catch { return rows; } }
        const { headerRowIndex, indexMap } = mapping, dateIndex = indexMap.date;
        if (dateIndex < 0) return rows;
        return rows.map((row, index) => {
            if (index <= headerRowIndex) return row;
            const next = row.slice(), raw = String(next[dateIndex] ?? '').normalize('NFKC').trim();
            next[dateIndex] = /^\d+(?:\.\d+)?$/.test(raw) ? this.excelSerialToDate(raw, !!rows.excelDate1904) : raw;
            if (row.sourceRow) Object.defineProperty(next, 'sourceRow', { value: row.sourceRow });
            return next;
        });
    }

    async parseHistoryImportWorkbook(arrayBuffer) {
        const entries = await this.readXlsxZipEntries(arrayBuffer);
        const sharedXml = this.getXlsxEntryText(entries, 'xl/sharedStrings.xml');
        const sharedStrings = [];
        if (sharedXml) {
            const sharedDoc = new DOMParser().parseFromString(sharedXml, 'application/xml');
            Array.from(sharedDoc.getElementsByTagName('si')).forEach(si => sharedStrings.push(this.xmlTextContent(si)));
        }
        const workbookXml = this.getXlsxEntryText(entries, 'xl/workbook.xml');
        const workbookDoc = new DOMParser().parseFromString(workbookXml || '<workbook/>', 'application/xml');
        const relations = new DOMParser().parseFromString(this.getXlsxEntryText(entries, 'xl/_rels/workbook.xml.rels') || '<Relationships/>', 'application/xml');
        const paths = new Map(Array.from(relations.getElementsByTagName('Relationship')).filter(r => r.getAttribute('TargetMode') !== 'External').map(r => {
            const target = (r.getAttribute('Target') || '').replace(/\\/g, '/');
            const segments = (target.startsWith('/') ? target.slice(1) : 'xl/' + target).split('/'), resolved = [];
            for (const segment of segments) { if (segment === '..') resolved.pop(); else if (segment && segment !== '.') resolved.push(segment); }
            return [r.getAttribute('Id'), resolved.join('/')];
        }));
        const flag = workbookDoc.getElementsByTagName('workbookPr')[0]?.getAttribute('date1904');
        let sheets = Array.from(workbookDoc.getElementsByTagName('sheet')).map(sheet => ({
            name: sheet.getAttribute('name') || '名前のないシート', key: paths.get(sheet.getAttribute('r:id')),
            hidden: sheet.getAttribute('state') === 'hidden' || sheet.getAttribute('state') === 'veryHidden'
        })).filter(sheet => sheet.key && entries[sheet.key] && /\.xml$/i.test(sheet.key));
        // Older simple workbooks may omit the workbook relationships.
        if (!sheets.length) sheets = Object.keys(entries).filter(name => /^xl\/worksheets\/[^/]+\.xml$/i.test(name)).map((key, i) => ({ key, name: `シート${i + 1}` }));
        if (!sheets.length) throw new Error('Excel内の入力シートが見つかりませんでした。');
        for (const sheet of sheets) {
            const sheetDoc = new DOMParser().parseFromString(this.getXlsxEntryText(entries, sheet.key), 'application/xml');
            if (sheetDoc.getElementsByTagName('parsererror').length) throw Error(`シート「${sheet.name}」の書式を読み取れません。`);
            const rows = Array.from(sheetDoc.getElementsByTagName('row')).map(rowEl => {
                const row = [];
                Array.from(rowEl.getElementsByTagName('c')).forEach(cell => {
                    const { col } = this.parseXlsxCellRef(cell.getAttribute('r'));
                    const type = cell.getAttribute('t');
                    let value = cell.getElementsByTagName('v')[0]?.textContent || '';
                    if (type === 's') value = sharedStrings[parseInt(value, 10)] || '';
                    else if (type === 'inlineStr') value = this.xmlTextContent(cell);
                    else if (type === 'b') value = value === '1' ? 'TRUE' : 'FALSE';
                    row[col] = value;
                });
                const normalized = Array.from(row, value => value ?? '');
                Object.defineProperty(normalized, 'sourceRow', { value: Number(rowEl.getAttribute('r')) || 0 });
                return normalized;
            }).filter(row => row.some(col => String(col).trim() !== ''));
            Object.defineProperty(rows, 'excelDate1904', { value: flag === '1' || flag === 'true' });
            sheet.rows = rows;
            try {
                const mapping = this.detectHistoryImportColumns(rows);
                sheet.score = ['date', 'machine', 'content'].filter(key => mapping.indexMap[key] !== -1).length * 100
                    + Object.values(mapping.indexMap).filter(index => index >= 0).length;
            } catch { sheet.score = 0; }
        }
        const selected = [...sheets].sort((a, b) => b.score - a.score || Number(!!a.hidden) - Number(!!b.hidden))[0];
        Object.defineProperties(selected.rows, { workbookSheets: { value: sheets }, sheetKey: { value: selected.key } });
        return selected.rows;
    }

    async processHistoryImportCSV() {
        if (this._historyImportReading || document.querySelector?.('.history-import-review[open]')) return;
        const fileInput = document.getElementById('hist-csv-upload');
        if (!fileInput.files.length) return alert("ExcelまたはCSVファイルを選択してください。");
        const file = fileInput.files[0];

        this._historyImportReading = true;
        try {
            const prepared = await this.prepareHistoryImportFile();
            if (!prepared) return;
            const { headerRowIndex, indexMap } = prepared;
            const rows = prepared.excel ? this.normalizeXlsxImportRows(prepared.rows, prepared) : prepared.rows;
            const columnErrors = [...this.getHistoryImportColumnErrors(prepared), ...this.getHistoryImportRowShapeErrors(prepared)];
            if (columnErrors.length) { this.openHistoryImportErrors(columnErrors); return; }
            const getCol = (cols, key) => {
                const index = indexMap[key];
                return index >= 0 ? String(cols[index] || '').trim() : '';
            };
            const normalizeLineNo = (value) => {
                const raw = String(value || '').normalize('NFKC').trim();
                if (!raw) return '';
                if (raw === 'その他' || raw === '他' || raw.toLowerCase() === 'other') return 'other';
                const match = raw.match(/\d+/);
                return match ? match[0] : '';
            };
            const normalizeImportedWorkerName = (value) => {
                let name = String(value || '').trim();
                if (!name) return '';
                name = name.replace(/[（(]\s*(?:フリガナ|ふりがな|ﾌﾘｶﾞﾅ|[ァ-ヶーｦ-ﾟA-Za-z\s.\-]+)\s*[）)]$/u, '').trim();
                name = name.replace(/\s*[（(]\s*[）)]\s*$/u, '').trim();
                return name;
            };

            const entries = [];
            const machines = store.getMachines(true).map(machine => ({ ...machine }));
            const newMachines = [];
            let candidateRowCount = 0;
            let skippedInvalidRows = 0;
            const errors = [];

            for (let i = headerRowIndex + 1; i < rows.length; i++) {
                const cols = rows[i];
                if (!cols.some(col => String(col).trim() !== '')) continue;
                candidateRowCount++;
                const rawDate = getCol(cols, 'date');
                const date = this.normalizeHistoryImportDate(rawDate);
                const sourceRow = cols.sourceRow || i + 1, errorCount = errors.length;
                if (!date) errors.push({ row: sourceRow, field: '日付', value: rawDate, reason: rawDate ? '年・月・日と実在する日付を確認してください。' : '日付を入力してください。' });
                const lineNo = normalizeLineNo(getCol(cols, 'line'));
                const mName = getCol(cols, 'machine');
                const mModel = getCol(cols, 'model');
                const occType = getCol(cols, 'type');
                const occurrenceText = getCol(cols, 'occurrence');
                const content = getCol(cols, 'content');
                const cause = getCol(cols, 'cause');
                const notes = getCol(cols, 'notes');
                const errorNo = getCol(cols, 'errorNo');
                const time = getCol(cols, 'time');
                if (time && (!/^\d+(?:\.\d+)?$/.test(time) || !Number.isFinite(Number(time)))) {
                    errors.push({ row: sourceRow, field: '作業時間', value: time, reason: '0以上の数値（小数可）を入力してください。' });
                }
                const categoryName = getCol(cols, 'category');
                const workersStr = getCol(cols, 'workers');
                const partsStr = getCol(cols, 'parts');
                const partNameStr = getCol(cols, 'partName');
                const partCountStr = getCol(cols, 'partCount');
                const partUnitStr = getCol(cols, 'partUnit');
                const partPriceStr = getCol(cols, 'partPrice');
                if (!mName) errors.push({ row: sourceRow, field: '機械名', value: mName, reason: '機械名を入力してください。' });
                if (!content) errors.push({ row: sourceRow, field: '作業内容', value: content, reason: '作業内容を入力してください。' });
                const replacedParts = this.parseHistoryImportParts(partsStr, partNameStr, partCountStr, partUnitStr, partPriceStr, getCol(cols, 'partsData'));
                for (const issue of replacedParts.issues || []) errors.push({ row: sourceRow, ...issue });
                if (errors.length > errorCount) continue;

                const candidates = this.getHistoryImportMachineCandidates(mName, mModel, lineNo, machines);
                let provisional = newMachines.find(m => MaintenanceStore.toHalfWidthLower(m.name).trim() === MaintenanceStore.toHalfWidthLower(mName).trim() && MaintenanceStore.toHalfWidthLower(m.model).trim() === MaintenanceStore.toHalfWidthLower(mModel).trim() && m.lineNo === lineNo);
                if (!provisional) {
                    provisional = { id: store.generateId(), name: mName, model: mModel, lineNo,
                        remarks: 'CSV取込で自動登録', photo: '', category: '', manufacturer: '', deleted: false, createdAt: Date.now() };
                    newMachines.push(provisional);
                }
                const targetMachine = candidates.length === 1 && (!lineNo || candidates[0].lineNo) ? candidates[0] : candidates.length === 0 ? provisional : null;

                const isPeriodic = occType.includes('定期');
                const isSingleMaintenance = occType.includes('単発');
                let isSudden = !isPeriodic && !isSingleMaintenance;
                let isDokatei = false;
                const isNonProductionStop = occType.includes("非生産停止") || occType.includes("非停止");
                if (occType.includes("突発") || isNonProductionStop) isSudden = true;
                if (occType.includes("ドカ停")) { isSudden = true; isDokatei = true; }
                const isFirstTime = !String(occurrenceText || '').includes('再発');

                const catMap = { '機械': 'machine', '電気': 'electric', '調整': 'adjust', '部品': 'parts', '清掃': 'clean', 'その他': 'other' };
                let category = 'other';
                for (const [k, v] of Object.entries(catMap)) {
                    if (categoryName.includes(k)) { category = v; break; }
                }

                const workers = this.splitWorkerText(this.splitWorkerText(workersStr).map(normalizeImportedWorkerName));
                const record = {
                    id: store.generateId(),
                    machineId: targetMachine?.id || '',
                    date,
                    workTime: time === '' ? null : Number(time),
                    historyType: isPeriodic ? 'periodic' : isSingleMaintenance ? 'singleMaintenance' : 'sudden',
                    isSingleMaintenance,
                    isSudden,
                    isDokatei,
                    isNonProductionStop: !isDokatei && isNonProductionStop,
                    errorNo: errorNo || '',
                    errorContent: content || '',
                    cause: cause || '',
                    notes: notes || '',
                    category,
                    machineCategory: targetMachine?.category || '',
                    lineNo: lineNo || targetMachine?.lineNo || '',
                    isFirstTime,
                    workers,
                    replacedParts,
                    photos: [],
                    createdAt: new Date().toISOString()
                };

                if (!isSudden) {
                    record.taskContent = content || '定期点検(CSV)';
                    delete record.errorContent;
                }

                entries.push({ record, candidates, provisional, lineNo, machineName: mName, sourceRow: cols.sourceRow || i + 1, decision: null });
            }

            if (errors.length) { this.openHistoryImportErrors(errors); return; }
            if (!entries.length) return alert('取り込めるデータがありませんでした。');
            const plan = { entries, newMachines, fileName: file.name || 'CSV取り込み', totalRows: candidateRowCount,
                skipped: skippedInvalidRows, department: store.data?.currentDepartmentId, snapshot: this.getHistoryImportSnapshot() };
            this.assessHistoryImportPlan(plan);
            if (entries.some(entry => !entry.record.machineId || entry.duplicates.length)) {
                this.openHistoryImportReview(plan);
                return;
            }
            const usedIds = new Set(entries.map(e => e.record.machineId));
            const newCount = newMachines.filter(m => usedIds.has(m.id)).length;
            if (confirm(`${entries.length}件の履歴（うち新規機械登録: ${newCount}件）を取り込みます。よろしいですか？`)) {
                await this.commitHistoryImportPlan(plan);
            }
        } catch (err) {
            console.error('History import failed', err);
            if (err.importErrors) this.openHistoryImportErrors(err.importErrors);
            else alert(`取り込みに失敗しました。変更は保存されていません。\n${err.message || err}`);
        } finally {
            this._historyImportReading = false;
        }
    }

    exportHistoryAsCSV() {
        const { filtered: history } = this.getFilteredHistoryContext(this._historyRenderedQuery);
        const headers = ["日付", "ライン", "機械名", "型式", "対応種別", "初回/再発", "作業内容(症状)", "原因", "処置内容(備考)", "エラー番号", "作業時間(分)", "作業区分", "作業者", "交換部品", "交換部品データ"];
        const rows = history.map(h => {
            const m = store.getMachines(true).find(x => x.id === h.machineId);
            const mName = m ? m.name : '不明';
            const mModel = m ? m.model : '';
            const lineLabel = this.getLineLabel(h.lineNo || m?.lineNo || '');
            const typeInfo = this.getHistoryTypeInfo(h);
            const typeLabel = typeInfo.key === 'nonProductionStop' ? '非生産停止' : typeInfo.label;
            const displayText = this.getHistoryDisplayText(h);
            const workers = this.splitWorkerText(h.workers).join(', ');
            const parts = (h.replacedParts || []).map(p => {
                const count = p.count ?? p.qty ?? 0;
                const unit = p.unit || '個';
                const model = p.model ? ` [${p.model}]` : '';
                const price = parseFloat(p.price);
                return `${p.name || ''}${model} x${count} ${unit}${Number.isFinite(price) && price >= 0 ? ` @${price}` : ''}`;
            }).join(' / ');

            return [
                h.date,
                lineLabel,
                mName,
                mModel,
                typeLabel,
                h.isFirstTime === false ? '再発' : '初回',
                displayText,
                h.cause || '',
                (h.notes || '').replace(/\r?\n/g, ' '),
                h.errorNo || '',
                h.workTime ?? '',
                this.getCategoryLabel(h.category),
                workers,
                parts,
                JSON.stringify({ version: 1, parts: (h.replacedParts || []).map(p => ({
                    name: p.name || '', model: p.model || '', count: Number(p.count ?? p.qty ?? 0), unit: p.unit || '個',
                    price: p.price == null || String(p.price).trim() === '' ? null : Number(p.price)
                })) })
            ].map(v => this.csvEscape(v)).join(',');
        });

        const csvContent = [headers.map(h => this.csvEscape(h)).join(','), ...rows].join('\n');
        this.downloadCSV(`maintenance_history_${this.getLocalDateString()}.csv`, csvContent);
    }

    exportWorkTimeAsCSV() {
        // Export the displayed aggregation so line/search/group filters and legacy-data rules agree.
        this.renderWorkTime();
        const period = document.getElementById('worktime-filter-period')?.value || 'this_month';
        const context = this._workTimeEvidenceContext;
        if (!context) return;
        const headers = [context.groupBy === 'category' ? '装置区分' : '作業者', '合計時間(分)', '全体割合(%)', '定期メンテ時間', '定期件数', '突発対応時間', '突発件数', '非生産停止時間', '非生産停止件数', 'ドカ停時間', 'ドカ停件数'];
        const rows = context.results.map(s => [s.name, s.totalTime, s.pct, s.pt, s.pc, s.st, s.sc, s.np, s.npc, s.dt, s.dc].map(v => this.csvEscape(v)).join(','));
        const csvContent = [headers.map(v => this.csvEscape(v)).join(','), ...rows].join('\n');
        this.downloadCSV(`worktime_analysis_${period}_${this.getLocalDateString()}.csv`, csvContent);
    }

    exportSkillMapAsCSV() {
        const history = store.getHistory({});
        const machines = store.getMachines(true);
        const workerSet = new Set();
        history.forEach(h => {
            (h.workers || []).forEach(w => { if (typeof w === 'string') workerSet.add(w.trim()); });
        });
        const workers = Array.from(workerSet).filter(Boolean).filter(w => !store.isWorkerArchived(w)).sort();
        const skillEvals = JSON.parse(localStorage.getItem('skillEvaluations') || '{}');
        const manualSkills = JSON.parse(localStorage.getItem('manualSkills') || '[]');
        
        const allTaskMap = {};
        history.forEach(h => {
            const m = machines.find(x => x.id === h.machineId);
            const content = this.isPlannedHistory(h) ? (store.activeData.tasks.find(t => t.id === h.taskId)?.content || h.taskContent || '定期メンテナンス') : (h.errorContent || h.notes || '突発対応');
            const tk = `${h.machineId}__${content}`;
            if (!allTaskMap[tk]) allTaskMap[tk] = { label: content, machine: m ? m.name : '不明', model: m ? m.model : '' };
        });
        manualSkills.forEach(ms => {
            allTaskMap[ms.id] = { label: ms.label, machine: ms.machine, model: ms.model || '-' };
        });

        let entries = Object.entries(allTaskMap).filter(([tk]) => !store.isTaskArchived(tk));
        
        // Filter by current UI state
        if (this.skillRiskFilter) {
            entries = entries.filter(([tk]) => !workers.some(w => (skillEvals[w] || {})[tk] === '○'));
        } else if (this.skillSoloFilter) {
            entries = entries.filter(([tk]) => workers.filter(w => (skillEvals[w] || {})[tk] === '○').length === 1);
        }
        if (this.skillModelFilter) {
            entries = entries.filter(([,info]) => info.model === this.skillModelFilter);
        }
        if (this.skillSearchQuery) {
            const q = this.skillSearchQuery.toLowerCase();
            entries = entries.filter(([,info]) => `${info.label} ${info.machine} ${info.model}`.toLowerCase().includes(q));
        }

        const headers = ["作業内容", "機械名", "型式", ...workers];
        const rows = entries.map(([tk, info]) => {
            const evals = workers.map(w => (skillEvals[w] || {})[tk] || '-');
            return [info.label, info.machine, info.model, ...evals].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        this.downloadCSV(`skill_map_${this.getLocalDateString()}.csv`, csvContent);
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppCsvMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppCsvMethods.prototype[name];
        }
    }
})();
