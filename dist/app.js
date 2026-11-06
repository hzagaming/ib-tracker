'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>localDate(new Date());
const initial=()=>({version:1,profile:{name:'我的',exam:'2028-05-01'},subjects:[],tasks:[],logs:[],grades:[],core:[],topics:[]});
const STORAGE_KEY='ib-atlas-v1';
let data,storedRaw=null,recoveryRaw=null,storageConflict=false,storageUnavailable=false;
try {
  storedRaw=localStorage.getItem(STORAGE_KEY)??null;
  data=storedRaw===null?initial():decodeData(storedRaw);
} catch {
  recoveryRaw=storedRaw;
  storageUnavailable=storedRaw===null;
  data=initial();
}
let page='dashboard',filter='',status='all',subjectFilter='',priorityFilter='',selectedSubject='';
let undoSnapshot=null,focusDraft=false;
let calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
const nav=[['dashboard','◫','学习总览'],['subjects','▦','我的学科'],['tasks','☑','任务与计划'],['calendar','▦','截止日期月历'],['logs','▤','学习日志'],['grades','↗','成绩追踪'],['core','◇','核心项目'],['focus','◷','专注时光'],['settings','⚙','个人设置']];
const groups=[['语言与文学','Chinese A: Literature','Chinese A: Language and Literature','English A: Literature','English A: Language and Literature','Language A: Literature（自选语言）','Language A: Language and Literature（自选语言）','Literature and Performance'],['语言习得','English B','Chinese B','French B','Spanish B','French ab initio','Spanish ab initio','Language B（自选语言）','Language ab initio（自选语言）','Latin','Classical Greek'],['个体与社会','Economics','Business Management','History','Geography','Psychology','Global Politics','Digital Society','Philosophy','Social and Cultural Anthropology','World Religions'],['科学','Biology','Chemistry','Physics','Computer Science','Design Technology','Sports, Exercise and Health Science','Environmental Systems and Societies'],['数学','Mathematics: Analysis and Approaches','Mathematics: Applications and Interpretation'],['艺术','Visual Arts','Music','Theatre','Film','Dance']];
function save({recover=false}={}) {
  if(recoveryRaw!==null&&!recover){toast('原有数据无法读取，请先导出恢复文件或导入有效备份。');return false}
  try {
    if((localStorage.getItem(STORAGE_KEY)??null)!==storedRaw){storageConflict=true;renderNotices();toast('其他标签页已更新数据。请关闭表单，载入最新记录后重试。');return false}
    validate(data);
    const raw=JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY,raw);
    storedRaw=raw;storageConflict=false;storageUnavailable=false;
    if(recover)recoveryRaw=null;
    renderNotices();return true;
  } catch(err) {
    toast('未能保存：'+(err.name==='QuotaExceededError'?'浏览器空间不足，请导出备份。':err.message||'浏览器存储不可用。'));
    return false;
  }
}
function mutate(change) {
  const before=JSON.stringify(data);
  try {change();if(save())return true} catch(err){toast(err.message)}
  data=JSON.parse(before);return false;
}
const toast=(message, action)=>{
  if($('#modal').open&&$('#form-error')){$('#form-error').textContent=message;$('#form-error').hidden=false}
  const box=$('#toast');box.innerHTML=`<span>${esc(message)}</span>${action?'<button id="toast-action">撤销</button>':''}`;box.style.display='flex';
  if(action)$('#toast-action').onclick=action;
  clearTimeout(window.toastTimeout);window.toastTimeout=setTimeout(()=>box.style.display='none',action?10000:3500);
};
const subjectName=id=>data.subjects.find(s=>s.id===id)?.name||'综合 / 核心';
const options=()=>'<option value="">综合 / 核心</option>'+data.subjects.map(s=>`<option value="${s.id}">${esc(s.name)} · ${s.level}</option>`).join('');
const field=(label,name,type='text',value='',extra='')=>`<label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}>`;
const select=(label,name,opts)=>`<label for="f-${name}">${label}</label><select id="f-${name}" name="${name}">${opts}</select>`;
const area=(label,name,value='')=>`<label for="f-${name}">${label}</label><textarea id="f-${name}" name="${name}">${esc(value)}</textarea>`;
function modal(title,html,handler){
  $('#modal-title').textContent=title;$('#fields').innerHTML=html;$('#modal .actions')?.classList.remove('is-hidden');
  if($('#form-error'))$('#form-error').hidden=true;
  $('#form').onsubmit=e=>{
    e.preventDefault();const before=JSON.stringify(data);
    try{
      const values=Object.fromEntries(new FormData(e.target));
      for(const k of ['title','name'])if(k in values){values[k]=values[k].trim();if(!values[k])throw Error('请填写名称，不能只输入空格。')}
      handler(values);
      if(!save()){data=JSON.parse(before);return}
      if(focusDraft&&$('#f-minutes')){resetTimer();focusDraft=false}
      $('#modal').close();render();toast('已保存，继续积累。');
    }catch(err){data=JSON.parse(before);if($('#form-error')){$('#form-error').textContent=err.message;$('#form-error').hidden=false}else toast(err.message)}
  };
  $('#modal').showModal();
}
$('#close').onclick=$('#cancel').onclick=()=>{focusDraft=false;$('#modal').close()};
function add(kind,id){focusDraft=false;let old=id?data[kind]?.find(x=>x.id===id):null;const insert=obj=>{obj.id=id||crypto.randomUUID();if(id){const current=data[kind].find(x=>x.id===id);if(!current)throw Error('此记录已被移除，请关闭后重新选择。');Object.assign(current,obj)}else data[kind].push(obj)};
if(kind==='subjects'){modal(old?'编辑学科':'添加我的学科',select('学科组','group',groups.map((g,i)=>`<option value="${i}">${i+1} · ${g[0]}</option>`).join(''))+field('科目名称（可选择或自行填写）','name','text',old?.name||'','required list="catalog" maxlength="100"')+'<datalist id="catalog">'+groups.flatMap(g=>g.slice(1)).map(n=>`<option value="${esc(n)}">`).join('')+'</datalist>'+select('课程级别','level','<option>HL</option><option>SL</option>')+field('目标分数','target','number',old?.target||7,'required min="1" max="7"')+field('学习进度 %','progress','number',old?.progress||0,'required min="0" max="100"')+area('知识点、复习重点与个人笔记','notes',old?.notes||''),v=>{if(!old&&data.subjects.length>=8)throw Error('最多支持 8 门科目');insert({...v,target:+v.target,progress:+v.progress})});if(old){$('#f-group').value=old.group;$('#f-level').value=old.level}$('#f-name').onchange=()=>{const i=groups.findIndex(g=>g.slice(1).includes($('#f-name').value));if(i>=0)$('#f-group').value=i};return}
if(kind==='tasks')modal(old?'编辑任务':'添加学习任务',field('任务名称','title','text',old?.title||'','required maxlength="180"')+select('关联科目','subject',options())+'<div class="split"><div>'+field('截止日期','date','date',old?.date||today(),'required')+'</div><div>'+select('优先级','priority','<option>普通</option><option>重要</option><option>紧急</option>')+'</div></div>'+select('任务类别','type',['作业','复习','考试','IA','EE','TOK','CAS'].map(s=>`<option>${s}</option>`).join(''))+area('任务说明','notes',old?.notes||''),v=>insert({...v,done:old?.done||false}));
if(kind==='logs')modal(old?'编辑日志':'记录今天的学习',field('学习主题','title','text',old?.title||'','required maxlength="180"')+select('关联科目','subject',options())+'<div class="split"><div>'+field('日期','date','date',old?.date||today(),'required')+'</div><div>'+field('学习时长（分钟）','minutes','number',old?.minutes||30,'required min="1" max="1440"')+'</div></div>'+area('学到了什么？有哪些疑问？下一步是什么？','notes',old?.notes||''),v=>insert({...v,minutes:+v.minutes,...(focusDraft?{focusSession:timer.session}:{})}));
if(kind==='grades')modal(old?'编辑成绩':'记录一次成绩',field('测评名称','title','text',old?.title||'','required maxlength="180"')+select('科目','subject',options())+field('日期','date','date',old?.date||today(),'required')+'<div class="split"><div>'+field('IB 等级（1–7）','score','number',old?.score||'','required min="1" max="7"')+'</div><div>'+field('原始分数（可选，如 78/100）','raw','text',old?.raw||'')+'</div></div>'+area('老师反馈与改进方向','notes',old?.notes||''),v=>insert({...v,score:+v.score}));
if(kind==='core')modal(old?'编辑项目记录':'添加核心项目记录',select('核心项目','type',['IA','EE','TOK','CAS'].map(t=>`<option>${t}</option>`).join(''))+field('项目 / 阶段名称','title','text',old?.title||'','required maxlength="180"')+select('关联科目','subject',options())+field('计划完成日期','date','date',old?.date||today(),'required')+select('进度','stage',['未开始','进行中','待反馈','已完成'].map(t=>`<option>${t}</option>`).join(''))+area('研究问题、行动、反思或证据链接','notes',old?.notes||''),v=>insert(v));
if(old){for(const k of ['subject','priority','type','stage'])if($('#f-'+k))$('#f-'+k).value=old[k]||''}}
function head(title,subtitle,button='',kind=''){return `<div class="heading"><div><div class="eyebrow">YOUR DIPLOMA, YOUR JOURNEY</div><h1>${title}</h1><p class="sub">${subtitle}</p></div>${button?`<button class="primary" data-add="${kind}">＋ ${button}</button>`:''}</div>`}
function empty(title,desc){return `<div class="empty"><b>${title}</b>${desc}</div>`}
function taskRows(items){return items.length?items.map(t=>`<div class="row"><input class="check" type="checkbox" aria-label="完成 ${esc(t.title)}" data-check="${t.id}" ${t.done?'checked':''}><div class="row-body"><a href="#" data-edit="tasks:${t.id}" class="row-title ${t.done?'done':''}">${esc(t.title)}</a><small>${esc(subjectName(t.subject))} · ${esc(t.date)} ${!t.done&&t.date<today()?'· 已逾期':''}</small></div><span class="tag ${t.priority==='紧急'?'orange':''}">${esc(t.type)} · ${esc(t.priority)}</span><button class="delete" data-delete="tasks:${t.id}" aria-label="删除任务">×</button></div>`).join(''):empty('给下一步，留一个位置','添加作业、复习计划或即将到来的考试。')}
function subjectCards(){return data.subjects.map((s,i)=>`<article class="subject" tabindex="0" role="button" data-subject="${s.id}"><div class="subject-icon">${['Aa','文','◎','⚗','∑','✳'][s.group]||'◇'}</div><span class="tag ${s.level==='HL'?'blue':''}" style="float:right">${s.level}</span><h3>${esc(s.name)}</h3><p>GROUP ${+s.group+1} · ${groups[s.group]?.[0]||'自选课程'}</p><div class="progress"><i style="width:${subjectProgress(s)}%"></i></div><div class="subject-foot"><span>学习进度 ${subjectProgress(s)}%</span><span>目标 ${s.target} / 7</span></div></article>`).join('')}
function render(){const route=location.hash.slice(1).split('/');page=route[0]||'dashboard';selectedSubject=route[1]||'';if(page!=='subject'&&!nav.some(n=>n[0]===page))page='dashboard';$('#nav').innerHTML=nav.map(([id,icon,name])=>`<a href="#${id}" class="${(page===id||(page==='subject'&&id==='subjects'))?'active':''}" ${page===id?'aria-current="page"':''}><span>${icon}</span>${name}</a>`).join('');$('#breadcrumb').textContent='我的空间 / '+(page==='subject'?'学科详情':nav.find(n=>n[0]===page)[2]);let html='';const pending=data.tasks.filter(t=>!t.done).sort((a,b)=>a.date.localeCompare(b.date)),minutes=data.logs.reduce((n,l)=>n+l.minutes,0);
if(page==='dashboard')html=dashboardView();
if(page==='subject')html=subjectDetail();
if(page==='calendar')html=calendarView();
if(page==='subjects')html=head('我的学科','覆盖六大学科组。按你的实际选课添加课程，点击卡片进入科目工作台，管理知识点与复习。','添加学科','subjects')+`<div class="panel"><span class="tag">${data.subjects.filter(s=>s.level==='HL').length} HL</span> <span class="tag blue">${data.subjects.filter(s=>s.level==='SL').length} SL</span><p class="sub">通常选择六门课程。课程设置和考核要求请以学校及对应考试届次指南为准。</p></div><div class="subjects">${subjectCards()||empty('你的课程，由你定义','点击右上角添加第一门学科。')}</div>`+groups.map((g,i)=>`<div class="panel" style="margin-bottom:12px"><h3>0${i+1} · ${g[0]}</h3><p class="sub">${g.slice(1).map(esc).join(' · ')}</p></div>`).join('')+`<p class="sub">上方为常见课程示例，添加时支持自定义名称。课程结构参考 <a href="https://www.ibo.org/programmes/diploma-programme/curriculum/" target="_blank" rel="noopener">IB 官方课程目录 ↗</a>。</p>`;
if(page==='tasks')html=head('任务与计划','让作业、复习与重要截止日期，各有着落。','添加任务','tasks')+taskTabs()+filters(true)+`<div id="result-summary" class="result-summary"></div><div class="panel" id="list"></div>`;
if(page==='logs')html=head('学习日志','记录知识，也记录你如何理解它。','记录学习','logs')+filters()+`<div class="panel" id="list"></div>`;
if(page==='grades')html=head('成绩追踪','每一次测评，都是调整学习方向的线索。','记录成绩','grades')+`<div class="stats"><div class="stat"><span class="stat-label">测评记录</span><strong>${data.grades.length}</strong></div><div class="stat"><span class="stat-label">平均等级</span><strong>${data.grades.length?(data.grades.reduce((n,g)=>n+g.score,0)/data.grades.length).toFixed(1):'—'}</strong></div><div class="stat"><span class="stat-label">最新记录</span><strong>${data.grades.length?data.grades.slice().sort((a,b)=>b.date.localeCompare(a.date))[0].score:'—'} <small>/ 7</small></strong></div><div class="stat"><span class="stat-label">用途</span><p class="sub">用于个人复盘<br>非官方预估成绩</p></div></div>`+gradeSummary()+filters()+`<div class="panel" id="list"></div>`;
if(page==='core')html=head('核心项目','研究、思考、行动。把长期项目拆成看得见的进展。','添加记录','core')+`<div class="core-grid">${[['EE','Extended Essay','从研究问题到最终论文，记录每个研究阶段。'],['TOK','Theory of Knowledge','收集知识问题、展览构思与论文反思。'],['CAS','Creativity · Activity · Service','记录经历、行动、反思与学习成果。']].map(([t,n,d])=>{const list=data.core.filter(x=>x.type===t),done=list.filter(x=>x.stage==='已完成').length;return `<section class="panel core-card"><div class="number">${t}</div><h3>${n}</h3><p class="sub">${d}</p><div class="progress"><i style="width:${list.length?done/list.length*100:0}%"></i></div><p class="sub">${done} / ${list.length} 个阶段完成</p></section>`}).join('')}</div><div class="section-title"><h2>项目与阶段 · 包含 IA</h2><span class="tag">${data.core.length} 条记录</span></div><div class="panel">${data.core.length?data.core.map(x=>recordRow(x,'core')).join(''):empty('从一个研究问题开始','添加 IA、EE、TOK 或 CAS 的阶段目标与反思。')}</div>`;
if(page==='focus')html=head('专注时光','留出一段完整的时间，做一件值得的事。')+`<div class="panel timer"><div class="eyebrow">ONE THING AT A TIME</div><div class="focus-orbit"><div id="timer-display"></div></div><p class="sub">25 分钟专注 · 结束后可保存为学习日志</p><button class="primary" id="timer-start"></button><button class="outline" id="timer-reset">重置</button><button class="outline" id="timer-save">保存已专注时间</button></div>`;
if(page==='settings')html=head('个人设置','让这个空间更像你自己。')+`<div class="grid"><section class="panel"><h2>我的学习档案</h2><form id="profile-form">${field('你的名字','name','text',data.profile.name,'required maxlength="40"')}${field('目标考试日期','exam','date',data.profile.exam,'required')}<button class="primary" style="margin-top:20px">保存设置</button></form></section><section class="panel"><h2>数据与备份</h2><p class="sub">数据保存在当前设备的浏览器中。清除浏览器数据、切换设备或网址不会自动同步。请定期导出备份。</p><div class="actions" style="justify-content:flex-start"><button class="outline" id="export-settings">导出 JSON</button><button class="outline" id="import">导入备份</button><input type="file" id="import-file" accept="application/json" hidden></div><p class="sub">导入前会确认，导入将替换当前数据。</p><div style="margin-top:35px"><h3>移除学科</h3>${data.subjects.map(s=>`<div class="row"><span class="row-body">${esc(s.name)}</span><button class="delete" data-delete="subjects:${s.id}" aria-label="删除科目">×</button></div>`).join('')||'<p class="sub">暂无学科</p>'}</div></section></div>`;
$('#app').innerHTML=html;bind();if(['tasks','logs','grades'].includes(page))renderList();if(page==='focus')paintTimer();bindEnhancements();bindUX();renderNotices()}
function weekChart(){let vals=[];for(let i=6;i>=0;i--){let d=new Date();d.setDate(d.getDate()-i);let key=localDate(d);vals.push([d.getDate(),data.logs.filter(l=>l.date===key).reduce((n,l)=>n+l.minutes,0)])}let max=Math.max(60,...vals.map(x=>x[1]));return `<div class="week">${vals.map(([d,m])=>`<div class="day" title="${m} 分钟"><div class="bar" style="height:${Math.max(3,m/max*70)}px"></div>${d}日</div>`).join('')}</div>`}
function filters(task=false){return `<div class="filters"><input id="search" placeholder="搜索${task?'任务':'记录'}或科目…" value="${esc(filter)}" aria-label="搜索记录"><select id="subject-filter" aria-label="筛选科目"><option value="">全部科目</option>${data.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>${task?`<select id="priority-filter" aria-label="筛选优先级"><option value="">全部优先级</option><option>普通</option><option>重要</option><option>紧急</option></select><select id="status" aria-label="任务状态"><option value="all">全部任务</option><option value="pending">待完成</option><option value="done">已完成</option><option value="today">今天</option><option value="week">近 7 天</option><option value="overdue">已逾期</option></select>`:''}</div>`}
function recordRow(x,kind){return `<div class="row"><div class="row-body"><a href="#" data-edit="${kind}:${x.id}" class="row-title">${esc(x.title)}</a><small>${esc(subjectName(x.subject))} · ${esc(x.date)} ${kind==='logs'?'· '+x.minutes+' 分钟':''}</small>${x.notes?`<details class="note-details"><summary>查看笔记与反馈</summary><div class="note">${esc(x.notes)}</div></details>`:''}${x.raw?`<small>原始分数 ${esc(x.raw)}</small>`:''}</div><span class="tag ${kind==='grades'?'blue':''}">${kind==='grades'?x.score+' / 7':esc(x.stage||'学习日志')}</span>${kind==='core'?`<span class="tag blue">${esc(x.type)}</span>`:''}<button class="delete" data-delete="${kind}:${x.id}" aria-label="删除记录">×</button></div>`}
function renderList(){let items=data[page].filter(x=>(x.title+' '+subjectName(x.subject)).toLowerCase().includes(filter.toLowerCase()));if(subjectFilter)items=items.filter(x=>x.subject===subjectFilter);if(page==='tasks'&&priorityFilter)items=items.filter(x=>x.priority===priorityFilter);if(page==='tasks')items=filterTasks(items,status);items.sort((a,b)=>page==='tasks'?a.date.localeCompare(b.date):b.date.localeCompare(a.date));if($('#result-summary'))$('#result-summary').innerHTML=`<span>显示 ${items.length} / ${data[page].length} 条记录</span>${filter||subjectFilter||priorityFilter||status!=='all'?'<button class="text-button" id="clear-filters">清除筛选 ×</button>':''}`;$('#list').innerHTML=page==='tasks'?(items.length?taskRows(items):empty(data.tasks.length?'没有符合条件的任务':'今天，从一件小事开始',data.tasks.length?'试试更改条件，或清除筛选。':'点击「添加任务」，安排下一步。')):items.map(x=>recordRow(x,page)).join('')||empty('还没有记录','添加你的第一条记录，从今天开始积累。');bindRows();if($('#clear-filters'))$('#clear-filters').onclick=()=>{filter='';subjectFilter='';priorityFilter='';status='all';render()}}
function bindRows(){document.querySelectorAll('[data-edit]').forEach(el=>{el.onclick=e=>{e.preventDefault();let[k,id]=el.dataset.edit.split(':');add(k,id)};if(el.tagName==='ARTICLE')el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click()}}});document.querySelectorAll('[data-delete]').forEach(el=>el.onclick=()=>{const[k,id]=el.dataset.delete.split(':');deleteRecord(k,id)});document.querySelectorAll('[data-check]').forEach(el=>el.onchange=()=>{mutate(()=>{data.tasks.find(t=>t.id===el.dataset.check).done=el.checked});render()})}
function bind(){document.querySelectorAll('[data-add]').forEach(el=>el.onclick=()=>add(el.dataset.add));bindRows();if($('#search'))$('#search').oninput=e=>{filter=e.target.value;renderList()};if($('#status')){$('#status').value=status;$('#status').onchange=e=>{status=e.target.value;render()}}if($('#profile-form'))$('#profile-form').onsubmit=e=>{e.preventDefault();if(mutate(()=>{const v=Object.fromEntries(new FormData(e.target));data.profile={name:v.name.trim(),exam:v.exam}}))toast('档案已更新')};if($('#export-settings'))$('#export-settings').onclick=backup;if($('#import')){$('#import').onclick=()=>$('#import-file').click();$('#import-file').onchange=importData}if($('#timer-start')){$('#timer-start').onclick=()=>{if(timer.running){timer.remaining=Math.max(0,Math.ceil((timer.end-Date.now())/1000));timer.running=false}else{timer.end=Date.now()+timer.remaining*1000;timer.running=true}persistTimer();paintTimer()};$('#timer-reset').onclick=()=>{resetTimer();paintTimer()};$('#timer-save').onclick=()=>{const remaining=timer.running?Math.max(0,Math.ceil((timer.end-Date.now())/1000)):timer.remaining;const m=Math.floor((1500-remaining)/60);if(m<1)return toast('专注满 1 分钟后即可保存');timer.remaining=remaining;timer.running=false;persistTimer();add('logs');focusDraft=true;$('#f-title').value='专注学习';$('#f-minutes').value=m;paintTimer()}}}
function backup(){const raw=recoveryRaw??JSON.stringify(data,null,2);const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(recoveryRaw!==null?'ib-atlas-recovery-':'ib-atlas-')+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份已导出')}
async function importData(e) {
  const input=e.target;
  try {
    const file=input.files[0];if(!file)return;
    if(file.size>5e6)throw Error('备份文件超过 5MB');
    const next=decodeData(await file.text());
    if(!confirm('导入将替换当前数据。建议先导出备份。继续导入？'))return;
    const before=data;data=next;
    if(!save({recover:true})){data=before;return}
    undoSnapshot=null;focusDraft=false;resetTimer();render();toast('备份已恢复');
  } catch(err) {toast('导入失败：'+err.message)}
  finally {input.value=''}
}
function validDate(value,optional=false) {
  if(optional&&(value===undefined||value===''))return true;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [year,month,day]=value.split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1,day));
  return year>=1000&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
