const DATA_URL = 'data/projects.json';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function row(keyName, valueClass, valueText) {
  const r = el('div', 'row');
  r.append(el('span', 'key', keyName));
  r.append(el('span', 'punct', ': '));
  r.append(el('span', valueClass, valueText));
  return r;
}

function formatNumber(n) {
  if (typeof n !== 'number') return '0';
  return n.toLocaleString('en-US');
}

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i += 1;
  }
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1).trimEnd() + '\u2026' : str;
}

/**
 * Strips anything that isn't safe to inject as innerHTML: scripts, styles,
 * iframes/objects/embeds (replaced with a plain link instead), and any
 * event-handler ("on*") or javascript: attributes. Everything else
 * (headings, lists, links, images, formatting, inline color spans) passes
 * through untouched.
 */
function sanitizeHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');

  doc.querySelectorAll('script, style, link, meta, base, object, embed').forEach((node) => node.remove());

  doc.querySelectorAll('iframe').forEach((node) => {
    const src = node.getAttribute('src') || '';
    const a = doc.createElement('a');
    a.href = src;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'Watch video ↗';
    a.className = 'md-embed-link';
    node.replaceWith(a);
  });

  doc.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on') || value.startsWith('javascript:')) {
        node.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}

function categoryRow(categories) {
  const r = el('div', 'row');
  r.append(el('span', 'key', 'categories'));
  r.append(el('span', 'punct', ': ['));
  categories.forEach((cat, i) => {
    r.append(el('span', 'str', `"${cat}"`));
    if (i < categories.length - 1) r.append(el('span', 'punct', ', '));
  });
  r.append(el('span', 'punct', ']'));
  return r;
}

function detailHint() {
  return el('div', 'detail-hint', '↧ click for details');
}

function makeExpandable(card, onOpen) {
  card.classList.add('is-expandable');
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.addEventListener('click', onOpen);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  });
}

function renderCurseForgeCard(project) {
  const card = el('div', 'proj');

  card.append(el('span', 'brace', '{'));
  card.append(row('name', 'str', `"${truncate(project.name || 'untitled', 40)}"`));
  card.append(row('downloads', 'num', formatNumber(project.downloadCount)));
  if (project.categories && project.categories.length) {
    card.append(categoryRow(project.categories));
  }
  if (project.summary) {
    card.append(row('summary', 'summary', `"${truncate(project.summary, 90)}"`));
  }
  card.append(el('span', 'brace', '}'));
  card.append(detailHint());

  makeExpandable(card, () => openCfModal(project));
  return card;
}

function renderGitHubCard(repo) {
  const card = el('div', 'proj');

  card.append(el('span', 'brace', '{'));
  card.append(row('name', 'str', `"${truncate(repo.name || 'untitled', 40)}"`));
  if (repo.language) {
    card.append(row('language', 'str', `"${repo.language}"`));
  }
  card.append(row('stars', 'num', formatNumber(repo.stars)));
  if (repo.summary) {
    card.append(row('summary', 'summary', `"${truncate(repo.summary, 90)}"`));
  }
  const updated = formatDate(repo.updatedAt);
  if (updated) {
    card.append(row('updated', 'str', `"${updated}"`));
  }
  card.append(el('span', 'brace', '}'));
  card.append(detailHint());

  makeExpandable(card, () => openGhModal(repo));
  return card;
}

function renderStats(container, data) {
  container.innerHTML = '';

  const cf = data.curseforge || [];
  const gh = data.github || [];

  const totalDownloads = cf.reduce((sum, p) => sum + (p.downloadCount || 0), 0);
  const totalStars = gh.reduce((sum, r) => sum + (r.stars || 0), 0);
  const topProject = cf.reduce(
    (top, p) => ((p.downloadCount || 0) > (top?.downloadCount || 0) ? p : top),
    null
  );

  const card = el('div', 'proj stats-card');
  card.append(el('span', 'brace', '{'));
  card.append(row('totalDownloads', 'num', formatNumber(totalDownloads)));
  card.append(row('curseforgeProjects', 'num', String(cf.length)));
  card.append(row('githubRepos', 'num', String(gh.length)));
  card.append(row('githubStars', 'num', formatNumber(totalStars)));
  if (topProject) {
    card.append(row('topProject', 'str', `"${truncate(topProject.name, 40)}"`));
  }
  card.append(el('span', 'brace', '}'));

  container.append(card);
}

