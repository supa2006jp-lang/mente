(function () {
    'use strict';
    const P = MaintenanceApp.prototype;
    const key = () => 'maintenance-search-presets-v1:' + store.data.currentDepartmentId;
    const validView = name => !!document.getElementById('view-' + name);
    const filterControls = view => [...(document.getElementById('view-' + view)?.querySelectorAll('select[id*="filter"], input[id*="filter"], input[id$="-search"], select[id*="group-by"]') || [])];
    const props = ['customStartDate', 'customEndDate', 'workTimeGroupBy', 'workTimeDrillDownCategory', 'workTimeSearchQuery', 'skillSearchQuery', 'dashboardPeriod', 'rankingPeriod', 'machineMaintenanceListMode', 'machineMaintenanceListFilters', 'todayWorkspaceFilters', 'kanbanTodoWorkerId', 'kanbanOverdueOnly', 'kanbanRequesterOnly', 'kanbanTodoPriorityFilter', 'excludePeriodicInTrend'];
    P.getNamedSearches = function () {
        try { const saved = JSON.parse(localStorage.getItem(key()) || '[]'); return Array.isArray(saved) ? saved.filter(p => p && typeof p.name === 'string' && validView(p.view)).slice(0, 30) : []; }
        catch (_) { return []; }
    };
    P.captureNamedSearch = function (name) {
        const scope = document.getElementById('search-scope')?.value || 'view';
        const fields = {};
        for (const field of filterControls(this.currentView)) fields[field.id] = field.type === 'checkbox' ? field.checked : field.value;
        return { name: String(name || '').trim().slice(0, 80), view: this.currentView, scope, fields,
            query: document.getElementById(scope === 'all' ? 'notebook-search' : 'global-search')?.value || '',
            period: document.getElementById('notebook-search-period')?.value || 'all',
            targets: this.getSavedUnifiedSearchTargetTypes?.() || [],
            props: Object.fromEntries(props.map(p => [p, this[p] ?? null])) };
    };
    P.saveNamedSearch = function (name) {
        const preset = this.captureNamedSearch(name);
        if (!preset.name) { this.showToast('検索条件の名前を入力してください。', 'warning'); return false; }
        const saved = this.getNamedSearches();
        if (saved.some(p => p.name === preset.name)) { this.showToast('同じ名前があるため保存していません。別の名前を入力してください。', 'warning'); return false; }
        if (saved.length >= 30) { this.showToast('保存できる検索条件は30件です。不要な条件を削除してください。', 'warning'); return false; }
        try { localStorage.setItem(key(), JSON.stringify([...saved, preset])); }
        catch (_) { this.showToast('検索条件を保存できませんでした。端末の空き容量を確認してください。', 'error'); return false; }
        this.refreshNamedSearchOptions(preset.name); this.showToast('この部署の検索条件を保存しました。', 'success'); return true;
    };
    P.applyNamedSearch = async function (name) {
        const preset = this.getNamedSearches().find(p => p.name === name);
        if (!preset) return this.showToast('保存した検索条件を選択してください。', 'warning');
        const department = store.data.currentDepartmentId;
        try {
            await window.maintenanceLazyFeatures.loadNotebook(); await window.maintenanceLazyFeatures.loadPhotos();
            if (department !== store.data.currentDepartmentId) return;
            this.switchView(preset.view);
            for (const p of props) if (Object.prototype.hasOwnProperty.call(preset.props || {}, p)) this[p] = preset.props[p];
            for (const field of filterControls(preset.view)) {
                if (!Object.prototype.hasOwnProperty.call(preset.fields || {}, field.id)) continue;
                const value = preset.fields[field.id];
                if (field.type === 'checkbox') field.checked = !!value;
                else if (field.tagName !== 'SELECT' || [...field.options].some(o => o.value === String(value))) field.value = String(value);
            }
            if (preset.view === 'worktime') { this.saveWorkTimePeriodSelection(); this.saveWorkTimeGroupSelection(); this.updateWorkTimeGroupUI(this.workTimeGroupBy); }
            document.getElementById('search-scope').value = preset.scope === 'all' ? 'all' : 'view';
            this.updateSearchScope();
            const input = document.getElementById(preset.scope === 'all' ? 'notebook-search' : 'global-search'); input.value = preset.query || '';
            const period = document.getElementById('notebook-search-period'); period.value = preset.period || 'all';
            if (preset.scope === 'all') {
                if (Array.isArray(preset.targets) && preset.targets.length) localStorage.setItem('unified_search_target_types', JSON.stringify(preset.targets));
                await this.openShiftNotebookSearchResults(input.value, period.value);
            } else {
                this._viewSearchQueries ||= Object.create(null); this._viewSearchQueries[preset.view] = input.value;
                this.renderView(preset.view);
            }
            this.showToast(`「${preset.name}」の検索条件を復元しました。`, 'success');
        } catch (error) { console.warn('Search preset restore failed', error); this.showToast('検索条件を復元できませんでした。もう一度お試しください。', 'error'); }
    };
    P.refreshNamedSearchOptions = function (selected = '') {
        const select = document.getElementById('saved-search-select'); if (!select) return;
        select.replaceChildren(new Option('保存した検索条件', ''));
        for (const preset of this.getNamedSearches()) select.add(new Option(preset.name, preset.name));
        select.value = selected;
    };
    P.updateSearchScope = function () {
        const scope = document.getElementById('search-scope')?.value || 'view';
        const view = document.querySelector('.search-bar'), all = document.querySelector('.notebook-search-bar');
        if (view) view.hidden = scope === 'all';
        if (all) all.hidden = scope !== 'all';
        this.refreshNamedSearchOptions();
    };
    P.initializeSearchPresets = function () {
        const search = document.querySelector('.search-bar'); if (!search || document.getElementById('search-scope')) return;
        const group = document.createElement('div'); group.className = 'search-scope-controls workspace-toolbar';
        const label = document.createElement('label'); label.textContent = '検索対象';
        const scope = document.createElement('select'); scope.id = 'search-scope'; scope.add(new Option('この画面', 'view')); scope.add(new Option('全体', 'all')); scope.onchange = () => this.updateSearchScope(); label.append(scope);
        const details = document.createElement('details'); details.className = 'saved-search-controls';
        const summary = document.createElement('summary'); summary.textContent = '検索条件を保存・呼び出す'; details.append(summary);
        const panel = document.createElement('div'); panel.className = 'workspace-toolbar';
        const name = document.createElement('input'); name.id = 'saved-search-name'; name.placeholder = '条件の名前'; name.setAttribute('aria-label', '検索条件の名前'); name.maxLength = 80;
        const select = document.createElement('select'); select.id = 'saved-search-select'; select.setAttribute('aria-label', '保存した検索条件');
        const btn = (text, action) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary-btn'; b.textContent = text; b.onclick = action; return b; };
        panel.append(name, btn('今の条件を保存', () => this.saveNamedSearch(name.value)), select, btn('呼び出す', () => this.applyNamedSearch(select.value)), btn('削除', () => {
            if (!select.value) return;
            try { localStorage.setItem(key(), JSON.stringify(this.getNamedSearches().filter(p => p.name !== select.value))); this.refreshNamedSearchOptions(); }
            catch (_) { this.showToast('検索条件を削除できませんでした。', 'error'); }
        }));
        const note = document.createElement('small'); note.textContent = 'この端末・部署ごとに、検索語・期間・絞り込み条件を保存します。'; panel.append(note);
        details.append(panel); group.append(label, details);
        const bar = document.createElement('div'); bar.className = 'header-search-workspace';
        document.querySelector('.top-header').after(bar);
        bar.append(group, search);
        for (const item of [document.getElementById('view-filter-clear'), document.querySelector('.notebook-search-bar')]) if (item) bar.append(item);
        this.updateSearchScope();
        this.initializeCompactNavigation();
    };
    P.initializeCompactNavigation = function () {
        const sidebar = document.getElementById('sidebar'), toggle = document.getElementById('sidebar-toggle');
        if (!sidebar || !toggle || sidebar.dataset.compactNavigation) return;
        sidebar.dataset.compactNavigation = '1';
        const media = window.matchMedia('(max-width: 720px)');
        const backdrop = document.createElement('button'); backdrop.type = 'button'; backdrop.className = 'mobile-sidebar-backdrop'; backdrop.hidden = true; backdrop.setAttribute('aria-label', 'メニューを閉じる'); document.body.append(backdrop);
        const setOpen = open => { sidebar.classList.toggle('mobile-open', open); backdrop.hidden = !open; toggle.setAttribute('aria-expanded', String(open)); };
        toggle.addEventListener('click', event => { if (media.matches) { event.stopImmediatePropagation(); setOpen(!sidebar.classList.contains('mobile-open')); } }, true);
        sidebar.addEventListener('click', event => { if (media.matches && event.target.closest('.nav-btn')) setOpen(false); });
        document.addEventListener('keydown', event => { if (event.key === 'Escape') setOpen(false); });
        backdrop.onclick = () => setOpen(false);
        media.addEventListener('change', () => setOpen(false));
    };
})();
