import fs from 'fs';
import fetch from 'node-fetch';

const CF_AUTHOR_ID = 128734167;
const CF_AUTHOR_API_URL = `https://api.cfwidget.com/author/${CF_AUTHOR_ID}`;
const GH_USERNAME = 'GamerFile';

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
    try {
        const response = await fetch(CF_AUTHOR_API_URL);

        if (!response.ok) {
            throw new Error(`CFWidget API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const projectList = data.projects || [];

        console.log(`Found ${projectList.length} projects. Fetching details...`);

        // Fetch details for each project to get full metadata (slugs, downloads, etc)
        const detailedProjects = await Promise.all(
            projectList.map(async (p) => {
                const details = await fetchProjectDetails(p.id);
                if (!details) return null;
                return details;
            })
        );

        return detailedProjects.filter(p => p !== null).map(mod => ({
            name: mod.title || mod.name,
            summary: mod.summary || mod.description || "No description available.",
            // CFWidget usually provides a 'urls' object or we construct it.
            // Based on typical response:
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