function renderList(container, items, renderFn, emptyMessage) {
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.append(el('div', 'loading', emptyMessage));
    return;
  }
  items.forEach((item) => container.append(renderFn(item)));
}

function renderError(container, message) {
  container.innerHTML = '';
  container.append(el('div', 'error', message));
}

function renderCertCard(cert) {
  const hasLink = Boolean(cert.url);
  const card = el(hasLink ? 'a' : 'div', 'cert');
  if (hasLink) {
    card.href = cert.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
  }

  const thumb = el('div', 'cert-thumb');
  const img = document.createElement('img');
  img.src = cert.image || '';
  img.alt = cert.title || 'certificate';
  img.loading = 'lazy';
  img.addEventListener('error', () => {
    img.remove();
    thumb.classList.add('cert-thumb-empty');
    thumb.append(el('span', 'cert-fallback', 'image not found'));
  });
  thumb.append(img);
  card.append(thumb);

  const caption = el('div', 'cert-caption');
  caption.append(el('p', 'comment', `// ${cert.title || 'certificate'}`));
  if (cert.issuer) caption.append(row('issuer', 'str', `"${cert.issuer}"`));
  if (cert.date) caption.append(row('issued', 'str', `"${cert.date}"`));
  card.append(caption);

  return card;
}

async function loadCertificates() {
  const container = document.getElementById('certificates');
  if (!container) return;

  try {
    const res = await fetch('data/certificates.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('not found');
    const certs = await res.json();

    container.innerHTML = '';
    if (!certs || certs.length === 0) {
      container.append(el('div', 'loading', '// no certificates added yet — see data/certificates.json'));
      return;
    }
    certs.forEach((cert) => container.append(renderCertCard(cert)));
  } catch (err) {
    container.innerHTML = '';
    container.append(el('div', 'loading', '// add entries to data/certificates.json to populate this section'));
  }
}

/* ---------------- detail modal ---------------- */

const modalOverlay = document.getElementById('modal-overlay');
const modalBody = document.getElementById('modal-body');
const modalTitle = document.getElementById('modal-title');
const modalClose = document.getElementById('modal-close');
let lastFocusedEl = null;

function openModal(titleText) {
  modalTitle.textContent = titleText;
  modalBody.innerHTML = '';
  lastFocusedEl = document.activeElement;
  modalOverlay.hidden = false;
  document.body.classList.add('modal-open');
  modalClose.focus();
}

function closeModal() {
  modalOverlay.hidden = true;
  document.body.classList.remove('modal-open');
  modalBody.innerHTML = '';
  if (lastFocusedEl) lastFocusedEl.focus();
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
});

function metaRow(label, value) {
  if (value === null || value === undefined || value === '') return null;
  return row(label, 'str', typeof value === 'number' ? formatNumber(value) : `"${value}"`);
}

function externalLinkBar(url, label) {
  const bar = el('div', 'modal-link-bar');
  const a = el('a', 'external-link', `${label} ↗`);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  bar.append(a);
  return bar;
}

function openCfModal(project) {
  openModal(`${truncate(project.name, 46)}.md`);

  const meta = el('div', 'proj modal-meta');
  meta.append(el('span', 'brace', '{'));
  meta.append(row('downloads', 'num', formatNumber(project.downloadCount)));
  if (typeof project.monthlyDownloads === 'number') {
    meta.append(row('monthlyDownloads', 'num', formatNumber(project.monthlyDownloads)));
  }
  const typeRow = metaRow('type', project.type);
  if (typeRow) meta.append(typeRow);
  const licenseRow = metaRow('license', project.license);
  if (licenseRow) meta.append(licenseRow);
  const created = formatDate(project.createdAt);
  if (created) meta.append(row('createdAt', 'str', `"${created}"`));
  if (project.categories && project.categories.length) {
    meta.append(categoryRow(project.categories));
  }
  meta.append(el('span', 'brace', '}'));
  modalBody.append(meta);

  modalBody.append(el('p', 'comment modal-section-label', '// description'));
  const desc = el('div', 'md-body');
  if (project.description) {
    desc.innerHTML = sanitizeHtml(project.description);
  } else {
    desc.append(el('p', null, project.summary || 'No description available.'));
  }
  modalBody.append(desc);

  if (project.files && project.files.length) {
    modalBody.append(el('p', 'comment modal-section-label', '// recent releases'));
    const list = el('div', 'file-list');
    project.files.forEach((f) => {
      const item = el('div', 'file-row');
      item.append(el('span', 'str', `"${f.name}"`));
      const metaBits = [];
      if (f.version) metaBits.push(f.version);
      const size = formatBytes(f.filesize);
      if (size) metaBits.push(size);
      if (typeof f.downloads === 'number') metaBits.push(`${formatNumber(f.downloads)} downloads`);
      const uploaded = formatDate(f.uploadedAt);
      if (uploaded) metaBits.push(uploaded);
      item.append(el('span', 'file-meta', metaBits.join(' · ')));
      list.append(item);
    });
    modalBody.append(list);
  }

  modalBody.append(externalLinkBar(project.url, 'View on CurseForge'));
}

