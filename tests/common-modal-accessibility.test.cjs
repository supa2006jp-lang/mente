const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app-maintenance-forms.js'), 'utf8');

function makeApp() {
    class MaintenanceApp {}
    const classes = new Set(['hidden']);
    const overlay = {
        classList: {
            contains: value => classes.has(value),
            add: value => classes.add(value),
            remove: value => classes.delete(value)
        }
    };
    const title = { textContent: '' };
    const handlers = [];
    const document = { activeElement: null };
    const focusable = name => ({
        name,
        isConnected: true,
        focus() { document.activeElement = this; },
        getClientRects() { return [{}]; },
        closest() { return null; }
    });
    const trigger = focusable('trigger');
    const settings = focusable('settings');
    const close = focusable('close');
    const save = focusable('save');
    const container = {
        dataset: {},
        className: '',
        innerHTML: '',
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        querySelector(selector) { return selector === '#modal-title' ? title : null; },
        querySelectorAll() { return [close, save]; },
        contains(element) { return element === this || element === close || element === save; },
        addEventListener(type, handler) { if (type === 'keydown') handlers.push(handler); },
        focus() { document.activeElement = this; }
    };
    document.getElementById = id => ({
        'modal-overlay': overlay,
        'modal-container': container,
        'modal-save-btn': save,
        'app-settings-btn': settings
    })[id] || null;
    document.activeElement = trigger;
    const context = vm.createContext({ MaintenanceApp, document, console });
    vm.runInContext(source, context, { filename: 'app-maintenance-forms.js' });
    const app = new MaintenanceApp();
    app.clearGuidePhotoTokenHighlights = () => {};
    return { app, document, overlay, container, title, handlers, trigger, settings, close, save };
}

function keyEvent(key, shiftKey = false) {
    return {
        key,
        shiftKey,
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; }
    };
}

test('common modal presents titles as text and restores focus after closing', () => {
    const { app, document, overlay, container, title, handlers, trigger, settings } = makeApp();
    const machineName = '<img src=x onerror=alert(1)>';
    app.openModal('sample', machineName);

    assert.equal(title.textContent, machineName);
    assert.doesNotMatch(container.innerHTML, /onerror=alert/);
    assert.equal(container.attributes.role, 'dialog');
    assert.equal(container.attributes['aria-modal'], 'true');
    assert.equal(container.attributes['aria-labelledby'], 'modal-title');
    assert.equal(overlay.classList.contains('hidden'), false);
    assert.equal(document.activeElement, container);
    assert.equal(handlers.length, 1);

    app.closeModal();
    assert.equal(overlay.classList.contains('hidden'), true);
    assert.equal(document.activeElement, trigger);

    app.openModal('sample', '再表示');
    trigger.isConnected = false;
    app.closeModal();
    assert.equal(document.activeElement, settings);
});

test('Tab stays in the modal and Escape closes it without duplicating handlers', () => {
    const { app, document, overlay, container, handlers, close, save, trigger } = makeApp();
    app.openModal('sample', '設定');
    const initialBackward = keyEvent('Tab', true);
    handlers[0](initialBackward);
    assert.equal(initialBackward.defaultPrevented, true);
    assert.equal(document.activeElement, save);
    document.activeElement = container;
    const initialForward = keyEvent('Tab');
    handlers[0](initialForward);
    assert.equal(initialForward.defaultPrevented, true);
    assert.equal(document.activeElement, close);
    document.activeElement = save;
    const forward = keyEvent('Tab');
    handlers[0](forward);
    assert.equal(forward.defaultPrevented, true);
    assert.equal(document.activeElement, close);

    const backward = keyEvent('Tab', true);
    handlers[0](backward);
    assert.equal(backward.defaultPrevented, true);
    assert.equal(document.activeElement, save);

    const submenuEscape = keyEvent('Escape');
    submenuEscape.target = { closest: () => ({}) };
    handlers[0](submenuEscape);
    assert.equal(overlay.classList.contains('hidden'), false);

    const escape = keyEvent('Escape');
    handlers[0](escape);
    assert.equal(escape.defaultPrevented, true);
    assert.equal(overlay.classList.contains('hidden'), true);
    assert.equal(document.activeElement, trigger);

    app.openModal('sample', '再表示');
    assert.equal(handlers.length, 1);
});
