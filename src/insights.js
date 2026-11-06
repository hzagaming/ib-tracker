'use strict';

let mistakeQuery='',mistakeSubject='',mistakeStatus='',analysisDays=30,globalQuery='',globalKind='',globalLimit=60;
const MISTAKE_CAUSES=['概念理解','审题','方法选择','计算','表达','其他'];
const SEARCH_TYPES={subjects:'学科',topics:'知识点',tasks:'任务',logs:'学习日志',grades:'成绩',core:'核心项目',plans:'学习计划',resources:'学习资料',mistakes:'错题'};

function validateInsights(d,ids,subjectIds) {
  const list=d.mistakes??[],id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
  const text=(v,max)=>typeof v==='string'&&v.length<=max;
  if(!Array.isArray(list)||list.length>10000)throw Error('错题记录格式不正确');
  for(const x of list){
    if(!x||!id(x.id)||ids.has(x.id))throw Error('错题 ID 无效或重复');
    ids.add(x.id);
    if(!text(x.title,180)||!x.title.trim()||typeof x.subject!=='string'||(x.subject!==''&&!subjectIds.has(x.subject))||!validDate(x.date)||!validDate(x.review,true)||!['待订正','待重做','已掌握'].includes(x.status)||!MISTAKE_CAUSES.includes(x.cause))throw Error('错题名称、日期、科目或状态不正确');
    for(const key of ['question','original','correction','notes'])if(!text(x[key],100000))throw Error('错题内容格式不正确');
    if(!text(x.source,500)||!Array.isArray(x.attempts)||x.attempts.length>500)throw Error('错题来源或重做记录不正确');
    for(const a of x.attempts)if(!a||!validDate(a.date)||!['again','solved'].includes(a.result)||!text(a.notes,100000))throw Error('重做记录格式不正确');
  }
}
function mistakeEditor(id,subject='') {
  focusDraft=false;
  const old=data.mistakes.find(m=>m.id===id),v={title:'',subject,date:today(),review:'',cause:'概念理解',status:'待订正',question:'',original:'',correction:'',notes:'',source:'',...old};
  modal(old?'编辑错题':'记录一道错题',field('题目 / 知识点','title','text',v.title,'required maxlength="180"')+select('科目','subject',options())+
    `<div class="split"><div>${field('记录日期','date','date',v.date,'required')}</div><div>${field('下次重做（可选）','review','date',v.review)}</div></div>`+
    `<div class="split"><div>${select('主要原因','cause',MISTAKE_CAUSES.map(c=>`<option>${c}</option>`).join(''))}</div><div>${select('当前状态','status',['待订正','待重做','已掌握'].map(s=>`<option>${s}</option>`).join(''))}</div></div>`+
    field('题目来源（如试卷、页码）','source','text',v.source,'maxlength="500"')+area('题目与关键条件','question',v.question)+area('我的原思路 / 错误步骤','original',v.original)+area('订正思路与解答','correction',v.correction)+area('下次需要检查什么？','notes',v.notes),values=>{
      if(id){const current=data.mistakes.find(m=>m.id===id);if(!current)throw Error('此错题已被移除。');Object.assign(current,values)}
      else data.mistakes.push({...values,id:crypto.randomUUID(),attempts:[]});
    });
  for(const key of ['subject','cause','status'])$('#f-'+key).value=v[key];
}
function mistakesView() {
  const open=data.mistakes.filter(m=>m.status!=='已掌握'),due=open.filter(m=>m.review&&m.review<=today());
  return head('让每一次出错，都有下文。','记录原因、遮住解答重做，再检查自己的思路。')+
    `<div class="mistake-intro"><div><span class="eyebrow">NOTICE · CORRECT · RETRY</span><h2>${open.length?'还有 '+open.length+' 道题值得再试一次。':'从一道值得回看的题开始。'}</h2><p>不是只留答案，而是留下下次能用上的方法。</p></div><button class="primary" id="add-mistake">＋ 记录错题</button></div>
    <div class="stats"><div class="stat"><span class="stat-label">错题总数</span><strong>${data.mistakes.length}</strong></div><div class="stat"><span class="stat-label">待订正 / 重做</span><strong>${open.length}</strong></div><div class="stat"><span class="stat-label">到期重做</span><strong>${due.length}</strong></div><div class="stat"><span class="stat-label">已掌握</span><strong>${data.mistakes.length-open.length}</strong></div></div>
    <div class="filters"><input id="mistake-query" placeholder="搜索题目、原因或订正内容…" value="${esc(mistakeQuery)}" aria-label="搜索错题"><select id="mistake-subject" aria-label="筛选错题科目"><option value="">全部科目</option>${data.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><select id="mistake-status" aria-label="筛选错题状态"><option value="">全部状态</option>${['待订正','待重做','已掌握'].map(s=>`<option>${s}</option>`).join('')}</select></div><div id="mistake-results" class="mistake-grid"></div>`;
}
function renderMistakeResults() {
  const box=$('#mistake-results');if(!box)return;
  const query=mistakeQuery.trim().toLowerCase();
  const list=data.mistakes.filter(m=>(!mistakeSubject||m.subject===mistakeSubject)&&(!mistakeStatus||m.status===mistakeStatus)&&[m.title,m.question,m.original,m.correction,m.notes,m.cause,m.source,subjectName(m.subject)].join(' ').toLowerCase().includes(query)).slice().reverse().sort((a,b)=>b.date.localeCompare(a.date));
  box.innerHTML=list.map(m=>`<article class="panel mistake-card"><div class="panel-head"><span class="tag ${m.status==='已掌握'?'':'orange'}">${esc(m.status)}</span><button class="text-button" data-mistake-edit="${m.id}">编辑</button></div><h2>${esc(m.title)}</h2><p class="sub">${esc(subjectName(m.subject))} · ${esc(m.date)}</p><div class="mistake-meta"><span class="tag blue">${esc(m.cause)}</span><span>${m.attempts.length} 次重做${m.review?' · 下次 '+esc(m.review):''}</span></div>${m.question?`<div class="mistake-question">${esc(m.question)}</div>`:''}<details class="recall-note"><summary>展开原思路、订正与检查要点</summary><h4>原思路</h4><div class="note">${esc(m.original)||'尚未记录'}</div><h4>订正</h4><div class="note">${esc(m.correction)||'尚未记录'}</div><h4>检查要点</h4><div class="note">${esc(m.notes)||'尚未记录'}</div>${m.source?`<p class="sub">来源：${esc(m.source)}</p>`:''}</details>${m.attempts.length?`<details class="note-details"><summary>重做记录（${m.attempts.length}）</summary>${m.attempts.slice().reverse().map(a=>`<div class="attempt-row"><span>${esc(a.date)} · ${a.result==='solved'?'独立完成':'还需巩固'}</span><div class="note">${esc(a.notes)}</div></div>`).join('')}</details>`:''}<div class="resource-actions"><button class="primary" data-mistake-retry="${m.id}">记录重做</button><button class="text-button" data-mistake-task="${m.id}">安排复习任务</button><button class="delete" data-delete="mistakes:${m.id}" aria-label="删除错题">×</button></div></article>`).join('')||`<section class="panel" style="grid-column:1/-1">${empty(data.mistakes.length?'没有匹配的错题':'先记录一个卡住你的问题','整理出错原因、订正思路与下一次行动。')}</section>`;
  bindMistakeRows();bindRows();
}
function recordRetry(id) {
  const m=data.mistakes.find(m=>m.id===id);if(!m)return;focusDraft=false;
  modal('重做之后，留下一个判断',`<p class="sub">${esc(m.title)}</p>`+field('重做日期','date','date',today(),'required')+select('这次的结果','result','<option value="again">还需要巩固，3 天后重做</option><option value="solved">能够独立完成</option>')+area('思路有什么变化？仍卡在哪里？','notes'),v=>{
    const current=data.mistakes.find(x=>x.id===id);if(!current)throw Error('此错题已被移除。');
    current.attempts.push({date:v.date,result:v.result,notes:v.notes});
    current.status=v.result==='solved'?'已掌握':'待重做';current.review=v.result==='solved'?'':dateAfter(3,v.date);
  });
}
function mistakeTask(id) {
  const m=data.mistakes.find(m=>m.id===id);if(!m)return;
  const existing=data.tasks.find(t=>t.mistakeId===id&&!t.done);
  if(existing){add('tasks',existing.id);return}
  modal('把错题安排进下一次复习',field('任务名称','title','text','重做：'+m.title.slice(0,176),'required maxlength="180"')+field('计划日期','date','date',m.review||today(),'required')+area('重做时要检查的内容','notes',m.notes||m.question),v=>{
    const current=data.mistakes.find(x=>x.id===id);if(!current)throw Error('此错题已被移除。');
    if(!data.tasks.some(t=>t.mistakeId===id&&!t.done))data.tasks.push({...v,id:crypto.randomUUID(),mistakeId:id,subject:current.subject,type:'复习',priority:'普通',done:false});
  });
}
function analysisSnapshot(days=analysisDays) {
  const start=dateAfter(-(days-1)),end=today(),logs=data.logs.filter(l=>l.date>=start&&l.date<=end),dates=Array.from({length:days},(_,i)=>dateAfter(i,start));
  const minutes=logs.reduce((n,l)=>n+l.minutes,0),byDate=new Map(dates.map(d=>[d,0]));
  for(const l of logs)byDate.set(l.date,(byDate.get(l.date)||0)+l.minutes);
  let longest=0,current=0;for(const d of dates){current=byDate.get(d)>0?current+1:0;longest=Math.max(longest,current)}
  const bySubject=[...data.subjects.map(s=>({id:s.id,name:s.name})),{id:'',name:'综合 / 核心'}].map(s=>({...s,minutes:logs.filter(l=>l.subject===s.id).reduce((n,l)=>n+l.minutes,0)})).filter(s=>s.minutes>0).sort((a,b)=>b.minutes-a.minutes);
  return {start,end,logs,dates,byDate,minutes,longest,active:dates.filter(d=>byDate.get(d)>0).length,bySubject};
}
function analyticsView() {
  const a=analysisSnapshot(),reviewCount=data.reviewHistory.filter(h=>h.date>=a.start&&h.date<=a.end).length;
  const causes=MISTAKE_CAUSES.map(c=>({name:c,count:data.mistakes.filter(m=>m.cause===c&&m.date>=a.start&&m.date<=a.end).length})).filter(c=>c.count).sort((x,y)=>y.count-x.count);
  return head('看见自己的学习轨迹。','只统计你已记录的数据，用来复盘自己的投入与方法。')+
    `<div class="analysis-controls"><div class="task-tabs">${[7,30,90].map(d=>`<button data-analysis-days="${d}" class="${analysisDays===d?'selected':''}" aria-pressed="${analysisDays===d}">近 ${d} 天</button>`).join('')}</div><span class="sub">${a.start} — ${a.end} · 含今天</span></div>
    <div class="stats"><div class="stat"><span class="stat-label">学习时长</span><strong>${(a.minutes/60).toFixed(1)} <small>小时</small></strong><small>${a.logs.length} 条学习日志</small></div><div class="stat"><span class="stat-label">有记录的学习日</span><strong>${a.active} <small>/ ${analysisDays}</small></strong></div><div class="stat"><span class="stat-label">期间最长连续学习</span><strong>${a.longest} <small>天</small></strong></div><div class="stat"><span class="stat-label">知识点复习</span><strong>${reviewCount} <small>次</small></strong></div></div>
    <div class="grid"><section class="panel"><div class="panel-head"><h2>每天的积累</h2><span class="sub">单位：分钟</span></div><div class="activity-grid">${a.dates.map(d=>{const m=a.byDate.get(d),level=m>=90?4:m>=60?3:m>=30?2:m>0?1:0;return `<div class="activity-day level-${level}" title="${d}：${m} 分钟" aria-label="${d}，${m} 分钟"><small>${d.slice(5)}</small><strong>${m}</strong></div>`}).join('')}</div><div class="activity-legend"><span>少</span>${[0,1,2,3,4].map(n=>`<i class="level-${n}"></i>`).join('')}<span>多</span></div></section><section class="panel"><h2>学科学习分布</h2>${a.bySubject.map(s=>`<div class="distribution"><div><span>${esc(s.name)}</span><strong>${s.minutes} 分钟</strong></div><div class="progress"><i style="width:${a.minutes?s.minutes/a.minutes*100:0}%"></i></div></div>`).join('')||empty('等待第一段学习记录','记录学习日志后，这里会显示各科投入。')}<p class="sub">学习时长用于了解时间分配，不代表学科掌握程度。</p></section></div>
    <div class="grid"><section class="panel"><h2>最近测评与目标</h2>${data.subjects.map(s=>{const g=data.grades.filter(g=>g.subject===s.id&&g.date>=a.start&&g.date<=a.end).reverse().sort((x,y)=>y.date.localeCompare(x.date))[0];return `<div class="row"><div class="row-body"><a href="#subject/${s.id}">${esc(s.name)}</a><small>${g?esc(g.title)+' · '+g.date:'本期暂无测评记录'}</small></div><span class="tag blue">${g?g.score:'—'} / 7</span><span class="sub">目标 ${s.target}</span></div>`}).join('')||empty('先添加你的学科','将测评记录关联到自己的课程。')}</section><section class="panel"><h2>本期错题原因</h2>${causes.map(c=>`<div class="row"><span class="row-body">${esc(c.name)}</span><span class="tag">${c.count} 题</span></div>`).join('')||empty('还没有相关记录','在错题本中记录原因，复盘时更容易发现重复的问题。')}<div class="actions" style="justify-content:flex-start"><a class="outline button-link" href="#mistakes">进入错题本 →</a></div></section></div>`;
}
function globalSearchView() {
  return head('想找的记录，就在这里。','同时查找学科、知识点、任务、日志、计划、资料与错题。')+
    `<div class="search-box"><span>⌕</span><input id="global-query" type="search" value="${esc(globalQuery)}" placeholder="输入关键词，例如：动量、EE、错题…" aria-label="搜索全部学习记录"><select id="global-kind" aria-label="搜索记录类型"><option value="">全部记录</option>${Object.entries(SEARCH_TYPES).map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select></div><div id="global-results"></div>`;
}
function findRecords(query,kind='') {
  const tokens=query.trim().toLowerCase().split(/\s+/).filter(Boolean);if(!tokens.length)return [];
  const results=[];
  for(const [key,label] of Object.entries(SEARCH_TYPES)){
    if(kind&&key!==kind)continue;
    for(const x of data[key]){
      const title=key==='subjects'?x.name:x.title;
      const text=[title,x.notes,x.question,x.correction,x.original,x.source,x.type,x.cause,key==='subjects'?x.level:subjectName(x.subject)].filter(Boolean).join(' ').toLowerCase();
      if(tokens.every(t=>text.includes(t)))results.push({kind:key,label,id:x.id,title,subject:x.subject,date:x.date||'',description:x.notes||x.question||''});
    }
  }
  return results;
}
function renderGlobalResults() {
  const box=$('#global-results');if(!box)return;
  const results=findRecords(globalQuery,globalKind);
  if(!globalQuery.trim()){box.innerHTML=`<section class="panel">${empty('从一个关键词开始','多个关键词用空格分开。搜索仅在当前浏览器的记录中进行。')}</section>`;return}
  box.innerHTML=`<p class="result-summary">找到 ${results.length} 条记录 · 显示前 ${Math.min(results.length,globalLimit)} 条</p><section class="panel">${results.slice(0,globalLimit).map(x=>`<button class="search-result" data-result-kind="${x.kind}" data-result-id="${x.id}"><span class="tag">${x.label}</span><div><strong>${esc(x.title)}</strong><small>${x.kind==='subjects'?'学科工作台':esc(subjectName(x.subject))}${x.date?' · '+esc(x.date):''}</small>${x.description?`<p>${esc(x.description.slice(0,140))}</p>`:''}</div><span>↗</span></button>`).join('')||empty('没有找到匹配的记录','试试更短的关键词，或切换到全部记录。')}${results.length>globalLimit?'<button class="outline" id="load-more-results">显示更多结果</button>':''}</section>`;
  document.querySelectorAll('[data-result-kind]').forEach(el=>el.onclick=()=>openSearchResult(el.dataset.resultKind,el.dataset.resultId));
  if($('#load-more-results'))$('#load-more-results').onclick=()=>{globalLimit+=60;renderGlobalResults()};
}
function openSearchResult(kind,id) {
  if(kind==='subjects'){location.hash='subject/'+id;return}
  if(kind==='topics'){const t=data.topics.find(t=>t.id===id);if(t)topicEditor(t.subject,id);return}
  if(kind==='plans'||kind==='resources'){studyEditor(kind==='plans'?'plan':'resource',id);return}
  if(kind==='mistakes'){mistakeEditor(id);return}
  add(kind,id);
}
function openGlobalSearch() {
  if($('#modal').open)return;
  if(page==='search')$('#global-query')?.focus?.();else location.hash='search';
}
function bindMistakeRows() {
  document.querySelectorAll('[data-mistake-edit]').forEach(el=>el.onclick=()=>mistakeEditor(el.dataset.mistakeEdit));
  document.querySelectorAll('[data-mistake-retry]').forEach(el=>el.onclick=()=>recordRetry(el.dataset.mistakeRetry));
  document.querySelectorAll('[data-mistake-task]').forEach(el=>el.onclick=()=>mistakeTask(el.dataset.mistakeTask));
}
function bindInsights() {
  if(mistakeSubject&&!data.subjects.some(s=>s.id===mistakeSubject))mistakeSubject='';
  if($('#add-mistake'))$('#add-mistake').onclick=()=>mistakeEditor();
  document.querySelectorAll('[data-mistake-subject]').forEach(el=>el.onclick=()=>mistakeEditor(null,el.dataset.mistakeSubject));
  for(const [id,value,set] of [['mistake-subject',mistakeSubject,v=>mistakeSubject=v],['mistake-status',mistakeStatus,v=>mistakeStatus=v]])if($('#'+id)){$('#'+id).value=value;$('#'+id).onchange=e=>{set(e.target.value);renderMistakeResults()}};
  if($('#mistake-query'))$('#mistake-query').oninput=e=>{mistakeQuery=e.target.value;renderMistakeResults()};
  document.querySelectorAll('[data-analysis-days]').forEach(el=>el.onclick=()=>{analysisDays=Number(el.dataset.analysisDays);render()});
  if($('#open-search'))$('#open-search').onclick=openGlobalSearch;
  if($('#global-query')){$('#global-query').oninput=e=>{globalQuery=e.target.value;globalLimit=60;renderGlobalResults()};$('#global-query').focus?.()};
  if($('#global-kind')){$('#global-kind').value=globalKind;$('#global-kind').onchange=e=>{globalKind=e.target.value;globalLimit=60;renderGlobalResults()}};
  renderMistakeResults();renderGlobalResults();
}
