const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../backend/node_modules/typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const source = fs.readFileSync(path.resolve(__dirname, '../src/components/ui/OrderStatusSelect.tsx'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
  jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const component = { exports: {} };
new Function('require', 'module', 'exports', js)(require, component, component.exports);
const { OrderStatusSelect } = component.exports;
for (const currentStatus of ['confirmed', 'assembling', 'shipped', 'cancelled']) {
  test(`manual selector from ${currentStatus} exposes every existing order status`, () => {
    let change;
    const element = OrderStatusSelect({ orderId: 7, currentStatus, onStatusChange: (...args) => { change = args; } });
    const html = renderToStaticMarkup(element);
    for (const status of ['confirmed', 'assembling', 'shipped', 'cancelled']) assert.ok(html.includes(`value="${status}"`));
    assert.doesNotMatch(html, /disabled/);
    element.props.children[0].props.onChange({ target: { value: 'confirmed' } });
    assert.deepEqual(change, [7, 'confirmed']);
  });
}
test('in-flight status request still disables selector', () => {
  const html = renderToStaticMarkup(React.createElement(OrderStatusSelect, {
    orderId: 7, currentStatus: 'cancelled', disabled: true, onStatusChange: () => {},
  }));
  assert.match(html, /disabled/);
});
