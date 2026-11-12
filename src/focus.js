'use strict';

// The timer is separate from the learning archive, so running it never rewrites study records.
const TIMER_KEY='ib-atlas-timer';
let timerStoredRaw=null,focusDraftSession='',focusDraftRaw=null,focusSetupDraft=null;
const timerDuration=(value=timer)=>value.duration??1500;
function timerSeconds(value=timer){
  const remaining=value.running?Math.ceil((value.end-Date.now())/1000):value.remaining;
  return Math.max(0,Math.min(timerDuration(value),remaining));
}
const focusElapsed=()=>timerDuration()-timerSeconds();
const focusHasProgress=()=>timer.running||focusElapsed()>0;
const focusTime=seconds=>String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
function freshTimer(duration=1500,context={}){
  return {duration,remaining:duration,running:false,end:0,session:crypto.randomUUID(),title:context.title||'专注学习',subject:context.subject||'',notes:context.notes||'',date:''};
}
function restoreTimer(){
  try{
    timerStoredRaw=localStorage.getItem(TIMER_KEY)??null;
    const t=JSON.parse(timerStoredRaw),duration=t?.duration??1500;
    const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
    if(!t||!Number.isInteger(duration)||duration<60||duration>28800||!Number.isInteger(t.remaining)||t.remaining<0||t.remaining>duration||typeof t.running!=='boolean'||!Number.isFinite(t.end))return freshTimer();
    if(t.session!==undefined&&!validId(t.session))return freshTimer();
    if(t.title!==undefined&&(typeof t.title!=='string'||!t.title.trim()||t.title.length>180))return freshTimer();
    if(t.notes!==undefined&&(typeof t.notes!=='string'||t.notes.length>100000))return freshTimer();
    if(t.subject!==undefined&&t.subject!==''&&!validId(t.subject))return freshTimer();
    if(t.date!==undefined&&!validDate(t.date,true))return freshTimer();
    const context={title:t.title,subject:data.subjects.some(s=>s.id===t.subject)?t.subject:'',notes:t.notes};
    if(t.session&&data.logs.some(l=>l.focusSession===t.session))return freshTimer(duration,context);
    if(t.running&&t.end>Date.now()+duration*1000)return freshTimer();
    const value={...freshTimer(duration,context),...context,session:t.session||crypto.randomUUID(),date:t.date||'',remaining:t.remaining,running:t.running,end:t.end};
    value.title=context.title||'专注学习';value.notes=context.notes||'';
    if(value.running&&value.end<=Date.now()){value.running=false;value.remaining=0;value.end=0}
    return value;
  }catch{return freshTimer()}
}
function timerIsCurrent(){
  try{return (localStorage.getItem(TIMER_KEY)??null)===timerStoredRaw}
  catch{return true} // Keep an in-memory timer usable when browser storage is unavailable.
}
function syncChangedTimer(){
  timer=restoreTimer();
  if(page==='focus'&&!$('#modal').open)render();else paintTimer();
  toast('另一个标签页更新了专注状态，已载入最新计时。请重新操作。');
}
function commitTimer(next){
  if(!timerIsCurrent()){syncChangedTimer();return false}
  timer=next;
  try{const raw=JSON.stringify(timer);localStorage.setItem(TIMER_KEY,raw);timerStoredRaw=raw}
  catch{toast('计时状态未能保存，刷新可能丢失进度。')}
  return true;
}
function persistTimer(){return commitTimer(timer)}
function resetTimer(keepContext=false){
  return commitTimer(freshTimer(keepContext?timerDuration():1500,keepContext?timer:{}));
}
function focusSetupValues(){
  if(!focusHasProgress()&&focusSetupDraft?.session===timer.session)return focusSetupDraft;
  return {title:timer.title||'专注学习',subject:timer.subject||'',minutes:timerDuration()/60};
}
function captureFocusSetup(){
  if($('#focus-title')&&!focusHasProgress())focusSetupDraft={session:timer.session,title:$('#focus-title').value,subject:$('#focus-subject').value,minutes:$('#focus-minutes').value};
}
function focusView(){
  const logs=data.logs.filter(l=>l.focusSession&&l.date===today()),minutes=logs.reduce((n,l)=>n+l.minutes,0),setup=focusSetupValues();
  return head('专注时光','选定一件事，留出一段时间。结束后记录实际投入与收获。')+
    `<div class="focus-layout"><section class="panel focus-workspace"><div class="eyebrow">ONE THING AT A TIME</div><div class="focus-context"><label for="focus-title">这段时间，想完成什么？</label><input id="focus-title" maxlength="180" value="${esc(setup.title)}" required><label for="focus-subject">关联科目</label><select id="focus-subject">${options()}</select></div><div class="focus-duration"><span id="focus-duration-label">专注时长</span><div class="focus-presets" role="group" aria-labelledby="focus-duration-label">${[15,25,45,60].map(minutes=>`<button data-focus-duration="${minutes}" aria-pressed="${timerDuration()===minutes*60}" class="${timerDuration()===minutes*60?'selected':''}">${minutes} 分钟</button>`).join('')}</div><label class="focus-custom" for="focus-minutes">自定时长 <input id="focus-minutes" type="number" min="1" max="480" step="1" value="${esc(setup.minutes)}" required> 分钟</label></div><div class="focus-orbit"><div id="timer-display" role="timer" aria-label="专注剩余时间" aria-live="off"></div></div><p id="focus-status" role="status"></p><div class="focus-actions"><button class="primary" id="timer-start"></button><button class="outline" id="timer-save">记录已专注时间</button><button class="text-button" id="timer-reset">重新开始</button></div><p class="sub">离开此页面仍会计时。记录前可修改实际日期、时长与学习收获。</p></section><section class="panel focus-reflection"><span class="eyebrow">A LITTLE, EVERY DAY</span><h2>今天的专注积累</h2><div class="focus-today"><strong>${minutes}<small> 分钟</small></strong><span>${logs.length} 次已记录</span></div><p class="sub">专注时间以保存到学习日志的记录为准。</p><div class="focus-checklist"><h3>开始前，给自己一点准备</h3><p>明确一个可以开始的小目标。</p><p>把需要的题目与资料放在手边。</p><p>结束时，写下收获和下一步。</p></div><h3>最近记录</h3>${logs.slice().reverse().slice(0,4).map(l=>recordRow(l,'logs')).join('')||empty('从这一段专注开始','完成后保存记录，让每次投入留下痕迹。')}<a class="text-button" href="#logs">查看全部学习日志 ↗</a></section></div>`;
}
function readFocusContext(){
  if(!$('#focus-title')||focusHasProgress())return true;
  captureFocusSetup();
  const title=$('#focus-title').value.trim(),minutes=Number($('#focus-minutes').value);
  if(!title||title.length>180){toast('请填写这段专注的学习目标。');$('#focus-title').focus?.();return false}
  if(!Number.isInteger(minutes)||minutes<1||minutes>480){toast('专注时长须为 1–480 的整数分钟。');$('#focus-minutes').focus?.();return false}
  const subject=$('#focus-subject').value;
  const saved=commitTimer({...timer,title,subject,duration:minutes*60,remaining:minutes*60});
  if(saved)focusSetupDraft=null;
  return saved;
}
function toggleFocus(){
  if(!timerIsCurrent()){syncChangedTimer();return}
  if(!timer.running&&!readFocusContext())return;
  const seconds=timerSeconds();if(seconds===0)return;
  if(commitTimer({...timer,remaining:seconds,running:!timer.running,end:timer.running?0:Date.now()+seconds*1000,date:timer.date||today()}))paintTimer();
}
function changeFocusDuration(minutes){
  if(focusHasProgress()){toast('请先记录或重新开始，再调整专注时长。');return}
  if(!Number.isInteger(minutes)||minutes<1||minutes>480){toast('专注时长须为 1–480 的整数分钟。');return}
  if(!timerIsCurrent()){syncChangedTimer();return}
  if($('#focus-title')){
    const title=$('#focus-title').value.trim();
    if(title&&title.length<=180)timer={...timer,title,subject:$('#focus-subject').value};
  }
  if(commitTimer({...timer,duration:minutes*60,remaining:minutes*60})){
    if($('#focus-minutes'))$('#focus-minutes').value=minutes;
    captureFocusSetup();
    paintTimer();
  }
}
function restartFocus(){
  if(!timerIsCurrent()){syncChangedTimer();return}
  if(focusHasProgress()&&!confirm('这段专注还未记录。重新开始会清除当前计时，继续？'))return;
  if(resetTimer(true)){render();toast('已重新开始，可以调整目标与时长。')}
}
function saveFocus(){
  if($('#modal').open)return;
  if(!timerIsCurrent()){syncChangedTimer();return}
  const seconds=timerSeconds(),minutes=Math.floor((timerDuration()-seconds)/60);
  if(minutes<1){toast('专注满 1 分钟后即可记录。');return}
  if(!commitTimer({...timer,remaining:seconds,running:false,end:0}))return;
  add('logs');focusDraft=true;focusDraftSession=timer.session;focusDraftRaw=timerStoredRaw;
  $('#f-title').value=timer.title||'专注学习';$('#f-subject').value=data.subjects.some(s=>s.id===timer.subject)?timer.subject:'';
  $('#f-date').value=timer.date||today();$('#f-minutes').value=minutes;$('#f-notes').value=timer.notes||'';
  paintTimer();
}
function focusLogMetadata(){
  if(!focusDraft)return {};
  if(timer.session!==focusDraftSession||timerStoredRaw!==focusDraftRaw||!timerIsCurrent())throw Error('专注状态已在另一标签页更新。草稿仍保留，请关闭后重新确认计时再记录。');
  if(data.logs.some(l=>l.focusSession===focusDraftSession))throw Error('这段专注已记录，请在学习日志中编辑已有记录。');
  return {focusSession:focusDraftSession};
}
function prepareFocus(kind,id){
  const record=kind==='subjects'?data.subjects.find(s=>s.id===id):data.tasks.find(t=>t.id===id);
  if(!record)return;
  if(!timerIsCurrent()){syncChangedTimer();return}
  if(focusHasProgress()&&!confirm('当前专注还未记录。切换学习目标会清除当前计时，继续？'))return;
  const context=kind==='subjects'?{title:record.name+' · 专注学习',subject:id}:{title:record.title,subject:record.subject,notes:record.notes};
  context.title=context.title.slice(0,180);
  if(commitTimer(freshTimer(timerDuration(),context))){location.hash='#focus';if(page==='focus')render()}
}
function paintTimer(){
  const seconds=timerSeconds(),active=focusHasProgress(),state=timer.running?'正在专注':seconds===0?'本次专注已完成':active?'已暂停，随时继续':'准备开始';
  const text=(selector,value)=>{const el=$(selector);if(el&&el.textContent!==value)el.textContent=value};
  text('#timer-display',focusTime(seconds));
  if($('#timer-start')){$('#timer-start').textContent=timer.running?'暂停专注':seconds===0?'已完成':active?'继续专注':'开始专注';$('#timer-start').disabled=seconds===0}
  if($('#timer-save'))$('#timer-save').disabled=focusElapsed()<60;
  text('#focus-status',state+' · 已专注 '+Math.floor(focusElapsed()/60)+' 分钟');
  for(const id of ['focus-title','focus-subject','focus-minutes'])if($('#'+id))$('#'+id).disabled=active;
  document.querySelectorAll('[data-focus-duration]').forEach(el=>{el.disabled=active;const selected=Number(el.dataset.focusDuration)*60===timerDuration();el.setAttribute('aria-pressed',String(selected));el.classList.toggle('selected',selected)});
  const bar=$('#focus-session-bar');
  if(bar){
    bar.hidden=!active||page==='focus';
    if(!bar.hidden){
      if(!$('#focus-bar-time')){
        bar.innerHTML='<a href="#focus" class="focus-bar-link"><span class="eyebrow">专注进行中</span><strong id="focus-bar-title"></strong><span id="focus-bar-time" role="timer" aria-label="专注剩余时间" aria-live="off"></span></a><button id="focus-bar-toggle" class="outline"></button><button id="focus-bar-save" class="primary">记录</button>';
        $('#focus-bar-toggle').onclick=toggleFocus;$('#focus-bar-save').onclick=saveFocus;
      }
      text('#focus-bar-title',timer.title||'专注学习');text('#focus-bar-time',focusTime(seconds));
      $('#focus-bar-toggle').textContent=timer.running?'暂停':'继续';$('#focus-bar-toggle').disabled=seconds===0;
      $('#focus-bar-save').disabled=focusElapsed()<60;
      const label=bar.querySelector('.eyebrow');if(label)label.textContent=seconds===0?'专注已完成':timer.running?'专注进行中':'专注已暂停';
    }
  }
}
function tickFocus(){
  if(timer.running&&Date.now()>=timer.end){
    if(commitTimer({...timer,running:false,remaining:0,end:0}))toast('本次专注已完成！可以保存到学习日志。');
  }
  paintTimer();
}
function bindFocus(){
  document.querySelectorAll('[data-focus-subject]').forEach(el=>el.onclick=()=>prepareFocus('subjects',el.dataset.focusSubject));
  if($('#timer-start'))$('#timer-start').onclick=toggleFocus;
  if($('#timer-reset'))$('#timer-reset').onclick=restartFocus;
  if($('#timer-save'))$('#timer-save').onclick=saveFocus;
  const setup=focusSetupValues();
  if($('#focus-subject'))$('#focus-subject').value=data.subjects.some(s=>s.id===setup.subject)?setup.subject:'';
  document.querySelectorAll('[data-focus-duration]').forEach(el=>el.onclick=()=>changeFocusDuration(Number(el.dataset.focusDuration)));
  if($('#focus-minutes'))$('#focus-minutes').onchange=()=>changeFocusDuration(Number($('#focus-minutes').value));
  for(const id of ['focus-title','focus-subject'])if($('#'+id))$('#'+id).onchange=readFocusContext;
  for(const id of ['focus-title','focus-subject','focus-minutes'])if($('#'+id))$('#'+id).oninput=captureFocusSetup;
  paintTimer();
}
