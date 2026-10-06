(function () {
    function showStorageGate(title, message, { allowNew = false, onNew = null } = {}) {
        if (typeof document === 'undefined' || !document.body) {
            alert(message);
            return;
        }
        document.getElementById('maintenance-storage-gate')?.remove();
        const gate = document.createElement('div');
        gate.id = 'maintenance-storage-gate';
        gate.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.88);font-family:system-ui,sans-serif;';
        const panel = document.createElement('div');
        panel.style.cssText = 'width:min(520px,100%);padding:28px;border-radius:14px;background:#fff;color:#111827;box-shadow:0 24px 64px rgba(0,0,0,.35);';
        const heading = document.createElement('h2');
        heading.textContent = title;
        heading.style.cssText = 'margin:0 0 12px;font-size:21px;';
        const body = document.createElement('p');
        body.textContent = message;
        body.style.cssText = 'margin:0 0 18px;line-height:1.7;white-space:pre-line;';
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;';
        const reload = document.createElement('button');
        reload.type = 'button';
        reload.textContent = '再読み込み';
        reload.style.cssText = 'padding:10px 16px;border:1px solid #64748b;border-radius:8px;background:#f8fafc;color:#0f172a;font:inherit;cursor:pointer;';
        reload.addEventListener('click', () => window.location.reload());
        actions.appendChild(reload);
        if (allowNew) {
            const startNew = document.createElement('button');
            startNew.type = 'button';
            startNew.textContent = '新規データで開始';
            startNew.style.cssText = 'padding:10px 16px;border:1px solid #1d4ed8;border-radius:8px;background:#1d4ed8;color:#fff;font:inherit;cursor:pointer;';
            startNew.addEventListener('click', () => {
                try {
                    onNew?.();
                    gate.remove();
                } catch (error) {
                    console.error('Could not start a new data store:', error);
                    showStorageGate('保存領域を開始できませんでした', '保存領域の確認に失敗しました。ページを再読み込みしてください。');
                }
            });
            actions.appendChild(startNew);
        }
        panel.append(heading, body, actions);
        gate.appendChild(panel);
        document.body.appendChild(gate);
        reload.focus();
    }

    function startApp() {
        window.app = new MaintenanceApp();
        window.setTimeout(() => window.app?.runScheduledDataDiagnostics?.(false), 1200);
    }

    window.addEventListener('DOMContentLoaded', async () => {
        try {
            const loadStatus = await store.init();
            if (loadStatus === 'empty-unconfirmed') {
                showStorageGate(
                    '保存データが見つかりません',
                    '以前のデータがある場合は、同じChromeプロフィールと同じURLで開いているか確認してください。新しく使い始める場合だけ「新規データで開始」を選んでください。',
                    {
                        allowNew: true,
                        onNew: () => {
                            store.confirmEmptyStore();
                            startApp();
                        }
                    }
                );
                return;
            }
            startApp();
        } catch (error) {
            console.error('Failed to initialize app state:', error);
            showStorageGate(
                '保存データを読み込めませんでした',
                '空のデータで既存情報を上書きしないよう、編集と保存を停止しました。ChromeのプロフィールとURLを確認し、再読み込みしてください。\n詳細: ' + (error?.message || '不明なエラー')
            );
        }
    });
})();
