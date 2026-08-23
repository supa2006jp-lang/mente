/**
 * App.js - Main Controller & Navigation
 */
class MaintenanceApp {
    constructor() {
        this.currentView = 'calendar';
        this.currentDate = new Date(); // Displayed month in calendar
        this._tempPhotos = []; 
        this.modelFilter = null; // Filter history by machine model
        this.workerFilter = null; // Filter history by worker name
        this.skillSortMode = 'count'; // 'count' or 'model'
        this.skillModelFilter = null; // Filter skill map by machine model
        this.skillSearchQuery = ''; // Filter skill map by text
        this.skillRiskFilter = false; // Show only tasks with no '○'
        this.skillSoloFilter = false; // Show only tasks with exactly one '○'
        this.skillFitAll = false; // Whether to squeeze workers into one screen
        this.showSkillStats = false; // Toggle for skill stats report
        this.machineStatsFilter = ''; // Filter for machine coverage grid
        this.workTimeSearchQuery = ''; // Filter worktime view by text
        this.guideTagFilter = null; // Currently selected tag in guides view
        this.guideLineFilter = 'all'; // Currently selected line in guides view
        this.calLineFilter = 'all'; // Currently selected line in calendar view
        this.calendarCompactMode = localStorage.getItem('calendar_compact_mode') === 'true';
        this.expandedCompactMemos = new Set();
        this.machineSort = 'rank'; // 'rank' or 'cost' or 'name' or 'newest'
        this.analysisMode = 'parts'; // 'parts' or 'machines'
        this.laborRate = parseFloat(localStorage.getItem('maintenance_labor_rate')) || 3500; // Hourly rate for labor cost calculation
        this.costFilter = 'all'; // 'all', 'periodic', 'sudden'
        this.workTimeDrillDownCategory = null; // Filter worktime by category (Drill-down)
        this.dashboardPeriod = 'yesterday_today'; // Default dashboard view range
        this.excludePeriodicInTrend = false; // Whether to exclude periodic maintenance from trend chart
        this.kanbanOverdueOnly = localStorage.getItem('kanban_overdue_only') === 'true';
        this.kanbanTodoCompactCards = localStorage.getItem('kanban_todo_compact_cards') === 'true';
        this.kanbanTodoPriorityFilter = localStorage.getItem('kanban_todo_priority_filter') || 'all';
        this.tipsDisplayMode = localStorage.getItem('tips_display_mode') || 'group';
        this._shiftNotebookImportantOnly = localStorage.getItem('shift_notebook_important_only') === 'true';
        this._shiftNotebookHideChecked = localStorage.getItem('shift_notebook_hide_checked') === 'true';
        this._shiftNotebookCompactRows = localStorage.getItem('shift_notebook_compact_rows') === 'true';
        this._shiftNotebookRowMenuHiddenParts = this.loadShiftNotebookRowMenuHiddenParts();
        // アクティブ装飾モード: 先に選んだ装飾を、次の行でも継続して使う
        this._activeShiftNoteFormats = this.loadShiftNoteFormats();
        this.init();
        this.ensureImageSourceChoiceListener?.();
        this.initGlobalImageZoom(); // Add global zoom listener
    }

    // --- 共通ヘルパー: 型式が「空・無し・なし・無・空欄・-」等を判定 ---
    static isModelBlank(model) {
        const m = (model || '').trim();
        return !m || ['空欄', '無し', '無', 'なし', 'ナシ', '-', '？', '?'].includes(m);
    }

    getLineColors(line) {
        if (String(line) === 'other') return { bg: '#334155', text: '#fff' };
        const palette = [
            { bg: '#64748b', text: '#fff' }, // 0 or unknown (Slate)
            { bg: '#2563eb', text: '#fff' }, // 1 (Blue)
            { bg: '#16a34a', text: '#fff' }, // 2 (Green)
            { bg: '#d97706', text: '#fff' }, // 3 (Amber)
            { bg: '#dc2626', text: '#fff' }, // 4 (Red)
            { bg: '#7c3aed', text: '#fff' }, // 5 (Violet)
            { bg: '#0891b2', text: '#fff' }, // 6 (Cyan)
            { bg: '#db2777', text: '#fff' }, // 7 (Pink)
            { bg: '#4f46e5', text: '#fff' }, // 8 (Indigo)
            { bg: '#059669', text: '#fff' }  // 9 (Emerald)
        ];
        const n = parseInt(line) || 0;
        const index = n % palette.length;
        return palette[index];
    }
    getLineBadge(lineNo) {
        if (!lineNo) return '';
        const colors = this.getLineColors(lineNo);
        const isActive = document.getElementById('hist-filter-line')?.value === String(lineNo);
        return `<span class="line-filter-badge ${isActive ? 'active' : ''}" style="display:inline-flex; align-items:center; justify-content:center; background:${colors.bg}; color:${colors.text}; min-width:32px; padding:2px 8px; border-radius:4px; font-weight:950; font-size:0.75rem; border:1px solid rgba(0,0,0,0.1); box-shadow:0 1px 2px rgba(0,0,0,0.05); margin-right:6px;" title="このラインで抽出" onclick="app.toggleLineFilter?.('${this.escapeJs(lineNo)}', event)">${this.getLineStampLabel(lineNo)}${isActive ? ' <i class="fa-solid fa-filter" style="font-size:0.58rem; margin-left:4px;"></i>' : ''}</span>`;
    }

