/** 
 * Store.js - Data Management & Persistence
 */
class MaintenanceStore {
    constructor() {
        this.DB_NAME = 'FactoryMaintenanceDB';
        // Keep the existing database version so browsers that already opened v3 can still load it.
        this.DB_VERSION = 3;
        this.STORE_NAME = 'state';
        this.MEDIA_STORE_NAME = 'media';
        this.STORAGE_KEY = 'factory_maintenance_next_data_v2'; // Versioning for department support
        this.STORAGE_SELECTION_KEY = 'maintenance_selected_storage_source_v1';
        this.storageWarning = null;
        this.lastSuccessfulSaveAt = null;
        this.startupStateSource = 'default';
        this.startupRepairSource = null;
        this.startupSaveSafe = false;
        this.saveTarget = 'indexeddb';
        this.storageCandidates = {};
        this.malformedStorageReports = [];
        this._malformedPrimary = {};
        this._repairCandidates = {};
        this._malformedBackupWarning = false;
        this._saveRequestedRevision = 0;
        this._savePersistedRevision = 0;
        this._saveQueue = [];
        this._saveQueueRunning = false;
        this._saveIdleWaiters = [];
        this._atomicSaveBatch = null;
        this._rejectedSaveDataRefs = new WeakSet();
        this.data = {
            currentDepartmentId: 'dept_default',
            departments: [
                { id: 'dept_default', name: '初期部署' }
            ],
            deptData: {
                'dept_default': {
                    machines: [],
                    tasks: [],
                    history: [],
                    partsMaster: [],
                    archivedWorkers: [],
                    archivedTasks: [],
                    archivedParts: []
                }
            },
            settings: {
                currentFile: 'latest.json',
                theme: 'light'
            }
        };
        // load() is removed from constructor. It will be called via async init().
    }

    // Helper to get current department data
    get activeData() {
        if (!this.data.currentDepartmentId) this.data.currentDepartmentId = 'dept_default';
        if (!this.data.deptData) this.data.deptData = {};
        if (!this.data.deptData[this.data.currentDepartmentId]) {
            this.data.deptData[this.data.currentDepartmentId] = {
                machines: [], tasks: [], history: [], partsMaster: [], archivedWorkers: [], archivedTasks: [],
                archivedParts: [],
                machineCategories: [], archivedMachineCategories: []
            };
        }
        return this.data.deptData[this.data.currentDepartmentId];
    }

    getActiveSaveBackend() {
        return this.db && this.saveTarget !== 'localStorage' ? 'indexeddb' : 'localStorage';
    }

    getStoredDataSummary(data, source, key = this.STORAGE_KEY) {
        const fields = [
            'machines', 'tasks', 'history', 'partsMaster', 'partStockMovements',
            'archivedWorkers', 'archivedTasks', 'archivedParts', 'archivedMaintenanceTasks', 'archivedGuides',
            'machineCategories', 'archivedMachineCategories', 'tipsNotes',
            'localTodos', 'localTodoLogs', 'historyImportLogs', 'shiftNotebookGroupPresets',
            'photoManagerLibrary', 'photoManagerVideos', 'photoManagerAudios'
        ];
        const departments = data?.deptData && typeof data.deptData === 'object' && !Array.isArray(data.deptData)
            ? Object.values(data.deptData)
            : [data];
        const total = departments.reduce((sum, department) => {
            if (!department || typeof department !== 'object') return sum;
            const records = fields.reduce((count, field) => count + (Array.isArray(department[field]) ? department[field].length : 0), 0);
            const outlook = department.outlookAssist || {};
            const outlookRecords = ['templates', 'recipientSets', 'recipientContacts', 'insertHistory']
                .reduce((count, field) => count + (Array.isArray(outlook[field]) ? outlook[field].length : 0), 0);
            return sum + records + outlookRecords
                + Object.keys(outlook.draftsByWorker || {}).length
                + Object.keys(department.shiftNotebooks || {}).length
                + Object.keys(department.memos || {}).length;
        }, 0);
        const savedAt = data?.settings?.lastSuccessfulSaveAt || null;
        return {
            source,
            key,
            total,
            departments: Array.isArray(data?.departments) ? data.departments.length : departments.length,
            savedAt,
            savedAtMs: Date.parse(savedAt || '') || 0
        };
    }

    readLocalStorageCandidate() {
        for (const key of [this.STORAGE_KEY, 'factory_maintenance_next_data']) {
            let raw;
            try {
                raw = localStorage.getItem(key);
                if (!raw) continue;
                const data = JSON.parse(raw);
                const issues = this.getStoredDataShapeIssues(data);
                if (issues.length) {
                    this.rememberMalformedStoredData('localStorage', key, data, raw, issues);
                    continue;
                }
                return { data, summary: this.getStoredDataSummary(data, 'localStorage', key) };
            } catch (error) {
                if (raw) this.rememberMalformedStoredData('localStorage', key, null, raw, ['JSONを解析できません']);
                console.error(`Failed to load storage data (${key})`, error);
            }
        }
        return null;
    }

    getStorageSourcePreference() {
        const locations = [];
        if (typeof sessionStorage !== 'undefined') locations.push(sessionStorage);
        locations.push(localStorage);
        for (const storage of locations) {
            try {
                const value = JSON.parse(storage.getItem(this.STORAGE_SELECTION_KEY) || 'null');
                if (['indexeddb', 'localStorage'].includes(value?.source)) {
                    return {
                        source: value.source,
                        selectedAtMs: Date.parse(value.selectedAt || '') || 0,
                        alternate: value.alternate || null
                    };
                }
            } catch (_) {}
        }
        return null;
    }

    chooseStartupCandidate(indexedCandidate, localCandidate) {
        if (!indexedCandidate) return localCandidate;
        if (!localCandidate) return indexedCandidate;
        const preference = this.getStorageSourcePreference();
        if (preference?.source) {
            const selected = preference.source === 'indexeddb' ? indexedCandidate : localCandidate;
            const alternate = preference.source === 'indexeddb' ? localCandidate : indexedCandidate;
            if (preference.alternate) {
                const current = alternate.summary;
                const previous = preference.alternate;
                if (current.savedAt === previous.savedAt
                    && current.total === previous.total
                    && current.departments === previous.departments
                    && current.key === previous.key) return selected;
            } else if (alternate.summary.savedAtMs <= preference.selectedAtMs) {
                return selected;
            }
        }
        const indexedTime = indexedCandidate.summary.savedAtMs;
        const localTime = localCandidate.summary.savedAtMs;
        if (localTime > indexedTime) return localCandidate;
        if (indexedTime > localTime) return indexedCandidate;
        return localCandidate.summary.total > indexedCandidate.summary.total ? localCandidate : indexedCandidate;
    }

    applyLoadedCandidate(candidate) {
        // Normalization only touches a working copy. The original candidate remains
        // available in its storage backend until a deliberate save completes.
        this.applyStoredData(this.cloneStoredData(candidate.data));
        this.startupStateSource = candidate.summary.source;
        this.startupRepairSource = candidate.repaired ? candidate.summary.source : null;
        this.saveTarget = candidate.summary.source;
        // Background startup writes stay disabled while a local fallback is active.
        // User edits still save to that fallback without touching IndexedDB.
        this.startupSaveSafe = candidate.summary.source === 'indexeddb' && !candidate.repaired;
    }

