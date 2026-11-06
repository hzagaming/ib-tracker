'use strict';

// Study tools share the application's validated, browser-local data store.
let plannerOffset=0,reviewScope='due',reviewSubject='',libraryQuery='',librarySubject='',libraryKind='';
const STUDY_GUIDES=[
  {key:'retrieval',icon:'↻',title:'把一章变成五个问题',kind:'笔记',summary:'用自己的问题，检查自己真正理解了什么。',notes:'1. 读完一小节后，合上资料。\n2. 写下五个「为什么 / 怎样 / 有什么限制」的问题。\n3. 不看笔记，用自己的话回答。\n4. 对照资料，补上遗漏与误解。\n5. 把最难的问题加入知识点，并安排下次复习。\n\n我的五个问题：\n1.\n2.\n3.\n4.\n5.'},
  {key:'mistakes',icon:'∑',title:'让错题成为下一次的线索',kind:'题目',summary:'保留出错原因，而不只是抄下正确答案。',notes:'题目 / 来源：\n我的原思路：\n卡住的步骤：\n原因（概念 / 方法 / 审题 / 计算 / 表达）：\n修正后的解法：\n下次看到同类问题，我会先检查：\n\n复习时遮住解答，重新完成一次，再比较思路。'},
  {key:'weekly',icon:'▥',title:'十分钟周复盘',kind:'笔记',summary:'把已经做过的事，变成下一周的方向。',notes:'这一周，我理解得更清楚的三个概念：\n1.\n2.\n3.\n\n最值得保留的一种学习方法：\n还没有解决的一个问题：\n哪些计划太满，哪些时间被低估了：\n\n下周最重要的三个行动：\n1.\n2.\n3.\n\n为第一个行动，在每周计划中留出时间。'},
  {key:'writing',icon:'Aa',title:'从证据走向分析',kind:'笔记',summary:'适用于阅读、写作与讨论的分析提纲。',notes:'我的观点：\n文本 / 案例 / 数据中的具体证据：\n证据如何支持观点：\n还有什么不同的解释：\n这一解释有哪些限制：\n\n修改检查：\n□ 我是否回答了题目？\n□ 引用之后是否有自己的分析？\n□ 术语与例子是否准确？\n□ 结尾是否回应了开头的问题？'},
  {key:'models',icon:'◎',title:'概念、模型与适用边界',kind:'笔记',summary:'把公式和定义放回它们所解释的问题中。',notes:'概念 / 模型名称：\n它试图解释什么：\n关键变量与单位：\n前提与假设：\n一个具体例子：\n一个可能不适用的情境：\n\n如果我需要教会另一个人，我会这样解释：'},
  {key:'research',icon:'◇',title:'研究问题工作卡',kind:'笔记',summary:'帮助你缩小研究范围，规划下一次行动。',notes:'目前的研究问题：\n为什么这个问题值得研究：\n我需要什么证据：\n已有的资料 / 来源：\n如何判断来源是否可靠：\n研究范围与现实限制：\n需要向老师确认的问题：\n\n下一次行动（具体到可以开始的一步）：\n计划完成日期：\n\n此工作卡用于个人整理，具体项目要求请与老师及对应指南核对。'}
];

