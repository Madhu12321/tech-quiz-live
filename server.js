import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { questions } from './src/questions.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(cors());
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ ok: true, questionCount: questions.length }));
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => { if (req.path.startsWith('/api/')) return next(); res.sendFile(path.join(distPath, 'index.html'), err => { if (err) next(); }); });

// Demo state lives in server memory. For a real public event, use a database and admin authentication.
let session = { status: 'waiting', currentIndex: -1, endsAt: null, participants: {}, leaderboardVisible: false };
const TIMER_SECONDS = 30;
const safeQuestion = (index) => {
  const q = questions[index];
  if (!q) return null;
  const { answer, note, ...publicQuestion } = q;
  return { ...publicQuestion, number: index + 1, total: questions.length, timeLimit: TIMER_SECONDS };
};
function snapshotForStudent() {
  const p = Object.values(session.participants).map(x => ({ id: x.id, name: x.name, answered: x.answer !== undefined }));
  return { status: session.status, currentIndex: session.currentIndex, endsAt: session.endsAt, question: session.status === 'question' ? safeQuestion(session.currentIndex) : null, participants: p.length, leaderboardVisible: session.leaderboardVisible };
}
function counts() {
  const participants = Object.values(session.participants);
  const q = questions[session.currentIndex];
  let correct = 0, wrong = 0, pending = 0;
  for (const p of participants) {
    if (p.answer === undefined) pending++;
    else if (q && p.answer === q.answer) correct++;
    else wrong++;
  }
  return { correct, wrong, pending, total: participants.length };
}
function adminSnapshot() {
  const q = questions[session.currentIndex];
  return { ...snapshotForStudent(), question: q ? { ...safeQuestion(session.currentIndex), answer: q.answer, explanation: q.note } : null, counts: counts(), participantNames: Object.values(session.participants).map(p => p.name), leaderboard: session.leaderboardVisible ? leaderboard() : [] };
}
function leaderboard() {
  return Object.values(session.participants).map(p => ({
    name: p.name,
    score: p.score,
    answered: p.answers.length,
    total: questions.length
  })).sort((a,b) => b.score - a.score || a.name.localeCompare(b.name));
}
function emitState() {
  io.emit('student:state', snapshotForStudent());
  io.emit('admin:state', adminSnapshot());
}
function endCurrentQuestion() {
  if (session.status !== 'question') return;
  session.status = 'question-ended';
  session.endsAt = null;
  io.emit('student:question-ended', { question: safeQuestion(session.currentIndex) });
  emitState();
}
const timerHandle = { value: null };
function startQuestion(index) {
  if (index < 0 || index >= questions.length) {
    session.status = 'finished';
    session.currentIndex = questions.length - 1;
    session.endsAt = null;
    session.leaderboardVisible = false;
    emitState();
    return;
  }
  if (timerHandle.value) clearTimeout(timerHandle.value);
  session.currentIndex = index;
  session.status = 'question';
  session.endsAt = Date.now() + TIMER_SECONDS * 1000;
  for (const p of Object.values(session.participants)) p.answer = undefined;
  io.emit('student:question-started', { question: safeQuestion(index), endsAt: session.endsAt });
  emitState();
  timerHandle.value = setTimeout(endCurrentQuestion, TIMER_SECONDS * 1000);
}
io.on('connection', socket => {
  socket.emit('student:state', snapshotForStudent());
  socket.on('participant:join', ({ name }, callback) => {
    const cleanName = String(name || '').trim().slice(0, 50);
    if (!cleanName) return callback?.({ ok: false, error: 'Please enter your name.' });
    const id = socket.id;
    session.participants[id] = { id, name: cleanName, score: 0, answers: [], answer: undefined };
    socket.data.participantId = id;
    callback?.({ ok: true, id });
    emitState();
  });
  socket.on('participant:answer', ({ answer }, callback) => {
    const id = socket.data.participantId;
    const p = session.participants[id];
    if (!p) return callback?.({ ok: false, error: 'Enter your name first.' });
    if (session.status !== 'question') return callback?.({ ok: false, error: 'The admin has not started an active question.' });
    if (p.answer !== undefined) return callback?.({ ok: false, error: 'Your answer has already been recorded.' });
    const q = questions[session.currentIndex];
    if (!Number.isInteger(answer) || answer < 0 || answer >= q.options.length) return callback?.({ ok: false, error: 'Choose a valid option.' });
    p.answer = answer;
    p.answers[session.currentIndex] = answer;
    if (answer === q.answer) p.score += 1;
    callback?.({ ok: true, isCorrect: answer === q.answer });
    emitState();
  });
  socket.on('disconnect', () => {
    // Keep a participant's score for the event even if their browser temporarily disconnects.
    emitState();
  });
  socket.on('admin:get-state', () => socket.emit('admin:state', adminSnapshot()));
  socket.on('admin:start-question', ({ index } = {}) => {
    const next = Number.isInteger(index) ? index : (session.currentIndex + 1);
    startQuestion(next);
  });
  socket.on('admin:end-question', () => {
    if (timerHandle.value) clearTimeout(timerHandle.value);
    endCurrentQuestion();
  });
  socket.on('admin:show-leaderboard', () => {
    session.status = 'finished';
    session.endsAt = null;
    session.leaderboardVisible = true;
    if (timerHandle.value) clearTimeout(timerHandle.value);
    emitState();
  });
  socket.on('admin:reset', () => {
    if (timerHandle.value) clearTimeout(timerHandle.value);
    session = { status: 'waiting', currentIndex: -1, endsAt: null, participants: {}, leaderboardVisible: false };
    io.emit('session:reset');
    emitState();
  });
});
const PORT = Number(process.env.PORT || 5000);
server.listen(PORT, '0.0.0.0', () => console.log(`TECH QUIZ server running on http://localhost:${PORT}`));