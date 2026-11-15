(function () {
    'use strict';
    const P = MaintenanceApp.prototype;
    const fields = [
        ['date', '日付', ['日付', '作業日', '実施日', 'date'], true],
        ['machine', '機械名', ['機械名', '設備名', '装置名'], true],
        ['content', '作業内容', ['作業内容', '内容', '症状'], true],
        ['line', 'ライン', ['ライン', 'ライン番号', 'ライン名']], ['model', '型式', ['型式', '型番']],
        ['type', '対応種別', ['対応種別', '区分']], ['occurrence', '初回・再発', ['初回/再発', '初回・再発', '初回', '再発', '対応回数']],
        ['cause', '原因', ['原因']], ['notes', '処置', ['処置', '処置内容', '備考']], ['errorNo', 'エラー番号', ['エラー番号', 'エラー', 'エラーNo']],
        ['time', '作業時間', ['作業時間', '時間']], ['category', '作業区分', ['作業区分']], ['workers', '作業者', ['作業者', '作業員']],
        ['partsData', '交換部品（再取込用）', ['交換部品データ']],
        ['parts', '交換部品（一括）', ['交換部品', '部品一括', '部品テキスト', '部品']], ['partName', '部品名', ['部品名']],
        ['partCount', '部品数量', ['部品数量', '使用数量']], ['partUnit', '部品単位', ['部品単位', '単位']], ['partPrice', '部品単価', ['部品単価', '単価']]
    ];
    const normalize = value => String(value ?? '').normalize('NFKC').replace(/^\ufeff/, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, '').toLowerCase();
    const node = (tag, value, parent) => { const el = document.createElement(tag); if (value != null) el.textContent = value; parent?.append(el); return el; };

    P.detectHistoryImportColumns = function (rows) {
        let headerRowIndex = -1, bestScore = 1;
        for (let i = 0; i < rows.length; i++) {
            const names = rows[i].map(normalize);
            const score = fields.filter(([, , aliases]) => aliases.some(alias => names.includes(normalize(alias)))).length;
            if (score > bestScore) { bestScore = score; headerRowIndex = i; }
        }
        if (headerRowIndex < 0) throw Error('見出し行が見つかりません。日付・機械名・作業内容の見出しを残してください。');
        const headers = rows[headerRowIndex].map(h => String(h).replace(/^\ufeff/, '').trim());
        const indexMap = {}, ambiguous = [];
        for (const [key, , aliases] of fields) {
            const matches = headers.flatMap((header, index) => aliases.some(alias => normalize(alias) === normalize(header)) ? [index] : []);
            indexMap[key] = matches.length === 1 ? matches[0] : matches.length > 1 ? -2 : -1;
            if (matches.length > 1) ambiguous.push(key);
        }
        return { headers, headerRowIndex, indexMap, ambiguous, confirmed: new Set() };
    };
    P.decodeHistoryImportCsv = function (buffer, encoding = 'auto') {
        if (encoding !== 'auto') return { text: new TextDecoder(encoding, { fatal: true }).decode(buffer), encoding };
        try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(buffer), encoding: 'utf-8' }; }
        catch { return { text: new TextDecoder('shift_jis', { fatal: true }).decode(buffer), encoding: 'shift_jis' }; }
    };
    P.prepareHistoryImportFile = async function () {
        const file = document.getElementById('hist-csv-upload')?.files[0];
        if (!file) throw Error('ExcelまたはCSVファイルを選択してください。');
        const encoding = document.getElementById('hist-csv-encoding')?.value || 'auto';
        const cached = this._historyImportPrepared;
        if (cached?.file === file && cached.encoding === encoding) return cached;
        const excel = /\.xlsx$/i.test(file.name || '');
        let rows, detected;
        if (excel) { rows = await this.parseHistoryImportWorkbook(await file.arrayBuffer()); detected = 'Excel'; }
        else {
            const decoded = this.decodeHistoryImportCsv(await file.arrayBuffer(), encoding);
            rows = this.parseCSV(decoded.text); detected = decoded.encoding === 'utf-8' ? 'UTF-8' : 'Shift_JIS';
        }
        if (!excel && rows.length <= 1) throw Error('データがありません。');
        const prepared = { file, encoding, detected, excel, rows, sheets: rows.workbookSheets, sheetKey: rows.sheetKey };
        this.setHistoryImportSheetRows(prepared, rows);
        // A slow decode must not replace the preview for a newer file or encoding selection.
        if (document.getElementById('hist-csv-upload')?.files[0] !== file || (document.getElementById('hist-csv-encoding')?.value || 'auto') !== encoding) return null;
        this._historyImportPrepared = prepared;
        this.renderHistoryImportPreview(prepared);
        return prepared;
    };
    P.setHistoryImportSheetRows = function (prepared, rows) {
        prepared.rows = rows; prepared.sheetError = '';
        try { Object.assign(prepared, this.detectHistoryImportColumns(rows)); }
        catch (error) {
            if (!prepared.excel) throw error;
            Object.assign(prepared, { headers: rows[0] || [], headerRowIndex: 0, indexMap: Object.fromEntries(fields.map(([key]) => [key, -1])), ambiguous: [], confirmed: new Set() });
            prepared.sheetError = rows.length ? error.message : 'このシートにはデータがありません。';
        }
    };
    P.refreshHistoryImportPreview = async function () {
        const target = document.getElementById('hist-csv-preview');
        if (!target) return;
        const generation = (this._historyImportPreviewGeneration || 0) + 1; this._historyImportPreviewGeneration = generation;
        target.textContent = '読み込み中…';
        try { const prepared = await this.prepareHistoryImportFile(); if (prepared && this._historyImportPreviewGeneration === generation && target.isConnected) this.renderHistoryImportPreview(prepared); }
        catch (error) { if (this._historyImportPreviewGeneration === generation && target.isConnected) target.textContent = error.message || String(error); }
    };
    P.renderHistoryImportPreview = function (prepared) {
        const target = document.getElementById('hist-csv-preview'); if (!target) return;
        target.replaceChildren();
        if (prepared.sheets?.length) {
            const label = node('label', '取込シート ', target); label.className = 'history-import-sheet-picker';
            const select = node('select', null, label); select.id = 'hist-import-sheet'; select.setAttribute('aria-label', '取込シート');
            for (const sheet of prepared.sheets) select.add(new Option(`${sheet.name}${sheet.hidden ? '（非表示）' : ''}`, sheet.key));
            select.value = prepared.sheetKey;
            select.onchange = () => {
                const sheet = prepared.sheets.find(s => s.key === select.value); if (!sheet) return;
                prepared.sheetKey = sheet.key; this.setHistoryImportSheetRows(prepared, sheet.rows); this.renderHistoryImportPreview(prepared);
                document.getElementById('hist-import-sheet')?.focus({ preventScroll: true });
            };
        }
        node('p', `${prepared.detected}で読み込みました。${prepared.excel ? '取り込むシートと内容を確認してください。' : '文字化けがないか確認してください。'}先頭5件を表示しています。`, target);
        if (prepared.sheetError) { const warning = node('p', prepared.sheetError + ' 別のシートを選択してください。', target); warning.setAttribute('role', 'alert'); }

        const wrap = node('div', null, target); wrap.className = 'history-import-preview-table';
        const table = node('table', null, wrap); const head = node('tr', null, node('thead', null, table));
        node('th', '行', head); prepared.headers.forEach(h => node('th', h, head));
        const body = node('tbody', null, table);
        const previewRows = prepared.excel ? this.normalizeXlsxImportRows(prepared.rows, prepared) : prepared.rows;
        previewRows.slice(prepared.headerRowIndex + 1, prepared.headerRowIndex + 6).forEach((row, index) => {
            const tr = node('tr', null, body); node('td', row.sourceRow || prepared.headerRowIndex + index + 2, tr);
            prepared.headers.forEach((_, i) => node('td', String(row[i] || '').slice(0, 160), tr));
        });
        const details = node('details', null, target); details.className = 'history-import-column-map'; details.open = !!prepared.ambiguous.length;
        node('summary', prepared.ambiguous.length ? '候補が複数ある列を選んでください' : '列の対応を確認・変更', details);
        node('p', '同じ列を複数の項目には使えません。不要な項目は「取り込まない」を選べます。', details);
        if (prepared.indexMap.partsData >= 0) node('p', '再取込用の交換部品データを優先します。交換部品欄を編集したCSVでは、「交換部品（再取込用）」を「取り込まない」に変更してください。', details);
        for (const [key, title, , required] of fields) {
            const label = node('label', `${title}${required ? '（必須）' : ''}`, details);
            const select = node('select', null, label); select.dataset.importColumn = key; select.setAttribute('aria-label', `${title}の列`);
            if (prepared.ambiguous.includes(key)) select.add(new Option('選択してください', '-2'));
            select.add(new Option(required ? '列を選択してください' : '取り込まない', '-1'));
            prepared.headers.forEach((header, i) => select.add(new Option(`${i + 1}列目：${header || '見出しなし'}`, String(i))));
            select.value = String(prepared.indexMap[key]);
            select.onchange = () => { prepared.indexMap[key] = Number(select.value); prepared.confirmed.add(key); if (key === 'date' && prepared.excel) { this.renderHistoryImportPreview(prepared); const map = target.querySelector('.history-import-column-map'); map.open = true; map.querySelector('[data-import-column=date]').focus({ preventScroll: true }); } };
        }
    };
    P.getHistoryImportColumnErrors = function (prepared) {
        if (prepared.sheetError) return [{ row: 1, field: '取込シート', value: prepared.sheets?.find(s => s.key === prepared.sheetKey)?.name || '', reason: prepared.sheetError + ' 別のシートを選択してください。' }];
        const errors = [], used = new Map(), row = prepared.rows[prepared.headerRowIndex]?.sourceRow || prepared.headerRowIndex + 1;
        for (const [key, title, , required] of fields) {
            const index = prepared.indexMap[key];
            let reason = '';
            if (index < 0 && required) reason = '必須項目の列を選択してください。';
            else if (index === -2 || (prepared.ambiguous.includes(key) && !prepared.confirmed.has(key))) reason = '候補が複数あります。列を選ぶか「取り込まない」を指定してください。';
            else if (index >= 0 && used.has(index)) reason = `「${used.get(index)}」と同じ列が選ばれています。`;
            if (reason) errors.push({ row, field: title, value: index >= 0 ? prepared.headers[index] : '', reason });
            if (index >= 0) used.set(index, title);
        }
        return errors;
    };
    P.getHistoryImportRowShapeErrors = function (prepared) {
        if (prepared.excel) return [];
        return prepared.rows.slice(prepared.headerRowIndex + 1).flatMap((row, i) => row.length === prepared.headers.length ? [] : [{
            row: row.sourceRow || prepared.headerRowIndex + i + 2, field: 'CSVの列数', value: `${row.length}列`,
            reason: `見出しは${prepared.headers.length}列です。区切りのカンマや引用符を確認してください。`
        }]);
    };
    P.exportHistoryImportErrors = function (errors) {
        const rows = [['行番号', '項目', '入力値', '理由'], ...errors.map(e => [e.row, e.field, e.value, e.reason])];
        // Prefix formula-like values so opening this correction report in a spreadsheet is safe.
        const cell = value => this.csvEscape(/^[=+\-@\t\r]/.test(String(value)) ? "'" + value : value);
        this.downloadCSV('history_import_errors.csv', rows.map(row => row.map(cell).join(',')).join('\r\n'));
    };
    P.openHistoryImportErrors = function (errors) {
        const dialog = node('dialog', null, document.body); dialog.className = 'history-import-review history-import-errors';
        node('h3', '取り込み前に修正が必要です', dialog);
        node('p', `${new Set(errors.map(e => e.row)).size}行・${errors.length}件の問題があります。データはまだ取り込んでいません。`, dialog);
        const status = node('p', null, dialog); status.setAttribute('role', 'status');
        const list = node('div', null, dialog); list.className = 'history-import-review-list';
        const actions = node('div', null, dialog); actions.className = 'history-import-review-actions'; let page = 0;
        const button = (title, action) => { const el = node('button', title, actions); el.type = 'button'; el.className = 'secondary-btn'; el.onclick = action; return el; };
        const previous = button('前へ', () => { page--; render(); }), next = button('次へ', () => { page++; render(); });
        button('エラー一覧をCSV保存', () => this.exportHistoryImportErrors(errors)); button('閉じて修正する', () => dialog.close());
        const render = () => {
            const pages = Math.max(1, Math.ceil(errors.length / 50)); status.textContent = `${page + 1}/${pages}ページ（全${errors.length}件）`;
            previous.disabled = page === 0; next.disabled = page >= pages - 1; list.replaceChildren(); list.scrollTop = 0;
            for (const e of errors.slice(page * 50, page * 50 + 50)) {
                const section = node('section', null, list); node('strong', `${e.row}行目・${e.field}`, section);
                node('p', `入力値：${String(e.value || '未入力').slice(0, 200)}`, section); node('p', e.reason, section);
            }
        };
        dialog.addEventListener('close', () => dialog.remove(), { once: true }); render(); dialog.showModal();
    };
})();
