import assert from 'node:assert/strict';
import {singlePatternLayout,singlePatternFraction} from '../src/single-pattern-layout.js';
import {periodicSvgRegions} from '../src/svg-wrap-pattern.js';
import {rasterRelief} from '../src/raster-relief.js';
for(const aspect of [.1,1,4/3,4]){const p=singlePatternLayout(60*Math.PI,60,aspect);assert.ok(p.width<60*Math.PI&&p.height<60);assert.ok(Math.abs(p.height/p.width-aspect)<1e-12);assert.ok(Math.abs(p.height+2*p.offset-60)<1e-12);assert.ok(Math.abs(p.width-(60*Math.PI-2*p.margin))<1e-10||Math.abs(p.height-(60-2*p.margin))<1e-10,'maximal fit touches an available bound');}
for(const values of [[0,60,1],[60,NaN,1],[60,60,0]])assert.throws(()=>singlePatternLayout(...values));for(const width of [0,NaN,100])assert.throws(()=>singlePatternFraction(width,100));
const region={outer:[[.1,.1],[.9,.1],[.9,.9],[.1,.9]],holes:[[[.3,.3],[.3,.7],[.7,.7],[.7,.3]]]},mapped=periodicSvgRegions([region],'fit',1,.25);assert.equal(mapped.length,1);assert.equal(mapped[0].holes.length,1);assert.ok(mapped[0].outer.every(([x])=>x>=.025-1e-8&&x<=.225+1e-8));
const raster={version:1,width:4,height:4,values:Array(16).fill(255)},height=rasterRelief(raster,{smoothing:0});assert.equal(height.sample(.1,.5,'fit',1,.25),1);assert.equal(height.sample(.5,.5,'fit',1,.25),0);assert.equal(height.sample(.99,.5,'fit',1,.25),0);assert.throws(()=>height.sample(.1,.5,'fit',1,0));console.log('PASS single image maximum fit, aspect ratio, holes and unmodified surrounding area');
