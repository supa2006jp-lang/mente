(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppArchiveMethods extends MaintenanceApp {
    archiveWorkerFromWorktime(name) {
        if (confirm(`${name}さんをアーカイブしますか？\n（スキルマップに表示されなくなります。過去の作業実績は「旧作業者合計」に含まれます）`)) {
            store.toggleWorkerArchive(name);
            this.renderWorkTime();
        }
    }

    openWorkerMaintenance() {
        const pass = prompt('管理用パスワードを入力してください');
        if (pass === 'glicono1') {
            this.renderWorkerMaintenanceModal();
        } else if (pass !== null) {
            alert('パスワードが違います');
        }
    }

    renderWorkerMaintenanceModal() {
        // Get all workers from history (including archived)
        const history = store.getHistory({});
        const workerSet = new Set();
        history.forEach(h => {
            const wList = Array.isArray(h.workers) ? h.workers : []; // Safety check
            wList.forEach(w => {
                if (typeof w === 'string') workerSet.add(w.trim());
            });
        });
        const allWorkers = Array.from(workerSet).filter(Boolean).sort();

        this.openModal('workers-maint', '管理画面', () => {
            const body = document.getElementById('modal-content');
            if (!body) return;

            body.innerHTML = `
                <div style="padding: 10px;">
                    <p style="font-size:0.85rem; color:var(--text-light); margin-bottom:16px;">
                        退職などでスキルマップから除外したい人を「アーカイブ」へ送ります。<br>
                        アーカイブへ送っても、過去のメンテナンス記録から名前が消えることはありません。
                    </p>
                    </div>

                    <div style="max-height: 300px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                        <table class="data-table" style="margin-bottom:0; width:100%;">
                            <thead>
                                <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                    <th style="padding:10px; border-bottom:1px solid var(--border);">作業員名</th>
                                    <th style="padding:10px; border-bottom:1px solid var(--border);">状態</th>
                                    <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allWorkers.map(w => {
                                    const isArchived = store.isWorkerArchived(w);
                                    return `
                                            <tr>
                                                <td style="font-weight:700;">${w}</td>
                                                <td>
                                                    ${isArchived 
                                                        ? '<span style="color:var(--text-light); font-size:0.75rem;"><i class="fa-solid fa-box-archive"></i> アーカイブ済</span>' 
                                                        : '<span style="color:var(--success); font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> 有効</span>'}
                                                </td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="${isArchived ? 'secondary-btn' : 'danger-btn'}" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleWorkerArchive('${w}')">
                                                        ${isArchived ? '復元' : 'アーカイブ'}
                                                    </button>
                                                    ${isArchived ? `
                                                        <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteWorker('${w.replace(/'/g, "\\'")}')">
                                                            <i class="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    ` : ''}
                                                </td>
                                            </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-industry"></i> アーカイブ済みの装置本体</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">機械名 / 型式</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(() => {
                                        const deletedMachines = store.activeData.machines.filter(m => m.deleted);
                                        if (deletedMachines.length === 0) return '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">アーカイブされた装置はありません</td></tr>';
                                        
                                        return deletedMachines.map(m => `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${m.name} <span style="font-weight:400; color:var(--text-light);">[${m.model || '-'}]</span></td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.restoreMachine('${m.id}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteMachine('${m.id}', '${m.name.replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('');
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-industry"></i> 装置区分（プルダウン項目）の管理</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colspan="3" style="padding:12px; background:var(--background);">
                                            <div style="display:flex; gap:8px;">
                                                <input type="text" id="new-cat-name" placeholder="新しい装置区分を入力" style="flex:1; padding:8px;" onkeydown="if(event.key==='Enter') app.addMachineCategoryAction()">
                                                <button class="primary-btn" style="padding:8px 16px;" onclick="app.addMachineCategoryAction()"><i class="fa-solid fa-plus"></i> 追加</button>
                                            </div>
                                        </td>
                                    </tr>
                                    ${(() => {
                                        const activeCats = store.activeData.machineCategories || [];
                                        const archCats = store.activeData.archivedMachineCategories || [];
                                        const all = [...activeCats.map(c => ({ name: c, archived: false })), ...archCats.map(c => ({ name: c, archived: true }))];
                                        all.sort((a,b) => a.name.localeCompare(b.name, 'ja'));
                                        
                                        if (all.length === 0) return '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-light);">登録されている装置区分はありません</td></tr>';
                                        
                                        return all.map(c => `
                                            <tr>
                                                <td style="font-weight:700;">${c.name}</td>
                                                <td>
                                                    ${c.archived 
                                                        ? '<span style="color:var(--text-light); font-size:0.75rem;"><i class="fa-solid fa-box-archive"></i> アーカイブ済</span>' 
                                                        : '<span style="color:var(--success); font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> 有効</span>'}
                                                </td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="${c.archived ? 'secondary-btn' : 'danger-btn'}" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleMachineCategoryArchive('${c.name.replace(/'/g, "\\'")}', ${c.archived})">
                                                        ${c.archived ? '復元' : 'アーカイブ'}
                                                    </button>
                                                    ${c.archived ? `
                                                        <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteMachineCategory('${c.name.replace(/'/g, "\\'")}')">
                                                            <i class="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    ` : ''}
                                                </td>
                                            </tr>
                                        `).join('');
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-eye-slash"></i> スキルマップから除外中の項目</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">除外中の項目 (作業内容)</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(store.activeData.archivedTasks || []).length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">除外中の項目はありません</td></tr>' : store.activeData.archivedTasks.map(tk => {
                                        const label = tk.split('__')[1] || '不明な作業';
                                        return `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${label}</td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleTaskArchive('${tk}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteTask('${tk}', '${label.replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-box-archive"></i> アーカイブ済みの部品マスター</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">部品名 / 型式</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(store.activeData.archivedParts || []).length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">アーカイブされた部品はありません</td></tr>' : store.activeData.archivedParts.map(key => {
                                        const [name, model] = key.split('::');
                                        return `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${name} <span style="font-weight:400; color:var(--text-light);">[${model || '-'}]</span></td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.togglePartArchive('${name.replace(/'/g, "\\'")}', '${(model || '').replace(/'/g, "\\'")}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeletePart('${name.replace(/'/g, "\\'")}', '${(model || '').replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-box-archive"></i> アーカイブ済みのメンテナンス周期設定</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">機械名 / 内容</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(store.activeData.archivedMaintenanceTasks || []).length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">アーカイブされた周期設定はありません</td></tr>' : store.activeData.archivedMaintenanceTasks.map(id => {
                                        const task = store.activeData.tasks.find(t => t.id === id);
                                        const machine = task ? store.getMachines(true).find(m => m.id === task.machineId) : null;
                                        const label = task ? `${machine ? machine.name : '不明な機械'} / ${task.content}` : `<span style="color:var(--danger);">データ消失 (ID: ${id})</span>`;
                                        return `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${label}</td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleMaintenanceTaskArchive('${id}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteMaintenanceTask('${id}', '${label.replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-file-circle-plus"></i> 単独登録手順書</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">機械名 / 内容</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">状態</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(() => {
                                        const manualGuides = store.activeData.history.filter(h => h.isManualGuide);
                                        if (manualGuides.length === 0) return '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-light);">単独登録された手順書はありません</td></tr>';

                                        return manualGuides.map(h => {
                                            const isCommon = h.machineId === 'COMMON';
                                            const machine = isCommon ? null : store.getMachines(true).find(m => m.id === h.machineId);
                                            const machineLabel = isCommon ? '全般・共通' : (machine ? machine.name : '不明な機械');
                                            const title = this.getHistoryDisplayText(h);
                                            const statusLabel = store.isGuideArchived(h.id)
                                                ? '<span style="color:var(--text-light); font-size:0.75rem;"><i class="fa-solid fa-box-archive"></i> アーカイブ中</span>'
                                                : '<span style="color:var(--success); font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> 表示中</span>';

                                            return `
                                                <tr>
                                                    <td style="font-size:0.8rem; font-weight:700;">
                                                        ${this.escapeHtml(machineLabel)} / ${this.escapeHtml(title)}
                                                        ${h.guideCategory ? `<span style="margin-left:6px; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:1px 6px; border-radius:3px; font-size:0.65rem; font-weight:900;">${this.escapeHtml(h.guideCategory)}</span>` : ''}
                                                    </td>
                                                    <td>${statusLabel}</td>
                                                    <td style="display:flex; gap:6px;">
                                                        ${h.guide ? `<button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.openGuideModal('${h.id}')">開く</button>` : ''}
                                                        <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleGuideArchive('${h.id}')">
                                                            ${store.isGuideArchived(h.id) ? '復元' : 'アーカイブ'}
                                                        </button>
                                                        <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteGuide('${h.id}', '${title.replace(/'/g, "\\'")}')">
                                                            <i class="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('');
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-box-archive"></i> アーカイブ済みの手順書</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">機械名 / 内容</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(store.activeData.archivedGuides || []).length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">アーカイブされた手順書はありません</td></tr>' : store.activeData.archivedGuides.map(id => {
                                        const history = store.activeData.history.find(h => h.id === id);
                                        const machine = history ? store.getMachines(true).find(m => m.id === history.machineId) : null;
                                        const title = history ? this.getHistoryDisplayText(history) : `<span style="color:var(--danger);">データ消失 (ID: ${id})</span>`;
                                        const label = history ? `${machine ? machine.name : '不明な機械'} / ${title}` : title;
                                        return `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${label}</td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleGuideArchive('${id}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteGuide('${id}', '${(title || '').replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-eye-slash"></i> 非表示にしたサジェスト項目（自動補完）</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">種別</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">内容</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(() => {
                                        const arch = store.activeData.archivedSuggestions || {};
                                        const kinds = { workers: '作業者', cause: '原因', notes: '処置', content: '症状', partName: '部品名' };
                                        const rows = [];
                                        Object.keys(kinds).forEach(k => {
                                            (arch[k] || []).forEach(val => {
                                                rows.push({ kind: k, kindLabel: kinds[k], value: val });
                                            });
                                        });
                                        
                                        if (rows.length === 0) return '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-light);">非表示に設定されたサジェストはありません</td></tr>';
                                        
                                        return rows.map(r => `
                                            <tr>
                                                <td style="font-size:0.75rem; color:var(--text-light);">${r.kindLabel}</td>
                                                <td style="font-size:0.8rem; font-weight:700;">${r.value}</td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleArchivedSuggestion('${r.kind}', '${r.value.replace(/'/g, "\\'")}')">
                                                        表示に戻す
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteSuggestion('${r.kind}', '${r.value.replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('');
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            // Custom footer for this modal (override default)
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `<button class="primary-btn" onclick="app.closeModal()">閉じる</button>`;
            }
        });
    }

    toggleWorkerArchive(name) {
        store.toggleWorkerArchive(name);
        this.renderWorkerMaintenanceModal();
        this.renderWorkers();
    }

    toggleTaskArchive(tk) {
        store.toggleTaskArchive(tk);
        this.renderWorkerMaintenanceModal();
        this.renderWorkers();
    }

    toggleArchivedSuggestion(kind, value) {
        store.toggleArchivedSuggestion(kind, value);
        this.renderWorkerMaintenanceModal();
    }

    archivePart(name, model) {
        if (confirm(`部品「${name} [${model}]」をアーカイブしますか？\n（分析画面の一覧から非表示になります。管理画面から復元可能です）`)) {
            store.togglePartArchive(name, model);
            this.renderAnalysis();
        }
    }

    archiveGuide(id, title) {
        if (confirm(`手順書「${title}」をアーカイブしますか？\n（手順書一覧から非表示になります。管理画面から復元可能です）`)) {
            store.toggleGuideArchive(id);
            this.renderGuides();
        }
    }

    archiveMaintenanceTask(id, content) {
        if (confirm(`周期設定「${content}」をアーカイブしますか？\n（メイン画面やカレンダーから非表示になります。管理画面から復元可能です）`)) {
            store.toggleMaintenanceTaskArchive(id);
            this.closeModal(); // Close Machine Edit Modal
            this.renderMachines();
            this.renderCalendar();
        }
    }

    deleteMaintenanceTaskFromMachineModal(id, content, btn) {
        if (!confirm(`周期設定「${content}」を削除しますか？\nアーカイブには送らず、メンテ設定画面から削除します。\n完了済みのカレンダー履歴は残ります。周期0日の未完了予定はカレンダーに残ります。`)) return;

        store.softDeleteMaintenanceTask(id);
        const row = btn?.closest('.task-row');
        if (row) row.remove();
        this.updateDataLists();
        this.renderMachines();
        this.renderCalendar();
    }

    toggleMaintenanceTaskArchive(id) {
        store.toggleMaintenanceTaskArchive(id);
        this.renderWorkerMaintenanceModal();
        this.renderMachines();
        this.renderCalendar();
    }

    toggleGuideArchive(id) {
        store.toggleGuideArchive(id);
        this.renderWorkerMaintenanceModal();
        this.renderGuides();
    }

    togglePartArchive(name, model) {
        store.togglePartArchive(name, model);
        this.renderWorkerMaintenanceModal();
        this.renderAnalysis();
    }

    toggleMachineCategoryArchive(name) {
        store.toggleMachineCategoryArchive(name);
        this.renderWorkerMaintenanceModal(); 
    }

    addMachineCategoryAction() {
        const input = document.getElementById('new-cat-name');
        if (!input || !input.value.trim()) return;
        
        if (store.addMachineCategory(input.value)) {
            input.value = '';
            this.renderWorkerMaintenanceModal();
            this.updateDataLists();
        } else {
            alert('その区分は既に登録されているか、アーカイブされています。');
        }
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppArchiveMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppArchiveMethods.prototype[name];
        }
    }
})();
