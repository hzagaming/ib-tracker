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
  return items.length?items.map(t=>`<div class="row task-row"><input class="check" type="checkbox" aria-label="${taskBulkMode?'选择':'完成'} ${esc(t.title)}" ${taskBulkMode?'data-task-select':'data-check'}="${t.id}" ${(taskBulkMode?taskSelection.has(t.id):t.done)?'checked':''}><div class="row-body"><a href="#" data-edit="tasks:${t.id}" class="row-title ${t.done?'done':''}">${esc(t.title)}</a><small>${esc(subjectName(t.subject))} · ${t.date} · <span class="task-date ${!t.done&&t.date<today()?'overdue':''}">${taskDateLabel(t)}</span></small></div><span class="tag ${t.priority==='紧急'?'orange':''}">${esc(t.type)} · ${esc(t.priority)}</span><details class="task-menu"><summary aria-label="${esc(t.title)}的更多操作">⋯</summary><div class="task-menu-panel"><button type="button" data-task-edit="${t.id}">编辑任务</button>${!t.done?`<button type="button" data-task-tomorrow="${t.id}">改到明天</button><button type="button" data-task-focus="${t.id}">开始专注</button><button type="button" data-task-plan="${t.id}">安排一段学习</button>`:''}<button type="button" data-task-copy="${t.id}">复制为新任务</button><button type="button" data-delete="tasks:${t.id}">删除任务</button></div></details></div>`).join(''):empty('给下一步，留一个位置','添加作业、复习计划或即将到来的考试。');
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
  document.querySelectorAll('[data-task-focus]').forEach(el=>el.onclick=()=>prepareFocus('tasks',el.dataset.taskFocus));
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
  bindCalendar();
  document.querySelectorAll('aside #nav a,.mobile-dock a').forEach(el=>el.onclick=closeMainMenu);
  const more=$('#dock-more'),primary=['dashboard','tasks','subjects','subject','focus'];
  if(more){more.setAttribute('aria-controls','nav');more.setAttribute('aria-expanded',String(document.body?.classList.contains('menu-open')??false));if(!primary.includes(page))more.classList.add('active')}
  const toggle=()=>{const open=!document.body.classList.contains('menu-open');document.body.classList.toggle('menu-open',open);for(const id of ['menu-toggle','dock-more'])$('#'+id)?.setAttribute('aria-expanded',String(open))};
  if($('#menu-toggle')){$('#menu-toggle').setAttribute('aria-controls','nav');$('#menu-toggle').onclick=toggle}
  if(more)more.onclick=toggle;
  if($('.skip-link'))$('.skip-link').onclick=e=>{e.preventDefault();$('#app')?.focus?.({preventScroll:true});$('#app')?.scrollIntoView?.({block:'start'})};
  if($('#task-sort')){$('#task-sort').value=taskSort;$('#task-sort').onchange=e=>{taskSort=e.target.value;renderList()}};
  bindTaskTools();bindFocus();
}

