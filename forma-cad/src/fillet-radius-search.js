// Search whole selections at one common radius. A successful trial must include
// every body; failed or unfinished trials never replace the last verified one.
export function searchFilletRadius({upperRadius,trial,onProgress,onVerified,maxAttempts=24,maxDurationMs=20000,now=()=>performance.now()}){
 if(!Number.isFinite(upperRadius)||upperRadius<.01||upperRadius>10000)throw Object.assign(Error('調べる上限半径を0.01〜10000 mmで入力してください'),{code:'fillet-radius'});
 const upper=Math.floor((upperRadius+1e-9)*100),started=now();let low=0,high=upper+1,candidate=upper,attempts=0,best=null,limitReason;
 try{
  while(candidate>=1&&high-low>1){
   if(attempts>=maxAttempts||now()-started>=maxDurationMs){limitReason=attempts>=maxAttempts?'attempts':'time';break;}
   attempts++;onProgress?.({stage:'全対象の辺を R'+(candidate/100).toFixed(2)+' mmで検査しています',current:attempts,total:maxAttempts,filletTrial:'start'});
   let result;
   try{result=trial(candidate/100);}catch(error){if(error.code!=='fillet-geometry')throw error;}
   finally{onProgress?.({filletTrial:'end'});}
   if(result){best?.dispose?.();best=result;low=candidate;onVerified?.(result,{radius:low/100,upperRadius,resolution:.01,attempts});}
   else high=candidate;
   if(low===upper)break;
   candidate=low?Math.floor((low+high)/2):Math.floor(candidate/2);
   if(!low&&candidate<1&&high>1)candidate=1;
  }
  if(!best)throw Object.assign(Error(limitReason?'検査上限までに全ての辺へ掛けられる半径を確認できませんでした。対象を絞って再度調べてください':'0.01 mm以上では全ての辺へ掛けられる半径を確認できませんでした。辺の選択や形状を確認してください'),{code:limitReason?'fillet-budget':'fillet-geometry'});
  const result={result:best,radius:low/100,upperRadius,resolution:.01,attempts,...(limitReason?{limitReason}:{})};best=null;return result;
 }finally{best?.dispose?.();}
}