    getLineLabel(lineNo) {
        if (!lineNo) return '';
        return String(lineNo) === 'other' ? 'その他' : `${lineNo}号ライン`;
    }

    getLineStampLabel(lineNo) {
        if (!lineNo) return '';
        return String(lineNo) === 'other' ? '他' : this.getLineLabel(lineNo);
    }

    generateLineOptionsHTML(selected = '') {
        const options = [1,2,3,4,5,6,7,8,9].map(n => ({ value: String(n), label: `${n}号ライン` }));
        options.push({ value: 'other', label: 'その他' });
        return options.map(opt => `<option value="${opt.value}" ${String(selected) === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('');
    }

    normalizePeriodDateInput(input) {
        const raw = String(input || '').trim();
        if (!raw) return '';
        const normalized = raw
            .replace(/[年月]/g, '/')
            .replace(/日/g, '')
            .replace(/[.]/g, '/')
            .replace(/-/g, '/')
            .replace(/\s+/g, '');
        let year;
        let month;
        let day;
        let match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
        if (match) {
            year = Number(match[1]);
            month = Number(match[2]);
            day = Number(match[3]);
        } else {
            match = normalized.match(/^(\d{1,2})\/(\d{1,2})$/);
            if (!match) return '';
            year = new Date().getFullYear();
            month = Number(match[1]);
            day = Number(match[2]);
        }
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    onPeriodChange(select, callback) {
        const val = select.value;
        if (val === 'CUSTOM') {
            const start = this.normalizePeriodDateInput(prompt('開始日 (YYYY-MM-DD / M/D)', this.customStartDate || new Date().toISOString().split('T')[0]));
            const end = this.normalizePeriodDateInput(prompt('終了日 (YYYY-MM-DD / M/D)', this.customEndDate || new Date().toISOString().split('T')[0]));
            if (start && end) {
                this.customStartDate = start;
                this.customEndDate = end;
                if (callback) callback();
            } else {
                select.value = 'this_month'; // Fallback
                if (callback) callback();
            }
        } else {
            this.rememberCommonTopFilter(select);
            if (callback) callback();
        }
    }

    rememberCommonTopFilter(select) {
        if (!select?.id) return;
        const periodIds = ['hist-filter-period', 'analysis-filter-period', 'worktime-filter-period', 'ranking-filter-period'];
        const lineIds = ['hist-filter-line', 'analysis-filter-line', 'worktime-filter-line', 'ranking-filter-line'];
        if (periodIds.includes(select.id)) localStorage.setItem('common_filter_period', select.value || '');
        if (lineIds.includes(select.id)) localStorage.setItem('common_filter_line', select.value || 'all');
    }

    applyCommonTopFilters(viewName = this.currentView) {
        const periodMap = {
            history: 'hist-filter-period',
            analysis: 'analysis-filter-period',
            worktime: 'worktime-filter-period',
            ranking: 'ranking-filter-period'
        };
        const lineMap = {
            history: 'hist-filter-line',
            analysis: 'analysis-filter-line',
            worktime: 'worktime-filter-line',
            ranking: 'ranking-filter-line'
        };
        const applyValue = (id, value) => {
            const el = document.getElementById(id);
            if (!el || !value) return;
            if (Array.from(el.options || []).some(opt => opt.value === value)) el.value = value;
        };
        applyValue(periodMap[viewName], localStorage.getItem('common_filter_period'));
        applyValue(lineMap[viewName], localStorage.getItem('common_filter_line'));
    }

    onCommonLineFilterChange(select, callback) {
        this.rememberCommonTopFilter(select);
        if (callback) callback();
    }

    getCommonFilterBadgeHtml(viewName = this.currentView) {
        const periodMap = { history: 'hist-filter-period', analysis: 'analysis-filter-period', worktime: 'worktime-filter-period', ranking: 'ranking-filter-period' };
        const lineMap = { history: 'hist-filter-line', analysis: 'analysis-filter-line', worktime: 'worktime-filter-line', ranking: 'ranking-filter-line' };
        const periodEl = document.getElementById(periodMap[viewName]);
        const lineEl = document.getElementById(lineMap[viewName]);
        const period = periodEl?.selectedOptions?.[0]?.textContent || '';
        const line = lineEl?.value && lineEl.value !== 'all' ? this.getLineLabel(lineEl.value) : '全ライン';
        if (!period && line === '全ライン') return '';
        return `<span class="common-filter-badge"><i class="fa-solid fa-filter"></i>${this.escapeHtml(period || '期間指定なし')} / ${this.escapeHtml(line)}</span>`;
    }

    renderCommonFilterBadgeSlot(viewName = this.currentView) {
        const id = `${viewName}-common-filter-badge`;
        const slot = document.getElementById(id);
        if (slot) slot.innerHTML = this.getCommonFilterBadgeHtml(viewName);
    }

    generatePeriodOptionsHTML(current) {
        const periods = [
            { id: 'today', label: '今日' },
            { id: 'yesterday', label: '昨日' },
            { id: 'yesterday_today', label: '昨日と今日' },
            { id: 'this_month', label: '今月分' },
            { id: 'last_month', label: '先月分' },
            { id: 'last_this_month', label: '先月と今月' },
            { id: 'this_year', label: '今期 (4月〜)' },
            { id: 'last_year', label: '前期' },
            { id: 'all', label: '全期間' },
            { id: 'CUSTOM', label: '期間指定...' }
        ];
        return periods.map(p => `<option value="${p.id}" ${p.id === current ? 'selected' : ''}>${p.label}</option>`).join('');
    }

    getPeriodLabel(pId) {
        const labels = { today: '今日', yesterday: '昨日', yesterday_today: '昨日・今日', this_month: '今月', last_month: '先月', last_this_month: '先月と今月', this_year: '今期', last_year: '前期', all: '全期間', CUSTOM: 'カスタム指定' };
        return labels[pId] || pId;
    }

    filterHistoryByPeriod(history, period) {
        const todayVal = new Date();
        const formatDate = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const todayStr = formatDate(todayVal);
        const yestVal = new Date(); yestVal.setDate(yestVal.getDate() - 1);
        const yestStr = formatDate(yestVal);

        const curMonthStr = todayStr.substring(0, 7);
        const lastMonthVal = new Date(todayVal.getFullYear(), todayVal.getMonth() - 1, 1);
        const lastMonthStr = formatDate(lastMonthVal).substring(0, 7);

        // Fiscal Year (Starts April)
        const curFY = todayVal.getMonth() < 3 ? todayVal.getFullYear() - 1 : todayVal.getFullYear();
        const startOfCurFY = `${curFY}-04-01`;
        const startOfLastFY = `${curFY - 1}-04-01`;
        const endOfLastFY = `${curFY}-03-31`;

        if (period === 'today') return history.filter(h => h.date === todayStr);
        if (period === 'yesterday') return history.filter(h => h.date === yestStr);
        if (period === 'yesterday_today') return history.filter(h => h.date === todayStr || h.date === yestStr);
        if (period === 'this_month') return history.filter(h => h.date && h.date.startsWith(curMonthStr));
        if (period === 'last_month') return history.filter(h => h.date && h.date.startsWith(lastMonthStr));
        if (period === 'last_this_month') return history.filter(h => h.date && (h.date.startsWith(curMonthStr) || h.date.startsWith(lastMonthStr)));
        if (period === 'this_year') return history.filter(h => h.date && h.date >= startOfCurFY);
        if (period === 'last_year') return history.filter(h => h.date && h.date >= startOfLastFY && h.date <= endOfLastFY);
        if (period === 'CUSTOM') {
            const s = this.customStartDate;
            const e = this.customEndDate;
            if (s && e) return history.filter(h => h.date && h.date >= s && h.date <= e);
        }
        return history;
    }

    init() {
        this.setupNavigation();
        this.setupCalendarControls();
        this.updateDepartmentUI(); // Initialize department label
        this.renderView('calendar');
        
        // Initial setup for other components
        this.setupSideEffects();
        this.updateDataLists(); 
        this.updateHistoryPeriodOptions();
        this.initTrendChartConfig();
        this.restoreSidebarState();
        this.restoreStatsState();
        this.setupShiftNoteFormatMenuClose();
        this.setupDelegatedActions?.();
        this.setupSaveStatusIndicator();
        this.updateTodoRequestCountBadge();
        this.cleanupExpiredShiftNotebookPhotos?.();
    }

    setupSaveStatusIndicator() {
        this.updateSaveStatus('saved');
        window.addEventListener('maintenance-save-status', (event) => {
            this.updateSaveStatus(event.detail?.status || 'saved');
        });
        document.addEventListener('input', (event) => {
            if (event.target?.closest?.('#modal-content')) this.updateSaveStatus('dirty');
        }, true);
        document.addEventListener('change', (event) => {
            if (event.target?.closest?.('#modal-content')) this.updateSaveStatus('dirty');
        }, true);
    }

    updateSaveStatus(status = 'saved') {
        const elements = document.querySelectorAll('.app-save-status');
        if (!elements.length) return;
        const states = {
            dirty: { icon: 'fa-circle-exclamation', text: '未保存' },
            saving: { icon: 'fa-spinner fa-spin', text: '保存中' },
            saved: { icon: 'fa-circle-check', text: '保存済み' },
            error: { icon: 'fa-triangle-exclamation', text: '保存失敗' }
        };
        const state = states[status] || states.saved;
        const title = status === 'saved'
            ? `保存済み ${new Date().toLocaleTimeString()}`
            : (status === 'error' ? '保存に失敗しました' : state.text);
        elements.forEach(el => {
            el.className = `app-save-status ${status}${el.classList.contains('modal-save-status') ? ' modal-save-status' : ''}`;
            el.innerHTML = `<i class="fa-solid ${state.icon}"></i><span>${state.text}</span>`;
            el.title = title;
        });
    }

    setupShiftNoteFormatMenuClose() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.shift-format-menu')) return;
            this.closeShiftNoteFormatMenus({ commit: false });
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('.shift-responder-menu') || e.target.closest('.shift-row-responder')) return;
            document.querySelectorAll('.shift-responder-menu.open').forEach(el => el.classList.remove('open'));
        });
        document.addEventListener('click', (e) => {
            if (e.target.closest('#shift-row-menu-settings-panel') || e.target.closest('#shift-row-menu-toggle-btn')) return;
            this.closeShiftNotebookRowMenuSettings();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeShiftNoteFormatMenus({ commit: false });
                document.querySelectorAll('.shift-responder-menu.open').forEach(el => el.classList.remove('open'));
                this.closeShiftNotebookRowMenuSettings();
            }
        });
    }

    restoreStatsState() {
        const isCollapsed = localStorage.getItem('sidebar_stats_collapsed') === 'true';
        if (isCollapsed) {
            const container = document.getElementById('sidebar-stats-container');
            const chevron = document.getElementById('sidebar-stats-chevron');
            if (container) container.classList.add('collapsed');
            if (chevron) chevron.style.transform = 'rotate(-90deg)';
        }
    }

    restoreSidebarState() {
        const isCollapsed = localStorage.getItem('sidebar_bottom_collapsed') === 'true';
        if (isCollapsed) {
            const container = document.getElementById('sidebar-bottom-container');
            const chevron = document.getElementById('sidebar-bottom-chevron');
            if (container) container.classList.add('collapsed');
            if (chevron) chevron.style.transform = 'rotate(-90deg)';
        }
    }

    // --- Navigation ---
    setupNavigation() {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewName = e.currentTarget.dataset.view;
                if (!viewName) return;
                this.resetSearchAndFilters();
                this.switchView(viewName);
            });
        });

        const homeBtn = document.getElementById('sidebar-home');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                this.resetSearchAndFilters();
                this.switchView('calendar');
            });
        }

        const searchIn = document.getElementById('global-search');
        if (searchIn) {
            searchIn.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                if (this.currentView === 'calendar' && query) {
                    this.switchView('history'); // Jump from calendar to history
                }
                
                if (this.currentView === 'history') {
                    this.renderHistory(query);
                } else if (this.currentView === 'machines') {
                    this.renderMachines(query);
                } else if (this.currentView === 'analysis') {
                    this.renderAnalysis(query);
                } else if (this.currentView === 'workers') {
                    this.skillSearchQuery = query;
                    this.renderWorkers();
                } else if (this.currentView === 'worktime') {
                    this.renderWorkTime(query);
                } else if (this.currentView === 'guides') {
                    this.renderGuides();
                } else if (this.currentView === 'tips') {
                    this.renderTips();
                }
            });
        }

        const searchClear = document.getElementById('search-clear');
        if (searchClear) {
            searchClear.addEventListener('click', () => {
                if (searchIn) {
                    searchIn.value = '';
                    if (this.currentView === 'history') {
                        this.renderHistory('');
                    } else if (this.currentView === 'machines') {
                        this.renderMachines('');
                    } else if (this.currentView === 'analysis') {
                        this.renderAnalysis('');
                    } else if (this.currentView === 'workers') {
                        this.skillSearchQuery = '';
                        this.renderWorkers();
                    } else if (this.currentView === 'worktime') {
                        this.renderWorkTime('');
                    } else if (this.currentView === 'guides') {
                        this.renderGuides();
                    } else if (this.currentView === 'tips') {
                        this.renderTips();
                    }
                }
            });
        }

        const notebookSearch = document.getElementById('notebook-search');
        const notebookSearchBtn = document.getElementById('notebook-search-btn');
        if (notebookSearch) {
            notebookSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.openShiftNotebookSearchResults(notebookSearch.value, document.getElementById('notebook-search-period')?.value || 'all');
            });
        }
        if (notebookSearchBtn) {
            notebookSearchBtn.addEventListener('click', () => {
                this.openShiftNotebookSearchResults(notebookSearch ? notebookSearch.value : '', document.getElementById('notebook-search-period')?.value || 'all');
            });
        }

        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                document.getElementById('sidebar').classList.toggle('collapsed');
            });
        }

        const hMachineFilter = document.getElementById('hist-filter-machine');
        if (hMachineFilter) hMachineFilter.onchange = () => this.renderHistory();

        const hLineFilter = document.getElementById('hist-filter-line');
        if (hLineFilter) hLineFilter.onchange = () => this.onCommonLineFilterChange(hLineFilter, () => this.renderHistory());

        const hTypeFilter = document.getElementById('hist-filter-type');
        if (hTypeFilter) hTypeFilter.onchange = () => this.renderHistory();

        const hPeriodFilter = document.getElementById('hist-filter-period');
        if (hPeriodFilter) hPeriodFilter.onchange = () => this.onPeriodChange(hPeriodFilter, () => this.renderHistory());

        const aPeriodFilter = document.getElementById('analysis-filter-period');
        if (aPeriodFilter) aPeriodFilter.onchange = () => this.onPeriodChange(aPeriodFilter, () => this.renderAnalysis());

        const dPeriodFilter = document.getElementById('dashboard-filter-period');
        if (dPeriodFilter) dPeriodFilter.onchange = () => this.onPeriodChange(dPeriodFilter, () => this.renderDashboard());

        const rPeriodFilter = document.getElementById('ranking-filter-period');
        if (rPeriodFilter) rPeriodFilter.onchange = () => this.onPeriodChange(rPeriodFilter, () => this.renderRanking());

        const skillSearch = document.getElementById('skill-search');
        if (skillSearch) {
            skillSearch.addEventListener('input', (e) => {
                this.skillSearchQuery = e.target.value.trim().toLowerCase();
                this.renderWorkers();
            });
        }

        const wtPeriodFilter = document.getElementById('worktime-filter-period');
        if (wtPeriodFilter) wtPeriodFilter.onchange = () => this.onPeriodChange(wtPeriodFilter, () => {
            this.saveWorkTimePeriodSelection?.();
            this.renderWorkTime();
        });

        const addMachineBtn = document.getElementById('btn-add-machine');
        if (addMachineBtn) {
            addMachineBtn.addEventListener('click', () => this.openMachineModal());
        }

        const switchDeptBtn = document.getElementById('btn-switch-dept');
        if (switchDeptBtn) {
            switchDeptBtn.addEventListener('click', () => this.openDepartmentModal());
        }
    }

    initTrendChartConfig() {
        const savedHeight = localStorage.getItem('worktimeTrendHeight') || 250;
        this.updateTrendChartHeight(savedHeight, false);
    }

    updateTrendChartHeight(h, save = true) {
        const container = document.getElementById('trend-chart-container');
        const slider = document.getElementById('trend-chart-height-range');
        const label = document.getElementById('trend-chart-height-label');
        if (container) {
            container.style.height = h + 'px';
        }
        const card = document.getElementById('worktime-trend-card');
        if (card) {
            card.style.minHeight = (parseInt(h) + 100) + 'px';
            card.style.height = (parseInt(h) + 100) + 'px';
        }
        if (slider) slider.value = h;
        if (label) label.textContent = h + 'px';
        if (save) localStorage.setItem('worktimeTrendHeight', h);
        
        if (this._trendChart) {
            this._trendChart.resize();
        }
    }

    switchView(viewName, options = {}) {
        if (!viewName) return;
        if (this.currentView === viewName && !options.force) return;
        this.updateSidebarCurrentShiftLink?.();
        
        // Update Nav UI
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        // Update View Display
        document.querySelectorAll('.view').forEach(v => {
            v.classList.toggle('active', v.id === `view-${viewName}`);
        });

        // Update Header Title
        const titles = {
            'calendar': 'カレンダー',
            'todos': 'ToDoリスト',
            'machines': 'メンテ・周期設定',
            'history': 'メンテナンス履歴',
            'fiveS': '5S管理',
            'analysis': '部品管理',
            'worktime': '作業時間集計',
            'dashboard': 'ダッシュボード',
            'ranking': '不具合頻度ランキング',
            'workers': 'スキルマップ',
            'outlookAssist': 'outlook入力補助',
            'guides': '手順書',
            'tips': 'TIPS',
            'photos': 'メディア管理'
        };
        const titleEl = document.getElementById('view-title');
        if (titleEl) {
            if (viewName === 'calendar') {
                titleEl.innerHTML = '<img class="calendar-title-logo" src="assets/calendar-title.png?v=20260823" alt="カレンダー">';
            } else if (viewName === 'todos') {
                titleEl.innerHTML = '<img class="todo-list-title-logo" src="assets/todo-list-title.png?v=20260823" alt="ToDoリスト">';
            } else if (viewName === 'machines') {
                titleEl.innerHTML = '<img class="maintenance-cycle-title-logo" src="assets/maintenance-cycle-title.png?v=20260823" alt="メンテ・周期設定">';
            } else if (viewName === 'history') {
                titleEl.innerHTML = '<img class="maintenance-history-title-logo" src="assets/maintenance-history-title.png?v=20260823" alt="メンテナンス履歴">';
            } else if (viewName === 'fiveS') {
                titleEl.innerHTML = '<img class="five-s-title-logo" src="assets/five-s-title.png?v=20260823-2" alt="5S管理">';
            } else if (viewName === 'guides') {
                titleEl.innerHTML = '<img class="guides-header-title-logo" src="assets/guides-header-title.png?v=20260823-2" alt="手順書">';
            } else if (viewName === 'tips') {
                titleEl.innerHTML = '<img class="tips-header-title-logo" src="assets/tips-header-title.png?v=20260823" alt="TIPS">';
            } else if (viewName === 'photos') {
                titleEl.innerHTML = '<img class="media-header-title-logo" src="assets/media-header-title.png?v=20260823" alt="メディア管理">';
            } else if (viewName === 'analysis') {
                titleEl.innerHTML = '<img class="parts-header-title-logo" src="assets/parts-header-title.png?v=20260823" alt="部品管理">';
            } else if (viewName === 'dashboard') {
                titleEl.innerHTML = '<img class="dashboard-header-title-logo" src="assets/dashboard-title.png?v=20260823-2" alt="ダッシュボード">';
            } else if (viewName === 'worktime') {
                titleEl.innerHTML = '<img class="worktime-header-title-logo" src="assets/worktime-header-title.png?v=20260823" alt="作業時間集計">';
            } else if (viewName === 'ranking') {
                titleEl.innerHTML = '<img class="ranking-header-title-logo" src="assets/ranking-header-title.png?v=20260823-2" alt="不具合頻度ランキング">';
            } else if (viewName === 'workers') {
                titleEl.innerHTML = '<img class="skill-map-header-title-logo" src="assets/skill-map-header-title.png?v=20260824" alt="スキルマップ">';
            } else if (viewName === 'outlookAssist') {
                titleEl.innerHTML = '<img class="outlook-assist-title-logo" src="assets/outlook-assist-title.png?v=20260823" alt="Outlook入力補助">';
            } else {
                titleEl.textContent = titles[viewName] || 'メンテナンス';
            }
        }
        const topHeader = document.querySelector('.top-header');
        if (topHeader) topHeader.dataset.viewBg = viewName;

        // Reset skill filters when switching views to ensure fresh state
        this.skillModelFilter = null;
        this.skillSearchQuery = "";
        this.guideTagFilter = null;
        
        this.updateViewGuideSlot(viewName);

        if (viewName === 'dashboard') {
            this.dashboardPeriod = 'yesterday_today';
        }

        if (viewName === 'tips') {
            this.clearTipsForm?.();
        }

        this.currentView = viewName;
        this.renderView(viewName);
        this.updateContextualHelp(viewName);
    }

    updateViewGuideSlot(viewName = this.currentView) {
        const slot = document.getElementById('view-guide-slot');
        if (!slot) return;
        const guides = this.getViewGuideImages(viewName);
        slot.innerHTML = guides.length ? guides.map((guide, index) => `
            <button type="button" class="view-guide-thumb" title="${this.escapeHtml(guide.title)}" data-action="open-view-guide" data-view-name="${this.escapeHtml(viewName)}" data-guide-index="${index}">
                <img src="${this.escapeHtml(guide.src)}" alt="${this.escapeHtml(guide.title)}">
            </button>
        `).join('') : '';
    }

    getViewGuideImages(viewName = this.currentView) {
        const map = {
            calendar: [{ src: 'assets/view-guide-calendar.svg', title: 'カレンダーの使い方' }],
            todos: [{ src: 'assets/view-guide-todos.svg', title: 'ToDoリストの使い方' }],
            dashboard: [{ src: 'assets/view-guide-dashboard.svg', title: 'ダッシュボードの見方' }],
            history: [{ src: 'assets/view-guide-history.svg', title: '履歴・検索の使い方' }],
            guides: [{ src: 'assets/view-guide-history.svg', title: '手順書検索の使い方' }],
            machines: [{ src: 'assets/view-guide-calendar.svg', title: 'メンテ管理の見方' }]
        };
        Object.assign(map, {
            machines: [{ src: 'assets/view-guide-machines.svg', title: 'メンテ・周期設定の使い方' }],
            guides: [{ src: 'assets/view-guide-guides.svg', title: '手順書の使い方' }],
            analysis: [{ src: 'assets/view-guide-analysis.svg', title: '部品管理の見方' }],
            worktime: [{ src: 'assets/view-guide-worktime.svg', title: '作業時間集計の見方' }],
            ranking: [{ src: 'assets/view-guide-ranking.svg', title: '異常頻度ランクの見方' }],
            workers: [{ src: 'assets/view-guide-workers.svg', title: 'スキルマップの見方' }]
        });
        return map[viewName] || [];
    }

    openViewGuideViewer(viewName = this.currentView, index = 0) {
        const images = this.getViewGuideImages(viewName);
        if (!images.length) return;
        const safeIndex = Math.max(0, Math.min(images.length - 1, Number(index) || 0));
        document.getElementById('view-guide-viewer')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="view-guide-viewer" class="shift-guide-viewer" data-action="close-view-guide-if-backdrop">
                <div class="shift-guide-viewer-card">
                    <div class="shift-guide-viewer-header">
                        <div>
                            <span>使い方ガイド</span>
                            <p>${this.escapeHtml(images[safeIndex].title)}</p>
                        </div>
                        <button type="button" data-action="close-view-guide" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="shift-guide-viewer-stage">
                        <img src="${this.escapeHtml(images[safeIndex].src)}" alt="${this.escapeHtml(images[safeIndex].title)}">
                    </div>
                </div>
            </div>
        `);
    }

