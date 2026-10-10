// Shared pitch choices and initial selection for nominal-diameter metric threads.
export const metricThreadPitches=[.25,.35,.4,.5,.7,.75,.8,1,1.25,1.5,1.75,2,2.5,3,3.5,4,5,6];
export function metricThreadPitchOptions(diameter){
 return metricThreadPitches.filter(p=>p<Math.max(diameter/2,1));
}
export function defaultMetricThreadPitch(diameter){
 const nominal=Number(diameter.toFixed(4));
 const pitch=nominal<=4?.7:nominal<=6?1:nominal<=10?1.5:nominal<=16?2:nominal<=24?3:4;
 const options=metricThreadPitchOptions(nominal);
 return options.includes(pitch)?pitch:options[0];
}
