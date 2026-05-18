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
            { id: 'this_year', label: '今期 (4月〜)' },
            { id: 'last_year', label: '前期' },
            { id: 'all', label: '全期間' },
            { id: 'CUSTOM', label: '期間指定...' }
        ];
        return periods.map(p => `<option value="${p.id}" ${p.id === current ? 'selected' : ''}>${p.label}</option>`).join('');
    }

    getPeriodLabel(pId) {
        const labels = { today: '今日', yesterday: '昨日', yesterday_today: '昨日・今日', this_month: '今月', last_month: '先月', this_year: '今期', last_year: '前期', all: '全期間', CUSTOM: 'カスタム指定' };
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
        this.updateTodoRequestCountBadge();
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

    switchView(viewName) {
        if (this.currentView === viewName) return;
        
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
            'analysis': '部品消費・コスト',
            'worktime': '作業時間集計',
            'dashboard': 'ダッシュボード',
            'ranking': '不具合頻度ランキング',
            'workers': 'スキルマップ',
            'guides': '手順書・ナレッジDB'
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
            <button type="button" class="view-guide-thumb" title="${this.escapeHtml(guide.title)}" onclick="app.openViewGuideViewer('${this.escapeJs(viewName)}', ${index})">
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
            <div id="view-guide-viewer" class="shift-guide-viewer" onclick="if(event.target === this) app.closeViewGuideViewer()">
                <div class="shift-guide-viewer-card">
                    <div class="shift-guide-viewer-header">
                        <div>
                            <span>使い方ガイド</span>
                            <p>${this.escapeHtml(images[safeIndex].title)}</p>
                        </div>
                        <button type="button" onclick="app.closeViewGuideViewer()" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
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

    openAppSettingsPanel() {
        document.getElementById('app-settings-overlay')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="app-settings-overlay" class="shift-settings-overlay" onclick="if(event.target === this) app.closeAppSettingsPanel()">
                <div class="shift-settings-card app-settings-card">
                    <div class="shift-settings-header">
                        <div>
                            <span>設定メニュー</span>
                            <p>部署・連絡帳・ToDo・表示・データ入出力をまとめて開けます</p>
                        </div>
                        <button type="button" onclick="app.closeAppSettingsPanel()" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="shift-settings-grid">
                        <button type="button" onclick="app.closeAppSettingsPanel(); app.openDepartmentModal()">
                            <i class="fa-solid fa-building"></i><span>部署設定</span><small>部署の切替・登録・データ管理</small>
                        </button>
                        <button type="button" onclick="app.closeAppSettingsPanel(); app.openShiftMemberTypeManageModal()">
                            <i class="fa-solid fa-users-gear"></i><span>連絡帳 人名管理</span><small>基幹社員・サポート社員・班を管理</small>
                        </button>
                        <button type="button" onclick="app.closeAppSettingsPanel(); app.openShiftRowTemplateManageModal()">
                            <i class="fa-solid fa-list-check"></i><span>連絡帳テンプレート</span><small>行テンプレートと行セットを管理</small>
                        </button>
                        <button type="button" onclick="app.closeAppSettingsPanel(); app.switchView('todos'); setTimeout(() => app.openKanbanRequestDashboard(), 80)">
                            <i class="fa-solid fa-clipboard-list"></i><span>ToDo依頼管理</span><small>未完了依頼・期限切れ・担当者別一覧</small>
                        </button>
                        <button type="button" onclick="app.closeAppSettingsPanel(); app.openSystemActivityLogPanel()">
                            <i class="fa-solid fa-clock-rotate-left"></i><span>操作ログ</span><small>ToDo操作と最近のメンテ記録を確認</small>
                        </button>
                        <button type="button" onclick="app.closeAppSettingsPanel(); document.getElementById('btn-export')?.click()">
                            <i class="fa-solid fa-download"></i><span>データ出力</span><small>バックアップ用に現在データを書き出し</small>
                        </button>
                    </div>
                </div>
            </div>
        `);
    }

    closeAppSettingsPanel() {
        document.getElementById('app-settings-overlay')?.remove();
    }

    openSystemActivityLogPanel() {
        this.ensureKanbanTodoState?.();
        const todoLogs = (store.activeData.localTodoLogs || []).slice(0, 80).map(log => ({
            time: log.time || '',
            title: log.text || '',
            type: 'ToDo'
        }));
        const historyLogs = (store.activeData.history || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 40).map(h => ({
            time: h.date || '',
            title: this.getHistoryDisplayText(h),
            type: h.taskId ? '定期メンテ' : (h.isDokatei ? 'ドカ停' : '突発')
        }));
        const logs = [...todoLogs, ...historyLogs].sort((a, b) => String(b.time || '').localeCompare(String(a.time || ''))).slice(0, 100);
        this.openKanbanPanel('操作ログ', `
            <div class="system-log-list">
                ${logs.map(log => `
                    <div class="system-log-item">
                        <b>${this.escapeHtml(log.type)}</b>
                        <span>${this.escapeHtml(this.formatKanbanTodoTime(log.time) || log.time || '-')}</span>
                        <p>${this.escapeHtml(log.title || '')}</p>
                    </div>
                `).join('') || '<p class="kt-muted">ログはありません</p>'}
            </div>
        `);
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
        if (hPeriod) hPeriod.value = 'all';
        const hMachine = document.getElementById('hist-filter-machine');
        if (hMachine) hMachine.value = '';
        const hLine = document.getElementById('hist-filter-line');
        if (hLine) hLine.value = 'all';
        const hType = document.getElementById('hist-filter-type');
        if (hType) hType.value = '';

        // Reset Ranking View Filter
        const rPeriod = document.getElementById('ranking-filter-period');
        if (rPeriod) rPeriod.value = 'all';

        // Reset Analysis/Dashboard View Filters
        const aPeriod = document.getElementById('analysis-filter-period');
        if (aPeriod) aPeriod.value = 'all';
        const dPeriod = document.getElementById('dashboard-filter-period');
        if (dPeriod) dPeriod.value = 'this_month';

        // Reset Guides View Filters
        const gLine = document.getElementById('guides-filter-line');
        if (gLine) gLine.value = 'all';

        this.modelFilter = null;
        this.workerFilter = null;
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
            case 'analysis': this.renderAnalysis(); break;
            case 'dashboard': this.renderDashboard(); break;
            case 'worktime': this.renderWorkTime(); break;
            case 'ranking': this.renderRanking(); break;
            case 'workers': this.renderWorkers(); break;
            case 'guides': this.renderGuides(); break;
        }
    }

    getPendingTodoRequestCount() {
        const todos = store.activeData?.localTodos || [];
        return todos.filter(todo => todo.isRequest && !todo.archived && (todo.status || 'todo') !== 'done').length;
    }

    getPendingTodoRequests() {
        const todos = store.activeData?.localTodos || [];
        return todos
            .filter(todo => todo.isRequest && !todo.archived && (todo.status || 'todo') !== 'done')
            .sort((a, b) => (a.deadlineDate || '9999-99-99').localeCompare(b.deadlineDate || '9999-99-99') || (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
    }

    updateTodoRequestCountBadge() {
        const badge = document.getElementById('todo-request-count-badge');
        if (!badge) return;
        const count = this.getPendingTodoRequestCount();
        badge.textContent = String(count);
        badge.hidden = count === 0;
        badge.title = `未処理の依頼事項: ${count}件`;
    }

    openPendingTodoRequestPanel() {
        this.ensureKanbanTodoState();
        const requests = this.getPendingTodoRequests();
        this.openKanbanPanel('未処理の依頼事項', `
            <div class="kt-request-panel-list">
                ${requests.map(todo => {
                    const assignees = (todo.assignedTo || []).map(id => this.getKanbanTodoWorkerName(id)).filter(Boolean).join(', ') || '未設定';
                    const requester = todo.requestedBy ? this.getKanbanTodoWorkerName(todo.requestedBy) : '未設定';
                    const statusLabel = { todo: '未処理', progress: '処理中' }[todo.status || 'todo'] || (todo.status || '未処理');
                    const deadline = todo.deadlineDate ? `${todo.deadlineDate}${todo.deadlineTime ? ` ${todo.deadlineTime}` : ''}` : '期限なし';
                    return `
                        <button type="button" class="kt-request-panel-item" onclick="app.openPendingTodoRequest('${this.escapeJs(todo.id)}')">
                            <span class="kt-request-panel-title">${this.escapeHtml(todo.title || '無題')}</span>
                            <span class="kt-request-panel-meta">${this.escapeHtml(statusLabel)} / 依頼先: ${this.escapeHtml(assignees)} / 依頼者: ${this.escapeHtml(requester)}</span>
                            <span class="kt-request-panel-deadline"><i class="fa-solid fa-clock"></i> ${this.escapeHtml(deadline)}</span>
                        </button>
                    `;
                }).join('') || '<p class="kt-muted">未処理の依頼はありません</p>'}
            </div>
        `);
    }

    openPendingTodoRequest(todoId) {
        const todo = (store.activeData.localTodos || []).find(item => item.id === todoId);
        if (!todo) return;
        const firstAssignee = (todo.assignedTo || []).find(id => id && id !== 'all') || todo.requestedBy || '__all__';
        this.closeKanbanTodoModal();
        this.changeKanbanTodoWorker(firstAssignee);
        this.switchView('todos');
        setTimeout(() => {
            this.highlightKanbanTodoCard(todo.id);
            this.openKanbanTodoModal(todo.status || 'todo', todo.id);
        }, 90);
    }

    openKanbanRequestDashboard() {
        this.ensureKanbanTodoState();
        const requests = this.getPendingTodoRequests();
        const todoCount = requests.filter(todo => (todo.status || 'todo') === 'todo').length;
        const progressCount = requests.filter(todo => (todo.status || 'todo') === 'progress').length;
        const overdueCount = requests.filter(todo => this.getKanbanDeadlineStatus(todo) === 'overdue').length;
        const workerCounts = new Map();
        requests.forEach(todo => {
            const assignees = (todo.assignedTo || []).filter(id => id && id !== 'all');
            (assignees.length ? assignees : ['__unset__']).forEach(id => {
                workerCounts.set(id, (workerCounts.get(id) || 0) + 1);
            });
        });
        const workerRows = Array.from(workerCounts.entries())
            .sort((a, b) => b[1] - a[1] || this.getKanbanTodoWorkerName(a[0]).localeCompare(this.getKanbanTodoWorkerName(b[0]), 'ja'))
            .map(([workerId, count]) => `
                <button type="button" class="kt-request-worker-row" onclick="app.changeKanbanTodoWorker('${this.escapeJs(workerId === '__unset__' ? '__all__' : workerId)}'); app.closeKanbanTodoModal(); app.switchView('todos')">
                    <span>${this.escapeHtml(workerId === '__unset__' ? '未設定' : this.getKanbanTodoWorkerName(workerId))}</span>
                    <b>${count}件</b>
                </button>
            `).join('');

        this.openKanbanPanel('依頼ダッシュボード', `
            <div class="kt-request-dashboard">
                <div class="kt-request-dashboard-stats">
                    <div class="kt-request-stat-card"><span>未完了</span><b>${requests.length}</b></div>
                    <div class="kt-request-stat-card"><span>未処理</span><b>${todoCount}</b></div>
                    <div class="kt-request-stat-card"><span>進行中</span><b>${progressCount}</b></div>
                    <div class="kt-request-stat-card danger"><span>期限切れ</span><b>${overdueCount}</b></div>
                </div>
                <section class="kt-request-dashboard-section">
                    <h3>担当者別</h3>
                    <div class="kt-request-worker-list">
                        ${workerRows || '<p class="kt-muted">未完了の依頼はありません</p>'}
                    </div>
                </section>
                <section class="kt-request-dashboard-section">
                    <h3>依頼一覧</h3>
                    <div class="kt-request-panel-list">
                        ${requests.map(todo => {
                            const assignees = (todo.assignedTo || []).map(id => this.getKanbanTodoWorkerName(id)).filter(Boolean).join(', ') || '未設定';
                            const requester = todo.requestedBy ? this.getKanbanTodoWorkerName(todo.requestedBy) : '未設定';
                            const statusLabel = { todo: '未処理', progress: '進行中' }[todo.status || 'todo'] || (todo.status || '未処理');
                            const deadline = todo.deadlineDate ? `${todo.deadlineDate}${todo.deadlineTime ? ` ${todo.deadlineTime}` : ''}` : '期限なし';
                            const priority = { low: '低', medium: '中', high: '高' }[todo.priority || 'low'] || (todo.priority || '低');
                            return `
                                <button type="button" class="kt-request-panel-item" onclick="app.openPendingTodoRequest('${this.escapeJs(todo.id)}')">
                                    <span class="kt-request-panel-title">${this.escapeHtml(todo.title || '無題')}</span>
                                    <span class="kt-request-panel-meta">${this.escapeHtml(statusLabel)} / 優先度: ${this.escapeHtml(priority)} / 依頼先: ${this.escapeHtml(assignees)} / 依頼者: ${this.escapeHtml(requester)}</span>
                                    <span class="kt-request-panel-deadline"><i class="fa-solid fa-clock"></i> ${this.escapeHtml(deadline)}</span>
                                </button>
                            `;
                        }).join('') || '<p class="kt-muted">未完了の依頼はありません</p>'}
                    </div>
                </section>
            </div>
        `);
    }

    openShiftNotebookSettingsPanel() {
        document.getElementById('shift-settings-overlay')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="shift-settings-overlay" class="shift-settings-overlay" onclick="if(event.target === this) app.closeShiftNotebookSettingsPanel()">
                <div class="shift-settings-card">
                    <div class="shift-settings-header">
                        <div>
                            <span>連絡帳設定</span>
                            <p>人名・テンプレート・表示まわりをまとめて開けます</p>
                        </div>
                        <button type="button" onclick="app.closeShiftNotebookSettingsPanel()" aria-label="閉じる">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div class="shift-settings-grid">
                        <button type="button" onclick="app.closeShiftNotebookSettingsPanel(); app.openShiftMemberTypeManageModal()">
                            <i class="fa-solid fa-users-gear"></i>
                            <span>人名管理</span>
                            <small>基幹社員・サポート社員、班、順番を管理</small>
                        </button>
                        <button type="button" onclick="app.closeShiftNotebookSettingsPanel(); app.openShiftRowTemplateManageModal()">
                            <i class="fa-solid fa-list-check"></i>
                            <span>行テンプレート管理</span>
                            <small>ブランク・記入あり・行セットを整理</small>
                        </button>
                        <button type="button" onclick="app.closeShiftNotebookSettingsPanel(); app.openShiftRowGroupOrderModal()">
                            <i class="fa-solid fa-arrow-up-wide-short"></i>
                            <span>グループ表示順</span>
                            <small>未設定・貫通表示・朝礼などの並びを変更</small>
                        </button>
                        <button type="button" onclick="app.closeShiftNotebookSettingsPanel(); app.editShiftGroupPreset()">
                            <i class="fa-solid fa-pen"></i>
                            <span>プリセット編集</span>
                            <small>現在選択中のプリセット名と内容を変更</small>
                        </button>
                        <button type="button" onclick="app.closeShiftNotebookSettingsPanel(); document.getElementById('shift-row-menu-toggle-btn')?.click()">
                            <i class="fa-solid fa-eye-slash"></i>
                            <span>行メニュー表示</span>
                            <small>グループ・装飾・右側ボタンの表示を切替</small>
                        </button>
                    </div>
                </div>
            </div>
        `);
    }

    closeShiftNotebookSettingsPanel() {
        document.getElementById('shift-settings-overlay')?.remove();
    }

    getShiftNotebookGuideImages() {
        return [
            { src: 'assets/shift-notebook-guide-1.svg', title: '基本操作' },
            { src: 'assets/shift-notebook-guide-2.svg', title: 'テンプレートと行挿入' },
            { src: 'assets/shift-notebook-guide-3.svg', title: '返信とToDo依頼' }
        ];
    }

    getShiftNotebookGuideThumbsHtml() {
        return `
            <span class="shift-guide-thumbs" aria-label="連絡帳の使い方">
                ${this.getShiftNotebookGuideImages().map((image, index) => `
                    <button type="button" class="shift-guide-thumb" title="${this.escapeHtml(image.title)}" onclick="event.stopPropagation(); app.openShiftNotebookGuideViewer(${index})">
                        <img src="${this.escapeHtml(image.src)}" alt="${this.escapeHtml(image.title)}">
                    </button>
                `).join('')}
            </span>
        `;
    }

    openShiftNotebookGuideViewer(index = 0) {
        const images = this.getShiftNotebookGuideImages();
        const safeIndex = Math.max(0, Math.min(images.length - 1, Number(index) || 0));
        document.getElementById('shift-guide-viewer')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="shift-guide-viewer" class="shift-guide-viewer" onclick="if(event.target === this) app.closeShiftNotebookGuideViewer()">
                <div class="shift-guide-viewer-card">
                    <div class="shift-guide-viewer-header">
                        <div>
                            <span>連絡帳の使い方</span>
                            <p id="shift-guide-viewer-title">${this.escapeHtml(images[safeIndex].title)}</p>
                        </div>
                        <button type="button" onclick="app.closeShiftNotebookGuideViewer()" aria-label="閉じる">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div class="shift-guide-viewer-stage">
                        <button type="button" class="shift-guide-nav prev" onclick="app.showShiftNotebookGuideImage(${safeIndex - 1})"><i class="fa-solid fa-chevron-left"></i></button>
                        <img id="shift-guide-viewer-image" src="${this.escapeHtml(images[safeIndex].src)}" alt="${this.escapeHtml(images[safeIndex].title)}">
                        <button type="button" class="shift-guide-nav next" onclick="app.showShiftNotebookGuideImage(${safeIndex + 1})"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                    <div class="shift-guide-viewer-thumbs">
                        ${images.map((image, thumbIndex) => `
                            <button type="button" class="${thumbIndex === safeIndex ? 'active' : ''}" onclick="app.showShiftNotebookGuideImage(${thumbIndex})">
                                <img src="${this.escapeHtml(image.src)}" alt="${this.escapeHtml(image.title)}">
                                <span>${this.escapeHtml(image.title)}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `);
        this.showShiftNotebookGuideImage(safeIndex);
    }

    showShiftNotebookGuideImage(index = 0) {
        const images = this.getShiftNotebookGuideImages();
        const safeIndex = (Number(index) + images.length) % images.length;
        const image = images[safeIndex];
        const viewerImage = document.getElementById('shift-guide-viewer-image');
        const title = document.getElementById('shift-guide-viewer-title');
        if (viewerImage) {
            viewerImage.src = image.src;
            viewerImage.alt = image.title;
        }
        if (title) title.textContent = image.title;
        document.querySelectorAll('.shift-guide-viewer-thumbs button').forEach((button, idx) => {
            button.classList.toggle('active', idx === safeIndex);
        });
        const prev = document.querySelector('.shift-guide-nav.prev');
        const next = document.querySelector('.shift-guide-nav.next');
        if (prev) prev.setAttribute('onclick', `app.showShiftNotebookGuideImage(${safeIndex - 1})`);
        if (next) next.setAttribute('onclick', `app.showShiftNotebookGuideImage(${safeIndex + 1})`);
    }

    closeShiftNotebookGuideViewer() {
        document.getElementById('shift-guide-viewer')?.remove();
    }

    ensureKanbanTodoState() {
        const d = store.activeData;
        if (!Array.isArray(d.localTodos)) d.localTodos = [];
        if (!Array.isArray(d.localTodoWorkers) || d.localTodoWorkers.length === 0) {
            d.localTodoWorkers = [{ id: 'default', name: '共通・未設定' }];
        }
        if (!Array.isArray(d.localTodoLogs)) d.localTodoLogs = [];
        this.syncKanbanTodoWorkersWithCoreMembers(d);

        d.localTodos.forEach(todo => {
            if (!todo.status) todo.status = todo.done ? 'done' : 'todo';
            if (!todo.priority || todo.priority === 'normal') todo.priority = 'medium';
            if (todo.dueDate && !todo.deadlineDate) todo.deadlineDate = todo.dueDate;
            if (todo.deadline && !todo.deadlineDate) {
                todo.deadlineDate = String(todo.deadline).slice(0, 10);
                todo.deadlineTime = String(todo.deadline).slice(11, 16);
            }
            if (!Array.isArray(todo.assignedTo)) todo.assignedTo = [];
            if (!Array.isArray(todo.rejectedBy)) todo.rejectedBy = [];
            todo.description = todo.description || '';
            if ((todo.status || '') === 'done' && !todo.completedAt) todo.completedAt = todo.updatedAt || todo.createdAt || new Date().toISOString();
        });

        const savedWorker = localStorage.getItem('kanbanTodoWorkerId');
        const selectedExists = d.localTodoWorkers.some(w => w.id === this.kanbanTodoWorkerId);
        this.kanbanTodoWorkerId = selectedExists ? this.kanbanTodoWorkerId : (savedWorker || d.localTodoWorkers[0].id);
        if (!d.localTodoWorkers.some(w => w.id === this.kanbanTodoWorkerId)) {
            this.kanbanTodoWorkerId = d.localTodoWorkers[0].id;
        }
        return d;
    }

    getKanbanWorkerIdForCoreMemberName(name) {
        return `shift-core-${encodeURIComponent(String(name || '').trim())}`;
    }

    syncKanbanTodoWorkersWithCoreMembers(d = store.activeData) {
        if (!Array.isArray(d.localTodoWorkers)) d.localTodoWorkers = [];
        if (!Array.isArray(d.localTodos)) d.localTodos = [];
        const types = this.ensureShiftNotebookMemberTypes ? this.ensureShiftNotebookMemberTypes() : {};
        const coreNames = this.getShiftNotebookPresetMemberNames
            ? this.getShiftNotebookPresetMemberNames().filter(name => types[name] !== 'support')
            : [];
        if (coreNames.length === 0) {
            if (d.localTodoWorkers.length === 0) d.localTodoWorkers = [{ id: 'default', name: '共通・未設定' }];
            return;
        }

        const currentByName = new Map(d.localTodoWorkers.map(worker => [worker.name, worker]));
        const idMap = new Map();
        const syncedWorkers = coreNames.map(name => {
            const previous = currentByName.get(name);
            const nextId = previous?.id || this.getKanbanWorkerIdForCoreMemberName(name);
            if (previous?.id && previous.id !== nextId) idMap.set(previous.id, nextId);
            return { id: nextId, name };
        });

        d.localTodos.forEach(todo => {
            if (idMap.has(todo.requestedBy)) todo.requestedBy = idMap.get(todo.requestedBy);
            if (Array.isArray(todo.assignedTo)) todo.assignedTo = todo.assignedTo.map(id => idMap.get(id) || id);
            if (Array.isArray(todo.rejectedBy)) todo.rejectedBy = todo.rejectedBy.map(id => idMap.get(id) || id);
        });

        d.localTodoWorkers = syncedWorkers;
        const validIds = new Set(['__all__', ...syncedWorkers.map(worker => worker.id)]);
        if (!validIds.has(this.kanbanTodoWorkerId)) {
            const savedWorker = localStorage.getItem('kanbanTodoWorkerId');
            this.kanbanTodoWorkerId = validIds.has(savedWorker) ? savedWorker : syncedWorkers[0].id;
            localStorage.setItem('kanbanTodoWorkerId', this.kanbanTodoWorkerId);
        }
    }

    renderKanbanLocalTodos() {
        const d = this.ensureKanbanTodoState();
        const board = document.getElementById('kt-list-todo');
        if (!board) return;
        this.syncKanbanRecurringTodos();
        this.autoArchiveCompletedKanbanTodos();

        const workerSelect = document.getElementById('kt-worker-select');
        if (workerSelect) {
            workerSelect.innerHTML = `<option value="__all__" ${this.kanbanTodoWorkerId === '__all__' ? 'selected' : ''}>全員を表示</option>`
                + d.localTodoWorkers.map(w => `<option value="${this.escapeHtml(w.id)}" ${w.id === this.kanbanTodoWorkerId ? 'selected' : ''}>${this.escapeHtml(w.name)}</option>`).join('');
        }
        document.getElementById('kt-overdue-only-btn')?.classList.toggle('active', this.kanbanOverdueOnly);
        const filterBanner = document.getElementById('kt-filter-banner');
        if (filterBanner) {
            const filters = [];
            if (this.kanbanOverdueOnly) filters.push('<i class="fa-solid fa-triangle-exclamation"></i> 期限切れのみ表示中');
            if (this.kanbanTodoWorkerId === '__all__') filters.push('<i class="fa-solid fa-users"></i> 全員を表示中');
            filterBanner.hidden = filters.length === 0;
            filterBanner.innerHTML = filters.join('<span class="kt-filter-sep"></span>');
        }

        const logList = document.getElementById('kt-log-list');
        if (logList) {
            logList.innerHTML = d.localTodoLogs.slice(0, 6).map(log => `
                <li><span>${this.escapeHtml(this.formatKanbanTodoTime(log.time))}</span>${this.escapeHtml(log.text || '')}</li>
            `).join('') || '<li class="kt-muted">まだログはありません</li>';
        }

        const statusLabels = { todo: 'TO DO', progress: '処理中', done: '処理済' };
        ['todo', 'progress', 'done'].forEach(status => {
            const list = document.getElementById(`kt-list-${status}`);
            if (!list) return;
            const items = d.localTodos
                .filter(todo => (todo.status || 'todo') === status)
                .filter(todo => this.isKanbanTodoVisible(todo))
                .filter(todo => !this.kanbanOverdueOnly || this.getKanbanDeadlineStatus(todo) === 'overdue')
                .sort((a, b) => (a.deadlineDate || '9999-99-99').localeCompare(b.deadlineDate || '9999-99-99') || (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
            document.getElementById(`kt-count-${status}`)?.replaceChildren(document.createTextNode(String(items.length)));
            const emptyText = this.kanbanOverdueOnly ? '期限切れタスクはありません' : `${statusLabels[status]} は空です`;
            list.innerHTML = items.length ? items.map(todo => this.renderKanbanTodoCard(todo)).join('') : `<div class="kt-empty">${emptyText}</div>`;
        });
        this.updateTodoRequestCountBadge();
        if (document.querySelector('.kt-board-shell.kt-fit-mode')) {
            clearTimeout(this._kanbanFitTimer);
            this._kanbanFitTimer = setTimeout(() => this.adjustKanbanTodoFit(), 60);
        }
    }

    toggleKanbanTodoFit() {
        const shell = document.querySelector('.kt-board-shell');
        const button = document.getElementById('kt-fit-btn');
        const board = document.querySelector('.kt-kanban');
        if (!shell || !board) return;
        if (shell.classList.contains('kt-fit-mode')) {
            shell.classList.remove('kt-fit-mode');
            shell.style.removeProperty('--kt-fit-scale');
            board.style.removeProperty('height');
            board.style.removeProperty('width');
            button?.classList.remove('active');
            if (button) button.innerHTML = '<i class="fa-solid fa-compress"></i> Fit';
            return;
        }
        shell.classList.add('kt-fit-mode');
        button?.classList.add('active');
        if (button) button.innerHTML = '<i class="fa-solid fa-up-right-and-down-left-from-center"></i> Reset';
        this.adjustKanbanTodoFit();
    }

    toggleKanbanOverdueOnly(force = null) {
        this.kanbanOverdueOnly = force === null ? !this.kanbanOverdueOnly : !!force;
        localStorage.setItem('kanban_overdue_only', String(this.kanbanOverdueOnly));
        document.getElementById('kt-overdue-only-btn')?.classList.toggle('active', this.kanbanOverdueOnly);
        this.renderKanbanLocalTodos();
    }

    adjustKanbanTodoFit() {
        const shell = document.querySelector('.kt-board-shell.kt-fit-mode');
        const board = shell?.querySelector('.kt-kanban');
        const viewport = document.querySelector('.viewport');
        if (!shell || !board || !viewport) return;
        shell.style.setProperty('--kt-fit-scale', '1');
        board.style.removeProperty('height');
        board.style.removeProperty('width');
        requestAnimationFrame(() => {
            const shellRect = shell.getBoundingClientRect();
            const boardRect = board.getBoundingClientRect();
            const viewportRect = viewport.getBoundingClientRect();
            const availableHeight = Math.max(260, viewportRect.bottom - boardRect.top - 10);
            const availableWidth = Math.max(420, shellRect.width - 12);
            const neededHeight = Math.max(board.scrollHeight, boardRect.height);
            const neededWidth = Math.max(board.scrollWidth, boardRect.width);
            const scale = Math.max(0.35, Math.min(1, availableHeight / neededHeight, availableWidth / neededWidth));
            shell.style.setProperty('--kt-fit-scale', scale.toFixed(3));
            board.style.height = `${Math.ceil(neededHeight * scale)}px`;
            board.style.width = scale < 1 ? `${Math.ceil(100 / scale)}%` : '';
        });
    }

    syncKanbanRecurringTodos() {
        const d = this.ensureKanbanTodoState();
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const generated = [];

        d.localTodos.forEach(todo => {
            if (!todo.isRecurring || !['done', 'archived'].includes(todo.status || 'todo')) return;
            if (todo.lastRecurringMonth === monthKey) return;
            const updatedMonth = String(todo.updatedAt || todo.createdAt || '').slice(0, 7);
            if (!updatedMonth || updatedMonth >= monthKey) return;

            const day = String(todo.deadlineDate || '').slice(8, 10);
            const deadlineDate = day ? `${monthKey}-${day}` : '';
            const clone = {
                ...todo,
                id: `kt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                status: 'todo',
                done: false,
                archived: false,
                deadlineDate,
                deadline: deadlineDate ? `${deadlineDate}${todo.deadlineTime ? `T${todo.deadlineTime}` : ''}` : '',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
                sourceRecurringId: todo.sourceRecurringId || todo.id,
                lastRecurringMonth: ''
            };
            d.localTodos.unshift(clone);
            todo.lastRecurringMonth = monthKey;
            generated.push(clone.title || '無題');
        });

        if (generated.length) {
            this.addKanbanTodoLog(`定期タスクを補充: ${generated.join('、')}`);
            store.save();
        }
    }

    autoArchiveCompletedKanbanTodos() {
        const d = this.ensureKanbanTodoState();
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const doneItems = d.localTodos
            .filter(todo => !todo.archived && (todo.status || '') === 'done')
            .sort((a, b) => String(a.completedAt || a.updatedAt || a.createdAt || '').localeCompare(String(b.completedAt || b.updatedAt || b.createdAt || '')));
        if (doneItems.length === 0) return;

        const archiveSet = new Set();
        doneItems.forEach(todo => {
            const completedTime = new Date(todo.completedAt || todo.updatedAt || todo.createdAt || 0).getTime();
            if (completedTime && now - completedTime >= weekMs) archiveSet.add(todo.id);
        });

        if (doneItems.length > 5) {
            doneItems.slice(0, doneItems.length - 5).forEach(todo => archiveSet.add(todo.id));
        }

        if (archiveSet.size === 0) return;
        const archivedTitles = [];
        d.localTodos.forEach(todo => {
            if (!archiveSet.has(todo.id)) return;
            todo.archived = true;
            todo.archivedAt = new Date().toISOString();
            archivedTitles.push(todo.title || '無題');
        });
        this.addKanbanTodoLog(`完了タスクを自動で履歴へ移動: ${archivedTitles.join('、')}`);
        store.save();
    }

    renderKanbanTodoCard(todo) {
        const priorityLabels = { low: '低', medium: '中', high: '高' };
        const deadlineStatus = this.getKanbanDeadlineStatus(todo);
        const deadlineLabel = todo.deadlineDate ? `${todo.deadlineDate}${todo.deadlineTime ? ` ${todo.deadlineTime}` : ''}` : '';
        const requestToLabel = todo.isRequest ? this.getKanbanTodoRequestTargetLabel(todo) : '';
        const requestFromLabel = todo.isRequest ? this.getKanbanTodoWorkerName(todo.requestedBy) : '';
        const hasShiftSource = !!(todo.isRequest && todo.shiftRequestSource?.dateStr && todo.shiftRequestSource?.shift);
        return `
            <article class="kt-task-card priority-${this.escapeHtml(todo.priority || 'medium')} ${todo.isRecurring ? 'type-recurring' : ''} ${todo.isRequest ? 'type-request' : ''} deadline-${deadlineStatus}"
                draggable="true"
                ondragstart="app.dragKanbanTodo(event, '${this.escapeJs(todo.id)}')"
                onclick="app.openKanbanTodoModal('${this.escapeJs(todo.status || 'todo')}', '${this.escapeJs(todo.id)}')">
                <div class="kt-card-top">
                    <span class="kt-priority-badge">${priorityLabels[todo.priority] || '中'}</span>
                    ${todo.isRecurring ? '<span class="kt-mini-badge recurring">定期</span>' : ''}
                    ${todo.isRequest ? `<span class="kt-mini-badge request">依頼先: ${this.escapeHtml(requestToLabel)}</span><span class="kt-mini-badge requester">依頼者: ${this.escapeHtml(requestFromLabel)}</span>` : ''}
                </div>
                <div class="kt-card-title">${this.escapeHtml(todo.title || '無題のタスク')}</div>
                ${todo.description ? `<div class="kt-card-desc">${this.escapeHtml(todo.description).slice(0, 80)}</div>` : ''}
                <div class="kt-card-meta">
                    ${deadlineLabel ? `<span><i class="fa-solid fa-clock"></i> ${this.escapeHtml(deadlineLabel)}</span>` : '<span class="kt-muted">期限なし</span>'}
                    <span class="kt-card-actions">
                        ${hasShiftSource ? `<button type="button" class="kt-card-calendar" onclick="event.stopPropagation(); app.openShiftNotebookFromTodoCard('${this.escapeJs(todo.id)}')" title="依頼元の連絡帳へ戻る"><i class="fa-solid fa-calendar-days"></i></button>` : ''}
                        ${todo.status === 'done' ? `<button type="button" class="kt-card-archive" onclick="event.stopPropagation(); app.archiveKanbanTodo('${this.escapeJs(todo.id)}')" title="履歴へ移動"><i class="fa-solid fa-box-archive"></i></button>` : ''}
                        <button type="button" class="kt-card-delete" onclick="event.stopPropagation(); app.deleteKanbanTodo('${this.escapeJs(todo.id)}')" title="削除"><i class="fa-solid fa-trash-can"></i></button>
                    </span>
                </div>
            </article>
        `;
    }

    openShiftNotebookFromTodoCard(todoId) {
        const todo = (store.activeData.localTodos || []).find(item => item.id === todoId);
        const source = todo?.shiftRequestSource;
        if (!source?.dateStr || !source?.shift) {
            alert('依頼元の連絡帳が見つかりません。');
            return;
        }
        this.closeKanbanTodoModal();
        this.switchView('calendar');
        this.openShiftNotebookModal(source.dateStr, source.shift);
        setTimeout(() => {
            const row = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'))
                .find(item => item.dataset.shiftRowId === source.rowId);
            row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row?.classList.add('shift-row-source-highlight');
            setTimeout(() => row?.classList.remove('shift-row-source-highlight'), 10000);
        }, 120);
    }

    openKanbanTodoFromSearch(todoId) {
        const todo = (store.activeData.localTodos || []).find(item => item.id === todoId);
        if (!todo) return;
        const workerId = (todo.assignedTo || [])[0] || todo.requestedBy || this.kanbanTodoWorkerId || '__all__';
        this.changeKanbanTodoWorker(workerId === 'all' ? '__all__' : workerId);
        this.switchView('todos');
        setTimeout(() => {
            const card = Array.from(document.querySelectorAll('.kt-task-card'))
                .find(el => (el.getAttribute('onclick') || '').includes(todo.id));
            card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card?.classList.add('kt-task-card-jump');
            setTimeout(() => card?.classList.remove('kt-task-card-jump'), 2200);
            this.openKanbanTodoModal(todo.status || 'todo', todo.id);
        }, 80);
    }

    getKanbanTodoWorkerName(id) {
        if (id === '__all__' || id === 'all') return '全員';
        const worker = (store.activeData.localTodoWorkers || []).find(w => w.id === id);
        return worker ? worker.name : '未設定';
    }

    getKanbanTodoRequestTargetLabel(todo) {
        const ids = Array.isArray(todo?.assignedTo) ? todo.assignedTo : [];
        if (ids.includes('all')) return '全員';
        const names = ids.map(id => this.getKanbanTodoWorkerName(id)).filter(Boolean);
        return names.length ? names.join(', ') : '未設定';
    }

    formatKanbanTodoTime(value) {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    getKanbanDeadlineStatus(todo) {
        if (!todo.deadlineDate || todo.status === 'done') return '';
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
        if (todo.deadlineDate < todayStr) return 'overdue';
        if (todo.deadlineDate === todayStr) return 'today';
        if (todo.deadlineDate === tomorrowStr) return 'tomorrow';
        return '';
    }

    isKanbanTodoVisible(todo) {
        if (todo.archived) return false;
        const workerId = this.kanbanTodoWorkerId;
        if (workerId === '__all__') return true;
        if (!todo.isRequest) return true;
        if (todo.requestedBy === workerId) return true;
        if ((todo.rejectedBy || []).includes(workerId)) return false;
        const assigned = todo.assignedTo || [];
        return assigned.length === 0 || assigned.includes('all') || assigned.includes(workerId);
    }

    addKanbanTodoLog(text) {
        this.ensureKanbanTodoState();
        store.activeData.localTodoLogs.unshift({
            id: `kt-log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            time: new Date().toISOString(),
            text
        });
        store.activeData.localTodoLogs = store.activeData.localTodoLogs.slice(0, 200);
    }

    changeKanbanTodoWorker(workerId) {
        this.ensureKanbanTodoState();
        this.kanbanTodoWorkerId = workerId;
        localStorage.setItem('kanbanTodoWorkerId', workerId);
        this.renderKanbanLocalTodos();
    }

    dragKanbanTodo(event, id) {
        event.dataTransfer.setData('text/plain', id);
        event.dataTransfer.effectAllowed = 'move';
    }

    dropKanbanTodo(event, status) {
        event.preventDefault();
        const id = event.dataTransfer.getData('text/plain');
        if (id) this.moveKanbanTodo(id, status);
    }

    moveKanbanTodo(id, status) {
        const d = this.ensureKanbanTodoState();
        const todo = d.localTodos.find(item => item.id === id);
        if (!todo || todo.status === status) return;
        const previousStatus = todo.status || 'todo';
        todo.status = status;
        todo.done = status === 'done';
        if (status === 'done' && previousStatus !== 'done') todo.completedAt = new Date().toISOString();
        if (status !== 'done') todo.completedAt = '';
        todo.updatedAt = new Date().toISOString();
        this.addKanbanTodoLog(`「${todo.title || '無題'}」を${{ todo: 'TO DO', progress: '処理中', done: '処理済' }[status]}へ移動`);
        if (previousStatus !== 'progress' && status === 'progress') {
            this.appendShiftTodoFeedback(todo, 'progress');
            todo.shiftRequestFeedbackProgress = true;
        }
        if (previousStatus !== 'done' && status === 'done') {
            this.appendShiftTodoFeedback(todo, 'done');
            todo.shiftRequestFeedbackDone = true;
        }
        store.save();
        this.updateTodoRequestCountBadge();
        this.renderKanbanLocalTodos();
    }

    openKanbanTodoModal(status = 'todo', id = '', isRecurring = false, isRequest = false) {
        const d = this.ensureKanbanTodoState();
        const todo = id ? d.localTodos.find(item => item.id === id) : null;
        const current = todo || {
            id: '',
            title: '',
            description: '',
            priority: 'medium',
            status,
            deadlineDate: '',
            deadlineTime: '',
            isRecurring,
            isRequest,
            assignedTo: [],
            requestedBy: this.kanbanTodoWorkerId,
            rejectedBy: []
        };
        const receivedRequest = current.isRequest && current.requestedBy && current.requestedBy !== this.kanbanTodoWorkerId;
        const fontScale = this.getKanbanTodoModalFontScale();
        this.closeKanbanTodoModal();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="kt-todo-modal-overlay" class="kt-modal-overlay active" onclick="if(event.target === this) app.closeKanbanTodoModal()">
                <div class="kt-modal kt-todo-modal kt-font-${fontScale}">
                    <div class="kt-modal-header">
                        <h2>${todo ? 'タスク編集' : (isRequest ? '依頼を追加' : 'タスク追加')}</h2>
                        <div class="kt-modal-header-actions">
                            <div class="kt-font-size-controls" aria-label="文字サイズ">
                                <button type="button" class="${fontScale === 'small' ? 'active' : ''}" onclick="app.setKanbanTodoModalFontScale('small')" title="文字を小さく">A-</button>
                                <button type="button" class="${fontScale === 'normal' ? 'active' : ''}" onclick="app.setKanbanTodoModalFontScale('normal')" title="標準サイズ">A</button>
                                <button type="button" class="${fontScale === 'large' ? 'active' : ''}" onclick="app.setKanbanTodoModalFontScale('large')" title="文字を大きく">A+</button>
                            </div>
                            <button type="button" class="kt-modal-close-btn" onclick="app.closeKanbanTodoModal()"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>
                    <input type="hidden" id="kt-task-id" value="${this.escapeHtml(current.id)}">
                    <input type="hidden" id="kt-task-status" value="${this.escapeHtml(current.status || status)}">
                    <label class="kt-field">タイトル
                        <input type="text" id="kt-task-title" value="${this.escapeHtml(current.title || '')}" placeholder="タスク名">
                    </label>
                    <label class="kt-field">詳細
                        <textarea id="kt-task-desc" rows="8" placeholder="作業メモ・チェック内容">${this.escapeHtml(current.description || '')}</textarea>
                    </label>
                    ${Array.isArray(current.changeLog) && current.changeLog.length ? `
                        <div class="kt-change-log-box">
                            <b>変更履歴</b>
                            ${current.changeLog.slice(0, 6).map(log => `<span>${this.escapeHtml(this.formatKanbanTodoTime(log.at) || log.at || '')} / ${this.escapeHtml(log.by || '')} / ${this.escapeHtml(log.action || '')}${Array.isArray(log.fields) && log.fields.length ? `: ${this.escapeHtml(log.fields.join(', '))}` : ''}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="kt-detail-tools">
                        <button type="button" onclick="app.insertKanbanDetailCheckmark()">✅</button>
                        <button type="button" onclick="app.insertKanbanDetailTimestamp()">時刻</button>
                        <button type="button" onclick="app.insertKanbanDetailTemplate()">テンプレ</button>
                        <button type="button" onclick="app.insertKanbanDetailSeparator()">区切り</button>
                    </div>
                    <div class="kt-form-grid">
                        <label class="kt-field">優先度
                            <select id="kt-task-priority">
                                <option value="low" ${current.priority === 'low' ? 'selected' : ''}>低</option>
                                <option value="medium" ${!current.priority || current.priority === 'medium' ? 'selected' : ''}>中</option>
                                <option value="high" ${current.priority === 'high' ? 'selected' : ''}>高</option>
                            </select>
                        </label>
                        <label class="kt-field">期限日
                            <input type="date" id="kt-task-deadline-date" value="${this.escapeHtml(current.deadlineDate || '')}">
                        </label>
                        <label class="kt-field">時刻
                            <input type="time" id="kt-task-deadline-time" value="${this.escapeHtml(current.deadlineTime || '')}">
                        </label>
                    </div>
                    <div class="kt-check-row">
                        <label><input type="checkbox" id="kt-task-recurring" ${current.isRecurring ? 'checked' : ''}> 毎月の定期タスク</label>
                        <label><input type="checkbox" id="kt-task-request" ${current.isRequest ? 'checked' : ''} ${receivedRequest ? 'disabled' : ''}> 依頼タスク</label>
                    </div>
                    <div class="kt-request-box">
                        <div class="kt-request-title">依頼先</div>
                        ${this.renderKanbanWorkerCheckboxes(current.assignedTo || [])}
                    </div>
                    <div class="kt-modal-actions">
                        ${receivedRequest ? `<button type="button" class="danger-btn" onclick="app.rejectKanbanTodo('${this.escapeJs(current.id)}')">拒否</button>` : ''}
                        ${todo ? '<button type="button" class="danger-btn" onclick="app.deleteKanbanTodoFromModal()">削除</button>' : ''}
                        <span></span>
                        <button type="button" class="secondary-btn" onclick="app.closeKanbanTodoModal()">閉じる</button>
                        <button type="button" class="primary-btn" onclick="app.saveKanbanTodoFromModal()">保存</button>
                    </div>
                </div>
            </div>
        `);
        document.getElementById('kt-task-title')?.focus();
    }

    getKanbanTodoModalFontScale() {
        const saved = localStorage.getItem('kanbanTodoModalFontScale') || 'normal';
        return ['small', 'normal', 'large'].includes(saved) ? saved : 'normal';
    }

    setKanbanTodoModalFontScale(scale) {
        if (!['small', 'normal', 'large'].includes(scale)) scale = 'normal';
        localStorage.setItem('kanbanTodoModalFontScale', scale);

        const modal = document.querySelector('.kt-todo-modal');
        if (!modal) return;
        modal.classList.remove('kt-font-small', 'kt-font-normal', 'kt-font-large');
        modal.classList.add(`kt-font-${scale}`);
        modal.querySelectorAll('.kt-font-size-controls button').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${scale}'`));
        });
    }

    renderKanbanWorkerCheckboxes(selected = []) {
        const d = this.ensureKanbanTodoState();
        return `
            <label class="kt-worker-check all"><input type="checkbox" value="all" ${selected.includes('all') ? 'checked' : ''}> 全員</label>
            ${d.localTodoWorkers.map(w => `
                <label class="kt-worker-check"><input type="checkbox" value="${this.escapeHtml(w.id)}" ${selected.includes(w.id) ? 'checked' : ''}> ${this.escapeHtml(w.name)}</label>
            `).join('')}
        `;
    }

    saveKanbanTodoFromModal() {
        const d = this.ensureKanbanTodoState();
        const id = document.getElementById('kt-task-id')?.value || '';
        const title = (document.getElementById('kt-task-title')?.value || '').trim();
        if (!title) {
            document.getElementById('kt-task-title')?.focus();
            return;
        }
        const assigned = Array.from(document.querySelectorAll('.kt-worker-check input:checked')).map(el => el.value);
        const now = new Date().toISOString();
        let todo = id ? d.localTodos.find(item => item.id === id) : null;
        const wasNew = !todo;
        const previousStatus = todo?.status || '';
        const previousTodo = todo ? {
            title: todo.title || '',
            description: todo.description || '',
            priority: todo.priority || '',
            status: todo.status || '',
            deadlineDate: todo.deadlineDate || '',
            deadlineTime: todo.deadlineTime || '',
            assignedTo: [...(todo.assignedTo || [])]
        } : null;
        if (!todo) {
            todo = { id: `kt-${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: now, requestedBy: this.kanbanTodoWorkerId, rejectedBy: [] };
            d.localTodos.unshift(todo);
        }
        todo.title = title;
        todo.description = document.getElementById('kt-task-desc')?.value || '';
        todo.priority = document.getElementById('kt-task-priority')?.value || 'medium';
        todo.status = document.getElementById('kt-task-status')?.value || 'todo';
        todo.done = todo.status === 'done';
        if (todo.status === 'done' && previousStatus !== 'done') todo.completedAt = now;
        if (todo.status !== 'done') todo.completedAt = '';
        todo.deadlineDate = document.getElementById('kt-task-deadline-date')?.value || '';
        todo.deadlineTime = document.getElementById('kt-task-deadline-time')?.value || '';
        todo.deadline = todo.deadlineDate ? `${todo.deadlineDate}${todo.deadlineTime ? `T${todo.deadlineTime}` : ''}` : '';
        todo.isRecurring = !!document.getElementById('kt-task-recurring')?.checked;
        todo.isRequest = !!document.getElementById('kt-task-request')?.checked;
        todo.assignedTo = assigned;
        todo.updatedAt = now;
        const changedFields = [];
        if (!wasNew && previousTodo) {
            if (previousTodo.title !== todo.title) changedFields.push('タイトル');
            if (previousTodo.description !== todo.description) changedFields.push('詳細');
            if (previousTodo.priority !== todo.priority) changedFields.push('優先度');
            if (previousTodo.status !== todo.status) changedFields.push('状態');
            if (previousTodo.deadlineDate !== todo.deadlineDate || previousTodo.deadlineTime !== todo.deadlineTime) changedFields.push('期限');
            if (previousTodo.assignedTo.join(',') !== assigned.join(',')) changedFields.push('担当者');
        }
        if (!Array.isArray(todo.changeLog)) todo.changeLog = [];
        todo.changeLog.unshift({
            at: now,
            by: this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId),
            action: wasNew ? '作成' : '更新',
            fields: wasNew ? ['新規作成'] : changedFields
        });
        todo.changeLog = todo.changeLog.slice(0, 50);
        this.addKanbanTodoLog(`${wasNew ? '作成' : '更新'}: 「${todo.title}」`);
        if (previousStatus !== 'done' && todo.status === 'done' && !todo.shiftRequestFeedbackDone) {
            this.appendShiftTodoFeedback(todo, 'done');
            todo.shiftRequestFeedbackDone = true;
        }
        store.save();
        this.closeKanbanTodoModal();
        this.renderKanbanLocalTodos();
    }

    closeKanbanTodoModal() {
        document.getElementById('kt-todo-modal-overlay')?.remove();
        document.getElementById('kt-panel-overlay')?.remove();
    }

    deleteKanbanTodoFromModal() {
        const id = document.getElementById('kt-task-id')?.value || '';
        if (id) this.deleteKanbanTodo(id, { closeModal: true });
    }

    deleteKanbanTodo(id, options = {}) {
        if (!id) return;
        const d = this.ensureKanbanTodoState();
        const index = d.localTodos.findIndex(item => item.id === id);
        const todo = d.localTodos[index];
        if (!todo) return;
        const removedTodo = { ...todo, assignedTo: [...(todo.assignedTo || [])], rejectedBy: [...(todo.rejectedBy || [])], shiftRequestSource: todo.shiftRequestSource ? { ...todo.shiftRequestSource } : null };
        d.localTodos.splice(index, 1);
        this.addKanbanTodoLog(`削除: 「${todo.title || '無題'}」`);
        store.save();
        if (options.closeModal) this.closeKanbanTodoModal();
        this.updateTodoRequestCountBadge();
        this.renderKanbanLocalTodos();
        let restored = false;
        this.showUndoNotice(`${todo.title || '無題'}を削除しました`, () => {
            restored = true;
            const latest = this.ensureKanbanTodoState();
            if (!latest.localTodos.some(item => item.id === removedTodo.id)) {
                latest.localTodos.splice(Math.min(index, latest.localTodos.length), 0, removedTodo);
                this.addKanbanTodoLog(`削除を取り消し: 「${removedTodo.title || '無題'}」`);
                store.save();
                this.updateTodoRequestCountBadge();
                this.renderKanbanLocalTodos();
                setTimeout(() => this.highlightKanbanTodoCard(removedTodo.id), 80);
            }
        }, () => {
            if (!restored && removedTodo.isRequest && removedTodo.shiftRequestSource) {
                this.appendShiftTodoFeedback(removedTodo, 'deleted');
                store.save();
            }
        }, document.body, 'todo-undo');
    }

    highlightKanbanTodoCard(todoId) {
        const card = Array.from(document.querySelectorAll('.kt-task-card'))
            .find(el => (el.getAttribute('onclick') || '').includes(todoId));
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card?.classList.add('kt-task-card-jump');
        setTimeout(() => card?.classList.remove('kt-task-card-jump'), 2200);
    }

    archiveKanbanTodo(id) {
        const d = this.ensureKanbanTodoState();
        const todo = d.localTodos.find(item => item.id === id);
        if (!todo) return;
        todo.archived = true;
        todo.updatedAt = new Date().toISOString();
        this.addKanbanTodoLog(`履歴へ移動: 「${todo.title || '無題'}」`);
        store.save();
        this.updateTodoRequestCountBadge();
        this.renderKanbanLocalTodos();
    }

    rejectKanbanTodo(id) {
        const d = this.ensureKanbanTodoState();
        const todo = d.localTodos.find(item => item.id === id);
        if (!todo) return;
        if (!todo.rejectedBy.includes(this.kanbanTodoWorkerId)) todo.rejectedBy.push(this.kanbanTodoWorkerId);
        this.addKanbanTodoLog(`${this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId)}が依頼「${todo.title || '無題'}」を拒否`);
        store.save();
        this.closeKanbanTodoModal();
        this.renderKanbanLocalTodos();
    }

    insertKanbanTextAtCursor(text) {
        const textarea = document.getElementById('kt-task-desc');
        if (!textarea) return;
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? textarea.value.length;
        textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
    }

    insertKanbanDetailCheckmark() {
        this.insertKanbanTextAtCursor('✅ ');
    }

    insertKanbanDetailTimestamp() {
        const now = new Date();
        this.insertKanbanTextAtCursor(`【${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}】`);
    }

    insertKanbanDetailSeparator() {
        this.insertKanbanTextAtCursor('\n------------------------------\n');
    }

    insertKanbanDetailTemplate() {
        this.insertKanbanTextAtCursor('\n【状況】\n【確認】\n【対応】\n【結果】\n');
    }

    openKanbanWorkerPanel() {
        const d = this.ensureKanbanTodoState();
        this.openKanbanPanel('作業員管理', `
            <div class="kt-worker-panel">
                <div class="kt-worker-sync-note">
                    ToDoの作業員は連絡帳の「基幹社員」と同期しています。追加・名前変更・削除は連絡帳の人名管理から行ってください。
                    <button type="button" class="secondary-btn" onclick="app.closeKanbanTodoModal(); app.openShiftMemberTypeManageModal()">人名管理を開く</button>
                </div>
                ${d.localTodoWorkers.map(w => `
                    <div class="kt-worker-row">
                        <span>${this.escapeHtml(w.name)}</span>
                        <small>基幹社員</small>
                    </div>
                `).join('')}
            </div>
        `);
    }

    addKanbanTodoWorker() {
        alert('ToDoの作業員は連絡帳の基幹社員と同期しています。連絡帳の人名管理で追加してください。');
    }

    deleteKanbanTodoWorker(id) {
        alert('ToDoの作業員は連絡帳の基幹社員と同期しています。連絡帳の人名管理で削除またはサポート社員へ変更してください。');
    }

    openKanbanLogPanel() {
        const d = this.ensureKanbanTodoState();
        this.openKanbanPanel('ログ履歴', `
            <div class="kt-log-history">
                ${d.localTodoLogs.map(log => `<div><b>${this.escapeHtml(this.formatKanbanTodoTime(log.time))}</b><span>${this.escapeHtml(log.text || '')}</span></div>`).join('') || '<p class="kt-muted">ログはありません</p>'}
            </div>
        `);
    }

    toggleKanbanTodoHistory(open = true) {
        if (!open) return this.closeKanbanTodoModal();
        const d = this.ensureKanbanTodoState();
        const archived = d.localTodos.filter(todo => todo.archived);
        this.openKanbanPanel('過去履歴', `
            <div class="kt-history-list">
                ${archived.map(todo => `
                    <article class="kt-history-card" onclick="app.openKanbanTodoHistoryDetail('${this.escapeJs(todo.id)}')">
                        <b>${this.escapeHtml(todo.title || '無題')}</b>
                        <span>${this.escapeHtml(todo.deadlineDate || '期限なし')} / ${this.escapeHtml(this.getKanbanTodoWorkerName(todo.requestedBy || ''))}</span>
                        <button type="button" class="secondary-btn" onclick="event.stopPropagation(); app.restoreKanbanTodo('${this.escapeJs(todo.id)}')">戻す</button>
                    </article>
                `).join('') || '<p class="kt-muted">履歴はありません</p>'}
            </div>
        `);
    }

    openKanbanTodoHistoryDetail(id) {
        const d = this.ensureKanbanTodoState();
        const todo = d.localTodos.find(item => item.id === id);
        if (!todo) return;
        const priorityLabels = { low: '低', medium: '中', high: '高' };
        const statusLabels = { todo: '未着手', progress: '処理中', done: '完了' };
        const assignedTo = this.getKanbanTodoRequestTargetLabel(todo);
        const requestedBy = todo.requestedBy ? this.getKanbanTodoWorkerName(todo.requestedBy) : '未設定';
        const source = todo.shiftRequestSource || {};
        const sourceLabel = source.dateStr && source.shift
            ? `${source.dateStr} / ${this.getShiftNotebookLabel(source.shift).name}`
            : 'なし';
        this.openKanbanPanel('履歴詳細', `
            <div class="kt-history-detail">
                <div class="kt-history-detail-title">${this.escapeHtml(todo.title || '無題')}</div>
                <div class="kt-history-detail-grid">
                    <span>状態</span><b>${this.escapeHtml(statusLabels[todo.status] || todo.status || '未設定')}</b>
                    <span>優先度</span><b>${this.escapeHtml(priorityLabels[todo.priority] || '低')}</b>
                    <span>期限</span><b>${this.escapeHtml(todo.deadlineDate || '期限なし')}${todo.deadlineTime ? ` ${this.escapeHtml(todo.deadlineTime)}` : ''}</b>
                    <span>依頼先</span><b>${this.escapeHtml(assignedTo)}</b>
                    <span>依頼者</span><b>${this.escapeHtml(requestedBy)}</b>
                    <span>完了日時</span><b>${this.escapeHtml(this.formatKanbanTodoTime(todo.completedAt) || '-')}</b>
                    <span>履歴移動</span><b>${this.escapeHtml(this.formatKanbanTodoTime(todo.archivedAt) || '-')}</b>
                    <span>依頼元</span><b>${this.escapeHtml(sourceLabel)}</b>
                </div>
                ${todo.description ? `<div class="kt-history-detail-desc">${this.escapeHtml(todo.description)}</div>` : '<div class="kt-history-detail-desc kt-muted">詳細文はありません</div>'}
                <div class="kt-history-detail-actions">
                    <button type="button" class="secondary-btn" onclick="app.toggleKanbanTodoHistory(true)">一覧へ戻る</button>
                    ${source.dateStr && source.shift ? `<button type="button" class="secondary-btn" onclick="app.openShiftNotebookFromTodoCard('${this.escapeJs(todo.id)}')"><i class="fa-solid fa-calendar-days"></i> 依頼元へ</button>` : ''}
                    <button type="button" class="primary-btn" onclick="app.restoreKanbanTodo('${this.escapeJs(todo.id)}')">戻す</button>
                </div>
            </div>
        `);
    }

    restoreKanbanTodo(id) {
        const d = this.ensureKanbanTodoState();
        const todo = d.localTodos.find(item => item.id === id);
        if (!todo) return;
        todo.archived = false;
        todo.status = 'done';
        if (!todo.completedAt) todo.completedAt = new Date().toISOString();
        todo.updatedAt = new Date().toISOString();
        this.addKanbanTodoLog(`履歴から復元: 「${todo.title || '無題'}」`);
        store.save();
        this.updateTodoRequestCountBadge();
        this.toggleKanbanTodoHistory(true);
        this.renderKanbanLocalTodos();
    }

    openKanbanPanel(title, bodyHtml) {
        document.getElementById('kt-panel-overlay')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="kt-panel-overlay" class="kt-modal-overlay active" onclick="if(event.target === this) app.closeKanbanTodoModal()">
                <div class="kt-modal kt-panel">
                    <div class="kt-modal-header">
                        <h2>${this.escapeHtml(title)}</h2>
                        <button type="button" onclick="app.closeKanbanTodoModal()"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    ${bodyHtml}
                </div>
            </div>
        `);
    }

    ensureLocalTodos() {
        if (!store.activeData.localTodos) store.activeData.localTodos = [];
        return store.activeData.localTodos;
    }

    setTodoFilter(filter) {
        this.todoFilter = filter || 'active';
        this.renderLocalTodos();
    }

    addLocalTodo() {
        const titleInput = document.getElementById('todo-title-input');
        const dateInput = document.getElementById('todo-date-input');
        const priorityInput = document.getElementById('todo-priority-input');
        const title = (titleInput?.value || '').trim();
        if (!title) {
            titleInput?.focus();
            return;
        }
        const todos = this.ensureLocalTodos();
        todos.unshift({
            id: `todo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title,
            dueDate: dateInput?.value || '',
            priority: priorityInput?.value || 'normal',
            done: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        if (titleInput) titleInput.value = '';
        store.save();
        this.renderLocalTodos();
        titleInput?.focus();
    }

    toggleLocalTodo(id) {
        const todo = this.ensureLocalTodos().find(item => item.id === id);
        if (!todo) return;
        todo.done = !todo.done;
        todo.updatedAt = new Date().toISOString();
        store.save();
        this.renderLocalTodos();
    }

    editLocalTodo(id) {
        const todo = this.ensureLocalTodos().find(item => item.id === id);
        if (!todo) return;
        const title = prompt('ToDoの内容を変更', todo.title || '');
        if (title === null) return;
        const trimmed = title.trim();
        if (!trimmed) return;
        todo.title = trimmed;
        todo.updatedAt = new Date().toISOString();
        store.save();
        this.renderLocalTodos();
    }

    deleteLocalTodo(id) {
        const todos = this.ensureLocalTodos();
        const todo = todos.find(item => item.id === id);
        if (!todo) return;
        store.activeData.localTodos = todos.filter(item => item.id !== id);
        store.save();
        this.renderLocalTodos();
        this.showUndoNotice(`ToDo「${todo.title || '無題'}」を削除しました`, () => {
            store.activeData.localTodos.push(todo);
            store.save();
            this.renderLocalTodos();
        }, null, document.body, 'todo-undo');
    }

    updateLocalTodoField(id, field, value) {
        const todo = this.ensureLocalTodos().find(item => item.id === id);
        if (!todo || !['dueDate', 'priority'].includes(field)) return;
        todo[field] = value || '';
        todo.updatedAt = new Date().toISOString();
        store.save();
        this.renderLocalTodos();
    }

    renderLocalTodos() {
        const list = document.getElementById('todo-list');
        if (!list) return;
        const filter = this.todoFilter || 'active';
        this.todoFilter = filter;
        ['active', 'all', 'done'].forEach(key => {
            document.getElementById(`todo-filter-${key}`)?.classList.toggle('active', filter === key);
        });
        const query = MaintenanceStore.toHalfWidthLower(document.getElementById('todo-search-input')?.value || '');
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const priorityLabels = { high: '高', normal: '通常', low: '低' };
        const todos = this.ensureLocalTodos()
            .filter(todo => filter === 'all' || (filter === 'done' ? todo.done : !todo.done))
            .filter(todo => !query || MaintenanceStore.toHalfWidthLower(`${todo.title || ''} ${todo.dueDate || ''} ${priorityLabels[todo.priority] || ''}`).includes(query))
            .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99') || (b.createdAt || '').localeCompare(a.createdAt || ''));

        if (todos.length === 0) {
            list.innerHTML = `
                <div class="todo-empty">
                    <i class="fa-solid fa-list-check"></i>
                    <div>${query ? '該当するToDoはありません' : 'ToDoはありません'}</div>
                </div>
            `;
            return;
        }

        list.innerHTML = todos.map(todo => {
            const overdue = !!todo.dueDate && todo.dueDate < todayStr && !todo.done;
            return `
                <article class="todo-item ${todo.done ? 'done' : ''} ${overdue ? 'overdue' : ''}">
                    <button type="button" class="todo-check" onclick="app.toggleLocalTodo('${this.escapeJs(todo.id)}')" title="${todo.done ? '未完了に戻す' : '完了にする'}">
                        <i class="fa-solid ${todo.done ? 'fa-check' : 'fa-circle'}"></i>
                    </button>
                    <div class="todo-main">
                        <div class="todo-title">${this.escapeHtml(todo.title || '')}</div>
                        <div class="todo-meta">
                            <span class="todo-priority ${todo.priority || 'normal'}">${priorityLabels[todo.priority] || '通常'}</span>
                            <label>期限 <input type="date" value="${this.escapeHtml(todo.dueDate || '')}" onchange="app.updateLocalTodoField('${this.escapeJs(todo.id)}', 'dueDate', this.value)"></label>
                            ${overdue ? '<span class="todo-overdue">期限超過</span>' : ''}
                        </div>
                    </div>
                    <select class="todo-priority-select" onchange="app.updateLocalTodoField('${this.escapeJs(todo.id)}', 'priority', this.value)">
                        <option value="high" ${todo.priority === 'high' ? 'selected' : ''}>高</option>
                        <option value="normal" ${!todo.priority || todo.priority === 'normal' ? 'selected' : ''}>通常</option>
                        <option value="low" ${todo.priority === 'low' ? 'selected' : ''}>低</option>
                    </select>
                    <button type="button" class="icon-btn" onclick="app.editLocalTodo('${this.escapeJs(todo.id)}')" title="編集"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="icon-btn todo-delete" onclick="app.deleteLocalTodo('${this.escapeJs(todo.id)}')" title="削除"><i class="fa-solid fa-trash-can"></i></button>
                </article>
            `;
        }).join('');
    }

    // --- Calendar Implementation ---
    setupCalendarControls() {
        const prevBtn = document.getElementById('cal-prev');
        const nextBtn = document.getElementById('cal-next');
        const compactBtn = document.getElementById('calendar-compact-toggle');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.renderCalendar();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.renderCalendar();
            });
        }

        if (compactBtn) {
            compactBtn.classList.toggle('active', this.calendarCompactMode);
            compactBtn.setAttribute('aria-pressed', String(this.calendarCompactMode));
            compactBtn.addEventListener('click', () => {
                this.calendarCompactMode = !this.calendarCompactMode;
                localStorage.setItem('calendar_compact_mode', String(this.calendarCompactMode));
                compactBtn.classList.toggle('active', this.calendarCompactMode);
                compactBtn.setAttribute('aria-pressed', String(this.calendarCompactMode));
                this.renderCalendar();
            });
        }
    }

    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const monthDisplay = document.getElementById('current-month-display');
        if (monthDisplay) {
            monthDisplay.textContent = `${year}年 ${month + 1}月`;
        }

        const calContainer = document.getElementById('calendar-days');
        if (!calContainer) return;

        // カレンダーのラインフィルタ選択肢を動的生成 (初回のみ)
        const calLineEl = document.getElementById('cal-filter-line');
        if (calLineEl && calLineEl.options.length <= 1) {
            const lineSet = new Set();
            store.getMachines(true).forEach(m => { if (m.lineNo) lineSet.add(m.lineNo); });
            store.activeData.history.forEach(h => { if (h.lineNo) lineSet.add(h.lineNo); });
            Array.from(lineSet).sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric:true})).forEach(l => {
                const opt = document.createElement('option');
                opt.value = l;
                opt.textContent = this.getLineLabel(l);
                calLineEl.appendChild(opt);
            });
        }

        calContainer.innerHTML = '';

        // Get first day of month (0 = Sunday)
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        
        // Blank cells before first day
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'day-cell empty';
            calContainer.appendChild(emptyCell);
        }

        // Fill days
        for (let d = 1; d <= lastDate; d++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const [y_c, m_c, d_c] = dateStr.split('-').map(Number);
            const targetDate = new Date(y_c, m_c - 1, d_c);
            targetDate.setHours(0,0,0,0);
            
            // Highlight today
            const today = new Date();
            today.setHours(0,0,0,0);
            if (today.getTime() === targetDate.getTime()) {
                cell.classList.add('today');
            }

            // Detect Weekend
            const dayOfWeek = (firstDay + d - 1) % 7;
            if (dayOfWeek === 0) cell.classList.add('sun');
            if (dayOfWeek === 6) cell.classList.add('sat');

            cell.innerHTML = `
                <div class="day-top-row">
                    <span class="day-number">${d}</span>
                    <div class="shift-note-stamps" aria-label="連絡帳">
                        <button type="button" class="shift-note-stamp early" title="早番の連絡帳" data-shift="early">早</button>
                        <button type="button" class="shift-note-stamp late" title="遅番の連絡帳" data-shift="late">遅</button>
                        <button type="button" class="shift-note-stamp night" title="深夜の連絡帳" data-shift="night">深</button>
                    </div>
                </div>
                <span class="add-sudden-btn" title="突発を登録">+登録</span>
                <div class="events-container"></div>
            `;
            
            cell.onclick = () => this.openDayQuickMenu(dateStr);

            const addBtn = cell.querySelector('.add-sudden-btn');
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openSuddenRecordModal(dateStr);
            });

            cell.querySelectorAll('.shift-note-stamp').forEach(btn => {
                const shiftData = store.activeData.shiftNotebooks?.[dateStr]?.[btn.dataset.shift];
                const shiftRows = Array.isArray(shiftData) ? shiftData : (shiftData?.rows || []);
                const shiftMembers = Array.isArray(shiftData?.members) ? shiftData.members : [];
                if (shiftRows.length > 0 || shiftMembers.length > 0) btn.classList.add('has-note');
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openShiftNotebookModal(dateStr, btn.dataset.shift);
                });
            });

            // Drag & Drop for cell (Drop Target)
            cell.ondragover = (e) => {
                e.preventDefault();
                if (!cell.classList.contains('empty')) cell.classList.add('drag-over');
            };
            cell.ondragleave = () => cell.classList.remove('drag-over');
            cell.ondrop = (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                try {
                    const data = JSON.parse(e.dataTransfer.getData('h-task') || '{}');
                    if (data.taskId) this.handleTaskDrop(data.taskId, data.sourceDate, dateStr);
                } catch(err) { console.error('Drop error', err); }
            };

            const eventsContainer = cell.querySelector('.events-container');
            const dateHistory = this.getHistoryForDate(dateStr).filter(h => this.matchesCalendarLineFilter(h));
            const dateScheduled = this.getScheduledTasksForDate(dateStr).filter(s => this.matchesCalendarLineFilter(s));
            const memoData = store.activeData.memos || {};
            const memoValue = memoData[dateStr];

            if (this.calendarCompactMode) {
                eventsContainer.classList.add('compact-events');
                this.renderCompactCalendarItems(eventsContainer, dateStr, dateHistory, dateScheduled, memoValue, targetDate, today);
                calContainer.appendChild(cell);
                continue;
            }

            // 1. History (Completed)
            dateHistory.forEach(h => {
                // カレンダーのラインフィルタ
                if (this.calLineFilter && this.calLineFilter !== 'all') {
                    const mach = store.getMachines(true).find(m => m.id === h.machineId);
                    const l = h.lineNo || mach?.lineNo;
                    if (String(l) !== String(this.calLineFilter)) return;
                }

                const badge = document.createElement('div');
                const isSudden = !h.taskId;
                badge.className = `event-badge ${isSudden ? 'sudden' : 'success'}`;
                
                const machine = store.getMachines(true).find(m => m.id === h.machineId);
                const lineNo = h.lineNo || machine?.lineNo;
                const machineCategory = h.machineCategory || machine?.category || '';
                const categoryChar = machineCategory ? machineCategory.charAt(0) : '';
                
                let stampText = '';
                const lineStampLabel = lineNo ? this.getLineStampLabel(lineNo) : '';
                if (lineStampLabel && categoryChar) stampText = `${lineStampLabel}-${categoryChar}`;
                else if (lineStampLabel) stampText = lineStampLabel;
                else if (categoryChar) stampText = categoryChar;

                const colors = lineNo ? this.getLineColors(lineNo) : { bg: '#facc15', text: '#dc2626' };
                const combinedStamp = stampText ? `<span style="display:inline-flex; align-items:center; justify-content:center; background:${colors.bg}; color:${colors.text}; min-width:24px; padding:0 4px; height:18px; border-radius:3px; font-weight:950; font-size:0.75rem; margin-right:4px; border:1px solid ${colors.bg}; flex-shrink:0; vertical-align:middle;">${stampText}</span>` : '';
                
                const modelOrName = MaintenanceApp.isModelBlank(machine?.model) ? (machine?.name || '') : (machine?.model || '');
                const modelStr = modelOrName ? `${modelOrName}: ` : '';
                
                const displayText = this.getHistoryDisplayText(h);
                
                const workers = Array.isArray(h.workers) ? h.workers : (typeof h.workers === 'string' ? h.workers.split(',').map(s => s.trim()) : []);
                const workerText = workers.length > 0 ? ` [${workers.join(', ')}]` : '';
                badge.innerHTML = `<span style="text-overflow:ellipsis; overflow:hidden; display:flex; align-items:center;">${combinedStamp}${modelStr}${displayText}${workerText}</span>`;
                
                // Done Stamp (Always Periodic if h.taskId exists)
                if (h.taskId) {
                    const doneStamp = document.createElement('div');
                    doneStamp.className = 'stamp-done';
                    doneStamp.textContent = '完';
                    badge.appendChild(doneStamp);
                }

                // Dokatei Stamp (Top-left)
                if (h.isDokatei) {
                    const dokaStamp = document.createElement('div');
                    dokaStamp.className = 'stamp-dokatei';
                    dokaStamp.textContent = 'ドカ停';
                    badge.appendChild(dokaStamp);
                }

                badge.title = 'クリックして編集';
                badge.onclick = (e) => {
                    e.stopPropagation();
                    this.openHistoryEditForm(h.id);
                };
                eventsContainer.appendChild(badge);
            });

            // 2. Scheduled (Planned)
            dateScheduled.forEach(s => {
                const badge = document.createElement('div');
                badge.className = 'event-badge success';
                badge.draggable = true;
                badge.ondragstart = (e) => {
                    e.dataTransfer.setData('h-task', JSON.stringify({ taskId: s.id, sourceDate: dateStr }));
                    badge.classList.add('dragging');
                };
                badge.ondragend = () => badge.classList.remove('dragging');

                const machine = store.getMachines(true).find(m => m.id === s.machineId);
                const lineNo = machine?.lineNo;
                const machineCategory = machine?.category || '';
                const categoryChar = machineCategory ? machineCategory.charAt(0) : '';

                let stampText = '';
                const lineStampLabel = lineNo ? this.getLineStampLabel(lineNo) : '';
                if (lineStampLabel && categoryChar) stampText = `${lineStampLabel}-${categoryChar}`;
                else if (lineStampLabel) stampText = lineStampLabel;
                else if (categoryChar) stampText = categoryChar;

                const colors = lineNo ? this.getLineColors(lineNo) : { bg: '#facc15', text: '#dc2626' };
                const combinedStamp = stampText ? `<span style="display:inline-flex; align-items:center; justify-content:center; background:${colors.bg}; color:${colors.text}; min-width:24px; padding:0 4px; height:18px; border-radius:3px; font-weight:950; font-size:0.75rem; margin-right:4px; border:1px solid ${colors.bg}; flex-shrink:0; vertical-align:middle;">${stampText}</span>` : '';
                const modelOrName = MaintenanceApp.isModelBlank(machine?.model) ? (machine?.name || '') : (machine?.model || '');
                const modelStr = modelOrName ? `${MaintenanceApp.toHalfWidthLower(modelOrName)}: ` : '';
                badge.innerHTML = `<span style="display:flex; align-items:center;">${combinedStamp}${modelStr}${s.content}</span>`;

                // Unfinished Stamp (If past today)
                if (targetDate < today) {
                    const unfStamp = document.createElement('div');
                    unfStamp.className = 'stamp-unfinished';
                    unfStamp.textContent = '未完';
                    badge.appendChild(unfStamp);
                }
                badge.title = 'クリックして完了報告';
                badge.onclick = (e) => {
                    e.stopPropagation();
                    this.openCompletionForm(s.id, dateStr);
                };
                eventsContainer.appendChild(badge);
            });

            // 3. Memo (Static text)
            if (memoValue) {
                const memoBox = document.createElement('div');
                memoBox.className = 'calendar-day-memo';
                memoBox.innerHTML = `
                    <i class="fa-solid fa-note-sticky" style="margin-right:4px; opacity:0.7;"></i>
                    ${memoValue.replace(/\n/g, '<br>')}
                    <i class="fa-solid fa-xmark calendar-day-memo-delete" title="メモを削除" onclick="event.stopPropagation(); app.deleteDayMemo('${dateStr}');"></i>
                `;
                eventsContainer.appendChild(memoBox);
            }
            
            calContainer.appendChild(cell);
        }

        this.updateCalendarStats();
        this.updateTelop();
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

    shiftNoteTextToHtml(text = '') {
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    }

    stripShiftNoteHtml(html = '') {
        const div = document.createElement('div');
        div.innerHTML = this.sanitizeShiftNoteHtml(html);
        return (div.innerText || div.textContent || '').replace(/\u200B/g, '');
    }

    sanitizeShiftNoteHtml(html = '') {
        const template = document.createElement('template');
        template.innerHTML = String(html || '');
        const allowedColors = new Set(['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed', '#0f172a']);
        const allowedSizes = new Set(['0.9rem', '1.05rem', '1.2rem', '1.4rem']); // Kept for backwards compatibility if needed
        const allowedFonts = new Map([
            ['inherit', 'inherit'],
            ['sans-serif', 'sans-serif'],
            ['serif', 'serif'],
            ['monospace', 'monospace'],
            ['noto sans jp', '"Noto Sans JP", sans-serif'],
            ['noto serif jp', '"Noto Serif JP", serif'],
            ['yu gothic', '"Yu Gothic", "YuGothic", sans-serif'],
            ['yugothic', '"Yu Gothic", "YuGothic", sans-serif'],
            ['meiryo', '"Meiryo", sans-serif'],
            ['ms gothic', '"MS Gothic", monospace'],
            ['ms pgothic', '"MS PGothic", sans-serif'],
            ['ms mincho', '"MS Mincho", serif'],
            ['ms pmincho', '"MS PMincho", serif']
        ]);
        const normalizeFont = (font = '') => {
            const raw = font.trim().replace(/['"]/g, '').replace(/\s*,\s*/g, ', ');
            if (!raw) return '';
            const first = raw.split(',')[0].trim().toLowerCase();
            return allowedFonts.get(first) || allowedFonts.get(raw.toLowerCase()) || '';
        };
        const normalizeColor = (color = '') => {
            const raw = color.trim().toLowerCase();
            if (raw.startsWith('#')) return raw;
            const rgb = raw.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/);
            if (!rgb) return '';
            return '#' + rgb.slice(1).map(v => Math.max(0, Math.min(255, Number(v))).toString(16).padStart(2, '0')).join('');
        };
        const cleanNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                let text = node.textContent || '';
                text = text.replace(/\u200B/g, '');
                text = text.replace(/ {2}/g, ' \u00A0');
                text = text.replace(/\t/g, '\u00A0\u00A0\u00A0\u00A0');
                return document.createTextNode(text);
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return document.createTextNode('');

            const tag = node.tagName.toLowerCase();
            if (tag === 'br') return document.createElement('br');
            const classAttr = node.getAttribute('class') || '';
            if (tag === 'span' && classAttr.split(/\s+/).includes('shift-note-member-stamp')) {
                const span = document.createElement('span');
                span.className = 'shift-note-member-stamp';
                span.setAttribute('contenteditable', 'false');
                span.textContent = (node.textContent || '').trim();
                return span;
            }
            if (tag === 'span' && classAttr.split(/\s+/).includes('shift-note-shift-stamp')) {
                const classes = classAttr.split(/\s+/);
                const shiftClass = ['early', 'late', 'night'].find(key => classes.includes(key)) || '';
                const span = document.createElement('span');
                span.className = `shift-note-shift-stamp ${shiftClass}`.trim();
                span.setAttribute('contenteditable', 'false');
                span.textContent = (node.textContent || '').trim();
                return span;
            }
            if (tag === 'span' && classAttr.split(/\s+/).includes('shift-todo-feedback')) {
                const classes = classAttr.split(/\s+/);
                const stateClass = ['request', 'progress', 'done', 'deleted'].find(key => classes.includes(key)) || 'request';
                const span = document.createElement('span');
                span.className = `shift-todo-feedback ${stateClass}`;
                const todoId = node.getAttribute('data-todo-id') || '';
                const workerId = node.getAttribute('data-worker-id') || '';
                if (todoId) span.setAttribute('data-todo-id', todoId);
                if (workerId) {
                    span.setAttribute('data-worker-id', workerId);
                    span.setAttribute('title', '対象者のToDoリストへ移動');
                    span.setAttribute('onclick', 'app.openKanbanTodoFromShiftStamp(this)');
                }
                span.setAttribute('contenteditable', 'false');
                span.textContent = (node.textContent || '').trim();
                return span;
            }
            if (tag === 'span' && classAttr.split(/\s+/).includes('shift-todo-arrow')) {
                const span = document.createElement('span');
                span.className = 'shift-todo-arrow';
                const todoId = node.getAttribute('data-todo-id') || '';
                if (todoId) span.setAttribute('data-todo-id', todoId);
                span.setAttribute('contenteditable', 'false');
                span.textContent = '→';
                return span;
            }
            
            let indentStr = '';
            const style = node.getAttribute('style') || '';
            const marginMatch = style.match(/(?:margin-left|padding-left|text-indent)\s*:\s*([\d.]+)(px|em|rem|pt)/i);
            if (marginMatch) {
                const val = parseFloat(marginMatch[1]);
                const unit = marginMatch[2].toLowerCase();
                let spaces = 0;
                if (unit === 'px') spaces = Math.round(val / 8);
                else if (unit === 'em' || unit === 'rem') spaces = Math.round(val * 2);
                else if (unit === 'pt') spaces = Math.round(val / 6);
                if (spaces > 0 && spaces < 50) {
                    indentStr = '\u00A0'.repeat(spaces);
                }
            }

            const fragment = document.createDocumentFragment();
            if (indentStr) {
                fragment.appendChild(document.createTextNode(indentStr));
            }
            Array.from(node.childNodes).forEach(child => fragment.appendChild(cleanNode(child)));

            if (tag === 'td' || tag === 'th') {
                fragment.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0'));
            }

            const newlineTags = new Set(['div', 'p', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'address', 'figure', 'dd', 'dt']);
            if (newlineTags.has(tag)) {
                const span = document.createElement('span');
                if (tag === 'li') span.appendChild(document.createTextNode('\u2002\u2022\u2002'));
                span.appendChild(fragment);
                span.appendChild(document.createElement('br'));
                return span;
            }

            if (tag === 'span' || tag === 'font' || tag === 'b' || tag === 'strong' || tag === 'code') {
                const span = document.createElement('span');
                const style = node.getAttribute('style') || '';
                const colorMatch = style.match(/color:\s*(#[0-9a-fA-F]{6}|rgb\([^)]+\))/);
                const sizeMatch = style.match(/font-size:\s*([^;]+)/);
                const fontMatch = style.match(/font-family:\s*([^;]+)/);
                const weightMatch = style.match(/font-weight:\s*(bold|700|800|900|950)/);
                const color = normalizeColor(colorMatch?.[1] || node.getAttribute('color') || '');
                if (color && allowedColors.has(color)) span.style.color = color;
                const fontSize = sizeMatch?.[1]?.trim();
                if (fontSize && (/^\d+(\.\d+)?(px|rem|em|pt)$/.test(fontSize) || allowedSizes.has(fontSize))) span.style.fontSize = fontSize;
                const fontFamily = normalizeFont(fontMatch?.[1] || node.getAttribute('face') || '');
                if (fontFamily && fontFamily !== 'inherit') span.style.fontFamily = fontFamily;
                if (weightMatch || tag === 'b' || tag === 'strong') span.style.fontWeight = '950';
                span.appendChild(fragment);
                return span;
            }

            return fragment;
        };
        const cleaned = document.createElement('div');
        Array.from(template.content.childNodes).forEach(node => cleaned.appendChild(cleanNode(node)));
        return cleaned.innerHTML;
    }

    saveShiftNoteSelection(editor) {
        const selection = window.getSelection();
        if (!editor || !selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) {
            editor._savedRange = range.cloneRange();
        }
    }

    restoreShiftNoteSelection(editor) {
        if (!editor?._savedRange) return;
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(editor._savedRange);
    }

    insertShiftNoteNodeAtCursor(editor, node) {
        if (!editor) return;
        editor.focus();

        const selection = window.getSelection();
        let range = editor._savedRange?.cloneRange();
        if (!range || !editor.contains(range.commonAncestorContainer)) {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
        }

        selection.removeAllRanges();
        selection.addRange(range);
        range.deleteContents();
        range.insertNode(node);

        const afterRange = document.createRange();
        afterRange.setStartAfter(node);
        afterRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(afterRange);
        editor._savedRange = afterRange.cloneRange();
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        this.autoSaveShiftNotebook(true);
    }

    insertShiftNoteCheckMark(button) {
        const row = button?.closest('.shift-notebook-row');
        const editor = row?.querySelector('.shift-note-text');
        this.insertShiftNoteNodeAtCursor(editor, document.createTextNode('✅'));
    }

    loadShiftNoteFormats() {
        const empty = { color: null, size: null, font: null };
        try {
            const saved = JSON.parse(localStorage.getItem('shift_note_active_formats') || 'null');
            if (!saved || typeof saved !== 'object') return empty;
            return {
                color: typeof saved.color === 'string' ? saved.color : null,
                size: typeof saved.size === 'string' ? this.normalizeShiftNoteSize(saved.size) : null,
                font: typeof saved.font === 'string' ? saved.font : null
            };
        } catch (e) {
            return empty;
        }
    }

    saveShiftNoteFormats() {
        try {
            localStorage.setItem('shift_note_active_formats', JSON.stringify(this._activeShiftNoteFormats || { color: null, size: null, font: null }));
        } catch (e) {}
    }

    insertShiftNoteShiftStamp(button, shiftKey) {
        const row = button?.closest('.shift-notebook-row');
        const editor = row?.querySelector('.shift-note-text');
        const labels = { early: '早', late: '遅', night: '深' };
        const label = labels[shiftKey];
        if (!editor || !label) return;
        const stamp = document.createElement('span');
        stamp.className = `shift-note-shift-stamp ${shiftKey}`;
        stamp.textContent = label;
        stamp.setAttribute('contenteditable', 'false');
        this.insertShiftNoteNodeAtCursor(editor, stamp);
    }

    getShiftNoteInlineStampElement(target) {
        return target?.closest?.('.shift-note-member-stamp, .shift-note-shift-stamp') || null;
    }

    clearShiftNoteInlineStampSelection(scope = document) {
        scope.querySelectorAll?.('.shift-note-inline-stamp-selected')
            .forEach(stamp => stamp.classList.remove('shift-note-inline-stamp-selected'));
    }

    selectShiftNoteInlineStamp(stamp, editor) {
        if (!stamp || !editor?.contains(stamp)) return;
        this.clearShiftNoteInlineStampSelection(editor);
        stamp.classList.add('shift-note-inline-stamp-selected');
        editor.focus();
        const range = document.createRange();
        range.selectNode(stamp);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        editor._savedRange = range.cloneRange();
    }

    isShiftNoteInlineStampCloseClick(event, stamp) {
        if (!event || !stamp?.classList?.contains('shift-note-inline-stamp-selected')) return false;
        const rect = stamp.getBoundingClientRect();
        return event.clientX >= rect.right - 10 && event.clientX <= rect.right + 10 && event.clientY >= rect.top - 10 && event.clientY <= rect.top + 10;
    }

    removeShiftNoteInlineStamp(stamp, editor) {
        if (!stamp || !editor?.contains(stamp)) return false;
        const afterRange = document.createRange();
        const next = stamp.nextSibling;
        const parent = stamp.parentNode;
        stamp.remove();
        if (next) afterRange.setStartBefore(next);
        else if (parent) afterRange.setStart(parent, parent.childNodes.length);
        afterRange.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(afterRange);
        editor._savedRange = afterRange.cloneRange();
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        this.autoSaveShiftNotebook(true);
        return true;
    }

    removeSelectedShiftNoteInlineStamp(editor) {
        const stamp = editor?.querySelector('.shift-note-inline-stamp-selected');
        if (!stamp) return false;
        return this.removeShiftNoteInlineStamp(stamp, editor);
    }

    appendShiftNoteMemberStamp(editor, memberName) {
        if (!editor || !memberName) return;
        editor.focus();
        const text = this.stripShiftNoteHtml(editor.innerHTML).trim();
        const prefix = text ? ' ' : '';
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        const fragment = document.createDocumentFragment();
        if (prefix) fragment.appendChild(document.createTextNode(prefix));
        const stamp = document.createElement('span');
        stamp.className = 'shift-note-member-stamp';
        stamp.textContent = memberName;
        stamp.setAttribute('contenteditable', 'false');
        fragment.appendChild(stamp);
        range.insertNode(fragment);
        const afterRange = document.createRange();
        afterRange.setStartAfter(stamp);
        afterRange.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(afterRange);
        editor._savedRange = afterRange.cloneRange();
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        this.autoSaveShiftNotebook(true);
    }

    rememberShiftNoteSelection(control) {
        const row = control?.closest('.shift-notebook-row');
        const editor = row?.querySelector('.shift-note-text');
        if (!editor) return;
        this._activeShiftNoteEditor = editor;
        this.saveShiftNoteSelection(editor);
    }

    restoreShiftNoteSelectionFromControl(control) {
        const editor = control?.closest('.shift-notebook-row')?.querySelector('.shift-note-text') || this._activeShiftNoteEditor;
        if (!editor?._savedRange) return;
        setTimeout(() => this.restoreShiftNoteSelection(editor), 0);
    }

    toggleShiftNoteSizeMenu(button) {
        const menu = button?.closest('.shift-format-menu');
        if (!menu) return;
        const willOpen = !menu.classList.contains('open');
        this.closeShiftNoteFormatMenus();
        if (willOpen) {
            this.syncShiftNoteFormatControls(menu);
            menu.classList.add('open');
        }
    }

    closeShiftNoteSizeMenus() {
        this.closeShiftNoteFormatMenus();
    }

    toggleShiftNoteColorMenu(button) {
        const menu = button?.closest('.shift-format-menu');
        if (!menu) return;
        const willOpen = !menu.classList.contains('open');
        this.closeShiftNoteFormatMenus();
        if (willOpen) {
            this.syncShiftNoteFormatControls(menu);
            menu.classList.add('open');
        }
    }

    closeShiftNoteFormatMenus(options = {}) {
        let { commit = false } = options;
        if (this._skipShiftNoteFormatCommitOnce) {
            commit = false;
            this._skipShiftNoteFormatCommitOnce = false;
        }
        document.querySelectorAll('.shift-format-menu.open, .shift-color-menu.open').forEach(menu => {
            if (commit) this.commitShiftNotePendingFormat(menu);
            menu.classList.remove('open');
        });
    }

    applyShiftNoteFormatMenu(control) {
        const menu = control?.closest('.shift-format-menu');
        if (!menu) return;
        this.rememberShiftNoteSelection(control);
        const target = this.commitShiftNotePendingFormat(menu);
        this.showShiftNoteFormatFeedback(menu, target === 'selection' ? '選択範囲へ反映しました' : '次入力へ反映しました');
        setTimeout(() => menu.classList.remove('open'), 520);
    }

    applyShiftNoteFormatMenuToAll(control) {
        const menu = control?.closest('.shift-format-menu');
        if (!menu) return;
        if (!menu._pendingShiftNoteFormats) menu._pendingShiftNoteFormats = { ...(this._activeShiftNoteFormats || {}) };
        const pending = { ...menu._pendingShiftNoteFormats };
        const reset = !!menu._pendingShiftNoteReset;
        this._activeShiftNoteFormats = pending;
        this.saveShiftNoteFormats();
        let count = 0;
        document.querySelectorAll('#shift-notebook-rows .shift-note-text').forEach(editor => {
            if (this.applyShiftNoteFormatsToWholeEditor(editor, pending, reset)) count += 1;
        });
        document.querySelectorAll('.shift-notebook-row').forEach(r => this._updateShiftNoteFormatIndicator(r));
        menu._pendingShiftNoteFormats = null;
        menu._pendingShiftNoteReset = false;
        this.showShiftNoteFormatFeedback(menu, `${count}行へ反映しました`);
        this.scheduleShiftNotebookAutoSave();
        setTimeout(() => menu.classList.remove('open'), 650);
    }

    cancelShiftNoteFormatMenu(control) {
        const menu = control?.closest('.shift-format-menu');
        if (!menu) return;
        menu._pendingShiftNoteFormats = null;
        menu._pendingShiftNoteReset = false;
        menu.classList.remove('open');
    }

    resetShiftNoteFormats() {
        this._activeShiftNoteFormats = { color: null, size: null, font: null };
        this.saveShiftNoteFormats();
        this._activeShiftNoteEditor = null;
        document.querySelectorAll('.shift-notebook-row').forEach(r => this._updateShiftNoteFormatIndicator(r));
    }

    syncShiftNoteFormatControls(menu) {
        const f = this._activeShiftNoteFormats || {};
        menu._pendingShiftNoteFormats = { ...f };
        menu._pendingShiftNoteReset = false;
        this.updateShiftNotePendingFontState(menu);
        const sizeInput = menu?.querySelector('.shift-font-size-input');
        if (sizeInput) sizeInput.value = f.size ? String(f.size).replace('px', '') : (sizeInput.value || '20');
        this.updateShiftNotePendingColorState(menu);
        this.updateShiftNotePendingSummary(menu);
    }

    stageShiftNoteFormat(control, type, value = '') {
        const menu = control?.closest('.shift-format-menu');
        if (!menu) return;
        if (!menu._pendingShiftNoteFormats) menu._pendingShiftNoteFormats = { ...(this._activeShiftNoteFormats || {}) };
        if (type === 'reset') {
            menu._pendingShiftNoteFormats = { color: null, size: null, font: null };
            menu._pendingShiftNoteReset = true;
        } else if (type === 'color') {
            const nextColor = menu._pendingShiftNoteFormats.color === value ? null : value;
            menu._pendingShiftNoteFormats.color = nextColor;
            menu._pendingShiftNoteReset = false;
        } else if (type === 'size') {
            menu._pendingShiftNoteFormats.size = this.normalizeShiftNoteSize(value) || null;
            menu._pendingShiftNoteReset = false;
        } else if (type === 'font') {
            menu._pendingShiftNoteFormats.font = value || null;
            menu._pendingShiftNoteReset = false;
        }
        this.syncShiftNotePendingControls(menu);
    }

    syncShiftNotePendingControls(menu) {
        const pending = menu?._pendingShiftNoteFormats || {};
        this.updateShiftNotePendingFontState(menu);
        const sizeInput = menu?.querySelector('.shift-font-size-input');
        if (sizeInput && pending.size) sizeInput.value = String(pending.size).replace('px', '');
        this.updateShiftNotePendingColorState(menu);
        this.updateShiftNotePendingSummary(menu);
    }

    updateShiftNotePendingFontState(menu) {
        const pendingFont = menu?._pendingShiftNoteFormats?.font || '';
        menu?.querySelectorAll('.shift-font-option').forEach(btn => {
            btn.classList.toggle('pending', btn.dataset.font === pendingFont);
        });
    }

    updateShiftNotePendingSummary(menu) {
        const summary = menu?.querySelector('.shift-format-pending-summary');
        if (!summary) return;
        const pending = menu?._pendingShiftNoteFormats || {};
        let preview = summary.querySelector('.shift-format-preview-text');
        if (!preview) {
            summary.innerHTML = `
                <div class="shift-format-summary-line"></div>
                <div class="shift-format-preview-text">連絡帳プレビュー</div>
            `;
            preview = summary.querySelector('.shift-format-preview-text');
        }
        const line = summary.querySelector('.shift-format-summary-line');
        if (line) line.textContent = `反映予定: ${this.getShiftNoteFormatSummary(pending)}`;
        preview.style.fontFamily = pending.font || '';
        preview.style.fontSize = pending.size || '';
        preview.style.color = pending.color || '';
        preview.classList.toggle('standard', !pending.font && !pending.size && !pending.color);
    }

    updateShiftNotePendingColorState(menu) {
        const pendingColor = menu?._pendingShiftNoteFormats?.color || '';
        menu?.querySelectorAll('.shift-color-dot').forEach(btn => {
            btn.classList.toggle('pending', btn.dataset.color === pendingColor);
        });
    }

    commitShiftNotePendingFormat(menu) {
        if (!menu?._pendingShiftNoteFormats) return 'next';
        const pending = { ...menu._pendingShiftNoteFormats };
        const resetSelection = !!menu._pendingShiftNoteReset;
        this._activeShiftNoteFormats = pending;
        this.saveShiftNoteFormats();
        document.querySelectorAll('.shift-notebook-row').forEach(r => this._updateShiftNoteFormatIndicator(r));

        const editor = menu.closest('.shift-notebook-row')?.querySelector('.shift-note-text') || this._activeShiftNoteEditor;
        const target = editor ? this.applyShiftNoteFormatsToSelection(editor, pending, resetSelection) : 'next';

        menu._pendingShiftNoteFormats = null;
        menu._pendingShiftNoteReset = false;
        return target;
    }

    showShiftNoteFormatFeedback(menu, message) {
        const feedback = menu?.querySelector('.shift-format-feedback');
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.add('show');
        clearTimeout(feedback._hideTimer);
        feedback._hideTimer = setTimeout(() => feedback.classList.remove('show'), 450);
    }

    applyShiftNoteFormatsToSelection(editor, formats = {}, resetSelection = false) {
        const selection = window.getSelection();
        const liveRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        const range = editor._savedRange || (liveRange && editor.contains(liveRange.commonAncestorContainer) ? liveRange.cloneRange() : null);
        if (!range || range.collapsed || !editor.contains(range.commonAncestorContainer)) return 'next';

        selection.removeAllRanges();
        selection.addRange(range);

        try {
            const selectedContent = range.extractContents();
            selectedContent.querySelectorAll?.('[style]').forEach(el => {
                el.style.fontSize = '';
                el.style.color = '';
                el.style.fontFamily = '';
                if (resetSelection) {
                    el.style.fontWeight = '';
                    el.style.textShadow = '';
                }
                if (!el.getAttribute('style')) el.removeAttribute('style');
            });

            const wrapper = document.createElement('span');
            if (!resetSelection) {
                if (formats.color) wrapper.style.color = formats.color;
                if (formats.size) wrapper.style.fontSize = formats.size;
                if (formats.font) wrapper.style.fontFamily = formats.font;
            }
            wrapper.appendChild(selectedContent);
            range.insertNode(wrapper);

            selection.removeAllRanges();
            const afterRange = document.createRange();
            afterRange.setStartAfter(wrapper);
            afterRange.collapse(true);
            selection.addRange(afterRange);
            editor._savedRange = afterRange.cloneRange();
        } catch (e) {
            console.warn('Failed to format shift note selection:', e);
        }

        editor.innerHTML = this.sanitizeShiftNoteHtml(editor.innerHTML);
        editor.focus();
        const selectionAfterSanitize = window.getSelection();
        if (selectionAfterSanitize) {
            const endRange = document.createRange();
            endRange.selectNodeContents(editor);
            endRange.collapse(false);
            selectionAfterSanitize.removeAllRanges();
            selectionAfterSanitize.addRange(endRange);
            editor._savedRange = endRange.cloneRange();
        }
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        this.scheduleShiftNotebookAutoSave();
        return 'selection';
    }

    applyShiftNoteFormatsToWholeEditor(editor, formats = {}, reset = false) {
        if (!editor) return false;
        const holder = document.createElement('div');
        holder.innerHTML = this.sanitizeShiftNoteHtml(editor.innerHTML);
        holder.querySelectorAll('[style]').forEach(el => {
            el.style.fontSize = '';
            el.style.color = '';
            el.style.fontFamily = '';
            if (reset) {
                el.style.fontWeight = '';
                el.style.textShadow = '';
            }
            if (!el.getAttribute('style')) el.removeAttribute('style');
        });

        const hasFormat = !reset && !!(formats.color || formats.size || formats.font);
        if (hasFormat) {
            const wrapper = document.createElement('span');
            if (formats.color) wrapper.style.color = formats.color;
            if (formats.size) wrapper.style.fontSize = formats.size;
            if (formats.font) wrapper.style.fontFamily = formats.font;
            while (holder.firstChild) wrapper.appendChild(holder.firstChild);
            holder.appendChild(wrapper);
        }

        editor.innerHTML = this.sanitizeShiftNoteHtml(holder.innerHTML);
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    }

    insertShiftNoteClipboardContent(editor, event) {
        if (!editor || !event?.clipboardData) return false;
        const html = event.clipboardData.getData('text/html');
        const text = event.clipboardData.getData('text/plain');
        if (!html && !text) return false;

        event.preventDefault();
        editor.focus();

        const holder = document.createElement('div');
        holder.innerHTML = html ? this.sanitizeShiftNoteHtml(html) : this.shiftNoteTextToHtml(text);

        const formats = this._activeShiftNoteFormats || {};
        const hasFormat = !!(formats.color || formats.size || formats.font);
        if (hasFormat) {
            holder.querySelectorAll('[style]').forEach(el => {
                el.style.fontSize = '';
                el.style.color = '';
                el.style.fontFamily = '';
                if (!el.getAttribute('style')) el.removeAttribute('style');
            });
        }

        const fragment = document.createDocumentFragment();
        if (hasFormat) {
            const wrapper = document.createElement('span');
            if (formats.color) wrapper.style.color = formats.color;
            if (formats.size) wrapper.style.fontSize = formats.size;
            if (formats.font) wrapper.style.fontFamily = formats.font;
            while (holder.firstChild) wrapper.appendChild(holder.firstChild);
            fragment.appendChild(wrapper);
        } else {
            while (holder.firstChild) fragment.appendChild(holder.firstChild);
        }

        const marker = document.createTextNode('');
        fragment.appendChild(marker);

        const selection = window.getSelection();
        let range = editor._savedRange?.cloneRange();
        if (!range || !editor.contains(range.commonAncestorContainer)) {
            range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
        }
        if (!range || !editor.contains(range.commonAncestorContainer)) {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
        }

        range.deleteContents();
        range.insertNode(fragment);

        const afterRange = document.createRange();
        afterRange.setStartBefore(marker);
        afterRange.collapse(true);
        marker.remove();
        selection?.removeAllRanges();
        selection?.addRange(afterRange);
        editor._savedRange = afterRange.cloneRange();
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        this.scheduleShiftNotebookAutoSave();
        return true;
    }

    // アクティブ装飾モードのインジケーター（ボタン表示）を更新する
    _updateShiftNoteFormatIndicator(row) {
        if (!row) return;
        const btn = row.querySelector('.shift-format-menu-btn');
        if (!btn) return;
        const f = this._activeShiftNoteFormats;
        const hasActive = f.color || f.size || f.font;
        btn.classList.toggle('shift-format-active', !!hasActive);
        // ボタン内のインジケータースパンを更新
        let indicator = btn.querySelector('.shift-format-indicator');
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = 'shift-format-indicator';
            btn.insertBefore(indicator, btn.firstChild);
        }
        if (hasActive) {
            indicator.style.background = f.color || 'var(--primary)';
            indicator.style.display = 'inline-block';
        } else {
            indicator.style.display = 'none';
        }
        const label = btn.querySelector('.shift-format-current');
        if (label) label.textContent = this.getShiftNoteFormatSummary();
    }

    ensureShiftNoteActiveFormat(editor) {
        if (!editor) return;
        const f = this._activeShiftNoteFormats;
        if (!f || (!f.color && !f.size && !f.font)) return;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) return;
        if (!range.collapsed) return;

        let node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        
        if (node.nodeName === 'SPAN') {
            const temp = document.createElement('span');
            if (f.color) temp.style.color = f.color;
            if (f.size) temp.style.fontSize = f.size;
            if (f.font) temp.style.fontFamily = f.font;
            let colorMatch = !f.color || (node.style.color === temp.style.color);
            let sizeMatch = !f.size || (node.style.fontSize === temp.style.fontSize);
            let fontMatch = !f.font || (node.style.fontFamily === temp.style.fontFamily);
            if (colorMatch && sizeMatch && fontMatch) return;
        }

        const span = document.createElement('span');
        if (f.color) span.style.color = f.color;
        if (f.size) span.style.fontSize = f.size;
        if (f.font) span.style.fontFamily = f.font;
        span.innerHTML = '&#8203;';

        range.insertNode(span);
        const newRange = document.createRange();
        newRange.setStart(span.firstChild, 1);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        editor._savedRange = newRange.cloneRange();
    }

    cleanupShiftNoteEmptySpans(editor) {
        if (!editor) return;
        const selection = window.getSelection();
        editor.querySelectorAll('span').forEach(span => {
            const text = (span.textContent || '').replace(/\u200B/g, '');
            if (span.children.length > 0 || text.length > 0) return;

            const rangeInside = selection
                && selection.rangeCount > 0
                && span.contains(selection.getRangeAt(0).commonAncestorContainer);
            let caretNode = null;
            if (rangeInside && span.parentNode) {
                caretNode = document.createTextNode('');
                span.parentNode.insertBefore(caretNode, span.nextSibling);
            }
            span.remove();
            if (caretNode && selection) {
                const range = document.createRange();
                range.setStart(caretNode, 0);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                editor._savedRange = range.cloneRange();
            }
        });
    }

    resizeShiftNoteEditor(editor) {
        if (!editor) return;
        editor.style.height = 'auto';
        editor.style.height = editor.scrollHeight + 'px';
        this.positionShiftImportantStamp(editor.closest('.shift-notebook-row'));
    }

    positionShiftImportantStamp(row) {
        if (!row) return;
        const stamp = row.querySelector('.shift-important-stamp');
        const editor = row.querySelector('.shift-note-text');
        if (!stamp || !editor) return;
        if (!row.classList.contains('shift-row-important')) {
            stamp.style.left = '';
            stamp.style.top = '';
            return;
        }
        const stampHeight = stamp.offsetHeight || 24;
        stamp.style.left = `${editor.offsetLeft}px`;
        stamp.style.top = `${editor.offsetTop - (stampHeight * 0.7)}px`;
    }

    removeShiftNoteBlankLines(button) {
        const row = button?.closest('.shift-notebook-row');
        const editor = row?.querySelector('.shift-note-text');
        if (!editor) return;

        const before = this.sanitizeShiftNoteHtml(editor.innerHTML);
        const holder = document.createElement('div');
        holder.innerHTML = before;

        const cloneWithText = (ancestors, text) => {
            let root = null;
            let cursor = null;
            ancestors.forEach(source => {
                const clone = source.cloneNode(false);
                if (!root) root = clone;
                if (cursor) cursor.appendChild(clone);
                cursor = clone;
            });
            const textNode = document.createTextNode(text);
            if (cursor) cursor.appendChild(textNode);
            return root || textNode;
        };
        const lines = [document.createDocumentFragment()];
        const currentLine = () => lines[lines.length - 1];
        const pushLine = () => lines.push(document.createDocumentFragment());
        const appendCleanNode = (node, ancestors = []) => {
            if (node.nodeName === 'BR') {
                pushLine();
                return;
            }
            if (node.nodeType === Node.TEXT_NODE) {
                String(node.textContent || '').split(/\r?\n/).forEach((part, index) => {
                    if (index > 0) pushLine();
                    if (part) currentLine().appendChild(cloneWithText(ancestors, part));
                });
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;

            if (!node.childNodes.length) {
                currentLine().appendChild(node.cloneNode(true));
                return;
            }
            Array.from(node.childNodes).forEach(child => appendCleanNode(child, ancestors.concat(node)));
        };
        Array.from(holder.childNodes).forEach(node => appendCleanNode(node));

        const isBlankLine = (fragment) => {
            const probe = document.createElement('div');
            probe.appendChild(fragment.cloneNode(true));
            return !(probe.textContent || '')
                .replace(/\u200B/g, '')
                .replace(/\u00A0/g, ' ')
                .trim();
        };
        const keptLines = lines.filter(line => !isBlankLine(line));
        const cleaned = document.createElement('div');
        keptLines.forEach((line, index) => {
            cleaned.appendChild(line);
            if (index < keptLines.length - 1) cleaned.appendChild(document.createElement('br'));
        });

        const after = this.sanitizeShiftNoteHtml(cleaned.innerHTML);
        if (after === before) {
            this.setShiftNotebookStatus('削除する空白行はありません', 'moved');
            return;
        }
        editor.innerHTML = after;
        this.cleanupShiftNoteEmptySpans(editor);
        this.resizeShiftNoteEditor(editor);
        requestAnimationFrame(() => this.resizeShiftNoteEditor(editor));
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus('空白行を削除しました', 'saved');
    }

    getShiftNoteFormatSummary(formats = null) {
        const f = formats || this._activeShiftNoteFormats || {};
        if (!f.font && !f.size && !f.color) return '標準';
        const parts = [];
        if (f.font) parts.push(this.getShiftNoteFontLabel(f.font));
        if (f.size) parts.push(String(f.size).replace('px', '') + 'px');
        else parts.push('サイズ標準');
        if (f.color) parts.push('色');
        return parts.length ? parts.join(' / ') : '標準';
    }

    getShiftNoteFontLabel(value = '') {
        const labels = {
            '"Noto Sans JP", sans-serif': 'ゴシック',
            '"Yu Gothic", "YuGothic", sans-serif': '游ゴシック',
            '"Meiryo", sans-serif': 'メイリオ',
            '"Noto Serif JP", serif': '明朝',
            '"MS Gothic", monospace': '等幅',
            'sans-serif': 'ゴシック',
            'serif': '明朝',
            'monospace': '等幅'
        };
        return labels[value] || 'フォント';
    }

    normalizeShiftNoteSize(value = '') {
        const numeric = parseFloat(String(value).replace('px', '').trim());
        if (!Number.isFinite(numeric)) return '';
        const clamped = Math.max(8, Math.min(120, numeric));
        return `${clamped}px`;
    }

    openShiftNoteFullscreen(btn) {
        const row = btn.closest('.shift-notebook-row');
        const rows = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'))
            .filter(row => !this.isShiftNotebookRowHiddenForHandover(row));
        const index = rows.indexOf(row);
        if (!row || index === -1) return;
        const hasPrev = index > 0;
        const hasNext = index < rows.length - 1;
        const hiddenCount = this.getShiftNotebookHiddenRowCount();
        
        const editor = row.querySelector('.shift-note-text');
        
        const temp = document.createElement('div');
        temp.innerHTML = editor.innerHTML;
        temp.querySelectorAll('[style]').forEach(el => {
            el.style.fontSize = '';
            if (el.getAttribute('style').trim() === '') {
                el.removeAttribute('style');
            }
        });
        const html = temp.innerHTML;
        
        const rowStyle = row.getAttribute('style') || '';
        const groupName = row.querySelector('.shift-row-group-select')?.value || '未設定';
        const replyTo = row.dataset.replyTo || '';
        const parentRow = replyTo
            ? Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row')).find(item => item.dataset.shiftRowId === replyTo)
            : null;
        const parentText = parentRow ? this.stripShiftNoteHtml(parentRow.querySelector('.shift-note-text')?.innerHTML || '').trim() : '';
        const parentSnippet = parentText
            ? `${parentText.slice(0, 28)}${parentText.length > 28 ? '…' : ''}`
            : '';
        const childReplyRows = this.getShiftNotebookReplyRowsFor(row, { directOnly: true });
        const firstReplyId = childReplyRows[0]?.dataset.shiftRowId || '';
        const replyCount = childReplyRows.length;
        const fullscreenTextHtml = replyTo ? `
            <div class="shift-fullscreen-reply-meta">
                <span class="shift-fullscreen-reply-badge"><i class="fa-solid fa-reply"></i> 返信</span>
                ${parentSnippet ? `<span class="shift-fullscreen-reply-parent">元の行: ${this.escapeHtml(parentSnippet)}</span>` : '<span class="shift-fullscreen-reply-parent">返信コメント</span>'}
                ${parentRow ? '<button type="button" class="shift-fullscreen-reply-jump" data-jump-role="parent"><i class="fa-solid fa-arrow-turn-up"></i> 元の行へ</button>' : ''}
            </div>
            <div class="shift-fullscreen-reply-body">${html}</div>
        ` : html;
        
        // Get the shift type (early/late/night) from the modal context
        const shiftBadge = document.querySelector('.shift-notebook-toolbar .shift-notebook-badge');
        const shiftClass = shiftBadge ? Array.from(shiftBadge.classList).find(c => ['early', 'late', 'night'].includes(c)) : '';
        const shiftStamp = shiftBadge ? shiftBadge.textContent : '';

        const photosContainer = row.querySelector('.shift-photo-previews');
        let photosHtml = '';
        if (photosContainer) {
            const photoItems = Array.from(photosContainer.querySelectorAll('.shift-photo-item'));
            if (photoItems.length > 0) {
                photosHtml = photoItems.map(item => {
                    const img = item.querySelector('img');
                    const captionInput = item.querySelector('.shift-photo-caption');
                    if (!img) return '';
                    return `
                        <div style="text-align: center;">
                            <div class="img-box" style="width: 40px; height: 40px; border-radius: 6px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border: 2px solid var(--shift-row-bg, white); background: #e2e8f0;" onclick="app.openImageModal(this.querySelector('img').src)">
                                <img src="${img.src}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 4px; cursor: zoom-in;">
                            </div>
                            ${captionInput && captionInput.value ? `<div style="margin-top: 6px; font-weight: 700; color: var(--text-main); font-size: 0.7rem; background: white; padding: 2px 6px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: inline-block; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(captionInput.value)}</div>` : ''}
                        </div>
                    `;
                }).join('');
            }
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'shift-fullscreen-overlay';
        overlay.innerHTML = `
            <button type="button" class="shift-fullscreen-nav prev" ${!hasPrev ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>
            <div class="shift-fullscreen-modal ${replyTo ? 'is-reply' : ''}" style="${rowStyle}; position:relative;">
                <div class="shift-fullscreen-stamps">
                    <div class="shift-notebook-badge ${shiftClass} shift-fullscreen-shift-stamp">${shiftStamp}</div>
                    <div class="shift-fullscreen-group-stamp">
                        ${this.escapeHtml(groupName)}
                    </div>
                    ${replyCount > 0 ? `<button type="button" class="shift-fullscreen-reply-jump child" data-jump-role="first-reply"><i class="fa-solid fa-comments"></i> 返信 ${replyCount}</button>` : ''}
                </div>
                ${this._shiftNotebookHideChecked && hiddenCount > 0 ? `
                    <div class="shift-fullscreen-hidden-status">
                        <i class="fa-solid fa-eye-slash"></i> 非表示中 ${hiddenCount}件
                    </div>
                ` : ''}
                <div class="shift-fullscreen-font-controls" title="フルスクリーン表示の文字サイズを調整します。行を移動しても調整値を維持し、入り切らない時は自動で収まるサイズに下げます。">
                    <button type="button" class="shift-fullscreen-font-btn" data-font-delta="-1" title="文字を小さくする">−</button>
                    <span class="shift-fullscreen-font-value">自動</span>
                    <button type="button" class="shift-fullscreen-font-btn" data-font-delta="1" title="文字を大きくする">＋</button>
                </div>
                <button type="button" class="shift-fullscreen-close"><i class="fa-solid fa-xmark"></i></button>
                <div class="shift-fullscreen-text-wrapper">
                    <div class="shift-fullscreen-content">
                        <div class="shift-fullscreen-text ${replyTo ? 'is-reply' : ''}">${fullscreenTextHtml}</div>
                    </div>
                </div>
                ${photosHtml ? `
                    <div class="shift-fullscreen-photos-wrapper" style="width: 100px; margin-left: 16px; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; padding: 16px 4px; align-items: center; border-left: 2px dashed rgba(15, 23, 42, 0.15); background: rgba(255,255,255,0.3); border-radius: 8px;">
                        ${photosHtml}
                    </div>
                ` : ''}
                <div class="shift-fullscreen-hints">
                    <span><i class="fa-solid fa-arrow-left"></i><i class="fa-solid fa-arrow-right"></i> 行移動</span>
                    <span><i class="fa-solid fa-magnifying-glass-plus"></i> 写真拡大</span>
                    <span><i class="fa-solid fa-xmark"></i> 閉じる</span>
                </div>
            </div>
            <button type="button" class="shift-fullscreen-nav next" ${!hasNext ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
        `;
        document.body.appendChild(overlay);

        const textContainer = overlay.querySelector('.shift-fullscreen-text');
        const contentArea = overlay.querySelector('.shift-fullscreen-content');
        if (typeof this._shiftFullscreenManualFontSize !== 'number') this._shiftFullscreenManualFontSize = 0;
        let fullscreenManualFontSize = this._shiftFullscreenManualFontSize;
        
        const adjustFontSize = () => {
            if (!document.body.contains(overlay)) return;
            textContainer.style.lineHeight = '1.45';
            let min = 14; 
            let max = 600;
            while(min <= max) {
                let mid = Math.floor((min + max) / 2);
                textContainer.style.fontSize = mid + 'px';
                if (textContainer.scrollHeight <= contentArea.clientHeight && textContainer.scrollWidth <= contentArea.clientWidth) {
                    min = mid + 1;
                } else {
                    max = mid - 1;
                }
            }
            const fitSize = Math.max(12, Math.floor(max / 2));
            const desiredSize = fullscreenManualFontSize || Math.max(28, fitSize);
            const adjustedSize = Math.max(12, Math.min(desiredSize, fitSize));
            textContainer.style.fontSize = adjustedSize + 'px';
            const fontValue = overlay.querySelector('.shift-fullscreen-font-value');
            if (fontValue) {
                const label = fullscreenManualFontSize ? `${fullscreenManualFontSize}px` : '自動';
                fontValue.textContent = adjustedSize < desiredSize ? `${label} / 自動縮小` : label;
            }
        };
        
        adjustFontSize();
        window.addEventListener('resize', adjustFontSize);
        overlay._resizeHandler = adjustFontSize;
        
        const closeOverlay = () => {
            window.removeEventListener('resize', overlay._resizeHandler);
            document.removeEventListener('keydown', overlay._keydownHandler);
            overlay.remove();
        };
        
        const navigate = (direction) => {
            const nextIndex = index + direction;
            if (nextIndex >= 0 && nextIndex < rows.length) {
                closeOverlay();
                const nextBtn = rows[nextIndex].querySelector('.shift-row-fullscreen');
                if (nextBtn) app.openShiftNoteFullscreen(nextBtn);
            }
        };

        const prevBtn = overlay.querySelector('.shift-fullscreen-nav.prev');
        const nextBtn = overlay.querySelector('.shift-fullscreen-nav.next');
        if (prevBtn) prevBtn.onclick = () => navigate(-1);
        if (nextBtn) nextBtn.onclick = () => navigate(1);
        overlay.querySelectorAll('.shift-fullscreen-font-btn').forEach(button => {
            button.onclick = () => {
                const direction = Number(button.dataset.fontDelta) || 0;
                const currentSize = Number.parseFloat(textContainer.style.fontSize) || 28;
                fullscreenManualFontSize = Math.max(12, Math.min(640, Math.round(currentSize + direction * 8)));
                this._shiftFullscreenManualFontSize = fullscreenManualFontSize;
                adjustFontSize();
            };
        });
        overlay.querySelectorAll('.shift-fullscreen-reply-jump').forEach(button => {
            button.onclick = () => {
                const role = button.dataset.jumpRole;
                const targetId = role === 'parent' ? replyTo : firstReplyId;
                const targetRow = targetId
                    ? Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row')).find(item => item.dataset.shiftRowId === targetId)
                    : null;
                const targetBtn = targetRow?.querySelector('.shift-row-fullscreen');
                if (!targetBtn) return;
                closeOverlay();
                app.openShiftNoteFullscreen(targetBtn);
            };
        });
        
        overlay._keydownHandler = (e) => {
            if (e.key === 'Escape') closeOverlay();
            if (e.key === 'ArrowLeft') navigate(-1);
            if (e.key === 'ArrowRight') navigate(1);
        };
        document.addEventListener('keydown', overlay._keydownHandler);
        
        const closeBtn = overlay.querySelector('.shift-fullscreen-close');
        closeBtn.onclick = closeOverlay;
    }

    isShiftNotebookRowHiddenForHandover(row) {
        return !!this._shiftNotebookHideChecked && !!row?.querySelector('.shift-row-hide-checkbox')?.checked;
    }

    matchesCalendarLineFilter(item) {
        if (!this.calLineFilter || this.calLineFilter === 'all') return true;
        const machine = store.getMachines(true).find(m => m.id === item.machineId);
        const lineNo = item.lineNo || machine?.lineNo;
        return String(lineNo) === String(this.calLineFilter);
    }

    renderCompactCalendarItems(container, dateStr, history, scheduled, memoValue, targetDate, today) {
        const groups = [
            {
                type: 'sudden',
                label: '突',
                title: '突発対応',
                items: history.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop),
                className: 'sudden'
            },
            {
                type: 'dokatei',
                label: 'ド',
                title: 'ドカ停',
                items: history.filter(h => !!h.isDokatei),
                className: 'dokatei'
            },
            {
                type: 'nonProductionStop',
                label: '非',
                title: '非生産停止',
                items: history.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop),
                className: 'non-production-stop'
            },
            {
                type: 'done',
                label: '完',
                title: '完了済み定期メンテ',
                items: history.filter(h => !!h.taskId),
                className: 'done'
            },
            {
                type: 'planned',
                label: targetDate < today ? '未' : '定',
                title: targetDate < today ? '未完了定期メンテ' : '定期メンテ予定',
                items: scheduled,
                className: targetDate < today ? 'unfinished' : 'planned'
            },
            {
                type: 'memo',
                label: 'メ',
                title: 'メモ',
                items: memoValue ? [{ value: memoValue }] : [],
                className: 'memo'
            }
        ];

        groups.forEach(group => {
            if (group.items.length === 0) return;
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = `compact-event-chip ${group.className}`;
            chip.title = `${group.title} ${group.items.length}件を確認`;
            chip.innerHTML = `
                <span class="compact-event-circle">${group.label}</span>
                <span class="compact-event-count">x${group.items.length}</span>
            `;
            chip.onclick = (e) => {
                e.stopPropagation();
                if (group.type === 'memo') {
                    this.toggleCompactMemo(dateStr);
                    return;
                }
                this.openCompactCalendarDetails(dateStr, group.type);
            };
            container.appendChild(chip);
        });

        if (memoValue && this.expandedCompactMemos.has(dateStr)) {
            const memoBox = document.createElement('div');
            memoBox.className = 'calendar-day-memo compact-memo-expanded';
            memoBox.onclick = (e) => e.stopPropagation();
            memoBox.innerHTML = `
                <i class="fa-solid fa-note-sticky" style="margin-right:4px; opacity:0.7;"></i>
                ${this.escapeHtml(memoValue).replace(/\n/g, '<br>')}
                <i class="fa-solid fa-xmark calendar-day-memo-delete" title="メモを削除" onclick="event.stopPropagation(); app.deleteDayMemo('${dateStr}');"></i>
            `;
            container.appendChild(memoBox);
        }
    }

    toggleCompactMemo(dateStr) {
        if (this.expandedCompactMemos.has(dateStr)) {
            this.expandedCompactMemos.delete(dateStr);
        } else {
            this.expandedCompactMemos.add(dateStr);
        }
        this.renderCalendar();
    }

    openCompactCalendarDetails(dateStr, type) {
        const history = this.getHistoryForDate(dateStr).filter(h => this.matchesCalendarLineFilter(h));
        const scheduled = this.getScheduledTasksForDate(dateStr).filter(s => this.matchesCalendarLineFilter(s));
        const memoValue = (store.activeData.memos || {})[dateStr];
        const [year, month, day] = dateStr.split('-');

        const targetDate = new Date(Number(year), Number(month) - 1, Number(day));
        targetDate.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);

        const configMap = {
            sudden: { title: '突発対応', items: history.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop), icon: 'fa-bolt-lightning' },
            dokatei: { title: 'ドカ停', items: history.filter(h => !!h.isDokatei), icon: 'fa-triangle-exclamation' },
            nonProductionStop: { title: '非生産停止', items: history.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop), icon: 'fa-circle-pause' },
            done: { title: '完了済み定期メンテ', items: history.filter(h => !!h.taskId), icon: 'fa-circle-check' },
            planned: { title: targetDate < today ? '未完了定期メンテ' : '定期メンテ予定', items: scheduled, icon: targetDate < today ? 'fa-triangle-exclamation' : 'fa-wrench' },
            memo: { title: 'メモ', items: memoValue ? [{ value: memoValue }] : [], icon: 'fa-note-sticky' }
        };
        const config = configMap[type];
        if (!config) return;

        this.openModal('compact-calendar-details', `${month}/${day} ${config.title} ${config.items.length}件`, () => {
            const content = document.getElementById('modal-content');
            const emptyHtml = '<p style="font-size:0.85rem; padding:12px; background:var(--background); border-radius:8px;">表示できる項目はありません。</p>';
            let listHtml = emptyHtml;

            if (type === 'memo' && memoValue) {
                listHtml = `
                    <div class="compact-detail-card memo">
                        <div class="compact-detail-icon"><i class="fa-solid ${config.icon}"></i></div>
                        <div class="compact-detail-main">
                            <div class="compact-detail-title">カレンダーメモ</div>
                            <div class="compact-detail-sub">${this.escapeHtml(memoValue).replace(/\n/g, '<br>')}</div>
                        </div>
                    </div>
                `;
            } else if (type === 'planned') {
                listHtml = config.items.length === 0 ? emptyHtml : config.items.map(s => {
                    const machine = store.getMachines(true).find(m => m.id === s.machineId);
                    const machineLabel = machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし';
                    const lineText = machine?.lineNo ? this.getLineLabel(machine.lineNo) : '';
                    return `
                        <div class="compact-detail-card planned" onclick="app.closeModal(); app.openCompletionForm('${this.escapeHtml(s.id)}', '${dateStr}')">
                            <div class="compact-detail-icon"><i class="fa-solid ${config.icon}"></i></div>
                            <div class="compact-detail-main">
                                <div class="compact-detail-title">${this.escapeHtml(s.content || '予定')}</div>
                                <div class="compact-detail-sub">${this.escapeHtml(machineLabel)}${lineText ? ` / ${this.escapeHtml(lineText)}` : ''}</div>
                            </div>
                            <i class="fa-solid fa-chevron-right compact-detail-arrow"></i>
                        </div>
                    `;
                }).join('');
            } else {
                listHtml = config.items.length === 0 ? emptyHtml : config.items.map(h => {
                    const machine = store.getMachines(true).find(m => m.id === h.machineId);
                    const machineLabel = machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし';
                    const workers = Array.isArray(h.workers) ? h.workers : (typeof h.workers === 'string' ? h.workers.split(',').map(s => s.trim()).filter(Boolean) : []);
                    const workerText = workers.length ? ` / ${workers.join(', ')}` : '';
                    const dokateiText = h.isDokatei ? ' / ドカ停' : '';
                    const nonProductionText = h.isNonProductionStop ? ' / 非生産停止' : '';
                    return `
                        <div class="compact-detail-card ${type}" onclick="app.closeModal(); app.openHistoryEditForm('${this.escapeHtml(h.id)}')">
                            <div class="compact-detail-icon"><i class="fa-solid ${config.icon}"></i></div>
                            <div class="compact-detail-main">
                                <div class="compact-detail-title">${this.escapeHtml(this.getHistoryDisplayText(h))}</div>
                                <div class="compact-detail-sub">${this.escapeHtml(machineLabel + workerText + dokateiText + nonProductionText)}</div>
                            </div>
                            <i class="fa-solid fa-chevron-right compact-detail-arrow"></i>
                        </div>
                    `;
                }).join('');
            }

            content.innerHTML = `<div class="compact-detail-list">${listHtml}</div>`;
            const saveBtn = document.querySelector('.modal-footer .primary-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
        });
    }

    getShiftNotebookLabel(shift) {
        const labels = {
            early: { stamp: '早', name: '早番' },
            late: { stamp: '遅', name: '遅番' },
            night: { stamp: '深', name: '深夜' }
        };
        return labels[shift] || labels.early;
    }

    getShiftNotebookRowsAndMembers(notebookData) {
        if (Array.isArray(notebookData)) return { rows: notebookData, members: [] };
        return {
            rows: Array.isArray(notebookData?.rows) ? notebookData.rows : [],
            members: Array.isArray(notebookData?.members) ? notebookData.members : []
        };
    }

    getShiftNotebookThroughGroupName() {
        return '貫通表示';
    }

    isShiftNotebookThroughGroup(group) {
        return (group || '') === this.getShiftNotebookThroughGroupName();
    }

    getShiftNotebookRowsForShift(dayData = {}, shift) {
        const notebookData = dayData?.[shift];
        const { rows, members } = this.getShiftNotebookRowsAndMembers(notebookData);
        const sharedRows = Array.isArray(dayData?.sharedRows) ? dayData.sharedRows : [];
        return {
            rows: [...sharedRows, ...rows],
            members
        };
    }

    getNotebookSearchDateRange(period) {
        const format = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (period === 'today') return { start: format(today), end: format(today), label: '今日' };
        if (period === 'yesterday') return { start: format(yesterday), end: format(yesterday), label: '昨日' };
        if (period === 'yesterday_today') return { start: format(yesterday), end: format(today), label: '昨日と今日' };
        if (period === 'this_month') {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            return { start: format(start), end: format(end), label: '今月' };
        }
        if (period === 'last_month') {
            const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const end = new Date(today.getFullYear(), today.getMonth(), 0);
            return { start: format(start), end: format(end), label: '先月' };
        }
        if (period === 'this_year') {
            const start = new Date(today.getFullYear(), 0, 1);
            const end = new Date(today.getFullYear(), 11, 31);
            return { start: format(start), end: format(end), label: '今年' };
        }
        if (period === 'last_year') {
            const year = today.getFullYear() - 1;
            const start = new Date(year, 0, 1);
            const end = new Date(year, 11, 31);
            return { start: format(start), end: format(end), label: '去年' };
        }
        return { start: '', end: '', label: '全期間' };
    }

    collectShiftNotebookSearchResults(query, period = 'all') {
        const terms = this.getSearchTerms(query);
        const range = this.getNotebookSearchDateRange(period);
        const notebooks = store.activeData.shiftNotebooks || {};
        const results = [];

        Object.keys(notebooks).sort().forEach(dateStr => {
            if (range.start && (dateStr < range.start || dateStr > range.end)) return;
            const dayData = notebooks[dateStr] || {};
            ['early', 'late', 'night'].forEach(shift => {
                const notebookData = dayData[shift];
                const hasSharedRows = Array.isArray(dayData.sharedRows) && dayData.sharedRows.length > 0;
                if (!notebookData && !hasSharedRows) return;
                const { rows, members } = this.getShiftNotebookRowsForShift(dayData, shift);
                const label = this.getShiftNotebookLabel(shift);

                rows.forEach((row, index) => {
                    const text = row?.text || '';
                    const html = row?.html || '';
                    const tag = row?.tag || '通常';
                    const group = row?.group || '未設定';
                    const photos = Array.isArray(row?.photos) ? row.photos : [];
                    const photoText = photos.map(photo => this.normalizeShiftNotebookPhoto(photo).caption).filter(Boolean).join(' ');
                    const searchable = `${dateStr} ${label.name} ${label.stamp} ${members.join(' ')} ${tag} ${group} ${text} ${photoText}`;
                    if (!this.matchesSearchTerms(searchable, terms)) return;
                    results.push({ dateStr, shift, label, members, text, html, tag, group, photos, index });
                });

                if (rows.length === 0 && members.length > 0) {
                    const searchable = `${dateStr} ${label.name} ${label.stamp} ${members.join(' ')}`;
                    if (this.matchesSearchTerms(searchable, terms)) {
                        results.push({ dateStr, shift, label, members, text: '', tag: '通常', group: '未設定', photos: [], index: 0 });
                    }
                }
            });
        });

        return results.sort((a, b) => b.dateStr.localeCompare(a.dateStr) || a.shift.localeCompare(b.shift) || a.index - b.index);
    }

    matchesNotebookSearchPeriod(dateStr, period = 'all') {
        const range = this.getNotebookSearchDateRange(period);
        if (!dateStr) return !range.start;
        return (!range.start || dateStr >= range.start) && (!range.end || dateStr <= range.end);
    }

    getSearchTerms(query = '') {
        return MaintenanceStore.toHalfWidthLower(query || '').split(/[\s　]+/).filter(Boolean);
    }

    matchesSearchTerms(searchable = '', terms = []) {
        const normalized = MaintenanceStore.toHalfWidthLower(searchable || '');
        return terms.every(term => normalized.includes(term));
    }

    highlightUnifiedSearchText(text = '', query = '') {
        const terms = (query || '').trim().split(/[\s　]+/).filter(Boolean);
        let html = this.escapeHtml(text || '');
        if (terms.length === 0) return html.replace(/\n/g, '<br>');
        terms
            .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .filter(Boolean)
            .forEach(term => {
                html = html.replace(new RegExp(`(${term})`, 'gi'), '<mark class="notebook-search-mark">$1</mark>');
            });
        return html.replace(/\n/g, '<br>');
    }

    collectUnifiedSearchResults(query, period = 'all') {
        const terms = this.getSearchTerms(query);
        const results = [];
        const machines = store.getMachines(true);
        const machineById = new Map(machines.map(machine => [String(machine.id), machine]));
        const tasks = store.activeData.tasks || [];
        const taskById = new Map(tasks.map(task => [String(task.id), task]));

        this.collectShiftNotebookSearchResults(query, period).forEach(result => {
            results.push({ ...result, type: 'notebook', typeLabel: '連絡帳', date: result.dateStr });
        });

        Object.entries(store.activeData.memos || {}).forEach(([dateStr, memo]) => {
            if (!this.matchesNotebookSearchPeriod(dateStr, period)) return;
            const text = String(memo || '').trim();
            if (!text) return;
            if (!this.matchesSearchTerms(`${dateStr} メモ ${text}`, terms)) return;
            results.push({
                type: 'memo',
                typeLabel: 'メモ',
                date: dateStr,
                title: `${dateStr} メモ`,
                text,
                openAction: `app.closeModal(); app.openDayQuickMenu('${this.escapeJs(dateStr)}')`
            });
        });

        (store.activeData.history || []).filter(h => !h.isManualGuide).forEach(h => {
            if (!this.matchesNotebookSearchPeriod(h.date || '', period)) return;
            const machine = machineById.get(String(h.machineId)) || null;
            const task = h.taskId ? taskById.get(String(h.taskId)) : null;
            const workers = Array.isArray(h.workers) ? h.workers.join(', ') : (h.workers || '');
            const typeLabel = h.isDokatei ? 'ドカ停' : (h.taskId ? '定期履歴' : (h.isNonProductionStop ? '非生産停止' : '突発対応'));
            const title = this.getHistoryDisplayText(h);
            const body = [
                h.errorContent,
                h.cause,
                h.notes,
                h.errorNo,
                h.category,
                h.workTime ? `${h.workTime}分` : '',
                task?.content
            ].filter(Boolean).join('\n');
            const searchable = `${h.date} ${typeLabel} ${title} ${body} ${machine?.name || ''} ${machine?.model || ''} ${machine?.lineNo || ''} ${workers}`;
            if (!this.matchesSearchTerms(searchable, terms)) return;
            results.push({
                type: 'history',
                typeLabel,
                date: h.date || '',
                title,
                text: body || title,
                sub: `${machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし'}${workers ? ` / ${workers}` : ''}`,
                historyKind: h.isDokatei ? 'dokatei' : (h.taskId ? 'periodic' : (h.isNonProductionStop ? 'nonProductionStop' : 'sudden')),
                openAction: `app.closeModal(); app.openHistoryEditForm('${this.escapeJs(h.id)}')`
            });
        });

        tasks.filter(task => !task.deleted && !store.isMaintenanceTaskArchived(task.id)).forEach(task => {
            const dateStr = task.startDate || '';
            if (!this.matchesNotebookSearchPeriod(dateStr, period)) return;
            const machine = machineById.get(String(task.machineId)) || null;
            const searchable = `${dateStr} 定期メンテ 予定 ${task.content || ''} ${task.periodDays || ''} ${machine?.name || ''} ${machine?.model || ''} ${machine?.lineNo || ''}`;
            if (!this.matchesSearchTerms(searchable, terms)) return;
            const today = new Date();
            const openDate = dateStr || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            results.push({
                type: 'task',
                typeLabel: '定期メンテ',
                date: dateStr,
                title: task.content || '定期メンテ',
                text: task.periodDays ? `${task.periodDays}日周期` : '単発予定',
                sub: machine ? `${machine.name || ''}${machine.model ? ` [${machine.model}]` : ''}` : '対象機械なし',
                openAction: `app.closeModal(); app.openCompletionForm('${this.escapeJs(task.id)}', '${this.escapeJs(openDate)}')`
            });
        });

        (store.activeData.localTodos || []).forEach(todo => {
            const date = todo.deadlineDate || todo.completedAt?.slice?.(0, 10) || todo.updatedAt?.slice?.(0, 10) || todo.createdAt?.slice?.(0, 10) || '';
            if (!this.matchesNotebookSearchPeriod(date, period)) return;
            const assigned = (todo.assignedTo || []).map(id => this.getKanbanTodoWorkerName(id)).join(' ');
            const requester = todo.requestedBy ? this.getKanbanTodoWorkerName(todo.requestedBy) : '';
            const statusLabel = { todo: '未処理', progress: '処理中', done: '完了' }[todo.status || 'todo'] || '';
            const searchable = `${date} ToDo タスク 依頼 ${statusLabel} ${todo.title || ''} ${todo.description || ''} ${assigned} ${requester} ${todo.deadlineDate || ''} ${todo.deadlineTime || ''}`;
            if (!this.matchesSearchTerms(searchable, terms)) return;
            results.push({
                type: 'todo',
                typeLabel: todo.isRequest ? 'ToDo依頼' : 'ToDo',
                date,
                title: todo.title || '無題のToDo',
                text: todo.description || statusLabel || '詳細なし',
                sub: `${statusLabel}${assigned ? ` / 依頼先: ${assigned}` : ''}${requester ? ` / 依頼者: ${requester}` : ''}`,
                openAction: `app.closeModal(); app.openKanbanTodoFromSearch('${this.escapeJs(todo.id)}')`
            });
        });

        return results.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.typeLabel.localeCompare(b.typeLabel, 'ja'));
    }

    highlightShiftNotebookSearchHtml(html = '', query = '') {
        const sanitized = this.sanitizeShiftNoteHtml(html);
        const terms = (query || '').trim().split(/[\s　]+/).filter(Boolean);
        if (terms.length === 0) return sanitized;

        const container = document.createElement('div');
        container.innerHTML = sanitized;
        const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach(node => {
            const value = node.nodeValue || '';
            if (!regex.test(value)) {
                regex.lastIndex = 0;
                return;
            }
            regex.lastIndex = 0;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            value.replace(regex, (match, _group, offset) => {
                if (offset > lastIndex) fragment.appendChild(document.createTextNode(value.slice(lastIndex, offset)));
                const mark = document.createElement('mark');
                mark.className = 'notebook-search-mark';
                mark.textContent = match;
                fragment.appendChild(mark);
                lastIndex = offset + match.length;
                return match;
            });
            if (lastIndex < value.length) fragment.appendChild(document.createTextNode(value.slice(lastIndex)));
            node.parentNode?.replaceChild(fragment, node);
        });

        return container.innerHTML;
    }

    openShiftNotebookSearchResults(queryText = '', period = 'all') {
        const query = (queryText || '').trim();
        if (!query) {
            alert('検索キーワードを入力してください。');
            return;
        }

        const range = this.getNotebookSearchDateRange(period);
        const results = this.collectUnifiedSearchResults(query, period);
        const typeCounts = results.reduce((acc, result) => {
            acc[result.type] = (acc[result.type] || 0) + 1;
            return acc;
        }, {});
        const searchTabs = [
            ['all', 'すべて', results.length],
            ['notebook', '連絡帳', typeCounts.notebook || 0],
            ['todo', 'ToDo', typeCounts.todo || 0],
            ['memo', 'メモ', typeCounts.memo || 0],
            ['history', '履歴', typeCounts.history || 0],
            ['task', '定期メンテ', typeCounts.task || 0]
        ];
        this.openModal('shift-notebook-search', `横断検索: ${this.escapeHtml(query)} / ${range.label} (${results.length}件)`, () => {
            const modalContainer = document.getElementById('modal-container');
            if (modalContainer) modalContainer.classList.add('shift-notebook-modal', 'shift-notebook-search-modal');
            const content = document.getElementById('modal-content');
            const resultHtml = results.length === 0 ? `
                <div class="notebook-search-empty">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <div>該当する情報はありません。</div>
                </div>
            ` : results.map(result => {
                if (result.type !== 'notebook') {
                    const iconMap = {
                        memo: 'fa-note-sticky',
                        history: result.historyKind === 'periodic' ? 'fa-circle-check' : (result.historyKind === 'dokatei' ? 'fa-triangle-exclamation' : (result.historyKind === 'nonProductionStop' ? 'fa-circle-pause' : 'fa-bolt-lightning')),
                        task: 'fa-wrench'
                    };
                    return `
                        <article class="notebook-search-result unified ${this.escapeHtml(result.type)}" data-search-type="${this.escapeHtml(result.type)}">
                            <div class="notebook-search-meta">
                                <span class="unified-search-type ${this.escapeHtml(result.type)}"><i class="fa-solid ${iconMap[result.type] || 'fa-circle-info'}"></i> ${this.escapeHtml(result.typeLabel)}</span>
                                <div>
                                    <div class="notebook-search-date">${this.escapeHtml(result.date || '日付なし')} ${this.escapeHtml(result.title || '')}</div>
                                    ${result.sub ? `<div class="notebook-search-members">${this.escapeHtml(result.sub)}</div>` : ''}
                                </div>
                                ${result.openAction ? `<button type="button" class="secondary-btn notebook-search-open" onclick="${result.openAction}"><i class="fa-solid fa-arrow-up-right-from-square"></i> 開く</button>` : ''}
                            </div>
                            <div class="notebook-search-body single">
                                <div class="notebook-search-text">
                                    ${this.highlightUnifiedSearchText(result.text || result.title || '', query)}
                                </div>
                            </div>
                        </article>
                    `;
                }
                const members = result.members.length ? result.members.join(', ') : 'メンバー未登録';
                const photos = result.photos.map(photo => {
                    const photoData = this.normalizeShiftNotebookPhoto(photo);
                    return `
                    <div class="notebook-search-photo-wrap">
                        <div class="notebook-search-photo img-box">
                            <img src="${photoData.src}" alt="">
                        </div>
                        ${photoData.caption ? `<div class="notebook-search-photo-caption">${this.escapeHtml(photoData.caption)}</div>` : ''}
                    </div>
                `;
                }).join('');
                return `
                    <article class="notebook-search-result" data-search-type="notebook" style="${this.getShiftNotebookRowGroupStyle(result.group)}">
                        <div class="notebook-search-meta">
                            <span class="unified-search-type notebook"><i class="fa-solid fa-book-open"></i> 連絡帳</span>
                            <span class="shift-notebook-badge ${result.shift}">${result.label.stamp}</span>
                            <div>
                                <div class="notebook-search-date">${result.dateStr} ${result.label.name}</div>
                                <div class="notebook-search-members"><i class="fa-solid fa-users"></i> ${this.escapeHtml(members)}</div>
                            </div>
                            <button type="button" class="secondary-btn notebook-search-open" onclick="app.closeModal(); app.openShiftNotebookModal('${result.dateStr}', '${result.shift}', ${result.index}, '${query.replace(/'/g, "\\'")}')">
                                <i class="fa-solid fa-pen-to-square"></i> 開く
                            </button>
                        </div>
                        <div class="notebook-search-body">
                            <div class="notebook-search-text">
                                <span class="shift-note-tag ${this.getShiftNotebookTagClass(result.tag)}">${this.escapeHtml(result.tag || '通常')}</span>
                                <span class="shift-row-group-badge">${this.escapeHtml(result.group || '未設定')}</span>
                                ${result.text ? this.highlightShiftNotebookSearchHtml(result.html || this.shiftNoteTextToHtml(result.text), query) : '<span class="muted">本文なし</span>'}
                            </div>
                            ${photos ? `<div class="notebook-search-photos">${photos}</div>` : ''}
                        </div>
                    </article>
                `;
            }).join('');

            content.innerHTML = `
                <div class="notebook-search-summary">
                    <span><i class="fa-solid fa-magnifying-glass"></i> 検索語: <b>${this.escapeHtml(query)}</b></span>
                    <span><i class="fa-solid fa-calendar-days"></i> 期間: <b>${range.label}</b></span>
                    <span>${results.length}件</span>
                </div>
                <div class="notebook-search-tabs">
                    ${searchTabs.map(([type, label, count], index) => `
                        <button type="button" class="${index === 0 ? 'active' : ''}" onclick="app.filterUnifiedSearchTab('${type}', this)">
                            ${label}<b>${count}</b>
                        </button>
                    `).join('')}
                </div>
                <div class="notebook-search-results">${resultHtml}</div>
            `;
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
        });
    }

    filterUnifiedSearchTab(type = 'all', button = null) {
        document.querySelectorAll('.notebook-search-tabs button').forEach(btn => btn.classList.toggle('active', btn === button));
        document.querySelectorAll('.notebook-search-result[data-search-type]').forEach(item => {
            item.hidden = type !== 'all' && item.dataset.searchType !== type;
        });
    }

    openShiftNotebookModal(dateStr, shift, focusRowIndex = null, focusQuery = '') {
        this._activeShiftNoteEditor = null;
        const label = this.getShiftNotebookLabel(shift);
        if (!store.activeData.shiftNotebooks) store.activeData.shiftNotebooks = {};
        if (!store.activeData.shiftNotebookGroupPresets) store.activeData.shiftNotebookGroupPresets = [];
        const dayData = store.activeData.shiftNotebooks[dateStr] || {};
        const { rows, members } = this.getShiftNotebookRowsForShift(dayData, shift);
        const [year, month, day] = dateStr.split('-');
        this._editingShiftNotebook = { dateStr, shift };
        this._shiftNotebookHideChecked = localStorage.getItem('shift_notebook_hide_checked') === 'true';
        this._shiftNotebookImportantOnly = localStorage.getItem('shift_notebook_important_only') === 'true';

        this.openModal('shift-notebook', `${month}/${day} ${label.name}の連絡帳`, () => {
            const modalContainer = document.getElementById('modal-container');
            if (modalContainer) {
                modalContainer.classList.add('shift-notebook-modal');
                modalContainer.classList.toggle('shift-compact-row-mode', !!this._shiftNotebookCompactRows);
            }
            const modalHeader = modalContainer?.querySelector('.modal-header');
            const modalTitle = modalHeader?.querySelector('h3');
            if (modalHeader && modalTitle) {
                modalHeader.classList.add('shift-notebook-modal-header');
                modalTitle.insertAdjacentHTML('beforeend', this.getShiftNotebookGuideThumbsHtml());
                modalTitle.insertAdjacentHTML('afterend', `
                    <div class="notebook-search-bar shift-modal-search-bar">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input type="text" id="shift-modal-unified-search" placeholder="横断検索...">
                        <select id="shift-modal-unified-search-period" title="検索期間">
                            <option value="all">全期間</option>
                            <option value="today">今日</option>
                            <option value="yesterday">昨日</option>
                            <option value="yesterday_today">昨日と今日</option>
                            <option value="this_month">今月</option>
                            <option value="last_month">先月</option>
                            <option value="this_year">今年</option>
                            <option value="last_year">去年</option>
                        </select>
                        <button type="button" title="連絡帳・メモ・履歴・定期メンテを検索" onclick="app.openShiftModalUnifiedSearch()"><i class="fa-solid fa-magnifying-glass"></i></button>
                    </div>
                `);
            }
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="shift-notebook-toolbar">
                    <div class="shift-notebook-toolbar-row shift-notebook-toolbar-main">
                        <span class="shift-notebook-badge ${shift}">${label.stamp}</span>
                        <span class="shift-notebook-date">${year}/${month}/${day}</span>
                        <div class="shift-notebook-nav">
                            <button type="button" class="icon-btn shift-notebook-nav-btn" title="クリック: 前のシフト / ダブルクリック: 前の入力済み" onclick="app.handleShiftNotebookPrevClick(event)" ondblclick="app.handleShiftNotebookPrevDoubleClick(event)">
                                <i class="fa-solid fa-caret-left"></i>
                            </button>
                            <button type="button" class="icon-btn shift-notebook-nav-btn" title="クリック: 次のシフト / 長押し: 次の入力済み" onpointerdown="app.startShiftNotebookNextHold(event)" onpointerup="app.finishShiftNotebookNextHold(event)" onpointerleave="app.cancelShiftNotebookNextHold()" onpointercancel="app.cancelShiftNotebookNextHold()" onclick="app.moveShiftNotebookToNextShift()">
                                <i class="fa-solid fa-caret-right"></i>
                            </button>
                        </div>
                        <div class="shift-group-panel" style="align-items: flex-start;">
                            <label class="shift-group-label" style="margin-top: 8px;">グループ</label>
                            <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
                                <input type="text" id="shift-group-members" class="shift-group-input" value="${this.escapeHtml(members.join(', '))}" placeholder="メンバーをカンマ区切りで入力" oninput="app.updateShiftGroupChant()">
                                <div id="shift-group-chant-display" class="shift-group-chant-display"></div>
                                <div id="shift-absence-manage" class="shift-absence-manage hidden"></div>
                            </div>
                        </div>
                        <div class="shift-preset-panel">
                            <span class="shift-toolbar-category">プリセット</span>
                            <select id="shift-group-preset" class="shift-preset-select" onchange="app.applyShiftGroupPreset(this.value)">
                                <option value="">プリセット</option>
                                <option value="__previous_day__">前日と同じ</option>
                                ${store.activeData.shiftNotebookGroupPresets.map((p, idx) => `<option value="${idx}">${this.escapeHtml(p.name)}</option>`).join('')}
                            </select>
                            <button type="button" class="secondary-btn shift-absence-btn" onclick="app.removeShiftAbsentMember()">
                                <i class="fa-solid fa-user-minus"></i> 欠員
                            </button>
                            <button type="button" class="secondary-btn shift-preset-save" onclick="app.saveShiftGroupPreset()">
                                <i class="fa-solid fa-bookmark"></i> 登録
                            </button>
                            <button type="button" class="secondary-btn shift-preset-manage" onclick="app.editShiftGroupPreset()">
                                <i class="fa-solid fa-pen"></i> 編集
                            </button>
                            <button type="button" class="secondary-btn shift-preset-delete" onclick="app.deleteShiftGroupPreset()">
                                <i class="fa-solid fa-trash-can"></i> 削除
                            </button>
                            <span class="shift-toolbar-category">管理</span>
                            <button type="button" class="secondary-btn shift-notebook-settings-btn" onclick="app.openShiftNotebookSettingsPanel()">
                                <i class="fa-solid fa-sliders"></i> 連絡帳設定
                            </button>
                            <button type="button" class="secondary-btn shift-member-type-manage" onclick="app.openShiftMemberTypeManageModal()">
                                <i class="fa-solid fa-users-gear"></i> 人名管理
                            </button>
                            <button type="button" class="secondary-btn shift-row-group-order-btn" onclick="app.openShiftRowGroupOrderModal()">
                                <i class="fa-solid fa-arrow-up-wide-short"></i> 順序
                            </button>
                            <span class="shift-toolbar-category">表示</span>
                            <button type="button" id="shift-hide-checked-btn" class="secondary-btn shift-hide-checked-btn" onclick="app.toggleShiftNotebookHiddenRows()" title="チェックを入れた行を一時的に非表示にします。行は削除されず、全表示で戻せます。">
                                ☑ 非表示
                            </button>
                            <button type="button" id="shift-important-only-btn" class="secondary-btn shift-important-only-btn" onclick="app.toggleShiftNotebookImportantOnly()" title="重要スタンプの行だけ表示します。">
                                重 重要のみ
                            </button>
                            <button type="button" id="shift-clear-row-filters-btn" class="secondary-btn shift-clear-row-filters-btn" onclick="app.clearShiftNotebookRowFilters()" title="行の表示フィルターをすべて解除します。" hidden>
                                全表示
                            </button>
                            <button type="button" id="shift-row-menu-toggle-btn" class="secondary-btn shift-row-menu-toggle-btn" onclick="app.toggleShiftNotebookRowMenus()" title="各行のグループ・装飾・右側ボタン群を非表示にします。">
                                行メニュー設定
                            </button>
                            <div id="shift-row-menu-settings-panel" class="shift-row-menu-settings-panel" hidden>
                                <button type="button" class="shift-row-menu-settings-close" title="閉じる" onclick="app.closeShiftNotebookRowMenuSettings()">×</button>
                                <label><input type="checkbox" data-part="group" onchange="app.setShiftNotebookRowMenuHiddenPart('group', this.checked)"> グループ</label>
                                <label><input type="checkbox" data-part="format" onchange="app.setShiftNotebookRowMenuHiddenPart('format', this.checked)"> 装飾</label>
                                <label><input type="checkbox" data-part="actions" onchange="app.setShiftNotebookRowMenuHiddenPart('actions', this.checked)"> 右側ボタン</label>
                                <div class="shift-row-menu-settings-actions">
                                    <button type="button" onclick="app.setAllShiftNotebookRowMenuHiddenParts(true)">全部隠す</button>
                                    <button type="button" onclick="app.setAllShiftNotebookRowMenuHiddenParts(false)">全部表示</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="shift-notebook-toolbar-row shift-notebook-toolbar-actions">
                        <div id="shift-row-group-stamps" class="shift-row-group-stamps" aria-label="行グループスタンプ">
                            <span class="shift-row-group-stamps-label">行挿入用看板（ドラッグして行挿入）</span>
                            ${this.getShiftRowGroupStampButtonsHtml()}
                        </div>
                        <button type="button" class="secondary-btn" onclick="app.addShiftNotebookRowWithLastGroup('shift-notebook-rows')">
                            <i class="fa-solid fa-plus"></i> 行を追加
                        </button>
                        <span class="shift-toolbar-category">テンプレート</span>
                        <select id="shift-row-template-select" class="shift-row-template-select" onchange="app.addShiftNotebookRowFromTemplate(this.value); this.value=''">
                            ${this.getShiftRowTemplateOptions()}
                        </select>
                        <button type="button" class="secondary-btn shift-row-set-template-save" onclick="app.saveShiftNotebookRowSetTemplate()">
                            <i class="fa-solid fa-layer-group"></i> 行セット保存
                        </button>
                        <button type="button" class="secondary-btn" onclick="app.openShiftRowTemplateManageModal()">
                            <i class="fa-solid fa-list-check"></i> テンプレート管理
                        </button>
                        <button type="button" class="secondary-btn" onclick="app.togglePreviousShiftRowsPanel()">
                            <i class="fa-solid fa-copy"></i> 前シフトからコピー
                        </button>
                        <button type="button" id="shift-compact-rows-btn" class="secondary-btn shift-compact-rows-btn ${this._shiftNotebookCompactRows ? 'active' : ''}" onclick="app.toggleShiftNotebookCompactRows()" title="行の高さを詰めて表示します">
                            <i class="fa-solid fa-compress"></i> ${this._shiftNotebookCompactRows ? '標準行' : '省スペース'}
                        </button>
                        <button type="button" id="shift-fit-all-btn" class="secondary-btn shift-fit-all-btn" onclick="app.toggleShiftNotebookFitAll()" title="現在の行を画面内に収まるよう自動調整します">
                            <i class="fa-solid fa-compress"></i> 全行表示
                        </button>
                    </div>
                </div>
                <div id="shift-row-filter-banner" class="shift-row-filter-banner" hidden></div>
                <div id="shift-previous-copy-panel" class="shift-previous-copy-panel hidden"></div>
                <div id="shift-notebook-rows" class="shift-notebook-rows"></div>
            `;

            const rowContainerId = 'shift-notebook-rows';
            if (rows.length === 0) {
                this.addShiftNotebookRow(rowContainerId, '', [], '通常', '未設定', '', false, false);
            } else {
                const sortableRows = rows.map((row, index) => ({ ...row, _sourceIndex: index }));
                this.sortShiftNotebookRows(sortableRows).forEach(row => {
                    const rowEl = this.addShiftNotebookRow(rowContainerId, row.text || '', row.photos || [], row.tag || '通常', row.group || '未設定', row.html || '', !!row.hidden, true, row.id || '', row.replyTo || '', !!row.important);
                    if (rowEl) rowEl.dataset.shiftSourceIndex = String(row._sourceIndex);
                });
            }
            this.updateShiftNotebookGroupCorners();
            this.updateShiftNotebookHiddenRows();
            this.updateShiftNotebookRowMenuVisibility();
            requestAnimationFrame(() => {
                document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => this.positionShiftImportantStamp(row));
            });
            this.setupShiftRowGroupStampDropZone();
            this.setupShiftModalUnifiedSearch();

            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.style.display = 'none';
            const cancelBtn = modalContainer.querySelector('.modal-footer .secondary-btn');
            if (cancelBtn) {
                cancelBtn.innerHTML = '<i class="fa-solid fa-check"></i> 閉じる';
                cancelBtn.style.width = '100%';
                cancelBtn.style.maxWidth = '300px';
                cancelBtn.style.margin = '0 auto';
                cancelBtn.className = 'primary-btn';
            }
            this.scheduleShiftNotebookAutoSave();
            setTimeout(() => this.updateShiftGroupChant(), 50);
            if (focusRowIndex !== null && focusRowIndex !== undefined) {
                setTimeout(() => this.focusShiftNotebookRowByIndex(focusRowIndex, focusQuery), 120);
            }
        });
    }

    toggleShiftNotebookFitAll() {
        const modal = document.querySelector('.modal-container.shift-notebook-modal');
        const body = modal?.querySelector('.modal-body');
        const button = document.getElementById('shift-fit-all-btn');
        if (!modal || !body) return;
        if (modal.classList.contains('shift-fit-all-mode')) {
            modal.classList.remove('shift-fit-all-mode');
            modal.style.removeProperty('--shift-fit-scale');
            button?.classList.remove('active');
            requestAnimationFrame(() => {
                document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => this.positionShiftImportantStamp(row));
            });
            if (button) button.innerHTML = '<i class="fa-solid fa-compress"></i> 全行表示';
            return;
        }

        modal.classList.add('shift-fit-all-mode');
        button?.classList.add('active');
        if (button) button.innerHTML = '<i class="fa-solid fa-up-right-and-down-left-from-center"></i> 元に戻す';
        this.adjustShiftNotebookRowsToFit();
    }

    toggleShiftNotebookCompactRows() {
        this._shiftNotebookCompactRows = !this._shiftNotebookCompactRows;
        localStorage.setItem('shift_notebook_compact_rows', String(this._shiftNotebookCompactRows));
        const modal = document.querySelector('.modal-container.shift-notebook-modal');
        const button = document.getElementById('shift-compact-rows-btn');
        modal?.classList.toggle('shift-compact-row-mode', this._shiftNotebookCompactRows);
        if (button) {
            button.classList.toggle('active', this._shiftNotebookCompactRows);
            button.innerHTML = `<i class="fa-solid fa-compress"></i> ${this._shiftNotebookCompactRows ? '標準行' : '省スペース'}`;
        }
        document.querySelectorAll('#shift-notebook-rows .shift-note-text').forEach(editor => this.resizeShiftNoteEditor(editor));
        if (modal?.classList.contains('shift-fit-all-mode')) this.adjustShiftNotebookRowsToFit();
        else requestAnimationFrame(() => {
            document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => this.positionShiftImportantStamp(row));
        });
        this.setShiftNotebookStatus(this._shiftNotebookCompactRows ? '省スペース表示にしました' : '標準表示に戻しました', 'moved');
    }

    adjustShiftNotebookRowsToFit() {
        const modal = document.querySelector('.modal-container.shift-notebook-modal.shift-fit-all-mode');
        const body = modal?.querySelector('.modal-body');
        const rows = document.getElementById('shift-notebook-rows');
        if (!modal || !body || !rows) return;
        let scale = 1;
        modal.style.setProperty('--shift-fit-scale', String(scale));

        const fitOnce = () => {
            const available = Math.max(240, body.clientHeight - 4);
            const needed = Math.max(rows.offsetTop + rows.scrollHeight, body.scrollHeight);
            if (needed <= available) return true;
            scale = Math.max(0.48, Math.min(1, scale * (available / needed) * 0.98));
            modal.style.setProperty('--shift-fit-scale', scale.toFixed(3));
            return scale <= 0.48;
        };

        requestAnimationFrame(() => {
            let done = false;
            let count = 0;
            const step = () => {
                done = fitOnce();
                document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => this.positionShiftImportantStamp(row));
                count += 1;
                if (!done && count < 6) requestAnimationFrame(step);
            };
            step();
        });
    }

    setupShiftModalUnifiedSearch() {
        const input = document.getElementById('shift-modal-unified-search');
        if (!input) return;
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.openShiftModalUnifiedSearch();
        });
    }

    openShiftModalUnifiedSearch() {
        const input = document.getElementById('shift-modal-unified-search');
        const period = document.getElementById('shift-modal-unified-search-period')?.value || 'all';
        const query = input?.value || '';
        if (this._editingShiftNotebook) {
            this.saveShiftNotebook(this._editingShiftNotebook.dateStr, this._editingShiftNotebook.shift, { close: false, render: true, status: false });
        }
        this.openShiftNotebookSearchResults(query, period);
    }

    focusShiftNotebookRowByIndex(index, query = '') {
        const row = document.querySelector(`#shift-notebook-rows .shift-notebook-row[data-shift-source-index="${index}"]`);
        if (!row) return;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('shift-row-highlight');
        this.highlightShiftNotebookEditorSearchTerms(row, query);
        row.querySelector('.shift-note-text')?.focus();
        setTimeout(() => {
            row.classList.remove('shift-row-highlight');
            this.clearShiftNotebookEditorSearchMarks(row);
        }, 4200);
    }

    clearShiftNotebookEditorSearchMarks(row) {
        row?.querySelectorAll('mark.shift-editor-search-mark').forEach(mark => {
            mark.replaceWith(document.createTextNode(mark.textContent || ''));
        });
        row?.normalize();
    }

    highlightShiftNotebookEditorSearchTerms(row, query = '') {
        const editor = row?.querySelector('.shift-note-text');
        const terms = (query || '').trim().split(/[\s　]+/).filter(Boolean);
        if (!editor || terms.length === 0) return;
        this.clearShiftNotebookEditorSearchMarks(row);

        const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);
        textNodes.forEach(node => {
            const value = node.nodeValue || '';
            if (!regex.test(value)) {
                regex.lastIndex = 0;
                return;
            }
            regex.lastIndex = 0;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            value.replace(regex, (match, _group, offset) => {
                if (offset > lastIndex) fragment.appendChild(document.createTextNode(value.slice(lastIndex, offset)));
                const mark = document.createElement('mark');
                mark.className = 'shift-editor-search-mark';
                mark.textContent = match;
                fragment.appendChild(mark);
                lastIndex = offset + match.length;
                return match;
            });
            if (lastIndex < value.length) fragment.appendChild(document.createTextNode(value.slice(lastIndex)));
            node.parentNode?.replaceChild(fragment, node);
        });
        editor._savedRange = null;
    }

    setShiftNotebookStatus(message, mode = 'saved') {
        const status = document.getElementById('shift-notebook-status');
        if ((mode === 'moved' || mode === 'error') && document.querySelector('.shift-notebook-modal')) {
            this.showShiftNotebookNotice(message, mode);
        }
        if (!status) return;
        const icons = { saving: 'fa-spinner fa-spin', saved: 'fa-check', moved: 'fa-circle-info', error: 'fa-triangle-exclamation' };
        status.className = `shift-notebook-status ${mode}`;
        status.innerHTML = `<i class="fa-solid ${icons[mode] || icons.saved}"></i> ${this.escapeHtml(message)}`;
        clearTimeout(this._shiftNotebookStatusTimer);
        if (mode === 'moved' || mode === 'saved') {
            this._shiftNotebookStatusTimer = setTimeout(() => {
                if (document.getElementById('shift-notebook-status') === status) {
                    status.className = 'shift-notebook-status saved';
                    status.innerHTML = '<i class="fa-solid fa-check"></i> 保存済み';
                }
            }, 1600);
        }
    }

    showShiftNotebookNotice(message, mode = 'moved') {
        const container = document.getElementById('modal-container');
        if (!container) return;
        container.querySelectorAll('.shift-notebook-notice').forEach(el => el.remove());
        const notice = document.createElement('div');
        notice.className = `shift-notebook-notice ${mode}`;
        const icons = { moved: 'fa-circle-info', saved: 'fa-check', saving: 'fa-spinner fa-spin', error: 'fa-triangle-exclamation' };
        notice.innerHTML = `<i class="fa-solid ${icons[mode] || icons.moved}"></i> ${this.escapeHtml(message)}`;
        container.appendChild(notice);
        requestAnimationFrame(() => notice.classList.add('show'));
        setTimeout(() => {
            notice.classList.remove('show');
            setTimeout(() => notice.remove(), 220);
        }, 1400);
    }

    showUndoNotice(message, undoCallback, expireCallback, container = document.body, variant = '') {
        if (!container) return;
        container.querySelectorAll('.shift-notebook-undo-toast').forEach(el => el.remove());
        const toast = document.createElement('div');
        toast.className = `shift-notebook-undo-toast ${variant}`.trim();
        toast.innerHTML = `
            <span><i class="fa-solid fa-trash-can"></i> ${this.escapeHtml(message)}</span>
            <span class="undo-countdown">5秒</span>
            <button type="button">取り消す</button>
        `;
        const countdown = toast.querySelector('.undo-countdown');
        let remaining = 5;
        const interval = setInterval(() => {
            remaining -= 1;
            if (countdown) countdown.textContent = `${Math.max(0, remaining)}秒`;
            if (remaining <= 0) clearInterval(interval);
        }, 1000);
        const timer = setTimeout(() => {
            clearInterval(interval);
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 220);
            expireCallback?.();
        }, 5000);
        toast.querySelector('button')?.addEventListener('click', () => {
            clearTimeout(timer);
            clearInterval(interval);
            toast.remove();
            undoCallback?.();
        });
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
    }

    showShiftNotebookUndoNotice(message, undoCallback) {
        this.showUndoNotice(message, undoCallback, null, document.getElementById('modal-container') || document.body);
    }

    getShiftNotebookRowDataFromElement(row) {
        if (!row) return null;
        const editor = row.querySelector('.shift-note-text');
        const html = this.sanitizeShiftNoteHtml(editor?.innerHTML || '');
        const text = this.stripShiftNoteHtml(html).trim();
        const photos = Array.from(row.querySelectorAll('.shift-photo-previews .shift-photo-item')).map(item => {
            const src = item.querySelector('img')?.src || '';
            const caption = item.querySelector('.shift-photo-caption')?.value.trim() || '';
            return caption ? { src, caption } : src;
        }).filter(photo => typeof photo === 'string' ? !!photo : !!photo.src);
        return {
            id: row.dataset.shiftRowId || '',
            replyTo: row.dataset.replyTo || '',
            group: row.querySelector('.shift-row-group-select')?.value || '未設定',
            tag: row.querySelector('.shift-note-tag-select')?.value || '通常',
            text,
            html,
            photos,
            hidden: !!row.querySelector('.shift-row-hide-checkbox')?.checked,
            important: row.classList.contains('shift-row-important')
        };
    }

    getShiftNotebookDateKey(dateStr, shift) {
        const order = { early: 0, late: 1, night: 2 };
        return `${dateStr}#${order[shift] ?? 0}`;
    }

    getNextShiftNotebookTarget(dateStr, shift) {
        const order = ['early', 'late', 'night'];
        const idx = order.indexOf(shift);
        if (idx >= 0 && idx < order.length - 1) {
            return { dateStr, shift: order[idx + 1] };
        }
        const d = new Date(dateStr);
        d.setDate(d.getDate() + 1);
        const nextDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { dateStr: nextDate, shift: 'early' };
    }

    getPreviousShiftNotebookTarget(dateStr, shift) {
        const order = ['early', 'late', 'night'];
        const idx = order.indexOf(shift);
        if (idx > 0) {
            return { dateStr, shift: order[idx - 1] };
        }
        const d = new Date(dateStr);
        d.setDate(d.getDate() - 1);
        const previousDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { dateStr: previousDate, shift: 'night' };
    }

    getPreviousFilledShiftNotebookTarget(dateStr, shift) {
        const notebooks = store.activeData.shiftNotebooks || {};
        const currentKey = this.getShiftNotebookDateKey(dateStr, shift);
        const candidates = [];
        Object.keys(notebooks).forEach(d => {
            ['early', 'late', 'night'].forEach(s => {
                const dayData = notebooks[d] || {};
                const notebookData = dayData[s];
                if (!notebookData && !(Array.isArray(dayData.sharedRows) && dayData.sharedRows.length > 0)) return;
                const { rows, members } = this.getShiftNotebookRowsForShift(dayData, s);
                const hasRows = (rows || []).some(row => (row?.text || '').trim() || (Array.isArray(row?.photos) && row.photos.length > 0));
                const hasMembers = (members || []).length > 0;
                const key = this.getShiftNotebookDateKey(d, s);
                if ((hasRows || hasMembers) && key < currentKey) candidates.push({ dateStr: d, shift: s, key });
            });
        });
        candidates.sort((a, b) => b.key.localeCompare(a.key));
        return candidates[0] || null;
    }

    getNextFilledShiftNotebookTarget(dateStr, shift) {
        const notebooks = store.activeData.shiftNotebooks || {};
        const currentKey = this.getShiftNotebookDateKey(dateStr, shift);
        const candidates = [];
        Object.keys(notebooks).forEach(d => {
            ['early', 'late', 'night'].forEach(s => {
                const dayData = notebooks[d] || {};
                const notebookData = dayData[s];
                if (!notebookData && !(Array.isArray(dayData.sharedRows) && dayData.sharedRows.length > 0)) return;
                const { rows, members } = this.getShiftNotebookRowsForShift(dayData, s);
                const hasRows = (rows || []).some(row => (row?.text || '').trim() || (Array.isArray(row?.photos) && row.photos.length > 0));
                const hasMembers = (members || []).length > 0;
                const key = this.getShiftNotebookDateKey(d, s);
                if ((hasRows || hasMembers) && key > currentKey) candidates.push({ dateStr: d, shift: s, key });
            });
        });
        candidates.sort((a, b) => a.key.localeCompare(b.key));
        return candidates[0] || null;
    }

    startShiftNotebookNextHold(event) {
        this._shiftNotebookNextLongPressed = false;
        clearTimeout(this._shiftNotebookNextHoldTimer);
        this._shiftNotebookNextHoldTimer = setTimeout(() => {
            this._shiftNotebookNextLongPressed = true;
            const editing = this._editingShiftNotebook;
            if (editing) this.moveShiftNotebookToTarget(this.getNextFilledShiftNotebookTarget(editing.dateStr, editing.shift));
        }, 650);
    }

    cancelShiftNotebookNextHold() {
        clearTimeout(this._shiftNotebookNextHoldTimer);
    }

    finishShiftNotebookNextHold(event) {
        clearTimeout(this._shiftNotebookNextHoldTimer);
        if (this._shiftNotebookNextLongPressed) {
            event?.preventDefault();
            event?.stopPropagation();
            setTimeout(() => { this._shiftNotebookNextLongPressed = false; }, 0);
        }
    }

    updateShiftGroupChant() {
        const input = document.getElementById('shift-group-members');
        const display = document.getElementById('shift-group-chant-display');
        const editing = this._editingShiftNotebook;
        if (!input || !display || !editing) return;
        
        const members = input.value.split(',').map(m => m.trim()).filter(Boolean);
        if (members.length === 0) {
            display.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-light);">※メンバーを入力すると安全唱和の担当者が自動で割り当てられます</span>';
            const absencePanel = document.getElementById('shift-absence-manage');
            if (absencePanel) absencePanel.innerHTML = '';
            return;
        }
        
        const [y, m, d] = editing.dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const daysSinceEpoch = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
        const turnIndex = daysSinceEpoch % members.length;
        
        display.innerHTML = members.map((m, i) => {
            const isTurn = i === turnIndex;
            const memberType = this.getShiftMemberType(m);
            return `<span class="shift-member-stamp ${memberType} ${isTurn ? 'active' : ''}" draggable="true" ondragstart="app.startShiftMemberStampDrag(event, '${this.escapeJs(m)}')" ondragend="app.finishShiftMemberStampDrag()" title="${this.escapeHtml(this.getShiftMemberTypeLabel(memberType))}">${this.escapeHtml(m)}</span>`;
        }).join('');

        const absencePanel = document.getElementById('shift-absence-manage');
        if (absencePanel && !absencePanel.classList.contains('hidden')) {
            absencePanel.innerHTML = members.map(m => `
                <button type="button" class="shift-member-remove-chip" onclick="app.removeShiftMemberByName('${m.replace(/'/g, "\\'")}')">
                    ${this.escapeHtml(m)} <i class="fa-solid fa-xmark"></i>
                </button>
            `).join('');
        }
    }

    moveShiftNotebookToTarget(target) {
        if (!target) {
            this.setShiftNotebookStatus('移動先がありません', 'error');
            return;
        }
        const editing = this._editingShiftNotebook;
        if (editing) this.saveShiftNotebook(editing.dateStr, editing.shift, { close: false, render: false });
        this.closeModal();
        this.openShiftNotebookModal(target.dateStr, target.shift);
        setTimeout(() => this.setShiftNotebookStatus('移動しました', 'moved'), 120);
    }

    moveShiftNotebookToPreviousFilled() {
        const editing = this._editingShiftNotebook;
        if (!editing) return;
        this.moveShiftNotebookToTarget(this.getPreviousFilledShiftNotebookTarget(editing.dateStr, editing.shift));
    }

    moveShiftNotebookToPreviousShift() {
        const editing = this._editingShiftNotebook;
        if (!editing) return;
        this.moveShiftNotebookToTarget(this.getPreviousShiftNotebookTarget(editing.dateStr, editing.shift));
    }

    handleShiftNotebookPrevClick(event) {
        clearTimeout(this._shiftNotebookPrevClickTimer);
        this._shiftNotebookPrevClickTimer = setTimeout(() => {
            this.moveShiftNotebookToPreviousShift();
        }, 220);
    }

    handleShiftNotebookPrevDoubleClick(event) {
        event?.preventDefault();
        event?.stopPropagation();
        clearTimeout(this._shiftNotebookPrevClickTimer);
        this.moveShiftNotebookToPreviousFilled();
    }

    moveShiftNotebookToNextShift() {
        if (this._shiftNotebookNextLongPressed) return;
        const editing = this._editingShiftNotebook;
        if (!editing) return;
        this.moveShiftNotebookToTarget(this.getNextShiftNotebookTarget(editing.dateStr, editing.shift));
    }

    getShiftGroupMembersFromInput() {
        const input = document.getElementById('shift-group-members');
        return (input?.value || '').split(',').map(v => v.trim()).filter(Boolean);
    }

    applyShiftGroupPreset(index) {
        if (index === '') return;
        if (index === '__previous_day__') {
            this.applyPreviousDayShiftGroup();
            return;
        }
        const preset = (store.activeData.shiftNotebookGroupPresets || [])[Number(index)];
        const input = document.getElementById('shift-group-members');
        if (!preset || !input) return;
        input.value = (preset.members || []).join(', ');
        this.updateShiftGroupChant();
        input.focus();
    }

    getPreviousDateStr(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() - 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    applyPreviousDayShiftGroup() {
        const editing = this._editingShiftNotebook;
        const input = document.getElementById('shift-group-members');
        if (!editing || !input) return;

        const previousDate = this.getPreviousDateStr(editing.dateStr);
        const previousData = store.activeData.shiftNotebooks?.[previousDate]?.[editing.shift];
        const members = Array.isArray(previousData?.members) ? previousData.members : [];

        if (members.length === 0) {
            alert('前日の同じシフトに登録されたメンバーがありません。');
            return;
        }

        input.value = members.join(', ');
        this.updateShiftGroupChant();
        input.focus();
    }

    removeShiftAbsentMember() {
        const input = document.getElementById('shift-group-members');
        if (!input) return;
        const panel = document.getElementById('shift-absence-manage');
        if (!panel) return;
        panel.classList.toggle('hidden');
        this.updateShiftGroupChant();
    }

    removeShiftMemberByName(name) {
        const input = document.getElementById('shift-group-members');
        if (!input || !name) return;
        const target = MaintenanceStore.toHalfWidthLower(name);
        const members = this.getShiftGroupMembersFromInput();
        const filtered = members.filter(member => MaintenanceStore.toHalfWidthLower(member) !== target);
        input.value = filtered.join(', ');
        this.updateShiftGroupChant();
        this.scheduleShiftNotebookAutoSave();
        input.focus();
    }

    renderShiftGroupPresetOptions(selectedValue = '') {
        const select = document.getElementById('shift-group-preset');
        if (!select) return;
        select.innerHTML = `
            <option value="">プリセット</option>
            <option value="__previous_day__">前日と同じ</option>
            ${(store.activeData.shiftNotebookGroupPresets || []).map((p, idx) => `<option value="${idx}">${this.escapeHtml(p.name)}</option>`).join('')}
        `;
        select.value = selectedValue;
    }

    saveShiftGroupPreset() {
        if (!store.activeData.shiftNotebookGroupPresets) store.activeData.shiftNotebookGroupPresets = [];
        const members = this.getShiftGroupMembersFromInput();
        if (members.length === 0) {
            alert('プリセット登録するメンバーを入力してください。');
            return;
        }
        const defaultName = members.join('・');
        const name = prompt('プリセット名を入力してください。', defaultName);
        if (!name) return;
        const existingIndex = store.activeData.shiftNotebookGroupPresets.findIndex(p => p.name === name);
        const preset = { name, members };
        if (existingIndex >= 0) {
            store.activeData.shiftNotebookGroupPresets[existingIndex] = preset;
        } else {
            store.activeData.shiftNotebookGroupPresets.push(preset);
        }
        const types = this.ensureShiftNotebookMemberTypes();
        members.forEach(member => { if (!types[member]) types[member] = 'core'; });
        store.save();

        const idx = store.activeData.shiftNotebookGroupPresets.findIndex(p => p.name === name);
        this.renderShiftGroupPresetOptions(String(idx));
    }

    editShiftGroupPreset() {
        if (!store.activeData.shiftNotebookGroupPresets) store.activeData.shiftNotebookGroupPresets = [];
        const select = document.getElementById('shift-group-preset');
        const input = document.getElementById('shift-group-members');
        if (!select || !input || select.value === '' || select.value === '__previous_day__') {
            alert('編集するプリセットを選んでください。');
            return;
        }

        const index = Number(select.value);
        const preset = store.activeData.shiftNotebookGroupPresets[index];
        if (!preset) return;

        const name = prompt('プリセット名を編集してください。', preset.name);
        if (!name) return;
        const memberText = prompt('メンバーをカンマ区切りで編集してください。', (preset.members || []).join(', '));
        if (memberText === null) return;
        const members = memberText.split(',').map(v => v.trim()).filter(Boolean);
        if (members.length === 0) {
            alert('メンバーを1人以上入力してください。');
            return;
        }

        store.activeData.shiftNotebookGroupPresets[index] = { name, members };
        const types = this.ensureShiftNotebookMemberTypes();
        members.forEach(member => { if (!types[member]) types[member] = 'core'; });
        store.save();
        input.value = members.join(', ');
        this.renderShiftGroupPresetOptions(String(index));
    }

    deleteShiftGroupPreset() {
        if (!store.activeData.shiftNotebookGroupPresets) store.activeData.shiftNotebookGroupPresets = [];
        const select = document.getElementById('shift-group-preset');
        if (!select || select.value === '' || select.value === '__previous_day__') {
            alert('削除するプリセットを選んでください。');
            return;
        }

        const index = Number(select.value);
        const preset = store.activeData.shiftNotebookGroupPresets[index];
        if (!preset) return;
        store.activeData.shiftNotebookGroupPresets.splice(index, 1);
        store.save();
        this.renderShiftGroupPresetOptions('');
        this.showUndoNotice(`プリセット「${preset.name || '名称未設定'}」を削除しました`, () => {
            store.activeData.shiftNotebookGroupPresets.splice(index, 0, preset);
            store.save();
            this.renderShiftGroupPresetOptions(String(index));
        }, null, document.getElementById('modal-container') || document.body);
    }

    ensureShiftNotebookMemberTypes() {
        if (!store.activeData.shiftNotebookMemberTypes || typeof store.activeData.shiftNotebookMemberTypes !== 'object') {
            store.activeData.shiftNotebookMemberTypes = {};
        }
        if (!Array.isArray(store.activeData.shiftNotebookMemberOrder)) {
            store.activeData.shiftNotebookMemberOrder = [];
        }
        const types = store.activeData.shiftNotebookMemberTypes;
        const order = store.activeData.shiftNotebookMemberOrder;
        this.getShiftNotebookPresetMemberNames({ raw: true }).forEach(name => {
            if (!types[name]) types[name] = 'core';
            if (!order.includes(name)) order.push(name);
        });
        store.activeData.shiftNotebookMemberOrder = order.filter(name => this.getShiftNotebookPresetMemberNames({ raw: true }).includes(name));
        return types;
    }

    getShiftNotebookPresetMemberNames(options = {}) {
        const names = new Set();
        (store.activeData.shiftNotebookGroupPresets || []).forEach(preset => {
            (preset.members || []).forEach(member => {
                const name = String(member || '').trim();
                if (name) names.add(name);
            });
        });
        const list = Array.from(names);
        if (options.raw) return list.sort((a, b) => a.localeCompare(b, 'ja'));
        const types = store.activeData.shiftNotebookMemberTypes || {};
        const order = Array.isArray(store.activeData.shiftNotebookMemberOrder) ? store.activeData.shiftNotebookMemberOrder : [];
        const getOrder = (name) => {
            const idx = order.indexOf(name);
            return idx >= 0 ? idx : 9999;
        };
        return list.sort((a, b) => {
            const typeA = types[a] === 'support' ? 1 : 0;
            const typeB = types[b] === 'support' ? 1 : 0;
            return typeA - typeB || getOrder(a) - getOrder(b) || a.localeCompare(b, 'ja');
        });
    }

    getShiftMemberType(name) {
        const types = this.ensureShiftNotebookMemberTypes();
        return types[name] === 'support' ? 'support' : 'core';
    }

    getShiftMemberTypeLabel(type) {
        return type === 'support' ? 'サポート社員' : '基幹社員';
    }

    openShiftMemberTypeManageModal() {
        const editing = this._editingShiftNotebook;
        if (editing && document.getElementById('shift-notebook-rows')) {
            this.saveShiftNotebook(editing.dateStr, editing.shift, { close: false, render: false, status: false });
        }
        const types = this.ensureShiftNotebookMemberTypes();
        const names = this.getShiftNotebookPresetMemberNames();
        const presetMap = new Map();
        (store.activeData.shiftNotebookGroupPresets || []).forEach(preset => {
            (preset.members || []).forEach(member => {
                const name = String(member || '').trim();
                if (!name) return;
                if (!presetMap.has(name)) presetMap.set(name, []);
                presetMap.get(name).push(preset.name || '名称未設定');
            });
        });
        const rows = names.map(name => {
            const type = types[name] === 'support' ? 'support' : 'core';
            const presets = (presetMap.get(name) || []).slice(0, 4);
            return `
                <div class="shift-member-type-row ${type}">
                    <div class="shift-member-type-name">
                        <input type="text" value="${this.escapeHtml(name)}" onkeydown="if(event.key==='Enter') app.renameShiftMember('${this.escapeJs(name)}', this.value)" onblur="app.renameShiftMember('${this.escapeJs(name)}', this.value)">
                        <span>${this.getShiftMemberTypeLabel(type)}</span>
                    </div>
                    <div class="shift-member-type-presets">
                        ${presets.map(p => `<small>${this.escapeHtml(p)}</small>`).join('')}
                    </div>
                    <div class="shift-member-type-controls">
                        <select onchange="app.updateShiftMemberType('${this.escapeJs(name)}', this.value)">
                            <option value="core" ${type === 'core' ? 'selected' : ''}>基幹社員</option>
                            <option value="support" ${type === 'support' ? 'selected' : ''}>サポート社員</option>
                        </select>
                        <button type="button" class="secondary-btn shift-member-groups-btn" title="所属班を変更" onclick="app.editShiftMemberGroups('${this.escapeJs(name)}')">
                            <i class="fa-solid fa-people-group"></i> 班
                        </button>
                        <button type="button" class="icon-btn" title="上へ" onclick="app.moveShiftMemberOrder('${this.escapeJs(name)}', -1)"><i class="fa-solid fa-arrow-up"></i></button>
                        <button type="button" class="icon-btn" title="下へ" onclick="app.moveShiftMemberOrder('${this.escapeJs(name)}', 1)"><i class="fa-solid fa-arrow-down"></i></button>
                        <button type="button" class="icon-btn danger" title="削除" onclick="app.deleteShiftMemberFromPresets('${this.escapeJs(name)}')"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        this.openModal('shift-member-type-manage', 'プリセット人名管理', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="shift-member-type-manager">
                    <div class="shift-member-type-summary">
                        <div><b>${names.filter(n => types[n] !== 'support').length}</b><span>基幹社員</span></div>
                        <div><b>${names.filter(n => types[n] === 'support').length}</b><span>サポート社員</span></div>
                    </div>
                    <p class="shift-member-type-help">プリセットに登録されている人名を、基幹社員とサポート社員に分けて管理します。ここで変えた区分は返信者一覧にも反映されます。</p>
                    ${names.length ? `<div class="shift-member-type-list">${rows}</div>` : '<div class="shift-member-type-empty">プリセットに人名がありません。</div>'}
                </div>
            `;
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
        });
    }

    updateShiftMemberType(name, type) {
        const memberName = String(name || '').trim();
        if (!memberName) return;
        const types = this.ensureShiftNotebookMemberTypes();
        types[memberName] = type === 'support' ? 'support' : 'core';
        this.sortShiftPresetMembersByManagedOrder();
        store.save();
        this.openShiftMemberTypeManageModal();
    }

    renameShiftMember(oldName, newName) {
        oldName = String(oldName || '').trim();
        newName = String(newName || '').trim();
        if (!oldName || !newName || oldName === newName) return;
        const names = this.getShiftNotebookPresetMemberNames({ raw: true });
        if (names.includes(newName)) {
            alert('同じ名前がすでにあります。');
            this.openShiftMemberTypeManageModal();
            return;
        }
        (store.activeData.shiftNotebookGroupPresets || []).forEach(preset => {
            preset.members = (preset.members || []).map(member => String(member || '').trim() === oldName ? newName : member);
        });
        const types = this.ensureShiftNotebookMemberTypes();
        types[newName] = types[oldName] || 'core';
        delete types[oldName];
        const order = store.activeData.shiftNotebookMemberOrder || [];
        const idx = order.indexOf(oldName);
        if (idx >= 0) order[idx] = newName;
        if (!order.includes(newName)) order.push(newName);
        (store.activeData.localTodoWorkers || []).forEach(worker => {
            if (worker.name === oldName) worker.name = newName;
        });
        this.sortShiftPresetMembersByManagedOrder();
        store.save();
        this.renderShiftGroupPresetOptions(document.getElementById('shift-group-preset')?.value || '');
        this.openShiftMemberTypeManageModal();
    }

    deleteShiftMemberFromPresets(name) {
        name = String(name || '').trim();
        if (!name) return;
        if (!confirm(`「${name}」をすべてのプリセットから削除しますか？`)) return;
        (store.activeData.shiftNotebookGroupPresets || []).forEach(preset => {
            preset.members = (preset.members || []).filter(member => String(member || '').trim() !== name);
        });
        store.activeData.shiftNotebookGroupPresets = (store.activeData.shiftNotebookGroupPresets || []).filter(preset => (preset.members || []).length > 0);
        if (store.activeData.shiftNotebookMemberTypes) delete store.activeData.shiftNotebookMemberTypes[name];
        store.activeData.shiftNotebookMemberOrder = (store.activeData.shiftNotebookMemberOrder || []).filter(member => member !== name);
        store.save();
        this.renderShiftGroupPresetOptions('');
        this.openShiftMemberTypeManageModal();
    }

    getShiftMemberGroups(name) {
        name = String(name || '').trim();
        return (store.activeData.shiftNotebookGroupPresets || [])
            .filter(preset => (preset.members || []).some(member => String(member || '').trim() === name))
            .map(preset => preset.name || '名称未設定');
    }

    editShiftMemberGroups(name) {
        name = String(name || '').trim();
        if (!name) return;
        const currentGroups = this.getShiftMemberGroups(name);
        const value = prompt('所属する班名をカンマ区切りで入力してください。既存にない班名は新しく作成します。', currentGroups.join(', '));
        if (value === null) return;
        const nextGroups = Array.from(new Set(value.split(',').map(v => v.trim()).filter(Boolean)));
        if (nextGroups.length === 0) {
            alert('所属班を1つ以上入力してください。削除したい場合はゴミ箱ボタンを使ってください。');
            this.openShiftMemberTypeManageModal();
            return;
        }

        const presets = store.activeData.shiftNotebookGroupPresets || [];
        presets.forEach(preset => {
            preset.members = (preset.members || []).filter(member => String(member || '').trim() !== name);
        });
        nextGroups.forEach(groupName => {
            let preset = presets.find(p => (p.name || '') === groupName);
            if (!preset) {
                preset = { name: groupName, members: [] };
                presets.push(preset);
            }
            if (!(preset.members || []).some(member => String(member || '').trim() === name)) {
                preset.members = [...(preset.members || []), name];
            }
        });
        store.activeData.shiftNotebookGroupPresets = presets.filter(preset => (preset.members || []).length > 0);
        this.sortShiftPresetMembersByManagedOrder();
        store.save();
        this.renderShiftGroupPresetOptions(document.getElementById('shift-group-preset')?.value || '');
        this.openShiftMemberTypeManageModal();
    }

    moveShiftMemberOrder(name, direction) {
        name = String(name || '').trim();
        direction = direction < 0 ? -1 : 1;
        const types = this.ensureShiftNotebookMemberTypes();
        const ordered = this.getShiftNotebookPresetMemberNames().filter(member => (types[member] === 'support') === (types[name] === 'support'));
        const idx = ordered.indexOf(name);
        const swapIdx = idx + direction;
        if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
        const target = ordered[swapIdx];
        const order = store.activeData.shiftNotebookMemberOrder || [];
        const a = order.indexOf(name);
        const b = order.indexOf(target);
        if (a < 0 || b < 0) return;
        [order[a], order[b]] = [order[b], order[a]];
        this.sortShiftPresetMembersByManagedOrder();
        store.save();
        this.openShiftMemberTypeManageModal();
    }

    sortShiftPresetMembersByManagedOrder() {
        const types = this.ensureShiftNotebookMemberTypes();
        const order = store.activeData.shiftNotebookMemberOrder || [];
        const orderIndex = (name) => {
            const idx = order.indexOf(name);
            return idx >= 0 ? idx : 9999;
        };
        (store.activeData.shiftNotebookGroupPresets || []).forEach(preset => {
            const seen = new Set();
            preset.members = (preset.members || [])
                .map(member => String(member || '').trim())
                .filter(member => member && !seen.has(member) && seen.add(member))
                .sort((a, b) => {
                    const typeA = types[a] === 'support' ? 1 : 0;
                    const typeB = types[b] === 'support' ? 1 : 0;
                    return typeA - typeB || orderIndex(a) - orderIndex(b) || a.localeCompare(b, 'ja');
                });
        });
    }

    getShiftNotebookTagOptions(selected = '通常') {
        if (!store.activeData.shiftNotebookTags) store.activeData.shiftNotebookTags = ['通常', '注意', '至急'];
        return store.activeData.shiftNotebookTags.map(tag => `<option value="${this.escapeHtml(tag)}" ${tag === selected ? 'selected' : ''}>${this.escapeHtml(tag)}</option>`).join('') +
            `<option value="ADD_NEW_TAG">+ 新規作成</option>`;
    }

    getShiftNotebookTagClass(tag) {
        if (tag === '注意') return 'warning';
        if (tag === '至急') return 'urgent';
        return 'normal';
    }

    onShiftNotebookTagChange(select) {
        if (!select) return;
        if (select.value === 'ADD_NEW_TAG') {
            const name = prompt('新しい表示区分を入力してください。');
            if (!name) {
                select.value = '通常';
            } else {
                if (!store.activeData.shiftNotebookTags) store.activeData.shiftNotebookTags = ['通常', '注意', '至急'];
                if (!store.activeData.shiftNotebookTags.includes(name)) {
                    store.activeData.shiftNotebookTags.push(name);
                    store.save();
                }
                document.querySelectorAll('.shift-note-tag-select').forEach(sel => {
                    const current = sel === select ? name : sel.value;
                    sel.innerHTML = this.getShiftNotebookTagOptions(current);
                    sel.value = current;
                });
            }
        }
        
        const row = select.closest('.shift-notebook-row');
        if (row) {
            const currentClass = Array.from(row.classList).find(c => c.startsWith('tag-'));
            if (currentClass) row.classList.remove(currentClass);
            row.classList.add(`tag-${this.getShiftNotebookTagClass(select.value)}`);
        }
        this.scheduleShiftNotebookAutoSave();
    }

    getShiftNotebookRowGroupOptions(selected = '未設定') {
        if (!store.activeData.shiftNotebookRowGroups) store.activeData.shiftNotebookRowGroups = ['4号L', '5号L'];
        const groups = ['未設定', ...this.getShiftNotebookOrderedRowGroups()];
        return groups.map(group => `<option value="${this.escapeHtml(group)}" ${group === selected ? 'selected' : ''}>${this.escapeHtml(group)}</option>`).join('') +
            `<option value="ADD_NEW_ROW_GROUP">+ 新規作成</option>`;
    }

    getShiftNotebookRowGroupStyle(group = '未設定') {
        const palette = [
            { bg: '#bfdbfe', border: '#3b82f6' },
            { bg: '#bbf7d0', border: '#22c55e' },
            { bg: '#fed7aa', border: '#f97316' },
            { bg: '#fbcfe8', border: '#ec4899' },
            { bg: '#ddd6fe', border: '#8b5cf6' },
            { bg: '#a5f3fc', border: '#06b6d4' },
            { bg: '#fde68a', border: '#eab308' },
            { bg: '#cbd5e1', border: '#64748b' }
        ];
        if (!group || group === '未設定') return `--shift-row-bg:#ffffff; --shift-row-border:#cbd5e1;`;
        if (this.isShiftNotebookThroughGroup(group)) return `--shift-row-bg:#fef3c7; --shift-row-border:#d97706;`;
        let hash = 0;
        for (let i = 0; i < group.length; i++) hash = group.charCodeAt(i) + ((hash << 5) - hash);
        const color = palette[Math.abs(hash) % palette.length];
        return `--shift-row-bg:${color.bg}; --shift-row-border:${color.border};`;
    }

    getShiftNotebookRowGroupsForUi() {
        if (!store.activeData.shiftNotebookRowGroups) store.activeData.shiftNotebookRowGroups = ['4号L', '5号L'];
        return ['未設定', ...this.getShiftNotebookOrderedRowGroups()];
    }

    getShiftNotebookOrderedRowGroups() {
        if (!store.activeData.shiftNotebookRowGroups) store.activeData.shiftNotebookRowGroups = ['4号L', '5号L'];
        const special = this.getShiftNotebookThroughGroupName();
        const groups = store.activeData.shiftNotebookRowGroups.filter(g => g && g !== '未設定');
        return groups.includes(special) ? groups : [special, ...groups];
    }

    getShiftRowGroupStampButtonsHtml() {
        const stamps = this.getShiftNotebookOrderedRowGroups().map(group => `
            <button type="button" class="shift-row-group-stamp" draggable="true"
                style="${this.getShiftNotebookRowGroupStyle(group)}"
                title="${this.escapeHtml(group)}の空行をドラッグして挿入"
                ondragstart="app.startShiftRowGroupStampDrag(event, '${this.escapeJs(group)}')"
                ondragend="app.finishShiftRowGroupStampDrag()">
                ${this.escapeHtml(group)}
            </button>
        `).join('');
        return `${stamps}
            <div class="shift-row-group-trash"
                title="グループスタンプをここへドラッグして削除"
                ondragover="app.handleShiftRowGroupTrashDragOver(event)"
                ondragleave="app.handleShiftRowGroupTrashDragLeave(event)"
                ondrop="app.handleShiftRowGroupTrashDrop(event)">
                <i class="fa-solid fa-trash-can"></i>
            </div>`;
    }

    refreshShiftRowGroupStamps() {
        const panel = document.getElementById('shift-row-group-stamps');
        if (panel) panel.innerHTML = this.getShiftRowGroupStampButtonsHtml();
    }

    sortShiftNotebookRows(rows = []) {
        const order = ['未設定', ...this.getShiftNotebookOrderedRowGroups()];
        const getOrder = (group) => {
            const idx = order.indexOf(group || '未設定');
            return idx === -1 ? order.length : idx;
        };
        const sorted = [...rows].sort((a, b) => {
            const groupDiff = getOrder(a.group) - getOrder(b.group);
            if (groupDiff !== 0) return groupDiff;
            return (a.index ?? a._sourceIndex ?? 0) - (b.index ?? b._sourceIndex ?? 0);
        });
        const byParent = new Map();
        sorted.forEach(row => {
            const parentId = row.replyTo || '';
            if (!parentId) return;
            if (!byParent.has(parentId)) byParent.set(parentId, []);
            byParent.get(parentId).push(row);
        });
        const byId = new Map(sorted.map(row => [row.id || row.element?.dataset?.shiftRowId || '', row]));
        const added = new Set();
        const result = [];
        const appendThread = (row) => {
            const id = row.id || row.element?.dataset?.shiftRowId || '';
            if (id && added.has(id)) return;
            if (id) added.add(id);
            result.push(row);
            (byParent.get(id) || []).forEach(appendThread);
        };
        sorted.forEach(row => {
            const parentId = row.replyTo || '';
            if (parentId && byId.has(parentId)) return;
            appendThread(row);
        });
        return result;
    }

    onShiftNotebookRowGroupChange(select) {
        if (!select) return;
        if (select.value === 'ADD_NEW_ROW_GROUP') {
            const name = prompt('新しいグループ名を入力してください。（例: 4号L）');
            if (!name) {
                select.value = '未設定';
            } else {
                if (!store.activeData.shiftNotebookRowGroups) store.activeData.shiftNotebookRowGroups = ['4号L', '5号L'];
                if (!this.isShiftNotebookThroughGroup(name) && !store.activeData.shiftNotebookRowGroups.includes(name)) {
                    store.activeData.shiftNotebookRowGroups.push(name);
                    store.save();
                }
                document.querySelectorAll('.shift-row-group-select').forEach(sel => {
                    const current = sel === select ? name : sel.value;
                    sel.innerHTML = this.getShiftNotebookRowGroupOptions(current);
                    sel.value = current;
                });
                this.refreshShiftRowGroupStamps();
            }
        }
        const row = select.closest('.shift-notebook-row');
        if (row) row.setAttribute('style', this.getShiftNotebookRowGroupStyle(select.value));
        this.lastShiftNotebookRowGroup = select.value;
        this.updateShiftNotebookGroupCorners();
        this.scheduleShiftNotebookAutoSave();
    }

    openShiftRowGroupOrderModal() {
        if (!store.activeData.shiftNotebookRowGroups) store.activeData.shiftNotebookRowGroups = ['4号L', '5号L'];
        const groups = this.getShiftNotebookOrderedRowGroups();
        this.openModal('shift-row-group-order', '連絡帳グループの表示順', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="shift-row-group-order-note">
                    上にあるグループほど、連絡帳の上に表示されます。未設定は常に先頭です。
                </div>
                <div id="shift-row-group-order-list" class="shift-row-group-order-list">
                    ${groups.length === 0 ? '<div class="shift-row-group-order-empty">登録済みグループはありません。</div>' : groups.map(group => `
                        <div class="shift-row-group-order-item" data-group="${this.escapeHtml(group)}" style="${this.getShiftNotebookRowGroupStyle(group)}">
                            <span>${this.escapeHtml(group)}</span>
                            <div>
                                <button type="button" class="icon-btn" onclick="app.moveShiftRowGroupOrder(this, -1)" title="上へ"><i class="fa-solid fa-chevron-up"></i></button>
                                <button type="button" class="icon-btn" onclick="app.moveShiftRowGroupOrder(this, 1)" title="下へ"><i class="fa-solid fa-chevron-down"></i></button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) {
                saveBtn.classList.add('hidden');
            }
        });
    }

    moveShiftRowGroupOrder(button, direction) {
        const item = button?.closest('.shift-row-group-order-item');
        const list = document.getElementById('shift-row-group-order-list');
        if (!item || !list) return;
        if (direction < 0 && item.previousElementSibling) {
            list.insertBefore(item, item.previousElementSibling);
        } else if (direction > 0 && item.nextElementSibling) {
            list.insertBefore(item.nextElementSibling, item);
        }
        this.saveShiftRowGroupOrder({ keepOpen: true });
    }

    saveShiftRowGroupOrder(options = {}) {
        const groups = Array.from(document.querySelectorAll('#shift-row-group-order-list .shift-row-group-order-item'))
            .map(item => item.dataset.group)
            .filter(Boolean);
        store.activeData.shiftNotebookRowGroups = groups;
        store.save();
        if (!options.keepOpen) this.closeModal();
        this.sortShiftNotebookRowsInDom();
        this.renderShiftRowGroupSelectOptions();
        this.refreshShiftRowGroupStamps();
    }

    normalizeShiftNotebookPhoto(photo) {
        if (typeof photo === 'string') return { src: photo, caption: '' };
        return {
            src: photo?.src || photo?.url || photo?.data || '',
            caption: photo?.caption || ''
        };
    }

    renderShiftRowGroupSelectOptions() {
        document.querySelectorAll('.shift-row-group-select').forEach(select => {
            const current = select.value;
            select.innerHTML = this.getShiftNotebookRowGroupOptions(current);
            select.value = current;
        });
    }

    getShiftRowTemplateOptions() {
        const templates = store.activeData.shiftNotebookRowTemplates || [];
        return `
            <option value="">テンプレートから追加</option>
            ${templates.map(t => `<option value="${this.escapeHtml(t.id)}">${this.escapeHtml(this.getShiftRowTemplateKindLabel(t))}: ${this.escapeHtml(t.name)}</option>`).join('')}
        `;
    }

    shiftTemplateHasContent(template = {}) {
        if (template.isRowSet) {
            return (template.rows || []).some(row => {
                const text = row.text || this.stripShiftNoteHtml(row.html || '').trim();
                const photos = Array.isArray(row.photos) ? row.photos : [];
                return !!text || photos.length > 0;
            });
        }
        if (template.isBlankRow) return false;
        const text = template.text || this.stripShiftNoteHtml(template.html || '').trim();
        const photos = Array.isArray(template.photos) ? template.photos : [];
        return !!text || photos.length > 0;
    }

    getShiftRowTemplateKindLabel(template = {}) {
        const hasContent = this.shiftTemplateHasContent(template);
        if (template.isRowSet) return hasContent ? '記入あり行セット' : 'ブランク行セット';
        return hasContent ? '記入あり' : 'ブランク';
    }

    refreshShiftRowTemplateSelect() {
        const select = document.getElementById('shift-row-template-select');
        if (select) select.innerHTML = this.getShiftRowTemplateOptions();
    }

    saveShiftNotebookRowTemplate(button) {
        const row = button?.closest('.shift-notebook-row');
        const data = this.getShiftNotebookRowDataFromElement(row);
        if (!data || (!data.text && data.photos.length === 0)) {
            this.setShiftNotebookStatus('テンプレートにする内容がありません', 'error');
            return;
        }
        const defaultName = (data.text || '写真付きテンプレート').slice(0, 24);
        this.openShiftRowTemplateNamePanel(defaultName, (name) => {
            this.createShiftRowTemplate(name, data);
        });
    }

    saveShiftNotebookRowStyleTemplate(button) {
        const row = button?.closest('.shift-notebook-row');
        const data = this.getShiftNotebookRowDataFromElement(row);
        if (!data) return;
        const groupName = data.group || this.lastShiftNotebookRowGroup || '未設定';
        const defaultName = `${groupName} 空行`;
        this.openShiftRowTemplateNamePanel(defaultName, (name) => {
            this.createShiftRowTemplate(name, {
                group: data.group,
                tag: data.tag,
                text: '',
                html: '',
                photos: [],
                isBlankRow: true
            });
        });
    }

    getShiftNotebookRowsForTemplateSet() {
        return Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row')).map(row => {
            const data = this.getShiftNotebookRowDataFromElement(row);
            return {
                group: data?.group || '未設定',
                tag: data?.tag || '通常',
                text: data?.text || '',
                html: data?.html || '',
                photos: data?.photos || [],
                important: !!data?.important
            };
        });
    }

    getShiftRowSetSummary(rows = []) {
        const counts = new Map();
        rows.forEach(row => {
            const group = row.group || '未設定';
            counts.set(group, (counts.get(group) || 0) + 1);
        });
        return Array.from(counts.entries()).map(([group, count]) => `${group} ${count}行`).join(' / ');
    }

    saveShiftNotebookRowSetTemplate() {
        const rows = this.getShiftNotebookRowsForTemplateSet();
        if (rows.length === 0) {
            this.setShiftNotebookStatus('保存する行セットがありません', 'error');
            return;
        }
        const hasContent = rows.some(row => row.text || this.stripShiftNoteHtml(row.html || '').trim() || (row.photos || []).length > 0);
        const defaultName = `${this.getShiftRowSetSummary(rows) || '行セット'} ${hasContent ? '記入あり' : 'ブランク'}`;
        this.openShiftRowTemplateNamePanel(defaultName, (name) => {
            this.createShiftRowTemplate(name, {
                group: rows[0]?.group || '未設定',
                tag: rows[0]?.tag || '通常',
                text: '',
                html: '',
                photos: [],
                isRowSet: true,
                rows
            });
        });
    }

    openShiftRowTemplateNamePanel(defaultName = '', onSave = null) {
        const container = document.getElementById('modal-container');
        if (!container) return;
        container.querySelectorAll('.shift-template-name-panel').forEach(el => el.remove());
        const panel = document.createElement('div');
        panel.className = 'shift-template-name-panel';
        panel.innerHTML = `
            <div class="shift-template-name-card">
                <div class="shift-template-name-title">テンプレート名</div>
                <input type="text" class="shift-template-name-input" value="${this.escapeHtml(defaultName)}" placeholder="テンプレート名">
                <div class="shift-template-name-actions">
                    <button type="button" class="secondary-btn">キャンセル</button>
                    <button type="button" class="primary-btn">保存</button>
                </div>
            </div>
        `;
        const input = panel.querySelector('.shift-template-name-input');
        const close = () => panel.remove();
        const save = () => {
            const name = input?.value.trim();
            if (!name) {
                input?.focus();
                return;
            }
            close();
            onSave?.(name);
        };
        panel.querySelector('.secondary-btn')?.addEventListener('click', close);
        panel.querySelector('.primary-btn')?.addEventListener('click', save);
        input?.addEventListener('keydown', e => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') close();
        });
        container.appendChild(panel);
        setTimeout(() => {
            input?.focus();
            input?.select();
        }, 0);
    }

    createShiftRowTemplate(name, data) {
        if (!store.activeData.shiftNotebookRowTemplates) store.activeData.shiftNotebookRowTemplates = [];
        store.activeData.shiftNotebookRowTemplates.push({
            id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            name,
            group: data.group,
            tag: data.tag,
            text: data.text,
            html: data.html,
            photos: data.photos,
            important: !!data.important,
            isBlankRow: !!data.isBlankRow,
            isRowSet: !!data.isRowSet,
            rows: Array.isArray(data.rows) ? data.rows.map(row => ({
                group: row.group || '未設定',
                tag: row.tag || '通常',
                text: row.text || '',
                html: row.html || '',
                photos: Array.isArray(row.photos) ? row.photos : [],
                important: !!row.important
            })) : undefined
        });
        store.save();
        this.refreshShiftRowTemplateSelect();
        this.setShiftNotebookStatus('テンプレートを保存しました', 'saved');
    }

    addShiftNotebookRowFromTemplate(templateId) {
        if (!templateId) return;
        const template = (store.activeData.shiftNotebookRowTemplates || []).find(t => t.id === templateId);
        if (!template) return;
        this.removeOnlyBlankUnsetShiftNotebookRow();
        if (template.isRowSet) {
            const rows = Array.isArray(template.rows) && template.rows.length > 0 ? template.rows : [{ group: template.group || '未設定', tag: template.tag || '通常' }];
            const addedRows = rows.map(row => this.addShiftNotebookRow('shift-notebook-rows', row.text || '', row.photos || [], row.tag || '通常', row.group || this.lastShiftNotebookRowGroup || '未設定', row.html || '', false, true, '', '', !!row.important))
                .filter(Boolean);
            this.sortShiftNotebookRowsInDom();
            addedRows[0]?.querySelector('.shift-note-text')?.focus();
            this.autoSaveShiftNotebook(true);
            this.setShiftNotebookStatus(`${rows.length}行の行セットを追加しました`, 'saved');
            return;
        }
        const isBlankRow = !!template.isBlankRow;
        this.addShiftNotebookRow('shift-notebook-rows', isBlankRow ? '' : (template.text || ''), isBlankRow ? [] : (template.photos || []), template.tag || '通常', template.group || this.lastShiftNotebookRowGroup || '未設定', isBlankRow ? '' : (template.html || ''), false, true, '', '', !!template.important);
        const row = document.querySelector('#shift-notebook-rows .shift-notebook-row:last-child');
        row?.querySelector('.shift-note-text')?.focus();
        this.sortShiftNotebookRowsInDom();
        this.autoSaveShiftNotebook(true);
    }

    removeOnlyBlankUnsetShiftNotebookRow() {
        const container = document.getElementById('shift-notebook-rows');
        if (!container) return false;
        const rows = Array.from(container.querySelectorAll('.shift-notebook-row'));
        if (rows.length !== 1) return false;
        const data = this.getShiftNotebookRowDataFromElement(rows[0]);
        if (!data) return false;
        const isUnset = (data.group || '未設定') === '未設定';
        const hasContent = !!data.text || (data.photos || []).length > 0 || !!this.stripShiftNoteHtml(data.html || '').trim();
        if (!isUnset || hasContent) return false;
        rows[0].remove();
        return true;
    }

    openShiftRowTemplateManageModal() {
        if (!store.activeData.shiftNotebookRowTemplates) store.activeData.shiftNotebookRowTemplates = [];
        this.openModal('shift-row-template-manage', '連絡帳テンプレート管理', () => {
            const content = document.getElementById('modal-content');
            const render = () => {
                const templates = store.activeData.shiftNotebookRowTemplates || [];
                content.innerHTML = `
                    <div class="shift-template-manage-list">
                        ${templates.length === 0 ? '<div class="shift-template-empty">保存済みテンプレートはありません</div>' : templates.map((template, index) => {
                            const isBlankRow = !!template.isBlankRow;
                            const isRowSet = !!template.isRowSet;
                            const rowSetRows = Array.isArray(template.rows) ? template.rows : [];
                            const rowSetSummary = this.getShiftRowSetSummary(rowSetRows);
                            const kindLabel = this.getShiftRowTemplateKindLabel(template);
                            const text = isRowSet ? (rowSetSummary || '行セット') : (isBlankRow ? '空行テンプレート' : (template.text || this.stripShiftNoteHtml(template.html || '').trim() || '本文なし'));
                            const photoCount = Array.isArray(template.photos) ? template.photos.length : 0;
                            return `
                                <div class="shift-template-manage-item">
                                    <div class="shift-template-manage-main">
                                        <b>${this.escapeHtml(template.name || '名称未設定')}</b>
                                        <span>${this.escapeHtml(kindLabel)} / ${this.escapeHtml(text).slice(0, 90)}</span>
                                        <div class="shift-template-preview" style="${this.getShiftNotebookRowGroupStyle(template.group || '未設定')}">
                                            ${isRowSet ? `
                                                <div class="shift-template-rowset-preview">
                                                    ${rowSetRows.map(row => {
                                                        const rowText = row.text || this.stripShiftNoteHtml(row.html || '').trim();
                                                        const rowPhotos = Array.isArray(row.photos) ? row.photos : [];
                                                        return `<span class="shift-template-rowset-chip" style="${this.getShiftNotebookRowGroupStyle(row.group || '未設定')}"><b>${this.escapeHtml(row.group || '未設定')}</b>${rowText ? `<small>${this.escapeHtml(rowText).slice(0, 24)}</small>` : (rowPhotos.length ? `<small>写真 ${rowPhotos.length}枚</small>` : '')}</span>`;
                                                    }).join('')}
                                                </div>
                                            ` : `
                                                <div class="shift-template-preview-text">
                                                    ${isBlankRow ? '<span class="shift-template-blank-label">空の行として追加</span>' : (template.html ? this.sanitizeShiftNoteHtml(template.html) : this.shiftNoteTextToHtml(template.text || ''))}
                                                </div>
                                            `}
                                            ${!isBlankRow && photoCount ? `<div class="shift-template-preview-photos"><i class="fa-solid fa-image"></i> 写真 ${photoCount}枚</div>` : ''}
                                        </div>
                                    </div>
                                    <div class="shift-template-manage-actions">
                                        <button type="button" class="icon-btn" title="上へ" onclick="app.moveShiftRowTemplate(${index}, -1)"><i class="fa-solid fa-chevron-up"></i></button>
                                        <button type="button" class="icon-btn" title="下へ" onclick="app.moveShiftRowTemplate(${index}, 1)"><i class="fa-solid fa-chevron-down"></i></button>
                                        <button type="button" class="secondary-btn" onclick="app.renameShiftRowTemplate(${index})">名前変更</button>
                                        <button type="button" class="icon-btn" style="color:var(--danger);" title="削除" onclick="app.deleteShiftRowTemplate(${index})"><i class="fa-solid fa-trash-can"></i></button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            };
            render();
            this._renderShiftRowTemplateManager = render;
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
        });
    }

    rerenderShiftRowTemplateManager() {
        this._renderShiftRowTemplateManager?.();
        this.refreshShiftRowTemplateSelect();
    }

    moveShiftRowTemplate(index, direction) {
        const templates = store.activeData.shiftNotebookRowTemplates || [];
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= templates.length) return;
        const [item] = templates.splice(index, 1);
        templates.splice(nextIndex, 0, item);
        store.save();
        this.rerenderShiftRowTemplateManager();
    }

    renameShiftRowTemplate(index) {
        const template = (store.activeData.shiftNotebookRowTemplates || [])[index];
        if (!template) return;
        this.openShiftRowTemplateNamePanel(template.name || '', (name) => {
            template.name = name;
            store.save();
            this.rerenderShiftRowTemplateManager();
        });
    }

    deleteShiftRowTemplate(index) {
        const templates = store.activeData.shiftNotebookRowTemplates || [];
        const template = templates[index];
        if (!template) return;
        templates.splice(index, 1);
        store.save();
        this.rerenderShiftRowTemplateManager();
        this.showUndoNotice(`テンプレート「${template.name || '名称未設定'}」を削除しました`, () => {
            templates.splice(index, 0, template);
            store.save();
            this.rerenderShiftRowTemplateManager();
        }, null, document.getElementById('modal-container') || document.body);
    }

    togglePreviousShiftRowsPanel() {
        const panel = document.getElementById('shift-previous-copy-panel');
        const editing = this._editingShiftNotebook;
        if (!panel || !editing) return;
        panel.classList.toggle('hidden');
        if (panel.classList.contains('hidden')) return;

        const target = this.getPreviousFilledShiftNotebookTarget(editing.dateStr, editing.shift) || this.getPreviousShiftNotebookTarget(editing.dateStr, editing.shift);
        const dayData = target ? store.activeData.shiftNotebooks?.[target.dateStr] : null;
        const { rows } = target ? this.getShiftNotebookRowsForShift(dayData || {}, target.shift) : { rows: [] };
        const hiddenCount = rows.filter(row => !!row.hidden).length;
        const label = target ? this.getShiftNotebookLabel(target.shift) : null;
        if (!target || rows.length === 0) {
            panel.innerHTML = '<div class="shift-previous-copy-empty">コピーできる前シフトの行がありません</div>';
            return;
        }

        panel.innerHTML = `
            <div class="shift-previous-copy-head">
                <b>${target.dateStr} ${this.escapeHtml(label?.name || '')}${hiddenCount ? ` / チェック済み${hiddenCount}行は未選択` : ''}</b>
                <div>
                    <button type="button" class="secondary-btn" onclick="app.setPreviousShiftCopySelection(true)">全選択</button>
                    <button type="button" class="secondary-btn" onclick="app.setPreviousShiftCopySelection(false)">全解除</button>
                    <button type="button" class="secondary-btn" onclick="app.excludeCheckedPreviousShiftRows()">チェック済み除外</button>
                    <button type="button" class="secondary-btn" onclick="app.importSelectedPreviousShiftRows()">選択行を追加</button>
                    <button type="button" class="secondary-btn" onclick="document.getElementById('shift-previous-copy-panel').classList.add('hidden')">閉じる</button>
                </div>
            </div>
            <div class="shift-previous-copy-list">
                ${rows.map((row, index) => {
                    const text = row.text || this.stripShiftNoteHtml(row.html || '').trim() || '本文なし';
                    const isHidden = !!row.hidden;
                    const hasPhotos = Array.isArray(row.photos) && row.photos.length > 0;
                    const isImportant = !!row.important;
                    const hasReplies = rows.some(item => item.replyTo && item.replyTo === row.id);
                    const badges = [
                        isHidden ? '<span class="shift-previous-copy-badge done">チェック済</span>' : '',
                        isImportant ? '<span class="shift-previous-copy-badge important">重要</span>' : '',
                        hasPhotos ? '<span class="shift-previous-copy-badge photo">写真</span>' : '',
                        hasReplies ? '<span class="shift-previous-copy-badge reply">返信あり</span>' : ''
                    ].filter(Boolean).join('');
                    return `
                        <label class="shift-previous-copy-item ${isHidden ? 'checked-hidden' : ''}">
                            <input type="checkbox" value="${index}" ${isHidden ? '' : 'checked'}>
                            <span class="shift-row-group-badge">${this.escapeHtml(row.group || '未設定')}</span>
                            <span class="shift-previous-copy-badges">${badges}</span>
                            <span>${this.escapeHtml(text).slice(0, 140)}</span>
                        </label>
                    `;
                }).join('')}
            </div>
        `;
        panel._previousRows = rows;
    }

    setPreviousShiftCopySelection(checked) {
        document.querySelectorAll('#shift-previous-copy-panel input[type="checkbox"]').forEach(input => {
            input.checked = checked;
        });
    }

    excludeCheckedPreviousShiftRows() {
        const panel = document.getElementById('shift-previous-copy-panel');
        const rows = panel?._previousRows || [];
        panel?.querySelectorAll('input[type="checkbox"]').forEach(input => {
            const row = rows[Number(input.value)];
            input.checked = !row?.hidden;
        });
    }

    importSelectedPreviousShiftRows() {
        const panel = document.getElementById('shift-previous-copy-panel');
        const rows = panel?._previousRows || [];
        if (!panel || rows.length === 0) return;
        const selectedIndexes = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked')).map(input => Number(input.value));
        if (selectedIndexes.length === 0) {
            this.setShiftNotebookStatus('コピーする行を選んでください', 'error');
            return;
        }
        const existingKeys = new Set(Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'))
            .map(row => this.getShiftNotebookRowDuplicateKey(this.getShiftNotebookRowDataFromElement(row))));
        let addedCount = 0;
        let skippedCount = 0;
        selectedIndexes.forEach(index => {
            const row = rows[index];
            if (!row) return;
            const rowData = {
                group: row.group || this.lastShiftNotebookRowGroup || '未設定',
                tag: row.tag || '通常',
                text: row.text || '',
                html: row.html || '',
                photos: row.photos || []
            };
            const key = this.getShiftNotebookRowDuplicateKey(rowData);
            if (existingKeys.has(key)) {
                skippedCount++;
                return;
            }
            existingKeys.add(key);
            this.addShiftNotebookRow('shift-notebook-rows', row.text || '', row.photos || [], row.tag || '通常', row.group || this.lastShiftNotebookRowGroup || '未設定', row.html || '');
            addedCount++;
        });
        panel.classList.add('hidden');
        this.sortShiftNotebookRowsInDom();
        this.autoSaveShiftNotebook(true);
        const message = skippedCount > 0 ? `${addedCount}行コピー、${skippedCount}行は重複のためスキップ` : `${addedCount}行コピーしました`;
        this.setShiftNotebookStatus(message, addedCount > 0 ? 'saved' : 'error');
    }

    getShiftNotebookRowDuplicateKey(row = {}) {
        const htmlText = row.html ? this.stripShiftNoteHtml(row.html) : '';
        const text = MaintenanceStore.toHalfWidthLower(row.text || htmlText || '').replace(/\s+/g, ' ').trim();
        const photos = (row.photos || []).map(photo => {
            const p = this.normalizeShiftNotebookPhoto(photo);
            return `${p.src || ''}::${p.caption || ''}`;
        }).sort().join('|');
        return `${text}__${photos}`;
    }

    addShiftNotebookRow(containerId, text = '', photos = [], tag = '通常', group = '未設定', html = '', hidden = false, preserveBlank = true, savedRowId = '', replyTo = '', important = false) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (group) this.lastShiftNotebookRowGroup = group;
        const rowId = savedRowId || `shift-row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const row = document.createElement('div');
        row.className = 'shift-notebook-row';
        if (important) row.classList.add('shift-row-important');
        row.dataset.shiftRowId = rowId;
        if (replyTo) {
            row.dataset.replyTo = replyTo;
            row.classList.add('shift-reply-row');
        }
        if (preserveBlank) row.dataset.preserveBlank = 'true';
        row.setAttribute('style', this.getShiftNotebookRowGroupStyle(group));
        row.innerHTML = `
            <div class="shift-row-group-heading"></div>
            <div class="shift-important-stamp" aria-hidden="true">重要</div>
            <div class="shift-notebook-line">
                <button type="button" class="icon-btn shift-row-drag-handle" title="ドラッグして行を上下に移動" draggable="true"><i class="fa-solid fa-arrows-up-down"></i></button>
                <select class="shift-row-group-select" onchange="app.onShiftNotebookRowGroupChange(this)">
                    ${this.getShiftNotebookRowGroupOptions(group)}
                </select>
                <div class="shift-note-formatbar">
                    <div class="shift-format-menu">
                        <button type="button" class="shift-format-menu-btn" title="フォント・サイズ・色を選び、反映ボタンで装飾を適用します" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.toggleShiftNoteSizeMenu(this)">
                            <span class="shift-format-indicator"></span><i class="fa-solid fa-palette"></i> <span class="shift-format-current">標準</span> <i class="fa-solid fa-caret-down"></i>
                        </button>
                        <div class="shift-format-panel">
                            <button type="button" class="shift-format-close-btn" title="閉じる" onmousedown="event.preventDefault()" onclick="app.cancelShiftNoteFormatMenu(this)">
                                ×
                            </button>
                            <div class="shift-format-pending-summary">
                                <div class="shift-format-summary-line">反映予定: 標準</div>
                                <div class="shift-format-preview-text standard">連絡帳プレビュー</div>
                            </div>
                            <div class="shift-format-panel-title">サイズ</div>
                            <div class="shift-format-size-options">
                                <input type="number" class="shift-font-size-input" value="20" min="8" max="120" style="width:64px; padding:6px 8px; text-align:center; border:1.5px solid var(--border); border-radius:6px; font-size:0.95rem; font-weight:800; outline:none;" 
                                    onmousedown="app.rememberShiftNoteSelection(this)"
                                    onfocus="this.style.borderColor='var(--primary)'" 
                                    onblur="this.style.borderColor='var(--border)'; app.stageShiftNoteFormat(this, 'size', this.value + 'px')" 
                                    onchange="app.stageShiftNoteFormat(this, 'size', this.value + 'px')"
                                    onkeydown="if(event.key === 'Enter'){ event.preventDefault(); app.stageShiftNoteFormat(this, 'size', this.value + 'px'); this.blur(); }"
                                    title="フォントサイズ (px)">
                                <span style="font-size:0.8rem; color:var(--text-light); font-weight:700;">px</span>
                            </div>
                            <div class="shift-format-panel-title">色</div>
                            <div class="shift-color-options">
                                <button type="button" class="shift-color-dot red" data-color="#dc2626" title="赤" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#dc2626')"></button>
                                <button type="button" class="shift-color-dot orange" data-color="#ea580c" title="オレンジ" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#ea580c')"></button>
                                <button type="button" class="shift-color-dot yellow" data-color="#ca8a04" title="黄" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#ca8a04')"></button>
                                <button type="button" class="shift-color-dot green" data-color="#16a34a" title="緑" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#16a34a')"></button>
                                <button type="button" class="shift-color-dot blue" data-color="#2563eb" title="青" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#2563eb')"></button>
                                <button type="button" class="shift-color-dot purple" data-color="#7c3aed" title="紫" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#7c3aed')"></button>
                                <button type="button" class="shift-color-dot black" data-color="#0f172a" title="黒" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'color', '#0f172a')"></button>
                            </div>
                            <div class="shift-format-actions">
                                <button type="button" class="shift-format-cancel-btn" onmousedown="event.preventDefault()" onclick="app.cancelShiftNoteFormatMenu(this)">
                                    キャンセル
                                </button>
                                <button type="button" class="shift-format-apply-btn" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.applyShiftNoteFormatMenu(this)">
                                    <i class="fa-solid fa-check"></i> 反映
                                </button>
                                <button type="button" class="shift-format-apply-all-btn" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.applyShiftNoteFormatMenuToAll(this)">
                                    <i class="fa-solid fa-layer-group"></i> 全行に反映
                                </button>
                            </div>
                            <div class="shift-format-panel-title">フォント</div>
                            <div class="shift-font-options">
                                <button type="button" class="shift-font-option" data-font="" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'font', '')">標準</button>
                                <button type="button" class="shift-font-option" data-font='"Noto Sans JP", sans-serif' onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'font', '&quot;Noto Sans JP&quot;, sans-serif')">ゴシック</button>
                                <button type="button" class="shift-font-option" data-font='"Yu Gothic", "YuGothic", sans-serif' onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'font', '&quot;Yu Gothic&quot;, &quot;YuGothic&quot;, sans-serif')">游</button>
                                <button type="button" class="shift-font-option" data-font='"Meiryo", sans-serif' onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'font', '&quot;Meiryo&quot;, sans-serif')">メイリオ</button>
                                <button type="button" class="shift-font-option" data-font='"Noto Serif JP", serif' onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'font', '&quot;Noto Serif JP&quot;, serif')">明朝</button>
                                <button type="button" class="shift-font-option" data-font='"MS Gothic", monospace' onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'font', '&quot;MS Gothic&quot;, monospace')">等幅</button>
                            </div>
                            <button type="button" class="shift-format-reset-btn" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.stageShiftNoteFormat(this, 'reset')">
                                <i class="fa-solid fa-rotate-left" style="font-size:0.75rem; margin-right: 4px;"></i> 装飾をリセット
                            </button>
                            <div class="shift-format-feedback" aria-live="polite"></div>
                        </div>
                    </div>
                </div>
                <div class="shift-note-text" contenteditable="true" spellcheck="false" data-placeholder="連絡内容を入力（Alt+Enterで改行）">${html ? this.sanitizeShiftNoteHtml(html) : this.shiftNoteTextToHtml(text)}</div>
                <div class="shift-row-actions">
                    <div class="shift-row-action-strip">
                        <button type="button" class="shift-row-shift-stamp early" title="カーソル位置に早番スタンプ" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.insertShiftNoteShiftStamp(this, 'early')">早</button>
                        <button type="button" class="shift-row-shift-stamp late" title="カーソル位置に遅番スタンプ" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.insertShiftNoteShiftStamp(this, 'late')">遅</button>
                        <button type="button" class="shift-row-shift-stamp night" title="カーソル位置に深夜番スタンプ" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.insertShiftNoteShiftStamp(this, 'night')">深</button>
                        <button type="button" class="icon-btn shift-row-reply" title="この行へリプライ" onclick="app.addShiftNotebookReplyRow(this)"><i class="fa-solid fa-reply"></i></button>
                        <button type="button" class="icon-btn shift-row-todo-request" title="この行をToDoへ依頼" onclick="app.openShiftRowTodoRequest(this)">依</button>
                        <button type="button" class="icon-btn shift-row-important-btn ${important ? 'active' : ''}" title="重要スタンプ" onclick="app.toggleShiftNotebookRowImportant(this)">重</button>
                        <button type="button" class="icon-btn shift-row-reply-toggle" title="返信を表示/折りたたみ" onclick="app.toggleShiftNotebookReplies(this)" hidden><i class="fa-solid fa-chevron-down"></i><span class="shift-row-reply-count">0</span></button>
                        <button type="button" class="icon-btn shift-row-responder" title="返信者スタンプ" onclick="app.toggleShiftResponderMenu(this)"><i class="fa-solid fa-user-pen"></i></button>
                        <button type="button" class="icon-btn shift-row-check-insert" title="カーソル位置に✅を挿入" onmousedown="event.preventDefault(); app.rememberShiftNoteSelection(this)" onclick="app.insertShiftNoteCheckMark(this)">✅</button>
                    </div>
                    <div class="shift-row-action-strip">
                        <button type="button" class="icon-btn shift-row-fullscreen" title="フルスクリーン表示" onclick="app.openShiftNoteFullscreen(this)"><i class="fa-solid fa-expand"></i></button>
                        <button type="button" class="icon-btn shift-row-trim-blank-lines" title="空白行を削除" onclick="app.removeShiftNoteBlankLines(this)"><i class="fa-solid fa-align-justify"></i></button>
                        <button type="button" class="icon-btn shift-row-delete" title="この行を削除"><i class="fa-solid fa-trash-can"></i></button>
                        <label class="shift-row-hide-toggle" title="引継ぎ時にあえて伝えなくてよい行へチェックします。上部の非表示ボタンで、チェックした行だけ一時的に隠せます。" aria-label="非表示対象">
                            <input type="checkbox" class="shift-row-hide-checkbox" ${hidden ? 'checked' : ''}>
                            <span class="shift-row-hide-icon" aria-hidden="true"><i class="fa-solid fa-tv"></i><i class="fa-solid fa-slash"></i></span>
                        </label>
                    </div>
                    <div class="shift-responder-menu"></div>
                </div>
            </div>
            <div class="shift-reply-collapse-summary" hidden></div>
            <div class="shift-photo-area">
                <label class="shift-photo-btn" for="${rowId}-photo" title="写真を追加" aria-label="写真を追加">
                    <i class="fa-solid fa-camera" aria-hidden="true"></i>
                </label>
                <input type="file" id="${rowId}-photo" class="shift-photo-input" accept="image/*" multiple>
                <div class="shift-photo-previews"></div>
            </div>
        `;
        container.appendChild(row);

        const preview = row.querySelector('.shift-photo-previews');
        const editor = row.querySelector('.shift-note-text');
        const dragHandle = row.querySelector('.shift-row-drag-handle');
        editor.addEventListener('dragover', (e) => {
            if (this.getShiftMemberStampDragName(e)) {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                return;
            }
            if (!this.getShiftRowGroupStampDragGroup(e)) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            const insertAfter = this.getShiftNotebookDragInsertAfter(null, row, e);
            this.updateShiftNotebookDragIndicator(row, insertAfter);
        });
        editor.addEventListener('drop', (e) => {
            const memberName = this.getShiftMemberStampDragName(e);
            if (memberName) {
                e.preventDefault();
                e.stopPropagation();
                this.appendShiftNoteMemberStamp(editor, memberName);
                this.finishShiftMemberStampDrag();
                return;
            }
            const stampGroup = this.getShiftRowGroupStampDragGroup(e);
            if (!stampGroup) return;
            e.preventDefault();
            e.stopPropagation();
            const containerEl = document.getElementById('shift-notebook-rows');
            const insertAfter = this.getShiftNotebookDragInsertAfter(null, row, e);
            this.clearShiftNotebookDragIndicators(containerEl);
            this.insertShiftNotebookBlankRowFromGroupStamp(stampGroup, insertAfter ? row.nextSibling : row);
            this.finishShiftRowGroupStampDrag();
        });
        dragHandle?.addEventListener('dragstart', (e) => {
            e.dataTransfer?.setData('text/plain', row.dataset.shiftRowId || '');
            e.dataTransfer.effectAllowed = 'move';
            row.classList.add('dragging');
        });
        dragHandle?.addEventListener('dragend', () => {
            row.classList.remove('dragging');
            this.clearShiftNotebookDragIndicators();
        });
        row.addEventListener('dragover', (e) => {
            const stampGroup = this.getShiftRowGroupStampDragGroup(e);
            if (stampGroup) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
                const insertAfter = this.getShiftNotebookDragInsertAfter(null, row, e);
                this.updateShiftNotebookDragIndicator(row, insertAfter);
                return;
            }
            const dragging = document.querySelector('.shift-notebook-row.dragging');
            if (!dragging || dragging === row) return;
            if (!this.canDropShiftNotebookRowOnTarget(dragging, row)) {
                this.clearShiftNotebookDragIndicators();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
                return;
            }
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            const insertAfter = this.getShiftNotebookDragInsertAfter(dragging, row, e);
            this.updateShiftNotebookDragIndicator(row, insertAfter);
        });
        row.addEventListener('dragleave', () => {
            row.classList.remove('drag-over', 'drag-insert-before', 'drag-insert-after');
        });
        row.addEventListener('drop', (e) => {
            e.preventDefault();
            const stampGroup = this.getShiftRowGroupStampDragGroup(e);
            if (stampGroup) {
                const containerEl = document.getElementById('shift-notebook-rows');
                const insertAfter = this.getShiftNotebookDragInsertAfter(null, row, e);
                this.clearShiftNotebookDragIndicators(containerEl);
                this.insertShiftNotebookBlankRowFromGroupStamp(stampGroup, insertAfter ? row.nextSibling : row);
                this.finishShiftRowGroupStampDrag();
                return;
            }
            const dragging = document.querySelector('.shift-notebook-row.dragging');
            const containerEl = document.getElementById('shift-notebook-rows');
            this.clearShiftNotebookDragIndicators(containerEl);
            if (!dragging || !containerEl || dragging === row) return;
            if (!this.canDropShiftNotebookRowOnTarget(dragging, row)) {
                this.sortShiftNotebookRowsInDom();
                return;
            }
            const insertAfter = this.getShiftNotebookDragInsertAfter(dragging, row, e);
            containerEl.insertBefore(dragging, insertAfter ? row.nextSibling : row);
            this.sortShiftNotebookRowsInDom();
            this.autoSaveShiftNotebook(true);
        });
        const resizeEditor = () => {
            editor.style.height = 'auto';
            editor.style.height = editor.scrollHeight + 'px';
        };
        editor.addEventListener('click', (e) => {
            const stamp = this.getShiftNoteInlineStampElement(e.target);
            if (stamp && editor.contains(stamp)) {
                e.preventDefault();
                if (this.isShiftNoteInlineStampCloseClick(e, stamp) && this.removeShiftNoteInlineStamp(stamp, editor)) {
                    resizeEditor();
                    return;
                }
                this.selectShiftNoteInlineStamp(stamp, editor);
                return;
            }
            this.clearShiftNoteInlineStampSelection(editor);
        });
        editor.addEventListener('input', resizeEditor);
        editor.addEventListener('input', () => this.scheduleShiftNotebookAutoSave());
        editor.addEventListener('paste', (e) => this.insertShiftNoteClipboardContent(editor, e));
        editor.addEventListener('mouseup', () => {
            this.saveShiftNoteSelection(editor);
            this.ensureShiftNoteActiveFormat(editor);
        });
        editor.addEventListener('keyup', (e) => {
            this.saveShiftNoteSelection(editor);
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                this.ensureShiftNoteActiveFormat(editor);
            }
        });
        editor.addEventListener('focus', () => this.ensureShiftNoteActiveFormat(editor));
        editor.addEventListener('compositionstart', () => {
            editor._isComposing = true;
            this.ensureShiftNoteActiveFormat(editor);
        });
        editor.addEventListener('compositionend', () => {
            editor._isComposing = false;
            this.saveShiftNoteSelection(editor);
            resizeEditor();
            this.scheduleShiftNotebookAutoSave();
        });
        editor.addEventListener('blur', () => {
            this.autoSaveShiftNotebook(true);
            this.sortShiftNotebookRowsInDom();
        });
        editor.addEventListener('keydown', (e) => {
            // アクティブ装飾モード: 印刷可能な文字入力時にスタイルを適用
            if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const currentRow = editor.closest('.shift-notebook-row');
                const rows = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'));
                if (currentRow && rows[rows.length - 1] === currentRow) {
                    e.preventDefault();
                    this.addShiftNotebookRowBelow(currentRow);
                    return;
                }
            }
            if (e.key === 'Backspace' || e.key === 'Delete') {
                if (this.removeSelectedShiftNoteInlineStamp(editor)) {
                    e.preventDefault();
                    resizeEditor();
                    return;
                }
                requestAnimationFrame(() => {
                    this.cleanupShiftNoteEmptySpans(editor);
                    this.saveShiftNoteSelection(editor);
                });
            }
            if (e.key !== 'Enter') {
                if (e.isComposing || editor._isComposing || e.key === 'Process') return;
                const f = this._activeShiftNoteFormats;
                const hasActive = f.color || f.size || f.font;
                if (hasActive && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    e.preventDefault();
                    const wrapper = document.createElement('span');
                    if (f.color) wrapper.style.color = f.color;
                    if (f.size) wrapper.style.fontSize = f.size;
                    if (f.font) wrapper.style.fontFamily = f.font;
                    wrapper.textContent = e.key;
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                        const r = sel.getRangeAt(0);
                        if (editor.contains(r.commonAncestorContainer)) {
                            r.deleteContents();
                            r.insertNode(wrapper);
                            const afterRange = document.createRange();
                            afterRange.setStartAfter(wrapper);
                            afterRange.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(afterRange);
                            editor._savedRange = afterRange.cloneRange();
                            resizeEditor();
                            this.scheduleShiftNotebookAutoSave();
                        }
                    }
                }
                return;
            }
            if (e.altKey) {
                e.preventDefault();
                document.execCommand('insertLineBreak');
                resizeEditor();
                this.scheduleShiftNotebookAutoSave();
            } else {
                e.preventDefault();
            }
        });
        // アクティブ装飾モードのインジケーターを初期反映
        this._updateShiftNoteFormatIndicator(row);
        requestAnimationFrame(resizeEditor);

        const appendPreview = (photo) => {
            const photoData = this.normalizeShiftNotebookPhoto(photo);
            if (!photoData.src) return;
            const div = this.createPhotoPreviewElement(photoData.src, null, null, 74);
            div.classList.add('shift-photo-item');
            div.insertAdjacentHTML('beforeend', `
                <input type="text" class="shift-photo-caption" value="${this.escapeHtml(photoData.caption)}" placeholder="写真メモ">
            `);
            div.querySelector('.shift-photo-caption')?.addEventListener('input', () => this.scheduleShiftNotebookAutoSave());
            div.querySelector('.shift-photo-caption')?.addEventListener('blur', () => this.autoSaveShiftNotebook(true));
            preview.appendChild(div);
        };
        (photos || []).forEach(appendPreview);

        row.querySelector('.shift-row-delete').onclick = () => {
            const deleteRows = this.getShiftNotebookRowsForCascadeDelete(row);
            const replyDeleteCount = Math.max(0, deleteRows.length - 1);
            if (replyDeleteCount > 0 && !confirm(`この行には返信${replyDeleteCount}件があります。返信も一緒に削除しますか？`)) return;
            const rowDataList = deleteRows.map(targetRow => this.getShiftNotebookRowDataFromElement(targetRow)).filter(Boolean);
            const rowData = rowDataList[0] || this.getShiftNotebookRowDataFromElement(row);
            const deleteSet = new Set(deleteRows);
            let nextSibling = row.nextElementSibling;
            while (nextSibling && deleteSet.has(nextSibling)) nextSibling = nextSibling.nextElementSibling;
            if (container.querySelectorAll('.shift-notebook-row').length === 1 && replyDeleteCount === 0) {
                row.querySelector('.shift-note-text').innerHTML = '';
                preview.innerHTML = '';
                this.autoSaveShiftNotebook(true);
                this.showShiftNotebookUndoNotice('行を空にしました', () => {
                    if (!rowData) return;
                    this.addShiftNotebookRow(containerId, rowData.text, rowData.photos, rowData.tag, rowData.group, rowData.html, rowData.hidden, true, rowData.id, rowData.replyTo);
                    const restored = container.lastElementChild;
                    if (restored && row.parentNode) {
                        row.replaceWith(restored);
                    }
                    this.updateShiftNotebookGroupCorners();
                    this.autoSaveShiftNotebook(true);
                });
                return;
            }
            deleteRows.forEach(targetRow => targetRow.remove());
            this.updateShiftNotebookGroupCorners();
            this.autoSaveShiftNotebook(true);
            this.showShiftNotebookUndoNotice(replyDeleteCount > 0 ? `行と返信${replyDeleteCount}件を削除しました` : '行を削除しました', () => {
                if (!rowDataList.length) return;
                this.restoreShiftNotebookRowsFromData(containerId, rowDataList, nextSibling);
                this.updateShiftNotebookGroupCorners();
                this.autoSaveShiftNotebook(true);
            });
        };

        row.querySelector('.shift-photo-input').onchange = async (e) => {
            const files = Array.from(e.target.files || []);
            for (const file of files) {
                const base64 = await MaintenanceStore.resizeImage(file, 1600, 0.88);
                appendPreview(base64);
            }
            e.target.value = '';
            this.autoSaveShiftNotebook(true);
        };
        row.querySelector('.shift-row-group-select')?.addEventListener('change', () => {
            row.dataset.preserveBlank = 'true';
            this.autoSaveShiftNotebook(true);
            this.sortShiftNotebookRowsInDom();
        });
        row.querySelector('.shift-row-hide-checkbox')?.addEventListener('change', () => {
            this.updateShiftNotebookHiddenRows();
            this.autoSaveShiftNotebook(true);
        });
        return row;
    }

    getShiftNotebookRowGroup(row) {
        return row?.querySelector('.shift-row-group-select')?.value || '未設定';
    }

    canDropShiftNotebookRowOnTarget(dragging, targetRow) {
        if (!dragging || !targetRow) return false;
        if (this.getShiftNotebookRowGroup(dragging) !== this.getShiftNotebookRowGroup(targetRow)) return false;
        const draggingId = dragging.dataset.shiftRowId || '';
        if (draggingId && this.getShiftNotebookReplyRowsFor(dragging).some(row => row === targetRow)) return false;
        const draggingRoot = this.getShiftNotebookReplyRootId(dragging);
        const targetRoot = this.getShiftNotebookReplyRootId(targetRow);
        if (dragging.dataset.replyTo) return draggingRoot && draggingRoot === targetRoot;
        return !targetRow.dataset.replyTo || draggingRoot === targetRoot;
    }

    startShiftRowGroupStampDrag(event, group) {
        this._draggingShiftRowGroupStamp = group || '未設定';
        if (event?.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copyMove';
            event.dataTransfer.setData('application/x-shift-row-group', this._draggingShiftRowGroupStamp);
            event.dataTransfer.setData('text/plain', this._draggingShiftRowGroupStamp);
        }
        event?.currentTarget?.classList.add('dragging');
    }

    finishShiftRowGroupStampDrag() {
        this._draggingShiftRowGroupStamp = null;
        document.querySelectorAll('.shift-row-group-stamp.dragging').forEach(el => el.classList.remove('dragging'));
        document.querySelectorAll('.shift-row-group-trash.drag-over').forEach(el => el.classList.remove('drag-over'));
        this.clearShiftNotebookDragIndicators();
        document.getElementById('shift-notebook-rows')?.classList.remove('shift-stamp-drop-empty');
    }

    getShiftRowGroupStampDragGroup(event) {
        const transferTypes = event?.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
        const fromTransfer = transferTypes.includes('application/x-shift-row-group')
            ? event.dataTransfer.getData('application/x-shift-row-group')
            : '';
        return fromTransfer || this._draggingShiftRowGroupStamp || '';
    }

    startShiftMemberStampDrag(event, memberName) {
        this._draggingShiftMemberStamp = memberName || '';
        if (event?.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copy';
            event.dataTransfer.setData('application/x-shift-member', this._draggingShiftMemberStamp);
        }
        event?.currentTarget?.classList.add('dragging');
    }

    finishShiftMemberStampDrag() {
        this._draggingShiftMemberStamp = null;
        document.querySelectorAll('.shift-member-stamp.dragging').forEach(el => el.classList.remove('dragging'));
    }

    getShiftMemberStampDragName(event) {
        const transferTypes = event?.dataTransfer?.types ? Array.from(event.dataTransfer.types) : [];
        const fromTransfer = transferTypes.includes('application/x-shift-member')
            ? event.dataTransfer.getData('application/x-shift-member')
            : '';
        return fromTransfer || this._draggingShiftMemberStamp || '';
    }

    handleShiftRowGroupTrashDragOver(event) {
        const group = this.getShiftRowGroupStampDragGroup(event);
        if (!group) return;
        event.preventDefault();
        const canDelete = group !== '未設定' && !this.isShiftNotebookThroughGroup(group);
        if (event.dataTransfer) event.dataTransfer.dropEffect = canDelete ? 'move' : 'none';
        event.currentTarget?.classList.toggle('drag-over', canDelete);
        this.clearShiftNotebookDragIndicators();
    }

    handleShiftRowGroupTrashDragLeave(event) {
        event.currentTarget?.classList.remove('drag-over');
    }

    handleShiftRowGroupTrashDrop(event) {
        const group = this.getShiftRowGroupStampDragGroup(event);
        if (!group) return;
        event.preventDefault();
        event.currentTarget?.classList.remove('drag-over');
        this.deleteShiftNotebookRowGroupFromStamp(group);
        this.finishShiftRowGroupStampDrag();
    }

    deleteShiftNotebookRowGroupFromStamp(group) {
        if (!group || group === '未設定' || this.isShiftNotebookThroughGroup(group)) {
            this.setShiftNotebookStatus(`${group || '未設定'}グループは削除できません`, 'error');
            return;
        }
        if (!store.activeData.shiftNotebookRowGroups?.includes(group)) {
            this.setShiftNotebookStatus('削除できる登録グループではありません', 'error');
            return;
        }
        if (!confirm(`グループ「${group}」を削除しますか？\n現在表示中の同じグループの行は「未設定」に戻します。`)) return;

        store.activeData.shiftNotebookRowGroups = store.activeData.shiftNotebookRowGroups.filter(g => g !== group);
        (store.activeData.shiftNotebookRowTemplates || []).forEach(template => {
            if (template.group === group) template.group = '未設定';
            (template.rows || []).forEach(row => {
                if (row.group === group) row.group = '未設定';
            });
        });

        document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => {
            const select = row.querySelector('.shift-row-group-select');
            if (select?.value === group) {
                select.innerHTML = this.getShiftNotebookRowGroupOptions('未設定');
                select.value = '未設定';
                row.setAttribute('style', this.getShiftNotebookRowGroupStyle('未設定'));
            }
        });
        this.lastShiftNotebookRowGroup = '未設定';
        store.save();
        this.renderShiftRowGroupSelectOptions();
        this.refreshShiftRowGroupStamps();
        this.refreshShiftRowTemplateSelect();
        this.updateShiftNotebookGroupCorners();
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus(`グループ「${group}」を削除しました`, 'saved');
    }

    setupShiftRowGroupStampDropZone() {
        const container = document.getElementById('shift-notebook-rows');
        if (!container || container._shiftStampDropReady) return;
        container._shiftStampDropReady = true;
        container.addEventListener('dragover', (e) => {
            const stampGroup = this.getShiftRowGroupStampDragGroup(e);
            if (!stampGroup) return;
            const targetRow = e.target?.closest?.('.shift-notebook-row');
            if (targetRow && container.contains(targetRow)) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            this.clearShiftNotebookDragIndicators(container);
            container.classList.add('shift-stamp-drop-empty');
        });
        container.addEventListener('dragleave', (e) => {
            if (!container.contains(e.relatedTarget)) {
                container.classList.remove('shift-stamp-drop-empty');
            }
        });
        container.addEventListener('drop', (e) => {
            const stampGroup = this.getShiftRowGroupStampDragGroup(e);
            if (!stampGroup) return;
            const targetRow = e.target?.closest?.('.shift-notebook-row');
            if (targetRow && container.contains(targetRow)) return;
            e.preventDefault();
            container.classList.remove('shift-stamp-drop-empty');
            this.clearShiftNotebookDragIndicators(container);
            this.insertShiftNotebookBlankRowFromGroupStamp(stampGroup, null);
            this.finishShiftRowGroupStampDrag();
        });
    }

    insertShiftNotebookBlankRowFromGroupStamp(group, beforeNode = null) {
        const container = document.getElementById('shift-notebook-rows');
        if (!container) return;
        const newRow = this.addShiftNotebookRow('shift-notebook-rows', '', [], '通常', group || '未設定');
        if (newRow && beforeNode && beforeNode.parentNode === container) {
            container.insertBefore(newRow, beforeNode);
        }
        this.lastShiftNotebookRowGroup = group || '未設定';
        this.updateShiftNotebookGroupCorners();
        newRow?.querySelector('.shift-note-text')?.focus();
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus(`${group || '未設定'}の行を追加しました`, 'saved');
    }

    updateShiftNotebookDragIndicator(targetRow, insertAfter) {
        const container = targetRow?.parentElement;
        this.clearShiftNotebookDragIndicators(container);
        container?.classList.remove('shift-stamp-drop-empty');
        targetRow.classList.add('drag-over', insertAfter ? 'drag-insert-after' : 'drag-insert-before');
    }

    clearShiftNotebookDragIndicators(container = document.getElementById('shift-notebook-rows')) {
        container?.querySelectorAll('.shift-notebook-row.drag-over, .shift-notebook-row.drag-insert-before, .shift-notebook-row.drag-insert-after')
            .forEach(row => row.classList.remove('drag-over', 'drag-insert-before', 'drag-insert-after'));
        container?.classList.remove('shift-stamp-drop-empty');
    }

    getShiftNotebookDragInsertAfter(dragging, targetRow, event) {
        const container = targetRow?.parentElement;
        if (dragging?.parentElement === container && container) {
            const rows = Array.from(container.children);
            const fromIndex = rows.indexOf(dragging);
            const toIndex = rows.indexOf(targetRow);
            if (fromIndex !== -1 && toIndex !== -1) {
                if (toIndex === fromIndex + 1) return true;
                if (toIndex === fromIndex - 1) return false;
            }
        }
        const rect = targetRow.getBoundingClientRect();
        return event.clientY > rect.top + rect.height / 2;
    }

    addShiftNotebookRowWithLastGroup(containerId) {
        const container = document.getElementById(containerId);
        const lastRow = container?.querySelector('.shift-notebook-row:last-child');
        const group = this.lastShiftNotebookRowGroup || lastRow?.querySelector('.shift-row-group-select')?.value || '未設定';
        this.addShiftNotebookRow(containerId, '', [], '通常', group);
        this.sortShiftNotebookRowsInDom();
        this.autoSaveShiftNotebook(true);
    }

    addShiftNotebookRowBelow(button) {
        const currentRow = button?.matches?.('.shift-notebook-row')
            ? button
            : button?.closest('.shift-notebook-row');
        const container = document.getElementById('shift-notebook-rows');
        if (!currentRow || !container) return;
        const group = currentRow.querySelector('.shift-row-group-select')?.value || '未設定';
        const existingRows = Array.from(container.children);
        const tempContainerId = 'shift-notebook-rows';
        this.addShiftNotebookRow(tempContainerId, '', [], '通常', group);
        const newRow = container.lastElementChild;
        if (newRow && existingRows.includes(currentRow)) {
            currentRow.insertAdjacentElement('afterend', newRow);
            const input = newRow.querySelector('.shift-note-text');
            if (input) input.focus();
        }
        this.sortShiftNotebookRowsInDom();
        this.autoSaveShiftNotebook(true);
    }

    addShiftNotebookReplyRow(button) {
        const currentRow = button?.closest('.shift-notebook-row');
        const container = document.getElementById('shift-notebook-rows');
        if (!currentRow || !container) return;
        const group = currentRow.querySelector('.shift-row-group-select')?.value || '未設定';
        currentRow.classList.remove('shift-replies-collapsed');
        const descendants = this.getShiftNotebookReplyRowsFor(currentRow);
        const replyRow = this.addShiftNotebookRow('shift-notebook-rows', '', [], '通常', group, '', false, true, '', currentRow.dataset.shiftRowId || '');
        if (replyRow) {
            const insertAfter = descendants.length ? descendants[descendants.length - 1] : currentRow;
            insertAfter.insertAdjacentElement('afterend', replyRow);
            replyRow.querySelector('.shift-note-text')?.focus();
            this.flashShiftNotebookReplyLink(currentRow, replyRow);
            requestAnimationFrame(() => {
                const responderButton = replyRow.querySelector('.shift-row-responder');
                if (responderButton) this.toggleShiftResponderMenu(responderButton);
            });
        }
        this.updateShiftNotebookGroupCorners();
        this.autoSaveShiftNotebook(true);
    }

    flashShiftNotebookReplyLink(parentRow, replyRow) {
        [parentRow, replyRow].forEach(row => {
            if (!row) return;
            row.classList.remove('shift-reply-linked-flash');
            void row.offsetWidth;
            row.classList.add('shift-reply-linked-flash');
            setTimeout(() => row.classList.remove('shift-reply-linked-flash'), 1300);
        });
    }

    getShiftNotebookReplyRowsFor(parentRow, options = {}) {
        const parentId = parentRow?.dataset.shiftRowId || '';
        if (!parentId) return [];
        const directOnly = !!options.directOnly;
        const rows = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'));
        const byId = new Map(rows.map(row => [row.dataset.shiftRowId || '', row]));
        return rows.filter(row => {
            if (row === parentRow) return false;
            if (directOnly) return row.dataset.replyTo === parentId;
            let replyTo = row.dataset.replyTo || '';
            while (replyTo) {
                if (replyTo === parentId) return true;
                const parent = byId.get(replyTo);
                if (!parent) return false;
                replyTo = parent.dataset.replyTo || '';
            }
            return false;
        });
    }

    getShiftNotebookRowsForCascadeDelete(row) {
        if (!row) return [];
        const rows = [row, ...this.getShiftNotebookReplyRowsFor(row)];
        const seen = new Set();
        return rows.filter(item => {
            const id = item.dataset.shiftRowId || '';
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }

    restoreShiftNotebookRowsFromData(containerId, rowsData, beforeNode = null) {
        const container = document.getElementById(containerId);
        if (!container || !Array.isArray(rowsData)) return;
        const restoredRows = [];
        rowsData.forEach(data => {
            const restored = this.addShiftNotebookRow(containerId, data.text, data.photos, data.tag, data.group, data.html, data.hidden, true, data.id, data.replyTo);
            if (restored) restoredRows.push(restored);
        });
        const anchor = beforeNode && beforeNode.parentNode === container ? beforeNode : null;
        restoredRows.forEach(restored => container.insertBefore(restored, anchor));
    }

    getShiftNotebookReplyRootId(row) {
        if (!row) return '';
        const rows = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'));
        const byId = new Map(rows.map(item => [item.dataset.shiftRowId || '', item]));
        let current = row;
        let replyTo = current.dataset.replyTo || '';
        while (replyTo && byId.has(replyTo)) {
            current = byId.get(replyTo);
            replyTo = current.dataset.replyTo || '';
        }
        return current.dataset.shiftRowId || '';
    }

    isShiftNotebookRowInReplyThread(row, rootId) {
        return !!row && !!rootId && this.getShiftNotebookReplyRootId(row) === rootId;
    }

    updateShiftNotebookReplyBadges() {
        const rows = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'));
        rows.forEach(row => {
            const replyRows = this.getShiftNotebookReplyRowsFor(row);
            const count = replyRows.length;
            const toggle = row.querySelector('.shift-row-reply-toggle');
            const countLabel = row.querySelector('.shift-row-reply-count');
            const summary = row.querySelector('.shift-reply-collapse-summary');
            const collapsed = row.classList.contains('shift-replies-collapsed') && count > 0;
            if (toggle) {
                toggle.hidden = count === 0;
                toggle.classList.toggle('has-replies', count > 0);
                toggle.classList.toggle('collapsed', collapsed);
                toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                toggle.title = collapsed ? `返信${count}件を表示` : `返信${count}件を折りたたみ`;
            }
            if (countLabel) countLabel.textContent = String(count);
            if (summary) {
                summary.textContent = collapsed ? this.getShiftNotebookReplySummary(replyRows) : '';
                summary.hidden = !collapsed;
            }
            if (count === 0) row.classList.remove('shift-replies-collapsed');
        });
        const byId = new Map(rows.map(row => [row.dataset.shiftRowId || '', row]));
        rows.forEach(row => {
            let replyTo = row.dataset.replyTo || '';
            let collapsedByAncestor = false;
            while (replyTo) {
                const parent = byId.get(replyTo);
                if (!parent) break;
                if (parent.classList.contains('shift-replies-collapsed')) {
                    collapsedByAncestor = true;
                    break;
                }
                replyTo = parent.dataset.replyTo || '';
            }
            row.classList.toggle('shift-reply-collapsed', collapsedByAncestor);
        });
    }

    toggleShiftNotebookReplies(button) {
        const row = button?.closest('.shift-notebook-row');
        if (!row) return;
        const hasReplies = this.getShiftNotebookReplyRowsFor(row).length > 0;
        if (!hasReplies) return;
        row.classList.toggle('shift-replies-collapsed');
        this.updateShiftNotebookGroupCorners();
    }

    getShiftNotebookReplySummary(replyRows = []) {
        const names = [];
        const snippets = [];
        replyRows.forEach(row => {
            row.querySelectorAll('.shift-note-member-stamp').forEach(stamp => {
                const name = (stamp.textContent || '').trim();
                if (name && !names.includes(name)) names.push(name);
            });
            if (snippets.length < 2) {
                const text = this.stripShiftNoteHtml(row.querySelector('.shift-note-text')?.innerHTML || '').trim();
                if (text) snippets.push(`${text.slice(0, 16)}${text.length > 16 ? '…' : ''}`);
            }
        });
        const detail = names.length
            ? names.slice(0, 4).join(', ') + (names.length > 4 ? ' ほか' : '')
            : snippets.join(' / ');
        return detail ? `返信${replyRows.length}件: ${detail}` : `返信${replyRows.length}件`;
    }

    getShiftResponderNamesByFrequency() {
        const counts = new Map();
        const types = this.ensureShiftNotebookMemberTypes();
        (store.activeData.shiftNotebookGroupPresets || []).forEach(preset => {
            (preset.members || []).forEach(name => {
                const n = String(name || '').trim();
                if (!n) return;
                counts.set(n, (counts.get(n) || 0) + 1);
            });
        });
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
            .map(([name, count]) => ({ name, count, type: types[name] === 'support' ? 'support' : 'core' }));
    }

    toggleShiftResponderMenu(button) {
        const row = button?.closest('.shift-notebook-row');
        const panel = row?.querySelector('.shift-responder-menu');
        if (!row || !panel) return;
        const isOpen = panel.classList.contains('open');
        document.querySelectorAll('.shift-responder-menu.open').forEach(el => el.classList.remove('open'));
        if (isOpen) return;
        const names = this.getShiftResponderNamesByFrequency().filter(item => item.type !== 'support');
        panel.innerHTML = names.length
            ? names.map(item => `<button type="button" onclick="app.insertShiftResponderStamp(this, '${this.escapeJs(item.name)}')">${this.escapeHtml(item.name)}<small>${item.count}</small></button>`).join('')
            : '<div class="shift-responder-empty">基幹社員の人名がありません</div>';
        panel.classList.add('open');
    }

    insertShiftResponderStamp(button, name) {
        const row = button?.closest('.shift-notebook-row');
        const editor = row?.querySelector('.shift-note-text');
        this.appendShiftNoteMemberStamp(editor, name);
        row?.querySelector('.shift-responder-menu')?.classList.remove('open');
    }

    getShiftCoreWorkerOptions() {
        const d = this.ensureKanbanTodoState();
        return (d.localTodoWorkers || []).map(worker => ({ id: worker.id, name: worker.name }));
    }

    getShiftCoreGroupOptions() {
        const workers = this.getShiftCoreWorkerOptions();
        const idByName = new Map(workers.map(worker => [worker.name, worker.id]));
        return (store.activeData.shiftNotebookGroupPresets || [])
            .map(preset => {
                const memberIds = (preset.members || [])
                    .map(member => idByName.get(String(member || '').trim()))
                    .filter(Boolean);
                return { name: preset.name || '名称未設定', memberIds: Array.from(new Set(memberIds)) };
            })
            .filter(group => group.memberIds.length > 0);
    }

    openShiftRowTodoRequest(button) {
        const row = button?.closest('.shift-notebook-row');
        const editing = this._editingShiftNotebook;
        if (!row || !editing) return;
        const editor = row.querySelector('.shift-note-text');
        const rowText = this.stripShiftNoteHtml(editor?.innerHTML || '').trim();
        const groupName = row.querySelector('.shift-row-group-select')?.value || '';
        const existingTodoId = this.getShiftRowActiveRequestTodoId(row);
        const existingTodo = existingTodoId
            ? (store.activeData.localTodos || []).find(todo => todo.id === existingTodoId && !todo.archived)
            : null;
        const title = existingTodo?.title || (rowText ? rowText.slice(0, 80) : `${groupName || '連絡帳'}の依頼`);
        const description = existingTodo?.description ?? rowText;
        const selectedWorkerIds = new Set(existingTodo?.assignedTo || []);
        const workers = this.getShiftCoreWorkerOptions();
        const groups = this.getShiftCoreGroupOptions();
        const defaultGroupIndex = Math.max(0, groups.findIndex(group => group.name === groupName));
        if (workers.length === 0) {
            alert('基幹社員が登録されていません。連絡帳の人名管理で基幹社員を登録してください。');
            return;
        }
        document.getElementById('shift-row-request-overlay')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div id="shift-row-request-overlay" class="shift-row-request-overlay" onclick="if(event.target === this) app.closeShiftRowTodoRequest()">
                <div class="shift-row-request-card">
                    <div class="shift-row-request-header">
                        <h3>ToDoへ依頼</h3>
                        <button type="button" onclick="app.closeShiftRowTodoRequest()"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <input type="hidden" id="shift-request-row-id" value="${this.escapeHtml(row.dataset.shiftRowId || '')}">
                    <input type="hidden" id="shift-request-existing-todo-id" value="${this.escapeHtml(existingTodoId || '')}">
                    <input type="hidden" id="shift-request-date" value="${this.escapeHtml(editing.dateStr || '')}">
                    <input type="hidden" id="shift-request-shift" value="${this.escapeHtml(editing.shift || '')}">
                    <label class="shift-request-field">タイトル
                        <input type="text" id="shift-request-title" value="${this.escapeHtml(title)}">
                    </label>
                    <label class="shift-request-field">内容
                        <textarea id="shift-request-desc" rows="5">${this.escapeHtml(description)}</textarea>
                    </label>
                    <label class="shift-request-field">依頼者（任意）
                        <select id="shift-request-requester">
                            <option value="" ${existingTodo?.requestedBy ? '' : 'selected'}>現在のToDo作業員（${this.escapeHtml(this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId))}）</option>
                            ${workers.map(worker => `<option value="${this.escapeHtml(worker.id)}" ${existingTodo?.requestedBy === worker.id ? 'selected' : ''}>${this.escapeHtml(worker.name)}</option>`).join('')}
                        </select>
                    </label>
                    <label class="shift-request-field">優先度（任意）
                        <select id="shift-request-priority">
                            <option value="low" ${!existingTodo?.priority || existingTodo?.priority === 'low' ? 'selected' : ''}>低</option>
                            <option value="medium" ${existingTodo?.priority === 'medium' ? 'selected' : ''}>中</option>
                            <option value="high" ${existingTodo?.priority === 'high' ? 'selected' : ''}>高</option>
                        </select>
                    </label>
                    <div class="shift-request-group-box">
                        <div class="shift-request-box-title">班を選択</div>
                        ${groups.length ? groups.map((group, index) => {
                            const checked = existingTodo
                                ? group.memberIds.length > 0 && group.memberIds.every(id => selectedWorkerIds.has(id))
                                : index === defaultGroupIndex;
                            return `
                            <label class="shift-request-check">
                                <input type="checkbox" class="shift-request-group" value="${index}" ${checked ? 'checked' : ''}>
                                <span>${this.escapeHtml(group.name)}</span>
                                <small>${group.memberIds.map(id => this.getKanbanTodoWorkerName(id)).join(', ')}</small>
                            </label>
                        `;
                        }).join('') : '<div class="shift-request-empty">基幹社員を含む班がありません</div>'}
                    </div>
                    <div class="shift-request-member-box">
                        <div class="shift-request-box-title">個別に選択</div>
                        ${workers.map(worker => `
                            <label class="shift-request-check">
                                <input type="checkbox" class="shift-request-member" value="${this.escapeHtml(worker.id)}" ${selectedWorkerIds.has(worker.id) ? 'checked' : ''}>
                                <span>${this.escapeHtml(worker.name)}</span>
                            </label>
                        `).join('')}
                    </div>
                    <div class="shift-row-request-actions">
                        <button type="button" class="secondary-btn" onclick="app.closeShiftRowTodoRequest()">閉じる</button>
                        <button type="button" class="secondary-btn shift-request-overwrite-btn" onclick="app.overwriteShiftRowTodoRequest()" ${existingTodoId ? '' : 'disabled'}>依頼内容を上書き</button>
                        <button type="button" class="primary-btn" onclick="app.createShiftRowTodoRequest()">依頼する</button>
                    </div>
                </div>
            </div>
        `);
        document.getElementById('shift-request-title')?.focus();
        document.getElementById('shift-row-request-overlay')._groups = groups;
    }

    closeShiftRowTodoRequest() {
        document.getElementById('shift-row-request-overlay')?.remove();
    }

    getShiftRowActiveRequestTodoId(row) {
        if (!row) return '';
        const ids = Array.from(row.querySelectorAll('.shift-todo-feedback.request[data-todo-id]'))
            .map(stamp => stamp.getAttribute('data-todo-id') || '')
            .filter(Boolean)
            .reverse();
        const todos = store.activeData.localTodos || [];
        return ids.find(id => todos.some(todo => todo.id === id && !todo.archived)) || '';
    }

    collectShiftRowTodoRequestFormData() {
        const overlay = document.getElementById('shift-row-request-overlay');
        if (!overlay) return null;
        const title = (document.getElementById('shift-request-title')?.value || '').trim();
        if (!title) {
            document.getElementById('shift-request-title')?.focus();
            return null;
        }
        const selected = new Set();
        const groups = overlay._groups || [];
        Array.from(document.querySelectorAll('.shift-request-group:checked')).forEach(input => {
            (groups[Number(input.value)]?.memberIds || []).forEach(id => selected.add(id));
        });
        Array.from(document.querySelectorAll('.shift-request-member:checked')).forEach(input => selected.add(input.value));
        const assignedTo = Array.from(selected);
        if (assignedTo.length === 0) {
            alert('依頼先を選んでください。');
            return null;
        }
        return {
            title,
            description: document.getElementById('shift-request-desc')?.value || '',
            priority: document.getElementById('shift-request-priority')?.value || 'low',
            assignedTo,
            requestedBy: document.getElementById('shift-request-requester')?.value || this.kanbanTodoWorkerId,
            source: {
                dateStr: document.getElementById('shift-request-date')?.value || '',
                shift: document.getElementById('shift-request-shift')?.value || '',
                rowId: document.getElementById('shift-request-row-id')?.value || ''
            },
            existingTodoId: document.getElementById('shift-request-existing-todo-id')?.value || ''
        };
    }

    createShiftRowTodoRequest() {
        const data = this.collectShiftRowTodoRequestFormData();
        if (!data) return;
        const d = this.ensureKanbanTodoState();
        const now = new Date().toISOString();
        const todo = {
            id: `kt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title: data.title,
            description: data.description,
            priority: data.priority || 'low',
            status: 'todo',
            done: false,
            deadlineDate: '',
            deadlineTime: '',
            deadline: '',
            isRecurring: false,
            isRequest: true,
            assignedTo: data.assignedTo,
            requestedBy: data.requestedBy,
            rejectedBy: [],
            createdAt: now,
            updatedAt: now,
            shiftRequestSource: data.source
        };
        d.localTodos.unshift(todo);
        this.addKanbanTodoLog(`連絡帳から依頼: 「${todo.title}」`);
        this.appendShiftTodoFeedback(todo, 'start');
        store.save();
        this.closeShiftRowTodoRequest();
        this.updateTodoRequestCountBadge();
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus('ToDoへ依頼しました', 'saved');
    }

    overwriteShiftRowTodoRequest() {
        const data = this.collectShiftRowTodoRequestFormData();
        if (!data || !data.existingTodoId) {
            alert('上書きできる既存依頼がありません。');
            return;
        }
        const d = this.ensureKanbanTodoState();
        const todo = d.localTodos.find(item => item.id === data.existingTodoId && !item.archived);
        if (!todo) {
            alert('上書き対象のToDoが見つかりません。新しく依頼してください。');
            return;
        }
        todo.title = data.title;
        todo.description = data.description;
        todo.priority = data.priority || 'low';
        todo.assignedTo = data.assignedTo;
        todo.requestedBy = data.requestedBy;
        todo.isRequest = true;
        todo.shiftRequestSource = data.source;
        todo.updatedAt = new Date().toISOString();
        this.appendShiftTodoFeedback(todo, 'overwrite');
        this.addKanbanTodoLog(`連絡帳から依頼を上書き: 「${todo.title}」`);
        store.save();
        this.closeShiftRowTodoRequest();
        this.updateTodoRequestCountBadge();
        this.saveShiftNotebook(data.source.dateStr, data.source.shift, { close: false, render: false, status: false });
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus('ToDo依頼を上書きしました', 'saved');
    }

    updateShiftTodoRequestStampWorker(todo) {
        const source = todo?.shiftRequestSource;
        if (!source?.rowId) return;
        const workerId = (todo.assignedTo || [])[0] || '';
        const row = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row')).find(item => item.dataset.shiftRowId === source.rowId);
        row?.querySelectorAll(`.shift-todo-feedback.request[data-todo-id="${CSS.escape(todo.id)}"]`).forEach(stamp => {
            if (workerId) stamp.setAttribute('data-worker-id', workerId);
            else stamp.removeAttribute('data-worker-id');
        });
    }

    openKanbanTodoFromShiftStamp(stamp) {
        const workerId = stamp?.getAttribute('data-worker-id') || '';
        if (!workerId) return;
        this.closeModal();
        this.closeShiftRowTodoRequest();
        this.changeKanbanTodoWorker(workerId);
        this.switchView('todos');
        setTimeout(() => {
            const todoId = stamp?.getAttribute('data-todo-id') || '';
            const card = todoId
                ? Array.from(document.querySelectorAll('.kt-task-card')).find(el => (el.getAttribute('onclick') || '').includes(todoId))
                : null;
            card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card?.classList.add('kt-task-card-jump');
            setTimeout(() => card?.classList.remove('kt-task-card-jump'), 1800);
        }, 80);
    }

    appendShiftTodoFeedback(todo, phase = 'start') {
        const source = todo?.shiftRequestSource;
        if (!source?.dateStr || !source?.shift || !source?.rowId) return;
        const names = (todo.assignedTo || []).map(id => this.getKanbanTodoWorkerName(id)).filter(Boolean).join(', ');
        const requesterName = todo.requestedBy ? this.getKanbanTodoWorkerName(todo.requestedBy) : '';
        const targetWorkerId = (todo.assignedTo || [])[0] || '';
        const now = new Date();
        const stamp = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const todoId = this.escapeHtml(todo.id || '');
        const workerAttr = targetWorkerId ? ` data-worker-id="${this.escapeHtml(targetWorkerId)}" onclick="app.openKanbanTodoFromShiftStamp(this)" title="対象者のToDoリストへ移動"` : '';
        const text = phase === 'done'
            ? `ToDo完了 ${stamp}${this.kanbanTodoWorkerId ? ` / 完了: ${this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId)}` : ''}`
            : (phase === 'progress'
                ? `ToDo進行中 ${stamp}${this.kanbanTodoWorkerId ? ` / 担当: ${this.getKanbanTodoWorkerName(this.kanbanTodoWorkerId)}` : ''}`
                : (phase === 'deleted'
                    ? `○ 依頼のタスクが削除されました ${stamp}`
                    : `ToDo依頼 ${stamp}${names ? ` / 依頼先: ${names}` : ''}${requesterName ? ` / 依頼者: ${requesterName}` : ''}`));
        const feedbackHtml = phase === 'done'
            ? `<span class="shift-todo-arrow" data-todo-id="${todoId}" contenteditable="false">→</span><span class="shift-todo-feedback done" data-todo-id="${todoId}" contenteditable="false">${this.escapeHtml(text)}</span>`
            : (phase === 'progress'
                ? `<span class="shift-todo-arrow" data-todo-id="${todoId}" contenteditable="false">→</span><span class="shift-todo-feedback progress" data-todo-id="${todoId}"${workerAttr} contenteditable="false">${this.escapeHtml(text)}</span>`
                : (phase === 'deleted'
                    ? `<span class="shift-todo-arrow" data-todo-id="${todoId}" contenteditable="false">→</span><span class="shift-todo-feedback deleted" data-todo-id="${todoId}" contenteditable="false">${this.escapeHtml(text)}</span>`
                    : `<span class="shift-todo-feedback request" data-todo-id="${todoId}"${workerAttr} contenteditable="false">${this.escapeHtml(text)}</span>`));
        const htmlLine = `<br>${feedbackHtml}`;

        const appendOrCompleteInContainer = (container) => {
            if (!container) return false;
            const requestStamp = Array.from(container.querySelectorAll('.shift-todo-feedback.request'))
                .find(item => item.getAttribute('data-todo-id') === (todo.id || ''));
            const doneStamp = Array.from(container.querySelectorAll('.shift-todo-feedback.done'))
                .find(item => item.getAttribute('data-todo-id') === (todo.id || ''));
            const progressStamp = Array.from(container.querySelectorAll('.shift-todo-feedback.progress'))
                .find(item => item.getAttribute('data-todo-id') === (todo.id || ''));
            const deletedStamp = Array.from(container.querySelectorAll('.shift-todo-feedback.deleted'))
                .find(item => item.getAttribute('data-todo-id') === (todo.id || ''));
            if (phase === 'overwrite' && requestStamp) {
                requestStamp.outerHTML = feedbackHtml;
                return true;
            }
            if (phase === 'progress' && requestStamp) {
                if (!progressStamp) requestStamp.insertAdjacentHTML('afterend', feedbackHtml);
                return true;
            }
            if ((phase === 'done' || phase === 'deleted') && requestStamp) {
                const exists = phase === 'done' ? doneStamp : deletedStamp;
                if (!exists) {
                    const tail = doneStamp || deletedStamp || progressStamp || requestStamp;
                    tail.insertAdjacentHTML('afterend', feedbackHtml);
                }
                return true;
            }
            if (phase !== 'done' || !doneStamp) {
                container.insertAdjacentHTML('beforeend', htmlLine);
            }
            return true;
        };

        const modalOverlay = document.getElementById('modal-overlay');
        const isShiftNotebookOpen = !modalOverlay?.classList.contains('hidden')
            && document.querySelector('.modal-container.shift-notebook-modal')
            && this._editingShiftNotebook?.dateStr === source.dateStr
            && this._editingShiftNotebook?.shift === source.shift;
        const openRow = (isShiftNotebookOpen || this._editingShiftNotebook?.dateStr === source.dateStr)
            ? Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row')).find(item => item.dataset.shiftRowId === source.rowId)
            : null;
        const openEditor = openRow?.querySelector('.shift-note-text');
        if (appendOrCompleteInContainer(openEditor)) {
            this.saveShiftNotebook(source.dateStr, source.shift, { close: false, render: false, status: false });
            return;
        }

        const dayData = store.activeData.shiftNotebooks?.[source.dateStr];
        if (!dayData) return;
        const buckets = [];
        if (Array.isArray(dayData.sharedRows)) buckets.push(dayData.sharedRows);
        const shiftRows = dayData[source.shift]?.rows;
        if (Array.isArray(shiftRows)) buckets.push(shiftRows);
        for (const rows of buckets) {
            const row = rows.find(item => item.id === source.rowId);
            if (!row) continue;
            const holder = document.createElement('div');
            const baseHtml = row.html || this.shiftNoteTextToHtml(row.text || '');
            holder.innerHTML = this.sanitizeShiftNoteHtml(baseHtml);
            appendOrCompleteInContainer(holder);
            row.html = this.sanitizeShiftNoteHtml(holder.innerHTML);
            row.text = this.stripShiftNoteHtml(row.html).trim();
            return;
        }
    }

    readShiftNotebookRowsFromDom() {
        return Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row')).map((row, index) => {
            const group = row.querySelector('.shift-row-group-select')?.value || '未設定';
            const editor = row.querySelector('.shift-note-text');
            const html = this.sanitizeShiftNoteHtml(editor?.innerHTML || '');
            const text = this.stripShiftNoteHtml(html).trim();
            const tag = row.querySelector('.shift-note-tag-select')?.value || '通常';
            const hidden = !!row.querySelector('.shift-row-hide-checkbox')?.checked;
            const important = row.classList.contains('shift-row-important');
            const photos = Array.from(row.querySelectorAll('.shift-photo-previews .shift-photo-item')).map(item => {
                const src = item.querySelector('img')?.src || '';
                const caption = item.querySelector('.shift-photo-caption')?.value.trim() || '';
                return caption ? { src, caption } : src;
            }).filter(photo => typeof photo === 'string' ? !!photo : !!photo.src);
            return { id: row.dataset.shiftRowId || '', replyTo: row.dataset.replyTo || '', group, tag, text, html, photos, hidden, important, index, element: row };
        }).filter(row => row.text || row.photos.length > 0 || row.important || row.element.dataset.preserveBlank === 'true' || row.element.querySelector('.shift-note-text') === document.activeElement);
    }

    sortShiftNotebookRowsInDom() {
        const container = document.getElementById('shift-notebook-rows');
        if (!container) return;
        const focused = document.activeElement;
        const rows = this.sortShiftNotebookRows(Array.from(container.children).map((row, index) => ({
            id: row.dataset.shiftRowId || '',
            replyTo: row.dataset.replyTo || '',
            group: row.querySelector('.shift-row-group-select')?.value || '未設定',
            index,
            element: row
        })));
        rows.forEach(row => container.appendChild(row.element));
        this.updateShiftNotebookGroupCorners();
        if (focused && document.contains(focused)) focused.focus();
    }

    toggleShiftNotebookHiddenRows() {
        this._shiftNotebookHideChecked = !this._shiftNotebookHideChecked;
        localStorage.setItem('shift_notebook_hide_checked', String(this._shiftNotebookHideChecked));
        this.updateShiftNotebookHiddenRows();
        this.setShiftNotebookStatus(this._shiftNotebookHideChecked ? 'チェック行を非表示にしました' : '全行を表示しました', 'moved');
    }

    toggleShiftNotebookImportantOnly() {
        this._shiftNotebookImportantOnly = !this._shiftNotebookImportantOnly;
        localStorage.setItem('shift_notebook_important_only', String(this._shiftNotebookImportantOnly));
        this.updateShiftNotebookHiddenRows();
        this.setShiftNotebookStatus(this._shiftNotebookImportantOnly ? '重要行だけ表示しました' : '重要行フィルターを解除しました', 'moved');
    }

    clearShiftNotebookRowFilters() {
        this._shiftNotebookHideChecked = false;
        this._shiftNotebookImportantOnly = false;
        localStorage.setItem('shift_notebook_hide_checked', 'false');
        localStorage.setItem('shift_notebook_important_only', 'false');
        this.updateShiftNotebookHiddenRows();
        this.setShiftNotebookStatus('全行を表示しました', 'moved');
    }

    loadShiftNotebookRowMenuHiddenParts() {
        const fallback = localStorage.getItem('shift_notebook_row_menu_hidden') === 'true';
        try {
            const saved = JSON.parse(localStorage.getItem('shift_notebook_row_menu_hidden_parts') || 'null');
            if (saved && typeof saved === 'object') {
                return {
                    group: !!saved.group,
                    format: !!saved.format,
                    actions: !!saved.actions
                };
            }
        } catch (e) {}
        return { group: fallback, format: fallback, actions: fallback };
    }

    saveShiftNotebookRowMenuHiddenParts() {
        localStorage.setItem('shift_notebook_row_menu_hidden_parts', JSON.stringify(this._shiftNotebookRowMenuHiddenParts || { group: false, format: false, actions: false }));
        localStorage.setItem('shift_notebook_row_menu_hidden', String(this.hasShiftNotebookRowMenuHiddenParts()));
    }

    hasShiftNotebookRowMenuHiddenParts() {
        const parts = this._shiftNotebookRowMenuHiddenParts || {};
        return !!(parts.group || parts.format || parts.actions);
    }

    toggleShiftNotebookRowMenus() {
        const panel = document.getElementById('shift-row-menu-settings-panel');
        if (panel) panel.hidden = !panel.hidden;
        this.syncShiftNotebookRowMenuSettingsPanel();
    }

    closeShiftNotebookRowMenuSettings() {
        const panel = document.getElementById('shift-row-menu-settings-panel');
        if (panel) panel.hidden = true;
    }

    setShiftNotebookRowMenuHiddenPart(part, hidden) {
        if (!this._shiftNotebookRowMenuHiddenParts) this._shiftNotebookRowMenuHiddenParts = { group: false, format: false, actions: false };
        if (!['group', 'format', 'actions'].includes(part)) return;
        this._shiftNotebookRowMenuHiddenParts[part] = !!hidden;
        this.saveShiftNotebookRowMenuHiddenParts();
        this.updateShiftNotebookRowMenuVisibility();
        this.setShiftNotebookStatus(this.hasShiftNotebookRowMenuHiddenParts() ? '行メニュー表示を変更しました' : '行メニューをすべて表示しました', 'moved');
    }

    setAllShiftNotebookRowMenuHiddenParts(hidden) {
        this._shiftNotebookRowMenuHiddenParts = { group: !!hidden, format: !!hidden, actions: !!hidden };
        this.saveShiftNotebookRowMenuHiddenParts();
        this.updateShiftNotebookRowMenuVisibility();
        this.syncShiftNotebookRowMenuSettingsPanel();
        this.setShiftNotebookStatus(hidden ? '行メニューをすべて非表示にしました' : '行メニューをすべて表示しました', 'moved');
    }

    syncShiftNotebookRowMenuSettingsPanel() {
        const parts = this._shiftNotebookRowMenuHiddenParts || {};
        document.querySelectorAll('#shift-row-menu-settings-panel input[data-part]').forEach(input => {
            input.checked = !!parts[input.dataset.part];
        });
    }

    updateShiftNotebookRowMenuVisibility() {
        const modal = document.querySelector('.modal-container.shift-notebook-modal');
        const parts = this._shiftNotebookRowMenuHiddenParts || {};
        const hidden = this.hasShiftNotebookRowMenuHiddenParts();
        modal?.classList.toggle('shift-hide-row-group', !!parts.group);
        modal?.classList.toggle('shift-hide-row-format', !!parts.format);
        modal?.classList.toggle('shift-hide-row-actions', !!parts.actions);
        const button = document.getElementById('shift-row-menu-toggle-btn');
        if (button) {
            button.classList.toggle('active', hidden);
            button.textContent = hidden ? '行メニュー変更中' : '行メニュー設定';
        }
        this.syncShiftNotebookRowMenuSettingsPanel();
        if (parts.format) this.closeShiftNoteFormatMenus({ commit: false });
        requestAnimationFrame(() => {
            document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => this.positionShiftImportantStamp(row));
        });
    }

    toggleShiftNotebookRowImportant(button) {
        const row = button?.closest('.shift-notebook-row');
        if (!row) return;
        const active = row.classList.toggle('shift-row-important');
        button.classList.toggle('active', active);
        requestAnimationFrame(() => this.positionShiftImportantStamp(row));
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus(active ? '重要スタンプを押しました' : '重要スタンプを外しました', 'saved');
    }

    getShiftNotebookHiddenRowCount() {
        return Array.from(document.querySelectorAll('#shift-notebook-rows .shift-row-hide-checkbox'))
            .filter(input => input.checked).length;
    }

    updateShiftNotebookHiddenRows() {
        const active = !!this._shiftNotebookHideChecked;
        const importantOnly = !!this._shiftNotebookImportantOnly;
        const hiddenCount = this.getShiftNotebookHiddenRowCount();
        document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => {
            const checked = !!row.querySelector('.shift-row-hide-checkbox')?.checked;
            const notImportant = importantOnly && !row.classList.contains('shift-row-important');
            row.classList.toggle('shift-row-hidden-by-filter', (active && checked) || notImportant);
        });
        const button = document.getElementById('shift-hide-checked-btn');
        if (button) {
            button.classList.toggle('active', active);
            button.innerHTML = active
                ? `<i class="fa-solid fa-eye"></i> 全表示 <span class="shift-hidden-count">${hiddenCount}件</span>`
                : `☑ 非表示${hiddenCount > 0 ? ` <span class="shift-hidden-count">${hiddenCount}件</span>` : ''}`;
            button.title = active
                ? '非表示にした行をもう一度表示します。チェック状態は残ります。'
                : `チェックを入れた行を一時的に非表示にします。行は削除されず、全表示で戻せます。${hiddenCount > 0 ? `現在${hiddenCount}件が対象です。` : ''}`;
        }
        const importantButton = document.getElementById('shift-important-only-btn');
        if (importantButton) importantButton.classList.toggle('active', importantOnly);
        const clearButton = document.getElementById('shift-clear-row-filters-btn');
        if (clearButton) clearButton.hidden = !active && !importantOnly;
        const banner = document.getElementById('shift-row-filter-banner');
        if (banner) {
            const filters = [];
            if (active) filters.push(`<i class="fa-solid fa-eye-slash"></i> チェック済み非表示${hiddenCount ? ` ${hiddenCount}件` : ''}`);
            if (importantOnly) filters.push('<i class="fa-solid fa-star"></i> 重要のみ表示中');
            banner.hidden = filters.length === 0;
            banner.innerHTML = filters.join('<span class="shift-row-filter-sep"></span>');
        }
        this.updateShiftNotebookGroupCorners();
    }

    updateShiftNotebookGroupCorners() {
        const rows = Array.from(document.querySelectorAll('#shift-notebook-rows .shift-notebook-row'));
        this.updateShiftNotebookReplyBadges();
        const visibleRows = rows.filter(row => !row.classList.contains('shift-row-hidden-by-filter') && !row.classList.contains('shift-reply-collapsed'));
        rows.forEach(row => {
            row.classList.remove('same-group-prev', 'same-group-next', 'shift-group-start');
            const heading = row.querySelector('.shift-row-group-heading');
            if (heading) heading.hidden = true;
        });
        visibleRows.forEach((row, index) => {
            const group = this.getShiftNotebookRowGroup(row);
            const prevGroup = visibleRows[index - 1] ? this.getShiftNotebookRowGroup(visibleRows[index - 1]) : null;
            const nextGroup = visibleRows[index + 1] ? this.getShiftNotebookRowGroup(visibleRows[index + 1]) : null;
            const isGroupStart = prevGroup !== group;
            row.classList.toggle('same-group-prev', prevGroup === group);
            row.classList.toggle('same-group-next', nextGroup === group);
            row.classList.toggle('shift-group-start', isGroupStart);
            const heading = row.querySelector('.shift-row-group-heading');
            if (heading) {
                heading.textContent = group;
                heading.hidden = !isGroupStart;
                const isThrough = this.isShiftNotebookThroughGroup(group);
                heading.classList.toggle('through-group-heading', isThrough);
                heading.title = '';
                heading.dataset.tooltip = isThrough
                    ? '貫通表示: この行は早番・遅番・深夜番すべての連絡帳に同じ内容で表示されます。どのシフトで編集しても共通の行として保存されます。'
                    : '';
            }
        });
    }

    scheduleShiftNotebookAutoSave() {
        clearTimeout(this._shiftNotebookAutoSaveTimer);
        this.setShiftNotebookStatus('保存待ち', 'saving');
        if (document.querySelector('.modal-container.shift-notebook-modal.shift-fit-all-mode')) {
            clearTimeout(this._shiftNotebookFitTimer);
            this._shiftNotebookFitTimer = setTimeout(() => this.adjustShiftNotebookRowsToFit(), 120);
        }
        this._shiftNotebookAutoSaveTimer = setTimeout(() => this.autoSaveShiftNotebook(false), 500);
    }

    autoSaveShiftNotebook(immediate = false) {
        const editing = this._editingShiftNotebook;
        if (!editing || !document.getElementById('shift-notebook-rows')) return;
        clearTimeout(this._shiftNotebookAutoSaveTimer);
        const run = () => this.saveShiftNotebook(editing.dateStr, editing.shift, { close: false, render: true, status: true });
        this.setShiftNotebookStatus('保存中', 'saving');
        if (immediate) run();
        else this._shiftNotebookAutoSaveTimer = setTimeout(run, 500);
    }

    saveShiftNotebook(dateStr, shift, options = { close: true, render: true }) {
        if (!store.activeData.shiftNotebooks) store.activeData.shiftNotebooks = {};
        const members = this.getShiftGroupMembersFromInput();
        const allRows = this.sortShiftNotebookRows(this.readShiftNotebookRowsFromDom()).map(({ element, index, ...row }) => row);
        const sharedRows = allRows.filter(row => this.isShiftNotebookThroughGroup(row.group));
        const rows = allRows.filter(row => !this.isShiftNotebookThroughGroup(row.group));

        if (!store.activeData.shiftNotebooks[dateStr]) store.activeData.shiftNotebooks[dateStr] = {};
        store.activeData.shiftNotebooks[dateStr].sharedRows = sharedRows;
        store.activeData.shiftNotebooks[dateStr][shift] = { members, rows };

        if (Object.values(store.activeData.shiftNotebooks[dateStr]).every(v => {
            if (Array.isArray(v)) return v.length === 0;
            return (!Array.isArray(v?.rows) || v.rows.length === 0) && (!Array.isArray(v?.members) || v.members.length === 0);
        }) && (!Array.isArray(store.activeData.shiftNotebooks[dateStr].sharedRows) || store.activeData.shiftNotebooks[dateStr].sharedRows.length === 0)) {
            delete store.activeData.shiftNotebooks[dateStr];
        }

        const saved = store.save();
        if (options.status) {
            Promise.resolve(saved)
                .then(() => this.setShiftNotebookStatus('保存済み', 'saved'))
                .catch(() => this.setShiftNotebookStatus('保存失敗', 'error'));
        }
        if (options.close !== false) {
            this._editingShiftNotebook = null;
            this.closeModal();
        }
        if (options.render !== false) this.renderCalendar();
    }

    handleTaskDrop(taskId, sourceDate, targetDate) {
        if (sourceDate === targetDate) return;
        const task = store.activeData.tasks.find(t => t.id === taskId);
        if (!task) return;

        const sDate = new Date(sourceDate);
        const tDate = new Date(targetDate);
        const diffTime = tDate.getTime() - sDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (confirm(`「${task.content}」の予定を ${diffDays > 0 ? diffDays + '日後に移動' : Math.abs(diffDays) + '日前へ移動'} してサイクルを調整しますか？`)) {
            const currentStart = new Date(task.startDate);
            currentStart.setDate(currentStart.getDate() + diffDays);
            task.startDate = currentStart.getFullYear() + '-' + String(currentStart.getMonth() + 1).padStart(2, '0') + '-' + String(currentStart.getDate()).padStart(2, '0');
            store.save();
            this.renderCalendar();
        }
    }

    updateTelop() {
        const telopText = document.getElementById('cal-telop-text');
        const telopContainer = document.getElementById('cal-telop-container');
        if (!telopText || !telopContainer) return;

        const today = new Date();
        today.setHours(0,0,0,0);
        
        let unfinishedCount = 0;
        let details = [];
        const tasks = store.getTasks();
        
        tasks.forEach(t => {
            if (!t.startDate) return;
            const startDate = new Date(t.startDate);
            if (isNaN(startDate.getTime())) return;
            startDate.setHours(0,0,0,0);
            if (startDate > today) return;

            const machine = store.getMachines(true).find(m => m.id === t.machineId);
            const modelLabel = MaintenanceApp.toHalfWidthLower(machine?.model || '？');

            if (t.periodDays <= 0) {
                // One-off or invalid period
                if (t.startDate) {
                    const isDone = store.activeData.history.some(h => h.taskId === t.id && h.date === t.startDate);
                    if (!isDone && startDate < today) {
                        unfinishedCount++;
                        details.push(`${modelLabel}: ${t.content}`);
                    }
                }
            } else {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                
                let checkDate = new Date(startDate);
                let firstMiss = true;
                while (checkDate <= yesterday) {
                    const dateStr = checkDate.getFullYear() + '-' + String(checkDate.getMonth()+1).padStart(2,0) + '-' + String(checkDate.getDate()).padStart(2,0);
                    const isDone = store.activeData.history.some(h => h.taskId && String(h.taskId) === String(t.id) && h.date === dateStr);
                    if (!isDone) {
                        unfinishedCount++;
                        if (firstMiss) {
                            details.push(`${modelLabel}: ${t.content}`);
                            firstMiss = false; 
                        }
                    }
                    checkDate.setDate(checkDate.getDate() + t.periodDays);
                }
            }
        });

        if (unfinishedCount > 0) {
            telopContainer.classList.remove('all-clear');
            const separator = `<span style="color:var(--primary); margin:0 8px; font-weight:900;">|</span>`;
            telopText.innerHTML = `⚠️ <span style="margin-right:20px;">未完了の点検が <b>${unfinishedCount}件</b> あります：<b>${details.join(separator)}</b> などを早急に実施してください！</span>`;
        } else {
            telopContainer.classList.add('all-clear');
            telopText.innerHTML = `✅ <span style="margin-right:20px;">現在、未完了の定期メンテナンスはありません。良好な状態です。</span>`;
        }
    }

    getHistoryForDate(dateStr) {
        return store.activeData.history.filter(h => h.date === dateStr && !h.isManualGuide);
    }

    getScheduledTasksForDate(dateStr) {
        const [ty, tm, td] = dateStr.split('-').map(Number);
        const targetDate = new Date(ty, tm - 1, td);
        targetDate.setHours(0,0,0,0);
        const activeMachineIds = store.getMachines().map(m => m.id);
        const tasks = (store.activeData.tasks || []).filter(t => {
            if (!activeMachineIds.includes(t.machineId)) return false;
            const periodDays = parseInt(t.periodDays) || 0;
            if (periodDays <= 0) return true;
            return !t.deleted && !store.isMaintenanceTaskArchived(t.id);
        });
        const scheduled = [];

        tasks.forEach(t => {
            if (!t.startDate) return;
            const parts = t.startDate.split('-');
            if (parts.length !== 3) return;
            const [sy, sm, sd] = parts.map(Number);
            const startDate = new Date(sy, sm - 1, sd);
            if (isNaN(startDate.getTime())) return;
            startDate.setHours(0,0,0,0);
            if (startDate > targetDate) return;

            if (t.periodDays <= 0) {
                if (t.startDate === dateStr) {
                    const isDone = store.activeData.history.some(h => h.taskId && String(h.taskId) === String(t.id) && h.date === dateStr);
                    if (!isDone) scheduled.push(t);
                }
            } else {
                const diffTime = targetDate.getTime() - startDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays % t.periodDays === 0) {
                    const isDone = store.activeData.history.some(h => h.taskId && String(h.taskId) === String(t.id) && h.date === dateStr);
                    if (!isDone) scheduled.push(t);
                }
            }
        });
        return scheduled;
    }

    updateCalendarStats() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const lastDate = new Date(year, month + 1, 0).getDate();

        let totalRemaining = 0;
        let totalDone = 0;
        let dokateiCount = 0;
        let dokateiTime = 0;

        for (let d = 1; d <= lastDate; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            
            // Done count (Scheduled + Sudden)
            const history = store.activeData.history.filter(h => h.date === dateStr);
            totalDone += history.filter(h => h.taskId).length; // Only count scheduled tasks completion?
            // User likely wants ALL completions shown as 'Done' vs 'Remaining'
            // Let's count all history records as Done and Scheduled (not done) as Remaining
            
            const scheduled = this.getScheduledTasksForDate(dateStr);
            totalRemaining += scheduled.length;
            
            // Dokatei
            const dokas = history.filter(h => h.isDokatei);
            dokateiCount += dokas.length;
            dokateiTime += dokas.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        }

        // Re-count Done properly: Only scheduled tasks that were completed this month
        const allMonthHistory = store.activeData.history.filter(h => {
            const d = new Date(h.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
        
        const scheduledDoneCount = allMonthHistory.filter(h => !!h.taskId).length;
        const suddenCount = allMonthHistory.filter(h => !h.taskId).length;

        document.getElementById('cal-stat-remaining').textContent = totalRemaining;
        document.getElementById('cal-stat-done').textContent = scheduledDoneCount;
        document.getElementById('cal-stat-sudden-count').textContent = suddenCount;
        document.getElementById('cal-stat-dokatei-count').textContent = dokateiCount;
        document.getElementById('cal-stat-dokatei-time').textContent = dokateiTime;
    }

    // Helper to highlight text based on a search query, case and width insensitive
    highlightText(text, query) {
        if (!text || !query) return text || '';
        const terms = MaintenanceStore.toHalfWidthLower(query).split(/\s+/).filter(t => t);
        if (terms.length === 0) return text;

        // Create a matching string without trimming to preserve character indices
        const norm = text.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).toLowerCase();
        
        let matches = [];
        terms.forEach(term => {
            const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escaped, 'gi');
            let m;
            while ((m = regex.exec(norm)) !== null) {
                matches.push({ start: m.index, end: m.index + m[0].length });
            }
        });

        if (matches.length === 0) return text;

        // Sort and merge overlapping match ranges
        matches.sort((a, b) => a.start - b.start);
        const merged = [];
        if (matches.length > 0) {
            let cur = { ...matches[0] };
            for (let i = 1; i < matches.length; i++) {
                if (matches[i].start <= cur.end) {
                    cur.end = Math.max(cur.end, matches[i].end);
                } else {
                    merged.push(cur);
                    cur = { ...matches[i] };
                }
            }
            merged.push(cur);
        }

        let highlighted = '';
        let lastPos = 0;
        merged.forEach(m => {
            highlighted += text.substring(lastPos, m.start);
            highlighted += `<span class="highlight">${text.substring(m.start, m.end)}</span>`;
            lastPos = m.end;
        });
        highlighted += text.substring(lastPos);

        return highlighted;
    }

    // --- Department Management ---
    updateDepartmentUI() {
        const el = document.getElementById('current-dept-display');
        const departments = store.data.departments || [];
        const current = departments.find(d => d.id === store.data.currentDepartmentId);
        if (el && current) el.textContent = current.name;
    }

    openDepartmentModal() {
        this.openModal('dept', '部署切替・登録', () => {
            const content = document.getElementById('modal-content');
            const departments = store.data.departments || [];
            
            content.innerHTML = `
                <div style="padding:10px;">
                    <p style="font-size:0.9rem; color:var(--text-light); margin-bottom:16px;">
                        切り替えたい部署を選択してください。データは部署ごとに独立して管理されます。
                    </p>
                    <div id="dept-list-container" style="display:flex; flex-direction:column; gap:10px; margin-bottom:24px; max-height:300px; overflow-y:auto; padding-right:4px;">
                        ${departments.map(d => `
                            <button class="nav-btn dept-item-btn" 
                                    data-id="${d.id}" 
                                    style="width:100%; padding:14px; border:1px solid ${d.id === store.data.currentDepartmentId ? 'var(--primary)' : 'var(--border)'}; background:${d.id === store.data.currentDepartmentId ? 'var(--primary-light)' : 'white'}; text-align:left; cursor:pointer; color:var(--text-main);">
                                <i class="fa-solid fa-building" style="margin-right:10px; color:${d.id === store.data.currentDepartmentId ? 'var(--primary)' : 'var(--text-light)'}"></i>
                                <span style="font-weight:700;">${d.name}</span>
                                ${d.id === store.data.currentDepartmentId ? '<span style="float:right; font-size:0.75rem; color:var(--primary); font-weight:900;">[選択中]</span>' : ''}
                            </button>
                        `).join('')}
                    </div>
                    
                    <div style="border-top:1px dashed var(--border); padding-top:20px;">
                        <label style="display:block; font-size:0.85rem; font-weight:700; margin-bottom:10px; color:var(--text-main);">
                            <i class="fa-solid fa-plus-circle" style="color:var(--primary);"></i> 新規部署を登録
                        </label>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <input type="text" id="new-dept-name" placeholder="例: 製造第一課" 
                                   style="flex:1; padding:12px; border-radius:10px; border:1.5px solid var(--border); font-size:0.95rem; outline:none;"
                                   onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'">
                            <button id="btn-create-dept" class="primary-btn" style="width:auto; padding:12px 20px; font-size:0.9rem; white-space:nowrap;">作成・切替</button>
                        </div>
                        <p style="font-size:0.75rem; color:var(--text-light); margin-top:10px;">
                            ※部署を作成すると、その部署専用の空のデータセットが作成されます。
                        </p>
                    </div>
                </div>
            `;

            // Listeners for selection
            content.querySelectorAll('.dept-item-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    if (id === store.data.currentDepartmentId) {
                        this.closeModal();
                        return;
                    }
                    if (confirm(`部署を「${btn.querySelector('span').textContent}」に切り替えますか？`)) {
                        store.data.currentDepartmentId = id;
                        store.save();
                        location.reload(); 
                    }
                });
            });

            // Create new
            const createBtn = content.querySelector('#btn-create-dept');
            const input = content.querySelector('#new-dept-name');
            
            createBtn.onclick = () => {
                const name = input.value.trim();
                if (!name) return alert('部署名を入力してください。');
                
                const id = 'dept_' + Date.now();
                if (!store.data.departments) store.data.departments = [];
                if (!store.data.deptData) store.data.deptData = {};
                
                store.data.departments.push({ id, name });
                store.data.deptData[id] = {
                    machines: [], tasks: [], history: [], partsMaster: [], archivedWorkers: [], archivedTasks: []
                };
                store.data.currentDepartmentId = id;
                store.save();
                
                alert(`新しく「${name}」部署を登録し、切り替えました。`);
                location.reload();
            };
        });
    }

    // --- Machines Implementation ---

    renderMachines(searchQuery = '') {
        const container = document.getElementById('machines-list');
        if (!container) return;
        
        const qInput = document.getElementById('global-search');
        const query = (searchQuery || (qInput ? qInput.value : '')).toLowerCase().trim();

        let machines = store.getMachines();
        
        if (machines.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-ghost"></i>
                    <p>機械が登録されていません。</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        
        const normQuery = query ? MaintenanceStore.toHalfWidthLower(query) : null;

        // --- Ranking calculation ---
        const allHistory = store.getHistory({}) || [];
        const troubleCountMap = {};
        const recurrenceCountMap = {};
        const recurrenceCountThisYearMap = {};
        const recurrenceHistoryMap = {};
        const currentYearStr = new Date().getFullYear().toString();
        
        allHistory.forEach(h => {
             if (h.machineId) {
                 // Total trouble rank (Sudden + Dokatei)
                 if (!h.taskId || h.isDokatei) {
                     troubleCountMap[h.machineId] = (troubleCountMap[h.machineId] || 0) + 1;
                 }
                 // Recurrence rank (isFirstTime === false)
                 if (h.isFirstTime === false) {
                     recurrenceCountMap[h.machineId] = (recurrenceCountMap[h.machineId] || 0) + 1;
                     if (h.date && h.date.startsWith(currentYearStr)) {
                         recurrenceCountThisYearMap[h.machineId] = (recurrenceCountThisYearMap[h.machineId] || 0) + 1;
                     }
                     if (!recurrenceHistoryMap[h.machineId]) recurrenceHistoryMap[h.machineId] = [];
                     recurrenceHistoryMap[h.machineId].push(h);
                 }
             }
        });
        
        // Sorting by ranking (Default to trouble rank)
        if (this.machineSort === 'name') {
            machines.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
        } else if (this.machineSort === 'newest') {
            machines.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        } else {
            // Default: Rank
            machines.sort((a, b) => (troubleCountMap[b.id] || 0) - (troubleCountMap[a.id] || 0));
        }
        
        // Machine Rank Reference List
        const rankBasis = store.getMachines(true).map(m => ({
            id: m.id,
            count: troubleCountMap[m.id] || 0
        })).sort((a,b) => b.count - a.count);

        const recurrenceRankBasis = store.getMachines(true).map(m => ({
            id: m.id,
            count: recurrenceCountMap[m.id] || 0
        })).sort((a,b) => b.count - a.count);

        machines.forEach(m => {
            const mId = m.id;
            const mTasks = store.getTasks(mId) || [];
            const mHistory = allHistory.filter(h => h.machineId === mId && (!h.taskId || h.isDokatei));
            const troubleCount = mHistory.length;
            const rank = rankBasis.findIndex(x => x.id === mId) + 1;
            
            const recurrenceCount = recurrenceCountMap[mId] || 0;
            const recurrenceCountThisYear = recurrenceCountThisYearMap[mId] || 0;
            const recurrenceRank = recurrenceRankBasis.findIndex(x => x.id === mId) + 1;
            const recurrenceHistory = recurrenceHistoryMap[mId] || [];
            recurrenceHistory.sort((a,b) => new Date(b.date) - new Date(a.date));

            // Search Match Logic
            let isMatch = true;
            let showHighlight = false;
            if (normQuery) {
                const terms = normQuery.split(/[\s　]+/).filter(Boolean);
                const searchStr = (m.name || '') + ' ' + (m.model || '') + ' ' + (m.remarks || '');
                const normSearch = MaintenanceStore.toHalfWidthLower(searchStr);
                isMatch = terms.every(t => normSearch.includes(t));
                if (!isMatch) return; // Skip rendering for non-matches
                showHighlight = true;
            }

            const card = document.createElement('div');
            card.className = 'machine-card' + (showHighlight ? ' search-match' : '');
            
            // Recent troubles safely
            const troublesHTML = mHistory.slice(0, 3).map(h => {
                const date = h.date || '-';
                const body = (h.errorContent || h.notes || '内容なし').replace(/"/g, '&quot;').replace(/'/g, "\\'").replace(/\n/g, ' ');
                
                let photosHtml = '';
                if (h.photos && h.photos.length > 0) {
                    photosHtml = `<div style="display:flex; gap:4px; margin-left:8px; flex-shrink:0;">${h.photos.slice(0, 3).map(p => `<div class="img-box" style="width:40px; height:30px; border-radius:4px; border:1px solid var(--border);"><img src="${p}" style="width:100%; height:100%; object-fit:cover;"></div>`).join('')}</div>`;
                }
                
                return `
                    <div class="recent-trouble-item hover-shadow" style="flex-direction: row; align-items: center; justify-content: space-between;" onclick="app.jumpToHistory('${mId}', '${body}', '${date}')">
                        <div style="display:flex; flex-direction:column; min-width:0; flex:1;">
                            <span class="date">${date}</span>
                            <span class="content" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${body}</span>
                        </div>
                        ${photosHtml}
                    </div>
                `;
            }).join('') || '<div style="font-size:0.7rem; color:var(--text-light); padding:10px;">トラブル履歴なし</div>';

            // MTBF calculation
            let mtbf = '記録なし';
            if (troubleCount >= 2) {
                const dates = mHistory.map(h => new Date(h.date).getTime()).sort((a,b) => a - b);
                const first = dates[0];
                const last = dates[dates.length-1];
                if (first && last) {
                    const days = (last - first) / (1000 * 60 * 60 * 24);
                    mtbf = (days / (troubleCount - 1)).toFixed(1) + ' 日/回';
                }
            } else if (troubleCount === 1) {
                mtbf = '計算不可';
            }

            // Find history with guides for the SAME model
            const normModel = MaintenanceApp.toHalfWidthLower(m.model || '');
            const modelGuides = store.activeData.history.filter(h => {
                if (!h.guide) return false;
                const mach = store.getMachines(true).find(mm => mm.id === h.machineId);
                return mach && MaintenanceApp.toHalfWidthLower(mach.model || '') === normModel;
            }).sort((a,b) => new Date(b.date) - new Date(a.date));

            // Normalization for name display
            const normName = MaintenanceApp.toFullWidthUpper(m.name || '');

            card.innerHTML = `
                <div class="card-header" style="gap:16px; align-items: flex-start;">
                    <div class="img-box" style="width:64px; height:64px; border-radius:10px;">
                        ${m.photo ? `<img src="${m.photo}">` : '<i class="fa-solid fa-industry" style="font-size:1.4rem; color:#cbd5e1;"></i>'}
                    </div>
                    <div style="flex:1">
                        <h4 style="margin:0">${this.highlightText(normName, query)}</h4>
                        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:4px;">
                            ${m.lineNo ? this.getLineBadge(m.lineNo) : ''}
                            ${m.category ? `<span style="display:inline-flex; align-items:center; justify-content:center; background:#eff6ff; color:#1e40af; border:1px solid #bae6fd; padding:1px 8px; border-radius:4px; font-weight:800; font-size:0.7rem;">${m.category}</span>` : ''}
                            <span class="model-clickable" style="font-size:0.75rem; color:var(--secondary); font-weight:800; cursor:pointer; margin-left:4px;" onclick="app.filterByModel('${normModel}')">
                                [${this.highlightText(MaintenanceApp.isModelBlank(m.model) ? '型式未登録' : normModel, query)}]
                            </span>
                            ${m.manufacturer ? `<span style="font-size:0.7rem; color:var(--text-light); margin-left:8px;"><i class="fa-solid fa-industry" style="font-size:0.6rem; margin-right:2px;"></i> ${m.manufacturer}</span>` : ''}
                            ${recurrenceCount > 0 ? `<span style="display:inline-block; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:2px 8px; border-radius:4px; font-weight:900; margin-left:4px; font-size:0.75rem;"><i class="fa-solid fa-redo" style="font-size:0.65rem; margin-right:4px;"></i> 再発: 累計 ${recurrenceCount}回 / 今年 ${recurrenceCountThisYear}回 (第 ${recurrenceRank} 位)</span>` : ''}
                            ${modelGuides.length > 0 ? `
                                <div class="card-inline-guides" style="display:inline-flex; gap:4px; margin-left:4px;">
                                    ${modelGuides.slice(0, 5).map(g => `
                                        <div class="guide-badge-balloon" style="padding:2px 4px; background:#f0f9ff; border-radius:4px; border:1px solid #bae6fd;" onclick="event.stopPropagation(); app.openGuideModal('${g.id}')">
                                            <i class="fa-solid fa-file-invoice" style="font-size:0.75rem; color:#0369a1;"></i>
                                            <span class="balloon-content" style="font-size:0.7rem; width:200px;">
                                                <div style="font-weight:800; color:var(--primary); margin-bottom:2px;">${g.date}</div>
                                                ${this.getHistoryDisplayText(g)}
                                            </span>
                                        </div>
                                    `).join('')}
                                    ${modelGuides.length > 5 ? `<span style="font-size:0.6rem; color:var(--text-light); opacity:0.6;">+${modelGuides.length - 5}</span>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="actions" style="display:flex; gap:6px; flex-shrink:0;">
                        <button class="icon-btn edit-btn" title="編集"><i class="fa-solid fa-pen"></i></button>
                        <button class="icon-btn delete-btn" style="color:var(--danger)" title="削除"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="card-body">
                    <p class="remarks" style="font-size:0.8rem; margin:8px 0 12px 0;">${this.highlightText(m.remarks || '備考なし', query)}</p>
                    
                    <div class="machine-trouble-info" style="margin-bottom:12px;">
                        <div class="trouble-stat-row">
                            <span class="label"><i class="fa-solid fa-ranking-star"></i> 不具合頻度順位</span>
                            <span class="value">${troubleCount > 0 ? `第 ${rank} 位 (${troubleCount}回)` : '記録なし'}</span>
                        </div>
                        <div class="trouble-stat-row">
                            <span class="label"><i class="fa-solid fa-arrows-left-right"></i> 平均故障間隔 (MTBF)</span>
                            <span class="value">${mtbf}</span>
                        </div>
                    </div>

                    <div class="card-recent-troubles" style="margin-bottom:12px;">
                        <div style="font-size:0.65rem; color:var(--text-light); border-bottom:1px solid var(--border); margin-bottom:4px; padding-bottom:2px; font-weight:700;">直近トラブル (3件)</div>
                        ${troublesHTML}
                    </div>

                    <div class="task-summary">
                        ${mTasks.filter(t => !store.isMaintenanceTaskArchived(t.id)).map(t => `<span class="task-pill"><i class="fa-solid fa-screwdriver-wrench"></i> ${t.content}</span>`).join('')}
                    </div>
                </div>
            `;
            
            card.querySelector('.edit-btn').onclick = () => this.editMachine(mId);
            card.querySelector('.delete-btn').onclick = () => this.deleteMachine(mId);
            container.appendChild(card);
        });
    }

    // --- Modal Logic ---
    openMachineModal(id = null) {
        const machine = id ? store.getMachines(true).find(m => m.id === id) : null;
        const tasks = id ? store.getTasks(id) : [];

        let usedPartsHTML = '';
        if (id) {
            const hList = store.activeData.history.filter(h => h.machineId === id && h.replacedParts && h.replacedParts.length > 0);
            const partMap = {};
            hList.forEach(h => {
                h.replacedParts.forEach(p => {
                    const key = `${p.name}___${p.model}`;
                    if (!partMap[key]) {
                        partMap[key] = { name: p.name, model: p.model, count: 0, latestDate: h.date };
                    }
                    partMap[key].count += (p.count || 0);
                    if (new Date(h.date) > new Date(partMap[key].latestDate)) {
                        partMap[key].latestDate = h.date;
                    }
                });
            });
            const pArray = Object.values(partMap).sort((a,b) => new Date(b.latestDate) - new Date(a.latestDate));
            if (pArray.length > 0) {
                usedPartsHTML = `
                    <div style="margin-top: 24px; border-top: 2px dashed #cbd5e1; padding-top: 16px;">
                        <label style="font-size:0.85rem; font-weight:800; color:var(--text-main); display:block; margin-bottom:8px;">
                            <i class="fa-solid fa-box-open" style="color:var(--secondary);"></i> 過去に使用した部品 (参考)
                        </label>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            ${pArray.map(p => `
                                <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:6px 10px; border-radius:6px; font-size:0.75rem;">
                                    <div style="font-weight:900; color:var(--primary); margin-bottom:2px;">${p.name} ${p.model ? `[${p.model}]` : ''}</div>
                                    <div style="font-size:0.65rem; color:var(--text-light);"><i class="fa-regular fa-clock"></i> 最終交換: ${p.latestDate}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        this.openModal('machine', machine ? '機械の編集' : '新規機械登録', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <form id="machine-form">
                    <input type="hidden" id="f-machine-id" value="${id || ''}">
                    <div class="form-group">
                        <label>機械名・部品名 <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="f-machine-name" placeholder="例: メインコンベア" value="${machine ? machine.name : ''}" list="list-m-names" required>
                    </div>
                    <div class="form-group">
                        <label>型式 <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="f-machine-model" placeholder="例: MC-100" value="${machine ? machine.model : ''}" list="list-m-models" required>
                    </div>
                    <div class="form-group">
                        <label>製造元 (メーカー) <span style="font-size:0.7rem; font-weight:normal; color:var(--text-light);">※任意</span></label>
                        <input type="text" id="f-machine-manufacturer" placeholder="例: 〇〇精機" value="${machine && machine.manufacturer ? machine.manufacturer : ''}">
                    </div>
                    <div class="form-group">
                        <label>所属ライン番号 <span style="color:var(--danger)">*</span></label>
                        <select id="f-machine-line-no" required style="height:44px; font-weight:700;">
                            <option value="">-- ラインを選択 --</option>
                            ${this.generateLineOptionsHTML(machine?.lineNo || '')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>装置区分 (例: 包装機, 充填機) <span style="color:var(--danger)">*</span></label>
                        <select id="f-machine-category" onchange="app.toggleNewCategoryField('f-')" required style="height:44px;">
                            <option value="">-- 選択してください --</option>
                            ${this.getMachineCategoryOptions(machine ? machine.category : '')}
                        </select>
                        <input type="text" id="f-new-category-input" placeholder="新しい装置区分名を入力" style="display:none; margin-top:8px; border:2px solid var(--primary); padding:8px;" onblur="this.value = MaintenanceApp.toFullWidthUpper(this.value)">
                    </div>
                    <div class="form-group">
                        <label>備考</label>
                        <textarea id="f-machine-remarks" rows="2" placeholder="設置場所など">${machine ? machine.remarks : ''}</textarea>
                    </div>

                    <div class="form-group" style="margin-top:16px;">
                        <label>機械の写真 (プロフィール用)</label>
                        <div style="display:flex; gap:16px; align-items:center;">
                            <div id="f-machine-photo-preview" class="img-box" style="width:100px; height:100px; border-radius:12px; border:2px dashed var(--border);">
                                ${machine && machine.photo ? `<img src="${machine.photo}">` : '<i class="fa-solid fa-camera" style="font-size:1.5rem; color:#cbd5e1;"></i>'}
                            </div>
                            <div style="flex:1">
                                <input type="file" id="f-machine-photo" accept="image/*" style="font-size:0.8rem;">
                                <input type="hidden" id="f-machine-photo-base64" value="${machine ? machine.photo || '' : ''}">
                                <button type="button" class="secondary-btn f-rotate-btn" style="padding:2px 8px; font-size:0.7rem; margin-top:4px; margin-bottom:4px; display:${machine && machine.photo ? 'inline-block' : 'none'};" onclick="app.rotateSinglePhotoField('f-machine-photo-base64', 'f-machine-photo-preview')"><i class="fa-solid fa-rotate-right"></i> 向きを修正</button>
                                <p style="font-size:0.65rem; color:var(--text-light); margin-top:6px; line-height:1.4;">
                                    ※設定すると一覧やダッシュボードに表示されます。<br>
                                    ※大きな画像は自動でリサイズされます。
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top: 24px; border-top: 2px solid #94a3b8; padding-top: 16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <label style="font-size:0.85rem; font-weight:700;">メンテナンス項目</label>
                            <button type="button" class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.addTaskRow()"><i class="fa-solid fa-plus"></i> 追加</button>
                        </div>
                        <div id="f-tasks-container" style="display:flex; flex-direction:column; gap:10px;"></div>
                    </div>
                    ${usedPartsHTML}
                </form>
            `;

            // Add existing tasks or one empty row
            if (tasks.length > 0) {
                tasks.forEach(t => this.addTaskRow(t));
            } else {
                this.addTaskRow();
            }
        });
    }

    addTaskRow(task = null) {
        const container = document.getElementById('f-tasks-container');
        if (!container) return;

        let partsInfoHTML = '';
        if (task && task.id) {
            const tHistory = store.activeData.history.filter(h => h.taskId === task.id && h.replacedParts && h.replacedParts.length > 0);
            const partMap = {};
            tHistory.forEach(h => {
                h.replacedParts.forEach(p => {
                    const key = `${p.name}___${p.model}`;
                    if (!partMap[key]) {
                        partMap[key] = { name: p.name, model: p.model, count: 0, latestDate: h.date };
                    }
                    partMap[key].count += (p.count || 0);
                    if (new Date(h.date) > new Date(partMap[key].latestDate)) {
                        partMap[key].latestDate = h.date;
                    }
                });
            });
            const pArray = Object.values(partMap).sort((a,b) => new Date(b.latestDate) - new Date(a.latestDate));
            if (pArray.length > 0) {
                partsInfoHTML = `
                    <div style="font-size:0.65rem; color:var(--text-light); margin-top:2px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                        <i class="fa-solid fa-link" style="color:var(--text-light)"></i> 定期交換部品の実績:
                        ${pArray.map(p => `<span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:700; border:1px solid #bae6fd;">${p.name}${p.model ? `[${p.model}]` : ''}</span>`).join('')}
                    </div>
                `;
            }
        }

        const div = document.createElement('div');
        div.className = 'task-row';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.gap = '4px';
        div.style.marginBottom = '12px';
        div.style.paddingBottom = '8px';
        div.style.borderBottom = '1px dashed #e2e8f0';

        div.innerHTML = `
            <div style="display:flex; gap:8px; align-items:center; width:100%;">
                <input type="hidden" class="t-id" value="${task ? task.id : ''}">
                <input type="text" class="t-content" style="flex:2" placeholder="作業内容 (任意)" value="${task ? task.content : ''}">
                <div style="flex:1; display:flex; align-items:center; gap:4px;">
                    <input type="number" class="t-period" style="width:70px" min="0" placeholder="周期" value="${task ? task.periodDays : ''}" oninput="app.updateOneOffBadge(this)">
                    <span style="font-size:0.7rem; color:var(--text-light); white-space:nowrap;">日毎</span>
                    <span class="one-off-badge ${task && (parseInt(task.periodDays) || 0) === 0 ? '' : 'hidden'}">1回きり</span>
                </div>
                <input type="date" class="t-start" style="flex:1" value="${task ? task.startDate : new Date().toISOString().split('T')[0]}">
                <div style="display:flex; gap:4px;">
                    ${task && task.id 
                        ? `
                            <button type="button" class="secondary-btn" title="アーカイブ" style="font-size:1rem; color:var(--text-light);" onclick="app.archiveMaintenanceTask('${task.id}', '${task.content.replace(/'/g, "\\'")}')"><i class="fa-solid fa-box-archive"></i></button>
                            <button type="button" class="secondary-btn" title="削除" style="font-size:1rem; color:var(--danger);" onclick="app.deleteMaintenanceTaskFromMachineModal('${task.id}', '${task.content.replace(/'/g, "\\'")}', this)"><i class="fa-solid fa-trash-can"></i></button>
                        ` 
                        : `<button type="button" class="close-btn" style="font-size:1rem" onclick="this.parentElement.parentElement.parentElement.remove()"><i class="fa-solid fa-trash-can"></i></button>`}
                </div>
            </div>
            ${partsInfoHTML}
            <div style="width:100%; font-size:0.65rem; color:var(--text-light);">
                ※周期を0に設定すると、開始日当日のみ1回だけ予約されます。
            </div>
        `;
        container.appendChild(div);
    }

    updateOneOffBadge(input) {
        const badge = input?.parentElement?.querySelector('.one-off-badge');
        if (!badge) return;
        badge.classList.toggle('hidden', (parseInt(input.value) || 0) !== 0);
    }

    openSuddenRecordModal(defaultDate = null) {
        const machines = store.getMachines();
        const dateVal = defaultDate || new Date().toISOString().split('T')[0];
        const lastMachineCategory = store.getLastSuddenCategory();
        
        this.openModal('sudden', '突発対応の詳細記録', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <form id="sudden-form">
                    <div class="form-group" style="background:#f1f5f9; padding:12px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:15px;">
                        <label style="font-weight:900; color:#475569;"><i class="fa-solid fa-list-ol"></i> 対応ライン番号 <span style="color:var(--danger)">*</span></label>
                        <select id="s-line-no" required style="height:44px; font-weight:900; color:var(--text-main); font-size:1rem; border:2.5px solid var(--border-dark);">
                            <option value="">-- ラインを選択してください --</option>
                            ${this.generateLineOptionsHTML()}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>対象の機械 <span style="color:var(--danger)">*</span></label>
                        <div style="font-size:0.7rem; color:var(--primary); font-weight:800; margin-bottom:8px;">
                            <i class="fa-solid fa-circle-info"></i> 対象機械本体を選択すると対応ラインと装置区分が自動入力されます。
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:10px;">
                            <div class="form-group" style="margin-bottom:0">
                                <label>装置区分 (例: 包装機, 充填機) <span style="color:var(--danger)">*</span></label>
                                <select id="s-machine-category" onchange="app.toggleNewCategoryField('s-')" required style="height:44px;">
                                    <option value="">-- 選択してください --</option>
                                    ${this.getMachineCategoryOptions(lastMachineCategory || '')}
                                </select>
                                <input type="text" id="s-new-category-input" placeholder="新しい装置区分名を入力" style="display:none; margin-top:8px; border:2px solid var(--primary); padding:8px;" onblur="this.value = MaintenanceApp.toFullWidthUpper(this.value)">
                            </div>
                            <div class="form-group" style="margin-bottom:0">
                                <label style="font-size:0.75rem">対象機械本体</label>
                                <select id="s-machine-id" onchange="app.onSuddenMachineChange(this.value)" required style="height:44px; font-weight:700; border:2px solid var(--primary);">
                                    <option value="">-- 選択してください --</option>
                                    ${machines.sort((a,b) => {
                                        const la = a.lineNo || '99';
                                        const lb = b.lineNo || '99';
                                        return String(la).localeCompare(String(lb), undefined, {numeric: true});
                                    }).map(m => `<option value="${m.id}">[${m.lineNo ? this.getLineLabel(m.lineNo) : '未設定'}] ${m.name} [${m.model}]</option>`).join('')}
                                    <option value="NEW_MACHINE">+ 新しい機械として登録する</option>
                                </select>
                            </div>
                        </div>
                        <div id="s-new-machine-fields" style="display:none; grid-template-columns: 1fr 1fr; gap:12px; margin-top:10px; padding:12px; background:var(--background); border-radius:var(--radius-sm);">
                            <div class="form-group" style="margin-bottom:0">
                                <label style="font-size:0.75rem">新規機械名</label>
                                <input type="text" id="s-new-name" placeholder="例: 新規プレス機" list="list-m-names">
                            </div>
                            <div class="form-group" style="margin-bottom:0">
                                <label style="font-size:0.75rem">新規型式</label>
                                <input type="text" id="s-new-model" placeholder="例: NP-500" list="list-m-models">
                            </div>
                        </div>
                    </div>

                    <!-- Search Guides & Copy Last Record -->
                    <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
                        <div id="s-related-guides-section" style="display:none; border-bottom:1px dashed var(--border); padding-bottom:12px;">
                            <label style="font-size:0.8rem; font-weight:800; color:var(--primary); display:flex; align-items:center; gap:6px;">
                                <i class="fa-solid fa-lightbulb"></i> 関連する手順書・ナレッジ
                            </label>
                            <div id="s-related-guides-list" style="margin-top:8px; display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto; padding:4px;"></div>
                        </div>

                        <div id="s-copy-last-section" style="display:none;">
                            <button type="button" id="btn-s-copy-last" class="secondary-btn" style="width:100%; padding:10px; font-weight:800; background:var(--primary-light); color:var(--primary); border:1.5px solid var(--primary); display:flex; align-items:center; justify-content:center; gap:8px;" onclick="app.copyLastSuddenRecord()">
                                <i class="fa-solid fa-clone"></i> この機械の前回の記録をコピー
                            </button>
                            <div style="font-size:0.65rem; color:var(--text-light); text-align:center; margin-top:4px;">※症状/原因/処置/作業者/部品を自動入力します</div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>発生日 <span style="color:var(--danger)">*</span></label>
                            <input type="date" id="s-date" value="${dateVal}" required>
                        </div>
                        <div class="form-group" style="display:flex; align-items:flex-end;">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; background:var(--danger-light); padding:10px 16px; border-radius:var(--radius-md); border:1px solid #fca5a5; width:100%;">
                                <input type="checkbox" id="s-is-dokatei" style="width: auto;" onchange="const np=document.getElementById('s-is-non-production-stop'); if(this.checked && np) np.checked=false;">
                                <span style="font-weight:800; color:var(--danger); font-size:0.85rem;">ドカ停</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; background:#fffbeb; padding:10px 16px; border-radius:var(--radius-md); border:1px solid #fde68a;">
                            <input type="checkbox" id="s-is-non-production-stop" style="width:auto;" onchange="const d=document.getElementById('s-is-dokatei'); if(this.checked && d) d.checked=false;">
                            <span style="font-weight:800; color:#b45309; font-size:0.85rem;">非生産停止トラブル（生産は止まっていない突発メンテ）</span>
                        </label>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>エラー番号</label>
                            <input type="text" id="s-error-no" placeholder="例: E-01" list="s-list-model-error-nos">
                            <div id="s-error-no-suggestions" class="suggestion-area"></div>
                        </div>
                        <div class="form-group">
                            <label>作業時間 (分) <span style="color:var(--danger)">*</span></label>
                            <input type="number" id="s-work-time" placeholder="例: 30" min="0" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>対応種別 <span style="font-size:0.7rem; color:var(--text-light); font-weight:400;">※「初回」のみスキルマップの集計対象になります</span></label>
                        <div style="display:flex; gap:16px; background:var(--background); padding:10px; border-radius:8px; border:1px solid var(--border);">
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" name="s-occurrence" value="first" checked style="width:auto;"> <span style="font-weight:800; color:var(--primary);">初回対応 (技術習得)</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" name="s-occurrence" value="recurrence" style="width:auto;"> <span style="font-weight:800; color:var(--text-light);">再発・繰り返し</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>症状・故障内容 <span style="color:var(--danger)">*</span></label>
                        <textarea id="s-content" rows="2" placeholder="どのような異常が発生したか記入してください" required></textarea>
                        <div id="s-content-suggestions" class="suggestion-area"></div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>原因</label>
                            <textarea id="s-cause" rows="3" placeholder="故障の根本原因" list="s-list-model-causes"></textarea>
                            <div id="s-cause-suggestions" class="suggestion-area"></div>
                        </div>
                        <div class="form-group">
                            <label>処置・対応内容</label>
                            <textarea id="s-notes" rows="3" placeholder="どのような修理・処置を行ったか" list="s-list-model-treatments"></textarea>
                            <div id="s-notes-suggestions" class="suggestion-area"></div>
                        </div>
                    </div>
                    <datalist id="s-list-model-error-nos"></datalist>
                    <datalist id="s-list-model-contents"></datalist>
                    <datalist id="s-list-model-causes"></datalist>
                    <datalist id="s-list-model-treatments"></datalist>

                    <div class="form-group">
                        <label>作業者 (カンマ区切りで複数登録) <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="s-workers" placeholder="例: 田中, 鈴木" list="list-workers" style="border:2px solid var(--primary);" required>
                        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
                            ${store.getWorkers().filter(w => !(store.activeData.archivedSuggestions?.workers || []).includes(w)).map(w => `
                                <div class="suggestion-badge" style="background:#f8fafc; color:#0369a1; border:1px solid #cbd5e1; font-weight:700; display:inline-flex; align-items:stretch; padding:0; overflow:hidden;">
                                    <button type="button" style="background:none; border:none; padding:4px 8px; font-size:inherit; color:inherit; cursor:pointer; font-weight:inherit;" onclick="app.addWorkerToInput('${w}', 's-workers')">
                                        <i class="fa-solid fa-user-plus" style="margin-right:2px; font-size:0.65rem;"></i> ${String(w).replace(/</g, "&lt;")}
                                    </button>
                                    <button type="button" style="background:none; border:none; border-left:1px solid #cbd5e1; padding:0 6px; color:#94a3b8; cursor:pointer;" onclick="app.removeSuggestion('workers', '${w.replace(/'/g, "\\'")}', this.parentElement)" title="今後サジェストしない">
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="form-group">
                        <label>対応区分 (集計用セレクト) <span style="color:var(--danger)">*</span></label>
                        <select id="s-category" required>
                            <option value="">-- 選択してください --</option>
                            <option value="machine">機械修理</option>
                            <option value="electric">電気系修理</option>
                            <option value="adjust">調整・設定変更</option>
                            <option value="parts">部品交換</option>
                            <option value="clean">清掃・給油</option>
                            <option value="other">その他</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>写真の添付 (複数可 / 自動で圧縮保存されます)</label>
                        <input type="file" id="s-photos" accept="image/*" multiple style="margin-bottom:8px;">
                        <div id="s-photo-previews" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
                    </div>

                    <div style="margin-top: 24px; border-top: 2px solid #94a3b8; padding-top: 16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <label style="font-size:0.85rem; font-weight:700;">交換部品・資材</label>
                            <button type="button" class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.addPartRow(null, true)"><i class="fa-solid fa-plus"></i> 追加</button>
                        </div>
                        <div id="s-parts-container" style="display:flex; flex-direction:column; gap:8px;"></div>
                    </div>
                </form>
            `;
        });
    }

    toggleNewMachineFields(value) {
        const fields = document.getElementById('s-new-machine-fields');
        if (value === 'NEW_MACHINE') {
            fields.style.display = 'grid';
            document.getElementById('s-new-name').required = true;
            document.getElementById('s-new-model').required = true;
        } else {
            fields.style.display = 'none';
            document.getElementById('s-new-name').required = false;
            document.getElementById('s-new-model').required = false;
        }
    }

    async removeSuggestion(kind, value, btnElement) {
        if (!store.activeData.archivedSuggestions) {
            store.activeData.archivedSuggestions = { errorNo: [], content: [], cause: [], notes: [], workers: [], partName: [], partModel: [] };
        }
        if (!store.activeData.archivedSuggestions[kind]) {
            store.activeData.archivedSuggestions[kind] = [];
        }
        if (!store.activeData.archivedSuggestions[kind].includes(value)) {
            store.activeData.archivedSuggestions[kind].push(value);
            await store.save(); // Store to IDB
        }
        if (btnElement) {
            btnElement.remove(); // Remove badge from display immediately
        }
    }

    addWorkerToInput(workerName, inputId) {
        const inp = document.getElementById(inputId);
        if (!inp) return;
        let current = inp.value.split(',').map(x => x.trim()).filter(Boolean);
        if (!current.includes(workerName)) {
            current.push(workerName);
        }
        inp.value = current.join(', ');
        inp.focus();
    }

    copyLastSuddenRecord(isEdit = false) {
        const prefix = isEdit ? 'e-' : 's-';
        const machineId = document.getElementById(`${prefix}machine-id`).value;
        if (!machineId || machineId === 'NEW_MACHINE') return;

        // Find latest history for this machine (prefer sudden records)
        const history = store.activeData.history
            .filter(h => h.machineId === machineId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastRecord = history.find(h => h.isSudden) || history[0];

        if (!lastRecord) return;

        // Populate fields
        if (lastRecord.lineNo) document.getElementById(`${prefix}line-no`).value = lastRecord.lineNo;
        if (lastRecord.errorContent) document.getElementById(`${prefix}content`).value = lastRecord.errorContent;
        if (lastRecord.cause) document.getElementById(`${prefix}cause`).value = lastRecord.cause;
        if (lastRecord.notes) document.getElementById(`${prefix}notes`).value = lastRecord.notes;
        if (lastRecord.category) document.getElementById(`${prefix}category`).value = lastRecord.category;
        
        // Auto-set as recurrence since it's a copy of past event
        const occRadio = document.querySelector(`input[name="${prefix}occurrence"][value="recurrence"]`);
        if (occRadio) occRadio.checked = true;
        
        if (lastRecord.workers) {
            document.getElementById(`${prefix}workers`).value = lastRecord.workers.join(', ');
        }

        // Handle parts
        const partsContainer = document.getElementById(`${prefix}parts-container`);
        if (partsContainer && lastRecord.replacedParts && lastRecord.replacedParts.length > 0) {
            partsContainer.innerHTML = '';
            lastRecord.replacedParts.forEach(p => {
                this.addPartRow(p, true);
            });
        }
        
        // Highlight briefly to show it worked
        const form = document.getElementById(`${prefix}-form`);
        if (form) {
            form.style.background = '#f0f9ff';
            setTimeout(() => { form.style.background = 'transparent'; }, 500);
        }
    }

    onSuddenMachineChange(mId, isEdit = false) {
        if (!isEdit) this.toggleNewMachineFields(mId);
        this.updateRelatedGuides(mId); // Update Related Guides Qucik Access
        
        // Show/Hide "Copy Last Record" button
        const prefix = isEdit ? 'e-' : 's-';
        const copySection = document.getElementById(`${prefix}copy-last-section`);
        if (copySection) {
            const hasHistory = store.activeData.history.some(h => h.machineId === mId);
            copySection.style.display = (mId && mId !== 'NEW_MACHINE' && hasHistory) ? 'block' : 'none';
        }

        if (!mId || mId === 'NEW_MACHINE') return;

        const machine = store.getMachines(true).find(m => m.id === mId);
        if (!machine) return;

        // Auto-inherit machine category: Prioritize Master, then fallback to last record
        let inheritCat = machine.category;
        if (!inheritCat) {
            const lastRec = (store.activeData.history || [])
                .filter(h => h.machineId === mId && h.machineCategory)
                .sort((a,b) => new Date(b.date) - new Date(a.date))[0];
            if (lastRec) inheritCat = lastRec.machineCategory;
        }
        
        if (inheritCat) {
            const catSelect = document.getElementById(`${prefix}machine-category`);
            if (catSelect) { 
                catSelect.value = inheritCat;
            }
        }

        // Auto-inherit lineNo
        if (machine.lineNo) {
            const lineSelect = document.getElementById(`${prefix}line-no`);
            if (lineSelect) {
                lineSelect.value = machine.lineNo;
            }
        }

        const model = MaintenanceApp.toHalfWidthLower(machine.model || '');
        const history = store.activeData.history || [];

        // Filter history for SAME model
        const modelHistory = history.filter(h => {
            const m = store.getMachines(true).find(mm => mm.id === h.machineId);
            return m && MaintenanceApp.toHalfWidthLower(m.model || '') === model;
        });

        const getUnique = (list, kind) => {
            const archived = (store.activeData.archivedSuggestions && store.activeData.archivedSuggestions[kind]) || [];
            return [...new Set(list)].filter(v => v !== undefined && v !== null && v !== '' && !archived.includes(v)).sort();
        };

        const errorNos = getUnique(modelHistory.map(h => h.errorNo), 'errorNo');
        const contents = getUnique(modelHistory.map(h => h.errorContent), 'content');
        const causes = getUnique(modelHistory.map(h => h.cause), 'cause');
        const treatments = getUnique(modelHistory.map(h => h.notes), 'notes');

        const inject = (id, vals, targetId) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (vals.length === 0) {
                el.innerHTML = '';
                return;
            }
            if (id.includes('suggestions')) {
                // Badge style
                const kind = targetId.replace(/^[se]-/, '').replace(/-([a-z])/g, g => g[1].toUpperCase()); // e.g. "error-no" -> "errorNo"
                el.innerHTML = `
                    <div style="font-size:0.65rem; color:var(--text-light); margin:6px 0 4px 0; font-weight:700;">
                        <i class="fa-solid fa-clock-rotate-left"></i> 過去の記録 (同一型式):
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:4px;">
                        ${vals.slice(0, 10).map(v => `
                            <div class="suggestion-badge" style="display:inline-flex; align-items:stretch; padding:0; overflow:hidden;">
                                <button type="button" style="background:none; border:none; padding:4px 8px; font-size:inherit; color:inherit; cursor:pointer;" onclick="const t=document.getElementById('${targetId}'); t.value='${v.replace(/'/g, "\\'")}'; t.focus();">
                                    ${String(v).replace(/</g, "&lt;")}
                                </button>
                                <button type="button" style="background:none; border:none; border-left:1px solid rgba(0,0,0,0.1); padding:0 6px; color:#94a3b8; cursor:pointer;" onclick="app.removeSuggestion('${kind}', '${v.replace(/'/g, "\\'")}', this.parentElement)" title="今後サジェストしない">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                // Datalist style
                el.innerHTML = vals.map(v => `<option value="${v}">`).join('');
            }
        };

        inject(`${prefix}error-no-suggestions`, errorNos, `${prefix}error-no`);
        inject(`${prefix}content-suggestions`, contents, `${prefix}content`);
        inject(`${prefix}cause-suggestions`, causes, `${prefix}cause`);
        inject(`${prefix}notes-suggestions`, treatments, `${prefix}notes`);
        
        // Also update datalists
        inject(`${prefix}list-model-error-nos`, errorNos);
        inject(`${prefix}list-model-contents`, contents);
        inject(`${prefix}list-model-causes`, causes);
        inject(`${prefix}list-model-treatments`, treatments);
    }



    openDayQuickMenu(dateStr) {
        const scheduled = this.getScheduledTasksForDate(dateStr);
        const history = this.getHistoryForDate(dateStr);
        const [year, month, day] = dateStr.split('-');

        this.openModal('day-menu', `${month}/${day} の管理メニュー`, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div style="margin-bottom: 24px;">
                    <h4 style="font-size:0.85rem; color:var(--text-light); margin-bottom:12px;"><i class="fa-solid fa-wrench"></i> メンテナンス予定</h4>
                    ${scheduled.length === 0 ? '<p style="font-size:0.85rem; padding:12px; background:var(--background); border-radius:8px;">予定はありません。</p>' : `
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            ${scheduled.map(s => `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--primary-light); border-radius:8px; border:1px solid var(--primary);">
                                    <div>
                                        <div style="font-weight:800; color:var(--primary);">${s.content}</div>
                                        <div style="font-size:0.75rem; color:var(--text-light);">${store.getMachines(true).find(m => m.id === s.machineId)?.name || '不明'}</div>
                                    </div>
                                    <button class="primary-btn" style="padding:4px 12px; font-size:0.75rem" onclick="app.closeModal(); app.openCompletionForm('${s.id}', '${dateStr}')">完了を記録</button>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <div style="margin-bottom: 24px;">
                    <h4 style="font-size:0.85rem; color:var(--text-light); margin-bottom:12px;"><i class="fa-solid fa-clock-rotate-left"></i> 完了済みの記録</h4>
                    ${history.length === 0 ? '<p style="font-size:0.85rem; padding:12px; background:var(--background); border-radius:8px;">記録はありません。</p>' : `
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            ${history.map(h => `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:white; border:1px solid var(--border); border-radius:8px; cursor:pointer;" onclick="app.closeModal(); app.openHistoryEditForm('${h.id}')">
                                    <div>
                                        <div style="font-weight:800;">${h.isSudden ? '<span style="color:var(--danger)">[突発]</span> ' : ''}${this.getHistoryDisplayText(h)}</div>
                                        <div style="font-size:0.75rem; color:var(--text-light);">${store.getMachines(true).find(m => m.id === h.machineId)?.name || '不明'}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <div style="margin-bottom: 24px;">
                    <h4 style="font-size:0.85rem; color:var(--text-light); margin-bottom:12px;"><i class="fa-solid fa-note-sticky"></i> カレンダーに表示するメモ</h4>
                    <textarea id="cal-day-memo" style="width:100%; height:120px; padding:12px; border:2px solid var(--border); border-radius:10px; font-size:0.9rem; font-family:inherit; line-height:1.5; outline:none; transition:border-color 0.2s;" placeholder="カレンダーのセル内に常備表示したいメモを記入（例: 点検立ち合い、来客など）">${store.activeData.memos[dateStr] || ''}</textarea>
                    <button class="primary-btn" style="width:100%; margin-top:10px; font-weight:900;" onclick="app.saveDayMemo('${dateStr}')"><i class="fa-solid fa-floppy-disk"></i> メモをカレンダーへ保存</button>
                    <p style="font-size:0.65rem; color:var(--text-light); margin-top:4px;">※メンテナンス履歴とは別に、セル内に直接メモとして表示されます。</p>
                </div>

                <div style="border-top: 1px dashed var(--border); padding-top: 16px; display:flex; gap:8px;">
                    <button class="secondary-btn" style="flex:1" onclick="app.closeModal(); app.openSuddenRecordModal('${dateStr}')"><i class="fa-solid fa-plus"></i> 突発対応を登録</button>
                </div>
            `;
            // Remove the default save button since this is a menu
            document.querySelector('.modal-footer .primary-btn').classList.add('hidden');
        });
    }

    deleteDayMemo(date) {
        if (!confirm('この日のメモを削除しますか？')) return;
        if (store.activeData.memos) {
            delete store.activeData.memos[date];
            store.save();
            this.renderCalendar();
        }
    }

    saveDayMemo(date) {
        const txt = document.getElementById('cal-day-memo').value.trim();
        if (!store.activeData.memos) store.activeData.memos = {};
        store.activeData.memos[date] = txt;
        store.save();
        this.closeModal();
        this.renderCalendar();
    }

    openHistoryEditForm(historyId) {
        const h = store.activeData.history.find(x => x.id === historyId);
        if (!h) return;

        const machines = store.getMachines();
        this._tempPhotos = h.photos ? [...h.photos] : [];

        this.openModal('edit-history', 'メンテナンス記録の編集', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <form id="edit-history-form">
                    <input type="hidden" id="e-h-id" value="${historyId}">
                    
                    <div class="form-group" style="background:#f1f5f9; padding:12px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:15px;">
                        <label style="font-weight:900; color:#475569;"><i class="fa-solid fa-list-ol"></i> 対応ライン番号 <span style="color:var(--danger)">*</span></label>
                        <select id="e-line-no" required style="height:44px; font-weight:900; color:var(--text-main); font-size:1rem; border:2.5px solid var(--border-dark);">
                            <option value="">-- ラインを選択してください --</option>
                            ${this.generateLineOptionsHTML(h.lineNo || '')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>対象の機械</label>
                        <div style="font-size:0.75rem; color:var(--primary); font-weight:800; margin-bottom:8px;">
                            <i class="fa-solid fa-circle-info"></i> 対象機械本体を選択すると、登録されたラインと装置区分が自動入力されます。
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:10px;">
                            <div class="form-group" style="margin-bottom:0">
                                <label>装置区分 (例: 包装機, 充填機) <span style="color:var(--danger)">*</span></label>
                                <select id="e-machine-category" onchange="app.toggleNewCategoryField('e-')" required style="height:44px;">
                                    <option value="">-- 選択してください --</option>
                                    ${this.getMachineCategoryOptions(h.machineCategory || '')}
                                </select>
                                <input type="text" id="e-new-category-input" placeholder="新しい装置区分名を入力" style="display:none; margin-top:8px; border:2px solid var(--primary); padding:8px;" onblur="this.value = MaintenanceApp.toFullWidthUpper(this.value)">
                            </div>
                            <div class="form-group" style="margin-bottom:0">
                                <label style="font-size:0.75rem">対象機械本体 <span style="color:var(--danger)">*</span></label>
                                <select id="e-machine-id" onchange="app.onSuddenMachineChange(this.value, true)" required style="height:44px;">
                                    ${machines.map(m => `<option value="${m.id}" ${m.id === h.machineId ? 'selected' : ''}>${m.name} [${m.model}]</option>`).join('')}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>実施日 <span style="color:var(--danger)">*</span></label>
                            <input type="date" id="e-date" value="${h.date}" required>
                        </div>
                        <div class="form-group" style="display:flex; align-items:flex-end;">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; background:var(--background); padding:10px 16px; border-radius:var(--radius-md); border:1px solid var(--border); width:100%;">
                                <input type="checkbox" id="e-is-dokatei" ${h.isDokatei ? 'checked' : ''} style="width: auto;" onchange="const np=document.getElementById('e-is-non-production-stop'); if(this.checked && np) np.checked=false;">
                                <span style="font-weight:800; color:var(--text-main); font-size:0.85rem;">ドカ停</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; background:#fffbeb; padding:10px 16px; border-radius:var(--radius-md); border:1px solid #fde68a;">
                            <input type="checkbox" id="e-is-non-production-stop" ${h.isNonProductionStop ? 'checked' : ''} style="width:auto;" onchange="const d=document.getElementById('e-is-dokatei'); if(this.checked && d) d.checked=false;">
                            <span style="font-weight:800; color:#b45309; font-size:0.85rem;">非生産停止トラブル（生産は止まっていない突発メンテ）</span>
                        </label>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>エラー番号</label>
                            <input type="text" id="e-error-no" value="${h.errorNo || ''}" placeholder="例: E-01" list="e-list-model-error-nos">
                            <div id="e-error-no-suggestions" class="suggestion-area"></div>
                        </div>
                        <div class="form-group">
                            <label>作業時間 (分) <span style="color:var(--danger)">*</span></label>
                            <input type="number" id="e-work-time" value="${h.workTime || ''}" placeholder="例: 30" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>症状・故障内容 <span style="color:var(--danger)">*</span></label>
                        <textarea id="e-symptom" rows="2" placeholder="どのような異常が発生したか記入してください" required>${h.errorContent || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label>作業者 (カンマ区切り)</label>
                        <input type="text" id="e-workers" value="${h.workers?.join(', ') || ''}" list="list-workers">
                        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
                            ${store.getWorkers().filter(w => !(store.activeData.archivedSuggestions?.workers || []).includes(w)).map(w => `
                                <div class="suggestion-badge" style="background:#f8fafc; color:#0369a1; border:1px solid #cbd5e1; font-weight:700; display:inline-flex; align-items:stretch; padding:0; overflow:hidden;">
                                    <button type="button" style="background:none; border:none; padding:4px 8px; font-size:inherit; color:inherit; cursor:pointer; font-weight:inherit;" onclick="app.addWorkerToInput('${w}', 'e-workers')">
                                        <i class="fa-solid fa-user-plus" style="margin-right:2px; font-size:0.65rem;"></i> ${String(w).replace(/</g, "&lt;")}
                                    </button>
                                    <button type="button" style="background:none; border:none; border-left:1px solid #cbd5e1; padding:0 6px; color:#94a3b8; cursor:pointer;" onclick="app.removeSuggestion('workers', '${w.replace(/'/g, "\\'")}', this.parentElement)" title="今後サジェストしない">
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="form-group">
                        <label>対応区分 (集計用セレクト) <span style="color:var(--danger)">*</span></label>
                        <select id="e-category" required>
                            <option value="">-- 選択してください --</option>
                            <option value="machine" ${h.category === 'machine' ? 'selected' : ''}>機械修理</option>
                            <option value="electric" ${h.category === 'electric' ? 'selected' : ''}>電気系修理</option>
                            <option value="adjust" ${h.category === 'adjust' ? 'selected' : ''}>調整・設定変更</option>
                            <option value="parts" ${h.category === 'parts' ? 'selected' : ''}>部品交換</option>
                            <option value="clean" ${h.category === 'clean' ? 'selected' : ''}>清掃・給油</option>
                            <option value="other" ${h.category === 'other' || !h.category ? 'selected' : ''}>その他</option>
                        </select>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>原因</label>
                            <textarea id="e-cause" rows="3" placeholder="故障の根本原因" list="e-list-model-causes">${h.cause || ''}</textarea>
                            <div id="e-cause-suggestions" class="suggestion-area"></div>
                        </div>
                        <div class="form-group">
                            <label>処置・対応内容</label>
                            <textarea id="e-notes" rows="3" placeholder="どのような修理・処置を行ったか" list="e-list-model-treatments">${h.notes || ''}</textarea>
                            <div id="e-notes-suggestions" class="suggestion-area"></div>
                        </div>
                    </div>
                    <datalist id="e-list-model-error-nos"></datalist>
                    <datalist id="e-list-model-contents"></datalist>
                    <datalist id="e-list-model-causes"></datalist>
                    <datalist id="e-list-model-treatments"></datalist>

                    <div class="form-group">
                        <label>写真の添付</label>
                        <input type="file" id="e-photos" accept="image/*" multiple style="margin-bottom:8px;">
                        <div id="e-photo-previews" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
                    </div>

                    <div class="form-group">
                        <label>対応種別 <span style="font-size:0.7rem; color:var(--text-light); font-weight:400;">※「初回」のみスキルマップの集計対象になります</span></label>
                        <div style="display:flex; gap:16px; background:var(--background); padding:10px; border-radius:8px; border:1px solid var(--border);">
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" name="e-occurrence" value="first" ${h.isFirstTime !== false ? 'checked' : ''} style="width:auto;"> <span style="font-weight:800; color:var(--primary);">初回対応 (技術習得)</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" name="e-occurrence" value="recurrence" ${h.isFirstTime === false ? 'checked' : ''} style="width:auto;"> <span style="font-weight:800; color:var(--text-light);">再発・繰り返し</span>
                            </label>
                        </div>
                    </div>

                    <div style="margin-top: 24px; border-top: 2px solid #94a3b8; padding-top: 16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <label style="font-size:0.85rem; font-weight:700;">交換部品・資材</label>
                            <button type="button" class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.addPartRow(null, true)"><i class="fa-solid fa-plus"></i> 追加</button>
                        </div>
                        <div id="s-parts-container" style="display:flex; flex-direction:column; gap:8px;"></div>
                    </div>
                </form>
            `;

            // Pre-fill parts (Hide price in edit form)
            if (h.replacedParts) {
                h.replacedParts.forEach(p => this.addPartRow(p, true));
            }
            
            // Photo Handler Setup (Initial render only)
            const previewContainer = document.getElementById('e-photo-previews');
            previewContainer.innerHTML = '';
            this._tempPhotos.forEach(p => {
                const div = this.createPhotoPreviewElement(
                    p,
                    (removedSrc) => { this._tempPhotos = this._tempPhotos.filter(img => img !== removedSrc); },
                    (oldSrc, newSrc) => { this._tempPhotos = this._tempPhotos.map(img => img === oldSrc ? newSrc : img); },
                    80
                );
                previewContainer.appendChild(div);
            });

            // Custom footer for edit
            const footer = document.querySelector('.modal-footer');
            footer.innerHTML = `
                <button class="danger-btn" style="margin-right:auto" onclick="app.deleteHistoryEntry('${historyId}')">この記録を削除</button>
                <button class="secondary-btn" onclick="app.closeModal()">キャンセル</button>
                <button class="primary-btn" id="modal-save-btn">上書き保存</button>
            `;
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.onclick = () => this.saveModalData('edit-history');

            // Trigger initial suggestions for the selected machine
            this.onSuddenMachineChange(h.machineId, true);
        });
    }

    deleteHistoryEntry(id) {
        if (confirm('この記録を完全に削除しますか？')) {
            const h = store.activeData.history.find(h => h.id === id);
            if (h && h.replacedParts) {
                h.replacedParts.forEach(p => {
                    store.adjustStock(p.name, p.model, p.count); // Restore stock
                });
            }
            store.activeData.history = store.activeData.history.filter(h => h.id !== id);
            store.save();
            this.closeModal();
            this.renderCalendar();
            this.renderHistory(); // Refresh history view if active
        }
    }

    renderHistory(searchQuery = '') {
        const body = document.getElementById('history-list-body');
        if (!body) return;

        // Active filters banner
        const activeFiltersArea = document.getElementById('hist-active-filters');
        if (activeFiltersArea) {
            if (this.modelFilter || this.workerFilter) {
                activeFiltersArea.innerHTML = `
                    <div style="background:var(--secondary-light); color:var(--secondary); padding:8px 16px; border-radius:8px; margin-bottom:12px; font-size:0.8rem; display:flex; justify-content:space-between; align-items:center;">
                        <span><i class="fa-solid fa-filter"></i> <b>${this.modelFilter ? `型式: ${this.modelFilter}` : `作業員: ${this.workerFilter}`}</b> で抽出中</span>
                        <button class="secondary-btn" style="padding:2px 10px; font-size:0.7rem;" onclick="app.clearModelFilter(); app.workerFilter=null; app.renderHistory();">解除</button>
                    </div>
                `;
            } else {
                activeFiltersArea.innerHTML = '';
            }
        }

        const mFilter = document.getElementById('hist-filter-machine');
        const tFilter = document.getElementById('hist-filter-type');
        const pFilter = document.getElementById('hist-filter-period');

        // ラインフィルタの選択肢を動的生成 (初回のみ)
        const lineFilterEl = document.getElementById('hist-filter-line');
        if (lineFilterEl && lineFilterEl.options.length <= 1) {
            const lines = new Set();
            store.activeData.history.forEach(h => { if (!h.isManualGuide && h.lineNo) lines.add(h.lineNo); });
            store.getMachines(true).forEach(m => { if (m.lineNo) lines.add(m.lineNo); });
            Array.from(lines).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).forEach(l => {
                const opt = document.createElement('option');
                opt.value = l;
                opt.textContent = this.getLineLabel(l);
                lineFilterEl.appendChild(opt);
            });
        }
        
        const globalSearch = document.getElementById('global-search').value.toLowerCase();
        const query = searchQuery || globalSearch;

        const machineId = mFilter?.value;
        const lineVal = document.getElementById('hist-filter-line')?.value || 'all';
        const type = tFilter?.value;
        const period = pFilter?.value || 'this_month';

        let filtered = store.activeData.history ? store.activeData.history.filter(h => !h.isManualGuide) : [];
        filtered = this.filterHistoryByPeriod(filtered, period);
        this.updateViewSubtitle('view-history', period);

        if (machineId) {
            filtered = filtered.filter(h => h.machineId === machineId);
        }

        if (lineVal !== 'all') {
            filtered = filtered.filter(h => {
                const m = store.getMachines(true).find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                return String(l) === String(lineVal);
            });
        }
        
        if (this.modelFilter) {
            const normFilter = MaintenanceApp.toHalfWidthLower(this.modelFilter);
            filtered = filtered.filter(h => {
                const machine = store.getMachines(true).find(m => m.id === h.machineId);
                const mModel = MaintenanceApp.toHalfWidthLower(machine?.model || '');
                return mModel === normFilter;
            });
        }

        if (this.workerFilter) {
            filtered = filtered.filter(h => h.workers && h.workers.includes(this.workerFilter));
        }

        if (type === 'periodic') {
            filtered = filtered.filter(h => !!h.taskId);
        } else if (type === 'sudden') {
            filtered = filtered.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop);
        } else if (type === 'nonProductionStop') {
            filtered = filtered.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop);
        } else if (type === 'dokatei') {
            filtered = filtered.filter(h => !!h.isDokatei);
        }

        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (query) {
            const terms = MaintenanceStore.toHalfWidthLower(query).split(/\s+/).filter(t => t);
            filtered = filtered.filter(h => {
                const machine = store.getMachines(true).find(m => m.id === h.machineId);
                const taskName = this.getHistoryDisplayText(h);
                const searchableText = (h.date || '') + ' ' + taskName + ' ' + (h.notes || '') + ' ' + (h.cause || '') + ' ' + (machine?.name || '') + ' ' + (machine?.model || '') + ' ' + (h.machineCategory || '');
                const normTxt = MaintenanceStore.toHalfWidthLower(searchableText);
                return terms.every(t => normTxt.includes(t));
            });
        }

        body.innerHTML = '';
        if (filtered.length === 0) {
            body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text-light)">履歴が見つかりません</td></tr>';
            return;
        }

        filtered.forEach(h => {
            const machine = store.getMachines(true).find(m => m.id === h.machineId);
            const tr = document.createElement('tr');
            
            let rowBg = '#ffffff';
            const typeInfo = this.getHistoryTypeInfo(h);
            let badgeClass = h.taskId ? 'badge-periodic' : 'badge-sudden';
            let badgeText = typeInfo.label;
            let titleColor = typeInfo.color;
            
            if (h.isDokatei) {
                rowBg = '#fef2f2'; // Pink
                badgeClass = 'badge-dokatei';
                badgeText = 'ドカ停';
                titleColor = 'var(--danger)';
            } else if (h.taskId) {
                rowBg = '#eff6ff'; // Light Blue
            } else if (h.isNonProductionStop) {
                rowBg = '#fffbeb'; // Light Amber
                badgeClass = 'badge-sudden';
            } else {
                rowBg = '#f0fdf4'; // Light Green
            }
            tr.style.backgroundColor = rowBg;

            let guideBtnClass = h.guide ? (h.isDokatei ? 'guide-dokatei' : (h.taskId ? 'guide-periodic' : 'guide-sudden')) : 'guide-none';
            
            const normMName = MaintenanceApp.toFullWidthUpper(machine ? machine.name : '不明');
            const normMModel = MaintenanceApp.toHalfWidthLower(machine ? machine.model : '');
            const replacedParts = h.replacedParts || [];
            const partsTitle = replacedParts.length
                ? replacedParts.map(p => `${p.name || '部品名なし'}${p.model ? ` [${p.model}]` : ''} ${p.count ?? p.qty ?? 0}${this.formatHistoryPartUnit(p.unit)}`).join(' / ')
                : '';

            tr.innerHTML = `
                <td style="font-weight:700">${h.date}</td>
                <td style="font-size:0.85rem">
                    <div style="display:flex; gap:10px; align-items:center;">
                        <div class="img-box" style="width:36px; height:36px; border-radius:8px; flex-shrink:0;">
                            ${machine?.photo ? `<img src="${machine.photo}">` : '<i class="fa-solid fa-industry" style="font-size:0.8rem; color:#cbd5e1;"></i>'}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; gap:4px; align-items:center; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${this.getLineBadge(h.lineNo || machine?.lineNo)}
                                ${ (h.machineCategory || machine?.category) ? `<span style="font-size:0.65rem; color:var(--text-light); font-weight:800;"><i class="fa-solid fa-tag"></i> ${h.machineCategory || machine.category}</span>` : ''}
                            </div>
                            <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; font-weight:700;" title="${normMName}">${this.highlightText(normMName, query)}</div>
                            <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                <span style="color:var(--secondary); font-weight:700; cursor:pointer; font-size:0.75rem;" onclick="app.toggleModelFilter('${normMModel}', event)" title="この型式で抽出">
                                    [${this.highlightText(normMModel, query)}]
                                    ${this.modelFilter === normMModel ? ' <i class="fa-solid fa-filter" style="font-size:0.6rem"></i>' : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px;">
                        <div style="font-weight:900; color:${titleColor}; flex:1; display:flex; align-items:center; min-width:0; gap:6px;">
                            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${this.getHistoryDisplayText(h)}">${this.highlightText(this.getHistoryDisplayText(h), query)}</span>
                            ${h.isFirstTime !== false 
                                ? `<span class="badge-occurrence first" style="font-size:0.65rem; padding:2px 6px; background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; border-radius:4px; font-weight:800; flex-shrink:0;">初回</span>`
                                : `<span class="badge-occurrence recurrence" style="font-size:0.65rem; padding:2px 6px; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; border-radius:4px; font-weight:800; flex-shrink:0;">再発</span>`
                            }
                        </div>
                        <div style="font-size:0.85rem; color:var(--text-light); font-weight:700; white-space:nowrap; display:flex; gap:4px; align-items:center; flex-shrink:0;">
                            <i class="fa-solid fa-user-gear" style="font-size:0.75rem; opacity:0.8;"></i> 
                            ${(h.workers || []).map(w => {
                                const colors = this.getWorkerColors(w);
                                return `<span class="worker-badge" style="cursor:pointer; padding:2px 6px; border-radius:4px; background-color:${colors.bg}; color:${colors.text}; border:1px solid ${colors.border}; font-size:0.75rem; ${this.workerFilter === w ? 'ring:2px solid var(--primary); outline:2px solid var(--primary);' : ''}" onclick="app.toggleWorkerFilter('${w}', event)">${w}</span>`;
                            }).join('') || '-'}
                            ${this.workerFilter && (h.workers || []).includes(this.workerFilter) ? ' <i class="fa-solid fa-filter" style="font-size:0.75rem; color:var(--primary)"></i>' : ''}
                        </div>
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-light); line-height:1.4; margin-top:4px;">
                        ${h.cause ? `<div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="原因: ${h.cause}">原因: ${this.highlightText(h.cause, query)}</div>` : ''}
                        ${h.notes ? `<div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="処置: ${h.notes}">処置: ${this.highlightText(h.notes, query)}</div>` : ''}
                    </div>
                </td>
                <td>
                    ${h.photos && h.photos.length > 0 ? `
                        <div style="display:flex; flex-wrap:wrap; gap:4px; max-width:64px;">
                            ${h.photos.slice(0, 2).map(p => `
                                <div class="img-box" style="width:28px; height:28px; border-radius:4px; border:1px solid var(--border); box-shadow:0 1px 2px rgba(0,0,0,0.05); flex-shrink:0;">
                                    <img src="${p}" alt="添付画像" style="object-fit:cover; width:100%; height:100%;">
                                </div>
                            `).join('')}
                            ${h.photos.length > 2 ? `<div style="font-size:0.6rem; color:var(--text-light); width:100%; text-align:center;">+${h.photos.length-2}</div>` : ''}
                        </div>
                    ` : '<span style="color:var(--text-light); font-size:0.75rem;">-</span>'}
                </td>
                <td style="text-align: center;"><span class="badge ${badgeClass}" style="cursor:pointer; padding:4px 6px; font-size:0.65rem; min-width:40px; ${h.isNonProductionStop ? 'background:#fef3c7; color:#92400e; border:1px solid #fcd34d;' : ''}" onclick="app.toggleTypeFilter('${typeInfo.key}', event)" title="この区分で抽出">${badgeText}</span></td>
                <td>${h.workTime || 0}分</td>
                <td class="history-parts-cell">
                    ${replacedParts.length ? `
                        <button type="button" class="history-parts-btn" onclick="app.openHistoryPartsDetail('${this.escapeJs(h.id)}')" title="${this.escapeHtml(partsTitle)}" aria-label="交換部品の詳細を表示">
                            <i class="fa-solid fa-box-open"></i>
                            <span>${replacedParts.length}</span>
                        </button>
                    ` : '<span style="color:var(--text-light); font-size:0.75rem;">-</span>'}
                </td>
                <td style="vertical-align: top;">
                    <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
                        ${(() => {
                            let guideInfo = h.guide;
                            let isRef = false;
                            if (!guideInfo) {
                                const taskTitle = this.getHistoryDisplayText(h);
                                const found = store.activeData.history.find(r => r.id !== h.id && r.machineId === h.machineId && this.getHistoryDisplayText(r) === taskTitle && r.guide);
                                if (found) { guideInfo = found.guide; isRef = true; }
                            }
                            
                            if (guideInfo) {
                                return `
                                <button class="secondary-btn ${guideBtnClass}" style="padding:4px 6px; font-size:0.65rem; width:100%; justify-content:center; ${isRef ? 'opacity:0.8; border-style:dashed;' : ''}" onclick="app.openGuideModal('${h.id}')">
                                    <i class="fa-solid fa-file-invoice"></i> 手順
                                </button>`;
                            } else {
                                return `
                                <button class="secondary-btn guide-none" style="padding:4px 6px; font-size:0.65rem; width:100%; justify-content:center;" onclick="app.openGuideModal('${h.id}')">
                                    <i class="fa-solid fa-file-invoice"></i> 手順
                                </button>`;
                            }
                        })()}
                        <button class="icon-btn" onclick="app.openHistoryEditForm('${h.id}')" style="width:100%; padding:4px; font-size:0.7rem; display:flex; justify-content:center; border:1px solid transparent; background:var(--background-alt); border-radius:4px;"><i class="fa-solid fa-pen-to-square"></i></button>
                    </div>
                </td>
            `;
            body.appendChild(tr);
        });
    }

    formatHistoryPartUnit(unit) {
        if (!unit || unit === 'pcs') return '個';
        return unit;
    }

    openHistoryPartsDetail(historyId) {
        const h = (store.activeData.history || []).find(x => String(x.id) === String(historyId));
        if (!h) return;

        const machine = store.getMachines(true).find(m => m.id === h.machineId);
        const parts = h.replacedParts || [];
        this.openModal('history-parts-detail', '交換部品詳細', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="history-parts-detail-head">
                    <div>
                        <span>日付</span>
                        <b>${this.escapeHtml(h.date || '-')}</b>
                    </div>
                    <div>
                        <span>機械</span>
                        <b>${this.escapeHtml(machine ? `${machine.name} [${machine.model || '-'}]` : '不明')}</b>
                    </div>
                    <div>
                        <span>内容</span>
                        <b>${this.escapeHtml(this.getHistoryDisplayText(h))}</b>
                    </div>
                </div>
                <div class="history-parts-detail-list">
                    ${parts.map(p => {
                        const count = p.count ?? p.qty ?? 0;
                        const unit = this.formatHistoryPartUnit(p.unit);
                        const price = Number(p.price || 0);
                        return `
                            <div class="history-parts-detail-item">
                                <div class="history-parts-detail-icon"><i class="fa-solid fa-box"></i></div>
                                <div>
                                    <b>${this.escapeHtml(p.name || '部品名なし')}</b>
                                    <span>${this.escapeHtml(p.model || '型式なし')}</span>
                                </div>
                                <strong>${this.escapeHtml(String(count))}${this.escapeHtml(unit)}</strong>
                                ${price ? `<em>¥${Math.round(price).toLocaleString()}</em>` : '<em>-</em>'}
                            </div>
                        `;
                    }).join('') || '<div style="color:var(--text-light); padding:16px;">交換部品はありません</div>'}
                </div>
            `;

            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.style.display = 'none';
        });
    }

    toggleModelFilter(model, event) {
        if (!model) return;
        if (event) event.stopPropagation();
        
        if (this.modelFilter === model) {
            this.modelFilter = null;
        } else {
            this.modelFilter = model;
        }
        this.renderHistory();
    }

    toggleMachineFilter(machineId, event) {
        if (!machineId) return;
        if (event) event.stopPropagation();
        
        const filter = document.getElementById('hist-filter-machine');
        if (!filter) return;

        if (filter.value === machineId) {
            filter.value = '';
        } else {
            filter.value = machineId;
        }
        this.renderHistory();
    }

    toggleTypeFilter(type, event) {
        if (!type) return;
        if (event) event.stopPropagation();
        
        const filter = document.getElementById('hist-filter-type');
        if (!filter) return;

        if (filter.value === type) {
            filter.value = '';
        } else {
            filter.value = type;
        }
        this.renderHistory();
    }

    toggleWorkerFilter(worker, event) {
        if (!worker) return;
        if (event) event.stopPropagation();
        
        if (this.workerFilter === worker) {
            this.workerFilter = null;
        } else {
            this.workerFilter = worker;
        }
        this.renderHistory();
    }

    getWorkerColors(name) {
        const palette = [
            { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' }, // Blue
            { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' }, // Green
            { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' }, // Orange
            { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff' }, // Purple
            { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3' }, // Pink
            { bg: '#f0f9ff', text: '#075985', border: '#bae6fd' }, // Sky
            { bg: '#fdf4ff', text: '#86198f', border: '#f5d0fe' }, // Fuchsia
            { bg: '#f5f5f4', text: '#44403c', border: '#e7e5e4' }  // Stone
        ];
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % palette.length;
        return palette[index];
    }

    getHistoryDisplayText(h) {
        if (!h.taskId) return h.errorContent || h.notes || '突発対応';
        const task = store.activeData.tasks.find(t => String(t.id) === String(h.taskId));
        return task ? task.content : (h.taskContent || '定期メンテナンス');
    }

    getFiscalYear(dateStr) {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        const year = d.getFullYear();
        const month = d.getMonth() + 1; // 1-indexed
        return month >= 4 ? year : year - 1;
    }

    filterHistoryByPeriod(history, period) {
        if (!period || period === 'all') return history;

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

        if (period === 'today') return history.filter(h => h.date === todayStr);
        if (period === 'yesterday') return history.filter(h => h.date === yestStr);
        if (period === 'yesterday_today') return history.filter(h => h.date === todayStr || h.date === yestStr);

        if (period === 'this_month') {
            const curMonthStr = todayStr.substring(0, 7);
            return history.filter(h => h.date && h.date.startsWith(curMonthStr));
        }
        if (period === 'last_month') {
            const lastMonthVal = new Date(todayVal.getFullYear(), todayVal.getMonth() - 1, 1);
            const lastMonthStr = formatDate(lastMonthVal).substring(0, 7);
            return history.filter(h => h.date && h.date.startsWith(lastMonthStr));
        }
        if (period === 'last_30_days') {
            const start = new Date(); start.setDate(start.getDate() - 30);
            const startStr = formatDate(start);
            return history.filter(h => h.date >= startStr && h.date <= todayStr);
        }
        if (period === 'prev_30_days') {
            const date31 = new Date(); date31.setDate(date31.getDate() - 31);
            const date60 = new Date(); date60.setDate(date60.getDate() - 60);
            return history.filter(h => h.date >= formatDate(date60) && h.date <= formatDate(date31));
        }
        if (period === 'fiscal_year') {
            const currentFY = this.getFiscalYear(todayStr);
            return history.filter(h => this.getFiscalYear(h.date) === currentFY);
        }
        if (period === 'last_fiscal_year') {
            const lastFY = this.getFiscalYear(todayStr) - 1;
            return history.filter(h => this.getFiscalYear(h.date) === lastFY);
        }
        if (period === 'custom') {
            const startDate = localStorage.getItem('customStartDate');
            return startDate ? history.filter(h => h.date >= startDate) : history;
        }
        if (period === 'custom_range') {
            const start = localStorage.getItem('customRangeStart');
            const end = localStorage.getItem('customRangeEnd');
            return history.filter(h => {
                if (!h.date) return false;
                if (start && h.date < start) return false;
                if (end && h.date > end) return false;
                return true;
            });
        }
        
        const fy = parseInt(period);
        if (!isNaN(fy)) return history.filter(h => this.getFiscalYear(h.date) === fy);
        
        return history;
    }

    updateHistoryPeriodOptions() {
        const hFilter = document.getElementById('hist-filter-period');
        const aFilter = document.getElementById('analysis-filter-period');
        const dFilter = document.getElementById('dashboard-filter-period');
        const rFilter = document.getElementById('ranking-filter-period');
        const wtFilter = document.getElementById('worktime-filter-period');
        
        const filters = [hFilter, aFilter, dFilter, rFilter, wtFilter].filter(f => f);
        if (filters.length === 0) return;
        
        const years = new Set();
        store.activeData.history.forEach(h => {
            const fy = this.getFiscalYear(h.date);
            if (fy) years.add(fy);
        });
        years.add(this.getFiscalYear(new Date().toISOString().split('T')[0]));
        const sortedYears = Array.from(years).sort((a,b) => b - a);

        const now = new Date();
        const currentMonth = now.getMonth() + 1;

        filters.forEach(filter => {
            const currentVal = filter.value;
            const customDate = localStorage.getItem('customStartDate');
            const customLabel = customDate ? `指定日以降 (${customDate})` : '指定日以降...';
            
            const rangeStart = localStorage.getItem('customRangeStart');
            const rangeEnd = localStorage.getItem('customRangeEnd');
            const rangeLabel = (rangeStart && rangeEnd) ? `指定範囲 (${rangeStart}〜${rangeEnd})` : '指定範囲 (開始〜終了)...';

            filter.innerHTML = `
                <option value="today">今日</option>
                <option value="yesterday">昨日</option>
                <option value="yesterday_today">昨日と今日</option>
                <option value="this_month">今月 (${currentMonth}月)</option>
                <option value="all">累計 (全ての記録)</option>
                <option value="custom">${customLabel}</option>
                <option value="custom_range">${rangeLabel}</option>
            `;
            sortedYears.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = `${y}年度 (4月〜3月)`;
                filter.appendChild(opt);
            });
            // デフォルトは「今月」に設定（ただし既に値がある場合は保持）
            if (!currentVal) {
                filter.value = 'this_month';
            } else {
                filter.value = currentVal;
            }
        });
    }

    onPeriodChange(el, renderFn) {
        if (el.value === 'custom') {
            const current = localStorage.getItem('customStartDate') || new Date().toISOString().split('T')[0];
            const date = prompt('指定日以降のデータを集計します。開始日を入力してください (YYYY-MM-DD):', current);
            if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
                localStorage.setItem('customStartDate', date);
                this.updateHistoryPeriodOptions();
                el.value = 'custom';
            } else if (!localStorage.getItem('customStartDate')) {
                el.value = 'this_month';
            }
        } else if (el.value === 'custom_range') {
            const curS = localStorage.getItem('customRangeStart') || new Date().toISOString().split('T')[0];
            const curE = localStorage.getItem('customRangeEnd') || new Date().toISOString().split('T')[0];
            const start = prompt('開始日を入力してください (YYYY-MM-DD):', curS);
            if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
                const end = prompt('終了日を入力してください (YYYY-MM-DD):', curE);
                if (end && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
                    localStorage.setItem('customRangeStart', start);
                    localStorage.setItem('customRangeEnd', end);
                    this.updateHistoryPeriodOptions();
                    el.value = 'custom_range';
                }
            }
            if (!localStorage.getItem('customRangeStart') || !localStorage.getItem('customRangeEnd')) {
                if (el.value === 'custom_range') el.value = 'this_month';
            }
        }
        renderFn();
    }

    getPeriodDays(period) {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const dayMs = 24 * 60 * 60 * 1000;

        if (period === 'today' || period === 'yesterday') return 1;
        if (period === 'this_month') return (now.getDate());
        if (period === 'last_month') {
            const lastM = new Date(now.getFullYear(), now.getMonth(), 0);
            return lastM.getDate();
        }
        if (period === 'last_30_days') return 30;
        if (period === 'prev_30_days') return 30;
        if (period === 'fiscal_year') {
            const fyStart = new Date(this.getFiscalYear(todayStr), 3, 1);
            return Math.ceil((now - fyStart) / dayMs) || 1;
        }
        if (period === 'last_fiscal_year') {
            const fyStart = new Date(this.getFiscalYear(todayStr) - 1, 3, 1);
            const fyEnd = new Date(this.getFiscalYear(todayStr), 2, 31);
            return Math.ceil((fyEnd - fyStart) / dayMs) + 1;
        }
        if (period === 'custom') {
            const startStr = localStorage.getItem('customStartDate');
            if (!startStr) return 1;
            const start = new Date(startStr);
            return Math.ceil((now - start) / dayMs) || 1;
        }
        if (period === 'custom_range') {
            const sStr = localStorage.getItem('customRangeStart');
            const eStr = localStorage.getItem('customRangeEnd');
            if (!sStr || !eStr) return 1;
            const start = new Date(sStr);
            const end = new Date(eStr);
            return Math.ceil((end - start) / dayMs) + 1 || 1;
        }
        const fy = parseInt(period);
        if (!isNaN(fy)) return 365; // Default for historical years
        return 30;
    }

    getPeriodLabel(period) {
        const periodMap = { 
            'today': '今日',
            'yesterday': '昨日',
            'yesterday_today': '昨日・今日',
            'this_month': '今月', 
            'fiscal_year': '今年度', 
            'all': '累計', 
            'custom': '指定日以降', 
            'custom_range': '指定範囲', 
            'last_month': '先月', 
            'last_30_days': '直近30日間', 
            'prev_30_days': 'その前の30日間', 
            'last_fiscal_year': '前年度' 
        };
        let label = periodMap[period] || (isNaN(parseInt(period)) ? '不明' : `${period}年度`);
        
        if (period === 'custom') {
            const date = localStorage.getItem('customStartDate');
            if (date) label = `${date} 以降`;
        } else if (period === 'custom_range') {
            const s = localStorage.getItem('customRangeStart');
            const e = localStorage.getItem('customRangeEnd');
            if (s && e) label = `${s} 〜 ${e}`;
        }
        return label;
    }

    updateViewSubtitle(viewId, period) {
        const view = document.getElementById(viewId);
        if (!view) return;
        const subtitle = view.querySelector('.subtitle');
        if (!subtitle) return;

        // Extract base text by removing any previously appended period info
        const baseTxt = subtitle.textContent.split(' 集計期間:')[0].split(' [')[0].split('【')[0].trim(); 
        const label = this.getPeriodLabel(period);
        subtitle.innerHTML = `${baseTxt} <span class="period-badge-header" style="background:var(--primary-light); color:var(--primary); padding:3px 10px; border-radius:99px; margin-left:10px; font-size:0.75rem; border:1px solid var(--primary); font-weight:800; white-space:nowrap;"><i class="fa-solid fa-calendar-day" style="margin-right:4px;"></i>集計期間: ${label}</span>`;
    }

    openCompletionForm(taskId, dateStr) {
        const task = store.activeData.tasks.find(t => t.id === taskId);
        const machine = store.getMachines(true).find(m => m.id === task.machineId);

        // Find last parts for this specific task to auto-copy
        // First try: exact taskId match with parts
        let lastRecord = store.activeData.history
            .filter(h => h.taskId != null && String(h.taskId) === String(taskId) && h.replacedParts && h.replacedParts.length > 0)
            .sort((a,b) => new Date(b.date) - new Date(a.date))[0];
        const isDoneBefore = store.activeData.history.some(h => h.taskId != null && String(h.taskId) === String(taskId));
        // Fallback: same machine + same task content (in case taskId differs)
        if (!lastRecord && task) {
            lastRecord = store.activeData.history
                .filter(h => h.machineId === task.machineId && h.replacedParts && h.replacedParts.length > 0)
                .sort((a,b) => new Date(b.date) - new Date(a.date))[0];
        }
        const lastParts = (lastRecord && lastRecord.replacedParts) ? lastRecord.replacedParts : [];
        
        // Find latest machine category for this machine to inherit
        const lastMachineCategoryRecord = store.activeData.history
            .filter(h => h.machineId === task.machineId && h.machineCategory)
            .sort((a,b) => new Date(b.date) - new Date(a.date))[0];
        const lastMachineCategory = lastMachineCategoryRecord ? lastMachineCategoryRecord.machineCategory : '';

        this.openModal('complete', `メンテナンス完了報告`, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <form id="complete-form">
                    <input type="hidden" id="c-task-id" value="${taskId}">
                    <input type="hidden" id="c-machine-id" value="${task.machineId}">

                    <div class="form-group" style="background:#f1f5f9; padding:12px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:15px;">
                        <label style="font-weight:900; color:#475569;"><i class="fa-solid fa-list-ol"></i> 実施ライン番号 <span style="color:var(--danger)">*</span></label>
                        <select id="c-line-no" required style="height:44px; font-weight:900; color:var(--primary); font-size:1rem; border:2px solid var(--primary);">
                            <option value="">-- ラインを選択してください --</option>
                            ${this.generateLineOptionsHTML(machine?.lineNo || '')}
                        </select>
                    </div>

                    <div style="padding:12px; background:var(--primary-light); border-radius:8px; margin-bottom:20px;">
                        <div style="font-size:0.75rem; color:var(--primary); font-weight:800;">対象</div>
                        <div style="font-weight:900; font-size:1.1rem;">${machine?.name}</div>
                        <div style="font-weight:700; color:var(--text-light);">${task.content}</div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label>実施日 <span style="color:var(--danger)">*</span></label>
                            <input type="date" id="c-date" value="${dateStr}" required>
                        </div>
                        <div class="form-group">
                            <label>作業時間 (分) <span style="color:var(--danger)">*</span></label>
                            <input type="number" id="c-work-time" placeholder="例: 30" required>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>装置区分 (例: 包装機, 充填機) <span style="color:var(--danger)">*</span></label>
                        <select id="c-machine-category" onchange="app.toggleNewCategoryField('c-')" required style="height:44px;">
                            <option value="">-- 選択してください --</option>
                            ${this.getMachineCategoryOptions(lastMachineCategory || machine?.category || '')}
                        </select>
                        <input type="text" id="c-new-category-input" placeholder="新しい装置区分名を入力" style="display:none; margin-top:8px; border:2px solid var(--primary); padding:8px;" onblur="this.value = MaintenanceApp.toFullWidthUpper(this.value)">
                    </div>

                    <div class="form-group">
                        <label>対応区分 (集計用セレクト) <span style="color:var(--danger)">*</span></label>
                        <select id="c-category" required>
                            <option value="">-- 選択してください --</option>
                            <option value="machine">機械修理</option>
                            <option value="electric">電気系修理</option>
                            <option value="adjust">調整・設定変更</option>
                            <option value="parts">部品交換</option>
                            <option value="clean">清掃・給油</option>
                            <option value="other">その他</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>作業報告・備考</label>
                        <textarea id="c-notes" rows="2" placeholder="特記事項があれば記入"></textarea>
                    </div>

                    <div class="form-group">
                        <label>作業者 (カンマ区切り) <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="c-workers" placeholder="例: 田中, 鈴木" list="list-workers" style="border:2px solid var(--primary);" required>
                    </div>

                    <div class="form-group">
                        <label>対応種別 <span style="font-size:0.7rem; color:var(--text-light); font-weight:400;">※「初回」のみスキルマップの集計対象になります</span></label>
                        <div style="display:flex; gap:16px; background:var(--background); padding:10px; border-radius:8px; border:1px solid var(--border);">
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" name="c-occurrence" value="first" ${!isDoneBefore ? 'checked' : ''} style="width:auto;"> <span style="font-weight:800; color:var(--primary);">初回対応 (技術習得)</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" name="c-occurrence" value="recurrence" ${isDoneBefore ? 'checked' : ''} style="width:auto;"> <span style="font-weight:800; color:var(--text-light);">再発・繰り返し</span>
                            </label>
                        </div>
                    </div>

                     <div style="margin-top: 24px; border-top: 2px solid #94a3b8; padding-top: 16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <label style="font-size:0.85rem; font-weight:700;">使用部品・グリス等</label>
                            <button type="button" class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.addPartRow(null, true)"><i class="fa-solid fa-plus"></i> 追加</button>
                        </div>
                        <div id="s-parts-container" style="display:flex; flex-direction:column; gap:8px;"></div>
                        ${lastParts.length > 0 ? `
                            <div style="font-size:0.65rem; color:var(--primary); margin-top:8px; font-weight:700;">
                                <i class="fa-solid fa-circle-info"></i> 前回の使用部品を自動コピーしました
                            </div>
                        ` : ''}
                    </div>
                </form>
            `;

            // Auto-fill last parts
            if (lastParts.length > 0) {
                lastParts.forEach(p => this.addPartRow(p, true));
            }

            if ((parseInt(task.periodDays) || 0) <= 0) {
                const footer = document.querySelector('.modal-footer');
                if (footer) {
                    footer.insertAdjacentHTML('afterbegin', `
                        <button type="button" class="danger-btn" style="margin-right:auto" onclick="app.deleteOneOffMaintenanceFromCompletion('${task.id}', '${task.content.replace(/'/g, "\\'")}')">
                            <i class="fa-solid fa-trash-can"></i> この予定を削除
                        </button>
                    `);
                }
            }
        });
    }

    deleteOneOffMaintenanceFromCompletion(taskId, content) {
        if (!confirm(`1回きりの定期メンテ「${content}」をカレンダーから削除しますか？\nこの予定は未完了のまま取り消されます。`)) return;

        store.freezeTaskContentInHistory(taskId);
        store.activeData.tasks = (store.activeData.tasks || []).filter(t => String(t.id) !== String(taskId));
        store.save();
        this.closeModal();
        this.renderCalendar();
        this.renderMachines();
    }

    openModal(type, title, renderFn) {
        const overlay = document.getElementById('modal-overlay');
        const container = document.getElementById('modal-container');
        container.dataset.modalType = type;
        
        container.innerHTML = `
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close-btn" onclick="app.closeModal()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body" id="modal-content"></div>
            <div class="modal-footer">
                <button class="secondary-btn" onclick="app.closeModal()">キャンセル</button>
                <button class="primary-btn" id="modal-save-btn">保存する</button>
            </div>
        `;
        
        if (renderFn) renderFn();

        const saveBtn = document.getElementById('modal-save-btn');
        if (saveBtn) saveBtn.onclick = () => this.saveModalData(type);
        
        // Photo listener for modals
        if (type === 'sudden' || type === 'edit-history') {
            const photoInput = document.getElementById(type === 'sudden' ? 's-photos' : 'e-photos');
            const preview = document.getElementById(type === 'sudden' ? 's-photo-previews' : 'e-photo-previews');
            if (photoInput && preview) {
                // Initialize for sudden records since they don't have predefined tempPhotos
                if (type === 'sudden') {
                    this._tempPhotos = [];
                    preview.innerHTML = '';
                }

                photoInput.addEventListener('change', async (e) => {
                    const files = Array.from(e.target.files);
                    if (!this._tempPhotos) this._tempPhotos = [];

                    for (const file of files) {
                        const base64 = await MaintenanceStore.resizeImage(file);
                        this._tempPhotos.push(base64);
                        const div = this.createPhotoPreviewElement(
                            base64,
                            (removedSrc) => { this._tempPhotos = this._tempPhotos.filter(p => p !== removedSrc); },
                            (oldSrc, newSrc) => { this._tempPhotos = this._tempPhotos.map(p => p === oldSrc ? newSrc : p); },
                            80
                        );
                        preview.appendChild(div);
                    }
                    e.target.value = ''; // Reset input to allow adding the same file again
                });
            }
        } else if (type === 'machine' || type === 'part-master') {
            const isPart = (type === 'part-master');
            const photoInput = document.getElementById(isPart ? 'pm-photo' : 'f-machine-photo');
            const photoHidden = document.getElementById(isPart ? 'pm-photo-base64' : 'f-machine-photo-base64');
            const preview = document.getElementById(isPart ? 'pm-photo-preview' : 'f-machine-photo-preview');
            if (photoInput && photoHidden && preview) {
                photoInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const base64 = await MaintenanceStore.resizeImage(file, 400); // Small square profile
                        photoHidden.value = base64;
                        preview.innerHTML = `<img src="${base64}" style="width:100%; height:100%; object-fit:cover;">`;
                        const rotateBtn = photoInput.parentElement.querySelector('.f-rotate-btn');
                        if (rotateBtn) rotateBtn.style.display = 'inline-block';
                    }
                });
            }
        }

        overlay.classList.remove('hidden');
    }

    createPhotoPreviewElement(base64, onRemove, onRotate, size = 80) {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.display = 'inline-block';
        div.innerHTML = `
            <div class="img-box" style="width:${size}px; height:${size}px; border-radius:4px; overflow:hidden;">
                <img src="${base64}" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <button type="button" class="rotate-btn" style="position:absolute; bottom:0; right:0; background:rgba(0,0,0,0.6); color:white; border:none; padding:2px 4px; font-size:12px; cursor:pointer; border-radius:2px;" title="回転"><i class="fa-solid fa-rotate-right"></i></button>
            <button type="button" class="close-btn" style="position:absolute; top:-5px; right:-5px; background:white; padding:2px; font-size:12px; z-index:1000; cursor:pointer;" title="削除">×</button>
        `;
        
        let currentBase64 = base64; // Keep internal reference for exact string matching

        div.querySelector('.rotate-btn').onclick = async (e) => {
            e.stopPropagation();
            try {
                const img = div.querySelector('img');
                const rotated = await MaintenanceStore.rotateImageBase64(currentBase64, 90);
                const oldSrc = currentBase64;
                currentBase64 = rotated;
                img.src = rotated;
                if (onRotate) onRotate(oldSrc, rotated);
            } catch(err) { console.error('Rotate failed', err); }
        };

        div.querySelector('.close-btn').onclick = (e) => {
            e.stopPropagation();
            if (onRemove) onRemove(currentBase64);
            div.remove();
        };

        return div;
    }

    async rotateSinglePhotoField(hiddenInputId, previewContainerId) {
        const hiddenInput = document.getElementById(hiddenInputId);
        const preview = document.getElementById(previewContainerId);
        if (!hiddenInput || !hiddenInput.value) return;
        
        try {
            const rotated = await MaintenanceStore.rotateImageBase64(hiddenInput.value, 90);
            hiddenInput.value = rotated;
            preview.innerHTML = `<img src="${rotated}" style="width:100%; height:100%; object-fit:cover;">`;
        } catch(err) {
            console.error('Rotate failed', err);
        }
    }

    initGlobalImageZoom() {
        const preview = document.getElementById('global-image-preview');
        const img = document.getElementById('global-image-target');
        if (!preview || !img) return;
        this.imagePreviewLocked = false;

        const showPreview = (imgBox) => {
            if (!imgBox) return;
            const targetImg = imgBox.querySelector('img');
            if (!targetImg || !targetImg.src) return;
            const rect = targetImg.getBoundingClientRect();
            img.src = targetImg.src;

            preview.style.left = rect.left + 'px';
            preview.style.top = rect.top + 'px';
            preview.style.width = rect.width + 'px';
            preview.style.height = rect.height + 'px';
            preview.style.transform = 'scale(1)';

            const isShiftNotebookPhoto = !!imgBox.closest('.shift-photo-previews') || !!imgBox.closest('.notebook-search-photos') || !!imgBox.closest('.shift-fullscreen-photos-wrapper');
            if (isShiftNotebookPhoto) {
                preview.classList.add('contain-mode');
            } else {
                preview.classList.remove('contain-mode');
            }
            const scale = isShiftNotebookPhoto ? Math.min(26, Math.max(12, 980 / Math.max(rect.width, rect.height))) : 9;
            const zoomedW = rect.width * scale;
            const zoomedH = rect.height * scale;

            let centerX = rect.left + rect.width / 2;
            let centerY = rect.top + rect.height / 2;
            const margin = 20;
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            if (centerX - zoomedW / 2 < margin) centerX = zoomedW / 2 + margin;
            if (centerX + zoomedW / 2 > winW - margin) centerX = winW - zoomedW / 2 - margin;
            if (centerY - zoomedH / 2 < margin) centerY = zoomedH / 2 + margin;
            if (centerY + zoomedH / 2 > winH - margin) centerY = winH - zoomedH / 2 - margin;

            preview.classList.remove('hidden');
            requestAnimationFrame(() => {
                preview.style.left = (centerX - rect.width / 2) + 'px';
                preview.style.top = (centerY - rect.height / 2) + 'px';
                preview.style.transform = `scale(${scale})`;
            });
        };

        const hidePreview = () => {
            preview.classList.add('hidden');
            preview.classList.remove('locked');
            preview.style.transform = 'scale(1)';
            this.imagePreviewLocked = false;
        };

        document.addEventListener('mouseover', (e) => {
            if (this.imagePreviewLocked) return;
            const imgBox = e.target.closest('.img-box');
            if (!imgBox) return;
            showPreview(imgBox);
        });

        document.addEventListener('mouseout', (e) => {
            if (this.imagePreviewLocked) return;
            const imgBox = e.target.closest('.img-box');
            if (imgBox && !e.relatedTarget?.closest('.img-box')) {
                hidePreview();
            }
        });

        document.addEventListener('click', (e) => {
            const imgBox = e.target.closest('.img-box');
            if (imgBox) {
                e.stopPropagation();
                showPreview(imgBox);
                this.imagePreviewLocked = true;
                preview.classList.add('locked');
                return;
            }
            if (this.imagePreviewLocked) hidePreview();
        });
    }

    resizeImage(file, maxWidth = 800, quality = 0.7) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
            };
        });
    }

    // Normalization helpers
    static toFullWidth(str) {
        if (!str) return '';
        return str.replace(/[!-~]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0));
    }

    static toFullWidthUpper(str) {
        if (!str) return '';
        return this.toFullWidth(str).toUpperCase();
    }

    static toHalfWidthLower(str) {
        if (!str) return '';
        // Convert full-width space to half-width space first
        const s = str.replace(/　/g, ' ');
        const half = s.replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        return half.toLowerCase().trim();
    }

    openSubstituteModal(oldName, oldModel) {
        this.openModal('substitute', '代替品（型番切替）の設定', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <form id="substitute-form">
                    <input type="hidden" id="sub-old-name" value="${oldName}">
                    <input type="hidden" id="sub-old-model" value="${oldModel}">
                    <div style="padding:12px; background:var(--danger-light); border-radius:8px; margin-bottom:20px;">
                        <div style="font-size:0.75rem; color:var(--danger); font-weight:800;">現在の名称・型式 (旧品扱いになります)</div>
                        <div style="font-weight:900;">${oldName} [${oldModel}]</div>
                    </div>
                    <div class="form-group">
                        <label>新しい部品名 (最新名称) <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="sub-new-name" value="${oldName}" required>
                    </div>
                    <div class="form-group">
                        <label>新しい型式 (最新型番) <span style="color:var(--danger)">*</span></label>
                        <input type="text" id="sub-new-model" value="" placeholder="例: NP-501-A" required>
                    </div>
                    <div class="form-group">
                        <label>新しい標準単価</label>
                        <input type="number" id="sub-new-price" placeholder="価格に変更がなければ空欄">
                    </div>
                    <p style="font-size:0.75rem; color:var(--text-light); line-height:1.4;">
                        ※設定すると、これまでの全ての記録が「新しい型式」に紐付けられ、一つのカードとして集計されます。
                    </p>
                </form>
            `;
        });
    }

    openPartMasterModal(name, model) {
        const isNew = !name;
        const master = isNew ? null : store.getPartMaster(name, model);
        
        // Calculate Yearly Costs & Individual Records (only for editing)
        const canonName = isNew ? '' : (master ? master.name : name);
        const canonModel = isNew ? '' : (master ? master.model : model);
        const yearlyCosts = {};
        const usageHistory = [];
        
        if (!isNew) {
            store.activeData.history.forEach(h => {
                (h.replacedParts || []).forEach(p => {
                    const pMaster = store.getPartMaster(p.name, p.model);
                    const isMatch = (pMaster && pMaster.name === canonName && pMaster.model === canonModel) || 
                                    (!pMaster && MaintenanceStore.toFullWidth(p.name) === canonName && MaintenanceStore.toHalfWidthLower(p.model) === canonModel);
                    
                    if (isMatch) {
                        const fy = this.getFiscalYear(h.date);
                        if (fy) {
                            const cost = (parseFloat(p.price) || (master?.price || 0)) * (parseFloat(p.count) || 0);
                            yearlyCosts[fy] = (yearlyCosts[fy] || 0) + cost;
                        }
                        const m = store.getMachines(true).find(machine => machine.id === h.machineId);
                        usageHistory.push({
                            date: h.date,
                            machineName: m ? m.name : '不明',
                            machineModel: m ? m.model : '-',
                            count: p.count,
                            unit: p.unit,
                            model: p.model // Show original model if it was an alias
                        });
                    }
                });
            });
            // Sort history by date desc
            usageHistory.sort((a,b) => new Date(b.date) - new Date(a.date));
        }

        this.openModal('part-master', isNew ? '新規部品の登録' : '部品マスターの編集', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <form id="part-master-form">
                    ${isNew ? `
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                            <div class="form-group">
                                <label>部品名称 <span style="color:var(--danger)">*</span></label>
                                <input type="text" id="pm-name" placeholder="例: ベアリング" required>
                            </div>
                            <div class="form-group">
                                <label>型番・スペック <span style="color:var(--danger)">*</span></label>
                                <input type="text" id="pm-model" placeholder="例: 6204ZZ" required>
                            </div>
                        </div>
                    ` : `
                        <input type="hidden" id="pm-name" value="${name}">
                        <input type="hidden" id="pm-model" value="${model}">
                        <div style="padding:12px; background:var(--primary-light); border-radius:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <div style="font-size:0.75rem; color:var(--primary); font-weight:800;">現在の名称</div>
                                <div style="font-weight:900; font-size:1.1rem;">${name}</div>
                                <div style="font-weight:700; color:var(--text-light);">${model}</div>
                            </div>
                            <button type="button" class="secondary-btn" style="padding:4px 10px; font-size:0.7rem;" onclick="app.openSubstituteModal('${name}', '${model}')">
                                <i class="fa-solid fa-shuffle"></i> 代替品設定
                            </button>
                        </div>
                    `}

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                        <div class="form-group">
                            <label style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                標準単価
                                <span style="font-size:0.65rem; color:var(--text-light); font-weight:400;">液体は 値段/重量(kg) で入力するとg単価が自動計算されます</span>
                            </label>
                            <input type="text" id="pm-price-raw" value="${master?.priceRaw || (master?.price ? String(master.price) : '')}" placeholder="例: 1500 または 15000/20(kg)" oninput="app.calcPartMasterPrice(this.value)" style="font-family:monospace;">
                            <div id="pm-price-hint" style="font-size:0.7rem; color:var(--primary); font-weight:700; min-height:1.2em;"></div>
                            <input type="hidden" id="pm-price" value="${master?.price || ''}">
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                            <div class="form-group">
                                <label>主要仕入先</label>
                                <input type="text" id="pm-supplier" value="${master?.supplier || ''}" placeholder="例: 〇〇商事">
                            </div>
                            <div class="form-group">
                                <label>棚番 (任意)</label>
                                <input type="text" id="pm-shelf" value="${master?.shelf || ''}" placeholder="例: A-1-2">
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>備考・管理メモ</label>
                        <textarea id="pm-remarks" rows="2" placeholder="図面番号や保管場所など">${master?.remarks || ''}</textarea>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-top:16px; padding:15px; background:#fff7ed; border:1.5px solid #fed7aa; border-radius:12px;">
                        <div class="form-group" style="grid-column: span 2;">
                             <label style="font-weight:800; color:#c2410c;">管理単位</label>
                             <select id="pm-unit" style="border-color:#fdba74;">
                                 <option value="個" ${master?.unit === '個' ? 'selected' : ''}>個 (pcs)</option>
                                 <option value="g" ${master?.unit === 'g' || master?.unit === 'kg' ? 'selected' : ''}>g (グラム)</option>
                             </select>
                        </div>
                        <div class="form-group">
                            <label style="font-weight:800; color:#c2410c;"><i class="fa-solid fa-boxes-stacked"></i> 現在庫数</label>
                            <input type="number" id="pm-stock" value="${master?.stock || 0}" step="0.001" style="border-color:#fdba74; font-size:1.1rem; font-weight:900;">
                        </div>
                        <div class="form-group">
                            <label style="font-weight:800; color:#c2410c;"><i class="fa-solid fa-bell"></i> 発注アラート閾値</label>
                            <input type="number" id="pm-min-stock" value="${master?.minStock || 0}" step="0.1" placeholder="0以下で無効" style="border-color:#fdba74;">
                            <p style="font-size:0.65rem; color:#9a3412; margin-top:4px;">※在庫がこの値を下回るとダッシュボード等で警告が出ます。</p>
                        </div>
                    </div>

                    <div class="form-group" style="margin-top:20px; padding:15px; border:2px dashed var(--border); border-radius:12px; background:var(--background);">
                        <label style="margin-bottom:12px; display:block;">部品の写真</label>
                        <div style="display:flex; gap:20px; align-items:center;">
                            <div id="pm-photo-preview" class="img-box" style="width:100px; height:100px; border-radius:10px;">
                                ${master && master.photo ? `<img src="${master.photo}">` : '<i class="fa-solid fa-camera" style="font-size:1.8rem; color:#cbd5e1;"></i>'}
                            </div>
                            <div style="flex:1">
                                <input type="file" id="pm-photo" accept="image/*" style="font-size:0.8rem; margin-bottom:8px;">
                                <input type="hidden" id="pm-photo-base64" value="${master ? master.photo || '' : ''}">
                                <button type="button" class="secondary-btn f-rotate-btn" style="padding:2px 8px; font-size:0.7rem; margin-top:4px; margin-bottom:4px; display:${master && master.photo ? 'inline-block' : 'none'};" onclick="app.rotateSinglePhotoField('pm-photo-base64', 'pm-photo-preview')"><i class="fa-solid fa-rotate-right"></i> 向きを修正</button>
                                <div style="font-size:0.65rem; color:var(--text-light); line-height:1.4;">
                                    ※現場での識別を容易にするために、現物の全体写真やラベル等のアップロードを推奨します。
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 2fr; gap:16px; margin-top:16px;">
                        <div>
                            <label style="font-size:0.85rem; font-weight:700; display:block; margin-bottom:8px;">年度別消費金額</label>
                            <div style="background:var(--background); border-radius:8px; padding:12px; max-height:220px; overflow-y:auto;">
                                ${Object.keys(yearlyCosts).length === 0 ? '<div style="font-size:0.75rem; color:var(--text-light)">実績なし</div>' : `
                                    <table style="width:100%; font-size:0.75rem; border-collapse:collapse;">
                                        ${Object.keys(yearlyCosts).sort().reverse().map(fy => `
                                            <tr style="border-bottom:1px solid #e2e8f0;">
                                                <td style="padding:4px 0; color:var(--text-light);">${fy}年度</td>
                                                <td style="padding:4px 0; text-align:right; font-weight:800;">¥${Math.round(yearlyCosts[fy]).toLocaleString()}</td>
                                            </tr>
                                        `).join('')}
                                    </table>
                                `}
                            </div>
                        </div>
                        <div>
                            <label style="font-size:0.85rem; font-weight:700; display:block; margin-bottom:8px;">使用履歴 (直近20件)</label>
                            <div style="background:var(--background); border-radius:8px; padding:12px; max-height:220px; overflow-y:auto;">
                                ${usageHistory.length === 0 ? '<div style="font-size:0.75rem; color:var(--text-light)">履歴なし</div>' : `
                                    <table style="width:100%; font-size:0.75rem; border-collapse:collapse;">
                                        <thead>
                                            <tr style="border-bottom:2px solid #cbd5e1; text-align:left;">
                                                <th style="padding:4px 0;">日付</th>
                                                <th style="padding:4px 0;">対象機械 (名称/型式)</th>
                                                <th style="padding:4px 0; text-align:right;">数量</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${usageHistory.slice(0, 20).map(u => `
                                                <tr style="border-bottom:1px solid #e2e8f0;">
                                                    <td style="padding:4px 0; white-space:nowrap;">${u.date}</td>
                                                    <td style="padding:4px 0;">
                                                        <div style="color:var(--text-main); font-weight:700;">${u.machineName}</div>
                                                        <div style="font-size:0.65rem; color:var(--text-light);">${u.machineModel}</div>
                                                    </td>
                                                    <td style="padding:4px 0; text-align:right;">${Math.round(u.count)} <span style="font-size:0.6rem;">${(u.unit === 'pcs' || u.unit === '個' || !u.unit) ? '個' : u.unit}</span></td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                `}
                            </div>
                        </div>
                    </div>
                </form>
            `;
        });
    }

    addPartRow(p = null, hidePrice = false) {
        const container = document.getElementById('s-parts-container');
        if (!container) return;
        
        const name = p?.name || '';
        const model = p?.model || '';
        const count = p?.count || '';
        const unit = p?.unit || '個';
        const price = p?.price || '';

        const row = document.createElement('div');
        row.className = 'part-row';
        row.style = 'display:grid; grid-template-columns: 2fr 2fr 1fr 1.5fr ' + (hidePrice ? '' : '1fr ') + 'auto; gap:8px; margin-bottom:8px;';
        
        // Auto-price lookup logic
        const updatePrice = () => {
            const n = row.querySelector('.p-name').value;
            const m = row.querySelector('.p-model').value;
            if (n) {
                const master = store.getPartMaster(n, m);
                if (master && (master.price || master.price === 0)) {
                    row.querySelector('.p-price').value = master.price;
                }
            }
        };

        row.innerHTML = `
            <input type="text" class="p-name" placeholder="部品名" value="${name}" list="list-part-names">
            <input type="text" class="p-model" placeholder="型番" value="${model}" list="list-part-models">
            <input type="number" class="p-count" placeholder="量" value="${count}" step="0.001">
            <select class="p-unit">
                <option value="個" ${unit === 'pcs' || unit === '個' ? 'selected' : ''}>個</option>
                <option value="g" ${unit === 'g' || unit === 'kg' ? 'selected' : ''}>g</option>
            </select>
            ${hidePrice 
                ? `<input type="hidden" class="p-price" value="${price}">` 
                : `<input type="number" class="p-price" placeholder="単価" value="${price}">`}
            <button type="button" class="close-btn" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
        `;

        const nameIn = row.querySelector('.p-name');
        const modelIn = row.querySelector('.p-model');
        nameIn.addEventListener('input', updatePrice);
        modelIn.addEventListener('input', updatePrice);
        
        // Initial lookup if name provided
        if (name && !price && price !== 0) updatePrice();

        container.appendChild(row);
    }

    closeModal() {
        const container = document.getElementById('modal-container');
        if (container?.dataset.modalType === 'shift-notebook') {
            this._skipShiftNoteFormatCommitOnce = true;
            this._activeShiftNoteEditor = null;
        }
        document.getElementById('modal-overlay').classList.add('hidden');
        if (container) delete container.dataset.modalType;
    }

    // Real-time price calculator for part master (supports "price/weightKG" format)
    calcPartMasterPrice(raw) {
        const hint = document.getElementById('pm-price-hint');
        const hiddenPrice = document.getElementById('pm-price');
        if (!hint || !hiddenPrice) return;

        const slashIdx = raw.indexOf('/');
        if (slashIdx !== -1) {
            const totalPrice = parseFloat(raw.substring(0, slashIdx));
            const weightKg = parseFloat(raw.substring(slashIdx + 1));
            if (!isNaN(totalPrice) && !isNaN(weightKg) && weightKg > 0) {
                const perG = totalPrice / (weightKg * 1000);
                hint.innerHTML = `<i class="fa-solid fa-calculator"></i> 1gあたり ¥${perG.toFixed(4)} （¥${totalPrice.toLocaleString()} ÷ ${weightKg}kg）`;
                hiddenPrice.value = perG;
            } else {
                hint.textContent = '※ 「価格/重量KG」の形式で入力してください';
                hiddenPrice.value = '';
            }
        } else {
            const plain = parseFloat(raw);
            hint.textContent = isNaN(plain) ? '' : `→ 1個 ¥${plain.toLocaleString()}`;
            hiddenPrice.value = isNaN(plain) ? '' : plain;
        }
    }

    saveModalData(type) {
        try {
            const form = document.getElementById(`${type}-form`);
            if (form && !form.reportValidity()) return;
        if (type === 'shift-notebook') {
            const editing = this._editingShiftNotebook;
            if (!editing) return;
            this.saveShiftNotebook(editing.dateStr, editing.shift);
        } else if (type === 'machine') {
            const name = document.getElementById('f-machine-name').value;
            const model = document.getElementById('f-machine-model').value;
            const manufacturer = document.getElementById('f-machine-manufacturer').value;
            const lineNo = document.getElementById('f-machine-line-no').value;
            const remarks = document.getElementById('f-machine-remarks').value;
            const photo = document.getElementById('f-machine-photo-base64').value;
            const id = document.getElementById('f-machine-id').value;

            const category = this.getCategoryFromModalInput('f-');

            if (!name || !model) {
                alert('機械名と型式は必須です。');
                return;
            }

            let machineId = id;
            if (id) {
                store.updateMachine(id, { name, model, manufacturer, remarks, photo, category, lineNo });
            } else {
                const newM = store.addMachine(name, model, remarks, photo, category, lineNo, manufacturer);
                machineId = newM.id;
            }

            // Tasks
            const taskRows = document.querySelectorAll('#f-tasks-container .task-row');
            const currentTaskIds = [];
            taskRows.forEach(row => {
                const tId = row.querySelector('.t-id').value;
                const content = row.querySelector('.t-content').value;
                const period = row.querySelector('.t-period').value;
                const start = row.querySelector('.t-start').value;

                if (content) {
                    if (tId) {
                        const taskToUpdate = store.activeData.tasks.find(x => x.id === tId);
                        if (taskToUpdate) {
                            taskToUpdate.content = content;
                            taskToUpdate.periodDays = parseInt(period) || 0;
                            taskToUpdate.startDate = start;
                        }
                        currentTaskIds.push(tId);
                    }
 else {
                        const newT = store.addTask(machineId, content, period, start);
                        currentTaskIds.push(newT.id);
                    }
                }
            });

            // Delete tasks not in current rows (but keep archived ones)
            store.activeData.tasks = store.activeData.tasks.filter(t => {
                if (t.machineId !== machineId) return true; // Keep other machines
                if (currentTaskIds.includes(t.id)) return true; // Keep active rows
                if (store.isMaintenanceTaskArchived(t.id)) return true; // Keep archived tasks
                store.freezeTaskContentInHistory(t.id);
                if ((parseInt(t.periodDays) || 0) <= 0) {
                    t.deleted = true;
                    return true;
                }
                return false;
            });
            store.save();

            this.closeModal();
            this.updateDataLists(); // プルダウンを更新
            this.renderMachines();
            this.renderCalendar();
        } else if (type === 'sudden') {
            let machineId = document.getElementById('s-machine-id').value;
            const lineNo = document.getElementById('s-line-no').value;
            const date = document.getElementById('s-date').value;
            const symptom = document.getElementById('s-content').value;
            const cause = document.getElementById('s-cause').value;
            const treatment = document.getElementById('s-notes').value;
            const errorNo = document.getElementById('s-error-no').value;
            const workTime = document.getElementById('s-work-time').value;
            const workerText = document.getElementById('s-workers').value;
            const isDokatei = document.getElementById('s-is-dokatei').checked;
            const isNonProductionStop = !isDokatei && !!document.getElementById('s-is-non-production-stop')?.checked;
            const category = document.getElementById('s-category').value;
            const machineCategory = this.getCategoryFromModalInput('s-');
            
            if (machineId === 'NEW_MACHINE') {
                const newName = document.getElementById('s-new-name').value;
                const newModel = document.getElementById('s-new-model').value;
                if (!newName || !newModel) {
                    alert('新規登録する機械の名前と型式を入力してください。');
                    return;
                }
                const newM = store.addMachine(newName, newModel, '', '', machineCategory, lineNo);
                machineId = newM.id;
            }

            if (!machineId || !symptom) {
                alert('機械と症状の内容は必須です。');
                return;
            }

            const workers = workerText ? workerText.split(',').map(s => s.trim()).filter(Boolean) : [];
            if (workers.length === 0) {
                alert('作業者は必須です。少なくとも1名入力してください。');
                const workersInput = document.getElementById('s-workers');
                if (workersInput) { workersInput.focus(); workersInput.style.border = '2px solid var(--danger)'; }
                return;
            }

            // Capture Parts (With price)
            const partRows = document.querySelectorAll('#s-parts-container .part-row');
            const replacedParts = [];
            partRows.forEach(row => {
                const nameInput = row.querySelector('.p-name');
                const modelInput = row.querySelector('.p-model');
                const countInput = row.querySelector('.p-count');
                const unitInput = row.querySelector('.p-unit');
                const priceInput = row.querySelector('.p-price');

                if (nameInput && nameInput.value) {
                    replacedParts.push({ 
                        name: MaintenanceStore.toFullWidth(nameInput.value),
                        model: MaintenanceStore.toHalfWidthLower(modelInput ? modelInput.value : ''),
                        count: parseFloat(countInput ? countInput.value : 0) || 0, 
                        unit: unitInput ? unitInput.value : '個',
                        price: parseFloat(priceInput ? priceInput.value : 0) || 0
                    });
                }
            });

            if (workers.length === 0) {
                // already handled above
            }

            store.addHistoryRecord({
                machineId,
                date,
                notes: treatment,
                cause: cause,
                errorContent: symptom,
                errorNo,
                workTime,
                workers,
                replacedParts,
                photos: this._tempPhotos || [],
                isSudden: true,
                isDokatei,
                isNonProductionStop,
                category,
                machineCategory,
                lineNo,
                isFirstTime: document.querySelector('input[name="s-occurrence"]:checked')?.value === 'first'
            });

            // Update Master Category if it's missing or different (Sync back)
            if (machineId && machineCategory && machineId !== 'NEW_MACHINE') {
                const targetM = store.getMachines(true).find(m => m.id === machineId);
                if (targetM && targetM.category !== machineCategory) {
                    store.updateMachine(machineId, { category: machineCategory });
                }
            }

            // Auto-deduct stock
            replacedParts.forEach(p => {
                store.adjustStock(p.name, p.model, -p.count);
            });

            this._tempPhotos = [];

            this.closeModal();
            this.updateDataLists(); // プルダウンを更新
            this.renderCalendar();
            this.renderMachines();
            this.renderHistory();
            this.renderDashboard();
        } else if (type === 'complete') {
            const taskId = document.getElementById('c-task-id').value;
            const machineId = document.getElementById('c-machine-id').value;
            const lineNo = document.getElementById('c-line-no').value;
            const date = document.getElementById('c-date').value;
            const notes = document.getElementById('c-notes').value || '定期メンテナンス完了';
            const machineCategory = this.getCategoryFromModalInput('c-');
            const workTime = document.getElementById('c-work-time').value;
            const workerText = document.getElementById('c-workers').value;
            const category = document.getElementById('c-category').value;

            // Capture Parts (With price)
            const partRows = document.querySelectorAll('#s-parts-container .part-row');
            const replacedParts = [];
            partRows.forEach(row => {
                const nameInput = row.querySelector('.p-name');
                const modelInput = row.querySelector('.p-model');
                const countInput = row.querySelector('.p-count');
                const unitInput = row.querySelector('.p-unit');
                const priceInput = row.querySelector('.p-price');

                if (nameInput && nameInput.value) {
                    replacedParts.push({ 
                        name: MaintenanceStore.toFullWidth(nameInput.value),
                        model: MaintenanceStore.toHalfWidthLower(modelInput ? modelInput.value : ''),
                        count: parseFloat(countInput ? countInput.value : 0) || 0, 
                        unit: unitInput ? unitInput.value : '個',
                        price: parseFloat(priceInput ? priceInput.value : 0) || 0
                    });
                }
            });

            const workers = workerText ? workerText.split(',').map(s => s.trim()).filter(Boolean) : [];
            if (workers.length === 0) {
                alert('作業者は必須です。少なくとも1名入力してください。');
                const workersInput = document.getElementById('c-workers');
                if (workersInput) { workersInput.focus(); workersInput.style.border = '2px solid var(--danger)'; }
                return;
            }

            const task = store.activeData.tasks.find(t => String(t.id) === String(taskId));
            store.addHistoryRecord({
                taskId,
                taskContent: task ? task.content : '定期メンテナンス', // Save fixed label
                machineId,
                date,
                notes,
                workTime,
                workers,
                replacedParts,
                isSudden: false,
                isDokatei: false,
                category,
                machineCategory: machineCategory,
                lineNo,
                isFirstTime: document.querySelector('input[name="c-occurrence"]:checked')?.value === 'first'
            });

            // Update Master Machine Info (Sync back)
            if (machineId) {
                const targetM = store.getMachines(true).find(m => m.id === machineId);
                const updates = {};
                if (machineCategory && targetM?.category !== machineCategory) updates.category = machineCategory;
                if (lineNo && targetM?.lineNo !== lineNo) updates.lineNo = lineNo;
                
                if (Object.keys(updates).length > 0) {
                    store.updateMachine(machineId, updates);
                }
            }

            // Auto-deduct stock
            replacedParts.forEach(p => {
                store.adjustStock(p.name, p.model, -p.count);
            });

            this.closeModal();
            this.renderCalendar();
            this.renderHistory();
            this.renderDashboard();
        } else if (type === 'edit-history') {
            const hId = document.getElementById('e-h-id').value;
            const machineId = document.getElementById('e-machine-id').value;
            const lineNo = document.getElementById('e-line-no').value;
            const date = document.getElementById('e-date').value;
            const symptomElement = document.getElementById('e-symptom') || document.getElementById('e-content');
            const symptom = symptomElement ? symptomElement.value : '';
            const notes = document.getElementById('e-notes').value;
            const cause = document.getElementById('e-cause').value;
            const errorNo = document.getElementById('e-error-no').value;
            const workTime = document.getElementById('e-work-time').value;
            const workerText = document.getElementById('e-workers').value;
            const isDokatei = document.getElementById('e-is-dokatei').checked;
            const isNonProductionStop = !isDokatei && !!document.getElementById('e-is-non-production-stop')?.checked;
            const machineCategory = this.getCategoryFromModalInput('e-');

            // Capture Parts (Defensive)
            const partRows = document.querySelectorAll('#s-parts-container .part-row');
            const replacedParts = [];
            partRows.forEach(row => {
                const nameInput = row.querySelector('.p-name');
                const modelInput = row.querySelector('.p-model');
                const countInput = row.querySelector('.p-count');
                const unitInput = row.querySelector('.p-unit');
                const priceInput = row.querySelector('.p-price');

                if (nameInput && nameInput.value) {
                    replacedParts.push({ 
                        name: MaintenanceStore.toFullWidth(nameInput.value),
                        model: MaintenanceStore.toHalfWidthLower(modelInput ? modelInput.value : ''),
                        count: parseFloat(countInput ? countInput.value : 0) || 0, 
                        unit: unitInput ? unitInput.value : '個',
                        price: parseFloat(priceInput ? priceInput.value : 0) || 0
                    });
                }
            });

            const workers = workerText ? workerText.split(',').map(s => s.trim()) : [];
            const category = document.getElementById('e-category').value;
            const index = store.activeData.history.findIndex(x => x.id === hId);
            if (index !== -1) {
                const oldRecord = store.activeData.history[index];
                
                // 1. Revert OLD stock
                if (oldRecord.replacedParts) {
                    oldRecord.replacedParts.forEach(p => {
                        store.adjustStock(p.name, p.model, p.count);
                    });
                }

                // 2. Apply NEW stock deduction
                replacedParts.forEach(p => {
                    store.adjustStock(p.name, p.model, -p.count);
                });

                store.activeData.history[index] = {
                    ...store.activeData.history[index],
                    machineId, date, notes, cause, errorContent: symptom, errorNo, workTime, workers, replacedParts, isDokatei, isNonProductionStop, category, machineCategory, lineNo,
                    isFirstTime: document.querySelector('input[name="e-occurrence"]:checked')?.value === 'first',
                    photos: this._tempPhotos
                };

                // Update Master Category (Sync back)
                if (machineId && machineCategory) {
                    const targetM = store.getMachines(true).find(m => m.id === machineId);
                    if (targetM && targetM.category !== machineCategory) {
                        store.updateMachine(machineId, { category: machineCategory });
                    }
                }
                store.save();
            }

            this.updateDataLists();
            this.closeModal();
            this.renderCalendar();
            this.renderHistory();
            this.renderDashboard();
            this._tempPhotos = [];
        } else if (type === 'guide') {
            const hId = document.getElementById('g-h-id').value;
            const text = document.getElementById('g-text').value;
            const author = document.getElementById('g-author').value;
            const tags = document.getElementById('g-tags').value.split(/[,，、\s]+/).map(t => t.trim()).filter(Boolean);

            const index = store.activeData.history.findIndex(x => x.id === hId);
            if (index !== -1) {
                store.activeData.history[index].guide = {
                    text,
                    author,
                    tags,
                    updatedAt: new Date().toLocaleString(),
                    photos: this._tempPhotos
                };
                store.save();
            }

            this.closeModal();
            this.renderHistory();
            this.renderGuides();
            this._tempPhotos = [];
        } else if (type === 'part-master') {
            const name = document.getElementById('pm-name').value;
            const model = document.getElementById('pm-model').value;
            const priceRaw = document.getElementById('pm-price-raw')?.value || '';
            const supplier = document.getElementById('pm-supplier').value;
            const shelf = document.getElementById('pm-shelf')?.value || '';
            const remarks = document.getElementById('pm-remarks').value;
            const photo = document.getElementById('pm-photo-base64').value; // New

            // Parse "price/weightKG" or plain number
            let computedPrice = 0;
            const slashIdx = priceRaw.indexOf('/');
            if (slashIdx !== -1) {
                const totalPrice = parseFloat(priceRaw.substring(0, slashIdx));
                const weightKg = parseFloat(priceRaw.substring(slashIdx + 1));
                if (!isNaN(totalPrice) && !isNaN(weightKg) && weightKg > 0) {
                    computedPrice = totalPrice / (weightKg * 1000); // price per gram
                }
            } else {
                computedPrice = parseFloat(priceRaw) || 0;
            }

            const stock = document.getElementById('pm-stock')?.value || 0;
            const minStock = document.getElementById('pm-min-stock')?.value || 0;
            const unit = document.getElementById('pm-unit')?.value || '個';

            store.updatePartMaster(name, model, {
                price: computedPrice,
                priceRaw: priceRaw,
                supplier,
                shelf,
                remarks,
                photo,
                stock: parseFloat(stock),
                minStock: parseFloat(minStock),
                unit
            });
            this.closeModal();
            this.renderAnalysis();
        } else if (type === 'substitute') {
            const oldName = document.getElementById('sub-old-name').value;
            const oldModel = document.getElementById('sub-old-model').value;
            const newName = document.getElementById('sub-new-name').value;
            const newModel = document.getElementById('sub-new-model').value;
            const newPrice = document.getElementById('sub-new-price').value;

            const existingMaster = store.getPartMaster(oldName, oldModel);
            const updates = {
                name: newName,
                model: newModel,
                price: newPrice ? parseFloat(newPrice) : (existingMaster?.price || 0),
                supplier: existingMaster?.supplier || '',
                remarks: existingMaster?.remarks || ''
            };

            store.updatePartMaster(oldName, oldModel, updates, true); // true = isSubstitute
            this.closeModal();
            this.renderAnalysis();
        }
        } catch (err) {
            console.error('Save error:', err);
            alert('保存中にエラーが発生しました: ' + err.message);
        }
    }

    updateDataLists() {
        const history = store.activeData.history || [];
        const machines = store.getMachines(true);
        const getUnique = (list) => [...new Set(list)].filter(Boolean).sort();

        // 1. Populate Datalists for Suggestions
        const allParts = history.flatMap(h => h.replacedParts || []);
        const partNames = getUnique(allParts.map(p => p.name));
        const partModels = getUnique(allParts.map(p => p.model));
        const workers = getUnique(history.flatMap(h => h.workers || []));
        const nodes = getUnique(history.map(h => h.notes));
        const causes = getUnique(history.map(h => h.cause));
        const mNames = getUnique(machines.map(m => m.name));
        const mModels = getUnique(machines.map(m => m.model));
        const mCategories = getUnique(store.activeData.machineCategories || []);

        const inject = (id, vals) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = vals.map(v => `<option value="${v}">`).join('');
        };
        inject('list-part-names', partNames);
        inject('list-part-models', partModels);
        inject('list-workers', workers);
        inject('list-contents', nodes);
        inject('list-causes', causes);
        inject('list-m-names', mNames);
        inject('list-m-models', mModels);
        inject('list-machine-categories', mCategories);

        // 2. Populate Machine Filter Dropdown in History View
        const machineFilter = document.getElementById('hist-filter-machine');
        if (machineFilter) {
            const currentVal = machineFilter.value;
            machineFilter.innerHTML = '<option value="">全機械</option>';
            machines.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = `${m.name} [${MaintenanceApp.toHalfWidthLower(m.model)}]`;
                machineFilter.appendChild(opt);
            });
            // 以前の選択がまだ存在すれば値を保持
            if (machines.some(m => m.id === currentVal)) {
                machineFilter.value = currentVal;
            }
        }

        // 3. Populate Line Filters in Ranking/Analysis View
        const lineSet = new Set();
        machines.forEach(m => { if (m.lineNo) lineSet.add(m.lineNo); });
        history.forEach(h => { if (h.lineNo) lineSet.add(h.lineNo); });
        const sortedLines = Array.from(lineSet).sort((a, b) => a - b);

        const populateLines = (id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const current = el.value;
            el.innerHTML = '<option value="all">全ライン</option>' + 
                sortedLines.map(l => `<option value="${l}">${this.getLineLabel(l)}</option>`).join('');
            el.value = current || 'all';
        };
        populateLines('ranking-filter-line');
        populateLines('analysis-filter-line');
    }


    renderAnalysis(searchQuery = '') {
        const container = document.getElementById('analysis-container');
        if (!container) return;

        const qInput = document.getElementById('global-search');
        const query = (searchQuery || (qInput ? qInput.value : '')).toLowerCase().trim();
        const normQuery = query ? MaintenanceStore.toHalfWidthLower(query) : null;

        const pFilter = document.getElementById('analysis-filter-period');
        const period = pFilter?.value || 'this_month';
        const lineFilter = document.getElementById('analysis-filter-line')?.value || 'all';
        this.updateViewSubtitle('view-analysis', period);

        let history = store.getHistory({});
        history = this.filterHistoryByPeriod(history, period);
        const machines = store.getMachines(true);

        // ラインフィルタの適用
        if (lineFilter !== 'all') {
            history = history.filter(h => {
                const m = machines.find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                return String(l) === String(lineFilter);
            });
        }


        if (this.analysisMode === 'machines') {
            // Apply Periodic/Sudden filter
            if (this.costFilter === 'periodic') {
                history = history.filter(h => !h.isSudden);
            } else if (this.costFilter === 'sudden') {
                history = history.filter(h => h.isSudden);
            }
            this.renderMachineCostAnalysis(history);
            return;
        }

        const partMap = new Map();

        // 0. Pre-populate from Master (so parts with no history still show up)
        const masters = store.activeData.partsMaster || [];
        masters.forEach(m => {
            const key = `${m.name}::${m.model}`;
            partMap.set(key, { name: m.name, model: m.model, unit: m.unit || '個', records: [] });
        });

        // 1. Group records by Part (Name + Model) from filtered history
        history.forEach(h => {
            if (!h.replacedParts) return;
            h.replacedParts.forEach(p => {
                const master = store.getPartMaster(p.name, p.model);
                const canonName = master ? master.name : MaintenanceStore.toFullWidth(p.name);
                const canonModel = master ? master.model : MaintenanceStore.toHalfWidthLower(p.model || '');
                const key = `${canonName}::${canonModel}`;
                
                if (!partMap.has(key)) {
                    partMap.set(key, { name: canonName, model: canonModel, unit: p.unit || '個', records: [] });
                }
                // Push record with specific price at that time (if exists) or fallback via master lookup
                partMap.get(key).records.push({ 
                    date: h.date, 
                    count: parseFloat(p.count) || 0, 
                    price: parseFloat(p.price) || 0 
                });
            });
        });

        const now = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        container.innerHTML = '';
        if (partMap.size === 0) {
            container.innerHTML = '<div style="padding:40px; color:var(--text-light)">部品交換の履歴がまだありません</div>';
            return;
        }

        Array.from(partMap.values())
            .filter(part => !store.isPartArchived(part.name, part.model))
            .sort((a, b) => b.records.length - a.records.length)
            .forEach(part => {
            let isMatch = false;
            if (normQuery) {
                const terms = normQuery.split(/[\s　]+/).filter(Boolean);
                const searchStr = MaintenanceStore.toHalfWidthLower((part.name || '') + ' ' + (part.model || ''));
                isMatch = terms.every(t => searchStr.includes(t));
            }

            const card = document.createElement('div');
            card.className = 'card' + (isMatch ? ' search-match' : '');
            
            const totalUsed = part.records.reduce((sum, r) => sum + r.count, 0);
            const firstDate = new Date(Math.min(...part.records.map(r => new Date(r.date))));
            const lastDate = new Date(Math.max(...part.records.map(r => new Date(r.date))));
            const daysDiff = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
            
            const latestRecord = history.flatMap(h => h.replacedParts || [])
                                      .filter(p => MaintenanceStore.toFullWidth(p.name) === part.name && MaintenanceStore.toHalfWidthLower(p.model) === part.model)
                                      .sort((a,b) => new Date(b.date) - new Date(a.date))[0];

            const master = store.getPartMaster(part.name, part.model);
            const price = master?.price || latestRecord?.price || 0;
            const supplier = master?.supplier || '-';
            const shelf = master?.shelf || '';

            let priceDisplay = '価格未設定';
            if (master?.priceRaw && master.priceRaw.includes('/')) {
                const [pVal, wVal] = master.priceRaw.split('/');
                priceDisplay = `¥${Math.round(parseFloat(pVal)).toLocaleString()} / ${wVal}kg分`;
            } else if (price > 0) {
                const unitLabel = (part.unit === 'pcs' || part.unit === '個' || !part.unit) ? '個' : part.unit;
                if (unitLabel === '個') {
                    priceDisplay = `¥${Math.round(price).toLocaleString()}`;
                } else {
                    priceDisplay = `¥${Math.round(price).toLocaleString()} <span style="font-size:0.7rem; font-weight:400; color:var(--text-light);">(1${unitLabel}の値段)</span>`;
                }
            }

            const displayUnit = master?.unit || ((part.unit === 'pcs' || part.unit === '個' || !part.unit) ? '個' : part.unit);
            let yearlyEst = '計測中...';
            let yearlyCost = 0;
            if (part.records.length >= 2) {
                const dailyPace = totalUsed / daysDiff;
                const qty = dailyPace * 365;
                yearlyEst = `${Math.round(qty)} ${displayUnit}`;
                yearlyCost = Math.round(qty * price);
            }

            let paceDisplay = "-";
            if (part.records.length >= 2 && totalUsed > 0) {
                const daysPerUnit = daysDiff / totalUsed;
                if (displayUnit === 'g' || displayUnit === 'グラム') {
                    const daysPerKg = daysPerUnit * 1000;
                    paceDisplay = `約 ${daysPerKg.toFixed(1)} 日 / 1000g`;
                } else {
                    paceDisplay = `約 ${daysPerUnit.toFixed(1)} 日 / 1${displayUnit}`;
                }
            }

            const stock = master?.stock || 0;
            const minStock = master?.minStock || 0;
            const isLowStock = minStock > 0 && stock <= minStock;

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; gap:12px;">
                    <div class="img-box" style="width:50px; height:50px; border-radius:10px; position:relative;">
                        ${master?.photo ? `<img src="${master.photo}">` : '<i class="fa-solid fa-gear" style="font-size:1.2rem; color:#cbd5e1;"></i>'}
                        ${isLowStock ? '<div style="position:absolute; top:-8px; right:-12px; background:var(--danger); color:white; font-size:0.6rem; padding:2px 6px; border-radius:12px; font-weight:900; box-shadow:0 2px 4px rgba(0,0,0,0.2); animation:pulse 2s infinite;">在庫少</div>' : ''}
                    </div>
                    <div style="flex:1; overflow:hidden;">
                        <h4 style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:4px;" title="${part.name}">${this.highlightText(part.name, query)}</h4>
                        <div style="font-size:0.9rem; font-weight:900; color:var(--primary);">${priceDisplay}</div>
                    </div>
                    <button class="icon-btn" onclick="app.openPartMasterModal('${part.name.replace(/'/g, "\\'")}', '${part.model.replace(/'/g, "\\'")}')" title="マスター情報を編集" style="flex-shrink:0;">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="icon-btn" onclick="app.archivePart('${part.name.replace(/'/g, "\\'")}', '${part.model.replace(/'/g, "\\'")}')" title="アーカイブへ送る" style="flex-shrink:0; color:var(--text-light);">
                        <i class="fa-solid fa-box-archive"></i>
                    </button>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <p style="font-size:0.75rem; color:var(--text-light); font-weight:700; margin:0;">${this.highlightText(part.model, query)}</p>
                    ${shelf ? `<div style="font-size:0.65rem; background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:4px; font-weight:900; border:1px solid #e2e8f0;"><i class="fa-solid fa-location-dot" style="margin-right:4px;"></i>${shelf}</div>` : ''}
                </div>
                
                <div style="margin-bottom:12px; padding:10px; background:${isLowStock ? '#fee2e2' : '#f0fdf4'}; border-radius:8px; border:1px solid ${isLowStock ? '#fecaca' : '#dcfce7'};">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <div style="font-size:0.65rem; color:${isLowStock ? 'var(--danger)' : '#166534'}; font-weight:800;">現在庫状況</div>
                        <div style="font-size:1.3rem; font-weight:950; color:${isLowStock ? 'var(--danger)' : '#166534'}; line-height:1;">
                            ${Math.round(stock)} <span style="font-size:0.7rem; font-weight:700;">${displayUnit}</span>
                        </div>
                    </div>
                    ${minStock > 0 ? `
                        <div style="font-size:0.65rem; color:var(--text-light); margin-top:4px; display:flex; justify-content:space-between;">
                            <span>アラート閾値: ${minStock}</span>
                            <span>${isLowStock ? '<b>⚠️ 要発注</b>' : '適正'}</span>
                        </div>
                    ` : ''}
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div>
                        <div style="font-size:0.65rem; color:var(--text-light)">合計使用数 / 消費ペース</div>
                        <div style="font-weight:900; font-size:1.1rem">${Math.round(totalUsed)} <span style="font-size:0.7rem">${displayUnit}</span></div>
                        <div style="font-size:0.7rem; color:var(--primary); font-weight:800; margin-top:2px;">( ${paceDisplay} )</div>
                    </div>
                    <div>
                        <div style="font-size:0.65rem; color:var(--text-light)">仕入先</div>
                        <div style="font-weight:700; font-size:0.85rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${supplier}</div>
                    </div>
                    <div style="grid-column: span 1; border-top:1px solid var(--border); padding-top:12px;">
                        <div style="font-size:0.65rem; color:var(--text-light)">年間推定消費量</div>
                        <div style="font-weight:900; font-size:1.1rem; color:var(--primary)">${yearlyEst}</div>
                    </div>
                    <div style="grid-column: span 1; border-top:1px solid var(--border); padding-top:12px;">
                        <div style="font-size:0.65rem; color:var(--text-light)">年間推定コスト</div>
                        <div style="font-weight:900; font-size:1.1rem; color:var(--danger)">${yearlyCost > 0 ? `¥${yearlyCost.toLocaleString()}` : '-'}</div>
                    </div>
                </div>
                ${master?.remarks ? `<div style="margin-top:12px; font-size:0.7rem; color:var(--text-light); background:var(--background); padding:6px; border-radius:4px;">${master.remarks}</div>` : ''}
            `;
            container.appendChild(card);
        });
    }

    getTodayActionSummary() {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const todos = store.activeData.localTodos || [];
        const pendingRequests = todos.filter(todo => todo.isRequest && !todo.archived && (todo.status || 'todo') !== 'done');
        const overdueTodos = pendingRequests.filter(todo => todo.deadlineDate && todo.deadlineDate < todayStr);
        const todayTodos = pendingRequests.filter(todo => !todo.deadlineDate || todo.deadlineDate <= todayStr);
        const tasks = (store.activeData.tasks || []).filter(task => !task.deleted && !store.isMaintenanceTaskArchived(task.id));
        const todayTasks = tasks.filter(task => !task.startDate || task.startDate <= todayStr).slice(0, 20);
        const importantRows = [];
        Object.entries(store.activeData.shiftNotebooks?.[todayStr] || {}).forEach(([shift, shiftData]) => {
            const label = this.getShiftNotebookLabel(shift);
            const rows = Array.isArray(shiftData) ? shiftData : (shiftData?.rows || []);
            rows.forEach((row, index) => {
                if (row.important) importantRows.push({ shift, label, row, index });
            });
        });
        return { todayStr, pendingRequests, overdueTodos, todayTodos, todayTasks, importantRows };
    }

    getTodayActionPanelHtml() {
        const summary = this.getTodayActionSummary();
        const itemHtml = [
            ...summary.overdueTodos.slice(0, 4).map(todo => `
                <button type="button" class="today-action-item danger" onclick="app.openPendingTodoRequest('${this.escapeJs(todo.id)}')">
                    <b>期限切れ</b><span>${this.escapeHtml(todo.title || '無題')}</span>
                </button>
            `),
            ...summary.todayTodos.filter(todo => !summary.overdueTodos.includes(todo)).slice(0, 4).map(todo => `
                <button type="button" class="today-action-item" onclick="app.openPendingTodoRequest('${this.escapeJs(todo.id)}')">
                    <b>依頼</b><span>${this.escapeHtml(todo.title || '無題')}</span>
                </button>
            `),
            ...summary.importantRows.slice(0, 4).map(item => `
                <button type="button" class="today-action-item important" onclick="app.openShiftNotebookModal('${summary.todayStr}', '${this.escapeJs(item.shift)}', ${item.index})">
                    <b>重要連絡</b><span>${this.escapeHtml(item.label?.name || '')} / ${this.escapeHtml(item.row.text || '本文なし')}</span>
                </button>
            `)
        ].slice(0, 10).join('');
        return `
            <div class="today-action-panel">
                <div class="today-action-head">
                    <div>
                        <h3><i class="fa-solid fa-sun"></i> 今日やること</h3>
                        <p>${summary.todayStr} の未処理依頼・期限切れ・重要連絡</p>
                    </div>
                    <button type="button" onclick="app.openKanbanRequestDashboard()">依頼一覧</button>
                </div>
                <div class="today-action-stats">
                    <button type="button" onclick="app.switchView('todos'); app.changeKanbanTodoWorker('__all__')"><span>未完了依頼</span><b>${summary.pendingRequests.length}</b></button>
                    <button type="button" onclick="app.switchView('todos'); app.toggleKanbanOverdueOnly(true)"><span>期限切れ</span><b>${summary.overdueTodos.length}</b></button>
                    <button type="button" onclick="app.switchView('calendar')"><span>定期メンテ候補</span><b>${summary.todayTasks.length}</b></button>
                    <button type="button" onclick="app.switchView('calendar')"><span>重要連絡</span><b>${summary.importantRows.length}</b></button>
                </div>
                <div class="today-action-list">
                    ${itemHtml || '<div class="today-action-empty">今日の優先確認項目はありません</div>'}
                </div>
            </div>
        `;
    }

    renderDashboard() {
        const container = document.getElementById('dashboard-widgets');
        if (!container) return;

        const period = this.dashboardPeriod || 'this_month';
        if (!this.dashboardPeriod) this.dashboardPeriod = period;
        this.updateViewSubtitle('view-dashboard', period);

        let history = store.activeData.history || [];
        history = this.filterHistoryByPeriod(history, period);

        const periodicTime = history.filter(h => !!h.taskId).reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const dokateiTime = history.filter(h => h.isDokatei).reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const suddenTime = history.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop).reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const nonProductionStopTime = history.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop).reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        
        const totalTime = periodicTime + suddenTime + nonProductionStopTime + dokateiTime;
        const suddenCount = history.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop).length;
        const nonProductionStopCount = history.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop).length;
        const dokateiCount = history.filter(h => h.isDokatei).length;
        const suddens = history.filter(h => !h.taskId && !h.isNonProductionStop && h.date);
        const dokateis = history.filter(h => h.isDokatei).sort((a, b) => (parseInt(b.workTime) || 0) - (parseInt(a.workTime) || 0));
        
        // Past 3 months fixed filter for Worst History
        const date3M = new Date(); date3M.setMonth(date3M.getMonth() - 3);
        const date3MStr = date3M.toISOString().split('T')[0];
        const dokateis3M = (store.activeData.history || []).filter(h => h.isDokatei && h.date >= date3MStr).sort((a, b) => (parseInt(b.workTime) || 0) - (parseInt(a.workTime) || 0));

        const totalTroubleTime = suddenTime + nonProductionStopTime + dokateiTime;
        const totalTroubleCount = suddenCount + nonProductionStopCount + dokateiCount;
        const avgMttr = totalTroubleCount > 0 ? (totalTroubleTime / totalTroubleCount).toFixed(1) : 0;

        let mtbf = '-';
        if (suddens.length >= 2) {
            const dates = suddens.map(h => new Date(h.date).getTime()).sort((a,b) => a - b);
            const totalRangeDays = (dates[dates.length-1] - dates[0]) / (24 * 60 * 60 * 1000);
            mtbf = (totalRangeDays / (suddens.length - 1)).toFixed(1);
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        const yestStr = yest.toISOString().split('T')[0];
        const recentHistory = store.activeData.history.filter(h => h.date === todayStr || h.date === yestStr);
        recentHistory.sort((a,b) => new Date(b.date) - new Date(a.date));

        container.style.display = 'grid';
        container.style.gridTemplateColumns = 'repeat(3, 1fr)';
        container.style.gap = '20px';

        container.innerHTML = `
            ${this.getTodayActionPanelHtml()}
            <div class="card" style="grid-column: 1 / -1; margin-bottom: 5px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">
                    <h4 style="margin:0; color:var(--text-main);"><i class="fa-solid fa-clock-rotate-left" style="color:var(--primary); margin-right:8px;"></i>直近の活動（今日・昨日）</h4>
                    <span class="badge" style="background:var(--primary-light); color:var(--primary);">${recentHistory.length}件</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:10px; max-height:300px; overflow-y:auto; padding-right:5px;">
                    ${recentHistory.length > 0 ? recentHistory.map(h => {
                        const m = store.getMachines(true).find(machine => machine.id === h.machineId);
                        const isToday = h.date === todayStr;
                        const dateBadge = isToday 
                            ? '<span style="background:var(--danger); color:white; padding:2px 6px; border-radius:4px; font-size:0.65rem; font-weight:900; margin-right:8px;">今日</span>'
                            : '<span style="background:var(--secondary); color:white; padding:2px 6px; border-radius:4px; font-size:0.65rem; font-weight:900; margin-right:8px;">昨日</span>';
                        
                        let photoHtml = '<i class="fa-solid fa-gear" style="font-size:1rem; color:#cbd5e1;"></i>';
                        if (m && m.photo) {
                            photoHtml = '<img src="' + m.photo + '">';
                        }
                        
                        const mName = m ? m.name : '不明';
                        const mModel = MaintenanceApp.toHalfWidthLower(m && m.model ? m.model : '');
                        const taskText = this.getHistoryDisplayText(h);
                        const wTime = h.workTime || 0;
                        const workers = (h.workers || []).join(', ') || '未設定';
                        
                        let rPhotosHtml = '';
                        if (h.photos && h.photos.length > 0) {
                            rPhotosHtml = h.photos.map(p => '<div class="img-box" style="width:60px; height:60px; border-radius:6px; border:1px solid var(--border); box-shadow:0 1px 3px rgba(0,0,0,0.1); flex-shrink:0;"><img src="' + p + '" alt="添付画像" style="object-fit:cover; width:100%; height:100%;"></div>').join('');
                        }
                        
                        const lineInfo = h.lineNo || m?.lineNo;
                        const lineBadge = this.getLineBadge(lineInfo);
                        
                        const catBadge = (h.machineCategory || m?.category) ? '<span style="font-size:0.65rem; color:var(--text-light); font-weight:800; margin-left:6px;"><i class="fa-solid fa-tag"></i> ' + (h.machineCategory || m.category) + '</span>' : '';
                        
                        return '<div class="hover-shadow" style="padding:12px; background:var(--background); border-radius:10px; border:1px solid var(--border); display:flex; gap:15px; align-items:center; cursor:pointer;" onclick="app.switchView(\'history\'); document.getElementById(\'global-search\').value=\'' + h.date + '\'; app.renderHistory();">' +
                                '<div class="img-box" style="width:40px; height:40px; border-radius:8px; flex-shrink:0;">' +
                                    photoHtml +
                                '</div>' +
                                '<div style="min-width:0; margin-right:15px;">' +
                                    '<div style="font-size:0.85rem; font-weight:800; color:var(--text-main); margin-bottom:2px;">' + dateBadge + ' ' + lineBadge + catBadge + ' ' + mName + ' [' + mModel + ']</div>' +
                                    '<div style="font-size:0.75rem; font-weight:700; color:var(--primary); margin-bottom:4px;">' + taskText + '</div>' +
                                    ((h.cause || h.notes) ? '<div style="font-size:0.75rem; color:var(--text-light); line-height:1.4; margin-bottom:4px;">' +
                                        (h.cause ? '原因: ' + h.cause + '<br>' : '') +
                                        (h.notes ? '処置: ' + h.notes : '') +
                                    '</div>' : '') +
                                    '<div style="font-size:0.7rem; color:var(--text-light);">' +
                                        '<i class="fa-regular fa-clock"></i> 作業時間: ' + wTime + '分 | 作業者: ' + workers +
                                    '</div>' +
                                '</div>' +
                            
                            '<div style="display:flex; gap:6px; overflow-x:auto; max-width:250px; flex-shrink:0;">' +
                                (rPhotosHtml || '<span style="color:var(--text-light); font-size:0.7rem; opacity:0.6;">(写真なし)</span>') +
                            '</div>' +

                            '<div style="flex:1"></div>' +

                            '<div style="display:flex; gap:8px; align-items:center; flex-shrink:0; margin-left:15px;">' +
                                '<button type="button" class="icon-btn" style="color:var(--primary); background:var(--primary-light); padding:6px; border-radius:6px; border:1px solid var(--primary-light);" onclick="event.stopPropagation(); app.openHistoryEditForm(\'' + h.id + '\');" title="この記録を編集">' +
                                    '<i class="fa-solid fa-pen-to-square"></i>' +
                                '</button>' +
                                '<div style="font-size:1rem; color:var(--border);"><i class="fa-solid fa-chevron-right"></i></div>' +
                            '</div>' +
                        '</div>';
                    }).join('') : '<div style="color:var(--text-light); text-align:center; padding:30px; font-size:0.85rem;">昨日から今日にかけてのメンテナンス記録はありません。</div>'}
                </div>
            </div>

            <div style="grid-column: 1 / 2; grid-row: 2 / 3;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:0 4px;">
                    <h4 style="margin:0; font-size:0.85rem; font-weight:900; color:var(--text-light);"><i class="fa-solid fa-calculator"></i> メンテ時間 集計</h4>
                    <select id="dashboard-filter-period" onchange="app.dashboardPeriod=this.value; app.onPeriodChange(this, () => app.renderDashboard())" 
                            style="font-size:0.75rem; padding:4px 10px; border-radius:99px; border:1px solid var(--border); background:white; font-weight:800; cursor:pointer;">
                        ${this.generatePeriodOptionsHTML(period)}
                    </select>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                    <div class="card" style="padding:15px; border-top:4px solid var(--primary); cursor:pointer;" onclick="app.switchView('history'); document.getElementById('hist-filter-period').value='${period}'; document.getElementById('hist-filter-type').value='periodic'; app.renderHistory();">
                        <div style="font-size:0.65rem; font-weight:800; color:var(--text-light); margin-bottom:4px;">定期保全 合計</div>
                        <div style="font-size:1.6rem; font-weight:900; color:var(--primary); line-height:1.2;">${periodicTime}<span style="font-size:0.8rem">分</span></div>
                        <div style="font-size:0.65rem; margin-top:4px; opacity:0.8;">${history.filter(h=>!!h.taskId).length}件の実施履歴</div>
                    </div>
                    <div class="card" style="padding:15px; border-top:4px solid var(--success); cursor:pointer;" onclick="app.switchView('history'); document.getElementById('hist-filter-period').value='${period}'; document.getElementById('hist-filter-type').value='sudden'; app.renderHistory();">
                        <div style="font-size:0.65rem; font-weight:800; color:var(--text-light); margin-bottom:4px;">突発故障（生産停止）</div>
                        <div style="font-size:1.6rem; font-weight:900; color:var(--success); line-height:1.2;">${suddenTime}<span style="font-size:0.8rem">分</span></div>
                        <div style="font-size:0.65rem; margin-top:4px; opacity:0.8;">${suddenCount}件の停止トラブル</div>
                    </div>
                    <div class="card" style="padding:15px; border-top:4px solid #f59e0b; cursor:pointer;" onclick="app.switchView('history'); document.getElementById('hist-filter-period').value='${period}'; document.getElementById('hist-filter-type').value='nonProductionStop'; app.renderHistory();">
                        <div style="font-size:0.65rem; font-weight:800; color:var(--text-light); margin-bottom:4px;">非生産停止トラブル</div>
                        <div style="font-size:1.6rem; font-weight:900; color:#d97706; line-height:1.2;">${nonProductionStopTime}<span style="font-size:0.8rem">分</span></div>
                        <div style="font-size:0.65rem; margin-top:4px; opacity:0.8;">${nonProductionStopCount}件の非停止メンテ</div>
                    </div>
                    <div class="card" style="padding:15px; border-top:4px solid var(--danger); cursor:pointer;" onclick="app.switchView('history'); document.getElementById('hist-filter-period').value='${period}'; document.getElementById('hist-filter-type').value='dokatei'; app.renderHistory();">
                        <div style="font-size:0.65rem; font-weight:800; color:var(--text-light); margin-bottom:4px;">ドカ停（重大）</div>
                        <div style="font-size:1.6rem; font-weight:900; color:var(--danger); line-height:1.2;">${dokateiTime}<span style="font-size:0.8rem">分</span></div>
                        <div style="font-size:0.65rem; margin-top:4px; opacity:0.8;">${dokateiCount}件の生産停止</div>
                    </div>
                    <div class="card" style="padding:15px; border-top:4px solid var(--secondary); background:var(--secondary-light);">
                        <div style="font-size:0.65rem; font-weight:800; color:var(--text-light); margin-bottom:4px;">MTBF / MTTR</div>
                        <div style="font-size:1.1rem; font-weight:900; color:var(--secondary); margin-bottom:2px;">間隔: ${mtbf}日</div>
                        <div style="font-size:1.1rem; font-weight:900; color:var(--danger);">修理: ${avgMttr}分</div>
                    </div>
                </div>
            </div>

            <div class="card" style="display:flex; flex-direction:column; align-items:center; justify-content:center; grid-column: 2 / 3; grid-row: 2 / 3; min-height: 280px; padding-top: 25px;">
                <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h4 style="margin:0;">時間・内容内訳 (%)</h4>
                    <div style="font-size:0.75rem; font-weight:800; color:var(--text-light)">合計: ${totalTime}分</div>
                </div>
                <div style="width:180px; height:180px; position:relative;">
                    <canvas id="dashboard-pie-chart"></canvas>
                </div>
                <div style="display:flex; gap:12px; margin-top:15px; font-size:0.65rem; font-weight:800;">
                    <span><i class="fa-solid fa-circle" style="color:#2563eb"></i> 定期</span>
                    <span><i class="fa-solid fa-circle" style="color:#10b981"></i> 突発(停止)</span>
                    <span><i class="fa-solid fa-circle" style="color:#f59e0b"></i> 非停止</span>
                    <span><i class="fa-solid fa-circle" style="color:#ef4444"></i> ドカ停</span>
                </div>
            </div>

            <div class="card" style="grid-column: 3 / 4; grid-row: 2 / 3; display:flex; flex-direction:column; border-top: 4px solid var(--primary); padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h4 style="margin:0; border:none; padding-left:0; font-weight:900;"><i class="fa-solid fa-box-open" style="color:var(--primary); margin-right:8px;"></i>部品在庫アラート</h4>
                    <span class="badge" style="background:var(--danger-light); color:var(--danger);">${store.getLowStockParts().length}件</span>
                </div>
                <div style="flex:1; display:flex; flex-direction:column; gap:8px; overflow-y:auto; max-height:220px; padding-right:5px;">
                    ${(() => {
                        const lowStockParts = store.getLowStockParts();
                        if (lowStockParts.length === 0) return '<div style="color:var(--text-light); text-align:center; padding:20px; font-size:0.8rem;">現在、在庫不足はありません</div>';
                        return lowStockParts.map(p => {
                            const stats = this.getPartUsageStats(p.name, p.model);
                            const unit = p.unit || '個';
                            return `
                            <div class="hover-shadow" style="padding:12px; background:white; border-radius:12px; border:1px solid #fecaca; display:flex; gap:12px; align-items:start; cursor:pointer;" onclick="app.openPartMasterModal('${p.name.replace(/'/g, "\\'")}', '${p.model.replace(/'/g, "\\'")}')">
                                <div class="img-box" style="width:44px; height:44px; border-radius:8px; flex-shrink:0; background:#f8fafc;">
                                    ${p.photo ? `<img src="${p.photo}">` : '<i class="fa-solid fa-box" style="color:#cbd5e1; font-size:1.1rem;"></i>'}
                                </div>
                                <div style="min-width:0; flex:1;">
                                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
                                        <div style="font-size:0.8rem; font-weight:900; line-height:1.2; flex:1; min-width:0;">
                                            <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                                            <div style="font-size:0.65rem; color:var(--secondary); font-weight:700;">[${p.model || '-'}]</div>
                                        </div>
                                        ${p.shelf ? `<span style="font-size:0.6rem; color:#475569; background:#f1f5f9; padding:2px 6px; border-radius:4px; margin-left:6px; font-weight:800; white-space:nowrap; border:1px solid #e2e8f0;">棚:${p.shelf}</span>` : ''}
                                    </div>
                                    
                                    <div style="display:flex; justify-content:space-between; align-items:end; margin-bottom:6px; border-bottom:1px dashed #fee2e2; padding-bottom:6px;">
                                        <div style="line-height:1;">
                                            <div style="font-size:0.6rem; color:var(--text-light); margin-bottom:2px;">在庫 / 閾値</div>
                                            <b style="color:var(--danger); font-size:1.1rem;">${p.stock}<small style="font-size:0.65rem; font-weight:800;">${unit}</small></b>
                                            <span style="font-size:0.65rem; color:var(--text-light); font-weight:700;"> / ${p.minStock}</span>
                                        </div>
                                        <div style="text-align:right;">
                                            <div style="font-size:0.6rem; color:var(--text-light); margin-bottom:2px;">消費サイクル</div>
                                            <div style="font-size:0.75rem; font-weight:900; color:var(--text-main);">${stats.cycle} <small style="font-size:0.6rem; color:var(--text-light); font-weight:700;">/ ${unit}</small></div>
                                        </div>
                                    </div>

                                    <div style="display:flex; gap:10px; font-size:0.65rem; color:var(--text-light); font-weight:700;">
                                        <span style="display:flex; align-items:center; gap:3px;"><i class="fa-solid fa-tag"></i> ¥${(p.price || 0).toLocaleString()}</span>
                                        <span style="display:flex; align-items:center; gap:3px; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><i class="fa-solid fa-truck-fast"></i> ${p.supplier || '未指定'}</span>
                                    </div>
                                </div>
                            </div>
                        `;}).join('');
                    })()}
                </div>
            </div>

            <div class="card" style="grid-column: 1 / 2; grid-row: 3 / 4; padding: 20px; background: white; border-top: 4px solid var(--danger); display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h4 style="margin:0; font-weight:900; color:var(--text-main);">
                        <i class="fa-solid fa-stopwatch" style="color:var(--danger); margin-right:8px;"></i>
                        ドカ停ゼロ 継続日数
                    </h4>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:0.7rem; color:var(--text-light); font-weight:700;">日数カウント</span>
                        <button class="icon-btn" onclick="app.addDokateiCounter()" title="カウンターを追加" style="color:var(--primary); font-size:1.1rem; border:none; background:none; cursor:pointer;"><i class="fa-solid fa-circle-plus"></i></button>
                    </div>
                </div>
                <div style="flex:1; display:flex; flex-direction:column; gap:12px; overflow-y:auto; max-height:420px; padding-right:5px;">
                    ${(store.activeData.dokateiCounters || []).map((c, i) => {
                        const days = c.lastDate ? Math.floor((new Date() - new Date(c.lastDate)) / (86400000)) : '-';
                        const dayColor = days === '-' ? 'var(--text-light)' : (days > 180 ? 'var(--success)' : (days > 30 ? 'var(--primary)' : 'var(--danger)'));
                        return `
                        <div style="position:relative; display:flex; gap:10px; padding:12px 10px 10px 10px; background:var(--background); border-radius:12px; border:1px solid var(--border); align-items:stretch; transition:var(--transition);">
                                <button class="icon-btn" onclick="app.removeDokateiCounter(${i})" title="削除" style="position:absolute; top:4px; left:4px; border:none; background:none; font-size:0.8rem; color:var(--text-light); opacity:0.5; cursor:pointer; z-index:10;"><i class="fa-solid fa-xmark"></i></button>
                                <div style="flex:1; display:flex; flex-direction:column; gap:4px; min-width:0; justify-content:center; padding-left:12px;">
                                    <input type="text" placeholder="場所・ライン名" value="${c.location}" 
                                           onchange="app.updateDokateiCounter(${i}, 'location', this.value)"
                                           style="width:100%; padding:4px 10px; border-radius:6px; border:1px solid var(--border); font-size:0.8rem; font-weight:800; background:white; min-width:0;">
                                    <input type="date" value="${c.lastDate}" 
                                           onchange="app.updateDokateiCounter(${i}, 'lastDate', this.value)"
                                           style="width:100%; padding:4px 8px; border-radius:6px; border:1px solid var(--border); font-size:0.8rem; font-weight:800; background:white;">
                                </div>
                                <div style="min-width:85px; text-align:center; padding:8px 4px; background:white; border-radius:12px; border:3px solid ${dayColor}; display:flex; flex-direction:column; justify-content:center; align-items:center; box-shadow:0 3px 5px rgba(0,0,0,0.06);">
                                    <div style="font-size:2.2rem; font-weight:950; color:${dayColor}; line-height:1;">${days}</div>
                                    <div style="font-size:0.7rem; font-weight:900; color:${dayColor}; line-height:1; margin-top:4px; opacity:0.8;">DAYS</div>
                                </div>
                        </div>
                        `;
                    }).join('')}
                    ${(store.activeData.dokateiCounters || []).length === 0 ? '<div style="color:var(--text-light); text-align:center; padding:20px; font-size:0.75rem; border:1px dashed var(--border); border-radius:8px;">カウンターがありません。右上の＋ボタンで追加してください。</div>' : ''}
                </div>
            </div>

            <div class="card" style="grid-column: 2 / 4; grid-row: 3 / 4; display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h4 style="margin:0; border-left:4px solid var(--danger); padding-left:8px;">直近3ヶ月のドカ停ワースト履歴（修理時間順）</h4>
                    <span class="badge badge-dokatei" style="background:#fee2e2; color:#b91c1c;">${dokateis3M.length}件</span>
                </div>
                <div style="flex:1; display:flex; flex-direction:column; gap:10px; overflow-y:auto; max-height:400px; padding-right:5px;">
                    ${dokateis3M.slice(0, 10).map(h => {
                        const m = store.getMachines(true).find(machine => machine.id === h.machineId);
                        const lineInfo = h.lineNo || m?.lineNo;
                        const lineBadge = this.getLineBadge(lineInfo);
                        const catText = h.machineCategory || m?.category;
                        const categoryBadge = catText ? `<span style="background:var(--primary-light); color:var(--primary); padding:1px 6px; border-radius:3px; font-size:0.6rem; font-weight:900; margin-right:4px;">${catText}</span>` : '';
                        const photoIcon = (h.photos && h.photos.length > 0) ? '<i class="fa-solid fa-camera" style="color:var(--primary); margin-left:5px; font-size:0.7rem;"></i>' : '';
                        const workers = (h.workers || []).join(', ') || '未設定';

                        let recordPhotosHtml = '';
                        if (h.photos && h.photos.length > 0) {
                            recordPhotosHtml = h.photos.map(p => `<div class="img-box" style="width:60px; height:60px; border-radius:6px; border:1px solid var(--border); box-shadow:0 1px 3px rgba(0,0,0,0.1); flex-shrink:0;"><img src="${p}" alt="添付画像" style="object-fit:cover; width:100%; height:100%;"></div>`).join('');
                        }
                        
                        return `
                        <div class="hover-shadow" style="padding:12px; background:var(--background); border-radius:12px; border:1px solid var(--border); display:flex; gap:15px; align-items:center; cursor:pointer;" onclick="app.switchView('history'); document.getElementById('global-search').value='${h.date}'; app.renderHistory();">
                                <div class="img-box" style="width:45px; height:45px; border-radius:10px; flex-shrink:0;">
                                    ${m?.photo ? `<img src="${m.photo}">` : '<i class="fa-solid fa-industry" style="font-size:1rem; color:#cbd5e1;"></i>'}
                                </div>
                                <div style="min-width:0; margin-right:15px;">
                                    <div style="font-size:0.85rem; font-weight:800; color:var(--text-main); line-height:1.3; margin-bottom:2px;">
                                        ${lineBadge}${categoryBadge}${m?.name || '不明'} [${MaintenanceApp.toHalfWidthLower(m?.model || '')}]
                                    </div>
                                    <div style="font-size:0.75rem; font-weight:700; color:var(--primary); margin-bottom:4px;">${this.getHistoryDisplayText(h)}${photoIcon}</div>
                                    <div style="font-size:0.7rem; color:var(--text-light); line-height:1.4; margin-bottom:4px; max-width:400px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                        ${h.cause ? `原因: ${h.cause}` : ''} ${h.notes ? `| 処置: ${h.notes}` : ''}
                                    </div>
                                    <div style="font-size:0.65rem; color:var(--text-light); display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                        <span style="display:inline-block; background:var(--danger-light); color:var(--danger); padding:1px 6px; border-radius:4px; font-weight:900;">${h.workTime}分</span>
                                        <span><i class="fa-solid fa-calendar-day"></i> ${h.date}</span>
                                        <span style="color:var(--primary); font-weight:700;"><i class="fa-solid fa-user-gear"></i> ${workers}</span>
                                    </div>
                                </div>
                                
                                <div style="display:flex; gap:6px; overflow-x:auto; max-width:180px; flex-shrink:0;">
                                    ${recordPhotosHtml || ''}
                                </div>

                                <div style="flex:1"></div>
                                
                                <div style="font-size:1rem; color:var(--border); flex-shrink:0; display:flex; align-items:center;"><i class="fa-solid fa-chevron-right"></i></div>
                        </div>
                        `;
                    }).join('') || '<div style="color:var(--text-light); text-align:center; padding:50px; border:1px dashed var(--border); border-radius:12px;">この期間の重大故障（ドカ停）記録はありません</div>'}
                </div>
            </div>
        `;

        if (totalTime > 0) {
            setTimeout(() => {
                const ctx = document.getElementById('dashboard-pie-chart');
                if (!ctx) return;
                Chart.register(ChartDataLabels);
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['定期', '突発(停止)', '非生産停止', 'ドカ停'],
                        datasets: [{
                            data: [periodicTime, suddenTime, nonProductionStopTime, dokateiTime],
                            backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#ef4444'],
                            borderWidth: 0,
                            hoverOffset: 12
                        }]
                    },
                    options: {
                        cutout: '70%',
                        plugins: {
                            legend: { display: false },
                            datalabels: {
                                color: '#fff',
                                font: { weight: '800', size: 10 },
                                formatter: (val) => {
                                    const pct = (val / totalTime * 100);
                                    return pct > 5 ? Math.round(pct) + '%' : '';
                                },
                                textStrokeColor: 'rgba(0,0,0,0.3)',
                                textStrokeWidth: 1,
                            },
                            tooltip: {
                                callbacks: {
                                    label: (item) => ` ${item.label}: ${item.raw}分 (${(item.raw/totalTime*100).toFixed(1)}%)`
                                }
                            }
                        }
                    }
                });
            }, 100);
        }
    }
    
    addDokateiCounter() {
        if (!store.activeData.dokateiCounters) store.activeData.dokateiCounters = [];
        store.activeData.dokateiCounters.push({ location: '', lastDate: '' });
        store.save();
        this.renderDashboard();
    }

    removeDokateiCounter(index) {
        if (!store.activeData.dokateiCounters) return;
        if (confirm('このカウンターを削除しますか？')) {
            store.activeData.dokateiCounters.splice(index, 1);
            store.save();
            this.renderDashboard();
        }
    }

    updateDokateiCounter(index, field, value) {
        if (!store.activeData.dokateiCounters) {
            store.activeData.dokateiCounters = [
                { location: '', lastDate: '' },
                { location: '', lastDate: '' }
            ];
        }
        if (store.activeData.dokateiCounters[index]) {
            store.activeData.dokateiCounters[index][field] = value;
            store.save();
            this.renderDashboard();
        }
    }



    getPartUsageStats(name, model) {
        const history = store.activeData.history || [];
        const normName = MaintenanceStore.toFullWidth(name);
        const normModel = MaintenanceStore.toHalfWidthLower(model);
        
        let totalCount = 0;
        let firstDate = null;
        
        history.forEach(h => {
            if (!h.date || !h.replacedParts || h.replacedParts.length === 0) return;
            h.replacedParts.forEach(p => {
                if (MaintenanceStore.toFullWidth(p.name) === normName && MaintenanceStore.toHalfWidthLower(p.model || '') === normModel) {
                    totalCount += (parseFloat(p.count) || 0);
                    const d = new Date(h.date);
                    if (!isNaN(d.getTime())) {
                        if (!firstDate || d < firstDate) firstDate = d;
                    }
                }
            });
        });
        
        if (totalCount === 0 || !firstDate) return { totalCount: 0, cycle: '記録なし' };
        
        const today = new Date();
        const durationDays = Math.ceil((today - firstDate) / (1000 * 60 * 60 * 24)) || 1;
        const cycle = (durationDays / totalCount).toFixed(1);
        
        return {
            totalCount,
            durationDays,
            cycle: `約 ${cycle}日`
        };
    }

    openGuideModal(hId) {
        const h = store.activeData.history.find(x => x.id === hId);
        const machine = store.getMachines(true).find(m => m.id === h.machineId);
        let guide = h.guide;
        let isRef = false;
        if (!guide) {
            const taskTitle = this.getHistoryDisplayText(h);
            const found = store.activeData.history.find(r => r.id !== h.id && r.machineId === h.machineId && this.getHistoryDisplayText(r) === taskTitle && r.guide);
            if (found) { guide = { ...found.guide }; isRef = true; }
        }
        if (!guide) guide = { text: '', author: '', photos: [] };
        this._tempPhotos = [...(guide.photos || [])];

        this.openModal('guide', '作業手順書（ナレッジベース）', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <input type="hidden" id="g-h-id" value="${hId}">
                ${isRef ? `
                <div style="background:var(--secondary-light); color:var(--secondary); padding:10px 16px; border-radius:8px; margin-bottom:12px; font-size:0.75rem; border:1px solid var(--secondary); font-weight:800;">
                    <i class="fa-solid fa-circle-info"></i> 過去の同一作業から手順書を自動参照しています。今回用に編集して保存できます。
                </div>` : ''}
                <div style="background:var(--primary-light); padding:12px; border-radius:8px; margin-bottom:16px;">
                    <div style="font-size:0.8rem; font-weight:800; color:var(--primary)">対象</div>
                    <div style="font-size:1.1rem; font-weight:900;">${machine?.name || '不明'} [${machine?.model || '-'}]</div>
                    <div style="font-weight:700;">${this.getHistoryDisplayText(h)}</div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                    <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                        <div style="font-size:0.7rem; font-weight:800; color:var(--text-light); margin-bottom:4px;"><i class="fa-solid fa-magnifying-glass"></i> 原因</div>
                        <div style="font-size:0.85rem; font-weight:700; white-space:pre-wrap;">${h.cause || '(未入力)'}</div>
                    </div>
                    <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                        <div style="font-size:0.7rem; font-weight:800; color:var(--text-light); margin-bottom:4px;"><i class="fa-solid fa-screwdriver-wrench"></i> 処置内容</div>
                        <div style="font-size:0.85rem; font-weight:700; white-space:pre-wrap;">${h.notes || '(未入力)'}</div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                    <div class="form-group">
                        <label>作成者</label>
                        <input type="text" id="g-author" placeholder="例: メンテナンス 田中" value="${guide.author || ''}" list="list-workers">
                    </div>
                    <div class="form-group">
                        <label>タグ (カンマ区切り)</label>
                        <input type="text" id="g-tags" placeholder="例: 油漏れ, センサー異常" value="${(guide.tags || []).join(', ')}">
                    </div>
                </div>

                <div class="form-group">
                    <label>手順書・技術メモ</label>
                    <textarea id="g-text" rows="8" placeholder="次回同じトラブルが起きた際の参考となる手順、重要なポイントなどを記入してください。">${guide.text}</textarea>
                </div>

                <div class="form-group">
                    <label>手順写真・参考画像</label>
                    <input type="file" id="g-photos" accept="image/*" multiple style="margin-bottom:8px;">
                    <div id="g-photo-previews" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
                </div>
            `;

            // Photo handler init
            const previewContainer = document.getElementById('g-photo-previews');
            this._tempPhotos.forEach(p => {
                const div = this.createPhotoPreviewElement(
                    p, 
                    (removedSrc) => { this._tempPhotos = this._tempPhotos.filter(img => img !== removedSrc); },
                    (oldSrc, newSrc) => { this._tempPhotos = this._tempPhotos.map(img => img === oldSrc ? newSrc : img); },
                    100
                );
                previewContainer.appendChild(div);
            });

            const photoIn = document.getElementById('g-photos');
            photoIn.onchange = async (e) => {
                const files = Array.from(e.target.files);
                for (const file of files) {
                    const base64 = await MaintenanceStore.resizeImage(file);
                    this._tempPhotos.push(base64);
                    const div = this.createPhotoPreviewElement(
                        base64,
                        (removedSrc) => { this._tempPhotos = this._tempPhotos.filter(p => p !== removedSrc); },
                        (oldSrc, newSrc) => { this._tempPhotos = this._tempPhotos.map(p => p === oldSrc ? newSrc : p); },
                        100
                    );
                    previewContainer.appendChild(div);
                }
            };

            // Add Print button to footer
            const footer = document.querySelector('.modal-footer');
            footer.insertAdjacentHTML('afterbegin', `
                <button class="secondary-btn" style="margin-right:auto" onclick="app.printGuide('${hId}')">
                    <i class="fa-solid fa-print"></i> 印刷する
                </button>
            `);
        });
    }

    printGuide(hId) {
        const h = store.activeData.history.find(x => x.id === hId);
        const machine = store.getMachines(true).find(m => m.id === h.machineId);
        const guide = h.guide;
        if (!guide) return alert('まず手順書を保存してください。');

        const printWindow = window.open('', '_blank');
        const photosHTML = guide.photos.map(p => `<img src="${p}" style="max-width:45%; margin:10px; border:1px solid #ccc;">`).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>作業手順書 - ${machine?.name}</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px; }
                        h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
                        .meta { margin-bottom: 30px; background: #eee; padding: 15px; border-radius: 8px; }
                        .content { white-space: pre-wrap; line-height: 1.6; font-size: 1.1rem; }
                        @media print { .no-print { display:none; } }
                    </style>
                </head>
                <body>
                    <div class="no-print" style="margin-bottom:20px;">
                        <button onclick="window.print()">印刷実行</button>
                    </div>
                    <h1>作業手順書: ${this.getHistoryDisplayText(h)}</h1>
                    <div class="meta">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                            <div><strong>機械:</strong> ${machine?.name} [${machine?.model}]</div>
                            <div><strong>作成者:</strong> ${guide.author || '不明'}</div>
                            <div><strong>記録日:</strong> ${h.date}</div>
                            <div><strong>手順書最終更新:</strong> ${guide.updatedAt || '-'}</div>
                            <div style="grid-column: span 2; border-top: 1px dashed #bbb; padding-top: 10px; margin-top: 5px;">
                                <strong>【原因】:</strong> ${h.cause || '(点検記録に未入力)'}
                            </div>
                            <div style="grid-column: span 2;">
                                <strong>【処置内容】:</strong> ${h.notes || '(点検記録に未入力)'}
                            </div>
                        </div>
                    </div>
                    <div class="content">${guide.text}</div>
                    <div style="margin-top:40px;">
                        ${photosHTML}
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
    }

    highlightText(text, query) {
        if (!query || !text) return text;
        const normQuery = MaintenanceStore.toHalfWidthLower(query);
        const terms = normQuery.split(/[\s　]+/).filter(Boolean);
        if (terms.length === 0) return text;
        
        const normText = MaintenanceStore.toHalfWidthLower(text);
        const ranges = [];
        
        terms.forEach(term => {
            let pos = normText.indexOf(term);
            while (pos !== -1) {
                ranges.push({ start: pos, end: pos + term.length });
                pos = normText.indexOf(term, pos + 1);
            }
        });

        if (ranges.length === 0) return text;

        // Merge overlapping ranges
        ranges.sort((a, b) => a.start - b.start);
        const merged = [];
        if (ranges.length > 0) {
            let cur = { ...ranges[0] };
            for (let i = 1; i < ranges.length; i++) {
                if (ranges[i].start < cur.end) {
                    cur.end = Math.max(cur.end, ranges[i].end);
                } else {
                    merged.push(cur);
                    cur = { ...ranges[i] };
                }
            }
            merged.push(cur);
        }

        // Apply highlights back to front
        let finalHtml = text;
        for (let i = merged.length - 1; i >= 0; i--) {
            const r = merged[i];
            const original = finalHtml.substring(r.start, r.end);
            finalHtml = finalHtml.substring(0, r.start) + `<span class="highlight">${original}</span>` + finalHtml.substring(r.end);
        }
        return finalHtml;
    }

    editMachine(id) {
        this.openMachineModal(id);
    }

    deleteMachine(id) {
        if (confirm('この機械を削除（アーカイブ）しますか？\n（復元は管理画面から可能です）')) {
            store.updateMachine(id, { deleted: true });
            this.renderMachines();
            this.renderCalendar();
        }
    }

    restoreMachine(id) {
        store.updateMachine(id, { deleted: false });
        this.renderWorkerMaintenanceModal(); // Refresh restoration UI
        this.renderMachines();
        this.renderCalendar();
    }

    // --- Phase 4: Ranking ---
    renderRanking() {
        const container = document.getElementById('ranking-container');
        if (!container) return;
        container.style.cssText = 'display:block; width:100%;';

        const period = document.getElementById('ranking-filter-period')?.value || 'this_month';
        const lineFilter = document.getElementById('ranking-filter-line')?.value || 'all';
        let history = store.getHistory({});
        history = this.filterHistoryByPeriod(history, period);
        const machines = store.getMachines(true);

        // ラインフィルタの適用
        if (lineFilter !== 'all') {
            history = history.filter(h => {
                const m = machines.find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                return String(l) === String(lineFilter);
            });
        }


        const machineMap = {};
        const catMap = {};
        const causeWords = {};

        history.forEach(h => {
            if (h.isManualGuide) return; // 統計からは除外
            const m = machines.find(x => x.id === h.machineId);
            if (!m) return;
            const key = m.id;
            if (!machineMap[key]) machineMap[key] = { id: m.id, name: m.name, model: m.model, lineNo: m.lineNo, count: 0, dokatei: 0, time: 0, cost: 0 };
            if (!h.taskId || h.isDokatei) {
                machineMap[key].count++;
                if (h.isDokatei) machineMap[key].dokatei++;
                machineMap[key].time += (parseInt(h.workTime) || 0);
            }
            const partCost = (h.replacedParts || []).reduce((sum, p) => sum + ((parseFloat(p.count)||0) * (parseFloat(p.price)||0)), 0);
            machineMap[key].cost += partCost;
            const cat = h.category || 'other';
            catMap[cat] = (catMap[cat] || 0) + 1;
            if (h.cause) {
                h.cause.split(/[\s、。・,]+/).filter(w => w.length >= 2).forEach(w => {
                    causeWords[w] = (causeWords[w] || 0) + 1;
                });
            }
        });

        const listByCount = Object.values(machineMap).filter(m => m.count > 0).sort((a,b) => b.count - a.count);
        const listByTime  = Object.values(machineMap).filter(m => m.time > 0).sort((a,b) => b.time - a.time);
        
        const catLabels = { machine: '機械修理', electric: '電気系', adjust: '調整', parts: '部品交換', clean: '清掃・給油', other: 'その他' };
        const catColors  = { machine: '#3b82f6', electric: '#f59e0b', adjust: '#10b981', parts: '#8b5cf6', clean: '#06b6d4', other: '#94a3b8' };
        const topCauses = Object.entries(causeWords).sort((a,b) => b[1]-a[1]).slice(0, 10);

        container.innerHTML = `
            <div style="margin-bottom:24px; display:flex; justify-content:space-between; align-items:center;">
                <div style="background:linear-gradient(135deg, var(--primary), var(--primary-dark)); color:#fff; padding:8px 20px; border-radius:30px; font-size:0.85rem; font-weight:800; box-shadow:0 4px 15px rgba(37,99,235,0.2);">
                    <i class="fa-solid fa-calendar-check" style="margin-right:8px;"></i>
                    集計期間: ${this.getPeriodLabel(period)} (${history.length}件の記録)
                </div>
                <button class="secondary-btn" style="padding:8px 16px; font-weight:800;" onclick="app.openTroubleComparisonModal()">
                    <i class="fa-solid fa-magnifying-glass-chart"></i> 前月との比較分析
                </button>
            </div>

            <div class="ranking-visual-grid">
                <!-- Visual Bar Chart -->
                <div class="ranking-chart-card">
                    <div style="font-size:1rem; font-weight:900; margin-bottom:20px; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-chart-bar" style="color:var(--primary);"></i> 故障頻度グラフ (Worst 10)
                    </div>
                    <div class="ranking-chart-container">
                        <canvas id="ranking-freq-chart"></canvas>
                    </div>
                </div>

                <!-- Cause Keywords -->
                <div class="card" style="padding:24px;">
                    <div style="font-size:1rem; font-weight:900; margin-bottom:16px; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-key" style="color:var(--secondary);"></i> 頻出原因キーワード
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:10px;">
                        ${topCauses.map(([w, cnt], i) => `
                            <div style="padding:8px 16px; background:${i<3?'var(--secondary-light)':'var(--background)'}; border-radius:12px; border:1.5px solid ${i<3?'var(--secondary)':'var(--border)'}; font-size:${i<3?'1rem':'0.8rem'}; font-weight:800; color:${i<3?'var(--secondary)':'var(--text-main)'};">
                                ${w} <span style="font-size:0.7em; opacity:0.7;">${cnt}</span>
                            </div>
                        `).join('') || '<div style="color:var(--text-light); padding:20px;">なし</div>'}
                    </div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:24px;">
                <!-- Frequency List -->
                <div class="card" style="padding:24px;">
                    <div style="font-size:1rem; font-weight:900; margin-bottom:16px; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-fire-flame-curved" style="color:var(--danger);"></i> 故障回数ワースト
                    </div>
                    ${listByCount.length === 0 ? '<div style="color:var(--text-light); text-align:center; padding:40px;">データなし</div>' : listByCount.slice(0, 5).map((m, i) => `
                        <div class="hover-shadow" style="display:flex; align-items:center; gap:12px; padding:12px; background:${i===0?'#fff1f2':'var(--background)'}; border-radius:16px; margin-bottom:10px; border:${i===0?'2px solid #fecaca':'1px solid var(--border)'};" onclick="app.switchView('history'); document.getElementById('hist-filter-machine').value='${m.id}'; app.renderHistory();">
                            <div style="font-size:1.8rem; width:40px; text-align:center;">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
                            <div style="flex:1;">
                                <div style="font-weight:900;">${this.getLineBadge(m.lineNo)}${m.name}</div>
                                <div style="font-size:0.75rem; color:var(--text-light);">${MaintenanceApp.toHalfWidthLower(m.model)}</div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:1.6rem; font-weight:950; color:var(--danger);">${m.count}<span style="font-size:0.8rem;">件</span></div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Category Chart -->
                <div class="card" style="padding:24px;">
                    <div style="font-size:1rem; font-weight:900; margin-bottom:20px; color:var(--text-main); display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid fa-chart-pie" style="color:var(--primary);"></i> 故障箇所の内訳
                    </div>
                            <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:20px; align-items:center;">
                        <div style="width:140px; height:140px; justify-self:center;">
                            <canvas id="ranking-cat-pie"></canvas>
                        </div>
                        <div style="font-size:0.8rem;">
                        ${Object.entries(catMap).sort((a,b)=>b[1]-a[1]).map(([cat, cnt]) => `
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                                <span><i class="fa-solid fa-circle" style="color:${catColors[cat]}; font-size:0.6rem;"></i> ${catLabels[cat]||cat}</span>
                                <b>${cnt}件</b>
                            </div>
                        `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        setTimeout(() => {
            const freqCtx = document.getElementById('ranking-freq-chart');
            if (freqCtx && listByCount.length > 0) {
                new Chart(freqCtx, {
                    type: 'bar',
                    data: {
                        labels: listByCount.slice(0, 10).map(m => `${m.name} [${MaintenanceApp.toHalfWidthLower(m.model || '')}]`),
                        datasets: [{
                            label: '故障回数',
                            data: listByCount.slice(0, 10).map(m => m.count),
                            backgroundColor: listByCount.slice(0, 10).map((m, i) => i === 0 ? '#ef4444' : '#60a5fa'),
                            borderRadius: 6
                        }]
                    },
                    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
            }
            const catCtx = document.getElementById('ranking-cat-pie');
            if (catCtx) {
                const sortedCats = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
                new Chart(catCtx, {
                    type: 'doughnut',
                    data: {
                        labels: sortedCats.map(([c]) => catLabels[c] || c),
                        datasets: [{ data: sortedCats.map(([,n]) => n), backgroundColor: sortedCats.map(([c]) => catColors[c] || '#94a3b8') }]
                    },
                    options: { cutout: '70%', plugins: { legend: { display: false } } }
                });
            }
        }, 100);
    }
    
    updateRelatedGuides(machineId) {
        const list = document.getElementById('s-related-guides-list');
        const section = document.getElementById('s-related-guides-section');
        if (!list || !section) return;

        if (!machineId || machineId === 'NEW_MACHINE') {
            section.style.display = 'none';
            return;
        }

        const machine = store.getMachines(true).find(m => m.id === machineId);
        const normModel = MaintenanceApp.toHalfWidthLower(machine?.model || '');

        // Search for relevant guides (Same machine or same model or same keywords)
        const relevantHistory = store.activeData.history.filter(h => {
            if (!h.guide || store.isGuideArchived(h.id)) return false;
            if (h.machineId === machineId) return true;
            const m = store.getMachines(true).find(mm => mm.id === h.machineId);
            return MaintenanceApp.toHalfWidthLower(m?.model || '') === normModel;
        });

        if (relevantHistory.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        list.innerHTML = relevantHistory.map(h => `
            <div class="guide-search-result" onclick="app.openGuideModal('${h.id}')">
                <div style="font-size:0.8rem; font-weight:800; color:var(--primary); margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:4px;">
                        ${this.getLineBadge(h.lineNo || machine?.lineNo)}
                        <span>${this.getHistoryDisplayText(h)}</span>
                    </div>
                    <span style="font-size:0.65rem; color:var(--text-light); font-weight:400;"><i class="fa-solid fa-clock-rotate-left"></i> ${h.date}</span>
                </div>
                <div style="font-size:0.75rem; color:var(--text-light); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                    ${h.guide.text}
                </div>
                <div style="display:flex; gap:4px; margin-top:6px;">
                    ${(h.guide.tags || []).map(t => `<span class="tag-badge"><i class="fa-solid fa-tag"></i> ${t}</span>`).join('')}
                </div>
            </div>
        `).join('');
    }

    renderGuides() {
        const container = document.getElementById('guides-container');
        const tagCloud = document.getElementById('guides-tag-cloud');
        if (!container || !tagCloud) return;

        const query = (document.getElementById('global-search')?.value || '').toLowerCase().trim();
        const normQuery = query ? MaintenanceStore.toHalfWidthLower(query) : null;

        const historyWithGuide = store.activeData.history.filter(h => !!h.guide && !store.isGuideArchived(h.id));
        const machines = store.getMachines(true);

        // --- ラインフィルタ選択肢の動的生成 ---
        const guideLineEl = document.getElementById('guides-filter-line');
        if (guideLineEl && guideLineEl.options.length <= 1) {
            const lineSet = new Set();
            historyWithGuide.forEach(h => {
                const m = machines.find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                if (l) lineSet.add(l);
            });
            Array.from(lineSet).sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric:true})).forEach(l => {
                const opt = document.createElement('option');
                opt.value = l;
                opt.textContent = this.getLineLabel(l);
                guideLineEl.appendChild(opt);
            });
            // --- 共通手順専用フィルタの追加 ---
            const optCommon = document.createElement('option');
            optCommon.value = 'COMMON_ONLY';
            optCommon.textContent = '★ 共通手順のみ';
            optCommon.style.fontWeight = '800';
            optCommon.style.color = 'var(--primary)';
            guideLineEl.appendChild(optCommon);
        }
        
        // --- Forced Registration Button ---
        let toolbar = guideLineEl?.closest('.filter-bar') || guideLineEl?.parentElement;
        if (!toolbar) {
            // Fallback: search for any toolbar-like container in the active view
            const notebookBtn = document.getElementById('notebook-search-btn');
            toolbar = notebookBtn?.closest('.view-toolbar') || notebookBtn?.closest('.filter-bar') || notebookBtn?.parentElement;
        }
        
        // Final fallback: try to find the header itself
        if (!toolbar) {
            toolbar = document.querySelector('.view-header') || document.querySelector('.view-toolbar');
        }

        if (toolbar && !document.getElementById('btn-manual-guide')) {
            const btn = document.createElement('button');
            btn.id = 'btn-manual-guide';
            btn.className = 'primary-btn';
            btn.style.padding = '8px 18px';
            btn.style.fontSize = '0.9rem';
            btn.style.borderRadius = '10px';
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            btn.style.borderColor = '#059669';
            btn.style.color = 'white';
            btn.style.fontWeight = '900';
            btn.style.display = 'inline-flex';
            btn.style.alignItems = 'center';
            btn.style.gap = '8px';
            btn.style.boxShadow = '0 4px 10px rgba(16, 185, 129, 0.25)';
            btn.style.transition = 'all 0.2s ease';
            btn.style.marginLeft = '12px';
            btn.innerHTML = '<i class="fa-solid fa-plus-circle" style="font-size:1.1rem;"></i> 強制登録';
            btn.onclick = () => this.openManualGuideRegistration();
            
            // Mouse hover effects
            btn.onmouseenter = () => { btn.style.transform = 'translateY(-1px)'; btn.style.boxShadow = '0 6px 15px rgba(16, 185, 129, 0.35)'; };
            btn.onmouseleave = () => { btn.style.transform = 'none'; btn.style.boxShadow = '0 4px 10px rgba(16, 185, 129, 0.25)'; };

            // Find a good place to insert (ideally at the end or near other primary actions)
            toolbar.appendChild(btn);
        }

        const guideLineVal = guideLineEl?.value || 'all';

        // 1. Generate Tags
        const tagFrequency = {};
        historyWithGuide.forEach(h => {
            (h.guide.tags || []).forEach(t => {
                tagFrequency[t] = (tagFrequency[t] || 0) + 1;
            });
        });
        let sortedTags = Object.entries(tagFrequency).sort((a,b) => b[1] - a[1]);
        if (normQuery) {
            const terms = normQuery.split(/[\s　]+/).filter(Boolean);
            sortedTags = sortedTags.filter(([tag]) => {
                const nt = MaintenanceStore.toHalfWidthLower(tag);
                return terms.every(t => nt.includes(t));
            });
        }

        tagCloud.innerHTML = `
            <button class="tag-badge ${!this.guideTagFilter ? 'active' : ''}" onclick="app.guideTagFilter=null; app.renderGuides()">全て</button>
            ${sortedTags.map(([tag, count]) => `
                <button class="tag-badge ${this.guideTagFilter === tag ? 'active' : ''}" onclick="app.guideTagFilter='${tag.replace(/'/g, "\\'")}'; app.renderGuides()">
                    ${tag} <span style="opacity:0.6; margin-left:2px; font-weight:400;">(${count})</span>
                </button>
            `).join('')}
        `;

        // 2. Filter Guides
        const filteredResult = historyWithGuide.filter(h => {
            // Line Filter
            if (guideLineVal === 'COMMON_ONLY') {
                if (h.machineId !== 'COMMON') return false;
            } else if (guideLineVal !== 'all') {
                const m = machines.find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                if (String(l) !== String(guideLineVal)) return false;
            }

            // Tag Filter
            if (this.guideTagFilter && !(h.guide.tags || []).includes(this.guideTagFilter)) return false;

            // Search Filter
            if (normQuery) {
                const terms = normQuery.split(/[\s　]+/).filter(Boolean);
                const machine = machines.find(m => m.id === h.machineId);
                const title = this.getHistoryDisplayText(h);
                const searchStr = `${title} ${h.guide.text} ${h.guide.tags.join(' ')} ${machine?.name || ''} ${machine?.model || ''} ${h.cause || ''} ${h.notes || ''}`.toLowerCase();
                const normSearch = MaintenanceStore.toHalfWidthLower(searchStr);
                return terms.every(t => normSearch.includes(t));
            }
            return true;
        });

        // 3. Render
        if (filteredResult.length === 0) {
            container.innerHTML = `
                <div style="grid-column:1/-1; text-align:center; padding:80px 20px; color:var(--text-light); background:rgba(0,0,0,0.02); border-radius:12px; border:2px dashed var(--border); margin:20px 0;">
                    <i class="fa-solid fa-book-open" style="font-size:3rem; opacity:0.2; margin-bottom:15px; display:block;"></i>
                    <div style="font-size:1.1rem; font-weight:800; margin-bottom:8px;">表示できる手順書がありません</div>
                    <div style="font-size:0.85rem; opacity:0.8;">検索条件を変えるか、右上の「強制登録」から新規作成してください。</div>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredResult.map(h => {
            const isCommon = h.machineId === 'COMMON';
            const machine = isCommon ? { name: '全般・共通', model: '-', category: h.guideCategory || '共通知識' } : store.getMachines(true).find(m => m.id === h.machineId);
            const title = this.getHistoryDisplayText(h);
            const machinePhoto = machine?.photo;
            const manualGuideBadge = h.isManualGuide ? '<span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:1px 6px; border-radius:3px; font-weight:900; font-size:0.65rem;"><i class="fa-solid fa-file-circle-plus"></i> 単独登録</span>' : '';
            
            // 共通手順用のスタイル
            const cardStyle = isCommon 
                ? 'display:flex; flex-direction:column; border: 2px solid var(--primary-light); background: linear-gradient(to bottom, #f0f9ff, #ffffff); box-shadow: 0 4px 12px rgba(37,99,235,0.08);' 
                : 'display:flex; flex-direction:column;';

            return `
                <div class="card" style="${cardStyle}">
                    <div style="padding:0px;">
                        <div style="display:flex; gap:12px; margin-bottom:12px; align-items:flex-start;">
                            ${machinePhoto ? `<div class="img-box" style="width:70px; height:70px; border-radius:8px; flex-shrink:0;"><img src="${machinePhoto}"></div>` : 
                             (isCommon ? `<div style="width:70px; height:70px; border-radius:8px; background:var(--primary-light); display:flex; align-items:center; justify-content:center; color:var(--primary); border:1px solid var(--primary); flex-shrink:0;"><i class="fa-solid fa-lightbulb" style="font-size:1.8rem; opacity:0.6;"></i></div>` : '')}
                            <div style="flex:1; min-width:0;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                    <span style="font-size:0.65rem; color:var(--text-light); border:1px solid #cbd5e1; padding:2px 6px; border-radius:4px; font-weight:700; background:white;">${h.date}</span>
                                    <span style="font-size:0.65rem; color:var(--primary); font-weight:900;">by ${h.guide.author || '不明'}</span>
                                </div>
                                <h4 style="border:none; padding:0; margin-bottom:2px; font-size:1rem; cursor:pointer; line-height:1.3;" onclick="app.openGuideModal('${h.id}')" title="${title}">${this.highlightText(title, query)}</h4>
                                    ${this.getLineBadge(h.lineNo || machine?.lineNo)}
                                    ${manualGuideBadge}
                                    ${machine?.category ? `<span style="background:${isCommon ? 'var(--primary)' : '#eff6ff'}; color:${isCommon ? 'white' : '#1e40af'}; border:1px solid #bae6fd; padding:1px 6px; border-radius:3px; font-weight:800; font-size:0.65rem;">${machine.category}</span>` : ''}
                                    ${isCommon ? '<span style="font-size:0.75rem; color:var(--primary); font-weight:800;">[共通ルール]</span>' : (machine?.name || '')} ${!isCommon && machine?.model ? `[${machine.model}]` : ''}
                                </div>
                            </div>
                        </div>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px; background:var(--background); padding:8px; border-radius:8px; border:1px solid var(--border);">
                            <div style="min-width:0;">
                                <div style="font-size:0.6rem; color:var(--text-light); font-weight:800; margin-bottom:2px;">原因</div>
                                <div style="font-size:0.75rem; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${h.cause || '-'}">${this.highlightText(h.cause || '-', query)}</div>
                            </div>
                            <div style="min-width:0;">
                                <div style="font-size:0.6rem; color:var(--text-light); font-weight:800; margin-bottom:2px;">処置</div>
                                <div style="font-size:0.75rem; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${h.notes || '-'}">${this.highlightText(h.notes || '-', query)}</div>
                            </div>
                        </div>
                        
                        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
                            ${(h.guide.tags || []).map(t => `<span class="tag-badge active"><i class="fa-solid fa-tag" style="font-size:0.6rem;"></i> ${this.highlightText(t, query)}</span>`).join('')}
                        </div>

                        <div style="font-size:0.8rem; color:var(--text-main); line-height:1.5; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; margin-bottom:16px;">
                            ${this.highlightText(h.guide.text || '', query)}
                        </div>

                        <div style="display:flex; gap:8px; border-top:1px dashed var(--border); padding-top:12px;">
                            <button class="secondary-btn" style="flex:1; padding:6px; font-size:0.75rem" onclick="app.openGuideModal('${h.id}')">手順書を開く</button>
                            <button class="secondary-btn" style="padding:6px; font-size:0.75rem" onclick="app.printGuide('${h.id}')" title="印刷"><i class="fa-solid fa-print"></i></button>
                            <button class="secondary-btn" style="padding:6px; font-size:0.75rem; color:var(--danger);" onclick="app.archiveGuide('${h.id}', '${title.replace(/'/g, "\\'")}')" title="アーカイブ"><i class="fa-solid fa-box-archive"></i></button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // --- Skill Map ---
    renderWorkers() {
        const container = document.getElementById('workers-container');
        if (!container) return;
        container.style.cssText = 'display:block; width:100%;';

        const history = store.getHistory({}).filter(h => h.isFirstTime !== false && !h.hideFromSkillMap);
        const machines = store.getMachines(true);

        const workerSet = new Set();
        history.forEach(h => {
            const wList = Array.isArray(h.workers) ? h.workers : [];
            wList.forEach(w => {
                if (typeof w === 'string') workerSet.add(w.trim());
            });
        });
        const workers = Array.from(workerSet).filter(Boolean).filter(w => !store.isWorkerArchived(w)).sort();

        if (workers.length === 0) {
            container.innerHTML = '<div style="padding:40px; color:var(--text-light)">作業者が記録されていません。メンテナンス記録に作業者名を入力してください。</div>';
            return;
        }

        const SKILL_KEY = 'skillEvaluations';
        let skillEvals = {};
        try { skillEvals = JSON.parse(localStorage.getItem(SKILL_KEY) || '{}'); } catch(e) {}

        const workerTasks = {};
        const latestNotesMap = {};
        const taskTypeMap = {}; 
        const firstRespondersMap = {};
        const taskEarliestDateMap = {};

        history.forEach(h => {
            const m = machines.find(x => x.id === h.machineId);
            const machineName = m ? `${m.name}` : '不明';
            const machineModel = m ? m.model : '';
            const content = h.taskId
                ? (store.activeData.tasks.find(t => t.id === h.taskId)?.content || h.taskContent || '定期メンテナンス')
                : (h.errorContent || h.notes || '突発対応');
            const taskKey = `${h.machineId}__${content}`;
            if (!this._taskCategoryMap) this._taskCategoryMap = {};
            if (!this._taskCategoryMap[taskKey]) this._taskCategoryMap[taskKey] = h.category || 'other';

            let typeColor = '#16a34a';
            if (h.isDokatei) typeColor = '#dc2626';
            else if (h.taskId) typeColor = '#1e3a8a';
            if (!taskTypeMap[taskKey] || typeColor !== '#1e3a8a') taskTypeMap[taskKey] = typeColor;

            if (!latestNotesMap[taskKey]) {
                const catLabels = { machine: '機械修理', electric: '電気系', adjust: '調整', parts: '部品交換', clean: '清掃・給油', other: 'その他' };
                const catText = catLabels[h.category] ? `\n[区分: ${catLabels[h.category]}]` : '';
                latestNotesMap[taskKey] = (h.notes || '') + catText;
            }

            (h.workers || []).forEach(w => {
                const ww = w.trim();
                if (!ww) return;
                if (!workerTasks[ww]) workerTasks[ww] = {};
                const normalizedModel = MaintenanceApp.toHalfWidthLower(machineModel);
                if (!workerTasks[ww][taskKey]) {
                    workerTasks[ww][taskKey] = { label: content, machine: machineName, machineId: h.machineId, model: normalizedModel, count: 0, lastDate: '', lineNo: h.lineNo || m?.lineNo };
                }
                workerTasks[ww][taskKey].count++;
                if (!workerTasks[ww][taskKey].lastDate || h.date > workerTasks[ww][taskKey].lastDate) {
                    workerTasks[ww][taskKey].lastDate = h.date;
                }

                if (!taskEarliestDateMap[taskKey] || h.date < taskEarliestDateMap[taskKey]) {
                    taskEarliestDateMap[taskKey] = h.date;
                    firstRespondersMap[taskKey] = new Set([ww]);
                } else if (h.date === taskEarliestDateMap[taskKey]) {
                    if (firstRespondersMap[taskKey]) firstRespondersMap[taskKey].add(ww);
                }
            });
        });

        const allTaskMap = {};
        Object.entries(workerTasks).forEach(([w, tasks]) => {
            Object.entries(tasks).forEach(([tk, info]) => {
                if (!allTaskMap[tk]) {
                    allTaskMap[tk] = { 
                        label: info.label, 
                        machine: info.machine, 
                        machineId: info.machineId,
                        model: info.model,
                        lineNo: info.lineNo,
                        latestNotes: latestNotesMap[tk] || '-',
                        color: taskTypeMap[tk] || 'var(--text-main)',
                        category: this._taskCategoryMap[tk] || 'other',
                        isManual: false
                    };
                }
            });
        });

        const manualSkills = JSON.parse(localStorage.getItem('manualSkills') || '[]');
        manualSkills.forEach(ms => {
            const tk = ms.id;
            const catLabels = { machine: '機械修理', electric: '電気系', adjust: '調整', parts: '部品交換', clean: '清掃・給油', other: 'その他' };
            const catText = catLabels[ms.category] ? `\n[区分: ${catLabels[ms.category]}]` : '';
                allTaskMap[tk] = {
                    label: ms.label,
                    machine: ms.machine,
                    model: ms.model || '-',
                    machineCategory: ms.machineCategory || '',
                    lineNo: ms.lineNo || null,
                    latestNotes: (ms.notes || '-') + catText,
                    color: '#7c3aed',
                    category: ms.category || 'other',
                    isManual: true
                };
        });

        let filteredTaskEntries = Object.entries(allTaskMap).filter(([tk, info]) => !store.isTaskArchived(tk));
        
        if (this.skillRiskFilter) {
            filteredTaskEntries = filteredTaskEntries.filter(([tk]) => !workers.some(w => (skillEvals[w] || {})[tk] === '○'));
        } else if (this.skillSoloFilter) {
            filteredTaskEntries = filteredTaskEntries.filter(([tk]) => {
                const count = workers.filter(w => (skillEvals[w] || {})[tk] === '○').length;
                return count === 1;
            });
        }

        if (this.skillModelFilter) {
            filteredTaskEntries = filteredTaskEntries.filter(([, info]) => info.model === this.skillModelFilter);
        }

        if (this.skillSearchQuery) {
            filteredTaskEntries = filteredTaskEntries.filter(([, info]) => {
                const terms = MaintenanceStore.toHalfWidthLower(this.skillSearchQuery).split(/[\s　]+/).filter(Boolean);
                const searchStr = `${info.label || ''} ${info.machine || ''} ${info.model || ''} ${info.machineCategory || ''} ${info.latestNotes || ''}`.toLowerCase();
                const normSearch = MaintenanceStore.toHalfWidthLower(searchStr);
                return terms.every(t => normSearch.includes(t));
            });
        }

        const allTaskEntries = filteredTaskEntries.sort((a, b) => {
            if (this.skillSortMode === 'model') {
                return (a[1].model || '').localeCompare(b[1].model || '');
            } else {
                const totalA = workers.reduce((s, w) => s + (workerTasks[w]?.[a[0]]?.count || 0), 0);
                const totalB = workers.reduce((s, w) => s + (workerTasks[w]?.[b[0]]?.count || 0), 0);
                return totalB - totalA;
            }
        });

        const totalTasks = allTaskEntries.length;

        container.innerHTML = `
            <div style="padding:12px; background:#f0f9ff; border-radius:10px; margin-bottom:16px; font-size:0.82rem; line-height:1.6; color:#0369a1; border:1px solid #bae6fd;">
                <div style="display:flex; align-items:center; gap:8px; font-weight:800; margin-bottom:4px;">
                    <i class="fa-solid fa-circle-info"></i> スキルマップの使い方
                </div>
                <div style="margin-bottom:8px;">
                    ・メンテで入力した作業者は自動で〇が付きますが、出来ない場合は直接△か✕に変更して下さい。
                    ・カレンダーに初回で登録した物が自動でスキルとして追加されます。
                    ・「全員表示」ボタンで、スクロールせずに全員を1画面で確認できます。
                    ・程度が低く必要性の無いスキルは除外ボタンを押して消して下さい。
                    ・<b>人名や習熟率をクリック</b>すると、その人の得意分野を分析したグラフを表示します。
                </div>
                <div style="font-size:0.75rem; color:var(--text-light); display:flex; gap:12px; align-items:center; flex-wrap:wrap; border-top:1px dashed #bae6fd; padding-top:8px;">
                    <span style="font-weight:900; color:#0369a1;">凡例:</span>
                    <span style="color:#16a34a; font-weight:800; background:#dcfce7; padding:2px 10px; border-radius:99px; border:1px solid #bbf7d0;">○ 単独で実施可能</span>
                    <span style="color:#b45309; font-weight:800; background:#fef9c3; padding:2px 10px; border-radius:99px; border:1px solid #fef08a;">△ サポートがあれば可</span>
                    <span style="color:#dc2626; font-weight:800; background:#fee2e2; padding:2px 10px; border-radius:99px; border:1px solid #fecaca;">✕ 未習得</span>
                </div>
            </div>
            <div style="width:100%; overflow:auto; max-height:75vh; border:1px solid var(--border); border-radius:12px; background:#fff; position:relative;">
                <table style="width:100%; border-collapse:separate; border-spacing:0; font-size:${this.skillFitAll ? '0.72rem' : '0.82rem'};">
                    <thead>
                        <tr>
                            <th style="padding:12px 14px; text-align:left; color:#fff; font-weight:800; width:320px; min-width:320px; max-width:320px; position:sticky; left:0; top:0; z-index:100; background:var(--primary); border-bottom:2px solid #1d4ed8; border-right:1px solid #1d4ed8;">作業内容 / 機械</th>
                            <th style="padding:12px 14px; text-align:left; color:#fff; font-weight:800; width:350px; min-width:350px; max-width:350px; position:sticky; left:320px; top:0; z-index:100; background:var(--primary); border-bottom:2px solid #1d4ed8; border-right:1px solid #1d4ed8;">最新の処置・対応内容</th>
                            <th style="padding:10px 4px; text-align:center; color:#fff; font-weight:800; width:45px; position:sticky; top:0; z-index:90; background:var(--primary); border-bottom:2px solid #1d4ed8; border-right:1px solid #1d4ed8;">除外</th>
                            ${workers.map(w => {
                                const evals = skillEvals[w] || {};
                                const circleCountForWorker = filteredTaskEntries.filter(([tk]) => (evals[tk] || (workerTasks[w]?.[tk]?.count > 0 ? '○' : '')) === '○').length;
                                const pct = totalTasks > 0 ? Math.round((circleCountForWorker / totalTasks) * 100) : 0;
                                const pctColor = pct >= 70 ? '#4ade80' : (pct >= 30 ? '#fde047' : '#fca5a5');
                                return `
                                <th style="padding:10px 4px; text-align:center; color:#fff; font-weight:800; position:sticky; top:0; z-index:80; background:var(--primary); border-bottom:2px solid #1d4ed8; border-right:1px solid #60a5fa33; cursor:pointer;" onclick="app.openWorkerRadarModal('${w.replace(/'/g, "\\'")}')" title="${w} さんのスキル特性分析を開く">
                                    <div style="font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-decoration:underline; text-underline-offset:3px;" title="${w}"><i class="fa-solid fa-chart-pie" style="font-size:0.7rem; opacity:0.8; margin-right:2px;"></i> ${w}</div>
                                    <div style="font-size:0.75rem; background:rgba(0,0,0,0.1); border-radius:4px; padding:2px 4px; margin-top:4px; font-weight:900; color:${pctColor};">習熟率: ${pct}%</div>
                                </th>`;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${allTaskEntries.map(([taskKey, info]) => {
                            const circleCount = workers.filter(w => ((skillEvals[w] || {})[taskKey] || (workerTasks[w]?.[taskKey]?.count > 0 ? '○' : '')) === '○').length;
                            let rowBg = '#ffffff'; 
                            let labelSuffix = '';
                            if (circleCount === 0) {
                                rowBg = '#ffcbd1'; // Denser Rose/Red
                                labelSuffix = ' <span style="color:#e11d48; font-size:0.6rem; border:1px solid #e11d48; padding:0 2px; border-radius:2px; font-weight:900; background:#fff; white-space:nowrap;"><i class="fa-solid fa-triangle-exclamation"></i> リスク</span>';
                            } else if (circleCount === 1) {
                                rowBg = '#ffe4b3'; // Denser Orange
                                labelSuffix = ' <span style="color:#ea580c; font-size:0.6rem; border:1px solid #ea580c; padding:0 2px; border-radius:2px; font-weight:900; background:#fff; white-space:nowrap;"><i class="fa-solid fa-user-shield"></i> 属人化</span>';
                            }
                            return `
                            <tr style="background:${rowBg}; border-bottom:1px solid var(--border); transition: background 0.2s;">
                                <td style="padding:8px 14px; vertical-align:middle; position:sticky; left:0; z-index:50; background:inherit; border-right:1px solid var(--border); width:320px; min-width:320px; max-width:320px;">
                                    <div style="font-weight:700; font-size:0.82rem; color:${info.color}; display:flex; flex-wrap:wrap; align-items:center; gap:4px;">
                                        <span style="white-space:normal; line-height:1.2; cursor:pointer; text-decoration:underline;" onclick="app.switchView('history'); document.getElementById('hist-filter-machine').value='${info.machineId || ''}'; document.getElementById('global-search').value='${info.label.split('__')[0].replace(/'/g,"\\'") }'; app.renderHistory();">${this.highlightText(info.label, this.skillSearchQuery)}</span>
                                        ${labelSuffix}
                                    </div>
                                    <div style="font-size:0.65rem; color:var(--text-light); white-space:nowrap; margin-top:2px;">
                                        ${this.getLineBadge(info.lineNo)}${this.highlightText(info.machine, this.skillSearchQuery)} [<span style="color:#ea580c; font-weight:700; cursor:pointer; text-decoration:underline; ${this.skillModelFilter === info.model ? 'background:#ffedd5; padding:0 4px; border-radius:4px; outline:1px solid #ea580c;' : ''}" onclick="app.toggleSkillModelFilter('${info.model || ''}')" title="型式フィルタ">${this.highlightText(info.model || '-', this.skillSearchQuery)}</span>]
                                    </div>
                                </td>
                                <td style="padding:8px 14px; vertical-align:middle; position:sticky; left:320px; z-index:50; background:inherit; border-right:1px solid var(--border); width:350px; min-width:350px; max-width:350px;">
                                    <div style="font-size:0.75rem; color:${info.isManual ? '#7c3aed' : 'var(--text-main)'}; font-weight:${info.isManual ? '700' : '400'}; line-height:1.3; white-space:pre-wrap; word-break:break-all;">${this.highlightText(info.latestNotes, this.skillSearchQuery)}</div>
                                </td>
                                <td style="padding:8px 4px; text-align:center; vertical-align:middle; border-right:1px solid var(--border);">
                                    <button class="secondary-btn" style="padding:2px 4px; font-size:0.6rem; color:var(--text-light); border-radius:4px;" onclick="app.archiveSkillTask('${taskKey.replace(/'/g, "\\'")}', '${info.label} [${info.machine}]', ${!!info.isManual})">
                                        <i class="fa-solid fa-eye-slash"></i>
                                    </button>
                                </td>
                                ${workers.map(w => {
                                    const wInfo = workerTasks[w]?.[taskKey];
                                    const val = (skillEvals[w] || {})[taskKey] || (wInfo?.count > 0 ? '○' : '');
                                    return `
                                        <td style="padding:6px 1px; text-align:center; vertical-align:middle; transition:background.2s; border-right:1px solid #0000000a;">
                                            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; min-height:45px;">
                                                <div class="skill-toggle-group" style="${this.skillFitAll ? 'width:100%; max-width:105px; margin:0 auto; padding:2px;' : ''}">
                                                    <div class="skill-chip ${val==='○'?'active':''}" style="${this.skillFitAll ? 'flex:1; width:auto; max-width:32px; min-width:12px; aspect-ratio:1; height:auto; font-size:1.1rem; padding:0;' : ''}" data-val="○" onclick="app.saveSkillEval('${w}', '${taskKey.replace(/'/g,"\\'")}', '○')" title="単独可能">○</div>
                                                    <div class="skill-chip ${val==='△'?'active':''}" style="${this.skillFitAll ? 'flex:1; width:auto; max-width:32px; min-width:12px; aspect-ratio:1; height:auto; font-size:1.1rem; padding:0;' : ''}" data-val="△" onclick="app.saveSkillEval('${w}', '${taskKey.replace(/'/g,"\\'")}', '△')" title="要サポート">△</div>
                                                    <div class="skill-chip ${val==='✕'?'active':''}" style="${this.skillFitAll ? 'flex:1; width:auto; max-width:32px; min-width:12px; aspect-ratio:1; height:auto; font-size:1.1rem; padding:0;' : ''}" data-val="✕" onclick="app.saveSkillEval('${w}', '${taskKey.replace(/'/g,"\\'")}', '✕')" title="未習得">✕</div>
                                                </div>
                                                ${firstRespondersMap[taskKey]?.has(w) ? `<div style="font-size:${this.skillFitAll ? '0.45rem' : '0.55rem'}; color:#0369a1; font-weight:800; background:#e0f2fe; padding:${this.skillFitAll ? '0 1px' : '1px 4px'}; border-radius:2px; white-space:nowrap; border:1px solid #bae6fd; line-height:1; transform:${this.skillFitAll ? 'scale(0.9)' : 'none'};">初回対応者</div>` : ''}
                                            </div>
                                        </td>`;
                                }).join('')}
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML += `<div id="skill-stats-container" style="margin-top:40px;"></div>`;

        this._lastSkillData = { workers, allTaskEntries, skillEvals, workerTasks };
        this.renderSkillStats();
    }

    renderSkillStats() {
        const statsContainer = document.getElementById('skill-stats-drawer-content');
        if (!statsContainer) return;
        
        const { workers, allTaskEntries, skillEvals, workerTasks } = this._lastSkillData || {};
        if (!workers) return;

        const getEffectiveVal = (w, tk) => (skillEvals[w] || {})[tk] || (workerTasks[w]?.[tk]?.count > 0 ? '○' : '');

        const totalTasks = allTaskEntries.length;
        const coveredTasks = allTaskEntries.filter(([tk]) => workers.some(w => getEffectiveVal(w, tk) === '○')).length;
        const globalCoverage = totalTasks > 0 ? (coveredTasks / totalTasks * 100).toFixed(1) : 0;
        const riskTasks = allTaskEntries.filter(([tk]) => workers.filter(w => getEffectiveVal(w, tk) === '○').length === 0).length;
        const soloTasks = allTaskEntries.filter(([tk]) => workers.filter(w => getEffectiveVal(w, tk) === '○').length === 1).length;

        const covVal = parseFloat(globalCoverage);
        const covColor = covVal >= 70 ? '#16a34a' : (covVal >= 30 ? '#d97706' : '#dc2626');

        statsContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:24px;">
                <!-- Summary Card -->
                <div class="card" style="padding:24px; text-align:center; background:white; border:4px solid ${covColor}; box-shadow:var(--shadow-lg);">
                    <div style="font-size:0.9rem; font-weight:800; color:var(--text-light); margin-bottom:14px;">全体のスキルカバー率</div>
                    <div style="font-size:4.2rem; font-weight:900; color:${covColor}; line-height:1; letter-spacing:-2px;">${globalCoverage}<span style="font-size:1.8rem; margin-left:4px;">%</span></div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:24px;">
                        <div style="background:#fff1f2; color:#e11d48; padding:12px; border-radius:12px; border:1px solid #fecdd3;">
                            <div style="font-size:0.65rem; font-weight:800; text-transform:uppercase; margin-bottom:4px;">リスクスキル</div>
                            <div style="font-size:1.4rem; font-weight:950;">${riskTasks}<span style="font-size:0.7rem; margin-left:2px;">件</span></div>
                        </div>
                        <div style="background:#fff7ed; color:#ea580c; padding:12px; border-radius:12px; border:1px solid #ffedd5;">
                            <div style="font-size:0.65rem; font-weight:800; text-transform:uppercase; margin-bottom:4px;">属人化スキル</div>
                            <div style="font-size:1.4rem; font-weight:950;">${soloTasks}<span style="font-size:0.7rem; margin-left:2px;">件</span></div>
                        </div>
                    </div>
                    <div style="margin-top:20px; font-size:0.8rem; color:var(--text-light); font-weight:600;">
                        スキルマップ表示中の ${totalTasks} 項目中 <b>${coveredTasks}</b> 項目をカバー済
                    </div>
                </div>
            </div>
        `;
    }

    archiveSkillTask(taskKey, label, isManual = false) {
        if (isManual) {
            if (confirm(`手動登録したスキル「${label}」を完全に削除しますか？`)) {
                let manualSkills = JSON.parse(localStorage.getItem('manualSkills') || '[]');
                manualSkills = manualSkills.filter(ms => ms.id !== taskKey);
                localStorage.setItem('manualSkills', JSON.stringify(manualSkills));
                this.renderWorkers();
            }
        } else {
            if (confirm(`「${label}」をスキルマップから除外（非表示）しますか？\n（管理画面から復元することも可能です）`)) {
                store.toggleTaskArchive(taskKey);
                this.renderWorkers();
            }
        }
    }

    openAddManualSkillModal() {
        this.openModal('add-skill', 'スキルの強制追加', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div class="form-group">
                    <label>スキル名・内容（紫文字で表示）</label>
                    <input type="text" id="ms-label" placeholder="例: フォークリフト免許、安全管理者研修">
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                    <div class="form-group">
                        <label>対象機械名（任意）</label>
                        <input type="text" id="ms-machine" placeholder="例: Aコンベア、共通">
                    </div>
                    <div class="form-group">
                        <label>装置区分 (例: 包装機, 充填機)</label>
                        <select id="ms-machine-category" onchange="app.toggleNewCategoryField('ms-')">
                            <option value="">-- 指定なし --</option>
                            ${this.getMachineCategoryOptions()}
                        </select>
                        <input type="text" id="ms-new-category-input" placeholder="新しい装置区分名を入力" style="display:none; margin-top:8px; border:2px solid var(--primary); padding:8px;" onblur="this.value = MaintenanceApp.toFullWidthUpper(this.value)">
                    </div>
                    <div class="form-group">
                        <label>型式（任意）</label>
                        <input type="text" id="ms-model" placeholder="例: M-101">
                    </div>
                    <div class="form-group">
                        <label>ライン番号</label>
                        <select id="ms-line-no">
                            <option value="">-- 指定なし --</option>
                            ${this.generateLineOptionsHTML()}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>作業区分</label>
                    <select id="ms-category">
                        <option value="other">その他</option>
                        <option value="machine">機械修理</option>
                        <option value="electric">電気系</option>
                        <option value="adjust">調整</option>
                        <option value="parts">部品交換</option>
                        <option value="clean">清掃・給油</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>処置内容・補足（紫文字で表示）</label>
                    <textarea id="ms-notes" rows="4" placeholder="スキルの詳細な定義や取得条件など"></textarea>
                </div>
            `;
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `
                    <button class="secondary-btn" onclick="app.closeModal()">キャンセル</button>
                    <button class="primary-btn" onclick="app.saveManualSkill()">強制登録する</button>
                `;
            }
        });
    }

    saveManualSkill() {
        const label = document.getElementById('ms-label').value.trim();
        const machine = document.getElementById('ms-machine').value.trim() || '共通';
        const model = document.getElementById('ms-model').value.trim() || '-';
        const lineNo = document.getElementById('ms-line-no').value;
        const category = document.getElementById('ms-category').value;
        const machineCategory = this.getCategoryFromModalInput('ms-');
        const notes = document.getElementById('ms-notes').value.trim();

        if (!label) return alert('スキル名を入力してください');

        let manualSkills = JSON.parse(localStorage.getItem('manualSkills') || '[]');
        manualSkills.push({
            id: 'm_' + Date.now(),
            label,
            machine,
            model,
            machineCategory,
            lineNo,
            notes,
            category,
            isManual: true
        });

        localStorage.setItem('manualSkills', JSON.stringify(manualSkills));
        this.closeModal();
        this.renderWorkers();
    }

    saveSkillEval(worker, taskKey, val) {
        const SKILL_KEY = 'skillEvaluations';
        let evals = {};
        try { evals = JSON.parse(localStorage.getItem(SKILL_KEY) || '{}'); } catch(e) {}
        if (!evals[worker]) evals[worker] = {};
        
        // Toggle logic
        if (evals[worker][taskKey] === val) {
            delete evals[worker][taskKey];
        } else {
            evals[worker][taskKey] = val;
        }
        
        localStorage.setItem(SKILL_KEY, JSON.stringify(evals));
        this.renderWorkers();
    }

    setSkillSortMode(mode) {
        this.skillSortMode = mode;
        this.renderWorkers();
    }

    toggleSkillModelFilter(model) {
        if (!model) return;
        if (this.skillModelFilter === model) {
            this.skillModelFilter = null;
        } else {
            this.skillModelFilter = model;
        }
        this.renderWorkers();
    }

    openWorkerRadarModal(workerName) {
        this.openModal('worker-radar', `${workerName} さんのスキル特性分析`, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div style="text-align:center; padding:20px;">
                    <div style="width:100%; max-width:460px; margin:0 auto; height:400px; background:#fff; padding:15px; border-radius:16px; border:1px solid #e2e8h0; box-shadow:var(--shadow-sm);">
                        <canvas id="worker-radar-chart"></canvas>
                    </div>
                    <div style="margin-top:24px; font-size:0.85rem; color:var(--text-light); text-align:left; background:#eff6ff; padding:18px; border-radius:12px; border:1px solid #bae6fd;">
                        <p style="font-weight:900; color:var(--primary); margin-bottom:10px; font-size:0.9rem;"><i class="fa-solid fa-circle-info"></i> レーダーチャートの見方</p>
                        各項目のスコアは、その分野（作業区分）の全タスク数に対して、作業員がどれだけ習熟しているかを数値化したものです。<br>
                        <ul style="margin-top:8px; padding-left:20px;">
                            <li><b>○ (単独可能)</b> … 1.0点</li>
                            <li><b>△ (サポート要)</b> … 0.5点</li>
                        </ul>
                        グラフの頂点が外側に近いほど、その分野における専門知識や経験が豊富であることを示しています。
                    </div>
                </div>
            `;
            setTimeout(() => this.renderWorkerRadarChart('worker-radar-chart', workerName), 100);
        });
    }

    renderWorkerRadarChart(canvasId, workerName) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const { workers, allTaskEntries, skillEvals } = this._lastSkillData || {};
        if (!allTaskEntries) return;

        const catLabels = { 
            machine: '機械修理', 
            electric: '電気系修理', 
            adjust: '調整・設定', 
            parts: '部品交換', 
            clean: '清掃・給油', 
            other: 'その他' 
        };
        const categories = Object.keys(catLabels);
        
        const scores = categories.map(cat => {
            const catTasks = allTaskEntries.filter(([tk, info]) => info.category === cat);
            if (catTasks.length === 0) return 0;
            
            const points = catTasks.reduce((sum, [tk]) => {
                const val = (skillEvals[workerName] || {})[tk];
                if (val === '○') return sum + 1.0;
                if (val === '△') return sum + 0.5;
                return sum;
            }, 0);
            
            return Math.round((points / catTasks.length) * 100);
        });

        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: categories.map(c => catLabels[c]),
                datasets: [{
                    label: `${workerName} さんの習熟スコア (%)`,
                    data: scores,
                    backgroundColor: 'rgba(37, 99, 235, 0.15)',
                    borderColor: 'rgb(37, 99, 235)',
                    borderWidth: 3,
                    pointBackgroundColor: 'rgb(37, 99, 235)',
                    pointBorderColor: '#fff',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: '#e2e8f0' },
                        grid: { color: '#e2e8f0' },
                        suggestedMin: 0,
                        suggestedMax: 100,
                        ticks: { stepSize: 20, font: { size: 9, weight: '700' }, backdropColor: 'transparent' },
                        pointLabels: { font: { size: 12, weight: '900' }, color: '#475569' }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    toggleSkillFit() {
        this.skillFitAll = !this.skillFitAll;
        const btn = document.getElementById('btn-skill-fit');
        if (btn) {
            btn.classList.toggle('active', this.skillFitAll);
            btn.innerHTML = this.skillFitAll ? '<i class="fa-solid fa-arrows-left-right"></i> スクロールに戻す' : '<i class="fa-solid fa-arrows-left-right-to-line"></i> 全員表示';
        }
        this.renderWorkers();
    }

    renderSkillTrendGraph(selectedWorker = null) {
        const { workers, allTaskEntries, skillEvals } = this._lastSkillData || {};
        if (!workers || !allTaskEntries || !skillEvals) return;

        const history = store.getHistory();
        
        // Find the earliest global history date as the "start of system"
        let globalMinDate = null;
        if (history.length > 0) {
            const minStr = history.reduce((min, h) => (!min || h.date < min) ? h.date : min, "");
            globalMinDate = new Date(minStr);
            if (isNaN(globalMinDate.getTime())) globalMinDate = null;
        }

        const months = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(d);
        }

        const dataPoints = months.map(monthDate => {
            const year = monthDate.getFullYear();
            const month = monthDate.getMonth();
            const lastDay = new Date(year, month + 1, 0); 
            const monthEndStr = lastDay.toISOString().split('T')[0];

            const count = allTaskEntries.filter(([taskKey, info]) => {
                // 1. Check history (Historical growth)
                const hasMatchHistory = history.some(h => {
                    const hTaskKey = `${h.machineId}__${h.taskId ? (store.activeData.tasks.find(t=>t.id===h.taskId)?.content || h.taskContent || '定期メンテナンス') : (h.errorContent || h.notes || '突発対応')}`;
                    if (hTaskKey !== taskKey || h.date > monthEndStr) return false;
                    if (selectedWorker) return (h.workers || []).includes(selectedWorker);
                    return (h.workers || []).length > 0;
                });
                if (hasMatchHistory) return true;

                // 2. Check Static Evaluation (Self-evaluations or manual skills)
                // We should only count these IF the month is >= system start OR skill creation
                if (globalMinDate && lastDay < globalMinDate) {
                    return false; // Skip if before system usage started
                }

                if (info.isManual) {
                    const timestampStr = taskKey.split('_')[1];
                    const createdAt = timestampStr ? new Date(parseInt(timestampStr)) : null;
                    if (!createdAt || isNaN(createdAt.getTime()) || createdAt > lastDay) {
                        return false; 
                    }
                }

                if (selectedWorker) {
                    return (skillEvals[selectedWorker] || {})[taskKey] === '○';
                } else {
                    return workers.some(w => (skillEvals[w] || {})[taskKey] === '○');
                }
            }).length;

            const rate = allTaskEntries.length > 0 ? (count / allTaskEntries.length * 100).toFixed(1) : 0;
            return { label: `${month + 1}月`, value: parseFloat(rate) };
        });

        this.openModal('skill-trend', `スキル習得の成長推移 (${selectedWorker || 'チーム全体'})`, () => {
            const content = document.getElementById('modal-content');
            
            const workerBtns = [null, ...workers].map(w => {
                const label = w || 'チーム全体';
                const isActive = selectedWorker === w;
                const style = isActive 
                    ? 'background:var(--primary); color:white; border-color:var(--primary);' 
                    : 'background:white; color:var(--text-main); border-color:var(--border);';
                return `<button class="secondary-btn" style="padding:4px 12px; font-size:0.75rem; border-radius:99px; ${style}" 
                        onclick="app.renderSkillTrendGraph(${w ? `'${w.replace(/'/g,"\\'")}'` : 'null'})">${label}</button>`;
            }).join('');

            content.innerHTML = `
                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--border);">
                    <div style="font-size:0.75rem; font-weight:900; color:var(--text-light); width:100%; margin-bottom:8px;">分析対象の切り替え:</div>
                    ${workerBtns}
                </div>
                <div style="background:var(--primary-light); color:var(--primary); padding:10px; border-radius:8px; margin-bottom:20px; font-size:0.75rem; font-weight:700; line-height:1.4;">
                    <i class="fa-solid fa-circle-info"></i> ${(selectedWorker ? `<b>${selectedWorker}</b> さんが` : 'チーム全体で')} 過去に実施経験のある項目の割合（経験ベースの習熟率）を表示しています。
                </div>
                <div style="height:350px; width:100%;">
                    <canvas id="skillTrendChart"></canvas>
                </div>
            `;

            const ctx = document.getElementById('skillTrendChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dataPoints.map(d => d.label),
                    datasets: [{
                        label: '習熟率 / カバー率 (%)',
                        data: dataPoints.map(d => d.value),
                        borderColor: selectedWorker ? '#7c3aed' : '#2563eb',
                        backgroundColor: selectedWorker ? 'rgba(124, 58, 237, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                        borderWidth: 3,
                        pointRadius: 5,
                        pointBackgroundColor: selectedWorker ? '#7c3aed' : '#2563eb',
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            align: 'top',
                            formatter: (v) => v + '%',
                            font: { weight: 'bold', size: 11 }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { callback: (v) => v + '%' }
                        }
                    }
                }
            });

            const footer = document.querySelector('.modal-footer');
            if (footer) footer.innerHTML = `<button class="secondary-btn" onclick="app.closeModal()">閉じる</button>`;
        });
    }

    setWorkTimeGroup(mode) {
        this.workTimeGroupBy = mode;
        this.workTimeDrillDownCategory = null;
        const btnWorker = document.getElementById('btn-worktime-worker');
        const btnCategory = document.getElementById('btn-worktime-category');
        const searchInput = document.getElementById('worktime-search');
        if (btnWorker) btnWorker.classList.toggle('active', mode === 'worker');
        if (btnCategory) btnCategory.classList.toggle('active', mode === 'category');
        if (searchInput) {
            searchInput.placeholder = mode === 'worker' ? '作業員を検索...' : '装置区分を検索...';
        }
        this.renderWorkTime();
    }

    renderWorkTime(searchQuery = '') {
        const container = document.getElementById('worktime-container');
        if (!container) return;

        const q = (searchQuery || '').toLowerCase().trim();
        this.workTimeSearchQuery = q;
        const period = document.getElementById('worktime-filter-period')?.value || 'this_month';
        const lineVal = document.getElementById('worktime-filter-line')?.value || 'all';
        this.updateViewSubtitle('view-worktime', period);

        // Populate line filter if empty (except for 'all')
        const lineFilter = document.getElementById('worktime-filter-line');
        if (lineFilter && lineFilter.options.length <= 1) {
            const lines = new Set();
            store.activeData.history.forEach(h => { if(h.lineNo) lines.add(h.lineNo); });
            store.getMachines(true).forEach(m => { if(m.lineNo) lines.add(m.lineNo); });
            Array.from(lines).sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric:true})).forEach(l => {
                const opt = document.createElement('option');
                opt.value = l;
                opt.textContent = this.getLineLabel(l);
                lineFilter.appendChild(opt);
            });
        }

        const isDrilledDown = !!this.workTimeDrillDownCategory;
        const currentGroupBy = this.workTimeGroupBy || 'worker';

        // トレンドグラフの描画
        this.renderWorkTimeTrend();

        let history = store.getHistory({});
        history = this.filterHistoryByPeriod(history, period);

        if (lineVal !== 'all') {
            const machines_temp = store.getMachines(true);
            history = history.filter(h => {
                const m = machines_temp.find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                return String(l) === String(lineVal);
            });
        }
        const machines = store.getMachines(true);

        const statsMap = {}; 
        const archivedStats = { totalTime: 0, pt: 0, st: 0, np: 0, dt: 0, pc: 0, sc: 0, npc: 0, dc: 0, machineTimeMap: {}, troubleCountMap: {} };
        let totalTimeSum = 0;

        history.forEach(h => {
            const time = parseInt(h.workTime) || 0;
            const isPeriodic = !!h.taskId;
            const m = machines.find(x => x.id === h.machineId);
            
            // Get group key
            let groupKeys = [];
            if (currentGroupBy === 'category') {
                let cat = (m && m.category) ? m.category : (h.machineCategory || 'その他');
                groupKeys = [cat];
            } else {
                groupKeys = (h.workers || []).map(w => w.trim()).filter(Boolean);
            }

            groupKeys.forEach(k => {
                totalTimeSum += time;
                const isArchived = (currentGroupBy === 'worker' && store.isWorkerArchived(k));
                
                const s = isArchived ? archivedStats : (statsMap[k] || (statsMap[k] = { totalTime: 0, pt: 0, st: 0, np: 0, dt: 0, pc: 0, sc: 0, npc: 0, dc: 0, machineTimeMap: {}, troubleCountMap: {} }));
                
                s.totalTime += time;
                if (isPeriodic) {
                    s.pt += time;
                    s.pc++;
                } else if (h.isDokatei) {
                    s.dt += time;
                    s.dc++;
                } else if (h.isNonProductionStop) {
                    s.np += time;
                    s.npc++;
                } else {
                    s.st += time;
                    s.sc++;
                }
                if (m) {
                    const normModel = MaintenanceApp.toHalfWidthLower(m.model);
                    const mKey = `${m.name} [${normModel}]`;
                    s.machineTimeMap[mKey] = (s.machineTimeMap[mKey] || 0) + time;
                }
                const content = this.getHistoryDisplayText(h);
                s.troubleCountMap[content] = (s.troubleCountMap[content] || 0) + 1;
            });
        });

        let results = Object.entries(statsMap).map(([name, s]) => {
            const avgSudden = s.sc > 0 ? (s.st / s.sc).toFixed(1) : 0;
            const avgDokatei = s.dc > 0 ? (s.dt / s.dc).toFixed(1) : 0;
            const pct = totalTimeSum > 0 ? ((s.totalTime / totalTimeSum) * 100).toFixed(1) : 0;
            
            const topMachines = Object.entries(s.machineTimeMap).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>`・${x[0]} (${x[1]}分)`).join('<br>');
            const topTroubles = Object.entries(s.troubleCountMap).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>`・${x[0]} (${x[1]}件)`).join('<br>');

            return { name, totalTime: s.totalTime, pct, pt: s.pt, st: s.st, np: s.np, dt: s.dt, pc: s.pc, sc: s.sc, npc: s.npc, dc: s.dc, avgSudden, avgDokatei, topMachines, topTroubles, isArchived: false };
        });

        if (currentGroupBy === 'worker' && archivedStats.totalTime > 0) {
            const s = archivedStats;
            const pct = totalTimeSum > 0 ? ((s.totalTime / totalTimeSum) * 100).toFixed(1) : 0;
            const topMachines = Object.entries(s.machineTimeMap).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>`・${x[0]} (${x[1]}分)`).join('<br>');
            const topTroubles = Object.entries(s.troubleCountMap).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>`・${x[0]} (${x[1]}件)`).join('<br>');
            results.push({ name: '旧作業者合計', totalTime: s.totalTime, pct, pt: s.pt, st: s.st, np: s.np, dt: s.dt, pc: s.pc, sc: s.sc, npc: s.npc, dc: s.dc, avgSudden: (s.sc > 0 ? (s.st / s.sc).toFixed(1) : 0), avgDokatei: (s.dc > 0 ? (s.dt / s.dc).toFixed(1) : 0), topMachines, topTroubles, isArchived: true });
        }

        if (q) {
            const terms = q.split(/[\s　]+/).filter(Boolean);
            results = results.filter(r => {
                const nr = MaintenanceStore.toHalfWidthLower(r.name);
                return terms.every(t => nr.includes(t));
            });
        }
        results.sort((a, b) => b.totalTime - a.totalTime);

        container.innerHTML = '';
        
        if (isDrilledDown) {
            const backLink = document.createElement('div');
            backLink.style.cssText = 'margin-bottom: 15px; font-size: 0.85rem;';
            backLink.innerHTML = `
                <span style="color:var(--text-light); font-weight:700;">表示中: </span>
                <span style="color:var(--primary); font-weight:900; background:var(--primary-light); padding:2px 8px; border-radius:4px;">${this.workTimeDrillDownCategory}</span>
                <a href="#" onclick="app.workTimeDrillDownCategory=null; app.renderWorkTime(); return false;" style="margin-left:12px; color:var(--text-light); text-decoration:underline;">全体に戻る</a>
            `;
            container.appendChild(backLink);
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.style.cssText = 'margin-bottom:0; width:100%;';
        table.innerHTML = `
                <thead>
                    <tr>
                        <th style="background:#f8fafc; color:var(--text-light); font-weight:700;">${isDrilledDown ? '機械名' : (currentGroupBy === 'worker' ? '作業者' : '装置区分')}</th>
                        <th style="background:#f8fafc; color:var(--text-light); font-weight:700; text-align:right;">合計時間 <span style="font-size:0.6rem">(分) / 割合</span></th>
                        <th style="background:#f0f9ff; color:#1e40af; font-weight:700; text-align:right;">定期メンテ <span style="font-size:0.6rem">(分)</span></th>
                        <th style="background:#f0f9ff; color:#1e40af; font-weight:700; text-align:center;">件数</th>
                        <th style="background:#f0fdf4; color:#166534; font-weight:700; text-align:right;">突発対応 <span style="font-size:0.6rem">(分)</span></th>
                        <th style="background:#f0fdf4; color:#166534; font-weight:700; text-align:center;">件数</th>
                        <th style="background:#fffbeb; color:#92400e; font-weight:700; text-align:right;">非生産停止 <span style="font-size:0.6rem">(分)</span></th>
                        <th style="background:#fffbeb; color:#92400e; font-weight:700; text-align:center;">件数</th>
                        <th style="background:#fef2f2; color:#b91c1c; font-weight:700; text-align:right;">ドカ停 <span style="font-size:0.6rem">(分)</span></th>
                        <th style="background:#fef2f2; color:#b91c1c; font-weight:700; text-align:center;">件数</th>
                        <th style="background:#f8fafc; color:var(--text-light); font-weight:700; text-align:right;">平均突発 <span style="font-size:0.6rem">(分)</span></th>
                        <th style="background:#f8fafc; color:var(--text-light); font-weight:700; text-align:right;">平均ドカ停 <span style="font-size:0.6rem">(分)</span></th>
                        <th style="background:#f8fafc; color:var(--text-light); font-weight:700;">${currentGroupBy === 'worker' ? '経験機械トップ3' : '主なトラブル内容トップ3'}</th>
                        <th style="background:#f8fafc; color:var(--text-light); font-weight:700; text-align:center;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(r => {
                        let displayName = this.highlightText(r.name, q);
                        if (isDrilledDown) {
                            const mach = machines.find(m => `${m.name} [${MaintenanceApp.toHalfWidthLower(m.model)}]` === r.name);
                            if (mach && mach.lineNo) {
                                displayName = this.getLineBadge(mach.lineNo) + displayName;
                            }
                        }
                        return `
                        <tr style="${r.isArchived ? 'background: #f8fafc; font-style: italic; opacity: 0.8;' : ''}">
                            <td style="font-weight:700; color:var(--text-main);">${displayName}</td>
                            <td style="text-align:right; font-weight:900; color:var(--primary); font-size:1rem;">
                                ${r.totalTime.toLocaleString()} <span style="font-size:0.75rem; color:var(--text-light); font-weight:400; margin-left:4px;">(${r.pct}%)</span>
                            </td>
                            <td style="text-align:right; font-weight:800; color:#1e40af; background:#f0f9ff; font-size:1rem;">${r.pt.toLocaleString()}</td>
                            <td style="text-align:center; background:#f0f9ff;">
                                <span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#fff; color:#1e40af; font-weight:800; font-size:0.75rem; border:1px solid #dbeafe;">${r.pc}</span>
                            </td>
                            <td style="text-align:right; font-weight:800; color:#166534; background:#f0fdf4; font-size:1rem;">${r.st.toLocaleString()}</td>
                            <td style="text-align:center; background:#f0fdf4;">
                                <span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#fff; color:#166534; font-weight:800; font-size:0.75rem; border:1px solid #dcfce7;">${r.sc}</span>
                            </td>
                            <td style="text-align:right; font-weight:800; color:#92400e; background:#fffbeb; font-size:1rem;">${(r.np || 0).toLocaleString()}</td>
                            <td style="text-align:center; background:#fffbeb;">
                                <span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#fff; color:#92400e; font-weight:800; font-size:0.75rem; border:1px solid #fde68a;">${r.npc || 0}</span>
                            </td>
                            <td style="text-align:right; font-weight:800; color:#b91c1c; background:#fef2f2; font-size:1rem;">${r.dt.toLocaleString()}</td>
                            <td style="text-align:center; background:#fef2f2;">
                                <span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#fff; color:#b91c1c; font-weight:800; font-size:0.75rem; border:1px solid #fecaca;">${r.dc}</span>
                            </td>
                            <td style="text-align:right; font-weight:800; color:var(--text-main); font-size:0.85rem;">${r.avgSudden}</td>
                            <td style="text-align:right; font-weight:800; color:var(--danger); font-size:0.85rem;">${r.avgDokatei}</td>
                            <td style="font-size:0.7rem; color:var(--text-light); line-height:1.4; padding:8px 4px; min-width:180px;">${currentGroupBy === 'worker' ? (r.topMachines || '-') : (r.topTroubles || '-')}</td>
                            <td style="text-align:center;">
                                ${currentGroupBy === 'category' || isDrilledDown ? '-' : (r.isArchived ? '-' : `<button class="secondary-btn" style="padding:2px 8px; font-size:0.7rem;" onclick="app.archiveWorkerFromWorktime('${r.name}')">アーカイブ</button>`)}
                            </td>
                        </tr>
                        `;
                    }).join('') || '<tr><td colspan="14" style="text-align:center; padding:40px; color:var(--text-light);">この期間の作業記録がありません</td></tr>'}
                </tbody>
        `;
        container.appendChild(table);
    }

    renderWorkTimeTrend() {
        const card = document.getElementById('worktime-trend-card');
        const canvas = document.getElementById('worktime-trend-chart');
        if (!card || !canvas) return;
        
        card.style.display = 'block';
        const ctx = canvas.getContext('2d');
        const machines = store.getMachines(true);

        // Register plugin for labels (required for trend chart as well)
        if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
        
        // 直近12ヶ月の枠組み作成
        const months = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                label: `${d.getFullYear()}/${d.getMonth() + 1}`,
                year: d.getFullYear(),
                month: d.getMonth(),
                pt: 0, st: 0, np: 0, dt: 0
            });
        }
        
        let history = store.getHistory({});
        const lineVal = document.getElementById('worktime-filter-line')?.value || 'all';
        if (lineVal !== 'all') {
            history = history.filter(h => {
                const m = machines.find(x => x.id === h.machineId);
                const l = h.lineNo || m?.lineNo;
                return String(l) === String(lineVal);
            });
        }
        if (this.workTimeSearchQuery) {
            const q = this.workTimeSearchQuery.toLowerCase();
            if (this.workTimeGroupBy === 'category') {
                history = history.filter(h => {
                    const m = machines.find(x => x.id === h.machineId);
                    const cat = (m && m.category) ? m.category : (h.machineCategory || 'その他');
                    return cat.toLowerCase().includes(q);
                });
            } else {
                history = history.filter(h => (h.workers || []).some(w => w.trim().toLowerCase().includes(q)));
            }
        }
        
        if (this.excludePeriodicInTrend) {
            history = history.filter(h => !h.taskId);
        }

        const isDrilledDownTrend = !!this.workTimeDrillDownCategory;
        const currentGroupBy = this.workTimeGroupBy || 'worker';
        const datasets = [];
        
        const trendTitle = document.getElementById('worktime-trend-title');
        if (trendTitle) {
            trendTitle.style.display = 'flex';
            trendTitle.style.justifyContent = 'space-between';
            trendTitle.style.alignItems = 'center';
            trendTitle.innerHTML = `
                <div style="display:flex; align-items:center; gap:20px;">
                    <div><i class="fa-solid fa-chart-line"></i> ${isDrilledDownTrend ? `<span style="color:var(--primary)">${this.workTimeDrillDownCategory} 内の</span>機械別 作業時間推移` : '月別作業時間の推移 (過去12ヶ月)'}</div>
                    <label style="display:inline-flex; align-items:center; gap:6px; font-size:0.75rem; color:var(--text-light); font-weight:700; cursor:pointer; background:var(--background); padding:4px 10px; border-radius:12px; border:1px solid var(--border);">
                        <input type="checkbox" id="trend-exclude-periodic" ${this.excludePeriodicInTrend ? 'checked' : ''} onchange="app.excludePeriodicInTrend=this.checked; app.renderWorkTimeTrend()">
                        定期メンテを除外
                    </label>
                </div>
                ${isDrilledDownTrend ? `<button class="secondary-btn" style="padding:4px 10px; font-size:0.7rem; font-weight:800; background:white; color:var(--primary); border-color:var(--primary); border-radius:4px; height:auto; margin-bottom:5px;" onclick="app.workTimeDrillDownCategory=null; app.renderWorkTime();"><i class="fa-solid fa-arrow-left"></i> 全体へ戻る</button>` : ''}
            `;
        }

        if (currentGroupBy === 'worker') {
            if (isDrilledDownTrend) {
                // ドリルダウン中 (詳細な内容別)
                const detailMap = {};
                const sel = (this.workTimeDrillDownCategory || '').trim();
                
                history.forEach(h => {
                    const isPt = !!h.taskId;
                    const isDt = !!h.isDokatei;
                    const isNp = !isPt && !isDt && !!h.isNonProductionStop;
                    const isSt = !isPt && !isDt && !isNp;
                    
                    // フィルタリング (クリックされた種別に絞る)
                    if (sel === '定期メンテ' && !isPt) return;
                    if (sel === '突発対応' && !isSt) return;
                    if (sel === '非生産停止' && !isNp) return;
                    if (sel === 'ドカ停' && !isDt) return;
                    
                    // それ以外の名前（詳細な作業名など）がセットされている場合
                    // または想定外の名前の場合は、その種別のデータがないためフィルタで落とされる
                    if (sel !== '定期メンテ' && sel !== '突発対応' && sel !== '非生産停止' && sel !== 'ドカ停') {
                        // 種別名以外でドリルダウンされている場合は解除
                        return;
                    }

                    const title = this.getHistoryDisplayText(h);
                    if (!detailMap[title]) detailMap[title] = months.map(() => 0);
                    
                    const d = new Date(h.date);
                    const time = parseInt(h.workTime) || 0;
                    const mIdx = months.findIndex(m => m.year === d.getFullYear() && m.month === d.getMonth());
                    if (mIdx !== -1) detailMap[title][mIdx] += time;
                });

                const sortedDetails = Object.entries(detailMap).sort((a,b) => b[1].reduce((s,v)=>s+v,0) - a[1].reduce((s,v)=>s+v,0));
                const topDetails = sortedDetails.slice(0, 5);
                const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#6366f1'];
                topDetails.forEach(([label, data], i) => {
                    datasets.push({ label, data, borderColor: colors[i % colors.length], backgroundColor: 'transparent', borderWidth: 2, tension: 0.3 });
                });

                // もしデータが一件もない（変なラベルでドリルダウンされた）場合は強制リセット
                if (datasets.length === 0) {
                    setTimeout(() => { this.workTimeDrillDownCategory = null; this.renderWorkTime(); }, 0);
                }
            } else {
                // 通常時 (タイプ別)
                history.forEach(h => {
                    const d = new Date(h.date);
                    const time = parseInt(h.workTime) || 0;
                    const target = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
                    if (target) {
                        if (h.taskId) target.pt += time;
                        else if (h.isDokatei) target.dt += time;
                        else if (h.isNonProductionStop) target.np += time;
                        else target.st += time;
                    }
                });
                if (!this.excludePeriodicInTrend) {
                    datasets.push({ label: '定期メンテ', data: months.map(m => m.pt), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3 });
                }
                datasets.push(
                    { label: '突発対応', data: months.map(m => m.st), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3 },
                    { label: '非生産停止', data: months.map(m => m.np), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: true, tension: 0.3 },
                    { label: 'ドカ停', data: months.map(m => m.dt), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3 }
                );
            }
        } else {
            // 装置区分別 または ドリルダウン(機器別)
            const labelMap = {};
            history.forEach(h => {
                const m = machines.find(x => x.id === h.machineId);
                const cat = (m && m.category) ? m.category : (h.machineCategory || 'その他');
                
                let key = '';
                if (isDrilledDownTrend) {
                    if (cat !== this.workTimeDrillDownCategory) return;
                    key = m ? `${m.name} [${m.model}]` : '不明';
                } else {
                    key = cat;
                }

                if (!labelMap[key]) labelMap[key] = months.map(() => 0);
                
                const d = new Date(h.date);
                const time = parseInt(h.workTime) || 0;
                const mIdx = months.findIndex(m => m.year === d.getFullYear() && m.month === d.getMonth());
                if (mIdx !== -1) labelMap[key][mIdx] += time;
            });

            // 上位 5 つの項目 + その他 に絞る
            const sortedLabels = Object.entries(labelMap).sort((a,b) => b[1].reduce((s,v)=>s+v,0) - a[1].reduce((s,v)=>s+v,0));
            const topLabels = sortedLabels.slice(0, 5);
            
            const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#6366f1'];
            topLabels.forEach(([label, data], i) => {
                datasets.push({
                    label: label,
                    data: data,
                    borderColor: colors[i % colors.length],
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3
                });
            });
        }
        
        if (this._trendChart) this._trendChart.destroy();

        // 最大値を取得して左右の軸を同期させる
        const allDataValues = datasets.flatMap(d => d.data);
        const peak = Math.max(...allDataValues, 10);
        const yMax = Math.ceil((peak * 1.1) / 20) * 20;
        
        this._trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months.map(m => m.label),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    const groupMode = this.workTimeGroupBy || 'worker';

                    // 既にドリルダウン中の場合：再クリックで解除
                    if (this.workTimeDrillDownCategory) {
                        this.workTimeDrillDownCategory = null;
                        this.renderWorkTime();
                        return;
                    }

                    const activePoints = this._trendChart.getElementsAtEventForMode(evt, 'nearest', { intersect: false }, true);
                    if (activePoints.length > 0) {
                        const dsIdx = activePoints[0].datasetIndex;
                        const label = this._trendChart.data.datasets[dsIdx].label;
                        if (label) {
                            this.workTimeDrillDownCategory = label;
                            this.renderWorkTime();
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { 
                        position: 'left',
                        beginAtZero: true,
                        min: 0,
                        max: yMax,
                        title: { display: true, text: '作業時間 (分)', font: { weight: '800' } }
                    },
                    yR: {
                        position: 'right',
                        beginAtZero: true,
                        min: 0,
                        max: yMax,
                        grid: { display: false },
                        title: { display: true, text: '作業時間 (分)', font: { weight: '800' } }
                    }
                },
                plugins: {
                    legend: { 
                        position: 'top', 
                        labels: { boxWidth: 12, font: { weight: '700', size: 11 }, cursor: 'pointer' },
                        onClick: (e, legendItem, legend) => {
                            const groupMode = this.workTimeGroupBy || 'worker';
                            if (this.workTimeDrillDownCategory) {
                                // 既に詳細表示中の場合、凡例クリックで全体の表示に戻す
                                this.workTimeDrillDownCategory = null;
                            } else {
                                // 全体表示中の場合、選択した項目でドリルダウン
                                this.workTimeDrillDownCategory = legendItem.text;
                            }
                            this.renderWorkTime();
                        }
                    },
                    datalabels: {
                        anchor: 'center',
                        align: 'top',
                        offset: (ctx) => {
                            const lastIdx = ctx.dataset.data.length - 1;
                            if (ctx.dataIndex === lastIdx || ctx.dataIndex === lastIdx - 1) {
                                const val = ctx.dataset.data[ctx.dataIndex];
                                if (val <= 0) return 4;
                                const allValsAtIdx = ctx.chart.data.datasets
                                    .map((ds, i) => ({ val: ds.data[ctx.dataIndex], dsIndex: i }))
                                    .filter(item => item.val > 0)
                                    .sort((a, b) => (a.val - b.val) || (a.dsIndex - b.dsIndex));
                                const rank = allValsAtIdx.findIndex(item => item.dsIndex === ctx.datasetIndex);
                                return 4 + (rank * 12);
                            }
                            return 4;
                        },
                        clip: false,
                        formatter: (val, ctx) => {
                            const lastIdx = ctx.dataset.data.length - 1;
                            if ((ctx.dataIndex === lastIdx || ctx.dataIndex === lastIdx - 1) && val > 0) {
                                return ctx.dataset.label;
                            }
                            return null;
                        },
                        font: { weight: '800', size: 10 },
                        color: (ctx) => ctx.dataset.borderColor,
                        textStrokeColor: 'rgba(255,255,255,0.8)',
                        textStrokeWidth: 2
                    },
                    tooltip: { position: 'nearest', mode: 'index', intersect: false }
                }
            }
        });
    }

    openWorkTimeGraph() {
        const period = document.getElementById('worktime-filter-period')?.value || 'this_month';
        let history = store.getHistory({});
        history = this.filterHistoryByPeriod(history, period);
        
        // 人名フィルタが行われている場合、その人を含む履歴のみに絞り込む
        if (this.workTimeSearchQuery) {
            history = history.filter(h => (h.workers || []).some(w => w.trim().toLowerCase().includes(this.workTimeSearchQuery)));
        }

        const ptData = history.filter(h => !!h.taskId);
        const stData = history.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop);
        const npData = history.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop);
        const dtData = history.filter(h => !!h.isDokatei);

        const ptTime = ptData.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const stTime = stData.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const npTime = npData.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const dtTime = dtData.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
        const total = ptTime + stTime + npTime + dtTime;

        if (total === 0) return alert('この期間のデータがありません');

        const machines = store.getMachines(true);
        const isCatMode = this.workTimeGroupBy === 'category';
        const isDrilledDown = !!this.workTimeDrillDownCategory;

        const getBreakdown = (list) => {
            const map = {};
            list.forEach(h => {
                const m = machines.find(x => x.id === h.machineId);
                const mCat = h.machineCategory || m?.category || 'その他';
                
                // Filter if drilled down
                if (isDrilledDown && mCat !== this.workTimeDrillDownCategory) return;
                
                const mName = m ? m.name : '不明';
                
                let label = '';
                if (isDrilledDown) {
                    label = mName;
                } else if (isCatMode) {
                    label = mCat;
                } else {
                    const task = this.getHistoryDisplayText(h);
                    label = `${h.date} [${mName}] ${task.length > 20 ? task.substring(0,20)+'...' : task}`;
                }

                if (!map[label]) map[label] = { time: 0, workers: new Set(), troubles: {} };
                map[label].time += (parseInt(h.workTime) || 0);
                (h.workers || []).forEach(w => map[label].workers.add(w.trim()));
                
                // トラブル内容（作業内容）を集計
                const taskContent = this.getHistoryDisplayText(h);
                map[label].troubles[taskContent] = (map[label].troubles[taskContent] || 0) + (parseInt(h.workTime) || 0);
            });
            return Object.entries(map).map(([label, info]) => {
                const topTroubles = Object.entries(info.troubles)
                    .sort((a,b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(x => x[0]);

                return {
                    label,
                    time: info.time,
                    workers: Array.from(info.workers).filter(Boolean).sort().join('、'),
                    topTroubles: topTroubles.join(' / ')
                };
            }).filter(x => x.time > 0).sort((a,b) => b.time - a.time).slice(0, 15);
        };

        const ptBreakdown = getBreakdown(ptData);
        const stBreakdown = getBreakdown(stData);
        const npBreakdown = getBreakdown(npData);
        const dtBreakdown = getBreakdown(dtData);

        const periodMap = { 'this_month': '今月', 'fiscal_year': '今年度', 'all': '累計', 'custom': '指定日以降' };
        let periodDisplay = periodMap[period] || period;
        if (period === 'custom') {
            const customDate = localStorage.getItem('customStartDate');
            if (customDate) periodDisplay = `${customDate}以降`;
        }

        this._currentGraphData = {
            total: { ptTime, stTime, npTime, dtTime },
            pt: ptBreakdown,
            st: stBreakdown,
            np: npBreakdown,
            dt: dtBreakdown,
            period: periodDisplay
        };

        this.openModal('worktime-chart-grid', `${isDrilledDown ? `${this.workTimeDrillDownCategory} 内の機器別集計` : '作業時間・内容の内訳'}（${periodDisplay}）`, () => {
            const body = document.getElementById('modal-content');
            document.getElementById('modal-container').style.maxWidth = '950px';

            body.innerHTML = `
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:30px; padding:10px;">
                    <!-- 1. Total Composition -->
                    <div style="background:var(--background); padding:16px; border-radius:12px; border:1px solid var(--border);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-weight:900; font-size:0.9rem; color:var(--text-main);"><i class="fa-solid fa-chart-pie"></i> 全体構成</div>
                            <div style="font-size:0.8rem; font-weight:900; color:var(--text-light); background:#f1f5f9; padding:2px 10px; border-radius:99px;">合計 ${total} 分</div>
                        </div>
                        <div style="height:220px;"><canvas id="chart-total"></canvas></div>
                    </div>
                    <!-- 2. Periodic Details -->
                    <div style="background:var(--background); padding:16px; border-radius:12px; border:1px solid var(--border);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-weight:900; font-size:0.9rem; color:#1e40af;"><i class="fa-solid fa-calendar-check"></i> 定期メンテ 内訳</div>
                            <div style="font-size:0.8rem; font-weight:900; color:#1e40af; background:#eff6ff; padding:2px 10px; border-radius:99px;">合計 ${ptTime} 分</div>
                        </div>
                        <div style="height:220px;"><canvas id="chart-pt"></canvas></div>
                    </div>
                    <!-- 3. Sudden Response Details -->
                     <div style="background:var(--background); padding:16px; border-radius:12px; border:1px solid var(--border);">
                         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                             <div style="font-weight:900; font-size:0.9rem; color:#166534;"><i class="fa-solid fa-bolt"></i> 突発対応 内訳</div>
                             <div style="font-size:0.8rem; font-weight:900; color:#166534; background:#f0fdf4; padding:2px 10px; border-radius:99px;">合計 ${stTime} 分</div>
                         </div>
                         <div style="height:220px;"><canvas id="chart-st"></canvas></div>
                     </div>
                     <!-- 4. Non-production-stop Details -->
                     <div style="background:var(--background); padding:16px; border-radius:12px; border:1px solid var(--border);">
                         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                             <div style="font-weight:900; font-size:0.9rem; color:#92400e;"><i class="fa-solid fa-circle-pause"></i> 非生産停止 内訳</div>
                             <div style="font-size:0.8rem; font-weight:900; color:#92400e; background:#fffbeb; padding:2px 10px; border-radius:99px;">合計 ${npTime} 分</div>
                         </div>
                         <div style="height:220px;"><canvas id="chart-np"></canvas></div>
                     </div>
                     <!-- 5. Dokatei Details -->
                    <div style="background:var(--background); padding:16px; border-radius:12px; border:1px solid var(--border);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="font-weight:900; font-size:0.9rem; color:#b91c1c;"><i class="fa-solid fa-triangle-exclamation"></i> ドカ停 原因内訳</div>
                            <div style="font-size:0.8rem; font-weight:900; color:#b91c1c; background:#fef2f2; padding:2px 10px; border-radius:99px;">合計 ${dtTime} 分</div>
                        </div>
                        <div style="height:220px;"><canvas id="chart-dt"></canvas></div>
                    </div>
                </div>
                <div style="margin-top:20px; padding:12px; background:#f8fafc; border-radius:8px; font-size:0.8rem; color:var(--text-light); line-height:1.6;">
                    <i class="fa-solid fa-info-circle" style="color:var(--primary);"></i> 各項目にマウスを合わせると、作業者名を含む詳細内訳が見れます。パーセンテージは常に表示されます。
                </div>
            `;

            const commonOptions = {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (evt, elements) => {
                    if (isCatMode && !isDrilledDown && elements && elements.length > 0) {
                        const index = elements[0].index;
                        // ctx inside onClick is various things... use instance
                        // This might be tricky if not careful.
                        // Let's use the labels from the specific chart context if available, 
                        // or just rely on items being available in the sub-chart creation.
                    }
                },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: '#fff',
                        font: { weight: '800', size: 11 },
                        formatter: (val, ctx) => {
                            const totalTime = ctx.dataset.data.reduce((a,b)=>a+b,0);
                            const pct = ((val / totalTime) * 100).toFixed(1);
                            if (pct < 4) return ''; // 面積が小さい場合は非表示

                            // 全体構成グラフはパーセンテージのみ（今のまま）
                            if (ctx.chart.canvas.id === 'chart-total') return `${pct}%`;
                            
                            const label = ctx.chart.data.labels[ctx.dataIndex];
                            if (isCatMode) {
                                // 装置区分別：区分名 ＋ ％
                                const shortLabel = label.length > 8 ? label.substring(0, 8) + '..' : label;
                                return `${shortLabel}\n${pct}%`;
                            } else {
                                // 作業者別： 日付 (MM/DD) ＋ ％
                                // labelは "YYYY-MM-DD [機械] 内容..." という形式を想定
                                const datePart = label.substring(5, 10).replace('-', '/'); // "MM/DD"
                                return `${datePart}\n(${pct}%)`;
                            }
                        },
                        textStrokeColor: 'rgba(0,0,0,0.5)',
                        textStrokeWidth: 1,
                    },
                    tooltip: {
                        padding: 12,
                        titleFont: { size: 13, weight: '800' },
                        bodyFont: { size: 12 },
                        backgroundColor: 'rgba(255, 255, 255, 0.96)',
                        titleColor: '#1e293b',
                        bodyColor: '#475569',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => `時間: ${ctx.parsed} 分`,
                        }
                    }
                }
            };

            // Register plugin for labels
            Chart.register(ChartDataLabels);

            // 1. Total Chart
            this._charts = {};
            this._charts.total = new Chart(document.getElementById('chart-total'), {
                type: 'doughnut',
                data: {
                    labels: ['定期メンテ', '突発対応', '非生産停止', 'ドカ停'],
                    datasets: [{
                        data: [ptTime, stTime, npTime, dtTime],
                        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 1
                    }]
                },
                options: { 
                    ...commonOptions, 
                    plugins: { 
                        ...commonOptions.plugins, 
                        legend: { display: true, position: 'right', labels: { boxWidth: 12, font: { size: 11, weight: '700' } } } 
                    } 
                }
            });

            // Helper to build breakdown Tooltip
            const createBreakdownTooltip = (breakdownArray) => ({
                ...commonOptions.plugins.tooltip,
                callbacks: {
                    label: (ctx) => `時間: ${ctx.parsed} 分 (${((ctx.parsed / ctx.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%)`,
                    afterBody: (ctx) => {
                        const item = breakdownArray[ctx[0].dataIndex];
                        if (isCatMode) {
                            return `\n主な内容:\n・${(item.topTroubles || '-').split(' / ').join('\n・')}`;
                        } else {
                            return `\n担当者: ${item.workers || '-'}`;
                        }
                    }
                }
            });

            // 2. Periodic Chart
            this._charts.pt = new Chart(document.getElementById('chart-pt'), {
                type: 'pie',
                data: {
                    labels: ptBreakdown.map(x => x.label),
                    datasets: [{
                        data: ptBreakdown.map(x => x.time),
                        backgroundColor: ptBreakdown.map((_, i) => `hsl(217, 80%, ${45 + i*5}%)`),
                        borderWidth: 1
                    }]
                },
                options: { ...commonOptions, plugins: { ...commonOptions.plugins, tooltip: createBreakdownTooltip(ptBreakdown) } }
            });

            // 3. Sudden Chart
            this._charts.st = new Chart(document.getElementById('chart-st'), {
                type: 'pie',
                data: {
                    labels: stBreakdown.map(x => x.label),
                    datasets: [{
                        data: stBreakdown.map(x => x.time),
                        backgroundColor: stBreakdown.map((_, i) => `hsl(142, 70%, ${35 + i*5}%)`),
                        borderWidth: 1
                    }]
                },
                options: { ...commonOptions, plugins: { ...commonOptions.plugins, tooltip: createBreakdownTooltip(stBreakdown) } }
            });

            // 4. Non-production-stop Chart
            this._charts.np = new Chart(document.getElementById('chart-np'), {
                type: 'pie',
                data: {
                    labels: npBreakdown.map(x => x.label),
                    datasets: [{
                        data: npBreakdown.map(x => x.time),
                        backgroundColor: npBreakdown.map((_, i) => `hsl(38, 85%, ${45 + i*5}%)`),
                        borderWidth: 1
                    }]
                },
                options: { ...commonOptions, plugins: { ...commonOptions.plugins, tooltip: createBreakdownTooltip(npBreakdown) } }
            });

            // 4. Dokatei Chart
            this._charts.dt = new Chart(document.getElementById('chart-dt'), {
                type: 'pie',
                data: {
                    labels: dtBreakdown.map(x => x.label),
                    datasets: [{
                        data: dtBreakdown.map(x => x.time),
                        backgroundColor: dtBreakdown.map((_, i) => `hsl(0, 80%, ${45 + i*5}%)`),
                        borderWidth: 1
                    }]
                },
                options: { ...commonOptions, plugins: { ...commonOptions.plugins, tooltip: createBreakdownTooltip(dtBreakdown) } }
            });

            // Override footer to add PRINT button
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `
                    <button class="secondary-btn" style="margin-right:auto;" onclick="app.printWorkTimeGraph()">
                        <i class="fa-solid fa-print"></i> 印刷する
                    </button>
                    ${isDrilledDown ? `
                        <button class="secondary-btn" style="margin-right:12px;" onclick="app.workTimeDrillDownCategory=null; app.openWorkTimeGraph();">
                            <i class="fa-solid fa-arrow-left"></i> 全体に戻る
                        </button>
                    ` : ''}
                    <button class="primary-btn" onclick="app.closeModal()">閉じる</button>
                `;
            }
        });
    }

    printWorkTimeGraph() {
        if (!this._currentGraphData) return;
        const d = this._currentGraphData;
        const isCatMode = this.workTimeGroupBy === 'category';

        // Capture Charts as Images
        const imgTotal = this._charts.total.toBase64Image();
        const imgPt = this._charts.pt.toBase64Image();
        const imgSt = this._charts.st.toBase64Image();
        const imgNp = this._charts.np?.toBase64Image();
        const imgDt = this._charts.dt.toBase64Image();

        const buildTable = (title, list, color, totalCategoryTime) => {
            return `
                <div style="margin-top:24px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid ${color}; padding-bottom:5px; margin-bottom:8px;">
                        <h3 style="margin:0; font-size:1rem; color:${color};">${title}</h3>
                        <div style="font-weight:900; font-size:0.9rem; color:${color};">合計 ${totalCategoryTime} 分</div>
                    </div>
                    <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
                        <thead>
                            <tr style="background:#f8fafc; text-align:left;">
                                <th style="border:1px solid #e2e8f0; padding:8px;">${isCatMode ? '装置区分名' : '項目 (対象機械 / 内容)'}</th>
                                <th style="border:1px solid #e2e8f0; padding:8px; text-align:right;">時間</th>
                                <th style="border:1px solid #e2e8f0; padding:8px; text-align:right;">％</th>
                                <th style="border:1px solid #e2e8f0; padding:8px;">${isCatMode ? 'トラブル内容 (上位3件)' : '担当者'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.map(x => `
                                <tr>
                                    <td style="border:1px solid #e2e8f0; padding:8px;">${x.label}</td>
                                    <td style="border:1px solid #e2e8f0; padding:8px; text-align:right; font-weight:700;">${x.time}分</td>
                                    <td style="border:1px solid #e2e8f0; padding:8px; text-align:right;">${((x.time/totalCategoryTime)*100).toFixed(1)}%</td>
                                    <td style="border:1px solid #e2e8f0; padding:8px;">${isCatMode ? (x.topTroubles || '-') : (x.workers || '-')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        };

        const printWin = window.open('', '_blank');
        const overallTotal = d.total.ptTime + d.total.stTime + (d.total.npTime || 0) + d.total.dtTime;
        
        printWin.document.write(`
            <html>
                <head>
                    <title>作業時間分析レポート - ${d.period}</title>
                    <style>
                        body { font-family: "Noto Sans JP", sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                        h1 { font-size: 1.6rem; border-bottom: 3px solid #1e293b; padding-bottom: 10px; margin-bottom: 15px; }
                        .period-badge { display: inline-block; background: #f1f5f9; padding: 6px 16px; border-radius: 99px; font-size: 0.9rem; font-weight: 800; border: 1px solid #e2e8f0; }
                        .overall-total { float: right; font-size: 1.2rem; font-weight: 900; color: #1e293b; }
                        .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-top: 30px; }
                        .chart-item { border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; text-align: center; background: #fff; }
                        .chart-item img { max-width: 100%; height: auto; max-height: 220px; }
                        .chart-title { font-size: 0.85rem; font-weight: 800; margin-bottom: 10px; color: #64748b; display: flex; justify-content: space-between; }
                        @media print { .no-print { display:none; } @page { margin: 1.5cm; } }
                    </style>
                </head>
                <body>
                    <div class="no-print" style="margin-bottom:30px;">
                        <button onclick="window.print()" style="padding:12px 24px; cursor:pointer; font-weight:800; background:#1e293b; color:white; border:none; border-radius:8px;">印刷を実行する</button>
                    </div>
                    <div class="overall-total">総作業時間: ${overallTotal} 分</div>
                    <h1>作業時間・内容の内訳レポート</h1>
                    <div class="period-badge">集計期間: ${d.period}</div>

                    <div class="chart-grid">
                        <div class="chart-item">
                            <div class="chart-title"><span>全体構成</span> <span>合計 ${overallTotal}分</span></div>
                            <img src="${imgTotal}">
                        </div>
                        <div class="chart-item">
                            <div class="chart-title"><span style="color:#1e40af;">定期メンテ内訳</span> <span style="color:#1e40af;">合計 ${d.total.ptTime}分</span></div>
                            <img src="${imgPt}">
                        </div>
                        <div class="chart-item">
                            <div class="chart-title"><span style="color:#166534;">突発対応内訳</span> <span style="color:#166534;">合計 ${d.total.stTime}分</span></div>
                            <img src="${imgSt}">
                        </div>
                        <div class="chart-item">
                            <div class="chart-title"><span style="color:#92400e;">非生産停止内訳</span> <span style="color:#92400e;">合計 ${d.total.npTime || 0}分</span></div>
                            <img src="${imgNp || ''}">
                        </div>
                        <div class="chart-item">
                            <div class="chart-title"><span style="color:#b91c1c;">ドカ停原因内訳</span> <span style="color:#b91c1c;">合計 ${d.total.dtTime}分</span></div>
                            <img src="${imgDt}">
                        </div>
                    </div>

                    ${buildTable('定期メンテナンス 詳細内訳', d.pt, '#1e40af', d.total.ptTime)}
                    ${buildTable('突発不具合対応 詳細内訳', d.st, '#166534', d.total.stTime)}
                    ${buildTable('非生産停止トラブル 詳細内訳', d.np || [], '#92400e', d.total.npTime || 0)}
                    ${buildTable('ドカ停（重大故障）詳細内訳', d.dt, '#b91c1c', d.total.dtTime)}

                    <div style="margin-top:40px; padding-top:20px; border-top:1px solid #e2e8f0; font-size:0.75rem; color:#94a3b8; text-align:right;">
                        出力日時: ${new Date().toLocaleString()} | 工場保全管理システム Maintenance Next
                    </div>
                </body>
            </html>
        `);
        printWin.document.close();
    }

    archiveWorkerFromWorktime(name) {
        if (confirm(`${name}さんをアーカイブしますか？\n（スキルマップに表示されなくなります。過去の作業実績は「旧作業者合計」に含まれます）`)) {
            store.toggleWorkerArchive(name);
            this.renderWorkTime();
        }
    }

    openWorkerMaintenance() {
        const pass = prompt('管理用パスワードを入力してください');
        if (pass === 'glicono1') {
            this.renderWorkerMaintenanceModal();
        } else if (pass !== null) {
            alert('パスワードが違います');
        }
    }

    renderWorkerMaintenanceModal() {
        // Get all workers from history (including archived)
        const history = store.getHistory({});
        const workerSet = new Set();
        history.forEach(h => {
            const wList = Array.isArray(h.workers) ? h.workers : []; // Safety check
            wList.forEach(w => {
                if (typeof w === 'string') workerSet.add(w.trim());
            });
        });
        const allWorkers = Array.from(workerSet).filter(Boolean).sort();

        this.openModal('workers-maint', '管理画面', () => {
            const body = document.getElementById('modal-content');
            if (!body) return;

            body.innerHTML = `
                <div style="padding: 10px;">
                    <p style="font-size:0.85rem; color:var(--text-light); margin-bottom:16px;">
                        退職などでスキルマップから除外したい人を「アーカイブ」へ送ります。<br>
                        アーカイブへ送っても、過去のメンテナンス記録から名前が消えることはありません。
                    </p>
                    </div>

                    <div style="max-height: 300px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                        <table class="data-table" style="margin-bottom:0; width:100%;">
                            <thead>
                                <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                    <th style="padding:10px; border-bottom:1px solid var(--border);">作業員名</th>
                                    <th style="padding:10px; border-bottom:1px solid var(--border);">状態</th>
                                    <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allWorkers.map(w => {
                                    const isArchived = store.isWorkerArchived(w);
                                    return `
                                            <tr>
                                                <td style="font-weight:700;">${w}</td>
                                                <td>
                                                    ${isArchived 
                                                        ? '<span style="color:var(--text-light); font-size:0.75rem;"><i class="fa-solid fa-box-archive"></i> アーカイブ済</span>' 
                                                        : '<span style="color:var(--success); font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> 有効</span>'}
                                                </td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="${isArchived ? 'secondary-btn' : 'danger-btn'}" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleWorkerArchive('${w}')">
                                                        ${isArchived ? '復元' : 'アーカイブ'}
                                                    </button>
                                                    ${isArchived ? `
                                                        <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteWorker('${w.replace(/'/g, "\\'")}')">
                                                            <i class="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    ` : ''}
                                                </td>
                                            </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-industry"></i> アーカイブ済みの装置本体</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">機械名 / 型式</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(() => {
                                        const deletedMachines = store.activeData.machines.filter(m => m.deleted);
                                        if (deletedMachines.length === 0) return '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">アーカイブされた装置はありません</td></tr>';
                                        
                                        return deletedMachines.map(m => `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${m.name} <span style="font-weight:400; color:var(--text-light);">[${m.model || '-'}]</span></td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.restoreMachine('${m.id}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteMachine('${m.id}', '${m.name.replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('');
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-industry"></i> 装置区分（プルダウン項目）の管理</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colspan="3" style="padding:12px; background:var(--background);">
                                            <div style="display:flex; gap:8px;">
                                                <input type="text" id="new-cat-name" placeholder="新しい装置区分を入力" style="flex:1; padding:8px;" onkeydown="if(event.key==='Enter') app.addMachineCategoryAction()">
                                                <button class="primary-btn" style="padding:8px 16px;" onclick="app.addMachineCategoryAction()"><i class="fa-solid fa-plus"></i> 追加</button>
                                            </div>
                                        </td>
                                    </tr>
                                    ${(() => {
                                        const activeCats = store.activeData.machineCategories || [];
                                        const archCats = store.activeData.archivedMachineCategories || [];
                                        const all = [...activeCats.map(c => ({ name: c, archived: false })), ...archCats.map(c => ({ name: c, archived: true }))];
                                        all.sort((a,b) => a.name.localeCompare(b.name, 'ja'));
                                        
                                        if (all.length === 0) return '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-light);">登録されている装置区分はありません</td></tr>';
                                        
                                        return all.map(c => `
                                            <tr>
                                                <td style="font-weight:700;">${c.name}</td>
                                                <td>
                                                    ${c.archived 
                                                        ? '<span style="color:var(--text-light); font-size:0.75rem;"><i class="fa-solid fa-box-archive"></i> アーカイブ済</span>' 
                                                        : '<span style="color:var(--success); font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> 有効</span>'}
                                                </td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="${c.archived ? 'secondary-btn' : 'danger-btn'}" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleMachineCategoryArchive('${c.name.replace(/'/g, "\\'")}', ${c.archived})">
                                                        ${c.archived ? '復元' : 'アーカイブ'}
                                                    </button>
                                                    ${c.archived ? `
                                                        <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteMachineCategory('${c.name.replace(/'/g, "\\'")}')">
                                                            <i class="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    ` : ''}
                                                </td>
                                            </tr>
                                        `).join('');
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-eye-slash"></i> スキルマップから除外中の項目</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">除外中の項目 (作業内容)</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(store.activeData.archivedTasks || []).length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">除外中の項目はありません</td></tr>' : store.activeData.archivedTasks.map(tk => {
                                        const label = tk.split('__')[1] || '不明な作業';
                                        return `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${label}</td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleTaskArchive('${tk}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteTask('${tk}', '${label.replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-box-archive"></i> アーカイブ済みの部品マスター</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">部品名 / 型式</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(store.activeData.archivedParts || []).length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">アーカイブされた部品はありません</td></tr>' : store.activeData.archivedParts.map(key => {
                                        const [name, model] = key.split('::');
                                        return `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${name} <span style="font-weight:400; color:var(--text-light);">[${model || '-'}]</span></td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.togglePartArchive('${name.replace(/'/g, "\\'")}', '${(model || '').replace(/'/g, "\\'")}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeletePart('${name.replace(/'/g, "\\'")}', '${(model || '').replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-box-archive"></i> アーカイブ済みのメンテナンス周期設定</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">機械名 / 内容</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(store.activeData.archivedMaintenanceTasks || []).length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">アーカイブされた周期設定はありません</td></tr>' : store.activeData.archivedMaintenanceTasks.map(id => {
                                        const task = store.activeData.tasks.find(t => t.id === id);
                                        const machine = task ? store.getMachines(true).find(m => m.id === task.machineId) : null;
                                        const label = task ? `${machine ? machine.name : '不明な機械'} / ${task.content}` : `<span style="color:var(--danger);">データ消失 (ID: ${id})</span>`;
                                        return `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${label}</td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleMaintenanceTaskArchive('${id}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteMaintenanceTask('${id}', '${label.replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-file-circle-plus"></i> 単独登録手順書</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">機械名 / 内容</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">状態</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(() => {
                                        const manualGuides = store.activeData.history.filter(h => h.isManualGuide);
                                        if (manualGuides.length === 0) return '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-light);">単独登録された手順書はありません</td></tr>';

                                        return manualGuides.map(h => {
                                            const isCommon = h.machineId === 'COMMON';
                                            const machine = isCommon ? null : store.getMachines(true).find(m => m.id === h.machineId);
                                            const machineLabel = isCommon ? '全般・共通' : (machine ? machine.name : '不明な機械');
                                            const title = this.getHistoryDisplayText(h);
                                            const statusLabel = store.isGuideArchived(h.id)
                                                ? '<span style="color:var(--text-light); font-size:0.75rem;"><i class="fa-solid fa-box-archive"></i> アーカイブ中</span>'
                                                : '<span style="color:var(--success); font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> 表示中</span>';

                                            return `
                                                <tr>
                                                    <td style="font-size:0.8rem; font-weight:700;">
                                                        ${this.escapeHtml(machineLabel)} / ${this.escapeHtml(title)}
                                                        ${h.guideCategory ? `<span style="margin-left:6px; background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; padding:1px 6px; border-radius:3px; font-size:0.65rem; font-weight:900;">${this.escapeHtml(h.guideCategory)}</span>` : ''}
                                                    </td>
                                                    <td>${statusLabel}</td>
                                                    <td style="display:flex; gap:6px;">
                                                        ${h.guide ? `<button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.openGuideModal('${h.id}')">開く</button>` : ''}
                                                        <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleGuideArchive('${h.id}')">
                                                            ${store.isGuideArchived(h.id) ? '復元' : 'アーカイブ'}
                                                        </button>
                                                        <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteGuide('${h.id}', '${title.replace(/'/g, "\\'")}')">
                                                            <i class="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('');
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-box-archive"></i> アーカイブ済みの手順書</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">機械名 / 内容</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(store.activeData.archivedGuides || []).length === 0 ? '<tr><td colspan="2" style="text-align:center; padding:20px; color:var(--text-light);">アーカイブされた手順書はありません</td></tr>' : store.activeData.archivedGuides.map(id => {
                                        const history = store.activeData.history.find(h => h.id === id);
                                        const machine = history ? store.getMachines(true).find(m => m.id === history.machineId) : null;
                                        const title = history ? this.getHistoryDisplayText(history) : `<span style="color:var(--danger);">データ消失 (ID: ${id})</span>`;
                                        const label = history ? `${machine ? machine.name : '不明な機械'} / ${title}` : title;
                                        return `
                                            <tr>
                                                <td style="font-size:0.8rem; font-weight:700;">${label}</td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleGuideArchive('${id}')">
                                                        復元
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteGuide('${id}', '${(title || '').replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style="margin-top:24px;">
                        <h4 style="font-size:0.9rem; margin-bottom:12px; color:var(--text-light);"><i class="fa-solid fa-eye-slash"></i> 非表示にしたサジェスト項目（自動補完）</h4>
                        <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:8px;">
                            <table class="data-table" style="margin-bottom:0; width:100%;">
                                <thead>
                                    <tr style="position: sticky; top: 0; background: var(--surface); z-index: 1;">
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">種別</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">内容</th>
                                        <th style="padding:10px; border-bottom:1px solid var(--border);">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(() => {
                                        const arch = store.activeData.archivedSuggestions || {};
                                        const kinds = { workers: '作業者', cause: '原因', notes: '処置', content: '症状', partName: '部品名' };
                                        const rows = [];
                                        Object.keys(kinds).forEach(k => {
                                            (arch[k] || []).forEach(val => {
                                                rows.push({ kind: k, kindLabel: kinds[k], value: val });
                                            });
                                        });
                                        
                                        if (rows.length === 0) return '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-light);">非表示に設定されたサジェストはありません</td></tr>';
                                        
                                        return rows.map(r => `
                                            <tr>
                                                <td style="font-size:0.75rem; color:var(--text-light);">${r.kindLabel}</td>
                                                <td style="font-size:0.8rem; font-weight:700;">${r.value}</td>
                                                <td style="display:flex; gap:6px;">
                                                    <button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="app.toggleArchivedSuggestion('${r.kind}', '${r.value.replace(/'/g, "\\'")}')">
                                                        表示に戻す
                                                    </button>
                                                    <button class="icon-btn" style="color:var(--danger); padding:4px;" title="完全削除" onclick="app.hardDeleteSuggestion('${r.kind}', '${r.value.replace(/'/g, "\\'")}')">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('');
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            // Custom footer for this modal (override default)
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `<button class="primary-btn" onclick="app.closeModal()">閉じる</button>`;
            }
        });
    }

    toggleWorkerArchive(name) {
        store.toggleWorkerArchive(name);
        this.renderWorkerMaintenanceModal();
        this.renderWorkers();
    }

    toggleTaskArchive(tk) {
        store.toggleTaskArchive(tk);
        this.renderWorkerMaintenanceModal();
        this.renderWorkers();
    }

    toggleArchivedSuggestion(kind, value) {
        store.toggleArchivedSuggestion(kind, value);
        this.renderWorkerMaintenanceModal();
    }

    archivePart(name, model) {
        if (confirm(`部品「${name} [${model}]」をアーカイブしますか？\n（分析画面の一覧から非表示になります。管理画面から復元可能です）`)) {
            store.togglePartArchive(name, model);
            this.renderAnalysis();
        }
    }

    archiveGuide(id, title) {
        if (confirm(`手順書「${title}」をアーカイブしますか？\n（手順書一覧から非表示になります。管理画面から復元可能です）`)) {
            store.toggleGuideArchive(id);
            this.renderGuides();
        }
    }

    archiveMaintenanceTask(id, content) {
        if (confirm(`周期設定「${content}」をアーカイブしますか？\n（メイン画面やカレンダーから非表示になります。管理画面から復元可能です）`)) {
            store.toggleMaintenanceTaskArchive(id);
            this.closeModal(); // Close Machine Edit Modal
            this.renderMachines();
            this.renderCalendar();
        }
    }

    deleteMaintenanceTaskFromMachineModal(id, content, btn) {
        if (!confirm(`周期設定「${content}」を削除しますか？\nアーカイブには送らず、メンテ設定画面から削除します。\n完了済みのカレンダー履歴は残ります。周期0日の未完了予定はカレンダーに残ります。`)) return;

        store.softDeleteMaintenanceTask(id);
        const row = btn?.closest('.task-row');
        if (row) row.remove();
        this.updateDataLists();
        this.renderMachines();
        this.renderCalendar();
    }

    toggleMaintenanceTaskArchive(id) {
        store.toggleMaintenanceTaskArchive(id);
        this.renderWorkerMaintenanceModal();
        this.renderMachines();
        this.renderCalendar();
    }

    toggleGuideArchive(id) {
        store.toggleGuideArchive(id);
        this.renderWorkerMaintenanceModal();
        this.renderGuides();
    }

    togglePartArchive(name, model) {
        store.togglePartArchive(name, model);
        this.renderWorkerMaintenanceModal();
        this.renderAnalysis();
    }

    toggleMachineCategoryArchive(name) {
        store.toggleMachineCategoryArchive(name);
        this.renderWorkerMaintenanceModal(); 
    }

    addMachineCategoryAction() {
        const input = document.getElementById('new-cat-name');
        if (!input || !input.value.trim()) return;
        
        if (store.addMachineCategory(input.value)) {
            input.value = '';
            this.renderWorkerMaintenanceModal();
            this.updateDataLists();
        } else {
            alert('その区分は既に登録されているか、アーカイブされています。');
        }
    }

    // --- Hard Delete Actions (Permanent Deletion) ---
    hardDeleteWorker(name) {
        if (confirm(`作業員「${name}」を完全に削除しますか？\nこの操作は取り消せません。`)) {
            store.hardDeleteWorker(name);
            this.renderWorkerMaintenanceModal();
            this.renderWorkers();
        }
    }

    hardDeleteTask(tk, label) {
        if (confirm(`スキルマップ項目「${label}」を完全に削除しますか？\nこの操作は取り消せません。`)) {
            store.hardDeleteTask(tk);
            this.renderWorkerMaintenanceModal();
            this.renderWorkers();
        }
    }

    hardDeletePart(name, model) {
        if (confirm(`部品「${name} [${model}]」を完全に削除しますか？\nマスターからも削除されます。この操作は取り消せません。`)) {
            store.hardDeletePart(name, model);
            this.renderWorkerMaintenanceModal();
            this.renderAnalysis();
        }
    }

    hardDeleteMaintenanceTask(id, content) {
        if (confirm(`周期設定「${content}」を完全に削除しますか？\n設定データそのものが消去されます。この操作は取り消せません。`)) {
            store.hardDeleteMaintenanceTask(id);
            this.renderWorkerMaintenanceModal();
            this.renderMachines();
            this.renderCalendar();
        }
    }

    hardDeleteGuide(id, title) {
        if (confirm(`手順書「${title}」を完全に削除しますか？\nこの操作は取り消せません。`)) {
            store.hardDeleteGuide(id);
            this.renderWorkerMaintenanceModal();
            this.renderGuides();
        }
    }

    openManualGuideRegistration() {
        const machines = store.getMachines(true);
        this.openModal('manual-guide-init', '手順書の新規登録 (メンテ記録なし)', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div style="padding: 10px;">
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom:8px; font-weight:800;">対象の機械を選択</label>
                        <select id="m-guide-machine" class="form-control" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--border); font-size: 1.05rem; background:#f8fafc;">
                            <option value="">-- 指定なし (全般・共通手順) --</option>
                            ${machines.map(m => `<option value="${m.id}">${this.escapeHtml(m.name)} [${this.escapeHtml(m.model || '-')}]</option>`).join('')}
                        </select>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom: 20px;">
                        <div class="form-group">
                            <label style="display:block; margin-bottom:8px; font-weight:800;">手順の分類 (カテゴリ)</label>
                            <select id="m-guide-category" class="form-control" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border); font-size: 1rem;">
                                <option value="作業手順">作業手順</option>
                                <option value="安全">安全</option>
                                <option value="5S">5S</option>
                                <option value="品質">品質</option>
                                <option value="工具・設備">工具・設備</option>
                                <option value="事務・その他">事務・その他</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label style="display:block; margin-bottom:8px; font-weight:800;">オプション</label>
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; padding:10px; background:#f1f5f9; border-radius:8px; border:1px solid var(--border); font-size:0.85rem;">
                                <input type="checkbox" id="m-guide-hide-skill" style="width:18px; height:18px;">
                                <span>スキルマップに表示しない</span>
                            </label>
                        </div>
                    </div>
                    <div class="form-group" style="margin-bottom: 24px;">
                        <label style="display:block; margin-bottom:8px; font-weight:800;">作業内容・タイトル</label>
                        <input type="text" id="m-guide-title" class="form-control" placeholder="例: 搬送ベルトの交換手順" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border); font-size: 1rem;">
                        <p style="font-size:0.75rem; color:var(--text-light); margin-top:8px;"><i class="fa-solid fa-circle-info"></i> ここで入力した内容が手順書のタイトルになります。</p>
                    </div>
                    <div style="text-align:right; margin-top: 30px;">
                        <button class="primary-btn" style="width:100%; padding:15px; font-size: 1.1rem; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 10px;" onclick="app.submitManualGuideInit()">
                            次へ進んで手順を作成する <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            `;
            
            const saveBtn = document.getElementById('modal-save-btn');
            if (saveBtn) saveBtn.style.display = 'none';
        });
    }

    submitManualGuideInit() {
        const machineId = document.getElementById('m-guide-machine').value;
        const title = document.getElementById('m-guide-title').value.trim();
        const guideCategory = document.getElementById('m-guide-category').value;
        const hideFromSkillMap = document.getElementById('m-guide-hide-skill').checked;
        
        if (!title) return alert('作業内容を入力してください。');

        const finalMachineId = machineId || 'COMMON';
        const newId = store.generateId();
        const date = new Date().toISOString().split('T')[0];
        const newHistory = {
            id: newId,
            machineId: finalMachineId,
            date: date,
            type: 'repair',
            errorContent: title,
            notes: '(手順書登録のために作成された記録)',
            workers: [],
            replacedParts: [],
            isManualGuide: true,
            guideCategory: guideCategory,
            hideFromSkillMap: hideFromSkillMap
        };

        store.activeData.history.push(newHistory);
        store.save();
        
        this.closeModal();
        // 小さなディレイを置いてから手順書編集モーダルを開く
        setTimeout(() => this.openGuideModal(newId), 150);
    }

    hardDeleteMachineCategory(name) {
        if (confirm(`装置区分「${name}」を完全に削除しますか？\nこの操作は取り消せません。`)) {
            store.activeData.archivedMachineCategories = store.activeData.archivedMachineCategories.filter(c => c !== name);
            store.save();
            this.renderWorkerMaintenanceModal();
            this.updateDataLists();
        }
    }

    hardDeleteMachine(id, name) {
        if (confirm(`装置「${name}」を完全に削除しますか？\n装置に関連する周期設定も削除されます（履歴は残ります）。\nこの操作は取り消せません。`)) {
            store.hardDeleteMachine(id);
            this.renderWorkerMaintenanceModal();
            this.renderMachines();
            this.renderCalendar();
        }
    }

    hardDeleteSuggestion(kind, value) {
        if (confirm(`サジェスト項目「${value}」をリストから完全に消去しますか？\n今後再びサジェストの候補に現れるようになります。`)) {
            store.toggleArchivedSuggestion(kind, value); // toggle to remove from archive
            this.renderWorkerMaintenanceModal();
        }
    }

    // --- Persistence Effects ---
    setupSideEffects() {
        const importBtn = document.getElementById('btn-import-trigger');
        const fileInput = document.getElementById('btn-import');
        
        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (store.importFromJSON(event.target.result)) {
                        location.reload();
                    } else {
                        alert('インポートに失敗しました。ファイル形式を確認してください。');
                    }
                };
                reader.readAsText(file);
            });
        }

        const exportBtn = document.getElementById('btn-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const data = store.exportAsJSON();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                // 1. Download timestamped backup (for user record)
                const aBatch = document.createElement('a');
                aBatch.href = url;
                aBatch.download = `maintenance_ALL_backup_${new Date().toISOString().split('T')[0]}.json`;
                aBatch.click();

                // Small delay to ensure browser handles both
                setTimeout(() => {
                    // 2. Download latest.json (for shared use)
                    const aLatest = document.createElement('a');
                    aLatest.href = url;
                    aLatest.download = `latest.json`;
                    aLatest.click();
                    URL.revokeObjectURL(url);
                }, 100);
            });
        }

        // --- Single Dept Export ---
        const exportDeptBtn = document.getElementById('btn-export-dept');
        if (exportDeptBtn) {
            exportDeptBtn.addEventListener('click', () => {
                const deptName = store.data.departments.find(d => d.id === store.data.currentDepartmentId)?.name || 'dept';
                const data = store.exportCurrentDeptAsJSON();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `maintenance_${deptName}_only_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        // --- Single Dept Import ---
        const importDeptTrigger = document.getElementById('btn-import-dept-trigger');
        const fileDeptInput = document.getElementById('btn-import-dept');
        if (importDeptTrigger && fileDeptInput) {
            importDeptTrigger.addEventListener('click', () => fileDeptInput.click());
            fileDeptInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const currentDeptName = store.data.departments.find(d => d.id === store.data.currentDepartmentId)?.name || '不明';
                if (!confirm(`現在開いている「${currentDeptName}」のデータのみを、選択したファイルの内容で上書きしますか？\n他の部署のデータには影響しません。`)) {
                    fileDeptInput.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    const result = store.importToCurrentDeptFromJSON(event.target.result);
                    if (result.success) {
                        alert(`「${currentDeptName}」のデータを更新しました。`);
                        location.reload();
                    } else {
                        alert(result.message);
                    }
                };
                reader.readAsText(file);
                fileDeptInput.value = ''; // reset for next use
            });
        }

        const purgeBtn = document.getElementById('btn-photo-purge');
        if (purgeBtn) {
            purgeBtn.addEventListener('click', () => this.handlePhotoPurge());
        }

        // Worktime Memo Persistence (Per Department)
        const wtMemo = document.getElementById('worktime-memo');
        if (wtMemo) {
            const deptId = store.data.currentDepartmentId || 'default';
            const memoKey = `worktime_memo_${deptId}`;
            wtMemo.value = localStorage.getItem(memoKey) || '';
            wtMemo.addEventListener('input', (e) => {
                localStorage.setItem(memoKey, e.target.value);
            });
        }
    }

    handlePhotoPurge() {
        const pass = prompt('管理パスワードを入力してください:');
        if (pass !== 'glicono1') {
            alert('パスワードが違います。');
            return;
        }

        if (confirm('１年以上前の写真データがすべて消えてしまいますが、本当にパージを実行してよろしいですか？\n※復元はできませんのでバックアップを先に取っておくことを推奨します。')) {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            let count = 0;
            store.activeData.history.forEach(h => {
                const hDate = new Date(h.date);
                if (hDate < oneYearAgo && h.photos && h.photos.length > 0) {
                    h.photos = [];
                    count++;
                }
            });

            if (count > 0) {
                store.save();
                alert(`${count}件の記録から、１年以上前の写真を削除しました。`);
                this.renderCalendar();
            } else {
                alert('１年以上前の写真が見つかりませんでした。データは変更されていません。');
            }
        }
    }

    static toFullWidthUpper(str) {
        if (!str) return '';
        return str.replace(/[A-Za-z0-9]/g, s => String.fromCharCode(s.charCodeAt(0) + 0xFEE0)).toUpperCase();
    }

    static toHalfWidthLower(str) {
        if (!str) return '';
        return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).toLowerCase();
    }

    getMachineCategoryOptions(currentValue = '') {
        const categories = store.getMachineCategories();
        return categories.map(c => `
            <option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>
        `).join('');
    }

    openTroubleComparisonModal() {
        const periodOptions = [
            { id: 'last_30_days', label: '直近 30日間' },
            { id: 'prev_30_days', label: 'その前の 30日間' },
            { id: 'this_month', label: '今月 (1日〜本日)' },
            { id: 'last_month', label: '先月 (全期間)' },
            { id: 'fiscal_year', label: '今年度' },
            { id: 'last_fiscal_year', label: '前年度' },
            { id: 'custom', label: '指定日以降' },
            { id: 'custom_range', label: '指定範囲 (開始〜終了)' }
        ];

        this.openModal('trouble-compare', 'トラブル増減比較分析', () => {
            const content = document.getElementById('modal-content');
            document.getElementById('modal-container').style.maxWidth = '600px';

            content.innerHTML = `
                <div style="padding:15px; background:var(--primary-light); border-radius:10px; border:1px solid var(--primary); margin-bottom:24px; font-size:0.8rem; line-height:1.5; color:var(--primary);">
                    <i class="fa-solid fa-circle-info"></i> 2つの期間における<b>突発対応＋ドカ停</b>の合計時間と件数を比較します。
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom: 24px;">
                    <div class="form-group">
                        <label style="font-weight:800; color:var(--text-light); text-align:center; display:block; margin-bottom:8px;">比較元 (期間A)</label>
                        <select id="compare-period-a" style="border:2px solid #e2e8f0; font-weight:700;">
                            ${periodOptions.map(o => `<option value="${o.id}">${o.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label style="font-weight:800; color:var(--text-light); text-align:center; display:block; margin-bottom:8px;">比較先 (期間B)</label>
                        <select id="compare-period-b" style="border:2px solid var(--primary); font-weight:700;">
                            ${periodOptions.map((o, i) => `<option value="${o.id}" ${i === 1 ? 'selected' : ''}>${o.label}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div id="compare-result-container">
                    <div style="padding:40px; text-align:center; color:var(--text-light); border:2px dashed var(--border); border-radius:12px;">
                        <i class="fa-solid fa-play" style="font-size:1.5rem; margin-bottom:10px; opacity:0.3;"></i><br>
                        期間を選択して「分析実行」を押してください
                    </div>
                </div>
            `;

            // Attach onchange handlers to the comparison dropdowns
            const selA = document.getElementById('compare-period-a');
            const selB = document.getElementById('compare-period-b');
            if (selA) selA.onchange = () => this.onPeriodChange(selA, () => {});
            if (selB) selB.onchange = () => this.onPeriodChange(selB, () => {});
            
            const footer = document.querySelector('.modal-footer');
            if (footer) {
                footer.innerHTML = `
                    <button class="secondary-btn" onclick="app.closeModal()">閉じる</button>
                    <button class="primary-btn" onclick="app.runTroubleComparison()"><i class="fa-solid fa-magnifying-glass-chart"></i> 分析を実行</button>
                `;
            }
        });
    }

    runTroubleComparison() {
        const pA = document.getElementById('compare-period-a').value;
        const pB = document.getElementById('compare-period-b').value;
        const resultDiv = document.getElementById('compare-result-container');
        if (!resultDiv) return;

        const getStats = (period) => {
            const hist = this.filterHistoryByPeriod(store.activeData.history, period);
            const troubles = hist.filter(h => !h.taskId || h.isDokatei);
            const time = troubles.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
            const count = troubles.length;
            return { time, count };
        };

        const statsA = getStats(pA);
        const statsB = getStats(pB);
        const daysA = this.getPeriodDays(pA);
        const daysB = this.getPeriodDays(pB);
        const labelA = this.getPeriodLabel(pA);
        const labelB = this.getPeriodLabel(pB);

        // Calculate Daily Averages for Fair Comparison
        const avgTimeA = statsA.time / daysA;
        const avgTimeB = statsB.time / daysB;
        const avgCountA = statsA.count / daysA;
        const avgCountB = statsB.count / daysB;

        const getDiff = (a, b) => {
            if (a === 0) return b === 0 ? 0 : 100;
            return ((b - a) / a) * 100;
        };

        const diffTime = getDiff(avgTimeA, avgTimeB);
        const diffCount = getDiff(avgCountA, avgCountB);

        const formatBadge = (val) => {
            const isGood = val <= 0;
            const color = isGood ? '#16a34a' : '#dc2626';
            const icon = isGood ? 'fa-arrow-down' : 'fa-arrow-up';
            const sign = val > 0 ? '+' : '';
            return `<span style="color:${color}; font-weight:900; font-size:1.1rem; display:flex; align-items:center; gap:4px;">
                <i class="fa-solid ${icon}"></i> ${sign}${val.toFixed(1)}%
            </span>`;
        };

        resultDiv.innerHTML = `
            <div style="font-size:0.75rem; color:var(--text-light); text-align:center; margin-bottom:15px; padding:8px; background:#f8fafc; border-radius:8px; line-height:1.4;">
                <i class="fa-solid fa-scale-balanced"></i> 期間の長さが異なるため、<b>1日の平均値（時間・回数）</b>に換算して比較しました。<br>
                <span style="opacity:0.8;">(期間A: ${daysA}日間 / 期間B: ${daysB}日間)</span>
            </div>

            <div style="display:grid; grid-template-columns:1fr auto 1fr; gap:10px; align-items:center;">
                <!-- Time Row -->
                <div style="background:#f8fafc; padding:12px; border-radius:12px; border:1px solid #e2e8f0; text-align:center; height:100%;">
                    <div style="font-size:0.65rem; color:var(--primary); font-weight:800; background:#eff6ff; padding:2px 8px; border-radius:99px; display:inline-block; margin-bottom:8px;">${labelA}</div>
                    <div style="font-size:0.75rem; color:var(--text-light); margin-bottom:4px;">期間A 合計</div>
                    <div style="font-size:1.3rem; font-weight:900;">${statsA.time}<span style="font-size:0.8rem;">分</span></div>
                    <div style="font-size:0.65rem; color:var(--text-light); opacity:0.7;">(${avgTimeA.toFixed(1)}分/日)</div>
                </div>
                <div style="text-align:center; color:#cbd5e1;"><i class="fa-solid fa-arrow-right-long"></i></div>
                <div style="background:#fff; padding:12px; border-radius:12px; border:2px solid var(--primary); text-align:center; height:100%;">
                    <div style="font-size:0.65rem; color:white; font-weight:800; background:var(--primary); padding:2px 8px; border-radius:99px; display:inline-block; margin-bottom:8px;">${labelB}</div>
                    <div style="font-size:0.75rem; color:var(--text-light); margin-bottom:4px;">期間B 合計</div>
                    <div style="font-size:1.3rem; font-weight:900; color:var(--primary);">${statsB.time}<span style="font-size:0.8rem;">分</span></div>
                    <div style="font-size:0.65rem; color:var(--primary); opacity:0.8; font-weight:700;">(${avgTimeB.toFixed(1)}分/日)</div>
                    <div style="margin-top:6px; display:flex; justify-content:center;">${formatBadge(diffTime)}</div>
                </div>

                <!-- Count Row -->
                <div style="background:#f8fafc; padding:12px; border-radius:12px; border:1px solid #e2e8f0; text-align:center; margin-top:15px; height:100%;">
                    <div style="font-size:0.65rem; color:var(--primary); font-weight:800; background:#eff6ff; padding:2px 8px; border-radius:99px; display:inline-block; margin-bottom:8px;">${labelA}</div>
                    <div style="font-size:0.75rem; color:var(--text-light); margin-bottom:4px;">期間A 件数</div>
                    <div style="font-size:1.3rem; font-weight:900;">${statsA.count}<span style="font-size:0.8rem;">件</span></div>
                    <div style="font-size:0.65rem; color:var(--text-light); opacity:0.7;">(${avgCountA.toFixed(2)}件/日)</div>
                </div>
                <div style="text-align:center; color:#cbd5e1; margin-top:15px;"><i class="fa-solid fa-arrow-right-long"></i></div>
                <div style="background:#fff; padding:12px; border-radius:12px; border:2px solid var(--primary); text-align:center; margin-top:15px; height:100%;">
                    <div style="font-size:0.65rem; color:white; font-weight:800; background:var(--primary); padding:2px 8px; border-radius:99px; display:inline-block; margin-bottom:8px;">${labelB}</div>
                    <div style="font-size:0.75rem; color:var(--text-light); margin-bottom:4px;">期間B 件数</div>
                    <div style="font-size:1.3rem; font-weight:900; color:var(--primary);">${statsB.count}<span style="font-size:0.8rem;">件</span></div>
                    <div style="font-size:0.65rem; color:var(--primary); opacity:0.8; font-weight:700;">(${avgCountB.toFixed(2)}件/日)</div>
                    <div style="margin-top:6px; display:flex; justify-content:center;">${formatBadge(diffCount)}</div>
                </div>
            </div>

            <div style="margin-top:20px; padding:14px; background:#f0fdf4; border-radius:10px; border:1px solid #bbf7d0; font-size:0.75rem; color:#166534; line-height:1.6;">
                <div style="font-weight:900; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-magnifying-glass-chart"></i> 分析結果の要約 (日平均での比較)
                </div>
                1日あたりの停止時間は <b>${diffTime.toFixed(1)}%</b> ${diffTime <= 0 ? '減少しました！素晴らしい改善傾向です。' : '増加しました。要因の分析が必要です。'}
                1日あたりの平均発生件数は <b>${diffCount.toFixed(1)}%</b> ${diffCount <= 0 ? '減少しました。' : '増加しました。'}<br>
                <span style="font-size:0.65rem; opacity:0.8; margin-top:4px; display:block;">※比較ロジック: それぞれの期間の長さで正規化した「日平均」の変化率を算出しています。</span>
            </div>
        `;
    }

    // --- CSV Export ---
    csvEscape(value) {
        return `"${String(value ?? '').replace(/"/g, '""')}"`;
    }

    parseCSV(text) {
        const rows = [];
        let row = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const next = text[i + 1];

            if (char === '"' && inQuotes && next === '"') {
                current += '"';
                i++;
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(current);
                current = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && next === '\n') i++;
                row.push(current);
                if (row.some(v => String(v).trim() !== '')) rows.push(row);
                row = [];
                current = '';
            } else {
                current += char;
            }
        }

        row.push(current);
        if (row.some(v => String(v).trim() !== '')) rows.push(row);
        return rows;
    }

    getCategoryLabel(category) {
        const labels = {
            machine: '機械',
            electric: '電気',
            adjust: '調整',
            parts: '部品',
            clean: '清掃',
            other: 'その他'
        };
        return labels[category] || 'その他';
    }

    getHistoryTypeInfo(h) {
        if (h.isDokatei) return { key: 'dokatei', label: 'ドカ停', color: 'var(--danger)', chartColor: '#ef4444' };
        if (h.taskId) return { key: 'periodic', label: '定期', color: 'var(--primary)', chartColor: '#3b82f6' };
        if (h.isNonProductionStop) return { key: 'nonProductionStop', label: '非停止', color: '#d97706', chartColor: '#f59e0b' };
        return { key: 'sudden', label: '突発', color: 'var(--success)', chartColor: '#10b981' };
    }

    parseHistoryPartsText(partsText) {
        if (!partsText) return [];
        return String(partsText).split(/\s+\/\s+/).map(item => {
            const text = item.trim();
            if (!text) return null;
            const match = text.match(/^(.*?)(?:\s+\[(.*?)\])?\s*\(([-+]?\d*\.?\d+)\s*([^)]*)\)$/);
            if (!match) return { name: MaintenanceStore.toFullWidth(text), model: '', count: 0, unit: '個', price: 0 };
            return {
                name: MaintenanceStore.toFullWidth(match[1].trim()),
                model: MaintenanceStore.toHalfWidthLower((match[2] || '').trim()),
                count: parseFloat(match[3]) || 0,
                unit: (match[4] || '個').trim() || '個',
                price: 0
            };
        }).filter(Boolean);
    }

    downloadCSV(filename, csvContent) {
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- CSV Import ---
    openHistoryImportModal() {
        this.openModal('history-import', '過去履歴のCSV一括取込', () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = `
                <div style="margin-bottom:20px; font-size:0.85rem; color:var(--text-main); line-height:1.6;">
                    <p>Excel等で作成した過去のメンテナンス記録（CSV形式）を一括で取り込みます。</p>
                    <p style="margin-top:8px; padding:10px; background:#eff6ff; border-radius:6px; border:1px solid #bae6fd;">
                        1. まず下記のボタンから専用の「テンプレート(CSV)」をダウンロードしてください。<br>
                        2. テンプレートの2行目以降にデータを入力し、保存してください。<br>
                        3. 「ファイルを選択」から保存したCSVを読み込ませてください。
                    </p>
                    <button class="secondary-btn" style="margin-top:12px; padding:6px 16px; font-size:0.8rem;" onclick="app.downloadHistoryImportTemplate()"><i class="fa-solid fa-download"></i> テンプレート(CSV)をダウンロード</button>
                </div>
                <div class="form-group" style="border-top:1px dashed var(--border); padding-top:20px;">
                    <label style="font-weight:800; color:var(--primary);">CSVファイルを選択</label>
                    <input type="file" id="hist-csv-upload" accept=".csv" style="margin-top:8px; display:block;">
                </div>
            `;
            const footer = document.querySelector('.modal-footer');
            footer.innerHTML = `
                <button class="secondary-btn" id="modal-cancel">キャンセル</button>
                <button class="primary-btn" onclick="app.processHistoryImportCSV()"><i class="fa-solid fa-cloud-arrow-up"></i> 取り込む</button>
            `;
            document.getElementById('modal-cancel').onclick = () => this.closeModal();
        });
    }

    downloadHistoryImportTemplate() {
        const headers = ["日付(YYYY-MM-DD)", "ライン", "機械名", "型式", "対応種別(突発/非生産停止/定期/ドカ停)", "作業内容(症状)", "原因", "処置内容(備考)", "エラー番号", "作業時間(分)", "作業区分(機械/電気/調整/部品/清掃/その他)", "作業者(カンマ区切り)"];
        const sampleRows = [
            ["2024-03-01", "5号ライン", "メインコンベア", "MC-100", "突発", "ベルトの異音", "経年劣化", "ベルトを調整", "E-01", "30", "機械", "山田, 鈴木"],
            ["2024-03-05", "その他", "サブコンベア", "SC-50", "非生産停止", "センサー警告", "汚れ", "清掃・動作確認", "", "15", "清掃", "田中"]
        ];
        const csvContent = [headers.join(','), ...sampleRows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
        this.downloadCSV(`template_history_import.csv`, csvContent);
    }

    processHistoryImportCSV() {
        const fileInput = document.getElementById('hist-csv-upload');
        if (!fileInput.files.length) return alert("CSVファイルを選択してください。");
        const file = fileInput.files[0];

        const reader = new FileReader();
        reader.onload = async (e) => {
            const rows = this.parseCSV(e.target.result).filter(row => row.some(col => String(col).trim() !== ''));
            if (rows.length <= 1) return alert("データがありません。");

            const headers = rows[0].map(h => String(h).replace(/^\ufeff/, '').trim());
            const findIndex = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));
            const indexMap = {
                date: findIndex(['日付']),
                line: findIndex(['ライン']),
                machine: findIndex(['機械名']),
                model: findIndex(['型式']),
                type: findIndex(['区分', '対応種別']),
                content: findIndex(['作業内容', '内容']),
                cause: findIndex(['原因']),
                notes: findIndex(['処置']),
                errorNo: findIndex(['エラー']),
                time: findIndex(['作業時間']),
                category: findIndex(['作業区分']),
                workers: findIndex(['作業員', '作業者']),
                parts: findIndex(['交換部品'])
            };
            const getCol = (cols, key, fallbackIndex = -1) => {
                const index = indexMap[key] >= 0 ? indexMap[key] : fallbackIndex;
                return index >= 0 ? String(cols[index] || '').trim() : '';
            };
            const normalizeLineNo = (value) => {
                const raw = String(value || '').trim();
                if (!raw) return '';
                if (raw === 'その他' || raw === '他' || raw.toLowerCase() === 'other') return 'other';
                const match = raw.match(/\d+/);
                return match ? match[0] : '';
            };

            const records = [];
            const machines = store.getMachines(true);
            let addedMachines = 0;
            const importKey = (record) => [
                record.date || '',
                record.machineId || '',
                record.taskContent || record.errorContent || record.notes || '',
                String(record.workTime || 0)
            ].map(v => MaintenanceStore.toHalfWidthLower(String(v).trim())).join('__');
            const existingKeys = new Set((store.activeData.history || []).map(importKey));
            const importKeys = new Set();
            let duplicateCount = 0;

            for (let i = 1; i < rows.length; i++) {
                const cols = rows[i];
                if (cols.length < 5) continue;

                const date = getCol(cols, 'date', 0);
                const lineNo = normalizeLineNo(getCol(cols, 'line'));
                const mName = getCol(cols, 'machine', 1);
                const mModel = getCol(cols, 'model', 2);
                const occType = getCol(cols, 'type', 3);
                const content = getCol(cols, 'content', 4);
                const cause = getCol(cols, 'cause', 5);
                const notes = getCol(cols, 'notes', 6);
                const errorNo = getCol(cols, 'errorNo', 7);
                const time = getCol(cols, 'time', 8);
                const categoryName = getCol(cols, 'category', 9);
                const workersStr = getCol(cols, 'workers', 10);
                const partsStr = getCol(cols, 'parts', 11);
                if (!date || !mName) continue;

                let targetMachine = machines.find(m => m.name === mName && (mModel ? m.model === mModel : true));
                if (!targetMachine) {
                    targetMachine = store.addMachine(mName, mModel || '', 'CSV取込で自動登録', '', '', lineNo);
                    machines.push(targetMachine);
                    addedMachines++;
                } else if (lineNo && !targetMachine.lineNo) {
                    targetMachine.lineNo = lineNo;
                }

                let isSudden = false;
                let isDokatei = false;
                const isNonProductionStop = occType.includes("非生産停止") || occType.includes("非停止");
                if (occType.includes("突発") || isNonProductionStop) isSudden = true;
                if (occType.includes("ドカ停")) { isSudden = true; isDokatei = true; }

                const catMap = { '機械': 'machine', '電気': 'electric', '調整': 'adjust', '部品': 'parts', '清掃': 'clean', 'その他': 'other' };
                let category = 'other';
                for (const [k, v] of Object.entries(catMap)) {
                    if (categoryName.includes(k)) { category = v; break; }
                }

                const workers = workersStr ? workersStr.split(/\s*(?:,|，|、|\/)\s*/).map(w => w.trim()).filter(Boolean) : [];
                const replacedParts = this.parseHistoryPartsText(partsStr);
                const record = {
                    id: store.generateId(),
                    machineId: targetMachine.id,
                    date,
                    workTime: parseInt(time) || 0,
                    isSudden,
                    isDokatei,
                    isNonProductionStop: !isDokatei && isNonProductionStop,
                    errorNo: errorNo || '',
                    errorContent: content || '',
                    cause: cause || '',
                    notes: notes || '',
                    category,
                    machineCategory: targetMachine.category || '',
                    lineNo: lineNo || targetMachine.lineNo || '',
                    workers,
                    replacedParts,
                    photos: [],
                    createdAt: new Date().toISOString()
                };

                if (!isSudden) {
                    record.taskContent = content || '定期点検(CSV)';
                    delete record.errorContent;
                }

                const key = importKey(record);
                if (existingKeys.has(key) || importKeys.has(key)) {
                    duplicateCount++;
                    continue;
                }
                importKeys.add(key);
                records.push(record);
            }

            if (records.length === 0) {
                return alert(duplicateCount > 0 ? `すべて重複候補だったため、取り込みはありませんでした。（${duplicateCount}件）` : "取り込めるデータがありませんでした。");
            }
            const duplicateMessage = duplicateCount > 0 ? `\n\n重複候補 ${duplicateCount}件はスキップします。` : '';
            if (confirm(`${records.length}件の履歴（うち新規機械登録: ${addedMachines}件）を取り込みます。よろしいですか？${duplicateMessage}`)) {
                store.activeData.history.push(...records);
                await store.save();
                this.closeModal();
                this.showToast(`${records.length}件の履歴をインポートしました`, 'success');
                this.updateDataLists();
                this.updateHistoryPeriodOptions();
                requestAnimationFrame(() => {
                    this.switchView('history');
                    this.renderHistory();
                    this.renderCalendar();
                });
            }
        };
        reader.readAsText(file, 'utf-8');
    }

    exportHistoryAsCSV() {
        const period = document.getElementById('hist-filter-period')?.value || 'all';
        const machineId = document.getElementById('hist-filter-machine')?.value || '';
        const type = document.getElementById('hist-filter-type')?.value || '';
        const query = document.getElementById('global-search')?.value || '';

        let history = store.getHistory({ machineId, search: query }).filter(h => !h.isManualGuide);
        history = this.filterHistoryByPeriod(history, period);
        if (type) {
            if (type === 'periodic') history = history.filter(h => !!h.taskId);
            else if (type === 'sudden') history = history.filter(h => !h.taskId && !h.isDokatei && !h.isNonProductionStop);
            else if (type === 'nonProductionStop') history = history.filter(h => !h.taskId && !h.isDokatei && h.isNonProductionStop);
            else if (type === 'dokatei') history = history.filter(h => h.isDokatei);
        }

        const headers = ["日付", "ライン", "機械名", "型式", "対応種別", "作業内容(症状)", "原因", "処置内容(備考)", "エラー番号", "作業時間(分)", "作業区分", "作業者", "交換部品"];
        const rows = history.map(h => {
            const m = store.getMachines(true).find(x => x.id === h.machineId);
            const mName = m ? m.name : '不明';
            const mModel = m ? m.model : '';
            const lineLabel = this.getLineLabel(h.lineNo || m?.lineNo || '');
            const typeLabel = h.isDokatei ? 'ドカ停' : (h.taskId ? '定期' : (h.isNonProductionStop ? '非生産停止' : '突発'));
            const displayText = this.getHistoryDisplayText(h);
            const workers = (h.workers || []).join(', ');
            const parts = (h.replacedParts || []).map(p => {
                const count = p.count ?? p.qty ?? 0;
                const unit = p.unit || '個';
                const model = p.model ? ` [${p.model}]` : '';
                return `${p.name || ''}${model} (${count}${unit})`;
            }).join(' / ');

            return [
                h.date,
                lineLabel,
                mName,
                mModel,
                typeLabel,
                displayText,
                h.cause || '',
                (h.notes || '').replace(/\r?\n/g, ' '),
                h.errorNo || '',
                h.workTime || 0,
                this.getCategoryLabel(h.category),
                workers,
                parts
            ].map(v => this.csvEscape(v)).join(',');
        });

        const csvContent = [headers.map(h => this.csvEscape(h)).join(','), ...rows].join('\n');
        this.downloadCSV(`maintenance_history_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
    }

    exportWorkTimeAsCSV() {
        const period = document.getElementById('worktime-filter-period')?.value || 'this_month';
        let history = store.getHistory({});
        history = this.filterHistoryByPeriod(history, period);
        const machines = store.getMachines(true);

        const workerStats = {}; 
        const archivedStats = { name: '旧作業者合計', totalTime: 0, pt: 0, st: 0, np: 0, dt: 0, pc: 0, sc: 0, npc: 0, dc: 0 };
        let totalTimeSum = 0;

        history.forEach(h => {
            const workers = h.workers || [];
            const time = parseInt(h.workTime) || 0;
            const isPeriodic = !!h.taskId;
            workers.forEach(w => {
                const ww = w.trim();
                if (!ww) return;
                totalTimeSum += time;
                const isArchived = store.isWorkerArchived(ww);
                const s = isArchived ? archivedStats : (workerStats[ww] || (workerStats[ww] = { name: ww, totalTime: 0, pt: 0, st: 0, np: 0, dt: 0, pc: 0, sc: 0, npc: 0, dc: 0 }));
                s.totalTime += time;
                if (isPeriodic) { s.pt += time; s.pc++; }
                else if (h.isDokatei) { s.dt += time; s.dc++; }
                else if (h.isNonProductionStop) { s.np += time; s.npc++; }
                else { s.st += time; s.sc++; }
            });
        });

        const stats = Object.values(workerStats).sort((a,b) => b.totalTime - a.totalTime);
        if (archivedStats.totalTime > 0) stats.push(archivedStats);

        const headers = ["作業者", "合計時間(分)", "全体割合(%)", "定期メンテ時間", "定期件数", "突発対応時間", "突発件数", "非生産停止時間", "非生産停止件数", "ドカ停時間", "ドカ停件数"];
        const rows = stats.map(s => {
            const pct = totalTimeSum > 0 ? ((s.totalTime / totalTimeSum) * 100).toFixed(1) : 0;
            return [s.name, s.totalTime, pct, s.pt, s.pc, s.st, s.sc, s.np || 0, s.npc || 0, s.dt, s.dc].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        this.downloadCSV(`worktime_analysis_${period}_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
    }

    exportSkillMapAsCSV() {
        const history = store.getHistory({});
        const machines = store.getMachines(true);
        const workerSet = new Set();
        history.forEach(h => {
            (h.workers || []).forEach(w => { if (typeof w === 'string') workerSet.add(w.trim()); });
        });
        const workers = Array.from(workerSet).filter(Boolean).filter(w => !store.isWorkerArchived(w)).sort();
        const skillEvals = JSON.parse(localStorage.getItem('skillEvaluations') || '{}');
        const manualSkills = JSON.parse(localStorage.getItem('manualSkills') || '[]');
        
        const allTaskMap = {};
        history.forEach(h => {
            const m = machines.find(x => x.id === h.machineId);
            const content = h.taskId ? (store.activeData.tasks.find(t => t.id === h.taskId)?.content || h.taskContent || '定期メンテナンス') : (h.errorContent || h.notes || '突発対応');
            const tk = `${h.machineId}__${content}`;
            if (!allTaskMap[tk]) allTaskMap[tk] = { label: content, machine: m ? m.name : '不明', model: m ? m.model : '' };
        });
        manualSkills.forEach(ms => {
            allTaskMap[ms.id] = { label: ms.label, machine: ms.machine, model: ms.model || '-' };
        });

        let entries = Object.entries(allTaskMap).filter(([tk]) => !store.isTaskArchived(tk));
        
        // Filter by current UI state
        if (this.skillRiskFilter) {
            entries = entries.filter(([tk]) => !workers.some(w => (skillEvals[w] || {})[tk] === '○'));
        } else if (this.skillSoloFilter) {
            entries = entries.filter(([tk]) => workers.filter(w => (skillEvals[w] || {})[tk] === '○').length === 1);
        }
        if (this.skillModelFilter) {
            entries = entries.filter(([,info]) => info.model === this.skillModelFilter);
        }
        if (this.skillSearchQuery) {
            const q = this.skillSearchQuery.toLowerCase();
            entries = entries.filter(([,info]) => `${info.label} ${info.machine} ${info.model}`.toLowerCase().includes(q));
        }

        const headers = ["作業内容", "機械名", "型式", ...workers];
        const rows = entries.map(([tk, info]) => {
            const evals = workers.map(w => (skillEvals[w] || {})[tk] || '-');
            return [info.label, info.machine, info.model, ...evals].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        this.downloadCSV(`skill_map_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
    }

    viewGuideDetails(hId) {
        this.openGuideModal(hId);
    }

    getMachineCategoryOptions(currentValue = '', showAddNew = true) {
        const categories = store.getMachineCategories();
        let html = categories.map(c => `
            <option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>
        `).join('');
        if (showAddNew) {
            html += `<option value="ADD_NEW_CATEGORY">+ 新しい区分を追加</option>`;
        }
        return html;
    }

    /**
     * 各モーダルからの装置区分入力を処理し、必要であれば新規登録を行う共通メソッド
     * @param {string} prefix モーダルのID接頭辞 (例: 'f-', 's-', 'e-')
     * @returns {string} 最終的なカテゴリ名
     */
    getCategoryFromModalInput(prefix) {
        let category = document.getElementById(`${prefix}machine-category`)?.value || '';
        if (category === 'ADD_NEW_CATEGORY') {
            const newCat = MaintenanceApp.toFullWidthUpper(document.getElementById(`${prefix}new-category-input`)?.value || '');
            if (newCat) {
                store.addMachineCategory(newCat);
                category = newCat;
            } else {
                category = 'その他';
            }
        } else {
            category = MaintenanceApp.toFullWidthUpper(category);
        }
        return category;
    }

    toggleNewCategoryField(prefix) {
        const select = document.getElementById(`${prefix}machine-category`);
        const input = document.getElementById(`${prefix}new-category-input`);
        if (select && input) {
            input.style.display = (select.value === 'ADD_NEW_CATEGORY') ? 'block' : 'none';
            if (select.value === 'ADD_NEW_CATEGORY') input.focus();
        }
    }

    setAnalysisMode(mode) {
        this.analysisMode = mode;
        this.costDrillDownCategory = null;
        const btnParts = document.getElementById('btn-analysis-parts');
        const btnMachines = document.getElementById('btn-analysis-machines');
        if (btnParts) btnParts.classList.toggle('active', mode === 'parts');
        if (btnMachines) btnMachines.classList.toggle('active', mode === 'machines');
        
        const rateBox = document.getElementById('cost-labor-rate-box');
        if (rateBox) rateBox.style.display = (mode === 'machines' ? 'flex' : 'none');

        const catFilter = document.getElementById('cost-category-filter');
        if (catFilter) catFilter.style.display = (mode === 'machines' ? 'flex' : 'none');

        const subtitle = document.getElementById('analysis-subtitle');
        if (subtitle) {
            subtitle.textContent = mode === 'parts' 
                ? '交換部品の消費ペースと年間コスト予測' 
                : '装置ごとの年間メンテナンスコスト（部品代＋作業人件費）算出';
        }
        
        this.renderAnalysis();
    }

    setCostFilter(filter) {
        this.costFilter = filter;
        ['all', 'periodic', 'sudden'].forEach(f => {
            const btn = document.getElementById(`btn-cost-${f}`);
            if (btn) btn.classList.toggle('active', f === filter);
        });
        this.renderAnalysis();
    }

    clearCostDrilldown() {
        this.costDrillDownCategory = null;
        this.renderAnalysis();
    }

    toggleSidebarBottom() {
        const container = document.getElementById('sidebar-bottom-container');
        const chevron = document.getElementById('sidebar-bottom-chevron');
        if (container && chevron) {
            const isCollapsed = container.classList.toggle('collapsed');
            chevron.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
            localStorage.setItem('sidebar_bottom_collapsed', isCollapsed);
        }
    }

    toggleSidebarStats() {
        const container = document.getElementById('sidebar-stats-container');
        const chevron = document.getElementById('sidebar-stats-chevron');
        if (container && chevron) {
            const isCollapsed = container.classList.toggle('collapsed');
            chevron.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
            localStorage.setItem('sidebar_stats_collapsed', isCollapsed);
        }
    }

    renderMachineCostAnalysis(history) {
        const container = document.getElementById('analysis-container');
        if (!container) return;

        const machines = store.getMachines(true);
        const costMap = {};

        const isDrilledDown = !!this.costDrillDownCategory;

        history.forEach(h => {
            const m = machines.find(x => x.id === h.machineId);
            const mCat = h.machineCategory || m?.category || '未分類';
            
            // Drill-down filtering
            if (isDrilledDown && mCat !== this.costDrillDownCategory) return;
            
            const key = isDrilledDown ? h.machineId : mCat;
            
            if (!costMap[key]) {
                const subTitle = isDrilledDown ? (m ? m.model : '-') : '区分別計';
                costMap[key] = {
                    id: key,
                    name: isDrilledDown ? (m ? m.name : '削除済みの機械') : mCat,
                    model: subTitle,
                    partsCost: 0,
                    laborCost: 0,
                    totalCost: 0,
                    time: 0,
                    partsUsed: {} // Store { 'name::model': { name, model, count, price } }
                };
            }

            const stats = costMap[key];
            
            // Parts Cost
            if (h.replacedParts) {
                h.replacedParts.forEach(p => {
                    const master = store.getPartMaster(p.name, p.model);
                    const price = parseFloat(p.price) || master?.price || 0;
                    const count = parseFloat(p.count) || 0;
                    const cost = price * count;
                    stats.partsCost += cost;

                    if (count > 0) {
                        const pName = p.name || '不明な部品';
                        const pModel = p.model || '-';
                        const pKey = `${pName}::${pModel}`;
                        if (!stats.partsUsed[pKey]) {
                            stats.partsUsed[pKey] = { name: pName, model: pModel, count: 0, price: price };
                        }
                        stats.partsUsed[pKey].count += count;
                    }
                });
            }

            // Labor Cost
            const time = parseInt(h.workTime) || 0;
            stats.time += time;
            stats.laborCost += (time / 60) * this.laborRate;
        });

        Object.values(costMap).forEach(s => {
            s.laborCost = Math.round(s.laborCost);
            s.partsCost = Math.round(s.partsCost);
            s.totalCost = s.partsCost + s.laborCost;
        });

        const sorted = Object.values(costMap).sort((a, b) => b.totalCost - a.totalCost);

        container.innerHTML = `
            <div class="card" style="grid-column: 1 / -1; padding: 24px; margin-bottom: 24px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
                    <div>
                        <h3 style="font-size:1.1rem; font-weight:900; margin-bottom:4px;">
                            <i class="fa-solid fa-chart-bar" style="margin-right:8px; color:var(--primary);"></i> 
                            ${isDrilledDown ? `${this.costDrillDownCategory} 内のコスト詳細` : '装置区分別 メンテナンスコスト順位'}
                        </h3>
                        <p style="font-size:0.8rem; color:var(--text-light);">
                            ${isDrilledDown ? '※棒をクリックすると区分一覧に戻ります' : '※棒をクリックすると個別の機械にドリルダウンします'} 
                            / 人件費単価: ${this.laborRate.toLocaleString()}円/h
                        </p>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        ${isDrilledDown ? `
                            <button class="secondary-btn" style="padding:6px 12px; font-size:0.75rem; font-weight:800;" onclick="app.clearCostDrilldown()">
                                <i class="fa-solid fa-arrow-left"></i> 区分別に戻る
                            </button>
                        ` : ''}
                        <div style="background:#f1f5f9; padding:8px 16px; border-radius:8px; text-align:right;">
                            <div style="font-size:0.65rem; color:var(--text-light); font-weight:800;">集計期間内 総コスト</div>
                            <div style="font-size:1.2rem; font-weight:900; color:var(--primary);">¥${Math.round(sorted.reduce((sum, x) => sum + (x.totalCost || 0), 0)).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                <div style="height: ${Math.max(350, sorted.length * 40 + 80)}px; width: 100%;">
                    <canvas id="cost-ranking-chart"></canvas>
                </div>
            </div>

            <div class="card" style="grid-column: 1 / -1; padding:0; overflow-x:auto;">
                <table class="data-table" style="margin-bottom:0; min-width:800px;">
                    <thead>
                        <tr style="background:#f8fafc;">
                            <th style="padding:15px;">装置名 / 型式</th>
                            <th style="text-align:right;">合計コスト</th>
                            <th style="text-align:right;">部品代</th>
                            <th style="text-align:right;">作業人件費</th>
                            <th style="text-align:right;">作業時間</th>
                            <th style="text-align:right;">内訳割合</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sorted.map(s => {
                            const total = s.totalCost || 0;
                            const pCost = s.partsCost || 0;
                            const partPct = total > 0 ? (pCost / total * 100).toFixed(1) : 0;
                            
                            // Tooltip Breakdown Text
                            const laborLabel = `【作業費】 ${(s.time/60).toFixed(1)}h × ¥${this.laborRate.toLocaleString()} = ¥${Math.round(s.laborCost).toLocaleString()}`;
                            const pEntries = Object.values(s.partsUsed || {});
                            const partsDetails = pEntries.map(p => `・${p.name} [${p.model}]: ¥${Math.round(p.price).toLocaleString()} × ${p.count} = ¥${Math.round(p.price * p.count).toLocaleString()}`).join('\n');
                            const fullBreakdown = `【内訳】\n${partsDetails ? partsDetails + '\n' : ''}${laborLabel}`.replace(/"/g, '&quot;');

                            return `
                                <tr>
                                    <td>
                                        <div style="font-weight:900; font-size:0.95rem;">${s.name}</div>
                                        <div style="font-size:0.75rem; color:var(--text-light);">${s.model}</div>
                                    </td>
                                    <td style="text-align:right; font-weight:900; color:var(--primary); font-size:1.1rem; cursor:help;" title="${fullBreakdown}">¥${Math.round(total).toLocaleString()}</td>
                                    <td style="text-align:right; color:var(--text-main); cursor:help;" title="${(partsDetails || '部品交換なし').replace(/"/g, '&quot;')}">¥${Math.round(pCost).toLocaleString()}</td>
                                    <td style="text-align:right; color:var(--text-main); cursor:help;" title="${laborLabel.replace(/"/g, '&quot;')}">¥${Math.round(s.laborCost || 0).toLocaleString()}</td>
                                    <td style="text-align:right; color:var(--text-light);">${s.time || 0} 分</td>
                                    <td style="text-align:right; width:150px;">
                                        <div style="display:flex; height:10px; border-radius:5px; overflow:hidden; background:#e2e8f0;">
                                            <div style="width:${partPct}%; background:var(--primary);" title="部品代: ${partPct}%"></div>
                                            <div style="width:${100-partPct}%; background:#94a3b8;" title="人件費: ${100-partPct}%"></div>
                                        </div>
                                        <div style="font-size:0.6rem; color:var(--text-light); margin-top:4px;">
                                            部品 ${partPct}% / 人件費 ${(100-partPct).toFixed(1)}%
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        setTimeout(() => {
            const ctx = document.getElementById('cost-ranking-chart');
            if (ctx && sorted.length > 0) {
                if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
                if (this._costRankingChart) this._costRankingChart.destroy();
                const topN = sorted;
                this._costRankingChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: topN.map(x => {
                            const nm = x.name || '不明';
                            const md = x.model || '-';
                            const truncatedNm = nm.length > 10 ? nm.substring(0, 10) + '...' : nm;
                            return [truncatedNm, md];
                        }),
                        datasets: [
                            {
                                label: '部品代 (円)',
                                data: topN.map(x => x.partsCost || 0),
                                backgroundColor: '#1E40AF',
                            },
                            {
                                label: '作業人件費 (円)',
                                data: topN.map(x => x.laborCost || 0),
                                backgroundColor: '#F97316',
                            }
                        ]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        onClick: (evt, elements) => {
                            if (isDrilledDown) {
                                // Detail mode -> reset to Category view
                                this.clearCostDrilldown();
                                return;
                            }
                            if (elements && elements.length > 0) {
                                const index = elements[0].index;
                                const originalName = topN[index].name;
                                
                                if (!isDrilledDown) {
                                    // Drill down into category
                                    this.costDrillDownCategory = originalName;
                                    this.renderAnalysis();
                                }
                            }
                        },
                        scales: {
                            x: { 
                                stacked: true, 
                                ticks: { 
                                    callback: v => '¥' + (v >= 10000 ? (v/10000) + '万' : (v/1000) + 'k') 
                                } 
                            },
                            y: { 
                                stacked: true,
                                ticks: { font: { size: 10 } }
                            }
                        },
                        plugins: {
                            legend: { position: 'bottom' },
                            datalabels: {
                                color: '#ffffff',
                                font: { weight: 'bold', size: 14 },
                                anchor: 'start',
                                align: 'end',
                                offset: 4,
                                clip: false, // Allow overflow
                                display: true, // Force show regardless of width
                                formatter: (value) => value > 0 ? '¥' + Math.round(value).toLocaleString() : '',
                                textStrokeColor: 'rgba(0,0,0,0.5)',
                                textStrokeWidth: 1.5
                            },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => `${ctx.dataset.label}: ¥${Math.round(ctx.raw || 0).toLocaleString()}`,
                                    afterBody: (items) => {
                                        const index = items[0].dataIndex;
                                        const datasetIndex = items[0].datasetIndex;
                                        const s = topN[index];
                                        if (!s) return '';
                                        
                                        if (datasetIndex === 0) {
                                            // Parts Cost segment
                                            const pEntries = Object.values(s.partsUsed || {});
                                            const partsDetails = pEntries.map(p => `・${p.name}: ¥${Math.round(p.price).toLocaleString()} × ${p.count}`).join('\n');
                                            return `\n【内訳】\n${partsDetails || '部品交換なし'}`;
                                        } else {
                                            // Labor Cost segment
                                            const laborLabel = `・作業人件費: ${(s.time/60).toFixed(1)}h × ¥${this.laborRate.toLocaleString()} = ¥${Math.round(s.laborCost).toLocaleString()}`;
                                            return `\n【内訳】\n${laborLabel}`;
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }, 50);
    }
}

// Global instance initialization (Async for IndexedDB)
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await store.init();
        window.app = new MaintenanceApp();
    } catch (e) {
        console.error("Failed to initialize app state:", e);
        alert("初期化に失敗しました。ページをリロードしてください。");
        window.app = new MaintenanceApp(); // Fallback
    }
});
