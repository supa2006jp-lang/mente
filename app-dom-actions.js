(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    const runAndCloseSettings = (app, action) => {
        app.closeAppSettingsPanel();
        action();
    };

    const handlers = {
        'open-view-guide': (app, button) => {
            app.openViewGuideViewer(button.dataset.viewName || app.currentView, button.dataset.guideIndex || 0);
        },
        'close-view-guide': (app) => app.closeViewGuideViewer(),
        'close-view-guide-if-backdrop': (app, target, event) => {
            if (event.target === target) app.closeViewGuideViewer();
        },
        'close-app-settings': (app) => app.closeAppSettingsPanel(),
        'close-app-settings-if-backdrop': (app, target, event) => {
            if (event.target === target) app.closeAppSettingsPanel();
        },
        'app-settings-open-departments': (app) => runAndCloseSettings(app, () => app.openDepartmentModal()),
        'app-settings-open-members': (app) => runAndCloseSettings(app, () => app.openShiftMemberTypeManageModal()),
        'app-settings-open-row-templates': (app) => runAndCloseSettings(app, () => app.openShiftRowTemplateManageModal()),
        'app-settings-open-todo-requests': (app) => runAndCloseSettings(app, () => {
            app.switchView('todos');
            setTimeout(() => app.openKanbanRequestDashboard(), 80);
        }),
        'app-settings-open-activity-log': (app) => runAndCloseSettings(app, () => app.openSystemActivityLogPanel()),
        'app-settings-export-data': (app) => runAndCloseSettings(app, () => document.getElementById('btn-export')?.click())
    };

    MaintenanceApp.prototype.setupDelegatedActions = function () {
        if (this._delegatedActionsReady) return;
        this._delegatedActionsReady = true;

        document.addEventListener('click', (event) => {
            const target = event.target.closest('[data-action]');
            if (!target) return;

            const handler = handlers[target.dataset.action];
            if (!handler) return;

            handler(this, target, event);
        });
    };
})();
