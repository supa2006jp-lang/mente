// Keep first paint free of CAD downloads. Begin warming after user interaction.
export function warmKernelOnInteraction(client,target=window){
 let scheduled=false;
 const start=()=>{if(scheduled)return;scheduled=true;target.removeEventListener('pointerdown',start);target.removeEventListener('keydown',start);setTimeout(()=>{const warm=()=>{if(!client.worker)client.warmup().catch(()=>{});};if(target.requestIdleCallback)target.requestIdleCallback(warm,{timeout:3000});else warm();},1200);};
 target.addEventListener('pointerdown',start,{passive:true});target.addEventListener('keydown',start,{passive:true});
}
