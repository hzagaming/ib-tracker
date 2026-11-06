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
  const a=workspace();a.route('#settings');a.fault.data=true;a.$('#profile-name').value='New name';
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

test('new study pages render and weekly navigation crosses months correctly',()=>{
  const a=workspace();
  for(const route of ['planner','review','library']){a.route('#'+route);assert.ok(a.$('#app h1'),route)}
  a.clock.now=new Date(2026,10,1,12).getTime();
  assert.equal(a.run('weekDates(0)[0]'),'2026-10-26');assert.equal(a.run('weekDates(0)[6]'),'2026-11-01');
  a.route('#planner');a.$('#week-next').click();assert.equal(a.run('weekDates()[0]'),'2026-11-02');
  a.$('#week-now').click();assert.equal(a.run('plannerOffset'),0);
});

test('a weekly plan creates one actual learning log and retains its planned duration',()=>{
  const a=workspace();a.route('#planner');a.$('[data-study-add="plan"]').click();a.submit({title:'Practise mechanics',minutes:45,time:'14:30'});
  assert.equal(a.run('data.plans[0].minutes'),45);assert.ok(a.$('.plan-title').textContent.includes('Practise mechanics'));
  a.$('[data-plan-complete]').click();a.submit({minutes:32,notes:'Momentum needs another look'});
  assert.equal(a.run('data.plans[0].done'),true);assert.equal(a.run('data.logs[0].minutes'),32);assert.equal(a.run('data.plans[0].minutes'),45);
  a.run('completePlan(data.plans[0].id)');assert.equal(a.run('data.logs.length'),1);
  a.run('validate(data)');
});

test('plan completion rolls back both the plan and log on failure and retries cleanly',()=>{
  const a=workspace();a.run("studyEditor('plan')");a.submit({title:'Study'});a.run('completePlan(data.plans[0].id)');
  a.fault.data=true;a.submit({minutes:20});assert.equal(a.run('data.plans[0].done'),false);assert.equal(a.run('data.logs.length'),0);
  a.fault.data=false;a.submit({minutes:20});assert.equal(a.run('data.plans[0].done'),true);assert.equal(a.run('data.logs.length'),1);
  a.run("deleteRecord('plans',data.plans[0].id)");assert.equal(a.run('data.logs.length'),1);a.run('undoDelete()');assert.equal(a.run('data.plans.length'),1);
});

test('review ratings reschedule learned topics and can be undone without deleting unrelated logs',()=>{
  const a=workspace(),subject=a.subject();a.run(`topicEditor(${JSON.stringify(subject)})`);a.submit({title:'Forces',review:a.run('today()')});
  a.route('#review');assert.ok(a.$('[data-review-rate]'));
  a.$('[data-review-rate$=":good"]').click();assert.equal(a.run('data.reviewHistory.length'),1);assert.equal(a.run('data.topics[0].status'),'mastered');assert.equal(a.run('data.topics[0].review'),a.run('dateAfter(7)'));
  a.$('[data-review-scope="upcoming"]').click();assert.ok(a.$('.review-card'));
  a.clock.now+=7*86400000;a.run("reviewScope='due';render()");assert.ok(a.$('[data-review-rate]'));
  a.run('validate(data)');
  a.$('[data-review-rate$=":again"]').click();assert.equal(a.run('data.reviewHistory.length'),2);a.$('#toast-action').click();assert.equal(a.run('data.reviewHistory.length'),1);
  assert.equal(a.run('data.topics[0].status'),'mastered');
});

test('failed review writes do not change the topic or add history',()=>{
  const a=workspace(),id=a.subject();a.run(`topicEditor(${JSON.stringify(id)})`);a.submit({title:'Forces',review:a.run('today()')});a.route('#review');
  a.fault.data=true;a.$('[data-review-rate$=":okay"]').click();assert.equal(a.run('data.reviewHistory.length'),0);assert.equal(a.run('data.topics[0].status'),'new');
  a.fault.data=false;a.$('[data-review-rate$=":okay"]').click();assert.equal(a.run('data.reviewHistory.length'),1);
});

