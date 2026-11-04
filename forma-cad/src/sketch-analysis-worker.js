import {analyzeSketchRegions} from './sketch-region-analysis.js';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:analyzeSketchRegions(data.spec)});}catch(e){self.postMessage({id:data.id,error:e.message||String(e)});}};
