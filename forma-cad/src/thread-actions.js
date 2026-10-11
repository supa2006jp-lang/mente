import {threadMateSource} from './thread-source.js';
export function installThreadActions({getFeatures,getSurface,getBodyId,canUse,openThread,openMate}){
 const container=document.getElementById('measurement');
 const make=(id,text,action)=>{let button=document.getElementById(id);if(!button){button=document.createElement('button');button.id=id;button.type='button';button.hidden=true;container.append(button);}button.textContent=text;button.onclick=action;return button;};
 const direct=make('thread-selected-surface','この面をねじ化',()=>openThread());
 const mate=make('thread-mate-selected','相手ねじを作成',()=>openMate(getBodyId()));
 return {update(){const usable=canUse(),surface=getSurface(),source=usable&&threadMateSource(getFeatures(),getBodyId());
  direct.hidden=!(usable&&Number.isFinite(surface?.radius)&&surface.radius>0);direct.textContent=surface?.internal?'この内壁をねじ化':'この側面をねじ化';
  mate.hidden=!source;if(source){mate.textContent=source.spec.threadInternal===false?'相手の雌ねじを作成':source.spec.threadInternal===true?'相手の雄ねじを作成':'相手ねじを作成';mate.title='このボディの最後に作成したねじに合わせます';}
 }};
}