    async readIndexedDbCandidate() {
        if (!this.db) throw new Error('IndexedDBを開けませんでした。');
        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction(this.STORE_NAME, 'readonly');
                const request = tx.objectStore(this.STORE_NAME).get(this.STORAGE_KEY);
                request.onsuccess = () => {
                    const data = request.result;
                    if (!this.isValidStoredData(data)) return reject(new Error('IndexedDBの保存データを確認できませんでした。'));
                    resolve({ data, summary: this.getStoredDataSummary(data, 'indexeddb') });
                };
                request.onerror = () => reject(request.error || new Error('IndexedDBを読み込めませんでした。'));
                tx.onerror = () => reject(tx.error || new Error('IndexedDBを読み込めませんでした。'));
                tx.onabort = () => reject(tx.error || new Error('IndexedDBの読込が中断されました。'));
            } catch (error) {
                reject(error);
            }
        });
    }

    async selectStorageCandidate(source) {
        if (source !== 'indexeddb' && source !== 'localStorage') throw new Error('保存先を選択できません。');
        const candidate = source === 'indexeddb' ? await this.readIndexedDbCandidate() : this.readLocalStorageCandidate();
        if (!candidate) throw new Error('選択した保存候補を読み込めませんでした。');
        const alternate = source === 'indexeddb' ? this.readLocalStorageCandidate() : await this.readIndexedDbCandidate().catch(() => null);
        const summary = alternate?.summary;
        const value = JSON.stringify({
            source,
            selectedAt: new Date().toISOString(),
            alternate: summary ? {
                savedAt: summary.savedAt,
                total: summary.total,
                departments: summary.departments,
                key: summary.key
            } : null
        });
        try {
            localStorage.setItem(this.STORAGE_SELECTION_KEY, value);
            if (typeof sessionStorage !== 'undefined') {
                try { sessionStorage.removeItem(this.STORAGE_SELECTION_KEY); } catch (_) {}
            }
        } catch (error) {
            if (typeof sessionStorage === 'undefined') throw error;
            sessionStorage.setItem(this.STORAGE_SELECTION_KEY, value);
        }
        return candidate.summary;
    }

    async init() {
        return new Promise((resolve) => {
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                resolve();
            };
            const useLocalStorage = error => {
                if (finished) return;
                this.storageWarning = error || new Error('IndexedDBを開けませんでした。');
                console.error('IndexedDB unavailable; using localStorage', this.storageWarning);
                try {
                    this.loadLegacy();
                    // The fallback may be older than IndexedDB. Leave startup maintenance
                    // read-only until an explicit edit establishes the active save target.
                    this.startupSaveSafe = false;
                } catch (localError) {
                    this.storageWarning = localError;
                    console.error('localStorage unavailable', localError);
                }
                finish();
            };
            let request;
            try {
                request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            } catch (error) {
                useLocalStorage(error);
                return;
            }
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME);
                }
                if (!db.objectStoreNames.contains(this.MEDIA_STORE_NAME)) {
                    db.createObjectStore(this.MEDIA_STORE_NAME);
                }
            };
            request.onsuccess = async (e) => {
                if (finished) {
                    e.target.result.close();
                    return;
                }
                this.db = e.target.result;
                try {
                    const result = await this.loadFromIDB();
                    if (result === 'local') {
                        this.db.close();
                        this.db = null;
                    }
                    finish();
                } catch (error) {
                    this.db?.close();
                    this.db = null;
                    useLocalStorage(error);
                }
            };
            request.onerror = () => useLocalStorage(request.error);
            request.onblocked = () => useLocalStorage(new Error('IndexedDBが他のタブにより使用中です。'));
        });
    }

    async loadFromIDB() {
        return new Promise((resolve) => {
            let finished = false;
            const finish = source => {
                if (finished) return;
                finished = true;
                resolve(source);
            };
            const useLocalStorage = error => {
                if (finished) return;
                this.storageWarning = error || new Error('IndexedDBのデータを読み込めませんでした。');
                console.error('IndexedDB read failed; using localStorage', this.storageWarning);
                try {
                    this.loadLegacy();
                    this.startupSaveSafe = false;
                } catch (localError) {
                    this.storageWarning = localError;
                    console.error('localStorage unavailable', localError);
                }
                this.normalizeData();
                finish('local');
            };
            try {
                const tx = this.db.transaction(this.STORE_NAME, 'readonly');
                const os = tx.objectStore(this.STORE_NAME);
                const request = os.get(this.STORAGE_KEY);
                request.onsuccess = () => {
                    if (finished) return;
                    try {
                        const indexedIssues = request.result == null ? [] : this.getStoredDataShapeIssues(request.result);
                        const indexedCandidate = request.result != null && !indexedIssues.length
                            ? { data: request.result, summary: this.getStoredDataSummary(request.result, 'indexeddb') }
                            : null;
                        if (indexedIssues.length) this.rememberMalformedStoredData(
                            'indexeddb', this.STORAGE_KEY, request.result, null, indexedIssues
                        );
                        const localCandidate = this.readLocalStorageCandidate();
                        this.storageCandidates = {
                            ...(indexedCandidate ? { indexeddb: indexedCandidate.summary } : {}),
                            ...(localCandidate ? { localStorage: localCandidate.summary } : {})
                        };
                        const chosen = this.chooseStartupCandidate(indexedCandidate, localCandidate)
                            || this.chooseStartupCandidate(this._repairCandidates.indexeddb, this._repairCandidates.localStorage);
                        if (chosen) {
                            this.applyLoadedCandidate(chosen);
                            if (!chosen.repaired && chosen.summary.source === 'localStorage' && indexedCandidate) this.startupSaveSafe = true;
                            if (chosen.repaired) this.storageCandidates[chosen.summary.source] = chosen.summary;
                        }
                        // A missing record may be temporary. Do not write the default
                        // state at startup; a later user edit still saves normally.
                        this.normalizeData();
                        this.lastSuccessfulSaveAt = this.data.settings?.lastSuccessfulSaveAt || null;
                        finish('idb');
                    } catch (error) {
                        useLocalStorage(error);
                    }
                };
                request.onerror = () => useLocalStorage(request.error);
                tx.onerror = () => useLocalStorage(tx.error);
                tx.onabort = () => useLocalStorage(tx.error);
            } catch (error) {
                useLocalStorage(error);
            }
        });
    }

    isValidStoredData(value) {
        return this.getStoredDataShapeIssues(value).length === 0;
    }

    isStoredRecord(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    cloneStoredData(value) {
        return typeof structuredClone === 'function'
            ? structuredClone(value)
            : JSON.parse(JSON.stringify(value));
    }

    getStoredDataShapeIssues(value) {
        if (!this.isStoredRecord(value)) return ['全体がデータ形式ではありません'];
        const issues = [];
        const arrayFields = [
            'machines', 'tasks', 'history', 'partsMaster', 'partStockMovements',
            'archivedWorkers', 'archivedTasks', 'archivedParts', 'archivedMaintenanceTasks',
            'archivedGuides', 'machineCategories', 'archivedMachineCategories', 'tipsNotes',
            'localTodos', 'localTodoWorkers', 'localTodoLogs', 'historyImportLogs',
            'shiftNotebookGroupPresets', 'shiftNotebookMemberOrder', 'shiftNotebookTags',
            'shiftNotebookRowGroups', 'photoManagerLibrary', 'photoManagerVideos',
            'photoManagerAudios', 'photoManagerTrash'
        ];
        const objectFields = [
            'memos', 'shiftNotebooks', 'shiftNotebookMemberTypes', 'archivedSuggestions',
            'outlookAssist', 'photoManagerNames', 'photoManagerOverlays', 'photoManagerTags'
        ];
        const checkDepartment = (department, path) => {
            if (!this.isStoredRecord(department)) {
                issues.push(`${path} がデータ形式ではありません`);
                return;
            }
            for (const field of arrayFields) {
                if (department[field] != null && !Array.isArray(department[field])) issues.push(`${path}.${field} が配列ではありません`);
            }
            for (const field of objectFields) {
                if (department[field] != null && !this.isStoredRecord(department[field])) issues.push(`${path}.${field} がデータ形式ではありません`);
            }
            for (const field of ['machines', 'tasks', 'history', 'partsMaster']) {
                if (!Array.isArray(department[field])) continue;
                if (department[field].some(item => !this.isStoredRecord(item))) issues.push(`${path}.${field} に不正な項目があります`);
            }
            if (Array.isArray(department.history)
                && department.history.some(item => this.isStoredRecord(item)
                    && item.replacedParts != null && !Array.isArray(item.replacedParts))) {
                issues.push(`${path}.history の使用部品が配列ではありません`);
            }
            if (Array.isArray(department.history)
                && department.history.some(item => this.isStoredRecord(item)
                    && item.photos != null && !Array.isArray(item.photos))) {
                issues.push(`${path}.history の写真が配列ではありません`);
            }
            if (Array.isArray(department.history)
                && department.history.some(item => this.isStoredRecord(item)
                    && Array.isArray(item.replacedParts)
                    && item.replacedParts.some(part => !this.isStoredRecord(part)))) {
                issues.push(`${path}.history の使用部品に不正な項目があります`);
            }
        };
        const hasLegacyData = ['machines', 'history', 'tasks'].some(key => Array.isArray(value[key]));
        if (!this.isStoredRecord(value.deptData) && !hasLegacyData) issues.push('部署データがありません');
        if (value.departments != null && !Array.isArray(value.departments)) issues.push('部署一覧が配列ではありません');
        if (Array.isArray(value.departments)
            && value.departments.some(department => !this.isStoredRecord(department)
                || !['string', 'number'].includes(typeof department.id) || String(department.id).trim() === '')) {
            issues.push('部署一覧に不正な項目があります');
        }
        if (value.settings != null && !this.isStoredRecord(value.settings)) issues.push('設定がデータ形式ではありません');
        if (value.currentDepartmentId != null
            && !['string', 'number'].includes(typeof value.currentDepartmentId)) {
            issues.push('現在の部署IDが正しくありません');
        }
        if (this.isStoredRecord(value.deptData)) {
            for (const [id, department] of Object.entries(value.deptData)) checkDepartment(department, `部署 ${id}`);
        } else if (hasLegacyData) {
            checkDepartment(value, '旧形式のデータ');
        }
        return issues;
    }

    repairStoredDataCandidate(data, source, key) {
        if (!this.isStoredRecord(data)) return null;
        const repaired = this.cloneStoredData(data);
        const arrays = [
            'machines', 'tasks', 'history', 'partsMaster', 'partStockMovements',
            'archivedWorkers', 'archivedTasks', 'archivedParts', 'archivedMaintenanceTasks',
            'archivedGuides', 'machineCategories', 'archivedMachineCategories', 'tipsNotes',
            'localTodos', 'localTodoWorkers', 'localTodoLogs', 'historyImportLogs',
            'shiftNotebookGroupPresets', 'shiftNotebookMemberOrder', 'shiftNotebookTags',
            'shiftNotebookRowGroups', 'photoManagerLibrary', 'photoManagerVideos',
            'photoManagerAudios', 'photoManagerTrash'
        ];
        const objects = [
            'memos', 'shiftNotebooks', 'shiftNotebookMemberTypes', 'archivedSuggestions',
            'outlookAssist', 'photoManagerNames', 'photoManagerOverlays', 'photoManagerTags'
        ];
        const repairDepartment = department => {
            const working = this.isStoredRecord(department) ? department : {};
            for (const field of arrays) {
                if (working[field] != null && !Array.isArray(working[field])) working[field] = [];
            }
            for (const field of objects) {
                if (working[field] != null && !this.isStoredRecord(working[field])) working[field] = {};
            }
            for (const field of ['machines', 'tasks', 'history', 'partsMaster']) {
                if (Array.isArray(working[field])) working[field] = working[field].filter(item => this.isStoredRecord(item));
            }
            for (const history of working.history || []) {
                if (history.replacedParts != null && !Array.isArray(history.replacedParts)) history.replacedParts = [];
                if (Array.isArray(history.replacedParts)) history.replacedParts = history.replacedParts.filter(part => this.isStoredRecord(part));
                if (history.photos != null && !Array.isArray(history.photos)) history.photos = [];
            }
            return working;
        };
        if (this.isStoredRecord(repaired.deptData)) {
            for (const id of Object.keys(repaired.deptData)) repaired.deptData[id] = repairDepartment(repaired.deptData[id]);
        } else if (['machines', 'history', 'tasks'].some(field => Array.isArray(repaired[field]))) {
            repairDepartment(repaired);
        } else {
            return null;
        }
        if (repaired.departments != null && !Array.isArray(repaired.departments)) repaired.departments = [];
        if (Array.isArray(repaired.departments)) {
            repaired.departments = repaired.departments.filter(department => this.isStoredRecord(department)
                && ['string', 'number'].includes(typeof department.id) && String(department.id).trim() !== '');
        }
        if (repaired.settings != null && !this.isStoredRecord(repaired.settings)) repaired.settings = {};
        if (repaired.currentDepartmentId != null
            && !['string', 'number'].includes(typeof repaired.currentDepartmentId)) repaired.currentDepartmentId = '';
        if (this.getStoredDataShapeIssues(repaired).length) return null;
        return { data: repaired, summary: this.getStoredDataSummary(repaired, source, key), repaired: true };
    }

    rememberMalformedStoredData(source, key, data, raw, issues) {
        const report = { source, key, issues: issues.slice(0, 12) };
        this.malformedStorageReports = this.malformedStorageReports.filter(item => item.source !== source || item.key !== key);
        this.malformedStorageReports.push(report);
        this.storageWarning = new Error(`${source === 'indexeddb' ? 'IndexedDB' : 'localStorage'} の保存データに異常があります（${issues[0]}）。原本を保持して読み込みます。`);
        if (key === this.STORAGE_KEY) this._malformedPrimary[source] = { data, raw, preserved: false, backupKey: null };
        const candidate = this.repairStoredDataCandidate(data, source, key);
        if (candidate && (!this._repairCandidates[source] || key === this.STORAGE_KEY)) this._repairCandidates[source] = candidate;
    }

    applyStoredData(parsed) {
        // The old single-department format can exist in either storage backend.
        if (Array.isArray(parsed.machines) || Array.isArray(parsed.history) || Array.isArray(parsed.tasks)) {
            this.data.deptData.dept_default = {
                machines: parsed.machines || [],
                tasks: parsed.tasks || [],
                history: parsed.history || [],
                partsMaster: parsed.partsMaster || [],
                archivedWorkers: parsed.archivedWorkers || [],
                archivedTasks: parsed.archivedTasks || []
            };
            if (parsed.settings) this.data.settings = parsed.settings;
        } else {
            this.data = parsed;
        }
    }

    loadLegacy() {
        const candidate = this.readLocalStorageCandidate() || this._repairCandidates.localStorage;
        if (candidate) {
            this.storageCandidates.localStorage = candidate.summary;
            this.applyLoadedCandidate(candidate);
        }
        this.normalizeData();
        this.lastSuccessfulSaveAt = this.data.settings?.lastSuccessfulSaveAt || null;
    }

    normalizeData() {
        // Integrity check for departments
        if (!this.data || typeof this.data !== 'object') this.data = {};
        if (!this.data.deptData || typeof this.data.deptData !== 'object') {
            this.data.deptData = {};
        }
        if (!this.data.departments || this.data.departments.length === 0) {
            this.data.departments = [{ id: 'dept_default', name: '初期部署' }];
        }
        this.data.departments = this.data.departments
            .filter(d => d && d.id)
            .map((d, index) => ({ id: String(d.id), name: d.name || `部署${index + 1}` }))
            .filter((d, index, array) => array.findIndex(item => item.id === d.id) === index);
        if (this.data.departments.length === 0) {
            this.data.departments = [{ id: 'dept_default', name: '初期部署' }];
        }
        Object.keys(this.data.deptData).forEach(id => {
            if (!this.data.departments.some(d => String(d.id) === String(id))) {
                this.data.departments.push({ id: String(id), name: `部署${this.data.departments.length + 1}` });
            }
        });
        this.data.departments.forEach(dept => {
            if (!this.data.deptData[dept.id] || typeof this.data.deptData[dept.id] !== 'object') {
                this.data.deptData[dept.id] = {};
            }
        });
        if (!this.data.currentDepartmentId) {
            this.data.currentDepartmentId = this.data.departments[0].id;
        }
        if (!this.data.departments.some(d => String(d.id) === String(this.data.currentDepartmentId))) {
            this.data.currentDepartmentId = this.data.departments[0].id;
        }
        
        // Fix missing keys in each department
        Object.keys(this.data.deptData || {}).forEach(id => {
            const d = this.data.deptData[id];
            if (!d.machines) d.machines = [];
            if (!d.tasks) d.tasks = [];
            if (!d.history) d.history = [];
            if (!d.partsMaster) d.partsMaster = [];
            if (!Array.isArray(d.partStockMovements)) d.partStockMovements = [];
            if (!d.archivedWorkers) d.archivedWorkers = [];
            if (!d.archivedTasks) d.archivedTasks = [];
            if (!d.archivedParts) d.archivedParts = [];
            if (!d.archivedMaintenanceTasks) d.archivedMaintenanceTasks = [];
            if (!d.archivedGuides) d.archivedGuides = [];
            if (!d.machineCategories) d.machineCategories = [];
            if (!d.archivedMachineCategories) d.archivedMachineCategories = [];
            if (!d.memos) d.memos = {};
            if (!Array.isArray(d.tipsNotes)) d.tipsNotes = [];
            if (!d.localTodos) d.localTodos = [];
            if (!d.localTodoWorkers) d.localTodoWorkers = [{ id: 'default', name: '共通・未設定' }];
            if (!d.localTodoLogs) d.localTodoLogs = [];
            if (!d.historyImportLogs) d.historyImportLogs = [];
            if (!d.shiftNotebooks) d.shiftNotebooks = {};
            if (!d.shiftNotebookGroupPresets) d.shiftNotebookGroupPresets = [];
            if (!d.shiftNotebookMemberTypes) d.shiftNotebookMemberTypes = {};
            if (!d.shiftNotebookMemberOrder) d.shiftNotebookMemberOrder = [];
            if (!d.shiftNotebookTags) d.shiftNotebookTags = ['通常', '注意', '至急'];
            if (!d.shiftNotebookRowGroups) d.shiftNotebookRowGroups = ['4号L', '5号L'];
            if (!d.outlookAssist || typeof d.outlookAssist !== 'object') {
                d.outlookAssist = { selectedWorker: '', draftsByWorker: {}, templates: [] };
            }
            if (!d.outlookAssist.draftsByWorker || typeof d.outlookAssist.draftsByWorker !== 'object') d.outlookAssist.draftsByWorker = {};
            if (!Array.isArray(d.outlookAssist.templates)) d.outlookAssist.templates = [];
            if (!Array.isArray(d.outlookAssist.recipientSets)) d.outlookAssist.recipientSets = [];
            if (!Array.isArray(d.outlookAssist.recipientContacts)) d.outlookAssist.recipientContacts = [];
            if (!d.outlookAssist.recipientGroupUpdatedAt || typeof d.outlookAssist.recipientGroupUpdatedAt !== 'object') d.outlookAssist.recipientGroupUpdatedAt = {};
            if (!Array.isArray(d.outlookAssist.insertHistory)) d.outlookAssist.insertHistory = [];
            if (!Array.isArray(d.outlookAssist.subjectPresets)) {
                d.outlookAssist.subjectPresets = ['[見積依頼]', '[注文]', '[発注]', '[確認依頼]', '[報告]'];
            }
            if (!Array.isArray(d.outlookAssist.quickPhrases)) {
                d.outlookAssist.quickPhrases = [
                    { text: 'お世話になっております。', visible: true },
                    { text: 'ご確認お願いいたします。', visible: true },
                    { text: 'ご対応お願いいたします。', visible: true },
                    { text: '以上、よろしくお願いいたします。', visible: true }
                ];
            }
            if (!d.outlookAssist.copyStatus || typeof d.outlookAssist.copyStatus !== 'object') d.outlookAssist.copyStatus = {};
            if (typeof d.outlookAssist.templateFilterCategory !== 'string') d.outlookAssist.templateFilterCategory = 'all';
            if (!d.archivedSuggestions) d.archivedSuggestions = { errorNo: [], content: [], cause: [], notes: [], workers: [], partName: [], partModel: [], partSerial: [] };
            if (!d.dokateiCounters) d.dokateiCounters = [
                { location: '', lastDate: '' },
                { location: '', lastDate: '' },
                { location: '', lastDate: '' }
            ];
        });

        // Global normalization: unit conversion (pcs -> 個, kg -> g)
        Object.keys(this.data.deptData || {}).forEach(id => {
            const d = this.data.deptData[id];
            (d.history || []).forEach(h => {
                (h.replacedParts || []).forEach(p => {
                    if (p.unit === 'pcs') p.unit = '個';
                    if (p.unit === 'kg') {
                        p.unit = 'g';
                        p.count = (parseFloat(p.count) || 0) * 1000;
                    }
                });
            });
            (d.partsMaster || []).forEach(m => {
                if (m.unit === 'pcs') m.unit = '個';
                if (m.unit === 'kg') {
                    m.unit = 'g';
                    m.stock = (parseFloat(m.stock) || 0) * 1000;
                    if (m.minStock) m.minStock = (parseFloat(m.minStock) || 0) * 1000;
                }
            });
        });
    }

    notifySaveStatus(status, backend, detail = {}) {
        window.dispatchEvent(new CustomEvent('maintenance-save-status', {
            detail: { status, backend, ...detail }
        }));
    }

    cloneSaveSnapshot() {
        return typeof structuredClone === 'function'
            ? structuredClone(this.data)
            : JSON.parse(JSON.stringify(this.data));
    }

    getMalformedBackupKey(source) {
        const original = this._malformedPrimary[source];
        if (!original || original.preserved) return null;
        if (!original.backupKey) {
            original.backupKey = `${this.STORAGE_KEY}_invalid_original_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        }
        return original.backupKey;
    }

    writeSaveSnapshot(snapshot, backend) {
        if (backend === 'localStorage') {
            const original = this._malformedPrimary.localStorage;
            const backupKey = this.getMalformedBackupKey('localStorage');
            if (backupKey) {
                try {
                    localStorage.setItem(backupKey, original.raw ?? JSON.stringify(original.data));
                    original.preserved = true;
                    this._malformedBackupWarning = false;
                } catch (error) {
                    this._malformedBackupWarning = true;
                    this.storageWarning = new Error('異常な元データを退避できませんでした。保存領域の空き容量を確認してください。');
                    console.warn('Could not preserve malformed localStorage data', error);
                }
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(snapshot));
            return Promise.resolve();
        }
        const original = this._malformedPrimary.indexeddb;
        const backupKey = this.getMalformedBackupKey('indexeddb');
        const write = includeBackup => new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
                const os = tx.objectStore(this.STORE_NAME);
                let requestError = null;
                if (includeBackup && backupKey) {
                    const backupRequest = os.put(original.data, backupKey);
                    backupRequest.onerror = () => { requestError ||= backupRequest.error || new Error('元データを退避できませんでした。'); };
                }
                const req = os.put(snapshot, this.STORAGE_KEY);
                // A request can fail before its transaction aborts. Keep the queue
                // blocked until the whole transaction reaches a terminal event.
                req.onerror = () => { requestError = req.error || new Error('保存に失敗しました。'); };
                tx.onerror = () => { requestError ||= tx.error || new Error('保存に失敗しました。'); };
                tx.onabort = () => reject(requestError || tx.error || new Error('保存が中断されました。'));
                tx.oncomplete = () => {
                    if (requestError) reject(requestError);
                    else {
                        if (includeBackup && backupKey) {
                            original.preserved = true;
                            this._malformedBackupWarning = false;
                        }
                        resolve();
                    }
                };
            } catch (error) {
                reject(error);
            }
        });
        if (!backupKey) return write(false);
        return write(true).catch(async error => {
            // A full storage quota can reject the extra backup copy. Keep the
            // app writable while surfacing that the original is not protected.
            this._malformedBackupWarning = true;
            this.storageWarning = new Error('異常な元データを退避できませんでした。保存領域の空き容量を確認してください。');
            console.warn('Could not preserve malformed IndexedDB data', error);
            await write(false);
        });
    }

    async runSaveQueue() {
        if (this._saveQueueRunning) return;
        this._saveQueueRunning = true;
        try {
            while (this._saveQueue.length) {
                const entry = this._saveQueue.shift();
                if (this._rejectedSaveDataRefs.has(entry.dataRef)) {
                    const error = new Error('失敗した取込データの保存を中止しました。');
                    entry.waiters.forEach(waiter => waiter.reject(error));
                    this.notifySaveStatus('error', entry.backend, { error, revision: entry.revision });
                    continue;
                }
                const savedAt = new Date().toISOString();
                entry.snapshot.settings = { ...(entry.snapshot.settings || {}), lastSuccessfulSaveAt: savedAt };
                this.notifySaveStatus('saving', entry.backend, { revision: entry.revision });
                try {
                    await this.writeSaveSnapshot(entry.snapshot, entry.backend);
                    this.lastSuccessfulSaveAt = savedAt;
                    if (this.data === entry.dataRef) {
                        this.data.settings = { ...(this.data.settings || {}), lastSuccessfulSaveAt: savedAt };
                    }
                    this.storageCandidates[entry.backend] = this.getStoredDataSummary(entry.snapshot, entry.backend);
                    this.startupSaveSafe = true;
                    if (entry.backend === 'indexeddb' && !this._malformedBackupWarning) this.storageWarning = null;
                    this._savePersistedRevision = entry.revision;
                    entry.waiters.forEach(waiter => waiter.resolve());
                    if (!this._saveQueue.length && this._saveRequestedRevision === entry.revision) {
                        this.notifySaveStatus('saved', entry.backend, { savedAt, revision: entry.revision });
                    }
                } catch (error) {
                    console.error('Save failed', error);
                    if (entry.importTransaction) this._rejectedSaveDataRefs.add(entry.dataRef);
                    if (entry.discardQueuedOnFailure) {
                        const remaining = [];
                        for (const pending of this._saveQueue) {
                            if (pending.dataRef === entry.dataRef) {
                                const discarded = new Error('前の保存に失敗したため、待機中の保存を中止しました。');
                                pending.waiters.forEach(waiter => waiter.reject(discarded));
                            } else {
                                remaining.push(pending);
                            }
                        }
                        this._saveQueue = remaining;
                    }
                    entry.waiters.forEach(waiter => waiter.reject(error));
                    this.notifySaveStatus('error', entry.backend, { error, revision: entry.revision });
                }
            }
        } finally {
            this._saveQueueRunning = false;
            if (this._saveQueue.length) this.runSaveQueue();
            else this._saveIdleWaiters.splice(0).forEach(resolve => resolve());
        }
    }

    waitForSaveQueueIdle() {
        if (!this._saveQueueRunning && !this._saveQueue.length) return Promise.resolve();
        return new Promise(resolve => this._saveIdleWaiters.push(resolve));
    }

    restoreSaveSnapshotInPlace(snapshot, dataRef) {
        if (this.data !== dataRef) return false;
        for (const key of Object.keys(dataRef)) delete dataRef[key];
        Object.assign(dataRef, snapshot);
        return true;
    }

    async runAtomicSaveBatch(mutate) {
        if (typeof mutate !== 'function') throw new TypeError('保存する変更処理がありません。');
        if (this._atomicSaveBatch) throw new Error('別の保存処理が進行中です。');
        // An earlier save must not write an older snapshot after this batch.
        do {
            await this.waitForSaveQueueIdle();
        } while (this._saveQueueRunning || this._saveQueue.length);
        const dataRef = this.data;
        const before = this.cloneSaveSnapshot();
        this._atomicSaveBatch = { dataRef };
        let result;
        try {
            result = mutate();
            if (result && typeof result.then === 'function') {
                throw new Error('一括保存の変更処理は同期処理にしてください。');
            }
        } catch (error) {
            this.restoreSaveSnapshotInPlace(before, dataRef);
            throw error;
        } finally {
            this._atomicSaveBatch = null;
        }
        try {
            await this.save({ discardQueuedOnFailure: true });
            return result;
        } catch (error) {
            this.restoreSaveSnapshotInPlace(before, dataRef);
            throw error;
        }
    }

    save(options = {}) {
        // Existing synchronous mutators may request saves during a form edit.
        // The caller of runAtomicSaveBatch observes the single final result.
        if (this._atomicSaveBatch) return Promise.resolve();
        const backend = this.getActiveSaveBackend();
        const dataRef = this.data;
        const revision = ++this._saveRequestedRevision;
        let snapshot;
        try {
            if (this._rejectedSaveDataRefs.has(dataRef)) throw new Error('失敗した取込データは保存できません。');
            snapshot = this.cloneSaveSnapshot();
        } catch (error) {
            this.notifySaveStatus('error', backend, { error, revision });
            return Promise.reject(error);
        }
        return new Promise((resolve, reject) => {
            const last = this._saveQueue[this._saveQueue.length - 1];
            if (last && last.backend === backend && last.dataRef === dataRef) {
                last.snapshot = snapshot;
                last.revision = revision;
                last.importTransaction ||= !!options.importTransaction;
                last.discardQueuedOnFailure ||= !!options.discardQueuedOnFailure;
                last.waiters.push({ resolve, reject });
            } else {
                this._saveQueue.push({
                    backend, dataRef, snapshot, revision,
                    importTransaction: !!options.importTransaction,
                    discardQueuedOnFailure: !!options.discardQueuedOnFailure,
                    waiters: [{ resolve, reject }]
                });
            }
            this.runSaveQueue();
        });
    }

    saveMediaBlob(id, blob) {
        if (!this.db || !id || !(blob instanceof Blob)) return Promise.reject(new Error('動画保存領域を利用できません。'));
        if (blob.size > 100 * 1024 * 1024) return Promise.reject(new Error('動画は100MBまで保存できます。'));
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.MEDIA_STORE_NAME, 'readwrite');
            const request = tx.objectStore(this.MEDIA_STORE_NAME).put({
                blob,
                size: blob.size,
                type: blob.type || 'video/mp4',
                updatedAt: Date.now()
            }, String(id));
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error || new Error('動画を保存できませんでした。'));
        });
    }

    loadMediaBlob(id) {
        if (!this.db || !id) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.MEDIA_STORE_NAME, 'readonly');
            const request = tx.objectStore(this.MEDIA_STORE_NAME).get(String(id));
            request.onsuccess = () => resolve(request.result?.blob || null);
            request.onerror = () => reject(request.error || new Error('動画を読み込めませんでした。'));
        });
    }

    listMediaEntries(prefix = '') {
        if (!this.db) return Promise.resolve([]);
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.MEDIA_STORE_NAME, 'readonly');
            const store = tx.objectStore(this.MEDIA_STORE_NAME);
            const entries = [];
            const request = store.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) {
                    resolve(entries);
                    return;
                }
                const key = String(cursor.key || '');
                if (!prefix || key.startsWith(String(prefix))) {
                    const value = cursor.value || {};
                    entries.push({
                        key,
                        size: Math.max(0, Number(value.size) || Number(value.blob?.size) || 0),
                        type: String(value.type || value.blob?.type || ''),
                        updatedAt: Number(value.updatedAt) || 0
                    });
                }
                cursor.continue();
            };
            request.onerror = () => reject(request.error || new Error('保存メディア一覧を読み込めませんでした。'));
        });
    }
    saveMediaFileHandle(id, handle) {
        if (!this.db || !id || !handle || handle.kind !== 'file') {
            return Promise.reject(new Error('PC動画のリンク情報を保存できません。'));
        }
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.MEDIA_STORE_NAME, 'readwrite');
            const request = tx.objectStore(this.MEDIA_STORE_NAME).put({
                handle,
                kind: 'file-handle',
                updatedAt: Date.now()
            }, String(id));
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error || new Error('PC動画のリンク情報を保存できません。'));
        });
    }

    loadMediaFileHandle(id) {
        if (!this.db || !id) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.MEDIA_STORE_NAME, 'readonly');
            const request = tx.objectStore(this.MEDIA_STORE_NAME).get(String(id));
            request.onsuccess = () => resolve(request.result?.handle || null);
            request.onerror = () => reject(request.error || new Error('PC動画のリンク情報を読み込めません。'));
        });
    }

    deleteMediaBlob(id) {
        if (!this.db || !id) return Promise.resolve(false);
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.MEDIA_STORE_NAME, 'readwrite');
            const request = tx.objectStore(this.MEDIA_STORE_NAME).delete(String(id));
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error || new Error('動画を削除できませんでした。'));
        });
    }

    // --- Parts Master & Aliases ---
    getPartMaster(name, model) {
        if (!this.activeData.partsMaster) this.activeData.partsMaster = [];
        // Canonical check: If this (name, model) is a seed of another master, redirect to that master
        return this.activeData.partsMaster.find(m => 
            (m.name === name && m.model === model) || 
            (m.seeds && m.seeds.some(s => s.name === name && s.model === model))
        );
    }

    getPartStockMovements(name, model) {
        if (!Array.isArray(this.activeData.partStockMovements)) this.activeData.partStockMovements = [];
        const master = this.getPartMaster(name, model);
        const identities = new Set([
            `${master?.name ?? name}___${master?.model ?? model ?? ''}`,
            ...((master?.seeds || []).map(seed => `${seed.name || ''}___${seed.model || ''}`))
        ]);
        return this.activeData.partStockMovements
            .filter(item => identities.has(`${item.partName || ''}___${item.partModel || ''}`))
            .sort((left, right) => String(right.occurredAt || right.date || '').localeCompare(String(left.occurredAt || left.date || '')));
    }

    recordPartStockMovement(master, delta, before, after, options = {}) {
        const amount = Math.round(Math.abs(Number(delta) || 0) * 1000) / 1000;
        if (!master || amount <= 0) return null;
        if (!Array.isArray(this.activeData.partStockMovements)) this.activeData.partStockMovements = [];
        const occurredAt = options.occurredAt || new Date().toISOString();
        const movement = {
            id: `stock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            partName: master.name || '',
            partModel: master.model || '',
            type: Number(delta) > 0 ? 'in' : 'out',
            quantity: amount,
            delta: Math.round((Number(delta) || 0) * 1000) / 1000,
            before: Math.round((Number(before) || 0) * 1000) / 1000,
            after: Math.round((Number(after) || 0) * 1000) / 1000,
            unit: options.unit || master.unit || '個',
            reason: String(options.reason || (Number(delta) > 0 ? '入庫' : '出庫')).slice(0, 100),
            source: String(options.source || 'manual'),
            sourceId: String(options.sourceId || ''),
            date: String(options.date || '').slice(0, 10),
            occurredAt
        };
        this.activeData.partStockMovements.push(movement);
        return movement;
    }
    updatePartMaster(name, model, updates, isSubstitute = false) {
        if (!this.activeData.partsMaster) this.activeData.partsMaster = [];
        const index = this.activeData.partsMaster.findIndex(m => m.name === name && m.model === model);
        
        if (isSubstitute) {
            // New case: Changing (name, model) to a SUBSTITUTE (newName, newModel)
            const oldMaster = this.getPartMaster(name, model);
            const seeds = oldMaster ? (oldMaster.seeds || []) : [];
            if (oldMaster) {
                // Remove old master as a separate entry
                this.activeData.partsMaster = this.activeData.partsMaster.filter(m => m !== oldMaster);
                // Add the old identity to seeds
                seeds.push({ name: oldMaster.name, model: oldMaster.model });
            } else {
                seeds.push({ name, model });
            }
            
            // Upsert into NEW identity
            const newIndex = this.activeData.partsMaster.findIndex(m => m.name === updates.name && m.model === updates.model);
            if (newIndex !== -1) {
                const combinedSeeds = [...new Set([...(this.activeData.partsMaster[newIndex].seeds || []), ...seeds])];
                this.activeData.partsMaster[newIndex] = { ...this.activeData.partsMaster[newIndex], ...updates, seeds: combinedSeeds };
            } else {
                this.activeData.partsMaster.push({ ...updates, seeds });
            }
        } else {
            // Normal update (price, supplier, stock, minStock etc)
            const target = this.getPartMaster(name, model);
            if (target) {
                const idx = this.activeData.partsMaster.indexOf(target);
                const beforeStock = parseFloat(this.activeData.partsMaster[idx].stock) || 0;
                const afterStock = updates.stock !== undefined ? parseFloat(updates.stock) || 0 : beforeStock;
                this.activeData.partsMaster[idx] = { 
                    ...this.activeData.partsMaster[idx], 
                    ...updates,
                    stock: afterStock,
                    minStock: updates.minStock !== undefined ? parseFloat(updates.minStock) || 0 : this.activeData.partsMaster[idx].minStock,
                    unit: updates.unit || this.activeData.partsMaster[idx].unit || '個'
                };
                const stockDelta = Math.round((afterStock - beforeStock) * 1000) / 1000;
                if (updates.stock !== undefined && stockDelta) {
                    this.recordPartStockMovement(this.activeData.partsMaster[idx], stockDelta, beforeStock, afterStock, {
                        source: 'manual',
                        reason: stockDelta > 0 ? '在庫を直接変更（入庫）' : '在庫を直接変更（出庫）'
                    });
                }
            } else {
                const created = { 
                    name, model, 
                    ...updates,
                    stock: parseFloat(updates.stock) || 0,
                    minStock: parseFloat(updates.minStock) || 0,
                    unit: updates.unit || '個'
                };
                this.activeData.partsMaster.push(created);
                if (created.stock) {
                    this.recordPartStockMovement(created, created.stock, 0, created.stock, {
                        source: 'manual',
                        reason: created.stock > 0 ? '初期在庫登録（入庫）' : '初期在庫登録（出庫）'
                    });
                }
            }
        }
        this.save();
    }

    /**
     * Adjusts the stock of a part by a given delta (positive for restock, negative for use)
     */
    adjustStock(name, model, delta, options = {}) {
        const master = this.getPartMaster(name, model);
        if (master) {
            const idx = this.activeData.partsMaster.indexOf(master);
            const currentStock = parseFloat(this.activeData.partsMaster[idx].stock) || 0;
            const safeDelta = Math.round((parseFloat(delta) || 0) * 1000) / 1000;
            const newStock = currentStock + safeDelta;
            this.activeData.partsMaster[idx].stock = Math.round(newStock * 1000) / 1000;
            if (safeDelta) {
                this.recordPartStockMovement(this.activeData.partsMaster[idx], safeDelta, currentStock, this.activeData.partsMaster[idx].stock, options);
            }
            this.save();
            return true;
        }
        return false;
    }

    getLowStockParts() {
        if (!this.activeData.partsMaster) return [];
        return this.activeData.partsMaster.filter(m => {
            if (this.isPartArchived(m.name, m.model)) return false;
            const stock = parseFloat(m.stock) || 0;
            const min = parseFloat(m.minStock) || 0;
            return min > 0 && stock <= min;
        });
    }


    // --- ID Generation ---
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    // --- Machines ---
    getMachines(includeDeleted = false) {
        return includeDeleted ? this.activeData.machines : this.activeData.machines.filter(m => !m.deleted);
    }

    addMachine(name, model, remarks = '', photo = '', category = '', lineNo = '', manufacturer = '') {
        const machine = {
            id: this.generateId(),
            name,
            model,
            remarks,
            photo,
            category,
            lineNo,
            manufacturer,
            deleted: false,
            createdAt: Date.now()
        };
        this.activeData.machines.push(machine);
        this.save();
        return machine;
    }

    hardDeleteMachine(id) {
        if (this.activeData.machines) {
            this.activeData.machines = this.activeData.machines.filter(m => m.id !== id);
        }
        // Optionally delete associated tasks/history if desired, 
        // but user only asked to delete it from archive.
        // For machines, archive is just the deleted flag.
        this.activeData.tasks = this.activeData.tasks.filter(t => t.machineId !== id);
        this.save();
    }

    updateMachine(id, updates) {
        const index = this.activeData.machines.findIndex(m => m.id === id);
        if (index !== -1) {
            this.activeData.machines[index] = { ...this.activeData.machines[index], ...updates };
            this.save();
        }
    }

    // --- Tasks ---
    getTasks(machineId = null) {
        const activeMachineIds = this.activeData.machines.filter(m => !m.deleted).map(m => m.id);
        let tasks = this.activeData.tasks.filter(t => 
            !t.deleted && 
            activeMachineIds.includes(t.machineId) && 
            !this.isMaintenanceTaskArchived(t.id)
        );
        if (machineId) {
            tasks = tasks.filter(t => t.machineId === machineId);
        }
        return tasks;
    }

    addTask(machineId, content, periodDays, startDate) {
        const task = {
            id: this.generateId(),
            machineId,
            content,
            periodDays: parseInt(periodDays) || 0,
            startDate: startDate || MaintenanceStore.toLocalDateString(),
            deleted: false
        };
        this.activeData.tasks.push(task);
        this.save();
        return task;
    }

    // --- History ---
    getHistory(filters = {}) {
        let history = [...this.activeData.history].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (filters.machineId) {
            history = history.filter(h => h.machineId === filters.machineId);
        }
        if (filters.search) {
            const query = filters.search.toLowerCase();
            history = history.filter(h => 
                (h.notes && h.notes.toLowerCase().includes(query)) ||
                (h.errorContent && h.errorContent.toLowerCase().includes(query))
            );
        }
        return history;
    }

    getWorkers() {
        const history = this.getHistory();
        const workerSet = new Set();
        history.forEach(h => {
            (h.workers || []).forEach(w => {
                if(w.trim()) workerSet.add(w.trim());
            });
        });
        return Array.from(workerSet).sort();
    }

    getLastSuddenCategory() {
        const sudden = this.activeData.history.filter(h => h.isSudden && h.machineCategory).sort((a,b) => new Date(b.date) - new Date(a.date))[0];
        return sudden ? sudden.machineCategory : '';
    }

    addHistoryRecord(record) {
        const newRecord = {
            id: this.generateId(),
            taskId: record.taskId || null,
            taskContent: record.taskContent || '', // Fallback for deleted tasks
            machineId: record.machineId,
            date: record.date || MaintenanceStore.toLocalDateString(),
            scheduledDate: record.scheduledDate || '',
            notes: record.notes || '',
            isSudden: !!record.isSudden,
            errorNo: record.errorNo || '',
            errorContent: record.errorContent || '',
            cause: record.cause || '',
            workers: record.workers || [],
            replacedParts: record.replacedParts || [],
            photos: record.photos || [],
            workTime: parseInt(record.workTime) || 0,
            startTime: record.startTime || '',
            endTime: record.endTime || '',
            isSingleMaintenance: !!record.isSingleMaintenance,
            isDokatei: !!record.isDokatei,
            isNonProductionStop: !!record.isNonProductionStop,
            category: record.category || 'other',
            machineCategory: record.machineCategory || '',
            lineNo: record.lineNo || '', // New: 1-9 line selection
            isFirstTime: record.isFirstTime !== false,
            vendor: record.vendor || '',
            unitPrice: record.unitPrice || '',
            createdAt: new Date().toISOString()
        };
        this.activeData.history.push(newRecord);
        this.save();
        return newRecord;
    }

    // --- Worker Archive Management ---
    toggleWorkerArchive(name) {
        if (!this.activeData.archivedWorkers) this.activeData.archivedWorkers = [];
        const idx = this.activeData.archivedWorkers.indexOf(name);
        if (idx === -1) {
            this.activeData.archivedWorkers.push(name);
        } else {
            this.activeData.archivedWorkers.splice(idx, 1);
        }
        this.save();
    }

    isWorkerArchived(name) {
        return (this.activeData.archivedWorkers || []).includes(name);
    }

    hardDeleteWorker(name) {
        if (this.activeData.archivedWorkers) {
            this.activeData.archivedWorkers = this.activeData.archivedWorkers.filter(w => w !== name);
        }
        this.save();
    }

    // --- Task Archive Management (Skill Map) ---
    toggleTaskArchive(taskKey) {
        if (!this.activeData.archivedTasks) this.activeData.archivedTasks = [];
        const idx = this.activeData.archivedTasks.indexOf(taskKey);
        if (idx === -1) {
            this.activeData.archivedTasks.push(taskKey);
        } else {
            this.activeData.archivedTasks.splice(idx, 1);
        }
        this.save();
    }

    isTaskArchived(taskKey) {
        return (this.activeData.archivedTasks || []).includes(taskKey);
    }

    hardDeleteTask(taskKey) {
        if (this.activeData.archivedTasks) {
            this.activeData.archivedTasks = this.activeData.archivedTasks.filter(tk => tk !== taskKey);
        }
        this.save();
    }

    // --- Parts Archive Management ---
    togglePartArchive(name, model) {
        if (!this.activeData.archivedParts) this.activeData.archivedParts = [];
        const key = `${name}::${model}`;
        const idx = this.activeData.archivedParts.indexOf(key);
        if (idx === -1) {
            this.activeData.archivedParts.push(key);
        } else {
            this.activeData.archivedParts.splice(idx, 1);
        }
        this.save();
    }

    isPartArchived(name, model) {
        const key = `${name}::${model}`;
        return (this.activeData.archivedParts || []).includes(key);
    }

    hardDeletePart(name, model) {
        const key = `${name}::${model}`;
        if (this.activeData.archivedParts) {
            this.activeData.archivedParts = this.activeData.archivedParts.filter(k => k !== key);
        }
        // Also remove from partsMaster if completely deleting?
        // Usually, archive means it's still in master but hidden.
        // Hard delete should probably remove it from master too if the user wants it GONE.
        if (this.activeData.partsMaster) {
            this.activeData.partsMaster = this.activeData.partsMaster.filter(m => m.name !== name || m.model !== model);
        }
        this.save();
    }

    // --- Maintenance Task (Cycle Setting) Archive Management ---
    toggleMaintenanceTaskArchive(id) {
        if (!this.activeData.archivedMaintenanceTasks) this.activeData.archivedMaintenanceTasks = [];
        this.freezeTaskContentInHistory(id);
        const idx = this.activeData.archivedMaintenanceTasks.indexOf(id);
        if (idx === -1) {
            this.activeData.archivedMaintenanceTasks.push(id);
        } else {
            this.activeData.archivedMaintenanceTasks.splice(idx, 1);
        }
        this.save();
    }

    isMaintenanceTaskArchived(id) {
        return (this.activeData.archivedMaintenanceTasks || []).includes(id);
    }

    freezeTaskContentInHistory(id) {
        const task = (this.activeData.tasks || []).find(t => t.id === id);
        if (!task) return;
        (this.activeData.history || []).forEach(h => {
            if (String(h.taskId) === String(id) && !h.taskContent) {
                h.taskContent = task.content || '定期メンテナンス';
            }
        });
    }

    softDeleteMaintenanceTask(id) {
        this.freezeTaskContentInHistory(id);
        const task = (this.activeData.tasks || []).find(t => t.id === id);
        if (task) task.deleted = true;
        if (this.activeData.archivedMaintenanceTasks) {
            this.activeData.archivedMaintenanceTasks = this.activeData.archivedMaintenanceTasks.filter(x => x !== id);
        }
        this.save();
    }

    hardDeleteMaintenanceTask(id) {
        this.freezeTaskContentInHistory(id);
        if (this.activeData.archivedMaintenanceTasks) {
            this.activeData.archivedMaintenanceTasks = this.activeData.archivedMaintenanceTasks.filter(x => x !== id);
        }
        if (this.activeData.tasks) {
            const task = this.activeData.tasks.find(t => t.id === id);
            if (task && (parseInt(task.periodDays) || 0) <= 0) {
                task.deleted = true;
            } else {
                this.activeData.tasks = this.activeData.tasks.filter(t => t.id !== id);
            }
        }
        this.save();
    }

    // --- Guide (Procedure) Archive Management ---
    toggleGuideArchive(id) {
        if (!this.activeData.archivedGuides) this.activeData.archivedGuides = [];
        const idx = this.activeData.archivedGuides.indexOf(id);
        if (idx === -1) {
            this.activeData.archivedGuides.push(id);
        } else {
            this.activeData.archivedGuides.splice(idx, 1);
        }
        this.save();
    }

    isGuideArchived(id) {
        return (this.activeData.archivedGuides || []).includes(id);
    }

    hardDeleteGuide(id) {
        if (this.activeData.archivedGuides) {
            this.activeData.archivedGuides = this.activeData.archivedGuides.filter(x => x !== id);
        }
        // Guides are stored within history objects
        const hIndex = this.activeData.history.findIndex(h => h.id === id);
        if (hIndex !== -1) {
            if (this.activeData.history[hIndex].isManualGuide) {
                this.activeData.history.splice(hIndex, 1);
            } else {
                delete this.activeData.history[hIndex].guide;
            }
        }
        this.save();
    }

    // --- Suggestion Archive Management ---
    toggleArchivedSuggestion(kind, value) {
        if (!this.activeData.archivedSuggestions) {
            this.activeData.archivedSuggestions = { errorNo: [], content: [], cause: [], notes: [], workers: [], partName: [], partModel: [] };
        }
        if (!this.activeData.archivedSuggestions[kind]) {
            this.activeData.archivedSuggestions[kind] = [];
        }
        const idx = this.activeData.archivedSuggestions[kind].indexOf(value);
        if (idx === -1) {
            this.activeData.archivedSuggestions[kind].push(value);
        } else {
            this.activeData.archivedSuggestions[kind].splice(idx, 1);
        }
        this.save();
    }

    // --- Machine Category Archive Management ---
    toggleMachineCategoryArchive(name) {
        if (!this.activeData.archivedMachineCategories) this.activeData.archivedMachineCategories = [];
        if (!this.activeData.machineCategories) this.activeData.machineCategories = [];
        
        const normName = MaintenanceStore.toFullWidthUpper(name);
        const idx = this.activeData.archivedMachineCategories.indexOf(normName);
        
        if (idx !== -1) {
            // Restore
            this.activeData.archivedMachineCategories.splice(idx, 1);
            if (!this.activeData.machineCategories.includes(normName)) {
                this.activeData.machineCategories.push(normName);
                this.activeData.machineCategories.sort();
            }
        } else {
            // Archive
            if (!this.activeData.archivedMachineCategories.includes(normName)) {
                this.activeData.archivedMachineCategories.push(normName);
            }
            this.activeData.machineCategories = this.activeData.machineCategories.filter(c => c !== normName);
        }
        this.save();
    }

    addMachineCategory(name) {
        if (!this.activeData.machineCategories) this.activeData.machineCategories = [];
        const normName = MaintenanceStore.toFullWidthUpper(name);
        if (normName && !this.activeData.machineCategories.includes(normName) && !(this.activeData.archivedMachineCategories || []).includes(normName)) {
            this.activeData.machineCategories.push(normName);
            this.activeData.machineCategories.sort();
            this.save();
            return true;
        }
        return false;
    }

    getMachineCategories() {
        return (this.activeData.machineCategories || []).sort();
    }


    // --- Import / Export ---
    isImageDataUrl(value) {
        return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
    }

    estimateDataUrlBytes(value) {
        if (!this.isImageDataUrl(value)) return 0;
        const base64 = value.slice(value.indexOf(',') + 1).replace(/\s/g, '');
        const padding = base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0);
        return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
    }

    getImageStorageCategory(path = [], key = '') {
        const joined = path.join('.');
        if (joined.includes('photoManagerTrash')) return 'trash';
        if (joined.includes('imageSourceRecentUsed') || joined.includes('shiftPhotoRecentImageStamps')) return 'recent';
        if (/^original.*src$/i.test(key) || key === 'originalImageSrc') return 'originals';
        if (joined.includes('photoManagerLibrary')) return 'library';
        if (joined.includes('history')) return 'history';
        if (joined.includes('shift') || joined.includes('fiveS') || joined.includes('contact')) return 'notebook';
        return 'other';
    }

    analyzeImageStorage(value = this.data) {
        const categories = {};
        const uniqueSources = new Map();
        let occurrences = 0;
        let embeddedBytes = 0;
        const visit = (node, path = []) => {
            if (!node || typeof node !== 'object') return;
            Object.entries(node).forEach(([key, child]) => {
                const nextPath = [...path, key];
                if (this.isImageDataUrl(child)) {
                    const bytes = this.estimateDataUrlBytes(child);
                    const category = this.getImageStorageCategory(nextPath, key);
                    if (!categories[category]) categories[category] = { count: 0, bytes: 0 };
                    categories[category].count += 1;
                    categories[category].bytes += bytes;
                    occurrences += 1;
                    embeddedBytes += bytes;
                    if (!uniqueSources.has(child)) uniqueSources.set(child, bytes);
                } else if (child && typeof child === 'object') {
                    visit(child, nextPath);
                }
            });
        };
        visit(value);
        const uniqueBytes = Array.from(uniqueSources.values()).reduce((sum, bytes) => sum + bytes, 0);
        return {
            occurrences,
            uniqueCount: uniqueSources.size,
            embeddedBytes,
            uniqueBytes,
            duplicateBytes: Math.max(0, embeddedBytes - uniqueBytes),
            categories
        };
    }

    packImageDataForExport(payload, options = {}) {
        const mode = options.mode === 'light' ? 'light' : 'complete';
        const assets = {};
        const sourceToId = new Map();
        const excluded = { recent: 0, trash: 0, originals: 0 };
        const transientKeys = new Set(['imageSourceRecentUsed', 'shiftPhotoRecentImageStamps']);
        const clone = (node, path = [], parentKey = '') => {
            if (this.isImageDataUrl(node)) {
                let id = sourceToId.get(node);
                if (!id) {
                    id = `img_${sourceToId.size + 1}`;
                    sourceToId.set(node, id);
                    assets[id] = node;
                }
                return `maintenance-image-ref://${id}`;
            }
            if (Array.isArray(node)) return node.map((item, index) => clone(item, [...path, String(index)], parentKey));
            if (!node || typeof node !== 'object') return node;
            const result = {};
            Object.entries(node).forEach(([key, child]) => {
                if (mode === 'light' && transientKeys.has(key)) {
                    excluded.recent += Array.isArray(child) ? child.length : 1;
                    result[key] = [];
                    return;
                }
                if (mode === 'light' && key === 'photoManagerTrash') {
                    excluded.trash += Array.isArray(child) ? child.length : 1;
                    result[key] = [];
                    return;
                }
                if (mode === 'light' && key === 'originalImageSrc' && this.isImageDataUrl(child)) {
                    excluded.originals += 1;
                    result[key] = '';
                    return;
                }
                result[key] = clone(child, [...path, key], key);
            });
            return result;
        };
        return { payload: clone(payload), assets, excluded, mode };
    }

    hydratePackedImageData(imported) {
        if (!imported || typeof imported !== 'object' || !imported.imageAssets) return imported;
        const assets = imported.imageAssets;
        const hydrate = (node) => {
            if (typeof node === 'string' && node.startsWith('maintenance-image-ref://')) {
                return assets[node.slice('maintenance-image-ref://'.length)] || '';
            }
            if (Array.isArray(node)) return node.map(hydrate);
            if (!node || typeof node !== 'object') return node;
            Object.keys(node).forEach(key => {
                if (key !== 'imageAssets') node[key] = hydrate(node[key]);
            });
            return node;
        };
        const hydrated = hydrate(imported);
        delete hydrated.imageAssets;
        delete hydrated.imageExportMeta;
        return hydrated;
    }

    createOptimizedExport(payload, options = {}) {
        const packed = this.packImageDataForExport(payload, options);
        packed.payload.imageAssets = packed.assets;
        packed.payload.imageExportMeta = {
            format: 'maintenance-image-assets-v1',
            mode: packed.mode,
            createdAt: new Date().toISOString(),
            uniqueImages: Object.keys(packed.assets).length,
            excluded: packed.excluded
        };
        return JSON.stringify(packed.payload, null, 2);
    }

    getRemovableOriginalImageSummary(value = this.data) {
        let count = 0;
        let bytes = 0;
        const unique = new Set();
        const visit = (node) => {
            if (!node || typeof node !== 'object') return;
            if (this.isImageDataUrl(node.originalImageSrc) && this.isImageDataUrl(node.imageSrc)) {
                count += 1;
                if (!unique.has(node.originalImageSrc)) {
                    unique.add(node.originalImageSrc);
                    bytes += this.estimateDataUrlBytes(node.originalImageSrc);
                }
            }
            Object.values(node).forEach(child => {
                if (child && typeof child === 'object') visit(child);
            });
        };
        visit(value);
        return { count, bytes, uniqueCount: unique.size };
    }

    removeStoredOriginalImages(value = this.data) {
        let count = 0;
        const visit = (node) => {
            if (!node || typeof node !== 'object') return;
            if (this.isImageDataUrl(node.originalImageSrc) && this.isImageDataUrl(node.imageSrc)) {
                node.originalImageSrc = '';
                count += 1;
            }
            Object.values(node).forEach(child => {
                if (child && typeof child === 'object') visit(child);
            });
        };
        visit(value);
        if (count) this.save();
        return count;
    }

    getOptionalExportData() {
        const values = {};
        this.lastExportWarnings = [];
        for (const [key, defaultValue, isValid] of [
            ['skillEvaluations', {}, value => value && typeof value === 'object' && !Array.isArray(value)],
            ['manualSkills', [], value => Array.isArray(value)]
        ]) {
            try {
                const saved = localStorage.getItem(key);
                const value = saved == null ? defaultValue : JSON.parse(saved);
                if (!isValid(value)) throw new Error('保存データの構造が正しくありません。');
                values[key] = value;
            } catch (error) {
                // Keep mainData exportable. Omitting an unreadable field also prevents
                // an import from replacing existing skills with an invented empty value.
                this.lastExportWarnings.push(`${key} を読み込めず、出力から除外しました`);
                console.warn(`Could not include ${key} in JSON export`, error);
            }
        }
        return values;
    }

    getExportPayload() {
        return { mainData: this.data, ...this.getOptionalExportData() };
    }

    exportAsJSON(options = {}) {
        const payload = this.getExportPayload();
        return options.optimizeImages
            ? this.createOptimizedExport(payload, options)
            : JSON.stringify(payload, null, 2);
    }

    isImportRecord(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    getImportedSkillUpdates(imported) {
        const updates = {};
        for (const [key, isValid] of [
            ['skillEvaluations', value => this.isImportRecord(value)],
            ['manualSkills', value => Array.isArray(value)]
        ]) {
            if (!Object.prototype.hasOwnProperty.call(imported, key) || imported[key] == null) continue;
            if (!isValid(imported[key])) throw new Error(`${key} の形式が正しくありません。`);
            updates[key] = JSON.stringify(imported[key]);
        }
        return updates;
    }

    normalizeImportedState(candidate) {
        const previous = this.data;
        try {
            this.data = candidate;
            this.normalizeData();
            return this.data;
        } finally {
            this.data = previous;
        }
    }

    async commitImportedState(candidate, skillUpdates = {}, options = {}) {
        // Finish earlier edits before the separate skill values are replaced.
        do {
            await this.waitForSaveQueueIdle();
        } while (this._saveQueueRunning || this._saveQueue.length);
        if (options.expectedDataRef !== undefined
            && (this.data !== options.expectedDataRef
                || this._saveRequestedRevision !== options.expectedRevision)) {
            throw new Error('バックアップ後に現在のデータが変更されました。取込をもう一度開始してください。');
        }
        const previousData = this.data;
        const previousSkills = new Map();
        const changedSkills = [];
        try {
            const normalized = this.normalizeImportedState(candidate);
            for (const key of Object.keys(skillUpdates)) {
                previousSkills.set(key, localStorage.getItem(key));
            }
            // Write the smaller skill values first. If the main save then fails,
            // its transaction has not committed and these writes can be restored.
            for (const [key, value] of Object.entries(skillUpdates)) {
                localStorage.setItem(key, value);
                changedSkills.push(key);
            }
            this.data = normalized;
            await this.save({ importTransaction: true });
        } catch (error) {
            this.data = previousData;
            for (const key of changedSkills.reverse()) {
                try {
                    const oldValue = previousSkills.get(key);
                    if (oldValue == null) localStorage.removeItem(key);
                    else localStorage.setItem(key, oldValue);
                } catch (restoreError) {
                    console.error(`Failed to restore ${key} after import error`, restoreError);
                }
            }
            throw error;
        }
    }

    async importFromJSON(jsonString, options = {}) {
        try {
            const imported = this.hydratePackedImageData(JSON.parse(jsonString));
            if (!this.isImportRecord(imported)) throw new Error('取込データの形式が正しくありません。');
            const wrapped = Object.prototype.hasOwnProperty.call(imported, 'mainData');
            const dataToLoad = wrapped ? imported.mainData : imported;
            if (!this.isImportRecord(dataToLoad)) throw new Error('主データの形式が正しくありません。');
            const skillUpdates = wrapped ? this.getImportedSkillUpdates(imported) : {};

            if (Array.isArray(dataToLoad.departments) && this.isImportRecord(dataToLoad.deptData)) {
                await this.commitImportedState(dataToLoad, skillUpdates, options);
                return true;
            }
            if (['machines', 'history', 'tasks'].some(key => Array.isArray(dataToLoad[key]))) {
                const candidate = JSON.parse(JSON.stringify(this.data));
                const currentId = candidate.currentDepartmentId || 'dept_default';
                candidate.deptData ||= {};
                candidate.deptData[currentId] = {
                    ...(candidate.deptData[currentId] || {}),
                    machines: dataToLoad.machines || [],
                    tasks: dataToLoad.tasks || [],
                    history: dataToLoad.history || [],
                    partsMaster: dataToLoad.partsMaster || [],
                    archivedWorkers: dataToLoad.archivedWorkers || [],
                    archivedTasks: dataToLoad.archivedTasks || []
                };
                if (dataToLoad.settings) candidate.settings = dataToLoad.settings;
                await this.commitImportedState(candidate, skillUpdates, options);
                return true;
            }
            throw new Error('主データの形式が正しくありません。');
        } catch (e) {
            console.error('Import failed', e);
            if (options.throwOnError) throw e;
        }
        return false;
    }

    // --- Single Department Support ---
    exportCurrentDeptAsJSON(options = {}) {
        const deptId = this.data.currentDepartmentId;
        const deptInfo = this.data.departments.find(d => d.id === deptId);
        
        const payload = {
            type: 'single_department_backup',
            departmentName: deptInfo ? deptInfo.name : '不明な部署',
            timestamp: new Date().toISOString(),
            data: this.activeData,
            // Skill data is global but included for context
            ...this.getOptionalExportData()
        };
        return options.optimizeImages
            ? this.createOptimizedExport(payload, options)
            : JSON.stringify(payload, null, 2);
    }

    async importToCurrentDeptFromJSON(jsonString) {
        try {
            const imported = this.hydratePackedImageData(JSON.parse(jsonString));
            
            // Validate type
            if (!this.isImportRecord(imported) || imported.type !== 'single_department_backup') {
                return { success: false, message: 'このファイルは個人・単独部署用ではありません。「全データ取込」を使用してください。' };
            }
            if (!this.isImportRecord(imported.data)) {
                return { success: false, message: '部署データの形式が正しくありません。' };
            }
            const updates = this.getImportedSkillUpdates(imported);
            if (Object.prototype.hasOwnProperty.call(updates, 'skillEvaluations')) {
                const current = JSON.parse(localStorage.getItem('skillEvaluations') || '{}');
                if (!this.isImportRecord(current)) throw new Error('現在のスキル評価を読み込めません。');
                updates.skillEvaluations = JSON.stringify({ ...current, ...imported.skillEvaluations });
            }
            if (Object.prototype.hasOwnProperty.call(updates, 'manualSkills')) {
                const current = JSON.parse(localStorage.getItem('manualSkills') || '[]');
                if (!Array.isArray(current)) throw new Error('現在の手動スキルを読み込めません。');
                const combined = [...current, ...imported.manualSkills];
                updates.manualSkills = JSON.stringify(combined.filter((value, index, values) =>
                    values.findIndex(item => JSON.stringify(item) === JSON.stringify(value)) === index));
            }
            const candidate = JSON.parse(JSON.stringify(this.data));
            const deptId = candidate.currentDepartmentId || 'dept_default';
            candidate.deptData ||= {};
            candidate.deptData[deptId] = Object.fromEntries(
                Object.entries(imported.data).filter(([key]) => !['__proto__', 'prototype', 'constructor'].includes(key))
            );
            await this.commitImportedState(candidate, updates);
            return { success: true, departmentName: imported.departmentName };
        } catch (e) {
            console.error('Dept import failed', e);
            return { success: false, message: '部署データの取込に失敗しました。保存先を確認してください。' };
        }
    }


    // Normalization Helpers
    static toLocalDateString(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    static toFullWidth(str) {
        if (!str) return '';
        // Convert to full-width half-width range (!-~)
        return str.replace(/[!-~]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
    }

    static toFullWidthUpper(str) {
        if (!str) return '';
        return this.toFullWidth(str).toUpperCase().trim();
    }

    static toHalfWidthLower(str) {
        if (!str) return '';
        const half = str.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        return half.toLowerCase().trim();
    }

    static canvasHasTransparency(ctx, width, height) {
        try {
            const data = ctx.getImageData(0, 0, width, height).data;
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] < 255) return true;
            }
        } catch (e) {
            return false;
        }
        return false;
    }

    static resizeImage(file, maxSide = 1000, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxSide) {
                            height *= maxSide / width;
                            width = maxSide;
                        }
                    } else {
                        if (height > maxSide) {
                            width *= maxSide / height;
                            height = maxSide;
                        }
                    }

                    canvas.width = Math.max(1, Math.round(width));
                    canvas.height = Math.max(1, Math.round(height));
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const hasAlpha = MaintenanceStore.canvasHasTransparency(ctx, canvas.width, canvas.height);
                    resolve(hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    static readImageAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    static rotateImageBase64(base64data, degrees = 90) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                if (degrees === 90 || degrees === 270) {
                    canvas.width = img.height;
                    canvas.height = img.width;
                } else {
                    canvas.width = img.width;
                    canvas.height = img.height;
                }
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(degrees * Math.PI / 180);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
                const hasAlpha = MaintenanceStore.canvasHasTransparency(ctx, canvas.width, canvas.height);
                resolve(hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = reject;
            img.src = base64data;
        });
    }
}

// Global instance
const store = new MaintenanceStore();
window.store = store;
