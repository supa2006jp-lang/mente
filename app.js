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
        this.machineSort = 'rank'; // 'rank' or 'name' or 'newest'
        this.analysisMode = 'parts'; // 'parts' or 'machines'
        this.laborRate = 3500; // Hourly rate for labor cost calculation
        this.costFilter = 'all'; // 'all', 'periodic', 'sudden'
        this.workTimeDrillDownCategory = null; // Filter worktime by category (Drill-down)
        this.dashboardPeriod = 'yesterday_today'; // Default dashboard view range
        this.excludePeriodicInTrend = false; // Whether to exclude periodic maintenance from trend chart
        this.kanbanOverdueOnly = localStorage.getItem('kanban_overdue_only') === 'true';
        this.kanbanTodoCompactCards = localStorage.getItem('kanban_todo_compact_cards') === 'true';
        this.kanbanTodoPriorityFilter = localStorage.getItem('kanban_todo_priority_filter') || 'all';
        this._shiftNotebookImportantOnly = localStorage.getItem('shift_notebook_important_only') === 'true';
        this._shiftNotebookHideChecked = localStorage.getItem('shift_notebook_hide_checked') === 'true';
        this._shiftNotebookCompactRows = localStorage.getItem('shift_notebook_compact_rows') === 'true';
        this._shiftNotebookRowMenuHiddenParts = this.loadShiftNotebookRowMenuHiddenParts();
        // アクティブ装飾モード: 先に選んだ装飾を、次の行でも継続して使う
        this._activeShiftNoteFormats = this.loadShiftNoteFormats();
        this.init();
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
        return `<span style="display:inline-flex; align-items:center; justify-content:center; background:${colors.bg}; color:${colors.text}; min-width:32px; padding:2px 8px; border-radius:4px; font-weight:950; font-size:0.75rem; border:1px solid rgba(0,0,0,0.1); box-shadow:0 1px 2px rgba(0,0,0,0.05); margin-right:6px;">${this.getLineStampLabel(lineNo)}</span>`;
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

    onPeriodChange(select, callback) {
        const val = select.value;
        if (val === 'CUSTOM') {
            const start = prompt('開始日 (YYYY-MM-DD)', this.customStartDate || new Date().toISOString().split('T')[0]);
            const end = prompt('終了日 (YYYY-MM-DD)', this.customEndDate || new Date().toISOString().split('T')[0]);
            if (start && end) {
                this.customStartDate = start;
                this.customEndDate = end;
                if (callback) callback();
            } else {
                select.value = 'this_month'; // Fallback
                if (callback) callback();
            }
        } else {
            if (callback) callback();
        }
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
        if (hLineFilter) hLineFilter.onchange = () => this.renderHistory();

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
        if (wtPeriodFilter) wtPeriodFilter.onchange = () => this.onPeriodChange(wtPeriodFilter, () => this.renderWorkTime());

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
            'analysis': '部品消費・コスト',
            'worktime': '作業時間集計',
            'dashboard': 'ダッシュボード',
            'ranking': '不具合頻度ランキング',
            'workers': 'スキルマップ',
            'guides': '手順書・ナレッジDB',
            'photos': '写真管理'
        };
        const titleEl = document.getElementById('view-title');
        if (titleEl) titleEl.textContent = titles[viewName] || 'メンテナンス';

        // Reset skill filters when switching views to ensure fresh state
        this.skillModelFilter = null;
        this.skillSearchQuery = "";
        this.guideTagFilter = null;
        
        this.updateViewGuideSlot(viewName);

        if (viewName === 'dashboard') {
            this.dashboardPeriod = 'yesterday_today';
        }

        this.currentView = viewName;
        this.renderView(viewName);
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
            guides: [{ src: 'assets/view-guide-guides.svg', title: '手順書・ナレッジDBの使い方' }],
            analysis: [{ src: 'assets/view-guide-analysis.svg', title: '部品消費・コストの見方' }],
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
        if (wtPeriod) wtPeriod.value = 'last_this_month';

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
            case 'guides': this.renderGuides(); break;
            case 'photos': this.renderPhotoManager(); break;
        }
    }

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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







