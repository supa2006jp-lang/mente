'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','store.js'),'utf8').split('// Global instance')[0]+'\nglobalThis.Store=MaintenanceStore;',context);
const Store=context.Store;

test('legacy startup normalization preserves total costs, stock and undo reference equivalence across reloads',()=>{
    const part={name:'oil',model:'',count:2,qty:2,price:1500,unit:'kg'};
    const record={id:'h',replacedParts:[part]};
    const master={name:'oil',model:'',stock:10,minStock:1,price:1500,priceRaw:'1500',unit:'kg'};
    const movement={partName:'oil',partModel:'',quantity:.5,delta:-.5,before:10.5,after:10,unit:'kg'};
    const refs=[['history',record],['stock',movement]];
    const undo={version:1,records:structuredClone([record]),partsMaster:[{before:structuredClone(master),after:structuredClone(master),references:JSON.stringify(refs)}]};
    const data={departments:[{id:'d',name:'D'}],deptData:{d:{history:[record],partsMaster:[master],partStockMovements:[movement],historyImportLogs:[{undo}]}}};
    Store.prototype.normalizeData.call({data});
    assert.equal(part.count*part.price,3000);assert.equal(part.qty,2000);assert.equal(master.stock,10000);assert.equal(master.minStock,1000);
    assert.equal(master.price,1.5);assert.equal(master.priceRaw,'1.5');assert.equal(movement.delta,-500);assert.equal(movement.before,10500);
    assert.deepEqual(undo.records[0],record);assert.deepEqual(undo.partsMaster[0].after,master);
    assert.deepEqual(JSON.parse(undo.partsMaster[0].references),refs);
    const once=JSON.stringify(data);Store.prototype.normalizeData.call({data});assert.equal(JSON.stringify(data),once);
});

test('legacy weights preserve zero and unknown prices and do not convert unrelated gram data',()=>{
    const records=[0,null,''].map(price=>({replacedParts:[{name:'oil',unit:'kg',count:.5,price}]}));
    const gram={name:'g',unit:'g',count:5,price:3};records.push({replacedParts:[gram]});
    const department={history:records,partsMaster:[{unit:'kg',price:0,priceRaw:'',stock:0,minStock:0}]};
    Store.normalizeDepartmentUnits(department);
    assert.deepEqual(records.slice(0,3).map(h=>h.replacedParts[0].price),[0,null,'']);
    assert.deepEqual(records.slice(0,3).map(h=>h.replacedParts[0].count),[500,500,500]);
    assert.equal(gram.price,3);assert.equal(gram.count,5);assert.equal(department.partsMaster[0].priceRaw,'');
});
