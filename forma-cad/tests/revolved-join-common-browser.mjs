import fs from 'node:fs/promises';import assert from 'node:assert/strict';
process.env.FORMA_JOIN_FIXTURE='tests/fixtures/revolved-join-common-failure.forma.json';process.env.FORMA_JOIN_TEST_OUT='.sites-runtime/revolved-join-common-browser';
await import('./revolved-body-join-browser.mjs');
const proof=JSON.parse(await fs.readFile(process.env.FORMA_JOIN_TEST_OUT+'/proof.json','utf8'));assert.equal(proof.inputSourceBody,'db08bd46-8d73-4204-b2ce-10f241c61387');assert.equal(proof.inputEnvelopeBody,'2983cd04-9973-403f-8ee4-611aee59e38a');
