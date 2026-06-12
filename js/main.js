// ==========================================================================
// Public page logic — fetch projects, render work section, scroll effects
// ==========================================================================

const TYPE_LABELS = {
  design: 'Design',
  webapp: 'Web App',
  ml: 'ML System',
};

document.addEventListener('DOMContentLoaded', () => {
  initNavScroll();
  initScrollReveal();
  loadProjects();
});

// -- Nav background on scroll --
function initNavScroll() {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  const onScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// -- Scroll-triggered reveal via IntersectionObserver --
function initScrollReveal(root = document) {
  const targets = root.querySelectorAll('.reveal, .reveal-stagger');
  if (!targets.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  targets.forEach((el) => observer.observe(el));
}

// -- Load projects from Supabase and render --
async function loadProjects() {
  const container = document.getElementById('work-list');
  if (!container) return;

  let data, error;
  try {
    const fetchPromise = supabaseClient
      .from('projects')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), 10000)
    );

    const result = await Promise.race([fetchPromise, timeoutPromise]);
    data = result.data;
    error = result.error;
  } catch (err) {
    error = err;
  }

  if (error) {
    console.error('Failed to load projects:', error);
    container.innerHTML = `<p class="work-empty">Unable to load projects right now.</p>`;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = `<p class="work-empty">Projects are being catalogued — check back soon.</p>`;
    return;
  }

  container.innerHTML = '';
  data.forEach((project, index) => {
    container.appendChild(renderWorkItem(project, index));
  });

  initScrollReveal(container);
}

function renderWorkItem(project, index) {
  const item = document.createElement('article');
  item.className = `work-item reveal${index % 2 === 1 ? ' work-item--reverse' : ''}`;

  const typeLabel = TYPE_LABELS[project.type] || project.type;

  // Media: prefer Figma embed > cover image > placeholder
  let mediaHTML;
  if (project.figma_embed_url) {
    mediaHTML = `<iframe src="${escapeAttr(project.figma_embed_url)}" allowfullscreen loading="lazy" title="${escapeAttr(project.title)} prototype"></iframe>`;
  } else if (project.cover_image_url) {
    mediaHTML = `<img src="${escapeAttr(project.cover_image_url)}" alt="${escapeAttr(project.title)}" loading="lazy" />`;
  } else {
    mediaHTML = `<div class="work-item__placeholder"></div>`;
  }

  const tags = (project.tags || [])
    .map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`)
    .join('');

  const links = [];
  if (project.live_url) {
    links.push(linkHTML(project.live_url, 'View live', 'external'));
  }
  if (project.github_url) {
    links.push(linkHTML(project.github_url, 'Source', 'github'));
  }

  item.innerHTML = `
    <div class="work-item__media">${mediaHTML}</div>
    <div class="work-item__info">
      <span class="work-item__type">${escapeHTML(typeLabel)}</span>
      <h3 class="work-item__title">${escapeHTML(project.title)}</h3>
      <p class="work-item__desc">${escapeHTML(project.description)}</p>
      ${tags ? `<div class="work-item__tags">${tags}</div>` : ''}
      ${links.length ? `<div class="work-item__links">${links.join('')}</div>` : ''}
    </div>
  `;

  return item;
}

function linkHTML(url, label, iconType) {
  const icon = iconType === 'github' ? ICONS.github : ICONS.external;
  return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${icon}${escapeHTML(label)}</a>`;
}

const ICONS = {
  external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H8M17 7V16"/></svg>`,
  github: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.5 0 12.3c0 5.43 3.44 10.04 8.21 11.67.6.12.82-.27.82-.59 0-.29-.01-1.07-.02-2.1-3.34.75-4.04-1.65-4.04-1.65-.55-1.43-1.34-1.82-1.34-1.82-1.09-.77.08-.75.08-.75 1.21.09 1.84 1.27 1.84 1.27 1.07 1.87 2.81 1.33 3.5 1.02.11-.79.42-1.33.76-1.64-2.67-.31-5.47-1.37-5.47-6.07 0-1.34.46-2.43 1.22-3.29-.12-.31-.53-1.56.12-3.25 0 0 1-.33 3.3 1.26.96-.27 1.98-.41 3-.41 1.02 0 2.04.14 3 .41 2.3-1.59 3.3-1.26 3.3-1.26.65 1.69.24 2.94.12 3.25.76.86 1.22 1.95 1.22 3.29 0 4.71-2.81 5.76-5.49 6.06.43.38.81 1.13.81 2.28 0 1.65-.01 2.97-.01 3.38 0 .32.21.72.83.59C20.57 22.33 24 17.72 24 12.3 24 5.5 18.63 0 12 0z"/></svg>`,
};

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
