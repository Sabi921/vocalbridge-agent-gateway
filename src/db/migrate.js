
const fs = require('fs');
const path = require('path');
const { getDb } = require('./index');

async function run() {
  const db = await getDb();
  const sql = fs.readFileSync(path.join(__dirname, '../../sql/001_init.sql'), 'utf-8');
  await db.exec(sql);
  console.log('DB migrated');
}

run().catch((e) => {
  console.error('Migration failed', e);
  process.exit(1);
});

