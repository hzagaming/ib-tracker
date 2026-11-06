'use strict';

let examSubject='',examStatus='',reflectionOffset=0;
const EXAM_PHASES=[
  {key:'scope',days:14,label:'梳理考试范围',notes:'列出考试范围中的章节与知识点，对照笔记标出不确定的部分，再为最需要复习的内容安排学习时间。'},
  {key:'practice',days:7,label:'练习与错题回看',notes:'选取有代表性的题目，按自己的目标时间独立完成；对照反馈，把出错原因和修正思路记录到错题本。'},
  {key:'check',days:1,label:'最后检查与准备',notes:'回看关键概念与反复出错的地方，确认学校提供的时间、地点及材料要求，留出休息与机动时间。'}
];
function validateProgress(d,ids,subjectIds) {
  const text=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0);
  const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v),weeks=new Set();
  for(const key of ['exams','reflections']){
    const list=d[key]??[];if(!Array.isArray(list)||list.length>10000)throw Error('考试或周复盘格式不正确');
    for(const x of list){
      if(!x||!id(x.id)||ids.has(x.id)||!text(x.title,180,true)||typeof x.subject!=='string'||(x.subject!==''&&!subjectIds.has(x.subject))||!validDate(x.date)||!text(x.notes,100000))throw Error('考试或复盘的名称、科目、日期不正确');
      ids.add(x.id);
      if(key==='exams'&&(!['计划中','已完成'].includes(x.status)||typeof x.time!=='string'||(x.time!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time))||!Number.isInteger(x.duration)||x.duration<1||x.duration>480||!text(x.scope,100000)||!text(x.target,200)))throw Error('考试时间、时长、范围或状态不正确');
      if(key==='reflections'){
        if(!validDate(x.weekStart)||new Date(x.weekStart+'T12:00:00').getDay()!==1||weeks.has(x.weekStart)||x.subject!==''||!['顺利','一般','需要调整'].includes(x.pace))throw Error('一周只能有一份复盘，起始日期须为周一');
        weeks.add(x.weekStart);
        for(const field of ['wins','challenge','adjustment','next'])if(!text(x[field],100000))throw Error('周复盘内容格式不正确');
        if(![x.wins,x.challenge,x.adjustment,x.next].some(v=>v.trim()))throw Error('请至少记录一项收获、难点或下一步行动');
      }
    }
  }
}
function examEditor(id,subject='') {
  const old=data.exams.find(e=>e.id===id),v={title:'',subject,date:today(),time:'',duration:90,target:'',scope:'',notes:'',status:'计划中',...old};
  modal(old?'编辑考试':'添加一场考试',field('考试名称','title','text',v.title,'required maxlength="180"')+select('科目','subject',options())+
    `<div class="split"><div>${field('考试日期','date','date',v.date,'required')}</div><div>${field('开始时间（可选）','time','time',v.time)}</div></div>`+
    `<div class="split"><div>${field('时长（分钟）','duration','number',v.duration,'required min="1" max="480"')}</div><div>${select('状态','status','<option>计划中</option><option>已完成</option>')}</div></div>`+
    field('个人目标（可选）','target','text',v.target,'maxlength="200"')+area('考试范围与重点','scope',v.scope)+area('老师提醒、地点与准备事项','notes',v.notes),values=>{
      const obj={...values,duration:Number(values.duration)};
      if(id){const current=data.exams.find(e=>e.id===id);if(!current)throw Error('考试已被移除。');Object.assign(current,obj)}
      else data.exams.push({...obj,id:crypto.randomUUID()});
    });
  $('#f-subject').value=v.subject;$('#f-status').value=v.status;
}
function examCountdown(e) {
  if(e.status==='已完成')return '已完成';
  if(e.date<today())return '已过考试日期';
  const days=daysUntil(e.date);return days===0?'今天考试':'还有 '+days+' 天';
}
function examTaskPreview(exam) {
  return EXAM_PHASES.map(p=>({...p,date:dateAfter(-p.days,exam.date)<today()?today():dateAfter(-p.days,exam.date),title:(p.label+' · '+exam.title).slice(0,180),exists:data.tasks.some(t=>t.examId===exam.id&&t.examPhase===p.key)}));
}
function createExamTasks(id) {
  const exam=data.exams.find(e=>e.id===id);if(!exam)return;
  if(exam.status==='已完成'||exam.date<today()){toast('这场考试已结束，请先检查日期与状态。');return}
  const preview=examTaskPreview(exam);
  modal('把复习分成三步',`<p class="sub">${esc(exam.title)} · 考试日期 ${exam.date}</p><div class="exam-preview">${preview.map(p=>`<div><span class="tag">${p.date}</span><strong>${p.label}</strong><small>${p.exists?'已有对应任务，会保留原记录':p.notes}</small></div>`).join('')}</div><p class="sub">早于今天的安排会从今天开始；已有阶段不会重复创建。</p>`,()=>{
    const current=data.exams.find(e=>e.id===id);if(!current||current.status==='已完成'||current.date<today())throw Error('考试状态已变化，请重新检查。');
    for(const p of examTaskPreview(current))if(!p.exists)data.tasks.push({id:crypto.randomUUID(),examId:id,examPhase:p.key,title:p.title,subject:current.subject,date:p.date,priority:'重要',type:'复习',done:false,notes:(p.notes+'\n\n考试范围：\n'+current.scope).slice(0,100000)});
  });
  const button=$('#form button[type="submit"]');if(button)button.textContent='生成复习任务';
}
function examGrade(id) {
  const exam=data.exams.find(e=>e.id===id);if(!exam)return;
  const grade=data.grades.find(g=>g.examId===id);
  modal(grade?'更新考试成绩':'记录考试成绩',`<p class="sub">${esc(exam.title)} · ${esc(subjectName(exam.subject))}</p>`+field('测评日期','date','date',grade?.date||(exam.date<=today()?exam.date:today()),'required')+
    `<div class="split"><div>${field('IB 等级（1–7）','score','number',grade?.score||'','required min="1" max="7"')}</div><div>${field('原始分数（可选）','raw','text',grade?.raw||'','maxlength="100"')}</div></div>`+area('反馈与改进方向','notes',grade?.notes||''),v=>{
      const current=data.exams.find(e=>e.id===id);if(!current)throw Error('考试已被移除。');
      const record=data.grades.find(g=>g.examId===id),values={...v,title:current.title,subject:current.subject,score:Number(v.score),examId:id};
      if(record)Object.assign(record,values);else data.grades.push({...values,id:crypto.randomUUID()});current.status='已完成';
    });
}
function examsView() {
  const future=data.exams.filter(e=>e.status==='计划中'&&e.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  const list=data.exams.filter(e=>(!examSubject||e.subject===examSubject)&&(!examStatus||e.status===examStatus)).slice().sort((a,b)=>a.status===b.status?a.date.localeCompare(b.date):a.status==='计划中'?-1:1);
  return head('给考试前的每一天，一个方向。','记录自己的测评安排，再把范围、练习与最后检查拆成具体任务。')+
    `<section class="exam-hero"><div><span class="eyebrow">PREPARE WITH INTENTION</span><h2>${future[0]?esc(future[0].title):'从下一场考试开始。'}</h2><p>${future[0]?future[0].date+' · '+esc(subjectName(future[0].subject)):'添加日期、范围和目标，按自己的节奏准备。'}</p><button class="primary" id="add-exam">＋ 添加考试</button></div><div class="exam-count"><strong>${future[0]?daysUntil(future[0].date):'—'}</strong><span>${future[0]?'距离最近考试 / 天':'你的下一步，由你安排'}</span></div></section>
    <div class="week-toolbar"><div class="toolbar"><span class="tag">${future.length} 场待考</span><span class="tag blue">${data.exams.filter(e=>e.status==='已完成').length} 场已完成</span></div><div class="exam-filters"><select id="exam-subject" aria-label="筛选考试科目"><option value="">全部科目</option>${data.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><select id="exam-status" aria-label="筛选考试状态"><option value="">全部状态</option><option>计划中</option><option>已完成</option></select></div></div>
    <div class="exam-grid">${list.map(e=>`<article class="panel exam-card"><div class="panel-head"><span class="tag ${e.date<today()&&e.status!=='已完成'?'orange':''}">${examCountdown(e)}</span><button class="text-button" data-exam-edit="${e.id}">编辑</button></div><h2>${esc(e.title)}</h2><p class="sub">${esc(subjectName(e.subject))} · ${e.date}${e.time?' · '+e.time:''} · ${e.duration} 分钟</p>${e.target?`<p class="exam-target">我的目标：${esc(e.target)}</p>`:''}<details class="recall-note"><summary>考试范围与准备事项</summary><div class="note">${esc(e.scope)||'尚未填写范围。'}</div>${e.notes?`<div class="note">${esc(e.notes)}</div>`:''}</details><p class="sub">${data.tasks.filter(t=>t.examId===e.id&&t.done).length} / ${data.tasks.filter(t=>t.examId===e.id).length} 项复习任务已完成</p><div class="resource-actions">${e.status==='计划中'&&e.date>=today()?`<button class="primary" data-exam-tasks="${e.id}">生成三步复习任务</button>`:''}<button class="text-button" data-exam-grade="${e.id}">${data.grades.some(g=>g.examId===e.id)?'查看 / 更新成绩':'记录成绩'}</button><button class="delete" data-delete="exams:${e.id}" aria-label="删除考试">×</button></div></article>`).join('')||`<section class="panel" style="grid-column:1/-1">${empty('这里放下一场值得准备的考试','考试、课堂测验和模拟考试都可以记录。')}</section>`}</div>`;
}
function reflectionSummary(start) {
  const dates=Array.from({length:7},(_,i)=>dateAfter(i,start)),logs=data.logs.filter(l=>dates.includes(l.date)&&l.date<=today());
  const tasks=data.tasks.filter(t=>dates.includes(t.date));
  return {minutes:logs.reduce((n,l)=>n+l.minutes,0),days:new Set(logs.map(l=>l.date)).size,review:data.reviewHistory.filter(h=>dates.includes(h.date)&&h.date<=today()).length,tasks:tasks.length,done:tasks.filter(t=>t.done).length};
}
function reflectionEditor(id,start=weekDates(0)[0]) {
  const old=id?data.reflections.find(r=>r.id===id):data.reflections.find(r=>r.weekStart===start);
  if(id&&!old){toast('这份复盘已被移除。');return}
  const v={weekStart:start,title:'周复盘 · '+start,pace:'一般',wins:'',challenge:'',adjustment:'',next:'',...old},summary=reflectionSummary(v.weekStart);
  modal(old?'继续这一周的复盘':'留一份每周复盘',`<div class="reflection-snapshot"><span>${summary.minutes} 分钟学习</span><span>${summary.days} 个学习日</span><span>${summary.review} 次知识点复习</span></div>`+
    field('复盘标题','title','text',v.title,'required maxlength="180"')+field('这一周的周一','weekStart','date',v.weekStart,'required readonly')+select('这周的学习节奏','pace','<option>顺利</option><option>一般</option><option>需要调整</option>')+
    area('这周理解更清楚了什么？','wins',v.wins)+area('哪里卡住了，原因可能是什么？','challenge',v.challenge)+area('下周准备调整什么方法？','adjustment',v.adjustment)+area('一个可以开始的具体行动','next',v.next),values=>{
      if(data.reflections.some(r=>r.weekStart===values.weekStart&&r.id!==old?.id))throw Error('这一周已有复盘，请打开原记录继续编辑。');
      if(old){const current=data.reflections.find(r=>r.id===old.id);if(!current)throw Error('这份复盘已被移除。');Object.assign(current,values)}
      else data.reflections.push({...values,id:crypto.randomUUID(),subject:'',date:today(),notes:''});
    });
  $('#f-pace').value=v.pace;
}
function reflectionTask(id) {
  const r=data.reflections.find(r=>r.id===id);if(!r)return;
  if(!r.next.trim()){toast('先在复盘中写下一个具体行动。');return}
  const old=data.tasks.find(t=>t.reflectionId===id&&!t.done);if(old){add('tasks',old.id);return}
  modal('把复盘变成一个行动',field('任务名称','title','text',r.next.split('\n')[0].slice(0,180),'required maxlength="180"')+field('计划日期','date','date',today(),'required')+area('行动内容','notes',r.next),v=>{
    if(!data.reflections.some(r=>r.id===id))throw Error('复盘已被移除。');
    if(!data.tasks.some(t=>t.reflectionId===id&&!t.done))data.tasks.push({...v,id:crypto.randomUUID(),reflectionId:id,subject:'',type:'复习',priority:'普通',done:false});
  });
}
function reflectionsView() {
  const dates=weekDates(reflectionOffset),summary=reflectionSummary(dates[0]),current=data.reflections.find(r=>r.weekStart===dates[0]);
  return head('慢下来，看清下一步。','用真实记录回顾这一周，再留下一个能够执行的行动。')+
    `<section class="reflection-hero"><div><span class="eyebrow">LOOK BACK · MAKE SPACE · MOVE FORWARD</span><h2>进步，也需要回头看一看。</h2><p>收获、卡点与调整，都值得留下一句话。</p></div><button class="primary" id="write-reflection">${current?'继续本周复盘':'记录这一周'}</button></section><div class="week-toolbar"><div class="toolbar"><button id="reflection-prev" aria-label="上一周">←</button><h2>${dates[0]} — ${dates[6]}</h2><button id="reflection-next" aria-label="下一周">→</button><button class="outline" id="reflection-now">本周</button></div><span class="tag">${current?'这周已有复盘':'这周尚未复盘'}</span></div>
    <div class="stats"><div class="stat"><span class="stat-label">这一周学习</span><strong>${summary.minutes} <small>分钟</small></strong></div><div class="stat"><span class="stat-label">有记录的学习日</span><strong>${summary.days} <small>天</small></strong></div><div class="stat"><span class="stat-label">知识点复习</span><strong>${summary.review} <small>次</small></strong></div><div class="stat"><span class="stat-label">本周截止的任务</span><strong>${summary.done} <small>/ ${summary.tasks} 已完成</small></strong></div></div>
    <div class="section-title"><h2>我的复盘记录</h2><span class="sub">按周保存，可以随时继续编辑。</span></div><div class="reflection-grid">${data.reflections.slice().sort((a,b)=>b.weekStart.localeCompare(a.weekStart)).map(r=>`<article class="panel reflection-card"><div class="panel-head"><span class="tag">${r.weekStart}</span><button class="text-button" data-reflection-edit="${r.id}">编辑</button></div><h2>${esc(r.title)}</h2><p class="sub">学习节奏：${r.pace}</p>${[['wins','这一周的收获'],['challenge','遇到的卡点'],['adjustment','准备做的调整'],['next','下一步行动']].filter(([key])=>r[key]).map(([key,label])=>`<h4>${label}</h4><div class="note">${esc(r[key])}</div>`).join('')}<div class="resource-actions">${r.next.trim()?`<button class="primary" data-reflection-task="${r.id}">把下一步变成任务</button>`:''}<button class="delete" data-delete="reflections:${r.id}" aria-label="删除周复盘">×</button></div></article>`).join('')||`<section class="panel" style="grid-column:1/-1">${empty('不用写得完整，从一句话开始','这周学会了什么？哪里需要换一种做法？')}</section>`}</div>`;
}
function progressDashboard() {
  const next=data.exams.filter(e=>e.status==='计划中'&&e.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time))[0];
  const reflection=data.reflections.find(r=>r.weekStart===weekDates(0)[0]);
  return `<div class="progress-dashboard"><a href="#exams"><span>▣ 下一场考试</span><strong>${next?esc(next.title):'为下一场测评留个位置'}</strong><small>${next?next.date+' · '+examCountdown(next):'添加日期与范围，再拆成复习任务'} →</small></a><a href="#reflections"><span>✧ 本周复盘</span><strong>${reflection?'留意你已经走过的路':'这一周，有什么值得留下？'}</strong><small>${reflection?'已记录，可以继续补充':'记录收获、卡点与下一步行动'} →</small></a></div>`;
}
function bindProgress() {
  if(examSubject&&!data.subjects.some(s=>s.id===examSubject))examSubject='';
  if($('#add-exam'))$('#add-exam').onclick=()=>examEditor();
  document.querySelectorAll('[data-exam-edit]').forEach(el=>el.onclick=()=>examEditor(el.dataset.examEdit));
  document.querySelectorAll('[data-exam-tasks]').forEach(el=>el.onclick=()=>createExamTasks(el.dataset.examTasks));
  document.querySelectorAll('[data-exam-grade]').forEach(el=>el.onclick=()=>examGrade(el.dataset.examGrade));
  for(const [id,value,set] of [['exam-subject',examSubject,v=>examSubject=v],['exam-status',examStatus,v=>examStatus=v]])if($('#'+id)){$('#'+id).value=value;$('#'+id).onchange=e=>{set(e.target.value);render()}};
  if($('#write-reflection'))$('#write-reflection').onclick=()=>reflectionEditor(null,weekDates(reflectionOffset)[0]);
  document.querySelectorAll('[data-reflection-edit]').forEach(el=>el.onclick=()=>reflectionEditor(el.dataset.reflectionEdit));
  document.querySelectorAll('[data-reflection-task]').forEach(el=>el.onclick=()=>reflectionTask(el.dataset.reflectionTask));
  for(const [id,offset] of [['reflection-prev',-1],['reflection-next',1]])if($('#'+id))$('#'+id).onclick=()=>{reflectionOffset+=offset;render()};
  if($('#reflection-now'))$('#reflection-now').onclick=()=>{reflectionOffset=0;render()};
}
