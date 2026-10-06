(function () {
    function showStorageGate(title, message, { allowNew = false, onNew = null, customize = null, onReload = null } = {}) {
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
        reload.addEventListener('click', () =>
            onReload ? onReload({ gate, actions, reload }) : window.location.reload());
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
        customize?.({ gate, actions, reload });
        panel.append(heading, body, actions);
        gate.appendChild(panel);
        document.body.appendChild(gate);
        reload.focus();
    }

    function showSuddenDecreaseGate(detail = {}) {
        const openGate = document.getElementById('maintenance-storage-gate');
        if (openGate?._storageGateKind === 'shrink'
            && openGate._shrinkBeforeCount === detail.beforeCount
            && openGate._shrinkAfterCount === detail.afterCount) return;
        const before = Number.isSafeInteger(detail.beforeCount) ? detail.beforeCount.toLocaleString('ja-JP') : '不明';
        const after = Number.isSafeInteger(detail.afterCount) ? detail.afterCount.toLocaleString('ja-JP') : '不明';
        const savedDate = detail.savedAt ? new Date(detail.savedAt) : null;
        const savedAt = savedDate && Number.isFinite(savedDate.getTime())
            ? new Intl.DateTimeFormat('ja-JP', {
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            }).format(savedDate)
            : '記録なし';
        showStorageGate(
            'データが急に少なくなりました',
            `前回保存した内容は ${before} 件、現在は ${after} 件です。安全のため保存を一時停止しました。\n前回の保存日時: ${savedAt}\n意図しない減少なら、前回保存した記録に戻してください。動画・音声の本体など、別領域で先に削除されたファイルは戻せない場合があります。`,
            {
                onReload: async ({ actions }) => {
                    Array.from(actions.children).forEach(button => { button.disabled = true; });
                    try {
                        await store.verifySuddenDecreaseSource();
                        window.location.reload();
                    } catch (error) {
                        console.error('Could not verify previous saved data:', error);
                        showStorageGate(
                            '前回保存した記録を確認できませんでした',
                            '前回の記録が変更されたか、保存領域を確認できませんでした。再読み込みして最新の記録を確認してください。\n詳細: ' + (error?.message || '不明なエラー')
                        );
                    }
                },
                customize: ({ gate, actions, reload }) => {
                    gate._storageGateKind = 'shrink';
                    gate._shrinkBeforeCount = detail.beforeCount;
                    gate._shrinkAfterCount = detail.afterCount;
                    reload.textContent = '前回保存した記録に戻す';
                    reload.style.cssText = 'padding:10px 16px;border:1px solid #1d4ed8;border-radius:8px;background:#1d4ed8;color:#fff;font:inherit;cursor:pointer;';
                    const keepReduced = document.createElement('button');
                    keepReduced.type = 'button';
                    keepReduced.textContent = '減った内容を保存する';
                    keepReduced.style.cssText = 'padding:10px 16px;border:1px solid #64748b;border-radius:8px;background:#f8fafc;color:#0f172a;font:inherit;cursor:pointer;';
                    keepReduced.addEventListener('click', async () => {
                        keepReduced.disabled = true;
                        reload.disabled = true;
                        try {
                            await store.confirmSuddenDecrease();
                            window.location.reload();
                        } catch (error) {
                            if (error?.code === 'SUDDEN_DATA_DECREASE') {
                                showSuddenDecreaseGate(error);
                                if (document.getElementById('maintenance-storage-gate') === gate) {
                                    keepReduced.disabled = false;
                                    reload.disabled = false;
                                }
                                return;
                            }
                            console.error('Could not confirm sudden data decrease:', error);
                            showStorageGate(
                                '減った内容を保存できませんでした',
                                '保存は完了していません。前回保存した記録を開き直してください。\n詳細: ' + (error?.message || '不明なエラー')
                            );
                        }
                    });
                    actions.appendChild(keepReduced);
                }
            }
        );
    }

    window.addEventListener('maintenance-save-status', (event) => {
        if (event.detail?.status === 'shrink') showSuddenDecreaseGate(event.detail);
    });
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
            const action = String(error?.message || '').includes('他のタブ')
                ? 'このアプリを開いている別のタブを閉じてから再読み込みしてください。'
                : 'ChromeのプロフィールとURLを確認し、再読み込みしてください。';
            showStorageGate(
                '保存データを読み込めませんでした',
                '空のデータで既存情報を上書きしないよう、編集と保存を停止しました。' + action + '\n詳細: ' + (error?.message || '不明なエラー')
            );
        }
    });
})();