function validate(d) {
  const text=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0);
  const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
  const optionalText=(v,max)=>v===undefined||text(v,max);
  const levels=['HL','SL'],types=['作业','复习','考试','IA','EE','TOK','CAS'];
  if(!d||d.version!==1||!d.profile||!text(d.profile.name,40,true)||!validDate(d.profile.exam))throw Error('档案格式或考试日期不正确');
  for(const key of ['subjects','tasks','logs','grades','core'])if(!Array.isArray(d[key])||d[key].length>10000)throw Error('记录格式不正确');
  if(d.subjects.length>8)throw Error('最多支持 8 门科目');
  const subjectIds=new Set(d.subjects.map(s=>s?.id)),ids=new Set();
  const checkId=x=>{if(!x||!id(x.id)||ids.has(x.id))throw Error('记录 ID 无效或重复');ids.add(x.id)};
  for(const s of d.subjects){
    checkId(s);
    if(!text(s.name,100,true)||!levels.includes(s.level)||!Number.isInteger(+s.group)||+s.group<0||+s.group>5||!Number.isInteger(s.progress)||s.progress<0||s.progress>100||!Number.isInteger(s.target)||s.target<1||s.target>7||!optionalText(s.notes,100000))throw Error('科目名称、等级或进度不正确');
  }
  for(const key of ['tasks','logs','grades','core'])for(const x of d[key]){
    checkId(x);
    if(!text(x.title,180,true)||!validDate(x.date)||!optionalText(x.notes,100000)||typeof x.subject!=='string'||(x.subject!==''&&!subjectIds.has(x.subject)))throw Error('记录名称、日期或关联科目不正确');
    if(key==='tasks'&&(typeof x.done!=='boolean'||!['普通','重要','紧急'].includes(x.priority)||!types.includes(x.type)))throw Error('任务状态、优先级或类别不正确');
    if(key==='logs'&&(!Number.isInteger(x.minutes)||x.minutes<1||x.minutes>1440||(x.focusSession!==undefined&&!id(x.focusSession))))throw Error('学习时长须为 1–1440 的整数');
    if(key==='grades'&&(!Number.isInteger(x.score)||x.score<1||x.score>7||!optionalText(x.raw,100)))throw Error('成绩须为 1–7 的整数');
    if(key==='core'&&(!['IA','EE','TOK','CAS'].includes(x.type)||!['未开始','进行中','待反馈','已完成'].includes(x.stage)))throw Error('核心项目类别或进度不正确');
  }
  const topics=d.topics??[];
  if(!Array.isArray(topics)||topics.length>10000)throw Error('知识点格式不正确');
  for(const x of topics){
    checkId(x);
    if(!text(x.title,180,true)||!optionalText(x.notes,100000)||!['new','learning','review','mastered'].includes(x.status)||!subjectIds.has(x.subject)||!validDate(x.review,true))throw Error('知识点状态、科目或复习日期不正确');
  }
}
function decodeData(raw) {
  const d=JSON.parse(raw);
  // Older backups may predate topics or contain records whose subject was removed.
  if(d&&typeof d==='object'){
    d.topics??=[];
    const ids=new Set(Array.isArray(d.subjects)?d.subjects.map(s=>s?.id):[]);
    for(const key of ['tasks','logs','grades','core'])if(Array.isArray(d[key]))for(const x of d[key])if(x&&typeof x.subject==='string'&&!ids.has(x.subject))x.subject='';
  }
  validate(d);return d;
}
let timer=restoreTimer();function paintTimer(){if(!$('#timer-display'))return;const s=timer.running?Math.max(0,Math.ceil((timer.end-Date.now())/1000)):timer.remaining;$('#timer-display').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');$('#timer-start').textContent=timer.running?'暂停专注':s===0?'已完成':'开始专注';$('#timer-start').disabled=s===0}setInterval(()=>{if(timer.running&&Date.now()>=timer.end){timer.running=false;timer.remaining=0;persistTimer();toast('本次专注已完成！可以保存到学习日志。')}paintTimer()},500);$('#backup').onclick=backup;window.addEventListener('hashchange',()=>{document.body?.classList.remove('menu-open');$('#menu-toggle')?.setAttribute('aria-expanded','false');filter='';status='all';subjectFilter='';priorityFilter='';render()});render();


// Subject workspaces, topic revision and calendar views.
function subjectProgress(subject) {
  const topics = data.topics.filter(t => t.subject === subject.id);
  return topics.length ? Math.round(topics.filter(t => t.status === 'mastered').length / topics.length * 100) : subject.progress;
}
function topicEditor(subject, id) {
  focusDraft=false;
  const old = data.topics.find(t => t.id === id);
  modal(old ? '编辑知识点' : '添加知识点',
    field('章节 / 知识点', 'title', 'text', old?.title || '', 'required maxlength="180"') +
    select('掌握状态', 'status', '<option value="new">未开始</option><option value="learning">学习中</option><option value="review">待复习</option><option value="mastered">已掌握</option>') +
    field('下次复习日期（可选）', 'review', 'date', old?.review || '') +
    area('理解、错题与复习笔记', 'notes', old?.notes || ''), v => {
      if (old) {const current=data.topics.find(t=>t.id===id);if(!current)throw Error('此知识点已被移除。');Object.assign(current,v);}
      else data.topics.push({...v, id: crypto.randomUUID(), subject});
    });
  if (old) $('#f-status').value = old.status;
}
function subjectDetail() {
  const s = data.subjects.find(s => s.id === selectedSubject);
  if (!s) return head('没有找到这门科目', '<a href="#subjects">返回我的学科 ↗</a>');
  const topics = data.topics.filter(t => t.subject === s.id);
  const logs = data.logs.filter(l => l.subject === s.id);
  const grades = data.grades.filter(g => g.subject === s.id).sort((a,b)=>b.date.localeCompare(a.date));
  const tasks = data.tasks.filter(t => t.subject === s.id && !t.done).sort((a,b)=>a.date.localeCompare(b.date));
  return head(esc(s.name), `${s.level} · ${groups[s.group][0]} · 目标 ${s.target} / 7`) +
    `<div class="toolbar"><a class="outline button-link" href="#subjects">← 全部学科</a><button data-edit="subjects:${s.id}">编辑学科与笔记</button><button class="primary" id="add-topic">＋ 添加知识点</button></div>
    <div class="stats"><div class="stat"><span class="stat-label">掌握进度</span><strong>${subjectProgress(s)}%</strong><small>${topics.length ? '根据知识点掌握状态计算' : '添加知识点后自动计算'}</small></div><div class="stat"><span class="stat-label">已掌握知识点</span><strong>${topics.filter(t=>t.status==='mastered').length} <small>/ ${topics.length}</small></strong></div><div class="stat"><span class="stat-label">累计学习</span><strong>${(logs.reduce((n,l)=>n+l.minutes,0)/60).toFixed(1)} <small>小时</small></strong></div><div class="stat"><span class="stat-label">最近成绩</span><strong>${grades[0]?.score || '—'} <small>/ 7</small></strong></div></div>
    <section class="panel"><div class="panel-head"><h2>知识点与复习清单</h2><span class="tag">${topics.filter(t=>t.review&&t.review<=today()&&t.status!=='mastered').length} 项到期复习</span></div>
    ${topics.map(t=>`<div class="row"><div class="row-body"><a href="#" data-topic="${t.id}">${esc(t.title)}</a>${t.review?`<small>下次复习 · ${esc(t.review)}</small>`:''}${t.notes?`<div class="note">${esc(t.notes)}</div>`:''}</div><select class="topic-status" data-topic-status="${t.id}" aria-label="${esc(t.title)}掌握状态">${[['new','未开始'],['learning','学习中'],['review','待复习'],['mastered','已掌握']].map(([v,n])=>`<option value="${v}" ${t.status===v?'selected':''}>${n}</option>`).join('')}</select><button class="delete" data-delete="topics:${t.id}" aria-label="删除知识点">×</button></div>`).join('') || empty('把课程拆成一个个小目标', '添加章节、知识点或错题，标记掌握状态并安排复习。')}</section>
    <div class="grid" style="margin-top:22px"><section class="panel"><div class="panel-head"><h2>待办任务</h2><button class="text-button" id="subject-task">＋ 添加</button></div>${taskRows(tasks)}</section><section class="panel"><h2>学科笔记</h2><div class="note">${esc(s.notes) || '点击「编辑学科与笔记」写下你的复习重点。'}</div></section></div>
    <div class="grid"><section class="panel"><h2>最近学习</h2>${logs.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(x=>recordRow(x,'logs')).join('') || empty('还没有学习记录','学习后，留下一点收获。')}</section><section class="panel"><h2>成绩与反馈</h2>${grades.slice(0,5).map(x=>recordRow(x,'grades')).join('') || empty('还没有测评记录','记录真实成绩与改进方向。')}</section></div>`;
}
function calendarView() {
  const year=calendarMonth.getFullYear(), month=calendarMonth.getMonth();
  const first=new Date(year,month,1), offset=(first.getDay()+6)%7;
  const count=new Date(year,month+1,0).getDate();
  const cells=Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>{
    const day=i-offset+1;
    if(day<1||day>count)return '<div class="calendar-cell inactive" aria-hidden="true"></div>';
    const date=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const items=[...data.tasks.filter(t=>t.date===date).map(t=>({...t,kind:'tasks',label:t.type})),...data.core.filter(t=>t.date===date).map(t=>({...t,kind:'core',label:t.type}))];
    return `<div class="calendar-cell ${date===today()?'is-today':''}"><span class="date-number">${day}</span>${items.map(t=>`<button class="calendar-item ${t.done||t.stage==='已完成'?'completed':''}" data-edit="${t.kind}:${t.id}" title="${esc(t.title)}">${esc(t.label)} · ${esc(t.title)}</button>`).join('')}${!items.length?'<span class="calendar-free">—</span>':''}</div>`;
  });
  return head('截止日期月历','把作业、考试和核心项目的时间放在一起。','添加任务','tasks')+
    `<div class="panel"><div class="panel-head"><div class="toolbar"><button id="month-prev" aria-label="上个月">←</button><h2>${year} 年 ${month+1} 月</h2><button id="month-next" aria-label="下个月">→</button></div><button class="outline" id="month-today">本月</button></div><div class="calendar-scroll"><div class="calendar">${['一','二','三','四','五','六','日'].map(d=>`<div class="calendar-day">周${d}</div>`).join('')}${cells.join('')}</div></div><p class="sub">点击日程可编辑。已完成记录以浅色显示。</p></div>`;
}
function gradeSummary() {
  if (!data.subjects.length) return '';
  return `<div class="panel" style="margin-bottom:20px"><h2>各科学习表现</h2>${data.subjects.map(s=>{
    const grades=data.grades.filter(g=>g.subject===s.id).sort((a,b)=>a.date.localeCompare(b.date));
    return `<div class="row"><div class="row-body"><a href="#subject/${s.id}">${esc(s.name)}</a><small>${s.level} · 目标 ${s.target}/7 · ${grades.length} 次测评</small></div><div class="grade-trend" aria-label="最近测评等级">${grades.slice(-6).map(g=>`<span title="${esc(g.title)} · ${g.date}" style="--score:${g.score}">${g.score}</span>`).join('') || '<small>等待第一条成绩</small>'}</div></div>`;
  }).join('')}</div>`;
}
function bindEnhancements() {
  document.querySelectorAll('[data-subject]').forEach(el=>{
    el.onclick=()=>location.hash='subject/'+el.dataset.subject;
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click()}};
  });
  if($('#add-topic'))$('#add-topic').onclick=()=>topicEditor(selectedSubject);
  document.querySelectorAll('[data-topic]').forEach(el=>el.onclick=e=>{e.preventDefault();topicEditor(selectedSubject,el.dataset.topic)});
  document.querySelectorAll('[data-topic-status]').forEach(el=>el.onchange=()=>{mutate(()=>{data.topics.find(t=>t.id===el.dataset.topicStatus).status=el.value});render()});
  if($('#subject-task'))$('#subject-task').onclick=()=>{add('tasks');$('#f-subject').value=selectedSubject};
  for(const [id,delta] of [['month-prev',-1],['month-next',1]])if($('#'+id))$('#'+id).onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+delta,1);render()};
  if($('#month-today'))$('#month-today').onclick=()=>{calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);render()};
  for(const [id,value,update] of [['subject-filter',subjectFilter,v=>subjectFilter=v],['priority-filter',priorityFilter,v=>priorityFilter=v]])if($('#'+id)){$('#'+id).value=value;$('#'+id).onchange=e=>{update(e.target.value);renderList()}};
}

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function filterTasks(items, mode) {
  const end=new Date();end.setDate(end.getDate()+6);
  if(mode==='done')return items.filter(t=>t.done);
  if(mode==='pending')return items.filter(t=>!t.done);
  if(mode==='today')return items.filter(t=>!t.done&&t.date===today());
  if(mode==='overdue')return items.filter(t=>!t.done&&t.date<today());
  if(mode==='week')return items.filter(t=>!t.done&&t.date>=today()&&t.date<=localDate(end));
  return items;
}
function taskTabs() {
  return `<div class="task-tabs" role="group" aria-label="任务时间筛选">${[['all','全部'],['today','今天'],['week','近 7 天'],['overdue','已逾期'],['done','已完成']].map(([v,n])=>`<button class="${status===v?'selected':''}" data-task-tab="${v}" aria-pressed="${status===v}">${n}<span>${filterTasks(data.tasks,v).length}</span></button>`).join('')}</div>`;
}
function dashboardView() {
  const pending=data.tasks.filter(t=>!t.done).sort((a,b)=>a.date.localeCompare(b.date));
  const due=pending.filter(t=>t.date<=today());
  const reviews=data.topics.filter(t=>t.status!=='mastered'&&t.review&&t.review<=today()).sort((a,b)=>a.review.localeCompare(b.review));
  const mins=data.logs.reduce((n,l)=>n+l.minutes,0);
  const weekStart=new Date();weekStart.setDate(weekStart.getDate()-6);
  const weekMinutes=data.logs.filter(l=>l.date>=localDate(weekStart)&&l.date<=today()).reduce((n,l)=>n+l.minutes,0);
  const days=daysUntil(data.profile.exam);
  const name=data.profile.name==='我的'?'':esc(data.profile.name)+'，';
  const onboarding=!data.subjects.length||!data.logs.length;
  return head(`${name}今天，向前一步。`,new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})+' · 你的学习，由你掌握。','记录学习','logs')+
  `<section class="today-hero"><div class="hero-copy"><span class="eyebrow">YOUR DAILY COMPASS</span><h2>${due.length?'先做好今天重要的事。':reviews.length?'给学过的知识，再一次相遇。':'留一点时间，给自己的进步。'}</h2><p>${due.length?`有 ${due.length} 项任务需要关注，${reviews.length} 个知识点等待复习。`:reviews.length?`有 ${reviews.length} 个知识点已到复习日期，温故也在前进。`:'你的日程还有空间。安排一个小目标，或开启一段专注。'}</p><div class="hero-actions"><a class="primary button-link" href="${due.length?'#tasks':'#focus'}">${due.length?'查看待办任务':'开始 25 分钟专注'} ↗</a><button class="hero-secondary" data-add="tasks">＋ 安排任务</button></div></div><div class="hero-summary"><span class="hero-mark">✳</span><span class="eyebrow">LAST 7 DAYS</span><strong>${(weekMinutes/60).toFixed(1)}<small>小时</small></strong><span>每一份投入，都算数。</span></div></section>
  ${onboarding?`<section class="getting-started"><div><span class="eyebrow">MAKE IT YOURS</span><h3>三小步，建立你的学习空间</h3></div><div class="setup-steps"><button data-add="subjects" class="${data.subjects.length?'step-done':''}"><span>${data.subjects.length?'✓':'1'}</span>添加你的学科</button><button data-add="tasks" class="${data.tasks.length?'step-done':''}"><span>${data.tasks.length?'✓':'2'}</span>安排第一项任务</button><button data-add="logs" class="${data.logs.length?'step-done':''}"><span>${data.logs.length?'✓':'3'}</span>记录一次学习</button></div></section>`:''}
  <div class="stats"><a class="stat" href="#logs"><span class="stat-label">累计学习</span><strong>${(mins/60).toFixed(1)} <small>小时</small></strong><small>${data.logs.length} 次投入 ↗</small></a><a class="stat" href="#tasks"><span class="stat-label">待完成任务</span><strong>${pending.length} <small>项</small></strong><small>${pending.filter(t=>t.date<today()).length} 项逾期 ↗</small></a><a class="stat" href="#subjects"><span class="stat-label">我的学科</span><strong>${data.subjects.length} <small>/ 6</small></strong><small>${data.subjects.filter(s=>s.level==='HL').length} HL · ${data.subjects.filter(s=>s.level==='SL').length} SL ↗</small></a><a class="stat" href="#settings"><span class="stat-label">目标考试倒计时</span><strong>${days} <small>天</small></strong><small>${esc(data.profile.exam)} · 修改 ↗</small></a></div>
  <div class="grid"><section class="panel"><div class="panel-head"><h2>接下来要做的事</h2><a class="text-button" href="#tasks">全部任务 ↗</a></div>${taskRows(pending.slice(0,4))}</section><section class="panel"><div class="panel-head"><h2>到期复习</h2><span class="tag">${reviews.length} 个知识点</span></div>${reviews.slice(0,4).map(t=>`<a class="review-link" href="#subject/${t.subject}"><span class="review-icon">↻</span><div><strong>${esc(t.title)}</strong><small>${esc(subjectName(t.subject))} · ${esc(t.review)}</small></div><span>↗</span></a>`).join('')||empty('让记忆，慢慢扎根','在科目知识点里设置复习日期，这里会提醒你。')}<a class="text-button" href="#subjects">进入学科安排复习 →</a></section></div>
  <div class="section-title"><h2>我的学科 <span class="sub"> / MY SUBJECTS</span></h2><a class="text-button" href="#subjects">管理学科 ↗</a></div><div class="subjects">${subjectCards()||`<button class="add-subject-card" data-add="subjects"><span>＋</span><strong>添加你的第一门课</strong><small>建立专属的 HL / SL 学科空间</small></button>`}</div>
  <section class="panel"><div class="panel-head"><h2>最近 7 天的积累</h2><span class="sub">${weekMinutes} 分钟</span></div>${weekChart()}</section>`;
}
function quickAdd() {
  if($('#modal').open)return;
  modal('今天，想记录什么？',`<p class="sub">选择一种记录，让每次行动留下痕迹。</p><div class="quick-grid">${[['tasks','☑','学习任务','作业、复习和考试'],['logs','▤','学习日志','时间、收获与思考'],['grades','↗','测评成绩','反馈与改进方向'],['core','◇','核心项目','IA / EE / TOK / CAS']].map(([k,i,n,d])=>`<button type="button" data-quick="${k}"><span>${i}</span><strong>${n}</strong><small>${d}</small></button>`).join('')}</div>`,()=>{});
  $('#modal .actions')?.classList.add('is-hidden');
  document.querySelectorAll('[data-quick]').forEach(el=>el.onclick=()=>{add(el.dataset.quick);$('#modal .actions')?.classList.remove('is-hidden')});
}
function deleteRecord(kind,id) {
  const index=data[kind].findIndex(x=>x.id===id);
  if(index<0)return;
  if(kind==='subjects'&&!confirm('移除此学科及其知识点？学习日志、任务和成绩会保留，归入「综合 / 核心」。删除后可立即撤销。'))return;
  const snapshot=JSON.stringify(data);
  const undo={kind,index,record:data[kind][index],topics:[],links:[]};
  data[kind].splice(index,1);
  if(kind==='subjects'){
    undo.topics=data.topics.filter(t=>t.subject===id);
    data.topics=data.topics.filter(t=>t.subject!==id);
    for(const key of ['tasks','logs','grades','core'])for(const x of data[key])if(x.subject===id){undo.links.push([key,x.id]);x.subject=''}
  }
  if(!save()){data=JSON.parse(snapshot);return}
  undoSnapshot=undo;render();toast('记录已移除',undoDelete);
}
function undoDelete() {
  if(!undoSnapshot)return;
  const before=JSON.stringify(data),u=undoSnapshot;
  if(!data[u.kind].some(x=>x.id===u.record.id))data[u.kind].splice(u.index,0,u.record);
  if(u.kind==='subjects'){
    for(const topic of u.topics)if(!data.topics.some(t=>t.id===topic.id))data.topics.push(topic);
    for(const [key,id] of u.links){const x=data[key].find(x=>x.id===id);if(x&&x.subject==='')x.subject=u.record.id}
  }
  if(!save()){data=JSON.parse(before);return}
  undoSnapshot=null;render();toast('记录已恢复');
}
function freshTimer(){return {remaining:1500,running:false,end:0,session:crypto.randomUUID()}}
function restoreTimer() {
  try {
    const t=JSON.parse(localStorage.getItem('ib-atlas-timer'));
    if(t&&Number.isInteger(t.remaining)&&t.remaining>=0&&t.remaining<=1500&&typeof t.running==='boolean'&&Number.isFinite(t.end)){
      if(t.session!==undefined&&(typeof t.session!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(t.session)))return freshTimer();
      if(t.session&&data.logs.some(l=>l.focusSession===t.session))return freshTimer();
      const session=t.session||crypto.randomUUID();
      if(t.running&&t.end<=Date.now())return {remaining:0,running:false,end:0,session};
      if(t.running&&t.end>Date.now()+1500000)return freshTimer();
      return {...t,session};
    }
  }catch{}
  return freshTimer();
}
function persistTimer(){
  try {localStorage.setItem('ib-atlas-timer',JSON.stringify(timer));return true}
  catch {toast('计时状态未能保存，刷新可能丢失进度。');return false}
}
function resetTimer(){timer=freshTimer();persistTimer()}
function bindUX() {
  if($('#mobile-dock'))$('#mobile-dock').innerHTML=[['dashboard','◫','总览'],['tasks','☑','任务'],['subjects','▦','学科'],['focus','◷','专注']].map(([id,icon,name])=>`<a href="#${id}" class="${page===id||(page==='subject'&&id==='subjects')?'active':''}"><span>${icon}</span>${name}</a>`).join('')+'<button id="dock-more"><span>☰</span>更多</button>';
  const toggleMenu=()=>{document.body.classList.toggle('menu-open');$('#menu-toggle')?.setAttribute('aria-expanded',String(document.body.classList.contains('menu-open')))};
  if($('#menu-toggle'))$('#menu-toggle').onclick=toggleMenu;
  if($('#dock-more'))$('#dock-more').onclick=toggleMenu;
  if($('#quick-add'))$('#quick-add').onclick=quickAdd;
  document.querySelectorAll('[data-task-tab]').forEach(el=>el.onclick=()=>{status=el.dataset.taskTab;render()});
  $('#modal .actions')?.classList.remove('is-hidden');
  if($('#status'))$('#status').value=status;
}

