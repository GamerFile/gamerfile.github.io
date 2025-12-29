import fetch from 'node-fetch';

async function checkProject(slug) {
    // Try MC Mods first
    let url = `https://api.cfwidget.com/minecraft/mc-mods/${slug}`;
    console.log(`Checking: ${url}`);
    try {
        let res = await fetch(url);
        if (!res.ok) {
            // Try texture packs/addons if mc-mods fails (Bedrock sometimes weird)
            url = `https://api.cfwidget.com/minecraft/texture-packs/${slug}`;
            console.log(`Checking: ${url}`);
            res = await fetch(url);
        }

        if (!res.ok) {
            // Try customisation
            url = `https://api.cfwidget.com/minecraft/customization/${slug}`;
            console.log(`Checking: ${url}`);
            res = await fetch(url);
        }

        if (!res.ok) throw new Error("Not found");

        const data = await res.json();
        console.log(`--- ${slug} ---`);
        console.log(`Project ID: ${data.id}`);
        console.log("Members:", JSON.stringify(data.members, null, 2));
    } catch (e) {
        console.error(`Failed to find ${slug}: ${e.message}`);
    }
}

// Slugs guessed from search results
checkProject('warpads-classic');
checkProject('fishing-is-op-now-achievement-support');
checkProject('structures-loot-are-op'); // Control
