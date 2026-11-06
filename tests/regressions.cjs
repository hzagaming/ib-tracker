const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');
const KEY='ib-atlas-v1';
const source=fs.readFileSync('dist/app.js','utf8');
const html=fs.readFileSync('dist/index.html','utf8');

function workspace(memory=new Map()) {
  const {document,window}=parseHTML(html);
  const optionValue=o=>o.hasAttribute('value')?o.getAttribute('value'):o.textContent;
  // LinkeDOM does not implement native select defaults or dialog lifecycle.
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{
    configurable:true,
    get(){const o=this.querySelector('option[selected]')||this.querySelector('option');return o?optionValue(o):''},
    set(value){for(const o of this.querySelectorAll('option')){if(optionValue(o)===String(value))o.setAttribute('selected','');else o.removeAttribute('selected')}}
  });
  const $=s=>document.querySelector(s),dialog=$('#modal');
  Object.defineProperty(dialog,'open',{get:()=>dialog.hasAttribute('open')});
  dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');
  const events={},fault={data:false,timer:false},clock={now:Date.now()},ticks=[];
  class Clock extends Date {constructor(...args){super(...(args.length?args:[clock.now]))}static now(){return clock.now}}
  const storage={getItem:k=>memory.get(k)??null,setItem(k,v){if((k===KEY&&fault.data)||(k==='ib-atlas-timer'&&fault.timer)){const e=new Error('disk full');e.name='QuotaExceededError';throw e}memory.set(k,v)}};
  const ctx=vm.createContext({document,window:{addEventListener:(k,fn)=>events[k]=fn},location:{hash:''},console,Date:Clock,Math,JSON,Blob,URL,crypto:require('node:crypto').webcrypto,localStorage:storage,setTimeout(){},clearTimeout(){},setInterval:fn=>ticks.push(fn),confirm:()=>true,FormData:class{constructor(form){return [...form.querySelectorAll('[name]')].map(x=>[x.name,x.value])[Symbol.iterator]()}}});
  vm.runInContext(source,ctx);
  const run=s=>vm.runInContext(s,ctx);
  function submit(values){for(const [k,v] of Object.entries(values))$('#f-'+k).value=String(v);$('#form').onsubmit({preventDefault(){},target:$('#form')})}
  function task(title='Practice'){run("add('tasks')");submit({title});return run('data.tasks.at(-1)?.id')}
  function subject(){run("add('subjects')");submit({name:'Physics',group:'3'});return run('data.subjects.at(-1)?.id')}
  const route=hash=>run(`location.hash=${JSON.stringify(hash)};render()`);
  const file=raw=>({value:'selected.json',files:[{size:raw.length,text:async()=>raw}]});
  return {run,$,document,events,fault,clock,ticks,memory,submit,task,subject,route,file};
}

test('every page, quick-add and task filters work with parsed DOM',()=>{
  const a=workspace();a.$('#quick-add').click();assert.equal(a.$('#modal').open,true);
  assert.equal(a.$('#modal .actions').classList.contains('is-hidden'),true);
  a.$('[data-quick="tasks"]').click();a.submit({title:'Practice'});
  assert.equal(a.run('data.tasks.length'),1);
  a.route('#tasks');a.$('[data-task-tab="today"]').click();assert.equal(a.$('#status').value,'today');
  a.$('[data-check]').checked=true;a.$('[data-check]').onchange();assert.equal(a.$('[data-check]'),null);
  for(const route of ['dashboard','subjects','tasks','calendar','logs','grades','core','focus','settings']){a.route('#'+route);assert.ok(a.$('#app h1'),route)}
});