test('library supports safe URLs, editable guides, filtering, stars and undo',()=>{
  const a=workspace();a.route('#library');a.$('[data-guide-save="mistakes"]').click();assert.equal(a.run('data.resources.length'),1);
  a.$('[data-guide-save="mistakes"]').click();assert.equal(a.run('data.resources.length'),1);a.$('#cancel').click();
  a.$('[data-resource-star]').click();assert.equal(a.run('data.resources[0].favorite'),true);
  a.$('[data-study-add="resource"]').click();a.submit({title:'My resource',url:'https://example.com/notes',kind:'文章'});assert.equal(a.run('data.resources.length'),2);
  a.$('#library-query').value='My resource';a.$('#library-query').oninput({target:a.$('#library-query')});assert.equal(a.$('#library-results').querySelectorAll('.resource-card').length,1);
  assert.equal(a.$('#library-results a[target="_blank"]').getAttribute('rel'),'noopener noreferrer');
  a.$('#library-results [data-delete]').click();assert.equal(a.run('data.resources.length'),1);a.$('#toast-action').click();assert.equal(a.run('data.resources.length'),2);
  a.run("studyEditor('resource')");a.submit({title:'Unsafe',url:'javascript:alert(1)'});assert.equal(a.run('data.resources.length'),2);assert.equal(a.$('#modal').open,true);
});

test('old backups migrate all new collections and new study data round-trips',()=>{
  const a=workspace();const old=a.run('initial()');delete old.plans;delete old.resources;delete old.reviewHistory;delete old.profile.weeklyGoal;
  const migrated=a.run('decodeData')(JSON.stringify(old));assert.equal(migrated.plans.length,0);assert.equal(migrated.resources.length,0);assert.equal(migrated.reviewHistory.length,0);
  a.run("studyEditor('plan')");a.submit({title:'A plan'});a.run("saveGuide('weekly')");const b=workspace(a.memory);assert.equal(b.run('data.plans.length'),1);assert.equal(b.run('data.resources.length'),1);assert.equal(b.run('recoveryRaw'),null);
});

test('removing a subject preserves and restores plans, resources and review history relationships',()=>{
  const a=workspace(),id=a.subject();a.run(`studyEditor('plan',null,{subject:${JSON.stringify(id)}})`);a.submit({title:'Study'});
  a.run(`studyEditor('resource',null,{subject:${JSON.stringify(id)}})`);a.submit({title:'Notes',notes:'Important'});
  a.run(`topicEditor(${JSON.stringify(id)})`);a.submit({title:'Concept',review:a.run('today()')});a.run("rateReview(data.topics[0].id,'okay')");
  a.run(`deleteRecord('subjects',${JSON.stringify(id)})`);assert.equal(a.run('data.plans[0].subject'),'');assert.equal(a.run('data.resources[0].subject'),'');assert.equal(a.run('data.reviewHistory[0].subject'),'');
  a.run('undoDelete()');assert.equal(a.run('data.plans[0].subject'),id);assert.equal(a.run('data.resources[0].subject'),id);assert.equal(a.run('data.reviewHistory[0].subject'),id);a.run('validate(data)');
});

test('mistake notebook records correction, retries and mastery',()=>{
  const a=workspace();a.route('#mistakes');a.$('#add-mistake').click();a.submit({title:'Momentum question',question:'Two objects collide',original:'Used energy only',correction:'Check total momentum',cause:'概念理解',source:'Practice paper'});
  assert.equal(a.run('data.mistakes.length'),1);assert.ok(a.$('.mistake-question').textContent.includes('collide'));
  a.$('[data-mistake-retry]').click();a.submit({result:'again',notes:'Need to track signs'});assert.equal(a.run('data.mistakes[0].status'),'待重做');assert.equal(a.run('data.mistakes[0].review'),a.run('dateAfter(3)'));
  a.$('[data-mistake-retry]').click();a.submit({result:'solved'});assert.equal(a.run('data.mistakes[0].status'),'已掌握');assert.equal(a.run('data.mistakes[0].attempts.length'),2);assert.equal(a.run('data.mistakes[0].review'),'');
  const b=workspace(a.memory);assert.equal(b.run('data.mistakes[0].attempts.length'),2);a.run('validate(data)');
});

test('retry save failures roll back status and attempts, then allow retry',()=>{
  const a=workspace();a.run('mistakeEditor()');a.submit({title:'Question'});a.run('recordRetry(data.mistakes[0].id)');a.fault.data=true;
  a.submit({result:'solved'});assert.equal(a.run('data.mistakes[0].attempts.length'),0);assert.equal(a.run('data.mistakes[0].status'),'待订正');
  a.fault.data=false;a.submit({result:'solved'});assert.equal(a.run('data.mistakes[0].attempts.length'),1);
});

