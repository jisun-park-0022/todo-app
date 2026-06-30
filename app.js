// ── Supabase 설정 ─────────────────────────────────────────
const SUPABASE_URL = 'https://doiflppyuggeiaczflwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvaWZscHB5dWdnZWlhY3pmbHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NjE1OTgsImV4cCI6MjA5ODMzNzU5OH0.QsqxI-S_QpoPAANeTKx7VMc4naXRoWOlIi9PTPWmeLA';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const STATUSES = ['todo', 'inprogress', 'done'];
const APP_URL = 'https://jisun-park-0022.github.io/todo-app';

let currentUser = null;
let draggedId = null;
let shareToken = new URLSearchParams(location.search).get('share');
let currentShareData = null;
let realtimeChannel = null;

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
  document.getElementById('user-email').textContent =
    user.email ?? user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? '사용자';
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

async function signInWithGitHub() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: 'https://jisun-park-0022.github.io/todo-app' }
  });
  if (error) console.error('GitHub 로그인 오류:', error.message);
}

async function signInWithGoogle() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://jisun-park-0022.github.io/todo-app' }
  });
  if (error) console.error('Google 로그인 오류:', error.message);
}

function switchTab(tab) {
  const isSignin = tab === 'signin';
  document.getElementById('form-signin').hidden = !isSignin;
  document.getElementById('form-signup').hidden = isSignin;
  document.getElementById('email-sent').hidden = true;
  document.getElementById('tab-signin').classList.toggle('active', isSignin);
  document.getElementById('tab-signup').classList.toggle('active', !isSignin);
}

// ── Share ─────────────────────────────────────────────────
async function loadSharedBoard(token) {
  const { data, error } = await db.rpc('get_shared_board', { p_token: token });
  if (error || !data || data.length === 0) {
    showInvalidShareUI();
    return;
  }
  const perm = data[0].permission;
  showSharedBoardUI(perm);
  renderShared(data, perm);
  initSharedRealtime(token);
}

function initSharedRealtime(token) {
  realtimeChannel = db.channel(`share-${token}`)
    .on('broadcast', { event: 'board-update' }, async () => {
      const { data } = await db.rpc('get_shared_board', { p_token: token });
      if (data && data.length > 0) renderShared(data, data[0].permission);
    })
    .subscribe();
}

async function broadcastBoardUpdate() {
  if (!realtimeChannel) return;
  await realtimeChannel.send({ type: 'broadcast', event: 'board-update', payload: {} });
}

function showSharedBoardUI(perm) {
  document.getElementById('auth-section').hidden = true;
  document.getElementById('app-section').hidden = false;
  document.getElementById('user-bar') && (document.querySelector('.user-bar').hidden = true);
  document.querySelector('.user-bar').hidden = true;
  const badge = document.getElementById('share-badge');
  badge.hidden = false;
  badge.textContent = perm === 'edit' ? '편집 가능' : '읽기 전용';
  badge.className = 'share-badge share-badge--' + (perm === 'edit' ? 'edit' : 'readonly');
  if (perm !== 'edit') {
    document.getElementById('addBtn').hidden = true;
    document.getElementById('todoInput').hidden = true;
  }
}

function showInvalidShareUI() {
  document.getElementById('auth-section').hidden = true;
  document.getElementById('app-section').hidden = true;
  const msg = document.createElement('div');
  msg.className = 'invalid-share';
  msg.innerHTML = '<p>유효하지 않거나 만료된 공유 링크입니다.</p>';
  document.body.appendChild(msg);
}

function renderShared(todos, perm) {
  STATUSES.forEach(status => {
    const listEl = document.getElementById('list-' + status);
    const countEl = document.getElementById('count-' + status);
    const items = todos.filter(t => t.status === status);
    listEl.innerHTML = '';
    countEl.textContent = items.length;
    items.forEach(todo => listEl.appendChild(createCard(todo, perm !== 'edit')));
  });
}

