(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppShiftNotebookSettingsMethods extends MaintenanceApp {
    openShiftNotebookSettingsPanel() {
        const pasteSettings = this.getShiftNotePasteFormatSettings();
        const punctuationOptions = this.getShiftPastePunctuationOptions();
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
                    <div class="shift-paste-settings">
                        <div class="shift-paste-settings-title">
                            <i class="fa-solid fa-paste"></i>
                            <div>
                                <span>貼り付け整形</span>
                                <small>ペースト時の空白行削除と自動改行を調整します</small>
                            </div>
                        </div>
                        <label class="shift-setting-toggle">
                            <input type="checkbox" id="shift-paste-auto-break-enabled" ${pasteSettings.enabled ? 'checked' : ''} onchange="app.updateShiftNotePasteAutoBreakSetting('enabled', this.checked)">
                            <span>貼り付け時に句読点で自動改行する</span>
                        </label>
                        <label class="shift-setting-range">
                            <span>改行位置 <b id="shift-paste-break-ratio-label">${pasteSettings.ratioPercent}%</b></span>
                            <div class="shift-paste-ruler" id="shift-paste-ruler">
                                <span class="shift-paste-ruler-fill" style="width:${pasteSettings.ratioPercent}%"></span>
                                <span class="shift-paste-ruler-marker" style="left:${pasteSettings.ratioPercent}%"></span>
                            </div>
                            <input type="range" min="40" max="98" step="1" value="${pasteSettings.ratioPercent}" oninput="app.updateShiftNotePasteAutoBreakSetting('ratio', this.value)">
                        </label>
                        <div class="shift-paste-symbols">
                            <span>対象記号</span>
                            ${punctuationOptions.map(([symbol, label]) => `
                                <label>
                                    <input type="checkbox" value="${this.escapeHtml(symbol)}" ${pasteSettings.punctuation.includes(symbol) ? 'checked' : ''} onchange="app.updateShiftNotePasteAutoBreakPunctuation(this)">
                                    ${this.escapeHtml(label)}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `);
    }

    closeShiftNotebookSettingsPanel() {
        document.getElementById('shift-settings-overlay')?.remove();
    }

    getShiftNotePasteFormatSettings(editor = null) {
        const ratio = Number(localStorage.getItem('shift_note_paste_break_ratio') || 70);
        const punctuation = localStorage.getItem('shift_note_paste_break_punctuation') || '。！？.!?';
        const settings = {
            enabled: localStorage.getItem('shift_note_paste_auto_break_enabled') !== 'false',
            ratioPercent: Number.isFinite(ratio) ? Math.max(40, Math.min(98, ratio)) : 70,
            punctuation: punctuation || '。！？.!?'
        };
        const row = editor?.closest?.('.shift-notebook-row');
        const rowSettings = this.getShiftNoteRowPasteFormatSettings(row);
        if (rowSettings.mode === 'enabled') settings.enabled = true;
        if (rowSettings.mode === 'disabled') settings.enabled = false;
        return settings;
    }

    getShiftPastePunctuationOptions() {
        return [
            ['。', '句点'],
            ['、', '読点'],
            ['！', '！'],
            ['？', '？'],
            ['.', '.'],
            ['!', '!'],
            ['?', '?']
        ];
    }

    getShiftBreakTargetMenuHtml(settings = this.getShiftNotePasteFormatSettings()) {
        return `
            <div class="shift-break-target-menu" onclick="event.stopPropagation()">
                <div class="shift-break-target-menu-title">改行対象</div>
                ${this.getShiftPastePunctuationOptions().map(([symbol, label]) => `
                    <label>
                        <input type="checkbox" value="${this.escapeHtml(symbol)}" ${settings.punctuation.includes(symbol) ? 'checked' : ''} onchange="app.updateShiftNotePasteAutoBreakPunctuation(this)">
                        <span>${this.escapeHtml(label)}</span>
                    </label>
                `).join('')}
            </div>
        `;
    }

    getShiftNotebookLivePasteRulerHtml() {
        const settings = this.getShiftNotePasteFormatSettings();
        return `
            <div class="shift-inline-paste-ruler">
                <div class="shift-break-target-control">
                    <button type="button" class="shift-break-target-stamp" title="貼り付け時、選んだ記号が赤線を越えた後に自動改行します。クリックで改行対象を選べます。" onclick="event.stopPropagation(); app.toggleShiftBreakTargetMenu(this)">
                        改行
                    </button>
                    ${this.getShiftBreakTargetMenuHtml(settings)}
                </div>
                <div class="shift-paste-ruler" id="shift-live-paste-ruler">
                    <span class="shift-paste-ruler-fill" style="width:${settings.ratioPercent}%"></span>
                    <span class="shift-paste-ruler-marker" style="left:${settings.ratioPercent}%"></span>
                </div>
                <input type="range" min="40" max="98" step="1" value="${settings.ratioPercent}" oninput="app.updateShiftNotePasteAutoBreakSetting('ratio', this.value)">
            </div>
        `;
    }

    closeShiftBreakTargetMenus(except = null) {
        document.querySelectorAll('.shift-break-target-control.open').forEach(control => {
            if (control !== except) control.classList.remove('open');
        });
    }

    toggleShiftBreakTargetMenu(button) {
        const control = button?.closest?.('.shift-break-target-control');
        if (!control) return;
        const willOpen = !control.classList.contains('open');
        this.closeShiftBreakTargetMenus(control);
        control.classList.toggle('open', willOpen);
        if (willOpen) {
            setTimeout(() => {
                document.addEventListener('click', this._shiftBreakTargetOutsideClick = (event) => {
                    if (event.target.closest?.('.shift-break-target-control')) return;
                    this.closeShiftBreakTargetMenus();
                    document.removeEventListener('click', this._shiftBreakTargetOutsideClick);
                    this._shiftBreakTargetOutsideClick = null;
                }, { once: true });
            }, 0);
        }
    }

    updateShiftNotebookLivePasteLines() {
        const globalRatio = this.getShiftNotePasteFormatSettings().ratioPercent;
        document.querySelector('.shift-notebook-modal')?.style.setProperty('--shift-break-line', `${globalRatio}%`);
        document.querySelectorAll('#shift-notebook-rows .shift-note-text').forEach(editor => {
            editor.style.setProperty('--shift-break-line', `${globalRatio}%`);
        });
        document.querySelectorAll('.shift-fullscreen-text-wrapper, .shift-fullscreen-content, .shift-fullscreen-text').forEach(element => {
            element.style.setProperty('--shift-break-line', `${globalRatio}%`);
        });
        document.querySelectorAll('#shift-paste-break-ratio-label').forEach(label => {
            label.textContent = `${globalRatio}%`;
        });
        document.querySelectorAll('#shift-paste-ruler, #shift-live-paste-ruler').forEach(ruler => {
            ruler.querySelector('.shift-paste-ruler-fill')?.style.setProperty('width', `${globalRatio}%`);
            ruler.querySelector('.shift-paste-ruler-marker')?.style.setProperty('left', `${globalRatio}%`);
        });
        document.querySelectorAll('.shift-paste-settings input[type="range"], .shift-inline-paste-ruler input[type="range"]').forEach(input => {
            input.value = String(globalRatio);
        });
    }

    isShiftNotebookBreakLineHidden() {
        return localStorage.getItem('shift_note_break_line_hidden') === 'true';
    }

    updateShiftNotebookBreakLineVisibility() {
        const hidden = this.isShiftNotebookBreakLineHidden();
        document.querySelector('.shift-notebook-modal')?.classList.toggle('shift-hide-break-line', hidden);
        document.querySelectorAll('.shift-fullscreen-overlay').forEach(overlay => {
            overlay.classList.toggle('shift-hide-break-line', hidden);
        });
        document.querySelectorAll('.shift-row-break-line-toggle').forEach(button => {
            button.classList.toggle('active', hidden);
            button.title = hidden ? '改行ラインを表示' : '改行ラインを非表示';
        });
    }

    toggleShiftNotebookBreakLine() {
        const hidden = !this.isShiftNotebookBreakLineHidden();
        localStorage.setItem('shift_note_break_line_hidden', String(hidden));
        this.updateShiftNotebookBreakLineVisibility();
        this.setShiftNotebookStatus(hidden ? '改行ラインを非表示にしました' : '改行ラインを表示しました', 'moved');
    }

    getShiftNoteRowPasteFormatSettings(row) {
        const fallback = { mode: 'inherit', ratioPercent: null };
        if (!row?.dataset?.pasteFormat) return fallback;
        try {
            const parsed = JSON.parse(row.dataset.pasteFormat);
            const mode = ['inherit', 'enabled', 'disabled'].includes(parsed?.mode) ? parsed.mode : 'inherit';
            const ratioPercent = null;
            return { mode, ratioPercent };
        } catch {
            return fallback;
        }
    }

    setShiftNoteRowPasteFormatSettings(row, settings = {}) {
        if (!row) return;
        const mode = ['inherit', 'enabled', 'disabled'].includes(settings.mode) ? settings.mode : 'inherit';
        const ratioPercent = null;
        row.dataset.pasteFormat = JSON.stringify({ mode, ratioPercent });
        row.classList.toggle('shift-row-paste-custom', mode !== 'inherit' || !!ratioPercent);
        this.updateShiftNoteRowPasteButton(row);
        const editor = row.querySelector?.('.shift-note-text');
        editor?.style.setProperty('--shift-break-line', `${this.getShiftNotePasteFormatSettings().ratioPercent}%`);
    }

    updateShiftNoteRowPasteButton(row) {
        const button = row?.querySelector?.('.shift-row-paste-settings');
        if (!button) return;
        const settings = this.getShiftNoteRowPasteFormatSettings(row);
        const custom = settings.mode !== 'inherit' || !!settings.ratioPercent;
        button.classList.toggle('active', custom);
        const modeLabel = settings.mode === 'disabled' ? '自動改行なし' : (settings.mode === 'enabled' ? '自動改行あり' : '全体設定');
        button.title = `この行の貼り付け整形: ${modeLabel}${settings.ratioPercent ? ` / ${settings.ratioPercent}%` : ''}`;
    }

    openShiftNoteRowPasteSettings(button) {
        const row = button?.closest('.shift-notebook-row');
        if (!row) return;
        const current = this.getShiftNoteRowPasteFormatSettings(row);
        const mode = prompt('この行の貼り付け整形を選んでください。\n0: 全体設定を使う\n1: この行だけ自動改行する\n2: この行だけ自動改行しない', current.mode === 'enabled' ? '1' : (current.mode === 'disabled' ? '2' : '0'));
        if (mode === null) return;
        const modeMap = { '0': 'inherit', '1': 'enabled', '2': 'disabled' };
        const nextMode = modeMap[String(mode).trim()] || 'inherit';
        this.setShiftNoteRowPasteFormatSettings(row, { mode: nextMode, ratioPercent: null });
        this.updateShiftNotebookLivePasteLines();
        this.scheduleShiftNotebookAutoSave();
        this.setShiftNotebookStatus('この行の貼り付け設定を保存しました', 'saved');
    }

    updateShiftNotePasteAutoBreakSetting(key, value) {
        if (key === 'enabled') {
            localStorage.setItem('shift_note_paste_auto_break_enabled', String(!!value));
        } else if (key === 'ratio') {
            const ratio = Math.max(40, Math.min(98, Number(value) || 70));
            localStorage.setItem('shift_note_paste_break_ratio', String(ratio));
            let clearedRowRatio = false;
            document.querySelectorAll('#shift-notebook-rows .shift-notebook-row').forEach(row => {
                const rowSettings = this.getShiftNoteRowPasteFormatSettings(row);
                if (rowSettings.ratioPercent) {
                    this.setShiftNoteRowPasteFormatSettings(row, { ...rowSettings, ratioPercent: null });
                    clearedRowRatio = true;
                }
            });
            if (clearedRowRatio) this.scheduleShiftNotebookAutoSave?.();
            document.querySelectorAll('.shift-live-break-line').forEach(line => line.style.left = `${ratio}%`);
            this.updateShiftNotebookLivePasteLines();
        }
        this.setShiftNotebookStatus('貼り付け整形設定を保存しました', 'saved');
    }

    updateShiftNotePasteAutoBreakPunctuation(source = null) {
        const scope = source?.closest?.('.shift-paste-symbols, .shift-break-target-menu') || document;
        const symbols = Array.from(scope.querySelectorAll('input[type="checkbox"]:checked'))
            .map(input => input.value)
            .join('');
        const nextSymbols = symbols || '。';
        localStorage.setItem('shift_note_paste_break_punctuation', nextSymbols);
        document.querySelectorAll('.shift-paste-symbols input[type="checkbox"], .shift-break-target-menu input[type="checkbox"]').forEach(input => {
            input.checked = nextSymbols.includes(input.value);
        });
        this.setShiftNotebookStatus('貼り付け整形設定を保存しました', 'saved');
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
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppShiftNotebookSettingsMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppShiftNotebookSettingsMethods.prototype[name];
        }
    }
})();