test('one unresolved revision task is linked to a mistake without duplicates',()=>{
  const a=workspace();a.run('mistakeEditor()');a.submit({title:'A question'});a.run('mistakeTask(data.mistakes[0].id)');a.submit({});assert.equal(a.run('data.tasks.length'),1);
  assert.equal(a.run('data.tasks[0].mistakeId'),a.run('data.mistakes[0].id'));
  a.run('mistakeTask(data.mistakes[0].id)');a.submit({title:'Updated revision task'});assert.equal(a.run('data.tasks.length'),1);assert.equal(a.run('data.tasks[0].title'),'Updated revision task');
});

test('mistake links survive subject removal and undo',()=>{
  const a=workspace(),subject=a.subject();a.run(`mistakeEditor(null,${JSON.stringify(subject)})`);a.submit({title:'Question'});
  a.run(`deleteRecord('subjects',${JSON.stringify(subject)})`);assert.equal(a.run('data.mistakes[0].subject'),'');a.run('undoDelete()');assert.equal(a.run('data.mistakes[0].subject'),subject);
});

test('analytics excludes future logs and measures actual active days and longest run',()=>{
  const a=workspace();for(const [offset,minutes] of [[-1,60],[0,30],[1,500]]){a.run("add('logs')");a.submit({title:'Study',date:a.run(`dateAfter(${offset})`),minutes})}
  assert.equal(a.run('analysisSnapshot(7).minutes'),90);assert.equal(a.run('analysisSnapshot(7).active'),2);assert.equal(a.run('analysisSnapshot(7).longest'),2);
  a.route('#analytics');assert.equal(a.$('.activity-grid').children.length,30);a.$('[data-analysis-days="7"]').click();assert.equal(a.$('.activity-grid').children.length,7);
});

test('latest same-day grade is shown first in list, subject and analytics',()=>{
  const a=workspace(),subject=a.subject();a.run("add('grades')");a.submit({title:'First quiz',score:4,subject});a.run("add('grades')");a.submit({title:'Second quiz',score:7,subject});
  a.route('#grades');assert.ok(a.$('.stats').querySelectorAll('strong')[2].textContent.trim().startsWith('7'));assert.equal(a.$('#list .row-title').textContent,'Second quiz');
  a.route('#subject/'+subject);assert.ok(a.$('.stats').querySelectorAll('strong')[3].textContent.trim().startsWith('7'));
  a.route('#analytics');assert.ok(a.$('#app').textContent.includes('Second quiz'));assert.ok(!a.$('#app').textContent.includes('First quiz'));
});

test('global search finds correction text, filters record types and opens the matching editor',()=>{
  const a=workspace();a.task('Momentum task');a.run('mistakeEditor()');a.submit({title:'Collision',correction:'Conservation of momentum'});
  assert.equal(a.run("findRecords('conservation momentum','mistakes').length"),1);assert.equal(a.run("findRecords('momentum','tasks').length"),1);
  a.route('#search');a.$('#global-query').value='conservation momentum';a.$('#global-query').oninput({target:a.$('#global-query')});assert.equal(a.$('#global-results').querySelectorAll('[data-result-kind]').length,1);
  a.$('[data-result-kind]').click();assert.equal(a.$('#f-title').value,'Collision');
});

test('global search paginates results and escapes user content',()=>{
  const a=workspace();a.run(`mutate(()=>{for(let i=0;i<70;i++)data.tasks.push({id:'search-'+i,title:'Search item '+i,subject:'',date:today(),notes:'<script>bad()</script>',type:'复习',priority:'普通',done:false})})`);
  a.route('#search');a.$('#global-query').value='Search item';a.$('#global-query').oninput({target:a.$('#global-query')});assert.equal(a.$('#global-results').querySelectorAll('[data-result-kind]').length,60);assert.equal(a.$('#global-results').querySelectorAll('script').length,0);
  a.$('#load-more-results').click();assert.equal(a.$('#global-results').querySelectorAll('[data-result-kind]').length,70);
});

