import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Activity, ArrowLeft, ArrowRight, CheckCircle2, Clock3, Code2, Crown, Play, RotateCcw, ShieldCheck, Trophy, Users, XCircle } from 'lucide-react';

const socket = io(import.meta.env.VITE_SERVER_URL || window.location.origin.replace(':5173', ':5000'));
const letters = ['A','B','C','D'];
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `00:${String(s).padStart(2,'0')}`; };

export default function App() {
  const isAdminPath = window.location.pathname.startsWith('/admin');
  const [name,setName] = useState('');
  const [joined,setJoined] = useState(false);
  const [myId,setMyId] = useState('');
  const [state,setState] = useState({status:'waiting',currentIndex:-1,question:null,participants:0,leaderboardVisible:false});
  const [adminState,setAdminState] = useState({status:'waiting',currentIndex:-1,question:null,participants:0,counts:{correct:0,wrong:0,pending:0,total:0},leaderboard:[]});
  const [chosen,setChosen] = useState(null);
  const [submitted,setSubmitted] = useState(false);
  const [remaining,setRemaining] = useState(30);
  const [adminRemaining,setAdminRemaining] = useState(30);
  const studentUrl = `${window.location.origin}/`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(studentUrl)}`;
  const [error,setError] = useState('');
  const [lastAnswer,setLastAnswer] = useState(null);
  const [lastResult,setLastResult] = useState(null);

  useEffect(()=>{
    const studentState = s => { setState(s); if(s.status === 'question' && s.currentIndex !== state.currentIndex){setChosen(null);setSubmitted(false);setLastAnswer(null);setLastResult(null);} };
    socket.on('student:state',studentState);
    socket.on('student:question-started',({question,endsAt})=>{setState(s=>({...s,status:'question',currentIndex:question.number-1,question,endsAt}));setChosen(null);setSubmitted(false);setLastAnswer(null);setLastResult(null);});
    socket.on('student:question-ended',()=>setState(s=>({...s,status:'question-ended'})));
    socket.on('admin:state',setAdminState);
    socket.on('session:reset',()=>{setJoined(false);setName('');setChosen(null);setSubmitted(false);setError('');});
    return ()=>{socket.off('student:state',studentState);socket.off('student:question-started');socket.off('student:question-ended');socket.off('admin:state');socket.off('session:reset');};
  },[state.currentIndex]);
  useEffect(()=>{
    if(!state.endsAt || state.status!=='question') return;
    const tick=()=>setRemaining(Math.max(0,Math.ceil((state.endsAt-Date.now())/1000)));
    tick(); const id=setInterval(tick,200); return ()=>clearInterval(id);
  },[state.endsAt,state.status]);
  useEffect(()=>{
    if(!adminState.endsAt || adminState.status!=='question') return;
    const tick=()=>setAdminRemaining(Math.max(0,Math.ceil((adminState.endsAt-Date.now())/1000)));
    tick(); const id=setInterval(tick,200); return ()=>clearInterval(id);
  },[adminState.endsAt,adminState.status]);
  function join(e){e.preventDefault();setError('');socket.emit('participant:join',{name},res=>{if(res?.ok){setJoined(true);setMyId(res.id);}else setError(res?.error||'Could not join.');});}
  function submit(){if(chosen===null||submitted)return;socket.emit('participant:answer',{answer:chosen},res=>{if(res?.ok){setSubmitted(true);setLastAnswer(chosen);setLastResult(Boolean(res.isCorrect));}else setError(res?.error||'Answer could not be submitted.');});}
  const adminQuestion=adminState.question;
  if(isAdminPath) return <div className="shell"><Header admin/><main className="admin-page">
    <div className="admin-title"><div><div className="eyebrow"><ShieldCheck size={14}/> HOST CONTROL PANEL</div><h1>Admin <span>Dashboard</span></h1><p>Only the admin controls when each question starts. Students wait on their phones until you press Start.</p></div><div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>{adminState.status==='question'&&<div className={`student-timer ${adminRemaining<=5?'danger':''}`}><Clock3 size={16}/>{fmt(adminRemaining*1000)}</div>}<div className={`live-pill ${adminState.status==='question'?'is-live':''}`}><i/>{adminState.status==='question'?'QUESTION LIVE':adminState.status==='finished'?'QUIZ FINISHED':'WAITING'}</div></div></div>
    <div className="admin-stats"><Stat icon={<Users/>} label="Connected participants" value={adminState.participants||0}/><Stat icon={<Activity/>} label="Question" value={adminState.currentIndex>=0?`${adminState.currentIndex+1} / 20`:'Not started'}/><Stat icon={<CheckCircle2/>} label="Correct answers" value={adminState.counts?.correct||0}/><Stat icon={<XCircle/>} label="Wrong answers" value={adminState.counts?.wrong||0}/></div>
    <div className="admin-grid"><section className="panel admin-question"><div className="panel-head"><span className="section-kicker">QUESTION CONTROL</span><span className="small-chip">{adminQuestion?adminQuestion.category:'Ready to begin'}</span></div>
      {adminQuestion? <><div className="admin-q-number">QUESTION {adminState.currentIndex+1} / 20</div><h2>{adminQuestion.prompt}</h2>{adminQuestion.code&&<pre className="code"><code>{adminQuestion.code.replaceAll('\\n','\n')}</code></pre>}<div className="admin-options">{adminQuestion.options.map((o,i)=><div className={`admin-option ${i===adminQuestion.answer?'admin-correct':''}`} key={o}><b>{letters[i]}</b>{o}{i===adminQuestion.answer&&<span>Correct answer</span>}</div>)}</div><div className="admin-answer-key"><strong>Correct answer:</strong> {letters[adminQuestion.answer]}. {adminQuestion.options[adminQuestion.answer]}</div><div className="source-box"><strong>QUESTION SOURCE</strong><p>{adminQuestion.source}</p><small>{adminQuestion.note}</small></div></>
      :<div className="empty-question"><div className="big-play"><Play/></div><h2>Ready to host?</h2><p>Start Question 1 when your participants are ready. The 30-second timer begins only when you start a question.</p></div>}
      <div className="admin-actions">{adminState.status==='question'?<button className="btn secondary" onClick={()=>socket.emit('admin:end-question')}><Clock3 size={17}/> End question now</button>:<button className="btn primary" onClick={()=>socket.emit('admin:start-question',{index:adminState.currentIndex+1})} disabled={adminState.status==='finished'}><Play size={17}/>{adminState.currentIndex<0?'Start Question 1':`Start Question ${adminState.currentIndex+2}`}</button>}
      <button className="btn secondary" onClick={()=>socket.emit('admin:show-leaderboard')}><Trophy size={17}/> Show leaderboard</button></div>
      <p className="host-hint"><ShieldCheck size={15}/> The 30-second timer starts for both admin and students only after you press Start.</p>
    </section>
    <aside className="panel live-panel"><div className="panel-head"><span className="section-kicker">LIVE ANSWER COUNTS</span><span className="live-dot">LIVE</span></div><div className="count-grid"><Count label="Correct" value={adminState.counts?.correct||0} type="good"/><Count label="Wrong" value={adminState.counts?.wrong||0} type="bad"/><Count label="Not answered" value={adminState.counts?.pending||0} type="neutral"/></div><div className="count-total"><span>Participants total</span><strong>{adminState.counts?.total||adminState.participants||0}</strong></div><p className="muted">Counts update instantly when each participant submits an answer. Students see only their own feedback after the question closes.</p>
    <div className="panel-head participant-head"><span className="section-kicker">STUDENT QR CODE</span><span className="small-chip">Scan to join</span></div><div style={{textAlign:'center',padding:'10px 0 18px'}}><img src={qrUrl} alt="Student portal QR code" width="180" height="180" style={{background:'#fff',padding:8,borderRadius:10,maxWidth:'100%'}}/><p className="muted" style={{overflowWrap:'anywhere'}}>{studentUrl}</p><button className="btn secondary" onClick={()=>{navigator.clipboard?.writeText(studentUrl);alert('Student link copied');}}>Copy student link</button><p className="tiny">This QR opens only the student portal. Deploy this app online first so all 200 students can scan it.</p></div><div className="panel-head participant-head"><span className="section-kicker">PARTICIPANTS</span><span className="small-chip">{adminState.participants||0} joined</span></div><div className="participant-list">{(adminState.participantNames||[]).length?adminState.participantNames.map(n=><div key={n}>{n}</div>):<p className="tiny">Participant names will appear here after they join.</p>}</div>
    </aside></div>
    {adminState.leaderboardVisible&&<section className="panel leaderboard-panel"><div className="panel-head"><span className="section-kicker"><Crown size={15}/> FINAL LEADERBOARD</span><span className="small-chip">Ranked by score</span></div>{adminState.leaderboard?.length?<div className="leader-table"><div className="leader-head"><span>RANK</span><span>PARTICIPANT</span><span>SCORE</span></div>{adminState.leaderboard.map((p,i)=><div className="leader-row" key={p.name+'-'+i}><b className={`rank rank-${i+1}`}>{i+1}</b><strong>{p.name}</strong><b>{p.score} <small>/ 20</small></b></div>)}</div>:<p className="muted">No participants have joined yet.</p>}<button className="btn secondary reset-btn" onClick={()=>{if(confirm('Reset this quiz session and clear participants?'))socket.emit('admin:reset')}}><RotateCcw size={16}/> Reset quiz session</button></section>}
  </main><Footer/></div>;

  return <div className="shell"><Header/><main className="student-page">
    {!joined?<section className="join-card"><div className="join-symbol"><Code2 size={28}/></div><div className="eyebrow">TECH QUIZ • LIVE EVENT</div><h1>Enter your <span>name.</span></h1><p className="muted">Join the quiz and wait for the host to start each question.</p><form onSubmit={join}><label htmlFor="name">Your name</label><input id="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your full name" maxLength={50} required/><button className="btn primary full" disabled={!name.trim()}>Join Quiz <ArrowRight size={17}/></button></form>{error&&<p className="error-text">{error}</p>}<div className="waiting-note"><ShieldCheck size={15}/> Admin starts every question manually.</div></section>
    :<section className="student-quiz"><div className="student-top"><div><div className="eyebrow">PARTICIPANT</div><strong>{name}</strong></div><div className={`live-pill ${state.status==='question'?'is-live':''}`}><i/>{state.status==='question'?'LIVE QUESTION':'WAITING FOR HOST'}</div></div>
      {state.status==='waiting'?<Waiting title="You're in!" text="Stay on this screen. The question appears when the admin presses Start."/>:
      state.status==='question'&&state.question?<><div className="student-meta"><span>QUESTION {state.question.number} / {state.question.total}</span><span className={`student-timer ${remaining<=5?'danger':''}`}><Clock3 size={16}/>{fmt((state.endsAt||Date.now())-Date.now())}</span></div><div className="student-question"><span className="small-chip">{state.question.category}</span><h2>{state.question.prompt}</h2>{state.question.code&&<pre className="code"><code>{state.question.code.replaceAll('\\n','\n')}</code></pre>}<div className="student-options">{state.question.options.map((o,i)=><button key={o} className={`student-option ${chosen===i?'chosen':''} ${submitted&&chosen===i?'submitted':''}`} disabled={submitted} onClick={()=>setChosen(i)}><b>{letters[i]}</b>{o}{chosen===i&&<CheckCircle2 size={17}/>}</button>)}</div>{error&&<p className="error-text">{error}</p>}<button className="btn primary full" onClick={submit} disabled={chosen===null||submitted}>{submitted?'Answer submitted':'Submit answer'} <ArrowRight size={17}/></button>{submitted&&<p className="waiting-note"><CheckCircle2 size={15}/> Answer received. Your result will appear when the question closes.</p>}</div></>:
      state.status==='question-ended'?<div className="waiting-screen"><div className={`result-mark ${lastResult===true?'result-correct':lastResult===false?'result-wrong':''}`}>{lastResult===true?<CheckCircle2 size={34}/>:lastResult===false?<XCircle size={34}/>:<Clock3 size={31}/>}</div><h2>{lastResult===true?'Correct!':lastResult===false?'Wrong answer':submitted?'Answer window closed':'Time is up!'}</h2><p>{submitted?'Your answer has been checked. The correct answer is not shown on student devices.':'No answer was submitted before time ran out.'} Wait for the admin to start the next question.</p><div className="waiting-dots"><i/><i/><i/></div></div>:
      state.status==='finished'?<section className="finished-card"><Trophy size={35}/><h2>Quiz completed!</h2><p className="muted">The host has finished the quiz. Please check the event screen for results.</p></section>:<Waiting title="Waiting for host" text="The next question will appear here when the admin starts it."/>}
    </section>}
  </main><Footer/></div>;
}
function Header({admin=false}){return <header className="topbar"><a className="brand" href="/"><span className="brand-icon"><Code2 size={21}/></span><span>TECH<span className="brand-light">QUIZ</span><small>{admin?'ADMIN CONTROL':'LIVE QUIZ ARENA'}</small></span></a>{admin?<a className="top-link" href="/">Student view ↗</a>:<span className="secure-badge"><ShieldCheck size={14}/> Live session</span>}</header>}
function Stat({icon,label,value}){return <div className="stat-card"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span><strong>{value}</strong></div>}
function Count({label,value,type}){return <div className={`count-box ${type}`}><strong>{value}</strong><span>{label}</span></div>}
function Waiting({title,text}){return <div className="waiting-screen"><div className="waiting-animation"><Clock3 size={31}/></div><h2>{title}</h2><p>{text}</p><div className="waiting-dots"><i/><i/><i/></div></div>}
function Footer(){return <footer className="footer"><span>TECH QUIZ</span><span>Think sharp. Code smart.</span></footer>}