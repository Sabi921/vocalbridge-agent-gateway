const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { env } = require('../config/env');

let db;

async function getDb() {
  if (db) return db;
  db = await open({
    filename: env.DATABASE_PATH,
    driver: sqlite3.Database
  });
  await db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

async function closeDb() {
  if (db) {
    await db.close();
    db = undefined;
  }
}

module.exports = { getDb, closeDb };