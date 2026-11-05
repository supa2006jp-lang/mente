import test from 'node:test';
import assert from 'node:assert/strict';
import {readCommandUsage,orderFavoriteCommands,moveFavoriteCommand} from '../src/favorite-command-order.js';
import {readFavoriteCommands} from '../src/favorite-commands.js';

test('usage ranking preserves ties and rejects damaged counters and legacy settings default to manual order',()=>{
 const usage=readCommandUsage({'move-tool':3,'solid-tool':3,'direct-fillet':5,bad:-1,decimal:.5,broken:'4','<script>':1});
 assert.deepEqual(usage,{'move-tool':3,'solid-tool':3,'direct-fillet':5});
 const ids=['solid-tool','move-tool','direct-fillet','cut-tool'];
 assert.deepEqual(orderFavoriteCommands(ids,usage),['direct-fillet','solid-tool','move-tool','cut-tool']);
 assert.deepEqual(ids,['solid-tool','move-tool','direct-fillet','cut-tool']);
 assert.equal(readFavoriteCommands({favorites:ids}).autoSort,false);
 assert.equal(readFavoriteCommands({favorites:ids,autoSort:true}).autoSort,true);
 assert.deepEqual(readCommandUsage(null),{});
});

test('drag insertion works in both directions, has no duplicates and ignores cancelled or invalid targets',()=>{
 const ids=['a','b','c','d'];
 assert.deepEqual(moveFavoriteCommand(ids,'a','c',false),['b','c','a','d']);
 assert.deepEqual(moveFavoriteCommand(ids,'d','b',true),['a','d','b','c']);
 assert.deepEqual(moveFavoriteCommand(ids,'a','a',false),ids);
 assert.deepEqual(moveFavoriteCommand(ids,'a','outside',true),ids);
 assert.deepEqual(ids,['a','b','c','d']);
});