function openGhModal(repo) {
  openModal(`${truncate(repo.name, 46)}.md`);

  const meta = el('div', 'proj modal-meta');
  meta.append(el('span', 'brace', '{'));
  meta.append(row('stars', 'num', formatNumber(repo.stars)));
  const langRow = metaRow('language', repo.language);
  if (langRow) meta.append(langRow);
  if (typeof repo.forks === 'number') meta.append(row('forks', 'num', formatNumber(repo.forks)));
  if (typeof repo.watchers === 'number') meta.append(row('watchers', 'num', formatNumber(repo.watchers)));
  if (typeof repo.openIssues === 'number') meta.append(row('openIssues', 'num', formatNumber(repo.openIssues)));
  const licenseRow = metaRow('license', repo.license);
  if (licenseRow) meta.append(licenseRow);
  const branchRow = metaRow('defaultBranch', repo.defaultBranch);
  if (branchRow) meta.append(branchRow);
  const created = formatDate(repo.createdAt);
  if (created) meta.append(row('createdAt', 'str', `"${created}"`));
  const updated = formatDate(repo.updatedAt);
  if (updated) meta.append(row('updatedAt', 'str', `"${updated}"`));
  if (repo.topics && repo.topics.length) {
    meta.append(categoryRow(repo.topics));
  }
  meta.append(el('span', 'brace', '}'));
  modalBody.append(meta);

  modalBody.append(el('p', 'comment modal-section-label', '// description'));
  const desc = el('div', 'md-body');
  desc.append(el('p', null, repo.summary || 'No description available.'));
  modalBody.append(desc);

  if (repo.readme) {
    modalBody.append(el('p', 'comment modal-section-label', '// readme.md'));
    const readme = el('div', 'md-body');
    readme.innerHTML = sanitizeHtml(repo.readme);
    modalBody.append(readme);
  }

  const links = el('div', 'modal-link-bar');
  const ghLink = el('a', 'external-link', 'View on GitHub ↗');
  ghLink.href = repo.url;
  ghLink.target = '_blank';
  ghLink.rel = 'noopener noreferrer';
  links.append(ghLink);
  if (repo.homepage) {
    const homeLink = el('a', 'external-link', 'Homepage ↗');
    homeLink.href = repo.homepage;
    homeLink.target = '_blank';
    homeLink.rel = 'noopener noreferrer';
    links.append(homeLink);
  }
  modalBody.append(links);
}

/* ---------------- data loading ---------------- */

async function main() {
  const statsContainer = document.getElementById('stats');
  const cfContainer = document.getElementById('cf-projects');
  const ghContainer = document.getElementById('gh-repos');

  try {
    const res = await fetch(DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();

    renderStats(statsContainer, data);
    renderList(cfContainer, data.curseforge, renderCurseForgeCard, '// no curseforge projects found');
    renderList(ghContainer, data.github, renderGitHubCard, '// no github repositories found');
  } catch (err) {
    renderError(statsContainer, `// failed to load data/projects.json (${err.message})`);
    renderError(cfContainer, `// failed to load data/projects.json (${err.message})`);
    renderError(ghContainer, `// failed to load data/projects.json (${err.message})`);
  }
}

main();
loadCertificates();