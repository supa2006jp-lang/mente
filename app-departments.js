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
            
            content.innerHTML = `
                <div style="padding:10px;">
                    <p style="font-size:0.9rem; color:var(--text-light); margin-bottom:16px;">
                        切り替えたい部署を選択してください。データは部署ごとに独立して管理されます。
                    </p>
                    <div id="dept-list-container" style="display:flex; flex-direction:column; gap:10px; margin-bottom:24px; max-height:300px; overflow-y:auto; padding-right:4px;">
                        ${departments.map(d => `
                            <button class="nav-btn dept-item-btn" 
                                    data-id="${d.id}" 
                                    style="width:100%; padding:14px; border:1px solid ${d.id === store.data.currentDepartmentId ? 'var(--primary)' : 'var(--border)'}; background:${d.id === store.data.currentDepartmentId ? 'var(--primary-light)' : 'white'}; text-align:left; cursor:pointer; color:var(--text-main);">
                                <i class="fa-solid fa-building" style="margin-right:10px; color:${d.id === store.data.currentDepartmentId ? 'var(--primary)' : 'var(--text-light)'}"></i>
                                <span style="font-weight:700;">${d.name}</span>
                                ${d.id === store.data.currentDepartmentId ? '<span style="float:right; font-size:0.75rem; color:var(--primary); font-weight:900;">[選択中]</span>' : ''}
                            </button>
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
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    if (id === store.data.currentDepartmentId) {
                        this.closeModal();
                        return;
                    }
                    if (confirm(`部署を「${btn.querySelector('span').textContent}」に切り替えますか？`)) {
                        store.data.currentDepartmentId = id;
                        store.save();
                        location.reload(); 
                    }
                });
            });

            // Create new
            const createBtn = content.querySelector('#btn-create-dept');
            const input = content.querySelector('#new-dept-name');
            
            createBtn.onclick = () => {
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
                store.save();
                
                alert(`新しく「${name}」部署を登録し、切り替えました。`);
                location.reload();
            };
        });
    }
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppDepartmentMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppDepartmentMethods.prototype[name];
        }
    }
})();
