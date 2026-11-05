import test from 'node:test';
import assert from 'node:assert/strict';
import {readCommandColors,commandColorText} from '../src/favorite-command-colors.js';
import {readFavoriteCommands} from '../src/favorite-commands.js';

test('saved command colors reject CSS and malformed values and clone drafts',()=>{
 const saved={colors:{'solid-tool':'#AABBCC','move-tool':'red',bad:'#fff',injection:'url(x)','<script>':'#ffffff'}};
 assert.deepEqual(readCommandColors(saved.colors),{'solid-tool':'#aabbcc'});
 const draft=readFavoriteCommands(saved);draft.colors['solid-tool']='#000000';assert.equal(saved.colors['solid-tool'],'#AABBCC');
 assert.deepEqual(readCommandColors(null),{});assert.deepEqual(readCommandColors([]),{});
});

test('command text uses a contrasting black or white foreground',()=>{
 assert.equal(commandColorText('#ffffff'),'#000000');assert.equal(commandColorText('#000000'),'#ffffff');
 assert.equal(commandColorText('#00cc88'),'#000000');assert.equal(commandColorText('#223366'),'#ffffff');
});
