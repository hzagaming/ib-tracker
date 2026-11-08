'use strict';

let taskBulkMode=false,taskSelection=new Set(),taskVisibleIds=[],taskSort='due';
const NAV_GROUPS=[
  ['开始学习',['dashboard','tasks','planner','focus']],
  ['学科与复习',['subjects','review','mistakes','library']],
  ['进度与成果',['exams','calendar','grades','logs','analytics','reflections']],
  ['项目与设置',['core','search','settings']]
];
function groupedNavigation(){
  const count={tasks:data.tasks.filter(t=>!t.done).length,review:data.topics.filter(t=>scheduledReview(t)&&t.review<=today()).length,exams:data.exams.filter(e=>e.status==='计划中'&&e.date>=today()&&daysUntil(e.date)<=7).length};
  return NAV_GROUPS.map(([name,ids],i)=>`<section class="nav-group" aria-labelledby="nav-group-${i}"><h2 id="nav-group-${i}">${name}</h2>${ids.map(id=>{const item=nav.find(n=>n[0]===id),active=page===id||(page==='subject'&&id==='subjects');return `<a href="#${id}" class="${active?'active':''}" ${active?'aria-current="'+(page===id?'page':'location')+'"':''}><span class="nav-icon" aria-hidden="true">${item[1]}</span><span class="nav-label">${item[2]}</span>${count[id]?`<span class="nav-count" aria-label="${count[id]} 项">${count[id]}</span>`:''}</a>`}).join('')}</section>`).join('');
}
function recordMatches(x){
  return (x.title+' '+subjectName(x.subject)+' '+(x.notes||'')).toLowerCase().includes(filter.trim().toLowerCase())&&(!subjectFilter||x.subject===subjectFilter)&&(!(page==='tasks'&&priorityFilter)||x.priority===priorityFilter);
}
function compareTasks(a,b){
  const priority={'紧急':0,'重要':1,'普通':2};
  return Number(a.done)-Number(b.done)||(taskSort==='priority'?priority[a.priority]-priority[b.priority]:0)||a.date.localeCompare(b.date)||priority[a.priority]-priority[b.priority];
}
function taskDateLabel(t){
  if(t.done)return '已完成';
  if(t.date<today())return '已逾期';
  if(t.date===today())return '今天到期';
  if(t.date===dateAfter(1))return '明天到期';
  return '待完成';
}
function renderTaskRows(items){
  return items.length?items.map(t=>`<div class="row task-row"><input class="check" type="checkbox" aria-label="${taskBulkMode?'选择':'完成'} ${esc(t.title)}" ${taskBulkMode?'data-task-select':'data-check'}="${t.id}" ${(taskBulkMode?taskSelection.has(t.id):t.done)?'checked':''}><div class="row-body"><a href="#" data-edit="tasks:${t.id}" class="row-title ${t.done?'done':''}">${esc(t.title)}</a><small>${esc(subjectName(t.subject))} · ${t.date} · <span class="task-date ${!t.done&&t.date<today()?'overdue':''}">${taskDateLabel(t)}</span></small></div><span class="tag ${t.priority==='紧急'?'orange':''}">${esc(t.type)} · ${esc(t.priority)}</span><details class="task-menu"><summary aria-label="${esc(t.title)}的更多操作">⋯</summary><div class="task-menu-panel"><button type="button" data-task-edit="${t.id}">编辑任务</button>${!t.done?`<button type="button" data-task-tomorrow="${t.id}">改到明天</button><button type="button" data-task-plan="${t.id}">安排一段学习</button>`:''}<button type="button" data-task-copy="${t.id}">复制为新任务</button><button type="button" data-delete="tasks:${t.id}">删除任务</button></div></details></div>`).join(''):empty('给下一步，留一个位置','添加作业、复习计划或即将到来的考试。');
}
function resetTaskSelection(){taskBulkMode=false;taskSelection.clear();taskVisibleIds=[]}
function taskBulkToolbar(){
  const pending=data.tasks.filter(t=>taskSelection.has(t.id)&&!t.done).length;
  if(!taskBulkMode)return '<div class="task-bulk-toolbar"><span>勾选方框可完成任务，更多操作在 ⋯ 中。</span><button class="outline" id="enable-task-bulk">批量操作</button></div>';
  return `<div class="task-bulk-toolbar active"><div><strong>已选 ${taskSelection.size} 项</strong><small>其中 ${pending} 项待完成</small></div><div class="bulk-buttons"><button id="select-visible-tasks">${taskSelection.size===taskVisibleIds.length&&taskVisibleIds.length?'取消全选':'全选当前结果'}</button><button class="primary" id="complete-selected-tasks" ${pending?'':'disabled'}>标记完成</button><button class="outline" id="postpone-selected-tasks" ${pending?'':'disabled'}>待办改到明天</button><button class="text-button" id="cancel-task-bulk">退出批量</button></div></div>`;
}
function changeTasks(ids,field,value){
  const wanted=new Set(ids);
  const changes=data.tasks.filter(t=>wanted.has(t.id)&&!t.done&&t[field]!==value).map(t=>({id:t.id,before:t[field]}));
  if(!changes.length){toast('没有需要修改的待办任务。');return false}
  if(!mutate(()=>{const lookup=new Map(data.tasks.map(t=>[t.id,t]));for(const change of changes)lookup.get(change.id)[field]=value}))return false;
  taskSelection.clear();render();
  toast(field==='done'?`已完成 ${changes.length} 项任务`:`已将 ${changes.length} 项待办改到明天`,()=>{
    if(mutate(()=>{const lookup=new Map(data.tasks.map(t=>[t.id,t]));for(const change of changes){const t=lookup.get(change.id);if(t&&t[field]===value)t[field]=change.before}})){render();toast('已撤销这次任务修改')}
  });return true;
}
function copyTask(id){
  const t=data.tasks.find(t=>t.id===id);if(!t)return;
  add('tasks');
  const values={title:(t.title+' · 副本').slice(0,180),subject:t.subject,date:t.date,priority:t.priority,type:t.type,notes:t.notes||''};
  for(const[key,value]of Object.entries(values))$('#f-'+key).value=value;
}
function planTask(id){
  const t=data.tasks.find(t=>t.id===id);if(!t)return;
  studyEditor('plan',null,{title:t.title,subject:t.subject,date:t.date<today()?today():t.date,minutes:30,notes:t.notes||''});
}
function bindTaskTools(){
  document.querySelectorAll('[data-task-tab]').forEach(el=>el.onclick=()=>{status=el.dataset.taskTab;taskSelection.clear();render()});
  document.querySelectorAll('[data-task-select]').forEach(el=>el.onchange=()=>{const id=el.dataset.taskSelect;if(el.checked)taskSelection.add(id);else taskSelection.delete(id);renderList();document.querySelector('[data-task-select="'+id+'"]')?.focus?.({preventScroll:true})});
  document.querySelectorAll('[data-task-tomorrow]').forEach(el=>el.onclick=()=>changeTasks([el.dataset.taskTomorrow],'date',dateAfter(1)));
  document.querySelectorAll('[data-task-copy]').forEach(el=>el.onclick=()=>copyTask(el.dataset.taskCopy));
  document.querySelectorAll('[data-task-plan]').forEach(el=>el.onclick=()=>planTask(el.dataset.taskPlan));
  document.querySelectorAll('[data-task-edit]').forEach(el=>el.onclick=()=>add('tasks',el.dataset.taskEdit));
  document.querySelectorAll('.task-menu button').forEach(el=>el.addEventListener('click',()=>el.closest('details')?.removeAttribute('open')));
  if($('#enable-task-bulk'))$('#enable-task-bulk').onclick=()=>{taskBulkMode=true;taskSelection.clear();renderList()};
  if($('#cancel-task-bulk'))$('#cancel-task-bulk').onclick=()=>{resetTaskSelection();renderList()};
  if($('#select-visible-tasks'))$('#select-visible-tasks').onclick=()=>{const all=taskVisibleIds.length&&taskSelection.size===taskVisibleIds.length;taskSelection.clear();if(!all)for(const id of taskVisibleIds)taskSelection.add(id);renderList()};
  if($('#complete-selected-tasks'))$('#complete-selected-tasks').onclick=()=>changeTasks([...taskSelection],'done',true);
  if($('#postpone-selected-tasks'))$('#postpone-selected-tasks').onclick=()=>changeTasks([...taskSelection],'date',dateAfter(1));
}
function closeMainMenu(){
  document.body?.classList.remove('menu-open');
  for(const id of ['menu-toggle','dock-more'])$('#'+id)?.setAttribute('aria-expanded','false');
}
function bindExperience(){
  document.querySelectorAll('aside #nav a,.mobile-dock a').forEach(el=>el.onclick=closeMainMenu);
  const more=$('#dock-more'),primary=['dashboard','tasks','subjects','subject','focus'];
  if(more){more.setAttribute('aria-controls','nav');more.setAttribute('aria-expanded',String(document.body?.classList.contains('menu-open')??false));if(!primary.includes(page))more.classList.add('active')}
  const toggle=()=>{const open=!document.body.classList.contains('menu-open');document.body.classList.toggle('menu-open',open);for(const id of ['menu-toggle','dock-more'])$('#'+id)?.setAttribute('aria-expanded',String(open))};
  if($('#menu-toggle')){$('#menu-toggle').setAttribute('aria-controls','nav');$('#menu-toggle').onclick=toggle}
  if(more)more.onclick=toggle;
  if($('.skip-link'))$('.skip-link').onclick=e=>{e.preventDefault();$('#app')?.focus?.({preventScroll:true});$('#app')?.scrollIntoView?.({block:'start'})};
  if($('#task-sort')){$('#task-sort').value=taskSort;$('#task-sort').onchange=e=>{taskSort=e.target.value;renderList()}};
  bindTaskTools();
}