test('unsaved settings survive another tab updating and canceled navigation',()=>{
  const memory=new Map(),a=workspace(memory),b=workspace(memory);a.route('#settings');a.$('#profile-name').value='Unsaved name';a.$('#profile-form').oninput();b.task();a.events.storage({key:KEY});
  assert.equal(a.$('#profile-name').value,'Unsaved name');assert.equal(a.run('profileDirty'),true);assert.ok(a.$('#reload-records'));
  a.run("confirm=()=>false;location.hash='#tasks'");a.events.hashchange();a.events.hashchange();assert.equal(a.$('#profile-name').value,'Unsaved name');assert.equal(a.run('profileDirty'),true);
  a.run('confirm=()=>true');a.$('#reload-records').click();assert.equal(a.run('profileDirty'),false);assert.equal(a.run('data.tasks.length'),1);
});

test('schema rejects coercible non-string groups, time arrays and whitespace-only resources',()=>{
  const a=workspace();a.subject();a.run("studyEditor('plan')");a.submit({title:'Study'});const raw=a.memory.get(KEY);
  for(const group of [[3],null,'03']){const d=JSON.parse(raw);d.subjects[0].group=group;assert.throws(()=>a.run('validate')(d))}
  const d=JSON.parse(raw);d.plans[0].time=['14:30'];assert.throws(()=>a.run('validate')(d));
  a.run("studyEditor('resource')");a.submit({title:'Empty note',notes:'   '});assert.equal(a.run('data.resources.length'),0);
  const old=JSON.parse(raw);delete old.mistakes;assert.equal(a.run('decodeData')(JSON.stringify(old)).mistakes.length,0);
});

test('exam planning creates three dated tasks once and exposes exam in calendar',()=>{
  const a=workspace(),subject=a.subject();a.route('#exams');a.$('#add-exam').click();a.submit({title:'Physics mock',subject,date:a.run('dateAfter(10)'),time:'09:30',scope:'Mechanics'});
  assert.equal(a.run('data.exams.length'),1);assert.ok(a.$('.exam-card').textContent.includes('Physics mock'));
  a.$('[data-exam-tasks]').click();a.submit({});assert.equal(a.run('data.tasks.length'),3);assert.equal(a.run('data.tasks[0].date'),a.run('today()'));
  a.run('createExamTasks(data.exams[0].id)');a.submit({});assert.equal(a.run('data.tasks.length'),3);
  a.route('#calendar');a.run("calendarMonth=new Date(data.exams[0].date+'T12:00:00');render()");assert.ok(a.$('[data-edit^="exams:"]'));
  a.$('[data-edit^="exams:"]').click();assert.equal(a.$('#f-title').value,'Physics mock');
});

test('past and completed exams do not generate new revision tasks',()=>{
  const a=workspace();a.run('examEditor()');a.submit({title:'Past exam',date:a.run('dateAfter(-1)')});a.run('createExamTasks(data.exams[0].id)');assert.equal(a.run('data.tasks.length'),0);assert.equal(a.$('#modal').open,false);
  a.run('examEditor(data.exams[0].id)');a.submit({date:a.run('dateAfter(5)'),status:'已完成'});a.run('createExamTasks(data.exams[0].id)');assert.equal(a.run('data.tasks.length'),0);
});

test('exam grade and completion are atomic, retries work and updates reuse the grade',()=>{
  const a=workspace();a.run('examEditor()');a.submit({title:'Quiz'});a.run('examGrade(data.exams[0].id)');a.fault.data=true;a.submit({score:6});
  assert.equal(a.run('data.grades.length'),0);assert.equal(a.run('data.exams[0].status'),'计划中');a.fault.data=false;a.submit({score:6});
  assert.equal(a.run('data.grades.length'),1);assert.equal(a.run('data.exams[0].status'),'已完成');a.run('examGrade(data.exams[0].id)');a.submit({score:7});assert.equal(a.run('data.grades.length'),1);assert.equal(a.run('data.grades[0].score'),7);
});

test('weekly reflection is editable, requires meaningful content and creates one pending action',()=>{
  const a=workspace();a.route('#reflections');a.$('#write-reflection').click();a.submit({});assert.equal(a.run('data.reflections.length'),0);assert.equal(a.$('#modal').open,true);
  a.submit({wins:'I can explain momentum',next:'Redo the collision exercise'});assert.equal(a.run('data.reflections.length'),1);
  a.run('reflectionEditor()');a.submit({challenge:'Signs in calculations'});assert.equal(a.run('data.reflections.length'),1);
  a.run('reflectionTask(data.reflections[0].id)');a.submit({});assert.equal(a.run('data.tasks.length'),1);a.run('reflectionTask(data.reflections[0].id)');a.submit({title:'Updated action'});assert.equal(a.run('data.tasks.length'),1);
});

