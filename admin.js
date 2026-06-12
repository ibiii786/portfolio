// ==========================================================================
// Admin dashboard — auth + project CRUD
// ==========================================================================

const TYPE_LABELS = {
  design: 'Design',
  webapp: 'Web App',
  ml: 'ML System',
};

let editingId = null;
let pendingImageFile = null;

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheEls();
  bindEvents();
  checkSession();
});

function cacheEls() {
  els.loginScreen = document.getElementById('login-screen');
  els.dashboard = document.getElementById('dashboard');
  els.loginForm = document.getElementById('login-form');
  els.loginEmail = document.getElementById('login-email');
  els.loginPassword = document.getElementById('login-password');
  els.loginError = document.getElementById('login-error');
  els.loginSubmit = document.getElementById('login-submit');
  els.logoutBtn = document.getElementById('logout-btn');

  els.projectForm = document.getElementById('project-form');
  els.formTitle = document.getElementById('form-title');
  els.formError = document.getElementById('form-error');
  els.formSuccess = document.getElementById('form-success');
  els.formSubmit = document.getElementById('form-submit');
  els.formCancel = document.getElementById('form-cancel');

  els.projectId = document.getElementById('project-id');
  els.title = document.getElementById('title');
  els.description = document.getElementById('description');
  els.type = document.getElementById('type');
  els.displayOrder = document.getElementById('display-order');
  els.tags = document.getElementById('tags');
  els.figmaEmbed = document.getElementById('figma-embed');
  els.liveUrl = document.getElementById('live-url');
  els.githubUrl = document.getElementById('github-url');
  els.coverImage = document.getElementById('cover-image');
  els.coverImageUrl = document.getElementById('cover-image-url');
  els.imagePreview = document.getElementById('image-preview');

  els.adminList = document.getElementById('admin-list');
}

function bindEvents() {
  els.loginForm.addEventListener('submit', handleLogin);
  els.logoutBtn.addEventListener('click', handleLogout);
  els.projectForm.addEventListener('submit', handleSubmit);
  els.formCancel.addEventListener('click', resetForm);
  els.coverImage.addEventListener('change', handleImageSelect);
}

// --------------------------------------------------------------------------
// Auth
// --------------------------------------------------------------------------
async function checkSession() {
  try {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      showDashboard();
    } else {
      showLogin();
    }
  } catch (err) {
    console.error('Session check failed:', err);
    showLogin();
  }
}

function showLogin() {
  els.loginScreen.hidden = false;
  els.dashboard.hidden = true;
}

function showDashboard() {
  els.loginScreen.hidden = true;
  els.dashboard.hidden = false;
  loadProjects();
}

async function handleLogin(e) {
  e.preventDefault();
  els.loginError.textContent = '';
  els.loginSubmit.disabled = true;
  els.loginSubmit.textContent = 'Signing in…';

  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;

  let error;
  try {
    const result = await supabaseClient.auth.signInWithPassword({ email, password });
    error = result.error;
  } catch (err) {
    error = err;
  }

  els.loginSubmit.disabled = false;
  els.loginSubmit.textContent = 'Sign in';

  if (error) {
    els.loginError.textContent = 'Sign-in failed. Check your email and password.';
    return;
  }

  els.loginForm.reset();
  showDashboard();
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  showLogin();
}

// --------------------------------------------------------------------------
// Image handling
// --------------------------------------------------------------------------
function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) {
    pendingImageFile = null;
    els.imagePreview.classList.remove('is-visible');
    return;
  }

  pendingImageFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    els.imagePreview.src = ev.target.result;
    els.imagePreview.classList.add('is-visible');
  };
  reader.readAsDataURL(file);
}

async function uploadImage(file) {
  const ext = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabaseClient.storage
    .from(PROJECT_IMAGES_BUCKET)
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }

  const { data } = supabaseClient.storage
    .from(PROJECT_IMAGES_BUCKET)
    .getPublicUrl(fileName);

  return data.publicUrl;
}

async function deleteImageByUrl(url) {
  if (!url) return;
  try {
    const fileName = url.split('/').pop();
    await supabaseClient.storage.from(PROJECT_IMAGES_BUCKET).remove([fileName]);
  } catch (err) {
    console.warn('Could not delete old image:', err);
  }
}

