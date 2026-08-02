(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppCsvMethods extends MaintenanceApp {
    // --- CSV Export ---
    csvEscape(value) {
        return `"${String(value ?? '').replace(/"/g, '""')}"`;
    }

    parseCSV(text) {
        const rows = [];
        let row = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const next = text[i + 1];

            if (char === '"' && inQuotes && next === '"') {
                current += '"';
                i++;
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(current);
                current = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && next === '\n') i++;
                row.push(current);
                if (row.some(v => String(v).trim() !== '')) rows.push(row);
                row = [];
                current = '';
            } else {
                current += char;
            }
        }

        row.push(current);
        if (row.some(v => String(v).trim() !== '')) rows.push(row);
        return rows;
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
        if (h.isDokatei) return { key: 'dokatei', label: 'ドカ停', color: 'var(--danger)', chartColor: '#ef4444' };
        if (h.isSingleMaintenance) return { key: 'singleMaintenance', label: '単発', color: '#0f766e', chartColor: '#14b8a6' };
        if (h.taskId) return { key: 'periodic', label: '定期', color: 'var(--primary)', chartColor: '#3b82f6' };
        if (h.isNonProductionStop) return { key: 'nonProductionStop', label: '非停止', color: '#d97706', chartColor: '#f59e0b' };
        return { key: 'sudden', label: '突発', color: 'var(--success)', chartColor: '#10b981' };
    }

    parseHistoryPartsText(partsText) {
        if (!partsText) return [];
        return String(partsText).split(/\s*(?:\/|／|;|；|\r?\n)\s*/).map(item => {
            const text = item.trim();
            if (!text) return null;
            const normalized = text
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
                    price: 0
                };
            }
            const match = normalized.match(/^(.*?)(?:\s+\[(.*?)\])?\s*\(([-+]?\d*\.?\d+)\s*([^)]*)\)(?:\s*@\s*([-+]?\d*\.?\d+))?$/);
            if (!match) return { name: MaintenanceStore.toFullWidth(text), model: '', count: 0, unit: '個', price: 0 };
            return {
                name: MaintenanceStore.toFullWidth(match[1].trim()),
                model: MaintenanceStore.toHalfWidthLower((match[2] || '').trim()),
                count: parseFloat(match[3]) || 0,
                unit: (match[4] || '個').trim() || '個',
                price: parseFloat(match[5]) || 0
            };
        }).filter(Boolean);
    }

    parseImportedPartNumber(value) {
        const normalized = String(value ?? '')
            .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
            .replace(/[，、]/g, ',')
            .replace(/[￥円個gＧ\s]/g, '')
            .replace(/,/g, '')
            .trim();
        if (!normalized) return NaN;
        const match = normalized.match(/[-+]?\d*\.?\d+/);
        return match ? parseFloat(match[0]) : NaN;
    }

    normalizeImportedPartUnit(value, fallback = '個') {
        const raw = String(value ?? '').trim();
        if (!raw) return fallback || '個';
        const half = raw.replace(/[Ｇｇ]/g, 'g').toLowerCase();
        if (half.includes('g') || raw.includes('グラム')) return 'g';
        if (raw.includes('個') || raw.includes('コ')) return '個';
        return raw;
    }

    parseHistoryImportParts(partsText, partName, partCount, partUnit, partPrice) {
        const hasSplitInput = [partName, partCount, partUnit, partPrice].some(v => String(v ?? '').trim());
        if (!hasSplitInput) return this.parseHistoryPartsText(partsText);

        const parsedFromName = this.parseHistoryPartsText(partName);
        const base = parsedFromName[0] || {
            name: MaintenanceStore.toFullWidth(String(partName || '').trim()),
            model: '',
            count: 0,
            unit: '個',
            price: 0
        };
        if (!base.name) return this.parseHistoryPartsText(partsText);

        const count = this.parseImportedPartNumber(partCount);
        const price = this.parseImportedPartNumber(partPrice);
        return [{
            ...base,
            count: Number.isFinite(count) ? count : (parseFloat(base.count) || 0),
            unit: this.normalizeImportedPartUnit(partUnit, base.unit || '個'),
            price: Number.isFinite(price) ? price : (parseFloat(base.price) || 0)
        }];
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
                    price: !Number.isNaN(price) && price > 0 ? price : 0,
                    priceRaw: !Number.isNaN(price) && price > 0 ? String(price) : '',
                    stock: 0,
                    minStock: 0,
                    supplier: '',
                    unit
                });
                added++;
            } else if ((!parseFloat(master.price) || parseFloat(master.price) <= 0) && !Number.isNaN(price) && price > 0) {
                store.updatePartMaster?.(master.name || name, master.model || model, {
                    ...master,
                    price,
                    priceRaw: String(price),
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
        const logs = this.getHistoryImportLogs().slice(0, 10);
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

    async addHistoryImportLog(log) {
        const logs = this.getHistoryImportLogs();
        logs.unshift({
            id: store.generateId ? store.generateId() : String(Date.now()),
            at: new Date().toISOString(),
            ...log
        });
        store.activeData.historyImportLogs = logs.slice(0, 50);
        await store.save();
    }

    async clearHistoryImportLogs() {
        if (!confirm('CSV取り込みログを消去しますか？')) return;
        store.activeData.historyImportLogs = [];
        await store.save();
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
                ${this.renderHistoryImportLogsHtml()}
            `;
            const footer = document.querySelector('.modal-footer');
            footer.innerHTML = `
                <button class="secondary-btn" id="modal-cancel">キャンセル</button>
                <button class="primary-btn" onclick="app.processHistoryImportCSV()"><i class="fa-solid fa-cloud-arrow-up"></i> 取り込む</button>
            `;
            document.getElementById('modal-cancel').onclick = () => this.closeModal();
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
        const today = new Date().toISOString().split('T')[0];
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
                        <span>作業者は「山田, 田中」のようにカンマ区切りで複数入力できます。</span>
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
            date: new Date().toISOString().split('T')[0],
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
        this.downloadCSV(`history_import_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
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

    excelSerialToDate(value) {
        const serial = Number(value);
        if (!Number.isFinite(serial) || serial < 1) return String(value || '');
        const utcDays = Math.floor(serial - 25569);
        const date = new Date(utcDays * 86400 * 1000);
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    normalizeXlsxImportRows(rows) {
        const headerRowIndex = rows.findIndex(row => {
            const normalized = row.map(h => String(h).replace(/^\ufeff/, '').trim());
            return normalized.some(h => h.includes('日付')) && normalized.some(h => h.includes('機械名'));
        });
        if (headerRowIndex < 0) return rows;
        const dateIndex = rows[headerRowIndex].findIndex(h => String(h).includes('日付'));
        if (dateIndex < 0) return rows;
        return rows.map((row, rowIndex) => {
            if (rowIndex <= headerRowIndex) return row;
            const next = row.slice();
            const raw = String(next[dateIndex] || '').trim();
            if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw) || /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(raw)) {
                next[dateIndex] = raw.replace(/\//g, '-');
            } else if (/^\d+(\.\d+)?$/.test(raw)) {
                next[dateIndex] = this.excelSerialToDate(raw);
            }
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
        const sheetPath = entries['xl/worksheets/sheet1.xml'] ? 'xl/worksheets/sheet1.xml' : Object.keys(entries).find(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
        if (!sheetPath) throw new Error('Excel内の入力シートが見つかりませんでした。');
        const sheetXml = this.getXlsxEntryText(entries, sheetPath);
        const sheetDoc = new DOMParser().parseFromString(sheetXml, 'application/xml');
        const rows = Array.from(sheetDoc.getElementsByTagName('row')).map(rowEl => {
            const row = [];
            Array.from(rowEl.getElementsByTagName('c')).forEach(cell => {
                const { col } = this.parseXlsxCellRef(cell.getAttribute('r'));
                const type = cell.getAttribute('t');
                const valueNode = cell.getElementsByTagName('v')[0];
                let value = valueNode ? (valueNode.textContent || '') : '';
                if (type === 's') value = sharedStrings[parseInt(value, 10)] || '';
                else if (type === 'inlineStr') value = this.xmlTextContent(cell);
                else if (type === 'b') value = value === '1' ? 'TRUE' : 'FALSE';
                row[col] = value;
            });
            return row.map(value => value ?? '');
        }).filter(row => row.some(col => String(col).trim() !== ''));
        return this.normalizeXlsxImportRows(rows);
    }

    async processHistoryImportCSV() {
        const fileInput = document.getElementById('hist-csv-upload');
        if (!fileInput.files.length) return alert("ExcelまたはCSVファイルを選択してください。");
        const file = fileInput.files[0];
        const isExcel = /\.xlsx$/i.test(file.name || '');

        try {
            const rows = isExcel
                ? await this.parseHistoryImportWorkbook(await file.arrayBuffer())
                : this.parseCSV(await file.text()).filter(row => row.some(col => String(col).trim() !== ''));
            if (rows.length <= 1) return alert("データがありません。");

            const headerRowIndex = rows.findIndex(row => {
                const normalized = row.map(h => String(h).replace(/^\ufeff/, '').trim());
                return normalized.some(h => h.includes('日付')) && normalized.some(h => h.includes('機械名'));
            });
            if (headerRowIndex < 0) return alert("CSVの見出し行が見つかりませんでした。日付・機械名などの見出しがある行を残してください。");

            const headers = rows[headerRowIndex].map(h => String(h).replace(/^\ufeff/, '').trim());
            const findIndex = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));
            const indexMap = {
                date: findIndex(['日付']),
                line: findIndex(['ライン']),
                machine: findIndex(['機械名']),
                model: findIndex(['型式']),
                type: findIndex(['区分', '対応種別']),
                occurrence: findIndex(['初回', '再発', '対応回数']),
                content: findIndex(['作業内容', '内容']),
                cause: findIndex(['原因']),
                notes: findIndex(['処置']),
                errorNo: findIndex(['エラー']),
                time: findIndex(['作業時間']),
                category: findIndex(['作業区分']),
                workers: findIndex(['作業員', '作業者']),
                parts: findIndex(['交換部品', '部品一括', '部品テキスト']),
                partName: findIndex(['部品名']),
                partCount: findIndex(['部品数量', '使用数量']),
                partUnit: findIndex(['部品単位', '単位(個/g)', '単位']),
                partPrice: findIndex(['部品単価', '単価'])
            };
            if (indexMap.parts < 0) indexMap.parts = headers.findIndex(h => h === '部品');
            const getCol = (cols, key, fallbackIndex = -1) => {
                const index = indexMap[key] >= 0 ? indexMap[key] : fallbackIndex;
                return index >= 0 ? String(cols[index] || '').trim() : '';
            };
            const normalizeLineNo = (value) => {
                const raw = String(value || '').trim();
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

            const records = [];
            const machines = store.getMachines(true);
            let addedMachines = 0;
            let candidateRowCount = 0;
            let skippedInvalidRows = 0;
            const importKey = (record) => [
                record.date || '',
                record.machineId || '',
                record.taskContent || record.errorContent || record.notes || '',
                String(record.workTime || 0)
            ].map(v => MaintenanceStore.toHalfWidthLower(String(v).trim())).join('__');
            const existingKeys = new Set((store.activeData.history || []).map(importKey));
            const importKeys = new Set();
            let duplicateCount = 0;

            for (let i = headerRowIndex + 1; i < rows.length; i++) {
                const cols = rows[i];
                if (!cols.some(col => String(col).trim() !== '')) continue;
                candidateRowCount++;
                if (cols.length < 5) {
                    skippedInvalidRows++;
                    continue;
                }

                const date = getCol(cols, 'date', 0);
                const lineNo = normalizeLineNo(getCol(cols, 'line'));
                const mName = getCol(cols, 'machine', 1);
                const mModel = getCol(cols, 'model', 2);
                const occType = getCol(cols, 'type', 3);
                const occurrenceText = getCol(cols, 'occurrence', -1);
                const hasOccurrenceColumn = indexMap.occurrence >= 0;
                const content = getCol(cols, 'content', hasOccurrenceColumn ? 5 : 4);
                const cause = getCol(cols, 'cause', hasOccurrenceColumn ? 6 : 5);
                const notes = getCol(cols, 'notes', hasOccurrenceColumn ? 7 : 6);
                const errorNo = getCol(cols, 'errorNo', hasOccurrenceColumn ? 8 : 7);
                const time = getCol(cols, 'time', hasOccurrenceColumn ? 9 : 8);
                const categoryName = getCol(cols, 'category', hasOccurrenceColumn ? 10 : 9);
                const workersStr = getCol(cols, 'workers', hasOccurrenceColumn ? 11 : 10);
                const partsStr = getCol(cols, 'parts', hasOccurrenceColumn ? 12 : 11);
                const partNameStr = getCol(cols, 'partName', hasOccurrenceColumn ? 13 : 12);
                const partCountStr = getCol(cols, 'partCount', hasOccurrenceColumn ? 14 : 13);
                const partUnitStr = getCol(cols, 'partUnit', hasOccurrenceColumn ? 15 : 14);
                const partPriceStr = getCol(cols, 'partPrice', hasOccurrenceColumn ? 16 : 15);
                if (!date || !mName) {
                    skippedInvalidRows++;
                    continue;
                }

                let targetMachine = machines.find(m => m.name === mName && (mModel ? m.model === mModel : true));
                if (!targetMachine) {
                    targetMachine = store.addMachine(mName, mModel || '', 'CSV取込で自動登録', '', '', lineNo);
                    machines.push(targetMachine);
                    addedMachines++;
                } else if (lineNo && !targetMachine.lineNo) {
                    targetMachine.lineNo = lineNo;
                }

                let isSudden = false;
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

                const workers = workersStr
                    ? workersStr.split(/\s*(?:,|，|、|\/)\s*/).map(w => normalizeImportedWorkerName(w)).filter(Boolean)
                    : [];
                const replacedParts = this.parseHistoryImportParts(partsStr, partNameStr, partCountStr, partUnitStr, partPriceStr);
                const record = {
                    id: store.generateId(),
                    machineId: targetMachine.id,
                    date,
                    workTime: parseInt(time) || 0,
                    isSudden,
                    isDokatei,
                    isNonProductionStop: !isDokatei && isNonProductionStop,
                    errorNo: errorNo || '',
                    errorContent: content || '',
                    cause: cause || '',
                    notes: notes || '',
                    category,
                    machineCategory: targetMachine.category || '',
                    lineNo: lineNo || targetMachine.lineNo || '',
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

                const key = importKey(record);
                if (existingKeys.has(key) || importKeys.has(key)) {
                    duplicateCount++;
                    continue;
                }
                importKeys.add(key);
                records.push(record);
            }

            if (records.length === 0) {
                await this.addHistoryImportLog({
                    fileName: file.name || 'CSV取り込み',
                    totalRows: candidateRowCount,
                    added: 0,
                    duplicates: duplicateCount,
                    skipped: skippedInvalidRows,
                    addedMachines,
                    firstTime: 0,
                    recurrence: 0
                });
                return alert(duplicateCount > 0 ? `すべて重複候補だったため、取り込みはありませんでした。（${duplicateCount}件）` : "取り込めるデータがありませんでした。");
            }
            const duplicateMessage = duplicateCount > 0 ? `\n\n重複候補 ${duplicateCount}件はスキップします。` : '';
            const parsedParts = records.flatMap(record => record.replacedParts || []);
            const parsedPartMasterKeys = new Set(parsedParts.filter(p => p.name).map(p => `${p.name}__${p.model || ''}`));
            const partMasterMessage = parsedPartMasterKeys.size ? `\n部品マスター候補 ${parsedPartMasterKeys.size}件も反映します。` : '';
            if (confirm(`${records.length}件の履歴（うち新規機械登録: ${addedMachines}件）を取り込みます。よろしいですか？${partMasterMessage}${duplicateMessage}`)) {
                store.activeData.history.push(...records);
                const partMasterResult = this.upsertImportedPartMasters(parsedParts);
                await this.addHistoryImportLog({
                    fileName: file.name || 'CSV取り込み',
                    totalRows: candidateRowCount,
                    added: records.length,
                    duplicates: duplicateCount,
                    skipped: skippedInvalidRows,
                    addedMachines,
                    addedPartMasters: partMasterResult.added,
                    updatedPartMasters: partMasterResult.updated,
                    firstTime: records.filter(r => r.isFirstTime !== false).length,
                    recurrence: records.filter(r => r.isFirstTime === false).length
                });
                this.closeModal();
                this.showToast?.(`${records.length}件の履歴をインポートしました（重複${duplicateCount}件）`, 'success');
                this.updateDataLists();
                this.updateHistoryPeriodOptions();
                requestAnimationFrame(() => {
                    this.switchView('history');
                    this.renderHistory();
                    this.renderCalendar();
                });
            }
        } catch (err) {
            console.error('History import failed', err);
            alert(`取り込みファイルを読み取れませんでした。\n${err.message || err}`);
        }
    }

    exportHistoryAsCSV() {
        const period = document.getElementById('hist-filter-period')?.value || 'all';
        const machineId = document.getElementById('hist-filter-machine')?.value || '';
        const type = document.getElementById('hist-filter-type')?.value || '';
        const query = document.getElementById('global-search')?.value || '';

        let history = store.getHistory({ machineId, search: query }).filter(h => !h.isManualGuide);
        history = this.filterHistoryByPeriod(history, period);
        if (type) {
            if (type === 'periodic') history = history.filter(h => !!h.taskId && !h.isSingleMaintenance);
            else if (type === 'singleMaintenance') history = history.filter(h => !!h.isSingleMaintenance);
            else if (type === 'sudden') history = history.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop);
            else if (type === 'nonProductionStop') history = history.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop);
            else if (type === 'dokatei') history = history.filter(h => h.isDokatei);
        }

        const headers = ["日付", "ライン", "機械名", "型式", "対応種別", "初回/再発", "作業内容(症状)", "原因", "処置内容(備考)", "エラー番号", "作業時間(分)", "作業区分", "作業者", "交換部品"];
        const rows = history.map(h => {
            const m = store.getMachines(true).find(x => x.id === h.machineId);
            const mName = m ? m.name : '不明';
            const mModel = m ? m.model : '';
            const lineLabel = this.getLineLabel(h.lineNo || m?.lineNo || '');
            const typeLabel = h.isDokatei ? 'ドカ停' : (h.taskId ? '定期' : (h.isNonProductionStop ? '非生産停止' : '突発'));
            const displayText = this.getHistoryDisplayText(h);
            const workers = (h.workers || []).join(', ');
            const parts = (h.replacedParts || []).map(p => {
                const count = p.count ?? p.qty ?? 0;
                const unit = p.unit || '個';
                const model = p.model ? ` [${p.model}]` : '';
                const price = parseFloat(p.price);
                return `${p.name || ''}${model} x${count} ${unit}${!Number.isNaN(price) && price > 0 ? ` @${price}` : ''}`;
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
                h.workTime || 0,
                this.getCategoryLabel(h.category),
                workers,
                parts
            ].map(v => this.csvEscape(v)).join(',');
        });

        const csvContent = [headers.map(h => this.csvEscape(h)).join(','), ...rows].join('\n');
        this.downloadCSV(`maintenance_history_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
    }

    exportWorkTimeAsCSV() {
        const period = document.getElementById('worktime-filter-period')?.value || 'this_month';
        let history = store.getHistory({});
        history = this.filterHistoryByPeriod(history, period);
        const machines = store.getMachines(true);

        const workerStats = {}; 
        const archivedStats = { name: '旧作業者合計', totalTime: 0, pt: 0, st: 0, np: 0, dt: 0, pc: 0, sc: 0, npc: 0, dc: 0 };
        let totalTimeSum = 0;

        history.forEach(h => {
            const workers = h.workers || [];
            const time = parseInt(h.workTime) || 0;
            const isPeriodic = !!h.taskId;
            workers.forEach(w => {
                const ww = w.trim();
                if (!ww) return;
                totalTimeSum += time;
                const isArchived = store.isWorkerArchived(ww);
                const s = isArchived ? archivedStats : (workerStats[ww] || (workerStats[ww] = { name: ww, totalTime: 0, pt: 0, st: 0, np: 0, dt: 0, pc: 0, sc: 0, npc: 0, dc: 0 }));
                s.totalTime += time;
                if (isPeriodic) { s.pt += time; s.pc++; }
                else if (h.isDokatei) { s.dt += time; s.dc++; }
                else if (h.isNonProductionStop) { s.np += time; s.npc++; }
                else { s.st += time; s.sc++; }
            });
        });

        const stats = Object.values(workerStats).sort((a,b) => b.totalTime - a.totalTime);
        if (archivedStats.totalTime > 0) stats.push(archivedStats);

        const headers = ["作業者", "合計時間(分)", "全体割合(%)", "定期メンテ時間", "定期件数", "突発対応時間", "突発件数", "非生産停止時間", "非生産停止件数", "ドカ停時間", "ドカ停件数"];
        const rows = stats.map(s => {
            const pct = totalTimeSum > 0 ? ((s.totalTime / totalTimeSum) * 100).toFixed(1) : 0;
            return [s.name, s.totalTime, pct, s.pt, s.pc, s.st, s.sc, s.np || 0, s.npc || 0, s.dt, s.dc].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        this.downloadCSV(`worktime_analysis_${period}_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
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
            const content = h.taskId ? (store.activeData.tasks.find(t => t.id === h.taskId)?.content || h.taskContent || '定期メンテナンス') : (h.errorContent || h.notes || '突発対応');
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
        this.downloadCSV(`skill_map_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppCsvMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppCsvMethods.prototype[name];
        }
    }
})();
