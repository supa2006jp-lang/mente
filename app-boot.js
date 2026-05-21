(function () {
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            await store.init();
            window.app = new MaintenanceApp();
        } catch (error) {
            console.error('Failed to initialize app state:', error);
            alert('初期化に失敗しました。ページをリロードしてください。');
            window.app = new MaintenanceApp();
        }
    });
})();
