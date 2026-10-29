/* Independent per-account switches (issue #521 / split toggle).
 *
 * The account row carries two chips: "LLM 流" (`enabled`, API dispatch) and
 * "签到福利" (`tasksEnabled`, check-in / growth / travel / daily activity).
 * Each toggle must PATCH only its own field, so changing one never flips the
 * other. The task cards and pending-daily-chat list must filter on
 * `tasksEnabled`, not `enabled`.
 *
 * Run with Node: node tests/_test_task_toggle.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');

const start = html.indexOf('async function toggleAccount(uid, enable, btn)');
const end = html.indexOf('async function setAccountWeight');
assert.ok(start > 0 && end > start, 'dashboard.html 里找不到 switch helpers，测试需要更新');
const source = html.slice(start, end);

const calls = [];
const postJSON = async (url, body) => { calls.push([url, body]); return {}; };
const loadAccounts = async () => {};
const toast = () => {};
const factory = new Function('postJSON', 'loadAccounts', 'toast',
  source + '\nreturn {toggleAccount, toggleAccountTasks};');
const api = factory(postJSON, loadAccounts, toast);

(async () => {
  await api.toggleAccount('uid-1', true);
  assert.deepStrictEqual(calls[0],
    ['/accounts/set', { uid: 'uid-1', enabled: true }],
    '切换 LLM 流必须只发 enabled，不能顺手改 tasksEnabled');
  await api.toggleAccount('uid-1', false);
  assert.deepStrictEqual(calls[1],
    ['/accounts/set', { uid: 'uid-1', enabled: false }]);

  await api.toggleAccountTasks('uid-1', true);
  assert.deepStrictEqual(calls[2],
    ['/accounts/set', { uid: 'uid-1', tasksEnabled: true }],
    '切换签到福利必须只发 tasksEnabled，不能顺手改 enabled');
  await api.toggleAccountTasks('uid-1', false);
  assert.deepStrictEqual(calls[3],
    ['/accounts/set', { uid: 'uid-1', tasksEnabled: false }]);

  assert.ok(html.includes("LLM 流 ' + (a.enabled ? '开' : '关')"),
    '账号行应显示独立的 LLM 流开关');
  assert.ok(html.includes("签到福利 ' + (a.tasksEnabled ? '开' : '关')"),
    '账号行应显示独立的签到福利开关');
  assert.ok(html.includes('LLM 关 · 签到开'),
    '关闭 LLM 流但保留签到福利的账号应有明确状态');
  for (const needle of [
    "a.realm === 'intl' && taskActive(a)",
    "a.realm === 'cn' && taskActive(a)",
  ]) {
    assert.ok(html.includes(needle), '任务视图应按 tasksEnabled 过滤：' + needle);
  }
  assert.ok(html.includes("a.tasksEnabled !== undefined ? !!a.tasksEnabled : !!a.enabled"),
    '旧网关没有 tasksEnabled 时应回落到 enabled');
  console.log('task toggle assertions passed (' + calls.length + ' calls)');
})().catch((err) => { console.error(err); process.exit(1); });
