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

  makeExpandable(card, () => handleExpand('cf', project));
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

  makeExpandable(card, () => handleExpand('gh', repo));
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
  const card = el('div', 'cert');

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
  caption.append(detailHint());
  card.append(caption);

  makeExpandable(card, () => handleExpand('cert', cert));
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

function buildCertDetail(cert) {
  const frag = document.createDocumentFragment();

  const imgWrap = el('div', 'cert-modal-image');
  if (cert.image) {
    const img = document.createElement('img');
    img.src = cert.image;
    img.alt = cert.title || 'certificate';
    img.addEventListener('error', () => {
      img.remove();
      imgWrap.classList.add('cert-thumb-empty');
      imgWrap.append(el('span', 'cert-fallback', 'image not found'));
    });
    imgWrap.append(img);
  } else {
    imgWrap.classList.add('cert-thumb-empty');
    imgWrap.append(el('span', 'cert-fallback', 'no image provided'));
  }
  frag.append(imgWrap);

  frag.append(el('p', 'comment modal-section-label', '// details'));
  const meta = el('div', 'proj modal-meta');
  meta.append(el('span', 'brace', '{'));
  meta.append(row('title', 'str', `"${cert.title || 'certificate'}"`));
  const issuerRow = metaRow('issuer', cert.issuer);
  if (issuerRow) meta.append(issuerRow);
  const dateRow = metaRow('issued', cert.date);
  if (dateRow) meta.append(dateRow);
  meta.append(el('span', 'brace', '}'));
  frag.append(meta);

  if (cert.url) {
    frag.append(externalLinkBar(cert.url, 'Verify credential'));
  }

  return frag;
}

function openCertModal(cert) {
  openModal(`${truncate(cert.title || 'certificate', 46)}`);
  modalBody.append(buildCertDetail(cert));
}

function buildCfDetail(project) {
  const frag = document.createDocumentFragment();

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
  frag.append(meta);

  frag.append(el('p', 'comment modal-section-label', '// description'));
  const desc = el('div', 'md-body');
  if (project.description) {
    desc.innerHTML = sanitizeHtml(project.description);
  } else {
    desc.append(el('p', null, project.summary || 'No description available.'));
  }
  frag.append(desc);

  if (project.files && project.files.length) {
    frag.append(el('p', 'comment modal-section-label', '// recent releases'));
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
    frag.append(list);
  }

  frag.append(externalLinkBar(project.url, 'View on CurseForge'));
  return frag;
}

function openCfModal(project) {
  openModal(`${truncate(project.name, 46)}.md`);
  modalBody.append(buildCfDetail(project));
}

function buildGhDetail(repo) {
  const frag = document.createDocumentFragment();

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
  frag.append(meta);

  frag.append(el('p', 'comment modal-section-label', '// description'));
  const desc = el('div', 'md-body');
  desc.append(el('p', null, repo.summary || 'No description available.'));
  frag.append(desc);

  if (repo.readme) {
    frag.append(el('p', 'comment modal-section-label', '// readme.md'));
    const readme = el('div', 'md-body');
    readme.innerHTML = sanitizeHtml(repo.readme);
    frag.append(readme);
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
  frag.append(links);

  return frag;
}

function openGhModal(repo) {
  openModal(`${truncate(repo.name, 46)}.md`);
  modalBody.append(buildGhDetail(repo));
}

/* ---------------- desktop tab system ---------------- */

const tabStrip = document.getElementById('tab-strip');
const profileTabEl = document.getElementById('tab-profile');
const paneBrowse = document.getElementById('pane-browse');
const paneDetail = document.getElementById('pane-detail');

let openTabsState = [];
let activeTabId = 'profile';

function isDesktopViewport() {
  return window.matchMedia('(min-width: 901px)').matches;
}

function tabIdFor(type, data) {
  if (type === 'cf') return `cf:${data.url || data.name}`;
  if (type === 'gh') return `gh:${data.url || data.name}`;
  return `cert:${data.title || ''}::${data.image || ''}`;
}

function tabLabelFor(type, data) {
  if (type === 'cf') return `${truncate(data.name || 'project', 20)}.md`;
  if (type === 'gh') return `${truncate(data.name || 'repo', 20)}.md`;
  return `${truncate(data.title || 'certificate', 20)}.png`;
}

function tabDotClass(type) {
  if (type === 'cf') return 'dot-json';
  if (type === 'gh') return 'dot-js';
  return 'dot-md';
}

function renderSidebarTree() {
  ['cf', 'gh', 'cert'].forEach((type) => {
    const container = document.getElementById(`tree-children-${type}`);
    if (!container) return;
    container.innerHTML = '';

    openTabsState
      .filter((tab) => tab.type === type)
      .forEach((tab) => {
        const item = el('div', 'file-child' + (tab.id === activeTabId ? ' active' : ''));
        item.dataset.tabId = tab.id;
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');

        item.append(el('span', `file-dot ${tabDotClass(tab.type)}`));
        item.append(el('span', 'file-child-label', tab.label));

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'file-child-close';
        close.textContent = '✕';
        close.setAttribute('aria-label', `Close ${tab.label}`);
        close.addEventListener('click', (e) => {
          e.stopPropagation();
          closeTab(tab.id);
        });
        item.append(close);

        item.addEventListener('click', () => setActiveTab(tab.id));
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setActiveTab(tab.id);
          }
        });

        container.append(item);
      });
  });
}

