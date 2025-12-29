console.log("Loading GamerFile...");

async function loadProjects() {
  const container = document.getElementById('cf-projects');
  if (!container) return;

  try {
    const response = await fetch('data/projects.json');
    if (!response.ok) throw new Error('Failed to load projects');
    
    const data = await response.json();
    const projects = data.curseforge || []; // Assuming structure { curseforge: [], github: [] }
    const repos = data.github || [];

    renderSection(container, projects, "No projects found.");
    renderSection(document.getElementById('gh-repos'), repos, "No repos found.");

  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="error">SYSTEM ERROR: DATA_FETCH_FAILED</p>';
  }
}

function renderSection(container, items, emptyMsg) {
  if (!container) return;
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = `<p>${emptyMsg}</p>`;
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${item.name}</h3>
      <div class="card-meta">Downloads: ${item.downloadCount || 0}</div>
      <p>${item.summary || item.description || 'No description.'}</p>
      <div class="card-actions">
        <a href="${item.url}" target="_blank" class="btn">VIEW ></a>
      </div>
    `;
    container.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', loadProjects);
