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
