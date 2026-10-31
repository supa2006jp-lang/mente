import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {defaults} from '../src/geometry.js';
import {pipeSketchPaths,pipePathIncludes,pipePathSelection} from '../src/pipe-path.js';
import {sketchSegments} from '../src/sketch-selection.js';

const base={...defaults,kind:'sketch',name:'スケッチ',groupId:'chain',groupNumber:1,plane:'XY',x:0,y:0,z:0};
const line=(id,a,b,extra={})=>({...base,id,profile:'line',width:Math.hypot(b[0]-a[0],b[1]-a[1]),angle:Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI,x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,...extra});
const curve={...base,id:'curve',profile:'spline',points:[[0,0],[10,4],[20,0]],closed:false};
const features=[line('start',[-20,0],[0,0]),curve,line('end',[40,0],[20,0]),line('separate',[0,30],[20,30]),line('other-group',[40,0],[60,0],{groupId:'other'}),line('hidden',[0,0],[0,-20],{groupHidden:true})];
const paths=()=>pipeSketchPaths(features.filter(f=>!f.groupHidden));
const selectedSketchSegments=new Map(),elements=Object.fromEntries(['tools-dialog','cad-command','cad-path','measurement-title','status'].map(id=>[id,{textContent:'',value:'',open:false}]));elements['cad-command'].value='pipe';
const app=await fs.readFile('src/app.js','utf8'),source=app.slice(app.indexOf('function selectSketchPath(path){'),app.indexOf('function selectedSketchAt(event){'));
let splineEdit=null,highlights=0;
const context=vm.createContext({sketchConstraintsEnabled:()=>false,features,pipeSketchSources:paths,pipeSketchPaths,pipePathIncludes,pipePathSelection,sketchSegments,selectedSketchSegments,selected:'old',selectedFace:{},selectedSurface:{},chosenRegion:{},renderer:{domElement:{getBoundingClientRect:()=>({left:0,top:0})}},screenPoint:v=>({x:400+v.x*10,y:200+v.y*10,z:0}),$:id=>id==='cad-fields'?{addEventListener(){}}:elements[id],clearEdgeSelection:()=>selectedSketchSegments.clear(),clearFaceSelection(){},dropPreview(){},showSketchSelection:()=>highlights++,selectFeature:id=>{splineEdit=id;},Set});
vm.runInContext(source,context);
const click=(feature,extra={})=>{const edges=sketchSegments(feature),edge=edges[Math.floor(edges.length/2)],p=edge.a.clone().add(edge.b).multiplyScalar(.5);return context.pickSketchEdge({clientX:400+p.x*10,clientY:200+p.y*10,...extra});};
const assertChain=()=>{assert.deepEqual([...selectedSketchSegments.keys()].sort(),['curve','end','start']);for(const f of features.slice(0,3))assert.deepEqual([...selectedSketchSegments.get(f.id)],sketchSegments(f).map(e=>e.index));assert.equal(elements['measurement-title'].textContent,'連続パス（3要素）');assert.equal(context.selected,null);assert.equal(context.selectedFace,null);assert.equal(context.selectedSurface,null);};
for(const member of features.slice(0,3)){
 selectedSketchSegments.clear();assert.equal(click(member),true);assertChain();assert.equal(splineEdit,null,'single click selects a mixed path instead of entering one spline editor');
}
click(curve,{ctrlKey:true});assert.deepEqual([...selectedSketchSegments.keys()],['start','end'],'Ctrl-click can still deselect an individual curve');
click(curve,{metaKey:true});assertChain();
click(features[3]);assert.deepEqual([...selectedSketchSegments.keys()],['separate'],'a disconnected stroke remains independent');
elements['tools-dialog'].open=true;elements['cad-path'].value='start';
for(const member of features.slice(0,3)){assert.equal(click(member),true);assertChain();}
elements['cad-path'].value='separate';context.selectPipePath();assert.deepEqual([...selectedSketchSegments.keys()],['separate'],'the path dropdown replaces the entire previous highlight');
elements['cad-path'].value='start';context.selectPipePath();assertChain();
elements['cad-command'].value='sketchOffset';click(features[0]);assert.deepEqual([...selectedSketchSegments.keys()],['start'],'other commands retain individual-edge selection');
elements['tools-dialog'].open=false;const standalone={...curve,id:'solo',groupId:'solo',points:[[80,0],[90,4],[100,0]]};features.push(standalone);click(standalone);assert.equal(splineEdit,'solo','standalone spline editing remains available');
assert.ok(highlights>=10);
console.log('PASS real app click handler: every line/curve selects and highlights the full connected path; pipe dropdown, Ctrl/Meta individual toggles, separate/hidden groups, other commands and standalone editing');
