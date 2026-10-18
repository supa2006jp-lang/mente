import assert from 'node:assert/strict';
import {evaluateDimensionExpression as evaluate,dimensionExpressionValue as value,normalizeDimensionExpression} from '../src/dimension-expression.js';

for(const [expression,expected]of [['30/2',15],['10+0.2',10.2],['(20-4)*2',32],['2+3*4',14],['(2+3)*4',20],['30/2/3',5],['10-3-2',5],['-2*(3+4)',-14],['1--2',3],['+.2+-.1',.1],['1e2/4',25],['1e-3*1000',1],[' ２ ×（３＋４） ',14],['１０÷２－０．２',4.8],['-0',0],['0/7',0]])assert.equal(evaluate(expression),expected,expression);
assert.equal(value('0.1+0.2'),'0.3','floating-point noise is removed before writing a dimension');assert.equal(value('1/3'),'0.333333333333333');assert.equal(value('1e-20/2'),'5e-21');assert.equal(value('-0'),'0');assert.equal(normalizeDimensionExpression('（２＋３）÷５'),' (2+3)/5'.trim());
for(const expression of ['', ' ', '1+', '(2+3', '2+3)', '2(3)', '1..2', '1e', '1e+', '1/0', '0/0', '1/(2-2)', '1e309', '1e308*2', 'NaN', 'Infinity', 'Math.sqrt(4)', 'globalThis.hacked=1', '1;2', 'alert(1)', '2**3', '0x10', '2mm', '[1,2]', '1,5', '1%2', '('.repeat(34)+'1'+')'.repeat(34), '-'.repeat(34)+'1', '1+'.repeat(129)+'1'])assert.throws(()=>evaluate(expression),undefined,expression);
assert.equal(globalThis.hacked,undefined);
console.log('PASS arithmetic precedence, unary signs, parentheses, decimals, exponent notation, Japanese symbols, stable number formatting and rejection of invalid/unsafe/unbounded expressions');
