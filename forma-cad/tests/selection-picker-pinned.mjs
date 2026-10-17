import assert from 'node:assert/strict';
import {createSelectionPicker} from '../src/selection-picker.js';

// Small DOM/event fixture for the widget's public interaction contract.
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.listeners={};this.style={setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}};this.clientWidth=900;this.clientHeight=600;this.offsetWidth=270;this.offsetHeight=300;}
 setAttribute(k,v){this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 append(...items){for(const item of items){item.parentElement=this;this.children.push(item);}}
 replaceChildren(...items){this.children=[];this.append(...items);}
 contains(element){return element===this||this.children.some(c=>c.contains(element));}
 matches(selector){return selector.split(',').some(raw=>{const s=raw.trim();if(s[0]==='.')return (this.className||'').split(' ').includes(s.slice(1));if(s[0]==='#')return this.id===s.slice(1);const a=s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);if(a){const value=a[1].startsWith('data-')?this.dataset[a[1].slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:this.attrs[a[1]];return value!==undefined&&(a[2]===undefined||value===a[2]);}return this.tagName.toLowerCase()===s;});}
 closest(s){return this.matches(s)?this:this.parentElement?.closest(s)||null;}
 querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 set innerHTML(html){const stack=[this];this.children=[];for(const token of html.match(/<[^>]*>|[^<]+/g)||[]){if(token.startsWith('</')){stack.pop();continue;}if(token[0]!=='<'){stack.at(-1).textContent=(stack.at(-1).textContent||'')+token;continue;}const [,tag,attributes]=token.match(/^<(\w+)(.*?)>$/),el=new Element(tag);for(const match of attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)){el.setAttribute(match[1],match[2]??'');if(match[1]==='class')el.className=match[2];}stack.at(-1).append(el);stack.push(el);}}
 addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
 fire(type,properties={}){const event={type,target:this,preventDefault(){},stopImmediatePropagation(){},...properties};for(const listener of this.listeners[type]||[])listener(event);this['on'+type]?.(event);}
 getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight};}
 scrollIntoView(){this.scrolled=true;}
}
const previous={document:globalThis.document,window:globalThis.window},doc=new Element('document'),win=new Element('window');doc.createElement=tag=>new Element(tag);doc.head=new Element('head');doc.body=new Element('body');globalThis.document=doc;globalThis.window=win;
try{
 const viewport=new Element(),host=new Element(),canvas=new Element('canvas'),cube=new Element(),nav=new Element();cube.className='view-cube';nav.className='navigation';viewport.append(host,cube,nav);host.append(canvas);let usable=true,picker,lastPreview=null,chosen=null;
 picker=createSelectionPicker({host,canvas,canUse:()=>usable,choose:c=>{chosen=c;picker.close();},preview:c=>{lastPreview=c;},isSelected:()=>false});
 const items=Array.from({length:12},(_,i)=>({kind:i===0?'body':'edge',bodyId:'part',key:'candidate-'+i,label:'候補'+i,detail:'直線 · 長さ 5 mm'})),revision=[],open=()=>picker.open(items,{clientX:300,clientY:200},revision),panel=viewport.querySelector('#selection-candidates'),pin=panel.querySelector('[data-pin]');
 open();assert.equal(picker.visible,true);assert.equal(picker.pinned,false);assert.equal(panel.querySelectorAll('small')[0].textContent,items[0].detail,'candidate dimensions appear in the rendered list');
 pin.fire('click');assert.equal(picker.pinned,true);assert.equal(pin.getAttribute('aria-pressed'),'true');assert.equal(host.dataset.selectionCandidatePinned,'true');
 const button=panel.querySelector('[data-candidate-index="1"]');button.fire('pointerenter');assert.equal(lastPreview,items[1]);panel.fire('pointerleave');assert.equal(lastPreview,items[1],'inspection stays highlighted while leaving the panel to rotate');
 for(const target of [canvas,cube,nav]){doc.fire('pointerdown',{target});assert.equal(picker.visible,true,'camera controls must not close a pinned list');}
 canvas.fire('wheel');win.fire('resize');assert.equal(picker.visible,true);assert.equal(lastPreview,items[1]);assert.equal(picker.revision,revision);
 panel.querySelector('[data-candidate-index="0"]').fire('click');assert.equal(chosen,items[0]);assert.equal(picker.visible,true,'a selection callback closing its ordinary popup must not close the pinned inspector');assert.equal(lastPreview,items[0]);
 win.fire('keydown',{target:canvas,key:'Tab',shiftKey:true});assert.equal(chosen,items[11]);assert.equal(panel.querySelector('#selection-candidate-more').open,true,'keyboard cycling still reaches folded alternatives');assert.equal(panel.querySelector('[data-candidate-index="11"]').scrolled,true);
 pin.fire('click');assert.equal(picker.pinned,false);assert.equal(lastPreview,null);canvas.fire('wheel');assert.equal(picker.visible,false,'ordinary lists retain their current close-on-navigation behavior');
 open();pin.fire('click');doc.fire('pointerdown',{target:new Element('button')});assert.equal(picker.visible,false,'starting another command closes the inspector');
 open();pin.fire('click');usable=false;picker.refresh();assert.equal(picker.visible,false,'stale model or command state cannot leave actionable old candidates');usable=true;
 open();pin.fire('click');win.fire('keydown',{target:canvas,key:'Escape'});assert.equal(picker.visible,false);assert.equal(picker.pinned,false);assert.equal(lastPreview,null);
 console.log('PASS rendered edge detail, pinned camera gestures/wheel/view controls/resize, persistent inspection, body selection callback, folded keyboard navigation, unpin, command/stale-state/Escape cleanup');
}finally{for(const key of ['document','window'])if(previous[key]===undefined)delete globalThis[key];else globalThis[key]=previous[key];}
