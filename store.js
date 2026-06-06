/** 
 * Store.js - Data Management & Persistence
 */
class MaintenanceStore {
    constructor() {
        this.DB_NAME = 'FactoryMaintenanceDB';
        this.DB_VERSION = 1;
        this.STORE_NAME = 'state';
        this.STORAGE_KEY = 'factory_maintenance_next_data_v2'; // Versioning for department support
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

    async init() {
        return new Promise((resolve) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME);
                }
            };
            
            request.onsuccess = async (e) => {
                this.db = e.target.result;
                await this.loadFromIDB();
                resolve();
            };
            
            request.onerror = (e) => {
                console.error("IndexedDB error, falling back to LocalStorage", e);
                this.loadLegacy();
                resolve();
            };
        });
    }

    async loadFromIDB() {
        return new Promise((resolve) => {
            const tx = this.db.transaction(this.STORE_NAME, 'readonly');
            const os = tx.objectStore(this.STORE_NAME);
            const request = os.get(this.STORAGE_KEY);
            
            request.onsuccess = () => {
                if (request.result) {
                    this.data = request.result;
                } else {
                    // Try to migrate from LocalStorage
                    this.loadLegacy();
                    if (this.data) this.save(); // Migrate immediately to IndexedDB
                }
                this.normalizeData();
                resolve();
            };
            request.onerror = () => {
                this.loadLegacy();
                resolve();
            };
        });
    }

    loadLegacy() {
        const saved = localStorage.getItem(this.STORAGE_KEY) || localStorage.getItem('factory_maintenance_next_data');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                
                // Migration: From single-dept to multi-dept
                if (parsed.machines || parsed.history || parsed.tasks) {
                    console.log('Migrating legacy data to department structure...');
                    this.data.deptData['dept_default'] = {
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
            } catch (e) {
                console.error('Failed to parse storage data', e);
            }
        }
        this.normalizeData();
    }

    normalizeData() {
        // Integrity check for departments
        if (!this.data.departments || this.data.departments.length === 0) {
            this.data.departments = [{ id: 'dept_default', name: '初期部署' }];
        }
        if (!this.data.currentDepartmentId) {
            this.data.currentDepartmentId = this.data.departments[0].id;
        }
        
        // Fix missing keys in each department
        Object.keys(this.data.deptData || {}).forEach(id => {
            const d = this.data.deptData[id];
            if (!d.machines) d.machines = [];
            if (!d.tasks) d.tasks = [];
            if (!d.history) d.history = [];
            if (!d.partsMaster) d.partsMaster = [];
            if (!d.archivedWorkers) d.archivedWorkers = [];
            if (!d.archivedTasks) d.archivedTasks = [];
            if (!d.archivedParts) d.archivedParts = [];
            if (!d.archivedMaintenanceTasks) d.archivedMaintenanceTasks = [];
            if (!d.archivedGuides) d.archivedGuides = [];
            if (!d.machineCategories) d.machineCategories = [];
            if (!d.archivedMachineCategories) d.archivedMachineCategories = [];
            if (!d.memos) d.memos = {};
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

    async save() {
        const notify = (status, detail = {}) => {
            window.dispatchEvent(new CustomEvent('maintenance-save-status', {
                detail: { status, ...detail }
            }));
        };
        notify('saving');
        if (!this.db) {
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
                notify('saved');
            } catch (error) {
                notify('error', { error });
                throw error;
            }
            return;
        }
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
            const os = tx.objectStore(this.STORE_NAME);
            const req = os.put(this.data, this.STORAGE_KEY);
            req.onsuccess = () => {
                notify('saved');
                resolve();
            };
            req.onerror = e => {
                console.error('Save failed', e);
                notify('error', { error: e });
                reject(e);
            };
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
                this.activeData.partsMaster[idx] = { 
                    ...this.activeData.partsMaster[idx], 
                    ...updates,
                    // Ensure stock values are numbers
                    stock: updates.stock !== undefined ? parseFloat(updates.stock) || 0 : this.activeData.partsMaster[idx].stock,
                    minStock: updates.minStock !== undefined ? parseFloat(updates.minStock) || 0 : this.activeData.partsMaster[idx].minStock,
                    unit: updates.unit || this.activeData.partsMaster[idx].unit || '個'
                };
            } else {
                this.activeData.partsMaster.push({ 
                    name, model, 
                    ...updates,
                    stock: parseFloat(updates.stock) || 0,
                    minStock: parseFloat(updates.minStock) || 0,
                    unit: updates.unit || '個'
                });
            }
        }
        this.save();
    }

    /**
     * Adjusts the stock of a part by a given delta (positive for restock, negative for use)
     */
    adjustStock(name, model, delta) {
        const master = this.getPartMaster(name, model);
        if (master) {
            const idx = this.activeData.partsMaster.indexOf(master);
            const currentStock = parseFloat(this.activeData.partsMaster[idx].stock) || 0;
            const newStock = currentStock + delta;
            // Round to 3 decimal places to avoid IEEE 754 precision issues
            this.activeData.partsMaster[idx].stock = Math.round(newStock * 1000) / 1000;
            this.save();
            return true;
        }
        // If not found in master, we could optionally create it, but for now we just return false
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
            startDate: startDate || new Date().toISOString().split('T')[0],
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
            date: record.date || new Date().toISOString().split('T')[0],
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
    exportAsJSON() {
        const payload = {
            mainData: this.data,
            skillEvaluations: JSON.parse(localStorage.getItem('skillEvaluations') || '{}'),
            manualSkills: JSON.parse(localStorage.getItem('manualSkills') || '[]')
        };
        return JSON.stringify(payload, null, 2);
    }

    importFromJSON(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            let dataToLoad = imported;

            // Check if this is the new payload format (includes skills)
            if (imported.mainData) {
                dataToLoad = imported.mainData;
                if (imported.skillEvaluations) {
                    localStorage.setItem('skillEvaluations', JSON.stringify(imported.skillEvaluations));
                }
                if (imported.manualSkills) {
                    localStorage.setItem('manualSkills', JSON.stringify(imported.manualSkills));
                }
            }

            // Case 1: New multi-dept format
            if (dataToLoad.departments && dataToLoad.deptData) {
                this.data = dataToLoad;
                this.save();
                return true;
            }
            // Case 2: Legacy single-dept format
            if (dataToLoad.machines || dataToLoad.history || dataToLoad.tasks) {
                const currentId = this.data.currentDepartmentId;
                if (!this.data.deptData[currentId]) {
                    this.data.deptData[currentId] = { machines: [], tasks: [], history: [], partsMaster: [], archivedWorkers: [], archivedTasks: [] };
                }
                const active = this.data.deptData[currentId];
                active.machines = dataToLoad.machines || [];
                active.tasks = dataToLoad.tasks || [];
                active.history = dataToLoad.history || [];
                active.partsMaster = dataToLoad.partsMaster || [];
                active.archivedWorkers = dataToLoad.archivedWorkers || [];
                active.archivedTasks = dataToLoad.archivedTasks || [];
                
                if (dataToLoad.settings) this.data.settings = dataToLoad.settings;
                
                this.save();
                return true;
            }
        } catch (e) {
            console.error('Import failed', e);
        }
        return false;
    }

    // --- Single Department Support ---
    exportCurrentDeptAsJSON() {
        const deptId = this.data.currentDepartmentId;
        const deptInfo = this.data.departments.find(d => d.id === deptId);
        
        const payload = {
            type: 'single_department_backup',
            departmentName: deptInfo ? deptInfo.name : '不明な部署',
            timestamp: new Date().toISOString(),
            data: this.activeData,
            // Skill data is global but included for context
            skillEvaluations: JSON.parse(localStorage.getItem('skillEvaluations') || '{}'),
            manualSkills: JSON.parse(localStorage.getItem('manualSkills') || '[]')
        };
        return JSON.stringify(payload, null, 2);
    }

    importToCurrentDeptFromJSON(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            
            // Validate type
            if (imported.type !== 'single_department_backup') {
                return { success: false, message: 'このファイルは個人・単独部署用ではありません。「全データ取込」を使用してください。' };
            }

            // Confirm department name mismatch (optional warning, handled by UI)
            
            // Overwrite current department data
            const active = this.activeData;
            if (imported.data) {
                active.machines = imported.data.machines || [];
                active.tasks = imported.data.tasks || [];
                active.history = imported.data.history || [];
                active.partsMaster = imported.data.partsMaster || [];
                active.archivedWorkers = imported.data.archivedWorkers || [];
                active.archivedTasks = imported.data.archivedTasks || [];
                active.archivedParts = imported.data.archivedParts || [];
                active.archivedMaintenanceTasks = imported.data.archivedMaintenanceTasks || [];
                active.archivedGuides = imported.data.archivedGuides || [];
                active.machineCategories = imported.data.machineCategories || [];
                active.archivedMachineCategories = imported.data.archivedMachineCategories || [];
                active.archivedSuggestions = imported.data.archivedSuggestions || { errorNo: [], content: [], cause: [], notes: [], workers: [], partName: [], partModel: [], partSerial: [] };
                active.memos = imported.data.memos || {};
                active.dokateiCounters = imported.data.dokateiCounters || [{ location: '', lastDate: '' }, { location: '', lastDate: '' }, { location: '', lastDate: '' }];
            }

            // Merge skills (overwrite specific keys if present)
            if (imported.skillEvaluations) {
                const currentSkills = JSON.parse(localStorage.getItem('skillEvaluations') || '{}');
                const merged = { ...currentSkills, ...imported.skillEvaluations };
                localStorage.setItem('skillEvaluations', JSON.stringify(merged));
            }
            if (imported.manualSkills) {
                const currentManual = JSON.parse(localStorage.getItem('manualSkills') || '[]');
                // Merge without duplicates based on content? For now just append and unique
                const combined = [...currentManual, ...imported.manualSkills];
                const unique = combined.filter((v, i, a) => a.findIndex(t => JSON.stringify(t) === JSON.stringify(v)) === i);
                localStorage.setItem('manualSkills', JSON.stringify(unique));
            }

            this.save();
            return { success: true, departmentName: imported.departmentName };
        } catch (e) {
            console.error('Dept import failed', e);
            return { success: false, message: 'ファイルの解析に失敗しました。' };
        }
    }


    // Normalization Helpers
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

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
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
                const ctx = canvas.getContext('2d');
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(degrees * Math.PI / 180);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = reject;
            img.src = base64data;
        });
    }
}

// Global instance
const store = new MaintenanceStore();
window.store = store;