    closeViewGuideViewer() {
        document.getElementById('view-guide-viewer')?.remove();
    }

    updateContextualHelp(viewName = this.currentView) {
        const slot = document.getElementById('contextual-help-slot');
        if (!slot) return;
        const items = this.getContextualHelpItems(viewName);
        const tickerText = items.map(item => item.text).filter(Boolean).join('   /   ');
        const first = items[0] || {};
        slot.innerHTML = tickerText ? `
            <div class="contextual-help-card">
                <span class="contextual-help-label"><i class="fa-solid fa-lightbulb"></i> ヒント</span>
                <div class="contextual-help-ticker ${this.escapeHtml(first.tone || '')}" title="${this.escapeHtml(tickerText)}">
                    ${first.icon ? `<i class="fa-solid ${this.escapeHtml(first.icon)}"></i>` : ''}
                    <span>${this.escapeHtml(tickerText)}</span>
                </div>
            </div>
        ` : '';
    }

    getContextualHelpItems(viewName = this.currentView) {
        const items = [];
        const safeCount = (fn, fallback = 0) => {
            try {
                const value = fn?.();
                return Array.isArray(value) ? value.length : (Number(value) || fallback);
            } catch (_) {
                return fallback;
            }
        };

        if (viewName === 'photos') {
            const visible = this._photoManagerVisibleIds?.length || 0;
            const selected = safeCount(() => this.getSelectedPhotoManagerIds?.());
            const duplicate = safeCount(() => this.getPhotoManagerDuplicateGroups?.());
            const pageOnly = safeCount(() => this.getPhotoManagerPageOnlyItems?.());
            if (selected) items.push({ icon: 'fa-check-double', text: `${selected}件選択中。一括タイトル変更・透過作成・削除が使えます。`, tone: 'active' });
            if (duplicate) items.push({ icon: 'fa-clone', text: `重複画像が${duplicate}組あります。重複整理で容量を軽くできます。`, tone: 'warn' });
            if (pageOnly) items.push({ icon: 'fa-folder-minus', text: `写真管理にない個別ページ写真が${pageOnly}件あります。ページ残り整理で確認できます。`, tone: 'warn' });
            if (!items.length) items.push({ icon: 'fa-file-import', text: visible ? '画像カードをクリックすると編集、チェックを付けると一括操作できます。' : '画像取込やクリップボード登録で写真管理に追加できます。' });
            return items;
        }

        if (viewName === 'guides') {
            const guides = (store.activeData.history || []).filter(h => h.guide && !store.isGuideArchived?.(h.id));
            const untitled = guides.filter(h => !String(h.guide?.title || '').trim()).length;
            const query = (document.getElementById('global-search')?.value || '').trim();
            if (query) items.push({ icon: 'fa-magnifying-glass', text: '検索中です。タグ・本文・原因・処置・タイトルから絞り込めます。', tone: 'active' });
            if (untitled) items.push({ icon: 'fa-pen', text: `タイトル未上書きの手順書が${untitled}件あります。カードのペンで整えられます。`, tone: 'warn' });
            items.push({ icon: 'fa-wand-magic-sparkles', text: 'キラキラボタンで、原因・処置からタイトル候補を自動作成できます。' });
            return items;
        }

        if (viewName === 'history') {
            const guideCount = (store.activeData.history || []).filter(h => h.guide && !store.isGuideArchived?.(h.id)).length;
            items.push({ icon: 'fa-book-open', text: `手順書ありの履歴は${guideCount}件。手順アイコンから作成・編集できます。` });
            items.push({ icon: 'fa-filter', text: '上部の期間・ライン・手順有フィルタで必要な履歴だけに絞れます。' });
            return items;
        }

        if (viewName === 'machines') {
            items.push({ icon: 'fa-image', text: '無画像アイコンから写真管理・ファイル読込を選んで画像を設定できます。' });
            items.push({ icon: 'fa-clock-rotate-left', text: '周期や再発回数の表示から、次に見るべき設備を探せます。' });
            return items;
        }

        if (viewName === 'calendar') {
            items.push({ icon: 'fa-magnifying-glass', text: '上の検索欄に入力すると履歴検索へ切り替わります。' });
            items.push({ icon: 'fa-table-cells-large', text: '表示が詰まる時はコンパクト表示を切り替えられます。' });
            return items;
        }

        if (viewName === 'todos') {
            items.push({ icon: 'fa-user-check', text: '自分の依頼だけ表示したい時は担当・依頼者フィルタを使えます。' });
            items.push({ icon: 'fa-tags', text: 'タグや状態で絞ると、未処理の作業が見つけやすくなります。' });
            return items;
        }

        if (viewName === 'analysis') {
            items.push({ icon: 'fa-filter', text: '期間とラインを絞ると、部品消費の傾向が読みやすくなります。' });
            items.push({ icon: 'fa-yen-sign', text: '価格未設定の部品はコスト予測に反映されないので、部品カードから設定できます。' });
            return items;
        }

        if (viewName === 'worktime') {
            items.push({ icon: 'fa-clock', text: '期間・ライン・作業者で絞ると、負荷の偏りを確認できます。' });
            items.push({ icon: 'fa-chart-line', text: '空表示の時は、上部の条件バーで抽出条件を確認できます。' });
            return items;
        }

        return items;
    }