// --------------------------------------------------------------------------
// Form submit (create / update)
// --------------------------------------------------------------------------
async function handleSubmit(e) {
  e.preventDefault();
  els.formError.textContent = '';
  els.formSuccess.textContent = '';

  const title = els.title.value.trim();
  const description = els.description.value.trim();

  if (!title || !description) {
    els.formError.textContent = 'Title and description are required.';
    return;
  }

  els.formSubmit.disabled = true;
  els.formSubmit.textContent = editingId ? 'Saving…' : 'Adding…';

  try {
    let coverImageUrl = els.coverImageUrl.value || null;

    if (pendingImageFile) {
      if (editingId && coverImageUrl) {
        await deleteImageByUrl(coverImageUrl);
      }
      coverImageUrl = await uploadImage(pendingImageFile);
    }

    const tags = els.tags.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title,
      description,
      type: els.type.value,
      tags,
      figma_embed_url: els.figmaEmbed.value.trim() || null,
      live_url: els.liveUrl.value.trim() || null,
      github_url: els.githubUrl.value.trim() || null,
      cover_image_url: coverImageUrl,
      display_order: parseInt(els.displayOrder.value, 10) || 0,
    };

    let error;
    if (editingId) {
      ({ error } = await supabaseClient.from('projects').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabaseClient.from('projects').insert(payload));
    }

    if (error) throw new Error(error.message);

    els.formSuccess.textContent = editingId ? 'Project updated.' : 'Project added.';
    resetForm();
    loadProjects();
  } catch (err) {
    console.error(err);
    els.formError.textContent = err.message || 'Something went wrong. Please try again.';
  } finally {
    els.formSubmit.disabled = false;
    els.formSubmit.textContent = editingId ? 'Save changes' : 'Add project';
  }
}

function resetForm() {
  editingId = null;
  pendingImageFile = null;
  els.projectForm.reset();
  els.projectId.value = '';
  els.coverImageUrl.value = '';
  els.imagePreview.classList.remove('is-visible');
  els.imagePreview.src = '';
  els.formTitle.textContent = 'Add project';
  els.formSubmit.textContent = 'Add project';
  els.formCancel.hidden = true;
  els.formError.textContent = '';
  els.formSuccess.textContent = '';
  els.displayOrder.value = '0';
}

// --------------------------------------------------------------------------
// Project list
// --------------------------------------------------------------------------
async function loadProjects() {
  els.adminList.innerHTML = '<p class="admin-empty">Loading…</p>';

  let data, error;
  try {
    const result = await supabaseClient
      .from('projects')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    data = result.data;
    error = result.error;
  } catch (err) {
    error = err;
  }

  if (error) {
    els.adminList.innerHTML = `<p class="admin-empty">Failed to load projects: ${escapeHTML(error.message)}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    els.adminList.innerHTML = '<p class="admin-empty">No projects yet. Add your first one above.</p>';
    return;
  }

  els.adminList.innerHTML = '';
  data.forEach((project) => {
    els.adminList.appendChild(renderAdminCard(project));
  });
}

function renderAdminCard(project) {
  const card = document.createElement('div');
  card.className = 'admin-card';

  const thumbSrc = project.cover_image_url || '';
  const typeLabel = TYPE_LABELS[project.type] || project.type;

  card.innerHTML = `
    ${thumbSrc
      ? `<img class="admin-card__thumb" src="${escapeAttr(thumbSrc)}" alt="" />`
      : `<div class="admin-card__thumb"></div>`}
    <div class="admin-card__body">
      <div class="admin-card__title">${escapeHTML(project.title)}</div>
      <div class="admin-card__meta">
        <span>${escapeHTML(typeLabel)}</span>
        <span>Order: ${project.display_order}</span>
        ${project.figma_embed_url ? '<span>Has Figma embed</span>' : ''}
      </div>
    </div>
    <div class="admin-card__actions">
      <button class="btn btn--ghost" data-action="edit">Edit</button>
      <button class="btn btn--danger" data-action="delete">Delete</button>
    </div>
  `;

  card.querySelector('[data-action="edit"]').addEventListener('click', () => editProject(project));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteProject(project));

  return card;
}

function editProject(project) {
  editingId = project.id;
  pendingImageFile = null;

  els.projectId.value = project.id;
  els.title.value = project.title || '';
  els.description.value = project.description || '';
  els.type.value = project.type || 'design';
  els.displayOrder.value = project.display_order ?? 0;
  els.tags.value = (project.tags || []).join(', ');
  els.figmaEmbed.value = project.figma_embed_url || '';
  els.liveUrl.value = project.live_url || '';
  els.githubUrl.value = project.github_url || '';
  els.coverImageUrl.value = project.cover_image_url || '';
  els.coverImage.value = '';

  if (project.cover_image_url) {
    els.imagePreview.src = project.cover_image_url;
    els.imagePreview.classList.add('is-visible');
  } else {
    els.imagePreview.classList.remove('is-visible');
  }

  els.formTitle.textContent = 'Edit project';
  els.formSubmit.textContent = 'Save changes';
  els.formCancel.hidden = false;
  els.formError.textContent = '';
  els.formSuccess.textContent = '';

  els.projectForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteProject(project) {
  const confirmed = confirm(`Delete "${project.title}"? This cannot be undone.`);
  if (!confirmed) return;

  const { error } = await supabaseClient.from('projects').delete().eq('id', project.id);

  if (error) {
    alert(`Failed to delete: ${error.message}`);
    return;
  }

  if (project.cover_image_url) {
    await deleteImageByUrl(project.cover_image_url);
  }

  if (editingId === project.id) {
    resetForm();
  }

  loadProjects();
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function escapeHTML(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function escapeAttr(str) {
  if (str == null) return '';
  return String(str).replace(/"/g, '&quot;');
}
