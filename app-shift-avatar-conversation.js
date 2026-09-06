(function () {
    if (typeof MaintenanceApp === 'undefined') return;
    const p = MaintenanceApp.prototype;
    const names = {safetyFirst:'安全第一',instructor:'女性安全指導員',siteGuide:'現場ガイド',fox:'キツネ監督',crtGuide:'レトロモニター',helmetCat:'ヘルメット猫',frog:'カエル'};
    p.getShiftAvatarConversation = function () {
        const saved=this.getPersistedShiftPhotoCompareSpeechSettings(), value=saved.avatarConversation||{};
        const current=this.normalizeShiftPhotoCompareSpeechAvatarStyle(saved.avatarStyle);
        const position=this.getShiftPhotoCompareSpeechAvatarLayout(current,saved).position;
        const other=Object.keys(saved.avatarLayouts||{}).find(style=>Object.hasOwn(names,style)&&style!==current&&this.getShiftPhotoCompareSpeechAvatarLayout(style,saved).position!==position)
            || (current==='helmetCat'?'safetyFirst':'helmetCat');
        const left=Object.hasOwn(names,value.left)?value.left:(position==='left'?current:other);
        const candidate=Object.hasOwn(names,value.right)?value.right:(position==='right'?current:other);
        const right=candidate!==left?candidate:(left===current?other:current);
        return {enabled:value.enabled===true,left,right,emphasis:value.emphasis!==false,gap:Math.max(0,Math.min(2000,Number(value.gap)||0))};
    };
    p.getShiftAvatarConversationTextSpeakers = function () {
        const state=this._shiftPhotoCompareAnimationState, pages=state?.pages||[];
        const ordered=[pages[state?.pageIndex||0],...pages.filter((_,i)=>i!==(state?.pageIndex||0))].filter(Boolean);
        const speakers=[];
        ordered.forEach(page=>(page.timelineEntries||[]).forEach(entry=>{
            if(!['boxedTextPage','calloutPage'].includes(entry.type))return;
            const data=entry.mark?this.getShiftPhotoCompareMarkPagesFromDataset(entry.mark)[entry.pageIndex||0]:null;
            const style=data?.speechAvatarStyle||entry.speechAvatarStyle;
            if(Object.hasOwn(names,style)&&!speakers.includes(style))speakers.push(style);
        }));
        return speakers;
    };
    p.assignShiftAvatarConversationTexts = function (config, reroll = false) {
        let index=0,changed=0;
        for(const page of this._shiftPhotoCompareAnimationState?.pages||[]){
            const entries=[...new Set([...(page.steps||[]).map(step=>step.pageEntry),...(page.timelineEntries||[])])].filter(entry=>entry&&['boxedTextPage','calloutPage'].includes(entry.type));
            for(const entry of entries){
                const data=entry.mark?this.getShiftPhotoCompareMarkPagesFromDataset(entry.mark)[entry.pageIndex||0]:null;
                if(Object.hasOwn(names,data?.speechAvatarStyle||entry.speechAvatarStyle)&&!(reroll&&data.speechAvatarAutoStyle===data.speechAvatarStyle)){index++;continue;}
                if(!data)continue;
                const style=index++%2===0?config.left:config.right;
                if(this.persistShiftPhotoCompareAnimationPageAvatar(entry,style,page,true))changed++;
            }
        }
        if(changed){
            this.renderShiftPhotoCompareAnimationTimeline();
            this.showToast?.('未設定のセリフにアバターを割り当てました。');
        }
    };
    p.updateShiftAvatarConversation = function (key,value) {
        if(this._shiftPhotoCompareAnimationState?.videoRecording)return;
        const config=this.getShiftAvatarConversation();
        if(key==='emphasis')config.emphasis=!!value;
        else if(key==='gap')config.gap=Math.max(0,Math.min(2000,Number(value)||0));
        else if(key==='enabled'){
            if(value&&!config.enabled){
                const speakers=this.getShiftAvatarConversationTextSpeakers();
                if(speakers.length&&speakers.every(style=>style===config.left||style===config.right)){ /* Keep an existing pair and its placement. */ }
                else if(speakers.length){
                    const occupied=new Set();
                    speakers.slice(0,2).forEach(style=>{
                        let side=this.getShiftPhotoCompareSpeechAvatarLayout(style).position;
                        if(occupied.has(side))side=side==='left'?'right':'left';
                        const other=side==='left'?'right':'left',previous=config[side];
                        config[side]=style;occupied.add(side);
                        if(config[other]===style)config[other]=previous===style?(style==='helmetCat'?'safetyFirst':'helmetCat'):previous;
                    });
                } else {
                    const pool=Object.keys(names);
                    const first=pool.splice(Math.floor(Math.random()*pool.length),1)[0];
                    const second=pool[Math.floor(Math.random()*pool.length)];
                    config.left=first;config.right=second;
                }
            }
            if(value&&!config.enabled)this.assignShiftAvatarConversationTexts(config);
            config.enabled=!!value;
        }
        else if((key==='left'||key==='right')&&Object.hasOwn(names,value)){
            const other=key==='left'?'right':'left',previous=config[key];
            config[key]=value;if(config[other]===value)config[other]=previous;
        } else return;
        this.persistShiftPhotoCompareSpeechSettings({...this.getPersistedShiftPhotoCompareSpeechSettings(),avatarConversation:config});
        this.syncShiftPhotoCompareSpeechSettingsPanel();
        this.syncShiftPhotoCompareSpeechAvatar();
    };
    p.ensureShiftAvatarConversationPanel = function () {
        const panel=this._shiftPhotoCompareAnimationState?.overlay?.querySelector('.shift-photo-compare-speech-settings');
        if(!panel)return;
        let section=panel.querySelector('.avatar-conversation-settings');
        if(!section){
            section=document.createElement('div');section.className='avatar-conversation-settings';
            section.innerHTML='<label><input type="checkbox" data-conversation-enabled>会話モード（左右に常時表示）</label><div class="avatar-conversation-pair"><label>左下<select data-conversation-side="left"></select></label><label>右下<select data-conversation-side="right"></select></label></div>';
            section.insertAdjacentHTML('beforeend','<div class="conversation-actions"><button type="button" data-conversation-undo title="話者設定を元に戻す"><i class="fa-solid fa-rotate-left"></i>元に戻す</button><button type="button" data-conversation-swap title="左右を入れ替え" aria-label="左右を入れ替え"><i class="fa-solid fa-right-left"></i></button><button type="button" data-conversation-reroll><i class="fa-solid fa-shuffle"></i>別の2人を選ぶ</button></div><label>交代の間 <input type="number" data-conversation-gap min="0" max="2" step="0.1">秒</label><div class="conversation-actions"><span data-conversation-count></span><button type="button" data-conversation-bulk="left">左の話者に割り当て</button><button type="button" data-conversation-bulk="right">右の話者に割り当て</button></div>');
            section.querySelector('[data-conversation-undo]').onclick=()=>this.undoShiftAvatarConversation();
            section.querySelector('[data-conversation-swap]').onclick=()=>this.swapShiftAvatarConversation();
            section.querySelector('[data-conversation-reroll]').onclick=()=>this.rerollShiftAvatarConversation();

            section.querySelector('[data-conversation-gap]').onchange=e=>this.updateShiftAvatarConversation('gap',Number(e.target.value)*1000);
            section.querySelectorAll('[data-conversation-bulk]').forEach(b=>b.onclick=()=>this.bulkShiftAvatarConversation(b.dataset.conversationBulk));
            section.querySelectorAll('select').forEach(select=>{
                Object.entries(names).forEach(([key,name])=>select.add(new Option(name,key)));
                select.onchange=()=>this.updateShiftAvatarConversation(select.dataset.conversationSide,select.value);
            });
            section.querySelector('input').onchange=e=>this.updateShiftAvatarConversation('enabled',e.target.checked);
            (panel.querySelector('.shift-photo-compare-speech-avatar-layout')||panel).appendChild(section);
        }
        const config=this.getShiftAvatarConversation();
        section.querySelector('input').checked=config.enabled;
        section.querySelector('[data-conversation-undo]').disabled=!this._shiftPhotoCompareAnimationState?._conversationUndo?.length||!!this._shiftPhotoCompareAnimationState?.videoRecording;

        section.querySelector('[data-conversation-gap]').value=config.gap/1000;
        const selected=this.getShiftAvatarConversationSelection();
        section.querySelector('[data-conversation-count]').textContent='選択セリフ '+selected.length+'件';
        section.querySelectorAll('[data-conversation-bulk]').forEach(b=>b.disabled=!selected.length||!config.enabled);
        section.querySelectorAll('select').forEach(select=>{select.value=config[select.dataset.conversationSide];select.disabled=!config.enabled;});
    };
    p.syncShiftAvatarConversation = function (forceTalking=null) {
        const overlay=this._shiftPhotoCompareAnimationState?.overlay;
        const main=overlay?.querySelector('.shift-photo-compare-speech-avatar:not([data-conversation-side])');
        if(!main)return;
        const config=this.getShiftAvatarConversation(),settings=this.getShiftPhotoCompareSpeechSettings();
        main.classList.toggle('conversation-original',config.enabled);
        if(!config.enabled){overlay.querySelectorAll('.shift-photo-compare-speech-avatar[data-conversation-side]').forEach(el=>el.remove());return;}
        const enabled=settings.avatarEnabled!==false;
        const active=this._shiftPhotoCompareActiveSpeechAvatarStyle||settings.avatarStyle;
        const audible=forceTalking!==false&&enabled&&this.isShiftPhotoCompareSpeechAudible();
        for(const side of ['left','right']){
            let avatar=overlay.querySelector('.shift-photo-compare-speech-avatar[data-conversation-side="'+side+'"]');
            if(!avatar){
                avatar=document.createElement('div');avatar.className='shift-photo-compare-speech-avatar';
                avatar.dataset.conversationSide=side;
                avatar.innerHTML='<img class="shift-photo-compare-speech-avatar-frame frame-base" alt=""><img class="shift-photo-compare-speech-avatar-frame frame-half" alt=""><img class="shift-photo-compare-speech-avatar-frame frame-open" alt="">';
                main.parentElement.appendChild(avatar);
            }
            const style=config[side],layout=this.getShiftPhotoCompareSpeechAvatarLayout(style);
            this.loadShiftAvatarAppearance(avatar,style);
            avatar.dataset.avatarPosition=side;
            avatar.style.setProperty('--speech-avatar-size',layout.size+'px');
            avatar.classList.toggle('no-background',!layout.background);
            avatar.classList.toggle('disabled',!enabled);
            avatar.classList.toggle('visible',enabled);
            avatar.classList.toggle('talking',audible&&active===style);
            avatar.classList.toggle('conversation-speaker',config.emphasis&&audible&&active===style);
            avatar.classList.remove('conversation-listener');
            avatar.setAttribute('aria-hidden','true');
        }
    };
    p.loadShiftAvatarAppearance=function(avatar,style){
        const paths=this.getShiftPhotoCompareSpeechAvatarPaths(style);
        const frames=Array.from(avatar.querySelectorAll('.shift-photo-compare-speech-avatar-frame'));
        if(!avatar._pendingAvatarStyle&&avatar.dataset.avatarStyle===style&&frames.length===3&&frames.every(img=>img.complete&&img.naturalWidth))return;
        if(avatar._pendingAvatarStyle===style)return;
        avatar._pendingAvatarStyle=style;
        const request=(avatar._avatarLoadRequest||0)+1;avatar._avatarLoadRequest=request;
        Promise.all(paths.map(src=>new Promise(resolve=>{
            const img=new Image();let settled=false;
            const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
            const timer=setTimeout(()=>finish(''),5000);
            img.onload=()=>finish(src);img.onerror=()=>finish('');img.src=src;
        }))).then(loaded=>{
            if(!avatar.isConnected||avatar._avatarLoadRequest!==request)return;
            avatar._pendingAvatarStyle='';
            if(!loaded[0])return;
            frames.forEach((img,i)=>{img.src=loaded[i]||loaded[0];});
            avatar.dataset.avatarStyle=style;avatar.classList.remove('avatar-loading');
            this.syncShiftPhotoCompareSpeechAvatar();
        });
    };
    p.applyShiftPhotoCompareSpeechAvatarAppearance=function(style='safetyFirst'){
        const normalized=this.normalizeShiftPhotoCompareSpeechAvatarStyle(style);
        const avatar=this._shiftPhotoCompareAnimationState?.overlay?.querySelector('.shift-photo-compare-speech-avatar:not([data-conversation-side])');
        if(avatar){this.applyShiftPhotoCompareSpeechAvatarLayout(normalized);this.loadShiftAvatarAppearance(avatar,normalized);}
        this.syncShiftPhotoCompareSpeechAvatar();return normalized;
    };
    for(const method of ['setShiftPhotoCompareSpeechAvatarStyle','updateShiftPhotoCompareSpeechAvatarLayout']){
        const original=p[method];
        p[method]=function(...args){this._shiftAvatarSettingsPreview=true;const result=original.apply(this,args);this.syncShiftPhotoCompareSpeechAvatar();return result;};
    }
    const sync=p.syncShiftPhotoCompareSpeechAvatar;
    p.syncShiftPhotoCompareSpeechAvatar=function(forceTalking=null){sync.call(this,forceTalking);this.syncShiftAvatarConversation(forceTalking);};
    const panel=p.syncShiftPhotoCompareSpeechSettingsPanel;
    p.syncShiftPhotoCompareSpeechSettingsPanel=function(...args){panel.apply(this,args);this.ensureShiftAvatarConversationPanel();this.syncShiftAvatarConversation();};
    const play=p.playShiftPhotoCompareAnimation;
    p.playShiftPhotoCompareAnimation=function(...args){this._shiftAvatarSettingsPreview=false;this._conversationLastSpeaker='';this._conversationSilentAt=0;const result=play.apply(this,args);this.ensureShiftAvatarConversationPanel();this.syncShiftPhotoCompareSpeechAvatar(false);return result;};
    const draw=p.drawShiftPhotoCompareSpeechAvatarToCanvas;
    p.drawShiftPhotoCompareSpeechAvatarToCanvas=async function(ctx,width,height){
        const config=this.getShiftAvatarConversation();
        if(!config.enabled)return draw.call(this,ctx,width,height);
        const settings=this.getShiftPhotoCompareSpeechSettings();
        if(!ctx||settings.avatarEnabled===false)return;
        const active=this._shiftPhotoCompareActiveSpeechAvatarStyle||settings.avatarStyle;
        for(const side of ['left','right']){
            const audible=this.isShiftPhotoCompareSpeechAudible();
            ctx.save();

            try{await draw.call(this,ctx,width,height,{
                style:config[side],position:side,alwaysVisible:true,talking:audible&&active===config[side]
            });}finally{ctx.restore();}
        }
    };
    p.saveShiftAvatarConversationConfig=function(config){
        this.persistShiftPhotoCompareSpeechSettings({...this.getPersistedShiftPhotoCompareSpeechSettings(),avatarConversation:config});
        this.syncShiftPhotoCompareSpeechSettingsPanel();this.syncShiftPhotoCompareSpeechAvatar();
    };
    p.swapShiftAvatarConversation=function(){if(this._shiftPhotoCompareAnimationState?.videoRecording)return;const c=this.getShiftAvatarConversation();[c.left,c.right]=[c.right,c.left];this.saveShiftAvatarConversationConfig(c);};
    p.rerollShiftAvatarConversation=function(){
        if(this._shiftPhotoCompareAnimationState?.videoRecording)return;
        const c=this.getShiftAvatarConversation(),pool=Object.keys(names).filter(style=>style!==c.left&&style!==c.right);
        c.left=pool.splice(Math.floor(Math.random()*pool.length),1)[0];c.right=pool[Math.floor(Math.random()*pool.length)];
        this.assignShiftAvatarConversationTexts(c,true);this.saveShiftAvatarConversationConfig(c);
    };
    p.getShiftAvatarConversationSelection=function(){
        const state=this._shiftPhotoCompareAnimationState;
        return (state?.pages?.[state.pageIndex||0]?.timelineEntries||[]).filter(e=>['boxedTextPage','calloutPage'].includes(e.type)&&state.timelineSelectedItems?.has('page:'+e.id));
    };
    p.bulkShiftAvatarConversation=function(side){
        if(!['left','right'].includes(side))return;
        const state=this._shiftPhotoCompareAnimationState;
        if(state?.videoRecording)return;
        const style=this.getShiftAvatarConversation()[side];
        this.getShiftAvatarConversationSelection().forEach(e=>this.persistShiftPhotoCompareAnimationPageAvatar(e,style));
        this.renderShiftPhotoCompareAnimationTimeline();this.ensureShiftAvatarConversationPanel();
    };
    const renderTimeline=p.renderShiftPhotoCompareAnimationTimeline;
    p.renderShiftPhotoCompareAnimationTimeline=function(...args){const result=renderTimeline.apply(this,args);this.ensureShiftAvatarConversationPanel();return result;};
    const cancel=p.cancelShiftPhotoCompareSpeech;
    p.cancelShiftPhotoCompareSpeech=function(...args){clearTimeout(this._conversationSpeechTimer);this._conversationWaiting=false;return cancel.apply(this,args);};
    const inProgress=p.isShiftPhotoCompareSpeechInProgress;
    p.isShiftPhotoCompareSpeechInProgress=function(){return !!this._conversationWaiting||inProgress.call(this);};
    const speak=p.speakShiftPhotoCompareAnimationMarks;
    p.speakShiftPhotoCompareAnimationMarks=function(marks,...args){
        this._shiftAvatarSettingsPreview=false;
        const c=this.getShiftAvatarConversation();
        const target=(marks||[]).find(m=>['boxedText','callout'].includes(m.dataset?.mode));
        const next=target?this.getShiftPhotoCompareMarkSpeechSettings(target).avatarStyle:'';
        const previous=this._conversationLastSpeaker;
        const wait=c.enabled&&next&&previous&&previous!==next?Math.max(0,c.gap-(Date.now()-(this._conversationSilentAt||Date.now()))):0;
        if(!wait)return speak.call(this,marks,...args);
        this.cancelShiftPhotoCompareSpeech();this._conversationWaiting=true;
        this._conversationSpeechTimer=setTimeout(()=>{this._conversationWaiting=false;speak.call(this,marks,...args);},wait);
        return true;
    };
    const track=p.syncShiftPhotoCompareSpeechAvatar;
    p.syncShiftPhotoCompareSpeechAvatar=function(...args){
        const audible=args[0]!==false&&this.isShiftPhotoCompareSpeechAudible();
        if(audible)this._conversationLastSpeaker=this._shiftPhotoCompareActiveSpeechAvatarStyle||this.getShiftPhotoCompareSpeechSettings().avatarStyle;
        if(this._conversationWasAudible&&!audible)this._conversationSilentAt=Date.now();
        this._conversationWasAudible=audible;return track.apply(this,args);
    };
    const avatarBadge=p.getShiftPhotoCompareTimelineAvatarBadgeHtml;
    p.getShiftPhotoCompareTimelineAvatarBadgeHtml=function(entry={}){
        const html=avatarBadge.call(this,entry);
        const page=entry.mark?this.getShiftPhotoCompareMarkPagesFromDataset(entry.mark)[entry.pageIndex||0]:null;
        const automatic=page?.speechAvatarAutoStyle&&page.speechAvatarAutoStyle===page.speechAvatarStyle;
        return html&&automatic?'<span class="timeline-auto-avatar" title="自動割り当て：再抽選の対象">'+html+'<i class="fa-solid fa-shuffle" aria-label="自動割り当て"></i></span>':html;
    };
    p.snapshotShiftAvatarConversation=function(){
        const entries=[];
        for(const page of this._shiftPhotoCompareAnimationState?.pages||[]){
            for(const entry of page.timelineEntries||[]){
                if(!['boxedTextPage','calloutPage'].includes(entry.type)||!entry.mark)continue;
                const data=this.getShiftPhotoCompareMarkPagesFromDataset(entry.mark)[entry.pageIndex||0];
                if(data)entries.push({page,entry,style:data.speechAvatarStyle||'',automatic:data.speechAvatarAutoStyle||''});
            }
        }
        const config=this.getShiftAvatarConversation();
        return {config,entries,key:JSON.stringify([config,entries.map(e=>[e.style,e.automatic])])};
    };
    p.undoShiftAvatarConversation=function(){
        const state=this._shiftPhotoCompareAnimationState;
        if(!state||state.videoRecording)return;
        const snapshot=state._conversationUndo?.pop();
        if(!snapshot)return;
        this.cancelShiftPhotoCompareSpeech();
        let failed=false;
        for(const item of snapshot.entries){
            const current=this.getShiftPhotoCompareMarkPagesFromDataset(item.entry.mark)[item.entry.pageIndex||0];
            if(!current)continue;
            if((current.speechAvatarStyle||'')===item.style&&(current.speechAvatarAutoStyle||'')===item.automatic)continue;
            if(!this.persistShiftPhotoCompareAnimationPageAvatar(item.entry,item.style,item.page,!!item.style&&item.automatic===item.style))failed=true;
        }
        this.saveShiftAvatarConversationConfig(snapshot.config);
        this.renderShiftPhotoCompareAnimationTimeline();this.ensureShiftAvatarConversationPanel();
        this.showToast?.(failed?'一部の話者設定を保存できませんでした。':'話者設定を元に戻しました。');
    };
    for(const method of ['updateShiftAvatarConversation','swapShiftAvatarConversation','rerollShiftAvatarConversation','bulkShiftAvatarConversation','setShiftPhotoCompareAnimationPageAvatar','setSelectedShiftPhotoCompareAnimationPageAvatar']){
        const original=p[method];
        p[method]=function(...args){
            const state=this._shiftPhotoCompareAnimationState;
            if(!state||state.videoRecording||state._conversationHistoryBusy)return original.apply(this,args);
            const before=this.snapshotShiftAvatarConversation();state._conversationHistoryBusy=true;
            try{return original.apply(this,args);}
            finally{
                state._conversationHistoryBusy=false;
                if(before.key!==this.snapshotShiftAvatarConversation().key){
                    (state._conversationUndo||=[]).push(before);
                    if(state._conversationUndo.length>30)state._conversationUndo.shift();
                }
                this.ensureShiftAvatarConversationPanel();
            }
        };
    }
})();
