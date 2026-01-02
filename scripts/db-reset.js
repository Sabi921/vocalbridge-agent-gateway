
const fs = require('fs');
const path = require('path');
const { env } = require('../src/config/env');

async function run() {
    const p = env.DATABASE_PATH;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (fs.existsSync(p)) fs.unlinkSync(p);
    console.log('Deleted DB file:', p);
    require('../src/db/migrate');
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});