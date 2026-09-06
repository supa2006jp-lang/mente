(function () {
    if (typeof MaintenanceApp === 'undefined') return;
    const p = MaintenanceApp.prototype;
    p.getShiftPhotoRevealLabel = function (config, index) {
        return config.labelMode === 'none' ? '' : config.labelMode === 'number' ? String(index + 1) : config.labelMode === 'answer' ? '答えを見る' : '?';
    };
    p.getShiftPhotoRevealInk = function (color) {
        const rgb = color.slice(1).match(/../g).map(v => parseInt(v, 16) / 255);
        const linear = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        const light = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722 > .179;
        return light ? { color: '#000000', background: 'rgba(255,255,255,.18)', borderColor: 'rgba(0,0,0,.55)' }
            : { color: '#ffffff', background: 'rgba(0,0,0,.14)', borderColor: 'rgba(255,255,255,.65)' };
    };
    p.consumeShiftPhotoRevealClick = function (event) {
        const overlay = this._shiftPhotoCompareAnimationState?.overlay;
        if (!overlay || event.target.closest('button, input, select, textarea, .shift-photo-compare-animation-controls, .shift-photo-compare-animation-topbar, .shift-photo-compare-animation-timeline, .shift-photo-compare-animation-timeline-dialog, .shift-photo-compare-speech-settings')) return false;
        const marks = Array.from(overlay.querySelectorAll('.shift-photo-compare-mark.image')).filter(mark => {
            const rect = mark.getBoundingClientRect();
            const style = getComputedStyle(mark);
            return !mark.classList.contains('shift-photo-compare-animation-hidden') && rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0;
        });
        const target = event.target.closest('.shift-photo-compare-mark.image');
        if (target) marks.sort((a, b) => Number(b === target) - Number(a === target));
        for (const mark of marks) {
            const config = this.getShiftPhotoReveal(mark);
            const amounts = this.getShiftPhotoRevealAmounts(mark);
            const index = config.enabled ? config.areas.findIndex((_, i) => (amounts[i] || 0) < 1) : -1;
            if (index < 0) continue;
            event.preventDefault();
            event.stopImmediatePropagation();
            this.openShiftPhotoRevealArea(mark, index);
            return true;
        }
        return false;
    };
    const num = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(Number(v)) ? Number(v) : fallback));
    p.normalizeShiftPhotoReveal = function (value) {
        const areas = (Array.isArray(value?.areas) ? value.areas : []).slice(0, 12).map(a => {
            const x = num(a?.x, 0, .98, 0), y = num(a?.y, 0, .98, 0);
            return { x, y, w: num(a?.w, .02, 1-x, .2), h: num(a?.h, .02, 1-y, .2) };
        });
        return { enabled: value?.enabled === true, areas,
            effect: ['horizontal','fade','flip','up'].includes(value?.effect)?value.effect:'horizontal',
            labelMode: ['question','number','answer','none'].includes(value?.labelMode) ? value.labelMode : 'question',
            color: /^#[0-9a-f]{6}$/i.test(value?.color || '') ? value.color : '#087f8c',
            popType: ['pop','snap','chime'].includes(value?.popType)?value.popType:'pop',
            slideType: value?.slideType==='soft'?'soft':'swish',
            slideVolume: num(value?.slideVolume,0,1,num(value?.soundVolume,0,1,.35)),
            soundEnabled: value?.soundEnabled !== false, slideSoundEnabled: value?.slideSoundEnabled !== false, soundVolume: num(value?.soundVolume,0,1,.35),
            delay: num(value?.delay, 500, 15000, 2500) };
    };
    p.getShiftPhotoReveal = function (mark) {
        return this.normalizeShiftPhotoReveal(this.getShiftPhotoCompareMarkPagesFromDataset(mark)[Number(mark.dataset.currentPage) || 0]?.reveal);
    };
    p.getShiftPhotoRevealGeometry = function (mark, img, size, area) {
        const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        let pose = {x:.5,y:.5,zoom:1};
        try { pose = JSON.parse(mark.dataset.photoCameraPose || 'null') || pose; } catch (_) {}
        const circle = mark.dataset.imageShape === 'circle';
        const fill = mark.dataset.imageFit === 'fill' || circle;
        const scale = Math.min(size/iw,size/ih);
        const w = fill ? size : iw*scale, h = fill ? size : ih*scale;
        let sw=iw/pose.zoom, sh=ih/pose.zoom;
        if(circle) sw=sh=Math.min(iw,ih)/pose.zoom;
        const sx=num(pose.x*iw-sw/2,0,iw-sw,0), sy=num(pose.y*ih-sh/2,0,ih-sh,0);
        const x0=Math.max(0,(area.x*iw-sx)/sw), y0=Math.max(0,(area.y*ih-sy)/sh);
        const x1=Math.min(1,((area.x+area.w)*iw-sx)/sw), y1=Math.min(1,((area.y+area.h)*ih-sy)/sh);
        return {x:-w/2+x0*w,y:-h/2+y0*h,w:Math.max(0,x1-x0)*w,h:Math.max(0,y1-y0)*h};
    };
    p.getShiftPhotoRevealAmounts = function (mark) {
        try { return JSON.parse(mark.dataset.photoRevealAmounts || '[]'); } catch (_) { return []; }
    };
    p.drawShiftPhotoRevealArea = function(ctx,r,config,i,size,remaining=1) {
        if(r.w<=0||r.h<=0||remaining<=0)return;
            ctx.save();ctx.translate(r.x,r.y);
            if(config.effect==='fade')ctx.globalAlpha*=remaining;
            else if(config.effect==='flip'){ctx.translate(r.w/2,0);ctx.scale(Math.cos((1-remaining)*Math.PI/2),1);ctx.translate(-r.w/2,0);}
            else if(config.effect==='up')ctx.scale(1,remaining);
            else ctx.scale(remaining,1);
            const edge=Math.min(r.w,r.h), radius=Math.min(size*.012,edge*.08), badge=edge*.56;
            ctx.beginPath();ctx.roundRect(0,0,r.w,r.h,radius);ctx.clip();
            ctx.fillStyle=config.color;ctx.fillRect(0,0,r.w,r.h);
            const label=this.getShiftPhotoRevealLabel(config,i), wide=config.labelMode==='answer';
            const bw=wide?r.w*.82:badge, bh=wide?Math.min(r.h*.56,bw*.3):badge;
            if(label){
            ctx.beginPath();ctx.roundRect((r.w-bw)/2,(r.h-bh)/2,bw,bh,bh/2);
            const ink=this.getShiftPhotoRevealInk(config.color);
            ctx.fillStyle=ink.background;ctx.fill();
            ctx.strokeStyle=ink.borderColor;ctx.lineWidth=Math.max(.25,badge*.035);ctx.stroke();
            ctx.fillStyle=ink.color;ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.font='900 '+Math.min(bh*.6,bw/(label.length===1?1:label.length)*.85)+'px Arial,sans-serif';
            ctx.fillText(label,r.w/2,r.h/2,bw*.86);
            }
            ctx.restore();
    };
    p.drawShiftPhotoReveal = function (ctx, mark, img, size) {
        if (!mark.dataset.photoRevealAmounts) return;
        const config=this.getShiftPhotoReveal(mark), amounts=this.getShiftPhotoRevealAmounts(mark);
        if(!config.enabled) return;
        ctx.save();
        if(mark.dataset.imageShape==='circle'){ctx.beginPath();ctx.arc(0,0,size/2,0,Math.PI*2);ctx.clip();}
        config.areas.forEach((area,i)=>{
            const r=this.getShiftPhotoRevealGeometry(mark,img,size,area), remaining=1-(amounts[i]||0);
            if(remaining<=0||r.w<=0||r.h<=0)return;
            this.drawShiftPhotoRevealArea(ctx,r,config,i,size,remaining);
        });
        ctx.restore();
    };
    p.stopShiftPhotoReveal = function (mark) {
        (mark._photoRevealTimers||[]).forEach(clearTimeout);mark._photoRevealTimers=[];
        cancelAnimationFrame(mark._photoRevealFrame);
        mark._photoRevealOpening = new Map();
        mark._photoRevealGeneration=(mark._photoRevealGeneration||0)+1;
    };
    p.renderShiftPhotoReveal = function (mark) {
        if(mark?.dataset?.mode!=='image')return;
        const config=this.getShiftPhotoReveal(mark);
        if(!config.enabled||!config.areas.length||!mark.closest('.shift-photo-compare-animation-overlay')){
            this.stopShiftPhotoReveal(mark);
            mark.querySelector(':scope > .photo-reveal-layer')?.remove();
            delete mark.dataset.photoRevealAmounts;mark.classList.remove('photo-reveal-loading');return;
        }
        const img=mark.querySelector(':scope > img:not(.shift-photo-compare-image-slide-copy)');
        if (!img) return;
        if (!img._photoRevealLoadBound) {
            img._photoRevealLoadBound = true;
            img.addEventListener('load', () => { if (mark.isConnected) this.renderShiftPhotoReveal(mark); });
            img.addEventListener('error', () => mark.classList.remove('photo-reveal-loading'));
        }
        if (!img.complete || !img.naturalWidth) { mark.classList.add('photo-reveal-loading'); return; }
        mark.classList.remove('photo-reveal-loading');
        let layer=mark.querySelector(':scope > .photo-reveal-layer');
        if(!layer){layer=document.createElement('div');layer.className='photo-reveal-layer';mark.appendChild(layer);}
        layer.style.transform='scale('+(mark.dataset.flipX==='-1'?-1:1)+','+(mark.dataset.flipY==='-1'?-1:1)+')';
        layer.style.clipPath=mark.dataset.imageShape==='circle'?'circle(50%)':'none';
        if(layer.children.length!==config.areas.length){
            layer.replaceChildren();
            config.areas.forEach((_,i)=>{
                const b=document.createElement('button');b.type='button';b.textContent='?';b.title='隠し部分を表示';
                b.setAttribute('aria-label','隠し部分 '+(i+1)+' を表示');
                b.onpointerdown=e=>e.stopPropagation();
                b.onclick=e=>{e.preventDefault();e.stopPropagation();this.openShiftPhotoRevealArea(mark,i);};
                layer.appendChild(b);
            });
        }
        const amounts=this.getShiftPhotoRevealAmounts(mark);
        config.areas.forEach((area,i)=>{
            const r=this.getShiftPhotoRevealGeometry(mark,img,100,area), b=layer.children[i], amount=amounts[i]||0;
            Object.assign(b.style,{left:(50+r.x)+'%',top:(50+r.y)+'%',width:r.w+'%',height:r.h+'%',
                background:config.color,opacity:config.effect==='fade'?String(1-amount):'1',transformOrigin:config.effect==='flip'?'center center':config.effect==='up'?'center top':'left center',transform:config.effect==='fade'?'none':config.effect==='flip'?'rotateY('+(amount*90)+'deg)':config.effect==='up'?'scaleY('+(1-amount)+')':'scaleX('+(1-amount)+')',visibility:r.w&&r.h&&amount<1?'visible':'hidden'});
            let question=b.querySelector('.photo-reveal-question');
            if(!question){question=document.createElement('span');question.className='photo-reveal-question';question.textContent='?';question.setAttribute('aria-hidden','true');b.replaceChildren(question);}
            const size=mark.clientWidth || Number(mark.dataset.size) || 100;
            const edge=Math.min(r.w*size/100,r.h*(mark.clientHeight||size)/100), badge=edge*.56;
            Object.assign(question.style,this.getShiftPhotoRevealInk(config.color),{fontWeight:'900'});
            b.style.borderRadius=Math.min(size*.012,edge*.08)+'px';
                        const label=this.getShiftPhotoRevealLabel(config,i),wide=config.labelMode==='answer';
            const bw=wide?r.w*size/100*.82:badge,bh=wide?Math.min(edge*.56,bw*.3):badge;
            question.textContent=label;
            Object.assign(question.style,{display:label?'flex':'none',width:bw+'px',height:bh+'px',borderRadius:(bh/2)+'px',fontSize:Math.min(bh*.6,bw/(label.length||1)*.85)+'px',borderWidth:Math.max(.25,badge*.035)+'px'});
            // Cloned animation pages retain elements, but not their event handlers.
            b.onpointerdown=e=>e.stopPropagation();
            b.onclick=e=>{e.preventDefault();e.stopPropagation();this.openShiftPhotoRevealArea(mark,i);};
            b.disabled=false;
        });
    };
    p.resetShiftPhotoReveal = function (mark) {
        if(mark?.dataset?.mode!=='image')return;
        this.stopShiftPhotoReveal(mark);
        const cfg=this.getShiftPhotoReveal(mark);
        mark.dataset.photoRevealAmounts=JSON.stringify(cfg.areas.map(()=>0));
        this.renderShiftPhotoReveal(mark);
    };
    p.getShiftEffectAudioSettings=function(){
        const value=this.getPersistedShiftPhotoCompareSpeechSettings().effectAudio||{};
        return {muted:value.muted===true,duck:value.duck!==false};
    };
    p.setShiftEffectAudioSetting=function(key,value){
        if(!['muted','duck'].includes(key))return;
        const config=this.getShiftEffectAudioSettings();config[key]=!!value;
        this.persistShiftPhotoCompareSpeechSettings({...this.getPersistedShiftPhotoCompareSpeechSettings(),effectAudio:config});
        this.ensureShiftEffectAudioControls();
    };
    p.ensureShiftEffectAudioControls=function(){
        const overlay=this._shiftPhotoCompareAnimationState?.overlay,settings=this.getShiftEffectAudioSettings();
        const bar=overlay?.querySelector('.shift-photo-compare-animation-controls');
        if(bar&&!bar.querySelector('[data-effect-audio-toggle]')){
            const b=document.createElement('button');b.type='button';b.dataset.effectAudioToggle='';
            b.onclick=()=>this.setShiftEffectAudioSetting('muted',!this.getShiftEffectAudioSettings().muted);bar.appendChild(b);
        }
        overlay?.querySelectorAll('[data-effect-audio-toggle]').forEach(b=>{b.innerHTML='<i class="fa-solid '+(settings.muted?'fa-volume-xmark':'fa-volume-high')+'"></i>';b.title=settings.muted?'効果音をON':'効果音をすべてOFF';b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(settings.muted));});
        overlay?.querySelectorAll('[data-effect-muted]').forEach(el=>el.checked=settings.muted);
        overlay?.querySelectorAll('[data-effect-duck]').forEach(el=>el.checked=settings.duck);
    };
    const startAnimation=p.playShiftPhotoCompareAnimation;
    p.playShiftPhotoCompareAnimation=function(...args){const result=startAnimation.apply(this,args);this.ensureShiftEffectAudioControls();return result;};
    p.playShiftPhotoRevealSound = async function(config, valid=()=>true) {
        const slideSound=config.soundKind==='slide',volume=slideSound?num(config.slideVolume,0,1,config.soundVolume):num(config.soundVolume,0,1,.35);
        if(!config.soundEnabled||volume<=0||this.getShiftEffectAudioSettings().muted)return;
        try{
            const context=this._shiftPhotoCompareAnimationRecordingAudioContext||this.prepareShiftPhotoCompareRecordedAudioContext();
            if(!context||context.state==='closed')return;
            if(context.state==='suspended')await context.resume();
            if(!valid()||context.state!=='running')return;
            const now=context.currentTime,slide=slideSound,chime=config.popType==='chime',snap=config.popType==='snap',soft=config.slideType==='soft',duration=slide?(soft?.28:.22):(chime?.32:.13);
            const gain=context.createGain(),limiter=context.createWaveShaper(),output=context.createGain();
            const curve=new Float32Array(2048);
            for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=.85*Math.tanh(x*2);}
            limiter.curve=curve;limiter.oversample='2x';
            const effectiveVolume=()=>{const settings=this.getShiftEffectAudioSettings();return settings.muted?0:volume*(settings.duck&&this.isShiftPhotoCompareSpeechAudible()?.35:1);};
            output.gain.value=effectiveVolume();
            const duckTimer=setInterval(()=>{if(context.state==='running')output.gain.setTargetAtTime(effectiveVolume(),context.currentTime,.01);},25);
            gain.connect(limiter);limiter.connect(output);output.connect(context.destination);
            if(context===this._shiftPhotoCompareAnimationRecordingAudioContext&&this._shiftPhotoCompareAnimationRecordingAudioDestination)output.connect(this._shiftPhotoCompareAnimationRecordingAudioDestination);
            const peak=slide?(soft?1:1.6):(snap?1.8:1.1);
            gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(peak,now+(slide?.025:.002));gain.gain.setValueAtTime(peak,now+(slide?.075:.025));gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
            const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);
            for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
            const noise=context.createBufferSource(),filter=context.createBiquadFilter();noise.buffer=buffer;
            filter.type=slide?'bandpass':'highpass';filter.frequency.setValueAtTime(slide?(soft?1900:4200):1600,now);filter.frequency.exponentialRampToValueAtTime(slide?(soft?500:900):800,now+duration);filter.Q.value=slide?.7:.5;
            const noiseGain=context.createGain();noiseGain.gain.value=slide||snap?1:(chime?0:.2);
            noise.connect(filter);filter.connect(noiseGain);noiseGain.connect(gain);
            if(!slide&&!snap){
                const oscillator=context.createOscillator();oscillator.type='sine';
                oscillator.frequency.setValueAtTime(chime?1568:1100,now);oscillator.frequency.exponentialRampToValueAtTime(chime?1318:170,now+(chime?.25:.075));
                oscillator.connect(gain);oscillator.onended=()=>oscillator.disconnect();oscillator.start(now);oscillator.stop(now+duration);
            }
            noise.onended=()=>{clearInterval(duckTimer);noise.disconnect();filter.disconnect();noiseGain.disconnect();gain.disconnect();limiter.disconnect();output.disconnect();};
            noise.start(now);noise.stop(now+duration+.01);
        }catch(error){console.warn('Reveal sound unavailable',error);}
    };
    const slideImage=p.animateShiftPhotoCompareImagePage;
    p.animateShiftPhotoCompareImagePage=function(mark,img,nextSrc,direction){
        const result=slideImage.call(this,mark,img,nextSrc,direction);
        if(mark?.classList.contains('shift-photo-compare-image-sliding')&&mark.closest('.shift-photo-compare-animation-overlay')){
            const config=this.getShiftPhotoReveal(mark),request=(mark._slideSoundRequest||0)+1;mark._slideSoundRequest=request;
            this.playShiftPhotoRevealSound({...config,soundEnabled:config.slideSoundEnabled,soundKind:'slide'},()=>mark.isConnected&&mark._slideSoundRequest===request&&mark.classList.contains('shift-photo-compare-image-sliding'));
        }
        return result;
    };
    const autoPlay=p.toggleShiftPhotoCompareAnimationAutoPlay;
    p.toggleShiftPhotoCompareAnimationAutoPlay=function(...args){this.prepareShiftPhotoCompareRecordedAudioContext();return autoPlay.apply(this,args);};
    p.openShiftPhotoRevealArea = function (mark,index) {
        const amounts=this.getShiftPhotoRevealAmounts(mark);
        if(amounts[index]>0||mark._photoRevealOpening?.has(index))return;
        if(!mark._photoRevealOpening)mark._photoRevealOpening=new Map();
        mark._photoRevealOpening.set(index,performance.now());
        cancelAnimationFrame(mark._photoRevealFrame);
        const generation=mark._photoRevealGeneration;
        this.playShiftPhotoRevealSound(this.getShiftPhotoReveal(mark),()=>mark.isConnected&&generation===mark._photoRevealGeneration);
        const frame=now=>{
            if(!mark.isConnected||generation!==mark._photoRevealGeneration)return;
            const next=this.getShiftPhotoRevealAmounts(mark);
            mark._photoRevealOpening.forEach((start,i)=>{next[i]=Math.min(1,(now-start)/320);if(next[i]>=1)mark._photoRevealOpening.delete(i);});
            mark.dataset.photoRevealAmounts=JSON.stringify(next);this.renderShiftPhotoReveal(mark);
            if(mark._photoRevealOpening.size)mark._photoRevealFrame=requestAnimationFrame(frame);
        };
        mark._photoRevealFrame=requestAnimationFrame(frame);
    };
    p.getShiftPhotoRevealStepTargets = function (step) {
        return Array.from(this.getShiftPhotoCameraStepTargets(step).keys());
    };
    p.getShiftPhotoRevealStepDuration = function (step) {
        return Math.max(0,...this.getShiftPhotoRevealStepTargets(step).map(mark=>{
            const c=this.getShiftPhotoReveal(mark);
            return c.enabled&&c.areas.length?c.delay+(c.areas.length-1)*700+1320:0;
        }));
    };
    const applyPage=p.applyShiftPhotoCompareMarkPage;
    p.applyShiftPhotoCompareMarkPage=function(mark,...args){
        const result=applyPage.call(this,mark,...args);
        if(result&&mark.dataset.mode==='image')this.resetShiftPhotoReveal(mark);
        return result;
    };
    const camera=p.applyShiftPhotoCamera;
    p.applyShiftPhotoCamera=function(mark,...args){
        const result=camera.call(this,mark,...args);this.renderShiftPhotoReveal(mark);return result;
    };
    const start=p.startShiftPhotoCameraStep;
    p.startShiftPhotoCameraStep=function(step){
        start.call(this,step);
        const state=this._shiftPhotoCompareAnimationState;
        this.getShiftPhotoRevealStepTargets(step).forEach(mark=>{
            this.resetShiftPhotoReveal(mark);
            const c=this.getShiftPhotoReveal(mark);
            if(c.enabled&&(state?.timer||state?.videoRecording)){
                mark._photoRevealTimers=c.areas.map((_,i)=>setTimeout(()=>this.openShiftPhotoRevealArea(mark,i),c.delay+i*700));
            }
        });
    };
    const snapshot=p.snapshotShiftPhotoCameraStep;
    p.snapshotShiftPhotoCameraStep=function(step,progress){
        snapshot.call(this,step,progress);
        const active = new Set(this.getShiftPhotoRevealStepTargets(step));
        if (step) this._shiftPhotoCompareAnimationState?.overlay?.querySelectorAll('.shift-photo-compare-mark.image').forEach(mark => {
            if (active.has(mark) || mark.classList.contains('shift-photo-compare-animation-hidden')) return;
            const config = this.getShiftPhotoReveal(mark);
            if (!config.enabled) return;
            this.stopShiftPhotoReveal(mark);
            mark.dataset.photoRevealAmounts = JSON.stringify(config.areas.map(() => 1));
            this.renderShiftPhotoReveal(mark);
        });
        const duration=Math.max(this.getShiftPhotoRevealStepDuration(step),this.getShiftPhotoCameraStepDuration(step));
        this.getShiftPhotoRevealStepTargets(step).forEach(mark=>{
            const c=this.getShiftPhotoReveal(mark),elapsed=(typeof progress==='number'?progress:1)*duration;
            this.stopShiftPhotoReveal(mark);
            mark.dataset.photoRevealAmounts=JSON.stringify(c.areas.map((_,i)=>num((elapsed-c.delay-i*700)/320,0,1,0)));
            this.renderShiftPhotoReveal(mark);
        });
    };
    for(const name of ['getShiftPhotoCompareAnimationStepHoldMs','getShiftPhotoCompareAnimationStepEffectDuration']){
        const original=p[name];p[name]=function(step,...args){return Math.max(original.call(this,step,...args),this.getShiftPhotoRevealStepDuration(step));};
    }
    const menu=p.openShiftPhotoCompareAnimationPhotoSyncMenu;
    p.openShiftPhotoCompareAnimationPhotoSyncMenu=function(event,id){
        menu.call(this,event,id);const el=document.querySelector('.shift-photo-compare-animation-photo-sync-menu');
        if(!el)return;
        const b=document.createElement('button');b.className='photo-camera-menu-button';b.innerHTML='<i class="fa-solid fa-eye"></i><span>クリックでめくる</span>';
        b.onclick=()=>{this.closeShiftPhotoCompareAnimationPhotoSyncMenu();this.openShiftPhotoRevealEditor(id);};
        el.querySelector('header').after(b);
    };
    p.openShiftPhotoRevealEditor=function(id){
        const entry=this.getShiftPhotoCompareAnimationTimelineEntry(id),state=this._shiftPhotoCompareAnimationState;
        if(!entry||entry.type!=='imagePage'||!state||state.videoRecording)return;
        if(state.timer)this.toggleShiftPhotoCompareAnimationAutoPlay();
        document.querySelector('.photo-reveal-dialog')?.close();
        const photo=this.getShiftPhotoCompareMarkPagesFromDataset(entry.mark)[entry.pageIndex];
        let draft=this.normalizeShiftPhotoReveal(photo.reveal),selected=-1,drag=null;
        let guides={x:null,y:null};
        const history=[{data:JSON.stringify(draft),selected}],historyLimit=100;
        let historyIndex=0;
        const commit=()=>{
            const data=JSON.stringify(draft);
            if(data===history[historyIndex].data)return;
            history.splice(historyIndex+1);history.push({data,selected});
            if(history.length>historyLimit)history.shift();
            historyIndex=history.length-1;
        };
        const restore=delta=>{
            if(drag)return;
            commit();
            const next=historyIndex+delta;
            if(next<0||next>=history.length)return;
            historyIndex=next;draft=JSON.parse(history[next].data);selected=history[next].selected;guides={x:null,y:null};sync();
        };
        const dialog=document.createElement('dialog');dialog.className='photo-camera-dialog photo-reveal-dialog';
        dialog.innerHTML=`<form method="dialog"><header><strong>クリックでめくる · ${this.escapeHtml(entry.sourceLabel)} ${entry.pageNumber}P</strong><button aria-label="閉じる">×</button></header></form>
            <label class="photo-camera-enable"><input data-enabled type="checkbox">隠す範囲を使う</label>
            <div class="photo-reveal-edit-tools"><button type="button" data-undo title="元に戻す (Ctrl+Z)" aria-label="元に戻す"><i class="fa-solid fa-rotate-left"></i></button><button type="button" data-redo title="やり直し (Ctrl+Y)" aria-label="やり直し"><i class="fa-solid fa-rotate-right"></i></button><label><input type="checkbox" data-snap checked>位置合わせ</label></div>
            <canvas width="800" height="450" class="photo-camera-map" aria-label="空白をドラッグで追加、範囲内をドラッグで移動、四隅をドラッグでサイズ変更" title="空白をドラッグで追加、範囲内をドラッグで移動、四隅をドラッグでサイズ変更"></canvas>
            <div class="photo-camera-fields"><label>隠す色 <input data-color type="color"></label><label>自動再生・録画 <input data-delay type="number" min=".5" max="15" step=".5">秒後</label></div>
                        <label>めくり方 <select data-reveal-effect><option value="horizontal">横開き</option><option value="fade">フェード</option><option value="flip">カード反転</option><option value="up">上へめくる</option></select></label><label>目隠しの表示 <select data-label-mode><option value="question">？</option><option value="number">番号</option><option value="answer">答えを見る</option><option value="none">文字なし</option></select></label>
            <div class="photo-reveal-sound-controls">
            <label><input data-sound-enabled type="checkbox">めくる音</label><select data-pop-type aria-label="めくる音の種類"><option value="pop">ポンッ</option><option value="snap">パッ</option><option value="chime">ピン</option></select><label>音量<input data-sound-volume type="range" min="0" max="100" step="5"><output data-sound-output></output></label><button data-sound-test type="button" title="めくる音を試聴"><i class="fa-solid fa-volume-high"></i></button>
            </div><div class="photo-reveal-sound-controls">
            <label><input data-slide-sound-enabled type="checkbox">スライド音</label><select data-slide-type aria-label="スライド音の種類"><option value="swish">シャッ</option><option value="soft">スッ</option></select><label>音量<input data-slide-volume type="range" min="0" max="100" step="5"><output data-slide-output></output></label><button data-slide-test type="button" title="スライド音を試聴"><i class="fa-solid fa-volume-high"></i></button>
            </div><div class="photo-reveal-sound-controls"><label><input data-effect-muted type="checkbox">効果音をすべてOFF</label><label><input data-effect-duck type="checkbox">読み上げ中は控えめに</label></div><p class="photo-reveal-order-help">範囲ボタンをドラッグすると、めくる順番を変更できます。</p><div class="photo-reveal-area-list" aria-label="めくる順番"></div>
            <footer><button data-order-up type="button" title="めくる順番を前へ" aria-label="めくる順番を前へ"><i class="fa-solid fa-arrow-left"></i></button><button data-order-down type="button" title="めくる順番を後へ" aria-label="めくる順番を後へ"><i class="fa-solid fa-arrow-right"></i></button><button data-remove type="button"><i class="fa-solid fa-trash"></i> 選択範囲を削除</button><button data-save type="button">保存</button></footer>`;
        const image=new Image(),canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d');
        const geometry=()=>{const s=Math.min(800/image.naturalWidth,450/image.naturalHeight);return {w:image.naturalWidth*s,h:image.naturalHeight*s};};
        const draw=()=>{
            if(!image.naturalWidth)return;
            const {w,h}=geometry(),x=(800-w)/2,y=(450-h)/2;
            ctx.clearRect(0,0,800,450);ctx.drawImage(image,x,y,w,h);
            const areas=[...draft.areas];if(drag?.mode==='create')areas.push(drag.area);
            areas.forEach((a,i)=>{
                const r={x:x+a.x*w,y:y+a.y*h,w:a.w*w,h:a.h*h};
                this.drawShiftPhotoRevealArea(ctx,r,draft,i,w);
                if(r.w>0&&r.h>0){
                    ctx.strokeStyle=i===selected?'#fde047':'rgba(255,255,255,.65)';ctx.lineWidth=i===selected?3:1;
                    ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,Math.min(w*.012,Math.min(r.w,r.h)*.08));ctx.stroke();
                }
                if(i===selected){
                    const handle=10*800/(canvas.getBoundingClientRect().width||800);
                    ctx.fillStyle='#fff';ctx.strokeStyle='#111827';ctx.lineWidth=1.5;
                    for(const [cx,cy] of [[a.x,a.y],[a.x+a.w,a.y],[a.x,a.y+a.h],[a.x+a.w,a.y+a.h]]){
                        ctx.fillRect(x+cx*w-handle/2,y+cy*h-handle/2,handle,handle);
                        ctx.strokeRect(x+cx*w-handle/2,y+cy*h-handle/2,handle,handle);
                    }
                }
            });
            if(drag){
                ctx.save();ctx.setLineDash([8,5]);ctx.lineWidth=2;ctx.strokeStyle='#22d3ee';ctx.shadowColor='#000';ctx.shadowBlur=2;
                if(guides.x!==null){ctx.beginPath();ctx.moveTo(x+guides.x*w,y);ctx.lineTo(x+guides.x*w,y+h);ctx.stroke();}
                if(guides.y!==null){ctx.beginPath();ctx.moveTo(x,y+guides.y*h);ctx.lineTo(x+w,y+guides.y*h);ctx.stroke();}
                ctx.restore();
            }
        };
        let draggedIndex=-1;
        const reorder=(from,to)=>{
            if(from<0||to<0||from>=draft.areas.length||to>=draft.areas.length||from===to)return;
            const [area]=draft.areas.splice(from,1);draft.areas.splice(to,0,area);selected=to;commit();sync();
        };
        const sync=()=>{
            dialog.querySelector('[data-undo]').disabled=historyIndex===0;
            dialog.querySelector('[data-redo]').disabled=historyIndex===history.length-1;
            dialog.querySelector('[data-reveal-effect]').value=draft.effect;
            dialog.querySelector('[data-label-mode]').value=draft.labelMode;
            dialog.querySelector('[data-order-up]').disabled=selected<=0;
            dialog.querySelector('[data-order-down]').disabled=selected<0||selected>=draft.areas.length-1;
            dialog.querySelector('[data-enabled]').checked=draft.enabled;dialog.querySelector('[data-color]').value=draft.color;
            dialog.querySelector('[data-delay]').value=draft.delay/1000;
            dialog.querySelector('[data-sound-enabled]').checked=draft.soundEnabled;
            dialog.querySelector('[data-sound-volume]').value=Math.round(draft.soundVolume*100);
            dialog.querySelector('[data-slide-sound-enabled]').checked=draft.slideSoundEnabled;
            dialog.querySelector('[data-sound-volume]').disabled=!draft.soundEnabled;
            dialog.querySelector('[data-pop-type]').value=draft.popType;
            dialog.querySelector('[data-slide-type]').value=draft.slideType;
            dialog.querySelector('[data-slide-volume]').value=Math.round(draft.slideVolume*100);
            dialog.querySelector('[data-slide-output]').textContent=Math.round(draft.slideVolume*100)+'%';
            dialog.querySelector('[data-slide-volume]').disabled=!draft.slideSoundEnabled;
            dialog.querySelector('[data-slide-test]').disabled=!draft.slideSoundEnabled;
            this.ensureShiftEffectAudioControls();
            dialog.querySelector('[data-sound-output]').textContent=Math.round(draft.soundVolume*100)+'%';
            dialog.querySelector('[data-sound-test]').disabled=!draft.soundEnabled;
            const list=dialog.querySelector('.photo-reveal-area-list');list.replaceChildren();
            draft.areas.forEach((_,i)=>{const b=document.createElement('button');b.type='button';b.textContent='範囲 '+(i+1);b.classList.toggle('active',selected===i);
                b.draggable=true;b.title='ドラッグでめくる順番を変更';
                b.ondragstart=e=>{draggedIndex=i;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i));};
                b.ondragover=e=>{if(draggedIndex<0)return;e.preventDefault();e.dataTransfer.dropEffect='move';b.classList.add('reveal-drop-target');};
                b.ondragleave=()=>b.classList.remove('reveal-drop-target');
                b.ondrop=e=>{if(draggedIndex<0)return;e.preventDefault();const from=draggedIndex;draggedIndex=-1;reorder(from,i);};
                b.ondragend=()=>{draggedIndex=-1;list.querySelectorAll('.reveal-drop-target').forEach(el=>el.classList.remove('reveal-drop-target'));};
                b.onclick=()=>{selected=i;sync();};list.appendChild(b);});
            dialog.querySelector('[data-remove]').disabled=selected<0;draw();
        };
        const coords=e=>{const r=canvas.getBoundingClientRect(),{w,h}=geometry();return {x:num(((e.clientX-r.left)/r.width*800-(800-w)/2)/w,0,1,0),y:num(((e.clientY-r.top)/r.height*450-(450-h)/2)/h,0,1,0)};};
        const hitTest=(pos)=>{
            const {w,h}=geometry(),rect=canvas.getBoundingClientRect();
            const tx=9*800/rect.width/w,ty=9*450/rect.height/h;
            const a=draft.areas[selected];
            if(a){for(const [corner,x,y] of [['nw',a.x,a.y],['ne',a.x+a.w,a.y],['sw',a.x,a.y+a.h],['se',a.x+a.w,a.y+a.h]]){
                if(Math.abs(pos.x-x)<=tx&&Math.abs(pos.y-y)<=ty)return {index:selected,corner};
            }}
            for(let i=draft.areas.length-1;i>=0;i--){const a=draft.areas[i];
                if(pos.x>=a.x&&pos.x<=a.x+a.w&&pos.y>=a.y&&pos.y<=a.y+a.h)return {index:i};}
            return null;
        };
        const snapAxis=(anchors,axis,index,minDelta,maxDelta)=>{
            const {w,h}=geometry(),rect=canvas.getBoundingClientRect();
            const threshold=6/(axis==='x'?rect.width*w/800:rect.height*h/450);
            const targets=[0,.5,1];
            draft.areas.forEach((a,i)=>{if(i!==index){const start=a[axis],length=axis==='x'?a.w:a.h;targets.push(start,start+length/2,start+length);}});
            let distance=threshold,delta=0;
            for(const anchor of anchors)for(const target of targets){const d=target-anchor;
                if(d>=minDelta&&d<=maxDelta&&Math.abs(d)<distance){distance=Math.abs(d);delta=d;guides[axis]=target;}}
            return delta;
        };
        canvas.onpointerdown=e=>{
            if(!image.naturalWidth||e.button!==0)return;
            commit();history[historyIndex].selected=selected;guides={x:null,y:null};
            const origin=coords(e),hit=hitTest(origin);
            if(hit){selected=hit.index;drag={mode:hit.corner?'resize':'move',corner:hit.corner,index:selected,origin,original:{...draft.areas[selected]}};}
            else {if(draft.areas.length>=12)return;selected=-1;drag={mode:'create',origin,area:{...origin,w:0,h:0}};}
            e.preventDefault();canvas.setPointerCapture(e.pointerId);sync();
        };
        canvas.onpointermove=e=>{
            if(!image.naturalWidth)return;
            const pos=coords(e);guides={x:null,y:null};
            if(!drag){const hit=hitTest(pos);canvas.style.cursor=hit?.corner?(hit.corner==='nw'||hit.corner==='se'?'nwse-resize':'nesw-resize'):hit?'move':'crosshair';return;}
            const snapping=dialog.querySelector('[data-snap]').checked&&!e.altKey;
            if(snapping&&drag.mode!=='move'){
                const a=drag.original;
                const xmin=a?(drag.corner.includes('w')?0:a.x+.02):0,xmax=a?(drag.corner.includes('w')?a.x+a.w-.02:1):1;
                const ymin=a?(drag.corner.includes('n')?0:a.y+.02):0,ymax=a?(drag.corner.includes('n')?a.y+a.h-.02:1):1;
                pos.x+=snapAxis([pos.x],'x',drag.index,xmin-pos.x,xmax-pos.x);
                pos.y+=snapAxis([pos.y],'y',drag.index,ymin-pos.y,ymax-pos.y);
            }
            if(drag.mode==='create')drag.area={x:Math.min(pos.x,drag.origin.x),y:Math.min(pos.y,drag.origin.y),w:Math.abs(pos.x-drag.origin.x),h:Math.abs(pos.y-drag.origin.y)};
            else {
                const a=drag.original;
                if(drag.mode==='move'){
                    const next={...a,x:num(a.x+pos.x-drag.origin.x,0,1-a.w,a.x),y:num(a.y+pos.y-drag.origin.y,0,1-a.h,a.y)};
                    if(snapping){next.x+=snapAxis([next.x,next.x+next.w/2,next.x+next.w],'x',drag.index,-next.x,1-next.w-next.x);
                        next.y+=snapAxis([next.y,next.y+next.h/2,next.y+next.h],'y',drag.index,-next.y,1-next.h-next.y);}
                    draft.areas[drag.index]=next;
                }
                else {
                    let left=a.x,top=a.y,right=a.x+a.w,bottom=a.y+a.h;
                    if(drag.corner.includes('w'))left=num(pos.x,0,right-.02,left);else right=num(pos.x,left+.02,1,right);
                    if(drag.corner.includes('n'))top=num(pos.y,0,bottom-.02,top);else bottom=num(pos.y,top+.02,1,bottom);
                    draft.areas[drag.index]={x:left,y:top,w:right-left,h:bottom-top};
                }
            }
            draw();
        };
        canvas.onpointerup=e=>{
            if(!drag)return;
            if(drag.mode==='create'&&drag.area.w>=.02&&drag.area.h>=.02){draft.areas.push(drag.area);selected=draft.areas.length-1;draft.enabled=true;}
            drag=null;guides={x:null,y:null};commit();if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);sync();
        };
        canvas.onpointercancel=()=>{if(drag?.original)draft.areas[drag.index]=drag.original;drag=null;guides={x:null,y:null};sync();};
        dialog.querySelector('[data-reveal-effect]').onchange=e=>{draft.effect=e.target.value;commit();sync();};
        dialog.querySelector('[data-label-mode]').onchange=e=>{draft.labelMode=e.target.value;commit();sync();};
        dialog.querySelector('[data-order-up]').onclick=()=>reorder(selected,selected-1);
        dialog.querySelector('[data-order-down]').onclick=()=>reorder(selected,selected+1);
        dialog.querySelector('[data-enabled]').onchange=e=>{draft.enabled=e.target.checked;commit();sync();};
        dialog.querySelector('[data-undo]').onclick=()=>restore(-1);
        dialog.querySelector('[data-redo]').onclick=()=>restore(1);
        dialog.querySelector('[data-snap]').onchange=()=>{guides={x:null,y:null};draw();};
        dialog.addEventListener('keydown',e=>{
            if(!(e.ctrlKey||e.metaKey)||e.altKey||e.target.closest('input,textarea,select'))return;
            const key=e.key.toLowerCase();
            if(key==='z'||key==='y'){e.preventDefault();e.stopPropagation();restore(key==='y'||e.shiftKey?1:-1);}
        });
        dialog.querySelector('[data-color]').onchange=()=>{commit();sync();};
        dialog.querySelector('[data-color]').oninput=e=>{draft.color=e.target.value;draw();};
        dialog.querySelector('[data-delay]').onchange=e=>{draft.delay=num(Number(e.target.value)*1000,500,15000,2500);commit();sync();};
        dialog.querySelector('[data-remove]').onclick=()=>{if(selected>=0)draft.areas.splice(selected,1);selected=-1;commit();sync();};
        dialog.querySelector('[data-slide-sound-enabled]').onchange=e=>{draft.slideSoundEnabled=e.target.checked;commit();sync();};
        dialog.querySelector('[data-sound-enabled]').onchange=e=>{draft.soundEnabled=e.target.checked;commit();sync();};
        dialog.querySelector('[data-sound-volume]').oninput=e=>{draft.soundVolume=Number(e.target.value)/100;dialog.querySelector('[data-sound-output]').textContent=e.target.value+'%';};
        dialog.querySelector('[data-sound-volume]').onchange=()=>{commit();sync();};
        dialog.querySelector('[data-pop-type]').onchange=e=>{draft.popType=e.target.value;commit();sync();};
        dialog.querySelector('[data-slide-type]').onchange=e=>{draft.slideType=e.target.value;commit();sync();};
        dialog.querySelector('[data-slide-volume]').oninput=e=>{draft.slideVolume=Number(e.target.value)/100;dialog.querySelector('[data-slide-output]').textContent=e.target.value+'%';};
        dialog.querySelector('[data-slide-volume]').onchange=()=>{commit();sync();};
        dialog.querySelector('[data-slide-test]').onclick=()=>this.playShiftPhotoRevealSound({...draft,soundEnabled:draft.slideSoundEnabled,soundKind:'slide'},()=>dialog.isConnected);
        dialog.querySelector('[data-effect-muted]').onchange=e=>this.setShiftEffectAudioSetting('muted',e.target.checked);
        dialog.querySelector('[data-effect-duck]').onchange=e=>this.setShiftEffectAudioSetting('duck',e.target.checked);
        dialog.querySelector('[data-sound-test]').onclick=()=>this.playShiftPhotoRevealSound(draft,()=>dialog.isConnected);
        dialog.querySelector('[data-save]').onclick=()=>{
            if(!this.persistShiftPhotoPageVisualSetting(entry,'reveal',this.normalizeShiftPhotoReveal(draft))){this.showToast?.('保存できませんでした。');return;}
            this.resetShiftPhotoReveal(entry.mark);this.showToast?.('めくり表示を保存しました。');dialog.close();
        };
        dialog.onclose=()=>dialog.remove();image.onload=sync;image.src=photo.imageSrc;
        state.overlay.appendChild(dialog);dialog.showModal();sync();
    };
})();
