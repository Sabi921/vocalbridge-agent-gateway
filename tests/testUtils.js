
const fs = require('fs');
const path = require('path');

const { closeDb } = require('../src/db');

function tempDbPath(name = 'test.sqlite') {
  return path.join(__dirname, '.tmp', name);
}

async function resetTestDb(dbPath) {
  // close cached db handle first
  await closeDb();

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  process.env.DATABASE_PATH = dbPath;

  const migrate = require('../src/db/migrate'); 

  if (typeof migrate === 'function') {
    await migrate();
  }
}

module.exports = { tempDbPath, resetTestDb };