test('failed edit can be retried without stale object references',()=>{
  const a=workspace(),id=a.task();a.run(`add('tasks',${JSON.stringify(id)})`);
  a.fault.data=true;a.submit({title:'Changed'});assert.equal(a.run('data.tasks[0].title'),'Practice');assert.equal(a.$('#modal').open,true);assert.equal(a.$('#form-error').hidden,false);assert.ok(a.$('#form-error').textContent.includes('未能保存'));
  a.fault.data=false;a.submit({title:'Changed'});assert.equal(a.run('data.tasks[0].title'),'Changed');assert.equal(a.$('#modal').open,false);
  assert.equal(JSON.parse(a.memory.get(KEY)).tasks[0].title,'Changed');
});

test('failed completion and topic status writes roll back the visible value',()=>{
  const a=workspace();a.task();const id=a.subject();a.run(`topicEditor(${JSON.stringify(id)})`);a.submit({title:'Forces'});
  a.fault.data=true;a.route('#tasks');a.$('[data-check]').checked=true;a.$('[data-check]').onchange();assert.equal(a.run('data.tasks[0].done'),false);assert.equal(a.$('[data-check]').hasAttribute('checked'),false);
  a.route('#subject/'+id);a.$('[data-topic-status]').value='mastered';a.$('[data-topic-status]').onchange();assert.equal(a.run('data.topics[0].status'),'new');assert.equal(a.$('[data-topic-status]').value,'new');
});

test('failed topic edit retries against restored data',()=>{
  const a=workspace(),id=a.subject();a.run(`topicEditor(${JSON.stringify(id)})`);a.submit({title:'Forces'});
  a.run('topicEditor(data.subjects[0].id,data.topics[0].id)');a.fault.data=true;a.submit({title:'Momentum'});assert.equal(a.run('data.topics[0].title'),'Forces');
  a.fault.data=false;a.submit({title:'Momentum'});assert.equal(a.run('data.topics[0].title'),'Momentum');
});

test('profile save failures leave the prior profile intact',()=>{
  const a=workspace();a.route('#settings');a.fault.data=true;a.$('#f-name').value='New name';
  a.$('#profile-form').onsubmit({preventDefault(){},target:a.$('#profile-form')});assert.equal(a.run('data.profile.name'),'我的');
});

test('import storage failure keeps existing data and permits retrying the same file',async()=>{
  const a=workspace();a.task();const next=JSON.parse(a.memory.get(KEY));next.profile.name='Imported';next.tasks=[];
  const input=a.file(JSON.stringify(next));a.fault.data=true;await a.run('importData')({target:input});
  assert.equal(a.run('data.tasks.length'),1);assert.equal(a.run('data.profile.name'),'我的');assert.equal(input.value,'');
  a.fault.data=false;await a.run('importData')({target:input});assert.equal(a.run('data.profile.name'),'Imported');assert.equal(a.run('data.tasks.length'),0);
});

test('corrupt startup storage is preserved until explicitly recovered',()=>{
  const raw='{broken JSON',memory=new Map([[KEY,raw]]),a=workspace(memory);
  assert.ok(a.$('#recovery-export'));a.task();assert.equal(a.run('data.tasks.length'),0);assert.equal(memory.get(KEY),raw);
  a.$('#recovery-reset').click();assert.equal(a.run('recoveryRaw'),null);assert.equal(JSON.parse(memory.get(KEY)).tasks.length,0);
});

test('storage race rejects stale writes and reloads the newest records',()=>{
  const memory=new Map(),a=workspace(memory);a.task('First');
  const b=workspace(memory);a.run("add('tasks',data.tasks[0].id)");b.task('Second');
  a.submit({title:'Stale edit'});assert.equal(JSON.parse(memory.get(KEY)).tasks.length,2);assert.equal(JSON.parse(memory.get(KEY)).tasks[0].title,'First');assert.ok(a.$('#reload-records'));
  a.$('#reload-records').click();assert.equal(a.run('data.tasks.length'),2);assert.equal(a.$('#modal').open,false);
});

