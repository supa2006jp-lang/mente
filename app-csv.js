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
        if (h.taskId) return { key: 'periodic', label: '定期', color: 'var(--primary)', chartColor: '#3b82f6' };
        if (h.isNonProductionStop) return { key: 'nonProductionStop', label: '非停止', color: '#d97706', chartColor: '#f59e0b' };
        return { key: 'sudden', label: '突発', color: 'var(--success)', chartColor: '#10b981' };
    }

    parseHistoryPartsText(partsText) {
        if (!partsText) return [];
        return String(partsText).split(/\s+\/\s+/).map(item => {
            const text = item.trim();
            if (!text) return null;
            const match = text.match(/^(.*?)(?:\s+\[(.*?)\])?\s*\(([-+]?\d*\.?\d+)\s*([^)]*)\)$/);
            if (!match) return { name: MaintenanceStore.toFullWidth(text), model: '', count: 0, unit: '個', price: 0 };
            return {
                name: MaintenanceStore.toFullWidth(match[1].trim()),
                model: MaintenanceStore.toHalfWidthLower((match[2] || '').trim()),
                count: parseFloat(match[3]) || 0,
                unit: (match[4] || '個').trim() || '個',
                price: 0
            };
        }).filter(Boolean);
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
    openHistoryImportModal() {
        this.openModal('history-import', '過去履歴のCSV一括取込', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div style="margin-bottom:20px; font-size:0.85rem; color:var(--text-main); line-height:1.6;">
                    <p>Excel等で作成した過去のメンテナンス記録（CSV形式）を一括で取り込みます。</p>
                    <p style="margin-top:8px; padding:10px; background:#eff6ff; border-radius:6px; border:1px solid #bae6fd;">
                        1. まず下記のボタンから専用の「テンプレート(CSV)」をダウンロードしてください。<br>
                        2. テンプレートの2行目以降にデータを入力し、保存してください。<br>
                        3. 「ファイルを選択」から保存したCSVを読み込ませてください。
                    </p>
                    <button class="secondary-btn" style="margin-top:12px; padding:6px 16px; font-size:0.8rem;" onclick="app.downloadHistoryImportTemplate()"><i class="fa-solid fa-download"></i> テンプレート(CSV)をダウンロード</button>
                </div>
                <div class="form-group" style="border-top:1px dashed var(--border); padding-top:20px;">
                    <label style="font-weight:800; color:var(--primary);">CSVファイルを選択</label>
                    <input type="file" id="hist-csv-upload" accept=".csv" style="margin-top:8px; display:block;">
                </div>
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
        const headers = ["日付(YYYY-MM-DD)", "ライン", "機械名", "型式", "対応種別(突発/非生産停止/定期/ドカ停)", "作業内容(症状)", "原因", "処置内容(備考)", "エラー番号", "作業時間(分)", "作業区分(機械/電気/調整/部品/清掃/その他)", "作業者(カンマ区切り)"];
        const sampleRows = [
            ["2024-03-01", "5号ライン", "メインコンベア", "MC-100", "突発", "ベルトの異音", "経年劣化", "ベルトを調整", "E-01", "30", "機械", "山田, 鈴木"],
            ["2024-03-05", "その他", "サブコンベア", "SC-50", "非生産停止", "センサー警告", "汚れ", "清掃・動作確認", "", "15", "清掃", "田中"]
        ];
        const csvContent = [headers.join(','), ...sampleRows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
        this.downloadCSV(`template_history_import.csv`, csvContent);
    }

    processHistoryImportCSV() {
        const fileInput = document.getElementById('hist-csv-upload');
        if (!fileInput.files.length) return alert("CSVファイルを選択してください。");
        const file = fileInput.files[0];

        const reader = new FileReader();
        reader.onload = async (e) => {
            const rows = this.parseCSV(e.target.result).filter(row => row.some(col => String(col).trim() !== ''));
            if (rows.length <= 1) return alert("データがありません。");

            const headers = rows[0].map(h => String(h).replace(/^\ufeff/, '').trim());
            const findIndex = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));
            const indexMap = {
                date: findIndex(['日付']),
                line: findIndex(['ライン']),
                machine: findIndex(['機械名']),
                model: findIndex(['型式']),
                type: findIndex(['区分', '対応種別']),
                content: findIndex(['作業内容', '内容']),
                cause: findIndex(['原因']),
                notes: findIndex(['処置']),
                errorNo: findIndex(['エラー']),
                time: findIndex(['作業時間']),
                category: findIndex(['作業区分']),
                workers: findIndex(['作業員', '作業者']),
                parts: findIndex(['交換部品'])
            };
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

            const records = [];
            const machines = store.getMachines(true);
            let addedMachines = 0;
            const importKey = (record) => [
                record.date || '',
                record.machineId || '',
                record.taskContent || record.errorContent || record.notes || '',
                String(record.workTime || 0)
            ].map(v => MaintenanceStore.toHalfWidthLower(String(v).trim())).join('__');
            const existingKeys = new Set((store.activeData.history || []).map(importKey));
            const importKeys = new Set();
            let duplicateCount = 0;

            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i];
                if (cols.length < 5) continue;

                const date = getCol(cols, 'date', 0);
                const lineNo = normalizeLineNo(getCol(cols, 'line'));
                const mName = getCol(cols, 'machine', 1);
                const mModel = getCol(cols, 'model', 2);
                const occType = getCol(cols, 'type', 3);
                const content = getCol(cols, 'content', 4);
                const cause = getCol(cols, 'cause', 5);
                const notes = getCol(cols, 'notes', 6);
                const errorNo = getCol(cols, 'errorNo', 7);
                const time = getCol(cols, 'time', 8);
                const categoryName = getCol(cols, 'category', 9);
                const workersStr = getCol(cols, 'workers', 10);
                const partsStr = getCol(cols, 'parts', 11);
                if (!date || !mName) continue;

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

                const catMap = { '機械': 'machine', '電気': 'electric', '調整': 'adjust', '部品': 'parts', '清掃': 'clean', 'その他': 'other' };
                let category = 'other';
                for (const [k, v] of Object.entries(catMap)) {
                    if (categoryName.includes(k)) { category = v; break; }
                }

                const workers = workersStr ? workersStr.split(/\s*(?:,|，|、|\/)\s*/).map(w => w.trim()).filter(Boolean) : [];
                const replacedParts = this.parseHistoryPartsText(partsStr);
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
                return alert(duplicateCount > 0 ? `すべて重複候補だったため、取り込みはありませんでした。（${duplicateCount}件）` : "取り込めるデータがありませんでした。");
            }
            const duplicateMessage = duplicateCount > 0 ? `\n\n重複候補 ${duplicateCount}件はスキップします。` : '';
            if (confirm(`${records.length}件の履歴（うち新規機械登録: ${addedMachines}件）を取り込みます。よろしいですか？${duplicateMessage}`)) {
                store.activeData.history.push(...records);
                await store.save();
                this.closeModal();
                this.showToast(`${records.length}件の履歴をインポートしました`, 'success');
                this.updateDataLists();
                this.updateHistoryPeriodOptions();
                requestAnimationFrame(() => {
                    this.switchView('history');
                    this.renderHistory();
                    this.renderCalendar();
                });
            }
        };
        reader.readAsText(file, 'utf-8');
    }

    exportHistoryAsCSV() {
        const period = document.getElementById('hist-filter-period')?.value || 'all';
        const machineId = document.getElementById('hist-filter-machine')?.value || '';
        const type = document.getElementById('hist-filter-type')?.value || '';
        const query = document.getElementById('global-search')?.value || '';

        let history = store.getHistory({ machineId, search: query }).filter(h => !h.isManualGuide);
        history = this.filterHistoryByPeriod(history, period);
        if (type) {
            if (type === 'periodic') history = history.filter(h => !!h.taskId);
            else if (type === 'sudden') history = history.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop);
            else if (type === 'nonProductionStop') history = history.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop);
            else if (type === 'dokatei') history = history.filter(h => h.isDokatei);
        }

        const headers = ["日付", "ライン", "機械名", "型式", "対応種別", "作業内容(症状)", "原因", "処置内容(備考)", "エラー番号", "作業時間(分)", "作業区分", "作業者", "交換部品"];
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
                return `${p.name || ''}${model} (${count}${unit})`;
            }).join(' / ');

            return [
                h.date,
                lineLabel,
                mName,
                mModel,
                typeLabel,
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
