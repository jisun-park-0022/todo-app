const STORAGE_KEY = 'kanban_todos';
const STATUSES = ['todo', 'inprogress', 'done'];

let draggedId = null;

// ── Storage ──────────────────────────────────────────────
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function save(todos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Render ───────────────────────────────────────────────
function render() {
  const todos = load();

  STATUSES.forEach(status => {
    const listEl  = document.getElementById('list-' + status);
    const countEl = document.getElementById('count-' + status);
    const items   = todos.filter(t => t.status === status);

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
  card.addEventListener('dragend',   onDragEnd);

  card.append(text, delBtn);
  return card;
}

// ── CRUD ─────────────────────────────────────────────────
function addTodo() {
  const input = document.getElementById('todoInput');
  const text  = input.value.trim();
  if (!text) return;

  const todos = load();
  todos.push({ id: genId(), text, status: 'todo' });
  save(todos);
  render();

  input.value = '';
  input.focus();
}

function deleteTodo(id) {
  const todos = load().filter(t => t.id !== id);
  save(todos);
  render();
}

function moveCard(id, newStatus) {
  const todos = load();
  const todo  = todos.find(t => t.id === id);
  if (!todo || todo.status === newStatus) return;
  todo.status = newStatus;
  save(todos);
  render();
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
  // only remove highlight when leaving the list area itself, not a child
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (draggedId) {
    moveCard(draggedId, e.currentTarget.dataset.status);
  }
}

// ── Init ─────────────────────────────────────────────────
document.getElementById('addBtn').addEventListener('click', addTodo);
document.getElementById('todoInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTodo();
});

render();
