(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppWorkTimeMethods extends MaintenanceApp {
    getWorkTimePeriodStorageKey() {
        return 'worktime_filter_period';
    }

    getWorkTimeGroupStorageKey() {
        return 'worktime_group_by';
    }

    queueWorkTimeRestoreNotice() {
        if (this._workTimeRestoreNoticeShown) return;
        this._workTimeRestoreNoticeShown = true;
        this._workTimeRestoreNoticeUntil = Date.now() + 3500;
        setTimeout(() => {
            const chip = document.getElementById('worktime-restore-notice');
            if (chip) chip.remove();
        }, 3600);
    }

    initializeWorkTimePeriodSelect() {
        const periodSelect = document.getElementById('worktime-filter-period');
        if (!periodSelect) return;

        const validValues = Array.from(periodSelect.options).map(opt => opt.value);
        const savedPeriod = localStorage.getItem(this.getWorkTimePeriodStorageKey());
        const initialPeriod = validValues.includes(savedPeriod) ? savedPeriod : 'last_this_month';
        if (periodSelect.value !== initialPeriod && validValues.includes(initialPeriod)) {
            periodSelect.value = initialPeriod;
        }
        if (!savedPeriod && validValues.includes(initialPeriod)) {
            localStorage.setItem(this.getWorkTimePeriodStorageKey(), initialPeriod);
        }
        if (periodSelect.dataset.worktimePeriodReady !== 'true' && validValues.includes(savedPeriod)) {
            this.queueWorkTimeRestoreNotice();
        }
        periodSelect.dataset.worktimePeriodReady = 'true';
    }

    initializeWorkTimeGroupSelection() {
        if (this._workTimeGroupReady) return;
        const savedGroup = localStorage.getItem(this.getWorkTimeGroupStorageKey());
        const group = ['worker', 'category'].includes(savedGroup) ? savedGroup : (this.workTimeGroupBy || 'worker');
        this.workTimeGroupBy = group;
        this.updateWorkTimeGroupUI(group);
        if (['worker', 'category'].includes(savedGroup)) this.queueWorkTimeRestoreNotice();
        this._workTimeGroupReady = true;
    }

    saveWorkTimePeriodSelection() {
        const period = document.getElementById('worktime-filter-period')?.value;
        if (period) localStorage.setItem(this.getWorkTimePeriodStorageKey(), period);
    }

    saveWorkTimeGroupSelection() {
        localStorage.setItem(this.getWorkTimeGroupStorageKey(), this.workTimeGroupBy || 'worker');
    }

    updateWorkTimeGroupUI(mode) {
        const btnWorker = document.getElementById('btn-worktime-worker');
        const btnCategory = document.getElementById('btn-worktime-category');
        const searchInput = document.getElementById('worktime-search');
        if (btnWorker) btnWorker.classList.toggle('active', mode === 'worker');
        if (btnCategory) btnCategory.classList.toggle('active', mode === 'category');
        if (searchInput) {
            searchInput.placeholder = mode === 'worker' ? '作業員を検索...' : '装置区分を検索...';
        }
    }

    setWorkTimeGroup(mode) {
        this.workTimeGroupBy = mode;
        this.workTimeDrillDownCategory = null;
        this.updateWorkTimeGroupUI(mode);
        this.saveWorkTimeGroupSelection();
        this.renderWorkTime();
    }

    resetWorkTimeFilters() {
        const periodSelect = document.getElementById('worktime-filter-period');
        const lineSelect = document.getElementById('worktime-filter-line');
        const searchInput = document.getElementById('worktime-search');
        if (periodSelect) {
            periodSelect.value = 'last_this_month';
            this.saveWorkTimePeriodSelection();
        }
        if (lineSelect) lineSelect.value = 'all';
        if (searchInput) searchInput.value = '';
        this.workTimeSearchQuery = '';
        this.workTimeDrillDownCategory = null;
        this.excludePeriodicInTrend = false;
        localStorage.setItem(this.getWorkTimeGroupStorageKey(), 'worker');
        this.setWorkTimeGroup('worker');
    }

    getWorkTimePeriodBadgeLabel(period) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const fmtMonth = (date) => `${date.getFullYear()}年${date.getMonth() + 1}月`;
        const fmtDate = (date) => `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
        const fmtFiscalYear = (fy, suffix = '年度') => `${fy}${suffix}（${fy}/4/1 - ${fy + 1}/3/31）`;
        if (period === 'today') return `${fmtDate(now)}（今日）`;
        if (period === 'yesterday') {
            const d = new Date(y, m, now.getDate() - 1);
            return `${fmtDate(d)}（昨日）`;
        }
        if (period === 'yesterday_today') {
            const d = new Date(y, m, now.getDate() - 1);
            return `${fmtDate(d)} - ${fmtDate(now)}（昨日・今日）`;
        }
        if (period === 'this_month') return `${fmtMonth(now)}（今月）`;
        if (period === 'last_month') return `${fmtMonth(new Date(y, m - 1, 1))}（先月）`;
        if (period === 'last_this_month') return `${fmtMonth(new Date(y, m - 1, 1))} - ${fmtMonth(now)}（先月と今月）`;
        if (period === 'this_year' || period === 'fiscal_year') {
            const fy = m < 3 ? y - 1 : y;
            return fmtFiscalYear(fy, '年度');
        }
        if (period === 'last_year' || period === 'last_fiscal_year') {
            const fy = m < 3 ? y - 2 : y - 1;
            return fmtFiscalYear(fy, '年度');
        }
        if (period === 'last_30_days') return '直近30日';
        if (period === 'prev_30_days') return '前の30日';
        if (period === 'custom') {
            const start = localStorage.getItem('customStartDate') || '開始日未設定';
            return `${start}以降（指定日以降）`;
        }
        if (period === 'custom_range') {
            const start = localStorage.getItem('customRangeStart') || '開始日未設定';
            const end = localStorage.getItem('customRangeEnd') || '終了日未設定';
            return `${start} - ${end}（指定範囲）`;
        }
        if (period === 'CUSTOM') {
            const start = this.customStartDate || '開始日未設定';
            const end = this.customEndDate || '終了日未設定';
            return `${start} - ${end}（カスタム）`;
        }
        const fiscalYear = parseInt(period, 10);
        if (!Number.isNaN(fiscalYear) && String(fiscalYear) === String(period)) {
            return fmtFiscalYear(fiscalYear, '年度');
        }
        return '全期間';
    }

    escapeWorkTimeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    }

    renderWorkTimeConditionBar({ period, lineVal, query, groupBy, isDrilledDown, resultCount, totalMinutes }) {
        const lineText = lineVal === 'all' ? '全ライン' : this.getLineLabel(lineVal);
        const groupText = groupBy === 'category' ? '装置区分別' : '作業者別';
        const searchText = query ? `検索: ${this.escapeWorkTimeHtml(query)}` : '検索なし';
        const detailText = isDrilledDown ? `詳細: ${this.escapeWorkTimeHtml(this.workTimeDrillDownCategory)}` : '詳細なし';
        const periodText = this.escapeWorkTimeHtml(this.getWorkTimePeriodBadgeLabel(period));
        const showRestoreNotice = this._workTimeRestoreNoticeUntil && Date.now() < this._workTimeRestoreNoticeUntil;
        const bar = document.createElement('div');
        bar.className = 'worktime-condition-bar';
        bar.innerHTML = `
            <div class="worktime-condition-main">
                <div class="worktime-period-badge">
                    <i class="fa-regular fa-calendar"></i>
                    <span>集計期間</span>
                    <b>${periodText}</b>
                </div>
                <div class="worktime-condition-chips">
                    <span>${this.escapeWorkTimeHtml(groupText)}</span>
                    <span>${this.escapeWorkTimeHtml(lineText)}</span>
                    <span>${searchText}</span>
                    <span>${detailText}</span>
                    ${showRestoreNotice ? '<span id="worktime-restore-notice" class="worktime-restore-notice"><i class="fa-solid fa-clock-rotate-left"></i> 前回条件を復元</span>' : ''}
                </div>
            </div>
            <div class="worktime-condition-actions">
                <div class="worktime-result-summary">
                    <b>${resultCount.toLocaleString()}</b><span>件</span>
                    <b>${totalMinutes.toLocaleString()}</b><span>分</span>
                </div>
                <button type="button" class="secondary-btn worktime-reset-btn" onclick="app.resetWorkTimeFilters()" title="期間・ライン・検索条件を初期状態に戻します">
                    <i class="fa-solid fa-rotate-left"></i> 条件リセット
                </button>
            </div>
        `;
        return bar;
    }

    filterWorkTimeRecordsByLine(records, lineVal, machines) {
        if (lineVal === 'all') return records;
        return records.filter(h => {
            const m = machines.find(x => x.id === h.machineId);
            const l = h.lineNo || m?.lineNo;
            return String(l) === String(lineVal);
        });
    }

    getWorkTimeMinutes(records) {
        return records.reduce((sum, h) => sum + (parseInt(h.workTime) || 0), 0);
    }

    getWorkTimeChartTooltipEl(chart) {
        const parent = chart.canvas.parentNode;
        parent.style.position = 'relative';
        parent.style.overflow = 'visible';
        let el = parent.querySelector('.worktime-chart-tooltip');
        if (!el) {
            el = document.createElement('div');
            el.className = 'worktime-chart-tooltip';
            parent.appendChild(el);
        }
        return el;
    }

    hideOtherWorkTimeChartTooltips(activeEl) {
        document.querySelectorAll('.worktime-chart-tooltip').forEach(el => {
            if (el !== activeEl) {
                el.style.opacity = 0;
                el.style.pointerEvents = 'none';
                const parent = el.parentNode;
                if (parent?.dataset?.worktimeTooltipReserved === 'true') {
                    parent.style.paddingTop = '';
                    parent.dataset.worktimeTooltipReserved = '';
                }
            }
        });
    }

    renderWorkTimeExternalTooltip(context) {
        const { chart, tooltip } = context;
        const el = this.getWorkTimeChartTooltipEl(chart);
        const isTrendChart = chart.canvas.id === 'worktime-trend-chart';
        const isWorkTimeModalChart = ['chart-total', 'chart-pt', 'chart-st', 'chart-np', 'chart-dt'].includes(chart.canvas.id);
        if (!tooltip || tooltip.opacity === 0) {
            if (!isTrendChart && !isWorkTimeModalChart) {
                el.style.opacity = 0;
                el.style.pointerEvents = 'none';
                const parent = el.parentNode;
                if (parent?.dataset?.worktimeTooltipReserved === 'true') {
                    parent.style.paddingTop = '';
                    parent.dataset.worktimeTooltipReserved = '';
                }
            }
            return;
        }

        this.hideOtherWorkTimeChartTooltips(el);
        this.hideWorkTimeTrendChoiceMenu();

        const labelColors = tooltip.labelColors || [];
        const trendTypeMap = { '定期メンテ': 'periodic', '突発対応': 'sudden', '非生産停止': 'nonProductionStop', 'ドカ停': 'dokatei' };
        const drilledTypeValue = trendTypeMap[this.workTimeDrillDownCategory] || '';
        const body = isTrendChart && tooltip.dataPoints?.length
            ? tooltip.dataPoints
                .filter(point => (point.parsed?.y || 0) > 0)
                .map((point, itemIndex) => {
                    const color = labelColors[itemIndex]?.borderColor || point.dataset.borderColor || point.dataset.backgroundColor || '#475569';
                    const label = point.dataset.label || '';
                    const value = point.parsed?.y || 0;
                    const machineId = point.dataset.machineId || '';
                    const machineCategory = point.dataset.machineCategory || '';
                    const clickHandler = machineId
                        ? `app.openWorkTimeMachineHistory('${this.escapeWorkTimeHtml(machineId)}')`
                        : machineCategory
                        ? `app.openWorkTimeMachineCategoryHistory(decodeURIComponent('${encodeURIComponent(machineCategory)}'))`
                        : drilledTypeValue
                        ? `app.openWorkTimeTroubleHistory(decodeURIComponent('${encodeURIComponent(label)}'), '${drilledTypeValue}')`
                        : `app.openWorkTimeTypeHistory(decodeURIComponent('${encodeURIComponent(label)}'))`;
                    return `
                        <button type="button" class="worktime-chart-tooltip-line clickable" style="color:${this.escapeWorkTimeHtml(color)}" onclick="${clickHandler}" title="この条件でメンテナンス履歴を表示">
                            <span>${this.escapeWorkTimeHtml(label)}: ${value.toLocaleString()}</span>
                            <i class="fa-solid fa-book-open worktime-link-icon" aria-hidden="true"></i>
                        </button>
                    `;
                })
                .join('')
            : isWorkTimeModalChart && tooltip.dataPoints?.length
                ? tooltip.dataPoints
                    .filter(point => (point.parsed || 0) > 0)
                    .map((point, itemIndex) => {
                        const color = labelColors[itemIndex]?.backgroundColor || point.dataset.backgroundColor?.[point.dataIndex] || point.dataset.backgroundColor || '#475569';
                        const label = point.label || chart.data.labels?.[point.dataIndex] || '';
                        const searchKey = point.dataset.searchKeys?.[point.dataIndex] || label;
                        const value = point.parsed || 0;
                        const typeMap = { 'chart-total': '', 'chart-pt': 'periodic', 'chart-st': 'sudden', 'chart-np': 'nonProductionStop', 'chart-dt': 'dokatei' };
                        const clickHandler = chart.canvas.id === 'chart-total'
                            ? `app.openWorkTimeTypeHistory(decodeURIComponent('${encodeURIComponent(label)}'))`
                            : `app.openWorkTimeTroubleHistory(decodeURIComponent('${encodeURIComponent(searchKey)}'), '${typeMap[chart.canvas.id] || ''}')`;
                        return `
                            <button type="button" class="worktime-chart-tooltip-line clickable" style="color:${this.escapeWorkTimeHtml(color)}" onclick="${clickHandler}" title="この条件でメンテナンス履歴を表示">
                                <span>${this.escapeWorkTimeHtml(label)}: ${value.toLocaleString()}分</span>
                                <i class="fa-solid fa-book-open worktime-link-icon" aria-hidden="true"></i>
                            </button>
                        `;
                    })
                    .join('')
            : (tooltip.body || [])
                .map((item, itemIndex) => {
                    const color = labelColors[itemIndex]?.borderColor || labelColors[itemIndex]?.backgroundColor || '#475569';
                    return (item.lines || [])
                        .flatMap(line => String(line).split('\n'))
                        .filter(Boolean)
                        .map(line => `<div class="worktime-chart-tooltip-line" style="color:${this.escapeWorkTimeHtml(color)}">${this.escapeWorkTimeHtml(line)}</div>`)
                        .join('');
                })
                .join('');
        const title = (isTrendChart || isWorkTimeModalChart) && body
            ? ''
            : (tooltip.title || []).map(t => `<div class="worktime-chart-tooltip-title">${this.escapeWorkTimeHtml(t)}</div>`).join('');
        el.innerHTML = `${title}<div class="worktime-chart-tooltip-body">${body}</div>`;

        el.style.opacity = 1;
        el.style.pointerEvents = (isTrendChart || isWorkTimeModalChart) ? 'auto' : 'none';
        el.style.left = '0px';
        el.style.top = '0px';

        const canvasLeft = chart.canvas.offsetLeft;
        const canvasTop = chart.canvas.offsetTop;
        const tooltipWidth = el.offsetWidth || 240;
        const tooltipHeight = el.offsetHeight || 110;
        const targetX = canvasLeft + tooltip.caretX;
        const targetY = canvasTop + tooltip.caretY;

        if (isWorkTimeModalChart) {
            const parent = chart.canvas.parentNode;
            const reserve = Math.min(Math.max(tooltipHeight + 10, 64), 150);
            parent.style.paddingTop = `${reserve}px`;
            parent.style.boxSizing = 'content-box';
            parent.dataset.worktimeTooltipReserved = 'true';
            const parentWidth = parent.clientWidth || chart.canvas.offsetWidth || 280;
            const safeLeft = Math.max(8, Math.min(parentWidth - tooltipWidth - 8, targetX - tooltipWidth / 2));
            el.style.left = `${safeLeft}px`;
            el.style.top = '0px';
            return;
        }

        const left = Math.max(canvasLeft - 8, targetX - tooltipWidth - 86);
        const top = Math.max(canvasTop - 22, targetY - tooltipHeight - 76);

        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
    }

    hideWorkTimeTrendChoiceMenu() {
        const menu = document.querySelector('.worktime-trend-choice-menu');
        if (menu) menu.remove();
    }

    showWorkTimeTrendChoiceMenu(chart, point, choices) {
        this.hideWorkTimeTrendChoiceMenu();
        const parent = chart.canvas.parentNode;
        parent.style.position = 'relative';
        parent.style.overflow = 'visible';

        const menu = document.createElement('div');
        menu.className = 'worktime-trend-choice-menu';
        const month = chart.data.labels[point.index] || '';
        menu.innerHTML = `
            <div class="worktime-trend-choice-title">${this.escapeWorkTimeHtml(month)} の表示先</div>
            <div class="worktime-trend-choice-list"></div>
        `;
        const list = menu.querySelector('.worktime-trend-choice-list');
        choices.forEach(choice => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.innerHTML = `<span style="background:${choice.color}"></span>${this.escapeWorkTimeHtml(choice.label)}<b>${choice.value.toLocaleString()}分</b>`;
            btn.addEventListener('click', () => {
                this.workTimeDrillDownCategory = choice.label;
                this.hideWorkTimeTrendChoiceMenu();
                this.renderWorkTime();
            });
            list.appendChild(btn);
        });
        parent.appendChild(menu);

        const canvasLeft = chart.canvas.offsetLeft;
        const canvasTop = chart.canvas.offsetTop;
        const pointX = canvasLeft + point.element.x;
        const pointY = canvasTop + point.element.y;
        const width = menu.offsetWidth || 210;
        const height = menu.offsetHeight || 120;
        menu.style.left = `${Math.max(canvasLeft - 8, pointX - width - 74)}px`;
        menu.style.top = `${Math.max(canvasTop - 18, pointY - height - 62)}px`;

        setTimeout(() => {
            const close = (ev) => {
                if (!menu.contains(ev.target)) {
                    this.hideWorkTimeTrendChoiceMenu();
                    document.removeEventListener('pointerdown', close);
                }
            };
            document.addEventListener('pointerdown', close);
        }, 0);
    }

    openWorkTimeWorkerHistory(workerName) {
        if (!workerName || workerName === '旧作業者合計') return;

        const workPeriod = document.getElementById('worktime-filter-period')?.value || 'this_month';
        const workLine = document.getElementById('worktime-filter-line')?.value || 'all';
        const histPeriod = document.getElementById('hist-filter-period');
        const histLine = document.getElementById('hist-filter-line');
        const histMachine = document.getElementById('hist-filter-machine');
        const histType = document.getElementById('hist-filter-type');
        const searchIn = document.getElementById('global-search');

        if (histPeriod) histPeriod.value = workPeriod;
        if (histLine) histLine.value = workLine;
        if (histMachine) histMachine.value = '';
        if (histType) histType.value = '';
        if (searchIn) searchIn.value = '';
        this.modelFilter = null;
        this.workerFilter = workerName;
        this.machineCategoryFilter = null;
        this.historyReturnContext = this.buildWorkTimeReturnContext(`作業者: ${workerName}`);

        this.switchView('history');
        if (histPeriod) histPeriod.value = workPeriod;
        if (histLine) histLine.value = workLine;
        this.renderHistory('');
    }

    openWorkTimeTypeHistory(typeLabel) {
        const typeMap = {
            '定期メンテ': 'periodic',
            '突発対応': 'sudden',
            '非生産停止': 'nonProductionStop',
            'ドカ停': 'dokatei'
        };
        const histTypeValue = typeMap[typeLabel];
        if (!histTypeValue) return;

        const workPeriod = document.getElementById('worktime-filter-period')?.value || 'this_month';
        const workLine = document.getElementById('worktime-filter-line')?.value || 'all';
        const histPeriod = document.getElementById('hist-filter-period');
        const histLine = document.getElementById('hist-filter-line');
        const histMachine = document.getElementById('hist-filter-machine');
        const histType = document.getElementById('hist-filter-type');
        const searchIn = document.getElementById('global-search');

        if (histPeriod) histPeriod.value = workPeriod;
        if (histLine) histLine.value = workLine;
        if (histMachine) histMachine.value = '';
        if (histType) histType.value = histTypeValue;
        if (searchIn) searchIn.value = '';
        this.modelFilter = null;
        this.workerFilter = null;
        this.machineCategoryFilter = null;
        this.workTimeDrillDownCategory = null;
        this.historyReturnContext = this.buildWorkTimeReturnContext(`種別: ${typeLabel}`);

        this.switchView('history');
        if (histPeriod) histPeriod.value = workPeriod;
        if (histLine) histLine.value = workLine;
        if (histType) histType.value = histTypeValue;
        this.renderHistory('');
    }

    openWorkTimeTroubleHistory(troubleLabel, histTypeValue = '') {
        if (!troubleLabel) return;

        const workPeriod = document.getElementById('worktime-filter-period')?.value || 'this_month';
        const workLine = document.getElementById('worktime-filter-line')?.value || 'all';
        const histPeriod = document.getElementById('hist-filter-period');
        const histLine = document.getElementById('hist-filter-line');
        const histMachine = document.getElementById('hist-filter-machine');
        const histType = document.getElementById('hist-filter-type');
        const searchIn = document.getElementById('global-search');

        if (histPeriod) histPeriod.value = workPeriod;
        if (histLine) histLine.value = workLine;
        if (histMachine) histMachine.value = '';
        if (histType) histType.value = histTypeValue || '';
        if (searchIn) searchIn.value = troubleLabel;
        this.modelFilter = null;
        this.workerFilter = null;
        this.machineCategoryFilter = null;
        this.historyReturnContext = this.buildWorkTimeReturnContext(`内容: ${troubleLabel}`);

        this.switchView('history');
        if (histPeriod) histPeriod.value = workPeriod;
        if (histLine) histLine.value = workLine;
        if (histType) histType.value = histTypeValue || '';
        if (searchIn) searchIn.value = troubleLabel;
        this.renderHistory(troubleLabel.toLowerCase());
    }

    getWorkTimeHistoryTypeKey(history) {
        if (history?.taskId) return 'periodic';
        if (history?.isDokatei) return 'dokatei';
        if (history?.isNonProductionStop) return 'nonProductionStop';
        return 'sudden';
    }

    getWorkTimeHistoryTypeLabel(typeKey) {
        const labels = {
            periodic: '定期メンテ',
            sudden: '突発対応',
            nonProductionStop: '非生産停止',
            dokatei: 'ドカ停'
        };
        return labels[typeKey] || '内容';
    }

    getWorkTimeCountBadgeHtml(rowName, groupBy, typeKey, count, color, borderColor, disabled = false) {
        const value = Number(count || 0);
        if (value <= 0 || disabled) {
            return `<span class="worktime-count-badge disabled" style="color:${color}; border-color:${borderColor};">${value}</span>`;
        }
        return `
            <button type="button" class="worktime-count-badge clickable" style="color:${color}; border-color:${borderColor};"
                onclick="app.openWorkTimeCountDetails(decodeURIComponent('${encodeURIComponent(rowName)}'), '${groupBy}', '${typeKey}')"
                title="${this.escapeWorkTimeHtml(this.getWorkTimeHistoryTypeLabel(typeKey))}の内容を表示">
                ${value}
            </button>
        `;
    }

    addWorkTimeContentStat(stats, typeKey, content, minutes) {
        if (!stats.contentTypeMap) stats.contentTypeMap = { periodic: {}, sudden: {}, nonProductionStop: {}, dokatei: {} };
        if (!stats.contentTypeMap[typeKey]) stats.contentTypeMap[typeKey] = {};
        const key = content || '内容なし';
        const item = stats.contentTypeMap[typeKey][key] || { count: 0, minutes: 0 };
        item.count++;
        item.minutes += parseInt(minutes) || 0;
        stats.contentTypeMap[typeKey][key] = item;
    }

    openWorkTimeCountDetails(groupName, groupBy, typeKey) {
        const records = this.getWorkTimeGroupedRecords(groupName, groupBy, typeKey);
        const contentMap = {};
        records.forEach(h => {
            const content = this.getHistoryDisplayText(h) || '内容なし';
            if (!contentMap[content]) contentMap[content] = { count: 0, minutes: 0 };
            contentMap[content].count++;
            contentMap[content].minutes += parseInt(h.workTime) || 0;
        });
        const items = Object.entries(contentMap).sort((a, b) => b[1].count - a[1].count || b[1].minutes - a[1].minutes);
        const typeLabel = this.getWorkTimeHistoryTypeLabel(typeKey);
        const groupLabel = groupBy === 'category' ? '装置区分' : '担当者';

        this.openModal('worktime-count-details', `${groupLabel}: ${groupName} / ${typeLabel}`, () => {
            const content = document.getElementById('modal-content');
            content.innerHTML = items.length ? `
                <div class="worktime-count-detail-list">
                    ${items.map(([label, stat]) => `
                        <button type="button" class="worktime-count-detail-item"
                            onclick="app.closeModal(); app.openWorkTimeGroupedTroubleHistory(decodeURIComponent('${encodeURIComponent(label)}'), '${typeKey}', decodeURIComponent('${encodeURIComponent(groupName)}'), '${groupBy}')">
                            <span>${this.escapeWorkTimeHtml(label)}</span>
                            <b>${Number(stat.count || 0).toLocaleString()}件</b>
                            <em>${Number(stat.minutes || 0).toLocaleString()}分</em>
                            <i class="fa-solid fa-book-open"></i>
                        </button>
                    `).join('')}
                </div>
            ` : `
                <div class="worktime-count-detail-empty">
                    この条件の内容はありません。
                </div>
            `;
            const saveBtn = document.querySelector('.modal-footer .primary-btn');
            if (saveBtn) saveBtn.classList.add('hidden');
        });
    }

    getWorkTimeGroupedRecords(groupName, groupBy, typeKey) {
        const period = document.getElementById('worktime-filter-period')?.value || 'this_month';
        const lineVal = document.getElementById('worktime-filter-line')?.value || 'all';
        const machines = store.getMachines(true);
        let records = this.filterHistoryByPeriod(store.getHistory({}), period);
        records = this.filterWorkTimeRecordsByLine(records, lineVal, machines);
        records = records.filter(h => this.getWorkTimeHistoryTypeKey(h) === typeKey);
        return records.filter(h => {
            if (groupBy === 'category') {
                const m = machines.find(x => x.id === h.machineId);
                const cat = (m && m.category) ? m.category : (h.machineCategory || 'その他');
                return cat === groupName;
            }
            return (h.workers || []).map(w => w.trim()).filter(Boolean).includes(groupName);
        });
    }

    openWorkTimeGroupedTroubleHistory(troubleLabel, histTypeValue, groupName, groupBy) {
        if (!troubleLabel) return;

        const workPeriod = document.getElementById('worktime-filter-period')?.value || 'this_month';
        const workLine = document.getElementById('worktime-filter-line')?.value || 'all';
        const histPeriod = document.getElementById('hist-filter-period');
        const histLine = document.getElementById('hist-filter-line');
        const histMachine = document.getElementById('hist-filter-machine');
        const histType = document.getElementById('hist-filter-type');
        const searchIn = document.getElementById('global-search');

        if (histPeriod) histPeriod.value = workPeriod;
        if (histLine) histLine.value = workLine;
        if (histMachine) histMachine.value = '';
        if (histType) histType.value = histTypeValue || '';
        if (searchIn) searchIn.value = troubleLabel;
        this.modelFilter = null;
        this.workerFilter = groupBy === 'worker' ? groupName : null;
        this.machineCategoryFilter = groupBy === 'category' ? groupName : null;
        this.historyReturnContext = this.buildWorkTimeReturnContext(`${groupName}: ${troubleLabel}`);

        this.switchView('history');
        if (histPeriod) histPeriod.value = workPeriod;
        if (histLine) histLine.value = workLine;
        if (histType) histType.value = histTypeValue || '';
        if (searchIn) searchIn.value = troubleLabel;
        this.renderHistory(troubleLabel.toLowerCase());
    }

    openWorkTimeMachineHistory(machineId) {
        if (!machineId) return;

        const workPeriod = document.getElementById('worktime-filter-period')?.value || 'this_month';
        const workLine = document.getElementById('worktime-filter-line')?.value || 'all';
        const histPeriod = document.getElementById('hist-filter-period');
        const histLine = document.getElementById('hist-filter-line');
        const histMachine = document.getElementById('hist-filter-machine');
        const histType = document.getElementById('hist-filter-type');
        const searchIn = document.getElementById('global-search');

        if (histPeriod) histPeriod.value = workPeriod;
        if (histLine) histLine.value = workLine;
        if (histMachine) histMachine.value = machineId;
        if (histType) histType.value = '';
        if (searchIn) searchIn.value = '';
        this.modelFilter = null;
        this.workerFilter = null;
        this.machineCategoryFilter = null;
        this.historyReturnContext = this.buildWorkTimeReturnContext('機械別履歴');

        this.switchView('history');
        if (histPeriod) histPeriod.value = workPeriod;
        if (histLine) histLine.value = workLine;
        if (histMachine) histMachine.value = machineId;
        if (histType) histType.value = '';
        this.renderHistory('');
    }

    openWorkTimeMachineCategoryHistory(machineCategory) {
        if (!machineCategory) return;

        const workPeriod = document.getElementById('worktime-filter-period')?.value || 'this_month';
        const workLine = document.getElementById('worktime-filter-line')?.value || 'all';
        const histPeriod = document.getElementById('hist-filter-period');
        const histLine = document.getElementById('hist-filter-line');
        const histMachine = document.getElementById('hist-filter-machine');
        const histType = document.getElementById('hist-filter-type');
        const searchIn = document.getElementById('global-search');

        if (histPeriod) histPeriod.value = workPeriod;
        if (histLine) histLine.value = workLine;
        if (histMachine) histMachine.value = '';
        if (histType) histType.value = '';
        if (searchIn) searchIn.value = '';
        this.modelFilter = null;
        this.workerFilter = null;
        this.machineCategoryFilter = machineCategory;
        this.historyReturnContext = this.buildWorkTimeReturnContext(`装置区分: ${machineCategory}`);

        this.switchView('history');
        if (histPeriod) histPeriod.value = workPeriod;
        if (histLine) histLine.value = workLine;
        if (histMachine) histMachine.value = '';
        if (histType) histType.value = '';
        if (searchIn) searchIn.value = '';
        this.renderHistory('');
    }

    buildWorkTimeReturnContext(label) {
        return {
            label,
            period: document.getElementById('worktime-filter-period')?.value || 'this_month',
            line: document.getElementById('worktime-filter-line')?.value || 'all',
            groupBy: this.workTimeGroupBy || 'worker',
            search: document.getElementById('worktime-search')?.value || '',
            drillDown: this.workTimeDrillDownCategory || null,
            scrollY: window.scrollY || document.documentElement.scrollTop || 0
        };
    }

    returnToWorkTimeFromHistory() {
        const ctx = this.historyReturnContext || {};
        this.switchView('worktime');
        const period = document.getElementById('worktime-filter-period');
        const line = document.getElementById('worktime-filter-line');
        const search = document.getElementById('worktime-search');
        if (period && ctx.period) period.value = ctx.period;
        if (line && ctx.line) line.value = ctx.line;
        if (search) search.value = ctx.search || '';
        this.workTimeSearchQuery = (ctx.search || '').toLowerCase();
        this.workTimeDrillDownCategory = ctx.drillDown || null;
        if (ctx.groupBy) this.workTimeGroupBy = ctx.groupBy;
        this.historyReturnContext = null;
        this.renderWorkTime(this.workTimeSearchQuery);
        setTimeout(() => {
            window.scrollTo({ top: ctx.scrollY || 0, behavior: 'smooth' });
        }, 50);
    }

    renderWorkTimeEmptyState({ period, lineVal, query, groupBy, allHistory, periodHistory, lineHistory, resultCount, machines }) {
        const e = (value) => this.escapeWorkTimeHtml(value);
        const lineText = lineVal === 'all' ? '全ライン' : this.getLineLabel(lineVal);
        const groupText = groupBy === 'category' ? '装置区分別' : '作業者別';
        const conditionText = `${this.getWorkTimePeriodBadgeLabel(period)} / ${lineText} / ${groupText} / ${query ? `検索: ${query}` : '検索なし'}`;
        const missingWorkerCount = lineHistory.filter(h => !(h.workers || []).some(w => String(w || '').trim())).length;
        let reasonTitle = '現在の条件に一致する集計結果がありません';
        let reasonDetail = '期間・ライン・検索条件のどれかで対象が0件になっています。';

        if (allHistory.length === 0) {
            reasonTitle = 'メンテナンス履歴がまだ登録されていません';
            reasonDetail = '履歴が登録されると、作業時間を自動で集計します。';
        } else if (periodHistory.length === 0) {
            reasonTitle = '指定期間に作業記録がありません';
            reasonDetail = `${this.getWorkTimePeriodBadgeLabel(period)} には履歴が見つかりませんでした。`;
        } else if (lineHistory.length === 0) {
            reasonTitle = '指定ラインに作業記録がありません';
            reasonDetail = `${lineText} に該当する履歴が、この期間にはありません。`;
        } else if (query) {
            reasonTitle = '検索条件に一致する集計結果がありません';
            reasonDetail = groupBy === 'category'
                ? `装置区分名に「${query}」を含む集計結果がありません。`
                : `作業者名に「${query}」を含む集計結果がありません。`;
        } else if (groupBy === 'worker' && missingWorkerCount === lineHistory.length) {
            reasonTitle = '作業者名が未入力のため集計できません';
            reasonDetail = 'この条件の履歴はありますが、作業者名が入っていないため作業者別に表示できません。';
        } else if (resultCount === 0) {
            reasonTitle = '集計対象がありません';
            reasonDetail = '履歴はありますが、現在の表示条件では集計行を作れませんでした。';
        }

        const currentFiscalYear = (typeof this.getFiscalYear === 'function')
            ? this.getFiscalYear(new Date().toISOString().split('T')[0])
            : (new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear());
        const periodOptions = Array.from(new Set([period, 'this_month', String(currentFiscalYear), String(currentFiscalYear - 1), 'all'])).map(pid => {
            const records = this.filterHistoryByPeriod(allHistory, pid);
            const lineRecords = this.filterWorkTimeRecordsByLine(records, lineVal, machines);
            return {
                id: pid,
                label: this.getWorkTimePeriodBadgeLabel(pid),
                count: lineRecords.length,
                minutes: this.getWorkTimeMinutes(lineRecords)
            };
        });
        const alternatives = periodOptions
            .filter(item => item.id !== period || item.count > 0)
            .map(item => `
                <div class="worktime-empty-stat">
                    <span>${e(item.label)}</span>
                    <b>${item.count.toLocaleString()}件</b>
                    <em>${item.minutes.toLocaleString()}分</em>
                </div>
            `).join('');

        const workerHint = groupBy === 'worker' && missingWorkerCount > 0
            ? `<p><i class="fa-solid fa-user-pen"></i> この条件内に作業者未入力の履歴が ${missingWorkerCount.toLocaleString()} 件あります。</p>`
            : '';

        return `
            <tr>
                <td colspan="14" class="worktime-empty-cell">
                    <div class="worktime-empty-state">
                        <div class="worktime-empty-icon"><i class="fa-solid fa-magnifying-glass-chart"></i></div>
                        <div class="worktime-empty-body">
                            <h4>${e(reasonTitle)}</h4>
                            <p>${e(reasonDetail)}</p>
                            <div class="worktime-empty-condition">${e(conditionText)}</div>
                            ${workerHint}
                            <div class="worktime-empty-stats">
                                ${alternatives || '<div class="worktime-empty-stat"><span>全期間</span><b>0件</b><em>0分</em></div>'}
                            </div>
                            <button type="button" class="secondary-btn worktime-reset-btn" onclick="app.resetWorkTimeFilters()">
                                <i class="fa-solid fa-rotate-left"></i> 条件リセット
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    renderWorkTime(searchQuery = null) {
        const container = document.getElementById('worktime-container');
        if (!container) return;

        const searchInput = document.getElementById('worktime-search');
        const rawQuery = searchQuery === null ? (searchInput?.value || this.workTimeSearchQuery || '') : searchQuery;
        const q = MaintenanceStore.toHalfWidthLower(rawQuery || '').trim();
        this.workTimeSearchQuery = q;
        this.initializeWorkTimePeriodSelect();
        this.initializeWorkTimeGroupSelection();
        const period = document.getElementById('worktime-filter-period')?.value || 'this_month';
        const lineVal = document.getElementById('worktime-filter-line')?.value || 'all';
        this.updateViewSubtitle('view-worktime', period);
        this.renderCommonFilterBadgeSlot?.('worktime');

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

        const allHistory = store.getHistory({});
        let history = this.filterHistoryByPeriod(allHistory, period);
        const periodHistory = history.slice();
        const machines = store.getMachines(true);

        history = this.filterWorkTimeRecordsByLine(history, lineVal, machines);
        const lineHistory = history.slice();

        const createWorkTimeStats = () => ({
            totalTime: 0, pt: 0, st: 0, np: 0, dt: 0, pc: 0, sc: 0, npc: 0, dc: 0,
            machineTimeMap: {},
            troubleCountMap: {},
            contentTypeMap: { periodic: {}, sudden: {}, nonProductionStop: {}, dokatei: {} }
        });
        const statsMap = {}; 
        const archivedStats = createWorkTimeStats();
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
                
                const s = isArchived ? archivedStats : (statsMap[k] || (statsMap[k] = createWorkTimeStats()));
                
                s.totalTime += time;
                const typeKey = this.getWorkTimeHistoryTypeKey(h);
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
                this.addWorkTimeContentStat(s, typeKey, content, time);
            });
        });

        let results = Object.entries(statsMap).map(([name, s]) => {
            const avgSudden = s.sc > 0 ? (s.st / s.sc).toFixed(1) : 0;
            const avgDokatei = s.dc > 0 ? (s.dt / s.dc).toFixed(1) : 0;
            const pct = totalTimeSum > 0 ? ((s.totalTime / totalTimeSum) * 100).toFixed(1) : 0;
            
            const topMachines = Object.entries(s.machineTimeMap).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>`・${x[0]} (${x[1]}分)`).join('<br>');
            const topTroubles = Object.entries(s.troubleCountMap).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>`・${x[0]} (${x[1]}件)`).join('<br>');

            return { name, totalTime: s.totalTime, pct, pt: s.pt, st: s.st, np: s.np, dt: s.dt, pc: s.pc, sc: s.sc, npc: s.npc, dc: s.dc, avgSudden, avgDokatei, topMachines, topTroubles, contentTypeMap: s.contentTypeMap, isArchived: false };
        });

        if (currentGroupBy === 'worker' && archivedStats.totalTime > 0) {
            const s = archivedStats;
            const pct = totalTimeSum > 0 ? ((s.totalTime / totalTimeSum) * 100).toFixed(1) : 0;
            const topMachines = Object.entries(s.machineTimeMap).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>`・${x[0]} (${x[1]}分)`).join('<br>');
            const topTroubles = Object.entries(s.troubleCountMap).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>`・${x[0]} (${x[1]}件)`).join('<br>');
            results.push({ name: '旧作業者合計', totalTime: s.totalTime, pct, pt: s.pt, st: s.st, np: s.np, dt: s.dt, pc: s.pc, sc: s.sc, npc: s.npc, dc: s.dc, avgSudden: (s.sc > 0 ? (s.st / s.sc).toFixed(1) : 0), avgDokatei: (s.dc > 0 ? (s.dt / s.dc).toFixed(1) : 0), topMachines, topTroubles, contentTypeMap: s.contentTypeMap, isArchived: true });
        }

        if (q) {
            const terms = q.split(/[\s　]+/).filter(Boolean);
            results = results.filter(r => {
                const nr = MaintenanceStore.toHalfWidthLower(r.name);
                return terms.every(t => nr.includes(t));
            });
        }
        results.sort((a, b) => b.totalTime - a.totalTime);
        const displayedTotalTime = results.reduce((sum, r) => sum + (parseInt(r.totalTime) || 0), 0);

        container.innerHTML = '';
        container.appendChild(this.renderWorkTimeConditionBar({
            period,
            lineVal,
            query: q,
            groupBy: currentGroupBy,
            isDrilledDown,
            resultCount: results.length,
            totalMinutes: displayedTotalTime
        }));
        
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
                        const safeNameArg = String(r.name).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
                        const linkIcon = '<i class="fa-solid fa-book-open worktime-link-icon" aria-hidden="true"></i>';
                        const countGroupBy = currentGroupBy === 'category' ? 'category' : 'worker';
                        const nameCellHtml = (currentGroupBy === 'worker' && !isDrilledDown && !r.isArchived)
                            ? `<button type="button" class="worktime-worker-link" onclick="app.openWorkTimeWorkerHistory('${safeNameArg}')" title="${this.escapeWorkTimeHtml(r.name)} さんのメンテナンス履歴をこの期間で表示"><span>${displayName}</span>${linkIcon}</button>`
                            : (currentGroupBy === 'category' && !isDrilledDown)
                                ? `<button type="button" class="worktime-worker-link" onclick="app.openWorkTimeMachineCategoryHistory('${safeNameArg}')" title="${this.escapeWorkTimeHtml(r.name)} のメンテナンス履歴をこの期間で表示"><span>${displayName}</span>${linkIcon}</button>`
                                : displayName;
                        return `
                        <tr style="${r.isArchived ? 'background: #f8fafc; font-style: italic; opacity: 0.8;' : ''}">
                            <td style="font-weight:700; color:var(--text-main);">${nameCellHtml}</td>
                            <td style="text-align:right; font-weight:900; color:var(--primary); font-size:1rem;">
                                ${r.totalTime.toLocaleString()} <span style="font-size:0.75rem; color:var(--text-light); font-weight:400; margin-left:4px;">(${r.pct}%)</span>
                            </td>
                            <td style="text-align:right; font-weight:800; color:#1e40af; background:#f0f9ff; font-size:1rem;">${r.pt.toLocaleString()}</td>
                            <td style="text-align:center; background:#f0f9ff;">
                                ${this.getWorkTimeCountBadgeHtml(r.name, countGroupBy, 'periodic', r.pc, '#1e40af', '#dbeafe', r.isArchived)}
                            </td>
                            <td style="text-align:right; font-weight:800; color:#166534; background:#f0fdf4; font-size:1rem;">${r.st.toLocaleString()}</td>
                            <td style="text-align:center; background:#f0fdf4;">
                                ${this.getWorkTimeCountBadgeHtml(r.name, countGroupBy, 'sudden', r.sc, '#166534', '#dcfce7', r.isArchived)}
                            </td>
                            <td style="text-align:right; font-weight:800; color:#92400e; background:#fffbeb; font-size:1rem;">${(r.np || 0).toLocaleString()}</td>
                            <td style="text-align:center; background:#fffbeb;">
                                ${this.getWorkTimeCountBadgeHtml(r.name, countGroupBy, 'nonProductionStop', r.npc || 0, '#92400e', '#fde68a', r.isArchived)}
                            </td>
                            <td style="text-align:right; font-weight:800; color:#b91c1c; background:#fef2f2; font-size:1rem;">${r.dt.toLocaleString()}</td>
                            <td style="text-align:center; background:#fef2f2;">
                                ${this.getWorkTimeCountBadgeHtml(r.name, countGroupBy, 'dokatei', r.dc, '#b91c1c', '#fecaca', r.isArchived)}
                            </td>
                            <td style="text-align:right; font-weight:800; color:var(--text-main); font-size:0.85rem;">${r.avgSudden}</td>
                            <td style="text-align:right; font-weight:800; color:var(--danger); font-size:0.85rem;">${r.avgDokatei}</td>
                            <td style="font-size:0.7rem; color:var(--text-light); line-height:1.4; padding:8px 4px; min-width:180px;">${currentGroupBy === 'worker' ? (r.topMachines || '-') : (r.topTroubles || '-')}</td>
                            <td style="text-align:center;">
                                ${currentGroupBy === 'category' || isDrilledDown ? '-' : (r.isArchived ? '-' : `<button class="secondary-btn" style="padding:2px 8px; font-size:0.7rem;" onclick="app.archiveWorkerFromWorktime('${r.name}')">アーカイブ</button>`)}
                            </td>
                        </tr>
                        `;
                    }).join('') || this.renderWorkTimeEmptyState({ period, lineVal, query: q, groupBy: currentGroupBy, allHistory, periodHistory, lineHistory, resultCount: results.length, machines })}
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
            const q = MaintenanceStore.toHalfWidthLower(this.workTimeSearchQuery);
            if (this.workTimeGroupBy === 'category') {
                history = history.filter(h => {
                    const m = machines.find(x => x.id === h.machineId);
                    const cat = (m && m.category) ? m.category : (h.machineCategory || 'その他');
                    return MaintenanceStore.toHalfWidthLower(cat).includes(q);
                });
            } else {
                history = history.filter(h => (h.workers || []).some(w => MaintenanceStore.toHalfWidthLower(w.trim()).includes(q)));
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
            const machineIdMap = {};
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
                if (isDrilledDownTrend && m?.id && !machineIdMap[key]) machineIdMap[key] = m.id;
                
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
                    machineId: machineIdMap[label] || '',
                    machineCategory: isDrilledDownTrend ? '' : label,
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
                    this.hideWorkTimeTrendChoiceMenu();

                    // 既にドリルダウン中の場合：再クリックで解除
                    if (this.workTimeDrillDownCategory) {
                        this.workTimeDrillDownCategory = null;
                        this.renderWorkTime();
                        return;
                    }

                    const activePoints = this._trendChart.getElementsAtEventForMode(evt, 'point', { intersect: true }, true);
                    if (activePoints.length > 0) {
                        const point = activePoints[0];
                        const dataIndex = point.index;
                        const clickedValue = this._trendChart.data.datasets[point.datasetIndex]?.data?.[dataIndex];
                        const overlapChoices = this._trendChart.data.datasets
                            .map((ds, dsIndex) => ({
                                label: ds.label,
                                value: ds.data?.[dataIndex] || 0,
                                color: ds.borderColor || ds.backgroundColor || '#2563eb',
                                dsIndex
                            }))
                            .filter(item => item.value > 0 && item.value === clickedValue && this._trendChart.isDatasetVisible(item.dsIndex));

                        if (overlapChoices.length > 1) {
                            this.showWorkTimeTrendChoiceMenu(this._trendChart, point, overlapChoices);
                            return;
                        }

                        const dsIdx = point.datasetIndex;
                        const label = this._trendChart.data.datasets[dsIdx].label;
                        if (label) {
                            this.workTimeDrillDownCategory = label;
                            this.renderWorkTime();
                        }
                    }
                },
                interaction: {
                    mode: 'point',
                    intersect: true
                },
                elements: {
                    point: {
                        radius: 5,
                        hoverRadius: 8,
                        hitRadius: 6,
                        borderWidth: 2
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
                    tooltip: {
                        enabled: false,
                        external: (context) => this.renderWorkTimeExternalTooltip(context),
                        mode: 'point',
                        intersect: true
                    }
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
            const q = MaintenanceStore.toHalfWidthLower(this.workTimeSearchQuery);
            if (this.workTimeGroupBy === 'category') {
                history = history.filter(h => {
                    const m = store.getMachines(true).find(x => x.id === h.machineId);
                    const cat = (m && m.category) ? m.category : (h.machineCategory || 'その他');
                    return MaintenanceStore.toHalfWidthLower(cat).includes(q);
                });
            } else {
                history = history.filter(h => (h.workers || []).some(w => MaintenanceStore.toHalfWidthLower(w.trim()).includes(q)));
            }
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
                let searchKey = '';
                if (isDrilledDown) {
                    label = mName;
                    searchKey = mName;
                } else if (isCatMode) {
                    label = mCat;
                    searchKey = mCat;
                } else {
                    const task = this.getHistoryDisplayText(h);
                    label = `${h.date} [${mName}] ${task.length > 20 ? task.substring(0,20)+'...' : task}`;
                    searchKey = task;
                }

                if (!map[label]) map[label] = { time: 0, workers: new Set(), troubles: {}, searchKey };
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
                    searchKey: info.searchKey || label,
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
                interaction: {
                    mode: 'nearest',
                    intersect: true
                },
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
                        enabled: false,
                        external: (context) => this.renderWorkTimeExternalTooltip(context),
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
                        searchKeys: ptBreakdown.map(x => x.searchKey),
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
                        searchKeys: stBreakdown.map(x => x.searchKey),
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
                        searchKeys: npBreakdown.map(x => x.searchKey),
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
                        searchKeys: dtBreakdown.map(x => x.searchKey),
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
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppWorkTimeMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppWorkTimeMethods.prototype[name];
        }
    }
})();