    toggleSkillStats(force = null) {
        this.showSkillStats = (force === null) ? !this.showSkillStats : force;
        
        const overlay = document.getElementById('skill-drawer-overlay');
        const panel = document.getElementById('skill-drawer-panel');
        if (overlay && panel) {
            if (this.showSkillStats) {
                overlay.classList.add('active');
                panel.classList.add('active');
                this.renderSkillStats();
            } else {
                overlay.classList.remove('active');
                panel.classList.remove('active');
            }
        }
    }

    filterMachineStats(val) {
        this.machineStatsFilter = val;
        // Only re-render the stats report, not the entire worker table
        this.renderSkillStats(); 
    }

    toggleSkillRiskFilter() {
        this.skillRiskFilter = !this.skillRiskFilter;
        if (this.skillRiskFilter) this.skillSoloFilter = false; // Mutual exclusive for clarity
        this.updateSkillFilterButtons();
        this.renderWorkers();
    }

    toggleSkillSoloFilter() {
        this.skillSoloFilter = !this.skillSoloFilter;
        if (this.skillSoloFilter) this.skillRiskFilter = false;
        this.updateSkillFilterButtons();
        this.renderWorkers();
    }

    onSkillSearch(val) {
        this.skillSearchQuery = (val || '').trim().toLowerCase();
        this.renderWorkers();
    }

