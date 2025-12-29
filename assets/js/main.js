console.log("Loading GamerFile...");

async function loadProjects() {
  const container = document.getElementById('cf-projects');
  if (!container) return;

  try {
    const response = await fetch('data/projects.json');
    if (!response.ok) throw new Error('Failed to load projects');

    const data = await response.json();
    const projects = data.curseforge || [];
    const repos = data.github || [];

    renderSection(container, projects, "No projects found.", true);
    renderSection(document.getElementById('gh-repos'), repos, "No repos found.", false);

  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="error">SYSTEM ERROR: DATA_FETCH_FAILED</p>';
  }
}

function renderSection(container, items, emptyMsg, isCurseForge) {
  if (!container) return;
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = `<p>${emptyMsg}</p>`;
    return;
  }

  items.forEach(item => {
    // Determine Image
    // Use project thumbnail or a generic placeholder based on type
    let imageUrl = item.thumbnail;
    if (!imageUrl) {
      imageUrl = isCurseForge
        ? 'https://www.curseforge.com/images/cf-logo-inv.png' // Generic CF logo? or just a colored block
        : 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
    }

    // Number Formatting
    const downloads = item.downloadCount
      ? new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(item.downloadCount)
      : 0;

    const metaInfo = isCurseForge
      ? `<span>⬇ ${downloads} Downloads</span> <span>📂 ${item.categories[0] || 'Mod'}</span>`
      : `<span>⭐ ${item.stars || 0} Stars</span> <span>💻 ${item.language || 'Code'}</span>`;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-thumb">
        <img src="${imageUrl}" alt="${item.name}" loading="lazy" onError="this.style.display='none'">
      </div>
      <div class="card-content">
        <h3>${item.name}</h3>
        <div class="card-meta">${metaInfo}</div>
        <p>${item.summary || item.description || 'No description available.'}</p>
        <a href="${item.url}" target="_blank" class="btn">VIEW PROJECT</a>
      </div>
    `;
    container.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', loadProjects);