test('storage events refresh idle tabs and preserve an open editor',()=>{
  const memory=new Map(),a=workspace(memory),b=workspace(memory);b.task();a.events.storage({key:KEY});assert.equal(a.run('data.tasks.length'),1);
  a.run("add('tasks')");a.$('#f-title').value='Unsaved draft';b.task('Another');a.events.storage({key:KEY});
  assert.equal(a.$('#f-title').value,'Unsaved draft');assert.equal(a.$('#modal').open,true);assert.ok(a.$('#reload-records'));
});

test('backup schema rejects impossible dates, non-booleans, fractional scores and invalid enums',()=>{
  const a=workspace();a.task();const json=a.memory.get(KEY);
  for(const patch of [{date:'2026-02-30'},{date:'2025-02-29'},{done:'false'},{priority:'unknown'},{type:[]},{title:'   '}]){
    const d=JSON.parse(json);Object.assign(d.tasks[0],patch);assert.throws(()=>a.run('validate')(d));
  }
  assert.equal(a.run("validDate('2028-02-29')"),true);assert.equal(a.run("validDate('2026-02-29')"),false);
  a.run("add('grades')");a.submit({title:'Quiz',score:6.5});assert.equal(a.run('data.grades.length'),0);
  a.run("add('logs')");a.submit({title:'Study',minutes:-3});assert.equal(a.run('data.logs.length'),0);
});

test('old backups without topics and removed subject references remain usable',()=>{
  const a=workspace();a.task();const d=JSON.parse(a.memory.get(KEY));delete d.topics;d.tasks[0].subject='removed-subject';
  const restored=a.run('decodeData')(JSON.stringify(d));assert.equal(restored.tasks[0].subject,'');assert.equal(restored.topics.length,0);
});

test('quick-add and keyboard shortcut cannot replace an unsaved modal',()=>{
  const a=workspace();a.run("add('tasks')");a.$('#f-title').value='Unsaved draft';a.$('#quick-add').click();assert.equal(a.$('#f-title').value,'Unsaved draft');
  const key=new a.document.defaultView.Event('keydown');Object.defineProperties(key,{key:{value:'n'},altKey:{value:true}});a.document.dispatchEvent(key);assert.equal(a.$('#f-title').value,'Unsaved draft');
});

test('failed deletion is reversible and undo preserves unrelated new work',()=>{
  const a=workspace(),id=a.task();a.fault.data=true;a.run(`deleteRecord('tasks',${JSON.stringify(id)})`);assert.equal(a.run('data.tasks.length'),1);
  a.fault.data=false;a.run(`deleteRecord('tasks',${JSON.stringify(id)})`);a.task('After deletion');a.run('undoDelete()');assert.equal(a.run('data.tasks.length'),2);
});

test('saved focus session is not resurrected when timer reset cannot persist',()=>{
  const a=workspace();a.route('#focus');a.$('#timer-start').click();const session=a.run('timer.session');
  a.clock.now+=300000;a.$('#timer-save').click();a.fault.timer=true;a.submit({title:'Focused study'});
  assert.equal(a.run('data.logs[0].minutes'),5);assert.equal(a.run('data.logs[0].focusSession'),session);
  const reloaded=workspace(a.memory);assert.equal(reloaded.run('timer.remaining'),1500);assert.notEqual(reloaded.run('timer.session'),session);
});

test('timer completion handles suspended tabs and cancels preserve elapsed time',()=>{
  const a=workspace();a.route('#focus');a.$('#timer-start').click();a.clock.now+=120000;a.$('#timer-save').click();a.$('#cancel').click();assert.equal(a.run('timer.remaining'),1380);
  a.$('#timer-start').click();a.clock.now+=1800000;a.ticks[0]();assert.equal(a.run('timer.remaining'),0);assert.equal(a.$('#timer-start').disabled,true);
});

test('calendar date arithmetic ignores DST clock changes and returns whole days',()=>{
  const a=workspace();assert.equal(a.run('daysUntil(today())'),0);
  assert.equal(a.run("daysUntil(localDate(new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()+1)))"),1);
});
