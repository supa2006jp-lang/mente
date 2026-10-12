// Keep emergency work separate from the existing browser data on this origin.
// This classic script must load before store.js and every app script. The global
// lexical binding redirects their bare `localStorage` references only.
const localStorage = (() => {
    const separate = new URLSearchParams(window.location.search).get('workspace') === 'separate';
    const prefix = 'maintenance_workspace_separate_v1::';
    window.maintenanceWorkspace = Object.freeze({
        separate,
        storageKey: key => separate ? prefix + String(key) : String(key)
    });

    let physicalStorage;
    try {
        physicalStorage = window.localStorage;
    } catch (error) {
        // Let store.init() report the browser storage error through its normal gate.
        const fail = () => { throw error; };
        return { getItem: fail, setItem: fail, removeItem: fail };
    }
    if (!separate) return physicalStorage;

    return {
        getItem(key) { return physicalStorage.getItem(prefix + String(key)); },
        setItem(key, value) { physicalStorage.setItem(prefix + String(key), String(value)); },
        removeItem(key) { physicalStorage.removeItem(prefix + String(key)); }
    };
})();
