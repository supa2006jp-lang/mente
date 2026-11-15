(function () {
    'use strict';
    const P = MaintenanceApp.prototype;
    const key = () => 'maintenance-search-presets-v1:' + store.data.currentDepartmentId;
    const validView = name => !!document.getElementById('view-' + name);
    const filterControls = view => [...(document.getElementById('view-' + view)?.querySelectorAll('select[id*="filter"], input[id*="filter"], input[id$="-search"], select[id*="group-by"]') || [])];
    const viewProps = {
        calendar: ['calLineFilter'],
        history: ['customStartDate', 'customEndDate', 'modelFilter', 'workerFilter', 'machineCategoryFilter', 'historyMissingDetailFilter', 'historyRecurrenceFrequencyFilter'],
        worktime: ['customStartDate', 'customEndDate', 'workTimeGroupBy', 'workTimeDrillDownCategory', 'workTimeSearchQuery', 'excludePeriodicInTrend'],
        analysis: ['customStartDate', 'customEndDate', 'costDrillDownCategory', 'costFilter'],
        ranking: ['customStartDate', 'customEndDate', 'rankingPeriod'],
        dashboard: ['customStartDate', 'customEndDate', 'dashboardPeriod', 'todayWorkspaceFilters'],
        fiveS: ['customStartDate', 'customEndDate'],
        machines: ['machineMaintenanceListMode', 'machineMaintenanceListFilters'],
        workers: ['skillSearchQuery', 'skillModelFilter', 'skillRiskFilter', 'skillSoloFilter'],
        guides: ['guideTagFilter', 'guideLineFilter'],
        todos: ['kanbanTodoWorkerId', 'kanbanOverdueOnly', 'kanbanRequesterOnly', 'kanbanTodoPriorityFilter']
    };
    const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
    P.switchSearchDateContext = function (view) {
        if (view === this.currentView) return;
        this._viewSearchDates ||= Object.create(null);
        this._viewSearchDates[this.currentView] = [this.customStartDate, this.customEndDate];
        [this.customStartDate, this.customEndDate] = this._viewSearchDates[view] || [null, null];
    };
    P.getNamedSearches = function () {
        try { const saved = JSON.parse(localStorage.getItem(key()) || '[]'); return Array.isArray(saved) ? saved.filter(p => p && typeof p.name === 'string' && validView(p.view)).slice(0, 30) : []; }
        catch (_) { return []; }
    };
    P.captureNamedSearch = function (name) {
        const scope = document.getElementById('search-scope')?.value || 'view';
        const fields = {};
        if (scope === 'view') for (const field of filterControls(this.currentView)) fields[field.id] = field.type === 'checkbox' ? field.checked : field.value;
        return { name: String(name || '').trim().slice(0, 80), view: this.currentView, scope, fields,
            query: document.getElementById(scope === 'all' ? 'notebook-search' : 'global-search')?.value || '',
            period: document.getElementById('notebook-search-period')?.value || 'all',
            targets: this.getSavedUnifiedSearchTargetTypes?.() || [],
            dates: this.getPeriodDateState(scope === 'all' ? 'all' : this.currentView),
            props: Object.fromEntries((scope === 'view' ? viewProps[this.currentView] || [] : []).map(p => [p, clone(this[p])])) };
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
            const scope = preset.scope === 'all' ? 'all' : 'view';
            if (scope === 'view') {
                this.switchView(preset.view);
                // Apply the same whitelist to older presets, which stored every view's state.
                for (const p of viewProps[preset.view] || []) if (Object.prototype.hasOwnProperty.call(preset.props || {}, p)) this[p] = clone(preset.props[p]);
                if (preset.view === 'dashboard') this._todayWorkspaceDepartment = department;
            }
            if (preset.dates) {
                this.setPeriodDateState(preset.dates, scope === 'all' ? 'all' : preset.view);
                this.updateHistoryPeriodOptions();
            }
            for (const field of scope === 'view' ? filterControls(preset.view) : []) {
                if (!Object.prototype.hasOwnProperty.call(preset.fields || {}, field.id)) continue;
                const value = preset.fields[field.id];
                if (field.type === 'checkbox') field.checked = !!value;
                else if (field.tagName !== 'SELECT' || [...field.options].some(o => o.value === String(value))) field.value = String(value);
            }
            if (scope === 'view' && preset.view === 'worktime') { this.saveWorkTimePeriodSelection(); this.saveWorkTimeGroupSelection(); this.updateWorkTimeGroupUI(this.workTimeGroupBy); }
            document.getElementById('search-scope').value = scope;
            this.updateSearchScope();
            const input = document.getElementById(preset.scope === 'all' ? 'notebook-search' : 'global-search'); input.value = preset.query || '';
            const period = document.getElementById('notebook-search-period');
            if (preset.scope === 'all') {
                period.value = preset.period || 'all';
                if (Array.isArray(preset.targets) && preset.targets.length) localStorage.setItem('unified_search_target_types', JSON.stringify(preset.targets));
                await this.openShiftNotebookSearchResults(input.value, period.value);
            } else {
                this._viewSearchQueries ||= Object.create(null); this._viewSearchQueries[preset.view] = input.value;
                this.renderView(preset.view);
            }
            this.refreshSearchConditionSummary();
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
        this.refreshSearchConditionSummary();
    };
    P.getSearchConditionSummary = function () {
        const all = document.getElementById('search-scope')?.value === 'all';
        const conditions = [];
        const query = document.getElementById(all ? 'notebook-search' : 'global-search');
        if (query && !query.disabled && query.value.trim()) conditions.push(`検索：${query.value.trim()}`);
        const controls = all ? [document.getElementById('notebook-search-period')] : filterControls(this.currentView);
        for (const field of controls) {
            if (!field || field.disabled || /group-by/.test(field.id)) continue;
            if (field.type === 'checkbox') { if (field.checked) conditions.push(field.closest('label')?.textContent.trim() || field.id); }
            else if (field.value && field.value !== 'all') {
                conditions.push(field.tagName === 'SELECT' ? field.selectedOptions[0]?.textContent || field.value : field.value);
            }
        }
        if (all) {
            const targets = this.getSavedUnifiedSearchTargetTypes?.();
            if (targets && targets.length < 6) conditions.push('検索対象の種類を限定');
        }
        if (!all) {
            const extras = {
                history: [['modelFilter','型式'],['workerFilter','作業者'],['machineCategoryFilter','装置区分'],['historyMissingDetailFilter','未入力項目'],['historyRecurrenceFrequencyFilter','再発頻度']],
                workers: [['skillModelFilter','型式'],['skillRiskFilter','リスク'],['skillSoloFilter','単独対応']],
                worktime: [['workTimeDrillDownCategory','内訳'],['excludePeriodicInTrend','定期除外']],
                guides: [['guideTagFilter','タグ']],
                todos: [['kanbanTodoWorkerId','担当者'],['kanbanOverdueOnly','期限超過'],['kanbanRequesterOnly','自分の依頼'],['kanbanTodoPriorityFilter','優先度']]
            }[this.currentView] || [];
            for (const [key,label] of extras) if (this[key] && this[key] !== 'all') conditions.push(label);
            if (this.currentView === 'machines' && this.machineMaintenanceListMode) {
                for (const [key,label] of [['status','状態'],['kind','メンテ種別'],['line','ライン']]) {
                    const value = this.machineMaintenanceListFilters?.[key];
                    if (value && value !== 'all') conditions.push(`${label}：${value}`);
                }
            }
        }
        return { scope: all ? '全体' : 'この画面', conditions };
    };
    P.refreshSearchConditionSummary = function () {
        const badge = document.getElementById('search-condition-summary'); if (!badge) return;
        const { scope, conditions } = this.getSearchConditionSummary();
        badge.hidden = !document.getElementById('search-workspace-controls')?.hidden || !conditions.length;
        badge.textContent = `${scope}・条件 ${conditions.length} 件`;
        badge.title = conditions.join(' / ');
        badge.setAttribute('aria-label', `${scope}・条件 ${conditions.length} 件：${conditions.join('、')}。検索条件を表示`);
    };
    P.setSearchWorkspaceCollapsed = function (collapsed, persist = true) {
        const bar = document.querySelector('.header-search-workspace');
        const controls = document.getElementById('search-workspace-controls');
        const toggle = document.getElementById('search-workspace-toggle');
        if (!bar || !controls || !toggle) return;
        controls.hidden = !!collapsed;
        bar.classList.toggle('is-collapsed', !!collapsed);
        toggle.textContent = collapsed ? '▸ 検索を表示' : '▾ 検索を隠す';
        toggle.setAttribute('aria-expanded', String(!collapsed));
        if (collapsed) {
            bar.querySelector('.saved-search-controls').open = false;
            if (controls.contains(document.activeElement)) toggle.focus();
        }
        if (persist) {
            try { localStorage.setItem('maintenance-search-panel-collapsed-v1', String(!!collapsed)); } catch (_) {}
        }
        this.refreshSearchConditionSummary();
    };
    P.initializeSearchPresets = function () {
        const search = document.querySelector('.search-bar'); if (!search || document.getElementById('search-scope')) return;
        const group = document.createElement('div'); group.className = 'search-scope-controls workspace-toolbar';
        const label = document.createElement('label'); label.textContent = '検索対象';
        const scope = document.createElement('select'); scope.id = 'search-scope'; scope.add(new Option('この画面', 'view')); scope.add(new Option('全体', 'all')); scope.onchange = () => this.updateSearchScope(); label.append(scope);
        const details = document.createElement('details'); details.className = 'saved-search-controls';
        const summary = document.createElement('summary'); summary.textContent = '保存条件'; summary.title = '検索条件を保存・呼び出す'; details.append(summary);
        const panel = document.createElement('div'); panel.className = 'workspace-toolbar saved-search-panel';
        const name = document.createElement('input'); name.id = 'saved-search-name'; name.placeholder = '条件の名前'; name.setAttribute('aria-label', '検索条件の名前'); name.maxLength = 80;
        const select = document.createElement('select'); select.id = 'saved-search-select'; select.setAttribute('aria-label', '保存した検索条件');
        const btn = (text, action) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary-btn'; b.textContent = text; b.onclick = action; return b; };
        panel.append(name, btn('今の条件を保存', () => this.saveNamedSearch(name.value)), select, btn('呼び出す', () => this.applyNamedSearch(select.value)), btn('削除', () => {
            if (!select.value) return;
            try { localStorage.setItem(key(), JSON.stringify(this.getNamedSearches().filter(p => p.name !== select.value))); this.refreshNamedSearchOptions(); }
            catch (_) { this.showToast('検索条件を削除できませんでした。', 'error'); }
        }));
        const note = document.createElement('small'); note.textContent = 'この端末・部署ごとに、検索語・期間・絞り込み条件を保存します。'; panel.append(note);
        details.append(panel); group.append(label);
        const bar = document.createElement('div'); bar.className = 'header-search-workspace';
        document.querySelector('.top-header').after(bar);
        const toggle = btn('検索を隠す', () => this.setSearchWorkspaceCollapsed(!controls.hidden));
        toggle.id = 'search-workspace-toggle'; toggle.setAttribute('aria-controls', 'search-workspace-controls');
        const controls = document.createElement('div'); controls.id = 'search-workspace-controls'; controls.className = 'search-workspace-controls';
        controls.append(group, search);
        for (const item of [document.querySelector('.notebook-search-bar'), document.getElementById('view-filter-clear')]) if (item) controls.append(item);
        const badge = btn('', () => this.setSearchWorkspaceCollapsed(false)); badge.id = 'search-condition-summary'; badge.hidden = true;
        controls.append(details); bar.append(toggle, badge, controls);
        for (const event of ['input', 'change', 'click']) document.addEventListener(event, () => {
            if (this._searchSummaryFrame) cancelAnimationFrame(this._searchSummaryFrame);
            this._searchSummaryFrame = requestAnimationFrame(() => { this._searchSummaryFrame = null; this.refreshSearchConditionSummary(); });
        });
        document.addEventListener('click', event => { if (details.open && !details.contains(event.target)) details.open = false; });
        details.addEventListener('keydown', event => { if (event.key === 'Escape') { details.open = false; summary.focus(); event.stopPropagation(); } });
        let collapsed = false;
        try { collapsed = localStorage.getItem('maintenance-search-panel-collapsed-v1') === 'true'; } catch (_) {}
        this.setSearchWorkspaceCollapsed(collapsed, false);
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