function renderOpenTabsUI() {
  renderTabStrip();
  renderSidebarTree();
}

function handleExpand(type, data) {
  if (isDesktopViewport()) {
    openDetailTab(type, data);
    return;
  }
  if (type === 'cf') openCfModal(data);
  else if (type === 'gh') openGhModal(data);
  else openCertModal(data);
}

function openDetailTab(type, data) {
  const id = tabIdFor(type, data);
  let tab = openTabsState.find((t) => t.id === id);
  if (!tab) {
    tab = { id, type, data, label: tabLabelFor(type, data) };
    openTabsState.push(tab);
  }
  setActiveTab(id);
}

function setActiveTab(id) {
  activeTabId = id;
  renderOpenTabsUI();
  showPane(id);

  const activeEl = id === 'profile' ? profileTabEl : tabStrip.querySelector(`[data-tab-id="${CSS.escape(id)}"]`);
  if (activeEl) activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function closeTab(id) {
  const idx = openTabsState.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const [removed] = openTabsState.splice(idx, 1);
  if (removed.contentEl) removed.contentEl.remove();

  if (activeTabId === id) {
    const fallback = openTabsState[idx - 1] || openTabsState[0];
    setActiveTab(fallback ? fallback.id : 'profile');
  } else {
    renderOpenTabsUI();
  }
}

function renderTabStrip() {
  [...tabStrip.querySelectorAll('.tab[data-dynamic="true"]')].forEach((t) => t.remove());
  profileTabEl.classList.toggle('active', activeTabId === 'profile');

  openTabsState.forEach((tab) => {
    const tabEl = el('div', 'tab' + (tab.id === activeTabId ? ' active' : ''));
    tabEl.dataset.dynamic = 'true';
    tabEl.dataset.tabId = tab.id;
    tabEl.setAttribute('role', 'button');
    tabEl.setAttribute('tabindex', '0');

    tabEl.append(el('span', `file-dot ${tabDotClass(tab.type)}`));
    tabEl.append(el('span', 'tab-label', tab.label));

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tab-close';
    close.textContent = '✕';
    close.setAttribute('aria-label', `Close ${tab.label}`);
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    tabEl.append(close);

    tabEl.addEventListener('click', () => setActiveTab(tab.id));
    tabEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setActiveTab(tab.id);
      }
    });
    // Middle-click (mouse wheel press) closes a tab, matching browser/editor
    // convention. preventDefault on mousedown stops the browser's autoscroll
    // cursor from kicking in on the middle-button press.
    tabEl.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault();
    });
    tabEl.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        closeTab(tab.id);
      }
    });

    tabStrip.append(tabEl);
  });
}

function getOrCreateDetailContent(tab) {
  if (tab.contentEl) return tab.contentEl;

  const container = el('div', 'detail-content');
  container.hidden = true;
  container.dataset.tabId = tab.id;

  let fragment;
  if (tab.type === 'cf') fragment = buildCfDetail(tab.data);
  else if (tab.type === 'gh') fragment = buildGhDetail(tab.data);
  else fragment = buildCertDetail(tab.data);
  container.append(fragment);

  paneDetail.append(container);
  tab.contentEl = container;
  return container;
}

function showPane(id) {
  const isProfile = id === 'profile';
  paneBrowse.hidden = !isProfile;
  paneDetail.hidden = isProfile;

  if (isProfile) return;

  const tab = openTabsState.find((t) => t.id === id);
  if (!tab) return;

  const content = getOrCreateDetailContent(tab);
  [...paneDetail.children].forEach((child) => {
    child.hidden = child !== content;
  });
}

profileTabEl.addEventListener('click', () => setActiveTab('profile'));
profileTabEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    setActiveTab('profile');
  }
});

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

/* ---------------- sidebar scrollspy ---------------- */

function setupSidebarNav() {
  const links = [...document.querySelectorAll('.file-item')];
  if (!links.length) return;

  const targets = links
    .map((link) => document.getElementById(link.dataset.target))
    .filter(Boolean);
  if (!targets.length) return;

  const setActive = (id) => {
    links.forEach((link) => link.classList.toggle('active', link.dataset.target === id));
  };

  links.forEach((link) => {
    link.addEventListener('click', () => {
      if (activeTabId !== 'profile') setActiveTab('profile');
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    },
    { rootMargin: '-10% 0px -75% 0px', threshold: 0 }
  );

  targets.forEach((t) => observer.observe(t));
  setActive(targets[0].id);
}

main();
loadCertificates();
setupSidebarNav();