export function finishCadSteps(steps){
 let step=steps.next();
 while(!step.done)step=steps.next();
 return step.value;
}

export function cancelledCadJob(){
 return Object.assign(Error('計算をキャンセルしました'),{code:'cancelled'});
}