function validateStudy(d,ids,subjectIds) {
  const text=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0);
  const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
  validateInsights(d,ids,subjectIds);
  if(d.profile.weeklyGoal!==undefined&&(!Number.isInteger(d.profile.weeklyGoal)||d.profile.weeklyGoal<1||d.profile.weeklyGoal>10080))throw Error('每周目标须为 1–10080 分钟');
  for(const key of ['plans','resources','reviewHistory']){
    const list=d[key]??[];
    if(!Array.isArray(list)||list.length>10000)throw Error('学习计划、资料或复习记录格式不正确');
    for(const x of list){
      if(!x||!id(x.id)||ids.has(x.id)||typeof x.subject!=='string'||(x.subject!==''&&!subjectIds.has(x.subject)))throw Error('学习记录 ID 或科目不正确');
      ids.add(x.id);
      if(!text(x.title,180,true)||!text(x.notes??'',100000))throw Error('学习记录名称或笔记不正确');
      if(key==='plans'&&(!validDate(x.date)||!Number.isInteger(x.minutes)||x.minutes<1||x.minutes>480||typeof x.done!=='boolean'||typeof x.time!=='string'||(x.time!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time))))throw Error('计划日期、时间或时长不正确');
      if(key==='resources'&&(!['笔记','题目','文章','视频','其他'].includes(x.kind)||typeof x.favorite!=='boolean'||typeof x.url!=='string'||(x.url!==''&&!safeResourceURL(x.url))||(!x.url&&!(x.notes??'').trim())||!text(x.url,2000)))throw Error('资料需要有效的网址或笔记，仅支持 HTTP / HTTPS 链接');
      if(key==='reviewHistory'&&(!id(x.topic)||!validDate(x.date)||!['again','okay','good'].includes(x.rating)||!Number.isInteger(x.interval)||x.interval<1||x.interval>90))throw Error('复习记录格式不正确');
    }
  }
}
function safeResourceURL(raw) {
  try {const u=new URL(raw);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password}catch{return false}
}
function dateAfter(days,date=today()) {
  const [y,m,d]=date.split('-').map(Number);
  return localDate(new Date(y,m-1,d+days,12));
}
function weekDates(offset=plannerOffset) {
  const now=new Date(),monday=new Date(now.getFullYear(),now.getMonth(),now.getDate()-(now.getDay()+6)%7+offset*7,12);
  return Array.from({length:7},(_,i)=>dateAfter(i,localDate(monday)));
}
function studyEditor(kind,id,defaults={}) {
  focusDraft=false;
  const key=kind==='plan'?'plans':'resources',old=data[key].find(x=>x.id===id);
  const v={subject:'',date:today(),time:'',minutes:30,notes:'',title:'',kind:'笔记',url:'',...defaults,...old};
  let form=field(kind==='plan'?'这段时间要做什么？':'资料名称','title','text',v.title,'required maxlength="180"')+select('关联科目','subject',options());
  if(kind==='plan')form+=`<div class="split"><div>${field('学习日期','date','date',v.date,'required')}</div><div>${field('开始时间（可选）','time','time',v.time)}</div></div>`+field('计划时长（分钟）','minutes','number',v.minutes,'required min="1" max="480"')+area('具体目标与准备事项','notes',v.notes);
  else form+=select('资料类型','kind',['笔记','题目','文章','视频','其他'].map(k=>`<option>${k}</option>`).join(''))+field('链接（可选，HTTP / HTTPS）','url','url',v.url,'maxlength="2000"')+area('笔记、用途与来源','notes',v.notes)+'<p class="sub">链接与笔记至少填写一项。</p>';
  modal(old?'编辑'+(kind==='plan'?'学习计划':'学习资料'):kind==='plan'?'安排一段学习':'收藏学习资料',form,values=>{
    const obj=kind==='plan'?{...values,minutes:Number(values.minutes),done:old?.done??false}:{...values,url:values.url.trim()?(safeResourceURL(values.url.trim())?new URL(values.url.trim()).href:values.url.trim()):'',favorite:old?.favorite??false};
    if(id){const current=data[key].find(x=>x.id===id);if(!current)throw Error('此记录已被移除。');Object.assign(current,obj)}
    else data[key].push({...obj,id:crypto.randomUUID()});
  });
  $('#f-subject').value=v.subject;
  if(kind==='resource')$('#f-kind').value=v.kind;
}
function plannerView() {
  const dates=weekDates(),plans=data.plans.filter(p=>dates.includes(p.date));
  const total=plans.reduce((n,p)=>n+p.minutes,0),done=plans.filter(p=>p.done).length;
  const actual=data.logs.filter(l=>dates.includes(l.date)).reduce((n,l)=>n+l.minutes,0),goal=data.profile.weeklyGoal??300;
  return head('为学习，留出时间。','先安排可以开始的一小步。完成计划后，可直接记录真实学习时间。')+
    `<section class="planner-banner"><div><span class="eyebrow">A WEEK WITH INTENTION</span><h2>不必排满，留一点余地。</h2><p>计划时间帮助你安排，学习日志记录实际投入。</p><button class="primary" data-study-add="plan">＋ 安排学习</button></div><div class="weekly-meter"><span>${plannerOffset===0?'本周':'所选周'}目标进度</span><strong>${actual}<small> / ${goal} 分钟</small></strong><div class="progress"><i style="width:${Math.min(100,actual/goal*100)}%"></i></div><a href="#settings">调整每周目标 ↗</a></div></section>
    <div class="week-toolbar"><div class="toolbar"><button id="week-prev" aria-label="上一周">←</button><h2>${dates[0]} — ${dates[6]}</h2><button id="week-next" aria-label="下一周">→</button><button class="outline" id="week-now">本周</button></div><span class="sub">已完成 ${done}/${plans.length} 项 · 计划 ${total} 分钟</span></div>
    <div class="planner-grid">${dates.map((date,i)=>{const list=plans.filter(p=>p.date===date).sort((a,b)=>a.time.localeCompare(b.time));return `<section class="plan-day ${date===today()?'today':''}"><div class="plan-day-head"><span>周${'一二三四五六日'[i]}</span><strong>${Number(date.slice(8))}</strong><small>${list.reduce((n,p)=>n+p.minutes,0)} 分钟</small></div>${list.map(p=>`<article class="plan-item ${p.done?'completed':''}"><span class="plan-time">${p.time||'灵活安排'} · ${p.minutes} 分钟</span><button class="plan-title" data-plan-edit="${p.id}">${esc(p.title)}</button><small>${esc(subjectName(p.subject))}</small>${p.notes?`<details class="note-details"><summary>学习目标</summary><div class="note">${esc(p.notes)}</div></details>`:''}<div class="plan-item-actions">${p.done?'<span class="tag">✓ 已完成</span>':`<button data-plan-complete="${p.id}">完成并记录 ↗</button>`}<button class="delete" data-delete="plans:${p.id}" aria-label="删除学习计划">×</button></div></article>`).join('')}<button class="plan-add" data-plan-date="${date}">＋ 安排学习</button></section>`}).join('')}</div>`;
}
function completePlan(id) {
  const plan=data.plans.find(p=>p.id===id);if(!plan||plan.done)return;
  modal('完成这段学习',`<p class="sub">${esc(plan.title)} · 原计划 ${plan.minutes} 分钟</p>`+field('实际学习日期','date','date',today(),'required')+field('实际学习时长（分钟）','minutes','number',plan.minutes,'required min="1" max="1440"')+area('收获、问题与下一步','notes',plan.notes),v=>{
    const current=data.plans.find(p=>p.id===id);if(!current)throw Error('计划已被移除。');
    if(!data.logs.some(l=>l.planId===id))data.logs.push({id:crypto.randomUUID(),planId:id,title:current.title,subject:current.subject,date:v.date,minutes:Number(v.minutes),notes:v.notes});
    current.done=true;
  });
}
function scheduledReview(t){return Boolean(t.review&&(t.status!=='mastered'||t.reviewActive===true))}
function reviewView() {
  const due=data.topics.filter(t=>scheduledReview(t)&&t.review<=today());
  let topics=data.topics.filter(t=>reviewScope==='due'?due.includes(t):reviewScope==='upcoming'?scheduledReview(t)&&t.review>today():true);
  if(reviewSubject)topics=topics.filter(t=>t.subject===reviewSubject);
  topics.sort((a,b)=>(a.review||'9999').localeCompare(b.review||'9999'));
  const count=data.reviewHistory.filter(h=>h.date===today()).length;
  return head('让知识，再次连接。','先尝试不看笔记回答，再根据自己的掌握程度安排下一次复习。')+
    `<div class="review-summary"><div><span class="eyebrow">RECALL · CHECK · RETURN</span><h2>${due.length?'有 '+due.length+' 个知识点等你回来。':'今天，也可以从一个问题开始。'}</h2><p>这些是你的个人复习安排，间隔可在知识点中随时调整。</p></div><div><strong>${count}</strong><span>今日复习次数</span></div></div>
    <div class="week-toolbar"><div class="task-tabs">${[['due','到期复习'],['upcoming','即将复习'],['all','全部知识点']].map(([v,n])=>`<button data-review-scope="${v}" class="${reviewScope===v?'selected':''}" aria-pressed="${reviewScope===v}">${n}</button>`).join('')}</div><select id="review-subject" aria-label="筛选复习科目"><option value="">全部科目</option>${data.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
    <div class="review-grid">${topics.map(t=>`<article class="panel review-card"><div class="panel-head"><span class="tag">${esc(subjectName(t.subject))}</span><button class="text-button" data-review-edit="${t.id}">编辑</button></div><h2>${esc(t.title)}</h2><p class="sub">${t.review?'计划复习 '+esc(t.review):'尚未设置复习日期'} · ${t.status==='mastered'?'已掌握':'已复习 '+data.reviewHistory.filter(h=>h.topic===t.id).length+' 次'}</p><details class="recall-note"><summary>尝试回想后，展开笔记核对</summary><div class="note">${esc(t.notes)||'暂无笔记。可以编辑知识点，写下关键问题与自己的解释。'}</div></details><p class="rating-label">这一次，你感觉如何？</p><div class="review-ratings"><button data-review-rate="${t.id}:again">还需巩固<small>明天再看</small></button><button data-review-rate="${t.id}:okay">基本理解<small>3 天后</small></button><button data-review-rate="${t.id}:good">掌握较好<small>7 天后</small></button></div><a class="text-button" href="#subject/${t.subject}">进入学科 →</a></article>`).join('')||`<section class="panel" style="grid-column:1/-1">${empty('给记忆留一点时间','在学科中添加知识点与复习日期，这里会汇总你的安排。')}<a class="outline button-link" href="#subjects">进入我的学科 →</a></section>`}</div>`;
}
function rateReview(id,rating) {
  const topic=data.topics.find(t=>t.id===id);if(!topic)return;
  const interval={again:1,okay:3,good:7}[rating];if(!interval)return;
  const before={...topic,reviewActive:topic.reviewActive??false},historyId=crypto.randomUUID();
  if(!mutate(()=>{topic.review=dateAfter(interval);topic.reviewActive=true;topic.status=rating==='good'?'mastered':'review';data.reviewHistory.push({id:historyId,topic:id,title:topic.title,subject:topic.subject,date:today(),rating,interval,notes:''})}))return;
  render();toast('已记录，下次复习 '+dateAfter(interval),()=>{
    if(mutate(()=>{const current=data.topics.find(t=>t.id===id);if(current)Object.assign(current,before);data.reviewHistory=data.reviewHistory.filter(h=>h.id!==historyId)})){render();toast('已撤销本次复习')}
  });
}
function libraryView() {
  return head('把有用的资料，留在手边。','整理课程笔记、题目、文章与视频，让每一次查找更轻松。')+
    `<div class="library-heading"><div><span class="tag">${data.resources.length} 份资料</span><span class="tag blue">${data.resources.filter(r=>r.favorite).length} 份星标</span></div><button class="primary" data-study-add="resource">＋ 收藏资料</button></div>
    <div class="filters library-filters"><input id="library-query" placeholder="搜索标题、笔记或科目…" value="${esc(libraryQuery)}" aria-label="搜索学习资料"><select id="library-subject" aria-label="筛选资料科目"><option value="">全部科目</option>${data.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><select id="library-kind" aria-label="筛选资料类型"><option value="">全部类型</option>${['笔记','题目','文章','视频','其他'].map(k=>`<option>${k}</option>`).join('')}</select></div><div id="library-results" class="resource-grid"></div>
    <div class="section-title"><div><h2>给学习多一种方法</h2><p class="sub">可收藏、可编辑的个人学习工作卡。</p></div><span class="tag">6 张工作卡</span></div><div class="guide-grid">${STUDY_GUIDES.map(g=>`<article class="guide-card"><span class="guide-icon">${g.icon}</span><h3>${g.title}</h3><p>${g.summary}</p><details><summary>展开工作卡</summary><div class="note">${esc(g.notes)}</div></details><button class="text-button" data-guide-save="${g.key}">${data.resources.some(r=>r.guide===g.key)?'已收藏 · 打开':'＋ 收藏到我的资料'}</button></article>`).join('')}</div>`;
}
function renderLibraryResults() {
  const box=$('#library-results');if(!box)return;
  const query=libraryQuery.trim().toLowerCase();
  const list=data.resources.filter(r=>(!librarySubject||r.subject===librarySubject)&&(!libraryKind||r.kind===libraryKind)&&(r.title+' '+r.notes+' '+subjectName(r.subject)).toLowerCase().includes(query)).sort((a,b)=>Number(b.favorite)-Number(a.favorite));
  box.innerHTML=list.map(r=>`<article class="panel resource-card"><div class="panel-head"><span class="tag">${esc(r.kind)}</span><button class="star-button ${r.favorite?'starred':''}" data-resource-star="${r.id}" aria-label="${r.favorite?'取消星标':'添加星标'} ${esc(r.title)}" aria-pressed="${r.favorite}">${r.favorite?'★':'☆'}</button></div><h3>${esc(r.title)}</h3><p class="sub">${esc(subjectName(r.subject))}</p>${r.notes?`<details class="note-details"><summary>查看笔记与来源</summary><div class="note">${esc(r.notes)}</div></details>`:''}<div class="resource-actions">${r.url?`<a class="outline button-link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">打开资料 ↗</a>`:''}<button class="text-button" data-resource-edit="${r.id}">编辑</button><button class="delete" data-delete="resources:${r.id}" aria-label="删除学习资料">×</button></div></article>`).join('')||`<section class="panel" style="grid-column:1/-1">${empty(data.resources.length?'没有匹配的资料':'先留下一份有用的资料',data.resources.length?'试试其他科目、类型或关键词。':'收藏链接、保存笔记，或从下方工作卡开始。')}</section>`;
  bindResourceRows();bindRows();
}
function saveGuide(key) {
  const guide=STUDY_GUIDES.find(g=>g.key===key);if(!guide)return;
  const old=data.resources.find(r=>r.guide===key);
  if(old){studyEditor('resource',old.id);return}
  if(mutate(()=>data.resources.push({id:crypto.randomUUID(),guide:key,title:guide.title,subject:'',kind:guide.kind,url:'',notes:guide.notes,favorite:false}))){render();toast('工作卡已收藏，可以按自己的方式编辑。')}
}
function bindResourceRows() {
  document.querySelectorAll('[data-resource-edit]').forEach(el=>el.onclick=()=>studyEditor('resource',el.dataset.resourceEdit));
  document.querySelectorAll('[data-resource-star]').forEach(el=>el.onclick=()=>{if(mutate(()=>{const r=data.resources.find(r=>r.id===el.dataset.resourceStar);r.favorite=!r.favorite}))render()});
}
function studyDashboard() {
  const plans=data.plans.filter(p=>p.date===today()&&!p.done).sort((a,b)=>a.time.localeCompare(b.time));
  return `<div class="study-shortcuts"><a href="#planner"><span>▥</span><strong>每周计划</strong><small>今天 ${plans.length} 段待学习</small></a><a href="#review"><span>↻</span><strong>复习中心</strong><small>回想 · 核对 · 再安排</small></a><a href="#library"><span>▧</span><strong>学习资料库</strong><small>${data.resources.length} 份资料与工作卡</small></a><a href="#mistakes"><span>✎</span><strong>错题本</strong><small>${data.mistakes.filter(m=>m.status!=='已掌握').length} 道题待回顾</small></a><a href="#analytics"><span>◴</span><strong>学习分析</strong><small>看见投入、分布与变化</small></a><a href="#search"><span>⌕</span><strong>搜索记录</strong><small>Ctrl / ⌘ K 快速打开</small></a></div>`;
}
function bindStudy() {
  document.querySelectorAll('[data-study-add]').forEach(el=>el.onclick=()=>studyEditor(el.dataset.studyAdd));
  document.querySelectorAll('[data-plan-date]').forEach(el=>el.onclick=()=>studyEditor('plan',null,{date:el.dataset.planDate}));
  document.querySelectorAll('[data-plan-edit]').forEach(el=>el.onclick=()=>studyEditor('plan',el.dataset.planEdit));
  document.querySelectorAll('[data-plan-complete]').forEach(el=>el.onclick=()=>completePlan(el.dataset.planComplete));
  document.querySelectorAll('[data-study-quick]').forEach(el=>el.onclick=()=>{
    const kind=el.dataset.studyQuick,subject=el.dataset.studySubject;
    if(['plan','resource'].includes(kind))studyEditor(kind,null,{subject});else{add(kind);$('#f-subject').value=subject}
  });
  for(const [id,offset] of [['week-prev',-1],['week-next',1]])if($('#'+id))$('#'+id).onclick=()=>{plannerOffset+=offset;render()};
  if($('#week-now'))$('#week-now').onclick=()=>{plannerOffset=0;render()};
  document.querySelectorAll('[data-review-scope]').forEach(el=>el.onclick=()=>{reviewScope=el.dataset.reviewScope;render()});
  document.querySelectorAll('[data-review-edit]').forEach(el=>el.onclick=()=>{const t=data.topics.find(t=>t.id===el.dataset.reviewEdit);if(t)topicEditor(t.subject,t.id)});
  document.querySelectorAll('[data-review-rate]').forEach(el=>el.onclick=()=>{const[id,rating]=el.dataset.reviewRate.split(':');rateReview(id,rating)});
  if($('#review-subject')){$('#review-subject').value=reviewSubject;$('#review-subject').onchange=e=>{reviewSubject=e.target.value;render()}};
  for(const [id,value,set] of [['library-subject',librarySubject,v=>librarySubject=v],['library-kind',libraryKind,v=>libraryKind=v]])if($('#'+id)){$('#'+id).value=value;$('#'+id).onchange=e=>{set(e.target.value);renderLibraryResults()}};
  if($('#library-query'))$('#library-query').oninput=e=>{libraryQuery=e.target.value;renderLibraryResults()};
  document.querySelectorAll('[data-guide-save]').forEach(el=>el.onclick=()=>saveGuide(el.dataset.guideSave));
  renderLibraryResults();
}

function reconcileStudyFilters(){if(examSubject&&!data.subjects.some(s=>s.id===examSubject))examSubject='';if(reviewSubject&&!data.subjects.some(s=>s.id===reviewSubject))reviewSubject='';if(librarySubject&&!data.subjects.some(s=>s.id===librarySubject))librarySubject=''}
