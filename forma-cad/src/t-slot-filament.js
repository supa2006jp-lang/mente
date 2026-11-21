import {framePartKey} from './t-slot-frame.js';

// Filament lengths (mm) from Bambu Studio 02.04.00.70 G-code for our A1 mini
// 0.6 mm PETG export. Each sample is one part on one plate. Columns for
// fittings are without brim and with the 5 mm outer brim used on rail plates.
const singlePartMm={
  bolt:[533.59,563.65],
  nut:[473.43,512.82],
  corner:[4293.88,4371.50],
  'corner-panel':[4426.99,4504.60],
  splice:[4255.20,4378.15],
  'splice-2':[2220.81,2297.21],
  'strap-24':[1746.53,1815.55]
};
// First column is the rail length or strap hole spacing in mm.
const railSamples=[[.3,163.78],[1,259.63],[3,524.07],[6,917.65],[20,2702.11],[80,10441.43],[160,20729.83]];
const keyedSamples=[[28.5,1913.55,1987.31],[38,2465.31,2549.08],[47.8,3008.25,3102.34]];
const sharedSamples=[[48,2676.26,2770.56],[58,3041.07,3145.91],[68,3407.75,3523.12]];

// Comparing plates with one and four identical nuts or bolts isolates this
// once-per-plate length from each single-part sample.
const plateStartMm=23.74;
const gramsPerMeter=1.27*Math.PI*(1.75/2)**2;

function interpolate(size,samples,column) {
  let i=1;
  while(i<samples.length-1&&size>samples[i][0])i++;
  const low=samples[i-1],high=samples[i];
  return low[column]+(high[column]-low[column])*(size-low[0])/(high[0]-low[0]);
}
function singlePartLength(part,brim) {
  if(part.kind==='rail'){
    // The 0.30 mm first layer is sampled at Z=0.15. Studio rejects thinner rails.
    if(part.length<.15)return null;
    if(part.length<=.39)return railSamples[0][1];
    return interpolate(part.length,railSamples,1);
  }
  if(part.kind==='strap'&&(part.keyed||part.shared))
    return interpolate(part.span,part.keyed?keyedSamples:sharedSamples,brim?2:1);
  return singlePartMm[framePartKey(part)][brim?1:0];
}
function amount(millimeters) {
  const meters=millimeters/1000;
  return {meters,grams:meters*gramsPerMeter};
}
export function estimateFrameFilament(plates) {
  const lengths=plates.map(({placements})=>{
    const brim=placements.some(({part})=>part.kind==='rail');
    let length=placements.length?plateStartMm:0;
    for(const {part} of placements){
      const sample=singlePartLength(part,brim);
      if(sample===null)return null;
      length+=sample-plateStartMm;
    }
    return length;
  });
  return {
    plates:lengths.map(length=>length===null?null:amount(length)),
    total:lengths.includes(null)?null:amount(lengths.reduce((sum,length)=>sum+length,0))
  };
}
