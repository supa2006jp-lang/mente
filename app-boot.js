(function () {
    window.addEventListener('DOMContentLoaded', async () => {
        // Retired workspace links now use the normal save area; clear the old label in the URL.
        try {
            const url = new URL(window.location.href);
            if (url.searchParams.has('workspace')) {
                url.searchParams.delete('workspace');
                window.history.replaceState(window.history.state, '', url.href);
            }
        } catch (error) {
            console.warn('Could not update the retired workspace URL:', error);
        }
        try {
            await store.init();
        } catch (error) {
            store.storageWarning = error;
            console.error('Failed to initialize app state:', error);
        }
        try {
            window.app = new MaintenanceApp();
            window.setTimeout(() => window.app?.runScheduledDataDiagnostics?.(false), 1200);
        } catch (error) {
            console.error('Failed to start app:', error);
            alert('アプリの起動に失敗しました。ページを再読み込みしてください。');
        }
    });
})();
