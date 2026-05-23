(function () {
    if (typeof MaintenanceApp === 'undefined') return;

    class MaintenanceAppShiftNotebookEditorMethods extends MaintenanceApp {
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
        let range = editor._savedRange?.cloneRange();
        const hasSavedCursor = !!(range && editor.contains(range.commonAncestorContainer));
        if (!hasSavedCursor) {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
        }
        const fragment = document.createDocumentFragment();
        const text = this.stripShiftNoteHtml(editor.innerHTML).trim();
        if (!hasSavedCursor && text) fragment.appendChild(document.createTextNode(' '));
        const stamp = document.createElement('span');
        stamp.className = 'shift-note-member-stamp';
        stamp.textContent = memberName;
        stamp.setAttribute('contenteditable', 'false');
        fragment.appendChild(stamp);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        range.deleteContents();
        range.insertNode(fragment);
        const afterRange = document.createRange();
        afterRange.setStartAfter(stamp);
        afterRange.collapse(true);
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

        const previousHtml = this.sanitizeShiftNoteHtml(editor.innerHTML);
        const holder = document.createElement('div');
        const blankLineResult = this.cleanShiftNoteBlankLinesHtml(
            html ? this.sanitizeShiftNoteHtml(html) : this.shiftNoteTextToHtml(text)
        );
        holder.innerHTML = blankLineResult.html;

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
        const autoBreakChanged = this.insertShiftNoteAutoLineBreaksAtPeriods(holder, editor);
        const autoBreakPreviewNodes = holder._shiftAutoBreakPreviewNodes || [];

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
        this.showShiftNotePasteFormatFeedback(editor, previousHtml, {
            blankLines: blankLineResult.changed,
            autoBreaks: autoBreakChanged
        });
        if (autoBreakPreviewNodes.length > 0) {
            requestAnimationFrame(() => autoBreakPreviewNodes.forEach(node => node.classList.add('show')));
            setTimeout(() => autoBreakPreviewNodes.forEach(node => node.classList.remove('show')), 10000);
            setTimeout(() => {
                autoBreakPreviewNodes.forEach(node => {
                    while (node.firstChild) node.parentNode?.insertBefore(node.firstChild, node);
                    node.remove();
                });
            }, 10400);
        }
        return true;
    }

    // アクティブ装飾モードのインジケーター（ボタン表示）を更新する
    showShiftNotePasteFormatFeedback(editor, previousHtml, result = {}) {
        const changedLabels = [];
        if (result.blankLines) changedLabels.push('空白行削除');
        if (result.autoBreaks) changedLabels.push('自動改行');
        const message = changedLabels.length
            ? `貼り付けを整形しました: ${changedLabels.join(' / ')}`
            : '貼り付けました';
        this.setShiftNotebookStatus(message, changedLabels.length ? 'saved' : 'moved');
        const extraAction = result.autoBreaks ? {
            label: '改行だけ戻す',
            callback: () => this.removeShiftNoteAutoBreaks(editor)
        } : null;
        this.showUndoNotice(message, () => {
            if (!editor) return;
            editor.innerHTML = previousHtml;
            this.cleanupShiftNoteEmptySpans(editor);
            this.resizeShiftNoteEditor(editor);
            requestAnimationFrame(() => this.resizeShiftNoteEditor(editor));
            this.autoSaveShiftNotebook(true);
            this.setShiftNotebookStatus('貼り付けを取り消しました', 'moved');
            editor.focus();
        }, null, document.getElementById('modal-container') || document.body, 'paste-format', {
            duration: result.autoBreaks ? 10 : 5,
            extraAction
        });
    }

    removeShiftNoteAutoBreaks(editor) {
        if (!editor) return;
        editor.querySelectorAll('.shift-paste-autobreak-preview').forEach(node => {
            while (node.firstChild) node.parentNode?.insertBefore(node.firstChild, node);
            node.remove();
        });
        const breaks = Array.from(editor.querySelectorAll('br[data-shift-auto-break="true"]'));
        if (breaks.length === 0) {
            this.setShiftNotebookStatus('戻せる自動改行はありません', 'moved');
            return;
        }
        breaks.forEach(br => br.remove());
        this.cleanupShiftNoteEmptySpans(editor);
        this.resizeShiftNoteEditor(editor);
        requestAnimationFrame(() => this.resizeShiftNoteEditor(editor));
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        this.autoSaveShiftNotebook(true);
        this.setShiftNotebookStatus(`${breaks.length}件の自動改行を戻しました`, 'saved');
        editor.focus();
    }

    insertShiftNoteAutoLineBreaksAtPeriods(holder, editor) {
        if (!holder || !editor) return false;
        const settings = this.getShiftNotePasteFormatSettings(editor);
        if (!settings.enabled) return false;
        const punctuation = Array.from(settings.punctuation || '。');
        if (punctuation.length === 0) return false;
        const computed = window.getComputedStyle(editor);
        const probe = document.createElement('span');
        probe.setAttribute('contenteditable', 'false');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.display = 'block';
        probe.style.visibility = 'hidden';
        probe.style.pointerEvents = 'none';
        probe.style.whiteSpace = 'pre-wrap';
        probe.style.wordBreak = computed.wordBreak;
        probe.style.overflowWrap = computed.overflowWrap;
        probe.style.width = '100%';
        probe.style.boxSizing = 'border-box';
        probe.style.font = computed.font;
        probe.style.fontFamily = computed.fontFamily;
        probe.style.fontSize = computed.fontSize;
        probe.style.fontWeight = computed.fontWeight;
        probe.style.lineHeight = computed.lineHeight;
        probe.style.letterSpacing = computed.letterSpacing;
        const formats = this._activeShiftNoteFormats || {};
        if (formats.size) probe.style.fontSize = formats.size;
        if (formats.font) probe.style.fontFamily = formats.font;
        const probeMarker = document.createElement('span');
        probeMarker.style.display = 'inline-block';
        probeMarker.style.width = '0';
        probeMarker.style.height = '1em';
        probeMarker.style.overflow = 'hidden';
        editor.appendChild(probe);

        const getLineMetrics = (text) => {
            probe.replaceChildren(document.createTextNode(text || ''), probeMarker);
            const range = document.createRange();
            if (probe.firstChild) range.selectNodeContents(probe.firstChild);
            const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0);
            range.detach?.();
            const editorRect = editor.getBoundingClientRect();
            const markerRect = probeMarker.getBoundingClientRect();
            return {
                lineCount: Math.max(1, rects.length),
                progress: markerRect && editorRect.width
                    ? Math.max(0, Math.min(1, (markerRect.left - editorRect.left) / editorRect.width))
                    : 0
            };
        };

        let lineText = '';
        let changed = false;
        const previewNodes = [];
        holder._shiftAutoBreakPreviewNodes = previewNodes;
        const breakRatio = settings.ratioPercent / 100;
        const editorRect = editor.getBoundingClientRect();
        const fontSizePx = Number.parseFloat(probe.style.fontSize || computed.fontSize) || 16;
        const breakAfterLineMargin = editorRect.width
            ? Math.min(0.08, Math.max(0.018, (fontSizePx * 1.2) / editorRect.width))
            : 0.025;
        const appendPart = (fragment, text, highlightTail = false) => {
            if (!text) return;
            if (!highlightTail) {
                fragment.appendChild(document.createTextNode(text));
                return;
            }
            const tailLength = Math.min(14, text.length);
            const head = text.slice(0, -tailLength);
            const tail = text.slice(-tailLength);
            if (head) fragment.appendChild(document.createTextNode(head));
            const marker = document.createElement('span');
            marker.className = 'shift-paste-autobreak-preview';
            marker.textContent = tail;
            previewNodes.push(marker);
            fragment.appendChild(marker);
        };
        const splitTextNode = (node) => {
            const text = node.textContent || '';
            if (!text) return;
            const fragment = document.createDocumentFragment();
            let part = '';
            for (const char of text) {
                if (char === '\r') continue;
                if (char === '\n') {
                    appendPart(fragment, part);
                    fragment.appendChild(document.createElement('br'));
                    part = '';
                    lineText = '';
                    changed = true;
                    continue;
                }
                part += char;
                const candidate = lineText + char;
                const metrics = getLineMetrics(candidate);
                if (metrics.lineCount > 1) {
                    lineText = char;
                    continue;
                }
                lineText = candidate;
                if (punctuation.includes(char) && metrics.progress >= breakRatio + breakAfterLineMargin) {
                    appendPart(fragment, part, true);
                    const autoBreak = document.createElement('br');
                    autoBreak.dataset.shiftAutoBreak = 'true';
                    fragment.appendChild(autoBreak);
                    part = '';
                    lineText = '';
                    changed = true;
                }
            }
            appendPart(fragment, part);
            node.replaceWith(fragment);
        };
        const walk = (node) => {
            if (node.nodeName === 'BR') {
                lineText = '';
                return;
            }
            if (node.nodeType === Node.TEXT_NODE) {
                splitTextNode(node);
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            Array.from(node.childNodes).forEach(child => walk(child));
        };

        Array.from(holder.childNodes).forEach(child => walk(child));
        probe.remove();
        return changed;
    }

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
        const fiveSStamp = row.querySelector('.shift-5s-stamp');
        const editor = row.querySelector('.shift-note-text');
        if (!editor) return;
        const top = editor.offsetTop - ((stamp?.offsetHeight || fiveSStamp?.offsetHeight || 24) * 0.7);
        const left = editor.offsetLeft;
        if (stamp) {
            if (row.classList.contains('shift-row-important')) {
                stamp.style.left = `${left}px`;
                stamp.style.top = `${top}px`;
            } else {
                stamp.style.left = '';
                stamp.style.top = '';
            }
        }
        if (fiveSStamp) {
            if (row.classList.contains('shift-row-5s')) {
                const importantWidth = row.classList.contains('shift-row-important') ? (stamp?.offsetWidth || 46) + 6 : 0;
                fiveSStamp.style.left = `${left + importantWidth}px`;
                fiveSStamp.style.top = `${top}px`;
            } else {
                fiveSStamp.style.left = '';
                fiveSStamp.style.top = '';
            }
        }
    }

    cleanShiftNoteBlankLinesHtml(html = '') {
        const before = this.sanitizeShiftNoteHtml(html);
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
        return { html: after, changed: after !== before };
    }

    removeShiftNoteBlankLines(button) {
        const row = button?.closest('.shift-notebook-row');
        const editor = row?.querySelector('.shift-note-text');
        if (!editor) return;

        const before = this.sanitizeShiftNoteHtml(editor.innerHTML);
        const result = this.cleanShiftNoteBlankLinesHtml(before);
        const after = result.html;
        if (!result.changed) {
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
        this.updateShiftNotebookLivePasteLines();
        this.updateShiftNotebookBreakLineVisibility();

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
    }

    for (const name of Object.getOwnPropertyNames(MaintenanceAppShiftNotebookEditorMethods.prototype)) {
        if (name !== 'constructor') {
            MaintenanceApp.prototype[name] = MaintenanceAppShiftNotebookEditorMethods.prototype[name];
        }
    }
})();
