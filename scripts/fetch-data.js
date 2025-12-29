import fs from 'fs';
import fetch from 'node-fetch';

const CF_AUTHOR_ID = 128734167;
const CF_AUTHOR_API_URL = `https://api.cfwidget.com/author/${CF_AUTHOR_ID}`;
const GH_USERNAME = 'GamerFile';

// Manual list of Project IDs to validly fetch if the Author endpoint misses them
const FORCE_PROJECT_IDS = [
    1293994, // Structures Loot
    1303419, // WarPads Classic
    1305843, // Fishing Is Op
    1327197, // Nytheris
    1319919, // Sand Drops Op
    1297324, // Leaves Drop Op
    1292659, // Damage Drops Op
    1299386, // FunTools Addon
    1321423  // Everything You Look Disappears
];

async function fetchProjectDetails(projectId) {
    try {
        const response = await fetch(`https://api.cfwidget.com/${projectId}`);
        return await response.json();
    } catch (e) {
        console.error(`Failed to fetch details for Project ${projectId}`);
        return null;
    }
}

async function fetchCurseForgeProjects() {
    console.log(`Fetching CurseForge projects for Author ID ${CF_AUTHOR_ID}...`);
    let projectsMap = new Map();

    try {
        // 1. Try Dynamic Author Fetch
        const response = await fetch(CF_AUTHOR_API_URL);
        if (response.ok) {
            const data = await response.json();
            const dynamicList = data.projects || [];
            dynamicList.forEach(p => projectsMap.set(p.id, p.id));
        } else {
            console.warn("Dynamic author fetch failed, relying on manual list.");
        }

        // 2. Add Forced IDs
        FORCE_PROJECT_IDS.forEach(id => projectsMap.set(id, id));

        const projectIds = Array.from(projectsMap.values());
        console.log(`Fetching details for ${projectIds.length} projects...`);

        // 3. Fetch Full Details
        const detailedProjects = await Promise.all(
            projectIds.map(async (id) => {
                const details = await fetchProjectDetails(id);
                if (!details) return null;
                return details;
            })
        );

        const validProjects = detailedProjects.filter(p => p !== null && !p.error);

        return validProjects.map(mod => ({
            name: mod.title || mod.name,
            summary: mod.summary || mod.description || "No description available.",
            url: mod.urls?.curseforge || `https://www.curseforge.com/minecraft/mc-mods/${mod.slug}`,
            thumbnail: mod.thumbnail,
            downloadCount: mod.downloads ? mod.downloads.total : 0,
            categories: mod.categories || []
        }));

    } catch (error) {
        console.error("❌ Failed to fetch CurseForge:", error.message);
        return [];
    }
}

async function fetchGitHubRepos() {
    console.log("Fetching GitHub repositories...");
    try {
        const response = await fetch(`https://api.github.com/users/${GH_USERNAME}/repos?sort=updated&type=owner`);

        if (!response.ok) {
            throw new Error(`GitHub API Error: ${response.status}`);
        }

        const repos = await response.json();
        const myRepos = repos.filter(repo => !repo.fork);

        return myRepos.map(repo => ({
            name: repo.name,
            summary: repo.description,
            url: repo.html_url,
            stars: repo.stargazers_count,
            language: repo.language,
            updatedAt: repo.updated_at
        }));

    } catch (error) {
        console.error("❌ Failed to fetch GitHub:", error.message);
        return [];
    }
}

async function main() {
    const cfProjects = await fetchCurseForgeProjects();
    const ghRepos = await fetchGitHubRepos();

    const output = {
        updatedAt: new Date().toISOString(),
        curseforge: cfProjects,
        github: ghRepos
    };

    fs.writeFileSync('data/projects.json', JSON.stringify(output, null, 2));
    console.log(`✅ Saved ${cfProjects.length} CF projects and ${ghRepos.length} GH repos to data/projects.json`);
}

main();