    onWorkTimeSearch(val) {
        this.renderWorkTime(val);
    }

    updateSkillFilterButtons() {
        const riskBtn = document.getElementById('btn-risk-filter');
        const soloBtn = document.getElementById('btn-solo-filter');
        if (riskBtn) {
            riskBtn.style.background = this.skillRiskFilter ? 'var(--danger)' : 'var(--secondary)';
            riskBtn.style.color = this.skillRiskFilter ? '#fff' : 'var(--text-light)';
            riskBtn.style.borderColor = this.skillRiskFilter ? 'var(--danger)' : 'var(--border)';
        }
        if (soloBtn) {
            soloBtn.style.background = this.skillSoloFilter ? '#ea580c' : 'var(--secondary)';
            soloBtn.style.color = this.skillSoloFilter ? '#fff' : 'var(--text-light)';
            soloBtn.style.borderColor = this.skillSoloFilter ? '#ea580c' : 'var(--border)';
        }
    }
    
    resetSearchAndFilters() {
        const searchIn = document.getElementById('global-search');
        if (searchIn) searchIn.value = '';
        const skillIn = document.getElementById('skill-search');
        if (skillIn) skillIn.value = '';
        
        // Reset History View Filters
        const hPeriod = document.getElementById('hist-filter-period');
        if (hPeriod) hPeriod.value = 'last_this_month';
        const hMachine = document.getElementById('hist-filter-machine');
        if (hMachine) hMachine.value = '';
        const hLine = document.getElementById('hist-filter-line');
        if (hLine) hLine.value = 'all';
        const hType = document.getElementById('hist-filter-type');
        if (hType) hType.value = '';
        const fiveSPeriod = document.getElementById('fiveS-filter-period');
        if (fiveSPeriod) fiveSPeriod.value = 'all';
        const fiveSPhotos = document.getElementById('fiveS-filter-photos');
        if (fiveSPhotos) fiveSPhotos.checked = false;
        const fiveSPending = document.getElementById('fiveS-filter-pending');
        if (fiveSPending) fiveSPending.checked = false;
        const fiveSShift = document.getElementById('fiveS-filter-shift');
        if (fiveSShift) fiveSShift.value = 'all';
        const fiveSGroup = document.getElementById('fiveS-filter-group');
        if (fiveSGroup) fiveSGroup.value = '';
        const fiveSQuery = document.getElementById('fiveS-filter-query');
        if (fiveSQuery) fiveSQuery.value = '';

        // Reset Ranking View Filter
        const rPeriod = document.getElementById('ranking-filter-period');
        if (rPeriod) rPeriod.value = 'last_this_month';

        // Reset Analysis/Dashboard View Filters
        const aPeriod = document.getElementById('analysis-filter-period');
        if (aPeriod) aPeriod.value = 'last_this_month';
        const dPeriod = document.getElementById('dashboard-filter-period');
        if (dPeriod) dPeriod.value = 'this_month';
        const wtPeriod = document.getElementById('worktime-filter-period');
        if (wtPeriod) {
            const savedWorkTimePeriod = localStorage.getItem(this.getWorkTimePeriodStorageKey?.() || 'worktime_filter_period');
            const validWorkTimePeriods = Array.from(wtPeriod.options).map(opt => opt.value);
            wtPeriod.value = validWorkTimePeriods.includes(savedWorkTimePeriod) ? savedWorkTimePeriod : 'last_this_month';
            if (!savedWorkTimePeriod) this.saveWorkTimePeriodSelection?.();
        }

        // Reset Guides View Filters
        const gLine = document.getElementById('guides-filter-line');
        if (gLine) gLine.value = 'all';

        this.modelFilter = null;
        this.workerFilter = null;
        this.machineCategoryFilter = null;
        this.historyReturnContext = null;
        this.skillModelFilter = null;
        this.skillSearchQuery = '';
        this.guideTagFilter = null;
        this.guideLineFilter = 'all';
        this.costDrillDownCategory = null;
        this.workTimeDrillDownCategory = null;
    }

