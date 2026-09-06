(function () {
    if (typeof MaintenanceApp === 'undefined') return;
    const proto = MaintenanceApp.prototype;
    const clamp = (value, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(Number(value)) ? Number(value) : fallback));
    const point = value => ({ x: clamp(value?.x, 0, 1, .5), y: clamp(value?.y, 0, 1, .5), zoom: clamp(value?.zoom, 1, 4, 1) });
    const normal = value => ({
        enabled: value?.enabled === true,
        from: point(value?.from), to: point(value?.to),
        duration: clamp(value?.duration, 300, 10000, 3000)
    });
    proto.normalizeShiftPhotoCamera = normal;
    proto.getShiftPhotoCamera = function (mark, index = Number(mark?.dataset?.currentPage) || 0) {
        return normal(this.getShiftPhotoCompareMarkPagesFromDataset(mark)[index]?.camera);
    };
    proto.getShiftPhotoCameraPose = function (camera, progress) {
        const t = clamp(progress, 0, 1, 1);
        const eased = t * t * (3 - 2 * t);
        return Object.fromEntries(['x', 'y', 'zoom'].map(key =>
            [key, camera.from[key] + (camera.to[key] - camera.from[key]) * eased]));
    };
    proto.drawShiftPhotoCameraFrame = function (ctx, img, width, height, pose, mark = {}) {
        const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        if (!iw || !ih) return;
        const circle = mark.dataset?.imageShape === 'circle';
        const fill = mark.dataset?.imageFit === 'fill' || circle;
        const scale = Math.min(width / iw, height / ih);
        const w = fill ? width : iw * scale, h = fill ? height : ih * scale;
        let sw = iw / pose.zoom, sh = ih / pose.zoom;
        if (circle) {
            sw = Math.min(iw, ih) / pose.zoom;
            sh = sw;
        }
        const sx = clamp(pose.x * iw - sw / 2, 0, iw - sw, 0);
        const sy = clamp(pose.y * ih - sh / 2, 0, ih - sh, 0);
        ctx.save();
        if (circle) {
            ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2); ctx.clip();
        }
        ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
        ctx.restore();
    };
    proto.stopShiftPhotoCamera = function (mark) {
        if (!mark) return;
        cancelAnimationFrame(mark._photoCameraFrame);
        mark._photoCameraFrame = 0;
        mark._photoCameraGeneration = (mark._photoCameraGeneration || 0) + 1;
    };
    proto.applyShiftPhotoCamera = function (mark, config, progress = 1) {
        if (mark?.dataset?.mode !== 'image') return;
        const camera = normal(config);
        const inAnimation = mark.closest('.shift-photo-compare-animation-overlay');
        if (!camera.enabled || !inAnimation) {
            this.stopShiftPhotoCamera(mark);
            mark.classList.remove('photo-camera-active');
            delete mark.dataset.photoCameraPose;
            mark.querySelector(':scope > .photo-camera-canvas')?.remove();
            return;
        }
        const img = mark.querySelector(':scope > img:not(.shift-photo-compare-image-slide-copy)');
        if (!img) return;
        const pose = this.getShiftPhotoCameraPose(camera, progress);
        mark.dataset.photoCameraPose = JSON.stringify(pose);
        mark.classList.add('photo-camera-active');
        if (!img.complete || !img.naturalWidth) return;
        let canvas = mark.querySelector(':scope > .photo-camera-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'photo-camera-canvas';
            canvas.width = canvas.height = 1024;
            mark.appendChild(canvas);
        }
        canvas.style.transform = 'scale(' + (mark.dataset.flipX === '-1' ? -1 : 1) + ',' + (mark.dataset.flipY === '-1' ? -1 : 1) + ')';
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 1024, 1024);
        ctx.save(); ctx.translate(512, 512);
        this.drawShiftPhotoCameraFrame(ctx, img, 1024, 1024, pose, mark);
        ctx.restore();
        mark.classList.add('photo-camera-active');
    };
    proto.startShiftPhotoCamera = function (mark, config) {
        this.stopShiftPhotoCamera(mark);
        const camera = normal(config);
        if (!camera.enabled) return this.applyShiftPhotoCamera(mark, camera);
        const generation = mark._photoCameraGeneration;
        const image = mark.querySelector(':scope > img:not(.shift-photo-compare-image-slide-copy)');
        const begin = async () => {
            try { await image?.decode?.(); } catch (_) {}
            if (generation !== mark._photoCameraGeneration || !mark.isConnected) return;
            const started = performance.now();
            const frame = now => {
                if (!mark.isConnected || generation !== mark._photoCameraGeneration) return;
                const t = Math.min(1, (now - started) / camera.duration);
                this.applyShiftPhotoCamera(mark, camera, t);
                if (t < 1) mark._photoCameraFrame = requestAnimationFrame(frame);
            };
            frame(started);
        };
        void begin();
    };
    proto.getShiftPhotoCameraStepTargets = function (step) {
        const entries = [
            ...(step?.pageEntry ? [step.pageEntry] : []),
            ...this.getShiftPhotoCompareAnimationStepSyncedPageEntries(step)
        ].filter(entry => entry.type === 'imagePage');
        const targets = new Map(entries.map(entry => [entry.mark, this.getShiftPhotoCamera(entry.mark, entry.pageIndex)]));
        if (!step?.motion) (step?.items || (step?.item ? [step.item] : [])).forEach(item => {
            if (item.mark?.dataset?.mode === 'image' && !targets.has(item.mark)) targets.set(item.mark, this.getShiftPhotoCamera(item.mark));
        });
        return targets;
    };
    proto.getShiftPhotoCameraStepDuration = function (step) {
        return Math.max(0, ...Array.from(this.getShiftPhotoCameraStepTargets(step).values())
            .map(camera => camera.enabled ? camera.duration : 0));
    };
    proto.startShiftPhotoCameraStep = function (step) {
        this._shiftPhotoCompareAnimationState?.overlay?.querySelectorAll('.photo-camera-active')
            .forEach(mark => this.stopShiftPhotoCamera(mark));
        this.getShiftPhotoCameraStepTargets(step).forEach((camera, mark) => this.startShiftPhotoCamera(mark, camera));
    };
    proto.snapshotShiftPhotoCameraStep = function (step, progress) {
        this.getShiftPhotoCameraStepTargets(step).forEach((camera, mark) => {
            this.stopShiftPhotoCamera(mark);
            this.applyShiftPhotoCamera(mark, camera, typeof progress === 'number' ? progress : 1);
        });
    };
    for (const name of ['getShiftPhotoCompareAnimationStepHoldMs', 'getShiftPhotoCompareAnimationStepEffectDuration']) {
        const original = proto[name];
        proto[name] = function (step, ...args) {
            return Math.max(original.call(this, step, ...args), this.getShiftPhotoCameraStepDuration(step));
        };
    }
    const openMenu = proto.openShiftPhotoCompareAnimationPhotoSyncMenu;
    proto.openShiftPhotoCompareAnimationPhotoSyncMenu = function (event, id) {
        openMenu.call(this, event, id);
        const menu = document.querySelector('.shift-photo-compare-animation-photo-sync-menu');
        if (!menu) return;
        const button = document.createElement('button');
        button.className = 'photo-camera-menu-button';
        button.innerHTML = '<i class="fa-solid fa-magnifying-glass-plus"></i><span>カメラ移動</span>';
        button.onclick = () => { this.closeShiftPhotoCompareAnimationPhotoSyncMenu(); this.openShiftPhotoCameraEditor(id); };
        menu.querySelector('header').after(button);
    };
    proto.persistShiftPhotoPageVisualSetting = function (entry, field, value) {
        if (!['camera', 'reveal'].includes(field)) return false;
        const state = this._shiftPhotoCompareAnimationState;
        const page = state?.pages?.[state.pageIndex];
        if (!page || state.videoRecording) return false;
        const source = this.getShiftPhotoCompareAnimationTimelineSourceDomMark(entry.mark, page);
        if (source) {
            const pages = this.getShiftPhotoCompareMarkPagesFromDataset(source);
            if (!pages[entry.pageIndex]) return false;
            pages[entry.pageIndex][field] = value;
            source.dataset.pages = JSON.stringify(pages);
            this.syncShiftPhotoCompareChangedMarkWraps([source]);
        } else {
            const row = page.row, mark = entry.mark;
            if (!row) return false;
            const scope = mark.dataset.animationSourceScope;
            let data, save;
            if (scope === 'global') {
                data = this.parseShiftPhotoCompareMarks(row.dataset.shiftPhotoGlobalMarks || '[]');
                save = value => { row.dataset.shiftPhotoGlobalMarks = JSON.stringify(this.compactShiftPhotoCompareMarkImages(value)); };
            } else if (scope === 'photo') {
                const photo = this.getShiftPhotoCompareItems(row).find(item => item.index === Number(mark.dataset.animationSourcePhotoIndex));
                if (!photo?.previewItem) return false;
                data = this.parseShiftPhotoCompareMarks(photo.previewItem.dataset.shiftPhotoMarks || '[]');
                save = value => { photo.previewItem.dataset.shiftPhotoMarks = JSON.stringify(this.compactShiftPhotoCompareMarkImages(value)); };
            }
            const sourceMark = data?.[Number(mark.dataset.animationSourceMarkIndex) || 0];
            if (!sourceMark || !save) return false;
            const pages = this.normalizeShiftPhotoCompareMarkPages(sourceMark);
            if (!pages[entry.pageIndex]) return false;
            pages[entry.pageIndex][field] = value;
            sourceMark.pages = pages; save(data);
        }
        const pages = this.getShiftPhotoCompareMarkPagesFromDataset(entry.mark);
        pages[entry.pageIndex][field] = value;
        entry.mark.dataset.pages = JSON.stringify(pages);
        this.autoSaveShiftNotebook?.(true);
        return true;
    };
    proto.persistShiftPhotoCamera = function (entry, camera) { return this.persistShiftPhotoPageVisualSetting(entry, 'camera', normal(camera)); };
    proto.openShiftPhotoCameraEditor = function (id) {
        const entry = this.getShiftPhotoCompareAnimationTimelineEntry(id);
        const state = this._shiftPhotoCompareAnimationState;
        if (!entry || entry.type !== 'imagePage' || !state || state.videoRecording) return;
        if (state.timer) this.toggleShiftPhotoCompareAnimationAutoPlay();
        document.querySelector('.photo-camera-dialog')?.close();
        const page = this.getShiftPhotoCompareMarkPagesFromDataset(entry.mark)[entry.pageIndex];
        let draft = normal(page.camera), selected = 'to', previewFrame = 0;
        const dialog = document.createElement('dialog');
        dialog.className = 'photo-camera-dialog';
        dialog.innerHTML = `
            <form method="dialog"><header><strong>カメラ移動 · ${this.escapeHtml(entry.sourceLabel)} ${entry.pageNumber}P</strong><button value="cancel" aria-label="閉じる">×</button></header></form>
            <label class="photo-camera-enable"><input type="checkbox" data-enabled>カメラ移動を使う</label>
            <div class="photo-camera-point-tabs"><button type="button" data-point="from">開始位置</button><button type="button" data-point="to">終了位置</button></div>
            <canvas class="photo-camera-map" width="800" height="450" title="注目する位置をクリック" aria-label="注目する位置をクリック"></canvas>
            <div class="photo-camera-fields">
                <label>倍率 <input data-zoom type="range" min="1" max="4" step=".05"><output data-zoom-label></output></label>
                <label>移動時間 <input data-duration type="number" min=".3" max="10" step=".1"> 秒</label>
                <button type="button" data-full><i class="fa-solid fa-expand"></i> 全体へ戻す</button>
            </div>
            <canvas class="photo-camera-preview" width="800" height="450" aria-label="カメラ移動プレビュー"></canvas>
            <footer><button type="button" data-preview><i class="fa-solid fa-play"></i> 試し再生</button><button type="button" data-save>保存</button></footer>`;
        const img = new Image();
        const map = dialog.querySelector('.photo-camera-map'), preview = dialog.querySelector('.photo-camera-preview');
        const mapRect = () => {
            const scale = Math.min(map.width / img.naturalWidth, map.height / img.naturalHeight);
            return { w: img.naturalWidth * scale, h: img.naturalHeight * scale };
        };
        const draw = (progress = null) => {
            if (!img.naturalWidth) return;
            const ctx = map.getContext('2d'), { w, h } = mapRect(), p = draft[selected];
            ctx.clearRect(0, 0, 800, 450); ctx.drawImage(img, (800-w)/2, (450-h)/2, w, h);
            ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 3;
            ctx.strokeRect((800-w)/2 + clamp(p.x*w-w/p.zoom/2,0,w-w/p.zoom,0),
                (450-h)/2 + clamp(p.y*h-h/p.zoom/2,0,h-h/p.zoom,0), w/p.zoom, h/p.zoom);
            const px = preview.getContext('2d'); px.clearRect(0,0,800,450);px.save();px.translate(400,225);
            this.drawShiftPhotoCameraFrame(px,img,800,450,progress === null ? p : this.getShiftPhotoCameraPose(draft,progress),{dataset:{}});
            px.restore();
        };
        const sync = () => {
            dialog.querySelector('[data-enabled]').checked = draft.enabled;
            dialog.querySelector('[data-zoom]').value = draft[selected].zoom;
            dialog.querySelector('[data-zoom-label]').textContent = draft[selected].zoom.toFixed(2) + '倍';
            dialog.querySelector('[data-duration]').value = draft.duration/1000;
            dialog.querySelectorAll('[data-point]').forEach(b => b.classList.toggle('active',b.dataset.point===selected));
            draw();
        };
        dialog.querySelectorAll('[data-point]').forEach(b => b.onclick=()=>{cancelAnimationFrame(previewFrame);selected=b.dataset.point;sync();});
        map.onpointerdown = event => {
            if (!img.naturalWidth) return;
            cancelAnimationFrame(previewFrame);
            const r=map.getBoundingClientRect(), {w,h}=mapRect();
            draft[selected].x=clamp(((event.clientX-r.left)/r.width*800-(800-w)/2)/w,0,1,.5);
            draft[selected].y=clamp(((event.clientY-r.top)/r.height*450-(450-h)/2)/h,0,1,.5);
            draft.enabled=true;sync();
        };
        dialog.querySelector('[data-zoom]').oninput=e=>{cancelAnimationFrame(previewFrame);draft[selected].zoom=Number(e.target.value);draft.enabled=true;sync();};
        dialog.querySelector('[data-duration]').onchange=e=>{draft.duration=clamp(Number(e.target.value)*1000,300,10000,3000);sync();};
        dialog.querySelector('[data-enabled]').onchange=e=>{draft.enabled=e.target.checked;};
        dialog.querySelector('[data-full]').onclick=()=>{cancelAnimationFrame(previewFrame);draft[selected]=point();draft.enabled=true;sync();};
        dialog.querySelector('[data-preview]').onclick=()=>{
            cancelAnimationFrame(previewFrame);const start=performance.now();
            const frame=now=>{const t=Math.min(1,(now-start)/draft.duration);draw(t);if(t<1)previewFrame=requestAnimationFrame(frame);};
            previewFrame=requestAnimationFrame(frame);
        };
        dialog.querySelector('[data-save]').onclick=()=>{
            if (!this.persistShiftPhotoCamera(entry,draft)) {this.showToast?.('保存できませんでした。元の写真を確認してください。');return;}
            if (Number(entry.mark.dataset.currentPage)===entry.pageIndex) this.startShiftPhotoCamera(entry.mark,draft);
            this.showToast?.('カメラ移動を保存しました。');dialog.close();
        };
        dialog.onclose=()=>{cancelAnimationFrame(previewFrame);dialog.remove();};
        img.onload=sync;
        img.src=page.imageSrc;
        state.overlay.appendChild(dialog);dialog.showModal();sync();
    };
})();
