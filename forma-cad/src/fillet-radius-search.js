// Search whole selections at one common radius. A successful trial must include
// every body; failed or unfinished trials never replace the last verified one.
export function searchFilletRadius({upperRadius,initialRadius=upperRadius,trial,onProgress,onVerified,onFailure,expand=false,maxRadius=10000,maxAttempts=32,maxDurationMs=20000,now=()=>performance.now()}){
 if(!Number.isFinite(upperRadius)||upperRadius<.01||upperRadius>10000)throw Object.assign(Error('調べる上限半径を0.01〜10000 mmで入力してください'),{code:'fillet-radius'});
 const upper=Math.floor((upperRadius+1e-9)*100),cap=expand?Math.floor(Math.min(10000,Math.max(upperRadius,maxRadius))*100):upper,started=now();let low=0,high=null,candidate=Math.min(upper,Math.max(1,Math.floor((initialRadius+1e-9)*100))),attempts=0,best=null,limitReason,limiting=null;
 const info=()=>({radius:low/100,upperRadius,expanded:expand,resolution:.01,attempts,...(limiting&&limiting.radius>low/100?{limiting}:{}),...(limitReason?{limitReason}:{})});
 try{
  while(candidate>=1&&(high===null||high-low>1)){
   if(attempts>=maxAttempts||now()-started>=maxDurationMs){limitReason=attempts>=maxAttempts?'attempts':'time';break;}
   attempts++;onProgress?.({stage:'全対象の辺を R'+(candidate/100).toFixed(2)+' mmで検査しています',current:attempts,total:maxAttempts,filletTrial:'start'});
   let result,error;
   try{result=trial(candidate/100);}catch(failure){if(failure.code!=='fillet-geometry')throw failure;error=failure;}
   finally{onProgress?.({filletTrial:'end'});}
   if(result){best?.dispose?.();best=result;low=candidate;if(limiting?.radius<=low/100)limiting=null;onVerified?.(result,info());}
   else{high=candidate;limiting={radius:candidate/100,...(error?.diagnostics?{diagnostics:error.diagnostics}:{})};onFailure?.(limiting);}
   if(!expand&&low===upper)break;
   if(high===null){if(low===cap){if(expand)limitReason='radius-limit';break;}candidate=Math.min(cap,low*2);continue;}
   candidate=low?Math.floor((low+high)/2):Math.floor(candidate/2);
   if(!low&&candidate<1&&high>1)candidate=1;
  }
  if(!best)throw Object.assign(Error(limitReason?'検査上限までに全ての辺へ掛けられる半径を確認できませんでした。対象を絞って再度調べてください':'0.01 mm以上では全ての辺へ掛けられる半径を確認できませんでした。辺の選択や形状を確認してください'),{code:limitReason?'fillet-budget':'fillet-geometry'});
  const result={result:best,...info()};best=null;return result;
 }finally{best?.dispose?.();}
}