    filterByModel(model) {
        this.modelFilter = model;
        this.switchView('history');
    }

    clearModelFilter() {
        this.modelFilter = null;
        this.renderHistory();
    }

    jumpToHistory(machineId, keyword = '', date = '') {
        const mFilter = document.getElementById('hist-filter-machine');
        if (mFilter) mFilter.value = machineId;
        
        const tFilter = document.getElementById('hist-filter-type');
        if (tFilter) tFilter.value = ''; // all types
        
        const pFilter = document.getElementById('hist-filter-period');
        if (pFilter) pFilter.value = 'all';

        const searchIn = document.getElementById('global-search');
        const queryText = date ? `${date} ${keyword}` : keyword;
        if (searchIn) searchIn.value = queryText;
        
        this.switchView('history');
        this.renderHistory(queryText);
    }

    // --- Rendering ---
    renderView(viewName) {
        this.updateTodoRequestCountBadge();
        this.updateViewGuideSlot(viewName);
        this.applyCommonTopFilters(viewName);
        switch (viewName) {
            case 'calendar': this.renderCalendar(); break;
            case 'todos': this.renderKanbanLocalTodos(); break;
            case 'machines': this.renderMachines(); break;
            case 'history': this.renderHistory(); break;
            case 'fiveS': this.renderFiveSManagement(); break;
            case 'analysis': this.renderAnalysis(); break;
            case 'dashboard': this.renderDashboard(); break;
            case 'worktime': this.renderWorkTime(); break;
            case 'ranking': this.renderRanking(); break;
            case 'workers': this.renderWorkers(); break;
            case 'outlookAssist': this.renderOutlookAssist(); break;
            case 'guides': this.renderGuides(); break;
            case 'tips': this.renderTips(); break;
            case 'photos': this.renderPhotoManager(); break;
        }
        this.updateContextualHelp(viewName);
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container || !message) return;
        const normalizedType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
        const iconMap = {
            success: 'fa-circle-check',
            error: 'fa-circle-exclamation',
            warning: 'fa-triangle-exclamation',
            info: 'fa-circle-info'
        };
        const toast = document.createElement('div');
        toast.className = `app-toast app-toast-${normalizedType}`;
        toast.setAttribute('role', normalizedType === 'error' ? 'alert' : 'status');
        toast.innerHTML = `<i class="fa-solid ${iconMap[normalizedType]}"></i><span>${this.escapeHtml(message)}</span>`;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
        window.setTimeout(() => {
            toast.classList.remove('visible');
            window.setTimeout(() => toast.remove(), 220);
        }, 4200);
    }

    escapeJs(value) {
        return String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n');
    }

    static toFullWidthUpper(str) {
        if (!str) return '';
        return str.replace(/[A-Za-z0-9]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0)).toUpperCase();
    }

    static toFullWidth(str) {
        if (!str) return '';
        return str.replace(/[A-Za-z0-9]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
    }

    static toHalfWidthLower(str) {
        if (!str) return '';
        return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).toLowerCase();
    }

}