async function openShareModal() {
  const { data, error } = await db
    .from('board_shares')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (error) { console.error(error); return; }

  if (!data) {
    const { data: inserted, error: insertErr } = await db
      .from('board_shares')
      .insert({ user_id: currentUser.id, is_active: false, permission: 'readonly' })
      .select()
      .single();
    if (insertErr) { console.error(insertErr); return; }
    currentShareData = inserted;
  } else {
    currentShareData = data;
  }

  const toggle = document.getElementById('shareToggle');
  toggle.checked = currentShareData.is_active;
  document.getElementById('share-options').hidden = !currentShareData.is_active;

  const permValue = currentShareData.permission;
  document.querySelector(`input[name="perm"][value="${permValue}"]`).checked = true;
  document.getElementById('shareLinkInput').value =
    `${APP_URL}?share=${currentShareData.share_token}`;

  document.getElementById('share-modal').hidden = false;
}

async function toggleShare(active) {
  const { error } = await db
    .from('board_shares')
    .update({ is_active: active })
    .eq('id', currentShareData.id);
  if (error) { console.error(error); return; }
  currentShareData.is_active = active;
  document.getElementById('share-options').hidden = !active;
}

async function updatePermission(perm) {
  const { error } = await db
    .from('board_shares')
    .update({ permission: perm })
    .eq('id', currentShareData.id);
  if (error) { console.error(error); return; }
  currentShareData.permission = perm;
}

function copyShareLink() {
  const link = document.getElementById('shareLinkInput').value;
  navigator.clipboard.writeText(link).then(() => {
    const btn = document.getElementById('copyLinkBtn');
    btn.textContent = '복사됨!';
    setTimeout(() => { btn.textContent = '복사'; }, 2000);
  });
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

function createCard(todo, readonly = false) {
  const card = document.createElement('div');
  card.className = 'card';
  card.draggable = !readonly;
  card.dataset.id = todo.id;

  const text = document.createElement('span');
  text.className = 'card-text';
  text.textContent = todo.text;

  card.append(text);

  if (!readonly) {
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '✕';
    delBtn.title = '삭제';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTodo(todo.id);
    });
    card.append(delBtn);
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragend', onDragEnd);
  }

  return card;
}

// ── CRUD ─────────────────────────────────────────────────
async function addTodo() {
  const input = document.getElementById('todoInput');
  const text = input.value.trim();
  if (!text) return;

  if (shareToken) {
    const { error } = await db.rpc('add_shared_todo', { p_token: shareToken, p_text: text });
    if (error) { console.error('shared insert error:', error); return; }
    const { data } = await db.rpc('get_shared_board', { p_token: shareToken });
    renderShared(data, 'edit');
    await broadcastBoardUpdate();
  } else {
    if (!currentUser) return;
    const { error } = await db
      .from('todos')
      .insert({ text, status: 'todo', position: Date.now(), user_id: currentUser.id });
    if (error) { console.error('insert error:', error); return; }
    await render();
  }

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
  if (shareToken) {
    const { error } = await db.rpc('move_shared_todo', {
      p_token: shareToken, p_id: id, p_status: newStatus
    });
    if (error) { console.error('shared move error:', error); return; }
    const { data } = await db.rpc('get_shared_board', { p_token: shareToken });
    renderShared(data, 'edit');
    await broadcastBoardUpdate();
  } else {
    const { error } = await db
      .from('todos')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) { console.error('update error:', error); return; }
    await render();
  }
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
document.getElementById('githubBtn').addEventListener('click', signInWithGitHub);
document.getElementById('googleBtn').addEventListener('click', signInWithGoogle);

document.getElementById('shareBtn').addEventListener('click', openShareModal);
document.getElementById('closeShareModal').addEventListener('click', () => {
  document.getElementById('share-modal').hidden = true;
});
document.getElementById('shareToggle').addEventListener('change', e => toggleShare(e.target.checked));
document.querySelectorAll('input[name="perm"]').forEach(radio => {
  radio.addEventListener('change', e => updatePermission(e.target.value));
});
document.getElementById('copyLinkBtn').addEventListener('click', copyShareLink);
document.getElementById('share-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.hidden = true;
});

if (shareToken) {
  loadSharedBoard(shareToken);
} else {
  initAuth();
}
