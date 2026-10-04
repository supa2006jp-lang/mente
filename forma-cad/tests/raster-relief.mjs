import assert from 'node:assert/strict';import {rgbaRaster,validateRaster,rasterRelief,rasterQualities} from '../src/raster-relief.js';
const raster=rgbaRaster(4,2,new Uint8ClampedArray([0,0,0,255,85,85,85,255,170,170,170,255,255,255,255,255,0,0,0,255,85,85,85,255,170,170,170,255,255,255,255,255]));assert.deepEqual(raster.values,[0,85,170,255,0,85,170,255]);
const relief=rasterRelief(raster,{smoothing:0});for(const [i,value]of [0,1/3,2/3,1].entries())assert.ok(Math.abs(relief.sample((i+.5)/4,.5)-value)<1e-12);assert.ok(Math.abs(relief.sample(.5,.5)-.5)<1e-12,'gray makes a continuous intermediate height');
for(const seam of ['single','mirror','repeat']){assert.ok(Math.abs(relief.sample(0,.4,seam,3)-relief.sample(1,.4,seam,3))<1e-12);assert.ok(Math.abs(relief.sample(1e-8,.4,seam,3)-relief.sample(1-1e-8,.4,seam,3))<1e-6);}
assert.ok(Math.abs(relief.sample(.1,.4,'repeat',3)-relief.sample(.1+1/3,.4,'repeat',3))<1e-12);
const inverse=rasterRelief(raster,{invert:true,smoothing:0});for(let u=0;u<1;u+=.01)assert.ok(Math.abs(relief.sample(u,.5)+inverse.sample(u,.5)-1)<1e-12);
const transparent={...raster,alpha:[0,255,255,255,0,255,255,255]};assert.equal(rasterRelief(transparent,{invert:true,smoothing:2}).sample(.125,.5),0,'transparent pixel stays flat when inverted and smoothed');
const smooth=rasterRelief(raster,{smoothing:4});assert.ok(smooth.sample(.125,.5)>0&&smooth.sample(.875,.5)<1);for(const quality of Object.keys(rasterQualities))assert.ok(rasterRelief(raster,{quality}).columns>=48);
assert.deepEqual(rasterRelief(JSON.parse(JSON.stringify(raster)),relief.settings).values,relief.values);
for(const value of [{...raster,version:2},{...raster,width:129},{...raster,values:[0]},{...raster,values:raster.values.map(()=>NaN)},{...raster,alpha:[255]}])assert.throws(()=>validateRaster(value));
for(const settings of [{invert:1},{contrast:0},{contrast:NaN},{smoothing:1.5},{smoothing:5},{quality:'toString'}])assert.throws(()=>rasterRelief(raster,settings));
console.log('PASS grayscale levels, continuous interpolation, seamless repeats, invert/contrast/blur, transparency, save replay and invalid data');