test('weekly summary excludes future logs and reflection dates remain unique Mondays',()=>{
  const a=workspace();a.clock.now=new Date(2026,10,4,12).getTime();
  a.run("add('logs')");a.submit({title:'Today',minutes:30,date:'2026-11-04'});a.run("add('logs')");a.submit({title:'Future',minutes:50,date:'2026-11-06'});
  assert.equal(a.run("reflectionSummary('2026-11-02').minutes"),30);
  a.run('reflectionEditor()');a.submit({wins:'Progress'});const d=JSON.parse(a.memory.get(KEY));d.reflections.push({...d.reflections[0],id:'duplicate-week'});assert.throws(()=>a.run('validate')(d));
  d.reflections.pop();d.reflections[0].weekStart='2026-11-03';assert.throws(()=>a.run('validate')(d));
});

test('a successful modal submit cannot create duplicate records on repeated events',()=>{
  const a=workspace();a.run("add('tasks')");a.$('#f-title').value='One task';const handler=a.$('#form').onsubmit,event={preventDefault(){},target:a.$('#form')};handler(event);handler(event);assert.equal(a.run('data.tasks.length'),1);
});

test('settings draft survives quick-add saves and its field IDs do not collide with dialogs',()=>{
  const a=workspace();a.route('#settings');a.$('#profile-name').value='My unsaved name';a.$('#profile-form').oninput();a.$('#quick-add').click();a.$('[data-quick="tasks"]').click();a.submit({title:'Quick task'});
  assert.equal(a.$('#profile-name').value,'My unsaved name');assert.equal(a.run('data.profile.name'),'我的');assert.equal(a.run('profileDirty'),true);
  a.run("add('subjects')");const ids=[...a.document.querySelectorAll('[id]')].map(el=>el.id);assert.equal(new Set(ids).size,ids.length);
  a.$('#f-name').value='Physics';a.$('#f-name').onchange();a.submit({});assert.equal(a.run('data.subjects[0].group'),'3');assert.equal(a.$('#profile-name').value,'My unsaved name');
});

test('old backups migrate exams and reflections and new search finds both types',()=>{
  const a=workspace();const old=a.run('initial()');delete old.exams;delete old.reflections;const next=a.run('decodeData')(JSON.stringify(old));assert.equal(next.exams.length,0);assert.equal(next.reflections.length,0);
  a.run('examEditor()');a.submit({title:'Mechanics mock'});a.run('reflectionEditor()');a.submit({wins:'Mechanics clicked'});
  assert.equal(a.run("findRecords('mechanics','exams').length"),1);assert.equal(a.run("findRecords('mechanics','reflections').length"),1);const b=workspace(a.memory);assert.equal(b.run('data.exams.length'),1);assert.equal(b.run('data.reflections.length'),1);
});

test('deleting exams or subjects preserves associated tasks and grades',()=>{
  const a=workspace(),subject=a.subject();a.run(`examEditor(null,${JSON.stringify(subject)})`);a.submit({title:'Exam'});a.run('createExamTasks(data.exams[0].id)');a.submit({});a.run('examGrade(data.exams[0].id)');a.submit({score:6});
  a.run(`deleteRecord('subjects',${JSON.stringify(subject)})`);assert.equal(a.run('data.exams[0].subject'),'');a.run('undoDelete()');assert.equal(a.run('data.exams[0].subject'),subject);
  a.run("deleteRecord('exams',data.exams[0].id)");assert.equal(a.run('data.tasks.length'),3);assert.equal(a.run('data.grades.length'),1);a.run('undoDelete()');assert.equal(a.run('data.exams.length'),1);
});

test('backup import accepts files above the former 5MB limit and rejects oversized input',async()=>{
  const a=workspace(),file=a.file(JSON.stringify(a.run('initial()')));file.files[0].size=6*1024*1024;await a.run('importData')({target:file});assert.equal(a.run('data.subjects.length'),0);assert.ok(a.memory.has(KEY));
  const before=a.memory.get(KEY);file.files[0].size=21*1024*1024;await a.run('importData')({target:file});assert.equal(a.memory.get(KEY),before);assert.ok(a.$('#toast').textContent.includes('20MB'));
});
