import fetch from 'node-fetch';

const IDS = [1293994, 1303419, 1305843];

async function checkIDs() {
    for (const id of IDS) {
        try {
            const url = `https://api.cfwidget.com/${id}`;
            const res = await fetch(url);
            const data = await res.json();

            console.log(`--- Project ${id} ---`);
            console.log(`Name: ${data.title}`);
            console.log(`Members:`, JSON.stringify(data.members, null, 2));
        } catch (e) {
            console.error(`Error fetching ${id}: ${e.message}`);
        }
    }
}

checkIDs();