$('#modal').addEventListener?.('cancel',()=>{focusDraft=false});
document.addEventListener?.('keydown',e=>{if(e.altKey&&e.key.toLowerCase()==='n'&&!$('#modal').open){e.preventDefault();quickAdd()}if(e.key==='/'&&!$('#modal').open&&!document.activeElement?.isContentEditable&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&$('#search')){e.preventDefault();$('#search').focus()}});

function daysUntil(date) {
  const [year,month,day]=date.split('-').map(Number);
  const now=new Date();
  return Math.max(0,Math.round((Date.UTC(year,month-1,day)-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000));
}
function renderNotices() {
  const status=$('#storage-status');if(status)status.textContent=recoveryRaw!==null?'原有数据需要恢复':storageConflict?'其他标签页有更新':storageUnavailable?'浏览器存储不可用':'数据保存在此浏览器';
  const box=$('#data-notice');if(!box)return;
  if(recoveryRaw!==null){
    box.innerHTML='<div class="data-notice"><strong>已有数据暂时无法读取，原文件仍保留。</strong><p>请先导出恢复文件，再导入有效备份。当前空白界面不会覆盖原数据。</p><button id="recovery-export">导出恢复文件</button><a href="#settings">导入备份 →</a><button id="recovery-reset">清空并重新开始</button></div>';
    $('#recovery-export').onclick=backup;
    $('#recovery-reset').onclick=()=>{if(!confirm('此操作将清空当前浏览器无法读取的记录。请先导出恢复文件。确定重新开始？'))return;const before=data;data=initial();if(!save({recover:true})){data=before;return}undoSnapshot=null;resetTimer();render();toast('已建立新的学习空间')};
  } else if(storageConflict) {
    box.innerHTML='<div class="data-notice"><strong>另一个标签页更新了学习记录。</strong><p>为保留最新记录，当前修改尚未保存。载入后请重新编辑。</p><button id="reload-records">载入最新记录</button></div>';
    $('#reload-records').onclick=()=>reloadStoredData(true);
  } else if(storageUnavailable) {
    box.innerHTML='<div class="data-notice"><strong>浏览器存储暂时不可用。</strong><p>请允许此网站保存数据后重试。未保存的记录不会显示为保存成功。</p></div>';
  } else box.innerHTML='';
}
function reloadStoredData(ask=false) {
  if(ask&&$('#modal').open&&!confirm('载入最新记录会关闭当前未保存的表单，继续？'))return false;
  try {
    const raw=localStorage.getItem(STORAGE_KEY)??null;
    const next=raw===null?initial():decodeData(raw);
    data=next;storedRaw=raw;recoveryRaw=null;storageConflict=false;storageUnavailable=false;
    undoSnapshot=null;focusDraft=false;$('#modal').close();render();return true;
  } catch {storageConflict=true;renderNotices();toast('最新数据无法读取，未覆盖当前记录。');return false}
}
window.addEventListener('storage',e=>{
  if(e.key===STORAGE_KEY||e.key===null){
    if($('#modal').open||recoveryRaw!==null){storageConflict=true;renderNotices()}
    else reloadStoredData();
  }
  if(e.key==='ib-atlas-timer'||e.key===null){
    timer=restoreTimer();paintTimer();
    if(focusDraft){focusDraft=false;$('#modal').close();toast('专注状态已在另一标签页更新，请重新确认已记录时长。')}
  }
});