let calendarMode='month',calendarSubject='',calendarKind='',calendarStatus='all',calendarDay='';
const CALENDAR_KINDS=[['tasks','任务'],['plans','学习计划'],['exams','考试'],['core','核心项目']];
function calendarEntries(){
  if(calendarSubject&&calendarSubject!=='general:'&&!data.subjects.some(s=>s.id===calendarSubject))calendarSubject='';
  return CALENDAR_KINDS.flatMap(([kind,label])=>data[kind].map(record=>({
    ...record,kind,label,done:kind==='core'?record.stage==='已完成':kind==='exams'?record.status==='已完成':record.done
  }))).filter(x=>(!calendarSubject||x.subject===(calendarSubject==='general:'?'':calendarSubject))&&(!calendarKind||x.kind===calendarKind)&&(calendarStatus!=='pending'||!x.done))
    .sort((a,b)=>a.date.localeCompare(b.date)||Number(a.done)-Number(b.done)||(a.time||'').localeCompare(b.time||'')||a.title.localeCompare(b.title,'zh-CN'));
}
function calendarDateLabel(date){
  const [y,m,d]=date.split('-').map(Number);
  return `${m} 月 ${d} 日 · 周${'日一二三四五六'[new Date(y,m-1,d,12).getDay()]}${date===today()?' · 今天':''}`;
}
function calendarRows(items){
  return items.map(x=>`<article class="agenda-row ${x.done?'completed':''}"><div class="agenda-body"><span class="tag">${esc(x.label)}</span><button class="agenda-title" data-calendar-edit="${x.kind}:${x.id}">${esc(x.title)}</button><small>${esc(subjectName(x.subject))}${x.time?' · '+esc(x.time):''}${x.kind==='plans'?' · '+x.minutes+' 分钟':''} · ${x.done?'已完成':x.date<today()?'已逾期':'待完成'}</small></div>${!x.done&&x.kind==='plans'?`<button class="outline" data-plan-complete="${x.id}">完成并记录</button>`:''}</article>`).join('');
}
function calendarAddButtons(date){
  return `<div class="calendar-add-actions">${CALENDAR_KINDS.map(([kind,label])=>`<button class="outline" data-calendar-add="${kind}" data-calendar-date="${date}">＋ ${label}</button>`).join('')}</div>`;
}
function buildCalendarView(){
  const year=calendarMonth.getFullYear(),month=calendarMonth.getMonth(),prefix=`${year}-${String(month+1).padStart(2,'0')}`;
  if(!validDate(calendarDay)||!calendarDay.startsWith(prefix+'-'))calendarDay=today().startsWith(prefix+'-')?today():prefix+'-01';
  const entries=calendarEntries(),items=entries.filter(x=>x.date.startsWith(prefix+'-')),byDate=new Map();
  for(const x of items){if(!byDate.has(x.date))byDate.set(x.date,[]);byDate.get(x.date).push(x)}
  const offset=(new Date(year,month,1).getDay()+6)%7,count=new Date(year,month+1,0).getDate();
  const cells=Array.from({length:Math.ceil((offset+count)/7)*7},(_,i)=>{
    const day=i-offset+1;
    if(day<1||day>count)return '<div class="calendar-cell inactive" aria-hidden="true"></div>';
    const date=prefix+'-'+String(day).padStart(2,'0'),list=byDate.get(date)||[],pending=list.filter(x=>!x.done).length;
    return `<button class="calendar-cell calendar-date ${date===today()?'is-today':''} ${date===calendarDay?'is-selected':''}" data-calendar-day="${date}" aria-pressed="${date===calendarDay}" ${date===today()?'aria-current="date"':''} aria-label="${date}，${list.length} 项安排，${pending} 项待完成"><span class="date-number">${day}</span><span class="calendar-previews">${list.slice(0,2).map(x=>`<span class="calendar-item ${x.done?'completed':''}">${esc(x.label)} · ${esc(x.title)}</span>`).join('')}</span>${list.length?`<span class="calendar-count">${list.length} 项${pending?' · 待办 '+pending:''}</span>`:''}</button>`;
  }).join('');
  const selected=byDate.get(calendarDay)||[],pending=items.filter(x=>!x.done).length;
  const overdue=items.filter(x=>!x.done&&x.date<today()).length;
  return head('学习日程','任务、学习计划、考试和核心项目，在同一张日程中安排。')+
    `<div class="filters calendar-filters"><select id="calendar-subject" aria-label="筛选日程科目"><option value="">全部科目</option><option value="general:">综合 / 核心</option>${data.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><select id="calendar-kind" aria-label="筛选日程类型"><option value="">全部类型</option>${CALENDAR_KINDS.map(([kind,label])=>`<option value="${kind}">${label}</option>`).join('')}</select><select id="calendar-status" aria-label="筛选日程状态"><option value="all">全部状态</option><option value="pending">只看待完成</option></select>${calendarSubject||calendarKind||calendarStatus!=='all'?'<button class="text-button" id="calendar-clear">清除筛选</button>':''}</div>
    <section class="panel schedule-panel"><div class="panel-head calendar-heading"><div class="toolbar"><button id="month-prev" aria-label="上个月">←</button><h2>${year} 年 ${month+1} 月</h2><button id="month-next" aria-label="下个月">→</button><button class="outline" id="month-today">今天</button></div><div class="task-tabs calendar-view-switch" role="group" aria-label="日程视图">${[['month','月历'],['agenda','日程清单']].map(([mode,label])=>`<button data-calendar-mode="${mode}" class="${calendarMode===mode?'selected':''}" aria-pressed="${calendarMode===mode}">${label}</button>`).join('')}</div></div><p class="sub calendar-summary" role="status">所选月 · ${items.length} 项安排 · ${pending} 项待完成 · ${overdue} 项逾期${calendarSubject||calendarKind||calendarStatus!=='all'?' · 已筛选':''}</p>
    ${calendarMode==='month'?`<p class="sub calendar-help">选择日期查看当天安排；方向键切换日期，Page Up / Down 切换月份。</p><div class="calendar schedule-grid" role="group" aria-label="选择日程日期">${['一','二','三','四','五','六','日'].map(d=>`<div class="calendar-day">周${d}</div>`).join('')}${cells}</div><section class="calendar-day-detail" aria-labelledby="calendar-day-title"><div class="panel-head"><h3 id="calendar-day-title">${calendarDateLabel(calendarDay)}</h3><span class="tag">${selected.length} 项安排</span></div>${calendarAddButtons(calendarDay)}${selected.length?calendarRows(selected):empty('这一天还没有匹配的安排','可以为这一天添加任务、学习计划、考试或项目。')}</section>`:
      `<div class="calendar-agenda">${items.length?[...byDate].map(([date,list])=>`<section class="agenda-day"><div class="panel-head"><h3>${calendarDateLabel(date)}</h3><button class="text-button" data-calendar-open-day="${date}">查看当天 ↗</button></div>${calendarRows(list)}</section>`).join(''):empty('这个月还没有匹配的安排','调整筛选条件，或选一个日期添加下一步。')}</div><div class="agenda-create"><label for="calendar-create-date">添加到日期</label><input type="date" id="calendar-create-date" value="${calendarDay}" required>${calendarAddButtons(calendarDay)}</div>`}
    </section>`;
}
function calendarCreate(kind,date){
  if(!CALENDAR_KINDS.some(([key])=>key===kind)||!validDate(date)){toast('请先选择有效的日程日期。');return}
  const subject=calendarSubject==='general:'?'':calendarSubject;
  if(kind==='plans')studyEditor('plan',null,{date,subject});
  else if(kind==='exams'){examEditor(null,subject);$('#f-date').value=date}
  else{add(kind);$('#f-date').value=date;$('#f-subject').value=subject}
}
function selectCalendarDay(date){
  if(!validDate(date))return;
  const [year,month]=date.split('-').map(Number);
  calendarDay=date;calendarMonth=new Date(year,month-1,1);calendarMode='month';render();
  document.querySelector(`[data-calendar-day="${date}"]`)?.focus?.({preventScroll:true});
}
function calendarDayKey(event,date){
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  const [year,month,day]=date.split('-').map(Number),weekday=(new Date(year,month-1,day,12).getDay()+6)%7;
  const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-weekday,End:6-weekday}[event.key];
  let next;
  if(delta!==undefined)next=dateAfter(delta,date);
  else if(event.key==='PageUp'||event.key==='PageDown'){
    const first=new Date(year,month-1+(event.key==='PageUp'?-1:1),1,12);
    next=localDate(new Date(first.getFullYear(),first.getMonth(),Math.min(day,new Date(first.getFullYear(),first.getMonth()+1,0).getDate()),12));
  }else return;
  event.preventDefault();selectCalendarDay(next);
}
function bindCalendar(){
  if(page!=='calendar')return;
  for(const [id,value,set] of [['calendar-subject',calendarSubject,v=>calendarSubject=v],['calendar-kind',calendarKind,v=>calendarKind=v],['calendar-status',calendarStatus,v=>calendarStatus=v]]){
    $('#'+id).value=value;$('#'+id).onchange=e=>{set(e.target.value);render()};
  }
  if($('#calendar-clear'))$('#calendar-clear').onclick=()=>{calendarSubject='';calendarKind='';calendarStatus='all';render()};
  for(const [id,delta] of [['month-prev',-1],['month-next',1]])$('#'+id).onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+delta,1);calendarDay='';render()};
  $('#month-today').onclick=()=>{const now=new Date();calendarMonth=new Date(now.getFullYear(),now.getMonth(),1);calendarDay=today();render()};
  document.querySelectorAll('[data-calendar-mode]').forEach(el=>el.onclick=()=>{calendarMode=el.dataset.calendarMode;render()});
  document.querySelectorAll('[data-calendar-day],[data-calendar-open-day]').forEach(el=>el.onclick=()=>selectCalendarDay(el.dataset.calendarDay||el.dataset.calendarOpenDay));
  document.querySelectorAll('[data-calendar-day]').forEach(el=>{el.tabIndex=el.dataset.calendarDay===calendarDay?0:-1;el.onkeydown=e=>calendarDayKey(e,el.dataset.calendarDay)});
  document.querySelectorAll('[data-calendar-edit]').forEach(el=>el.onclick=()=>{const[kind,id]=el.dataset.calendarEdit.split(':');if(kind==='plans')studyEditor('plan',id);else if(kind==='exams')examEditor(id);else add(kind,id)});
  document.querySelectorAll('[data-calendar-add]').forEach(el=>el.onclick=()=>calendarCreate(el.dataset.calendarAdd,$('#calendar-create-date')?.value??el.dataset.calendarDate));
}
