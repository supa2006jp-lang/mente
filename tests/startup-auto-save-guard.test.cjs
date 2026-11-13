'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(safe) {
    class MaintenanceApp {}
    const activeData = { shiftNotebooks: {} };
    let saves = 0;
    const store = {
        activeData,
        startupSaveSafe: safe,
        save() { saves += 1; }
    };
    for (const name of ['app-photo-manager.js', 'app-settings.js']) {
        const source = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
        vm.runInNewContext(source, { MaintenanceApp, store, console }, { filename: name });
    }
    const app = new MaintenanceApp();
    let ensured = 0;
    let logged = 0;
    app.ensurePhotoManagerData = () => { ensured += 1; };
    app.getLocalDateString = () => '2026-11-13';
    app.getPhotoManagerToday = () => '2026-11-13';
    app.getScheduledDataDiagnosticsReport = () => ({ issueCount: 0, photoCount: 0 });
    app.addSystemActivityLog = () => { logged += 1; };
    return { app, activeData, get saves() { return saves; }, get ensured() { return ensured; }, get logged() { return logged; } };
}

test('empty startup never persists photo cleanup or scheduled diagnostics', async () => {
    const h = harness(false);
    await h.app.cleanupExpiredShiftNotebookPhotos();
    const report = h.app.runScheduledDataDiagnostics(false);
    assert.equal(report.photoCount, 0);
    assert.equal(h.saves, 0);
    assert.equal(h.ensured, 0);
    assert.equal(h.logged, 0);
    assert.equal(h.activeData.photoManagerLastAutoCleanup, undefined);
    assert.equal(h.activeData.dataDiagnosticsLastRun, undefined);
});

test('loaded data retains normal scheduled maintenance writes', async () => {
    const h = harness(true);
    await h.app.cleanupExpiredShiftNotebookPhotos();
    h.app.runScheduledDataDiagnostics(false);
    assert.equal(h.saves, 2);
    assert.equal(h.ensured, 1);
    assert.equal(h.activeData.photoManagerLastAutoCleanup, '2026-11-13');
    assert.equal(h.activeData.dataDiagnosticsLastRun, '2026-11-13');
});
