'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Calendar dates in the app follow the user's local (Japan) day, including
// the hours when the UTC date is still yesterday.
process.env.TZ = 'Asia/Tokyo';

function makeApp(instant, includePhotoManager = false) {
    class FixedDate extends Date {
        constructor(...args) { super(...(args.length ? args : [instant])); }
        static now() { return new Date(instant).getTime(); }
    }
    const values = new Map();
    const prompts = [];
    const context = vm.createContext({
        MaintenanceApp: class {},
        Date: FixedDate,
        localStorage: {
            getItem(key) { return values.get(key) ?? null; },
            setItem(key, value) { values.set(key, String(value)); }
        },
        prompt(message, value) { prompts.push({ message, value }); return value; },
        console
    });
    for (const name of ['app-maintenance-forms.js', 'app-history.js', ...(includePhotoManager ? ['app-photo-manager.js'] : [])]) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', name), 'utf8'), context, { filename: name });
    }
    const app = new context.MaintenanceApp();
    app.updateHistoryPeriodOptions = () => {};
    return { app, prompts, values };
}

test('history custom date defaults to Japan today just after midnight', () => {
    const { app, prompts, values } = makeApp('2026-11-13T15:30:00.000Z');
    app.onPeriodChange({ value: 'custom' }, () => {});
    assert.equal(prompts[0].value, '2026-11-14');
    assert.equal(values.get('customStartDate'), '2026-11-14');
});

test('fiscal-year day count starts at one after April 1 midnight in Japan', () => {
    const { app } = makeApp('2026-03-31T15:30:00.000Z');
    assert.equal(app.getPeriodDays('fiscal_year'), 1);
});

test('photo age cutoff uses the local calendar day', () => {
    const { app } = makeApp('2026-11-13T15:30:00.000Z', true);
    assert.equal(app.getPhotoManagerPageOnlyAgeCutoff('3m'), '2026-08-14');
});
