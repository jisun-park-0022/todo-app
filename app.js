// ── Supabase 설정 ─────────────────────────────────────────
const SUPABASE_URL = 'https://doiflppyuggeiaczflwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaWZscHB5dWdnZWlhY3pmbHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjE1OTgsImV4cCI6MjA5ODMzNzU5OH0.QsqxI-S_QpoPAANeTKx7VMc4naXRoWOlIi9PTPWmeLA';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STATUSES = ['todo', 'inprogress', 'done'];

let currentUser = null;
let draggedId = null;

// ── Auth ─────────────────────────────────────────────────
function initAuth() {
  db.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    if (currentUser) {
      showAppUI(currentUser);
      render();
    } else {
      showAuthUI();
    }
  });
}

function showAuthUI() {
  document.getElementById('auth-section').hidden = false;
  document.getElementById('app-section').hidden = true;
}

function showAppUI(user) {
  document.getElementById('auth-section').hidden = true;
  document.getElementById('app-section').hidden = false;
  document.getElementById('user-email').textContent = user.email;
}

async function signUp() {
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errEl = document.getElementById('signup-error');
  errEl.textContent = '';

  const { error } = await db.auth.signUp({ email, password });
  if (error) {
    errEl.textContent = error.message;
    return;
  }
  document.getElementById('form-signup').hidden = true;
  document.getElementById('email-sent').hidden = false;
}

async function signIn() {
  const email = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;
  const errEl = document.getElementById('signin-error');
  errEl.textContent = '';

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    errEl.textContent = error.message;
    return;
  }
  if (data.session) {
    currentUser = data.session.user;
    showAppUI(currentUser);
    render();
  }
}

async function signOut() {
  await db.auth.signOut();
}

function switchTab(tab) {
  const isSignin = tab === 'signin';
  document.getElementById('form-signin').hidden = !isSignin;
  document.getElementById('form-signup').hidden = isSignin;
  document.getElementById('email-sent').hidden = true;
  document.getElementById('tab-signin').classList.toggle('active', isSignin);
  document.getElementById('tab-signup').classList.toggle('active', !isSignin);
}

// ── Render ───────────────────────────────────────────────
async function render() {
  const { data: todos, error } = await db
    .from('todos')
    .select('*')
    .order('position');

  if (error) { console.error('render error:', error); return; }

  STATUSES.forEach(status => {
    const listEl = document.getElementById('list-' + status);
    const countEl = document.getElementById('count-' + status);
    const items = todos.filter(t => t.status === status);

    listEl.innerHTML = '';
    countEl.textContent = items.length;

    items.forEach(todo => listEl.appendChild(createCard(todo)));
  });
}

function createCard(todo) {
  const card = document.createElement('div');
  card.className = 'card';
  card.draggable = true;
  card.dataset.id = todo.id;

  const text = document.createElement('span');
  text.className = 'card-text';
  text.textContent = todo.text;

  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn';
  delBtn.textContent = '✕';
  delBtn.title = '삭제';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTodo(todo.id);
  });

  card.addEventListener('dragstart', onDragStart);
  card.addEventListener('dragend', onDragEnd);

  card.append(text, delBtn);
  return card;
}

// ── CRUD ─────────────────────────────────────────────────
async function addTodo() {
  const input = document.getElementById('todoInput');
  const text = input.value.trim();
  if (!text || !currentUser) return;

  const { error } = await db
    .from('todos')
    .insert({ text, status: 'todo', position: Date.now(), user_id: currentUser.id });

  if (error) { console.error('insert error:', error); return; }

  await render();
  input.value = '';
  input.focus();
}

async function deleteTodo(id) {
  const { error } = await db
    .from('todos')
    .delete()
    .eq('id', id);

  if (error) { console.error('delete error:', error); return; }
  await render();
}

async function moveCard(id, newStatus) {
  const { error } = await db
    .from('todos')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) { console.error('update error:', error); return; }
  await render();
}

// ── Drag & Drop ──────────────────────────────────────────
function onDragStart(e) {
  draggedId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  draggedId = null;
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

async function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (draggedId) {
    await moveCard(draggedId, e.currentTarget.dataset.status);
  }
}

// ── Init ─────────────────────────────────────────────────
document.getElementById('addBtn').addEventListener('click', addTodo);
document.getElementById('todoInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTodo();
});
document.getElementById('signinBtn').addEventListener('click', signIn);
document.getElementById('signupBtn').addEventListener('click', signUp);
document.getElementById('signoutBtn').addEventListener('click', signOut);
document.getElementById('tab-signin').addEventListener('click', () => switchTab('signin'));
document.getElementById('tab-signup').addEventListener('click', () => switchTab('signup'));

initAuth();
