const circled=number=>number>=1&&number<=20?String.fromCodePoint(0x2460+number-1):number>=21&&number<=35?String.fromCodePoint(0x3251+number-21):number>=36&&number<=50?String.fromCodePoint(0x32b1+number-36):String(number);

export function createSketchNumberTabs({anchor,onSelect}){
 const nav=document.createElement('nav');nav.id='sketch-number-tabs';nav.setAttribute('aria-label','スケッチ番号で切替');anchor.append(nav);
 const style=document.createElement('style');style.textContent=`
 #sketch-number-tabs{position:absolute;left:calc(100% + 18px);top:-5px;display:flex;align-items:center;gap:5px;max-width:240px;overflow-x:auto;overflow-y:hidden;padding:3px;border-radius:8px;pointer-events:auto;background:#fffffff0;scrollbar-width:thin;scrollbar-color:#9fbcc9 transparent}
 #sketch-number-tabs[hidden]{display:none}
 #sketch-number-tabs button{flex:0 0 auto;min-width:32px;height:32px;padding:0 5px;border-radius:6px;border:1px solid #adc4d0;background:#f5f9fb;color:#35586a;font-size:23px;line-height:1}
 #sketch-number-tabs button:hover{background:#e0f3f8;border-color:#2586a3}
 @property --sketch-rainbow-angle{syntax:'<angle>';initial-value:0deg;inherits:false}
 #sketch-number-tabs button[aria-pressed=true]{border:2px solid transparent;color:white;background:linear-gradient(#164459,#164459) padding-box,conic-gradient(from var(--sketch-rainbow-angle),#ff5687,#ffbd4b,#e9f658,#50e0a0,#40dfff,#7987ff,#df68f5,#ff5687) border-box;box-shadow:0 0 5px #40dfffa8,0 0 9px #df68f56b;text-shadow:0 0 4px #ffffff73;animation:sketch-number-rainbow 5s linear infinite}
 @keyframes sketch-number-rainbow{0%{--sketch-rainbow-angle:0deg;box-shadow:0 0 5px #40dfffa8,0 0 9px #df68f56b}50%{box-shadow:0 0 6px #ffbd4bab,0 0 10px #50e0a073}100%{--sketch-rainbow-angle:360deg;box-shadow:0 0 5px #40dfffa8,0 0 9px #df68f56b}}
 @media(prefers-reduced-motion:reduce){#sketch-number-tabs button[aria-pressed=true]{animation:none}}
 #sketch-number-tabs button[data-hidden=true]:not([aria-pressed=true]){border-style:dashed}
 #sketch-number-tabs button:focus-visible{outline:2px solid #096a8d;outline-offset:-3px}
 @media(max-width:1500px){#sketch-number-tabs{left:calc(100% + 10px);max-width:160px}}
 `;document.head.append(style);let groups=[],active=null,enabled=true,signature='';
 function fit(){
  if(nav.hidden)return;const box=nav.getBoundingClientRect(),viewport=anchor.parentElement.getBoundingClientRect(),banner=document.getElementById('sketch-banner');let right=viewport.right-180;
  if(banner&&!banner.hidden){const obstacle=banner.getBoundingClientRect();if(box.top<obstacle.bottom&&box.bottom>obstacle.top)right=Math.min(right,obstacle.left-8);}
  nav.style.maxWidth=Math.max(36,Math.min(innerWidth<=1500?160:240,right-box.left))+'px';
 }
 const resize=new ResizeObserver(fit);resize.observe(anchor);resize.observe(anchor.parentElement);const banner=document.getElementById('sketch-banner');if(banner)new MutationObserver(fit).observe(banner,{attributes:true,attributeFilter:['hidden']});
 function update(state,force=false){if(!force&&active===state.active&&enabled===state.enabled)return;active=state.active;enabled=state.enabled;for(const button of nav.children){const current=Number(button.dataset.number)===active;button.disabled=!enabled;button.setAttribute('aria-pressed',String(current));button.setAttribute('aria-label','スケッチ'+button.dataset.number+(current?'を終了':'を編集'));button.title='スケッチ'+button.dataset.number+(current?'を終了':'を作図する');}}
 function sync(state){
  const next=JSON.stringify(state.groups);
  if(next!==signature){signature=next;groups=state.groups;nav.replaceChildren(...groups.map(group=>{const button=document.createElement('button');button.type='button';button.textContent=circled(group.number);button.dataset.groupId=group.id;button.dataset.number=String(group.number);button.dataset.pending=String(!!group.pending);button.dataset.hidden=String(!!group.hidden);button.setAttribute('aria-label','スケッチ'+group.number+'を編集');button.title='スケッチ'+group.number+' · '+group.plane+(group.pending?'（作図中）':'を作図する'+(group.hidden?'（非表示から切替）':''));return button;}));nav.hidden=!groups.length;}
  const previous=active;update(state,true);fit();if(previous!==active)nav.querySelector('[aria-pressed=true]')?.scrollIntoView({block:'nearest',inline:'nearest'});
 }
 nav.onclick=event=>{const button=event.target.closest('button');if(button&&!button.disabled)onSelect(button.dataset.groupId);};
 nav.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const buttons=[...nav.children].filter(b=>!b.disabled),current=buttons.indexOf(document.activeElement);if(current<0)return;event.preventDefault();event.stopPropagation();const index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[index]?.focus();};
 nav.hidden=true;return {sync,update};
}
