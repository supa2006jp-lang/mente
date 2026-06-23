(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppDepartmentMethods extends MaintenanceApp {
    // --- Department Management ---
    updateDepartmentUI() {
        const el = document.getElementById('current-dept-display');
        const departments = store.data.departments || [];
        const current = departments.find(d => d.id === store.data.currentDepartmentId);
        if (el && current) el.textContent = current.name;
    }

    openDepartmentModal() {
        this.openModal('dept', '部署切替・登録', () => {
            const content = document.getElementById('modal-content');
            const departments = store.data.departments || [];
            const canDelete = departments.length > 1;
            
            content.innerHTML = `
                <div style="padding:10px;">
                    <p style="font-size:0.9rem; color:var(--text-light); margin-bottom:16px;">
                        切り替えたい部署を選択してください。名前変更・削除もここで行えます。データは部署ごとに独立して管理されます。
                    </p>
                    <div id="dept-list-container" style="display:flex; flex-direction:column; gap:10px; margin-bottom:24px; max-height:300px; overflow-y:auto; padding-right:4px;">
                        ${departments.map(d => `
                            <div class="dept-manage-row"
                                 data-id="${this.escapeHtml(d.id)}"
                                 style="display:grid; grid-template-columns:minmax(0, 1fr) auto auto; gap:8px; align-items:center; padding:10px; border:1px solid ${d.id === store.data.currentDepartmentId ? 'var(--primary)' : 'var(--border)'}; background:${d.id === store.data.currentDepartmentId ? 'var(--primary-light)' : 'white'}; border-radius:12px;">
                                <button class="nav-btn dept-item-btn"
                                        data-id="${this.escapeHtml(d.id)}"
                                        style="width:100%; padding:8px; border:none; background:transparent; text-align:left; cursor:pointer; color:var(--text-main); min-width:0;">
                                    <i class="fa-solid fa-building" style="margin-right:10px; color:${d.id === store.data.currentDepartmentId ? 'var(--primary)' : 'var(--text-light)'}"></i>
                                    <span style="font-weight:700;">${this.escapeHtml(d.name)}</span>
                                    ${d.id === store.data.currentDepartmentId ? '<span style="margin-left:8px; font-size:0.75rem; color:var(--primary); font-weight:900;">[選択中]</span>' : ''}
                                </button>
                                <button type="button" class="secondary-btn dept-rename-btn"
                                        data-id="${this.escapeHtml(d.id)}"
                                        style="padding:7px 10px; font-size:0.75rem; white-space:nowrap;">
                                    <i class="fa-solid fa-pen"></i> 名前
                                </button>
                                <button type="button" class="secondary-btn dept-delete-btn"
                                        data-id="${this.escapeHtml(d.id)}"
                                        ${canDelete ? '' : 'disabled'}
                                        title="${canDelete ? '部署を削除' : '最後の部署は削除できません'}"
                                        style="padding:7px 10px; font-size:0.75rem; white-space:nowrap; color:${canDelete ? 'var(--danger)' : 'var(--text-light)'}; border-color:${canDelete ? '#fecaca' : 'var(--border)'}; background:${canDelete ? '#fff7f7' : '#f8fafc'};">
                                    <i class="fa-solid fa-trash"></i> 削除
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="border-top:1px dashed var(--border); padding-top:20px;">
                        <label style="display:block; font-size:0.85rem; font-weight:700; margin-bottom:10px; color:var(--text-main);">
                            <i class="fa-solid fa-plus-circle" style="color:var(--primary);"></i> 新規部署を登録
                        </label>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <input type="text" id="new-dept-name" placeholder="例: 製造第一課" 
                                   style="flex:1; padding:12px; border-radius:10px; border:1.5px solid var(--border); font-size:0.95rem; outline:none;"
                                   onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
                            <button id="btn-create-dept" class="primary-btn" style="width:auto; padding:12px 20px; font-size:0.9rem; white-space:nowrap;">作成・切替</button>
                        </div>
                        <p style="font-size:0.75rem; color:var(--text-light); margin-top:10px;">
                            ※部署を作成すると、その部署専用の空のデータセットが作成されます。
                        </p>
                    </div>
                </div>
            `;

            // Listeners for selection
            content.querySelectorAll('.dept-item-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    if (id === store.data.currentDepartmentId) {
                        this.closeModal();
                        return;
                    }
                    if (confirm(`部署を「${btn.querySelector('span').textContent}」に切り替えますか？`)) {
                        store.data.currentDepartmentId = id;
                        await store.save();
                        location.reload(); 
                    }
                });
            });

            content.querySelectorAll('.dept-rename-btn').forEach(btn => {
                btn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    await this.renameDepartment(btn.dataset.id);
                });
            });

            content.querySelectorAll('.dept-delete-btn').forEach(btn => {
                btn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    await this.deleteDepartment(btn.dataset.id);
                });
            });

            // Create new
            const createBtn = content.querySelector('#btn-create-dept');
            const input = content.querySelector('#new-dept-name');
            
            createBtn.onclick = async () => {
                const name = input.value.trim();
                if (!name) return alert('部署名を入力してください。');
                
                const id = 'dept_' + Date.now();
                if (!store.data.departments) store.data.departments = [];
                if (!store.data.deptData) store.data.deptData = {};
                
                store.data.departments.push({ id, name });
                store.data.deptData[id] = {
                    machines: [], tasks: [], history: [], partsMaster: [], archivedWorkers: [], archivedTasks: []
                };
                store.data.currentDepartmentId = id;
                await store.save();
                
                alert(`新しく「${name}」部署を登録し、切り替えました。`);
                location.reload();
            };
        });
    }

    async renameDepartment(id) {
        const departments = store.data.departments || [];
        const dept = departments.find(d => String(d.id) === String(id));
        if (!dept) return alert('部署が見つかりません。');

        const currentName = dept.name || '';
        const nextName = prompt('新しい部署名を入力してください。', currentName);
        if (nextName === null) return;

        const name = nextName.trim();
        if (!name) return alert('部署名を入力してください。');
        if (name === currentName) return;
        if (departments.some(d => String(d.id) !== String(id) && (d.name || '').trim() === name)) {
            return alert('同じ名前の部署が既にあります。');
        }

        dept.name = name;
        await store.save();
        this.updateDepartmentUI();
        this.openDepartmentModal();
    }

    async deleteDepartment(id) {
        const departments = store.data.departments || [];
        const deptIndex = departments.findIndex(d => String(d.id) === String(id));
        if (deptIndex < 0) return alert('部署が見つかりません。');
        if (departments.length <= 1) return alert('最後の部署は削除できません。');

        const dept = departments[deptIndex];
        const deptData = store.data.deptData?.[id] || {};
        const summary = [
            `機械: ${(deptData.machines || []).length}件`,
            `メンテ履歴: ${(deptData.history || []).length}件`,
            `定期タスク: ${(deptData.tasks || []).length}件`,
            `部品: ${(deptData.partsMaster || []).length}件`,
            `写真: ${(deptData.photoManagerItems || []).length}件`
        ].join(' / ');

        const firstConfirm = confirm(`部署「${dept.name}」を削除しますか？\n\nこの部署のデータも削除されます。\n${summary}`);
        if (!firstConfirm) return;
        const secondConfirm = confirm(`本当に削除しますか？\n削除前に必要なら「部署出力」でバックアップしてください。\n\n削除する部署: ${dept.name}`);
        if (!secondConfirm) return;

        departments.splice(deptIndex, 1);
        if (store.data.deptData) delete store.data.deptData[id];

        const deletedCurrent = String(store.data.currentDepartmentId) === String(id);
        if (deletedCurrent) {
            store.data.currentDepartmentId = departments[0]?.id || 'dept_default';
        }

        await store.save();
        if (deletedCurrent) {
            alert(`部署「${dept.name}」を削除しました。別の部署へ切り替えます。`);
            location.reload();
            return;
        }

        alert(`部署「${dept.name}」を削除しました。`);
        this.openDepartmentModal();
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppDepartmentMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppDepartmentMethods.prototype[name];
        }
    }
})();
