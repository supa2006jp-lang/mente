(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppPersistenceMethods extends MaintenanceApp {
    // --- Persistence Effects ---
    setupSideEffects() {
        const importBtn = document.getElementById('btn-import-trigger');
        const fileInput = document.getElementById('btn-import');
        
        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (store.importFromJSON(event.target.result)) {
                        location.reload();
                    } else {
                        alert('インポートに失敗しました。ファイル形式を確認してください。');
                    }
                };
                reader.readAsText(file);
            });
        }

        const exportBtn = document.getElementById('btn-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const data = store.exportAsJSON();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                // 1. Download timestamped backup (for user record)
                const aBatch = document.createElement('a');
                aBatch.href = url;
                aBatch.download = `maintenance_ALL_backup_${new Date().toISOString().split('T')[0]}.json`;
                aBatch.click();

                // Small delay to ensure browser handles both
                setTimeout(() => {
                    // 2. Download latest.json (for shared use)
                    const aLatest = document.createElement('a');
                    aLatest.href = url;
                    aLatest.download = `latest.json`;
                    aLatest.click();
                    URL.revokeObjectURL(url);
                }, 100);
            });
        }

        // --- Single Dept Export ---
        const exportDeptBtn = document.getElementById('btn-export-dept');
        if (exportDeptBtn) {
            exportDeptBtn.addEventListener('click', () => {
                const deptName = store.data.departments.find(d => d.id === store.data.currentDepartmentId)?.name || 'dept';
                const data = store.exportCurrentDeptAsJSON();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `maintenance_${deptName}_only_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        // --- Single Dept Import ---
        const importDeptTrigger = document.getElementById('btn-import-dept-trigger');
        const fileDeptInput = document.getElementById('btn-import-dept');
        if (importDeptTrigger && fileDeptInput) {
            importDeptTrigger.addEventListener('click', () => fileDeptInput.click());
            fileDeptInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const currentDeptName = store.data.departments.find(d => d.id === store.data.currentDepartmentId)?.name || '不明';
                if (!confirm(`現在開いている「${currentDeptName}」のデータのみを、選択したファイルの内容で上書きしますか？\n他の部署のデータには影響しません。`)) {
                    fileDeptInput.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    const result = store.importToCurrentDeptFromJSON(event.target.result);
                    if (result.success) {
                        alert(`「${currentDeptName}」のデータを更新しました。`);
                        location.reload();
                    } else {
                        alert(result.message);
                    }
                };
                reader.readAsText(file);
                fileDeptInput.value = ''; // reset for next use
            });
        }

        // Worktime Memo Persistence (Per Department)
        const wtMemo = document.getElementById('worktime-memo');
        if (wtMemo) {
            const deptId = store.data.currentDepartmentId || 'default';
            const memoKey = `worktime_memo_${deptId}`;
            wtMemo.value = localStorage.getItem(memoKey) || '';
            wtMemo.addEventListener('input', (e) => {
                localStorage.setItem(memoKey, e.target.value);
            });
        }
    }

    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppPersistenceMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppPersistenceMethods.prototype[name];
        }
    }
})();
