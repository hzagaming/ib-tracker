const vm=require('node:vm');const fs=require('node:fs');const assert=require('node:assert/strict');
const elements={};function el(id){return elements[id]??={value:'',textContent:'',style:{},dataset:{},showModal(){this.open=true},close(){this.open=false},set innerHTML(v){this.html=v;for(const m of v.matchAll(/id="([^"]+)"/g))el(m[1])},get innerHTML(){return this.html||''}}}
for(const id of ['app','nav','breadcrumb','backup','close','cancel','modal','modal-title','fields','form','toast'])el(id);
const storage=new Map();const context=vm.createContext({console,Date,Math,JSON,String,Number,Array,Object,Error,Blob,URL,crypto:require('node:crypto').webcrypto,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},document:{querySelector:s=>elements[s.slice(1)]||null,querySelectorAll:()=>[],createElement:()=>({click(){}})},location:{hash:''},window:{addEventListener(){}},setInterval(){},setTimeout(){},clearTimeout(){},confirm:()=>true,FormData:class{constructor(form){return Object.entries(form.values)[Symbol.iterator]()}},});
vm.runInContext(fs.readFileSync('dist/app.js','utf8'),context);const run=s=>vm.runInContext(s,context);
for(const route of ['dashboard','subjects','tasks','logs','grades','core','focus','settings']){run(`location.hash='#${route}';render()`);assert.ok(el('app').innerHTML.length>100,route)}
function submit(kind,values,id){run(`add('${kind}'${id?`, '${id}'`:''})`);elements.form.values=values;elements.form.onsubmit({preventDefault(){},target:elements.form})}
submit('subjects',{name:'Physics',group:'3',level:'HL',target:'7',progress:'20',notes:'Mechanics'});assert.equal(run('data.subjects[0].target'),7);
const subject=run('data.subjects[0].id');submit('tasks',{title:'Review forces',subject,date:'2026-11-07',priority:'重要',type:'复习',notes:''});assert.equal(run('data.tasks[0].done'),false);
submit('logs',{title:'Mechanics',subject,date:'2026-11-06',minutes:'45',notes:'Forces & momentum'});assert.equal(run('data.logs[0].minutes'),45);
submit('grades',{title:'Quiz',subject,date:'2026-11-06',score:'6',raw:'85/100',notes:'Review units'});assert.equal(run('data.grades[0].score'),6);
submit('core',{title:'Research question',subject,type:'EE',date:'2026-12-01',stage:'进行中',notes:'Draft'});assert.equal(run('data.core[0].type'),'EE');
const id=run('data.tasks[0].id');submit('tasks',{title:'Updated',subject,date:'2026-11-08',priority:'普通',type:'复习',notes:'edit'},id);assert.equal(run('data.tasks.length'),1);assert.equal(run('data.tasks[0].title'),'Updated');
run('validate(JSON.parse(JSON.stringify(data)))');assert.throws(()=>run('validate({version:2})'));
assert.throws(()=>run('validate({...data,grades:[{id:"x",title:"Bad",date:"2026-11-06",score:9}]})'));
assert.throws(()=>run('validate({...data,subjects:[{...data.subjects[0],target:"<script>"}]})'));
assert.throws(()=>run('validate({...data,tasks:[{...data.tasks[0],id:"bad id"}]})'));
assert.ok(storage.get('ib-atlas-v1').includes('Updated'));assert.equal(run('esc("<script>")'),'&lt;script&gt;');
run('data=JSON.parse(localStorage.getItem("ib-atlas-v1"));location.hash="#dashboard";render()');assert.ok(el('app').innerHTML.includes('0.8'));assert.ok(el('app').innerHTML.includes('Physics'));
console.log('PASS: 8 page renders; subject/task/log/grade/core creation; task edit; numeric validation; backup schema; persistence restore; HTML escaping.');
// Subject workspaces calculate mastery from topics and preserve v1 backups.
run(`location.hash='#subject/'+data.subjects[0].id;render();topicEditor(data.subjects[0].id)`);
elements.form.values={title:'Forces',status:'mastered',review:'2026-11-10',notes:'Newton laws'};
elements.form.onsubmit({preventDefault(){},target:elements.form});
assert.equal(run('data.topics.length'),1);assert.equal(run('subjectProgress(data.subjects[0])'),100);
assert.ok(elements.app.innerHTML.includes('Forces'));assert.ok(elements.app.innerHTML.includes('知识点与复习清单'));
run(`data.topics[0].status='review';render()`);assert.equal(run('subjectProgress(data.subjects[0])'),0);
run(`location.hash='#calendar';calendarMonth=new Date(2026,10,1);render()`);assert.ok(elements.app.innerHTML.includes('Updated'));run('calendarMonth=new Date(2026,11,1);render()');assert.ok(elements.app.innerHTML.includes('Research question'));
run(`location.hash='#tasks';render();subjectFilter='missing';renderList()`);assert.ok(!elements.list.innerHTML.includes('Updated'));
run(`subjectFilter='';priorityFilter='紧急';renderList()`);assert.ok(!elements.list.innerHTML.includes('Updated'));
run(`priorityFilter='';renderList()`);assert.ok(elements.list.innerHTML.includes('Updated'));
run('validate(JSON.parse(JSON.stringify(data)))');
run('validate({...data,topics:undefined})');
assert.throws(()=>run('validate({...data,topics:[{...data.topics[0],status:"invalid"}]})'));
assert.throws(()=>run('validate({...data,topics:[{...data.topics[0],subject:"missing"}]})'));
assert.throws(()=>run('validate({...data,tasks:[data.tasks[0],data.tasks[0]]})'));
run("add('subjects');document.querySelector('#f-name').value='Physics';document.querySelector('#f-name').onchange()");
assert.equal(elements['f-group'].value,3);
console.log('PASS: subject detail, topic creation and mastery, month calendar deadlines, subject/priority filters, legacy backup compatibility, invalid topic and duplicate ID rejection, catalog group selection.');
// UI actions must preserve user data, including work done after a deletion.
run(`location.hash='#dashboard';render()`);assert.ok(elements.app.innerHTML.includes('到期复习'));assert.ok(!elements.app.innerHTML.includes('三小步'));run('var savedForOnboarding=data;data=initial();render()');assert.ok(elements.app.innerHTML.includes('三小步'));run('data=savedForOnboarding');
const taskId=run('data.tasks[0].id');run(`deleteRecord('tasks','${taskId}')`);assert.equal(run('data.tasks.length'),0);
run(`data.logs.push({id:'after-delete',title:'New work',subject:'',date:'2026-11-07',minutes:15,notes:''});undoDelete()`);
assert.equal(run('data.tasks.length'),1);assert.ok(run('data.logs.some(l=>l.id==="after-delete")'));
run(`deleteRecord('subjects','${subject}')`);assert.equal(run('data.topics.length'),0);assert.equal(run('data.tasks[0].subject'),'');run('undoDelete()');assert.equal(run('data.topics.length'),1);assert.equal(run('data.tasks[0].subject'),subject);
run(`data.tasks[0].date=today();data.tasks[0].done=false`);assert.equal(run('filterTasks(data.tasks,"today").length'),1);assert.equal(run('filterTasks(data.tasks,"overdue").length'),0);assert.equal(run('filterTasks(data.tasks,"week").length'),1);
run(`data.tasks[0].done=true`);assert.equal(run('filterTasks(data.tasks,"today").length'),0);assert.equal(run('filterTasks(data.tasks,"done").length'),1);
run(`timer={remaining:1200,running:false,end:0};persistTimer();location.hash='#focus';render()`);assert.equal(run('restoreTimer().remaining'),1200);
elements['timer-save'].onclick();assert.equal(run('focusDraft'),true);assert.equal(elements['f-minutes'].value,5);elements.cancel.onclick();assert.equal(run('timer.remaining'),1200);assert.equal(run('focusDraft'),false);
elements['timer-save'].onclick();elements.form.values={title:'Focused study',subject:'',date:'2026-11-07',minutes:'5',notes:''};elements.form.onsubmit({preventDefault(){},target:elements.form});assert.equal(run('timer.remaining'),1500);assert.equal(run('data.logs.at(-1).minutes'),5);
run(`add('tasks')`);const count=run('data.tasks.length');elements.form.values={title:'   ',subject:'',date:'2026-11-07',priority:'普通',type:'复习',notes:''};elements.form.onsubmit({preventDefault(){},target:elements.form});assert.equal(run('data.tasks.length'),count);
console.log('PASS: actionable dashboard, scoped deletion undo, subject relationships restored, time chips, persistent focus timer, cancel-safe focus logging, whitespace validation.');
