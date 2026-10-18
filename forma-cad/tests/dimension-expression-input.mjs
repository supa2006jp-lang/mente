import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {installDimensionExpressions} from '../src/dimension-expression-input.js';

class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.dataset={};this.style={};this.listeners={};this.value='';this.type='';this.title='';this.hidden=false;this.clientWidth=900;this.clientHeight=600;this.offsetWidth=300;this.offsetHeight=210;this.validity={};}
 setAttribute(k,v){this.attrs[k]=String(v);if(['min','max','step','type'].includes(k))this[k]=String(v);if(k==='value')this.value=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 removeAttribute(k){delete this.attrs[k];}
 append(...items){for(const item of items){if(item.parentElement)item.parentElement.children=item.parentElement.children.filter(c=>c!==item);item.parentElement=this;item.ownerDocument=this.ownerDocument;this.children.push(item);}}
 contains(el){return this===el||this.children.some(c=>c.contains(el));}
 get isConnected(){return !!this.ownerDocument?.documentElement.contains(this);}
 matches(s){if(s==='dialog[open]')return this.tagName==='DIALOG'&&this.open;const data=s.match(/^\[data-([^\]]+)\]$/);return data?this.attrs['data-'+data[1]]!==undefined:this.tagName.toLowerCase()===s;}
 closest(s){return this.matches(s)?this:this.parentElement?.closest(s)||null;}
 querySelector(s){for(const c of this.children){if(c.matches(s))return c;const found=c.querySelector(s);if(found)return found;}return null;}
 set innerHTML(html){const stack=[this];for(const token of html.match(/<[^>]*>|[^<]+/g)||[]){if(token.startsWith('</')){stack.pop();continue;}if(token[0]!=='<')continue;const [,tag,attrs]=token.match(/^<(\w+)(.*?)>$/),el=this.ownerDocument.createElement(tag);for(const m of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g))el.setAttribute(m[1],m[2]??'');stack.at(-1).append(el);if(!['input','br'].includes(tag))stack.push(el);}}
 addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
 dispatchEvent(event){event.target??=this;for(const listener of this.listeners[event.type]||[]){listener(event);if(event.stopped)break;}return !event.defaultPrevented;}
 focus(){this.ownerDocument.activeElement=this;this.ownerDocument.dispatchEvent(new Event('focusin',{target:this}));}
 select(){this.selected=true;}
 setSelectionRange(a,b){this.selection=[a,b];}
 getClientRects(){return this.isConnected&&!this.hidden?[this.getBoundingClientRect()]:[];}
 getBoundingClientRect(){return {left:100,top:100,bottom:130,width:100,height:30};}
 showPopover(){this.shown=true;}hidePopover(){this.shown=false;}
 checkValidity(){const n=Number(this.value),base=Number(this.getAttribute('min')??this.getAttribute('value')??0),step=Number(this.step||1);this.validity={rangeUnderflow:this.min!==undefined&&n<Number(this.min),rangeOverflow:this.max!==undefined&&n>Number(this.max),stepMismatch:this.step!=='any'&&Math.abs((n-base)/step-Math.round((n-base)/step))>1e-7};return this.value!==''&&Number.isFinite(n)&&!Object.values(this.validity).some(Boolean);}
}
class Event{constructor(type,options={}){this.type=type;Object.assign(this,options);}preventDefault(){this.defaultPrevented=true;}stopImmediatePropagation(){this.stopped=true;}}
const doc=new Element('document'),win=new Element('window');doc.createElement=tag=>{const el=new Element(tag);el.ownerDocument=doc;return el;};doc.documentElement=doc.createElement('html');doc.head=doc.createElement('head');doc.body=doc.createElement('body');doc.documentElement.append(doc.head,doc.body);doc.defaultView=win;win.Event=Event;win.innerWidth=900;win.innerHeight=600;
const dialog=doc.createElement('dialog');dialog.open=true;doc.body.append(dialog);const input=doc.createElement('input');input.type='number';input.id='length';input.setAttribute('step','any');input.value='30';dialog.append(input);const editor=installDimensionExpressions({document:doc,window:win}),panel=dialog=>dialog.querySelector('section')||doc.body.querySelector('section'),root=panel(dialog),text=root.querySelector('input'),apply=root.querySelector('[data-apply]');
let inputs=0,changes=0;input.addEventListener('input',()=>inputs++);input.addEventListener('change',()=>changes++);
const key=(key,type='keydown',target=doc.activeElement,options={})=>{const e=new Event(type,{key,code:key,target,...options});win.dispatchEvent(e);return e;};
// Register the real parent Escape handler after the expression handler, as in app.js.
const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8'),escape=app.slice(app.indexOf('function handleToolEscape(e){'),app.indexOf('function performToolEscape(){'));
let parentEscapes=0;const context=vm.createContext({performToolEscape:()=>parentEscapes++,window:win});vm.runInContext('let escapePressed=false;'+escape+"window.addEventListener('keydown',handleToolEscape);window.addEventListener('keyup',handleToolEscape);",context);
input.focus();key('/');assert.equal(editor.active,true);assert.equal(text.value,'30/');assert.equal(root.parentElement,dialog,'calculator mounts inside a modal dialog');text.value='30/2';text.dispatchEvent(new Event('input'));assert.equal(apply.disabled,false);key('Enter');key('Enter','keyup');assert.equal(input.value,'15');assert.equal(inputs,1);assert.equal(changes,1);assert.equal(editor.active,false);
editor.open(input,'10+0.2');key('Escape');key('Escape','keyup');assert.equal(editor.active,false);assert.equal(input.value,'15');assert.equal(parentEscapes,0,'neither Escape keydown nor its keyup may close the parent tool');key('Escape');key('Escape','keyup');assert.equal(parentEscapes,1,'the next normal Escape still reaches the tool');
for(const expression of ['1/0','1+']){editor.open(input,expression);assert.equal(apply.disabled,true);const before=changes;key('Enter');key('Enter','keyup');assert.equal(editor.active,true);const outside=new Event('pointerdown',{target:input});doc.dispatchEvent(outside);assert.equal(outside.defaultPrevented,true);assert.equal(changes,before);assert.equal(input.value,'15');editor.close();}
input.setAttribute('min','0.1');input.setAttribute('max','20');for(const expression of ['0-1','21']){editor.open(input,expression);assert.equal(apply.disabled,true);editor.close();}
input.setAttribute('step','1');input.setAttribute('min','1');editor.open(input,'3/2');assert.equal(apply.disabled,true,'integer counts retain their input step constraint');editor.close();input.setAttribute('step','any');
editor.open(input,'10+0.2');doc.dispatchEvent(new Event('pointerdown',{target:input}));assert.equal(input.value,'10.2');assert.equal(editor.active,false,'valid outside clicks commit before a tool button handles the click');
const pasted=new Event('paste',{target:input,clipboardData:{getData:()=> '（２０－４）／２'}});doc.dispatchEvent(pasted);assert.equal(pasted.defaultPrevented,true);assert.equal(text.value,'（２０－４）／２');assert.equal(apply.disabled,false);key('Enter');assert.equal(input.value,'8');key('Enter','keyup');
editor.open(input,'10/2');input.value='12';key('Enter');assert.equal(input.value,'12');assert.equal(editor.active,false,'a changed underlying value cannot be overwritten by a stale expression');
editor.open(input,'10/2');input.disabled=true;key('Enter');assert.equal(input.value,'12');assert.equal(editor.active,false);input.disabled=false;
input.focus();key('-');assert.equal(editor.active,false,'initial minus remains a native negative-number input');doc.dispatchEvent(new Event('input',{target:input,isTrusted:true}));key('-');assert.equal(editor.active,true,'minus after typing a value starts subtraction');editor.close();
console.log('PASS expression activation/commit events, dynamic modal fields, real app Escape key-pair isolation, invalid edits/constraints, outside clicks, Japanese paste, stale targets and native negative signs');
